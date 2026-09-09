import { getWorldHeight } from '../world/TerrainGenerator.js';
import { getContinentLabels } from '../world/BiomeManager.js';

let _mapEl = null;
let _mapCanvas = null;
let _mapCtx = null;
let _isMapExpanded = false;
let _mapZoomLevel = 1.0;
let _lastZoomState = 1.0;
let _lastExpandedState = false;
let _lastMapX = -999999;
let _lastMapZ = -999999;
let _mapBgCanvas = null;
let _mapBgCtx = null;

// Visible map bounds tracking for mouse coordinates translation
let _visWidth = 0;
let _visHeight = 0;
let _xStart = 0;
let _zStart = 0;

export function showVisualToast(msg, flightModelManager = null) {
    if (flightModelManager && typeof flightModelManager.showToast === 'function') {
        flightModelManager.showToast(msg);
        return;
    }
    let toast = document.getElementById('wl-visual-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'wl-visual-toast';
        toast.style.position = 'fixed';
        toast.style.bottom = '24px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.background = 'rgba(15, 23, 42, 0.9)';
        toast.style.color = '#fff';
        toast.style.padding = '8px 18px';
        toast.style.borderRadius = '20px';
        toast.style.fontFamily = 'system-ui, sans-serif';
        toast.style.fontSize = '13px';
        toast.style.zIndex = '99999';
        toast.style.pointerEvents = 'none';
        toast.style.transition = 'opacity 0.3s ease';
        document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        if (toast) toast.style.opacity = '0';
    }, 2200);
}

export function toggleFullscreen() {
    const doc = document;
    const docEl = document.documentElement;
    const isFullscreen = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
    if (!isFullscreen) {
        if (docEl.requestFullscreen) {
            docEl.requestFullscreen().catch(err => console.warn(`Error attempting to enable fullscreen: ${err.message}`));
        } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
            docEl.msRequestFullscreen();
        }
    } else {
        if (doc.exitFullscreen) {
            doc.exitFullscreen().catch(err => console.warn(`Error attempting to exit fullscreen: ${err.message}`));
        } else if (doc.webkitExitFullscreen) {
            doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
            doc.msExitFullscreen();
        }
    }
}

export function toggleMapExpand() {
    _isMapExpanded = !_isMapExpanded;
    _mapZoomLevel = 1.0; // Reset zoom to default on toggle
    _mapEl = document.getElementById('world-map');
    const mapTitle = document.getElementById('map-title-text');
    const expandBtn = document.getElementById('expand-map-btn');
    const backdrop = document.getElementById('map-backdrop');

    if (_mapEl) {
        if (_isMapExpanded) {
            _mapEl.style.width = 'min(85vw, 620px)';
            _mapEl.style.height = 'min(80vh, 680px)';
            _mapEl.style.left = '50%';
            _mapEl.style.top = '50%';
            _mapEl.style.bottom = 'auto';
            _mapEl.style.transform = 'translate(-50%, -50%)';
            _mapEl.style.zIndex = '15';
            _mapEl.style.display = 'flex';
            _mapEl.style.flexDirection = 'column';
            _mapEl.style.justifyContent = 'space-between';
            _mapEl.style.padding = '14px';
            
            if (backdrop) {
                backdrop.style.display = 'block';
                setTimeout(() => { backdrop.style.opacity = '1'; }, 10);
            }

            if (mapTitle) mapTitle.innerText = 'WORLD MAP';
            if (expandBtn) expandBtn.innerText = 'Shrink';
        } else {
            _mapEl.style.width = '210px';
            _mapEl.style.height = 'auto';
            _mapEl.style.left = '20px';
            _mapEl.style.bottom = '20px';
            _mapEl.style.top = 'auto';
            _mapEl.style.transform = 'none';
            _mapEl.style.display = 'block';
            _mapEl.style.padding = '10px';

            if (backdrop) {
                backdrop.style.opacity = '0';
                setTimeout(() => { backdrop.style.display = 'none'; }, 250);
            }

            if (mapTitle) mapTitle.innerText = 'MAP';
            if (expandBtn) expandBtn.innerText = 'Expand';
        }
    }
    _lastMapX = -999999;
}

let _worldLength = 215000;

