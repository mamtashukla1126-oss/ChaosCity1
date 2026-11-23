import {
  CAMERA_MAX_ZOOM,
  CAMERA_MIN_ZOOM,
  CHARACTER_PRESETS,
  DEFAULT_KEYBINDS,
  DEFAULT_PRIVACY_SETTINGS,
  DEFAULT_SETTINGS,
  EYE_COLORS,
  SAVE_SCHEMA_VERSION,
  SAVE_STORAGE_KEY,
  SKIN_TONES,
  STARTING_COINS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '@/src/config/constants';
import {
  createStarterOwnedVehicle,
  getVehicleModelSpec,
} from '@/src/game/data/cityLifeData';
import {
  getDailyResetKey,
  getLevelForXp,
  getWeeklyResetKey,
} from '@/src/game/data/progressionData';
import {getShopItemById} from '@/src/game/data/catalog';
import {
  AchievementProgress,
  BrowStyleId,
  CharacterAppearanceConfig,
  CharacterPreset,
  ClothingSlot,
  ControlKeybinds,
  DecalStyle,
  Direction,
  EffectsQuality,
  EquippedClothing,
  EyeStyleId,
  FacialDetailId,
  FacialHairId,
  GameSettings,
  GenderType,
  GraphicsQuality,
  HairOverride,
  HairStyleId,
  HeadlightStyle,
  InventoryEntry,
  MiniGameRecords,
  MissionProgress,
  OutfitPreset,
  OwnedVehicleRecord,
  PrivacySettings,
  ProgressionState,
  RenderDistanceMode,
  SaveDataV1,
  SavedPosition,
  SpoilerStyle,
  StoryCampaignPhase,
  StoryMissionBaseline,
  StoryProgressState,
  TransactionRecord,
  VehicleCustomization,
  VehicleModelId,
  VehicleUpgrades,
  WheelStyle,
} from '@/src/game/types/gameTypes';
import {clamp, sanitizeDisplayName} from '@/src/game/utils/helpers';

export interface ISaveStorageAdapter {
  load(): SaveDataV1;
  save(data: SaveDataV1): boolean;
  reset(): SaveDataV1;
}

const VALID_DIRECTIONS: Direction[] = ['down', 'up', 'left', 'right'];
const VALID_HAIR_STYLES: HairStyleId[] = [
  'short',
  'bob',
  'spiky',
  'cap',
  'pompadour',
  'curly',
  'sidepart',
  'buzz',
  'long_waves',
  'ponytail',
  'space_buns',
];
const VALID_EYE_STYLES: EyeStyleId[] = ['classic', 'wide', 'sharp', 'lashes'];
const VALID_BROW_STYLES: BrowStyleId[] = ['natural', 'thick', 'arched', 'soft'];
const VALID_FACIAL_DETAILS: FacialDetailId[] = ['none', 'freckles', 'blush', 'beauty_mark'];
const VALID_FACIAL_HAIR: FacialHairId[] = ['none', 'stubble', 'goatee', 'beard'];
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createEmptyEquipped(): EquippedClothing {
  return {
    shirt: null,
    jacket: null,
    trousers: null,
    shoes: null,
    hat: null,
    glasses: null,
    accessory: null,
  };
}

export function createDefaultAchievements(): AchievementProgress {
  return {
    unlockedIds: [],
    stats: {},
  };
}

export function createDefaultMissions(): MissionProgress {
  return {
    visitedDistricts: [],
    visitedBuildings: [],
    completedIds: [],
    itemsPurchased: 0,
    activitiesCompleted: 0,
    metNpcs: [],
    garageCustomized: false,
    vehicleSpawned: false,
    activeMissionId: 'm_districts_5',
    acceptedIds: ['m_districts_5'],
  };
}

export function createDefaultProgression(): ProgressionState {
  return {
    xp: 0,
    level: 1,
    selectedTitle: 'New Arrival',
    unlockedTitles: ['New Arrival'],
    unlockedBadges: ['badge_citizen'],
    dailyResetKey: getDailyResetKey(),
    weeklyResetKey: getWeeklyResetKey(),
    dailyCounts: {},
    weeklyCounts: {},
  };
}

export function createDefaultStory(): StoryProgressState {
  return {
    started: false,
    currentChapter: 1,
    completedChapters: [],
    watchedCutscenes: [],
    currentMissionId: 'sc_01_mission_house',
    completedMissionIds: [],
    missionPhase: 'talk_to_mission_man',
    choices: {},
    campaignCompleted: false,
    endingUnlocked: false,
    teaserViewed: false,
    missionBaseline: null,
  };
}

export function createDefaultMiniGameRecords(): MiniGameRecords {
  return {
    fountainFlipsPlayed: 0,
    fountainFlipsWon: 0,
    fishCaught: 0,
    bestFishWeightKg: 0,
    racesCompleted: 0,
    bestRaceSec: 0,
    parkSprintsCompleted: 0,
    bestSprintSec: 0,
    deliveriesCompleted: 0,
    memoryGamesWon: 0,
    bestMemoryRound: 0,
  };
}

export function appearanceFromPreset(preset: CharacterPreset): CharacterAppearanceConfig {
  return {
    gender: preset.gender,
    skinTone: preset.skinColor,
    hairStyle: preset.hairStyle,
    hairColor: preset.hairColor,
    eyeStyle: preset.eyeStyle,
    eyeColor: preset.eyeColor,
    browStyle: preset.browStyle,
    facialDetail: preset.facialDetail,
    facialHair: preset.gender === 'male' ? preset.facialHair : 'none',
  };
}

function generatePlayerId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `cc_res_${Date.now().toString(36)}_${rand}`;
}

function createStarterPresets(): OutfitPreset[] {
  return [
    {
      id: 'preset_casual',
      name: 'Casual',
      equipped: createEmptyEquipped(),
      builtIn: true,
    },
  ];
}

