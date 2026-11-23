import {TILE_SIZE} from '@/src/config/constants';
import {MissionCategory, SaveDataV1, VehicleModelId} from '@/src/game/types/gameTypes';

// =========================================================================
// XP, LEVELS, TITLES & MILESTONES
// =========================================================================

export const LEVEL_XP_THRESHOLDS = [
  0, // index 0 unused
  0, // Level 1
  100, // Level 2
  240, // Level 3
  440, // Level 4
  700, // Level 5
  1020, // Level 6
  1400, // Level 7
  1850, // Level 8
  2380, // Level 9
  3000, // Level 10
];

export const MAX_LEVEL = LEVEL_XP_THRESHOLDS.length - 1;

export function getLevelForXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = 1;
  for (let lv = 2; lv <= MAX_LEVEL; lv++) {
    if (safeXp >= LEVEL_XP_THRESHOLDS[lv]) {
      level = lv;
    } else {
      break;
    }
  }
  return level;
}

export function getXpLevelProgress(xp: number): {
  level: number;
  currentXp: number;
  levelFloorXp: number;
  nextLevelXp: number | null;
  progressInLevel: number;
  neededInLevel: number;
  percent: number;
} {
  const safeXp = Math.max(0, Math.floor(xp));
  const level = getLevelForXp(safeXp);
  const floor = LEVEL_XP_THRESHOLDS[level] ?? 0;
  const next = level < MAX_LEVEL ? LEVEL_XP_THRESHOLDS[level + 1] : null;
  if (next === null) {
    return {
      level,
      currentXp: safeXp,
      levelFloorXp: floor,
      nextLevelXp: null,
      progressInLevel: safeXp - floor,
      neededInLevel: 0,
      percent: 100,
    };
  }
  const needed = Math.max(1, next - floor);
  const gained = Math.max(0, safeXp - floor);
  return {
    level,
    currentXp: safeXp,
    levelFloorXp: floor,
    nextLevelXp: next,
    progressInLevel: gained,
    neededInLevel: needed,
    percent: Math.min(100, Math.round((gained / needed) * 100)),
  };
}

export interface CitizenTitleDef {
  id: string;
  label: string;
  requirement: string;
}

export const CITIZEN_TITLES: CitizenTitleDef[] = [
  {id: 'title_new_arrival', label: 'New Arrival', requirement: 'Default resident title'},
  {id: 'title_explorer', label: 'City Explorer', requirement: 'Reach Level 2 or tour all 5 districts'},
  {id: 'title_lucky_flipper', label: 'Fountain Lucky', requirement: 'Win a Fountain Coin Flip'},
  {id: 'title_arcade_ace', label: 'Arcade Ace', requirement: 'Score 120+ in any Arcade or Neon Memory'},
  {id: 'title_circuit_driver', label: 'Circuit Driver', requirement: 'Finish a Boulevard Racing Time Trial'},
  {id: 'title_city_legend', label: 'City Legend', requirement: 'Reach Level 5'},
  {id: 'title_beacon_hero', label: 'Beacon Hero', requirement: 'Complete The Starlight Beacon Story Quests'},
  {id: 'title_property_owner', label: 'Property Mogul', requirement: 'Purchase your first CHAOS CITY property'},
  {id: 'title_secret_hunter', label: 'Secret Hunter', requirement: 'Discover 3 hidden Secret Locations'},
  {id: 'title_skyline_climber', label: 'Skyline Climber', requirement: 'Discover the Skyline Rooftop Observatory'},
  {id: 'title_tunnel_runner', label: 'Tunnel Runner', requirement: 'Discover the Underground Maintenance Tunnel'},
  {id: 'title_tidepool', label: 'Tidepool Explorer', requirement: 'Discover the Pacific Tidepool Grotto'},
  {id: 'title_social_star', label: 'Social Star', requirement: 'Add a friend in CHAOS CITY'},
  {id: 'title_lead_gang_leader', label: 'Lead Gang Leader', requirement: 'Complete all 7 Mission House Story Campaign operations'},
];

export interface LevelMilestoneDef {
  level: number;
  rewardCoins: number;
  unlockItemId?: string;
  unlockTitle?: string;
  unlockBadge?: string;
  unlockVehicleModelId?: VehicleModelId;
  summary: string;
}

export const LEVEL_MILESTONES: LevelMilestoneDef[] = [
  {
    level: 2,
    rewardCoins: 30,
    unlockItemId: 'unlock_explorer_cap',
    unlockTitle: 'City Explorer',
    unlockBadge: 'badge_lv2',
    summary: '+30 Coins · Explorer Emerald Cap & "City Explorer" Title',
  },
  {
    level: 3,
    rewardCoins: 45,
    unlockItemId: 'unlock_racer_shoes',
    unlockBadge: 'badge_lv3',
    summary: '+45 Coins · Circuit Runner Sneakers & Citizen Badge',
  },
  {
    level: 4,
    rewardCoins: 60,
    unlockItemId: 'unlock_champion_shades',
    unlockBadge: 'badge_lv4',
    summary: '+60 Coins · Starlight Prism Visor',
  },
  {
    level: 5,
    rewardCoins: 90,
    unlockItemId: 'unlock_beacon_jacket',
    unlockTitle: 'City Legend',
    unlockBadge: 'badge_lv5',
    summary: '+90 Coins · Starlight Beacon Jacket & "City Legend" Title',
  },
  {
    level: 6,
    rewardCoins: 120,
    unlockTitle: 'Beacon Hero',
    unlockBadge: 'badge_lv6',
    unlockVehicleModelId: 'interceptor',
    summary: '+120 Coins · Starlight Interceptor Hypercar & "Beacon Hero"',
  },
];

// =========================================================================
// DAILY & WEEKLY DATE KEYS + RESETTABLE CHALLENGES
// =========================================================================

