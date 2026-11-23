import {
  Timestamp,
  deleteField,
  doc,
  getDocFromServer,
  runTransaction,
  serverTimestamp,
  setDoc,
  Transaction,
} from 'firebase/firestore';
import {
  OperationType,
  db,
  handleFirestoreError,
  isFirebaseConfigured,
} from '@/src/firebase/firebaseApp';
import {getShopItemById} from '@/src/game/data/catalog';
import {computeExplorationBreakdown} from '@/src/game/data/explorationData';
import {economySystem} from '@/src/game/systems/EconomySystem';
import {
  createDefaultSave,
  saveSystem,
  validateSaveRecord,
} from '@/src/game/systems/SaveSystem';
import {
  AuthSessionUser,
  CloudSyncState,
  SaveDataV1,
  SaveSyncStatus,
} from '@/src/game/types/gameTypes';

const AUTOSAVE_DEBOUNCE_MS = 1600;
const RETRY_DELAYS_MS = [2500, 6000, 12000];
const USERNAME_KEY_RE = /^[a-z0-9_]{3,20}$/;
const USERNAME_DISPLAY_RE = /^[a-zA-Z0-9_]{3,20}$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const ALLOWED_PROFILE_KEYS = new Set([
  'uid',
  'username',
  'normalizedUsername',
  'playerId',
  'appearanceId',
  'appearanceConfig',
  'equippedClothing',
  'ownedClothing',
  'inventoryCount',
  'coins',
  'achievementProgress',
  'missionProgress',
  'saveVersion',
  'createdAt',
  'updatedAt',
  'lastSavedAt',
]);

const ALLOWED_SAVE_KEYS = new Set([
  'uid',
  'username',
  'normalizedUsername',
  'schemaVersion',
  'saveVersion',
  'sessionId',
  'playerId',
  'playerName',
  'appearanceId',
  'appearanceConfig',
  'lastPosition',
  'settings',
  'coins',
  'energy',
  'inventory',
  'ownedClothing',
  'equippedClothing',
  'hairOverride',
  'outfitPresets',
  'selectedOutfitPresetId',
  'claimedRewards',
  'transactions',
  'arcadeHighScores',
  'cinemaTicketActive',
  'achievements',
  'missions',
  'progression',
  'story',
  'miniGameRecords',
  'vehicles',
  'activeVehicleId',
  'loungeTokens',
  'collectedIds',
  'ownedProperties',
  'discoveredSecrets',
  'collectibles',
  'privacySettings',
  'joinedAtMs',
  'friendCount',
  'clientUpdatedAt',
  'createdAt',
  'updatedAt',
]);

export interface CloudLoadResult {
  ok: boolean;
  state?: SaveDataV1;
  source?: 'cloud' | 'local_newer' | 'cloud_initialized';
  resolvedUsername?: string;
  resolvedNormalizedUsername?: string;
  errorCode?: string;
  message?: string;
}

function deriveOwnedClothing(save: SaveDataV1): string[] {
  return save.inventory
    .filter((e) => e.quantity > 0 && Boolean(getShopItemById(e.itemId)?.clothing))
    .map((e) => e.itemId)
    .slice(0, 120);
}

function sanitizeJsonValue<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

function sanitizeStringList(arr: unknown, maxLen: number, maxItemLen = 80): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const item of arr) {
    if (typeof item !== 'string') continue;
    const trimmed = item.slice(0, maxItemLen);
    out.push(trimmed);
    if (out.length >= maxLen) break;
  }
  return out;
}

function safeInt(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function safeFloat(val: unknown, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n * 100) / 100));
}

function sanitizeNumberMap(raw: unknown, maxKeys: number, maxVal = 1_000_000): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, maxKeys)) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      out[k.slice(0, 40)] = Math.min(maxVal, Math.floor(v));
    }
  }
  return out;
}

function sanitizeAppearanceForFirestore(cfg: SaveDataV1['appearanceConfig']) {
  const safeStr = (val: unknown, fallback: string) =>
    typeof val === 'string' && val.trim().length >= 1
      ? val.trim().slice(0, 32)
      : fallback;
  const safeHex = (val: unknown, fallback: string) =>
    typeof val === 'string' && HEX_COLOR_RE.test(val) ? val : fallback;
  return {
    gender: cfg?.gender === 'female' ? 'female' : 'male',
    skinTone: safeHex(cfg?.skinTone, '#f1c27d'),
    hairStyle: safeStr(cfg?.hairStyle, 'short'),
    hairColor: safeHex(cfg?.hairColor, '#2c1e16'),
    eyeStyle: safeStr(cfg?.eyeStyle, 'classic'),
    eyeColor: safeHex(cfg?.eyeColor, '#3b2f2f'),
    browStyle: safeStr(cfg?.browStyle, 'natural'),
    facialDetail: safeStr(cfg?.facialDetail, 'none'),
    facialHair: safeStr(cfg?.facialHair, 'none'),
  };
}

