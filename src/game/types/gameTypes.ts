export type Direction = 'down' | 'up' | 'left' | 'right';

export type AnimationState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'sit'
  | 'sleep'
  | 'driving'
  | 'interact'
  | 'shop'
  | 'celebrate';

export type GenderType = 'male' | 'female';

export type GraphicsQuality = 'low' | 'medium' | 'high' | 'balanced';

export type EffectsQuality = 'low' | 'medium' | 'high';

export type RenderDistanceMode = 'near' | 'medium' | 'far';

export type TouchMode = 'auto' | 'always' | 'off';

export type DistrictId =
  | 'downtown'
  | 'central_park'
  | 'shopping'
  | 'residential'
  | 'entertainment'
  | 'luxury'
  | 'airport'
  | 'industrial'
  | 'beach'
  | 'countryside'
  | 'highway';

export type HairStyleId =
  | 'short'
  | 'bob'
  | 'spiky'
  | 'cap'
  | 'pompadour'
  | 'curly'
  | 'sidepart'
  | 'buzz'
  | 'long_waves'
  | 'ponytail'
  | 'space_buns';

export type EyeStyleId = 'classic' | 'wide' | 'sharp' | 'lashes';

export type BrowStyleId = 'natural' | 'thick' | 'arched' | 'soft';

export type FacialDetailId = 'none' | 'freckles' | 'blush' | 'beauty_mark';

export type FacialHairId = 'none' | 'stubble' | 'goatee' | 'beard';

export interface CharacterAppearanceConfig {
  gender: GenderType;
  skinTone: string;
  hairStyle: HairStyleId;
  hairColor: string;
  eyeStyle: EyeStyleId;
  eyeColor: string;
  browStyle: BrowStyleId;
  facialDetail: FacialDetailId;
  facialHair: FacialHairId;
}

export interface CharacterPreset {
  id: string;
  name: string;
  gender: GenderType;
  tagline: string;
  skinColor: string;
  hairColor: string;
  hairStyle: HairStyleId;
  eyeStyle: EyeStyleId;
  eyeColor: string;
  browStyle: BrowStyleId;
  facialDetail: FacialDetailId;
  facialHair: FacialHairId;
  shirtColor: string;
  shirtAccent: string;
  pantsColor: string;
  shoeColor: string;
}

export type ClothingCategory =
  | 'shirts'
  | 'tshirts'
  | 'hoodies'
  | 'jackets'
  | 'sweaters'
  | 'trousers'
  | 'shorts'
  | 'skirts'
  | 'shoes'
  | 'hats'
  | 'glasses'
  | 'accessories';

export type ClothingSlot =
  | 'shirt'
  | 'jacket'
  | 'trousers'
  | 'shoes'
  | 'hat'
  | 'glasses'
  | 'accessory';

export interface EquippedClothing {
  shirt: string | null;
  jacket: string | null;
  trousers: string | null;
  shoes: string | null;
  hat: string | null;
  glasses: string | null;
  accessory: string | null;
}

export interface OutfitPreset {
  id: string;
  name: string;
  equipped: EquippedClothing;
  builtIn?: boolean;
}

export interface HairOverride {
  hairStyle: HairStyleId | null;
  hairColor: string | null;
}

export interface CharacterIdentitySnapshot {
  playerId: string;
  displayName: string;
  characterType: GenderType;
  appearanceId: string;
  appearance: CharacterAppearanceConfig;
  equippedOutfit: EquippedClothing;
  ownedCosmetics: string[];
  currentAnimationState: AnimationState;
}

export type ShopDomain =
  | 'clothing'
  | 'cafe'
  | 'restaurant'
  | 'supermarket'
  | 'electronics'
  | 'bookstore'
  | 'petshop'
  | 'arcade_prizes'
  | 'cinema_concessions'
  | 'clinic'
  | 'gym_bar'
  | 'mall'
  | 'music'
  | 'airport_dutyfree'
  | 'farm_market'
  | 'lounge_prizes';

export type ShopItemKind = 'clothing' | 'consumable' | 'ticket' | 'collectible' | 'pet';

