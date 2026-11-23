import Phaser from 'phaser';
import {
  CHARACTER_PRESETS,
  PLAYER_BODY_HEIGHT,
  PLAYER_BODY_WIDTH,
  PLAYER_RUN_SPEED,
  PLAYER_WALK_SPEED,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '@/src/config/constants';
import {updatePlayerCustomTexture} from '@/src/game/graphics/PixelArtGenerator';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {authSystem} from '@/src/game/systems/AuthSystem';
import {economySystem} from '@/src/game/systems/EconomySystem';
import {multiplayerClient} from '@/src/game/systems/MultiplayerClient';
import {ownerBadgeService} from '@/src/game/systems/OwnerBadgeService';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {
  AnimationState,
  CharacterAppearanceConfig,
  CharacterIdentitySnapshot,
  Direction,
  EquippedClothing,
  HairOverride,
  InputSnapshot,
  PlayerEntityState,
} from '@/src/game/types/gameTypes';

export function registerCharacterAnimations(
  scene: Phaser.Scene,
  textureKey: string,
): void {
  const dirs: Direction[] = ['down', 'up', 'left', 'right'];
  dirs.forEach((dir, rowIdx) => {
    const base = rowIdx * 4;
    const walkKey = `${textureKey}_walk_${dir}`;
    if (!scene.anims.exists(walkKey)) {
      scene.anims.create({
        key: walkKey,
        frames: [
          {key: textureKey, frame: String(base + 1)},
          {key: textureKey, frame: String(base + 2)},
          {key: textureKey, frame: String(base + 3)},
          {key: textureKey, frame: String(base + 0)},
        ],
        frameRate: 8,
        repeat: -1,
      });
    }

    const runKey = `${textureKey}_run_${dir}`;
    if (!scene.anims.exists(runKey)) {
      scene.anims.create({
        key: runKey,
        frames: [
          {key: textureKey, frame: String(base + 1)},
          {key: textureKey, frame: String(base + 2)},
          {key: textureKey, frame: String(base + 3)},
          {key: textureKey, frame: String(base + 0)},
        ],
        frameRate: 13,
        repeat: -1,
      });
    }
  });

  // Action animations (Row 4 frames 17..19 = Interact, Row 5 frames 20..23 = Shop, Row 6 frames 24..27 = Celebrate)
  const interactKey = `${textureKey}_interact`;
  if (!scene.anims.exists(interactKey)) {
    scene.anims.create({
      key: interactKey,
      frames: [
        {key: textureKey, frame: '17'},
        {key: textureKey, frame: '18'},
        {key: textureKey, frame: '19'},
        {key: textureKey, frame: '17'},
      ],
      frameRate: 9,
      repeat: 0,
    });
  }

  const shopKey = `${textureKey}_shop`;
  if (!scene.anims.exists(shopKey)) {
    scene.anims.create({
      key: shopKey,
      frames: [
        {key: textureKey, frame: '20'},
        {key: textureKey, frame: '21'},
        {key: textureKey, frame: '22'},
        {key: textureKey, frame: '23'},
      ],
      frameRate: 6,
      repeat: -1,
    });
  }

  const celebrateKey = `${textureKey}_celebrate`;
  if (!scene.anims.exists(celebrateKey)) {
    scene.anims.create({
      key: celebrateKey,
      frames: [
        {key: textureKey, frame: '24'},
        {key: textureKey, frame: '25'},
        {key: textureKey, frame: '26'},
        {key: textureKey, frame: '27'},
      ],
      frameRate: 10,
      repeat: 1,
    });
  }
}

export class Player {
  public readonly id: string;
  public readonly sprite: Phaser.Physics.Arcade.Sprite;
  private nameLabel: Phaser.GameObjects.Text;
  private ownerCrown: Phaser.GameObjects.Image | null = null;
  private emoteBubble: Phaser.GameObjects.Text | null = null;
  private emoteTimer: Phaser.Time.TimerEvent | null = null;
  private appearanceId: string;
  private textureKey: string;
  private displayName: string;
  private direction: Direction = 'down';
  private animState: AnimationState = 'idle';
  private activeActionAnim: 'interact' | 'shop' | 'celebrate' | null = null;
  private isSitting = false;
  private isSleeping = false;
  private isDriving = false;
  private preSitPos: {x: number; y: number} | null = null;
  private preSleepPos: {x: number; y: number} | null = null;
  private sleepZzzTimer: Phaser.Time.TimerEvent | null = null;
  private dustPool: Phaser.GameObjects.Image[] = [];
  private dustTimer = 0;
  private dustPoolIdx = 0;
  private particlesEnabled = true;
  private worldWidth = WORLD_WIDTH;
  private worldHeight = WORLD_HEIGHT;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    appearanceId: string,
    displayName: string,
    id = 'local_player',
  ) {
    this.id = id;
    this.appearanceId = appearanceId;
    this.displayName = displayName;

    const preset =
      CHARACTER_PRESETS.find((p) => p.id === appearanceId) ?? CHARACTER_PRESETS[0];
    const save = saveSystem.getState();
    this.textureKey =
      id === 'local_player'
        ? updatePlayerCustomTexture(
            scene,
            preset,
            economySystem.getEquippedClothing(),
            economySystem.getHairOverride(),
            save.appearanceConfig,
          )
        : `char_${appearanceId}`;
    registerCharacterAnimations(scene, this.textureKey);

    this.sprite = scene.physics.add.sprite(x, y, this.textureKey, '0');
    this.sprite.setOrigin(0.5, 0.85);
    this.sprite.setCollideWorldBounds(true);

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT);
    body.setOffset(
      (this.sprite.width - PLAYER_BODY_WIDTH) / 2,
      this.sprite.height - PLAYER_BODY_HEIGHT - 4,
    );
    body.setMaxVelocity(PLAYER_RUN_SPEED * 1.4, PLAYER_RUN_SPEED * 1.4);

    this.sprite.on('animationcomplete', () => {
      if (this.activeActionAnim && this.activeActionAnim !== 'shop') {
        this.activeActionAnim = null;
        this.animState = 'idle';
        this.sprite.setFrame(this.getIdleFrame(this.direction));
      }
    });

    this.nameLabel = scene.add
      .text(x, y - 38, displayName, {
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#f8fafc',
        backgroundColor: 'rgba(11, 18, 33, 0.78)',
        padding: {x: 5, y: 2},
      })
      .setOrigin(0.5, 1)
      .setDepth(10000);

    if (scene.textures.exists('fx_owner_crown')) {
      this.ownerCrown = scene.add
        .image(x, y - 56, 'fx_owner_crown')
        .setOrigin(0.5, 1)
        .setDepth(10001)
        .setVisible(false);
    }

    this.emoteBubble = scene.add
      .text(x, y - 60, '', {
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: '14px',
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        color: '#fef08a',
        padding: {x: 6, y: 3},
      })
      .setOrigin(0.5, 1)
      .setDepth(10003)
      .setVisible(false);

    for (let i = 0; i < 8; i++) {
      const dust = scene.add
        .image(0, 0, 'fx_dust')
        .setVisible(false)
        .setActive(false)
        .setAlpha(0.7);
      this.dustPool.push(dust);
    }

    this.refreshOwnerBadge();
    this.updateDepth();
  }

  public refreshOwnerBadge(): void {
    if (this.id !== 'local_player') return;
    const acct = authSystem.getCurrentUser();
    const mpStatus = multiplayerClient.getStatus();
    const isVerified = ownerBadgeService.isVerifiedOwnerAccount(
      acct?.uid,
      acct?.username,
      mpStatus.selfIsOwner,
    );
    if (this.ownerCrown) {
      this.ownerCrown.setVisible(isVerified);
    }
    if (isVerified) {
      this.nameLabel.setText(`OWNER ${this.displayName}`);
      this.nameLabel.setColor('#fde047');
    } else {
      this.nameLabel.setText(this.displayName);
      this.nameLabel.setColor('#f8fafc');
    }
    this.syncOverlayPositions();
  }

  public showEmoteBubble(emoteId: string): void {
    const labelMap: Record<string, string> = {
      wave: '👋 Wave',
      dance: '💃 Dance',
      cheer: '🎉 Cheer',
      sit: '🪑 Chill',
      heart: '💛 Love',
      music: '🎵 Vibe',
    };
    const text = labelMap[emoteId] || `✨ ${emoteId}`;
    if (this.emoteBubble) {
      this.emoteBubble.setText(text).setVisible(true);
      this.syncOverlayPositions();
    }
    if (emoteId === 'dance' || emoteId === 'cheer') {
      this.playActionAnimation('celebrate');
    } else if (emoteId === 'wave') {
      this.playActionAnimation('interact');
    }
    this.emoteTimer?.remove(false);
    this.emoteTimer = this.sprite.scene.time.delayedCall(2600, () => {
      this.emoteBubble?.setVisible(false);
    });
  }

  public getCurrentDirection(): Direction {
    return this.direction;
  }

  public getCurrentAnimState(): AnimationState {
    return this.animState;
  }

  public setWorldBounds(width: number, height: number): void {
    this.worldWidth = Math.max(64, width);
    this.worldHeight = Math.max(64, height);
  }

  public setParticlesEnabled(enabled: boolean): void {
    this.particlesEnabled = enabled;
  }

  public setDirection(dir: Direction): void {
    this.direction = dir;
    if (!this.isSitting && !this.activeActionAnim) {
      this.sprite.setFrame(this.getIdleFrame(dir));
    }
  }

  public applyAppearance(appearanceId: string, displayName: string): void {
    const save = saveSystem.getState();
    this.applyCustomAppearance(
      appearanceId,
      displayName,
      economySystem.getEquippedClothing(),
      economySystem.getHairOverride(),
      save.appearanceConfig,
    );
  }

  public applyCustomAppearance(
    appearanceId: string,
    displayName: string,
    equipped: EquippedClothing,
    hairOverride: HairOverride,
    appearanceConfig?: CharacterAppearanceConfig,
  ): void {
    this.appearanceId = appearanceId;
    this.displayName = displayName;
    const preset =
      CHARACTER_PRESETS.find((p) => p.id === appearanceId) ?? CHARACTER_PRESETS[0];
    this.textureKey = updatePlayerCustomTexture(
      this.sprite.scene,
      preset,
      equipped,
      hairOverride,
      appearanceConfig,
    );
    registerCharacterAnimations(this.sprite.scene, this.textureKey);
    if (!this.activeActionAnim) {
      this.sprite.setTexture(
        this.textureKey,
        this.isSitting ? '16' : this.getIdleFrame(this.direction),
      );
    }
    this.refreshOwnerBadge();
  }

  public playActionAnimation(action: 'interact' | 'shop' | 'celebrate'): void {
    if (this.isSitting) return;
    this.activeActionAnim = action;
    this.animState = action;
    this.direction = 'down';
    const key = `${this.textureKey}_${action}`;
    if (this.sprite.scene.anims.exists(key)) {
      this.sprite.play(key, true);
    }
  }

  public stopActionAnimation(): void {
    if (!this.activeActionAnim) return;
    this.activeActionAnim = null;
    if (!this.isSitting) {
      this.animState = 'idle';
      this.sprite.anims.stop();
      this.sprite.setFrame(this.getIdleFrame(this.direction));
    }
  }

  public getIsSitting(): boolean {
    return this.isSitting;
  }

  public getIsSleeping(): boolean {
    return this.isSleeping;
  }

  public getIsDriving(): boolean {
    return this.isDriving;
  }

  public setDriving(driving: boolean): void {
    if (this.isDriving === driving) return;
    if (this.isSitting) this.standUp();
    if (this.isSleeping) this.wakeUp();
    this.isDriving = driving;
    this.activeActionAnim = null;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (driving) {
      body.setVelocity(0, 0);
      body.enable = false;
      this.sprite.setVisible(false);
      this.animState = 'driving';
    } else {
      body.enable = true;
      body.setVelocity(0, 0);
      this.sprite.setVisible(true);
      this.animState = 'idle';
      this.sprite.setFrame(this.getIdleFrame(this.direction));
      this.updateDepth();
      this.syncOverlayPositions();
    }
  }

  public syncPositionToVehicle(vx: number, vy: number, dir: Direction): void {
    this.sprite.setPosition(vx, vy);
    this.direction = dir;
    this.nameLabel.setPosition(Math.round(vx), Math.round(vy - 34));
  }

  public sitAt(seatX: number, seatY: number): void {
    if (this.isSitting || this.isSleeping || this.isDriving) return;
    this.activeActionAnim = null;
    this.isSitting = true;
    this.preSitPos = {x: this.sprite.x, y: this.sprite.y};
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;
    this.sprite.setPosition(seatX, seatY);
    this.direction = 'down';
    this.animState = 'sit';
    this.sprite.anims.stop();
    this.sprite.setFrame('16');
    this.updateDepth();
  }

  public standUp(): void {
    if (!this.isSitting) return;
    this.isSitting = false;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (this.preSitPos) {
      this.sprite.setPosition(this.preSitPos.x, this.preSitPos.y);
      this.preSitPos = null;
    }
    body.enable = true;
    body.setVelocity(0, 0);
    this.animState = 'idle';
    this.sprite.setFrame(this.getIdleFrame(this.direction));
    this.updateDepth();
  }

  public sleepAt(bedX: number, bedY: number): void {
    if (this.isSleeping || this.isDriving) return;
    if (this.isSitting) this.standUp();
    this.activeActionAnim = null;
    this.isSleeping = true;
    this.preSleepPos = {x: this.sprite.x, y: this.sprite.y};
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;
    this.sprite.anims.stop();
    this.sprite.setFrame('0');
    this.sprite.setPosition(bedX - 8, bedY + 2);
    this.sprite.setAngle(-86);
    this.animState = 'sleep';
    this.updateDepth();
    this.syncOverlayPositions();

    this.spawnSleepZzz();
    this.sleepZzzTimer?.remove(false);
    this.sleepZzzTimer = this.sprite.scene.time.addEvent({
      delay: 900,
      loop: true,
      callback: () => {
        if (this.isSleeping) this.spawnSleepZzz();
      },
    });
  }

  public wakeUp(): void {
    if (!this.isSleeping) return;
    this.isSleeping = false;
    this.sleepZzzTimer?.remove(false);
    this.sleepZzzTimer = null;
    this.sprite.setAngle(0);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    if (this.preSleepPos) {
      this.sprite.setPosition(this.preSleepPos.x, this.preSleepPos.y);
      this.preSleepPos = null;
    }
    body.enable = true;
    body.setVelocity(0, 0);
    this.animState = 'idle';
    this.direction = 'down';
    this.sprite.setFrame(this.getIdleFrame(this.direction));
    this.updateDepth();
    this.syncOverlayPositions();
  }

  private spawnSleepZzz(): void {
    const scene = this.sprite.scene;
    if (!scene) return;
    const zzz = scene.add
      .image(this.sprite.x + Phaser.Math.Between(-4, 6), this.sprite.y - 24, 'fx_zzz')
      .setDepth(10002)
      .setScale(0.95)
      .setAlpha(0.95);
    scene.tweens.add({
      targets: zzz,
      y: zzz.y - 24,
      x: zzz.x + Phaser.Math.Between(-6, 8),
      scale: 1.25,
      alpha: 0,
      duration: 1200,
      ease: 'Sine.easeOut',
      onComplete: () => zzz.destroy(),
    });
  }

  public update(dtSec: number, input: InputSnapshot): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    if (this.isSleeping || this.isDriving) {
      this.syncOverlayPositions();
      return;
    }

    if (this.isSitting) {
      if (Math.abs(input.moveX) > 0.25 || Math.abs(input.moveY) > 0.25) {
        this.standUp();
      } else {
        this.syncOverlayPositions();
        return;
      }
    }

    let vx = input.moveX;
    let vy = input.moveY;
    const mag = Math.hypot(vx, vy);

    if (mag > 0.05) {
      this.activeActionAnim = null;
      const scale = mag > 1 ? 1 / mag : 1;
      vx *= scale;
      vy *= scale;

      const mult = this.id === 'local_player' ? economySystem.getSpeedMultiplier() : 1;
      const speed = (input.isRunning ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED) * mult;
      const targetVx = vx * speed;
      const targetVy = vy * speed;

      const blend = Math.min(1, dtSec * 18);
      const nextVx = Phaser.Math.Linear(body.velocity.x, targetVx, blend);
      const nextVy = Phaser.Math.Linear(body.velocity.y, targetVy, blend);
      body.setVelocity(nextVx, nextVy);

      if (Math.abs(vx) > Math.abs(vy)) {
        this.direction = vx < 0 ? 'left' : 'right';
      } else {
        this.direction = vy < 0 ? 'up' : 'down';
      }

      const nextAnim: AnimationState = input.isRunning ? 'run' : 'walk';
      this.animState = nextAnim;

      const animKey = `${this.textureKey}_${nextAnim}_${this.direction}`;
      if (this.sprite.anims.currentAnim?.key !== animKey || !this.sprite.anims.isPlaying) {
        this.sprite.play(animKey, true);
      }

      audioSystem.playFootstep(input.isRunning);

      if (input.isRunning && this.particlesEnabled) {
        this.dustTimer += dtSec;
        if (this.dustTimer >= 0.14) {
          this.dustTimer = 0;
          this.spawnDustPuff();
        }
      }
    } else {
      const stopBlend = Math.min(1, dtSec * 22);
      const nextVx = Phaser.Math.Linear(body.velocity.x, 0, stopBlend);
      const nextVy = Phaser.Math.Linear(body.velocity.y, 0, stopBlend);
      if (Math.abs(nextVx) < 6 && Math.abs(nextVy) < 6) {
        body.setVelocity(0, 0);
      } else {
        body.setVelocity(nextVx, nextVy);
      }

      if (!this.activeActionAnim && this.animState !== 'idle') {
        this.animState = 'idle';
        this.sprite.anims.stop();
        this.sprite.setFrame(this.getIdleFrame(this.direction));
      }
    }

    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, 16, this.worldWidth - 16);
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y, 24, this.worldHeight - 8);

    this.updateDepth();
    this.syncOverlayPositions();
  }

  public stopImmediately(): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    if (!this.isSitting && !this.activeActionAnim) {
      this.animState = 'idle';
      this.sprite.anims.stop();
      this.sprite.setFrame(this.getIdleFrame(this.direction));
    }
  }

  private spawnDustPuff(): void {
    const puff = this.dustPool[this.dustPoolIdx];
    this.dustPoolIdx = (this.dustPoolIdx + 1) % this.dustPool.length;
    if (!puff || !this.sprite.scene) return;

    this.sprite.scene.tweens.killTweensOf(puff);
    puff
      .setPosition(this.sprite.x + Phaser.Math.Between(-5, 5), this.sprite.y - 2)
      .setScale(0.9)
      .setAlpha(0.75)
      .setDepth(this.sprite.y - 1)
      .setVisible(true)
      .setActive(true);

    this.sprite.scene.tweens.add({
      targets: puff,
      alpha: 0,
      scale: 1.5,
      y: puff.y - 7,
      duration: 260,
      onComplete: () => {
        puff.setVisible(false).setActive(false);
      },
    });
  }

  private updateDepth(): void {
    this.sprite.setDepth(this.isSitting || this.isSleeping ? this.sprite.y + 24 : this.sprite.y);
  }

  private syncOverlayPositions(): void {
    const sx = Math.round(this.sprite.x);
    const sy = Math.round(this.sprite.y);
    this.nameLabel.setPosition(sx, sy - 36);
    this.ownerCrown?.setPosition(sx, sy - 54);
    this.emoteBubble?.setPosition(sx, this.ownerCrown?.visible ? sy - 70 : sy - 56);
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

  public getEntityState(): PlayerEntityState {
    return {
      id: this.id,
      displayName: this.displayName,
      appearanceId: this.appearanceId,
      x: this.sprite.x,
      y: this.sprite.y,
      direction: this.direction,
      animState: this.animState,
      isDriving: this.isDriving,
    };
  }

  public getIdentitySnapshot(): CharacterIdentitySnapshot {
    return economySystem.getIdentitySnapshot(this.animState);
  }

  public destroy(): void {
    this.sleepZzzTimer?.remove(false);
    this.sleepZzzTimer = null;
    this.emoteTimer?.remove(false);
    this.emoteTimer = null;
    this.nameLabel.destroy();
    this.ownerCrown?.destroy();
    this.emoteBubble?.destroy();
    for (const puff of this.dustPool) {
      puff.destroy();
    }
    this.dustPool = [];
    this.sprite.destroy();
  }
}