function sanitizeEquippedForFirestore(eq: SaveDataV1['equippedClothing']) {
  const cleanSlot = (val: unknown) =>
    typeof val === 'string' && val.trim().length > 0 ? val.trim().slice(0, 64) : null;
  return {
    shirt: cleanSlot(eq?.shirt),
    jacket: cleanSlot(eq?.jacket),
    trousers: cleanSlot(eq?.trousers),
    shoes: cleanSlot(eq?.shoes),
    hat: cleanSlot(eq?.hat),
    glasses: cleanSlot(eq?.glasses),
    accessory: cleanSlot(eq?.accessory),
  };
}

function sanitizeAchievementsForFirestore(ach: SaveDataV1['achievements']) {
  return {
    unlockedIds: sanitizeStringList(ach?.unlockedIds, 50, 80),
    stats: sanitizeNumberMap(ach?.stats, 24, 1_000_000),
  };
}

function sanitizeMissionsForFirestore(m: SaveDataV1['missions']) {
  const rawActive = typeof m?.activeMissionId === 'string' ? m.activeMissionId.trim().slice(0, 64) : '';
  return {
    visitedDistricts: sanitizeStringList(m?.visitedDistricts, 16, 80),
    visitedBuildings: sanitizeStringList(m?.visitedBuildings, 80, 80),
    completedIds: sanitizeStringList(m?.completedIds, 50, 80),
    metNpcs: sanitizeStringList(m?.metNpcs, 30, 80),
    itemsPurchased: Math.max(0, Math.floor(Number(m?.itemsPurchased ?? 0) || 0)),
    activitiesCompleted: Math.max(0, Math.floor(Number(m?.activitiesCompleted ?? 0) || 0)),
    garageCustomized: Boolean(m?.garageCustomized),
    vehicleSpawned: Boolean(m?.vehicleSpawned),
    activeMissionId: rawActive.length > 0 ? rawActive : null,
    acceptedIds: sanitizeStringList(m?.acceptedIds, 50, 48),
  };
}

function hasValidFirestoreTimestamp(val: unknown): boolean {
  if (val instanceof Timestamp) return true;
  if (!val || typeof val !== 'object') return false;
  const candidate = val as {toMillis?: unknown; toDate?: unknown};
  return typeof candidate.toMillis === 'function' && typeof candidate.toDate === 'function';
}

export function buildFirestoreProfileData(
  uid: string,
  username: string,
  normalizedUsername: string,
  save: SaveDataV1,
  includeCreatedAt: boolean,
): Record<string, unknown> {
  const ownedClothing = deriveOwnedClothing(save);
  const totalInvCount = save.inventory.reduce(
    (acc, e) => acc + safeInt(e?.quantity, 0, 10_000, 0),
    0,
  );
  const rawPlayerId = (save.playerId || `cc_res_${uid.slice(0, 10)}`).trim().slice(0, 64);
  const safePlayerId = rawPlayerId.length >= 3 ? rawPlayerId : `cc_res_${uid.slice(0, 10)}`;
  const rawAppearanceId = (save.appearanceId || 'street_explorer').trim().slice(0, 40) || 'street_explorer';

  const base: Record<string, unknown> = {
    playerId: safePlayerId,
    appearanceId: rawAppearanceId,
    appearanceConfig: sanitizeAppearanceForFirestore(save.appearanceConfig),
    equippedClothing: sanitizeEquippedForFirestore(save.equippedClothing),
    ownedClothing,
    inventoryCount: safeInt(totalInvCount, 0, 10_000, 0),
    coins: safeInt(save.coins, 0, 1_000_000, 0),
    achievementProgress: sanitizeAchievementsForFirestore(save.achievements),
    missionProgress: sanitizeMissionsForFirestore(save.missions),
    saveVersion: safeInt(save.saveVersion, 1, 1_000_000_000, 1),
    updatedAt: serverTimestamp(),
    lastSavedAt: serverTimestamp(),
  };

  if (includeCreatedAt) {
    base.uid = uid;
    base.username = username;
    base.normalizedUsername = normalizedUsername;
    base.createdAt = serverTimestamp();
  }
  return base;
}

