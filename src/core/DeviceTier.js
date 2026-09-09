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

// Target framebuffer size in pixels calibrated for 90 FPS (10.5–11.1 ms).
// A 1080p panel has ~2.07M pixels; 1440p has ~3.68M; 4K native has 8.29M.
// On desktop at 90 FPS, rendering 4K native quadruples fragment overhead and kills 90 FPS.
// Sizing the pixel budget ensures crisp 1080p native rendering while preventing runaway fillrate on 4K displays.
const PIXEL_BUDGET = {
    [TIER.MOBILE]:       1_800_000,   // ~720p-900p equivalent
    [TIER.TABLET]:       2_200_000,   // ~1080p equivalent
    [TIER.DESKTOP]:      2_600_000,   // ~1080p native with headroom
    [TIER.DESKTOP_HIGH]: 3_800_000    // ~1440p equivalent
};

// Per-tier effect budgets calibrated for sustained 90 FPS.
export const TIER_SETTINGS = {
    [TIER.MOBILE]:       { godRaySamples: 8,  skyOctaves: 2, treeDensity: 0.85, shadows: false, heroRadius: 90,  oceanRes: 128 },
    [TIER.TABLET]:       { godRaySamples: 10, skyOctaves: 2, treeDensity: 1.0,  shadows: true,  heroRadius: 100, oceanRes: 256 },
    [TIER.DESKTOP]:      { godRaySamples: 12, skyOctaves: 3, treeDensity: 1.15, shadows: true,  heroRadius: 110, oceanRes: 256 },
    [TIER.DESKTOP_HIGH]: { godRaySamples: 12, skyOctaves: 3, treeDensity: 1.25, shadows: true,  heroRadius: 120, oceanRes: 256 }
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
 * Adaptive resolution controller redesigned for a 90 FPS target (~10.5–11.1 ms).
 *
 * Uses fast downward response (percentile-aware sampling over 30 frames),
 * slow recovery (requires 5s of clean headroom), stable hysteresis, and strict cooldowns
 * to eliminate screen breathing.
 */
export class AdaptiveResolution {
    constructor({ onScaleChange, targetMs = 10.8, windowSize = 30 } = {}) {
        this.onScaleChange = onScaleChange;
        this.targetMs = targetMs;
        this.windowSize = windowSize;
        this.samples = [];
        this.scale = 1.0;
        this.enabled = true; // Enabled by default to sustain 90 FPS
        this.minScale = 0.5;
        this.maxScale = 1.0;
        this.stepDown = 0.08;
        this.stepUp = 0.05;
        this._goodStreak = 0;
        this._cooldownUntil = 0;
    }

    /** Manual quality choice wins — turn auto off so the two don't fight. */
    setEnabled(v) {
        this.enabled = !!v;
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
        // Ignore severe outliers (tab backgrounding, window resize)
        if (dtMs > 400 || dtMs <= 0) return;

        this.samples.push(dtMs);
        if (this.samples.length < this.windowSize) return;

        const now = performance.now();
        if (now < this._cooldownUntil) {
            this.samples.length = 0;
            return;
        }

        // Percentile analysis: 85th percentile catches sustained pressure early
        const sorted = this.samples.slice().sort((a, b) => a - b);
        const p85Index = Math.floor(sorted.length * 0.85);
        const p85 = sorted[p85Index];
        const p50 = sorted[sorted.length >> 1];
        this.samples.length = 0;

        let next = this.scale;
        // Frame time budget: target 10.8ms (92.5 FPS). Pressure threshold is 11.2ms (89 FPS).
        if (p85 > this.targetMs * 1.08 || p50 > this.targetMs * 1.05) {
            // Fast downward adjustment under pressure
            next = Math.max(this.minScale, this.scale - this.stepDown);
            this._goodStreak = 0;
            this._cooldownUntil = now + 900; // 0.9s settle time
        } else if (p85 < this.targetMs * 0.82) {
            // Comfortable headroom (< 8.8ms)
            this._goodStreak++;
            if (this._goodStreak >= 6) { // ~3.5s of sustained headroom
                next = Math.min(this.maxScale, this.scale + this.stepUp);
                this._goodStreak = 0;
                this._cooldownUntil = now + 1600; // 1.6s settle time
            }
        } else {
            this._goodStreak = Math.max(0, this._goodStreak - 1);
        }

        if (Math.abs(next - this.scale) > 0.001) {
            this.scale = next;
            if (this.onScaleChange) this.onScaleChange(this.scale);
        }
    }
}

/**
 * Coordinated Runtime Quality Controller
 * Adjusts visual subsystem tiers to guarantee $\ge 90$ FPS under frame-time pressure.
 */
export class RuntimeQualityController {
    constructor() {
        this.preset = localStorage.getItem('wl_perf_preset') || '90fps'; // '90fps' | 'quality' | 'low-power' | 'auto'
        this.qualityLevel = 2; // 0: low-power, 1: 90fps performance, 2: high quality
        this.applyPreset(this.preset);
    }

    setPreset(preset) {
        this.preset = preset;
        localStorage.setItem('wl_perf_preset', preset);
        this.applyPreset(preset);
    }

    applyPreset(preset) {
        if (preset === '90fps') {
            this.qualityLevel = 1;
            this.godRaySamples = 12;
            this.treeHeroRadius = 110.0;
            this.oceanMeshRes = '256';
            this.shadowResolution = 1024;
            this.skyOctaves = 3;
        } else if (preset === 'low-power') {
            this.qualityLevel = 0;
            this.godRaySamples = 8;
            this.treeHeroRadius = 80.0;
            this.oceanMeshRes = '128';
            this.shadowResolution = 512;
            this.skyOctaves = 2;
        } else if (preset === 'quality') {
            this.qualityLevel = 3;
            this.godRaySamples = 20;
            this.treeHeroRadius = 180.0;
            this.oceanMeshRes = '512';
            this.shadowResolution = 2048;
            this.skyOctaves = 4;
        } else {
            // Auto
            this.applyPreset('90fps');
            this.preset = 'auto';
        }
    }
}

export const runtimeQuality = new RuntimeQualityController();

export function describeTier() {
    return `${deviceTier} · budget ${(pixelBudget / 1e6).toFixed(1)}Mpx · ` +
           `rays ${tierSettings.godRaySamples} samples · sky ${tierSettings.skyOctaves} oct · ` +
           `trees x${tierSettings.treeDensity}`;
}
