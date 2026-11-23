import {
  CHARACTER_PRESETS,
  CLOTHING_CATEGORIES,
  EYE_COLORS,
  SKIN_TONES,
} from '@/src/config/constants';
import {
  getShopItemById,
  SALON_HAIR_COLORS,
  SALON_HAIRSTYLES,
  SHOP_ITEMS,
} from '@/src/game/data/catalog';
import {renderCharacterPreviewDataUrl} from '@/src/game/graphics/PixelArtGenerator';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {economySystem} from '@/src/game/systems/EconomySystem';
import {
  appearanceFromPreset,
  createEmptyEquipped,
  saveSystem,
} from '@/src/game/systems/SaveSystem';
import {
  AnimationState,
  BrowStyleId,
  CharacterAppearanceConfig,
  ClothingSlot,
  Direction,
  EquippedClothing,
  EyeStyleId,
  FacialDetailId,
  FacialHairId,
  GenderType,
  HairStyleId,
  OutfitPreset,
} from '@/src/game/types/gameTypes';
import {sanitizeDisplayName} from '@/src/game/utils/helpers';

export interface CharacterCreatorCallbacks {
  onSaved: () => void;
  onEnterCity?: () => void;
  onClose?: () => void;
}

const esc = (str: string): string =>
  String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

type CreatorTab = 'face' | 'hair' | 'wardrobe' | 'outfits';

const EYE_STYLES: {id: EyeStyleId; label: string}[] = [
  {id: 'classic', label: 'Classic'},
  {id: 'wide', label: 'Bright Wide'},
  {id: 'sharp', label: 'Sharp Focus'},
  {id: 'lashes', label: 'Lashes'},
];

const BROW_STYLES: {id: BrowStyleId; label: string}[] = [
  {id: 'natural', label: 'Natural'},
  {id: 'thick', label: 'Bold Thick'},
  {id: 'arched', label: 'Arched'},
  {id: 'soft', label: 'Soft Thin'},
];

const FACIAL_DETAILS: {id: FacialDetailId; label: string}[] = [
  {id: 'none', label: 'None'},
  {id: 'freckles', label: 'Freckles'},
  {id: 'blush', label: 'Rosy Blush'},
  {id: 'beauty_mark', label: 'Beauty Mark'},
];

const FACIAL_HAIR_STYLES: {id: FacialHairId; label: string}[] = [
  {id: 'none', label: 'Clean Shaven'},
  {id: 'stubble', label: 'Light Stubble'},
  {id: 'goatee', label: 'Goatee'},
  {id: 'beard', label: 'Full Beard'},
];

const DIRECTION_ORDER: {dir: Direction; label: string}[] = [
  {dir: 'down', label: 'Front'},
  {dir: 'left', label: 'Left'},
  {dir: 'up', label: 'Back'},
  {dir: 'right', label: 'Right'},
];

const ANIM_OPTIONS: {id: AnimationState; label: string}[] = [
  {id: 'idle', label: 'Idle'},
  {id: 'walk', label: 'Walk'},
  {id: 'run', label: 'Run'},
  {id: 'sit', label: 'Sit'},
  {id: 'interact', label: 'Interact'},
  {id: 'shop', label: 'Shop'},
  {id: 'celebrate', label: 'Celebrate'},
];

const PRESET_SUGGESTIONS = ['Casual', 'Sporty', 'Formal', 'Adventure', 'Winter'];

export class CharacterCreatorModal {
  private readonly backdrop: HTMLDivElement;
  private openState = false;
  private animTimer: number | null = null;
  private animStep = 0;

