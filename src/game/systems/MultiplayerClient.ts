import {addDoc, collection, doc, getDoc, serverTimestamp, setDoc} from 'firebase/firestore';
import {auth, db, isFirebaseConfigured} from '@/src/firebase/firebaseApp';
import {authSystem} from '@/src/game/systems/AuthSystem';
import {cloudSaveManager} from '@/src/game/systems/CloudSaveManager';
import {economySystem} from '@/src/game/systems/EconomySystem';
import {ownerBadgeService} from '@/src/game/systems/OwnerBadgeService';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {
  AnimationState,
  ChatMessageRecord,
  Direction,
  EmoteId,
  MultiplayerServerInfo,
  RemotePlayerState,
  RemoteVehicleSnapshot,
  ServerInviteItem,
  ServerVisibility,
  SharedActivityLobby,
} from '@/src/game/types/gameTypes';

export type MultiplayerConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'offline_singleplayer';

export interface MultiplayerStatusSnapshot {
  status: MultiplayerConnectionStatus;
  roomId: string;
  roomName: string;
  roomCode: string | null;
  visibility: ServerVisibility;
  hostUid: string | null;
  hostUsername: string | null;
  isOfficial: boolean;
  hasPassword: boolean;
  maxPlayers: number;
  playerCount: number;
  pingMs: number | null;
  lastError: string | null;
  selfUid: string | null;
  selfIsOwner: boolean;
  ridingDriverUid: string | null;
}

export interface PropertyInviteEvent {
  fromUid: string;
  fromName: string;
  fromIsOwner: boolean;
  deedId: string;
  propertyName: string;
}

export interface EmoteBroadcastEvent {
  uid: string;
  displayName: string;
  emoteId: string;
  x: number;
  y: number;
}

export interface RoomClosedEvent {
  roomId: string;
  roomName: string;
  message: string;
}

