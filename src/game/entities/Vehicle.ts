import Phaser from 'phaser';
import {WORLD_HEIGHT, WORLD_WIDTH} from '@/src/config/constants';
import {getVehicleModelSpec} from '@/src/game/data/cityLifeData';
import {
  ensureCustomVehicleTexture,
  getVehicleCustomizationKey,
} from '@/src/game/graphics/VehicleArtGenerator';
import {WorldSystem} from '@/src/game/systems/WorldSystem';
import {
  Direction,
  HeadlightStyle,
  InteractiveObjectData,
  OwnedVehicleRecord,
  VehicleCustomization,
  VehicleModelId,
  VehicleUpgrades,
} from '@/src/game/types/gameTypes';

export interface VehicleConfig {
  id: string;
  name: string;
  subtitle: string;
  texture: string;
  x: number;
  y: number;
  direction: Direction;
  maxSpeed: number;
  isScooter?: boolean;
  modelId?: VehicleModelId;
  ownedRecordId?: string;
  condition?: number;
  customization?: VehicleCustomization;
  upgrades?: VehicleUpgrades;
  isTraffic?: boolean;
  alarmed?: boolean;
}

const DIR_FRAME: Record<Direction, string> = {
  down: '0',
  up: '1',
  left: '2',
  right: '3',
};

const HEADLIGHT_COLORS: Record<HeadlightStyle, number> = {
  warm: 0xfef08a,
  ice_blue: 0x7dd3fc,
  neon_gold: 0xfbbf24,
  crimson: 0xfb7185,
};

export class Vehicle {
  public config: VehicleConfig;
  public readonly sprite: Phaser.Physics.Arcade.Sprite;
  private direction: Direction;
  private occupied = false;
  private exhaustTimer = 0;
  private condition = 100;
  private fxGfx: Phaser.GameObjects.Graphics;
  private strobePhase = 0;
  private leanAngle = 0;
  private lastFxKey = '';

  constructor(
    private readonly scene: Phaser.Scene,
    config: VehicleConfig,
  ) {
    this.config = {...config};
    this.direction = config.direction;
    this.condition = config.condition ?? 100;

    let resolvedTexture = config.texture;
    if (config.modelId && config.customization) {
      resolvedTexture = getVehicleCustomizationKey(config.modelId, config.customization);
      ensureCustomVehicleTexture(scene, resolvedTexture, config.modelId, config.customization);
      this.config.texture = resolvedTexture;
    }

    this.sprite = scene.physics.add.sprite(
      config.x,
      config.y,
      resolvedTexture,
      DIR_FRAME[this.direction],
    );
    this.sprite.setOrigin(0.5, 0.65);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setImmovable(true);

    this.fxGfx = scene.add.graphics();
    this.fxGfx.setDepth(this.sprite.y + 7);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    this.syncBodyForDirection();
    const topSpeed = this.getEffectiveMaxSpeed();
    body.setMaxVelocity(topSpeed * 1.18, topSpeed * 1.18);
    body.setDrag(520, 520);
    this.sprite.setDepth(this.sprite.y + 8);
  }

  public getCondition(): number {
    return this.condition;
  }

