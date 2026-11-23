import {CHARACTER_PRESETS} from '@/src/config/constants';
import {renderCharacterPortraitDataUrl} from '@/src/game/graphics/PixelArtGenerator';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {authSystem} from '@/src/game/systems/AuthSystem';
import {friendsSystem, SocialGraphSnapshot} from '@/src/game/systems/FriendsSystem';
import {multiplayerClient} from '@/src/game/systems/MultiplayerClient';
import {ownerBadgeService} from '@/src/game/systems/OwnerBadgeService';
import {PublicPlayerProfile} from '@/src/game/types/gameTypes';
import {ProfileModal} from '@/src/game/ui/ProfileModal';

export interface FriendsModalCallbacks {
  onViewProfile?: (uid: string, profile?: PublicPlayerProfile | null, fallbackName?: string) => void;
  onInvitedToServer?: (targetUsername: string) => void;
  onClose?: () => void;
}

type FriendsTab = 'list' | 'requests' | 'add';

function esc(val: unknown): string {
  return String(val ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export class FriendsModal {
  private readonly backdrop: HTMLDivElement;
  private readonly fallbackProfileModal: ProfileModal;
  private openState = false;
  private tab: FriendsTab = 'list';
  private loading = false;
  private actionBusy = false;
  private searchInput = '';
  private searchResult: {
    found: boolean;
    uid?: string;
    username?: string;
    profile?: PublicPlayerProfile | null;
    error?: string;
  } | null = null;
  private graph: SocialGraphSnapshot = {
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
  };
  private feedback: {text: string; error: boolean} | null = null;

  constructor(
    parent: HTMLElement,
    private readonly callbacks: FriendsModalCallbacks = {},
  ) {
    this.backdrop = document.createElement('div');
    this.backdrop.className =
      'ui-interactive fixed inset-0 z-50 hidden items-center justify-center bg-[#040812]/86 p-3 sm:p-4';
    parent.appendChild(this.backdrop);

    this.fallbackProfileModal = new ProfileModal(parent, {
      onNotice: (msg) => {
        this.feedback = {text: msg, error: false};
        if (this.openState) this.render();
      },
    });

    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) {
        this.close();
      }
    });
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public open(initialTab: FriendsTab = 'list'): void {
    this.openState = true;
    this.tab = initialTab;
    this.feedback = null;
    this.searchResult = null;
    this.actionBusy = false;
    this.backdrop.style.display = 'flex';
    this.render();
    void this.refresh();
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.backdrop.style.display = 'none';
    this.backdrop.innerHTML = '';
    this.callbacks.onClose?.();
  }

  public async refresh(): Promise<void> {
    if (!this.openState) return;
    this.loading = true;
    this.render();
    try {
      this.graph = await friendsSystem.loadSocialGraph();
    } finally {
      this.loading = false;
      if (this.openState) this.render();
    }
  }

  private openProfile(uid: string, profile?: PublicPlayerProfile | null, fallbackName = 'Citizen'): void {
    if (this.callbacks.onViewProfile) {
      this.close();
      this.callbacks.onViewProfile(uid, profile, fallbackName);
      return;
    }
    this.fallbackProfileModal.openPublicProfile(uid, profile, fallbackName);
  }

  private render(): void {
    if (!this.openState) return;
    const user = authSystem.getCurrentUser();
    const mp = multiplayerClient.getStatus();
    const inMpRoom = multiplayerClient.isConnected();
    const reqCount = this.graph.incomingRequests.length;

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
        <div class="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-[#22355c] bg-[#080f1f] shrink-0">
          <div>
            <div class="font-mono-tabular text-[11px] font-bold text-fuchsia-300">
              CHAOS CITY SOCIAL GRAPH · ${this.graph.friends.length} FRIENDS
            </div>
            <h2 class="font-display text-lg font-bold text-white">Friends &amp; Online Presence</h2>
          </div>
          <div class="flex items-center gap-2">
            <button id="cc-fmod-refresh" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer">
              Refresh
            </button>
            <button id="cc-fmod-close" type="button" class="cc-btn-secondary px-3.5 py-1.5 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer">
              Close
            </button>
          </div>
        </div>

        <div class="flex flex-wrap gap-1.5 px-5 py-2.5 border-b border-[#1c2d50] bg-[#070d1b] shrink-0">
          <button type="button" data-ftab="list" class="cc-fmod-tab px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer ${
            this.tab === 'list' ? 'bg-sky-500 text-[#050a14]' : 'cc-btn-secondary text-slate-300'
          }">My Friends (${this.graph.friends.length})</button>
          <button type="button" data-ftab="requests" class="cc-fmod-tab px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer ${
            this.tab === 'requests' ? 'bg-sky-500 text-[#050a14]' : 'cc-btn-secondary text-slate-300'
          }">Requests${reqCount > 0 ? ` (${reqCount})` : ''}</button>
          <button type="button" data-ftab="add" class="cc-fmod-tab px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer ${
            this.tab === 'add' ? 'bg-sky-500 text-[#050a14]' : 'cc-btn-secondary text-slate-300'
          }">Add Friends</button>
        </div>

        ${
          this.feedback
            ? `<div class="mx-5 mt-3 px-3 py-2 rounded-xl text-xs font-semibold border shrink-0 ${
                this.feedback.error
                  ? 'bg-rose-500/15 border-rose-400/50 text-rose-200'
                  : 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
              }">${esc(this.feedback.text)}</div>`
            : ''
        }

        <div class="flex-1 overflow-y-auto p-5 space-y-3">
          ${!user ? this.renderGuestNotice() : this.renderBody(inMpRoom, mp.roomName)}
        </div>
      </div>
    `;

    this.backdrop.querySelector('#cc-fmod-close')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.close();
    });
    this.backdrop.querySelector('#cc-fmod-refresh')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      void this.refresh();
    });
    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-fmod-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.ftab as FriendsTab | undefined;
        if (!next) return;
        audioSystem.playButtonClick();
        this.tab = next;
        this.render();
      });
    });

    this.bindBodyEvents();
  }

  private renderGuestNotice(): string {
    return `
      <div class="rounded-xl bg-[#091020] border border-amber-400/40 p-5 text-center space-y-2">
        <div class="font-display text-base font-bold text-white">Verified Account Required</div>
        <p class="text-xs text-slate-300 leading-relaxed">
          Sign in or register a CHAOS CITY username from the Main Menu to search players, manage friend requests, see live online status, and send server invites.
        </p>
      </div>
    `;
  }

  private renderBody(inMpRoom: boolean, currentRoomName: string): string {
    if (this.tab === 'list') {
      if (this.loading && this.graph.friends.length === 0) {
        return `<div class="text-xs text-slate-400 py-8 text-center">Loading your CHAOS CITY friends list...</div>`;
      }
      if (this.graph.friends.length === 0) {
        return `
          <div class="rounded-xl bg-[#091020] border border-[#22355c] p-5 text-center space-y-2">
            <div class="text-sm font-semibold text-white">No friends added yet</div>
            <p class="text-xs text-slate-400">Open the Add Friends tab to search real players by their exact username.</p>
          </div>
        `;
      }
      return this.graph.friends
        .map((f) => {
          const isOwner = ownerBadgeService.isVerifiedOwnerAccount(f.uid, f.username);
          const online = Boolean(f.liveStatus?.isOnline);
          const roomLabel = online
            ? f.liveStatus?.visibility === 'invite_only'
              ? 'Online · In Private Server'
              : `Online · ${f.liveStatus?.roomName || 'Multiplayer City'}`
            : 'Offline / Story Mode';
          const prof = f.profile;
          const preset =
            CHARACTER_PRESETS.find((p) => p.id === (prof?.appearanceId ?? 'civic_explorer')) ??
            CHARACTER_PRESETS[0];
          const avatarUrl = prof
            ? renderCharacterPortraitDataUrl(
                preset,
                prof.equippedClothing,
                prof.hairOverride ?? undefined,
                prof.appearanceConfig,
              )
            : '';

          return `
            <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <div class="relative w-11 h-11 rounded-lg bg-[#050914] border border-[#2a4270] flex items-center justify-center overflow-hidden shrink-0">
                  ${avatarUrl ? `<img src="${avatarUrl}" alt="${esc(f.username)}" class="w-10 h-10 object-contain" style="image-rendering: pixelated;" />` : `<span class="text-base">👤</span>`}
                  <span class="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full border border-[#050914] ${online ? 'bg-emerald-400' : 'bg-slate-500'}"></span>
                </div>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-1.5">
                    ${isOwner ? ownerBadgeService.renderBadgeHtml(true) : ''}
                    <span class="font-display text-sm font-bold text-white truncate">${esc(prof?.displayName || f.username)}</span>
                    <span class="text-xs text-slate-400">@${esc(f.username)}</span>
                  </div>
                  <div class="text-[11px] ${online ? 'text-emerald-300 font-semibold' : 'text-slate-400'} truncate">
                    ${esc(roomLabel)}
                  </div>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-1.5">
                <button type="button" data-fmod-view="${esc(f.uid)}" class="cc-fmod-view cc-btn-secondary px-2.5 py-1.5 rounded-lg text-[11px] font-semibold min-h-[36px] cursor-pointer">
                  Profile
                </button>
                ${
                  inMpRoom
                    ? `<button type="button" data-fmod-invite="${esc(f.uid)}" data-fmod-name="${esc(f.username)}" title="Invite to ${esc(currentRoomName)}" class="cc-fmod-invite cc-btn-primary px-2.5 py-1.5 rounded-lg text-[11px] font-bold min-h-[36px] cursor-pointer">
                        Invite to Server
                      </button>`
                    : ''
                }
                <button type="button" data-fmod-remove="${esc(f.pairId)}" class="cc-fmod-remove px-2.5 py-1.5 rounded-lg bg-rose-500/15 border border-rose-400/40 text-[11px] font-semibold text-rose-200 min-h-[36px] cursor-pointer">
                  Remove
                </button>
              </div>
            </div>
          `;
        })
        .join('');
    }

    if (this.tab === 'requests') {
      return `
        <div class="space-y-4">
          <div class="space-y-2">
            <h3 class="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              Incoming Friend Requests (${this.graph.incomingRequests.length})
            </h3>
            ${
              this.graph.incomingRequests.length === 0
                ? `<div class="rounded-xl bg-[#091020] border border-[#22355c] p-3.5 text-xs text-slate-400">No incoming friend requests.</div>`
                : this.graph.incomingRequests
                    .map(
                      (r) => `
                  <div class="rounded-xl bg-[#091020] border border-emerald-400/35 p-3 flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-1.5">
                      ${ownerBadgeService.isVerifiedOwnerAccount(r.senderUid, r.senderUsername) ? ownerBadgeService.renderBadgeHtml(true) : ''}
                      <span class="font-semibold text-sm text-white">@${esc(r.senderUsername)}</span>
                    </div>
                    <div class="flex gap-1.5">
                      <button type="button" data-fmod-acc="${esc(r.requestId)}" class="cc-fmod-acc cc-btn-primary px-3 py-1.5 rounded-lg text-xs font-bold min-h-[36px] cursor-pointer">Accept</button>
                      <button type="button" data-fmod-dec="${esc(r.requestId)}" class="cc-fmod-dec cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] cursor-pointer">Decline</button>
                    </div>
                  </div>
                `,
                    )
                    .join('')
            }
          </div>

          <div class="space-y-2">
            <h3 class="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-sky-300">
              Outgoing Requests (${this.graph.outgoingRequests.length})
            </h3>
            ${
              this.graph.outgoingRequests.length === 0
                ? `<div class="rounded-xl bg-[#091020] border border-[#22355c] p-3.5 text-xs text-slate-400">No pending outgoing requests.</div>`
                : this.graph.outgoingRequests
                    .map(
                      (r) => `
                  <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3 flex items-center justify-between gap-2">
                    <span class="text-xs text-slate-200">Sent to <b>@${esc(r.receiverUsername)}</b> (Pending)</span>
                    <button type="button" data-fmod-can="${esc(r.requestId)}" class="cc-fmod-can px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-400/40 text-xs font-semibold text-rose-200 min-h-[34px] cursor-pointer">
                      Cancel
                    </button>
                  </div>
                `,
                    )
                    .join('')
            }
          </div>
        </div>
      `;
    }

    // Add Friends Tab
    const sr = this.searchResult;
    let resultHtml = '';
    if (sr) {
      if (!sr.found || !sr.uid) {
        resultHtml = `<div class="rounded-xl bg-rose-500/15 border border-rose-400/40 p-3 text-xs text-rose-200">${esc(sr.error || 'Player not found.')}</div>`;
      } else {
        const prof = sr.profile;
        const preset =
          CHARACTER_PRESETS.find((p) => p.id === (prof?.appearanceId ?? 'civic_explorer')) ??
          CHARACTER_PRESETS[0];
        const avatarUrl = prof
          ? renderCharacterPortraitDataUrl(
              preset,
              prof.equippedClothing,
              prof.hairOverride ?? undefined,
              prof.appearanceConfig,
            )
          : '';
        const isOwner = ownerBadgeService.isVerifiedOwnerAccount(sr.uid, sr.username);
        const alreadyFriend = this.graph.friends.some((f) => f.uid === sr.uid);
        const alreadySent = this.graph.outgoingRequests.some((r) => r.receiverUid === sr.uid);

        resultHtml = `
          <div class="rounded-xl bg-[#091020] border border-sky-400/50 p-4 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-lg bg-[#050914] border border-[#2a4270] flex items-center justify-center overflow-hidden shrink-0">
                ${avatarUrl ? `<img src="${avatarUrl}" alt="${esc(sr.username)}" class="w-11 h-11 object-contain" style="image-rendering: pixelated;" />` : `<span class="text-lg">👤</span>`}
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  ${isOwner ? ownerBadgeService.renderBadgeHtml(true) : ''}
                  <span class="font-display font-bold text-sm text-white">${esc(prof?.displayName || sr.username)}</span>
                  <span class="text-xs text-slate-400">@${esc(sr.username)}</span>
                </div>
                <div class="text-[11px] text-sky-300">
                  Lv.${prof?.level ?? 1} · ${esc(prof?.selectedTitle ?? 'Chaos City Citizen')}
                </div>
              </div>
            </div>
            <div class="flex gap-2">
              <button type="button" data-fmod-sview="${esc(sr.uid)}" class="cc-fmod-sview cc-btn-secondary px-3 py-2 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer">
                View Profile
              </button>
              ${
                alreadyFriend
                  ? `<span class="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-xs font-bold text-emerald-200">Friends</span>`
                  : alreadySent
                    ? `<span class="px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-400/40 text-xs font-bold text-amber-200">Request Sent</span>`
                    : `<button type="button" data-fmod-sadd="${esc(sr.uid)}" data-fmod-suname="${esc(sr.username || 'Citizen')}" class="cc-fmod-sadd cc-btn-primary px-3.5 py-2 rounded-lg text-xs font-bold min-h-[38px] cursor-pointer">
                        Send Request
                      </button>`
              }
            </div>
          </div>
        `;
      }
    }

    return `
      <div class="space-y-3">
        <p class="text-xs text-slate-300 leading-relaxed">
          Search for registered CHAOS CITY players by their exact username to inspect their profile or send a friend request.
        </p>
        <form id="cc-fmod-search-form" class="flex gap-2">
          <input id="cc-fmod-search-input" type="text" maxlength="20" value="${esc(this.searchInput)}" placeholder="Exact username (e.g. alex_99)" class="flex-1 rounded-xl bg-[#060b16] border border-[#2a3f6b] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400" />
          <button type="submit" class="cc-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold min-h-[42px] cursor-pointer">
            Search
          </button>
        </form>
        ${resultHtml}
      </div>
    `;
  }

  private bindBodyEvents(): void {
    const searchInputEl = this.backdrop.querySelector<HTMLInputElement>('#cc-fmod-search-input');
    searchInputEl?.addEventListener('input', () => {
      this.searchInput = searchInputEl.value;
    });

    this.backdrop.querySelector('#cc-fmod-search-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (this.actionBusy || !this.openState) return;
      audioSystem.playButtonClick();
      this.actionBusy = true;
      this.feedback = null;
      try {
        const res = await friendsSystem.searchByUsername(this.searchInput);
        if (!this.openState) return;
        this.searchResult = res;
        this.render();
      } finally {
        this.actionBusy = false;
      }
    });

    this.backdrop.querySelector('.cc-fmod-sview')?.addEventListener('click', (e) => {
      const uid = (e.currentTarget as HTMLButtonElement).dataset.fmodSview;
      if (!uid || !this.searchResult) return;
      this.openProfile(uid, this.searchResult.profile, this.searchResult.username || 'Citizen');
    });

    this.backdrop.querySelector('.cc-fmod-sadd')?.addEventListener('click', async (e) => {
      if (this.actionBusy || !this.openState) return;
      const btn = e.currentTarget as HTMLButtonElement;
      const uid = btn.dataset.fmodSadd;
      const uname = btn.dataset.fmodSuname || 'Citizen';
      if (!uid) return;
      this.actionBusy = true;
      try {
        const res = await friendsSystem.sendFriendRequest(uid, uname);
        if (!this.openState) return;
        this.feedback = {text: res.message, error: !res.ok};
        await this.refresh();
      } finally {
        this.actionBusy = false;
      }
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-fmod-view').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.fmodView;
        if (!uid) return;
        const fr = this.graph.friends.find((x) => x.uid === uid);
        this.openProfile(uid, fr?.profile, fr?.username || 'Citizen');
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-fmod-invite').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (this.actionBusy || !this.openState) return;
        const uid = btn.dataset.fmodInvite;
        const uname = btn.dataset.fmodName || 'Friend';
        if (!uid) return;
        this.actionBusy = true;
        try {
          const res = await multiplayerClient.sendServerInvite(uid, uname);
          if (!this.openState) return;
          if (res.ok) {
            audioSystem.playInteract();
            this.feedback = {text: `Server invite sent to @${uname}!`, error: false};
            this.callbacks.onInvitedToServer?.(uname);
          } else {
            audioSystem.playError();
            this.feedback = {text: res.error || 'Could not send invite.', error: true};
          }
          this.render();
        } finally {
          this.actionBusy = false;
        }
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-fmod-remove').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (this.actionBusy || !this.openState) return;
        const pairId = btn.dataset.fmodRemove;
        if (!pairId) return;
        this.actionBusy = true;
        try {
          await friendsSystem.removeFriend(pairId);
          if (!this.openState) return;
          this.feedback = {text: 'Friend removed.', error: false};
          await this.refresh();
        } finally {
          this.actionBusy = false;
        }
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-fmod-acc').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (this.actionBusy || !this.openState) return;
        const req = this.graph.incomingRequests.find((r) => r.requestId === btn.dataset.fmodAcc);
        if (!req) return;
        this.actionBusy = true;
        try {
          const res = await friendsSystem.acceptFriendRequest(req);
          if (!this.openState) return;
          this.feedback = {text: res.message, error: !res.ok};
          await this.refresh();
        } finally {
          this.actionBusy = false;
        }
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-fmod-dec').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (this.actionBusy || !this.openState) return;
        const id = btn.dataset.fmodDec;
        if (!id) return;
        this.actionBusy = true;
        try {
          await friendsSystem.declineFriendRequest(id);
          if (this.openState) await this.refresh();
        } finally {
          this.actionBusy = false;
        }
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-fmod-can').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (this.actionBusy || !this.openState) return;
        const id = btn.dataset.fmodCan;
        if (!id) return;
        this.actionBusy = true;
        try {
          await friendsSystem.cancelFriendRequest(id);
          if (this.openState) await this.refresh();
        } finally {
          this.actionBusy = false;
        }
      });
    });
  }

  public destroy(): void {
    this.openState = false;
    this.fallbackProfileModal.destroy();
    this.backdrop.remove();
  }
}
