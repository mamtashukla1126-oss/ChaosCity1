import Phaser from 'phaser';
import {NPC} from '@/src/game/entities/NPC';
import {InteractiveObjectData} from '@/src/game/types/gameTypes';
import {distanceSq} from '@/src/game/utils/helpers';

export class InteractionSystem {
  private readonly marker: Phaser.GameObjects.Graphics;
  private activeTarget: InteractiveObjectData | null = null;
  private pulseTime = 0;
  private lastMarkerColor: number | null = null;
  private readonly cooldowns = new Map<string, number>();
  private readonly disabledIds = new Set<string>();

  constructor(
    scene: Phaser.Scene,
    private readonly staticObjects: InteractiveObjectData[],
    private readonly npcs: NPC[],
  ) {
    this.marker = scene.add.graphics().setDepth(9998).setVisible(false);
  }

  public startCooldown(objectId: string, durationMs: number): void {
    this.cooldowns.set(objectId, performance.now() + Math.max(0, durationMs));
  }

  public disableObject(objectId: string): void {
    this.disabledIds.add(objectId);
  }

  public isOnCooldown(objectId: string): boolean {
    const until = this.cooldowns.get(objectId);
    if (!until) return false;
    if (performance.now() >= until) {
      this.cooldowns.delete(objectId);
      return false;
    }
    return true;
  }

  public getCooldownRemainingMs(objectId: string): number {
    const until = this.cooldowns.get(objectId);
    if (!until) return 0;
    const rem = until - performance.now();
    if (rem <= 0) {
      this.cooldowns.delete(objectId);
      return 0;
    }
    return Math.ceil(rem);
  }

  public update(
    dtSec: number,
    playerX: number,
    playerY: number,
    dynamicObjects: InteractiveObjectData[] = [],
  ): InteractiveObjectData | null {
    let best: InteractiveObjectData | null = null;
    let bestDistSq = Infinity;

    for (const obj of this.staticObjects) {
      if (this.disabledIds.has(obj.id) || this.isOnCooldown(obj.id)) continue;
      const dSq = distanceSq(playerX, playerY, obj.x, obj.y);
      if (dSq <= obj.radius * obj.radius && dSq < bestDistSq) {
        best = obj;
        bestDistSq = dSq;
      }
    }

    for (const obj of dynamicObjects) {
      if (this.isOnCooldown(obj.id)) continue;
      const dSq = distanceSq(playerX, playerY, obj.x, obj.y);
      if (dSq <= obj.radius * obj.radius && dSq < bestDistSq) {
        best = obj;
        bestDistSq = dSq;
      }
    }

    // Also allow chatting with nearby NPCs
    for (const npc of this.npcs) {
      const id = `int_${npc.config.id}`;
      if (this.isOnCooldown(id)) continue;
      const nx = npc.sprite.x;
      const ny = npc.sprite.y;
      const radius = 52;
      const dSq = distanceSq(playerX, playerY, nx, ny);
      if (dSq <= radius * radius && dSq < bestDistSq) {
        bestDistSq = dSq;
        best = {
          id,
          kind: 'npc',
          title: npc.config.name,
          subtitle: `${npc.config.role} · CHAOS CITY Resident`,
          description: npc.config.greeting,
          promptLabel: `Talk to ${npc.config.name}`,
          x: nx,
          y: ny,
          radius,
        };
      }
    }

    this.activeTarget = best;

    if (best) {
      this.pulseTime += dtSec * 4.5;
      const pulse = 1 + Math.sin(this.pulseTime) * 0.12;
      const ringColor = best.kind === 'vehicle' ? 0xfbbf24 : 0x38bdf8;
      if (this.lastMarkerColor !== ringColor) {
        this.lastMarkerColor = ringColor;
        this.marker.clear();
        this.marker.lineStyle(2, ringColor, 0.9);
        this.marker.strokeCircle(0, 0, 15);
        this.marker.fillStyle(ringColor, 0.16);
        this.marker.fillCircle(0, 0, 13);
      }
      this.marker.setPosition(best.x, best.y - 4);
      this.marker.setScale(pulse);
      this.marker.setVisible(true);
    } else {
      this.marker.setVisible(false);
    }

    return best;
  }

  public getActiveTarget(): InteractiveObjectData | null {
    return this.activeTarget;
  }

  public destroy(): void {
    this.cooldowns.clear();
    this.marker.destroy();
  }
}
