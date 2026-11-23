import Phaser from 'phaser';
import {CHARACTER_PRESETS} from '@/src/config/constants';
import {registerCharacterAnimations} from '@/src/game/entities/Player';
import {updatePlayerCustomTexture} from '@/src/game/graphics/PixelArtGenerator';
import {
  ensureCustomVehicleTexture,
  getVehicleCustomizationKey,
} from '@/src/game/graphics/VehicleArtGenerator';
import {ownerBadgeService} from '@/src/game/systems/OwnerBadgeService';
import {Direction, RemotePlayerState} from '@/src/game/types/gameTypes';

const EMOTE_LABELS: Record<string, string> = {
  wave: '👋 Wave',
  dance: '💃 Dance',
  cheer: '🎉 Cheer',
  sit: '🪑 Chill',
  heart: '💛 Love',
  music: '🎵 Vibe',
};

export class RemotePlayer {
  public readonly uid: string;
  private scene: Phaser.Scene;
  public readonly sprite: Phaser.GameObjects.Sprite;
  private vehicleSprite: Phaser.GameObjects.Sprite | null = null;
  private onSelectCallback: (uid: string) => void;
  private nameLabel: Phaser.GameObjects.Text;
  private crownSprite: Phaser.GameObjects.Image | null = null;
  private emoteBubble: Phaser.GameObjects.Text;
  private shadow: Phaser.GameObjects.Ellipse;
  private textureKey: string;
  private appearanceSig = '';
  private vehicleSig = '';

  public state: RemotePlayerState;
  private targetX: number;
  private targetY: number;

  constructor(
    scene: Phaser.Scene,
    initial: RemotePlayerState,
    onSelect: (uid: string) => void,
  ) {
    this.uid = initial.uid;
    this.scene = scene;
    this.state = initial;
    this.onSelectCallback = onSelect;
    this.targetX = initial.x;
    this.targetY = initial.y;

    this.textureKey = `char_remote_${initial.uid}`;
    this.rebuildAppearanceTexture(initial);

    this.shadow = scene.add
      .ellipse(initial.x, initial.y - 2, 18, 7, 0x020617, 0.35)
      .setDepth(initial.y - 1);

    this.sprite = scene.add
      .sprite(initial.x, initial.y, this.textureKey, '0')
      .setOrigin(0.5, 0.85)
      .setInteractive({useHandCursor: true});
    this.sprite.on('pointerdown', () => onSelect(this.uid));

    this.nameLabel = scene.add
      .text(initial.x, initial.y - 36, initial.displayName, {
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#f8fafc',
        backgroundColor: 'rgba(11, 18, 33, 0.82)',
        padding: {x: 6, y: 2},
      })
      .setOrigin(0.5, 1)
      .setDepth(10002)
      .setInteractive({useHandCursor: true});
    this.nameLabel.on('pointerdown', () => onSelect(this.uid));

    if (scene.textures.exists('fx_owner_crown')) {
      this.crownSprite = scene.add
        .image(initial.x, initial.y - 54, 'fx_owner_crown')
        .setOrigin(0.5, 1)
        .setDepth(10003)
        .setVisible(false);
    }

    this.emoteBubble = scene.add
      .text(initial.x, initial.y - 60, '', {
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        fontSize: '13px',
        color: '#fef08a',
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        padding: {x: 6, y: 3},
      })
      .setOrigin(0.5, 1)
      .setDepth(10004)
      .setVisible(false);

    this.applyState(initial, true);
  }

  private rebuildAppearanceTexture(data: RemotePlayerState): void {
    const sig = JSON.stringify({
      a: data.appearanceId,
      c: data.appearanceConfig,
      e: data.equippedClothing,
      h: data.hairOverride,
    });
    if (sig === this.appearanceSig) return;
    this.appearanceSig = sig;

    const preset =
      CHARACTER_PRESETS.find((p) => p.id === data.appearanceId) ?? CHARACTER_PRESETS[0];
    this.textureKey = updatePlayerCustomTexture(
      this.scene,
      preset,
      data.equippedClothing,
      data.hairOverride ?? undefined,
      data.appearanceConfig,
      `char_remote_${data.uid}`,
    );
    registerCharacterAnimations(this.scene, this.textureKey);
  }

