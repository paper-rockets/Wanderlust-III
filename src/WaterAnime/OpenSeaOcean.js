/**
 * OpenSeaOcean.js — Realtime WebGPU / TSL Gerstner Ocean Simulation
 *
 * Core Three.js TSL wave & FBM micro-surface shader adapted from:
 * "Open Sea — Realtime Ocean" (Kimi AI Prototype)
 * https://qdtipu6rd2myk.ok.kimi.link/?id=2077778000455245824&share_id=19f6b13b-b432-8eb2-8000-0000c67df4cd
 *
 * Enhanced for Wanderlust with:
 * - Dynamic interactive GUI & modal editor controls
 * - Dynamic object ripples & Kelvin V-wake shockwave physics
 * - Realtime CPU wave height/normal buoyancy calculations for player & aircraft
 * - Horizon concealment & biome lighting integration
 */

import * as THREE from 'three/webgpu';
import {
  Fn, If, uniform, float, vec2, vec3, vec4,
  sin, cos, atan, abs, dot, cross, normalize, length, mix, pow, max, min, clamp,
  fract, floor, smoothstep, distance, reflect, step, exp, dFdx, dFdy,
  positionLocal, positionWorld, cameraPosition, texture
} from 'three/tsl';

/* ============================================================
   Uniforms — Shared across ocean TSL nodes and GUI Editor
   ============================================================ */
export const timeUniform = uniform(0.00001);
export const seaUniform = uniform(0.45);
export const speedUniform = uniform(1.0);
export const detailAmountUniform = uniform(1.0);
export const foamAmountUniform = uniform(1.0);
export const waterOpacityUniform = uniform(0.92);
export const foamEnabledUniform = uniform(1.0);
export const chopPatchinessUniform = uniform(1.0);
// Gerstner horizontal displacement (Q). Was hardcoded to 0.35, which put the effective Q*ka at
// ~3% of the value where a crest begins to sharpen -- so the surface was a pure sinusoid, and
// waveNormal shaded it as if Q were 1.0. Now a real uniform, and both paths use it.
// Trochoidal sharpening. Crest pinching is governed by the SUM of Q*a*k over all geometry
// waves; at 1.0 the crest becomes a cusp and beyond that the surface self-intersects.
//
// The per-wave a*k is `steepness * sea`, and the default sea state is 0.45 -- so the authored
// spectrum only sums to 0.126, not the 0.28 the steepness column suggests. Q = 0.75 therefore
// put the surface at 0.095 of a cusp: a pure rolling sinusoid, which is what "soft rounded
// mounds" was. Q = 4.5 lands at 0.567, which is visibly trochoidal with a comfortable margin.
// Measured, not guessed -- see the sweep in the session notes.
export const chopStrengthUniform = uniform(4.5);
// Stokes second-order term. Adds -0.5*k*a^2*cos(2f) to the elevation, which lifts the trough
// and pinches the peak WITHOUT changing wave height or the mean water level.
export const crestSharpnessUniform = uniform(0.8);
export const waveHeightUniform = uniform(1.0);
export const oceanScaleUniform = uniform(1.35);
export const swellWavelengthUniform = uniform(1.0);
export const foamDecayUniform = uniform(1.0);
export const qualityModeUniform = uniform(1.0); // 1.0 = High / Cinematic, 0.0 = Performance (High FPS)
export const distanceLodUniform = uniform(1.0); // 1.0 = Distance LOD active, 0.0 = Off
export const lodDistanceThresholdUniform = uniform(1800.0);

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
export const objRippleStrengthUniform = uniform(1.0);
export const foamSpreadUniform = uniform(0.65);
export const foamOpacityUniform = uniform(1.0);

/* ------------------------------------------------------------------
   Micro-surface / specular filtering
   ------------------------------------------------------------------ */
// How aggressively sub-pixel normal detail is converted into roughness instead of being
// point-sampled. 0 = old behaviour (aliased sparkle), 1 = fully filtered.
export const microRoughnessUniform = uniform(1.0);
export const sparkleUniform        = uniform(1.0);   // specular gain multiplier
export const fresnelRoughUniform   = uniform(1.0);   // roughness suppression of grazing mirror

/* ------------------------------------------------------------------
   Whitecap foam driven by the displacement Jacobian
   ------------------------------------------------------------------ */
// J = det(d(displaced xz)/d(parametric xz)). J == 1 on flat water, falls towards 0 as a crest
// steepens and goes negative where the surface folds. Foam starts below this threshold.
//
// This has to be calibrated against the ACTUAL minimum J the spectrum reaches, or no foam ever
// appears. At the default sea state and Q = 4.5 the surface bottoms out at J ~ 0.49, so 0.66
// puts whitecaps on roughly the steepest 6% of the water -- about right for a moderate sea.
// It is deliberately absolute rather than relative: raise the sea state and more of the ocean
// breaks, which is what should happen.
export const foamJacobianUniform   = uniform(0.66);
export const foamTrailUniform      = uniform(1.0);   // length of the trailing wake behind a break
export const foamStreakUniform     = uniform(1.0);   // anisotropy of the foam texture

/* ------------------------------------------------------------------
   Subsurface scattering / light transmission through a crest
   ------------------------------------------------------------------ */
export const sssColorUniform      = uniform(new THREE.Color(0.10, 0.62, 0.55));
export const sssStrengthUniform   = uniform(1.35);
export const sssPowerUniform      = uniform(4.5);
export const sssDistortionUniform = uniform(0.45);

/* ------------------------------------------------------------------
   Beer-Lambert extinction + Atmospheric Fog & Sky Horizon Perspective
   ------------------------------------------------------------------ */
// Per-metre absorption. Red is extinguished ~5x faster than blue, which is the entire reason
// shallow water reads turquoise and deep water reads blue. Calibrated so that at the default
// 6 m shore depth the bottom has essentially stopped contributing.
export const extinctionUniform        = uniform(new THREE.Vector3(0.75, 0.30, 0.16));
export const bottomBrightnessUniform   = uniform(1.0);
export const inScatterUniform          = uniform(0.55);

// Atmospheric Fog & Sky Horizon Blend Uniforms
export const globalFogDensityUniform   = uniform(1.0);     // Global fog density controlling atmospheric depth in fragment shader
export const waterFogNearUniform       = uniform(800.0);   // Distance (m) where atmospheric fog begins
export const waterFogFarUniform        = uniform(6800.0);  // Distance (m) where water color reaches 100% sky color
export const waterFogDensityUniform    = globalFogDensityUniform; // Backward-compatibility alias
export const waterFogStrengthUniform   = uniform(1.0);     // Overall atmospheric blend strength (0.0 to 1.0)
export const waterGridFadeStartUniform = uniform(5600.0);  // Distance (m) to start geometry grid boundary dissolve
export const waterGridFadeEndUniform   = uniform(7600.0);  // Distance (m) where geometry grid is 100% sky color

// Backward-compatibility aliases
export const fogNearUniform        = waterFogNearUniform;
export const fogFarUniform         = waterFogFarUniform;
export const fogDensityUniform     = globalFogDensityUniform;
export const fogStrengthUniform    = waterFogStrengthUniform;
export const gridFadeStartUniform  = waterGridFadeStartUniform;
export const gridFadeEndUniform    = waterGridFadeEndUniform;
export const aerialStrengthUniform = waterFogStrengthUniform;
export const aerialDistanceUniform = waterFogFarUniform;