export interface ClothingVisualSpec {
  category: ClothingCategory;
  slot: ClothingSlot;
  primaryColor: string;
  accentColor: string;
  variant: string;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  shop: ShopDomain;
  subCategory: string;
  kind: ShopItemKind;
  stackable: boolean;
  iconColor: string;
  iconGlyph: string;
  energyRestore?: number;
  speedBoostSec?: number;
  clothing?: ClothingVisualSpec;
  unlockOnly?: boolean;
}

export interface InventoryEntry {
  itemId: string;
  quantity: number;
  acquiredAt: number;
}

export interface TransactionRecord {
  id: string;
  label: string;
  amount: number; // negative = spend, positive = earn
  balanceAfter: number;
  timestamp: number;
}

export interface AudioSettings {
  masterVolume: number; // 0..1
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  muted: boolean;
}

export interface ControlKeybinds {
  moveUp: string;
  moveDown: string;
  moveLeft: string;
  moveRight: string;
  run: string;
  interact: string;
  map: string;
  phone: string;
  emote: string;
}

export interface GameSettings {
  audio: AudioSettings;
  cameraZoom: number; // 1.0..2.0
  joystickSensitivity: number; // 0.6..1.8
  graphicsQuality: GraphicsQuality;
  effectsQuality: EffectsQuality;
  shadowsEnabled: boolean;
  renderDistance: RenderDistanceMode;
  performanceMode: boolean;
  touchMode: TouchMode;
  joystickSide: 'left' | 'right';
  joystickOffsetX: number; // -60..60
  joystickOffsetY: number; // -60..60
  actionOffsetX: number; // -60..60
  actionOffsetY: number; // -60..60
  touchButtonScale: number; // 0.8..1.35
  mouseInteractEnabled: boolean;
  uiScale: number; // 0.85..1.2
  notificationsEnabled: boolean;
  keybinds: ControlKeybinds;
}

export type KeybindConfig = ControlKeybinds;

export type ProfileVisibility = 'public' | 'friends' | 'private';

export interface PrivacySettings {
  profileVisibility: ProfileVisibility;
  allowMultiplayerInvites: boolean;
  allowPropertyVisitorsDefault: boolean;
  showOnlineStatus: boolean;
}

export interface SavedPosition {
  x: number;
  y: number;
  direction: Direction;
}

export interface AchievementProgress {
  unlockedIds: string[];
  stats: Record<string, number>;
}

export interface MissionProgress {
  visitedDistricts: string[];
  visitedBuildings: string[];
  completedIds: string[];
  itemsPurchased: number;
  activitiesCompleted: number;
  metNpcs: string[];
  garageCustomized: boolean;
  vehicleSpawned: boolean;
  activeMissionId?: string | null;
  acceptedIds?: string[];
}

export type MissionCategory =
  | 'story'
  | 'side'
  | 'daily'
  | 'weekly'
  | 'npc'
  | 'delivery'
  | 'driving'
  | 'exploration'
  | 'minigame';

export interface ProgressionState {
  xp: number;
  level: number;
  selectedTitle: string;
  unlockedTitles: string[];
  unlockedBadges: string[];
  dailyResetKey: string;
  weeklyResetKey: string;
  dailyCounts: Record<string, number>;
  weeklyCounts: Record<string, number>;
}

export type GameMode = 'story' | 'multiplayer';

export type ServerVisibility = 'public' | 'invite_only';

export type StoryCampaignPhase =
  | 'not_started'
  | 'talk_to_mission_man'
  | 'objective_active'
  | 'return_to_mission_man'
  | 'campaign_complete';

export interface StoryMissionBaseline {
  districts: number;
  buildings: number;
  itemsPurchased: number;
  activitiesCompleted: number;
  deliveriesCompleted: number;
  racesCompleted: number;
  shardsCollected: number;
  secretsDiscovered: number;
}

export interface StoryProgressState {
  started: boolean;
  currentChapter: number; // 1..5, or 6 when all completed
  completedChapters: number[];
  watchedCutscenes: string[];
  currentMissionId: string | null;
  completedMissionIds: string[];
  missionPhase: StoryCampaignPhase;
  choices: Record<string, string>;
  campaignCompleted: boolean;
  endingUnlocked: boolean;
  teaserViewed: boolean;
  missionBaseline: StoryMissionBaseline | null;
}

