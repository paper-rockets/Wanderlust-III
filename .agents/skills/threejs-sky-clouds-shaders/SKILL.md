---
name: threejs-sky-clouds-shaders
description: >
  Comprehensive guide and reference for 3D procedural skies, volumetric raymarched clouds, atmospheric scattering (Preetham/Rayleigh/Mie), Ghibli-style toon shaders, day/night cycles, WebGL skybox fundamentals, and volumetric post-processing in Three.js, React Three Fiber (R3F), and WebGL. Load on demand for high-performance sky systems, dynamic weather, custom shaders, and skybox optimizations. Triggers: "sky", "skybox", "volumetric clouds", "preetham sky", "day night cycle", "ghibli shader", "atmospheric scattering", "raymarched clouds", "r3f sky", "webgl skybox", "zephyros anemos", "volumetric pass", "cloud shader", "god rays", "sky rendering".
---

# Three.js & WebGL Procedural Sky, Clouds, and Shader Knowledge Base

This skill provides an authoritative, production-grade reference for building procedural skies, volumetric clouds, dynamic day/night cycles, atmospheric scattering, Ghibli-style toon rendering, and optimized WebGL/Three.js/R3F background systems.

---

## Table of Contents
1. [Atmospheric Scattering & Analytical Sky Systems](#1-atmospheric-scattering--analytical-sky-systems)
2. [Procedural Volumetric Clouds & Raymarching](#2-procedural-volumetric-clouds--raymarching)
3. [Ghibli-Style Anime & Toon Shaders](#3-ghibli-style-anime--toon-shaders)
4. [WebGL Skybox & Inverse View-Projection Matrix Tricks](#4-webgl-skybox--inverse-view-projection-matrix-tricks)
5. [Dynamic Day/Night Cycles & Starfields](#5-dynamic-daynight-cycles--starfields)
6. [Volumetric Lighting & Screen-Space God Rays](#6-volumetric-lighting--screen-space-god-rays)
7. [WebGL Performance & Step-Wise Initialization Patterns](#7-webgl-performance--step-wise-initialization-patterns)
8. [React Three Fiber (R3F) Declarative Integration](#8-react-three-fiber-r3f-declarative-integration)

---

## 1. Atmospheric Scattering & Analytical Sky Systems

### Preetham Sky Model (Three.js `Sky` / `SkyMesh`)
The standard analytical sky model in Three.js (based on *A Practical Analytic Model for Daylight* by Preetham et al.) computes sky color by evaluating Rayleigh out-scattering (air molecules) and Mie scattering (haze, aerosols, water droplets).

#### Key Uniforms
- `turbidity`: Haze / aerosol concentration (Range: `1.0` [crystal clear] to `20.0` [heavy smog]).
- `rayleigh`: Air molecule scattering intensity (Range: `0.0` to `4.0`, default `1.0` to `2.0`).
- `mieCoefficient`: Mie scattering coefficient (Range: `0.001` to `0.05`, default `0.005`).
- `mieDirectionalG`: Mie asymmetry factor ($g$), controlling forward scattering sharpness around the sun (Range: `0.0` to `0.99`, default `0.8`).
- `sunPosition`: `THREE.Vector3` indicating the sun's position in world space.
- `up`: Vector pointing upward (default `(0, 1, 0)`).

#### Setup Code (Three.js WebGL & WebGPU `SkyMesh`)
```javascript
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

// Setup Sky
const sky = new Sky();
sky.scale.setScalar(450000); // Enclose camera far plane
scene.add(sky);

const skyUniforms = sky.material.uniforms;
skyUniforms['turbidity'].value = 2.5;
skyUniforms['rayleigh'].value = 1.2;
skyUniforms['mieCoefficient'].value = 0.005;
skyUniforms['mieDirectionalG'].value = 0.8;

// Set Sun position based on elevation & azimuth
const sun = new THREE.Vector3();
const elevation = 15; // degrees above horizon
const azimuth = 180;  // degrees angle

const phi = THREE.MathUtils.degToRad(90 - elevation);
const theta = THREE.MathUtils.degToRad(azimuth);
sun.setFromSphericalCoords(1, phi, theta);

skyUniforms['sunPosition'].value.copy(sun);
```

#### Disabling Sun Disc for Environment Map Captures
When generating cubemap reflections via `CubeCamera`, hide the sun disc to prevent intense blooming artifacts:
```javascript
sky.material.uniforms.showSunDisc.value = false;
cubeCamera.update(renderer, scene);
sky.material.uniforms.showSunDisc.value = true;
```

---

## 2. Procedural Volumetric Clouds & Raymarching

### Cloud Genera Classification Matrix

| Genus | Altitude | Geometry / Shape | Shader/Noise Characteristics |
| :--- | :--- | :--- | :--- |
| **Cumulus** | Low (1–2 km) | Puffy mounds, flat base, cauliflower tops | High FBM Worley noise density, sharp bottom threshold |
| **Stratus** | Low (0.5–2 km) | Uniform flat sheet, grey overcast | Smooth 2D/3D Perlin noise, wide horizontal coverage |
| **Stratocumulus** | Low (1–2.5 km) | Lumpy rolls, patchy blanket with gaps | Periodic noise domain warping, low density contrast |
| **Cumulonimbus** | Low to High (1–12 km)| Towering anvil shape, dark stormy base | Multi-layer height profile, heavy light absorption |
| **Altocumulus** | Mid (2–6 km) | Rippled "mackerel sky" patches | High-frequency Worley grid pattern |
| **Altostratus** | Mid (2–6 km) | Thin fibrous veil, sun disk visible | Low density FBM, soft alpha blending |
| **Cirrus** | High (6–12 km) | Wispy streaks, mares' tails | Anisotropic directional domain stretch |

---

### 3D Noise Foundation (FBM / Worley / Perlin)

```javascript
// GPU-friendly 3D hash without lookup tables
function hash3(x, y, z) {
  let h = x * 127.1 + y * 311.7 + z * 74.7;
  return (Math.sin(h) * 43758.5453) % 1;
}

// 3D Value / FBM Noise
function noise3D(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);

  const lerp = (t, a, b) => a + t * (b - a);
  const h = (a, b, c) => hash3(ix + a, iy + b, iz + c);

  return lerp(uz,
    lerp(uy, lerp(ux, h(0,0,0), h(1,0,0)), lerp(ux, h(0,1,0), h(1,1,0))),
    lerp(uy, lerp(ux, h(0,0,1), h(1,0,1)), lerp(ux, h(0,1,1), h(1,1,1)))
  );
}

function cloudFBM(x, y, z, octaves = 5) {
  let sum = 0, amp = 1.0, freq = 1.0, max = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise3D(x * freq, y * freq, z * freq) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  return sum / max;
}
```

---

### Volumetric Raymarching GLSL Shader Snippet

Raymarching evaluates cloud density along camera view rays ($rd$), incorporating Henyey-Greenstein phase scattering and Beer-Lambert light absorption.

```glsl
// Henyey-Greenstein phase function for anisotropic light scattering
float henyeyGreenstein(float cosTheta, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * 3.14159265 * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
}

// Cloud density evaluation at point P
float getCloudDensity(vec3 p, float time, vec3 wind) {
    // Altitude constraint bounds
    float altFade = smoothstep(1000.0, 1200.0, p.y) * smoothstep(3000.0, 2800.0, p.y);
    if (altFade <= 0.0) return 0.0;

    vec3 samplePos = p * 0.0003 + wind * time;
    float baseNoise = fbm3D(samplePos, 4);
    float coverage = 0.45; // Uniform coverage threshold
    float shape = smoothstep(1.0 - coverage, 1.0, baseNoise);

    // Detail erosion carving cloud edges
    float detailNoise = fbm3D(p * 0.002 + wind * time * 2.0, 3);
    float finalDensity = max(shape - detailNoise * 0.3, 0.0) * altFade;

    return finalDensity;
}

// Raymarching loop inside Fragment Shader
vec4 raymarchClouds(vec3 ro, vec3 rd, vec3 sunDir, vec3 sunColor, float time) {
    float t = intersectCloudSlab(ro, rd);
    vec4 accum = vec4(0.0);
    float stepSize = 35.0;

    for (int i = 0; i < 64; i++) {
        if (accum.a >= 0.98) break;
        vec3 p = ro + rd * t;
        float density = getCloudDensity(p, time, vec3(0.05, 0.0, 0.02));

        if (density > 0.001) {
            // Secondary light step toward sun
            float lightDensity = getCloudDensity(p + sunDir * 120.0, time, vec3(0.05, 0.0, 0.02));
            float lightTransmittance = exp(-lightDensity * 0.08);

            // Phase scattering calculation
            float cosTheta = dot(rd, sunDir);
            float phase = henyeyGreenstein(cosTheta, 0.6) + henyeyGreenstein(cosTheta, -0.2) * 0.5;

            // Silver lining rim lighting effect
            float rim = pow(clamp(1.0 - abs(cosTheta), 0.0, 1.0), 4.0);
            vec3 color = sunColor * (lightTransmittance * phase + rim * 0.25) + vec3(0.5, 0.6, 0.8) * 0.15;

            // Beer-Lambert absorption
            float alpha = 1.0 - exp(-density * stepSize * 0.015);
            accum.rgb += color * alpha * (1.0 - accum.a);
            accum.a += alpha * (1.0 - accum.a);
        }
        t += stepSize;
    }
    return accum;
}
```

---

## 3. Ghibli-Style Anime & Toon Shaders

Craftzdog's Ghibli style toon shader uses discrete color band steps, light position dot products, and custom uniforms to render hand-drawn Japanese animation aesthetics.

### Ghibli Shader Material Implementation

```javascript
import * as THREE from 'three';

export const GhibliShaderMaterial = {
  uniforms: {
    colorMap: {
      value: [
        new THREE.Color("#427062"), // Deep shade
        new THREE.Color("#33594E"), // Mid shade
        new THREE.Color("#234549"), // Shadow tint
        new THREE.Color("#1E363F")  // Ambient deep base
      ]
    },
    brightnessThresholds: {
      value: [0.85, 0.45, 0.1]
    },
    lightPosition: { value: new THREE.Vector3(15, 25, 15) }
  },
  vertexShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 colorMap[4];
    uniform float brightnessThresholds[3];
    uniform vec3 lightPosition;

    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
      vec3 lightVector = normalize(lightPosition - vWorldPosition);
      float NdotL = dot(vNormal, lightVector);

      // Quantize diffuse brightness into discrete Ghibli anime bands
      vec3 finalColor = colorMap[3];
      if (NdotL > brightnessThresholds[0]) {
        finalColor = colorMap[0];
      } else if (NdotL > brightnessThresholds[1]) {
        finalColor = colorMap[1];
      } else if (NdotL > brightnessThresholds[2]) {
        finalColor = colorMap[2];
      }

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
};
```

---

## 4. WebGL Skybox & Inverse View-Projection Matrix Tricks

When rendering a skybox in pure WebGL or raw shaders without large surrounding box meshes, use the **Inverse View-Projection Matrix** technique.

### Key Concept
1. Draw a full-screen quad or clip-space box.
2. Invert the view-projection matrix (stripping translation components from the view matrix).
3. Set `gl_Position.z = gl_Position.w` in the vertex shader so depth buffer values resolve to $1.0$ (maximum distance / far plane).
4. Set depth test comparison function to `gl.LEQUAL`.

### GLSL Shaders for Infinite Skybox Pass

```glsl
// Skybox Vertex Shader
attribute vec4 a_position;
varying vec3 v_skyDirection;
uniform mat4 u_viewDirectionProjectionInverse;

void main() {
    v_skyDirection = (u_viewDirectionProjectionInverse * a_position).xyz;
    // Force depth to far plane (1.0 in normalized device coordinates)
    gl_Position = a_position.xyww;
}

// Skybox Fragment Shader
precision mediump float;
varying vec3 v_skyDirection;
uniform samplerCube u_skyboxCubemap;

void main() {
    gl_FragColor = textureCube(u_skyboxCubemap, normalize(v_skyDirection));
}
```

---

## 5. Dynamic Day/Night Cycles & Starfields

A complete day-night loop synchronizes sun trajectory, atmospheric color, ambient lighting intensity, and starfield visibility/rotation.

```javascript
export class DayNightCycle {
  constructor(skyMesh, starfieldMesh, dirLight) {
    this.sky = skyMesh;
    this.starfield = starfieldMesh;
    this.dirLight = dirLight;
    this.sunAngle = 0; // In radians
  }

  update(deltaSpeed = 0.005) {
    this.sunAngle += deltaSpeed;
    if (this.sunAngle > Math.PI * 2) this.sunAngle -= Math.PI * 2;

    const sunDistance = 400000;
    const x = Math.cos(this.sunAngle) * sunDistance;
    const y = Math.sin(this.sunAngle) * sunDistance;
    const z = Math.sin(this.sunAngle * 0.5) * 100000;

    const sunPos = new THREE.Vector3(x, y, z);
    this.sky.material.uniforms['sunPosition'].value.copy(sunPos);
    this.dirLight.position.copy(sunPos).normalize().multiplyScalar(100);

    // Evaluate current day phase based on elevation sin(sunAngle)
    const sinElevation = Math.sin(this.sunAngle);
    if (sinElevation > 0.05) {
      // Day Time
      this.starfield.visible = false;
      this.dirLight.intensity = Math.min(sinElevation * 1.5, 1.0);
    } else if (sinElevation > -0.15) {
      // Twilight / Sunset / Dawn
      this.starfield.visible = false;
      this.dirLight.intensity = Math.max((sinElevation + 0.15) / 0.2, 0.05);
    } else {
      // Night Time
      this.starfield.visible = true;
      this.starfield.rotation.y = this.sunAngle * 0.2;
      const nightIntensity = Math.abs(sinElevation);
      this.starfield.material.opacity = Math.min(nightIntensity * 1.2, 1.0);
      this.dirLight.intensity = 0.02;
    }
  }
}
```

---

## 6. Volumetric Lighting & Screen-Space God Rays

Using `three-volumetric-pass` or `postprocessing` effect composers to render crepuscular ray shafts (god rays).

```javascript
import { EffectComposer, RenderPass, EffectPass } from 'postprocessing';
import { VolumetricPass } from 'three-volumetric-pass';

function setupVolumetricGodRays(renderer, scene, camera, sunMesh) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const volumetricPass = new VolumetricPass(scene, camera, sunMesh, {
    samples: 100,
    density: 0.96,
    decay: 0.93,
    weight: 0.4,
    exposure: 0.6,
    clampMax: 1.0
  });

  composer.addPass(volumetricPass);
  return composer;
}
```

---

## 7. WebGL Performance & Step-Wise Initialization Patterns

As detailed in the Zephyros Anemos terrain & sky architecture, heavy texture decompression and vertex buffer uploads on the main JavaScript thread cause stuttering and dropped frames.

### Step-Wise Progressive Queue Pattern
Break down multi-stage asset preparation across animation frames:

```javascript
class ProgressiveInitQueue {
  constructor() {
    this.queue = [];
  }

  enqueue(item, processCallback) {
    this.queue.push({ item, step: 0, processCallback });
  }

  // Execute single step per frame (keeps main thread under 16ms budget)
  tick(frameTimeBudgetMs = 8.0) {
    const startTime = performance.now();
    while (this.queue.length > 0 && (performance.now() - startTime) < frameTimeBudgetMs) {
      const task = this.queue[0];
      const finished = task.processCallback(task.item, task.step);
      if (finished) {
        this.queue.shift(); // Task completed
      } else {
        task.step++; // Move to next sub-stage next tick
      }
    }
  }
}
```

---

## 8. React Three Fiber (R3F) Declarative Integration

Declarative Three.js rendering using `@react-three/fiber` and `@react-three/drei`.

### Custom Shader Material in R3F (`shaderMaterial` helper)
```jsx
import React, { useRef } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

const CloudShaderMaterial = shaderMaterial(
  { uTime: 0, uColor: new THREE.Color('white') },
  /* vertexShader */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /* fragmentShader */ `
    uniform float uTime;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      gl_FragColor = vec4(uColor * (0.8 + 0.2 * sin(uTime + vUv.x * 10.0)), 1.0);
    }
  `
);

extend({ CloudShaderMaterial });

function AnimatedSkyMesh() {
  const matRef = useRef();
  useFrame((state, delta) => {
    if (matRef.current) matRef.current.uTime += delta;
  });

  return (
    <mesh scale={100}>
      <sphereGeometry args={[1, 32, 32]} />
      <cloudShaderMaterial ref={matRef} uColor="skyblue" side={THREE.BackSide} />
    </mesh>
  );
}

export function SkyApp() {
  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <ambientLight intensity={0.5} />
      <AnimatedSkyMesh />
    </Canvas>
  );
}
```

---

## Quick Reference Checklist
- **Preetham Sky**: Use `Sky` from `three/addons/objects/Sky.js`. Scales to `450000`. Disable `showSunDisc` before `CubeCamera` environment rendering.
- **Clouds**: Match cloud genera to altitude and noise frequency. Use ray-slab intersection for fast volumetric bounds.
- **Toon Shading**: Quantize $N \cdot L$ dot products into discrete `colorMap` array thresholds.
- **Skybox Trick**: Invert view-projection matrix, set `gl_Position = position.xyww`, use `gl.LEQUAL`.
- **God Rays**: Pass screen-space light origin to radial blur shader pass via `EffectComposer`.
- **R3F**: Use `useFrame` for time updates outside React re-render cycle; wrap custom materials with `shaderMaterial` + `extend`.
