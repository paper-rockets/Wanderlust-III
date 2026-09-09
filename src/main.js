import { initMilkyWay, updateMilkyWay, milkyWayParams, applyMilkyWayTilt, uMilkyWayOpacity, uMilkyWayBrightness, uMilkyWayContrast, uMilkyWayHue, uMilkyWaySat } from './environment/MilkyWaySystem.js';
import { initMoon, updateMoon, moonParams, initAurora, updateAurora, auroraParams, uAuroraOpacity, uAuroraIntensity, uAuroraTime } from './environment/CelestialObjects.js';
import { initAudio, selectMusicTrack, toggleMusic, getAudioContext, getWindGain, getWindFilter, getMusicGain, setAutoAdvance, setMusicMuted as setAudioMuted, updateWindSound, tracks, isTrackPlaying, getCurrentTrackIndex } from './audio/MusicSynthesizer.js';
import { saveAllSettings as runSaveAllSettings, loadAllSettings as runLoadAllSettings, downloadPresetFile, applyPresetData as runApplyPresetData, handlePresetFile as runHandlePresetFile, updateAllPresetDropdowns } from './config/PresetManager.js';
import { initMapUI, toggleMapExpand, drawWorldMap, showVisualToast, toggleFullscreen } from './ui/MinimapHUD.js';
import terrainArch from './world/biomes/terrain-archipelago.js';
import terrainGhibli from './world/biomes/terrain-ghibli.js';
import terrainMtn from './world/biomes/terrain-mountains.js';
import terrainCrystal from './world/biomes/terrain-crystal.js';
import terrainJungle from './world/biomes/terrain-jungle.js';
import terrainMagical from './world/biomes/terrain-magical.js';
import terrainDesert, { desertColors } from './world/biomes/terrain-desert.js';
import terrainNorthPole, { northPoleColors } from './world/biomes/terrain-northpole.js';

import { WaterSystem } from './WaterAnime/WaterSystem.js';
import { WaterEditorGUI } from './WaterAnime/WaterEditorGUI.js';
import { WaterModalUI } from './tools/WaterModalUI.js';
import { zenithColorUniform, horizonColorUniform, sunColorUniform, sunDirUniform, deepColorUniform, shallowColorUniform } from './WaterAnime/OpenSeaOcean.js';
import { cleanBiomeName, DEFAULT_BIOME_FOG_CONFIGS } from './config/FogConfig.js';
import { DEFAULT_PRESETS } from './config/PresetsConfig.js';
import { CrystalSystem } from './entities/CrystalSystem.js';
import { RainSystem } from './vfx/RainSystem.js';
import { GroundFogSystem } from './environment/GroundFogSystem.js';
import { TerrainMeshManager } from './world/TerrainMeshManager.js';
import { FlightControlsBridge } from './physics/FlightControlsBridge.js';
import { TreePlacementEditor } from './tools/TreePlacementEditor.js';
import { initDebugGUI } from './tools/DebugGUI.js';
import { createLightingSystem, updateLightingPosition } from './environment/LightingSystem.js';
import { createBirdSystem, updateBirdsGen, updateFlocks, shiftBirds } from './entities/BirdSystem.js';
import { createDioramaSystem, shiftDiorama } from './entities/DioramaSystem.js';
import { createWindTrails, updateWindTrails, shiftWindTrails } from './vfx/WindTrailsSystem.js';
import { DistanceOverlay } from './vfx/DistanceOverlay.js';
import { liveSync } from './core/LiveSync.js';


import { LOW_GFX, TERRAIN_RES } from './config/constants.js';
import { snoise } from './world/Noise.js';
import { ZONES, WORLD_LENGTH, BLEND_WIDTH } from './world/BiomeManager.js';
import { getBiomeAt, getWorldHeight, getWorldColor, getIslandData, getPathStrength, biomeHeights, biomeScales, globalTerrainParams, biomeWaterHeights, getWorldWaterHeight, worldOriginOffset, setWorldOriginOffset } from './world/TerrainGenerator.js';

    import * as THREE from 'three';

import { PlayerPhysics } from './physics/PlayerPhysics.js';
import { CameraManager } from './physics/CameraManager.js';
import { createProceduralSky } from './shaders/atmosphere/proceduralSky.js';
import { BIOME_SKY_CONFIGS, WEATHER_PRESETS } from './environment/BiomeSkyConfigs.js';
import { setupGodMode, toggleGodMode, updateGodMode } from './physics/GodMode.js';


import { MeshToonNodeMaterial, MeshStandardNodeMaterial, MeshBasicNodeMaterial, PointsNodeMaterial } from 'three/webgpu';
import { uniform, texture, Fn, positionLocal, abs, positionGeometry, sin, step, positionWorld, normalWorld, cameraPosition, float, vec2, vec3, vec4, dot, fract, mix, pow, clamp, normalize, smoothstep as tslSmoothstep, attribute, mod } from 'three/tsl';
import { scene, camera, renderer, clock, applyRenderBudget, prewarmEngineShaders } from './core/Engine.js';
import { deviceTier, tierSettings, budgetedPixelRatio, AdaptiveResolution, describeTier } from './core/DeviceTier.js';
import { StylizedPineSystem } from './entities/StylizedPineSystem.js';
import { AnimatedFlockSystem } from './entities/AnimatedFlockSystem.js';
import { postProcessing as composer, scenePass, initPostProcessing, bloomPass, godRaysPass, initPostProcessingUI, uRolloffKnee, setGodRaySunVisible, uPhaseExposure, uDitherAmount } from './core/PostProcessing.js';


    import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
    import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
    import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
    import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { LensflareMesh, LensflareElement } from 'three/addons/objects/LensflareMesh.js';
    import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
    import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
    // Override addFolder globally to start all folders collapsed, with no auto-expand unless clicked
    const originalAddFolder = GUI.prototype.addFolder;
    GUI.prototype.addFolder = function(title) {
        const folder = originalAddFolder.call(this, title);
        folder.close();
        return folder;
    };
    import { ToonShaderManager } from './vfx/ToonShaderManager.js';
    import { createTerrainMaterial } from './shaders/materials/TerrainNodeMaterial.js';
    import { createTreeMaterial } from './shaders/materials/TreeNodeMaterial.js';
    import { windSwayNode } from './shaders/materials/WindSwayNode.js';
    import { FLIGHT_MODELS } from './config/FlightModelsConfig.js';
    import { FlightModelManager } from './entities/FlightModelManager.js';
    import { BiplaneEngineAudio } from './audio/BiplaneEngineAudio.js';
    import { AMBIENT_TRACKS } from './audio/AmbientMusic.js';
    // Wait for WebGPU Backend to initialize before doing ANY graph or material allocations
    await renderer.init();

    const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : './';
    function resolveAssetUrl(p) {
        if (!p) return p;
        if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:') || p.startsWith('blob:')) return p;
        let cleanPath = p.replace(/^\.?\//, '');
        if (typeof import.meta === 'undefined' || !import.meta.env || !import.meta.env.MODE) {
            if (!cleanPath.startsWith('public/')) {
                cleanPath = 'public/' + cleanPath;
            }
        }
        const cleanBase = BASE_URL.endsWith('/') ? BASE_URL : (BASE_URL + '/');
        return `${cleanBase}${cleanPath}`;
    }
    window.resolveAssetUrl = resolveAssetUrl;

    let isWindOn = false;
    Object.defineProperty(window, 'isWindOn', { get: () => isWindOn, set: (v) => { isWindOn = v; }, configurable: true });
    let isRainOn = false;
    let isWindTrailsOn = true;
    Object.defineProperty(window, 'isWindTrailsOn', { get: () => isWindTrailsOn, set: (v) => { isWindTrailsOn = v; }, configurable: true });
    let isFlightPaused = false;
    Object.defineProperty(window, 'isFlightPaused', { get: () => isFlightPaused, set: (v) => { isFlightPaused = v; }, configurable: true });
    let isShadowsOn = !LOW_GFX;
    let isTreeShadowsOn = false;
    let shadowDistMode = LOW_GFX ? 'Close' : 'Med';
    let isBloomOn = false;
    // Adaptive resolution: samples frame time and nudges the render scale. Targets ~30fps
    // (4K does not need 60). Hysteresis in AdaptiveResolution stops the screen breathing.
    const adaptiveRes = new AdaptiveResolution({
        onScaleChange: (scale) => {
            applyRenderBudget(scale);
            if (typeof params !== 'undefined') params.renderScale = scale;
            if (composer && typeof composer.setSize === 'function') {
                composer.setSize(window.innerWidth, window.innerHeight);
            }
        }
    });
    let cameraZoomDist = parseFloat(localStorage.getItem('wl_zoomDist')) || (deviceTier === 'mobile' ? 22.0 : 12.0);
    if (cameraZoomDist < 6.0) cameraZoomDist = (deviceTier === 'mobile' ? 22.0 : 12.0);
    cameraZoomDist = Math.max(6.0, Math.min(300.0, cameraZoomDist));
    Object.defineProperty(window, 'cameraZoomDist', { get: () => cameraZoomDist, set: (v) => { cameraZoomDist = Math.max(6.0, Math.min(300.0, v)); }, configurable: true });
    if (deviceTier === 'mobile' && cameraZoomDist < 14.0) cameraZoomDist = 22.0;
    let playerPhysics = null;
    let cameraManager = null;
    let currentFrame = 0;
    let logicTimer = 0;
    let animeWaterSystem = null;
    let animeWaterGUI = null;
    let waterEditorFolder = null;
    let globalWaterParam = { waterHeight: 2.4 };
    let waterHeightController = null;
    let globalWaterHeightOffset = 0.0;
    let stdFolder = null;
    let terrainRes = TERRAIN_RES;
    let playerGrp;
    
    let isGodMode = false;
    Object.defineProperty(window, 'isGodMode', { get: () => isGodMode, set: (v) => { isGodMode = v; }, configurable: true });
    let godCamera = null;
    Object.defineProperty(window, 'godCamera', { get: () => godCamera, set: (v) => { godCamera = v; }, configurable: true });
    let godControls = null;
    Object.defineProperty(window, 'godControls', { get: () => godControls, set: (v) => { godControls = v; }, configurable: true });
    let cameraBase = null;
    let isInitializingGui = true;



    const loadedCustomModels = [];
    window.loadedCustomModels = loadedCustomModels;
    let selectedModelIndex = -1;
    window.selectedModelIndex = selectedModelIndex;
    window.setSelectedModelIndex = (idx) => { selectedModelIndex = idx; window.selectedModelIndex = idx; };
    window.getSelectedModelIndex = () => selectedModelIndex;
    let customModelBaseScale = 1.0;
    let customModelScaleMult = 1.0;
    let customModelOffsetX = 0.0;
    let customModelOffsetY = 0.0;
    let customModelOffsetZ = 0.0;
    let customModelRotationY = 0.0;
    let customModelFolder = null;
    let modelDropdownController = null;
    const customModelControllers = {};

    let _mapEl = null;
    let _isMapExpanded = false;
    let _mapCtx = null;
    let _mapCanvas = null;
    let _lastMapX = -999999;
    let _lastMapZ = -999999;
    // --- Modular Minimap & Map UI ---
    initMapUI({
        playerGrp,
        getWorldHeight,
        WORLD_LENGTH,
        onTeleport: () => {
            lastTerrainGridX = -999999;
            lastDepthFieldGridX = -999999;
            lastDepthFieldGridZ = -999999;
            if (typeof _lastMapX !== 'undefined') _lastMapX = -999999;
        }
    });


    let flightModelDropdownController = null;
    let soundMuteController = null;
    let engineSoundController = null;
    let trackDropdownController = null;
    let flightFolder = null;
    let audioFolder = null;
    let presetsFolder = null;
    let presetDropdownControllers = [];

    const gui = new GUI({ title: 'Controls & Settings' });
    window.gui = gui;
    gui.domElement.id = 'main-settings-gui';
    gui.domElement.classList.add('main-settings-gui');
    const origGuiOpen = gui.open.bind(gui);
    gui.open = function(t = true) {
        if (this.$children) this.$children.style.height = '';
        this.domElement.classList.remove('transition');
        return origGuiOpen(t);
    };
    const origGuiClose = gui.close.bind(gui);
    gui.close = function() {
        if (this.$children) this.$children.style.height = '';
        this.domElement.classList.remove('transition');
        return origGuiClose();
    };

    let timePhase = (localStorage.getItem('wl_timePhase') !== null) ? parseInt(localStorage.getItem('wl_timePhase')) : 1; // Default to 1: Dusk

    let envConfigs = [
        {name: 'Day', bg: 0x3a88d6, mid: 0x72b2e8, fog: 0xb8daf2, amb: 0xd8eefa, dir: 0xfffbf0, ambI: 1.25, dirI: 2.50, starOp: 0, sunY: 10000, moonY: -8000, glintCol: 0xfff0d0, cloudCol: 0xfffcf5}, // Day - vibrant Ghibli azure sky, warm crisp sunlight, lush ambient fill, soft periwinkle haze
        {name: 'Dusk', bg: 0x2a5090, mid: 0xc85078, fog: 0xffa07a, amb: 0xffdab9, dir: 0xffaa00, ambI: 1.1, dirI: 3.2, starOp: 0, sunY: 160, moonY: 200, glintCol: 0xffaa00, cloudCol: 0xfffaec}, // Dusk - deep blue zenith, magenta/peach mid, warm golden orange horizon
        {name: 'Twilight', bg: 0x080d1e, mid: 0x121e3d, fog: 0x14223d, amb: 0x485878, dir: 0xd8e8ff, ambI: 0.95, dirI: 2.0, starOp: 1.0, sunY: -8000, moonY: 9000, glintCol: 0x88b0e8, cloudCol: 0x162238}, // Twilight / Night - deep midnight indigo, silver moonlight, balanced starlight contrast
    ];

    const params = {
        worldMode: 'Islands',
        sceneFog: true,
        showFog: true,
        fogNear: 150,
        fogFar: 3000,
        fogDensity: 0.75,
        fogAltitudeScale: 1.2,
        fogAutoAltitude: true,
        fogIntensity: 1.0,
        terrainSmoothing: 0.0,
        trails: isWindTrailsOn,
        shadows: isShadowsOn,
        treeShadows: isTreeShadowsOn,
        shadowDist: shadowDistMode,
        bloom: isBloomOn,
        terrainRes: String(terrainRes),
        autoResolution: false,
        renderScale: 1.0,
        exposureTrim: 1.0,
        dayExposure: 0.95,
        nightExposure: 1.10,
        treeColor0: '#ffffff',
        treeColor1: '#ddff88',
        treeColor2: '#88cc99',
        treeColor3: '#778855',
        treeColor4: '#aaffaa',
        treeColor5: '#bbdd99',
        treeColor6: '#669966',
        summerFilter: !LOW_GFX,
        modelVisible: true,
        wind: isWindOn,
        rain: isRainOn,
        fogPlane: true,
        godRays: true,
        godRayIntensity: 0.60,
        godRayDensity: 0.50,
        godRayDecay: 0.92,
        lumMin: 0.80,
        lumMax: 0.98,
        sunAltitude: 160,
        sunAzimuth: 0,
        lockSunToPlayer: true,
        sunDistance: 20000,
        sunDiscScale: 1.8,
        highlightKnee: 0.75,
        horizonGlow: 0.45,
        treeScale: 1.5,
        ghibliTreeScale: 1.2,
        ghibliTreeDensity: 1.0,
        ghibliTreeMinDist: 4.5,
        ghibliTreeMinHeight: 6.8,
        ghibliTreeMaxHeight: 58.0,
        ghibliTreeWindSway: 1.0,
        quality: LOW_GFX ? 'Low' : 'Regular',
        showTerrain: true,
        showWater: true,
        showTrees: true,
        showProceduralSky: true,
        skyRenderMode: 'Gradient + Clouds',
        enableProceduralClouds: true,
        enableSkydome: false,
        daySkydomeTexture: Math.random() > 0.5 ? '1' : '2',
        nightSkydomeTexture: '2', // Default to 2 because it has the transparency mask
        showVolumetricClouds: false,
        showBirds: true,
        showFogPlanes: true,
        showCrystals: false,
        showMap: true,
        showGUI: false,
        exposure: 1.9,
        shadeMode: 'original',
        rainSize: 2.0,
        rainIntensity: 1.0,
        rainWindX: 1.0,
        rainWindY: 0.5,
        biomeFogOffset: 0,
        birdCount: 60,
        birdScale: 0.8,
        birdFlockRadius: 35,
        birdFlockSpread: 12,
        birdMaxSpeed: 45,
        godMode: false,
        showDistanceOverlay: false,
        distanceOverlayOpacity: 0.28,
        distanceOverlayColor: '#00e5ff',
        distanceOverlayLabels: true,
        distanceOverlayGroundDropline: true,
        distanceOverlayMode: 'Horizontal Level',
    };
    window.params = params;

    const cloudParams = {};
    window.cloudParams = cloudParams;

    const toonShaderManager = new ToonShaderManager();

    // ==========================================
    // SAVE / LOAD PRESETS & PROFILES (DEFAULT_PRESETS imported from PresetsConfig.js)
    // ==========================================

    

    let timeOfDayExporter = null;

    function applyPresetData(p) {
        runApplyPresetData(p, {
            envConfigs,
            params,
            cloudParams,
            flightModelManager,
            gui,
            settingsManager,
            presetDropdownControllers,
            DEFAULT_PRESETS,
            updateAtmoParamsFromPhase: () => { if (typeof window.updateAtmoParamsFromPhase === 'function') window.updateAtmoParamsFromPhase(); },
            setTimePhase
        });
    }

    function handlePresetFile(file) {
        runHandlePresetFile(file, {
            envConfigs,
            params,
            cloudParams,
            flightModelManager,
            gui,
            settingsManager,
            presetDropdownControllers,
            DEFAULT_PRESETS,
            updateAtmoParamsFromPhase: () => { if (typeof window.updateAtmoParamsFromPhase === 'function') window.updateAtmoParamsFromPhase(); },
            setTimePhase,
            showVisualToast
        });
    }

    let fileInput = document.getElementById('wl-preset-file-loader');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'wl-preset-file-loader';
        fileInput.accept = '.json,application/json';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handlePresetFile(e.target.files[0]);
                fileInput.value = '';
            }
        });
        document.body.appendChild(fileInput);
    }

    window.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    window.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.name.endsWith('.json') || file.type === 'application/json') {
                handlePresetFile(file);
            }
        }
    });

    const settingsManager = {
        presetName: 'My Dusk Look 1',
        loadPreset: 'Golden Hour Dusk (Default)',
        loadFromFile: () => { if (fileInput) fileInput.click(); },
        saveSetting: (customName) => {
            const saved = JSON.parse(localStorage.getItem('wl_custom_presets') || '{}');
            let name = (typeof customName === 'string' && customName.trim())
                ? customName.trim()
                : '';

            if (!name) {
                const phaseStr = (typeof timePhase !== 'undefined' && timePhase === 0) ? 'Day' : ((typeof timePhase !== 'undefined' && timePhase === 2) ? 'Night' : 'Dusk');
                let idx = 1;
                while (saved[`Preset ${idx} (${phaseStr})`] || saved[`Preset ${idx}`]) {
                    idx++;
                }
                name = `Preset ${idx} (${phaseStr})`;
            }

            const currentGuiData = gui ? gui.save() : null;
            const currentEnvConfigs = (typeof envConfigs !== 'undefined') ? JSON.parse(JSON.stringify(envConfigs)) : null;
            const currentParams = {};
            for (let k in params) {
                if (typeof params[k] !== 'function') currentParams[k] = params[k];
            }
            const currentCloudParams = (typeof cloudParams !== 'undefined') ? JSON.parse(JSON.stringify(cloudParams)) : null;
            const currentBiomeFogSettings = window.biomeFogSettings ? JSON.parse(JSON.stringify(window.biomeFogSettings)) : null;
            const currentBiomeSkyConfigs = window.BIOME_SKY_CONFIGS ? JSON.parse(JSON.stringify(window.BIOME_SKY_CONFIGS)) : null;
            const currentModelId = (typeof flightModelManager !== 'undefined' && flightModelManager)
                ? (flightModelManager.getCurrentConfig()?.id || 'psx_saviola_s21')
                : 'psx_saviola_s21';

            const d = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            const timeStr = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
            const cleanName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
            const filename = `wanderlust_preset_${cleanName}_${dateStr}_${timeStr}.json`;

            const presetData = {
                name: name,
                timePhase: timePhase,
                guiData: currentGuiData,
                envConfigs: currentEnvConfigs,
                params: currentParams,
                cloudParams: currentCloudParams,
                biomeFogSettings: currentBiomeFogSettings,
                biomeSkyConfigs: currentBiomeSkyConfigs,
                modelId: currentModelId,
                timestamp: d.getTime(),
                date: dateStr,
                time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
            };

            saved[name] = presetData;
            localStorage.setItem('wl_custom_presets', JSON.stringify(saved));
            settingsManager.loadPreset = name;
            updateAllPresetDropdowns(name);

            // Auto-save file to disk
            downloadPresetFile(presetData, filename);

            showVisualToast(`Saved Preset & File: ${filename}`);
            return name;
        },
        loadSetting: (presetName) => {
            const target = presetName || settingsManager.loadPreset;
            if (!target) return;

            if (DEFAULT_PRESETS[target]) {
                const def = DEFAULT_PRESETS[target];
                if (typeof window.setTimePhase === 'function') {
                    window.setTimePhase(def.timePhase);
                } else {
                    timePhase = def.timePhase;
                }
                if (def.envConfigs && Array.isArray(def.envConfigs) && typeof envConfigs !== 'undefined') {
                    for (let i = 0; i < def.envConfigs.length; i++) {
                        if (envConfigs[i]) Object.assign(envConfigs[i], def.envConfigs[i]);
                    }
                }
                if (def.params) {
                    Object.assign(params, def.params);
                }
                if (gui) {
                    gui.controllersRecursive().forEach(c => c.updateDisplay());
                }
                showVisualToast(`Loaded: ${target}`);
                return;
            }

            const saved = JSON.parse(localStorage.getItem('wl_custom_presets') || '{}');
            if (saved[target]) {
                const p = saved[target];
                if (p.envConfigs && Array.isArray(p.envConfigs) && typeof envConfigs !== 'undefined') {
                    for (let i = 0; i < p.envConfigs.length; i++) {
                        if (envConfigs[i]) Object.assign(envConfigs[i], p.envConfigs[i]);
                    }
                }
                if (p.timePhase !== undefined) {
                    if (typeof window.setTimePhase === 'function') {
                        window.setTimePhase(p.timePhase);
                    } else {
                        timePhase = p.timePhase;
                    }
                }
                if (p.params) {
                    Object.assign(params, p.params);
                }
                if (p.cloudParams && typeof cloudParams !== 'undefined') {
                    Object.assign(cloudParams, p.cloudParams);
                }
                if (p.biomeFogSettings && window.biomeFogSettings) {
                    Object.assign(window.biomeFogSettings, p.biomeFogSettings);
                }
                if (p.biomeSkyConfigs && window.BIOME_SKY_CONFIGS) {
                    Object.assign(window.BIOME_SKY_CONFIGS, p.biomeSkyConfigs);
                }
                if (p.modelId && typeof flightModelManager !== 'undefined' && flightModelManager) {
                    flightModelManager.setModelById(p.modelId);
                }
                if (p.guiData && gui) {
                    gui.load(p.guiData);
                }
                if (gui) {
                    gui.controllersRecursive().forEach(c => c.updateDisplay());
                }
                showVisualToast(`Loaded Preset: ${target}`);
            }
        },
        deleteSetting: () => {
            const target = settingsManager.loadPreset;
            if (DEFAULT_PRESETS[target]) {
                showVisualToast(`Cannot delete default preset: ${target}`);
                return;
            }
            const saved = JSON.parse(localStorage.getItem('wl_custom_presets') || '{}');
            if (saved[target]) {
                delete saved[target];
                localStorage.setItem('wl_custom_presets', JSON.stringify(saved));
                settingsManager.loadPreset = 'Golden Hour Dusk (Default)';
                updateAllPresetDropdowns('Golden Hour Dusk (Default)');
                showVisualToast(`Deleted Preset: ${target}`);
            }
        },
        reset: () => {
            settingsManager.loadSetting('Golden Hour Dusk (Default)');
        },
        exportPresets: () => {
            const saved = localStorage.getItem('wl_custom_presets') || '{}';
            navigator.clipboard.writeText(saved).then(() => {
                showVisualToast('Copied Presets JSON to clipboard');
            }).catch(() => {
                prompt('Copy Presets JSON:', saved);
            });
        },
        importPresets: () => {
            const input = prompt('Paste Presets JSON:');
            if (!input) return;
            try {
                const parsed = JSON.parse(input);
                const current = JSON.parse(localStorage.getItem('wl_custom_presets') || '{}');
                Object.assign(current, parsed);
                localStorage.setItem('wl_custom_presets', JSON.stringify(current));
                updateAllPresetDropdowns();
                showVisualToast('Imported Presets successfully');
            } catch(e) {
                alert('Invalid JSON: ' + e.message);
            }
        },
        exportActiveTimeOfDayJSON: () => timeOfDayExporter ? timeOfDayExporter.exportActivePhase(false) : null,
        exportDayJSON: () => timeOfDayExporter ? timeOfDayExporter.exportPhase(0, false) : null,
        exportDuskJSON: () => timeOfDayExporter ? timeOfDayExporter.exportPhase(1, false) : null,
        exportNightJSON: () => timeOfDayExporter ? timeOfDayExporter.exportPhase(2, false) : null,
        exportAllTimesOfDayJSON: () => timeOfDayExporter ? timeOfDayExporter.exportAllPhases(false) : null,
        downloadActiveTimeOfDayJSON: () => timeOfDayExporter ? timeOfDayExporter.exportActivePhase(true) : null,
        downloadDayJSON: () => timeOfDayExporter ? timeOfDayExporter.exportPhase(0, true) : null,
        downloadDuskJSON: () => timeOfDayExporter ? timeOfDayExporter.exportPhase(1, true) : null,
        downloadNightJSON: () => timeOfDayExporter ? timeOfDayExporter.exportPhase(2, true) : null,
        downloadAllEnvironmentSettingsJSON: () => timeOfDayExporter ? timeOfDayExporter.exportAllPhases(true) : null,
        importTimeOfDayJSON: () => {
            const input = prompt('Paste Time of Day JSON (Day / Dusk / Night / All):');
            if (input && timeOfDayExporter) timeOfDayExporter.importSettings(input);
        }
    };

    window.settingsManager = settingsManager;
    window.saveSetting = (name) => settingsManager.saveSetting(name);

    // Using updateAllPresetDropdowns from PresetManager.js

    // Debug GUI Modularized in src/ui/DebugGUI.js
    // Initialized below after engine systems are ready
    initPostProcessingUI();
    godRaysPass.uniforms.uIntensity.value = params.godRayIntensity;
    godRaysPass.uniforms.uDecay.value = params.godRayDecay;
    
    // 2. MODULAR LIGHTING SYSTEM
    const crystalSystem = new CrystalSystem({ scene });
    const instCrystals = crystalSystem.instCrystals;
    const CRYSTAL_COUNT = crystalSystem.count;
    const matCrystal = crystalSystem.matCrystal;
    const crystalBaseY = new Float32Array(CRYSTAL_COUNT).fill(-9999);
    const crystalMinY = new Float32Array(CRYSTAL_COUNT).fill(-9999);
    window.instCrystals = instCrystals;

    const lightingSystem = createLightingSystem({ scene });
    const { ambientLight, dirLight, staticSun, sunMesh, lensflare } = lightingSystem;

    // --- Modular Moon ---
    const { staticMoon, moonMesh } = initMoon({ scene, resolveAssetUrl });
