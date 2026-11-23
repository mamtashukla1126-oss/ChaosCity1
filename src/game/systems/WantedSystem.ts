import Phaser from 'phaser';
import {CHARACTER_PRESETS, WORLD_HEIGHT, WORLD_WIDTH} from '@/src/config/constants';
import {getVehicleModelSpec} from '@/src/game/data/cityLifeData';
import {Vehicle} from '@/src/game/entities/Vehicle';
import {ensureCharacterSpritesheet} from '@/src/game/graphics/PixelArtGenerator';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {CollisionSystem} from '@/src/game/systems/CollisionSystem';
import {WorldSystem} from '@/src/game/systems/WorldSystem';
import {Direction} from '@/src/game/types/gameTypes';

class WantedStore {
  private stars = 0; // 0..4
  private evadeTimerSec = 0;
  private lastReason = '';
  private listeners = new Set<(stars: number, reason: string) => void>();

  public getStars(): number {
    return this.stars;
  }

  public getEvadeTimerSec(): number {
    return this.evadeTimerSec;
  }

  public getLastReason(): string {
    return this.lastReason;
  }

  public addWanted(delta: number, reason: string): number {
    const prev = this.stars;
    this.stars = Math.max(0, Math.min(4, this.stars + delta));
    this.lastReason = reason;
    if (this.stars > 0) {
      this.evadeTimerSec = 18 + this.stars * 5;
    }
    if (this.stars !== prev || delta > 0) {
      this.emit();
    }
    return this.stars;
  }

  public setEvadeTimer(sec: number): void {
    this.evadeTimerSec = Math.max(0, sec);
  }

  public clearWanted(reason = 'Cleared'): void {
    const had = this.stars > 0;
    this.stars = 0;
    this.evadeTimerSec = 0;
    this.lastReason = reason;
    if (had) this.emit();
  }

  public subscribe(cb: (stars: number, reason: string) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emit(): void {
    for (const cb of this.listeners) cb(this.stars, this.lastReason);
  }
}

export const wantedState = new WantedStore();

interface PoliceUnit {
  vehicle: Vehicle;
  collider: Phaser.Physics.Arcade.Collider;
  lightFlashAcc: number;
  unstuckTimer: number;
  lastX: number;
  lastY: number;
  evadeDir: Direction;
}

interface FootOfficer {
  sprite: Phaser.GameObjects.Sprite;
  badgeText: Phaser.GameObjects.Text;
  collider: Phaser.Physics.Arcade.Collider;
  unstuckTimer: number;
}

export interface WantedSystemCallbacks {
  onWantedChanged?: (stars: number, reason: string) => void;
  onAlertToast?: (msg: string) => void;
}

export class WantedSystem {
  private units: PoliceUnit[] = [];
  private footOfficers: FootOfficer[] = [];
  private sirenTimer = 0;
  private collisionCooldown = 0;
  private speedViolationTimer = 0;
  private unsub: (() => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldSystem: WorldSystem,
    private readonly collisionSystem: CollisionSystem,
    private readonly callbacks: WantedSystemCallbacks = {},
  ) {
    this.unsub = wantedState.subscribe((stars, reason) => {
      this.callbacks.onWantedChanged?.(stars, reason);
      if (stars === 0) {
        this.despawnAllUnits();
      }
    });
  }

  public getWantedStars(): number {
    return wantedState.getStars();
  }

  public getEvadeSeconds(): number {
    return Math.ceil(wantedState.getEvadeTimerSec());
  }

  public reportAlarmedVehicleEntry(vehicleName: string): void {
    audioSystem.playAlarm();
    const stars = wantedState.addWanted(1, `Alarm triggered on ${vehicleName}`);
    this.callbacks.onAlertToast?.(
      `Car Alarm Triggered! Wanted Level ★${stars} — Evade patrols or visit Police HQ!`,
    );
  }

  public reportTrafficBump(): void {
    if (this.collisionCooldown > 0) return;
    this.collisionCooldown = 3.5;
    const stars = wantedState.addWanted(1, 'Reckless driving collision');
    audioSystem.playSirenChirp();
    this.callbacks.onAlertToast?.(`Wanted ★${stars}: Reckless driving reported!`);
  }

  public clearWanted(): void {
    wantedState.clearWanted('Police Precinct Clearance');
    this.despawnAllUnits();
  }

