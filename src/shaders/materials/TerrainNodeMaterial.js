import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
    Fn, vec2, vec3, vec4, float, sin, cos, dot, mix, clamp, pow, length,
    positionWorld, normalWorld, smoothstep as tslSmoothstep,
    floor, fract, uniform, cameraPosition, normalize, reflect, step, texture,
    vertexColor, sqrt, max, min, If
} from 'three/tsl';

// 1. ISOTROPIC PROCEDURAL NOISE (TSL Implementation from 001)
const hash2D = Fn(([p]) => {
    const pMod = fract(p.div(256.0)).mul(256.0);
    const d = vec2(
        dot(pMod, vec2(127.1, 311.7)),
        dot(pMod, vec2(269.5, 183.3))
    );
    return fract(sin(d).mul(float(43758.5453123)));
});

const vnoise2D = Fn(([p]) => {
    const i = floor(p);
    const f = fract(p);
    // Quintic smooth Hermite interpolation for C2 continuity
    const u = f.mul(f).mul(f).mul(f.mul(f.mul(6.0).sub(15.0)).add(10.0));

    const a = hash2D(i);
    const b = hash2D(i.add(vec2(1.0, 0.0)));
    const c = hash2D(i.add(vec2(0.0, 1.0)));
    const d = hash2D(i.add(vec2(1.0, 1.0)));

    return mix(mix(a.x, b.x, u.x), mix(c.x, d.x, u.x), u.y);
});

const fbm2D = Fn(([p]) => {
    const n1 = vnoise2D(p);
    const n2 = vnoise2D(p.mul(2.13).add(vec2(17.2, 34.5)));
    const n3 = vnoise2D(p.mul(4.67).add(vec2(43.8, 81.1)));
    return n1.mul(0.55).add(n2.mul(0.30)).add(n3.mul(0.15));
});

