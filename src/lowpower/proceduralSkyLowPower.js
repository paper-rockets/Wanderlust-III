import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    Fn, If, vec2, vec3, vec4, uniform, positionWorld, cameraPosition, normalize,
    dot, clamp, mix, pow, smoothstep, float, sin, fract, abs, max, floor, step
} from 'three/tsl';

// Fast single-hash 2D noise
const hash = Fn(([p]) => {
    return fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453123));
});

const fastNoise = Fn(([p]) => {
    const i = floor(p);
    const f = fract(p);
    const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));
    return mix(
        mix(hash(i.add(vec2(0.0, 0.0))), hash(i.add(vec2(1.0, 0.0))), u.x),
        mix(hash(i.add(vec2(0.0, 1.0))), hash(i.add(vec2(1.0, 1.0))), u.x),
        u.y
    );
});

// Single-octave cloud noise for low-power WebGPU (replaces 3 domain-warped FBMs)
const cloudNoiseSingle = Fn(([p]) => {
    const n1 = fastNoise(p);
    const n2 = fastNoise(p.mul(2.02).add(vec2(5.2, 1.3))).mul(0.5);
    return n1.add(n2).mul(0.66);
});

// 3D hash for low-power star placement
const hash3 = Fn(([p]) => {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))).mul(43758.5453123));
});

const starLayerFast = Fn(([dir, uTime, density]) => {
    const p = dir.mul(float(160.0));
    const cell = floor(p);
    const f = p.sub(cell);

    const h = hash3(cell);
    const isStar = step(float(1.0).sub(density), h);

    const jitter = vec3(hash3(cell.add(vec3(1.7, 9.2, 3.3))), hash3(cell.add(vec3(4.1, 2.8, 7.6))), hash3(cell.add(vec3(8.3, 5.5, 1.9))));
    const d = f.sub(jitter).length();
    const core = smoothstep(0.18, 0.0, d);
    const magnitude = pow(hash3(cell.add(vec3(6.4, 1.1, 8.8))), 2.0).mul(0.85).add(0.15);

    return core.mul(isStar).mul(magnitude);
});