  public setCondition(cond: number): void {
    this.condition = Phaser.Math.Clamp(Math.round(cond), 10, 100);
    this.config.condition = this.condition;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) {
      const top = this.getEffectiveMaxSpeed();
      body.setMaxVelocity(top * 1.18, top * 1.18);
    }
  }

  public getEffectiveMaxSpeed(): number {
    const engineLvl = this.config.upgrades?.engine ?? 1;
    const base = this.config.modelId
      ? getVehicleModelSpec(this.config.modelId).baseSpeed
      : this.config.maxSpeed;
    const condFactor = 0.72 + 0.28 * (this.condition / 100);
    return Math.round(base * (1 + (engineLvl - 1) * 0.1) * condFactor);
  }

  private getAccelBlendRate(): number {
    const accelLvl = this.config.upgrades?.acceleration ?? 1;
    return 5.2 + (accelLvl - 1) * 1.5;
  }

  private getBrakingBlendRate(): number {
    const brakeLvl = this.config.upgrades?.braking ?? 1;
    return 7.0 + (brakeLvl - 1) * 2.4;
  }

  private getHandlingFactor(): number {
    const handlingLvl = this.config.upgrades?.handling ?? 1;
    return 0.72 + (handlingLvl - 1) * 0.07;
  }

  public applyCustomizationAndUpgrades(record: OwnedVehicleRecord): void {
    const spec = getVehicleModelSpec(record.modelId);
    const key = getVehicleCustomizationKey(record.modelId, record.customization);
    ensureCustomVehicleTexture(this.scene, key, record.modelId, record.customization);

    this.condition = record.condition ?? 100;
    this.config = {
      ...this.config,
      name: record.name,
      texture: key,
      modelId: record.modelId,
      isScooter: spec.isScooter,
      maxSpeed: spec.baseSpeed,
      condition: this.condition,
      customization: {...record.customization},
      upgrades: {...record.upgrades},
    };
    this.sprite.setTexture(key, DIR_FRAME[this.direction]);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const top = this.getEffectiveMaxSpeed();
    body.setMaxVelocity(top * 1.18, top * 1.18);
    this.syncBodyForDirection();
  }

  public isOccupied(): boolean {
    return this.occupied;
  }

  public setOccupied(occupied: boolean): void {
    this.occupied = occupied;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(!occupied);
    if (!occupied) {
      body.setVelocity(0, 0);
      this.leanAngle = 0;
      this.sprite.setAngle(0);
    }
    this.renderEffects(0, false, 0.35);
  }

  public getDirection(): Direction {
    return this.direction;
  }

  public setDirection(dir: Direction): void {
    this.direction = dir;
    this.sprite.setFrame(DIR_FRAME[dir]);
    this.syncBodyForDirection();
  }

  public getCurrentSpeed(): number {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    return Math.round(Math.hypot(body.velocity.x, body.velocity.y));
  }

  public stopImmediately(): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body | undefined;
    body?.setVelocity(0, 0);
    this.leanAngle = 0;
    this.sprite.setAngle(0);
    this.renderEffects(0, false, 0.3);
  }

  public updateDriving(
    dtSec: number,
    moveX: number,
    moveY: number,
    boost: boolean,
    particlesEnabled: boolean,
    tractionMult = 1.0,
    headlightIntensity = 0.4,
  ): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const mag = Math.hypot(moveX, moveY);
    let braking = false;

    if (mag > 0.08) {
      const scale = mag > 1 ? 1 / mag : 1;
      const nx = moveX * scale;
      const ny = moveY * scale;
      const targetSpeed = this.getEffectiveMaxSpeed() * (boost ? 1.15 : 1);
      const accelBlend = Math.min(1, dtSec * this.getAccelBlendRate() * tractionMult);
      const grip = this.getHandlingFactor() * tractionMult;
      const targetVx = nx * targetSpeed;
      const targetVy = ny * targetSpeed;

      // Detect active directional braking/reversal
      const curDot = body.velocity.x * nx + body.velocity.y * ny;
      if (curDot < -40) braking = true;

      const nextVx = Phaser.Math.Linear(body.velocity.x * (0.28 + 0.72 * grip), targetVx, accelBlend);
      const nextVy = Phaser.Math.Linear(body.velocity.y * (0.28 + 0.72 * grip), targetVy, accelBlend);
      body.setVelocity(nextVx, nextVy);

      if (Math.abs(nx) > Math.abs(ny)) {
        this.direction = nx < 0 ? 'left' : 'right';
      } else {
        this.direction = ny < 0 ? 'up' : 'down';
      }
      this.sprite.setFrame(DIR_FRAME[this.direction]);
      this.syncBodyForDirection();

      // Subtle steering lean
      const targetLean = this.direction === 'left' || this.direction === 'right' ? ny * 3.5 : nx * 3.5;
      this.leanAngle = Phaser.Math.Linear(this.leanAngle, targetLean, Math.min(1, dtSec * 8));
      this.sprite.setAngle(this.leanAngle);

      if (particlesEnabled) {
        this.exhaustTimer += dtSec;
        if (this.exhaustTimer >= 0.14) {
          this.exhaustTimer = 0;
          this.spawnExhaustPuff();
        }
      }
    } else {
      const spd = this.getCurrentSpeed();
      if (spd > 14) braking = true;
      const stopBlend = Math.min(1, dtSec * this.getBrakingBlendRate() * tractionMult);
      const nextVx = Phaser.Math.Linear(body.velocity.x, 0, stopBlend);
      const nextVy = Phaser.Math.Linear(body.velocity.y, 0, stopBlend);
      if (Math.hypot(nextVx, nextVy) < 10) {
        body.setVelocity(0, 0);
      } else {
        body.setVelocity(nextVx, nextVy);
      }
      this.leanAngle = Phaser.Math.Linear(this.leanAngle, 0, Math.min(1, dtSec * 10));
      this.sprite.setAngle(this.leanAngle);
    }

    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, 34, WORLD_WIDTH - 34);
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y, 34, WORLD_HEIGHT - 28);
    this.sprite.setDepth(this.sprite.y + 8);
    this.renderEffects(dtSec, braking, headlightIntensity);
  }

  public updateVisualFx(dtSec: number, headlightIntensity = 0.5): void {
    this.renderEffects(dtSec, false, headlightIntensity);
  }

  private renderEffects(dtSec: number, braking: boolean, headlightIntensity: number): void {
    if (!this.fxGfx || !this.fxGfx.scene) return;
    const sx = Math.round(this.sprite.x);
    const sy = Math.round(this.sprite.y);
    const isPolice = this.config.modelId === 'police';
    const hasStrobe = isPolice && (this.occupied || this.config.isTraffic);
    const hasBeam = this.occupied || isPolice || headlightIntensity > 0.55;
    const hasBrake = this.occupied && braking;

    if (!hasStrobe) {
      const fxKey = `${sx}_${sy}_${this.direction}_${hasBeam ? headlightIntensity.toFixed(2) : '0'}_${hasBrake ? 1 : 0}_${this.occupied ? 1 : 0}`;
      if (fxKey === this.lastFxKey) return;
      this.lastFxKey = fxKey;
    } else {
      this.lastFxKey = '';
    }

    this.fxGfx.clear();

    if (hasBeam) {
      const style = this.config.customization?.headlightStyle ?? 'warm';
      const hlColor = HEADLIGHT_COLORS[style];
      const beamAlpha = this.occupied ? 0.13 + headlightIntensity * 0.14 : 0.08;

      this.fxGfx.fillStyle(hlColor, beamAlpha);
      if (this.direction === 'right') {
        this.fxGfx.fillTriangle(sx + 20, sy - 6, sx + 88, sy - 26, sx + 88, sy + 14);
      } else if (this.direction === 'left') {
        this.fxGfx.fillTriangle(sx - 20, sy - 6, sx - 88, sy - 26, sx - 88, sy + 14);
      } else if (this.direction === 'up') {
        this.fxGfx.fillTriangle(sx, sy - 20, sx - 24, sy - 86, sx + 24, sy - 86);
      } else {
        this.fxGfx.fillTriangle(sx, sy + 8, sx - 24, sy + 76, sx + 24, sy + 76);
      }
    }

    // Rear brake light dots
    if (this.occupied && braking) {
      this.fxGfx.fillStyle(0xef4444, 0.92);
      if (this.direction === 'right') {
        this.fxGfx.fillCircle(sx - 20, sy - 10, 3);
        this.fxGfx.fillCircle(sx - 20, sy - 2, 3);
      } else if (this.direction === 'left') {
        this.fxGfx.fillCircle(sx + 20, sy - 10, 3);
        this.fxGfx.fillCircle(sx + 20, sy - 2, 3);
      } else if (this.direction === 'up') {
        this.fxGfx.fillCircle(sx - 9, sy + 6, 3);
        this.fxGfx.fillCircle(sx + 9, sy + 6, 3);
      } else {
        this.fxGfx.fillCircle(sx - 9, sy - 20, 3);
        this.fxGfx.fillCircle(sx + 9, sy - 20, 3);
      }
    }

    // Police emergency roof lightbar strobe
    if (isPolice && (this.occupied || this.config.isTraffic)) {
      this.strobePhase += dtSec * 8;
      const flashBlue = Math.sin(this.strobePhase) >= 0;
      const barY = sy - 18;
      this.fxGfx.fillStyle(flashBlue ? 0x3b82f6 : 0xef4444, 0.88);
      this.fxGfx.fillCircle(sx - 5, barY, 4.5);
      this.fxGfx.fillStyle(flashBlue ? 0xef4444 : 0x3b82f6, 0.88);
      this.fxGfx.fillCircle(sx + 5, barY, 4.5);
    }

    this.fxGfx.setDepth(sy + 9);
  }

  public findSafeExitPosition(worldSystem: WorldSystem): {x: number; y: number} {
    const vx = this.sprite.x;
    const vy = this.sprite.y;
    const offsets = [
      {dx: 0, dy: 42},
      {dx: 0, dy: -42},
      {dx: -44, dy: 0},
      {dx: 44, dy: 0},
      {dx: 38, dy: 38},
      {dx: -38, dy: 38},
      {dx: 38, dy: -38},
      {dx: -38, dy: -38},
      {dx: 0, dy: 64},
      {dx: 64, dy: 0},
      {dx: -64, dy: 0},
    ];
    for (const off of offsets) {
      const cx = Math.round(vx + off.dx);
      const cy = Math.round(vy + off.dy);
      if (worldSystem.isWalkablePosition(cx, cy)) {
        return {x: cx, y: cy};
      }
    }
    return {x: Math.round(vx), y: Math.round(vy + 36)};
  }

  public toInteractiveData(): InteractiveObjectData {
    const ownedTag = this.config.ownedRecordId ? 'Personal Vehicle' : this.config.subtitle;
    const alarmHint = this.config.alarmed ? ' · Alarmed' : '';
    return {
      id: `veh_int_${this.config.id}`,
      kind: 'vehicle',
      vehicleId: this.config.id,
      title: this.config.name,
      subtitle: `${ownedTag}${alarmHint}`,
      description: 'Drive this vehicle across CHAOS CITY roads using WASD / Joystick.',
      promptLabel: `Drive ${this.config.name}`,
      x: this.sprite.x,
      y: this.sprite.y,
      radius: 58,
    };
  }

  private syncBodyForDirection(): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (this.config.isScooter) {
      body.setSize(22, 18);
      body.setOffset((this.sprite.width - 22) / 2, this.sprite.height - 20);
      return;
    }
    if (this.direction === 'left' || this.direction === 'right') {
      body.setSize(42, 20);
      body.setOffset((this.sprite.width - 42) / 2, this.sprite.height - 24);
    } else {
      body.setSize(28, 30);
      body.setOffset((this.sprite.width - 28) / 2, this.sprite.height - 34);
    }
  }

  private spawnExhaustPuff(): void {
    const offX =
      this.direction === 'left' ? 24 : this.direction === 'right' ? -24 : 0;
    const offY =
      this.direction === 'up' ? 14 : this.direction === 'down' ? -14 : 4;
    const puff = this.scene.add
      .image(this.sprite.x + offX, this.sprite.y + offY, 'fx_dust')
      .setDepth(this.sprite.y - 2)
      .setScale(1.1)
      .setAlpha(0.75);

    this.scene.tweens.add({
      targets: puff,
      alpha: 0,
      scale: 1.8,
      y: puff.y - 8,
      duration: 320,
      onComplete: () => puff.destroy(),
    });
  }

  public destroy(): void {
    this.fxGfx.destroy();
    this.sprite.destroy();
  }
}
