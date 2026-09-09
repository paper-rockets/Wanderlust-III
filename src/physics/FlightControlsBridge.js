export class FlightControlsBridge {
    constructor(options = {}) {
        this.keys = { w: false, a: false, s: false, d: false, shift: false, space: false };
        this.touchState = { x: 0, y: 0, boost: false, brake: false };
        this.options = options;

        this.pcControlsShown = false;
        this.activeTouchId = null;
        this.isMouseDraggingJoy = false;
        this.maxRadius = 60;

        this.initialPinchDist = null;
        this.initialZoomDist = null;

        const params = (typeof window !== 'undefined' && window.location) ? new URLSearchParams(window.location.search) : null;
        const hasMobileParam = params ? params.has('mobile') : false;
        const isTouch = (typeof window !== 'undefined') && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches));
        const isMobileUA = (typeof navigator !== 'undefined') && (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|webOS/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
        const isTouchOnly = (typeof window !== 'undefined' && window.matchMedia) ? window.matchMedia('(hover: none) and (pointer: coarse)').matches : false;

        this.isMobileMode = typeof document !== 'undefined' && (
            hasMobileParam ||
            document.documentElement.classList.contains('force-mobile') ||
            document.body.classList.contains('force-mobile') ||
            (isMobileUA && isTouch) ||
            isTouchOnly
        );

        this._initKeyboard();
        this._initTouchAndJoystick();
        this._initBoostButton();
    }

    _initKeyboard() {
        if (typeof window === 'undefined') return;

        window.addEventListener('keydown', e => {


            const k = e.key.toLowerCase();
            if (k === 'w' || e.key === 'ArrowUp') this.keys.w = true;
            if (k === 's' || e.key === 'ArrowDown') this.keys.s = true;
            if (k === 'a' || e.key === 'ArrowLeft') this.keys.a = true;
            if (k === 'd' || e.key === 'ArrowRight') this.keys.d = true;
            if (e.key === 'Shift') this.keys.shift = true;
            if (e.key === ' ') this.keys.space = true;

            if (k === 'h' && typeof this.options.onToggleGUI === 'function') {
                this.options.onToggleGUI();
            }
            if (k === 'v' && typeof this.options.onToggleModelVisibility === 'function') {
                this.options.onToggleModelVisibility();
            }

            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                if (k === 'c' && this.options.getFlightModelManager) {
                    const fmm = this.options.getFlightModelManager();
                    if (fmm) {
                        if (e.shiftKey) fmm.prevModel();
                        else fmm.nextModel();
                    }
                }
                if (k === 'n' && typeof this.options.onToggleEngineSound === 'function') {
                    this.options.onToggleEngineSound();
                }
                if (k === 'm' && typeof this.options.onToggleMasterSound === 'function') {
                    this.options.onToggleMasterSound();
                }
            }
        });

        window.addEventListener('keyup', e => {
            const k = e.key.toLowerCase();
            if (k === 'w' || e.key === 'ArrowUp') this.keys.w = false;
            if (k === 's' || e.key === 'ArrowDown') this.keys.s = false;
            if (k === 'a' || e.key === 'ArrowLeft') this.keys.a = false;
            if (k === 'd' || e.key === 'ArrowRight') this.keys.d = false;
            if (e.key === 'Shift') this.keys.shift = false;
            if (e.key === ' ') this.keys.space = false;
        });
    }

    _initTouchAndJoystick() {
        if (typeof document === 'undefined') return;

        const touchControls = document.getElementById('touch-controls');
        if (touchControls) {
            touchControls.style.display = this.isMobileMode ? 'block' : 'none';
        }

        const joyBase = document.getElementById('joystick-base');
        const joyKnob = document.getElementById('joystick-knob');

        if (joyBase) {
            if (this.isMobileMode) {
                joyBase.style.display = 'block';
                joyBase.style.pointerEvents = 'auto';
            } else {
                joyBase.style.display = 'none';
                joyBase.style.opacity = '0';
                joyBase.style.pointerEvents = 'none';
            }

            joyBase.addEventListener('mousedown', e => {
                e.preventDefault();
                e.stopPropagation();
                this.isMouseDraggingJoy = true;
                joyBase.style.opacity = '0.8';
                this._updateJoystick(e, joyBase, joyKnob);
            });

            window.addEventListener('mousemove', e => {
                if (this.isMouseDraggingJoy) {
                    e.preventDefault();
                    this._updateJoystick(e, joyBase, joyKnob);
                }
            });

            window.addEventListener('mouseup', () => {
                if (this.isMouseDraggingJoy) {
                    this.isMouseDraggingJoy = false;
                    this._resetJoystick(joyBase, joyKnob);
                }
            });
        }

        window.addEventListener('touchstart', e => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                const target = document.elementFromPoint(touch.clientX, touch.clientY);

                if (target && (target.closest('#top-bar') || target.closest('.lil-gui') || target.closest('#crystal-editor') || target.closest('#debug-overlay'))) {
                    continue;
                }

                if (target && target.closest('#boost-btn')) {
                    continue;
                }

                if (this.activeTouchId === null) {
                    const isLeftHalf = touch.clientX < window.innerWidth * 0.55;
                    const isOnJoystick = joyBase && (joyBase === target || joyBase.contains(target));

                    if (isLeftHalf || isOnJoystick) {
                        this.activeTouchId = touch.identifier;
                        if (joyBase) {
                            joyBase.style.display = 'block';
                            joyBase.style.opacity = '0.8';
                            const radius = joyBase.offsetWidth / 2 || 50;
                            joyBase.style.left = `${touch.clientX - radius}px`;
                            joyBase.style.bottom = 'auto';
                            joyBase.style.top = `${touch.clientY - radius}px`;
                        }
                        this._updateJoystick(touch, joyBase, joyKnob);
                        e.preventDefault();
                    }
                }
            }

            if (e.touches.length === 2 && this.options.getCameraManager) {
                const isJoyTouch = Array.from(e.touches).some(t => t.identifier === this.activeTouchId);
                if (!isJoyTouch) {
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    this.initialPinchDist = Math.sqrt(dx * dx + dy * dy);
                    const cm = this.options.getCameraManager();
                    this.initialZoomDist = cm ? cm.cameraZoomDist : 12.0;
                }
            }
        }, { passive: false });

        window.addEventListener('touchmove', e => {
            if (this.activeTouchId !== null) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const touch = e.changedTouches[i];
                    if (touch.identifier === this.activeTouchId) {
                        this._updateJoystick(touch, joyBase, joyKnob);
                        e.preventDefault();
                        break;
                    }
                }
            }

            if (e.touches.length === 2 && this.initialPinchDist !== null && this.options.getCameraManager) {
                const isJoyTouch = Array.from(e.touches).some(t => t.identifier === this.activeTouchId);
                if (!isJoyTouch) {
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    const newDist = Math.sqrt(dx * dx + dy * dy);
                    const cm = this.options.getCameraManager();
                    if (cm && newDist > 0) {
                        cm.cameraZoomDist = Math.max(6.0, Math.min(300.0, this.initialZoomDist * (this.initialPinchDist / newDist)));
                    }
                    e.preventDefault();
                }
            }
        }, { passive: false });

        const handleTouchEnd = e => {
            if (this.activeTouchId !== null) {
                for (let i = 0; i < e.changedTouches.length; i++) {
                    if (e.changedTouches[i].identifier === this.activeTouchId) {
                        this._resetJoystick(joyBase, joyKnob);
                        break;
                    }
                }
            }
            if (e.touches.length < 2) {
                this.initialPinchDist = null;
            }
        };

        window.addEventListener('touchend', handleTouchEnd, { passive: false });
        window.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    }

    _updateJoystick(touch, joyBase, joyKnob) {
        if (!joyBase || !joyKnob) return;
        const rect = joyBase.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let dx = touch.clientX - centerX;
        let dy = touch.clientY - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > this.maxRadius) {
            dx = (dx / dist) * this.maxRadius;
            dy = (dy / dist) * this.maxRadius;
        }
        joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        this.touchState.x = dx / this.maxRadius;
        this.touchState.y = dy / this.maxRadius;
    }

    _resetJoystick(joyBase, joyKnob) {
        this.activeTouchId = null;
        this.touchState.x = 0;
        this.touchState.y = 0;
        if (joyKnob) joyKnob.style.transform = `translate(-50%, -50%)`;
        if (joyBase) {
            if (!this.isMobileMode) {
                joyBase.style.opacity = '0';
                joyBase.style.display = 'none';
            } else {
                joyBase.style.opacity = '0.3';
                joyBase.style.left = '40px';
                joyBase.style.top = 'auto';
                joyBase.style.bottom = '40px';
            }
        }
    }

    _initBoostButton() {
        if (typeof document === 'undefined') return;
        const boostBtn = document.getElementById('boost-btn');
        if (boostBtn) {
            if (!this.isMobileMode) {
                boostBtn.style.display = 'none';
                boostBtn.style.pointerEvents = 'none';
            } else {
                boostBtn.style.display = 'flex';
                boostBtn.style.pointerEvents = 'auto';
            }
            const startBoost = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.touchState.boost = true;
                boostBtn.style.transform = 'scale(0.9)';
            };
            const resetBoost = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.touchState.boost = false;
                boostBtn.style.transform = 'scale(1)';
            };
            boostBtn.addEventListener('touchstart', startBoost, { passive: false });
            boostBtn.addEventListener('mousedown', startBoost);
            boostBtn.addEventListener('touchend', resetBoost, { passive: false });
            boostBtn.addEventListener('touchcancel', resetBoost, { passive: false });
            boostBtn.addEventListener('mouseup', resetBoost);
            boostBtn.addEventListener('mouseleave', resetBoost);
        }
    }
}
