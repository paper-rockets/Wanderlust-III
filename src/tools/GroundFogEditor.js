// GroundFogEditor.js - Per-Biome Linked Valley Fog, Cloud Inversion & Atmospheric Fog Editor
// Clean plain-text UI with full per-biome persistence, live lerping, and presets.

import { DEFAULT_BIOME_FOG_CONFIGS, cleanBiomeName } from '../config/FogConfig.js';

export { DEFAULT_BIOME_FOG_CONFIGS, cleanBiomeName };
export const BIOME_NAMES = Object.keys(DEFAULT_BIOME_FOG_CONFIGS);

export class GroundFogEditor {
    constructor() {
        this.isMinimized = false;
        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.el = null;
        this.visible = false;
        this.followPlayerBiome = true;
        this.selectedBiome = 'Misty Mountains';

        // Load saved configs or clone defaults
        this.biomeConfigs = this.loadSavedConfigs();

        // Active runtime lerped state
        this.runtimeState = { ...this.biomeConfigs[this.selectedBiome] };

        // Presets library (aligned with reference images and diverse terrains)
        this.stylePresets = {
            'Alpine Sea of Clouds': {
                intensity: 1.15, opacity: 0.70, heightOffset: 12, inversionCeiling: 160, ceilingFalloff: 45,
                layerSpacing: 24, layerCount: 5, billowScale: 0.0018, detailScale: 0.0065, driftSpeed: 0.9, turbulence: 1.0,
                mieIntensity: 1.40, sunGlow: 1.20, nearFade: 10, farFade: 2400,
                distNear: 140, distFar: 2600, distDensity: 0.90, distAltScale: 0.8,
                color: '#ffffff', colorDusk: '#fed7aa', colorNight: '#0d1527',
                sunTint: '#fffbeb', sunTintDusk: '#fdba74', sunTintNight: '#94b4db'
            },
            'Moody Conifer Mist': {
                intensity: 1.25, opacity: 0.75, heightOffset: 8, inversionCeiling: 130, ceilingFalloff: 35,
                layerSpacing: 18, layerCount: 5, billowScale: 0.0022, detailScale: 0.0080, driftSpeed: 0.7, turbulence: 1.0,
                mieIntensity: 1.35, sunGlow: 1.15, nearFade: 8, farFade: 2000,
                distNear: 120, distFar: 2200, distDensity: 1.00, distAltScale: 0.7,
                color: '#f1f5f9', colorDusk: '#cbd5e1', colorNight: '#0d1527',
                sunTint: '#ffffff', sunTintDusk: '#e2e8f0', sunTintNight: '#64748b'
            },
            'Morning Valley Blanket': {
                intensity: 0.95, opacity: 0.65, heightOffset: 2, inversionCeiling: 100, ceilingFalloff: 35,
                layerSpacing: 18, layerCount: 4, billowScale: 0.0020, detailScale: 0.0070, driftSpeed: 0.8, turbulence: 0.8,
                mieIntensity: 1.30, sunGlow: 1.15, nearFade: 12, farFade: 2200,
                distNear: 180, distFar: 3000, distDensity: 0.75, distAltScale: 1.1,
                color: '#ffffff', colorDusk: '#fbcfe8', colorNight: '#101a2e',
                sunTint: '#fffbeb', sunTintDusk: '#f472b6', sunTintNight: '#9cb8db'
            },
            'Deep Canopy Steam': {
                intensity: 1.10, opacity: 0.72, heightOffset: -2, inversionCeiling: 75, ceilingFalloff: 30,
                layerSpacing: 14, layerCount: 4, billowScale: 0.0024, detailScale: 0.0085, driftSpeed: 0.6, turbulence: 0.9,
                mieIntensity: 1.35, sunGlow: 1.20, nearFade: 10, farFade: 1800,
                distNear: 140, distFar: 2400, distDensity: 0.90, distAltScale: 0.9,
                color: '#ffffff', colorDusk: '#fef08a', colorNight: '#0a221a',
                sunTint: '#f0fdf4', sunTintDusk: '#facc15', sunTintNight: '#6ee7b7'
            },
            'Crystal Twilight Haze': {
                intensity: 1.00, opacity: 0.68, heightOffset: 6, inversionCeiling: 120, ceilingFalloff: 40,
                layerSpacing: 22, layerCount: 4, billowScale: 0.0022, detailScale: 0.0080, driftSpeed: 1.2, turbulence: 1.4,
                mieIntensity: 1.30, sunGlow: 1.15, nearFade: 14, farFade: 2200,
                distNear: 170, distFar: 2800, distDensity: 0.80, distAltScale: 1.2,
                color: '#f8fafc', colorDusk: '#e9d5ff', colorNight: '#12122b',
                sunTint: '#e0e7ff', sunTintDusk: '#c084fc', sunTintNight: '#9c9edb'
            },
            'Arctic Ice Blizzard': {
                intensity: 1.20, opacity: 0.75, heightOffset: 10, inversionCeiling: 140, ceilingFalloff: 40,
                layerSpacing: 20, layerCount: 4, billowScale: 0.0020, detailScale: 0.0075, driftSpeed: 1.4, turbulence: 1.3,
                mieIntensity: 1.35, sunGlow: 1.20, nearFade: 8, farFade: 2600,
                distNear: 150, distFar: 2800, distDensity: 0.90, distAltScale: 0.9,
                color: '#ffffff', colorDusk: '#e0f2fe', colorNight: '#0a1d2e',
                sunTint: '#ffffff', sunTintDusk: '#bae6fd', sunTintNight: '#bae6fd'
            },
            'Desert Heat Mirage': {
                intensity: 0.45, opacity: 0.45, heightOffset: -4, inversionCeiling: 60, ceilingFalloff: 30,
                layerSpacing: 22, layerCount: 3, billowScale: 0.0026, detailScale: 0.0090, driftSpeed: 1.6, turbulence: 1.5,
                mieIntensity: 1.10, sunGlow: 1.05, nearFade: 20, farFade: 2000,
                distNear: 240, distFar: 3600, distDensity: 0.50, distAltScale: 1.8,
                color: '#fffbeb', colorDusk: '#fb923c', colorNight: '#261204',
                sunTint: '#fef08a', sunTintDusk: '#f97316', sunTintNight: '#fbbf24'
            },
            'Coastal Marine Layer': {
                intensity: 0.85, opacity: 0.65, heightOffset: 2, inversionCeiling: 60, ceilingFalloff: 25,
                layerSpacing: 16, layerCount: 4, billowScale: 0.0018, detailScale: 0.0065, driftSpeed: 0.9, turbulence: 0.7,
                mieIntensity: 1.25, sunGlow: 1.15, nearFade: 14, farFade: 2200,
                distNear: 200, distFar: 3200, distDensity: 0.70, distAltScale: 1.2,
                color: '#ffffff', colorDusk: '#fed7aa', colorNight: '#0d1626',
                sunTint: '#fffbeb', sunTintDusk: '#fdba74', sunTintNight: '#93c5fd'
            },
            'Dense Low Stratus': {
                intensity: 1.40, opacity: 0.80, heightOffset: 0, inversionCeiling: 80, ceilingFalloff: 25,
                layerSpacing: 14, layerCount: 5, billowScale: 0.0022, detailScale: 0.0075, driftSpeed: 0.5, turbulence: 0.7,
                mieIntensity: 1.35, sunGlow: 1.20, nearFade: 8, farFade: 2000,
                distNear: 120, distFar: 2200, distDensity: 1.10, distAltScale: 0.8,
                color: '#ffffff', colorDusk: '#fed7aa', colorNight: '#0d1626',
                sunTint: '#fffbeb', sunTintDusk: '#fb7185', sunTintNight: '#9cb8db'
            },
            'Ethereal Whispers': {
                intensity: 0.65, opacity: 0.50, heightOffset: 12, inversionCeiling: 160, ceilingFalloff: 45,
                layerSpacing: 26, layerCount: 3, billowScale: 0.0014, detailScale: 0.0050, driftSpeed: 1.2, turbulence: 1.2,
                mieIntensity: 1.20, sunGlow: 1.10, nearFade: 18, farFade: 2800,
                distNear: 220, distFar: 3400, distDensity: 0.55, distAltScale: 1.5,
                color: '#f8fafc', colorDusk: '#f1f5f9', colorNight: '#0d1527',
                sunTint: '#fffbeb', sunTintDusk: '#fed7aa', sunTintNight: '#94b4db'
            },
            'Clear / Zero Fog': {
                intensity: 0.00, opacity: 0.00, heightOffset: -50, inversionCeiling: 20, ceilingFalloff: 10,
                layerSpacing: 10, layerCount: 1, billowScale: 0.0020, detailScale: 0.0065, driftSpeed: 0.0, turbulence: 0.0,
                mieIntensity: 0.0, sunGlow: 0.0, nearFade: 100, farFade: 5000,
                distNear: 500, distFar: 8000, distDensity: 0.10, distAltScale: 0.0,
                color: '#ffffff', colorDusk: '#ffffff', colorNight: '#000000',
                sunTint: '#ffffff', sunTintDusk: '#ffffff', sunTintNight: '#ffffff'
            }
        };

        this.build();
    }

