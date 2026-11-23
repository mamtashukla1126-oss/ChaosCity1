import {CHARACTER_PRESETS} from '@/src/config/constants';
import {getNpcMissions} from '@/src/game/data/progressionData';
import {renderCharacterPortraitDataUrl} from '@/src/game/graphics/PixelArtGenerator';
import {CityMapData} from '@/src/game/maps/cityMap';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {authSystem} from '@/src/game/systems/AuthSystem';
import {cloudSaveManager} from '@/src/game/systems/CloudSaveManager';
import {economySystem} from '@/src/game/systems/EconomySystem';
import {gameSessionManager} from '@/src/game/systems/GameSessionManager';
import {
  multiplayerClient,
  PropertyInviteEvent,
} from '@/src/game/systems/MultiplayerClient';
import {ownerBadgeService} from '@/src/game/systems/OwnerBadgeService';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {
  CloudSyncState,
  Direction,
  EmoteId,
  InteractiveObjectData,
  RemotePlayerState,
  ServerInviteItem,
} from '@/src/game/types/gameTypes';
import {MiniMapWidget} from '@/src/game/ui/MiniMapWidget';
import {
  isFullscreenActive,
  onFullscreenChange,
  toggleFullscreen,
} from '@/src/game/utils/device';

export interface GameHUDCallbacks {
  onOpenMap?: () => void;
  onOpenPhone?: () => void;
  onOpenJournal?: (tab?: 'missions' | 'exploration' | 'story' | 'achievements') => void;
  onOpenMiniGames?: () => void;
  onOpenSocial?: (tab?: 'servers' | 'chat' | 'friends' | 'lobbies') => void;
  onOpenFriends?: () => void;
  onLeaveServer?: () => void;
  onCloseHostedServer?: () => void;
  onAcceptServerInvite?: (
    invite: ServerInviteItem,
    password?: string,
  ) => Promise<{ok: boolean; requiresPassword?: boolean; error?: string}>;
  onDeclineServerInvite?: (inviteId: string) => void;
  onOpenProperties?: () => void;
  onOpenProfile?: () => void;
  onQuickEmote?: (emoteId: EmoteId) => void;
  onAcceptPropertyInvite?: (deedId: string) => void;
  onViewRemoteProfile?: (player: RemotePlayerState) => void;
  onSendFriendRequest?: (player: RemotePlayerState) => void;
  onInviteRemoteToProperty?: (player: RemotePlayerState) => void;
  onRideRemoteVehicle?: (player: RemotePlayerState) => void;
  onCancelTimedChallenge?: () => void;
  onOpenInventory: () => void;
  onExitBuilding?: () => void;
  onOpenSettings: () => void;
  onPause: () => void;
  onTriggerInteract: () => void;
  onFountainCoinToss?: (x: number, y: number) => void;
  onCycleOutfit?: () => {appearanceId: string; presetName: string};
  onExitVehicle?: () => void;
  onWakeUp?: () => void;
  onNpcChatMore?: (npcObjectId: string, step: number) => string | null;
  onMissionAction?: (
    action: 'accept' | 'pause' | 'abandon' | 'claim',
    missionId: string,
  ) => {ok: boolean; message: string};
}

const EXPAND_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`;
const MINIMIZE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>`;