export function initMapUI(options = {}) {
    const { playerGrp, getWorldHeight: optGetWorldHeight, WORLD_LENGTH = 215000, onTeleport } = options;
    _worldLength = WORLD_LENGTH;
    _mapEl = document.getElementById('world-map');
    _mapCanvas = document.getElementById('map-canvas');

    if (_mapCanvas) {
        _mapCtx = _mapCanvas.getContext('2d');
        _mapCanvas.style.cursor = 'crosshair';
        _mapCanvas.addEventListener('click', (e) => {
            if (_visWidth <= 0 || _visHeight <= 0) return;
            const rect = _mapCanvas.getBoundingClientRect();
            const normX = (e.clientX - rect.left) / rect.width;
            const normY = (e.clientY - rect.top) / rect.height;

            const targetX = _xStart + normX * _visWidth;
            const targetZ = _zStart + normY * _visHeight;

            if (playerGrp) {
                const getH = optGetWorldHeight || getWorldHeight;
                const targetY = getH ? Math.max(15, getH(targetX, targetZ) + 15) : 30;
                playerGrp.position.set(targetX, targetY, targetZ);
                _lastMapX = -999999;
                if (typeof onTeleport === 'function') onTeleport(targetX, targetY, targetZ);
            }
        });
    }

    const backdrop = document.getElementById('map-backdrop');
    if (backdrop) {
        backdrop.addEventListener('click', () => {
            if (_isMapExpanded) toggleMapExpand();
        });
    }

    const expandMapBtn = document.getElementById('expand-map-btn');
    if (expandMapBtn) {
        expandMapBtn.addEventListener('click', () => toggleMapExpand());
    }

    const zoomInBtn = document.getElementById('zoom-in-btn');
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            const maxZoom = _isMapExpanded ? 16.0 : 8.0;
            _mapZoomLevel = Math.min(maxZoom, _mapZoomLevel * 1.6);
            _lastMapX = -999999;
        });
    }

    const zoomOutBtn = document.getElementById('zoom-out-btn');
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            const minZoom = _isMapExpanded ? 1.0 : 0.5;
            _mapZoomLevel = Math.max(minZoom, _mapZoomLevel / 1.6);
            _lastMapX = -999999;
        });
    }

    if (_mapCanvas) {
        _mapCanvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const minZoom = _isMapExpanded ? 1.0 : 0.5;
            const maxZoom = _isMapExpanded ? 16.0 : 8.0;
            if (e.deltaY > 0) {
                _mapZoomLevel = Math.max(minZoom, _mapZoomLevel / 1.25);
            } else {
                _mapZoomLevel = Math.min(maxZoom, _mapZoomLevel * 1.25);
            }
            _lastMapX = -999999;
        }, { passive: false });
    }

    const closeMapBtn = document.getElementById('close-map-btn');
    if (closeMapBtn) {
        closeMapBtn.addEventListener('click', () => {
            if (_isMapExpanded) {
                toggleMapExpand();
            } else if (_mapEl) {
                _mapEl.style.display = 'none';
            }
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'm' || e.key === 'M') {
            if (!e.target || (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA')) {
                if (_mapEl && _mapEl.style.display === 'none') {
                    _mapEl.style.display = 'block';
                } else {
                    toggleMapExpand();
                }
            }
        }
    });
}

