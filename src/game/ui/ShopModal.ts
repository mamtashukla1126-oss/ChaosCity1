import {CHARACTER_PRESETS, CLOTHING_CATEGORIES} from '@/src/config/constants';
import {
  getShopItemById,
  getShopItemsByDomain,
  SALON_HAIR_COLORS,
  SALON_HAIRSTYLES,
} from '@/src/game/data/catalog';
import {
  renderCharacterPortraitDataUrl,
  renderCharacterPreviewDataUrl,
  renderShopItemIconDataUrl,
} from '@/src/game/graphics/PixelArtGenerator';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {economySystem} from '@/src/game/systems/EconomySystem';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {
  ClothingCategory,
  Direction,
  EquippedClothing,
  HairStyleId,
  ShopDomain,
  ShopItem,
} from '@/src/game/types/gameTypes';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface ShopModalCallbacks {
  onAppearanceChanged: () => void;
  onItemPurchased?: (itemId: string) => void;
  onDineInCutscene?: (item: ShopItem, domain: ShopDomain) => void;
  onCinemaUnlocked?: () => void;
  onClose?: () => void;
}

export class ShopModal {
  private readonly backdrop: HTMLDivElement;
  private openState = false;

  constructor(
    parent: HTMLElement,
    private readonly callbacks: ShopModalCallbacks,
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

  public openShop(
    shopDomain: ShopDomain,
    title: string,
    subtitle: string,
    initialTab?: string,
  ): void {
    if (shopDomain === 'clothing') {
      this.openClothingBoutique(title, subtitle, initialTab as ClothingCategory | undefined);
      return;
    }

    this.openState = true;
    const allItems = getShopItemsByDomain(shopDomain).filter((i) => !i.unlockOnly);
    const categories = Array.from(new Set(allItems.map((i) => i.subCategory)));
    let activeTab = categories[0] ?? 'All';
    let feedback: {text: string; error: boolean} | null = null;

    const isTokenShop = shopDomain === 'lounge_prizes';

    const render = () => {
      const balance = isTokenShop ? economySystem.getLoungeTokens() : economySystem.getCoins();
      const unitLabel = isTokenShop ? 'FT' : 'Coins';
      const unitShort = isTokenShop ? ' FT' : 'c';
      const filtered =
        categories.length <= 1
          ? allItems
          : allItems.filter((i) => i.subCategory === activeTab);

      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
          <div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#22355c]">
            <div class="min-w-0">
              <div class="text-xs font-semibold text-sky-300 truncate">${esc(subtitle)}</div>
              <h2 class="font-display text-xl font-bold text-white truncate">${esc(title)}</h2>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <div class="px-3 py-1.5 rounded-lg bg-[#060b16] border border-amber-400/50 text-amber-300 font-mono-tabular text-sm font-bold">
                ${balance} ${unitLabel}
              </div>
              <button id="cc-shop-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
                Close
              </button>
            </div>
          </div>

          ${
            categories.length > 1
              ? `<div class="flex flex-wrap gap-1.5 px-5 py-2.5 bg-[#091020] border-b border-[#22355c]">
                  ${categories
                    .map(
                      (cat) => `
                        <button type="button" data-shop-tab="${cat}" class="cc-shop-tab px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[34px] cursor-pointer ${
                          cat === activeTab
                            ? 'bg-sky-500 text-[#06101f]'
                            : 'bg-[#131f38] text-slate-300 hover:text-white border border-[#22355c]'
                        }">
                          ${cat}
                        </button>
                      `,
                    )
                    .join('')}
                </div>`
              : ''
          }

          ${
            feedback
              ? `<div class="mx-5 mt-3 px-3.5 py-2 rounded-lg text-xs font-medium border ${
                  feedback.error
                    ? 'bg-rose-500/15 border-rose-400/50 text-rose-200'
                    : 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                }">${esc(feedback.text)}</div>`
              : ''
          }

          <div class="p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${filtered
              .map((item) => {
                const ownedQty = economySystem.getItemQuantity(item.id);
                const owned = ownedQty > 0;
                const equipped = economySystem.isItemEquipped(item.id);
                const canAfford = balance >= item.price;

                let actionBtn = '';
                if (!item.stackable && owned) {
                  if (item.clothing) {
                    actionBtn = `<button type="button" data-equip-id="${item.id}" class="cc-shop-equip px-3.5 py-2 rounded-lg text-xs font-bold min-h-[38px] cursor-pointer ${
                      equipped
                        ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-200'
                        : 'cc-btn-primary'
                    }">${equipped ? 'Equipped (Unequip)' : 'Equip'}</button>`;
                  } else {
                    actionBtn = `<span class="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-xs font-semibold">Owned</span>`;
                  }
                } else {
                  actionBtn = `<button type="button" data-buy-id="${item.id}" class="cc-shop-buy px-3.5 py-2 rounded-lg text-xs font-bold min-h-[38px] cursor-pointer ${
                    canAfford
                      ? 'cc-btn-primary'
                      : 'bg-[#1a243d] border border-slate-600/50 text-slate-400 hover:border-rose-400/60'
                  }">${isTokenShop ? 'Redeem' : 'Buy'} · ${item.price}${unitShort}</button>`;
                }

                const useBtn =
                  item.kind === 'consumable' && owned
                    ? `<button type="button" data-consume-id="${item.id}" class="cc-shop-use cc-btn-secondary px-3 py-2 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer">Use (×${ownedQty})</button>`
                    : '';

                const dineInBtn =
                  (shopDomain === 'cafe' || shopDomain === 'restaurant') && item.kind === 'consumable'
                    ? `<button type="button" data-dine-id="${item.id}" class="cc-shop-dine px-3 py-2 rounded-lg text-xs font-bold min-h-[38px] cursor-pointer ${
                        canAfford
                          ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-200 hover:bg-emerald-500/30'
                          : 'bg-[#1a243d] border border-slate-600/50 text-slate-400'
                      }">${shopDomain === 'cafe' ? 'Order & Drink' : 'Order & Eat'} · ${item.price}c</button>`
                    : '';

                const iconUrl = renderShopItemIconDataUrl(item);

                return `
                  <div class="rounded-xl bg-[#0d1629] border border-[#22355c] p-3.5 flex flex-col justify-between gap-3">
                    <div class="flex items-start gap-3">
                      <img src="${iconUrl}" alt="${item.name}" class="w-12 h-12 rounded-lg bg-[#060b16] border border-[#2c4470] p-1 object-contain shrink-0" style="image-rendering: pixelated;" />
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center justify-between gap-2">
                          <h3 class="font-display font-bold text-sm text-white truncate">${item.name}</h3>
                          <span class="font-mono-tabular text-xs font-bold text-amber-300 shrink-0">${item.price}${unitShort}</span>
                        </div>
                        <p class="text-xs text-slate-300 mt-1 leading-relaxed">${item.description}</p>
                        ${owned && item.stackable ? `<div class="text-[11px] text-sky-300 mt-1 font-mono-tabular">In Bag: ${ownedQty}</div>` : ''}
                      </div>
                    </div>
                    <div class="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#1b2c4e]">
                      ${useBtn}
                      ${dineInBtn}
                      ${actionBtn}
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      `;

      this.backdrop.querySelector('#cc-shop-close')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-shop-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          audioSystem.playButtonClick();
          activeTab = btn.dataset.shopTab ?? activeTab;
          feedback = null;
          render();
        });
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-shop-buy').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.buyId;
          if (!id) return;
          const res = isTokenShop
            ? economySystem.redeemLoungePrize(id)
            : economySystem.purchaseItem(id);
          if (res.ok) {
            audioSystem.playCoin();
            const purchased = getShopItemById(id);
            feedback = {
              text: `${isTokenShop ? 'Redeemed' : 'Purchased'} ${purchased?.name ?? 'item'}! Remaining balance: ${res.balance} ${unitLabel}.`,
              error: false,
            };
            this.callbacks.onItemPurchased?.(id);
            if (id === 'cin_ticket') {
              this.callbacks.onCinemaUnlocked?.();
            }
          } else {
            audioSystem.playError();
            feedback = {text: res.reason ?? 'Could not complete purchase.', error: true};
          }
          render();
        });
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-shop-equip').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.equipId;
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

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-shop-use').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.consumeId;
          if (!id) return;
          const res = economySystem.consumeItem(id);
          if (res.ok) {
            audioSystem.playInteract();
            const boostTxt = res.speedBoostSec > 0 ? ` +${res.speedBoostSec}s Speed Boost!` : '';
            feedback = {
              text: `Used item! Energy ${res.newEnergy}/100.${boostTxt}`,
              error: false,
            };
          } else {
            audioSystem.playError();
            feedback = {text: res.reason ?? 'Unable to use item.', error: true};
          }
          render();
        });
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-shop-dine').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.dineId;
          if (!id) return;
          const bought = economySystem.purchaseItem(id);
          if (!bought.ok) {
            audioSystem.playError();
            feedback = {text: bought.reason ?? 'Could not complete order.', error: true};
            render();
            return;
          }
          const consumed = economySystem.consumeItem(id);
          const item = getShopItemById(id);
          audioSystem.playCoin();
          this.callbacks.onItemPurchased?.(id);
          if (item && this.callbacks.onDineInCutscene) {
            this.close();
            this.callbacks.onDineInCutscene(item, shopDomain);
            return;
          }
          const boostTxt =
            consumed.speedBoostSec > 0 ? ` +${consumed.speedBoostSec}s Speed Boost!` : '';
          feedback = {
            text: `Served fresh ${item?.name ?? 'order'}! Energy ${consumed.newEnergy}/100.${boostTxt}`,
            error: false,
          };
          render();
        });
      });
    };

    render();
    this.backdrop.style.display = 'flex';
  }

  private openClothingBoutique(
    title: string,
    subtitle: string,
    initialCat?: ClothingCategory,
  ): void {
    this.openState = true;
    const allClothing = getShopItemsByDomain('clothing');
    let activeCat: ClothingCategory | 'wardrobe' = initialCat ?? 'shirts';
    let previewDir: Direction = 'down';
    let previewItemId: string | null =
      allClothing.find((i) => i.clothing?.category === activeCat)?.id ?? null;
    let feedback: {text: string; error: boolean} | null = null;

    const getPreviewPortrait = (): string => {
      const save = saveSystem.getState();
      const preset =
        CHARACTER_PRESETS.find((p) => p.id === save.appearanceId) ?? CHARACTER_PRESETS[0];
      const baseEq: EquippedClothing = {...save.equippedClothing};
      if (previewItemId) {
        const previewItem = getShopItemById(previewItemId);
        if (previewItem?.clothing) {
          baseEq[previewItem.clothing.slot] = previewItem.id;
        }
      }
      return renderCharacterPreviewDataUrl(
        preset,
        save.appearanceConfig,
        baseEq,
        previewDir,
        'idle',
        0,
        112,
        140,
      );
    };

    const render = () => {
      const coins = economySystem.getCoins();
      const items: ShopItem[] =
        activeCat === 'wardrobe'
          ? allClothing.filter((i) => economySystem.ownsItem(i.id))
          : allClothing.filter((i) => !i.unlockOnly && i.clothing?.category === activeCat);

      const previewItem = previewItemId ? getShopItemById(previewItemId) : undefined;
      const portraitUrl = getPreviewPortrait();

      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-4xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
          <div class="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#22355c]">
            <div class="min-w-0">
              <div class="text-xs font-semibold text-sky-300 truncate">${esc(subtitle)}</div>
              <h2 class="font-display text-lg sm:text-xl font-bold text-white truncate">${esc(title)}</h2>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <div class="px-3 py-1.5 rounded-lg bg-[#060b16] border border-amber-400/50 text-amber-300 font-mono-tabular text-sm font-bold">
                ${coins} Coins
              </div>
              <button id="cc-cloth-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
                Close
              </button>
            </div>
          </div>

          <!-- 12 Clothing Categories + Wardrobe Tab -->
          <div class="flex flex-wrap gap-1.5 px-5 py-2.5 bg-[#091020] border-b border-[#22355c]">
            ${CLOTHING_CATEGORIES.map(
              (c) => `
                <button type="button" data-cl-cat="${c.id}" class="cc-cl-tab px-2.5 py-1.5 rounded-lg text-xs font-semibold min-h-[32px] cursor-pointer ${
                  activeCat === c.id
                    ? 'bg-sky-500 text-[#06101f]'
                    : 'bg-[#131f38] text-slate-300 hover:text-white border border-[#22355c]'
                }">${c.label}</button>
              `,
            ).join('')}
            <button type="button" data-cl-cat="wardrobe" class="cc-cl-tab px-2.5 py-1.5 rounded-lg text-xs font-semibold min-h-[32px] cursor-pointer ${
              activeCat === 'wardrobe'
                ? 'bg-emerald-400 text-[#06101f]'
                : 'bg-[#131f38] text-emerald-300 hover:text-white border border-emerald-500/40'
            }">My Wardrobe</button>
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

          <div class="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
            <!-- Live Character Preview Column -->
            <div class="rounded-xl bg-[#091020] border border-[#22355c] p-4 flex flex-col items-center text-center">
              <div class="text-[11px] font-semibold text-sky-300 uppercase tracking-wider mb-2">Live Try-On</div>
              <div class="w-32 h-40 rounded-xl bg-[#060b16] border border-sky-400/40 flex items-center justify-center overflow-hidden mb-2.5">
                <img src="${portraitUrl}" alt="Try-on preview" class="w-28 h-36 object-contain" style="image-rendering: pixelated;" />
              </div>
              <div class="flex items-center gap-1 mb-2.5">
                ${(
                  [
                    {d: 'down', lbl: 'F'},
                    {d: 'left', lbl: 'L'},
                    {d: 'up', lbl: 'B'},
                    {d: 'right', lbl: 'R'},
                  ] as {d: Direction; lbl: string}[]
                )
                  .map(
                    (x) => `
                      <button type="button" data-cl-dir="${x.d}" class="cc-cl-dir px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                        previewDir === x.d
                          ? 'bg-sky-500 text-[#06101f]'
                          : 'bg-[#0d1629] text-slate-300 border border-[#22355c]'
                      }">${x.lbl}</button>
                    `,
                  )
                  .join('')}
              </div>
              <div class="text-xs font-bold text-white">${previewItem ? previewItem.name : 'Current Outfit'}</div>
              <div class="text-[11px] text-slate-400 mt-1">
                ${previewItem ? previewItem.clothing?.category.toUpperCase() : 'Tap any item to preview'}
              </div>
            </div>

            <!-- Item List Column -->
            <div class="space-y-2.5">
              ${
                items.length === 0
                  ? `<div class="rounded-xl bg-[#0d1629] border border-[#22355c] p-6 text-center text-xs text-slate-400">
                      No clothing owned in your Wardrobe yet. Browse the 12 clothing categories above to buy items!
                    </div>`
                  : items
                      .map((item) => {
                        const owned = economySystem.ownsItem(item.id);
                        const equipped = economySystem.isItemEquipped(item.id);
                        const isPreviewing = previewItemId === item.id;
                        const canAfford = coins >= item.price;

                        return `
                          <div class="rounded-xl p-3 border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isPreviewing
                              ? 'bg-[#13203b] border-sky-400'
                              : 'bg-[#0d1629] border-[#22355c]'
                          }">
                            <div class="flex items-start gap-3 min-w-0">
                              <img src="${renderShopItemIconDataUrl(item)}" alt="${item.name}" class="w-11 h-11 rounded-lg bg-[#060b16] border border-[#2c4470] p-1 object-contain shrink-0" style="image-rendering: pixelated;" />
                              <div class="min-w-0">
                                <div class="flex items-center gap-2">
                                  <span class="font-display font-bold text-sm text-white truncate">${item.name}</span>
                                  ${owned ? '<span class="text-[10px] font-semibold text-emerald-300">[Owned]</span>' : `<span class="font-mono-tabular text-xs font-bold text-amber-300">${item.price}c</span>`}
                                </div>
                                <p class="text-xs text-slate-300 mt-0.5">${item.description}</p>
                              </div>
                            </div>

                            <div class="flex items-center gap-2 shrink-0 justify-end">
                              <button type="button" data-prev-id="${item.id}" class="cc-cl-prev cc-btn-secondary px-2.5 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] cursor-pointer">
                                Preview
                              </button>
                              ${
                                owned
                                  ? `<button type="button" data-eq-id="${item.id}" class="cc-cl-eq px-3 py-1.5 rounded-lg text-xs font-bold min-h-[36px] cursor-pointer ${
                                      equipped
                                        ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-200'
                                        : 'cc-btn-primary'
                                    }">${equipped ? 'Equipped (Remove)' : 'Equip'}</button>`
                                  : `<button type="button" data-buy-id="${item.id}" class="cc-cl-buy px-3 py-1.5 rounded-lg text-xs font-bold min-h-[36px] cursor-pointer ${
                                      canAfford
                                        ? 'cc-btn-primary'
                                        : 'bg-[#1a243d] border border-slate-600/50 text-slate-400 hover:border-rose-400/60'
                                    }">Buy · ${item.price}c</button>`
                              }
                            </div>
                          </div>
                        `;
                      })
                      .join('')
              }
            </div>
          </div>
        </div>
      `;

      this.backdrop.querySelector('#cc-cloth-close')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cl-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          audioSystem.playButtonClick();
          activeCat = (btn.dataset.clCat as ClothingCategory | 'wardrobe') ?? activeCat;
          const firstMatch =
            activeCat === 'wardrobe'
              ? allClothing.find((i) => economySystem.ownsItem(i.id))
              : allClothing.find((i) => i.clothing?.category === activeCat);
          previewItemId = firstMatch?.id ?? null;
          feedback = null;
          render();
        });
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cl-dir').forEach((btn) => {
        btn.addEventListener('click', () => {
          audioSystem.playButtonClick();
          previewDir = (btn.dataset.clDir as Direction) ?? 'down';
          render();
        });
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cl-prev').forEach((btn) => {
        btn.addEventListener('click', () => {
          audioSystem.playButtonClick();
          previewItemId = btn.dataset.prevId ?? null;
          render();
        });
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cl-buy').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.buyId;
          if (!id) return;
          previewItemId = id;
          const res = economySystem.purchaseItem(id);
          if (res.ok) {
            audioSystem.playCoin();
            economySystem.equipClothing(id);
            this.callbacks.onAppearanceChanged();
            this.callbacks.onItemPurchased?.(id);
            const bought = getShopItemById(id);
            feedback = {
              text: `Bought & equipped ${bought?.name ?? 'item'}! Balance: ${res.balance} Coins.`,
              error: false,
            };
          } else {
            audioSystem.playError();
            feedback = {text: res.reason ?? 'Cannot purchase item.', error: true};
          }
          render();
        });
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cl-eq').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.eqId;
          if (!id) return;
          const item = getShopItemById(id);
          if (!item?.clothing) return;
          audioSystem.playInteract();
          if (economySystem.isItemEquipped(id)) {
            economySystem.unequipSlot(item.clothing.slot);
            feedback = {text: `Unequipped ${item.name}.`, error: false};
          } else {
            economySystem.equipClothing(id);
            previewItemId = id;
            feedback = {text: `Equipped ${item.name} on your character!`, error: false};
          }
          this.callbacks.onAppearanceChanged();
          render();
        });
      });
    };

    render();
    this.backdrop.style.display = 'flex';
  }

  public openSalon(title: string, subtitle: string): void {
    this.openState = true;
    const save = saveSystem.getState();
    const preset =
      CHARACTER_PRESETS.find((p) => p.id === save.appearanceId) ?? CHARACTER_PRESETS[0];
    let draftStyle: HairStyleId = save.hairOverride.hairStyle ?? preset.hairStyle;
    let draftColor: string = save.hairOverride.hairColor ?? preset.hairColor;
    let feedback: {text: string; error: boolean} | null = null;

    const render = () => {
      const curSave = saveSystem.getState();
      const styleObj =
        SALON_HAIRSTYLES.find((h) => h.id === draftStyle) ?? SALON_HAIRSTYLES[0];
      const colorObj =
        SALON_HAIR_COLORS.find((c) => c.hex === draftColor) ?? SALON_HAIR_COLORS[0];
      const changedStyle = draftStyle !== (curSave.hairOverride.hairStyle ?? preset.hairStyle);
      const changedColor = draftColor !== (curSave.hairOverride.hairColor ?? preset.hairColor);
      const totalCost =
        (changedStyle ? styleObj.price : 0) + (changedColor ? colorObj.price : 0);

      const previewUrl = renderCharacterPortraitDataUrl(
        preset,
        curSave.equippedClothing,
        {hairStyle: draftStyle, hairColor: draftColor},
        {...curSave.appearanceConfig, hairStyle: draftStyle, hairColor: draftColor},
      );

      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
          <div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#22355c]">
            <div>
              <div class="text-xs font-semibold text-pink-300">${esc(subtitle)}</div>
              <h2 class="font-display text-xl font-bold text-white">${esc(title)}</h2>
            </div>
            <div class="flex items-center gap-3">
              <div class="px-3 py-1.5 rounded-lg bg-[#060b16] border border-amber-400/50 text-amber-300 font-mono-tabular text-sm font-bold">
                ${economySystem.getCoins()} Coins
              </div>
              <button id="cc-sal-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
                Close
              </button>
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

          <div class="p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-[190px_1fr] gap-4">
            <div class="rounded-xl bg-[#091020] border border-[#22355c] p-4 flex flex-col items-center text-center">
              <div class="w-28 h-32 rounded-xl bg-[#060b16] border border-pink-400/40 flex items-center justify-center overflow-hidden mb-3">
                <img src="${previewUrl}" alt="Hairstyle preview" class="w-24 h-28 object-contain" style="image-rendering: pixelated;" />
              </div>
              <div class="text-xs font-bold text-white">${styleObj.name}</div>
              <div class="text-[11px] text-slate-400 mt-0.5">${colorObj.name}</div>
            </div>

            <div class="space-y-4">
              <div>
                <div class="text-xs font-semibold text-slate-300 mb-2">Select Hairstyle</div>
                <div class="grid grid-cols-2 gap-2">
                  ${SALON_HAIRSTYLES.map(
                    (h) => `
                      <button type="button" data-hair-style="${h.id}" class="cc-sal-style p-2.5 rounded-lg border text-left text-xs cursor-pointer ${
                        draftStyle === h.id
                          ? 'bg-pink-500/20 border-pink-400 text-white'
                          : 'bg-[#0d1629] border-[#22355c] text-slate-300 hover:border-pink-400/50'
                      }">
                        <div class="font-semibold">${h.name}</div>
                        <div class="font-mono-tabular text-[11px] text-amber-300">${h.price === 0 ? 'Included' : `${h.price} Coins`}</div>
                      </button>
                    `,
                  ).join('')}
                </div>
              </div>

              <div>
                <div class="text-xs font-semibold text-slate-300 mb-2">Select Hair Color</div>
                <div class="flex flex-wrap gap-2">
                  ${SALON_HAIR_COLORS.map(
                    (c) => `
                      <button type="button" data-hair-color="${c.hex}" class="cc-sal-color flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer ${
                        draftColor === c.hex
                          ? 'bg-pink-500/20 border-pink-400 text-white'
                          : 'bg-[#0d1629] border-[#22355c] text-slate-300'
                      }">
                        <span class="w-3.5 h-3.5 rounded-sm border border-white/30" style="background:${c.hex};"></span>
                        <span>${c.name}</span>
                        <span class="font-mono-tabular text-[10px] text-amber-300">${c.price === 0 ? 'Free' : `${c.price}c`}</span>
                      </button>
                    `,
                  ).join('')}
                </div>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#22355c]">
                <button id="cc-sal-reset" type="button" class="cc-btn-secondary px-3 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
                  Reset to Default Hair
                </button>
                <button id="cc-sal-apply" type="button" class="cc-btn-primary px-4 py-2 rounded-lg text-xs font-bold min-h-[40px] cursor-pointer">
                  ${totalCost === 0 ? 'Apply Free Styling' : `Apply Styling · ${totalCost} Coins`}
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      this.backdrop.querySelector('#cc-sal-close')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-sal-style').forEach((btn) => {
        btn.addEventListener('click', () => {
          audioSystem.playButtonClick();
          draftStyle = (btn.dataset.hairStyle as HairStyleId) ?? draftStyle;
          feedback = null;
          render();
        });
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-sal-color').forEach((btn) => {
        btn.addEventListener('click', () => {
          audioSystem.playButtonClick();
          draftColor = btn.dataset.hairColor ?? draftColor;
          feedback = null;
          render();
        });
      });

      this.backdrop.querySelector('#cc-sal-reset')?.addEventListener('click', () => {
        audioSystem.playInteract();
        draftStyle = preset.hairStyle;
        draftColor = preset.hairColor;
        economySystem.applyHairStyle(null, null, 0);
        this.callbacks.onAppearanceChanged();
        feedback = {text: 'Restored original preset hairstyle.', error: false};
        render();
      });

      this.backdrop.querySelector('#cc-sal-apply')?.addEventListener('click', () => {
        const res = economySystem.applyHairStyle(draftStyle, draftColor, totalCost);
        if (res.ok) {
          audioSystem.playCoin();
          this.callbacks.onAppearanceChanged();
          feedback = {text: 'Fresh hairstyle applied and saved!', error: false};
        } else {
          audioSystem.playError();
          feedback = {text: res.reason ?? 'Insufficient coins.', error: true};
        }
        render();
      });
    };

    render();
    this.backdrop.style.display = 'flex';
  }

  public openBank(title: string, subtitle: string): void {
    this.openState = true;
    let feedback: string | null = null;

    const render = () => {
      const coins = economySystem.getCoins();
      const energy = economySystem.getEnergy();
      const stipendClaimed = economySystem.hasClaimedReward('bank_citizen_stipend');
      const txs = economySystem.getTransactions();

      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
          <div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#22355c]">
            <div>
              <div class="text-xs font-semibold text-sky-300">${esc(subtitle)}</div>
              <h2 class="font-display text-xl font-bold text-white">${esc(title)}</h2>
            </div>
            <button id="cc-bank-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
              Close
            </button>
          </div>

          <div class="p-5 overflow-y-auto space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-xl bg-[#091020] border border-amber-400/40 p-3.5">
                <div class="text-[11px] text-slate-400 uppercase tracking-wider">Coin Balance</div>
                <div class="font-mono-tabular text-2xl font-bold text-amber-300 mt-1">${coins} Coins</div>
              </div>
              <div class="rounded-xl bg-[#091020] border border-emerald-400/40 p-3.5">
                <div class="text-[11px] text-slate-400 uppercase tracking-wider">Citizen Energy</div>
                <div class="font-mono-tabular text-2xl font-bold text-emerald-300 mt-1">${energy} / 100</div>
              </div>
            </div>

            <div class="rounded-xl bg-[#0d1629] border border-[#22355c] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div class="font-display font-bold text-sm text-white">Welcome Citizen Stipend</div>
                <div class="text-xs text-slate-300 mt-0.5">One-time Central Bank bonus of +75 Coins for exploring CHAOS CITY.</div>
              </div>
              <button id="cc-bank-stipend" type="button" class="px-4 py-2 rounded-lg text-xs font-bold min-h-[40px] shrink-0 cursor-pointer ${
                stipendClaimed
                  ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-300'
                  : 'cc-btn-primary'
              }" ${stipendClaimed ? 'disabled' : ''}>
                ${stipendClaimed ? 'Claimed' : 'Claim +75 Coins'}
              </button>
            </div>

            ${
              feedback
                ? `<div class="px-3.5 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/50 text-xs text-emerald-200">${feedback}</div>`
                : ''
            }

            <div>
              <div class="text-xs font-semibold text-slate-300 mb-2">Recent Transactions</div>
              ${
                txs.length === 0
                  ? '<div class="text-xs text-slate-400 bg-[#091020] border border-[#22355c] rounded-xl p-4">No transactions recorded yet. Visit shops or play arcade games!</div>'
                  : `<div class="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      ${txs
                        .map(
                          (tx) => `
                            <div class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#091020] border border-[#1d2e50] text-xs">
                              <span class="text-slate-200 truncate">${tx.label}</span>
                              <span class="font-mono-tabular font-bold shrink-0 ${
                                tx.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'
                              }">${tx.amount >= 0 ? `+${tx.amount}` : tx.amount}c</span>
                            </div>
                          `,
                        )
                        .join('')}
                    </div>`
              }
            </div>
          </div>
        </div>
      `;

      this.backdrop.querySelector('#cc-bank-close')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });

      this.backdrop.querySelector('#cc-bank-stipend')?.addEventListener('click', () => {
        if (economySystem.hasClaimedReward('bank_citizen_stipend')) return;
        const nextBal = economySystem.awardCoins(
          75,
          'Central Bank Citizen Stipend',
          'bank_citizen_stipend',
        );
        audioSystem.playCoin();
        feedback = `Claimed +75 Coins! New balance: ${nextBal} Coins.`;
        render();
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
