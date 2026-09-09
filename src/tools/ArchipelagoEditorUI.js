// ArchipelagoEditorUI.js - Live In-Game Archipelago Studio Editor
// Clean plain-text, 100% icon-free, zero-GC compliant floating editor for Wanderlust

import terrainArch, { PRESETS, setArchipelagoPreset, saveArchipelagoToStorage } from '../world/biomes/terrain-archipelago.js';
import { getWorldHeight } from '../world/TerrainGenerator.js';

export class ArchipelagoEditorUI {
    constructor(opts = {}) {
        this.onTerrainModified = opts.onTerrainModified || (() => {});
        this.teleportPlayer = opts.teleportPlayer || null;
        this.selectedIslandId = terrainArch.activeIslands[0] ? terrainArch.activeIslands[0].id : null;
        this.isOpen = false;

        this.initDOM();
        this.bindEvents();
    }

    initDOM() {
        if (document.getElementById('archipelago-editor-hud')) return;

        const container = document.createElement('div');
        container.id = 'archipelago-editor-hud';
        container.style.cssText = `
            position: fixed;
            top: 60px;
            left: 24px;
            width: 380px;
            max-height: calc(100vh - 100px);
            background: rgba(6, 26, 32, 0.92);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(45, 212, 191, 0.35);
            border-radius: 12px;
            box-shadow: 0 16px 48px rgba(0, 0, 0, 0.75);
            color: #f0fdf4;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            font-size: 13px;
            z-index: 100;
            display: none;
            flex-direction: column;
            overflow: hidden;
            user-select: none;
        `;

        container.innerHTML = `
            <div style="padding: 14px 18px 10px 18px; border-bottom: 1px solid rgba(45, 212, 191, 0.2); background: rgba(16, 185, 129, 0.08); display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <div style="font-weight: 800; font-size: 15px; letter-spacing: 0.5px; color: #34d399; text-transform: uppercase;">Archipelago Studio</div>
                    <div style="font-size: 11px; color: #6ee7b7; opacity: 0.85; margin-top: 2px;">Tropical Atolls, Karst Spires & Island Chains</div>
                </div>
                <button id="arch-close-btn" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #e2e8f0; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 700;">Close</button>
            </div>

            <div style="padding: 14px 18px; overflow-y: auto; max-height: calc(100vh - 180px);">
                <!-- Preset Island Chains -->
                <div style="margin-bottom: 16px;">
                    <div style="font-size: 11px; font-weight: 800; color: #34d399; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">Island Chain Presets</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                        <button class="arch-preset-btn" data-preset="tropical_chain" style="background: rgba(16, 185, 129, 0.18); border: 1px solid rgba(16, 185, 129, 0.4); color: #6ee7b7; padding: 7px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; text-align: center;">Tropical Chain</button>
                        <button class="arch-preset-btn" data-preset="volcano" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); color: #e2e8f0; padding: 7px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; text-align: center;">Volcanic Ridge</button>
                        <button class="arch-preset-btn" data-preset="paradise" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); color: #e2e8f0; padding: 7px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; text-align: center;">Paradise Isles</button>
                        <button class="arch-preset-btn" data-preset="atoll" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); color: #e2e8f0; padding: 7px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; text-align: center;">Coral Atoll</button>
                        <button class="arch-preset-btn" data-preset="grand_atoll" style="grid-column: span 2; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); color: #e2e8f0; padding: 7px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; text-align: center;">Grand Atoll (Single Massive)</button>
                    </div>
                </div>

                <!-- Active Islands List -->
                <div style="margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <div style="font-size: 11px; font-weight: 800; color: #34d399; text-transform: uppercase; letter-spacing: 0.8px;">Active Islands (<span id="arch-island-count">0</span>)</div>
                        <button id="arch-add-island-btn" style="background: rgba(16, 185, 129, 0.25); border: 1px solid rgba(16, 185, 129, 0.5); color: #34d399; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; cursor: pointer;">+ New Island</button>
                    </div>
                    <div id="arch-island-list" style="display: flex; flex-direction: column; gap: 4px; max-height: 140px; overflow-y: auto; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(45, 212, 191, 0.15); border-radius: 6px; padding: 6px;">
                    </div>
                </div>

                <!-- Selected Island Inspector -->
                <div id="arch-inspector" style="margin-bottom: 16px; background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(45, 212, 191, 0.2); border-radius: 8px; padding: 12px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                        <span id="arch-sel-name" style="font-weight: 800; color: #a7f3d0; font-size: 13px;">Selected Island</span>
                        <div style="display: flex; gap: 4px;">
                            <button id="arch-fly-btn" style="background: rgba(6, 182, 212, 0.25); border: 1px solid rgba(6, 182, 212, 0.5); color: #67e8f9; padding: 3px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; cursor: pointer;">Fly To</button>
                            <button id="arch-del-btn" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; padding: 3px 7px; border-radius: 4px; font-size: 10px; font-weight: 700; cursor: pointer;">Delete</button>
                        </div>
                    </div>

                    <!-- Radius Slider -->
                    <div style="margin-bottom: 9px;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
                            <span style="color: #94a3b8;">Island Radius & Landmass:</span>
                            <span id="arch-val-radius" style="color: #34d399; font-weight: 700;">600m</span>
                        </div>
                        <input id="arch-slide-radius" type="range" min="150" max="1500" step="10" value="600" style="width: 100%; accent-color: #10b981; cursor: pointer;" />
                    </div>

                    <!-- Height Scale Slider -->
                    <div style="margin-bottom: 9px;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
                            <span style="color: #94a3b8;">Peak & Mountain Height:</span>
                            <span id="arch-val-height" style="color: #34d399; font-weight: 700;">1.4x</span>
                        </div>
                        <input id="arch-slide-height" type="range" min="0.3" max="3.0" step="0.05" value="1.4" style="width: 100%; accent-color: #10b981; cursor: pointer;" />
                    </div>

                    <!-- Karst Pinnacle Multiplier -->
                    <div style="margin-bottom: 9px;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
                            <span style="color: #94a3b8;">Karst Pinnacle Multiplier:</span>
                            <span id="arch-val-karst" style="color: #34d399; font-weight: 700;">1.3x</span>
                        </div>
                        <input id="arch-slide-karst" type="range" min="0.0" max="3.0" step="0.05" value="1.3" style="width: 100%; accent-color: #10b981; cursor: pointer;" />
                    </div>

                    <!-- Mangrove River & Lagoon Carve -->
                    <div style="margin-bottom: 9px;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
                            <span style="color: #94a3b8;">Mangrove River & Lagoon Carve:</span>
                            <span id="arch-val-river" style="color: #34d399; font-weight: 700;">0.9x</span>
                        </div>
                        <input id="arch-slide-river" type="range" min="0.0" max="2.5" step="0.05" value="0.9" style="width: 100%; accent-color: #10b981; cursor: pointer;" />
                    </div>

                    <!-- Roughness -->
                    <div style="margin-bottom: 9px;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
                            <span style="color: #94a3b8;">Terrain Roughness & Ridges:</span>
                            <span id="arch-val-roughness" style="color: #34d399; font-weight: 700;">1.2x</span>
                        </div>
                        <input id="arch-slide-roughness" type="range" min="0.5" max="2.0" step="0.05" value="1.2" style="width: 100%; accent-color: #10b981; cursor: pointer;" />
                    </div>

                    <!-- Position X -->
                    <div style="margin-bottom: 9px;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
                            <span style="color: #94a3b8;">Position X (West - East):</span>
                            <span id="arch-val-posx" style="color: #34d399; font-weight: 700;">0m</span>
                        </div>
                        <input id="arch-slide-posx" type="range" min="-3000" max="3000" step="25" value="0" style="width: 100%; accent-color: #10b981; cursor: pointer;" />
                    </div>

                    <!-- Position Z -->
                    <div style="margin-bottom: 9px;">
                        <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
                            <span style="color: #94a3b8;">Position Z (Corridor Depth):</span>
                            <span id="arch-val-posz" style="color: #34d399; font-weight: 700;">8000m</span>
                        </div>
                        <input id="arch-slide-posz" type="range" min="1000" max="15000" step="50" value="8000" style="width: 100%; accent-color: #10b981; cursor: pointer;" />
                    </div>

                    <!-- Randomize Shape -->
                    <button id="arch-rand-btn" style="width: 100%; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); color: #a7f3d0; padding: 6px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; margin-top: 4px;">Randomize Island Shape & Seed</button>
                </div>

                <!-- Persistence Footer -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                    <button id="arch-save-btn" style="background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399; padding: 6px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">Save Archipelago</button>
                    <button id="arch-reset-btn" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); color: #e2e8f0; padding: 6px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">Reset Default</button>
                </div>
            </div>
        `;

        document.body.appendChild(container);
        this.dom = container;
    }

