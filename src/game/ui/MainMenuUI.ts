import {
  CHARACTER_PRESETS,
  GAME_TAGLINE,
  GAME_VERSION,
} from '@/src/config/constants';
import {renderCharacterPortraitDataUrl} from '@/src/game/graphics/PixelArtGenerator';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {authSystem} from '@/src/game/systems/AuthSystem';
import {cloudSaveManager} from '@/src/game/systems/CloudSaveManager';
import {gameSessionManager} from '@/src/game/systems/GameSessionManager';
import {ownerBadgeService} from '@/src/game/systems/OwnerBadgeService';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {CloudSyncState, GameSettings} from '@/src/game/types/gameTypes';
import {AccountModal} from '@/src/game/ui/AccountModal';
import {CharacterCreatorModal} from '@/src/game/ui/CharacterCreatorModal';
import {FriendsModal} from '@/src/game/ui/FriendsModal';
import {MultiplayerHubModal} from '@/src/game/ui/MultiplayerHubModal';
import {SettingsModal} from '@/src/game/ui/SettingsModal';

export interface MainMenuCallbacks {
  onPlayStoryMode: () => void;
  onPlayMultiplayer: () => void;
  onSettingsChanged: (settings: GameSettings) => void;
}

const esc = (str: string): string =>
  String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

function formatSyncBadge(sync: CloudSyncState): {text: string; cls: string; clickable: boolean} {
  if (!sync.uid) {
    return {
      text: 'Guest · Local Backup Only',
      cls: 'bg-slate-800/70 border-slate-600/50 text-slate-300',
      clickable: false,
    };
  }
  if (sync.status === 'saving') {
    return {
      text: 'SAVING TO CLOUD...',
      cls: 'bg-sky-500/20 border-sky-400/60 text-sky-200',
      clickable: false,
    };
  }
  if (sync.status === 'saved') {
    const timeStr = sync.lastSavedAtMs
      ? new Date(sync.lastSavedAtMs).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
      : 'Now';
    return {
      text: `CLOUD SAVED · ${timeStr}`,
      cls: 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200',
      clickable: false,
    };
  }
  if (sync.status === 'offline' || sync.status === 'error') {
    return {
      text: sync.status === 'offline' ? 'OFFLINE · RETRY SYNC' : 'SYNC ERROR · RETRY',
      cls: 'bg-rose-500/20 border-rose-400/60 text-rose-200 hover:border-rose-300',
      clickable: true,
    };
  }
  return {
    text: 'LOCAL BACKUP · SYNC',
    cls: 'bg-amber-500/15 border-amber-400/50 text-amber-200 hover:border-amber-300',
    clickable: true,
  };
}

export class MainMenuUI {
  private readonly root: HTMLDivElement;
  private readonly subModal: HTMLDivElement;
  private readonly settingsModal: SettingsModal;
  private readonly characterCreator: CharacterCreatorModal;
  private readonly accountModal: AccountModal;
  private readonly friendsModal: FriendsModal;
  private readonly hubModal: MultiplayerHubModal;
  private keyListener: ((e: KeyboardEvent) => void) | null = null;
  private unsubAuth: (() => void) | null = null;
  private unsubSync: (() => void) | null = null;
  private loggingOut = false;
  private enteringCity = false;
  private destroyed = false;