export function createDefaultSave(overrideName?: string): SaveDataV1 {
  const defaultPreset = CHARACTER_PRESETS[0];
  const starterCar = createStarterOwnedVehicle();
  return {
    version: SAVE_SCHEMA_VERSION,
    saveVersion: 1,
    playerId: generatePlayerId(),
    playerName: overrideName ? sanitizeDisplayName(overrideName) : 'Kai',
    appearanceId: defaultPreset.id,
    appearanceConfig: appearanceFromPreset(defaultPreset),
    lastPosition: null,
    settings: {
      audio: {...DEFAULT_SETTINGS.audio},
      cameraZoom: DEFAULT_SETTINGS.cameraZoom,
      joystickSensitivity: DEFAULT_SETTINGS.joystickSensitivity,
      graphicsQuality: DEFAULT_SETTINGS.graphicsQuality,
      effectsQuality: DEFAULT_SETTINGS.effectsQuality,
      shadowsEnabled: DEFAULT_SETTINGS.shadowsEnabled,
      renderDistance: DEFAULT_SETTINGS.renderDistance,
      performanceMode: DEFAULT_SETTINGS.performanceMode,
      touchMode: DEFAULT_SETTINGS.touchMode,
      joystickSide: DEFAULT_SETTINGS.joystickSide,
      joystickOffsetX: DEFAULT_SETTINGS.joystickOffsetX,
      joystickOffsetY: DEFAULT_SETTINGS.joystickOffsetY,
      actionOffsetX: DEFAULT_SETTINGS.actionOffsetX,
      actionOffsetY: DEFAULT_SETTINGS.actionOffsetY,
      touchButtonScale: DEFAULT_SETTINGS.touchButtonScale,
      mouseInteractEnabled: DEFAULT_SETTINGS.mouseInteractEnabled,
      uiScale: DEFAULT_SETTINGS.uiScale,
      notificationsEnabled: DEFAULT_SETTINGS.notificationsEnabled,
      keybinds: {...DEFAULT_KEYBINDS},
    },
    coins: STARTING_COINS,
    energy: 100,
    inventory: [],
    equippedClothing: createEmptyEquipped(),
    hairOverride: {
      hairStyle: null,
      hairColor: null,
    },
    outfitPresets: createStarterPresets(),
    selectedOutfitPresetId: 'preset_casual',
    claimedRewards: [],
    transactions: [],
    arcadeHighScores: {},
    cinemaTicketActive: false,
    achievements: createDefaultAchievements(),
    missions: createDefaultMissions(),
    vehicles: [starterCar],
    activeVehicleId: starterCar.id,
    progression: createDefaultProgression(),
    story: createDefaultStory(),
    miniGameRecords: createDefaultMiniGameRecords(),
    loungeTokens: 50,
    collectedIds: [],
    ownedProperties: [],
    discoveredSecrets: [],
    collectibles: [],
    privacySettings: {...DEFAULT_PRIVACY_SETTINGS},
    joinedAtMs: Date.now(),
    friendCount: 0,
    cloudConfirmedAt: null,
    updatedAt: Date.now(),
  };
}

function validateKeybinds(raw: unknown): ControlKeybinds {
  if (!isRecord(raw)) return {...DEFAULT_KEYBINDS};
  const pick = (val: unknown, fallback: string) =>
    typeof val === 'string' && /^[a-zA-Z0-9]{1,24}$/.test(val.trim()) ? val.trim() : fallback;
  return {
    moveUp: pick(raw.moveUp, DEFAULT_KEYBINDS.moveUp),
    moveDown: pick(raw.moveDown, DEFAULT_KEYBINDS.moveDown),
    moveLeft: pick(raw.moveLeft, DEFAULT_KEYBINDS.moveLeft),
    moveRight: pick(raw.moveRight, DEFAULT_KEYBINDS.moveRight),
    run: pick(raw.run, DEFAULT_KEYBINDS.run),
    interact: pick(raw.interact, DEFAULT_KEYBINDS.interact),
    map: pick(raw.map, DEFAULT_KEYBINDS.map),
    phone: pick(raw.phone, DEFAULT_KEYBINDS.phone),
    emote: pick(raw.emote, DEFAULT_KEYBINDS.emote),
  };
}

function validatePrivacySettings(raw: unknown): PrivacySettings {
  if (!isRecord(raw)) return {...DEFAULT_PRIVACY_SETTINGS};
  const profileVisibility =
    raw.profileVisibility === 'public' ||
    raw.profileVisibility === 'friends' ||
    raw.profileVisibility === 'private'
      ? raw.profileVisibility
      : DEFAULT_PRIVACY_SETTINGS.profileVisibility;
  return {
    profileVisibility,
    allowMultiplayerInvites:
      typeof raw.allowMultiplayerInvites === 'boolean'
        ? raw.allowMultiplayerInvites
        : DEFAULT_PRIVACY_SETTINGS.allowMultiplayerInvites,
    allowPropertyVisitorsDefault:
      typeof raw.allowPropertyVisitorsDefault === 'boolean'
        ? raw.allowPropertyVisitorsDefault
        : DEFAULT_PRIVACY_SETTINGS.allowPropertyVisitorsDefault,
    showOnlineStatus:
      typeof raw.showOnlineStatus === 'boolean'
        ? raw.showOnlineStatus
        : DEFAULT_PRIVACY_SETTINGS.showOnlineStatus,
  };
}

