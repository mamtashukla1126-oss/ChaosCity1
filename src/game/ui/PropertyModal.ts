import {getPropertyById, PROPERTIES_CATALOG} from '@/src/game/data/propertyData';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {authSystem} from '@/src/game/systems/AuthSystem';
import {cloudSaveManager} from '@/src/game/systems/CloudSaveManager';
import {economySystem, ProgressionAwardSummary} from '@/src/game/systems/EconomySystem';
import {multiplayerClient} from '@/src/game/systems/MultiplayerClient';
import {ownerBadgeService} from '@/src/game/systems/OwnerBadgeService';
import {propertySystem} from '@/src/game/systems/PropertySystem';
import {PropertyDeed, PropertyDef} from '@/src/game/types/gameTypes';

export type PropertyModalTab = 'catalog' | 'open_residences';

export interface PropertyModalCallbacks {
  onEnterProperty: (prop: PropertyDef, deed: PropertyDeed, readOnlyVisitor: boolean) => void;
  onTrackProperty?: (prop: PropertyDef) => void;
  onAwarded?: (summary: ProgressionAwardSummary) => void;
  onClose?: () => void;
}

function esc(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class PropertyModal {
  private readonly backdrop: HTMLDivElement;
  private openState = false;
  private activeTab: PropertyModalTab = 'catalog';
  private focusPropertyId: string | null = null;
  private ownDeeds = new Map<string, PropertyDeed>();
  private openResidences: PropertyDeed[] = [];
  private loadingOpen = false;
  private actionBusy = false;
  private invitePropertyId: string | null = null;
  private feedback: {text: string; error: boolean} | null = null;

  constructor(
    parent: HTMLElement,
    private readonly callbacks: PropertyModalCallbacks,
  ) {
    this.backdrop = document.createElement('div');
    this.backdrop.className =
      'ui-interactive fixed inset-0 z-40 hidden items-center justify-center bg-[#040812]/84 p-3 sm:p-4';
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

  public open(initialFocusPropertyId?: string, initialTab: PropertyModalTab = 'catalog'): void {
    this.openState = true;
    this.actionBusy = false;
    this.activeTab = initialTab;
    this.focusPropertyId = initialFocusPropertyId ?? null;
    this.feedback = null;
    this.invitePropertyId = null;
    this.backdrop.style.display = 'flex';
    void this.preloadOwnedDeeds();
    if (this.activeTab === 'open_residences') {
      void this.loadOpenResidences();
    }
    this.render();
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.backdrop.style.display = 'none';
    this.backdrop.innerHTML = '';
    this.callbacks.onClose?.();
  }

  private async preloadOwnedDeeds(): Promise<void> {
    const owned = propertySystem.getOwnedPropertyDefs();
    for (const prop of owned) {
      const deed = await propertySystem.getOrCreateOwnDeed(prop.id);
      if (deed) this.ownDeeds.set(prop.id, deed);
    }
    if (this.openState && this.activeTab === 'catalog') this.render();
  }

  private async loadOpenResidences(): Promise<void> {
    this.loadingOpen = true;
    if (this.openState && this.activeTab === 'open_residences') this.render();
    this.openResidences = await propertySystem.listPublicOpenProperties();
    this.loadingOpen = false;
    if (this.openState && this.activeTab === 'open_residences') this.render();
  }

  private render(): void {
    if (!this.openState) return;
    const coins = economySystem.getCoins();

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-4xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
        <div class="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[#22355c] shrink-0">
          <div>
            <div class="font-mono-tabular text-[11px] font-bold text-amber-300">
              REAL ESTATE REGISTRY · BALANCE: ${coins} COINS
            </div>
            <h2 class="font-display text-lg sm:text-xl font-bold text-white">Chaos City Properties & Homes</h2>
          </div>
          <button id="cc-prop-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[42px] cursor-pointer">
            Close
          </button>
        </div>

        <div class="flex flex-wrap gap-1.5 px-4 sm:px-5 py-2.5 bg-[#091020] border-b border-[#22355c] shrink-0">
          <button type="button" data-ptab="catalog" class="cc-prop-tab px-3.5 py-2 rounded-lg text-xs font-bold min-h-[38px] cursor-pointer ${
            this.activeTab === 'catalog'
              ? 'bg-sky-500 text-[#06101f]'
              : 'bg-[#131f38] text-slate-300 border border-[#22355c]'
          }">Real Estate Catalog (${propertySystem.getOwnedPropertyDefs().length}/${PROPERTIES_CATALOG.length})</button>
          <button type="button" data-ptab="open_residences" class="cc-prop-tab px-3.5 py-2 rounded-lg text-xs font-bold min-h-[38px] cursor-pointer ${
            this.activeTab === 'open_residences'
              ? 'bg-sky-500 text-[#06101f]'
              : 'bg-[#131f38] text-slate-300 border border-[#22355c]'
          }">Visit Open Residences</button>
        </div>

        ${
          this.feedback
            ? `<div class="mx-4 sm:mx-5 mt-3 px-3.5 py-2 rounded-xl text-xs font-semibold border shrink-0 ${
                this.feedback.error
                  ? 'bg-rose-500/15 border-rose-400/50 text-rose-200'
                  : 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
              }">${esc(this.feedback.text)}</div>`
            : ''
        }

        <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          ${this.activeTab === 'catalog' ? this.renderCatalogTab() : this.renderOpenResidencesTab()}
        </div>
      </div>
    `;

    this.backdrop.querySelector('#cc-prop-close')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.close();
    });
    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-prop-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.activeTab = (btn.dataset.ptab as PropertyModalTab) || 'catalog';
        this.feedback = null;
        if (this.activeTab === 'open_residences') void this.loadOpenResidences();
        this.render();
      });
    });

    this.bindEvents();
  }

  private renderCatalogTab(): string {
    const onlinePlayers = multiplayerClient.getRemotePlayers();
    const coins = economySystem.getCoins();

    return `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        ${PROPERTIES_CATALOG.map((prop) => {
          const owned = economySystem.ownsProperty(prop.id);
          const deed = this.ownDeeds.get(prop.id);
          const focused = this.focusPropertyId === prop.id;
          const canAfford = coins >= prop.price;
          const allowVisitors = deed ? deed.allowVisitors : true;

          return `
            <div class="rounded-xl bg-[#091020] border ${
              focused ? 'border-amber-400' : owned ? 'border-emerald-400/60' : 'border-[#22355c]'
            } p-4 flex flex-col justify-between gap-3">
              <div class="space-y-2">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <div class="font-mono-tabular text-[10px] font-bold uppercase ${
                      owned ? 'text-emerald-300' : 'text-sky-300'
                    }">${esc(prop.tierLabel)} · ${esc(prop.districtName)}</div>
                    <h3 class="font-display text-base font-bold text-white">${esc(prop.name)}</h3>
                  </div>
                  <span class="px-2.5 py-1 rounded-lg font-mono-tabular text-xs font-bold shrink-0 ${
                    owned ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-400/15 text-amber-300'
                  }">
                    ${owned ? 'OWNED' : `${prop.price}c`}
                  </span>
                </div>

                <p class="text-xs text-slate-300 leading-relaxed">${esc(prop.description)}</p>

                <div class="flex flex-wrap gap-1.5 text-[10px]">
                  ${prop.rooms.map((r) => `<span class="px-2 py-0.5 rounded bg-[#131f38] text-slate-200 border border-[#22355c]">${esc(r)}</span>`).join('')}
                </div>
                <div class="text-[11px] text-sky-200">
                  Furniture Limit: <b>${prop.maxFurniture}</b> items · Size ${prop.cols}×${prop.rows}
                </div>
              </div>

              <div class="pt-2.5 border-t border-[#1b2c4e] space-y-2">
                ${
                  owned
                    ? `<div class="flex flex-wrap items-center gap-2">
                        <button type="button" data-prop-enter="${esc(prop.id)}" class="cc-prop-enter cc-btn-primary px-3.5 py-2 rounded-xl text-xs font-bold min-h-[38px] cursor-pointer">
                          Enter & Decorate
                        </button>
                        <button type="button" data-prop-vis="${esc(prop.id)}" class="cc-prop-vis cc-btn-secondary px-3 py-2 rounded-xl text-xs font-semibold min-h-[38px] cursor-pointer">
                          Visitors: ${allowVisitors ? 'Open' : 'Private'}
                        </button>
                        ${
                          onlinePlayers.length > 0
                            ? `<button type="button" data-prop-invtog="${esc(prop.id)}" class="cc-prop-invtog cc-btn-secondary px-3 py-2 rounded-xl text-xs font-semibold border-fuchsia-400/50 text-fuchsia-200 min-h-[38px] cursor-pointer">
                                Invite Online
                              </button>`
                            : ''
                        }
                        ${
                          this.callbacks.onTrackProperty
                            ? `<button type="button" data-prop-track="${esc(prop.id)}" class="cc-prop-track cc-btn-secondary px-2.5 py-2 rounded-xl text-xs font-semibold min-h-[38px] cursor-pointer">GPS</button>`
                            : ''
                        }
                      </div>
                      ${
                        this.invitePropertyId === prop.id && onlinePlayers.length > 0
                          ? `<div class="flex flex-wrap gap-1.5 pt-1">
                              ${onlinePlayers
                                .map(
                                  (p) => `<button type="button" data-inv-uid="${esc(p.uid)}" data-inv-prop="${esc(prop.id)}" class="cc-prop-invsend px-2.5 py-1 rounded-lg bg-fuchsia-500/20 border border-fuchsia-400/50 text-[11px] font-bold text-fuchsia-100 cursor-pointer">Invite ${esc(p.displayName)}</button>`,
                                )
                                .join('')}
                            </div>`
                          : ''
                      }`
                    : `<div class="flex flex-wrap items-center justify-between gap-2">
                        ${
                          this.callbacks.onTrackProperty
                            ? `<button type="button" data-prop-track="${esc(prop.id)}" class="cc-prop-track cc-btn-secondary px-3 py-2 rounded-xl text-xs font-semibold min-h-[38px] cursor-pointer">Locate Sign on GPS</button>`
                            : '<span></span>'
                        }
                        <button type="button" data-prop-buy="${esc(prop.id)}" ${canAfford ? '' : 'disabled'} class="cc-prop-buy cc-btn-primary px-4 py-2 rounded-xl text-xs font-bold min-h-[38px] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed">
                          ${canAfford ? `Buy Property (${prop.price}c)` : `Need ${prop.price - coins}c more`}
                        </button>
                      </div>`
                }
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private renderOpenResidencesTab(): string {
    const user = authSystem.getCurrentUser();
    if (!user) {
      return `
        <div class="rounded-xl bg-[#091020] border border-[#22355c] p-5 text-center text-xs text-slate-300">
          Sign in with your CHAOS CITY account to browse and visit open player properties.
        </div>
      `;
    }

    return `
      <div class="flex items-center justify-between gap-2">
        <div class="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-sky-300">
          Open Player Homes (Read-Only Visitor Tour)
        </div>
        <button id="cc-prop-ref-open" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">
          ${this.loadingOpen ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      ${
        this.openResidences.length === 0 && !this.loadingOpen
          ? `<div class="rounded-xl bg-[#091020] border border-[#22355c] p-5 text-center text-xs text-slate-400">
              No public open residences are listed in Firestore yet. Buy a home and toggle Visitors: Open!
            </div>`
          : `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              ${this.openResidences
                .map((deed) => {
                  const def = getPropertyById(deed.propertyId);
                  const isSelf = deed.ownerUid === user.uid;
                  const isOwner = ownerBadgeService.isVerifiedOwnerAccount(deed.ownerUid, deed.ownerUsername);
                  return `
                    <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3.5 flex items-center justify-between gap-3">
                      <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                          ${isOwner ? ownerBadgeService.renderBadgeHtml(true) : ''}
                          <span class="font-display font-bold text-sm text-white truncate">${esc(deed.title)}</span>
                        </div>
                        <div class="text-[11px] text-slate-300">Owner: @${esc(deed.ownerUsername)} · ${esc(def?.districtName || 'CHAOS CITY')}</div>
                        <div class="text-[10px] text-slate-400">${deed.furniture.length} placed furniture items</div>
                      </div>
                      <button type="button" data-visit-deed="${esc(deed.deedId)}" class="cc-prop-visit cc-btn-primary px-3.5 py-2 rounded-xl text-xs font-bold min-h-[38px] cursor-pointer shrink-0">
                        ${isSelf ? 'Enter Home' : 'Visit'}
                      </button>
                    </div>
                  `;
                })
                .join('')}
            </div>`
      }
    `;
  }

  private bindEvents(): void {
    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-prop-buy').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (this.actionBusy || !this.openState) return;
        const id = btn.dataset.propBuy;
        if (!id) return;
        this.actionBusy = true;
        try {
          const res = economySystem.purchaseProperty(id);
          if (!res.ok) {
            audioSystem.playError();
            this.feedback = {text: res.reason || 'Purchase failed.', error: true};
            this.render();
            return;
          }
          audioSystem.playCoin();
          if (res.summary) this.callbacks.onAwarded?.(res.summary);
          const deed = await propertySystem.getOrCreateOwnDeed(id);
          if (!this.openState) return;
          if (deed) this.ownDeeds.set(id, deed);
          void cloudSaveManager.flushNow();
          this.feedback = {text: `Purchased ${getPropertyById(id)?.name}! Enter & decorate anytime.`, error: false};
          this.render();
        } finally {
          this.actionBusy = false;
        }
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-prop-enter').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (this.actionBusy || !this.openState) return;
        const id = btn.dataset.propEnter;
        const prop = id ? getPropertyById(id) : undefined;
        if (!prop) return;
        this.actionBusy = true;
        try {
          const deed = this.ownDeeds.get(prop.id) || (await propertySystem.getOrCreateOwnDeed(prop.id));
          if (!deed || !this.openState) return;
          audioSystem.playDoor();
          this.close();
          this.callbacks.onEnterProperty(prop, deed, false);
        } finally {
          this.actionBusy = false;
        }
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-prop-vis').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (this.actionBusy || !this.openState) return;
        const id = btn.dataset.propVis;
        if (!id) return;
        this.actionBusy = true;
        try {
          const deed = this.ownDeeds.get(id) || (await propertySystem.getOrCreateOwnDeed(id));
          if (!deed || !this.openState) return;
          const next: PropertyDeed = {...deed, allowVisitors: !deed.allowVisitors};
          this.ownDeeds.set(id, next);
          await propertySystem.saveDeed(next);
          if (!this.openState) return;
          audioSystem.playButtonClick();
          this.feedback = {
            text: next.allowVisitors
              ? `${next.title} is now OPEN for visitors!`
              : `${next.title} set to Private.`,
            error: false,
          };
          this.render();
        } finally {
          this.actionBusy = false;
        }
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-prop-invtog').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.propInvtog || null;
        this.invitePropertyId = this.invitePropertyId === id ? null : id;
        audioSystem.playButtonClick();
        this.render();
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-prop-invsend').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.invUid;
        const propId = btn.dataset.invProp;
        const prop = propId ? getPropertyById(propId) : undefined;
        const selfUid = authSystem.getCurrentUser()?.uid;
        if (!uid || !prop || !selfUid) return;
        const deedId = propertySystem.makeDeedId(selfUid, prop.id);
        void propertySystem.invitePlayerToProperty(prop.id, uid);
        multiplayerClient.sendPropertyInvite(uid, deedId, prop.name);
        audioSystem.playInteract();
        this.invitePropertyId = null;
        this.feedback = {text: `Invited player to tour ${prop.name}!`, error: false};
        this.render();
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-prop-track').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prop = btn.dataset.propTrack ? getPropertyById(btn.dataset.propTrack) : undefined;
        if (!prop || !this.callbacks.onTrackProperty) return;
        audioSystem.playInteract();
        this.close();
        this.callbacks.onTrackProperty(prop);
      });
    });

    this.backdrop.querySelector('#cc-prop-ref-open')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      void this.loadOpenResidences();
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-prop-visit').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (this.actionBusy || !this.openState) return;
        const deedId = btn.dataset.visitDeed;
        const deed = this.openResidences.find((d) => d.deedId === deedId);
        if (!deed) return;
        const prop = getPropertyById(deed.propertyId);
        if (!prop) return;
        this.actionBusy = true;
        try {
          const selfUid = authSystem.getCurrentUser()?.uid;
          audioSystem.playDoor();
          this.close();
          this.callbacks.onEnterProperty(prop, deed, deed.ownerUid !== selfUid);
        } finally {
          this.actionBusy = false;
        }
      });
    });
  }

  public destroy(): void {
    this.openState = false;
    this.backdrop.remove();
  }
}