export interface MiniGameRecords {
  fountainFlipsPlayed: number;
  fountainFlipsWon: number;
  fishCaught: number;
  bestFishWeightKg: number;
  racesCompleted: number;
  bestRaceSec: number;
  parkSprintsCompleted: number;
  bestSprintSec: number;
  deliveriesCompleted: number;
  memoryGamesWon: number;
  bestMemoryRound: number;
}

export interface ActiveTimedChallengeState {
  kind: 'race' | 'park_sprint' | 'delivery';
  title: string;
  startedAtMs: number;
  timeLimitSec: number;
  currentStep: number;
  totalSteps: number;
  targetX: number;
  targetY: number;
  targetLabel: string;
}

export type VehicleModelId =
  | 'sedan'
  | 'compact'
  | 'scooter'
  | 'coupe'
  | 'interceptor'
  | 'suv'
  | 'pickup'
  | 'van'
  | 'motorcycle'
  | 'bus'
  | 'taxi'
  | 'police';
export type WheelStyle = 'stock' | 'alloy_star' | 'gold_rim' | 'sport_tread';
export type SpoilerStyle = 'none' | 'street_lip' | 'gt_wing';
export type DecalStyle = 'none' | 'racing_stripe' | 'side_bolt' | 'two_tone';
export type HeadlightStyle = 'warm' | 'ice_blue' | 'neon_gold' | 'crimson';

export interface VehicleCustomization {
  paintColor: string;
  secondaryColor: string;
  wheelStyle: WheelStyle;
  spoilerStyle: SpoilerStyle;
  decalStyle: DecalStyle;
  headlightStyle: HeadlightStyle;
}

export interface VehicleUpgrades {
  engine: number; // 1..5 top speed
  acceleration: number; // 1..5 throttle ramp
  handling: number; // 1..5 turn responsiveness
  braking: number; // 1..5 stopping power
}

export interface OwnedVehicleRecord {
  id: string;
  modelId: VehicleModelId;
  name: string;
  purchasedAt: number;
  condition?: number; // 0..100 vehicle structural condition
  customization: VehicleCustomization;
  upgrades: VehicleUpgrades;
}

export type TimeOfDayPhase = 'morning' | 'afternoon' | 'dusk' | 'night';

export type NPCRoutineActivity =
  | 'patrol'
  | 'bench'
  | 'cafe'
  | 'shopping'
  | 'bus_stop'
  | 'sports'
  | 'pet_walk';

export type PhoneAppId =
  | 'home'
  | 'profile'
  | 'map'
  | 'garage'
  | 'spawner'
  | 'settings'
  | 'inventory'
  | 'missions'
  | 'contacts'
  | 'games'
  | 'social'
  | 'properties'
  | 'friends';

export type SaveSyncStatus = 'local_only' | 'saving' | 'saved' | 'error' | 'offline';

export interface AuthSessionUser {
  uid: string;
  username: string;
  normalizedUsername: string;
  createdAtMs: number;
}

export interface CloudSyncState {
  status: SaveSyncStatus;
  lastSavedAtMs: number | null;
  lastError: string | null;
  pendingChanges: boolean;
  uid: string | null;
  username: string | null;
}

export interface SaveDataV1 {
  version: 1;
  saveVersion: number;
  playerId: string;
  playerName: string;
  appearanceId: string;
  appearanceConfig: CharacterAppearanceConfig;
  lastPosition: SavedPosition | null;
  settings: GameSettings;
  coins: number;
  energy: number;
  inventory: InventoryEntry[];
  equippedClothing: EquippedClothing;
  hairOverride: HairOverride;
  outfitPresets: OutfitPreset[];
  selectedOutfitPresetId: string | null;
  claimedRewards: string[];
  transactions: TransactionRecord[];
  arcadeHighScores: Record<string, number>;
  cinemaTicketActive: boolean;
  achievements: AchievementProgress;
  missions: MissionProgress;
  vehicles: OwnedVehicleRecord[];
  activeVehicleId: string | null;
  progression: ProgressionState;
  story: StoryProgressState;
  miniGameRecords: MiniGameRecords;
  loungeTokens: number;
  collectedIds: string[];
  ownedProperties: string[];
  discoveredSecrets: string[];
  collectibles: string[];
  privacySettings: PrivacySettings;
  joinedAtMs: number;
  friendCount: number;
  cloudConfirmedAt: number | null;
  updatedAt: number;
}

