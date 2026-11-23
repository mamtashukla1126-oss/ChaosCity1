import {TILE_SIZE} from '@/src/config/constants';
import {
  DecalStyle,
  HeadlightStyle,
  OwnedVehicleRecord,
  SaveDataV1,
  SpoilerStyle,
  TimeOfDayPhase,
  VehicleCustomization,
  VehicleModelId,
  VehicleUpgrades,
  WheelStyle,
} from '@/src/game/types/gameTypes';

export interface VehicleModelSpec {
  modelId: VehicleModelId;
  name: string;
  tagline: string;
  price: number;
  baseSpeed: number;
  isScooter: boolean;
  unlockOnly?: boolean;
  defaultCustomization: VehicleCustomization;
  defaultUpgrades: VehicleUpgrades;
}

export const VEHICLE_MODELS: VehicleModelSpec[] = [
  {
    modelId: 'sedan',
    name: 'Skyline Roadster',
    tagline: 'Balanced 4-door boulevard cruiser with crisp handling.',
    price: 0, // Starter car included for every resident!
    baseSpeed: 365,
    isScooter: false,
    defaultCustomization: {
      paintColor: '#0284c7',
      secondaryColor: '#38bdf8',
      wheelStyle: 'stock',
      spoilerStyle: 'none',
      decalStyle: 'none',
      headlightStyle: 'warm',
    },
    defaultUpgrades: {engine: 1, acceleration: 1, handling: 1, braking: 1},
  },
  {
    modelId: 'scooter',
    name: 'Metro Volt Scooter',
    tagline: 'Featherweight zip-scooter built for tight sidewalks & alleyways.',
    price: 95,
    baseSpeed: 330,
    isScooter: true,
    defaultCustomization: {
      paintColor: '#10b981',
      secondaryColor: '#a7f3d0',
      wheelStyle: 'stock',
      spoilerStyle: 'none',
      decalStyle: 'none',
      headlightStyle: 'ice_blue',
    },
    defaultUpgrades: {engine: 1, acceleration: 2, handling: 2, braking: 2},
  },
  {
    modelId: 'compact',
    name: 'Sunset Hatchback',
    tagline: 'Agile city hatch with punchy mid-range pickup and rally stance.',
    price: 150,
    baseSpeed: 350,
    isScooter: false,
    defaultCustomization: {
      paintColor: '#ea580c',
      secondaryColor: '#fb923c',
      wheelStyle: 'alloy_star',
      spoilerStyle: 'street_lip',
      decalStyle: 'two_tone',
      headlightStyle: 'warm',
    },
    defaultUpgrades: {engine: 1, acceleration: 2, handling: 1, braking: 1},
  },
  {
    modelId: 'coupe',
    name: 'Apex GT Coupe',
    tagline: 'Widebody street tuner engineered for top boulevard speed.',
    price: 260,
    baseSpeed: 395,
    isScooter: false,
    defaultCustomization: {
      paintColor: '#6366f1',
      secondaryColor: '#a855f7',
      wheelStyle: 'gold_rim',
      spoilerStyle: 'gt_wing',
      decalStyle: 'racing_stripe',
      headlightStyle: 'ice_blue',
    },
    defaultUpgrades: {engine: 2, acceleration: 2, handling: 2, braking: 1},
  },
  {
    modelId: 'interceptor',
    name: 'Starlight Interceptor',
    tagline: 'Unlocked by completing The Starlight Beacon story or reaching Level 6.',
    price: 0,
    baseSpeed: 428,
    isScooter: false,
    unlockOnly: true,
    defaultCustomization: {
      paintColor: '#0f172a',
      secondaryColor: '#fbbf24',
      wheelStyle: 'sport_tread',
      spoilerStyle: 'gt_wing',
      decalStyle: 'racing_stripe',
      headlightStyle: 'ice_blue',
    },
    defaultUpgrades: {engine: 3, acceleration: 3, handling: 3, braking: 2},
  },
  {
    modelId: 'motorcycle',
    name: 'Volt R-900 Superbike',
    tagline: 'Razor-thin sport motorcycle with explosive launch & sidewalk agility.',
    price: 180,
    baseSpeed: 418,
    isScooter: true,
    defaultCustomization: {
      paintColor: '#dc2626',
      secondaryColor: '#f8fafc',
      wheelStyle: 'sport_tread',
      spoilerStyle: 'none',
      decalStyle: 'racing_stripe',
      headlightStyle: 'ice_blue',
    },
    defaultUpgrades: {engine: 2, acceleration: 3, handling: 3, braking: 2},
  },
  {
    modelId: 'pickup',
    name: 'Ridgeback 4x4 Pickup',
    tagline: 'Rugged countryside & farm-trail utility truck built for dirt roads.',
    price: 195,
    baseSpeed: 362,
    isScooter: false,
    defaultCustomization: {
      paintColor: '#059669',
      secondaryColor: '#fde68a',
      wheelStyle: 'alloy_star',
      spoilerStyle: 'none',
      decalStyle: 'two_tone',
      headlightStyle: 'warm',
    },
    defaultUpgrades: {engine: 2, acceleration: 1, handling: 2, braking: 2},
  },
  {
    modelId: 'suv',
    name: 'Horizon Trailblazer SUV',
    tagline: 'Full-size Luxury Heights cruiser with planted suspension.',
    price: 220,
    baseSpeed: 376,
    isScooter: false,
    defaultCustomization: {
      paintColor: '#1e293b',
      secondaryColor: '#94a3b8',
      wheelStyle: 'alloy_star',
      spoilerStyle: 'street_lip',
      decalStyle: 'none',
      headlightStyle: 'ice_blue',
    },
    defaultUpgrades: {engine: 2, acceleration: 2, handling: 2, braking: 2},
  },
  {
    modelId: 'van',
    name: 'Metro Cargo Van',
    tagline: 'Heavy commercial delivery van favored by Industrial couriers.',
    price: 175,
    baseSpeed: 342,
    isScooter: false,
    defaultCustomization: {
      paintColor: '#e2e8f0',
      secondaryColor: '#f97316',
      wheelStyle: 'stock',
      spoilerStyle: 'none',
      decalStyle: 'side_bolt',
      headlightStyle: 'warm',
    },
    defaultUpgrades: {engine: 1, acceleration: 1, handling: 2, braking: 2},
  },
  {
    modelId: 'taxi',
    name: 'Downtown Yellow Cab',
    tagline: 'Iconic Chaos City medallion taxi tuned for expressway sprints.',
    price: 165,
    baseSpeed: 372,
    isScooter: false,
    defaultCustomization: {
      paintColor: '#d97706',
      secondaryColor: '#fef08a',
      wheelStyle: 'alloy_star',
      spoilerStyle: 'none',
      decalStyle: 'two_tone',
      headlightStyle: 'neon_gold',
    },
    defaultUpgrades: {engine: 2, acceleration: 2, handling: 2, braking: 2},
  },
  {
    modelId: 'bus',
    name: 'Chaos Transit Coach',
    tagline: 'Full-length metropolitan transit bus built to command the highway.',
    price: 280,
    baseSpeed: 325,
    isScooter: false,
    defaultCustomization: {
      paintColor: '#0284c7',
      secondaryColor: '#e0f2fe',
      wheelStyle: 'stock',
      spoilerStyle: 'none',
      decalStyle: 'two_tone',
      headlightStyle: 'warm',
    },
    defaultUpgrades: {engine: 2, acceleration: 1, handling: 1, braking: 3},
  },
  {
    modelId: 'police',
    name: 'CCPD Patrol Cruiser',
    tagline: 'Pursuit-grade interceptor equipped with dual emergency strobes.',
    price: 320,
    baseSpeed: 422,
    isScooter: false,
    defaultCustomization: {
      paintColor: '#0f172a',
      secondaryColor: '#f8fafc',
      wheelStyle: 'sport_tread',
      spoilerStyle: 'street_lip',
      decalStyle: 'two_tone',
      headlightStyle: 'ice_blue',
    },
    defaultUpgrades: {engine: 3, acceleration: 3, handling: 3, braking: 3},
  },
];

