import * as THREE from 'three';
import { PostProcessing } from 'three/webgpu';
import { pass, vec2, vec3, vec4, mix, smoothstep, max, clamp, dot, float, uv, uniform, Loop, length, min, Fn, screenCoordinate, fract, sin, toneMapping } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { LOW_GFX } from '../config/constants.js';
import { tierSettings } from './DeviceTier.js';
import { renderer, scene, camera } from './Engine.js';

export let postProcessing;
export let scenePass;
let bloomNode = null;

export const uBloomStrength = uniform(0.8);
export const uBloomRadius = uniform(0.4);
export const uBloomThreshold = uniform(1.5);
export let isBloomOn = false;  // MUST match main.js isBloomOn; bloom-on blew out the sun

export function initPostProcessing() {
    postProcessing = new PostProcessing(renderer);
    // MATCH flight-merged (WebGL): its EffectComposer chain ends in a raw ShaderPass with no
    // <tonemapping_fragment> / <colorspace_fragment>, so the scene's linear HDR values land on
    // the canvas untransformed. Letting WebGPU apply ACES + sRGB here is what washed the sky
    // from a rich #4280c8 out to a near-white #d7e7f0.
    postProcessing.outputColorTransform = false;
    scenePass = pass(scene, camera);
    const sceneColor = scenePass.getTextureNode('output');
    bloomNode = bloom(sceneColor, uBloomStrength, uBloomRadius, uBloomThreshold);
    updatePostProcessingPipeline();
}

// -- Volumetric God Rays Settings (matched to flight-merged) --
// Note: flight-merged's ShaderPass samples the *bloomed* previous pass; a TSL Fn can only sample a
// texture, so this samples the raw scene pass. Rays are therefore marginally crisper than WebGL's.
export const uSunScreenPos = uniform(vec2(0.5, 0.5));
export const uIntensity = uniform(0.60);
export const uDecay = uniform(0.92);
export const uDensity = uniform(0.50);
export const uWeight = uniform(0.80);
export const uLumMin = uniform(0.80);
export const uLumMax = uniform(0.98);
export const uDitherStrength = uniform(1.0);
export const uEdgeFadeDist = uniform(1.5);
export const uSunVisible = uniform(1.0);
export const uRayColorInner = uniform(new THREE.Color(1.0, 0.92, 0.65));
export const uRayColorOuter = uniform(new THREE.Color(1.0, 0.60, 0.20));
export const uHaloRadius = uniform(0.2);
export const uHaloStrength = uniform(0.0);  // flight-merged has NO halo term; 0.25 here lifted every
                                            // sample near the sun over the 0.45 luminance gate and
                                            // blew a solid white ellipse across the middle of the screen
export let isGodRaysEnabled = !LOW_GFX;

// The ray loop does one dependent texture read per iteration, per pixel. At 4K that is
// pixels x samples fetches every frame -- 32 samples on a 3840x2160 buffer is 265 MILLION.
// Sample count is the direct multiplier, so it is the first thing to scale by device.
// uDensity is compensated below so the rays keep the same length at every sample count.
const GOD_RAY_SAMPLES = LOW_GFX ? 8 : tierSettings.godRaySamples;
uDensity.value = 0.50 * (32 / GOD_RAY_SAMPLES);   // same total ray reach, fewer taps

// Whether the sun is actually on screen. Multiplying the result by a uniform would NOT
// save anything -- the sample loop still executes. To genuinely skip the work the node has
// to leave the graph, so this flips a flag and rebuilds the pipeline. That costs a shader
// recompile, but it only happens when the sun crosses the horizon, not per frame.
let _sunOnScreen = true;

export function setGodRaySunVisible(visible) {
    const v = !!visible;
    if (_sunOnScreen === v) return;      // rebuild ONLY on transition
    _sunOnScreen = v;
    updatePostProcessingPipeline();
}

export function getGodRaySunVisible() { return _sunOnScreen; }

const pseudoRand = (p) => {
    return fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453123));
};