function getTopographicPixelColor(sampleX, sampleZ, stepX, stepZ, getBiomeAt) {
    const h = getWorldHeight ? getWorldHeight(sampleX, sampleZ) : 0;
    let r = 11, g = 19, b = 41; // Deep ocean base #0b1329

    if (h < 2.4) {
        // Water Depth Shading
        if (h < -2.0) {
            // Abyssal deep ocean
            r = 11; g = 19; b = 41;
        } else if (h < 1.2) {
            // Coastal shallow ocean
            const t = (h + 2.0) / 3.2;
            r = Math.round(11 + t * (30 - 11));
            g = Math.round(19 + t * (58 - 19));
            b = Math.round(41 + t * (138 - 41));
        } else {
            // Reef / Shoreline foam
            const t = (h - 1.2) / 1.2;
            r = Math.round(30 + t * (20 - 30));
            g = Math.round(58 + t * (184 - 58));
            b = Math.round(138 + t * (166 - 138));
        }
    } else {
        // Land Elevation & Biome Shading
        const biome = getBiomeAt ? getBiomeAt(sampleX, sampleZ) : null;
        const bName = biome?.name ? biome.name.toLowerCase() : '';

        // Base biome land color
        let baseR = 55, baseG = 125, baseB = 34; // Ghibli green #377d22

        if (bName.includes('jungle')) {
            baseR = 21; baseG = 128; baseB = 61; // #15803d
        } else if (bName.includes('magical')) {
            baseR = 126; baseG = 34; baseB = 206; // #7e22ce
        } else if (bName.includes('crystal')) {
            baseR = 2; baseG = 132; baseB = 199; // #0284c7
        } else if (bName.includes('desert')) {
            baseR = 180; baseG = 83; baseB = 9; // #b45309
        } else if (bName.includes('north') || bName.includes('pole')) {
            baseR = 226; baseG = 232; baseB = 240; // #e2e8f0
        } else if (bName.includes('mountain') || bName.includes('misty')) {
            baseR = 71; baseG = 85; baseB = 105; // #475569
        } else if (bName.includes('archipelago')) {
            baseR = 46; baseG = 91; baseB = 130; // #2e5b82
        }

        // Shoreline sandy beach (h between 2.4 and 5.0)
        if (h < 5.0 && !bName.includes('north') && !bName.includes('mountain')) {
            const beachT = (5.0 - h) / 2.6;
            baseR = Math.round(baseR * (1 - beachT) + 217 * beachT);
            baseG = Math.round(baseG * (1 - beachT) + 160 * beachT);
            baseB = Math.round(baseB * (1 - beachT) + 60 * beachT);
        }

        // Elevation Tinting (Mountain rock & Glacier snow caps)
        if (h > 25.0) {
            if (h < 110.0) {
                // Transition to mountain rock slate gray #334155
                const rockT = Math.min(1.0, (h - 25.0) / 85.0);
                baseR = Math.round(baseR * (1 - rockT) + 51 * rockT);
                baseG = Math.round(baseG * (1 - rockT) + 65 * rockT);
                baseB = Math.round(baseB * (1 - rockT) + 85 * rockT);
            } else {
                // High peaks transition to glacier white snow #f8fafc
                const snowT = Math.min(1.0, (h - 110.0) / 70.0);
                baseR = Math.round(51 * (1 - snowT) + 248 * snowT);
                baseG = Math.round(65 * (1 - snowT) + 250 * snowT);
                baseB = Math.round(85 * (1 - snowT) + 252 * snowT);
            }
        }

        // 3D Hillshading / Slope Lighting Effect
        const hRight = getWorldHeight ? getWorldHeight(sampleX + stepX * 0.8, sampleZ) : h;
        const hDown = getWorldHeight ? getWorldHeight(sampleX, sampleZ + stepZ * 0.8) : h;
        const slope = (h - hRight) * 0.08 + (h - hDown) * 0.08;

        const lightShift = Math.max(-50, Math.min(50, slope * 18));
        r = Math.max(0, Math.min(255, Math.round(baseR + lightShift)));
        g = Math.max(0, Math.min(255, Math.round(baseG + lightShift)));
        b = Math.max(0, Math.min(255, Math.round(baseB + lightShift)));
    }

    return { r, g, b };
}