/* ============================================================
   Shoreline Depth Field — CPU-baked terrain height texture
   (Phase 1 infrastructure. Populated by WaterAnime/TerrainDepthField.js
    via WaterSystem; consumed by the shore shading in colorNode.)

   Sampling contract for the shore shading pass:
     const fieldUv = positionWorld.xz.sub(depthFieldOriginUniform).div(depthFieldSizeUniform);
     const terrainH = terrainDepthTexNode.sample(fieldUv).r;
     const depth    = waterLevelUniform.sub(terrainH);
   `terrainDepthTexNode` is a stable node created at module load, so the
   graph can never capture null. Its bound DataTexture is swapped in by
   setTerrainDepthTexture() before createOpenSeaMaterial() runs.
   Out of bounds the texture clamps to edge, so also mask on fieldUv
   being inside 0..1 and on depthFieldValidUniform before applying shore FX.
   Until the first bake completes every texel reads DEPTH_FIELD_SENTINEL
   (-1000.0) => "very deep", so all shore effects fall away naturally.
   ============================================================ */

// Sentinel height written into unbaked texels. Anything at/below this is "no data".
export const DEPTH_FIELD_SENTINEL = -1000.0;

// 1x1 placeholder so the TSL graph always has a valid, correctly-formatted
// texture bound. Must match the real field's format/type/filters/wrapping so
// the generated WGSL is identical when the real texture is swapped in.
const _depthFieldPlaceholder = new THREE.DataTexture(
  new Uint16Array([
    THREE.DataUtils.toHalfFloat(DEPTH_FIELD_SENTINEL),
    THREE.DataUtils.toHalfFloat(1.0)
  ]),
  1, 1, THREE.RGFormat, THREE.HalfFloatType
);
_depthFieldPlaceholder.minFilter = THREE.LinearFilter;
_depthFieldPlaceholder.magFilter = THREE.LinearFilter;
_depthFieldPlaceholder.wrapS = THREE.ClampToEdgeWrapping;
_depthFieldPlaceholder.wrapT = THREE.ClampToEdgeWrapping;
_depthFieldPlaceholder.generateMipmaps = false;
_depthFieldPlaceholder.flipY = false;
_depthFieldPlaceholder.unpackAlignment = 1;
_depthFieldPlaceholder.needsUpdate = true;

// Stable texture node. Never reassigned - only its bound texture value changes,
// which THREE.NodeSampledTexture.update() picks up automatically each frame.
export const terrainDepthTexNode = texture(_depthFieldPlaceholder);
// Alias under the name used in WATER_SHORE_PLAN.md; same node object.
export const terrainDepthTexUniform = terrainDepthTexNode;

// Separate node for the VERTEX stage. The vertex shader has no implicit derivatives, so it
// must sample with an explicit LOD; keeping that on its own node avoids forcing the fragment
// path to do the same. Both nodes are rebound together by setTerrainDepthTexture().
export const terrainDepthTexNodeVS = texture(_depthFieldPlaceholder);

/**
 * Binds the baked terrain-height DataTexture to the shared depth-field node.
 * Call this BEFORE createOpenSeaMaterial() so the graph is built against the
 * real texture (a later call still works - the binding is refreshed per frame).
 * @param {THREE.DataTexture} tex
 */
export function setTerrainDepthTexture(tex) {
  if (!tex) return;
  terrainDepthTexNode.value = tex;
  terrainDepthTexNodeVS.value = tex;
}

export const depthFieldOriginUniform  = uniform(new THREE.Vector2(0, 0));
export const depthFieldSizeUniform    = uniform(4000.0);
export const depthFieldValidUniform   = uniform(0.0);   // 0 until the first bake completes
export const waterLevelUniform        = uniform(2.4);   // mirrors openSeaMesh.position.y

export const sandColorUniform         = uniform(new THREE.Color(0.85, 0.80, 0.62));
export const shoreShallowColorUniform = uniform(new THREE.Color(0.32, 0.72, 0.70));
export const shoreDepthUniform        = uniform(6.0);
export const shoreOpacityUniform      = uniform(0.10);
export const shoreFoamWidthUniform    = uniform(2.2);
export const shoreFoamSpeedUniform    = uniform(0.8);
export const shoreFoamStrengthUniform = uniform(1.0);
export const shoreRefractionUniform   = uniform(0.35);

/* ============================================================
   Gerstner Swell — 5 Multi-directional Spectral Components
   ============================================================ */
export let WAVE_PARAMS = [
  // Wide-angle multi-directional swell spectrum with spatial domain warping to prevent parallel 1D washboard striations.
  // The primary, secondary, and cross-swell components cross at wide angles (30°, 70°, -45°, 135°, -120°, 160°)
  // forming natural organic wave groups and diamond/pyramidal peaks.
  { dir: [ 0.866,  0.500], wavelength: 340.0, steepness: 0.095, phase: 0.0 },  // primary swell (~30 deg)
  { dir: [ 0.342,  0.940], wavelength: 215.0, steepness: 0.085, phase: 1.4 },  // secondary cross-swell (~70 deg)
  { dir: [ 0.707, -0.707], wavelength: 141.0, steepness: 0.075, phase: 2.8 },  // tertiary cross-swell (~-45 deg)
  { dir: [-0.707,  0.707], wavelength:  83.0, steepness: 0.060, phase: 4.1 },  // wind wave (~135 deg)
  { dir: [-0.500, -0.866], wavelength:  44.0, steepness: 0.048, phase: 5.5 },  // chop (~-120 deg)
  { dir: [-0.940,  0.342], wavelength:  19.0, steepness: 0.038, phase: 2.1 }   // fine chop (~160 deg)
];

// Vertex spacing of the ocean mesh (16000 / 512). Anything shorter than ~4x this cannot be
// represented in geometry without aliasing.
export const OCEAN_VERTEX_SPACING = 16000.0 / 512.0;   // 31.25 m

const _smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * How much of a wave may be expressed in GEOMETRY.
 * 0 below the Nyquist wavelength, ramping to 1 at 4x the vertex spacing.
 * Waves below the cut still shade (via waveNormal) -- they just stop aliasing the mesh.
 */
export function geometryWeightFor(wavelength) {
  return _smoothstep(2.0 * OCEAN_VERTEX_SPACING, 4.0 * OCEAN_VERTEX_SPACING, wavelength);
}

/**
 * Deep-water phase speed. c = sqrt(g / k), NOT sqrt(g * k).
 *
 * The original code used sqrt(9.8 * k), which is exactly g / c_true -- an INVERTED dispersion
 * relation. It made the 340 m swell travel at 0.62 m/s with a 258 second period, i.e. a still
 * image. This one-line error was the whole of "the water doesn't move".
 */
function phaseSpeedFor(k) {
  return Math.sqrt(9.8 / k);
}

