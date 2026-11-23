import Phaser from 'phaser';
import {TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH} from '@/src/config/constants';
import {CityMapData} from '@/src/game/maps/cityMap';
import {cityClockSystem} from '@/src/game/systems/CityClockSystem';
import {CollisionSystem} from '@/src/game/systems/CollisionSystem';
import {GameSettings} from '@/src/game/types/gameTypes';

interface TrafficLightLeds {
  ewDot: Phaser.GameObjects.Arc;
  nsDot: Phaser.GameObjects.Arc;
}

interface CloudShadowItem {
  img: Phaser.GameObjects.Image;
  speedX: number;
  speedY: number;
}

const CHUNK_TILES = 16;
const CHUNK_PX = CHUNK_TILES * TILE_SIZE; // 512px
const TRAFFIC_COLOR_MAP = {green: 0x22c55e, yellow: 0xfacc15, red: 0xef4444} as const;

export class WorldSystem {
  public readonly mapData: CityMapData;
  private groundTilemap!: Phaser.Tilemaps.Tilemap;
  private detailTilemap!: Phaser.Tilemaps.Tilemap;
  private fountainSprites: Phaser.GameObjects.Sprite[] = [];
  private buildingDoors = new Map<string, Phaser.GameObjects.Sprite>();
  private districtLabels: Phaser.GameObjects.Text[] = [];
  private lampHalos: Phaser.GameObjects.Image[] = [];
  private cloudShadows: CloudShadowItem[] = [];
  private trafficLights: TrafficLightLeds[] = [];
  private atmosphereRect?: Phaser.GameObjects.Rectangle;

  // 16x16-tile (512x512px) chunk culling buckets
  private chunkCols = 1;
  private chunkRows = 1;
  private chunkBuckets = new Map<string, (Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject)[]>();
  private activeChunkKeys = new Set<string>();
  private collectibleSprites = new Map<
    string,
    {sprite: Phaser.GameObjects.Image; collected: boolean}
  >();
  private eventBeacon?: Phaser.GameObjects.Image;
  private lastChunkStats = {loadedChunks: 0, totalChunks: 0, visibleObjects: 0};
  private lastCullWindowKey = '';
  private lastAtmTint = -1;
  private lastAtmAlpha = -1;
  private lastLampAlpha = -1;
  private lastSigKey = '';
  private chunkMargin = 1;
  private shadowsEnabled = true;
  private halosEnabled = true;
  private performanceMode = false;

  constructor(
    private readonly scene: Phaser.Scene,
    mapData: CityMapData,
    private readonly collisionSystem: CollisionSystem,
  ) {
    this.mapData = mapData;
    this.chunkCols = Math.ceil(WORLD_WIDTH / CHUNK_PX);
    this.chunkRows = Math.ceil(WORLD_HEIGHT / CHUNK_PX);
  }

  private getChunkKey(x: number, y: number): string {
    const cx = Phaser.Math.Clamp(Math.floor(x / CHUNK_PX), 0, this.chunkCols - 1);
    const cy = Phaser.Math.Clamp(Math.floor(y / CHUNK_PX), 0, this.chunkRows - 1);
    return `${cx}_${cy}`;
  }

  private registerInChunk(
    obj: Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject,
    x: number,
    y: number,
  ): void {
    const key = this.getChunkKey(x, y);
    const list = this.chunkBuckets.get(key) ?? [];
    list.push(obj);
    this.chunkBuckets.set(key, list);
  }

