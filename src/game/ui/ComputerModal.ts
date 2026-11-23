import {CHARACTER_PRESETS, DISTRICTS, MAP_COLS, MAP_ROWS, TILE_SIZE} from '@/src/config/constants';
import {renderCharacterPortraitDataUrl} from '@/src/game/graphics/PixelArtGenerator';
import {createCityMapData, getDistrictAtWorldPos} from '@/src/game/maps/cityMap';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {cloudSaveManager} from '@/src/game/systems/CloudSaveManager';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {GameSettings, GraphicsQuality, TouchMode} from '@/src/game/types/gameTypes';

export interface ComputerModalCallbacks {
  onSettingsChanged?: (settings: GameSettings) => void;
  onClose?: () => void;
}

type DesktopApp = 'map' | 'profile' | 'settings' | 'ledger';

let cachedMapData: ReturnType<typeof createCityMapData> | null = null;
let cachedTerrainCanvas: HTMLCanvasElement | null = null;

function getCachedMapData(): ReturnType<typeof createCityMapData> {
  if (!cachedMapData) {
    cachedMapData = createCityMapData();
  }
  return cachedMapData;
}

function getTerrainLayerCanvas(mapData: ReturnType<typeof createCityMapData>): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (cachedTerrainCanvas) return cachedTerrainCanvas;
  const s = 5;
  const off = document.createElement('canvas');
  off.width = MAP_COLS * s;
  off.height = MAP_ROWS * s;
  const octx = off.getContext('2d');
  if (!octx) return null;

  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      const tile = mapData.groundLayer[r][c];
      let color = '#4ea84b';
      if (tile === 2) color = '#58bd54';
      else if (tile === 3 || tile === 4) color = '#94a3b8';
      else if (tile === 5) color = '#d6c3a5';
      else if (tile >= 6 && tile <= 11) color = '#334155';
      else if (tile === 12) color = '#0ea5e9';
      else if (tile === 13) color = '#78472a';
      else if (tile === 14) color = '#c85a3b';
      else if (tile === 15) color = '#2563eb';
      octx.fillStyle = color;
      octx.fillRect(c * s, r * s, s, s);
    }
  }
  cachedTerrainCanvas = off;
  return off;
}

export class ComputerModal {
  private readonly backdrop: HTMLDivElement;
  private openState = false;
  private activeApp: DesktopApp = 'map';
  private selectedDistrictId: string = 'all';