export let WAVES = WAVE_PARAMS.map(({ dir, wavelength, steepness, phase }) => {
  const len = Math.hypot(dir[0], dir[1]) || 1.0;
  const k = (2 * Math.PI) / wavelength;
  const dx = uniform(dir[0] / len);
  const dz = uniform(dir[1] / len);
  return {
    dx,
    dz,
    dir: vec2(dx, dz),
    k: uniform(k),
    c: uniform(phaseSpeedFor(k)),
    steepness: uniform(steepness),
    phase: uniform(phase || 0.00001),
    geo: uniform(geometryWeightFor(wavelength)),
    // The Stokes harmonic has HALF the wavelength, so it needs its own Nyquist gate or the
    // crest-sharpening term would itself alias into the ridges we just removed.
    geo2: uniform(geometryWeightFor(wavelength * 0.5))
  };
});

export function updateWaveUniforms(i) {
  const p = WAVE_PARAMS[i];
  const w = WAVES[i];
  const len = Math.hypot(p.dir[0], p.dir[1]) || 1.0;
  const k = (2 * Math.PI) / p.wavelength;

  w.dx.value = p.dir[0] / len;
  w.dz.value = p.dir[1] / len;
  w.k.value = k;
  w.c.value = phaseSpeedFor(k);
  w.steepness.value = p.steepness;
  w.phase.value = p.phase;
  w.geo.value = geometryWeightFor(p.wavelength);
  w.geo2.value = geometryWeightFor(p.wavelength * 0.5);
}

export function randomizeSeaSpectrum() {
  // Previously produced exactly TWO direction clusters and three sub-Nyquist wavelengths.
  // Now: golden-angle direction spread (never clusters) and a wavelength ladder whose top
  // three entries always stay above the geometry cut.
  const base = Math.random() * Math.PI * 2;
  const ladder = [340, 215, 141, 83, 44, 19];
  for (let i = 0; i < WAVES.length; i++) {
    const angle = base + i * 2.39996323 + (Math.random() - 0.5) * 0.35;  // golden angle
    const wavelength = (ladder[i] !== undefined ? ladder[i] : 19) * (0.88 + Math.random() * 0.24);
    const steepness = 0.10 * Math.pow(0.86, i) * (0.85 + Math.random() * 0.3);

    WAVE_PARAMS[i] = {
      dir: [Math.cos(angle), Math.sin(angle)],
      wavelength: Math.max(wavelength, 8.0),
      steepness: Math.max(steepness, 0.01),
      phase: Math.random() * Math.PI * 2
    };
    updateWaveUniforms(i);
  }
}

export function setWindDirection(angleDeg, spreadPercent = 45) {
  const mainAngleRad = (angleDeg * Math.PI) / 180;
  const spreadFactor = Math.max(0.4, Math.min(1.5, spreadPercent / 100.0));
  // Wide fan angular spread to prevent parallel 1D washboard lines
  const FAN = [0.35, 1.25, -0.95, 2.15, -1.85, 2.75];
  WAVES.forEach((w, i) => {
    const finalAngle = mainAngleRad + (FAN[i % FAN.length] * spreadFactor);
    WAVE_PARAMS[i].dir[0] = Math.cos(finalAngle);
    WAVE_PARAMS[i].dir[1] = Math.sin(finalAngle);
    w.dx.value = Math.cos(finalAngle);
    w.dz.value = Math.sin(finalAngle);
  });
}

// phase: f = k * (dot(direction, xz) - time * c) + phase (wrapped to [0, 2*PI) to avoid precision loss)
const TWO_PI_NODE = float(Math.PI * 2.0);
const INV_TWO_PI_NODE = float(1.0 / (Math.PI * 2.0));
const wavePhase = (w, xz, time) => {
  const rawPhase = w.k.mul(dot(w.dir, xz).sub(time.mul(w.c))).add(w.phase);
  return fract(rawPhase.mul(INV_TWO_PI_NODE)).mul(TWO_PI_NODE);
};

// Macro swell group envelope: modulates wave amplitude over broad 800m - 1500m packets
// In physical oceanography, swell travels in wave groups (packets) modulated by group velocity and beats.
// This naturally breaks up monolithic 1D parallel ridges into organic, irregular ocean wave trains.
const macroWaveEnvelope = Fn(([xz, time]) => {
  // 2D spatial domain warping: dynamically bends linear wave fronts into organic curvi-linear crests
  const warpX = sin(xz.y.mul(0.0012).add(time.mul(0.04))).mul(180.0);
  const warpZ = cos(xz.x.mul(0.0015).sub(time.mul(0.03))).mul(180.0);
  const wx = xz.x.add(warpX);
  const wz = xz.y.add(warpZ);

  // Multi-frequency harmonic envelope packets (up to ±65% amplitude modulation)
  const s1 = sin(wx.mul(0.0014).add(wz.mul(0.0009)).sub(time.mul(0.07)));
  const c1 = cos(wx.mul(0.0008).sub(wz.mul(0.0016)).add(time.mul(0.04)));
  const s2 = sin(wx.mul(0.0031).sub(wz.mul(0.0022)).add(time.mul(0.11)));

  const mod = s1.mul(c1).mul(0.45).add(s2.mul(0.20)).mul(chopPatchinessUniform);
  return max(float(0.05), float(1.0).add(mod));
});

// displaced surface point for a given parametric xz (sampled in world space for true physical waves)
const wavePosition = Fn(([localXz, time, sea, shallowFade]) => {
  const worldXz = positionWorld.xz;
  const xz = worldXz.mul(oceanScaleUniform).toVar();
  const env = macroWaveEnvelope(xz, time);
  const p = vec3(localXz.x, float(0.0), localXz.y).toVar();
  const q = chopStrengthUniform;
  // Waves 4 and 5 have geo = 0 (normals only), so only loop over geometry waves 0..3
  for (let i = 0; i < 4; i++) {
    const w = WAVES[i];
    const a = w.steepness.mul(sea).div(w.k)
      .mul(swellWavelengthUniform).mul(waveHeightUniform)
      .mul(w.geo).mul(shallowFade).mul(env);
    const f = wavePhase(w, xz, time);
    const sf = sin(f);
    const cf = cos(f);
    // Stokes 2nd order: cos(2f) = 2*cos^2(f) - 1 via trig identity (avoids transcendental cos call)
    const cos2f = cf.mul(cf).mul(2.0).sub(1.0);
    const pinch = a.mul(a).mul(w.k).mul(0.5).mul(cos2f)
      .mul(crestSharpnessUniform).mul(w.geo2);
    p.x.addAssign(a.mul(w.dx).mul(cf).mul(q));
    p.y.addAssign(a.mul(sf).sub(pinch));
    p.z.addAssign(a.mul(w.dz).mul(cf).mul(q));
  }
  return p;
});