export interface InputSnapshot {
  moveX: number;
  moveY: number;
  isRunning: boolean;
  interactJustPressed: boolean;
  mapJustPressed: boolean;
  pauseJustPressed: boolean;
  phoneJustPressed?: boolean;
}

export interface PlayerEntityState {
  id: string;
  displayName: string;
  appearanceId: string;
  x: number;
  y: number;
  direction: Direction;
  animState: AnimationState;
  isDriving: boolean;
}

export type InteractionKind =
  | 'building_entrance'
  | 'exit_door'
  | 'cafe'
  | 'clothing'
  | 'grocery'
  | 'arcade'
  | 'cinema'
  | 'bench'
  | 'fountain'
  | 'basketball'
  | 'soccer'
  | 'bus_stop'
  | 'mailbox'
  | 'district_sign'
  | 'vehicle'
  | 'npc'
  | 'interior_shop'
  | 'interior_wardrobe'
  | 'interior_arcade'
  | 'interior_cinema_ticket'
  | 'interior_cinema_screen'
  | 'interior_salon'
  | 'interior_bank'
  | 'interior_garage'
  | 'interior_bed'
  | 'interior_kitchen'
  | 'interior_tv'
  | 'interior_computer'
  | 'interior_door'
  | 'interior_gym_workout'
  | 'interior_library_trivia'
  | 'interior_office_task'
  | 'interior_clinic_checkup'
  | 'interior_pet_play'
  | 'interior_info'
  | 'fountain_flip'
  | 'fishing_spot'
  | 'race_trial'
  | 'park_sprint'
  | 'delivery_desk'
  | 'memory_kiosk'
  | 'interior_casino_lounge'
  | 'interior_repair'
  | 'interior_hospital_heal'
  | 'interior_police_term'
  | 'interior_fire_drill'
  | 'interior_train_transit'
  | 'interior_music_synth'
  | 'collectible_shard'
  | 'secret_portal'
  | 'collectible_relic'
  | 'property_sign'
  | 'property_decorate'
  | 'interior_mission_man'
  | 'interior_mission_board';

export type ArcadeGameId =
  | 'starlight_drift'
  | 'brick_blitz'
  | 'turbo_lane_racer'
  | 'hoop_frenzy'
  | 'reflex_surge'
  | 'prism_match'
  | 'memory_matrix';

export type MiniGameId =
  | 'fountain_flip'
  | 'fishing_pond'
  | 'streetball'
  | 'soccer_penalty'
  | ArcadeGameId
  | 'race_trial'
  | 'park_sprint'
  | 'courier_delivery'
  | 'neon_memory';

export interface InteractiveObjectData {
  id: string;
  kind: InteractionKind;
  title: string;
  subtitle: string;
  description: string;
  promptLabel: string;
  x: number;
  y: number;
  radius: number;
  seatX?: number;
  seatY?: number;
  details?: string[];
  actionLabel?: string;
  buildingId?: string;
  shopDomain?: ShopDomain;
  initialTab?: string;
  garageTab?: 'customize' | 'showroom';
  busStopId?: string;
  arcadeGameId?: ArcadeGameId;
  petSpecies?: string;
  infoKey?: string;
  vehicleId?: string;
  districtId?: DistrictId;
  doorId?: string;
  miniGameId?: string;
  collectibleId?: string;
  secretId?: string;
  propertyId?: string;
  targetX?: number;
  targetY?: number;
}

export interface DistrictZone {
  id: DistrictId;
  name: string;
  color: string;
  tileX: number;
  tileY: number;
  tileW: number;
  tileH: number;
  labelTileX: number;
  labelTileY: number;
}

export interface NPCWaypoint {
  x: number;
  y: number;
  waitMs: number;
  face?: Direction;
  emote?: string;
}

export interface NPCRoutineSlot {
  phase: TimeOfDayPhase;
  activity: NPCRoutineActivity;
  locationLabel: string;
  waypoints: NPCWaypoint[];
}

