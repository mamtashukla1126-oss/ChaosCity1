import {DISTRICTS} from '@/src/config/constants';
import {
  CollectibleItemDef,
  DistrictId,
  SaveDataV1,
  SecretLocationDef,
} from '@/src/game/types/gameTypes';

export const COLLECTIBLE_RELICS: CollectibleItemDef[] = [
  {
    id: 'relic_downtown_badge',
    name: 'Founders Brass Keycard',
    rarity: 'common',
    districtId: 'downtown',
    hint: 'Near the brick library courtyard in West Downtown.',
    rewardCoins: 25,
    rewardXp: 35,
    tileX: 3.5,
    tileY: 14.5,
    texture: 'prop_relic_common',
  },
  {
    id: 'relic_park_clover',
    name: 'Four-Leaf Park Charm',
    rarity: 'common',
    districtId: 'central_park',
    hint: 'Tucked beside the north-west Central Park flowerbeds.',
    rewardCoins: 25,
    rewardXp: 35,
    tileX: 33.5,
    tileY: 4.5,
    texture: 'prop_relic_common',
  },
  {
    id: 'relic_shop_vinyl',
    name: 'Vintage Synth 45rpm',
    rarity: 'common',
    districtId: 'shopping',
    hint: 'Behind the Vinyl & Books alley corner.',
    rewardCoins: 30,
    rewardXp: 40,
    tileX: 11.5,
    tileY: 47.0,
    texture: 'prop_relic_common',
  },
  {
    id: 'relic_res_compass',
    name: 'Suburban Brass Sundial',
    rarity: 'common',
    districtId: 'residential',
    hint: 'Along the northern garden hedge row in Residential District.',
    rewardCoins: 30,
    rewardXp: 40,
    tileX: 74.5,
    tileY: 10.5,
    texture: 'prop_relic_common',
  },
  {
    id: 'relic_ent_ticket',
    name: 'Golden Arcade Token',
    rarity: 'rare',
    districtId: 'entertainment',
    hint: 'Behind Pixel Palace Arcade & Starlight Cinema.',
    rewardCoins: 45,
    rewardXp: 60,
    tileX: 50.0,
    tileY: 43.0,
    texture: 'prop_relic_rare',
  },
  {
    id: 'relic_luxury_watch',
    name: 'Platinum Crest Chronometer',
    rarity: 'rare',
    districtId: 'luxury',
    hint: 'Overlooking the marble plaza east of Grand Starlight Hotel.',
    rewardCoins: 55,
    rewardXp: 70,
    tileX: 116.5,
    tileY: 12.0,
    texture: 'prop_relic_rare',
  },
  {
    id: 'relic_airport_wings',
    name: 'Silver Pilot Insignia',
    rarity: 'rare',
    districtId: 'airport',
    hint: 'Parked near the east wing of Starlight Airport tarmac.',
    rewardCoins: 55,
    rewardXp: 70,
    tileX: 151.0,
    tileY: 22.0,
    texture: 'prop_relic_rare',
  },
  {
    id: 'relic_ind_blueprint',
    name: 'Encrypted Rail Schematic',
    rarity: 'epic',
    districtId: 'industrial',
    hint: 'Hidden among stacked cargo containers behind Freight Warehouse.',
    rewardCoins: 75,
    rewardXp: 95,
    tileX: 116.5,
    tileY: 58.0,
    texture: 'prop_relic_epic',
  },
  {
    id: 'relic_beach_pearl',
    name: 'Luminescent Ocean Pearl',
    rarity: 'epic',
    districtId: 'beach',
    hint: 'Washed up on the southern Pacific shoreline foam.',
    rewardCoins: 80,
    rewardXp: 100,
    tileX: 140.2,
    tileY: 107.0,
    texture: 'prop_relic_epic',
  },
  {
    id: 'relic_country_honey',
    name: 'Emerald Valley Amber Comb',
    rarity: 'rare',
    districtId: 'countryside',
    hint: 'Deep in the south-west Valley meadow orchard.',
    rewardCoins: 55,
    rewardXp: 70,
    tileX: 8.5,
    tileY: 110.0,
    texture: 'prop_relic_rare',
  },
  {
    id: 'relic_highway_trophy',
    name: 'Midnight Circuit Piston',
    rarity: 'epic',
    districtId: 'highway',
    hint: 'Under the south expressway canal overpass.',
    rewardCoins: 75,
    rewardXp: 95,
    tileX: 70.0,
    tileY: 109.0,
    texture: 'prop_relic_epic',
  },
  {
    id: 'relic_mythic_starlight',
    name: 'Heart of Starlight Crystal',
    rarity: 'mythic',
    districtId: 'luxury',
    hint: 'Crown jewel tucked in the far north-east Luxury cliff overlook.',
    rewardCoins: 150,
    rewardXp: 180,
    tileX: 119.5,
    tileY: 3.5,
    texture: 'prop_relic_mythic',
  },
];

