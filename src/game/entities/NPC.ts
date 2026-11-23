import Phaser from 'phaser';
import {NpcQuestMarkerState} from '@/src/game/data/progressionData';
import {registerCharacterAnimations} from '@/src/game/entities/Player';
import {ensureCharacterSpritesheet} from '@/src/game/graphics/PixelArtGenerator';
import {Direction, NPCConfig, NPCWaypoint, TimeOfDayPhase} from '@/src/game/types/gameTypes';

export class NPC {
  public readonly config: NPCConfig;
  public readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly nameLabel: Phaser.GameObjects.Text;
  private readonly emoteLabel: Phaser.GameObjects.Text;
  private readonly questMarkerLabel: Phaser.GameObjects.Text;
  private questMarkerState: NpcQuestMarkerState = null;
  private readonly petSprite?: Phaser.GameObjects.Rectangle;
  private readonly petEarL?: Phaser.GameObjects.Rectangle;
  private readonly petEarR?: Phaser.GameObjects.Rectangle;
  private readonly textureKey: string;
  private activeWaypoints: NPCWaypoint[];
  private activePhase: TimeOfDayPhase | null = null;
  private waypointIndex = 0;
  private waitTimerMs = 0;
  private direction: Direction = 'down';
  private isMoving = false;
  private petPos: {x: number; y: number};
  private dodgeTimerMs = 0;
  private culled = false;
  private lastUiX = NaN;
  private lastUiY = NaN;

  constructor(scene: Phaser.Scene, config: NPCConfig) {
    this.config = config;
    this.textureKey = `npc_tex_${config.id}`;
    ensureCharacterSpritesheet(scene, this.textureKey, config.preset);
    registerCharacterAnimations(scene, this.textureKey);

    this.activeWaypoints = config.waypoints;
    const start = this.activeWaypoints[0] ?? {x: 400, y: 400, waitMs: 1000};
    this.sprite = scene.physics.add.sprite(start.x, start.y, this.textureKey, '0');
    this.sprite.setOrigin(0.5, 0.85);
    this.sprite.setCollideWorldBounds(true);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(18, 12);
    body.setOffset((this.sprite.width - 18) / 2, this.sprite.height - 16);
    body.setImmovable(true);

    this.nameLabel = scene.add
      .text(start.x, start.y - 36, config.name, {
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#bae6fd',
        backgroundColor: 'rgba(11, 18, 33, 0.72)',
        padding: {x: 4, y: 1},
      })
      .setOrigin(0.5, 1)
      .setDepth(9999);

    this.emoteLabel = scene.add
      .text(start.x, start.y - 51, '', {
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: '11px',
      })
      .setOrigin(0.5, 1)
      .setDepth(10000)
      .setVisible(false);

    this.questMarkerLabel = scene.add
      .text(start.x, start.y - 52, '[!]', {
        fontFamily: 'Outfit, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#fde047',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        padding: {x: 5, y: 2},
      })
      .setOrigin(0.5, 1)
      .setDepth(10002)
      .setVisible(false);

    this.petPos = {x: start.x - 18, y: start.y + 6};
    if (config.hasPet) {
      const colNum = parseInt(config.hasPet.color.replace('#', ''), 16) || 0xf59e0b;
      this.petSprite = scene.add
        .rectangle(this.petPos.x, this.petPos.y, 12, 9, colNum)
        .setStrokeStyle(1, 0x0f172a)
        .setDepth(this.petPos.y);
      this.petEarL = scene.add
        .rectangle(this.petPos.x - 4, this.petPos.y - 5, 3, 4, colNum)
        .setStrokeStyle(1, 0x0f172a)
        .setDepth(this.petPos.y + 1);
      this.petEarR = scene.add
        .rectangle(this.petPos.x + 4, this.petPos.y - 5, 3, 4, colNum)
        .setStrokeStyle(1, 0x0f172a)
        .setDepth(this.petPos.y + 1);
    }

    this.waitTimerMs = start.waitMs;
    this.direction = start.face ?? 'down';
    this.sprite.setFrame(this.getIdleFrame(this.direction));
    this.sprite.setDepth(this.sprite.y);
  }