    bindEvents() {
        document.getElementById('arch-close-btn').addEventListener('click', () => this.toggle(false));

        // Preset buttons
        this.dom.querySelectorAll('.arch-preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const presetKey = e.target.getAttribute('data-preset');
                if (presetKey && PRESETS[presetKey]) {
                    setArchipelagoPreset(presetKey);
                    this.selectedIslandId = terrainArch.activeIslands[0] ? terrainArch.activeIslands[0].id : null;
                    this.updateUI();
                    this.triggerTerrainUpdate();
                }
            });
        });

        // Add Island
        document.getElementById('arch-add-island-btn').addEventListener('click', () => {
            const newId = 'isl_' + Date.now().toString(36);
            const count = terrainArch.activeIslands.length + 1;
            const newIsl = {
                id: newId,
                name: `Island #${count}`,
                x: (Math.random() - 0.5) * 1600,
                z: 6000 + Math.random() * 4000,
                radius: 500 + Math.floor(Math.random() * 300),
                heightScale: 1.25,
                karstScale: 1.1,
                roughness: 1.15,
                riverDepth: 0.75,
                seed: Math.floor(Math.random() * 90000)
            };
            terrainArch.activeIslands.push(newIsl);
            this.selectedIslandId = newId;
            saveArchipelagoToStorage();
            this.updateUI();
            this.triggerTerrainUpdate();
        });

        // Delete Island
        document.getElementById('arch-del-btn').addEventListener('click', () => {
            if (terrainArch.activeIslands.length <= 1) return;
            terrainArch.activeIslands = terrainArch.activeIslands.filter(i => i.id !== this.selectedIslandId);
            this.selectedIslandId = terrainArch.activeIslands[0] ? terrainArch.activeIslands[0].id : null;
            saveArchipelagoToStorage();
            this.updateUI();
            this.triggerTerrainUpdate();
        });

        // Fly To Island
        document.getElementById('arch-fly-btn').addEventListener('click', () => {
            const isl = this.getSelectedIsland();
            if (isl && this.teleportPlayer) {
                const groundY = getWorldHeight(isl.x, isl.z);
                this.teleportPlayer(isl.x, Math.max(45, groundY + 120), isl.z);
            }
        });

        // Sliders
        const bindSlider = (sliderId, labelId, prop, fmt = (v) => v, isFloat = true) => {
            const slider = document.getElementById(sliderId);
            slider.addEventListener('input', (e) => {
                const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
                const isl = this.getSelectedIsland();
                if (isl) {
                    isl[prop] = val;
                    document.getElementById(labelId).innerText = fmt(val);
                    this.triggerTerrainUpdate();
                }
            });
            slider.addEventListener('change', () => {
                saveArchipelagoToStorage();
            });
        };

        bindSlider('arch-slide-radius', 'arch-val-radius', 'radius', (v) => `${Math.round(v)}m`, false);
        bindSlider('arch-slide-height', 'arch-val-height', 'heightScale', (v) => `${v.toFixed(2)}x`, true);
        bindSlider('arch-slide-karst', 'arch-val-karst', 'karstScale', (v) => `${v.toFixed(2)}x`, true);
        bindSlider('arch-slide-river', 'arch-val-river', 'riverDepth', (v) => `${v.toFixed(2)}x`, true);
        bindSlider('arch-slide-roughness', 'arch-val-roughness', 'roughness', (v) => `${v.toFixed(2)}x`, true);
        bindSlider('arch-slide-posx', 'arch-val-posx', 'x', (v) => `${Math.round(v)}m`, true);
        bindSlider('arch-slide-posz', 'arch-val-posz', 'z', (v) => `${Math.round(v)}m`, true);

        // Randomize Seed
        document.getElementById('arch-rand-btn').addEventListener('click', () => {
            const isl = this.getSelectedIsland();
            if (isl) {
                isl.seed = Math.floor(Math.random() * 90000);
                saveArchipelagoToStorage();
                this.triggerTerrainUpdate();
            }
        });

        // Save & Reset
        document.getElementById('arch-save-btn').addEventListener('click', () => {
            saveArchipelagoToStorage();
        });

        document.getElementById('arch-reset-btn').addEventListener('click', () => {
            setArchipelagoPreset('tropical_chain');
            this.selectedIslandId = terrainArch.activeIslands[0].id;
            this.updateUI();
            this.triggerTerrainUpdate();
        });

        // Global hotkey I to toggle Archipelago Editor (replaces Shift+A to prevent boost+left collision)
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
                return;
            }
            if ((e.key === 'i' || e.key === 'I') && !e.ctrlKey && !e.altKey && !e.metaKey) {
                this.toggle();
            }
        });
    }

    getSelectedIsland() {
        return terrainArch.activeIslands.find(i => i.id === this.selectedIslandId) || terrainArch.activeIslands[0];
    }

    updateUI() {
        const listEl = document.getElementById('arch-island-list');
        listEl.innerHTML = '';
        document.getElementById('arch-island-count').innerText = terrainArch.activeIslands.length;

        terrainArch.activeIslands.forEach(isl => {
            const card = document.createElement('div');
            const isSel = isl.id === this.selectedIslandId;
            card.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 8px;
                border-radius: 4px;
                background: ${isSel ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.04)'};
                border: 1px solid ${isSel ? 'rgba(16, 185, 129, 0.5)' : 'transparent'};
                cursor: pointer;
                transition: all 0.15s ease;
            `;
            card.innerHTML = `
                <span style="font-weight: 700; color: ${isSel ? '#34d399' : '#e2e8f0'}; font-size: 11px;">${isl.name}</span>
                <span style="font-size: 10px; color: #94a3b8;">R: ${Math.round(isl.radius)}m (${Math.round(isl.x)}, ${Math.round(isl.z)})</span>
            `;
            card.addEventListener('click', () => {
                this.selectedIslandId = isl.id;
                this.updateUI();
            });
            listEl.appendChild(card);
        });

        this.syncInspector();
    }

    syncInspector() {
        const isl = this.getSelectedIsland();
        if (!isl) return;

        document.getElementById('arch-sel-name').innerText = isl.name;
        document.getElementById('arch-slide-radius').value = isl.radius;
        document.getElementById('arch-val-radius').innerText = `${Math.round(isl.radius)}m`;

        document.getElementById('arch-slide-height').value = isl.heightScale !== undefined ? isl.heightScale : 1.25;
        document.getElementById('arch-val-height').innerText = `${(isl.heightScale !== undefined ? isl.heightScale : 1.25).toFixed(2)}x`;

        document.getElementById('arch-slide-karst').value = isl.karstScale !== undefined ? isl.karstScale : 1.1;
        document.getElementById('arch-val-karst').innerText = `${(isl.karstScale !== undefined ? isl.karstScale : 1.1).toFixed(2)}x`;

        document.getElementById('arch-slide-river').value = isl.riverDepth !== undefined ? isl.riverDepth : 0.8;
        document.getElementById('arch-val-river').innerText = `${(isl.riverDepth !== undefined ? isl.riverDepth : 0.8).toFixed(2)}x`;

        document.getElementById('arch-slide-roughness').value = isl.roughness !== undefined ? isl.roughness : 1.15;
        document.getElementById('arch-val-roughness').innerText = `${(isl.roughness !== undefined ? isl.roughness : 1.15).toFixed(2)}x`;

        document.getElementById('arch-slide-posx').value = isl.x;
        document.getElementById('arch-val-posx').innerText = `${Math.round(isl.x)}m`;

        document.getElementById('arch-slide-posz').value = isl.z;
        document.getElementById('arch-val-posz').innerText = `${Math.round(isl.z)}m`;
    }

    triggerTerrainUpdate() {
        if (typeof this.onTerrainModified === 'function') {
            this.onTerrainModified();
        }
    }

    toggle(forceState) {
        this.isOpen = (forceState !== undefined) ? forceState : !this.isOpen;
        this.dom.style.display = this.isOpen ? 'flex' : 'none';
        if (this.isOpen) {
            this.updateUI();
        }
    }
}