// Outward circular wave ripples and Kelvin V-wake shockwaves produced by object interaction
const objectRippleDisplacement = Fn(([xz, time, objPos, objRadius, objActive, rippleStr]) => {
  const d = xz.sub(objPos.xz);
  const dist = distance(xz, objPos.xz);
  const r = max(dist.sub(objRadius.mul(0.8)), 0.0);
  const fade = smoothstep(16.0, 0.0, r).mul(smoothstep(0.0, 0.3, r));

  const wave1 = sin(dist.mul(2.2).sub(time.mul(3.6)));
  const wave2 = sin(dist.mul(4.8).sub(time.mul(5.2))).mul(0.35);
  const radialPattern = wave1.add(wave2).mul(0.18);

  const vAngle = abs(atan(d.x, d.y));
  const vWakeMask = smoothstep(0.85, 0.25, vAngle).mul(smoothstep(18.0, 0.5, dist));
  const vWakePattern = sin(dist.mul(1.8).sub(time.mul(4.2))).mul(0.26).mul(vWakeMask);

  return radialPattern.add(vWakePattern).mul(fade).mul(objActive).mul(rippleStr);
});

/**
 * Unified wave surface evaluation: computes waveNormal and waveSurface in a single loop pass.
 * Reuses wavePhase, sin(f), cos(f), and horizontal derivatives, avoiding duplicate wave loops.
 */
const waveNormalAndSurface = (rawXz, time, seaUniformVal, openWater, shallowFadeF, sharpness) => {
  const xz = rawXz.mul(oceanScaleUniform).toVar();
  const env = macroWaveEnvelope(xz, time);
  const tangent = vec3(1.0, 0.0, 0.0).toVar();
  const binormal = vec3(0.0, 0.0, 1.0).toVar();
  const lostVar = float(0.0).toVar();

  const h = float(0.0).toVar();
  const jxx = float(0.0).toVar();
  const jzz = float(0.0).toVar();
  const jxz = float(0.0).toVar();
  const offX = float(0.0).toVar();
  const offZ = float(0.0).toVar();

  const seaNormal = seaUniformVal.mul(openWater);
  const qChop = chopStrengthUniform;

  for (let i = 0; i < WAVES.length; i++) {
    const w = WAVES[i];
    const f = wavePhase(w, xz, time);
    const sf = sin(f);
    const cf = cos(f);

    // --- Normal accumulation (all 6 waves) ---
    const shortFade = mix(sharpness, float(1.0), w.geo);
    const akFull = w.steepness.mul(seaNormal).mul(waveHeightUniform).mul(swellWavelengthUniform).mul(env);
    const ak = akFull.mul(shortFade);
    const qk = ak.mul(qChop);

    const lost = akFull.sub(ak);
    lostVar.addAssign(lost.mul(lost).mul(0.5));

    const dx_s = w.dx.mul(sf);
    const dz_s = w.dz.mul(sf);
    const qk_dx_s = qk.mul(dx_s);
    const qk_dz_s = qk.mul(dz_s);

    tangent.x.subAssign(qk_dx_s.mul(w.dx));
    tangent.y.addAssign(ak.mul(w.dx).mul(cf));
    tangent.z.subAssign(qk_dx_s.mul(w.dz));

    binormal.x.subAssign(qk_dz_s.mul(w.dx));
    binormal.y.addAssign(ak.mul(w.dz).mul(cf));
    binormal.z.subAssign(qk_dz_s.mul(w.dz));

    // --- Surface displacement & Jacobian (only for geometry waves 0..3) ---
    if (i < 4) {
      const a = w.steepness.mul(seaUniformVal).div(w.k)
        .mul(swellWavelengthUniform).mul(waveHeightUniform)
        .mul(w.geo).mul(shallowFadeF).mul(env);
      const cos2f = cf.mul(cf).mul(2.0).sub(1.0);
      const pinch = a.mul(a).mul(w.k).mul(0.5).mul(cos2f)
        .mul(crestSharpnessUniform).mul(w.geo2);
      h.addAssign(a.mul(sf).sub(pinch));

      const g = a.mul(w.k).mul(qChop);
      jxx.addAssign(g.mul(w.dx).mul(dx_s));
      jzz.addAssign(g.mul(w.dz).mul(dz_s));
      jxz.addAssign(g.mul(w.dx).mul(dz_s));

      const ha = a.mul(cf).mul(qChop);
      offX.addAssign(ha.mul(w.dx));
      offZ.addAssign(ha.mul(w.dz));
    }
  }

  const normal = normalize(cross(binormal, tangent));
  const J = float(1.0).sub(jxx).mul(float(1.0).sub(jzz)).sub(jxz.mul(jxz));

  return {
    normal,
    lostVar,
    crest: h,
    jacobian: J,
    orbit: vec2(offX, offZ)
  };
};

/**
 * Jacobian only, for the lagged samples that produce foam TRAILS.
 * Evaluates only geometry-carrying waves 0..3 (waves 4 & 5 have geo = 0).
 */
const waveJacobianAt = Fn(([rawXz, time, sea, shallowFade]) => {
  const xz = rawXz.mul(oceanScaleUniform).toVar();
  const env = macroWaveEnvelope(xz, time);
  const jxx = float(0.0).toVar();
  const jzz = float(0.0).toVar();
  const jxz = float(0.0).toVar();
  for (let i = 0; i < 4; i++) {
    const w = WAVES[i];
    const a = w.steepness.mul(sea).div(w.k)
      .mul(swellWavelengthUniform).mul(waveHeightUniform)
      .mul(w.geo).mul(shallowFade).mul(env);
    const sf = sin(wavePhase(w, xz, time));
    const g = a.mul(w.k).mul(chopStrengthUniform);
    jxx.addAssign(g.mul(w.dx).mul(w.dx).mul(sf));
    jzz.addAssign(g.mul(w.dz).mul(w.dz).mul(sf));
    jxz.addAssign(g.mul(w.dx).mul(w.dz).mul(sf));
  }
  return float(1.0).sub(jxx).mul(float(1.0).sub(jzz)).sub(jxz.mul(jxz));
});

/* ============================================================
   Procedural gradient noise + 3-octave FBM
   ============================================================ */
const hash2 = Fn(([p]) => {
  const pMod = fract(p.div(256.0)).mul(256.0);
  const h = vec2(
    dot(pMod, vec2(127.1, 311.7)),
    dot(pMod, vec2(269.5, 183.3))
  );
  return fract(sin(h).mul(43758.5453)).mul(2.0).sub(1.0);
});

const gradNoise = Fn(([p]) => {
  const i = floor(p);
  const f = fract(p);
  const u = f.mul(f).mul(f.mul(f.mul(6.0).sub(15.0)).add(10.0));
  const n00 = dot(hash2(i), f);
  const n10 = dot(hash2(i.add(vec2(1.0, 0.0))), f.sub(vec2(1.0, 0.0)));
  const n01 = dot(hash2(i.add(vec2(0.0, 1.0))), f.sub(vec2(0.0, 1.0)));
  const n11 = dot(hash2(i.add(vec2(1.0, 1.0))), f.sub(vec2(1.0, 1.0)));
  return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
});

const fbm = Fn(([p]) =>
  gradNoise(p)
    .add(gradNoise(p.mul(2.04).add(vec2(17.3, 9.1))).mul(0.5))
    .add(gradNoise(p.mul(4.11).add(vec2(42.7, 28.6))).mul(0.25))
);