export function drawWorldMap(options = {}) {
    const { playerGrp, getBiomeAt, WORLD_LENGTH = _worldLength } = options;
    if (!playerGrp) return;
    if (!_mapCanvas) _mapCanvas = document.getElementById('map-canvas');
    if (_mapCanvas && !_mapCtx) _mapCtx = _mapCanvas.getContext('2d');
    if (!_mapCanvas || !_mapCtx) return;

    let W = 200, H = 200;
    if (_isMapExpanded && _mapEl) {
        W = Math.max(300, _mapEl.clientWidth - 32);
        H = Math.max(300, _mapEl.clientHeight - 80);
    }

    if (_mapCanvas.width !== W || _mapCanvas.height !== H) {
        _mapCanvas.width = W;
        _mapCanvas.height = H;
        _mapCanvas.style.width = `${W}px`;
        _mapCanvas.style.height = `${H}px`;
    }

    if (!_mapBgCanvas) {
        _mapBgCanvas = document.createElement('canvas');
        _mapBgCtx = _mapBgCanvas.getContext('2d');
    }

    const px = playerGrp.position.x;
    const pz = playerGrp.position.z;

    const isFixedFullWorld = _isMapExpanded && (_mapZoomLevel <= 1.001);

    let visHeight, visWidth;
    let xStart, zStart;
    const aspect = W / H;

    if (_isMapExpanded) {
        if (isFixedFullWorld) {
            _mapZoomLevel = 1.0;
            visHeight = WORLD_LENGTH;
            visWidth = visHeight * aspect;
            xStart = -visWidth / 2;
            zStart = 0;
        } else {
            visHeight = WORLD_LENGTH / _mapZoomLevel;
            visWidth = visHeight * aspect;
            xStart = px - visWidth / 2;
            zStart = pz - visHeight / 2;
        }
    } else {
        visHeight = 80000 / _mapZoomLevel;
        visWidth = visHeight;
        xStart = px - visWidth / 2;
        zStart = pz - visHeight / 2;
    }

    _visWidth = visWidth;
    _visHeight = visHeight;
    _xStart = xStart;
    _zStart = zStart;

    const stateChanged = (_lastExpandedState !== _isMapExpanded) || 
                          (_lastZoomState !== _mapZoomLevel) || 
                          (_mapBgCanvas.width !== W) || 
                          (_mapBgCanvas.height !== H);

    if (stateChanged) {
        _lastExpandedState = _isMapExpanded;
        _lastZoomState = _mapZoomLevel;
        _lastMapX = -999999;
    }

    let needsRegen = stateChanged;
    if (!isFixedFullWorld) {
        if (Math.hypot(px - _lastMapX, pz - _lastMapZ) > 80) {
            needsRegen = true;
        }
    } else {
        if (_lastMapX === -999999) {
            needsRegen = true;
        }
    }

    if (needsRegen) {
        _lastMapX = px;
        _lastMapZ = pz;

        const resH = _isMapExpanded ? 240 : 80;
        const resW = _isMapExpanded ? Math.round(resH * aspect) : resH;

        _mapBgCanvas.width = resW;
        _mapBgCanvas.height = resH;

        const stepX = visWidth / resW;
        const stepZ = visHeight / resH;

        _mapBgCtx.clearRect(0, 0, resW, resH);

        const imgData = _mapBgCtx.createImageData(resW, resH);
        const dataPixels = imgData.data;

        for (let j = 0; j < resH; j++) {
            const sampleZ = zStart + j * stepZ;
            for (let i = 0; i < resW; i++) {
                const sampleX = xStart + i * stepX;
                const { r, g, b } = getTopographicPixelColor(sampleX, sampleZ, stepX, stepZ, getBiomeAt);

                const idx = (j * resW + i) * 4;
                dataPixels[idx] = r;
                dataPixels[idx + 1] = g;
                dataPixels[idx + 2] = b;
                dataPixels[idx + 3] = 255;
            }
        }
        _mapBgCtx.putImageData(imgData, 0, 0);
    }

    _mapCtx.clearRect(0, 0, W, H);
    _mapCtx.imageSmoothingEnabled = true;
    _mapCtx.imageSmoothingQuality = 'high';
    _mapCtx.drawImage(_mapBgCanvas, 0, 0, W, H);

    // Draw Continent labels on fixed world map
    if (isFixedFullWorld) {
        _mapCtx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        _mapCtx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        _mapCtx.textAlign = 'center';
        _mapCtx.textBaseline = 'middle';

        const labelContinents = getContinentLabels ? getContinentLabels() : [];

        for (const c of labelContinents) {
            const labelX = ((c.x - xStart) / visWidth) * W;
            const labelY = (c.z / WORLD_LENGTH) * H;
            _mapCtx.fillText(c.name, labelX, labelY);
        }
    }

    // Determine player position on map
    let playerCanvasX, playerCanvasY;
    if (!isFixedFullWorld) {
        playerCanvasX = W / 2;
        playerCanvasY = H / 2;
    } else {
        playerCanvasX = ((px - xStart) / visWidth) * W;
        playerCanvasY = (pz / WORLD_LENGTH) * H;
    }

    // Draw Sleek Minimal Direction Arrow
    const dirX = -Math.sin(playerGrp.rotation.y);
    const dirZ = -Math.cos(playerGrp.rotation.y);
    const angle = Math.atan2(dirZ, dirX);

    _mapCtx.save();
    _mapCtx.translate(playerCanvasX, playerCanvasY);
    _mapCtx.rotate(angle);

    // Draw backing circle for visibility
    _mapCtx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    _mapCtx.beginPath();
    _mapCtx.arc(0, 0, _isMapExpanded ? 11 : 8, 0, Math.PI * 2);
    _mapCtx.fill();

    // Sleek arrow shape
    const arrowScale = _isMapExpanded ? 1.4 : 1.0;
    _mapCtx.fillStyle = '#38bdf8';
    _mapCtx.strokeStyle = '#ffffff';
    _mapCtx.lineWidth = 1.2;
    _mapCtx.beginPath();
    _mapCtx.moveTo(7 * arrowScale, 0);
    _mapCtx.lineTo(-5 * arrowScale, -4 * arrowScale);
    _mapCtx.lineTo(-2.5 * arrowScale, 0);
    _mapCtx.lineTo(-5 * arrowScale, 4 * arrowScale);
    _mapCtx.closePath();
    _mapCtx.fill();
    _mapCtx.stroke();

    _mapCtx.restore();

    const infoText = document.getElementById('map-info-text');
    if (infoText) {
        const rx = Math.round(px);
        const rz = Math.round(pz);
        const currentBiome = getBiomeAt ? getBiomeAt(px, pz) : null;
        const bName = currentBiome ? currentBiome.name : 'Unknown';
        const zoomStr = _mapZoomLevel >= 1.0 ? `${_mapZoomLevel.toFixed(1)}x` : `${_mapZoomLevel.toFixed(2)}x`;
        infoText.innerText = `X: ${rx}m | Z: ${rz}m | BIOME: ${bName} | ZOOM: ${zoomStr}`;
    }
}

