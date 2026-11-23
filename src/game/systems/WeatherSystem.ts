import Phaser from 'phaser';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {WeatherType} from '@/src/game/types/gameTypes';

interface RainDrop {
  rx: number; // normalized 0..1 screen X
  ry: number; // normalized 0..1 screen Y
  speed: number;
  len: number;
}

const WEATHER_ORDER: WeatherType[] = ['sunny', 'cloudy', 'rain'];
const WEATHER_DURATIONS: Record<WeatherType, number> = {
  sunny: 160,
  cloudy: 90,
  rain: 110,
};

export class WeatherSystem {
  private weather: WeatherType = 'sunny';
  private timerSec = WEATHER_DURATIONS.sunny;
  private gfx: Phaser.GameObjects.Graphics;
  private cloudVeil: Phaser.GameObjects.Rectangle;
  private drops: RainDrop[] = [];
  private puddleTimer = 0;
  private audioRainOn = false;
  private lastWeatherMode: WeatherType | null = null;
  private lastVeilW = 0;
  private lastVeilH = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.cloudVeil = scene.add
      .rectangle(0, 0, 1920, 1080, 0x1e293b, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(9988);

    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(9989);

    for (let i = 0; i < 68; i++) {
      this.drops.push({
        rx: Math.random(),
        ry: Math.random(),
        speed: 0.78 + Math.random() * 0.45,
        len: 10 + Math.random() * 8,
      });
    }
  }

  public getWeather(): WeatherType {
    return this.weather;
  }

  public setWeather(next: WeatherType): void {
    this.weather = next;
    this.timerSec = WEATHER_DURATIONS[next];
    this.syncAudio();
  }

  public cycleWeather(): WeatherType {
    const idx = WEATHER_ORDER.indexOf(this.weather);
    const next = WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
    this.setWeather(next);
    return next;
  }

  public getBadge(): string {
    switch (this.weather) {
      case 'sunny':
        return '☀️ Clear';
      case 'cloudy':
        return '⛅ Cloudy';
      case 'rain':
        return '🌧️ Rain';
    }
  }

  public getTractionMultiplier(): number {
    return this.weather === 'rain' ? 0.88 : 1.0;
  }

  public getHeadlightIntensity(): number {
    if (this.weather === 'rain') return 1.0;
    if (this.weather === 'cloudy') return 0.65;
    return 0.4;
  }

  private syncAudio(): void {
    if (this.weather === 'rain' && !this.audioRainOn) {
      this.audioRainOn = true;
      audioSystem.startRainLoop();
    } else if (this.weather !== 'rain' && this.audioRainOn) {
      this.audioRainOn = false;
      audioSystem.stopRainLoop();
    }
  }

  public update(
    dtSec: number,
    paused: boolean,
    playerX: number,
    playerY: number,
    particlesOn: boolean,
  ): void {
    const w = this.scene.scale.width || 1280;
    const h = this.scene.scale.height || 720;
    if (w !== this.lastVeilW || h !== this.lastVeilH) {
      this.lastVeilW = w;
      this.lastVeilH = h;
      this.cloudVeil.setSize(w, h);
    }

    if (!paused) {
      this.timerSec -= dtSec;
      if (this.timerSec <= 0) {
        this.cycleWeather();
      }
    }

    if (this.weather === 'sunny') {
      if (this.lastWeatherMode !== 'sunny') {
        this.lastWeatherMode = 'sunny';
        this.cloudVeil.setAlpha(0);
        this.gfx.clear();
      }
      return;
    }

    if (this.weather === 'cloudy') {
      if (this.lastWeatherMode !== 'cloudy') {
        this.lastWeatherMode = 'cloudy';
        this.cloudVeil.setFillStyle(0x334155, 0.11);
        this.gfx.clear();
      }
      return;
    }

    // Rainy weather overlay + diagonal streaks + subtle world puddle ripples
    if (this.lastWeatherMode !== 'rain') {
      this.lastWeatherMode = 'rain';
      this.cloudVeil.setFillStyle(0x0f172a, 0.2);
    }
    this.gfx.clear();

    const dropCount = particlesOn ? this.drops.length : Math.floor(this.drops.length * 0.5);
    this.gfx.lineStyle(1.4, 0xbae6fd, 0.42);
    for (let i = 0; i < dropCount; i++) {
      const d = this.drops[i];
      if (!paused) {
        d.ry += dtSec * d.speed;
        d.rx -= dtSec * 0.14;
        if (d.ry > 1.04) {
          d.ry = -0.04;
          d.rx = Math.random() * 1.1;
        }
        if (d.rx < -0.05) {
          d.rx += 1.08;
        }
      }
      const x1 = d.rx * w;
      const y1 = d.ry * h;
      this.gfx.beginPath();
      this.gfx.moveTo(x1, y1);
      this.gfx.lineTo(x1 - d.len * 0.28, y1 + d.len);
      this.gfx.strokePath();
    }

    if (!paused && particlesOn) {
      this.puddleTimer += dtSec;
      if (this.puddleTimer >= 0.28) {
        this.puddleTimer = 0;
        const rx = playerX + (Math.random() - 0.5) * 380;
        const ry = playerY + (Math.random() - 0.5) * 240;
        const ripple = this.scene.add
          .circle(rx, ry, 2.5, 0x7dd3fc, 0)
          .setStrokeStyle(1.2, 0xbae6fd, 0.5)
          .setDepth(2);
        this.scene.tweens.add({
          targets: ripple,
          scale: 3.4,
          alpha: 0,
          duration: 520,
          ease: 'Sine.easeOut',
          onComplete: () => ripple.destroy(),
        });
      }
    }
  }

  public destroy(): void {
    if (this.audioRainOn) {
      this.audioRainOn = false;
      audioSystem.stopRainLoop();
    }
    this.gfx.destroy();
    this.cloudVeil.destroy();
  }
}
