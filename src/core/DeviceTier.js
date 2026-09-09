// Device Tier Classification & Render Resolution Budget
//
// One build has to run on phones, tablets, laptops and 4K monitors. Those are opposite
// problems: a phone has few pixels and a weak GPU, a 4K panel has enormous pixels and
// usually a mid-range GPU that was never asked whether it could cope.
//
// The renderer previously set pixel ratio once at boot (Engine.js) and once more from the
// "Render HD" toggle (main.js), which overrode the boot clamp of 1.5 up to 2.0. On a 4K
// panel that quadruples every full-screen pass at once.
//
// This module replaces "clamp the device pixel ratio" with "cap the total pixel count",
// which is the number the GPU actually pays for.

export const TIER = {
    MOBILE: 'mobile',
    TABLET: 'tablet',
    DESKTOP: 'desktop',
    DESKTOP_HIGH: 'desktop-high'
};

// Target framebuffer size in pixels. 4K native is 8.29M, so DESKTOP renders a 4K monitor
// at native with no upscale and no downscale. Target there is a comfortable 30fps, not 60.
const PIXEL_BUDGET = {
    [TIER.MOBILE]:       2_300_000,   // ~1080p equivalent
    [TIER.TABLET]:       4_000_000,   // ~1440p equivalent
    [TIER.DESKTOP]:      8_300_000,   // ~4K native
    [TIER.DESKTOP_HIGH]: 8_300_000
};

// Per-tier effect budgets, read by PostProcessing and the sky shader.
// NOTE: half-resolution god rays are NOT implemented yet -- that needs a separate render
// target in the TSL pipeline. Sample count and the sun-visibility gate carry the saving for
// now; see the audit's WO-2 follow-up.
export const TIER_SETTINGS = {
    [TIER.MOBILE]:       { godRaySamples: 8,  skyOctaves: 2, treeDensity: 1.0,  shadows: false },
    [TIER.TABLET]:       { godRaySamples: 16, skyOctaves: 3, treeDensity: 1.5,  shadows: true  },
    [TIER.DESKTOP]:      { godRaySamples: 24, skyOctaves: 4, treeDensity: 2.0,  shadows: true  },
    [TIER.DESKTOP_HIGH]: { godRaySamples: 32, skyOctaves: 4, treeDensity: 2.5,  shadows: true  }
};

function classify() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const ua = nav.userAgent || '';
    const cores = nav.hardwareConcurrency || 4;
    const mem = nav.deviceMemory || 4;           // Chrome only; undefined elsewhere
    const touch = (nav.maxTouchPoints || 0) > 0;

    const isPhoneUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isTabletUA = /iPad|Tablet|PlayBook|Silk/i.test(ua) ||
        // iPadOS 13+ reports as desktop Safari; touch + Mac is the reliable tell
        (/Macintosh/.test(ua) && touch);

    // Physical short edge in CSS pixels, orientation-independent
    const shortEdge = Math.min(
        (typeof screen !== 'undefined' && screen.width) || window.innerWidth,
        (typeof screen !== 'undefined' && screen.height) || window.innerHeight
    );

    if (isPhoneUA && !isTabletUA) return TIER.MOBILE;
    if (isTabletUA) return TIER.TABLET;
    // Touch-primary device with a small screen that didn't match a UA pattern
    if (touch && shortEdge < 820) return TIER.MOBILE;
    if (touch && shortEdge < 1100) return TIER.TABLET;

    // Desktop: split on core count and memory as a rough proxy for GPU class
    if (cores >= 12 && mem >= 8) return TIER.DESKTOP_HIGH;
    if (cores <= 4) return TIER.TABLET;    // low-end laptop / integrated graphics
    return TIER.DESKTOP;
}