function validateSettings(raw: unknown): GameSettings {
  const defaults = createDefaultSave().settings;
  if (!isRecord(raw)) return defaults;

  const audioRaw = isRecord(raw.audio) ? raw.audio : {};
  const masterVolume =
    typeof audioRaw.masterVolume === 'number' && Number.isFinite(audioRaw.masterVolume)
      ? clamp(audioRaw.masterVolume, 0, 1)
      : defaults.audio.masterVolume;
  const musicVolume =
    typeof audioRaw.musicVolume === 'number' && Number.isFinite(audioRaw.musicVolume)
      ? clamp(audioRaw.musicVolume, 0, 1)
      : defaults.audio.musicVolume;
  const sfxVolume =
    typeof audioRaw.sfxVolume === 'number' && Number.isFinite(audioRaw.sfxVolume)
      ? clamp(audioRaw.sfxVolume, 0, 1)
      : defaults.audio.sfxVolume;
  const muted = typeof audioRaw.muted === 'boolean' ? audioRaw.muted : defaults.audio.muted;

  const cameraZoom =
    typeof raw.cameraZoom === 'number' && Number.isFinite(raw.cameraZoom)
      ? clamp(raw.cameraZoom, CAMERA_MIN_ZOOM, CAMERA_MAX_ZOOM)
      : defaults.cameraZoom;

  const joystickSensitivity =
    typeof raw.joystickSensitivity === 'number' && Number.isFinite(raw.joystickSensitivity)
      ? clamp(raw.joystickSensitivity, 0.6, 1.8)
      : defaults.joystickSensitivity;

  const graphicsQuality: GraphicsQuality =
    raw.graphicsQuality === 'low' ||
    raw.graphicsQuality === 'medium' ||
    raw.graphicsQuality === 'high' ||
    raw.graphicsQuality === 'balanced'
      ? raw.graphicsQuality
      : defaults.graphicsQuality;

  const effectsQuality: EffectsQuality =
    raw.effectsQuality === 'low' ||
    raw.effectsQuality === 'medium' ||
    raw.effectsQuality === 'high'
      ? raw.effectsQuality
      : graphicsQuality === 'low'
        ? 'low'
        : defaults.effectsQuality;

  const shadowsEnabled =
    typeof raw.shadowsEnabled === 'boolean' ? raw.shadowsEnabled : defaults.shadowsEnabled;

  const renderDistance: RenderDistanceMode =
    raw.renderDistance === 'near' ||
    raw.renderDistance === 'medium' ||
    raw.renderDistance === 'far'
      ? raw.renderDistance
      : defaults.renderDistance;

  const performanceMode =
    typeof raw.performanceMode === 'boolean' ? raw.performanceMode : defaults.performanceMode;

  const touchMode =
    raw.touchMode === 'auto' || raw.touchMode === 'always' || raw.touchMode === 'off'
      ? raw.touchMode
      : defaults.touchMode;

  const joystickSide =
    raw.joystickSide === 'left' || raw.joystickSide === 'right'
      ? raw.joystickSide
      : defaults.joystickSide;

  const numClamp = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? clamp(Math.round(v * 100) / 100, min, max) : fallback;

  return {
    audio: {masterVolume, musicVolume, sfxVolume, muted},
    cameraZoom,
    joystickSensitivity,
    graphicsQuality,
    effectsQuality,
    shadowsEnabled,
    renderDistance,
    performanceMode,
    touchMode,
    joystickSide,
    joystickOffsetX: numClamp(raw.joystickOffsetX, -60, 60, defaults.joystickOffsetX),
    joystickOffsetY: numClamp(raw.joystickOffsetY, -60, 60, defaults.joystickOffsetY),
    actionOffsetX: numClamp(raw.actionOffsetX, -60, 60, defaults.actionOffsetX),
    actionOffsetY: numClamp(raw.actionOffsetY, -60, 60, defaults.actionOffsetY),
    touchButtonScale: numClamp(raw.touchButtonScale, 0.8, 1.35, defaults.touchButtonScale),
    mouseInteractEnabled:
      typeof raw.mouseInteractEnabled === 'boolean'
        ? raw.mouseInteractEnabled
        : defaults.mouseInteractEnabled,
    uiScale: numClamp(raw.uiScale, 0.85, 1.2, defaults.uiScale),
    notificationsEnabled:
      typeof raw.notificationsEnabled === 'boolean'
        ? raw.notificationsEnabled
        : defaults.notificationsEnabled,
    keybinds: validateKeybinds(raw.keybinds),
  };
}

function validatePosition(raw: unknown): SavedPosition | null {
  if (!isRecord(raw)) return null;
  if (
    typeof raw.x !== 'number' ||
    typeof raw.y !== 'number' ||
    !Number.isFinite(raw.x) ||
    !Number.isFinite(raw.y)
  ) {
    return null;
  }
  if (raw.x < 32 || raw.x > WORLD_WIDTH - 32 || raw.y < 32 || raw.y > WORLD_HEIGHT - 32) {
    return null;
  }
  const direction = VALID_DIRECTIONS.includes(raw.direction as Direction)
    ? (raw.direction as Direction)
    : 'down';
  return {x: raw.x, y: raw.y, direction};
}

function validateInventory(raw: unknown): InventoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const merged = new Map<string, InventoryEntry>();
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.itemId !== 'string') continue;
    const item = getShopItemById(entry.itemId);
    if (!item) continue;
    const qty =
      typeof entry.quantity === 'number' && Number.isFinite(entry.quantity)
        ? Math.floor(entry.quantity)
        : 0;
    if (qty <= 0) continue;
    const cappedQty = item.stackable ? Math.min(qty, 999) : 1;
    const acquiredAt =
      typeof entry.acquiredAt === 'number' && Number.isFinite(entry.acquiredAt)
        ? entry.acquiredAt
        : Date.now();
    const existing = merged.get(item.id);
    if (existing) {
      existing.quantity = item.stackable ? Math.min(existing.quantity + cappedQty, 999) : 1;
    } else {
      merged.set(item.id, {itemId: item.id, quantity: cappedQty, acquiredAt});
    }
  }
  return Array.from(merged.values());
}

function validateEquipped(raw: unknown, inventory: InventoryEntry[]): EquippedClothing {
  const result = createEmptyEquipped();
  if (!isRecord(raw)) return result;
  const ownedSet = new Set(inventory.map((i) => i.itemId));
  const slots: ClothingSlot[] = [
    'shirt',
    'jacket',
    'trousers',
    'shoes',
    'hat',
    'glasses',
    'accessory',
  ];
  for (const slot of slots) {
    const val = raw[slot];
    if (typeof val !== 'string' || !ownedSet.has(val)) continue;
    const item = getShopItemById(val);
    if (item?.clothing && item.clothing.slot === slot) {
      result[slot] = val;
    }
  }
  return result;
}

function validateHairOverride(raw: unknown): HairOverride {
  if (!isRecord(raw)) return {hairStyle: null, hairColor: null};
  const hairStyle = VALID_HAIR_STYLES.includes(raw.hairStyle as HairStyleId)
    ? (raw.hairStyle as HairStyleId)
    : null;
  const hairColor =
    typeof raw.hairColor === 'string' && HEX_COLOR_RE.test(raw.hairColor)
      ? raw.hairColor
      : null;
  return {hairStyle, hairColor};
}

export function validateAppearanceConfig(
  raw: unknown,
  preset: CharacterPreset,
  legacyHair?: HairOverride,
): CharacterAppearanceConfig {
  const base = appearanceFromPreset(preset);
  if (!isRecord(raw)) {
    // Hydrate cleanly from legacy Prompt 03 hairOverride if present
    return {
      ...base,
      hairStyle: legacyHair?.hairStyle ?? base.hairStyle,
      hairColor: legacyHair?.hairColor ?? base.hairColor,
    };
  }

  const gender: GenderType =
    raw.gender === 'male' || raw.gender === 'female' ? raw.gender : base.gender;

  const skinTone =
    typeof raw.skinTone === 'string' && HEX_COLOR_RE.test(raw.skinTone)
      ? raw.skinTone
      : SKIN_TONES.some((s) => s.hex === base.skinTone)
        ? base.skinTone
        : SKIN_TONES[1].hex;

  const hairStyle = VALID_HAIR_STYLES.includes(raw.hairStyle as HairStyleId)
    ? (raw.hairStyle as HairStyleId)
    : legacyHair?.hairStyle ?? base.hairStyle;

  const hairColor =
    typeof raw.hairColor === 'string' && HEX_COLOR_RE.test(raw.hairColor)
      ? raw.hairColor
      : legacyHair?.hairColor ?? base.hairColor;

  const eyeStyle = VALID_EYE_STYLES.includes(raw.eyeStyle as EyeStyleId)
    ? (raw.eyeStyle as EyeStyleId)
    : base.eyeStyle;

  const eyeColor =
    typeof raw.eyeColor === 'string' && HEX_COLOR_RE.test(raw.eyeColor)
      ? raw.eyeColor
      : EYE_COLORS[0].hex;

  const browStyle = VALID_BROW_STYLES.includes(raw.browStyle as BrowStyleId)
    ? (raw.browStyle as BrowStyleId)
    : base.browStyle;

  const facialDetail = VALID_FACIAL_DETAILS.includes(raw.facialDetail as FacialDetailId)
    ? (raw.facialDetail as FacialDetailId)
    : base.facialDetail;

  const rawFacialHair = VALID_FACIAL_HAIR.includes(raw.facialHair as FacialHairId)
    ? (raw.facialHair as FacialHairId)
    : base.facialHair;

  return {
    gender,
    skinTone,
    hairStyle,
    hairColor,
    eyeStyle,
    eyeColor,
    browStyle,
    facialDetail,
    facialHair: gender === 'male' ? rawFacialHair : 'none',
  };
}