const buildGodRaysNode = Fn(([baseTex]) => {
    const vUv = uv();

    const deltaUV = vUv.sub(uSunScreenPos).toVar();
    const dist = length(deltaUV);
    deltaUV.mulAssign(float(1.0 / 32.0).mul(uDensity));

    const dither = pseudoRand(screenCoordinate.xy).mul(uDitherStrength);
    const sampleUV = vUv.sub(deltaUV.mul(dither)).toVar();

    const illumination = float(0.0).toVar();
    const currentWeight = float(uWeight).toVar();

    Loop({ start: 0, end: GOD_RAY_SAMPLES }, () => {
        sampleUV.subAssign(deltaUV);
        const samp = scenePass.getTextureNode().sample(clamp(sampleUV, vec2(0.001), vec2(0.999)));
        const lum = dot(samp.rgb, vec3(0.299, 0.587, 0.114));

        const sampleDistToSun = length(sampleUV.sub(uSunScreenPos));
        const halo = smoothstep(uHaloRadius, float(0.0), sampleDistToSun).mul(uHaloStrength);
        const bright = smoothstep(uLumMin, uLumMax, lum.add(halo));

        illumination.addAssign(bright.mul(currentWeight));
        currentWeight.mulAssign(uDecay);
    });

    const edgeFade = float(1.0).sub(smoothstep(float(0.4), uEdgeFadeDist, dist));
    const rayTint = mix(uRayColorInner, uRayColorOuter, smoothstep(0.0, uEdgeFadeDist.mul(0.7), dist));
    const rayColor = rayTint.mul(illumination).mul(uIntensity).mul(edgeFade).mul(uSunVisible);

    return vec4(baseTex.rgb.add(rayColor), baseTex.a);
});

// -- Ghibli Summer Filter (100% matched to WebGL) --
export let isSummerFilterOn = false;

const getLuminance = (col) => dot(col, vec3(0.299, 0.587, 0.114));

const buildGhibliSummerNode = Fn(([baseTex]) => {
    const col = baseTex.rgb;
    const lum = getLuminance(col);

    const warmGold = col.mul(vec3(1.07, 1.02, 0.92));
    const azureShadow = col.mul(vec3(0.93, 0.98, 1.07));
    let finalCol = mix(azureShadow, warmGold, smoothstep(0.2, 0.75, lum));

    finalCol = mix(vec3(lum), finalCol, 1.18);
    finalCol = finalCol.add(max(vec3(0.0), finalCol.sub(0.55)).mul(vec3(0.12, 0.09, 0.02)));

    const vUv = uv();
    const centeredUv = vUv.sub(0.5).mul(2.0);
    const vign = clamp(float(1.0).sub(dot(centeredUv, centeredUv).mul(0.14)), 0.0, 1.0);
    finalCol = finalCol.mul(vign);

    return vec4(finalCol, baseTex.a);
});

export const uToneExposure = uniform(1.8);

// ---------------------------------------------------------------------------------------
// PER-PHASE EXPOSURE
// ---------------------------------------------------------------------------------------
// outputColorTransform = false above means renderer.toneMapping / toneMappingExposure are
// INERT -- nothing tone-maps, and buildSoftClipNode's knee at 0.75 is the only ceiling.
// Dusk was hand-tuned to sit just under that knee, which is why dusk looks right: its light
// is saturated orange (#ffaa00), so the blue channel never reaches the ceiling and hue
// survives. Day sends near-white light (#fffaeb) at similar intensity, so red, green AND
// blue cross the knee together and everything above it collapses to the same white -- the
// washed-out haze.
//
// The fix is a single multiply applied immediately before the soft clip. Dusk's value is
// EXACTLY 1.0, so dusk multiplies by one and is provably unchanged. Only day and night move.
export const uPhaseExposure = uniform(1.0);

// rgb only -- scaling alpha too would be wrong on a pass that carries it through.
const buildPhaseExposureNode = Fn(([baseTex]) => {
    return vec4(baseTex.rgb.mul(uPhaseExposure), baseTex.a);
});

// -- Soft highlight rolloff --
// With outputColorTransform = false there is NO tonemapping, so any channel above 1.0 hard-clips
// to pure white. That is what turned the procedural sky dome horizon into a full-width white band.
// Full ACES fixes the clipping but desaturates the sky (the original washout problem), so instead
// this leaves everything below the knee completely untouched -- preserving the rich orange -- and
// only Reinhard-rolls the excess above it.
export const uRolloffKnee = uniform(0.75);
const buildSoftClipNode = Fn(([baseTex]) => {
    const col = baseTex.rgb;
    const knee = uRolloffKnee;
    const range = float(1.0).sub(knee);           // headroom left above the knee
    const over = max(col.sub(knee), vec3(0.0));   // how far each channel overshoots
    // Reinhard scaled into that headroom so the result asymptotes to exactly 1.0 and never clips.
    const rolled = over.mul(range).div(over.add(range));
    return vec4(min(col, vec3(knee)).add(rolled), baseTex.a);
});

