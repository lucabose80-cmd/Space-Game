// Synthesized Retro-Sci-Fi SFX & Cozy Procedural Retro-Synth Soundtrack via Web Audio API
import type { MusicTrack } from '../types';

interface TrackPattern {
  stepMs: number;
  leadType: OscillatorType;
  bassType: OscillatorType;
  leadVol: number;
  bassVol: number;
  lead: Array<number | null>; // MIDI note or rest
  bass: Array<number | null>;
}

// Cozy Moonlighter-inspired 16-step pentatonic / modal retro-synth motifs
const TRACK_PATTERNS: Record<MusicTrack, TrackPattern> = {
  shop_day: {
    stepMs: 265,
    leadType: 'triangle',
    bassType: 'sine',
    leadVol: 0.028,
    bassVol: 0.032,
    // Warm C major / A minor cozy shop melody
    lead: [72, null, 76, 79, 81, null, 79, 76, 74, null, 76, 79, 76, null, 72, null],
    bass: [48, null, 55, null, 57, null, 55, null, 53, null, 57, null, 55, null, 52, null],
  },
  shop_night: {
    stepMs: 340,
    leadType: 'sine',
    bassType: 'sine',
    leadVol: 0.025,
    bassVol: 0.028,
    // Dreamy starry night lo-fi lullaby (D dorian / Fmaj7)
    lead: [69, null, 72, null, 76, null, 74, 72, 67, null, 69, null, 72, null, 64, null],
    bass: [45, null, null, 52, 41, null, null, 48, 43, null, null, 50, 45, null, null, null],
  },
  hub: {
    stepMs: 230,
    leadType: 'triangle',
    bassType: 'triangle',
    leadVol: 0.026,
    bassVol: 0.025,
    // Upbeat Port Solaris promenade arpeggios (G major)
    lead: [67, 71, 74, 79, 76, 74, 71, null, 69, 72, 76, 79, 74, null, 71, null],
    bass: [43, null, 50, null, 48, null, 52, null, 45, null, 52, null, 50, null, 47, null],
  },
  dungeon: {
    stepMs: 225,
    leadType: 'triangle',
    bassType: 'sawtooth',
    leadVol: 0.024,
    bassVol: 0.016,
    // Mysterious sci-fi derelict pulse (E minor)
    lead: [64, null, 67, 71, 72, null, 71, 67, 62, null, 66, 69, 67, null, 64, null],
    bass: [40, 40, null, 47, 43, null, 40, null, 38, 38, null, 45, 43, null, 40, null],
  },
  dungeon_s2: {
    stepMs: 210,
    leadType: 'sine',
    bassType: 'triangle',
    leadVol: 0.028,
    bassVol: 0.022,
    // Shimmering crystalline nebula arpeggio (F# minor / A major sparkle)
    lead: [78, 81, 85, null, 88, 85, 81, 78, 76, 80, 83, null, 85, 81, 78, null],
    bass: [42, null, 49, null, 45, null, 52, null, 40, null, 47, null, 44, null, 49, null],
  },
  dungeon_s3: {
    stepMs: 195,
    leadType: 'sawtooth',
    bassType: 'square',
    leadVol: 0.021,
    bassVol: 0.019,
    // Heavy volcanic industrial Solar Foundry groove (C phrygian)
    lead: [60, null, 61, 63, 67, null, 68, 67, 63, null, 61, 60, 67, null, 61, null],
    bass: [36, 36, null, 37, 36, null, 43, null, 36, 36, null, 39, 37, null, 36, null],
  },
  dungeon_s4: {
    stepMs: 220,
    leadType: 'triangle',
    bassType: 'sine',
    leadVol: 0.028,
    bassVol: 0.026,
    // Majestic cosmic Elder Monolith astral hymn (E lydian / B celestial)
    lead: [76, 79, 83, 86, 88, null, 86, 83, 78, 81, 85, 88, 90, null, 83, null],
    bass: [40, null, 47, null, 44, null, 51, null, 42, null, 49, null, 47, null, 54, null],
  },
  boss: {
    stepMs: 155,
    leadType: 'square',
    bassType: 'sawtooth',
    leadVol: 0.022,
    bassVol: 0.022,
    // Driving chiptune boss battle (D minor)
    lead: [62, 65, 69, 74, 73, 69, 65, 69, 62, 65, 70, 77, 76, 74, 70, 69],
    bass: [38, 38, 45, 38, 41, 41, 45, 41, 36, 36, 43, 36, 40, 40, 45, 43],
  },
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private musicMuted = false;
  private noiseBuffer: AudioBuffer | null = null;

  private sceneTrack: MusicTrack = 'shop_day';
  private jukeboxOverride: MusicTrack | null = null;
  private musicStep = 0;
  private musicTimer: number | null = null;

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  public setMusicMuted(muted: boolean): void {
    this.musicMuted = muted;
  }

  public isMusicMuted(): boolean {
    return this.musicMuted;
  }

  public toggleMusicMute(): boolean {
    this.musicMuted = !this.musicMuted;
    if (!this.musicMuted && !this.muted) {
      this.ensureMusicLoop();
    }
    return this.musicMuted;
  }

  public getActiveMusicTrack(): MusicTrack {
    return this.jukeboxOverride ?? this.sceneTrack;
  }

  public getJukeboxOverride(): MusicTrack | null {
    return this.jukeboxOverride;
  }

  public setJukeboxTrack(track: MusicTrack | null): void {
    const prev = this.getActiveMusicTrack();
    this.jukeboxOverride = track;
    if (this.getActiveMusicTrack() !== prev) {
      this.musicStep = 0;
      this.restartMusicLoop();
    }
  }

  public setMusicTrack(track: MusicTrack): void {
    if (this.sceneTrack === track) return;
    const prevActive = this.getActiveMusicTrack();
    this.sceneTrack = track;
    if (this.getActiveMusicTrack() !== prevActive) {
      this.musicStep = 0;
      this.restartMusicLoop();
    }
  }

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.buildNoiseBuffer();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.ensureMusicLoop();
  }

  private ensureMusicLoop(): void {
    if (this.musicTimer !== null || typeof window === 'undefined') return;
    const pat = TRACK_PATTERNS[this.getActiveMusicTrack()];
    this.musicTimer = window.setInterval(() => this.tickMusic(), pat.stepMs);
  }

  private restartMusicLoop(): void {
    if (this.musicTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.ensureMusicLoop();
  }

  private tickMusic(): void {
    if (this.muted || this.musicMuted) return;
    if (!this.ctx || this.ctx.state !== 'running') return;
    const pat = TRACK_PATTERNS[this.getActiveMusicTrack()];
    const idx = this.musicStep % pat.lead.length;
    this.musicStep = (this.musicStep + 1) % pat.lead.length;

    const dur = (pat.stepMs / 1000) * 0.88;
    const leadMidi = pat.lead[idx];
    const bassMidi = pat.bass[idx];

    if (leadMidi !== null) {
      this.playMusicVoice(midiToFreq(leadMidi), dur, pat.leadType, pat.leadVol);
    }
    if (bassMidi !== null) {
      this.playMusicVoice(midiToFreq(bassMidi), dur * 1.15, pat.bassType, pat.bassVol, 680);
    }
  }

  private playMusicVoice(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    lowpassFreq = 1850,
  ): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(lowpassFreq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  private buildNoiseBuffer(): void {
    if (!this.ctx) return;
    const length = Math.floor(this.ctx.sampleRate * 0.5);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  private ready(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + Math.min(0.012, duration * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private playNoise(duration: number, filterFreq: number, volume: number, delay = 0): void {
    const ctx = this.ready();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(1.2, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  public playSlash(comboStep: number): void {
    const base = comboStep === 2 ? 320 : 420 + comboStep * 70;
    this.playNoise(comboStep === 2 ? 0.16 : 0.1, 1400, 0.11);
    this.playTone(base, base * 0.42, comboStep === 2 ? 0.18 : 0.11, 'sawtooth', 0.07);
    if (comboStep === 2) {
      this.playTone(620, 220, 0.16, 'triangle', 0.08, 0.03);
    }
  }

  public playFistPunch(step: number): void {
    const isFinisher = step >= 3;
    const base = isFinisher ? 260 : 320 + step * 55;
    this.playNoise(isFinisher ? 0.14 : 0.07, isFinisher ? 860 : 1280, isFinisher ? 0.16 : 0.1);
    this.playTone(base, base * 0.34, isFinisher ? 0.15 : 0.08, 'triangle', isFinisher ? 0.12 : 0.08);
    if (isFinisher) {
      this.playTone(540, 140, 0.18, 'sawtooth', 0.09, 0.02);
    }
  }

  public playCometSlam(): void {
    this.playNoise(0.24, 520, 0.19);
    this.playTone(460, 88, 0.25, 'sawtooth', 0.11);
    this.playTone(220, 56, 0.28, 'triangle', 0.12, 0.04);
  }

  public playDiscusThrow(): void {
    this.playNoise(0.08, 2200, 0.08);
    this.playTone(520, 1180, 0.11, 'triangle', 0.08);
    this.playTone(760, 1340, 0.09, 'sine', 0.06, 0.025);
  }

  public playDiscusBounce(): void {
    this.playTone(880, 1420, 0.07, 'sine', 0.08);
    this.playTone(660, 990, 0.06, 'triangle', 0.06, 0.02);
  }

  public playDiscusRecall(): void {
    this.playTone(1040, 520, 0.16, 'triangle', 0.09);
    this.playTone(680, 1320, 0.18, 'sine', 0.08, 0.05);
  }

  public playVipChime(): void {
    this.playTone(784, 784, 0.08, 'sine', 0.09, 0);
    this.playTone(1046, 1046, 0.1, 'triangle', 0.09, 0.07);
    this.playTone(1318, 1568, 0.18, 'sine', 0.1, 0.14);
  }

  public playCompanionUnlock(): void {
    this.playTone(523, 523, 0.09, 'triangle', 0.09, 0);
    this.playTone(659, 659, 0.09, 'triangle', 0.09, 0.08);
    this.playTone(784, 784, 0.1, 'triangle', 0.09, 0.16);
    this.playTone(1046, 1318, 0.28, 'sine', 0.11, 0.24);
  }

  public playHaloBlock(): void {
    this.playTone(740, 1480, 0.12, 'sine', 0.11, 0);
    this.playTone(1110, 1660, 0.18, 'triangle', 0.09, 0.04);
  }

  public playBlaster(): void {
    this.playTone(920, 240, 0.11, 'square', 0.06);
    this.playTone(540, 180, 0.08, 'triangle', 0.05);
  }

  public playDash(): void {
    this.playNoise(0.16, 900, 0.11);
    this.playTone(220, 520, 0.12, 'triangle', 0.06);
  }

  public playHit(): void {
    this.playNoise(0.08, 600, 0.14);
    this.playTone(180, 72, 0.09, 'square', 0.09);
  }

  public playPlayerHurt(): void {
    this.playNoise(0.14, 420, 0.16);
    this.playTone(170, 62, 0.2, 'sawtooth', 0.12);
    this.playTone(120, 50, 0.18, 'square', 0.08, 0.04);
  }

  public playEnemyDefeat(): void {
    this.playTone(300, 95, 0.16, 'sawtooth', 0.08);
    this.playTone(460, 680, 0.12, 'triangle', 0.06, 0.06);
  }

  public playPickup(): void {
    this.playTone(587, 587, 0.06, 'triangle', 0.08, 0);
    this.playTone(880, 1046, 0.1, 'triangle', 0.08, 0.055);
  }

  public playHeal(): void {
    this.playTone(440, 660, 0.14, 'sine', 0.08, 0);
    this.playTone(660, 880, 0.18, 'triangle', 0.08, 0.09);
    this.playTone(880, 1175, 0.2, 'sine', 0.07, 0.18);
  }

  public playRegister(): void {
    this.playTone(880, 880, 0.07, 'triangle', 0.09, 0);
    this.playTone(1318, 1318, 0.14, 'sine', 0.1, 0.06);
    this.playTone(1760, 1760, 0.18, 'triangle', 0.07, 0.11);
  }

  public playReaction(kind: 'cheap' | 'fair' | 'expensive' | 'outrageous'): void {
    if (kind === 'cheap') {
      this.playTone(523, 659, 0.08, 'triangle', 0.07, 0);
      this.playTone(784, 1046, 0.12, 'triangle', 0.07, 0.07);
    } else if (kind === 'fair') {
      this.playTone(587, 784, 0.1, 'sine', 0.07, 0);
    } else if (kind === 'expensive') {
      this.playTone(370, 290, 0.14, 'triangle', 0.07, 0);
    } else {
      this.playTone(250, 140, 0.15, 'sawtooth', 0.08, 0);
      this.playTone(190, 110, 0.16, 'square', 0.07, 0.08);
    }
  }

  public playDoorUnlock(): void {
    this.playTone(330, 440, 0.1, 'triangle', 0.08, 0);
    this.playTone(440, 660, 0.14, 'triangle', 0.08, 0.08);
  }

  public playWarp(): void {
    this.playTone(220, 880, 0.38, 'sine', 0.09, 0);
    this.playTone(330, 1320, 0.34, 'triangle', 0.06, 0.06);
  }

  public playUpgrade(): void {
    this.playTone(440, 440, 0.08, 'square', 0.06, 0);
    this.playTone(554, 554, 0.08, 'square', 0.06, 0.08);
    this.playTone(659, 659, 0.09, 'square', 0.06, 0.16);
    this.playTone(880, 880, 0.24, 'triangle', 0.09, 0.24);
  }

  public playUiClick(): void {
    this.playTone(620, 740, 0.045, 'triangle', 0.05);
  }

  public playShopBell(): void {
    this.playTone(988, 988, 0.12, 'sine', 0.08, 0);
    this.playTone(1319, 1319, 0.2, 'sine', 0.08, 0.1);
  }

  public playBossRoar(): void {
    this.playNoise(0.35, 320, 0.14);
    this.playTone(140, 58, 0.42, 'sawtooth', 0.11);
    this.playTone(110, 48, 0.38, 'square', 0.08, 0.06);
  }

  public playShieldBlock(): void {
    this.playTone(680, 1120, 0.09, 'triangle', 0.1);
    this.playTone(980, 740, 0.1, 'sine', 0.08, 0.03);
    this.playNoise(0.06, 2200, 0.09);
  }

  public playPerfectParry(): void {
    this.playTone(880, 1760, 0.12, 'triangle', 0.12, 0);
    this.playTone(1318, 2093, 0.18, 'sine', 0.11, 0.04);
    this.playTone(587, 1175, 0.14, 'square', 0.06, 0.02);
    this.playNoise(0.07, 3200, 0.08);
  }

  public playRailBeam(): void {
    this.playNoise(0.24, 1800, 0.12);
    this.playTone(1180, 190, 0.28, 'sawtooth', 0.09);
    this.playTone(640, 220, 0.25, 'square', 0.07, 0.04);
  }

  public playHammerSmash(): void {
    this.playNoise(0.24, 340, 0.18);
    this.playTone(150, 42, 0.26, 'sawtooth', 0.13);
    this.playTone(96, 36, 0.28, 'triangle', 0.11, 0.03);
  }

  public playWeaponSwap(): void {
    this.playTone(460, 720, 0.06, 'triangle', 0.07);
    this.playTone(720, 920, 0.06, 'sine', 0.06, 0.045);
  }

  public playBossCharge(): void {
    this.playNoise(0.28, 720, 0.14);
    this.playTone(180, 420, 0.22, 'sawtooth', 0.09);
    this.playTone(110, 80, 0.25, 'square', 0.07, 0.06);
  }

  public playBossLaser(): void {
    this.playNoise(0.45, 1400, 0.11);
    this.playTone(320, 140, 0.5, 'sawtooth', 0.1);
    this.playTone(620, 260, 0.45, 'triangle', 0.08, 0.05);
  }

  public playBossSlam(): void {
    this.playNoise(0.32, 240, 0.22);
    this.playTone(130, 32, 0.36, 'sawtooth', 0.15);
    this.playTone(84, 28, 0.4, 'triangle', 0.13, 0.02);
  }

  public playShieldBreak(): void {
    this.playNoise(0.24, 2400, 0.16);
    this.playTone(940, 140, 0.28, 'sawtooth', 0.12);
    this.playTone(580, 95, 0.24, 'square', 0.08, 0.05);
  }

  public playThiefAlarm(): void {
    this.playTone(880, 1180, 0.1, 'square', 0.08, 0);
    this.playTone(1180, 880, 0.1, 'square', 0.08, 0.11);
    this.playTone(880, 1240, 0.12, 'square', 0.09, 0.22);
  }

  public playThiefCaught(): void {
    this.playNoise(0.12, 950, 0.14);
    this.playTone(320, 640, 0.09, 'triangle', 0.1, 0);
    this.playTone(640, 960, 0.12, 'triangle', 0.1, 0.08);
    this.playTone(960, 1320, 0.16, 'sine', 0.1, 0.16);
  }

  public playDayTransition(): void {
    this.playTone(392, 523, 0.18, 'sine', 0.07, 0);
    this.playTone(523, 659, 0.22, 'triangle', 0.07, 0.12);
    this.playTone(659, 784, 0.28, 'sine', 0.06, 0.24);
  }

  public playPitFall(): void {
    this.playTone(460, 110, 0.36, 'triangle', 0.12, 0);
    this.playTone(320, 75, 0.38, 'sine', 0.09, 0.05);
    this.playNoise(0.14, 420, 0.12);
  }

  public playSecretChime(): void {
    this.playTone(659.25, 659.25, 0.14, 'triangle', 0.09, 0);
    this.playTone(830.61, 830.61, 0.14, 'triangle', 0.09, 0.09);
    this.playTone(987.77, 987.77, 0.16, 'sine', 0.09, 0.18);
    this.playTone(1318.51, 1318.51, 0.32, 'sine', 0.11, 0.28);
  }
}

export const sound = new SoundEngine();