const esc = (str: string): string =>
  String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export class GameHUD {
  private readonly root: HTMLDivElement;
  private readonly avatarImg: HTMLImageElement;
  private readonly playerNameEl: HTMLElement;
  private readonly ownerBadgeSlot: HTMLElement;
  private readonly levelEl: HTMLElement;
  private readonly districtEl: HTMLElement;
  private readonly clockEl: HTMLElement;
  private readonly coinsEl: HTMLElement;
  private readonly energyEl: HTMLElement;
  private readonly weatherEl: HTMLElement;
  private readonly wantedEl: HTMLElement;
  private readonly syncBtn: HTMLButtonElement;
  private readonly mpPillBtn: HTMLButtonElement | null;
  private readonly mpRoomBarEl: HTMLDivElement;
  private readonly emoteTrayEl: HTMLDivElement;
  private readonly inviteBannerEl: HTMLDivElement;
  private readonly objectiveWrapEl: HTMLDivElement;
  private readonly objectiveTitleEl: HTMLElement;
  private readonly objectiveDetailEl: HTMLElement;
  private readonly objectiveCancelBtn: HTMLButtonElement;
  private readonly promptEl: HTMLButtonElement;
  private readonly fullscreenBtn: HTMLButtonElement;
  private readonly toastEl: HTMLDivElement;
  private readonly modalBackdrop: HTMLDivElement;
  private readonly miniMap: MiniMapWidget | null = null;

  private modalOpen = false;
  private isSitting = false;
  private isSleeping = false;
  private drivingVehicleName: string | null = null;
  private drivingSpeed = 0;
  private drivingCondition = 100;
  private currentTarget: InteractiveObjectData | null = null;
  private isTouchVisible = false;
  private pendingInvite: PropertyInviteEvent | null = null;
  private pendingServerInvite: ServerInviteItem | null = null;
  private toastTimer: number | null = null;
  private unsubFullscreen: (() => void) | null = null;
  private unsubEconomy: (() => void) | null = null;
  private unsubCloudSync: (() => void) | null = null;
  private unsubMpStatus: (() => void) | null = null;
  private unsubInvite: (() => void) | null = null;
  private unsubServerInvite: (() => void) | null = null;

  constructor(
    parent: HTMLElement,
    mapData: CityMapData | null,
    private readonly callbacks: GameHUDCallbacks,
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 md:p-4';

    const hasMap = Boolean(mapData && callbacks.onOpenMap);
    const hasExit = Boolean(callbacks.onExitBuilding);
    const isMp = gameSessionManager.isMultiplayer();

    this.root.innerHTML = `
      <div class="flex flex-wrap sm:flex-nowrap items-start justify-between gap-2 md:gap-3">
        <!-- Top-Left Player Status Cluster + Room Strip + Objective Tracker -->
        <div class="order-1 flex flex-col gap-1.5 max-w-[232px] sm:max-w-[270px] md:max-w-[310px] shrink-0 pointer-events-none">
          <div class="ui-interactive cc-panel-subtle rounded-xl px-3 py-2 flex items-center gap-2.5">
            <button id="cc-hud-avatar-btn" type="button" title="Open Citizen Profile" class="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#060b16] border border-sky-400/40 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer">
              <img id="cc-hud-avatar" alt="Player avatar" class="w-8 h-8 sm:w-9 sm:h-9 object-contain" style="image-rendering: pixelated;" />
            </button>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span id="cc-hud-owner-slot" class="shrink-0"></span>
                <span id="cc-hud-name" class="font-display font-bold text-xs sm:text-sm text-white truncate">Kai</span>
                <span id="cc-hud-level" class="font-mono-tabular text-[10px] font-bold text-amber-300 shrink-0">Lv.1</span>
                <span id="cc-hud-energy" class="font-mono-tabular text-[10px] text-emerald-300 shrink-0">⚡100</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div id="cc-hud-district" class="text-[11px] font-medium text-sky-300 truncate">Central Park</div>
                <span class="text-slate-500 text-[10px]">·</span>
                <div id="cc-hud-coins" class="font-mono-tabular text-[11px] font-bold text-amber-300 shrink-0">250c</div>
              </div>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span id="cc-hud-clock" class="text-[10px] font-mono-tabular text-slate-200 shrink-0">🌅 09:30 AM</span>
                <span id="cc-hud-weather" class="text-[10px] font-mono-tabular text-sky-200 shrink-0">☀️ Clear</span>
                <span id="cc-hud-wanted" class="hidden text-[10px] font-mono-tabular font-bold text-rose-300 bg-rose-500/20 border border-rose-400/50 rounded px-1.5 py-0.2 shrink-0">★1</span>
                <span class="text-slate-600 text-[9px]">·</span>
                <button id="cc-hud-sync" type="button" class="text-[9px] font-mono-tabular font-semibold tracking-wider text-slate-400 text-left truncate max-w-[96px]">
                  LOCAL
                </button>
              </div>
            </div>
          </div>

          <div id="cc-hud-mp-bar" class="hidden ui-interactive cc-panel-subtle rounded-xl px-2.5 py-1.5 border-emerald-400/45 flex-col gap-1"></div>

          <div id="cc-hud-invite" class="hidden ui-interactive cc-panel-subtle rounded-xl px-3 py-2 border-fuchsia-400/60 flex-col gap-1.5"></div>

          <div id="cc-hud-objective" class="hidden ui-interactive cc-panel-subtle rounded-xl px-3 py-1.5 items-center justify-between gap-2 border-amber-400/45">
            <button id="cc-hud-obj-btn" type="button" class="min-w-0 flex-1 text-left cursor-pointer">
              <div id="cc-hud-obj-title" class="font-mono-tabular text-[10px] font-bold text-amber-300 truncate">Objective</div>
              <div id="cc-hud-obj-detail" class="text-[11px] text-slate-200 truncate">Explore Chaos City</div>
            </button>
            <button id="cc-hud-obj-cancel" type="button" class="hidden px-2 py-1 rounded bg-rose-500/20 border border-rose-400/50 text-[10px] font-bold text-rose-200 cursor-pointer shrink-0">
              Cancel
            </button>
          </div>
        </div>

        <!-- Upper-Center Landscape Recommendation + Fullscreen Button (Prompt 02 Placement Preserved) -->
        <div class="order-3 sm:order-2 w-full sm:w-auto flex-1 flex justify-center min-w-0 pointer-events-none">
          <div class="ui-interactive cc-panel-subtle rounded-xl px-2 lg:px-3 py-1.5 flex items-center justify-between gap-2 max-w-full min-w-0">
            <span class="hidden lg:inline font-display text-xs font-semibold text-slate-200 leading-tight truncate">
              Landscape Recommended
            </span>
            <button
              id="cc-hud-fs"
              type="button"
              aria-label="Enter Fullscreen"
              title="Toggle Fullscreen"
              class="cc-btn-secondary min-h-[44px] min-w-[44px] px-2.5 py-2 rounded-lg border-sky-400/60 text-sky-300 text-xs font-semibold flex items-center justify-center shrink-0 cursor-pointer"
            >
              ${EXPAND_ICON}
            </button>
          </div>
        </div>

        <!-- Top-Right Utility Controls + Live Minimap -->
        <div class="order-2 sm:order-3 flex flex-col items-end gap-2 min-w-0 pointer-events-none">
          <div class="ui-interactive flex flex-wrap justify-end items-center gap-1 sm:gap-1.5">
            ${
              isMp && callbacks.onOpenSocial
                ? `<button id="cc-hud-social" type="button" aria-label="Multiplayer & Social" class="cc-btn-secondary px-2 lg:px-2.5 py-2 rounded-xl text-xs font-semibold min-h-[44px] border-emerald-400/50 text-emerald-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                    <span>🌐</span>
                    <span id="cc-hud-mp-label" class="font-mono-tabular text-[11px]">MP</span>
                  </button>`
                : ''
            }
            ${
              callbacks.onOpenProperties
                ? `<button id="cc-hud-props" type="button" aria-label="Properties & Real Estate" class="cc-btn-secondary px-2 lg:px-2.5 py-2 rounded-xl text-xs font-semibold min-h-[44px] border-cyan-400/50 text-cyan-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                    <span>🏠</span>
                    <span class="hidden xl:inline">Homes</span>
                  </button>`
                : ''
            }
            ${
              callbacks.onQuickEmote
                ? `<button id="cc-hud-emote-btn" type="button" aria-label="Quick Emotes" class="cc-btn-secondary px-2 py-2 rounded-xl text-xs font-semibold min-h-[44px] border-amber-400/40 text-amber-200 flex items-center gap-1 cursor-pointer whitespace-nowrap">
                    <span>👋</span>
                  </button>`
                : ''
            }
            ${
              callbacks.onOpenJournal
                ? `<button id="cc-hud-journal" type="button" aria-label="Open Journal & Story" class="cc-btn-secondary px-2 lg:px-2.5 py-2 rounded-xl text-xs font-semibold min-h-[44px] border-amber-400/50 text-amber-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    <span class="hidden lg:inline">Journal</span>
                    <span class="font-mono-tabular text-[10px] text-amber-300 hidden xl:inline">[J]</span>
                  </button>`
                : ''
            }
            ${
              callbacks.onOpenMiniGames
                ? `<button id="cc-hud-games" type="button" aria-label="Open Mini-Games Hub" class="cc-btn-secondary px-2 lg:px-2.5 py-2 rounded-xl text-xs font-semibold min-h-[44px] border-fuchsia-400/50 text-fuchsia-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M6 12h4"/><path d="M8 10v4"/><circle cx="15" cy="11" r="1"/><circle cx="18" cy="13" r="1"/></svg>
                    <span class="hidden lg:inline">Games</span>
                  </button>`
                : ''
            }
            ${
              callbacks.onOpenPhone
                ? `<button id="cc-hud-phone" type="button" aria-label="Open City Phone" class="cc-btn-secondary px-2 lg:px-2.5 py-2 rounded-xl text-xs font-semibold min-h-[44px] border-sky-400/50 text-sky-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                    <span class="hidden lg:inline">Phone</span>
                    <span class="font-mono-tabular text-[10px] text-sky-300 hidden xl:inline">[P]</span>
                  </button>`
                : ''
            }
            <button id="cc-hud-bag" type="button" aria-label="Open Bag" class="cc-btn-secondary px-2 lg:px-2.5 py-2 rounded-xl text-xs font-semibold min-h-[44px] flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              <span class="hidden lg:inline">Bag</span>
              <span class="font-mono-tabular text-[10px] text-amber-300 hidden xl:inline">[I]</span>
            </button>
            ${
              hasMap
                ? `<button id="cc-hud-map" type="button" aria-label="Open Map" class="cc-btn-secondary px-2 lg:px-2.5 py-2 rounded-xl text-xs font-semibold min-h-[44px] flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>
                    <span class="hidden lg:inline">Map</span>
                    <span class="font-mono-tabular text-[10px] text-sky-300 hidden xl:inline">[M]</span>
                  </button>`
                : ''
            }
            ${
              hasExit
                ? `<button id="cc-hud-exit" type="button" aria-label="Exit Building" class="cc-btn-secondary px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold min-h-[44px] border-amber-400/50 text-amber-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    <span>Exit</span>
                  </button>`
                : ''
            }
            <button id="cc-hud-settings" type="button" aria-label="Settings" class="cc-btn-secondary px-2 lg:px-2.5 py-2 rounded-xl text-xs font-semibold min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            <button id="cc-hud-pause" type="button" aria-label="Pause" class="cc-btn-secondary px-2 lg:px-2.5 py-2 rounded-xl text-xs font-semibold min-h-[44px] flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              <span class="hidden lg:inline">Pause</span>
            </button>
          </div>
          <div id="cc-hud-emote-tray" class="hidden ui-interactive cc-panel-subtle rounded-xl p-1.5 gap-1">
            ${(
              [
                ['wave', '👋'],
                ['dance', '💃'],
                ['cheer', '🎉'],
                ['sit', '🪑'],
                ['heart', '❤️'],
                ['music', '🎵'],
              ] as [EmoteId, string][]
            )
              .map(
                ([eid, ic]) =>
                  `<button type="button" data-qemote="${eid}" class="cc-hud-qemote px-2.5 py-1.5 rounded-lg bg-[#131f38] hover:bg-sky-500/20 border border-[#22355c] text-sm cursor-pointer">${ic}</button>`,
              )
              .join('')}
          </div>
          <div id="cc-minimap-slot" class="pointer-events-none"></div>
        </div>
      </div>

      <!-- Toast Notification -->
      <div class="fixed top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        <div id="cc-hud-toast" class="hidden cc-panel rounded-xl px-4 py-2 text-xs font-medium text-sky-200 border-sky-400/60 max-w-xs sm:max-w-md text-center"></div>
      </div>

      <!-- Bottom-Center Contextual Interaction Prompt -->
      <div class="flex justify-center pb-2 pointer-events-none">
        <button id="cc-hud-prompt" type="button" class="ui-interactive hidden cc-panel rounded-xl px-4 py-2.5 text-xs md:text-sm font-semibold text-white items-center gap-2.5 border-sky-400/70 cursor-pointer hover:border-sky-300">
        </button>
      </div>
    `;

    parent.appendChild(this.root);

    this.avatarImg = this.root.querySelector('#cc-hud-avatar') as HTMLImageElement;
    this.playerNameEl = this.root.querySelector('#cc-hud-name') as HTMLElement;
    this.ownerBadgeSlot = this.root.querySelector('#cc-hud-owner-slot') as HTMLElement;
    this.levelEl = this.root.querySelector('#cc-hud-level') as HTMLElement;
    this.districtEl = this.root.querySelector('#cc-hud-district') as HTMLElement;
    this.clockEl = this.root.querySelector('#cc-hud-clock') as HTMLElement;
    this.coinsEl = this.root.querySelector('#cc-hud-coins') as HTMLElement;
    this.energyEl = this.root.querySelector('#cc-hud-energy') as HTMLElement;
    this.weatherEl = this.root.querySelector('#cc-hud-weather') as HTMLElement;
    this.wantedEl = this.root.querySelector('#cc-hud-wanted') as HTMLElement;
    this.syncBtn = this.root.querySelector('#cc-hud-sync') as HTMLButtonElement;
    this.mpPillBtn = this.root.querySelector('#cc-hud-social');
    this.mpRoomBarEl = this.root.querySelector('#cc-hud-mp-bar') as HTMLDivElement;
    this.emoteTrayEl = this.root.querySelector('#cc-hud-emote-tray') as HTMLDivElement;
    this.inviteBannerEl = this.root.querySelector('#cc-hud-invite') as HTMLDivElement;
    this.objectiveWrapEl = this.root.querySelector('#cc-hud-objective') as HTMLDivElement;
    this.objectiveTitleEl = this.root.querySelector('#cc-hud-obj-title') as HTMLElement;
    this.objectiveDetailEl = this.root.querySelector('#cc-hud-obj-detail') as HTMLElement;
    this.objectiveCancelBtn = this.root.querySelector('#cc-hud-obj-cancel') as HTMLButtonElement;
    this.promptEl = this.root.querySelector('#cc-hud-prompt') as HTMLButtonElement;
    this.fullscreenBtn = this.root.querySelector('#cc-hud-fs') as HTMLButtonElement;
    this.toastEl = this.root.querySelector('#cc-hud-toast') as HTMLDivElement;

    if (mapData && callbacks.onOpenMap) {
      const minimapSlot = this.root.querySelector('#cc-minimap-slot') as HTMLElement;
      this.miniMap = new MiniMapWidget(minimapSlot, mapData, () => {
        audioSystem.playButtonClick();
        callbacks.onOpenMap?.();
      });
    }

    this.modalBackdrop = document.createElement('div');
    this.modalBackdrop.className =
      'ui-interactive fixed inset-0 z-30 hidden items-center justify-center bg-[#040812]/75 p-4';
    parent.appendChild(this.modalBackdrop);
    this.modalBackdrop.addEventListener('click', (e) => {
      if (e.target === this.modalBackdrop && this.modalOpen) {
        audioSystem.playButtonClick();
        this.closeInteractionPanel();
      }
    });

    this.root.querySelector('#cc-hud-avatar-btn')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onOpenProfile?.();
    });
    this.root.querySelector('#cc-hud-social')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onOpenSocial?.('servers');
    });
    this.root.querySelector('#cc-hud-props')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onOpenProperties?.();
    });
    this.root.querySelector('#cc-hud-emote-btn')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      const isHidden = this.emoteTrayEl.classList.contains('hidden');
      this.emoteTrayEl.classList.toggle('hidden', !isHidden);
      this.emoteTrayEl.classList.toggle('flex', isHidden);
    });
    this.emoteTrayEl.querySelectorAll<HTMLButtonElement>('.cc-hud-qemote').forEach((btn) => {
      btn.addEventListener('click', () => {
        const eid = btn.dataset.qemote as EmoteId | undefined;
        if (!eid) return;
        this.emoteTrayEl.classList.add('hidden');
        this.emoteTrayEl.classList.remove('flex');
        this.callbacks.onQuickEmote?.(eid);
      });
    });
    this.root.querySelector('#cc-hud-journal')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onOpenJournal?.();
    });
    this.root.querySelector('#cc-hud-games')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onOpenMiniGames?.();
    });
    this.root.querySelector('#cc-hud-obj-btn')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      const targetTab =
        this.objectiveTitleEl.textContent?.startsWith('Story') ? 'story' : 'missions';
      this.callbacks.onOpenJournal?.(targetTab);
    });
    this.objectiveCancelBtn.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onCancelTimedChallenge?.();
    });
    this.root.querySelector('#cc-hud-phone')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onOpenPhone?.();
    });
    this.root.querySelector('#cc-hud-bag')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onOpenInventory();
    });
    this.root.querySelector('#cc-hud-map')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onOpenMap?.();
    });
    this.root.querySelector('#cc-hud-exit')?.addEventListener('click', () => {
      audioSystem.playDoor();
      this.callbacks.onExitBuilding?.();
    });
    this.root.querySelector('#cc-hud-settings')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onOpenSettings();
    });
    this.root.querySelector('#cc-hud-pause')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onPause();
    });
    this.syncBtn.addEventListener('click', () => {
      const st = cloudSaveManager.getSyncState();
      if (!st.uid) return;
      audioSystem.playButtonClick();
      void cloudSaveManager.flushNow(true);
    });
    this.fullscreenBtn.addEventListener('click', async () => {
      audioSystem.playButtonClick();
      const result = await toggleFullscreen();
      this.syncFullscreenIcon(result.active);
      if (result.error) {
        this.showToast(result.error);
      }
    });
    this.promptEl.addEventListener('click', () => {
      if (this.isSleeping && this.callbacks.onWakeUp) {
        this.callbacks.onWakeUp();
        return;
      }
      if (this.drivingVehicleName && this.callbacks.onExitVehicle) {
        this.callbacks.onExitVehicle();
        return;
      }
      this.callbacks.onTriggerInteract();
    });

    this.syncFullscreenIcon(isFullscreenActive());
    this.unsubFullscreen = onFullscreenChange((active) => {
      this.syncFullscreenIcon(active);
    });

    this.syncEconomyDisplay();
    this.unsubEconomy = economySystem.subscribe(() => {
      this.syncEconomyDisplay();
    });
    this.unsubCloudSync = cloudSaveManager.subscribe((sync) => {
      this.renderCloudSyncIndicator(sync);
    });
    this.unsubMpStatus = multiplayerClient.onStatusChange((snap) => {
      const lbl = this.root.querySelector('#cc-hud-mp-label');
      if (lbl) {
        lbl.textContent = snap.status === 'connected' ? `${snap.playerCount}/${snap.maxPlayers}` : 'MP';
      }
      this.renderMpRoomBar();
      this.syncOwnerBadge();
    });
    this.unsubInvite = multiplayerClient.onPropertyInvite((evt) => {
      if (!gameSessionManager.isMultiplayer()) return;
      this.showPropertyInviteBanner(evt);
    });
    this.unsubServerInvite = multiplayerClient.onServerInvite((inv) => {
      if (!gameSessionManager.isMultiplayer()) return;
      this.showServerInviteBanner(inv);
    });
    this.renderMpRoomBar();
    this.syncOwnerBadge();
  }

  private renderCloudSyncIndicator(sync: CloudSyncState): void {
    if (!sync.uid) {
      this.syncBtn.textContent = 'GUEST · LOCAL';
      this.syncBtn.className =
        'mt-0.5 text-[9px] font-mono-tabular font-semibold tracking-wider text-slate-400 block text-left truncate max-w-[165px] cursor-default';
      return;
    }
    if (sync.status === 'saving') {
      this.syncBtn.textContent = 'SAVING...';
      this.syncBtn.className =
        'mt-0.5 text-[9px] font-mono-tabular font-semibold tracking-wider text-sky-300 block text-left truncate max-w-[165px] cursor-default';
      return;
    }
    if (sync.status === 'saved') {
      this.syncBtn.textContent = 'SAVED TO CLOUD';
      this.syncBtn.className =
        'mt-0.5 text-[9px] font-mono-tabular font-semibold tracking-wider text-emerald-300 block text-left truncate max-w-[165px] cursor-pointer';
      return;
    }
    if (sync.status === 'offline' || sync.status === 'error') {
      this.syncBtn.textContent =
        sync.status === 'offline' ? 'OFFLINE · RETRY' : 'SAVE ERROR · RETRY';
      this.syncBtn.title = sync.lastError ?? 'Tap to retry cloud save';
      this.syncBtn.className =
        'mt-0.5 text-[9px] font-mono-tabular font-semibold tracking-wider text-rose-300 underline block text-left truncate max-w-[165px] cursor-pointer';
      return;
    }
    this.syncBtn.textContent = 'SYNC CLOUD';
    this.syncBtn.className =
      'mt-0.5 text-[9px] font-mono-tabular font-semibold tracking-wider text-amber-300 block text-left truncate max-w-[165px] cursor-pointer';
  }

  public syncEconomyDisplay(): void {
    const save = saveSystem.getState();
    this.coinsEl.textContent = `${save.coins}c`;
    this.energyEl.textContent = `⚡${save.energy}`;
    this.levelEl.textContent = `Lv.${save.progression?.level ?? 1}`;
    const preset =
      CHARACTER_PRESETS.find((p) => p.id === save.appearanceId) ?? CHARACTER_PRESETS[0];
    this.avatarImg.src = renderCharacterPortraitDataUrl(
      preset,
      save.equippedClothing,
      save.hairOverride,
      save.appearanceConfig,
    );
    this.playerNameEl.textContent = save.playerName;
    this.syncOwnerBadge();
  }

  private renderMpRoomBar(): void {
    if (!gameSessionManager.isMultiplayer()) {
      this.mpRoomBarEl.classList.add('hidden');
      this.mpRoomBarEl.classList.remove('flex');
      this.mpRoomBarEl.innerHTML = '';
      return;
    }
    const snap = multiplayerClient.getStatus();
    const isHost = Boolean(snap.hostUid && snap.hostUid === snap.selfUid && !snap.isOfficial);
    this.mpRoomBarEl.classList.remove('hidden');
    this.mpRoomBarEl.classList.add('flex');
    this.mpRoomBarEl.innerHTML = `
      <div class="flex items-center justify-between gap-2 text-[10px]">
        <span class="font-display font-bold text-emerald-200 truncate">${esc(snap.roomName || 'Multiplayer City')}</span>
        <span class="font-mono-tabular text-sky-300 font-bold shrink-0">${
          snap.status === 'connected' ? `${snap.playerCount}/${snap.maxPlayers}` : 'Connecting...'
        }</span>
      </div>
      <div class="flex flex-wrap items-center gap-1">
        ${
          snap.roomCode
            ? `<button id="cc-hud-mp-code" type="button" title="Copy Room Code" class="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-400/40 font-mono-tabular text-[10px] font-bold text-sky-200 cursor-pointer">Code: ${esc(snap.roomCode)}</button>`
            : ''
        }
        ${
          this.callbacks.onOpenFriends
            ? `<button id="cc-hud-mp-invite" type="button" class="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/40 text-[10px] font-semibold text-emerald-200 cursor-pointer">Invite</button>`
            : ''
        }
        ${
          this.callbacks.onLeaveServer
            ? `<button id="cc-hud-mp-leave" type="button" class="px-1.5 py-0.5 rounded bg-slate-800 border border-[#22355c] text-[10px] font-semibold text-slate-200 cursor-pointer">Leave</button>`
            : ''
        }
        ${
          isHost && this.callbacks.onCloseHostedServer
            ? `<button id="cc-hud-mp-close-room" type="button" class="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-400/50 text-[10px] font-bold text-rose-200 cursor-pointer">Close Room</button>`
            : ''
        }
      </div>
    `;

    this.mpRoomBarEl.querySelector('#cc-hud-mp-code')?.addEventListener('click', () => {
      if (!snap.roomCode) return;
      audioSystem.playButtonClick();
      void navigator.clipboard?.writeText(snap.roomCode);
      this.showToast(`Room Code copied: ${snap.roomCode}`);
    });
    this.mpRoomBarEl.querySelector('#cc-hud-mp-invite')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onOpenFriends?.();
    });
    this.mpRoomBarEl.querySelector('#cc-hud-mp-leave')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onLeaveServer?.();
    });
    this.mpRoomBarEl.querySelector('#cc-hud-mp-close-room')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onCloseHostedServer?.();
    });
  }

  private syncOwnerBadge(): void {
    const user = authSystem.getCurrentUser();
    const mp = multiplayerClient.getStatus();
    const verified = ownerBadgeService.isVerifiedOwnerAccount(
      user?.uid,
      user?.username,
      gameSessionManager.isMultiplayer() ? mp.selfIsOwner : false,
    );
    this.ownerBadgeSlot.innerHTML = verified ? ownerBadgeService.renderBadgeHtml(true) : '';
  }

  private showPropertyInviteBanner(evt: PropertyInviteEvent): void {
    this.pendingInvite = evt;
    const ownerTag = ownerBadgeService.isVerifiedOwnerAccount(evt.fromUid, evt.fromName, evt.fromIsOwner)
      ? ownerBadgeService.renderBadgeHtml(true)
      : '';
    this.inviteBannerEl.classList.remove('hidden');
    this.inviteBannerEl.classList.add('flex');
    this.inviteBannerEl.innerHTML = `
      <div class="flex items-center gap-1.5 text-[11px] text-fuchsia-200 font-semibold">
        ${ownerTag}
        <span>${esc(evt.fromName)} invited you to tour <b>${esc(evt.propertyName)}</b></span>
      </div>
      <div class="flex gap-1.5">
        <button id="cc-inv-accept" type="button" class="cc-btn-primary px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer">Accept Visit</button>
        <button id="cc-inv-dismiss" type="button" class="cc-btn-secondary px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer">Dismiss</button>
      </div>
    `;
    this.inviteBannerEl.querySelector('#cc-inv-accept')?.addEventListener('click', () => {
      const deedId = this.pendingInvite?.deedId;
      this.inviteBannerEl.classList.add('hidden');
      this.inviteBannerEl.classList.remove('flex');
      this.pendingInvite = null;
      if (deedId) this.callbacks.onAcceptPropertyInvite?.(deedId);
    });
    this.inviteBannerEl.querySelector('#cc-inv-dismiss')?.addEventListener('click', () => {
      this.inviteBannerEl.classList.add('hidden');
      this.inviteBannerEl.classList.remove('flex');
      this.pendingInvite = null;
    });
  }

  private showServerInviteBanner(inv: ServerInviteItem): void {
    this.pendingServerInvite = inv;
    let pwRequired = inv.hasPassword;
    let errText = '';
    const renderBanner = () => {
      if (!this.pendingServerInvite) return;
      this.inviteBannerEl.classList.remove('hidden');
      this.inviteBannerEl.classList.add('flex');
      this.inviteBannerEl.innerHTML = `
        <div class="text-[11px] text-emerald-200 font-semibold leading-snug">
          Server Invite from <b>@${esc(inv.fromUsername)}</b> -> <b>${esc(inv.roomName)}</b>
          <span class="font-mono-tabular text-sky-300">[${esc(inv.roomCode)}]</span>
        </div>
        ${
          pwRequired
            ? `<input id="cc-sinv-pw" type="password" placeholder="Room password" class="w-full rounded-lg bg-[#060b16] border border-[#22355c] px-2 py-1 text-[11px] text-white" />`
            : ''
        }
        ${errText ? `<div class="text-[10px] text-rose-300">${esc(errText)}</div>` : ''}
        <div class="flex gap-1.5">
          <button id="cc-sinv-accept" type="button" class="cc-btn-primary px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer">Accept &amp; Join</button>
          <button id="cc-sinv-decline" type="button" class="cc-btn-secondary px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer">Decline</button>
        </div>
      `;

      this.inviteBannerEl.querySelector('#cc-sinv-accept')?.addEventListener('click', async () => {
        const pwInput = this.inviteBannerEl.querySelector<HTMLInputElement>('#cc-sinv-pw');
        const pw = pwInput?.value ?? '';
        if (!this.callbacks.onAcceptServerInvite) return;
        const res = await this.callbacks.onAcceptServerInvite(inv, pw);
        if (res.ok) {
          this.pendingServerInvite = null;
          this.inviteBannerEl.classList.add('hidden');
          this.inviteBannerEl.classList.remove('flex');
          this.inviteBannerEl.innerHTML = '';
        } else {
          if (res.requiresPassword) pwRequired = true;
          errText = res.error ?? 'Could not join invited server.';
          renderBanner();
        }
      });

      this.inviteBannerEl.querySelector('#cc-sinv-decline')?.addEventListener('click', () => {
        this.callbacks.onDeclineServerInvite?.(inv.inviteId);
        this.pendingServerInvite = null;
        this.inviteBannerEl.classList.add('hidden');
        this.inviteBannerEl.classList.remove('flex');
        this.inviteBannerEl.innerHTML = '';
      });
    };
    renderBanner();
  }

  public openRemotePlayerMenu(player: RemotePlayerState): void {
    this.modalOpen = true;
    this.refreshPrompt();
    const isOwner = ownerBadgeService.isVerifiedOwnerAccount(
      player.uid,
      player.username,
      player.isOwner,
    );
    const muted = multiplayerClient.isMuted(player.uid);

    this.modalBackdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-sm max-h-[92dvh] overflow-y-auto p-5 text-slate-100 space-y-3">
        <div class="flex items-start justify-between gap-2 border-b border-[#22355c] pb-3">
          <div>
            <div class="flex items-center gap-1.5">
              ${isOwner ? ownerBadgeService.renderBadgeHtml(true) : ''}
              <h3 class="font-display text-lg font-bold text-white">${esc(player.displayName)}</h3>
            </div>
            <div class="text-xs text-slate-400">@${esc(player.username)} · Lv.${player.level}</div>
          </div>
          <button id="cc-rpm-close" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">Close</button>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <button id="cc-rpm-wave" type="button" class="cc-btn-primary py-2 rounded-xl font-bold cursor-pointer">👋 Wave</button>
          <button id="cc-rpm-prof" type="button" class="cc-btn-secondary py-2 rounded-xl font-semibold cursor-pointer">🪪 Profile</button>
          <button id="cc-rpm-add" type="button" class="cc-btn-secondary py-2 rounded-xl font-semibold cursor-pointer">➕ Add Friend</button>
          ${
            player.vehicle
              ? `<button id="cc-rpm-ride" type="button" class="cc-btn-secondary py-2 rounded-xl font-semibold border-orange-400/50 text-orange-200 cursor-pointer">🚗 Ride Along</button>`
              : `<button id="cc-rpm-inv" type="button" class="cc-btn-secondary py-2 rounded-xl font-semibold border-fuchsia-400/50 text-fuchsia-200 cursor-pointer">🏠 Invite Home</button>`
          }
          <button id="cc-rpm-mute" type="button" class="cc-btn-secondary py-2 rounded-xl font-semibold cursor-pointer">${muted ? '🔊 Unmute' : '🔇 Mute'}</button>
          <button id="cc-rpm-block" type="button" class="py-2 rounded-xl bg-rose-500/20 border border-rose-400/50 text-rose-200 font-semibold cursor-pointer">🚫 Block</button>
        </div>
      </div>
    `;
    this.modalBackdrop.style.display = 'flex';

    this.modalBackdrop.querySelector('#cc-rpm-close')?.addEventListener('click', () => this.closeInteractionPanel());
    this.modalBackdrop.querySelector('#cc-rpm-wave')?.addEventListener('click', () => {
      this.callbacks.onQuickEmote?.('wave');
      this.closeInteractionPanel();
    });
    this.modalBackdrop.querySelector('#cc-rpm-prof')?.addEventListener('click', () => {
      this.closeInteractionPanel();
      this.callbacks.onViewRemoteProfile?.(player);
    });
    this.modalBackdrop.querySelector('#cc-rpm-add')?.addEventListener('click', () => {
      this.closeInteractionPanel();
      this.callbacks.onSendFriendRequest?.(player);
    });
    this.modalBackdrop.querySelector('#cc-rpm-ride')?.addEventListener('click', () => {
      this.closeInteractionPanel();
      this.callbacks.onRideRemoteVehicle?.(player);
    });
    this.modalBackdrop.querySelector('#cc-rpm-inv')?.addEventListener('click', () => {
      this.closeInteractionPanel();
      this.callbacks.onInviteRemoteToProperty?.(player);
    });
    this.modalBackdrop.querySelector('#cc-rpm-mute')?.addEventListener('click', () => {
      void multiplayerClient.toggleMuteUser(player.uid);
      this.closeInteractionPanel();
      this.showToast(`Updated mute setting for ${player.displayName}.`);
    });
    this.modalBackdrop.querySelector('#cc-rpm-block')?.addEventListener('click', () => {
      void multiplayerClient.toggleBlockUser(player.uid);
      this.closeInteractionPanel();
      this.showToast(`Blocked ${player.displayName}.`);
    });
  }

  private syncFullscreenIcon(active: boolean): void {
    this.fullscreenBtn.innerHTML = active ? MINIMIZE_ICON : EXPAND_ICON;
    this.fullscreenBtn.setAttribute(
      'aria-label',
      active ? 'Exit Fullscreen' : 'Enter Fullscreen',
    );
    this.fullscreenBtn.title = active ? 'Exit Fullscreen' : 'Enter Fullscreen';
    if (active) {
      this.fullscreenBtn.classList.add('bg-sky-500/25', 'border-sky-300', 'text-white');
    } else {
      this.fullscreenBtn.classList.remove('bg-sky-500/25', 'border-sky-300', 'text-white');
    }
  }

  public showToast(message: string, durationMs = 3400): void {
    if (!saveSystem.getState().settings.notificationsEnabled) return;
    this.toastEl.textContent = message;
    this.toastEl.classList.remove('hidden');
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.add('hidden');
      this.toastTimer = null;
    }, durationMs);
  }

  public setObjectiveBanner(
    banner: {
      title: string;
      detail: string;
      isTimed?: boolean;
    } | null,
  ): void {
    if (!banner) {
      this.objectiveWrapEl.classList.add('hidden');
      this.objectiveWrapEl.classList.remove('flex');
      return;
    }
    this.objectiveWrapEl.classList.remove('hidden');
    this.objectiveWrapEl.classList.add('flex');
    if (this.objectiveTitleEl.textContent !== banner.title) {
      this.objectiveTitleEl.textContent = banner.title;
    }
    if (this.objectiveDetailEl.textContent !== banner.detail) {
      this.objectiveDetailEl.textContent = banner.detail;
    }
    this.objectiveTitleEl.className = banner.isTimed
      ? 'font-mono-tabular text-[10px] font-bold text-emerald-300 truncate'
      : 'font-mono-tabular text-[10px] font-bold text-amber-300 truncate';
    if (banner.isTimed) {
      this.objectiveCancelBtn.classList.remove('hidden');
    } else {
      this.objectiveCancelBtn.classList.add('hidden');
    }
  }

  public updateMiniMap(
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
    this.miniMap?.update(
      playerX,
      playerY,
      direction,
      npcPositions,
      trafficPositions,
      personalCarPos,
      waypointTarget,
      policePositions,
      eventBeaconPos,
      questPins,
    );
  }

  public setClockDisplay(label: string): void {
    if (this.clockEl.textContent !== label) {
      this.clockEl.textContent = label;
    }
  }

  public setWeatherDisplay(label: string): void {
    if (this.weatherEl.textContent !== label) {
      this.weatherEl.textContent = label;
    }
  }

  public setWantedStars(stars: number, evadeSec = 0): void {
    if (stars <= 0) {
      this.wantedEl.classList.add('hidden');
      return;
    }
    this.wantedEl.classList.remove('hidden');
    const txt = `★${stars}${evadeSec > 0 ? ` · ${evadeSec}s` : ''}`;
    if (this.wantedEl.textContent !== txt) {
      this.wantedEl.textContent = txt;
    }
  }

  public setPlayerInfo(appearanceId: string, playerName: string): void {
    const save = saveSystem.getState();
    const preset =
      CHARACTER_PRESETS.find((p) => p.id === appearanceId) ?? CHARACTER_PRESETS[0];
    this.avatarImg.src = renderCharacterPortraitDataUrl(
      preset,
      save.equippedClothing,
      save.hairOverride,
      save.appearanceConfig,
    );
    this.playerNameEl.textContent = playerName;
  }

  public setDistrictName(name: string): void {
    if (this.districtEl.textContent !== name) {
      this.districtEl.textContent = name;
    }
  }

  public setTouchVisible(visible: boolean): void {
    this.isTouchVisible = visible;
    this.refreshPrompt();
  }

  public setSittingState(sitting: boolean): void {
    if (this.isSitting === sitting) return;
    this.isSitting = sitting;
    this.refreshPrompt();
  }

  public setSleepingState(sleeping: boolean): void {
    if (this.isSleeping === sleeping) return;
    this.isSleeping = sleeping;
    this.refreshPrompt();
  }

  public setDrivingState(vehicleName: string | null, speed = 0, condition = 100): void {
    const cleanSpeed = Math.round(speed);
    const cleanCond = Math.round(condition);
    if (
      this.drivingVehicleName === vehicleName &&
      Math.abs(this.drivingSpeed - cleanSpeed) < 3 &&
      this.drivingCondition === cleanCond
    ) {
      return;
    }
    this.drivingVehicleName = vehicleName;
    this.drivingSpeed = cleanSpeed;
    this.drivingCondition = cleanCond;
    this.refreshPrompt();
  }

  public setInteractionTarget(target: InteractiveObjectData | null): void {
    if (this.currentTarget?.id === target?.id) return;
    this.currentTarget = target;
    this.refreshPrompt();
  }

  private refreshPrompt(): void {
    if (this.modalOpen) {
      this.promptEl.style.display = 'none';
      return;
    }

    if (this.isSleeping) {
      this.promptEl.style.display = 'flex';
      this.promptEl.innerHTML = `
        <span class="px-2 py-0.5 rounded bg-indigo-400 text-[#06101f] font-mono-tabular text-xs font-bold">${this.isTouchVisible ? 'WAKE UP' : 'E'}</span>
        <span>Resting in Bed · Energy 100% · Wake Up</span>
      `;
      return;
    }

    if (this.drivingVehicleName) {
      this.promptEl.style.display = 'flex';
      this.promptEl.innerHTML = `
        <span class="px-2 py-0.5 rounded bg-amber-400 text-[#06101f] font-mono-tabular text-xs font-bold">${this.isTouchVisible ? 'EXIT' : 'E'}</span>
        <span>Exit ${esc(this.drivingVehicleName)} · ${this.drivingSpeed} km/h · Cond ${this.drivingCondition}%</span>
      `;
      return;
    }

    if (this.isSitting) {
      this.promptEl.style.display = 'flex';
      this.promptEl.innerHTML = `
        <span class="px-2 py-0.5 rounded bg-sky-500 text-[#06101f] font-mono-tabular text-xs font-bold">${this.isTouchVisible ? 'USE' : 'E'}</span>
        <span>Stand up from seat</span>
      `;
      return;
    }

    if (!this.currentTarget) {
      this.promptEl.style.display = 'none';
      return;
    }

    this.promptEl.style.display = 'flex';
    this.promptEl.innerHTML = `
      <span class="px-2 py-0.5 rounded bg-sky-500 text-[#06101f] font-mono-tabular text-xs font-bold">${this.isTouchVisible ? 'TAP' : 'E'}</span>
      <span>${esc(this.currentTarget.promptLabel)}</span>
    `;
  }

  public openInteractionPanel(target: InteractiveObjectData): void {
    this.modalOpen = true;
    this.refreshPrompt();

    let feedbackMsg = '';
    let feedbackErr = false;
    let npcStep = 1;

    const render = () => {
      const save = saveSystem.getState();
      const postcardClaimed =
        target.kind === 'mailbox' && economySystem.hasClaimedReward('mailbox_welcome_postcard');
      const actionDisabled = target.kind === 'mailbox' && postcardClaimed;
      const computedActionLabel =
        target.kind === 'mailbox' && postcardClaimed
          ? 'Welcome Postcard Collected'
          : target.actionLabel;

      let npcMissionsHtml = '';
      if (target.kind === 'npc' && this.callbacks.onMissionAction) {
        const rawNpcId = target.id.replace(/^int_/, '');
        const npcMissions = getNpcMissions(rawNpcId);
        if (npcMissions.length > 0) {
          const acceptedIds = new Set(economySystem.getAcceptedMissionIds());
          const activeId = economySystem.getActiveMissionId();
          npcMissionsHtml = `
            <div class="mb-4 border-t border-[#22355c] pt-3 space-y-2 max-h-52 overflow-y-auto pr-1">
              <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Available City Missions
              </div>
              ${npcMissions
                .map((m) => {
                  const claimed = save.claimedRewards.includes(`mission_reward_${m.id}`);
                  const cur = m.getProgress(save);
                  const ready = !claimed && cur >= m.goal;
                  const accepted = acceptedIds.has(m.id);
                  const tracked = activeId === m.id;
                  return `
                    <div class="rounded-xl bg-[#091020] border ${
                      ready ? 'border-emerald-400/60' : tracked ? 'border-amber-400/60' : 'border-[#22355c]'
                    } p-2.5 space-y-1.5">
                      <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                          <div class="font-display text-xs font-bold text-white">${esc(m.title)}</div>
                          <div class="text-[11px] text-slate-400">${esc(m.description)}</div>
                        </div>
                        <span class="font-mono-tabular text-[10px] font-bold text-amber-300 shrink-0">+${m.rewardCoins}c</span>
                      </div>
                      <div class="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                        <span class="font-mono-tabular text-[10px] ${ready ? 'text-emerald-300 font-bold' : 'text-slate-300'}">
                          ${claimed ? 'Completed & Claimed' : `Progress: ${cur}/${m.goal}`}
                        </span>
                        <div class="flex flex-wrap items-center gap-1.5">
                          ${
                            claimed
                              ? `<span class="text-[10px] font-bold text-emerald-300">Done</span>`
                              : ready
                                ? `<button type="button" data-mact="claim" data-mid="${m.id}" class="cc-npc-mact cc-btn-primary px-2.5 py-1 rounded-lg text-[10px] font-bold min-h-[30px] cursor-pointer">Claim Reward</button>`
                                : !accepted
                                  ? `<button type="button" data-mact="accept" data-mid="${m.id}" class="cc-npc-mact cc-btn-primary px-2.5 py-1 rounded-lg text-[10px] font-bold min-h-[30px] cursor-pointer">Accept Mission</button>`
                                  : `
                                    ${
                                      tracked
                                        ? `<button type="button" data-mact="pause" data-mid="${m.id}" class="cc-npc-mact cc-btn-secondary px-2 py-1 rounded-lg text-[10px] font-semibold min-h-[30px] cursor-pointer">Pause</button>`
                                        : `<button type="button" data-mact="accept" data-mid="${m.id}" class="cc-npc-mact cc-btn-secondary px-2 py-1 rounded-lg text-[10px] font-semibold min-h-[30px] border-sky-400/50 text-sky-200 cursor-pointer">Track</button>`
                                    }
                                    <button type="button" data-mact="abandon" data-mid="${m.id}" class="cc-npc-mact px-2 py-1 rounded-lg text-[10px] font-semibold min-h-[30px] bg-rose-500/15 border border-rose-400/40 text-rose-200 cursor-pointer">Abandon</button>
                                  `
                          }
                        </div>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          `;
        }
      }

      this.modalBackdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-6 text-slate-100">
          <div class="flex items-start justify-between gap-3 border-b border-[#22355c] pb-3 mb-4">
            <div>
              <div class="text-xs font-semibold text-sky-300 mb-0.5">${esc(target.subtitle)}</div>
              <h3 class="font-display text-xl font-bold text-white">${esc(target.title)}</h3>
            </div>
            <button id="cc-int-close" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
              Close
            </button>
          </div>

          <p class="text-sm text-slate-300 leading-relaxed mb-4">
            ${esc(target.description)}
          </p>

          ${
            target.details && target.details.length > 0
              ? `<ul class="space-y-1.5 mb-4 border-t border-[#22355c] pt-3">
                  ${target.details
                    .map(
                      (d) =>
                        `<li class="text-xs text-slate-300 flex items-start gap-2"><span class="text-sky-400">·</span><span>${esc(d)}</span></li>`,
                    )
                    .join('')}
                </ul>`
              : ''
          }

          ${npcMissionsHtml}

          ${
            feedbackMsg
              ? `<div class="mb-4 px-3 py-2 rounded-lg border text-xs ${
                  feedbackErr
                    ? 'bg-rose-500/15 border-rose-400/40 text-rose-200'
                    : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                }">${esc(feedbackMsg)}</div>`
              : ''
          }

          <div class="flex items-center justify-end gap-2.5">
            ${
              computedActionLabel
                ? `<button id="cc-int-action" type="button" ${actionDisabled ? 'disabled' : ''} class="${
                    actionDisabled
                      ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 px-4 py-2.5 rounded-xl text-xs font-bold min-h-[44px]'
                      : 'cc-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer'
                  }">${esc(computedActionLabel)}</button>`
                : ''
            }
          </div>
        </div>
      `;

      this.modalBackdrop.querySelector('#cc-int-close')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.closeInteractionPanel();
      });

      this.modalBackdrop.querySelectorAll<HTMLButtonElement>('.cc-npc-mact').forEach((btn) => {
        btn.addEventListener('click', () => {
          const act = btn.dataset.mact as 'accept' | 'pause' | 'abandon' | 'claim' | undefined;
          const mid = btn.dataset.mid;
          if (!act || !mid || !this.callbacks.onMissionAction) return;
          const res = this.callbacks.onMissionAction(act, mid);
          if (res.ok) {
            if (act === 'claim') audioSystem.playCoin();
            else if (act === 'accept') audioSystem.playInteract();
            else audioSystem.playButtonClick();
            feedbackErr = false;
          } else {
            audioSystem.playError();
            feedbackErr = true;
          }
          feedbackMsg = res.message;
          render();
        });
      });

      this.modalBackdrop.querySelector('#cc-int-action')?.addEventListener('click', () => {
        if (target.kind === 'fountain') {
          audioSystem.playSplash();
          this.callbacks.onFountainCoinToss?.(target.x, target.y);
          const nextE = economySystem.restoreEnergy(10);
          if (!economySystem.hasClaimedReward('fountain_lucky_coin')) {
            const bal = economySystem.awardCoins(
              15,
              'Fountain Lucky Basin Find',
              'fountain_lucky_coin',
            );
            audioSystem.playCoin();
            feedbackMsg = `Cool mist refreshed +10 Energy (${nextE}/100) and uncovered a lucky +15c fountain coin! Balance: ${bal}c.`;
          } else {
            feedbackMsg = `Cool fountain spray refreshed +10 Energy (${nextE}/100) while shimmering ripples dance across the basin.`;
          }
          render();
        } else if (target.kind === 'mailbox') {
          if (economySystem.hasClaimedReward('mailbox_welcome_postcard')) return;
          const bal = economySystem.awardCoins(
            10,
            'Neighborhood Postbox Welcome Card',
            'mailbox_welcome_postcard',
          );
          audioSystem.playCoin();
          feedbackMsg = `Collected the City Welcome Postcard and +10 Coins! Balance: ${bal}c.`;
          render();
        } else if (target.kind === 'district_sign') {
          audioSystem.playButtonClick();
          this.closeInteractionPanel();
          this.callbacks.onOpenMap?.();
        } else if (target.kind === 'clothing' && this.callbacks.onCycleOutfit) {
          audioSystem.playInteract();
          const res = this.callbacks.onCycleOutfit();
          feedbackMsg = `Equipped "${res.presetName}" street style and saved to your profile!`;
          render();
        } else if (target.kind === 'npc' && this.callbacks.onNpcChatMore) {
          audioSystem.playButtonClick();
          const nextLine = this.callbacks.onNpcChatMore(target.id, npcStep++);
          if (nextLine) {
            feedbackMsg = nextLine;
            render();
          }
        }
      });
    };

    render();
    this.modalBackdrop.style.display = 'flex';
  }

  public isInteractionPanelOpen(): boolean {
    return this.modalOpen;
  }

  public closeInteractionPanel(): void {
    this.modalOpen = false;
    this.modalBackdrop.style.display = 'none';
    this.refreshPrompt();
  }

  public destroy(): void {
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }
    this.unsubFullscreen?.();
    this.unsubEconomy?.();
    this.unsubCloudSync?.();
    this.unsubMpStatus?.();
    this.unsubInvite?.();
    this.unsubServerInvite?.();
    this.miniMap?.destroy();
    this.modalBackdrop.remove();
    this.root.remove();
  }
}
