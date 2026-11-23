import {AudioSettings} from '@/src/game/types/gameTypes';

/**
 * Procedural Web Audio API synthesizer for CHAOS CITY.
 * Unlocks strictly on user gesture and gracefully stays silent if Web Audio is unavailable.
 */
export class AudioSystem {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private settings: AudioSettings = {
    masterVolume: 0.9,
    musicVolume: 0.45,
    sfxVolume: 0.7,
    muted: false,
  };

  private musicTimer: number | null = null;
  private ambientTimer: number | null = null;
  private rainTimer: number | null = null;
  private musicPlaying = false;
  private stepIndex = 0;
  private lastFootstepTime = 0;

  // Pleasant upbeat lo-fi city chord progression & melody notes (Hz)
  private readonly chords: number[][] = [
    [261.63, 329.63, 392.0], // C major
    [220.0, 261.63, 329.63], // A minor
    [174.61, 220.0, 261.63], // F major
    [196.0, 246.94, 293.66], // G major
  ];

  private readonly melody: (number | null)[] = [
    523.25, null, 659.25, 587.33,
    523.25, null, 440.0, null,
    349.23, null, 440.0, 523.25,
    493.88, null, 392.0, null,
  ];

  public applySettings(settings: AudioSettings): void {
    this.settings = {
      masterVolume: typeof settings.masterVolume === 'number' ? settings.masterVolume : 0.9,
      musicVolume: settings.musicVolume,
      sfxVolume: settings.sfxVolume,
      muted: settings.muted,
    };
    this.syncGains();
  }