export const SECRET_LOCATIONS: SecretLocationDef[] = [
  {
    id: 'sec_rooftop_skyline',
    name: 'Skyline Rooftop Observatory',
    category: 'rooftop',
    districtId: 'downtown',
    description: 'A secluded rooftop lounge perched behind Skyline Commerce Tower with panoramic city views.',
    rewardCoins: 75,
    rewardXp: 100,
    rewardTitle: 'Skyline Climber',
    entryTileX: 24.5,
    entryTileY: 10.5,
    exitTileX: 24.5,
    exitTileY: 12.2,
  },
  {
    id: 'sec_underground_rail',
    name: 'Underground Maintenance Tunnel',
    category: 'underground',
    districtId: 'industrial',
    description: 'Old subterranean transit vault beneath Central Rail Station & Ironworks Yard.',
    rewardCoins: 85,
    rewardXp: 110,
    rewardTitle: 'Tunnel Runner',
    entryTileX: 106.5,
    entryTileY: 37.5,
    exitTileX: 106.5,
    exitTileY: 39.2,
  },
  {
    id: 'sec_park_shrine',
    name: 'Hidden Blossom Shrine',
    category: 'hidden_alley',
    districtId: 'central_park',
    description: 'A tranquil spring sanctuary tucked behind the northern Central Park pines.',
    rewardCoins: 65,
    rewardXp: 85,
    entryTileX: 31.5,
    entryTileY: 3.0,
    exitTileX: 32.5,
    exitTileY: 4.5,
  },
  {
    id: 'sec_alley_arcade',
    name: 'Midnight Back-Alley Cyber Loft',
    category: 'hidden_alley',
    districtId: 'entertainment',
    description: 'Secret retro synth & high-score hideout tucked between Pixel Palace and Cinema.',
    rewardCoins: 70,
    rewardXp: 90,
    entryTileX: 43.2,
    entryTileY: 40.5,
    exitTileX: 45.0,
    exitTileY: 40.5,
  },
  {
    id: 'sec_coastal_grotto',
    name: 'Pacific Tidepool Grotto',
    category: 'coastal_secret',
    districtId: 'beach',
    description: 'Glowing tidepool cove at the south end of Golden Sand Beach.',
    rewardCoins: 95,
    rewardXp: 120,
    rewardTitle: 'Tidepool Explorer',
    entryTileX: 139.5,
    entryTileY: 114.0,
    exitTileX: 138.0,
    exitTileY: 112.0,
  },
  {
    id: 'sec_airport_deck',
    name: 'Starlight Control Tower Deck',
    category: 'landmark',
    districtId: 'airport',
    description: 'Restricted aviation observation balcony watching jets taxi along Runway 09.',
    rewardCoins: 90,
    rewardXp: 115,
    entryTileX: 155.0,
    entryTileY: 15.0,
    exitTileX: 153.5,
    exitTileY: 17.5,
  },
];

export function getCollectibleById(id: string): CollectibleItemDef | undefined {
  return COLLECTIBLE_RELICS.find((c) => c.id === id);
}

export function getSecretLocationById(id: string): SecretLocationDef | undefined {
  return SECRET_LOCATIONS.find((s) => s.id === id);
}

export interface DistrictExplorationBreakdown {
  districtId: DistrictId;
  districtName: string;
  visited: boolean;
  collectiblesFound: number;
  collectiblesTotal: number;
  secretsFound: number;
  secretsTotal: number;
  percent: number;
}

export function computeExplorationBreakdown(save: SaveDataV1): {
  overallPercent: number;
  districts: DistrictExplorationBreakdown[];
  totalDiscoveredCollectibles: number;
  totalCollectibles: number;
  totalDiscoveredSecrets: number;
  totalSecrets: number;
} {
  const visitedSet = new Set(save.missions.visitedDistricts ?? []);
  const colSet = new Set([...(save.collectibles ?? []), ...(save.collectedIds ?? [])]);
  const secSet = new Set(save.discoveredSecrets ?? []);

  const districts: DistrictExplorationBreakdown[] = DISTRICTS.map((d) => {
    const visited = visitedSet.has(d.id);
    const districtCols = COLLECTIBLE_RELICS.filter((c) => c.districtId === d.id);
    const districtSecs = SECRET_LOCATIONS.filter((s) => s.districtId === d.id);
    const colFound = districtCols.filter((c) => colSet.has(c.id)).length;
    const secFound = districtSecs.filter((s) => secSet.has(s.id)).length;
    const totalPoints = 1 + districtCols.length + districtSecs.length;
    const earnedPoints = (visited ? 1 : 0) + colFound + secFound;
    return {
      districtId: d.id,
      districtName: d.name,
      visited,
      collectiblesFound: colFound,
      collectiblesTotal: districtCols.length,
      secretsFound: secFound,
      secretsTotal: districtSecs.length,
      percent: Math.round((earnedPoints / Math.max(1, totalPoints)) * 100),
    };
  });

  const totalDiscoveredCollectibles = COLLECTIBLE_RELICS.filter((c) => colSet.has(c.id)).length;
  const totalDiscoveredSecrets = SECRET_LOCATIONS.filter((s) => secSet.has(s.id)).length;
  const totalUnits = DISTRICTS.length + COLLECTIBLE_RELICS.length + SECRET_LOCATIONS.length;
  const earnedUnits =
    districts.filter((d) => d.visited).length + totalDiscoveredCollectibles + totalDiscoveredSecrets;

  return {
    overallPercent: Math.round((earnedUnits / Math.max(1, totalUnits)) * 100),
    districts,
    totalDiscoveredCollectibles,
    totalCollectibles: COLLECTIBLE_RELICS.length,
    totalDiscoveredSecrets,
    totalSecrets: SECRET_LOCATIONS.length,
  };
}
