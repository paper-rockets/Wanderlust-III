// Procedural Web Audio Ambient Music Synthesizer
// Relaxing, mellow, warm ambient soundtracks with deep 8-chord progressions and soft tone shaping.

export const AMBIENT_TRACKS = [
    { 
        name: "Spirited Winds", 
        description: "Uplifting & Nostalgic - Morning flight over sunlit green meadows",
        chords: [
            [174.61, 220.00, 261.63, 329.63, 392.00], // Fmaj9
            [196.00, 246.94, 293.66, 329.63],         // G6
            [164.81, 196.00, 246.94, 293.66],         // Em7
            [220.00, 261.63, 329.63, 392.00, 493.88], // Am9
            [146.83, 174.61, 220.00, 261.63, 329.63], // Dm9
            [196.00, 261.63, 293.66, 349.23],         // G7sus4
            [130.81, 196.00, 261.63, 329.63, 493.88], // Cmaj7
            [174.61, 220.00, 261.63, 329.63]          // Fmaj7
        ],
        speed: 4800, stepSpeed: 400, padOsc: 'sine', leadOsc: 'sine'
    },
    { 
        name: "Summer Drift", 
        description: "Warm & Golden - Serene afternoon soaring along golden coastlines",
        chords: [
            [130.81, 196.00, 261.63, 293.66, 329.63], // Cmaj9
            [123.47, 196.00, 246.94, 293.66],         // G/B
            [110.00, 174.61, 220.00, 261.63, 329.63], // Am7
            [164.81, 196.00, 246.94, 329.63],         // Em7
            [174.61, 220.00, 261.63, 329.63, 392.00], // Fmaj9
            [164.81, 196.00, 261.63, 329.63],         // C/E
            [146.83, 174.61, 220.00, 261.63],         // Dm7
            [196.00, 246.94, 261.63, 293.66]          // Gsus4
        ],
        speed: 5200, stepSpeed: 450, padOsc: 'triangle', leadOsc: 'sine'
    },
    { 
        name: "Evening Whispers", 
        description: "Twilight & Reflective - Quiet purple dusk drifting into dusk",
        chords: [
            [110.00, 220.00, 261.63, 329.63, 493.88], // Am9
            [174.61, 220.00, 261.63, 329.63, 392.00], // Fmaj9
            [146.83, 174.61, 220.00, 261.63],         // Dm7
            [196.00, 246.94, 293.66, 349.23],         // G7
            [130.81, 196.00, 261.63, 329.63, 493.88], // Cmaj7
            [174.61, 220.00, 261.63, 329.63],         // Fmaj7
            [123.47, 174.61, 220.00, 293.66],         // Bm7b5
            [164.81, 220.00, 246.94, 293.66]          // E7sus4
        ],
        speed: 5600, stepSpeed: 450, padOsc: 'sine', leadOsc: 'sine'
    },
    { 
        name: "Wandering Clouds", 
        description: "Meditative & Weightless - Drifting slowly across vast cumulus banks",
        chords: [
            [146.83, 220.00, 293.66, 369.99, 440.00], // Dmaj7
            [138.59, 220.00, 277.18, 329.63],         // A/C#
            [123.47, 185.00, 246.94, 293.66, 369.99], // Bm9
            [185.00, 220.00, 277.18, 369.99],         // F#m7
            [196.00, 246.94, 293.66, 369.99, 440.00], // Gmaj9
            [185.00, 220.00, 293.66, 369.99],         // D/F#
            [164.81, 196.00, 246.94, 293.66, 369.99], // Em9
            [110.00, 220.00, 293.66, 329.63]          // Asus4
        ],
        speed: 5000, stepSpeed: 400, padOsc: 'sine', leadOsc: 'sine'
    },
    { 
        name: "Star Ocean", 
        description: "Cosmic & Ethereal - Infinite starlit deep space flight",
        chords: [
            [82.41, 164.81, 196.00, 246.94, 293.66, 369.99], // Em9
            [98.00, 196.00, 246.94, 293.66, 369.99],         // Gmaj7
            [130.81, 196.00, 246.94, 261.63, 293.66],        // Cmaj9
            [110.00, 164.81, 220.00, 261.63, 293.66],        // Am9
            [123.47, 185.00, 246.94, 293.66, 369.99],        // Bm7
            [130.81, 196.00, 261.63, 329.63],                // Cmaj7
            [146.83, 220.00, 246.94, 293.66, 369.99],        // D6
            [82.41, 164.81, 196.00, 246.94, 293.66]          // Em7
        ],
        speed: 6400, stepSpeed: 500, padOsc: 'sine', leadOsc: 'triangle'
    },
    { 
        name: "Floating Islands", 
        description: "Ancient & Mystical - Soaring between lush mystical plateaus",
        chords: [
            [103.83, 207.65, 261.63, 311.13, 392.00], // Abmaj7
            [87.31, 174.61, 207.65, 261.63, 311.13, 349.23], // Fm9
            [116.54, 174.61, 233.08, 277.18, 349.23], // Bbm7
            [77.78, 155.56, 207.65, 233.08, 277.18],  // Eb7sus4
            [138.59, 207.65, 261.63, 277.18, 311.13], // Dbmaj9
            [130.81, 196.00, 261.63, 311.13],         // Cm7
            [116.54, 174.61, 233.08, 261.63, 277.18], // Bbm9
            [77.78, 155.56, 196.00, 233.08, 277.18]   // Eb7
        ],
        speed: 6000, stepSpeed: 500, padOsc: 'sine', leadOsc: 'sine'
    },
    { 
        name: "Mystic Horizon", 
        description: "Velvet Midnight - Moonlit calm flight over sleeping seas",
        chords: [
            [98.00, 196.00, 233.08, 293.66, 349.23, 392.00], // Gm9
            [77.78, 155.56, 196.00, 233.08, 293.66, 349.23], // Ebmaj9
            [116.54, 174.61, 233.08, 293.66, 349.23],        // Bbmaj7
            [87.31, 174.61, 233.08, 261.63, 349.23],         // Fsus4
            [130.81, 196.00, 233.08, 261.63, 293.66, 311.13], // Cm9
            [146.83, 174.61, 220.00, 261.63],                 // Dm7
            [155.56, 196.00, 233.08, 293.66],                 // Ebmaj7
            [146.83, 196.00, 220.00, 261.63]                  // D7sus4
        ],
        speed: 5400, stepSpeed: 450, padOsc: 'sine', leadOsc: 'triangle'
    },
    { 
        name: "Gentle Aurora", 
        description: "Crystalline Glow - Calming polar light dancing across high clouds",
        chords: [
            [82.41, 164.81, 246.94, 311.13, 329.63, 369.99], // Emaj9
            [103.83, 207.65, 246.94, 311.13, 369.99],         // G#m7
            [138.59, 164.81, 207.65, 246.94, 277.18, 311.13], // C#m9
            [110.00, 164.81, 220.00, 277.18, 311.13, 329.63], // Amaj9
            [92.50, 185.00, 220.00, 277.18, 329.63],          // F#m9
            [103.83, 207.65, 246.94, 311.13],                 // G#m7
            [110.00, 220.00, 277.18, 329.63],                 // Amaj7
            [123.47, 185.00, 246.94, 277.18, 329.63]          // Bsus4
        ],
        speed: 5800, stepSpeed: 450, padOsc: 'sine', leadOsc: 'sine'
    }
];