    loadSavedConfigs() {
        try {
            const raw = localStorage.getItem('wl_biome_fog_configs_v3');
            if (raw) {
                const parsed = JSON.parse(raw);
                const merged = {};
                for (const b of BIOME_NAMES) {
                    merged[b] = Object.assign({}, DEFAULT_BIOME_FOG_CONFIGS[b], parsed[b] || {});
                }
                return merged;
            }
        } catch (e) {
            console.warn('[FogEditor] Error reading saved configs', e);
        }
        const initial = {};
        for (const b of BIOME_NAMES) {
            initial[b] = { ...DEFAULT_BIOME_FOG_CONFIGS[b] };
        }
        return initial;
    }

    saveConfigsToStorage() {
        try {
            localStorage.setItem('wl_biome_fog_configs_v3', JSON.stringify(this.biomeConfigs));
        } catch (e) {
            console.warn('[FogEditor] Error saving configs', e);
        }
    }

    build() {
        const el = document.createElement('div');
        el.id = 'ground-fog-editor';
        el.innerHTML = `
<style>
#ground-fog-editor {
    position: fixed; right: 20px; top: 80px; width: 340px; z-index: 120;
    background: rgba(12, 14, 20, 0.92); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.14); border-radius: 12px;
    color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 11px; box-shadow: 0 16px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08);
    display: none; user-select: none; overflow: hidden;
}
#ground-fog-editor * { box-sizing: border-box; }
#gfe-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px; cursor: grab; border-bottom: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.04);
}
#gfe-header:active { cursor: grabbing; }
#gfe-title { font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #93c5fd; }
#gfe-header-btns { display: flex; gap: 6px; }
#gfe-header-btns button {
    background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; font-size: 11px;
    width: 24px; height: 24px; border-radius: 5px; cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
}
#gfe-header-btns button:hover { background: rgba(255,255,255,0.2); color: #fff; }
#gfe-body { padding: 12px 14px 14px; max-height: 82vh; overflow-y: auto; }
#gfe-body.minimized { display: none; }

.gfe-biome-bar {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px; padding: 8px 10px; margin-bottom: 10px;
}
.gfe-biome-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.gfe-biome-select {
    flex: 1; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px;
    color: #38bdf8; font-size: 11px; font-weight: 600; padding: 5px 8px; cursor: pointer; outline: none;
}
.gfe-follow-row { display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #94a3b8; }

.gfe-section { margin-bottom: 10px; }
.gfe-section-title {
    font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8;
    margin-bottom: 6px; font-weight: 700; border-left: 2px solid #38bdf8; padding-left: 6px;
}
.gfe-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; gap: 8px; }
.gfe-row label { flex: 0 0 106px; white-space: nowrap; color: #cbd5e1; font-size: 11px; }
.gfe-row input[type="range"] { flex: 1; height: 4px; accent-color: #38bdf8; cursor: pointer; }
.gfe-row .gfe-val { width: 52px; text-align: right; font-size: 10px; color: #94a3b8; font-variant-numeric: tabular-nums; font-weight: 600; }

.gfe-toggle-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.gfe-toggle {
    position: relative; width: 34px; height: 18px; border-radius: 9px; cursor: pointer;
    background: rgba(255,255,255,0.15); transition: background 0.2s;
}
.gfe-toggle.on { background: #0284c7; box-shadow: 0 0 10px rgba(2,132,199,0.5); }
.gfe-toggle-knob {
    position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%;
    background: #fff; transition: transform 0.2s;
}
.gfe-toggle.on .gfe-toggle-knob { transform: translateX(16px); }

.gfe-color-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-bottom: 6px; }
.gfe-color-item { background: rgba(255,255,255,0.04); padding: 5px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); text-align: center; }
.gfe-color-item span { display: block; font-size: 9px; color: #94a3b8; margin-bottom: 3px; text-transform: uppercase; font-weight: 600; }
.gfe-color-input {
    width: 100%; height: 20px; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px;
    cursor: pointer; background: transparent; padding: 0;
}
.gfe-color-input::-webkit-color-swatch-wrapper { padding: 1px; }
.gfe-color-input::-webkit-color-swatch { border-radius: 3px; border: none; }

.gfe-presets { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
.gfe-preset-btn {
    padding: 3px 7px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04); color: #cbd5e1; font-size: 10px; cursor: pointer;
    transition: all 0.15s; white-space: nowrap;
}
.gfe-preset-btn:hover { background: rgba(56,189,248,0.2); border-color: rgba(56,189,248,0.4); color: #fff; }

.gfe-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 10px; }
.gfe-actions button {
    padding: 6px 0; border-radius: 6px; border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.06); color: #cbd5e1; font-size: 10px; cursor: pointer;
    transition: all 0.15s; font-weight: 600; text-align: center;
}
.gfe-actions button:hover { background: rgba(56,189,248,0.25); color: #fff; border-color: rgba(56,189,248,0.5); }
.gfe-actions button.btn-danger { color: #f87171; border-color: rgba(248,113,113,0.2); }
.gfe-actions button.btn-danger:hover { background: rgba(248,113,113,0.2); color: #fff; }

.gfe-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 8px 0; }
</style>

<div id="gfe-header">
    <div id="gfe-title">Valley Fog & Inversion Editor</div>
    <div id="gfe-header-btns">
        <button id="gfe-minimize" title="Minimize">_</button>
        <button id="gfe-close" title="Close">X</button>
    </div>
</div>
<div id="gfe-body">
    <div class="gfe-biome-bar">
        <div class="gfe-biome-row">
            <label style="font-weight:600; color:#e2e8f0;">Biome:</label>
            <select class="gfe-biome-select" id="gfe-biome-select"></select>
        </div>
        <div class="gfe-follow-row">
            <span>Auto-Track Player Biome</span>
            <div class="gfe-toggle on" id="gfe-follow-toggle"><div class="gfe-toggle-knob"></div></div>
        </div>
    </div>

    <div class="gfe-section">
        <div class="gfe-toggle-row">
            <span style="font-weight:600; font-size:11px;">Enable Valley Fog in Biome</span>
            <div class="gfe-toggle on" id="gfe-enable"><div class="gfe-toggle-knob"></div></div>
        </div>
    </div>

    <div class="gfe-section">
        <div class="gfe-section-title">Cloud Inversion Envelope</div>
        <div class="gfe-row" title="Altitude ceiling where sea of clouds terminates"><label>Inversion Ceiling</label><input type="range" id="gfe-inversion-ceil" min="20" max="400" step="5" value="175"><span class="gfe-val" id="gfe-inversion-ceil-val">175m</span></div>
        <div class="gfe-row" title="Softness of the cloud top boundary"><label>Ceiling Softness</label><input type="range" id="gfe-ceil-falloff" min="5" max="150" step="5" value="45"><span class="gfe-val" id="gfe-ceil-falloff-val">45m</span></div>
        <div class="gfe-row" title="Base altitude offset above valley floor"><label>Floor Height Y</label><input type="range" id="gfe-height" min="-80" max="100" step="1" value="20"><span class="gfe-val" id="gfe-height-val">20m</span></div>
        <div class="gfe-row" title="Number of volumetric slabs stacked vertically"><label>Volumetric Slabs</label><input type="range" id="gfe-layer-count" min="1" max="8" step="1" value="5"><span class="gfe-val" id="gfe-layer-count-val">5 slabs</span></div>
        <div class="gfe-row" title="Vertical gap between volumetric slabs"><label>Layer Spacing</label><input type="range" id="gfe-spacing" min="4" max="80" step="1" value="26"><span class="gfe-val" id="gfe-spacing-val">26m</span></div>
    </div>

    <div class="gfe-divider"></div>

    <div class="gfe-section">
        <div class="gfe-section-title">Cloud Billows & Dynamics</div>
        <div class="gfe-row"><label>Intensity</label><input type="range" id="gfe-intensity" min="0.05" max="4.00" step="0.05" value="1.85"><span class="gfe-val" id="gfe-intensity-val">1.85</span></div>
        <div class="gfe-row"><label>Opacity</label><input type="range" id="gfe-opacity" min="0.00" max="1.00" step="0.02" value="0.95"><span class="gfe-val" id="gfe-opacity-val">0.95</span></div>
        <div class="gfe-row" title="Scale of the macro rolling cloud billows"><label>Macro Billow Scale</label><input type="range" id="gfe-billow-scale" min="0.0005" max="0.0080" step="0.0001" value="0.0018"><span class="gfe-val" id="gfe-billow-scale-val">0.0018</span></div>
        <div class="gfe-row" title="Fine wispy detail noise scale"><label>Micro Detail Scale</label><input type="range" id="gfe-detail-scale" min="0.0010" max="0.0200" step="0.0005" value="0.0065"><span class="gfe-val" id="gfe-detail-scale-val">0.0065</span></div>
        <div class="gfe-row" title="Turbulence and wispy drift rate"><label>Turbulence</label><input type="range" id="gfe-turbulence" min="0.1" max="4.0" step="0.1" value="1.5"><span class="gfe-val" id="gfe-turbulence-val">1.5x</span></div>
        <div class="gfe-row" title="Wind drift speed"><label>Drift Speed</label><input type="range" id="gfe-drift" min="0.0" max="6.0" step="0.1" value="1.2"><span class="gfe-val" id="gfe-drift-val">1.2x</span></div>
    </div>

    <div class="gfe-divider"></div>

    <div class="gfe-section">
        <div class="gfe-section-title">Camera & Edge Fading</div>
        <div class="gfe-row" title="Soft clip distance near player/camera"><label>Near Camera Fade</label><input type="range" id="gfe-near-fade" min="0" max="50" step="1" value="8"><span class="gfe-val" id="gfe-near-fade-val">8m</span></div>
        <div class="gfe-row" title="Soft fade distance at horizon perimeter"><label>Far Horizon Fade</label><input type="range" id="gfe-far-fade" min="300" max="4000" step="50" value="1800"><span class="gfe-val" id="gfe-far-fade-val">1800m</span></div>
    </div>

    <div class="gfe-divider"></div>

    <div class="gfe-section">
        <div class="gfe-section-title">Sun Scattering & Golden Rim</div>
        <div class="gfe-row" title="Mie forward scattering glow when facing the sun"><label>Mie Forward Glow</label><input type="range" id="gfe-mie-intensity" min="0.0" max="4.0" step="0.1" value="1.7"><span class="gfe-val" id="gfe-mie-intensity-val">1.7x</span></div>
        <div class="gfe-row" title="Golden-hour rim lighting highlight"><label>Sun Rim Highlight</label><input type="range" id="gfe-sun-glow" min="0.0" max="3.0" step="0.1" value="1.4"><span class="gfe-val" id="gfe-sun-glow-val">1.4x</span></div>
    </div>

    <div class="gfe-section">
        <div class="gfe-section-title">Ambient Colors (Day / Dusk / Night)</div>
        <div class="gfe-color-grid">
            <div class="gfe-color-item">
                <span>Day</span>
                <input type="color" class="gfe-color-input" id="gfe-color-day" value="#e2e8f0">
            </div>
            <div class="gfe-color-item">
                <span>Dusk</span>
                <input type="color" class="gfe-color-input" id="gfe-color-dusk" value="#cbd5e1">
            </div>
            <div class="gfe-color-item">
                <span>Night</span>
                <input type="color" class="gfe-color-input" id="gfe-color-night" value="#0f172a">
            </div>
        </div>
        <div class="gfe-color-grid">
            <div class="gfe-color-item">
                <span>Sun Tint (Day)</span>
                <input type="color" class="gfe-color-input" id="gfe-sun-tint-day" value="#fff1d6">
            </div>
            <div class="gfe-color-item">
                <span>Sun Tint (Dusk)</span>
                <input type="color" class="gfe-color-input" id="gfe-sun-tint-dusk" value="#fed7aa">
            </div>
            <div class="gfe-color-item">
                <span>Moon Tint</span>
                <input type="color" class="gfe-color-input" id="gfe-sun-tint-night" value="#38bdf8">
            </div>
        </div>
    </div>

    <div class="gfe-divider"></div>

    <div class="gfe-section">
        <div class="gfe-section-title">Distance Atmospheric Fog</div>
        <div class="gfe-row" title="Distance from player where fog starts"><label>Start Dist (Clear)</label><input type="range" id="gfe-dist-near" min="0" max="1500" step="10" value="35"><span class="gfe-val" id="gfe-dist-near-val">35m</span></div>
        <div class="gfe-row" title="Distance where fog reaches full density"><label>End Dist (Max)</label><input type="range" id="gfe-dist-far" min="200" max="8000" step="50" value="1100"><span class="gfe-val" id="gfe-dist-far-val">1100m</span></div>
        <div class="gfe-row" title="Distance fog density factor"><label>Fog Density</label><input type="range" id="gfe-dist-density" min="0.10" max="4.00" step="0.05" value="1.75"><span class="gfe-val" id="gfe-dist-density-val">1.75x</span></div>
        <div class="gfe-row" title="Altitude expansion scale"><label>Altitude Scale</label><input type="range" id="gfe-dist-alt-scale" min="0.0" max="4.0" step="0.1" value="0.8"><span class="gfe-val" id="gfe-dist-alt-scale-val">0.8x</span></div>
    </div>

    <div class="gfe-divider"></div>

    <div class="gfe-section">
        <div class="gfe-section-title">Atmospheric Presets</div>
        <div class="gfe-presets" id="gfe-presets"></div>
    </div>

    <div class="gfe-actions">
        <button id="gfe-reset-biome" class="btn-danger" title="Reset this biome to default">Reset Biome</button>
        <button id="gfe-reset-all" class="btn-danger" title="Reset all biomes to defaults">Reset All</button>
        <button id="gfe-copy-json" title="Copy all biome JSON to clipboard">Copy JSON</button>
        <button id="gfe-paste-json" title="Paste JSON configuration">Paste JSON</button>
        <button id="gfe-apply-all" title="Apply current settings to all biomes">Copy To All</button>
        <button id="gfe-save-all" title="Save all biome configs">Save All</button>
    </div>
</div>`;
        document.body.appendChild(el);
        this.el = el;

        this.populateBiomeDropdown();
        this.buildPresetButtons();
        this.bindEvents();
    }

