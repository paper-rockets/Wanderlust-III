import * as THREE from 'three';
import { LensflareMesh, LensflareElement } from 'three/examples/jsm/objects/LensflareMesh.js';

export function createLightingSystem({ scene }) {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfffaeb, 1.4);
    dirLight.position.set(150, 200, 50);
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    dirLight.shadow.camera.top = 120;
    dirLight.shadow.camera.bottom = -120;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.002;
    dirLight.shadow.normalBias = 1.5;
    scene.add(dirLight);

    // Sun Glare (Lensflare)
    const staticSun = new THREE.Group();
    staticSun.position.set(0, 1500, -20000);
    scene.add(staticSun);

    const flareTextureLoader = new THREE.TextureLoader();
    const textureFlare0 = flareTextureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/lensflare/lensflare0.png');
    const textureFlare3 = flareTextureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/lensflare/lensflare3.png');
    const lensflare = new LensflareMesh();
    lensflare.addElement(new LensflareElement(textureFlare0, 1600, 0, dirLight.color));
    lensflare.addElement(new LensflareElement(textureFlare3, 60, 0.6));
    lensflare.addElement(new LensflareElement(textureFlare3, 70, 0.7));
    lensflare.addElement(new LensflareElement(textureFlare3, 120, 0.9));
    lensflare.addElement(new LensflareElement(textureFlare3, 70, 1.0));
    staticSun.add(lensflare);

    // Physical Sun Sphere
    const sunGeo = new THREE.SphereGeometry(600, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    staticSun.add(sunMesh);

    const tempVecToLight = new THREE.Vector3();

    return {
        ambientLight,
        dirLight,
        staticSun,
        sunMesh,
        lensflare,
        tempVecToLight
    };
}

export function updateLightingPosition({
    lightingSystem,
    playerPos,
    timePhase,
    staticMoon
}) {
    if (!lightingSystem || !playerPos) return;
    const { dirLight, staticSun, tempVecToLight } = lightingSystem;

    const activeLightTarget = (timePhase === 2 && staticMoon) ? staticMoon : staticSun;
    tempVecToLight.copy(activeLightTarget.position).sub(playerPos).normalize();
    dirLight.position.copy(playerPos).addScaledVector(tempVecToLight, 2000);
    dirLight.target.position.copy(playerPos);
    dirLight.target.updateMatrixWorld();
}