export class AmbientMusicEngine {
    constructor(isLowGfx = false) {
        this.isLowGfx = isLowGfx;
        this.audioCtx = null;
        this.musicGain = null;
        this.spaceReverb = null;
        this.isPlaying = false;
        this.autoAdvance = true;
        this.loopsPerTrack = 3;
        this.currentTrack = 0;
        this.nextNoteTime = 0;
        this.timerID = null;
        this.chordIndex = 0;
        this.sequenceTime = 0;
        this.arpIndex = 0;
        
        this.arpPatterns = [
            [0, 1, 2, 3, 4, 3, 2, 1],
            [0, 2, 1, 3, 2, 4, 3, 1],
            [0, 1, 3, 2, 4, 2, 3, 1],
            [0, 2, 4, 3, 2, 1, 0, 2]
        ];
    }

    setAudioContext(ctx) {
        this.audioCtx = ctx;
    }

    createSpaceReverb() {
        if (!this.audioCtx) return null;
        const input = this.audioCtx.createGain();
        const output = this.audioCtx.createGain();

        const delayL = this.audioCtx.createDelay(1.0);
        const delayR = this.audioCtx.createDelay(1.0);
        delayL.delayTime.value = 0.42;
        delayR.delayTime.value = 0.63;

        const filterL = this.audioCtx.createBiquadFilter();
        const filterR = this.audioCtx.createBiquadFilter();
        filterL.type = 'lowpass';
        filterR.type = 'lowpass';
        filterL.frequency.value = 750;
        filterR.frequency.value = 650;

        const feedbackL = this.audioCtx.createGain();
        const feedbackR = this.audioCtx.createGain();
        feedbackL.gain.value = 0.45;
        feedbackR.gain.value = 0.40;

        input.connect(delayL);
        input.connect(delayR);

        delayL.connect(filterL);
        filterL.connect(feedbackL);
        feedbackL.connect(delayR);
        filterL.connect(output);

        delayR.connect(filterR);
        filterR.connect(feedbackR);
        feedbackR.connect(delayL);
        filterR.connect(output);

        return { input, output };
    }