/* ------------------------------------------------------------------
   Band-limited FBM
   ------------------------------------------------------------------
   The unfiltered fbm above is point-sampled. Its finest octave is ~0.12 m across; a pixel
   covers that much water by roughly 120 m out, and everything beyond is therefore white noise
   evaluated once per pixel. That is the "severe specular grain and pixel sparkle": the noise
   itself is not what glitters, but it perturbs the normal randomly per pixel and a narrow
   specular lobe turns random normals into isolated blown-out pixels.

   The fix is the standard one: fade each octave out as it approaches the pixel footprint, and
   book-keep the slope variance that was removed so the shading pass can widen the specular
   lobe by exactly that amount (Toksvig / LEAN in spirit — normal detail becomes roughness,
   rather than disappearing or aliasing).
   ------------------------------------------------------------------ */

// 1 while the feature is larger than a pixel, 0 once it is sub-pixel. Deliberately tuned to
// hold on until roughly the Nyquist limit rather than fading a full octave early -- fading
// early costs visible surface texture, and the residual is caught by the roughness term.
const octaveWeight = Fn(([lambdaM, fp]) =>
  clamp(lambdaM.div(max(fp, float(0.0001))).sub(0.8), 0.0, 1.0)
);

// lambda0 = world size, in metres, of one unit of `p`.
const fbmBL = Fn(([p, lambda0, fp]) => {
  const w0 = octaveWeight(lambda0, fp);
  const val = float(0.0).toVar();
  If(w0.greaterThan(0.0), () => {
    val.addAssign(gradNoise(p).mul(w0));
    const w1 = octaveWeight(lambda0.mul(0.490196), fp);
    If(w1.greaterThan(0.0), () => {
      val.addAssign(gradNoise(p.mul(2.04).add(vec2(17.3, 9.1))).mul(0.5).mul(w1));
      const w2 = octaveWeight(lambda0.mul(0.243309), fp);
      If(w2.greaterThan(0.0), () => {
        val.addAssign(gradNoise(p.mul(4.11).add(vec2(42.7, 28.6))).mul(0.25).mul(w2));
      });
    });
  });
  return val;
});

// Slope variance discarded by fbmBL, per unit amplitude. Octave i has amplitude 0.5^i and
// wavenumber 2.04^i / lambda0, so its slope amplitude is (1.02^i / lambda0); variance is half
// the square of that. Returned normalised by lambda0 so callers can scale by their amplitude.
const fbmLostVariance = Fn(([lambda0, fp]) => {
  const s0 = float(1.0).div(lambda0);
  const s1 = float(1.02).div(lambda0);
  const s2 = float(1.0404).div(lambda0);
  return s0.mul(s0).mul(octaveWeight(lambda0, fp).oneMinus())
    .add(s1.mul(s1).mul(octaveWeight(lambda0.div(2.04), fp).oneMinus()))
    .add(s2.mul(s2).mul(octaveWeight(lambda0.div(4.11), fp).oneMinus()))
    .mul(0.5);
});

/**
 * Animated capillary-scale detail height field.
 *
 * `orbit` is the horizontal Gerstner orbital offset at this point. Feeding it into the sample
 * position makes the micro-detail ride the swell — bunching on the face of a crest and
 * stretching in the trough — instead of the pure UV scroll it used to be, which read as a
 * texture sliding across a static surface.
 */
const detailHeight = Fn(([xz, time, fp, orbit]) => {
  const driftA = vec2(time.mul(0.55), time.mul(0.32));
  const driftB = vec2(time.mul(-0.4), time.mul(0.5));
  const driftC = vec2(time.mul(0.9), time.mul(-0.7));
  const advected = xz.sub(orbit.mul(0.6));
  return fbmBL(advected.mul(0.85).add(driftA), float(1.176), fp)
    .add(fbmBL(advected.mul(2.1).add(driftB), float(0.476), fp).mul(0.45))
    // Capillary scale, ~22 cm. Only affordable BECAUSE the band limiting above removes it
    // cleanly the moment it goes sub-pixel; point-sampled it would be pure grain.
    .add(fbmBL(advected.mul(4.6).add(driftC), float(0.217), fp).mul(0.22));
});

// Matching lost-variance for detailHeight. The frequency of each term is already carried by its
// lambda0, so the only extra factor is the term's own weight, squared.
const detailLostVariance = Fn(([fp]) =>
  fbmLostVariance(float(1.176), fp)
    .add(fbmLostVariance(float(0.476), fp).mul(0.45 * 0.45))
    .add(fbmLostVariance(float(0.217), fp).mul(0.22 * 0.22))
);

const skyColor = Fn(([rawDir]) => {
  const dir = rawDir.toVar();
  const up = clamp(dir.y, -0.15, 1.0);
  const sky = mix(horizonColorUniform, zenithColorUniform, pow(max(up, 0.0), 0.42)).toVar();

  const hazeColor = deepColorUniform.mul(1.4).add(horizonColorUniform.mul(0.25));
  sky.assign(mix(sky, hazeColor, smoothstep(-0.15, 0.0, dir.y).oneMinus()));

  // Smooth, anti-aliased solar bloom for reflections (specular highlight handles the sun glint)
  const s = max(dot(dir, sunDirUniform), 0.0);
  sky.addAssign(sunColorUniform.mul(pow(s, 22.0)).mul(0.2));
  sky.addAssign(sunColorUniform.mul(pow(s, 64.0)).mul(0.35));

  return sky;
});

/* ============================================================
   Shore depth sampling  (Phase 2a — was specified and never written)
   ============================================================ */

/**
 * Water depth in metres at a world XZ, from the CPU-baked terrain height field.
 * Returns a large positive number ("very deep") whenever the field is unavailable, so every
 * shore effect degrades to open ocean rather than popping.
 */
const sampleTerrainField = Fn(([worldXz]) => {
  const uv = worldXz.sub(depthFieldOriginUniform).div(depthFieldSizeUniform).toVar();
  const clampedUv = clamp(uv, vec2(0.001, 0.001), vec2(0.999, 0.999)).toVar();
  const borderDistX = min(uv.x, float(1.0).sub(uv.x));
  const borderDistY = min(uv.y, float(1.0).sub(uv.y));
  const borderDist = min(borderDistX, borderDistY);
  const borderMask = smoothstep(float(0.0), float(0.04), borderDist);

  const fieldSample = terrainDepthTexNode.sample(clampedUv);
  const terrainH = fieldSample.r;
  const openWaterRaw = fieldSample.g;
  const rawDepth = waterLevelUniform.sub(terrainH);
  const effectiveDepth = mix(float(60.0), rawDepth, borderMask.mul(depthFieldValidUniform));
  const effectiveOpenWater = mix(float(1.0), openWaterRaw, borderMask.mul(depthFieldValidUniform));
  return vec2(max(effectiveDepth, float(0.0)), effectiveOpenWater);
});

const sampleWaterDepth = Fn(([worldXz]) => sampleTerrainField(worldXz).x);

/* ============================================================
   Create Open Sea NodeMaterial
   ============================================================ */