function validateOutfitPresets(
  raw: unknown,
  inventory: InventoryEntry[],
): OutfitPreset[] {
  if (!Array.isArray(raw)) {
    return createStarterPresets();
  }
  const seen = new Set<string>();
  const out: OutfitPreset[] = [];
  for (const item of raw.slice(0, 12)) {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string') {
      continue;
    }
    const cleanId = item.id.trim().slice(0, 40);
    const cleanName = item.name.trim().slice(0, 24);
    if (!cleanId || !cleanName || seen.has(cleanId)) continue;
    seen.add(cleanId);
    out.push({
      id: cleanId,
      name: cleanName,
      equipped: validateEquipped(item.equipped, inventory),
      builtIn: item.builtIn === true,
    });
  }
  return out.length > 0 ? out : createStarterPresets();
}

function validateTransactions(raw: unknown): TransactionRecord[] {
  if (!Array.isArray(raw)) return [];
  const list: TransactionRecord[] = [];
  for (const t of raw.slice(0, 40)) {
    if (!isRecord(t)) continue;
    if (
      typeof t.id !== 'string' ||
      typeof t.label !== 'string' ||
      typeof t.amount !== 'number' ||
      !Number.isFinite(t.amount) ||
      typeof t.balanceAfter !== 'number' ||
      !Number.isFinite(t.balanceAfter)
    ) {
      continue;
    }
    list.push({
      id: t.id,
      label: t.label.slice(0, 60),
      amount: Math.round(t.amount),
      balanceAfter: Math.max(0, Math.round(t.balanceAfter)),
      timestamp:
        typeof t.timestamp === 'number' && Number.isFinite(t.timestamp)
          ? t.timestamp
          : Date.now(),
    });
  }
  return list;
}

function validateHighScores(raw: unknown): Record<string, number> {
  if (!isRecord(raw)) return {};
  const scores: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
      scores[key.slice(0, 40)] = Math.floor(val);
    }
  }
  return scores;
}

function validateAchievements(raw: unknown): AchievementProgress {
  if (!isRecord(raw)) return createDefaultAchievements();
  const unlockedIds = Array.isArray(raw.unlockedIds)
    ? Array.from(
        new Set(
          raw.unlockedIds
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .map((x) => x.trim().slice(0, 48)),
        ),
      ).slice(0, 50)
    : [];
  const stats: Record<string, number> = {};
  if (isRecord(raw.stats)) {
    for (const [k, v] of Object.entries(raw.stats).slice(0, 24)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
        stats[k.slice(0, 40)] = Math.floor(v);
      }
    }
  }
  return {unlockedIds, stats};
}

const VALID_VEHICLE_MODELS: VehicleModelId[] = [
  'sedan',
  'compact',
  'scooter',
  'coupe',
  'interceptor',
  'suv',
  'pickup',
  'van',
  'motorcycle',
  'bus',
  'taxi',
  'police',
];
const VALID_WHEELS: WheelStyle[] = ['stock', 'alloy_star', 'gold_rim', 'sport_tread'];
const VALID_SPOILERS: SpoilerStyle[] = ['none', 'street_lip', 'gt_wing'];
const VALID_DECALS: DecalStyle[] = ['none', 'racing_stripe', 'side_bolt', 'two_tone'];
const VALID_HEADLIGHTS: HeadlightStyle[] = ['warm', 'ice_blue', 'neon_gold', 'crimson'];

function validateVehicles(raw: unknown): OwnedVehicleRecord[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [createStarterOwnedVehicle()];
  }
  const seen = new Set<string>();
  const list: OwnedVehicleRecord[] = [];
  for (const item of raw.slice(0, 16)) {
    if (!isRecord(item) || typeof item.id !== 'string') continue;
    const cleanId = item.id.trim().slice(0, 48);
    if (!cleanId || seen.has(cleanId)) continue;
    seen.add(cleanId);

    const modelId: VehicleModelId = VALID_VEHICLE_MODELS.includes(item.modelId as VehicleModelId)
      ? (item.modelId as VehicleModelId)
      : 'sedan';
    const spec = getVehicleModelSpec(modelId);
    const name =
      typeof item.name === 'string' && item.name.trim().length > 0
        ? item.name.trim().slice(0, 32)
        : spec.name;

    const cRaw = isRecord(item.customization) ? item.customization : {};
    const customization: VehicleCustomization = {
      paintColor:
        typeof cRaw.paintColor === 'string' && HEX_COLOR_RE.test(cRaw.paintColor)
          ? cRaw.paintColor
          : spec.defaultCustomization.paintColor,
      secondaryColor:
        typeof cRaw.secondaryColor === 'string' && HEX_COLOR_RE.test(cRaw.secondaryColor)
          ? cRaw.secondaryColor
          : spec.defaultCustomization.secondaryColor,
      wheelStyle: VALID_WHEELS.includes(cRaw.wheelStyle as WheelStyle)
        ? (cRaw.wheelStyle as WheelStyle)
        : spec.defaultCustomization.wheelStyle,
      spoilerStyle: VALID_SPOILERS.includes(cRaw.spoilerStyle as SpoilerStyle)
        ? (cRaw.spoilerStyle as SpoilerStyle)
        : spec.defaultCustomization.spoilerStyle,
      decalStyle: VALID_DECALS.includes(cRaw.decalStyle as DecalStyle)
        ? (cRaw.decalStyle as DecalStyle)
        : spec.defaultCustomization.decalStyle,
      headlightStyle: VALID_HEADLIGHTS.includes(cRaw.headlightStyle as HeadlightStyle)
        ? (cRaw.headlightStyle as HeadlightStyle)
        : spec.defaultCustomization.headlightStyle,
    };

    const uRaw = isRecord(item.upgrades) ? item.upgrades : {};
    const clampTier = (v: unknown, def: number) =>
      typeof v === 'number' && Number.isFinite(v) ? clamp(Math.floor(v), 1, 5) : def;
    const upgrades: VehicleUpgrades = {
      engine: clampTier(uRaw.engine, spec.defaultUpgrades.engine),
      acceleration: clampTier(uRaw.acceleration, spec.defaultUpgrades.acceleration),
      handling: clampTier(uRaw.handling, spec.defaultUpgrades.handling),
      braking: clampTier(uRaw.braking, spec.defaultUpgrades.braking),
    };

    const condition =
      typeof item.condition === 'number' && Number.isFinite(item.condition)
        ? clamp(Math.round(item.condition), 0, 100)
        : 100;

    list.push({
      id: cleanId,
      modelId,
      name,
      purchasedAt:
        typeof item.purchasedAt === 'number' && Number.isFinite(item.purchasedAt)
          ? item.purchasedAt
          : Date.now(),
      condition,
      customization,
      upgrades,
    });
  }
  return list.length > 0 ? list : [createStarterOwnedVehicle()];
}