    playNote(freq, time, duration, oscType, isPad = false) {
        if (!this.audioCtx || !this.musicGain) return;
        const osc = this.audioCtx.createOscillator();
        const env = this.audioCtx.createGain();
        const filter = this.audioCtx.createBiquadFilter();
        
        osc.type = oscType;
        osc.frequency.value = freq;
        filter.type = 'lowpass';
        
        if (isPad) {
            filter.frequency.setValueAtTime(360, time);
            filter.Q.setValueAtTime(0.7, time);
            env.gain.setValueAtTime(0, time);
            env.gain.linearRampToValueAtTime(0.045, time + Math.min(2.0, duration * 0.4));
            env.gain.linearRampToValueAtTime(0.0001, time + duration);
        } else {
            // Warm, mellow acoustic music-box tone without piercing high frequencies
            filter.frequency.setValueAtTime(550, time);
            filter.frequency.exponentialRampToValueAtTime(240, time + duration);
            filter.Q.setValueAtTime(0.8, time);
            env.gain.setValueAtTime(0, time);
            env.gain.linearRampToValueAtTime(0.07, time + 0.06);
            env.gain.exponentialRampToValueAtTime(0.0005, time + duration);
        }
        
        osc.connect(filter);
        filter.connect(env);
        env.connect(this.musicGain);

        osc.onended = () => {
            try {
                osc.disconnect();
                filter.disconnect();
                env.disconnect();
            } catch (e) {}
        };
        
        osc.start(time);
        osc.stop(time + duration);
    }

    scheduleNotes() {
        if (!this.isPlaying || !this.audioCtx) return;
        const track = AMBIENT_TRACKS[this.currentTrack];
        
        if (this.nextNoteTime < this.audioCtx.currentTime - 0.5) {
            this.nextNoteTime = this.audioCtx.currentTime + 0.1;
        }
        
        while (this.nextNoteTime < this.audioCtx.currentTime + 0.2) {
            if (this.sequenceTime % track.speed === 0) {
                const chord = track.chords[this.chordIndex % track.chords.length];
                chord.forEach((freq, idx) => {
                    const octaveDiv = (idx === 0) ? 2 : 1;
                    this.playNote(freq / octaveDiv, this.nextNoteTime, track.speed / 1000 * 1.35, track.padOsc, true);
                });
            }
            
            const chord = track.chords[this.chordIndex % track.chords.length];
            const pattern = this.arpPatterns[this.chordIndex % this.arpPatterns.length];
            
            if (this.sequenceTime % track.stepSpeed === 0) {
                const noteFreq = chord[pattern[this.arpIndex % pattern.length] % chord.length];
                this.playNote(noteFreq, this.nextNoteTime, track.stepSpeed / 1000 * 2.2, track.leadOsc, false);
                this.arpIndex++;
                
                if (Math.random() > 0.72) {
                    const melFreq = chord[Math.floor(Math.random() * chord.length)];
                    this.playNote(melFreq, this.nextNoteTime, track.stepSpeed / 1000 * 3.5, track.leadOsc, false);
                }
            }
            
            this.nextNoteTime += track.stepSpeed / 1000;
            this.sequenceTime += track.stepSpeed;
            
            if (this.sequenceTime >= track.speed) {
                this.sequenceTime = 0;
                this.chordIndex++;
                this.arpIndex = 0;
                if (this.autoAdvance && this.chordIndex >= track.chords.length * this.loopsPerTrack) {
                    this.nextTrack();
                }
            }
        }
        this.timerID = setTimeout(() => this.scheduleNotes(), 80);
    }

    toggle() {
        if (!this.audioCtx) return false;
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        
        if (!this.musicGain) {
            this.musicGain = this.audioCtx.createGain();
            this.musicGain.gain.value = 0.45;
            this.spaceReverb = this.createSpaceReverb();
            this.musicGain.connect(this.audioCtx.destination);
            if (this.spaceReverb) {
                const wetGain = this.audioCtx.createGain();
                wetGain.gain.value = 0.55;
                this.musicGain.connect(this.spaceReverb.input);
                this.spaceReverb.output.connect(wetGain);
                wetGain.connect(this.audioCtx.destination);
            }
        }

        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) {
            this.sequenceTime = 0;
            this.chordIndex = 0;
            this.arpIndex = 0;
            this.nextNoteTime = this.audioCtx.currentTime + 0.1;
            this.scheduleNotes();
        } else {
            clearTimeout(this.timerID);
        }
        return this.isPlaying;
    }

    nextTrack() {
        this.currentTrack = (this.currentTrack + 1) % AMBIENT_TRACKS.length;
        this.sequenceTime = 0;
        this.chordIndex = 0;
        this.arpIndex = 0;
        if (this.audioCtx) {
            this.nextNoteTime = this.audioCtx.currentTime + 0.1;
        }
        return AMBIENT_TRACKS[this.currentTrack].name;
    }
}
