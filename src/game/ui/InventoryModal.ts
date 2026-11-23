import {CHARACTER_PRESETS} from '@/src/config/constants';
import {getShopItemById} from '@/src/game/data/catalog';
import {
  renderCharacterPortraitDataUrl,
  renderShopItemIconDataUrl,
} from '@/src/game/graphics/PixelArtGenerator';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {cloudSaveManager} from '@/src/game/systems/CloudSaveManager';
import {CITY_ACHIEVEMENTS, economySystem} from '@/src/game/systems/EconomySystem';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {ClothingSlot, ShopItem} from '@/src/game/types/gameTypes';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface InventoryModalCallbacks {
  onAppearanceChanged: () => void;
  onClose?: () => void;
}

const SLOT_LABELS: {slot: ClothingSlot; label: string}[] = [
  {slot: 'shirt', label: 'Shirt / Top'},
  {slot: 'jacket', label: 'Jacket'},
  {slot: 'trousers', label: 'Trousers'},
  {slot: 'shoes', label: 'Shoes'},
  {slot: 'hat', label: 'Hat'},
  {slot: 'glasses', label: 'Glasses'},
  {slot: 'accessory', label: 'Accessory'},
];

export class InventoryModal {
  private readonly backdrop: HTMLDivElement;
  private openState = false;

  constructor(
    parent: HTMLElement,
    private readonly callbacks: InventoryModalCallbacks,
  ) {
    this.backdrop = document.createElement('div');
    this.backdrop.className =
      'ui-interactive fixed inset-0 z-40 hidden items-center justify-center bg-[#040812]/80 p-3 sm:p-4';
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

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.backdrop.style.display = 'none';
    this.backdrop.innerHTML = '';
    this.callbacks.onClose?.();
  }

  public open(initialTab: 'items' | 'wardrobe' | 'progress' = 'items'): void {
    this.openState = true;
    let activeTab: 'items' | 'wardrobe' | 'progress' = initialTab;
    let feedback: {text: string; error: boolean} | null = null;

    const render = () => {
      const save = saveSystem.getState();
      const preset =
        CHARACTER_PRESETS.find((p) => p.id === save.appearanceId) ?? CHARACTER_PRESETS[0];
      const portrait = renderCharacterPortraitDataUrl(
        preset,
        save.equippedClothing,
        save.hairOverride,
        save.appearanceConfig,
      );

      const invEntries = economySystem.getInventory();
      const resolvedItems: {item: ShopItem; qty: number}[] = [];
      for (const entry of invEntries) {
        const item = getShopItemById(entry.itemId);
        if (item && entry.quantity > 0) {
          resolvedItems.push({item, qty: entry.quantity});
        }
      }

      const clothingOwned = resolvedItems.filter((x) => Boolean(x.item.clothing));
      const generalOwned = resolvedItems.filter((x) => !x.item.clothing);
      const boostRem = economySystem.getSpeedBoostRemainingSec();

      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
          <div class="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[#22355c]">
            <div class="min-w-0">
              <div class="text-xs font-semibold text-sky-300">Resident Pack & Wardrobe</div>
              <h2 class="font-display text-lg sm:text-xl font-bold text-white truncate">${esc(save.playerName)}'s Bag</h2>
            </div>
            <div class="flex items-center gap-2.5 shrink-0">
              <div class="px-3 py-1.5 rounded-lg bg-[#060b16] border border-amber-400/50 text-amber-300 font-mono-tabular text-xs sm:text-sm font-bold">
                ${save.coins} Coins
              </div>
              <button id="cc-inv-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
                Close [I]
              </button>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-2.5 bg-[#091020] border-b border-[#22355c]">
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" data-inv-tab="items" class="cc-inv-tab px-3.5 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] cursor-pointer ${
                activeTab === 'items'
                  ? 'bg-sky-500 text-[#06101f]'
                  : 'bg-[#131f38] text-slate-300 border border-[#22355c]'
              }">Items (${generalOwned.length})</button>
              <button type="button" data-inv-tab="wardrobe" class="cc-inv-tab px-3.5 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] cursor-pointer ${
                activeTab === 'wardrobe'
                  ? 'bg-sky-500 text-[#06101f]'
                  : 'bg-[#131f38] text-slate-300 border border-[#22355c]'
              }">Wardrobe (${clothingOwned.length})</button>
              <button type="button" data-inv-tab="progress" class="cc-inv-tab px-3.5 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] cursor-pointer ${
                activeTab === 'progress'
                  ? 'bg-sky-500 text-[#06101f]'
                  : 'bg-[#131f38] text-slate-300 border border-[#22355c]'
              }">Progress (${save.achievements.unlockedIds.length}/${CITY_ACHIEVEMENTS.length})</button>
            </div>
            <div class="text-xs font-mono-tabular text-emerald-300">
              Energy: ${save.energy}/100${boostRem > 0 ? ` · Speed +24% (${boostRem}s)` : ''}
            </div>
          </div>