export function buildFirestoreSaveData(
  uid: string,
  username: string,
  normalizedUsername: string,
  sessionId: string,
  save: SaveDataV1,
  includeCreatedAt: boolean,
): Record<string, unknown> {
  const ownedClothing = deriveOwnedClothing(save);
  const cleanPlayerName = (save.playerName || username || 'Resident').trim().slice(0, 24) || 'Resident';
  const rawPlayerId = (save.playerId || `cc_res_${uid.slice(0, 10)}`).trim().slice(0, 64);
  const safePlayerId = rawPlayerId.length >= 3 ? rawPlayerId : `cc_res_${uid.slice(0, 10)}`;
  const rawAppearanceId = (save.appearanceId || 'street_explorer').trim().slice(0, 40) || 'street_explorer';
  const rawSessionId = sessionId.trim().slice(0, 64);
  const safeSessionId = rawSessionId.length >= 4 ? rawSessionId : `sess_${Date.now().toString(36)}`;

  const cleanProgression = {
    xp: safeInt(save.progression?.xp, 0, 100_000, 0),
    level: safeInt(save.progression?.level, 1, 20, 1),
    selectedTitle: (save.progression?.selectedTitle || 'New Arrival').trim().slice(0, 40) || 'New Arrival',
    unlockedTitles: sanitizeStringList(save.progression?.unlockedTitles ?? ['New Arrival'], 20, 80),
    unlockedBadges: sanitizeStringList(save.progression?.unlockedBadges ?? ['badge_citizen'], 24, 80),
    dailyResetKey: (save.progression?.dailyResetKey ?? '').slice(0, 20),
    weeklyResetKey: (save.progression?.weeklyResetKey ?? '').slice(0, 20),
    dailyCounts: sanitizeNumberMap(save.progression?.dailyCounts, 20, 100_000),
    weeklyCounts: sanitizeNumberMap(save.progression?.weeklyCounts, 20, 100_000),
  };
  const cleanBaseline = save.story?.missionBaseline
    ? {
        districts: safeInt(save.story.missionBaseline.districts, 0, 100_000, 0),
        buildings: safeInt(save.story.missionBaseline.buildings, 0, 100_000, 0),
        itemsPurchased: safeInt(save.story.missionBaseline.itemsPurchased, 0, 100_000, 0),
        activitiesCompleted: safeInt(save.story.missionBaseline.activitiesCompleted, 0, 100_000, 0),
        deliveriesCompleted: safeInt(save.story.missionBaseline.deliveriesCompleted, 0, 100_000, 0),
        racesCompleted: safeInt(save.story.missionBaseline.racesCompleted, 0, 100_000, 0),
        shardsCollected: safeInt(save.story.missionBaseline.shardsCollected, 0, 100_000, 0),
        secretsDiscovered: safeInt(save.story.missionBaseline.secretsDiscovered, 0, 100_000, 0),
      }
    : null;
  const cleanChoices: Record<string, string> = {};
  if (save.story?.choices && typeof save.story.choices === 'object') {
    for (const [k, v] of Object.entries(save.story.choices).slice(0, 12)) {
      if (typeof v === 'string' && v.trim()) {
        cleanChoices[k.trim().slice(0, 40)] = v.trim().slice(0, 40);
      }
    }
  }
  const cleanStory = {
    started: Boolean(save.story?.started),
    currentChapter: safeInt(save.story?.currentChapter, 1, 10, 1),
    completedChapters: (save.story?.completedChapters ?? [])
      .filter((c) => typeof c === 'number' && Number.isInteger(c) && c >= 1 && c <= 10)
      .slice(0, 10),
    watchedCutscenes: sanitizeStringList(save.story?.watchedCutscenes ?? [], 30, 80),
    currentMissionId:
      typeof save.story?.currentMissionId === 'string' && save.story.currentMissionId.trim()
        ? save.story.currentMissionId.trim().slice(0, 48)
        : null,
    completedMissionIds: sanitizeStringList(save.story?.completedMissionIds ?? [], 20, 48),
    missionPhase:
      typeof save.story?.missionPhase === 'string' && save.story.missionPhase.trim()
        ? save.story.missionPhase.trim().slice(0, 32)
        : 'talk_to_mission_man',
    choices: cleanChoices,
    campaignCompleted: Boolean(save.story?.campaignCompleted),
    endingUnlocked: Boolean(save.story?.endingUnlocked),
    teaserViewed: Boolean(save.story?.teaserViewed),
    missionBaseline: cleanBaseline,
  };
  const cleanRecords = {
    fountainFlipsPlayed: safeInt(save.miniGameRecords?.fountainFlipsPlayed, 0, 100_000, 0),
    fountainFlipsWon: safeInt(save.miniGameRecords?.fountainFlipsWon, 0, 100_000, 0),
    fishCaught: safeInt(save.miniGameRecords?.fishCaught, 0, 100_000, 0),
    bestFishWeightKg: safeFloat(save.miniGameRecords?.bestFishWeightKg, 0, 9999, 0),
    racesCompleted: safeInt(save.miniGameRecords?.racesCompleted, 0, 100_000, 0),
    bestRaceSec: safeFloat(save.miniGameRecords?.bestRaceSec, 0, 9999, 0),
    parkSprintsCompleted: safeInt(save.miniGameRecords?.parkSprintsCompleted, 0, 100_000, 0),
    bestSprintSec: safeFloat(save.miniGameRecords?.bestSprintSec, 0, 9999, 0),
    deliveriesCompleted: safeInt(save.miniGameRecords?.deliveriesCompleted, 0, 100_000, 0),
    memoryGamesWon: safeInt(save.miniGameRecords?.memoryGamesWon, 0, 100_000, 0),
    bestMemoryRound: safeInt(save.miniGameRecords?.bestMemoryRound, 0, 100_000, 0),
  };

  const base: Record<string, unknown> = {
    saveVersion: safeInt(save.saveVersion, 1, 1_000_000_000, 1),
    sessionId: safeSessionId,
    playerId: safePlayerId,
    playerName: cleanPlayerName,
    appearanceId: rawAppearanceId,
    appearanceConfig: sanitizeAppearanceForFirestore(save.appearanceConfig),
    lastPosition: save.lastPosition ? sanitizeJsonValue(save.lastPosition) : null,
    settings: sanitizeJsonValue(save.settings),
    coins: safeInt(save.coins, 0, 1_000_000, 0),
    energy: safeInt(save.energy, 0, 100, 100),
    inventory: sanitizeJsonValue(save.inventory.slice(0, 150)),
    ownedClothing,
    equippedClothing: sanitizeEquippedForFirestore(save.equippedClothing),
    hairOverride: sanitizeJsonValue(save.hairOverride),
    outfitPresets: sanitizeJsonValue(save.outfitPresets.slice(0, 12)),
    selectedOutfitPresetId: save.selectedOutfitPresetId ? save.selectedOutfitPresetId.slice(0, 48) : null,
    claimedRewards: sanitizeStringList(save.claimedRewards, 200, 80),
    transactions: sanitizeJsonValue(save.transactions.slice(0, 40)),
    arcadeHighScores: sanitizeNumberMap(save.arcadeHighScores, 20, 10_000_000),
    cinemaTicketActive: Boolean(save.cinemaTicketActive),
    achievements: sanitizeAchievementsForFirestore(save.achievements),
    missions: sanitizeMissionsForFirestore(save.missions),
    progression: cleanProgression,
    story: cleanStory,
    miniGameRecords: cleanRecords,
    vehicles: sanitizeJsonValue(save.vehicles.slice(0, 16)),
    activeVehicleId: save.activeVehicleId ? save.activeVehicleId.slice(0, 48) : null,
    loungeTokens: safeInt(save.loungeTokens, 0, 100_000, 50),
    collectedIds: sanitizeStringList(save.collectedIds ?? [], 60, 80),
    ownedProperties: sanitizeStringList(save.ownedProperties ?? [], 16, 48),
    discoveredSecrets: sanitizeStringList(save.discoveredSecrets ?? [], 40, 48),
    collectibles: sanitizeStringList(save.collectibles ?? [], 80, 48),
    privacySettings: sanitizeJsonValue(save.privacySettings ?? {}),
    joinedAtMs: safeInt(save.joinedAtMs, 0, 9_999_999_999_999, Date.now()),
    friendCount: safeInt(save.friendCount, 0, 500, 0),
    clientUpdatedAt: safeInt(save.updatedAt, 0, 9_999_999_999_999, Date.now()),
    updatedAt: serverTimestamp(),
  };

  if (includeCreatedAt) {
    base.uid = uid;
    base.username = username;
    base.normalizedUsername = normalizedUsername;
    base.schemaVersion = 1;
    base.createdAt = serverTimestamp();
  }
  return base;
}

function mapCloudErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('offline') || msg.includes('unavailable') || msg.includes('network')) {
    return 'Network unavailable. Progress is safely cached locally and will retry automatically.';
  }
  if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
    return 'Cloud permission rejected this write. Verify Firestore rules & account status.';
  }
  if (msg.includes('STALE_CLOUD_CONFLICT')) {
    return 'A newer cloud save was found from another session.';
  }
  return 'Could not reach cloud save right now. Local backup preserved.';
}

class LoadManager {
  public async loadCloudSaveForUser(
    uid: string,
    fallbackUsername?: string,
  ): Promise<CloudLoadResult> {
    if (!isFirebaseConfigured()) {
      return {
        ok: false,
        errorCode: 'not_configured',
        message: 'Firebase is not configured for this project.',
      };
    }

    const savePath = `saves/${uid}`;
    const userPath = `users/${uid}`;

    try {
      let saveSnap;
      let userSnap;
      try {
        [saveSnap, userSnap] = await Promise.all([
          getDocFromServer(doc(db, 'saves', uid)),
          getDocFromServer(doc(db, 'users', uid)),
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Missing or insufficient permissions')) {
          handleFirestoreError(err, OperationType.GET, savePath);
        }
        return {
          ok: false,
          errorCode: 'network_unavailable',
          message:
            'Unable to reach your CHAOS CITY cloud save. Check your connection and try again.',
        };
      }

      const localBackup = saveSystem.readAccountBackup(uid);
      const profileData = userSnap.exists() ? userSnap.data() : null;

      if (!saveSnap.exists()) {
        // Account exists in Auth (e.g., interrupted legacy signup) but no cloud save yet.
        // Never silently overwrite anything; inspect user profile if present or initialize cleanly.
        const resolvedUsername =
          (typeof profileData?.username === 'string' && profileData.username) || fallbackUsername;
        const resolvedNormalizedUsername =
          typeof profileData?.normalizedUsername === 'string' && profileData.normalizedUsername
            ? profileData.normalizedUsername
            : resolvedUsername
              ? resolvedUsername.trim().toLowerCase()
              : undefined;
        const resolvedName = resolvedUsername || 'Resident';

        if (localBackup && localBackup.saveVersion > 1) {
          saveSystem.applyCloudLoadedSave({...localBackup, cloudConfirmedAt: null}, uid, false);
          return {
            ok: true,
            state: {...localBackup, cloudConfirmedAt: null},
            source: 'local_newer',
            resolvedUsername,
            resolvedNormalizedUsername,
          };
        }

        const fresh = createDefaultSave(resolvedName);
        saveSystem.applyCloudLoadedSave(fresh, uid, false);
        return {
          ok: true,
          state: fresh,
          source: 'cloud_initialized',
          resolvedUsername,
          resolvedNormalizedUsername,
        };
      }

      const rawCloud = saveSnap.data();
      const cloudUsername =
        (typeof rawCloud.username === 'string' && rawCloud.username) ||
        (typeof profileData?.username === 'string' && profileData.username) ||
        fallbackUsername;
      const cloudNormalizedUsername =
        (typeof rawCloud.normalizedUsername === 'string' && rawCloud.normalizedUsername) ||
        (typeof profileData?.normalizedUsername === 'string' && profileData.normalizedUsername) ||
        (cloudUsername ? cloudUsername.trim().toLowerCase() : undefined);

      const cloudValidated = validateSaveRecord(
        {
          ...rawCloud,
          version: typeof rawCloud.schemaVersion === 'number' ? rawCloud.schemaVersion : 1,
          cloudConfirmedAt: Date.now(),
        },
        cloudUsername ?? fallbackUsername,
      );

      if (!cloudValidated) {
        return {
          ok: false,
          errorCode: 'invalid_cloud_save',
          message: 'Cloud save validation failed. Please retry or contact support.',
        };
      }

      // Compare versions & timestamps safely: never let older local cache overwrite newer cloud save!
      if (
        localBackup &&
        localBackup.saveVersion > cloudValidated.saveVersion &&
        localBackup.updatedAt > cloudValidated.updatedAt &&
        localBackup.cloudConfirmedAt === null
      ) {
        saveSystem.applyCloudLoadedSave(localBackup, uid, false);
        return {
          ok: true,
          state: localBackup,
          source: 'local_newer',
          resolvedUsername: cloudUsername,
          resolvedNormalizedUsername: cloudNormalizedUsername,
        };
      }

      saveSystem.applyCloudLoadedSave(cloudValidated, uid);
      return {
        ok: true,
        state: cloudValidated,
        source: 'cloud',
        resolvedUsername: cloudUsername,
        resolvedNormalizedUsername: cloudNormalizedUsername,
      };
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('{')) {
        throw err;
      }
      return {
        ok: false,
        errorCode: 'cloud_load_failed',
        message: mapCloudErrorMessage(err),
      };
    }
  }
}

