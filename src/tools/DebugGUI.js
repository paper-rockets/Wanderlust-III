import * as THREE from 'three';
import { ZONES, getWorldSeed, setWorldSeed, getBiomeTeleportCoords } from '../world/BiomeManager.js';
import { BIOME_SKY_CONFIGS } from '../environment/BiomeSkyConfigs.js';
import { describeTier } from '../core/DeviceTier.js';
import { applyRenderBudget } from '../core/Engine.js';
import { tracks, selectMusicTrack, getCurrentTrackIndex, setAutoAdvance, setMusicMuted as setAudioMuted } from '../audio/MusicSynthesizer.js';
import { DEFAULT_PRESETS } from '../config/PresetsConfig.js';
import { cleanBiomeName } from '../config/FogConfig.js';
import { globalTerrainParams, biomeHeights, biomeScales, biomeWaterHeights, getWorldWaterHeight, getWorldHeight, getBiomeAt, getIslandData } from '../world/TerrainGenerator.js';
import { showVisualToast, toggleFullscreen } from '../ui/MinimapHUD.js';
import { FLIGHT_MODELS } from '../config/FlightModelsConfig.js';
import { bloomPass, godRaysPass, uRolloffKnee } from '../core/PostProcessing.js';
import { desertColors } from '../world/biomes/terrain-desert.js';
import { northPoleColors } from '../world/biomes/terrain-northpole.js';
import { updateAllPresetDropdowns } from '../config/PresetManager.js';
import { setupGodMode, toggleGodMode } from '../physics/GodMode.js';
import { liveSync } from '../core/LiveSync.js';
import { milkyWayParams, applyMilkyWayTilt } from '../environment/MilkyWaySystem.js';
import { auroraParams, moonParams, moonMesh } from '../environment/CelestialObjects.js';
import {
    waterFogNearUniform,
    waterFogFarUniform,
    waterFogDensityUniform,
    globalFogDensityUniform,
    waterFogStrengthUniform,
    waterGridFadeStartUniform,
    waterGridFadeEndUniform
} from '../WaterAnime/OpenSeaOcean.js';

