import {CHARACTER_PRESETS} from '@/src/config/constants';
import {computeExplorationBreakdown} from '@/src/game/data/explorationData';
import {CITIZEN_TITLES, EXPANDED_ACHIEVEMENTS, getXpLevelProgress} from '@/src/game/data/progressionData';
import {renderCharacterPortraitDataUrl} from '@/src/game/graphics/PixelArtGenerator';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {authSystem} from '@/src/game/systems/AuthSystem';
import {cloudSaveManager} from '@/src/game/systems/CloudSaveManager';
import {economySystem} from '@/src/game/systems/EconomySystem';
import {friendsSystem} from '@/src/game/systems/FriendsSystem';
import {multiplayerClient} from '@/src/game/systems/MultiplayerClient';
import {ownerBadgeService} from '@/src/game/systems/OwnerBadgeService';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {ProfileVisibility, PublicPlayerProfile} from '@/src/game/types/gameTypes';

export interface ProfileModalCallbacks {
  onOpenSettings?: () => void;
  onNotice?: (msg: string) => void;
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

export class ProfileModal {
  private readonly backdrop: HTMLDivElement;
  private openState = false;
  private viewingUid: string | null = null;
  private remoteProfile: PublicPlayerProfile | null = null;
  private remoteFallbackName = 'Citizen';
  private loadingRemote = false;
  private actionBusy = false;
  private feedback: {text: string; error: boolean} | null = null;

