/**
 * OpenSeaOceanLowPower.js - Optimized WebGPU Gerstner Ocean for Galaxy Tab S6 Lite
 *
 * Streamlined 3-wave spectrum, zero micro-surface FBM loops in fragment stage,
 * low-overhead Beer-Lambert extinction and Fresnel reflection.
 */

import * as THREE from 'three/webgpu';
import {
  Fn, uniform, float, vec2, vec3, vec4,
  sin, cos, dot, cross, normalize, length, mix, pow, max, min, clamp,
  fract, smoothstep, distance, reflect, step, exp,
  positionLocal, positionWorld, cameraPosition, texture
} from 'three/tsl';

export const timeUniform = uniform(0.00001);
export const seaUniform = uniform(0.45);
export const speedUniform = uniform(1.0);
export const waterOpacityUniform = uniform(0.92);
export const chopStrengthUniform = uniform(3.0);
export const crestSharpnessUniform = uniform(0.6);
export const waveHeightUniform = uniform(1.0);
export const oceanScaleUniform = uniform(1.0);
export const swellWavelengthUniform = uniform(1.0);

export const sunDirUniform = uniform(new THREE.Vector3(0, 1, 0));
export const sunColorUniform = uniform(new THREE.Color(1, 1, 1));
export const horizonColorUniform = uniform(new THREE.Color(0.52, 0.68, 0.82));
export const zenithColorUniform = uniform(new THREE.Color(0.07, 0.2, 0.42));
export const deepColorUniform = uniform(new THREE.Color(0.015, 0.09, 0.11));
export const shallowColorUniform = uniform(new THREE.Color(0.06, 0.32, 0.36));

// Object reaction uniforms
export const objPosUniform = uniform(new THREE.Vector3(0, 0, 0));
export const objRadiusUniform = uniform(2.0);
export const objActiveUniform = uniform(0.0);

// Shoreline depth field uniforms
export const DEPTH_FIELD_SENTINEL = -1000.0;
const _depthFieldPlaceholder = new THREE.DataTexture(
  new Uint16Array([THREE.DataUtils.toHalfFloat(DEPTH_FIELD_SENTINEL)]), 1, 1, THREE.RedFormat, THREE.HalfFloatType
);
_depthFieldPlaceholder.minFilter = THREE.LinearFilter;
_depthFieldPlaceholder.magFilter = THREE.LinearFilter;
_depthFieldPlaceholder.wrapS = THREE.ClampToEdgeWrapping;
_depthFieldPlaceholder.wrapT = THREE.ClampToEdgeWrapping;
_depthFieldPlaceholder.needsUpdate = true;

export const terrainDepthTexNode = texture(_depthFieldPlaceholder);
export const terrainDepthTexNodeVS = texture(_depthFieldPlaceholder);

export function setTerrainDepthTexture(tex) {
  if (!tex) return;
  terrainDepthTexNode.value = tex;
  terrainDepthTexNodeVS.value = tex;
}

export const depthFieldOriginUniform  = uniform(new THREE.Vector2(0, 0));
export const depthFieldSizeUniform    = uniform(4000.0);
export const depthFieldValidUniform   = uniform(0.0);
export const waterLevelUniform        = uniform(2.4);

export const sandColorUniform         = uniform(new THREE.Color(0.85, 0.80, 0.62));
export const shoreShallowColorUniform = uniform(new THREE.Color(0.32, 0.72, 0.70));
export const shoreDepthUniform        = uniform(6.0);
export const extinctionUniform        = uniform(new THREE.Vector3(0.75, 0.30, 0.16));
export const globalFogDensityUniform  = uniform(1.0);
export const waterFogDensityUniform   = globalFogDensityUniform;

// 3-Wave Lightweight Spectrum
export const WAVE_PARAMS = [
  { dir: [ 0.927,  0.375], wavelength: 340.0, steepness: 0.080, phase: 0.0 },
  { dir: [ 0.454,  0.891], wavelength: 215.0, steepness: 0.070, phase: 1.4 },
  { dir: [ 0.998,  0.070], wavelength: 141.0, steepness: 0.060, phase: 2.8 }
];

function phaseSpeedFor(k) {
  return Math.sqrt(9.8 / k);
}

