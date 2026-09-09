import { liveSync } from '../core/LiveSync.js';

export function downloadPresetFile(data, filename) {
    try {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
        console.error('Failed to download save file to disk:', err);
    }
}

let isUpdatingPresetDropdown = false;
export function updateAllPresetDropdowns(selectedName, presetDropdownControllers = [], DEFAULT_PRESETS = {}) {
    if (isUpdatingPresetDropdown) return;
    isUpdatingPresetDropdown = true;
    try {
        const saved = JSON.parse(localStorage.getItem('wl_custom_presets') || '{}');
        const defaultKeys = Object.keys(DEFAULT_PRESETS);
        const customKeys = Object.keys(saved);
        const options = [...defaultKeys, ...customKeys];

        presetDropdownControllers.forEach(ctrl => {
            if (ctrl && typeof ctrl.options === 'function') {
                ctrl.options(options);
                if (selectedName) {
                    ctrl.setValue(selectedName);
                }
            } else if (ctrl && ctrl.domElement) {
                const select = ctrl.domElement.querySelector('select');
                if (select) {
                    select.innerHTML = '';
                    const defaultOpt = document.createElement('option');
                    defaultOpt.value = '';
                    defaultOpt.innerText = '-- Choose Saved Preset --';
                    select.appendChild(defaultOpt);
                    options.forEach(name => {
                        const opt = document.createElement('option');
                        opt.value = name;
                        opt.innerText = name;
                        select.appendChild(opt);
                    });
                    if (selectedName && options.includes(selectedName)) {
                        select.value = selectedName;
                    }
                }
            }
        });
    } catch (err) {
        console.warn('Error updating preset dropdown:', err);
    } finally {
        isUpdatingPresetDropdown = false;
    }
}

export function applyPresetData(p, ctx = {}) {
    if (!p) return;
    if (!ctx._isSyncing) {
        liveSync.sendFullPreset(p);
    }
    const {
        envConfigs,
        params,
        cloudParams,
        flightModelManager,
        gui,
        settingsManager,
        presetDropdownControllers,
        DEFAULT_PRESETS,
        updateAtmoParamsFromPhase,
        setTimePhase
    } = ctx;

    if (p.envConfigs && Array.isArray(p.envConfigs) && envConfigs) {
        for (let i = 0; i < p.envConfigs.length; i++) {
            if (envConfigs[i]) Object.assign(envConfigs[i], p.envConfigs[i]);
        }
    }
    if (p.timePhase !== undefined) {
        if (typeof window !== 'undefined' && typeof window.setTimePhase === 'function') {
            window.setTimePhase(p.timePhase);
        } else if (typeof setTimePhase === 'function') {
            setTimePhase(p.timePhase);
        }
        if (typeof updateAtmoParamsFromPhase === 'function') updateAtmoParamsFromPhase();
    }
    if (p.params && params) {
        Object.assign(params, p.params);
    }
    if (p.cloudParams && cloudParams) {
        Object.assign(cloudParams, p.cloudParams);
    }
    if (p.biomeFogSettings && typeof window !== 'undefined' && window.biomeFogSettings) {
        Object.assign(window.biomeFogSettings, p.biomeFogSettings);
    }
    if (p.biomeSkyConfigs && typeof window !== 'undefined' && window.BIOME_SKY_CONFIGS) {
        Object.assign(window.BIOME_SKY_CONFIGS, p.biomeSkyConfigs);
    }
    if (p.modelId && flightModelManager) {
        flightModelManager.setModelById(p.modelId);
    }
    if (p.guiData && gui) {
        gui.load(p.guiData);
    }
    if (gui) {
        gui.controllersRecursive().forEach(c => c.updateDisplay && c.updateDisplay());
    }
    if (p.name) {
        const saved = JSON.parse(localStorage.getItem('wl_custom_presets') || '{}');
        saved[p.name] = p;
        localStorage.setItem('wl_custom_presets', JSON.stringify(saved));
        if (settingsManager) settingsManager.loadPreset = p.name;
        updateAllPresetDropdowns(p.name, presetDropdownControllers, DEFAULT_PRESETS);
    }
}