// 2. HIGH-ALTITUDE PROCEDURAL TREE CANOPY
// Cellular / Voronoi individual tree crown structure with volumetric lighting,
// shadow crevices, species tints, and multi-scale forest clustering
const evalTreeCanopy = Fn(([p, norm, sunDir, viewDir, camDist, camAlt, uCanopyDensity, uCanopyScale]) => {
    const densityMult = uCanopyDensity || float(1.0);
    const scaleMult = uCanopyScale || float(1.0);

    // Multi-Scale Forest Clustering:
    // 1. Large-scale forest extent (masses and broad clearings, ~350m wavelength)
    const pLarge = p.xz.mul(0.0029);
    const nLarge1 = vnoise2D(pLarge);
    const nLarge2 = vnoise2D(pLarge.mul(2.19).add(vec2(37.4, 71.8)));
    const forestMass = nLarge1.mul(0.62).add(nLarge2.mul(0.38));

    // 2. Medium-scale clusters / groves & local density variation (~55m wavelength)
    // Domain rotation (37 deg) eliminates grid axis alignment
    const rotXZ = vec2(
        p.xz.x.mul(0.7986).sub(p.xz.y.mul(0.6018)),
        p.xz.x.mul(0.6018).add(p.xz.y.mul(0.7986))
    );
    const pMed = rotXZ.mul(0.0182);
    const nMed1 = vnoise2D(pMed);
    const nMed2 = vnoise2D(pMed.mul(2.35).add(vec2(19.3, 48.7)));
    const groveNoise = nMed1.mul(0.65).add(nMed2.mul(0.35));

    // Combined multi-scale forest density
    const rawDensity = forestMass.mul(0.62).add(groveNoise.mul(0.38));
    const forestDensity = tslSmoothstep(float(0.30), float(0.64), rawDensity).mul(densityMult);

    // 3. Tree-scale crowns via Cellular / Voronoi structure
    // Subtle view-dependent parallax offset gives depth to canopy above terrain floor
    const viewParallax = viewDir.xz.mul(0.85);
    const pCanopy = p.xz.add(viewParallax);

    // Domain warp to break circular uniformity into organic, leafy boundaries
    const warp = vec2(
        sin(pCanopy.y.mul(0.082)).add(cos(pCanopy.x.mul(0.054))),
        cos(pCanopy.x.mul(0.076)).sub(sin(pCanopy.y.mul(0.061)))
    ).mul(1.6);
    const warpedP = pCanopy.add(warp);

    // Grid coordinates: average conifer diameter ~8 meters
    const cellUV = warpedP.mul(float(0.125).mul(scaleMult));
    const cellI = floor(cellUV);
    const cellF = fract(cellUV);

    const minDist = float(99.0).toVar();
    const minDist2 = float(99.0).toVar();
    const bestHash = vec2(0.0, 0.0).toVar();
    const bestDiff = vec2(0.0, 0.0).toVar();

    // Unrolled 3x3 neighborhood search for zero-branching GPU instruction scheduling
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const neighbor = vec2(float(dx), float(dy));
            const neighborCell = cellI.add(neighbor);
            const h = hash2D(neighborCell);
            // Jitter tree center organically within cell: [0.16, 0.84]
            const treeCenter = neighbor.add(h.mul(0.68).add(0.16));
            const diff = treeCenter.sub(cellF);
            const d = length(diff);

            If(d.lessThan(minDist), () => {
                minDist2.assign(minDist);
                minDist.assign(d);
                bestHash.assign(h);
                bestDiff.assign(diff);
            }).Else(() => {
                If(d.lessThan(minDist2), () => {
                    minDist2.assign(d);
                });
            });
        }
    }

    // Individual Crown Geometry & Radius Modulation
    // Trees vary organically: some smaller saplings (6m), some large mature pines (10m)
    const clusterSizeMod = groveNoise.mul(0.10);
    const crownRadius = float(0.36).add(bestHash.x.mul(0.20)).add(clusterSizeMod);

    // High-frequency micro-foliage perturbation along crown boundaries (leaves / needle clumps)
    const microJitter = sin(cellUV.x.mul(5.4).add(cellUV.y.mul(4.2))).mul(0.065);
    const distRel = minDist.div(crownRadius).add(microJitter);

    // Crown 3D Dome profile (mathematical hemisphere profile)
    const crownDome = sqrt(clamp(float(1.0).sub(distRel.mul(distRel)), 0.0, 1.0));

    // Analytical Crown Normal (pointing outward from crown apex)
    const crownNormXZ = bestDiff.div(crownRadius).negate().mul(1.5);
    const crownNormal = normalize(vec3(crownNormXZ.x, float(1.0), crownNormXZ.y));

    // Directional Sun Lighting on crown dome
    const crownNdotL = clamp(dot(crownNormal, sunDir), 0.0, 1.0);

    // Inter-crown shadow crevice (deep ambient occlusion in the dark gaps between trees)
    const creviceDist = minDist2.sub(minDist);
    const creviceShadow = tslSmoothstep(float(0.04), float(0.28), creviceDist);
    const interCrownShadow = creviceShadow.mul(0.70).add(0.30);

    // Authentic Restrained Forest Palette (Rich Evergreen Conifer)
    const colDeepInterior = vec3(0.024, 0.080, 0.038); // Deep dark spruce shadow (#06140a)
    const colSpruce       = vec3(0.045, 0.150, 0.080); // Cool mountain spruce (#0c2614)
    const colMidPine      = vec3(0.085, 0.260, 0.115); // Highland evergreen pine (#16421d)
    const colWarmPine     = vec3(0.145, 0.330, 0.095); // Golden mountain pine (#255418)
    const colSunlitCrown  = vec3(0.220, 0.440, 0.135); // Sun-kissed highland pine (#387022)
    const colGoldenApex   = vec3(0.320, 0.540, 0.165); // Sunlit apex crest (#528a2a)

    // Per-tree species tint (cool spruce vs warm mountain pine)
    const speciesHash = bestHash.y;
    let speciesBase = mix(colSpruce, colWarmPine, speciesHash);
    speciesBase = mix(speciesBase, colMidPine, float(0.45));

    // Internal vertical dome gradient (darker lower branches to lighter upper crown)
    const skirtToApex = tslSmoothstep(float(0.0), float(0.92), crownDome);
    let canopyCol = mix(colDeepInterior, speciesBase, skirtToApex.mul(0.72).add(0.28));

    // Directional sunlit highlight on the sun-facing side
    const sunFactor = tslSmoothstep(float(0.30), float(0.92), crownNdotL);
    canopyCol = mix(canopyCol, colSunlitCrown, sunFactor.mul(0.60));

    // Sunlit golden apex highlight
    const apexFactor = tslSmoothstep(float(0.65), float(1.0), crownDome).mul(sunFactor);
    canopyCol = mix(canopyCol, colGoldenApex, apexFactor.mul(0.45));

    // Self-shadowing in crevices between crowns
    canopyCol = canopyCol.mul(interCrownShadow);

    // Soft sky ambient fill
    const skyBounce = clamp(crownNormal.y.mul(0.5).add(0.5), 0.0, 1.0).mul(vec3(0.015, 0.035, 0.05));
    canopyCol = canopyCol.add(skyBounce);

    // Crown Coverage: dense areas form continuous canopy, sparse areas show ground between crowns
    const crownMask = tslSmoothstep(float(1.08), float(0.78), distRel);
    const effCoverage = clamp(crownMask.mul(forestDensity.mul(1.4)), 0.0, 1.0);

    // High-Altitude LOD Band-Limiting (>1800m): smoothly soften tiny crevice detail to prevent aliasing
    const distantLod = clamp(camDist.sub(1800.0).div(2400.0), 0.0, 1.0);
    const broadColor = speciesBase.mul(crownNdotL.mul(0.35).add(0.65));
    canopyCol = mix(canopyCol, broadColor, distantLod.mul(0.65));

    // Return canopy color and effective coverage weight
    return vec4(canopyCol, effCoverage.mul(forestDensity));
});