export function createLowPowerProceduralSky() {
    const uTime = uniform(0.0);
    const uSunPosition = uniform(new THREE.Vector3(0.0, 0.5, -0.866).normalize());
    const uSkyColorZenith = uniform(new THREE.Color(0x2a5090));
    const uSkyColorMid = uniform(new THREE.Color(0xc85078));
    const uSkyColorHorizon = uniform(new THREE.Color(0xffa07a));
    const uSunColor = uniform(new THREE.Color(0xffaa00));
    const uSunCoronaIntensity = uniform(0.6);
    const uCloudColor = uniform(new THREE.Color(0xfffaec));
    const uCloudShadowColor = uniform(new THREE.Color(0xa89888));
    const uCloudCoverage = uniform(0.45);
    const uCloudEdge = uniform(0.08);
    const uCloudSpeed = uniform(0.018);
    const uCloudOpacity = uniform(1.0);
    const uStormDarken = uniform(0.0);
    const uNightFactor = uniform(0.0);
    const uDuskFactor = uniform(1.0);
    const uHorizonGlow = uniform(0.45);
    const uEnableProceduralClouds = uniform(1.0);

    const uStarDensity = uniform(0.045);
    const uStarBrightness = uniform(1.2);
    const uNightColor = uniform(new THREE.Color(0.035, 0.045, 0.11));

    const material = new MeshBasicNodeMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: true,
        fog: false
    });

    material.colorNode = Fn(() => {
        const dir = normalize(positionWorld.sub(cameraPosition));
        const sunDir = normalize(uSunPosition);
        const sunDot = dot(dir, sunDir);

        const alt = clamp(dir.y, 0.0, 1.0);

        // Fast 3-stop vertical atmosphere gradient
        const tLower = clamp(alt.div(0.25), 0.0, 1.0);
        const tUpper = clamp(alt.sub(0.25).div(0.75), 0.0, 1.0);
        const lowerSky = mix(uSkyColorHorizon, uSkyColorMid, pow(tLower, 1.1));
        const baseAtmosphere = mix(lowerSky, uSkyColorZenith, pow(tUpper, 1.1));

        // Sun disc and forward corona
        const sunDisc = smoothstep(0.9985, 0.9997, sunDot).mul(uSunColor).mul(3.0);
        const sunCorona = pow(clamp(sunDot, 0.0, 1.0), 12.0).mul(uSunColor).mul(uSunCoronaIntensity);

        // Horizon subtle warm rim
        const horizonBand = pow(clamp(float(1.0).sub(abs(dir.y)), 0.0, 1.0), 3.0);
        const duskGlow = horizonBand.mul(uSkyColorHorizon).mul(uHorizonGlow).mul(uDuskFactor);

        // Fast Night Sky (guarded behind uniform branch)
        const nightSky = vec3(0.0).toVar();
        If(uNightFactor.greaterThan(0.01), () => {
            const stars = starLayerFast(dir, uTime, uStarDensity);
            const starHorizonFade = smoothstep(-0.02, 0.30, dir.y);
            const starColor = vec3(0.9, 0.95, 1.0).mul(stars).mul(starHorizonFade).mul(uStarBrightness);
            nightSky.assign(uNightColor.add(starColor));
        });

        let sky = baseAtmosphere.add(sunCorona).add(sunDisc).add(duskGlow);
        sky = mix(sky, nightSky, uNightFactor);
        sky = mix(sky, vec3(0.12, 0.14, 0.18), uStormDarken);

        // Fast Procedural Clouds (Single-pass lookup)
        const skyDomeDist = float(1.0).div(max(dir.y.add(0.15), float(0.08)));
        const cloudUV = dir.xz.mul(skyDomeDist).mul(0.35);
        const windOffset = vec2(uTime.mul(uCloudSpeed).mul(0.15), uTime.mul(uCloudSpeed).mul(0.08));
        const cNoise = cloudNoiseSingle(cloudUV.add(windOffset));

        const lowThresh = float(1.0).sub(uCloudCoverage);
        const highThresh = lowThresh.add(max(uCloudEdge, float(0.03)));
        const cloudAlpha = smoothstep(lowThresh, highThresh, cNoise);
        const horizonFade = smoothstep(0.02, 0.22, dir.y);
        const finalAlpha = cloudAlpha.mul(horizonFade).mul(uCloudOpacity).mul(uEnableProceduralClouds);

        const sunDiffuse = clamp(sunDot.mul(0.5).add(0.5), 0.0, 1.0);
        const dayCloudCol = mix(uCloudShadowColor, uCloudColor, sunDiffuse);
        const sunsetCloudCol = mix(dayCloudCol, vec3(1.0, 0.6, 0.45), uDuskFactor.mul(0.7));
        const finalCloudCol = mix(sunsetCloudCol, vec3(0.04, 0.05, 0.1), uNightFactor.mul(0.85));

        const compositeSky = mix(sky, finalCloudCol, finalAlpha);
        return vec4(compositeSky, 1.0);
    })();

    // Low tessellation sphere for mobile WebGPU
    const geometry = new THREE.SphereGeometry(20000, 24, 16);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = -1000;
    mesh.frustumCulled = false;

    return {
        mesh,
        material,
        uniforms: {
            uTime, uSunPosition, uSkyColorZenith, uSkyColorMid, uSkyColorHorizon, uSunColor,
            uSunCoronaIntensity, uHorizonGlow, uCloudColor, uCloudShadowColor, uCloudCoverage,
            uCloudEdge, uCloudSpeed, uCloudOpacity, uStormDarken, uNightFactor, uDuskFactor,
            uEnableProceduralClouds, uStarDensity, uStarBrightness, uNightColor
        }
    };
}