export function getVehicleModelSpec(modelId: VehicleModelId): VehicleModelSpec {
  return VEHICLE_MODELS.find((m) => m.modelId === modelId) ?? VEHICLE_MODELS[0];
}

export function createStarterOwnedVehicle(): OwnedVehicleRecord {
  const starter = VEHICLE_MODELS[0];
  return {
    id: 'veh_owned_starter',
    modelId: starter.modelId,
    name: starter.name,
    purchasedAt: Date.now(),
    condition: 100,
    customization: {...starter.defaultCustomization},
    upgrades: {...starter.defaultUpgrades},
  };
}

export const GARAGE_PAINT_COLORS: {id: string; name: string; hex: string; roofHex: string; price: number}[] = [
  {id: 'sky', name: 'Horizon Sky', hex: '#0284c7', roofHex: '#38bdf8', price: 0},
  {id: 'crimson', name: 'Chaos Crimson', hex: '#dc2626', roofHex: '#f87171', price: 20},
  {id: 'amber', name: 'Sunset Orange', hex: '#ea580c', roofHex: '#fb923c', price: 20},
  {id: 'emerald', name: 'Mint Emerald', hex: '#059669', roofHex: '#34d399', price: 20},
  {id: 'indigo', name: 'Midnight Indigo', hex: '#4f46e5', roofHex: '#818cf8', price: 25},
  {id: 'magenta', name: 'Neon Magenta', hex: '#db2777', roofHex: '#f472b6', price: 25},
  {id: 'gold', name: 'Solar Gold', hex: '#d97706', roofHex: '#fbbf24', price: 30},
  {id: 'obsidian', name: 'Stealth Matte', hex: '#1e293b', roofHex: '#475569', price: 30},
  {id: 'pearl', name: 'Pearl Frost', hex: '#e2e8f0', roofHex: '#ffffff', price: 25},
];

