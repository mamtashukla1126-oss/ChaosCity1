import {MINI_GAMES_CATALOG} from '@/src/game/data/progressionData';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {authSystem} from '@/src/game/systems/AuthSystem';
import {friendsSystem, SocialGraphSnapshot} from '@/src/game/systems/FriendsSystem';
import {multiplayerClient} from '@/src/game/systems/MultiplayerClient';
import {ownerBadgeService} from '@/src/game/systems/OwnerBadgeService';
import {propertySystem} from '@/src/game/systems/PropertySystem';
import {
  EmoteId,
  MiniGameId,
  MultiplayerServerInfo,
  PublicPlayerProfile,
  RemotePlayerState,
  SharedActivityLobby,
} from '@/src/game/types/gameTypes';

export type SocialTab = 'servers' | 'chat' | 'friends' | 'lobbies';

export interface SocialModalCallbacks {
  getPlayerWorldPos: () => {x: number; y: number; interiorId?: string | null; propertyDeedId?: string | null};
  onViewProfile: (uid: string, profile?: PublicPlayerProfile | null, fallbackName?: string) => void;
  onTriggerEmote: (emoteId: EmoteId) => void;
  onLaunchSharedGame?: (lobby: SharedActivityLobby) => void;
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

const EMOTES: {id: EmoteId; icon: string; label: string}[] = [
  {id: 'wave', icon: '👋', label: 'Wave'},
  {id: 'dance', icon: '💃', label: 'Dance'},
  {id: 'cheer', icon: '🎉', label: 'Cheer'},
  {id: 'sit', icon: '🪑', label: 'Chill'},
  {id: 'heart', icon: '❤️', label: 'Heart'},
  {id: 'music', icon: '🎵', label: 'Vibe'},
];

export class SocialModal {
  private readonly backdrop: HTMLDivElement;
  private openState = false;
  private activeTab: SocialTab = 'servers';
  private servers: MultiplayerServerInfo[] = [];
  private loadingServers = false;
  private graph: SocialGraphSnapshot = {friends: [], incomingRequests: [], outgoingRequests: []};
  private loadingFriends = false;
  private searchQuery = '';
  private searchResult: {
    found: boolean;
    uid?: string;
    username?: string;
    profile?: PublicPlayerProfile | null;
    error?: string;
  } | null = null;
  private selectedLobbyActivity: MiniGameId = 'streetball';
  private inviteMenuTargetUid: string | null = null;
  private reportTarget: {uid: string; username: string} | null = null;
  private feedback: {text: string; error: boolean} | null = null;
  private actionBusy = false;

  private unsubStatus: (() => void) | null = null;
  private unsubPlayers: (() => void) | null = null;
  private unsubChat: (() => void) | null = null;
  private unsubLobbies: (() => void) | null = null;