  constructor(parent: HTMLElement, private readonly callbacks: MainMenuCallbacks) {
    this.root = document.createElement('div');
    this.root.className =
      'ui-interactive fixed inset-0 z-30 flex flex-col justify-between p-4 sm:p-6 md:p-10 bg-gradient-to-r from-[#060b16]/92 via-[#0b1221]/78 to-[#060b16]/45 overflow-y-auto';
    parent.appendChild(this.root);

    this.subModal = document.createElement('div');
    this.subModal.className =
      'ui-interactive fixed inset-0 z-40 hidden items-center justify-center bg-[#040812]/82 p-4';
    parent.appendChild(this.subModal);

    this.settingsModal = new SettingsModal(parent, {
      onSettingsChanged: (settings) => this.callbacks.onSettingsChanged(settings),
      onClose: () => {
        void cloudSaveManager.flushNow();
        this.renderMain();
      },
      onSaveReset: () => this.renderMain(),
    });

    this.characterCreator = new CharacterCreatorModal(parent, {
      onSaved: () => {
        void cloudSaveManager.flushNow();
        this.renderMain();
      },
      onEnterCity: () => {
        void cloudSaveManager.flushNow();
        this.triggerStoryMode();
      },
      onClose: () => this.renderMain(),
    });

    this.accountModal = new AccountModal(parent, {
      onAuthenticatedAndEnterCity: () => {
        this.renderMain();
      },
      onAuthChanged: () => this.renderMain(),
      onClose: () => this.renderMain(),
    });

    this.friendsModal = new FriendsModal(parent, {
      onClose: () => this.renderMain(),
    });

    this.hubModal = new MultiplayerHubModal(parent, {
      onLaunchMultiplayerCity: () => {
        this.triggerMultiplayerMode();
      },
      onOpenFriends: () => {
        this.openFriends();
      },
      onRequireLogin: () => {
        this.hubModal.close();
        this.accountModal.open('login', {
          ctaLabel: 'OPEN MULTIPLAYER HUB',
          onContinue: () => this.openMultiplayerHub(),
        });
      },
      onClose: () => this.renderMain(),
    });

    this.unsubAuth = authSystem.subscribe(() => {
      void ownerBadgeService.refreshOwnerConfig().then(() => {
        if (!this.destroyed) this.renderMain();
      });
      this.renderMain();
    });
    this.unsubSync = cloudSaveManager.subscribe(() => {
      this.renderMain();
    });

    this.renderMain();

    this.keyListener = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (inInput) {
        if (e.code === 'Escape') {
          if (this.friendsModal.isOpen()) this.friendsModal.close();
          else if (this.hubModal.isOpen()) this.hubModal.close();
          else if (this.accountModal.isOpen()) this.accountModal.close();
        }
        return;
      }

      if (
        this.friendsModal.isOpen() ||
        this.hubModal.isOpen() ||
        this.settingsModal.isOpen() ||
        this.characterCreator.isOpen() ||
        this.accountModal.isOpen() ||
        this.subModal.style.display === 'flex'
      ) {
        if (e.code === 'Escape') {
          if (this.friendsModal.isOpen()) this.friendsModal.close();
          else if (this.hubModal.isOpen()) this.hubModal.close();
          else if (this.settingsModal.isOpen()) this.settingsModal.close();
          else if (this.characterCreator.isOpen()) this.characterCreator.close();
          else if (this.accountModal.isOpen()) this.accountModal.close();
          else this.subModal.style.display = 'none';
        }
      }
    };
    window.addEventListener('keydown', this.keyListener);
  }

  public openMultiplayerHub(): void {
    if (this.destroyed || this.enteringCity || this.loggingOut) return;
    if (!authSystem.getCurrentUser()) {
      this.accountModal.open('login', {
        ctaLabel: 'OPEN MULTIPLAYER HUB',
        onContinue: () => this.openMultiplayerHub(),
      });
      return;
    }
    this.hubModal.open();
  }

  public openFriends(): void {
    if (this.destroyed || this.enteringCity || this.loggingOut) return;
    if (!authSystem.getCurrentUser()) {
      this.accountModal.open('login', {
        ctaLabel: 'OPEN FRIENDS',
        onContinue: () => this.openFriends(),
      });
      return;
    }
    this.friendsModal.open('list');
  }

  private triggerStoryMode(): void {
    if (this.destroyed || this.enteringCity || this.loggingOut) return;
    this.enteringCity = true;
    gameSessionManager.enterStoryMode();
    this.callbacks.onPlayStoryMode();
  }

  private triggerMultiplayerMode(): void {
    if (this.destroyed || this.enteringCity || this.loggingOut) return;
    if (!gameSessionManager.isMultiplayer() || !gameSessionManager.getPendingJoin()) {
      return;
    }
    this.enteringCity = true;
    this.callbacks.onPlayMultiplayer();
  }

  private renderMain(): void {
    if (this.destroyed) return;
    const save = saveSystem.getState();
    const activePreset =
      CHARACTER_PRESETS.find((p) => p.id === save.appearanceId) ?? CHARACTER_PRESETS[0];
    const portrait = renderCharacterPortraitDataUrl(
      activePreset,
      save.equippedClothing,
      save.hairOverride,
      save.appearanceConfig,
    );
    const genderLabel = save.appearanceConfig.gender === 'female' ? 'Female' : 'Male';
    const currentUser = authSystem.getCurrentUser();
    const syncState = cloudSaveManager.getSyncState();
    const syncBadge = formatSyncBadge(syncState);
    const isVerifiedOwner = ownerBadgeService.isVerifiedOwnerAccount(
      currentUser?.uid,
      currentUser?.username,
    );
    const storyCompleted = Boolean(save.story?.campaignCompleted);

    this.root.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-lg bg-[#131f38] border border-sky-400/40 flex items-center justify-center overflow-hidden shrink-0">
            ${portrait ? `<img src="${portrait}" alt="${esc(save.playerName)}" class="w-10 h-10 object-contain" style="image-rendering: pixelated;" />` : ''}
          </div>
          <div class="text-left">
            <div class="text-xs text-slate-400 flex flex-wrap items-center gap-1.5">
              ${isVerifiedOwner ? ownerBadgeService.renderBadgeHtml(true) : ''}
              <span>${currentUser ? `@${esc(currentUser.username)}` : 'Guest Resident'}</span>
              <span>·</span>
              <span class="font-mono-tabular text-sky-300 font-semibold">Lv.${save.progression?.level ?? 1} ${esc(save.progression?.selectedTitle ?? 'New Arrival')}</span>
              <span>·</span>
              <span class="font-mono-tabular text-amber-300 font-semibold">${save.coins} Coins</span>
            </div>
            <div class="text-sm font-semibold text-white">${esc(save.playerName)} · ${genderLabel} (${esc(activePreset.name)})</div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            id="cc-menu-sync"
            type="button"
            ${syncBadge.clickable ? '' : 'disabled'}
            class="px-2.5 py-1.5 rounded-lg border text-[11px] font-mono-tabular font-semibold ${syncBadge.cls} ${syncBadge.clickable ? 'cursor-pointer' : 'cursor-default'}"
          >
            ${syncBadge.text}
          </button>
          ${
            currentUser
              ? `<button id="cc-menu-logout" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] border-rose-500/40 text-rose-200 hover:border-rose-400 cursor-pointer" ${this.loggingOut ? 'disabled' : ''}>
                  ${this.loggingOut ? 'Signing Out...' : 'LOG OUT'}
                </button>`
              : `<button id="cc-menu-signin-top" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] border-sky-400/60 text-sky-200 cursor-pointer">
                  Account Login
                </button>`
          }
          <span class="hidden sm:inline text-xs font-mono-tabular text-slate-400 ml-1">${GAME_VERSION}</span>
        </div>
      </div>

      <div class="max-w-2xl my-auto py-4">
        <div class="mb-3">
          <div class="font-mono-tabular text-[10px] font-bold tracking-[0.28em] text-amber-300/90 uppercase mb-1">
            NOVACORE GAMES PRESENTS
          </div>
          <svg viewBox="0 0 460 72" class="w-full max-w-[440px] h-auto drop-shadow-[0_6px_18px_rgba(14,165,233,0.3)]" role="img" aria-label="CHAOS CITY">
            <defs>
              <linearGradient id="ccTitleGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#f8fafc" />
                <stop offset="55%" stop-color="#bae6fd" />
                <stop offset="100%" stop-color="#38bdf8" />
              </linearGradient>
            </defs>
            <rect x="2" y="10" width="8" height="50" fill="#0ea5e9" rx="2" />
            <text x="22" y="54" font-family="Outfit, sans-serif" font-weight="800" font-size="52" letter-spacing="3" fill="url(#ccTitleGrad)">CHAOS CITY</text>
          </svg>
          <p class="font-display text-sm md:text-base font-semibold tracking-[0.22em] text-sky-300 mt-1">
            ${GAME_TAGLINE}
          </p>
        </div>

        <p class="text-sm text-slate-300 max-w-lg mb-5 leading-relaxed">
          ${
            currentUser
              ? `Welcome back, <span class="text-sky-300 font-semibold">@${esc(currentUser.username)}</span>. Choose <b class="text-white">Story Mode</b> for your solo campaign at The Mission House${storyCompleted ? ' (Lead Gang Leader)' : ''}, or open <b class="text-emerald-300">Multiplayer</b> for live public &amp; private rooms.`
              : `Choose <b class="text-white">Story Mode</b> for a pure single-player campaign, or sign in to unlock <b class="text-emerald-300">Multiplayer</b> rooms, room codes, friends, and cloud saves.`
          }
        </p>

        <!-- Primary Mode Selection -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mb-3.5">
          <button id="cc-menu-story" type="button" class="cc-btn-primary px-5 py-4 rounded-xl text-left min-h-[68px] cursor-pointer flex items-center justify-between gap-3">
            <div>
              <div class="font-display font-extrabold text-base tracking-wide text-[#06101f]">STORY MODE</div>
              <div class="text-[11px] font-semibold text-[#0a2540]">Single-Player Campaign · Offline Ready</div>
            </div>
            <span class="text-xl leading-none">📖</span>
          </button>
          <button id="cc-menu-multiplayer" type="button" class="px-5 py-4 rounded-xl text-left min-h-[68px] cursor-pointer bg-gradient-to-br from-emerald-500/25 to-cyan-500/20 hover:from-emerald-500/35 hover:to-cyan-500/30 border border-emerald-400/60 hover:border-emerald-300 transition flex items-center justify-between gap-3">
            <div>
              <div class="font-display font-extrabold text-base tracking-wide text-emerald-200">MULTIPLAYER</div>
              <div class="text-[11px] text-emerald-100/80">${currentUser ? 'Servers, Room Codes & Co-op' : 'Sign In for Live City Rooms'}</div>
            </div>
            <span class="text-xl leading-none">🌐</span>
          </button>
        </div>

        <!-- Secondary Utility Buttons -->
        <div class="flex flex-wrap gap-2.5 max-w-xl">
          ${
            !currentUser
              ? `<button id="cc-menu-auth" type="button" class="cc-btn-secondary px-4 py-2.5 rounded-xl font-display font-semibold text-xs sm:text-sm tracking-wide min-h-[44px] border-sky-400/60 text-sky-200 cursor-pointer whitespace-nowrap">
                  LOGIN / CREATE ACCOUNT
                </button>`
              : ''
          }
          <button id="cc-menu-friends" type="button" class="cc-btn-secondary px-4 py-2.5 rounded-xl font-display font-semibold text-xs sm:text-sm tracking-wide min-h-[44px] border-cyan-400/50 text-cyan-200 cursor-pointer whitespace-nowrap">
            FRIENDS
          </button>
          <button id="cc-menu-char" type="button" class="cc-btn-secondary px-4 py-2.5 rounded-xl font-display font-semibold text-xs sm:text-sm tracking-wide min-h-[44px] cursor-pointer whitespace-nowrap">
            CHARACTER
          </button>
          ${
            currentUser
              ? `<button id="cc-menu-newgame" type="button" class="cc-btn-secondary px-4 py-2.5 rounded-xl font-display font-semibold text-xs sm:text-sm tracking-wide min-h-[44px] border-amber-400/40 text-amber-200 hover:border-amber-300 cursor-pointer whitespace-nowrap">
                  NEW GAME
                </button>`
              : ''
          }
          <button id="cc-menu-settings" type="button" class="cc-btn-secondary px-4 py-2.5 rounded-xl font-display font-semibold text-xs sm:text-sm tracking-wide min-h-[44px] cursor-pointer whitespace-nowrap">
            SETTINGS
          </button>
          <button id="cc-menu-about" type="button" class="cc-btn-secondary px-4 py-2.5 rounded-xl font-display font-semibold text-xs sm:text-sm tracking-wide min-h-[44px] cursor-pointer whitespace-nowrap">
            ABOUT
          </button>
        </div>
      </div>

      <div class="text-xs text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>WASD / Arrows Move</span>
        <span aria-hidden="true">·</span>
        <span>Shift Run</span>
        <span aria-hidden="true">·</span>
        <span>E Interact</span>
        <span aria-hidden="true">·</span>
        <span>I Bag</span>
        <span aria-hidden="true">·</span>
        <span>M Map</span>
        <span aria-hidden="true">·</span>
        <span>Esc Pause</span>
      </div>
    `;

    this.root.querySelector('#cc-menu-story')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.triggerStoryMode();
    });
    this.root.querySelector('#cc-menu-multiplayer')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.openMultiplayerHub();
    });
    this.root.querySelector('#cc-menu-friends')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.openFriends();
    });
    this.root.querySelector('#cc-menu-auth')?.addEventListener('click', () => {
      if (this.destroyed || this.enteringCity) return;
      audioSystem.playButtonClick();
      this.accountModal.open('login', {
        ctaLabel: 'RETURN TO MENU',
        onContinue: () => this.renderMain(),
      });
    });
    this.root.querySelector('#cc-menu-signin-top')?.addEventListener('click', () => {
      if (this.destroyed || this.enteringCity) return;
      audioSystem.playButtonClick();
      this.accountModal.open('login', {
        ctaLabel: 'RETURN TO MENU',
        onContinue: () => this.renderMain(),
      });
    });
    this.root.querySelector('#cc-menu-char')?.addEventListener('click', () => {
      if (this.destroyed || this.enteringCity) return;
      audioSystem.playButtonClick();
      this.characterCreator.open();
    });
    this.root.querySelector('#cc-menu-newgame')?.addEventListener('click', () => {
      if (this.destroyed || this.enteringCity) return;
      audioSystem.playButtonClick();
      this.openNewGameWarningModal();
    });
    this.root.querySelector('#cc-menu-logout')?.addEventListener('click', async () => {
      if (this.destroyed || this.loggingOut || this.enteringCity) return;
      audioSystem.playButtonClick();
      this.loggingOut = true;
      this.renderMain();
      try {
        await authSystem.logout();
      } catch (err) {
        console.error('[CHAOS CITY MainMenu] Logout failed:', err);
      } finally {
        this.loggingOut = false;
        if (!this.destroyed) {
          this.renderMain();
        }
      }
    });
    this.root.querySelector('#cc-menu-sync')?.addEventListener('click', () => {
      if (!syncBadge.clickable) return;
      audioSystem.playButtonClick();
      void cloudSaveManager.flushNow(true);
    });
    this.root.querySelector('#cc-menu-settings')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.settingsModal.open();
    });
    this.root.querySelector('#cc-menu-about')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.openAboutModal();
    });
  }

  private openNewGameWarningModal(): void {
    const user = authSystem.getCurrentUser();
    let busy = false;
    let errText = '';

    const renderModal = () => {
      this.subModal.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-6 text-slate-100">
          <div class="border-b border-[#22355c] pb-3 mb-4">
            <div class="text-xs font-semibold text-amber-300 uppercase tracking-wider">Confirmation Required</div>
            <h2 class="font-display text-xl font-bold text-white mt-0.5">Start a New Game?</h2>
          </div>

          <p class="text-sm text-slate-300 leading-relaxed mb-4">
            This will reset your character customization, coins back to starter balance, purchased clothing, inventory, outfit presets, story progression, achievements, and world position${user ? ` on account <strong class="text-white">@${esc(user.username)}</strong>` : ''}. Your username and account remain active.
          </p>

          ${
            errText
              ? `<div class="mb-4 px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-400/50 text-xs text-rose-200">${esc(errText)}</div>`
              : ''
          }

          <div class="flex items-center justify-end gap-2.5">
            <button id="cc-ng-cancel" type="button" class="cc-btn-secondary px-4 py-2.5 rounded-xl text-xs font-semibold min-h-[42px] cursor-pointer" ${busy ? 'disabled' : ''}>
              Cancel
            </button>
            <button id="cc-ng-confirm" type="button" class="px-4 py-2.5 rounded-xl text-xs font-bold min-h-[42px] bg-rose-600 hover:bg-rose-500 text-white cursor-pointer" ${busy ? 'disabled' : ''}>
              ${busy ? 'Resetting Save...' : 'Confirm New Game'}
            </button>
          </div>
        </div>
      `;

      this.subModal.querySelector('#cc-ng-cancel')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.subModal.style.display = 'none';
      });

      this.subModal.querySelector('#cc-ng-confirm')?.addEventListener('click', async () => {
        if (busy || this.destroyed) return;
        audioSystem.playButtonClick();
        busy = true;
        errText = '';
        renderModal();
        try {
          const res = await authSystem.startNewGameForAccount();
          if (this.destroyed) return;
          busy = false;
          if (!res.ok && res.message) {
            errText = res.message;
            renderModal();
            return;
          }
          this.subModal.style.display = 'none';
          this.renderMain();
          this.triggerStoryMode();
        } catch (err) {
          if (this.destroyed) return;
          busy = false;
          errText = err instanceof Error ? err.message : 'Unable to start a new game.';
          renderModal();
        }
      });
    };

    renderModal();
    this.subModal.style.display = 'flex';
  }

  private openAboutModal(): void {
    this.subModal.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-lg max-h-[92dvh] overflow-y-auto p-6 text-slate-100">
        <div class="flex items-center justify-between border-b border-[#22355c] pb-3 mb-4">
          <div>
            <h2 class="font-display text-xl font-bold text-white">About CHAOS CITY</h2>
            <p class="text-xs font-mono-tabular text-sky-300">NOVACORE GAMES · Version ${GAME_VERSION}</p>
          </div>
          <button id="cc-about-close" type="button" class="cc-btn-secondary px-4 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
            Close
          </button>
        </div>

        <div class="space-y-4 text-sm text-slate-300 leading-relaxed">
          <p>
            CHAOS CITY is an open-world pixel-art city by NOVACORE GAMES featuring two separate modes: a single-player <strong class="text-white">Story Mode</strong> anchored at The Mission House, and an online <strong class="text-emerald-300">Multiplayer</strong> city with public servers, private invite-only rooms, room codes, and friends.
          </p>
          <div>
            <h3 class="font-display font-semibold text-white mb-1.5">Chaos City Districts (11 Districts · 36 Venues)</h3>
            <p class="text-xs text-slate-300">
              Downtown · Central Park · Shopping District · Residential Neighborhood · Entertainment Zone · Waterfront · Airport &amp; Transit · Medical &amp; Safety · Industrial Harbor · Hillside Estates · Country Outskirts
            </p>
          </div>
          <div>
            <h3 class="font-display font-semibold text-white mb-1.5">Controls</h3>
            <ul class="text-xs text-slate-300 space-y-1">
              <li>Desktop: WASD or Arrow keys to move, Shift to run, E or Space to interact/enter buildings, I for Bag, M for Map, J for Journal, P for Phone, Esc to pause.</li>
              <li>Android / Touch: Bottom-left virtual joystick to move, RUN and USE buttons on bottom-right, HUD buttons for Bag, Map, Phone, Journal, Mini-Games, and Fullscreen.</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    this.subModal.querySelector('#cc-about-close')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.subModal.style.display = 'none';
    });
    this.subModal.style.display = 'flex';
  }

  public destroy(): void {
    this.destroyed = true;
    if (this.keyListener) {
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = null;
    }
    this.unsubAuth?.();
    this.unsubSync?.();
    this.friendsModal.destroy();
    this.hubModal.destroy();
    this.accountModal.destroy();
    this.characterCreator.destroy();
    this.settingsModal.destroy();
    this.subModal.remove();
    this.root.remove();
  }
}
