// Synthesized Retro-Sci-Fi SFX & gentle ambient soundscape via Web Audio API

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private noiseBuffer: AudioBuffer | null = null;

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
}

export const sound = new SoundEngine();
