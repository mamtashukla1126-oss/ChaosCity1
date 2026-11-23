import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import express from 'express';
import {importX509, jwtVerify} from 'jose';
import {createServer as createViteServer} from 'vite';
import {WebSocket, WebSocketServer} from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MAX_PLAYERS_LIMIT = 12;
const OFFICIAL_PUBLIC_ROOM_ID = 'official-public-1';
const SERVER_TICK_MS = 66; // ~15 Hz state broadcast
const HEARTBEAT_MS = 20_000;
const INVITE_TTL_MS = 10 * 60 * 1000;
const UNJOINED_CUSTOM_ROOM_TTL_MS = 2 * 60 * 1000;

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8');
    const parsed = JSON.parse(raw) as FirebaseAppletConfig;
    return {
      projectId: parsed.projectId || 'gen-lang-client-0863195692',
      firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)',
    };
  } catch {
    return {
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0863195692',
      firestoreDatabaseId: process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '(default)',
    };
  }
}

const firebaseCfg = loadFirebaseConfig();

// ---------------------------------------------------------------------------
// Firebase ID Token verification via Google SecureToken x509 public certs
// ---------------------------------------------------------------------------
interface CertCache {
  certs: Record<string, string>;
  expiresAtMs: number;
}
let certCache: CertCache | null = null;

async function getGoogleCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certCache && now < certCache.expiresAtMs) {
    return certCache.certs;
  }
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
  );
  if (!resp.ok) {
    throw new Error(`Failed to load Google public certs (${resp.status})`);
  }
  const cacheControl = resp.headers.get('cache-control') || '';
  const match = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = match ? Math.max(60, Math.min(3600, Number(match[1]))) : 900;
  const certs = (await resp.json()) as Record<string, string>;
  certCache = {certs, expiresAtMs: now + maxAgeSec * 1000};
  return certs;
}

interface VerifiedFirebaseUser {
  uid: string;
  email: string | null;
}

async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT token');
  }
  const headerJson = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as {
    kid?: string;
    alg?: string;
  };
  if (!headerJson.kid || headerJson.alg !== 'RS256') {
    throw new Error('Unsupported token header');
  }
  const certs = await getGoogleCerts();
  let pem = certs[headerJson.kid];
  if (!pem) {
    certCache = null;
    const fresh = await getGoogleCerts();
    if (!fresh[headerJson.kid]) {
      throw new Error('Unknown signing key id');
    }
    pem = fresh[headerJson.kid];
  }

  const key = await importX509(pem, 'RS256');
  const {payload} = await jwtVerify(idToken, key, {
    issuer: `https://securetoken.google.com/${firebaseCfg.projectId}`,
    audience: firebaseCfg.projectId,
  });
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Token missing subject UID');
  }
  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
  };
}

async function requireAuthenticatedRequest(
  req: express.Request,
  res: express.Response,
): Promise<{user: VerifiedFirebaseUser; idToken: string} | null> {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!idToken) {
    res.status(401).json({error: 'Sign in with a CHAOS CITY account first.'});
    return null;
  }
  try {
    const user = await verifyFirebaseIdToken(idToken);
    return {user, idToken};
  } catch (err) {
    res.status(401).json({error: err instanceof Error ? err.message : 'Invalid session token.'});
    return null;
  }
}

// ---------------------------------------------------------------------------
// Owner Verification & Firestore Username Lookup
// ---------------------------------------------------------------------------
interface OwnerConfigCache {
  ownerUid: string;
  normalizedUsername: string;
  expiresAtMs: number;
}
let ownerConfigCache: OwnerConfigCache | null = null;

