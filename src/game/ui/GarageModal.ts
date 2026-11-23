import {
  createStarterOwnedVehicle,
  DECAL_OPTIONS,
  GARAGE_PAINT_COLORS,
  getUpgradeCost,
  getVehicleModelSpec,
  HEADLIGHT_OPTIONS,
  SPOILER_OPTIONS,
  UPGRADE_STAT_DEFS,
  VEHICLE_MODELS,
  WHEEL_OPTIONS,
} from '@/src/game/data/cityLifeData';
import {renderVehiclePreviewDataUrl} from '@/src/game/graphics/VehicleArtGenerator';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {economySystem} from '@/src/game/systems/EconomySystem';
import {
  Direction,
  OwnedVehicleRecord,
  VehicleCustomization,
} from '@/src/game/types/gameTypes';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface GarageModalCallbacks {
  onVehicleUpdated?: (vehicle: OwnedVehicleRecord) => void;
  onActiveVehicleChanged?: (vehicleId: string) => void;
  onClose?: () => void;
}

const PREVIEW_DIRS: Direction[] = ['right', 'down', 'left', 'up'];

export class GarageModal {
  private readonly backdrop: HTMLDivElement;
  private openState = false;
  private activeTab: 'customize' | 'showroom' = 'customize';
  private selectedVehicleId: string | null = null;
  private previewDirIndex = 0;
  private feedback: {text: string; error: boolean} | null = null;

  constructor(
    parent: HTMLElement,
    private readonly callbacks: GarageModalCallbacks = {},
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

  public open(initialTab: 'customize' | 'showroom' = 'customize'): void {
    this.openState = true;
    this.activeTab = initialTab;
    this.feedback = null;
    this.selectedVehicleId = economySystem.getActiveVehicleId();
    this.render();
    this.backdrop.style.display = 'flex';
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.backdrop.style.display = 'none';
    this.backdrop.innerHTML = '';
    this.callbacks.onClose?.();
  }

  private getSelectedVehicle(): OwnedVehicleRecord {
    const owned = economySystem.getOwnedVehicles();
    const match = owned.find((v) => v.id === this.selectedVehicleId);
    if (match) return match;
    const active = economySystem.getVehicleById(economySystem.getActiveVehicleId() ?? '');
    const fallback = active ?? owned[0] ?? createStarterOwnedVehicle();
    this.selectedVehicleId = fallback.id;
    return fallback;
  }

  private applyPartPatch(
    vehicle: OwnedVehicleRecord,
    patch: Partial<VehicleCustomization>,
    cost: number,
    label: string,
    alreadySelected: boolean,
  ): void {
    if (alreadySelected) {
      this.feedback = {text: `${label} is already equipped on ${vehicle.name}.`, error: false};
      this.render();
      return;
    }
    const res = economySystem.customizeVehicle(vehicle.id, patch, cost, `${label} (${vehicle.name})`);
    if (!res.ok || !res.vehicle) {
      audioSystem.playError();
      this.feedback = {text: res.reason ?? 'Customization failed.', error: true};
      this.render();
      return;
    }
    audioSystem.playUpgrade();
    this.feedback = {
      text: cost > 0 ? `Installed ${label} for ${cost}c!` : `Equipped ${label}!`,
      error: false,
    };
    this.callbacks.onVehicleUpdated?.(res.vehicle);
    this.render();
  }

  private render(): void {
    const coins = economySystem.getCoins();
    const owned = economySystem.getOwnedVehicles();
    const activeId = economySystem.getActiveVehicleId();
    const vehicle = this.getSelectedVehicle();
    const previewDir = PREVIEW_DIRS[this.previewDirIndex % PREVIEW_DIRS.length];
    const spec = getVehicleModelSpec(vehicle.modelId);
    const effectiveTopSpeed = Math.round(
      spec.baseSpeed * (1 + ((vehicle.upgrades.engine ?? 1) - 1) * 0.1),
    );
    const previewImg = renderVehiclePreviewDataUrl(vehicle.modelId, vehicle.customization, previewDir);

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-3xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
        <!-- Header -->
        <div class="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[#22355c] shrink-0">
          <div>
            <div class="text-[11px] font-semibold uppercase tracking-wider text-orange-300">Chaos Customs Garage</div>
            <h2 class="font-display text-lg sm:text-xl font-bold text-white">Vehicle Mod Shop & Showroom</h2>
          </div>
          <div class="flex items-center gap-2">
            <div class="px-3 py-1.5 rounded-lg bg-[#060b16] border border-amber-400/50 text-amber-300 font-mono-tabular text-xs font-bold">
              ${coins} Coins
            </div>
            <button id="cc-garage-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[44px] cursor-pointer">
              Close
            </button>
          </div>
        </div>

        <!-- Main Tabs -->
        <div class="flex items-center justify-between gap-2 px-4 sm:px-5 py-2.5 bg-[#091020] border-b border-[#22355c] shrink-0">
          <div class="flex items-center gap-2">
            <button type="button" data-garage-tab="customize" class="cc-g-tab px-3.5 py-2 rounded-lg text-xs font-bold min-h-[40px] cursor-pointer ${
              this.activeTab === 'customize'
                ? 'bg-orange-500 text-[#06101f]'
                : 'bg-[#131f38] text-slate-300 border border-[#22355c]'
            }">Customize & Upgrade</button>
            <button type="button" data-garage-tab="showroom" class="cc-g-tab px-3.5 py-2 rounded-lg text-xs font-bold min-h-[40px] cursor-pointer ${
              this.activeTab === 'showroom'
                ? 'bg-orange-500 text-[#06101f]'
                : 'bg-[#131f38] text-slate-300 border border-[#22355c]'
            }">Showroom (${owned.length}/${VEHICLE_MODELS.length})</button>
          </div>
          <span class="hidden sm:inline text-[11px] text-slate-400">Changes save automatically & update spawned rides</span>
        </div>