function validateMissions(raw: unknown): MissionProgress {
  if (!isRecord(raw)) return createDefaultMissions();
  const visitedDistricts = Array.isArray(raw.visitedDistricts)
    ? Array.from(
        new Set(
          raw.visitedDistricts
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .map((x) => x.trim().slice(0, 40)),
        ),
      ).slice(0, 16)
    : [];
  const visitedBuildings = Array.isArray(raw.visitedBuildings)
    ? Array.from(
        new Set(
          raw.visitedBuildings
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .map((x) => x.trim().slice(0, 48)),
        ),
      ).slice(0, 80)
    : [];
  const completedIds = Array.isArray(raw.completedIds)
    ? Array.from(
        new Set(
          raw.completedIds
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .map((x) => x.trim().slice(0, 48)),
        ),
      ).slice(0, 50)
    : [];
  const metNpcs = Array.isArray(raw.metNpcs)
    ? Array.from(
        new Set(
          raw.metNpcs
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .map((x) => x.trim().slice(0, 40)),
        ),
      ).slice(0, 30)
    : [];
  const itemsPurchased =
    typeof raw.itemsPurchased === 'number' && Number.isFinite(raw.itemsPurchased)
      ? Math.max(0, Math.floor(raw.itemsPurchased))
      : 0;
  const activitiesCompleted =
    typeof raw.activitiesCompleted === 'number' && Number.isFinite(raw.activitiesCompleted)
      ? Math.max(0, Math.floor(raw.activitiesCompleted))
      : 0;
  const activeMissionId =
    typeof raw.activeMissionId === 'string' && raw.activeMissionId.trim().length > 0
      ? raw.activeMissionId.trim().slice(0, 48)
      : raw.activeMissionId === null
        ? null
        : 'm_districts_5';
  const acceptedIds = Array.isArray(raw.acceptedIds)
    ? Array.from(
        new Set(
          raw.acceptedIds
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .map((x) => x.trim().slice(0, 48)),
        ),
      ).slice(0, 50)
    : Array.from(new Set(['m_districts_5', ...(activeMissionId ? [activeMissionId] : []), ...completedIds])).slice(0, 50);
  return {
    visitedDistricts,
    visitedBuildings,
    completedIds,
    itemsPurchased,
    activitiesCompleted,
    metNpcs,
    garageCustomized: raw.garageCustomized === true,
    vehicleSpawned: raw.vehicleSpawned === true,
    activeMissionId,
    acceptedIds,
  };
}

function validateCountMap(raw: unknown): Record<string, number> {
  if (!isRecord(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw).slice(0, 20)) {
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      out[k.slice(0, 32)] = Math.min(10000, Math.floor(v));
    }
  }
  return out;
}

function validateProgression(raw: unknown): ProgressionState {
  const def = createDefaultProgression();
  if (!isRecord(raw)) return def;
  const xp =
    typeof raw.xp === 'number' && Number.isFinite(raw.xp) && raw.xp >= 0
      ? Math.min(100_000, Math.floor(raw.xp))
      : 0;
  const level = getLevelForXp(xp);
  const unlockedTitles = Array.isArray(raw.unlockedTitles)
    ? Array.from(
        new Set([
          'New Arrival',
          ...raw.unlockedTitles
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .map((x) => x.trim().slice(0, 32)),
        ]),
      ).slice(0, 20)
    : ['New Arrival'];
  const unlockedBadges = Array.isArray(raw.unlockedBadges)
    ? Array.from(
        new Set([
          'badge_citizen',
          ...raw.unlockedBadges
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .map((x) => x.trim().slice(0, 32)),
        ]),
      ).slice(0, 24)
    : ['badge_citizen'];
  const selectedTitle =
    typeof raw.selectedTitle === 'string' && unlockedTitles.includes(raw.selectedTitle)
      ? raw.selectedTitle
      : unlockedTitles[0];

  const todayKey = getDailyResetKey();
  const weekKey = getWeeklyResetKey();
  const rawDailyKey = typeof raw.dailyResetKey === 'string' ? raw.dailyResetKey.slice(0, 16) : '';
  const rawWeeklyKey = typeof raw.weeklyResetKey === 'string' ? raw.weeklyResetKey.slice(0, 16) : '';

  return {
    xp,
    level,
    selectedTitle,
    unlockedTitles,
    unlockedBadges,
    dailyResetKey: todayKey,
    weeklyResetKey: weekKey,
    dailyCounts: rawDailyKey === todayKey ? validateCountMap(raw.dailyCounts) : {},
    weeklyCounts: rawWeeklyKey === weekKey ? validateCountMap(raw.weeklyCounts) : {},
  };
}

const VALID_STORY_PHASES: StoryCampaignPhase[] = [
  'not_started',
  'talk_to_mission_man',
  'objective_active',
  'return_to_mission_man',
  'campaign_complete',
];

function validateMissionBaseline(raw: unknown): StoryMissionBaseline | null {
  if (!isRecord(raw)) return null;
  const n = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(100_000, Math.floor(v)) : 0;
  return {
    districts: n(raw.districts),
    buildings: n(raw.buildings),
    itemsPurchased: n(raw.itemsPurchased),
    activitiesCompleted: n(raw.activitiesCompleted),
    deliveriesCompleted: n(raw.deliveriesCompleted),
    racesCompleted: n(raw.racesCompleted),
    shardsCollected: n(raw.shardsCollected),
    secretsDiscovered: n(raw.secretsDiscovered),
  };
}

