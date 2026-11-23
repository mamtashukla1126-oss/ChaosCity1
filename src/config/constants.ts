import {CharacterPreset, DistrictZone, GameSettings} from '@/src/game/types/gameTypes';

export const GAME_TITLE = 'CHAOS CITY';
export const GAME_TAGLINE = 'YOUR CITY. YOUR FRIENDS. YOUR RULES.';
export const GAME_VERSION = '0.1.0-prototype';

export const TILE_SIZE = 32;
export const MAP_COLS = 160;
export const MAP_ROWS = 120;
export const WORLD_WIDTH = MAP_COLS * TILE_SIZE; // 5120
export const WORLD_HEIGHT = MAP_ROWS * TILE_SIZE; // 3840

export const PLAYER_WALK_SPEED = 175;
export const PLAYER_RUN_SPEED = 290;
export const PLAYER_BODY_WIDTH = 18;
export const PLAYER_BODY_HEIGHT = 12;

export const DEFAULT_SPAWN_TILE = {x: 34, y: 29};

export const CAMERA_MIN_ZOOM = 1.0;
export const CAMERA_MAX_ZOOM = 2.0;
export const CAMERA_DEFAULT_ZOOM = 1.35;

export const SAVE_STORAGE_KEY = 'chaos_city_save_v1';
export const SAVE_SCHEMA_VERSION = 1;

export const JOYSTICK_DEAD_ZONE = 0.16;

export const DEFAULT_KEYBINDS = {
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  run: 'ShiftLeft',
  interact: 'KeyE',
  map: 'KeyM',
  phone: 'KeyP',
  emote: 'KeyT',
};

export const DEFAULT_PRIVACY_SETTINGS = {
  profileVisibility: 'public' as const,
  allowMultiplayerInvites: true,
  allowPropertyVisitorsDefault: true,
  showOnlineStatus: true,
};

export const DEFAULT_SETTINGS: GameSettings = {
  audio: {
    masterVolume: 0.9,
    musicVolume: 0.45,
    sfxVolume: 0.7,
    muted: false,
  },
  cameraZoom: CAMERA_DEFAULT_ZOOM,
  joystickSensitivity: 1.0,
  graphicsQuality: 'high',
  effectsQuality: 'high',
  shadowsEnabled: true,
  renderDistance: 'medium',
  performanceMode: false,
  touchMode: 'auto',
  joystickSide: 'left',
  joystickOffsetX: 0,
  joystickOffsetY: 0,
  actionOffsetX: 0,
  actionOffsetY: 0,
  touchButtonScale: 1.0,
  mouseInteractEnabled: true,
  uiScale: 1.0,
  notificationsEnabled: true,
  keybinds: {...DEFAULT_KEYBINDS},
};

export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 'street_explorer',
    name: 'Kai',
    gender: 'male',
    tagline: 'Male · Street Explorer',
    skinColor: '#f1c27d',
    hairColor: '#1e293b',
    hairStyle: 'short',
    eyeStyle: 'classic',
    eyeColor: '#0f172a',
    browStyle: 'natural',
    facialDetail: 'none',
    facialHair: 'none',
    shirtColor: '#0ea5e9',
    shirtAccent: '#e0f2fe',
    pantsColor: '#1e293b',
    shoeColor: '#f8fafc',
  },
  {
    id: 'sunset_skater',
    name: 'Juno',
    gender: 'female',
    tagline: 'Female · Plaza Regular',
    skinColor: '#e0ac69',
    hairColor: '#5b2c1d',
    hairStyle: 'long_waves',
    eyeStyle: 'lashes',
    eyeColor: '#4338ca',
    browStyle: 'arched',
    facialDetail: 'freckles',
    facialHair: 'none',
    shirtColor: '#f97316',
    shirtAccent: '#ffedd5',
    pantsColor: '#334155',
    shoeColor: '#38bdf8',
  },
  {
    id: 'park_ranger',
    name: 'Rowan',
    gender: 'male',
    tagline: 'Male · Park Wanderer',
    skinColor: '#8d5524',
    hairColor: '#0f172a',
    hairStyle: 'sidepart',
    eyeStyle: 'sharp',
    eyeColor: '#065f46',
    browStyle: 'thick',
    facialDetail: 'none',
    facialHair: 'stubble',
    shirtColor: '#10b981',
    shirtAccent: '#fef08a',
    pantsColor: '#475569',
    shoeColor: '#cbd5e1',
  },
  {
    id: 'arcade_ace',
    name: 'Nova',
    gender: 'female',
    tagline: 'Female · Arcade Ace',
    skinColor: '#ffdbac',
    hairColor: '#db2777',
    hairStyle: 'ponytail',
    eyeStyle: 'wide',
    eyeColor: '#0284c7',
    browStyle: 'soft',
    facialDetail: 'blush',
    facialHair: 'none',
    shirtColor: '#6366f1',
    shirtAccent: '#fbbf24',
    pantsColor: '#0f172a',
    shoeColor: '#fbbf24',
  },
];

