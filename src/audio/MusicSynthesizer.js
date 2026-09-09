import { AMBIENT_TRACKS } from './AmbientMusic.js';

export const tracks = AMBIENT_TRACKS;

let audioCtx = null;
let windGain = null;
let windFilter = null;

let musicGain = null;
let spaceReverb = null;
let isMusicPlaying = false;
let isAutoAdvance = true;
let loopsPerTrack = 3;
let currentTrack = 0;
let nextNoteTime = 0;
let musicTimerID = null;

let chordIndex = 0;
let sequenceTime = 0;
let arpIndex = 0;
let isSyncingTrack = false;

const arpPatterns = [
    [0, 1, 2, 3, 4, 3, 2, 1],
    [0, 2, 1, 3, 2, 4, 3, 1],
    [0, 1, 3, 2, 4, 2, 3, 1],
    [0, 2, 4, 3, 2, 1, 0, 2]
];

export function getAudioContext() {
    return audioCtx;
}

export function getWindGain() {
    return windGain;
}

export function getWindFilter() {
    return windFilter;
}

export function getMusicGain() {
    return musicGain;
}

export function setAutoAdvance(val) {
    isAutoAdvance = !!val;
}

export function setMusicMuted(muted) {
    if (audioCtx) {
        if (windGain) {
            windGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
        }
        if (musicGain) {
            musicGain.gain.setTargetAtTime(muted ? 0 : 0.45, audioCtx.currentTime, 0.05);
        }
    }
}

export function updateWindSound(isWindOn, isBoosting, isSoundMuted, velocity, time) {
    if (!audioCtx || audioCtx.state !== 'running' || !windGain || !windFilter) return;
    if (!isWindOn || !isBoosting || isSoundMuted) {
        windGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15);
    } else {
        const speedFactor = Math.max(0, Math.min(1, ((velocity || 18.0) - 15) / 30));
        const targetVolume = 0.25 + speedFactor * 0.35;
        windGain.gain.setTargetAtTime(targetVolume, audioCtx.currentTime, 0.1);

        const targetFreq = 400 + Math.sin(time) * 100 + speedFactor * 800;
        windFilter.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.1);
    }
}

export function isTrackPlaying() {
    return isMusicPlaying;
}

export function getCurrentTrackIndex() {
    return currentTrack;
}

