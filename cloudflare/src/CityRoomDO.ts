export interface CityEnv {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_DATABASE_ID?: string;
  OWNER_UID?: string;
}

interface RoomPlayer {
  uid: string;
  username: string;
  displayName: string;
  isOwner: boolean;
  level: number;
  selectedTitle: string;
  appearanceId: string;
  appearanceConfig: Record<string, unknown>;
  equippedClothing: Record<string, string>;
  hairOverride?: Record<string, unknown> | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: 'down' | 'up' | 'left' | 'right';
  anim: 'idle' | 'walk' | 'run' | 'sit' | 'celebrate';
  interiorId: string | null;
  propertyDeedId: string | null;
  vehicle: Record<string, unknown> | null;
  ridingDriverUid: string | null;
  emote: {id: string; expiresAt: number} | null;
  updatedAt: number;
}

const MAX_PLAYERS = 12;
const PROFANITY = ['fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'faggot', 'nigger', 'nigga', 'retard'];

export class CityRoomDO {
  private readonly state: DurableObjectState;
  private readonly env: CityEnv;
  private readonly players = new Map<string, RoomPlayer>();
  private readonly sockets = new Map<string, WebSocket>();
  private readonly chatWindow = new Map<string, number[]>();

  constructor(state: DurableObjectState, env: CityEnv) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/stats') {
      return Response.json({players: this.players.size, maxPlayers: MAX_PLAYERS});
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Upgrade required', {status: 426});
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    let authedUid: string | null = null;

    server.addEventListener('message', async (evt) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(typeof evt.data === 'string' ? evt.data : '') as Record<string, unknown>;
      } catch {
        return;
      }

      const type = typeof msg.type === 'string' ? msg.type : '';

      if (!authedUid) {
        if (type !== 'join' || typeof msg.idToken !== 'string' || !msg.idToken) {
          server.send(JSON.stringify({type: 'error', code: 'AUTH_REQUIRED', message: 'Valid Firebase token required.'}));
          server.close(4003, 'Auth required');
          return;
        }

        const verified = await this.verifyFirebaseJwtViaGoogleCert(msg.idToken);
        if (!verified) {
          server.send(JSON.stringify({type: 'error', code: 'AUTH_INVALID', message: 'Invalid Firebase token.'}));
          server.close(4005, 'Invalid token');
          return;
        }

        if (this.sockets.has(verified.uid)) {
          server.send(JSON.stringify({type: 'error', code: 'DUPLICATE_SESSION', message: 'Already active in this room.'}));
          server.close(4009, 'Duplicate session');
          return;
        }

        if (this.players.size >= MAX_PLAYERS) {
          server.send(JSON.stringify({type: 'error', code: 'SERVER_FULL', message: 'Server is full (12/12).'}));
          server.close(4010, 'Server full');
          return;
        }

        const acct = await this.fetchAccountUsername(verified.uid, msg.idToken);
        const ownerUid = (this.env.OWNER_UID || '').trim();
        const resolvedUsername = acct?.username || 'Citizen';
        const isOwner = Boolean(ownerUid) && verified.uid === ownerUid && acct?.usernameLower === 'owneranant';
        const rawDisplay = typeof msg.displayName === 'string' ? msg.displayName.replace(/[<>]/g, '').trim().slice(0, 24) : resolvedUsername;
        const displayName = !isOwner && rawDisplay.toLowerCase().includes('owneranant') ? resolvedUsername : rawDisplay;
        const profile = (msg.profile && typeof msg.profile === 'object' ? msg.profile : {}) as Record<string, unknown>;

        const player: RoomPlayer = {
          uid: verified.uid,
          username: resolvedUsername,
          displayName,
          isOwner,
          level: typeof profile.level === 'number' ? Math.max(1, Math.min(99, profile.level)) : 1,
          selectedTitle: typeof profile.selectedTitle === 'string' ? profile.selectedTitle.slice(0, 32) : 'New Arrival',
          appearanceId: typeof profile.appearanceId === 'string' ? profile.appearanceId.slice(0, 32) : 'street_explorer',
          appearanceConfig: (profile.appearanceConfig as Record<string, unknown>) || {},
          equippedClothing: (profile.equippedClothing as Record<string, string>) || {},
          hairOverride: (profile.hairOverride as Record<string, unknown> | null) || null,
          x: typeof msg.x === 'number' ? msg.x : 1136,
          y: typeof msg.y === 'number' ? msg.y : 841,
          vx: 0,
          vy: 0,
          dir: 'down',
          anim: 'idle',
          interiorId: null,
          propertyDeedId: null,
          vehicle: null,
          ridingDriverUid: null,
          emote: null,
          updatedAt: Date.now(),
        };

        authedUid = verified.uid;
        this.sockets.set(verified.uid, server);
        this.players.set(verified.uid, player);

        server.send(
          JSON.stringify({
            type: 'welcome',
            self: player,
            room: {id: url.searchParams.get('room') || 'city-alpha', maxPlayers: MAX_PLAYERS, playerCount: this.players.size},
            players: Array.from(this.players.values()),
            lobbies: [],
          }),
        );
        this.broadcast({type: 'player_joined', player, playerCount: this.players.size}, verified.uid);
        return;
      }

      const self = this.players.get(authedUid);
      if (!self) return;

      if (type === 'move') {
        if (typeof msg.x === 'number') self.x = Math.max(0, Math.min(5200, msg.x));
        if (typeof msg.y === 'number') self.y = Math.max(0, Math.min(3900, msg.y));
        if (typeof msg.vx === 'number') self.vx = msg.vx;
        if (typeof msg.vy === 'number') self.vy = msg.vy;
        if (msg.dir === 'down' || msg.dir === 'up' || msg.dir === 'left' || msg.dir === 'right') self.dir = msg.dir;
        if (msg.anim === 'idle' || msg.anim === 'walk' || msg.anim === 'run' || msg.anim === 'sit' || msg.anim === 'celebrate') {
          self.anim = msg.anim;
        }
        self.interiorId = typeof msg.interiorId === 'string' ? msg.interiorId : null;
        self.propertyDeedId = typeof msg.propertyDeedId === 'string' ? msg.propertyDeedId : null;
        self.vehicle = msg.vehicle && typeof msg.vehicle === 'object' ? (msg.vehicle as Record<string, unknown>) : null;
        self.updatedAt = Date.now();
        this.broadcast({type: 'state_delta', t: Date.now(), players: [self]}, authedUid);
      } else if (type === 'emote' && typeof msg.emoteId === 'string') {
        self.emote = {id: msg.emoteId.slice(0, 24), expiresAt: Date.now() + 2800};
        this.broadcast({
          type: 'emote_event',
          uid: self.uid,
          displayName: self.displayName,
          emoteId: self.emote.id,
          x: self.x,
          y: self.y,
        });
      } else if (type === 'chat' && typeof msg.text === 'string') {
        const now = Date.now();
        const prev = (this.chatWindow.get(authedUid) || []).filter((t) => now - t < 10_000);
        if (prev.length >= 5) return;
        prev.push(now);
        this.chatWindow.set(authedUid, prev);
        let clean = msg.text.replace(/[<>]/g, '').trim().slice(0, 160);
        for (const w of PROFANITY) {
          clean = clean.replace(new RegExp(`\\b${w}\\b`, 'gi'), '*'.repeat(w.length));
        }
        if (!clean) return;
        this.broadcast({
          type: 'chat_message',
          id: `chat_${now}`,
          uid: self.uid,
          username: self.username,
          displayName: self.displayName,
          isOwner: self.isOwner,
          text: clean,
          timestamp: now,
        });
      } else if (type === 'ping') {
        server.send(JSON.stringify({type: 'pong', t: msg.t ?? Date.now()}));
      }
    });

    server.addEventListener('close', () => {
      if (authedUid) {
        this.sockets.delete(authedUid);
        this.players.delete(authedUid);
        this.broadcast({type: 'player_left', uid: authedUid, reason: 'closed', playerCount: this.players.size});
      }
    });

    return new Response(null, {status: 101, webSocket: client});
  }

  private broadcast(payload: unknown, exceptUid?: string): void {
    const raw = JSON.stringify(payload);
    for (const [uid, sock] of this.sockets.entries()) {
      if (exceptUid && uid === exceptUid) continue;
      try {
        sock.send(raw);
      } catch {
        // ignore dead socket
      }
    }
  }

  private async verifyFirebaseJwtViaGoogleCert(idToken: string): Promise<{uid: string} | null> {
    // Edge-compatible Google TokenInfo / public JWT verification
    try {
      const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
      if (!resp.ok) return null;
      const info = (await resp.json()) as {aud?: string; sub?: string; exp?: string};
      if (info.aud !== this.env.FIREBASE_PROJECT_ID || !info.sub) return null;
      if (info.exp && Number(info.exp) * 1000 < Date.now()) return null;
      return {uid: info.sub};
    } catch {
      return null;
    }
  }

  private async fetchAccountUsername(
    uid: string,
    idToken: string,
  ): Promise<{username: string; usernameLower: string} | null> {
    try {
      const dbId = encodeURIComponent(this.env.FIREBASE_DATABASE_ID || '(default)');
      const url = `https://firestore.googleapis.com/v1/projects/${this.env.FIREBASE_PROJECT_ID}/databases/${dbId}/documents/users/${encodeURIComponent(uid)}`;
      const resp = await fetch(url, {headers: {Authorization: `Bearer ${idToken}`}});
      if (!resp.ok) return null;
      const json = (await resp.json()) as {
        fields?: {username?: {stringValue?: string}; usernameLower?: {stringValue?: string}};
      };
      const username = json.fields?.username?.stringValue;
      const usernameLower = json.fields?.usernameLower?.stringValue;
      return username && usernameLower ? {username, usernameLower} : null;
    } catch {
      return null;
    }
  }
}
