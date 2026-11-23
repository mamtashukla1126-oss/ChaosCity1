import {audioSystem} from '@/src/game/systems/AudioSystem';
import {authSystem} from '@/src/game/systems/AuthSystem';
import {cloudSaveManager} from '@/src/game/systems/CloudSaveManager';
import {gameSessionManager} from '@/src/game/systems/GameSessionManager';
import {multiplayerClient} from '@/src/game/systems/MultiplayerClient';
import {ownerBadgeService} from '@/src/game/systems/OwnerBadgeService';

export interface PauseMenuCallbacks {
  onResume: () => void;
  onOpenSocial?: () => void;
  onOpenProperties?: () => void;
  onOpenProfile?: () => void;
  onOpenJournal?: () => void;
  onOpenMiniGames?: () => void;
  onOpenSettings: () => void;
  onReturnToMenu: () => void;
}

const esc = (str: string): string =>
  String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export class PauseMenu {
  private readonly backdrop: HTMLDivElement;
  private openState = false;
  private unsubSync: (() => void) | null = null;

  constructor(parent: HTMLElement, private readonly callbacks: PauseMenuCallbacks) {
    this.backdrop = document.createElement('div');
    this.backdrop.className =
      'ui-interactive fixed inset-0 z-40 hidden items-center justify-center bg-[#040812]/80 p-4';
    parent.appendChild(this.backdrop);

    this.unsubSync = cloudSaveManager.subscribe(() => {
      if (this.openState) this.render();
    });
  }

  private render(): void {
    const user = authSystem.getCurrentUser();
    const sync = cloudSaveManager.getSyncState();
    const isMp = gameSessionManager.isMultiplayer();
    const mp = multiplayerClient.getStatus();
    const isOwner = ownerBadgeService.isVerifiedOwnerAccount(
      user?.uid,
      user?.username,
      isMp ? mp.selfIsOwner : false,
    );
    const syncLabel = !user
      ? 'Guest · Local Backup Only'
      : sync.status === 'saving'
        ? 'Saving to Cloud...'
        : sync.status === 'saved'
          ? 'Confirmed in Cloud'
          : sync.status === 'offline'
            ? 'Offline · Cached Locally'
            : sync.status === 'error'
              ? 'Save Error · Retry Below'
              : 'Pending Cloud Sync';

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-sm max-h-[92dvh] overflow-y-auto p-6 text-slate-100">
        <div class="text-center border-b border-[#22355c] pb-4 mb-4">
          <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-widest ${isMp ? 'text-emerald-300' : 'text-sky-300'} mb-1">
            ${isMp ? `Multiplayer · ${esc(mp.roomName || 'City Server')}` : 'Story Mode · Single Player'}
          </div>
          <h2 class="font-display text-2xl font-bold text-white tracking-wide">Game Paused</h2>
          <p class="text-xs text-slate-400 mt-1 flex flex-wrap items-center justify-center gap-1.5">
            ${isOwner ? ownerBadgeService.renderBadgeHtml(true) : ''}
            <span>${user ? `@${esc(user.username)}` : 'Guest Session'}</span>
            <span>·</span>
            <span class="text-sky-300 font-semibold">${syncLabel}</span>
          </p>
        </div>

        <div class="flex flex-col gap-2.5">
          <button id="cc-pause-resume" type="button" class="cc-btn-primary w-full py-3 rounded-xl font-display font-bold text-sm tracking-wide min-h-[46px] cursor-pointer">
            Resume
          </button>
          ${
            isMp && this.callbacks.onOpenSocial
              ? `<button id="cc-pause-social" type="button" class="cc-btn-secondary w-full py-2.5 rounded-xl font-display font-semibold text-xs tracking-wide min-h-[40px] border-emerald-400/50 text-emerald-200 cursor-pointer">
                  Server, Chat & Friends
                </button>`
              : ''
          }
          ${
            this.callbacks.onOpenProperties
              ? `<button id="cc-pause-props" type="button" class="cc-btn-secondary w-full py-2.5 rounded-xl font-display font-semibold text-xs tracking-wide min-h-[40px] border-cyan-400/50 text-cyan-200 cursor-pointer">
                  Properties & Real Estate
                </button>`
              : ''
          }
          ${
            this.callbacks.onOpenProfile
              ? `<button id="cc-pause-profile" type="button" class="cc-btn-secondary w-full py-2.5 rounded-xl font-display font-semibold text-xs tracking-wide min-h-[40px] border-indigo-400/50 text-indigo-200 cursor-pointer">
                  Citizen Profile & Privacy
                </button>`
              : ''
          }
          ${
            this.callbacks.onOpenJournal
              ? `<button id="cc-pause-journal" type="button" class="cc-btn-secondary w-full py-2.5 rounded-xl font-display font-semibold text-xs tracking-wide min-h-[40px] border-amber-400/50 text-amber-200 cursor-pointer">
                  Journal, Exploration & Story
                </button>`
              : ''
          }
          ${
            this.callbacks.onOpenMiniGames
              ? `<button id="cc-pause-games" type="button" class="cc-btn-secondary w-full py-2.5 rounded-xl font-display font-semibold text-xs tracking-wide min-h-[40px] border-fuchsia-400/50 text-fuchsia-200 cursor-pointer">
                  Mini-Games Hub
                </button>`
              : ''
          }
          ${
            user
              ? `<button id="cc-pause-save" type="button" class="cc-btn-secondary w-full py-2.5 rounded-xl font-display font-semibold text-xs tracking-wide min-h-[40px] border-sky-400/50 text-sky-200 cursor-pointer">
                  ${sync.status === 'saving' ? 'Saving to Cloud...' : 'Save to Cloud Now'}
                </button>`
              : ''
          }
          <button id="cc-pause-settings" type="button" class="cc-btn-secondary w-full py-2.5 rounded-xl font-display font-semibold text-sm tracking-wide min-h-[44px] cursor-pointer">
            Settings & Controls
          </button>
          <button id="cc-pause-menu" type="button" class="cc-btn-secondary w-full py-2.5 rounded-xl font-display font-semibold text-sm tracking-wide min-h-[44px] text-rose-200 border-rose-500/30 hover:border-rose-400 cursor-pointer">
            ${isMp ? 'Leave Server & Return to Hub' : 'Return to Main Menu'}
          </button>
        </div>
      </div>
    `;

    this.backdrop.querySelector('#cc-pause-resume')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onResume();
    });
    this.backdrop.querySelector('#cc-pause-social')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onOpenSocial?.();
    });
    this.backdrop.querySelector('#cc-pause-props')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onOpenProperties?.();
    });
    this.backdrop.querySelector('#cc-pause-profile')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onOpenProfile?.();
    });
    this.backdrop.querySelector('#cc-pause-journal')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onOpenJournal?.();
    });
    this.backdrop.querySelector('#cc-pause-games')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onOpenMiniGames?.();
    });
    this.backdrop.querySelector('#cc-pause-save')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      void cloudSaveManager.flushNow(true);
    });
    this.backdrop.querySelector('#cc-pause-settings')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onOpenSettings();
    });
    this.backdrop.querySelector('#cc-pause-menu')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onReturnToMenu();
    });
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public open(): void {
    this.openState = true;
    this.render();
    this.backdrop.style.display = 'flex';
  }

  public close(): void {
    this.openState = false;
    this.backdrop.style.display = 'none';
  }

  public destroy(): void {
    this.openState = false;
    this.unsubSync?.();
    this.backdrop.remove();
  }
}