export const createOpenSeaMaterial = () => {
  const oceanMaterial = new THREE.MeshBasicNodeMaterial();
  oceanMaterial.transparent = true;
  oceanMaterial.side = THREE.FrontSide;
  oceanMaterial.depthWrite = false;
  oceanMaterial.depthTest = true;

  const scaledTime = timeUniform.mul(speedUniform);

  // Waves must die as the water shallows out, or the surface swings several metres up and down
  // through the beach face every cycle (the swinging waterline in WATER_DIAGNOSIS.md 3.7).
  // In landlocked inland lakes, openWater is 0 so Gerstner waves are completely eliminated.
  const vtxWorldXz = positionWorld.xz;
  const vtxUv = vtxWorldXz.sub(depthFieldOriginUniform).div(depthFieldSizeUniform);
  const vtxClampedUv = clamp(vtxUv, vec2(0.001, 0.001), vec2(0.999, 0.999));
  const vtxBorderDist = min(min(vtxUv.x, float(1.0).sub(vtxUv.x)), min(vtxUv.y, float(1.0).sub(vtxUv.y)));
  const vtxBorderMask = smoothstep(float(0.0), float(0.04), vtxBorderDist);
  const vtxSample = terrainDepthTexNodeVS.sample(vtxClampedUv).level(0);
  const vtxTerrainH = vtxSample.r;
  const vtxOpenWaterRaw = vtxSample.g;
  const vtxDepth = mix(float(60.0), waterLevelUniform.sub(vtxTerrainH),
                       vtxBorderMask.mul(depthFieldValidUniform));
  const vtxOpenWater = mix(float(1.0), vtxOpenWaterRaw,
                           vtxBorderMask.mul(depthFieldValidUniform));
  const shallowFade = smoothstep(0.0, shoreDepthUniform.mul(0.9), vtxDepth).mul(vtxOpenWater);

  const gerstnerP = wavePosition(positionLocal.xz, scaledTime, seaUniform, shallowFade);
  oceanMaterial.positionNode = vec3(gerstnerP.x, gerstnerP.y, gerstnerP.z);

  oceanMaterial.colorNode = Fn(() => {
    const P = positionWorld.toVar();
    const xz = P.xz;
    const camDist = distance(cameraPosition, P).toVar();

    // ---- Pixel footprint, measured rather than guessed ---------------------
    const dpx = length(dFdx(P.xz)).toVar();
    const dpy = length(dFdy(P.xz)).toVar();
    const fp = min(dpx, dpy).toVar();
    const fpSpec = max(dpx, dpy).toVar();

    // Distance LOD factor: 1.0 up close (<250m), smoothly scales down towards distance
    const distLod = smoothstep(lodDistanceThresholdUniform, float(250.0), camDist);
    const effectiveLodFactor = mix(float(1.0), distLod, distanceLodUniform);
    const effectiveQuality = mix(float(0.55), float(1.0), qualityModeUniform);

    // Short swell components stop being resolvable at roughly the same range
    const footprint = clamp(camDist.div(600.0), 0.0, 1.0).toVar();
    const sharpness = float(1.0).sub(footprint.mul(0.92));

    const fieldData = sampleTerrainField(xz).toVar();
    const depth = fieldData.x.toVar();
    const openWater = fieldData.y.toVar();
    const shallowFadeF = smoothstep(0.0, shoreDepthUniform.mul(0.9), depth).mul(openWater).toVar();

    // Unified single-pass wave normal and surface calculations
    const waveData = waveNormalAndSurface(xz, scaledTime, seaUniform, openWater, shallowFadeF, sharpness);
    const n0 = waveData.normal;
    const swellLostVar = waveData.lostVar;
    const crest = waveData.crest;
    const jacobian = waveData.jacobian;
    const orbit = waveData.orbit;

    const N = n0.toVar();
    const detailVar = float(0.0).toVar();

    // Micro-normal reconstruction: active on High quality and when within LOD distance threshold
    If(qualityModeUniform.greaterThan(0.5).and(effectiveLodFactor.greaterThan(0.005)), () => {
      const h0 = detailHeight(xz, scaledTime, fp, orbit);
      const hx = detailHeight(xz.add(vec2(0.1, 0.0)), scaledTime, fp, orbit);
      const hz = detailHeight(xz.add(vec2(0.0, 0.1)), scaledTime, fp, orbit);

      const chopMask = fbmBL(xz.mul(0.045).add(vec2(scaledTime.mul(0.018), scaledTime.mul(-0.012))),
                             float(22.2), fp).mul(0.5).add(0.5);
      const nonUniformChop = mix(float(0.35), float(1.65), chopMask.mul(chopPatchinessUniform));
      const crestChopMult = mix(float(0.55), float(1.45), smoothstep(-0.4, 1.1, crest));

      const effectiveDetail = float(1.5)
        .mul(seaUniform.mul(0.6).add(0.4))
        .mul(detailAmountUniform)
        .mul(effectiveLodFactor)
        .mul(effectiveQuality)
        .mul(nonUniformChop)
        .mul(crestChopMult)
        .toVar();

      const detailGain = effectiveDetail.mul(0.1).toVar();
      const detail = vec3(h0.sub(hx), 0.0, h0.sub(hz)).mul(detailGain);
      N.assign(normalize(n0.add(detail)));
      detailVar.assign(detailLostVariance(fpSpec).mul(0.01).mul(detailGain).mul(detailGain));
    });

    const V = normalize(cameraPosition.sub(P)).toVar();

    // ---- Micro-facet roughness: the actual cure for the sparkle ------------
    const microVar = detailVar.add(swellLostVar).mul(microRoughnessUniform).toVar();
    const gloss = float(1.0).div(float(1.0).add(microVar.mul(20000.0))).toVar();
    const roughness = gloss.oneMinus().toVar();

    // Macro wind lanes / slicks across the open sea (creates organic glassy vs ruffled patches at distance)
    const windSlick = sin(xz.x.mul(0.0018).sub(xz.y.mul(0.0024)).sub(scaledTime.mul(0.04)))
      .mul(cos(xz.x.mul(0.0012).add(xz.y.mul(0.0016)).add(scaledTime.mul(0.03))))
      .mul(0.07)
      .mul(chopPatchinessUniform);
    const effectiveRoughness = clamp(roughness.add(windSlick), 0.02, 0.95).toVar();

    /* ---------------- Water body colour ---------------------------------- */
    const colorTurbulence = float(0.0).toVar();
    If(effectiveLodFactor.greaterThan(0.005), () => {
      colorTurbulence.assign(
        fbmBL(xz.mul(0.035).add(vec2(scaledTime.mul(0.015), scaledTime.mul(-0.01))),
              float(28.6), fp).mul(0.28).mul(effectiveLodFactor)
      );
    });

    // Broad macroscopic ocean currents and deep color lanes (wavelength ~600m - 1400m)
    // Non-aliasing broad variation that stays active across the distant expanse to eliminate uniformity
    const macroCurrents = sin(xz.x.mul(0.0022).add(xz.y.mul(0.0014)).sub(scaledTime.mul(0.03)))
      .mul(cos(xz.x.mul(0.0013).sub(xz.y.mul(0.0028)).add(scaledTime.mul(0.02))))
      .mul(0.18)
      .mul(chopPatchinessUniform);

    // Open-ocean back-scatter: what deep water looks like when no bottom contributes at all.
    const openBody = mix(
      deepColorUniform,
      shallowColorUniform,
      clamp(crest.mul(0.25).add(0.48).add(colorTurbulence).add(macroCurrents), 0.0, 1.0)
    ).toVar();

    // ---- Beer-Lambert transmission to the sea bed --------------------------
    // Only evaluated when depth is shallow enough (<14m) for sea floor transmission to be visible.
    const body = openBody.toVar();
    If(depth.lessThan(14.0), () => {
      const refrXz = xz.add(N.xz.mul(shoreRefractionUniform.mul(3.0)));
      const depthR = max(sampleWaterDepth(refrXz), float(0.0));
      const T = exp(extinctionUniform.mul(min(depthR, float(60.0))).mul(-2.0));
      body.assign(mix(openBody, sandColorUniform.mul(bottomBrightnessUniform), T));
      body.addAssign(shoreShallowColorUniform.mul(T.r.oneMinus().mul(T.b)).mul(inScatterUniform));
    });

    // ---- Subsurface scattering through the crest ---------------------------
    If(effectiveLodFactor.greaterThan(0.005).and(crest.greaterThan(0.0)), () => {
      const sssH = normalize(sunDirUniform.add(N.mul(sssDistortionUniform)));
      const sssDot = clamp(dot(V, sssH.negate()), 0.0, 1.0);
      If(sssDot.greaterThan(0.0), () => {
        const backLit = pow(sssDot, sssPowerUniform);
        const crestSteep = clamp(length(N.xz).mul(8.0), 0.0, 1.0);
        const crestLift = clamp(
          crest.div(max(seaUniform.mul(waveHeightUniform).mul(3.0), float(0.25))), 0.0, 1.0);
        const sss = backLit.mul(crestSteep).mul(crestLift)
          .mul(sssStrengthUniform).mul(effectiveLodFactor);
        body.addAssign(sssColorUniform.mul(sunColorUniform).mul(sss));
      });
    });

    /* ---------------- Reflection + Fresnel -------------------------------- */
    const R = reflect(V.negate(), N).toVar();
    const NdotV = clamp(dot(N, V), 0.0, 1.0).toVar();
    const fresnelRaw = float(0.02).add(float(0.98).mul(pow(NdotV.oneMinus(), 5.0)));
    const fresnel = mix(fresnelRaw, fresnelRaw.mul(0.55).add(0.10),
                        clamp(effectiveRoughness.mul(fresnelRoughUniform), 0.0, 1.0));
    const color = mix(body, skyColor(R), fresnel).toVar();

    /* ---------------- Specular ------------------------------------------- */
    const H = normalize(sunDirUniform.add(V));
    const NdotH = max(dot(N, H), 0.0).toVar();
    If(NdotH.greaterThan(0.02), () => {
      const glitterNoise = float(0.75).toVar();
      If(qualityModeUniform.greaterThan(0.5).and(effectiveLodFactor.greaterThan(0.005)).and(NdotH.greaterThan(0.1)), () => {
        glitterNoise.assign(fbmBL(xz.mul(2.1).add(vec2(scaledTime.mul(-0.4), scaledTime.mul(0.5))),
                                   float(0.476), fp).mul(0.5).add(0.5));
      });
      const specPower = max(float(520.0).mul(gloss), float(14.0));
      const specGain = float(2.6).mul(gloss).mul(sparkleUniform);
      const glitter = pow(NdotH, specPower).mul(specGain).mul(glitterNoise.mul(0.6).add(0.7)).mul(effectiveLodFactor);
      const sheen = pow(NdotH, mix(float(48.0), float(14.0), effectiveRoughness)).mul(0.15);
      color.addAssign(sunColorUniform.mul(glitter.add(sheen)));
    });

    /* ---------------- Foam ------------------------------------------------ */
    const breakAt = Fn(([j, w]) =>
      smoothstep(foamJacobianUniform, foamJacobianUniform.sub(0.35), j).mul(w));
    const capRaw = float(0.0).toVar();

    // Lagged Jacobian trails evaluated only when within active LOD distance
    If(qualityModeUniform.greaterThan(0.5).and(effectiveLodFactor.greaterThan(0.05)), () => {
      const jacLag1 = waveJacobianAt(xz, scaledTime.sub(foamTrailUniform.mul(1.1)),
                                     seaUniform, shallowFadeF);
      const jacLag2 = waveJacobianAt(xz, scaledTime.sub(foamTrailUniform.mul(2.7)),
                                     seaUniform, shallowFadeF);
      capRaw.assign(max(breakAt(jacobian, float(1.0)),
                         max(breakAt(jacLag1, float(0.55)), breakAt(jacLag2, float(0.22)))));
    }).Else(() => {
      capRaw.assign(breakAt(jacobian, float(1.0)));
    });

    const sdir = vec2(WAVES[0].dx, WAVES[0].dz);
    const sperp = vec2(WAVES[0].dz.negate(), WAVES[0].dx);
    const alongAxis = dot(xz, sdir).sub(scaledTime.mul(WAVES[0].c).mul(0.35));
    const acrossAxis = dot(xz, sperp);
    const streakUv = vec2(alongAxis.mul(0.07), acrossAxis.mul(0.55));

    const streakMask = float(1.0).toVar();
    const foamNoise = float(0.75).toVar();

    If(qualityModeUniform.greaterThan(0.5).and(effectiveLodFactor.greaterThan(0.01)), () => {
      const foamStreak = fbmBL(streakUv, float(1.82), fp).mul(0.5).add(0.5);
      streakMask.assign(mix(float(1.0), smoothstep(0.18, 0.8, foamStreak), foamStreakUniform));
      foamNoise.assign(fbmBL(xz.mul(1.1).add(vec2(scaledTime.mul(0.22), scaledTime.mul(0.14))),
                              float(0.909), fp).mul(0.5).add(0.5));
    });

    const capFoam = capRaw.mul(streakMask);

    // ---- The surf line (contour-hugging shore waves & beach swash) --------
    // Only evaluated when close to shore (depth < shoreFoamWidthUniform + 1.0)
    const shoreFoam = float(0.0).toVar();
    If(depth.lessThan(shoreFoamWidthUniform.add(1.0)), () => {
      const depthNoise = foamNoise.mul(0.4).sub(0.2);
      const distortedDepth = max(depth.add(depthNoise), float(0.0));
      const shoreWavePhase = distortedDepth.mul(3.2)
        .sub(scaledTime.mul(shoreFoamSpeedUniform).mul(2.0))
        .add(crest.mul(0.6));
      const waveCrest = pow(max(sin(shoreWavePhase), float(0.0)), 3.5);
      const waveBreak = smoothstep(0.2, 0.7, foamNoise);
      // Ocean surf wave is restricted to open water (suppressed in calm desert ponds and landlocked lakes)
      const shoreWave = waveCrest.mul(waveBreak).mul(openWater);
      const shoreBand = smoothstep(shoreFoamWidthUniform, 0.0, depth);

      // Waterline swash: natural bell-curve band peaking at 0.15m - 0.25m depth,
      // softly tapering to 0 as depth approaches 0.0 to prevent harsh white lines along the sand edge
      const waterlineBand = smoothstep(float(0.02), float(0.18), depth)
        .mul(smoothstep(float(0.48), float(0.18), depth));
      const waterline = waterlineBand.mul(foamNoise.mul(0.4).add(0.6)).mul(0.55);

      // Edge feathering: suppresses harsh clipped white edges right at water/terrain contact
      const edgeFeather = smoothstep(float(0.02), float(0.22), depth);

      // Distance falloff: fades high-frequency shoreline foam when viewed from altitude or afar,
      // eliminating distant sub-pixel shimmering, buzzing white noise, and harsh white island halos
      const shoreDistFade = smoothstep(float(1400.0), float(350.0), camDist);

      shoreFoam.assign(
        shoreBand.mul(shoreWave.mul(0.65))
          .add(waterline.mul(openWater.mul(0.4).add(0.6)))
          .mul(shoreFoamStrengthUniform)
          .mul(edgeFeather)
          .mul(shoreDistFade)
      );
    });

    const foam = capFoam.add(shoreFoam)
      .mul(foamAmountUniform).mul(foamEnabledUniform).mul(foamDecayUniform).toVar();
    const foamMask = clamp(foam.mul(0.85), 0.0, 1.0).toVar();

    color.assign(mix(color, vec3(0.92, 0.96, 1.0), foamMask));

    /* ---------------- Atmospheric Fog & Horizon Seamless Blend ----------- */
    // 1. Real-time atmospheric depth scaling controlled by globalFogDensityUniform
    // Distance-based atmospheric perspective that smoothly interpolates the water toward sky color
    const fogRange = max(waterFogFarUniform.sub(waterFogNearUniform), float(1.0));
    const fogDist = max(camDist.sub(waterFogNearUniform), float(0.0));
    const fogNorm = clamp(fogDist.div(fogRange), 0.0, 1.0);
    // Optical depth scales linearly with distance and global fog density
    const opticalDepth = fogNorm.mul(clamp(globalFogDensityUniform, float(0.0), float(8.0)));
    // Exponential atmospheric falloff: 1.0 - exp(-2.2 * opticalDepth)
    const atmosphericFog = float(1.0).sub(exp(opticalDepth.mul(-2.2)))
      .mul(clamp(waterFogStrengthUniform, 0.0, 1.0))
      .toVar();

    // 2. Geometry grid edge protection
    // Completely dissolves to sky color before reaching the 8,000m boundary of the geometry grid
    const camDistXZ = length(positionWorld.xz.sub(cameraPosition.xz));
    const gridRange = max(waterGridFadeEndUniform.sub(waterGridFadeStartUniform), float(1.0));
    const gridNorm = clamp(camDistXZ.sub(waterGridFadeStartUniform).div(gridRange), 0.0, 1.0);
    const gridEdgeFade = smoothstep(float(0.0), float(1.0), gridNorm);

    // Combine atmospheric fog and mesh boundary hide factor
    const totalAtmosphericBlend = clamp(max(atmosphericFog, gridEdgeFade), 0.0, 1.0);

    // Sky target color: at grazing angle (horizon), perfectly matches horizonColorUniform;
    // when viewing downwards from high altitude, subtly shifts toward zenith color
    const viewRay = normalize(P.sub(cameraPosition));
    const zenithAngleMix = clamp(viewRay.y.negate().mul(0.22), 0.0, 0.3);
    const skyTargetColor = mix(horizonColorUniform, zenithColorUniform, zenithAngleMix);

    // Blend ocean color toward sky color
    color.assign(mix(color, skyTargetColor, totalAtmosphericBlend));

    /* ---------------- Alpha ------------------------------------------------ */
    const depthAlpha = mix(shoreOpacityUniform, waterOpacityUniform,
                           smoothstep(0.0, shoreDepthUniform, depth));
    // Softly blend foam opacity with depthAlpha near the edge so foam doesn't abruptly pop or create opaque borders
    const foamAlphaGain = foamMask.mul(foamOpacityUniform).mul(smoothstep(float(0.02), float(0.30), depth));
    const alpha = max(depthAlpha, foamAlphaGain).toVar();

    // Ensure distant water is 100% opaque to fully conceal the void/terrain beneath and match sky
    alpha.assign(mix(alpha, float(1.0), totalAtmosphericBlend));

    return vec4(color, clamp(alpha, 0.0, 1.0));
  })();

  return oceanMaterial;
};