        <!-- Feedback banner -->
        ${
          this.feedback
            ? `<div class="mx-4 sm:mx-5 mt-3 px-3.5 py-2 rounded-xl text-xs font-semibold border shrink-0 ${
                this.feedback.error
                  ? 'bg-rose-500/15 border-rose-400/50 text-rose-200'
                  : 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
              }">${esc(this.feedback.text)}</div>`
            : ''
        }

        <!-- Scrollable Body -->
        <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          ${
            this.activeTab === 'customize'
              ? this.renderCustomizeTab(owned, activeId, vehicle, previewImg, previewDir, effectiveTopSpeed)
              : this.renderShowroomTab(owned, activeId)
          }
        </div>
      </div>
    `;

    this.backdrop.querySelector('#cc-garage-close')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.close();
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-g-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextTab = btn.dataset.garageTab as 'customize' | 'showroom';
        if (nextTab === this.activeTab) return;
        audioSystem.playButtonClick();
        this.activeTab = nextTab;
        this.feedback = null;
        this.render();
      });
    });

    if (this.activeTab === 'customize') {
      this.bindCustomizeEvents(vehicle);
    } else {
      this.bindShowroomEvents();
    }
  }

  private renderCustomizeTab(
    owned: OwnedVehicleRecord[],
    activeId: string | null,
    vehicle: OwnedVehicleRecord,
    previewImg: string,
    previewDir: Direction,
    effectiveTopSpeed: number,
  ): string {
    const cond = vehicle.condition ?? 100;
    const repairCost = cond >= 100 ? 0 : Math.max(10, Math.round((100 - cond) * 0.6));
    return `
      <!-- Owned Vehicle Selector -->
      <div class="flex flex-wrap items-center gap-2">
        ${owned
          .map((v) => {
            const isSel = v.id === vehicle.id;
            const isAct = v.id === activeId;
            return `
              <button type="button" data-select-veh="${v.id}" class="cc-g-veh px-3 py-2 rounded-xl text-xs font-bold min-h-[40px] cursor-pointer flex items-center gap-1.5 border ${
                isSel
                  ? 'bg-sky-500/20 border-sky-400 text-white'
                  : 'bg-[#091020] border-[#22355c] text-slate-300 hover:border-slate-400'
              }">
                <span class="inline-block w-2.5 h-2.5 rounded-full border border-white/50" style="background:${v.customization.paintColor}"></span>
                <span>${v.name}</span>
                ${isAct ? `<span class="px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-300 text-[9px]">ACTIVE</span>` : ''}
              </button>
            `;
          })
          .join('')}
      </div>