export interface NPCConfig {
  id: string;
  name: string;
  role: string;
  district: DistrictId;
  preset: CharacterPreset;
  greeting: string;
  chatLines?: string[];
  hasPet?: {species: 'dog' | 'cat'; color: string};
  routine?: NPCRoutineSlot[];
  waypoints: NPCWaypoint[];
  speed: number;
}

export type InteriorTheme =
  | 'clothing'
  | 'cafe'
  | 'restaurant'
  | 'supermarket'
  | 'arcade'
  | 'cinema'
  | 'house'
  | 'apartment'
  | 'bank'
  | 'salon'
  | 'petshop'
  | 'electronics'
  | 'gym'
  | 'clinic'
  | 'library'
  | 'bookstore'
  | 'office'
  | 'garage'
  | 'hospital'
  | 'police'
  | 'fire'
  | 'airport'
  | 'hotel'
  | 'dealership'
  | 'repair'
  | 'mall'
  | 'music'
  | 'train'
  | 'casino_lounge'
  | 'warehouse'
  | 'farm_market'
  | 'boardwalk_cafe'
  | 'mission_house';

export type WeatherType = 'sunny' | 'cloudy' | 'rain';

export type CityEventKind =
  | 'car_meet'
  | 'street_festival'
  | 'park_event'
  | 'treasure_hunt'
  | 'photo_challenge'
  | 'express_run';

export interface CityEventState {
  id: string;
  kind: CityEventKind;
  title: string;
  subtitle: string;
  districtId: DistrictId;
  worldX: number;
  worldY: number;
  rewardCoins: number;
  rewardXp: number;
  remainingSec: number;
}

export interface InteriorSceneLaunchData {
  buildingId: string;
  returnPos: SavedPosition;
  propertyDeedId?: string;
  propertyOwnerUid?: string;
  readOnlyVisitor?: boolean;
}

export interface CitySceneLaunchData {
  spawnOverride?: SavedPosition;
}

// =========================================================================
// PROMPT 11 — MULTIPLAYER, OWNER BADGE, PROPERTIES, EXPLORATION & SOCIAL
// =========================================================================

export type EmoteId = 'wave' | 'dance' | 'cheer' | 'sit' | 'heart' | 'music';

export type PropertyTier = 'apartment' | 'medium_house' | 'luxury_house' | 'premium_villa';

export type FurnitureCategory = 'seating' | 'bedroom' | 'tables' | 'lighting' | 'electronics' | 'decor';

export interface FurnitureCatalogItem {
  id: string;
  name: string;
  category: FurnitureCategory;
  texture: string;
  price: number;
  colliderW: number;
  colliderH: number;
  colliderOffsetY?: number;
  interactiveKind?: 'bench' | 'interior_bed' | 'interior_tv' | 'interior_computer';
  description: string;
}

export interface PlacedFurniture {
  uid: string;
  catalogId: string;
  texture: string;
  x: number;
  y: number;
  rotationDeg: number; // 0, 90, 180, 270
}

export type PlacedFurnitureItem = PlacedFurniture;

export interface PropertyDef {
  id: string;
  buildingId: string;
  name: string;
  tier: PropertyTier;
  tierLabel: string;
  districtId: DistrictId;
  districtName: string;
  price: number;
  rooms: string[];
  maxFurniture: number;
  description: string;
  previewHighlights: string[];
  exteriorX: number;
  exteriorY: number;
  defaultFloorStyle: string;
  defaultWallStyle: string;
  cols: number;
  rows: number;
  defaultFurniture: PlacedFurniture[];
}

export interface PropertyDeed {
  deedId: string;
  ownerUid: string;
  ownerUsername: string;
  propertyId: string;
  title: string;
  tier: PropertyTier;
  allowVisitors: boolean;
  invitedUids: string[];
  floorStyle: string;
  wallStyle: string;
  furniture: PlacedFurniture[];
  updatedAtMs: number;
}

export type CollectibleRarity = 'common' | 'rare' | 'epic' | 'mythic';

export interface CollectibleItemDef {
  id: string;
  name: string;
  rarity: CollectibleRarity;
  districtId: DistrictId;
  hint: string;
  rewardCoins: number;
  rewardXp: number;
  tileX: number;
  tileY: number;
  texture: string;
}

