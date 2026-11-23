import {TILE_SIZE} from '@/src/config/constants';
import {
  FLOOR_STYLES,
  FURNITURE_CATALOG,
  WALL_STYLES,
} from '@/src/game/data/propertyData';
import {
  HairStyleId,
  InteractiveObjectData,
  InteriorTheme,
  NPCConfig,
  PropertyDeed,
} from '@/src/game/types/gameTypes';

export interface InteriorProp {
  id: string;
  texture: string;
  x: number;
  y: number;
  solid: boolean;
  rotationDeg?: number;
  deedFurnitureUid?: string;
  colliderW?: number;
  colliderH?: number;
  colliderOffsetY?: number;
  depthOffsetY?: number;
  gateId?: string; // e.g., 'cinema_gate' removed when ticket unlocked
}

export interface InteriorWallRect {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  gateId?: string;
}

export interface InteriorRoomLabel {
  text: string;
  x: number;
  y: number;
}

export interface InteriorLayout {
  buildingId: string;
  title: string;
  subtitle: string;
  theme: InteriorTheme;
  cols: number;
  rows: number;
  tiles: number[][];
  wallRects: InteriorWallRect[];
  props: InteriorProp[];
  interactives: InteractiveObjectData[];
  npcs: NPCConfig[];
  roomLabels: InteriorRoomLabel[];
  spawnPoint: {x: number; y: number};
  exitPoint: {x: number; y: number};
  ambientBgHex: string;
}

function createBaseGrid(
  cols: number,
  rows: number,
  floorTile: number,
  wallTile: number,
  windowCols: number[] = [],
  artCols: number[] = [],
): number[][] {
  const grid: number[][] = Array.from({length: rows}, (_, r) =>
    Array.from({length: cols}, (__, c) => {
      if (r === 0 || r === 1) {
        if (r === 1 && windowCols.includes(c)) return 16;
        if (r === 1 && artCols.includes(c)) return 17;
        return wallTile;
      }
      if (r === rows - 1 || c === 0 || c === cols - 1) return 15;
      return floorTile;
    }),
  );
  return grid;
}

function buildPerimeterWalls(
  cols: number,
  rows: number,
  doorCol: number,
): InteriorWallRect[] {
  const w = cols * TILE_SIZE;
  const h = rows * TILE_SIZE;
  const doorLeft = (doorCol - 1) * TILE_SIZE;
  const doorRight = (doorCol + 2) * TILE_SIZE;

  const rects: InteriorWallRect[] = [
    // Top wall (2 tiles tall)
    {centerX: w / 2, centerY: 29, width: w, height: 58},
    // Left wall
    {centerX: 14, centerY: h / 2, width: 28, height: h},
    // Right wall
    {centerX: w - 14, centerY: h / 2, width: 28, height: h},
    // Bottom doorway threshold stopper
    {centerX: w / 2, centerY: h - 4, width: w, height: 8},
  ];

  if (doorLeft > 0) {
    rects.push({
      centerX: doorLeft / 2,
      centerY: h - 16,
      width: doorLeft,
      height: 32,
    });
  }
  if (w - doorRight > 0) {
    rects.push({
      centerX: doorRight + (w - doorRight) / 2,
      centerY: h - 16,
      width: w - doorRight,
      height: 32,
    });
  }
  return rects;
}

function openDoorwayFloor(
  grid: number[][],
  rows: number,
  doorCol: number,
  floorTile: number,
): void {
  for (let c = doorCol - 1; c <= doorCol + 1; c++) {
    grid[rows - 1][c] = floorTile;
  }
}

function makeNpc(
  id: string,
  name: string,
  role: string,
  x: number,
  y: number,
  shirtColor: string,
  shirtAccent: string,
  greeting: string,
  hairStyle: HairStyleId = 'short',
): NPCConfig {
  const isFemale = hairStyle === 'bob';
  return {
    id,
    name,
    role,
    district: 'shopping',
    speed: 0,
    greeting,
    preset: {
      id,
      name,
      gender: isFemale ? 'female' : 'male',
      tagline: role,
      skinColor: '#f1c27d',
      hairColor: '#1e293b',
      hairStyle,
      eyeStyle: isFemale ? 'lashes' : 'classic',
      eyeColor: '#0f172a',
      browStyle: isFemale ? 'arched' : 'natural',
      facialDetail: 'none',
      facialHair: 'none',
      shirtColor,
      shirtAccent,
      pantsColor: '#1e293b',
      shoeColor: '#f8fafc',
    },
    waypoints: [{x, y, waitMs: 999999, face: 'down'}],
  };
}

function fillTiles(
  grid: number[][],
  x: number,
  y: number,
  w: number,
  h: number,
  tile: number,
): void {
  for (let r = y; r < y + h; r++) {
    for (let c = x; c < x + w; c++) {
      if (grid[r] && grid[r][c] !== undefined) {
        grid[r][c] = tile;
      }
    }
  }
}

function addPartitionLine(
  grid: number[][],
  wallRects: InteriorWallRect[],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  doorAt?: {c?: number; r?: number},
): void {
  if (x1 === x2) {
    // Vertical partition
    for (let r = y1; r <= y2; r++) {
      if (doorAt?.r !== undefined && (r === doorAt.r || r === doorAt.r + 1)) continue;
      grid[r][x1] = 15;
      wallRects.push({
        centerX: x1 * TILE_SIZE + TILE_SIZE / 2,
        centerY: r * TILE_SIZE + TILE_SIZE / 2,
        width: TILE_SIZE,
        height: TILE_SIZE,
      });
    }
  } else if (y1 === y2) {
    // Horizontal partition
    for (let c = x1; c <= x2; c++) {
      if (doorAt?.c !== undefined && (c === doorAt.c || c === doorAt.c + 1)) continue;
      grid[y1][c] = 15;
      wallRects.push({
        centerX: c * TILE_SIZE + TILE_SIZE / 2,
        centerY: y1 * TILE_SIZE + TILE_SIZE / 2,
        width: TILE_SIZE,
        height: TILE_SIZE,
      });
    }
  }
}

function applyDeedStylesAndFurniture(
  tiles: number[][],
  props: InteriorProp[],
  interactives: InteractiveObjectData[],
  baseFloorTile: number,
  baseWallTile: number,
  deed: PropertyDeed,
  buildingLabel: string,
  keepKinds: string[] = ['interior_kitchen', 'interior_door'],
): {tiles: number[][]; props: InteriorProp[]; interactives: InteractiveObjectData[]} {
  const floorDef = FLOOR_STYLES.find((s) => s.id === deed.floorStyle);
  const wallDef = WALL_STYLES.find((s) => s.id === deed.wallStyle);
  const nextFloor = floorDef?.tileIndex ?? baseFloorTile;
  const nextWall = wallDef?.tileIndex ?? baseWallTile;

  const styledTiles = tiles.map((row, r) =>
    row.map((cell) => {
      if ((r === 0 || r === 1) && cell === baseWallTile) {
        return nextWall;
      }
      if (r >= 2 && cell === baseFloorTile) {
        return nextFloor;
      }
      return cell;
    }),
  );

  // Preserve non-movable fixtures (exit mat, swing doors, kitchen cabinets/fridge/tub/mirror)
  const keptProps = props.filter(
    (p) =>
      p.id === 'exit_mat' ||
      p.id.startsWith('door_') ||
      p.id.startsWith('k_') ||
      p.id.startsWith('bath_'),
  );
  const keptInteractives = interactives.filter((i) => keepKinds.includes(i.kind));

  const nextProps: InteriorProp[] = [...keptProps];
  const nextInteractives: InteractiveObjectData[] = [...keptInteractives];

  for (const furn of deed.furniture) {
    const cat = FURNITURE_CATALOG.find((c) => c.id === furn.catalogId);
    const rotated90 = furn.rotationDeg === 90 || furn.rotationDeg === 270;
    const rawW = cat?.colliderW ?? 32;
    const rawH = cat?.colliderH ?? 24;
    const colliderW = rotated90 ? rawH : rawW;
    const colliderH = rotated90 ? rawW : rawH;
    nextProps.push({
      id: furn.uid,
      deedFurnitureUid: furn.uid,
      texture: furn.texture || cat?.texture || 'int_chair',
      x: furn.x,
      y: furn.y,
      rotationDeg: furn.rotationDeg ?? 0,
      solid: true,
      colliderW,
      colliderH,
      colliderOffsetY: cat?.colliderOffsetY ?? 4,
    });

    if (cat?.interactiveKind === 'bench') {
      nextInteractives.push({
        id: `int_${furn.uid}`,
        kind: 'bench',
        title: cat.name,
        subtitle: `${deed.title} · Owned Decor`,
        description: cat.description,
        promptLabel: `Sit on ${cat.name}`,
        x: furn.x,
        y: furn.y + 18,
        radius: 50,
        seatX: furn.x,
        seatY: furn.y - 2,
      });
    } else if (cat?.interactiveKind === 'interior_bed') {
      nextInteractives.push({
        id: `int_${furn.uid}`,
        kind: 'interior_bed',
        title: cat.name,
        subtitle: `${buildingLabel} · Bedroom`,
        description: 'Rest on this bed to recharge Energy to 100%.',
        promptLabel: 'Sleep in Bed',
        x: furn.x,
        y: furn.y + 24,
        seatX: furn.x,
        seatY: furn.y,
        radius: 58,
      });
    } else if (cat?.interactiveKind === 'interior_tv') {
      nextInteractives.push({
        id: `int_${furn.uid}`,
        kind: 'interior_tv',
        title: cat.name,
        subtitle: `${buildingLabel} · Entertainment`,
        description: 'Turn on the TV and browse 5 animated CHAOS channels.',
        promptLabel: 'Watch Smart TV',
        x: furn.x,
        y: furn.y + 22,
        radius: 54,
      });
    } else if (cat?.interactiveKind === 'interior_computer') {
      nextInteractives.push({
        id: `int_${furn.uid}`,
        kind: 'interior_computer',
        title: cat.name,
        subtitle: `${buildingLabel} · ChaosOS`,
        description: 'Open ChaosOS desktop for City Map, Profile, and Settings.',
        promptLabel: 'Use Desktop Computer',
        x: furn.x,
        y: furn.y + 22,
        radius: 54,
      });
    }
  }

  return {tiles: styledTiles, props: nextProps, interactives: nextInteractives};
}

