import * as THREE from 'three';
import { MeshToonNodeMaterial } from 'three/webgpu';
import { 
    Fn, vec2, vec3, vec4, float, sin, cos, dot, mix, clamp, pow, 
    reflect, normalize, positionWorld, positionLocal, positionGeometry, 
    normalWorld, cameraPosition, modelWorldMatrix, 
    attribute, max, min, smoothstep, fract, texture
} from 'three/tsl';
import { windSwayNode } from './WindSwayNode.js';

export const createTreeMaterial = (uTime, uSunDir, uTreeScale, gradientMap) => {
    const matTree = new MeshToonNodeMaterial({
        vertexColors: false,
        gradientMap: gradientMap,
        side: THREE.DoubleSide,
        dithering: true
    });

    const aIsBark = attribute('aIsBark', 'float');

    matTree.positionNode = windSwayNode(uTime, uTreeScale);

    matTree.colorNode = Fn(() => {
        // Local vertical height normalized to ~22m tree height
        const localY = clamp(positionLocal.y.div(22.0), 0.0, 1.0);
        // Radial distance from tree center trunk
        const radDist = clamp(positionLocal.xz.length().div(5.5), 0.0, 1.0);

        // Instance hash for per-tree natural color variation
        const globalPos = modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0));
        const instHash = fract(sin(globalPos.x.mul(12.9898).add(globalPos.z.mul(78.233))).mul(43758.5453));

        // Deep rich alpine pine palette (designed specifically for toon lighting so sun doesn't blow out into neon!)
        const colDeepShadow = vec3(0.025, 0.080, 0.038); // Deep dark spruce shadow (#06140a)
        const colMidPine    = vec3(0.055, 0.170, 0.075); // Rich evergreen mountain pine (#0e2b13)
        const colSunlitTip  = vec3(0.110, 0.290, 0.115); // Lush highland pine (#1c4a1d)
        const colGoldenCrest= vec3(0.180, 0.410, 0.160); // Warm sun-kissed alpine pine (#2e6929)

        // Blend along vertical height
        const leafGrad1 = mix(colDeepShadow, colMidPine, smoothstep(float(0.03), float(0.38), localY));
        const leafGrad2 = mix(leafGrad1, colSunlitTip, smoothstep(float(0.32), float(0.78), localY));
        
        // Add radial tip and crown highlight
        const tipHighlight = radDist.mul(0.25).add(smoothstep(float(0.70), float(1.0), localY).mul(0.35));
        const leafFinal = mix(leafGrad2, colGoldenCrest, tipHighlight);

        // Per-tree instance tint variation (subtle warm pine vs cool spruce tone)
        const tintWarm = vec3(1.08, 1.04, 0.90); // Warm sunlit pine
        const tintCool = vec3(0.90, 1.02, 1.10); // Cool spruce / alpine teal
        const instTint = mix(tintCool, tintWarm, instHash);
        const variedLeafColor = leafFinal.mul(instTint);

        // Rich cedar bark color gradient
        const colBarkBase = vec3(0.08, 0.045, 0.025); // Ground contact shadow (#140b06)
        const colBarkMid  = vec3(0.18, 0.105, 0.065); // Warm cedar trunk (#2e1b10)
        const colBarkHigh = vec3(0.28, 0.165, 0.105); // Upper sun-warmed bark (#472a1b)
        const barkGrad1 = mix(colBarkBase, colBarkMid, smoothstep(float(0.0), float(0.28), localY));
        const barkFinal = mix(barkGrad1, colBarkHigh, smoothstep(float(0.28), float(0.70), localY));

        return mix(variedLeafColor, barkFinal, aIsBark);
    })();

    matTree.emissiveNode = Fn(() => {
        const viewDir = normalize(cameraPosition.sub(positionWorld));
        const lightDir = normalize(uSunDir);
        const norm = normalize(normalWorld);

        // Subsurface scattering when looking toward the sun through needle canopy
        const backDot = clamp(dot(viewDir.negate(), lightDir), 0.0, 1.0);
        const foliageRim = pow(float(1.0).sub(clamp(dot(norm, viewDir), 0.0, 1.0)), 2.8);
        const sunSubsurface = pow(backDot, 3.2).mul(foliageRim.mul(1.2).add(0.15)).mul(vec3(0.08, 0.18, 0.04));
        
        // Soft atmospheric sky bounce on upward surfaces
        const skyBounce = clamp(norm.y.mul(0.5).add(0.5), 0.0, 1.0).mul(vec3(0.01, 0.025, 0.04));

        return sunSubsurface.add(skyBounce).mul(float(1.0).sub(aIsBark));
    })();

    return matTree;
};

export const createBillboardMaterial = (tex, uTime, uTreeScale) => {
    const billboardMat = new MeshToonNodeMaterial({
        map: tex,
        alphaTest: 0.25,
        side: THREE.DoubleSide,
        transparent: true
    });

    const texNode = texture(tex);
    billboardMat.alphaNode = texNode.a;
    billboardMat.opacityNode = texNode.a;

    billboardMat.positionNode = windSwayNode(uTime, uTreeScale);

    return billboardMat;
};
