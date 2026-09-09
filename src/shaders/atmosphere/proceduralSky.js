import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { tierSettings } from '../../core/DeviceTier.js';

const SKY_OCTAVES = Math.max(2, Math.min(4, tierSettings.skyOctaves));
import {
    Fn, If, vec2, vec3, vec4, uniform, positionWorld, cameraPosition, normalize,
    dot, cross, clamp, mix, pow, smoothstep, float, sin, fract, abs, max, floor, step, exp
} from 'three/tsl';

const hash = Fn(([p]) => {
    return fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453123));
});

const noise = Fn(([p]) => {
    const i = p.floor();
    const f = p.fract();
    const u = f.mul(f).mul(float(3.0).sub(f.mul(2.0)));
    return mix(
        mix(hash(i.add(vec2(0.0, 0.0))), hash(i.add(vec2(1.0, 0.0))), u.x),
        mix(hash(i.add(vec2(0.0, 1.0))), hash(i.add(vec2(1.0, 1.0))), u.x),
        u.y
    );
});


// Octave count is set by device tier. The cloud silhouette is dominated by the first two
// octaves; the last two only add fine detail that is invisible on a phone screen. This is the
// most expensive shader in the project -- three domain-warped FBM evaluations per pixel, over
// the whole sky dome -- so the octave count is the single biggest lever on its cost.
//
// Amplitudes are renormalised per tier so a 2-octave sky has the same overall contrast as a
// 4-octave one, rather than looking washed out.
const makeFbm = (octaves) => {
    const amps = [0.5, 0.25, 0.125, 0.0625].slice(0, octaves);
    const norm = 0.9375 / amps.reduce((a, b) => a + b, 0);
    const lac = [2.02, 2.03, 2.01];
    return Fn(([p]) => {
        let f = float(0.0).toVar();
        let currP = vec2(p).toVar();
        for (let i = 0; i < octaves; i++) {
            f.addAssign(noise(currP).mul(amps[i] * norm));
            if (i < octaves - 1) currP.mulAssign(lac[i % lac.length]);
        }
        return f;
    });
};

const fbm = makeFbm(SKY_OCTAVES);

// 3D hash for star placement -- one value per direction cell.
const hash3 = Fn(([p]) => {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))).mul(43758.5453123));
});

// Starfield.
// The old points-based star field in main.js was force-disabled every frame with the comment
// "procedural sky handles stars now" -- but no star code was ever added here, so night was a
// flat 2%-luminance dome. This is that missing layer.
//
// Direction is quantised into cells; a cell lights up only if its hash clears a threshold, so
// density is controllable without changing the pattern. Brightness comes from a second hash so
// stars are not all the same magnitude, and a slow per-star phase gives an uncorrelated twinkle.
const starLayer = Fn(([dir, uTime, density, twinkleAmt, cellScale]) => {
    const p = dir.mul(cellScale);
    const cell = floor(p);
    const f = p.sub(cell);

    const h = hash3(cell);
    // Only the top `density` fraction of cells contain a star
    const isStar = step(float(1.0).sub(density), h);

    // Jittered position inside the cell so stars do not sit on a visible lattice
    const jitter = vec3(hash3(cell.add(vec3(1.7, 9.2, 3.3))), hash3(cell.add(vec3(4.1, 2.8, 7.6))), hash3(cell.add(vec3(8.3, 5.5, 1.9))));
    const d = f.sub(jitter).length();

    // Tight point. Kept in cell space so stars stay the same angular size at any resolution.
    const core = smoothstep(0.14, 0.0, d);

    // Magnitude variation -- a few bright, many faint
    const magnitude = pow(hash3(cell.add(vec3(6.4, 1.1, 8.8))), 2.2).mul(0.85).add(0.15);

    // Slow uncorrelated twinkle
    const phase = hash3(cell.add(vec3(3.9, 7.1, 2.2))).mul(6.2831);
    const twinkle = sin(uTime.mul(1.4).add(phase)).mul(0.5).add(0.5).mul(twinkleAmt).add(float(1.0).sub(twinkleAmt));

    return core.mul(isStar).mul(magnitude).mul(twinkle);
});