export function initDebugGUI(ctx) {
    const {
        gui,
        params,
        cloudParams,
        adaptiveRes,
        uDitherAmount,
        terrain,
        dirLight,
        bloomPass,
        settingsManager,
        playerPhysics,
        cameraManager,
        timeOfDayExporter,
        stylizedTrees,
        LOW_GFX,
        presetDropdownControllers,
        envConfigs,
        setTimePhase,
        updateAtmoParamsFromPhase,
        applyPresetData,
        handlePresetFile,
        saveCustomPreset,
        loadCustomPreset,
        deleteCustomPreset,
        crystalSystem,
        rainSystem,
        animeWaterSystem,
        animeWaterGUI,
        archipelagoEditorUI,
        groundFogEditor,
        flightModelManager,
        toggleModelVisibility,
        globalWaterParam,
        skyUniforms,
        scene,
        camera,
        renderer,
        cameraBase,
        toonShaderManager,
        treeMeshes,
        distanceOverlay
    } = ctx;

    const terrainMeshManager = ctx.terrainMeshManager;
    const playerGrp = ctx.playerGrp || (typeof window !== 'undefined' ? window.playerGrp : null);

    let {
        isShadowsOn,
        isTreeShadowsOn,
        shadowDistMode,
        isBloomOn,
        terrainRes
    } = ctx;

    let lastTerrainGridX = ctx.lastTerrainGridX !== undefined ? ctx.lastTerrainGridX : -9999;
    let lastTerrainGridZ = ctx.lastTerrainGridZ !== undefined ? ctx.lastTerrainGridZ : -9999;
    let lastDepthFieldGridX = ctx.lastDepthFieldGridX !== undefined ? ctx.lastDepthFieldGridX : -999999;
    let lastDepthFieldGridZ = ctx.lastDepthFieldGridZ !== undefined ? ctx.lastDepthFieldGridZ : -999999;
    let globalWaterHeightOffset = 0;

    const invalidateTerrain = () => {
        lastTerrainGridX = -999999;
        lastTerrainGridZ = -999999;
        lastDepthFieldGridX = -999999;
        lastDepthFieldGridZ = -999999;
        if (terrainMeshManager && typeof terrainMeshManager.invalidate === 'function') {
            terrainMeshManager.invalidate();
        } else if (terrainMeshManager) {
            terrainMeshManager.lastTerrainGridX = -999999;
            terrainMeshManager.lastTerrainGridZ = -999999;
            terrainMeshManager.lastDepthFieldGridX = -999999;
            terrainMeshManager.lastDepthFieldGridZ = -999999;
        }
    };
    let terrainGeo = ctx.terrainGeo;
    let isInitializingGui = true;
    let waterHeightController = null;
    let customModelFolder = null;
    let modelDropdownController = null;
    const customModelControllers = {};
    let flightFolder = null;
    let audioFolder = null;
    let flightModelDropdownController = null;
    let soundMuteController = null;
    let engineSoundController = null;
    let trackDropdownController = null;
    let isWindOn = false;
    let isRainOn = false;

    const isStudio = typeof document !== 'undefined' && (
        document.body.classList.contains('studio-mode') || 
        document.documentElement.classList.contains('studio-mode') || 
        (typeof window !== 'undefined' && window.location && window.location.pathname.includes('studio'))
    );

    // Low Power & Mobile Optimization Folder
    const lowPowerFolder = gui.addFolder('Low Power & Mobile Optimization');
    const lowPowerParams = {
        qualityTier: (params.quality === 'Low' || LOW_GFX) ? 'Low / Tab S6 Lite' : 'Regular',
        renderScale: params.renderScale || 1.0,
        adaptiveResolution: params.autoResolution !== undefined ? params.autoResolution : false,
        treeTier: 'Ultra (70K)',
        shadows: params.shadows !== undefined ? params.shadows : isShadowsOn,
        shadowDist: params.shadowDist || shadowDistMode,
        bloom: params.bloom !== undefined ? params.bloom : isBloomOn,
        godRays: params.godRays !== undefined ? params.godRays : true,
        openTestbed: () => {
            window.location.href = 'low_power.html';
        },
        openMobileSimulator: () => {
            window.location.href = 'mobile_preview.html';
        }
    };

    const changeTreeTier = (v) => {
        lowPowerParams.treeTier = v;
        if (typeof pineParams !== 'undefined') pineParams.tier = v;
        if (window.stylizedTrees && typeof window.stylizedTrees.setCompressionTier === 'function') {
            window.stylizedTrees.setCompressionTier(v);
        }
        if (gui && typeof gui.controllersRecursive === 'function') {
            gui.controllersRecursive().forEach(c => {
                if (c.property === 'treeTier' || c.property === 'tier') {
                    if (c.updateDisplay) c.updateDisplay();
                }
            });
        }
    };

    lowPowerFolder.add(lowPowerParams, 'qualityTier', ['Regular', 'Low / Tab S6 Lite']).name('Quality Tier').onChange(v => {
        const nextGfx = (v === 'Low / Tab S6 Lite' || v === 'Low') ? 'low' : 'regular';
        const currentGfx = localStorage.getItem('gfxQuality') || (LOW_GFX ? 'low' : 'regular');
        localStorage.setItem('gfxQuality', nextGfx);
        if (!isInitializingGui && nextGfx !== currentGfx) {
            location.reload();
        }
    });

    lowPowerFolder.add(params, 'renderScale', 0.25, 1.0, 0.05).name('Target Render Scale').onChange(v => {
        if (params.autoResolution) {
            params.autoResolution = false;
            adaptiveRes.setEnabled(false);
            gui.controllersRecursive().forEach(c => {
                if (c.property === 'autoResolution') c.updateDisplay && c.updateDisplay();
            });
        }
        applyRenderBudget(v);
    });

    lowPowerFolder.add(params, 'autoResolution').name('Enable Adaptive Resolution').onChange(v => {
        adaptiveRes.setEnabled(v);
        if (v) {
            adaptiveRes.reset();
            applyRenderBudget(1.0);
        } else {
            applyRenderBudget(params.renderScale);
        }
    });
 
    lowPowerFolder.add(params, 'shadows').name('Shadows Enabled').onChange(v => {
        isShadowsOn = v;
        dirLight.castShadow = isShadowsOn;
    });

    lowPowerFolder.add(params, 'shadowDist', ['Close', 'Med', 'Far']).name('Shadow Distance Mode').onChange(v => {
        shadowDistMode = v;
        if (shadowDistMode === 'Close') { dirLight.shadow.mapSize.width = 1024; dirLight.shadow.mapSize.height = 1024; }
        else if (shadowDistMode === 'Med') { dirLight.shadow.mapSize.width = 2048; dirLight.shadow.mapSize.height = 2048; }
        else { dirLight.shadow.mapSize.width = 4096; dirLight.shadow.mapSize.height = 4096; }
        if (dirLight.shadow.map) { dirLight.shadow.map.dispose(); dirLight.shadow.map = null; }
    });

    lowPowerFolder.add(params, 'bloom').name('Bloom').onChange(v => {
        isBloomOn = v;
        bloomPass.enabled = isBloomOn;
    });

    lowPowerFolder.add(params, 'godRays').name('God Rays').onChange(v => {
        godRaysPass.enabled = v;
    });

    lowPowerFolder.add(lowPowerParams, 'openTestbed').name('Open Low Power Testbed (low_power.html)');
    lowPowerFolder.add(lowPowerParams, 'openMobileSimulator').name('Open S25 & Tab S6 Simulator (mobile_preview.html)');
    lowPowerFolder.add({ toggle3D: () => { if (window.toggle3DViewport) window.toggle3DViewport(!window.is3DViewportHidden); } }, 'toggle3D').name('Toggle 3D Viewport (0% GPU)');

    const perfFolder = gui.addFolder('Performance');
    perfFolder.add({ toggle3D: () => { if (window.toggle3DViewport) window.toggle3DViewport(!window.is3DViewportHidden); } }, 'toggle3D').name('Toggle 3D Viewport (0% GPU)');
    perfFolder.add(params, 'quality', ['Regular', 'Low']).name('Quality').onChange(v => {
        const nextGfx = (v === 'Low') ? 'low' : 'regular';
        const currentGfx = localStorage.getItem('gfxQuality') || (LOW_GFX ? 'low' : 'regular');
        localStorage.setItem('gfxQuality', nextGfx);
        if (!isInitializingGui && nextGfx !== currentGfx) {
            location.reload();
        }
    });
    perfFolder.add(params, 'autoResolution').name('Enable Adaptive Resolution').onChange(v => {
        adaptiveRes.setEnabled(v);
        if (v) { adaptiveRes.reset(); applyRenderBudget(1.0); }
        else { applyRenderBudget(params.renderScale); }
    });
    perfFolder.add(params, 'renderScale', 0.5, 1.0, 0.05).name('Render Scale').onChange(v => {
        // Manual choice wins: turn auto off so the two don't fight over the framebuffer.
        if (params.autoResolution) { params.autoResolution = false; adaptiveRes.setEnabled(false); gui.controllersRecursive().forEach(c => c.updateDisplay && c.updateDisplay()); }
        applyRenderBudget(v);
    });
    perfFolder.add({ tier: describeTier() }, 'tier').name('Detected Tier').disable();
    // Anti-banding. 0 = off (banding returns), 1 = correct 1-LSB dither, higher = visible grain.
    perfFolder.add({ dither: uDitherAmount.value }, 'dither', 0.0, 3.0, 0.1).name('Dither (anti-band)')
        .onChange(v => uDitherAmount.value = v);
    perfFolder.add(params, 'terrainRes', ['256', '128', '64']).name('Terrain Res').onChange(v => {
        const res = parseInt(v, 10);
        params.terrainRes = String(res);
        const px = playerGrp ? playerGrp.position.x : 0;
        const pz = playerGrp ? playerGrp.position.z : 0;
        if (terrainMeshManager && typeof terrainMeshManager.setResolution === 'function') {
            terrainMeshManager.setResolution(res, px, pz, animeWaterSystem);
            terrainGeo = terrainMeshManager.terrainGeo;
        } else {
            terrainRes = res;
            const newGeo = new THREE.PlaneGeometry(8000, 8000, terrainRes, terrainRes);
            newGeo.rotateX(-Math.PI / 2);
            const count = newGeo.attributes.position.count;
            newGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
            if (terrain) {
                if (terrain.geometry) terrain.geometry.dispose();
                terrain.geometry = newGeo;
            }
            if (terrainMeshManager) {
                terrainMeshManager.terrainGeo = newGeo;
                terrainMeshManager.terrainRes = terrainRes;
            }
            terrainGeo = newGeo;
            lastTerrainGridX = -9999;
            invalidateTerrain();
            if (terrainMeshManager && typeof terrainMeshManager.update === 'function') {
                terrainMeshManager.update(px, pz, animeWaterSystem);
            }
        }
        if (stylizedTrees && typeof stylizedTrees.respawn === 'function') {
            stylizedTrees.respawn();
        }
    });
    perfFolder.add(params, 'shadows').name('Shadows').onChange(v => {
        isShadowsOn = v;
        dirLight.castShadow = isShadowsOn;
    });
    perfFolder.add(params, 'treeShadows').name('Tree Shadows').onChange(v => {
        isTreeShadowsOn = v;
        if (typeof treeMeshes !== 'undefined') treeMeshes.forEach(mesh => mesh.castShadow = isTreeShadowsOn);
    });
    perfFolder.add(params, 'shadowDist', ['Close', 'Med', 'Far']).name('Shadow Dist').onChange(v => {
        shadowDistMode = v;
        if (shadowDistMode === 'Close') { dirLight.shadow.mapSize.width = 1024; dirLight.shadow.mapSize.height = 1024; }
        else if (shadowDistMode === 'Med') { dirLight.shadow.mapSize.width = 2048; dirLight.shadow.mapSize.height = 2048; }
        else { dirLight.shadow.mapSize.width = 4096; dirLight.shadow.mapSize.height = 4096; }
        if (dirLight.shadow.map) { dirLight.shadow.map.dispose(); dirLight.shadow.map = null; }
    });
    perfFolder.add(params, 'bloom').name('Bloom').onChange(v => {
        isBloomOn = v;
        bloomPass.enabled = isBloomOn;
    });
    perfFolder.add({
        saveAll: () => settingsManager.saveSetting()
    }, 'saveAll').name('Save All Settings');
    perfFolder.add({
        resetAll: () => settingsManager.reset()
    }, 'resetAll').name('Reset to Default');


    // Actions for GUI
    const guiActions = {
        switchModel: () => document.getElementById('char-toggle').click(),
        openCrystalEditor: () => {
            const crystalEditor = document.getElementById('crystal-editor');
            if (crystalEditor) crystalEditor.style.display = crystalEditor.style.display === 'none' ? 'block' : 'none';
        },
        toggleMusic: () => document.getElementById('music-toggle').click(),
        nextTrack: () => document.getElementById('track-toggle').click(),
        fullscreen: () => document.getElementById('fullscreen-toggle').click()
    };
    
    // Add Navigation folder (Go To Biome)
    const navFolder = gui.addFolder('Navigation');
    navFolder.domElement.classList.add('nav-biome-grid');
    const navStyle = document.createElement('style');
    navStyle.textContent = '.nav-biome-grid:not(.closed) > .children { display: grid !important; grid-template-columns: 1fr 1fr; gap: 0; }';
    document.head.appendChild(navStyle);
    const navParams = { maxAltitude: 3500 };
    ZONES.forEach(zn => {
        navParams[zn.name] = () => {
            teleportToBiome(zn.name);
        };
        const ctrl = navFolder.add(navParams, zn.name).name(`${zn.name}`);
        ctrl.domElement.style.minWidth = '0';
    });
    navFolder.add({ rerollSeed: () => {
        const newSeed = Math.floor(Math.random() * 1000000);
        setWorldSeed(newSeed);
        invalidateTerrain();
        if (window.stylizedTrees) window.stylizedTrees.respawn();
        showVisualToast(`New World Seed: #${newSeed}`);
    }}, 'rerollSeed').name('New World (Re-Roll Seed)');
    navFolder.add(navParams, 'maxAltitude', 500, 15000, 100).name('Max Altitude').onChange(v => {
        if (playerPhysics) playerPhysics.maxAltitude = v;
    });

    // Add Terrain Heights & Scales Editor Folder (001 Style)
    const terrainTuningFolder = gui.addFolder('Terrain Heights & Scales');

    terrainTuningFolder.add(globalTerrainParams, 'globalHeightMultiplier', 0.1, 5.0, 0.05).name('Global Height Scale').onChange(() => {
        invalidateTerrain();
    });
    terrainTuningFolder.add(globalTerrainParams, 'globalNoiseScale', 0.1, 5.0, 0.05).name('Global Noise Scale').onChange(() => {
        invalidateTerrain();
    });
    waterHeightController = terrainTuningFolder.add(globalWaterParam, 'waterHeight', -20.0, 50.0, 0.1).name('Water Height').onChange(v => {
        const playerX = (typeof playerGrp !== 'undefined' && playerGrp && playerGrp.position) ? playerGrp.position.x : 0;
        const playerZ = (typeof playerGrp !== 'undefined' && playerGrp && playerGrp.position) ? playerGrp.position.z : 0;
        const currentTarget = getWorldWaterHeight(playerX, playerZ);
        globalWaterHeightOffset = v - currentTarget;

        if (animeWaterSystem) {
            animeWaterSystem.setHeight(v);
        }
        invalidateTerrain();
    });

    const heightSubFolder = terrainTuningFolder.addFolder('Height Multipliers');
    const scaleSubFolder = terrainTuningFolder.addFolder('Noise Scale Factors');
    const waterSubFolder = terrainTuningFolder.addFolder('Water Heights');

    const biomesList = ['Archipelago', 'Ghibli Land', 'Misty Mountains', 'Lush Jungle', 'Crystal Land', 'Magical Sanctuary', 'Desert Dunes', 'North Pole'];
    biomesList.forEach(bName => {
        if (biomeHeights[bName] !== undefined) {
            heightSubFolder.add(biomeHeights, bName, 0.1, 3.0, 0.05).name(bName).onChange(() => {
                invalidateTerrain();
            });
        }
        if (biomeScales[bName] !== undefined) {
            scaleSubFolder.add(biomeScales, bName, 0.2, 3.0, 0.05).name(bName).onChange(() => {
                invalidateTerrain();
            });
        }
        if (biomeWaterHeights[bName] !== undefined) {
            waterSubFolder.add(biomeWaterHeights, bName, -20.0, 50.0, 0.1).name(bName).onChange(() => {
                invalidateTerrain();
            });
        }
    });

    // Add Editor folder (Tree Placement Editor, Crystals, Archipelago)
    const editorFolder = gui.addFolder('Editor');
    editorFolder.add({ toggleTreeEditor: () => {
        if (window.treePlacementEditor && typeof window.treePlacementEditor.toggle === 'function') {
            window.treePlacementEditor.toggle();
        } else if (typeof window.toggleTerrainEditor === 'function') {
            window.toggleTerrainEditor();
        }
    }}, 'toggleTreeEditor').name('Tree Placement Editor');

    editorFolder.add({ teleportToForest: () => {
        if (typeof teleportToBiome === 'function') {
            teleportToBiome('Ghibli Land');
        } else if (playerGrp) {
            playerGrp.position.set(0, 45, 18000);
        }
        if (window.stylizedTrees) window.stylizedTrees.respawn();
    }}, 'teleportToForest').name('Teleport to Forest');

    editorFolder.add({ openCrystalEditor: () => {
        const crystalEditor = document.getElementById('crystal-editor');
        if (crystalEditor) crystalEditor.style.display = crystalEditor.style.display === 'none' ? 'block' : 'none';
    }}, 'openCrystalEditor').name('Edit Crystals');
    editorFolder.add({ openArchipelagoEditor: () => {
        if (window.archipelagoEditor) window.archipelagoEditor.toggle();
    }}, 'openArchipelagoEditor').name('Archipelago Studio Editor');

    editorFolder.add({ loadCustomModel: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.glb,.gltf';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file && window.loadCustomModelInGame) {
                window.loadCustomModelInGame(file);
            }
        };
        input.click();
    }}, 'loadCustomModel').name('Load Custom Toon Model');

    customModelFolder = editorFolder.addFolder('Custom Model');
    customModelFolder.close();
    if (typeof window !== 'undefined') window.customModelFolder = customModelFolder;

    params.selectedModelIdx = 0;
    modelDropdownController = customModelFolder.add(params, 'selectedModelIdx', { 'No models': 0 }).name('Active Model').onChange(v => {
        if (typeof window.setSelectedModelIndex === 'function') {
            window.setSelectedModelIndex(v);
        } else if (typeof window.selectedModelIndex !== 'undefined') {
            window.selectedModelIndex = v;
        }
        if (window.syncSlidersToSelectedModel) window.syncSlidersToSelectedModel();
    });
    if (typeof window !== 'undefined') window.modelDropdownController = modelDropdownController;
    if (typeof window !== 'undefined') window.customModelControllers = customModelControllers;

    params.customModelScale = 1.0;
    params.customModelY = 0.0;
    params.customModelX = 0.0;
    params.customModelZ = 0.0;
    params.customModelRot = 0;

    const getSelectedModel = () => {
        const models = window.loadedCustomModels || [];
        const idx = typeof window.getSelectedModelIndex === 'function' ? window.getSelectedModelIndex() : (window.selectedModelIndex !== undefined ? window.selectedModelIndex : -1);
        return models[idx];
    };

    customModelControllers.scale = customModelFolder.add(params, 'customModelScale', 0.1, 5.0, 0.05).name('Scale multiplier').onChange(v => {
        const model = getSelectedModel();
        if (model) {
            model.userData.scaleMult = v;
            if (window.updateCustomModelTransform) window.updateCustomModelTransform(model);
        }
    });
    customModelControllers.y = customModelFolder.add(params, 'customModelY', -15.0, 30.0, 0.1).name('Height offset').onChange(v => {
        const model = getSelectedModel();
        if (model) {
            model.userData.offsetY = v;
            if (window.updateCustomModelTransform) window.updateCustomModelTransform(model);
        }
    });
    customModelControllers.x = customModelFolder.add(params, 'customModelX', -2000.0, 2000.0, 0.5).name('Position X').onChange(v => {
        const model = getSelectedModel();
        if (model) {
            model.userData.offsetX = v;
            if (window.updateCustomModelTransform) window.updateCustomModelTransform(model);
        }
    });
    customModelControllers.z = customModelFolder.add(params, 'customModelZ', -2000.0, 2000.0, 0.5).name('Position Z').onChange(v => {
        const model = getSelectedModel();
        if (model) {
            model.userData.offsetZ = v;
            if (window.updateCustomModelTransform) window.updateCustomModelTransform(model);
        }
    });
    customModelControllers.rot = customModelFolder.add(params, 'customModelRot', 0, 360, 5).name('Rotation Y').onChange(v => {
        const model = getSelectedModel();
        if (model) {
            model.userData.rotationY = v * Math.PI / 180;
            if (window.updateCustomModelTransform) window.updateCustomModelTransform(model);
        }
    });

    customModelFolder.add({ cloneModel: () => {
        if (window.cloneSelectedModel) window.cloneSelectedModel();
    }}, 'cloneModel').name('Clone Selected');

    customModelFolder.add({ deleteModel: () => {
        if (window.deleteSelectedModel) window.deleteSelectedModel();
    }}, 'deleteModel').name('Delete Selected');

    // Flight Models Folder
    flightFolder = gui.addFolder('Flight Models');
    const flightModelOptions = {};
    FLIGHT_MODELS.forEach(m => {
        flightModelOptions[m.name] = m.id;
    });
    const flightParams = {
        modelId: 'psx_saviola_s21',
        animSpeed: 1.0,
        nextModel: () => { if (typeof flightModelManager !== 'undefined' && flightModelManager) flightModelManager.nextModel(); },
        prevModel: () => { if (typeof flightModelManager !== 'undefined' && flightModelManager) flightModelManager.prevModel(); }
    };
    flightModelDropdownController = flightFolder.add(flightParams, 'modelId', flightModelOptions)
        .name('Active Model')
        .onChange(id => {
            if (typeof flightModelManager !== 'undefined' && flightModelManager) {
                const cur = flightModelManager.getCurrentConfig();
                if (!cur || cur.id !== id) {
                    flightModelManager.setModelById(id);
                }
            }
        });
    flightFolder.add(flightParams, 'nextModel').name('Next Model');
    flightFolder.add(flightParams, 'prevModel').name('Previous Model');
    flightFolder.add(params, 'modelVisible').name('Model Visible').onChange(v => {
        if (typeof toggleModelVisibility === 'function') {
            toggleModelVisibility(v);
        } else if (flightModelManager && flightModelManager.modelRoot) {
            flightModelManager.modelRoot.visible = v;
        }
    });
    flightFolder.add(flightParams, 'animSpeed', 0.1, 3.0, 0.1).name('Anim Speed').onChange(v => {
        if (typeof flightModelManager !== 'undefined' && flightModelManager) flightModelManager.setAnimSpeed(v);
    });
    flightFolder.add(params, 'showDistanceOverlay').name('Distance Rings (100-1000m)').listen().onChange(v => {
        const overlay = distanceOverlay || (typeof window !== 'undefined' ? window.distanceOverlay : null);
        if (overlay) overlay.setVisible(v);
    });

    // Audio & Sound Folder
    audioFolder = gui.addFolder('Audio & Sound');
    const audioParams = {
        soundEnabled: true,
        engineSound: true,
        engineVolume: 0.038,
        music: false,
        autoAdvance: true,
        currentTrack: tracks[0].name,
        nextTrack: () => {
            if (typeof selectMusicTrack === 'function') {
                selectMusicTrack(getCurrentTrackIndex() + 1);
            } else {
                document.getElementById('track-toggle')?.click();
            }
        },
        wind: isWindOn,
        toggleMasterSound: () => { if (typeof setSoundMuted === 'function') setSoundMuted(typeof window.isSoundMuted !== 'undefined' ? !window.isSoundMuted : true); },
        toggleEngineSound: () => { if (typeof setEngineSoundEnabled === 'function') setEngineSoundEnabled(typeof window.isEngineSoundOn !== 'undefined' ? !window.isEngineSoundOn : true); }
    };
    soundMuteController = audioFolder.add(audioParams, 'soundEnabled')
        .name('Sound Enabled')
        .onChange(v => {
            if (typeof setSoundMuted === 'function') {
                setSoundMuted(!v);
            } else if (typeof window.isSoundMuted !== 'undefined') {
                window.isSoundMuted = !v;
            }
        });
    engineSoundController = audioFolder.add(audioParams, 'engineSound')
        .name('Biplane Engine Sound')
        .onChange(v => {
            if (typeof setEngineSoundEnabled === 'function') {
                setEngineSoundEnabled(v);
            } else if (typeof window.isEngineSoundOn !== 'undefined') {
                window.isEngineSoundOn = v;
            }
        });
    audioFolder.add(audioParams, 'engineVolume', 0.0, 0.2, 0.005)
        .name('Engine Volume')
        .onChange(v => {
            if (typeof biplaneAudio !== 'undefined' && biplaneAudio) biplaneAudio.setVolume(v);
        });
    audioFolder.add(audioParams, 'music').name('Music').onChange(v => {
        const btn = document.getElementById('music-toggle');
        if (btn) btn.click();
    });
    audioFolder.add(audioParams, 'autoAdvance').name('Auto-Advance Songs').onChange(v => {
        setAutoAdvance(v);
    });
    trackDropdownController = audioFolder.add(audioParams, 'currentTrack', tracks.map(t => t.name))
        .name('Current Track')
        .onChange(name => {
            const idx = tracks.findIndex(t => t.name === name);
            if (idx !== -1 && idx !== getCurrentTrackIndex() && typeof selectMusicTrack === 'function') {
                selectMusicTrack(idx);
            }
        });
    audioFolder.add(audioParams, 'nextTrack').name('Next Track');
    audioFolder.add(params, 'wind').name('Wind Sound').onChange(v => {
        isWindOn = v;
    });
    audioFolder.add(audioParams, 'toggleMasterSound').name('Toggle Master Sound');
    audioFolder.add(audioParams, 'toggleEngineSound').name('Toggle Engine Sound');

    // =========================================================================
    // Dedicated Stylized Pine Trees Settings Folder (Sandbox Integrated)
    // =========================================================================
    const stylizedTreeFolder = gui.addFolder('Stylized Trees');
    const _pines = () => window.stylizedTrees;
    const _respawnPines = () => { if (_pines()) _pines().respawn(); };

    const pineParams = {
        visible: true,
        renderMode: 'Full Draco GLBs',
        shadeMode: 'Standard Stylized (Default)',
        tier: 'Ultra (70K)',
        preset: 'spring',
        scale: 1.0,
        density: 1.1,
        minSpacing: 18.0,
        minElevation: 5.5,
        maxElevation: 140.0,
        // Leaf Canopy Shaders
        leafBottom: 0x14351d,
        leafTop: 0x4c8632,
        leafVarColor: 0x1a4c28,
        leafBrightness: 1.05,
        leafGradPower: 1.05,
        leafVarStrength: 0.40,
        // Wind Sway & Flutter
        windStrength: 0.12,
        windSpeed: 1.1,
        flutterAmp: 0.02,
        flutterSpeed: 2.0,
        pendulumDip: 0.03,
        // 4 Species Toon Variations
        var1Top: 0x4e8032,
        var1Bottom: 0x0e2616,
        var2Top: 0x6e9432,
        var2Bottom: 0x1c2810,
        var3Top: 0x448a70,
        var3Bottom: 0x0c2420,
        var4Top: 0x82a438,
        var4Bottom: 0x222810,
        // Trunk Bark Shaders
        barkScale: 5.6,
        barkBrightness: 1.45,
        barkAOStrength: 0.45,
        barkBase: 0x24160c,
        barkTop: 0x5c3a21,
        // Far Billboard & Impostor Trees
        impostorsEnabled: true,
        impostorDistance: 300.0,
        impostorDensity: 1.0,
        impostorWidth: 1.65,
        overheadCanopy: true,
        overheadThreshold: 65.0,
        counts: '-'
    };

    stylizedTreeFolder.add(pineParams, 'visible').name('Trees Enabled').onChange(v => {
        if (_pines()) _pines().setVisible(v);
    });
    stylizedTreeFolder.add(pineParams, 'shadeMode', ['Standard Stylized (Default)', 'Game Toon Shader (Cel)']).name('Shading Mode').onChange(v => {
        if (_pines()) {
            const modeKey = (v.includes('Cel') || v.includes('Toon')) ? 'toon' : 'standard';
            _pines().setShadeMode(modeKey);
        }
    });
    stylizedTreeFolder.add(pineParams, 'renderMode', ['Full Draco GLBs', 'Hybrid (Hero + Procedural)', 'Fully Procedural']).name('Tree Mode').onChange(v => {
        if (_pines()) {
            const modeKey = (v === 'Full Draco GLBs') ? 'draco' : (v === 'Hybrid (Hero + Procedural)' ? 'hybrid' : 'procedural');
            _pines().setTreeRenderMode(modeKey);
        }
    });
    stylizedTreeFolder.add(pineParams, 'preset', ['spring', 'autumn', 'winter', 'auto']).name('Season Preset').onChange(v => {
        if (_pines()) _pines().setPreset(v);
    });

    stylizedTreeFolder.add({ openTreeEditor: () => {
        if (window.treePlacementEditor && typeof window.treePlacementEditor.toggle === 'function') {
            window.treePlacementEditor.toggle();
        }
    }}, 'openTreeEditor').name('Open Tree Placement Editor');

    // 1. Leaf Canopy Shaders Folder
    const canopyFolder = stylizedTreeFolder.addFolder('Leaf Canopy Shaders');
    canopyFolder.add(pineParams, 'leafBrightness', 0.2, 3.0, 0.05).name('Brightness').onChange(v => {
        if (_pines()) _pines().uLeafBrightness.value = v;
    });
    canopyFolder.add(pineParams, 'leafGradPower', 0.2, 4.0, 0.1).name('Gradient Power').onChange(v => {
        if (_pines()) _pines().uLeafGradPower.value = v;
    });

    // 2. 4 Species Toon Variations Folder (100% GPU Uniforms, 0 Extra Draw Calls)
    const hueFolder = stylizedTreeFolder.addFolder('Species Variations (4 Toon Palettes)');
    const v1 = hueFolder.addFolder('Variation 1 (Alpine Spruce)');
    v1.addColor(pineParams, 'var1Top').name('Sunlit Outer').onChange(c => {
        if (_pines()) _pines().uVar1Top.value.set(c);
    });
    v1.addColor(pineParams, 'var1Bottom').name('Shadow Inner').onChange(c => {
        if (_pines()) _pines().uVar1Bottom.value.set(c);
    });

    const v2 = hueFolder.addFolder('Variation 2 (Highland Olive)');
    v2.addColor(pineParams, 'var2Top').name('Sunlit Outer').onChange(c => {
        if (_pines()) _pines().uVar2Top.value.set(c);
    });
    v2.addColor(pineParams, 'var2Bottom').name('Shadow Inner').onChange(c => {
        if (_pines()) _pines().uVar2Bottom.value.set(c);
    });

    const v3 = hueFolder.addFolder('Variation 3 (Mountain Teal)');
    v3.addColor(pineParams, 'var3Top').name('Sunlit Outer').onChange(c => {
        if (_pines()) _pines().uVar3Top.value.set(c);
    });
    v3.addColor(pineParams, 'var3Bottom').name('Shadow Inner').onChange(c => {
        if (_pines()) _pines().uVar3Bottom.value.set(c);
    });

    const v4 = hueFolder.addFolder('Variation 4 (Sunlit Gold)');
    v4.addColor(pineParams, 'var4Top').name('Sunlit Outer').onChange(c => {
        if (_pines()) _pines().uVar4Top.value.set(c);
    });
    v4.addColor(pineParams, 'var4Bottom').name('Shadow Inner').onChange(c => {
        if (_pines()) _pines().uVar4Bottom.value.set(c);
    });

    // 3. Wind Sway & Flutter Folder
    const windFolder = stylizedTreeFolder.addFolder('Wind Sway & Flutter');
    windFolder.add(pineParams, 'windStrength', 0.0, 1.0, 0.01).name('Wind Strength').onChange(v => {
        if (_pines()) _pines().uWindStrength.value = v;
    });
    windFolder.add(pineParams, 'windSpeed', 0.1, 4.0, 0.05).name('Wind Speed').onChange(v => {
        if (_pines()) _pines().uWindSpeed.value = v;
    });
    windFolder.add(pineParams, 'flutterAmp', 0.0, 0.1, 0.005).name('Flutter Amplitude').onChange(v => {
        if (_pines()) _pines().uLeafFlutterAmp.value = v;
    });
    windFolder.add(pineParams, 'flutterSpeed', 0.5, 8.0, 0.1).name('Flutter Speed').onChange(v => {
        if (_pines()) _pines().uLeafFlutterSpeed.value = v;
    });
    windFolder.add(pineParams, 'pendulumDip', 0.0, 0.2, 0.01).name('Pendulum Dip').onChange(v => {
        if (_pines()) _pines().uLeafDip.value = v;
    });

    // 3. Trunk Bark Shaders Folder
    const barkFolder = stylizedTreeFolder.addFolder('Trunk Bark Shaders');
    barkFolder.add(pineParams, 'barkScale', 1.0, 15.0, 0.1).name('Texture Scale').onChange(v => {
        if (_pines()) _pines().uBarkScale.value = v;
    });
    barkFolder.add(pineParams, 'barkBrightness', 0.2, 3.0, 0.05).name('Brightness').onChange(v => {
        if (_pines()) _pines().uBarkBrightness.value = v;
    });
    barkFolder.add(pineParams, 'barkAOStrength', 0.0, 1.0, 0.05).name('AO Strength').onChange(v => {
        if (_pines()) _pines().uBarkAOStrength.value = v;
    });
    barkFolder.addColor(pineParams, 'barkBase').name('Trunk Base (Shadow)').onChange(c => {
        if (_pines()) _pines().uBarkBase.value.set(c);
    });
    barkFolder.addColor(pineParams, 'barkTop').name('Trunk Top (Lit)').onChange(c => {
        if (_pines()) _pines().uBarkTop.value.set(c);
    });

    // 4. Procedural Placement Folder
    const placementFolder = stylizedTreeFolder.addFolder('Dual-Noise Placement');
    placementFolder.add(pineParams, 'scale', 0.2, 3.5, 0.05).name('Tree Scale').onChange(v => {
        if (_pines()) { _pines().scaleMul = v; _respawnPines(); }
    });
    placementFolder.add(pineParams, 'density', 0.1, 5.0, 0.05).name('Density Multiplier').onChange(v => {
        if (_pines()) { _pines().density = v; _respawnPines(); }
    });
    placementFolder.add(pineParams, 'minSpacing', 6.0, 50.0, 1.0).name('Poisson Spacing (m)').onChange(v => {
        if (_pines()) _pines().setCellSize(v);
    });
    placementFolder.add(pineParams, 'minElevation', 0.0, 50.0, 0.5).name('Min Elevation (m)').onChange(v => {
        if (_pines()) { _pines().minElevation = v; _respawnPines(); }
    });
    placementFolder.add(pineParams, 'maxElevation', 20.0, 200.0, 1.0).name('Max Elevation (m)').onChange(v => {
        if (_pines()) { _pines().maxElevation = v; _respawnPines(); }
    });
    placementFolder.add({ respawn: _respawnPines }, 'respawn').name('Respawn Forest');

    // 5. Far Billboard & Impostor Trees Folder (> 250m)
    const impostorFolder = stylizedTreeFolder.addFolder('Far Billboard & Impostor Trees');
    impostorFolder.add(pineParams, 'impostorsEnabled').name('Enable Far Billboards').onChange(v => {
        if (_pines()) { _pines().impostorsEnabled = v; _respawnPines(); }
    });
    impostorFolder.add(pineParams, 'impostorDistance', 80.0, 700.0, 10.0).name('Billboard Distance (m)').onChange(v => {
        if (_pines()) { _pines().setImpostorDistance(v); }
    });
    impostorFolder.add(pineParams, 'impostorDensity', 0.1, 5.0, 0.05).name('Billboard Density').onChange(v => {
        if (_pines()) { _pines().setImpostorDensity(v); }
    });
    impostorFolder.add(pineParams, 'impostorWidth', 0.8, 3.0, 0.05).name('Billboard Width Scale').onChange(v => {
        if (_pines()) { _pines().setImpostorWidth(v); }
    });
    impostorFolder.add(pineParams, 'overheadCanopy').name('Overhead Flight Canopy').onChange(v => {
        if (_pines()) { _pines().setOverheadCanopyEnabled(v); }
    });
    impostorFolder.add(pineParams, 'overheadThreshold', 20.0, 200.0, 5.0).name('Overhead Trigger Alt (m)').onChange(v => {
        if (_pines()) { _pines().overheadAltThreshold = v; _respawnPines(); }
    });

    const liveTreeCountCtrl = stylizedTreeFolder.add(pineParams, 'counts').name('Active Trees (2 Draw Calls)').disable();

    setInterval(() => {
        if (_pines() && _pines().lastCounts) {
            const c = _pines().lastCounts;
            const total = c.total !== undefined ? c.total : (c.main !== undefined ? c.main : ((c.near || 0) + (c.mid || 0) + (c.far || 0)));
            pineParams.counts = `${total} trees`;
            if (liveTreeCountCtrl) liveTreeCountCtrl.updateDisplay();
        }
    }, 700);

    function setGodMode(enabled) {
        const target = typeof enabled === 'boolean' ? enabled : !isGodMode;
        if (isGodMode === target) return;
        isGodMode = target;
        params.godMode = isGodMode;

        if (isGodMode) {
            if (!isStudio) {
                if (typeof params !== 'undefined') {
                    params.groundFog = false;
                    params.godRays = false;
                    if (typeof isWindTrailsOn !== 'undefined') params.trails = false;
                    params.wind = false;
                    params.rain = false;
                    params.sceneFog = false;
                    params.showClouds = false;
                }
                // Automatically hide cloud layers only in raw God Mode
                if (typeof instClouds !== 'undefined') instClouds.visible = false;
                if (typeof instHighClouds !== 'undefined') instHighClouds.visible = false;
                if (typeof instWispyClouds !== 'undefined') instWispyClouds.visible = false;
                if (typeof instMegaClouds !== 'undefined') instMegaClouds.visible = false;
                if (typeof toonCloudMat !== 'undefined' && toonCloudMat.uniforms && toonCloudMat.uniforms.uEnableClouds) toonCloudMat.uniforms.uEnableClouds.value = 0.0;

                if (typeof scene !== 'undefined' && scene.fog) { scene.fog.near = 100000; scene.fog.far = 200000; }
                if (typeof groundFog !== 'undefined') groundFog.visible = false;
                if (typeof godRaysGroup !== 'undefined') godRaysGroup.visible = false;
                if (typeof windTrailsGroup !== 'undefined') windTrailsGroup.visible = false;
            }
            
            // Do not auto-expand folders programmatically
            isFlightPaused = true;
            const pauseToggle = document.getElementById('pause-toggle');
            if (pauseToggle) {
                pauseToggle.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
            }

            if (!godCamera) {
                const gm = setupGodMode(scene, cameraBase, renderer, playerGrp);
                godCamera = gm.godCamera;
                godControls = gm.godControls;
            }
            const curWaterY = (animeWaterSystem && animeWaterSystem.waterLevel !== undefined) ? animeWaterSystem.waterLevel : 2.4;
            toggleGodMode(isGodMode, godCamera, camera, godControls, playerGrp, (cam) => {
                if (typeof scenePass !== 'undefined' && scenePass) scenePass.camera = cam;
            }, curWaterY);
        } else {
            if (typeof params !== 'undefined') {
                params.showClouds = true;
            }
            if (typeof instClouds !== 'undefined') instClouds.visible = true;
            if (typeof instHighClouds !== 'undefined') instHighClouds.visible = true;
            if (typeof instWispyClouds !== 'undefined') instWispyClouds.visible = true;
            if (typeof instMegaClouds !== 'undefined') instMegaClouds.visible = true;
            if (typeof toonCloudMat !== 'undefined' && toonCloudMat.uniforms && toonCloudMat.uniforms.uEnableClouds) toonCloudMat.uniforms.uEnableClouds.value = 1.0;

            const curWaterY = (animeWaterSystem && animeWaterSystem.waterLevel !== undefined) ? animeWaterSystem.waterLevel : 2.4;
            toggleGodMode(isGodMode, godCamera, camera, godControls, playerGrp, (cam) => {
                if (typeof scenePass !== 'undefined' && scenePass) scenePass.camera = cam;
            }, curWaterY);
        }

        const btn = document.getElementById('god-mode-btn');
        if (btn) {
            btn.innerText = isGodMode ? 'God Mode: ON' : 'God Mode: OFF';
            btn.style.color = isGodMode ? '#ff4444' : 'rgba(255, 255, 255, 0.95)';
            btn.style.textShadow = isGodMode ? '0 0 10px rgba(255, 68, 68, 0.9), 0 1px 3px rgba(0, 0, 0, 0.5)' : '0 1px 3px rgba(0, 0, 0, 0.35), 0 0 8px rgba(0, 0, 0, 0.2)';
            btn.style.transform = isGodMode ? 'scale(1.15)' : 'scale(1.0)';
            btn.title = isGodMode ? 'God Mode: ON (Free Camera Active) [G]' : 'Toggle God Mode (Free Camera) [G]';
        }

        if (typeof gui !== 'undefined' && gui) {
            gui.controllersRecursive().forEach(c => {
                if (c.property === 'godMode') c.updateDisplay();
            });
        }
    }
    window.setGodMode = setGodMode;

    function setAllFogEnabled(enabled) {
        params.showFog = enabled;
        params.sceneFog = enabled;
        params.fogPlane = enabled;
        params.showFogPlanes = enabled;
        if (!enabled) {
            if (typeof scene !== 'undefined' && scene.fog) {
                scene.fog.near = 100000;
                scene.fog.far = 200000;
            }
            if (typeof window.fogGroup !== 'undefined') {
                window.fogGroup.visible = false;
            }
            if (typeof groundFog !== 'undefined') {
                groundFog.visible = false;
            }
        } else {
            if (typeof scene !== 'undefined' && scene.fog && typeof playerGrp !== 'undefined' && playerGrp.position) {
                const biomeFog = (window.groundFogEditor && window.groundFogEditor.runtimeState) ? window.groundFogEditor.runtimeState : null;
                const baseNear = (biomeFog && biomeFog.distNear !== undefined) ? biomeFog.distNear : (params.fogNear !== undefined ? params.fogNear : 80);
                const baseFar = (biomeFog && biomeFog.distFar !== undefined) ? biomeFog.distFar : (params.fogFar !== undefined ? params.fogFar : 1800);
                const density = (biomeFog && biomeFog.distDensity !== undefined) ? biomeFog.distDensity : (params.fogDensity !== undefined ? params.fogDensity : 1.0);
                scene.fog.near = baseNear / Math.max(0.1, density);
                scene.fog.far = baseFar / Math.max(0.1, density);
            }
            if (typeof window.fogGroup !== 'undefined') {
                window.fogGroup.visible = true;
            }
        }

        if (window.groundFogEditor) {
            window.groundFogEditor.runtimeState.enabled = enabled;
            const curCfg = window.groundFogEditor.getCurrentConfig();
            if (curCfg) {
                curCfg.enabled = enabled;
                window.groundFogEditor.saveConfigsToStorage();
            }
            if (window.groundFogEditor.visible) {
                window.groundFogEditor.syncUI();
            }
        }

        if (typeof gui !== 'undefined' && gui) {
            gui.controllersRecursive().forEach(c => {
                if (c.property === 'sceneFog' || c.property === 'showFog' || c.property === 'fogPlane' || c.property === 'showFogPlanes') {
                    c.updateDisplay();
                }
            });
        }
    }
    window.setAllFogEnabled = setAllFogEnabled;

    const debugFolder = gui.addFolder('Debug Render');
    debugFolder.add(params, 'godMode').name('God Mode (Free Cam) [G]').listen().onChange(v => setGodMode(v));
    if (params.cameraFov === undefined) params.cameraFov = 60;
    debugFolder.add(params, 'cameraFov', 5, 100, 1).name('Camera FOV / Zoom [Z]').listen().onChange(v => {
        camera.fov = v;
        camera.updateProjectionMatrix();
        if (godCamera) {
            godCamera.fov = v;
            godCamera.updateProjectionMatrix();
        }
    });
    debugFolder.add(params, 'showProceduralSky').name('Procedural Sky').onChange(v => {
        if (typeof window.setSkyRenderMode === 'function') {
            if (!v) {
                window.setSkyRenderMode('Flat Solid');
            } else {
                window.setSkyRenderMode(params.enableProceduralClouds ? 'Gradient + Clouds' : 'Gradient Regular');
            }
        }
    });
    debugFolder.add(params, 'skyRenderMode', ['Gradient + Clouds', 'Gradient Regular', 'Flat Solid'])
        .name('Sky Mode')
        .onChange(v => {
            if (typeof window.setSkyRenderMode === 'function') window.setSkyRenderMode(v);
        });

    debugFolder.add(params, 'showTerrain').name('Terrain').onChange(v => { terrain.visible = v; });

    debugFolder.add(params, 'showWater').name('Ocean Visible').onChange(v => {
        if (animeWaterSystem) animeWaterSystem.setVisible(v);
    });

    debugFolder.add(params, 'showTrees').name('Trees').onChange(v => { treeMeshes.forEach(m => m.visible = v); if(typeof instBillboardTrees !== 'undefined') instBillboardTrees.visible = false; if(typeof instJungleBillboardTrees !== 'undefined') instJungleBillboardTrees.visible = false; if(window.instJungleTreeParts) window.instJungleTreeParts.forEach(m => m.visible = v); if(window.instPalmTreeParts) window.instPalmTreeParts.forEach(m => m.visible = v); });
    function updateCloudScale(instMesh, newMulti, oldMulti) {
        if (typeof instMesh === 'undefined') return;
        const ratio = newMulti / oldMulti;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < instMesh.count; i++) {
            instMesh.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
            dummy.scale.multiplyScalar(ratio);
            dummy.updateMatrix();
            instMesh.setMatrixAt(i, dummy.matrix);
        }
        instMesh.instanceMatrix.needsUpdate = true;
    }
    debugFolder.add(params, 'showFog').name('All Fog').listen().onChange(v => setAllFogEnabled(v));
    debugFolder.add(params, 'showFogPlanes').name('Fog Planes').listen().onChange(v => { if(typeof window.fogGroup !== 'undefined') window.fogGroup.visible = v; });
    debugFolder.add(params, 'showBirds').name('Birds').onChange(v => {
        if (typeof instBirds !== 'undefined') instBirds.visible = v;
        if (typeof flockGrp !== 'undefined') flockGrp.visible = v;
        if (typeof window.birdFlock !== 'undefined' && window.birdFlock) window.birdFlock.visible = v;
        if (typeof window.flamingoFlock !== 'undefined' && window.flamingoFlock) window.flamingoFlock.visible = v;
    });
    debugFolder.add(params, 'showCrystals').name('Crystals').onChange(v => {
        if (crystalSystem && crystalSystem.instCrystals) crystalSystem.instCrystals.visible = v;
        else if (typeof window.instCrystals !== 'undefined' && window.instCrystals) window.instCrystals.visible = v;
    });

    const shadingFolder = debugFolder.addFolder('Shade Mode');
    shadingFolder.add(params, 'shadeMode', ['original', 'cel', 'flat'])
        .name('Mode (1/2/3)')
        .onChange(v => toonShaderManager.apply(scene, v));

    debugFolder.add(params, 'showMap').name('World Map').onChange(v => { const el = document.getElementById('world-map'); if(el) el.style.display = v ? 'block' : 'none'; });

    // Distance Rings Overlay (100m, 200m, 300m, 400m, 500m, 600m, 1000m)
    const distRingsFolder = debugFolder.addFolder('Distance Rings (100m - 1000m) [K]');
    distRingsFolder.add(params, 'showDistanceOverlay').name('Show Distance Rings [K]').listen().onChange(v => {
        const overlay = distanceOverlay || (typeof window !== 'undefined' ? window.distanceOverlay : null);
        if (overlay) overlay.setVisible(v);
    });
    distRingsFolder.add(params, 'distanceOverlayOpacity', 0.05, 1.0, 0.05).name('Ring Opacity').onChange(v => {
        const overlay = distanceOverlay || (typeof window !== 'undefined' ? window.distanceOverlay : null);
        if (overlay) overlay.setOpacity(v);
    });
    distRingsFolder.addColor(params, 'distanceOverlayColor').name('Ring Color').onChange(v => {
        const overlay = distanceOverlay || (typeof window !== 'undefined' ? window.distanceOverlay : null);
        if (overlay) overlay.setColor(v);
    });
    distRingsFolder.add(params, 'distanceOverlayLabels').name('Distance Labels').onChange(v => {
        const overlay = distanceOverlay || (typeof window !== 'undefined' ? window.distanceOverlay : null);
        if (overlay) overlay.setShowLabels(v);
    });
    distRingsFolder.add(params, 'distanceOverlayGroundDropline').name('Ground Altitude Line').onChange(v => {
        const overlay = distanceOverlay || (typeof window !== 'undefined' ? window.distanceOverlay : null);
        if (overlay && typeof overlay.setShowGroundDropline === 'function') overlay.setShowGroundDropline(v);
    });
    distRingsFolder.add(params, 'distanceOverlayMode', ['Horizontal Level', 'Flight Pitch/Roll', 'World Fixed']).name('Alignment Mode').onChange(v => {
        const overlay = distanceOverlay || (typeof window !== 'undefined' ? window.distanceOverlay : null);
        if (overlay) overlay.setOrientationMode(v);
    });

    // Bird & Flock Settings
    const birdFolder = debugFolder.addFolder('Bird & Flock Settings');
    params.birdCount = LOW_GFX ? 12 : 40;
    params.birdScale = 0.42;
    params.flamingoScale = 0.007;
    params.animatedBirdScale = 0.08;
    params.birdColor = '#d6e5f5';
    params.birdFlockRadius = 22;
    params.birdFlockSpread = 9;
    params.birdMaxSpeed = 35;

    birdFolder.add(params, 'birdCount', 0, 120, 1).name('Bird Count').onChange(v => {
        if (typeof window.instBirds !== 'undefined' && window.instBirds) {
            window.instBirds.count = Math.min(v, window.MAX_BIRD_COUNT || 120);
            window.instBirds.instanceMatrix.needsUpdate = true;
        }
    });
    birdFolder.add(params, 'birdScale', 0.1, 2.0, 0.05).name('Bird Size');
    birdFolder.add(params, 'flamingoScale', 0.001, 0.03, 0.001).name('Flamingo Size').onChange(v => {
        if (typeof window.flamingoFlock !== 'undefined' && window.flamingoFlock) {
            window.flamingoFlock.setScale(v);
        }
    });
    birdFolder.add(params, 'animatedBirdScale', 0.01, 0.25, 0.01).name('Flock Bird Size').onChange(v => {
        if (typeof window.birdFlock !== 'undefined' && window.birdFlock) {
            window.birdFlock.setScale(v);
        }
    });
    birdFolder.addColor(params, 'birdColor').name('Bird Color').onChange(v => {
        if (typeof window.matBird !== 'undefined' && window.matBird) {
            window.matBird.color.set(v);
        }
    });
    birdFolder.add(params, 'birdFlockRadius', 5, 80, 1).name('Flock Radius');
    birdFolder.add(params, 'birdFlockSpread', 1, 30, 1).name('Flock Spread');
    birdFolder.add(params, 'birdMaxSpeed', 10, 80, 1).name('Max Speed');
    birdFolder.close();
    
    function teleportToBiome(biomeName) {
        if (typeof playerGrp === 'undefined') return;
        
        const coords = getBiomeTeleportCoords(biomeName);
        const targetX = coords ? coords.x : 0;
        const targetZ = coords ? coords.z : 0;

        const groundH = getWorldHeight ? getWorldHeight(targetX, targetZ) : 10;
        playerGrp.position.set(targetX, Math.max(35, groundH + 40), targetZ);
        
        invalidateTerrain();
        if (window.stylizedTrees) window.stylizedTrees.respawn();
        
        if (typeof navParams !== 'undefined' && typeof navFolder !== 'undefined') {
            navParams.biome = biomeName;
            navFolder.controllersRecursive().forEach(c => c.updateDisplay());
        }
    }

    function toggleGUI(show) {
        const guiEl = (gui && gui.domElement) || document.getElementById('main-settings-gui');
        if (!guiEl) return;
        
        const isDisplayNone = guiEl.style.display === 'none' || (typeof window !== 'undefined' && window.getComputedStyle(guiEl).display === 'none');
        const isAccordionClosed = guiEl.classList.contains('closed') || (gui && gui._closed);
        const isHeightZero = gui && gui.$children && (gui.$children.style.height === '0px' || (guiEl.style.display !== 'none' && gui.$children.clientHeight === 0));
        
        const shouldBeVisible = typeof show === 'boolean' ? show : (isDisplayNone || isAccordionClosed || isHeightZero);
        
        if (shouldBeVisible) {
            guiEl.style.display = '';
            guiEl.classList.remove('closed');
            guiEl.classList.remove('transition');
            if (gui) {
                gui._closed = false;
                if (gui.$children) gui.$children.style.height = '';
                if (gui.$title) gui.$title.setAttribute('aria-expanded', 'true');
                if (typeof gui.foldersRecursive === 'function') {
                    gui.foldersRecursive().forEach(f => {
                        if (f && f.domElement) f.domElement.classList.remove('transition');
                        if (f && f.$children && !f._closed) f.$children.style.height = '';
                    });
                }
            }
        } else {
            guiEl.style.display = 'none';
            guiEl.classList.remove('transition');
            if (gui && gui.$children) {
                gui.$children.style.height = '';
            }
        }
        params.showGUI = shouldBeVisible;
        
        const cogBtn = document.getElementById('gui-toggle-btn');
        if (cogBtn) {
            cogBtn.style.opacity = shouldBeVisible ? '1' : '0.85';
            cogBtn.style.transform = shouldBeVisible ? 'rotate(45deg)' : 'none';
        }
    }

    debugFolder.add(params, 'showGUI').name('Settings Panel').onChange(v => toggleGUI(v));
    debugFolder.add(params, 'godRays').name('God Rays').onChange(v => { godRaysPass.enabled = v; });
    debugFolder.add(params, 'godRayIntensity', 0, 2, 0.05).name('Ray Intensity').onChange(v => { godRaysPass.uniforms.uIntensity.value = v; });

    const guiToggleBtn = document.getElementById('gui-toggle-btn');
    if (guiToggleBtn) {
        guiToggleBtn.addEventListener('click', () => toggleGUI());
    }
    
    window.toggleGUI = toggleGUI;
    if (isStudio) {
        toggleGUI(true);
        if (gui) gui.close();
    } else {
        toggleGUI(false);
    }

    function openOceanInGui() {
        toggleGUI(true);
        if (animeWaterGUI && animeWaterGUI.gui) {
            animeWaterGUI.gui.open();
            animeWaterGUI.gui.domElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    const oceanToggleBtn = document.getElementById('ocean-toggle-btn');
    if (oceanToggleBtn) {
        oceanToggleBtn.addEventListener('click', () => {
            if (window.waterModalUI) {
                window.waterModalUI.toggle();
            } else if (window.summonWaterModal) {
                window.summonWaterModal(true);
            } else {
                openOceanInGui();
            }
        });
    }

    window.addEventListener('keydown', (e) => {
        if ((e.key === 'F2' || e.key === 'f2') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            toggleGUI();
        }
        if ((e.key === 'o' || e.key === 'O') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            if (window.waterModalUI) {
                window.waterModalUI.toggle();
            } else if (window.summonWaterModal) {
                window.summonWaterModal(true);
            } else {
                openOceanInGui();
            }
        }
        if ((e.key === 'g' || e.key === 'G') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            setGodMode();
        }
        if ((e.key === 'k' || e.key === 'K') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            if (typeof window.toggleDistanceOverlay === 'function') {
                window.toggleDistanceOverlay();
            } else if (distanceOverlay) {
                const nextVal = !params.showDistanceOverlay;
                params.showDistanceOverlay = nextVal;
                distanceOverlay.setVisible(nextVal);
                showVisualToast(nextVal ? 'Distance Rings: ON' : 'Distance Rings: OFF');
                gui.controllersRecursive().forEach(c => {
                    if (c.property === 'showDistanceOverlay' && typeof c.updateDisplay === 'function') c.updateDisplay();
                });
            }
        }
    });

    // Shade mode hotkeys: 1=original, 2=hard cel, 3=flat/gouache
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const modeMap = { '1': 'original', '2': 'cel', '3': 'flat' };
        if (modeMap[e.key]) {
            params.shadeMode = modeMap[e.key];
            toonShaderManager.apply(scene, params.shadeMode);
            gui.controllersRecursive().forEach(c => { if (c.property === 'shadeMode') c.updateDisplay(); });
        }
    });

    const fsToggleBtn = document.getElementById('fullscreen-toggle');
    const topFullscreenBtn = document.getElementById('top-fullscreen-btn');

    // Using toggleFullscreen from MinimapHUD.js

    if (fsToggleBtn) {
        fsToggleBtn.addEventListener('click', toggleFullscreen);
    }
    if (topFullscreenBtn) {
        topFullscreenBtn.addEventListener('click', toggleFullscreen);
    }

    const ENTER_FS_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    const EXIT_FS_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';

    function updateFullscreenUI() {
        const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        document.body.classList.toggle('is-fullscreen', isFS);
        document.documentElement.classList.toggle('is-fullscreen', isFS);

        if (fsToggleBtn) {
            fsToggleBtn.innerHTML = isFS ? EXIT_FS_SVG : ENTER_FS_SVG;
            fsToggleBtn.title = isFS ? 'Exit Fullscreen' : 'Toggle Fullscreen';
            fsToggleBtn.setAttribute('aria-label', isFS ? 'Exit Fullscreen' : 'Toggle Fullscreen');
        }
        if (topFullscreenBtn) {
            topFullscreenBtn.innerHTML = isFS ? EXIT_FS_SVG : ENTER_FS_SVG;
            topFullscreenBtn.title = isFS ? 'Exit Fullscreen' : 'Toggle Fullscreen';
            topFullscreenBtn.setAttribute('aria-label', isFS ? 'Exit Fullscreen' : 'Toggle Fullscreen');
        }
    }

    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
        document.addEventListener(evt, updateFullscreenUI);
    });

    const sparkleBtn = document.getElementById('sparkle-btn');
    if (sparkleBtn) {
        sparkleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const charBtn = document.getElementById('char-toggle');
            if (charBtn) charBtn.click();
            sparkleBtn.style.transform = 'scale(1.3) rotate(45deg)';
            setTimeout(() => {
                sparkleBtn.style.transform = '';
            }, 250);
        });
    }
    
    // Mobile Drawer Event Handlers
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileDrawer = document.getElementById('mobile-drawer');
    const drawerMusicBtn = document.getElementById('drawer-music-btn');
    const drawerGodBtn = document.getElementById('drawer-god-btn');
    const normalGodBtn = document.getElementById('god-mode-btn');
    const musicToggleBtn = document.getElementById('music-toggle');
    
    if (mobileMenuBtn && mobileDrawer) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileDrawer.classList.toggle('open');
            mobileMenuBtn.innerText = mobileDrawer.classList.contains('open') ? 'Close' : 'Menu';
        });

        document.addEventListener('click', (e) => {
            if (mobileDrawer.classList.contains('open') && !mobileDrawer.contains(e.target) && e.target !== mobileMenuBtn) {
                mobileDrawer.classList.remove('open');
                mobileMenuBtn.innerText = 'Menu';
            }
        });
    }

    if (drawerMusicBtn && musicToggleBtn) {
        setTimeout(() => {
            drawerMusicBtn.innerText = musicToggleBtn.innerText;
        }, 1000);

        drawerMusicBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            musicToggleBtn.click();
            setTimeout(() => {
                drawerMusicBtn.innerText = musicToggleBtn.innerText;
            }, 50);
        });
    }

    if (drawerGodBtn) {
        setTimeout(() => {
            const isGod = isGodMode;
            drawerGodBtn.innerText = isGod ? 'God Mode: ON' : 'God Mode: OFF';
            drawerGodBtn.style.color = isGod ? '#ff4444' : '#ffaa00';
        }, 1000);

        drawerGodBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            setGodMode();
            setTimeout(() => {
                const isGod = isGodMode;
                drawerGodBtn.innerText = isGod ? 'God Mode: ON' : 'God Mode: OFF';
                drawerGodBtn.style.color = isGod ? '#ff4444' : '#ffaa00';
            }, 50);
        });
    }
    
    const pauseToggleBtn = document.getElementById('pause-toggle');
    if (pauseToggleBtn) {
        pauseToggleBtn.addEventListener('click', () => {
            isFlightPaused = !isFlightPaused;
            pauseToggleBtn.innerHTML = isFlightPaused 
                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
                : '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/></svg>';
        });
    }

    if (normalGodBtn) {
        normalGodBtn.addEventListener('click', () => {
            setGodMode();
        });
    }



    const clickRaycaster = new THREE.Raycaster();
    const clickMouse = new THREE.Vector2();



    const trailsToggleBtn = document.getElementById('trails-toggle');
    if (trailsToggleBtn) {
        trailsToggleBtn.addEventListener('click', () => {
            isWindTrailsOn = !isWindTrailsOn;
            trailsToggleBtn.innerText = `Wind Trails: ${isWindTrailsOn ? 'ON' : 'OFF'}`;
        });
    }
    


    window.addEventListener('wheel', (e) => {
        if ((window.editorState && window.editorState.isEditorMode) || (typeof window.isGodMode !== 'undefined' ? window.isGodMode : isGodMode)) return;
        const cm = window.cameraManager || (typeof cameraManager !== 'undefined' ? cameraManager : null);
        let curZoom = (cm && cm.cameraZoomDist !== undefined) ? cm.cameraZoomDist : (window.cameraZoomDist !== undefined ? window.cameraZoomDist : 12.0);
        curZoom += Math.sign(e.deltaY) * 4.0;
        curZoom = Math.max(6.0, Math.min(300.0, curZoom));
        window.cameraZoomDist = curZoom;
        if (cm && typeof cm.setZoom === 'function') cm.setZoom(curZoom);
        localStorage.setItem('wl_zoomDist', curZoom);
    }, { passive: true });
    
    // Add mobile touch handling for two-finger zoom (pinch gesture)
    let gameInitialTouchDistance = null;
    let gameInitialZoom = null;
    window.addEventListener('touchstart', (e) => {
        if ((window.editorState && window.editorState.isEditorMode) || (typeof window.isGodMode !== 'undefined' ? window.isGodMode : isGodMode)) return;
        if (e.touches.length === 2) {
            gameInitialTouchDistance = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY
            );
            const cm = window.cameraManager || (typeof cameraManager !== 'undefined' ? cameraManager : null);
            gameInitialZoom = (cm && cm.cameraZoomDist !== undefined) ? cm.cameraZoomDist : (window.cameraZoomDist !== undefined ? window.cameraZoomDist : 12.0);
        }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if ((window.editorState && window.editorState.isEditorMode) || (typeof window.isGodMode !== 'undefined' ? window.isGodMode : isGodMode)) return;
        if (e.touches.length === 2 && gameInitialTouchDistance !== null && gameInitialZoom !== null) {
            const currentTouchDistance = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY
            );
            if (gameInitialTouchDistance > 0 && currentTouchDistance > 0) {
                const factor = gameInitialTouchDistance / currentTouchDistance;
                let curZoom = gameInitialZoom * factor;
                curZoom = Math.max(6.0, Math.min(300.0, curZoom));
                window.cameraZoomDist = curZoom;
                const cm = window.cameraManager || (typeof cameraManager !== 'undefined' ? cameraManager : null);
                if (cm && typeof cm.setZoom === 'function') cm.setZoom(curZoom);
                localStorage.setItem('wl_zoomDist', curZoom);
            }
        }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            gameInitialTouchDistance = null;
            gameInitialZoom = null;
        }
    }, { passive: true });
    


    // Atmosphere & Environment Master Editor (Appended to lil-gui)
    if (typeof gui !== 'undefined') {
        const atmoParams = {
            skyColor: '#' + envConfigs[0].bg.toString(16).padStart(6, '0'),
            fogColor: '#' + envConfigs[0].fog.toString(16).padStart(6, '0'),
            ambColor: '#' + envConfigs[0].amb.toString(16).padStart(6, '0'),
            dirColor: '#' + envConfigs[0].dir.toString(16).padStart(6, '0'),
            ambI: envConfigs[0].ambI,
            dirI: envConfigs[0].dirI,
            glintCol: '#' + envConfigs[0].glintCol.toString(16).padStart(6, '0')
        };
        
        function updateAtmoParamsFromPhase() {
            const currentPhase = (typeof window.getTimePhase === 'function') ? window.getTimePhase() : ((typeof window.timePhase !== 'undefined') ? window.timePhase : (typeof timePhase !== 'undefined' ? timePhase : 0));
            const cur = envConfigs[currentPhase] || envConfigs[0];
            if (cur) {
                atmoParams.skyColor = '#' + cur.bg.toString(16).padStart(6, '0');
                atmoParams.fogColor = '#' + cur.fog.toString(16).padStart(6, '0');
                atmoParams.ambColor = '#' + cur.amb.toString(16).padStart(6, '0');
                atmoParams.dirColor = '#' + cur.dir.toString(16).padStart(6, '0');
                atmoParams.ambI = cur.ambI;
                atmoParams.dirI = cur.dirI;
                atmoParams.glintCol = '#' + cur.glintCol.toString(16).padStart(6, '0');
                if (cur.sunY !== undefined) {
                    params.sunAltitude = cur.sunY;
                }
                if (atmoFolder) {
                    atmoFolder.controllers.forEach(c => c.updateDisplay());
                }
                if (typeof sunGodRaysFolder !== 'undefined' && sunGodRaysFolder) {
                    sunGodRaysFolder.controllers.forEach(c => c.updateDisplay());
                }
            }
        }
        if (typeof window !== 'undefined') window.updateAtmoParamsFromPhase = updateAtmoParamsFromPhase;
        
        // Listen to phase changes
        const timeToggleEl = document.getElementById('time-toggle');
        if (timeToggleEl) {
            timeToggleEl.addEventListener('click', () => {
                setTimeout(updateAtmoParamsFromPhase, 50);
            });
        }

        // Master Environment Folder
        const envFolder = gui.addFolder('Environment');

        // 1. Atmosphere & Lighting Subfolder
        const atmoFolder = envFolder.addFolder('Atmosphere & Lighting');
        atmoFolder.add(params, 'exposureTrim', 0.4, 2.0, 0.02).name('Global Brightness').onChange(v => {
            gui.controllersRecursive().forEach(c => { if (c.property === 'exposureTrim') c.updateDisplay(); });
        });
        atmoFolder.add(params, 'summerFilter').name('Summer Filter').onChange(v => {
            const btn = document.getElementById('summer-toggle');
            if (btn) btn.click();
        });
        atmoFolder.add(params, 'shadeMode', ['original', 'cel', 'flat'])
            .name('Shade Mode')
            .onChange(v => {
                toonShaderManager.apply(scene, v);
                gui.controllersRecursive().forEach(c => { if (c.property === 'shadeMode') c.updateDisplay(); });
            });
        atmoFolder.addColor(atmoParams, 'skyColor').name('Sky Color').onChange(v => envConfigs[timePhase].bg = parseInt(v.replace('#',''), 16));
        atmoFolder.addColor(atmoParams, 'fogColor').name('Fog Color').onChange(v => envConfigs[timePhase].fog = parseInt(v.replace('#',''), 16));
        atmoFolder.addColor(atmoParams, 'ambColor').name('Ambient Light').onChange(v => envConfigs[timePhase].amb = parseInt(v.replace('#',''), 16));
        atmoFolder.addColor(atmoParams, 'dirColor').name('Sun Light').onChange(v => envConfigs[timePhase].dir = parseInt(v.replace('#',''), 16));
        atmoFolder.add(atmoParams, 'ambI', 0, 3).name('Amb Intensity').onChange(v => envConfigs[timePhase].ambI = v);
        atmoFolder.add(atmoParams, 'dirI', 0, 5).name('Sun Intensity').onChange(v => envConfigs[timePhase].dirI = v);
        atmoFolder.addColor(atmoParams, 'glintCol').name('Water Glint').onChange(v => envConfigs[timePhase].glintCol = parseInt(v.replace('#',''), 16));

        // 2. Sky & Gradients Subfolder
        const gradientSkyFolder = envFolder.addFolder('Sky & Gradients');
        const gradParams = {
            enabled: true,
            zenith: '#' + (skyUniforms.uSkyColorZenith ? skyUniforms.uSkyColorZenith.value.getHexString() : '2a5090'),
            mid: '#' + (skyUniforms.uSkyColorMid ? skyUniforms.uSkyColorMid.value.getHexString() : 'c85078'),
            horizon: '#' + (skyUniforms.uSkyColorHorizon ? skyUniforms.uSkyColorHorizon.value.getHexString() : 'ffa07a'),
            power: 1.2,
            midOffset: 0.22,
            sunCorona: 0.7,
            horizonGlow: 0.45,
            applySunsetGradient: () => {
                gradParams.zenith = '#2a5090';
                gradParams.mid = '#c85078';
                gradParams.horizon = '#ffa07a';
                gradParams.power = 1.2;
                gradParams.midOffset = 0.22;
                if (skyUniforms.uSkyColorZenith) skyUniforms.uSkyColorZenith.value.setHex(0x2a5090);
                if (skyUniforms.uSkyColorMid) skyUniforms.uSkyColorMid.value.setHex(0xc85078);
                if (skyUniforms.uSkyColorHorizon) skyUniforms.uSkyColorHorizon.value.setHex(0xffa07a);
                if (skyUniforms.uGradientPower) skyUniforms.uGradientPower.value = 1.2;
                if (skyUniforms.uGradientMidOffset) skyUniforms.uGradientMidOffset.value = 0.22;
                envConfigs[1].bg = 0x2a5090;
                envConfigs[1].mid = 0xc85078;
                envConfigs[1].fog = 0xffa07a;
                gradientSkyFolder.controllersRecursive().forEach(c => c.updateDisplay());
            },
            applyDayGradient: () => {
                gradParams.zenith = '#4a90d9';
                gradParams.mid = '#7ab4e6';
                gradParams.horizon = '#c8dce8';
                gradParams.power = 1.0;
                gradParams.midOffset = 0.25;
                if (skyUniforms.uSkyColorZenith) skyUniforms.uSkyColorZenith.value.setHex(0x4a90d9);
                if (skyUniforms.uSkyColorMid) skyUniforms.uSkyColorMid.value.setHex(0x7ab4e6);
                if (skyUniforms.uSkyColorHorizon) skyUniforms.uSkyColorHorizon.value.setHex(0xc8dce8);
                if (skyUniforms.uGradientPower) skyUniforms.uGradientPower.value = 1.0;
                if (skyUniforms.uGradientMidOffset) skyUniforms.uGradientMidOffset.value = 0.25;
                envConfigs[0].bg = 0x4a90d9;
                envConfigs[0].mid = 0x7ab4e6;
                envConfigs[0].fog = 0xc8dce8;
                gradientSkyFolder.controllersRecursive().forEach(c => c.updateDisplay());
            }
        };

        gradientSkyFolder.add(params, 'skyRenderMode', ['Gradient + Clouds', 'Gradient Regular', 'Flat Solid'])
            .name('Sky Mode')
            .onChange(v => {
                if (typeof window.setSkyRenderMode === 'function') window.setSkyRenderMode(v);
            });
        gradientSkyFolder.add(params, 'showProceduralSky').name('Procedural Sky Dome').onChange(v => {
            if (typeof window.setSkyRenderMode === 'function') {
                if (!v) window.setSkyRenderMode('Flat Solid');
                else window.setSkyRenderMode(params.enableProceduralClouds ? 'Gradient + Clouds' : 'Gradient Regular');
            }
        });
        gradientSkyFolder.add(params, 'enableProceduralClouds').name('Enable Procedural Clouds').onChange(v => {
            if (typeof window.setSkyRenderMode === 'function') {
                window.setSkyRenderMode(v ? 'Gradient + Clouds' : 'Gradient Regular');
            }
        });
        gradientSkyFolder.add(gradParams, 'enabled').name('Enable Gradient Curve').onChange(v => {
            if (skyUniforms.uGradientSkyEnabled) skyUniforms.uGradientSkyEnabled.value = v ? 1.0 : 0.0;
        });
        gradientSkyFolder.addColor(gradParams, 'zenith').name('Zenith Color').onChange(v => {
            const hex = parseInt(v.replace('#', ''), 16);
            if (skyUniforms.uSkyColorZenith) skyUniforms.uSkyColorZenith.value.setHex(hex);
            envConfigs[timePhase].bg = hex;
        });
        gradientSkyFolder.addColor(gradParams, 'mid').name('Mid-Sky Color').onChange(v => {
            const hex = parseInt(v.replace('#', ''), 16);
            if (skyUniforms.uSkyColorMid) skyUniforms.uSkyColorMid.value.setHex(hex);
            envConfigs[timePhase].mid = hex;
        });
        gradientSkyFolder.addColor(gradParams, 'horizon').name('Horizon Color').onChange(v => {
            const hex = parseInt(v.replace('#', ''), 16);
            if (skyUniforms.uSkyColorHorizon) skyUniforms.uSkyColorHorizon.value.setHex(hex);
            envConfigs[timePhase].fog = hex;
        });
        gradientSkyFolder.add(gradParams, 'power', 0.2, 3.0, 0.05).name('Gradient Curve (Power)').onChange(v => {
            if (skyUniforms.uGradientPower) skyUniforms.uGradientPower.value = v;
        });
        gradientSkyFolder.add(gradParams, 'midOffset', 0.05, 0.8, 0.01).name('Mid-Height Offset').onChange(v => {
            if (skyUniforms.uGradientMidOffset) skyUniforms.uGradientMidOffset.value = v;
        });
        gradientSkyFolder.add(gradParams, 'sunCorona', 0.0, 2.0, 0.05).name('Sun Flare Glow').onChange(v => {
            if (skyUniforms.uSunCoronaIntensity) skyUniforms.uSunCoronaIntensity.value = v;
        });
        gradientSkyFolder.add(gradParams, 'horizonGlow', 0.0, 1.5, 0.05).name('Horizon Band Glow').onChange(v => {
            if (skyUniforms.uHorizonGlow) skyUniforms.uHorizonGlow.value = v;
        });
        gradientSkyFolder.add(gradParams, 'applySunsetGradient').name('Preset: Sunset Look');
        gradientSkyFolder.add(gradParams, 'applyDayGradient').name('Preset: Day Sky Look');

        // Subfolder: Procedural Sky (Per Biome)
        const skyEditorParams = {
            coverage: 0.45, edge: 0.07, speed: 0.02,
            skyZenith: '#4a90d9', skyHorizon: '#b8d4e8',
            cloudCol: '#fff8f0', cloudShadow: '#8898a8',
            turbulence: 0.0, stormDarken: 0.0,
            weather: 'clear'
        };
        const skyFolder = gradientSkyFolder.addFolder('Procedural Sky (Per Biome)');

        function writeSkyToConfig(key, val) {
            if (typeof playerGrp !== 'undefined' && playerGrp.position) {
                const b = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
                const bName = b ? b.name : null;
                if (bName && BIOME_SKY_CONFIGS[bName]) BIOME_SKY_CONFIGS[bName][key] = val;
            }
        }
        skyFolder.add({
            clearDesertDay: () => {
                if (typeof instMegaClouds !== 'undefined') {
                    instMegaClouds.count = Math.max(1, Math.floor(params.cloudCountMega * cloudParams.density));
                    if (instMegaClouds.instanceMatrix) instMegaClouds.instanceMatrix.needsUpdate = true;
                }
                gui.controllersRecursive().forEach(c => c.updateDisplay());
            }
        }, 'clearDesertDay').name('Clear Desert Day');

        const skyCtrlCoverage = skyFolder.add(skyEditorParams, 'coverage', 0, 1, 0.01).name('Cloud Coverage').onChange(v => writeSkyToConfig('coverage', v));
        const skyCtrlEdge = skyFolder.add(skyEditorParams, 'edge', 0.02, 0.25, 0.005).name('Cloud Edge').onChange(v => writeSkyToConfig('edge', v));
        const skyCtrlSpeed = skyFolder.add(skyEditorParams, 'speed', 0, 0.2, 0.002).name('Cloud Speed').onChange(v => writeSkyToConfig('speed', v));
        const skyCtrlZenith = skyFolder.addColor(skyEditorParams, 'skyZenith').name('Sky Zenith').onChange(v => writeSkyToConfig('skyZenith', parseInt(v.replace('#',''), 16)));
        const skyCtrlHorizon = skyFolder.addColor(skyEditorParams, 'skyHorizon').name('Sky Horizon').onChange(v => writeSkyToConfig('skyHorizon', parseInt(v.replace('#',''), 16)));
        const skyCtrlCloudCol = skyFolder.addColor(skyEditorParams, 'cloudCol').name('Cloud Color').onChange(v => writeSkyToConfig('cloudCol', parseInt(v.replace('#',''), 16)));
        const skyCtrlCloudShadow = skyFolder.addColor(skyEditorParams, 'cloudShadow').name('Cloud Shadow').onChange(v => writeSkyToConfig('cloudShadow', parseInt(v.replace('#',''), 16)));
        const skyCtrlTurb = skyFolder.add(skyEditorParams, 'turbulence', 0, 1, 0.01).name('Storm Turbulence').onChange(v => writeSkyToConfig('turbulence', v));
        const skyCtrlDarken = skyFolder.add(skyEditorParams, 'stormDarken', 0, 1, 0.01).name('Storm Darken').onChange(v => writeSkyToConfig('stormDarken', v));
        skyFolder.add({ opacity: 1.0 }, 'opacity', 0, 1, 0.01).name('Cloud Opacity').onChange(v => { skyUniforms.uCloudOpacity.value = v; });
        skyFolder.add(skyEditorParams, 'weather', ['clear', 'storm', 'overcast']).name('Weather').onChange(v => {
        window.currentWeather = v;
        if (skyUniforms && skyUniforms.uWeather) skyUniforms.uWeather.value = (v === 'storm' ? 2 : v === 'overcast' ? 1 : 0);
    });

        setInterval(() => {
            if (typeof playerGrp !== 'undefined' && playerGrp.position) {
                const b = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
                const bName = b ? b.name : null;
                if (bName) {
                    const cfg = BIOME_SKY_CONFIGS[bName];
                    if (cfg) {
                        skyEditorParams.coverage = cfg.coverage;
                        skyEditorParams.edge = cfg.edge;
                        skyEditorParams.speed = cfg.speed;
                        skyEditorParams.skyZenith = '#' + cfg.skyZenith.toString(16).padStart(6, '0');
                        skyEditorParams.skyHorizon = '#' + cfg.skyHorizon.toString(16).padStart(6, '0');
                        skyEditorParams.cloudCol = '#' + cfg.cloudCol.toString(16).padStart(6, '0');
                        skyEditorParams.cloudShadow = '#' + cfg.cloudShadow.toString(16).padStart(6, '0');
                        skyEditorParams.turbulence = cfg.turbulence;
                        skyEditorParams.stormDarken = cfg.stormDarken;
                        [skyCtrlCoverage, skyCtrlEdge, skyCtrlSpeed, skyCtrlZenith, skyCtrlHorizon, skyCtrlCloudCol, skyCtrlCloudShadow, skyCtrlTurb, skyCtrlDarken].forEach(c => c.updateDisplay());
                        skyFolder.title('Procedural Sky (' + bName + ')');
                    }
                }
            }
        }, 500);

        // 3. Sun & God Rays Controls Subfolder
        const sunGodRaysFolder = envFolder.addFolder('Sun & God Rays Controls');
        sunGodRaysFolder.add(params, 'sunAltitude', -8000, 15000, 50).name('Sun Height (Altitude)').onChange(v => {
            params.sunAltitude = v;
            if (typeof envConfigs !== 'undefined' && envConfigs[timePhase]) {
                envConfigs[timePhase].sunY = v;
            }
        });
        sunGodRaysFolder.add(params, 'sunAzimuth', -180, 180, 1).name('Sun Azimuth (Angle)').onChange(v => {
            params.sunAzimuth = v;
        });
        sunGodRaysFolder.add(params, 'lockSunToPlayer').name('Lock Sun to Player');
        sunGodRaysFolder.add(params, 'sunDiscScale', 0.5, 5.0, 0.1).name('Sun Disc Size').onChange(v => {
            params.sunDiscScale = v;
        });
        sunGodRaysFolder.add(params, 'godRays').name('God Rays Enable').onChange(v => {
            godRaysPass.enabled = v;
        });
        sunGodRaysFolder.add(params, 'godRayIntensity', 0, 2.5, 0.05).name('Ray Intensity').onChange(v => {
            godRaysPass.uniforms.uIntensity.value = v;
        });
        sunGodRaysFolder.add(params, 'godRayDensity', 0.1, 1.5, 0.05).name('Ray Density').onChange(v => {
            godRaysPass.uniforms.uDensity.value = v;
        });
        sunGodRaysFolder.add(params, 'godRayDecay', 0.80, 0.995, 0.005).name('Ray Decay').onChange(v => {
            godRaysPass.uniforms.uDecay.value = v;
        });
        sunGodRaysFolder.add(params, 'lumMin', 0.0, 1.0, 0.01).name('Lum Gate Min').onChange(v => {
            godRaysPass.uniforms.uLumMin.value = v;
        });
        sunGodRaysFolder.add(params, 'lumMax', 0.0, 1.0, 0.01).name('Lum Gate Max').onChange(v => {
            godRaysPass.uniforms.uLumMax.value = v;
        });
        sunGodRaysFolder.add(params, 'highlightKnee', 0.2, 1.0, 0.01).name('Highlight Rolloff').onChange(v => {
            uRolloffKnee.value = v;
        });
        sunGodRaysFolder.add(params, 'horizonGlow', 0.0, 1.5, 0.05).name('Horizon Glow').onChange(v => {
            if (skyUniforms && skyUniforms.uHorizonGlow) skyUniforms.uHorizonGlow.value = v;
        });

        const rayColors = {
            inner: '#' + godRaysPass.uniforms.uRayColorInner.value.getHexString(),
            outer: '#' + godRaysPass.uniforms.uRayColorOuter.value.getHexString(),
            applyPreset: () => {
                timePhase = 1;
                localStorage.setItem('wl_timePhase', 1);
                params.sunAltitude = 160;
                params.sunAzimuth = 0;
                params.lockSunToPlayer = true;
                params.sunDiscScale = 1.8;
                params.godRays = true;
                godRaysPass.enabled = true;
                params.godRayIntensity = 0.35;
                godRaysPass.uniforms.uIntensity.value = 0.35;
                params.godRayDensity = 0.50;
                godRaysPass.uniforms.uDensity.value = 0.50;
                params.godRayDecay = 0.88;
                godRaysPass.uniforms.uDecay.value = 0.88;
                params.lumMin = 0.85;
                godRaysPass.uniforms.uLumMin.value = 0.85;
                params.lumMax = 0.97;
                godRaysPass.uniforms.uLumMax.value = 0.97;
                params.highlightKnee = 0.75;
                params.horizonGlow = 0.45;
                
                envConfigs[1].bg = 0x2a5090;
                envConfigs[1].mid = 0xc85078;
                envConfigs[1].fog = 0xffa07a;
                envConfigs[1].amb = 0xffdab9;
                envConfigs[1].dir = 0xffaa00;
                envConfigs[1].ambI = 1.1;
                envConfigs[1].dirI = 3.2;
                envConfigs[1].glintCol = 0xffaa00;
                envConfigs[1].sunY = 160;
                envConfigs[1].moonY = 200;
                envConfigs[1].cloudCol = 0xfffaec;

                if (skyUniforms) {
                    skyUniforms.uHorizonGlow.value = 0.45;
                    skyUniforms.uSkyColorZenith.value.setHex(0x2a5090);
                    if (skyUniforms.uSkyColorMid) skyUniforms.uSkyColorMid.value.setHex(0xc85078);
                    skyUniforms.uSkyColorHorizon.value.setHex(0xffa07a);
                }
                if (typeof zenithColorUniform !== 'undefined') zenithColorUniform.value.setHex(0x2a5090);
                if (typeof horizonColorUniform !== 'undefined') horizonColorUniform.value.setHex(0xffa07a);
                if (typeof deepColorUniform !== 'undefined') deepColorUniform.value.setHex(0x121a24);
                if (typeof shallowColorUniform !== 'undefined') shallowColorUniform.value.setHex(0xd05432);
                
                updateAtmoParamsFromPhase();
                sunGodRaysFolder.controllers.forEach(c => c.updateDisplay());
                if (atmoFolder) atmoFolder.controllers.forEach(c => c.updateDisplay());
            }
        };
        sunGodRaysFolder.addColor(rayColors, 'inner').name('Ray Color (Inner)').onChange(v => {
            godRaysPass.uniforms.uRayColorInner.value.set(v);
        });
        sunGodRaysFolder.addColor(rayColors, 'outer').name('Ray Color (Outer)').onChange(v => {
            godRaysPass.uniforms.uRayColorOuter.value.set(v);
        });
        sunGodRaysFolder.add(rayColors, 'applyPreset').name('Apply Sunset Photo Look');
        sunGodRaysFolder.add({
            exportDusk: () => timeOfDayExporter ? timeOfDayExporter.exportPhase(1, false) : null
        }, 'exportDusk').name('Export Dusk / Sun Rays (Copy JSON)');
        sunGodRaysFolder.add({
            downloadDusk: () => timeOfDayExporter ? timeOfDayExporter.exportPhase(1, true) : null
        }, 'downloadDusk').name('Download Dusk Settings (.json)');

        // 4. Moonlight & Night Subfolder
        const moonLightingParams = {
            moonlightColor: '#' + envConfigs[2].dir.toString(16).padStart(6, '0'),
            moonlightIntensity: envConfigs[2].dirI,
            nightAmbColor: '#' + envConfigs[2].amb.toString(16).padStart(6, '0'),
            nightAmbIntensity: envConfigs[2].ambI,
            nightSkyColor: '#' + envConfigs[2].bg.toString(16).padStart(6, '0'),
            nightFogColor: '#' + envConfigs[2].fog.toString(16).padStart(6, '0'),
            moonAltitude: envConfigs[2].moonY
        };

        const moonFolder = envFolder.addFolder('Moonlight & Night');
        // NOTE: this used to write renderer.toneMappingExposure, which is completely inert
        // while PostProcessing sets outputColorTransform = false. It now drives the real
        // exposure multiplier, so the slider actually does something.
        moonFolder.add(params, 'exposureTrim', 0.4, 2.0, 0.02).name('Global Brightness').onChange(v => {
            gui.controllersRecursive().forEach(c => { if (c.property === 'exposureTrim') c.updateDisplay(); });
        });
        moonFolder.add(params, 'nightExposure', 0.6, 3.0, 0.05).name('Night Exposure');
        moonFolder.addColor(moonLightingParams, 'moonlightColor').name('Moonlight Color').onChange(v => envConfigs[2].dir = parseInt(v.replace('#',''), 16));
        moonFolder.add(moonLightingParams, 'moonlightIntensity', 0, 10, 0.1).name('Moonlight Power').onChange(v => envConfigs[2].dirI = v);
        moonFolder.addColor(moonLightingParams, 'nightAmbColor').name('Night Fill Color').onChange(v => envConfigs[2].amb = parseInt(v.replace('#',''), 16));
        moonFolder.add(moonLightingParams, 'nightAmbIntensity', 0, 5, 0.1).name('Night Fill Power').onChange(v => envConfigs[2].ambI = v);
        moonFolder.addColor(moonLightingParams, 'nightSkyColor').name('Night Sky Color').onChange(v => envConfigs[2].bg = parseInt(v.replace('#',''), 16));
        moonFolder.addColor(moonLightingParams, 'nightFogColor').name('Night Fog Color').onChange(v => envConfigs[2].fog = parseInt(v.replace('#',''), 16));
        moonFolder.add(moonLightingParams, 'moonAltitude', 500, 30000, 100).name('Moon Altitude (Height)').onChange(v => envConfigs[2].moonY = v);

        // 3D Moon Object Controls
        const moon3dFolder = moonFolder.addFolder('3D Moon Object');
        moon3dFolder.add(moonParams, 'size', 0.1, 8.0, 0.05).name('Moon Size / Scale').onChange(v => {
            if (moonMesh) moonMesh.scale.setScalar(v);
        });
        moon3dFolder.add(moonParams, 'brightness', 0.0, 5.0, 0.05).name('Moon Brightness').onChange(v => {
            if (moonMesh && moonMesh.material) moonMesh.material.color.setRGB(v, v, v);
        });
        moon3dFolder.add(moonParams, 'glowIntensity', 0.0, 2.0, 0.02).name('Glow / Bloom Intensity').onChange(v => {
            if (window._moonGlow && window._moonGlow()) {
                const s = window._moonGlow();
                s.material.opacity = v;
                s.visible = v > 0.01;
            }
        });
        moon3dFolder.add(moonParams, 'glowRadius', 1.0, 2.5, 0.01).name('Glow Radius').onChange(v => {
            if (window._moonGlow && window._moonGlow()) {
                const s = window._moonGlow();
                if (s.isSprite) {
                    const scale = moonParams.baseRadius * 2 * moonParams.size * v;
                    s.scale.set(scale, scale, 1.0);
                } else {
                    const scale = moonParams.size * (v / 1.44);
                    s.scale.setScalar(scale);
                }
            }
        });
        moon3dFolder.addColor(moonParams, 'glowColor').name('Glow Tint Color').onChange(v => {
            if (window._moonGlow && window._moonGlow()) {
                window._moonGlow().material.color.set(v);
            }
        });
        moon3dFolder.add(moonParams, 'azimuth', 0, 360, 1).name('Position Azimuth (deg)');
        moon3dFolder.add(moonParams, 'distance', 5000, 60000, 500).name('Position Distance');
        moon3dFolder.add(moonParams, 'rotationX', -180, 180, 1).name('Rotation X (deg)');
        moon3dFolder.add(moonParams, 'rotationY', -180, 180, 1).name('Rotation Y (deg)').listen();
        moon3dFolder.add(moonParams, 'rotationZ', -180, 180, 1).name('Rotation Z (deg)');
        moon3dFolder.add(moonParams, 'rotationSpeed', -0.05, 0.05, 0.0005).name('Auto-Spin Speed');

        moonFolder.add({
            exportNight: () => timeOfDayExporter ? timeOfDayExporter.exportPhase(2, false) : null
        }, 'exportNight').name('Export Night Settings (Copy JSON)');
        moonFolder.add({
            downloadNight: () => timeOfDayExporter ? timeOfDayExporter.exportPhase(2, true) : null
        }, 'downloadNight').name('Download Night Settings (.json)');

        // Star controls. Every one of these is multiplied by uNightFactor in the shader, which
        // is exactly 0.0 at dusk — so no setting here can affect the golden dusk look.
        if (skyUniforms && skyUniforms.uStarDensity) {
            const starParams = {
                starDensity: skyUniforms.uStarDensity.value,
                starBrightness: skyUniforms.uStarBrightness.value,
                starTwinkle: skyUniforms.uStarTwinkle.value,
                milkyWay: skyUniforms.uMilkyWay.value,
                nightSkyLift: skyUniforms.uNightSkyLift.value
            };
            moonFolder.add(starParams, 'starDensity', 0.0, 0.25, 0.005).name('Star Density').onChange(v => skyUniforms.uStarDensity.value = v);
            moonFolder.add(starParams, 'starBrightness', 0.0, 3.0, 0.05).name('Star Brightness').onChange(v => skyUniforms.uStarBrightness.value = v);
            moonFolder.add(starParams, 'starTwinkle', 0.0, 1.0, 0.05).name('Star Twinkle').onChange(v => skyUniforms.uStarTwinkle.value = v);
            moonFolder.add(starParams, 'nightSkyLift', 0.0, 3.0, 0.05).name('Night Sky Lift').onChange(v => skyUniforms.uNightSkyLift.value = v);

            const mwFolder = moonFolder.addFolder('Milky Way');
            const mwParams = {
                strength: skyUniforms.uMilkyWay.value,
                dust: skyUniforms.uMilkyDust.value,
                armColor: '#' + new THREE.Color().copy(skyUniforms.uMilkyArmColor.value).getHexString(),
                coreColor: '#' + new THREE.Color().copy(skyUniforms.uMilkyCoreColor.value).getHexString()
            };
            mwFolder.add(mwParams, 'strength', 0.0, 3.0, 0.05).name('Strength').onChange(v => skyUniforms.uMilkyWay.value = v);
            mwFolder.add(mwParams, 'dust', 0.0, 1.0, 0.05).name('Dust Lanes').onChange(v => skyUniforms.uMilkyDust.value = v);
            mwFolder.addColor(mwParams, 'armColor').name('Arm Color').onChange(v => skyUniforms.uMilkyArmColor.value.set(v));
            mwFolder.addColor(mwParams, 'coreColor').name('Core Color').onChange(v => skyUniforms.uMilkyCoreColor.value.set(v));
        }

        // Photographic Milky Way cubemap (extracted from galactic-home). Night-only:
        // its opacity is uNightFactor * opacity, and uNightFactor is exactly 0 at dusk,
        // so none of these controls can touch the locked Golden Hour Dusk look.
        if (typeof milkyWayParams !== 'undefined') {
            const mwPhoto = moonFolder.addFolder('Milky Way Photo');
            mwPhoto.add(milkyWayParams, 'brightness',  0.0, 6.0, 0.05).name('Brightness');
            mwPhoto.add(milkyWayParams, 'opacity',     0.0, 1.0, 0.05).name('Opacity');
            mwPhoto.add(milkyWayParams, 'contrast',    0.0, 4.0, 0.05).name('Contrast');
            mwPhoto.add(milkyWayParams, 'saturation',  0.0, 3.0, 0.05).name('Saturation');
            mwPhoto.add(milkyWayParams, 'hue',       -180,  180,   1 ).name('Hue Shift (deg)');
            mwPhoto.add(milkyWayParams, 'tiltX', -180, 180, 1).name('Elevation (tip up/down)').onChange(applyMilkyWayTilt);
            mwPhoto.add(milkyWayParams, 'tiltY', -180, 180, 1).name('Azimuth (spin L/R)').onChange(applyMilkyWayTilt);
            mwPhoto.add(milkyWayParams, 'tiltZ', -180, 180, 1).name('Roll').onChange(applyMilkyWayTilt);
        }
        if (typeof auroraParams !== 'undefined') {
            const auroraFolder = moonFolder.addFolder('Aurora Borealis');
            auroraFolder.add(auroraParams, 'opacity', 0.0, 1.0, 0.05).name('Opacity');
            auroraFolder.add(auroraParams, 'intensity', 0.0, 3.0, 0.1).name('Intensity');
            auroraFolder.add(auroraParams, 'speed', 0.1, 4.0, 0.1).name('Speed');
            auroraFolder.add(auroraParams, 'altitude', -2000, 8000, 100).name('Altitude');
        }

        // 4b. Daylight Subfolder — day was blown out because near-white light at high
        // intensity pushed every channel over the soft-clip knee at once.
        const dayParams = {
            dayLightColor: '#' + envConfigs[0].dir.toString(16).padStart(6, '0'),
            dayLightIntensity: envConfigs[0].dirI,
            dayAmbColor: '#' + envConfigs[0].amb.toString(16).padStart(6, '0'),
            dayAmbIntensity: envConfigs[0].ambI,
            daySkyColor: '#' + envConfigs[0].bg.toString(16).padStart(6, '0'),
            dayFogColor: '#' + envConfigs[0].fog.toString(16).padStart(6, '0')
        };
        const dayFolder = envFolder.addFolder('Daylight');
        dayFolder.add(params, 'dayExposure', 0.25, 1.5, 0.01).name('Day Exposure');
        dayFolder.addColor(dayParams, 'dayLightColor').name('Sunlight Color').onChange(v => envConfigs[0].dir = parseInt(v.replace('#',''), 16));
        dayFolder.add(dayParams, 'dayLightIntensity', 0, 5, 0.05).name('Sunlight Power').onChange(v => envConfigs[0].dirI = v);
        dayFolder.addColor(dayParams, 'dayAmbColor').name('Day Fill Color').onChange(v => envConfigs[0].amb = parseInt(v.replace('#',''), 16));
        dayFolder.add(dayParams, 'dayAmbIntensity', 0, 3, 0.05).name('Day Fill Power').onChange(v => envConfigs[0].ambI = v);
        dayFolder.addColor(dayParams, 'daySkyColor').name('Day Sky Color').onChange(v => envConfigs[0].bg = parseInt(v.replace('#',''), 16));
        dayFolder.addColor(dayParams, 'dayFogColor').name('Day Fog Color').onChange(v => envConfigs[0].fog = parseInt(v.replace('#',''), 16));
        dayFolder.add({
            exportDay: () => timeOfDayExporter ? timeOfDayExporter.exportPhase(0, false) : null
        }, 'exportDay').name('Export Day Settings (Copy JSON)');
        dayFolder.add({
            downloadDay: () => timeOfDayExporter ? timeOfDayExporter.exportPhase(0, true) : null
        }, 'downloadDay').name('Download Day Settings (.json)');

        // 5. Weather & Fog Subfolder
        const weatherFolder = envFolder.addFolder('Weather & Fog');
        
        // Dedicated Distance Fog (Horizon & Range) Subfolder
        const distFogFolder = weatherFolder.addFolder('Distance Fog (Horizon & Range)');
        distFogFolder.add(params, 'sceneFog').name('Global Fog').listen().onChange(v => {
            params.sceneFog = v;
            if (!v && typeof scene !== 'undefined' && scene.fog) {
                scene.fog.near = 100000;
                scene.fog.far = 200000;
            }
        });
        distFogFolder.add(params, 'fogNear', 0, 1000, 10).name('Start Dist (Clear Area)').listen().onChange(v => {
            if (window.groundFogEditor && window.groundFogEditor.runtimeState) {
                window.groundFogEditor.runtimeState.distNear = v;
                const curCfg = window.groundFogEditor.getCurrentConfig();
                if (curCfg) { curCfg.distNear = v; window.groundFogEditor.saveConfigsToStorage(); }
            }
        });
        distFogFolder.add(params, 'fogFar', 300, 8000, 50).name('End Dist (Max Density)').listen().onChange(v => {
            if (window.groundFogEditor && window.groundFogEditor.runtimeState) {
                window.groundFogEditor.runtimeState.distFar = v;
                const curCfg = window.groundFogEditor.getCurrentConfig();
                if (curCfg) { curCfg.distFar = v; window.groundFogEditor.saveConfigsToStorage(); }
            }
        });
        distFogFolder.add(params, 'fogDensity', 0.10, 4.00, 0.05).name('Density Multiplier').listen().onChange(v => {
            if (window.groundFogEditor && window.groundFogEditor.runtimeState) {
                window.groundFogEditor.runtimeState.distDensity = v;
                const curCfg = window.groundFogEditor.getCurrentConfig();
                if (curCfg) { curCfg.distDensity = v; window.groundFogEditor.saveConfigsToStorage(); }
            }
        });
        distFogFolder.add(params, 'fogAltitudeScale', 0.0, 4.0, 0.1).name('Altitude Scale').listen().onChange(v => {
            if (window.groundFogEditor && window.groundFogEditor.runtimeState) {
                window.groundFogEditor.runtimeState.distAltScale = v;
                const curCfg = window.groundFogEditor.getCurrentConfig();
                if (curCfg) { curCfg.distAltScale = v; window.groundFogEditor.saveConfigsToStorage(); }
            }
        });
        distFogFolder.add(params, 'fogAutoAltitude').name('Altitude Auto-Expand').listen();
        distFogFolder.add(waterFogStrengthUniform, 'value', 0.0, 1.0, 0.01).name('Water Horizon Fog').listen();
        distFogFolder.add(waterFogFarUniform, 'value', 1000, 12000, 100).name('Water Fog End Dist').listen();

        const applyDistanceFogPreset = (near, far, density, altScale) => {
            params.fogNear = near;
            params.fogFar = far;
            params.fogDensity = density;
            params.fogAltitudeScale = altScale;
            if (window.groundFogEditor) {
                const curCfg = window.groundFogEditor.getCurrentConfig();
                if (curCfg) {
                    curCfg.distNear = near;
                    curCfg.distFar = far;
                    curCfg.distDensity = density;
                    curCfg.distAltScale = altScale;
                    window.groundFogEditor.saveConfigsToStorage();
                    window.groundFogEditor.syncUI();
                    window.groundFogEditor.applyToScene(true);
                }
            }
            distFogFolder.controllersRecursive().forEach(c => c.updateDisplay());
        };

        const fogPresetsFolder = distFogFolder.addFolder('Distance Fog Presets');
        fogPresetsFolder.add({ p: () => applyDistanceFogPreset(80, 1800, 1.0, 1.2) }, 'p').name('Balanced (Default)');
        fogPresetsFolder.add({ p: () => applyDistanceFogPreset(200, 3500, 0.6, 2.5) }, 'p').name('Vast Horizon');
        fogPresetsFolder.add({ p: () => applyDistanceFogPreset(35, 1100, 1.7, 0.8) }, 'p').name('Dense Mountain Mist');
        fogPresetsFolder.add({ p: () => applyDistanceFogPreset(50, 1300, 1.4, 0.9) }, 'p').name('Deep Atmosphere');
        fogPresetsFolder.add({ p: () => applyDistanceFogPreset(20, 800, 2.0, 0.5) }, 'p').name('Close Dramatic Fog');
        fogPresetsFolder.close();

        weatherFolder.add(params, 'wind').name('Wind').onChange(v => { if (isWindOn !== v) document.getElementById('wind-toggle').click(); });
        weatherFolder.add(params, 'trails').name('Wind Trails').onChange(v => isWindTrailsOn = v);

        const rainFolder = weatherFolder.addFolder('Rain Settings');
        rainFolder.add(params, 'rain').name('Enable Rain').onChange(v => { isRainOn = v; });
        rainFolder.add(params, 'rainSize', 0.5, 10.0).name('Drop Size');
        rainFolder.add(params, 'rainIntensity', 0.1, 5.0).name('Intensity');
        rainFolder.add(params, 'rainWindX', -5.0, 5.0).name('Wind X');
        rainFolder.add(params, 'rainWindY', -5.0, 5.0).name('Wind Z');

        window.biomeFogSettings = window.biomeFogSettings || {};
        const fogFolder = weatherFolder.addFolder('Ground Fog (Per Biome)');
        const fogEnableCtrl = fogFolder.add(params, 'fogPlane').name('Enable Fog').listen().onChange(v => {
            params.fogPlane = v;
            if (window.groundFogEditor) {
                const curCfg = window.groundFogEditor.getCurrentConfig();
                if (curCfg) {
                    curCfg.enabled = v;
                    window.groundFogEditor.saveConfigsToStorage();
                    window.groundFogEditor.runtimeState.enabled = v;
                }
                if (window.groundFogEditor.visible) {
                    window.groundFogEditor.syncUI();
                }
            }
            if (typeof window.fogGroup !== 'undefined') {
                window.fogGroup.visible = v && (params.showFog !== false);
            }
        });
        const fogOffsetCtrl = fogFolder.add(params, 'biomeFogOffset', -80, 100).name('Biome Fog Offset').onChange(v => {
            if (typeof playerGrp !== 'undefined' && playerGrp.position) {
                const b = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
                const bName = b ? b.name : 'Unknown';
                window.biomeFogSettings = window.biomeFogSettings || {};
                window.biomeFogSettings[bName] = v;
                if (window.groundFogEditor) {
                    const curCfg = window.groundFogEditor.getCurrentConfig();
                    if (curCfg) { curCfg.heightOffset = v; window.groundFogEditor.saveConfigsToStorage(); }
                }
            }
        });

        const groundFogProxy = {
            get intensity() {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    return cfg && cfg.intensity !== undefined ? cfg.intensity : 1.0;
                }
                return 1.0;
            },
            set intensity(v) {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    if (cfg) { cfg.intensity = v; window.groundFogEditor.saveConfigsToStorage(); }
                }
            },
            get opacity() {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    return cfg && cfg.opacity !== undefined ? cfg.opacity : 0.85;
                }
                return 0.85;
            },
            set opacity(v) {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    if (cfg) { cfg.opacity = v; window.groundFogEditor.saveConfigsToStorage(); }
                }
            },
            get layerCount() {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    return cfg && cfg.layerCount !== undefined ? cfg.layerCount : 5;
                }
                return 5;
            },
            set layerCount(v) {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    if (cfg) { cfg.layerCount = Math.round(v); window.groundFogEditor.saveConfigsToStorage(); }
                }
            },
            get inversionCeiling() {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    return cfg && cfg.inversionCeiling !== undefined ? cfg.inversionCeiling : 150;
                }
                return 150;
            },
            set inversionCeiling(v) {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    if (cfg) { cfg.inversionCeiling = v; window.groundFogEditor.saveConfigsToStorage(); }
                }
            },
            get ceilingFalloff() {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    return cfg && cfg.ceilingFalloff !== undefined ? cfg.ceilingFalloff : 40;
                }
                return 40;
            },
            set ceilingFalloff(v) {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    if (cfg) { cfg.ceilingFalloff = v; window.groundFogEditor.saveConfigsToStorage(); }
                }
            },
            get layerSpacing() {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    return cfg && cfg.layerSpacing !== undefined ? cfg.layerSpacing : 20;
                }
                return 20;
            },
            set layerSpacing(v) {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    if (cfg) { cfg.layerSpacing = v; window.groundFogEditor.saveConfigsToStorage(); }
                }
            },
            get driftSpeed() {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    return cfg && cfg.driftSpeed !== undefined ? cfg.driftSpeed : 1.0;
                }
                return 1.0;
            },
            set driftSpeed(v) {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    if (cfg) { cfg.driftSpeed = v; window.groundFogEditor.saveConfigsToStorage(); }
                }
            },
            get turbulence() {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    return cfg && cfg.turbulence !== undefined ? cfg.turbulence : 1.0;
                }
                return 1.0;
            },
            set turbulence(v) {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    if (cfg) { cfg.turbulence = v; window.groundFogEditor.saveConfigsToStorage(); }
                }
            },
            get mieIntensity() {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    return cfg && cfg.mieIntensity !== undefined ? cfg.mieIntensity : 1.3;
                }
                return 1.3;
            },
            set mieIntensity(v) {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    if (cfg) { cfg.mieIntensity = v; window.groundFogEditor.saveConfigsToStorage(); }
                }
            },
            get sunGlow() {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    return cfg && cfg.sunGlow !== undefined ? cfg.sunGlow : 1.2;
                }
                return 1.2;
            },
            set sunGlow(v) {
                if (window.groundFogEditor) {
                    const cfg = window.groundFogEditor.getCurrentConfig();
                    if (cfg) { cfg.sunGlow = v; window.groundFogEditor.saveConfigsToStorage(); }
                }
            }
        };

        fogFolder.add(groundFogProxy, 'intensity', 0.05, 4.0, 0.05).name('Fog Intensity').listen().onChange(() => {
            if (window.groundFogEditor && window.groundFogEditor.visible) window.groundFogEditor.syncUI();
        });
        fogFolder.add(groundFogProxy, 'opacity', 0.0, 1.0, 0.02).name('Fog Opacity').listen().onChange(() => {
            if (window.groundFogEditor && window.groundFogEditor.visible) window.groundFogEditor.syncUI();
        });
        fogFolder.add(groundFogProxy, 'layerCount', 1, 8, 1).name('Volumetric Slabs').listen().onChange(() => {
            if (window.groundFogEditor && window.groundFogEditor.visible) window.groundFogEditor.syncUI();
        });
        fogFolder.add(groundFogProxy, 'inversionCeiling', 20, 400, 5).name('Inversion Ceiling').listen().onChange(() => {
            if (window.groundFogEditor && window.groundFogEditor.visible) window.groundFogEditor.syncUI();
        });
        fogFolder.add(groundFogProxy, 'ceilingFalloff', 5, 150, 5).name('Ceiling Softness').listen().onChange(() => {
            if (window.groundFogEditor && window.groundFogEditor.visible) window.groundFogEditor.syncUI();
        });
        fogFolder.add(groundFogProxy, 'layerSpacing', 4, 80, 1).name('Layer Spacing').listen().onChange(() => {
            if (window.groundFogEditor && window.groundFogEditor.visible) window.groundFogEditor.syncUI();
        });
        fogFolder.add(groundFogProxy, 'driftSpeed', 0.0, 6.0, 0.1).name('Drift Speed').listen().onChange(() => {
            if (window.groundFogEditor && window.groundFogEditor.visible) window.groundFogEditor.syncUI();
        });
        fogFolder.add(groundFogProxy, 'turbulence', 0.1, 4.0, 0.1).name('Turbulence').listen().onChange(() => {
            if (window.groundFogEditor && window.groundFogEditor.visible) window.groundFogEditor.syncUI();
        });
        fogFolder.add(groundFogProxy, 'mieIntensity', 0.0, 4.0, 0.1).name('Mie Forward Glow').listen().onChange(() => {
            if (window.groundFogEditor && window.groundFogEditor.visible) window.groundFogEditor.syncUI();
        });
        fogFolder.add(groundFogProxy, 'sunGlow', 0.0, 3.0, 0.1).name('Sun Rim Highlight').listen().onChange(() => {
            if (window.groundFogEditor && window.groundFogEditor.visible) window.groundFogEditor.syncUI();
        });

        fogFolder.add({ openGroundFogEditor: async () => {
            if (window.summonGroundFogEditor) {
                const ed = await window.summonGroundFogEditor();
                ed.toggle();
            } else if (window.groundFogEditor) {
                window.groundFogEditor.toggle();
            }
        }}, 'openGroundFogEditor').name('Open Dedicated Fog Editor');

        setInterval(() => {
            if (typeof playerGrp !== 'undefined' && playerGrp.position && !fogOffsetCtrl.__onChangeBlocked) {
                const b = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
                const bName = b ? b.name : 'Unknown';
                window.biomeFogSettings = window.biomeFogSettings || {};
                const currentOffset = window.biomeFogSettings[bName] || 0;
                if (params.biomeFogOffset !== currentOffset) {
                    params.biomeFogOffset = currentOffset;
                    fogOffsetCtrl.__onChangeBlocked = true;
                    fogOffsetCtrl.updateDisplay();
                    fogOffsetCtrl.__onChangeBlocked = false;
                }

                if (window.groundFogEditor && window.groundFogEditor.biomeConfigs) {
                    const curCfg = window.groundFogEditor.biomeConfigs[cleanBiomeName(bName)];
                    if (curCfg && curCfg.enabled !== undefined && params.fogPlane !== curCfg.enabled) {
                        params.fogPlane = curCfg.enabled;
                        fogEnableCtrl.updateDisplay();
                    }
                }
                fogFolder.title('Ground Fog (' + bName + ')');
            }
        }, 500);

        // 6. Terrain Colors & Sand Shimmer Subfolder
        const colorEditorFolder = envFolder.addFolder('Terrain Colors & Sand Shimmer');
        const triggerTerrainColorUpdate = () => {
            invalidateTerrain();
        };
        const colorParams = {
            npSnow: '#' + northPoleColors.snowDune.getHexString(),
            npShadow: '#' + northPoleColors.snowShadow.getHexString(),
            npPeak: '#' + northPoleColors.icePeak.getHexString(),
            desertSlope: '#' + desertColors.duneSlope.getHexString(),
            desertShadow: '#' + desertColors.valleyShadow.getHexString(),
            shimmer: 1.0
        };
        colorEditorFolder.addColor(colorParams, 'npSnow').name('Snow Color').onChange(hex => {
            northPoleColors.snowDune.set(hex);
            triggerTerrainColorUpdate();
        });
        colorEditorFolder.addColor(colorParams, 'npShadow').name('Snow Shadow').onChange(hex => {
            northPoleColors.snowShadow.set(hex);
            triggerTerrainColorUpdate();
        });
        colorEditorFolder.addColor(colorParams, 'npPeak').name('Peak Color').onChange(hex => {
            northPoleColors.icePeak.set(hex);
            triggerTerrainColorUpdate();
        });
        colorEditorFolder.addColor(colorParams, 'desertSlope').name('Sand Color').onChange(hex => {
            desertColors.duneSlope.set(hex);
            triggerTerrainColorUpdate();
        });
        colorEditorFolder.addColor(colorParams, 'desertShadow').name('Sand Shadow').onChange(hex => {
            desertColors.valleyShadow.set(hex);
            triggerTerrainColorUpdate();
        });
        colorEditorFolder.add(colorParams, 'shimmer', 0, 3, 0.1).name('Shimmer Sparkle').onChange(val => {
            terrainUniforms.uShimmerMult.value = val;
        });

        // 7. Volumetric Clouds Subfolder
        const cloudFolder = envFolder.addFolder('Volumetric Clouds');
        cloudFolder.add(params, 'showVolumetricClouds').name('Volumetric Sky Clouds').onChange(v => {
            if (typeof toonCloudMat !== 'undefined' && toonCloudMat.uniforms && toonCloudMat.uniforms.uEnableClouds) {
                toonCloudMat.uniforms.uEnableClouds.value = v ? 1.0 : 0.0;
            }
        });

        // 8. Character Glow & Trees Subfolder
        const charFloraFolder = envFolder.addFolder('Character Glow & Trees');
        const glowFolder = charFloraFolder.addFolder('Kiki Warm Side Glow');
        const kikiGlowParams = {
            intensity: 2.5,
            distance: 300,
            spread: 35,
            color: '#ffaa44'
        };
        glowFolder.add(kikiGlowParams, 'intensity', 0, 8, 0.1).name('Glow Power').onChange(v => {
            const l1 = typeof kikiLeftLight !== 'undefined' ? kikiLeftLight : window.kikiLeftLight;
            const l2 = typeof kikiRightLight !== 'undefined' ? kikiRightLight : window.kikiRightLight;
            if (l1) l1.intensity = v;
            if (l2) l2.intensity = v;
        });
        glowFolder.add(kikiGlowParams, 'distance', 50, 800, 10).name('Glow Range').onChange(v => {
            const l1 = typeof kikiLeftLight !== 'undefined' ? kikiLeftLight : window.kikiLeftLight;
            const l2 = typeof kikiRightLight !== 'undefined' ? kikiRightLight : window.kikiRightLight;
            if (l1) l1.distance = v;
            if (l2) l2.distance = v;
        });
        glowFolder.add(kikiGlowParams, 'spread', 5, 100, 1).name('Side Spread').onChange(v => {
            const l1 = typeof kikiLeftLight !== 'undefined' ? kikiLeftLight : window.kikiLeftLight;
            const l2 = typeof kikiRightLight !== 'undefined' ? kikiRightLight : window.kikiRightLight;
            if (l1) l1.position.x = -v;
            if (l2) l2.position.x = v;
        });
        glowFolder.addColor(kikiGlowParams, 'color').name('Glow Color').onChange(v => {
            const col = new THREE.Color(v);
            const l1 = typeof kikiLeftLight !== 'undefined' ? kikiLeftLight : window.kikiLeftLight;
            const l2 = typeof kikiRightLight !== 'undefined' ? kikiRightLight : window.kikiRightLight;
            if (l1) l1.color.copy(col);
            if (l2) l2.color.copy(col);
        });

        const treeFolder = charFloraFolder.addFolder('Global Tree Settings');
        treeFolder.add(params, 'treeScale', 0.5, 4.0).name('Tree Scale').onChange(v => {
            const tu = typeof treeUniforms !== 'undefined' ? treeUniforms : window.treeUniforms;
            if (tu && tu.uTreeScale) tu.uTreeScale.value = v;
        });
        if (params.canopyDensity === undefined) params.canopyDensity = 1.0;
        if (params.canopyScale === undefined) params.canopyScale = 1.0;
        treeFolder.add(params, 'canopyDensity', 0.0, 2.0, 0.05).name('Canopy Density').onChange(v => {
            const terU = typeof terrainUniforms !== 'undefined' ? terrainUniforms : window.terrainUniforms;
            if (terU && terU.uCanopyDensity) terU.uCanopyDensity.value = v;
        });
        treeFolder.add(params, 'canopyScale', 0.5, 2.5, 0.05).name('Canopy Scale').onChange(v => {
            const terU = typeof terrainUniforms !== 'undefined' ? terrainUniforms : window.terrainUniforms;
            if (terU && terU.uCanopyScale) terU.uCanopyScale.value = v;
        });

        // 9. Ocean & Water Subfolder
        const oceanFolder = envFolder.addFolder('Ocean & Water');
        oceanFolder.add({ openOceanFolder: () => {
            toggleGUI(true);
            if (animeWaterGUI && animeWaterGUI.gui) {
                animeWaterGUI.gui.open();
                animeWaterGUI.gui.domElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }}, 'openOceanFolder').name('Ocean Editor (O)');

        const oceanFogFolder = oceanFolder.addFolder('Atmospheric Fog & Horizon');
        oceanFogFolder.add(globalFogDensityUniform, 'value', 0.0, 4.0, 0.05).name('Global Fog Density').listen();
        oceanFogFolder.add(waterFogStrengthUniform, 'value', 0.0, 1.0, 0.01).name('Blend Strength').listen();
        oceanFogFolder.add(waterFogNearUniform, 'value', 0, 4000, 50).name('Fog Start (m)').listen();
        oceanFogFolder.add(waterFogFarUniform, 'value', 1000, 12000, 100).name('Fog End (m)').listen();
        oceanFogFolder.add(waterGridFadeStartUniform, 'value', 2000, 7500, 100).name('Grid Fade Start (m)').listen();
        oceanFogFolder.add(waterGridFadeEndUniform, 'value', 4000, 8000, 50).name('Grid Fade End (m)').listen();

        // 10. Environment Presets Subfolder
        const presetFolder = envFolder.addFolder('Environment Presets');
        presetFolder.add({
            clearDesertDay: () => {
                teleportToBiome('Desert Dunes');
                params.fogPlane = false;
                if (typeof window.fogGroup !== 'undefined') window.fogGroup.visible = false;
                params.timeOfDay = 'day';
                if (typeof window.setTimePhase === 'function') window.setTimePhase(0);
                else if (typeof setTimePhase === 'function') setTimePhase(0);
                if (typeof cloudParams !== 'undefined') {
                    cloudParams.density = 0.1;
                    params.showVolumetricClouds = false;
                    const tcm = typeof toonCloudMat !== 'undefined' ? toonCloudMat : window.toonCloudMat;
                    if (tcm && tcm.uniforms && tcm.uniforms.uEnableClouds) {
                        tcm.uniforms.uEnableClouds.value = 0.0;
                    }
                }
                gui.controllersRecursive().forEach(c => c.updateDisplay());
            }
        }, 'clearDesertDay').name('Clear Desert Day');

        // Lazy Loaded Time of Day JSON Exporter & Manager
        let _todExporterInstance = null;
        async function getTODExporter() {
            if (!_todExporterInstance) {
                const { TimeOfDayExporter } = await import('../tools/TimeOfDayExporter.js');
                _todExporterInstance = new TimeOfDayExporter(() => ({
                    envConfigs,
                    timePhase: (typeof window.getTimePhase === 'function') ? window.getTimePhase() : ((typeof window.timePhase !== 'undefined') ? window.timePhase : (typeof timePhase !== 'undefined' ? timePhase : 0)),
                    params,
                    skyUniforms,
                    godRaysPass,
                    skyEditorParams,
                    cloudParams,
                    milkyWayParams: typeof milkyWayParams !== 'undefined' ? milkyWayParams : null,
                    auroraParams: typeof auroraParams !== 'undefined' ? auroraParams : null,
                    currentWeather: typeof currentWeather !== 'undefined' ? currentWeather : 'clear',
                    showToast: typeof showVisualToast !== 'undefined' ? showVisualToast : console.log,
                    setTimePhase: typeof setTimePhase === 'function' ? setTimePhase : (typeof window.setTimePhase === 'function' ? window.setTimePhase : null),
                    refreshGUI: () => {
                        if (typeof updateAtmoParamsFromPhase === 'function') updateAtmoParamsFromPhase();
                        if (gui) gui.controllersRecursive().forEach(c => c.updateDisplay());
                    }
                }));
                window.timeOfDayExporter = _todExporterInstance;
            }
            return _todExporterInstance;
        }

        // 11. Time of Day JSON Export Subfolder (Environment Subfolder)
        const todExportFolder = envFolder.addFolder('Time of Day JSON Export');
        todExportFolder.add({
            exportActive: async () => (await getTODExporter()).exportActivePhase(false)
        }, 'exportActive').name('Export Active Time of Day (Copy JSON)');
        todExportFolder.add({
            exportDay: async () => (await getTODExporter()).exportPhase(0, false)
        }, 'exportDay').name('Export Day Settings (Copy JSON)');
        todExportFolder.add({
            exportDusk: async () => (await getTODExporter()).exportPhase(1, false)
        }, 'exportDusk').name('Export Dusk Settings (Copy JSON)');
        todExportFolder.add({
            exportNight: async () => (await getTODExporter()).exportPhase(2, false)
        }, 'exportNight').name('Export Night Settings (Copy JSON)');
        todExportFolder.add({
            exportAll: async () => (await getTODExporter()).exportAllPhases(false)
        }, 'exportAll').name('Export All 3 Times of Day (Copy JSON)');
        todExportFolder.add({
            downloadActive: async () => (await getTODExporter()).exportActivePhase(true)
        }, 'downloadActive').name('Download Active Time of Day (.json)');
        todExportFolder.add({
            downloadDay: async () => (await getTODExporter()).exportPhase(0, true)
        }, 'downloadDay').name('Download Day Settings (.json)');
        todExportFolder.add({
            downloadDusk: async () => (await getTODExporter()).exportPhase(1, true)
        }, 'downloadDusk').name('Download Dusk Settings (.json)');
        todExportFolder.add({
            downloadNight: async () => (await getTODExporter()).exportPhase(2, true)
        }, 'downloadNight').name('Download Night Settings (.json)');
        todExportFolder.add({
            downloadAll: async () => (await getTODExporter()).exportAllPhases(true)
        }, 'downloadAll').name('Download All environment_settings.json');
        todExportFolder.add({
            importJSON: async () => {
                const input = prompt('Paste Time of Day JSON (Day / Dusk / Night / All):');
                if (input) (await getTODExporter()).importSettings(input);
            }
        }, 'importJSON').name('Import Time of Day (Paste JSON)');

        // 12. Presets & Profiles Folder (Root Level & Environment Subfolder)
        let presetsFolder = gui.addFolder('Presets & Profiles');
        presetsFolder.add(settingsManager, 'presetName').name('New Preset Name');
        presetsFolder.add({
            saveCurrent: () => settingsManager.saveSetting()
        }, 'saveCurrent').name('Save Current as Preset');
        
        const mainPresetDropdown = presetsFolder.add(settingsManager, 'loadPreset', Object.keys(DEFAULT_PRESETS))
            .name('Select Preset')
            .onChange(val => {
                settingsManager.loadSetting(val);
            });
        presetDropdownControllers.push(mainPresetDropdown);

        presetsFolder.add({
            loadSelected: () => settingsManager.loadSetting()
        }, 'loadSelected').name('Load Selected Preset');

        presetsFolder.add({
            loadSaveFile: () => settingsManager.loadFromFile()
        }, 'loadSaveFile').name('Load Save File from Disk (.json)');
        
        presetsFolder.add({
            deleteSelected: () => settingsManager.deleteSetting()
        }, 'deleteSelected').name('Delete Selected Preset');
        
        presetsFolder.add({
            resetToDusk: () => settingsManager.reset()
        }, 'resetToDusk').name('Reset to Default Golden Dusk');

        presetsFolder.add({
            exportJSON: () => settingsManager.exportPresets()
        }, 'exportJSON').name('Export Presets (Copy JSON)');

        presetsFolder.add({
            importJSON: () => settingsManager.importPresets()
        }, 'importJSON').name('Import Presets (Paste JSON)');

        presetsFolder.add({
            exportActiveTOD: async () => (await getTODExporter()).exportActivePhase(false)
        }, 'exportActiveTOD').name('Export Active Time of Day (Copy JSON)');

        presetsFolder.add({
            exportDayTOD: async () => (await getTODExporter()).exportPhase(0, false)
        }, 'exportDayTOD').name('Export Day Settings (Copy JSON)');

        presetsFolder.add({
            exportDuskTOD: async () => (await getTODExporter()).exportPhase(1, false)
        }, 'exportDuskTOD').name('Export Dusk Settings (Copy JSON)');

        presetsFolder.add({
            exportNightTOD: async () => (await getTODExporter()).exportPhase(2, false)
        }, 'exportNightTOD').name('Export Night Settings (Copy JSON)');

        presetsFolder.add({
            exportAllTOD: async () => (await getTODExporter()).exportAllPhases(false)
        }, 'exportAllTOD').name('Export All Times of Day (Copy JSON)');

        presetsFolder.add({
            importTOD: async () => {
                const input = prompt('Paste Time of Day JSON:');
                if (input) (await getTODExporter()).importSettings(input);
            }
        }, 'importTOD').name('Import Time of Day (Paste JSON)');

        updateAllPresetDropdowns('Golden Hour Dusk (Default)');

        // 13. Per-Biome Saves Folder
        const biomeSavesFolder = gui.addFolder('Per-Biome Saves');
        const getActiveBiomeName = () => {
            if (typeof playerGrp !== 'undefined' && playerGrp.position) {
                const b = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
                return b ? b.name : 'Unknown Biome';
            }
            return 'Unknown Biome';
        };

        biomeSavesFolder.add({
            saveActive: () => {
                const bName = getActiveBiomeName();
                if (bName && bName !== 'Unknown Biome') {
                    window.saveBiomeSettings(bName);
                } else {
                    showVisualToast('Cannot save: unknown biome');
                }
            }
        }, 'saveActive').name('Save Current Biome');

        biomeSavesFolder.add({
            resetActive: () => {
                const bName = getActiveBiomeName();
                if (bName && bName !== 'Unknown Biome') {
                    window.resetBiomeSettings(bName);
                } else {
                    showVisualToast('Cannot reset: unknown biome');
                }
            }
        }, 'resetActive').name('Reset Current Biome');

        biomeSavesFolder.add({
            saveAll: () => {
                localStorage.setItem('wanderlust_biome_fog_settings', JSON.stringify(window.biomeFogSettings || {}));
                localStorage.setItem('wanderlust_biome_sky_configs', JSON.stringify(BIOME_SKY_CONFIGS));
                showVisualToast('Saved all biome settings');
            }
        }, 'saveAll').name('Save All Biomes');

        biomeSavesFolder.add({
            resetAll: () => {
                if (confirm('Are you sure you want to reset all biome settings to default?')) {
                    localStorage.removeItem('wanderlust_biome_fog_settings');
                    localStorage.removeItem('wanderlust_biome_sky_configs');
                    window.biomeFogSettings = {};
                    for (let key in window.ORIGINAL_BIOME_SKY_CONFIGS) {
                        if (BIOME_SKY_CONFIGS[key]) {
                            Object.assign(BIOME_SKY_CONFIGS[key], window.ORIGINAL_BIOME_SKY_CONFIGS[key]);
                        }
                        const cleanK = key.replace(/[^\w\s]/gi, '').trim();
                        if (BIOME_SKY_CONFIGS[cleanK]) {
                            Object.assign(BIOME_SKY_CONFIGS[cleanK], window.ORIGINAL_BIOME_SKY_CONFIGS[key]);
                        }
                    }
                    showVisualToast('Reset all biomes to defaults');
                }
            }
        }, 'resetAll').name('Reset All Biomes');

        // Reorder folders: most-used first
        const folderOrder = [
            lowPowerFolder, flightFolder, editorFolder, audioFolder, debugFolder, navFolder, perfFolder, envFolder, presetsFolder, biomeSavesFolder
        ].filter(Boolean);
        const guiContainer = gui.$children || gui.domElement.querySelector('.children') || gui.domElement;
        folderOrder.forEach(f => {
            const dom = f.domElement || f;
            if (dom && dom.parentElement) guiContainer.appendChild(dom);
        });

        // Close all folders by default always
        if (gui.folders) {
            gui.folders.forEach(f => {
                f.close();
            });
        } else {
            for (let i in gui.__folders) {
                gui.__folders[i].close();
            }
        }
        if (isStudio) {
            toggleGUI(true);
            if (gui) gui.close();
            setTimeout(() => {
                setGodMode(true);
                if (typeof playerGrp !== 'undefined' && playerGrp) playerGrp.visible = false;
            }, 100);
        }

        if (typeof loadAllSettings === 'function') {
            loadAllSettings();
        } else if (typeof window.loadAllSettings === 'function') {
            window.loadAllSettings();
        } else if (ctx && typeof ctx.loadAllSettings === 'function') {
            ctx.loadAllSettings();
        }
        isInitializingGui = false;

        let _autoSaveTimer = null;
        let _isReceivingLiveSync = false;

        gui.onChange((event) => {
            if (isInitializingGui || _isReceivingLiveSync) return;
            
            // Broadcast live parameter change to all open game windows immediately (0ms)
            if (event && event.property !== undefined) {
                liveSync.sendParamChange(event.controller && event.controller.parent ? event.controller.parent.title : 'global', event.property, event.value);
            }

            clearTimeout(_autoSaveTimer);
            _autoSaveTimer = setTimeout(() => {
                const fullState = gui.save();
                localStorage.setItem('flightSettings', JSON.stringify(fullState));
                liveSync.sendStateSync(fullState);
            }, 300);
        });

        // Listen for live sync broadcasts from editor window in real-time
        liveSync.onMessage((msg) => {
            if (isInitializingGui) return;
            if (msg.type === 'PARAM_CHANGE') {
                const { key, property, value } = msg.payload || {};
                const targetProp = key || property;
                if (targetProp !== undefined) {
                    _isReceivingLiveSync = true;
                    try {
                        gui.controllersRecursive().forEach(c => {
                            if (c.property === targetProp && c.getValue() !== value) {
                                c.setValue(value);
                            }
                        });
                    } finally {
                        _isReceivingLiveSync = false;
                    }
                }
            } else if (msg.type === 'FULL_STATE_SYNC' && msg.payload && msg.payload.state) {
                _isReceivingLiveSync = true;
                try {
                    gui.load(msg.payload.state);
                } catch (e) {
                } finally {
                    _isReceivingLiveSync = false;
                }
            } else if (msg.type === 'FULL_PRESET_APPLIED' && msg.payload && msg.payload.preset) {
                if (typeof applyPresetData === 'function') {
                    applyPresetData(msg.payload.preset, ctx);
                }
            }
        });
    }

}