export const WHEEL_OPTIONS: {id: WheelStyle; name: string; price: number}[] = [
  {id: 'stock', name: 'Standard Steel', price: 0},
  {id: 'alloy_star', name: 'Chrome 5-Spoke', price: 20},
  {id: 'gold_rim', name: 'Gold Forged', price: 35},
  {id: 'sport_tread', name: 'Neon Track Tire', price: 40},
];

export const SPOILER_OPTIONS: {id: SpoilerStyle; name: string; price: number}[] = [
  {id: 'none', name: 'No Spoiler', price: 0},
  {id: 'street_lip', name: 'Street Lip', price: 20},
  {id: 'gt_wing', name: 'Twin GT Wing', price: 45},
];

export const DECAL_OPTIONS: {id: DecalStyle; name: string; price: number}[] = [
  {id: 'none', name: 'Clean Coat', price: 0},
  {id: 'racing_stripe', name: 'Twin Rally Stripes', price: 25},
  {id: 'side_bolt', name: 'Street Bolt Accent', price: 30},
  {id: 'two_tone', name: 'Two-Tone Aero', price: 30},
];

export const HEADLIGHT_OPTIONS: {id: HeadlightStyle; name: string; hex: string; price: number}[] = [
  {id: 'warm', name: 'Classic Halogen', hex: '#fef08a', price: 0},
  {id: 'ice_blue', name: 'Ice Xenon', hex: '#7dd3fc', price: 20},
  {id: 'neon_gold', name: 'Rally Gold', hex: '#facc15', price: 25},
  {id: 'crimson', name: 'Crimson Halo', hex: '#fb7185', price: 25},
];

export type UpgradeStatKey = keyof VehicleUpgrades;

