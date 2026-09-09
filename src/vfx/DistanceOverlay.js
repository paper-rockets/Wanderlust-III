import * as THREE from 'three';

const DISTANCE_RADII = [100, 200, 300, 400, 500, 600, 1000];

export class DistanceOverlay {
    constructor({ scene, camera, config = {} }) {
        this.scene = scene;
        this.camera = camera;
        
        this.distances = DISTANCE_RADII;
        this.visible = config.visible !== undefined ? config.visible : false;
        this.opacity = config.opacity !== undefined ? config.opacity : 0.28;
        this.colorHex = config.color || '#00e5ff';
        this.showLabels = config.showLabels !== undefined ? config.showLabels : true;
        this.showGroundDropline = config.showGroundDropline !== undefined ? config.showGroundDropline : true;
        this.mode = config.mode || 'Horizontal Level'; // 'Horizontal Level' | 'Flight Pitch/Roll' | 'World Fixed'
        
        this.root = new THREE.Group();
        this.root.name = 'DistanceOverlayRoot';
        this.root.visible = this.visible;
        
        this.ringsGroup = new THREE.Group();
        this.labelsGroup = new THREE.Group();
        this.axesGroup = new THREE.Group();
        this.reticleGroup = new THREE.Group();
        this.groundGroup = new THREE.Group();
        
        this.root.add(this.ringsGroup);
        this.root.add(this.axesGroup);
        this.root.add(this.reticleGroup);
        this.root.add(this.labelsGroup);
        this.root.add(this.groundGroup);
        
        this.materials = [];
        this.labelSprites = [];
        
        this._initMaterials();
        this._buildReticle();
        this._buildRings();
        this._buildAxes();
        this._buildLabels();
        this._buildGroundDropline();
        
        this.scene.add(this.root);
    }
    