function validateStory(raw: unknown): StoryProgressState {
  const def = createDefaultStory();
  if (!isRecord(raw)) return def;
  const completedChapters = Array.isArray(raw.completedChapters)
    ? Array.from(
        new Set(
          raw.completedChapters
            .filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5),
        ),
      ).sort((a, b) => a - b)
    : [];
  const currentChapter =
    typeof raw.currentChapter === 'number' && Number.isInteger(raw.currentChapter)
      ? clamp(raw.currentChapter, 1, 6)
      : Math.min(6, completedChapters.length + 1);
  const watchedCutscenes = Array.isArray(raw.watchedCutscenes)
    ? Array.from(
        new Set(
          raw.watchedCutscenes
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .map((x) => x.trim().slice(0, 48)),
        ),
      ).slice(0, 30)
    : [];
  const completedMissionIds = Array.isArray(raw.completedMissionIds)
    ? Array.from(
        new Set(
          raw.completedMissionIds
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .map((x) => x.trim().slice(0, 48)),
        ),
      ).slice(0, 20)
    : [];
  const campaignCompleted = raw.campaignCompleted === true || completedMissionIds.includes('sc_07_lead_ascension');
  const currentMissionId =
    raw.currentMissionId === null
      ? null
      : typeof raw.currentMissionId === 'string' && raw.currentMissionId.trim().length > 0
        ? raw.currentMissionId.trim().slice(0, 48)
        : campaignCompleted
          ? null
          : def.currentMissionId;
  const missionPhase: StoryCampaignPhase = VALID_STORY_PHASES.includes(
    raw.missionPhase as StoryCampaignPhase,
  )
    ? (raw.missionPhase as StoryCampaignPhase)
    : campaignCompleted
      ? 'campaign_complete'
      : 'talk_to_mission_man';
  const choices: Record<string, string> = {};
  if (isRecord(raw.choices)) {
    for (const [k, v] of Object.entries(raw.choices).slice(0, 12)) {
      if (typeof v === 'string' && v.trim().length > 0) {
        choices[k.trim().slice(0, 40)] = v.trim().slice(0, 40);
      }
    }
  }
  return {
    started: raw.started === true || completedChapters.length > 0 || completedMissionIds.length > 0,
    currentChapter,
    completedChapters,
    watchedCutscenes,
    currentMissionId,
    completedMissionIds,
    missionPhase,
    choices,
    campaignCompleted,
    endingUnlocked: raw.endingUnlocked === true || campaignCompleted,
    teaserViewed: raw.teaserViewed === true,
    missionBaseline: validateMissionBaseline(raw.missionBaseline),
  };
}

function validateMiniGameRecords(raw: unknown): MiniGameRecords {
  const def = createDefaultMiniGameRecords();
  if (!isRecord(raw)) return def;
  const intField = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(100_000, Math.floor(v)) : 0;
  const floatField = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(9999, Math.round(v * 100) / 100) : 0;

  return {
    fountainFlipsPlayed: intField(raw.fountainFlipsPlayed),
    fountainFlipsWon: intField(raw.fountainFlipsWon),
    fishCaught: intField(raw.fishCaught),
    bestFishWeightKg: floatField(raw.bestFishWeightKg),
    racesCompleted: intField(raw.racesCompleted),
    bestRaceSec: floatField(raw.bestRaceSec),
    parkSprintsCompleted: intField(raw.parkSprintsCompleted),
    bestSprintSec: floatField(raw.bestSprintSec),
    deliveriesCompleted: intField(raw.deliveriesCompleted),
    memoryGamesWon: intField(raw.memoryGamesWon),
    bestMemoryRound: intField(raw.bestMemoryRound),
  };
}