export function initAudio(options = {}) {
    const biplane = options.biplaneAudio || (typeof window !== 'undefined' ? window.biplaneAudio : null);
    const fmm = options.flightModelManager || (typeof window !== 'undefined' ? window.flightModelManager : null);

    if (audioCtx) {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        if (biplane && !biplane.audioCtx) {
            biplane.setAudioContext(audioCtx);
            const curCfg = fmm ? fmm.getCurrentConfig() : null;
            if (curCfg && curCfg.isPlane && options.isEngineSoundOn !== false && !options.isSoundMuted) {
                biplane.setActive(true);
            }
        }
        return audioCtx;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;

    audioCtx = new AudioContext();
    if (typeof window !== 'undefined') window.audioCtx = audioCtx;

    const bufferSize = audioCtx.sampleRate * 2;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    windFilter = audioCtx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 400;

    windGain = audioCtx.createGain();
    windGain.gain.value = 0;

    noiseSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(audioCtx.destination);

    noiseSource.start();

    if (biplane) {
        biplane.setAudioContext(audioCtx);
        const curCfg = fmm ? fmm.getCurrentConfig() : null;
        if (curCfg && curCfg.isPlane && options.isEngineSoundOn !== false && !options.isSoundMuted) {
            biplane.setActive(true);
        }
    }

    return audioCtx;
}

export function selectMusicTrack(idx, trackDropdownController = null) {
    if (isSyncingTrack) return;
    isSyncingTrack = true;
    try {
        currentTrack = ((idx % tracks.length) + tracks.length) % tracks.length;
        sequenceTime = 0;
        chordIndex = 0;
        arpIndex = 0;
        if (audioCtx) {
            nextNoteTime = audioCtx.currentTime + 0.1;
        }
        const trackBtn = document.getElementById('track-toggle');
        if (trackBtn) {
            trackBtn.innerText = "Track: " + tracks[currentTrack].name;
        }
        if (trackDropdownController) {
            if (trackDropdownController.getValue() !== tracks[currentTrack].name) {
                trackDropdownController.setValue(tracks[currentTrack].name);
            }
        }
    } finally {
        isSyncingTrack = false;
    }
}

export function createSpaceReverb() {
    if (!audioCtx) return null;
    const input = audioCtx.createGain();
    const output = audioCtx.createGain();

    const delayL = audioCtx.createDelay(1.0);
    const delayR = audioCtx.createDelay(1.0);
    delayL.delayTime.value = 0.42;
    delayR.delayTime.value = 0.63;

    const filterL = audioCtx.createBiquadFilter();
    const filterR = audioCtx.createBiquadFilter();
    filterL.type = 'lowpass';
    filterR.type = 'lowpass';
    filterL.frequency.value = 750;
    filterR.frequency.value = 650;

    const feedbackL = audioCtx.createGain();
    const feedbackR = audioCtx.createGain();
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

export function playNote(freq, time, duration, oscType, isPad = false) {
    if (!audioCtx || !musicGain) return;
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

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
        filter.frequency.setValueAtTime(550, time);
        filter.frequency.exponentialRampToValueAtTime(240, time + duration);
        filter.Q.setValueAtTime(0.8, time);
        env.gain.setValueAtTime(0, time);
        env.gain.linearRampToValueAtTime(0.07, time + 0.06);
        env.gain.exponentialRampToValueAtTime(0.0005, time + duration);
    }

    osc.connect(filter);
    filter.connect(env);
    env.connect(musicGain);

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

export function scheduleNotes() {
    if (!isMusicPlaying || !audioCtx) return;
    const track = tracks[currentTrack];

    if (nextNoteTime < audioCtx.currentTime - 0.5) {
        nextNoteTime = audioCtx.currentTime + 0.1;
    }

    while (nextNoteTime < audioCtx.currentTime + 0.2) {
        if (sequenceTime % track.speed === 0) {
            const chord = track.chords[chordIndex % track.chords.length];
            chord.forEach((freq, idx) => {
                const octaveDiv = (idx === 0) ? 2 : 1;
                playNote(freq / octaveDiv, nextNoteTime, track.speed / 1000 * 1.35, track.padOsc, true);
            });
        }

        const chord = track.chords[chordIndex % track.chords.length];
        const pattern = arpPatterns[chordIndex % arpPatterns.length];

        if (sequenceTime % track.stepSpeed === 0) {
            const noteFreq = chord[pattern[arpIndex % pattern.length] % chord.length];
            playNote(noteFreq, nextNoteTime, track.stepSpeed / 1000 * 2.2, track.leadOsc, false);
            arpIndex++;

            if (Math.random() > 0.72) {
                const melFreq = chord[Math.floor(Math.random() * chord.length)];
                playNote(melFreq, nextNoteTime, track.stepSpeed / 1000 * 3.5, track.leadOsc, false);
            }
        }

        nextNoteTime += track.stepSpeed / 1000;
        sequenceTime += track.stepSpeed;

        if (sequenceTime >= track.speed) {
            sequenceTime = 0;
            chordIndex++;
            arpIndex = 0;

            if (isAutoAdvance && chordIndex >= track.chords.length * loopsPerTrack) {
                selectMusicTrack(currentTrack + 1);
            }
        }
    }
    musicTimerID = setTimeout(scheduleNotes, 80);
}

export function toggleMusic() {
    initAudio();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    if (!musicGain && audioCtx) {
        musicGain = audioCtx.createGain();
        musicGain.gain.value = 0.45;
        spaceReverb = createSpaceReverb();
        musicGain.connect(audioCtx.destination);
        if (spaceReverb) {
            const wetGain = audioCtx.createGain();
            wetGain.gain.value = 0.55;
            musicGain.connect(spaceReverb.input);
            spaceReverb.output.connect(wetGain);
            wetGain.connect(audioCtx.destination);
        }
    }

    isMusicPlaying = !isMusicPlaying;
    const trackBtn = document.getElementById('track-toggle');
    const topMusicBtn = document.getElementById('top-music-btn');

    if (isMusicPlaying && audioCtx) {
        sequenceTime = 0;
        chordIndex = 0;
        arpIndex = 0;
        nextNoteTime = audioCtx.currentTime + 0.1;
        scheduleNotes();
        const toggleBtn = document.getElementById('music-toggle');
        if (toggleBtn) toggleBtn.innerText = "Pause Music";
        if (trackBtn) trackBtn.style.display = "block";
        if (topMusicBtn) {
            topMusicBtn.style.opacity = '1';
            topMusicBtn.style.color = '#60a5fa';
            topMusicBtn.title = 'Music: PLAYING (Click to Pause)';
        }
    } else {
        if (musicTimerID) clearTimeout(musicTimerID);
        const toggleBtn = document.getElementById('music-toggle');
        if (toggleBtn) toggleBtn.innerText = "Play Music";
        if (trackBtn) trackBtn.style.display = "none";
        if (topMusicBtn) {
            topMusicBtn.style.opacity = '0.65';
            topMusicBtn.style.color = 'rgba(255, 255, 255, 0.95)';
            topMusicBtn.title = 'Music: PAUSED (Click to Play)';
        }
    }
    return isMusicPlaying;
}

if (typeof window !== 'undefined') {
    window.selectMusicTrack = (idx) => selectMusicTrack(idx);
}
