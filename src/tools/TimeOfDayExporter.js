// TimeOfDayExporter.js - Export and Import Time of Day Settings (Day, Dusk, Night) as JSON
// Clean plain-text implementation with zero icons/emojis, full schema compatibility,
// live clipboard copy, file downloads, and real-time preset importing.

import { moonParams } from '../environment/CelestialObjects.js';

export class TimeOfDayExporter {
    constructor(contextGetter) {
        this.getContext = typeof contextGetter === 'function' ? contextGetter : () => contextGetter;
    }

    getPhaseKey(phaseIndex) {
        const keys = ['day', 'dusk', 'night'];
        const idx = (Math.floor(phaseIndex) % 3 + 3) % 3;
        return keys[idx] || 'day';
    }

    getPhaseTitle(phaseIndex) {
        const titles = ['Day', 'Dusk', 'Night'];
        const idx = (Math.floor(phaseIndex) % 3 + 3) % 3;
        return titles[idx] || 'Day';
    }

    showToast(message) {
        const ctx = this.getContext();
        if (ctx && typeof ctx.showToast === 'function') {
            ctx.showToast(message);
            return;
        }
        let toast = document.getElementById('wl-visual-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'wl-visual-toast';
            toast.style.position = 'fixed';
            toast.style.bottom = '24px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.background = 'rgba(15, 23, 42, 0.9)';
            toast.style.color = '#fff';
            toast.style.padding = '8px 18px';
            toast.style.borderRadius = '20px';
            toast.style.fontFamily = 'system-ui, sans-serif';
            toast.style.fontSize = '13px';
            toast.style.zIndex = '99999';
            toast.style.pointerEvents = 'none';
            toast.style.transition = 'opacity 0.3s ease';
            document.body.appendChild(toast);
        }
        toast.innerText = message;
        toast.style.opacity = '1';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            if (toast) toast.style.opacity = '0';
        }, 2400);
    }

    toHex(colorVal, defaultHex = '#000000') {
        if (colorVal === null || colorVal === undefined) return defaultHex;
        if (typeof colorVal === 'number') {
            return '#' + Math.floor(colorVal).toString(16).padStart(6, '0');
        }
        if (typeof colorVal === 'string') {
            if (colorVal.startsWith('#')) return colorVal;
            if (colorVal.startsWith('0x') || colorVal.startsWith('0X')) {
                return '#' + colorVal.slice(2).padStart(6, '0');
            }
            return '#' + colorVal;
        }
        if (colorVal && typeof colorVal.getHexString === 'function') {
            return '#' + colorVal.getHexString();
        }
        return defaultHex;
    }

    toRawHex(colorVal, defaultRaw = '0x000000') {
        if (colorVal === null || colorVal === undefined) return defaultRaw;
        if (typeof colorVal === 'number') {
            return '0x' + Math.floor(colorVal).toString(16).padStart(6, '0');
        }
        if (typeof colorVal === 'string') {
            const clean = colorVal.replace(/^[#0x]+/i, '').padStart(6, '0');
            return '0x' + clean;
        }
        if (colorVal && typeof colorVal.getHexString === 'function') {
            return '0x' + colorVal.getHexString();
        }
        return defaultRaw;
    }

    parseHex(colorVal, defaultNum = 0x000000) {
        if (colorVal === null || colorVal === undefined) return defaultNum;
        if (typeof colorVal === 'number') return Math.floor(colorVal);
        if (typeof colorVal === 'string') {
            const clean = colorVal.replace(/^[#0x]+/i, '');
            const parsed = parseInt(clean, 16);
            return isNaN(parsed) ? defaultNum : parsed;
        }
        if (colorVal && typeof colorVal.getHex === 'function') {
            return colorVal.getHex();
        }
        return defaultNum;
    }

    buildPhaseData(phaseIndex) {
        const ctx = this.getContext();
        const phase = (Math.floor(phaseIndex) % 3 + 3) % 3;
        const phaseKey = this.getPhaseKey(phase);
        const phaseTitle = this.getPhaseTitle(phase);
        const env = (ctx.envConfigs && ctx.envConfigs[phase]) ? ctx.envConfigs[phase] : {};
        const p = ctx.params || {};
        const skyU = ctx.skyUniforms || {};
        const grPass = ctx.godRaysPass || {};
        const grUniforms = grPass.uniforms || {};
        const skyEd = ctx.skyEditorParams || {};
        const cParams = ctx.cloudParams || {};
        const mwParams = ctx.milkyWayParams || {};
        const aurParams = ctx.auroraParams || {};

        const bgHex = this.toHex(env.bg, phase === 0 ? '#3f7fc4' : phase === 1 ? '#2a5090' : '#0a1330');
        const midHex = this.toHex(env.mid, phase === 0 ? '#74add9' : phase === 1 ? '#c85078' : '#1b2f5c');
        const fogHex = this.toHex(env.fog, phase === 0 ? '#bcd2e2' : phase === 1 ? '#ffa07a' : '#24406e');
        const ambHex = this.toHex(env.amb, phase === 0 ? '#cfe6f7' : phase === 1 ? '#ffdab9' : '#6b82ad');
        const dirHex = this.toHex(env.dir, phase === 0 ? '#fff3d8' : phase === 1 ? '#ffaa00' : '#9ecbff');
        const glintHex = this.toHex(env.glintCol, phase === 0 ? '#fff0d0' : phase === 1 ? '#ffaa00' : '#8cc4ff');
        const cloudHex = this.toHex(env.cloudCol, phase === 0 ? '#fdf7e8' : phase === 1 ? '#fffaec' : '#33507d');

        const atmosphereAndWeather = {
            groundFog: {
                enableFog: p.fogPlane !== undefined ? Boolean(p.fogPlane) : false,
                biomeFogOffset: typeof p.biomeFogOffset === 'number' ? p.biomeFogOffset : 0,
                fogColor: fogHex,
                fogNear: 100,
                fogFar: 1800
            },
            skyZenith: bgHex,
            skyMid: midHex,
            skyHorizon: fogHex,
            skyColor: bgHex,
            fogColor: fogHex,
            ambientLight: ambHex,
            ambIntensity: typeof env.ambI === 'number' ? env.ambI : (phase === 0 ? 0.75 : phase === 1 ? 1.1 : 1.05),
            directionalLight: dirHex,
            dirIntensity: typeof env.dirI === 'number' ? env.dirI : (phase === 0 ? 1.6 : phase === 1 ? 3.2 : 2.2),
            waterGlint: glintHex,
            globalBrightness: typeof p.exposureTrim === 'number' ? p.exposureTrim : 1.0,
            exposureTrim: typeof p.exposureTrim === 'number' ? p.exposureTrim : 1.0
        };

        if (phase === 0) {
            atmosphereAndWeather.dayExposure = typeof p.dayExposure === 'number' ? p.dayExposure : 0.5;
        } else if (phase === 2) {
            atmosphereAndWeather.nightExposure = typeof p.nightExposure === 'number' ? p.nightExposure : 1.0;
        }

        const isCurrentPhaseActive = (ctx.timePhase === phase);
        const sunAltitudeVal = (isCurrentPhaseActive && typeof p.sunAltitude === 'number')
            ? p.sunAltitude
            : (typeof env.sunY === 'number' ? env.sunY : (phase === 0 ? 10000 : phase === 1 ? 160 : -8000));

        const sunAndSunlight = {
            sunDiscColor: '#ffffff',
            sunDiscScale: typeof p.sunDiscScale === 'number' ? p.sunDiscScale : 1.7,
            sunAltitudeHeight: sunAltitudeVal,
            sunAzimuth: typeof p.sunAzimuth === 'number' ? p.sunAzimuth : 0,
            sunDistance: 20000,
            lockSunToPlayer: p.lockSunToPlayer !== undefined ? Boolean(p.lockSunToPlayer) : true,
            sunlightColor: dirHex,
            sunlightIntensity: typeof env.dirI === 'number' ? env.dirI : (phase === 0 ? 1.6 : phase === 1 ? 3.2 : 2.2),
            waterGlintColor: glintHex,
            sunMeshBaseRadius: 600,
            sunPositionFormula: {
                x: 'player.x + sin(azimuth) * sunDistance',
                y: 'player.y * 0.45 + sunAltitudeHeight',
                z: 'player.z - cos(azimuth) * sunDistance'
            }
        };

        const rayInnerHex = grUniforms.uRayColorInner ? this.toHex(grUniforms.uRayColorInner.value, '#fffaeb') : (phase === 0 ? '#fffaeb' : phase === 1 ? '#ffaa44' : '#ffbb55');
        const rayOuterHex = grUniforms.uRayColorOuter ? this.toHex(grUniforms.uRayColorOuter.value, '#ffaa44') : (phase === 0 ? '#ffaa44' : phase === 1 ? '#ff5500' : '#88bbff');
        const enableGodRaysVal = (phase === 2) ? false : (p.godRays !== undefined ? Boolean(p.godRays) : true);

        const godRaysEditor = {
            enableGodRays: enableGodRaysVal,
            rayIntensity: typeof p.godRayIntensity === 'number' ? p.godRayIntensity : 0.65,
            rayDecayLength: typeof p.godRayDecay === 'number' ? p.godRayDecay : 0.927,
            rayDensitySpread: typeof p.godRayDensity === 'number' ? p.godRayDensity : 0.5,
            rayWeightBrightness: typeof p.highlightKnee === 'number' ? p.highlightKnee : 0.75,
            rayInnerColor: rayInnerHex,
            rayOuterColor: rayOuterHex,
            occlusionMinInclusion: typeof p.lumMin === 'number' ? p.lumMin : 0.45,
            occlusionMaxCutoff: typeof p.lumMax === 'number' ? p.lumMax : 0.85,
            particleDitherHaze: 1.0,
            screenEdgeFadeDist: 1.5,
            bloomHaloRadius: 0.2,
            bloomHaloStrength: 0.25,
            samples: 32
        };

        const skyAndGradients = {
            gradientSkyEnabled: skyU.uGradientSkyEnabled ? Boolean(skyU.uGradientSkyEnabled.value) : true,
            gradientPower: skyU.uGradientPower ? skyU.uGradientPower.value : (phase === 0 ? 1.0 : 1.2),
            gradientMidOffset: skyU.uGradientMidOffset ? skyU.uGradientMidOffset.value : (phase === 0 ? 0.25 : 0.22),
            sunCorona: skyU.uSunCoronaIntensity ? skyU.uSunCoronaIntensity.value : 0.7,
            horizonGlow: typeof p.horizonGlow === 'number' ? p.horizonGlow : (skyU.uHorizonGlow ? skyU.uHorizonGlow.value : 0.45),
            skyRenderMode: p.skyRenderMode || 'Gradient Regular',
            showProceduralSky: p.showProceduralSky !== undefined ? Boolean(p.showProceduralSky) : true,
            enableProceduralClouds: p.enableProceduralClouds !== undefined ? Boolean(p.enableProceduralClouds) : false
        };

        const proceduralSky = {
            cloudCoverage: typeof skyEd.coverage === 'number' ? skyEd.coverage : 0.45,
            cloudEdge: typeof skyEd.edge === 'number' ? skyEd.edge : 0.07,
            cloudSpeed: typeof skyEd.speed === 'number' ? skyEd.speed : 0.02,
            skyZenith: bgHex,
            skyMid: midHex,
            skyHorizon: fogHex,
            cloudColor: cloudHex,
            cloudShadow: skyEd.cloudShadow || '#8898a8',
            stormTurbulence: typeof skyEd.turbulence === 'number' ? skyEd.turbulence : 0,
            stormDarken: typeof skyEd.stormDarken === 'number' ? skyEd.stormDarken : 0,
            cloudOpacity: skyU.uCloudOpacity ? skyU.uCloudOpacity.value : 1.0,
            weather: ctx.currentWeather || skyEd.weather || 'clear'
        };

        const clouds3D = {
            density: typeof cParams.density === 'number' ? cParams.density : 1.0,
            cloudScale: typeof cParams.cloudScale === 'number' ? cParams.cloudScale : 1.0,
            showClouds: p.showClouds !== undefined ? Boolean(p.showClouds) : true,
            showCloudsRegular: p.showCloudsRegular !== undefined ? Boolean(p.showCloudsRegular) : true,
            showCloudsHigh: p.showCloudsHigh !== undefined ? Boolean(p.showCloudsHigh) : true,
            showCloudsWispy: p.showCloudsWispy !== undefined ? Boolean(p.showCloudsWispy) : true,
            showCloudsMega: p.showCloudsMega !== undefined ? Boolean(p.showCloudsMega) : true,
            showCloudsHorizon: p.showCloudsHorizon !== undefined ? Boolean(p.showCloudsHorizon) : false,
            cloudColors: [
                cParams.c0 || '#ffffff',
                cParams.c1 || '#ffffff',
                cParams.c2 || '#ffffff',
                cParams.c3 || '#ffffff',
                cParams.c4 || '#ffffff'
            ]
        };

        const water = {
            shore: {
                sandColor: '#ede7ce',
                shoreShallowColor: '#99ddda',
                shoreDepth: 6.0,
                shoreOpacity: 0.1,
                shoreFoamWidth: 2.2,
                shoreFoamSpeed: 0.8,
                shoreFoamStrength: 1.0,
                shoreRefraction: 0.35
            }
        };

        const envConfigsRaw = {
            name: phaseTitle,
            bg: this.toRawHex(env.bg, phase === 0 ? '0x3f7fc4' : phase === 1 ? '0x2a5090' : '0x0a1330'),
            mid: this.toRawHex(env.mid, phase === 0 ? '0x74add9' : phase === 1 ? '0xc85078' : '0x1b2f5c'),
            fog: this.toRawHex(env.fog, phase === 0 ? '0xbcd2e2' : phase === 1 ? '0xffa07a' : '0x24406e'),
            amb: this.toRawHex(env.amb, phase === 0 ? '0xcfe6f7' : phase === 1 ? '0xffdab9' : '0x6b82ad'),
            dir: this.toRawHex(env.dir, phase === 0 ? '0xfff3d8' : phase === 1 ? '0xffaa00' : '0x9ecbff'),
            ambI: typeof env.ambI === 'number' ? env.ambI : (phase === 0 ? 0.75 : phase === 1 ? 1.1 : 1.05),
            dirI: typeof env.dirI === 'number' ? env.dirI : (phase === 0 ? 1.6 : phase === 1 ? 3.2 : 2.2),
            starOp: typeof env.starOp === 'number' ? env.starOp : (phase === 2 ? 1.0 : 0.0),
            sunY: typeof env.sunY === 'number' ? env.sunY : (phase === 0 ? 10000 : phase === 1 ? 160 : -8000),
            moonY: typeof env.moonY === 'number' ? env.moonY : (phase === 0 ? -8000 : phase === 1 ? 200 : 9000),
            glintCol: this.toRawHex(env.glintCol, phase === 0 ? '0xfff0d0' : phase === 1 ? '0xffaa00' : '0x8cc4ff'),
            cloudCol: this.toRawHex(env.cloudCol, phase === 0 ? '0xfdf7e8' : phase === 1 ? '0xfffaec' : '0x33507d')
        };

        const phaseData = {
            timeOfDay: phaseTitle,
            timePhase: phase,
            atmosphereAndWeather,
            sunAndSunlight,
            godRaysEditor,
            skyAndGradients,
            proceduralSky,
            clouds3D,
            water,
            envConfigsRaw
        };

        if (phase === 2) {
            phaseData.moonlightAndNight = {
                globalBrightness: typeof p.exposureTrim === 'number' ? p.exposureTrim : 1.0,
                moonlightColor: dirHex,
                moonlightPower: typeof env.dirI === 'number' ? env.dirI : 2.2,
                nightFillColor: ambHex,
                nightFillPower: typeof env.ambI === 'number' ? env.ambI : 1.05,
                nightSkyColor: bgHex,
                nightFogColor: fogHex,
                moonAltitude: typeof env.moonY === 'number' ? env.moonY : 9000,
                moonDistance: moonParams ? moonParams.distance : 20000,
                moonAzimuth: moonParams ? moonParams.azimuth : 63,
                moonSize: moonParams ? moonParams.size : 1.0,
                moonBrightness: moonParams ? moonParams.brightness : 1.0,
                moonRotationX: moonParams ? moonParams.rotationX : 0,
                moonRotationY: moonParams ? moonParams.rotationY : 90,
                moonRotationZ: moonParams ? moonParams.rotationZ : 0,
                moonRotationSpeed: moonParams ? moonParams.rotationSpeed : 0.002,
                moonGlowIntensity: moonParams ? moonParams.glowIntensity : 0.85,
                moonGlowRadius: moonParams ? moonParams.glowRadius : 2.6,
                moonGlowColor: moonParams ? moonParams.glowColor : '#b0d4ff',
                moonMeshBaseRadius: 450,
                nightExposure: typeof p.nightExposure === 'number' ? p.nightExposure : 1.0,
                starDensity: skyU.uStarDensity ? skyU.uStarDensity.value : 0.08,
                starBrightness: skyU.uStarBrightness ? skyU.uStarBrightness.value : 1.0,
                starTwinkle: skyU.uStarTwinkle ? skyU.uStarTwinkle.value : 0.5,
                nightSkyLift: skyU.uNightSkyLift ? skyU.uNightSkyLift.value : 1.0,
                milkyWay: {
                    strength: skyU.uMilkyWay ? skyU.uMilkyWay.value : 1.0,
                    dust: skyU.uMilkyDust ? skyU.uMilkyDust.value : 0.4,
                    armColor: skyU.uMilkyArmColor ? this.toHex(skyU.uMilkyArmColor.value, '#6688cc') : '#6688cc',
                    coreColor: skyU.uMilkyCoreColor ? this.toHex(skyU.uMilkyCoreColor.value, '#ddbb99') : '#ddbb99',
                    cubemapBrightness: typeof mwParams.brightness === 'number' ? mwParams.brightness : 1.0,
                    cubemapOpacity: typeof mwParams.opacity === 'number' ? mwParams.opacity : 0.8,
                    tiltX: mwParams.tiltX || 0,
                    tiltY: mwParams.tiltY || 0,
                    tiltZ: mwParams.tiltZ || 0,
                    starBrightness: typeof mwParams.starBrightness === 'number' ? mwParams.starBrightness : 1.0,
                    starExtinction: typeof mwParams.starExtinction === 'number' ? mwParams.starExtinction : 0.5,
                    starTwinkle: typeof mwParams.starTwinkle === 'number' ? mwParams.starTwinkle : 0.3,
                    starSpikes: typeof mwParams.starSpikes === 'number' ? mwParams.starSpikes : 0.5
                },
                aurora: {
                    opacity: typeof aurParams.opacity === 'number' ? aurParams.opacity : 0.0,
                    intensity: typeof aurParams.intensity === 'number' ? aurParams.intensity : 1.0,
                    speed: typeof aurParams.speed === 'number' ? aurParams.speed : 1.0,
                    altitude: typeof aurParams.altitude === 'number' ? aurParams.altitude : 2000
                }
            };
        }

        return phaseData;
    }

    buildAllPhasesData() {
        return {
            $schema: 'http://json-schema.org/draft-07/schema#',
            title: 'WANDERLUST webgpu Environment & Visual Settings',
            version: '1.3.0',
            exportedAt: new Date().toISOString(),
            presets: {
                day: this.buildPhaseData(0),
                dusk: this.buildPhaseData(1),
                night: this.buildPhaseData(2)
            }
        };
    }

    copyToClipboard(jsonData, label) {
        const jsonStr = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData, null, 2);
        console.log(`[TimeOfDay Export - ${label}]:\n`, jsonStr);

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(jsonStr).then(() => {
                this.showToast(`Copied ${label} JSON to clipboard`);
            }).catch(() => {
                prompt(`Copy ${label} JSON (Ctrl+C):`, jsonStr);
            });
        } else {
            prompt(`Copy ${label} JSON (Ctrl+C):`, jsonStr);
        }
    }

    downloadJson(filename, jsonData) {
        const jsonStr = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            if (a.parentElement) a.parentElement.removeChild(a);
            URL.revokeObjectURL(url);
        }, 120);
        this.showToast(`Downloaded ${filename}`);
    }

    exportPhase(phaseIndex, download = false) {
        const phase = (Math.floor(phaseIndex) % 3 + 3) % 3;
        const phaseData = this.buildPhaseData(phase);
        const phaseKey = this.getPhaseKey(phase);
        const phaseTitle = this.getPhaseTitle(phase);

        if (download) {
            this.downloadJson(`${phaseKey}_settings.json`, phaseData);
        } else {
            this.copyToClipboard(phaseData, `${phaseTitle} Settings`);
        }
        return phaseData;
    }

    exportActivePhase(download = false) {
        const ctx = this.getContext();
        const activePhase = (typeof ctx.timePhase === 'number') ? ctx.timePhase : 1;
        return this.exportPhase(activePhase, download);
    }

    exportAllPhases(download = false) {
        const allData = this.buildAllPhasesData();
        if (download) {
            this.downloadJson('environment_settings.json', allData);
        } else {
            this.copyToClipboard(allData, 'All Times of Day');
        }
        return allData;
    }

    applyPhaseData(phaseIndex, data) {
        if (!data || typeof data !== 'object') return false;
        const ctx = this.getContext();
        const phase = (Math.floor(phaseIndex) % 3 + 3) % 3;
        const env = ctx.envConfigs && ctx.envConfigs[phase] ? ctx.envConfigs[phase] : null;
        if (!env) return false;

        const p = ctx.params || {};
        const skyU = ctx.skyUniforms || {};
        const grPass = ctx.godRaysPass || {};
        const grUniforms = grPass.uniforms || {};

        if (data.envConfigsRaw) {
            const raw = data.envConfigsRaw;
            if (raw.bg !== undefined) env.bg = this.parseHex(raw.bg, env.bg);
            if (raw.mid !== undefined) env.mid = this.parseHex(raw.mid, env.mid);
            if (raw.fog !== undefined) env.fog = this.parseHex(raw.fog, env.fog);
            if (raw.amb !== undefined) env.amb = this.parseHex(raw.amb, env.amb);
            if (raw.dir !== undefined) env.dir = this.parseHex(raw.dir, env.dir);
            if (raw.ambI !== undefined) env.ambI = Number(raw.ambI);
            if (raw.dirI !== undefined) env.dirI = Number(raw.dirI);
            if (raw.starOp !== undefined) env.starOp = Number(raw.starOp);
            if (raw.sunY !== undefined) env.sunY = Number(raw.sunY);
            if (raw.moonY !== undefined) env.moonY = Number(raw.moonY);
            if (raw.glintCol !== undefined) env.glintCol = this.parseHex(raw.glintCol, env.glintCol);
            if (raw.cloudCol !== undefined) env.cloudCol = this.parseHex(raw.cloudCol, env.cloudCol);
        }

        if (data.atmosphereAndWeather) {
            const atmo = data.atmosphereAndWeather;
            if (atmo.skyColor !== undefined) env.bg = this.parseHex(atmo.skyColor, env.bg);
            if (atmo.skyZenith !== undefined) env.bg = this.parseHex(atmo.skyZenith, env.bg);
            if (atmo.skyMid !== undefined) env.mid = this.parseHex(atmo.skyMid, env.mid);
            if (atmo.fogColor !== undefined) env.fog = this.parseHex(atmo.fogColor, env.fog);
            if (atmo.ambientLight !== undefined) env.amb = this.parseHex(atmo.ambientLight, env.amb);
            if (atmo.ambIntensity !== undefined) env.ambI = Number(atmo.ambIntensity);
            if (atmo.dirIntensity !== undefined) env.dirI = Number(atmo.dirIntensity);
            if (atmo.waterGlint !== undefined) env.glintCol = this.parseHex(atmo.waterGlint, env.glintCol);
            if (atmo.globalBrightness !== undefined) {
                p.exposureTrim = Number(atmo.globalBrightness);
                p.exposure = Number(atmo.globalBrightness);
            }
            if (atmo.exposureTrim !== undefined) p.exposureTrim = Number(atmo.exposureTrim);
            if (atmo.dayExposure !== undefined && phase === 0) p.dayExposure = Number(atmo.dayExposure);
            if (atmo.nightExposure !== undefined && phase === 2) p.nightExposure = Number(atmo.nightExposure);
            if (atmo.groundFog) {
                if (atmo.groundFog.enableFog !== undefined) p.fogPlane = Boolean(atmo.groundFog.enableFog);
                if (atmo.groundFog.biomeFogOffset !== undefined) p.biomeFogOffset = Number(atmo.groundFog.biomeFogOffset);
            }
        }

        if (data.sunAndSunlight) {
            const sun = data.sunAndSunlight;
            if (sun.sunAltitudeHeight !== undefined) {
                env.sunY = Number(sun.sunAltitudeHeight);
                if (ctx.timePhase === phase) p.sunAltitude = Number(sun.sunAltitudeHeight);
            }
            if (sun.sunAzimuth !== undefined) p.sunAzimuth = Number(sun.sunAzimuth);
            if (sun.sunDiscScale !== undefined) p.sunDiscScale = Number(sun.sunDiscScale);
            if (sun.lockSunToPlayer !== undefined) p.lockSunToPlayer = Boolean(sun.lockSunToPlayer);
            if (sun.sunlightColor !== undefined) env.dir = this.parseHex(sun.sunlightColor, env.dir);
            if (sun.sunlightIntensity !== undefined) env.dirI = Number(sun.sunlightIntensity);
            if (sun.waterGlintColor !== undefined) env.glintCol = this.parseHex(sun.waterGlintColor, env.glintCol);
        }

        if (data.godRaysEditor) {
            const gr = data.godRaysEditor;
            if (gr.enableGodRays !== undefined) p.godRays = Boolean(gr.enableGodRays);
            if (gr.rayIntensity !== undefined) p.godRayIntensity = Number(gr.rayIntensity);
            if (gr.rayDecayLength !== undefined) p.godRayDecay = Number(gr.rayDecayLength);
            if (gr.rayDensitySpread !== undefined) p.godRayDensity = Number(gr.rayDensitySpread);
            if (gr.rayWeightBrightness !== undefined) p.highlightKnee = Number(gr.rayWeightBrightness);
            if (gr.occlusionMinInclusion !== undefined) p.lumMin = Number(gr.occlusionMinInclusion);
            if (gr.occlusionMaxCutoff !== undefined) p.lumMax = Number(gr.occlusionMaxCutoff);
            if (gr.rayInnerColor && grUniforms.uRayColorInner) grUniforms.uRayColorInner.value.set(gr.rayInnerColor);
            if (gr.rayOuterColor && grUniforms.uRayColorOuter) grUniforms.uRayColorOuter.value.set(gr.rayOuterColor);
        }

        if (data.skyAndGradients) {
            const sg = data.skyAndGradients;
            if (sg.gradientPower !== undefined && skyU.uGradientPower) skyU.uGradientPower.value = Number(sg.gradientPower);
            if (sg.gradientMidOffset !== undefined && skyU.uGradientMidOffset) skyU.uGradientMidOffset.value = Number(sg.gradientMidOffset);
            if (sg.sunCorona !== undefined && skyU.uSunCoronaIntensity) skyU.uSunCoronaIntensity.value = Number(sg.sunCorona);
            if (sg.horizonGlow !== undefined) {
                p.horizonGlow = Number(sg.horizonGlow);
                if (skyU.uHorizonGlow) skyU.uHorizonGlow.value = Number(sg.horizonGlow);
            }
            if (sg.skyRenderMode !== undefined) p.skyRenderMode = sg.skyRenderMode;
        }

        if (data.moonlightAndNight && phase === 2) {
            const mn = data.moonlightAndNight;
            if (mn.moonlightColor !== undefined) env.dir = this.parseHex(mn.moonlightColor, env.dir);
            if (mn.moonlightPower !== undefined) env.dirI = Number(mn.moonlightPower);
            if (mn.nightFillColor !== undefined) env.amb = this.parseHex(mn.nightFillColor, env.amb);
            if (mn.nightFillPower !== undefined) env.ambI = Number(mn.nightFillPower);
            if (mn.nightSkyColor !== undefined) env.bg = this.parseHex(mn.nightSkyColor, env.bg);
            if (mn.nightFogColor !== undefined) env.fog = this.parseHex(mn.nightFogColor, env.fog);
            if (mn.moonAltitude !== undefined) env.moonY = Number(mn.moonAltitude);
            if (moonParams) {
                if (mn.moonSize !== undefined) moonParams.size = Number(mn.moonSize);
                if (mn.moonBrightness !== undefined) moonParams.brightness = Number(mn.moonBrightness);
                if (mn.moonAzimuth !== undefined) moonParams.azimuth = Number(mn.moonAzimuth);
                if (mn.moonDistance !== undefined) moonParams.distance = Number(mn.moonDistance);
                if (mn.moonRotationX !== undefined) moonParams.rotationX = Number(mn.moonRotationX);
                if (mn.moonRotationY !== undefined) moonParams.rotationY = Number(mn.moonRotationY);
                if (mn.moonRotationZ !== undefined) moonParams.rotationZ = Number(mn.moonRotationZ);
                if (mn.moonRotationSpeed !== undefined) moonParams.rotationSpeed = Number(mn.moonRotationSpeed);
                if (mn.moonGlowIntensity !== undefined) {
                    moonParams.glowIntensity = Number(mn.moonGlowIntensity);
                    if (skyU.uMoonCoronaIntensity) skyU.uMoonCoronaIntensity.value = moonParams.glowIntensity;
                }
                if (mn.moonGlowRadius !== undefined) moonParams.glowRadius = Number(mn.moonGlowRadius);
                if (mn.moonGlowColor !== undefined) moonParams.glowColor = mn.moonGlowColor;
            }
            if (mn.nightExposure !== undefined) p.nightExposure = Number(mn.nightExposure);
            if (mn.starDensity !== undefined && skyU.uStarDensity) skyU.uStarDensity.value = Number(mn.starDensity);
            if (mn.starBrightness !== undefined && skyU.uStarBrightness) skyU.uStarBrightness.value = Number(mn.starBrightness);
            if (mn.starTwinkle !== undefined && skyU.uStarTwinkle) skyU.uStarTwinkle.value = Number(mn.starTwinkle);
            if (mn.nightSkyLift !== undefined && skyU.uNightSkyLift) skyU.uNightSkyLift.value = Number(mn.nightSkyLift);
        }

        return true;
    }

    importSettings(input) {
        if (!input) return false;
        let parsed = input;
        if (typeof input === 'string') {
            try {
                parsed = JSON.parse(input);
            } catch (err) {
                alert('Invalid JSON: ' + err.message);
                return false;
            }
        }

        const ctx = this.getContext();
        let appliedAny = false;

        if (parsed.presets) {
            if (parsed.presets.day) appliedAny = this.applyPhaseData(0, parsed.presets.day) || appliedAny;
            if (parsed.presets.dusk) appliedAny = this.applyPhaseData(1, parsed.presets.dusk) || appliedAny;
            if (parsed.presets.night) appliedAny = this.applyPhaseData(2, parsed.presets.night) || appliedAny;
        } else if (parsed.timePhase !== undefined || parsed.timeOfDay !== undefined) {
            let phase = 0;
            if (typeof parsed.timePhase === 'number') {
                phase = parsed.timePhase;
            } else if (typeof parsed.timeOfDay === 'string') {
                const lower = parsed.timeOfDay.toLowerCase();
                phase = lower.includes('night') || lower.includes('twilight') ? 2 : (lower.includes('dusk') ? 1 : 0);
            }
            appliedAny = this.applyPhaseData(phase, parsed);
        } else if (Array.isArray(parsed)) {
            parsed.forEach((item, idx) => {
                if (idx < 3) appliedAny = this.applyPhaseData(idx, item) || appliedAny;
            });
        }

        if (appliedAny) {
            if (typeof ctx.setTimePhase === 'function') {
                ctx.setTimePhase(ctx.timePhase);
            }
            if (typeof ctx.refreshGUI === 'function') {
                ctx.refreshGUI();
            }
            this.showToast('Imported Time of Day settings successfully');
            return true;
        } else {
            alert('Could not recognize Time of Day JSON format.');
            return false;
        }
    }
}
