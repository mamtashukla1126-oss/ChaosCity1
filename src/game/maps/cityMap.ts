import {
  DISTRICTS,
  MAP_COLS,
  MAP_ROWS,
  TILE_SIZE,
} from '@/src/config/constants';
import type {VehicleConfig} from '@/src/game/entities/Vehicle';
import {COLLECTIBLE_RELICS, SECRET_LOCATIONS} from '@/src/game/data/explorationData';
import {PROPERTIES_CATALOG} from '@/src/game/data/propertyData';
import {
  DistrictId,
  InteractiveObjectData,
  NPCConfig,
} from '@/src/game/types/gameTypes';

export interface BuildingPlacement {
  id: string;
  texture: string;
  tileX: number; // top-left tile X
  tileY: number; // top-left tile Y
  widthTiles: number;
  heightTiles: number;
  doorTileX: number; // exterior entrance mat center in tiles
  doorTileY: number;
  collisionInsetTop: number; // allows player to walk slightly behind roof overhang
  collisionInsetSide: number;
  label: string;
  categoryLabel: string;
}

export interface PropPlacement {
  id: string;
  texture: string;
  x: number;
  y: number;
  solid: boolean;
  colliderW?: number;
  colliderH?: number;
  colliderOffsetY?: number;
  animatedFountain?: boolean;
}

export interface CityMapData {
  cols: number;
  rows: number;
  tileSize: number;
  groundLayer: number[][];
  detailLayer: number[][];
  solidTiles: boolean[][];
  buildings: BuildingPlacement[];
  props: PropPlacement[];
  interactives: InteractiveObjectData[];
  npcs: NPCConfig[];
  vehicles: VehicleConfig[];
  spawnPoint: {x: number; y: number};
}

export function getDistrictAtWorldPos(wx: number, wy: number): (typeof DISTRICTS)[number] {
  const tx = Math.floor(wx / TILE_SIZE);
  const ty = Math.floor(wy / TILE_SIZE);
  for (const d of DISTRICTS) {
    if (tx >= d.tileX && tx < d.tileX + d.tileW && ty >= d.tileY && ty < d.tileY + d.tileH) {
      return d;
    }
  }
  return DISTRICTS[0];
}