      <!-- Live Turntable + Stats -->
      <div class="grid grid-cols-1 md:grid-cols-[230px_1fr] gap-4 items-stretch">
        <div class="rounded-xl bg-[#070d1b] border border-[#22355c] p-3.5 flex flex-col items-center justify-between gap-2">
          <div class="w-full flex items-center justify-between text-[11px] text-slate-400">
            <span class="font-semibold text-slate-200">${vehicle.name}</span>
            <span class="font-mono-tabular uppercase text-sky-300">${previewDir}</span>
          </div>
          <div class="h-24 flex items-center justify-center">
            <img src="${previewImg}" alt="${vehicle.name}" class="max-h-22 w-auto object-contain" style="image-rendering: pixelated;" />
          </div>
          <div class="w-full space-y-1">
            <div class="flex items-center justify-between text-[10px]">
              <span class="text-slate-400">Body Condition</span>
              <span class="font-mono-tabular font-bold ${cond >= 70 ? 'text-emerald-300' : cond >= 40 ? 'text-amber-300' : 'text-rose-300'}">${cond}%</span>
            </div>
            <div class="w-full h-1.5 rounded-full bg-[#131f38] overflow-hidden">
              <div class="h-full ${cond >= 70 ? 'bg-emerald-400' : cond >= 40 ? 'bg-amber-400' : 'bg-rose-400'}" style="width:${cond}%"></div>
            </div>
          </div>
          <div class="w-full flex items-center gap-2">
            <button id="cc-g-rot" type="button" class="cc-btn-secondary flex-1 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
              Rotate
            </button>
            ${
              cond < 100
                ? `<button id="cc-g-repair" type="button" data-repair-cost="${repairCost}" class="px-2.5 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/60 text-emerald-200 text-xs font-bold min-h-[40px] cursor-pointer">Repair (${repairCost}c)</button>`
                : ''
            }
            ${
              vehicle.id !== activeId
                ? `<button id="cc-g-set-active" type="button" class="cc-btn-primary px-3 py-2 rounded-lg text-xs font-bold min-h-[40px] cursor-pointer">Set Active</button>`
                : `<span class="px-2.5 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-[11px] font-bold text-emerald-300">Active</span>`
            }
          </div>
        </div>

