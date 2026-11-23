import {DISTRICTS, MAP_COLS, MAP_ROWS, TILE_SIZE} from '@/src/config/constants';
import {CityMapData} from '@/src/game/maps/cityMap';
import {Direction} from '@/src/game/types/gameTypes';

export class MiniMapWidget {
  private readonly buttonEl: HTMLButtonElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly baseCanvas: HTMLCanvasElement;
  private readonly scale = 2; // 320x240 native for 160x120 world

  constructor(
    parent: HTMLElement,
    private readonly mapData: CityMapData,
    onExpandClick: () => void,
  ) {
    this.buttonEl = document.createElement('button');
    this.buttonEl.type = 'button';
    this.buttonEl.title = 'Open City Map [M]';
    this.buttonEl.setAttribute('aria-label', 'Open full city map');
    this.buttonEl.className =
      'ui-interactive cc-panel-subtle rounded-xl p-1.5 cursor-pointer hover:border-sky-400/70 transition-colors flex flex-col gap-1';

    this.canvas = document.createElement('canvas');
    this.canvas.width = MAP_COLS * this.scale;
    this.canvas.height = MAP_ROWS * this.scale;
    this.canvas.className = 'w-[108px] sm:w-[128px] md:w-[156px] h-auto rounded-lg block';
    this.canvas.style.imageRendering = 'pixelated';

    const footer = document.createElement('div');
    footer.className =
      'flex items-center justify-between px-1 text-[10px] font-medium text-slate-300';
    footer.innerHTML = `<span>City Minimap</span><span class="font-mono-tabular text-sky-300">[M]</span>`;

    this.buttonEl.appendChild(this.canvas);
    this.buttonEl.appendChild(footer);
    parent.appendChild(this.buttonEl);

    this.buttonEl.addEventListener('click', onExpandClick);

    this.baseCanvas = document.createElement('canvas');
    this.baseCanvas.width = MAP_COLS * this.scale;
    this.baseCanvas.height = MAP_ROWS * this.scale;
    this.buildStaticBase();
  }