          ${
            feedback
              ? `<div class="mx-5 mt-3 px-3.5 py-2 rounded-lg text-xs font-medium border ${
                  feedback.error
                    ? 'bg-rose-500/15 border-rose-400/50 text-rose-200'
                    : 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                }">${esc(feedback.text)}</div>`
              : ''
          }

          <div class="p-5 overflow-y-auto">
            ${
              activeTab === 'progress'
                ? (() => {
                    const sync = cloudSaveManager.getSyncState();
                    const counts: Record<string, number> = {
                      ach_explorer_5: save.missions.visitedDistricts.length,
                      ach_open_doors: save.missions.visitedBuildings.length,
                      ach_first_purchase: save.missions.itemsPurchased,
                      ach_style_collector: clothingOwned.length,
                      ach_busy_resident: save.missions.activitiesCompleted,
                    };
                    return `
                      <div class="space-y-4">
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3 text-center">
                            <div class="text-[11px] text-slate-400">Districts</div>
                            <div class="font-mono-tabular text-base font-bold text-sky-300">${save.missions.visitedDistricts.length}/11</div>
                          </div>
                          <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3 text-center">
                            <div class="text-[11px] text-slate-400">Buildings</div>
                            <div class="font-mono-tabular text-base font-bold text-emerald-300">${save.missions.visitedBuildings.length}/35</div>
                          </div>
                          <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3 text-center">
                            <div class="text-[11px] text-slate-400">Purchases</div>
                            <div class="font-mono-tabular text-base font-bold text-amber-300">${save.missions.itemsPurchased}</div>
                          </div>
                          <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3 text-center">
                            <div class="text-[11px] text-slate-400">Activities</div>
                            <div class="font-mono-tabular text-base font-bold text-violet-300">${save.missions.activitiesCompleted}</div>
                          </div>
                        </div>

                        <div class="rounded-xl bg-[#091020] border border-[#22355c] px-3.5 py-2.5 flex items-center justify-between text-xs">
                          <span class="text-slate-300">
                            ${sync.uid ? `Cloud Account: <strong class="text-white">@${esc(sync.username ?? '')}</strong> (v${save.saveVersion})` : 'Guest Session (Local Backup Only)'}
                          </span>
                          <span class="font-mono-tabular ${sync.status === 'saved' ? 'text-emerald-300' : 'text-sky-300'}">${sync.status.toUpperCase()}</span>
                        </div>

                        <div class="space-y-2">
                          ${CITY_ACHIEVEMENTS.map((ach) => {
                            const unlocked = save.achievements.unlockedIds.includes(ach.id);
                            const cur = Math.min(ach.goal, counts[ach.id] ?? 0);
                            return `
                              <div class="rounded-xl bg-[#0d1629] border ${unlocked ? 'border-emerald-400/60' : 'border-[#22355c]'} p-3 flex items-center justify-between gap-3">
                                <div>
                                  <div class="font-display font-bold text-sm text-white">${ach.title}</div>
                                  <div class="text-xs text-slate-400">${ach.description}</div>
                                </div>
                                <span class="font-mono-tabular text-xs font-bold px-2.5 py-1 rounded-lg ${
                                  unlocked ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50' : 'bg-[#060b16] text-slate-300 border border-[#22355c]'
                                }">${unlocked ? 'UNLOCKED' : `${cur}/${ach.goal}`}</span>
                              </div>
                            `;
                          }).join('')}
                        </div>
                      </div>
                    `;
                  })()
                : activeTab === 'items'
                ? generalOwned.length === 0
                  ? `<div class="rounded-xl bg-[#0d1629] border border-[#22355c] p-6 text-center text-xs text-slate-400">
                      Your backpack is empty. Visit Bean &amp; Byte Cafe, FreshMart Grocery, Sunset Bistro, Pet Shop, or Starlight Cinema to pick up items!
                    </div>`
                  : `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      ${generalOwned
                        .map(({item, qty}) => {
                          const actionHtml =
                            item.kind === 'consumable'
                              ? `<button type="button" data-use-id="${item.id}" class="cc-inv-use cc-btn-primary px-3 py-1.5 rounded-lg text-xs font-bold min-h-[36px] cursor-pointer">Consume</button>`
                              : `<span class="text-[11px] text-sky-300 font-semibold">${item.kind === 'pet' ? 'Pet Companion' : item.kind === 'ticket' ? 'Cinema Pass' : 'Collectible'}</span>`;
                          return `
                            <div class="rounded-xl bg-[#0d1629] border border-[#22355c] p-3.5 flex flex-col justify-between gap-2.5">
                              <div class="flex items-start gap-3">
                                <img src="${renderShopItemIconDataUrl(item)}" alt="${item.name}" class="w-11 h-11 rounded-lg bg-[#060b16] border border-[#2c4470] p-1 object-contain shrink-0" style="image-rendering: pixelated;" />
                                <div class="min-w-0 flex-1">
                                  <div class="flex items-center justify-between gap-2">
                                    <span class="font-display font-bold text-sm text-white truncate">${item.name}</span>
                                    <span class="font-mono-tabular text-xs font-bold text-sky-300 shrink-0">×${qty}</span>
                                  </div>
                                  <p class="text-xs text-slate-300 mt-0.5">${item.description}</p>
                                </div>
                              </div>
                              <div class="flex justify-end pt-2 border-t border-[#1b2c4e]">
                                ${actionHtml}
                              </div>
                            </div>
                          `;
                        })
                        .join('')}
                    </div>`
                : `<div class="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
                    <div class="rounded-xl bg-[#091020] border border-[#22355c] p-4 flex flex-col items-center">
                      <div class="w-24 h-28 rounded-xl bg-[#060b16] border border-sky-400/40 flex items-center justify-center overflow-hidden mb-3">
                        <img src="${portrait}" alt="Equipped character" class="w-20 h-24 object-contain" style="image-rendering: pixelated;" />
                      </div>
                      <div class="w-full space-y-1.5">
                        ${SLOT_LABELS.map((s) => {
                          const eqId = save.equippedClothing[s.slot];
                          const eqItem = eqId ? getShopItemById(eqId) : undefined;
                          return `
                            <div class="flex items-center justify-between gap-1 text-[11px] px-2 py-1 rounded bg-[#0d1629] border border-[#1d2e50]">
                              <span class="text-slate-400">${s.label}</span>
                              <div class="flex items-center gap-1 min-w-0">
                                <span class="text-slate-200 truncate max-w-[90px]">${eqItem ? eqItem.name : 'Default'}</span>
                                ${eqItem ? `<button type="button" data-unequip-slot="${s.slot}" class="cc-inv-unequip text-rose-300 hover:text-rose-200 font-bold px-1 cursor-pointer" title="Remove">×</button>` : ''}
                              </div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </div>

                    <div class="space-y-2.5">
                      <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3">
                        <div class="text-[11px] font-semibold text-sky-300 mb-1.5">Saved Outfit Presets</div>
                        <div class="flex flex-wrap gap-1.5">
                          ${save.outfitPresets
                            .map(
                              (op) => `
                                <button type="button" data-apply-preset="${op.id}" class="cc-inv-preset px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${
                                  save.selectedOutfitPresetId === op.id
                                    ? 'bg-sky-500 text-[#06101f]'
                                    : 'bg-[#131f38] text-slate-200 border border-[#22355c] hover:border-sky-400'
                                }">${op.name}</button>
                              `,
                            )
                            .join('')}
                        </div>
                      </div>
                      ${
                        clothingOwned.length === 0
                          ? `<div class="rounded-xl bg-[#0d1629] border border-[#22355c] p-6 text-center text-xs text-slate-400">
                              No boutique clothing owned yet. Visit Threadz Boutique in the Shopping District or Apex Tech Center to expand your wardrobe!
                            </div>`
                          : clothingOwned
                              .map(({item}) => {
                                const equipped = economySystem.isItemEquipped(item.id);
                                return `
                                  <div class="rounded-xl bg-[#0d1629] border border-[#22355c] p-3 flex items-center justify-between gap-3">
                                    <div class="flex items-center gap-3 min-w-0">
                                      <img src="${renderShopItemIconDataUrl(item)}" alt="${item.name}" class="w-10 h-10 rounded-lg bg-[#060b16] border border-[#2c4470] p-0.5 object-contain shrink-0" style="image-rendering: pixelated;" />
                                      <div class="min-w-0">
                                        <div class="font-display font-bold text-sm text-white truncate">${item.name}</div>
                                        <div class="text-[11px] text-slate-400 uppercase">${item.clothing?.category ?? item.subCategory}</div>
                                      </div>
                                    </div>
                                    <button type="button" data-wear-id="${item.id}" class="cc-inv-wear px-3 py-1.5 rounded-lg text-xs font-bold min-h-[36px] shrink-0 cursor-pointer ${
                                      equipped
                                        ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-200'
                                        : 'cc-btn-primary'
                                    }">${equipped ? 'Unequip' : 'Equip'}</button>
                                  </div>
                                `;
                              })
                              .join('')
                      }
                    </div>
                  </div>`
            }
          </div>
        </div>
      `;

      this.backdrop.querySelector('#cc-inv-close')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-inv-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          audioSystem.playButtonClick();
          activeTab = (btn.dataset.invTab as 'items' | 'wardrobe' | 'progress') ?? 'items';
          feedback = null;
          render();
        });
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-inv-use').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.useId;
          if (!id) return;
          const res = economySystem.consumeItem(id);
          if (res.ok) {
            audioSystem.playInteract();
            const boost = res.speedBoostSec > 0 ? ` Speed Boost active (${res.speedBoostSec}s)!` : '';
            feedback = {text: `Consumed! Energy is now ${res.newEnergy}/100.${boost}`, error: false};
          } else {
            audioSystem.playError();
            feedback = {text: res.reason ?? 'Could not use item.', error: true};
          }
          render();
        });
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-inv-wear').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.wearId;
          if (!id) return;
          const item = getShopItemById(id);
          if (!item?.clothing) return;
          audioSystem.playInteract();
          if (economySystem.isItemEquipped(id)) {
            economySystem.unequipSlot(item.clothing.slot);
            feedback = {text: `Removed ${item.name}.`, error: false};
          } else {
            economySystem.equipClothing(id);
            feedback = {text: `Equipped ${item.name}!`, error: false};
          }
          this.callbacks.onAppearanceChanged();
          render();
        });
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-inv-unequip').forEach((btn) => {
        btn.addEventListener('click', () => {
          const slot = btn.dataset.unequipSlot as ClothingSlot | undefined;
          if (!slot) return;
          audioSystem.playButtonClick();
          economySystem.unequipSlot(slot);
          this.callbacks.onAppearanceChanged();
          render();
        });
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-inv-preset').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pid = btn.dataset.applyPreset;
          if (!pid) return;
          const res = economySystem.applyOutfitPreset(pid);
          if (res.ok) {
            audioSystem.playInteract();
            this.callbacks.onAppearanceChanged();
            feedback = {text: `Switched to "${btn.textContent?.trim()}" preset!`, error: false};
          } else {
            audioSystem.playError();
            feedback = {text: res.reason ?? 'Could not apply outfit preset.', error: true};
          }
          render();
        });
      });
    };

    render();
    this.backdrop.style.display = 'flex';
  }

  public destroy(): void {
    this.openState = false;
    this.backdrop.remove();
  }
}