        <!-- Performance Upgrades -->
        <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3.5 space-y-2.5">
          <div class="flex items-center justify-between">
            <h3 class="font-display text-sm font-bold text-white">Performance Tuning</h3>
            <span class="font-mono-tabular text-xs font-bold text-sky-300">Top Speed: ${effectiveTopSpeed} km/h</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            ${UPGRADE_STAT_DEFS.map((def) => {
              const lvl = vehicle.upgrades[def.key] ?? 1;
              const maxed = lvl >= 5;
              const cost = getUpgradeCost(def.key, lvl);
              return `
                <div class="rounded-lg bg-[#0d1629] border border-[#22355c] p-2.5 flex flex-col justify-between gap-2">
                  <div>
                    <div class="flex items-center justify-between text-xs font-bold text-white">
                      <span>${def.label}</span>
                      <span class="font-mono-tabular text-amber-300">Tier ${lvl}/5</span>
                    </div>
                    <div class="text-[11px] text-slate-400 mt-0.5">${def.benefit}</div>
                    <div class="flex gap-1 mt-1.5">
                      ${[1, 2, 3, 4, 5]
                        .map(
                          (pip) =>
                            `<span class="h-1.5 flex-1 rounded-sm ${pip <= lvl ? 'bg-orange-400' : 'bg-[#1a2947]'}"></span>`,
                        )
                        .join('')}
                    </div>
                  </div>
                  <button type="button" data-upgrade-stat="${def.key}" ${maxed ? 'disabled' : ''} class="cc-g-upg w-full py-1.5 rounded-lg text-xs font-bold min-h-[38px] ${
                    maxed
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/40 cursor-default'
                      : 'cc-btn-primary cursor-pointer'
                  }">
                    ${maxed ? 'Maxed Out' : `Upgrade (${cost}c)`}
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Paint Colors -->
      <div class="space-y-2">
        <h3 class="font-display text-sm font-bold text-white">Body Paint Finish</h3>
        <div class="grid grid-cols-3 sm:grid-cols-5 gap-2">
          ${GARAGE_PAINT_COLORS.map((p) => {
            const equipped = vehicle.customization.paintColor.toLowerCase() === p.hex.toLowerCase();
            return `
              <button type="button" data-paint-id="${p.id}" class="cc-g-paint p-2 rounded-xl border text-left min-h-[44px] cursor-pointer flex items-center gap-2 ${
                equipped
                  ? 'bg-sky-500/20 border-sky-400 text-white'
                  : 'bg-[#091020] border-[#22355c] text-slate-300 hover:border-slate-400'
              }">
                <span class="w-5 h-5 rounded-md border border-white/50 shrink-0" style="background:${p.hex}"></span>
                <div class="min-w-0">
                  <div class="text-[11px] font-bold truncate">${p.name}</div>
                  <div class="text-[10px] font-mono-tabular ${equipped ? 'text-emerald-300' : 'text-amber-300'}">${
                    equipped ? 'Equipped' : p.price === 0 ? 'Free' : `${p.price}c`
                  }</div>
                </div>
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Wheels & Spoilers -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <h3 class="font-display text-sm font-bold text-white">Wheels & Rims</h3>
          <div class="grid grid-cols-2 gap-2">
            ${WHEEL_OPTIONS.map((w) => {
              const eq = vehicle.customization.wheelStyle === w.id;
              return `
                <button type="button" data-wheel-id="${w.id}" class="cc-g-wheel p-2.5 rounded-xl border text-left min-h-[44px] cursor-pointer ${
                  eq ? 'bg-sky-500/20 border-sky-400 text-white' : 'bg-[#091020] border-[#22355c] text-slate-300 hover:border-slate-400'
                }">
                  <div class="text-xs font-bold">${w.name}</div>
                  <div class="text-[10px] font-mono-tabular ${eq ? 'text-emerald-300' : 'text-amber-300'}">${
                    eq ? 'Equipped' : w.price === 0 ? 'Free' : `${w.price}c`
                  }</div>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <div class="space-y-2">
          <h3 class="font-display text-sm font-bold text-white">Aero Spoiler</h3>
          <div class="grid grid-cols-3 gap-2">
            ${SPOILER_OPTIONS.map((sp) => {
              const eq = vehicle.customization.spoilerStyle === sp.id;
              return `
                <button type="button" data-spoiler-id="${sp.id}" class="cc-g-spoiler p-2.5 rounded-xl border text-left min-h-[44px] cursor-pointer ${
                  eq ? 'bg-sky-500/20 border-sky-400 text-white' : 'bg-[#091020] border-[#22355c] text-slate-300 hover:border-slate-400'
                }">
                  <div class="text-xs font-bold">${sp.name}</div>
                  <div class="text-[10px] font-mono-tabular ${eq ? 'text-emerald-300' : 'text-amber-300'}">${
                    eq ? 'Equipped' : sp.price === 0 ? 'Free' : `${sp.price}c`
                  }</div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Decals & Headlights -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-2">
          <h3 class="font-display text-sm font-bold text-white">Racing Decals</h3>
          <div class="grid grid-cols-2 gap-2">
            ${DECAL_OPTIONS.map((dc) => {
              const eq = vehicle.customization.decalStyle === dc.id;
              return `
                <button type="button" data-decal-id="${dc.id}" class="cc-g-decal p-2.5 rounded-xl border text-left min-h-[44px] cursor-pointer ${
                  eq ? 'bg-sky-500/20 border-sky-400 text-white' : 'bg-[#091020] border-[#22355c] text-slate-300 hover:border-slate-400'
                }">
                  <div class="text-xs font-bold">${dc.name}</div>
                  <div class="text-[10px] font-mono-tabular ${eq ? 'text-emerald-300' : 'text-amber-300'}">${
                    eq ? 'Equipped' : dc.price === 0 ? 'Free' : `${dc.price}c`
                  }</div>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <div class="space-y-2">
          <h3 class="font-display text-sm font-bold text-white">Headlight Tint</h3>
          <div class="grid grid-cols-2 gap-2">
            ${HEADLIGHT_OPTIONS.map((hl) => {
              const eq = vehicle.customization.headlightStyle === hl.id;
              return `
                <button type="button" data-headlight-id="${hl.id}" class="cc-g-headlight p-2.5 rounded-xl border text-left min-h-[44px] cursor-pointer flex items-center gap-2 ${
                  eq ? 'bg-sky-500/20 border-sky-400 text-white' : 'bg-[#091020] border-[#22355c] text-slate-300 hover:border-slate-400'
                }">
                  <span class="w-4 h-4 rounded-full border border-white/50 shrink-0" style="background:${hl.hex}"></span>
                  <div class="min-w-0">
                    <div class="text-xs font-bold truncate">${hl.name}</div>
                    <div class="text-[10px] font-mono-tabular ${eq ? 'text-emerald-300' : 'text-amber-300'}">${
                      eq ? 'Equipped' : hl.price === 0 ? 'Free' : `${hl.price}c`
                    }</div>
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }

  private renderShowroomTab(owned: OwnedVehicleRecord[], activeId: string | null): string {
    return `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        ${VEHICLE_MODELS.map((spec) => {
          const ownedRec = owned.find((v) => v.modelId === spec.modelId);
          const isActive = ownedRec?.id === activeId;
          const img = renderVehiclePreviewDataUrl(
            spec.modelId,
            ownedRec?.customization ?? spec.defaultCustomization,
            'right',
          );

          return `
            <div class="rounded-xl bg-[#091020] border ${
              isActive ? 'border-emerald-400/70' : 'border-[#22355c]'
            } p-4 flex flex-col justify-between gap-3">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="text-[10px] font-mono-tabular uppercase tracking-wider text-sky-300">
                    ${spec.isScooter ? '2-Wheel Compact' : 'Street Class'} · ${spec.baseSpeed} km/h base
                  </div>
                  <h3 class="font-display text-base font-bold text-white">${spec.name}</h3>
                </div>
                ${
                  ownedRec
                    ? `<span class="px-2 py-1 rounded-md text-[10px] font-bold ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                          : 'bg-sky-500/20 text-sky-300 border border-sky-400/40'
                      }">${isActive ? 'ACTIVE' : 'OWNED'}</span>`
                    : spec.unlockOnly
                      ? `<span class="px-2.5 py-1 rounded-md bg-violet-500/20 border border-violet-400/50 text-violet-200 font-mono-tabular text-[10px] font-bold">MILESTONE UNLOCK</span>`
                      : `<span class="px-2.5 py-1 rounded-md bg-amber-400/15 border border-amber-400/40 text-amber-300 font-mono-tabular text-xs font-bold">${spec.price}c</span>`
                }
              </div>

              <div class="h-24 rounded-lg bg-[#060b16] border border-[#1a2947] flex items-center justify-center">
                <img src="${img}" alt="${spec.name}" class="max-h-20 w-auto object-contain" style="image-rendering: pixelated;" />
              </div>

              <p class="text-xs text-slate-300 leading-relaxed">${spec.tagline}</p>

              <div class="flex items-center gap-2 pt-1">
                ${
                  ownedRec
                    ? `<button type="button" data-showroom-use="${ownedRec.id}" class="cc-g-use cc-btn-secondary flex-1 py-2 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer">
                        ${isActive ? 'Tune in Garage' : 'Select & Tune'}
                      </button>`
                    : spec.unlockOnly
                      ? `<div class="flex-1 py-2.5 px-3 rounded-xl bg-[#0d172c] border border-violet-400/40 text-violet-200 text-xs font-semibold text-center">
                          Complete Story Ch.5 or Reach Level 6
                        </div>`
                      : `<button type="button" data-showroom-buy="${spec.modelId}" class="cc-g-buy cc-btn-primary flex-1 py-2 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer">
                          Buy Vehicle (${spec.price}c)
                        </button>`
                }
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private bindCustomizeEvents(vehicle: OwnedVehicleRecord): void {
    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-g-veh').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.selectVeh;
        if (!id || id === this.selectedVehicleId) return;
        audioSystem.playButtonClick();
        this.selectedVehicleId = id;
        this.feedback = null;
        this.render();
      });
    });

    this.backdrop.querySelector('#cc-g-rot')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.previewDirIndex = (this.previewDirIndex + 1) % PREVIEW_DIRS.length;
      this.render();
    });