export function getDailyResetKey(nowMs = Date.now()): string {
  const d = new Date(nowMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getWeeklyResetKey(nowMs = Date.now()): string {
  const d = new Date(nowMs);
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export interface TimedChallengeGoalDef {
  id: string;
  period: 'daily' | 'weekly';
  title: string;
  description: string;
  statKey: string;
  goal: number;
  rewardCoins: number;
  rewardXp: number;
}

export const TIMED_ROTATING_CHALLENGES: TimedChallengeGoalDef[] = [
  {
    id: 'daily_activities_2',
    period: 'daily',
    title: 'Daily Active Citizen',
    description: 'Play 2 mini-games, sports challenges, or work shifts today.',
    statKey: 'activities',
    goal: 2,
    rewardCoins: 30,
    rewardXp: 45,
  },
  {
    id: 'daily_fountain_1',
    period: 'daily',
    title: 'Daily Fountain Wish',
    description: 'Flip a coin at any Central Park Fountain today.',
    statKey: 'coin_flips',
    goal: 1,
    rewardCoins: 20,
    rewardXp: 30,
  },
  {
    id: 'daily_delivery_1',
    period: 'daily',
    title: 'Daily Courier Run',
    description: 'Complete 1 Express Courier Delivery run today.',
    statKey: 'deliveries',
    goal: 1,
    rewardCoins: 35,
    rewardXp: 50,
  },
  {
    id: 'weekly_minigames_6',
    period: 'weekly',
    title: 'Weekly City Champion',
    description: 'Complete 6 mini-games across arcade, pond, courts, or tracks this week.',
    statKey: 'activities',
    goal: 6,
    rewardCoins: 90,
    rewardXp: 140,
  },
  {
    id: 'weekly_fish_3',
    period: 'weekly',
    title: 'Weekly Pond Angler',
    description: 'Catch 3 fish at Central Park Lily Pond this week.',
    statKey: 'fish',
    goal: 3,
    rewardCoins: 65,
    rewardXp: 100,
  },
];

// =========================================================================
// CATEGORIZED MISSIONS (Preserves all 10 original m_* IDs + expands categories)
// =========================================================================

export interface MissionTargetMarker {
  x: number;
  y: number;
  label: string;
  buildingId?: string;
}

export interface CategorizedMissionDef {
  id: string;
  category: MissionCategory;
  title: string;
  description: string;
  npcOrLocation: string;
  giverNpcId?: string;
  rewardCoins: number;
  rewardXp: number;
  unlockLabel?: string;
  goal: number;
  targetMarker: MissionTargetMarker;
  getProgress: (save: SaveDataV1) => number;
}

export const FULL_MISSIONS: CategorizedMissionDef[] = [
  // Preserved Prompt 07 Core Missions (exact m_* IDs!)
  {
    id: 'm_districts_5',
    category: 'exploration',
    title: 'Five-District Tour',
    description: 'Explore all 5 connected CHAOS CITY districts.',
    npcOrLocation: 'Clara · Central Park Crossroad',
    giverNpcId: 'npc_clara',
    rewardCoins: 45,
    rewardXp: 70,
    unlockLabel: '"City Explorer" Title',
    goal: 5,
    targetMarker: {x: 40.5 * TILE_SIZE, y: 15.8 * TILE_SIZE, label: 'Central Park Plaza'},
    getProgress: (s) => Math.min(5, s.missions.visitedDistricts.length),
  },
  {
    id: 'm_buildings_5',
    category: 'exploration',
    title: 'Open Doors',
    description: 'Step inside 5 different city buildings.',
    npcOrLocation: 'Eli · Shopping & Downtown',
    giverNpcId: 'npc_eli',
    rewardCoins: 35,
    rewardXp: 55,
    goal: 5,
    targetMarker: {x: 17.5 * TILE_SIZE, y: 37.4 * TILE_SIZE, label: 'Threadz Boutique', buildingId: 'b_clothing'},
    getProgress: (s) => Math.min(5, s.missions.visitedBuildings.length),
  },
  {
    id: 'm_visit_garage',
    category: 'driving',
    title: 'Grease & Gears',
    description: 'Visit Chaos Customs Garage in the Entertainment District.',
    npcOrLocation: 'Rex · Chaos Customs Garage',
    giverNpcId: 'npc_rex',
    rewardCoins: 25,
    rewardXp: 40,
    goal: 1,
    targetMarker: {x: 72.0 * TILE_SIZE, y: 36.0 * TILE_SIZE, label: 'Chaos Customs Garage', buildingId: 'b_garage'},
    getProgress: (s) => (s.missions.visitedBuildings.includes('b_garage') ? 1 : 0),
  },
  {
    id: 'm_customize_car',
    category: 'driving',
    title: 'Custom Whip',
    description: 'Customize paint, parts, or upgrades on any owned vehicle at the Garage.',
    npcOrLocation: 'Rex · Chaos Customs Garage',
    giverNpcId: 'npc_rex',
    rewardCoins: 40,
    rewardXp: 65,
    goal: 1,
    targetMarker: {x: 72.0 * TILE_SIZE, y: 36.0 * TILE_SIZE, label: 'Chaos Customs Garage', buildingId: 'b_garage'},
    getProgress: (s) => (s.missions.garageCustomized ? 1 : 0),
  },
  {
    id: 'm_spawn_car',
    category: 'driving',
    title: 'Instant Valet',
    description: 'Spawn a personal vehicle using your Smartphone Vehicle Spawner app.',
    npcOrLocation: 'Tomas · Smartphone Spawner',
    giverNpcId: 'npc_tomas',
    rewardCoins: 25,
    rewardXp: 40,
    goal: 1,
    targetMarker: {x: 34 * TILE_SIZE, y: 29 * TILE_SIZE, label: 'Boulevard Curb'},
    getProgress: (s) => (s.missions.vehicleSpawned ? 1 : 0),
  },
  {
    id: 'm_meet_npcs_5',
    category: 'npc',
    title: 'Neighborhood Regular',
    description: 'Meet and chat with 5 different CHAOS CITY residents.',
    npcOrLocation: 'Clara · Central Park',
    giverNpcId: 'npc_clara',
    rewardCoins: 35,
    rewardXp: 60,
    goal: 5,
    targetMarker: {x: 40.5 * TILE_SIZE, y: 17.5 * TILE_SIZE, label: 'Park Promenade'},
    getProgress: (s) => Math.min(5, (s.missions.metNpcs ?? []).length),
  },
  {
    id: 'm_first_buy',
    category: 'side',
    title: 'Local Supporter',
    description: 'Purchase an item from any boutique, cafe, market, or store.',
    npcOrLocation: 'Leo · Bean & Byte Cafe',
    giverNpcId: 'npc_leo',
    rewardCoins: 25,
    rewardXp: 40,
    goal: 1,
    targetMarker: {x: 6.5 * TILE_SIZE, y: 37.4 * TILE_SIZE, label: 'Bean & Byte Cafe', buildingId: 'b_cafe'},
    getProgress: (s) => Math.min(1, s.missions.itemsPurchased),
  },
  {
    id: 'm_sports_star',
    category: 'minigame',
    title: 'City Athlete',
    description: 'Play Streetball Shootout or Penalty Kick Challenge to completion.',
    npcOrLocation: 'Mateo · Eastside Sports Complex',
    giverNpcId: 'npc_mateo',
    rewardCoins: 35,
    rewardXp: 60,
    goal: 1,
    targetMarker: {x: 63.5 * TILE_SIZE, y: 40.5 * TILE_SIZE, label: 'Eastside Streetball Court'},
    getProgress: (s) =>
      s.missions.completedIds.includes('mission_soccer_match') ||
      (s.arcadeHighScores.streetball ?? 0) > 0
        ? 1
        : 0,
  },
  {
    id: 'm_activities_3',
    category: 'minigame',
    title: 'Active Resident',
    description: 'Complete 3 city activities, mini-games, or arcade runs.',
    npcOrLocation: 'Zoe · Pixel Palace Arcade',
    giverNpcId: 'npc_zoe',
    rewardCoins: 50,
    rewardXp: 80,
    goal: 3,
    targetMarker: {x: 46.5 * TILE_SIZE, y: 37.4 * TILE_SIZE, label: 'Pixel Palace Arcade', buildingId: 'b_arcade'},
    getProgress: (s) => Math.min(3, s.missions.activitiesCompleted),
  },
  {
    id: 'm_collect_2_cars',
    category: 'driving',
    title: 'Fleet Builder',
    description: 'Own at least 2 vehicles in your personal garage.',
    npcOrLocation: 'Rex · Garage Showroom',
    giverNpcId: 'npc_rex',
    rewardCoins: 60,
    rewardXp: 90,
    goal: 2,
    targetMarker: {x: 72.0 * TILE_SIZE, y: 36.0 * TILE_SIZE, label: 'Chaos Customs Garage', buildingId: 'b_garage'},
    getProgress: (s) => Math.min(2, s.vehicles.length),
  },

  // New Prompt 08 Missions (Fountain, Fishing, Racing, Park Challenge, Delivery, Memory, Story)
  {
    id: 'm_fountain_flip',
    category: 'side',
    title: 'Fountain Fortune',
    description: 'Toss a coin and play the Fountain Coin Flip game at Central Park Fountain.',
    npcOrLocation: 'Clara · Central Park Fountain',
    giverNpcId: 'npc_clara',
    rewardCoins: 30,
    rewardXp: 55,
    unlockLabel: 'Lucky Fountain Medallion',
    goal: 1,
    targetMarker: {x: 40.5 * TILE_SIZE, y: 15.8 * TILE_SIZE, label: 'Central Park Fountain'},
    getProgress: (s) => Math.min(1, s.miniGameRecords.fountainFlipsPlayed),
  },
  {
    id: 'm_lily_pond_angler',
    category: 'minigame',
    title: 'Lily Pond Angler',
    description: 'Cast your line at the Central Park Lily Pond Pier and reel in 2 catches.',
    npcOrLocation: 'Clara · Lily Pond South Pier',
    giverNpcId: 'npc_clara',
    rewardCoins: 45,
    rewardXp: 75,
    goal: 2,
    targetMarker: {x: 45.5 * TILE_SIZE, y: 9.4 * TILE_SIZE, label: 'Lily Pond Fishing Pier'},
    getProgress: (s) => Math.min(2, s.miniGameRecords.fishCaught),
  },
  {
    id: 'm_boulevard_trial',
    category: 'driving',
    title: 'Boulevard Time Trial',
    description: 'Finish the Chaos City Boulevard Racing Time Trial checkpoint circuit.',
    npcOrLocation: 'Tomas · South Park Blvd Start Arch',
    giverNpcId: 'npc_tomas',
    rewardCoins: 65,
    rewardXp: 95,
    unlockLabel: '"Circuit Driver" Title',
    goal: 1,
    targetMarker: {x: 32.5 * TILE_SIZE, y: 26.2 * TILE_SIZE, label: 'Racing Time Trial Start'},
    getProgress: (s) => Math.min(1, s.miniGameRecords.racesCompleted),
  },
  {
    id: 'm_park_sprint',
    category: 'minigame',
    title: 'Park Agility Runner',
    description: 'Clear the Central Park Agility Sprint gates before the clock runs out.',
    npcOrLocation: 'Priya · Central Park South Gate',
    giverNpcId: 'npc_priya',
    rewardCoins: 40,
    rewardXp: 65,
    goal: 1,
    targetMarker: {x: 40.5 * TILE_SIZE, y: 21.5 * TILE_SIZE, label: 'Park Agility Sprint'},
    getProgress: (s) => Math.min(1, s.miniGameRecords.parkSprintsCompleted),
  },
  {
    id: 'm_express_courier',
    category: 'delivery',
    title: 'Express City Courier',
    description: 'Pick up a parcel at Downtown Courier Desk and complete 2 timed deliveries.',
    npcOrLocation: 'Maya · Downtown Express Desk',
    giverNpcId: 'npc_maya',
    rewardCoins: 70,
    rewardXp: 100,
    goal: 2,
    targetMarker: {x: 19.2 * TILE_SIZE, y: 24.6 * TILE_SIZE, label: 'Downtown Courier Desk'},
    getProgress: (s) => Math.min(2, s.miniGameRecords.deliveriesCompleted),
  },
  {
    id: 'm_neon_memory',
    category: 'minigame',
    title: 'Neon Reflex & Memory',
    description: 'Clear Stage 3 or higher at the Entertainment Plaza Memory Kiosk.',
    npcOrLocation: 'Zoe · Entertainment Plaza Kiosk',
    giverNpcId: 'npc_zoe',
    rewardCoins: 45,
    rewardXp: 75,
    goal: 1,
    targetMarker: {x: 54.5 * TILE_SIZE, y: 37.5 * TILE_SIZE, label: 'Neon Memory Kiosk'},
    getProgress: (s) => Math.min(1, s.miniGameRecords.memoryGamesWon),
  },
  {
    id: 'm_story_finale',
    category: 'story',
    title: 'The Starlight Beacon',
    description: 'Complete all 5 Story Quests chapters to light the Skyline Beacon.',
    npcOrLocation: 'Clara · Story Quests',
    giverNpcId: 'npc_clara',
    rewardCoins: 100,
    rewardXp: 150,
    unlockLabel: 'Starlight Interceptor + Jacket',
    goal: 5,
    targetMarker: {x: 20.5 * TILE_SIZE, y: 11.4 * TILE_SIZE, label: 'Skyline Commerce Tower', buildingId: 'b_dt_tower_2'},
    getProgress: (s) => Math.min(5, s.story.completedChapters.length),
  },
  // Prompt 09 Open-World Expansion Missions
  {
    id: 'm_districts_11',
    category: 'exploration',
    title: 'Grand Metropolitan Odyssey',
    description: 'Visit all 11 districts across the expanded Chaos City map.',
    npcOrLocation: 'Capt. Skye · Starlight Airport',
    giverNpcId: 'npc_capt_skye',
    rewardCoins: 140,
    rewardXp: 180,
    goal: 11,
    targetMarker: {x: 132.0 * TILE_SIZE, y: 26.2 * TILE_SIZE, label: 'Starlight Airport'},
    getProgress: (s) => Math.min(11, s.missions.visitedDistricts.length),
  },
  {
    id: 'm_shards_5',
    category: 'exploration',
    title: 'Starlight Shard Hunter',
    description: 'Discover and collect 5 hidden Starlight Shards scattered across the world.',
    npcOrLocation: 'Koa · Pacific Coastline',
    giverNpcId: 'npc_koa',
    rewardCoins: 95,
    rewardXp: 130,
    goal: 5,
    targetMarker: {x: 146.0 * TILE_SIZE, y: 68.0 * TILE_SIZE, label: 'Pacific Coastline'},
    getProgress: (s) => Math.min(5, (s.collectedIds ?? []).length),
  },
  {
    id: 'm_highway_vehicles',
    category: 'driving',
    title: 'Expressway Garage',
    description: 'Own 3 or more vehicles in your personal fleet.',
    npcOrLocation: 'Victoria · Apex Prestige Motors',
    giverNpcId: 'npc_victoria',
    rewardCoins: 90,
    rewardXp: 120,
    goal: 3,
    targetMarker: {x: 92.0 * TILE_SIZE, y: 22.0 * TILE_SIZE, label: 'Apex Prestige Motors', buildingId: 'b_dealership'},
    getProgress: (s) => Math.min(3, s.vehicles.length),
  },
];

export type NpcQuestMarkerState = 'ready' | 'available' | 'active' | null;

export function getNpcMissions(npcId: string): CategorizedMissionDef[] {
  return FULL_MISSIONS.filter((m) => m.giverNpcId === npcId);
}

export function getNpcMissionOfferState(npcId: string, save: SaveDataV1): NpcQuestMarkerState {
  const list = getNpcMissions(npcId);
  if (list.length === 0) return null;
  const accepted = new Set(save.missions.acceptedIds ?? []);
  const activeId = save.missions.activeMissionId;
  let hasActive = false;
  let hasAvailable = false;

  for (const m of list) {
    const claimed = save.claimedRewards.includes(`mission_reward_${m.id}`);
    if (claimed) continue;
    if (m.getProgress(save) >= m.goal) {
      return 'ready';
    }
    if (accepted.has(m.id) || activeId === m.id) {
      hasActive = true;
    } else {
      hasAvailable = true;
    }
  }
  if (hasAvailable) return 'available';
  if (hasActive) return 'active';
  return null;
}

// =========================================================================
// EXPANDED ACHIEVEMENTS (12 Total, preserves first 5 IDs)
// =========================================================================

export interface ExpandedAchievementDef {
  id: string;
  title: string;
  description: string;
  goal: number;
  getProgress: (save: SaveDataV1) => number;
}

export const EXPANDED_ACHIEVEMENTS: ExpandedAchievementDef[] = [
  {
    id: 'ach_explorer_5',
    title: 'City Explorer',
    description: 'Visit all 5 connected districts in CHAOS CITY.',
    goal: 5,
    getProgress: (s) => Math.min(5, s.missions.visitedDistricts.length),
  },
  {
    id: 'ach_open_doors',
    title: 'Open Doors',
    description: 'Step inside 5 different city buildings.',
    goal: 5,
    getProgress: (s) => Math.min(5, s.missions.visitedBuildings.length),
  },
  {
    id: 'ach_first_purchase',
    title: 'First Purchase',
    description: 'Buy your first item from any local shop.',
    goal: 1,
    getProgress: (s) => Math.min(1, s.missions.itemsPurchased),
  },
  {
    id: 'ach_style_collector',
    title: 'Threadz Collector',
    description: 'Own at least 3 wearable clothing pieces.',
    goal: 3,
    getProgress: (s) => Math.min(3, s.achievements.stats.ownedClothingCount ?? 0),
  },
  {
    id: 'ach_busy_resident',
    title: 'Busy Resident',
    description: 'Complete 3 city activities or arcade games.',
    goal: 3,
    getProgress: (s) => Math.min(3, s.missions.activitiesCompleted),
  },
  {
    id: 'ach_fountain_luck',
    title: 'Lucky Wishmaker',
    description: 'Win a Fountain Coin Flip prediction.',
    goal: 1,
    getProgress: (s) => Math.min(1, s.miniGameRecords.fountainFlipsWon),
  },
  {
    id: 'ach_angler',
    title: 'Park Angler',
    description: 'Catch 3 fish from the Central Park Lily Pond.',
    goal: 3,
    getProgress: (s) => Math.min(3, s.miniGameRecords.fishCaught),
  },
  {
    id: 'ach_courier_pro',
    title: 'Dash Courier',
    description: 'Complete 2 Express Courier timed deliveries.',
    goal: 2,
    getProgress: (s) => Math.min(2, s.miniGameRecords.deliveriesCompleted),
  },
  {
    id: 'ach_circuit_racer',
    title: 'Apex Time Trialist',
    description: 'Complete a Boulevard Racing Time Trial lap.',
    goal: 1,
    getProgress: (s) => Math.min(1, s.miniGameRecords.racesCompleted),
  },
  {
    id: 'ach_memory_master',
    title: 'Neon Savant',
    description: 'Reach Round 4 or win a Neon Memory Challenge.',
    goal: 1,
    getProgress: (s) =>
      s.miniGameRecords.memoryGamesWon >= 1 || s.miniGameRecords.bestMemoryRound >= 4 ? 1 : 0,
  },
  {
    id: 'ach_level_5',
    title: 'Prominent Citizen',
    description: 'Reach Citizen Level 5 through XP progression.',
    goal: 5,
    getProgress: (s) => Math.min(5, s.progression.level),
  },
  {
    id: 'ach_story_beacon',
    title: 'Keeper of the Beacon',
    description: 'Complete all 5 chapters of The Starlight Beacon.',
    goal: 5,
    getProgress: (s) => Math.min(5, s.story.completedChapters.length),
  },
  {
    id: 'ach_grand_explorer',
    title: 'Grand Odyssey',
    description: 'Explore 10+ districts across the expanded world.',
    goal: 10,
    getProgress: (s) => Math.min(10, s.missions.visitedDistricts.length),
  },
  {
    id: 'ach_shard_collector',
    title: 'Shard Seeker',
    description: 'Collect 8 hidden Starlight Shards across Chaos City.',
    goal: 8,
    getProgress: (s) => Math.min(8, (s.collectedIds ?? []).length),
  },
  {
    id: 'ach_property_owner',
    title: 'Homeowner Key',
    description: 'Purchase an apartment, house, or villa in CHAOS CITY.',
    goal: 1,
    getProgress: (s) => Math.min(1, (s.ownedProperties ?? []).length),
  },
  {
    id: 'ach_secret_finder',
    title: 'Urban Explorer',
    description: 'Discover 3 hidden Secret Locations across CHAOS CITY.',
    goal: 3,
    getProgress: (s) => Math.min(3, (s.discoveredSecrets ?? []).length),
  },
  {
    id: 'ach_relic_curator',
    title: 'Relic Curator',
    description: 'Recover 6 rare collectibles & city relics.',
    goal: 6,
    getProgress: (s) => Math.min(6, (s.collectibles ?? []).length),
  },
  {
    id: 'ach_social_friend',
    title: 'City Circle',
    description: 'Add a real friend to your CHAOS CITY Friends List.',
    goal: 1,
    getProgress: (s) => Math.min(1, s.friendCount ?? 0),
  },
  {
    id: 'ach_level_8',
    title: 'Metropolis Icon',
    description: 'Reach Citizen Level 8 through missions, exploration, and activities.',
    goal: 8,
    getProgress: (s) => Math.min(8, s.progression.level),
  },
  {
    id: 'ach_lead_gang_leader',
    title: 'Lead Gang Leader',
    description: 'Complete all 7 Mission House Story Campaign operations in Story Mode.',
    goal: 1,
    getProgress: (s) => (s.story.campaignCompleted ? 1 : 0),
  },
];

// =========================================================================
// OPTIONAL STORY MODE ("THE STARLIGHT BEACON" — 5 Chapters)
// =========================================================================

export interface StoryCutsceneLine {
  speaker: string;
  role: string;
  line: string;
  portraitId?: string;
}

export interface StoryChapterDef {
  chapter: number;
  title: string;
  subtitle: string;
  synopsis: string;
  objectiveText: string;
  targetMarker: MissionTargetMarker;
  rewardCoins: number;
  rewardXp: number;
  rewardSummary: string;
  unlockItemId?: string;
  unlockVehicleModelId?: VehicleModelId;
  unlockTitle?: string;
  introDialogue: StoryCutsceneLine[];
  outroDialogue: StoryCutsceneLine[];
  isObjectiveMet: (save: SaveDataV1) => boolean;
}

export const STORY_CHAPTERS: StoryChapterDef[] = [
  {
    chapter: 1,
    title: 'Chapter 1 · The Unlit Beacon',
    subtitle: 'Central Park Fountain & Wishing Coin',
    synopsis:
      'Clara, Chaos City’s park botanist, noticed the old rooftop Starlight Beacon above Skyline Tower stopped pulsing last night. Rumor says the calibration coin was dropped in the Central Park Fountain.',
    objectiveText: 'Play 1 Fountain Coin Flip at Central Park Fountain.',
    targetMarker: {x: 40.5 * TILE_SIZE, y: 15.8 * TILE_SIZE, label: 'Central Park Fountain'},
    rewardCoins: 40,
    rewardXp: 65,
    rewardSummary: '+40 Coins · +65 XP · Fountain Coin Keepsake',
    introDialogue: [
      {
        speaker: 'Clara',
        role: 'Park Botanist',
        portraitId: 'park_ranger',
        line: 'Hey! Good timing. The Starlight Beacon on Skyline Tower dimmed right before dawn.',
      },
      {
        speaker: 'Clara',
        role: 'Park Botanist',
        portraitId: 'park_ranger',
        line: 'Toss a coin into the Central Fountain—if the resonance ripples wake up, we can trace the frequency to Chaos Customs!',
      },
    ],
    outroDialogue: [
      {
        speaker: 'Clara',
        role: 'Park Botanist',
        portraitId: 'park_ranger',
        line: 'Did you hear that chime? The copper ripple echoed straight east toward Entertainment Blvd!',
      },
    ],
    isObjectiveMet: (s) => s.miniGameRecords.fountainFlipsPlayed >= 1,
  },
  {
    chapter: 2,
    title: 'Chapter 2 · Tuning the Transmitter',
    subtitle: 'Chaos Customs Garage',
    synopsis:
      'Head to Chaos Customs Garage in the Entertainment District. Rex can tune your ride and build a portable beacon relay from spare performance parts.',
    objectiveText: 'Enter Chaos Customs Garage OR customize a vehicle.',
    targetMarker: {x: 72.0 * TILE_SIZE, y: 36.0 * TILE_SIZE, label: 'Chaos Customs Garage', buildingId: 'b_garage'},
    rewardCoins: 55,
    rewardXp: 85,
    rewardSummary: '+55 Coins · +85 XP',
    introDialogue: [
      {
        speaker: 'Rex',
        role: 'Master Mechanic',
        portraitId: 'street_explorer',
        line: 'Clara radioed ahead! You need an alternator relay strong enough to punch a beam across five districts.',
      },
      {
        speaker: 'Rex',
        role: 'Master Mechanic',
        portraitId: 'street_explorer',
        line: 'Step inside Chaos Customs Garage or tune your active ride so I can calibrate the transmitter coil.',
      },
    ],
    outroDialogue: [
      {
        speaker: 'Rex',
        role: 'Master Mechanic',
        portraitId: 'street_explorer',
        line: 'Solid! That coil is humming clean. Next stop is Pixel Palace—Zoe has the high-voltage memory capacitor.',
      },
    ],
    isObjectiveMet: (s) =>
      s.missions.visitedBuildings.includes('b_garage') || s.missions.garageCustomized,
  },
  {
    chapter: 3,
    title: 'Chapter 3 · Neon Frequency Lock',
    subtitle: 'Pixel Palace & Plaza Kiosk',
    synopsis:
      'Sync the beacon prism pattern by visiting Pixel Palace Arcade or winning a round at the Neon Memory Kiosk in Entertainment Plaza.',
    objectiveText: 'Play an Arcade Cabinet OR clear Neon Memory Kiosk.',
    targetMarker: {x: 46.5 * TILE_SIZE, y: 37.4 * TILE_SIZE, label: 'Pixel Palace Arcade', buildingId: 'b_arcade'},
    rewardCoins: 70,
    rewardXp: 110,
    rewardSummary: '+70 Coins · +110 XP',
    introDialogue: [
      {
        speaker: 'Zoe',
        role: 'Arcade Champion',
        portraitId: 'arcade_ace',
        line: 'To unlock the beacon’s frequency matrix, you have to prove your reflexes on the Neon Grid!',
      },
    ],
    outroDialogue: [
      {
        speaker: 'Zoe',
        role: 'Arcade Champion',
        portraitId: 'arcade_ace',
        line: 'Clean sequence! The beacon frequency is locked in—now we just need the optical crystal.',
      },
    ],
    isObjectiveMet: (s) =>
      s.miniGameRecords.memoryGamesWon >= 1 ||
      (s.arcadeHighScores.starlight_drift ?? 0) > 0 ||
      (s.arcadeHighScores.brick_blitz ?? 0) > 0 ||
      s.missions.visitedBuildings.includes('b_arcade'),
  },
  {
    chapter: 4,
    title: 'Chapter 4 · Express Delivery & Pond Crystal',
    subtitle: 'Downtown Courier Desk or Lily Pond',
    synopsis:
      'Get the optical lens delivered across town or recover a Starlight scale from the Central Park Lily Pond to finish the prism.',
    objectiveText: 'Complete 1 Courier Delivery OR catch 1 fish at the Lily Pond.',
    targetMarker: {x: 19.2 * TILE_SIZE, y: 24.6 * TILE_SIZE, label: 'Downtown Courier Desk'},
    rewardCoins: 85,
    rewardXp: 135,
    rewardSummary: '+85 Coins · +135 XP',
    introDialogue: [
      {
        speaker: 'Maya',
        role: 'City Dispatcher',
        portraitId: 'sunset_skater',
        line: 'We have the backup optical prism ready at Downtown Courier Desk—or snag a shimmering prism catch at the Lily Pond!',
      },
    ],
    outroDialogue: [
      {
        speaker: 'Maya',
        role: 'City Dispatcher',
        portraitId: 'sunset_skater',
        line: 'Everything is assembled! Meet everyone at Skyline Commerce Office to ignite the Starlight Beacon.',
      },
    ],
    isObjectiveMet: (s) =>
      s.miniGameRecords.deliveriesCompleted >= 1 || s.miniGameRecords.fishCaught >= 1,
  },
  {
    chapter: 5,
    title: 'Chapter 5 · Starlight Over Chaos City',
    subtitle: 'Skyline Commerce Tower Finale',
    synopsis:
      'Step inside Skyline Commerce Office (or Starlight Cinema) to activate the city-wide Starlight Beacon and unlock your hero rewards!',
    objectiveText: 'Enter Skyline Commerce Office OR complete a Boulevard Race Lap.',
    targetMarker: {x: 20.5 * TILE_SIZE, y: 11.4 * TILE_SIZE, label: 'Skyline Commerce Tower', buildingId: 'b_dt_tower_2'},
    rewardCoins: 150,
    rewardXp: 200,
    rewardSummary: '+150 Coins · +200 XP · Starlight Beacon Jacket & Starlight Interceptor Car',
    unlockItemId: 'unlock_beacon_jacket',
    unlockVehicleModelId: 'interceptor',
    unlockTitle: 'Beacon Hero',
    introDialogue: [
      {
        speaker: 'Clara',
        role: 'Park Botanist',
        portraitId: 'park_ranger',
        line: 'All five districts are watching! Head inside Skyline Commerce Office—or run a victory lap on the Boulevard circuit.',
      },
    ],
    outroDialogue: [
      {
        speaker: 'Rex & Clara',
        role: 'Chaos City Crew',
        portraitId: 'street_explorer',
        line: 'The Starlight Beacon is blazing across the skyline! Take the keys to the custom Starlight Interceptor—you earned it, Beacon Hero!',
      },
    ],
    isObjectiveMet: (s) =>
      s.missions.visitedBuildings.includes('b_dt_tower_2') ||
      s.missions.visitedBuildings.includes('b_cinema') ||
      s.miniGameRecords.racesCompleted >= 1,
  },
];

// =========================================================================
// PLAYABLE MINI-GAMES CATALOG (10 Real Games Across Chaos City)
// =========================================================================

export interface MiniGameCatalogEntry {
  id:
    | 'fountain_flip'
    | 'fishing_pond'
    | 'streetball'
    | 'soccer_penalty'
    | 'starlight_drift'
    | 'brick_blitz'
    | 'turbo_lane_racer'
    | 'hoop_frenzy'
    | 'reflex_surge'
    | 'prism_match'
    | 'memory_matrix'
    | 'race_trial'
    | 'park_sprint'
    | 'courier_delivery'
    | 'neon_memory';
  name: string;
  category: 'Luck & Cutscene' | 'Sports' | 'Arcade' | 'Time Trial' | 'Fishing' | 'Brain & Reflex';
  locationName: string;
  description: string;
  rewardText: string;
  worldX: number;
  worldY: number;
  getBestLabel: (save: SaveDataV1) => string;
}

export const MINI_GAMES_CATALOG: MiniGameCatalogEntry[] = [
  {
    id: 'fountain_flip',
    name: 'Fountain Coin Flip',
    category: 'Luck & Cutscene',
    locationName: 'Central Park Fountain',
    description:
      'Pick Heads or Tails in a close-up 2D cutscene at the fountain! Call the coin right for bonus Coins, XP & lucky medallion.',
    rewardText: '+18–25 Coins & +30 XP',
    worldX: 40.5 * TILE_SIZE,
    worldY: 15.8 * TILE_SIZE,
    getBestLabel: (s) => `${s.miniGameRecords.fountainFlipsWon}/${s.miniGameRecords.fountainFlipsPlayed} Won`,
  },
  {
    id: 'fishing_pond',
    name: 'Lily Pond Fishing',
    category: 'Fishing',
    locationName: 'Central Park Lily Pond Pier',
    description:
      'Cast your bobber onto the pond, watch for ripples, and tap REEL NOW during the bite window to catch rare koi & carp!',
    rewardText: '+14–45 Coins & +35 XP',
    worldX: 45.5 * TILE_SIZE,
    worldY: 9.4 * TILE_SIZE,
    getBestLabel: (s) =>
      s.miniGameRecords.fishCaught > 0
        ? `Best: ${s.miniGameRecords.bestFishWeightKg.toFixed(1)} kg (${s.miniGameRecords.fishCaught} caught)`
        : 'No catches yet',
  },
  {
    id: 'streetball',
    name: 'Streetball Shootout',
    category: 'Sports',
    locationName: 'Eastside Streetball Court',
    description: 'Position your player & time the shot meter in the green sweet spot for 30 seconds of swishes & streaks.',
    rewardText: '+12–40 Coins & +30 XP',
    worldX: 63.5 * TILE_SIZE,
    worldY: 40.5 * TILE_SIZE,
    getBestLabel: (s) => `Best: ${s.arcadeHighScores.streetball ?? 0} pts`,
  },
  {
    id: 'soccer_penalty',
    name: 'Football Penalty Shootout',
    category: 'Sports',
    locationName: 'Eastside Soccer Pitch',
    description: 'Move your striker, aim left/center/right across 5 kicks, and outsmart the diving goalkeeper.',
    rewardText: '+15–45 Coins & +35 XP',
    worldX: 73.5 * TILE_SIZE,
    worldY: 43.5 * TILE_SIZE,
    getBestLabel: (s) =>
      s.missions.completedIds.includes('mission_soccer_match') ? 'Shootout Won!' : 'Ready to Kick Off',
  },
  {
    id: 'starlight_drift',
    name: 'Starlight Drift (Space Arcade)',
    category: 'Arcade',
    locationName: 'Pixel Palace Arcade',
    description: 'Pilot your pixel starfighter through falling gold stars while dodging red meteors.',
    rewardText: '+8–45 Coins & +30 XP',
    worldX: 46.5 * TILE_SIZE,
    worldY: 37.4 * TILE_SIZE,
    getBestLabel: (s) => `Best: ${s.arcadeHighScores.starlight_drift ?? 0} pts`,
  },
  {
    id: 'brick_blitz',
    name: 'Brick Blitz (Arcade)',
    category: 'Arcade',
    locationName: 'Pixel Palace Arcade',
    description: 'Deflect the plasma ball to shatter every neon brick wall across multiple rows.',
    rewardText: '+8–45 Coins & +30 XP',
    worldX: 46.5 * TILE_SIZE,
    worldY: 37.4 * TILE_SIZE,
    getBestLabel: (s) => `Best: ${s.arcadeHighScores.brick_blitz ?? 0} pts`,
  },
  {
    id: 'turbo_lane_racer',
    name: 'Turbo Lane Racer (Racing Arcade)',
    category: 'Arcade',
    locationName: 'Pixel Palace Arcade',
    description: 'Steer across 3 expressway lanes, dodge highway traffic, collect turbo boosts & build speed.',
    rewardText: '+10–50 Coins & +35 XP',
    worldX: 46.5 * TILE_SIZE,
    worldY: 37.4 * TILE_SIZE,
    getBestLabel: (s) => `Best: ${s.arcadeHighScores.turbo_lane_racer ?? 0} pts`,
  },
  {
    id: 'hoop_frenzy',
    name: 'Hoop Frenzy (Basketball Arcade)',
    category: 'Arcade',
    locationName: 'Pixel Palace Arcade',
    description: 'Slide along the baseline with your customized character and drain moving arcade hoops!',
    rewardText: '+10–45 Coins & +30 XP',
    worldX: 46.5 * TILE_SIZE,
    worldY: 37.4 * TILE_SIZE,
    getBestLabel: (s) => `Best: ${s.arcadeHighScores.hoop_frenzy ?? 0} pts`,
  },
  {
    id: 'reflex_surge',
    name: 'Reflex Surge (Reaction Arcade)',
    category: 'Arcade',
    locationName: 'Pixel Palace Arcade',
    description: 'Strike flashing neon targets before they decay to rack up millisecond combo streaks.',
    rewardText: '+10–45 Coins & +30 XP',
    worldX: 46.5 * TILE_SIZE,
    worldY: 37.4 * TILE_SIZE,
    getBestLabel: (s) => `Best: ${s.arcadeHighScores.reflex_surge ?? 0} pts`,
  },
  {
    id: 'prism_match',
    name: 'Prism Grid (Puzzle Arcade)',
    category: 'Arcade',
    locationName: 'Pixel Palace Arcade',
    description: 'Slide your cursor across the 4x4 neon circuit puzzle and illuminate all nodes cleanly.',
    rewardText: '+12–50 Coins & +35 XP',
    worldX: 46.5 * TILE_SIZE,
    worldY: 37.4 * TILE_SIZE,
    getBestLabel: (s) => `Best: ${s.arcadeHighScores.prism_match ?? 0} pts`,
  },
  {
    id: 'memory_matrix',
    name: 'Memory Matrix (Arcade)',
    category: 'Arcade',
    locationName: 'Pixel Palace Arcade',
    description: 'Memorize 3x3 cyber matrix tiles as they flash and reconstruct each escalating pattern.',
    rewardText: '+12–48 Coins & +35 XP',
    worldX: 46.5 * TILE_SIZE,
    worldY: 37.4 * TILE_SIZE,
    getBestLabel: (s) => `Best: ${s.arcadeHighScores.memory_matrix ?? 0} pts`,
  },
  {
    id: 'race_trial',
    name: 'Boulevard Racing Time Trial',
    category: 'Time Trial',
    locationName: 'Park South Blvd Start Arch',
    description:
      'Drive through 4 glowing street checkpoints around the Central Park & Entertainment loop before the 55s clock expires!',
    rewardText: '+45–65 Coins & +60 XP',
    worldX: 32.5 * TILE_SIZE,
    worldY: 26.2 * TILE_SIZE,
    getBestLabel: (s) =>
      s.miniGameRecords.bestRaceSec > 0 ? `Best Lap: ${s.miniGameRecords.bestRaceSec.toFixed(1)}s` : 'Unset',
  },
  {
    id: 'park_sprint',
    name: 'Park Agility Sprint',
    category: 'Time Trial',
    locationName: 'Central Park South Gate',
    description: 'Sprint through 4 cobblestone checkpoint rings around Central Park within 40 seconds.',
    rewardText: '+30–45 Coins & +45 XP',
    worldX: 40.5 * TILE_SIZE,
    worldY: 21.5 * TILE_SIZE,
    getBestLabel: (s) =>
      s.miniGameRecords.bestSprintSec > 0 ? `Best: ${s.miniGameRecords.bestSprintSec.toFixed(1)}s` : 'Unset',
  },
  {
    id: 'courier_delivery',
    name: 'Express Courier Delivery',
    category: 'Time Trial',
    locationName: 'Downtown Express Desk',
    description: 'Grab a priority city parcel and race on foot or by car to a live destination storefront within 50s!',
    rewardText: '+40–60 Coins & +55 XP',
    worldX: 19.2 * TILE_SIZE,
    worldY: 24.6 * TILE_SIZE,
    getBestLabel: (s) => `${s.miniGameRecords.deliveriesCompleted} Delivered`,
  },
  {
    id: 'neon_memory',
    name: 'Neon Memory & Reflex Arena',
    category: 'Brain & Reflex',
    locationName: 'Entertainment Plaza Kiosk',
    description:
      'Watch the 4-pad neon sequence light up and repeat each growing pattern cleanly across 5 escalating rounds!',
    rewardText: '+18–48 Coins & +40 XP',
    worldX: 54.5 * TILE_SIZE,
    worldY: 37.5 * TILE_SIZE,
    getBestLabel: (s) =>
      s.miniGameRecords.bestMemoryRound > 0
        ? `Round ${s.miniGameRecords.bestMemoryRound} (${s.miniGameRecords.memoryGamesWon} Clears)`
        : 'Round 0',
  },
];

// =========================================================================
// STORY MODE MAIN CAMPAIGN — THE MISSION HOUSE & THE MISSION MAN (7 STAGES)
// =========================================================================

export const MISSION_HOUSE_COORDS = {
  x: 13.5 * TILE_SIZE,
  y: 24.4 * TILE_SIZE,
  label: 'The Mission House (Downtown)',
  buildingId: 'b_mission_house',
};

export interface StoryAllianceOption {
  id: 'civic_alliance' | 'street_syndicate';
  title: string;
  subtitle: string;
  description: string;
}

export const STORY_ALLIANCE_CHOICES: StoryAllianceOption[] = [
  {
    id: 'civic_alliance',
    title: 'Civic Coalition',
    subtitle: 'Shield the Districts',
    description:
      'Channel Chaos City’s underworld channels into neighborhood protection, clean trade, and civic stability.',
  },
  {
    id: 'street_syndicate',
    title: 'Neon Syndicate',
    subtitle: 'Seize the Streets',
    description:
      'Unite the crews under unchallenged street authority—high stakes, fast cars, and absolute turf control.',
  },
];

export interface StoryCampaignMissionDef {
  id: string;
  stage: number;
  title: string;
  subtitle: string;
  briefingQuote: string;
  objectiveText: string;
  turnInHint: string;
  rewardCoins: number;
  rewardXp: number;
  requiresChoice?: boolean;
  isFinale?: boolean;
  targetMarker: MissionTargetMarker;
  evaluateProgress: (
    save: SaveDataV1,
    baseline: NonNullable<SaveDataV1['story']['missionBaseline']>,
  ) => {cur: number; goal: number; detail: string};
}

export function captureStoryMissionBaseline(
  save: SaveDataV1,
): NonNullable<SaveDataV1['story']['missionBaseline']> {
  return {
    districts: save.missions.visitedDistricts.length,
    buildings: save.missions.visitedBuildings.length,
    itemsPurchased: save.missions.itemsPurchased,
    activitiesCompleted: save.missions.activitiesCompleted,
    deliveriesCompleted: save.miniGameRecords.deliveriesCompleted,
    racesCompleted: save.miniGameRecords.racesCompleted,
    shardsCollected: (save.collectedIds ?? []).length,
    secretsDiscovered: (save.discoveredSecrets ?? []).length,
  };
}

export const STORY_CAMPAIGN_MISSIONS: StoryCampaignMissionDef[] = [
  {
    id: 'sc_01_mission_house',
    stage: 1,
    title: 'Stage 1 · The First Briefing',
    subtitle: 'Downtown Initiation',
    briefingQuote:
      'Welcome to The Mission House, Kai. Every legend in Chaos City starts at this desk. Check your gear, confirm your dossier, and report back when you are ready for the streets.',
    objectiveText: 'Enter The Mission House in Downtown and report to The Mission Man.',
    turnInHint: 'Confirm initiation at The Mission Man’s Command Desk.',
    rewardCoins: 60,
    rewardXp: 80,
    targetMarker: MISSION_HOUSE_COORDS,
    evaluateProgress: () => ({
      cur: 1,
      goal: 1,
      detail: 'Present inside The Mission House — ready to confirm briefing',
    }),
  },
  {
    id: 'sc_02_city_recon',
    stage: 2,
    title: 'Stage 2 · Territory Recon',
    subtitle: 'District Eyes & Ears',
    briefingQuote:
      'You cannot lead a city you have not walked. Sweep through two new districts and step inside two buildings to map local turf, then bring me your intel.',
    objectiveText: 'Explore +2 districts AND enter +2 buildings beyond your briefing start.',
    turnInHint: 'Return to The Mission Man inside The Mission House.',
    rewardCoins: 80,
    rewardXp: 100,
    targetMarker: {x: 40.5 * TILE_SIZE, y: 15.8 * TILE_SIZE, label: 'Explore Central Park & City Buildings'},
    evaluateProgress: (s, b) => {
      const d = Math.max(0, s.missions.visitedDistricts.length - b.districts);
      const bld = Math.max(0, s.missions.visitedBuildings.length - b.buildings);
      const cur = Math.min(2, d) + Math.min(2, bld);
      return {
        cur,
        goal: 4,
        detail: `Districts +${Math.min(2, d)}/2 · Buildings +${Math.min(2, bld)}/2`,
      };
    },
  },
  {
    id: 'sc_03_gear_up',
    stage: 3,
    title: 'Stage 3 · Supply & Hustle',
    subtitle: 'Outfit & Street Cred',
    briefingQuote:
      'Next up: gear and proof of hustle. Pick up an item from any city shop or boutique, and finish one local activity—arcade, fishing, fountain, or sports.',
    objectiveText: 'Buy +1 shop item AND complete +1 city activity/mini-game.',
    turnInHint: 'Return to The Mission Man inside The Mission House.',
    rewardCoins: 100,
    rewardXp: 120,
    targetMarker: {x: 17.5 * TILE_SIZE, y: 37.4 * TILE_SIZE, label: 'Shopping & Entertainment Districts'},
    evaluateProgress: (s, b) => {
      const items = Math.max(0, s.missions.itemsPurchased - b.itemsPurchased);
      const acts = Math.max(0, s.missions.activitiesCompleted - b.activitiesCompleted);
      const cur = Math.min(1, items) + Math.min(1, acts);
      return {
        cur,
        goal: 2,
        detail: `Shop Item +${Math.min(1, items)}/1 · Activity +${Math.min(1, acts)}/1`,
      };
    },
  },
  {
    id: 'sc_04_speed_courier',
    stage: 4,
    title: 'Stage 4 · Express Proof',
    subtitle: 'Wheels & Precision',
    briefingQuote:
      'Speed separates runners from leaders. Complete either an Express Courier Delivery from Downtown Desk OR finish a Boulevard Racing Time Trial lap.',
    objectiveText: 'Complete +1 Express Delivery OR +1 Boulevard Race Time Trial.',
    turnInHint: 'Return to The Mission Man inside The Mission House.',
    rewardCoins: 120,
    rewardXp: 140,
    targetMarker: {x: 19.2 * TILE_SIZE, y: 24.6 * TILE_SIZE, label: 'Downtown Express Courier Desk'},
    evaluateProgress: (s, b) => {
      const deliv = Math.max(0, s.miniGameRecords.deliveriesCompleted - b.deliveriesCompleted);
      const races = Math.max(0, s.miniGameRecords.racesCompleted - b.racesCompleted);
      const cur = Math.min(1, deliv + races);
      return {
        cur,
        goal: 1,
        detail: `Timed Runs Completed: ${cur}/1 (Delivery or Boulevard Race)`,
      };
    },
  },
  {
    id: 'sc_05_alliance_choice',
    stage: 5,
    title: 'Stage 5 · Crossroads of Chaos City',
    subtitle: 'Factions & Intel',
    briefingQuote:
      'Two factions are watching your rise: the Civic Coalition and the Neon Syndicate. Declare your allegiance here, and secure either a Starlight Shard, Secret Portal, or fresh city activity.',
    objectiveText: 'Choose your faction allegiance AND complete +1 field feat (Shard, Secret, or Activity).',
    turnInHint: 'Pick your allegiance at The Mission Man’s desk and turn in the mission.',
    rewardCoins: 150,
    rewardXp: 180,
    requiresChoice: true,
    targetMarker: MISSION_HOUSE_COORDS,
    evaluateProgress: (s, b) => {
      const hasChoice = Boolean(s.story.choices?.factions_alliance);
      const shards = Math.max(0, (s.collectedIds ?? []).length - b.shardsCollected);
      const secrets = Math.max(0, (s.discoveredSecrets ?? []).length - b.secretsDiscovered);
      const acts = Math.max(0, s.missions.activitiesCompleted - b.activitiesCompleted);
      const fieldDone = Math.min(1, shards + secrets + acts);
      return {
        cur: (hasChoice ? 1 : 0) + fieldDone,
        goal: 2,
        detail: `Allegiance ${hasChoice ? 'Chosen (1/1)' : 'Pending (0/1)'} · Field Feat ${fieldDone}/1`,
      };
    },
  },
  {
    id: 'sc_06_boss_trial',
    stage: 6,
    title: 'Stage 6 · The High-Stakes Run',
    subtitle: 'Proving Ground',
    briefingQuote:
      'One last street test before your ascension. Rack up +2 activities/races OR claim +2 Starlight Shards/Secrets across the city to prove your command.',
    objectiveText: 'Complete +2 activities/races OR discover +2 Starlight Shards/Secrets.',
    turnInHint: 'Return to The Mission House for the final ceremony.',
    rewardCoins: 180,
    rewardXp: 220,
    targetMarker: {x: 46.5 * TILE_SIZE, y: 37.4 * TILE_SIZE, label: 'Pixel Palace & City Activities'},
    evaluateProgress: (s, b) => {
      const actSide = Math.max(
        0,
        s.missions.activitiesCompleted - b.activitiesCompleted + (s.miniGameRecords.racesCompleted - b.racesCompleted),
      );
      const findSide = Math.max(
        0,
        (s.collectedIds ?? []).length - b.shardsCollected + ((s.discoveredSecrets ?? []).length - b.secretsDiscovered),
      );
      const cur = Math.min(2, Math.max(actSide, findSide));
      return {
        cur,
        goal: 2,
        detail: `Trial Feats: ${cur}/2 (Activities/Races: ${actSide}, Shards/Secrets: ${findSide})`,
      };
    },
  },
  {
    id: 'sc_07_lead_ascension',
    stage: 7,
    title: 'Stage 7 · Lead Gang Leader Ascension',
    subtitle: 'Final Mission House Ceremony',
    briefingQuote:
      'Everything across all eleven districts has led to this moment. Speak with me inside The Mission House to claim your crown.',
    objectiveText: 'Meet The Mission Man inside The Mission House for your final promotion.',
    turnInHint: 'Claim your Lead Gang Leader promotion at The Mission Man’s Desk.',
    rewardCoins: 300,
    rewardXp: 350,
    isFinale: true,
    targetMarker: MISSION_HOUSE_COORDS,
    evaluateProgress: () => ({
      cur: 1,
      goal: 1,
      detail: 'Ready for Ascension inside The Mission House',
    }),
  },
];

export function getActiveStoryCampaignMission(save: SaveDataV1): StoryCampaignMissionDef | null {
  if (save.story.campaignCompleted) return null;
  const done = new Set(save.story.completedMissionIds ?? []);
  if (save.story.currentMissionId) {
    const found = STORY_CAMPAIGN_MISSIONS.find(
      (m) => m.id === save.story.currentMissionId && !done.has(m.id),
    );
    if (found) return found;
  }
  return STORY_CAMPAIGN_MISSIONS.find((m) => !done.has(m.id)) ?? null;
}

export function getStoryMissionProgressSnapshot(save: SaveDataV1): {
  mission: StoryCampaignMissionDef | null;
  accepted: boolean;
  cur: number;
  goal: number;
  complete: boolean;
  detail: string;
} {
  const mission = getActiveStoryCampaignMission(save);
  if (!mission) {
    return {
      mission: null,
      accepted: false,
      cur: STORY_CAMPAIGN_MISSIONS.length,
      goal: STORY_CAMPAIGN_MISSIONS.length,
      complete: true,
      detail: 'Story Campaign Completed · Lead Gang Leader',
    };
  }
  const accepted =
    save.story.missionPhase === 'objective_active' ||
    save.story.missionPhase === 'return_to_mission_man';
  const baseline = save.story.missionBaseline ?? captureStoryMissionBaseline(save);
  const res = mission.evaluateProgress(save, baseline);
  return {
    mission,
    accepted,
    cur: res.cur,
    goal: res.goal,
    complete: accepted && res.cur >= res.goal,
    detail: res.detail,
  };
}