  public update(
    dtSec: number,
    paused: boolean,
    playerX: number,
    playerY: number,
    playerSpeed: number,
    isDriving: boolean,
  ): void {
    if (this.collisionCooldown > 0) {
      this.collisionCooldown = Math.max(0, this.collisionCooldown - dtSec);
    }

    if (paused) {
      for (const u of this.units) u.vehicle.stopImmediately();
      return;
    }

    // Subtle speeding trigger at high sustained speeds near city intersections
    if (isDriving && playerSpeed > 335) {
      this.speedViolationTimer += dtSec;
      if (this.speedViolationTimer >= 4.2) {
        this.speedViolationTimer = 0;
        if (wantedState.getStars() < 2) {
          const stars = wantedState.addWanted(1, 'Excessive city speeding');
          audioSystem.playSirenChirp();
          this.callbacks.onAlertToast?.(`Speed Camera Alert! Wanted Level ★${stars}`);
        }
      }
    } else {
      this.speedViolationTimer = Math.max(0, this.speedViolationTimer - dtSec * 0.8);
    }

    const stars = wantedState.getStars();
    if (stars <= 0) {
      if (this.units.length > 0 || this.footOfficers.length > 0) {
        this.despawnAllUnits();
      }
      return;
    }

    // Desired unit counts scale safely with Wanted Level (max 2 cruisers, 2 officers)
    const desiredCruisers = Math.min(2, stars);
    const desiredOfficers = stars >= 2 ? Math.min(2, stars - 1) : 0;

    while (this.units.length < desiredCruisers) {
      this.spawnPoliceCruiser(playerX, playerY, this.units.length);
    }
    while (this.units.length > desiredCruisers) {
      const removed = this.units.pop();
      if (removed) {
        this.collisionSystem.removeCollider(removed.collider);
        removed.vehicle.destroy();
      }
    }

    while (this.footOfficers.length < desiredOfficers) {
      this.spawnFootOfficer(playerX, playerY);
    }
    while (this.footOfficers.length > desiredOfficers) {
      const removed = this.footOfficers.pop();
      if (removed) {
        this.collisionSystem.removeCollider(removed.collider);
        removed.sprite.destroy();
        removed.badgeText.destroy();
      }
    }

    // Siren chirp cadence when pursuing
    this.sirenTimer += dtSec;
    if (this.sirenTimer >= 3.2) {
      this.sirenTimer = 0;
      const closest = this.units.reduce(
        (min, u) => Math.min(min, Math.hypot(u.vehicle.sprite.x - playerX, u.vehicle.sprite.y - playerY)),
        Infinity,
      );
      if (closest < 520) {
        audioSystem.playSirenChirp();
      }
    }

    let closestDist = Infinity;

    // Update cruisers
    for (const unit of this.units) {
      const vx = unit.vehicle.sprite.x;
      const vy = unit.vehicle.sprite.y;
      const dx = playerX - vx;
      const dy = playerY - vy;
      const dist = Math.hypot(dx, dy);
      closestDist = Math.min(closestDist, dist);

      // Re-anchor far-behind cruisers cleanly within patrol ring
      if (dist > 1100) {
        const spot = this.findPatrolSpawnSpot(playerX, playerY, 440);
        if (spot) {
          unit.vehicle.sprite.setPosition(spot.x, spot.y);
          unit.vehicle.stopImmediately();
        }
        continue;
      }

      // Pursuit / Search velocity with distance stand-off so cruiser doesn't pin player awkwardly
      const pursuitSpeed = Math.min(255, 165 + stars * 22);
      if (dist > 78) {
        let dirX = dx / Math.max(1, dist);
        let dirY = dy / Math.max(1, dist);

        // Unstuck heuristic if cruiser barely moved over 0.8s
        const moved = Math.hypot(vx - unit.lastX, vy - unit.lastY);
        unit.lastX = vx;
        unit.lastY = vy;
        if (moved < 18 * dtSec) {
          unit.unstuckTimer += dtSec;
          if (unit.unstuckTimer > 0.65) {
            // Perpendicular slide to steer around corner obstacle
            const perpX = -dirY;
            const perpY = dirX;
            dirX = perpX;
            dirY = perpY;
            if (unit.unstuckTimer > 1.35) {
              unit.unstuckTimer = 0;
            }
          }
        } else {
          unit.unstuckTimer = 0;
        }

        const body = unit.vehicle.sprite.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(dirX * pursuitSpeed, dirY * pursuitSpeed);

        const nextDir: Direction =
          Math.abs(dirX) > Math.abs(dirY) ? (dirX < 0 ? 'left' : 'right') : dirY < 0 ? 'up' : 'down';
        if (nextDir !== unit.vehicle.getDirection()) {
          unit.vehicle.setDirection(nextDir);
        }
        unit.vehicle.sprite.setDepth(unit.vehicle.sprite.y + 8);
      } else {
        unit.vehicle.stopImmediately();
      }
      unit.vehicle.updateVisualFx(dtSec, 0.9);
    }

    // Update foot officers
    for (const off of this.footOfficers) {
      const dx = playerX - off.sprite.x;
      const dy = playerY - off.sprite.y;
      const dist = Math.hypot(dx, dy);
      closestDist = Math.min(closestDist, dist);

      if (dist > 820) {
        const spot = this.findPatrolSpawnSpot(playerX, playerY, 320);
        if (spot) off.sprite.setPosition(spot.x, spot.y);
      } else if (dist > 54) {
        const speed = 108 + stars * 8;
        const body = off.sprite.body as Phaser.Physics.Arcade.Body | undefined;
        body?.setVelocity((dx / dist) * speed, (dy / dist) * speed);
      } else {
        const body = off.sprite.body as Phaser.Physics.Arcade.Body | undefined;
        body?.setVelocity(0, 0);
      }
      off.sprite.setDepth(off.sprite.y);
      off.badgeText.setPosition(off.sprite.x, off.sprite.y - 26);
      off.badgeText.setDepth(off.sprite.y + 5);
    }

    // Evade cooldown decay when player puts distance between themselves and police
    if (closestDist > 420) {
      const nextEvade = wantedState.getEvadeTimerSec() - dtSec;
      wantedState.setEvadeTimer(nextEvade);
      if (nextEvade <= 0) {
        wantedState.clearWanted('Evaded Patrols');
        this.callbacks.onAlertToast?.('Pursuit Evaded! Wanted Level cleared.');
      }
    } else {
      // Refresh cooldown when in active sight range
      wantedState.setEvadeTimer(Math.max(wantedState.getEvadeTimerSec(), 12 + stars * 4));
    }
  }