  public applyState(next: RemotePlayerState, snap = false): void {
    this.state = next;
    this.targetX = next.x;
    this.targetY = next.y;
    if (snap) {
      this.sprite.setPosition(next.x, next.y);
    }
    this.rebuildAppearanceTexture(next);

    const verifiedOwner = ownerBadgeService.isVerifiedOwnerAccount(
      next.uid,
      next.username,
      next.isOwner,
    );
    if (verifiedOwner) {
      this.nameLabel.setText(`OWNER ${next.displayName}`);
      this.nameLabel.setColor('#fde047');
      this.crownSprite?.setVisible(true);
    } else {
      this.nameLabel.setText(next.displayName);
      this.nameLabel.setColor('#f8fafc');
      this.crownSprite?.setVisible(false);
    }

    // Sync driving vehicle visual if driving
    if (next.vehicle) {
      const vSig = `${next.vehicle.modelId}:${next.vehicle.texture}:${JSON.stringify(next.vehicle.customization)}`;
      if (!this.vehicleSprite || vSig !== this.vehicleSig) {
        this.vehicleSig = vSig;
        const customKey = getVehicleCustomizationKey(
          next.vehicle.modelId,
          next.vehicle.customization,
        );
        const texKey = ensureCustomVehicleTexture(
          this.scene,
          customKey,
          next.vehicle.modelId,
          next.vehicle.customization,
        );
        if (!this.vehicleSprite) {
          this.vehicleSprite = this.scene.add
            .sprite(this.sprite.x, this.sprite.y, texKey, '0')
            .setOrigin(0.5, 0.65)
            .setInteractive({useHandCursor: true});
          this.vehicleSprite.on('pointerdown', () => this.onSelectCallback(this.uid));
        } else {
          this.vehicleSprite.setTexture(texKey, '0');
        }
      }
      this.vehicleSprite.setVisible(true);
      this.sprite.setVisible(false);
      this.shadow.setVisible(false);
    } else if (next.ridingDriverUid) {
      if (this.vehicleSprite) this.vehicleSprite.setVisible(false);
      this.sprite.setVisible(false);
      this.shadow.setVisible(false);
    } else {
      if (this.vehicleSprite) this.vehicleSprite.setVisible(false);
      this.sprite.setVisible(true);
      this.shadow.setVisible(true);
    }

    // Emote indicator
    if (next.emote && next.emote.expiresAt > Date.now()) {
      this.emoteBubble.setText(EMOTE_LABELS[next.emote.id] || `✨ ${next.emote.id}`);
      this.emoteBubble.setVisible(true);
    } else {
      this.emoteBubble.setVisible(false);
    }
  }

  public triggerEmote(emoteId: string): void {
    this.state.emote = {id: emoteId, expiresAt: Date.now() + 2600};
    this.emoteBubble.setText(EMOTE_LABELS[emoteId] || `✨ ${emoteId}`);
    this.emoteBubble.setVisible(true);
  }

  public setShadowVisible(visible: boolean): void {
    if (!this.state.vehicle && !this.state.ridingDriverUid) {
      this.shadow.setVisible(visible);
    }
  }

  public setWorldVisibility(visible: boolean): void {
    this.sprite.setVisible(visible && !this.state.vehicle && !this.state.ridingDriverUid);
    this.vehicleSprite?.setVisible(visible && Boolean(this.state.vehicle));
    this.shadow.setVisible(visible && !this.state.vehicle && !this.state.ridingDriverUid);
    this.nameLabel.setVisible(visible);
    this.crownSprite?.setVisible(
      visible &&
        ownerBadgeService.isVerifiedOwnerAccount(
          this.state.uid,
          this.state.username,
          this.state.isOwner,
        ),
    );
    if (!visible) this.emoteBubble.setVisible(false);
  }

  public update(dtSec: number): void {
    const lerp = Math.min(1, dtSec * 14);
    const nx = Phaser.Math.Linear(this.sprite.x, this.targetX, lerp);
    const ny = Phaser.Math.Linear(this.sprite.y, this.targetY, lerp);
    this.sprite.setPosition(nx, ny);
    this.shadow.setPosition(Math.round(nx), Math.round(ny - 2));

    if (this.state.vehicle && this.vehicleSprite) {
      this.vehicleSprite.setPosition(nx, ny);
      this.vehicleSprite.setDepth(ny + 8);
      const frameMap: Record<Direction, string> = {
        down: '0',
        up: '1',
        left: '2',
        right: '3',
      };
      this.vehicleSprite.setFrame(frameMap[this.state.dir] ?? '0');
    } else if (!this.state.ridingDriverUid) {
      this.sprite.setDepth(ny);
      this.shadow.setDepth(ny - 1);
      if (this.state.anim === 'walk' || this.state.anim === 'run') {
        const animKey = `${this.textureKey}_${this.state.anim}_${this.state.dir}`;
        if (this.scene.anims.exists(animKey) && this.sprite.anims.currentAnim?.key !== animKey) {
          this.sprite.play(animKey, true);
        }
      } else if (this.state.anim === 'celebrate') {
        const celKey = `${this.textureKey}_celebrate`;
        if (this.scene.anims.exists(celKey) && !this.sprite.anims.isPlaying) {
          this.sprite.play(celKey, true);
        }
      } else if (this.state.anim === 'sit') {
        this.sprite.anims.stop();
        this.sprite.setFrame('16');
      } else {
        this.sprite.anims.stop();
        const idleMap: Record<Direction, string> = {down: '0', up: '4', left: '8', right: '12'};
        this.sprite.setFrame(idleMap[this.state.dir] || '0');
      }
    }

    const sx = Math.round(nx);
    const sy = Math.round(ny);
    const labelOffset = this.state.vehicle ? 40 : 36;
    this.nameLabel.setPosition(sx, sy - labelOffset);
    this.crownSprite?.setPosition(sx, sy - labelOffset - 18);
    if (this.state.emote && this.state.emote.expiresAt > Date.now()) {
      this.emoteBubble.setPosition(sx, sy - labelOffset - (this.crownSprite?.visible ? 34 : 20));
    } else {
      this.emoteBubble.setVisible(false);
    }
  }

  public destroy(): void {
    this.sprite.destroy();
    this.vehicleSprite?.destroy();
    this.nameLabel.destroy();
    this.crownSprite?.destroy();
    this.emoteBubble.destroy();
    this.shadow.destroy();
  }
}