// ==========================================
    // 3. TOON MATERIALS
    // ==========================================
    const gradientColors = new Uint8Array([
        160, 160, 160, 255, // Shadows
        255, 255, 255, 255  // Light
    ]);
    const gradientMap = new THREE.DataTexture(gradientColors, 2, 1, THREE.RGBAFormat);
    gradientMap.needsUpdate = true;
    gradientMap.minFilter = THREE.NearestFilter;
    gradientMap.magFilter = THREE.NearestFilter;
    gradientMap.generateMipmaps = false;

    const matRock = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap, dithering: true });
    const matBush = new THREE.MeshToonMaterial({ color: 0x48a868, gradientMap, dithering: true });
    const matFlower = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap, dithering: true });
    function createSandNoiseTexture(size = 256) {
        const data = new Uint8Array(size * size * 4);
        for (let i = 0; i < size * size * 4; i += 4) {
            const v = Math.floor(Math.random() * 256);
            data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
        }
        const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;
        return texture;
    }
    const sandNoiseMap = createSandNoiseTexture(256);

    const terrainUniforms = {
        uTime: uniform(0),
        uSunDir: uniform(new THREE.Vector3(0.3, 0.8, 0.5)),
        uSandNoiseMap: texture(sandNoiseMap),
        uShimmerMult: uniform(1.0),
        uWorldOriginZ: uniform(0.0),
        uCanopyDensity: uniform(1.0),
        uCanopyScale: uniform(1.0)
    };
    window.terrainUniforms = terrainUniforms;

    const terrainMat = createTerrainMaterial(
        terrainUniforms.uTime,
        terrainUniforms.uSunDir,
        terrainUniforms.uSandNoiseMap,
        terrainUniforms.uShimmerMult,
        terrainUniforms.uWorldOriginZ,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        terrainUniforms.uCanopyDensity,
        terrainUniforms.uCanopyScale
    );
    const treeUniforms = {
        uPlayerPos: uniform(new THREE.Vector3(0, 0, 0)),
        uTreeScale: uniform(1.5)
    };
    window.treeUniforms = treeUniforms;
    
    const matTree = createTreeMaterial(
        terrainUniforms.uTime,
        terrainUniforms.uSunDir,
        treeUniforms.uTreeScale,
        gradientMap
    );







    // Modular Terrain Mesh Manager
    const TERRAIN_SIZE = 8000;
    const terrainMeshManager = new TerrainMeshManager({ scene, terrainMat, terrainRes, terrainSize: TERRAIN_SIZE });
    const terrain = terrainMeshManager.terrain;
    let terrainGeo = terrainMeshManager.terrainGeo;
    let lastTerrainGridX = -9999;
    let lastTerrainGridZ = -9999;
    let lastDepthFieldGridX = -999999;
    let lastTerrainScale = 1.0;
    let terrainScale = 1.0;
    const updateTerrainGeometry = (px, pz) => terrainMeshManager.update(px, pz, animeWaterSystem);

    // ==========================================
    // 6. INSTANCED DIORAMA PROPS
    // ==========================================
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const ROCK_COUNT = 0;
    const BUSH_COUNT = 0;
    const FLOWER_COUNT = 0; // Optimized for FPS
    const TREE_MULT = 0.15; // Doubled tree count so entire landscape and horizon are filled with dense forests
    
    function applyColor(geometry, colorHex, isBark = false) {
        const color = new THREE.Color(colorHex);
        const colors = [];
        const count = geometry.attributes.position.count;
        for (let i = 0; i < count; i++) {
            colors.push(color.r, color.g, color.b);
        }
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const isBarkArr = new Float32Array(count);
        isBarkArr.fill(isBark ? 1.0 : 0.0);
        geometry.setAttribute('aIsBark', new THREE.BufferAttribute(isBarkArr, 1));
    }

    // Legacy trees removed -- replaced exclusively by StylizedPineSystem
    const PINE_CONFIGS = [];
    const pineTreeMeshes = [];
    const instTree1 = null;
    const treeMeshes = [];

    // Prop Geometries
    const geoRock = new THREE.DodecahedronGeometry(2.5, 0);
    const geoBush = new THREE.IcosahedronGeometry(2, 0);
    const geoFlower = new THREE.OctahedronGeometry(0.35, 0);
    const geoCloud = new THREE.IcosahedronGeometry(25, 2);
    geoCloud.scale(2.0, 1.0, 1.5);
    geoCloud.computeVertexNormals();

    // ==========================================
    // DISTANT HORIZON BILLBOARD TREES (DISABLED EVERYWHERE)
    // ==========================================
    const BILLBOARD_TREE_COUNT = 0;
    const billboardMat = new MeshToonNodeMaterial({
        color: 0x52c439,
        transparent: false,
        side: THREE.DoubleSide
    });
    const billboardGeo = new THREE.PlaneGeometry(12, 21.6);
    const instBillboardTrees = new THREE.InstancedMesh(billboardGeo, billboardMat, 1);
    instBillboardTrees.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 800);
    instBillboardTrees.frustumCulled = true;
    instBillboardTrees.visible = false;
    const instJungleBillboardTrees = new THREE.InstancedMesh(billboardGeo, billboardMat, 1);
    instJungleBillboardTrees.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 800);
    instJungleBillboardTrees.frustumCulled = true;
    instJungleBillboardTrees.visible = false;

    // Exact color matching palette derived directly from 3D GLB Pine tree foliage colors
    const billboardTints = [
        new THREE.Color(0x52c439), // Vibrant Ghibli Spring Green (exact 3D tree match)
        new THREE.Color(0x2ea84b), // Lush Emerald Green (exact 3D tree match)
        new THREE.Color(0x44c838), // Rich Meadow Green (exact 3D tree match)
        new THREE.Color(0x64d848), // Bright Sunlit Green (exact 3D tree match)
        new THREE.Color(0x38b000)  // Deep Forest Green
    ];

    treeMeshes.forEach(mesh => {
        mesh.maxCount = mesh.count;
    });


    // Modular Diorama System (Rocks, Bushes, Flowers, Icebergs)
    const dioramaSystem = createDioramaSystem({ scene, LOW_GFX, matRock, matBush, matFlower });
    const { instRocks, instBushes, instFlowers, instIcebergs, ICEBERG_COUNT } = dioramaSystem;


    
    // Initialize Open Sea Ocean WebGPU System
    animeWaterSystem = new WaterSystem(scene, renderer);
    animeWaterSystem.setVisible(params.showWater);
    globalWaterParam.waterHeight = animeWaterSystem.waterLevel;
    if (waterHeightController) waterHeightController.updateDisplay();
    window.waterModalUI = new WaterModalUI(animeWaterSystem);
    window.summonWaterModal = async (show = true) => {
        if (!window.waterModalUI) {
            window.waterModalUI = new WaterModalUI(animeWaterSystem);
        }
        if (show && window.waterModalUI && window.waterModalUI.toggle) {
            window.waterModalUI.toggle();
        }
        return window.waterModalUI;
    };
    animeWaterGUI = new WaterEditorGUI(animeWaterSystem, gui);

    // Modular Rain System
    window.rainSystem = new RainSystem(scene);

    // Modular Volumetric Ground Fog
    const groundFogSystem = new GroundFogSystem({ scene });
    const fogGroup = groundFogSystem.group;
    const fogUniforms = groundFogSystem.uniforms;
    const fogMat = groundFogSystem.mat;
    
    window.BIOME_SKY_CONFIGS = BIOME_SKY_CONFIGS;
    window.ORIGINAL_BIOME_SKY_CONFIGS = JSON.parse(JSON.stringify(BIOME_SKY_CONFIGS));
    
    // Load custom biome settings from localStorage
    try {
        const savedSky = localStorage.getItem('wanderlust_biome_sky_configs');
        if (savedSky) {
            const parsed = JSON.parse(savedSky);
            for (let k in parsed) {
                if (BIOME_SKY_CONFIGS[k]) {
                    Object.assign(BIOME_SKY_CONFIGS[k], parsed[k]);
                } else {
                    BIOME_SKY_CONFIGS[k] = parsed[k];
                }
            }
        }
    } catch(e) {
        console.error('Failed to load wanderlust_biome_sky_configs', e);
    }

    try {
        const savedFog = localStorage.getItem('wanderlust_biome_fog_settings');
        window.biomeFogSettings = savedFog ? JSON.parse(savedFog) : {};
    } catch(e) {
        window.biomeFogSettings = {};
    }

    // Ensure all clean keys map to the same config objects in BIOME_SKY_CONFIGS
    Object.keys(BIOME_SKY_CONFIGS).forEach(k => {
        const cleanK = k.replace(/[^\w\s]/gi, '').trim();
        if (cleanK !== k) {
            BIOME_SKY_CONFIGS[cleanK] = BIOME_SKY_CONFIGS[k];
        }
    });

    window.saveBiomeSettings = (biomeName) => {
        if (!biomeName) return;
        localStorage.setItem('wanderlust_biome_fog_settings', JSON.stringify(window.biomeFogSettings || {}));
        localStorage.setItem('wanderlust_biome_sky_configs', JSON.stringify(BIOME_SKY_CONFIGS));
        showVisualToast(`Saved settings for ${biomeName}`);
    };

    window.resetBiomeSettings = (biomeName) => {
        if (!biomeName) return;
        const cleanName = biomeName.replace(/[^\w\s]/gi, '').trim().toLowerCase();
        
        // Reset fog setting
        if (window.biomeFogSettings) {
            delete window.biomeFogSettings[biomeName];
            for (let k in window.biomeFogSettings) {
                if (k.replace(/[^\w\s]/gi, '').trim().toLowerCase() === cleanName) {
                    delete window.biomeFogSettings[k];
                }
            }
        }
        
        // Reset sky config to original
        for (let key in window.ORIGINAL_BIOME_SKY_CONFIGS) {
            const cleanKey = key.replace(/[^\w\s]/gi, '').trim().toLowerCase();
            if (cleanKey === cleanName) {
                if (BIOME_SKY_CONFIGS[key]) {
                    Object.assign(BIOME_SKY_CONFIGS[key], window.ORIGINAL_BIOME_SKY_CONFIGS[key]);
                }
                const cleanActualKey = key.replace(/[^\w\s]/gi, '').trim();
                if (BIOME_SKY_CONFIGS[cleanActualKey]) {
                    Object.assign(BIOME_SKY_CONFIGS[cleanActualKey], window.ORIGINAL_BIOME_SKY_CONFIGS[key]);
                }
            }
        }
        
        localStorage.setItem('wanderlust_biome_fog_settings', JSON.stringify(window.biomeFogSettings || {}));
        localStorage.setItem('wanderlust_biome_sky_configs', JSON.stringify(BIOME_SKY_CONFIGS));
        showVisualToast(`Reset settings for ${biomeName}`);
    };

    window.getBiomeAt = getBiomeAt;

    // On-demand lazy-loader for GroundFogEditor
    window.summonGroundFogEditor = async () => {
        if (!window.groundFogEditor) {
            const { GroundFogEditor } = await import('./tools/GroundFogEditor.js');
            window.groundFogEditor = new GroundFogEditor();
            window.groundFogEditor.startBiomePolling();
        }
        return window.groundFogEditor;
    };
    window.summonGroundFogEditor().catch(() => {});

    // On-demand lazy-loader for ArchipelagoEditorUI
    window.summonArchipelagoEditor = async () => {
        if (!window.archipelagoEditor) {
            const { ArchipelagoEditorUI } = await import('./tools/ArchipelagoEditorUI.js');
            window.archipelagoEditor = new ArchipelagoEditorUI({
                onTerrainModified: () => {
                    lastTerrainGridX = -999999;
                    lastTerrainGridZ = -999999;
                    lastDepthFieldGridX = -999999;
                    lastDepthFieldGridZ = -999999;
                    if (playerGrp) updateTerrainGeometry(playerGrp.position.x, playerGrp.position.z);
                    if (typeof stylizedTrees !== 'undefined' && stylizedTrees && typeof stylizedTrees.respawn === 'function') {
                        stylizedTrees.respawn();
                    }
                },
                teleportPlayer: (x, y, z) => {
                    if (playerGrp) {
                        playerGrp.position.set(x, y, z);
                        if (isGodMode && godCamera) {
                            godCamera.position.set(x, y + 80, z + 120);
                            if (godControls) godControls.target.set(x, y, z);
                        }
                        lastTerrainGridX = -999999;
                        lastTerrainGridZ = -999999;
                        lastDepthFieldGridX = -999999;
                        lastDepthFieldGridZ = -999999;
                        updateTerrainGeometry(x, z);
                        if (typeof stylizedTrees !== 'undefined' && stylizedTrees && typeof stylizedTrees.respawn === 'function') {
                            stylizedTrees.respawn();
                        }
                    }
                }
            });
        }
        return window.archipelagoEditor;
    };

    treeMeshes.forEach(mesh => {
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 800);
        mesh.frustumCulled = true;
        scene.add(mesh);
    });
    instRocks.visible = false;
    [instBushes, instFlowers].forEach(mesh => {
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 800);
        mesh.frustumCulled = true;
        scene.add(mesh);
    });
    
    // ==========================================
    // PROCEDURAL SKYDOME (replaces PNG cubemap + SpiralNoiseC cloud dome)
    // ==========================================
    const { mesh: proceduralSkyMesh, material: proceduralSkyMat, uniforms: skyUniforms } = createProceduralSky();
    window._skyDbg = skyUniforms;
    scene.add(proceduralSkyMesh);

    // --- Modular Milky Way System ---
    const { milkyWayMesh } = initMilkyWay({ scene, resolveAssetUrl });