  public getCurrentActivityLabel(phase: TimeOfDayPhase): string {
    const slot = this.config.routine?.find((r) => r.phase === phase);
    if (slot) return slot.locationLabel;
    return `${this.config.role} · Around City`;
  }

  public getNextChatLine(indexSeed = 0): string {
    if (this.config.chatLines && this.config.chatLines.length > 0) {
      return this.config.chatLines[indexSeed % this.config.chatLines.length];
    }
    return this.config.greeting;
  }

  public setQuestMarkerState(state: NpcQuestMarkerState): void {
    if (this.questMarkerState === state) return;
    this.questMarkerState = state;
    if (!state) {
      this.questMarkerLabel.setVisible(false);
      return;
    }
    if (state === 'ready') {
      this.questMarkerLabel.setText('[!] READY').setColor('#34d399');
    } else if (state === 'available') {
      this.questMarkerLabel.setText('[!]').setColor('#fde047');
    } else {
      this.questMarkerLabel.setText('[?]').setColor('#38bdf8');
    }
    this.questMarkerLabel.setVisible(!this.culled);
  }

  public getQuestMarkerState(): NpcQuestMarkerState {
    return this.questMarkerState;
  }

  private setVisualVisibility(visible: boolean): void {
    if (this.culled === !visible) return;
    this.culled = !visible;
    this.sprite.setVisible(visible);
    this.nameLabel.setVisible(visible);
    if (!visible) this.emoteLabel.setVisible(false);
    this.questMarkerLabel.setVisible(visible && this.questMarkerState !== null);
    this.petSprite?.setVisible(visible);
    this.petEarL?.setVisible(visible);
    this.petEarR?.setVisible(visible);
  }

  public update(
    dtMs: number,
    paused: boolean,
    phase?: TimeOfDayPhase,
    playerPos?: {x: number; y: number},
    fastVehiclePos?: {x: number; y: number; speed: number} | null,
  ): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (paused) {
      body.setVelocity(0, 0);
      return;
    }

    // Performance distance AI culling for NPCs > 980px from player
    if (playerPos) {
      const distPlayer = Math.hypot(this.sprite.x - playerPos.x, this.sprite.y - playerPos.y);
      if (distPlayer > 980) {
        body.setVelocity(0, 0);
        if (this.isMoving) {
          this.isMoving = false;
          this.sprite.anims.stop();
        }
        this.setVisualVisibility(false);
        return;
      }
      this.setVisualVisibility(true);
    }

    // Fast vehicle startled dodge reaction
    if (fastVehiclePos && fastVehiclePos.speed > 180) {
      const dxCar = this.sprite.x - fastVehiclePos.x;
      const dyCar = this.sprite.y - fastVehiclePos.y;
      const distCar = Math.hypot(dxCar, dyCar);
      if (distCar > 4 && distCar < 92) {
        this.dodgeTimerMs = 550;
        const ux = dxCar / distCar;
        const uy = dyCar / distCar;
        body.setVelocity(ux * 92, uy * 92);
        this.emoteLabel.setText('!').setVisible(true);
        this.sprite.setDepth(this.sprite.y);
        this.syncExtras(dtMs);
        return;
      }
    }

    if (this.dodgeTimerMs > 0) {
      this.dodgeTimerMs -= dtMs;
      if (this.dodgeTimerMs <= 0) {
        this.emoteLabel.setVisible(false);
      } else {
        this.syncExtras(dtMs);
        return;
      }
    }

    if (phase && phase !== this.activePhase && this.config.routine && this.config.routine.length > 0) {
      this.activePhase = phase;
      const slot = this.config.routine.find((r) => r.phase === phase);
      if (slot && slot.waypoints.length > 0) {
        this.activeWaypoints = slot.waypoints;
        this.waypointIndex = 0;
        this.waitTimerMs = 200;
      }
    }

    if (this.activeWaypoints.length === 0) {
      body.setVelocity(0, 0);
      return;
    }

