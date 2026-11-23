import {DISTRICTS, MAP_COLS, MAP_ROWS, TILE_SIZE} from '@/src/config/constants';
import {CityMapData} from '@/src/game/maps/cityMap';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {formatCoords} from '@/src/game/utils/helpers';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface MapOverlayExtras {
  trafficPositions?: {x: number; y: number}[];
  personalCarPos?: {x: number; y: number; name: string} | null;
  waypointTarget?: {x: number; y: number; label: string} | null;
  policePositions?: {x: number; y: number}[];
  eventBeaconPos?: {x: number; y: number; label: string} | null;
  questPins?: {x: number; y: number; state: 'ready' | 'available' | 'active'; label?: string}[];
  remotePlayers?: {x: number; y: number; displayName: string; isOwner?: boolean}[];
  ownedPropertyMarkers?: {x: number; y: number; name: string}[];
  discoveredRelics?: {x: number; y: number; name: string}[];
  discoveredSecrets?: {x: number; y: number; name: string}[];
}

export class MapOverlay {
  private readonly backdrop: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly baseCanvas: HTMLCanvasElement;
  private readonly coordsEl: HTMLElement;
  private readonly districtEl: HTMLElement;
  private readonly hoverInfoEl: HTMLElement;
  private openState = false;
  private readonly scale = 4; // 160*4 = 640w, 120*4 = 480h