  constructor(
    parent: HTMLElement,
    private readonly callbacks: SocialModalCallbacks,
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

    this.unsubStatus = multiplayerClient.onStatusChange(() => {
      if (this.openState) this.render();
    });
    this.unsubPlayers = multiplayerClient.onPlayersChange(() => {
      if (this.openState && (this.activeTab === 'chat' || this.activeTab === 'servers')) {
        this.render();
      }
    });
    this.unsubChat = multiplayerClient.onChatChange(() => {
      if (this.openState && this.activeTab === 'chat') {
        this.render();
      }
    });
    this.unsubLobbies = multiplayerClient.onLobbiesChange(() => {
      if (this.openState && this.activeTab === 'lobbies') {
        this.render();
      }
    });
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public open(initialTab: SocialTab = 'servers'): void {
    this.openState = true;
    this.actionBusy = false;
    this.activeTab = initialTab;
    this.feedback = null;
    this.reportTarget = null;
    this.inviteMenuTargetUid = null;
    this.backdrop.style.display = 'flex';
    void this.refreshServers();
    void this.refreshFriends();
    this.render();
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.backdrop.style.display = 'none';
    this.backdrop.innerHTML = '';
    this.callbacks.onClose?.();
  }

  private async refreshServers(): Promise<void> {
    this.loadingServers = true;
    if (this.openState && this.activeTab === 'servers') this.render();
    this.servers = await multiplayerClient.fetchServerList();
    this.loadingServers = false;
    if (this.openState && this.activeTab === 'servers') this.render();
  }

  private async refreshFriends(): Promise<void> {
    if (!authSystem.getCurrentUser()) {
      this.graph = {friends: [], incomingRequests: [], outgoingRequests: []};
      return;
    }
    this.loadingFriends = true;
    if (this.openState && this.activeTab === 'friends') this.render();
    this.graph = await friendsSystem.loadSocialGraph();
    this.loadingFriends = false;
    if (this.openState && this.activeTab === 'friends') this.render();
  }

  private render(): void {
    if (!this.openState) return;
    const status = multiplayerClient.getStatus();
    const user = authSystem.getCurrentUser();
    const selfIsOwner = status.selfIsOwner || ownerBadgeService.isVerifiedOwnerAccount(user?.uid, user?.username);

    const statusColor =
      status.status === 'connected'
        ? 'text-emerald-300'
        : status.status === 'connecting'
          ? 'text-sky-300'
          : 'text-amber-300';

    const statusLabel =
      status.status === 'connected'
        ? `${esc(status.roomName)} (${status.playerCount}/${status.maxPlayers})${status.pingMs ? ` · ${status.pingMs}ms` : ''}`
        : status.status === 'connecting'
          ? 'Connecting...'
          : user
            ? 'Disconnected (Local Mode)'
            : 'Guest (Sign in for Multiplayer)';

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-4xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
        <!-- Header -->
        <div class="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[#22355c] shrink-0">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="font-display text-lg sm:text-xl font-bold text-white">Chaos City Multiplayer & Social</h2>
              ${selfIsOwner ? ownerBadgeService.renderBadgeHtml(true) : ''}
            </div>
            <div class="font-mono-tabular text-[11px] font-semibold ${statusColor} truncate">
              ${statusLabel}
            </div>
          </div>
          <button id="cc-soc-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[42px] cursor-pointer shrink-0">
            Close
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex flex-wrap gap-1.5 px-4 sm:px-5 py-2.5 bg-[#091020] border-b border-[#22355c] shrink-0">
          ${(
            [
              {id: 'servers', label: 'Live Servers'},
              {id: 'chat', label: `City Chat & Citizens (${multiplayerClient.getRemotePlayers().length})`},
              {id: 'friends', label: `Friends (${this.graph.friends.length}${this.graph.incomingRequests.length ? ` · +${this.graph.incomingRequests.length}` : ''})`},
              {id: 'lobbies', label: `Shared Lobbies (${multiplayerClient.getLobbies().length})`},
            ] as {id: SocialTab; label: string}[]
          )
            .map(
              (t) => `
                <button type="button" data-soc-tab="${t.id}" class="cc-soc-tab px-3.5 py-2 rounded-lg text-xs font-bold min-h-[38px] cursor-pointer ${
                  t.id === this.activeTab
                    ? 'bg-sky-500 text-[#06101f]'
                    : 'bg-[#131f38] text-slate-300 border border-[#22355c] hover:text-white'
                }">${t.label}</button>
              `,
            )
            .join('')}
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
          ${this.renderActiveTab()}
        </div>
      </div>
    `;

    this.backdrop.querySelector('#cc-soc-close')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.close();
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-soc-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.activeTab = (btn.dataset.socTab as SocialTab) || 'servers';
        this.feedback = null;
        this.reportTarget = null;
        if (this.activeTab === 'servers') void this.refreshServers();
        if (this.activeTab === 'friends') void this.refreshFriends();
        this.render();
      });
    });

    this.bindTabEvents();
  }

  private renderActiveTab(): string {
    if (this.activeTab === 'servers') return this.renderServersTab();
    if (this.activeTab === 'chat') return this.renderChatTab();
    if (this.activeTab === 'friends') return this.renderFriendsTab();
    return this.renderLobbiesTab();
  }

  private renderServersTab(): string {
    const status = multiplayerClient.getStatus();
    const user = authSystem.getCurrentUser();

    return `
      ${
        !user
          ? `<div class="rounded-xl bg-amber-500/12 border border-amber-400/50 p-4 text-xs text-amber-200 space-y-1">
              <div class="font-display font-bold text-sm text-white">Account Required for Real-Time Multiplayer</div>
              <p>Sign in with a verified username/password account on the Main Menu to join live city servers, sync real players, chat, and visit friends' properties.</p>
            </div>`
          : ''
      }

      ${
        status.lastError && status.status !== 'connected'
          ? `<div class="rounded-xl bg-rose-500/12 border border-rose-400/50 p-3 text-xs text-rose-200">
              ${esc(status.lastError)}
            </div>`
          : ''
      }

      <div class="flex items-center justify-between gap-2">
        <div class="font-mono-tabular text-[11px] font-bold uppercase tracking-wider text-sky-300">
          Authoritative City Rooms (Max 12 Players / Room)
        </div>
        <div class="flex items-center gap-2">
          ${
            status.status === 'connected'
              ? `<button id="cc-soc-disconn" type="button" class="px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-400/50 text-xs font-bold text-rose-200 min-h-[34px] cursor-pointer">Disconnect</button>`
              : ''
          }
          <button id="cc-soc-refresh-srv" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[34px] cursor-pointer">
            ${this.loadingServers ? 'Refreshing...' : 'Refresh List'}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        ${
          this.servers.length === 0 && !this.loadingServers
            ? `<div class="col-span-full rounded-xl bg-[#091020] border border-[#22355c] p-5 text-center text-xs text-slate-400">
                No multiplayer servers responded right now. Verify the Express WebSocket server is running on port 3000.
              </div>`
            : this.servers
                .map((srv) => {
                  const isCurrent = status.status === 'connected' && status.roomId === srv.id;
                  const isFull = srv.players >= srv.maxPlayers && !isCurrent;
                  return `
                    <div class="rounded-xl bg-[#091020] border ${
                      isCurrent ? 'border-emerald-400' : isFull ? 'border-rose-500/40' : 'border-[#22355c]'
                    } p-4 flex flex-col justify-between gap-3">
                      <div>
                        <div class="flex items-center justify-between gap-2">
                          <span class="font-mono-tabular text-[10px] font-bold uppercase ${
                            isCurrent ? 'text-emerald-300' : isFull ? 'text-rose-300' : 'text-sky-300'
                          }">${isCurrent ? 'CONNECTED' : isFull ? 'FULL' : 'LIVE ROOM'}</span>
                          <span class="font-mono-tabular text-xs font-bold text-white">${srv.players}/${srv.maxPlayers}</span>
                        </div>
                        <h3 class="font-display text-base font-bold text-white mt-1">${esc(srv.name)}</h3>
                        <p class="text-[11px] text-slate-400 mt-0.5">${esc(srv.region)} · ID: ${esc(srv.id)}</p>
                      </div>
                      <button type="button" data-join-room="${esc(srv.id)}" ${!user || isCurrent || isFull ? 'disabled' : ''} class="${
                        isCurrent
                          ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 px-3 py-2 rounded-xl text-xs font-bold min-h-[40px]'
                          : 'cc-btn-primary px-3 py-2 rounded-xl text-xs font-bold min-h-[40px] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed'
                      }">
                        ${isCurrent ? 'Current Room' : isFull ? 'Room Full (12/12)' : status.status === 'connected' ? 'Switch Room' : 'Connect'}
                      </button>
                    </div>
                  `;
                })
                .join('')
        }
      </div>
    `;
  }

  private renderChatTab(): string {
    const status = multiplayerClient.getStatus();
    const remotes = multiplayerClient.getRemotePlayers();
    const messages = multiplayerClient.getChatLog();

    return `
      <!-- Emote Strip -->
      <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3">
        <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-sky-300 mb-2">
          Quick Character Emotes (Visible Live to Nearby Players)
        </div>
        <div class="flex flex-wrap gap-2">
          ${EMOTES.map(
            (em) => `
              <button type="button" data-emote="${em.id}" class="cc-soc-emote cc-btn-secondary px-3 py-2 rounded-xl text-xs font-bold min-h-[38px] flex items-center gap-1.5 cursor-pointer">
                <span>${em.icon}</span>
                <span>${em.label}</span>
              </button>
            `,
          ).join('')}
        </div>
      </div>

      ${
        this.reportTarget
          ? `<div class="rounded-xl bg-rose-950/50 border border-rose-400/60 p-4 space-y-2.5">
              <div class="flex items-center justify-between">
                <div class="font-display font-bold text-sm text-white">Report Player: @${esc(this.reportTarget.username)}</div>
                <button id="cc-rep-cancel" type="button" class="text-xs text-slate-300 hover:text-white cursor-pointer">Cancel</button>
              </div>
              <select id="cc-rep-reason" class="w-full rounded-lg bg-[#060b16] border border-[#2c4474] px-3 py-2 text-xs text-white">
                <option value="Harassment or abusive chat">Harassment or abusive chat</option>
                <option value="Impersonation / Fake Owner claims">Impersonation / Fake Owner claims</option>
                <option value="Cheating or speed exploit">Cheating or speed exploit</option>
                <option value="Spamming">Spamming</option>
              </select>
              <input id="cc-rep-details" type="text" maxlength="200" placeholder="Optional details..." class="w-full rounded-lg bg-[#060b16] border border-[#2c4474] px-3 py-2 text-xs text-white" />
              <div class="flex justify-end gap-2">
                <button id="cc-rep-submit" type="button" class="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white cursor-pointer">Submit Safety Report</button>
              </div>
            </div>`
          : ''
      }

      <div class="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <!-- Live Room Chat -->
        <div class="lg:col-span-3 rounded-xl bg-[#091020] border border-[#22355c] p-3 flex flex-col justify-between gap-2.5 min-h-[260px]">
          <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-amber-300">
            Live Room Chat (Filtered & Rate-Limited)
          </div>
          <div id="cc-soc-chatlog" class="flex-1 max-h-56 overflow-y-auto space-y-1.5 pr-1 text-xs">
            ${
              messages.length === 0
                ? `<div class="text-slate-500 py-8 text-center">No messages yet. Say hello to CHAOS CITY!</div>`
                : messages
                    .map((m) => {
                      const verifiedOwner = ownerBadgeService.isVerifiedOwnerAccount(m.uid, m.username, m.isOwner);
                      return `
                        <div class="rounded-lg bg-[#0e172c] px-2.5 py-1.5 border border-[#1a2947]">
                          <div class="flex flex-wrap items-center gap-1.5">
                            ${verifiedOwner ? ownerBadgeService.renderBadgeHtml(true) : ''}
                            <span class="font-bold text-sky-300">${esc(m.displayName)}</span>
                            <span class="text-[10px] text-slate-500">@${esc(m.username)}</span>
                          </div>
                          <div class="text-slate-100 break-words mt-0.5">${esc(m.text)}</div>
                        </div>
                      `;
                    })
                    .join('')
            }
          </div>

          <form id="cc-soc-chatform" class="flex gap-2">
            <input id="cc-soc-chatinput" type="text" maxlength="160" placeholder="${
              status.status === 'connected' ? 'Message room citizens...' : 'Connect to a live server to chat'
            }" ${status.status === 'connected' ? '' : 'disabled'} class="flex-1 rounded-lg bg-[#060b16] border border-[#2c4474] px-3 py-2 text-xs text-white focus:border-sky-400 outline-none disabled:opacity-50" />
            <button type="submit" ${status.status === 'connected' ? '' : 'disabled'} class="cc-btn-primary px-4 py-2 rounded-lg text-xs font-bold min-h-[38px] cursor-pointer disabled:opacity-50">
              Send
            </button>
          </form>
        </div>

        <!-- Online Players in Room -->
        <div class="lg:col-span-2 rounded-xl bg-[#091020] border border-[#22355c] p-3 space-y-2 max-h-[330px] overflow-y-auto">
          <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            Online Citizens in Room (${remotes.length})
          </div>
          ${
            remotes.length === 0
              ? `<div class="text-xs text-slate-400 py-6 text-center">No other players are currently in this room.</div>`
              : remotes
                  .map((p) => this.renderRemotePlayerRow(p))
                  .join('')
          }
        </div>
      </div>
    `;
  }

  private renderRemotePlayerRow(p: RemotePlayerState): string {
    const isOwner = ownerBadgeService.isVerifiedOwnerAccount(p.uid, p.username, p.isOwner);
    const muted = multiplayerClient.isMuted(p.uid);
    const ownedProps = propertySystem.getOwnedPropertyDefs();
    const showInviteDrop = this.inviteMenuTargetUid === p.uid;

    return `
      <div class="rounded-xl bg-[#0e172c] border border-[#1d2e52] p-2.5 space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1">
              ${isOwner ? ownerBadgeService.renderBadgeHtml(true) : ''}
              <span class="font-display font-bold text-xs text-white truncate">${esc(p.displayName)}</span>
            </div>
            <div class="text-[10px] text-slate-400 truncate">@${esc(p.username)} · Lv.${p.level} · ${esc(p.interiorId ? 'Indoors' : 'City')}</div>
          </div>
        </div>
        <div class="flex flex-wrap gap-1">
          <button type="button" data-pview="${esc(p.uid)}" class="cc-p-view px-2 py-1 rounded bg-sky-500/20 border border-sky-400/50 text-[10px] font-bold text-sky-200 cursor-pointer">Profile</button>
          <button type="button" data-padd="${esc(p.uid)}" data-puname="${esc(p.username)}" class="cc-p-add px-2 py-1 rounded bg-emerald-500/20 border border-emerald-400/50 text-[10px] font-bold text-emerald-200 cursor-pointer">Friend</button>
          ${
            p.vehicle && !p.interiorId
              ? `<button type="button" data-pride="${esc(p.uid)}" class="cc-p-ride px-2 py-1 rounded bg-orange-500/20 border border-orange-400/50 text-[10px] font-bold text-orange-200 cursor-pointer">Ride</button>`
              : ''
          }
          ${
            ownedProps.length > 0
              ? `<button type="button" data-pinvtog="${esc(p.uid)}" class="cc-p-invtog px-2 py-1 rounded bg-fuchsia-500/20 border border-fuchsia-400/50 text-[10px] font-bold text-fuchsia-200 cursor-pointer">Invite</button>`
              : ''
          }
          <button type="button" data-pmute="${esc(p.uid)}" class="cc-p-mute px-2 py-1 rounded bg-slate-700/60 text-[10px] font-semibold text-slate-200 cursor-pointer">${muted ? 'Unmute' : 'Mute'}</button>
          <button type="button" data-pblock="${esc(p.uid)}" class="cc-p-block px-2 py-1 rounded bg-rose-500/20 text-[10px] font-semibold text-rose-200 cursor-pointer">Block</button>
          <button type="button" data-prep="${esc(p.uid)}" data-puname="${esc(p.username)}" class="cc-p-rep px-2 py-1 rounded bg-amber-500/20 text-[10px] font-semibold text-amber-200 cursor-pointer">Report</button>
        </div>
        ${
          showInviteDrop && ownedProps.length > 0
            ? `<div class="pt-1 border-t border-[#22355c] flex flex-wrap gap-1">
                ${ownedProps
                  .map(
                    (prop) => `
                      <button type="button" data-pinvsend="${esc(p.uid)}" data-propid="${esc(prop.id)}" data-propname="${esc(prop.name)}" class="cc-p-invsend px-2 py-1 rounded bg-sky-500 text-[#06101f] text-[10px] font-bold cursor-pointer">Send Invite: ${esc(prop.name)}</button>
                    `,
                  )
                  .join('')}
              </div>`
            : ''
        }
      </div>
    `;
  }

  private renderFriendsTab(): string {
    const user = authSystem.getCurrentUser();
    if (!user) {
      return `
        <div class="rounded-xl bg-[#091020] border border-[#22355c] p-5 text-center text-xs text-slate-300">
          Sign in with your CHAOS CITY account to search players, add persistent friends, and manage requests.
        </div>
      `;
    }

    const ownedProps = propertySystem.getOwnedPropertyDefs();

    return `
      <!-- Search by Exact Username -->
      <form id="cc-fr-searchform" class="rounded-xl bg-[#091020] border border-[#22355c] p-3.5 space-y-2.5">
        <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-sky-300">Find Citizen by Username</div>
        <div class="flex gap-2">
          <input id="cc-fr-searchinput" type="text" maxlength="20" value="${esc(this.searchQuery)}" placeholder="Enter exact username..." class="flex-1 rounded-lg bg-[#060b16] border border-[#2c4474] px-3 py-2 text-xs text-white focus:border-sky-400 outline-none" />
          <button type="submit" class="cc-btn-primary px-4 py-2 rounded-lg text-xs font-bold min-h-[38px] cursor-pointer">Search</button>
        </div>
        ${
          this.searchResult
            ? this.searchResult.found && this.searchResult.uid
              ? `<div class="rounded-xl bg-[#0e172c] border border-emerald-400/50 p-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div class="flex items-center gap-1.5">
                      ${
                        ownerBadgeService.isVerifiedOwnerAccount(this.searchResult.uid, this.searchResult.username)
                          ? ownerBadgeService.renderBadgeHtml(true)
                          : ''
                      }
                      <span class="font-display font-bold text-sm text-white">@${esc(this.searchResult.username)}</span>
                    </div>
                    <div class="text-[11px] text-slate-300">
                      ${
                        this.searchResult.profile
                          ? `Lv.${this.searchResult.profile.level} · "${esc(this.searchResult.profile.selectedTitle)}"`
                          : 'Registered CHAOS CITY Account'
                      }
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button type="button" data-sview="${esc(this.searchResult.uid)}" class="cc-fr-sview cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">View Profile</button>
                    <button type="button" data-sadd="${esc(this.searchResult.uid)}" data-suname="${esc(this.searchResult.username)}" class="cc-fr-sadd cc-btn-primary px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer">Add Friend</button>
                  </div>
                </div>`
              : `<div class="text-xs text-amber-300">${esc(this.searchResult.error || 'No citizen found.')}</div>`
            : ''
        }
      </form>

      ${
        this.graph.incomingRequests.length > 0
          ? `<div class="space-y-2">
              <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-amber-300">Incoming Friend Requests (${this.graph.incomingRequests.length})</div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                ${this.graph.incomingRequests
                  .map(
                    (req) => `
                      <div class="rounded-xl bg-[#091020] border border-amber-400/50 p-3 flex items-center justify-between gap-2">
                        <div>
                          <div class="font-display font-bold text-xs text-white">@${esc(req.senderUsername)}</div>
                          <div class="text-[10px] text-slate-400">Wants to connect</div>
                        </div>
                        <div class="flex gap-1.5">
                          <button type="button" data-req-acc="${esc(req.requestId)}" class="cc-fr-acc cc-btn-primary px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer">Accept</button>
                          <button type="button" data-req-dec="${esc(req.requestId)}" class="cc-fr-dec px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-200 text-[11px] font-semibold cursor-pointer">Decline</button>
                        </div>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            </div>`
          : ''
      }

      ${
        this.graph.outgoingRequests.length > 0
          ? `<div class="space-y-2">
              <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-slate-400">Sent Pending Requests (${this.graph.outgoingRequests.length})</div>
              <div class="flex flex-wrap gap-2">
                ${this.graph.outgoingRequests
                  .map(
                    (req) => `
                      <div class="rounded-lg bg-[#091020] border border-[#22355c] px-3 py-1.5 flex items-center gap-2 text-xs">
                        <span>@${esc(req.receiverUsername)}</span>
                        <button type="button" data-req-can="${esc(req.requestId)}" class="cc-fr-can text-rose-300 hover:text-rose-200 text-[11px] font-bold cursor-pointer">Cancel</button>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            </div>`
          : ''
      }

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-emerald-300">Friends List (${this.graph.friends.length})</div>
          <button id="cc-fr-refresh" type="button" class="cc-btn-secondary px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer">
            ${this.loadingFriends ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        ${
          this.graph.friends.length === 0
            ? `<div class="rounded-xl bg-[#091020] border border-[#22355c] p-5 text-center text-xs text-slate-400">
                No persistent friends yet. Search for a citizen's username above or click any live player!
              </div>`
            : `<div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                ${this.graph.friends
                  .map((f) => {
                    const isOnline = Boolean(f.profile?.isOnline && f.profile?.onlineServerId);
                    const isOwner = ownerBadgeService.isVerifiedOwnerAccount(f.uid, f.username);
                    return `
                      <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3 space-y-2">
                        <div class="flex items-center justify-between gap-2">
                          <div class="min-w-0">
                            <div class="flex items-center gap-1.5">
                              ${isOwner ? ownerBadgeService.renderBadgeHtml(true) : ''}
                              <span class="font-display font-bold text-sm text-white truncate">${esc(f.profile?.displayName || f.username)}</span>
                              <span class="text-[10px] text-slate-400">@${esc(f.username)}</span>
                            </div>
                            <div class="text-[11px] ${isOnline ? 'text-emerald-300' : 'text-slate-500'}">
                              ${isOnline ? `Online in ${esc(f.profile?.onlineServerId)}` : 'Offline'}
                              ${f.profile ? ` · Lv.${f.profile.level}` : ''}
                            </div>
                          </div>
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                          <button type="button" data-fview="${esc(f.uid)}" class="cc-f-view cc-btn-secondary px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer">Profile</button>
                          ${
                            ownedProps.length > 0 && isOnline
                              ? `<button type="button" data-finvite="${esc(f.uid)}" data-propid="${esc(ownedProps[0].id)}" data-propname="${esc(ownedProps[0].name)}" class="cc-f-inv cc-btn-primary px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer">Invite to ${esc(ownedProps[0].name)}</button>`
                              : ''
                          }
                          <button type="button" data-frem="${esc(f.pairId)}" class="cc-f-rem px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-400/40 text-rose-200 text-[11px] font-semibold cursor-pointer">Remove</button>
                        </div>
                      </div>
                    `;
                  })
                  .join('')}
              </div>`
        }
      </div>
    `;
  }

  private renderLobbiesTab(): string {
    const status = multiplayerClient.getStatus();
    const lobbies = multiplayerClient.getLobbies();
    const selfUid = status.selfUid || '';

    const sharedGames = MINI_GAMES_CATALOG.filter((g) =>
      ['streetball', 'soccer_penalty', 'fountain_flip', 'memory_matrix', 'reflex_surge', 'starlight_drift'].includes(
        g.id,
      ),
    );

    return `
      <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3.5 space-y-2.5">
        <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-fuchsia-300">
          Host a Live Shared Activity Lobby
        </div>
        <div class="flex flex-wrap gap-2">
          <select id="cc-lob-game" class="flex-1 min-w-[200px] rounded-lg bg-[#060b16] border border-[#2c4474] px-3 py-2 text-xs text-white">
            ${sharedGames
              .map(
                (g) => `<option value="${g.id}" ${g.id === this.selectedLobbyActivity ? 'selected' : ''}>${esc(g.name)} — ${esc(g.rewardText)}</option>`,
              )
              .join('')}
          </select>
          <button id="cc-lob-create" type="button" ${status.status === 'connected' ? '' : 'disabled'} class="cc-btn-primary px-4 py-2 rounded-lg text-xs font-bold min-h-[38px] cursor-pointer disabled:opacity-45">
            Create Lobby
          </button>
        </div>
      </div>

      <div class="space-y-2.5">
        <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-sky-300">
          Active Room Lobbies (${lobbies.length})
        </div>
        ${
          lobbies.length === 0
            ? `<div class="rounded-xl bg-[#091020] border border-[#22355c] p-5 text-center text-xs text-slate-400">
                No active shared lobbies in this server right now. Create one above!
              </div>`
            : lobbies
                .map((lob) => {
                  const inLobby = lob.players.some((pt) => pt.uid === selfUid);
                  const isHost = lob.hostUid === selfUid;
                  return `
                    <div class="rounded-xl bg-[#091020] border ${
                      inLobby ? 'border-emerald-400/60' : 'border-[#22355c]'
                    } p-3.5 space-y-2.5">
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div class="font-mono-tabular text-[10px] font-bold uppercase text-fuchsia-300">
                            ${esc(lob.status)} · Host: ${esc(lob.hostName)}
                          </div>
                          <h4 class="font-display font-bold text-sm text-white">${esc(lob.title)}</h4>
                        </div>
                        <div class="flex flex-wrap gap-1.5">
                          ${
                            !inLobby && lob.status === 'waiting'
                              ? `<button type="button" data-lob-join="${esc(lob.lobbyId)}" class="cc-lob-join cc-btn-primary px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer">Join</button>`
                              : ''
                          }
                          ${
                            inLobby && isHost && lob.status === 'waiting'
                              ? `<button type="button" data-lob-start="${esc(lob.lobbyId)}" class="cc-lob-start cc-btn-primary px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer">Start Match</button>`
                              : ''
                          }
                          ${
                            inLobby
                              ? `<button type="button" data-lob-leave="${esc(lob.lobbyId)}" class="cc-lob-leave px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-200 text-xs font-semibold cursor-pointer">Leave</button>`
                              : ''
                          }
                        </div>
                      </div>
                      <div class="flex flex-wrap gap-1.5 text-[11px]">
                        ${lob.players
                          .map(
                            (pt) => `<span class="px-2 py-0.5 rounded bg-[#131f38] border border-[#22355c] text-slate-200">${esc(pt.displayName)}${
                              pt.finished ? ` · <b>${pt.score} pts</b>` : ''
                            }</span>`,
                          )
                          .join('')}
                      </div>
                    </div>
                  `;
                })
                .join('')
        }
      </div>
    `;
  }

  private bindTabEvents(): void {
    // Servers tab
    this.backdrop.querySelector('#cc-soc-refresh-srv')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      void this.refreshServers();
    });
    this.backdrop.querySelector('#cc-soc-disconn')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      multiplayerClient.disconnect(true);
      this.feedback = {text: 'Disconnected from live server (Singleplayer mode).', error: false};
      this.render();
    });
    this.backdrop.querySelectorAll<HTMLButtonElement>('[data-join-room]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const roomId = btn.dataset.joinRoom;
        if (!roomId) return;
        audioSystem.playInteract();
        const pos = this.callbacks.getPlayerWorldPos();
        void multiplayerClient.connect(roomId, pos);
      });
    });

    // Chat & Citizens tab
    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-soc-emote').forEach((btn) => {
      btn.addEventListener('click', () => {
        const em = btn.dataset.emote as EmoteId | undefined;
        if (!em) return;
        audioSystem.playInteract();
        this.callbacks.onTriggerEmote(em);
        this.feedback = {text: `Performed ${em} emote!`, error: false};
        this.render();
      });
    });

    const chatForm = this.backdrop.querySelector('#cc-soc-chatform');
    chatForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = this.backdrop.querySelector<HTMLInputElement>('#cc-soc-chatinput');
      if (!input) return;
      const text = input.value.trim();
      if (!text) return;
      if (multiplayerClient.sendChat(text)) {
        input.value = '';
        audioSystem.playButtonClick();
      } else {
        this.feedback = {text: 'Connect to a live server first.', error: true};
        this.render();
      }
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-p-view').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.pview;
        if (!uid) return;
        const p = multiplayerClient.getRemotePlayerByUid(uid);
        this.close();
        this.callbacks.onViewProfile(uid, null, p?.displayName || p?.username);
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-p-add').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (this.actionBusy || !this.openState) return;
        const uid = btn.dataset.padd;
        const uname = btn.dataset.puname || 'Citizen';
        if (!uid) return;
        this.actionBusy = true;
        try {
          audioSystem.playInteract();
          const res = await friendsSystem.sendFriendRequest(uid, uname);
          if (!this.openState) return;
          this.feedback = {text: res.message, error: !res.ok};
          this.render();
        } finally {
          this.actionBusy = false;
        }
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-p-ride').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.pride;
        if (!uid) return;
        audioSystem.playInteract();
        multiplayerClient.requestRide(uid);
        this.close();
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-p-invtog').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.pinvtog || null;
        this.inviteMenuTargetUid = this.inviteMenuTargetUid === uid ? null : uid;
        audioSystem.playButtonClick();
        this.render();
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-p-invsend').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.pinvsend;
        const propId = btn.dataset.propid;
        const propName = btn.dataset.propname || 'Home';
        const selfUid = authSystem.getCurrentUser()?.uid;
        if (!uid || !propId || !selfUid) return;
        const deedId = propertySystem.makeDeedId(selfUid, propId);
        void propertySystem.invitePlayerToProperty(propId, uid);
        multiplayerClient.sendPropertyInvite(uid, deedId, propName);
        audioSystem.playInteract();
        this.inviteMenuTargetUid = null;
        this.feedback = {text: `Sent property invite to ${propName}!`, error: false};
        this.render();
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-p-mute').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (this.actionBusy || !this.openState) return;
        const uid = btn.dataset.pmute;
        if (!uid) return;
        this.actionBusy = true;
        try {
          const nowMuted = await multiplayerClient.toggleMuteUser(uid);
          if (!this.openState) return;
          this.feedback = {text: nowMuted ? 'Player muted.' : 'Player unmuted.', error: false};
          this.render();
        } finally {
          this.actionBusy = false;
        }
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-p-block').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (this.actionBusy || !this.openState) return;
        const uid = btn.dataset.pblock;
        if (!uid) return;
        this.actionBusy = true;
        try {
          const nowBlocked = await multiplayerClient.toggleBlockUser(uid);
          if (!this.openState) return;
          this.feedback = {text: nowBlocked ? 'Player blocked.' : 'Player unblocked.', error: false};
          this.render();
        } finally {
          this.actionBusy = false;
        }
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-p-rep').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.prep;
        const username = btn.dataset.puname || 'Citizen';
        if (!uid) return;
        this.reportTarget = {uid, username};
        this.render();
      });
    });

    this.backdrop.querySelector('#cc-rep-cancel')?.addEventListener('click', () => {
      this.reportTarget = null;
      this.render();
    });
    this.backdrop.querySelector('#cc-rep-submit')?.addEventListener('click', async () => {
      if (this.actionBusy || !this.openState || !this.reportTarget) return;
      this.actionBusy = true;
      try {
        const reasonEl = this.backdrop.querySelector<HTMLSelectElement>('#cc-rep-reason');
        const detailsEl = this.backdrop.querySelector<HTMLInputElement>('#cc-rep-details');
        const res = await multiplayerClient.submitReport(
          this.reportTarget.uid,
          this.reportTarget.username,
          reasonEl?.value || 'Abuse',
          detailsEl?.value || '',
        );
        if (!this.openState) return;
        this.reportTarget = null;
        this.feedback = {text: res.message, error: !res.ok};
        this.render();
      } finally {
        this.actionBusy = false;
      }
    });

    // Friends tab
    this.backdrop.querySelector('#cc-fr-searchform')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (this.actionBusy || !this.openState) return;
      this.actionBusy = true;
      try {
        const input = this.backdrop.querySelector<HTMLInputElement>('#cc-fr-searchinput');
        this.searchQuery = input?.value.trim() || '';
        audioSystem.playButtonClick();
        const res = await friendsSystem.searchByUsername(this.searchQuery);
        if (!this.openState) return;
        this.searchResult = res;
        this.render();
      } finally {
        this.actionBusy = false;
      }
    });

    this.backdrop.querySelector('.cc-fr-sview')?.addEventListener('click', (e) => {
      const uid = (e.currentTarget as HTMLButtonElement).dataset.sview;
      if (!uid) return;
      const res = this.searchResult;
      this.close();
      this.callbacks.onViewProfile(uid, res?.profile ?? null, res?.username);
    });

    this.backdrop.querySelector('.cc-fr-sadd')?.addEventListener('click', async (e) => {
      if (this.actionBusy || !this.openState) return;
      const btn = e.currentTarget as HTMLButtonElement;
      const uid = btn.dataset.sadd;
      const uname = btn.dataset.suname || 'Citizen';
      if (!uid) return;
      this.actionBusy = true;
      try {
        const res = await friendsSystem.sendFriendRequest(uid, uname);
        if (!this.openState) return;
        this.feedback = {text: res.message, error: !res.ok};
        await this.refreshFriends();
        if (this.openState) this.render();
      } finally {
        this.actionBusy = false;
      }
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-fr-acc').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (this.actionBusy || !this.openState) return;
        const req = this.graph.incomingRequests.find((r) => r.requestId === btn.dataset.reqAcc);
        if (!req) return;
        this.actionBusy = true;
        try {
          const res = await friendsSystem.acceptFriendRequest(req);
          if (!this.openState) return;
          this.feedback = {text: res.message, error: !res.ok};
          await this.refreshFriends();
        } finally {
          this.actionBusy = false;
        }
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-fr-dec').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (this.actionBusy || !this.openState) return;
        const id = btn.dataset.reqDec;
        if (!id) return;
        this.actionBusy = true;
        try {
          await friendsSystem.declineFriendRequest(id);
          if (this.openState) await this.refreshFriends();
        } finally {
          this.actionBusy = false;
        }
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-fr-can').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (this.actionBusy || !this.openState) return;
        const id = btn.dataset.reqCan;
        if (!id) return;
        this.actionBusy = true;
        try {
          await friendsSystem.cancelFriendRequest(id);
          if (this.openState) await this.refreshFriends();
        } finally {
          this.actionBusy = false;
        }
      });
    });

    this.backdrop.querySelector('#cc-fr-refresh')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      void this.refreshFriends();
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-f-view').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.fview;
        if (!uid) return;
        const fr = this.graph.friends.find((x) => x.uid === uid);
        this.close();
        this.callbacks.onViewProfile(uid, fr?.profile ?? null, fr?.username);
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-f-inv').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.finvite;
        const propId = btn.dataset.propid;
        const propName = btn.dataset.propname || 'Home';
        const selfUid = authSystem.getCurrentUser()?.uid;
        if (!uid || !propId || !selfUid) return;
        const deedId = propertySystem.makeDeedId(selfUid, propId);
        void propertySystem.invitePlayerToProperty(propId, uid);
        multiplayerClient.sendPropertyInvite(uid, deedId, propName);
        this.feedback = {text: `Invited friend to ${propName}!`, error: false};
        this.render();
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-f-rem').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (this.actionBusy || !this.openState) return;
        const pairId = btn.dataset.frem;
        if (!pairId) return;
        this.actionBusy = true;
        try {
          await friendsSystem.removeFriend(pairId);
          if (!this.openState) return;
          this.feedback = {text: 'Removed friend.', error: false};
          await this.refreshFriends();
        } finally {
          this.actionBusy = false;
        }
      });
    });

    // Shared Lobbies tab
    const gameSel = this.backdrop.querySelector<HTMLSelectElement>('#cc-lob-game');
    gameSel?.addEventListener('change', () => {
      this.selectedLobbyActivity = gameSel.value as MiniGameId;
    });
    this.backdrop.querySelector('#cc-lob-create')?.addEventListener('click', () => {
      const game = MINI_GAMES_CATALOG.find((g) => g.id === this.selectedLobbyActivity);
      if (!game) return;
      audioSystem.playInteract();
      multiplayerClient.createLobby(game.id, game.name);
      this.feedback = {text: `Created shared lobby for ${game.name}!`, error: false};
      this.render();
    });
    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-lob-join').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.lobJoin;
        if (!id) return;
        audioSystem.playInteract();
        multiplayerClient.joinLobby(id);
      });
    });
    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-lob-leave').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.lobLeave;
        if (!id) return;
        audioSystem.playButtonClick();
        multiplayerClient.leaveLobby(id);
      });
    });
    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-lob-start').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.lobStart;
        if (!id) return;
        audioSystem.playInteract();
        multiplayerClient.startLobby(id);
      });
    });
  }

  public destroy(): void {
    this.openState = false;
    this.unsubStatus?.();
    this.unsubPlayers?.();
    this.unsubChat?.();
    this.unsubLobbies?.();
    this.backdrop.remove();
  }
}