export const UPGRADE_STAT_DEFS: {
  key: UpgradeStatKey;
  label: string;
  benefit: string;
  baseCost: number;
}[] = [
  {
    key: 'engine',
    label: 'Engine Tune',
    benefit: '+10% top speed per tier',
    baseCost: 30,
  },
  {
    key: 'acceleration',
    label: 'Turbo Spool',
    benefit: 'Faster launch & throttle response',
    baseCost: 25,
  },
  {
    key: 'handling',
    label: 'Sport Suspension',
    benefit: 'Crisper steering & cornering',
    baseCost: 25,
  },
  {
    key: 'braking',
    label: 'Carbon Brakes',
    benefit: 'Shorter stopping distance',
    baseCost: 20,
  },
];

export function getUpgradeCost(stat: UpgradeStatKey, currentLevel: number): number {
  const def = UPGRADE_STAT_DEFS.find((d) => d.key === stat) ?? UPGRADE_STAT_DEFS[0];
  return def.baseCost + (currentLevel - 1) * 15;
}

export interface MissionDefinition {
  id: string;
  title: string;
  description: string;
  rewardCoins: number;
  goal: number;
  getProgress: (save: SaveDataV1) => number;
}

export const CITY_MISSIONS: MissionDefinition[] = [
  {
    id: 'm_districts_5',
    title: 'Five-District Tour',
    description: 'Explore all 5 connected CHAOS CITY districts.',
    rewardCoins: 45,
    goal: 5,
    getProgress: (s) => Math.min(5, s.missions.visitedDistricts.length),
  },
  {
    id: 'm_buildings_5',
    title: 'Open Doors',
    description: 'Step inside 5 different city buildings.',
    rewardCoins: 35,
    goal: 5,
    getProgress: (s) => Math.min(5, s.missions.visitedBuildings.length),
  },
  {
    id: 'm_visit_garage',
    title: 'Grease & Gears',
    description: 'Visit Chaos Customs Garage in the Entertainment District.',
    rewardCoins: 25,
    goal: 1,
    getProgress: (s) => (s.missions.visitedBuildings.includes('b_garage') ? 1 : 0),
  },
  {
    id: 'm_customize_car',
    title: 'Custom Whip',
    description: 'Customize paint, parts, or upgrades on any owned vehicle at the Garage.',
    rewardCoins: 40,
    goal: 1,
    getProgress: (s) => (s.missions.garageCustomized ? 1 : 0),
  },
  {
    id: 'm_spawn_car',
    title: 'Instant Valet',
    description: 'Spawn a personal vehicle using your Smartphone Vehicle Spawner app.',
    rewardCoins: 25,
    goal: 1,
    getProgress: (s) => (s.missions.vehicleSpawned ? 1 : 0),
  },
  {
    id: 'm_meet_npcs_5',
    title: 'Neighborhood Regular',
    description: 'Meet and chat with 5 different CHAOS CITY residents.',
    rewardCoins: 35,
    goal: 5,
    getProgress: (s) => Math.min(5, (s.missions.metNpcs ?? []).length),
  },
  {
    id: 'm_first_buy',
    title: 'Local Supporter',
    description: 'Purchase an item from any boutique, cafe, market, or store.',
    rewardCoins: 25,
    goal: 1,
    getProgress: (s) => Math.min(1, s.missions.itemsPurchased),
  },
  {
    id: 'm_sports_star',
    title: 'City Athlete',
    description: 'Play Streetball Shootout or Penalty Kick Challenge to completion.',
    rewardCoins: 35,
    goal: 1,
    getProgress: (s) =>
      s.missions.completedIds.includes('mission_soccer_match') ||
      (s.arcadeHighScores.streetball ?? 0) > 0
        ? 1
        : 0,
  },
  {
    id: 'm_activities_3',
    title: 'Active Resident',
    description: 'Complete 3 city activities, shifts, trivia, or arcade runs.',
    rewardCoins: 50,
    goal: 3,
    getProgress: (s) => Math.min(3, s.missions.activitiesCompleted),
  },
  {
    id: 'm_collect_2_cars',
    title: 'Fleet Builder',
    description: 'Own at least 2 vehicles in your personal garage.',
    rewardCoins: 60,
    goal: 2,
    getProgress: (s) => Math.min(2, s.vehicles.length),
  },
];