export function createInteriorLayout(
  buildingId: string,
  buildingLabel: string,
  deed?: PropertyDeed | null,
): InteriorLayout {
  const T = TILE_SIZE;

  // 0. CHAOS CUSTOMS GARAGE — Vehicle Customization & Dealership
  if (buildingId === 'b_garage') {
    const cols = 22;
    const rows = 14;
    const doorCol = 10;
    const tiles = createBaseGrid(cols, rows, 19, 12, [4, 5, 16, 17], []);
    openDoorwayFloor(tiles, rows, doorCol, 19);
    // Hazard floor stripe around hydraulic lift bay
    fillTiles(tiles, 7, 4, 8, 1, 20);
    fillTiles(tiles, 7, 8, 8, 1, 20);

    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'garage_lift', texture: 'int_car_lift', x: 11 * T, y: 6.2 * T, solid: true, colliderW: 84, colliderH: 40, colliderOffsetY: 8},
      {id: 'garage_showroom', texture: 'int_cashier', x: 4.5 * T, y: 4.2 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'garage_paint', texture: 'int_paint_booth', x: 17.5 * T, y: 4.2 * T, solid: true, colliderW: 52, colliderH: 28, colliderOffsetY: 6},
      {id: 'garage_tires', texture: 'int_tire_rack', x: 18 * T, y: 9.5 * T, solid: true, colliderW: 52, colliderH: 24, colliderOffsetY: 6},
      {id: 'garage_tools', texture: 'int_toolbox', x: 4.2 * T, y: 9.6 * T, solid: true, colliderW: 40, colliderH: 22, colliderOffsetY: 6},
      {id: 'garage_pc', texture: 'int_computer', x: 16.5 * T, y: 7.0 * T, solid: true, colliderW: 50, colliderH: 24, colliderOffsetY: 6},
    ];

    const interactives: InteractiveObjectData[] = [
      {
        id: 'garage_lift_bay',
        kind: 'interior_garage',
        garageTab: 'customize',
        title: 'Hydraulic Tuning Lift',
        subtitle: 'Custom Paint, Parts & Performance',
        description:
          'Customize paint coat, rims, spoilers, decals, headlights, and tune Engine, Turbo, Suspension & Brakes!',
        promptLabel: 'Open Vehicle Tuning Lift',
        x: 11 * T,
        y: 7.7 * T,
        radius: 78,
      },
      {
        id: 'garage_dealership',
        kind: 'interior_garage',
        garageTab: 'showroom',
        title: 'Chaos Motors Dealership',
        subtitle: 'Vehicle Showroom & Fleet Keys',
        description:
          'Browse city vehicles, buy new rides with Coins, and select which active ride your Smartphone Spawner deploys.',
        promptLabel: 'Open Vehicle Showroom',
        x: 4.5 * T,
        y: 5.0 * T,
        radius: 64,
      },
      {
        id: 'garage_paint_station',
        kind: 'interior_garage',
        garageTab: 'customize',
        title: 'Spray Booth & Swatches',
        subtitle: 'Custom Livery Lab',
        description: 'Open the full customizer to swap colors, racing stripes, and xenon headlights.',
        promptLabel: 'Customize Paint & Decals',
        x: 17.5 * T,
        y: 5.1 * T,
        radius: 64,
      },
      {
        id: 'garage_pc_term',
        kind: 'interior_computer',
        title: 'Garage Diagnostic Terminal',
        subtitle: 'ChaosOS Auto Network',
        description: 'Open ChaosOS directory, resident ledger, and vehicle notes.',
        promptLabel: 'Use Garage Terminal',
        x: 16.5 * T,
        y: 7.9 * T,
        radius: 56,
      },
    ];

    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Entertainment East · Custom Tuning & Dealership',
      theme: 'garage',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_garage_rex',
          'Rex',
          'Chief Mechanic',
          7.5 * T,
          3.8 * T,
          '#ea580c',
          '#0f172a',
          'Welcome to Chaos Customs! Step up to the Hydraulic Lift in the center bay to customize paint, rims, spoilers, or upgrade top speed & handling. Visit the Showroom desk on the left to buy new cars!',
          'buzz',
        ),
      ],
      roomLabels: [
        {text: 'Dealership', x: 4.5 * T, y: 2.3 * T},
        {text: 'Tuning Lift Bay', x: 11 * T, y: 2.3 * T},
        {text: 'Paint Lab', x: 17.5 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#0b111b',
    };
  }

  // 1. CLOTHING STORE — Threadz Boutique
  if (buildingId === 'b_clothing') {
    const cols = 22;
    const rows = 15;
    const doorCol = 10;
    const tiles = createBaseGrid(cols, rows, 1, 13, [4, 5, 16, 17], [9, 12]);
    openDoorwayFloor(tiles, rows, doorCol, 1);
    // Stylish pink/navy rug in center & changing room floor
    fillTiles(tiles, 7, 6, 7, 4, 11);
    fillTiles(tiles, 16, 2, 5, 5, 0);

    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    // Partition for Changing Room (top-right corner)
    addPartitionLine(tiles, wallRects, 15, 2, 15, 6, {r: 4});
    addPartitionLine(tiles, wallRects, 15, 7, 20, 7, {c: 17});

    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'cashier', texture: 'int_cashier', x: 4.5 * T, y: 3.6 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'rack_shirts', texture: 'int_rack', x: 4 * T, y: 7.5 * T, solid: true, colliderW: 44, colliderH: 24, colliderOffsetY: 8},
      {id: 'rack_jackets', texture: 'int_rack', x: 4 * T, y: 10.5 * T, solid: true, colliderW: 44, colliderH: 24, colliderOffsetY: 8},
      {id: 'rack_trousers', texture: 'int_rack', x: 10.5 * T, y: 5 * T, solid: true, colliderW: 44, colliderH: 24, colliderOffsetY: 8},
      {id: 'rack_acc', texture: 'int_rack', x: 12.5 * T, y: 10.5 * T, solid: true, colliderW: 44, colliderH: 24, colliderOffsetY: 8},
      {id: 'mann_1', texture: 'int_mannequin', x: 8 * T, y: 7.5 * T, solid: true, colliderW: 22, colliderH: 18, colliderOffsetY: 12},
      {id: 'mann_2', texture: 'int_mannequin', x: 13 * T, y: 7.5 * T, solid: true, colliderW: 22, colliderH: 18, colliderOffsetY: 12},
      {id: 'mirror_1', texture: 'int_mirror', x: 18.8 * T, y: 3.1 * T, solid: true, colliderW: 28, colliderH: 20, colliderOffsetY: 10},
      {id: 'curtain_1', texture: 'int_curtain', x: 17 * T, y: 3.3 * T, solid: true, colliderW: 48, colliderH: 24, colliderOffsetY: 8},
      {id: 'plant_1', texture: 'int_plant', x: 1.8 * T, y: 3.1 * T, solid: true, colliderW: 20, colliderH: 16, colliderOffsetY: 8},
      {id: 'plant_2', texture: 'int_plant', x: 19.8 * T, y: 12.8 * T, solid: true, colliderW: 20, colliderH: 16, colliderOffsetY: 8},
    ];

    const interactives: InteractiveObjectData[] = [
      {
        id: 'shop_clothing_cashier',
        kind: 'interior_shop',
        shopDomain: 'clothing',
        initialTab: 'shirts',
        title: 'Threadz Boutique Catalog',
        subtitle: 'Cashier & Full Collection',
        description: 'Browse all 12 clothing & accessory categories, preview outfits in 4 directions, and buy with coins.',
        promptLabel: 'Shop Threadz Catalog',
        x: 4.5 * T,
        y: 4.3 * T,
        radius: 56,
      },
      {
        id: 'shop_rack_tops',
        kind: 'interior_shop',
        shopDomain: 'clothing',
        initialTab: 'tshirts',
        title: 'Shirts & Street Tees Rack',
        subtitle: 'Threadz Boutique · Tops',
        description: 'Try on fresh T-shirts and crisp Oxford or flannel shirts.',
        promptLabel: 'Browse Shirts & Tees',
        x: 4 * T,
        y: 7.9 * T,
        radius: 52,
      },
      {
        id: 'shop_rack_jackets',
        kind: 'interior_shop',
        shopDomain: 'clothing',
        initialTab: 'jackets',
        title: 'Outerwear & Jackets Rack',
        subtitle: 'Threadz Boutique · Jackets',
        description: 'Layer varsity coats, bombers, and moto jackets over any tee.',
        promptLabel: 'Browse Jackets',
        x: 4 * T,
        y: 10.9 * T,
        radius: 52,
      },
      {
        id: 'shop_rack_bottoms',
        kind: 'interior_shop',
        shopDomain: 'clothing',
        initialTab: 'trousers',
        title: 'Trousers & Footwear Rack',
        subtitle: 'Threadz Boutique · Bottoms & Shoes',
        description: 'Shop denim, cargo pants, track joggers, and street sneakers.',
        promptLabel: 'Browse Trousers & Shoes',
        x: 10.5 * T,
        y: 5.5 * T,
        radius: 54,
      },
      {
        id: 'shop_rack_acc',
        kind: 'interior_shop',
        shopDomain: 'clothing',
        initialTab: 'hats',
        title: 'Hats, Glasses & Accessories',
        subtitle: 'Threadz Boutique · Finishing Touches',
        description: 'Complete your outfit with caps, beanies, shades, scarves, and backpacks.',
        promptLabel: 'Browse Hats & Accessories',
        x: 12.5 * T,
        y: 10.9 * T,
        radius: 54,
      },
      {
        id: 'changing_room',
        kind: 'interior_wardrobe',
        title: 'Threadz Changing Room & Mirror',
        subtitle: 'Personal Wardrobe',
        description: 'Equip or unequip any clothing items you own and inspect your outfit in the mirror.',
        promptLabel: 'Open Wardrobe / Mirror',
        x: 18 * T,
        y: 4.4 * T,
        radius: 62,
      },
    ];

    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Shopping District · Clothing Boutique',
      theme: 'clothing',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_boutique_sasha',
          'Sasha',
          'Stylist',
          4.5 * T,
          2.9 * T,
          '#ec4899',
          '#fdf2f8',
          'Welcome to Threadz! Every rack has real outfits you can preview, buy, and equip in the changing room.',
          'bob',
        ),
      ],
      roomLabels: [
        {text: 'Sales Floor', x: 9 * T, y: 2.3 * T},
        {text: 'Changing Room', x: 18 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#120d1d',
    };
  }

  // 2. CAFE OR RESTAURANT (Bean & Byte Cafe / Sunset Bistro & Diner)
  if (buildingId === 'b_cafe' || buildingId === 'b_restaurant') {
    const isCafe = buildingId === 'b_cafe';
    const cols = 20;
    const rows = 15;
    const doorCol = 9;
    const tiles = createBaseGrid(cols, rows, 2, 13, [3, 4, 15, 16], [9, 10]);
    openDoorwayFloor(tiles, rows, doorCol, 2);
    if (!isCafe) {
      fillTiles(tiles, 1, 2, 6, 4, 9); // Kitchen corner tile
    }

    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'cashier', texture: 'int_cashier', x: 4.5 * T, y: 4 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'food_case', texture: 'int_food_case', x: 7 * T, y: 4 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'table_1', texture: 'int_table_cafe', x: 13.5 * T, y: 5.5 * T, solid: true, colliderW: 34, colliderH: 22, colliderOffsetY: 4},
      {id: 'chair_1a', texture: 'int_chair', x: 12.1 * T, y: 5.5 * T, solid: true, colliderW: 18, colliderH: 18},
      {id: 'chair_1b', texture: 'int_chair', x: 14.9 * T, y: 5.5 * T, solid: true, colliderW: 18, colliderH: 18},
      {id: 'table_2', texture: 'int_table_cafe', x: 13.5 * T, y: 10 * T, solid: true, colliderW: 34, colliderH: 22, colliderOffsetY: 4},
      {id: 'chair_2a', texture: 'int_chair', x: 12.1 * T, y: 10 * T, solid: true, colliderW: 18, colliderH: 18},
      {id: 'chair_2b', texture: 'int_chair', x: 14.9 * T, y: 10 * T, solid: true, colliderW: 18, colliderH: 18},
      {id: 'table_3', texture: 'int_table_cafe', x: 4.5 * T, y: 9.5 * T, solid: true, colliderW: 34, colliderH: 22, colliderOffsetY: 4},
      {id: 'chair_3a', texture: 'int_chair', x: 3.1 * T, y: 9.5 * T, solid: true, colliderW: 18, colliderH: 18},
      {id: 'plant_1', texture: 'int_plant', x: 18 * T, y: 3 * T, solid: true, colliderW: 20, colliderH: 16, colliderOffsetY: 8},
    ];

    const interactives: InteractiveObjectData[] = [
      {
        id: 'shop_food_counter',
        kind: 'interior_shop',
        shopDomain: isCafe ? 'cafe' : 'restaurant',
        title: isCafe ? 'Bean & Byte Counter' : 'Sunset Bistro Menu',
        subtitle: isCafe ? 'Coffee, Matcha & Pastries' : 'Hot Mains & Craft Drinks',
        description: isCafe
          ? 'Order freshly pulled espresso or pastries to boost walking speed and energy.'
          : 'Order hearty bistro plates and refreshing drinks to restore energy.',
        promptLabel: isCafe ? 'Order at Cafe Counter' : 'Order at Bistro Counter',
        x: 5.7 * T,
        y: 4.8 * T,
        radius: 68,
      },
      {
        id: 'seat_cafe_1',
        kind: 'bench',
        title: 'Dining Table Seat',
        subtitle: buildingLabel,
        description: 'Take a seat at the table.',
        promptLabel: 'Sit at Table',
        x: 12.1 * T,
        y: 5.8 * T,
        radius: 42,
        seatX: 12.1 * T,
        seatY: 5.4 * T,
      },
      {
        id: 'seat_cafe_2',
        kind: 'bench',
        title: 'Window Table Seat',
        subtitle: buildingLabel,
        description: 'Relax at a cozy booth table.',
        promptLabel: 'Sit at Table',
        x: 12.1 * T,
        y: 10.3 * T,
        radius: 42,
        seatX: 12.1 * T,
        seatY: 9.9 * T,
      },
      {
        id: 'seat_cafe_3',
        kind: 'bench',
        title: 'Corner Table Seat',
        subtitle: buildingLabel,
        description: 'Rest and enjoy your meal.',
        promptLabel: 'Sit at Table',
        x: 3.1 * T,
        y: 9.8 * T,
        radius: 42,
        seatX: 3.1 * T,
        seatY: 9.4 * T,
      },
    ];

    return {
      buildingId,
      title: buildingLabel,
      subtitle: isCafe ? 'Shopping District · Artisan Cafe' : 'Shopping District · Bistro & Diner',
      theme: isCafe ? 'cafe' : 'restaurant',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          `npc_${buildingId}_host`,
          isCafe ? 'Barista Owen' : 'Chef Marco',
          isCafe ? 'Head Barista' : 'Head Chef',
          4.5 * T,
          3.1 * T,
          isCafe ? '#10b981' : '#ea580c',
          '#fef3c7',
          isCafe
            ? 'Fresh espresso gives you a noticeable sprint boost around CHAOS CITY!'
            : 'Grab a seat at any table or order hot ramen and smash burgers at the counter!',
        ),
      ],
      roomLabels: [
        {text: 'Order Counter', x: 5.5 * T, y: 2.3 * T},
        {text: 'Dining Area', x: 14 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#18100c',
    };
  }

  // 3. SUPERMARKET — FreshMart Grocery
  if (buildingId === 'b_grocery') {
    const cols = 22;
    const rows = 15;
    const doorCol = 10;
    const tiles = createBaseGrid(cols, rows, 3, 13, [4, 5, 16, 17], []);
    openDoorwayFloor(tiles, rows, doorCol, 3);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);

    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'cashier', texture: 'int_cashier', x: 4.5 * T, y: 4 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'baskets', texture: 'int_basket_stack', x: 7.5 * T, y: 12 * T, solid: true, colliderW: 24, colliderH: 20, colliderOffsetY: 4},
      {id: 'shelf_1', texture: 'int_shelf_grocery', x: 11 * T, y: 5 * T, solid: true, colliderW: 58, colliderH: 26, colliderOffsetY: 8},
      {id: 'shelf_2', texture: 'int_shelf_grocery', x: 16.5 * T, y: 5 * T, solid: true, colliderW: 58, colliderH: 26, colliderOffsetY: 8},
      {id: 'shelf_3', texture: 'int_shelf_grocery', x: 11 * T, y: 9.5 * T, solid: true, colliderW: 58, colliderH: 26, colliderOffsetY: 8},
      {id: 'shelf_4', texture: 'int_shelf_grocery', x: 16.5 * T, y: 9.5 * T, solid: true, colliderW: 58, colliderH: 26, colliderOffsetY: 8},
    ];

    const interactives: InteractiveObjectData[] = [
      {
        id: 'shop_groc_checkout',
        kind: 'interior_shop',
        shopDomain: 'supermarket',
        initialTab: 'Fresh Food',
        title: 'FreshMart Checkout Counter',
        subtitle: 'Supermarket · Food & Household',
        description: 'Browse all FreshMart produce, drinks, and household items.',
        promptLabel: 'Open FreshMart Store',
        x: 4.5 * T,
        y: 4.8 * T,
        radius: 62,
      },
      {
        id: 'shop_groc_aisle_food',
        kind: 'interior_shop',
        shopDomain: 'supermarket',
        initialTab: 'Fresh Food',
        title: 'Fresh Produce & Drinks Aisle',
        subtitle: 'FreshMart Aisle 1',
        description: 'Orchard apples, picnic packs, and chilled sodas.',
        promptLabel: 'Browse Fresh Produce',
        x: 11 * T,
        y: 6 * T,
        radius: 58,
      },
      {
        id: 'shop_groc_aisle_hh',
        kind: 'interior_shop',
        shopDomain: 'supermarket',
        initialTab: 'Household',
        title: 'Household & Home Care Aisle',
        subtitle: 'FreshMart Aisle 2',
        description: 'Botanical soap bars, cedarwood candles, and kitchen kits.',
        promptLabel: 'Browse Household Goods',
        x: 16.5 * T,
        y: 10.4 * T,
        radius: 58,
      },
    ];

    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Shopping District · Supermarket',
      theme: 'supermarket',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_groc_clerk',
          'Nadia',
          'Store Clerk',
          4.5 * T,
          3.1 * T,
          '#16a34a',
          '#ffffff',
          'Fresh apples just arrived! Grab snacks for Central Park or household essentials.',
          'bob',
        ),
      ],
      roomLabels: [
        {text: 'Checkout', x: 4.5 * T, y: 2.3 * T},
        {text: 'Market Aisles', x: 14 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#0d1814',
    };
  }

  // 4. ARCADE — Pixel Palace Arcade (Upgraded to 7 Playable Arcade Machines)
  if (buildingId === 'b_arcade') {
    const cols = 24;
    const rows = 16;
    const doorCol = 11;
    const tiles = createBaseGrid(cols, rows, 4, 14, [], [5, 18]);
    openDoorwayFloor(tiles, rows, doorCol, 4);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);

    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'prize_case', texture: 'int_prize_case', x: 4.5 * T, y: 4 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'cab_1', texture: 'int_arcade_cab', x: 9.5 * T, y: 4.3 * T, solid: true, colliderW: 32, colliderH: 26, colliderOffsetY: 10},
      {id: 'cab_2', texture: 'int_arcade_cab', x: 13.0 * T, y: 4.3 * T, solid: true, colliderW: 32, colliderH: 26, colliderOffsetY: 10},
      {id: 'cab_3', texture: 'int_arcade_cab', x: 16.5 * T, y: 4.3 * T, solid: true, colliderW: 32, colliderH: 26, colliderOffsetY: 10},
      {id: 'cab_4', texture: 'int_arcade_cab', x: 20.0 * T, y: 4.3 * T, solid: true, colliderW: 32, colliderH: 26, colliderOffsetY: 10},
      {id: 'cab_5', texture: 'int_arcade_cab', x: 5.5 * T, y: 9.8 * T, solid: true, colliderW: 32, colliderH: 26, colliderOffsetY: 10},
      {id: 'cab_6', texture: 'int_arcade_cab', x: 16.5 * T, y: 9.8 * T, solid: true, colliderW: 32, colliderH: 26, colliderOffsetY: 10},
      {id: 'cab_7', texture: 'int_arcade_cab', x: 20.0 * T, y: 9.8 * T, solid: true, colliderW: 32, colliderH: 26, colliderOffsetY: 10},
      {id: 'arc_sofa', texture: 'int_sofa', x: 11.5 * T, y: 10.0 * T, solid: true, colliderW: 58, colliderH: 24, colliderOffsetY: 4},
    ];

    const interactives: InteractiveObjectData[] = [
      {
        id: 'arc_game_starlight',
        kind: 'interior_arcade',
        arcadeGameId: 'starlight_drift',
        title: 'Starlight Drift Cabinet',
        subtitle: 'Space Shooter · Arcade #1',
        description: 'Pilot your starfighter, collect gold stars, dodge asteroids, and earn real coins!',
        promptLabel: 'Play Starlight Drift',
        x: 9.5 * T,
        y: 5.4 * T,
        radius: 52,
      },
      {
        id: 'arc_game_brick',
        kind: 'interior_arcade',
        arcadeGameId: 'brick_blitz',
        title: 'Brick Blitz Cabinet',
        subtitle: 'Neon Breaker · Arcade #2',
        description: 'Smash neon pixel bricks with your energy paddle to win real coins!',
        promptLabel: 'Play Brick Blitz',
        x: 13.0 * T,
        y: 5.4 * T,
        radius: 52,
      },
      {
        id: 'arc_game_turbo',
        kind: 'interior_arcade',
        arcadeGameId: 'turbo_lane_racer',
        title: 'Turbo Lane Racer Cabinet',
        subtitle: 'Highway Dash · Arcade #3',
        description: 'Weave through expressway lanes, grab boosts, and set a top arcade speed run!',
        promptLabel: 'Play Turbo Lane Racer',
        x: 16.5 * T,
        y: 5.4 * T,
        radius: 52,
      },
      {
        id: 'arc_game_hoop',
        kind: 'interior_arcade',
        arcadeGameId: 'hoop_frenzy',
        title: 'Hoop Frenzy Cabinet',
        subtitle: 'Baseline Shootout · Arcade #4',
        description: 'Sink moving basketball hoops on the baseline using your custom character!',
        promptLabel: 'Play Hoop Frenzy',
        x: 20.0 * T,
        y: 5.4 * T,
        radius: 52,
      },
      {
        id: 'arc_game_reflex',
        kind: 'interior_arcade',
        arcadeGameId: 'reflex_surge',
        title: 'Reflex Surge Cabinet',
        subtitle: 'Reaction Matrix · Arcade #5',
        description: 'Strike flashing neon targets before they fade to build mega reaction combos!',
        promptLabel: 'Play Reflex Surge',
        x: 5.5 * T,
        y: 10.9 * T,
        radius: 52,
      },
      {
        id: 'arc_game_prism',
        kind: 'interior_arcade',
        arcadeGameId: 'prism_match',
        title: 'Prism Grid Cabinet',
        subtitle: 'Circuit Puzzle · Arcade #6',
        description: 'Solve the 4x4 neon circuit grid puzzle and illuminate every node cleanly!',
        promptLabel: 'Play Prism Grid',
        x: 16.5 * T,
        y: 10.9 * T,
        radius: 52,
      },
      {
        id: 'arc_game_memory',
        kind: 'interior_arcade',
        arcadeGameId: 'memory_matrix',
        title: 'Memory Matrix Cabinet',
        subtitle: 'Pattern Recall · Arcade #7',
        description: 'Memorize escalating 3x3 cyber sequences and reconstruct every glowing pattern!',
        promptLabel: 'Play Memory Matrix',
        x: 20.0 * T,
        y: 10.9 * T,
        radius: 52,
      },
      {
        id: 'arc_prize_counter',
        kind: 'interior_shop',
        shopDomain: 'arcade_prizes',
        title: 'Pixel Palace Prize Counter',
        subtitle: 'Arcade Collectibles',
        description: 'Redeem your coins for exclusive Pixel Palace trophies and plushies!',
        promptLabel: 'Browse Prize Counter',
        x: 4.5 * T,
        y: 5.0 * T,
        radius: 62,
      },
      {
        id: 'arc_lounge_sofa',
        kind: 'bench',
        title: 'Arcade Lounge Sofa',
        subtitle: 'Pixel Palace',
        description: 'Catch your breath between high-score runs.',
        promptLabel: 'Sit on Arcade Sofa',
        x: 11.5 * T,
        y: 9.2 * T,
        radius: 52,
        seatX: 11.5 * T,
        seatY: 9.8 * T,
      },
    ];

    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Entertainment District · 7 Playable Arcade Games',
      theme: 'arcade',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_arc_host',
          'Zed',
          'Arcade Host',
          4.5 * T,
          3.1 * T,
          '#6366f1',
          '#fbbf24',
          'All 7 neon cabinets are powered up! Play Starlight Drift, Brick Blitz, Turbo Lane Racer, Hoop Frenzy, Reflex Surge, Prism Grid, or Memory Matrix!',
          'spiky',
        ),
      ],
      roomLabels: [
        {text: 'Prize Counter', x: 4.5 * T, y: 2.3 * T},
        {text: 'Main Arcade Floor (7 Games)', x: 14.5 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#0c0a24',
    };
  }

  // 5. CINEMA — Starlight Cinema
  if (buildingId === 'b_cinema') {
    const cols = 22;
    const rows = 17;
    const doorCol = 10;
    const tiles = createBaseGrid(cols, rows, 5, 14, [], [4, 17]);
    openDoorwayFloor(tiles, rows, doorCol, 5);
    // Theater auditorium floor in top half (rows 2..8)
    fillTiles(tiles, 1, 2, cols - 2, 7, 6);

    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    // Partition wall separating Lobby (bottom) and Screening Room (top), with center aisle gate (cols 9..11)
    addPartitionLine(tiles, wallRects, 1, 9, 20, 9, {c: 10});
    // Gated velvet rope collider across cols 10..11 until ticket is purchased!
    wallRects.push({
      centerX: 11 * T,
      centerY: 9.5 * T,
      width: 64,
      height: 20,
      gateId: 'cinema_gate',
    });

    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'ticket_booth', texture: 'int_cinema_booth', x: 4.5 * T, y: 12 * T, solid: true, colliderW: 60, colliderH: 28, colliderOffsetY: 6},
      {id: 'concession', texture: 'int_food_case', x: 16.5 * T, y: 12 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'velvet_rope', texture: 'int_velvet_rope', x: 11 * T, y: 9.5 * T, solid: true, gateId: 'cinema_gate'},
      {id: 'cinema_screen', texture: 'int_cinema_screen', x: 11 * T, y: 2.7 * T, solid: true, colliderW: 186, colliderH: 30, colliderOffsetY: 8},
      // Two rows of velvet theater seats
      {id: 'cseat_1', texture: 'int_cinema_seat', x: 6 * T, y: 5.5 * T, solid: true, colliderW: 22, colliderH: 18},
      {id: 'cseat_2', texture: 'int_cinema_seat', x: 8 * T, y: 5.5 * T, solid: true, colliderW: 22, colliderH: 18},
      {id: 'cseat_3', texture: 'int_cinema_seat', x: 14 * T, y: 5.5 * T, solid: true, colliderW: 22, colliderH: 18},
      {id: 'cseat_4', texture: 'int_cinema_seat', x: 16 * T, y: 5.5 * T, solid: true, colliderW: 22, colliderH: 18},
      {id: 'cseat_5', texture: 'int_cinema_seat', x: 7 * T, y: 7.4 * T, solid: true, colliderW: 22, colliderH: 18},
      {id: 'cseat_6', texture: 'int_cinema_seat', x: 15 * T, y: 7.4 * T, solid: true, colliderW: 22, colliderH: 18},
    ];

    const interactives: InteractiveObjectData[] = [
      {
        id: 'cin_ticket_desk',
        kind: 'interior_cinema_ticket',
        title: 'Starlight Box Office',
        subtitle: 'Screening Room 1 Ticket',
        description:
          'Purchase a Starlight Cinema Ticket (25 coins) to unlock the velvet rope into Screening Room 1.',
        promptLabel: 'Buy Movie Ticket / Check Pass',
        x: 4.5 * T,
        y: 12.8 * T,
        radius: 64,
      },
      {
        id: 'cin_concessions_stand',
        kind: 'interior_shop',
        shopDomain: 'cinema_concessions',
        title: 'Starlight Concessions',
        subtitle: 'Tickets, Popcorn & Slushies',
        description: 'Stock up on buttered popcorn, berry slush, or grab your cinema ticket.',
        promptLabel: 'Visit Concessions Stand',
        x: 16.5 * T,
        y: 12.8 * T,
        radius: 64,
      },
      {
        id: 'cin_gate_prompt',
        kind: 'interior_cinema_ticket',
        title: 'Theater Ticket Gate',
        subtitle: 'Velvet Rope Check',
        description: 'Requires a valid Starlight Cinema Ticket to enter the auditorium.',
        promptLabel: 'Check Ticket Gate',
        x: 11 * T,
        y: 10.3 * T,
        radius: 56,
      },
      {
        id: 'cin_seat_best',
        kind: 'bench',
        title: 'VIP Cinema Seat',
        subtitle: 'Screening Room 1',
        description: 'Settle into a front-row velvet seat.',
        promptLabel: 'Sit in Cinema Seat',
        x: 8 * T,
        y: 5.8 * T,
        radius: 42,
        seatX: 8 * T,
        seatY: 5.4 * T,
      },
      {
        id: 'cin_seat_right',
        kind: 'bench',
        title: 'VIP Cinema Seat',
        subtitle: 'Screening Room 1',
        description: 'Settle into a front-row velvet seat.',
        promptLabel: 'Sit in Cinema Seat',
        x: 14 * T,
        y: 5.8 * T,
        radius: 42,
        seatX: 14 * T,
        seatY: 5.4 * T,
      },
      {
        id: 'cin_watch_movie',
        kind: 'interior_cinema_screen',
        title: 'Watch "Pixels of Tomorrow"',
        subtitle: 'Starlight Feature Presentation',
        description: 'Start the animated pixel-art feature screening on the Starlight screen.',
        promptLabel: 'Watch Feature Film',
        x: 11 * T,
        y: 4.8 * T,
        radius: 86,
      },
    ];

    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Entertainment District · Movie Theater',
      theme: 'cinema',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_cin_usher',
          'Elena',
          'Ticket Usher',
          9.5 * T,
          10.6 * T,
          '#dc2626',
          '#fbbf24',
          'Grab a ticket at the Box Office or Concessions to lift the velvet rope and watch Pixels of Tomorrow!',
          'bob',
        ),
      ],
      roomLabels: [
        {text: 'Screening Room 1', x: 11 * T, y: 3.8 * T},
        {text: 'Cinema Lobby', x: 11 * T, y: 10.2 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#180709',
    };
  }

  // 6. HOMES & APARTMENTS (Bluebird Cottage, Sunbeam House, Clover Residence, Maple Crest Apartments, Harbor Lofts)
  if (
    buildingId === 'b_house_1' ||
    buildingId === 'b_house_2' ||
    buildingId === 'b_house_3' ||
    buildingId === 'b_house_4' ||
    buildingId === 'b_dt_brick_1'
  ) {
    const isApt = buildingId === 'b_house_4' || buildingId === 'b_dt_brick_1';
    const cols = 22;
    const rows = 16;
    const doorCol = 10;
    const cleanTiles = createBaseGrid(cols, rows, 0, 13, [4, 5, 16, 17], [10, 11]);
    openDoorwayFloor(cleanTiles, rows, doorCol, 0);
    fillTiles(cleanTiles, 1, 2, 9, 5, 9); // Kitchen
    fillTiles(cleanTiles, 14, 10, 7, 5, 8); // Bathroom
    fillTiles(cleanTiles, 3, 10, 5, 3, 11); // Living rug
    fillTiles(cleanTiles, 15, 4, 4, 3, 11); // Bedroom rug
    const cleanWalls = buildPerimeterWalls(cols, rows, doorCol);
    // Kitchen partition row 7 (cols 1..8, doorway cols 6..7)
    addPartitionLine(cleanTiles, cleanWalls, 1, 7, 8, 7, {c: 6});
    addPartitionLine(cleanTiles, cleanWalls, 9, 2, 9, 7, {r: 4});
    // Bedroom/Bathroom divider
    addPartitionLine(cleanTiles, cleanWalls, 13, 2, 13, 6, {r: 4});
    addPartitionLine(cleanTiles, cleanWalls, 13, 7, 20, 7, {c: 15});
    addPartitionLine(cleanTiles, cleanWalls, 14, 9, 20, 9, {c: 15});
    addPartitionLine(cleanTiles, cleanWalls, 14, 10, 14, 14, {r: 12});

    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      // Kitchen
      {id: 'k_counter', texture: 'int_kitchen_counter', x: 4 * T, y: 3.1 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'k_fridge', texture: 'int_fridge', x: 1.8 * T, y: 3.1 * T, solid: true, colliderW: 28, colliderH: 26, colliderOffsetY: 8},
      {id: 'k_table', texture: 'int_table_cafe', x: 5 * T, y: 5.4 * T, solid: true, colliderW: 34, colliderH: 22, colliderOffsetY: 4},
      // Kitchen-Living Swing Door
      {id: 'door_kitchen', texture: 'int_door_room', x: 7 * T, y: 7.5 * T, solid: true, gateId: 'door_kitchen_gate', colliderW: 56, colliderH: 18},
      // Living Room
      {id: 'l_tv', texture: 'int_tv', x: 5 * T, y: 8.6 * T, solid: true, colliderW: 44, colliderH: 22, colliderOffsetY: 6},
      {id: 'l_sofa', texture: 'int_sofa', x: 5 * T, y: 12.2 * T, solid: true, colliderW: 58, colliderH: 24, colliderOffsetY: 4},
      {id: 'l_plant', texture: 'int_plant', x: 1.8 * T, y: 12.5 * T, solid: true, colliderW: 20, colliderH: 16, colliderOffsetY: 8},
      // Foyer Study Computer
      {id: 'h_pc', texture: 'int_computer', x: 11 * T, y: 3.1 * T, solid: true, colliderW: 52, colliderH: 24, colliderOffsetY: 6},
      // Bedroom
      {id: 'b_bed', texture: 'int_bed', x: 18.8 * T, y: 3.6 * T, solid: true, colliderW: 40, colliderH: 46, colliderOffsetY: 4},
      {id: 'b_shelf', texture: 'int_bookshelf', x: 15.5 * T, y: 3.1 * T, solid: true, colliderW: 52, colliderH: 26, colliderOffsetY: 8},
      // Bathroom
      {id: 'bath_tub', texture: 'int_bathtub', x: 18.5 * T, y: 11 * T, solid: true, colliderW: 52, colliderH: 26, colliderOffsetY: 4},
      {id: 'bath_mirror', texture: 'int_mirror', x: 16 * T, y: 10.6 * T, solid: true, colliderW: 26, colliderH: 20, colliderOffsetY: 10},
    ];

    const interactives: InteractiveObjectData[] = [
      {
        id: 'home_sofa',
        kind: 'bench',
        title: 'Living Room Sofa',
        subtitle: buildingLabel,
        description: 'Relax on the living room sofa.',
        promptLabel: 'Sit on Sofa',
        x: 5 * T,
        y: 11.4 * T,
        radius: 56,
        seatX: 5 * T,
        seatY: 12.0 * T,
      },
      {
        id: 'home_kitchen_door',
        kind: 'interior_door',
        doorId: 'door_kitchen_gate',
        title: 'Kitchen Doorway',
        subtitle: `${buildingLabel} · Swing Door`,
        description: 'Open or close the wooden interior doorway.',
        promptLabel: 'Open / Close Kitchen Door',
        x: 7 * T,
        y: 8.2 * T,
        radius: 54,
      },
      {
        id: 'home_bed',
        kind: 'interior_bed',
        title: 'Cozy Bed',
        subtitle: `${buildingLabel} · Bedroom`,
        description: 'Lie down on your bed to sleep and recharge Energy to 100%, then wake up when ready.',
        promptLabel: 'Sleep in Bed',
        x: 18.5 * T,
        y: 5.2 * T,
        seatX: 18.8 * T,
        seatY: 3.6 * T,
        radius: 64,
      },
      {
        id: 'home_kitchen',
        kind: 'interior_kitchen',
        title: 'Home Kitchen',
        subtitle: `${buildingLabel} · Kitchen`,
        description: 'Cook snacks, brew herbal tea, or blend fruit smoothies for real Energy and Speed effects.',
        promptLabel: 'Cook in Kitchen',
        x: 3.8 * T,
        y: 4.1 * T,
        radius: 60,
      },
      {
        id: 'home_tv',
        kind: 'interior_tv',
        title: 'Smart Living Room TV',
        subtitle: isApt ? 'Apartment Entertainment Set' : 'Home Entertainment Set',
        description:
          'Power on the TV, switch between 5 animated channels, adjust audio volume, and watch from the living room.',
        promptLabel: 'Turn On / Watch TV',
        x: 5 * T,
        y: 9.4 * T,
        radius: 58,
      },
      {
        id: 'home_pc',
        kind: 'interior_computer',
        title: 'Resident Desktop PC',
        subtitle: `${buildingLabel} · Personal Computer`,
        description:
          'Open the working ChaosOS desktop: view the City Map, Resident Profile, Audio & Display Settings, and Ledger.',
        promptLabel: 'Use Desktop Computer',
        x: 11 * T,
        y: 4.0 * T,
        radius: 58,
      },
    ];

    const finalHouse = deed
      ? applyDeedStylesAndFurniture(
          cleanTiles,
          props,
          interactives,
          0,
          13,
          deed,
          deed.title || buildingLabel,
        )
      : {tiles: cleanTiles, props, interactives};

    return {
      buildingId,
      title: deed ? `${deed.ownerUsername}'s ${deed.title}` : buildingLabel,
      subtitle: deed
        ? `Owned Property · ${isApt ? 'Apartment' : 'House'}`
        : isApt
          ? 'Residential Suite · Furnished Apartment'
          : 'Residential Home · Open Tour',
      theme: isApt ? 'apartment' : 'house',
      cols,
      rows,
      tiles: finalHouse.tiles,
      wallRects: cleanWalls,
      props: finalHouse.props,
      interactives: finalHouse.interactives,
      npcs: [],
      roomLabels: [
        {text: 'Kitchen', x: 4.5 * T, y: 2.2 * T},
        {text: 'Living Room', x: 5 * T, y: 8 * T},
        {text: 'Bedroom', x: 17 * T, y: 2.2 * T},
        {text: 'Bathroom', x: 17.5 * T, y: 9.6 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#17110d',
    };
  }

  // 6b. PREMIUM VILLA — Starlight Crest Villa (Luxury Heights)
  if (buildingId === 'b_villa_1') {
    const cols = 26;
    const rows = 18;
    const doorCol = 12;
    const villaTiles = createBaseGrid(cols, rows, 7, 14, [4, 5, 12, 13, 20, 21], [8, 17]);
    openDoorwayFloor(villaTiles, rows, doorCol, 7);
    fillTiles(villaTiles, 1, 2, 8, 5, 9); // Chef Kitchen
    fillTiles(villaTiles, 19, 11, 6, 6, 8); // Spa Bath
    fillTiles(villaTiles, 3, 11, 7, 4, 11); // Cinema Lounge rug
    fillTiles(villaTiles, 19, 3, 5, 5, 11); // Royal Suite rug
    const villaWalls = buildPerimeterWalls(cols, rows, doorCol);
    addPartitionLine(villaTiles, villaWalls, 1, 7, 8, 7, {c: 6});
    addPartitionLine(villaTiles, villaWalls, 9, 2, 9, 7, {r: 4});
    addPartitionLine(villaTiles, villaWalls, 17, 2, 17, 7, {r: 4});
    addPartitionLine(villaTiles, villaWalls, 17, 8, 24, 8, {c: 20});
    addPartitionLine(villaTiles, villaWalls, 18, 10, 24, 10, {c: 21});
    addPartitionLine(villaTiles, villaWalls, 18, 11, 18, 16, {r: 13});

    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'k_counter', texture: 'int_kitchen_counter', x: 4.5 * T, y: 3.1 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'k_fridge', texture: 'int_fridge', x: 1.8 * T, y: 3.1 * T, solid: true, colliderW: 28, colliderH: 26, colliderOffsetY: 8},
      {id: 'door_kitchen', texture: 'int_door_room', x: 7 * T, y: 7.5 * T, solid: true, gateId: 'door_kitchen_gate', colliderW: 56, colliderH: 18},
      {id: 'v_sofa', texture: 'int_sofa', x: 6.5 * T, y: 13.0 * T, solid: true, colliderW: 58, colliderH: 24, colliderOffsetY: 4},
      {id: 'v_tv', texture: 'int_tv', x: 6.5 * T, y: 9.2 * T, solid: true, colliderW: 44, colliderH: 22, colliderOffsetY: 6},
      {id: 'v_lamp', texture: 'int_lamp', x: 2.2 * T, y: 9.2 * T, solid: true, colliderW: 18, colliderH: 16, colliderOffsetY: 12},
      {id: 'v_trophy', texture: 'int_trophy_stand', x: 13.0 * T, y: 3.4 * T, solid: true, colliderW: 24, colliderH: 20, colliderOffsetY: 8},
      {id: 'v_lbed', texture: 'int_luxury_bed', x: 22.0 * T, y: 4.0 * T, solid: true, colliderW: 50, colliderH: 46, colliderOffsetY: 4},
      {id: 'v_wardrobe', texture: 'int_wardrobe', x: 18.6 * T, y: 3.2 * T, solid: true, colliderW: 40, colliderH: 26, colliderOffsetY: 8},
      {id: 'bath_tub', texture: 'int_bathtub', x: 22.5 * T, y: 12.2 * T, solid: true, colliderW: 52, colliderH: 26, colliderOffsetY: 4},
      {id: 'bath_mirror', texture: 'int_mirror', x: 19.8 * T, y: 11.4 * T, solid: true, colliderW: 26, colliderH: 20, colliderOffsetY: 10},
    ];

    const interactives: InteractiveObjectData[] = [
      {
        id: 'villa_kitchen',
        kind: 'interior_kitchen',
        title: 'Chef Kitchen Island',
        subtitle: `${buildingLabel} · Gourmet Prep`,
        description: 'Prepare artisanal snacks, cold brew, and smoothies for full energy.',
        promptLabel: 'Cook in Villa Kitchen',
        x: 4.5 * T,
        y: 4.1 * T,
        radius: 62,
      },
      {
        id: 'villa_kitchen_door',
        kind: 'interior_door',
        doorId: 'door_kitchen_gate',
        title: 'Kitchen Arch Door',
        subtitle: `${buildingLabel} · Door`,
        description: 'Open or close the interior door.',
        promptLabel: 'Open / Close Door',
        x: 7 * T,
        y: 8.2 * T,
        radius: 54,
      },
      {
        id: 'villa_sofa',
        kind: 'bench',
        title: 'Cinema Lounge Sofa',
        subtitle: buildingLabel,
        description: 'Sink into the plush theater lounge sofa.',
        promptLabel: 'Sit on Villa Sofa',
        x: 6.5 * T,
        y: 12.2 * T,
        radius: 56,
        seatX: 6.5 * T,
        seatY: 12.8 * T,
      },
      {
        id: 'villa_tv',
        kind: 'interior_tv',
        title: 'Villa Cinema Widescreen',
        subtitle: buildingLabel,
        description: 'Stream 5 animated CHAOS channels from the lounge.',
        promptLabel: 'Watch Cinema TV',
        x: 6.5 * T,
        y: 10.0 * T,
        radius: 58,
      },
      {
        id: 'villa_bed',
        kind: 'interior_bed',
        title: 'Royal Starlight King Bed',
        subtitle: `${buildingLabel} · Royal Suite`,
        description: 'Rest to restore Energy cleanly to 100%.',
        promptLabel: 'Sleep in Royal Bed',
        x: 22.0 * T,
        y: 5.5 * T,
        seatX: 22.0 * T,
        seatY: 4.0 * T,
        radius: 66,
      },
    ];

    const finalVilla = deed
      ? applyDeedStylesAndFurniture(
          villaTiles,
          props,
          interactives,
          7,
          14,
          deed,
          deed.title || buildingLabel,
        )
      : {tiles: villaTiles, props, interactives};

    return {
      buildingId,
      title: deed ? `${deed.ownerUsername}'s ${deed.title}` : buildingLabel,
      subtitle: deed ? 'Owned Premium Villa · Luxury Heights' : 'Luxury Heights · Estate Open Tour',
      theme: 'house',
      cols,
      rows,
      tiles: finalVilla.tiles,
      wallRects: villaWalls,
      props: finalVilla.props,
      interactives: finalVilla.interactives,
      npcs: [],
      roomLabels: [
        {text: 'Chef Kitchen', x: 4.5 * T, y: 2.2 * T},
        {text: 'Trophy Gallery', x: 13 * T, y: 2.2 * T},
        {text: 'Royal Suite', x: 21.5 * T, y: 2.2 * T},
        {text: 'Cinema Lounge', x: 6.5 * T, y: 8.6 * T},
        {text: 'Spa Bath', x: 21.5 * T, y: 10.8 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#0d0b1a',
    };
  }

  // 7. SALON — Glow & Snip Salon
  if (buildingId === 'b_salon') {
    const cols = 20;
    const rows = 14;
    const doorCol = 9;
    const tiles = createBaseGrid(cols, rows, 1, 18, [3, 16], [9, 10]);
    openDoorwayFloor(tiles, rows, doorCol, 1);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'cashier', texture: 'int_cashier', x: 4 * T, y: 4 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'salon_1', texture: 'int_salon_chair', x: 10 * T, y: 4.5 * T, solid: true, colliderW: 30, colliderH: 24, colliderOffsetY: 8},
      {id: 'salon_2', texture: 'int_salon_chair', x: 13.5 * T, y: 4.5 * T, solid: true, colliderW: 30, colliderH: 24, colliderOffsetY: 8},
      {id: 'salon_3', texture: 'int_salon_chair', x: 17 * T, y: 4.5 * T, solid: true, colliderW: 30, colliderH: 24, colliderOffsetY: 8},
      {id: 'sofa_wait', texture: 'int_sofa', x: 4.5 * T, y: 9.5 * T, solid: true, colliderW: 58, colliderH: 24, colliderOffsetY: 4},
      {id: 'plant_1', texture: 'int_plant', x: 18 * T, y: 11 * T, solid: true, colliderW: 20, colliderH: 16, colliderOffsetY: 8},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'salon_chair_int',
        kind: 'interior_salon',
        title: 'Glow & Snip Styling Station',
        subtitle: 'Hairstyle & Color Studio',
        description: 'Pick a new pixel hairstyle and hair dye color with live character preview!',
        promptLabel: 'Change Hairstyle & Color',
        x: 13.5 * T,
        y: 5.5 * T,
        radius: 86,
      },
      {
        id: 'salon_wait_sofa',
        kind: 'bench',
        title: 'Lounge Sofa',
        subtitle: 'Glow & Snip Salon',
        description: 'Relax in the salon lounge.',
        promptLabel: 'Sit on Lounge Sofa',
        x: 4.5 * T,
        y: 8.8 * T,
        radius: 52,
        seatX: 4.5 * T,
        seatY: 9.3 * T,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Shopping District · Hair & Style Studio',
      theme: 'salon',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_salon_cleo',
          'Cleo',
          'Master Stylist',
          10 * T,
          3.3 * T,
          '#ec4899',
          '#ffffff',
          'Step up to any styling chair to preview fresh cuts and bright hair colors!',
          'bob',
        ),
      ],
      roomLabels: [{text: 'Styling Chairs', x: 13.5 * T, y: 2.3 * T}],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#1d0d19',
    };
  }

  // 8. BANK — Central Bank
  if (buildingId === 'b_dt_brick_3') {
    const cols = 20;
    const rows = 14;
    const doorCol = 9;
    const tiles = createBaseGrid(cols, rows, 7, 12, [3, 16], []);
    openDoorwayFloor(tiles, rows, doorCol, 7);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'vault', texture: 'int_bank_vault', x: 10 * T, y: 3 * T, solid: true, colliderW: 58, colliderH: 34, colliderOffsetY: 10},
      {id: 'teller_1', texture: 'int_cashier', x: 4.5 * T, y: 5 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'teller_2', texture: 'int_cashier', x: 15.5 * T, y: 5 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'plant_1', texture: 'int_plant', x: 2 * T, y: 11 * T, solid: true, colliderW: 20, colliderH: 16, colliderOffsetY: 8},
      {id: 'plant_2', texture: 'int_plant', x: 18 * T, y: 11 * T, solid: true, colliderW: 20, colliderH: 16, colliderOffsetY: 8},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'bank_teller',
        kind: 'interior_bank',
        title: 'Central Bank Teller & Ledger',
        subtitle: 'CHAOS CITY Treasury',
        description: 'View your coin balance, transaction history, and claim your Citizen Stipend.',
        promptLabel: 'Open Bank Ledger',
        x: 4.5 * T,
        y: 5.8 * T,
        radius: 66,
      },
      {
        id: 'bank_vault_int',
        kind: 'interior_bank',
        title: 'Central Vault Terminal',
        subtitle: 'CHAOS CITY Reserve',
        description: 'Inspect your coin reserves and claim your Citizen Stipend if unclaimed.',
        promptLabel: 'Access Bank Terminal',
        x: 15.5 * T,
        y: 5.8 * T,
        radius: 66,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Downtown · City Bank & Reserve',
      theme: 'bank',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_bank_arthur',
          'Arthur',
          'Senior Teller',
          4.5 * T,
          4 * T,
          '#1e3a8a',
          '#fbbf24',
          'Good day! Visit our teller desk anytime to review transactions or claim your Citizen Stipend.',
        ),
      ],
      roomLabels: [{text: 'City Reserve Vault', x: 10 * T, y: 5.2 * T}],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#0a1224',
    };
  }

  // 9. ELECTRONICS — Apex Tech Center
  if (buildingId === 'b_dt_tower_1') {
    const cols = 20;
    const rows = 14;
    const doorCol = 9;
    const tiles = createBaseGrid(cols, rows, 1, 12, [4, 15], []);
    openDoorwayFloor(tiles, rows, doorCol, 1);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'cashier', texture: 'int_cashier', x: 4.5 * T, y: 4 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'demo_1', texture: 'int_desk', x: 11 * T, y: 5.5 * T, solid: true, colliderW: 52, colliderH: 24, colliderOffsetY: 6},
      {id: 'demo_2', texture: 'int_desk', x: 16 * T, y: 5.5 * T, solid: true, colliderW: 52, colliderH: 24, colliderOffsetY: 6},
      {id: 'demo_3', texture: 'int_computer', x: 13.5 * T, y: 9.5 * T, solid: true, colliderW: 52, colliderH: 24, colliderOffsetY: 6},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'tech_store_main',
        kind: 'interior_shop',
        shopDomain: 'electronics',
        title: 'Apex Electronics Store',
        subtitle: 'Wearables & Handheld Gadgets',
        description: 'Browse studio headphones, pixel smartwatches, and pocket consoles.',
        promptLabel: 'Browse Electronics',
        x: 11 * T,
        y: 6.4 * T,
        radius: 86,
      },
      {
        id: 'tech_cashier',
        kind: 'interior_shop',
        shopDomain: 'electronics',
        title: 'Apex Tech Checkout',
        subtitle: 'Downtown Flagship Store',
        description: 'Purchase electronics directly and equip wearable headphones in your Bag!',
        promptLabel: 'Shop Tech Gear',
        x: 4.5 * T,
        y: 4.8 * T,
        radius: 64,
      },
      {
        id: 'tech_demo_pc',
        kind: 'interior_computer',
        title: 'Apex Pro Demo Workstation',
        subtitle: 'ChaosOS Desktop System',
        description: 'Test drive ChaosOS apps, inspect your Citizen Profile, and open the City Map.',
        promptLabel: 'Use Demo Computer',
        x: 13.5 * T,
        y: 10.4 * T,
        radius: 58,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Downtown · Electronics & Gadgets',
      theme: 'electronics',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_tech_ria',
          'Ria',
          'Tech Specialist',
          4.5 * T,
          3.1 * T,
          '#0ea5e9',
          '#e0f2fe',
          'Our Studio Wireless Headphones can actually be equipped right onto your character!',
          'bob',
        ),
      ],
      roomLabels: [{text: 'Gadget Showroom', x: 13.5 * T, y: 2.3 * T}],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#071422',
    };
  }

  // 10. PET SHOP — Paws & Whiskers Pet Shop
  if (buildingId === 'b_petshop') {
    const cols = 20;
    const rows = 14;
    const doorCol = 9;
    const tiles = createBaseGrid(cols, rows, 0, 13, [4, 15], [9]);
    openDoorwayFloor(tiles, rows, doorCol, 0);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'cashier', texture: 'int_cashier', x: 4.5 * T, y: 4 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'pen_1', texture: 'int_pet_pen', x: 12 * T, y: 4.8 * T, solid: true, colliderW: 52, colliderH: 30, colliderOffsetY: 6},
      {id: 'pen_2', texture: 'int_pet_pen', x: 17 * T, y: 4.8 * T, solid: true, colliderW: 52, colliderH: 30, colliderOffsetY: 6},
      {id: 'shelf_pet', texture: 'int_shelf_grocery', x: 14.5 * T, y: 9.5 * T, solid: true, colliderW: 58, colliderH: 26, colliderOffsetY: 8},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'pet_shop_counter',
        kind: 'interior_shop',
        shopDomain: 'petshop',
        title: 'Paws & Whiskers Adoption & Supplies',
        subtitle: 'Pet Shop Catalog',
        description: 'Adopt a Pixel Corgi or Calico Cat certificate and stock up on crunchy treats.',
        promptLabel: 'Browse Pets & Supplies',
        x: 4.5 * T,
        y: 4.8 * T,
        radius: 64,
      },
      {
        id: 'pet_pen_corgi',
        kind: 'interior_pet_play',
        petSpecies: 'Biscuit the Pixel Corgi',
        title: 'Biscuit the Corgi',
        subtitle: 'Play Pen 1 · Friendly Pup',
        description: 'Biscuit wags his stubby tail happily! Adopt his certificate at the front desk.',
        promptLabel: 'Pet Biscuit the Corgi',
        x: 12 * T,
        y: 5.8 * T,
        radius: 56,
      },
      {
        id: 'pet_pen_cat',
        kind: 'interior_pet_play',
        petSpecies: 'Mochi the Calico Cat',
        title: 'Mochi the Calico Cat',
        subtitle: 'Play Pen 2 · Purring Pro',
        description: 'Mochi blinks slowly and stretches out on her cushion.',
        promptLabel: 'Pet Mochi the Cat',
        x: 17 * T,
        y: 5.8 * T,
        radius: 56,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Shopping District · Pet Shop',
      theme: 'petshop',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_pet_keeper',
          'Pip',
          'Pet Keeper',
          4.5 * T,
          3.1 * T,
          '#65a30d',
          '#fef08a',
          'Say hi to Biscuit and Mochi in their pens, or browse adoption papers and treats!',
          'cap',
        ),
      ],
      roomLabels: [{text: 'Pet Play Pens', x: 14.5 * T, y: 2.3 * T}],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#18150b',
    };
  }

  // 11. GYM — IronWorks Gym
  if (buildingId === 'b_gym') {
    const cols = 20;
    const rows = 14;
    const doorCol = 9;
    const tiles = createBaseGrid(cols, rows, 10, 18, [3, 16], []);
    openDoorwayFloor(tiles, rows, doorCol, 10);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'smoothie_bar', texture: 'int_cashier', x: 4.5 * T, y: 4 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'treadmill_1', texture: 'int_treadmill', x: 10.5 * T, y: 4.5 * T, solid: true, colliderW: 30, colliderH: 34, colliderOffsetY: 6},
      {id: 'treadmill_2', texture: 'int_treadmill', x: 13 * T, y: 4.5 * T, solid: true, colliderW: 30, colliderH: 34, colliderOffsetY: 6},
      {id: 'weights_1', texture: 'int_weights', x: 16.5 * T, y: 4.8 * T, solid: true, colliderW: 50, colliderH: 24, colliderOffsetY: 6},
      {id: 'punchbag', texture: 'int_punchbag', x: 15.5 * T, y: 9.5 * T, solid: true, colliderW: 22, colliderH: 20, colliderOffsetY: 12},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'gym_workout_tread',
        kind: 'interior_gym_workout',
        title: 'Sprint Cardio Challenge',
        subtitle: 'IronWorks Gym · Treadmill',
        description: 'Hit the rhythm taps to finish a quick sprint session and earn +15 Coins!',
        promptLabel: 'Start Gym Workout',
        x: 11.8 * T,
        y: 5.8 * T,
        radius: 64,
      },
      {
        id: 'gym_workout_bag',
        kind: 'interior_gym_workout',
        title: 'Heavy Bag Sparring',
        subtitle: 'IronWorks Gym · Boxing Zone',
        description: 'Complete a 10-tap heavy bag combo to build stamina and earn +15 Coins!',
        promptLabel: 'Hit Punching Bag',
        x: 15.5 * T,
        y: 10.2 * T,
        radius: 56,
      },
      {
        id: 'gym_juice_bar',
        kind: 'interior_shop',
        shopDomain: 'gym_bar',
        title: 'IronWorks Smoothie Bar',
        subtitle: 'Protein Shakes & Boosts',
        description: 'Grab a Berry Protein Smoothie to restore energy and gain a 40s Speed Boost.',
        promptLabel: 'Order Protein Smoothie',
        x: 4.5 * T,
        y: 4.8 * T,
        radius: 62,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Shopping District · Fitness & Training',
      theme: 'gym',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_gym_coach',
          'Coach Kira',
          'Fitness Trainer',
          4.5 * T,
          3.1 * T,
          '#f97316',
          '#0f172a',
          'Jump on the treadmill or heavy bag for a quick workout challenge and earn coins!',
          'spiky',
        ),
      ],
      roomLabels: [
        {text: 'Smoothie Bar', x: 4.5 * T, y: 2.3 * T},
        {text: 'Training Floor', x: 14 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#111622',
    };
  }

  // 12. HOSPITAL / CLINIC — Metro Health Clinic
  if (buildingId === 'b_clinic') {
    const cols = 20;
    const rows = 14;
    const doorCol = 9;
    const tiles = createBaseGrid(cols, rows, 3, 13, [4, 15], []);
    openDoorwayFloor(tiles, rows, doorCol, 3);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    addPartitionLine(tiles, wallRects, 13, 2, 13, 12, {r: 8});
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'reception', texture: 'int_cashier', x: 4.5 * T, y: 4 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'wait_sofa', texture: 'int_sofa', x: 4.5 * T, y: 9.5 * T, solid: true, colliderW: 58, colliderH: 24, colliderOffsetY: 4},
      {id: 'exam_bed', texture: 'int_clinic_bed', x: 17 * T, y: 4.5 * T, solid: true, colliderW: 52, colliderH: 28, colliderOffsetY: 4},
      {id: 'plant_1', texture: 'int_plant', x: 11 * T, y: 3 * T, solid: true, colliderW: 20, colliderH: 16, colliderOffsetY: 8},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'clinic_pharmacy',
        kind: 'interior_shop',
        shopDomain: 'clinic',
        title: 'Clinic Pharmacy Counter',
        subtitle: 'Wellness & Vitamin Tonics',
        description: 'Pick up City Vitamin Tonics to keep in your bag for instant energy.',
        promptLabel: 'Visit Pharmacy',
        x: 4.5 * T,
        y: 4.8 * T,
        radius: 62,
      },
      {
        id: 'clinic_exam_check',
        kind: 'interior_clinic_checkup',
        title: 'Wellness Checkup',
        subtitle: 'Exam Room · Dr. Elena',
        description: 'Receive a complimentary city health checkup that restores Energy to 100%!',
        promptLabel: 'Get Free Checkup',
        x: 17 * T,
        y: 5.5 * T,
        radius: 64,
      },
      {
        id: 'clinic_wait_seat',
        kind: 'bench',
        title: 'Waiting Room Sofa',
        subtitle: 'Metro Health Clinic',
        description: 'Take a seat in reception.',
        promptLabel: 'Sit in Reception',
        x: 4.5 * T,
        y: 8.8 * T,
        radius: 52,
        seatX: 4.5 * T,
        seatY: 9.3 * T,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Downtown · Medical & Wellness',
      theme: 'clinic',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_clinic_doc',
          'Dr. Patel',
          'City Physician',
          15 * T,
          3.5 * T,
          '#f8fafc',
          '#ef4444',
          'Step into the exam bay anytime for a free wellness checkup to restore full Energy!',
        ),
      ],
      roomLabels: [
        {text: 'Reception', x: 6 * T, y: 2.3 * T},
        {text: 'Exam Room', x: 16.5 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#0a161c',
    };
  }

  // 13. LIBRARY OR BOOKSTORE (City Gazette Library / Vinyl & Books)
  if (buildingId === 'b_dt_brick_2' || buildingId === 'b_shop_brick') {
    const isBookstore = buildingId === 'b_shop_brick';
    const cols = 20;
    const rows = 14;
    const doorCol = 9;
    const tiles = createBaseGrid(cols, rows, 0, 13, [4, 15], [9, 10]);
    openDoorwayFloor(tiles, rows, doorCol, 0);
    fillTiles(tiles, 6, 5, 8, 5, 11);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'desk_front', texture: 'int_cashier', x: 4.5 * T, y: 4 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'shelf_1', texture: 'int_bookshelf', x: 11 * T, y: 3.3 * T, solid: true, colliderW: 52, colliderH: 26, colliderOffsetY: 8},
      {id: 'shelf_2', texture: 'int_bookshelf', x: 15.5 * T, y: 3.3 * T, solid: true, colliderW: 52, colliderH: 26, colliderOffsetY: 8},
      {id: 'study_desk', texture: 'int_desk', x: 14 * T, y: 8.5 * T, solid: true, colliderW: 52, colliderH: 24, colliderOffsetY: 6},
      {id: 'chair_study', texture: 'int_chair', x: 14 * T, y: 9.8 * T, solid: true, colliderW: 18, colliderH: 18},
      ...(isBookstore ? [] : [{id: 'lib_pc', texture: 'int_computer', x: 2.5 * T, y: 9.2 * T, solid: true, colliderW: 50, colliderH: 24, colliderOffsetY: 6}]),
    ];
    const interactives: InteractiveObjectData[] = isBookstore
      ? [
          {
            id: 'bookstore_buy',
            kind: 'interior_shop',
            shopDomain: 'bookstore',
            title: 'Vinyl & Books Counter',
            subtitle: 'Records, Books & Comics',
            description: 'Purchase illustrated city atlases, lo-fi vinyl records, and comics.',
            promptLabel: 'Browse Vinyl & Books',
            x: 4.5 * T,
            y: 4.8 * T,
            radius: 66,
          },
          {
            id: 'bookstore_read',
            kind: 'interior_library_trivia',
            title: 'Listening & Reading Corner',
            subtitle: 'Vinyl & Books Lounge',
            description: 'Test your CHAOS CITY knowledge with a quick trivia challenge for +15 Coins!',
            promptLabel: 'Play Book Trivia',
            x: 14 * T,
            y: 9.2 * T,
            radius: 62,
          },
        ]
      : [
          {
            id: 'library_trivia',
            kind: 'interior_library_trivia',
            title: 'City Gazette Research Desk',
            subtitle: 'Public Library Trivia',
            description: 'Read city archives and answer a quick quiz to earn +15 Coins!',
            promptLabel: 'Start Library Quiz',
            x: 14 * T,
            y: 9.2 * T,
            radius: 66,
          },
          {
            id: 'library_books',
            kind: 'interior_info',
            infoKey: 'gazette_archives',
            title: 'City Gazette Archives',
            subtitle: 'Public Library · Downtown',
            description:
              'Flip through 4 illustrated historic issues of the City Gazette chronicling all five CHAOS CITY districts.',
            promptLabel: 'Browse Gazette Issues',
            x: 13 * T,
            y: 4.5 * T,
            radius: 64,
          },
          {
            id: 'library_pc',
            kind: 'interior_computer',
            title: 'Library Public Computer',
            subtitle: 'City Gazette Catalog PC',
            description: 'Access the ChaosOS city directory, citizen profile, and settings.',
            promptLabel: 'Use Library Computer',
            x: 2.5 * T,
            y: 10.1 * T,
            radius: 56,
          },
        ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: isBookstore ? 'Shopping District · Indie Store' : 'Downtown · Public Library & Press',
      theme: isBookstore ? 'bookstore' : 'library',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          `npc_${buildingId}_lib`,
          isBookstore ? 'Jude' : 'Evelyn',
          isBookstore ? 'Record Clerk' : 'Archivist',
          4.5 * T,
          3.1 * T,
          '#65a30d',
          '#fef9c3',
          isBookstore
            ? 'Browse our vinyl records and city atlases, or try the reading corner quiz!'
            : 'Welcome to the Gazette & Library! Browse our issues, use the public PC, or test your trivia for coins.',
          'bob',
        ),
      ],
      roomLabels: [
        {text: isBookstore ? 'Vinyl & Books' : 'Archives', x: 13.5 * T, y: 2.2 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#15120c',
    };
  }

  // 14. HOSPITAL — Chaos City Hospital
  if (buildingId === 'b_hospital') {
    const cols = 22;
    const rows = 15;
    const doorCol = 10;
    const tiles = createBaseGrid(cols, rows, 3, 13, [4, 17], []);
    openDoorwayFloor(tiles, rows, doorCol, 3);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    addPartitionLine(tiles, wallRects, 12, 2, 12, 12, {r: 8});
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'hosp_desk', texture: 'int_cashier', x: 4.5 * T, y: 4 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'hosp_wait', texture: 'int_sofa', x: 4.5 * T, y: 10 * T, solid: true, colliderW: 58, colliderH: 24, colliderOffsetY: 4},
      {id: 'hosp_med_bay', texture: 'int_med_bay', x: 17 * T, y: 4.5 * T, solid: true, colliderW: 56, colliderH: 30, colliderOffsetY: 6},
      {id: 'hosp_bed2', texture: 'int_clinic_bed', x: 17 * T, y: 10 * T, solid: true, colliderW: 52, colliderH: 28, colliderOffsetY: 4},
      {id: 'hosp_plant', texture: 'int_plant', x: 9.5 * T, y: 3 * T, solid: true, colliderW: 20, colliderH: 16, colliderOffsetY: 8},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'hosp_heal_bay',
        kind: 'interior_hospital_heal',
        title: 'Emergency ER Medical Bay',
        subtitle: 'Chaos City Hospital',
        description: 'Run an instant ECG diagnostic check to restore Energy to 100/100 free of charge.',
        promptLabel: 'Run ER Checkup (Heal 100%)',
        x: 17 * T,
        y: 5.7 * T,
        radius: 68,
      },
      {
        id: 'hosp_pharm',
        kind: 'interior_shop',
        shopDomain: 'clinic',
        title: 'Hospital Pharmacy',
        subtitle: 'Tonics & Recovery Items',
        description: 'Purchase vitamin tonics and med-packs to carry in your Bag.',
        promptLabel: 'Browse Pharmacy',
        x: 4.5 * T,
        y: 4.9 * T,
        radius: 64,
      },
      {
        id: 'hosp_sofa',
        kind: 'bench',
        title: 'Triage Lounge Sofa',
        subtitle: 'Chaos City Hospital',
        description: 'Rest in the hospital lobby.',
        promptLabel: 'Sit on Sofa',
        x: 4.5 * T,
        y: 9.2 * T,
        radius: 52,
        seatX: 4.5 * T,
        seatY: 9.8 * T,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Luxury Heights · Emergency Medical Center',
      theme: 'hospital',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_hosp_chief',
          'Dr. Lin',
          'Chief Surgeon',
          14.5 * T,
          3.4 * T,
          '#f8fafc',
          '#ef4444',
          'Welcome to Chaos City Hospital! Use our ER Medical Bay anytime for a free 100% recovery.',
          'bob',
        ),
      ],
      roomLabels: [
        {text: 'Lobby & Pharmacy', x: 5.5 * T, y: 2.3 * T},
        {text: 'ER Treatment Bay', x: 17 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#071720',
    };
  }

  // 15. POLICE PRECINCT — CCPD Police Precinct
  if (buildingId === 'b_police') {
    const cols = 22;
    const rows = 15;
    const doorCol = 10;
    const tiles = createBaseGrid(cols, rows, 7, 12, [4, 17], []);
    openDoorwayFloor(tiles, rows, doorCol, 7);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'pol_desk', texture: 'int_police_desk', x: 5 * T, y: 4.3 * T, solid: true, colliderW: 62, colliderH: 30, colliderOffsetY: 6},
      {id: 'pol_pc', texture: 'int_computer', x: 11 * T, y: 4.3 * T, solid: true, colliderW: 52, colliderH: 24, colliderOffsetY: 6},
      {id: 'pol_cell1', texture: 'int_cell_gate', x: 17 * T, y: 4.5 * T, solid: true, colliderW: 52, colliderH: 28, colliderOffsetY: 8},
      {id: 'pol_cell2', texture: 'int_cell_gate', x: 17 * T, y: 9.5 * T, solid: true, colliderW: 52, colliderH: 28, colliderOffsetY: 8},
      {id: 'pol_sofa', texture: 'int_sofa', x: 4.5 * T, y: 10 * T, solid: true, colliderW: 58, colliderH: 24, colliderOffsetY: 4},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'pol_dispatch_term',
        kind: 'interior_police_term',
        title: 'CCPD Precinct Dispatch Terminal',
        subtitle: 'Wanted Record & Civic Clearance',
        description: 'Inspect your active Wanted Level and settle any open alert cleanly.',
        promptLabel: 'Access Police Terminal',
        x: 5 * T,
        y: 5.5 * T,
        radius: 68,
      },
      {
        id: 'pol_os_pc',
        kind: 'interior_computer',
        title: 'Precinct Roster Workstation',
        subtitle: 'ChaosOS Public Safety Terminal',
        description: 'View the city map, resident profile, and ledger.',
        promptLabel: 'Use Precinct PC',
        x: 11 * T,
        y: 5.4 * T,
        radius: 58,
      },
      {
        id: 'pol_sofa_int',
        kind: 'bench',
        title: 'Lobby Bench',
        subtitle: 'CCPD Headquarters',
        description: 'Wait in the precinct lobby.',
        promptLabel: 'Sit on Bench',
        x: 4.5 * T,
        y: 9.2 * T,
        radius: 52,
        seatX: 4.5 * T,
        seatY: 9.8 * T,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Luxury Heights · Law Enforcement HQ',
      theme: 'police',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_pol_capt',
          'Capt. Vance',
          'Precinct Captain',
          5 * T,
          3.1 * T,
          '#1e3a8a',
          '#fbbf24',
          'Drive safe on Metro Expressway! If a car alarm raises your Wanted Stars, check in at our Precinct Terminal.',
          'short',
        ),
      ],
      roomLabels: [
        {text: 'Dispatch Desk', x: 5 * T, y: 2.3 * T},
        {text: 'Holding Wing', x: 17 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#071126',
    };
  }

  // 16. FIRE STATION — Metro Fire Station
  if (buildingId === 'b_fire') {
    const cols = 22;
    const rows = 15;
    const doorCol = 10;
    const tiles = createBaseGrid(cols, rows, 10, 12, [4, 17], []);
    openDoorwayFloor(tiles, rows, doorCol, 10);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'fire_engine', texture: 'int_fire_truck', x: 15.5 * T, y: 5 * T, solid: true, colliderW: 90, colliderH: 38, colliderOffsetY: 8},
      {id: 'fire_weights', texture: 'int_weights', x: 5 * T, y: 4.5 * T, solid: true, colliderW: 50, colliderH: 24, colliderOffsetY: 6},
      {id: 'fire_desk', texture: 'int_desk', x: 5 * T, y: 9.8 * T, solid: true, colliderW: 52, colliderH: 24, colliderOffsetY: 6},
      {id: 'fire_toolbox', texture: 'int_toolbox', x: 16 * T, y: 10 * T, solid: true, colliderW: 40, colliderH: 24, colliderOffsetY: 6},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'fire_drill_int',
        kind: 'interior_fire_drill',
        title: 'Fire Hose Safety Drill',
        subtitle: 'Metro Fire Station · Apparatus Bay',
        description: 'Extinguish practice training flares with your high-pressure hose for coins & XP!',
        promptLabel: 'Start Fire Hose Drill',
        x: 15.5 * T,
        y: 6.4 * T,
        radius: 76,
      },
      {
        id: 'fire_gym_int',
        kind: 'interior_gym_workout',
        title: 'Firehouse Strength Rig',
        subtitle: 'Crew Conditioning',
        description: 'Complete a 12-rep strength training set for +15 Coins.',
        promptLabel: 'Train on Firehouse Rig',
        x: 5 * T,
        y: 5.5 * T,
        radius: 62,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Industrial · Rapid Response HQ',
      theme: 'fire',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_fire_chief',
          'Chief Blaze',
          'Fire Captain',
          5 * T,
          8.6 * T,
          '#dc2626',
          '#fde047',
          'Engines are primed! Step up to Ladder 01 for a live Fire Hose Drill and earn coins!',
          'spiky',
        ),
      ],
      roomLabels: [
        {text: 'Crew Gym', x: 5 * T, y: 2.3 * T},
        {text: 'Apparatus Bay', x: 15.5 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#1b0d0d',
    };
  }

  // 17. AIRPORT TERMINAL — Starlight International Terminal
  if (buildingId === 'b_airport') {
    const cols = 24;
    const rows = 15;
    const doorCol = 11;
    const tiles = createBaseGrid(cols, rows, 3, 13, [4, 5, 18, 19], []);
    openDoorwayFloor(tiles, rows, doorCol, 3);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'air_gate', texture: 'int_gate_desk', x: 12 * T, y: 4.3 * T, solid: true, colliderW: 64, colliderH: 26, colliderOffsetY: 6},
      {id: 'air_shop', texture: 'int_cashier', x: 4.5 * T, y: 4.3 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'air_cafe', texture: 'int_food_case', x: 19 * T, y: 4.3 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'air_sofa1', texture: 'int_sofa', x: 6 * T, y: 9.8 * T, solid: true, colliderW: 58, colliderH: 24, colliderOffsetY: 4},
      {id: 'air_sofa2', texture: 'int_sofa', x: 18 * T, y: 9.8 * T, solid: true, colliderW: 58, colliderH: 24, colliderOffsetY: 4},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'air_duty_shop',
        kind: 'interior_shop',
        shopDomain: 'airport_dutyfree',
        title: 'Starlight Duty-Free Concourse',
        subtitle: 'Aviation Shades, Luggage & Coffee',
        description: 'Pick up aviator shades, travel jackets, and sky-latte refreshments.',
        promptLabel: 'Shop Duty-Free',
        x: 4.5 * T,
        y: 5.3 * T,
        radius: 66,
      },
      {
        id: 'air_departures',
        kind: 'interior_info',
        title: 'Starlight Departure Board',
        subtitle: 'Gate A1 · Live Flights',
        description:
          'Departures: Flight SC-09 to Emerald Isles [ON TIME] · Flight CC-404 to Skyline Harbor [BOARDING]. Watch jets roll down Runway 01 outside!',
        promptLabel: 'Check Flight Schedule',
        x: 12 * T,
        y: 5.3 * T,
        radius: 68,
      },
      {
        id: 'air_lounge_seat',
        kind: 'bench',
        title: 'Terminal Boarding Lounge',
        subtitle: 'Starlight Airport',
        description: 'Take a seat before boarding.',
        promptLabel: 'Sit in Gate Lounge',
        x: 6 * T,
        y: 9.0 * T,
        radius: 52,
        seatX: 6 * T,
        seatY: 9.6 * T,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Starlight Airport · Departures Concourse',
      theme: 'airport',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_air_agent',
          'Capt. Maya',
          'Gate Coordinator',
          12 * T,
          3.1 * T,
          '#0284c7',
          '#e0f2fe',
          'Welcome to Starlight Terminal! Browse Duty-Free sunglasses or inspect Gate A1 departures.',
          'bob',
        ),
      ],
      roomLabels: [
        {text: 'Duty-Free', x: 4.5 * T, y: 2.3 * T},
        {text: 'Gate A1 Check-In', x: 12 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#071426',
    };
  }

  // 18. LUXURY HOTEL — Grand Vista Resort Hotel
  if (buildingId === 'b_hotel') {
    const cols = 22;
    const rows = 15;
    const doorCol = 10;
    const tiles = createBaseGrid(cols, rows, 1, 13, [4, 17], [8, 13]);
    openDoorwayFloor(tiles, rows, doorCol, 1);
    fillTiles(tiles, 13, 3, 7, 9, 5); // Plush VIP suite carpet
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    addPartitionLine(tiles, wallRects, 12, 2, 12, 12, {r: 8});
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'hot_desk', texture: 'int_cashier', x: 5 * T, y: 4 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'hot_sofa', texture: 'int_sofa', x: 5 * T, y: 10 * T, solid: true, colliderW: 58, colliderH: 24, colliderOffsetY: 4},
      {id: 'hot_bed', texture: 'int_luxury_bed', x: 17.5 * T, y: 4.8 * T, solid: true, colliderW: 52, colliderH: 48, colliderOffsetY: 4},
      {id: 'hot_tv', texture: 'int_tv', x: 17.5 * T, y: 10.5 * T, solid: true, colliderW: 44, colliderH: 22, colliderOffsetY: 6},
      {id: 'hot_plant', texture: 'int_plant', x: 10 * T, y: 3.2 * T, solid: true, colliderW: 20, colliderH: 16, colliderOffsetY: 8},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'hotel_suite_bed',
        kind: 'interior_bed',
        title: 'Penthouse King Bed',
        subtitle: 'Grand Vista Suite',
        description: 'Rest in luxury suite comfort to restore Energy to 100% and save your progress.',
        promptLabel: 'Rest in Suite Bed',
        x: 17.5 * T,
        y: 6.4 * T,
        seatX: 17.5 * T,
        seatY: 4.8 * T,
        radius: 68,
      },
      {
        id: 'hotel_tv_set',
        kind: 'interior_tv',
        title: 'Hotel Suite 4K TV',
        subtitle: 'Grand Vista Resort',
        description: 'Switch channels and watch live CHAOS CITY broadcasts from the suite.',
        promptLabel: 'Watch Suite TV',
        x: 17.5 * T,
        y: 11.4 * T,
        radius: 58,
      },
      {
        id: 'hotel_lobby_sofa',
        kind: 'bench',
        title: 'Marble Atrium Sofa',
        subtitle: 'Grand Vista Lobby',
        description: 'Unwind in the marble hotel lobby.',
        promptLabel: 'Sit on Lobby Sofa',
        x: 5 * T,
        y: 9.2 * T,
        radius: 52,
        seatX: 5 * T,
        seatY: 9.8 * T,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Luxury Heights · Five-Star Resort',
      theme: 'hotel',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_hotel_conc',
          'Henri',
          'Head Concierge',
          5 * T,
          3.1 * T,
          '#581c87',
          '#fbbf24',
          'Good evening! Your complimentary Penthouse Suite on the right wing has a King Bed and 4K TV.',
          'sidepart',
        ),
      ],
      roomLabels: [
        {text: 'Concierge Lobby', x: 6 * T, y: 2.3 * T},
        {text: 'Penthouse Suite', x: 17 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#180c24',
    };
  }

  // 19. CAR DEALERSHIP — Apex Prestige Motors
  if (buildingId === 'b_dealership') {
    const cols = 22;
    const rows = 15;
    const doorCol = 10;
    const tiles = createBaseGrid(cols, rows, 1, 12, [4, 17], []);
    openDoorwayFloor(tiles, rows, doorCol, 1);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'dlr_lift', texture: 'int_car_lift', x: 15.5 * T, y: 5 * T, solid: true, colliderW: 88, colliderH: 46, colliderOffsetY: 8},
      {id: 'dlr_desk', texture: 'int_cashier', x: 5 * T, y: 4.5 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'dlr_sofa', texture: 'int_sofa', x: 5 * T, y: 10 * T, solid: true, colliderW: 58, colliderH: 24, colliderOffsetY: 4},
      {id: 'dlr_paint', texture: 'int_paint_booth', x: 15.5 * T, y: 10 * T, solid: true, colliderW: 52, colliderH: 30, colliderOffsetY: 6},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'dlr_showroom_buy',
        kind: 'interior_garage',
        garageTab: 'showroom',
        title: 'Apex Prestige Vehicle Showroom',
        subtitle: 'Buy SUVs, Motorcycles, Pickups & Classics',
        description: 'Browse all 12 Chaos City vehicles including Luxury Cruiser SUV, Off-Road Pickup, and Street Superbike!',
        promptLabel: 'Open Vehicle Showroom',
        x: 5 * T,
        y: 5.5 * T,
        radius: 68,
      },
      {
        id: 'dlr_custom_bay',
        kind: 'interior_garage',
        garageTab: 'customize',
        title: 'Showroom Paint & Performance Bay',
        subtitle: 'Custom Paint & Upgrades',
        description: 'Customize colors, spoilers, rims, and performance tuning on your owned rides.',
        promptLabel: 'Customize Vehicle',
        x: 15.5 * T,
        y: 6.5 * T,
        radius: 76,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Luxury Heights · 12-Model Vehicle Showroom',
      theme: 'dealership',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_dlr_rep',
          'Sloane',
          'Motors Director',
          5 * T,
          3.4 * T,
          '#0284c7',
          '#fde047',
          'Check out our brand-new SUVs, Pickups, Cargo Vans, and Sport Motorcycles right in the Showroom!',
          'bob',
        ),
      ],
      roomLabels: [
        {text: 'Sales Desk', x: 5 * T, y: 2.3 * T},
        {text: 'Showroom Floor', x: 15.5 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#0a1628',
    };
  }

  // 20. AUTO REPAIR SHOP — Ironworks Repair Bay
  if (buildingId === 'b_repair') {
    const cols = 22;
    const rows = 15;
    const doorCol = 10;
    const tiles = createBaseGrid(cols, rows, 10, 14, [4, 17], []);
    openDoorwayFloor(tiles, rows, doorCol, 10);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'rep_lift', texture: 'int_car_lift', x: 15.5 * T, y: 5 * T, solid: true, colliderW: 88, colliderH: 46, colliderOffsetY: 8},
      {id: 'rep_desk', texture: 'int_cashier', x: 4.5 * T, y: 4.5 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'rep_tires', texture: 'int_tire_rack', x: 15.5 * T, y: 10.2 * T, solid: true, colliderW: 52, colliderH: 24, colliderOffsetY: 6},
      {id: 'rep_tools', texture: 'int_toolbox', x: 5 * T, y: 9.8 * T, solid: true, colliderW: 40, colliderH: 24, colliderOffsetY: 6},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'rep_diagnostic_bay',
        kind: 'interior_repair',
        title: 'Hydraulic Chassis Repair Bay',
        subtitle: 'Restore Damaged Vehicles to 100%',
        description: 'Inspect vehicle condition % and restore dented bodywork & engines to mint 100%.',
        promptLabel: 'Repair Owned Vehicles',
        x: 15.5 * T,
        y: 6.5 * T,
        radius: 76,
      },
      {
        id: 'rep_tune_counter',
        kind: 'interior_garage',
        garageTab: 'customize',
        title: 'Custom Parts & Tuning Counter',
        subtitle: 'Engine, Tires & Paint',
        description: 'Open Garage tuning and upgrade your active ride.',
        promptLabel: 'Tune & Customize',
        x: 4.5 * T,
        y: 5.4 * T,
        radius: 64,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Highway & Industrial · Repair & Service',
      theme: 'repair',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_rep_mech',
          'Jax',
          'Lead Technician',
          4.5 * T,
          3.3 * T,
          '#f97316',
          '#0f172a',
          'Banged up a fender on the expressway? Pull onto the Hydraulic Bay to repair any owned vehicle to 100%!',
          'cap',
        ),
      ],
      roomLabels: [
        {text: 'Parts Counter', x: 4.5 * T, y: 2.3 * T},
        {text: 'Service Lift', x: 15.5 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#151923',
    };
  }

  // 21. SHOPPING MALL — Grand Metro Mall
  if (buildingId === 'b_mall') {
    const cols = 24;
    const rows = 15;
    const doorCol = 11;
    const tiles = createBaseGrid(cols, rows, 1, 12, [4, 5, 18, 19], []);
    openDoorwayFloor(tiles, rows, doorCol, 1);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'mall_kiosk1', texture: 'int_mall_kiosk', x: 6 * T, y: 4.5 * T, solid: true, colliderW: 60, colliderH: 28, colliderOffsetY: 6},
      {id: 'mall_kiosk2', texture: 'int_mall_kiosk', x: 18 * T, y: 4.5 * T, solid: true, colliderW: 60, colliderH: 28, colliderOffsetY: 6},
      {id: 'mall_rack1', texture: 'int_rack', x: 6 * T, y: 9.8 * T, solid: true, colliderW: 48, colliderH: 28, colliderOffsetY: 6},
      {id: 'mall_rack2', texture: 'int_rack', x: 18 * T, y: 9.8 * T, solid: true, colliderW: 48, colliderH: 28, colliderOffsetY: 6},
      {id: 'mall_sofa', texture: 'int_sofa', x: 12 * T, y: 7.4 * T, solid: true, colliderW: 58, colliderH: 24, colliderOffsetY: 4},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'mall_galerie_shop',
        kind: 'interior_shop',
        shopDomain: 'mall',
        title: 'Grand Metro Mall Boutique',
        subtitle: 'Luxury Jackets, Hats & Collectibles',
        description: 'Browse flagship mall hoodies, designer sunglasses, and city souvenirs.',
        promptLabel: 'Shop Mall Catalog',
        x: 6 * T,
        y: 5.5 * T,
        radius: 68,
      },
      {
        id: 'mall_apparel_wing',
        kind: 'interior_shop',
        shopDomain: 'clothing',
        title: 'Metro Streetwear Wing',
        subtitle: 'Apparel & Shoes',
        description: 'Browse full Chaos City wardrobe gear.',
        promptLabel: 'Browse Apparel',
        x: 18 * T,
        y: 5.5 * T,
        radius: 68,
      },
      {
        id: 'mall_atrium_sofa',
        kind: 'bench',
        title: 'Mall Atrium Lounge',
        subtitle: 'Grand Metro Mall',
        description: 'Rest in the central mall concourse.',
        promptLabel: 'Sit in Atrium',
        x: 12 * T,
        y: 6.6 * T,
        radius: 52,
        seatX: 12 * T,
        seatY: 7.2 * T,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Metro Highway Hub · Flagship Shopping Center',
      theme: 'mall',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_mall_host',
          'Ariana',
          'Mall Stylist',
          12 * T,
          4.2 * T,
          '#a855f7',
          '#fef08a',
          'Explore both wings of Grand Metro Mall for limited mall jackets, sunglasses, and accessories!',
          'bob',
        ),
      ],
      roomLabels: [
        {text: 'Luxury Boutique', x: 6 * T, y: 2.3 * T},
        {text: 'Streetwear Wing', x: 18 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#190f28',
    };
  }

  // 22. MUSIC STORE — EchoBeat Music & Synth Lab
  if (buildingId === 'b_music') {
    const cols = 22;
    const rows = 15;
    const doorCol = 10;
    const tiles = createBaseGrid(cols, rows, 4, 14, [], [5, 16]);
    openDoorwayFloor(tiles, rows, doorCol, 4);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'mus_synth', texture: 'int_synth_stage', x: 15.5 * T, y: 5 * T, solid: true, colliderW: 60, colliderH: 28, colliderOffsetY: 6},
      {id: 'mus_desk', texture: 'int_cashier', x: 5 * T, y: 4.5 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'mus_shelf', texture: 'int_bookshelf', x: 15.5 * T, y: 10 * T, solid: true, colliderW: 52, colliderH: 26, colliderOffsetY: 8},
      {id: 'mus_sofa', texture: 'int_sofa', x: 5 * T, y: 10 * T, solid: true, colliderW: 58, colliderH: 24, colliderOffsetY: 4},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'mus_synth_play',
        kind: 'interior_music_synth',
        title: 'EchoBeat Live Synthesizer Stage',
        subtitle: 'Interactive 8-Key WebAudio Synth',
        description: 'Play live musical notes across a glowing octave keyboard with synth effects!',
        promptLabel: 'Play Live Synth',
        x: 15.5 * T,
        y: 6.1 * T,
        radius: 68,
      },
      {
        id: 'mus_gear_shop',
        kind: 'interior_shop',
        shopDomain: 'music',
        title: 'EchoBeat Instruments & Audio',
        subtitle: 'Headphones, Vinyls & Gear',
        description: 'Pick up studio headphones, gold records, and tour tees.',
        promptLabel: 'Shop Music Gear',
        x: 5 * T,
        y: 5.4 * T,
        radius: 64,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Shopping & Music · Live Synth & Audio Shop',
      theme: 'music',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_mus_dj',
          'Tempo',
          'Sound Engineer',
          5 * T,
          3.3 * T,
          '#06b6d4',
          '#f472b6',
          'Step over to our EchoBeat Synthesizer on the right to jam live notes using your keyboard or taps!',
          'spiky',
        ),
      ],
      roomLabels: [
        {text: 'Vinyl & Gear', x: 5 * T, y: 2.3 * T},
        {text: 'Live Synth Stage', x: 15.5 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#0d0c28',
    };
  }

  // 23. TRAIN STATION — Central Rail Concourse
  if (buildingId === 'b_train') {
    const cols = 22;
    const rows = 15;
    const doorCol = 10;
    const tiles = createBaseGrid(cols, rows, 7, 12, [4, 17], []);
    openDoorwayFloor(tiles, rows, doorCol, 7);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'trn_kiosk', texture: 'int_train_kiosk', x: 5 * T, y: 4.5 * T, solid: true, colliderW: 40, colliderH: 30, colliderOffsetY: 6},
      {id: 'trn_cafe', texture: 'int_food_case', x: 16.5 * T, y: 4.5 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'trn_sofa1', texture: 'int_sofa', x: 6 * T, y: 10 * T, solid: true, colliderW: 58, colliderH: 24, colliderOffsetY: 4},
      {id: 'trn_sofa2', texture: 'int_sofa', x: 16 * T, y: 10 * T, solid: true, colliderW: 58, colliderH: 24, colliderOffsetY: 4},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'trn_fast_travel',
        kind: 'interior_train_transit',
        title: 'Metro Rail Express Terminal',
        subtitle: 'Complimentary Citywide Fast Travel',
        description: 'Board a high-speed Chaos Rail shuttle directly to any district station across the 160x120 map!',
        promptLabel: 'Board Express Rail',
        x: 5 * T,
        y: 5.5 * T,
        radius: 68,
      },
      {
        id: 'trn_snacks',
        kind: 'interior_shop',
        shopDomain: 'cafe',
        title: 'Station Espresso Kiosk',
        subtitle: 'Quick Drinks & Pastries',
        description: 'Grab a commuter espresso before your train departs.',
        promptLabel: 'Buy Commuter Snack',
        x: 16.5 * T,
        y: 5.4 * T,
        radius: 64,
      },
      {
        id: 'trn_bench',
        kind: 'bench',
        title: 'Platform Waiting Bench',
        subtitle: 'Central Rail Station',
        description: 'Have a seat on the platform.',
        promptLabel: 'Sit on Bench',
        x: 6 * T,
        y: 9.2 * T,
        radius: 52,
        seatX: 6 * T,
        seatY: 9.8 * T,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Metro Highway · Express Rail Transit',
      theme: 'train',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_trn_cond',
          'Conductor Cole',
          'Rail Master',
          8.2 * T,
          4.2 * T,
          '#92400e',
          '#fde68a',
          'All aboard! Use our Metro Rail Terminal on the left to fast-travel anywhere across all 11 districts!',
          'cap',
        ),
      ],
      roomLabels: [
        {text: 'Ticket Kiosk', x: 5 * T, y: 2.3 * T},
        {text: 'Platform Espresso', x: 16.5 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#18120c',
    };
  }

  // 24. STARLIGHT LUCKY LOUNGE — Free Fun Tokens Entertainment Venue
  if (buildingId === 'b_casino_lounge') {
    const cols = 22;
    const rows = 15;
    const doorCol = 10;
    const tiles = createBaseGrid(cols, rows, 5, 14, [], [5, 16]);
    openDoorwayFloor(tiles, rows, doorCol, 5);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'lounge_flip', texture: 'int_flip_table', x: 10.5 * T, y: 5 * T, solid: true, colliderW: 52, colliderH: 30, colliderOffsetY: 6},
      {id: 'lounge_wheel', texture: 'int_lucky_wheel', x: 17 * T, y: 5 * T, solid: true, colliderW: 40, colliderH: 34, colliderOffsetY: 8},
      {id: 'lounge_prize', texture: 'int_cashier', x: 4.5 * T, y: 4.5 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'lounge_sofa', texture: 'int_sofa', x: 13.5 * T, y: 10 * T, solid: true, colliderW: 58, colliderH: 24, colliderOffsetY: 4},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'lounge_coin_table',
        kind: 'interior_casino_lounge',
        infoKey: 'coin_flip',
        title: '50/50 Sun & Moon Flip Table',
        subtitle: 'FREE Fun Tokens Only · Zero Real Money',
        description: 'Play with free Fun Tokens (free +25 FT refills anytime). Transparent 50.0% win odds!',
        promptLabel: 'Play 50/50 Coin Flip',
        x: 10.5 * T,
        y: 6.1 * T,
        radius: 66,
      },
      {
        id: 'lounge_wheel_spin',
        kind: 'interior_casino_lounge',
        infoKey: 'lucky_wheel',
        title: '50/50 Neon Prize Wheel',
        subtitle: 'FREE Fun Tokens Only · Zero Real Money',
        description: 'Spin the bright Gold Sun / Cyan Moon 50/50 prize wheel using free Fun Tokens!',
        promptLabel: 'Spin 50/50 Prize Wheel',
        x: 17 * T,
        y: 6.2 * T,
        radius: 66,
      },
      {
        id: 'lounge_prize_shop',
        kind: 'interior_shop',
        shopDomain: 'lounge_prizes',
        title: 'Starlight Lounge Prize Counter',
        subtitle: 'Redeem Free Fun Tokens',
        description: 'Trade your Fun Tokens for exclusive VIP Starlight Plushies, Glasses & Trophies!',
        promptLabel: 'Browse Lounge Prizes',
        x: 4.5 * T,
        y: 5.4 * T,
        radius: 64,
      },
      {
        id: 'lounge_vip_sofa',
        kind: 'bench',
        title: 'Velvet VIP Sofa',
        subtitle: 'Starlight Lucky Lounge',
        description: 'Kick back in the Starlight Lounge.',
        promptLabel: 'Sit on VIP Sofa',
        x: 13.5 * T,
        y: 9.2 * T,
        radius: 52,
        seatX: 13.5 * T,
        seatY: 9.8 * T,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Luxury Heights · Free Fun Token Lounge',
      theme: 'casino_lounge',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_lounge_host',
          'Celeste',
          'Lounge Host',
          4.5 * T,
          3.2 * T,
          '#be185d',
          '#fde047',
          'Welcome to Starlight Lucky Lounge! Everything uses 100% FREE Fun Tokens with fair 50.0% odds and prize redemptions!',
          'bob',
        ),
      ],
      roomLabels: [
        {text: 'Fun Token Prizes', x: 4.5 * T, y: 2.3 * T},
        {text: '50/50 Games Floor', x: 14 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#1f0815',
    };
  }

  // 25. LOGISTICS WAREHOUSE — Ironworks Freight Warehouse
  if (buildingId === 'b_warehouse') {
    const cols = 22;
    const rows = 15;
    const doorCol = 10;
    const tiles = createBaseGrid(cols, rows, 10, 14, [4, 17], []);
    openDoorwayFloor(tiles, rows, doorCol, 10);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'wh_fork1', texture: 'int_forklift', x: 15.5 * T, y: 5 * T, solid: true, colliderW: 48, colliderH: 30, colliderOffsetY: 6},
      {id: 'wh_fork2', texture: 'int_forklift', x: 17 * T, y: 10 * T, solid: true, colliderW: 48, colliderH: 30, colliderOffsetY: 6},
      {id: 'wh_desk', texture: 'int_desk', x: 5 * T, y: 4.8 * T, solid: true, colliderW: 52, colliderH: 24, colliderOffsetY: 6},
      {id: 'wh_tools', texture: 'int_toolbox', x: 5 * T, y: 9.8 * T, solid: true, colliderW: 40, colliderH: 24, colliderOffsetY: 6},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'wh_dispatch_shift',
        kind: 'interior_office_task',
        title: 'Freight Manifest Sorting Shift',
        subtitle: 'Ironworks Logistics Bay',
        description: 'Complete a warehouse manifest dispatch shift to earn +20 Coins!',
        promptLabel: 'Work Freight Shift (+20c)',
        x: 5 * T,
        y: 5.7 * T,
        radius: 68,
      },
      {
        id: 'wh_manifest_pc',
        kind: 'interior_computer',
        title: 'Logistics Yard Terminal',
        subtitle: 'ChaosOS Inventory Control',
        description: 'Inspect city map, resident ledger, and system settings.',
        promptLabel: 'Use Yard Computer',
        x: 15.5 * T,
        y: 6.1 * T,
        radius: 62,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Industrial District · Cargo & Dispatch',
      theme: 'warehouse',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_wh_boss',
          'Hank',
          'Dock Foreman',
          5 * T,
          3.4 * T,
          '#eab308',
          '#1e293b',
          'Need extra coins? Clock in at the Manifest Desk for a quick freight sorting shift!',
          'cap',
        ),
      ],
      roomLabels: [
        {text: 'Dispatch Desk', x: 5 * T, y: 2.3 * T},
        {text: 'Cargo Staging', x: 16 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#17150e',
    };
  }

  // 26. COUNTRY FARM MARKET — Emerald Valley Farm Stand
  if (buildingId === 'b_farm_market') {
    const cols = 20;
    const rows = 14;
    const doorCol = 9;
    const tiles = createBaseGrid(cols, rows, 0, 12, [4, 15], []);
    openDoorwayFloor(tiles, rows, doorCol, 0);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'frm_stall', texture: 'int_farm_stall', x: 14.5 * T, y: 4.5 * T, solid: true, colliderW: 58, colliderH: 30, colliderOffsetY: 6},
      {id: 'frm_cashier', texture: 'int_cashier', x: 4.5 * T, y: 4.5 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'frm_kitchen', texture: 'int_kitchen_counter', x: 14.5 * T, y: 9.5 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'frm_table', texture: 'int_table_cafe', x: 5 * T, y: 9.5 * T, solid: true, colliderW: 34, colliderH: 22, colliderOffsetY: 4},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'frm_harvest_shop',
        kind: 'interior_shop',
        shopDomain: 'farm_market',
        title: 'Emerald Valley Organic Market',
        subtitle: 'Fresh Apples, Cider & Honey',
        description: 'Pick up orchard apples, honey jars, and farm fresh snacks for instant energy.',
        promptLabel: 'Shop Farm Produce',
        x: 4.5 * T,
        y: 5.4 * T,
        radius: 66,
      },
      {
        id: 'frm_stall_shop',
        kind: 'interior_shop',
        shopDomain: 'farm_market',
        title: 'Orchard Harvest Display',
        subtitle: 'Countryside Goods',
        description: 'Browse seasonal countryside baskets and energy treats.',
        promptLabel: 'Browse Harvest Stall',
        x: 14.5 * T,
        y: 5.6 * T,
        radius: 66,
      },
      {
        id: 'frm_bake_station',
        kind: 'interior_kitchen',
        title: 'Farmhouse Cider & Pie Counter',
        subtitle: 'Fresh Harvest Kitchen',
        description: 'Prepare warm apple snacks & cider for energy and speed boosts.',
        promptLabel: 'Prepare Farm Treat',
        x: 14.5 * T,
        y: 10.4 * T,
        radius: 62,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Emerald Valley · Organic Country Market',
      theme: 'farm_market',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_frm_mae',
          'Farmer Mae',
          'Grower & Baker',
          4.5 * T,
          3.3 * T,
          '#16a34a',
          '#fef08a',
          'Freshly picked right from Emerald Valley! Grab apple cider at the counter or bake a pie at our kitchen station.',
          'bob',
        ),
      ],
      roomLabels: [
        {text: 'Checkout', x: 4.5 * T, y: 2.3 * T},
        {text: 'Harvest Market', x: 14.5 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#101c11',
    };
  }

  // 27. BOARDWALK CAFE — Pacific Surf Boardwalk Cafe
  if (buildingId === 'b_boardwalk_cafe') {
    const cols = 20;
    const rows = 14;
    const doorCol = 9;
    const tiles = createBaseGrid(cols, rows, 2, 12, [4, 15], []);
    openDoorwayFloor(tiles, rows, doorCol, 2);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'bw_counter', texture: 'int_cashier', x: 4.5 * T, y: 4 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'bw_pastry', texture: 'int_food_case', x: 8 * T, y: 4 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
      {id: 'bw_table1', texture: 'int_table_cafe', x: 14.5 * T, y: 5.5 * T, solid: true, colliderW: 34, colliderH: 22, colliderOffsetY: 4},
      {id: 'bw_table2', texture: 'int_table_cafe', x: 14.5 * T, y: 9.5 * T, solid: true, colliderW: 34, colliderH: 22, colliderOffsetY: 4},
      {id: 'bw_plant', texture: 'int_plant', x: 18 * T, y: 3.5 * T, solid: true, colliderW: 20, colliderH: 16, colliderOffsetY: 8},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'bw_cafe_shop',
        kind: 'interior_shop',
        shopDomain: 'cafe',
        title: 'Pacific Surf Cafe Menu',
        subtitle: 'Iced Lattes, Smoothies & Pastries',
        description: 'Order chilled coastal drinks and pastries to recharge Energy or get a speed boost.',
        promptLabel: 'Order Boardwalk Cafe',
        x: 6 * T,
        y: 5.0 * T,
        radius: 68,
      },
      {
        id: 'bw_window_seat',
        kind: 'bench',
        title: 'Ocean View Booth',
        subtitle: 'Pacific Surf Cafe',
        description: 'Relax with an ocean breeze.',
        promptLabel: 'Sit at Ocean Table',
        x: 14.5 * T,
        y: 6.4 * T,
        radius: 52,
        seatX: 14.5 * T,
        seatY: 5.8 * T,
      },
    ];
    return {
      buildingId,
      title: buildingLabel,
      subtitle: 'Golden Beach · Boardwalk Bistro',
      theme: 'boardwalk_cafe',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_bw_kai',
          'Kai',
          'Surf Barista',
          4.5 * T,
          3.1 * T,
          '#06b6d4',
          '#fef08a',
          'Catching waves on the East Coast? Grab an iced latte here and enjoy the ocean boardwalk!',
          'spiky',
        ),
      ],
      roomLabels: [
        {text: 'Espresso Bar', x: 6 * T, y: 2.3 * T},
        {text: 'Ocean Seating', x: 14.5 * T, y: 2.3 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#0a1d24',
    };
  }

  // 27B. THE MISSION HOUSE — Downtown Story Campaign Headquarters
  if (buildingId === 'b_mission_house') {
    const cols = 18;
    const rows = 14;
    const doorCol = 8;
    const tiles = createBaseGrid(cols, rows, 7, 12, [3, 14], [6, 11]);
    openDoorwayFloor(tiles, rows, doorCol, 7);
    const wallRects = buildPerimeterWalls(cols, rows, doorCol);
    const props: InteriorProp[] = [
      {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
      {id: 'crest_l', texture: 'int_crest_banner', x: 5.5 * T, y: 1.55 * T, solid: false},
      {id: 'crest_r', texture: 'int_crest_banner', x: 12.5 * T, y: 1.55 * T, solid: false},
      {id: 'mission_board', texture: 'int_mission_board', x: 4.5 * T, y: 3.1 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 8},
      {id: 'command_desk', texture: 'int_desk', x: 9.0 * T, y: 4.9 * T, solid: true, colliderW: 54, colliderH: 24, colliderOffsetY: 6},
      {id: 'trophy_stand', texture: 'int_trophy_stand', x: 13.5 * T, y: 3.3 * T, solid: true, colliderW: 26, colliderH: 22, colliderOffsetY: 8},
      {id: 'bookshelf_1', texture: 'int_bookshelf', x: 2.0 * T, y: 4.2 * T, solid: true, colliderW: 42, colliderH: 24, colliderOffsetY: 8},
      {id: 'sofa_briefing', texture: 'int_sofa', x: 14.2 * T, y: 9.6 * T, solid: true, colliderW: 58, colliderH: 24, colliderOffsetY: 4},
      {id: 'plant_l', texture: 'int_plant', x: 1.8 * T, y: 11.0 * T, solid: true, colliderW: 20, colliderH: 16, colliderOffsetY: 8},
      {id: 'plant_r', texture: 'int_plant', x: 16.0 * T, y: 11.0 * T, solid: true, colliderW: 20, colliderH: 16, colliderOffsetY: 8},
    ];
    const interactives: InteractiveObjectData[] = [
      {
        id: 'mission_house_man',
        kind: 'interior_mission_man',
        title: 'The Mission Man · Command Desk',
        subtitle: 'Story Campaign Operations',
        description: 'Speak with The Mission Man to accept briefings, turn in active Story Missions, and rise through Chaos City.',
        promptLabel: 'Speak to Mission Man',
        x: 9.0 * T,
        y: 5.8 * T,
        radius: 78,
      },
      {
        id: 'mission_house_board',
        kind: 'interior_mission_board',
        title: 'Campaign Operations Board',
        subtitle: 'Chaos City Tactical Dossier',
        description: 'Inspect your full Story Campaign progression, choices, and current objective status.',
        promptLabel: 'Inspect Mission Board',
        x: 4.5 * T,
        y: 4.2 * T,
        radius: 70,
      },
      {
        id: 'mission_house_sofa',
        kind: 'bench',
        title: 'Command Briefing Sofa',
        subtitle: 'The Mission House',
        description: 'Take a breather between high-stakes city operations.',
        promptLabel: 'Rest on Sofa',
        x: 14.2 * T,
        y: 8.8 * T,
        radius: 52,
        seatX: 14.2 * T,
        seatY: 9.4 * T,
      },
    ];
    return {
      buildingId,
      title: 'The Mission House',
      subtitle: 'Downtown · Story Campaign Headquarters',
      theme: 'mission_house',
      cols,
      rows,
      tiles,
      wallRects,
      props,
      interactives,
      npcs: [
        makeNpc(
          'npc_mission_man',
          'The Mission Man',
          'Syndicate Strategist',
          9.0 * T,
          3.9 * T,
          '#78350f',
          '#facc15',
          'Step forward when you are ready for your next operation, Kai.',
          'short',
        ),
      ],
      roomLabels: [
        {text: 'Tactical Board', x: 4.5 * T, y: 2.2 * T},
        {text: 'Command Desk', x: 9.0 * T, y: 2.2 * T},
        {text: 'Hall of Honor', x: 13.8 * T, y: 2.2 * T},
      ],
      spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
      exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
      ambientBgHex: '#120e1a',
    };
  }

  // 28. OFFICE — Skyline Commerce Office (Fallback / Office template)
  const cols = 20;
  const rows = 14;
  const doorCol = 9;
  const tiles = createBaseGrid(cols, rows, 7, 12, [4, 15], []);
  openDoorwayFloor(tiles, rows, doorCol, 7);
  const wallRects = buildPerimeterWalls(cols, rows, doorCol);
  const props: InteriorProp[] = [
    {id: 'exit_mat', texture: 'int_exit_mat', x: (doorCol + 0.5) * T, y: (rows - 1) * T + 10, solid: false},
    {id: 'reception', texture: 'int_cashier', x: 4.5 * T, y: 4 * T, solid: true, colliderW: 60, colliderH: 26, colliderOffsetY: 6},
    {id: 'desk_1', texture: 'int_desk', x: 11.5 * T, y: 5 * T, solid: true, colliderW: 52, colliderH: 24, colliderOffsetY: 6},
    {id: 'desk_2', texture: 'int_computer', x: 16.5 * T, y: 5 * T, solid: true, colliderW: 52, colliderH: 24, colliderOffsetY: 6},
    {id: 'sofa_lounge', texture: 'int_sofa', x: 14 * T, y: 10 * T, solid: true, colliderW: 58, colliderH: 24, colliderOffsetY: 4},
    {id: 'plant_1', texture: 'int_plant', x: 1.8 * T, y: 11 * T, solid: true, colliderW: 20, colliderH: 16, colliderOffsetY: 8},
  ];
  const interactives: InteractiveObjectData[] = [
    {
      id: 'office_work_term',
      kind: 'interior_office_task',
      title: 'Commerce Terminal — Quick Shift',
      subtitle: 'Skyline Office Workstation',
      description: 'Complete a quick city dispatch sorting task to earn +20 Coins!',
      promptLabel: 'Work Quick Shift (+20c)',
      x: 11.5 * T,
      y: 5.9 * T,
      radius: 68,
    },
    {
      id: 'office_pc',
      kind: 'interior_computer',
      title: 'Skyline Office Desktop',
      subtitle: 'ChaosOS Workstation',
      description: 'Open the ChaosOS desktop interface for city directory, profile, and bank ledger.',
      promptLabel: 'Use Office Computer',
      x: 16.5 * T,
      y: 5.9 * T,
      radius: 64,
    },
    {
      id: 'office_lounge_sofa',
      kind: 'bench',
      title: 'Break Lounge Sofa',
      subtitle: buildingLabel,
      description: 'Relax in the executive break lounge.',
      promptLabel: 'Sit on Lounge Sofa',
      x: 14 * T,
      y: 9.2 * T,
      radius: 54,
      seatX: 14 * T,
      seatY: 9.8 * T,
    },
  ];
  return {
    buildingId,
    title: buildingLabel,
    subtitle: 'Downtown · Corporate Office & Dispatch',
    theme: 'office',
    cols,
    rows,
    tiles,
    wallRects,
    props,
    interactives,
    npcs: [
      makeNpc(
        'npc_office_mgr',
        'Morgan',
        'Operations Lead',
        4.5 * T,
        3.1 * T,
        '#0f766e',
        '#2dd4bf',
        'Need extra coins for Threadz Boutique? Run a quick dispatch shift at Workstation 1 or check ChaosOS on Workstation 2!',
      ),
    ],
    roomLabels: [{text: 'Workstations', x: 14 * T, y: 2.3 * T}],
    spawnPoint: {x: (doorCol + 0.5) * T, y: (rows - 2.3) * T},
    exitPoint: {x: (doorCol + 0.5) * T, y: (rows - 1) * T + 4},
    ambientBgHex: '#0a141f',
  };
}
