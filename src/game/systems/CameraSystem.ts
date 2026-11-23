import Phaser from 'phaser';
import {
  CAMERA_MAX_ZOOM,
  CAMERA_MIN_ZOOM,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '@/src/config/constants';
import {clamp} from '@/src/game/utils/helpers';

export class CameraSystem {
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private panAngle = 0;
  private boundsW = WORLD_WIDTH;
  private boundsH = WORLD_HEIGHT;

  constructor(
    private readonly scene: Phaser.Scene,
    initialZoom: number,
    boundsW = WORLD_WIDTH,
    boundsH = WORLD_HEIGHT,
  ) {
    this.camera = scene.cameras.main;
    this.boundsW = boundsW;
    this.boundsH = boundsH;
    this.camera.setBounds(0, 0, this.boundsW, this.boundsH);
    this.camera.setRoundPixels(true);
    this.camera.setZoom(clamp(initialZoom, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM));
  }

  public setWorldBounds(width: number, height: number): void {
    this.boundsW = Math.max(64, width);
    this.boundsH = Math.max(64, height);
    this.applyBoundsForViewport(this.camera.width, this.camera.height);
  }

  private applyBoundsForViewport(vpWidth: number, vpHeight: number): void {
    const zoom = this.camera.zoom || 1;
    const visW = vpWidth / zoom;
    const visH = vpHeight / zoom;
    const bx = visW > this.boundsW ? -(visW - this.boundsW) / 2 : 0;
    const by = visH > this.boundsH ? -(visH - this.boundsH) / 2 : 0;
    const bw = Math.max(this.boundsW, visW);
    const bh = Math.max(this.boundsH, visH);
    this.camera.setBounds(bx, by, bw, bh);
  }

  public followTarget(target: Phaser.GameObjects.GameObject): void {
    this.camera.startFollow(target, true, 0.14, 0.14);
  }

  public setZoom(zoom: number, animate = true): void {
    const clamped = clamp(zoom, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM);
    if (!animate) {
      this.camera.setZoom(clamped);
      this.applyBoundsForViewport(this.camera.width, this.camera.height);
      return;
    }
    this.scene.tweens.add({
      targets: this.camera,
      zoom: clamped,
      duration: 220,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.applyBoundsForViewport(this.camera.width, this.camera.height);
      },
    });
  }

  public handleResize(width: number, height: number): void {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    this.camera.setViewport(0, 0, w, h);
    this.applyBoundsForViewport(w, h);
    this.camera.setRoundPixels(true);
  }

  public updateMenuPan(dtSec: number): void {
    this.panAngle += dtSec * 0.14;
    const centerX = WORLD_WIDTH * 0.45 + Math.cos(this.panAngle) * 340;
    const centerY = WORLD_HEIGHT * 0.44 + Math.sin(this.panAngle * 0.85) * 220;
    this.camera.centerOn(centerX, centerY);
  }
}