async function fetchOwnerConfig(idToken: string): Promise<{ownerUid: string; normalizedUsername: string}> {
  const envUid = (process.env.OWNER_UID || '').trim();
  if (envUid) {
    return {ownerUid: envUid, normalizedUsername: 'owneranant'};
  }
  const now = Date.now();
  if (ownerConfigCache && now < ownerConfigCache.expiresAtMs) {
    return {
      ownerUid: ownerConfigCache.ownerUid,
      normalizedUsername: ownerConfigCache.normalizedUsername,
    };
  }
  try {
    const dbId = encodeURIComponent(firebaseCfg.firestoreDatabaseId || '(default)');
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseCfg.projectId}/databases/${dbId}/documents/systemConfig/owner`;
    const resp = await fetch(url, {
      headers: {Authorization: `Bearer ${idToken}`},
    });
    if (resp.ok) {
      const json = (await resp.json()) as {
        fields?: {
          ownerUid?: {stringValue?: string};
          normalizedUsername?: {stringValue?: string};
        };
      };
      const ownerUid = (json.fields?.ownerUid?.stringValue || '').trim();
      const normalizedUsername = (json.fields?.normalizedUsername?.stringValue || 'owneranant')
        .trim()
        .toLowerCase();
      ownerConfigCache = {ownerUid, normalizedUsername, expiresAtMs: now + 60_000};
      return {ownerUid, normalizedUsername};
    }
  } catch {
    // Firestore config unavailable
  }
  ownerConfigCache = {ownerUid: '', normalizedUsername: 'owneranant', expiresAtMs: now + 30_000};
  return {ownerUid: '', normalizedUsername: 'owneranant'};
}

async function fetchFirestoreAccountUsername(
  uid: string,
  idToken: string,
): Promise<{username: string; usernameLower: string} | null> {
  try {
    const dbId = encodeURIComponent(firebaseCfg.firestoreDatabaseId || '(default)');
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseCfg.projectId}/databases/${dbId}/documents/users/${encodeURIComponent(uid)}`;
    const resp = await fetch(url, {
      headers: {Authorization: `Bearer ${idToken}`},
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      fields?: {
        username?: {stringValue?: string};
        normalizedUsername?: {stringValue?: string};
        usernameLower?: {stringValue?: string};
      };
    };
    const username = json.fields?.username?.stringValue?.trim();
    const usernameLower = (
      json.fields?.normalizedUsername?.stringValue ??
      json.fields?.usernameLower?.stringValue
    )
      ?.trim()
      .toLowerCase();
    if (!username || !usernameLower) return null;
    return {username, usernameLower};
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Password Hashing & Safe Text Helpers
// ---------------------------------------------------------------------------
function hashRoomPassword(password: string): {salt: string; hash: string} {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return {salt, hash};
}

function verifyRoomPassword(password: string, salt: string | null, expectedHash: string | null): boolean {
  if (!expectedHash || !salt) return true;
  if (!password) return false;
  try {
    const actual = crypto.scryptSync(password, salt, 32);
    const expected = Buffer.from(expectedHash, 'hex');
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

const PROFANITY_LIST = [
  'fuck',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'cunt',
  'dick',
  'pussy',
  'slut',
  'whore',
  'faggot',
  'nigger',
  'nigga',
  'retard',
  'kys',
];

function sanitizeChatText(input: unknown): {text: string; flagged: boolean} {
  if (typeof input !== 'string') return {text: '', flagged: false};
  let clean = input.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
  let flagged = false;
  for (const bad of PROFANITY_LIST) {
    const re = new RegExp(`\\b${bad}\\b`, 'gi');
    if (re.test(clean)) {
      flagged = true;
      clean = clean.replace(re, '*'.repeat(bad.length));
    }
  }
  return {text: clean, flagged};
}

function sanitizeShortText(input: unknown, maxLen: number, fallback = ''): string {
  if (typeof input !== 'string') return fallback;
  const clean = input.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
  return clean || fallback;
}

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, val));
}

// ---------------------------------------------------------------------------
// Dynamic Authoritative City Server Rooms, Invites & Shared Activity Lobbies
// ---------------------------------------------------------------------------
type ServerVisibility = 'public' | 'invite_only';

interface VehicleNetworkState {
  id: string;
  modelId: string;
  texture: string;
  customization: Record<string, string>;
  isScooter: boolean;
  passengers: string[];
}

interface PlayerNetworkState {
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
  vehicle: VehicleNetworkState | null;
  ridingDriverUid: string | null;
  emote: {id: string; expiresAt: number} | null;
  updatedAt: number;
}

interface SharedLobby {
  lobbyId: string;
  activityId: string;
  title: string;
  hostUid: string;
  hostName: string;
  roomId: string;
  status: 'waiting' | 'active' | 'finished';
  maxPlayers: number;
  players: Array<{uid: string; displayName: string; isOwner: boolean; ready: boolean; score: number; finished: boolean}>;
  createdAt: number;
  awardClaimedUids: Set<string>;
}

interface ConnectedSocketMeta {
  ws: WebSocket;
  uid: string;
  roomId: string;
  isAlive: boolean;
  chatTimestamps: number[];
  dirty: boolean;
}

interface CityServerRoom {
  id: string;
  name: string;
  region: string;
  description: string;
  visibility: ServerVisibility;
  maxPlayers: number;
  roomCode: string;
  passwordHash: string | null;
  passwordSalt: string | null;
  hostUid: string;
  hostUsername: string;
  isOfficial: boolean;
  createdAtMs: number;
  hasHadJoin: boolean;
  closed: boolean;
  invitedUids: Set<string>;
  authorizedUids: Set<string>;
  players: Map<string, PlayerNetworkState>;
  sockets: Map<string, ConnectedSocketMeta>;
  lobbies: Map<string, SharedLobby>;
}

interface ServerInviteRecord {
  inviteId: string;
  roomId: string;
  roomName: string;
  roomCode: string;
  visibility: ServerVisibility;
  hasPassword: boolean;
  fromUid: string;
  fromUsername: string;
  toUid: string;
  toUsername: string;
  createdAtMs: number;
  expiresAtMs: number;
}

const rooms = new Map<string, CityServerRoom>();
const pendingInvites = new Map<string, ServerInviteRecord>();
const activeUidRegistry = new Map<string, ConnectedSocketMeta>();
const createRateLimitByUid = new Map<string, number>();

const recentReports: Array<{
  id: string;
  reporterUid: string;
  targetUid: string;
  reason: string;
  details: string;
  roomId: string;
  createdAt: number;
}> = [];

function createOfficialRoom(): void {
  rooms.set(OFFICIAL_PUBLIC_ROOM_ID, {
    id: OFFICIAL_PUBLIC_ROOM_ID,
    name: 'Starlight City · Official Public',
    region: 'Global',
    description: 'Official open city server for public exploration & events.',
    visibility: 'public',
    maxPlayers: MAX_PLAYERS_LIMIT,
    roomCode: 'STAR01',
    passwordHash: null,
    passwordSalt: null,
    hostUid: 'system',
    hostUsername: 'NOVACORE',
    isOfficial: true,
    createdAtMs: Date.now(),
    hasHadJoin: false,
    closed: false,
    invitedUids: new Set(),
    authorizedUids: new Set(),
    players: new Map(),
    sockets: new Map(),
    lobbies: new Map(),
  });
}

createOfficialRoom();

function generateUniqueRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 25; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += alphabet[crypto.randomInt(0, alphabet.length)];
    }
    const exists = Array.from(rooms.values()).some((r) => !r.closed && r.roomCode === code);
    if (!exists) return code;
  }
  return `CC${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

function serializeRoomPublic(r: CityServerRoom, includeRoomCode = false) {
  return {
    id: r.id,
    name: r.name,
    region: r.region,
    description: r.description,
    players: r.players.size,
    maxPlayers: r.maxPlayers,
    status: r.closed ? 'closed' : r.players.size >= r.maxPlayers ? 'full' : 'online',
    visibility: r.visibility,
    hasPassword: Boolean(r.passwordHash),
    hostUid: r.hostUid,
    hostUsername: r.hostUsername,
    isOfficial: r.isOfficial,
    createdAtMs: r.createdAtMs,
    ...(includeRoomCode ? {roomCode: r.roomCode} : {}),
  };
}

function serializeInvite(inv: ServerInviteRecord, room: CityServerRoom) {
  return {
    inviteId: inv.inviteId,
    roomId: inv.roomId,
    roomName: inv.roomName,
    roomCode: inv.roomCode,
    visibility: inv.visibility,
    hasPassword: inv.hasPassword,
    fromUid: inv.fromUid,
    fromUsername: inv.fromUsername,
    toUid: inv.toUid,
    toUsername: inv.toUsername,
    playerCount: room.players.size,
    maxPlayers: room.maxPlayers,
    createdAtMs: inv.createdAtMs,
    expiresAtMs: inv.expiresAtMs,
  };
}

function sendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastRoom(room: CityServerRoom, payload: unknown, exceptUid?: string): void {
  const encoded = JSON.stringify(payload);
  for (const [uid, meta] of room.sockets.entries()) {
    if (exceptUid && uid === exceptUid) continue;
    if (meta.ws.readyState === WebSocket.OPEN) {
      meta.ws.send(encoded);
    }
  }
}

function serializeLobby(lobby: SharedLobby) {
  return {
    lobbyId: lobby.lobbyId,
    activityId: lobby.activityId,
    title: lobby.title,
    hostUid: lobby.hostUid,
    hostName: lobby.hostName,
    roomId: lobby.roomId,
    status: lobby.status,
    maxPlayers: lobby.maxPlayers,
    players: lobby.players,
    createdAt: lobby.createdAt,
  };
}

function purgeInvitesForRoom(roomId: string): void {
  for (const [inviteId, inv] of pendingInvites.entries()) {
    if (inv.roomId === roomId) {
      pendingInvites.delete(inviteId);
    }
  }
}

function closeAndDestroyRoom(roomId: string, reasonMessage: string): void {
  const room = rooms.get(roomId);
  if (!room || room.isOfficial) return;
  room.closed = true;
  purgeInvitesForRoom(room.id);

  for (const meta of Array.from(room.sockets.values())) {
    if (activeUidRegistry.get(meta.uid) === meta) {
      activeUidRegistry.delete(meta.uid);
    }
    sendJson(meta.ws, {
      type: 'room_closed',
      roomId: room.id,
      roomName: room.name,
      message: reasonMessage,
    });
    try {
      meta.ws.close(4011, reasonMessage.slice(0, 80));
    } catch {
      // ignore
    }
  }
  room.sockets.clear();
  room.players.clear();
  room.lobbies.clear();
  rooms.delete(room.id);
}

function removePlayerFromRoom(meta: ConnectedSocketMeta, reason = 'disconnect'): void {
  const room = rooms.get(meta.roomId);
  if (!room) return;

  const registered = activeUidRegistry.get(meta.uid);
  if (registered === meta) {
    activeUidRegistry.delete(meta.uid);
  }

  const current = room.sockets.get(meta.uid);
  if (current === meta) {
    room.sockets.delete(meta.uid);
    room.players.delete(meta.uid);
  }

  for (const peer of room.players.values()) {
    if (peer.ridingDriverUid === meta.uid) {
      peer.ridingDriverUid = null;
    }
    if (peer.vehicle && peer.vehicle.passengers.includes(meta.uid)) {
      peer.vehicle.passengers = peer.vehicle.passengers.filter((id) => id !== meta.uid);
    }
  }

  for (const [lobbyId, lobby] of room.lobbies.entries()) {
    const idx = lobby.players.findIndex((p) => p.uid === meta.uid);
    if (idx !== -1) {
      lobby.players.splice(idx, 1);
      if (lobby.players.length === 0) {
        room.lobbies.delete(lobbyId);
      } else if (lobby.hostUid === meta.uid) {
        lobby.hostUid = lobby.players[0].uid;
        lobby.hostName = lobby.players[0].displayName;
      }
      broadcastRoom(room, {
        type: 'lobbies_sync',
        lobbies: Array.from(room.lobbies.values()).map(serializeLobby),
      });
    }
  }

  broadcastRoom(room, {
    type: 'player_left',
    uid: meta.uid,
    reason,
    playerCount: room.players.size,
  });

  // Clean up empty player-hosted servers immediately once all connected players leave
  if (!room.isOfficial && room.hasHadJoin && room.players.size === 0) {
    room.closed = true;
    purgeInvitesForRoom(room.id);
    rooms.delete(room.id);
  }
}

// Tick loop pushing authoritative position/state snapshots at ~15Hz
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.players.size === 0) continue;
    const dirtyStates: PlayerNetworkState[] = [];
    for (const [uid, meta] of room.sockets.entries()) {
      const st = room.players.get(uid);
      if (!st) continue;
      if (st.emote && st.emote.expiresAt <= now) {
        st.emote = null;
        meta.dirty = true;
      }
      if (meta.dirty) {
        dirtyStates.push(st);
        meta.dirty = false;
      }
    }
    if (dirtyStates.length > 0) {
      broadcastRoom(room, {
        type: 'state_delta',
        t: now,
        players: dirtyStates,
      });
    }
  }
}, SERVER_TICK_MS);

// Heartbeat + stale unjoined room / expired invite sweeper
setInterval(() => {
  const now = Date.now();
  for (const [inviteId, inv] of pendingInvites.entries()) {
    const room = rooms.get(inv.roomId);
    if (!room || room.closed || now > inv.expiresAtMs) {
      pendingInvites.delete(inviteId);
    }
  }

  for (const room of Array.from(rooms.values())) {
    if (
      !room.isOfficial &&
      !room.hasHadJoin &&
      room.players.size === 0 &&
      now - room.createdAtMs > UNJOINED_CUSTOM_ROOM_TTL_MS
    ) {
      room.closed = true;
      purgeInvitesForRoom(room.id);
      rooms.delete(room.id);
      continue;
    }

    for (const meta of Array.from(room.sockets.values())) {
      if (!meta.isAlive) {
        try {
          meta.ws.terminate();
        } catch {
          // ignore
        }
        removePlayerFromRoom(meta, 'timeout');
        continue;
      }
      meta.isAlive = false;
      try {
        meta.ws.ping();
      } catch {
        removePlayerFromRoom(meta, 'ping_failed');
      }
    }
  }
}, HEARTBEAT_MS);

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({limit: '64kb'}));

  app.get('/api/health', (_req, res) => {
    let totalOnline = 0;
    for (const r of rooms.values()) {
      totalOnline += r.players.size;
    }
    res.json({
      ok: true,
      projectId: firebaseCfg.projectId,
      rooms: rooms.size,
      totalOnline,
    });
  });

  // Public Server Browser — strictly excludes invite_only rooms and exposes live player counts only
  app.get('/api/multiplayer/servers', (_req, res) => {
    const publicRooms = Array.from(rooms.values())
      .filter((r) => !r.closed && r.visibility === 'public')
      .sort((a, b) => {
        if (a.isOfficial !== b.isOfficial) return a.isOfficial ? -1 : 1;
        if (b.players.size !== a.players.size) return b.players.size - a.players.size;
        return b.createdAtMs - a.createdAtMs;
      })
      .map((r) => serializeRoomPublic(r, false));

    res.json({
      maxPlayersPerRoom: MAX_PLAYERS_LIMIT,
      servers: publicRooms,
    });
  });

  // Create Public or Invite-Only Server
  app.post('/api/multiplayer/servers', async (req, res) => {
    const authCtx = await requireAuthenticatedRequest(req, res);
    if (!authCtx) return;
    const {user, idToken} = authCtx;

    const now = Date.now();
    const lastCreate = createRateLimitByUid.get(user.uid) ?? 0;
    if (now - lastCreate < 2500) {
      res.status(429).json({error: 'Please wait a moment before creating another server.'});
      return;
    }
    createRateLimitByUid.set(user.uid, now);

    const body = (req.body || {}) as Record<string, unknown>;
    const name = sanitizeShortText(body.name, 36);
    if (name.length < 3) {
      res.status(400).json({error: 'Server name must be between 3 and 36 characters.'});
      return;
    }
    const visibility: ServerVisibility = body.visibility === 'invite_only' ? 'invite_only' : 'public';
    const description = sanitizeShortText(
      body.description,
      110,
      visibility === 'invite_only' ? 'Private invite-only Chaos City session.' : 'Player-hosted Chaos City world.',
    );
    const maxPlayers = Math.floor(clampNumber(body.maxPlayers, 2, MAX_PLAYERS_LIMIT, 8));
    const rawPassword = typeof body.password === 'string' ? body.password.trim().slice(0, 48) : '';
    if (rawPassword && rawPassword.length < 3) {
      res.status(400).json({error: 'Server password must be at least 3 characters (or leave empty).'});
      return;
    }

    // Close any prior empty custom room owned by this user so they don't orphan stale rooms
    for (const r of Array.from(rooms.values())) {
      if (!r.isOfficial && r.hostUid === user.uid && r.players.size === 0) {
        r.closed = true;
        purgeInvitesForRoom(r.id);
        rooms.delete(r.id);
      }
    }

    const acctUser = await fetchFirestoreAccountUsername(user.uid, idToken);
    const hostUsername = acctUser?.username || sanitizeShortText(body.hostUsername, 20, 'Citizen');

    const pw = rawPassword ? hashRoomPassword(rawPassword) : {salt: null, hash: null};
    const roomId = `srv_${now.toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
    const roomCode = generateUniqueRoomCode();

    const room: CityServerRoom = {
      id: roomId,
      name,
      region: 'Player Hosted',
      description,
      visibility,
      maxPlayers,
      roomCode,
      passwordHash: pw.hash,
      passwordSalt: pw.salt,
      hostUid: user.uid,
      hostUsername,
      isOfficial: false,
      createdAtMs: now,
      hasHadJoin: false,
      closed: false,
      invitedUids: new Set([user.uid]),
      authorizedUids: new Set([user.uid]),
      players: new Map(),
      sockets: new Map(),
      lobbies: new Map(),
    };
    rooms.set(roomId, room);

    res.status(201).json({
      ok: true,
      server: serializeRoomPublic(room, true),
    });
  });

  // Validate Public Server entry (capacity & password check before entering CityScene)
  app.post('/api/multiplayer/servers/:roomId/verify-access', async (req, res) => {
    const authCtx = await requireAuthenticatedRequest(req, res);
    if (!authCtx) return;

    const room = rooms.get(req.params.roomId);
    if (!room || room.closed) {
      res.status(404).json({error: 'This server is no longer active.'});
      return;
    }
    const body = (req.body || {}) as {password?: string};
    const password = typeof body.password === 'string' ? body.password.trim() : '';

    if (room.visibility === 'invite_only') {
      const allowed =
        room.hostUid === authCtx.user.uid ||
        room.invitedUids.has(authCtx.user.uid) ||
        room.authorizedUids.has(authCtx.user.uid);
      if (!allowed) {
        res.status(403).json({error: 'This server is Invite Only. Use a valid Room Code or Friend Invite.'});
        return;
      }
    }
    if (room.players.size >= room.maxPlayers && !room.players.has(authCtx.user.uid)) {
      res.status(409).json({error: `${room.name} is full (${room.players.size}/${room.maxPlayers}).`});
      return;
    }
    if (room.passwordHash && !verifyRoomPassword(password, room.passwordSalt, room.passwordHash)) {
      res.status(403).json({error: 'Incorrect server password.'});
      return;
    }

    room.authorizedUids.add(authCtx.user.uid);
    res.json({ok: true, server: serializeRoomPublic(room, true)});
  });

  // Join by Room Code (+ optional password)
  app.post('/api/multiplayer/servers/join-code', async (req, res) => {
    const authCtx = await requireAuthenticatedRequest(req, res);
    if (!authCtx) return;

    const body = (req.body || {}) as {code?: string; password?: string};
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase().slice(0, 12) : '';
    const password = typeof body.password === 'string' ? body.password.trim() : '';

    if (!code || code.length < 4) {
      res.status(400).json({error: 'Enter a valid Room Code.'});
      return;
    }

    const room = Array.from(rooms.values()).find((r) => !r.closed && r.roomCode === code);
    if (!room) {
      res.status(404).json({error: `No active server found for code "${code}". It may have expired or closed.`});
      return;
    }
    if (room.players.size >= room.maxPlayers && !room.players.has(authCtx.user.uid)) {
      res.status(409).json({error: `${room.name} is full (${room.players.size}/${room.maxPlayers}).`});
      return;
    }
    if (room.passwordHash) {
      if (!password) {
        res.status(403).json({
          error: 'This server is password protected. Enter the server password.',
          requiresPassword: true,
        });
        return;
      }
      if (!verifyRoomPassword(password, room.passwordSalt, room.passwordHash)) {
        res.status(403).json({error: 'Incorrect server password.', requiresPassword: true});
        return;
      }
    }

    room.authorizedUids.add(authCtx.user.uid);
    res.json({ok: true, server: serializeRoomPublic(room, true)});
  });

  // Host Close Server
  app.post('/api/multiplayer/servers/:roomId/close', async (req, res) => {
    const authCtx = await requireAuthenticatedRequest(req, res);
    if (!authCtx) return;

    const room = rooms.get(req.params.roomId);
    if (!room) {
      res.json({ok: true});
      return;
    }
    if (room.isOfficial || room.hostUid !== authCtx.user.uid) {
      res.status(403).json({error: 'Only the server host can close this server.'});
      return;
    }

    closeAndDestroyRoom(room.id, `Host ${room.hostUsername} closed ${room.name}.`);
    res.json({ok: true});
  });

  // Send Real-Time Server Invite to a Friend
  app.post('/api/multiplayer/invites', async (req, res) => {
    const authCtx = await requireAuthenticatedRequest(req, res);
    if (!authCtx) return;

    const body = (req.body || {}) as {
      roomId?: string;
      targetUid?: string;
      targetUsername?: string;
    };
    const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
    const targetUid = typeof body.targetUid === 'string' ? body.targetUid.trim().slice(0, 128) : '';
    const targetUsername = sanitizeShortText(body.targetUsername, 24, 'Citizen');

    if (!roomId || !targetUid || targetUid === authCtx.user.uid) {
      res.status(400).json({error: 'Valid room and friend target are required.'});
      return;
    }

    const room = rooms.get(roomId);
    if (!room || room.closed) {
      res.status(404).json({error: 'Server is no longer active.'});
      return;
    }
    const requesterInRoom = room.players.has(authCtx.user.uid) || room.hostUid === authCtx.user.uid;
    if (!requesterInRoom) {
      res.status(403).json({error: 'Join the server before inviting friends.'});
      return;
    }
    if (room.players.size >= room.maxPlayers) {
      res.status(409).json({error: 'Server is currently full.'});
      return;
    }

    const acctUser = await fetchFirestoreAccountUsername(authCtx.user.uid, authCtx.idToken);
    const fromUsername = acctUser?.username || 'Citizen';

    // Replace any existing invite for same (roomId, targetUid) so UI stays clean
    for (const [id, existing] of pendingInvites.entries()) {
      if (existing.roomId === room.id && existing.toUid === targetUid) {
        pendingInvites.delete(id);
      }
    }

    const now = Date.now();
    const invite: ServerInviteRecord = {
      inviteId: `inv_${now.toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
      roomId: room.id,
      roomName: room.name,
      roomCode: room.roomCode,
      visibility: room.visibility,
      hasPassword: Boolean(room.passwordHash),
      fromUid: authCtx.user.uid,
      fromUsername,
      toUid: targetUid,
      toUsername: targetUsername,
      createdAtMs: now,
      expiresAtMs: now + INVITE_TTL_MS,
    };
    pendingInvites.set(invite.inviteId, invite);
    room.invitedUids.add(targetUid);
    room.authorizedUids.add(targetUid);

    const payload = serializeInvite(invite, room);
    const targetSocket = activeUidRegistry.get(targetUid);
    if (targetSocket && targetSocket.ws.readyState === WebSocket.OPEN) {
      sendJson(targetSocket.ws, {
        type: 'server_invite',
        invite: payload,
      });
    }

    res.status(201).json({ok: true, invite: payload});
  });

  // List Pending Server Invites for authenticated user
  app.get('/api/multiplayer/invites', async (req, res) => {
    const authCtx = await requireAuthenticatedRequest(req, res);
    if (!authCtx) return;

    const now = Date.now();
    const list: ReturnType<typeof serializeInvite>[] = [];
    for (const [inviteId, inv] of pendingInvites.entries()) {
      const room = rooms.get(inv.roomId);
      if (!room || room.closed || now > inv.expiresAtMs) {
        pendingInvites.delete(inviteId);
        continue;
      }
      if (inv.toUid === authCtx.user.uid) {
        list.push(serializeInvite(inv, room));
      }
    }
    list.sort((a, b) => b.createdAtMs - a.createdAtMs);
    res.json({invites: list});
  });

  // Accept or Decline Server Invite
  app.post('/api/multiplayer/invites/:inviteId/respond', async (req, res) => {
    const authCtx = await requireAuthenticatedRequest(req, res);
    if (!authCtx) return;

    const inv = pendingInvites.get(req.params.inviteId);
    if (!inv || inv.toUid !== authCtx.user.uid) {
      res.status(404).json({error: 'Invite expired or no longer available.'});
      return;
    }

    const body = (req.body || {}) as {action?: string; password?: string};
    const action = body.action === 'accept' ? 'accept' : 'decline';

    if (action === 'decline') {
      pendingInvites.delete(inv.inviteId);
      res.json({ok: true, declined: true});
      return;
    }

    const room = rooms.get(inv.roomId);
    if (!room || room.closed || Date.now() > inv.expiresAtMs) {
      pendingInvites.delete(inv.inviteId);
      res.status(404).json({error: 'This server has closed or the invite expired.'});
      return;
    }
    if (room.players.size >= room.maxPlayers && !room.players.has(authCtx.user.uid)) {
      res.status(409).json({error: `${room.name} is full (${room.players.size}/${room.maxPlayers}).`});
      return;
    }

    if (room.passwordHash) {
      const password = typeof body.password === 'string' ? body.password.trim() : '';
      if (!password) {
        res.status(403).json({
          error: 'Enter the server password to join this invite.',
          requiresPassword: true,
        });
        return;
      }
      if (!verifyRoomPassword(password, room.passwordSalt, room.passwordHash)) {
        res.status(403).json({error: 'Incorrect server password.', requiresPassword: true});
        return;
      }
    }

    room.invitedUids.add(authCtx.user.uid);
    room.authorizedUids.add(authCtx.user.uid);
    pendingInvites.delete(inv.inviteId);
    res.json({ok: true, server: serializeRoomPublic(room, true)});
  });

  // Real-time online & server status for Friends list
  app.get('/api/multiplayer/friends-status', async (req, res) => {
    const authCtx = await requireAuthenticatedRequest(req, res);
    if (!authCtx) return;

    const rawUids = typeof req.query.uids === 'string' ? req.query.uids : '';
    const uidList = rawUids
      .split(',')
      .map((u) => u.trim())
      .filter((u) => u.length > 0)
      .slice(0, 60);

    const statuses: Record<
      string,
      {isOnline: boolean; roomId: string | null; roomName: string | null; visibility: string | null}
    > = {};

    for (const uid of uidList) {
      const meta = activeUidRegistry.get(uid);
      if (meta && meta.ws.readyState === WebSocket.OPEN) {
        const room = rooms.get(meta.roomId);
        statuses[uid] = {
          isOnline: true,
          roomId: room?.id ?? meta.roomId,
          roomName: room?.name ?? 'Multiplayer Server',
          visibility: room?.visibility ?? null,
        };
      } else {
        statuses[uid] = {isOnline: false, roomId: null, roomName: null, visibility: null};
      }
    }

    res.json({statuses});
  });

  app.post('/api/multiplayer/report', async (req, res) => {
    const authCtx = await requireAuthenticatedRequest(req, res);
    if (!authCtx) return;

    const body = req.body as {
      targetUid?: string;
      reason?: string;
      details?: string;
      roomId?: string;
    };
    const targetUid = typeof body.targetUid === 'string' ? body.targetUid.trim().slice(0, 128) : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 64) : '';
    const details = typeof body.details === 'string' ? body.details.replace(/[<>]/g, '').trim().slice(0, 300) : '';
    const roomId = typeof body.roomId === 'string' ? body.roomId.trim().slice(0, 64) : OFFICIAL_PUBLIC_ROOM_ID;
    if (!targetUid || !reason || targetUid === authCtx.user.uid) {
      res.status(400).json({error: 'Valid target player and reason required.'});
      return;
    }
    recentReports.unshift({
      id: `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      reporterUid: authCtx.user.uid,
      targetUid,
      reason,
      details,
      roomId,
      createdAt: Date.now(),
    });
    if (recentReports.length > 100) recentReports.length = 100;
    res.status(201).json({ok: true});
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({noServer: true, maxPayload: 32 * 1024});

  httpServer.on('upgrade', (request, socket, head) => {
    const reqUrl = request.url || '/';
    if (!reqUrl.startsWith('/ws')) {
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws) => {
    let sessionMeta: ConnectedSocketMeta | null = null;
    let joined = false;

    const authTimeout = setTimeout(() => {
      if (!joined && ws.readyState === WebSocket.OPEN) {
        sendJson(ws, {type: 'error', code: 'AUTH_TIMEOUT', message: 'Authentication handshake timed out.'});
        ws.close(4001, 'Auth timeout');
      }
    }, 10_000);

    ws.on('pong', () => {
      if (sessionMeta) sessionMeta.isAlive = true;
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      if (sessionMeta) {
        removePlayerFromRoom(sessionMeta, 'closed');
        sessionMeta = null;
      }
    });

    ws.on('error', () => {
      clearTimeout(authTimeout);
      if (sessionMeta) {
        removePlayerFromRoom(sessionMeta, 'socket_error');
        sessionMeta = null;
      }
    });

    ws.on('message', async (rawData) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(rawData.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      const msgType = typeof msg.type === 'string' ? msg.type : '';

      // 1. Authentication & Room Join Handshake
      if (!joined) {
        if (msgType !== 'join') {
          sendJson(ws, {type: 'error', code: 'AUTH_REQUIRED', message: 'Send join handshake with verified token first.'});
          ws.close(4002, 'Join required');
          return;
        }

        const idToken = typeof msg.idToken === 'string' ? msg.idToken.trim() : '';
        if (!idToken) {
          sendJson(ws, {
            type: 'error',
            code: 'AUTH_REQUIRED',
            message: 'Multiplayer requires an authenticated CHAOS CITY account.',
          });
          ws.close(4003, 'Auth token required');
          return;
        }

        try {
          const verified = await verifyFirebaseIdToken(idToken);
          const roomId = typeof msg.roomId === 'string' && msg.roomId.trim()
            ? msg.roomId.trim()
            : OFFICIAL_PUBLIC_ROOM_ID;
          const room = rooms.get(roomId);
          if (!room || room.closed) {
            sendJson(ws, {type: 'error', code: 'INVALID_ROOM', message: 'Requested city server is closed or does not exist.'});
            ws.close(4004, 'Invalid room');
            return;
          }

          const suppliedPassword = typeof msg.password === 'string' ? msg.password.trim() : '';
          const suppliedCode = typeof msg.roomCode === 'string' ? msg.roomCode.trim().toUpperCase() : '';

          if (room.visibility === 'invite_only') {
            const hasValidCode = Boolean(suppliedCode) && suppliedCode === room.roomCode;
            const authorized =
              room.hostUid === verified.uid ||
              room.invitedUids.has(verified.uid) ||
              room.authorizedUids.has(verified.uid) ||
              hasValidCode;
            if (!authorized) {
              sendJson(ws, {
                type: 'error',
                code: 'INVITE_REQUIRED',
                message: 'This server is Invite Only. Use a valid Room Code or Friend Invite.',
              });
              ws.close(4008, 'Invite required');
              return;
            }
          }

          if (room.passwordHash) {
            const passwordOk = verifyRoomPassword(suppliedPassword, room.passwordSalt, room.passwordHash);
            if (!passwordOk) {
              sendJson(ws, {
                type: 'error',
                code: 'INVALID_PASSWORD',
                message: 'Incorrect server password.',
              });
              ws.close(4007, 'Invalid password');
              return;
            }
          }

          // Replace previous stale socket for the same UID cleanly if switching servers or reconnecting
          const existingSession = activeUidRegistry.get(verified.uid);
          if (existingSession && existingSession.ws.readyState === WebSocket.OPEN) {
            if (existingSession.roomId === room.id) {
              sendJson(ws, {
                type: 'error',
                code: 'DUPLICATE_SESSION',
                message: 'This account is already connected to this CHAOS CITY server.',
              });
              ws.close(4009, 'Duplicate active session');
              return;
            }
            // Gracefully disconnect old room socket when moving between servers
            try {
              existingSession.ws.close(4000, 'Switched server');
            } catch {
              // ignore
            }
            removePlayerFromRoom(existingSession, 'switched_server');
          }

          if (room.players.size >= room.maxPlayers) {
            sendJson(ws, {
              type: 'error',
              code: 'SERVER_FULL',
              message: `${room.name} is full (${room.maxPlayers}/${room.maxPlayers} players).`,
            });
            ws.close(4010, 'Server full');
            return;
          }

          const [acctUser, ownerCfg] = await Promise.all([
            fetchFirestoreAccountUsername(verified.uid, idToken),
            fetchOwnerConfig(idToken),
          ]);

          const clientDisplay =
            typeof msg.displayName === 'string' && msg.displayName.trim()
              ? msg.displayName.replace(/[<>]/g, '').trim().slice(0, 24)
              : 'Citizen';
          const resolvedUsername = acctUser?.username || clientDisplay;
          const resolvedLower = acctUser?.usernameLower || resolvedUsername.toLowerCase();

          const isVerifiedOwner =
            Boolean(ownerCfg.ownerUid) &&
            verified.uid === ownerCfg.ownerUid &&
            resolvedLower === ownerCfg.normalizedUsername;

          const safeDisplayName =
            !isVerifiedOwner && clientDisplay.toLowerCase().includes('owneranant')
              ? resolvedUsername.toLowerCase() === 'owneranant'
                ? 'Resident'
                : resolvedUsername
              : clientDisplay;

          const profile = (msg.profile && typeof msg.profile === 'object' ? msg.profile : {}) as Record<
            string,
            unknown
          >;

          const playerState: PlayerNetworkState = {
            uid: verified.uid,
            username: resolvedUsername,
            displayName: safeDisplayName,
            isOwner: isVerifiedOwner,
            level: clampNumber(profile.level, 1, 99, 1),
            selectedTitle:
              typeof profile.selectedTitle === 'string'
                ? profile.selectedTitle.replace(/[<>]/g, '').slice(0, 32)
                : 'New Arrival',
            appearanceId:
              typeof profile.appearanceId === 'string' ? profile.appearanceId.slice(0, 32) : 'street_explorer',
            appearanceConfig:
              profile.appearanceConfig && typeof profile.appearanceConfig === 'object'
                ? (profile.appearanceConfig as Record<string, unknown>)
                : {},
            equippedClothing:
              profile.equippedClothing && typeof profile.equippedClothing === 'object'
                ? (profile.equippedClothing as Record<string, string>)
                : {},
            hairOverride:
              profile.hairOverride && typeof profile.hairOverride === 'object'
                ? (profile.hairOverride as Record<string, unknown>)
                : null,
            x: clampNumber(msg.x, 0, 5200, 1136),
            y: clampNumber(msg.y, 0, 3900, 841),
            vx: 0,
            vy: 0,
            dir: 'down',
            anim: 'idle',
            interiorId: typeof msg.interiorId === 'string' ? msg.interiorId.slice(0, 48) : null,
            propertyDeedId: typeof msg.propertyDeedId === 'string' ? msg.propertyDeedId.slice(0, 80) : null,
            vehicle: null,
            ridingDriverUid: null,
            emote: null,
            updatedAt: Date.now(),
          };

          const meta: ConnectedSocketMeta = {
            ws,
            uid: verified.uid,
            roomId: room.id,
            isAlive: true,
            chatTimestamps: [],
            dirty: false,
          };

          clearTimeout(authTimeout);
          joined = true;
          room.hasHadJoin = true;
          room.authorizedUids.add(verified.uid);
          sessionMeta = meta;
          activeUidRegistry.set(verified.uid, meta);
          room.sockets.set(verified.uid, meta);
          room.players.set(verified.uid, playerState);

          // Gather any active invites waiting for this player
          const userInvites: ReturnType<typeof serializeInvite>[] = [];
          const now = Date.now();
          for (const inv of pendingInvites.values()) {
            const invRoom = rooms.get(inv.roomId);
            if (inv.toUid === verified.uid && invRoom && !invRoom.closed && now <= inv.expiresAtMs) {
              userInvites.push(serializeInvite(inv, invRoom));
            }
          }

          sendJson(ws, {
            type: 'welcome',
            self: playerState,
            room: {
              id: room.id,
              name: room.name,
              region: room.region,
              visibility: room.visibility,
              roomCode: room.roomCode,
              hostUid: room.hostUid,
              hostUsername: room.hostUsername,
              isOfficial: room.isOfficial,
              hasPassword: Boolean(room.passwordHash),
              maxPlayers: room.maxPlayers,
              playerCount: room.players.size,
            },
            players: Array.from(room.players.values()),
            lobbies: Array.from(room.lobbies.values()).map(serializeLobby),
            pendingInvites: userInvites,
          });

          broadcastRoom(
            room,
            {
              type: 'player_joined',
              player: playerState,
              playerCount: room.players.size,
            },
            verified.uid,
          );
          return;
        } catch (err) {
          sendJson(ws, {
            type: 'error',
            code: 'AUTH_INVALID',
            message: err instanceof Error ? err.message : 'Firebase token verification failed.',
          });
          ws.close(4005, 'Auth failed');
          return;
        }
      }

      if (!sessionMeta) return;
      const room = rooms.get(sessionMeta.roomId);
      if (!room) return;
      const self = room.players.get(sessionMeta.uid);
      if (!self) return;
      sessionMeta.isAlive = true;

      switch (msgType) {
        case 'ping': {
          sendJson(ws, {type: 'pong', t: msg.t ?? Date.now(), serverTime: Date.now()});
          break;
        }

        case 'close_room': {
          if (!room.isOfficial && room.hostUid === self.uid) {
            closeAndDestroyRoom(room.id, `Host ${room.hostUsername} closed ${room.name}.`);
          }
          break;
        }

        case 'move': {
          self.x = clampNumber(msg.x, 0, 5200, self.x);
          self.y = clampNumber(msg.y, 0, 3900, self.y);
          self.vx = clampNumber(msg.vx, -650, 650, 0);
          self.vy = clampNumber(msg.vy, -650, 650, 0);
          if (msg.dir === 'down' || msg.dir === 'up' || msg.dir === 'left' || msg.dir === 'right') {
            self.dir = msg.dir;
          }
          if (
            msg.anim === 'idle' ||
            msg.anim === 'walk' ||
            msg.anim === 'run' ||
            msg.anim === 'sit' ||
            msg.anim === 'celebrate'
          ) {
            self.anim = msg.anim;
          }
          self.interiorId = typeof msg.interiorId === 'string' ? msg.interiorId.slice(0, 48) : null;
          self.propertyDeedId = typeof msg.propertyDeedId === 'string' ? msg.propertyDeedId.slice(0, 80) : null;

          if (msg.vehicle && typeof msg.vehicle === 'object') {
            const v = msg.vehicle as Record<string, unknown>;
            const currentPassengers = self.vehicle?.passengers ?? [];
            self.vehicle = {
              id: typeof v.id === 'string' ? v.id.slice(0, 48) : 'veh',
              modelId: typeof v.modelId === 'string' ? v.modelId.slice(0, 32) : 'roadster',
              texture: typeof v.texture === 'string' ? v.texture.slice(0, 48) : 'veh_sedan_sky',
              customization:
                v.customization && typeof v.customization === 'object'
                  ? (v.customization as Record<string, string>)
                  : {},
              isScooter: Boolean(v.isScooter),
              passengers: currentPassengers,
            };
          } else {
            if (self.vehicle && self.vehicle.passengers.length > 0) {
              for (const pUid of self.vehicle.passengers) {
                const p = room.players.get(pUid);
                if (p) {
                  p.ridingDriverUid = null;
                  const pMeta = room.sockets.get(pUid);
                  if (pMeta) pMeta.dirty = true;
                }
              }
            }
            self.vehicle = null;
          }

          self.updatedAt = Date.now();
          sessionMeta.dirty = true;
          break;
        }

        case 'profile_sync': {
          if (msg.profile && typeof msg.profile === 'object') {
            const profile = msg.profile as Record<string, unknown>;
            if (typeof profile.level === 'number') self.level = clampNumber(profile.level, 1, 99, self.level);
            if (typeof profile.selectedTitle === 'string') {
              self.selectedTitle = profile.selectedTitle.replace(/[<>]/g, '').slice(0, 32);
            }
            if (typeof profile.appearanceId === 'string') {
              self.appearanceId = profile.appearanceId.slice(0, 32);
            }
            if (profile.appearanceConfig && typeof profile.appearanceConfig === 'object') {
              self.appearanceConfig = profile.appearanceConfig as Record<string, unknown>;
            }
            if (profile.equippedClothing && typeof profile.equippedClothing === 'object') {
              self.equippedClothing = profile.equippedClothing as Record<string, string>;
            }
            if (profile.hairOverride !== undefined) {
              self.hairOverride =
                profile.hairOverride && typeof profile.hairOverride === 'object'
                  ? (profile.hairOverride as Record<string, unknown>)
                  : null;
            }
            sessionMeta.dirty = true;
          }
          break;
        }

        case 'emote': {
          const emoteId = typeof msg.emoteId === 'string' ? msg.emoteId.slice(0, 24) : '';
          if (!emoteId) break;
          self.emote = {id: emoteId, expiresAt: Date.now() + 2800};
          sessionMeta.dirty = true;
          broadcastRoom(room, {
            type: 'emote_event',
            uid: self.uid,
            displayName: self.displayName,
            emoteId,
            x: self.x,
            y: self.y,
          });
          break;
        }

        case 'chat': {
          const now = Date.now();
          sessionMeta.chatTimestamps = sessionMeta.chatTimestamps.filter((ts) => now - ts < 10_000);
          if (sessionMeta.chatTimestamps.length >= 5) {
            sendJson(ws, {
              type: 'system_notice',
              message: 'Slow down! Chat rate limit reached (max 5 messages per 10 seconds).',
            });
            break;
          }
          const {text, flagged} = sanitizeChatText(msg.text);
          if (!text) break;
          sessionMeta.chatTimestamps.push(now);
          broadcastRoom(room, {
            type: 'chat_message',
            id: `chat_${now}_${Math.random().toString(36).slice(2, 6)}`,
            uid: self.uid,
            username: self.username,
            displayName: self.displayName,
            isOwner: self.isOwner,
            text,
            moderated: flagged,
            timestamp: now,
          });
          break;
        }

        case 'ride_request': {
          const driverUid = typeof msg.driverUid === 'string' ? msg.driverUid : '';
          const driver = room.players.get(driverUid);
          if (!driver || !driver.vehicle || driverUid === self.uid) {
            sendJson(ws, {type: 'system_notice', message: 'That player is not currently driving a vehicle.'});
            break;
          }
          const capacity = driver.vehicle.isScooter ? 1 : 3;
          if (driver.vehicle.passengers.length >= capacity) {
            sendJson(ws, {type: 'system_notice', message: `${driver.displayName}'s vehicle is full.`});
            break;
          }
          if (!driver.vehicle.passengers.includes(self.uid)) {
            driver.vehicle.passengers.push(self.uid);
          }
          self.ridingDriverUid = driverUid;
          sessionMeta.dirty = true;
          const driverMeta = room.sockets.get(driverUid);
          if (driverMeta) driverMeta.dirty = true;
          broadcastRoom(room, {
            type: 'ride_update',
            driverUid,
            passengerUid: self.uid,
            joined: true,
          });
          break;
        }

        case 'ride_exit': {
          if (self.ridingDriverUid) {
            const driver = room.players.get(self.ridingDriverUid);
            if (driver?.vehicle) {
              driver.vehicle.passengers = driver.vehicle.passengers.filter((id) => id !== self.uid);
              const driverMeta = room.sockets.get(driver.uid);
              if (driverMeta) driverMeta.dirty = true;
            }
            const prevDriver = self.ridingDriverUid;
            self.ridingDriverUid = null;
            sessionMeta.dirty = true;
            broadcastRoom(room, {
              type: 'ride_update',
              driverUid: prevDriver,
              passengerUid: self.uid,
              joined: false,
            });
          }
          break;
        }

        case 'property_updated': {
          const deedId = typeof msg.deedId === 'string' ? msg.deedId.slice(0, 80) : '';
          if (!deedId) break;
          broadcastRoom(
            room,
            {
              type: 'property_updated',
              deedId,
              ownerUid: self.uid,
              updatedAt: Date.now(),
            },
            self.uid,
          );
          break;
        }

        case 'property_invite': {
          const targetUid = typeof msg.targetUid === 'string' ? msg.targetUid : '';
          const deedId = typeof msg.deedId === 'string' ? msg.deedId.slice(0, 80) : '';
          const propertyName =
            typeof msg.propertyName === 'string'
              ? msg.propertyName.replace(/[<>]/g, '').slice(0, 48)
              : 'Private Property';
          const targetMeta = room.sockets.get(targetUid);
          if (targetMeta && deedId) {
            sendJson(targetMeta.ws, {
              type: 'property_invite',
              fromUid: self.uid,
              fromName: self.displayName,
              fromIsOwner: self.isOwner,
              deedId,
              propertyName,
            });
          }
          break;
        }

        case 'lobby_create': {
          const activityId = typeof msg.activityId === 'string' ? msg.activityId.slice(0, 32) : 'streetball';
          const title =
            typeof msg.title === 'string' ? msg.title.replace(/[<>]/g, '').slice(0, 48) : 'Multiplayer Challenge';
          const lobbyId = `lob_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const lobby: SharedLobby = {
            lobbyId,
            activityId,
            title,
            hostUid: self.uid,
            hostName: self.displayName,
            roomId: room.id,
            status: 'waiting',
            maxPlayers: 4,
            players: [
              {
                uid: self.uid,
                displayName: self.displayName,
                isOwner: self.isOwner,
                ready: true,
                score: 0,
                finished: false,
              },
            ],
            createdAt: Date.now(),
            awardClaimedUids: new Set(),
          };
          room.lobbies.set(lobbyId, lobby);
          broadcastRoom(room, {
            type: 'lobbies_sync',
            lobbies: Array.from(room.lobbies.values()).map(serializeLobby),
          });
          break;
        }

        case 'lobby_join': {
          const lobbyId = typeof msg.lobbyId === 'string' ? msg.lobbyId : '';
          const lobby = room.lobbies.get(lobbyId);
          if (!lobby || lobby.status !== 'waiting') {
            sendJson(ws, {type: 'system_notice', message: 'Activity lobby is unavailable or already started.'});
            break;
          }
          if (lobby.players.length >= lobby.maxPlayers) {
            sendJson(ws, {type: 'system_notice', message: 'Activity lobby is full.'});
            break;
          }
          if (!lobby.players.some((p) => p.uid === self.uid)) {
            lobby.players.push({
              uid: self.uid,
              displayName: self.displayName,
              isOwner: self.isOwner,
              ready: true,
              score: 0,
              finished: false,
            });
          }
          broadcastRoom(room, {
            type: 'lobbies_sync',
            lobbies: Array.from(room.lobbies.values()).map(serializeLobby),
          });
          break;
        }

        case 'lobby_leave': {
          const lobbyId = typeof msg.lobbyId === 'string' ? msg.lobbyId : '';
          const lobby = room.lobbies.get(lobbyId);
          if (!lobby) break;
          lobby.players = lobby.players.filter((p) => p.uid !== self.uid);
          if (lobby.players.length === 0) {
            room.lobbies.delete(lobbyId);
          } else if (lobby.hostUid === self.uid) {
            lobby.hostUid = lobby.players[0].uid;
            lobby.hostName = lobby.players[0].displayName;
          }
          broadcastRoom(room, {
            type: 'lobbies_sync',
            lobbies: Array.from(room.lobbies.values()).map(serializeLobby),
          });
          break;
        }

        case 'lobby_start': {
          const lobbyId = typeof msg.lobbyId === 'string' ? msg.lobbyId : '';
          const lobby = room.lobbies.get(lobbyId);
          if (!lobby || lobby.hostUid !== self.uid) break;
          lobby.status = 'active';
          for (const lp of lobby.players) {
            const pMeta = room.sockets.get(lp.uid);
            if (pMeta) {
              sendJson(pMeta.ws, {
                type: 'lobby_started',
                lobby: serializeLobby(lobby),
              });
            }
          }
          broadcastRoom(room, {
            type: 'lobbies_sync',
            lobbies: Array.from(room.lobbies.values()).map(serializeLobby),
          });
          break;
        }

        case 'lobby_finish': {
          const lobbyId = typeof msg.lobbyId === 'string' ? msg.lobbyId : '';
          const lobby = room.lobbies.get(lobbyId);
          if (!lobby) break;
          const entry = lobby.players.find((p) => p.uid === self.uid);
          if (!entry) break;
          const score = clampNumber(msg.score, 0, 50_000, 0);
          entry.score = score;
          entry.finished = true;

          if (!lobby.awardClaimedUids.has(self.uid)) {
            lobby.awardClaimedUids.add(self.uid);
            const bonusCoins = Math.min(45, 18 + Math.floor(score / 25));
            const bonusXp = Math.min(60, 25 + Math.floor(score / 20));
            sendJson(ws, {
              type: 'lobby_reward_granted',
              lobbyId: lobby.lobbyId,
              activityId: lobby.activityId,
              coins: bonusCoins,
              xp: bonusXp,
            });
          }

          if (lobby.players.every((p) => p.finished)) {
            lobby.status = 'finished';
            setTimeout(() => {
              room.lobbies.delete(lobby.lobbyId);
              broadcastRoom(room, {
                type: 'lobbies_sync',
                lobbies: Array.from(room.lobbies.values()).map(serializeLobby),
              });
            }, 8_000);
          }

          broadcastRoom(room, {
            type: 'lobbies_sync',
            lobbies: Array.from(room.lobbies.values()).map(serializeLobby),
          });
          break;
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[CHAOS CITY Server] Listening on http://0.0.0.0:${PORT} (WebSocket /ws ready)`);
  });
}

void startServer();
