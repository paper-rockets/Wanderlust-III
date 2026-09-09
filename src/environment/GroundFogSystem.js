import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
    uniform, float, vec2, vec3, mix, fract, sin, dot,
    smoothstep as tslSmoothstep, max, clamp, pow, abs, normalize, Fn,
    positionWorld, cameraPosition
} from 'three/tsl';

export class GroundFogSystem {
    constructor({ scene }) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.geo = new THREE.PlaneGeometry(5500, 5500);
        this.geo.rotateX(-Math.PI / 2);

        this.uniforms = {
            uTime: uniform(0),
            uFogIntensity: uniform(1.20),
            uFogOpacity: uniform(0.85),
            uFogDrift: uniform(1.0),
            uFogTurbulence: uniform(1.0),
            uFogNear: uniform(10.0),
            uFogFar: uniform(2200.0),
            uInversionCeiling: uniform(140.0),
            uCeilingFalloff: uniform(45.0),
            uBillowScale: uniform(0.0020),
            uDetailScale: uniform(0.0065),
            uSunDirection: uniform(new THREE.Vector3(0.5, 0.7, 0.4).normalize()),
            uSunColor: uniform(new THREE.Color(0xfffaeb)),
            uMieIntensity: uniform(1.30),
            uSunGlow: uniform(1.20),
            uBaseColor: uniform(new THREE.Color(0xe2e8f0)),
            uSunHighlightColor: uniform(new THREE.Color(0xfef3c7))
        };

        const hash = Fn(([p]) => {
            const pMod = fract(p.div(256.0)).mul(256.0);
            const d = vec2(
                dot(pMod, vec2(127.1, 311.7)),
                dot(pMod, vec2(269.5, 183.3))
            );
            return fract(sin(d).mul(float(43758.5453123)));
        });

        const vnoise = Fn(([p]) => {
            const i = p.floor();
            const f = p.fract();
            const u = f.mul(f).mul(f).mul(f.mul(f.mul(6.0).sub(15.0)).add(10.0));
            const a = hash(i);
            const b = hash(i.add(vec2(1.0, 0.0)));
            const c = hash(i.add(vec2(0.0, 1.0)));
            const d = hash(i.add(vec2(1.0, 1.0)));
            return mix(mix(a.x, b.x, u.x), mix(c.x, d.x, u.x), u.y);
        });

        const fbm = Fn(([p]) => {
            const n1 = vnoise(p);
            const n2 = vnoise(p.mul(2.04).add(vec2(5.2, 1.3)));
            const n3 = vnoise(p.mul(4.08).sub(vec2(2.1, 7.8)));
            const n4 = vnoise(p.mul(8.16).add(vec2(11.4, 3.7)));
            return n1.mul(0.50).add(n2.mul(0.28)).add(n3.mul(0.15)).add(n4.mul(0.07));
        });

        // Domain-warped billowy cloud density function
        const getFogAlphaFn = Fn(([
            wPos, camPos, uTime, uDrift, uTurb, uNear, uFar,
            uIntensity, uOpacity, uInversionCeil, uCeilFalloff,
            uBillowScale, uDetailScale, uSunDir, uMieIntensity
        ]) => {
            const t = uTime.mul(uDrift.mul(0.02));
            const pMacro = wPos.xz.mul(uBillowScale).add(vec2(t, t.mul(0.55)));
            
            // Domain warp for swirling organic cloud tendrils
            const warpX = fbm(pMacro.add(vec2(1.7, 9.2)));
            const warpY = fbm(pMacro.add(vec2(8.3, 2.8)));
            const warpedP = pMacro.add(vec2(warpX, warpY).mul(uTurb.mul(0.45)));

            // Multi-octave billow shaping (inverted ridge billows for puffy cloud tops)
            const rawBillow = fbm(warpedP);
            const billowShape = pow(rawBillow, float(1.4));

            // Fine micro turbulence
            const pMicro = wPos.xz.mul(uDetailScale).sub(vec2(t.mul(0.85), t.mul(-0.7)));
            const microWisps = vnoise(pMicro);

            // Combine billows with micro wisps
            const combinedDensity = billowShape.add(microWisps.mul(0.22));
            const cloudAlpha = tslSmoothstep(float(0.22), float(0.70), combinedDensity);

            // Inversion ceiling envelope (clouds fade at inversion ceiling altitude)
            const ceilDist = uInversionCeil.sub(wPos.y);
            const ceilingFade = tslSmoothstep(float(0.0), uCeilFalloff, ceilDist);

            // Camera near and far distances (soft horizon perimeter and near clip)
            const dist = wPos.xz.sub(camPos.xz).length();
            const edgeFade = float(1.0).sub(tslSmoothstep(uFar.mul(0.65), uFar, dist));
            const nearFade = tslSmoothstep(uNear, uNear.mul(3.0), dist);

            // Forward-scattering density boost when looking toward sun
            const viewDir = normalize(wPos.sub(camPos));
            const cosTheta = max(dot(viewDir, uSunDir), float(0.0));
            const forwardScatter = pow(cosTheta, float(3.0)).mul(uMieIntensity.mul(0.35));
            const densityBoost = float(1.0).add(forwardScatter);

            return cloudAlpha.mul(ceilingFade).mul(edgeFade).mul(nearFade).mul(uOpacity).mul(uIntensity).mul(densityBoost).mul(0.24);
        });