    this.backdrop.querySelector('#cc-g-repair')?.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      const cost = Number(btn.dataset.repairCost ?? '0');
      const res = economySystem.repairVehicle(vehicle.id, cost);
      if (!res.ok) {
        audioSystem.playError();
        this.feedback = {text: res.reason ?? 'Repair failed.', error: true};
      } else {
        audioSystem.playUpgrade();
        const refreshed = economySystem.getVehicleById(vehicle.id);
        if (refreshed) this.callbacks.onVehicleUpdated?.(refreshed);
        this.feedback = {text: `Repaired ${vehicle.name} to 100% Condition!`, error: false};
      }
      this.render();
    });

    this.backdrop.querySelector('#cc-g-set-active')?.addEventListener('click', () => {
      audioSystem.playInteract();
      economySystem.setActiveVehicleId(vehicle.id);
      this.callbacks.onActiveVehicleChanged?.(vehicle.id);
      this.feedback = {
        text: `${vehicle.name} is now your Active Ride for Smartphone Spawning!`,
        error: false,
      };
      this.render();
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-g-upg').forEach((btn) => {
      btn.addEventListener('click', () => {
        const stat = btn.dataset.upgradeStat as keyof OwnedVehicleRecord['upgrades'];
        if (!stat) return;
        const res = economySystem.upgradeVehicle(vehicle.id, stat);
        if (!res.ok || !res.vehicle) {
          audioSystem.playError();
          this.feedback = {text: res.reason ?? 'Cannot upgrade right now.', error: true};
          this.render();
          return;
        }
        audioSystem.playUpgrade();
        this.feedback = {
          text: `Upgraded ${stat.toUpperCase()} to Tier ${res.newLevel}/5!`,
          error: false,
        };
        this.callbacks.onVehicleUpdated?.(res.vehicle);
        this.render();
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-g-paint').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = GARAGE_PAINT_COLORS.find((x) => x.id === btn.dataset.paintId);
        if (!p) return;
        const already =
          vehicle.customization.paintColor.toLowerCase() === p.hex.toLowerCase();
        this.applyPartPatch(
          vehicle,
          {paintColor: p.hex, secondaryColor: p.roofHex},
          p.price,
          `${p.name} Paint`,
          already,
        );
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-g-wheel').forEach((btn) => {
      btn.addEventListener('click', () => {
        const w = WHEEL_OPTIONS.find((x) => x.id === btn.dataset.wheelId);
        if (!w) return;
        this.applyPartPatch(
          vehicle,
          {wheelStyle: w.id},
          w.price,
          w.name,
          vehicle.customization.wheelStyle === w.id,
        );
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-g-spoiler').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sp = SPOILER_OPTIONS.find((x) => x.id === btn.dataset.spoilerId);
        if (!sp) return;
        this.applyPartPatch(
          vehicle,
          {spoilerStyle: sp.id},
          sp.price,
          sp.name,
          vehicle.customization.spoilerStyle === sp.id,
        );
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-g-decal').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dc = DECAL_OPTIONS.find((x) => x.id === btn.dataset.decalId);
        if (!dc) return;
        this.applyPartPatch(
          vehicle,
          {decalStyle: dc.id},
          dc.price,
          dc.name,
          vehicle.customization.decalStyle === dc.id,
        );
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-g-headlight').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hl = HEADLIGHT_OPTIONS.find((x) => x.id === btn.dataset.headlightId);
        if (!hl) return;
        this.applyPartPatch(
          vehicle,
          {headlightStyle: hl.id},
          hl.price,
          hl.name,
          vehicle.customization.headlightStyle === hl.id,
        );
      });
    });
  }

  private bindShowroomEvents(): void {
    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-g-buy').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modelId = btn.dataset.showroomBuy as OwnedVehicleRecord['modelId'];
        if (!modelId) return;
        const res = economySystem.purchaseVehicleModel(modelId);
        if (!res.ok || !res.vehicle) {
          audioSystem.playError();
          this.feedback = {text: res.reason ?? 'Purchase failed.', error: true};
          this.render();
          return;
        }
        audioSystem.playUpgrade();
        this.selectedVehicleId = res.vehicle.id;
        this.callbacks.onActiveVehicleChanged?.(res.vehicle.id);
        this.callbacks.onVehicleUpdated?.(res.vehicle);
        this.feedback = {
          text: `Purchased ${res.vehicle.name}! Selected as your Active Ride.`,
          error: false,
        };
        this.activeTab = 'customize';
        this.render();
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-g-use').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.showroomUse;
        if (!id) return;
        audioSystem.playButtonClick();
        economySystem.setActiveVehicleId(id);
        this.selectedVehicleId = id;
        this.callbacks.onActiveVehicleChanged?.(id);
        this.activeTab = 'customize';
        this.feedback = null;
        this.render();
      });
    });
  }

  public destroy(): void {
    this.openState = false;
    this.backdrop.remove();
  }
}