  constructor(
    parent: HTMLElement,
    private readonly callbacks: ComputerModalCallbacks = {},
  ) {
    this.backdrop = document.createElement('div');
    this.backdrop.className =
      'ui-interactive fixed inset-0 z-40 hidden items-center justify-center bg-[#040812]/82 p-3 sm:p-4';
    parent.appendChild(this.backdrop);

    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) {
        this.close();
      }
    });
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public open(
    title = 'ChaosOS Workstation',
    subtitle = 'Resident Terminal · Live Network',
    initialApp: DesktopApp = 'map',
  ): void {
    this.openState = true;
    this.activeApp = initialApp;
    this.render(title, subtitle);
    this.backdrop.style.display = 'flex';
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.backdrop.style.display = 'none';
    this.backdrop.innerHTML = '';
    this.callbacks.onClose?.();
  }

  private render(title: string, subtitle: string): void {
    const save = saveSystem.getState();
    const sync = cloudSaveManager.getSyncState();
    const s = save.settings;
    const mapData = getCachedMapData();

    const getBuildingDistrict = (b: (typeof mapData.buildings)[number]) =>
      getDistrictAtWorldPos(
        (b.tileX + b.widthTiles / 2) * TILE_SIZE,
        (b.tileY + b.heightTiles / 2) * TILE_SIZE,
      );

    const filteredBuildings =
      this.selectedDistrictId === 'all'
        ? mapData.buildings
        : mapData.buildings.filter((b) => getBuildingDistrict(b).id === this.selectedDistrictId);

    const preset =
      CHARACTER_PRESETS.find((p) => p.id === save.appearanceId) ?? CHARACTER_PRESETS[0];
    const portrait = renderCharacterPortraitDataUrl(
      preset,
      save.equippedClothing,
      save.hairOverride,
      save.appearanceConfig,
    );

    const arcadeScores = Object.entries(save.arcadeHighScores);
    const recentTxs = save.transactions.slice(0, 10);

    let appContent = '';
    if (this.activeApp === 'map') {
      appContent = `
        <div class="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4">
          <div class="rounded-xl bg-[#060b16] border border-[#22355c] p-3 flex flex-col gap-2">
            <div class="flex items-center justify-between text-xs">
              <span class="font-semibold text-sky-300">CHAOS CITY Cartography (160×120 Tiles)</span>
              <span class="font-mono-tabular text-[11px] text-slate-400">35 Enterable Venues</span>
            </div>
            <canvas id="cc-pc-map" width="${MAP_COLS * 5}" height="${MAP_ROWS * 5}" class="w-full h-auto rounded-lg border border-[#1d2e50] bg-[#04070f]"></canvas>
            <div class="flex flex-wrap gap-1.5 pt-1">
              <button type="button" data-dist="all" class="cc-pc-dist px-2.5 py-1.5 rounded-lg text-[11px] font-semibold min-h-[36px] cursor-pointer ${
                this.selectedDistrictId === 'all'
                  ? 'bg-sky-500 text-[#06101f]'
                  : 'bg-[#0d1629] text-slate-300 border border-[#22355c]'
              }">All Districts</button>
              ${DISTRICTS.map(
                (d) => `
                  <button type="button" data-dist="${d.id}" class="cc-pc-dist px-2.5 py-1.5 rounded-lg text-[11px] font-semibold min-h-[36px] cursor-pointer ${
                    this.selectedDistrictId === d.id
                      ? 'bg-sky-500 text-[#06101f]'
                      : 'bg-[#0d1629] text-slate-300 border border-[#22355c]'
                  }">${d.name}</button>
                `,
              ).join('')}
            </div>
          </div>

          <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3 flex flex-col max-h-[360px]">
            <div class="text-xs font-semibold text-white mb-2">City Building Directory (${filteredBuildings.length})</div>
            <div class="overflow-y-auto space-y-1.5 pr-1">
              ${filteredBuildings
                .map((b) => {
                  const visited = save.missions.visitedBuildings.includes(b.id);
                  const dInfo = getBuildingDistrict(b);
                  return `
                    <div class="px-3 py-2 rounded-lg bg-[#0d1629] border border-[#1d2e50] flex items-center justify-between gap-2 text-xs">
                      <div class="min-w-0">
                        <div class="font-semibold text-white truncate">${b.label}</div>
                        <div class="text-[11px] text-slate-400 truncate">${dInfo.name} · ${b.categoryLabel}</div>
                      </div>
                      <span class="font-mono-tabular text-[10px] px-2 py-0.5 rounded shrink-0 ${
                        visited
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                          : 'bg-[#060b16] text-slate-400 border border-[#22355c]'
                      }">${visited ? 'VISITED' : `(${b.doorTileX}, ${b.doorTileY})`}</span>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        </div>
      `;
    } else if (this.activeApp === 'profile') {
      appContent = `
        <div class="space-y-4">
          <div class="rounded-xl bg-[#091020] border border-[#22355c] p-4 flex flex-col sm:flex-row items-center gap-4">
            <div class="w-24 h-28 rounded-xl bg-[#060b16] border border-sky-400/50 flex items-center justify-center overflow-hidden shrink-0">
              <img src="${portrait}" alt="${save.playerName}" class="w-20 h-24 object-contain" style="image-rendering: pixelated;" />
            </div>
            <div class="flex-1 min-w-0 text-center sm:text-left space-y-1.5">
              <div class="text-xs font-mono-tabular text-sky-300">
                ${sync.uid ? `CLOUD ACCOUNT · @${sync.username}` : 'LOCAL SESSION · GUEST'}
              </div>
              <h3 class="font-display text-xl font-bold text-white truncate">${save.playerName}</h3>
              <div class="flex flex-wrap justify-center sm:justify-start gap-2 pt-1">
                <span class="px-2.5 py-1 rounded-lg bg-[#0d1629] border border-amber-400/40 text-amber-300 font-mono-tabular text-xs font-bold">${save.coins} Coins</span>
                <span class="px-2.5 py-1 rounded-lg bg-[#0d1629] border border-emerald-400/40 text-emerald-300 font-mono-tabular text-xs font-bold">Energy ${save.energy}/100</span>
                <span class="px-2.5 py-1 rounded-lg bg-[#0d1629] border border-[#22355c] text-slate-300 font-mono-tabular text-xs">${save.inventory.length} Bag Stacks</span>
              </div>
            </div>
            ${
              sync.uid
                ? `<button id="cc-pc-sync" type="button" class="cc-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer shrink-0">
                    Sync to Cloud
                  </button>`
                : ''
            }
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3.5 space-y-1.5">
              <div class="flex justify-between text-xs">
                <span class="text-slate-300">Districts Explored</span>
                <span class="font-mono-tabular font-bold text-sky-300">${save.missions.visitedDistricts.length} / 11</span>
              </div>
              <div class="h-2.5 rounded bg-[#060b16] overflow-hidden">
                <div class="h-full bg-sky-400" style="width:${Math.min(100, Math.round((save.missions.visitedDistricts.length / 11) * 100))}%"></div>
              </div>
            </div>
            <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3.5 space-y-1.5">
              <div class="flex justify-between text-xs">
                <span class="text-slate-300">Buildings Visited</span>
                <span class="font-mono-tabular font-bold text-emerald-300">${save.missions.visitedBuildings.length} / 35</span>
              </div>
              <div class="h-2.5 rounded bg-[#060b16] overflow-hidden">
                <div class="h-full bg-emerald-400" style="width:${Math.min(100, Math.round((save.missions.visitedBuildings.length / 35) * 100))}%"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (this.activeApp === 'settings') {
      appContent = `
        <div class="rounded-xl bg-[#091020] border border-[#22355c] p-4 space-y-3.5">
          <div class="flex items-center justify-between gap-4">
            <label for="cc-pc-music" class="text-xs sm:text-sm font-medium text-slate-200">Music Volume</label>
            <div class="flex items-center gap-3 w-48 sm:w-56">
              <input id="cc-pc-music" type="range" min="0" max="100" value="${Math.round(s.audio.musicVolume * 100)}" class="cc-slider flex-1" />
              <span id="cc-pc-music-val" class="font-mono-tabular text-xs text-sky-300 w-10 text-right">${Math.round(s.audio.musicVolume * 100)}%</span>
            </div>
          </div>
          <div class="flex items-center justify-between gap-4">
            <label for="cc-pc-sfx" class="text-xs sm:text-sm font-medium text-slate-200">SFX Volume</label>
            <div class="flex items-center gap-3 w-48 sm:w-56">
              <input id="cc-pc-sfx" type="range" min="0" max="100" value="${Math.round(s.audio.sfxVolume * 100)}" class="cc-slider flex-1" />
              <span id="cc-pc-sfx-val" class="font-mono-tabular text-xs text-sky-300 w-10 text-right">${Math.round(s.audio.sfxVolume * 100)}%</span>
            </div>
          </div>
          <div class="flex items-center justify-between gap-4">
            <span class="text-xs sm:text-sm font-medium text-slate-200">Audio Mute</span>
            <button id="cc-pc-mute" type="button" class="cc-btn-secondary px-4 py-2 rounded-lg text-xs font-semibold min-h-[44px] cursor-pointer ${s.audio.muted ? 'border-amber-400 text-amber-300' : ''}">
              ${s.audio.muted ? 'Muted' : 'Active'}
            </button>
          </div>
          <div class="flex items-center justify-between gap-4">
            <span class="text-xs sm:text-sm font-medium text-slate-200">Graphics Quality</span>
            <div class="flex gap-1.5">
              <button data-pc-q="high" type="button" class="cc-pc-q px-3 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer ${s.graphicsQuality === 'high' ? 'bg-sky-500 text-[#06101f]' : 'bg-[#0d1629] text-slate-300 border border-[#22355c]'}">High</button>
              <button data-pc-q="balanced" type="button" class="cc-pc-q px-3 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer ${s.graphicsQuality === 'balanced' ? 'bg-sky-500 text-[#06101f]' : 'bg-[#0d1629] text-slate-300 border border-[#22355c]'}">Balanced</button>
            </div>
          </div>
          <div class="flex items-center justify-between gap-4">
            <span class="text-xs sm:text-sm font-medium text-slate-200">Touch Controls</span>
            <div class="flex gap-1.5">
              ${(['auto', 'always', 'off'] as TouchMode[])
                .map(
                  (tm) => `
                    <button data-pc-t="${tm}" type="button" class="cc-pc-t px-3 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer ${
                      s.touchMode === tm
                        ? 'bg-sky-500 text-[#06101f]'
                        : 'bg-[#0d1629] text-slate-300 border border-[#22355c]'
                    }">${tm === 'auto' ? 'Auto' : tm === 'always' ? 'On' : 'Off'}</button>
                  `,
                )
                .join('')}
            </div>
          </div>
        </div>
      `;
    } else {
      appContent = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3.5 space-y-2">
            <div class="text-xs font-semibold text-amber-300">Arcade &amp; Sport High Scores</div>
            ${
              arcadeScores.length === 0
                ? '<div class="text-xs text-slate-400 py-3">No scores set yet. Play Pixel Palace Arcade or Eastside Streetball!</div>'
                : arcadeScores
                    .map(
                      ([gId, score]) => `
                        <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-[#0d1629] border border-[#1d2e50] text-xs">
                          <span class="font-semibold text-white uppercase">${gId.replace(/_/g, ' ')}</span>
                          <span class="font-mono-tabular font-bold text-amber-300">${score} pts</span>
                        </div>
                      `,
                    )
                    .join('')
            }
          </div>

          <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3.5 space-y-2 max-h-[300px] overflow-y-auto">
            <div class="text-xs font-semibold text-sky-300">Recent Coin Ledger (${save.coins}c Balance)</div>
            ${
              recentTxs.length === 0
                ? '<div class="text-xs text-slate-400 py-3">No transactions recorded yet.</div>'
                : recentTxs
                    .map(
                      (tx) => `
                        <div class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#0d1629] border border-[#1d2e50] text-xs">
                          <span class="text-slate-200 truncate">${tx.label}</span>
                          <span class="font-mono-tabular font-bold shrink-0 ${
                            tx.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'
                          }">${tx.amount >= 0 ? `+${tx.amount}` : tx.amount}c</span>
                        </div>
                      `,
                    )
                    .join('')
            }
          </div>
        </div>
      `;
    }

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-3xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
        <!-- Window Chrome -->
        <div class="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#22355c] bg-[#080f1e]">
          <div class="min-w-0">
            <div class="text-xs font-semibold text-sky-300 truncate">${subtitle}</div>
            <h2 class="font-display text-lg font-bold text-white truncate">${title}</h2>
          </div>
          <button id="cc-pc-close" type="button" class="cc-btn-secondary px-4 py-2 rounded-lg text-xs font-semibold min-h-[44px] cursor-pointer">
            Shut Down
          </button>
        </div>

        <!-- ChaosOS App Dock -->
        <div class="flex flex-wrap gap-2 px-5 py-2.5 bg-[#091020] border-b border-[#22355c]">
          ${(
            [
              {id: 'map', label: 'City Map'},
              {id: 'profile', label: 'Resident & Cloud'},
              {id: 'settings', label: 'System Settings'},
              {id: 'ledger', label: 'Scores & Ledger'},
            ] as {id: DesktopApp; label: string}[]
          )
            .map(
              (app) => `
                <button type="button" data-pc-app="${app.id}" class="cc-pc-app px-3.5 py-2 rounded-lg text-xs font-bold min-h-[40px] cursor-pointer ${
                  this.activeApp === app.id
                    ? 'bg-sky-500 text-[#06101f]'
                    : 'bg-[#131f38] text-slate-300 hover:text-white border border-[#22355c]'
                }">${app.label}</button>
              `,
            )
            .join('')}
        </div>

        <div class="p-5 overflow-y-auto flex-1">
          ${appContent}
        </div>
      </div>
    `;

    this.backdrop.querySelector('#cc-pc-close')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.close();
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-pc-app').forEach((btn) => {
      btn.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.activeApp = (btn.dataset.pcApp as DesktopApp) ?? 'map';
        this.render(title, subtitle);
      });
    });

    if (this.activeApp === 'map') {
      this.drawMiniCityMap(mapData);
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-pc-dist').forEach((btn) => {
        btn.addEventListener('click', () => {
          audioSystem.playButtonClick();
          this.selectedDistrictId = btn.dataset.dist ?? 'all';
          this.render(title, subtitle);
        });
      });
    } else if (this.activeApp === 'profile') {
      this.backdrop.querySelector('#cc-pc-sync')?.addEventListener('click', () => {
        audioSystem.playInteract();
        void cloudSaveManager.flushNow(true);
        this.render(title, subtitle);
      });
    } else if (this.activeApp === 'settings') {
      const musicInput = this.backdrop.querySelector<HTMLInputElement>('#cc-pc-music');
      const musicVal = this.backdrop.querySelector('#cc-pc-music-val');
      musicInput?.addEventListener('input', () => {
        const vol = Number(musicInput.value) / 100;
        if (musicVal) musicVal.textContent = `${musicInput.value}%`;
        const updated = saveSystem.updateSettings({
          audio: {...saveSystem.getState().settings.audio, musicVolume: vol},
        });
        audioSystem.applySettings(updated.settings.audio);
        this.callbacks.onSettingsChanged?.(updated.settings);
      });

      const sfxInput = this.backdrop.querySelector<HTMLInputElement>('#cc-pc-sfx');
      const sfxVal = this.backdrop.querySelector('#cc-pc-sfx-val');
      sfxInput?.addEventListener('input', () => {
        const vol = Number(sfxInput.value) / 100;
        if (sfxVal) sfxVal.textContent = `${sfxInput.value}%`;
        const updated = saveSystem.updateSettings({
          audio: {...saveSystem.getState().settings.audio, sfxVolume: vol},
        });
        audioSystem.applySettings(updated.settings.audio);
        this.callbacks.onSettingsChanged?.(updated.settings);
      });

      this.backdrop.querySelector('#cc-pc-mute')?.addEventListener('click', () => {
        const cur = saveSystem.getState().settings.audio;
        const updated = saveSystem.updateSettings({
          audio: {...cur, muted: !cur.muted},
        });
        audioSystem.applySettings(updated.settings.audio);
        audioSystem.playButtonClick();
        this.callbacks.onSettingsChanged?.(updated.settings);
        this.render(title, subtitle);
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-pc-q').forEach((btn) => {
        btn.addEventListener('click', () => {
          audioSystem.playButtonClick();
          const q = (btn.dataset.pcQ as GraphicsQuality) ?? 'high';
          const updated = saveSystem.updateSettings({graphicsQuality: q});
          this.callbacks.onSettingsChanged?.(updated.settings);
          this.render(title, subtitle);
        });
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-pc-t').forEach((btn) => {
        btn.addEventListener('click', () => {
          audioSystem.playButtonClick();
          const tm = (btn.dataset.pcT as TouchMode) ?? 'auto';
          const updated = saveSystem.updateSettings({touchMode: tm});
          this.callbacks.onSettingsChanged?.(updated.settings);
          this.render(title, subtitle);
        });
      });
    }
  }

  private drawMiniCityMap(mapData: ReturnType<typeof createCityMapData>): void {
    const canvas = this.backdrop.querySelector<HTMLCanvasElement>('#cc-pc-map');
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const s = 5;

    const terrain = getTerrainLayerCanvas(mapData);
    if (terrain) {
      ctx.drawImage(terrain, 0, 0);
    }

    for (const d of DISTRICTS) {
      ctx.strokeStyle =
        this.selectedDistrictId === d.id ? '#ffffff' : `${d.color}99`;
      ctx.lineWidth = this.selectedDistrictId === d.id ? 2 : 1;
      ctx.strokeRect(d.tileX * s + 0.5, d.tileY * s + 0.5, d.tileW * s - 1, d.tileH * s - 1);
    }

    for (const b of mapData.buildings) {
      const bDist = getDistrictAtWorldPos(
        (b.tileX + b.widthTiles / 2) * TILE_SIZE,
        (b.tileY + b.heightTiles / 2) * TILE_SIZE,
      );
      const highlighted =
        this.selectedDistrictId === 'all' || this.selectedDistrictId === bDist.id;
      ctx.fillStyle = highlighted ? '#38bdf8' : '#334155';
      ctx.fillRect(b.tileX * s, b.tileY * s, b.widthTiles * s, b.heightTiles * s);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.tileX * s, b.tileY * s, b.widthTiles * s, b.heightTiles * s);
    }

    const pos = saveSystem.getState().lastPosition;
    if (pos) {
      const px = (pos.x / 32) * s;
      const py = (pos.y / 32) * s;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  public destroy(): void {
    this.backdrop.remove();
  }
}
