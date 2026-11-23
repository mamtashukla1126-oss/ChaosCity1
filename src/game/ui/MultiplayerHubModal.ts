import {audioSystem} from '@/src/game/systems/AudioSystem';
import {authSystem} from '@/src/game/systems/AuthSystem';
import {gameSessionManager} from '@/src/game/systems/GameSessionManager';
import {multiplayerClient} from '@/src/game/systems/MultiplayerClient';
import {ownerBadgeService} from '@/src/game/systems/OwnerBadgeService';
import {
  MultiplayerServerInfo,
  PendingMultiplayerJoin,
  ServerInviteItem,
  ServerVisibility,
} from '@/src/game/types/gameTypes';

export interface MultiplayerHubCallbacks {
  onLaunchMultiplayerCity: () => void;
  onOpenFriends: () => void;
  onRequireLogin: () => void;
  onClose?: () => void;
}

type HubTab = 'browse' | 'create' | 'code' | 'invites';

function esc(val: unknown): string {
  return String(val ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export class MultiplayerHubModal {
  private readonly backdrop: HTMLDivElement;
  private openState = false;
  private tab: HubTab = 'browse';
  private loading = false;
  private busy = false;
  private servers: MultiplayerServerInfo[] = [];
  private invites: ServerInviteItem[] = [];
  private feedback: {text: string; error: boolean} | null = null;

  // Password prompt target for locked public server or invite
  private passwordPromptRoom: MultiplayerServerInfo | null = null;
  private passwordPromptInvite: ServerInviteItem | null = null;
  private promptPasswordDraft = '';

  // Create Server form draft
  private createName = '';
  private createVisibility: ServerVisibility = 'public';
  private createMaxPlayers = 8;
  private createPassword = '';
  private createDescription = '';

  // Join by Room Code draft
  private joinCodeDraft = '';
  private joinCodePassword = '';
  private codeRequiresPassword = false;

  constructor(
    parent: HTMLElement,
    private readonly callbacks: MultiplayerHubCallbacks,
  ) {
    this.backdrop = document.createElement('div');
    this.backdrop.className =
      'ui-interactive fixed inset-0 z-40 hidden items-center justify-center bg-[#040812]/88 p-3 sm:p-4';
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

  public open(initialTab: HubTab = 'browse'): void {
    this.openState = true;
    this.tab = initialTab;
    this.feedback = null;
    this.passwordPromptRoom = null;
    this.passwordPromptInvite = null;
    this.promptPasswordDraft = '';
    this.codeRequiresPassword = false;
    const acct = authSystem.getCurrentUser();
    if (!this.createName && acct) {
      this.createName = `${acct.username}'s Chaos City`;
    }
    this.backdrop.style.display = 'flex';
    this.render();
    void this.refreshData();
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.backdrop.style.display = 'none';
    this.backdrop.innerHTML = '';
    this.callbacks.onClose?.();
  }

  public async refreshData(): Promise<void> {
    if (!this.openState) return;
    this.loading = true;
    this.render();
    try {
      const [list, inv] = await Promise.all([
        multiplayerClient.fetchServerList().catch(() => []),
        multiplayerClient.fetchPendingInvites().catch(() => []),
      ]);
      this.servers = list;
      this.invites = inv;
    } finally {
      this.loading = false;
      if (this.openState) this.render();
    }
  }

  private launchIntoRoom(server: MultiplayerServerInfo, password?: string): void {
    const join: PendingMultiplayerJoin = {
      roomId: server.id,
      roomName: server.name,
      roomCode: server.roomCode,
      visibility: server.visibility,
      hostUid: server.hostUid,
      hostUsername: server.hostUsername,
      maxPlayers: server.maxPlayers,
      password: password || undefined,
    };
    gameSessionManager.enterMultiplayerMode(join);
    this.openState = false;
    this.backdrop.style.display = 'none';
    this.backdrop.innerHTML = '';
    this.callbacks.onLaunchMultiplayerCity();
  }

  private render(): void {
    if (!this.openState) return;
    const user = authSystem.getCurrentUser();
    const isOwner = ownerBadgeService.isVerifiedOwnerAccount(user?.uid, user?.username);

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-3xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#22355c] bg-gradient-to-r from-[#071124] via-[#0b1830] to-[#071124] shrink-0">
          <div>
            <div class="flex items-center gap-1.5 font-mono-tabular text-[11px] font-bold text-emerald-300">
              <span>ONLINE MULTIPLAYER HUB</span>
              ${user ? `<span>·</span><span>@${esc(user.username)}</span>` : ''}
              ${isOwner ? ownerBadgeService.renderBadgeHtml(true) : ''}
            </div>
            <h2 class="font-display text-lg sm:text-xl font-bold text-white">Chaos City Servers &amp; Lobbies</h2>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button id="cc-hub-friends" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[38px] border-fuchsia-400/50 text-fuchsia-200 cursor-pointer">
              Friends
            </button>
            <button id="cc-hub-refresh" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer">
              Refresh
            </button>
            <button id="cc-hub-back" type="button" class="cc-btn-secondary px-3.5 py-1.5 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer">
              Back to Menu
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex flex-wrap gap-1.5 px-5 py-2.5 border-b border-[#1c2d50] bg-[#070d1b] shrink-0">
          <button type="button" data-htab="browse" class="cc-hub-tab px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer ${
            this.tab === 'browse' ? 'bg-sky-500 text-[#050a14]' : 'cc-btn-secondary text-slate-300'
          }">Public Servers (${this.servers.length})</button>
          <button type="button" data-htab="create" class="cc-hub-tab px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer ${
            this.tab === 'create' ? 'bg-sky-500 text-[#050a14]' : 'cc-btn-secondary text-slate-300'
          }">Create Server</button>
          <button type="button" data-htab="code" class="cc-hub-tab px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer ${
            this.tab === 'code' ? 'bg-sky-500 text-[#050a14]' : 'cc-btn-secondary text-slate-300'
          }">Join by Room Code</button>
          <button type="button" data-htab="invites" class="cc-hub-tab px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer ${
            this.tab === 'invites' ? 'bg-sky-500 text-[#050a14]' : 'cc-btn-secondary text-slate-300'
          }">Server Invites${this.invites.length > 0 ? ` (${this.invites.length})` : ''}</button>
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
          ${this.renderContent(Boolean(user))}
        </div>
      </div>
    `;

    this.backdrop.querySelector('#cc-hub-back')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.close();
    });
    this.backdrop.querySelector('#cc-hub-friends')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onOpenFriends();
    });
    this.backdrop.querySelector('#cc-hub-refresh')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      void this.refreshData();
    });
    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-hub-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.htab as HubTab | undefined;
        if (!next) return;
        audioSystem.playButtonClick();
        this.tab = next;
        this.feedback = null;
        this.passwordPromptRoom = null;
        this.passwordPromptInvite = null;
        this.render();
      });
    });

    this.bindEvents();
  }

  private renderContent(signedIn: boolean): string {
    if (this.passwordPromptRoom || this.passwordPromptInvite) {
      const targetName = this.passwordPromptRoom?.name || this.passwordPromptInvite?.roomName || 'Server';
      return `
        <form id="cc-hub-pw-form" class="rounded-xl bg-[#091020] border border-amber-400/50 p-5 max-w-md mx-auto space-y-3">
          <div class="font-mono-tabular text-[11px] font-bold text-amber-300">PASSWORD REQUIRED</div>
          <h3 class="font-display text-base font-bold text-white">${esc(targetName)}</h3>
          <p class="text-xs text-slate-300">Enter the server password to join this room.</p>
          <input id="cc-hub-pw-input" type="password" value="${esc(this.promptPasswordDraft)}" placeholder="Server password" class="w-full rounded-xl bg-[#060b16] border border-[#2a3f6b] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400" />
          <div class="flex justify-end gap-2">
            <button id="cc-hub-pw-cancel" type="button" class="cc-btn-secondary px-4 py-2 rounded-xl text-xs font-semibold min-h-[40px] cursor-pointer">Cancel</button>
            <button type="submit" class="cc-btn-primary px-4 py-2 rounded-xl text-xs font-bold min-h-[40px] cursor-pointer" ${this.busy ? 'disabled' : ''}>
              ${this.busy ? 'Joining...' : 'Join Server'}
            </button>
          </div>
        </form>
      `;
    }

    if (this.tab === 'browse') {
      if (this.loading && this.servers.length === 0) {
        return `<div class="text-xs text-slate-400 py-8 text-center">Loading public servers...</div>`;
      }
      if (this.servers.length === 0) {
        return `
          <div class="rounded-xl bg-[#091020] border border-[#22355c] p-6 text-center space-y-2">
            <div class="text-sm font-semibold text-white">No public servers are active right now</div>
            <p class="text-xs text-slate-400">Create a Public or Private server on the Create Server tab to start playing online.</p>
          </div>
        `;
      }

      return `
        ${
          !signedIn
            ? `<div class="rounded-xl bg-amber-500/10 border border-amber-400/40 p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200">
                <span>Sign in with your CHAOS CITY account before joining or hosting an online server.</span>
                <button id="cc-hub-login-cta" type="button" class="cc-btn-primary px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer">Sign In</button>
              </div>`
            : ''
        }
        <div class="space-y-2.5">
          ${this.servers
            .map((s) => {
              const full = s.players >= s.maxPlayers;
              return `
                <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-display font-bold text-sm text-white">${esc(s.name)}</span>
                      ${
                        s.isOfficial
                          ? `<span class="px-2 py-0.5 rounded bg-sky-500/15 border border-sky-400/40 text-[10px] font-bold text-sky-300">OFFICIAL</span>`
                          : `<span class="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/40 text-[10px] font-bold text-emerald-300">HOST: @${esc(s.hostUsername)}</span>`
                      }
                      ${
                        s.hasPassword
                          ? `<span class="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-[10px] font-bold text-amber-200">🔒 PASSWORD</span>`
                          : ''
                      }
                    </div>
                    <div class="text-xs text-slate-400 mt-0.5 truncate">${esc(s.description || 'Public Chaos City multiplayer world')}</div>
                    <div class="font-mono-tabular text-[11px] text-slate-300 mt-1">
                      Players: <b class="${full ? 'text-rose-300' : 'text-emerald-300'}">${s.players}/${s.maxPlayers}</b>
                      ${s.roomCode ? ` · Code: <span class="text-sky-300 font-bold">${esc(s.roomCode)}</span>` : ''}
                    </div>
                  </div>
                  <button type="button" data-hjoin="${esc(s.id)}" ${full || this.busy ? 'disabled' : ''} class="${
                    full
                      ? 'px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-400 cursor-not-allowed'
                      : 'cc-hub-join cc-btn-primary px-4 py-2 rounded-xl text-xs font-bold min-h-[40px] cursor-pointer'
                  }">
                    ${full ? 'Server Full' : s.hasPassword ? 'Unlock & Join' : 'Join Server'}
                  </button>
                </div>
              `;
            })
            .join('')}
        </div>
      `;
    }

    if (this.tab === 'create') {
      if (!signedIn) {
        return `
          <div class="rounded-xl bg-[#091020] border border-amber-400/40 p-5 text-center space-y-3">
            <div class="font-display text-base font-bold text-white">Sign In Required to Host</div>
            <p class="text-xs text-slate-300">Creating a Public or Invite-Only server requires a verified CHAOS CITY account.</p>
            <button id="cc-hub-login-cta" type="button" class="cc-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold min-h-[42px] cursor-pointer">Sign In / Register</button>
          </div>
        `;
      }

      return `
        <form id="cc-hub-create-form" class="rounded-xl bg-[#091020] border border-[#22355c] p-4 sm:p-5 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Server Name</label>
              <input id="cc-hc-name" type="text" maxlength="36" required value="${esc(this.createName)}" placeholder="My Chaos City World" class="w-full rounded-xl bg-[#060b16] border border-[#2a3f6b] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Max Players (${this.createMaxPlayers})</label>
              <input id="cc-hc-max" type="range" min="2" max="12" value="${this.createMaxPlayers}" class="w-full accent-sky-400 mt-2.5" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1.5">Server Privacy</label>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button type="button" data-vis="public" class="cc-hc-vis text-left rounded-xl p-3 border cursor-pointer ${
                this.createVisibility === 'public'
                  ? 'bg-sky-500/15 border-sky-400 text-white'
                  : 'bg-[#060b16] border-[#22355c] text-slate-300'
              }">
                <div class="font-display font-bold text-xs">🌐 Public Server</div>
                <div class="text-[11px] text-slate-400 mt-0.5">Listed in Public Server Browser + joinable via Room Code.</div>
              </button>
              <button type="button" data-vis="invite_only" class="cc-hc-vis text-left rounded-xl p-3 border cursor-pointer ${
                this.createVisibility === 'invite_only'
                  ? 'bg-fuchsia-500/15 border-fuchsia-400 text-white'
                  : 'bg-[#060b16] border-[#22355c] text-slate-300'
              }">
                <div class="font-display font-bold text-xs">🔒 Private / Invite-Only</div>
                <div class="text-[11px] text-slate-400 mt-0.5">Hidden from Public Server Browser. Share Room Code or invite friends directly.</div>
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Password (Optional)</label>
              <input id="cc-hc-pw" type="password" maxlength="32" value="${esc(this.createPassword)}" placeholder="Leave blank for open access" class="w-full rounded-xl bg-[#060b16] border border-[#2a3f6b] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Description (Optional)</label>
              <input id="cc-hc-desc" type="text" maxlength="90" value="${esc(this.createDescription)}" placeholder="Cruising Downtown & racing!" class="w-full rounded-xl bg-[#060b16] border border-[#2a3f6b] px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400" />
            </div>
          </div>

          <div class="flex justify-end pt-1">
            <button type="submit" class="cc-btn-primary px-6 py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer" ${this.busy ? 'disabled' : ''}>
              ${this.busy ? 'Creating Room...' : 'Create & Enter Server'}
            </button>
          </div>
        </form>
      `;
    }

    if (this.tab === 'code') {
      return `
        <form id="cc-hub-code-form" class="rounded-xl bg-[#091020] border border-[#22355c] p-5 max-w-md mx-auto space-y-3.5">
          <div>
            <h3 class="font-display text-base font-bold text-white">Join Private or Public Server by Code</h3>
            <p class="text-xs text-slate-400 mt-0.5">Enter the 6-character Room Code shared by the host.</p>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Room Code</label>
            <input id="cc-hcode-input" type="text" maxlength="10" required value="${esc(this.joinCodeDraft)}" placeholder="ABC123" class="w-full rounded-xl bg-[#060b16] border border-[#2a3f6b] px-3.5 py-2.5 text-base font-mono-tabular uppercase tracking-widest text-white focus:outline-none focus:border-sky-400" />
          </div>
          ${
            this.codeRequiresPassword || this.joinCodePassword
              ? `<div>
                  <label class="block text-xs font-semibold text-amber-300 mb-1">Server Password</label>
                  <input id="cc-hcode-pw" type="password" value="${esc(this.joinCodePassword)}" placeholder="Enter room password" class="w-full rounded-xl bg-[#060b16] border border-amber-400/50 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400" />
                </div>`
              : ''
          }
          <div class="flex justify-end">
            <button type="submit" class="cc-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold min-h-[42px] cursor-pointer" ${this.busy ? 'disabled' : ''}>
              ${this.busy ? 'Verifying...' : 'Join Server'}
            </button>
          </div>
        </form>
      `;
    }

    // Invites Tab
    if (!signedIn) {
      return `<div class="rounded-xl bg-[#091020] border border-[#22355c] p-5 text-center text-xs text-slate-300">Sign in to receive and respond to friend server invites.</div>`;
    }
    if (this.invites.length === 0) {
      return `
        <div class="rounded-xl bg-[#091020] border border-[#22355c] p-6 text-center space-y-2">
          <div class="text-sm font-semibold text-white">No pending server invites</div>
          <p class="text-xs text-slate-400">When a friend invites you to their server, it appears here live.</p>
        </div>
      `;
    }
    return `
      <div class="space-y-2.5">
        ${this.invites
          .map(
            (inv) => `
          <div class="rounded-xl bg-[#091020] border border-fuchsia-400/45 p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="font-display font-bold text-sm text-white">${esc(inv.roomName)}</div>
              <div class="text-xs text-slate-300 mt-0.5">
                Invited by <b class="text-sky-300">@${esc(inv.fromUsername)}</b> ·
                <span>${inv.visibility === 'invite_only' ? 'Private / Invite-Only' : 'Public Server'}</span>
                ${inv.hasPassword ? ' · 🔒 Password Protected' : ''}
              </div>
            </div>
            <div class="flex gap-2">
              <button type="button" data-inv-acc="${esc(inv.inviteId)}" class="cc-inv-acc cc-btn-primary px-3.5 py-2 rounded-xl text-xs font-bold min-h-[38px] cursor-pointer">
                Accept &amp; Join
              </button>
              <button type="button" data-inv-dec="${esc(inv.inviteId)}" class="cc-inv-dec cc-btn-secondary px-3 py-2 rounded-xl text-xs font-semibold min-h-[38px] cursor-pointer">
                Decline
              </button>
            </div>
          </div>
        `,
          )
          .join('')}
      </div>
    `;
  }

  private bindEvents(): void {
    this.backdrop.querySelector('#cc-hub-login-cta')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.close();
      this.callbacks.onRequireLogin();
    });

    // Password modal submission
    const pwInput = this.backdrop.querySelector<HTMLInputElement>('#cc-hub-pw-input');
    pwInput?.addEventListener('input', () => {
      this.promptPasswordDraft = pwInput.value;
    });
    this.backdrop.querySelector('#cc-hub-pw-cancel')?.addEventListener('click', () => {
      this.passwordPromptRoom = null;
      this.passwordPromptInvite = null;
      this.promptPasswordDraft = '';
      this.render();
    });
    this.backdrop.querySelector('#cc-hub-pw-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (this.busy) return;
      const pw = this.promptPasswordDraft;
      this.busy = true;
      this.feedback = null;
      this.render();
      try {
        if (this.passwordPromptRoom) {
          const res = await multiplayerClient.verifyPublicServerAccess(this.passwordPromptRoom.id, pw);
          if (!res.ok || !res.server) {
            this.feedback = {text: res.error || 'Incorrect server password.', error: true};
            return;
          }
          this.launchIntoRoom(res.server, pw);
          return;
        }
        if (this.passwordPromptInvite) {
          const res = await multiplayerClient.respondToServerInvite(
            this.passwordPromptInvite.inviteId,
            'accept',
            pw,
          );
          if (!res.ok || !res.server) {
            this.feedback = {text: res.error || 'Incorrect server password.', error: true};
            return;
          }
          this.launchIntoRoom(res.server, pw);
        }
      } finally {
        this.busy = false;
        if (this.openState) this.render();
      }
    });

    // Public Server Join
    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-hub-join').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!authSystem.getCurrentUser()) {
          this.close();
          this.callbacks.onRequireLogin();
          return;
        }
        const room = this.servers.find((s) => s.id === btn.dataset.hjoin);
        if (!room || this.busy) return;
        audioSystem.playButtonClick();
        if (room.hasPassword) {
          this.passwordPromptRoom = room;
          this.promptPasswordDraft = '';
          this.feedback = null;
          this.render();
          return;
        }
        this.busy = true;
        this.render();
        try {
          const res = await multiplayerClient.verifyPublicServerAccess(room.id);
          if (!res.ok || !res.server) {
            this.feedback = {text: res.error || 'Unable to join server.', error: true};
            if (res.requiresPassword) {
              this.passwordPromptRoom = room;
              this.promptPasswordDraft = '';
            }
            return;
          }
          this.launchIntoRoom(res.server);
        } finally {
          this.busy = false;
          if (this.openState) this.render();
        }
      });
    });

    // Create Server form
    const nameEl = this.backdrop.querySelector<HTMLInputElement>('#cc-hc-name');
    const maxEl = this.backdrop.querySelector<HTMLInputElement>('#cc-hc-max');
    const cpwEl = this.backdrop.querySelector<HTMLInputElement>('#cc-hc-pw');
    const descEl = this.backdrop.querySelector<HTMLInputElement>('#cc-hc-desc');
    nameEl?.addEventListener('input', () => (this.createName = nameEl.value));
    maxEl?.addEventListener('input', () => {
      this.createMaxPlayers = Number(maxEl.value) || 8;
      this.render();
    });
    cpwEl?.addEventListener('input', () => (this.createPassword = cpwEl.value));
    descEl?.addEventListener('input', () => (this.createDescription = descEl.value));

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-hc-vis').forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.vis as ServerVisibility | undefined;
        if (!v) return;
        audioSystem.playButtonClick();
        this.createVisibility = v;
        this.render();
      });
    });

    this.backdrop.querySelector('#cc-hub-create-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (this.busy) return;
      this.busy = true;
      this.feedback = null;
      this.render();
      try {
        const res = await multiplayerClient.createServer({
          name: this.createName,
          visibility: this.createVisibility,
          maxPlayers: this.createMaxPlayers,
          password: this.createPassword,
          description: this.createDescription,
        });
        if (!res.ok || !res.server) {
          audioSystem.playError();
          this.feedback = {text: res.error || 'Could not create server.', error: true};
          return;
        }
        audioSystem.playInteract();
        this.launchIntoRoom(res.server, this.createPassword || undefined);
      } finally {
        this.busy = false;
        if (this.openState) this.render();
      }
    });

    // Join by Code
    const codeIn = this.backdrop.querySelector<HTMLInputElement>('#cc-hcode-input');
    const codePw = this.backdrop.querySelector<HTMLInputElement>('#cc-hcode-pw');
    codeIn?.addEventListener('input', () => (this.joinCodeDraft = codeIn.value.toUpperCase()));
    codePw?.addEventListener('input', () => (this.joinCodePassword = codePw.value));

    this.backdrop.querySelector('#cc-hub-code-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!authSystem.getCurrentUser()) {
        this.close();
        this.callbacks.onRequireLogin();
        return;
      }
      if (this.busy) return;
      this.busy = true;
      this.feedback = null;
      this.render();
      try {
        const res = await multiplayerClient.joinServerByCode(
          this.joinCodeDraft,
          this.joinCodePassword,
        );
        if (!res.ok || !res.server) {
          audioSystem.playError();
          this.codeRequiresPassword = Boolean(res.requiresPassword);
          this.feedback = {text: res.error || 'Invalid or expired Room Code.', error: true};
          return;
        }
        audioSystem.playInteract();
        this.launchIntoRoom(res.server, this.joinCodePassword || undefined);
      } finally {
        this.busy = false;
        if (this.openState) this.render();
      }
    });

    // Server Invites
    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-inv-acc').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const inv = this.invites.find((i) => i.inviteId === btn.dataset.invAcc);
        if (!inv || this.busy) return;
        if (inv.hasPassword) {
          this.passwordPromptInvite = inv;
          this.promptPasswordDraft = '';
          this.feedback = null;
          this.render();
          return;
        }
        this.busy = true;
        this.render();
        try {
          const res = await multiplayerClient.respondToServerInvite(inv.inviteId, 'accept');
          if (!res.ok || !res.server) {
            this.feedback = {text: res.error || 'Invite unavailable.', error: true};
            if (res.requiresPassword) {
              this.passwordPromptInvite = inv;
              this.promptPasswordDraft = '';
            }
            return;
          }
          this.launchIntoRoom(res.server);
        } finally {
          this.busy = false;
          if (this.openState) this.render();
        }
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-inv-dec').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.invDec;
        if (!id || this.busy) return;
        this.busy = true;
        try {
          await multiplayerClient.respondToServerInvite(id, 'decline');
          if (this.openState) await this.refreshData();
        } finally {
          this.busy = false;
        }
      });
    });
  }

  public destroy(): void {
    this.openState = false;
    this.backdrop.remove();
  }
}