export function createProceduralSky() {
    const uTime = uniform(0.0);
    const uSunPosition = uniform(new THREE.Vector3(0.0, 0.5, -0.866).normalize());
    const uSkyColorZenith = uniform(new THREE.Color(0x2a5090));
    const uSkyColorMid = uniform(new THREE.Color(0xc85078));
    const uSkyColorHorizon = uniform(new THREE.Color(0xffa07a));
    const uSunColor = uniform(new THREE.Color(0xffaa00));
    const uGradientPower = uniform(1.2);
    const uGradientMidOffset = uniform(0.22);
    const uGradientSkyEnabled = uniform(1.0);
    const uSunCoronaIntensity = uniform(0.7);
    const uCloudColor = uniform(new THREE.Color(0xfffaec));
    const uCloudShadowColor = uniform(new THREE.Color(0x8ca4c8));
    const uCloudCoverage = uniform(0.45);
    const uCloudEdge = uniform(0.06);
    const uCloudSpeed = uniform(0.018);
    const uCloudTurbulence = uniform(0.0);
    const uCloudOpacity = uniform(1.0);
    const uStormDarken = uniform(0.0);
    const uNightFactor = uniform(0.0);
    const uDuskFactor = uniform(1.0);
    const uHorizonGlow = uniform(0.45);
    const uEnableProceduralClouds = uniform(1.0);
    // Night sky. All of these are multiplied by uNightFactor, which is exactly 0.0 at dusk,
    // so none of them can alter the golden dusk render.
    const uStarDensity = uniform(0.055);
    const uStarBrightness = uniform(1.35);
    const uStarTwinkle = uniform(0.45);
    const uMilkyWay = uniform(0.1);
    const uMilkyDust = uniform(0.85);
    const uMilkyArmColor = uniform(new THREE.Color(0.55, 0.68, 1.15));
    const uMilkyCoreColor = uniform(new THREE.Color(1.35, 1.10, 0.85));
    const uNightSkyLift = uniform(1.0);
    const uNightColor = uniform(new THREE.Color(0.008, 0.012, 0.025));
    const uMoonCoronaIntensity = uniform(0.65);

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

        // Vertical altitude angle: 0.0 at horizon, 1.0 directly overhead
        const alt = clamp(dir.y, 0.0, 1.0);

        // 3-stop vertical atmospheric gradient (Horizon -> Mid-Sky -> Zenith)
        const tLower = clamp(alt.div(max(uGradientMidOffset, float(0.01))), 0.0, 1.0);
        const tUpper = clamp(alt.sub(uGradientMidOffset).div(max(float(1.0).sub(uGradientMidOffset), float(0.01))), 0.0, 1.0);

        const curveLower = pow(tLower, uGradientPower);
        const curveUpper = pow(tUpper, uGradientPower);

        const lowerSky = mix(uSkyColorHorizon, uSkyColorMid, curveLower);
        const gradientSky = mix(lowerSky, uSkyColorZenith, curveUpper);

        // Backward-compatible 2-stop simple curve for baseSky
        const h = clamp(dir.y.mul(1.5), 0.0, 1.0);
        const twoStopSky = mix(uSkyColorHorizon, uSkyColorZenith, pow(h, 0.6));
        const baseAtmosphere = mix(twoStopSky, gradientSky, uGradientSkyEnabled);

        // Sun disc and forward atmospheric corona glow
        const sunDisc = smoothstep(0.9985, 0.9997, sunDot).mul(uSunColor).mul(3.0);
        const sunCorona = pow(clamp(sunDot, 0.0, 1.0), 32.0).mul(uSunColor).mul(uSunCoronaIntensity);
        const sunHaze = pow(clamp(sunDot, 0.0, 1.0), 8.0).mul(uSkyColorHorizon).mul(0.18);

        // Horizon subtle warm rim
        const horizonBand = pow(clamp(float(1.0).sub(abs(dir.y)), 0.0, 1.0), 3.0);
        const duskGlow = horizonBand.mul(uSkyColorHorizon).mul(uHorizonGlow).mul(uDuskFactor);

        // ==========================================
        // NIGHT SKY
        // ==========================================
        // The whole night block sits behind a UNIFORM branch. uNightFactor is a uniform, so
        // every lane in the wave takes the same path -- no divergence -- and at day or dusk
        // none of the star or galaxy maths executes at all. Previously it was computed on
        // every pixel and then multiplied by zero.
        const nightSky = vec3(0.0).toVar();

        If(uNightFactor.greaterThan(0.001), () => {

            // ---- Galactic plane basis ----
            // A band needs its own coordinate frame or the noise reads as a blurry smear
            // rather than a galaxy. `across` is the signed distance from the plane; `a` and
            // `b` are the two in-plane axes, so noise can be stretched ALONG the band and
            // compressed ACROSS it, which is what produces filaments instead of blobs.
            const bandAxis = normalize(vec3(0.45, 0.62, -0.64));
            const t1 = normalize(cross(bandAxis, vec3(0.0, 1.0, 0.0)));
            const t2 = cross(bandAxis, t1);

            const across = dot(dir, bandAxis);
            const a = dot(dir, t1);
            const b = dot(dir, t2);
            const inPlane = vec2(a, b);

            // Two falloffs: a tight bright lane and a broad halo around it. Gaussians rather
            // than a linear ramp -- a hard edge on a galaxy looks like a painted stripe.
            const a2 = across.mul(across);
            const bandCore = exp(a2.mul(-28.0));
            const bandWide = exp(a2.mul(-4.5));

            // ---- Structure, three scales ----
            const large = fbm(inPlane.mul(2.1));                                  // where the band swells
            const fila  = fbm(inPlane.mul(7.5).add(across.mul(5.0)));              // filaments
            const fine  = fbm(inPlane.mul(18.0).add(across.mul(9.0)));             // mottling

            let glow = bandWide.mul(large.mul(1.1).add(0.40))
                .add(bandCore.mul(fila.mul(1.2).add(0.60))).toVar();

            // ---- Dust lanes ----
            // The dark rifts are what make it read as the Milky Way and not just a bright
            // streak. Independent noise, thresholded, subtracted from the core only.
            const dust = fbm(inPlane.mul(3.4).add(vec2(31.7, 11.3)));
            const dustMask = smoothstep(0.40, 0.66, dust).mul(bandCore).mul(uMilkyDust);
            glow.mulAssign(float(1.0).sub(dustMask.mul(0.8)));

            // Fine mottling last, so it breaks up the dust edges too
            glow.mulAssign(fine.mul(0.55).add(0.72));

            // ---- Galactic core ----
            // One brighter, warmer swelling along the band. Without it the band is uniform
            // and reads as procedural.
            const coreDir = normalize(vec3(0.78, 0.30, 0.55));
            const coreProx = pow(clamp(dot(dir, coreDir), 0.0, 1.0), 6.0);
            const coreGlow = coreProx.mul(bandWide).mul(2.6);

            // Colour: cool blue-white arms, warm core. A single flat tint is the main reason
            // the old band looked like fog.
            const armCol = uMilkyArmColor;
            const coreCol = uMilkyCoreColor;
            const milkyCol = mix(armCol, coreCol, clamp(coreProx.mul(1.3), 0.0, 1.0));

            const starHorizonFade = smoothstep(-0.02, 0.30, dir.y);
            const milkyWay = glow.add(coreGlow).mul(starHorizonFade).mul(uMilkyWay).mul(milkyCol);

            // ---- Stars ----
            // Density is boosted inside the band: the real Milky Way is dense with stars, and
            // this is what visually ties the glow to the star field instead of layering an
            // unrelated fog over it.
            const bandStarBoost = float(1.0).add(bandWide.mul(2.5).mul(uMilkyWay));
            const densCoarse = clamp(uStarDensity.mul(bandStarBoost), 0.0, 0.6);
            const densFine = clamp(uStarDensity.mul(0.7).mul(bandStarBoost), 0.0, 0.6);

            const starsCoarse = starLayer(dir, uTime, densCoarse, uStarTwinkle, float(140.0));
            const starsFine = starLayer(dir, uTime, densFine, uStarTwinkle.mul(0.6), float(340.0)).mul(0.45);
            const starTotal = starsCoarse.add(starsFine).mul(starHorizonFade).mul(uStarBrightness);

            // Stars sitting inside the band pick up a touch of its colour
            const starTint = mix(vec3(0.86, 0.91, 1.0), milkyCol.mul(1.6).add(0.55), bandWide.mul(0.5));
            const starColor = starTint.mul(starTotal);

            nightSky.assign(uNightColor.mul(uNightSkyLift).add(starColor).add(milkyWay));
        });

        // Composite atmospheric sky
        let sky = baseAtmosphere.add(sunCorona).add(sunHaze).add(sunDisc).add(duskGlow);
        sky = mix(sky, nightSky, uNightFactor);

        // Storm darkening for base sky
        sky = mix(sky, vec3(0.12, 0.14, 0.18), uStormDarken);

        // ==========================================
        // PROCEDURAL CLOUDS LAYER (TSL)
        // ==========================================
        // Upper hemisphere dome projection
        const skyDomeDist = float(1.0).div(max(dir.y.add(0.15), float(0.08)));
        const cloudUV = dir.xz.mul(skyDomeDist).mul(0.45);

        // Wind drift & movement + initial offset
        const windOffset = vec2(uTime.mul(uCloudSpeed).mul(0.15), uTime.mul(uCloudSpeed).mul(0.08));
        const uvSample = cloudUV.add(windOffset).add(vec2(14.8, 32.4));

        // Billowy Anime / Ghibli FBM Cloud Density with Domain Warping
        const q = vec2(fbm(uvSample), fbm(uvSample.add(vec2(5.2, 1.3))));
        const warpedUV = uvSample.add(q.mul(0.8).add(q.mul(uCloudTurbulence)));
        const cloudNoise = fbm(warpedUV);

        // Biome Coverage & Soft Edge Thresholding
        const lowThreshold = float(1.0).sub(uCloudCoverage);
        const highThreshold = lowThreshold.add(max(uCloudEdge, float(0.02)));
        const cloudAlpha = smoothstep(lowThreshold, highThreshold, cloudNoise);

        // Solar Clearance Corridor: smoothly part/clear clouds directly in front of the sun
        // so sunlight and volumetric god rays are never blocked at start or during flight.
        const sunProximity = clamp(sunDot, 0.0, 1.0);
        const sunClearMask = float(1.0).sub(smoothstep(float(0.82), float(0.995), sunProximity).mul(0.94));

        // Horizon fade so clouds blend cleanly above the horizon
        const horizonFade = smoothstep(0.02, 0.22, dir.y);
        const finalAlpha = cloudAlpha.mul(horizonFade).mul(sunClearMask).mul(uCloudOpacity);

        // Cloud Lighting & Rim / Silver Lining
        const sunDiffuse = clamp(sunDot.mul(0.5).add(0.5), 0.0, 1.0);
        const silverLining = pow(clamp(sunDot, 0.0, 1.0), 4.0).mul(0.4);

        // Base cloud color with directional shading
        const dayCloudCol = mix(uCloudShadowColor, uCloudColor, sunDiffuse.add(silverLining));

        // Sunset & Dusk tinting
        const sunsetCloudCol = mix(dayCloudCol, vec3(1.0, 0.6, 0.45), uDuskFactor.mul(0.7));

        // Night sky darkening
        const nightCloudCol = mix(sunsetCloudCol, vec3(0.04, 0.05, 0.1), uNightFactor.mul(0.85));

        // Storm darkening
        const finalCloudCol = mix(nightCloudCol, vec3(0.1, 0.12, 0.15), uStormDarken.mul(0.8));

        // Composite procedural clouds over sky
        const cloudContribution = finalAlpha.mul(uEnableProceduralClouds);
        const compositeSky = mix(sky, finalCloudCol, cloudContribution);

        return vec4(compositeSky, 1.0);
    })();

    const geometry = new THREE.SphereGeometry(20000, 64, 32);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = -1000;
    mesh.frustumCulled = false;

    return {
        mesh,
        material,
        uniforms: {
            uTime, uSunPosition, uSkyColorZenith, uSkyColorMid, uSkyColorHorizon, uSunColor,
            uGradientPower, uGradientMidOffset, uGradientSkyEnabled, uSunCoronaIntensity, uHorizonGlow,
            uCloudColor, uCloudShadowColor, uCloudCoverage, uCloudEdge, uCloudSpeed,
            uCloudTurbulence, uCloudOpacity, uStormDarken, uNightFactor, uDuskFactor, uEnableProceduralClouds,
            uStarDensity, uStarBrightness, uStarTwinkle, uMilkyWay, uNightSkyLift, uNightColor,
            uMilkyDust, uMilkyArmColor, uMilkyCoreColor, uMoonCoronaIntensity
        }
    };
}