  constructor(
    parent: HTMLElement,
    private readonly callbacks: CharacterCreatorCallbacks,
  ) {
    this.backdrop = document.createElement('div');
    this.backdrop.className =
      'ui-interactive fixed inset-0 z-40 hidden items-center justify-center bg-[#040812]/88 p-2 sm:p-4';
    parent.appendChild(this.backdrop);
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public close(): void {
    if (!this.openState) return;
    this.stopAnimLoop();
    this.openState = false;
    this.backdrop.style.display = 'none';
    this.backdrop.innerHTML = '';
    this.callbacks.onClose?.();
  }

  private stopAnimLoop(): void {
    if (this.animTimer !== null) {
      window.clearInterval(this.animTimer);
      this.animTimer = null;
    }
  }

  public open(): void {
    this.openState = true;
    const initialSave = saveSystem.getState();

    let draftPresetId = initialSave.appearanceId;
    let draftName = initialSave.playerName;
    let draftAppearance: CharacterAppearanceConfig = {...initialSave.appearanceConfig};
    let draftEquipped: EquippedClothing = {...initialSave.equippedClothing};
    let draftSelectedPresetId: string | null = initialSave.selectedOutfitPresetId;
    let previewPresetOverride: EquippedClothing | null = null;

    let activeTab: CreatorTab = 'face';
    let wardrobeGroup = 'All';
    let previewDir: Direction = 'down';
    let previewAnim: AnimationState = 'idle';
    let newPresetName = '';
    let renamingPresetId: string | null = null;
    let renameDraft = '';
    let feedback: {text: string; error: boolean} | null = null;

    const getPresetObj = () =>
      CHARACTER_PRESETS.find((p) => p.id === draftPresetId) ?? CHARACTER_PRESETS[0];

    const refreshPreviewImgOnly = () => {
      const img = this.backdrop.querySelector<HTMLImageElement>('#cc-creator-preview-img');
      if (!img) return;
      const activeEq = previewPresetOverride ?? draftEquipped;
      img.src = renderCharacterPreviewDataUrl(
        getPresetObj(),
        draftAppearance,
        activeEq,
        previewDir,
        previewAnim,
        this.animStep,
        128,
        160,
      );
    };

    this.stopAnimLoop();
    this.animStep = 0;
    this.animTimer = window.setInterval(() => {
      if (!this.openState) return;
      if (previewAnim === 'idle' || previewAnim === 'sit') return;
      this.animStep = (this.animStep + 1) % 4;
      refreshPreviewImgOnly();
    }, 200);

    const render = () => {
      const presetObj = getPresetObj();
      const activeEq = previewPresetOverride ?? draftEquipped;
      const previewUrl = renderCharacterPreviewDataUrl(
        presetObj,
        draftAppearance,
        activeEq,
        previewDir,
        previewAnim,
        this.animStep,
        128,
        160,
      );

      const allWearable = SHOP_ITEMS.filter((i) => Boolean(i.clothing));
      const ownedWearable = allWearable.filter((i) => economySystem.ownsItem(i.id));
      const outfitPresets: OutfitPreset[] = economySystem.getOutfitPresets();

      const switchGender = (gender: GenderType) => {
        if (draftAppearance.gender === gender) return;
        const matchingPreset =
          CHARACTER_PRESETS.find((p) => p.gender === gender) ?? CHARACTER_PRESETS[0];
        draftPresetId = matchingPreset.id;
        draftAppearance = {
          ...draftAppearance,
          gender,
          hairStyle: matchingPreset.hairStyle,
          eyeStyle: matchingPreset.eyeStyle,
          browStyle: matchingPreset.browStyle,
          facialHair: gender === 'male' ? draftAppearance.facialHair : 'none',
        };
        feedback = {
          text: `Switched to ${gender === 'male' ? 'Male' : 'Female'} character design.`,
          error: false,
        };
        render();
      };

      const renderFaceTab = () => `
        <div class="space-y-4">
          <div>
            <div class="text-xs font-semibold text-slate-300 mb-2">Skin Tone</div>
            <div class="flex flex-wrap gap-2">
              ${SKIN_TONES.map(
                (t) => `
                  <button type="button" data-skin="${t.hex}" title="${t.name}" class="cc-cr-skin flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer ${
                    draftAppearance.skinTone === t.hex
                      ? 'border-sky-400 bg-sky-500/20 text-white'
                      : 'border-[#22355c] bg-[#0d1629] text-slate-300 hover:border-sky-400/50'
                  }">
                    <span class="w-4 h-4 rounded-sm border border-white/30" style="background:${t.hex};"></span>
                    <span>${t.name}</span>
                  </button>
                `,
              ).join('')}
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div class="text-xs font-semibold text-slate-300 mb-2">Eye Style</div>
              <div class="grid grid-cols-2 gap-1.5">
                ${EYE_STYLES.map(
                  (es) => `
                    <button type="button" data-eye-style="${es.id}" class="cc-cr-eyestyle px-2.5 py-2 rounded-lg border text-xs font-medium cursor-pointer ${
                      draftAppearance.eyeStyle === es.id
                        ? 'border-sky-400 bg-sky-500/20 text-white'
                        : 'border-[#22355c] bg-[#0d1629] text-slate-300'
                    }">${es.label}</button>
                  `,
                ).join('')}
              </div>
            </div>

            <div>
              <div class="text-xs font-semibold text-slate-300 mb-2">Eyebrow Style</div>
              <div class="grid grid-cols-2 gap-1.5">
                ${BROW_STYLES.map(
                  (bs) => `
                    <button type="button" data-brow-style="${bs.id}" class="cc-cr-brow px-2.5 py-2 rounded-lg border text-xs font-medium cursor-pointer ${
                      draftAppearance.browStyle === bs.id
                        ? 'border-sky-400 bg-sky-500/20 text-white'
                        : 'border-[#22355c] bg-[#0d1629] text-slate-300'
                    }">${bs.label}</button>
                  `,
                ).join('')}
              </div>
            </div>
          </div>

          <div>
            <div class="text-xs font-semibold text-slate-300 mb-2">Eye Color</div>
            <div class="flex flex-wrap gap-2">
              ${EYE_COLORS.map(
                (ec) => `
                  <button type="button" data-eye-color="${ec.hex}" class="cc-cr-eyecolor flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer ${
                    draftAppearance.eyeColor === ec.hex
                      ? 'border-sky-400 bg-sky-500/20 text-white'
                      : 'border-[#22355c] bg-[#0d1629] text-slate-300'
                  }">
                    <span class="w-3.5 h-3.5 rounded-sm border border-white/30" style="background:${ec.hex};"></span>
                    <span>${ec.name}</span>
                  </button>
                `,
              ).join('')}
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div class="text-xs font-semibold text-slate-300 mb-2">Facial Details</div>
              <div class="grid grid-cols-2 gap-1.5">
                ${FACIAL_DETAILS.map(
                  (fd) => `
                    <button type="button" data-detail="${fd.id}" class="cc-cr-detail px-2.5 py-2 rounded-lg border text-xs font-medium cursor-pointer ${
                      draftAppearance.facialDetail === fd.id
                        ? 'border-sky-400 bg-sky-500/20 text-white'
                        : 'border-[#22355c] bg-[#0d1629] text-slate-300'
                    }">${fd.label}</button>
                  `,
                ).join('')}
              </div>
            </div>

            <div>
              <div class="text-xs font-semibold text-slate-300 mb-2">Facial Hair</div>
              ${
                draftAppearance.gender === 'male'
                  ? `<div class="grid grid-cols-2 gap-1.5">
                      ${FACIAL_HAIR_STYLES.map(
                        (fh) => `
                          <button type="button" data-facial-hair="${fh.id}" class="cc-cr-fh px-2.5 py-2 rounded-lg border text-xs font-medium cursor-pointer ${
                            draftAppearance.facialHair === fh.id
                              ? 'border-sky-400 bg-sky-500/20 text-white'
                              : 'border-[#22355c] bg-[#0d1629] text-slate-300'
                          }">${fh.label}</button>
                        `,
                      ).join('')}
                    </div>`
                  : `<div class="rounded-lg bg-[#0d1629] border border-[#22355c] p-3 text-xs text-slate-400">
                      Facial hair styles are shown when Male design is active. Switch gender on the left stage to preview.
                    </div>`
              }
            </div>
          </div>
        </div>
      `;

      const renderHairTab = () => `
        <div class="space-y-4">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-semibold text-slate-300">Hairstyles (${SALON_HAIRSTYLES.length} styles)</span>
              <span class="text-[11px] text-sky-300">Tailored & universal styles</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              ${SALON_HAIRSTYLES.map((h) => {
                const isSelected = draftAppearance.hairStyle === h.id;
                const tag =
                  h.recommendedGender === 'all'
                    ? 'Unisex'
                    : h.recommendedGender === 'male'
                      ? 'Male'
                      : 'Female';
                return `
                  <button type="button" data-hair-id="${h.id}" class="cc-cr-hair p-2.5 rounded-lg border text-left cursor-pointer ${
                    isSelected
                      ? 'border-sky-400 bg-sky-500/20 text-white'
                      : 'border-[#22355c] bg-[#0d1629] text-slate-300 hover:border-sky-400/50'
                  }">
                    <div class="text-xs font-semibold truncate">${h.name}</div>
                    <div class="text-[10px] ${
                      h.recommendedGender === draftAppearance.gender
                        ? 'text-sky-300'
                        : 'text-slate-400'
                    }">${tag}</div>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <div>
            <div class="text-xs font-semibold text-slate-300 mb-2">Hair Color</div>
            <div class="flex flex-wrap gap-2">
              ${SALON_HAIR_COLORS.map(
                (c) => `
                  <button type="button" data-hcolor="${c.hex}" class="cc-cr-hcolor flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer ${
                    draftAppearance.hairColor === c.hex
                      ? 'border-sky-400 bg-sky-500/20 text-white'
                      : 'border-[#22355c] bg-[#0d1629] text-slate-300 hover:border-sky-400/50'
                  }">
                    <span class="w-3.5 h-3.5 rounded-sm border border-white/30" style="background:${c.hex};"></span>
                    <span>${c.name}</span>
                  </button>
                `,
              ).join('')}
            </div>
          </div>
        </div>
      `;

      const renderWardrobeTab = () => {
        const groups = ['All', 'Upper Body', 'Lower Body', 'Footwear', 'Accessories'];
        const allowedCats = new Set(
          wardrobeGroup === 'All'
            ? CLOTHING_CATEGORIES.map((c) => c.id)
            : CLOTHING_CATEGORIES.filter((c) => c.group === wardrobeGroup).map((c) => c.id),
        );
        const filteredOwned = ownedWearable.filter(
          (item) => item.clothing && allowedCats.has(item.clothing.category),
        );
        const activeSlots: {slot: ClothingSlot; label: string}[] = [
          {slot: 'shirt', label: 'Upper'},
          {slot: 'jacket', label: 'Outer'},
          {slot: 'trousers', label: 'Lower'},
          {slot: 'shoes', label: 'Shoes'},
          {slot: 'hat', label: 'Hat'},
          {slot: 'glasses', label: 'Eyewear'},
          {slot: 'accessory', label: 'Accessory'},
        ];

        return `
          <div class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 bg-[#091020] border border-[#22355c] rounded-xl p-3">
              <div>
                <div class="text-xs font-bold text-white">Owned Wardrobe (${ownedWearable.length} / ${allWearable.length} unlocked)</div>
                <div class="text-[11px] text-slate-400">Buy more outfits, hoodies, skirts, watches &amp; gear at Threadz Boutique or Apex Tech!</div>
              </div>
              <button id="cc-cr-clear-outfit" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">
                Wear Base Outfit
              </button>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              ${activeSlots
                .map((s) => {
                  const id = draftEquipped[s.slot];
                  const item = id ? getShopItemById(id) : undefined;
                  return `
                    <div class="rounded-lg bg-[#0d1629] border border-[#22355c] px-2.5 py-2 flex items-center justify-between gap-1 text-[11px]">
                      <div class="min-w-0">
                        <div class="text-slate-400 text-[10px]">${s.label}</div>
                        <div class="text-white font-semibold truncate">${item ? item.name : 'Default'}</div>
                      </div>
                      ${item ? `<button type="button" data-unequip="${s.slot}" class="cc-cr-unequip text-rose-300 hover:text-rose-200 font-bold px-1 cursor-pointer" title="Remove">×</button>` : ''}
                    </div>
                  `;
                })
                .join('')}
            </div>

            <div class="flex flex-wrap gap-1.5">
              ${groups
                .map(
                  (g) => `
                    <button type="button" data-wgroup="${g}" class="cc-cr-wgroup px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      wardrobeGroup === g
                        ? 'bg-sky-500 text-[#06101f]'
                        : 'bg-[#131f38] text-slate-300 border border-[#22355c]'
                    }">${g}</button>
                  `,
                )
                .join('')}
            </div>

            ${
              filteredOwned.length === 0
                ? `<div class="rounded-xl bg-[#0d1629] border border-[#22355c] p-5 text-center text-xs text-slate-400">
                    No owned items in this category yet. Unowned items stay locked until purchased in Threadz Boutique or Apex Tech Center!
                  </div>`
                : `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    ${filteredOwned
                      .map((item) => {
                        const slot = item.clothing?.slot;
                        const isEquipped = slot ? draftEquipped[slot] === item.id : false;
                        return `
                          <div class="rounded-xl bg-[#0d1629] border p-3 flex items-center justify-between gap-2.5 ${
                            isEquipped ? 'border-emerald-400 bg-emerald-500/10' : 'border-[#22355c]'
                          }">
                            <div class="flex items-center gap-2.5 min-w-0">
                              <div class="w-9 h-9 rounded-lg border shrink-0 flex items-center justify-center font-mono-tabular text-xs font-bold text-white" style="background:${item.clothing?.primaryColor ?? item.iconColor}; border-color:${item.clothing?.accentColor ?? '#fff'}88;">
                                ${item.iconGlyph}
                              </div>
                              <div class="min-w-0">
                                <div class="text-xs font-bold text-white truncate">${item.name}</div>
                                <div class="text-[10px] text-slate-400 uppercase">${item.clothing?.category ?? item.subCategory}</div>
                              </div>
                            </div>
                            <button type="button" data-wear="${item.id}" class="cc-cr-wear px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 cursor-pointer ${
                              isEquipped
                                ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-200'
                                : 'cc-btn-primary'
                            }">${isEquipped ? 'Unequip' : 'Equip'}</button>
                          </div>
                        `;
                      })
                      .join('')}
                  </div>`
            }
          </div>
        `;
      };

      const renderOutfitsTab = () => `
        <div class="space-y-4">
          <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3.5 space-y-2.5">
            <div class="text-xs font-bold text-white">Create New Outfit Preset</div>
            <div class="flex flex-wrap gap-1.5">
              ${PRESET_SUGGESTIONS.map(
                (tag) => `
                  <button type="button" data-ptag="${tag}" class="cc-cr-ptag px-2.5 py-1 rounded bg-[#131f38] hover:border-sky-400 border border-[#22355c] text-[11px] text-sky-200 cursor-pointer">${tag}</button>
                `,
              ).join('')}
            </div>
            <div class="flex gap-2">
              <input id="cc-cr-newpreset" type="text" maxlength="24" value="${esc(newPresetName)}" placeholder="Preset name (e.g. Sporty)" class="flex-1 px-3 py-2 rounded-lg bg-[#060b16] border border-[#2c4474] text-xs text-white focus:outline-none focus:border-sky-400" />
              <button id="cc-cr-createpreset" type="button" class="cc-btn-primary px-4 py-2 rounded-lg text-xs font-bold shrink-0 cursor-pointer">
                Save Current
              </button>
            </div>
          </div>

          <div class="space-y-2">
            ${outfitPresets
              .map((preset) => {
                const isSelected = draftSelectedPresetId === preset.id;
                const equippedCount = Object.values(preset.equipped).filter(Boolean).length;
                const isRenaming = renamingPresetId === preset.id;
                return `
                  <div class="rounded-xl bg-[#0d1629] border p-3 flex flex-col gap-2 ${
                    isSelected ? 'border-sky-400 bg-sky-500/10' : 'border-[#22355c]'
                  }">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="font-display font-bold text-sm text-white truncate">${esc(preset.name)}</span>
                          ${isSelected ? '<span class="text-[10px] font-semibold text-sky-300">[Active]</span>' : ''}
                        </div>
                        <div class="text-[11px] text-slate-400">${equippedCount === 0 ? 'Base Archetype Outfit' : `${equippedCount} equipped item(s)`}</div>
                      </div>
                      <div class="flex flex-wrap items-center gap-1.5">
                        <button type="button" data-pprev="${preset.id}" class="cc-cr-pprev cc-btn-secondary px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer">Preview</button>
                        <button type="button" data-papply="${preset.id}" class="cc-cr-papply cc-btn-primary px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer">Apply</button>
                        <button type="button" data-pupdate="${preset.id}" class="cc-cr-pupdate cc-btn-secondary px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer" title="Overwrite with current look">Update</button>
                        <button type="button" data-prename="${preset.id}" class="cc-cr-prename cc-btn-secondary px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer">Rename</button>
                        ${
                          outfitPresets.length > 1
                            ? `<button type="button" data-pdel="${preset.id}" class="cc-cr-pdel px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-500/15 border border-rose-400/40 text-rose-200 hover:bg-rose-500/25 cursor-pointer">Delete</button>`
                            : ''
                        }
                      </div>
                    </div>

                    ${
                      isRenaming
                        ? `<div class="flex gap-2 pt-2 border-t border-[#1e2f52]">
                            <input id="cc-cr-rename-input" type="text" maxlength="24" value="${esc(renameDraft)}" class="flex-1 px-2.5 py-1.5 rounded bg-[#060b16] border border-sky-400 text-xs text-white focus:outline-none" />
                            <button type="button" data-prename-save="${preset.id}" class="cc-cr-prename-save cc-btn-primary px-3 py-1.5 rounded text-xs font-bold cursor-pointer">Save Name</button>
                            <button type="button" id="cc-cr-prename-cancel" class="cc-btn-secondary px-3 py-1.5 rounded text-xs font-semibold cursor-pointer">Cancel</button>
                          </div>`
                        : ''
                    }
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      `;

      const tabBody =
        activeTab === 'face'
          ? renderFaceTab()
          : activeTab === 'hair'
            ? renderHairTab()
            : activeTab === 'wardrobe'
              ? renderWardrobeTab()
              : renderOutfitsTab();

      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-5xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
          <!-- Top Header -->
          <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-[#22355c]">
            <div>
              <h2 class="font-display text-lg sm:text-xl font-bold text-white">Character Creator Studio</h2>
              <p class="text-[11px] text-slate-400">Customize your resident identity, animations, owned wardrobe &amp; outfit presets</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-mono-tabular text-xs font-bold text-amber-300 px-2.5 py-1 rounded-lg bg-[#060b16] border border-amber-400/40">
                ${economySystem.getCoins()} Coins
              </span>
              <button id="cc-cr-cancel-top" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] cursor-pointer">
                Cancel
              </button>
            </div>
          </div>

          <!-- Two-Column Workspace -->
          <div class="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[290px_1fr] min-h-0">
            <!-- Left Real-Time Preview Stage -->
            <div class="p-4 bg-[#091020] border-b lg:border-b-0 lg:border-r border-[#22355c] flex flex-col gap-3">
              <!-- Gender Design Selector -->
              <div class="grid grid-cols-2 gap-1.5">
                <button type="button" id="cc-cr-gender-m" class="px-3 py-2 rounded-lg border text-xs font-bold cursor-pointer ${
                  draftAppearance.gender === 'male'
                    ? 'bg-sky-500 text-[#06101f] border-sky-400'
                    : 'bg-[#0d1629] text-slate-300 border-[#22355c]'
                }">Male Design</button>
                <button type="button" id="cc-cr-gender-f" class="px-3 py-2 rounded-lg border text-xs font-bold cursor-pointer ${
                  draftAppearance.gender === 'female'
                    ? 'bg-pink-400 text-[#06101f] border-pink-300'
                    : 'bg-[#0d1629] text-slate-300 border-[#22355c]'
                }">Female Design</button>
              </div>

              <!-- Live Pixel Character Stage -->
              <div class="rounded-xl bg-[#060b16] border border-sky-400/40 p-3 flex flex-col items-center">
                <div class="text-[10px] font-semibold uppercase tracking-wider text-sky-300 mb-1">
                  ${previewPresetOverride ? 'Previewing Preset' : `${presetObj.name} Base · ${previewDir.toUpperCase()}`}
                </div>
                <img id="cc-creator-preview-img" src="${previewUrl}" alt="Live Character Preview" class="w-32 h-40 object-contain" style="image-rendering: pixelated;" />

                <!-- Direction Rotator -->
                <div class="flex items-center gap-1 mt-2 w-full justify-center">
                  <button type="button" id="cc-cr-rot-l" class="cc-btn-secondary px-2 py-1 rounded text-xs cursor-pointer" title="Rotate Left">◀</button>
                  ${DIRECTION_ORDER.map(
                    (d) => `
                      <button type="button" data-dir="${d.dir}" class="cc-cr-dir px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                        previewDir === d.dir
                          ? 'bg-sky-500 text-[#06101f]'
                          : 'bg-[#0d1629] text-slate-300 border border-[#22355c]'
                      }">${d.label}</button>
                    `,
                  ).join('')}
                  <button type="button" id="cc-cr-rot-r" class="cc-btn-secondary px-2 py-1 rounded text-xs cursor-pointer" title="Rotate Right">▶</button>
                </div>

                <!-- Animation Previewer -->
                <div class="flex flex-wrap justify-center gap-1 mt-2">
                  ${ANIM_OPTIONS.map(
                    (a) => `
                      <button type="button" data-anim="${a.id}" class="cc-cr-anim px-2 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                        previewAnim === a.id
                          ? 'bg-emerald-400 text-[#06101f]'
                          : 'bg-[#0d1629] text-slate-400 border border-[#22355c] hover:text-white'
                      }">${a.label}</button>
                    `,
                  ).join('')}
                </div>
              </div>

              <!-- Name & Archetype -->
              <div class="space-y-2.5">
                <div>
                  <label for="cc-cr-name" class="block text-[11px] font-semibold text-slate-300 mb-1">Display Name</label>
                  <input id="cc-cr-name" type="text" maxlength="16" value="${esc(draftName)}" class="w-full px-3 py-2 rounded-lg bg-[#060b16] border border-[#2c4474] text-xs font-semibold text-white focus:outline-none focus:border-sky-400" />
                </div>
                <div>
                  <div class="text-[11px] font-semibold text-slate-300 mb-1">Starter Archetype</div>
                  <div class="grid grid-cols-2 gap-1.5">
                    ${CHARACTER_PRESETS.map(
                      (p) => `
                        <button type="button" data-arch="${p.id}" class="cc-cr-arch px-2.5 py-1.5 rounded-lg border text-left text-[11px] cursor-pointer ${
                          draftPresetId === p.id
                            ? 'border-sky-400 bg-sky-500/20 text-white font-bold'
                            : 'border-[#22355c] bg-[#0d1629] text-slate-300'
                        }">
                          <div>${p.name}</div>
                          <div class="text-[10px] text-slate-400">${p.gender === 'male' ? 'Male' : 'Female'}</div>
                        </button>
                      `,
                    ).join('')}
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Tabbed Options Panel -->
            <div class="p-4 sm:p-5 flex flex-col min-h-0">
              <div class="flex flex-wrap gap-1.5 pb-3 mb-4 border-b border-[#22355c]">
                ${(
                  [
                    {id: 'face', label: 'Body & Face'},
                    {id: 'hair', label: 'Hair & Color'},
                    {id: 'wardrobe', label: `Wardrobe (${ownedWearable.length})`},
                    {id: 'outfits', label: `Outfit Presets (${outfitPresets.length})`},
                  ] as {id: CreatorTab; label: string}[]
                )
                  .map(
                    (t) => `
                      <button type="button" data-ctab="${t.id}" class="cc-cr-tab px-3.5 py-2 rounded-lg text-xs font-bold min-h-[38px] cursor-pointer ${
                        activeTab === t.id
                          ? 'bg-sky-500 text-[#06101f]'
                          : 'bg-[#131f38] text-slate-300 hover:text-white border border-[#22355c]'
                      }">${t.label}</button>
                    `,
                  )
                  .join('')}
              </div>

              ${
                feedback
                  ? `<div class="mb-3 px-3.5 py-2 rounded-lg text-xs font-medium border ${
                      feedback.error
                        ? 'bg-rose-500/15 border-rose-400/50 text-rose-200'
                        : 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                    }">${esc(feedback.text)}</div>`
                  : ''
              }

              <div class="flex-1 overflow-y-auto pr-1">
                ${tabBody}
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-[#22355c] bg-[#080f1e]">
            <button id="cc-cr-reset" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-xl text-xs font-semibold min-h-[40px] cursor-pointer">
              Reset Appearance
            </button>
            <div class="flex flex-wrap items-center gap-2">
              <button id="cc-cr-cancel" type="button" class="cc-btn-secondary px-4 py-2 rounded-xl text-xs font-semibold min-h-[40px] cursor-pointer">
                Cancel
              </button>
              <button id="cc-cr-save" type="button" class="cc-btn-secondary border-emerald-400/60 text-emerald-200 px-4 py-2 rounded-xl text-xs font-bold min-h-[40px] cursor-pointer">
                Save Appearance
              </button>
              ${
                this.callbacks.onEnterCity
                  ? `<button id="cc-cr-enter" type="button" class="cc-btn-primary px-5 py-2 rounded-xl text-xs font-bold min-h-[40px] cursor-pointer">
                      Save &amp; Enter City
                    </button>`
                  : ''
              }
            </div>
          </div>
        </div>
      `;

      // Bind stage controls
      this.backdrop.querySelector('#cc-cr-cancel-top')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });
      this.backdrop.querySelector('#cc-cr-cancel')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });

      this.backdrop.querySelector('#cc-cr-gender-m')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        switchGender('male');
      });
      this.backdrop.querySelector('#cc-cr-gender-f')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        switchGender('female');
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-dir').forEach((b) => {
        b.addEventListener('click', () => {
          audioSystem.playButtonClick();
          previewDir = (b.dataset.dir as Direction) ?? 'down';
          render();
        });
      });
      this.backdrop.querySelector('#cc-cr-rot-l')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        const idx = DIRECTION_ORDER.findIndex((x) => x.dir === previewDir);
        previewDir = DIRECTION_ORDER[(idx - 1 + 4) % 4].dir;
        render();
      });
      this.backdrop.querySelector('#cc-cr-rot-r')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        const idx = DIRECTION_ORDER.findIndex((x) => x.dir === previewDir);
        previewDir = DIRECTION_ORDER[(idx + 1) % 4].dir;
        render();
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-anim').forEach((b) => {
        b.addEventListener('click', () => {
          audioSystem.playButtonClick();
          previewAnim = (b.dataset.anim as AnimationState) ?? 'idle';
          this.animStep = 0;
          render();
        });
      });

      this.backdrop.querySelector<HTMLInputElement>('#cc-cr-name')?.addEventListener('input', (e) => {
        draftName = (e.target as HTMLInputElement).value;
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-arch').forEach((b) => {
        b.addEventListener('click', () => {
          const arch = CHARACTER_PRESETS.find((p) => p.id === b.dataset.arch);
          if (!arch) return;
          audioSystem.playInteract();
          draftPresetId = arch.id;
          draftAppearance = appearanceFromPreset(arch);
          feedback = {text: `Loaded ${arch.name} (${arch.gender}) base preset.`, error: false};
          render();
        });
      });

      // Tabs
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-tab').forEach((b) => {
        b.addEventListener('click', () => {
          audioSystem.playButtonClick();
          activeTab = (b.dataset.ctab as CreatorTab) ?? 'face';
          previewPresetOverride = null;
          feedback = null;
          render();
        });
      });

      // Face controls
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-skin').forEach((b) => {
        b.addEventListener('click', () => {
          audioSystem.playButtonClick();
          draftAppearance = {...draftAppearance, skinTone: b.dataset.skin ?? draftAppearance.skinTone};
          render();
        });
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-eyestyle').forEach((b) => {
        b.addEventListener('click', () => {
          audioSystem.playButtonClick();
          draftAppearance = {...draftAppearance, eyeStyle: (b.dataset.eyeStyle as EyeStyleId) ?? 'classic'};
          render();
        });
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-eyecolor').forEach((b) => {
        b.addEventListener('click', () => {
          audioSystem.playButtonClick();
          draftAppearance = {...draftAppearance, eyeColor: b.dataset.eyeColor ?? draftAppearance.eyeColor};
          render();
        });
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-brow').forEach((b) => {
        b.addEventListener('click', () => {
          audioSystem.playButtonClick();
          draftAppearance = {...draftAppearance, browStyle: (b.dataset.browStyle as BrowStyleId) ?? 'natural'};
          render();
        });
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-detail').forEach((b) => {
        b.addEventListener('click', () => {
          audioSystem.playButtonClick();
          draftAppearance = {...draftAppearance, facialDetail: (b.dataset.detail as FacialDetailId) ?? 'none'};
          render();
        });
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-fh').forEach((b) => {
        b.addEventListener('click', () => {
          audioSystem.playButtonClick();
          draftAppearance = {...draftAppearance, facialHair: (b.dataset.facialHair as FacialHairId) ?? 'none'};
          render();
        });
      });

      // Hair controls
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-hair').forEach((b) => {
        b.addEventListener('click', () => {
          audioSystem.playButtonClick();
          draftAppearance = {...draftAppearance, hairStyle: (b.dataset.hairId as HairStyleId) ?? 'short'};
          render();
        });
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-hcolor').forEach((b) => {
        b.addEventListener('click', () => {
          audioSystem.playButtonClick();
          draftAppearance = {...draftAppearance, hairColor: b.dataset.hcolor ?? draftAppearance.hairColor};
          render();
        });
      });

      // Wardrobe controls (owned only!)
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-wgroup').forEach((b) => {
        b.addEventListener('click', () => {
          audioSystem.playButtonClick();
          wardrobeGroup = b.dataset.wgroup ?? 'All';
          render();
        });
      });
      this.backdrop.querySelector('#cc-cr-clear-outfit')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        draftEquipped = createEmptyEquipped();
        draftSelectedPresetId = null;
        previewPresetOverride = null;
        feedback = {text: 'Switched to clean base outfit.', error: false};
        render();
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-unequip').forEach((b) => {
        b.addEventListener('click', () => {
          const slot = b.dataset.unequip as ClothingSlot | undefined;
          if (!slot) return;
          audioSystem.playButtonClick();
          draftEquipped = {...draftEquipped, [slot]: null};
          draftSelectedPresetId = null;
          render();
        });
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-wear').forEach((b) => {
        b.addEventListener('click', () => {
          const id = b.dataset.wear;
          if (!id || !economySystem.ownsItem(id)) return;
          const item = getShopItemById(id);
          if (!item?.clothing) return;
          audioSystem.playInteract();
          const slot = item.clothing.slot;
          const currentlyOn = draftEquipped[slot] === item.id;
          draftEquipped = {...draftEquipped, [slot]: currentlyOn ? null : item.id};
          draftSelectedPresetId = null;
          previewPresetOverride = null;
          render();
        });
      });

      // Outfit presets controls
      this.backdrop.querySelector<HTMLInputElement>('#cc-cr-newpreset')?.addEventListener('input', (e) => {
        newPresetName = (e.target as HTMLInputElement).value;
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-ptag').forEach((b) => {
        b.addEventListener('click', () => {
          audioSystem.playButtonClick();
          newPresetName = b.dataset.ptag ?? '';
          render();
        });
      });
      this.backdrop.querySelector('#cc-cr-createpreset')?.addEventListener('click', () => {
        const res = economySystem.createOutfitPreset(newPresetName, draftEquipped);
        if (res.ok && res.preset) {
          audioSystem.playCoin();
          draftSelectedPresetId = res.preset.id;
          newPresetName = '';
          feedback = {text: `Saved outfit preset "${res.preset.name}"!`, error: false};
        } else {
          audioSystem.playError();
          feedback = {text: res.reason ?? 'Enter a preset name.', error: true};
        }
        render();
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-pprev').forEach((b) => {
        b.addEventListener('click', () => {
          const pid = b.dataset.pprev;
          const preset = economySystem.getOutfitPresets().find((p) => p.id === pid);
          if (!preset) return;
          audioSystem.playButtonClick();
          previewPresetOverride = economySystem.filterOwnedOutfit(preset.equipped);
          feedback = {text: `Previewing "${preset.name}" — click Apply to equip it.`, error: false};
          render();
        });
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-papply').forEach((b) => {
        b.addEventListener('click', () => {
          const pid = b.dataset.papply;
          const preset = economySystem.getOutfitPresets().find((p) => p.id === pid);
          if (!preset) return;
          audioSystem.playInteract();
          draftEquipped = economySystem.filterOwnedOutfit(preset.equipped);
          draftSelectedPresetId = preset.id;
          previewPresetOverride = null;
          feedback = {text: `Applied "${preset.name}" to your character!`, error: false};
          render();
        });
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-pupdate').forEach((b) => {
        b.addEventListener('click', () => {
          const pid = b.dataset.pupdate;
          if (!pid) return;
          const res = economySystem.overwriteOutfitPreset(pid, draftEquipped);
          if (res.ok) {
            audioSystem.playInteract();
            draftSelectedPresetId = pid;
            feedback = {text: 'Updated preset with your current outfit!', error: false};
          } else {
            audioSystem.playError();
            feedback = {text: res.reason ?? 'Could not update preset.', error: true};
          }
          render();
        });
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-prename').forEach((b) => {
        b.addEventListener('click', () => {
          const pid = b.dataset.prename;
          const preset = economySystem.getOutfitPresets().find((p) => p.id === pid);
          if (!preset) return;
          audioSystem.playButtonClick();
          renamingPresetId = preset.id;
          renameDraft = preset.name;
          render();
        });
      });
      this.backdrop.querySelector<HTMLInputElement>('#cc-cr-rename-input')?.addEventListener('input', (e) => {
        renameDraft = (e.target as HTMLInputElement).value;
      });
      this.backdrop.querySelector('#cc-cr-prename-cancel')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        renamingPresetId = null;
        render();
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-prename-save').forEach((b) => {
        b.addEventListener('click', () => {
          const pid = b.dataset.prenameSave;
          if (!pid) return;
          const res = economySystem.renameOutfitPreset(pid, renameDraft);
          if (res.ok) {
            audioSystem.playInteract();
            renamingPresetId = null;
            feedback = {text: `Renamed preset to "${renameDraft.trim()}".`, error: false};
          } else {
            audioSystem.playError();
            feedback = {text: res.reason ?? 'Could not rename preset.', error: true};
          }
          render();
        });
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-cr-pdel').forEach((b) => {
        b.addEventListener('click', () => {
          const pid = b.dataset.pdel;
          if (!pid) return;
          const res = economySystem.deleteOutfitPreset(pid);
          if (res.ok) {
            audioSystem.playButtonClick();
            if (draftSelectedPresetId === pid) draftSelectedPresetId = null;
            feedback = {text: 'Deleted outfit preset.', error: false};
          } else {
            audioSystem.playError();
            feedback = {text: res.reason ?? 'Cannot delete preset.', error: true};
          }
          render();
        });
      });

      // Footer actions
      this.backdrop.querySelector('#cc-cr-reset')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        const base = CHARACTER_PRESETS.find((p) => p.id === draftPresetId) ?? CHARACTER_PRESETS[0];
        draftAppearance = appearanceFromPreset(base);
        draftEquipped = createEmptyEquipped();
        draftName = base.name;
        draftSelectedPresetId = 'preset_casual';
        previewPresetOverride = null;
        feedback = {text: `Reset appearance to ${base.name}'s default look.`, error: false};
        render();
      });

      const commitSave = () => {
        const cleanName = sanitizeDisplayName(draftName);
        draftName = cleanName;
        saveSystem.updateAppearanceConfig(
          draftPresetId,
          cleanName,
          draftAppearance,
          draftEquipped,
          draftSelectedPresetId,
        );
        this.callbacks.onSaved();
      };

      this.backdrop.querySelector('#cc-cr-save')?.addEventListener('click', () => {
        audioSystem.playCoin();
        commitSave();
        feedback = {text: 'Character customization saved!', error: false};
        render();
      });

      this.backdrop.querySelector('#cc-cr-enter')?.addEventListener('click', () => {
        audioSystem.playCoin();
        commitSave();
        this.stopAnimLoop();
        this.openState = false;
        this.backdrop.style.display = 'none';
        this.backdrop.innerHTML = '';
        this.callbacks.onEnterCity?.();
      });
    };

    render();
    this.backdrop.style.display = 'flex';
  }

  public destroy(): void {
    this.openState = false;
    this.stopAnimLoop();
    this.backdrop.remove();
  }
}