export function createCityMapData(): CityMapData {
  const ground: number[][] = Array.from({length: MAP_ROWS}, (_, r) =>
    Array.from({length: MAP_COLS}, (_, c) => ((r * 7 + c * 13) % 5 === 0 ? 1 : 0)),
  );
  const detail: number[][] = Array.from({length: MAP_ROWS}, () =>
    Array.from({length: MAP_COLS}, () => -1),
  );
  const solidTiles: boolean[][] = Array.from({length: MAP_ROWS}, () =>
    Array.from({length: MAP_COLS}, () => false),
  );

  const fillGround = (x: number, y: number, w: number, h: number, tile: number) => {
    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
          ground[r][c] = tile;
        }
      }
    }
  };

  const setDetail = (c: number, r: number, tile: number, solid = false) => {
    if (r >= 0 && r < MAP_ROWS && c >= 0 && c < MAP_COLS) {
      detail[r][c] = tile;
      if (solid) solidTiles[r][c] = true;
    }
  };

  // 1. District Ground Base
  // Central Park vibrant grass
  fillGround(31, 2, 19, 24, 2);
  // Downtown urban concrete base
  fillGround(2, 2, 24, 24, 3);
  // Downtown stone central plaza
  fillGround(10, 14, 8, 11, 4);
  // Shopping district wide sidewalk promenade
  fillGround(2, 31, 41, 10, 3);
  fillGround(2, 41, 41, 8, 0);
  fillGround(4, 38, 10, 4, 4); // Cafe outdoor patio
  // Entertainment Plaza
  fillGround(44, 31, 34, 25, 4);

  // Luxury Heights (Cols 80..121, Rows 0..31) — Marble plazas & upscale sidewalks
  fillGround(80, 2, 42, 24, 3);
  fillGround(98, 5, 21, 18, 41); // Luxury marble plaza
  fillGround(81, 4, 12, 19, 41); // Civic precinct marble pad

  // Starlight Airport (Cols 122..159, Rows 0..41) — Tarmac & Terminal Concourse
  fillGround(122, 2, 36, 39, 36);
  fillGround(124, 5, 34, 8, 37); // Airport Runway East-West
  fillGround(124, 15, 22, 11, 36); // Gate Apron

  // Ironworks Industrial (Cols 80..121, Rows 32..65) — Concrete & freight yards
  fillGround(80, 32, 42, 34, 36);
  fillGround(98, 52, 20, 12, 3); // Freight loading apron

  // Emerald Valley Countryside (Cols 0..63, Rows 60..119) — Lush fields, crop rows & dirt trails
  fillGround(0, 60, 62, 59, 2);
  fillGround(4, 64, 14, 12, 40); // West crops
  fillGround(34, 65, 16, 12, 40); // East crops
  fillGround(6, 90, 22, 14, 40); // South valley crops
  fillGround(16, 71, 12, 8, 5); // Farm Market cobblestone courtyard

  // Pacific Boardwalk & Beach (Cols 122..159, Rows 42..119) — Sand, Boardwalk & Deep Ocean
  fillGround(122, 42, 22, 77, 34); // Golden Sand
  fillGround(135, 44, 6, 70, 35); // Timber Boardwalk
  fillGround(141, 38, 1, 82, 33); // Shoreline Surf & Foam
  fillGround(142, 38, 18, 82, 32); // Deep Ocean Blue
  // Ocean solid barrier
  for (let r = 38; r < MAP_ROWS; r++) {
    for (let c = 142; c < MAP_COLS; c++) {
      solidTiles[r][c] = true;
    }
  }

  // Metro Expressway & Canal (Cols 64..121, Rows 66..119)
  fillGround(64, 66, 58, 54, 3);
  fillGround(72, 83, 24, 14, 4); // Mall & Music Plaza pavers
  // North-South Waterway Canal separating Countryside & Metro Expressway (Cols 62..67, Rows 66..119)
  fillGround(62, 66, 6, 54, 12);
  for (let r = 66; r < MAP_ROWS; r++) {
    for (let c = 62; c < 68; c++) {
      solidTiles[r][c] = true;
    }
  }

  // 2. Main & Expanded Road Network
  // Horizontal Main Boulevard (Rows 27..29, Sidewalks 26 & 30) extending to Coastal Ave
  fillGround(0, 26, 138, 1, 3);
  fillGround(0, 27, 138, 1, 6);
  fillGround(0, 28, 138, 1, 7);
  fillGround(0, 29, 138, 1, 6);
  fillGround(0, 30, 138, 1, 3);

  // South Horizontal Road (Rows 50..52, Sidewalks 49 & 53) extending to Coastal Ave
  fillGround(0, 49, 136, 1, 3);
  fillGround(0, 50, 136, 1, 6);
  fillGround(0, 51, 136, 1, 7);
  fillGround(0, 52, 136, 1, 6);
  fillGround(0, 53, 136, 1, 3);

  // Uptown Luxury & Airport Connector (Rows 14..16, cols 78..126)
  fillGround(78, 13, 48, 1, 3);
  fillGround(78, 14, 48, 1, 6);
  fillGround(78, 15, 48, 1, 7);
  fillGround(78, 16, 48, 1, 6);
  fillGround(78, 17, 48, 1, 3);

  // Metro Expressway Dual-Lane (Rows 80..82, cols 8..135)
  fillGround(8, 79, 128, 1, 3);
  fillGround(8, 80, 128, 1, 38);
  fillGround(8, 81, 128, 1, 7);
  fillGround(8, 82, 128, 1, 38);
  fillGround(8, 83, 128, 1, 3);

  // Highway Bridge Deck crossing Canal (Cols 62..67, Rows 80..82) — walkable & drivable!
  fillGround(62, 79, 6, 1, 3);
  fillGround(62, 80, 6, 3, 39);
  fillGround(62, 83, 6, 1, 3);
  for (let r = 79; r <= 83; r++) {
    for (let c = 62; c < 68; c++) {
      solidTiles[r][c] = false;
    }
  }
  // North Countryside & Industrial Bridge over Canal (Cols 62..67, Rows 50..52 already crosses north of canal!)

  // South Ring Expressway (Rows 104..106, cols 26..135) — Bridge over Canal too
  fillGround(26, 103, 110, 1, 3);
  fillGround(26, 104, 110, 1, 38);
  fillGround(26, 105, 110, 1, 7);
  fillGround(26, 106, 110, 1, 38);
  fillGround(26, 107, 110, 1, 3);
  fillGround(62, 104, 6, 3, 39);
  for (let r = 103; r <= 107; r++) {
    for (let c = 62; c < 68; c++) {
      solidTiles[r][c] = false;
    }
  }

  // North Perimeter Lane (Rows 3..4)
  fillGround(2, 3, 76, 1, 3);

  // Vertical West Avenue (Cols 27..29, Sidewalks 26 & 30) down to Row 114
  fillGround(26, 0, 1, 114, 3);
  fillGround(27, 0, 1, 114, 6);
  fillGround(28, 0, 1, 114, 8);
  fillGround(29, 0, 1, 114, 6);
  fillGround(30, 0, 1, 114, 3);

  // Vertical East Avenue (Cols 51..53, Sidewalks 50 & 54) down to Row 114
  fillGround(50, 0, 1, 114, 3);
  fillGround(51, 0, 1, 114, 6);
  fillGround(52, 0, 1, 114, 8);
  fillGround(53, 0, 1, 114, 6);
  fillGround(54, 0, 1, 114, 3);

  // Luxury & Industrial Avenue (Cols 94..96, Sidewalks 93 & 97) from Row 3 to 114
  fillGround(93, 3, 1, 111, 3);
  fillGround(94, 3, 1, 111, 6);
  fillGround(95, 3, 1, 111, 8);
  fillGround(96, 3, 1, 111, 6);
  fillGround(97, 3, 1, 111, 3);

  // Coastal & Airport Avenue (Cols 131..133, Sidewalks 130 & 134) from Row 15 to 112
  fillGround(130, 15, 1, 98, 3);
  fillGround(131, 15, 1, 98, 6);
  fillGround(132, 15, 1, 98, 8);
  fillGround(133, 15, 1, 98, 6);
  fillGround(134, 15, 1, 98, 3);

  // Shopping West Connector Street (Cols 23..25, Rows 31..49)
  fillGround(23, 31, 3, 19, 3);
  fillGround(24, 31, 1, 19, 6);

  // Intersections clean asphalt
  for (const ix of [27, 51, 94, 131]) {
    for (const iy of [27, 50, 80, 104]) {
      if (ix === 131 && (iy === 80 || iy === 104 || iy === 27 || iy === 50)) {
        fillGround(ix, iy, 3, 3, 11);
      } else if (ix !== 131) {
        fillGround(ix, iy, 3, 3, 11);
      }
    }
  }
  fillGround(94, 14, 3, 3, 11);

  // Crosswalks
  for (const cx of [14, 35, 42, 62, 88, 108, 124]) {
    fillGround(cx, 27, 2, 3, 9);
    fillGround(cx, 50, 2, 3, 9);
  }
  for (const cy of [14, 36, 70, 92]) {
    fillGround(27, cy, 3, 2, 10);
    fillGround(51, cy, 3, 2, 10);
    fillGround(94, cy, 3, 2, 10);
  }

  // World Outer Edge Hedges / Perimeter Guards (North/West/South borders)
  for (let c = 0; c < MAP_COLS; c++) {
    if (c < 26 || (c > 30 && c < 50) || (c > 54 && c < 142)) {
      setDetail(c, 0, 25, true);
    }
    if (c < 142) {
      setDetail(c, MAP_ROWS - 1, 25, true);
    }
  }
  for (let r = 1; r < MAP_ROWS - 1; r++) {
    if (r < 26 || (r > 30 && r < 49) || r > 53) {
      setDetail(0, r, 25, true);
    }
  }

  // Road Stop Bars & Street Manholes
  setDetail(26, 27, 27);
  setDetail(26, 29, 27);
  setDetail(50, 27, 27);
  setDetail(50, 29, 27);
  setDetail(93, 27, 27);
  setDetail(93, 29, 27);
  setDetail(27, 26, 26);
  setDetail(29, 26, 26);
  setDetail(51, 26, 26);
  setDetail(53, 26, 26);
  setDetail(94, 26, 26);
  setDetail(96, 26, 26);
  setDetail(19, 28, 24);
  setDetail(46, 28, 24);
  setDetail(28, 42, 24);
  setDetail(95, 42, 24);
  setDetail(95, 72, 24);

  // 3. Central Park Paths, Fountain Plaza & Pond
  fillGround(39, 4, 3, 22, 5); // N-S cobblestone path
  fillGround(31, 14, 19, 3, 5); // E-W cobblestone path
  fillGround(37, 12, 7, 7, 4); // Central Fountain stone plaza
  // Decorative pond with lilypads
  fillGround(43, 5, 5, 4, 12);
  for (let r = 5; r < 9; r++) {
    for (let c = 43; c < 48; c++) {
      solidTiles[r][c] = true;
    }
  }
  setDetail(44, 6, 28);
  setDetail(46, 7, 28);
  // Park flowerbeds & hedges
  fillGround(33, 6, 4, 2, 13);
  fillGround(33, 21, 4, 2, 13);
  fillGround(44, 21, 4, 2, 13);
  for (let c = 33; c < 37; c++) {
    setDetail(c, 6, 17);
    setDetail(c, 7, 18);
    setDetail(c, 21, 18);
    setDetail(c, 22, 17);
  }
  for (let c = 44; c < 48; c++) {
    setDetail(c, 21, 17);
    setDetail(c, 22, 18);
  }
  setDetail(37, 11, 25, true);
  setDetail(43, 11, 25, true);
  setDetail(37, 19, 25, true);
  setDetail(43, 19, 25, true);

  // 4. Residential Area Paths & Yards
  fillGround(64, 4, 2, 22, 3); // Residential sidewalk alley
  fillGround(55, 14, 21, 2, 3); // Residential cross-lane
  // Yard fences & gardens around houses
  const fenceYards = [
    {x: 56, y: 5, w: 7, h: 7, gateX: 59},
    {x: 67, y: 5, w: 7, h: 7, gateX: 70},
    {x: 56, y: 17, w: 7, h: 7, gateX: 59},
    {x: 67, y: 17, w: 7, h: 7, gateX: 70},
  ];
  for (const fy of fenceYards) {
    // Bottom front fence with open gate
    for (let c = fy.x; c < fy.x + fy.w; c++) {
      if (c !== fy.gateX && c !== fy.gateX + 1) {
        setDetail(c, fy.y + fy.h, 20, true);
      } else {
        ground[fy.y + fy.h][c] = 5;
      }
    }
    // Side fences
    for (let r = fy.y + 2; r < fy.y + fy.h; r++) {
      setDetail(fy.x, r, 21, true);
      setDetail(fy.x + fy.w - 1, r, 21, true);
    }
    // Garden flowers inside yard
    setDetail(fy.x + 1, fy.y + fy.h - 1, 17);
    setDetail(fy.x + fy.w - 2, fy.y + fy.h - 1, 18);
  }

  // 5. Entertainment Basketball Court (Cols 57..69, Rows 36..44)
  fillGround(57, 36, 13, 9, 14); // Terracotta court
  fillGround(57, 38, 3, 5, 15); // Left key
  fillGround(67, 38, 3, 5, 15); // Right key
  for (let r = 36; r <= 44; r++) {
    setDetail(63, r, 22);
  }

  // 5b. Chaos Customs Garage Forecourt & Eastside Soccer Kickabout Pitch
  fillGround(69, 31, 6, 5, 3); // Garage apron
  fillGround(70, 35, 4, 2, 4); // Garage front pavers
  fillGround(70, 40, 7, 7, 2); // Vibrant soccer turf pitch
  for (let r = 40; r <= 46; r++) {
    setDetail(73, r, 22);
  }

  // 6. Buildings (All 20 enterable buildings across all 5 districts)
  const buildings: BuildingPlacement[] = [
    // Downtown
    {
      id: 'b_dt_tower_1',
      texture: 'bld_downtown_tower',
      tileX: 4,
      tileY: 6,
      widthTiles: 5,
      heightTiles: 5,
      doorTileX: 6.5,
      doorTileY: 11.4,
      collisionInsetTop: 18,
      collisionInsetSide: 4,
      label: 'Apex Tech Center',
      categoryLabel: 'Electronics Store',
    },
    {
      id: 'b_dt_brick_1',
      texture: 'bld_downtown_brick',
      tileX: 11,
      tileY: 6,
      widthTiles: 4,
      heightTiles: 4,
      doorTileX: 13.0,
      doorTileY: 10.4,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Harbor Lofts',
      categoryLabel: 'Apartments',
    },
    {
      id: 'b_dt_tower_2',
      texture: 'bld_office_glass',
      tileX: 18,
      tileY: 6,
      widthTiles: 5,
      heightTiles: 5,
      doorTileX: 20.5,
      doorTileY: 11.4,
      collisionInsetTop: 18,
      collisionInsetSide: 4,
      label: 'Skyline Commerce Office',
      categoryLabel: 'Office',
    },
    {
      id: 'b_dt_brick_2',
      texture: 'bld_downtown_brick',
      tileX: 4,
      tileY: 16,
      widthTiles: 4,
      heightTiles: 4,
      doorTileX: 6.0,
      doorTileY: 20.4,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'City Gazette & Library',
      categoryLabel: 'Library',
    },
    {
      id: 'b_clinic',
      texture: 'bld_clinic',
      tileX: 4,
      tileY: 21,
      widthTiles: 4,
      heightTiles: 4,
      doorTileX: 6.0,
      doorTileY: 25.35,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Metro Health Clinic',
      categoryLabel: 'Clinic & Pharmacy',
    },
    {
      id: 'b_dt_brick_3',
      texture: 'bld_downtown_brick',
      tileX: 20,
      tileY: 16,
      widthTiles: 4,
      heightTiles: 4,
      doorTileX: 22.0,
      doorTileY: 20.4,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Central Bank',
      categoryLabel: 'Bank',
    },

    // Shopping District
    {
      id: 'b_cafe',
      texture: 'bld_cafe',
      tileX: 4,
      tileY: 33,
      widthTiles: 5,
      heightTiles: 4,
      doorTileX: 6.5,
      doorTileY: 37.4,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Bean & Byte Cafe',
      categoryLabel: 'Cafe',
    },
    {
      id: 'b_clothing',
      texture: 'bld_clothing',
      tileX: 15,
      tileY: 33,
      widthTiles: 5,
      heightTiles: 4,
      doorTileX: 17.5,
      doorTileY: 37.4,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Threadz Boutique',
      categoryLabel: 'Clothing Store',
    },
    {
      id: 'b_grocery',
      texture: 'bld_grocery',
      tileX: 32,
      tileY: 33,
      widthTiles: 5,
      heightTiles: 4,
      doorTileX: 34.5,
      doorTileY: 37.4,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'FreshMart Grocery',
      categoryLabel: 'Supermarket',
    },
    {
      id: 'b_petshop',
      texture: 'bld_petshop',
      tileX: 38,
      tileY: 33,
      widthTiles: 4,
      heightTiles: 4,
      doorTileX: 40.0,
      doorTileY: 37.4,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Paws & Whiskers Pet Shop',
      categoryLabel: 'Pet Shop',
    },
    {
      id: 'b_restaurant',
      texture: 'bld_restaurant',
      tileX: 4,
      tileY: 43,
      widthTiles: 5,
      heightTiles: 4,
      doorTileX: 6.5,
      doorTileY: 47.4,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Sunset Bistro & Diner',
      categoryLabel: 'Restaurant',
    },
    {
      id: 'b_shop_brick',
      texture: 'bld_bookstore',
      tileX: 15,
      tileY: 43,
      widthTiles: 4,
      heightTiles: 3.5,
      doorTileX: 17.0,
      doorTileY: 46.9,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Vinyl & Books',
      categoryLabel: 'Bookstore',
    },
    {
      id: 'b_salon',
      texture: 'bld_salon',
      tileX: 32,
      tileY: 43,
      widthTiles: 4,
      heightTiles: 4,
      doorTileX: 34.0,
      doorTileY: 47.4,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Glow & Snip Salon',
      categoryLabel: 'Hair Salon',
    },
    {
      id: 'b_gym',
      texture: 'bld_gym',
      tileX: 38,
      tileY: 43,
      widthTiles: 4,
      heightTiles: 4,
      doorTileX: 40.0,
      doorTileY: 47.4,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'IronWorks Gym',
      categoryLabel: 'Fitness & Gym',
    },

    // Entertainment Zone
    {
      id: 'b_arcade',
      texture: 'bld_arcade',
      tileX: 44,
      tileY: 33,
      widthTiles: 5,
      heightTiles: 4,
      doorTileX: 46.5,
      doorTileY: 37.4,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Pixel Palace Arcade',
      categoryLabel: 'Arcade',
    },
    {
      id: 'b_cinema',
      texture: 'bld_cinema',
      tileX: 44,
      tileY: 42,
      widthTiles: 5,
      heightTiles: 4,
      doorTileX: 46.5,
      doorTileY: 46.4,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Starlight Cinema',
      categoryLabel: 'Cinema',
    },
    {
      id: 'b_garage',
      texture: 'bld_garage',
      tileX: 69,
      tileY: 32,
      widthTiles: 6,
      heightTiles: 3.5,
      doorTileX: 72.0,
      doorTileY: 36.0,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Chaos Customs Garage',
      categoryLabel: 'Vehicle Garage',
    },

    // Residential Houses & Apartments
    {
      id: 'b_house_1',
      texture: 'bld_house_blue',
      tileX: 57,
      tileY: 6,
      widthTiles: 4,
      heightTiles: 3.5,
      doorTileX: 59.0,
      doorTileY: 9.9,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Bluebird Cottage',
      categoryLabel: 'House',
    },
    {
      id: 'b_house_2',
      texture: 'bld_house_warm',
      tileX: 68,
      tileY: 6,
      widthTiles: 4,
      heightTiles: 3.5,
      doorTileX: 70.0,
      doorTileY: 9.9,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Sunbeam House',
      categoryLabel: 'House',
    },
    {
      id: 'b_house_3',
      texture: 'bld_house_mint',
      tileX: 57,
      tileY: 18,
      widthTiles: 4,
      heightTiles: 3.5,
      doorTileX: 59.0,
      doorTileY: 21.9,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Clover Residence',
      categoryLabel: 'House',
    },
    {
      id: 'b_house_4',
      texture: 'bld_apartment',
      tileX: 68,
      tileY: 18,
      widthTiles: 5,
      heightTiles: 4,
      doorTileX: 70.5,
      doorTileY: 22.4,
      collisionInsetTop: 18,
      collisionInsetSide: 4,
      label: 'Maple Crest Apartments',
      categoryLabel: 'Apartments',
    },

    // Prompt 09 Expansion Buildings (14 New Enterable Buildings)
    {
      id: 'b_police',
      texture: 'bld_police',
      tileX: 82,
      tileY: 4,
      widthTiles: 6,
      heightTiles: 4.125,
      doorTileX: 85.0,
      doorTileY: 8.6,
      collisionInsetTop: 18,
      collisionInsetSide: 4,
      label: 'CCPD Police Precinct',
      categoryLabel: 'Police HQ',
    },
    {
      id: 'b_hospital',
      texture: 'bld_hospital',
      tileX: 82,
      tileY: 18,
      widthTiles: 7,
      heightTiles: 4.5,
      doorTileX: 85.5,
      doorTileY: 22.9,
      collisionInsetTop: 18,
      collisionInsetSide: 4,
      label: 'Chaos City Hospital',
      categoryLabel: 'Medical Center',
    },
    {
      id: 'b_hotel',
      texture: 'bld_hotel',
      tileX: 100,
      tileY: 5,
      widthTiles: 6.5,
      heightTiles: 4.5,
      doorTileX: 103.25,
      doorTileY: 9.9,
      collisionInsetTop: 18,
      collisionInsetSide: 4,
      label: 'Grand Starlight Hotel',
      categoryLabel: 'Luxury Hotel',
    },
    {
      id: 'b_casino_lounge',
      texture: 'bld_casino_lounge',
      tileX: 100,
      tileY: 19,
      widthTiles: 6,
      heightTiles: 4,
      doorTileX: 103.0,
      doorTileY: 23.4,
      collisionInsetTop: 18,
      collisionInsetSide: 4,
      label: 'Starlight Lucky Lounge',
      categoryLabel: 'Fun Token Lounge',
    },
    {
      id: 'b_dealership',
      texture: 'bld_dealership',
      tileX: 111,
      tileY: 19,
      widthTiles: 6.5,
      heightTiles: 4,
      doorTileX: 114.25,
      doorTileY: 23.4,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Prestige Motors Dealership',
      categoryLabel: 'Car Dealership',
    },
    {
      id: 'b_airport',
      texture: 'bld_airport',
      tileX: 124,
      tileY: 19,
      widthTiles: 7.5,
      heightTiles: 4.375,
      doorTileX: 127.75,
      doorTileY: 23.8,
      collisionInsetTop: 18,
      collisionInsetSide: 4,
      label: 'Starlight Airport Terminal',
      categoryLabel: 'Airport',
    },
    {
      id: 'b_fire',
      texture: 'bld_fire',
      tileX: 82,
      tileY: 34,
      widthTiles: 6,
      heightTiles: 4,
      doorTileX: 85.0,
      doorTileY: 38.4,
      collisionInsetTop: 18,
      collisionInsetSide: 4,
      label: 'Chaos Fire Station',
      categoryLabel: 'Fire Dept',
    },
    {
      id: 'b_repair',
      texture: 'bld_repair',
      tileX: 82,
      tileY: 43,
      widthTiles: 6,
      heightTiles: 3.75,
      doorTileX: 85.0,
      doorTileY: 47.2,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Apex Repair Workshop',
      categoryLabel: 'Auto Repair',
    },
    {
      id: 'b_train',
      texture: 'bld_train',
      tileX: 99,
      tileY: 34,
      widthTiles: 6.5,
      heightTiles: 3.875,
      doorTileX: 102.25,
      doorTileY: 38.3,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Central Rail Station',
      categoryLabel: 'Train Transit',
    },
    {
      id: 'b_warehouse',
      texture: 'bld_warehouse',
      tileX: 99,
      tileY: 54,
      widthTiles: 6,
      heightTiles: 3.875,
      doorTileX: 102.0,
      doorTileY: 58.3,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Freight Logistics Warehouse',
      categoryLabel: 'Industrial Hub',
    },
    {
      id: 'b_boardwalk_cafe',
      texture: 'bld_boardwalk_cafe',
      tileX: 135,
      tileY: 58,
      widthTiles: 5,
      heightTiles: 3.625,
      doorTileX: 137.5,
      doorTileY: 62.1,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Pacific Boardwalk Cafe',
      categoryLabel: 'Beach Cafe',
    },
    {
      id: 'b_farm_market',
      texture: 'bld_farm_market',
      tileX: 19,
      tileY: 71,
      widthTiles: 5,
      heightTiles: 3.625,
      doorTileX: 21.5,
      doorTileY: 75.1,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Emerald Valley Farm Market',
      categoryLabel: 'Country Market',
    },
    {
      id: 'b_mall',
      texture: 'bld_mall',
      tileX: 73,
      tileY: 85,
      widthTiles: 7.5,
      heightTiles: 4.25,
      doorTileX: 76.75,
      doorTileY: 89.7,
      collisionInsetTop: 18,
      collisionInsetSide: 4,
      label: 'Starlight Grand Mall',
      categoryLabel: 'Shopping Mall',
    },
    {
      id: 'b_music',
      texture: 'bld_music',
      tileX: 85,
      tileY: 86,
      widthTiles: 5,
      heightTiles: 3.625,
      doorTileX: 87.5,
      doorTileY: 90.1,
      collisionInsetTop: 16,
      collisionInsetSide: 4,
      label: 'Pulse Music & Synth Store',
      categoryLabel: 'Music Store',
    },
    // Prompt 11 Purchasable Premium Villa
    {
      id: 'b_villa_1',
      texture: 'bld_villa',
      tileX: 110,
      tileY: 5,
      widthTiles: 6.5,
      heightTiles: 4.375,
      doorTileX: 113.25,
      doorTileY: 9.8,
      collisionInsetTop: 18,
      collisionInsetSide: 4,
      label: 'Starlight Crest Villa',
      categoryLabel: 'Premium Villa',
    },
    {
      id: 'b_mission_house',
      texture: 'bld_mission_house',
      tileX: 11,
      tileY: 20,
      widthTiles: 5,
      heightTiles: 4,
      doorTileX: 13.5,
      doorTileY: 24.4,
      collisionInsetTop: 22,
      collisionInsetSide: 4,
      label: 'The Mission House',
      categoryLabel: 'Story Campaign HQ',
    },
  ];

  // 7. Props (Trees, Fountain, Benches, Streetlights, Hoops, Bistro Tables, Mailboxes)
  const props: PropPlacement[] = [];
  const addProp = (
    id: string,
    texture: string,
    tileX: number,
    tileY: number,
    solid: boolean,
    colliderW?: number,
    colliderH?: number,
    colliderOffsetY?: number,
    animatedFountain = false,
  ) => {
    props.push({
      id,
      texture,
      x: tileX * TILE_SIZE + TILE_SIZE * 0.5,
      y: tileY * TILE_SIZE + TILE_SIZE * 0.5,
      solid,
      colliderW,
      colliderH,
      colliderOffsetY,
      animatedFountain,
    });
  };

  // Entrance Doormat indicators in front of all 20 buildings
  for (const b of buildings) {
    props.push({
      id: `mat_${b.id}`,
      texture: 'prop_door_mat',
      x: b.doorTileX * TILE_SIZE,
      y: b.doorTileY * TILE_SIZE - 4,
      solid: false,
    });
  }

  // Central Fountain
  addProp('fountain_central', 'prop_fountain', 40, 15, true, 72, 48, 8, true);

  // Park Benches (interactive sitting)
  addProp('bench_park_n', 'prop_bench_h', 36, 12, true, 40, 16, 4);
  addProp('bench_park_s', 'prop_bench_h', 43, 18, true, 40, 16, 4);
  addProp('bench_downtown', 'prop_bench_h', 13, 14.5, true, 40, 16, 4);
  addProp('bench_court', 'prop_bench_h', 62, 46, true, 40, 16, 4);

  // Oak & Pine Trees
  const oakCoords = [
    [32, 4], [36, 4], [47, 11], [32, 19], [48, 23], [34, 24],
    [10, 44], [30.5, 46], [76.5, 34], [77.2, 46.5], [56, 4], [75, 11], [75, 24],
  ];
  oakCoords.forEach(([tx, ty], i) => {
    addProp(`oak_${i}`, 'prop_tree_oak', tx, ty, true, 24, 18, 18);
  });

  const pineCoords = [
    [32, 10], [42, 4], [47, 17], [32, 24], [2.5, 47], [46, 48], [76, 4],
  ];
  pineCoords.forEach(([tx, ty], i) => {
    addProp(`pine_${i}`, 'prop_tree_pine', tx, ty, true, 20, 16, 16);
  });

  // Street Lights along boulevards & plazas
  const lightCoords = [
    [9.5, 25], [16, 25], [25, 25], [32, 25], [48, 25], [56, 25], [68, 25],
    [6, 31], [16, 31], [32, 31], [48, 31], [56, 31], [68, 31],
    [10, 14], [17, 14], [45, 41], [55, 47],
  ];
  lightCoords.forEach(([tx, ty], i) => {
    addProp(`light_${i}`, 'prop_streetlight', tx, ty, true, 12, 10, 18);
  });

  // Cafe Bistro Tables
  addProp('bistro_1', 'prop_bistro_table', 10.5, 36, true, 24, 18, 6);
  addProp('bistro_2', 'prop_bistro_table', 12.5, 39, true, 24, 18, 6);

  // Basketball Hoops
  addProp('hoop_l', 'prop_hoop', 56.5, 40, true, 16, 14, 14);
  addProp('hoop_r', 'prop_hoop', 69.5, 40, true, 16, 14, 14);

  // Soccer Goals
  addProp('soccer_goal_l', 'prop_soccer_goal_l', 69.8, 43.0, true, 18, 44, 4);
  addProp('soccer_goal_r', 'prop_soccer_goal_r', 76.2, 43.0, true, 18, 44, 4);

  // Residential Mailboxes
  addProp('mailbox_1', 'prop_mailbox', 61.5, 12.2, true, 16, 12, 8);
  addProp('mailbox_2', 'prop_mailbox', 72.5, 12.2, true, 16, 12, 8);
  addProp('mailbox_3', 'prop_mailbox', 61.5, 24.2, true, 16, 12, 8);

  // District Signposts
  addProp('sign_park', 'prop_signpost', 36, 24.5, true, 16, 12, 10);
  addProp('sign_downtown', 'prop_signpost', 24.5, 24.5, true, 16, 12, 10);
  addProp('sign_shopping', 'prop_signpost', 22, 31.8, true, 16, 12, 10);
  addProp('sign_residential', 'prop_signpost', 55.2, 24.5, true, 16, 12, 10);
  addProp('sign_entertainment', 'prop_signpost', 50.5, 39.5, true, 16, 12, 10);

  // Secondary Park Fountain (now animated)
  addProp('fountain_north', 'prop_fountain_small', 35, 9.5, true, 34, 24, 6, true);

  // Traffic Lights at Major Intersections
  addProp('tl_1', 'prop_traffic_light', 25.6, 25.5, true, 12, 10, 18);
  addProp('tl_2', 'prop_traffic_light', 30.4, 30.5, true, 12, 10, 18);
  addProp('tl_3', 'prop_traffic_light', 49.6, 25.5, true, 12, 10, 18);
  addProp('tl_4', 'prop_traffic_light', 54.4, 30.5, true, 12, 10, 18);

  // City Bus Stop Shelters (4 interconnected stops)
  addProp('bus_stop_dt', 'prop_bus_stop', 21, 25.2, true, 54, 20, 10);
  addProp('bus_stop_park', 'prop_bus_stop', 41.5, 25.2, true, 54, 20, 10);
  addProp('bus_stop_ent', 'prop_bus_stop', 49.5, 48.2, true, 54, 20, 10);
  addProp('bus_stop_garage', 'prop_bus_stop', 64.0, 30.8, true, 54, 20, 10);

  // Street Furniture (Planters, Hydrants, Recycling Bins)
  const planters = [
    [10.2, 24.2], [17.8, 24.2], [3.8, 37.5], [20.2, 37.5], [43.5, 37.5], [43.5, 46.5],
  ];
  planters.forEach(([tx, ty], i) => {
    addProp(`planter_${i}`, 'prop_planter', tx, ty, true, 24, 16, 6);
  });

  const hydrants = [
    [8.5, 25.5], [30.5, 23.5], [54.5, 22.5], [25.5, 38.5],
  ];
  hydrants.forEach(([tx, ty], i) => {
    addProp(`hydrant_${i}`, 'prop_hydrant', tx, ty, true, 14, 12, 6);
  });

  const trashbins = [
    [10.2, 25.5], [38.2, 17.5], [14.2, 37.5], [50.2, 35.5], [64.2, 46.5],
  ];
  trashbins.forEach(([tx, ty], i) => {
    addProp(`bin_${i}`, 'prop_trashbin', tx, ty, true, 14, 12, 6);
  });

  // Mini-Game World Stations (Fishing Pier, Racing Arch, Express Courier Desk, Neon Memory Kiosk)
  addProp('prop_fishing_pier_1', 'prop_fishing_pier', 45.0, 9.0, false);
  addProp('prop_race_arch_1', 'prop_race_arch', 33.2, 25.3, true, 24, 14, 10);
  addProp('prop_courier_desk_1', 'prop_courier_desk', 18.7, 24.1, true, 24, 14, 8);
  addProp('prop_memory_kiosk_1', 'prop_memory_kiosk', 54.0, 36.8, true, 22, 14, 10);

  // Prompt 09 District Props, Signposts, Traffic Lights & New Bus Stops
  // Palm Trees along Luxury Heights & Pacific Beach
  [
    [98, 24.5], [108, 24.5], [118, 24.5], [124, 46], [128, 54],
    [125, 68], [134, 72], [126, 86], [133, 94], [127, 106],
  ].forEach(([tx, ty], i) => {
    addProp(`palm_${i}`, 'prop_palm_tree', tx, ty, true, 20, 16, 18);
  });

  // Beach Umbrellas along Golden Sand
  [
    [138, 48], [138, 66], [139, 78], [138, 90], [139, 102],
  ].forEach(([tx, ty], i) => {
    addProp(`umbrella_${i}`, 'prop_beach_umbrella', tx, ty, true, 28, 16, 8);
  });

  // Parked Jets on Airport Apron
  addProp('jet_1', 'prop_parked_jet', 135, 16.5, true, 88, 36, 6);
  addProp('jet_2', 'prop_parked_jet', 148, 16.5, true, 88, 36, 6);

  // Industrial Cargo Crates
  [
    [108, 54], [111, 54], [113, 57], [115, 55], [90, 56], [91.5, 58],
  ].forEach(([tx, ty], i) => {
    addProp(`crate_${i}`, 'prop_cargo_crate', tx, ty, true, 28, 22, 6);
  });

  // Countryside Haybales & Extra Oak Trees
  [
    [10, 68], [13, 69], [31, 72], [44, 78], [16, 94], [48, 96],
  ].forEach(([tx, ty], i) => {
    addProp(`hay_${i}`, 'prop_haybale', tx, ty, true, 24, 18, 4);
  });
  [
    [6, 84], [22, 86], [42, 88], [55, 74], [38, 100], [14, 108],
  ].forEach(([tx, ty], i) => {
    addProp(`country_oak_${i}`, 'prop_tree_oak', tx, ty, true, 24, 18, 18);
  });

  // Highway Gantry Signs
  addProp('hw_sign_1', 'prop_highway_sign', 69, 78.5, true, 48, 14, 10);
  addProp('hw_sign_2', 'prop_highway_sign', 102, 78.5, true, 48, 14, 10);
  addProp('hw_sign_3', 'prop_highway_sign', 76, 102.5, true, 48, 14, 10);

  // Expanded Traffic Lights (Luxury Blvd, Industrial Blvd, Coastal Ave)
  addProp('tl_5', 'prop_traffic_light', 92.6, 25.5, true, 12, 10, 18);
  addProp('tl_6', 'prop_traffic_light', 97.4, 30.5, true, 12, 10, 18);
  addProp('tl_7', 'prop_traffic_light', 92.6, 48.5, true, 12, 10, 18);
  addProp('tl_8', 'prop_traffic_light', 129.6, 25.5, true, 12, 10, 18);

  // 6 New District Bus Stops matching BUS_STOPS in cityLifeData.ts
  addProp('bus_stop_luxury', 'prop_bus_stop', 96.0, 25.2, true, 54, 20, 10);
  addProp('bus_stop_airport', 'prop_bus_stop', 132.0, 25.2, true, 54, 20, 10);
  addProp('bus_stop_industrial', 'prop_bus_stop', 96.0, 48.8, true, 54, 20, 10);
  addProp('bus_stop_beach', 'prop_bus_stop', 134.5, 65.2, true, 54, 20, 10);
  addProp('bus_stop_countryside', 'prop_bus_stop', 28.0, 77.2, true, 54, 20, 10);
  addProp('bus_stop_highway_mall', 'prop_bus_stop', 94.0, 84.8, true, 54, 20, 10);

  // 6 New District Signposts
  addProp('sign_luxury', 'prop_signpost', 91.5, 25.0, true, 16, 12, 10);
  addProp('sign_airport', 'prop_signpost', 124.5, 25.0, true, 16, 12, 10);
  addProp('sign_industrial', 'prop_signpost', 91.5, 48.5, true, 16, 12, 10);
  addProp('sign_beach', 'prop_signpost', 134.0, 56.5, true, 16, 12, 10);
  addProp('sign_countryside', 'prop_signpost', 25.5, 76.5, true, 16, 12, 10);
  addProp('sign_highway', 'prop_signpost', 71.5, 84.5, true, 16, 12, 10);

  // 14 Collectible Starlight Shards scattered across all 11 districts
  const SHARD_LOCATIONS: Array<{id: string; tx: number; ty: number; district: string}> = [
    {id: 'shard_01', tx: 14, ty: 15, district: 'Downtown Civic Plaza'},
    {id: 'shard_02', tx: 40.5, ty: 6.5, district: 'Central Park Lily Pond'},
    {id: 'shard_03', tx: 65, ty: 12, district: 'Residential Gardens'},
    {id: 'shard_04', tx: 12, ty: 40, district: 'Shopping Promenade'},
    {id: 'shard_05', tx: 75, ty: 38, district: 'Entertainment Court'},
    {id: 'shard_06', tx: 109, ty: 12, district: 'Luxury Heights Plaza'},
    {id: 'shard_07', tx: 90, ty: 10, district: 'CCPD Precinct Walk'},
    {id: 'shard_08', tx: 140, ty: 13, district: 'Starlight Airport Runway'},
    {id: 'shard_09', tx: 114, ty: 48, district: 'Ironworks Freight Yard'},
    {id: 'shard_10', tx: 139, ty: 54, district: 'Pacific Boardwalk North'},
    {id: 'shard_11', tx: 138, ty: 96, district: 'Pacific Boardwalk South'},
    {id: 'shard_12', tx: 14, ty: 74, district: 'Emerald Valley Farmstead'},
    {id: 'shard_13', tx: 42, ty: 96, district: 'Emerald Valley Meadows'},
    {id: 'shard_14', tx: 81, ty: 95, district: 'Metro Expressway Plaza'},
  ];
  for (const sh of SHARD_LOCATIONS) {
    addProp(sh.id, 'prop_starlight_shard', sh.tx, sh.ty, false);
  }

  // Prompt 11 — 12 Collectible Relics & 6 Secret Discovery Portals
  for (const relic of COLLECTIBLE_RELICS) {
    addProp(relic.id, relic.texture, relic.tileX, relic.tileY, false);
  }
  for (const secret of SECRET_LOCATIONS) {
    addProp(`portal_${secret.id}`, 'prop_secret_portal', secret.entryTileX, secret.entryTileY, false);
  }

  // 8. Interactive Objects (Every building entrance + City Landmarks & Benches)
  const buildingInteractives: InteractiveObjectData[] = buildings.map((b) => ({
    id: `enter_${b.id}`,
    kind: 'building_entrance',
    buildingId: b.id,
    title: b.label,
    subtitle: b.categoryLabel,
    description: `Enter ${b.label}.`,
    promptLabel: `Enter ${b.label}`,
    x: b.doorTileX * TILE_SIZE,
    y: b.doorTileY * TILE_SIZE,
    radius: 54,
  }));

  const interactives: InteractiveObjectData[] = [
    ...buildingInteractives,
    {
      id: 'int_fountain',
      kind: 'fountain_flip',
      title: 'Central Park Fountain · Coin Flip',
      subtitle: 'Central Park · 2D Cutscene & Luck Challenge',
      description:
        'Step up to the Wishing Fountain, pick Heads or Tails, and watch your lucky coin flip into the sparkling water!',
      promptLabel: 'Play Fountain Coin Flip',
      x: 40.5 * TILE_SIZE,
      y: 15.8 * TILE_SIZE,
      radius: 78,
      details: [
        'Call Heads or Tails for +22 Coins & +32 XP on a win',
        'Restores +10 Energy and mints the Lucky Fountain Medallion',
      ],
      actionLabel: 'Flip Coin at Fountain',
      miniGameId: 'fountain_flip',
    },
    {
      id: 'int_fountain_north',
      kind: 'fountain_flip',
      title: 'North Meadow Fountain · Coin Flip',
      subtitle: 'Central Park · Spring Basin',
      description:
        'A quiet marble garden fountain fed by spring water near the Central Park lily pond. Flip a lucky coin for rewards!',
      promptLabel: 'Play Fountain Coin Flip',
      x: 35.5 * TILE_SIZE,
      y: 10.2 * TILE_SIZE,
      radius: 62,
      details: [
        'Clear spring water keeps the park meadow lush',
        'Win Coins, XP & +10 Energy on every lucky flip',
      ],
      actionLabel: 'Flip Coin at Fountain',
      miniGameId: 'fountain_flip',
    },
    {
      id: 'int_bench_park_n',
      kind: 'bench',
      title: 'Central Park Bench',
      subtitle: 'Central Park · North Promenade',
      description: 'Take a seat and enjoy the breeze by the fountain.',
      promptLabel: 'Sit on Park Bench',
      x: 36.5 * TILE_SIZE,
      y: 12.6 * TILE_SIZE,
      radius: 46,
      seatX: 36.5 * TILE_SIZE,
      seatY: 12.35 * TILE_SIZE,
    },
    {
      id: 'int_bench_park_s',
      kind: 'bench',
      title: 'Central Park Bench',
      subtitle: 'Central Park · South Lawn',
      description: 'Rest your feet in the shade of the park oaks.',
      promptLabel: 'Sit on Park Bench',
      x: 43.5 * TILE_SIZE,
      y: 18.6 * TILE_SIZE,
      radius: 46,
      seatX: 43.5 * TILE_SIZE,
      seatY: 18.35 * TILE_SIZE,
    },
    {
      id: 'int_bench_downtown',
      kind: 'bench',
      title: 'Downtown Plaza Bench',
      subtitle: 'Downtown · Mission House Forecourt',
      description: 'Watch city life pass across Downtown Plaza near The Mission House.',
      promptLabel: 'Sit on Plaza Bench',
      x: 13.5 * TILE_SIZE,
      y: 15.1 * TILE_SIZE,
      radius: 46,
      seatX: 13.5 * TILE_SIZE,
      seatY: 14.85 * TILE_SIZE,
    },
    {
      id: 'int_bench_court',
      kind: 'bench',
      title: 'Courtside Bench',
      subtitle: 'Entertainment Zone · Basketball Court',
      description: 'Catch your breath courtside between pickup games.',
      promptLabel: 'Sit Courtside',
      x: 62.5 * TILE_SIZE,
      y: 46.6 * TILE_SIZE,
      radius: 46,
      seatX: 62.5 * TILE_SIZE,
      seatY: 46.35 * TILE_SIZE,
    },
    {
      id: 'int_mailbox',
      kind: 'mailbox',
      title: 'Neighborhood Postbox',
      subtitle: 'Residential District · Bluebird Lane',
      description:
        'Check resident letters, city bulletins, and claim your stamped Welcome Postcard coin gift.',
      promptLabel: 'Open Neighborhood Postbox',
      x: 62 * TILE_SIZE,
      y: 12.8 * TILE_SIZE,
      radius: 46,
      details: [
        'City Courier Delivery: Daily resident postcards',
        'Claim your Bluebird Lane Welcome Postcard (+10c)',
      ],
      actionLabel: 'Collect Postcard (+10c)',
    },
    {
      id: 'int_basketball',
      kind: 'basketball',
      title: 'Eastside Streetball Court',
      subtitle: 'Entertainment District · Outdoor Mini-Game',
      description:
        'Step onto the hardwood court and sink timed shots in the Eastside Streetball Shootout to win real coins!',
      promptLabel: 'Play Streetball Shootout',
      x: 63.5 * TILE_SIZE,
      y: 40.5 * TILE_SIZE,
      radius: 68,
      actionLabel: 'Start Streetball Challenge',
    },
    {
      id: 'int_soccer',
      kind: 'soccer',
      title: 'Eastside Soccer Pitch',
      subtitle: 'Entertainment District · Penalty Kick Challenge',
      description:
        'Line up on the penalty spot and beat the diving goalkeeper in a 5-kick shootout for coin rewards!',
      promptLabel: 'Play Penalty Shootout',
      x: 73.5 * TILE_SIZE,
      y: 43.5 * TILE_SIZE,
      radius: 68,
      actionLabel: 'Kick Off Penalty Shootout',
    },
    {
      id: 'int_fishing_pond',
      kind: 'fishing_spot',
      title: 'Lily Pond Fishing Pier',
      subtitle: 'Central Park · Fishing Mini-Game',
      description:
        'Cast your bobber into Central Park Lily Pond, watch the ripples, and reel in Golden Koi & Starlight Carp for Coins and XP!',
      promptLabel: 'Go Fishing at Lily Pond',
      x: 45.5 * TILE_SIZE,
      y: 9.4 * TILE_SIZE,
      radius: 58,
      miniGameId: 'fishing_pond',
      actionLabel: 'Cast Fishing Line',
    },
    {
      id: 'int_park_sprint',
      kind: 'park_sprint',
      title: 'Central Park Agility Sprint',
      subtitle: 'Central Park · Timed Foot Challenge',
      description:
        'Sprint through 4 cobblestone checkpoint rings around Central Park within 40 seconds to win Coins & XP.',
      promptLabel: 'Start Park Agility Sprint',
      x: 40.5 * TILE_SIZE,
      y: 21.5 * TILE_SIZE,
      radius: 56,
      miniGameId: 'park_sprint',
      actionLabel: 'Start 40s Sprint Challenge',
    },
    {
      id: 'int_race_trial',
      kind: 'race_trial',
      title: 'Boulevard Racing Time Trial',
      subtitle: 'Central Blvd · Checkpoint Race',
      description:
        'Launch a 4-checkpoint timed street lap around Chaos City Boulevards! Best done in your customized ride.',
      promptLabel: 'Start Boulevard Time Trial',
      x: 32.5 * TILE_SIZE,
      y: 26.2 * TILE_SIZE,
      radius: 64,
      miniGameId: 'race_trial',
      actionLabel: 'Start 55s Time Trial',
    },
    {
      id: 'int_delivery_desk',
      kind: 'delivery_desk',
      title: 'Express Courier Desk',
      subtitle: 'Downtown · Timed Delivery Challenge',
      description:
        'Accept an urgent city parcel and deliver it to the destination shopfront within 50 seconds for Coins & XP!',
      promptLabel: 'Start Express Delivery',
      x: 19.2 * TILE_SIZE,
      y: 24.6 * TILE_SIZE,
      radius: 54,
      miniGameId: 'courier_delivery',
      actionLabel: 'Accept Express Parcel',
    },
    {
      id: 'int_memory_kiosk',
      kind: 'memory_kiosk',
      title: 'Neon Memory & Reflex Arena',
      subtitle: 'Entertainment Plaza · Arcade Challenge',
      description:
        'Test your memory and reaction speed on the glowing 4-color neon pad terminal for Coin & XP payouts!',
      promptLabel: 'Play Neon Memory Arena',
      x: 54.5 * TILE_SIZE,
      y: 37.5 * TILE_SIZE,
      radius: 56,
      miniGameId: 'neon_memory',
      actionLabel: 'Play Neon Memory',
    },
    {
      id: 'int_bus_dt',
      kind: 'bus_stop',
      busStopId: 'stop_downtown',
      title: 'Downtown Civic Bus Stop',
      subtitle: 'Chaos Transit Loop',
      description: 'Catch the city shuttle across Downtown, Central Park, Entertainment Plaza, and Chaos Customs.',
      promptLabel: 'Use City Bus Transit',
      x: 21.5 * TILE_SIZE,
      y: 26.2 * TILE_SIZE,
      radius: 52,
    },
    {
      id: 'int_bus_park',
      kind: 'bus_stop',
      busStopId: 'stop_park',
      title: 'Central Park South Bus Stop',
      subtitle: 'Chaos Transit Loop',
      description: 'Catch the city shuttle across Downtown, Central Park, Entertainment Plaza, and Chaos Customs.',
      promptLabel: 'Use City Bus Transit',
      x: 42.0 * TILE_SIZE,
      y: 26.2 * TILE_SIZE,
      radius: 52,
    },
    {
      id: 'int_bus_ent',
      kind: 'bus_stop',
      busStopId: 'stop_entertainment',
      title: 'Arcade & Cinema Bus Stop',
      subtitle: 'Chaos Transit Loop',
      description: 'Catch the city shuttle across Downtown, Central Park, Entertainment Plaza, and Chaos Customs.',
      promptLabel: 'Use City Bus Transit',
      x: 50.0 * TILE_SIZE,
      y: 49.0 * TILE_SIZE,
      radius: 52,
    },
    {
      id: 'int_bus_garage',
      kind: 'bus_stop',
      busStopId: 'stop_garage',
      title: 'Chaos Customs Bus Stop',
      subtitle: 'Chaos Transit Loop',
      description: 'Catch the city shuttle right outside Chaos Customs Garage.',
      promptLabel: 'Use City Bus Transit',
      x: 64.5 * TILE_SIZE,
      y: 30.8 * TILE_SIZE,
      radius: 52,
    },
    {
      id: 'int_sign_park',
      kind: 'district_sign',
      districtId: 'central_park',
      title: 'Central Park Directory',
      subtitle: 'District Signboard · Central Park',
      description:
        'Welcome to Central Park. Follow the cobblestone paths north to the Central Fountain, flowerbeds, and lily pond.',
      promptLabel: 'Check Central Park Map',
      x: 36.5 * TILE_SIZE,
      y: 25.0 * TILE_SIZE,
      radius: 44,
      details: [
        'West: Downtown Towers & Civic Plaza',
        'South: Shopping District',
        'East: Residential District',
      ],
      actionLabel: 'Open Interactive City Map',
    },
    {
      id: 'int_sign_downtown',
      kind: 'district_sign',
      districtId: 'downtown',
      title: 'Downtown Directory',
      subtitle: 'District Signboard · Downtown',
      description:
        'Downtown houses Apex Tech Center, Skyline Commerce Office, Harbor Lofts, Central Bank, and Metro Health Clinic.',
      promptLabel: 'Check Downtown Map',
      x: 25.0 * TILE_SIZE,
      y: 25.0 * TILE_SIZE,
      radius: 44,
      details: [
        'East: Central Park',
        'South: Shopping Promenade',
      ],
      actionLabel: 'Open Interactive City Map',
    },
    {
      id: 'int_sign_shopping',
      kind: 'district_sign',
      districtId: 'shopping',
      title: 'Shopping District Directory',
      subtitle: 'District Signboard · Shopping District',
      description:
        'Explore Threadz Boutique, Bean & Byte Cafe, FreshMart Grocery, Sunset Bistro, Glow & Snip Salon, and IronWorks Gym.',
      promptLabel: 'Check Shopping Map',
      x: 22.5 * TILE_SIZE,
      y: 32.3 * TILE_SIZE,
      radius: 44,
      actionLabel: 'Open Interactive City Map',
    },
    {
      id: 'int_sign_residential',
      kind: 'district_sign',
      districtId: 'residential',
      title: 'Residential District Directory',
      subtitle: 'District Signboard · Bluebird Lane',
      description:
        'Quiet garden homes and Maple Crest Apartments with full kitchens, living room TVs, personal computers, and bedrooms.',
      promptLabel: 'Check Residential Map',
      x: 55.7 * TILE_SIZE,
      y: 25.0 * TILE_SIZE,
      radius: 44,
      actionLabel: 'Open Interactive City Map',
    },
    {
      id: 'int_sign_entertainment',
      kind: 'district_sign',
      districtId: 'entertainment',
      title: 'Entertainment District Directory',
      subtitle: 'District Signboard · Plaza',
      description:
        'Home to Pixel Palace Arcade, Starlight Cinema, Chaos Customs Garage, Streetball Court, and Eastside Soccer Pitch.',
      promptLabel: 'Check Entertainment Map',
      x: 51.0 * TILE_SIZE,
      y: 40.0 * TILE_SIZE,
      radius: 44,
      actionLabel: 'Open Interactive City Map',
    },
    // Prompt 09 Bus Stops
    {
      id: 'int_bus_luxury',
      kind: 'bus_stop',
      busStopId: 'stop_luxury',
      title: 'Luxury Heights Bus Stop',
      subtitle: 'Chaos Transit Loop',
      description: 'Shuttle connection across all 10 Chaos City Bus Stops.',
      promptLabel: 'Use City Bus Transit',
      x: 96.0 * TILE_SIZE,
      y: 26.2 * TILE_SIZE,
      radius: 54,
    },
    {
      id: 'int_bus_airport',
      kind: 'bus_stop',
      busStopId: 'stop_airport',
      title: 'Starlight Airport Terminal Stop',
      subtitle: 'Chaos Transit Loop',
      description: 'Shuttle connection across all 10 Chaos City Bus Stops.',
      promptLabel: 'Use City Bus Transit',
      x: 132.0 * TILE_SIZE,
      y: 26.2 * TILE_SIZE,
      radius: 54,
    },
    {
      id: 'int_bus_industrial',
      kind: 'bus_stop',
      busStopId: 'stop_industrial',
      title: 'Ironworks & Train Hub Stop',
      subtitle: 'Chaos Transit Loop',
      description: 'Shuttle connection across all 10 Chaos City Bus Stops.',
      promptLabel: 'Use City Bus Transit',
      x: 96.0 * TILE_SIZE,
      y: 50.0 * TILE_SIZE,
      radius: 54,
    },
    {
      id: 'int_bus_beach',
      kind: 'bus_stop',
      busStopId: 'stop_beach',
      title: 'Pacific Boardwalk Bus Stop',
      subtitle: 'Chaos Transit Loop',
      description: 'Shuttle connection across all 10 Chaos City Bus Stops.',
      promptLabel: 'Use City Bus Transit',
      x: 135.0 * TILE_SIZE,
      y: 66.0 * TILE_SIZE,
      radius: 54,
    },
    {
      id: 'int_bus_countryside',
      kind: 'bus_stop',
      busStopId: 'stop_countryside',
      title: 'Emerald Valley Bus Stop',
      subtitle: 'Chaos Transit Loop',
      description: 'Shuttle connection across all 10 Chaos City Bus Stops.',
      promptLabel: 'Use City Bus Transit',
      x: 28.0 * TILE_SIZE,
      y: 78.0 * TILE_SIZE,
      radius: 54,
    },
    {
      id: 'int_bus_highway_mall',
      kind: 'bus_stop',
      busStopId: 'stop_highway_mall',
      title: 'Metro Expressway Plaza Stop',
      subtitle: 'Chaos Transit Loop',
      description: 'Shuttle connection across all 10 Chaos City Bus Stops.',
      promptLabel: 'Use City Bus Transit',
      x: 94.0 * TILE_SIZE,
      y: 86.0 * TILE_SIZE,
      radius: 54,
    },
    // Prompt 09 District Signposts
    {
      id: 'int_sign_luxury',
      kind: 'district_sign',
      districtId: 'luxury',
      title: 'Luxury Heights Directory',
      subtitle: 'District Signboard · Luxury Heights',
      description: 'Home to Grand Starlight Hotel, Starlight Lucky Lounge, Prestige Motors, CCPD HQ & City Hospital.',
      promptLabel: 'Check Luxury Map',
      x: 92.0 * TILE_SIZE,
      y: 25.5 * TILE_SIZE,
      radius: 44,
      actionLabel: 'Open Interactive City Map',
    },
    {
      id: 'int_sign_airport',
      kind: 'district_sign',
      districtId: 'airport',
      title: 'Starlight Airport Directory',
      subtitle: 'District Signboard · Airport',
      description: 'Catch the coastal transit concourse, duty-free boutiques, and jet apron.',
      promptLabel: 'Check Airport Map',
      x: 125.0 * TILE_SIZE,
      y: 25.5 * TILE_SIZE,
      radius: 44,
      actionLabel: 'Open Interactive City Map',
    },
    {
      id: 'int_sign_industrial',
      kind: 'district_sign',
      districtId: 'industrial',
      title: 'Ironworks Industrial Directory',
      subtitle: 'District Signboard · Industrial Zone',
      description: 'Chaos Fire Station, Apex Repair Workshop, Central Rail Station & Freight Warehouse.',
      promptLabel: 'Check Industrial Map',
      x: 92.0 * TILE_SIZE,
      y: 49.0 * TILE_SIZE,
      radius: 44,
      actionLabel: 'Open Interactive City Map',
    },
    {
      id: 'int_sign_beach',
      kind: 'district_sign',
      districtId: 'beach',
      title: 'Pacific Boardwalk Directory',
      subtitle: 'District Signboard · Oceanfront',
      description: 'Golden ocean beach, timber boardwalk, and Pacific Boardwalk Cafe.',
      promptLabel: 'Check Beach Map',
      x: 134.5 * TILE_SIZE,
      y: 57.0 * TILE_SIZE,
      radius: 44,
      actionLabel: 'Open Interactive City Map',
    },
    {
      id: 'int_sign_countryside',
      kind: 'district_sign',
      districtId: 'countryside',
      title: 'Emerald Valley Directory',
      subtitle: 'District Signboard · Countryside',
      description: 'Rolling crop rows, country trails, and Emerald Valley Farm Market.',
      promptLabel: 'Check Countryside Map',
      x: 26.0 * TILE_SIZE,
      y: 77.0 * TILE_SIZE,
      radius: 44,
      actionLabel: 'Open Interactive City Map',
    },
    {
      id: 'int_sign_highway',
      kind: 'district_sign',
      districtId: 'highway',
      title: 'Metro Expressway Directory',
      subtitle: 'District Signboard · Expressway',
      description: 'Canal bridges linking Emerald Valley to Starlight Grand Mall & Pulse Music Store.',
      promptLabel: 'Check Expressway Map',
      x: 72.0 * TILE_SIZE,
      y: 85.0 * TILE_SIZE,
      radius: 44,
      actionLabel: 'Open Interactive City Map',
    },
    // Collectible Starlight Shards
    ...SHARD_LOCATIONS.map(
      (sh): InteractiveObjectData => ({
        id: `int_${sh.id}`,
        kind: 'collectible_shard',
        collectibleId: sh.id,
        title: 'Starlight Shard',
        subtitle: sh.district,
        description: 'Collect this glowing Starlight Shard for +25 Coins & +30 XP!',
        promptLabel: 'Collect Starlight Shard (+25c)',
        x: sh.tx * TILE_SIZE + TILE_SIZE * 0.5,
        y: sh.ty * TILE_SIZE + TILE_SIZE * 0.5,
        radius: 44,
      }),
    ),
    // Prompt 11 Collectible Relics (Hidden exploration rewards)
    ...COLLECTIBLE_RELICS.map(
      (relic): InteractiveObjectData => ({
        id: `int_relic_${relic.id}`,
        kind: 'collectible_relic',
        collectibleId: relic.id,
        districtId: relic.districtId,
        title: relic.name,
        subtitle: `${relic.rarity.toUpperCase()} Relic · ${getDistrictName(relic.districtId)}`,
        description: relic.hint,
        promptLabel: `Collect ${relic.name} (+${relic.rewardCoins}c)`,
        x: relic.tileX * TILE_SIZE + TILE_SIZE * 0.5,
        y: relic.tileY * TILE_SIZE + TILE_SIZE * 0.5,
        radius: 46,
      }),
    ),
    // Prompt 11 Secret Locations (Undiscovered until visited)
    ...SECRET_LOCATIONS.map(
      (secret): InteractiveObjectData => ({
        id: `int_secret_${secret.id}`,
        kind: 'secret_portal',
        secretId: secret.id,
        districtId: secret.districtId,
        title: secret.name,
        subtitle: `Secret Spot · ${getDistrictName(secret.districtId)}`,
        description: secret.description,
        promptLabel: `Discover ${secret.name}`,
        x: secret.entryTileX * TILE_SIZE + TILE_SIZE * 0.5,
        y: secret.entryTileY * TILE_SIZE + TILE_SIZE * 0.5,
        radius: 52,
        targetX: secret.exitTileX * TILE_SIZE,
        targetY: secret.exitTileY * TILE_SIZE,
      }),
    ),
    // Prompt 11 Property Purchase / Management Signposts beside residences
    ...PROPERTIES_CATALOG.map(
      (prop): InteractiveObjectData => ({
        id: `prop_sign_${prop.id}`,
        kind: 'property_sign',
        propertyId: prop.id,
        buildingId: prop.buildingId,
        districtId: prop.districtId,
        title: `${prop.name} (${prop.tierLabel})`,
        subtitle: `${prop.districtName} · ${prop.price} Coins`,
        description: prop.description,
        promptLabel: `Inspect / Buy ${prop.name}`,
        x: prop.exteriorX + TILE_SIZE * 1.6,
        y: prop.exteriorY - TILE_SIZE * 0.4,
        radius: 48,
      }),
    ),
  ];

  // 9. Living City NPCs (14 unique residents with daily schedules, benches, shops, bus stops & pets)
  const npcs: NPCConfig[] = [
    {
      id: 'npc_maya',
      name: 'Maya',
      role: 'Barista',
      district: 'shopping',
      speed: 58,
      greeting: 'Fresh espresso just finished brewing at Bean & Byte. The patio breeze is great today!',
      chatLines: [
        'Morning rushes are wild—half of Downtown stops here before opening their shops!',
        'Try our Caramel Cold Brew if your energy dips below 50%.',
        'I wrap up my cafe shift at dusk and catch the evening show over at Starlight Cinema.',
      ],
      preset: {
        id: 'npc_maya',
        name: 'Maya',
        gender: 'female',
        tagline: 'Barista',
        skinColor: '#e0ac69',
        hairColor: '#3b1d14',
        hairStyle: 'bob',
        eyeStyle: 'lashes',
        eyeColor: '#0f172a',
        browStyle: 'arched',
        facialDetail: 'freckles',
        facialHair: 'none',
        shirtColor: '#10b981',
        shirtAccent: '#fef3c7',
        pantsColor: '#1e293b',
        shoeColor: '#f8fafc',
      },
      waypoints: [
        {x: 8.5 * TILE_SIZE, y: 38.5 * TILE_SIZE, waitMs: 2600, face: 'down', emote: '☕'},
        {x: 13.5 * TILE_SIZE, y: 38.5 * TILE_SIZE, waitMs: 2200, face: 'left'},
        {x: 13.5 * TILE_SIZE, y: 32.0 * TILE_SIZE, waitMs: 1800, face: 'right'},
      ],
      routine: [
        {
          phase: 'morning',
          activity: 'cafe',
          locationLabel: 'Bean & Byte Patio',
          waypoints: [
            {x: 7.5 * TILE_SIZE, y: 38.5 * TILE_SIZE, waitMs: 2800, face: 'down', emote: '☕'},
            {x: 13.5 * TILE_SIZE, y: 38.5 * TILE_SIZE, waitMs: 2200, face: 'left'},
          ],
        },
        {
          phase: 'afternoon',
          activity: 'shopping',
          locationLabel: 'Shopping Promenade',
          waypoints: [
            {x: 13.5 * TILE_SIZE, y: 32.0 * TILE_SIZE, waitMs: 2200, face: 'down', emote: '💬'},
            {x: 18.0 * TILE_SIZE, y: 38.0 * TILE_SIZE, waitMs: 2600, face: 'up'},
          ],
        },
        {
          phase: 'dusk',
          activity: 'bench',
          locationLabel: 'Sunset Bistro Patio',
          waypoints: [
            {x: 9.5 * TILE_SIZE, y: 48.0 * TILE_SIZE, waitMs: 3200, face: 'right', emote: '🌇'},
            {x: 13.5 * TILE_SIZE, y: 42.0 * TILE_SIZE, waitMs: 2400, face: 'down'},
          ],
        },
        {
          phase: 'night',
          activity: 'patrol',
          locationLabel: 'Starlight Cinema Plaza',
          waypoints: [
            {x: 45.5 * TILE_SIZE, y: 47.2 * TILE_SIZE, waitMs: 3000, face: 'up', emote: '🎬'},
            {x: 49.0 * TILE_SIZE, y: 47.2 * TILE_SIZE, waitMs: 2400, face: 'left'},
          ],
        },
      ],
    },
    {
      id: 'npc_clara',
      name: 'Clara',
      role: 'Botanist & Dog Walker',
      district: 'central_park',
      speed: 62,
      greeting: 'The Central Park tulips are blooming early! Biscuit loves jogging past both fountains.',
      chatLines: [
        'Biscuit always pulls toward the Central Fountain whenever the water jets chime.',
        'Have you checked the lily pond in north Central Park? Peaceful spot after a busy day.',
      ],
      hasPet: {species: 'dog', color: '#f59e0b'},
      preset: {
        id: 'npc_clara',
        name: 'Clara',
        gender: 'female',
        tagline: 'Botanist',
        skinColor: '#ffdbac',
        hairColor: '#b45309',
        hairStyle: 'long_waves',
        eyeStyle: 'wide',
        eyeColor: '#059669',
        browStyle: 'soft',
        facialDetail: 'blush',
        facialHair: 'none',
        shirtColor: '#f43f5e',
        shirtAccent: '#ffe4e6',
        pantsColor: '#334155',
        shoeColor: '#e2e8f0',
      },
      waypoints: [
        {x: 36.5 * TILE_SIZE, y: 15.5 * TILE_SIZE, waitMs: 2400, face: 'right', emote: '🐾'},
        {x: 36.5 * TILE_SIZE, y: 19.5 * TILE_SIZE, waitMs: 2000, face: 'down'},
        {x: 40.5 * TILE_SIZE, y: 23.0 * TILE_SIZE, waitMs: 1800, face: 'left'},
      ],
      routine: [
        {
          phase: 'morning',
          activity: 'pet_walk',
          locationLabel: 'Central Park Paths',
          waypoints: [
            {x: 35.5 * TILE_SIZE, y: 15.5 * TILE_SIZE, waitMs: 2000, face: 'right', emote: '🐾'},
            {x: 40.5 * TILE_SIZE, y: 22.5 * TILE_SIZE, waitMs: 2000, face: 'down'},
          ],
        },
        {
          phase: 'afternoon',
          activity: 'bench',
          locationLabel: 'North Meadow Fountain',
          waypoints: [
            {x: 36.5 * TILE_SIZE, y: 12.6 * TILE_SIZE, waitMs: 3600, face: 'down', emote: '🌿'},
            {x: 40.5 * TILE_SIZE, y: 19.0 * TILE_SIZE, waitMs: 2200, face: 'up'},
          ],
        },
        {
          phase: 'dusk',
          activity: 'pet_walk',
          locationLabel: 'Park South Promenade',
          waypoints: [
            {x: 34.5 * TILE_SIZE, y: 25.5 * TILE_SIZE, waitMs: 2200, face: 'right', emote: '🐾'},
            {x: 43.0 * TILE_SIZE, y: 25.5 * TILE_SIZE, waitMs: 2200, face: 'left'},
          ],
        },
        {
          phase: 'night',
          activity: 'patrol',
          locationLabel: 'Residential Bluebird Lane',
          waypoints: [
            {x: 59.0 * TILE_SIZE, y: 14.5 * TILE_SIZE, waitMs: 3000, face: 'down', emote: '🌙'},
            {x: 64.5 * TILE_SIZE, y: 14.5 * TILE_SIZE, waitMs: 2400, face: 'left'},
          ],
        },
      ],
    },
    {
      id: 'npc_leo',
      name: 'Leo',
      role: 'Streetballer',
      district: 'entertainment',
      speed: 78,
      greeting: 'Yo! Warming up on Eastside Court. Challenge me on the basketball or soccer pitch anytime!',
      chatLines: [
        'Smooth release beats power shots every time in Streetball Shootout.',
        'Saw a custom matte black Apex GT roll out of Chaos Customs just north of here!',
      ],
      preset: {
        id: 'npc_leo',
        name: 'Leo',
        gender: 'male',
        tagline: 'Streetballer',
        skinColor: '#8d5524',
        hairColor: '#0f172a',
        hairStyle: 'short',
        eyeStyle: 'sharp',
        eyeColor: '#0f172a',
        browStyle: 'thick',
        facialDetail: 'none',
        facialHair: 'goatee',
        shirtColor: '#f97316',
        shirtAccent: '#fef08a',
        pantsColor: '#0f172a',
        shoeColor: '#38bdf8',
      },
      waypoints: [
        {x: 59.5 * TILE_SIZE, y: 39.5 * TILE_SIZE, waitMs: 1500, face: 'right', emote: '🏀'},
        {x: 66.5 * TILE_SIZE, y: 39.5 * TILE_SIZE, waitMs: 1800, face: 'left'},
        {x: 66.5 * TILE_SIZE, y: 42.5 * TILE_SIZE, waitMs: 1400, face: 'up'},
      ],
      routine: [
        {
          phase: 'morning',
          activity: 'sports',
          locationLabel: 'Eastside Streetball Court',
          waypoints: [
            {x: 59.5 * TILE_SIZE, y: 39.5 * TILE_SIZE, waitMs: 1800, face: 'right', emote: '🏀'},
            {x: 66.5 * TILE_SIZE, y: 42.0 * TILE_SIZE, waitMs: 1800, face: 'left'},
          ],
        },
        {
          phase: 'afternoon',
          activity: 'sports',
          locationLabel: 'Eastside Soccer Pitch',
          waypoints: [
            {x: 71.5 * TILE_SIZE, y: 42.5 * TILE_SIZE, waitMs: 2200, face: 'right', emote: '⚽'},
            {x: 74.5 * TILE_SIZE, y: 44.5 * TILE_SIZE, waitMs: 2000, face: 'left'},
          ],
        },
        {
          phase: 'dusk',
          activity: 'bench',
          locationLabel: 'Courtside Bench',
          waypoints: [
            {x: 62.5 * TILE_SIZE, y: 46.4 * TILE_SIZE, waitMs: 3600, face: 'up', emote: '💧'},
            {x: 58.0 * TILE_SIZE, y: 46.4 * TILE_SIZE, waitMs: 2000, face: 'right'},
          ],
        },
        {
          phase: 'night',
          activity: 'patrol',
          locationLabel: 'Pixel Palace Arcade',
          waypoints: [
            {x: 46.5 * TILE_SIZE, y: 38.2 * TILE_SIZE, waitMs: 2800, face: 'up', emote: '🕹️'},
            {x: 50.0 * TILE_SIZE, y: 38.2 * TILE_SIZE, waitMs: 2400, face: 'left'},
          ],
        },
      ],
    },
    {
      id: 'npc_dex',
      name: 'Dex',
      role: 'City Courier',
      district: 'downtown',
      speed: 74,
      greeting: 'Downtown avenues connect straight through Central Park to Bluebird Lane. Express routes all day!',
      chatLines: [
        'Pro tip: use any of the 4 city Bus Stops to zip across districts in seconds.',
        'I upgraded my commuter coupe at Chaos Customs—the Turbo Spool makes hill climbs effortless.',
      ],
      preset: {
        id: 'npc_dex',
        name: 'Dex',
        gender: 'male',
        tagline: 'Courier',
        skinColor: '#f1c27d',
        hairColor: '#1e293b',
        hairStyle: 'cap',
        eyeStyle: 'classic',
        eyeColor: '#0284c7',
        browStyle: 'natural',
        facialDetail: 'none',
        facialHair: 'stubble',
        shirtColor: '#38bdf8',
        shirtAccent: '#0f172a',
        pantsColor: '#1e293b',
        shoeColor: '#facc15',
      },
      waypoints: [
        {x: 11.5 * TILE_SIZE, y: 15.5 * TILE_SIZE, waitMs: 2000, face: 'down', emote: '📦'},
        {x: 16.5 * TILE_SIZE, y: 15.5 * TILE_SIZE, waitMs: 1800, face: 'down'},
        {x: 17.5 * TILE_SIZE, y: 22.5 * TILE_SIZE, waitMs: 2200, face: 'left'},
      ],
      routine: [
        {
          phase: 'morning',
          activity: 'patrol',
          locationLabel: 'Downtown Civic Plaza',
          waypoints: [
            {x: 11.5 * TILE_SIZE, y: 15.5 * TILE_SIZE, waitMs: 2000, face: 'down', emote: '📦'},
            {x: 17.5 * TILE_SIZE, y: 22.5 * TILE_SIZE, waitMs: 2200, face: 'left'},
          ],
        },
        {
          phase: 'afternoon',
          activity: 'bus_stop',
          locationLabel: 'Downtown Bus Stop',
          waypoints: [
            {x: 21.5 * TILE_SIZE, y: 25.8 * TILE_SIZE, waitMs: 3600, face: 'down', emote: '🚌'},
            {x: 17.0 * TILE_SIZE, y: 25.8 * TILE_SIZE, waitMs: 2000, face: 'right'},
          ],
        },
        {
          phase: 'dusk',
          activity: 'patrol',
          locationLabel: 'Central Bank Walk',
          waypoints: [
            {x: 22.0 * TILE_SIZE, y: 21.0 * TILE_SIZE, waitMs: 2400, face: 'down'},
            {x: 13.5 * TILE_SIZE, y: 19.6 * TILE_SIZE, waitMs: 3000, face: 'down', emote: '💬'},
          ],
        },
        {
          phase: 'night',
          activity: 'bench',
          locationLabel: 'Downtown Plaza Bench',
          waypoints: [
            {x: 13.5 * TILE_SIZE, y: 19.6 * TILE_SIZE, waitMs: 4000, face: 'down', emote: '🌙'},
            {x: 10.5 * TILE_SIZE, y: 19.6 * TILE_SIZE, waitMs: 2200, face: 'right'},
          ],
        },
      ],
    },
    {
      id: 'npc_sam',
      name: 'Sam',
      role: 'Neighborhood Host',
      district: 'residential',
      speed: 55,
      greeting: 'Quiet streets on Bluebird Lane. Drop by Clover Residence or Maple Crest Apartments anytime!',
      chatLines: [
        'Don’t forget to check the Bluebird Lane Postbox if you haven’t grabbed your welcome postcard yet.',
        'At sunset I usually stroll over to Central Park for the evening breeze.',
      ],
      preset: {
        id: 'npc_sam',
        name: 'Sam',
        gender: 'male',
        tagline: 'Neighbor',
        skinColor: '#c68642',
        hairColor: '#451a03',
        hairStyle: 'spiky',
        eyeStyle: 'classic',
        eyeColor: '#b45309',
        browStyle: 'natural',
        facialDetail: 'none',
        facialHair: 'none',
        shirtColor: '#8b5cf6',
        shirtAccent: '#ede9fe',
        pantsColor: '#334155',
        shoeColor: '#f8fafc',
      },
      waypoints: [
        {x: 64.5 * TILE_SIZE, y: 14.5 * TILE_SIZE, waitMs: 2400, face: 'down'},
        {x: 56.5 * TILE_SIZE, y: 14.5 * TILE_SIZE, waitMs: 2200, face: 'right'},
        {x: 72.5 * TILE_SIZE, y: 14.5 * TILE_SIZE, waitMs: 2400, face: 'left'},
      ],
      routine: [
        {
          phase: 'morning',
          activity: 'patrol',
          locationLabel: 'Bluebird Lane',
          waypoints: [
            {x: 64.5 * TILE_SIZE, y: 14.5 * TILE_SIZE, waitMs: 2400, face: 'down', emote: '✉️'},
            {x: 57.5 * TILE_SIZE, y: 14.5 * TILE_SIZE, waitMs: 2400, face: 'right'},
          ],
        },
        {
          phase: 'afternoon',
          activity: 'patrol',
          locationLabel: 'Maple Crest Sidewalk',
          waypoints: [
            {x: 70.5 * TILE_SIZE, y: 23.0 * TILE_SIZE, waitMs: 2600, face: 'down'},
            {x: 60.0 * TILE_SIZE, y: 23.0 * TILE_SIZE, waitMs: 2400, face: 'right'},
          ],
        },
        {
          phase: 'dusk',
          activity: 'bench',
          locationLabel: 'Central Park South Lawn',
          waypoints: [
            {x: 43.5 * TILE_SIZE, y: 18.6 * TILE_SIZE, waitMs: 3600, face: 'up', emote: '🌇'},
            {x: 40.5 * TILE_SIZE, y: 19.5 * TILE_SIZE, waitMs: 2200, face: 'left'},
          ],
        },
        {
          phase: 'night',
          activity: 'patrol',
          locationLabel: 'Clover Residence Walk',
          waypoints: [
            {x: 59.0 * TILE_SIZE, y: 22.8 * TILE_SIZE, waitMs: 3600, face: 'up', emote: '🏠'},
            {x: 64.5 * TILE_SIZE, y: 22.8 * TILE_SIZE, waitMs: 2200, face: 'left'},
          ],
        },
      ],
    },
    {
      id: 'npc_rex',
      name: 'Rex',
      role: 'Head Mechanic',
      district: 'entertainment',
      speed: 60,
      greeting: 'Need fresh metallic paint, a twin GT spoiler, or an engine tune? Step inside Chaos Customs Garage!',
      chatLines: [
        'We tune every vehicle right on the hydraulic lift inside—and once customized, it carries straight to your Smartphone Spawner.',
        'Upgrade Engine & Handling tiers to feel real cornering grip on Boulevard turns.',
      ],
      preset: {
        id: 'npc_rex',
        name: 'Rex',
        gender: 'male',
        tagline: 'Chief Mechanic',
        skinColor: '#f1c27d',
        hairColor: '#334155',
        hairStyle: 'buzz',
        eyeStyle: 'sharp',
        eyeColor: '#0f172a',
        browStyle: 'thick',
        facialDetail: 'none',
        facialHair: 'beard',
        shirtColor: '#ea580c',
        shirtAccent: '#0f172a',
        pantsColor: '#1e293b',
        shoeColor: '#0f172a',
      },
      waypoints: [
        {x: 70.5 * TILE_SIZE, y: 36.6 * TILE_SIZE, waitMs: 3000, face: 'down', emote: '🔧'},
        {x: 74.5 * TILE_SIZE, y: 36.6 * TILE_SIZE, waitMs: 2600, face: 'left'},
      ],
      routine: [
        {
          phase: 'morning',
          activity: 'patrol',
          locationLabel: 'Chaos Customs Apron',
          waypoints: [
            {x: 70.0 * TILE_SIZE, y: 36.6 * TILE_SIZE, waitMs: 3200, face: 'down', emote: '🔧'},
            {x: 74.2 * TILE_SIZE, y: 36.6 * TILE_SIZE, waitMs: 2600, face: 'left'},
          ],
        },
        {
          phase: 'afternoon',
          activity: 'patrol',
          locationLabel: 'Chaos Customs Bay',
          waypoints: [
            {x: 72.0 * TILE_SIZE, y: 36.8 * TILE_SIZE, waitMs: 2800, face: 'up', emote: '🏎️'},
            {x: 68.5 * TILE_SIZE, y: 32.0 * TILE_SIZE, waitMs: 2400, face: 'right'},
          ],
        },
        {
          phase: 'dusk',
          activity: 'bus_stop',
          locationLabel: 'Chaos Customs Blvd',
          waypoints: [
            {x: 64.5 * TILE_SIZE, y: 31.2 * TILE_SIZE, waitMs: 3200, face: 'up', emote: '🌇'},
            {x: 71.0 * TILE_SIZE, y: 36.6 * TILE_SIZE, waitMs: 2400, face: 'down'},
          ],
        },
        {
          phase: 'night',
          activity: 'patrol',
          locationLabel: 'Garage Neon Entrance',
          waypoints: [
            {x: 72.0 * TILE_SIZE, y: 36.6 * TILE_SIZE, waitMs: 3400, face: 'down', emote: '🔧'},
            {x: 75.0 * TILE_SIZE, y: 36.6 * TILE_SIZE, waitMs: 2400, face: 'left'},
          ],
        },
      ],
    },
    {
      id: 'npc_nora',
      name: 'Nora',
      role: 'Fashion Stylist',
      district: 'shopping',
      speed: 60,
      greeting: 'Threadz Boutique just restocked! Mochi loves greeting shoppers along the boulevard too.',
      chatLines: [
        'Mochi is the calmest ginger cat in Shopping District.',
        'Save your favorite streetwear looks as Outfit Presets inside Threadz or your Home wardrobe!',
      ],
      hasPet: {species: 'cat', color: '#fb923c'},
      preset: {
        id: 'npc_nora',
        name: 'Nora',
        gender: 'female',
        tagline: 'Stylist',
        skinColor: '#ffdbac',
        hairColor: '#db2777',
        hairStyle: 'space_buns',
        eyeStyle: 'wide',
        eyeColor: '#6366f1',
        browStyle: 'arched',
        facialDetail: 'beauty_mark',
        facialHair: 'none',
        shirtColor: '#ec4899',
        shirtAccent: '#fdf2f8',
        pantsColor: '#0f172a',
        shoeColor: '#f472b6',
      },
      waypoints: [
        {x: 17.5 * TILE_SIZE, y: 38.2 * TILE_SIZE, waitMs: 2600, face: 'down', emote: '🛍️'},
        {x: 22.0 * TILE_SIZE, y: 38.2 * TILE_SIZE, waitMs: 2200, face: 'left'},
      ],
      routine: [
        {
          phase: 'morning',
          activity: 'shopping',
          locationLabel: 'Threadz Boutique Walk',
          waypoints: [
            {x: 16.5 * TILE_SIZE, y: 38.2 * TILE_SIZE, waitMs: 2600, face: 'down', emote: '🛍️'},
            {x: 21.5 * TILE_SIZE, y: 38.2 * TILE_SIZE, waitMs: 2200, face: 'left'},
          ],
        },
        {
          phase: 'afternoon',
          activity: 'cafe',
          locationLabel: 'Bean & Byte Cafe',
          waypoints: [
            {x: 9.0 * TILE_SIZE, y: 38.5 * TILE_SIZE, waitMs: 2800, face: 'right', emote: '☕'},
            {x: 14.5 * TILE_SIZE, y: 38.5 * TILE_SIZE, waitMs: 2200, face: 'left'},
          ],
        },
        {
          phase: 'dusk',
          activity: 'pet_walk',
          locationLabel: 'Shopping Promenade',
          waypoints: [
            {x: 18.0 * TILE_SIZE, y: 32.0 * TILE_SIZE, waitMs: 2400, face: 'down', emote: '🐾'},
            {x: 34.0 * TILE_SIZE, y: 32.0 * TILE_SIZE, waitMs: 2400, face: 'left'},
          ],
        },
        {
          phase: 'night',
          activity: 'patrol',
          locationLabel: 'Glow & Snip Salon Block',
          waypoints: [
            {x: 34.0 * TILE_SIZE, y: 48.0 * TILE_SIZE, waitMs: 3000, face: 'up', emote: '✨'},
            {x: 38.0 * TILE_SIZE, y: 48.0 * TILE_SIZE, waitMs: 2400, face: 'left'},
          ],
        },
      ],
    },
    {
      id: 'npc_tomas',
      name: 'Tomas',
      role: 'Transit Commuter',
      district: 'downtown',
      speed: 64,
      greeting: 'Waiting on the next loop shuttle! Between the bus stops and your Smartphone Spawner, getting anywhere is a breeze.',
      chatLines: [
        'Check your Smartphone Map whenever you want to spot your parked personal vehicle!',
      ],
      preset: {
        id: 'npc_tomas',
        name: 'Tomas',
        gender: 'male',
        tagline: 'Analyst',
        skinColor: '#e0ac69',
        hairColor: '#0f172a',
        hairStyle: 'sidepart',
        eyeStyle: 'classic',
        eyeColor: '#0f172a',
        browStyle: 'natural',
        facialDetail: 'none',
        facialHair: 'stubble',
        shirtColor: '#0284c7',
        shirtAccent: '#e2e8f0',
        pantsColor: '#334155',
        shoeColor: '#0f172a',
      },
      waypoints: [
        {x: 21.5 * TILE_SIZE, y: 26.2 * TILE_SIZE, waitMs: 3600, face: 'down', emote: '🚌'},
        {x: 18.0 * TILE_SIZE, y: 25.8 * TILE_SIZE, waitMs: 2000, face: 'right'},
      ],
      routine: [
        {
          phase: 'morning',
          activity: 'bus_stop',
          locationLabel: 'Downtown Civic Stop',
          waypoints: [
            {x: 21.5 * TILE_SIZE, y: 26.2 * TILE_SIZE, waitMs: 3800, face: 'down', emote: '🚌'},
            {x: 18.0 * TILE_SIZE, y: 25.8 * TILE_SIZE, waitMs: 2000, face: 'right'},
          ],
        },
        {
          phase: 'afternoon',
          activity: 'patrol',
          locationLabel: 'Skyline Commerce Walk',
          waypoints: [
            {x: 20.5 * TILE_SIZE, y: 12.2 * TILE_SIZE, waitMs: 3000, face: 'down', emote: '💼'},
            {x: 14.5 * TILE_SIZE, y: 12.2 * TILE_SIZE, waitMs: 2200, face: 'right'},
          ],
        },
        {
          phase: 'dusk',
          activity: 'bus_stop',
          locationLabel: 'Central Park South Stop',
          waypoints: [
            {x: 42.0 * TILE_SIZE, y: 26.2 * TILE_SIZE, waitMs: 3400, face: 'down', emote: '🚌'},
            {x: 38.5 * TILE_SIZE, y: 26.2 * TILE_SIZE, waitMs: 2000, face: 'right'},
          ],
        },
        {
          phase: 'night',
          activity: 'patrol',
          locationLabel: 'Harbor Lofts Walk',
          waypoints: [
            {x: 13.0 * TILE_SIZE, y: 11.2 * TILE_SIZE, waitMs: 3400, face: 'up', emote: '🏠'},
            {x: 16.5 * TILE_SIZE, y: 11.2 * TILE_SIZE, waitMs: 2200, face: 'left'},
          ],
        },
      ],
    },
    {
      id: 'npc_zoe',
      name: 'Zoe',
      role: 'Arcade Champion',
      district: 'entertainment',
      speed: 72,
      greeting: 'I hold the afternoon cabinet streak in Brick Blitz at Pixel Palace! Think you can top it?',
      chatLines: [
        'Starlight Cinema runs new animated loops every evening—don’t miss it!',
        'Pixel Palace pays out real coins for high scores.',
      ],
      preset: {
        id: 'npc_zoe',
        name: 'Zoe',
        gender: 'female',
        tagline: 'Gamer',
        skinColor: '#f1c27d',
        hairColor: '#6366f1',
        hairStyle: 'ponytail',
        eyeStyle: 'wide',
        eyeColor: '#8b5cf6',
        browStyle: 'arched',
        facialDetail: 'freckles',
        facialHair: 'none',
        shirtColor: '#4f46e5',
        shirtAccent: '#38bdf8',
        pantsColor: '#1e293b',
        shoeColor: '#38bdf8',
      },
      waypoints: [
        {x: 46.5 * TILE_SIZE, y: 38.4 * TILE_SIZE, waitMs: 2800, face: 'up', emote: '🕹️'},
        {x: 49.5 * TILE_SIZE, y: 38.4 * TILE_SIZE, waitMs: 2200, face: 'left'},
      ],
      routine: [
        {
          phase: 'morning',
          activity: 'bus_stop',
          locationLabel: 'Arcade & Cinema Stop',
          waypoints: [
            {x: 50.0 * TILE_SIZE, y: 48.6 * TILE_SIZE, waitMs: 3400, face: 'down', emote: '🎧'},
            {x: 46.5 * TILE_SIZE, y: 47.4 * TILE_SIZE, waitMs: 2200, face: 'up'},
          ],
        },
        {
          phase: 'afternoon',
          activity: 'patrol',
          locationLabel: 'Pixel Palace Plaza',
          waypoints: [
            {x: 46.5 * TILE_SIZE, y: 38.4 * TILE_SIZE, waitMs: 2800, face: 'up', emote: '🕹️'},
            {x: 50.0 * TILE_SIZE, y: 38.4 * TILE_SIZE, waitMs: 2200, face: 'left'},
          ],
        },
        {
          phase: 'dusk',
          activity: 'patrol',
          locationLabel: 'Entertainment Plaza',
          waypoints: [
            {x: 46.5 * TILE_SIZE, y: 47.2 * TILE_SIZE, waitMs: 2600, face: 'up', emote: '🍿'},
            {x: 54.5 * TILE_SIZE, y: 47.2 * TILE_SIZE, waitMs: 2400, face: 'left'},
          ],
        },
        {
          phase: 'night',
          activity: 'patrol',
          locationLabel: 'Neon Arcade Front',
          waypoints: [
            {x: 46.5 * TILE_SIZE, y: 38.4 * TILE_SIZE, waitMs: 3400, face: 'up', emote: '✨'},
            {x: 44.5 * TILE_SIZE, y: 41.0 * TILE_SIZE, waitMs: 2000, face: 'down'},
          ],
        },
      ],
    },
    {
      id: 'npc_priya',
      name: 'Priya',
      role: 'Clinic Nurse',
      district: 'downtown',
      speed: 58,
      greeting: 'Health checkups inside Metro Clinic are always free if your energy gets worn down!',
      chatLines: [
        'FreshMart fruits and Clinic checkups both keep you sprinting smoothly all day.',
      ],
      preset: {
        id: 'npc_priya',
        name: 'Priya',
        gender: 'female',
        tagline: 'Nurse',
        skinColor: '#8d5524',
        hairColor: '#0f172a',
        hairStyle: 'ponytail',
        eyeStyle: 'lashes',
        eyeColor: '#0f172a',
        browStyle: 'soft',
        facialDetail: 'none',
        facialHair: 'none',
        shirtColor: '#38bdf8',
        shirtAccent: '#ffffff',
        pantsColor: '#e2e8f0',
        shoeColor: '#ffffff',
      },
      waypoints: [
        {x: 7.5 * TILE_SIZE, y: 25.8 * TILE_SIZE, waitMs: 3000, face: 'up', emote: '🩺'},
        {x: 11.5 * TILE_SIZE, y: 25.8 * TILE_SIZE, waitMs: 2400, face: 'left'},
      ],
      routine: [
        {
          phase: 'morning',
          activity: 'patrol',
          locationLabel: 'Metro Clinic Entrance',
          waypoints: [
            {x: 6.5 * TILE_SIZE, y: 25.8 * TILE_SIZE, waitMs: 3200, face: 'up', emote: '🩺'},
            {x: 11.5 * TILE_SIZE, y: 25.8 * TILE_SIZE, waitMs: 2400, face: 'left'},
          ],
        },
        {
          phase: 'afternoon',
          activity: 'bench',
          locationLabel: 'Downtown Plaza Bench',
          waypoints: [
            {x: 13.5 * TILE_SIZE, y: 19.6 * TILE_SIZE, waitMs: 3400, face: 'down', emote: '☕'},
            {x: 16.5 * TILE_SIZE, y: 19.6 * TILE_SIZE, waitMs: 2000, face: 'left'},
          ],
        },
        {
          phase: 'dusk',
          activity: 'shopping',
          locationLabel: 'FreshMart Walk',
          waypoints: [
            {x: 34.5 * TILE_SIZE, y: 38.2 * TILE_SIZE, waitMs: 2800, face: 'up', emote: '🍎'},
            {x: 38.0 * TILE_SIZE, y: 38.2 * TILE_SIZE, waitMs: 2200, face: 'left'},
          ],
        },
        {
          phase: 'night',
          activity: 'patrol',
          locationLabel: 'Metro Clinic Night Shift',
          waypoints: [
            {x: 6.5 * TILE_SIZE, y: 25.8 * TILE_SIZE, waitMs: 3400, face: 'up', emote: '🌙'},
            {x: 9.5 * TILE_SIZE, y: 25.8 * TILE_SIZE, waitMs: 2200, face: 'left'},
          ],
        },
      ],
    },
    {
      id: 'npc_benji',
      name: 'Benji',
      role: 'Park Walker',
      district: 'central_park',
      speed: 56,
      greeting: 'Peppy and I never miss an afternoon loop around the Central Park Fountain!',
      chatLines: [
        'Nothing beats a quiet bench in Central Park while traffic hums along Main Blvd.',
      ],
      hasPet: {species: 'dog', color: '#e2e8f0'},
      preset: {
        id: 'npc_benji',
        name: 'Benji',
        gender: 'male',
        tagline: 'Dog Walker',
        skinColor: '#ffdbac',
        hairColor: '#92400e',
        hairStyle: 'curly',
        eyeStyle: 'wide',
        eyeColor: '#0284c7',
        browStyle: 'natural',
        facialDetail: 'freckles',
        facialHair: 'none',
        shirtColor: '#22c55e',
        shirtAccent: '#fef08a',
        pantsColor: '#1e293b',
        shoeColor: '#f8fafc',
      },
      waypoints: [
        {x: 40.5 * TILE_SIZE, y: 19.5 * TILE_SIZE, waitMs: 2400, face: 'up', emote: '🐾'},
        {x: 44.0 * TILE_SIZE, y: 15.5 * TILE_SIZE, waitMs: 2200, face: 'left'},
      ],
      routine: [
        {
          phase: 'morning',
          activity: 'bench',
          locationLabel: 'Park North Bench',
          waypoints: [
            {x: 36.5 * TILE_SIZE, y: 12.6 * TILE_SIZE, waitMs: 3200, face: 'down', emote: '🐾'},
            {x: 40.5 * TILE_SIZE, y: 12.0 * TILE_SIZE, waitMs: 2200, face: 'down'},
          ],
        },
        {
          phase: 'afternoon',
          activity: 'pet_walk',
          locationLabel: 'Central Fountain Loop',
          waypoints: [
            {x: 44.0 * TILE_SIZE, y: 15.5 * TILE_SIZE, waitMs: 2400, face: 'left', emote: '🐾'},
            {x: 40.5 * TILE_SIZE, y: 20.5 * TILE_SIZE, waitMs: 2200, face: 'up'},
          ],
        },
        {
          phase: 'dusk',
          activity: 'patrol',
          locationLabel: 'Sunbeam House Yard',
          waypoints: [
            {x: 70.0 * TILE_SIZE, y: 11.2 * TILE_SIZE, waitMs: 2800, face: 'down', emote: '🌇'},
            {x: 65.0 * TILE_SIZE, y: 14.5 * TILE_SIZE, waitMs: 2200, face: 'left'},
          ],
        },
        {
          phase: 'night',
          activity: 'patrol',
          locationLabel: 'Bluebird Cottage',
          waypoints: [
            {x: 59.0 * TILE_SIZE, y: 11.2 * TILE_SIZE, waitMs: 3600, face: 'up', emote: '🌙'},
            {x: 64.0 * TILE_SIZE, y: 11.2 * TILE_SIZE, waitMs: 2200, face: 'left'},
          ],
        },
      ],
    },
    {
      id: 'npc_mateo',
      name: 'Mateo',
      role: 'Soccer Coach',
      district: 'entertainment',
      speed: 68,
      greeting: 'Step onto the Eastside Soccer Pitch whenever you’re ready for 5 penalty kicks!',
      chatLines: [
        'Aim left, center, or right—wait until the keeper leans and bury it in the corner!',
      ],
      preset: {
        id: 'npc_mateo',
        name: 'Mateo',
        gender: 'male',
        tagline: 'Coach',
        skinColor: '#c68642',
        hairColor: '#0f172a',
        hairStyle: 'pompadour',
        eyeStyle: 'sharp',
        eyeColor: '#0f172a',
        browStyle: 'thick',
        facialDetail: 'none',
        facialHair: 'stubble',
        shirtColor: '#16a34a',
        shirtAccent: '#f8fafc',
        pantsColor: '#0f172a',
        shoeColor: '#22c55e',
      },
      waypoints: [
        {x: 71.0 * TILE_SIZE, y: 47.0 * TILE_SIZE, waitMs: 2400, face: 'up', emote: '⚽'},
        {x: 75.0 * TILE_SIZE, y: 47.0 * TILE_SIZE, waitMs: 2400, face: 'left'},
      ],
      routine: [
        {
          phase: 'morning',
          activity: 'sports',
          locationLabel: 'Eastside Soccer Pitch',
          waypoints: [
            {x: 70.5 * TILE_SIZE, y: 47.0 * TILE_SIZE, waitMs: 2400, face: 'up', emote: '⚽'},
            {x: 75.5 * TILE_SIZE, y: 47.0 * TILE_SIZE, waitMs: 2400, face: 'up'},
          ],
        },
        {
          phase: 'afternoon',
          activity: 'sports',
          locationLabel: 'Soccer Touchline',
          waypoints: [
            {x: 73.5 * TILE_SIZE, y: 47.2 * TILE_SIZE, waitMs: 2600, face: 'up', emote: '📣'},
            {x: 68.0 * TILE_SIZE, y: 47.2 * TILE_SIZE, waitMs: 2200, face: 'right'},
          ],
        },
        {
          phase: 'dusk',
          activity: 'shopping',
          locationLabel: 'IronWorks Gym Walk',
          waypoints: [
            {x: 40.0 * TILE_SIZE, y: 48.0 * TILE_SIZE, waitMs: 3000, face: 'up', emote: '💪'},
            {x: 34.0 * TILE_SIZE, y: 48.0 * TILE_SIZE, waitMs: 2400, face: 'right'},
          ],
        },
        {
          phase: 'night',
          activity: 'bus_stop',
          locationLabel: 'Arcade & Cinema Stop',
          waypoints: [
            {x: 50.0 * TILE_SIZE, y: 48.6 * TILE_SIZE, waitMs: 3600, face: 'down', emote: '🚌'},
            {x: 54.5 * TILE_SIZE, y: 48.6 * TILE_SIZE, waitMs: 2000, face: 'left'},
          ],
        },
      ],
    },
    {
      id: 'npc_hana',
      name: 'Hana',
      role: 'Sous Chef',
      district: 'shopping',
      speed: 60,
      greeting: 'Sunset Bistro is famous for Brick-Oven Pizza—and it tops up 100% of your energy!',
      chatLines: [
        'We get our fresh veggies right across the street from FreshMart Grocery.',
      ],
      preset: {
        id: 'npc_hana',
        name: 'Hana',
        gender: 'female',
        tagline: 'Chef',
        skinColor: '#ffdbac',
        hairColor: '#0f172a',
        hairStyle: 'bob',
        eyeStyle: 'classic',
        eyeColor: '#0f172a',
        browStyle: 'soft',
        facialDetail: 'blush',
        facialHair: 'none',
        shirtColor: '#f8fafc',
        shirtAccent: '#ea580c',
        pantsColor: '#1e293b',
        shoeColor: '#0f172a',
      },
      waypoints: [
        {x: 6.5 * TILE_SIZE, y: 48.0 * TILE_SIZE, waitMs: 2800, face: 'up', emote: '🍕'},
        {x: 11.5 * TILE_SIZE, y: 48.0 * TILE_SIZE, waitMs: 2400, face: 'left'},
      ],
      routine: [
        {
          phase: 'morning',
          activity: 'shopping',
          locationLabel: 'FreshMart Produce Walk',
          waypoints: [
            {x: 34.5 * TILE_SIZE, y: 38.2 * TILE_SIZE, waitMs: 2600, face: 'up', emote: '🥬'},
            {x: 38.5 * TILE_SIZE, y: 38.2 * TILE_SIZE, waitMs: 2200, face: 'left'},
          ],
        },
        {
          phase: 'afternoon',
          activity: 'patrol',
          locationLabel: 'Sunset Bistro Front',
          waypoints: [
            {x: 6.5 * TILE_SIZE, y: 48.0 * TILE_SIZE, waitMs: 2800, face: 'up', emote: '🍕'},
            {x: 11.5 * TILE_SIZE, y: 48.0 * TILE_SIZE, waitMs: 2400, face: 'left'},
          ],
        },
        {
          phase: 'dusk',
          activity: 'cafe',
          locationLabel: 'Sunset Bistro Terrace',
          waypoints: [
            {x: 8.5 * TILE_SIZE, y: 48.0 * TILE_SIZE, waitMs: 3200, face: 'down', emote: '🍝'},
            {x: 17.0 * TILE_SIZE, y: 48.0 * TILE_SIZE, waitMs: 2400, face: 'left'},
          ],
        },
        {
          phase: 'night',
          activity: 'patrol',
          locationLabel: 'Vinyl & Books Walk',
          waypoints: [
            {x: 17.0 * TILE_SIZE, y: 47.6 * TILE_SIZE, waitMs: 3000, face: 'up', emote: '🎵'},
            {x: 12.0 * TILE_SIZE, y: 47.6 * TILE_SIZE, waitMs: 2200, face: 'right'},
          ],
        },
      ],
    },
    {
      id: 'npc_eli',
      name: 'Eli',
      role: 'Vinyl DJ & Musician',
      district: 'shopping',
      speed: 62,
      greeting: 'Digging through classic synth records at Vinyl & Books! Stop by the reading corner quiz sometime.',
      chatLines: [
        'Nothing pairs better with sunset drives than retro arcade tunes.',
      ],
      preset: {
        id: 'npc_eli',
        name: 'Eli',
        gender: 'male',
        tagline: 'DJ',
        skinColor: '#8d5524',
        hairColor: '#0f172a',
        hairStyle: 'curly',
        eyeStyle: 'wide',
        eyeColor: '#b45309',
        browStyle: 'natural',
        facialDetail: 'none',
        facialHair: 'goatee',
        shirtColor: '#a855f7',
        shirtAccent: '#fde047',
        pantsColor: '#1e293b',
        shoeColor: '#e2e8f0',
      },
      waypoints: [
        {x: 17.0 * TILE_SIZE, y: 47.6 * TILE_SIZE, waitMs: 2800, face: 'up', emote: '🎵'},
        {x: 21.5 * TILE_SIZE, y: 47.6 * TILE_SIZE, waitMs: 2400, face: 'left'},
      ],
      routine: [
        {
          phase: 'morning',
          activity: 'cafe',
          locationLabel: 'Bean & Byte Cafe',
          waypoints: [
            {x: 6.5 * TILE_SIZE, y: 38.2 * TILE_SIZE, waitMs: 3000, face: 'up', emote: '☕'},
            {x: 10.0 * TILE_SIZE, y: 38.2 * TILE_SIZE, waitMs: 2400, face: 'left'},
          ],
        },
        {
          phase: 'afternoon',
          activity: 'shopping',
          locationLabel: 'Vinyl & Books Front',
          waypoints: [
            {x: 17.0 * TILE_SIZE, y: 47.6 * TILE_SIZE, waitMs: 3000, face: 'up', emote: '🎵'},
            {x: 21.5 * TILE_SIZE, y: 47.6 * TILE_SIZE, waitMs: 2400, face: 'left'},
          ],
        },
        {
          phase: 'dusk',
          activity: 'patrol',
          locationLabel: 'Entertainment Plaza',
          waypoints: [
            {x: 45.5 * TILE_SIZE, y: 41.0 * TILE_SIZE, waitMs: 2800, face: 'right', emote: '🌇'},
            {x: 50.0 * TILE_SIZE, y: 41.0 * TILE_SIZE, waitMs: 2400, face: 'left'},
          ],
        },
        {
          phase: 'night',
          activity: 'patrol',
          locationLabel: 'Starlight Cinema Lounge',
          waypoints: [
            {x: 46.5 * TILE_SIZE, y: 47.2 * TILE_SIZE, waitMs: 3200, face: 'up', emote: '🎶'},
            {x: 54.0 * TILE_SIZE, y: 47.2 * TILE_SIZE, waitMs: 2400, face: 'left'},
          ],
        },
      ],
    },
    // Prompt 09 District NPCs across Luxury Heights, Airport, Industrial, Beach, Countryside & Mall
    {
      id: 'npc_cap_vance',
      name: 'Officer Vance',
      role: 'CCPD Sergeant',
      district: 'luxury',
      speed: 62,
      greeting: 'Keep the avenues safe! Remember: parked NPC cars have active security alarms.',
      preset: {
        id: 'npc_cap_vance',
        name: 'Officer Vance',
        gender: 'male',
        tagline: 'Police',
        skinColor: '#e0ac69',
        hairColor: '#0f172a',
        hairStyle: 'short',
        eyeStyle: 'sharp',
        eyeColor: '#0f172a',
        browStyle: 'thick',
        facialDetail: 'none',
        facialHair: 'stubble',
        shirtColor: '#1e3a8a',
        shirtAccent: '#fbbf24',
        pantsColor: '#0f172a',
        shoeColor: '#0f172a',
      },
      waypoints: [
        {x: 84.5 * TILE_SIZE, y: 10.5 * TILE_SIZE, waitMs: 2800, face: 'down', emote: '🚓'},
        {x: 91.5 * TILE_SIZE, y: 10.5 * TILE_SIZE, waitMs: 2200, face: 'left'},
      ],
    },
    {
      id: 'npc_victoria',
      name: 'Victoria',
      role: 'Luxury Concierge',
      district: 'luxury',
      speed: 58,
      greeting: 'Grand Starlight Hotel and our Free Fun Token Lucky Lounge welcome all residents!',
      preset: {
        id: 'npc_victoria',
        name: 'Victoria',
        gender: 'female',
        tagline: 'Concierge',
        skinColor: '#ffdbac',
        hairColor: '#92400e',
        hairStyle: 'long_waves',
        eyeStyle: 'lashes',
        eyeColor: '#4338ca',
        browStyle: 'arched',
        facialDetail: 'beauty_mark',
        facialHair: 'none',
        shirtColor: '#581c87',
        shirtAccent: '#fbbf24',
        pantsColor: '#1e1b4b',
        shoeColor: '#fbbf24',
      },
      waypoints: [
        {x: 103.0 * TILE_SIZE, y: 11.2 * TILE_SIZE, waitMs: 2600, face: 'down', emote: '✨'},
        {x: 103.0 * TILE_SIZE, y: 24.4 * TILE_SIZE, waitMs: 2400, face: 'up'},
      ],
    },
    {
      id: 'npc_capt_skye',
      name: 'Capt. Skye',
      role: 'Flight Pilot',
      district: 'airport',
      speed: 64,
      greeting: 'Clear skies over Starlight Airport today — though coastal clouds roll in fast!',
      preset: {
        id: 'npc_capt_skye',
        name: 'Capt. Skye',
        gender: 'female',
        tagline: 'Pilot',
        skinColor: '#c68642',
        hairColor: '#0f172a',
        hairStyle: 'ponytail',
        eyeStyle: 'wide',
        eyeColor: '#0284c7',
        browStyle: 'natural',
        facialDetail: 'none',
        facialHair: 'none',
        shirtColor: '#0f172a',
        shirtAccent: '#38bdf8',
        pantsColor: '#1e293b',
        shoeColor: '#0f172a',
      },
      waypoints: [
        {x: 127.5 * TILE_SIZE, y: 24.8 * TILE_SIZE, waitMs: 2800, face: 'down', emote: '✈️'},
        {x: 135.5 * TILE_SIZE, y: 24.8 * TILE_SIZE, waitMs: 2400, face: 'left'},
      ],
    },
    {
      id: 'npc_chief_brennan',
      name: 'Chief Brennan',
      role: 'Fire Captain',
      district: 'industrial',
      speed: 62,
      greeting: 'Step inside Chaos Fire Station anytime for a timed hose training drill!',
      preset: {
        id: 'npc_chief_brennan',
        name: 'Chief Brennan',
        gender: 'male',
        tagline: 'Fire Chief',
        skinColor: '#f1c27d',
        hairColor: '#78350f',
        hairStyle: 'buzz',
        eyeStyle: 'sharp',
        eyeColor: '#0f172a',
        browStyle: 'thick',
        facialDetail: 'none',
        facialHair: 'beard',
        shirtColor: '#dc2626',
        shirtAccent: '#fde047',
        pantsColor: '#1e293b',
        shoeColor: '#0f172a',
      },
      waypoints: [
        {x: 85.0 * TILE_SIZE, y: 39.5 * TILE_SIZE, waitMs: 2600, face: 'down', emote: '🚒'},
        {x: 91.5 * TILE_SIZE, y: 39.5 * TILE_SIZE, waitMs: 2200, face: 'left'},
      ],
    },
    {
      id: 'npc_kai_surfer',
      name: 'Koa',
      role: 'Lifeguard & Surfer',
      district: 'beach',
      speed: 66,
      greeting: 'Pacific Boardwalk has the best breeze in the city—grab fresh smoothies at Boardwalk Cafe!',
      preset: {
        id: 'npc_koa',
        name: 'Koa',
        gender: 'male',
        tagline: 'Surfer',
        skinColor: '#c68642',
        hairColor: '#f59e0b',
        hairStyle: 'curly',
        eyeStyle: 'wide',
        eyeColor: '#0284c7',
        browStyle: 'soft',
        facialDetail: 'freckles',
        facialHair: 'none',
        shirtColor: '#06b6d4',
        shirtAccent: '#fef08a',
        pantsColor: '#f97316',
        shoeColor: '#f8fafc',
      },
      waypoints: [
        {x: 137.0 * TILE_SIZE, y: 63.2 * TILE_SIZE, waitMs: 2400, face: 'right', emote: '🌊'},
        {x: 137.0 * TILE_SIZE, y: 74.0 * TILE_SIZE, waitMs: 2400, face: 'up'},
      ],
    },
    {
      id: 'npc_farmer_claire',
      name: 'Farmer Claire',
      role: 'Orchard Grower',
      district: 'countryside',
      speed: 56,
      greeting: 'Emerald Valley Farm Market stocks organic honey, cider, and fresh produce right off the field!',
      hasPet: {species: 'dog', color: '#a16207'},
      preset: {
        id: 'npc_farmer_claire',
        name: 'Claire',
        gender: 'female',
        tagline: 'Grower',
        skinColor: '#ffdbac',
        hairColor: '#b45309',
        hairStyle: 'ponytail',
        eyeStyle: 'classic',
        eyeColor: '#059669',
        browStyle: 'natural',
        facialDetail: 'freckles',
        facialHair: 'none',
        shirtColor: '#16a34a',
        shirtAccent: '#fef3c7',
        pantsColor: '#1d4ed8',
        shoeColor: '#78350f',
      },
      waypoints: [
        {x: 21.5 * TILE_SIZE, y: 76.2 * TILE_SIZE, waitMs: 2800, face: 'down', emote: '🌻'},
        {x: 25.5 * TILE_SIZE, y: 76.2 * TILE_SIZE, waitMs: 2400, face: 'left'},
      ],
    },
    {
      id: 'npc_synth_nova',
      name: 'Aria',
      role: 'Synth Producer',
      district: 'highway',
      speed: 62,
      greeting: 'Cross the Expressway Canal Bridge to visit Starlight Grand Mall and jam on our Pocket Synth!',
      preset: {
        id: 'npc_aria',
        name: 'Aria',
        gender: 'female',
        tagline: 'Producer',
        skinColor: '#e0ac69',
        hairColor: '#06b6d4',
        hairStyle: 'space_buns',
        eyeStyle: 'wide',
        eyeColor: '#4338ca',
        browStyle: 'arched',
        facialDetail: 'blush',
        facialHair: 'none',
        shirtColor: '#7c3aed',
        shirtAccent: '#22d3ee',
        pantsColor: '#0f172a',
        shoeColor: '#ec4899',
      },
      waypoints: [
        {x: 78.5 * TILE_SIZE, y: 90.8 * TILE_SIZE, waitMs: 2600, face: 'down', emote: '🎹'},
        {x: 87.5 * TILE_SIZE, y: 91.2 * TILE_SIZE, waitMs: 2600, face: 'left'},
      ],
    },
  ];

  // 10. Parked Drivable Vehicles along Clear City Road Lanes (starter + district vehicles + alarmed NPC cars)
  const vehicles: VehicleConfig[] = [
    {
      id: 'city_roadster',
      name: 'Skyline Roadster',
      subtitle: 'Public Cruiser · Central Park',
      texture: 'veh_sedan_sky',
      x: 42.5 * TILE_SIZE,
      y: 28.5 * TILE_SIZE,
      direction: 'right',
      maxSpeed: 365,
    },
    {
      id: 'shopping_cruiser',
      name: 'Sunset Hatchback',
      subtitle: 'City Compact · Shopping Ave',
      texture: 'veh_compact_amber',
      x: 24.5 * TILE_SIZE,
      y: 40.5 * TILE_SIZE,
      direction: 'down',
      maxSpeed: 340,
    },
    {
      id: 'downtown_scooter',
      name: 'Metro Mint Scooter',
      subtitle: 'Agile Scooter · Downtown Blvd',
      texture: 'veh_scooter_mint',
      x: 15.5 * TILE_SIZE,
      y: 28.5 * TILE_SIZE,
      direction: 'left',
      maxSpeed: 310,
      isScooter: true,
    },
    {
      id: 'luxury_suv_parked',
      name: 'Horizon Trailblazer SUV',
      subtitle: 'Locked NPC SUV · Luxury Heights (Alarmed!)',
      texture: 'veh_sedan_sky',
      modelId: 'suv',
      customization: {
        paintColor: '#1e293b',
        secondaryColor: '#94a3b8',
        wheelStyle: 'alloy_star',
        spoilerStyle: 'street_lip',
        decalStyle: 'none',
        headlightStyle: 'ice_blue',
      },
      x: 108.0 * TILE_SIZE,
      y: 28.5 * TILE_SIZE,
      direction: 'left',
      maxSpeed: 376,
      alarmed: true,
    },
    {
      id: 'countryside_pickup_parked',
      name: 'Ridgeback 4x4 Pickup',
      subtitle: 'Locked NPC Pickup · Countryside (Alarmed!)',
      texture: 'veh_sedan_sky',
      modelId: 'pickup',
      customization: {
        paintColor: '#059669',
        secondaryColor: '#fde68a',
        wheelStyle: 'alloy_star',
        spoilerStyle: 'none',
        decalStyle: 'two_tone',
        headlightStyle: 'warm',
      },
      x: 28.5 * TILE_SIZE,
      y: 80.5 * TILE_SIZE,
      direction: 'right',
      maxSpeed: 362,
      alarmed: true,
    },
    {
      id: 'beach_moto_parked',
      name: 'Volt R-900 Superbike',
      subtitle: 'Sport Motorcycle · Pacific Boardwalk',
      texture: 'veh_scooter_mint',
      modelId: 'motorcycle',
      customization: {
        paintColor: '#dc2626',
        secondaryColor: '#f8fafc',
        wheelStyle: 'sport_tread',
        spoilerStyle: 'none',
        decalStyle: 'racing_stripe',
        headlightStyle: 'ice_blue',
      },
      x: 132.5 * TILE_SIZE,
      y: 62.5 * TILE_SIZE,
      direction: 'down',
      maxSpeed: 418,
      isScooter: true,
    },
    {
      id: 'highway_taxi_parked',
      name: 'Downtown Yellow Cab',
      subtitle: 'Locked NPC Cab · Metro Expressway (Alarmed!)',
      texture: 'veh_sedan_sky',
      modelId: 'taxi',
      customization: {
        paintColor: '#d97706',
        secondaryColor: '#fef08a',
        wheelStyle: 'alloy_star',
        spoilerStyle: 'none',
        decalStyle: 'two_tone',
        headlightStyle: 'neon_gold',
      },
      x: 84.5 * TILE_SIZE,
      y: 80.5 * TILE_SIZE,
      direction: 'right',
      maxSpeed: 372,
      alarmed: true,
    },
  ];

  // Safe spawn point on the Central Park south sidewalk promenade
  const spawnPoint = {
    x: 35.5 * TILE_SIZE,
    y: 26.3 * TILE_SIZE,
  };

  return {
    cols: MAP_COLS,
    rows: MAP_ROWS,
    tileSize: TILE_SIZE,
    groundLayer: ground,
    detailLayer: detail,
    solidTiles,
    buildings,
    props,
    interactives,
    npcs,
    vehicles,
    spawnPoint,
  };
}

export function getDistrictName(id: DistrictId): string {
  return DISTRICTS.find((d) => d.id === id)?.name ?? 'CHAOS CITY';
}