// ==========================================
    // --- Modular Aurora System ---
    const { auroraMesh } = initAurora({ scene });
// SKY MODE. "flat" reproduces flight-merged (WebGL): the procedural dome is hidden and a solid
    // background colour carries the sky, which the dense fog fades geometry into. The dome is kept
    // in the scene so it can be toggled back on from the Cloud Editor.
    // Why flat is the default: with postProcessing.outputColorTransform = false there is no
    // tonemapping to roll off highlights, so the dome horizon gradient exceeds 1.0 and hard-clips
    // to a full-width white band across the screen. Solid background has no such gradient.
    let skyRenderMode = localStorage.getItem("wl_skyRenderMode") || "Gradient + Clouds";
    function setSkyRenderMode(mode) {
        skyRenderMode = mode;
        localStorage.setItem("wl_skyRenderMode", skyRenderMode);
        params.skyRenderMode = mode;

        if (mode === "Gradient + Clouds") {
            proceduralSkyMesh.visible = true;
            params.showProceduralSky = true;
            params.enableProceduralClouds = true;
            if (skyUniforms.uEnableProceduralClouds) skyUniforms.uEnableProceduralClouds.value = 1.0;
            if (skyUniforms.uGradientSkyEnabled) skyUniforms.uGradientSkyEnabled.value = 1.0;
            scene.background = null;
        } else if (mode === "Gradient Regular") {
            proceduralSkyMesh.visible = true;
            params.showProceduralSky = true;
            params.enableProceduralClouds = false;
            if (skyUniforms.uEnableProceduralClouds) skyUniforms.uEnableProceduralClouds.value = 0.0;
            if (skyUniforms.uGradientSkyEnabled) skyUniforms.uGradientSkyEnabled.value = 1.0;
            scene.background = null;
        } else if (mode === "Flat Solid") {
            proceduralSkyMesh.visible = false;
            params.showProceduralSky = false;
            params.enableProceduralClouds = false;
            const curTarget = (typeof envConfigs !== 'undefined' && envConfigs[timePhase]) ? envConfigs[timePhase] : { bg: 0x8cbce6 };
            scene.background = new THREE.Color(curTarget.bg);
        }

        if (typeof gui !== 'undefined' && gui) {
            gui.controllersRecursive().forEach(c => {
                if (c.property === 'skyRenderMode' || c.property === 'showProceduralSky' || c.property === 'enableProceduralClouds') {
                    c.updateDisplay();
                }
            });
        }
    }
    setSkyRenderMode(skyRenderMode);
    window.setSkyRenderMode = setSkyRenderMode;
    window.applySkyMode = (m) => setSkyRenderMode(m === "flat" ? "Flat Solid" : "Gradient + Clouds");
    let currentWeather = 'clear';

    // --- REMOVED: old toon cloud dome + cubemap skybox ---
    // Kept as dead code reference, remove once procedural sky is validated
    const _OLD_SKYDOME_REMOVED = true; // marker
    if (false) { // dead code block
    const toonCloudGeo = new THREE.SphereGeometry(22000, 32, 16);
    const toonCloudMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        uniforms: {
            uTime: { value: 0 },
            uSunDir: { value: new THREE.Vector3(-0.077, 0.5, 0.577).normalize() },
            uCloudDensity: { value: 1.0 },
            uCloudHeight: { value: 800.0 },
            uSkyColor: { value: new THREE.Color(0x8cbce6) },
            uCloudColor: { value: new THREE.Color(0xfffaec) },
            uEnableClouds: { value: 1.0 }
        },
        vertexShader: `
            varying vec3 vWorldPos;
            varying vec3 vViewDir;
            void main() {
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPos.xyz;
                vViewDir = normalize(worldPos.xyz - cameraPosition);
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform vec3 uSunDir;
            uniform float uCloudDensity;
            uniform float uCloudHeight;
            uniform vec3 uSkyColor;
            uniform vec3 uCloudColor;
            uniform float uEnableClouds;

            varying vec3 vWorldPos;
            varying vec3 vViewDir;

            const float nudge = 0.739513;
            float normalizer = 1.0 / sqrt(1.0 + nudge*nudge);

            float SpiralNoiseC(vec3 p) {
                float n = 0.0;
                float iter = 1.0;
                for (int i = 0; i < 5; i++) {
                    vec3 spin = sin(p * iter);
                    n += -abs(spin.x + spin.y + spin.z) / iter;
                    p.xy += vec2(p.y, -p.x) * nudge;
                    p.xy *= normalizer;
                    p.xz += vec2(p.z, -p.x) * nudge;
                    p.xz *= normalizer;
                    iter *= 1.733733;
                }
                return n;
            }

            float getCloud(vec3 pos) {
                vec3 p = pos * 0.0012 + vec3(uTime * 0.015, 0.0, uTime * 0.008);
                float noise = SpiralNoiseC(p);
                float heightFalloff = smoothstep(100.0, 1200.0, pos.y) * smoothstep(5000.0, 2000.0, pos.y);
                float coverage = (uCloudDensity * 0.8 - 0.7); // Tweak coverage to create holes
                float cloudVal = noise * 0.5 + coverage + heightFalloff * 0.6;
                return clamp(cloudVal, 0.0, 1.0);
            }

            void main() {
                if (uEnableClouds < 0.5 || vViewDir.y < -0.05) {
                    discard;
                }

                vec3 dir = normalize(vViewDir);
                float rayT = (uCloudHeight - cameraPosition.y) / max(dir.y, 0.01);
                
                if (rayT <= 0.0 || rayT > 16000.0) {
                    discard;
                }

                vec3 pos = cameraPosition + dir * rayT;
                float cloudDensity = getCloud(pos);

                if (cloudDensity < 0.01) {
                    discard;
                }

                float alpha = smoothstep(0.01, 0.45, cloudDensity);
                float diff = clamp(dot(vec3(0.0, 1.0, 0.0), uSunDir), 0.5, 1.0);
                
                vec3 col = mix(uCloudColor, uCloudColor * 1.15, diff * 0.3);

                gl_FragColor = vec4(col, alpha * 0.95);
            }
        `
    });

    const toonCloudDome = new THREE.Mesh(toonCloudGeo, toonCloudMat);
    // scene.add(toonCloudDome);
    


    // ==========================================
    // SKYDOME
    // ==========================================
    let daySkyboxMesh;
    let nightSkyboxMesh;
    const skyboxTexLoader = new THREE.TextureLoader();

    // Skydome Implementation
    const skydomeGeo = new THREE.BoxGeometry(18000, 18000, 18000, 16, 16, 16);
    const dayFaces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    const dayMats = dayFaces.map(face => {
        const tex = skyboxTexLoader.load(`assets/skydome/day/${params.daySkydomeTexture}/${face}.png`);
        tex.colorSpace = THREE.SRGBColorSpace;
        return new THREE.MeshBasicMaterial({
            map: tex,
            side: THREE.BackSide,
            fog: false,
            depthWrite: false,
            transparent: true,
            opacity: 0.0
        });
    });
    daySkyboxMesh = new THREE.Mesh(skydomeGeo, dayMats);
    daySkyboxMesh.renderOrder = -1;
    scene.add(daySkyboxMesh);

    const nightFaces = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    const nightMats = nightFaces.map(face => {
        const tex = skyboxTexLoader.load(`assets/skydome/night/${params.nightSkydomeTexture}/${face}.png`);
        tex.colorSpace = THREE.SRGBColorSpace;
        const matArgs = {
            map: tex,
            side: THREE.BackSide,
            fog: false,
            depthWrite: false,
            transparent: true,
            opacity: 0.0
        };
        if (face !== 'ny' && params.nightSkydomeTexture === '2') {
            const trTex = skyboxTexLoader.load(`assets/skydome/night/${params.nightSkydomeTexture}/${face} tr.png`);
            matArgs.alphaMap = trTex;
        }
        return new THREE.MeshBasicMaterial(matArgs);
    });
    nightSkyboxMesh = new THREE.Mesh(skydomeGeo, nightMats);
    nightSkyboxMesh.renderOrder = -2;
    scene.add(nightSkyboxMesh);
    } // end dead code block

    // Initialize all to hidden
    const dummyMatrix = new THREE.Matrix4();
    dummyMatrix.makeScale(0, 0, 0);
    dummyMatrix.setPosition(0, -1000, 0);
    [...treeMeshes, instRocks, instBushes, instFlowers].forEach(mesh => {
        for(let i=0; i<mesh.count; i++) {
            mesh.setMatrixAt(i, dummyMatrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    });



    // Modular Bird System
    const birdSystem = createBirdSystem({ scene, LOW_GFX, terrainUniforms, gradientMap });
    const { instBirds, instHighBirds, birdData, highBirdData, BIRD_COUNT, HIGH_BIRD_COUNT, MAX_BIRD_COUNT, matBird } = birdSystem;
    window.instBirds = instBirds;
    window.matBird = matBird;
    window.MAX_BIRD_COUNT = MAX_BIRD_COUNT;

    // Modular Wind Trails System
    const windTrails = createWindTrails({ scene });
    const { instTrails, trailsData } = windTrails;

    function updateBirds(playerX, playerY, playerZ, time, dt) {
        updateFlocks(playerX, playerY, playerZ, time, dt, typeof velocity !== 'undefined' ? velocity : 35);
    }

    const dummy = new THREE.Object3D();

    const treeGrid = new Map();
    const TREE_CELL_SIZE = 15;
    function getTreeCell(x, z) {
        const cx = (Math.floor(x / TREE_CELL_SIZE) + 32768) & 0xFFFF;
        const cz = (Math.floor(z / TREE_CELL_SIZE) + 32768) & 0xFFFF;
        return (cx << 16) | cz;
    }

    const treeDist = 520; // Focused tree spawn radius so trees are dense around the player!
    let isPrewarming = false;

    function isTreeZone(worldX, worldZ) {
        return getBiomeAt(worldX, worldZ).treesOk;
    }

    let prevGhibliTreeScale = params.ghibliTreeScale || 1.2;
    function updateGhibliTreeScale(newScale) {
        if (!newScale || newScale <= 0) return;
        const ratio = newScale / prevGhibliTreeScale;
        prevGhibliTreeScale = newScale;
        const dummyObj = new THREE.Object3D();
        pineTreeMeshes.forEach(mesh => {
            const count = mesh.maxCount || mesh.count;
            let changed = false;
            for (let i = 0; i < count; i++) {
                mesh.getMatrixAt(i, dummyObj.matrix);
                dummyObj.matrix.decompose(dummyObj.position, dummyObj.quaternion, dummyObj.scale);
                if (dummyObj.position.y > -500) {
                    dummyObj.scale.multiplyScalar(ratio);
                    dummyObj.updateMatrix();
                    mesh.setMatrixAt(i, dummyObj.matrix);
                    changed = true;
                }
            }
            if (changed) mesh.instanceMatrix.needsUpdate = true;
        });
    }
    window.updateGhibliTreeScale = updateGhibliTreeScale;

    function respawnGhibliTrees() {
        treeGrid.clear();
        const dummyObj = new THREE.Object3D();
        dummyObj.position.set(0, -1000, 0);
        dummyObj.scale.set(0, 0, 0);
        dummyObj.updateMatrix();
        pineTreeMeshes.forEach(mesh => {
            const count = mesh.maxCount || mesh.count;
            for (let i = 0; i < count; i++) {
                mesh.setMatrixAt(i, dummyObj.matrix);
            }
            mesh.instanceMatrix.needsUpdate = true;
        });
    }
    window.respawnGhibliTrees = respawnGhibliTrees;

    function updateInstances(playerX, playerZ, time, dt, playerYaw) {
        const dist = 850; 
        
        logicTimer += dt;
        const shouldUpdateTerrain = logicTimer >= (1.0 / 15.0);
        if (shouldUpdateTerrain) {
            logicTimer = 0;
        }
        




        if (shouldUpdateTerrain) {
            const isFreeCamVis = (window.editorState && window.editorState.isEditorMode) || isGodMode;
            const visFocusX = isFreeCamVis ? (isGodMode ? godCamera.position.x : camera.position.x) : playerX;
            const visFocusZ = isFreeCamVis ? (isGodMode ? godCamera.position.z : camera.position.z) : playerZ;
            
            const checkDist = 800; // max tree radius
            const points = [
                { x: visFocusX, z: visFocusZ },
                { x: visFocusX + checkDist, z: visFocusZ },
                { x: visFocusX - checkDist, z: visFocusZ },
                { x: visFocusX, z: visFocusZ + checkDist },
                { x: visFocusX, z: visFocusZ - checkDist }
            ];
            
            let treesPossibleNearby = false;
            for (let pIdx = 0; pIdx < points.length; pIdx++) {
                const p = points[pIdx];
                const biome = getBiomeAt(p.x, p.z);
                const islandData = getIslandData(p.x, p.z);
                if (biome && biome.treesOk && islandData.mask > 0.0) {
                    treesPossibleNearby = true;
                    break;
                }
            }

            // Check BOTH b1 and b2 — at biome borders mainBiome may still be non-jungle
            // even though the terrain is visually blending into jungle
            const _visData = getIslandData(visFocusX, visFocusZ);
            const _b1Jungle = _visData.b1 && _visData.b1.name && _visData.b1.name.toLowerCase().includes('jungle');
            const _b2Jungle = _visData.b2 && _visData.b2.name && _visData.b2.name.toLowerCase().includes('jungle');
            const _inJungle = _b1Jungle || _b2Jungle;
            
            const showAnyTrees = params.showTrees && treesPossibleNearby;
            
            if (treeMeshes) treeMeshes.forEach(m => m.visible = showAnyTrees && !_inJungle);
            if (window.instPalmTreeParts) window.instPalmTreeParts.forEach(m => m.visible = showAnyTrees && !_inJungle);
            if (typeof instBillboardTrees !== 'undefined') instBillboardTrees.visible = false;
            if (typeof instJungleBillboardTrees !== 'undefined') instJungleBillboardTrees.visible = false;
            if (window.instJungleTreeParts) window.instJungleTreeParts.forEach(m => m.visible = showAnyTrees);

            // Center tree updates on camera position when in editor/freecam/God Mode or player when flying
            const focusX = visFocusX;
            const focusZ = visFocusZ;
            const activeCam = isFreeCamVis ? (isGodMode ? godCamera : camera) : camera;
            
            // Stylized Pine Biome Trees: natural clusters + accents, multi-point cliff exclusion,
            // active camera frustum culling, and 3 LOD bands.
            if (stylizedTrees && stylizedTrees.ready) {
                stylizedTrees.update(focusX, focusZ, activeCam);
            }

        } // End of shouldUpdateTerrain block

        // Animals


    }

    // ==========================================
    // 7. PLAYER SETUP
    // ==========================================
    playerGrp = new THREE.Group();
    playerGrp.position.set(0, 45, 8000);
    scene.add(playerGrp);
    window.playerGrp = playerGrp;

    const initialBiome = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
    const initialBiomeEl = document.getElementById('biome-label');
    if (initialBiomeEl && initialBiome) initialBiomeEl.innerText = initialBiome.name;

    const playerVisuals = new THREE.Group();
    playerGrp.add(playerVisuals);

    const proxyGeo = new THREE.BoxGeometry(1.5, 0.5, 3);
    const proxyMat = new THREE.MeshToonMaterial({ color: 0xcc4444, gradientMap });
    const proxyMesh = new THREE.Mesh(proxyGeo, proxyMat);
    proxyMesh.castShadow = true;
    playerVisuals.add(proxyMesh);
    window.proxyMesh = proxyMesh;

    // Dual Warm Illumination Lights on Both Sides of Kiki
    const kikiLeftLight = new THREE.PointLight(0xffaa44, 2.5, 300, 1.2);
    kikiLeftLight.position.set(-35, 15, 10);
    playerVisuals.add(kikiLeftLight);
    window.kikiLeftLight = kikiLeftLight;

    const kikiRightLight = new THREE.PointLight(0xffaa44, 2.5, 300, 1.2);
    kikiRightLight.position.set(35, 15, 10);
    playerVisuals.add(kikiRightLight);
    window.kikiRightLight = kikiRightLight;

    // Load GLTF Model Loaders
    const gltfLoader = new GLTFLoader();
    
    // Initialize DRACOLoader for compressed GLB meshes
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    gltfLoader.setDRACOLoader(dracoLoader);
    
    // Initialize KTX2Loader for compressed textures
    const ktx2Loader = new KTX2Loader()
        .setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.185.0/examples/jsm/libs/basis/')
        .detectSupport(renderer);
    gltfLoader.setKTX2Loader(ktx2Loader);
    
    // Initialize MeshoptDecoder for compressed geometries
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    // Flight Model Manager initialization
    const flightModelManager = new FlightModelManager(playerVisuals, gltfLoader, resolveAssetUrl);
    window.flightModelManager = flightModelManager;

    // Animated Birds Flock (low_poly_bird_animated_optimized.glb)
    const birdFlock = new AnimatedFlockSystem({
        scene,
        gltfLoader,
        resolveAssetUrl,
        count: LOW_GFX ? 12 : 25,
        modelPath: 'flight_models/low_poly_bird_animated_optimized.glb',
        scale: 0.08,
        rotYOffset: 0,
        altitudeOffset: 65,
        flockRadius: 80
    });
    window.birdFlock = birdFlock;

    // Flamingo Flock (flamingo.glb) - Warm zones only, Daytime only!
    const flamingoFlock = new AnimatedFlockSystem({
        scene,
        gltfLoader,
        resolveAssetUrl,
        count: LOW_GFX ? 8 : 16,
        modelPath: 'flight_models/flamingo.glb',
        scale: params.flamingoScale || 0.007,
        rotYOffset: 0,
        isWarmOnly: true,
        dayOnly: true,
        getTimePhase: () => timePhase,
        getBiomeAt,
        altitudeOffset: 50,
        flockRadius: 90
    });
    window.flamingoFlock = flamingoFlock;

    // ==========================================
    // STYLIZED PINE TREES (procedural, instanced, LOD)
    // ==========================================
    const stylizedTrees = new StylizedPineSystem({
        scene,
        camera,
        gltfLoader,
        resolveAssetUrl,
        uTime: terrainUniforms.uTime,
        uSunDir: terrainUniforms.uSunDir,
        gradientMap,
        getWorldHeight: (x, z) => terrainMeshManager.getGroundedHeight(x, z),
        getBiomeAt,
        getIslandData,
        getPathStrength,
        densityScale: tierSettings.treeDensity
    });
    window.stylizedTrees = stylizedTrees;
    stylizedTrees.load().then(ok => {
        if (ok) {
            console.info(`[Wanderlust] Stylized pines ready — pools near/mid/far =`,
                stylizedTrees.poolSizes, `(tier ${deviceTier})`);
            stylizedTrees.respawn();
        } else {
            console.warn('[Wanderlust] Stylized pine tree system failed to build geometry');
        }
    }).catch(err => console.error('[Wanderlust] Stylized pine tree load failed:', err));

    let isModelVisible = true;
    let isSoundMuted = false;
    let isEngineSoundOn = true;

    // Procedural Biplane Engine Audio
    const biplaneAudio = new BiplaneEngineAudio(null);
    window.biplaneAudio = biplaneAudio;

    function onFlightModelChanged(cfg) {
        if (!cfg) return;
        const isPlane = !!cfg.isPlane;
        if (biplaneAudio) {
            if (!biplaneAudio.audioCtx) {
                const ctx = (typeof getAudioContext === 'function' ? getAudioContext() : null) || window.audioCtx;
                if (ctx) biplaneAudio.setAudioContext(ctx);
            }
            if (isPlane && isEngineSoundOn && !isSoundMuted) {
                biplaneAudio.setActive(true);
            } else {
                biplaneAudio.setActive(false);
            }
        }
        const topEngineBtn = document.getElementById('top-engine-btn');
        if (topEngineBtn) {
            topEngineBtn.style.display = isPlane ? 'inline-flex' : 'none';
            if (isPlane) {
                topEngineBtn.style.opacity = isEngineSoundOn ? '1' : '0.45';
                topEngineBtn.style.color = isEngineSoundOn ? '#4ade80' : 'rgba(255, 255, 255, 0.6)';
                topEngineBtn.title = isEngineSoundOn ? `Airplane Engine Sound: ON (${cfg.name}) (Click to Mute)` : `Airplane Engine Sound: OFF (${cfg.name}) (Click to Enable)`;
            }
        }
        const charBtn = document.getElementById('char-toggle');
        if (charBtn) {
            charBtn.innerText = `MODEL: ${cfg.name.toUpperCase()}`;
        }
        const topModelDisplay = document.getElementById('top-model-display');
        if (topModelDisplay) {
            topModelDisplay.textContent = cfg.name;
        }
        const topModelSelect = document.getElementById('top-model-select');
        if (topModelSelect) {
            topModelSelect.value = cfg.id;
        }
        if (typeof proxyMesh !== 'undefined' && proxyMesh) {
            proxyMesh.visible = false;
        }
        try {
            localStorage.setItem('wl_saved_model_id', cfg.id);
        } catch (e) {}
        if (typeof flightModelDropdownController !== 'undefined' && flightModelDropdownController) {
            if (flightModelDropdownController.getValue() !== cfg.id) {
                flightModelDropdownController.setValue(cfg.id);
            }
        }
    }

    window.addEventListener('flight-model-changed', (e) => {
        if (e && e.detail && e.detail.config) {
            onFlightModelChanged(e.detail.config);
            if (toonShaderManager && toonShaderManager.mode && toonShaderManager.mode !== 'original') {
                toonShaderManager.apply(scene, toonShaderManager.mode);
            }
        }
    });

    // Initialize initial state for engine button based on starting model
    const initCfg = flightModelManager.getCurrentConfig();
    if (initCfg) {
        onFlightModelChanged(initCfg);
    }

    // Initialize Distance Overlay (100m, 200m, 300m, 400m, 500m, 600m, 1000m)
    const distanceOverlay = new DistanceOverlay({
        scene,
        camera,
        config: {
            visible: params.showDistanceOverlay,
            opacity: params.distanceOverlayOpacity,
            color: params.distanceOverlayColor,
            showLabels: params.distanceOverlayLabels,
            showGroundDropline: params.distanceOverlayGroundDropline,
            mode: params.distanceOverlayMode
        }
    });
    window.distanceOverlay = distanceOverlay;
    window.toggleDistanceOverlay = (forceVal) => {
        if (!distanceOverlay) return;
        const nextVal = forceVal !== undefined ? forceVal : !params.showDistanceOverlay;
        params.showDistanceOverlay = nextVal;
        distanceOverlay.setVisible(nextVal);
        showVisualToast(nextVal ? 'Distance Rings: ON' : 'Distance Rings: OFF', flightModelManager);
        if (gui && typeof gui.controllersRecursive === 'function') {
            gui.controllersRecursive().forEach(c => {
                if (c.property === 'showDistanceOverlay' && typeof c.updateDisplay === 'function') {
                    c.updateDisplay();
                }
            });
        }
        return nextVal;
    };

    // Initialize Modular Debug GUI (Performance, Biomes, Atmosphere, Water, Trees, Audio)
    initDebugGUI({
        gui,
        params,
        cloudParams,
        adaptiveRes,
        uDitherAmount,
        terrain,
        terrainGeo,
        terrainMeshManager,
        playerGrp,
        scene,
        camera,
        renderer,
        cameraBase,
        dirLight,
        bloomPass,
        settingsManager,
        playerPhysics,
        cameraManager,
        stylizedTrees,
        isInitializingGui,
        LOW_GFX,
        presetDropdownControllers,
        envConfigs,
        setTimePhase,
        applyPresetData,
        handlePresetFile,
        saveCustomPreset: (name) => settingsManager.saveSetting(name),
        loadCustomPreset: (name) => settingsManager.loadSetting(name),
        deleteCustomPreset: (name) => settingsManager.deleteSetting ? settingsManager.deleteSetting(name) : null,
        crystalSystem,
        rainSystem: window.rainSystem,
        animeWaterSystem,
        animeWaterGUI,
        archipelagoEditorUI: null,
        groundFogEditor: null,
        flightModelManager,
        toggleModelVisibility: updateModelVisibility,
        globalWaterParam,
        skyUniforms,
        toonShaderManager,
        treeMeshes,
        distanceOverlay
    });

    window.summonDebugGUI = () => {
        if (gui) {
            gui.show();
            if (gui._hidden) gui.open();
        }
        return gui;
    };

    window.toggleGUI = () => {
        if (gui) {
            if (gui._hidden) gui.show();
            else gui.hide();
        }
    };

    // Real-time Live Sync Receiver for Dual-Window Studio Mode
    liveSync.onMessage((msg) => {
        if (!msg || !msg.type) return;
        if (msg.type === 'SET_TIME_PHASE') {
            const phase = msg.payload.phase;
            if (typeof setTimePhase === 'function') {
                setTimePhase(phase);
                if (typeof updateAtmoParamsFromPhase === 'function') updateAtmoParamsFromPhase();
            }
        } else if (msg.type === 'PARAM_CHANGE') {
            const { category, key, value } = msg.payload || {};
            
            // Exposure & Lighting
            if (key === 'exposure') {
                renderer.toneMappingExposure = value;
                params.exposure = value;
                params.dayExposure = value;
            }
            if (key === 'exposureTrim') {
                params.exposureTrim = value;
            }
            if (key === 'sunIntensity') {
                if (dirLight) dirLight.intensity = value;
                if (envConfigs && envConfigs[timePhase]) envConfigs[timePhase].dirI = value;
            }
            if (key === 'sunLight') {
                const hex = typeof value === 'string' ? parseInt(value.replace('#',''), 16) : value;
                if (dirLight) dirLight.color.setHex(hex);
                if (envConfigs && envConfigs[timePhase]) envConfigs[timePhase].dir = hex;
                if (skyUniforms && skyUniforms.uSunColor) skyUniforms.uSunColor.value.set(value);
            }
            if (key === 'ambientLight') {
                const hex = typeof value === 'string' ? parseInt(value.replace('#',''), 16) : value;
                if (ambientLight) ambientLight.color.setHex(hex);
                if (envConfigs && envConfigs[timePhase]) envConfigs[timePhase].amb = hex;
            }
            if (key === 'ambIntensity') {
                if (ambientLight) ambientLight.intensity = value;
                if (envConfigs && envConfigs[timePhase]) envConfigs[timePhase].ambI = value;
            }
            if (key === 'skyColor') {
                const hex = typeof value === 'string' ? parseInt(value.replace('#',''), 16) : value;
                if (envConfigs && envConfigs[timePhase]) envConfigs[timePhase].bg = hex;
                if (scene && scene.background) scene.background.setHex(hex);
            }
            if (key === 'fogColor') {
                const hex = typeof value === 'string' ? parseInt(value.replace('#',''), 16) : value;
                if (envConfigs && envConfigs[timePhase]) envConfigs[timePhase].fog = hex;
                if (scene && scene.fog) scene.fog.color.setHex(hex);
            }

            // Sky Gradients
            if (key === 'zenithColor' && skyUniforms && skyUniforms.uSkyColorZenith) skyUniforms.uSkyColorZenith.value.set(value);
            if (key === 'horizonColor' && skyUniforms && skyUniforms.uSkyColorHorizon) skyUniforms.uSkyColorHorizon.value.set(value);
            if (key === 'sunFlareGlow' && skyUniforms && skyUniforms.uSunCoronaIntensity) skyUniforms.uSunCoronaIntensity.value = value;

            // Clouds
            if (category === 'clouds' || (key && key.startsWith('cloud'))) {
                if (key === 'coverage' && skyUniforms && skyUniforms.uCloudCoverage) skyUniforms.uCloudCoverage.value = value;
                if (key === 'density' && skyUniforms && skyUniforms.uCloudOpacity) skyUniforms.uCloudOpacity.value = value;
                if (key === 'sharpness' && skyUniforms && skyUniforms.uCloudEdge) skyUniforms.uCloudEdge.value = value;
                if (key === 'sunColor' && skyUniforms && skyUniforms.uCloudColor) skyUniforms.uCloudColor.value.set(value);
                if (key === 'shadowColor' && skyUniforms && skyUniforms.uCloudShadowColor) skyUniforms.uCloudShadowColor.value.set(value);
            }

            // Ocean & Water
            if (category === 'water' && animeWaterSystem && animeWaterSystem.openSea) {
                const uniforms = animeWaterSystem.openSea.material.uniforms;
                if (key === 'deepColor') uniforms.uDeepColor.value.set(value);
                if (key === 'shallowColor') uniforms.uShallowColor.value.set(value);
                if (key === 'waveHeight') uniforms.uGlobalWaveHeight.value = value;
                if (key === 'swellLen') uniforms.uSwellWavelength.value = value;
                if (key === 'seaIntensity') uniforms.uSeaState.value = value;
            }

            // Trees
            if (category === 'trees' && stylizedTrees) {
                if (key === 'density') { stylizedTrees.density = value; stylizedTrees.respawn(); }
                if (key === 'scale') { stylizedTrees.scaleMul = value; stylizedTrees.respawn(); }
                if (key === 'minSpacing') { stylizedTrees.setCellSize(value); }
                if (key === 'leafBottom') stylizedTrees.uLeafBottom.value.set(value);
                if (key === 'leafTop') stylizedTrees.uLeafTop.value.set(value);
                if (key === 'barkBase') stylizedTrees.uBarkBase.value.set(value);
                if (key === 'respawn') stylizedTrees.respawn();
                if (key === 'compressionTier' && typeof stylizedTrees.setCompressionTier === 'function') stylizedTrees.setCompressionTier(value);
            }

            // Global Terrain
            if (key === 'globalHeightMultiplier') globalTerrainParams.globalHeightMultiplier = value;
        } else if (msg.type === 'BIOME_CHANGE') {
            const { biome, param, value } = msg.payload || {};
            if (param === 'height') {
                biomeHeights[biome] = value;
            } else if (param === 'noise') {
                biomeScales[biome] = value;
            }
        } else if (msg.type === 'LOAD_PRESET') {
            const name = msg.payload ? msg.payload.name : null;
            if (name && DEFAULT_PRESETS && DEFAULT_PRESETS[name]) {
                runApplyPresetData(DEFAULT_PRESETS[name], {
                    envConfigs, params, cloudParams, flightModelManager, gui,
                    settingsManager, presetDropdownControllers, DEFAULT_PRESETS,
                    updateAtmoParamsFromPhase, setTimePhase, _isSyncing: true
                });
            }
        }
    });

    // Sound control functions
    function setSoundMuted(muted) {
        isSoundMuted = !!muted;
        if (biplaneAudio) {
            biplaneAudio.setMuted(isSoundMuted);
        }
        setAudioMuted(isSoundMuted);
        const soundBtn = document.getElementById('sound-toggle-btn');
        if (soundBtn) {
            soundBtn.innerText = isSoundMuted ? 'SOUND: OFF' : 'SOUND: ON';
        }
        if (typeof soundMuteController !== 'undefined' && soundMuteController) {
            soundMuteController.setValue(!isSoundMuted);
        }
    }
    window.setSoundMuted = setSoundMuted;

    function setEngineSoundEnabled(enabled) {
        isEngineSoundOn = !!enabled;
        if (!window.audioCtx && typeof initAudio === 'function') {
            initAudio({ biplaneAudio, flightModelManager, isEngineSoundOn, isSoundMuted });
        }
        if (biplaneAudio) {
            if (!biplaneAudio.audioCtx) {
                const ctx = (typeof getAudioContext === 'function' ? getAudioContext() : null) || window.audioCtx;
                if (ctx) biplaneAudio.setAudioContext(ctx);
            }
            biplaneAudio.setEnabled(isEngineSoundOn);
            const curCfg = flightModelManager.getCurrentConfig();
            if (curCfg && curCfg.isPlane && isEngineSoundOn && !isSoundMuted) {
                biplaneAudio.setActive(true);
            } else {
                biplaneAudio.setActive(false);
            }
        }
        const topEngineBtn = document.getElementById('top-engine-btn');
        if (topEngineBtn) {
            const curCfg = flightModelManager ? flightModelManager.getCurrentConfig() : null;
            const isPlane = curCfg ? !!curCfg.isPlane : false;
            topEngineBtn.style.display = isPlane ? 'inline-flex' : 'none';
            topEngineBtn.style.opacity = isEngineSoundOn ? '1' : '0.45';
            topEngineBtn.style.color = isEngineSoundOn ? '#4ade80' : 'rgba(255, 255, 255, 0.6)';
            topEngineBtn.title = isEngineSoundOn ? `Airplane Engine Sound: ON${curCfg ? ` (${curCfg.name})` : ''} (Click to Mute)` : `Airplane Engine Sound: OFF${curCfg ? ` (${curCfg.name})` : ''} (Click to Enable)`;
        }
        const engineBtn = document.getElementById('engine-sound-btn');
        if (engineBtn) {
            engineBtn.innerText = isEngineSoundOn ? 'ENGINE: ON' : 'ENGINE: OFF';
        }
        const engineToggleBtn = document.getElementById('engine-sound-toggle');
        if (engineToggleBtn) {
            engineToggleBtn.innerText = isEngineSoundOn ? 'Engine Sound: ON' : 'Engine Sound: OFF';
        }
        if (typeof engineSoundController !== 'undefined' && engineSoundController) {
            engineSoundController.setValue(isEngineSoundOn);
        }
    }
    window.setEngineSoundEnabled = setEngineSoundEnabled;

    function updateModelVisibility() {
        if (flightModelManager) {
            flightModelManager.setVisible(isModelVisible);
        }
        const btn = document.getElementById('invis-toggle');
        if (btn) btn.innerText = isModelVisible ? 'Model: VISIBLE' : 'Model: INVISIBLE';
    }

    document.getElementById('invis-toggle')?.addEventListener('click', () => {
        isModelVisible = !isModelVisible;
        updateModelVisibility();
        if (typeof params !== 'undefined') params.modelVisible = isModelVisible;
    });

    document.getElementById('char-toggle')?.addEventListener('click', () => {
        if (flightModelManager) {
            flightModelManager.nextModel();
        }
    });

    document.getElementById('sound-toggle-btn')?.addEventListener('click', () => {
        setSoundMuted(!isSoundMuted);
    });

    document.getElementById('engine-sound-btn')?.addEventListener('click', () => {
        setEngineSoundEnabled(!isEngineSoundOn);
    });

    document.getElementById('engine-sound-toggle')?.addEventListener('click', () => {
        setEngineSoundEnabled(!isEngineSoundOn);
    });

    document.getElementById('top-engine-btn')?.addEventListener('click', () => {
        setEngineSoundEnabled(!isEngineSoundOn);
    });

    document.getElementById('top-music-btn')?.addEventListener('click', () => {
        document.getElementById('music-toggle')?.click();
    });

    // Top Bar Minimal Model Switcher UI Initialization
    // Top Bar Model Switcher UI Initialization
    const topModelSelect = document.getElementById('top-model-select');
    if (topModelSelect) {
        // Dynamically populate the select dropdown from registered FLIGHT_MODELS
        topModelSelect.innerHTML = '';
        FLIGHT_MODELS.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.name;
            topModelSelect.appendChild(opt);
        });

        if (initCfg) {
            topModelSelect.value = initCfg.id;
        }

        const handleSelectModel = (e) => {
            const id = e.target.value;
            if (typeof flightModelManager !== 'undefined' && flightModelManager) {
                flightModelManager.setModelById(id);
            }
        };
        topModelSelect.addEventListener('change', handleSelectModel);
        topModelSelect.addEventListener('input', handleSelectModel);
    }

    const topModelDisplay = document.getElementById('top-model-display');
    const topModelPrev = document.getElementById('top-model-prev-btn');
    const topModelNext = document.getElementById('top-model-next-btn');

    if (topModelDisplay && initCfg) {
        topModelDisplay.textContent = initCfg.name;
    }

    if (topModelDisplay) {
        topModelDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof flightModelManager !== 'undefined' && flightModelManager) {
                flightModelManager.nextModel();
            }
        });
    }

    if (topModelPrev) {
        topModelPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof flightModelManager !== 'undefined' && flightModelManager) {
                flightModelManager.prevModel();
            }
        });
    }

    if (topModelNext) {
        topModelNext.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof flightModelManager !== 'undefined' && flightModelManager) {
                flightModelManager.nextModel();
            }
        });
    }

    function getActiveBiomeNameSafe() {
        if (typeof playerGrp !== 'undefined' && playerGrp.position && typeof getBiomeAt === 'function') {
            const b = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
            return b ? b.name : 'Unknown Biome';
        }
        return 'Unknown Biome';
    }

    function saveActiveBiomeToDisk() {
        const bName = getActiveBiomeNameSafe();
        if (!bName || bName === 'Unknown Biome') {
            showVisualToast('Cannot save: unknown biome');
            return;
        }
        if (typeof window.saveBiomeSettings === 'function') {
            window.saveBiomeSettings(bName);
        }
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const timeStr = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
        const cleanBName = bName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const filename = `wanderlust_biome_${cleanBName}_${dateStr}_${timeStr}.json`;

        const biomeData = {
            type: 'biome_save',
            biome: bName,
            fog: window.biomeFogSettings ? window.biomeFogSettings[bName] : null,
            sky: window.BIOME_SKY_CONFIGS ? window.BIOME_SKY_CONFIGS[bName] : null,
            timestamp: d.getTime(),
            date: dateStr,
            time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
        };
        downloadPresetFile(biomeData, filename);
        showVisualToast(`Saved Biome to Disk: ${filename}`);
    }

    function saveAllBiomesToDisk() {
        localStorage.setItem('wanderlust_biome_fog_settings', JSON.stringify(window.biomeFogSettings || {}));
        localStorage.setItem('wanderlust_biome_sky_configs', JSON.stringify(BIOME_SKY_CONFIGS || {}));

        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const timeStr = `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
        const filename = `wanderlust_all_biomes_${dateStr}_${timeStr}.json`;

        const allBiomesData = {
            type: 'all_biomes_save',
            biomeFogSettings: window.biomeFogSettings || {},
            biomeSkyConfigs: BIOME_SKY_CONFIGS || {},
            timestamp: d.getTime(),
            date: dateStr,
            time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
        };
        downloadPresetFile(allBiomesData, filename);
        showVisualToast(`Saved All Biomes to Disk: ${filename}`);
    }

    window.saveActiveBiomeToDisk = saveActiveBiomeToDisk;
    window.saveAllBiomesToDisk = saveAllBiomesToDisk;

    const saveGui = new GUI({
        title: 'Per-Biome Saves',
        autoPlace: false,
        width: 250
    });
    document.body.appendChild(saveGui.domElement);
    saveGui.domElement.classList.add('save-gui-menu');
    saveGui.domElement.id = 'top-save-menu';
    saveGui.domElement.style.display = 'none';

    function positionSaveGui() {
        const btn = document.getElementById('top-save-setting-btn');
        if (btn && saveGui && saveGui.domElement) {
            const rect = btn.getBoundingClientRect();
            saveGui.domElement.style.left = `${Math.max(10, Math.round(rect.left))}px`;
            saveGui.domElement.style.top = `${Math.round(rect.bottom + 8)}px`;
        }
    }
    window.addEventListener('resize', positionSaveGui);

    const saveActions = {
        saveActive: () => {
            saveActiveBiomeToDisk();
            saveGui.domElement.style.display = 'none';
        },
        resetActive: () => {
            const bName = getActiveBiomeNameSafe();
            if (bName && bName !== 'Unknown Biome' && typeof window.resetBiomeSettings === 'function') {
                window.resetBiomeSettings(bName);
            } else {
                showVisualToast('Cannot reset: unknown biome');
            }
            saveGui.domElement.style.display = 'none';
        },
        saveAll: () => {
            saveAllBiomesToDisk();
            saveGui.domElement.style.display = 'none';
        },
        resetAll: () => {
            if (confirm('Are you sure you want to reset all biome settings to default?')) {
                localStorage.removeItem('wanderlust_biome_fog_settings');
                localStorage.removeItem('wanderlust_biome_sky_configs');
                window.biomeFogSettings = {};
                if (window.ORIGINAL_BIOME_SKY_CONFIGS) {
                    for (let key in window.ORIGINAL_BIOME_SKY_CONFIGS) {
                        if (BIOME_SKY_CONFIGS[key]) {
                            Object.assign(BIOME_SKY_CONFIGS[key], window.ORIGINAL_BIOME_SKY_CONFIGS[key]);
                        }
                        const cleanK = key.replace(/[^\w\s]/gi, '').trim();
                        if (BIOME_SKY_CONFIGS[cleanK]) {
                            Object.assign(BIOME_SKY_CONFIGS[cleanK], window.ORIGINAL_BIOME_SKY_CONFIGS[key]);
                        }
                    }
                }
                showVisualToast('Reset all biomes to defaults');
                if (gui) gui.controllersRecursive().forEach(c => c.updateDisplay && c.updateDisplay());
            }
            saveGui.domElement.style.display = 'none';
        },
        saveGlobal: () => {
            settingsManager.saveSetting();
            saveGui.domElement.style.display = 'none';
        },
        loadFile: () => {
            settingsManager.loadFromFile();
            saveGui.domElement.style.display = 'none';
        }
    };

    saveGui.add(saveActions, 'saveActive').name('Save Current Biome');
    saveGui.add(saveActions, 'resetActive').name('Reset Current Biome');
    saveGui.add(saveActions, 'saveAll').name('Save All Biomes');
    saveGui.add(saveActions, 'resetAll').name('Reset All Biomes');

    const globalFolder = saveGui.addFolder('Global Scene Saves');
    globalFolder.add(saveActions, 'saveGlobal').name('Save Global Preset');
    globalFolder.add(saveActions, 'loadFile').name('Load File from Disk');
    globalFolder.open();

    const topSaveBtn = document.getElementById('top-save-setting-btn');
    if (topSaveBtn) {
        topSaveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = saveGui.domElement.style.display !== 'none';
            if (isOpen) {
                saveGui.domElement.style.display = 'none';
            } else {
                positionSaveGui();
                saveGui.domElement.style.display = '';
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('#top-save-setting-btn') && !e.target.closest('.save-gui-menu')) {
                saveGui.domElement.style.display = 'none';
            }
        });
    }

    const topSaveAllBtn = document.getElementById('top-save-all-btn');
    if (topSaveAllBtn) {
        topSaveAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof saveAllSettings === 'function') saveAllSettings();
        });
    }

    window.updateCustomModelTransform = function(model) {
        if (!model) return;
        const ud = model.userData;
        model.position.x = ud.offsetX;
        model.position.z = ud.offsetZ;
        const h = getWorldHeight(ud.offsetX, ud.offsetZ);
        model.position.y = h + ud.offsetY;
        const s = ud.baseScale * ud.scaleMult;
        model.scale.set(s, s, s);
        model.rotation.y = ud.rotationY;
    };

    window.syncSlidersToSelectedModel = function() {
        const model = loadedCustomModels[selectedModelIndex];
        if (!model) return;
        
        const ud = model.userData;
        
        // Temporarily disable callbacks or manually change params value to avoid double calls
        params.customModelScale = ud.scaleMult;
        params.customModelY = ud.offsetY;
        params.customModelX = ud.offsetX;
        params.customModelZ = ud.offsetZ;
        params.customModelRot = Math.round(ud.rotationY * 180 / Math.PI);
        
        if (customModelControllers.scale) customModelControllers.scale.updateDisplay();
        if (customModelControllers.y) customModelControllers.y.updateDisplay();
        if (customModelControllers.x) {
            customModelControllers.x.min(ud.offsetX - 100);
            customModelControllers.x.max(ud.offsetX + 100);
            customModelControllers.x.updateDisplay();
        }
        if (customModelControllers.z) {
            customModelControllers.z.min(ud.offsetZ - 100);
            customModelControllers.z.max(ud.offsetZ + 100);
            customModelControllers.z.updateDisplay();
        }
        if (customModelControllers.rot) customModelControllers.rot.updateDisplay();
    };

    window.rebuildModelDropdown = function() {
        if (!modelDropdownController) return;
        
        const options = {};
        if (loadedCustomModels.length === 0) {
            options['No models'] = 0;
            selectedModelIndex = -1;
        } else {
            loadedCustomModels.forEach((m, idx) => {
                options[`Model ${idx + 1}`] = idx;
            });
        }
        
        modelDropdownController.options(options);
        if (selectedModelIndex >= 0) {
            modelDropdownController.setValue(selectedModelIndex);
        }
        modelDropdownController.updateDisplay();
    };

    window.cloneSelectedModel = function() {
        const source = loadedCustomModels[selectedModelIndex];
        if (!source) return;
        
        const clone = source.clone();
        
        // Deep copy the custom materials to allow independent coloring/scaling if needed
        clone.traverse((child) => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(m => m.clone());
                } else {
                    child.material = child.material.clone();
                }
            }
        });
        
        clone.userData = {
            baseScale: source.userData.baseScale,
            scaleMult: source.userData.scaleMult,
            offsetX: source.userData.offsetX + 4.0,
            offsetY: source.userData.offsetY,
            offsetZ: source.userData.offsetZ + 4.0,
            rotationY: source.userData.rotationY
        };
        
        scene.add(clone);
        loadedCustomModels.push(clone);
        selectedModelIndex = loadedCustomModels.length - 1;
        
        window.updateCustomModelTransform(clone);
        window.rebuildModelDropdown();
        window.syncSlidersToSelectedModel();
    };

    window.deleteSelectedModel = function() {
        const model = loadedCustomModels[selectedModelIndex];
        if (!model) return;
        
        scene.remove(model);
        loadedCustomModels.splice(selectedModelIndex, 1);
        
        if (loadedCustomModels.length === 0) {
            selectedModelIndex = -1;
            if (customModelFolder) customModelFolder.close();
        } else {
            selectedModelIndex = Math.max(0, selectedModelIndex - 1);
            window.syncSlidersToSelectedModel();
        }
        
        window.rebuildModelDropdown();
    };

    window.loadCustomModelInGame = function(file) {
        const url = URL.createObjectURL(file);
        gltfLoader.load(url, (gltf) => {
            const model = gltf.scene;

            // Traverse and convert all materials to MeshToonMaterial with in-game gradientMap
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        const convertMaterial = (mat) => {
                            if (!mat) return null;
                            if (mat.isMeshToonMaterial) {
                                mat.gradientMap = gradientMap;
                                mat.needsUpdate = true;
                                return mat;
                            }
                            const toonMat = new THREE.MeshToonMaterial({
                                color: mat.color || new THREE.Color(0xffffff),
                                map: mat.map,
                                vertexColors: mat.vertexColors || false,
                                gradientMap: gradientMap,
                                normalMap: mat.normalMap,
                                normalScale: mat.normalScale,
                                aoMap: mat.aoMap,
                                aoMapIntensity: mat.aoMapIntensity,
                                lightMap: mat.lightMap,
                                lightMapIntensity: mat.lightMapIntensity,
                                emissive: mat.emissive || new THREE.Color(0x000000),
                                emissiveMap: mat.emissiveMap,
                                emissiveIntensity: mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : 1.0,
                                displacementMap: mat.displacementMap,
                                displacementScale: mat.displacementScale,
                                displacementBias: mat.displacementBias,
                                alphaMap: mat.alphaMap,
                                transparent: mat.transparent,
                                opacity: mat.opacity !== undefined ? mat.opacity : 1.0,
                                side: mat.side || THREE.FrontSide,
                                depthWrite: mat.depthWrite !== undefined ? mat.depthWrite : true,
                                depthTest: mat.depthTest !== undefined ? mat.depthTest : true,
                                wireframe: mat.wireframe || false,
                                dithering: true
                            });
                            return toonMat;
                        };

                        if (Array.isArray(child.material)) {
                            child.material = child.material.map(m => convertMaterial(m));
                        } else {
                            child.material = convertMaterial(child.material);
                        }
                    }
                }
            });

            // Calculate spawn positions right in front of the player
            let spawnX = 0.0, spawnZ = 0.0;
            const spawnOffset = new THREE.Vector3(0, 0, -8);
            if (typeof playerGrp !== 'undefined') {
                spawnOffset.applyQuaternion(playerGrp.quaternion);
                spawnX = playerGrp.position.x + spawnOffset.x;
                spawnZ = playerGrp.position.z + spawnOffset.z;
            }

            // Auto-scale to fit a height of ~4.5 units
            model.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const baseScale = maxDim > 0 ? (4.5 / maxDim) : 1.0;

            // Create a parent wrapper group to center the pivot and align bottom to y=0
            const wrapper = new THREE.Group();
            model.position.set(-center.x, -box.min.y, -center.z);
            wrapper.add(model);

            // Configure initial userData
            wrapper.userData = {
                baseScale: baseScale,
                scaleMult: 1.0,
                offsetX: spawnX,
                offsetY: 0.0,
                offsetZ: spawnZ,
                rotationY: 0.0
            };

            loadedCustomModels.push(wrapper);
            selectedModelIndex = loadedCustomModels.length - 1;

            window.updateCustomModelTransform(wrapper);
            window.rebuildModelDropdown();
            window.syncSlidersToSelectedModel();

            if (customModelFolder) customModelFolder.open();
            scene.add(wrapper);

            URL.revokeObjectURL(url);
        }, undefined, (error) => {
            console.error("Custom GLTF load error:", error);
            alert("Failed to load the custom GLTF model. Check console for error details.");
            URL.revokeObjectURL(url);
        });
    };

    // Add drag and drop listeners
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    window.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file && (file.name.endsWith('.glb') || file.name.endsWith('.gltf'))) {
            e.preventDefault();
            window.loadCustomModelInGame(file);
        }
    });

    // ==========================================
    // GLB Tree Loader — Ghibli Atlas & Instancing
    // ==========================================

    function applyGLBPineTree(gltf, targetInstancedMeshes, targetHeight) {
        gltf.scene.updateMatrixWorld(true);
        const childMeshes = [];
        gltf.scene.traverse((child) => {
            if (child.isMesh) childMeshes.push(child);
        });
        if (childMeshes.length === 0) return;

        const bbox = new THREE.Box3().setFromObject(gltf.scene);
        const modelHeight = bbox.max.y - bbox.min.y;
        const sc = modelHeight > 0 ? (targetHeight / modelHeight) : 1.0;
        const offsetY = -bbox.min.y;

        // Check if there is an atlas map on the GLTF mesh
        let atlasMap = null;
        for (let i = 0; i < childMeshes.length; i++) {
            const m = childMeshes[i];
            if (m.material) {
                if (m.material.map) {
                    atlasMap = m.material.map;
                    break;
                } else if (Array.isArray(m.material) && m.material[0] && m.material[0].map) {
                    atlasMap = m.material[0].map;
                    break;
                }
            }
        }

        let customTreeMat = matTree;
        if (atlasMap) {
            atlasMap.colorSpace = THREE.SRGBColorSpace;
            customTreeMat = new MeshToonNodeMaterial({
                color: new THREE.Color(0xffffff),
                map: atlasMap,
                gradientMap: gradientMap,
                alphaTest: 0.35,
                side: THREE.DoubleSide,
                transparent: false,
                depthWrite: true,
                depthTest: true,
                dithering: true
            });
            const texNode = texture(atlasMap);
            customTreeMat.alphaNode = texNode.a;
            customTreeMat.opacityNode = texNode.a;
            if (typeof windSwayNode === 'function') {
                customTreeMat.positionNode = windSwayNode(terrainUniforms.uTime, treeUniforms.uTreeScale);
            }
        }

        targetInstancedMeshes.forEach((instMesh) => {
            const geos = [];

            childMeshes.forEach((m) => {
                const g = m.geometry.clone();
                g.applyMatrix4(m.matrixWorld);
                g.translate(0, offsetY, 0);
                g.scale(sc, sc, sc);

                // Strip embedded/dark vertex colors from GLB file if any
                if (g.attributes.color) g.deleteAttribute('color');

                const vertCount = g.attributes.position.count;
                const isBarkArr = new Float32Array(vertCount);

                if (Array.isArray(m.material) && g.groups && g.groups.length > 0) {
                    const indexAttr = g.index;
                    g.groups.forEach((group) => {
                        const mat = m.material[group.materialIndex];
                        const matName = (mat && mat.name) ? mat.name.toLowerCase() : '';
                        const isBark = matName.includes('bark') || matName.includes('trunk') || matName.includes('wood') || matName.includes('m_trunk');
                        const start = group.start;
                        const count = group.count;
                        for (let i = start; i < start + count; i++) {
                            const vertIdx = indexAttr ? indexAttr.getX(i) : i;
                            if (vertIdx < vertCount) {
                                isBarkArr[vertIdx] = isBark ? 1.0 : 0.0;
                            }
                        }
                    });
                } else {
                    const matName = (m.material && m.material.name) ? m.material.name.toLowerCase() : '';
                    const childName = (m.name || '').toLowerCase();
                    const isBark = matName.includes('bark') || matName.includes('trunk') || matName.includes('wood') || 
                                   childName.includes('bark') || childName.includes('trunk') || childName.includes('wood') || 
                                   matName.includes('m_trunk') || childName.includes('m_trunk');
                    isBarkArr.fill(isBark ? 1.0 : 0.0);
                }

                g.setAttribute('aIsBark', new THREE.BufferAttribute(isBarkArr, 1));

                if (!g.index) {
                    const indices = new Uint32Array(vertCount);
                    for (let i = 0; i < vertCount; i++) indices[i] = i;
                    g.setIndex(new THREE.BufferAttribute(indices, 1));
                }

                g.computeBoundingBox();
                g.computeBoundingSphere();
                geos.push(g);
            });

            const mergedGeom = BufferGeometryUtils.mergeGeometries(geos, false);
            if (!mergedGeom) return;
            mergedGeom.computeVertexNormals();
            mergedGeom.computeBoundingBox();
            mergedGeom.computeBoundingSphere();

            instMesh.geometry = mergedGeom;
            instMesh.material = customTreeMat;
            instMesh.instanceColor = null;
            instMesh.instanceMatrix.needsUpdate = true;
        });
    }





    // Load Initial Flight Model
    let savedModelId = localStorage.getItem('wl_saved_model_id');
    if (savedModelId === 'kiki' && !localStorage.getItem('wl_migrated_default_savoia')) {
        savedModelId = 'psx_saviola_s21';
        localStorage.setItem('wl_saved_model_id', 'psx_saviola_s21');
        localStorage.setItem('wl_migrated_default_savoia', 'true');
    }
    let loadPromise;
    if (savedModelId && typeof flightModelManager !== 'undefined') {
        loadPromise = flightModelManager.setModelById(savedModelId, true);
    } else {
        loadPromise = flightModelManager.loadModelByIndex(0, true);
    }
    loadPromise.then(() => {
        if (typeof proxyMesh !== 'undefined' && proxyMesh) {
            proxyMesh.visible = false;
        }
    }).catch(err => {
        console.warn("Failed to load initial flight model:", err);
    });

    



    
    // Modular Flight Controls & Input Bridge
    const flightControls = new FlightControlsBridge({
        getFlightModelManager: () => flightModelManager,
        onToggleGUI: () => window.toggleGUI ? window.toggleGUI() : null,
        onToggleModelVisibility: () => {
            isModelVisible = !isModelVisible;
            updateModelVisibility();
        },
        onToggleEngineSound: () => {
            if (typeof setEngineSoundEnabled === 'function') setEngineSoundEnabled(!isEngineSoundOn);
        },
        onToggleMasterSound: () => {
            if (typeof setSoundMuted === 'function') setSoundMuted(!isSoundMuted);
        },
        getCameraManager: () => ({
            get cameraZoomDist() { return cameraZoomDist; },
            set cameraZoomDist(v) {
                cameraZoomDist = Math.max(6.0, Math.min(300.0, v));
                localStorage.setItem('wl_zoomDist', cameraZoomDist);
                const zoomToggleBtn = document.getElementById('zoom-toggle');
                if (zoomToggleBtn) {
                    zoomToggleBtn.innerText = cameraZoomDist > 25.0 ? 'Zoom In' : 'Zoom Out';
                }
            }
        })
    });
    const keys = flightControls.keys;
    const touchState = flightControls.touchState;




    // ==========================================
    // 9. FLIGHT PHYSICS & RENDER LOOP
    // ==========================================
    let velocity = 15.0; 
    let pitch = 0, yaw = 0, roll = 0;
    const BASE_FOV = 60;
    // (Removed) Low-poly particle star field: 8,000 THREE.Points that were built, added to
    // the scene, then force-hidden every single frame. Stars now come from the procedural
    // sky shader instead — see starLayer() in src/shaders/atmosphere/proceduralSky.js.

    // --- Camera Rig Hierarchy ---
    cameraBase = new THREE.Group(); 
    scene.add(cameraBase);

    const cameraPivot = new THREE.Group(); 
    cameraPivot.rotation.order = 'YXZ';
    cameraBase.add(cameraPivot);

    camera.position.set(0, 4, 12); 
    cameraPivot.add(camera);

    // Initialize window.editorState and Terrain Editor
    window.editorState = {
        isEditorMode: false,
        isDragging: false,
        cameraPivot: cameraPivot,
        playerGrp: playerGrp,
        pauseFlight: () => { if (typeof isFlightPaused !== 'undefined') isFlightPaused = true; },
        resumeFlight: () => { if (typeof isFlightPaused !== 'undefined') isFlightPaused = false; },
        isFlightPaused: () => (typeof isFlightPaused !== 'undefined' ? isFlightPaused : false),
    };

    const treePlacementEditor = new TreePlacementEditor(scene, camera, renderer, terrain);
    window.treePlacementEditor = treePlacementEditor;
    window.toggleTerrainEditor = () => treePlacementEditor.toggle();

    // --- Pan Event Listeners (Handles Mouse & Mobile Touch Screen) ---
    let isDragging = false;
    let previousPointerPos = { x: 0, y: 0 };

    const onPointerDown = (event) => {
        if ((window.editorState && window.editorState.isEditorMode) || isGodMode) return;
        isDragging = true;
        previousPointerPos = { x: event.clientX, y: event.clientY };
    };

    const onPointerMove = (event) => {
        if (!isDragging || isGodMode || (window.editorState && window.editorState.isEditorMode)) return;
        const deltaX = event.clientX - previousPointerPos.x;
        const deltaY = event.clientY - previousPointerPos.y;

        // Orbit the pivot
        cameraPivot.rotation.y -= deltaX * 0.004;
        cameraPivot.rotation.x -= deltaY * 0.004;
        
        // Clamp vertical look to prevent the camera from flipping upside down
        cameraPivot.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 6, cameraPivot.rotation.x));

        previousPointerPos = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = () => isDragging = false;

    // Target the render canvas wrapper to parse inputs properly
    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerUp);

    const tempVec1 = new THREE.Vector3();
    const tempVec2 = new THREE.Vector3();
    const tempVec3 = new THREE.Vector3();
    const tempVecHorizon = new THREE.Vector3();
    const tempVecSunFwd = new THREE.Vector3();
    const tempVecMoonOff = new THREE.Vector3();
    const tempVecToLight = new THREE.Vector3();
    const tempColorTarget = new THREE.Color();
    // Exposure defaults live on `params` (dayExposure / nightExposure) so the sliders drive
    // them live. Dusk deliberately has NO slider and is hard-pinned to 1.0 below.

    let currentSunY = envConfigs[timePhase] ? envConfigs[timePhase].sunY : 160;
    let currentMoonY = envConfigs[timePhase] ? envConfigs[timePhase].moonY : 200;
    let currentFps = 60;

    let lastFpsTime = performance.now();
    let framesThisSecond = 0;
    let lastAnimTime = performance.now();
    let smoothedDt = 0.0166;

    function shiftInstancedMesh(mesh, count, shiftX, shiftZ) {
        if (!mesh) return;
        const dummy = new THREE.Object3D();
        const actualCount = count || mesh.count;
        for (let i = 0; i < actualCount; i++) {
            mesh.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
            dummy.position.x -= shiftX;
            dummy.position.z -= shiftZ;
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    }

    function shiftAllInstances(shiftX, shiftZ) {
        if (typeof instCrystals !== 'undefined') shiftInstancedMesh(instCrystals, typeof CRYSTAL_COUNT !== 'undefined' ? CRYSTAL_COUNT : instCrystals.count, shiftX, shiftZ);
        shiftDiorama(dioramaSystem, shiftX, shiftZ, shiftInstancedMesh);
        shiftBirds(birdSystem, shiftX, shiftZ, shiftInstancedMesh);
        shiftWindTrails(windTrails, shiftX, shiftZ, shiftInstancedMesh);
        if (typeof stylizedTrees !== 'undefined' && stylizedTrees && typeof stylizedTrees.respawn === 'function') {
            stylizedTrees.respawn();
        }
    }

    const _cachedWaterSunDir = new THREE.Vector3();

    async function animate() {
        if (window.is3DViewportHidden) {
            return;
        }
        if (proceduralSkyMesh && !isGodMode) {
            camera.getWorldPosition(proceduralSkyMesh.position);
        }
        if (params.showMap) drawWorldMap({ playerGrp, getBiomeAt, getIslandData, WORLD_LENGTH });
        
        const nowAnimTime = performance.now();
        let rawDt = (nowAnimTime - lastAnimTime) / 1000.0;

        const pWorldX = (typeof playerGrp !== 'undefined' && playerGrp && playerGrp.position) ? playerGrp.position.x : 0;
        const pWorldZ = (typeof playerGrp !== 'undefined' && playerGrp && playerGrp.position) ? playerGrp.position.z : 0;
        const cachedBiome = getBiomeAt(pWorldX, pWorldZ);
        const cachedGroundY = getWorldHeight(pWorldX, pWorldZ);

        if (!playerPhysics && typeof playerGrp !== 'undefined') {
            playerPhysics = new PlayerPhysics(playerGrp);
            cameraManager = new CameraManager(camera, cameraBase, cameraZoomDist);
            window.cameraManager = cameraManager;
            window.playerPhysics = playerPhysics;
        }
        lastAnimTime = nowAnimTime;
        adaptiveRes.sample(rawDt * 1000);
        if (rawDt > 0.1 || rawDt <= 0) rawDt = 0.0166;
        // Smooth frame delta time to eliminate timer jitter from exponential lerps
        smoothedDt = smoothedDt + (rawDt - smoothedDt) * 0.25;
        let dt = Math.min(smoothedDt, 0.066);
        const frameMs = rawDt * 1000.0;
        if (typeof window._maxFrameSpike === 'undefined') window._maxFrameSpike = 0;
        if (frameMs > window._maxFrameSpike) window._maxFrameSpike = frameMs;

        const time = clock.getElapsedTime();
        const SHADER_TIME_PERIOD = 3600.0;
        const wrappedTime = time % SHADER_TIME_PERIOD;

        if (animeWaterSystem && animeWaterSystem.visible) {
            const activeCam = isGodMode ? godCamera : camera;
            let _wsd = null;
            if (dirLight && playerGrp) {
                _cachedWaterSunDir.copy(dirLight.position).sub(playerGrp.position).normalize();
                _wsd = _cachedWaterSunDir;
            }
            animeWaterSystem.update(dt, wrappedTime, activeCam, playerGrp ? playerGrp.position : null, _wsd);
        }
        // Advance the amortised terrain depth-field bake (no-op when idle)
        if (animeWaterSystem) animeWaterSystem.tickDepthField();
        if (typeof terrainUniforms !== 'undefined') {
            terrainUniforms.uTime.value = wrappedTime;
            terrainUniforms.uWorldOriginZ.value = worldOriginOffset.y;
            if (typeof dirLight !== 'undefined') {
                terrainUniforms.uSunDir.value.copy(dirLight.position).sub(playerGrp.position).normalize();
            }
        }
        if (skyUniforms) {
            skyUniforms.uTime.value = wrappedTime;
            if (typeof dirLight !== 'undefined' && typeof playerGrp !== 'undefined') {
                skyUniforms.uSunPosition.value.copy(dirLight.position).sub(playerGrp.position).normalize();
            }
        }
        if (typeof treeUniforms !== 'undefined') {
            treeUniforms.uPlayerPos.value.copy(playerGrp.position);
        }
        if (window.rainSystem) {
            const activeCam = isGodMode ? godCamera : camera;
            window.rainSystem.update(time, activeCam, params);
        }
        if (typeof window.fogUniforms !== 'undefined' && window.fogGroup && typeof playerGrp !== 'undefined' && playerGrp.position) {
            window.fogUniforms.uTime.value = wrappedTime;
            if (typeof dirLight !== 'undefined') {
                window.fogUniforms.uSunDirection.value.copy(dirLight.position).sub(playerGrp.position).normalize();
                if (dirLight.color) {
                    window.fogUniforms.uSunColor.value.copy(dirLight.color);
                }
            }
            if (window.groundFogEditor) {
                window.groundFogEditor.updateFrame(dt, timePhase);
            }
            const currentB = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
            const bName = currentB ? currentB.name : 'Misty Mountains';
            const cleanB = cleanBiomeName(bName);
            const biomeFogOffset = (window.biomeFogSettings && window.biomeFogSettings[cleanB] !== undefined) ? window.biomeFogSettings[cleanB] : 0;
            const currentGroundY = getWorldHeight(playerGrp.position.x, playerGrp.position.z);
            
            // Smoothly position fog group at terrain / water level plus biome offset
            window.fogGroup.position.x = playerGrp.position.x;
            window.fogGroup.position.z = playerGrp.position.z;
            const baseFloor = Math.max(currentGroundY, 2.4);
            const targetFogY = baseFloor + biomeFogOffset;
            window.fogGroup.position.y += (targetFogY - window.fogGroup.position.y) * dt * 3.0;
        }

        currentFrame++;
        framesThisSecond++;
        const currentGroundY = getWorldHeight(playerGrp.position.x, playerGrp.position.z);
        const currentAlt = Math.max(0, Math.round(playerGrp.position.y - currentGroundY));

        const now = performance.now();
        if (now - lastFpsTime >= 500) {
            currentFps = Math.round((framesThisSecond * 1000) / (now - lastFpsTime));
            framesThisSecond = 0;
            lastFpsTime = now;
            const fpsEl = document.getElementById('fps-counter');
            if (fpsEl) {
                const avgFrameMs = (1000.0 / Math.max(1, currentFps)).toFixed(1);
                const spikeMs = Math.round(window._maxFrameSpike || 0);
                fpsEl.innerText = `${currentFps} FPS (${avgFrameMs}ms${spikeMs > 28 ? ` | spike ${spikeMs}ms` : ''})`;
            }
            window._maxFrameSpike = 0;
            const currZn = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
            const biomeEl = document.getElementById('biome-label');
            if (biomeEl && currZn) biomeEl.innerText = currZn.name || '';
        }

        
        // 3-Stage Lighting Engine Lerp
        const target = envConfigs[timePhase];
        const decayEnv = 1.0 - Math.exp(-2.0 * dt);

        // Per-phase exposure. Index 1 (Dusk) is EXACTLY 1.0 — a multiply by one cannot change
        // a pixel, so the golden dusk look is provably untouched by this whole system.
        // Day and Night read live from the sliders; Dusk is hard-pinned to 1.0 and has no slider.
        const targetExposure = timePhase === 0 ? params.dayExposure
                             : timePhase === 2 ? params.nightExposure
                             : 1.0;
        const wantExposure = targetExposure * params.exposureTrim;
        uPhaseExposure.value += (wantExposure - uPhaseExposure.value) * decayEnv;
        // Snap once the lerp is within a rounding error. Without this, returning to dusk from
        // another phase leaves the exposure at 0.9999... forever — visually identical, but the
        // dusk guarantee is meant to be exact, not approximate.
        if (Math.abs(wantExposure - uPhaseExposure.value) < 0.0005) uPhaseExposure.value = wantExposure;
        if (scene.background && scene.background.isColor) {
            scene.background.lerp(tempColorTarget.setHex(target.bg), decayEnv);
        }
        if (skyUniforms && skyUniforms.uSkyColorHorizon) {
            scene.fog.color.copy(skyUniforms.uSkyColorHorizon.value);
        } else {
            scene.fog.color.lerp(tempColorTarget.setHex(target.fog), decayEnv);
        }
        
        ambientLight.color.lerp(tempColorTarget.setHex(target.amb), decayEnv);
        ambientLight.intensity += (target.ambI - ambientLight.intensity) * decayEnv;
        dirLight.color.lerp(tempColorTarget.setHex(target.dir), decayEnv);
        dirLight.intensity += (target.dirI - dirLight.intensity) * decayEnv;
        // Old points-based star field removed — the procedural sky now genuinely draws stars.
        // (It previously did not: the comment here claimed it did, but proceduralSky.js had no
        // star code at all, which is why night had none.)

        // Player warm lantern lights modulation (magical lantern at Twilight, warm rim at Dusk, subtle at Day)
        const kikiGlow = (timePhase === 2) ? 2.5 : (timePhase === 1 ? 1.4 : 0.4);
        if (typeof kikiLeftLight !== 'undefined' && typeof kikiRightLight !== 'undefined') {
            kikiLeftLight.intensity += (kikiGlow - kikiLeftLight.intensity) * decayEnv;
            kikiRightLight.intensity += (kikiGlow - kikiRightLight.intensity) * decayEnv;
        }

        // Procedural Sky - per-biome lerp + time of day factors
        if (skyUniforms && typeof playerGrp !== 'undefined') {
            const currentB = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
            const skyBiomeName = currentB ? currentB.name : 'Ghibli Land';
            const biomeTarget = (BIOME_SKY_CONFIGS && (BIOME_SKY_CONFIGS[skyBiomeName] || BIOME_SKY_CONFIGS['Open Ocean'] || BIOME_SKY_CONFIGS['Ghibli Land'])) || { coverage: 0.45, edge: 0.06, speed: 0.018, turbulence: 0.0, stormDarken: 0.0, skyZenith: 0x5a9ed0, skyHorizon: 0xc8dce8, cloudCol: 0xfffaec, cloudShadow: 0xa89888 };
            const decaySky = 1.0 - Math.exp(-1.5 * dt);

            skyUniforms.uTime.value = time;
            if (typeof staticSun !== 'undefined') {
                const activeCelestial = (timePhase === 2 && staticMoon) ? staticMoon : staticSun;
                skyUniforms.uSunPosition.value.copy(activeCelestial.position).sub(playerGrp.position).normalize();
            }

            skyUniforms.uCloudCoverage.value += (biomeTarget.coverage - skyUniforms.uCloudCoverage.value) * decaySky;
            skyUniforms.uCloudEdge.value += (biomeTarget.edge - skyUniforms.uCloudEdge.value) * decaySky;
            skyUniforms.uCloudSpeed.value += (biomeTarget.speed - skyUniforms.uCloudSpeed.value) * decaySky;
            skyUniforms.uCloudTurbulence.value += (biomeTarget.turbulence - skyUniforms.uCloudTurbulence.value) * decaySky;
            skyUniforms.uStormDarken.value += (biomeTarget.stormDarken - skyUniforms.uStormDarken.value) * decaySky;

            // Target factors strictly tied to active timePhase
            const targetNightFactor = (timePhase === 2) ? 1.0 : 0.0;
            const targetDuskFactor = (timePhase === 1) ? 1.0 : 0.0;
            skyUniforms.uNightFactor.value += (targetNightFactor - skyUniforms.uNightFactor.value) * decayEnv;
            skyUniforms.uDuskFactor.value += (targetDuskFactor - skyUniforms.uDuskFactor.value) * decayEnv;

            // Milky Way night skybox — fade in with night, keep centred on the camera.
            // Driven off uNightFactor so it is fully invisible at Dusk (dusk look untouched).
            updateMilkyWay(tempVec1, skyUniforms.uNightFactor.value);

            updateAurora(tempVec1, dt, skyUniforms.uNightFactor.value);

            // Compute distinct zenith, mid, and horizon colors based on time of day
            let targetZenithHex = (timePhase === 1) ? target.bg : ((timePhase === 2) ? target.bg : biomeTarget.skyZenith);
            let targetMidHex = target.mid || 0x7ab4e6;
            let targetHorizonHex = (timePhase === 1) ? target.fog : ((timePhase === 2) ? target.fog : biomeTarget.skyHorizon);
            let targetCloudHex = (timePhase === 1) ? target.cloudCol : ((timePhase === 2) ? target.cloudCol : biomeTarget.cloudCol);
            let targetCloudShadowHex = biomeTarget.cloudShadow;

            skyUniforms.uSkyColorZenith.value.lerp(tempColorTarget.setHex(targetZenithHex), decaySky);
            if (skyUniforms.uSkyColorMid) {
                skyUniforms.uSkyColorMid.value.lerp(tempColorTarget.setHex(targetMidHex), decaySky);
            }
            skyUniforms.uSkyColorHorizon.value.lerp(tempColorTarget.setHex(targetHorizonHex), decaySky);
            skyUniforms.uCloudColor.value.lerp(tempColorTarget.setHex(targetCloudHex), decaySky);
            skyUniforms.uCloudShadowColor.value.lerp(tempColorTarget.setHex(targetCloudShadowHex), decaySky);
            skyUniforms.uSunColor.value.lerp(tempColorTarget.setHex(target.dir), decaySky);
            
            // Sync Open Sea Time Of Day
            zenithColorUniform.value.copy(skyUniforms.uSkyColorZenith.value);
            horizonColorUniform.value.copy(skyUniforms.uSkyColorHorizon.value);
            sunColorUniform.value.copy(dirLight.color);
            sunDirUniform.value.copy(dirLight.position).sub(playerGrp.position).normalize();

            // Weather override (storm/overcast)
            if (currentWeather !== 'clear') {
                const wp = WEATHER_PRESETS[currentWeather];
                if (wp) {
                    if (wp.coverage !== null) skyUniforms.uCloudCoverage.value += (wp.coverage - skyUniforms.uCloudCoverage.value) * decaySky;
                    if (wp.edge !== null) skyUniforms.uCloudEdge.value += (wp.edge - skyUniforms.uCloudEdge.value) * decaySky;
                    if (wp.speed !== null) skyUniforms.uCloudSpeed.value += (wp.speed - skyUniforms.uCloudSpeed.value) * decaySky;
                    skyUniforms.uCloudTurbulence.value += (wp.turbulence - skyUniforms.uCloudTurbulence.value) * decaySky;
                    skyUniforms.uStormDarken.value += (wp.stormDarken - skyUniforms.uStormDarken.value) * decaySky;
                }
            }
        }







        // Floating Crystals — respawn in Crystal Land
        const crystalDist = 3200;
        let inCrystalLand = false;
        if (typeof playerGrp !== 'undefined' && playerGrp.position) {
            const b = getBiomeAt(playerGrp.position.x, playerGrp.position.z);
            inCrystalLand = b && b.name ? b.name.includes('Crystal') : false;
        }
        
        if (typeof instCrystals !== 'undefined') {
            instCrystals.visible = inCrystalLand;
        }

        if (inCrystalLand) {
            if (typeof matCrystal !== 'undefined' && matCrystal.userData.shader) {
                matCrystal.userData.shader.uniforms.uTime.value = time;
            }

            // Gather active crystal positions for spacing collision checks
            const crystalPositions = [];
            for (let j = 0; j < CRYSTAL_COUNT; j++) {
                instCrystals.getMatrixAt(j, dummy.matrix);
                dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
                if (dummy.position.y > -500) {
                    crystalPositions.push({ x: dummy.position.x, z: dummy.position.z, idx: j });
                }
            }

            for (let i = 0; i < CRYSTAL_COUNT; i++) {
                instCrystals.getMatrixAt(i, dummy.matrix);
                dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
                
                const distToPlayer = Math.hypot(dummy.position.x - playerGrp.position.x, dummy.position.z - playerGrp.position.z);
                if (dummy.position.y < -500 || distToPlayer > crystalDist) {
                    // Varied, balanced scale categories
                    let s = 30;
                    const rType = (i % 5);
                    if (rType === 0) {
                        // Grand focal monolith
                        s = 85 + Math.random() * 30;
                    } else if (rType <= 2) {
                        // Medium floating crystal obelisk
                        s = 45 + Math.random() * 25;
                    } else {
                        // Smaller elegant hovering shard
                        s = 22 + Math.random() * 18;
                    }

                    // Best-candidate rejection sampling to guarantee wide, even spread
                    let bestX = playerGrp.position.x + (Math.random() - 0.5) * crystalDist * 1.8;
                    let bestZ = playerGrp.position.z + (Math.random() - 0.5) * crystalDist * 1.8;
                    let maxMinDist = -1;

                    for (let attempt = 0; attempt < 16; attempt++) {
                        const angle = Math.random() * Math.PI * 2.0;
                        const rad = 400 + Math.random() * (crystalDist - 500);
                        const candX = playerGrp.position.x + Math.cos(angle) * rad;
                        const candZ = playerGrp.position.z + Math.sin(angle) * rad;

                        let minDistToOthers = Infinity;
                        for (let k = 0; k < crystalPositions.length; k++) {
                            if (crystalPositions[k].idx === i) continue;
                            const d = Math.hypot(candX - crystalPositions[k].x, candZ - crystalPositions[k].z);
                            if (d < minDistToOthers) minDistToOthers = d;
                        }

                        if (minDistToOthers > 600) {
                            bestX = candX;
                            bestZ = candZ;
                            break;
                        } else if (minDistToOthers > maxMinDist) {
                            maxMinDist = minDistToOthers;
                            bestX = candX;
                            bestZ = candZ;
                        }
                    }

                    // Multi-point ground sampling under the crystal's footprint
                    const footRad = s * 0.6;
                    const h0 = getWorldHeight(bestX, bestZ);
                    const h1 = getWorldHeight(bestX + footRad, bestZ);
                    const h2 = getWorldHeight(bestX - footRad, bestZ);
                    const h3 = getWorldHeight(bestX, bestZ + footRad);
                    const h4 = getWorldHeight(bestX, bestZ - footRad);
                    const peakGroundY = Math.max(2.4, h0, h1, h2, h3, h4);
                    
                    // Crystal geometry extends 3.0 * s downwards from center.
                    // Provide generous open sky clearance below the lowest tip so it always floats.
                    let airClearance = 140 + Math.random() * 120; // 140 to 260 units of open sky beneath
                    if (i % 3 === 0) {
                        airClearance = 80 + Math.random() * 50;   // 80 to 130 units of open sky beneath
                    } else if (i % 3 === 2) {
                        airClearance = 280 + Math.random() * 180; // 280 to 460 units of open sky beneath
                    }

                    const spawnY = peakGroundY + (s * 3.0) + airClearance;
                    crystalBaseY[i] = spawnY;
                    
                    dummy.position.set(bestX, spawnY, bestZ);
                    dummy.scale.set(s * 0.55, s, s * 0.55);

                    // Update cached position for subsequent crystals in the same frame
                    const found = crystalPositions.find(cp => cp.idx === i);
                    if (found) {
                        found.x = bestX;
                        found.z = bestZ;
                    } else {
                        crystalPositions.push({ x: bestX, z: bestZ, idx: i });
                    }
                }
                
                // Floating bob around stable base altitude
                const bob = Math.sin(time * 0.6 + i * 1.7) * 8.0;
                dummy.position.y = crystalBaseY[i] + bob;

                // Absolute ground collision prevention: ensure bottom tip NEVER clips any ground or water
                const footRadCurrent = dummy.scale.x * 1.1;
                const px = dummy.position.x;
                const pz = dummy.position.z;
                const gh0 = getWorldHeight(px, pz);
                const gh1 = getWorldHeight(px + footRadCurrent, pz);
                const gh2 = getWorldHeight(px - footRadCurrent, pz);
                const gh3 = getWorldHeight(px, pz + footRadCurrent);
                const gh4 = getWorldHeight(px, pz - footRadCurrent);
                const currentPeakGround = Math.max(2.4, gh0, gh1, gh2, gh3, gh4);

                const minTipClearance = 60.0; // Guaranteed minimum 60 units of clear sky below lowest tip
                const minCenterY = currentPeakGround + (dummy.scale.y * 3.05) + minTipClearance;
                if (dummy.position.y < minCenterY) {
                    dummy.position.y = minCenterY;
                    crystalBaseY[i] = minCenterY - bob;
                }

                dummy.rotateY(0.0018 + (i % 3) * 0.0008);
                dummy.updateMatrix();
                instCrystals.setMatrixAt(i, dummy.matrix);
            }
            instCrystals.instanceMatrix.needsUpdate = true;
        }



        const npBiome = (typeof playerGrp !== 'undefined' && playerGrp.position) ? getBiomeAt(playerGrp.position.x, playerGrp.position.z) : null;
        const inNorthPole = npBiome && npBiome.name ? npBiome.name.includes('North Pole') : false;
        instIcebergs.visible = inNorthPole;
        if (inNorthPole) {
            const icebergDist = 900;
            let icebergsChanged = false;
            for (let i = 0; i < ICEBERG_COUNT; i++) {
                instIcebergs.getMatrixAt(i, dummy.matrix);
                dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
                if (dummy.position.y < -500 || Math.abs(dummy.position.x - playerGrp.position.x) > icebergDist || Math.abs(dummy.position.z - playerGrp.position.z) > icebergDist) {
                    let placed = false;
                    for (let att = 0; att < 8 && !placed; att++) {
                        const nx = playerGrp.position.x + (Math.random() - 0.5) * icebergDist * 2.0;
                        const nz = playerGrp.position.z + (Math.random() - 0.5) * icebergDist * 2.0;
                        const h = getWorldHeight(nx, nz);
                        const bObj = getBiomeAt(nx, nz);
                        const bName = bObj ? bObj.name : '';
                        if (bName.includes('North Pole') && h < 4.0 && h > -4.0) {
                            const s = 0.6 + Math.random() * 1.8;
                            dummy.position.set(nx, 1.0 + Math.random() * 1.5, nz);
                            dummy.rotation.set(0, Math.random() * Math.PI * 2.0, (Math.random() - 0.5) * 0.15);
                            dummy.scale.set(s * (0.7 + Math.random() * 0.3), s, s * (0.7 + Math.random() * 0.3));
                            placed = true;
                        }
                    }
                    if (!placed) {
                        dummy.position.set(0, -1000, 0);
                        dummy.scale.set(1, 1, 1);
                    }
                    dummy.updateMatrix();
                    instIcebergs.setMatrixAt(i, dummy.matrix);
                    icebergsChanged = true;
                }
            }
            if (icebergsChanged) {
                instIcebergs.instanceMatrix.needsUpdate = true;
            }
        }

        let oldY = playerGrp.position.y;

        const isBraking = keys.space || touchState.brake;
        const isBoosting = keys.shift || touchState.boost;
        
        const inputState = {
            forward: true,
            up: keys.w || touchState.y < -0.1,
            down: keys.s || touchState.y > 0.1,
            left: keys.a || touchState.x < -0.1,
            right: keys.d || touchState.x > 0.1,
            analogX: touchState.x,
            analogY: touchState.y
        };

        let curWaterY = 2.4;
        if (animeWaterSystem) {
            const playerX = (typeof playerGrp !== 'undefined' && playerGrp && playerGrp.position) ? playerGrp.position.x : 0;
            const playerZ = (typeof playerGrp !== 'undefined' && playerGrp && playerGrp.position) ? playerGrp.position.z : 0;
            const targetWaterY = getWorldWaterHeight(playerX, playerZ) + globalWaterHeightOffset;
            const currentWaterY = animeWaterSystem.waterLevel;
            curWaterY = currentWaterY + (targetWaterY - currentWaterY) * Math.min(1.0, dt * 5.0);
            animeWaterSystem.setHeight(curWaterY);
            globalWaterParam.waterHeight = curWaterY;
            if (waterHeightController) waterHeightController.updateDisplay();
        }

        if (isGodMode && godControls) {
            updateGodMode(dt, keys, godControls, godCamera, curWaterY);
        } else if (window.editorState && window.editorState.isEditorMode) {
            if (window.editorState.editorControls && window.editorState.editorControls.enabled) {
                window.editorState.editorControls.update();
            }
            if (typeof window._updateEditorCameraMovement === 'function') {
                window._updateEditorCameraMovement();
            }
        }

        if (playerPhysics) {
            playerPhysics.update(dt, inputState, isBraking, isBoosting, isFlightPaused, treeGrid);
            
            // Floating origin recentering system (threshold: 5,000 meters)
            const distFromOrigin = Math.hypot(playerGrp.position.x, playerGrp.position.z);
            if (distFromOrigin > 5000.0) {
                const shiftX = playerGrp.position.x;
                const shiftZ = playerGrp.position.z;
                
                // Recenter player & camera base
                playerGrp.position.x = 0;
                playerGrp.position.z = 0;
                cameraBase.position.x = 0;
                cameraBase.position.z = 0;
                
                // Shift terrain grid trackers and mesh
                lastTerrainGridX -= shiftX;
                lastTerrainGridZ -= shiftZ;
                terrain.position.x -= shiftX;
                terrain.position.z -= shiftZ;
                
                // Shift all active instanced diorama props and clouds
                shiftAllInstances(shiftX, shiftZ);
                
                // Accumulate global world origin offset
                setWorldOriginOffset(worldOriginOffset.x + shiftX, worldOriginOffset.y + shiftZ);
                
                // Regenerate terrain geometry at new local origin
                updateTerrainGeometry(playerGrp.position.x, playerGrp.position.z);
            }

            if (cameraManager && !((window.editorState && window.editorState.isEditorMode) || isGodMode)) {
                cameraManager.update(dt, playerGrp, playerPhysics.currentYaw, isBoosting, curWaterY);
            }
        }
    

        // Update Sun & Celestial positioning from active environment config or GUI parameter
        const targetSunY = (params.sunAltitude !== undefined && params.sunAltitude !== null) ? params.sunAltitude : target.sunY;
        const decaySunY = 1.0 - Math.exp(-6.0 * dt);
        currentSunY += (targetSunY - currentSunY) * decaySunY;
        currentMoonY += (target.moonY - currentMoonY) * decaySunY;

        const azimuthRad = THREE.MathUtils.degToRad(params.sunAzimuth !== undefined ? params.sunAzimuth : 0);
        const sunDist = params.sunDistance || 20000;
        tempVecSunFwd.set(
            Math.sin(azimuthRad) * sunDist,
            0,
            -Math.cos(azimuthRad) * sunDist
        );
        if (params.lockSunToPlayer) {
            tempVecSunFwd.applyQuaternion(playerGrp.quaternion);
        }

        // Sun positioning & visibility
        staticSun.position.copy(playerGrp.position).add(tempVecSunFwd);
        staticSun.position.y = (params.sunAltitude !== undefined && params.sunAltitude !== null)
            ? (playerGrp.position.y * 0.45 + params.sunAltitude)
            : (playerGrp.position.y * 0.45 + currentSunY);
        if (params.sunDiscScale && staticSun.scale.x !== params.sunDiscScale) {
            staticSun.scale.setScalar(params.sunDiscScale);
        }
        staticSun.visible = (timePhase !== 2);

        // Moon positioning (matches sun position & lock to player for full continuity)
        if (staticMoon) {
            staticMoon.position.copy(playerGrp.position).add(tempVecSunFwd);
            staticMoon.position.y = playerGrp.position.y * 0.45 + currentMoonY;
            staticMoon.visible = (timePhase === 2);
            if (timePhase === 2) {
                updateMoon(dt);
            }
        }

        // Active celestial light source
        updateLightingPosition({
            lightingSystem,
            playerPos: playerGrp.position,
            timePhase,
            staticMoon
        });


        
        // Dynamically scale up the terrain as Kiki flies high
        terrainScale = 1.0 + Math.min(1.0, Math.max(0.0, (playerGrp.position.y - 300.0) / 11700.0)) * 9.0;

        // Distance fog: Near = Start Distance (Clear / Zero Fog Zone around model), Far = End Distance (Max / Full Density Zone)
        const biomeFog = (window.groundFogEditor && window.groundFogEditor.runtimeState) ? window.groundFogEditor.runtimeState : null;
        const baseNear = (biomeFog && biomeFog.distNear !== undefined) ? biomeFog.distNear : (params.fogNear !== undefined ? params.fogNear : 80);
        const baseFar = (biomeFog && biomeFog.distFar !== undefined) ? biomeFog.distFar : (params.fogFar !== undefined ? params.fogFar : 1800);
        const density = (biomeFog && biomeFog.distDensity !== undefined) ? biomeFog.distDensity : (params.fogDensity !== undefined ? params.fogDensity : 1.0);
        const altScale = (biomeFog && biomeFog.distAltScale !== undefined) ? biomeFog.distAltScale : (params.fogAltitudeScale !== undefined ? params.fogAltitudeScale : 1.2);
        const autoAlt = params.fogAutoAltitude !== false;

        const currentFlightAlt = Math.max(0, playerGrp.position.y - currentGroundY);
        const altitudeExpansion = autoAlt ? Math.max(0, currentFlightAlt - 50) * altScale : 0;

        const dynamicNear = Math.max(0, (baseNear + altitudeExpansion * 0.4) / Math.max(0.1, density));
        const dynamicFar = Math.max(dynamicNear + 50, (baseFar + altitudeExpansion * 2.2) / Math.max(0.1, density));
        
        if (params.sceneFog && params.showFog !== false) {
            scene.fog.far += (dynamicFar - scene.fog.far) * Math.min(1.0, dt * 2.5);
            scene.fog.near += (dynamicNear - scene.fog.near) * Math.min(1.0, dt * 2.5);
        } else {
            scene.fog.near = 100000;
            scene.fog.far = 200000;
        }

        const altitude = Math.max(0, playerGrp.position.y - currentGroundY);

        // Dynamically adjust shadow map resolution based on altitude (quantized to prevent constant shadow re-renders)
        let baseS = 120, maxS = 250;
        if (shadowDistMode === 'Close') { baseS = 60; maxS = 120; }
        else if (shadowDistMode === 'Far') { baseS = 240; maxS = 500; }
        const rawShadowSize = THREE.MathUtils.lerp(baseS, maxS, Math.min(1, altitude / 150.0));
        const shadowSize = Math.round(rawShadowSize / 20.0) * 20.0;
        if (typeof window._currentShadowSize === 'undefined' || window._currentShadowSize !== shadowSize) {
            window._currentShadowSize = shadowSize;
            dirLight.shadow.camera.left = -shadowSize;
            dirLight.shadow.camera.right = shadowSize;
            dirLight.shadow.camera.top = shadowSize;
            dirLight.shadow.camera.bottom = -shadowSize;
            dirLight.shadow.camera.updateProjectionMatrix();
        }

        updateTerrainGeometry(playerGrp.position.x, playerGrp.position.z);
        updateInstances(playerGrp.position.x, playerGrp.position.z, time, dt, playerPhysics ? playerPhysics.currentYaw : 0);
        updateBirdsGen({
            data: birdData,
            inst: instBirds,
            count: BIRD_COUNT,
            tX: playerGrp.position.x,
            tY: playerGrp.position.y,
            tZ: playerGrp.position.z,
            time,
            dt,
            centerPull: 2.0,
            params,
            velocity: playerPhysics ? playerPhysics.velocity : 18.0,
            dummy
        });
        updateBirds(playerGrp.position.x, playerGrp.position.y, playerGrp.position.z, time, dt);
        
        updateWindTrails({
            windTrails,
            playerX: playerGrp.position.x,
            playerY: playerGrp.position.y,
            playerZ: playerGrp.position.z,
            dt,
            isWindTrailsOn: isWindTrailsOn && isWindOn,
            velocity: playerPhysics ? playerPhysics.velocity : 18.0
        });

        updateWindSound(isWindOn, isBoosting, isSoundMuted, playerPhysics ? playerPhysics.velocity : 18.0, time);

        if (typeof flightModelManager !== 'undefined' && flightModelManager) {
            flightModelManager.update(dt);
        }

        if (typeof distanceOverlay !== 'undefined' && distanceOverlay) {
            distanceOverlay.update(
                (typeof playerGrp !== 'undefined' && playerGrp) ? playerGrp.position : null,
                playerPhysics ? playerPhysics.currentYaw : 0,
                (typeof playerGrp !== 'undefined' && playerGrp) ? playerGrp.quaternion : null,
                typeof currentGroundY !== 'undefined' ? currentGroundY : 0
            );
        }

        if (typeof biplaneAudio !== 'undefined' && biplaneAudio) {
            const currentSpeed = playerPhysics ? playerPhysics.velocity : 18.0;
            const isBoosting = typeof isBoosted !== 'undefined' ? isBoosted : false;
            const isBraking = typeof isBrakingActive !== 'undefined' ? isBrakingActive : false;
            const isFlightPaused = typeof isPaused !== 'undefined' ? isPaused : false;
            const camDist = cameraManager ? cameraManager.cameraZoomDist : 12.0;
            const turnRate = playerPhysics ? (playerPhysics.targetRoll || 0) : 0;
            const pitchRate = playerPhysics ? (playerPhysics.targetPitch || 0) : 0;
            biplaneAudio.update(dt, isBoosting, isBraking, isFlightPaused, currentSpeed, camDist, turnRate, pitchRate);
        }

        // Update God Rays sun screen position & horizon line
        if (godRaysPass.enabled && typeof staticSun !== 'undefined') {
            const activeCam = isGodMode ? godCamera : camera;
            activeCam.getWorldDirection(tempVec1);
            const camWorldPos = tempVec3;
            activeCam.getWorldPosition(camWorldPos);

            // Compute exact screen-space horizon Y position to mask god rays away from ocean/ground
            const camHorizX = tempVec1.x;
            const camHorizZ = tempVec1.z;
            const horizLen = Math.hypot(camHorizX, camHorizZ);
            if (horizLen > 0.001) {
                tempVecHorizon.set(
                    camWorldPos.x + (camHorizX / horizLen) * 50000,
                    0.0,
                    camWorldPos.z + (camHorizZ / horizLen) * 50000
                );
                tempVecHorizon.project(activeCam);
                const horizonScreenY = (tempVecHorizon.y + 1.0) * 0.5;
                if (godRaysPass.uniforms.uHorizonY) {
                    godRaysPass.uniforms.uHorizonY.value = THREE.MathUtils.clamp(horizonScreenY, -0.2, 1.2);
                }
            }

            tempVecSunFwd.copy(staticSun.position).sub(camWorldPos).normalize();
            const dotFwd = tempVec1.dot(tempVecSunFwd);

            // Sun must strictly be in front of the camera to avoid negative-W clip inversion (projecting behind camera onto bottom-left water)
            if (dotFwd > 0.05) {
                tempVec2.copy(staticSun.position).project(activeCam);
                if (tempVec2.z < 1.0) {
                    const sunScreenX = (tempVec2.x + 1.0) * 0.5;
                    const sunScreenY = (tempVec2.y + 1.0) * 0.5;
                    godRaysPass.uniforms.uSunScreenPos.value.set(sunScreenX, 1.0 - sunScreenY);

                    const offScreen = Math.max(Math.abs(sunScreenX - 0.5), Math.abs(sunScreenY - 0.5));
                    const screenFade = 1.0 - Math.min(1.0, Math.max(0.0, (offScreen - 0.5) * 1.6));
                    const twilightFade = timePhase === 2 ? 0.0 : 1.0;
                    const fwdFade = THREE.MathUtils.smoothstep(dotFwd, 0.05, 0.35);
                    const sunHeightFade = THREE.MathUtils.smoothstep(staticSun.position.y, -100, 300);

                    godRaysPass.uniforms.uSunVisible.value = fwdFade * screenFade * twilightFade * sunHeightFade;
                } else {
                    godRaysPass.uniforms.uSunVisible.value = 0.0;
                }
            } else {
                godRaysPass.uniforms.uSunVisible.value = 0.0;
            }

        }

        if (typeof scenePass !== 'undefined' && scenePass) {
            scenePass.camera = isGodMode ? godCamera : camera;
        }

        composer.renderAsync();
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        if (godCamera) {
            godCamera.aspect = window.innerWidth / window.innerHeight;
            godCamera.updateProjectionMatrix();
        }
        renderer.setSize(window.innerWidth, window.innerHeight);
        // Re-derive the pixel budget: dragging onto a 4K monitor must not quadruple the
        // framebuffer. setSize() alone never re-evaluated pixel ratio.
        if (params.autoResolution) applyRenderBudget(adaptiveRes.scale);
        if (composer && typeof composer.setSize === 'function') {
            composer.setSize(window.innerWidth, window.innerHeight);
        }
    });
    const timeToggleBtn = document.getElementById('time-toggle');
    const timeIcons = [
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></svg>',
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14a5 5 0 0 0-10 0"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="4.22" y1="6.22" x2="6.34" y2="8.34"/><line x1="19.78" y1="6.22" x2="17.66" y2="8.34"/><line x1="2" y1="18" x2="22" y2="18"/><line x1="5" y1="22" x2="19" y2="22"/></svg>',
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
    ];
    const timeNames = ['Day', 'Dusk', 'Twilight'];
    
    function setTimePhase(phase) {
        timePhase = (phase % 3 + 3) % 3;
        window.timePhase = timePhase;
        if (envConfigs[timePhase]) {
            params.sunAltitude = envConfigs[timePhase].sunY;
        }
        if (timeToggleBtn) {
            timeToggleBtn.innerHTML = timeIcons[timePhase];
            timeToggleBtn.title = `Current: ${timeNames[timePhase]} (Click to cycle)`;
        }
        localStorage.setItem('wl_timePhase', timePhase);
        if (typeof gui !== 'undefined') {
            gui.controllersRecursive().forEach(c => {
                if (c.property === 'sunAltitude') c.updateDisplay();
            });
        }
    }
    window.setTimePhase = setTimePhase;
    window.getTimePhase = () => timePhase;
    window.timePhase = timePhase;

    if (timeToggleBtn) {
        timeToggleBtn.innerHTML = timeIcons[timePhase] || timeIcons[0];
        timeToggleBtn.title = `Current: ${timeNames[timePhase] || 'Day'} (Click to cycle)`;

        timeToggleBtn.addEventListener('click', () => {
            setTimePhase(timePhase + 1);
        });
    }


    // --- Modular Audio & Music System ---
    document.getElementById('music-toggle')?.addEventListener('click', () => {
        toggleMusic();
    });
    document.getElementById('track-toggle')?.addEventListener('click', () => {
        selectMusicTrack(getCurrentTrackIndex() + 1, typeof trackDropdownController !== 'undefined' ? trackDropdownController : null);
    });
    window.addEventListener('keydown', () => initAudio({ biplaneAudio, flightModelManager, isEngineSoundOn, isSoundMuted }), { once: true });
    window.addEventListener('touchstart', () => initAudio({ biplaneAudio, flightModelManager, isEngineSoundOn, isSoundMuted }), { once: true });
    document.addEventListener('click', () => initAudio({ biplaneAudio, flightModelManager, isEngineSoundOn, isSoundMuted }), { once: true });

    // Pre-warm the world so it is fully populated instantly on load
    updateTerrainGeometry(playerGrp.position.x, playerGrp.position.z);
    isPrewarming = true;
    for (let pre = 0; pre < 10; pre++) {
        currentFrame = pre;
        logicTimer = 1.0; // Force shouldUpdateTerrain = true
        updateInstances(playerGrp.position.x, playerGrp.position.z, 0, 1.0 / 60.0, 0);
    }
    isPrewarming = false;
    currentFrame = 0;
    logicTimer = 0;

    async function start() {
        initPostProcessing();
        await prewarmEngineShaders();
        // animate() is async, so a throw inside it becomes an unhandled rejection that the
        // console swallows silently and the frame just stops updating with no visible error.
        // Surface it once instead of losing it.
        let _animErrorLogged = false;
        const _reportAnimError = (e) => {
            if (_animErrorLogged) return;
            _animErrorLogged = true;
            console.error('[Wanderlust] render loop error:', e);
        };
        renderer.setAnimationLoop((t, f) => {
            try {
                const rv = animate(t, f);
                if (rv && rv.catch) rv.catch(_reportAnimError);
            } catch (e) { _reportAnimError(e); }
        });
    }
    start();

    function saveAllSettings() {
        runSaveAllSettings({
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
            isMusicPlaying: isTrackPlaying(),
            showVisualToast
        });
    }

    function loadAllSettings() {
        runLoadAllSettings({
            gui,
            flightModelManager,
            setTimePhase,
            setWindOn: (v) => { isWindOn = v; },
            setEngineSoundOn: (v) => { if (typeof setEngineSoundEnabled === 'function') setEngineSoundEnabled(v); },
            setModelVisible: (v) => { if (typeof updateModelVisibility === 'function') updateModelVisibility(v); },
            setSoundMuted: (v) => { if (typeof setSoundMuted === 'function') setSoundMuted(v); },
            setCameraZoomDist: (v) => { cameraZoomDist = Math.max(6.0, Math.min(300.0, v)); }
        });
    }
