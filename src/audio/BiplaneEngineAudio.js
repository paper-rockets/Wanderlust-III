// BiplaneEngineAudio.js
// Procedural Web Audio API synthesizer for vintage biplane radial/rotary engines.
// Produces a warm, muffled, faint, low-volume engine rumble with propeller air wash and RPM response.

export class BiplaneEngineAudio {
    constructor(audioCtx = null, outputNode = null) {
        this.audioCtx = audioCtx;
        this.outputNode = outputNode || (audioCtx ? audioCtx.destination : null);
        this.noiseBuffer = null;

        // Gain stages
        this.masterGain = null;
        this.cylinderGain = null;
        this.noiseGain = null;
        this.subGain = null;

        // Filter stages
        this.cylinderFilter = null;
        this.noiseFilter = null;

        // Oscillators and sound sources
        this.osc1 = null;
        this.osc2 = null;
        this.subOsc = null;
        this.lfoOsc = null;
        this.lfoGain = null;
        this.noiseSource = null;

        this.isRunning = false;
        this.isActive = false;
        this.isEnabled = true;
        this.isMuted = false;
        this.targetFade = 0.0;
        this.currentFade = 0.0;
        this.currentRpm = 0.35;
        this.volume = 0.038; // Faint, subtle baseline volume
        this.clock = 0;

        if (this.audioCtx) {
            this._setupNodes();
        }
    }

    setAudioContext(audioCtx, outputNode = null) {
        if (this.audioCtx === audioCtx && this.masterGain) return;
        this.destroy();
        this.audioCtx = audioCtx;
        this.outputNode = outputNode || (audioCtx ? audioCtx.destination : null);
        this.noiseBuffer = null;
        if (this.audioCtx) {
            this._setupNodes();
            if (this.isActive && this.isEnabled && !this.isMuted) {
                this.targetFade = 1.0;
                this._startNodes();
            }
        }
    }