    if (this.waitTimerMs > 0) {
      this.waitTimerMs -= dtMs;
      body.setVelocity(0, 0);
      if (this.isMoving) {
        this.isMoving = false;
        this.sprite.anims.stop();
        this.sprite.setFrame(this.getIdleFrame(this.direction));
      }
      const curWp = this.activeWaypoints[this.waypointIndex];
      if (curWp?.emote) {
        this.emoteLabel.setText(curWp.emote).setVisible(true);
      } else {
        this.emoteLabel.setVisible(false);
      }
      if (this.waitTimerMs <= 0 && this.activeWaypoints.length > 1) {
        this.waypointIndex = (this.waypointIndex + 1) % this.activeWaypoints.length;
        this.emoteLabel.setVisible(false);
      }
      this.syncExtras(dtMs);
      return;
    }

    this.emoteLabel.setVisible(false);
    const target = this.activeWaypoints[this.waypointIndex] ?? this.activeWaypoints[0];
    const dx = target.x - this.sprite.x;
    const dy = target.y - this.sprite.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= 4) {
      body.setVelocity(0, 0);
      this.sprite.setPosition(target.x, target.y);
      this.waitTimerMs = target.waitMs;
      if (target.face) this.direction = target.face;
      this.isMoving = false;
      this.sprite.anims.stop();
      this.sprite.setFrame(this.getIdleFrame(this.direction));
    } else {
      const vx = (dx / dist) * this.config.speed;
      const vy = (dy / dist) * this.config.speed;
      body.setVelocity(vx, vy);

      if (Math.abs(vx) > Math.abs(vy)) {
        this.direction = vx < 0 ? 'left' : 'right';
      } else {
        this.direction = vy < 0 ? 'up' : 'down';
      }

      const animKey = `${this.textureKey}_walk_${this.direction}`;
      if (this.sprite.anims.currentAnim?.key !== animKey || !this.sprite.anims.isPlaying) {
        this.sprite.play(animKey, true);
      }
      this.isMoving = true;
    }

    this.sprite.setDepth(this.sprite.y);
    this.syncExtras(dtMs);
  }

  private syncExtras(dtMs: number): void {
    const sx = Math.round(this.sprite.x);
    const sy = Math.round(this.sprite.y);
    if (sx !== this.lastUiX || sy !== this.lastUiY) {
      this.lastUiX = sx;
      this.lastUiY = sy;
      this.nameLabel.setPosition(sx, sy - 36);
      this.emoteLabel.setPosition(sx, sy - 51);
    }
    if (this.questMarkerState !== null) {
      const bob = Math.sin(performance.now() * 0.006) * 2.5;
      const offsetY = this.emoteLabel.visible ? sy - 66 : sy - 52;
      this.questMarkerLabel.setPosition(sx, Math.round(offsetY + bob));
    }

    if (this.petSprite && this.petEarL && this.petEarR) {
      const followOffX = this.direction === 'right' ? -18 : this.direction === 'left' ? 18 : -14;
      const followOffY = this.direction === 'down' ? -12 : 8;
      const targetX = sx + followOffX;
      const targetY = sy + followOffY;
      const alpha = Math.min(1, (dtMs / 1000) * 6);
      this.petPos.x = Phaser.Math.Linear(this.petPos.x, targetX, alpha);
      this.petPos.y = Phaser.Math.Linear(this.petPos.y, targetY, alpha);
      const bob = this.isMoving ? Math.sin(performance.now() * 0.015) * 1.5 : 0;
      const pxPos = Math.round(this.petPos.x);
      const pyPos = Math.round(this.petPos.y + bob);
      this.petSprite.setPosition(pxPos, pyPos).setDepth(pyPos);
      this.petEarL.setPosition(pxPos - 4, pyPos - 5).setDepth(pyPos + 1);
      this.petEarR.setPosition(pxPos + 4, pyPos - 5).setDepth(pyPos + 1);
    }
  }

  private getIdleFrame(dir: Direction): string {
    const map: Record<Direction, string> = {
      down: '0',
      up: '4',
      left: '8',
      right: '12',
    };
    return map[dir];
  }

  public destroy(): void {
    this.nameLabel.destroy();
    this.emoteLabel.destroy();
    this.questMarkerLabel.destroy();
    this.petSprite?.destroy();
    this.petEarL?.destroy();
    this.petEarR?.destroy();
    this.sprite.destroy();
  }
}