    _initMaterials() {
        const color = new THREE.Color(this.colorHex);
        
        // Regular distance ring material (very discreet, subtle)
        this.ringMaterial = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: this.opacity,
            depthWrite: false,
            depthTest: true
        });
        this.materials.push(this.ringMaterial);
        
        // Major milestone ring material (500m, 1000m)
        this.majorRingMaterial = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: Math.min(1.0, this.opacity * 1.4),
            depthWrite: false,
            depthTest: true
        });
        this.materials.push(this.majorRingMaterial);
        
        // Cardinal crosshair & tick marks material
        this.axisMaterial = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: this.opacity * 0.7,
            depthWrite: false,
            depthTest: true
        });
        this.materials.push(this.axisMaterial);
        
        // Fine diagonal ticks / inner reticle
        this.fineMaterial = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: this.opacity * 0.45,
            depthWrite: false,
            depthTest: true
        });
        this.materials.push(this.fineMaterial);
        
        // Ground altitude dropline material
        this.groundMaterial = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: this.opacity * 0.5,
            depthWrite: false,
            depthTest: true
        });
        this.materials.push(this.groundMaterial);
    }
    
    _buildReticle() {
        // Subtle close-range reticle centered at the aircraft (15m cross + 25m circle)
        const segs = 64;
        const innerCirclePoints = [];
        for (let i = 0; i <= segs; i++) {
            const th = (i / segs) * Math.PI * 2;
            innerCirclePoints.push(new THREE.Vector3(Math.cos(th) * 25, 0, Math.sin(th) * 25));
        }
        const innerCircleGeo = new THREE.BufferGeometry().setFromPoints(innerCirclePoints);
        const innerLine = new THREE.LineLoop(innerCircleGeo, this.fineMaterial);
        this.reticleGroup.add(innerLine);
        
        // 50m secondary ring
        const midCirclePoints = [];
        for (let i = 0; i <= segs; i++) {
            const th = (i / segs) * Math.PI * 2;
            midCirclePoints.push(new THREE.Vector3(Math.cos(th) * 50, 0, Math.sin(th) * 50));
        }
        const midCircleGeo = new THREE.BufferGeometry().setFromPoints(midCirclePoints);
        const midLine = new THREE.LineLoop(midCircleGeo, this.fineMaterial);
        this.reticleGroup.add(midLine);
    }
    
    _buildRings() {
        const segments = 144;
        
        this.distances.forEach((radius) => {
            const points = [];
            for (let i = 0; i <= segments; i++) {
                const theta = (i / segments) * Math.PI * 2;
                points.push(new THREE.Vector3(
                    Math.cos(theta) * radius,
                    0,
                    Math.sin(theta) * radius
                ));
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const isMajor = (radius === 500 || radius === 1000);
            const line = new THREE.LineLoop(geometry, isMajor ? this.majorRingMaterial : this.ringMaterial);
            line.userData = { radius, isMajor };
            this.ringsGroup.add(line);
            
            // Double-ring detail for major milestones (500m & 1000m)
            if (isMajor) {
                const offsetR = radius === 1000 ? 1008 : 505;
                const doublePoints = [];
                for (let i = 0; i <= segments; i++) {
                    const theta = (i / segments) * Math.PI * 2;
                    doublePoints.push(new THREE.Vector3(
                        Math.cos(theta) * offsetR,
                        0,
                        Math.sin(theta) * offsetR
                    ));
                }
                const doubleGeo = new THREE.BufferGeometry().setFromPoints(doublePoints);
                const doubleLine = new THREE.LineLoop(doubleGeo, this.fineMaterial);
                this.ringsGroup.add(doubleLine);
            }
        });
    }
    
    _buildAxes() {
        const maxRadius = 1000;
        const axisPoints = [];
        const finePoints = [];
        
        // 4 Main Cardinal Axes: Forward (-Z), Aft (+Z), Left (-X), Right (+X)
        axisPoints.push(new THREE.Vector3(0, 0, -25), new THREE.Vector3(0, 0, -maxRadius));
        axisPoints.push(new THREE.Vector3(0, 0, 25), new THREE.Vector3(0, 0, maxRadius));
        axisPoints.push(new THREE.Vector3(-25, 0, 0), new THREE.Vector3(-maxRadius, 0, 0));
        axisPoints.push(new THREE.Vector3(25, 0, 0), new THREE.Vector3(maxRadius, 0, 0));
        
        // 4 Diagonal 45-degree guideline notches (extending to 1000m)
        const diagDist = maxRadius;
        const diag45 = diagDist * Math.SQRT1_2;
        finePoints.push(new THREE.Vector3(-diag45, 0, -diag45), new THREE.Vector3(diag45, 0, diag45));
        finePoints.push(new THREE.Vector3(diag45, 0, -diag45), new THREE.Vector3(-diag45, 0, diag45));
        
        // Ticks at every 100m interval across the 4 cardinal axes
        this.distances.forEach((r) => {
            const isMajor = (r === 500 || r === 1000);
            const tickSize = isMajor ? Math.max(3.5, r * 0.012) : Math.max(2.0, r * 0.008);
            
            // Forward (-Z)
            axisPoints.push(new THREE.Vector3(-tickSize, 0, -r), new THREE.Vector3(tickSize, 0, -r));
            // Aft (+Z)
            axisPoints.push(new THREE.Vector3(-tickSize, 0, r), new THREE.Vector3(tickSize, 0, r));
            // Left (-X)
            axisPoints.push(new THREE.Vector3(-r, 0, -tickSize), new THREE.Vector3(-r, 0, tickSize));
            // Right (+X)
            axisPoints.push(new THREE.Vector3(r, 0, -tickSize), new THREE.Vector3(r, 0, tickSize));
        });
        
        const axisGeo = new THREE.BufferGeometry().setFromPoints(axisPoints);
        const axesLines = new THREE.LineSegments(axisGeo, this.axisMaterial);
        this.axesGroup.add(axesLines);
        
        const fineGeo = new THREE.BufferGeometry().setFromPoints(finePoints);
        const fineLines = new THREE.LineSegments(fineGeo, this.fineMaterial);
        this.axesGroup.add(fineLines);
    }
    
    _createSleekLabelSprite(text, radius) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // High-contrast clean typography without heavy dark billboard boxes
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        // Soft dark shadow for contrast against bright clouds and sky
        ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.strokeText(text, 12, 32);
        
        // Clean high-tech glowing text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, 12, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        
        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: Math.min(1.0, this.opacity * 1.3),
            depthWrite: false,
            depthTest: false
        });
        this.materials.push(spriteMat);
        
        const sprite = new THREE.Sprite(spriteMat);
        // Discreet, subtle scale: tightly clamped to prevent giant billboard clutter
        const s = Math.min(8.0, Math.max(2.2, radius * 0.012));
        sprite.scale.set(s * 4.0, s, 1.0);
        sprite.userData = { radius, baseScaleFactor: s, spriteMat, texture };
        
        return sprite;
    }
    
    _buildLabels() {
        // Place distance labels along an offset radial (+30 degrees Starboard Forward)
        // so they NEVER block the forward flight path or the chase camera view!
        const angleRad = (30 * Math.PI) / 180;
        const sinA = Math.sin(angleRad);
        const cosA = Math.cos(angleRad);
        
        this.distances.forEach((radius) => {
            const label = this._createSleekLabelSprite(`${radius}m`, radius);
            if (label) {
                // Position along 30° radial
                const posX = sinA * radius;
                const posZ = -cosA * radius;
                label.position.set(posX, 0, posZ);
                this.labelsGroup.add(label);
                this.labelSprites.push(label);
            }
        });
        
        this.labelsGroup.visible = this.showLabels;
    }
    
    _buildGroundDropline() {
        // Vertical ground dropline line geometry (updated dynamically in update())
        const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -100, 0)];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        this.groundLine = new THREE.Line(lineGeo, this.groundMaterial);
        this.groundGroup.add(this.groundLine);
        
        // Ground contact small ring (10m radius)
        const segs = 32;
        const groundRingPoints = [];
        for (let i = 0; i <= segs; i++) {
            const th = (i / segs) * Math.PI * 2;
            groundRingPoints.push(new THREE.Vector3(Math.cos(th) * 10, 0, Math.sin(th) * 10));
        }
        const groundRingGeo = new THREE.BufferGeometry().setFromPoints(groundRingPoints);
        this.groundRing = new THREE.LineLoop(groundRingGeo, this.groundMaterial);
        this.groundGroup.add(this.groundRing);
        
        this.groundGroup.visible = this.showGroundDropline;
    }
    
    update(playerPosition, playerYaw = 0, playerQuaternion = null, groundAltitude = 0) {
        if (!this.visible || !playerPosition) return;
        
        // Position root overlay group at player's position
        this.root.position.copy(playerPosition);
        
        // Orientation handling
        if (this.mode === 'Horizontal Level') {
            // Level with world horizon, tracking yaw heading
            this.root.rotation.set(0, playerYaw, 0);
        } else if (this.mode === 'Flight Pitch/Roll' && playerQuaternion) {
            // Fully aligned with airplane's local pitch, roll, and yaw
            this.root.quaternion.copy(playerQuaternion);
        } else if (this.mode === 'World Fixed') {
            // Fixed to cardinal world axes
            this.root.rotation.set(0, 0, 0);
        }
        
        // Update Ground Altitude Dropline if enabled
        if (this.showGroundDropline && this.groundLine && this.groundRing) {
            const heightAboveGround = playerPosition.y - groundAltitude;
            if (heightAboveGround > 0) {
                this.groundLine.visible = true;
                this.groundRing.visible = true;
                
                // In 'Horizontal Level' mode, -Y is straight down in local space
                const dropY = -heightAboveGround;
                const posArr = this.groundLine.geometry.attributes.position.array;
                posArr[3] = 0;
                posArr[4] = dropY;
                posArr[5] = 0;
                this.groundLine.geometry.attributes.position.needsUpdate = true;
                
                this.groundRing.position.set(0, dropY, 0);
            } else {
                this.groundLine.visible = false;
                this.groundRing.visible = false;
            }
        }
    }
    
    setVisible(visible) {
        this.visible = !!visible;
        this.root.visible = this.visible;
    }
    
    toggle() {
        this.setVisible(!this.visible);
        return this.visible;
    }
    
    setOpacity(opacity) {
        this.opacity = Math.max(0.01, Math.min(1.0, opacity));
        if (this.ringMaterial) this.ringMaterial.opacity = this.opacity;
        if (this.majorRingMaterial) this.majorRingMaterial.opacity = Math.min(1.0, this.opacity * 1.4);
        if (this.axisMaterial) this.axisMaterial.opacity = this.opacity * 0.7;
        if (this.fineMaterial) this.fineMaterial.opacity = this.opacity * 0.45;
        if (this.groundMaterial) this.groundMaterial.opacity = this.opacity * 0.5;
        
        this.labelSprites.forEach((s) => {
            if (s.userData.spriteMat) {
                s.userData.spriteMat.opacity = Math.min(1.0, this.opacity * 1.3);
            }
        });
    }
    
    setColor(colorHex) {
        this.colorHex = colorHex;
        const color = new THREE.Color(colorHex);
        if (this.ringMaterial) this.ringMaterial.color.copy(color);
        if (this.majorRingMaterial) this.majorRingMaterial.color.copy(color);
        if (this.axisMaterial) this.axisMaterial.color.copy(color);
        if (this.fineMaterial) this.fineMaterial.color.copy(color);
        if (this.groundMaterial) this.groundMaterial.color.copy(color);
        
        this._rebuildLabels();
    }
    
    setShowLabels(show) {
        this.showLabels = !!show;
        this.labelsGroup.visible = this.showLabels;
    }
    
    setShowGroundDropline(show) {
        this.showGroundDropline = !!show;
        this.groundGroup.visible = this.showGroundDropline;
    }
    
    setOrientationMode(mode) {
        this.mode = mode;
    }
    
    _rebuildLabels() {
        while (this.labelsGroup.children.length > 0) {
            const child = this.labelsGroup.children[0];
            this.labelsGroup.remove(child);
            if (child.userData && child.userData.texture) child.userData.texture.dispose();
            if (child.userData && child.userData.spriteMat) child.userData.spriteMat.dispose();
        }
        this.labelSprites = [];
        this._buildLabels();
    }
    
    dispose() {
        if (this.root && this.root.parent) {
            this.root.parent.remove(this.root);
        }
        
        this.materials.forEach((mat) => mat.dispose());
        this.materials = [];
        
        this.ringsGroup.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
        });
        
        this.axesGroup.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
        });
        
        this.reticleGroup.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
        });
        
        this.groundGroup.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
        });
        
        this.labelsGroup.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.userData && obj.userData.texture) obj.userData.texture.dispose();
            if (obj.userData && obj.userData.spriteMat) obj.userData.spriteMat.dispose();
        });
    }
}