let _forcedTier = null;
try {
    const urlParams = typeof window !== 'undefined' && window.location ? new URLSearchParams(window.location.search) : null;
    if (urlParams && urlParams.has('tier') && PIXEL_BUDGET[urlParams.get('tier')]) {
        _forcedTier = urlParams.get('tier');
    } else if (urlParams && urlParams.has('mobile')) {
        _forcedTier = TIER.MOBILE;
    } else if (typeof window !== 'undefined' && window.self !== window.top) {
        _forcedTier = TIER.MOBILE;
    } else {
        const saved = localStorage.getItem('wl_forceTier');
        if (saved && PIXEL_BUDGET[saved]) _forcedTier = saved;
    }
} catch (e) { /* private browsing */ }

export const deviceTier = _forcedTier || classify();
export const tierSettings = TIER_SETTINGS[deviceTier];
export const pixelBudget = PIXEL_BUDGET[deviceTier];

/**
 * Pixel ratio that keeps width*height*ratio^2 inside the tier's budget.
 * Never upscales past the device's own ratio; floors at 0.5 so text stays legible.
 */
export function budgetedPixelRatio(width, height, dpr = window.devicePixelRatio || 1, budget = pixelBudget) {
    const cappedDpr = Math.min(1.0, dpr);
    const cssPixels = Math.max(1, width * height);
    const maxRatio = Math.sqrt(budget / cssPixels);
    return Math.max(0.5, Math.min(cappedDpr, maxRatio));
}

/**
 * Adaptive resolution controller.
 *
 * Samples frame time over a rolling window and nudges a render-scale multiplier up or down.
 * The gap between the two thresholds is deliberate hysteresis: without it the scale
 * oscillates every window and the whole screen visibly breathes.
 *
 * Targets ~30fps (33ms) rather than 60 — at 4K that is the realistic goal.
 */
export class AdaptiveResolution {
    constructor({ onScaleChange, targetMs = 33, windowSize = 90 } = {}) {
        this.onScaleChange = onScaleChange;
        this.targetMs = targetMs;
        this.windowSize = windowSize;
        this.samples = [];
        this.scale = 1.0;
        this.enabled = false;
        this.minScale = 0.6;
        this.maxScale = 1.0;
        this.step = 0.1;
        this._goodStreak = 0;
        this._cooldownUntil = 0;
    }

    /** Manual quality choice wins — turn auto off so the two don't fight. */
    setEnabled(v) {
        this.enabled = v;
        this.samples.length = 0;
        this._goodStreak = 0;
    }

    reset() {
        this.samples.length = 0;
        this._goodStreak = 0;
        this.scale = 1.0;
    }

    /** Call once per frame with the frame's duration in milliseconds. */
    sample(dtMs) {
        if (!this.enabled) return;
        // Ignore obvious outliers: tab switches, GC pauses, terrain rebuild hitches
        if (dtMs > 500 || dtMs <= 0) return;

        this.samples.push(dtMs);
        if (this.samples.length < this.windowSize) return;

        const now = performance.now();
        if (now < this._cooldownUntil) { this.samples.length = 0; return; }

        // Median, not mean — one 200ms hitch shouldn't drop the whole resolution
        const sorted = this.samples.slice().sort((a, b) => a - b);
        const median = sorted[sorted.length >> 1];
        this.samples.length = 0;

        let next = this.scale;
        if (median > this.targetMs * 1.18) {
            next = Math.max(this.minScale, this.scale - this.step);
            this._goodStreak = 0;
        } else if (median < this.targetMs * 0.62) {
            this._goodStreak++;
            if (this._goodStreak >= 3) {          // ~3s of comfortable headroom
                next = Math.min(this.maxScale, this.scale + this.step);
                this._goodStreak = 0;
            }
        } else {
            this._goodStreak = 0;
        }

        if (Math.abs(next - this.scale) > 0.001) {
            this.scale = next;
            this._cooldownUntil = now + 1500;    // let the new size settle before judging it
            if (this.onScaleChange) this.onScaleChange(this.scale);
        }
    }
}

export function describeTier() {
    return `${deviceTier} · budget ${(pixelBudget / 1e6).toFixed(1)}Mpx · ` +
           `rays ${tierSettings.godRaySamples} samples · sky ${tierSettings.skyOctaves} oct · ` +
           `trees x${tierSettings.treeDensity}`;
}