        const getFogColorFn = Fn(([
            wPos, camPos, uBaseColor, uSunHighlightColor, uSunDir, uSunColor, uMieIntensity, uSunGlow
        ]) => {
            const viewDir = normalize(wPos.sub(camPos));
            const cosTheta = max(dot(viewDir, uSunDir), float(0.0));
            
            // Forward scattering peak (glowing halo / silver lining when facing sun)
            const forwardPeak = pow(cosTheta, float(3.5)).mul(uMieIntensity);
            const rim = pow(float(1.0).sub(abs(cosTheta)), float(2.8)).mul(0.30);
            const scatterFactor = clamp(forwardPeak.add(rim).mul(uSunGlow), float(0.0), float(1.0));
            
            const highlight = mix(uSunHighlightColor, uSunColor, float(0.45));
            return mix(uBaseColor, highlight, scatterFactor);
        });

        this.mat = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            fog: false,
            side: THREE.DoubleSide
        });

        this.mat.colorNode = getFogColorFn(
            positionWorld,
            cameraPosition,
            this.uniforms.uBaseColor,
            this.uniforms.uSunHighlightColor,
            this.uniforms.uSunDirection,
            this.uniforms.uSunColor,
            this.uniforms.uMieIntensity,
            this.uniforms.uSunGlow
        );

        this.mat.opacityNode = getFogAlphaFn(
            positionWorld,
            cameraPosition,
            this.uniforms.uTime,
            this.uniforms.uFogDrift,
            this.uniforms.uFogTurbulence,
            this.uniforms.uFogNear,
            this.uniforms.uFogFar,
            this.uniforms.uFogIntensity,
            this.uniforms.uFogOpacity,
            this.uniforms.uInversionCeiling,
            this.uniforms.uCeilingFalloff,
            this.uniforms.uBillowScale,
            this.uniforms.uDetailScale,
            this.uniforms.uSunDirection,
            this.uniforms.uMieIntensity
        );

        // Volumetric multi-plane horizontal stacking (up to 8 slabs with staggered rotations)
        this.maxLayers = 8;
        this.layerCount = 5;
        this.planes = [];
        for (let i = 0; i < this.maxLayers; i++) {
            const p = new THREE.Mesh(this.geo, this.mat);
            p.position.y = 10 + i * 20;
            p.rotation.y = (i * Math.PI) / this.maxLayers;
            p.visible = i < this.layerCount;
            p.receiveShadow = false;
            this.group.add(p);
            this.planes.push(p);
        }
        
        // Active by default
        this.group.visible = true;

        if (scene) {
            scene.add(this.group);
        }

        if (typeof window !== 'undefined') {
            window.fogGroup = this.group;
            window.fogUniforms = this.uniforms;
            window.fogMat = this.mat;
            window.valleyFogSystem = this;
        }
    }

    setLayers(count, spacing) {
        this.layerCount = Math.max(1, Math.min(this.maxLayers, count || 5));
        const sp = spacing !== undefined ? spacing : 20;
        for (let i = 0; i < this.planes.length; i++) {
            this.planes[i].visible = i < this.layerCount;
            this.planes[i].position.y = 10 + i * sp;
        }
    }

    setLayerSpacing(spacing) {
        this.setLayers(this.layerCount, spacing);
    }

    update(time, playerPos, sunDir, sunColor) {
        this.uniforms.uTime.value = time;
        if (playerPos && this.group.visible) {
            this.group.position.x = playerPos.x;
            this.group.position.z = playerPos.z;
        }
        if (sunDir) {
            this.uniforms.uSunDirection.value.copy(sunDir).normalize();
        }
        if (sunColor) {
            this.uniforms.uSunColor.value.copy(sunColor);
        }
    }
}