  public getPoliceBlips(): {x: number; y: number}[] {
    return this.units.map((u) => ({x: u.vehicle.sprite.x, y: u.vehicle.sprite.y}));
  }

  private findPatrolSpawnSpot(
    playerX: number,
    playerY: number,
    radius: number,
  ): {x: number; y: number} | null {
    for (let i = 0; i < 14; i++) {
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.3;
      const sx = Phaser.Math.Clamp(Math.round(playerX + Math.cos(angle) * radius), 96, WORLD_WIDTH - 96);
      const sy = Phaser.Math.Clamp(Math.round(playerY + Math.sin(angle) * radius), 96, WORLD_HEIGHT - 96);
      if (this.worldSystem.isWalkablePosition(sx, sy)) {
        return {x: sx, y: sy};
      }
    }
    return null;
  }

  private spawnPoliceCruiser(playerX: number, playerY: number, idx: number): void {
    if (!this.scene?.sys?.isActive()) return;
    const spot = this.findPatrolSpawnSpot(playerX, playerY, 380 + idx * 90) ?? {
      x: Phaser.Math.Clamp(playerX + 360, 120, WORLD_WIDTH - 120),
      y: playerY,
    };
    const spec = getVehicleModelSpec('police');
    const vehicle = new Vehicle(this.scene, {
      id: `police_unit_${Date.now()}_${idx}`,
      name: spec.name,
      subtitle: 'CCPD Patrol Unit',
      texture: `veh_${spec.modelId}`,
      x: spot.x,
      y: spot.y,
      direction: 'left',
      maxSpeed: spec.baseSpeed,
      modelId: 'police',
      isTraffic: true,
    });
    const collider = this.collisionSystem.bindSpriteCollider(vehicle.sprite);
    this.units.push({
      vehicle,
      collider,
      lightFlashAcc: 0,
      unstuckTimer: 0,
      lastX: spot.x,
      lastY: spot.y,
      evadeDir: 'left',
    });
  }

  private spawnFootOfficer(playerX: number, playerY: number): void {
    if (!this.scene?.sys?.isActive()) return;
    const spot = this.findPatrolSpawnSpot(playerX, playerY, 260) ?? {
      x: Phaser.Math.Clamp(playerX - 240, 120, WORLD_WIDTH - 120),
      y: playerY,
    };
    const officerAppearance = {
      ...CHARACTER_PRESETS[0],
      jacketColor: '#1d4ed8',
      pantsColor: '#0f172a',
      hairColor: '#1e293b',
      accessory: 'cap' as const,
    };
    const texKey = 'ccpd_officer_sheet';
    ensureCharacterSpritesheet(this.scene, texKey, officerAppearance);
    const sprite = this.scene.physics.add.sprite(spot.x, spot.y, texKey, '0');
    sprite.setCollideWorldBounds(true);
    const collider = this.collisionSystem.bindSpriteCollider(sprite);
    const badgeText = this.scene.add
      .text(spot.x, spot.y - 26, 'OFFICER', {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '9px',
        fontStyle: 'bold',
        color: '#93c5fd',
        backgroundColor: 'rgba(15, 23, 42, 0.86)',
        padding: {x: 4, y: 1},
      })
      .setOrigin(0.5, 1);
    this.footOfficers.push({sprite, badgeText, collider, unstuckTimer: 0});
  }

  private despawnAllUnits(): void {
    for (const u of this.units) {
      this.collisionSystem.removeCollider(u.collider);
      u.vehicle.destroy();
    }
    this.units = [];
    for (const f of this.footOfficers) {
      this.collisionSystem.removeCollider(f.collider);
      f.sprite.destroy();
      f.badgeText.destroy();
    }
    this.footOfficers = [];
  }

  public destroy(): void {
    this.unsub?.();
    this.unsub = null;
    this.despawnAllUnits();
  }
}