  public build(): void {
    this.scene.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // 1. Ground Tilemap Layer
    this.groundTilemap = this.scene.make.tilemap({
      data: this.mapData.groundLayer,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const groundTileset = this.groundTilemap.addTilesetImage('city_tileset');
    if (groundTileset) {
      const groundLayer = this.groundTilemap.createLayer(0, groundTileset, 0, 0);
      groundLayer?.setDepth(0);
    }

    // 2. Detail Tilemap Layer (flowers, fences, court lines)
    this.detailTilemap = this.scene.make.tilemap({
      data: this.mapData.detailLayer,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const detailTileset = this.detailTilemap.addTilesetImage('city_tileset');
    if (detailTileset) {
      const detailLayer = this.detailTilemap.createLayer(0, detailTileset, 0, 0);
      detailLayer?.setDepth(2);
    }

    // 3. Solid tile colliders (pond, canal, surf barrier, fences)
    for (let r = 0; r < this.mapData.rows; r++) {
      for (let c = 0; c < this.mapData.cols; c++) {
        if (this.mapData.solidTiles[r][c]) {
          this.collisionSystem.addStaticRect(
            c * TILE_SIZE + TILE_SIZE / 2,
            r * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE,
            TILE_SIZE,
          );
        }
      }
    }

    // 4. Buildings with Y-sorted depth, animated entrance doors, and accurate footprint colliders
    for (const b of this.mapData.buildings) {
      const pxX = b.tileX * TILE_SIZE;
      const pxY = b.tileY * TILE_SIZE;
      const img = this.scene.add.image(pxX, pxY, b.texture).setOrigin(0, 0);
      const bottomY = pxY + img.height;
      const midX = pxX + img.width / 2;
      const midY = pxY + img.height / 2;
      img.setDepth(bottomY - 8);
      this.registerInChunk(img, midX, midY);

      const doorX = b.doorTileX * TILE_SIZE;
      const doorY = bottomY - 22;
      const doorSprite = this.scene.add
        .sprite(doorX, doorY, 'prop_door_ext', '0')
        .setOrigin(0.5, 0.5)
        .setDepth(bottomY - 5);
      this.buildingDoors.set(b.id, doorSprite);
      this.registerInChunk(doorSprite, doorX, doorY);

      // Night neon accent halo on key nightlife/garage/lounge/mall spots
      if (
        b.id === 'b_arcade' ||
        b.id === 'b_cinema' ||
        b.id === 'b_garage' ||
        b.id === 'b_casino_lounge' ||
        b.id === 'b_mall' ||
        b.id === 'b_music'
      ) {
        const neon = this.scene.add
          .image(pxX + img.width / 2, pxY + 34, 'prop_glow_halo')
          .setScale(1.15)
          .setAlpha(0.15)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(bottomY + 2);
        this.lampHalos.push(neon);
        this.registerInChunk(neon, midX, midY);
      }

      const label = this.scene.add
        .text(pxX + img.width / 2, pxY + img.height - 6, b.label, {
          fontFamily: 'Outfit, sans-serif',
          fontSize: '10px',
          fontStyle: 'bold',
          color: '#f8fafc',
          backgroundColor: 'rgba(11, 18, 33, 0.78)',
          padding: {x: 5, y: 2},
        })
        .setOrigin(0.5, 0)
        .setDepth(bottomY + 1);
      this.districtLabels.push(label);
      this.registerInChunk(label, midX, bottomY);

      const colW = img.width - b.collisionInsetSide * 2;
      const colH = img.height - b.collisionInsetTop - 8;
      this.collisionSystem.addStaticRect(
        pxX + img.width / 2,
        pxY + b.collisionInsetTop + colH / 2,
        colW,
        colH,
      );
    }

    // 5. Props & Animated Fountains + Streetlamp Glows + Live Traffic Signals + Shards
    if (!this.scene.anims.exists('fountain_flow')) {
      this.scene.anims.create({
        key: 'fountain_flow',
        frames: [
          {key: 'prop_fountain', frame: '0'},
          {key: 'prop_fountain', frame: '1'},
          {key: 'prop_fountain', frame: '2'},
        ],
        frameRate: 5,
        repeat: -1,
      });
    }
    if (!this.scene.anims.exists('fountain_small_flow')) {
      this.scene.anims.create({
        key: 'fountain_small_flow',
        frames: [
          {key: 'prop_fountain_small', frame: '0'},
          {key: 'prop_fountain_small', frame: '1'},
          {key: 'prop_fountain_small', frame: '2'},
        ],
        frameRate: 5,
        repeat: -1,
      });
    }

    const signLabels: Record<string, {text: string; color: string}> = {
      sign_park: {text: 'Central Park', color: '#34d399'},
      sign_downtown: {text: 'Downtown', color: '#38bdf8'},
      sign_shopping: {text: 'Shopping District', color: '#f472b6'},
      sign_residential: {text: 'Residential District', color: '#fbbf24'},
      sign_entertainment: {text: 'Entertainment District', color: '#a78bfa'},
      sign_luxury: {text: 'Luxury Heights', color: '#e879f9'},
      sign_airport: {text: 'Starlight Airport', color: '#7dd3fc'},
      sign_industrial: {text: 'Ironworks Industrial', color: '#fb923c'},
      sign_beach: {text: 'Golden Coast & Boardwalk', color: '#2dd4bf'},
      sign_countryside: {text: 'Emerald Valley Countryside', color: '#4ade80'},
      sign_highway: {text: 'Metro Expressway', color: '#94a3b8'},
    };

    for (const p of this.mapData.props) {
      if (p.animatedFountain) {
        const animKey =
          p.texture === 'prop_fountain_small' ? 'fountain_small_flow' : 'fountain_flow';
        const fSprite = this.scene.add
          .sprite(p.x, p.y, p.texture, '0')
          .setOrigin(0.5, 0.5)
          .play(animKey);
        fSprite.setDepth(p.y + (p.texture === 'prop_fountain_small' ? 16 : 32));
        this.fountainSprites.push(fSprite);
        this.registerInChunk(fSprite, p.x, p.y);
      } else {
        const sprite = this.scene.add.image(p.x, p.y, p.texture).setOrigin(0.5, 0.5);
        if (p.texture === 'prop_door_mat') {
          sprite.setDepth(3);
        } else if (p.texture === 'prop_bench_h') {
          sprite.setDepth(p.y + 4);
        } else {
          sprite.setDepth(p.y + sprite.height * 0.35);
        }
        this.registerInChunk(sprite, p.x, p.y);

        if (
          p.texture === 'prop_starlight_shard' ||
          p.texture.startsWith('prop_relic_')
        ) {
          sprite.setDepth(p.y + 24);
          this.collectibleSprites.set(p.id, {sprite, collected: false});
          this.scene.tweens.add({
            targets: sprite,
            y: p.y - 5,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        } else if (p.texture === 'prop_secret_portal') {
          sprite.setDepth(p.y + 18);
          sprite.setAlpha(0.85);
          this.scene.tweens.add({
            targets: sprite,
            scale: 1.12,
            alpha: 1,
            duration: 1100,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }

        if (p.texture === 'prop_streetlight') {
          const halo = this.scene.add
            .image(p.x, p.y - 14, 'prop_glow_halo')
            .setScale(0.9)
            .setAlpha(0.1)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(9980);
          this.lampHalos.push(halo);
          this.registerInChunk(halo, p.x, p.y);
        }

        if (p.texture === 'prop_traffic_light') {
          const ewDot = this.scene.add
            .circle(p.x - 2, p.y - 16, 3.2, 0x22c55e)
            .setDepth(p.y + 32);
          const nsDot = this.scene.add
            .circle(p.x + 3, p.y - 10, 3.2, 0xef4444)
            .setDepth(p.y + 32);
          this.trafficLights.push({ewDot, nsDot});
          this.registerInChunk(ewDot, p.x, p.y);
          this.registerInChunk(nsDot, p.x, p.y);
        }

        const signMeta = signLabels[p.id];
        if (signMeta) {
          const signTxt = this.scene.add
            .text(p.x, p.y - 22, signMeta.text, {
              fontFamily: 'Outfit, sans-serif',
              fontSize: '10px',
              fontStyle: 'bold',
              color: signMeta.color,
              backgroundColor: 'rgba(6, 11, 22, 0.85)',
              padding: {x: 5, y: 2},
            })
            .setOrigin(0.5, 1)
            .setDepth(p.y + 40);
          this.districtLabels.push(signTxt);
          this.registerInChunk(signTxt, p.x, p.y);
        }
      }

      if (p.solid && p.colliderW && p.colliderH) {
        this.collisionSystem.addStaticRect(
          p.x,
          p.y + (p.colliderOffsetY ?? 0),
          p.colliderW,
          p.colliderH,
        );
      }
    }

    // Dynamic Event World Beacon (hidden until City Event activates)
    this.eventBeacon = this.scene.add
      .image(0, 0, 'prop_event_beacon')
      .setOrigin(0.5, 0.8)
      .setDepth(9960)
      .setVisible(false);
    this.scene.tweens.add({
      targets: this.eventBeacon,
      scaleX: 1.15,
      scaleY: 1.15,
      alpha: 0.78,
      duration: 750,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 6. Drifting Cloud Shadows across expanded 5120x3840 map & Day/Night Sky Tint Layer
    const cloudSeeds = [
      {x: 320, y: 280, sx: 14, sy: 3, scale: 1.4},
      {x: 1180, y: 640, sx: 11, sy: 2.5, scale: 1.7},
      {x: 1960, y: 420, sx: 16, sy: 3.5, scale: 1.3},
      {x: 3150, y: 580, sx: 13, sy: 2.8, scale: 1.5},
      {x: 4220, y: 920, sx: 15, sy: 3.1, scale: 1.6},
      {x: 820, y: 2380, sx: 12, sy: 2, scale: 1.6},
      {x: 2480, y: 2820, sx: 14, sy: 2.4, scale: 1.4},
      {x: 4100, y: 2640, sx: 13, sy: 2.6, scale: 1.5},
    ];
    for (const cs of cloudSeeds) {
      const img = this.scene.add
        .image(cs.x, cs.y, 'prop_cloud_shadow')
        .setScale(cs.scale)
        .setAlpha(0.12)
        .setDepth(9970);
      this.cloudShadows.push({img, speedX: cs.sx, speedY: cs.sy});
    }

    this.atmosphereRect = this.scene.add
      .rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 0x0f172a, 0)
      .setDepth(9975);

    this.updateChunkCulling(this.scene.cameras.main);
  }

  public applyGraphicsSettings(settings: GameSettings): void {
    this.performanceMode = Boolean(settings.performanceMode);
    this.shadowsEnabled =
      Boolean(settings.shadowsEnabled) &&
      !this.performanceMode &&
      settings.graphicsQuality !== 'low';
    this.halosEnabled =
      !this.performanceMode &&
      settings.effectsQuality !== 'low' &&
      settings.graphicsQuality !== 'low';

    if (this.performanceMode || settings.renderDistance === 'near') {
      this.chunkMargin = 0;
    } else if (settings.renderDistance === 'far') {
      this.chunkMargin = 2;
    } else {
      this.chunkMargin = 1;
    }

    for (const cs of this.cloudShadows) {
      cs.img.setVisible(this.shadowsEnabled);
    }
    for (const halo of this.lampHalos) {
      halo.setVisible(this.halosEnabled);
    }
    this.activeChunkKeys.clear();
    this.lastCullWindowKey = '';
    if (this.scene?.cameras?.main) {
      this.updateChunkCulling(this.scene.cameras.main);
    }
  }

  public updateChunkCulling(camera: Phaser.Cameras.Scene2D.Camera): void {
    const view = camera.worldView;
    const margin = this.chunkMargin;
    const minCx = Phaser.Math.Clamp(Math.floor(view.x / CHUNK_PX) - margin, 0, this.chunkCols - 1);
    const maxCx = Phaser.Math.Clamp(
      Math.floor((view.x + Math.max(view.width, 640)) / CHUNK_PX) + margin,
      0,
      this.chunkCols - 1,
    );
    const minCy = Phaser.Math.Clamp(Math.floor(view.y / CHUNK_PX) - margin, 0, this.chunkRows - 1);
    const maxCy = Phaser.Math.Clamp(
      Math.floor((view.y + Math.max(view.height, 360)) / CHUNK_PX) + margin,
      0,
      this.chunkRows - 1,
    );

    const windowKey = `${minCx}_${maxCx}_${minCy}_${maxCy}`;
    if (windowKey === this.lastCullWindowKey) {
      return;
    }
    this.lastCullWindowKey = windowKey;

    const nextActive = new Set<string>();
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        nextActive.add(`${cx}_${cy}`);
      }
    }

    let visibleCount = 0;
    for (const [key, items] of this.chunkBuckets.entries()) {
      const isVisible = nextActive.has(key);
      const wasVisible = this.activeChunkKeys.has(key);
      if (isVisible) visibleCount += items.length;
      if (isVisible === wasVisible && this.activeChunkKeys.size > 0) continue;
      for (const obj of items) {
        if (!obj || !obj.scene) continue;
        // Never unhide already-collected shards
        if (isVisible) {
          const colEntry = this.findCollectibleEntry(obj);
          if (colEntry?.collected) {
            obj.setVisible(false);
            continue;
          }
        }
        obj.setVisible(isVisible);
      }
    }

    this.activeChunkKeys = nextActive;
    this.lastChunkStats = {
      loadedChunks: nextActive.size,
      totalChunks: this.chunkCols * this.chunkRows,
      visibleObjects: visibleCount,
    };
  }

  private findCollectibleEntry(
    obj: Phaser.GameObjects.GameObject,
  ): {sprite: Phaser.GameObjects.Image; collected: boolean} | undefined {
    for (const entry of this.collectibleSprites.values()) {
      if (entry.sprite === obj) return entry;
    }
    return undefined;
  }

  public getChunkStats(): {loadedChunks: number; totalChunks: number; visibleObjects: number} {
    return {...this.lastChunkStats};
  }

  public hideCollectible(id: string): void {
    const entry = this.collectibleSprites.get(id);
    if (!entry) return;
    entry.collected = true;
    entry.sprite.setVisible(false);
  }

  public syncCollectedShards(collectedIds: string[]): void {
    const set = new Set(collectedIds);
    for (const [id, entry] of this.collectibleSprites.entries()) {
      if (set.has(id)) {
        entry.collected = true;
        entry.sprite.setVisible(false);
      }
    }
    this.lastCullWindowKey = '';
  }

  public syncCollectedRelics(relicIds: string[]): void {
    this.syncCollectedShards(relicIds);
  }

  public setEventBeacon(pos: {x: number; y: number; active: boolean}): void {
    if (!this.eventBeacon) return;
    if (!pos.active) {
      this.eventBeacon.setVisible(false);
      return;
    }
    this.eventBeacon.setPosition(pos.x, pos.y);
    this.eventBeacon.setVisible(true);
  }

  public updateAtmosphere(dtSec: number, paused: boolean): void {
    const atm = cityClockSystem.getAtmosphere();
    if (
      this.atmosphereRect &&
      (this.lastAtmTint !== atm.tintColor || this.lastAtmAlpha !== atm.tintAlpha)
    ) {
      this.lastAtmTint = atm.tintColor;
      this.lastAtmAlpha = atm.tintAlpha;
      this.atmosphereRect.setFillStyle(atm.tintColor, atm.tintAlpha);
    }
    const targetLampAlpha = this.halosEnabled ? atm.lampAlpha : 0;
    if (this.lastLampAlpha !== targetLampAlpha) {
      this.lastLampAlpha = targetLampAlpha;
      for (const halo of this.lampHalos) {
        halo.setAlpha(targetLampAlpha);
      }
    }

    if (!paused && this.shadowsEnabled) {
      for (const cs of this.cloudShadows) {
        cs.img.x += cs.speedX * dtSec;
        cs.img.y += cs.speedY * dtSec;
        if (cs.img.x > WORLD_WIDTH + 160) cs.img.x = -160;
        if (cs.img.y > WORLD_HEIGHT + 120) cs.img.y = -120;
        if (cs.img.alpha !== atm.cloudAlpha) {
          cs.img.setAlpha(atm.cloudAlpha);
        }
      }
    }

    const sig = cityClockSystem.getTrafficSignal();
    const sigKey = `${sig.ew}_${sig.ns}`;
    if (sigKey !== this.lastSigKey) {
      this.lastSigKey = sigKey;
      const ewColor = TRAFFIC_COLOR_MAP[sig.ew];
      const nsColor = TRAFFIC_COLOR_MAP[sig.ns];
      for (const tl of this.trafficLights) {
        tl.ewDot.setFillStyle(ewColor);
        tl.nsDot.setFillStyle(nsColor);
      }
    }
  }

  public animateBuildingDoorOpen(buildingId: string, onComplete: () => void): void {
    const door = this.buildingDoors.get(buildingId);
    if (!door || !this.scene?.sys?.isActive()) {
      onComplete();
      return;
    }
    door.setFrame('1');
    this.scene.tweens.add({
      targets: door,
      scaleY: 1.04,
      duration: 170,
      yoyo: true,
      onComplete: () => {
        if (this.scene?.sys?.isActive()) {
          onComplete();
        }
      },
    });
  }

  public spawnFountainCoinEffect(targetX?: number, targetY?: number): void {
    let source = this.fountainSprites[0];
    if (targetX !== undefined && targetY !== undefined && this.fountainSprites.length > 0) {
      let bestDist = Infinity;
      for (const f of this.fountainSprites) {
        const d = Math.hypot(f.x - targetX, f.y - targetY);
        if (d < bestDist) {
          bestDist = d;
          source = f;
        }
      }
    }
    if (!source) return;
    const fx = source.x;
    const fy = source.y - 10;

    const ring = this.scene.add.circle(fx, fy + 6, 8, 0xbae6fd, 0.4).setDepth(10001);
    ring.setStrokeStyle(2, 0x38bdf8, 0.9);
    this.scene.tweens.add({
      targets: ring,
      radius: 30,
      scale: 2.1,
      alpha: 0,
      duration: 460,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });

    for (let i = 0; i < 8; i++) {
      const spark = this.scene.add
        .image(fx, fy, 'fx_sparkle')
        .setDepth(10002)
        .setScale(1.15);
      const angle = (Math.PI * 2 * i) / 8;
      this.scene.tweens.add({
        targets: spark,
        x: fx + Math.cos(angle) * 28,
        y: fy + Math.sin(angle) * 22 - 10,
        alpha: 0,
        scale: 0.4,
        duration: 500,
        ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  public isWalkablePosition(x: number, y: number): boolean {
    if (x < 32 || x > WORLD_WIDTH - 32 || y < 32 || y > WORLD_HEIGHT - 32) {
      return false;
    }
    return !this.collisionSystem.isPointBlocked(x, y, 16);
  }

  /**
   * Validates whether a personal vehicle can safely spawn at (x, y) without clipping
   * buildings, walls, water ponds, doorways, NPCs, or other vehicles.
   */
  public isSafeVehicleSpawnSpot(
    x: number,
    y: number,
    dynamicObstacles: {x: number; y: number; minDist: number}[],
  ): {ok: boolean; reason?: string} {
    if (x < 64 || x > WORLD_WIDTH - 64 || y < 64 || y > WORLD_HEIGHT - 64) {
      return {ok: false, reason: 'Too close to city perimeter boundary.'};
    }

    // Multi-point clearance box (~52x36 car footprint)
    const offsets = [
      [0, 0],
      [-24, -14],
      [24, -14],
      [-24, 14],
      [24, 14],
    ];
    for (const [dx, dy] of offsets) {
      const cx = x + dx;
      const cy = y + dy;
      const col = Math.floor(cx / TILE_SIZE);
      const row = Math.floor(cy / TILE_SIZE);
      if (
        row < 0 ||
        row >= this.mapData.rows ||
        col < 0 ||
        col >= this.mapData.cols ||
        this.mapData.solidTiles[row][col]
      ) {
        return {ok: false, reason: 'Cannot spawn on water or solid boundary tiles.'};
      }
      if (this.collisionSystem.isPointBlocked(cx, cy, 12)) {
        return {ok: false, reason: 'Spawn zone blocked by a building, fence, or prop.'};
      }
    }

    // Reject spawning directly over building entrance doormats
    for (const b of this.mapData.buildings) {
      const dx = b.doorTileX * TILE_SIZE;
      const dy = b.doorTileY * TILE_SIZE;
      if (Math.hypot(x - dx, y - dy) < 52) {
        return {ok: false, reason: `Move away from ${b.label} entrance before spawning.`};
      }
    }

    // Reject overlapping NPCs, traffic, or parked vehicles
    for (const obs of dynamicObstacles) {
      if (Math.hypot(x - obs.x, y - obs.y) < obs.minDist) {
        return {ok: false, reason: 'Space is occupied by a resident or another vehicle.'};
      }
    }

    return {ok: true};
  }

  public destroy(): void {
    for (const lbl of this.districtLabels) lbl.destroy();
    this.districtLabels = [];
    for (const door of this.buildingDoors.values()) door.destroy();
    this.buildingDoors.clear();
    for (const halo of this.lampHalos) halo.destroy();
    this.lampHalos = [];
    for (const cs of this.cloudShadows) cs.img.destroy();
    this.cloudShadows = [];
    for (const tl of this.trafficLights) {
      tl.ewDot.destroy();
      tl.nsDot.destroy();
    }
    this.trafficLights = [];
    this.eventBeacon?.destroy();
    this.eventBeacon = undefined;
    this.collectibleSprites.clear();
    this.chunkBuckets.clear();
    this.activeChunkKeys.clear();
    this.atmosphereRect?.destroy();
    this.fountainSprites = [];
    this.groundTilemap?.destroy();
    this.detailTilemap?.destroy();
  }
}
