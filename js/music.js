// ============================================
// Procedural Music System - Web Audio API
// ============================================

class MusicSystem {
    constructor() {
        this.ctx = null;
        this.started = false;
        this.currentTrack = null;
        this.masterGain = null;
        this.volume = 0.35;

        // Scheduling
        this.nextBeatTime = 0;
        this.beatIndex = 0;
        this.bpm = 0;
        this.beatInterval = 0;
        this.scheduleAhead = 0.1;

        // Active oscillators for cleanup
        this.activeNodes = [];

        // Fade
        this.fadeTarget = 0;
        this.fadeSpeed = 2;
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.ctx.destination);

        // Compressor to prevent clipping
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -20;
        this.compressor.knee.value = 10;
        this.compressor.ratio.value = 4;
        this.compressor.connect(this.masterGain);

        this.started = true;
    }

    update(dt) {
        if (!this.started || !this.currentTrack) return;

        // Smooth volume fade
        const current = this.masterGain.gain.value;
        if (Math.abs(current - this.fadeTarget) > 0.01) {
            const newVal = current + (this.fadeTarget - current) * Math.min(1, dt * this.fadeSpeed);
            this.masterGain.gain.setValueAtTime(newVal, this.ctx.currentTime);
        }

        // Schedule beats
        while (this.nextBeatTime < this.ctx.currentTime + this.scheduleAhead) {
            this.scheduleBeat(this.nextBeatTime, this.beatIndex);
            this.nextBeatTime += this.beatInterval;
            this.beatIndex++;
        }
    }

    play(trackName) {
        if (!this.started) this.init();
        if (this.currentTrack === trackName) return;

        this.stopAll();
        this.currentTrack = trackName;
        this.beatIndex = 0;
        this.nextBeatTime = this.ctx.currentTime + 0.05;

        switch (trackName) {
            case 'battle':
                this.bpm = 130;
                this.fadeTarget = this.volume;
                break;
            case 'boss':
                this.bpm = 155;
                this.fadeTarget = this.volume * 1.15;
                break;
            case 'menu':
                this.bpm = 90;
                this.fadeTarget = this.volume * 0.5;
                break;
        }
        this.beatInterval = 60 / this.bpm;
    }

    stop() {
        this.fadeTarget = 0;
        this.currentTrack = null;
        // Cleanup after fade
        setTimeout(() => this.stopAll(), 1500);
    }

    stopAll() {
        for (const node of this.activeNodes) {
            try { node.stop(); } catch(e) {}
        }
        this.activeNodes = [];
    }

    // Clean up expired nodes periodically
    cleanup() {
        this.activeNodes = this.activeNodes.filter(n => {
            try { return n.playbackState !== 'finished'; } catch(e) { return false; }
        });
        // Keep array manageable
        if (this.activeNodes.length > 200) {
            this.activeNodes = this.activeNodes.slice(-100);
        }
    }

    scheduleBeat(time, beat) {
        if (beat % 64 === 0) this.cleanup();

        switch (this.currentTrack) {
            case 'battle': this.battleBeat(time, beat); break;
            case 'boss': this.bossBeat(time, beat); break;
            case 'menu': this.menuBeat(time, beat); break;
        }
    }

    // ===================== BATTLE MUSIC =====================
    // Epic, driving, rhythmic - war drums + bass + lead melody

    battleBeat(time, beat) {
        const bar = Math.floor(beat / 16) % 4; // 4 bar loop
        const pos = beat % 16; // position in bar

        // -- WAR DRUMS --
        // Kick on 1, 5, 9, 13 (4 on the floor but half-time feel)
        if (pos % 4 === 0) {
            this.playDrum(time, 55, 0.15, 0.4);
        }
        // Snare on 4, 12
        if (pos === 4 || pos === 12) {
            this.playSnare(time, 0.12, 0.25);
        }
        // Extra snare hit for energy
        if (bar >= 2 && pos === 14) {
            this.playSnare(time, 0.08, 0.15);
        }
        // Hi-hat 8ths
        if (pos % 2 === 0) {
            this.playHiHat(time, 0.04, pos % 4 === 0 ? 0.12 : 0.07);
        }
        // Tom fills at end of 4-bar phrase
        if (bar === 3 && pos >= 12) {
            this.playDrum(time, 80 + (pos - 12) * 15, 0.08, 0.2);
        }

        // -- BASS LINE --
        // E minor pentatonic bass: E2, G2, A2, B2, D3
        const bassNotes = [
            // Bar 0: E pedal
            82, 0, 82, 0, 82, 0, 98, 0, 82, 0, 0, 82, 73, 0, 82, 0,
            // Bar 1: Moving
            98, 0, 98, 0, 110, 0, 98, 0, 82, 0, 73, 0, 82, 0, 98, 0,
            // Bar 2: Tension
            110, 0, 110, 0, 123, 0, 110, 0, 98, 0, 110, 0, 123, 0, 147, 0,
            // Bar 3: Resolution
            98, 0, 82, 0, 98, 0, 110, 0, 82, 0, 73, 0, 82, 0, 0, 0
        ];
        const bassIdx = (bar * 16 + pos);
        const bassNote = bassNotes[bassIdx % bassNotes.length];
        if (bassNote > 0) {
            this.playBass(time, bassNote, this.beatInterval * 1.5, 0.18);
        }

        // -- LEAD MELODY (plays every other bar for call-and-response feel) --
        if (bar === 0 || bar === 2) {
            const melodyNotes = [
                330, 0, 392, 0, 440, 0, 392, 330, 0, 294, 0, 330, 0, 0, 294, 0
            ];
            const mel = melodyNotes[pos];
            if (mel > 0) {
                this.playLead(time, mel, this.beatInterval * 0.8, 0.06);
            }
        }
        // Counter melody bars 1, 3
        if (bar === 1 || bar === 3) {
            const counterNotes = [
                0, 0, 494, 0, 440, 392, 0, 0, 330, 0, 294, 0, 330, 0, 0, 0
            ];
            const cnt = counterNotes[pos];
            if (cnt > 0) {
                this.playLead(time, cnt, this.beatInterval * 0.6, 0.05);
            }
        }

        // -- POWER CHORDS (stabs on strong beats) --
        if (pos === 0 || pos === 6 || pos === 10) {
            this.playChord(time, bar, 0.04);
        }

        // -- STRING PAD (sustained background) --
        if (pos === 0 && bar === 0) {
            this.playPad(time, [165, 196, 247], this.beatInterval * 16 * 2, 0.025);
        }
    }

    // ===================== BOSS MUSIC =====================
    // Darker, faster, more intense - heavy bass, dissonant, urgent

    bossBeat(time, beat) {
        const bar = Math.floor(beat / 16) % 4;
        const pos = beat % 16;

        // -- HEAVY KICK - double kick pattern --
        if (pos % 2 === 0) {
            this.playDrum(time, 45, 0.18, 0.45);
        }
        // Extra kick hits for double-bass feel
        if (pos % 4 === 1 || pos % 4 === 3) {
            this.playDrum(time, 50, 0.1, 0.25);
        }

        // -- SNARE - half time with ghost notes --
        if (pos === 4 || pos === 12) {
            this.playSnare(time, 0.15, 0.35);
        }
        // Ghost snares
        if (pos === 7 || pos === 10 || pos === 15) {
            this.playSnare(time, 0.06, 0.12);
        }

        // -- RIDE/HAT - 16ths for urgency --
        this.playHiHat(time, 0.03, pos % 4 === 0 ? 0.10 : 0.05);

        // -- DEEP BASS - sinister chromatic movement --
        // D minor / diminished feel: D, Eb, F, Ab
        const bossBass = [
            // Bar 0: D pedal with chromatic approach
            73, 0, 73, 73, 0, 73, 78, 0, 73, 0, 69, 0, 73, 0, 78, 0,
            // Bar 1: Movement
            87, 0, 87, 0, 82, 0, 78, 0, 73, 73, 0, 69, 73, 0, 0, 78,
            // Bar 2: Tension building
            93, 0, 87, 0, 93, 0, 104, 0, 93, 0, 87, 0, 93, 0, 104, 110,
            // Bar 3: Climax and drop
            110, 104, 93, 87, 82, 78, 73, 69, 73, 0, 78, 0, 73, 0, 0, 0
        ];
        const bIdx = bar * 16 + pos;
        const bn = bossBass[bIdx % bossBass.length];
        if (bn > 0) {
            this.playBass(time, bn, this.beatInterval * 1.2, 0.22);
        }

        // -- DISSONANT LEAD - tritone intervals, fast runs --
        if (bar === 0 || bar === 2) {
            const bossLead = [
                587, 0, 622, 0, 698, 0, 622, 0, 587, 0, 554, 0, 587, 622, 698, 0
            ];
            const bl = bossLead[pos];
            if (bl > 0) {
                this.playBossLead(time, bl, this.beatInterval * 0.5, 0.07);
            }
        }
        if (bar === 1 || bar === 3) {
            const bossLead2 = [
                0, 740, 698, 0, 622, 0, 587, 554, 0, 587, 0, 0, 698, 740, 0, 0
            ];
            const bl2 = bossLead2[pos];
            if (bl2 > 0) {
                this.playBossLead(time, bl2, this.beatInterval * 0.4, 0.06);
            }
        }

        // -- STAB CHORDS - minor/diminished --
        if (pos === 0 || pos === 6) {
            this.playBossChord(time, bar, 0.05);
        }
        // Extra stab for intensity
        if (bar >= 2 && (pos === 3 || pos === 9)) {
            this.playBossChord(time, bar, 0.035);
        }

        // -- LOW RUMBLE PAD --
        if (pos === 0 && (bar === 0 || bar === 2)) {
            this.playPad(time, [73, 87, 110], this.beatInterval * 16, 0.03);
        }

        // -- RISING TENSION before loop restart --
        if (bar === 3 && pos >= 12) {
            const riseFreq = 200 + (pos - 12) * 80;
            this.playLead(time, riseFreq, this.beatInterval * 0.3, 0.04 + (pos - 12) * 0.01);
        }
    }

    // ===================== MENU MUSIC =====================
    // Calm, atmospheric, mysterious

    menuBeat(time, beat) {
        const bar = Math.floor(beat / 8) % 4;
        const pos = beat % 8;

        // Slow arpeggiated chords
        const menuArp = [
            [165, 196, 247, 294, 247, 196, 165, 0],  // Em
            [147, 196, 220, 294, 220, 196, 147, 0],  // G/D
            [131, 165, 196, 262, 196, 165, 131, 0],  // C
            [147, 175, 220, 262, 220, 175, 147, 0],  // Bm-ish
        ];
        const note = menuArp[bar][pos];
        if (note > 0) {
            this.playMenuTone(time, note, this.beatInterval * 1.5, 0.06);
        }

        // Deep pad
        if (pos === 0) {
            const padNotes = [[82, 124, 165], [73, 110, 147], [65, 98, 131], [73, 110, 147]];
            this.playPad(time, padNotes[bar], this.beatInterval * 8, 0.02);
        }

        // Gentle kick
        if (pos === 0 || pos === 4) {
            this.playDrum(time, 60, 0.2, 0.12);
        }
    }

    // ===================== INSTRUMENTS =====================

    playDrum(time, freq, duration, volume) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        osc.frequency.exponentialRampToValueAtTime(30, time + duration);
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        osc.connect(gain);
        gain.connect(this.compressor);
        osc.start(time);
        osc.stop(time + duration + 0.01);
        this.activeNodes.push(osc);
    }

    playSnare(time, duration, volume) {
        // Noise burst + tone
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(volume, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        // Bandpass for snare character
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 3000;
        filter.Q.value = 0.8;

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.compressor);
        noise.start(time);
        noise.stop(time + duration + 0.01);
        this.activeNodes.push(noise);

        // Tonal body
        this.playDrum(time, 180, duration * 0.6, volume * 0.4);
    }

    playHiHat(time, duration, volume) {
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 7000;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.compressor);
        noise.start(time);
        noise.stop(time + duration + 0.01);
        this.activeNodes.push(noise);
    }

    playBass(time, freq, duration, volume) {
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(freq * 0.998, time); // slight detune for width

        gain.gain.setValueAtTime(volume, time);
        gain.gain.setValueAtTime(volume * 0.8, time + duration * 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        // Low pass to keep it bassy
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 300;
        filter.Q.value = 2;

        osc.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.compressor);

        osc.start(time);
        osc.stop(time + duration + 0.01);
        osc2.start(time);
        osc2.stop(time + duration + 0.01);
        this.activeNodes.push(osc, osc2);
    }

    playLead(time, freq, duration, volume) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, time);

        // Attack-decay envelope
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume, time + 0.015);
        gain.gain.setValueAtTime(volume * 0.7, time + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, time);
        filter.frequency.exponentialRampToValueAtTime(800, time + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.compressor);
        osc.start(time);
        osc.stop(time + duration + 0.02);
        this.activeNodes.push(osc);
    }

    playBossLead(time, freq, duration, volume) {
        // Harsher, more distorted lead for boss
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(freq * 1.005, time); // slight detune

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        // Waveshaper for grit
        const shaper = this.ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const x = (i / 128) - 1;
            curve[i] = Math.tanh(x * 2);
        }
        shaper.curve = curve;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1500;
        filter.Q.value = 1;

        osc.connect(shaper);
        osc2.connect(shaper);
        shaper.connect(filter);
        filter.connect(gain);
        gain.connect(this.compressor);
        osc.start(time);
        osc.stop(time + duration + 0.02);
        osc2.start(time);
        osc2.stop(time + duration + 0.02);
        this.activeNodes.push(osc, osc2);
    }

    playChord(time, bar, volume) {
        // Power chords for battle - E5, G5, A5, B5
        const roots = [165, 196, 220, 247];
        const root = roots[bar % roots.length];
        const fifth = root * 1.5;
        const dur = this.beatInterval * 2;

        for (const freq of [root, fifth]) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(volume, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1200;

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.compressor);
            osc.start(time);
            osc.stop(time + dur + 0.01);
            this.activeNodes.push(osc);
        }
    }

    playBossChord(time, bar, volume) {
        // Minor/diminished stabs - darker
        const chords = [
            [147, 175, 220],  // D minor
            [156, 185, 233],  // Eb minor
            [131, 156, 196],  // C dim-ish
            [147, 175, 233],  // D aug tension
        ];
        const chord = chords[bar % chords.length];
        const dur = this.beatInterval * 1.5;

        for (const freq of chord) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, time);
            gain.gain.setValueAtTime(volume, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1500, time);
            filter.frequency.exponentialRampToValueAtTime(400, time + dur);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.compressor);
            osc.start(time);
            osc.stop(time + dur + 0.01);
            this.activeNodes.push(osc);
        }
    }

    playPad(time, freqs, duration, volume) {
        for (const freq of freqs) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);

            // Slow attack, long sustain, slow release
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(volume, time + duration * 0.2);
            gain.gain.setValueAtTime(volume * 0.8, time + duration * 0.7);
            gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

            osc.connect(gain);
            gain.connect(this.compressor);
            osc.start(time);
            osc.stop(time + duration + 0.05);
            this.activeNodes.push(osc);
        }
    }

    playMenuTone(time, freq, duration, volume) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(volume, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        // Slight reverb-like delay
        const delay = this.ctx.createDelay();
        delay.delayTime.value = 0.15;
        const delayGain = this.ctx.createGain();
        delayGain.gain.value = 0.2;

        osc.connect(gain);
        gain.connect(this.compressor);
        gain.connect(delay);
        delay.connect(delayGain);
        delayGain.connect(this.compressor);

        osc.start(time);
        osc.stop(time + duration + 0.2);
        this.activeNodes.push(osc);
    }

    // Sound effects
    playSfx(type) {
        if (!this.started) return;
        const t = this.ctx.currentTime;

        switch (type) {
            case 'hit':
                this.playDrum(t, 200, 0.08, 0.15);
                break;
            case 'death':
                this.playDrum(t, 120, 0.3, 0.2);
                this.playDrum(t + 0.05, 80, 0.3, 0.15);
                break;
            case 'pickup':
                this.playLead(t, 600, 0.1, 0.08);
                this.playLead(t + 0.08, 800, 0.1, 0.06);
                break;
            case 'crate':
                this.playLead(t, 400, 0.08, 0.08);
                this.playLead(t + 0.06, 500, 0.08, 0.08);
                this.playLead(t + 0.12, 700, 0.15, 0.1);
                break;
            case 'weapon_switch':
                // Quick metallic click
                this.playLead(t, 800, 0.06, 0.08);
                this.playLead(t + 0.03, 600, 0.06, 0.06);
                break;
            case 'kill':
                // Satisfying kill ding
                this.playLead(t, 880, 0.08, 0.1);
                this.playLead(t + 0.06, 1100, 0.12, 0.08);
                break;
            case 'streak':
                // Kill streak fanfare
                this.playLead(t, 660, 0.1, 0.12);
                this.playLead(t + 0.08, 880, 0.1, 0.12);
                this.playLead(t + 0.16, 1100, 0.15, 0.14);
                this.playDrum(t, 80, 0.2, 0.3);
                this.playSnare(t + 0.08, 0.12, 0.2);
                break;
            case 'levelup':
                // Level up jingle
                this.playLead(t, 523, 0.15, 0.1);
                this.playLead(t + 0.12, 659, 0.15, 0.1);
                this.playLead(t + 0.24, 784, 0.15, 0.1);
                this.playLead(t + 0.36, 1047, 0.3, 0.14);
                this.playPad(t + 0.36, [523, 659, 784], 0.8, 0.04);
                this.playDrum(t + 0.36, 60, 0.4, 0.3);
                break;
            case 'countdown':
                // Deep tonal "bong" - war horn feel
                this.playDrum(t, 80, 0.5, 0.35);
                this.playDrum(t, 160, 0.3, 0.15);
                this.playLead(t, 220, 0.4, 0.12);
                this.playPad(t, [110, 165], 0.6, 0.06);
                // Metallic ring
                this.playLead(t + 0.02, 440, 0.3, 0.05);
                break;
            case 'fight':
                // Epic "FIGHT!" - rising power chord + crash
                this.playDrum(t, 50, 0.6, 0.45);
                this.playDrum(t, 100, 0.4, 0.3);
                this.playSnare(t + 0.02, 0.3, 0.35);
                // Power chord burst
                this.playBass(t, 82, 0.8, 0.25);
                this.playLead(t, 330, 0.5, 0.12);
                this.playLead(t + 0.01, 494, 0.5, 0.10);
                this.playLead(t + 0.02, 660, 0.4, 0.08);
                // Rising sweep
                this.playLead(t + 0.05, 220, 0.15, 0.06);
                this.playLead(t + 0.1, 330, 0.15, 0.06);
                this.playLead(t + 0.15, 440, 0.15, 0.06);
                this.playLead(t + 0.2, 660, 0.2, 0.08);
                this.playPad(t, [165, 247, 330], 1.0, 0.04);
                break;
            case 'player_death':
                // Dramatic death - everything drops, slow descending tones
                // Heavy impact
                this.playDrum(t, 40, 0.8, 0.5);
                this.playDrum(t + 0.05, 60, 0.6, 0.35);
                this.playSnare(t + 0.1, 0.4, 0.3);
                // Descending minor chord - the "fall"
                this.playPad(t + 0.1, [165, 196, 233], 2.5, 0.06);
                // Slow descending notes - sounds like defeat
                this.playLead(t + 0.2, 440, 0.5, 0.1);
                this.playLead(t + 0.6, 392, 0.5, 0.09);
                this.playLead(t + 1.0, 330, 0.6, 0.08);
                this.playLead(t + 1.5, 262, 0.8, 0.07);
                this.playLead(t + 2.1, 196, 1.2, 0.06);
                // Deep rumble fading out
                this.playBass(t + 0.2, 55, 2.5, 0.15);
                // Heartbeat slowing down
                this.playDrum(t + 0.8, 50, 0.25, 0.2);
                this.playDrum(t + 1.4, 45, 0.3, 0.15);
                this.playDrum(t + 2.2, 40, 0.4, 0.1);
                break;
            case 'victory':
                // Triumphant fanfare - rising major chord + celebratory hits
                // Big hit
                this.playDrum(t, 60, 0.5, 0.4);
                this.playSnare(t + 0.05, 0.2, 0.3);
                // Rising major fanfare
                this.playLead(t + 0.1, 330, 0.3, 0.12);
                this.playLead(t + 0.3, 392, 0.3, 0.12);
                this.playLead(t + 0.5, 494, 0.3, 0.12);
                this.playLead(t + 0.7, 660, 0.6, 0.14);
                // Harmony underneath
                this.playLead(t + 0.5, 330, 0.6, 0.06);
                this.playLead(t + 0.7, 392, 0.6, 0.06);
                // Power chord burst on top
                this.playPad(t + 0.7, [330, 416, 494, 660], 2.0, 0.04);
                // Celebratory drums
                this.playDrum(t + 0.7, 80, 0.3, 0.3);
                this.playSnare(t + 0.9, 0.15, 0.2);
                this.playDrum(t + 1.0, 80, 0.3, 0.25);
                this.playSnare(t + 1.15, 0.15, 0.2);
                this.playDrum(t + 1.3, 60, 0.5, 0.35);
                this.playSnare(t + 1.35, 0.25, 0.3);
                // Final sustain
                this.playBass(t + 0.7, 165, 2.5, 0.15);
                break;
        }
    }
}