function getMultiplayerBaseUrls(): {httpBase: string; wsUrl: string} {
  const env = (import.meta as unknown as {env?: Record<string, string | undefined>}).env;
  const customWs = (env?.VITE_MULTIPLAYER_WS_URL || '').trim();
  if (customWs) {
    const httpBase = customWs
      .replace(/^wss:/i, 'https:')
      .replace(/^ws:/i, 'http:')
      .replace(/\/ws\/?$/i, '');
    return {httpBase, wsUrl: customWs};
  }
  if (typeof window === 'undefined') {
    return {httpBase: 'http://localhost:3000', wsUrl: 'ws://localhost:3000/ws'};
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return {
    httpBase: window.location.origin,
    wsUrl: `${proto}//${window.location.host}/ws`,
  };
}

class MultiplayerClient {
  private ws: WebSocket | null = null;
  private status: MultiplayerConnectionStatus = 'disconnected';
  private currentRoomId = 'official-public-1';
  private currentRoomName = 'Starlight City · Official Public';
  private currentRoomCode: string | null = null;
  private currentVisibility: ServerVisibility = 'public';
  private currentHostUid: string | null = null;
  private currentHostUsername: string | null = null;
  private currentIsOfficial = true;
  private currentHasPassword = false;
  private maxPlayers = 12;
  private lastError: string | null = null;
  private pingMs: number | null = null;
  private selfUid: string | null = null;
  private selfIsOwner = false;
  private ridingDriverUid: string | null = null;
  private lastJoinAuth: {password?: string; roomCode?: string} | null = null;

  private remotePlayers = new Map<string, RemotePlayerState>();
  private chatLog: ChatMessageRecord[] = [];
  private lobbies: SharedActivityLobby[] = [];
  private mutedUids = new Set<string>();
  private blockedUids = new Set<string>();

  private manualDisconnect = false;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private lastSendAtMs = 0;
  private lastSentSig = '';

  private statusListeners = new Set<(snap: MultiplayerStatusSnapshot) => void>();
  private playersListeners = new Set<(players: RemotePlayerState[]) => void>();
  private chatListeners = new Set<(messages: ChatMessageRecord[]) => void>();
  private emoteListeners = new Set<(evt: EmoteBroadcastEvent) => void>();
  private noticeListeners = new Set<(msg: string, kind?: 'info' | 'error') => void>();
  private lobbiesListeners = new Set<(lobbies: SharedActivityLobby[]) => void>();
  private lobbyStartListeners = new Set<(lobby: SharedActivityLobby) => void>();
  private propertyInviteListeners = new Set<(evt: PropertyInviteEvent) => void>();
  private propertyUpdatedListeners = new Set<(deedId: string) => void>();
  private serverInviteListeners = new Set<(invite: ServerInviteItem) => void>();
  private roomClosedListeners = new Set<(evt: RoomClosedEvent) => void>();

  constructor() {
    authSystem.subscribe((user) => {
      if (!user && (this.ws || this.status === 'connected' || this.status === 'connecting')) {
        this.disconnect(true);
      }
    });
  }

  public getStatus(): MultiplayerStatusSnapshot {
    const totalCount =
      this.status === 'connected' ? this.remotePlayers.size + (this.selfUid ? 1 : 0) : 0;
    return {
      status: this.status,
      roomId: this.currentRoomId,
      roomName: this.currentRoomName,
      roomCode: this.currentRoomCode,
      visibility: this.currentVisibility,
      hostUid: this.currentHostUid,
      hostUsername: this.currentHostUsername,
      isOfficial: this.currentIsOfficial,
      hasPassword: this.currentHasPassword,
      maxPlayers: this.maxPlayers,
      playerCount: totalCount,
      pingMs: this.pingMs,
      lastError: this.lastError,
      selfUid: this.selfUid,
      selfIsOwner: this.selfIsOwner,
      ridingDriverUid: this.ridingDriverUid,
    };
  }

  public isConnected(): boolean {
    return this.status === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  public getRemotePlayers(): RemotePlayerState[] {
    return Array.from(this.remotePlayers.values()).filter((p) => !this.blockedUids.has(p.uid));
  }

  public getRemotePlayerByUid(uid: string): RemotePlayerState | null {
    return this.remotePlayers.get(uid) ?? null;
  }

  public getChatLog(): ChatMessageRecord[] {
    return this.chatLog.filter((m) => !this.mutedUids.has(m.uid) && !this.blockedUids.has(m.uid));
  }

  public getLobbies(): SharedActivityLobby[] {
    return this.lobbies;
  }

  public getMutedUids(): Set<string> {
    return new Set(this.mutedUids);
  }

  public getBlockedUids(): Set<string> {
    return new Set(this.blockedUids);
  }

  public isMuted(uid: string): boolean {
    return this.mutedUids.has(uid);
  }

  public isBlocked(uid: string): boolean {
    return this.blockedUids.has(uid);
  }

  public onStatusChange(fn: (snap: MultiplayerStatusSnapshot) => void): () => void {
    this.statusListeners.add(fn);
    fn(this.getStatus());
    return () => this.statusListeners.delete(fn);
  }

  public onPlayersChange(fn: (players: RemotePlayerState[]) => void): () => void {
    this.playersListeners.add(fn);
    fn(this.getRemotePlayers());
    return () => this.playersListeners.delete(fn);
  }

  public onChatChange(fn: (messages: ChatMessageRecord[]) => void): () => void {
    this.chatListeners.add(fn);
    fn(this.getChatLog());
    return () => this.chatListeners.delete(fn);
  }

  public onEmote(fn: (evt: EmoteBroadcastEvent) => void): () => void {
    this.emoteListeners.add(fn);
    return () => this.emoteListeners.delete(fn);
  }

  public onNotice(fn: (msg: string, kind?: 'info' | 'error') => void): () => void {
    this.noticeListeners.add(fn);
    return () => this.noticeListeners.delete(fn);
  }

  public onLobbiesChange(fn: (lobbies: SharedActivityLobby[]) => void): () => void {
    this.lobbiesListeners.add(fn);
    fn(this.lobbies);
    return () => this.lobbiesListeners.delete(fn);
  }

  public onLobbyStarted(fn: (lobby: SharedActivityLobby) => void): () => void {
    this.lobbyStartListeners.add(fn);
    return () => this.lobbyStartListeners.delete(fn);
  }

  public onPropertyInvite(fn: (evt: PropertyInviteEvent) => void): () => void {
    this.propertyInviteListeners.add(fn);
    return () => this.propertyInviteListeners.delete(fn);
  }

  public onPropertyUpdated(fn: (deedId: string) => void): () => void {
    this.propertyUpdatedListeners.add(fn);
    return () => this.propertyUpdatedListeners.delete(fn);
  }

  public onServerInvite(fn: (invite: ServerInviteItem) => void): () => void {
    this.serverInviteListeners.add(fn);
    return () => this.serverInviteListeners.delete(fn);
  }

  public onRoomClosed(fn: (evt: RoomClosedEvent) => void): () => void {
    this.roomClosedListeners.add(fn);
    return () => this.roomClosedListeners.delete(fn);
  }

  private emitStatus(): void {
    const snap = this.getStatus();
    for (const fn of this.statusListeners) fn(snap);
  }

  private emitPlayers(): void {
    const list = this.getRemotePlayers();
    for (const fn of this.playersListeners) fn(list);
  }

  private emitChat(): void {
    const list = this.getChatLog();
    for (const fn of this.chatListeners) fn(list);
  }

  private emitNotice(msg: string, kind: 'info' | 'error' = 'info'): void {
    for (const fn of this.noticeListeners) fn(msg, kind);
  }

  private async getIdToken(): Promise<string | null> {
    const fbUser = auth.currentUser;
    if (!fbUser || !isFirebaseConfigured()) return null;
    try {
      return await fbUser.getIdToken(false);
    } catch {
      return null;
    }
  }

  public async fetchServerList(): Promise<MultiplayerServerInfo[]> {
    const {httpBase} = getMultiplayerBaseUrls();
    const resp = await fetch(`${httpBase}/api/multiplayer/servers`, {cache: 'no-store'});
    if (!resp.ok) {
      throw new Error(`Unable to fetch public servers (HTTP ${resp.status}).`);
    }
    const json = (await resp.json()) as {servers?: MultiplayerServerInfo[]};
    return Array.isArray(json.servers) ? json.servers : [];
  }

  public async createServer(input: {
    name: string;
    visibility: ServerVisibility;
    description?: string;
    maxPlayers: number;
    password?: string;
  }): Promise<{ok: boolean; server?: MultiplayerServerInfo; error?: string}> {
    const idToken = await this.getIdToken();
    const acct = authSystem.getCurrentUser();
    if (!idToken || !acct) {
      return {ok: false, error: 'Sign in with a CHAOS CITY account to create a server.'};
    }
    const {httpBase} = getMultiplayerBaseUrls();
    try {
      const resp = await fetch(`${httpBase}/api/multiplayer/servers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: input.name,
          visibility: input.visibility,
          description: input.description ?? '',
          maxPlayers: input.maxPlayers,
          password: input.password ?? '',
          hostUsername: acct.username,
        }),
      });
      const json = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        server?: MultiplayerServerInfo;
        error?: string;
      };
      if (!resp.ok || !json.server) {
        return {ok: false, error: json.error || `Could not create server (HTTP ${resp.status}).`};
      }
      return {ok: true, server: json.server};
    } catch {
      return {ok: false, error: 'Network error communicating with multiplayer server.'};
    }
  }

  public async verifyPublicServerAccess(
    roomId: string,
    password?: string,
  ): Promise<{ok: boolean; server?: MultiplayerServerInfo; requiresPassword?: boolean; error?: string}> {
    const idToken = await this.getIdToken();
    if (!idToken) {
      return {ok: false, error: 'Sign in with a CHAOS CITY account first.'};
    }
    const {httpBase} = getMultiplayerBaseUrls();
    try {
      const resp = await fetch(`${httpBase}/api/multiplayer/servers/${encodeURIComponent(roomId)}/verify-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({password: password ?? ''}),
      });
      const json = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        server?: MultiplayerServerInfo;
        error?: string;
      };
      if (!resp.ok || !json.server) {
        return {
          ok: false,
          requiresPassword: resp.status === 403,
          error: json.error || 'Unable to join server.',
        };
      }
      return {ok: true, server: json.server};
    } catch {
      return {ok: false, error: 'Network error connecting to server.'};
    }
  }

  public async joinServerByCode(
    code: string,
    password?: string,
  ): Promise<{ok: boolean; server?: MultiplayerServerInfo; requiresPassword?: boolean; error?: string}> {
    const idToken = await this.getIdToken();
    if (!idToken) {
      return {ok: false, error: 'Sign in with a CHAOS CITY account first.'};
    }
    const {httpBase} = getMultiplayerBaseUrls();
    try {
      const resp = await fetch(`${httpBase}/api/multiplayer/servers/join-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({code: code.trim().toUpperCase(), password: password ?? ''}),
      });
      const json = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        server?: MultiplayerServerInfo;
        requiresPassword?: boolean;
        error?: string;
      };
      if (!resp.ok || !json.server) {
        return {
          ok: false,
          requiresPassword: Boolean(json.requiresPassword),
          error: json.error || 'Invalid or expired Room Code.',
        };
      }
      return {ok: true, server: json.server};
    } catch {
      return {ok: false, error: 'Network error verifying Room Code.'};
    }
  }

  public async closeHostedServer(roomId = this.currentRoomId): Promise<{ok: boolean; error?: string}> {
    if (!roomId) return {ok: false, error: 'No active hosted server.'};
    if (this.ws?.readyState === WebSocket.OPEN && this.currentRoomId === roomId) {
      this.sendRaw({type: 'close_room'});
    }
    const idToken = await this.getIdToken();
    if (!idToken) return {ok: false, error: 'Authentication required.'};
    const {httpBase} = getMultiplayerBaseUrls();
    try {
      const resp = await fetch(`${httpBase}/api/multiplayer/servers/${encodeURIComponent(roomId)}/close`, {
        method: 'POST',
        headers: {Authorization: `Bearer ${idToken}`},
      });
      const json = (await resp.json().catch(() => ({}))) as {ok?: boolean; error?: string};
      if (!resp.ok) {
        return {ok: false, error: json.error || 'Failed to close server.'};
      }
      this.disconnect(true);
      return {ok: true};
    } catch {
      return {ok: false, error: 'Network error closing server.'};
    }
  }

  public async sendServerInvite(
    targetUid: string,
    targetUsername?: string,
    roomId = this.currentRoomId,
  ): Promise<{ok: boolean; invite?: ServerInviteItem; error?: string}> {
    const idToken = await this.getIdToken();
    if (!idToken) return {ok: false, error: 'Sign in required.'};
    const {httpBase} = getMultiplayerBaseUrls();
    try {
      const resp = await fetch(`${httpBase}/api/multiplayer/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({roomId, targetUid, targetUsername}),
      });
      const json = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        invite?: ServerInviteItem;
        error?: string;
      };
      if (!resp.ok || !json.invite) {
        return {ok: false, error: json.error || 'Could not send server invite.'};
      }
      return {ok: true, invite: json.invite};
    } catch {
      return {ok: false, error: 'Network error sending invite.'};
    }
  }

  public async fetchPendingInvites(): Promise<ServerInviteItem[]> {
    const idToken = await this.getIdToken();
    if (!idToken) return [];
    const {httpBase} = getMultiplayerBaseUrls();
    try {
      const resp = await fetch(`${httpBase}/api/multiplayer/invites`, {
        headers: {Authorization: `Bearer ${idToken}`},
        cache: 'no-store',
      });
      if (!resp.ok) return [];
      const json = (await resp.json()) as {invites?: ServerInviteItem[]};
      return Array.isArray(json.invites) ? json.invites : [];
    } catch {
      return [];
    }
  }

  public async respondToServerInvite(
    inviteId: string,
    action: 'accept' | 'decline',
    password?: string,
  ): Promise<{ok: boolean; server?: MultiplayerServerInfo; requiresPassword?: boolean; error?: string}> {
    const idToken = await this.getIdToken();
    if (!idToken) return {ok: false, error: 'Sign in required.'};
    const {httpBase} = getMultiplayerBaseUrls();
    try {
      const resp = await fetch(`${httpBase}/api/multiplayer/invites/${encodeURIComponent(inviteId)}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({action, password: password ?? ''}),
      });
      const json = (await resp.json().catch(() => ({}))) as {
        ok?: boolean;
        server?: MultiplayerServerInfo;
        requiresPassword?: boolean;
        error?: string;
      };
      if (!resp.ok) {
        return {
          ok: false,
          requiresPassword: Boolean(json.requiresPassword),
          error: json.error || 'Invite unavailable.',
        };
      }
      return {ok: true, server: json.server};
    } catch {
      return {ok: false, error: 'Network error responding to invite.'};
    }
  }

  public async fetchFriendsOnlineStatus(
    uids: string[],
  ): Promise<Record<string, {isOnline: boolean; roomId: string | null; roomName: string | null; visibility: string | null}>> {
    if (uids.length === 0) return {};
    const idToken = await this.getIdToken();
    if (!idToken) return {};
    const {httpBase} = getMultiplayerBaseUrls();
    try {
      const resp = await fetch(
        `${httpBase}/api/multiplayer/friends-status?uids=${encodeURIComponent(uids.join(','))}`,
        {headers: {Authorization: `Bearer ${idToken}`}, cache: 'no-store'},
      );
      if (!resp.ok) return {};
      const json = (await resp.json()) as {
        statuses?: Record<string, {isOnline: boolean; roomId: string | null; roomName: string | null; visibility: string | null}>;
      };
      return json.statuses ?? {};
    } catch {
      return {};
    }
  }

  public async loadSafetyLists(): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid || !isFirebaseConfigured()) return;
    try {
      const snap = await getDoc(doc(db, 'userSafety', uid));
      if (snap.exists()) {
        const data = snap.data() as Record<string, unknown>;
        const muted = Array.isArray(data.mutedUids)
          ? data.mutedUids.filter((x): x is string => typeof x === 'string')
          : [];
        const blocked = Array.isArray(data.blockedUids)
          ? data.blockedUids.filter((x): x is string => typeof x === 'string')
          : [];
        this.mutedUids = new Set(muted);
        this.blockedUids = new Set(blocked);
        this.emitChat();
        this.emitPlayers();
      }
    } catch {
      // Ignore if unprovisioned or offline
    }
  }

  private async persistSafetyLists(): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid || !isFirebaseConfigured()) return;
    try {
      await setDoc(doc(db, 'userSafety', uid), {
        uid,
        mutedUids: Array.from(this.mutedUids).slice(0, 100),
        blockedUids: Array.from(this.blockedUids).slice(0, 100),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Preserve runtime safety state locally even if offline
    }
  }

  public async toggleMuteUser(targetUid: string): Promise<boolean> {
    if (!targetUid || targetUid === this.selfUid) return false;
    if (this.mutedUids.has(targetUid)) {
      this.mutedUids.delete(targetUid);
    } else {
      this.mutedUids.add(targetUid);
    }
    this.emitChat();
    await this.persistSafetyLists();
    return this.mutedUids.has(targetUid);
  }

  public async toggleBlockUser(targetUid: string): Promise<boolean> {
    if (!targetUid || targetUid === this.selfUid) return false;
    if (this.blockedUids.has(targetUid)) {
      this.blockedUids.delete(targetUid);
    } else {
      this.blockedUids.add(targetUid);
      this.mutedUids.add(targetUid);
    }
    this.emitChat();
    this.emitPlayers();
    await this.persistSafetyLists();
    return this.blockedUids.has(targetUid);
  }

  public async submitReport(
    targetUid: string,
    targetUsername: string,
    reason: string,
    details = '',
  ): Promise<{ok: boolean; message: string}> {
    const user = auth.currentUser;
    if (!user || !isFirebaseConfigured()) {
      return {ok: false, message: 'Sign in with a verified account to submit reports.'};
    }
    try {
      const idToken = await user.getIdToken();
      const {httpBase} = getMultiplayerBaseUrls();
      const resp = await fetch(`${httpBase}/api/multiplayer/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({targetUid, targetUsername, reason, details, roomId: this.currentRoomId}),
      });
      if (!resp.ok) {
        const errJson = (await resp.json().catch(() => ({}))) as {error?: string};
        throw new Error(errJson.error || 'Report submission failed.');
      }
      await addDoc(collection(db, 'playerReports'), {
        reporterUid: user.uid,
        targetUid,
        targetUsername: targetUsername.slice(0, 32),
        reason: reason.slice(0, 80),
        details: details.slice(0, 240),
        roomId: this.currentRoomId,
        createdAt: serverTimestamp(),
      });
      return {ok: true, message: 'Safety report submitted cleanly.'};
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Unable to send report right now.',
      };
    }
  }

  public async connect(
    roomId = this.currentRoomId,
    initialPos?: {x: number; y: number; interiorId?: string | null; propertyDeedId?: string | null},
    joinAuth?: {password?: string; roomCode?: string},
  ): Promise<void> {
    this.manualDisconnect = false;
    this.clearTimers();

    const fbUser = auth.currentUser;
    const acctUser = authSystem.getCurrentUser();
    if (!fbUser || !acctUser || !isFirebaseConfigured()) {
      this.cleanupSocketOnly();
      this.status = 'offline_singleplayer';
      this.lastError = 'Sign in with a registered CHAOS CITY account for live multiplayer.';
      this.emitStatus();
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.currentRoomId === roomId) return;
      this.cleanupSocketOnly();
    }

    this.currentRoomId = roomId;
    this.lastJoinAuth = joinAuth ? {...joinAuth} : null;
    this.chatLog = [];
    this.emitChat();
    this.status = 'connecting';
    this.lastError = null;
    this.emitStatus();

    void this.loadSafetyLists();
    void ownerBadgeService.refreshOwnerConfig();

    let idToken = '';
    try {
      idToken = await fbUser.getIdToken(false);
    } catch {
      this.status = 'error';
      this.lastError = 'Could not authenticate account token.';
      this.emitStatus();
      return;
    }

    const {wsUrl} = getMultiplayerBaseUrls();
    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      this.status = 'error';
      this.lastError = 'WebSocket unsupported or blocked.';
      this.emitStatus();
      return;
    }

    this.ws = socket;

    socket.addEventListener('open', () => {
      if (this.ws !== socket) return;
      const save = saveSystem.getState();
      const joinPayload = {
        type: 'join',
        roomId: this.currentRoomId,
        idToken,
        password: joinAuth?.password ?? '',
        roomCode: joinAuth?.roomCode ?? '',
        displayName: save.playerName || acctUser.username,
        x: initialPos?.x ?? save.lastPosition?.x ?? 1136,
        y: initialPos?.y ?? save.lastPosition?.y ?? 841,
        interiorId: initialPos?.interiorId ?? null,
        propertyDeedId: initialPos?.propertyDeedId ?? null,
        profile: {
          level: save.progression.level,
          selectedTitle: save.progression.selectedTitle,
          appearanceId: save.appearanceId,
          appearanceConfig: save.appearanceConfig,
          equippedClothing: save.equippedClothing,
          hairOverride: save.hairOverride,
        },
      };
      this.sendRaw(joinPayload);
      this.startHeartbeat();
    });

    socket.addEventListener('message', (evt) => {
      if (this.ws !== socket) return;
      try {
        const msg = JSON.parse(String(evt.data)) as Record<string, unknown>;
        this.handleServerMessage(msg);
      } catch {
        // Ignore malformed frame
      }
    });

    socket.addEventListener('close', (evt) => {
      if (this.ws !== socket) return;
      this.clearTimers();
      this.ws = null;
      this.remotePlayers.clear();
      this.lobbies = [];
      this.ridingDriverUid = null;
      this.emitPlayers();
      for (const fn of this.lobbiesListeners) fn([]);

      if (this.manualDisconnect) {
        this.status = 'disconnected';
        this.emitStatus();
        return;
      }

      if (
        evt.code === 4003 ||
        evt.code === 4004 ||
        evt.code === 4005 ||
        evt.code === 4007 ||
        evt.code === 4008 ||
        evt.code === 4009 ||
        evt.code === 4010 ||
        evt.code === 4011
      ) {
        this.status = 'error';
        this.emitStatus();
        if (evt.code === 4011 || evt.code === 4004) {
          for (const fn of this.roomClosedListeners) {
            fn({
              roomId: this.currentRoomId,
              roomName: this.currentRoomName,
              message: evt.reason || 'This multiplayer server was closed.',
            });
          }
        }
        return;
      }

      this.status = 'disconnected';
      this.emitStatus();
      this.scheduleReconnect(initialPos);
    });

    socket.addEventListener('error', () => {
      if (this.ws !== socket) return;
      this.lastError = 'Multiplayer connection interrupted.';
      this.emitStatus();
    });
  }

  public disconnect(manual = true): void {
    this.manualDisconnect = manual;
    this.lastJoinAuth = null;
    this.clearTimers();
    this.cleanupSocketOnly();
    this.remotePlayers.clear();
    this.lobbies = [];
    this.chatLog = [];
    this.ridingDriverUid = null;
    this.currentRoomCode = null;
    this.currentHostUid = null;
    this.currentHostUsername = null;
    this.status = 'disconnected';
    this.emitPlayers();
    this.emitChat();
    this.emitStatus();
    void cloudSaveManager.syncPublicProfile(null, false);
  }

  private cleanupSocketOnly(): void {
    if (this.ws) {
      try {
        this.ws.close(1000, 'Client switch');
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  private clearTimers(): void {
    if (typeof window === 'undefined') return;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(initialPos?: {x: number; y: number; interiorId?: string | null; propertyDeedId?: string | null}): void {
    if (typeof window === 'undefined' || this.manualDisconnect) return;
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.manualDisconnect && auth.currentUser) {
        void this.connect(this.currentRoomId, initialPos, this.lastJoinAuth ?? undefined);
      }
    }, 3500);
  }

  private startHeartbeat(): void {
    if (typeof window === 'undefined') return;
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
    this.pingTimer = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendRaw({type: 'ping', t: Date.now()});
      }
    }, 8000);
  }

  private sendRaw(payload: Record<string, unknown>): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  private handleServerMessage(msg: Record<string, unknown>): void {
    const t = typeof msg.type === 'string' ? msg.type : '';
    switch (t) {
      case 'welcome': {
        const self = msg.self as RemotePlayerState | undefined;
        const room = msg.room as
          | {
              id?: string;
              name?: string;
              roomCode?: string;
              visibility?: ServerVisibility;
              hostUid?: string;
              hostUsername?: string;
              isOfficial?: boolean;
              hasPassword?: boolean;
              maxPlayers?: number;
            }
          | undefined;
        const players = Array.isArray(msg.players) ? (msg.players as RemotePlayerState[]) : [];
        const lobbies = Array.isArray(msg.lobbies) ? (msg.lobbies as SharedActivityLobby[]) : [];
        const pending = Array.isArray(msg.pendingInvites) ? (msg.pendingInvites as ServerInviteItem[]) : [];

        this.selfUid = self?.uid ?? auth.currentUser?.uid ?? null;
        this.selfIsOwner = Boolean(self?.isOwner);
        if (this.selfUid) {
          ownerBadgeService.setServerVerifiedOwner(this.selfUid, this.selfIsOwner);
        }
        this.currentRoomId = room?.id ?? this.currentRoomId;
        this.currentRoomName = room?.name ?? this.currentRoomName;
        this.currentRoomCode = room?.roomCode ?? null;
        this.currentVisibility = room?.visibility === 'invite_only' ? 'invite_only' : 'public';
        this.currentHostUid = room?.hostUid ?? null;
        this.currentHostUsername = room?.hostUsername ?? null;
        this.currentIsOfficial = Boolean(room?.isOfficial);
        this.currentHasPassword = Boolean(room?.hasPassword);
        this.maxPlayers = room?.maxPlayers ?? 12;
        this.status = 'connected';
        this.lastError = null;
        this.ridingDriverUid = self?.ridingDriverUid ?? null;

        this.remotePlayers.clear();
        for (const p of players) {
          if (p.uid !== this.selfUid) {
            ownerBadgeService.setServerVerifiedOwner(p.uid, Boolean(p.isOwner));
            this.remotePlayers.set(p.uid, p);
          }
        }
        this.lobbies = lobbies;
        this.emitPlayers();
        this.emitStatus();
        for (const fn of this.lobbiesListeners) fn(lobbies);
        for (const inv of pending) {
          if (saveSystem.getState().privacySettings.allowMultiplayerInvites) {
            for (const fn of this.serverInviteListeners) fn(inv);
          }
        }
        void cloudSaveManager.syncPublicProfile(this.currentRoomId, true);
        this.emitNotice(`Connected to ${this.currentRoomName} (${players.length}/${this.maxPlayers})`, 'info');
        break;
      }

      case 'player_joined': {
        const p = msg.player as RemotePlayerState | undefined;
        if (p && p.uid !== this.selfUid) {
          ownerBadgeService.setServerVerifiedOwner(p.uid, Boolean(p.isOwner));
          this.remotePlayers.set(p.uid, p);
          this.emitPlayers();
          this.emitStatus();
        }
        break;
      }

      case 'player_left': {
        const uid = typeof msg.uid === 'string' ? msg.uid : '';
        if (uid) {
          this.remotePlayers.delete(uid);
          if (this.ridingDriverUid === uid) {
            this.ridingDriverUid = null;
          }
          this.emitPlayers();
          this.emitStatus();
        }
        break;
      }

      case 'state_delta': {
        const updates = Array.isArray(msg.players) ? (msg.players as RemotePlayerState[]) : [];
        let changed = false;
        for (const p of updates) {
          if (p.uid === this.selfUid) {
            this.ridingDriverUid = p.ridingDriverUid ?? null;
            continue;
          }
          ownerBadgeService.setServerVerifiedOwner(p.uid, Boolean(p.isOwner));
          this.remotePlayers.set(p.uid, p);
          changed = true;
        }
        if (changed) {
          this.emitPlayers();
        }
        this.emitStatus();
        break;
      }

      case 'pong': {
        const sent = typeof msg.t === 'number' ? msg.t : 0;
        if (sent > 0) {
          this.pingMs = Math.max(1, Date.now() - sent);
          this.emitStatus();
        }
        break;
      }

      case 'chat_message': {
        const record: ChatMessageRecord = {
          id: typeof msg.id === 'string' ? msg.id : `c_${Date.now()}`,
          uid: typeof msg.uid === 'string' ? msg.uid : '',
          username: typeof msg.username === 'string' ? msg.username : 'Citizen',
          displayName: typeof msg.displayName === 'string' ? msg.displayName : 'Citizen',
          isOwner: Boolean(msg.isOwner),
          text: typeof msg.text === 'string' ? msg.text : '',
          moderated: Boolean(msg.moderated),
          timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
        };
        this.chatLog = [...this.chatLog, record].slice(-60);
        this.emitChat();
        break;
      }

      case 'emote_event': {
        const evt: EmoteBroadcastEvent = {
          uid: typeof msg.uid === 'string' ? msg.uid : '',
          displayName: typeof msg.displayName === 'string' ? msg.displayName : 'Citizen',
          emoteId: typeof msg.emoteId === 'string' ? msg.emoteId : 'wave',
          x: typeof msg.x === 'number' ? msg.x : 0,
          y: typeof msg.y === 'number' ? msg.y : 0,
        };
        for (const fn of this.emoteListeners) fn(evt);
        break;
      }

      case 'ride_update': {
        const passengerUid = typeof msg.passengerUid === 'string' ? msg.passengerUid : '';
        const driverUid = typeof msg.driverUid === 'string' ? msg.driverUid : '';
        const joined = Boolean(msg.joined);
        if (passengerUid === this.selfUid) {
          this.ridingDriverUid = joined ? driverUid : null;
          this.emitStatus();
          this.emitNotice(joined ? 'Boarded passenger seat (Press E to exit)' : 'Exited passenger seat.', 'info');
        }
        break;
      }

      case 'lobbies_sync': {
        this.lobbies = Array.isArray(msg.lobbies) ? (msg.lobbies as SharedActivityLobby[]) : [];
        for (const fn of this.lobbiesListeners) fn(this.lobbies);
        break;
      }

      case 'lobby_started': {
        const lobby = msg.lobby as SharedActivityLobby | undefined;
        if (lobby) {
          for (const fn of this.lobbyStartListeners) fn(lobby);
        }
        break;
      }

      case 'lobby_reward_granted': {
        const lobbyId = typeof msg.lobbyId === 'string' ? msg.lobbyId : '';
        const coins = typeof msg.coins === 'number' ? msg.coins : 0;
        const xp = typeof msg.xp === 'number' ? msg.xp : 0;
        if (lobbyId && (coins > 0 || xp > 0)) {
          const awarded = economySystem.recordSharedActivityBonus(lobbyId, coins, xp);
          if (awarded) {
            this.emitNotice(`Shared Activity Bonus: +${awarded.coinsAwarded} Coins, +${awarded.xpAwarded} XP!`, 'info');
          }
        }
        break;
      }

      case 'property_updated': {
        const deedId = typeof msg.deedId === 'string' ? msg.deedId : '';
        if (deedId) {
          for (const fn of this.propertyUpdatedListeners) fn(deedId);
        }
        break;
      }

      case 'property_invite': {
        const evt: PropertyInviteEvent = {
          fromUid: typeof msg.fromUid === 'string' ? msg.fromUid : '',
          fromName: typeof msg.fromName === 'string' ? msg.fromName : 'Citizen',
          fromIsOwner: Boolean(msg.fromIsOwner),
          deedId: typeof msg.deedId === 'string' ? msg.deedId : '',
          propertyName: typeof msg.propertyName === 'string' ? msg.propertyName : 'Home',
        };
        if (evt.deedId && saveSystem.getState().privacySettings.allowMultiplayerInvites) {
          for (const fn of this.propertyInviteListeners) fn(evt);
        }
        break;
      }

      case 'server_invite': {
        const inv = msg.invite as ServerInviteItem | undefined;
        if (inv && inv.inviteId && saveSystem.getState().privacySettings.allowMultiplayerInvites) {
          for (const fn of this.serverInviteListeners) fn(inv);
        }
        break;
      }

      case 'room_closed': {
        this.manualDisconnect = true;
        const evt: RoomClosedEvent = {
          roomId: typeof msg.roomId === 'string' ? msg.roomId : this.currentRoomId,
          roomName: typeof msg.roomName === 'string' ? msg.roomName : this.currentRoomName,
          message: typeof msg.message === 'string' ? msg.message : 'Host closed the server.',
        };
        this.lastError = evt.message;
        for (const fn of this.roomClosedListeners) fn(evt);
        break;
      }

      case 'system_notice': {
        const message = typeof msg.message === 'string' ? msg.message : '';
        if (message) this.emitNotice(message, 'info');
        break;
      }

      case 'error': {
        const code = typeof msg.code === 'string' ? msg.code : 'ERROR';
        const message = typeof msg.message === 'string' ? msg.message : 'Multiplayer error';
        this.lastError = `[${code}] ${message}`;
        this.status = 'error';
        this.emitStatus();
        this.emitNotice(message, 'error');
        break;
      }
    }
  }

  public sendMove(payload: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    dir: Direction;
    anim: AnimationState;
    interiorId: string | null;
    propertyDeedId: string | null;
    vehicle: RemoteVehicleSnapshot | null;
  }): void {
    if (this.status !== 'connected') return;
    const now = performance.now();
    const rx = Math.round(payload.x);
    const ry = Math.round(payload.y);
    const sig = `${rx},${ry},${payload.dir},${payload.anim},${payload.interiorId ?? ''},${payload.propertyDeedId ?? ''},${payload.vehicle?.id ?? ''}`;
    if (sig === this.lastSentSig && now - this.lastSendAtMs < 400) return;
    if (now - this.lastSendAtMs < 62) return;

    this.lastSendAtMs = now;
    this.lastSentSig = sig;
    this.sendRaw({
      type: 'move',
      x: rx,
      y: ry,
      vx: Math.round(payload.vx),
      vy: Math.round(payload.vy),
      dir: payload.dir,
      anim: payload.anim,
      interiorId: payload.interiorId,
      propertyDeedId: payload.propertyDeedId,
      vehicle: payload.vehicle,
    });
  }

  public syncProfile(): void {
    if (this.status !== 'connected') return;
    const save = saveSystem.getState();
    this.sendRaw({
      type: 'profile_sync',
      profile: {
        level: save.progression.level,
        selectedTitle: save.progression.selectedTitle,
        appearanceId: save.appearanceId,
        appearanceConfig: save.appearanceConfig,
        equippedClothing: save.equippedClothing,
        hairOverride: save.hairOverride,
      },
    });
  }

  public sendChat(text: string): boolean {
    const clean = text.trim();
    if (!clean) return false;
    return this.sendRaw({type: 'chat', text: clean});
  }

  public sendEmote(emoteId: EmoteId): boolean {
    return this.sendRaw({type: 'emote', emoteId});
  }

  public requestRide(driverUid: string): boolean {
    return this.sendRaw({type: 'ride_request', driverUid});
  }

  public exitRide(): boolean {
    if (!this.ridingDriverUid) return false;
    return this.sendRaw({type: 'ride_exit'});
  }

  public notifyPropertyUpdated(deedId: string): boolean {
    return this.sendRaw({type: 'property_updated', deedId});
  }

  public sendPropertyInvite(targetUid: string, deedId: string, propertyName: string): boolean {
    return this.sendRaw({type: 'property_invite', targetUid, deedId, propertyName});
  }

  public createLobby(activityId: string, title: string): boolean {
    return this.sendRaw({type: 'lobby_create', activityId, title});
  }

  public joinLobby(lobbyId: string): boolean {
    return this.sendRaw({type: 'lobby_join', lobbyId});
  }

  public leaveLobby(lobbyId: string): boolean {
    return this.sendRaw({type: 'lobby_leave', lobbyId});
  }

  public startLobby(lobbyId: string): boolean {
    return this.sendRaw({type: 'lobby_start', lobbyId});
  }

  public finishLobby(lobbyId: string, score: number): boolean {
    return this.sendRaw({type: 'lobby_finish', lobbyId, score});
  }
}

export const multiplayerClient = new MultiplayerClient();