/* ============================================================
   CPU Wave Physics — for real-time player/boat buoyancy
   ============================================================ */
function _macroWaveEnvelopeCPU(targetX, targetZ, t) {
  const warpX = Math.sin(targetZ * 0.0012 + t * 0.04) * 180.0;
  const warpZ = Math.cos(targetX * 0.0015 - t * 0.03) * 180.0;
  const wx = targetX + warpX;
  const wz = targetZ + warpZ;

  const s1 = Math.sin(wx * 0.0014 + wz * 0.0009 - t * 0.07);
  const c1 = Math.cos(wx * 0.0008 - wz * 0.0016 + t * 0.04);
  const s2 = Math.sin(wx * 0.0031 - wz * 0.0022 + t * 0.11);

  const mod = (s1 * c1 * 0.45 + s2 * 0.20) * chopPatchinessUniform.value;
  return Math.max(0.05, 1.0 + mod);
}

function _waveAmplitude(w, sea, env) {
  return (w.steepness.value * sea * swellWavelengthUniform.value
    * waveHeightUniform.value * w.geo.value * env) / w.k.value;
}

export function getWaterHeightAt(rawX, rawZ, time, sea) {
  const targetX = rawX * oceanScaleUniform.value;
  const targetZ = rawZ * oceanScaleUniform.value;
  const Q = chopStrengthUniform.value;
  const t = time * speedUniform.value;
  const env = _macroWaveEnvelopeCPU(targetX, targetZ, t);

  let px = targetX;
  let pz = targetZ;
  for (let iter = 0; iter < 2; iter++) {
    let dx = 0;
    let dz = 0;
    for (const w of WAVES) {
      if (w.geo.value <= 0) continue;
      const a = _waveAmplitude(w, sea, env);
      const rawF = w.k.value * (w.dx.value * px + w.dz.value * pz - t * w.c.value) + w.phase.value;
      const f = ((rawF % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const ha = Q * a * Math.cos(f);
      dx += ha * w.dx.value;
      dz += ha * w.dz.value;
    }
    px = targetX - dx;
    pz = targetZ - dz;
  }

  let y = 0;
  for (const w of WAVES) {
    if (w.geo.value <= 0) continue;
    const a = _waveAmplitude(w, sea, env);
    const rawF = w.k.value * (w.dx.value * px + w.dz.value * pz - t * w.c.value) + w.phase.value;
    const f = ((rawF % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const cf = Math.cos(f);
    const cos2f = 2 * cf * cf - 1;
    const pinch = 0.5 * w.k.value * a * a * cos2f
      * crestSharpnessUniform.value * w.geo2.value;
    y += a * Math.sin(f) - pinch;
  }
  return y;
}

export function getWaterNormalAt(x, z, time, sea) {
  const eps = 0.15;
  const h0 = getWaterHeightAt(x, z, time, sea);
  const hx = getWaterHeightAt(x + eps, z, time, sea);
  const hz = getWaterHeightAt(x, z + eps, time, sea);
  const dx = (hx - h0) / eps;
  const dz = (hz - h0) / eps;
  return new THREE.Vector3(-dx, 1.0, -dz).normalize();
}