export interface CityEventDefinition {
  phase: TimeOfDayPhase;
  title: string;
  subtitle: string;
  bonusText: string;
}

export const CITY_EVENTS: Record<TimeOfDayPhase, CityEventDefinition> = {
  morning: {
    phase: 'morning',
    title: 'Morning Commute & Espresso Rush',
    subtitle: '06:00 – 12:00 · Shopping & Downtown',
    bonusText: 'Baristas & couriers hit the avenues; Bus Loop shuttles run peak schedule.',
  },
  afternoon: {
    phase: 'afternoon',
    title: 'Midday Park & Sports Festival',
    subtitle: '12:00 – 17:30 · Central Park & Courts',
    bonusText: 'Park walkers, basketball & soccer kickabouts are active outdoors!',
  },
  dusk: {
    phase: 'dusk',
    title: 'Sunset Cruise & Garage Tuning Hour',
    subtitle: '17:30 – 20:30 · Chaos Customs & Blvd',
    bonusText: 'Golden hour street cruisers & neon shop signs illuminate Entertainment Plaza.',
  },
  night: {
    phase: 'night',
    title: 'Starlight Nightlife & Neon Arcade',
    subtitle: '20:30 – 06:00 · Cinema & Arcade District',
    bonusText: 'Streetlights glow citywide while Starlight Cinema and Pixel Palace hit peak energy.',
  },
};

export interface BusStopSpot {
  id: string;
  name: string;
  district: string;
  x: number;
  y: number;
}

export const BUS_STOPS: BusStopSpot[] = [
  {
    id: 'stop_downtown',
    name: 'Downtown Civic Stop',
    district: 'Downtown',
    x: 21.5 * TILE_SIZE,
    y: 26.2 * TILE_SIZE,
  },
  {
    id: 'stop_park',
    name: 'Central Park South Gate',
    district: 'Central Park',
    x: 42.0 * TILE_SIZE,
    y: 26.2 * TILE_SIZE,
  },
  {
    id: 'stop_entertainment',
    name: 'Arcade & Cinema Plaza',
    district: 'Entertainment District',
    x: 50.0 * TILE_SIZE,
    y: 49.0 * TILE_SIZE,
  },
  {
    id: 'stop_garage',
    name: 'Chaos Customs Blvd',
    district: 'Entertainment District',
    x: 64.5 * TILE_SIZE,
    y: 30.8 * TILE_SIZE,
  },
  {
    id: 'stop_luxury',
    name: 'Luxury Heights Promenade',
    district: 'Luxury Heights',
    x: 96.0 * TILE_SIZE,
    y: 26.2 * TILE_SIZE,
  },
  {
    id: 'stop_airport',
    name: 'Starlight Airport Terminal',
    district: 'Starlight Airport',
    x: 132.0 * TILE_SIZE,
    y: 26.2 * TILE_SIZE,
  },
  {
    id: 'stop_industrial',
    name: 'Ironworks & Train Hub',
    district: 'Ironworks Industrial',
    x: 96.0 * TILE_SIZE,
    y: 50.0 * TILE_SIZE,
  },
  {
    id: 'stop_beach',
    name: 'Pacific Boardwalk Pier',
    district: 'Pacific Boardwalk & Beach',
    x: 135.0 * TILE_SIZE,
    y: 66.0 * TILE_SIZE,
  },
  {
    id: 'stop_countryside',
    name: 'Emerald Valley Farmstead',
    district: 'Emerald Valley Countryside',
    x: 28.0 * TILE_SIZE,
    y: 78.0 * TILE_SIZE,
  },
  {
    id: 'stop_highway_mall',
    name: 'Metro Expressway Plaza',
    district: 'Metro Expressway',
    x: 94.0 * TILE_SIZE,
    y: 86.0 * TILE_SIZE,
  },
];