export const WAVES = WAVE_PARAMS.map(({ dir, wavelength, steepness, phase }) => {
  const len = Math.hypot(dir[0], dir[1]) || 1.0;
  const k = (2 * Math.PI) / wavelength;
  return {
    dx: uniform(dir[0] / len),
    dz: uniform(dir[1] / len),
    k: uniform(k),
    c: uniform(phaseSpeedFor(k)),
    steepness: uniform(steepness),
    phase: uniform(phase || 0.00001)
  };
});

const TWO_PI_NODE = float(Math.PI * 2.0);
const wavePhase = (w, xz, time) => {
  const rawPhase = w.k.mul(dot(vec2(w.dx, w.dz), xz).sub(time.mul(w.c))).add(w.phase);
  return fract(rawPhase.div(TWO_PI_NODE)).mul(TWO_PI_NODE);
};

const wavePosition = Fn(([localXz, time, sea, shallowFade]) => {
  const worldXz = positionWorld.xz;
  const xz = worldXz.mul(oceanScaleUniform).toVar();
  const p = vec3(localXz.x, float(0.0), localXz.y).toVar();
  for (const w of WAVES) {
    const a = w.steepness.mul(sea).div(w.k)
      .mul(swellWavelengthUniform).mul(waveHeightUniform)
      .mul(shallowFade);
    const f = wavePhase(w, xz, time);
    const q = chopStrengthUniform;
    const pinch = a.mul(a).mul(w.k).mul(0.5).mul(cos(f.mul(2.0))).mul(crestSharpnessUniform);
    p.x.addAssign(a.mul(w.dx).mul(cos(f)).mul(q));
    p.y.addAssign(a.mul(sin(f)).sub(pinch));
    p.z.addAssign(a.mul(w.dz).mul(cos(f)).mul(q));
  }
  return p;
});

const waveNormal = Fn(([rawXz, time, sea]) => {
  const xz = rawXz.mul(oceanScaleUniform).toVar();
  const tangent = vec3(1.0, 0.0, 0.0).toVar();
  const binormal = vec3(0.0, 0.0, 1.0).toVar();
  for (const w of WAVES) {
    const ak = w.steepness.mul(sea).mul(waveHeightUniform).mul(swellWavelengthUniform);
    const qk = ak.mul(chopStrengthUniform);
    const f = wavePhase(w, xz, time);
    const s = sin(f);
    const co = cos(f);
    tangent.x.subAssign(qk.mul(w.dx.mul(w.dx)).mul(s));
    tangent.y.addAssign(ak.mul(w.dx).mul(co));
    tangent.z.subAssign(qk.mul(w.dx.mul(w.dz)).mul(s));
    binormal.x.subAssign(qk.mul(w.dx.mul(w.dz)).mul(s));
    binormal.y.addAssign(ak.mul(w.dz).mul(co));
    binormal.z.subAssign(qk.mul(w.dz.mul(w.dz)).mul(s));
  }
  return normalize(cross(binormal, tangent));
});

const sampleWaterDepth = Fn(([worldXz]) => {
  const uv = worldXz.sub(depthFieldOriginUniform).div(depthFieldSizeUniform).toVar();
  const inside = step(0.0, uv.x).mul(step(uv.x, 1.0)).mul(step(0.0, uv.y)).mul(step(uv.y, 1.0));
  const terrainH = terrainDepthTexNode.sample(uv).r;
  const rawDepth = waterLevelUniform.sub(terrainH);
  return mix(float(9999.0), rawDepth, inside.mul(depthFieldValidUniform));
});