  constructor(
    parent: HTMLElement,
    private readonly callbacks: ProfileModalCallbacks = {},
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

  public openSelf(): void {
    this.openState = true;
    this.actionBusy = false;
    this.viewingUid = authSystem.getCurrentUser()?.uid ?? null;
    this.remoteProfile = null;
    this.feedback = null;
    void ownerBadgeService.refreshOwnerConfig().then(() => {
      if (this.openState && !this.remoteProfile) this.render();
    });
    this.render();
    this.backdrop.style.display = 'flex';
  }

  public openPublicProfile(
    uid: string,
    profile?: PublicPlayerProfile | null,
    fallbackName = 'Citizen',
  ): void {
    const selfUid = authSystem.getCurrentUser()?.uid;
    if (selfUid && uid === selfUid) {
      this.openSelf();
      return;
    }
    this.openState = true;
    this.actionBusy = false;
    this.viewingUid = uid;
    this.remoteProfile = profile ?? null;
    this.remoteFallbackName = fallbackName;
    this.feedback = null;
    this.backdrop.style.display = 'flex';
    if (!this.remoteProfile) {
      void this.loadRemote(uid);
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

  private async loadRemote(uid: string): Promise<void> {
    this.loadingRemote = true;
    this.render();
    this.remoteProfile = await friendsSystem.getPublicProfile(uid);
    this.loadingRemote = false;
    if (this.openState && this.viewingUid === uid) {
      this.render();
    }
  }

  private render(): void {
    if (!this.openState) return;
    const selfUid = authSystem.getCurrentUser()?.uid ?? null;
    const isSelf = !this.viewingUid || (selfUid !== null && this.viewingUid === selfUid);

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
        <div class="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#22355c] shrink-0">
          <h2 class="font-display text-lg sm:text-xl font-bold text-white">
            ${isSelf ? 'My Citizen Profile' : 'Citizen Profile'}
          </h2>
          <button id="cc-prof-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
            Close
          </button>
        </div>

        ${
          this.feedback
            ? `<div class="mx-5 mt-3 px-3.5 py-2 rounded-xl text-xs font-semibold border shrink-0 ${
                this.feedback.error
                  ? 'bg-rose-500/15 border-rose-400/50 text-rose-200'
                  : 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
              }">${esc(this.feedback.text)}</div>`
            : ''
        }

        <div class="flex-1 overflow-y-auto p-5 space-y-4">
          ${isSelf ? this.renderSelfBody() : this.renderRemoteBody()}
        </div>
      </div>
    `;

    this.backdrop.querySelector('#cc-prof-close')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.close();
    });
    this.bindEvents(isSelf);
  }

  private renderSelfBody(): string {
    const save = saveSystem.getState();
    const user = authSystem.getCurrentUser();
    const mpStatus = multiplayerClient.getStatus();
    const uid = user?.uid ?? null;
    const uname = user?.username ?? null;
    const isOwner = ownerBadgeService.isVerifiedOwnerAccount(uid, uname, mpStatus.selfIsOwner);

    const preset = CHARACTER_PRESETS.find((p) => p.id === save.appearanceId) ?? CHARACTER_PRESETS[0];
    const portrait = renderCharacterPortraitDataUrl(
      preset,
      save.equippedClothing,
      save.hairOverride,
      save.appearanceConfig,
    );
    const xpProg = getXpLevelProgress(save.progression.xp);
    const exploration = computeExplorationBreakdown(save);
    const joinedDate = new Date(save.joinedAtMs || Date.now()).toLocaleDateString();

    return `
      <!-- Header Card -->
      <div class="rounded-2xl bg-[#091020] border border-[#22355c] p-4 flex flex-wrap items-center gap-4">
        <div class="w-16 h-16 rounded-xl bg-[#060b16] border border-sky-400/50 flex items-center justify-center shrink-0">
          <img src="${portrait}" alt="${esc(save.playerName)}" class="w-14 h-14 object-contain" style="image-rendering: pixelated;" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            ${isOwner ? ownerBadgeService.renderBadgeHtml(false) : ''}
            <span class="font-display text-xl font-bold text-white truncate">${esc(save.playerName)}</span>
            <span class="text-xs text-slate-400">${user ? `@${esc(user.username)}` : 'Guest Mode'}</span>
          </div>
          <div class="font-mono-tabular text-xs font-bold text-amber-300 mt-0.5">
            Level ${xpProg.level} · "${esc(save.progression.selectedTitle)}" · Joined ${esc(joinedDate)}
          </div>
          <div class="w-full h-2 rounded-full bg-[#060b16] overflow-hidden mt-2">
            <div class="h-full bg-gradient-to-r from-sky-400 to-amber-400" style="width:${xpProg.percent}%"></div>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
        <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3">
          <div class="text-slate-400 text-[10px]">Exploration</div>
          <div class="font-mono-tabular text-base font-bold text-emerald-300">${exploration.overallPercent}%</div>
        </div>
        <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3">
          <div class="text-slate-400 text-[10px]">Properties Owned</div>
          <div class="font-mono-tabular text-base font-bold text-sky-300">${(save.ownedProperties ?? []).length}</div>
        </div>
        <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3">
          <div class="text-slate-400 text-[10px]">Vehicles Owned</div>
          <div class="font-mono-tabular text-base font-bold text-amber-300">${save.vehicles.length}</div>
        </div>
        <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3">
          <div class="text-slate-400 text-[10px]">Missions Done</div>
          <div class="font-mono-tabular text-base font-bold text-cyan-300">${save.missions.completedIds.length}</div>
        </div>
        <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3">
          <div class="text-slate-400 text-[10px]">Mini-Games Played</div>
          <div class="font-mono-tabular text-base font-bold text-indigo-300">${save.missions.activitiesCompleted ?? 0}</div>
        </div>
        <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3">
          <div class="text-slate-400 text-[10px]">Achievements</div>
          <div class="font-mono-tabular text-base font-bold text-fuchsia-300">${save.achievements.unlockedIds.length}/${EXPANDED_ACHIEVEMENTS.length}</div>
        </div>
      </div>

      <!-- Citizen Title Selector -->
      <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3.5 space-y-2">
        <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-amber-300">Equipped Citizen Title</div>
        <div class="flex flex-wrap gap-1.5">
          ${CITIZEN_TITLES.filter((t) => save.progression.unlockedTitles.includes(t.label))
            .map((t) => {
              const active = save.progression.selectedTitle === t.label;
              return `<button type="button" data-title="${esc(t.label)}" class="cc-prof-title px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                active ? 'bg-amber-400 text-[#06101f]' : 'cc-btn-secondary'
              }">${esc(t.label)}</button>`;
            })
            .join('')}
        </div>
      </div>

      <!-- Unlocked Achievements Preview -->
      <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3.5 space-y-2">
        <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-fuchsia-300">Unlocked Badges</div>
        <div class="flex flex-wrap gap-1.5 text-[11px]">
          ${
            save.achievements.unlockedIds.length === 0
              ? `<span class="text-slate-400">Explore districts, complete missions, or play mini-games to earn badges.</span>`
              : EXPANDED_ACHIEVEMENTS.filter((a) => save.achievements.unlockedIds.includes(a.id))
                  .map(
                    (a) =>
                      `<span class="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 font-semibold">${esc(a.title)}</span>`,
                  )
                  .join('')
          }
        </div>
      </div>

      <!-- Privacy Controls -->
      <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3.5 space-y-2.5 text-xs">
        <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-sky-300">Privacy Controls</div>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-slate-200">Public Profile Visibility</span>
          <div class="flex gap-1">
            ${(['public', 'friends', 'private'] as ProfileVisibility[])
              .map(
                (v) => `<button type="button" data-pvis="${v}" class="cc-prof-vis px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize cursor-pointer ${
                  save.privacySettings.profileVisibility === v
                    ? 'bg-sky-500 text-[#06101f]'
                    : 'bg-[#131f38] text-slate-300 border border-[#22355c]'
                }">${v}</button>`,
              )
              .join('')}
          </div>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span class="text-slate-200">Allow Property Invites</span>
          <button id="cc-prof-inv" type="button" class="cc-btn-secondary px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer">
            ${save.privacySettings.allowMultiplayerInvites ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        <div class="flex items-center justify-between gap-2">
          <span class="text-slate-200">Show Online Status</span>
          <button id="cc-prof-onl" type="button" class="cc-btn-secondary px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer">
            ${save.privacySettings.showOnlineStatus ? 'Visible' : 'Hidden'}
          </button>
        </div>
      </div>
    `;
  }

  private renderRemoteBody(): string {
    if (this.loadingRemote) {
      return `<div class="text-center text-xs text-slate-400 py-10">Loading citizen profile...</div>`;
    }

    const uid = this.viewingUid || '';
    const live = multiplayerClient.getRemotePlayerByUid(uid);
    const p = this.remoteProfile;
    const uname = live?.username || p?.username || this.remoteFallbackName;
    const dname = live?.displayName || p?.displayName || this.remoteFallbackName;
    const isOwner = ownerBadgeService.isVerifiedOwnerAccount(uid, uname, live?.isOwner);

    if (p && p.profileVisibility === 'private') {
      return `
        <div class="rounded-xl bg-[#091020] border border-[#22355c] p-5 text-center space-y-2">
          <div class="flex items-center justify-center gap-1.5">
            ${isOwner ? ownerBadgeService.renderBadgeHtml(false) : ''}
            <span class="font-display font-bold text-lg text-white">${esc(dname)}</span>
          </div>
          <p class="text-xs text-slate-400">@${esc(uname)} has set their citizen profile to Private.</p>
        </div>
      `;
    }

    const preset =
      CHARACTER_PRESETS.find((pr) => pr.id === (p?.appearanceId || live?.appearanceId)) ??
      CHARACTER_PRESETS[0];
    const portrait = renderCharacterPortraitDataUrl(
      preset,
      p?.equippedClothing || live?.equippedClothing,
      (p?.hairOverride ?? live?.hairOverride) ?? undefined,
      p?.appearanceConfig || live?.appearanceConfig,
    );

    const muted = multiplayerClient.isMuted(uid);
    const blocked = multiplayerClient.isBlocked(uid);

    return `
      <div class="rounded-2xl bg-[#091020] border border-[#22355c] p-4 flex flex-wrap items-center gap-4">
        <div class="w-16 h-16 rounded-xl bg-[#060b16] border border-sky-400/50 flex items-center justify-center shrink-0">
          <img src="${portrait}" alt="${esc(dname)}" class="w-14 h-14 object-contain" style="image-rendering: pixelated;" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            ${isOwner ? ownerBadgeService.renderBadgeHtml(false) : ''}
            <span class="font-display text-xl font-bold text-white truncate">${esc(dname)}</span>
            <span class="text-xs text-slate-400">@${esc(uname)}</span>
          </div>
          <div class="font-mono-tabular text-xs font-bold text-amber-300 mt-0.5">
            Level ${p?.level ?? live?.level ?? 1} · "${esc(p?.selectedTitle || live?.selectedTitle || 'Citizen')}"
          </div>
        </div>
      </div>

      ${
        p
          ? `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3">
                <div class="text-slate-400 text-[10px]">Exploration</div>
                <div class="font-mono-tabular text-base font-bold text-emerald-300">${p.explorationPercent}%</div>
              </div>
              <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3">
                <div class="text-slate-400 text-[10px]">Properties</div>
                <div class="font-mono-tabular text-base font-bold text-sky-300">${p.ownedPropertyCount}</div>
              </div>
              <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3">
                <div class="text-slate-400 text-[10px]">Vehicles</div>
                <div class="font-mono-tabular text-base font-bold text-amber-300">${p.ownedVehicleCount}</div>
              </div>
              <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3">
                <div class="text-slate-400 text-[10px]">Missions Done</div>
                <div class="font-mono-tabular text-base font-bold text-cyan-300">${p.missionsCompletedCount}</div>
              </div>
              <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3">
                <div class="text-slate-400 text-[10px]">Mini-Games Played</div>
                <div class="font-mono-tabular text-base font-bold text-indigo-300">${p.miniGamesPlayedCount}</div>
              </div>
              <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3">
                <div class="text-slate-400 text-[10px]">Achievements</div>
                <div class="font-mono-tabular text-base font-bold text-fuchsia-300">${p.achievementCount}</div>
              </div>
            </div>`
          : ''
      }

      <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-[#22355c]">
        <button id="cc-rprof-add" type="button" class="cc-btn-primary px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer">Send Friend Request</button>
        <button id="cc-rprof-mute" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer">${muted ? 'Unmute Player' : 'Mute Chat'}</button>
        <button id="cc-rprof-block" type="button" class="px-3.5 py-2 rounded-xl bg-rose-500/20 border border-rose-400/50 text-xs font-semibold text-rose-200 cursor-pointer">${blocked ? 'Unblock' : 'Block Player'}</button>
      </div>
    `;
  }

  private bindEvents(isSelf: boolean): void {
    if (isSelf) {
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-prof-title').forEach((btn) => {
        btn.addEventListener('click', () => {
          const title = btn.dataset.title;
          if (!title) return;
          audioSystem.playInteract();
          economySystem.setSelectedTitle(title);
          void cloudSaveManager.syncPublicProfile(
            multiplayerClient.getStatus().status === 'connected' ? multiplayerClient.getStatus().roomId : null,
            multiplayerClient.getStatus().status === 'connected',
          );
          this.feedback = {text: `Equipped title "${title}"!`, error: false};
          this.render();
        });
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-prof-vis').forEach((btn) => {
        btn.addEventListener('click', () => {
          const v = btn.dataset.pvis as ProfileVisibility;
          saveSystem.updatePrivacySettings({profileVisibility: v});
          audioSystem.playButtonClick();
          void cloudSaveManager.syncPublicProfile(null, multiplayerClient.getStatus().status === 'connected');
          this.render();
        });
      });

      this.backdrop.querySelector('#cc-prof-inv')?.addEventListener('click', () => {
        const cur = saveSystem.getState().privacySettings.allowMultiplayerInvites;
        saveSystem.updatePrivacySettings({allowMultiplayerInvites: !cur});
        audioSystem.playButtonClick();
        this.render();
      });

      this.backdrop.querySelector('#cc-prof-onl')?.addEventListener('click', () => {
        const cur = saveSystem.getState().privacySettings.showOnlineStatus;
        saveSystem.updatePrivacySettings({showOnlineStatus: !cur});
        audioSystem.playButtonClick();
        void cloudSaveManager.syncPublicProfile(
          multiplayerClient.getStatus().status === 'connected' ? multiplayerClient.getStatus().roomId : null,
          multiplayerClient.getStatus().status === 'connected',
        );
        this.render();
      });
      return;
    }

    const uid = this.viewingUid || '';
    const uname =
      this.remoteProfile?.username ||
      multiplayerClient.getRemotePlayerByUid(uid)?.username ||
      this.remoteFallbackName;

    this.backdrop.querySelector('#cc-rprof-add')?.addEventListener('click', async () => {
      if (this.actionBusy || !this.openState) return;
      this.actionBusy = true;
      try {
        const res = await friendsSystem.sendFriendRequest(uid, uname);
        if (!this.openState) return;
        this.feedback = {text: res.message, error: !res.ok};
        this.render();
      } finally {
        this.actionBusy = false;
      }
    });
    this.backdrop.querySelector('#cc-rprof-mute')?.addEventListener('click', async () => {
      if (this.actionBusy || !this.openState) return;
      this.actionBusy = true;
      try {
        const nowMuted = await multiplayerClient.toggleMuteUser(uid);
        if (!this.openState) return;
        this.feedback = {text: nowMuted ? 'Muted player chat.' : 'Unmuted player.', error: false};
        this.render();
      } finally {
        this.actionBusy = false;
      }
    });
    this.backdrop.querySelector('#cc-rprof-block')?.addEventListener('click', async () => {
      if (this.actionBusy || !this.openState) return;
      this.actionBusy = true;
      try {
        const nowBlocked = await multiplayerClient.toggleBlockUser(uid);
        if (!this.openState) return;
        this.feedback = {text: nowBlocked ? 'Blocked player.' : 'Unblocked player.', error: false};
        this.render();
      } finally {
        this.actionBusy = false;
      }
    });
  }

  public destroy(): void {
    this.openState = false;
    this.backdrop.remove();
  }
}
