import {FLOOR_STYLES, FURNITURE_CATALOG, WALL_STYLES} from '@/src/game/data/propertyData';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {economySystem} from '@/src/game/systems/EconomySystem';
import {
  FurnitureCatalogItem,
  PlacedFurnitureItem,
  PropertyDeed,
  PropertyDef,
} from '@/src/game/types/gameTypes';

export interface DecorateToolbarCallbacks {
  onToggleDecorate: (active: boolean) => void;
  onChangeFloor: (floorStyle: string) => void;
  onChangeWall: (wallStyle: string) => void;
  onSelectPlacementCatalogItem: (item: FurnitureCatalogItem | null) => void;
  onNudgeSelected: (dx: number, dy: number) => void;
  onRotateSelected: () => void;
  onRemoveSelected: () => void;
  onSaveDeed: () => Promise<boolean>;
}

function esc(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export class DecorateToolbar {
  private readonly root: HTMLDivElement;
  private visible = false;
  private decorateActive = false;
  private activeSubTab: 'furniture' | 'styles' = 'furniture';
  private pendingCatalogId: string | null = null;
  private selectedPlacedItem: PlacedFurnitureItem | null = null;
  private deed: PropertyDeed | null = null;
  private propDef: PropertyDef | null = null;
  private saving = false;

  constructor(
    parent: HTMLElement,
    private readonly callbacks: DecorateToolbarCallbacks,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'fixed bottom-14 left-3 z-20 hidden max-w-[340px] sm:max-w-md pointer-events-none';
    parent.appendChild(this.root);
  }

  public show(propDef: PropertyDef, deed: PropertyDeed): void {
    this.visible = true;
    this.propDef = propDef;
    this.deed = deed;
    this.decorateActive = false;
    this.pendingCatalogId = null;
    this.selectedPlacedItem = null;
    this.root.style.display = 'block';
    this.render();
  }

  public hide(): void {
    this.visible = false;
    this.decorateActive = false;
    this.root.style.display = 'none';
    this.root.innerHTML = '';
  }

  public updateState(deed: PropertyDeed, selectedItem: PlacedFurnitureItem | null): void {
    this.deed = deed;
    this.selectedPlacedItem = selectedItem;
    if (this.visible) this.render();
  }

  public clearPendingCatalogItem(): void {
    this.pendingCatalogId = null;
    this.callbacks.onSelectPlacementCatalogItem(null);
    if (this.visible) this.render();
  }

  public isDecorateActive(): boolean {
    return this.decorateActive;
  }

  private render(): void {
    if (!this.visible || !this.deed || !this.propDef) return;

    if (!this.decorateActive) {
      this.root.innerHTML = `
        <div class="ui-interactive flex items-center gap-2">
          <button id="cc-dec-open" type="button" class="cc-btn-primary px-3.5 py-2 rounded-xl text-xs font-bold min-h-[40px] cursor-pointer shadow-lg">
            🛋️ Decorate Home (${this.deed.furniture.length}/${this.propDef.maxFurniture})
          </button>
        </div>
      `;
      this.root.querySelector('#cc-dec-open')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.decorateActive = true;
        this.callbacks.onToggleDecorate(true);
        this.render();
      });
      return;
    }

    const coins = economySystem.getCoins();

    this.root.innerHTML = `
      <div class="ui-interactive cc-panel rounded-2xl p-3 text-slate-100 space-y-2.5 max-h-[54dvh] overflow-y-auto">
        <div class="flex items-center justify-between gap-2 border-b border-[#22355c] pb-2">
          <div>
            <div class="font-display font-bold text-xs text-white">Decorate: ${esc(this.propDef.name)}</div>
            <div class="font-mono-tabular text-[10px] text-amber-300">
              ${this.deed.furniture.length}/${this.propDef.maxFurniture} Items · ${coins}c
            </div>
          </div>
          <div class="flex gap-1.5">
            <button id="cc-dec-save" type="button" class="cc-btn-primary px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer">
              ${this.saving ? 'Saving...' : 'Save'}
            </button>
            <button id="cc-dec-done" type="button" class="cc-btn-secondary px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer">Done</button>
          </div>
        </div>

        <div class="flex gap-1.5">
          <button type="button" data-dtab="furniture" class="cc-dec-tab flex-1 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
            this.activeSubTab === 'furniture' ? 'bg-sky-500 text-[#06101f]' : 'bg-[#131f38] text-slate-300'
          }">Furniture</button>
          <button type="button" data-dtab="styles" class="cc-dec-tab flex-1 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
            this.activeSubTab === 'styles' ? 'bg-sky-500 text-[#06101f]' : 'bg-[#131f38] text-slate-300'
          }">Floors & Walls</button>
        </div>

        ${
          this.selectedPlacedItem
            ? `<div class="rounded-xl bg-[#091020] border border-amber-400/60 p-2 space-y-1.5">
                <div class="flex items-center justify-between text-[11px]">
                  <span class="font-bold text-amber-300">Selected Item (${this.selectedPlacedItem.rotationDeg}°)</span>
                  <button id="cc-dec-del" type="button" class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-200 font-bold cursor-pointer">Remove</button>
                </div>
                <div class="flex flex-wrap items-center gap-1">
                  <button type="button" data-nd="-16,0" class="cc-dec-nudge cc-btn-secondary px-2 py-1 rounded text-[11px] font-bold cursor-pointer">←</button>
                  <button type="button" data-nd="16,0" class="cc-dec-nudge cc-btn-secondary px-2 py-1 rounded text-[11px] font-bold cursor-pointer">→</button>
                  <button type="button" data-nd="0,-16" class="cc-dec-nudge cc-btn-secondary px-2 py-1 rounded text-[11px] font-bold cursor-pointer">↑</button>
                  <button type="button" data-nd="0,16" class="cc-dec-nudge cc-btn-secondary px-2 py-1 rounded text-[11px] font-bold cursor-pointer">↓</button>
                  <button id="cc-dec-rot" type="button" class="cc-btn-secondary px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer">Rotate 90°</button>
                </div>
              </div>`
            : `<div class="text-[11px] text-sky-200">${
                this.pendingCatalogId
                  ? 'Tap anywhere inside the room floor to place your item!'
                  : 'Tap an item below to place, or tap placed furniture to move/rotate.'
              }</div>`
        }

        ${
          this.activeSubTab === 'furniture'
            ? `<div class="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
                ${FURNITURE_CATALOG.map((item) => {
                  const active = this.pendingCatalogId === item.id;
                  return `
                    <button type="button" data-fcat="${item.id}" class="cc-dec-fcat rounded-lg border p-2 text-left cursor-pointer ${
                      active ? 'bg-sky-500/20 border-sky-400' : 'bg-[#091020] border-[#22355c]'
                    }">
                      <div class="font-bold text-[11px] text-white truncate">${esc(item.name)}</div>
                      <div class="font-mono-tabular text-[10px] text-amber-300">${item.price}c · ${esc(item.category)}</div>
                    </button>
                  `;
                }).join('')}
              </div>`
            : `<div class="space-y-2.5">
                <div>
                  <div class="text-[10px] font-mono-tabular uppercase text-sky-300 mb-1">Floor Material</div>
                  <div class="flex flex-wrap gap-1.5">
                    ${FLOOR_STYLES.map(
                      (f) => `<button type="button" data-flr="${f.id}" class="cc-dec-flr px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                        this.deed?.floorStyle === f.id ? 'border-amber-400 bg-amber-400/15 text-white' : 'border-[#22355c] bg-[#091020] text-slate-300'
                      }"><span class="w-2.5 h-2.5 rounded-sm inline-block" style="background:${f.swatchHex}"></span>${esc(f.label)}</button>`,
                    ).join('')}
                  </div>
                </div>
                <div>
                  <div class="text-[10px] font-mono-tabular uppercase text-sky-300 mb-1">Wall Style</div>
                  <div class="flex flex-wrap gap-1.5">
                    ${WALL_STYLES.map(
                      (w) => `<button type="button" data-wal="${w.id}" class="cc-dec-wal px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                        this.deed?.wallStyle === w.id ? 'border-amber-400 bg-amber-400/15 text-white' : 'border-[#22355c] bg-[#091020] text-slate-300'
                      }"><span class="w-2.5 h-2.5 rounded-sm inline-block" style="background:${w.swatchHex}"></span>${esc(w.label)}</button>`,
                    ).join('')}
                  </div>
                </div>
              </div>`
        }
      </div>
    `;

    this.root.querySelector('#cc-dec-done')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.decorateActive = false;
      this.pendingCatalogId = null;
      this.callbacks.onSelectPlacementCatalogItem(null);
      this.callbacks.onToggleDecorate(false);
      this.render();
    });

    this.root.querySelector('#cc-dec-save')?.addEventListener('click', async () => {
      if (this.saving) return;
      this.saving = true;
      this.render();
      await this.callbacks.onSaveDeed();
      this.saving = false;
      audioSystem.playInteract();
      this.render();
    });

    this.root.querySelectorAll<HTMLButtonElement>('.cc-dec-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.activeSubTab = (btn.dataset.dtab as 'furniture' | 'styles') || 'furniture';
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('.cc-dec-fcat').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.fcat || null;
        this.pendingCatalogId = this.pendingCatalogId === id ? null : id;
        const item = FURNITURE_CATALOG.find((x) => x.id === this.pendingCatalogId) ?? null;
        audioSystem.playButtonClick();
        this.callbacks.onSelectPlacementCatalogItem(item);
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('.cc-dec-flr').forEach((btn) => {
      btn.addEventListener('click', () => {
        const flr = btn.dataset.flr;
        if (!flr) return;
        audioSystem.playInteract();
        this.callbacks.onChangeFloor(flr);
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('.cc-dec-wal').forEach((btn) => {
      btn.addEventListener('click', () => {
        const wal = btn.dataset.wal;
        if (!wal) return;
        audioSystem.playInteract();
        this.callbacks.onChangeWall(wal);
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('.cc-dec-nudge').forEach((btn) => {
      btn.addEventListener('click', () => {
        const parts = (btn.dataset.nd || '0,0').split(',').map(Number);
        audioSystem.playButtonClick();
        this.callbacks.onNudgeSelected(parts[0] || 0, parts[1] || 0);
      });
    });

    this.root.querySelector('#cc-dec-rot')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onRotateSelected();
    });

    this.root.querySelector('#cc-dec-del')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onRemoveSelected();
    });
  }

  public destroy(): void {
    this.visible = false;
    this.decorateActive = false;
    this.root.remove();
  }
}