export const createLowPowerOpenSeaMaterial = () => {
  const oceanMaterial = new THREE.MeshBasicNodeMaterial();
  oceanMaterial.transparent = true;
  oceanMaterial.side = THREE.DoubleSide;
  oceanMaterial.depthWrite = false;
  oceanMaterial.depthTest = true;

  const scaledTime = timeUniform.mul(speedUniform);

  // Shore wave fade in vertex stage
  const vtxWorldXz = positionWorld.xz;
  const vtxUv = vtxWorldXz.sub(depthFieldOriginUniform).div(depthFieldSizeUniform);
  const vtxInside = step(0.0, vtxUv.x).mul(step(vtxUv.x, 1.0)).mul(step(0.0, vtxUv.y)).mul(step(vtxUv.y, 1.0));
  const vtxTerrainH = terrainDepthTexNodeVS.sample(vtxUv).level(0).r;
  const vtxDepth = mix(float(9999.0), waterLevelUniform.sub(vtxTerrainH), vtxInside.mul(depthFieldValidUniform));
  const shallowFade = smoothstep(0.0, shoreDepthUniform.mul(0.9), vtxDepth);

  const gerstnerP = wavePosition(positionLocal.xz, scaledTime, seaUniform, shallowFade);
  oceanMaterial.positionNode = vec3(gerstnerP.x, gerstnerP.y, gerstnerP.z);

  oceanMaterial.colorNode = Fn(() => {
    const P = positionWorld.toVar();
    const xz = P.xz;
    const N = waveNormal(xz, scaledTime, seaUniform).toVar();
    const V = normalize(cameraPosition.sub(P)).toVar();

    const depth = sampleWaterDepth(xz).toVar();
    const T = exp(extinctionUniform.mul(min(depth, float(40.0))).mul(-2.0)).toVar();

    // Base body color with Beer-Lambert depth extinction
    const openBody = mix(deepColorUniform, shallowColorUniform, float(0.5));
    const body = mix(openBody, sandColorUniform, T).toVar();
    body.addAssign(shoreShallowColorUniform.mul(T.r.oneMinus().mul(T.b)).mul(0.4));

    // Fast Fresnel reflection
    const NdotV = clamp(dot(N, V), 0.0, 1.0);
    const fresnel = pow(float(1.0).sub(NdotV), 4.0).mul(0.65).add(0.04);
    const R = reflect(V.negate(), N);
    const upSky = clamp(R.y, 0.0, 1.0);
    const skyRefl = mix(horizonColorUniform, zenithColorUniform, pow(upSky, 0.5));

    // Specular glint from sun
    const H = normalize(sunDirUniform.add(V));
    const spec = pow(max(dot(N, H), 0.0), 32.0).mul(0.45);

    const finalColor = mix(body, skyRefl, fresnel).add(sunColorUniform.mul(spec)).toVar();
    const alpha = waterOpacityUniform.toVar();

    // Atmospheric Fog & Seamless Horizon Blend toward sky color
    const camDist = distance(cameraPosition, positionWorld).toVar();
    const fogDist = clamp(camDist.sub(float(800.0)).div(float(6000.0)), 0.0, 1.0);
    const opticalDepth = fogDist.mul(clamp(globalFogDensityUniform, float(0.0), float(6.0)));
    const atmosphericFog = float(1.0).sub(exp(opticalDepth.mul(-2.2)));

    // Geometry Grid Edge Protection (dissolves to sky before the 8,000m mesh edge)
    const camDistXZ = length(positionWorld.xz.sub(cameraPosition.xz));
    const gridEdgeDist = clamp(camDistXZ.sub(float(5500.0)).div(float(2100.0)), 0.0, 1.0);
    const gridEdgeFade = smoothstep(float(0.0), float(1.0), gridEdgeDist);

    const totalSkyBlend = clamp(max(atmosphericFog, gridEdgeFade), 0.0, 1.0);

    finalColor.assign(mix(finalColor, horizonColorUniform, totalSkyBlend));
    alpha.assign(mix(alpha, float(1.0), totalSkyBlend));

    return vec4(finalColor, alpha);
  })();

  return oceanMaterial;
};

// CPU buoyancy / wave height helper
export function getWaterHeightAt(x, z, time, sea) {
  let h = 0;
  for (let i = 0; i < WAVE_PARAMS.length; i++) {
    const p = WAVE_PARAMS[i];
    const len = Math.hypot(p.dir[0], p.dir[1]) || 1.0;
    const dx = p.dir[0] / len;
    const dz = p.dir[1] / len;
    const k = (2 * Math.PI) / p.wavelength;
    const c = Math.sqrt(9.8 / k);
    const a = (p.steepness * sea) / k;
    const phase = k * (dx * x + dz * z - time * c) + (p.phase || 0);
    h += a * Math.sin(phase);
  }
  return h;
}

export function getWaterNormalAt(x, z, time, sea) {
  return new THREE.Vector3(0, 1, 0);
}