  private getMiniBuildingColor(texture: string): string {
    if (texture === 'bld_garage' || texture === 'bld_repair' || texture === 'bld_dealership') {
      return '#f97316';
    }
    if (
      texture === 'bld_arcade' ||
      texture === 'bld_cinema' ||
      texture === 'bld_casino_lounge' ||
      texture === 'bld_music'
    ) {
      return '#a855f7';
    }
    if (texture === 'bld_police' || texture === 'bld_airport' || texture === 'bld_train') {
      return '#38bdf8';
    }
    if (texture === 'bld_hospital' || texture === 'bld_fire' || texture === 'bld_clinic') {
      return '#ef4444';
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
      return '#ec4899';
    }
    if (texture === 'bld_dt_tower' || texture === 'bld_dt_brick' || texture === 'bld_hotel') {
      return '#0ea5e9';
    }
    if (texture === 'bld_mission_house') return '#facc15';
    if (texture === 'bld_warehouse') return '#78716c';
    return '#64748b';
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
        else if (tile >= 6 && tile <= 11) color = '#2f3744';
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
        else if (tile === 41) color = '#e2e8f0';
        ctx.fillStyle = color;
        ctx.fillRect(c * s, r * s, s, s);
      }
    }

    // District boundaries
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.25)';
    ctx.lineWidth = 1;
    for (const d of DISTRICTS) {
      ctx.strokeRect(d.tileX * s + 0.5, d.tileY * s + 0.5, d.tileW * s, d.tileH * s);
    }

    // Buildings
    for (const b of this.mapData.buildings) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(b.tileX * s, b.tileY * s, b.widthTiles * s, b.heightTiles * s);
      ctx.fillStyle = this.getMiniBuildingColor(b.texture);
      ctx.fillRect(
        b.tileX * s + 1,
        b.tileY * s + 1,
        Math.max(1, b.widthTiles * s - 2),
        Math.max(1, b.heightTiles * s - 2),
      );
    }

    // Key interactive landmarks
    for (const obj of this.mapData.interactives) {
      if (obj.kind === 'bench' || obj.kind === 'district_sign' || obj.kind === 'collectible_shard') {
        continue;
      }
      const mx = (obj.x / TILE_SIZE) * s;
      const my = (obj.y / TILE_SIZE) * s;
      ctx.fillStyle = obj.kind === 'bus_stop' ? '#38bdf8' : '#34d399';
      ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }
  }

  public update(
    playerX: number,
    playerY: number,
    direction: Direction,
    npcPositions: {x: number; y: number}[],
    trafficPositions?: {x: number; y: number}[],
    personalCarPos?: {x: number; y: number} | null,
    waypointTarget?: {x: number; y: number; label: string} | null,
    policePositions?: {x: number; y: number}[],
    eventBeaconPos?: {x: number; y: number} | null,
    questPins?: {x: number; y: number; state: 'ready' | 'available' | 'active'; label?: string}[],
  ): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const s = this.scale;

    ctx.drawImage(this.baseCanvas, 0, 0);

    // Dynamic City Event Beacon
    if (eventBeaconPos) {
      const ex = (eventBeaconPos.x / TILE_SIZE) * s;
      const ey = (eventBeaconPos.y / TILE_SIZE) * s;
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.007);
      ctx.strokeStyle = `rgba(16, 185, 129, ${0.45 + pulse * 0.55})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ex, ey, 4 + pulse * 2.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Tracked Mission / Challenge Waypoint
    if (waypointTarget) {
      const wx = (waypointTarget.x / TILE_SIZE) * s;
      const wy = (waypointTarget.y / TILE_SIZE) * s;
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.008);
      ctx.strokeStyle = `rgba(250, 204, 21, ${0.45 + pulse * 0.55})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(wx, wy, 4.5 + pulse * 2.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(wx, wy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Traffic
    if (trafficPositions) {
      ctx.fillStyle = '#fb7185';
      for (const car of trafficPositions) {
        ctx.fillRect((car.x / TILE_SIZE) * s - 1, (car.y / TILE_SIZE) * s - 1, 2.5, 2.5);
      }
    }

    // Pursuing Police Units (alternating red/blue flash)
    if (policePositions && policePositions.length > 0) {
      const flashBlue = Math.floor(performance.now() / 220) % 2 === 0;
      ctx.fillStyle = flashBlue ? '#3b82f6' : '#ef4444';
      for (const cop of policePositions) {
        ctx.fillRect((cop.x / TILE_SIZE) * s - 2, (cop.y / TILE_SIZE) * s - 2, 4, 4);
      }
    }

    // Personal Spawned Car
    if (personalCarPos) {
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc((personalCarPos.x / TILE_SIZE) * s, (personalCarPos.y / TILE_SIZE) * s, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // NPCs
    ctx.fillStyle = '#fbbf24';
    for (const npc of npcPositions) {
      ctx.fillRect((npc.x / TILE_SIZE) * s - 1, (npc.y / TILE_SIZE) * s - 1, 2.5, 2.5);
    }

    // NPC Quest Giver markers ([!] / [?])
    if (questPins && questPins.length > 0) {
      for (const qp of questPins) {
        const qx = (qp.x / TILE_SIZE) * s;
        const qy = (qp.y / TILE_SIZE) * s;
        ctx.fillStyle =
          qp.state === 'ready' ? '#34d399' : qp.state === 'available' ? '#facc15' : '#38bdf8';
        ctx.strokeStyle = '#060b16';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(qx, qy, 2.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Player marker with facing tick
    const px = (playerX / TILE_SIZE) * s;
    const py = (playerY / TILE_SIZE) * s;

    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const dirVec: Record<Direction, [number, number]> = {
      up: [0, -5],
      down: [0, 5],
      left: [-5, 0],
      right: [5, 0],
    };
    const [dx, dy] = dirVec[direction];
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + dx, py + dy);
    ctx.stroke();
  }

  public destroy(): void {
    this.buttonEl.remove();
  }
}