export function validateSaveRecord(
  parsed: unknown,
  fallbackName?: string,
): SaveDataV1 | null {
  if (!isRecord(parsed)) return null;
  const ver = typeof parsed.version === 'number' ? parsed.version : parsed.schemaVersion;
  if (ver !== SAVE_SCHEMA_VERSION) return null;

  const fallback = createDefaultSave(fallbackName);

  const validPresetId = CHARACTER_PRESETS.some((p) => p.id === parsed.appearanceId)
    ? (parsed.appearanceId as string)
    : fallback.appearanceId;
  const presetObj =
    CHARACTER_PRESETS.find((p) => p.id === validPresetId) ?? CHARACTER_PRESETS[0];

  const playerId =
    typeof parsed.playerId === 'string' && parsed.playerId.trim().length >= 3
      ? parsed.playerId.trim().slice(0, 64)
      : fallback.playerId;

  const playerName =
    typeof parsed.playerName === 'string'
      ? sanitizeDisplayName(parsed.playerName)
      : fallback.playerName;

  const coins =
    typeof parsed.coins === 'number' && Number.isFinite(parsed.coins) && parsed.coins >= 0
      ? Math.min(1_000_000, Math.floor(parsed.coins))
      : fallback.coins;

  const energy =
    typeof parsed.energy === 'number' && Number.isFinite(parsed.energy)
      ? clamp(Math.round(parsed.energy), 0, 100)
      : fallback.energy;

  const saveVersion =
    typeof parsed.saveVersion === 'number' &&
    Number.isFinite(parsed.saveVersion) &&
    parsed.saveVersion >= 1
      ? Math.floor(parsed.saveVersion)
      : 1;

  const inventory = validateInventory(parsed.inventory);
  const equippedClothing = validateEquipped(parsed.equippedClothing, inventory);
  const hairOverride = validateHairOverride(parsed.hairOverride);
  const appearanceConfig = validateAppearanceConfig(
    parsed.appearanceConfig,
    presetObj,
    hairOverride,
  );
  const outfitPresets = validateOutfitPresets(parsed.outfitPresets, inventory);
  const selectedOutfitPresetId =
    typeof parsed.selectedOutfitPresetId === 'string' &&
    outfitPresets.some((p) => p.id === parsed.selectedOutfitPresetId)
      ? parsed.selectedOutfitPresetId
      : null;

  const claimedRewards = Array.isArray(parsed.claimedRewards)
    ? Array.from(
        new Set(
          parsed.claimedRewards
            .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
            .map((r) => r.trim().slice(0, 80)),
        ),
      ).slice(0, 200)
    : [];
  const transactions = validateTransactions(parsed.transactions);
  const arcadeHighScores = validateHighScores(parsed.arcadeHighScores);
  const cinemaTicketActive =
    typeof parsed.cinemaTicketActive === 'boolean'
      ? parsed.cinemaTicketActive
      : inventory.some((i) => i.itemId === 'cin_ticket');

  const achievements = validateAchievements(parsed.achievements);
  const missions = validateMissions(parsed.missions);
  const progression = validateProgression(parsed.progression);
  const story = validateStory(parsed.story);
  const miniGameRecords = validateMiniGameRecords(parsed.miniGameRecords);
  const vehicles = validateVehicles(parsed.vehicles);
  const activeVehicleId =
    typeof parsed.activeVehicleId === 'string' &&
    vehicles.some((v) => v.id === parsed.activeVehicleId)
      ? parsed.activeVehicleId
      : vehicles[0]?.id ?? null;

  const updatedAt =
    typeof parsed.clientUpdatedAt === 'number' && Number.isFinite(parsed.clientUpdatedAt)
      ? parsed.clientUpdatedAt
      : typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
        ? parsed.updatedAt
        : Date.now();

  const cloudConfirmedAt =
    typeof parsed.cloudConfirmedAt === 'number' && Number.isFinite(parsed.cloudConfirmedAt)
      ? parsed.cloudConfirmedAt
      : null;

  const loungeTokens =
    typeof parsed.loungeTokens === 'number' && Number.isFinite(parsed.loungeTokens) && parsed.loungeTokens >= 0
      ? Math.min(100_000, Math.floor(parsed.loungeTokens))
      : 50;

  const collectedIds = Array.isArray(parsed.collectedIds)
    ? Array.from(
        new Set(
          parsed.collectedIds
            .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
            .map((c) => c.trim().slice(0, 48)),
        ),
      ).slice(0, 60)
    : [];

  const ownedProperties = Array.isArray(parsed.ownedProperties)
    ? Array.from(
        new Set(
          parsed.ownedProperties
            .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
            .map((p) => p.trim().slice(0, 48)),
        ),
      ).slice(0, 16)
    : [];

  const discoveredSecrets = Array.isArray(parsed.discoveredSecrets)
    ? Array.from(
        new Set(
          parsed.discoveredSecrets
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .map((s) => s.trim().slice(0, 48)),
        ),
      ).slice(0, 40)
    : [];

  const collectibles = Array.isArray(parsed.collectibles)
    ? Array.from(
        new Set(
          parsed.collectibles
            .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
            .map((c) => c.trim().slice(0, 48)),
        ),
      ).slice(0, 80)
    : [];

  const privacySettings = validatePrivacySettings(parsed.privacySettings);
  const joinedAtMs =
    typeof parsed.joinedAtMs === 'number' && Number.isFinite(parsed.joinedAtMs) && parsed.joinedAtMs > 0
      ? Math.floor(parsed.joinedAtMs)
      : Date.now();
  const friendCount =
    typeof parsed.friendCount === 'number' && Number.isFinite(parsed.friendCount) && parsed.friendCount >= 0
      ? Math.min(500, Math.floor(parsed.friendCount))
      : 0;

  return {
    version: SAVE_SCHEMA_VERSION,
    saveVersion,
    playerId,
    playerName,
    appearanceId: validPresetId,
    appearanceConfig,
    lastPosition: validatePosition(parsed.lastPosition),
    settings: validateSettings(parsed.settings),
    coins,
    energy,
    inventory,
    equippedClothing,
    hairOverride,
    outfitPresets,
    selectedOutfitPresetId,
    claimedRewards,
    transactions,
    arcadeHighScores,
    cinemaTicketActive,
    achievements,
    missions,
    vehicles,
    activeVehicleId,
    progression,
    story,
    miniGameRecords,
    loungeTokens,
    collectedIds,
    ownedProperties,
    discoveredSecrets,
    collectibles,
    privacySettings,
    joinedAtMs,
    friendCount,
    cloudConfirmedAt,
    updatedAt,
  };
}

export class SaveSystem implements ISaveStorageAdapter {
  private current: SaveDataV1;
  private activeUid: string | null = null;
  private mutationListeners = new Set<(data: SaveDataV1, immediate: boolean) => void>();

  constructor() {
    this.current = this.load();
  }

  private getStorageKey(uid: string | null = this.activeUid): string {
    return uid ? `${SAVE_STORAGE_KEY}__uid_${uid}` : SAVE_STORAGE_KEY;
  }

  public getActiveAccountUid(): string | null {
    return this.activeUid;
  }

  public setActiveAccountUid(uid: string | null): SaveDataV1 {
    this.activeUid = uid;
    this.current = this.load();
    return this.current;
  }

  public onSaveMutated(listener: (data: SaveDataV1, immediate: boolean) => void): () => void {
    this.mutationListeners.add(listener);
    return () => {
      this.mutationListeners.delete(listener);
    };
  }

  private emitMutation(immediate: boolean): void {
    for (const listener of this.mutationListeners) {
      listener(this.current, immediate);
    }
  }

  public getState(): SaveDataV1 {
    return this.current;
  }