export function createTerrainColorNode(
    waterLevelUniform,
    uTime,
    uSunDir,
    uSandNoiseMap,
    uShimmerMult,
    uWorldOriginZ,
    uGrassMottleIntensity,
    uGrassMottleScale,
    uGrassMossColor,
    uGrassDarkColor,
    uGrassAccentColor,
    uCanopyDensity,
    uCanopyScale
) {
    return Fn(() => {
        const p = positionWorld;
        const norm = normalize(normalWorld);
        // Use CPU-computed per-vertex biome colors (set by each biome's getColor())
        const baseColor = vertexColor();

        // 8. Sand & Snow Shimmer and Specular Highlights Shader
        const viewDir = normalize(cameraPosition.sub(p));
        const sunDirection = uSunDir ? normalize(uSunDir) : normalize(vec3(0.3, 0.8, 0.5));
        const halfDir = normalize(sunDirection.add(viewDir));
        const shimmerMult = uShimmerMult || float(1.0);

        // Distance-based glint attenuation (prevents high-frequency sparkle noise / grain on distant terrain)
        const camDist = length(cameraPosition.sub(p));
        const glintDistFade = clamp(float(1.0).sub(camDist.sub(40.0).div(200.0)), 0.0, 1.0);

        // Biome Masking - reconstruct true world Z by adding floating origin offset
        // Crystal Land: [42,000 - 65,000] (Crystal prism shimmer)
        // Misty Mountains: [100,000 - 125,000] & North Pole: [172,000 - 197,000] (Snow & ice shimmer)
        // Desert Dunes: [137,000 - 162,000] (Sand shimmer)
        const worldZ = p.z.add(uWorldOriginZ || float(0.0));
        const wz = fract(worldZ.div(float(215000.0))).mul(215000.0);
        const crystalMask = tslSmoothstep(float(40000.0), float(42000.0), wz).mul(tslSmoothstep(float(67000.0), float(65000.0), wz));
        const mtnMask = tslSmoothstep(float(98000.0), float(100000.0), wz).mul(tslSmoothstep(float(127000.0), float(125000.0), wz));
        const desertMask = tslSmoothstep(float(135000.0), float(137000.0), wz).mul(tslSmoothstep(float(164000.0), float(162000.0), wz));
        const northPoleMask = tslSmoothstep(float(170000.0), float(172000.0), wz).mul(tslSmoothstep(float(199000.0), float(197000.0), wz));
        const snowBiomeMask = clamp(northPoleMask.add(mtnMask), 0.0, 1.0);

        // Resolve noise texture
        const rawTex = (uSandNoiseMap && uSandNoiseMap.isTexture)
            ? uSandNoiseMap
            : (uSandNoiseMap && uSandNoiseMap.value && uSandNoiseMap.value.isTexture)
                ? uSandNoiseMap.value
                : (uSandNoiseMap && uSandNoiseMap._value && uSandNoiseMap._value.isTexture)
                    ? uSandNoiseMap._value
                    : null;

        // 1. Detect Sand / Warm Dune Surface (Restricted to Desert Dunes)
        const isSand = step(float(0.45), baseColor.r).mul(step(baseColor.b, baseColor.r.mul(0.95))).mul(desertMask);

        // Dune Rim Lighting (Fresnel glow along grazing angles and dune ridges)
        const NdotV = clamp(dot(norm, viewDir), 0.0, 1.0);
        const rim = float(1.0).sub(NdotV);
        const rimStrength = pow(rim, float(4.5)).mul(0.5);
        const rimGlow = vec3(1.0, 0.72, 0.38).mul(rimStrength);

        // Journey Sand Specular Glitter (Blinn-Phong Specular with distance fade)
        const NdotH = clamp(dot(norm, halfDir), 0.0, 1.0);
        const mainSpec = pow(NdotH, float(24.0)).mul(1.5);
        const sandNoiseVal = rawTex ? texture(rawTex, p.xz.mul(0.07)).r.mul(1.2) : vnoise2D(p.xz.mul(2.5)).mul(1.2);
        const textureGlitter = pow(clamp(sandNoiseVal, 0.0, 1.0), float(2.2)).mul(glintDistFade);
        const sandSpec = mainSpec.mul(textureGlitter);

        const rimSpec = pow(rim, float(2.8)).mul(textureGlitter).mul(1.5);
        const sandSpecColor = sandSpec.add(rimSpec).mul(vec3(1.0, 0.82, 0.55)).mul(shimmerMult);
        const sandEffects = rimGlow.add(sandSpecColor).mul(isSand);

        // 2. Detect Snow / Mountain Glacial Surface (Restricted to North Pole and Misty Mountains)
        const isSnow = step(float(0.60), baseColor.b).mul(step(float(0.50), baseColor.g)).mul(float(1.0).sub(isSand)).mul(snowBiomeMask);

        // Glacial Rim Lighting (Crisp sky-blue rim highlight)
        const snowRimStrength = pow(rim, float(4.0)).mul(0.35);
        const snowRimGlow = vec3(0.65, 0.85, 1.0).mul(snowRimStrength);

        // Diamond Snow & Ice Specular Glitter (Blinn-Phong Specular with distance fade)
        const mainSnowSpec = pow(NdotH, float(22.0)).mul(1.6);
        const snowNoiseVal = rawTex ? texture(rawTex, p.xz.mul(0.12)).r.mul(1.25) : vnoise2D(p.xz.mul(3.0)).mul(1.25);
        const snowGlitter = pow(clamp(snowNoiseVal, 0.0, 1.0), float(2.5)).mul(glintDistFade);
        const snowSpec = mainSnowSpec.mul(snowGlitter);

        const snowRimSpec = pow(rim, float(2.8)).mul(snowGlitter).mul(1.5);
        const snowSpecColor = snowSpec.add(snowRimSpec).mul(vec3(0.85, 0.95, 1.0)).mul(1.2).mul(shimmerMult);
        const snowEffects = snowRimGlow.add(snowSpecColor).mul(isSnow);

        // 3. Crystalline Prism & Gemstone Shimmer (Restricted to Crystal Land)
        // A. Iridescent Prism Fresnel Rim
        const crystalRimStrength = pow(rim, float(3.2)).mul(0.45);
        const prismShift = sin(p.x.mul(0.006).add(p.z.mul(0.006))).mul(0.5).add(0.5);
        const crystalRimColor = mix(vec3(0.65, 0.35, 1.0), vec3(0.2, 0.85, 1.0), prismShift);
        const crystalRimGlow = crystalRimColor.mul(crystalRimStrength);

        // B. Smooth Broad Specular Sheen (Clean, luminous crystal highlights without aliasing)
        const crystalSheen = pow(NdotH, float(28.0)).mul(0.75);
        const crystalSheenColor = crystalSheen.mul(mix(vec3(0.8, 0.65, 1.0), vec3(0.35, 0.85, 1.0), prismShift));

        // C. Subtle Micro-Glints (Sharp localized sparkles near camera only)
        const tightSpec = pow(NdotH, float(64.0)).mul(2.2);
        const crystalNoiseVal = rawTex ? texture(rawTex, p.xz.mul(0.08)).r : vnoise2D(p.xz.mul(2.0));
        const crystalGlitter = pow(clamp(crystalNoiseVal, 0.0, 1.0), float(3.0)).mul(glintDistFade);
        const crystalMicroGlint = tightSpec.mul(crystalGlitter).mul(vec3(0.95, 0.90, 1.0));

        const crystalEffects = crystalRimGlow.add(crystalSheenColor).add(crystalMicroGlint).mul(shimmerMult).mul(crystalMask);

        // 4. High-Frequency Painterly Grass Mottling (Protected: NEVER applies to sand dunes, snow, or crystals)
        const isGrass = step(float(0.12), baseColor.g)
            .mul(step(baseColor.r, baseColor.g.mul(1.25)))
            .mul(step(baseColor.b, baseColor.g.mul(1.15)))
            .mul(float(1.0).sub(isSand))
            .mul(float(1.0).sub(desertMask))
            .mul(float(1.0).sub(snowBiomeMask))
            .mul(float(1.0).sub(crystalMask));

        const mScale = uGrassMottleScale ? uGrassMottleScale : float(1.0);
        const mIntensity = uGrassMottleIntensity ? uGrassMottleIntensity : float(1.0);
        const mossCol = uGrassMossColor ? uGrassMossColor : vec3(0.48, 0.90, 0.05);
        const darkCol = uGrassDarkColor ? uGrassDarkColor : vec3(0.07, 0.33, 0.14);
        const accentCol = uGrassAccentColor ? uGrassAccentColor : vec3(0.64, 0.91, 0.22);

        // Multi-frequency noise sampling for painterly watercolor clumps and dappling
        const pMottle = p.xz.mul(mScale).mul(0.045);
        const gn1 = vnoise2D(pMottle);
        const gn2 = vnoise2D(pMottle.mul(2.65).add(vec2(gn1.mul(0.8), gn1.mul(0.5))));
        const gn3 = vnoise2D(pMottle.mul(6.8).add(vec2(34.2, 71.9)));
        const grassNoiseVal = gn1.mul(0.52).add(gn2.mul(0.33)).add(gn3.mul(0.15));

        // High-frequency watercolor mottling
        const mossMask = tslSmoothstep(float(0.46), float(0.76), grassNoiseVal);
        const darkMask = tslSmoothstep(float(0.44), float(0.16), grassNoiseVal);
        const accentMask = tslSmoothstep(float(0.66), float(0.90), grassNoiseVal);

        let mottledGrass = mix(baseColor.rgb, darkCol, darkMask.mul(0.65));
        mottledGrass = mix(mottledGrass, mossCol, mossMask.mul(0.80));
        mottledGrass = mix(mottledGrass, accentCol, accentMask.mul(0.55));

        // High-Altitude & Distance Procedural Tree Canopy Integration:
        // NEAR (<100m, low altitude): Real 3D tree instances dominate; terrain displays ground grass/moss.
        // MID (100m - 340m): Canopy blends seamlessly beneath trees as they transition to billboard impostors.
        // HIGH (>340m or high altitude flight): Full procedural canopy takes over, reading as dense forest.
        const camAlt = max(float(0.0), cameraPosition.y.sub(p.y));
        const distBlend = tslSmoothstep(float(90.0), float(320.0), camDist);
        const altBlend = tslSmoothstep(float(40.0), float(110.0), camAlt);
        const canopyRangeBlend = clamp(distBlend.add(altBlend), 0.0, 1.0);

        // Biome and terrain constraints:
        // Trees only grow on stable ground (slope < 55 deg), above sea level (> 4.5m), and below rocky alpine peaks (< 140m).
        const slopeTreeMask = tslSmoothstep(float(0.55), float(0.78), norm.y);
        const elevTreeMask = tslSmoothstep(float(4.5), float(8.0), p.y).mul(tslSmoothstep(float(140.0), float(90.0), p.y));
        const treeVegetationMask = isGrass.mul(slopeTreeMask).mul(elevTreeMask);

        // Procedural cellular tree canopy evaluation
        const canopyData = evalTreeCanopy(
            p,
            norm,
            sunDirection,
            viewDir,
            camDist,
            camAlt,
            uCanopyDensity,
            uCanopyScale
        );
        const canopyColor = canopyData.rgb;
        const canopyCoverage = canopyData.a;

        // Effective canopy blend weight
        const finalCanopyWeight = canopyCoverage.mul(treeVegetationMask).mul(canopyRangeBlend);

        // Blend between ground grass and tree canopy
        const terrainWithCanopy = mix(mottledGrass, canopyColor, finalCanopyWeight);
        const surfaceColor = mix(baseColor.rgb, terrainWithCanopy, isGrass.mul(mIntensity));

        return surfaceColor.add(sandEffects).add(snowEffects).add(crystalEffects);
    });
}

export const createTerrainMaterial = (
    uTime,
    uSunDir,
    uSandNoiseMap,
    uShimmerMult,
    uWorldOriginZ,
    uGrassMottleIntensity,
    uGrassMottleScale,
    uGrassMossColor,
    uGrassDarkColor,
    uGrassAccentColor,
    uCanopyDensity,
    uCanopyScale
) => {
    const terrainMat = new MeshStandardNodeMaterial({
        roughness: 0.82,
        metalness: 0.05
    });

    const waterLevelUniform = uniform(2.4);
    terrainMat.colorNode = createTerrainColorNode(
        waterLevelUniform,
        uTime,
        uSunDir,
        uSandNoiseMap,
        uShimmerMult,
        uWorldOriginZ,
        uGrassMottleIntensity,
        uGrassMottleScale,
        uGrassMossColor,
        uGrassDarkColor,
        uGrassAccentColor,
        uCanopyDensity,
        uCanopyScale
    )();

    return terrainMat;
};