  constructor(
    parent: HTMLElement,
    private readonly mapData: CityMapData,
    private readonly onCloseCallback?: () => void,
  ) {
    this.backdrop = document.createElement('div');
    this.backdrop.className =
      'ui-interactive fixed inset-0 z-40 hidden items-center justify-center bg-[#040812]/82 p-3 sm:p-4';

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-2xl max-h-[92dvh] overflow-y-auto p-4 sm:p-5 text-slate-100">
        <div class="flex items-center justify-between border-b border-[#22355c] pb-3 mb-3">
          <div>
            <h2 class="font-display text-lg font-bold text-white">CHAOS CITY Map</h2>
            <div class="text-xs text-slate-400 flex items-center gap-2">
              <span id="cc-map-district" class="text-sky-300 font-medium">Central Park</span>
              <span aria-hidden="true">·</span>
              <span>Coords: <span id="cc-map-coords" class="font-mono-tabular text-slate-200">0, 0</span></span>
            </div>
          </div>
          <button id="cc-map-close" type="button" class="cc-btn-secondary px-4 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
            Close [M]
          </button>
        </div>

        <div class="relative rounded-xl overflow-hidden border-2 border-[#22355c] bg-[#060b16] flex items-center justify-center">
          <canvas id="cc-map-canvas" width="${MAP_COLS * this.scale}" height="${MAP_ROWS * this.scale}" class="w-full h-auto max-h-[54dvh] object-contain cursor-crosshair"></canvas>
        </div>

        <div id="cc-map-hover" class="mt-2.5 px-3 py-1.5 rounded-lg bg-[#091020] border border-[#22355c] text-xs text-slate-300">
          Tap or click any building on the map to inspect its venue & district.
        </div>

        <div class="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div class="flex flex-wrap items-center gap-3">
            <span class="flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-full bg-sky-400 border border-white"></span> You</span>
            <span class="flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-full bg-teal-300 border border-white"></span> Live Players</span>
            <span class="flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-300"></span> Residents</span>
            <span class="flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-sm bg-yellow-400 border border-white"></span> My Homes</span>
            <span class="flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-full bg-fuchsia-400"></span> Discovered Secrets</span>
            <span class="flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-full bg-orange-400 border border-white"></span> My Car</span>
            <span class="flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-full bg-yellow-300 border border-slate-950"></span> Waypoint</span>
            <span class="flex items-center gap-1.5"><span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 border border-white"></span> Quests [!]</span>
          </div>
          <span>160 × 120 Tiles · 11 Districts</span>
        </div>
      </div>
    `;

    parent.appendChild(this.backdrop);
    this.canvas = this.backdrop.querySelector('#cc-map-canvas') as HTMLCanvasElement;
    this.coordsEl = this.backdrop.querySelector('#cc-map-coords') as HTMLElement;
    this.districtEl = this.backdrop.querySelector('#cc-map-district') as HTMLElement;
    this.hoverInfoEl = this.backdrop.querySelector('#cc-map-hover') as HTMLElement;

    this.baseCanvas = document.createElement('canvas');
    this.baseCanvas.width = MAP_COLS * this.scale;
    this.baseCanvas.height = MAP_ROWS * this.scale;
    this.buildStaticBase();

    this.canvas.addEventListener('click', (e) => this.handleCanvasInspect(e));

    this.backdrop.querySelector('#cc-map-close')?.addEventListener('click', () => {
      this.close();
    });
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });
  }

  private getBuildingMapColor(texture: string): string {
    if (texture === 'bld_garage' || texture === 'bld_repair' || texture === 'bld_dealership') {
      return '#ea580c';
    }
    if (
      texture === 'bld_arcade' ||
      texture === 'bld_cinema' ||
      texture === 'bld_casino_lounge' ||
      texture === 'bld_music'
    ) {
      return '#9333ea';
    }
    if (texture === 'bld_police' || texture === 'bld_airport' || texture === 'bld_train') {
      return '#0284c7';
    }
    if (texture === 'bld_hospital' || texture === 'bld_fire' || texture === 'bld_clinic') {
      return '#dc2626';
    }
    if (
      texture === 'bld_cafe' ||
      texture === 'bld_clothing' ||
      texture === 'bld_grocery' ||
      texture === 'bld_restaurant' ||
      texture === 'bld_salon' ||
      texture === 'bld_petshop' ||
      texture === 'bld_mall' ||
      texture === 'bld_boardwalk_cafe' ||
      texture === 'bld_farm_market'
    ) {
      return '#db2777';
    }
    if (texture === 'bld_dt_tower' || texture === 'bld_dt_brick' || texture === 'bld_hotel') {
      return '#0284c7';
    }
    if (texture === 'bld_gym' || texture === 'bld_library') return '#0d9488';
    if (texture === 'bld_mission_house') return '#eab308';
    if (texture === 'bld_warehouse') return '#57534e';
    return '#d97706';
  }

  private handleCanvasInspect(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const tileX = ((e.clientX - rect.left) / rect.width) * MAP_COLS;
    const tileY = ((e.clientY - rect.top) / rect.height) * MAP_ROWS;

    const match = this.mapData.buildings.find(
      (b) =>
        tileX >= b.tileX &&
        tileX <= b.tileX + b.widthTiles &&
        tileY >= b.tileY &&
        tileY <= b.tileY + b.heightTiles,
    );
    if (match) {
      audioSystem.playButtonClick();
      this.hoverInfoEl.innerHTML = `<b class="text-white">${esc(match.label)}</b> · <span class="text-sky-300">${esc(match.categoryLabel)}</span> · Entrance (${Math.round(match.doorTileX)}, ${Math.round(match.doorTileY)})`;
      return;
    }

    const district = DISTRICTS.find(
      (d) =>
        tileX >= d.tileX &&
        tileX < d.tileX + d.tileW &&
        tileY >= d.tileY &&
        tileY < d.tileY + d.tileH,
    );
    if (district) {
      this.hoverInfoEl.innerHTML = `<b class="text-white">${esc(district.name)}</b> · Tile (${Math.round(tileX)}, ${Math.round(tileY)})`;
    }
  }

  private buildStaticBase(): void {
    const ctx = this.baseCanvas.getContext('2d');
    if (!ctx) return;
    const s = this.scale;

    for (let r = 0; r < MAP_ROWS; r++) {
      for (let c = 0; c < MAP_COLS; c++) {
        const tile = this.mapData.groundLayer[r][c];
        let color = '#4ea84b';
        if (tile === 2) color = '#58bd54';
        else if (tile === 3 || tile === 4) color = '#94a3b8';
        else if (tile === 5) color = '#d6c3a5';
        else if (tile >= 6 && tile <= 11) color = '#334155';
        else if (tile === 12) color = '#0ea5e9';
        else if (tile === 13) color = '#78472a';
        else if (tile === 14) color = '#c85a3b';
        else if (tile === 15) color = '#2563eb';
        else if (tile === 32) color = '#0284c7';
        else if (tile === 33) color = '#38bdf8';
        else if (tile === 34) color = '#fde68a';
        else if (tile === 35) color = '#b45309';
        else if (tile === 36) color = '#475569';
        else if (tile === 37) color = '#1e293b';
        else if (tile === 38) color = '#0f172a';
        else if (tile === 39) color = '#94a3b8';
        else if (tile === 40) color = '#65a30d';
        else if (tile === 41) color = '#f1f5f9';

        ctx.fillStyle = color;
        ctx.fillRect(c * s, r * s, s, s);
      }
    }

    // District boundaries
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.2;
    for (const d of DISTRICTS) {
      ctx.strokeStyle = `${d.color}88`;
      ctx.strokeRect(d.tileX * s + 0.5, d.tileY * s + 0.5, d.tileW * s - 1, d.tileH * s - 1);
    }
    ctx.restore();

    // Color-coded Buildings
    for (const b of this.mapData.buildings) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(b.tileX * s, b.tileY * s, b.widthTiles * s, b.heightTiles * s);
      ctx.fillStyle = this.getBuildingMapColor(b.texture);
      ctx.fillRect(
        b.tileX * s + 1,
        b.tileY * s + 1,
        Math.max(1, b.widthTiles * s - 2),
        Math.max(1, b.heightTiles * s - 2),
      );
    }

    // Interactive landmarks & Bus stops (never leak undiscovered secrets/relics!)
    for (const obj of this.mapData.interactives) {
      if (
        obj.kind === 'bench' ||
        obj.kind === 'district_sign' ||
        obj.kind === 'collectible_shard' ||
        obj.kind === 'collectible_relic' ||
        obj.kind === 'secret_portal'
      ) {
        continue;
      }
      const mx = (obj.x / TILE_SIZE) * s;
      const my = (obj.y / TILE_SIZE) * s;
      ctx.fillStyle = obj.kind === 'bus_stop' ? '#38bdf8' : '#34d399';
      ctx.fillRect(mx - 2, my - 2, 4, 4);
    }

    // Key landmark short tags
    ctx.font = 'bold 7px Plus Jakarta Sans, sans-serif';
    ctx.textAlign = 'center';
    const shortLabels: Record<string, string> = {
      b_cafe: 'Cafe',
      b_clothing: 'Boutique',
      b_grocery: 'FreshMart',
      b_arcade: 'Arcade',
      b_cinema: 'Cinema',
      b_garage: 'Garage',
      b_dt_tower_1: 'Apex',
      b_clinic: 'Clinic',
      b_restaurant: 'Bistro',
      b_gym: 'Gym',
      b_hospital: 'Hospital',
      b_police: 'Police HQ',
      b_fire: 'Fire',
      b_airport: 'Airport',
      b_hotel: 'Hotel',
      b_dealership: 'Motors',
      b_repair: 'AutoFix',
      b_mall: 'Mall',
      b_music: 'Music',
      b_train: 'Metro',
      b_casino_lounge: 'Lounge',
      b_warehouse: 'Cargo',
      b_farm_market: 'Farm',
      b_boardwalk_cafe: 'Pier',
      b_mission_house: 'Mission HQ',
    };
    for (const b of this.mapData.buildings) {
      const tag = shortLabels[b.id];
      if (!tag) continue;
      const cx = (b.tileX + b.widthTiles / 2) * s;
      const cy = (b.tileY + b.heightTiles / 2) * s + 2.5;
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(tag, cx, cy);
    }

    // District labels
    ctx.font = 'bold 9px Outfit, sans-serif';
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const lx = d.labelTileX * s;
      const ly = d.labelTileY * s;
      ctx.fillStyle = 'rgba(6, 11, 22, 0.84)';
      const w = ctx.measureText(d.name).width + 8;
      ctx.fillRect(lx - w / 2, ly - 8, w, 12);
      ctx.fillStyle = d.color;
      ctx.fillText(d.name, lx, ly + 1);
    }
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public open(
    playerX: number,
    playerY: number,
    districtName: string,
    npcPositions: {x: number; y: number}[],
    extras?: MapOverlayExtras,
  ): void {
    this.openState = true;
    this.backdrop.style.display = 'flex';
    audioSystem.playMapToggle(true);
    this.renderMap(playerX, playerY, districtName, npcPositions, extras);
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.backdrop.style.display = 'none';
    audioSystem.playMapToggle(false);
    this.onCloseCallback?.();
  }

  public renderMap(
    playerX: number,
    playerY: number,
    districtName: string,
    npcPositions: {x: number; y: number}[],
    extras?: MapOverlayExtras,
  ): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const s = this.scale;

    this.coordsEl.textContent = formatCoords(playerX, playerY);
    this.districtEl.textContent = districtName;

    ctx.drawImage(this.baseCanvas, 0, 0);

    // City Traffic vehicles
    if (extras?.trafficPositions) {
      ctx.fillStyle = '#fb7185';
      for (const car of extras.trafficPositions) {
        const tx = (car.x / TILE_SIZE) * s;
        const ty = (car.y / TILE_SIZE) * s;
        ctx.fillRect(tx - 2.5, ty - 2, 5, 4);
      }
    }

    // Pursuing Police Cruisers
    if (extras?.policePositions && extras.policePositions.length > 0) {
      const flashBlue = Math.floor(performance.now() / 220) % 2 === 0;
      ctx.fillStyle = flashBlue ? '#3b82f6' : '#ef4444';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      for (const cop of extras.policePositions) {
        const cx = (cop.x / TILE_SIZE) * s;
        const cy = (cop.y / TILE_SIZE) * s;
        ctx.fillRect(cx - 3.5, cy - 3.5, 7, 7);
        ctx.strokeRect(cx - 3.5, cy - 3.5, 7, 7);
      }
    }

    // Active City Event Beacon
    if (extras?.eventBeaconPos) {
      const ex = (extras.eventBeaconPos.x / TILE_SIZE) * s;
      const ey = (extras.eventBeaconPos.y / TILE_SIZE) * s;
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.006);
      ctx.strokeStyle = `rgba(16, 185, 129, ${0.55 + pulse * 0.45})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex, ey, 8 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Personal Spawned Vehicle pin
    if (extras?.personalCarPos) {
      const cx = (extras.personalCarPos.x / TILE_SIZE) * s;
      const cy = (extras.personalCarPos.y / TILE_SIZE) * s;
      ctx.fillStyle = 'rgba(249, 115, 22, 0.32)';
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f97316';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // NPCs
    for (const npc of npcPositions) {
      const nx = (npc.x / TILE_SIZE) * s;
      const ny = (npc.y / TILE_SIZE) * s;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Quest Giver NPC pins ([!] / [?])
    if (extras?.questPins && extras.questPins.length > 0) {
      ctx.font = 'bold 8px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const qp of extras.questPins) {
        const qx = (qp.x / TILE_SIZE) * s;
        const qy = (qp.y / TILE_SIZE) * s;
        ctx.fillStyle =
          qp.state === 'ready' ? '#10b981' : qp.state === 'available' ? '#f59e0b' : '#0284c7';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(qx, qy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(qp.state === 'active' ? '?' : '!', qx, qy + 0.5);
      }
      ctx.textBaseline = 'alphabetic';
    }

    // Tracked Mission / Challenge Waypoint
    if (extras?.waypointTarget) {
      const wx = (extras.waypointTarget.x / TILE_SIZE) * s;
      const wy = (extras.waypointTarget.y / TILE_SIZE) * s;
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.006);

      ctx.strokeStyle = `rgba(253, 224, 71, ${0.55 + pulse * 0.45})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx, wy, 9 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(wx, wy - 5);
      ctx.lineTo(wx + 5, wy);
      ctx.lineTo(wx, wy + 5);
      ctx.lineTo(wx - 5, wy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 9px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      const label = extras.waypointTarget.label;
      const tw = ctx.measureText(label).width + 8;
      const lx = Math.max(tw / 2 + 4, Math.min(this.canvas.width - tw / 2 - 4, wx));
      const ly = wy > 24 ? wy - 14 : wy + 22;
      ctx.fillStyle = 'rgba(6, 11, 22, 0.88)';
      ctx.fillRect(lx - tw / 2, ly - 9, tw, 12);
      ctx.fillStyle = '#fde047';
      ctx.fillText(label, lx, ly);
    }

    // Owned property home pins
    if (extras?.ownedPropertyMarkers) {
      for (const prop of extras.ownedPropertyMarkers) {
        const hx = (prop.x / TILE_SIZE) * s;
        const hy = (prop.y / TILE_SIZE) * s;
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.2;
        ctx.fillRect(hx - 4, hy - 4, 8, 8);
        ctx.strokeRect(hx - 4, hy - 4, 8, 8);
      }
    }

    // Discovered Secrets & Relics ONLY (undiscovered never shown)
    const drawDiscovered = (list: {x: number; y: number}[] | undefined, color: string) => {
      if (!list) return;
      for (const item of list) {
        const dx = (item.x / TILE_SIZE) * s;
        const dy = (item.y / TILE_SIZE) * s;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(dx, dy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    drawDiscovered(extras?.discoveredRelics, '#fbbf24');
    drawDiscovered(extras?.discoveredSecrets, '#e879f9');

    // Live Multiplayer Remote Players (strictly isolated to Multiplayer mode)
    if (extras?.remotePlayers && extras.remotePlayers.length > 0) {
      for (const rp of extras.remotePlayers) {
        const rx = (rp.x / TILE_SIZE) * s;
        const ry = (rp.y / TILE_SIZE) * s;
        ctx.fillStyle = rp.isOwner ? '#fbbf24' : '#2dd4bf';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(rx, ry, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Player real-time world marker
    const px = (playerX / TILE_SIZE) * s;
    const py = (playerY / TILE_SIZE) * s;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  public destroy(): void {
    this.openState = false;
    this.backdrop.remove();
  }
}