export function handlePresetFile(file, ctx = {}) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            applyPresetData(data, ctx);
            if (ctx.showVisualToast) {
                ctx.showVisualToast(`Loaded preset from ${file.name}`);
            }
        } catch (err) {
            console.error('Failed to parse preset file:', err);
            alert('Invalid preset JSON file');
        }
    };
    reader.readAsText(file);
}

export function saveAllSettings(ctx = {}) {
    const {
        gui,
        flightModelManager,
        timePhase,
        skyRenderMode,
        cameraZoomDist,
        params,
        isWindOn,
        isEngineSoundOn,
        isModelVisible,
        isSoundMuted,
        isMusicPlaying,
        showVisualToast
    } = ctx;

    const savedState = {};

    if (gui) {
        savedState.guiData = gui.save();
    }
    if (flightModelManager) {
        savedState.modelId = flightModelManager.getCurrentConfig()?.id || 'psx_saviola_s21';
    }
    if (timePhase !== undefined) {
        savedState.timePhase = timePhase;
    }
    if (typeof window !== 'undefined' && window.biomeFogSettings) {
        savedState.biomeFogSettings = JSON.parse(JSON.stringify(window.biomeFogSettings));
    }
    if (typeof window !== 'undefined' && window.BIOME_SKY_CONFIGS) {
        savedState.biomeSkyConfigs = JSON.parse(JSON.stringify(window.BIOME_SKY_CONFIGS));
    }
    if (skyRenderMode !== undefined) {
        savedState.skyRenderMode = skyRenderMode;
    }
    if (cameraZoomDist !== undefined) {
        savedState.cameraZoomDist = cameraZoomDist;
    }
    if (params) {
        savedState.params = {};
        for (let k in params) {
            if (typeof params[k] !== 'function') savedState.params[k] = params[k];
        }
    }

    savedState.toggles = {
        isWindOn: !!isWindOn,
        isEngineSoundOn: isEngineSoundOn !== undefined ? isEngineSoundOn : true,
        isModelVisible: isModelVisible !== undefined ? isModelVisible : true,
        isSoundMuted: !!isSoundMuted,
        isMusicPlaying: !!isMusicPlaying
    };

    savedState.crystalSettings = {
        roughness: document.getElementById('c-roughness')?.value,
        metalness: document.getElementById('c-metalness')?.value,
        transmission: document.getElementById('c-transmission')?.value,
        thickness: document.getElementById('c-thickness')?.value,
        opacity: document.getElementById('c-fly-opacity')?.value,
        flyHue: document.getElementById('c-fly-hue')?.value,
        flyContrast: document.getElementById('c-fly-contrast')?.value,
        baseGlow: document.getElementById('c-baseGlow')?.value,
        nightGlow: document.getElementById('c-nightGlow')?.value,
        flyColors: [
            document.getElementById('c-f-col0')?.value,
            document.getElementById('c-f-col1')?.value,
            document.getElementById('c-f-col2')?.value,
            document.getElementById('c-f-col3')?.value,
            document.getElementById('c-f-col4')?.value,
            document.getElementById('c-f-col5')?.value
        ],
        groundColors: [
            document.getElementById('c-col0')?.value,
            document.getElementById('c-col1')?.value,
            document.getElementById('c-col2')?.value,
            document.getElementById('c-col3')?.value,
            document.getElementById('c-col4')?.value,
            document.getElementById('c-col5')?.value
        ]
    };

    localStorage.setItem('wanderlust_save_all_settings', JSON.stringify(savedState));

    if (savedState.modelId) localStorage.setItem('wl_saved_model_id', savedState.modelId);
    if (savedState.timePhase !== undefined) localStorage.setItem('wl_timePhase', savedState.timePhase);
    if (savedState.skyRenderMode) localStorage.setItem('wl_skyRenderMode', savedState.skyRenderMode);
    if (savedState.cameraZoomDist !== undefined) localStorage.setItem('wl_zoomDist', savedState.cameraZoomDist);
    if (savedState.biomeFogSettings) localStorage.setItem('wanderlust_biome_fog_settings', JSON.stringify(savedState.biomeFogSettings));
    if (savedState.biomeSkyConfigs) localStorage.setItem('wanderlust_biome_sky_configs', JSON.stringify(savedState.biomeSkyConfigs));
    if (savedState.toggles.isEngineSoundOn !== undefined) localStorage.setItem('wl_engineSound', savedState.toggles.isEngineSoundOn ? '1' : '0');
    if (savedState.toggles.isSoundMuted !== undefined) localStorage.setItem('wl_soundMuted', savedState.toggles.isSoundMuted ? '1' : '0');

    if (typeof showVisualToast === 'function') {
        showVisualToast('All settings and parameters saved!');
    } else {
        console.log('All settings and parameters saved!');
    }
}

