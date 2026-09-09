import * as THREE from 'three';
import {
  seaUniform,
  speedUniform,
  detailAmountUniform,
  foamAmountUniform,
  waterOpacityUniform,
  waveHeightUniform,
  oceanScaleUniform,
  swellWavelengthUniform,
  foamEnabledUniform,
  chopPatchinessUniform,
  deepColorUniform,
  shallowColorUniform,
  horizonColorUniform,
  zenithColorUniform,
  sunColorUniform,
  sandColorUniform,
  shoreShallowColorUniform,
  shoreDepthUniform,
  shoreOpacityUniform,
  shoreFoamWidthUniform,
  shoreFoamSpeedUniform,
  shoreFoamStrengthUniform,
  shoreRefractionUniform,
  waterFogNearUniform,
  waterFogFarUniform,
  waterFogDensityUniform,
  globalFogDensityUniform,
  waterFogStrengthUniform,
  waterGridFadeStartUniform,
  waterGridFadeEndUniform,
  WAVE_PARAMS,
  updateWaveUniforms,
  setWindDirection,
  randomizeSeaSpectrum
} from './OpenSeaOcean.js';

export class WaterEditorGUI {
    constructor(waterSystem, parentGui = null) {
        this.waterSystem = waterSystem;

        if (parentGui) {
            this.gui = parentGui.addFolder('Ocean and Waves (Kimi Sea)');
        } else {
            this.gui = new GUI({ title: 'Ocean and Waves (Kimi Sea)' });
        }

        // Quick button to open full floating modal UI
        this.gui.add({
            openModal: () => {
                if (window.waterModalUI) {
                    window.waterModalUI.toggle();
                } else if (window.summonWaterModal) {
                    window.summonWaterModal(true);
                }
            }
        }, 'openModal').name('Open Sea Modal (O)');

        // Performance & Quality Controls
        const fPerf = this.gui.addFolder('Quality and Performance');
        const perfState = {
            quality: 'High (Cinematic)',
            resolution: '512x512 (Ultra)',
            distanceLod: true
        };
        fPerf.add(perfState, 'quality', ['High (Cinematic)', 'Performance (High FPS)']).name('Shader Mode').onChange(v => {
            const mode = v.startsWith('High') ? 'high' : 'performance';
            waterSystem.setQualityMode(mode);
            perfState.resolution = mode === 'high' ? '512x512 (Ultra)' : '128x128 (Fast)';
            if (window.waterModalUI) window.waterModalUI.syncQualityUI();
        });
        fPerf.add(perfState, 'resolution', ['512x512 (Ultra)', '256x256 (Balanced)', '128x128 (Fast)']).name('Mesh Density').onChange(v => {
            const res = v.split('x')[0];
            waterSystem.setMeshResolution(res);
            if (window.waterModalUI) window.waterModalUI.syncQualityUI();
        });
        fPerf.add(perfState, 'distanceLod').name('Distance LOD').onChange(v => {
            waterSystem.setDistanceLod(v);
            if (window.waterModalUI) window.waterModalUI.syncQualityUI();
        });

        const colors = {
            deep: '#' + deepColorUniform.value.getHexString(),
            shallow: '#' + shallowColorUniform.value.getHexString(),
            horizon: '#' + horizonColorUniform.value.getHexString(),
            zenith: '#' + zenithColorUniform.value.getHexString(),
            sun: '#' + sunColorUniform.value.getHexString(),
            sand: '#' + sandColorUniform.value.getHexString(),
            shoreShallow: '#' + shoreShallowColorUniform.value.getHexString(),
            heightY: waterSystem.openSeaMesh ? waterSystem.openSeaMesh.position.y : 2.4,
            windAngle: 138,
            windSpread: 45
        };

        const fWaves = this.gui.addFolder('Waves and Scale');
        fWaves.add(oceanScaleUniform, 'value', 0.1, 4.0, 0.05).name('Ocean Scale (Density)');
        fWaves.add(waveHeightUniform, 'value', 0.0, 4.0, 0.05).name('Global Wave Height');
        fWaves.add(swellWavelengthUniform, 'value', 0.2, 4.0, 0.05).name('Swell Wavelength');
        fWaves.add(seaUniform, 'value', 0.0, 2.0, 0.01).name('Sea State (Intensity)');
        fWaves.add(speedUniform, 'value', 0.0, 3.0, 0.05).name('Wave Speed');
        fWaves.add(colors, 'windAngle', 0, 360, 1).name('Wind Direction').onChange(v => {
            setWindDirection(v, colors.windSpread);
        });
        fWaves.add(colors, 'windSpread', 0, 100, 1).name('Directional Spread').onChange(v => {
            setWindDirection(colors.windAngle, v);
        });
        fWaves.add(colors, 'heightY', -20.0, 50.0, 0.1).name('Water Level Y').onChange(v => {
            waterSystem.setHeight(v);
        });

        const fColors = this.gui.addFolder('Ocean Colors');
        fColors.addColor(colors, 'deep').name('Deep Abyss Color').onChange(c => deepColorUniform.value.set(c));
        fColors.addColor(colors, 'shallow').name('Shallow Crest Color').onChange(c => shallowColorUniform.value.set(c));
        fColors.addColor(colors, 'horizon').name('Horizon Blend Color').onChange(c => horizonColorUniform.value.set(c));
        fColors.addColor(colors, 'zenith').name('Zenith Sky Color').onChange(c => zenithColorUniform.value.set(c));
        fColors.addColor(colors, 'sun').name('Sun Specular Color').onChange(c => sunColorUniform.value.set(c));

        // Atmospheric Fog & Seamless Horizon Blend
        const fFog = this.gui.addFolder('Atmospheric Fog & Horizon');
        fFog.add(globalFogDensityUniform, 'value', 0.0, 4.0, 0.05).name('Global Fog Density').listen();
        fFog.add(waterFogStrengthUniform, 'value', 0.0, 1.0, 0.01).name('Fog Blend Strength').listen();
        fFog.add(waterFogNearUniform, 'value', 0.0, 4000.0, 50.0).name('Fog Start Dist (m)').listen();
        fFog.add(waterFogFarUniform, 'value', 1000.0, 12000.0, 100.0).name('Fog End Dist (m)').listen();
        fFog.add(waterGridFadeStartUniform, 'value', 2000.0, 7500.0, 100.0).name('Grid Fade Start (m)').listen();
        fFog.add(waterGridFadeEndUniform, 'value', 4000.0, 8000.0, 50.0).name('Grid Fade End (m)').listen();

        // Atmospheric blend presets
        const fogPresets = {
            balanced: () => {
                globalFogDensityUniform.value = 1.0;
                waterFogStrengthUniform.value = 1.0;
                waterFogNearUniform.value = 800.0;
                waterFogFarUniform.value = 6800.0;
                waterGridFadeStartUniform.value = 5600.0;
                waterGridFadeEndUniform.value = 7600.0;
            },
            clear: () => {
                globalFogDensityUniform.value = 0.5;
                waterFogStrengthUniform.value = 1.0;
                waterFogNearUniform.value = 1800.0;
                waterFogFarUniform.value = 8500.0;
                waterGridFadeStartUniform.value = 6200.0;
                waterGridFadeEndUniform.value = 7800.0;
            },
            misty: () => {
                globalFogDensityUniform.value = 2.2;
                waterFogStrengthUniform.value = 1.0;
                waterFogNearUniform.value = 300.0;
                waterFogFarUniform.value = 3800.0;
                waterGridFadeStartUniform.value = 3500.0;
                waterGridFadeEndUniform.value = 5500.0;
            }
        };
        fFog.add(fogPresets, 'balanced').name('Preset: Balanced (Default)');
        fFog.add(fogPresets, 'clear').name('Preset: Clear Horizon');
        fFog.add(fogPresets, 'misty').name('Preset: Misty Horizon');

        const fSurface = this.gui.addFolder('Surface and Foam');
        fSurface.add(waterOpacityUniform, 'value', 0.1, 1.0, 0.01).name('Water Opacity');
        fSurface.add(detailAmountUniform, 'value', 0.0, 3.0, 0.05).name('Capillary Choppiness');
        fSurface.add(foamAmountUniform, 'value', 0.0, 3.0, 0.05).name('Foam Amount');
        fSurface.add(chopPatchinessUniform, 'value', 0.0, 3.0, 0.05).name('Chop Patchiness');
        fSurface.add(foamEnabledUniform, 'value', 0.0, 1.0, 1.0).name('Foam Enabled (0/1)');

        const fShore = this.gui.addFolder('Shore');
        fShore.addColor(colors, 'sand').name('Sand Band Color').onChange(c => sandColorUniform.value.set(c));
        fShore.addColor(colors, 'shoreShallow').name('Shore Shallow Color').onChange(c => shoreShallowColorUniform.value.set(c));
        fShore.add(shoreDepthUniform, 'value', 0.5, 30.0, 0.1).name('Shore Depth (m)');
        fShore.add(shoreOpacityUniform, 'value', 0.0, 1.0, 0.01).name('Shore Opacity');
        fShore.add(shoreFoamWidthUniform, 'value', 0.0, 12.0, 0.1).name('Shore Foam Width (m)');
        fShore.add(shoreFoamSpeedUniform, 'value', 0.0, 4.0, 0.05).name('Shore Foam Speed');
        fShore.add(shoreFoamStrengthUniform, 'value', 0.0, 3.0, 0.05).name('Shore Foam Strength');
        fShore.add(shoreRefractionUniform, 'value', 0.0, 2.0, 0.01).name('Shore Refraction');

        const fSpectrum = this.gui.addFolder('Spectral Waves');
        fSpectrum.add({ randomize: () => {
            randomizeSeaSpectrum();
        } }, 'randomize').name('Randomize Wave Spectrum');

        WAVE_PARAMS.forEach((p, i) => {
            const sub = fSpectrum.addFolder(`Wave ${i + 1} (${p.wavelength.toFixed(1)}m)`);
            sub.add(p, 'wavelength', 2.0, 300.0, 1.0).name('Wavelength (m)').onChange(() => updateWaveUniforms(i));
            sub.add(p, 'steepness', 0.0, 0.4, 0.005).name('Steepness').onChange(() => updateWaveUniforms(i));
            sub.add(p, 'phase', 0.0, Math.PI * 2, 0.05).name('Phase').onChange(() => updateWaveUniforms(i));
            sub.close();
        });
        fSpectrum.close();
    }

    show() {
        if (this.gui) this.gui.show();
    }

    hide() {
        if (this.gui) this.gui.hide();
    }
}