  public unlock(): void {
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
        if (!AudioCtx) return;

        this.ctx = new AudioCtx();
        this.musicGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.musicGain.connect(this.ctx.destination);
        this.sfxGain.connect(this.ctx.destination);
        this.syncGains();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
    } catch {
      // Audio remains silent gracefully
    }
  }

  private syncGains(): void {
    if (!this.ctx || !this.musicGain || !this.sfxGain) return;
    try {
      const now = this.ctx.currentTime;
      const master = typeof this.settings.masterVolume === 'number' ? this.settings.masterVolume : 0.9;
      const mVol = this.settings.muted ? 0 : this.settings.musicVolume * master * 0.22;
      const sVol = this.settings.muted ? 0 : this.settings.sfxVolume * master * 0.45;
      this.musicGain.gain.setTargetAtTime(mVol, now, 0.04);
      this.sfxGain.gain.setTargetAtTime(sVol, now, 0.04);
    } catch {
      // Ignore WebAudio node state errors
    }
  }

  public startCityMusic(): void {
    this.unlock();
    if (this.musicPlaying) return;
    this.musicPlaying = true;
    this.stepIndex = 0;

    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = window.setInterval(() => {
      if (!this.musicPlaying) return;
      this.playMusicBeat();
    }, 360);

    if (this.ambientTimer !== null) window.clearInterval(this.ambientTimer);
    this.ambientTimer = window.setInterval(() => {
      if (!this.musicPlaying) return;
      if (Math.random() < 0.4) {
        this.playAmbientChirp();
      }
    }, 3200);
  }

  public stopCityMusic(): void {
    this.musicPlaying = false;
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.ambientTimer !== null) {
      window.clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
    this.stopRainLoop();
  }

  private playMusicBeat(): void {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (!this.ctx || !this.musicGain || this.ctx.state !== 'running' || this.settings.muted) {
      return;
    }
    try {
      const now = this.ctx.currentTime;
      const bar = Math.floor(this.stepIndex / 4) % this.chords.length;
      const beatInBar = this.stepIndex % 4;

      // Warm chord pad on beat 0 of each bar
      if (beatInBar === 0) {
        const chord = this.chords[bar];
        for (const freq of chord) {
          this.triggerTone(freq, 'triangle', 0.07, 1.15, now, this.musicGain);
        }
      }

      // Soft pluck melody
      const note = this.melody[this.stepIndex % this.melody.length];
      if (note) {
        this.triggerTone(note, 'sine', 0.09, 0.24, now, this.musicGain);
      }

      this.stepIndex = (this.stepIndex + 1) % 16;
    } catch {
      // Ignore WebAudio beat error if context closed mid-tick
    }
  }

  private playAmbientChirp(): void {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (!this.ctx || !this.musicGain || this.ctx.state !== 'running' || this.settings.muted) {
      return;
    }
    try {
      const now = this.ctx.currentTime;
      const base = 1150 + Math.random() * 450;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.exponentialRampToValueAtTime(base * 1.25, now + 0.07);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.035, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // Ignore ambient audio error gracefully
    }
  }

  public playButtonClick(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    const now = this.ctx.currentTime;
    this.triggerTone(580, 'triangle', 0.22, 0.06, now, this.sfxGain);
    this.triggerTone(820, 'sine', 0.16, 0.07, now + 0.025, this.sfxGain);
  }

  public playInteract(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    const now = this.ctx.currentTime;
    this.triggerTone(523.25, 'sine', 0.22, 0.09, now, this.sfxGain);
    this.triggerTone(659.25, 'sine', 0.22, 0.1, now + 0.06, this.sfxGain);
    this.triggerTone(783.99, 'triangle', 0.2, 0.14, now + 0.12, this.sfxGain);
  }

  public playMapToggle(opening: boolean): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    const now = this.ctx.currentTime;
    if (opening) {
      this.triggerTone(420, 'triangle', 0.18, 0.07, now, this.sfxGain);
      this.triggerTone(620, 'triangle', 0.18, 0.09, now + 0.045, this.sfxGain);
    } else {
      this.triggerTone(620, 'triangle', 0.16, 0.07, now, this.sfxGain);
      this.triggerTone(420, 'triangle', 0.16, 0.09, now + 0.045, this.sfxGain);
    }
  }

  public playCoin(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    const now = this.ctx.currentTime;
    this.triggerTone(987.77, 'sine', 0.2, 0.07, now, this.sfxGain);
    this.triggerTone(1318.51, 'sine', 0.22, 0.14, now + 0.06, this.sfxGain);
  }

  public playError(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    const now = this.ctx.currentTime;
    this.triggerTone(220, 'sawtooth', 0.12, 0.09, now, this.sfxGain);
    this.triggerTone(170, 'sawtooth', 0.12, 0.12, now + 0.08, this.sfxGain);
  }

  public playDoor(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    const now = this.ctx.currentTime;
    this.triggerTone(330, 'triangle', 0.18, 0.08, now, this.sfxGain);
    this.triggerTone(495, 'triangle', 0.18, 0.11, now + 0.05, this.sfxGain);
  }

  public playChannelSwitch(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    const now = this.ctx.currentTime;
    this.triggerTone(920, 'square', 0.1, 0.03, now, this.sfxGain);
    this.triggerTone(640, 'triangle', 0.14, 0.05, now + 0.02, this.sfxGain);
  }

  public playSleepChime(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    const now = this.ctx.currentTime;
    this.triggerTone(523.25, 'sine', 0.14, 0.25, now, this.sfxGain);
    this.triggerTone(392.0, 'sine', 0.14, 0.3, now + 0.14, this.sfxGain);
    this.triggerTone(261.63, 'sine', 0.12, 0.45, now + 0.28, this.sfxGain);
  }

  public playWakeChime(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    const now = this.ctx.currentTime;
    this.triggerTone(392.0, 'triangle', 0.16, 0.14, now, this.sfxGain);
    this.triggerTone(523.25, 'triangle', 0.18, 0.16, now + 0.1, this.sfxGain);
    this.triggerTone(659.25, 'sine', 0.2, 0.24, now + 0.2, this.sfxGain);
  }

  public playSplash(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    const now = this.ctx.currentTime;
    this.triggerTone(740, 'sine', 0.16, 0.09, now, this.sfxGain);
    this.triggerTone(1046.5, 'sine', 0.18, 0.13, now + 0.05, this.sfxGain);
    this.triggerTone(587.33, 'triangle', 0.12, 0.15, now + 0.09, this.sfxGain);
  }

  public playHorn(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    const now = this.ctx.currentTime;
    this.triggerTone(349.23, 'sawtooth', 0.09, 0.14, now, this.sfxGain);
    this.triggerTone(440.0, 'sawtooth', 0.09, 0.14, now, this.sfxGain);
  }

  public playSwish(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    const now = this.ctx.currentTime;
    this.triggerTone(660, 'sine', 0.18, 0.08, now, this.sfxGain);
    this.triggerTone(880, 'triangle', 0.18, 0.12, now + 0.06, this.sfxGain);
    this.triggerTone(1174.66, 'sine', 0.16, 0.16, now + 0.12, this.sfxGain);
  }

  public playUpgrade(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    const now = this.ctx.currentTime;
    this.triggerTone(440, 'triangle', 0.18, 0.07, now, this.sfxGain);
    this.triggerTone(554.37, 'triangle', 0.2, 0.08, now + 0.055, this.sfxGain);
    this.triggerTone(659.25, 'sine', 0.22, 0.12, now + 0.11, this.sfxGain);
    this.triggerTone(880, 'sine', 0.2, 0.16, now + 0.17, this.sfxGain);
  }

  public playWhistle(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    const now = this.ctx.currentTime;
    this.triggerTone(2150, 'sine', 0.14, 0.09, now, this.sfxGain);
    this.triggerTone(2320, 'sine', 0.14, 0.14, now + 0.09, this.sfxGain);
  }

  public playPhoneChime(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    const now = this.ctx.currentTime;
    this.triggerTone(783.99, 'sine', 0.16, 0.07, now, this.sfxGain);
    this.triggerTone(1046.5, 'sine', 0.18, 0.11, now + 0.05, this.sfxGain);
  }

  public playFootstep(running: boolean): void {
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    const nowMs = performance.now();
    const interval = running ? 210 : 330;
    if (nowMs - this.lastFootstepTime < interval) return;
    this.lastFootstepTime = nowMs;

    const now = this.ctx.currentTime;
    const pitch = (running ? 165 : 135) + Math.random() * 25;
    this.triggerTone(pitch, 'triangle', running ? 0.13 : 0.09, 0.045, now, this.sfxGain);
  }

  public playSirenChirp(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    const now = this.ctx.currentTime;
    this.triggerTone(720, 'triangle', 0.12, 0.14, now, this.sfxGain);
    this.triggerTone(940, 'triangle', 0.12, 0.16, now + 0.14, this.sfxGain);
  }

  public playAlarm(): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      this.triggerTone(880, 'square', 0.09, 0.09, now + i * 0.18, this.sfxGain);
      this.triggerTone(620, 'square', 0.09, 0.08, now + i * 0.18 + 0.09, this.sfxGain);
    }
  }

  public startRainLoop(): void {
    if (this.rainTimer !== null) return;
    this.rainTimer = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!this.ctx || !this.musicGain || this.ctx.state !== 'running' || this.settings.muted) return;
      try {
        const now = this.ctx.currentTime;
        const f = 1400 + Math.random() * 1400;
        this.triggerTone(f, 'sine', 0.014, 0.055, now, this.musicGain);
      } catch {
        // Ignore WebAudio error
      }
    }, 170);
  }

  public stopRainLoop(): void {
    if (this.rainTimer !== null) {
      window.clearInterval(this.rainTimer);
      this.rainTimer = null;
    }
  }

  public playSynthNote(
    freq: number,
    durationSec = 0.22,
    wave: OscillatorType = 'triangle',
    peakGain = 0.14,
  ): void {
    this.unlock();
    if (!this.ctx || !this.sfxGain || this.ctx.state !== 'running' || this.settings.muted) return;
    this.triggerTone(freq, wave, peakGain, durationSec, this.ctx.currentTime, this.sfxGain);
  }

  private triggerTone(
    freq: number,
    type: OscillatorType,
    peakGain: number,
    durationSec: number,
    startTime: number,
    destination: GainNode,
  ): void {
    if (!this.ctx || this.ctx.state !== 'running') return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(startTime);
      osc.stop(startTime + durationSec + 0.01);
    } catch {
      // Ignore WebAudio node scheduling errors
    }
  }
}

export const audioSystem = new AudioSystem();