export function loadAllSettings(ctx = {}) {
    const raw = localStorage.getItem('wanderlust_save_all_settings');
    if (!raw) return;

    try {
        const saved = JSON.parse(raw);
        const {
            gui,
            flightModelManager,
            setTimePhase,
            setWindOn,
            setEngineSoundOn,
            setModelVisible,
            setSoundMuted,
            setCameraZoomDist
        } = ctx;

        if (saved.guiData && gui) {
            gui.load(saved.guiData);
            gui.controllersRecursive().forEach(c => {
                if (typeof c.updateDisplay === 'function') c.updateDisplay();
            });
        }

        if (saved.modelId && flightModelManager) {
            const current = flightModelManager.getCurrentConfig();
            if (!current || current.id !== saved.modelId) {
                flightModelManager.setModelById(saved.modelId, true);
            }
        }

        if (saved.timePhase !== undefined) {
            if (typeof window !== 'undefined' && typeof window.setTimePhase === 'function') {
                window.setTimePhase(saved.timePhase);
            } else if (typeof setTimePhase === 'function') {
                setTimePhase(saved.timePhase);
            }
        }

        if (saved.biomeFogSettings && typeof window !== 'undefined' && window.biomeFogSettings) {
            Object.assign(window.biomeFogSettings, saved.biomeFogSettings);
        }
        if (saved.biomeSkyConfigs && typeof window !== 'undefined' && window.BIOME_SKY_CONFIGS) {
            Object.assign(window.BIOME_SKY_CONFIGS, saved.biomeSkyConfigs);
        }

        if (saved.toggles) {
            const t = saved.toggles;
            if (t.isWindOn !== undefined && typeof setWindOn === 'function') setWindOn(t.isWindOn);
            if (t.isEngineSoundOn !== undefined && typeof setEngineSoundOn === 'function') setEngineSoundOn(t.isEngineSoundOn);
            if (t.isModelVisible !== undefined && typeof setModelVisible === 'function') setModelVisible(t.isModelVisible);
            if (t.isSoundMuted !== undefined && typeof setSoundMuted === 'function') setSoundMuted(t.isSoundMuted);
        }

        if (saved.cameraZoomDist !== undefined && typeof setCameraZoomDist === 'function') {
            setCameraZoomDist(Math.max(6.0, Math.min(300.0, saved.cameraZoomDist)));
        }

        if (saved.crystalSettings) {
            const cs = saved.crystalSettings;
            const restoreInput = (id, val) => {
                const el = document.getElementById(id);
                if (el && val !== undefined && val !== null) {
                    el.value = val;
                    el.dispatchEvent(new Event('input'));
                }
            };

            restoreInput('c-roughness', cs.roughness);
            restoreInput('c-metalness', cs.metalness);
            restoreInput('c-transmission', cs.transmission);
            restoreInput('c-thickness', cs.thickness);
            restoreInput('c-fly-opacity', cs.opacity);
            restoreInput('c-fly-hue', cs.flyHue);
            restoreInput('c-fly-contrast', cs.flyContrast);
            restoreInput('c-baseGlow', cs.baseGlow);
            restoreInput('c-nightGlow', cs.nightGlow);

            if (cs.flyColors && Array.isArray(cs.flyColors)) {
                for (let i = 0; i < 6; i++) {
                    restoreInput('c-f-col' + i, cs.flyColors[i]);
                }
            }
            if (cs.groundColors && Array.isArray(cs.groundColors)) {
                for (let i = 0; i < 6; i++) {
                    restoreInput('c-col' + i, cs.groundColors[i]);
                }
            }
        }
    } catch (e) {
        console.error('Failed to load all saved settings:', e);
    }
}
