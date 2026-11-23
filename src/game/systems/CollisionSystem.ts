import Phaser from 'phaser';

export interface ColliderRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class CollisionSystem {
  public readonly staticGroup: Phaser.Physics.Arcade.StaticGroup;
  private readonly rects: ColliderRect[] = [];
  private readonly colliders: Phaser.Physics.Arcade.Collider[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.staticGroup = scene.physics.add.staticGroup();
  }

  public addStaticRect(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
  ): Phaser.GameObjects.Zone {
    const zone = this.scene.add.zone(centerX, centerY, width, height);
    this.scene.physics.add.existing(zone, true);
    this.staticGroup.add(zone);
    this.rects.push({
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
    });
    return zone;
  }

  public removeStaticZone(zone: Phaser.GameObjects.Zone): void {
    const group = this.staticGroup as Phaser.Physics.Arcade.StaticGroup & {
      scene?: Phaser.Scene;
      children?: unknown;
    };
    if (group.scene && group.children) {
      this.staticGroup.remove(zone, true, true);
    } else {
      zone.destroy();
    }
  }

  public isPointBlocked(x: number, y: number, padding = 16): boolean {
    for (const r of this.rects) {
      if (
        x >= r.x - padding &&
        x <= r.x + r.width + padding &&
        y >= r.y - padding &&
        y <= r.y + r.height + padding
      ) {
        return true;
      }
    }
    return false;
  }

  public clearStaticRects(): void {
    const group = this.staticGroup as Phaser.Physics.Arcade.StaticGroup & {
      scene?: Phaser.Scene;
      children?: unknown;
    };
    if (group.scene && group.children) {
      this.staticGroup.clear(true, true);
    }
    this.rects.length = 0;
  }

  public bindSpriteCollider(sprite: Phaser.Physics.Arcade.Sprite): Phaser.Physics.Arcade.Collider {
    const collider = this.scene.physics.add.collider(sprite, this.staticGroup);
    this.colliders.push(collider);
    return collider;
  }

  public removeCollider(collider: Phaser.Physics.Arcade.Collider | null | undefined): void {
    if (!collider) return;
    const idx = this.colliders.indexOf(collider);
    if (idx !== -1) {
      this.colliders.splice(idx, 1);
    }
    try {
      collider.destroy();
    } catch {
      // ignore already destroyed collider
    }
  }

  public destroy(): void {
    for (const col of this.colliders) {
      try {
        col.destroy();
      } catch {
        // ignore already destroyed collider
      }
    }
    this.colliders.length = 0;

    const group = this.staticGroup as Phaser.Physics.Arcade.StaticGroup & {
      scene?: Phaser.Scene;
      children?: unknown;
    };
    if (group.scene && group.children) {
      this.staticGroup.destroy(true, true);
    }
    this.rects.length = 0;
  }
}