    populateBiomeDropdown() {
        const select = document.getElementById('gfe-biome-select');
        select.innerHTML = '';
        BIOME_NAMES.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            select.appendChild(opt);
        });
        select.value = this.selectedBiome;
    }

    buildPresetButtons() {
        const container = document.getElementById('gfe-presets');
        container.innerHTML = '';
        Object.keys(this.stylePresets).forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'gfe-preset-btn';
            btn.textContent = name;
            btn.addEventListener('click', () => this.applyStylePreset(name));
            container.appendChild(btn);
        });
    }

    getCurrentConfig() {
        if (!this.biomeConfigs[this.selectedBiome]) {
            this.biomeConfigs[this.selectedBiome] = { ...DEFAULT_BIOME_FOG_CONFIGS['Misty Mountains'] };
        }
        return this.biomeConfigs[this.selectedBiome];
    }

    bindEvents() {
        const $ = (id) => document.getElementById(id);

        // Biome Selector change
        $('gfe-biome-select').addEventListener('change', (e) => {
            this.selectedBiome = e.target.value;
            this.syncUI();
            this.applyToScene(true);
        });

        // Auto-Track Toggle
        $('gfe-follow-toggle').addEventListener('click', () => {
            this.followPlayerBiome = !this.followPlayerBiome;
            $('gfe-follow-toggle').classList.toggle('on', this.followPlayerBiome);
        });

        // Enable Toggle
        $('gfe-enable').addEventListener('click', () => {
            const cfg = this.getCurrentConfig();
            cfg.enabled = !cfg.enabled;
            $('gfe-enable').classList.toggle('on', cfg.enabled);
            this.runtimeState.enabled = cfg.enabled;
            if (typeof window !== 'undefined' && window.params) {
                window.params.fogPlane = cfg.enabled;
            }
            this.saveConfigsToStorage();
            this.applyToScene(true);
        });

        // Sliders
        const sliders = [
            { id: 'gfe-intensity',       key: 'intensity',          valId: 'gfe-intensity-val',       fmt: v => parseFloat(v).toFixed(2) },
            { id: 'gfe-opacity',         key: 'opacity',            valId: 'gfe-opacity-val',         fmt: v => parseFloat(v).toFixed(2) },
            { id: 'gfe-inversion-ceil',  key: 'inversionCeiling',   valId: 'gfe-inversion-ceil-val',  fmt: v => `${v}m` },
            { id: 'gfe-ceil-falloff',    key: 'ceilingFalloff',     valId: 'gfe-ceil-falloff-val',    fmt: v => `${v}m` },
            { id: 'gfe-height',          key: 'heightOffset',       valId: 'gfe-height-val',          fmt: v => `${v}m` },
            { id: 'gfe-layer-count',     key: 'layerCount',         valId: 'gfe-layer-count-val',     fmt: v => `${Math.round(v)} slabs` },
            { id: 'gfe-spacing',         key: 'layerSpacing',       valId: 'gfe-spacing-val',         fmt: v => `${v}m` },
            { id: 'gfe-billow-scale',    key: 'billowScale',        valId: 'gfe-billow-scale-val',    fmt: v => parseFloat(v).toFixed(4) },
            { id: 'gfe-detail-scale',    key: 'detailScale',        valId: 'gfe-detail-scale-val',    fmt: v => parseFloat(v).toFixed(4) },
            { id: 'gfe-drift',           key: 'driftSpeed',         valId: 'gfe-drift-val',           fmt: v => `${parseFloat(v).toFixed(1)}x` },
            { id: 'gfe-turbulence',      key: 'turbulence',         valId: 'gfe-turbulence-val',      fmt: v => `${parseFloat(v).toFixed(1)}x` },
            { id: 'gfe-near-fade',       key: 'nearFade',           valId: 'gfe-near-fade-val',       fmt: v => `${v}m` },
            { id: 'gfe-far-fade',        key: 'farFade',            valId: 'gfe-far-fade-val',        fmt: v => `${v}m` },
            { id: 'gfe-mie-intensity',   key: 'mieIntensity',       valId: 'gfe-mie-intensity-val',   fmt: v => `${parseFloat(v).toFixed(1)}x` },
            { id: 'gfe-sun-glow',        key: 'sunGlow',            valId: 'gfe-sun-glow-val',        fmt: v => `${parseFloat(v).toFixed(1)}x` },
            { id: 'gfe-dist-near',       key: 'distNear',           valId: 'gfe-dist-near-val',       fmt: v => `${v}m` },
            { id: 'gfe-dist-far',        key: 'distFar',            valId: 'gfe-dist-far-val',        fmt: v => `${v}m` },
            { id: 'gfe-dist-density',    key: 'distDensity',        valId: 'gfe-dist-density-val',    fmt: v => `${parseFloat(v).toFixed(2)}x` },
            { id: 'gfe-dist-alt-scale',  key: 'distAltScale',       valId: 'gfe-dist-alt-scale-val',  fmt: v => `${parseFloat(v).toFixed(1)}x` },
        ];

        sliders.forEach(s => {
            const input = $(s.id);
            const valEl = $(s.valId);
            if (!input || !valEl) return;
            input.addEventListener('input', () => {
                const v = parseFloat(input.value);
                const cfg = this.getCurrentConfig();
                cfg[s.key] = v;
                valEl.textContent = s.fmt(input.value);
                this.saveConfigsToStorage();
                this.applyToScene(false);
            });
        });

        // Colors
        $('gfe-color-day').addEventListener('input', (e) => {
            this.getCurrentConfig().color = e.target.value;
            this.saveConfigsToStorage();
            this.applyToScene(false);
        });
        $('gfe-color-dusk').addEventListener('input', (e) => {
            this.getCurrentConfig().colorDusk = e.target.value;
            this.saveConfigsToStorage();
            this.applyToScene(false);
        });
        $('gfe-color-night').addEventListener('input', (e) => {
            this.getCurrentConfig().colorNight = e.target.value;
            this.saveConfigsToStorage();
            this.applyToScene(false);
        });
        $('gfe-sun-tint-day').addEventListener('input', (e) => {
            this.getCurrentConfig().sunTint = e.target.value;
            this.saveConfigsToStorage();
            this.applyToScene(false);
        });
        $('gfe-sun-tint-dusk').addEventListener('input', (e) => {
            this.getCurrentConfig().sunTintDusk = e.target.value;
            this.saveConfigsToStorage();
            this.applyToScene(false);
        });
        $('gfe-sun-tint-night').addEventListener('input', (e) => {
            this.getCurrentConfig().sunTintNight = e.target.value;
            this.saveConfigsToStorage();
            this.applyToScene(false);
        });

        // Actions
        $('gfe-reset-biome').addEventListener('click', () => {
            this.biomeConfigs[this.selectedBiome] = { ...DEFAULT_BIOME_FOG_CONFIGS[this.selectedBiome] };
            this.saveConfigsToStorage();
            this.syncUI();
            this.applyToScene(true);
            const btn = $('gfe-reset-biome');
            btn.textContent = 'Reset Done';
            setTimeout(() => { btn.textContent = 'Reset Biome'; }, 1500);
        });

        if ($('gfe-reset-all')) {
            $('gfe-reset-all').addEventListener('click', () => {
                for (const b of BIOME_NAMES) {
                    this.biomeConfigs[b] = { ...DEFAULT_BIOME_FOG_CONFIGS[b] };
                }
                this.saveConfigsToStorage();
                this.syncUI();
                this.applyToScene(true);
                const btn = $('gfe-reset-all');
                btn.textContent = 'All Reset';
                setTimeout(() => { btn.textContent = 'Reset All'; }, 1500);
            });
        }

        $('gfe-save-all').addEventListener('click', () => {
            this.saveConfigsToStorage();
            const btn = $('gfe-save-all');
            btn.textContent = 'Saved';
            setTimeout(() => { btn.textContent = 'Save All'; }, 1500);
        });

        $('gfe-copy-json').addEventListener('click', () => {
            const json = JSON.stringify(this.biomeConfigs, null, 2);
            navigator.clipboard.writeText(json).then(() => {
                const btn = $('gfe-copy-json');
                btn.textContent = 'Copied';
                setTimeout(() => { btn.textContent = 'Copy JSON'; }, 1500);
            });
        });

        if ($('gfe-paste-json')) {
            $('gfe-paste-json').addEventListener('click', () => {
                const raw = prompt('Paste Fog JSON configuration here:');
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        for (const b of BIOME_NAMES) {
                            if (parsed[b]) {
                                this.biomeConfigs[b] = Object.assign({}, DEFAULT_BIOME_FOG_CONFIGS[b], parsed[b]);
                            }
                        }
                        this.saveConfigsToStorage();
                        this.syncUI();
                        this.applyToScene(true);
                        const btn = $('gfe-paste-json');
                        btn.textContent = 'Loaded';
                        setTimeout(() => { btn.textContent = 'Paste JSON'; }, 1500);
                    } catch (err) {
                        alert('Invalid JSON format: ' + err.message);
                    }
                }
            });
        }

        $('gfe-apply-all').addEventListener('click', () => {
            const cur = { ...this.getCurrentConfig() };
            BIOME_NAMES.forEach(b => {
                this.biomeConfigs[b] = { ...cur };
            });
            this.saveConfigsToStorage();
            const btn = $('gfe-apply-all');
            btn.textContent = 'Applied';
            setTimeout(() => { btn.textContent = 'Copy To All'; }, 1500);
        });

        // Header window controls
        $('gfe-close').addEventListener('click', () => this.toggle(false));
        $('gfe-minimize').addEventListener('click', () => {
            this.isMinimized = !this.isMinimized;
            $('gfe-body').classList.toggle('minimized', this.isMinimized);
            $('gfe-minimize').textContent = this.isMinimized ? '+' : '_';
        });

        // Window drag
        const header = $('gfe-header');
        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            this.isDragging = true;
            const rect = this.el.getBoundingClientRect();
            this.dragOffsetX = e.clientX - rect.left;
            this.dragOffsetY = e.clientY - rect.top;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            this.el.style.left = (e.clientX - this.dragOffsetX) + 'px';
            this.el.style.top = (e.clientY - this.dragOffsetY) + 'px';
            this.el.style.right = 'auto';
        });
        document.addEventListener('mouseup', () => { this.isDragging = false; });
    }

    applyStylePreset(name) {
        const p = this.stylePresets[name];
        if (!p) return;
        const cfg = this.getCurrentConfig();
        Object.assign(cfg, p);
        this.saveConfigsToStorage();
        this.syncUI();
        this.applyToScene(true);
    }

    syncUI() {
        const cfg = this.getCurrentConfig();
        const $ = (id) => document.getElementById(id);

        if ($('gfe-biome-select')) $('gfe-biome-select').value = this.selectedBiome;
        if ($('gfe-enable')) $('gfe-enable').classList.toggle('on', cfg.enabled !== false);
        if ($('gfe-intensity')) {
            $('gfe-intensity').value = cfg.intensity;
            $('gfe-intensity-val').textContent = (cfg.intensity !== undefined ? cfg.intensity : 1.0).toFixed(2);
        }
        if ($('gfe-opacity')) {
            $('gfe-opacity').value = cfg.opacity;
            $('gfe-opacity-val').textContent = (cfg.opacity !== undefined ? cfg.opacity : 0.8).toFixed(2);
        }
        if ($('gfe-inversion-ceil')) {
            $('gfe-inversion-ceil').value = cfg.inversionCeiling || 150;
            $('gfe-inversion-ceil-val').textContent = `${cfg.inversionCeiling || 150}m`;
        }
        if ($('gfe-ceil-falloff')) {
            $('gfe-ceil-falloff').value = cfg.ceilingFalloff || 40;
            $('gfe-ceil-falloff-val').textContent = `${cfg.ceilingFalloff || 40}m`;
        }
        if ($('gfe-height')) {
            $('gfe-height').value = cfg.heightOffset;
            $('gfe-height-val').textContent = `${cfg.heightOffset}m`;
        }
        if ($('gfe-layer-count')) {
            $('gfe-layer-count').value = cfg.layerCount || 5;
            $('gfe-layer-count-val').textContent = `${cfg.layerCount || 5} slabs`;
        }
        if ($('gfe-spacing')) {
            $('gfe-spacing').value = cfg.layerSpacing;
            $('gfe-spacing-val').textContent = `${cfg.layerSpacing}m`;
        }
        if ($('gfe-billow-scale')) {
            $('gfe-billow-scale').value = cfg.billowScale || 0.0020;
            $('gfe-billow-scale-val').textContent = (cfg.billowScale || 0.0020).toFixed(4);
        }
        if ($('gfe-detail-scale')) {
            $('gfe-detail-scale').value = cfg.detailScale || 0.0065;
            $('gfe-detail-scale-val').textContent = (cfg.detailScale || 0.0065).toFixed(4);
        }
        if ($('gfe-drift')) {
            $('gfe-drift').value = cfg.driftSpeed;
            $('gfe-drift-val').textContent = `${(cfg.driftSpeed || 1.0).toFixed(1)}x`;
        }
        if ($('gfe-turbulence')) {
            $('gfe-turbulence').value = cfg.turbulence;
            $('gfe-turbulence-val').textContent = `${(cfg.turbulence || 1.0).toFixed(1)}x`;
        }
        if ($('gfe-near-fade')) {
            $('gfe-near-fade').value = cfg.nearFade !== undefined ? cfg.nearFade : 8;
            $('gfe-near-fade-val').textContent = `${cfg.nearFade !== undefined ? cfg.nearFade : 8}m`;
        }
        if ($('gfe-far-fade')) {
            $('gfe-far-fade').value = cfg.farFade !== undefined ? cfg.farFade : 1800;
            $('gfe-far-fade-val').textContent = `${cfg.farFade !== undefined ? cfg.farFade : 1800}m`;
        }
        if ($('gfe-mie-intensity')) {
            $('gfe-mie-intensity').value = cfg.mieIntensity || 1.3;
            $('gfe-mie-intensity-val').textContent = `${(cfg.mieIntensity || 1.3).toFixed(1)}x`;
        }
        if ($('gfe-sun-glow')) {
            $('gfe-sun-glow').value = cfg.sunGlow || 1.2;
            $('gfe-sun-glow-val').textContent = `${(cfg.sunGlow || 1.2).toFixed(1)}x`;
        }

        if ($('gfe-dist-near')) {
            $('gfe-dist-near').value = cfg.distNear !== undefined ? cfg.distNear : 80;
            $('gfe-dist-near-val').textContent = `${cfg.distNear !== undefined ? cfg.distNear : 80}m`;
        }
        if ($('gfe-dist-far')) {
            $('gfe-dist-far').value = cfg.distFar !== undefined ? cfg.distFar : 1800;
            $('gfe-dist-far-val').textContent = `${cfg.distFar !== undefined ? cfg.distFar : 1800}m`;
        }
        if ($('gfe-dist-density')) {
            $('gfe-dist-density').value = cfg.distDensity !== undefined ? cfg.distDensity : 1.0;
            $('gfe-dist-density-val').textContent = `${(cfg.distDensity !== undefined ? cfg.distDensity : 1.0).toFixed(2)}x`;
        }
        if ($('gfe-dist-alt-scale')) {
            $('gfe-dist-alt-scale').value = cfg.distAltScale !== undefined ? cfg.distAltScale : 1.2;
            $('gfe-dist-alt-scale-val').textContent = `${(cfg.distAltScale !== undefined ? cfg.distAltScale : 1.2).toFixed(1)}x`;
        }
        if ($('gfe-color-day')) $('gfe-color-day').value = cfg.color || '#e2e8f0';
        if ($('gfe-color-dusk')) $('gfe-color-dusk').value = cfg.colorDusk || '#cbd5e1';
        if ($('gfe-color-night')) $('gfe-color-night').value = cfg.colorNight || '#0f172a';
        if ($('gfe-sun-tint-day')) $('gfe-sun-tint-day').value = cfg.sunTint || '#fff1d6';
        if ($('gfe-sun-tint-dusk')) $('gfe-sun-tint-dusk').value = cfg.sunTintDusk || '#fed7aa';
        if ($('gfe-sun-tint-night')) $('gfe-sun-tint-night').value = cfg.sunTintNight || '#38bdf8';
    }

    getCurrentBiomeFromScene() {
        if (typeof window.getBiomeAt === 'function' && window.playerGrp) {
            const raw = window.getBiomeAt(window.playerGrp.position.x, window.playerGrp.position.z);
            return cleanBiomeName(raw ? raw.name : '');
        }
        return 'Misty Mountains';
    }

    updateFrame(dt, timePhase = 0) {
        // TimePhase: 0 = Day, 1 = Dusk, 2 = Night
        const activeBiome = this.getCurrentBiomeFromScene();

        // If auto-tracking player biome, update dropdown if changed
        if (this.followPlayerBiome && activeBiome !== this.selectedBiome) {
            this.selectedBiome = activeBiome;
            if (this.visible) this.syncUI();
        }

        const targetCfg = this.biomeConfigs[activeBiome] || DEFAULT_BIOME_FOG_CONFIGS['Misty Mountains'];

        // Smoothly lerp runtime state toward target config
        const lerpFactor = Math.min(1.0, dt * 2.5);
        this.runtimeState.intensity += (targetCfg.intensity - this.runtimeState.intensity) * lerpFactor;
        this.runtimeState.opacity += (targetCfg.opacity - this.runtimeState.opacity) * lerpFactor;
        this.runtimeState.heightOffset += (targetCfg.heightOffset - this.runtimeState.heightOffset) * lerpFactor;
        this.runtimeState.inversionCeiling = (this.runtimeState.inversionCeiling || 150) + ((targetCfg.inversionCeiling || 150) - (this.runtimeState.inversionCeiling || 150)) * lerpFactor;
        this.runtimeState.ceilingFalloff = (this.runtimeState.ceilingFalloff || 40) + ((targetCfg.ceilingFalloff || 40) - (this.runtimeState.ceilingFalloff || 40)) * lerpFactor;
        this.runtimeState.layerSpacing += (targetCfg.layerSpacing - this.runtimeState.layerSpacing) * lerpFactor;
        const targetLayerCount = targetCfg.layerCount !== undefined ? targetCfg.layerCount : 5;
        this.runtimeState.layerCount = Math.round((this.runtimeState.layerCount || 5) + (targetLayerCount - (this.runtimeState.layerCount || 5)) * lerpFactor);
        this.runtimeState.billowScale = (this.runtimeState.billowScale || 0.002) + ((targetCfg.billowScale || 0.002) - (this.runtimeState.billowScale || 0.002)) * lerpFactor;
        this.runtimeState.detailScale = (this.runtimeState.detailScale || 0.0065) + ((targetCfg.detailScale || 0.0065) - (this.runtimeState.detailScale || 0.0065)) * lerpFactor;
        this.runtimeState.driftSpeed += (targetCfg.driftSpeed - this.runtimeState.driftSpeed) * lerpFactor;
        this.runtimeState.turbulence += (targetCfg.turbulence - this.runtimeState.turbulence) * lerpFactor;
        this.runtimeState.mieIntensity = (this.runtimeState.mieIntensity || 1.3) + ((targetCfg.mieIntensity || 1.3) - (this.runtimeState.mieIntensity || 1.3)) * lerpFactor;
        this.runtimeState.sunGlow = (this.runtimeState.sunGlow || 1.2) + ((targetCfg.sunGlow || 1.2) - (this.runtimeState.sunGlow || 1.2)) * lerpFactor;
        this.runtimeState.nearFade = (this.runtimeState.nearFade || 8) + ((targetCfg.nearFade !== undefined ? targetCfg.nearFade : 8) - (this.runtimeState.nearFade || 8)) * lerpFactor;
        this.runtimeState.farFade = (this.runtimeState.farFade || 1800) + ((targetCfg.farFade !== undefined ? targetCfg.farFade : 1800) - (this.runtimeState.farFade || 1800)) * lerpFactor;
        
        const targetDistNear = targetCfg.distNear !== undefined ? targetCfg.distNear : 35;
        const targetDistFar = targetCfg.distFar !== undefined ? targetCfg.distFar : 1100;
        const targetDistDensity = targetCfg.distDensity !== undefined ? targetCfg.distDensity : 1.75;
        const targetDistAltScale = targetCfg.distAltScale !== undefined ? targetCfg.distAltScale : 0.8;

        this.runtimeState.distNear = (this.runtimeState.distNear !== undefined ? this.runtimeState.distNear : targetDistNear) + (targetDistNear - (this.runtimeState.distNear !== undefined ? this.runtimeState.distNear : targetDistNear)) * lerpFactor;
        this.runtimeState.distFar = (this.runtimeState.distFar !== undefined ? this.runtimeState.distFar : targetDistFar) + (targetDistFar - (this.runtimeState.distFar !== undefined ? this.runtimeState.distFar : targetDistFar)) * lerpFactor;
        this.runtimeState.distDensity = (this.runtimeState.distDensity !== undefined ? this.runtimeState.distDensity : targetDistDensity) + (targetDistDensity - (this.runtimeState.distDensity !== undefined ? this.runtimeState.distDensity : targetDistDensity)) * lerpFactor;
        this.runtimeState.distAltScale = (this.runtimeState.distAltScale !== undefined ? this.runtimeState.distAltScale : targetDistAltScale) + (targetDistAltScale - (this.runtimeState.distAltScale !== undefined ? this.runtimeState.distAltScale : targetDistAltScale)) * lerpFactor;
        this.runtimeState.enabled = targetCfg.enabled !== false;

        // Active color based on timePhase
        let targetHex = targetCfg.color || '#e2e8f0';
        let targetHighlightHex = targetCfg.sunTint || '#fff1d6';
        if (timePhase === 1) {
            targetHex = targetCfg.colorDusk || '#cbd5e1';
            targetHighlightHex = targetCfg.sunTintDusk || '#fed7aa';
        } else if (timePhase === 2) {
            targetHex = targetCfg.colorNight || '#0f172a';
            targetHighlightHex = targetCfg.sunTintNight || '#38bdf8';
        }

        // Apply to scene objects
        if (window.fogGroup) {
            const isGlobalFogOn = !window.params || (window.params.showFog !== false && window.params.fogPlane !== false);
            const isBiomeFogOn = this.runtimeState.enabled !== false;
            const isVisible = isGlobalFogOn && isBiomeFogOn;
            window.fogGroup.visible = isVisible;
            if (isVisible) {
                if (window.valleyFogSystem && typeof window.valleyFogSystem.setLayers === 'function') {
                    window.valleyFogSystem.setLayers(this.runtimeState.layerCount || 5, this.runtimeState.layerSpacing);
                } else {
                    const children = window.fogGroup.children;
                    for (let i = 0; i < children.length; i++) {
                        children[i].position.y = 10 + i * this.runtimeState.layerSpacing;
                    }
                }
            }
        }

        if (window.fogMat) {
            if (window.fogMat.color) window.fogMat.color.set(targetHex);
        }

        if (window.fogUniforms) {
            if (window.fogUniforms.uFogIntensity) window.fogUniforms.uFogIntensity.value = this.runtimeState.intensity;
            if (window.fogUniforms.uFogOpacity) window.fogUniforms.uFogOpacity.value = this.runtimeState.opacity;
            if (window.fogUniforms.uFogDrift) window.fogUniforms.uFogDrift.value = this.runtimeState.driftSpeed;
            if (window.fogUniforms.uFogTurbulence) window.fogUniforms.uFogTurbulence.value = this.runtimeState.turbulence;
            if (window.fogUniforms.uFogNear) window.fogUniforms.uFogNear.value = this.runtimeState.nearFade;
            if (window.fogUniforms.uFogFar) window.fogUniforms.uFogFar.value = this.runtimeState.farFade;
            if (window.fogUniforms.uInversionCeiling) window.fogUniforms.uInversionCeiling.value = this.runtimeState.inversionCeiling;
            if (window.fogUniforms.uCeilingFalloff) window.fogUniforms.uCeilingFalloff.value = this.runtimeState.ceilingFalloff;
            if (window.fogUniforms.uBillowScale) window.fogUniforms.uBillowScale.value = this.runtimeState.billowScale;
            if (window.fogUniforms.uDetailScale) window.fogUniforms.uDetailScale.value = this.runtimeState.detailScale;
            if (window.fogUniforms.uMieIntensity) window.fogUniforms.uMieIntensity.value = this.runtimeState.mieIntensity;
            if (window.fogUniforms.uSunGlow) window.fogUniforms.uSunGlow.value = this.runtimeState.sunGlow;
            if (window.fogUniforms.uBaseColor) window.fogUniforms.uBaseColor.value.set(targetHex);
            if (window.fogUniforms.uSunHighlightColor) window.fogUniforms.uSunHighlightColor.value.set(targetHighlightHex);
        }

        // Export biome height offset for main render loop positioning
        if (window.biomeFogSettings) {
            window.biomeFogSettings[activeBiome] = this.runtimeState.heightOffset;
        }
    }

    applyToScene(instant = false) {
        const cfg = this.getCurrentConfig();
        if (instant) {
            Object.assign(this.runtimeState, cfg);
        }
        if (window.fogGroup) {
            const isGlobalFogOn = !window.params || (window.params.showFog !== false && window.params.fogPlane !== false);
            const isBiomeFogOn = this.runtimeState.enabled !== false;
            window.fogGroup.visible = isGlobalFogOn && isBiomeFogOn;
            if (window.valleyFogSystem && typeof window.valleyFogSystem.setLayers === 'function') {
                window.valleyFogSystem.setLayers(this.runtimeState.layerCount || 5, this.runtimeState.layerSpacing);
            }
        }
    }

    startBiomePolling() {
        setInterval(() => {
            if (this.visible && this.followPlayerBiome) {
                const b = this.getCurrentBiomeFromScene();
                if (b !== this.selectedBiome) {
                    this.selectedBiome = b;
                    this.syncUI();
                }
            }
        }, 600);
    }

    toggle(forceState) {
        this.visible = forceState !== undefined ? forceState : !this.visible;
        this.el.style.display = this.visible ? 'block' : 'none';
        if (this.visible) {
            if (this.followPlayerBiome) {
                this.selectedBiome = this.getCurrentBiomeFromScene();
            }
            this.syncUI();
        }
    }
}