    _createNoiseBuffer() {
        if (!this.audioCtx || this.noiseBuffer) return;
        const sampleRate = this.audioCtx.sampleRate;
        const bufferSize = sampleRate * 1.5;
        this.noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, sampleRate);
        const output = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
    }

    _setupNodes() {
        if (!this.audioCtx) return;
        if (!this.outputNode) this.outputNode = this.audioCtx.destination;

        this._createNoiseBuffer();

        // Master gain for engine sound (starts muted)
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        this.masterGain.connect(this.outputNode);

        // Lowpass filter for warm, muffled vintage radial engine tone
        this.cylinderFilter = this.audioCtx.createBiquadFilter();
        this.cylinderFilter.type = 'lowpass';
        this.cylinderFilter.frequency.setValueAtTime(200, this.audioCtx.currentTime);
        this.cylinderFilter.Q.setValueAtTime(1.8, this.audioCtx.currentTime);

        // Pulse gain node (modulated by LFO)
        this.cylinderGain = this.audioCtx.createGain();
        this.cylinderGain.gain.setValueAtTime(0.65, this.audioCtx.currentTime);

        // Propeller air turbulence filter
        this.noiseFilter = this.audioCtx.createBiquadFilter();
        this.noiseFilter.type = 'bandpass';
        this.noiseFilter.frequency.setValueAtTime(240, this.audioCtx.currentTime);
        this.noiseFilter.Q.setValueAtTime(1.2, this.audioCtx.currentTime);

        this.noiseGain = this.audioCtx.createGain();
        this.noiseGain.gain.setValueAtTime(0.18, this.audioCtx.currentTime);

        // Sub-bass gain
        this.subGain = this.audioCtx.createGain();
        this.subGain.gain.setValueAtTime(0.35, this.audioCtx.currentTime);

        // Connect graph
        this.cylinderFilter.connect(this.cylinderGain);
        this.cylinderGain.connect(this.masterGain);

        this.noiseFilter.connect(this.noiseGain);
        this.noiseGain.connect(this.masterGain);

        this.subGain.connect(this.masterGain);
    }

    setEnabled(enabled) {
        this.isEnabled = !!enabled;
        this._updateTargetFade();
    }

    setMuted(muted) {
        this.isMuted = !!muted;
        this._updateTargetFade();
    }

    setActive(active) {
        this.isActive = !!active;
        this._updateTargetFade();
    }

    _updateTargetFade() {
        const shouldPlay = this.isActive && this.isEnabled && !this.isMuted;
        this.targetFade = shouldPlay ? 1.0 : 0.0;
        if (shouldPlay && !this.isRunning && this.audioCtx) {
            this._startNodes();
        }
    }

    getIsActive() {
        return this.isActive && this.isEnabled && !this.isMuted;
    }

    setVolume(vol) {
        this.volume = Math.max(0.0, Math.min(1.0, vol));
    }

    getVolume() {
        return this.volume;
    }

    _startNodes() {
        if (this.isRunning || !this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }
        if (!this.masterGain) {
            this._setupNodes();
        }

        const t = this.audioCtx.currentTime;

        // 1. Primary fundamental oscillator (Sawtooth)
        this.osc1 = this.audioCtx.createOscillator();
        this.osc1.type = 'sawtooth';
        this.osc1.frequency.setValueAtTime(62, t);

        // 2. Harmonic detuned oscillator (Triangle)
        this.osc2 = this.audioCtx.createOscillator();
        this.osc2.type = 'triangle';
        this.osc2.frequency.setValueAtTime(63.2, t);

        // 3. Sub-bass oscillator (Sine)
        this.subOsc = this.audioCtx.createOscillator();
        this.subOsc.type = 'sine';
        this.subOsc.frequency.setValueAtTime(31, t);

        this.osc1.connect(this.cylinderFilter);
        this.osc2.connect(this.cylinderFilter);
        this.subOsc.connect(this.subGain);

        // 4. Cylinder pulse LFO (modulates cylinderGain to produce chug-chug cadence)
        this.lfoOsc = this.audioCtx.createOscillator();
        this.lfoOsc.type = 'sine';
        this.lfoOsc.frequency.setValueAtTime(28, t);

        this.lfoGain = this.audioCtx.createGain();
        this.lfoGain.gain.setValueAtTime(0.35, t);

        this.cylinderGain.gain.setValueAtTime(0.65, t);
        this.lfoOsc.connect(this.lfoGain);
        this.lfoGain.connect(this.cylinderGain.gain);

        // 5. Propeller air wash noise
        if (this.noiseBuffer) {
            this.noiseSource = this.audioCtx.createBufferSource();
            this.noiseSource.buffer = this.noiseBuffer;
            this.noiseSource.loop = true;
            this.noiseSource.connect(this.noiseFilter);
            this.noiseSource.start(t);
        }

        this.osc1.start(t);
        this.osc2.start(t);
        this.subOsc.start(t);
        this.lfoOsc.start(t);

        this.isRunning = true;
    }

    _stopNodes() {
        if (!this.isRunning || !this.audioCtx) return;
        const t = this.audioCtx.currentTime;
        try {
            this.osc1?.stop(t);
            this.osc2?.stop(t);
            this.subOsc?.stop(t);
            this.lfoOsc?.stop(t);
            this.noiseSource?.stop(t);
        } catch (e) {
            // ignore
        }
        try {
            this.osc1?.disconnect();
            this.osc2?.disconnect();
            this.subOsc?.disconnect();
            this.lfoOsc?.disconnect();
            this.lfoGain?.disconnect();
            this.noiseSource?.disconnect();
        } catch (e) {
            // ignore
        }
        this.osc1 = null;
        this.osc2 = null;
        this.subOsc = null;
        this.lfoOsc = null;
        this.lfoGain = null;
        this.noiseSource = null;
        this.isRunning = false;
    }

    update(dt = 0.016, isBoosting = false, isBraking = false, isPaused = false, speed = 18.0, camDist = 12.0, turnRate = 0.0, pitchRate = 0.0) {
        const shouldPlay = this.isActive && this.isEnabled && !this.isMuted;
        this.targetFade = shouldPlay ? 1.0 : 0.0;

        if (this.targetFade <= 0.001 && this.currentFade <= 0.001) {
            if (this.isRunning) {
                this._stopNodes();
            }
            return;
        }

        if (!this.audioCtx) return;

        if (this.audioCtx.state === 'suspended' && shouldPlay) {
            this.audioCtx.resume().catch(() => {});
        }

        this.clock += dt;

        // Smooth fade in / out
        const fadeRate = shouldPlay ? 1.5 : 2.5;
        this.currentFade += (this.targetFade - this.currentFade) * Math.min(dt * fadeRate, 1.0);

        if (!this.isRunning && this.currentFade > 0.01) {
            this._startNodes();
        }

        // Target RPM: 0.05 = idle/brake, 0.35 = cruise, 1.0 = boost
        let targetRpm = 0.35;
        if (isPaused) {
            targetRpm = 0.05;
        } else if (isBraking) {
            targetRpm = 0.05;
        } else if (isBoosting) {
            targetRpm = 1.0;
        } else if (speed !== undefined) {
            const speedFactor = Math.max(0.0, Math.min(1.0, (speed - 5) / 25));
            targetRpm = 0.15 + speedFactor * 0.4;
        }

        const rpmLerpRate = isBoosting ? 4.5 : 2.5;
        this.currentRpm += (targetRpm - this.currentRpm) * Math.min(dt * rpmLerpRate, 1.0);

        if (!this.isRunning) return;

        const t = this.audioCtx.currentTime;
        const smooth = 0.06;

        // Distance attenuation & high-frequency damping:
        // Default distance is 12m. Zoomed in close (5m) = louder (+75%) & crisp presence.
        // Zoomed far out (50m-300m) = quiet (attenuated to 0.12x) & lowpass muffled.
        const distRatio = Math.max(4.0, camDist) / 12.0;
        const distGain = Math.min(1.85, Math.max(0.12, 1.0 / Math.pow(distRatio, 0.65)));
        const distFilterScale = Math.min(1.4, Math.max(0.38, 1.0 / Math.pow(distRatio, 0.38)));

        // Organic mechanical variations:
        // 1. Slow analog RPM wandering (micro-drift)
        const rpmJitter = Math.sin(this.clock * 0.9) * 0.022 
                        + Math.sin(this.clock * 2.8) * 0.014 
                        + Math.sin(this.clock * 6.3) * 0.007;

        // 2. Flight maneuver aerodynamic load
        const maneuverLoad = Math.min(0.18, (Math.abs(turnRate) + Math.abs(pitchRate)) * 0.12);

        const effectiveRpm = Math.max(0.02, Math.min(1.0, this.currentRpm + rpmJitter + maneuverLoad));

        // 3. Frequencies mapped across effective RPM with subtle harmonic detune drift
        const engineFreq = 45 + effectiveRpm * 54;
        const pulseFreq = 19 + effectiveRpm * 25 + Math.sin(this.clock * 1.7) * 1.5;
        const subFreq = engineFreq * 0.5;
        const detuneOffset = 0.4 + Math.sin(this.clock * 0.5) * 0.6;

        // 4. Air turbulence flutter on propeller wash
        const airTurbulence = Math.sin(this.clock * 2.1) * 22 + Math.sin(this.clock * 5.4) * 14;
        const filterCutoff = Math.max(80, (175 + effectiveRpm * 125) * distFilterScale);
        const noiseCutoff = Math.max(100, (215 + effectiveRpm * 120 + airTurbulence) * distFilterScale);

        if (this.osc1) this.osc1.frequency.setTargetAtTime(engineFreq, t, smooth);
        if (this.osc2) this.osc2.frequency.setTargetAtTime(engineFreq * 1.018 + detuneOffset, t, smooth);
        if (this.subOsc) this.subOsc.frequency.setTargetAtTime(subFreq, t, smooth);
        if (this.lfoOsc) this.lfoOsc.frequency.setTargetAtTime(pulseFreq, t, smooth);

        if (this.cylinderFilter) this.cylinderFilter.frequency.setTargetAtTime(filterCutoff, t, smooth);
        if (this.noiseFilter) this.noiseFilter.frequency.setTargetAtTime(noiseCutoff, t, smooth);

        // Master volume (modulated by fade factor, pause, baseline volume, and camera distance)
        const pauseMultiplier = isPaused ? 0.15 : 1.0;
        const dynamicGain = (0.026 + effectiveRpm * 0.022) * (this.volume / 0.038) * distGain;
        const targetGain = dynamicGain * this.currentFade * pauseMultiplier;

        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(targetGain, t, smooth);
        }
    }

    destroy() {
        this.setActive(false);
        this._stopNodes();
        if (this.masterGain) {
            try { this.masterGain.disconnect(); } catch (e) {}
        }
    }
}