export interface SecretLocationDef {
  id: string;
  name: string;
  category: 'rooftop' | 'underground' | 'hidden_alley' | 'coastal_secret' | 'landmark';
  districtId: DistrictId;
  description: string;
  rewardCoins: number;
  rewardXp: number;
  rewardTitle?: string;
  entryTileX: number;
  entryTileY: number;
  exitTileX: number;
  exitTileY: number;
}

export interface MultiplayerServerInfo {
  id: string;
  name: string;
  region: string;
  description: string;
  players: number;
  maxPlayers: number;
  status: 'online' | 'full' | 'closed';
  visibility?: ServerVisibility;
  hasPassword?: boolean;
  hostUid?: string;
  hostUsername?: string;
  isOfficial?: boolean;
  roomCode?: string;
  createdAtMs?: number;
}

export interface PendingMultiplayerJoin {
  roomId: string;
  roomName: string;
  roomCode?: string;
  visibility?: ServerVisibility;
  hostUid?: string;
  hostUsername?: string;
  maxPlayers?: number;
  password?: string;
  isHost?: boolean;
}

export interface ServerInviteItem {
  inviteId: string;
  roomId: string;
  roomName: string;
  roomCode: string;
  visibility: ServerVisibility;
  hasPassword: boolean;
  fromUid: string;
  fromUsername: string;
  toUid: string;
  toUsername?: string;
  playerCount: number;
  maxPlayers: number;
  createdAtMs: number;
  expiresAtMs: number;
}

export interface RemoteVehicleSnapshot {
  id: string;
  modelId: VehicleModelId;
  texture: string;
  customization: VehicleCustomization;
  isScooter: boolean;
  passengers: string[];
}

export interface RemotePlayerState {
  uid: string;
  username: string;
  displayName: string;
  isOwner: boolean;
  level: number;
  selectedTitle: string;
  appearanceId: string;
  appearanceConfig: CharacterAppearanceConfig;
  equippedClothing: EquippedClothing;
  hairOverride?: HairOverride | null;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dir: Direction;
  anim: AnimationState;
  interiorId: string | null;
  propertyDeedId: string | null;
  vehicle: RemoteVehicleSnapshot | null;
  ridingDriverUid: string | null;
  emote: {id: string; expiresAt: number} | null;
  updatedAt: number;
}

export interface ChatMessageRecord {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  isOwner: boolean;
  text: string;
  moderated?: boolean;
  timestamp: number;
}

export interface SharedActivityLobby {
  lobbyId: string;
  activityId: string;
  title: string;
  hostUid: string;
  hostName: string;
  roomId: string;
  status: 'waiting' | 'active' | 'finished';
  maxPlayers: number;
  players: Array<{
    uid: string;
    displayName: string;
    isOwner: boolean;
    ready: boolean;
    score: number;
    finished: boolean;
  }>;
  createdAt: number;
}

export interface PublicPlayerProfile {
  uid: string;
  username: string;
  normalizedUsername: string;
  displayName: string;
  isOwnerVerified?: boolean;
  level: number;
  xp: number;
  selectedTitle: string;
  appearanceId: string;
  appearanceConfig: CharacterAppearanceConfig;
  equippedClothing: EquippedClothing;
  hairOverride?: HairOverride | null;
  ownedPropertyCount: number;
  ownedVehicleCount: number;
  missionsCompletedCount: number;
  miniGamesPlayedCount: number;
  achievementCount: number;
  explorationPercent: number;
  joinedAtMs: number;
  onlineServerId: string | null;
  isOnline: boolean;
  profileVisibility: 'public' | 'friends' | 'private';
}

export interface FriendRequestRecord {
  requestId: string;
  senderUid: string;
  senderUsername: string;
  receiverUid: string;
  receiverUsername: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAtMs: number;
}

export interface FriendRecord {
  uid: string;
  username: string;
  pairId: string;
  profile?: PublicPlayerProfile | null;
  liveStatus?: {
    isOnline: boolean;
    roomId: string | null;
    roomName: string | null;
    visibility: string | null;
  };
}