export const SKIN_TONES: {id: string; name: string; hex: string}[] = [
  {id: 'fair', name: 'Porcelain', hex: '#ffdbac'},
  {id: 'warm', name: 'Warm Sand', hex: '#f1c27d'},
  {id: 'golden', name: 'Golden Honey', hex: '#e0ac69'},
  {id: 'caramel', name: 'Caramel', hex: '#c68642'},
  {id: 'bronze', name: 'Bronze', hex: '#a46434'},
  {id: 'chestnut', name: 'Chestnut', hex: '#8d5524'},
  {id: 'espresso', name: 'Deep Espresso', hex: '#5c3419'},
];

export const EYE_COLORS: {id: string; name: string; hex: string}[] = [
  {id: 'obsidian', name: 'Obsidian', hex: '#0f172a'},
  {id: 'ocean', name: 'Ocean Blue', hex: '#0284c7'},
  {id: 'emerald', name: 'Emerald', hex: '#059669'},
  {id: 'amber', name: 'Hazel Amber', hex: '#b45309'},
  {id: 'violet', name: 'Indigo', hex: '#4338ca'},
  {id: 'crimson', name: 'Ruby', hex: '#be123c'},
];

export const DISTRICTS: DistrictZone[] = [
  {
    id: 'downtown',
    name: 'Downtown',
    color: '#38bdf8',
    tileX: 0,
    tileY: 0,
    tileW: 28,
    tileH: 30,
    labelTileX: 13,
    labelTileY: 14,
  },
  {
    id: 'central_park',
    name: 'Central Park',
    color: '#34d399',
    tileX: 28,
    tileY: 0,
    tileW: 24,
    tileH: 32,
    labelTileX: 40,
    labelTileY: 14,
  },
  {
    id: 'residential',
    name: 'Residential District',
    color: '#fbbf24',
    tileX: 52,
    tileY: 0,
    tileW: 28,
    tileH: 32,
    labelTileX: 66,
    labelTileY: 15,
  },
  {
    id: 'shopping',
    name: 'Shopping District',
    color: '#f472b6',
    tileX: 0,
    tileY: 30,
    tileW: 44,
    tileH: 30,
    labelTileX: 21,
    labelTileY: 44,
  },
  {
    id: 'entertainment',
    name: 'Entertainment District',
    color: '#a78bfa',
    tileX: 44,
    tileY: 32,
    tileW: 36,
    tileH: 28,
    labelTileX: 62,
    labelTileY: 45,
  },
  {
    id: 'luxury',
    name: 'Luxury Heights',
    color: '#f59e0b',
    tileX: 80,
    tileY: 0,
    tileW: 42,
    tileH: 32,
    labelTileX: 101,
    labelTileY: 14,
  },
  {
    id: 'airport',
    name: 'Starlight Airport',
    color: '#0ea5e9',
    tileX: 122,
    tileY: 0,
    tileW: 38,
    tileH: 42,
    labelTileX: 141,
    labelTileY: 16,
  },
  {
    id: 'industrial',
    name: 'Ironworks Industrial',
    color: '#f97316',
    tileX: 80,
    tileY: 32,
    tileW: 42,
    tileH: 34,
    labelTileX: 101,
    labelTileY: 48,
  },
  {
    id: 'beach',
    name: 'Pacific Boardwalk & Beach',
    color: '#06b6d4',
    tileX: 122,
    tileY: 42,
    tileW: 38,
    tileH: 78,
    labelTileX: 138,
    labelTileY: 74,
  },
  {
    id: 'countryside',
    name: 'Emerald Valley Countryside',
    color: '#84cc16',
    tileX: 0,
    tileY: 60,
    tileW: 64,
    tileH: 60,
    labelTileX: 30,
    labelTileY: 88,
  },
  {
    id: 'highway',
    name: 'Metro Expressway',
    color: '#64748b',
    tileX: 64,
    tileY: 66,
    tileW: 58,
    tileH: 54,
    labelTileX: 93,
    labelTileY: 92,
  },
];

export const STARTING_COINS = 250;

export const CLOTHING_CATEGORIES: {id: string; label: string; group: string}[] = [
  {id: 'shirts', label: 'Shirts', group: 'Upper Body'},
  {id: 'tshirts', label: 'T-shirts', group: 'Upper Body'},
  {id: 'hoodies', label: 'Hoodies', group: 'Upper Body'},
  {id: 'jackets', label: 'Jackets', group: 'Upper Body'},
  {id: 'sweaters', label: 'Sweaters', group: 'Upper Body'},
  {id: 'trousers', label: 'Jeans & Trousers', group: 'Lower Body'},
  {id: 'shorts', label: 'Shorts', group: 'Lower Body'},
  {id: 'skirts', label: 'Skirts', group: 'Lower Body'},
  {id: 'shoes', label: 'Footwear', group: 'Footwear'},
  {id: 'hats', label: 'Hats & Caps', group: 'Accessories'},
  {id: 'glasses', label: 'Glasses', group: 'Accessories'},
  {id: 'accessories', label: 'Accessories', group: 'Accessories'},
];

export const SCENE_KEYS = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  MAIN_MENU: 'MainMenuScene',
  CITY: 'CityScene',
  INTERIOR: 'InteriorScene',
} as const;