  public readAccountBackup(uid: string): SaveDataV1 | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null;
      const rawStr = window.localStorage.getItem(this.getStorageKey(uid));
      if (!rawStr) return null;
      const parsed: unknown = JSON.parse(rawStr);
      return validateSaveRecord(parsed);
    } catch {
      return null;
    }
  }

  public load(): SaveDataV1 {
    const fallback = createDefaultSave();
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return fallback;
      }
      const rawStr = window.localStorage.getItem(this.getStorageKey(this.activeUid));
      if (!rawStr) return fallback;
      const parsed: unknown = JSON.parse(rawStr);
      const validated = validateSaveRecord(parsed);
      if (!validated) return fallback;
      this.current = validated;
      return validated;
    } catch {
      return fallback;
    }
  }

  private writeLocalRaw(uid: string | null, data: SaveDataV1): boolean {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      window.localStorage.setItem(this.getStorageKey(uid), JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  public save(data: SaveDataV1, immediateSync = true): boolean {
    const nextVersion = Math.max((this.current?.saveVersion ?? 1) + 1, data.saveVersion ?? 1);
    this.current = {
      ...data,
      saveVersion: nextVersion,
      updatedAt: Date.now(),
    };
    const ok = this.writeLocalRaw(this.activeUid, this.current);
    this.emitMutation(immediateSync);
    return ok;
  }

  public applyCloudLoadedSave(
    cloudData: SaveDataV1,
    uid: string,
    markConfirmed = true,
  ): SaveDataV1 {
    this.activeUid = uid;
    this.current = {
      ...cloudData,
      cloudConfirmedAt: markConfirmed
        ? (cloudData.cloudConfirmedAt ?? Date.now())
        : cloudData.cloudConfirmedAt,
    };
    this.writeLocalRaw(uid, this.current);
    return this.current;
  }

  public markCloudConfirmed(
    saveVersion: number,
    confirmedAtMs: number,
    effectiveVersion?: number,
  ): void {
    const syncedVersion =
      effectiveVersion !== undefined
        ? Math.max(saveVersion, Math.floor(effectiveVersion))
        : saveVersion;

    if (this.current.saveVersion === saveVersion) {
      this.current = {
        ...this.current,
        saveVersion: Math.max(this.current.saveVersion, syncedVersion),
        cloudConfirmedAt: confirmedAtMs,
      };
      this.writeLocalRaw(this.activeUid, this.current);
      return;
    }

    if (this.current.saveVersion > saveVersion && syncedVersion >= this.current.saveVersion) {
      // A newer local edit occurred while the transaction was in flight; ensure the next flush outranks syncedVersion.
      this.current = {
        ...this.current,
        saveVersion: syncedVersion + 1,
      };
      this.writeLocalRaw(this.activeUid, this.current);
    }
  }

  public updateAppearance(appearanceId: string, playerName?: string): SaveDataV1 {
    const valid = CHARACTER_PRESETS.some((p) => p.id === appearanceId)
      ? appearanceId
      : this.current.appearanceId;
    const presetObj = CHARACTER_PRESETS.find((p) => p.id === valid) ?? CHARACTER_PRESETS[0];
    const next: SaveDataV1 = {
      ...this.current,
      appearanceId: valid,
      appearanceConfig: appearanceFromPreset(presetObj),
      hairOverride: {hairStyle: null, hairColor: null},
      playerName:
        playerName !== undefined ? sanitizeDisplayName(playerName) : this.current.playerName,
    };
    this.save(next, true);
    return next;
  }

  public updateAppearanceConfig(
    appearanceId: string,
    playerName: string,
    config: CharacterAppearanceConfig,
    equippedClothing?: EquippedClothing,
    selectedOutfitPresetId?: string | null,
  ): SaveDataV1 {
    const validId = CHARACTER_PRESETS.some((p) => p.id === appearanceId)
      ? appearanceId
      : this.current.appearanceId;
    const presetObj = CHARACTER_PRESETS.find((p) => p.id === validId) ?? CHARACTER_PRESETS[0];
    const cleanConfig = validateAppearanceConfig(config, presetObj);
    const cleanEquipped = equippedClothing
      ? validateEquipped(equippedClothing, this.current.inventory)
      : this.current.equippedClothing;

    const next: SaveDataV1 = {
      ...this.current,
      appearanceId: validId,
      playerName: sanitizeDisplayName(playerName),
      appearanceConfig: cleanConfig,
      hairOverride: {
        hairStyle: cleanConfig.hairStyle,
        hairColor: cleanConfig.hairColor,
      },
      equippedClothing: cleanEquipped,
      selectedOutfitPresetId:
        selectedOutfitPresetId !== undefined
          ? selectedOutfitPresetId
          : this.current.selectedOutfitPresetId,
    };
    this.save(next, true);
    return next;
  }

  public resetAppearanceToPreset(appearanceId?: string): SaveDataV1 {
    const targetId = appearanceId ?? this.current.appearanceId;
    const presetObj = CHARACTER_PRESETS.find((p) => p.id === targetId) ?? CHARACTER_PRESETS[0];
    const next: SaveDataV1 = {
      ...this.current,
      appearanceId: presetObj.id,
      playerName: presetObj.name,
      appearanceConfig: appearanceFromPreset(presetObj),
      hairOverride: {hairStyle: null, hairColor: null},
      equippedClothing: createEmptyEquipped(),
      selectedOutfitPresetId:
        this.current.outfitPresets.find((p) => p.id === 'preset_casual')?.id ?? null,
    };
    this.save(next, true);
    return next;
  }

  public saveOutfitPresets(
    presets: OutfitPreset[],
    selectedId: string | null,
  ): SaveDataV1 {
    const cleanPresets = validateOutfitPresets(presets, this.current.inventory);
    const validSelected =
      selectedId && cleanPresets.some((p) => p.id === selectedId) ? selectedId : null;
    const next: SaveDataV1 = {
      ...this.current,
      outfitPresets: cleanPresets,
      selectedOutfitPresetId: validSelected,
    };
    this.save(next, true);
    return next;
  }

  public updateSettings(partial: Partial<GameSettings>): SaveDataV1 {
    const merged: GameSettings = {
      ...this.current.settings,
      ...partial,
      audio: {
        ...this.current.settings.audio,
        ...(partial.audio ?? {}),
      },
      keybinds: {
        ...this.current.settings.keybinds,
        ...(partial.keybinds ?? {}),
      },
    };
    const next: SaveDataV1 = {
      ...this.current,
      settings: validateSettings(merged),
    };
    this.save(next, false);
    return next;
  }

  public updatePrivacySettings(partial: Partial<PrivacySettings>): SaveDataV1 {
    const merged = validatePrivacySettings({
      ...this.current.privacySettings,
      ...partial,
    });
    const next: SaveDataV1 = {
      ...this.current,
      privacySettings: merged,
    };
    this.save(next, true);
    return next;
  }

  public setFriendCount(count: number): SaveDataV1 {
    const clean = clamp(Math.floor(count), 0, 500);
    if (clean === this.current.friendCount) return this.current;
    const next: SaveDataV1 = {
      ...this.current,
      friendCount: clean,
    };
    this.save(next, false);
    return next;
  }

  public updatePosition(pos: SavedPosition | null, immediate = false): SaveDataV1 {
    const validatedPos = pos ? validatePosition(pos) : null;
    const curPos = this.current.lastPosition;
    if (
      validatedPos &&
      curPos &&
      curPos.x === validatedPos.x &&
      curPos.y === validatedPos.y &&
      curPos.direction === validatedPos.direction
    ) {
      return this.current;
    }
    const next: SaveDataV1 = {
      ...this.current,
      lastPosition: validatedPos,
    };
    this.save(next, immediate);
    return next;
  }

  public resetForNewGame(overrideName?: string): SaveDataV1 {
    const fresh = createDefaultSave(overrideName ?? this.current.playerName);
    fresh.settings = {...this.current.settings};
    fresh.saveVersion = (this.current.saveVersion ?? 1) + 1;
    fresh.playerId = this.current.playerId;
    this.save(fresh, true);
    return fresh;
  }

  public reset(): SaveDataV1 {
    const fresh = createDefaultSave();
    fresh.saveVersion = (this.current.saveVersion ?? 1) + 1;
    this.save(fresh, true);
    return fresh;
  }
}

export const saveSystem = new SaveSystem();