class CloudSaveManager {
  private readonly sessionId = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  private activeUser: AuthSessionUser | null = null;
  private status: SaveSyncStatus = 'local_only';
  private lastSavedAtMs: number | null = null;
  private lastError: string | null = null;
  private lastConfirmedSaveVersion = 0;

  private debounceTimer: number | null = null;
  private retryTimer: number | null = null;
  private retryAttempt = 0;
  private inFlightPromise: Promise<boolean> | null = null;
  private queuedFlush = false;
  private queuedForce = false;

  private listeners = new Set<(state: CloudSyncState) => void>();

  constructor() {
    saveSystem.onSaveMutated((data, immediate) => {
      if (!this.activeUser) {
        this.status = 'local_only';
        this.emit();
        return;
      }
      if (data.saveVersion <= this.lastConfirmedSaveVersion && !this.queuedFlush) {
        return;
      }
      if (immediate) {
        void this.flushNow();
      } else {
        this.scheduleDebouncedSave();
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (this.activeUser && this.hasPendingChanges()) {
          void this.flushNow();
        }
      });
      const flushOnBackground = () => {
        if (this.activeUser && (this.debounceTimer !== null || this.hasPendingChanges())) {
          void this.flushNow();
        }
      };
      window.addEventListener('pagehide', flushOnBackground);
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'hidden') {
            flushOnBackground();
          }
        });
      }
    }
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getSyncState(): CloudSyncState {
    return {
      status: this.status,
      lastSavedAtMs: this.lastSavedAtMs,
      lastError: this.lastError,
      pendingChanges: this.hasPendingChanges(),
      uid: this.activeUser?.uid ?? null,
      username: this.activeUser?.username ?? null,
    };
  }

  public subscribe(listener: (state: CloudSyncState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSyncState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snap = this.getSyncState();
    for (const fn of this.listeners) {
      fn(snap);
    }
  }

  private hasPendingChanges(): boolean {
    if (!this.activeUser) return false;
    return saveSystem.getState().saveVersion > this.lastConfirmedSaveVersion;
  }

  public bindAuthenticatedSession(
    user: AuthSessionUser | null,
    loadedVersion?: number,
    cloudConfirmedAtMs?: number | null,
  ): void {
    this.clearTimers();
    this.retryAttempt = 0;
    this.queuedFlush = false;
    this.queuedForce = false;
    this.activeUser = user;
    if (!user) {
      this.status = 'local_only';
      this.lastSavedAtMs = null;
      this.lastError = null;
      this.lastConfirmedSaveVersion = 0;
      this.emit();
      return;
    }

    this.lastConfirmedSaveVersion = cloudConfirmedAtMs
      ? (loadedVersion ?? saveSystem.getState().saveVersion)
      : 0;
    this.lastSavedAtMs = cloudConfirmedAtMs ?? Date.now();
    this.status = cloudConfirmedAtMs ? 'saved' : 'local_only';
    this.lastError = null;
    this.emit();
  }

  private clearTimers(): void {
    if (typeof window === 'undefined') return;
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private scheduleDebouncedSave(): void {
    if (!this.activeUser || typeof window === 'undefined') return;
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;
      void this.flushNow();
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  private scheduleRetry(): void {
    if (!this.activeUser || typeof window === 'undefined') return;
    if (this.retryAttempt >= RETRY_DELAYS_MS.length) return;
    const delay = RETRY_DELAYS_MS[this.retryAttempt];
    this.retryAttempt += 1;
    if (this.retryTimer !== null) {
      window.clearTimeout(this.retryTimer);
    }
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      void this.flushNow();
    }, delay);
  }

  public async flushNow(force = false): Promise<boolean> {
    if (!this.activeUser || !isFirebaseConfigured()) {
      return false;
    }

    if (this.inFlightPromise) {
      this.queuedFlush = true;
      if (force) {
        this.queuedForce = true;
      }
      return this.inFlightPromise;
    }

    const currentSave = saveSystem.getState();
    if (!force && currentSave.saveVersion <= this.lastConfirmedSaveVersion) {
      return true;
    }

    const runLoop = async (): Promise<boolean> => {
      let nextForce = force;
      let ok = false;
      do {
        this.queuedFlush = false;
        this.queuedForce = false;
        ok = await this.executeFlush();
        if (!ok) {
          this.queuedFlush = false;
          this.queuedForce = false;
          return false;
        }
        nextForce = this.queuedForce;
      } while (
        this.activeUser &&
        (nextForce || this.queuedFlush || this.hasPendingChanges())
      );
      return ok;
    };

    const runPromise = runLoop().finally(() => {
      if (this.inFlightPromise === runPromise) {
        this.inFlightPromise = null;
      }
    });
    this.inFlightPromise = runPromise;
    return runPromise;
  }

  private async executeFlush(): Promise<boolean> {
    if (!this.activeUser || !isFirebaseConfigured()) {
      return false;
    }

    this.clearTimers();
    this.status = 'saving';
    this.lastError = null;
    this.emit();

    const user = this.activeUser;
    const saveSnapshot = saveSystem.getState();
    const saveRef = doc(db, 'saves', user.uid);
    const userRef = doc(db, 'users', user.uid);
    let targetPath = `saves/${user.uid}`;
    let targetOp: OperationType = OperationType.WRITE;
    let effectiveSaveVersion = saveSnapshot.saveVersion;

    try {
      await runTransaction(db, async (tx: Transaction) => {
        const [existingSaveSnap, existingUserSnap] = await Promise.all([
          tx.get(saveRef),
          tx.get(userRef),
        ]);

        const existingSaveData = existingSaveSnap.exists() ? existingSaveSnap.data() : null;
        const existingUserData = existingUserSnap.exists() ? existingUserSnap.data() : null;

        const rawSaveVer = Number(existingSaveData?.saveVersion ?? 0);
        const rawUserVer = Number(existingUserData?.saveVersion ?? 0);
        const remoteSaveVer = Number.isFinite(rawSaveVer) ? Math.floor(rawSaveVer) : 0;
        const remoteUserVer = Number.isFinite(rawUserVer) ? Math.floor(rawUserVer) : 0;
        const remoteSession = existingSaveData?.sessionId;
        if (
          remoteSaveVer > saveSnapshot.saveVersion &&
          remoteSession &&
          remoteSession !== this.sessionId
        ) {
          throw new Error('STALE_CLOUD_CONFLICT');
        }

        effectiveSaveVersion = Math.max(1, saveSnapshot.saveVersion, remoteSaveVer, remoteUserVer);
        const alignedSnapshot: SaveDataV1 =
          effectiveSaveVersion !== saveSnapshot.saveVersion
            ? {...saveSnapshot, saveVersion: effectiveSaveVersion}
            : saveSnapshot;

        const resolvedUsernameRaw =
          (typeof existingSaveData?.username === 'string' &&
            USERNAME_DISPLAY_RE.test(existingSaveData.username) &&
            existingSaveData.username) ||
          (typeof existingUserData?.username === 'string' &&
            USERNAME_DISPLAY_RE.test(existingUserData.username) &&
            existingUserData.username) ||
          (USERNAME_DISPLAY_RE.test(user.username) ? user.username : 'Resident');

        const derivedNormalized = resolvedUsernameRaw.trim().toLowerCase();
        const resolvedNormalized =
          (typeof existingSaveData?.normalizedUsername === 'string' &&
            USERNAME_KEY_RE.test(existingSaveData.normalizedUsername) &&
            existingSaveData.normalizedUsername) ||
          (typeof existingUserData?.normalizedUsername === 'string' &&
            USERNAME_KEY_RE.test(existingUserData.normalizedUsername) &&
            existingUserData.normalizedUsername) ||
          (USERNAME_KEY_RE.test(derivedNormalized) ? derivedNormalized : user.normalizedUsername);

        const needsDocCreate = !existingSaveSnap.exists() || !existingUserSnap.exists();
        let usernameRefToCreate: ReturnType<typeof doc> | null = null;
        if (needsDocCreate && USERNAME_KEY_RE.test(resolvedNormalized)) {
          const uRef = doc(db, 'usernames', resolvedNormalized);
          const uSnap = await tx.get(uRef);
          if (!uSnap.exists() && resolvedNormalized !== 'resident') {
            usernameRefToCreate = uRef;
          }
        }

        const savePayload = buildFirestoreSaveData(
          user.uid,
          resolvedUsernameRaw,
          resolvedNormalized,
          this.sessionId,
          alignedSnapshot,
          !existingSaveSnap.exists(),
        );
        const profilePayload = buildFirestoreProfileData(
          user.uid,
          resolvedUsernameRaw,
          resolvedNormalized,
          alignedSnapshot,
          !existingUserSnap.exists(),
        );

        if (existingSaveData) {
          if (existingSaveData.uid !== user.uid) savePayload.uid = user.uid;
          if (
            typeof existingSaveData.username !== 'string' ||
            !USERNAME_DISPLAY_RE.test(existingSaveData.username)
          ) {
            savePayload.username = resolvedUsernameRaw;
          }
          if (
            typeof existingSaveData.normalizedUsername !== 'string' ||
            !USERNAME_KEY_RE.test(existingSaveData.normalizedUsername)
          ) {
            savePayload.normalizedUsername = resolvedNormalized;
          }
          if (existingSaveData.schemaVersion !== 1) {
            savePayload.schemaVersion = 1;
          }
          if (!hasValidFirestoreTimestamp(existingSaveData.createdAt)) {
            savePayload.createdAt = serverTimestamp();
          }
          for (const key of Object.keys(existingSaveData)) {
            if (!ALLOWED_SAVE_KEYS.has(key)) {
              savePayload[key] = deleteField();
            }
          }
        }

        if (existingUserData) {
          if (existingUserData.uid !== user.uid) profilePayload.uid = user.uid;
          if (
            typeof existingUserData.username !== 'string' ||
            !USERNAME_DISPLAY_RE.test(existingUserData.username)
          ) {
            profilePayload.username = resolvedUsernameRaw;
          }
          if (
            typeof existingUserData.normalizedUsername !== 'string' ||
            !USERNAME_KEY_RE.test(existingUserData.normalizedUsername)
          ) {
            profilePayload.normalizedUsername = resolvedNormalized;
          }
          if (!hasValidFirestoreTimestamp(existingUserData.createdAt)) {
            profilePayload.createdAt = serverTimestamp();
          }
          for (const key of Object.keys(existingUserData)) {
            if (!ALLOWED_PROFILE_KEYS.has(key)) {
              profilePayload[key] = deleteField();
            }
          }
        }

        const opsSummary: string[] = [];
        if (usernameRefToCreate) {
          opsSummary.push(`usernames/${resolvedNormalized} (create)`);
          tx.set(usernameRefToCreate, {
            uid: user.uid,
            username: resolvedUsernameRaw,
            normalizedUsername: resolvedNormalized,
            createdAt: serverTimestamp(),
          });
        }

        opsSummary.push(
          `saves/${user.uid} (${existingSaveSnap.exists() ? 'update' : 'create'})`,
        );
        if (existingSaveSnap.exists()) {
          tx.update(saveRef, savePayload);
        } else {
          tx.set(saveRef, savePayload);
        }

        opsSummary.push(
          `users/${user.uid} (${existingUserSnap.exists() ? 'update' : 'create'})`,
        );
        if (existingUserSnap.exists()) {
          tx.update(userRef, profilePayload);
        } else {
          tx.set(userRef, profilePayload);
        }

        targetPath = opsSummary.join(' + ');
        targetOp =
          existingSaveSnap.exists() && existingUserSnap.exists()
            ? OperationType.UPDATE
            : OperationType.WRITE;
      });

      const confirmedAt = Date.now();
      this.lastConfirmedSaveVersion = Math.max(
        this.lastConfirmedSaveVersion,
        effectiveSaveVersion,
      );
      saveSystem.markCloudConfirmed(
        saveSnapshot.saveVersion,
        confirmedAt,
        effectiveSaveVersion,
      );
      this.lastSavedAtMs = confirmedAt;
      this.status = 'saved';
      this.lastError = null;
      this.retryAttempt = 0;
      this.emit();
      void this.syncPublicProfile(null, false);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes('STALE_CLOUD_CONFLICT')) {
        // Safely pull newer cloud progress instead of overwriting it with older local state!
        const reloaded = await loadManager.loadCloudSaveForUser(user.uid, user.username);
        if (reloaded.ok && reloaded.state) {
          this.lastConfirmedSaveVersion = reloaded.state.saveVersion;
          this.lastSavedAtMs = Date.now();
          this.status = 'saved';
          this.lastError = 'Synced newer progress from another active session.';
          economySystem.notifyExternalReset();
          this.emit();
          return true;
        }
      }

      if (
        msg.includes('Missing or insufficient permissions') ||
        msg.includes('permission-denied')
      ) {
        try {
          handleFirestoreError(err, targetOp, targetPath);
        } catch {
          // Structured FirestoreErrorInfo was logged above; preserve offline/local resilience cleanly.
        }
      }

      const offline =
        (typeof navigator !== 'undefined' && navigator.onLine === false) ||
        msg.includes('offline') ||
        msg.includes('unavailable');

      this.status = offline ? 'offline' : 'error';
      this.lastError = mapCloudErrorMessage(err);
      this.emit();
      this.scheduleRetry();
      return false;
    }
  }

  public async syncPublicProfile(onlineServerId: string | null, isOnline = true): Promise<void> {
    if (!this.activeUser || !isFirebaseConfigured()) return;
    try {
      const user = this.activeUser;
      const save = saveSystem.getState();
      const exploration = computeExplorationBreakdown(save);
      const visibility = save.privacySettings?.profileVisibility ?? 'public';
      const showOnline = save.privacySettings?.showOnlineStatus !== false;

      const payload = {
        uid: user.uid,
        username: user.username,
        normalizedUsername: user.normalizedUsername,
        displayName: (save.playerName || user.username || 'Resident').trim().slice(0, 24) || 'Resident',
        level: Math.max(1, Math.min(99, Math.floor(save.progression?.level ?? 1))),
        xp: Math.max(0, Math.min(100_000, Math.floor(save.progression?.xp ?? 0))),
        selectedTitle: (save.progression?.selectedTitle || 'New Arrival').trim().slice(0, 40) || 'New Arrival',
        appearanceId: (save.appearanceId || 'street_explorer').trim().slice(0, 40) || 'street_explorer',
        appearanceConfig: sanitizeAppearanceForFirestore(save.appearanceConfig),
        equippedClothing: sanitizeEquippedForFirestore(save.equippedClothing),
        hairOverride: sanitizeJsonValue(save.hairOverride),
        ownedPropertyCount: (save.ownedProperties ?? []).length,
        ownedVehicleCount: (save.vehicles ?? []).length,
        missionsCompletedCount: (save.missions?.completedIds ?? []).length,
        miniGamesPlayedCount: Math.max(0, Math.floor(save.missions?.activitiesCompleted ?? 0)),
        achievementCount: (save.achievements?.unlockedIds ?? []).length,
        explorationPercent: exploration.overallPercent,
        joinedAtMs: Math.max(0, Math.floor(save.joinedAtMs || Date.now())),
        onlineServerId: showOnline ? onlineServerId : null,
        isOnline: showOnline ? isOnline : false,
        profileVisibility: visibility,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'publicProfiles', user.uid), payload, {merge: true});
    } catch {
      // Non-fatal background public profile sync
    }
  }
}

export const loadManager = new LoadManager();
export const cloudSaveManager = new CloudSaveManager();