// -- Output dither (anti-banding) --
//
// The dark-sky banding has a specific cause. `outputColorTransform = false` above means the
// scene's LINEAR values land on an 8-bit canvas with no sRGB encode. sRGB encoding is what
// normally gives dark tones most of the available code values; without it, a night sky
// spanning linear 0.02 to 0.08 gets roughly 15 distinct 8-bit values spread across the whole
// screen, and every boundary between them is a visible band.
//
// We cannot add the sRGB encode back -- that is the transform dusk was tuned against. So
// instead we dither: add sub-LSB noise before quantisation so the hard step boundaries are
// broken into noise the eye integrates back into a smooth gradient.
//
// TPDF (triangular) rather than uniform noise: the sum of two independent uniform samples is
// triangular, and TPDF is the distribution that fully decorrelates quantisation error from
// the signal. Uniform noise only reduces banding; TPDF actually removes it.
//
// Static, not animated -- at 1/255 amplitude a fixed screen-space pattern is invisible,
// whereas animated noise reads as shimmer on a still camera.
export const uDitherAmount = uniform(1.0);   // in 1/255 units

const buildDitherNode = Fn(([baseTex]) => {
    const p = screenCoordinate.xy;
    // Interleaved gradient noise -- better spatial distribution than a sin-hash and just as cheap.
    const d1 = fract(float(52.9829189).mul(fract(dot(p, vec2(0.06711056, 0.00583715)))));
    const d2 = fract(float(52.9829189).mul(fract(dot(p.yx, vec2(0.06711056, 0.00583715)).add(0.5))));
    const tri = d1.add(d2).sub(1.0);          // triangular in [-1, 1]
    return vec4(baseTex.rgb.add(tri.mul(uDitherAmount).div(255.0)), baseTex.a);
});

// Main post processing graph setup
export function updatePostProcessingPipeline() {
    if (!postProcessing || !scenePass) return;
    const sceneColor = scenePass.getTextureNode('output');
    let outputNode = sceneColor;

    if (isBloomOn) {
        if (!bloomNode) {
            bloomNode = bloom(sceneColor, uBloomStrength, uBloomRadius, uBloomThreshold);
        }
        outputNode = outputNode.add(bloomNode);
    }

    // Skipped entirely when the sun is off screen -- the 32-iteration loop is the single
    // most expensive thing in the frame and it finds nothing when the sun is below the horizon.
    if (isGodRaysEnabled && _sunOnScreen) {
        outputNode = buildGodRaysNode(outputNode);
    }

    if (isSummerFilterOn) {
        outputNode = buildGhibliSummerNode(outputNode);
    }

    // Per-phase exposure, applied BEFORE the roll-off so day is pulled back under the knee
    // instead of being flattened by it. Neutral (1.0) at dusk.
    outputNode = buildPhaseExposureNode(outputNode);

    // Everything above has been additive and can exceed 1.0.
    outputNode = buildSoftClipNode(outputNode);

    // Truly last: dither must be the final operation before the framebuffer, otherwise a
    // later pass re-quantises and undoes it.
    outputNode = buildDitherNode(outputNode);

    postProcessing.outputNode = outputNode;
    postProcessing.needsUpdate = true;
}

export const bloomPass = {
    get enabled() {
        return isBloomOn;
    },
    set enabled(v) {
        if (isBloomOn !== v) {
            isBloomOn = v;
            updatePostProcessingPipeline();
        }
    },
    get strength() {
        return uBloomStrength.value;
    },
    set strength(v) {
        uBloomStrength.value = v;
    },
    get radius() {
        return uBloomRadius.value;
    },
    set radius(v) {
        uBloomRadius.value = v;
    },
    get threshold() {
        return uBloomThreshold.value;
    },
    set threshold(v) {
        uBloomThreshold.value = v;
    }
};

export const godRaysPass = {
    enabled: !LOW_GFX,
    uniforms: {
        uSunScreenPos: uSunScreenPos,
        uIntensity: uIntensity,
        uDecay: uDecay,
        uDensity: uDensity,
        uWeight: uWeight,
        uLumMin: uLumMin,
        uLumMax: uLumMax,
        uDitherStrength: uDitherStrength,
        uEdgeFadeDist: uEdgeFadeDist,
        uSunVisible: uSunVisible,
        uRayColorInner: uRayColorInner,
        uRayColorOuter: uRayColorOuter,
        uHaloRadius: uHaloRadius,
        uHaloStrength: uHaloStrength
    }
};

Object.defineProperty(godRaysPass, 'enabled', {
    get: () => isGodRaysEnabled,
    set: (v) => { isGodRaysEnabled = v; updatePostProcessingPipeline(); }
});

export function initPostProcessingUI() {
    const summerBtn = document.getElementById('summer-toggle');
    if (summerBtn) {
        summerBtn.addEventListener('click', () => {
            isSummerFilterOn = !isSummerFilterOn;
            updatePostProcessingPipeline();
            if (typeof window.params !== 'undefined') window.params.summerFilter = isSummerFilterOn;
        });
    }
}
