import Phaser from 'phaser';
import {CHARACTER_PRESETS, TILE_SIZE} from '@/src/config/constants';
import {getShopItemById} from '@/src/game/data/catalog';
import {
  AnimationState,
  CharacterAppearanceConfig,
  CharacterPreset,
  Direction,
  EquippedClothing,
  HairOverride,
  HairStyleId,
  SaveDataV1,
  ShopItem,
} from '@/src/game/types/gameTypes';

function shadeHex(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
}

function createPixelCanvas(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
): {tex: Phaser.Textures.CanvasTexture; ctx: CanvasRenderingContext2D} | null {
  if (scene.textures.exists(key)) {
    return null;
  }
  const tex = scene.textures.createCanvas(key, width, height);
  if (!tex) return null;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  return {tex, ctx};
}

function finalizeTexture(tex: Phaser.Textures.CanvasTexture): void {
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/**
 * Returns discrete chunked generation steps so PreloadScene can yield frames and report smooth progress.
 */
export function getPixelArtGenerationSteps(
  scene: Phaser.Scene,
): Array<{label: string; run: () => void}> {
  const steps: Array<{label: string; run: () => void}> = [
    {label: 'Synthesizing city terrain tileset...', run: () => generateCityTileset(scene)},
    {label: 'Constructing 35 district buildings...', run: () => generateBuildings(scene)},
    {label: 'Rendering street props & neon lights...', run: () => generateProps(scene)},
    {label: 'Preparing ambient & weather particles...', run: () => generateParticles(scene)},
  ];

  const batchSize = 3;
  for (let i = 0; i < CHARACTER_PRESETS.length; i += batchSize) {
    const batch = CHARACTER_PRESETS.slice(i, i + batchSize);
    steps.push({
      label: `Tailoring resident sprites (${Math.min(i + batchSize, CHARACTER_PRESETS.length)}/${CHARACTER_PRESETS.length})...`,
      run: () => {
        for (const preset of batch) {
          generateCharacterSpritesheet(scene, `char_${preset.id}`, preset);
        }
      },
    });
  }
  return steps;
}

/**
 * Generates all crisp 32x32 city tiles, buildings, props, particles, and character spritesheets.
 */
export function generateAllPixelArt(scene: Phaser.Scene): void {
  for (const step of getPixelArtGenerationSteps(scene)) {
    step.run();
  }
}

export function ensureCharacterSpritesheet(
  scene: Phaser.Scene,
  key: string,
  preset: CharacterPreset,
): void {
  generateCharacterSpritesheet(scene, key, preset);
}

function generateCityTileset(scene: Phaser.Scene): void {
  const cols = 16;
  const rows = 3;
  const created = createPixelCanvas(scene, 'city_tileset', cols * TILE_SIZE, rows * TILE_SIZE);
  if (!created) return;
  const {tex, ctx} = created;

  const tileOrigin = (idx: number) => ({
    ox: (idx % cols) * TILE_SIZE,
    oy: Math.floor(idx / cols) * TILE_SIZE,
  });

  // 0: Natural Grass A
  {
    const {ox, oy} = tileOrigin(0);
    px(ctx, ox, oy, 32, 32, '#4ea84b');
    const blades = [
      [4, 6], [14, 4], [24, 10], [8, 20], [20, 24], [27, 28], [12, 14],
    ];
    for (const [bx, by] of blades) {
      px(ctx, ox + bx, oy + by, 2, 2, '#41923f');
      px(ctx, ox + bx + 1, oy + by - 1, 1, 2, '#65bf60');
    }
  }

  // 1: Natural Grass B (subtle clover flecks)
  {
    const {ox, oy} = tileOrigin(1);
    px(ctx, ox, oy, 32, 32, '#4da54a');
    px(ctx, ox + 5, oy + 9, 2, 2, '#6bc765');
    px(ctx, ox + 19, oy + 7, 2, 2, '#3f8f3d');
    px(ctx, ox + 11, oy + 23, 3, 2, '#6bc765');
    px(ctx, ox + 25, oy + 19, 2, 2, '#3f8f3d');
    px(ctx, ox + 15, oy + 15, 1, 1, '#a7f3d0');
  }

  // 2: Vibrant Park Grass
  {
    const {ox, oy} = tileOrigin(2);
    px(ctx, ox, oy, 32, 32, '#58bd54');
    px(ctx, ox + 3, oy + 5, 2, 2, '#73d46e');
    px(ctx, ox + 16, oy + 12, 2, 2, '#45a142');
    px(ctx, ox + 23, oy + 24, 2, 2, '#73d46e');
    px(ctx, ox + 9, oy + 26, 2, 2, '#45a142');
  }

  // 3: Sidewalk Concrete
  {
    const {ox, oy} = tileOrigin(3);
    px(ctx, ox, oy, 32, 32, '#cbd5e1');
    px(ctx, ox, oy, 32, 1, '#e2e8f0');
    px(ctx, ox, oy + 31, 32, 1, '#94a3b8');
    px(ctx, ox + 15, oy, 1, 32, '#b4c0cf');
    px(ctx, ox, oy + 15, 32, 1, '#b4c0cf');
    px(ctx, ox + 6, oy + 6, 2, 1, '#b8c4d4');
    px(ctx, ox + 21, oy + 22, 2, 1, '#b8c4d4');
  }

  // 4: Plaza Pavers (Entertainment & Downtown)
  {
    const {ox, oy} = tileOrigin(4);
    px(ctx, ox, oy, 32, 32, '#b8c2d1');
    for (let py = 0; py < 32; py += 16) {
      for (let pxIdx = 0; pxIdx < 32; pxIdx += 16) {
        const alt = ((pxIdx + py) / 16) % 2 === 0;
        px(ctx, ox + pxIdx + 1, oy + py + 1, 14, 14, alt ? '#cbd5e1' : '#aab6c8');
        px(ctx, ox + pxIdx + 1, oy + py + 1, 14, 1, '#e2e8f0');
      }
    }
  }

  // 5: Park Cobblestone Path
  {
    const {ox, oy} = tileOrigin(5);
    px(ctx, ox, oy, 32, 32, '#a68b6b');
    const stones = [
      [2, 2, 12, 8], [16, 2, 13, 9],
      [2, 12, 8, 9], [12, 13, 10, 8], [24, 12, 6, 9],
      [2, 23, 13, 7], [17, 22, 13, 8],
    ];
    for (const [sx, sy, sw, sh] of stones) {
      px(ctx, ox + sx, oy + sy, sw, sh, '#d6c3a5');
      px(ctx, ox + sx, oy + sy, sw, 1, '#eadbc4');
      px(ctx, ox + sx, oy + sy + sh - 1, sw, 1, '#b8a080');
    }
  }

  // 6: Road Asphalt Clean
  {
    const {ox, oy} = tileOrigin(6);
    px(ctx, ox, oy, 32, 32, '#333b48');
    px(ctx, ox + 5, oy + 8, 2, 1, '#2b323d');
    px(ctx, ox + 19, oy + 21, 2, 1, '#3f4857');
    px(ctx, ox + 26, oy + 6, 1, 2, '#2b323d');
  }

  // 7: Road Horizontal Dashed Yellow Line
  {
    const {ox, oy} = tileOrigin(7);
    px(ctx, ox, oy, 32, 32, '#333b48');
    px(ctx, ox + 2, oy + 15, 10, 2, '#facc15');
    px(ctx, ox + 18, oy + 15, 10, 2, '#facc15');
  }

  // 8: Road Vertical Dashed Yellow Line
  {
    const {ox, oy} = tileOrigin(8);
    px(ctx, ox, oy, 32, 32, '#333b48');
    px(ctx, ox + 15, oy + 2, 2, 10, '#facc15');
    px(ctx, ox + 15, oy + 18, 2, 10, '#facc15');
  }

  // 9: Crosswalk Horizontal (walking across vertical road)
  {
    const {ox, oy} = tileOrigin(9);
    px(ctx, ox, oy, 32, 32, '#333b48');
    for (let x = 2; x < 30; x += 7) {
      px(ctx, ox + x, oy + 4, 4, 24, '#f1f5f9');
    }
  }

  // 10: Crosswalk Vertical (walking across horizontal road)
  {
    const {ox, oy} = tileOrigin(10);
    px(ctx, ox, oy, 32, 32, '#333b48');
    for (let y = 2; y < 30; y += 7) {
      px(ctx, ox + 4, oy + y, 24, 4, '#f1f5f9');
    }
  }

  // 11: Road Intersection Asphalt
  {
    const {ox, oy} = tileOrigin(11);
    px(ctx, ox, oy, 32, 32, '#2f3744');
    px(ctx, ox + 9, oy + 9, 2, 1, '#3c4657');
    px(ctx, ox + 22, oy + 23, 2, 1, '#262d38');
  }

  // 12: Water Tile
  {
    const {ox, oy} = tileOrigin(12);
    px(ctx, ox, oy, 32, 32, '#2563eb');
    px(ctx, ox + 4, oy + 8, 8, 2, '#60a5fa');
    px(ctx, ox + 18, oy + 18, 9, 2, '#60a5fa');
    px(ctx, ox + 8, oy + 25, 6, 1, '#93c5fd');
  }

  // 13: Garden Soil / Flowerbed Mulch
  {
    const {ox, oy} = tileOrigin(13);
    px(ctx, ox, oy, 32, 32, '#6b4423');
    px(ctx, ox, oy, 32, 2, '#94a3b8');
    px(ctx, ox, oy + 30, 32, 2, '#64748b');
    px(ctx, ox + 6, oy + 9, 3, 2, '#533319');
    px(ctx, ox + 20, oy + 18, 3, 2, '#7d522d');
  }

  // 14: Basketball Court Terracotta
  {
    const {ox, oy} = tileOrigin(14);
    px(ctx, ox, oy, 32, 32, '#c85a3b');
    px(ctx, ox + 4, oy + 10, 2, 1, '#b54c2f');
    px(ctx, ox + 22, oy + 22, 2, 1, '#d96b4d');
  }

  // 15: Basketball Court Blue Key
  {
    const {ox, oy} = tileOrigin(15);
    px(ctx, ox, oy, 32, 32, '#1d4ed8');
    px(ctx, ox, oy, 32, 2, '#f8fafc');
    px(ctx, ox, oy + 30, 32, 2, '#f8fafc');
  }

  // Row 1 Detail Tiles (16..25)
  // 16: Transparent
  // 17: Tulips on grass
  {
    const {ox, oy} = tileOrigin(17);
    const blooms: [number, number, string][] = [
      [5, 8, '#ef4444'], [13, 6, '#facc15'], [22, 11, '#f43f5e'],
      [8, 20, '#facc15'], [19, 22, '#ef4444'], [25, 25, '#fb923c'],
    ];
    for (const [fx, fy, col] of blooms) {
      px(ctx, ox + fx + 1, oy + fy + 3, 2, 4, '#15803d');
      px(ctx, ox + fx, oy + fy, 4, 3, col);
      px(ctx, ox + fx + 1, oy + fy, 2, 1, '#fef08a');
    }
  }

  // 18: Daisies & Lavender
  {
    const {ox, oy} = tileOrigin(18);
    const spots: [number, number, string][] = [
      [6, 7, '#f8fafc'], [17, 9, '#a78bfa'], [11, 21, '#f8fafc'], [23, 20, '#60a5fa'],
    ];
    for (const [fx, fy, col] of spots) {
      px(ctx, ox + fx + 1, oy + fy + 3, 2, 3, '#16a34a');
      px(ctx, ox + fx, oy + fy, 4, 4, col);
      px(ctx, ox + fx + 1, oy + fy + 1, 2, 2, '#facc15');
    }
  }

  // 19: Shrub / Hedge
  {
    const {ox, oy} = tileOrigin(19);
    px(ctx, ox + 4, oy + 8, 24, 20, '#14532d');
    px(ctx, ox + 5, oy + 7, 22, 18, '#15803d');
    px(ctx, ox + 7, oy + 8, 18, 12, '#22c55e');
    px(ctx, ox + 9, oy + 9, 8, 5, '#4ade80');
  }

  // 20: Wooden Picket Fence Horizontal
  {
    const {ox, oy} = tileOrigin(20);
    px(ctx, ox, oy + 14, 32, 3, '#b45309');
    px(ctx, ox, oy + 22, 32, 3, '#92400e');
    for (let x = 2; x < 32; x += 6) {
      px(ctx, ox + x, oy + 8, 4, 20, '#fef3c7');
      px(ctx, ox + x + 1, oy + 6, 2, 2, '#fef3c7');
      px(ctx, ox + x + 3, oy + 8, 1, 20, '#d97706');
    }
  }

  // 21: Wooden Picket Fence Vertical
  {
    const {ox, oy} = tileOrigin(21);
    px(ctx, ox + 13, oy, 6, 32, '#92400e');
    for (let y = 2; y < 32; y += 8) {
      px(ctx, ox + 11, oy + y, 10, 5, '#fef3c7');
      px(ctx, ox + 11, oy + y + 4, 10, 1, '#d97706');
    }
  }

  // 22: Basketball Court Center White Line
  {
    const {ox, oy} = tileOrigin(22);
    px(ctx, ox + 15, oy, 2, 32, '#f8fafc');
    px(ctx, ox + 12, oy + 12, 8, 8, '#f8fafc');
    px(ctx, ox + 14, oy + 14, 4, 4, '#c85a3b');
  }

  // 23: Road Curb / Edge
  {
    const {ox, oy} = tileOrigin(23);
    px(ctx, ox, oy + 28, 32, 4, '#94a3b8');
    px(ctx, ox, oy + 28, 32, 1, '#e2e8f0');
  }

  // 24: Street Manhole
  {
    const {ox, oy} = tileOrigin(24);
    px(ctx, ox + 10, oy + 10, 12, 12, '#1e293b');
    px(ctx, ox + 11, oy + 11, 10, 10, '#475569');
    px(ctx, ox + 13, oy + 14, 6, 1, '#1e293b');
    px(ctx, ox + 13, oy + 17, 6, 1, '#1e293b');
  }

  // 25: Garden Hedge Border
  {
    const {ox, oy} = tileOrigin(25);
    px(ctx, ox + 2, oy + 6, 28, 22, '#14532d');
    px(ctx, ox + 4, oy + 7, 24, 18, '#15803d');
    px(ctx, ox + 6, oy + 9, 20, 10, '#22c55e');
  }

  // 26: Road Stop Bar Horizontal (for vertical road approaching intersection)
  {
    const {ox, oy} = tileOrigin(26);
    px(ctx, ox + 2, oy + 26, 28, 4, '#f8fafc');
  }

  // 27: Road Stop Bar Vertical (for horizontal road approaching intersection)
  {
    const {ox, oy} = tileOrigin(27);
    px(ctx, ox + 26, oy + 2, 4, 28, '#f8fafc');
  }

  // 28: Pond Lilypad & Blossom
  {
    const {ox, oy} = tileOrigin(28);
    px(ctx, ox + 8, oy + 10, 10, 8, '#15803d');
    px(ctx, ox + 10, oy + 11, 6, 6, '#22c55e');
    px(ctx, ox + 12, oy + 12, 3, 3, '#f472b6');
    px(ctx, ox + 20, oy + 20, 7, 6, '#16a34a');
  }

  // Row 2 Prompt 09 District Terrain Tiles (32..41)
  // 32: Deep Ocean Blue + Wave Crest
  {
    const {ox, oy} = tileOrigin(32);
    px(ctx, ox, oy, 32, 32, '#0369a1');
    px(ctx, ox + 3, oy + 6, 10, 2, '#0284c7');
    px(ctx, ox + 17, oy + 14, 11, 2, '#38bdf8');
    px(ctx, ox + 6, oy + 23, 9, 2, '#7dd3fc');
    px(ctx, ox + 21, oy + 27, 6, 1, '#bae6fd');
  }

  // 33: Shoreline Surf Foam + Wet Sand
  {
    const {ox, oy} = tileOrigin(33);
    px(ctx, ox, oy, 16, 32, '#d9b97e');
    px(ctx, ox + 14, oy, 4, 32, '#e0f2fe');
    px(ctx, ox + 18, oy, 14, 32, '#0ea5e9');
    px(ctx, ox + 13, oy + 4, 4, 6, '#ffffff');
    px(ctx, ox + 14, oy + 18, 4, 8, '#ffffff');
    px(ctx, ox + 22, oy + 10, 6, 2, '#bae6fd');
  }

  // 34: Golden Beach Sand
  {
    const {ox, oy} = tileOrigin(34);
    px(ctx, ox, oy, 32, 32, '#f5d08a');
    px(ctx, ox + 5, oy + 7, 2, 1, '#e0b363');
    px(ctx, ox + 19, oy + 14, 3, 1, '#fae2b0');
    px(ctx, ox + 11, oy + 24, 2, 1, '#e0b363');
    px(ctx, ox + 26, oy + 26, 2, 1, '#d4a14e');
  }

  // 35: Timber Boardwalk Planks
  {
    const {ox, oy} = tileOrigin(35);
    px(ctx, ox, oy, 32, 32, '#92400e');
    for (let y = 0; y < 32; y += 8) {
      px(ctx, ox, oy + y + 1, 32, 6, '#b45309');
      px(ctx, ox, oy + y + 1, 32, 1, '#d97706');
      px(ctx, ox + 15, oy + y + 1, 1, 6, '#78350f');
    }
  }

  // 36: Industrial Brushed Concrete
  {
    const {ox, oy} = tileOrigin(36);
    px(ctx, ox, oy, 32, 32, '#64748b');
    px(ctx, ox, oy, 32, 1, '#94a3b8');
    px(ctx, ox, oy + 31, 32, 1, '#475569');
    px(ctx, ox + 6, oy + 10, 4, 2, '#475569');
    px(ctx, ox + 20, oy + 22, 5, 2, '#7c8ba1');
  }

  // 37: Airport Runway Tarmac + Center Dashed Line
  {
    const {ox, oy} = tileOrigin(37);
    px(ctx, ox, oy, 32, 32, '#1e293b');
    px(ctx, ox, oy + 1, 32, 2, '#475569');
    px(ctx, ox, oy + 29, 32, 2, '#475569');
    px(ctx, ox + 4, oy + 14, 10, 4, '#f8fafc');
    px(ctx, ox + 19, oy + 14, 10, 4, '#f8fafc');
  }

  // 38: Expressway Dual-Lane Asphalt + Yellow Edge
  {
    const {ox, oy} = tileOrigin(38);
    px(ctx, ox, oy, 32, 32, '#272e3a');
    px(ctx, ox, oy + 2, 32, 2, '#fbbf24');
    px(ctx, ox + 4, oy + 15, 8, 2, '#f8fafc');
    px(ctx, ox + 20, oy + 15, 8, 2, '#f8fafc');
    px(ctx, ox, oy + 28, 32, 2, '#94a3b8');
  }

  // 39: Highway Bridge Deck over Water/Canal
  {
    const {ox, oy} = tileOrigin(39);
    px(ctx, ox, oy, 32, 32, '#334155');
    px(ctx, ox, oy, 32, 4, '#94a3b8');
    px(ctx, ox, oy + 28, 32, 4, '#94a3b8');
    px(ctx, ox + 2, oy + 1, 28, 2, '#e2e8f0');
    px(ctx, ox + 2, oy + 29, 28, 2, '#e2e8f0');
    px(ctx, ox + 4, oy + 15, 10, 2, '#facc15');
    px(ctx, ox + 19, oy + 15, 10, 2, '#facc15');
  }

  // 40: Countryside Farmland Soil / Crop Rows
  {
    const {ox, oy} = tileOrigin(40);
    px(ctx, ox, oy, 32, 32, '#784824');
    for (let y = 3; y < 30; y += 8) {
      px(ctx, ox + 2, oy + y, 28, 3, '#5c3416');
      px(ctx, ox + 4, oy + y - 2, 4, 3, '#16a34a');
      px(ctx, ox + 13, oy + y - 2, 4, 3, '#22c55e');
      px(ctx, ox + 22, oy + y - 2, 4, 3, '#16a34a');
    }
  }

  // 41: Luxury Marble Plaza Tile
  {
    const {ox, oy} = tileOrigin(41);
    px(ctx, ox, oy, 32, 32, '#e2e8f0');
    px(ctx, ox + 1, oy + 1, 14, 14, '#f8fafc');
    px(ctx, ox + 17, oy + 1, 14, 14, '#f1f5f9');
    px(ctx, ox + 1, oy + 17, 14, 14, '#f1f5f9');
    px(ctx, ox + 17, oy + 17, 14, 14, '#f8fafc');
    px(ctx, ox + 15, oy, 2, 32, '#fbbf24');
    px(ctx, ox, oy + 15, 32, 2, '#fbbf24');
  }

  finalizeTexture(tex);
}

function drawRoofAndWalls(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  roofColor: string,
  wallColor: string,
  trimColor: string,
  pitched = false,
): void {
  // Drop shadow at base
  px(ctx, 4, h - 8, w - 8, 8, 'rgba(15, 23, 42, 0.35)');
  // Outer border
  px(ctx, 2, 2, w - 4, h - 8, '#0f172a');
  // Main wall
  const roofH = Math.floor(h * 0.44);
  px(ctx, 4, roofH, w - 8, h - roofH - 8, wallColor);
  px(ctx, 4, roofH, w - 8, 4, shadeHex(wallColor, -22));

  // Roof
  if (pitched) {
    px(ctx, 3, 4, w - 6, roofH - 2, shadeHex(roofColor, -20));
    px(ctx, 5, 6, w - 10, roofH - 8, roofColor);
    px(ctx, 8, 8, w - 16, 4, shadeHex(roofColor, 22));
    // Shingle lines
    for (let y = 14; y < roofH - 4; y += 6) {
      px(ctx, 6, y, w - 12, 1, shadeHex(roofColor, -18));
    }
  } else {
    // Modern flat roof with parapet
    px(ctx, 4, 4, w - 8, roofH - 4, shadeHex(roofColor, -24));
    px(ctx, 8, 8, w - 16, roofH - 12, roofColor);
    px(ctx, 8, 8, w - 16, 2, shadeHex(roofColor, 20));
  }

  // Trim
  px(ctx, 4, roofH - 3, w - 8, 3, trimColor);
}

function drawWindow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  warm = false,
): void {
  px(ctx, x, y, w, h, '#1e293b');
  px(ctx, x + 2, y + 2, w - 4, h - 4, warm ? '#fde68a' : '#38bdf8');
  px(ctx, x + 2, y + 2, Math.floor((w - 4) / 2), 3, warm ? '#fef9c3' : '#bae6fd');
  px(ctx, x, y + h, w, 2, '#475569');
}

function drawAwning(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colA: string,
  colB: string,
): void {
  px(ctx, x - 1, y - 1, w + 2, h + 3, '#0f172a');
  const stripeW = 8;
  for (let sx = 0; sx < w; sx += stripeW) {
    const sw = Math.min(stripeW, w - sx);
    const col = (sx / stripeW) % 2 === 0 ? colA : colB;
    px(ctx, x + sx, y, sw, h, col);
    px(ctx, x + sx, y + h - 3, sw, 3, shadeHex(col, -28));
  }
}

function generateBuildings(scene: Phaser.Scene): void {
  // 1. Downtown Modern Tower (160x160)
  {
    const c = createPixelCanvas(scene, 'bld_downtown_tower', 160, 160);
    if (c) {
      drawRoofAndWalls(c.ctx, 160, 160, '#334155', '#475569', '#38bdf8', false);
      // Rooftop vents / helipad accent
      px(c.ctx, 24, 20, 26, 18, '#64748b');
      px(c.ctx, 27, 23, 20, 12, '#94a3b8');
      px(c.ctx, 108, 22, 28, 20, '#1e293b');
      px(c.ctx, 110, 24, 24, 16, '#0ea5e9');
      // Windows grid
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 5; col++) {
          drawWindow(c.ctx, 16 + col * 27, 78 + row * 24, 18, 16, false);
        }
      }
      // Entrance doors
      px(c.ctx, 64, 126, 32, 26, '#0f172a');
      px(c.ctx, 67, 129, 12, 23, '#7dd3fc');
      px(c.ctx, 81, 129, 12, 23, '#7dd3fc');
      finalizeTexture(c.tex);
    }
  }

  // 2. Downtown Brick Building (128x128)
  {
    const c = createPixelCanvas(scene, 'bld_downtown_brick', 128, 128);
    if (c) {
      drawRoofAndWalls(c.ctx, 128, 128, '#475569', '#b4533c', '#e2e8f0', false);
      // Subtle brick pattern
      for (let by = 60; by < 118; by += 8) {
        px(c.ctx, 6, by, 116, 1, '#9a402c');
      }
      for (let col = 0; col < 4; col++) {
        drawWindow(c.ctx, 14 + col * 27, 64, 16, 18, true);
      }
      px(c.ctx, 48, 94, 32, 26, '#1e293b');
      px(c.ctx, 51, 97, 26, 23, '#78350f');
      finalizeTexture(c.tex);
    }
  }

  // 3. Bean & Byte Cafe (160x128)
  {
    const c = createPixelCanvas(scene, 'bld_cafe', 160, 128);
    if (c) {
      drawRoofAndWalls(c.ctx, 160, 128, '#78350f', '#fef3c7', '#10b981', true);
      // Cafe sign board
      px(c.ctx, 48, 40, 64, 16, '#0f172a');
      px(c.ctx, 50, 42, 60, 12, '#065f46');
      // Pixel coffee cup icon on sign
      px(c.ctx, 74, 45, 10, 7, '#fef3c7');
      px(c.ctx, 84, 46, 3, 4, '#fef3c7');
      // Striped awning
      drawAwning(c.ctx, 14, 62, 132, 16, '#10b981', '#fef9c3');
      // Windows & Door
      drawWindow(c.ctx, 18, 84, 34, 24, true);
      drawWindow(c.ctx, 108, 84, 34, 24, true);
      px(c.ctx, 66, 84, 28, 36, '#1e293b');
      px(c.ctx, 69, 87, 22, 33, '#92400e');
      px(c.ctx, 72, 91, 16, 12, '#fde68a');
      finalizeTexture(c.tex);
    }
  }

  // 4. Threadz Clothing Store (160x128)
  {
    const c = createPixelCanvas(scene, 'bld_clothing', 160, 128);
    if (c) {
      drawRoofAndWalls(c.ctx, 160, 128, '#1e293b', '#f8fafc', '#ec4899', false);
      // Boutique sign
      px(c.ctx, 44, 38, 72, 16, '#0f172a');
      px(c.ctx, 46, 40, 68, 12, '#db2777');
      // Shirt icon
      px(c.ctx, 74, 42, 12, 8, '#fdf2f8');
      drawAwning(c.ctx, 14, 60, 132, 16, '#0ea5e9', '#f472b6');
      // Display windows with outfit silhouettes
      drawWindow(c.ctx, 18, 82, 38, 28, false);
      px(c.ctx, 32, 90, 10, 14, '#f43f5e');
      drawWindow(c.ctx, 104, 82, 38, 28, false);
      px(c.ctx, 118, 90, 10, 14, '#38bdf8');
      // Glass double door
      px(c.ctx, 66, 84, 28, 36, '#0f172a');
      px(c.ctx, 69, 87, 10, 33, '#bae6fd');
      px(c.ctx, 81, 87, 10, 33, '#bae6fd');
      finalizeTexture(c.tex);
    }
  }

  // 5. FreshMart Grocery Store (160x128)
  {
    const c = createPixelCanvas(scene, 'bld_grocery', 160, 128);
    if (c) {
      drawRoofAndWalls(c.ctx, 160, 128, '#14532d', '#ecfdf5', '#22c55e', false);
      px(c.ctx, 44, 38, 72, 16, '#0f172a');
      px(c.ctx, 46, 40, 68, 12, '#16a34a');
      // Pixel apple icon
      px(c.ctx, 76, 43, 8, 7, '#ef4444');
      px(c.ctx, 79, 41, 3, 2, '#4ade80');
      drawAwning(c.ctx, 14, 60, 132, 16, '#22c55e', '#ffffff');
      drawWindow(c.ctx, 16, 84, 38, 22, true);
      drawWindow(c.ctx, 106, 84, 38, 22, true);
      px(c.ctx, 64, 84, 32, 36, '#0f172a');
      px(c.ctx, 67, 87, 26, 33, '#7dd3fc');
      // Produce crates outside
      px(c.ctx, 16, 110, 16, 10, '#92400e');
      px(c.ctx, 18, 108, 5, 4, '#f97316');
      px(c.ctx, 25, 108, 5, 4, '#ef4444');
      px(c.ctx, 128, 110, 16, 10, '#92400e');
      px(c.ctx, 130, 108, 5, 4, '#84cc16');
      px(c.ctx, 137, 108, 5, 4, '#facc15');
      finalizeTexture(c.tex);
    }
  }

  // 6. Pixel Palace Arcade (160x128)
  {
    const c = createPixelCanvas(scene, 'bld_arcade', 160, 128);
    if (c) {
      drawRoofAndWalls(c.ctx, 160, 128, '#1e1b4b', '#312e81', '#38bdf8', false);
      // Glowing marquee
      px(c.ctx, 24, 36, 112, 22, '#020617');
      px(c.ctx, 26, 38, 108, 18, '#0ea5e9');
      px(c.ctx, 30, 41, 100, 12, '#0f172a');
      // Pixel joystick & star
      px(c.ctx, 77, 43, 6, 8, '#fbbf24');
      px(c.ctx, 75, 43, 10, 3, '#ef4444');
      // Neon trim dots
      for (let x = 28; x < 132; x += 12) {
        px(ctxOr(c.ctx), x, 37, 4, 2, '#fde047');
        px(ctxOr(c.ctx), x, 55, 4, 2, '#38bdf8');
      }
      drawWindow(c.ctx, 18, 76, 34, 26, false);
      drawWindow(c.ctx, 108, 76, 34, 26, false);
      px(c.ctx, 64, 78, 32, 42, '#020617');
      px(c.ctx, 67, 81, 26, 39, '#38bdf8');
      px(c.ctx, 70, 84, 20, 36, '#0f172a');
      finalizeTexture(c.tex);
    }
  }

  // 7-9. Residential Houses (128x112)
  const houses = [
    {key: 'bld_house_blue', roof: '#334155', wall: '#93c5fd', trim: '#f8fafc'},
    {key: 'bld_house_warm', roof: '#b45309', wall: '#fde68a', trim: '#fffbeb'},
    {key: 'bld_house_mint', roof: '#4d7c0f', wall: '#a7f3d0', trim: '#f8fafc'},
  ];

  for (const h of houses) {
    const c = createPixelCanvas(scene, h.key, 128, 112);
    if (!c) continue;
    drawRoofAndWalls(c.ctx, 128, 112, h.roof, h.wall, h.trim, true);
    // Chimney
    px(c.ctx, 96, 6, 14, 22, '#0f172a');
    px(c.ctx, 98, 8, 10, 18, '#991b1b');
    // Windows & Porch Door
    drawWindow(c.ctx, 18, 62, 22, 20, true);
    drawWindow(c.ctx, 88, 62, 22, 20, true);
    px(c.ctx, 52, 66, 24, 38, '#1e293b');
    px(c.ctx, 55, 69, 18, 35, '#78350f');
    px(c.ctx, 68, 85, 3, 3, '#fbbf24');
    // Porch steps
    px(c.ctx, 48, 101, 32, 5, '#cbd5e1');
    finalizeTexture(c.tex);
  }

  // 10. Starlight Cinema (160x128) - Entertainment District
  {
    const c = createPixelCanvas(scene, 'bld_cinema', 160, 128);
    if (c) {
      drawRoofAndWalls(c.ctx, 160, 128, '#450a0a', '#7f1d1d', '#fbbf24', false);
      // Glowing marquee overhang
      px(c.ctx, 20, 34, 120, 24, '#0f172a');
      px(c.ctx, 22, 36, 116, 20, '#b91c1c');
      px(c.ctx, 28, 40, 104, 12, '#fef3c7');
      // Marquee bulbs
      for (let bx = 24; bx < 138; bx += 10) {
        px(c.ctx, bx, 35, 3, 2, '#fde047');
        px(c.ctx, bx, 55, 3, 2, '#fde047');
      }
      // Film reel emblem in marquee
      px(c.ctx, 74, 42, 12, 8, '#0f172a');
      px(c.ctx, 76, 44, 3, 4, '#fbbf24');
      px(c.ctx, 81, 44, 3, 4, '#fbbf24');
      // Movie posters
      drawWindow(c.ctx, 18, 72, 26, 32, true);
      px(c.ctx, 24, 78, 14, 18, '#0ea5e9');
      drawWindow(c.ctx, 116, 72, 26, 32, true);
      px(c.ctx, 122, 78, 14, 18, '#f43f5e');
      // Ticket booth & red carpet entrance
      px(c.ctx, 60, 76, 40, 44, '#0f172a');
      px(c.ctx, 63, 79, 34, 39, '#fde047');
      px(c.ctx, 66, 82, 28, 36, '#1e293b');
      px(c.ctx, 64, 120, 32, 8, '#dc2626');
      finalizeTexture(c.tex);
    }
  }

  // 11. Maple Crest Apartments (160x128) - Residential District
  {
    const c = createPixelCanvas(scene, 'bld_apartment', 160, 128);
    if (c) {
      drawRoofAndWalls(c.ctx, 160, 128, '#7c2d12', '#fed7aa', '#fff7ed', false);
      // 2 rows of balconies & windows
      for (let col = 0; col < 4; col++) {
        const wx = 14 + col * 36;
        drawWindow(c.ctx, wx, 60, 24, 18, true);
        px(c.ctx, wx - 2, 77, 28, 4, '#475569');
      }
      drawWindow(c.ctx, 14, 90, 24, 18, true);
      drawWindow(c.ctx, 122, 90, 24, 18, true);
      // Lobby awning & entrance
      drawAwning(c.ctx, 56, 84, 48, 10, '#ea580c', '#fff7ed');
      px(c.ctx, 64, 94, 32, 26, '#0f172a');
      px(c.ctx, 67, 97, 26, 23, '#78350f');
      finalizeTexture(c.tex);
    }
  }

  // 12. Skyline Commerce Office (160x160) - Downtown District
  {
    const c = createPixelCanvas(scene, 'bld_office_glass', 160, 160);
    if (c) {
      drawRoofAndWalls(c.ctx, 160, 160, '#0f766e', '#1e293b', '#2dd4bf', false);
      // Roof solar array & comms dish
      px(c.ctx, 20, 18, 46, 20, '#0f172a');
      px(c.ctx, 22, 20, 42, 16, '#0284c7');
      px(c.ctx, 110, 22, 22, 16, '#64748b');
      // Full-height curtain-wall glass bands
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 4; col++) {
          drawWindow(c.ctx, 16 + col * 34, 76 + row * 24, 24, 18, false);
        }
      }
      // Canopy entrance
      px(c.ctx, 54, 122, 52, 6, '#14b8a6');
      px(c.ctx, 62, 128, 36, 24, '#0f172a');
      px(c.ctx, 65, 131, 30, 21, '#99f6e4');
      finalizeTexture(c.tex);
    }
  }

  // 13. Vinyl & Books Store (128x112) - Shopping District
  {
    const c = createPixelCanvas(scene, 'bld_bookstore', 128, 112);
    if (c) {
      drawRoofAndWalls(c.ctx, 128, 112, '#365314', '#fef9c3', '#65a30d', true);
      px(c.ctx, 34, 34, 60, 14, '#0f172a');
      px(c.ctx, 36, 36, 56, 10, '#4d7c0f');
      drawAwning(c.ctx, 12, 52, 104, 14, '#65a30d', '#fef9c3');
      drawWindow(c.ctx, 16, 72, 30, 24, true);
      drawWindow(c.ctx, 82, 72, 30, 24, true);
      px(c.ctx, 52, 74, 24, 30, '#1e293b');
      px(c.ctx, 55, 77, 18, 27, '#78350f');
      finalizeTexture(c.tex);
    }
  }

  // 14. Metro Health Clinic (128x128) - Downtown
  {
    const c = createPixelCanvas(scene, 'bld_clinic', 128, 128);
    if (c) {
      drawRoofAndWalls(c.ctx, 128, 128, '#0284c7', '#f8fafc', '#ef4444', false);
      px(c.ctx, 44, 36, 40, 18, '#0f172a');
      px(c.ctx, 46, 38, 36, 14, '#ffffff');
      // Red cross sign
      px(c.ctx, 61, 40, 6, 10, '#ef4444');
      px(c.ctx, 59, 42, 10, 6, '#ef4444');
      drawWindow(c.ctx, 14, 66, 28, 22, false);
      drawWindow(c.ctx, 86, 66, 28, 22, false);
      px(c.ctx, 48, 86, 32, 34, '#0f172a');
      px(c.ctx, 51, 89, 12, 31, '#bae6fd');
      px(c.ctx, 65, 89, 12, 31, '#bae6fd');
      finalizeTexture(c.tex);
    }
  }

  // 15. Sunset Bistro & Diner (160x128) - Shopping District
  {
    const c = createPixelCanvas(scene, 'bld_restaurant', 160, 128);
    if (c) {
      drawRoofAndWalls(c.ctx, 160, 128, '#9a3412', '#fff7ed', '#f59e0b', true);
      px(c.ctx, 42, 36, 76, 16, '#0f172a');
      px(c.ctx, 44, 38, 72, 12, '#ea580c');
      // Utensil fork/knife icon
      px(c.ctx, 74, 40, 3, 8, '#fef3c7');
      px(c.ctx, 82, 40, 3, 8, '#fef3c7');
      drawAwning(c.ctx, 14, 58, 132, 16, '#dc2626', '#fef3c7');
      drawWindow(c.ctx, 18, 82, 36, 24, true);
      drawWindow(c.ctx, 106, 82, 36, 24, true);
      px(c.ctx, 66, 84, 28, 36, '#1e293b');
      px(c.ctx, 69, 87, 22, 33, '#7c2d12');
      px(c.ctx, 72, 91, 16, 12, '#fde68a');
      finalizeTexture(c.tex);
    }
  }

  // 16. Glow & Snip Salon (128x128) - Shopping District
  {
    const c = createPixelCanvas(scene, 'bld_salon', 128, 128);
    if (c) {
      drawRoofAndWalls(c.ctx, 128, 128, '#831843', '#fdf2f8', '#f472b6', false);
      px(c.ctx, 32, 34, 64, 16, '#0f172a');
      px(c.ctx, 34, 36, 60, 12, '#ec4899');
      // Barber pole accent left/right
      px(c.ctx, 14, 72, 8, 28, '#ffffff');
      px(c.ctx, 14, 76, 8, 4, '#ef4444');
      px(c.ctx, 14, 84, 8, 4, '#38bdf8');
      px(c.ctx, 14, 92, 8, 4, '#ef4444');
      drawAwning(c.ctx, 12, 54, 104, 14, '#ec4899', '#fdf2f8');
      drawWindow(c.ctx, 26, 74, 24, 26, true);
      drawWindow(c.ctx, 88, 74, 24, 26, true);
      px(c.ctx, 54, 80, 26, 40, '#0f172a');
      px(c.ctx, 57, 83, 20, 37, '#fbcfe8');
      finalizeTexture(c.tex);
    }
  }

  // 17. Paws & Whiskers Pet Shop (128x128) - Shopping District
  {
    const c = createPixelCanvas(scene, 'bld_petshop', 128, 128);
    if (c) {
      drawRoofAndWalls(c.ctx, 128, 128, '#b45309', '#fefce8', '#84cc16', true);
      px(c.ctx, 34, 36, 60, 16, '#0f172a');
      px(c.ctx, 36, 38, 56, 12, '#65a30d');
      // Paw emblem
      px(c.ctx, 60, 42, 8, 6, '#fef08a');
      px(c.ctx, 58, 40, 3, 2, '#fef08a');
      px(c.ctx, 63, 39, 3, 2, '#fef08a');
      px(c.ctx, 68, 40, 3, 2, '#fef08a');
      drawAwning(c.ctx, 12, 56, 104, 14, '#eab308', '#ecfccb');
      drawWindow(c.ctx, 16, 76, 28, 24, true);
      drawWindow(c.ctx, 84, 76, 28, 24, true);
      px(c.ctx, 52, 82, 24, 38, '#1e293b');
      px(c.ctx, 55, 85, 18, 35, '#92400e');
      finalizeTexture(c.tex);
    }
  }

  // 18. IronWorks Gym (128x128) - Shopping District
  {
    const c = createPixelCanvas(scene, 'bld_gym', 128, 128);
    if (c) {
      drawRoofAndWalls(c.ctx, 128, 128, '#1e293b', '#334155', '#f97316', false);
      px(c.ctx, 30, 34, 68, 16, '#0f172a');
      px(c.ctx, 32, 36, 64, 12, '#f97316');
      // Dumbbell icon
      px(c.ctx, 52, 40, 5, 5, '#0f172a');
      px(c.ctx, 57, 41, 14, 3, '#0f172a');
      px(c.ctx, 71, 40, 5, 5, '#0f172a');
      drawWindow(c.ctx, 14, 64, 30, 26, false);
      drawWindow(c.ctx, 84, 64, 30, 26, false);
      px(c.ctx, 50, 82, 28, 38, '#0f172a');
      px(c.ctx, 53, 85, 22, 35, '#38bdf8');
      finalizeTexture(c.tex);
    }
  }

  // 19. Chaos Customs Garage (192x112) - Entertainment East Blvd
  {
    const c = createPixelCanvas(scene, 'bld_garage', 192, 112);
    if (c) {
      drawRoofAndWalls(c.ctx, 192, 112, '#1e293b', '#475569', '#f97316', false);
      // Rooftop tire & wrench sign + cyan neon rim
      px(c.ctx, 36, 16, 120, 22, '#020617');
      px(c.ctx, 38, 18, 116, 18, '#0f172a');
      px(c.ctx, 40, 20, 112, 4, '#f97316');
      px(c.ctx, 40, 30, 112, 3, '#38bdf8');
      // Checkered racing banner across fascia
      for (let bx = 6; bx < 186; bx += 8) {
        const alt = (bx / 8) % 2 === 0;
        px(c.ctx, bx, 46, 8, 5, alt ? '#f8fafc' : '#0f172a');
      }
      // Left wide service bay roll-up door
      px(c.ctx, 14, 58, 62, 46, '#0f172a');
      px(c.ctx, 17, 61, 56, 41, '#334155');
      for (let sy = 64; sy < 100; sy += 6) {
        px(c.ctx, 19, sy, 52, 2, '#64748b');
      }
      // Center customer entrance aligned with doorTileX (center x = 96)
      px(c.ctx, 84, 66, 24, 38, '#0f172a');
      px(c.ctx, 87, 69, 18, 35, '#38bdf8');
      px(c.ctx, 89, 71, 6, 16, '#bae6fd');
      // Right showroom glass display with sport car silhouette inside
      drawWindow(c.ctx, 116, 60, 62, 36, true);
      px(c.ctx, 128, 78, 36, 10, '#ea580c');
      px(c.ctx, 134, 73, 22, 6, '#38bdf8');
      // Oil drums & tire stack outside left bay
      px(c.ctx, 8, 92, 10, 14, '#0284c7');
      px(c.ctx, 180, 90, 8, 14, '#0f172a');
      finalizeTexture(c.tex);
    }
  }

  // 10. City Hospital (224x144)
  {
    const c = createPixelCanvas(scene, 'bld_hospital', 224, 144);
    if (c) {
      drawRoofAndWalls(c.ctx, 224, 144, '#0284c7', '#f8fafc', '#ef4444');
      // Red Cross Roof Sign
      px(c.ctx, 98, 14, 28, 28, '#f8fafc');
      px(c.ctx, 109, 18, 6, 20, '#ef4444');
      px(c.ctx, 102, 25, 20, 6, '#ef4444');
      for (let wx = 20; wx <= 180; wx += 40) {
        drawWindow(c.ctx, wx, 72, 24, 22, false);
      }
      // Emergency glass canopy + sliding doors
      px(c.ctx, 76, 86, 72, 12, '#dc2626');
      px(c.ctx, 94, 96, 36, 40, '#0f172a');
      px(c.ctx, 98, 100, 28, 36, '#7dd3fc');
      finalizeTexture(c.tex);
    }
  }

  // 11. Police Precinct HQ (192x132)
  {
    const c = createPixelCanvas(scene, 'bld_police', 192, 132);
    if (c) {
      drawRoofAndWalls(c.ctx, 192, 132, '#1e3a8a', '#cbd5e1', '#fbbf24');
      px(c.ctx, 82, 16, 28, 22, '#0f172a');
      px(c.ctx, 85, 19, 10, 8, '#3b82f6');
      px(c.ctx, 97, 19, 10, 8, '#ef4444');
      px(c.ctx, 88, 30, 16, 5, '#fbbf24');
      drawWindow(c.ctx, 20, 70, 32, 20, false);
      drawWindow(c.ctx, 140, 70, 32, 20, false);
      px(c.ctx, 78, 86, 36, 38, '#1e293b');
      px(c.ctx, 82, 90, 28, 34, '#38bdf8');
      finalizeTexture(c.tex);
    }
  }

  // 12. Fire Station (192x128)
  {
    const c = createPixelCanvas(scene, 'bld_fire', 192, 128);
    if (c) {
      drawRoofAndWalls(c.ctx, 192, 128, '#991b1b', '#e2e8f0', '#facc15');
      // Bell tower emblem
      px(c.ctx, 84, 14, 24, 24, '#dc2626');
      px(c.ctx, 90, 20, 12, 12, '#facc15');
      // Truck bay doors + side door
      px(c.ctx, 18, 68, 66, 52, '#7f1d1d');
      for (let y = 74; y < 116; y += 8) {
        px(c.ctx, 22, y, 58, 5, '#ef4444');
      }
      px(c.ctx, 100, 82, 26, 38, '#0f172a');
      px(c.ctx, 104, 86, 18, 34, '#fde68a');
      drawWindow(c.ctx, 140, 74, 32, 22, true);
      finalizeTexture(c.tex);
    }
  }

  // 13. Chaos City Airport Terminal (240x140)
  {
    const c = createPixelCanvas(scene, 'bld_airport', 240, 140);
    if (c) {
      drawRoofAndWalls(c.ctx, 240, 140, '#0ea5e9', '#334155', '#e0f2fe');
      // Control tower dome + panoramic glass concourse
      px(c.ctx, 174, 10, 44, 34, '#0f172a');
      px(c.ctx, 178, 14, 36, 18, '#7dd3fc');
      px(c.ctx, 18, 68, 148, 32, '#0f172a');
      px(c.ctx, 22, 72, 140, 24, '#38bdf8');
      px(c.ctx, 88, 96, 40, 36, '#0f172a');
      px(c.ctx, 92, 100, 32, 32, '#bae6fd');
      finalizeTexture(c.tex);
    }
  }

  // 14. Grand Starlight Luxury Hotel (208x144)
  {
    const c = createPixelCanvas(scene, 'bld_hotel', 208, 144);
    if (c) {
      drawRoofAndWalls(c.ctx, 208, 144, '#1e1b4b', '#f8fafc', '#fbbf24');
      px(c.ctx, 74, 16, 60, 22, '#0f172a');
      px(c.ctx, 78, 20, 52, 14, '#fbbf24');
      for (let wx = 18; wx <= 162; wx += 36) {
        drawWindow(c.ctx, wx, 70, 24, 20, true);
      }
      px(c.ctx, 76, 94, 56, 42, '#b91c1c');
      px(c.ctx, 88, 98, 32, 38, '#fde68a');
      finalizeTexture(c.tex);
    }
  }

  // 15. Prestige Motors Car Dealership (208x128)
  {
    const c = createPixelCanvas(scene, 'bld_dealership', 208, 128);
    if (c) {
      drawRoofAndWalls(c.ctx, 208, 128, '#0f172a', '#e2e8f0', '#38bdf8');
      drawWindow(c.ctx, 16, 64, 72, 36, false);
      drawWindow(c.ctx, 124, 64, 68, 36, false);
      px(c.ctx, 32, 82, 40, 12, '#dc2626');
      px(c.ctx, 138, 82, 40, 12, '#0284c7');
      px(c.ctx, 92, 82, 28, 38, '#0f172a');
      px(c.ctx, 95, 86, 22, 34, '#7dd3fc');
      finalizeTexture(c.tex);
    }
  }

  // 16. Apex Repair Workshop (192x120)
  {
    const c = createPixelCanvas(scene, 'bld_repair', 192, 120);
    if (c) {
      drawRoofAndWalls(c.ctx, 192, 120, '#b45309', '#475569', '#facc15');
      px(c.ctx, 20, 62, 68, 50, '#0f172a');
      px(c.ctx, 24, 66, 60, 44, '#334155');
      px(c.ctx, 34, 88, 40, 12, '#f97316');
      px(c.ctx, 102, 74, 24, 38, '#1e293b');
      px(c.ctx, 106, 78, 16, 34, '#facc15');
      drawWindow(c.ctx, 140, 70, 32, 22, true);
      finalizeTexture(c.tex);
    }
  }

  // 17. Starlight Grand Shopping Mall (240x136)
  {
    const c = createPixelCanvas(scene, 'bld_mall', 240, 136);
    if (c) {
      drawRoofAndWalls(c.ctx, 240, 136, '#7c3aed', '#f1f5f9', '#ec4899');
      px(c.ctx, 78, 16, 84, 24, '#0f172a');
      px(c.ctx, 82, 20, 76, 16, '#f472b6');
      drawWindow(c.ctx, 18, 68, 62, 32, true);
      drawWindow(c.ctx, 160, 68, 62, 32, true);
      px(c.ctx, 94, 84, 52, 44, '#0f172a');
      px(c.ctx, 98, 88, 44, 40, '#7dd3fc');
      finalizeTexture(c.tex);
    }
  }

  // 18. Pulse Music & Synth Store (160x116)
  {
    const c = createPixelCanvas(scene, 'bld_music', 160, 116);
    if (c) {
      drawRoofAndWalls(c.ctx, 160, 116, '#1e1b4b', '#312e81', '#22d3ee');
      // Vinyl record emblem
      px(c.ctx, 64, 14, 32, 24, '#0f172a');
      px(c.ctx, 74, 20, 12, 12, '#ec4899');
      drawWindow(c.ctx, 16, 62, 42, 28, true);
      drawWindow(c.ctx, 102, 62, 42, 28, true);
      px(c.ctx, 68, 74, 24, 34, '#0f172a');
      px(c.ctx, 71, 77, 18, 31, '#38bdf8');
      finalizeTexture(c.tex);
    }
  }

  // 19. Central Rail Train Station (208x124)
  {
    const c = createPixelCanvas(scene, 'bld_train', 208, 124);
    if (c) {
      drawRoofAndWalls(c.ctx, 208, 124, '#92400e', '#d97706', '#fef3c7', true);
      // Station Clock
      px(c.ctx, 92, 16, 24, 22, '#0f172a');
      px(c.ctx, 95, 19, 18, 16, '#f8fafc');
      px(c.ctx, 103, 21, 2, 6, '#0f172a');
      px(c.ctx, 103, 26, 6, 2, '#0f172a');
      drawWindow(c.ctx, 18, 66, 48, 26, true);
      drawWindow(c.ctx, 142, 66, 48, 26, true);
      px(c.ctx, 84, 78, 40, 38, '#1e293b');
      px(c.ctx, 88, 82, 32, 34, '#fde68a');
      finalizeTexture(c.tex);
    }
  }

  // 20. Starlight Lucky Lounge (Free Token Venue, 192x128)
  {
    const c = createPixelCanvas(scene, 'bld_casino_lounge', 192, 128);
    if (c) {
      drawRoofAndWalls(c.ctx, 192, 128, '#581c87', '#1e1b4b', '#facc15');
      // Starlight emblem & gold trim
      px(c.ctx, 64, 14, 64, 22, '#0f172a');
      px(c.ctx, 68, 18, 56, 14, '#fbbf24');
      px(c.ctx, 84, 21, 24, 8, '#ec4899');
      drawWindow(c.ctx, 18, 68, 44, 26, true);
      drawWindow(c.ctx, 130, 68, 44, 26, true);
      px(c.ctx, 76, 82, 40, 38, '#78350f');
      px(c.ctx, 80, 86, 32, 34, '#fde047');
      finalizeTexture(c.tex);
    }
  }

  // 21. Industrial Freight Warehouse (192x124)
  {
    const c = createPixelCanvas(scene, 'bld_warehouse', 192, 124);
    if (c) {
      drawRoofAndWalls(c.ctx, 192, 124, '#475569', '#94a3b8', '#f97316');
      px(c.ctx, 20, 66, 56, 50, '#334155');
      px(c.ctx, 86, 82, 22, 34, '#0f172a');
      px(c.ctx, 89, 85, 16, 31, '#f97316');
      drawWindow(c.ctx, 128, 70, 44, 22, false);
      finalizeTexture(c.tex);
    }
  }

  // 22. Countryside Farm Market (160x116)
  {
    const c = createPixelCanvas(scene, 'bld_farm_market', 160, 116);
    if (c) {
      drawRoofAndWalls(c.ctx, 160, 116, '#b91c1c', '#fef3c7', '#16a34a', true);
      drawAwning(c.ctx, 14, 56, 132, 14, '#16a34a', '#fef08a');
      drawWindow(c.ctx, 18, 74, 34, 22, true);
      drawWindow(c.ctx, 108, 74, 34, 22, true);
      px(c.ctx, 68, 74, 24, 34, '#78350f');
      px(c.ctx, 71, 78, 18, 30, '#d97706');
      finalizeTexture(c.tex);
    }
  }

  // 23. Sunset Boardwalk Cafe (160x116)
  {
    const c = createPixelCanvas(scene, 'bld_boardwalk_cafe', 160, 116);
    if (c) {
      drawRoofAndWalls(c.ctx, 160, 116, '#0284c7', '#fffbeb', '#fb923c', true);
      drawAwning(c.ctx, 14, 56, 132, 14, '#0ea5e9', '#ffffff');
      drawWindow(c.ctx, 18, 74, 36, 22, true);
      drawWindow(c.ctx, 106, 74, 36, 22, true);
      px(c.ctx, 68, 74, 24, 34, '#0f172a');
      px(c.ctx, 71, 78, 18, 30, '#7dd3fc');
      finalizeTexture(c.tex);
    }
  }

  // 24. Starlight Crest Luxury Villa (208x140)
  {
    const c = createPixelCanvas(scene, 'bld_villa', 208, 140);
    if (c) {
      drawRoofAndWalls(c.ctx, 208, 140, '#991b1b', '#fef3c7', '#fbbf24', true);
      // Rooftop terrace accent & skylight
      px(c.ctx, 74, 18, 60, 22, '#0f172a');
      px(c.ctx, 78, 22, 52, 14, '#7dd3fc');
      px(c.ctx, 94, 24, 20, 10, '#fef08a');
      // Marble columns & arched windows
      for (const wx of [18, 52, 134, 168]) {
        drawWindow(c.ctx, wx, 70, 22, 24, true);
      }
      px(c.ctx, 84, 72, 40, 60, '#0f172a');
      px(c.ctx, 88, 76, 32, 56, '#b45309');
      px(c.ctx, 92, 82, 10, 22, '#fef08a');
      px(c.ctx, 106, 82, 10, 22, '#fef08a');
      // Gold balcony rail
      px(c.ctx, 16, 62, 176, 3, '#fbbf24');
      finalizeTexture(c.tex);
    }
  }

  // 25. The Mission House (160x128) - Downtown Story Campaign Headquarters
  {
    const c = createPixelCanvas(scene, 'bld_mission_house', 160, 128);
    if (c) {
      drawRoofAndWalls(c.ctx, 160, 128, '#1e1b4b', '#312e81', '#facc15', false);
      // Gilded parapet cornice & rooftop beacon crest
      px(c.ctx, 14, 18, 132, 6, '#ca8a04');
      px(c.ctx, 56, 10, 48, 22, '#0f172a');
      px(c.ctx, 58, 12, 44, 18, '#b45309');
      px(c.ctx, 64, 15, 32, 12, '#fde047');
      // Crown / Mission Crest star icon
      px(c.ctx, 77, 17, 6, 8, '#0f172a');
      px(c.ctx, 75, 19, 10, 4, '#0f172a');
      // Banner sign plate
      px(c.ctx, 28, 38, 104, 18, '#0f172a');
      px(c.ctx, 30, 40, 100, 14, '#78350f');
      px(c.ctx, 34, 44, 92, 6, '#facc15');
      // Arched amber windows
      drawWindow(c.ctx, 18, 68, 30, 28, true);
      px(c.ctx, 22, 72, 22, 20, '#fbbf24');
      drawWindow(c.ctx, 112, 68, 30, 28, true);
      px(c.ctx, 116, 72, 22, 20, '#fbbf24');
      // Brass double doors & crimson/gold carpet step
      px(c.ctx, 60, 68, 40, 52, '#0f172a');
      px(c.ctx, 63, 71, 34, 49, '#ca8a04');
      px(c.ctx, 66, 74, 13, 44, '#451a03');
      px(c.ctx, 81, 74, 13, 44, '#451a03');
      px(c.ctx, 76, 94, 3, 5, '#fef08a');
      px(c.ctx, 81, 94, 3, 5, '#fef08a');
      px(c.ctx, 64, 120, 32, 8, '#b91c1c');
      px(c.ctx, 66, 121, 28, 2, '#facc15');
      finalizeTexture(c.tex);
    }
  }
}

function ctxOr(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D {
  return ctx;
}

function generateProps(scene: Phaser.Scene): void {
  // Oak Tree (64x72)
  {
    const c = createPixelCanvas(scene, 'prop_tree_oak', 64, 72);
    if (c) {
      px(c.ctx, 12, 56, 40, 12, 'rgba(15, 23, 42, 0.28)');
      // Trunk
      px(c.ctx, 25, 40, 14, 24, '#3b2110');
      px(c.ctx, 27, 40, 10, 22, '#78472a');
      px(c.ctx, 29, 42, 4, 18, '#965c39');
      // Foliage outline & clusters
      px(c.ctx, 10, 8, 44, 38, '#14532d');
      px(c.ctx, 6, 14, 52, 26, '#14532d');
      px(c.ctx, 12, 10, 40, 34, '#16a34a');
      px(c.ctx, 8, 16, 48, 22, '#16a34a');
      px(c.ctx, 14, 12, 34, 22, '#22c55e');
      px(c.ctx, 18, 13, 18, 12, '#4ade80');
      finalizeTexture(c.tex);
    }
  }

  // Pine Tree (48x64)
  {
    const c = createPixelCanvas(scene, 'prop_tree_pine', 48, 64);
    if (c) {
      px(c.ctx, 10, 52, 28, 8, 'rgba(15, 23, 42, 0.28)');
      px(c.ctx, 19, 44, 10, 14, '#5c341b');
      const tiers = [
        [18, 6, 12, 12],
        [12, 16, 24, 14],
        [6, 28, 36, 18],
      ];
      for (const [tx, ty, tw, th] of tiers) {
        px(c.ctx, tx - 1, ty - 1, tw + 2, th + 2, '#064e3b');
        px(c.ctx, tx, ty, tw, th, '#047857');
        px(c.ctx, tx + 3, ty + 2, tw - 8, th - 6, '#10b981');
      }
      finalizeTexture(c.tex);
    }
  }

  // Animated 3-frame Fountain Spritesheet (96x96 per frame => 288x96)
  {
    const c = createPixelCanvas(scene, 'prop_fountain', 288, 96);
    if (c) {
      for (let frame = 0; frame < 3; frame++) {
        const ox = frame * 96;
        // Shadow
        px(c.ctx, ox + 10, 74, 76, 14, 'rgba(15, 23, 42, 0.3)');
        // Stone outer basin
        px(c.ctx, ox + 10, 18, 76, 62, '#475569');
        px(c.ctx, ox + 12, 20, 72, 56, '#cbd5e1');
        // Water inside
        px(c.ctx, ox + 18, 26, 60, 44, '#0284c7');
        px(c.ctx, ox + 20, 28, 56, 40, '#38bdf8');
        // Ripple rings (animate by frame)
        const rOff = frame * 3;
        px(c.ctx, ox + 26 + rOff, 38, 12, 2, '#bae6fd');
        px(c.ctx, ox + 56 - rOff, 54, 14, 2, '#bae6fd');
        // Center stone pedestal
        px(c.ctx, ox + 40, 32, 16, 24, '#64748b');
        px(c.ctx, ox + 42, 30, 12, 20, '#e2e8f0');
        // Water spout sparkles
        const jetY = 16 + (frame === 1 ? -3 : frame === 2 ? 2 : 0);
        px(c.ctx, ox + 46, jetY, 4, 16, '#e0f2fe');
        px(c.ctx, ox + 38 - frame * 2, jetY + 6, 4, 4, '#bae6fd');
        px(c.ctx, ox + 54 + frame * 2, jetY + 6, 4, 4, '#bae6fd');
      }
      c.tex.add('0', 0, 0, 0, 96, 96);
      c.tex.add('1', 0, 96, 0, 96, 96);
      c.tex.add('2', 0, 192, 0, 96, 96);
      finalizeTexture(c.tex);
    }
  }

  // Park Bench Horizontal (48x32)
  {
    const c = createPixelCanvas(scene, 'prop_bench_h', 48, 32);
    if (c) {
      px(c.ctx, 4, 22, 40, 6, 'rgba(15, 23, 42, 0.25)');
      px(c.ctx, 4, 6, 40, 18, '#1e293b');
      px(c.ctx, 6, 8, 36, 5, '#b45309');
      px(c.ctx, 6, 14, 36, 6, '#d97706');
      px(c.ctx, 4, 10, 4, 14, '#334155');
      px(c.ctx, 40, 10, 4, 14, '#334155');
      finalizeTexture(c.tex);
    }
  }

  // Street Light (24x56)
  {
    const c = createPixelCanvas(scene, 'prop_streetlight', 24, 56);
    if (c) {
      px(c.ctx, 7, 48, 10, 5, 'rgba(15, 23, 42, 0.3)');
      px(c.ctx, 10, 18, 4, 32, '#1e293b');
      px(c.ctx, 9, 44, 6, 6, '#334155');
      // Lantern head
      px(c.ctx, 5, 4, 14, 14, '#0f172a');
      px(c.ctx, 7, 6, 10, 10, '#fef08a');
      px(c.ctx, 9, 8, 6, 6, '#ffffff');
      finalizeTexture(c.tex);
    }
  }

  // Mailbox (24x32)
  {
    const c = createPixelCanvas(scene, 'prop_mailbox', 24, 32);
    if (c) {
      px(c.ctx, 6, 25, 12, 4, 'rgba(15, 23, 42, 0.28)');
      px(c.ctx, 10, 16, 4, 12, '#475569');
      px(c.ctx, 5, 6, 14, 12, '#0f172a');
      px(c.ctx, 6, 7, 12, 10, '#0284c7');
      px(c.ctx, 8, 9, 8, 2, '#f8fafc');
      px(c.ctx, 16, 8, 2, 5, '#ef4444');
      finalizeTexture(c.tex);
    }
  }

  // Cafe Bistro Table (36x36)
  {
    const c = createPixelCanvas(scene, 'prop_bistro_table', 36, 36);
    if (c) {
      px(c.ctx, 6, 24, 24, 8, 'rgba(15, 23, 42, 0.24)');
      px(c.ctx, 16, 18, 4, 12, '#334155');
      // Umbrella canopy
      px(c.ctx, 4, 4, 28, 16, '#0f172a');
      px(c.ctx, 6, 6, 12, 12, '#ef4444');
      px(c.ctx, 18, 6, 12, 12, '#f8fafc');
      px(c.ctx, 16, 4, 4, 4, '#fbbf24');
      finalizeTexture(c.tex);
    }
  }

  // Basketball Hoop Left & Right (40x48)
  {
    const c = createPixelCanvas(scene, 'prop_hoop', 40, 48);
    if (c) {
      px(c.ctx, 14, 40, 12, 5, 'rgba(15, 23, 42, 0.3)');
      px(c.ctx, 18, 16, 4, 26, '#334155');
      px(c.ctx, 6, 4, 28, 16, '#0f172a');
      px(c.ctx, 8, 6, 24, 12, '#f8fafc');
      px(c.ctx, 15, 9, 10, 6, '#f97316');
      px(c.ctx, 14, 19, 12, 3, '#ef4444');
      px(c.ctx, 16, 22, 8, 6, '#e2e8f0');
      finalizeTexture(c.tex);
    }
  }

  // District Signpost (32x40)
  {
    const c = createPixelCanvas(scene, 'prop_signpost', 32, 40);
    if (c) {
      px(c.ctx, 14, 18, 4, 18, '#78350f');
      px(c.ctx, 4, 6, 24, 14, '#0f172a');
      px(c.ctx, 6, 8, 20, 10, '#0ea5e9');
      px(c.ctx, 8, 11, 16, 2, '#f8fafc');
      px(c.ctx, 8, 14, 11, 2, '#bae6fd');
      finalizeTexture(c.tex);
    }
  }

  // Traffic Light Pole (24x56)
  {
    const c = createPixelCanvas(scene, 'prop_traffic_light', 24, 56);
    if (c) {
      px(c.ctx, 7, 48, 10, 5, 'rgba(15, 23, 42, 0.3)');
      px(c.ctx, 10, 22, 4, 28, '#334155');
      px(c.ctx, 6, 4, 12, 22, '#0f172a');
      px(c.ctx, 9, 7, 6, 4, '#ef4444');
      px(c.ctx, 9, 13, 6, 4, '#facc15');
      px(c.ctx, 9, 19, 6, 4, '#22c55e');
      finalizeTexture(c.tex);
    }
  }

  // Fire Hydrant (20x28)
  {
    const c = createPixelCanvas(scene, 'prop_hydrant', 20, 28);
    if (c) {
      px(c.ctx, 5, 22, 10, 4, 'rgba(15, 23, 42, 0.28)');
      px(c.ctx, 6, 8, 8, 14, '#7f1d1d');
      px(c.ctx, 7, 9, 6, 12, '#ef4444');
      px(c.ctx, 4, 11, 12, 4, '#dc2626');
      px(c.ctx, 8, 5, 4, 4, '#cbd5e1');
      finalizeTexture(c.tex);
    }
  }

  // Recycling / Trash Bin (20x28)
  {
    const c = createPixelCanvas(scene, 'prop_trashbin', 20, 28);
    if (c) {
      px(c.ctx, 4, 22, 12, 4, 'rgba(15, 23, 42, 0.25)');
      px(c.ctx, 4, 7, 12, 16, '#0f172a');
      px(c.ctx, 5, 8, 10, 14, '#1e3a8a');
      px(c.ctx, 5, 8, 10, 3, '#38bdf8');
      finalizeTexture(c.tex);
    }
  }

  // Street Flower Planter (32x32)
  {
    const c = createPixelCanvas(scene, 'prop_planter', 32, 32);
    if (c) {
      px(c.ctx, 3, 22, 26, 6, 'rgba(15, 23, 42, 0.24)');
      px(c.ctx, 4, 12, 24, 14, '#475569');
      px(c.ctx, 6, 14, 20, 10, '#cbd5e1');
      px(c.ctx, 6, 9, 20, 7, '#16a34a');
      px(c.ctx, 8, 7, 4, 4, '#f43f5e');
      px(c.ctx, 14, 6, 4, 4, '#facc15');
      px(c.ctx, 20, 8, 4, 4, '#38bdf8');
      finalizeTexture(c.tex);
    }
  }

  // Bus Stop Shelter (64x48)
  {
    const c = createPixelCanvas(scene, 'prop_bus_stop', 64, 48);
    if (c) {
      px(c.ctx, 4, 38, 56, 6, 'rgba(15, 23, 42, 0.28)');
      px(c.ctx, 4, 6, 56, 8, '#0f172a');
      px(c.ctx, 6, 8, 52, 5, '#0ea5e9');
      px(c.ctx, 8, 14, 4, 26, '#334155');
      px(c.ctx, 52, 14, 4, 26, '#334155');
      px(c.ctx, 12, 14, 40, 16, 'rgba(125, 211, 252, 0.4)');
      px(c.ctx, 14, 28, 36, 7, '#b45309');
      finalizeTexture(c.tex);
    }
  }

  // Soccer Goals Left & Right (28x52)
  for (const dir of ['l', 'r'] as const) {
    const c = createPixelCanvas(scene, `prop_soccer_goal_${dir}`, 28, 52);
    if (c) {
      const postX = dir === 'l' ? 20 : 4;
      const netX = dir === 'l' ? 4 : 8;
      px(c.ctx, 2, 44, 24, 5, 'rgba(15, 23, 42, 0.25)');
      px(c.ctx, netX, 8, 16, 36, 'rgba(226, 232, 240, 0.38)');
      for (let ny = 10; ny < 42; ny += 6) {
        px(c.ctx, netX, ny, 16, 1, 'rgba(248, 250, 252, 0.72)');
      }
      for (let nx = netX; nx < netX + 16; nx += 5) {
        px(c.ctx, nx, 8, 1, 36, 'rgba(248, 250, 252, 0.72)');
      }
      px(c.ctx, postX, 4, 4, 42, '#f8fafc');
      px(c.ctx, netX, 4, 20, 4, '#f8fafc');
      px(c.ctx, netX, 42, 20, 3, '#cbd5e1');
      finalizeTexture(c.tex);
    }
  }

  // Streetlamp Glow Halo (128x128 radial warm gradient)
  {
    const c = createPixelCanvas(scene, 'prop_glow_halo', 128, 128);
    if (c) {
      const grad = c.ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
      grad.addColorStop(0, 'rgba(254, 240, 138, 0.65)');
      grad.addColorStop(0.45, 'rgba(250, 204, 21, 0.24)');
      grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
      c.ctx.fillStyle = grad;
      c.ctx.fillRect(0, 0, 128, 128);
      c.tex.refresh();
    }
  }

  // Drifting Cloud Shadow (220x110 soft oval)
  {
    const c = createPixelCanvas(scene, 'prop_cloud_shadow', 220, 110);
    if (c) {
      const grad = c.ctx.createRadialGradient(110, 55, 16, 110, 55, 102);
      grad.addColorStop(0, 'rgba(15, 23, 42, 0.5)');
      grad.addColorStop(0.65, 'rgba(15, 23, 42, 0.24)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      c.ctx.fillStyle = grad;
      c.ctx.fillRect(0, 0, 220, 110);
      c.tex.refresh();
    }
  }

  // Animated 3-frame Small Park Fountain (48x48 per frame => 144x48)
  {
    const c = createPixelCanvas(scene, 'prop_fountain_small', 144, 48);
    if (c) {
      for (let frame = 0; frame < 3; frame++) {
        const ox = frame * 48;
        px(c.ctx, ox + 6, 36, 36, 8, 'rgba(15, 23, 42, 0.26)');
        px(c.ctx, ox + 8, 14, 32, 24, '#475569');
        px(c.ctx, ox + 10, 16, 28, 20, '#cbd5e1');
        px(c.ctx, ox + 14, 20, 20, 12, '#0284c7');
        px(c.ctx, ox + 16, 22, 16, 8, '#38bdf8');
        const shift = frame === 1 ? -2 : frame === 2 ? 2 : 0;
        px(c.ctx, ox + 18 + frame * 2, 27, 6, 2, '#e0f2fe');
        px(c.ctx, ox + 22, 12 + shift, 4, 13, '#bae6fd');
        px(c.ctx, ox + 19 - frame, 15 + shift, 2, 3, '#e0f2fe');
        px(c.ctx, ox + 27 + frame, 15 + shift, 2, 3, '#e0f2fe');
      }
      c.tex.add('0', 0, 0, 0, 48, 48);
      c.tex.add('1', 0, 48, 0, 48, 48);
      c.tex.add('2', 0, 96, 0, 48, 48);
      finalizeTexture(c.tex);
    }
  }

  // Entrance Doormat Indicator (32x16)
  {
    const c = createPixelCanvas(scene, 'prop_door_mat', 32, 16);
    if (c) {
      px(c.ctx, 2, 3, 28, 11, '#0f172a');
      px(c.ctx, 3, 4, 26, 9, '#0ea5e9');
      px(c.ctx, 5, 5, 22, 7, '#0284c7');
      // Subtle upward arrow chevron
      px(c.ctx, 14, 6, 4, 1, '#fef08a');
      px(c.ctx, 13, 7, 6, 1, '#fef08a');
      px(c.ctx, 12, 8, 8, 1, '#fef08a');
      finalizeTexture(c.tex);
    }
  }

  // Animated Exterior Entrance Door Overlay (2 frames x 26x36 = 52x36)
  {
    const c = createPixelCanvas(scene, 'prop_door_ext', 52, 36);
    if (c) {
      // Frame 0: Closed wooden/glass door with brass handle
      px(c.ctx, 0, 0, 26, 36, '#0f172a');
      px(c.ctx, 2, 2, 22, 34, '#1e3a8a');
      px(c.ctx, 5, 5, 16, 12, '#7dd3fc');
      px(c.ctx, 7, 7, 4, 8, '#e0f2fe');
      px(c.ctx, 19, 21, 3, 4, '#fbbf24');

      // Frame 1: Swung open revealing glowing interior threshold
      px(c.ctx, 26, 0, 26, 36, '#0f172a');
      px(c.ctx, 28, 2, 22, 34, '#091020');
      // Warm interior welcome spill
      px(c.ctx, 30, 4, 18, 30, '#fef08a');
      px(c.ctx, 32, 6, 14, 26, '#fde68a');
      // Edge of swung open door leaf
      px(c.ctx, 27, 2, 6, 34, '#1e40af');
      px(c.ctx, 31, 18, 2, 4, '#fbbf24');

      c.tex.add('0', 0, 0, 0, 26, 36);
      c.tex.add('1', 0, 26, 0, 26, 36);
      finalizeTexture(c.tex);
    }
  }

  // Lily Pond Wooden Fishing Pier (48x32)
  {
    const c = createPixelCanvas(scene, 'prop_fishing_pier', 48, 32);
    if (c) {
      px(c.ctx, 4, 24, 40, 6, 'rgba(15, 23, 42, 0.25)');
      px(c.ctx, 4, 6, 40, 20, '#78350f');
      for (let x = 6; x < 42; x += 6) {
        px(c.ctx, x, 7, 5, 17, '#b45309');
        px(c.ctx, x + 1, 8, 3, 14, '#d97706');
      }
      px(c.ctx, 4, 4, 5, 8, '#451a03');
      px(c.ctx, 39, 4, 5, 8, '#451a03');
      px(c.ctx, 34, 14, 7, 8, '#0284c7');
      px(c.ctx, 35, 13, 5, 2, '#bae6fd');
      finalizeTexture(c.tex);
    }
  }

  // Boulevard Racing Start Marker (48x44)
  {
    const c = createPixelCanvas(scene, 'prop_race_arch', 48, 44);
    if (c) {
      px(c.ctx, 6, 36, 36, 5, 'rgba(15, 23, 42, 0.28)');
      px(c.ctx, 8, 12, 4, 26, '#334155');
      px(c.ctx, 36, 12, 4, 26, '#334155');
      px(c.ctx, 4, 4, 40, 12, '#0f172a');
      for (let x = 6; x < 42; x += 4) {
        px(c.ctx, x, 6, 4, 4, ((x - 6) / 4) % 2 === 0 ? '#f8fafc' : '#1e293b');
        px(c.ctx, x, 10, 4, 4, ((x - 6) / 4) % 2 === 0 ? '#1e293b' : '#f8fafc');
      }
      px(c.ctx, 6, 15, 36, 2, '#38bdf8');
      finalizeTexture(c.tex);
    }
  }

  // Express Courier Parcel Desk (36x36)
  {
    const c = createPixelCanvas(scene, 'prop_courier_desk', 36, 36);
    if (c) {
      px(c.ctx, 4, 28, 28, 6, 'rgba(15, 23, 42, 0.28)');
      px(c.ctx, 5, 10, 26, 20, '#0f172a');
      px(c.ctx, 6, 11, 24, 18, '#0284c7');
      px(c.ctx, 6, 11, 24, 4, '#facc15');
      px(c.ctx, 13, 4, 10, 8, '#b45309');
      px(c.ctx, 14, 5, 8, 6, '#f59e0b');
      px(c.ctx, 17, 5, 2, 6, '#fef3c7');
      finalizeTexture(c.tex);
    }
  }

  // Neon Memory & Reflex Kiosk (32x42)
  {
    const c = createPixelCanvas(scene, 'prop_memory_kiosk', 32, 42);
    if (c) {
      px(c.ctx, 6, 34, 20, 6, 'rgba(15, 23, 42, 0.3)');
      px(c.ctx, 6, 6, 20, 30, '#0f172a');
      px(c.ctx, 8, 8, 16, 26, '#1e1b4b');
      px(c.ctx, 10, 11, 5, 5, '#38bdf8');
      px(c.ctx, 17, 11, 5, 5, '#f43f5e');
      px(c.ctx, 10, 18, 5, 5, '#fbbf24');
      px(c.ctx, 17, 18, 5, 5, '#34d399');
      px(c.ctx, 10, 27, 12, 3, '#a855f7');
      finalizeTexture(c.tex);
    }
  }

  // Drivable City Roadster & Shopping Cruiser Spritesheets (4 dirs x 64x48 => 256x48: 0=down,1=up,2=left,3=right)
  const makeCarSheet = (key: string, bodyHex: string, trimHex: string, roofHex: string) => {
    const c = createPixelCanvas(scene, key, 256, 48);
    if (!c) return;
    const drawCar = (ox: number, dirIdx: number) => {
      // 0=down, 1=up, 2=left, 3=right
      if (dirIdx === 0 || dirIdx === 1) {
        // Vertical car silhouette (38x42 centered in 64x48)
        px(c.ctx, ox + 11, 38, 42, 7, 'rgba(15, 23, 42, 0.34)');
        // Wheels
        px(c.ctx, ox + 11, 10, 4, 10, '#0f172a');
        px(c.ctx, ox + 49, 10, 4, 10, '#0f172a');
        px(c.ctx, ox + 11, 28, 4, 10, '#0f172a');
        px(c.ctx, ox + 49, 28, 4, 10, '#0f172a');
        // Chassis
        px(c.ctx, ox + 13, 4, 38, 38, '#0f172a');
        px(c.ctx, ox + 15, 6, 34, 34, bodyHex);
        px(c.ctx, ox + 17, 13, 30, 17, roofHex);
        // Windshield & Rear glass
        px(c.ctx, ox + 18, dirIdx === 0 ? 22 : 10, 28, 7, '#7dd3fc');
        px(c.ctx, ox + 19, dirIdx === 0 ? 10 : 24, 26, 5, '#38bdf8');
        // Trim stripe
        px(c.ctx, ox + 30, 7, 4, 32, trimHex);
        // Lights
        const frontY = dirIdx === 0 ? 37 : 6;
        const tailY = dirIdx === 0 ? 6 : 37;
        px(c.ctx, ox + 16, frontY, 6, 3, '#fef08a');
        px(c.ctx, ox + 42, frontY, 6, 3, '#fef08a');
        px(c.ctx, ox + 16, tailY, 6, 3, '#ef4444');
        px(c.ctx, ox + 42, tailY, 6, 3, '#ef4444');
      } else {
        // Horizontal car silhouette (56x30 centered in 64x48)
        const facingLeft = dirIdx === 2;
        px(c.ctx, ox + 4, 36, 56, 7, 'rgba(15, 23, 42, 0.34)');
        // Wheels
        px(c.ctx, ox + 10, 32, 10, 8, '#0f172a');
        px(c.ctx, ox + 12, 34, 6, 4, '#94a3b8');
        px(c.ctx, ox + 44, 32, 10, 8, '#0f172a');
        px(c.ctx, ox + 46, 34, 6, 4, '#94a3b8');
        // Body
        px(c.ctx, ox + 4, 18, 56, 17, '#0f172a');
        px(c.ctx, ox + 6, 20, 52, 13, bodyHex);
        // Cabin roof
        const cabX = facingLeft ? 16 : 12;
        px(c.ctx, ox + cabX, 9, 36, 12, '#0f172a');
        px(c.ctx, ox + cabX + 2, 11, 32, 9, roofHex);
        px(c.ctx, ox + cabX + 5, 13, 12, 6, '#7dd3fc');
        px(c.ctx, ox + cabX + 19, 13, 12, 6, '#7dd3fc');
        // Accent stripe
        px(c.ctx, ox + 6, 26, 52, 2, trimHex);
        // Headlight & taillight
        const headX = facingLeft ? 5 : 54;
        const tailX = facingLeft ? 54 : 5;
        px(c.ctx, ox + headX, 21, 5, 4, '#fef08a');
        px(c.ctx, ox + tailX, 21, 4, 4, '#ef4444');
      }
    };
    for (let d = 0; d < 4; d++) {
      drawCar(d * 64, d);
      c.tex.add(String(d), 0, d * 64, 0, 64, 48);
    }
    finalizeTexture(c.tex);
  };

  makeCarSheet('veh_sedan_sky', '#0284c7', '#e0f2fe', '#38bdf8');
  makeCarSheet('veh_compact_amber', '#ea580c', '#fef08a', '#fb923c');

  // City Mint Scooter (4 dirs x 40x40 => 160x40)
  {
    const c = createPixelCanvas(scene, 'veh_scooter_mint', 160, 40);
    if (c) {
      for (let d = 0; d < 4; d++) {
        const ox = d * 40;
        px(c.ctx, ox + 10, 31, 20, 5, 'rgba(15, 23, 42, 0.3)');
        if (d === 0 || d === 1) {
          px(c.ctx, ox + 17, 6, 6, 26, '#0f172a');
          px(c.ctx, ox + 18, 8, 4, 22, '#10b981');
          px(c.ctx, ox + 12, 11, 16, 3, '#cbd5e1');
          px(c.ctx, ox + 18, d === 0 ? 27 : 7, 4, 3, d === 0 ? '#fef08a' : '#ef4444');
        } else {
          const left = d === 2;
          px(c.ctx, ox + 8, 25, 7, 7, '#0f172a');
          px(c.ctx, ox + 25, 25, 7, 7, '#0f172a');
          px(c.ctx, ox + 10, 21, 20, 6, '#10b981');
          px(c.ctx, ox + (left ? 11 : 25), 11, 4, 12, '#cbd5e1');
          px(c.ctx, ox + (left ? 9 : 27), 12, 4, 4, '#fef08a');
          px(c.ctx, ox + (left ? 20 : 12), 16, 8, 5, '#1e293b');
        }
        c.tex.add(String(d), 0, ox, 0, 40, 40);
      }
      finalizeTexture(c.tex);
    }
  }

  // Prompt 09 World Props
  // Palm Tree (56x72)
  {
    const c = createPixelCanvas(scene, 'prop_palm_tree', 56, 72);
    if (c) {
      px(c.ctx, 14, 58, 28, 8, 'rgba(15, 23, 42, 0.25)');
      px(c.ctx, 25, 26, 6, 36, '#92400e');
      px(c.ctx, 26, 26, 3, 34, '#b45309');
      px(c.ctx, 8, 14, 40, 10, '#15803d');
      px(c.ctx, 12, 8, 32, 12, '#22c55e');
      px(c.ctx, 4, 20, 18, 6, '#16a34a');
      px(c.ctx, 34, 20, 18, 6, '#16a34a');
      finalizeTexture(c.tex);
    }
  }

  // Industrial Cargo Crate (36x36)
  {
    const c = createPixelCanvas(scene, 'prop_cargo_crate', 36, 36);
    if (c) {
      px(c.ctx, 4, 28, 28, 6, 'rgba(15, 23, 42, 0.28)');
      px(c.ctx, 4, 6, 28, 24, '#0f172a');
      px(c.ctx, 6, 8, 24, 20, '#d97706');
      px(c.ctx, 6, 16, 24, 2, '#92400e');
      px(c.ctx, 17, 8, 2, 20, '#92400e');
      finalizeTexture(c.tex);
    }
  }

  // Parked Jet Silhouette (112x64)
  {
    const c = createPixelCanvas(scene, 'prop_parked_jet', 112, 64);
    if (c) {
      px(c.ctx, 12, 50, 88, 8, 'rgba(15, 23, 42, 0.3)');
      // Wings
      px(c.ctx, 38, 8, 24, 48, '#cbd5e1');
      px(c.ctx, 42, 10, 16, 44, '#f8fafc');
      // Fuselage
      px(c.ctx, 10, 24, 92, 16, '#0f172a');
      px(c.ctx, 12, 26, 88, 12, '#f8fafc');
      px(c.ctx, 18, 30, 74, 3, '#0284c7');
      // Cockpit & Tail
      px(c.ctx, 84, 27, 12, 6, '#38bdf8');
      px(c.ctx, 12, 14, 14, 14, '#0284c7');
      finalizeTexture(c.tex);
    }
  }

  // Collectible Starlight Shard (24x28)
  {
    const c = createPixelCanvas(scene, 'prop_starlight_shard', 24, 28);
    if (c) {
      px(c.ctx, 6, 22, 12, 4, 'rgba(56, 189, 248, 0.35)');
      px(c.ctx, 10, 3, 4, 18, '#0ea5e9');
      px(c.ctx, 7, 7, 10, 10, '#38bdf8');
      px(c.ctx, 9, 6, 6, 12, '#bae6fd');
      px(c.ctx, 11, 8, 2, 8, '#ffffff');
      finalizeTexture(c.tex);
    }
  }

  // Highway Gantry Sign (64x44)
  {
    const c = createPixelCanvas(scene, 'prop_highway_sign', 64, 44);
    if (c) {
      px(c.ctx, 8, 18, 4, 22, '#475569');
      px(c.ctx, 52, 18, 4, 22, '#475569');
      px(c.ctx, 4, 4, 56, 18, '#0f172a');
      px(c.ctx, 6, 6, 52, 14, '#15803d');
      px(c.ctx, 10, 10, 24, 2, '#f8fafc');
      px(c.ctx, 10, 14, 18, 2, '#fde047');
      px(c.ctx, 42, 10, 10, 6, '#f8fafc');
      finalizeTexture(c.tex);
    }
  }

  // Countryside Haybale (32x28)
  {
    const c = createPixelCanvas(scene, 'prop_haybale', 32, 28);
    if (c) {
      px(c.ctx, 4, 20, 24, 6, 'rgba(15, 23, 42, 0.25)');
      px(c.ctx, 4, 6, 24, 16, '#ca8a04');
      px(c.ctx, 6, 8, 20, 12, '#eab308');
      px(c.ctx, 10, 6, 2, 16, '#92400e');
      px(c.ctx, 20, 6, 2, 16, '#92400e');
      finalizeTexture(c.tex);
    }
  }

  // Beach Umbrella + Towel (40x40)
  {
    const c = createPixelCanvas(scene, 'prop_beach_umbrella', 40, 40);
    if (c) {
      px(c.ctx, 6, 24, 28, 12, '#38bdf8');
      px(c.ctx, 8, 26, 24, 8, '#f8fafc');
      px(c.ctx, 18, 16, 4, 14, '#78350f');
      px(c.ctx, 6, 4, 28, 14, '#ef4444');
      px(c.ctx, 14, 4, 12, 14, '#fef08a');
      finalizeTexture(c.tex);
    }
  }

  // Dynamic City Event Beacon (36x48)
  {
    const c = createPixelCanvas(scene, 'prop_event_beacon', 36, 48);
    if (c) {
      px(c.ctx, 8, 36, 20, 8, 'rgba(250, 204, 21, 0.35)');
      px(c.ctx, 10, 28, 16, 12, '#0f172a');
      px(c.ctx, 12, 30, 12, 8, '#f59e0b');
      px(c.ctx, 14, 6, 8, 24, '#fde047');
      px(c.ctx, 16, 4, 4, 24, '#ffffff');
      finalizeTexture(c.tex);
    }
  }

  // Collectible Relic Sprites by Rarity (24x28)
  const makeRelicSprite = (key: string, rim: string, core: string, shine: string) => {
    const c = createPixelCanvas(scene, key, 24, 28);
    if (!c) return;
    px(c.ctx, 6, 22, 12, 4, 'rgba(15, 23, 42, 0.32)');
    px(c.ctx, 9, 4, 6, 16, '#0f172a');
    px(c.ctx, 6, 7, 12, 10, '#0f172a');
    px(c.ctx, 10, 5, 4, 14, rim);
    px(c.ctx, 7, 8, 10, 8, core);
    px(c.ctx, 10, 8, 4, 5, shine);
    finalizeTexture(c.tex);
  };
  makeRelicSprite('prop_relic_common', '#94a3b8', '#e2e8f0', '#ffffff');
  makeRelicSprite('prop_relic_rare', '#0284c7', '#38bdf8', '#e0f2fe');
  makeRelicSprite('prop_relic_epic', '#7e22ce', '#c084fc', '#f5d0fe');
  makeRelicSprite('prop_relic_mythic', '#d97706', '#fbbf24', '#fef9c3');

  // Secret Location Discovery Marker (32x36)
  {
    const c = createPixelCanvas(scene, 'prop_secret_portal', 32, 36);
    if (c) {
      px(c.ctx, 6, 26, 20, 6, 'rgba(16, 185, 129, 0.35)');
      px(c.ctx, 8, 6, 16, 22, '#0f172a');
      px(c.ctx, 10, 8, 12, 18, '#059669');
      px(c.ctx, 12, 10, 8, 14, '#34d399');
      px(c.ctx, 14, 12, 4, 6, '#fef08a');
      finalizeTexture(c.tex);
    }
  }

  // Golden Owner Crown Sprite (18x14)
  {
    const c = createPixelCanvas(scene, 'fx_owner_crown', 18, 14);
    if (c) {
      px(c.ctx, 2, 9, 14, 4, '#b45309');
      px(c.ctx, 2, 5, 3, 5, '#fbbf24');
      px(c.ctx, 7, 3, 4, 7, '#fde047');
      px(c.ctx, 13, 5, 3, 5, '#fbbf24');
      px(c.ctx, 3, 8, 12, 3, '#fbbf24');
      px(c.ctx, 8, 5, 2, 2, '#ef4444');
      px(c.ctx, 4, 9, 2, 2, '#38bdf8');
      px(c.ctx, 12, 9, 2, 2, '#38bdf8');
      finalizeTexture(c.tex);
    }
  }
}

function generateParticles(scene: Phaser.Scene): void {
  // Dust puff particle (8x8)
  const c = createPixelCanvas(scene, 'fx_dust', 8, 8);
  if (c) {
    px(c.ctx, 2, 1, 4, 6, '#e2e8f0');
    px(c.ctx, 1, 2, 6, 4, '#f8fafc');
    finalizeTexture(c.tex);
  }

  // Water sparkle particle (6x6)
  const w = createPixelCanvas(scene, 'fx_sparkle', 6, 6);
  if (w) {
    px(w.ctx, 2, 0, 2, 6, '#bae6fd');
    px(w.ctx, 0, 2, 6, 2, '#ffffff');
    finalizeTexture(w.tex);
  }

  // Sleep Zzz particle (12x12)
  const z = createPixelCanvas(scene, 'fx_zzz', 12, 12);
  if (z) {
    px(z.ctx, 2, 2, 8, 2, '#bae6fd');
    px(z.ctx, 7, 4, 2, 2, '#7dd3fc');
    px(z.ctx, 4, 6, 4, 2, '#7dd3fc');
    px(z.ctx, 2, 8, 8, 2, '#38bdf8');
    finalizeTexture(z.tex);
  }

  // Heart emote particle (10x10)
  const h = createPixelCanvas(scene, 'fx_heart', 10, 10);
  if (h) {
    px(h.ctx, 1, 2, 3, 3, '#fb7185');
    px(h.ctx, 6, 2, 3, 3, '#fb7185');
    px(h.ctx, 2, 4, 6, 3, '#f43f5e');
    px(h.ctx, 4, 7, 2, 2, '#e11d48');
    finalizeTexture(h.tex);
  }
}

/**
 * Generates a 32x40 character spritesheet (4 cols x 7 rows = 128x280):
 * Row 0 (0..3):   Walk/Run Down
 * Row 1 (4..7):   Walk/Run Up
 * Row 2 (8..11):  Walk/Run Left
 * Row 3 (12..15): Walk/Run Right
 * Row 4 (16..19): 16=Sitting, 17..19=Interact frames
 * Row 5 (20..23): Shopping / inspecting items animation frames
 * Row 6 (24..27): Celebrating / emote animation frames
 */
function generateCharacterSpritesheet(
  scene: Phaser.Scene,
  key: string,
  preset: CharacterPreset,
  equipped?: EquippedClothing,
  hairOverride?: HairOverride,
  appearance?: CharacterAppearanceConfig,
): void {
  const fw = 32;
  const fh = 40;
  const cols = 4;
  const rows = 7;

  const created = createPixelCanvas(scene, key, fw * cols, fh * rows);
  if (!created) return;
  const {tex, ctx} = created;

  paintCharacterSpritesheet(ctx, tex, preset, equipped, hairOverride, appearance, true);
  finalizeTexture(tex);
}

function paintCharacterSpritesheet(
  ctx: CanvasRenderingContext2D,
  _tex: Phaser.Textures.CanvasTexture,
  preset: CharacterPreset,
  equipped: EquippedClothing | undefined,
  hairOverride: HairOverride | undefined,
  appearance: CharacterAppearanceConfig | undefined,
  addFrames: boolean,
): void {
  const fw = 32;
  const fh = 40;
  const cols = 4;
  const rows = 7;

  ctx.clearRect(0, 0, fw * cols, fh * rows);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const ox = col * fw;
      const oy = row * fh;
      if (row === 4) {
        if (col === 0) {
          drawCharacterFrame(ctx, ox, oy, 'down', 0, preset, 'sit', equipped, hairOverride, appearance);
        } else {
          drawCharacterFrame(ctx, ox, oy, 'down', col - 1, preset, 'interact', equipped, hairOverride, appearance);
        }
      } else if (row === 5) {
        drawCharacterFrame(ctx, ox, oy, 'down', col, preset, 'shop', equipped, hairOverride, appearance);
      } else if (row === 6) {
        drawCharacterFrame(ctx, ox, oy, 'down', col, preset, 'celebrate', equipped, hairOverride, appearance);
      } else {
        const dir = (['down', 'up', 'left', 'right'] as const)[row];
        drawCharacterFrame(ctx, ox, oy, dir, col, preset, 'walk', equipped, hairOverride, appearance);
      }
      if (addFrames) {
        _tex.add(`${row * cols + col}`, 0, ox, oy, fw, fh);
      }
    }
  }
}

export function updatePlayerCustomTexture(
  scene: Phaser.Scene,
  preset: CharacterPreset,
  equipped?: EquippedClothing,
  hairOverride?: HairOverride,
  appearance?: CharacterAppearanceConfig,
  targetKey = 'char_custom_player',
): string {
  const key = targetKey;
  if (scene.textures.exists(key)) {
    const tex = scene.textures.get(key) as Phaser.Textures.CanvasTexture;
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;
    paintCharacterSpritesheet(ctx, tex, preset, equipped, hairOverride, appearance, false);
    finalizeTexture(tex);
    return key;
  }
  generateCharacterSpritesheet(scene, key, preset, equipped, hairOverride, appearance);
  return key;
}

function drawCharacterFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  dir: Direction,
  step: number,
  p: CharacterPreset,
  animMode: AnimationState,
  equipped?: EquippedClothing,
  hairOverride?: HairOverride,
  appearance?: CharacterAppearanceConfig,
): void {
  const sitting = animMode === 'sit';
  const interacting = animMode === 'interact';
  const shopping = animMode === 'shop';
  const celebrating = animMode === 'celebrate';

  const walkStep = animMode === 'walk' || animMode === 'run' ? step % 4 : 0;
  const bounce =
    celebrating
      ? step % 2 === 1
        ? -2
        : 0
      : walkStep === 1 || walkStep === 3
        ? -1
        : 0;
  const legL = walkStep === 1 ? -2 : walkStep === 3 ? 2 : 0;
  const legR = walkStep === 1 ? 2 : walkStep === 3 ? -2 : 0;
  const sitDrop = sitting ? 4 : 0;

  // Resolve appearance (override > preset defaults)
  const gender = appearance?.gender ?? p.gender;
  const isFemale = gender === 'female';
  const skinColor = appearance?.skinTone ?? p.skinColor;
  const hairStyle: HairStyleId =
    appearance?.hairStyle ?? hairOverride?.hairStyle ?? p.hairStyle;
  const hairColor = appearance?.hairColor ?? hairOverride?.hairColor ?? p.hairColor;
  const eyeStyle = appearance?.eyeStyle ?? p.eyeStyle;
  const eyeColor = appearance?.eyeColor ?? p.eyeColor;
  const browStyle = appearance?.browStyle ?? p.browStyle;
  const facialDetail = appearance?.facialDetail ?? p.facialDetail;
  const facialHair = gender === 'male' ? (appearance?.facialHair ?? p.facialHair) : 'none';

  const shirtItem = equipped?.shirt ? getShopItemById(equipped.shirt)?.clothing : undefined;
  const jacketItem = equipped?.jacket ? getShopItemById(equipped.jacket)?.clothing : undefined;
  const trousersItem = equipped?.trousers ? getShopItemById(equipped.trousers)?.clothing : undefined;
  const shoesItem = equipped?.shoes ? getShopItemById(equipped.shoes)?.clothing : undefined;
  const hatItem = equipped?.hat ? getShopItemById(equipped.hat)?.clothing : undefined;
  const glassesItem = equipped?.glasses ? getShopItemById(equipped.glasses)?.clothing : undefined;
  const accessoryItem = equipped?.accessory ? getShopItemById(equipped.accessory)?.clothing : undefined;

  const shirtColor = shirtItem?.primaryColor ?? p.shirtColor;
  const shirtAccent = shirtItem?.accentColor ?? p.shirtAccent;
  const pantsColor = trousersItem?.primaryColor ?? p.pantsColor;
  const pantsAccent = trousersItem?.accentColor;
  const shoeColor = shoesItem?.primaryColor ?? p.shoeColor;
  const shoeAccent = shoesItem?.accentColor;

  const isShorts = trousersItem?.variant === 'shorts';
  const isSkirt = trousersItem?.variant === 'skirt';

  // Ground shadow
  px(ctx, ox + 9, oy + 34, 14, 4, 'rgba(15, 23, 42, 0.35)');

  const ty = oy + 17 + bounce + sitDrop;
  const hy = oy + 4 + bounce + sitDrop;

  // Long hair flowing behind back when facing down/side (under torso/backpack)
  if (
    dir !== 'up' &&
    (hairStyle === 'long_waves' || hairStyle === 'ponytail' || hairStyle === 'bob')
  ) {
    if (hairStyle === 'long_waves') {
      if (dir === 'down') {
        px(ctx, ox + 7, hy + 8, 3, 10, hairColor);
        px(ctx, ox + 22, hy + 8, 3, 10, hairColor);
      } else if (dir === 'left') {
        px(ctx, ox + 19, hy + 7, 5, 11, hairColor);
      } else {
        px(ctx, ox + 8, hy + 7, 5, 11, hairColor);
      }
    } else if (hairStyle === 'ponytail') {
      if (dir === 'left') {
        px(ctx, ox + 22, hy + 5, 4, 8, hairColor);
        px(ctx, ox + 21, hy + 5, 2, 2, shirtAccent);
      } else if (dir === 'right') {
        px(ctx, ox + 6, hy + 5, 4, 8, hairColor);
        px(ctx, ox + 9, hy + 5, 2, 2, shirtAccent);
      }
    }
  }

  // Backpack behind character when facing down/side
  if (accessoryItem?.variant === 'backpack' && dir !== 'up') {
    const bx = dir === 'left' ? ox + 20 : dir === 'right' ? ox + 7 : ox + 7;
    const bw = dir === 'down' ? 18 : 5;
    px(ctx, bx, ty + 1, bw, 9, shadeHex(accessoryItem.primaryColor, -15));
  }

  // Legs & Shoes (distinct Shorts / Skirt / Pants & Female narrower hip stance)
  const legInner = isFemale ? 11 : 10;
  const legRightX = isFemale ? 17 : 17;
  const legW = isFemale ? 3 : 4;

  const drawFrontLeg = (lx: number, offset: number, stripeSide: 'l' | 'r') => {
    const ly = oy + 26 + Math.min(0, offset);
    px(ctx, ox + lx - 1, ly, legW + 2, 8, '#0f172a');
    if (isShorts || isSkirt) {
      px(ctx, ox + lx, ly, legW, isSkirt ? 2 : 3, pantsColor);
      px(ctx, ox + lx, ly + (isSkirt ? 2 : 3), legW, isSkirt ? 4 : 3, skinColor);
    } else {
      px(ctx, ox + lx, ly, legW, 6, pantsColor);
      if (trousersItem?.variant === 'joggers' && pantsAccent) {
        px(ctx, ox + (stripeSide === 'l' ? lx - 1 : lx + legW), ly, 1, 6, pantsAccent);
      }
    }
    px(ctx, ox + lx, ly + 6, legW, 3, shoeColor);
    if (shoeAccent) px(ctx, ox + lx, ly + 8, legW, 1, shoeAccent);
  };

  if (sitting) {
    px(ctx, ox + 10, oy + 29, 5, 5, isSkirt ? skinColor : pantsColor);
    px(ctx, ox + 17, oy + 29, 5, 5, isSkirt ? skinColor : pantsColor);
    if (isSkirt) {
      px(ctx, ox + 9, oy + 27, 14, 4, pantsColor);
    }
    px(ctx, ox + 10, oy + 33, 5, 3, shoeColor);
    px(ctx, ox + 17, oy + 33, 5, 3, shoeColor);
  } else if (dir === 'down' || dir === 'up') {
    drawFrontLeg(legInner, legL, 'l');
    drawFrontLeg(legRightX, legR, 'r');
    if (isSkirt) {
      px(ctx, ox + 9, oy + 24, 14, 4, '#0f172a');
      px(ctx, ox + 10, oy + 24, 12, 3, pantsColor);
      if (pantsAccent) px(ctx, ox + 10, oy + 26, 12, 1, pantsAccent);
    }
  } else {
    // Side leg silhouette
    px(ctx, ox + 12 + legL, oy + 26, 6, 8, '#0f172a');
    if (isShorts || isSkirt) {
      px(ctx, ox + 13 + legL, oy + 26, 4, 3, pantsColor);
      px(ctx, ox + 13 + legL, oy + 29, 4, 3, skinColor);
    } else {
      px(ctx, ox + 13 + legL, oy + 26, 4, 6, pantsColor);
    }
    px(ctx, ox + 13 + legL, oy + 32, 5, 3, shoeColor);

    px(ctx, ox + 13 + legR, oy + 26, 6, 8, '#0f172a');
    if (isShorts || isSkirt) {
      px(ctx, ox + 14 + legR, oy + 26, 4, 3, shadeHex(pantsColor, -15));
      px(ctx, ox + 14 + legR, oy + 29, 4, 3, shadeHex(skinColor, -12));
    } else {
      px(ctx, ox + 14 + legR, oy + 26, 4, 6, shadeHex(pantsColor, -15));
    }
    px(ctx, ox + 14 + legR, oy + 32, 5, 3, shoeColor);
    if (shoeAccent) px(ctx, ox + 14 + legR, oy + 34, 5, 1, shoeAccent);
    if (isSkirt) {
      px(ctx, ox + 10, oy + 24, 12, 4, pantsColor);
      if (pantsAccent) px(ctx, ox + 10, oy + 27, 12, 1, pantsAccent);
    }
  }

  // Torso (Male: broader 14px straight shoulders; Female: tailored 12px upper + shaped waist/hem)
  if (isFemale && (dir === 'down' || dir === 'up')) {
    px(ctx, ox + 9, ty - 1, 14, 11, '#0f172a');
    px(ctx, ox + 8, ty + 6, 16, 4, '#0f172a');
    px(ctx, ox + 10, ty, 12, 9, shirtColor);
    px(ctx, ox + 9, ty + 7, 14, 3, shirtColor);
  } else {
    px(ctx, ox + 8, ty - 1, 16, 12, '#0f172a');
    px(ctx, ox + 9, ty, 14, 10, shirtColor);
  }

  // Shirt / Hoodie / Sweater detailing
  const txL = isFemale && (dir === 'down' || dir === 'up') ? ox + 10 : ox + 9;
  const txW = isFemale && (dir === 'down' || dir === 'up') ? 12 : 14;
  if (dir === 'down') {
    if (shirtItem?.variant === 'buttoned') {
      px(ctx, ox + 15, ty, 2, 10, shirtAccent);
      px(ctx, ox + 13, ty, 6, 2, shirtAccent);
    } else if (shirtItem?.variant === 'hoodie') {
      px(ctx, ox + 12, ty, 8, 2, shadeHex(shirtColor, -22));
      px(ctx, ox + 14, ty + 1, 1, 3, shirtAccent);
      px(ctx, ox + 17, ty + 1, 1, 3, shirtAccent);
      px(ctx, ox + 12, ty + 6, 8, 3, shadeHex(shirtColor, -14));
    } else if (shirtItem?.variant === 'sweater') {
      px(ctx, txL, ty + 2, txW, 2, shirtAccent);
      px(ctx, txL, ty + 8, txW, 2, shadeHex(shirtColor, -18));
    } else {
      px(ctx, ox + 14, ty + 1, 4, isFemale ? 6 : 8, shirtAccent);
    }
  } else if (dir === 'up') {
    if (shirtItem?.variant === 'hoodie') {
      px(ctx, ox + 11, ty, 10, 4, shadeHex(shirtColor, -20));
      px(ctx, ox + 12, ty + 1, 8, 2, shirtAccent);
    } else {
      px(ctx, ox + 11, ty + 2, 10, 4, shadeHex(shirtColor, -18));
    }
  } else {
    px(ctx, ox + 13, ty + 2, 6, 6, shirtAccent);
  }

  // Layered Outer Jacket
  if (jacketItem) {
    if (dir === 'down') {
      px(ctx, txL, ty, 4, 10, jacketItem.primaryColor);
      px(ctx, txL + txW - 4, ty, 4, 10, jacketItem.primaryColor);
      px(ctx, txL + 4, ty, 1, 10, jacketItem.accentColor);
      px(ctx, txL + txW - 5, ty, 1, 10, jacketItem.accentColor);
      if (jacketItem.variant === 'varsity') {
        px(ctx, txL, ty + 8, txW, 2, jacketItem.accentColor);
      }
    } else {
      px(ctx, txL, ty, txW, 10, jacketItem.primaryColor);
      px(ctx, ox + 11, ty + 8, 10, 2, jacketItem.accentColor);
    }
  }

  // Torso Accessories (Scarf, Gold Chain, Backpack)
  if (accessoryItem?.variant === 'scarf') {
    px(ctx, ox + 9, ty - 1, 14, 3, accessoryItem.primaryColor);
    px(ctx, ox + 17, ty + 1, 3, 6, accessoryItem.accentColor);
  } else if (accessoryItem?.variant === 'chain' && dir === 'down') {
    px(ctx, ox + 13, ty + 1, 6, 2, accessoryItem.primaryColor);
    px(ctx, ox + 15, ty + 3, 2, 2, accessoryItem.accentColor);
  } else if (accessoryItem?.variant === 'backpack') {
    if (dir === 'up') {
      px(ctx, ox + 10, ty + 1, 12, 9, accessoryItem.primaryColor);
      px(ctx, ox + 12, ty + 3, 8, 2, accessoryItem.accentColor);
    } else if (dir === 'down') {
      px(ctx, ox + 10, ty, 2, 8, accessoryItem.primaryColor);
      px(ctx, ox + 20, ty, 2, 8, accessoryItem.primaryColor);
    } else {
      const bx = dir === 'left' ? ox + 19 : ox + 8;
      px(ctx, bx, ty + 1, 5, 8, accessoryItem.primaryColor);
      px(ctx, bx + 1, ty + 3, 3, 2, accessoryItem.accentColor);
    }
  }

  // Arms (with special poses for interact / shop / celebrate!)
  const sleeveColor = jacketItem ? jacketItem.primaryColor : shirtColor;
  const armSwing = walkStep === 1 ? 2 : walkStep === 3 ? -2 : 0;
  const hasWatch = accessoryItem?.variant === 'watch';

  if (celebrating) {
    // Raised arms celebration + bounce
    const wave = step % 2 === 1 ? -2 : 0;
    px(ctx, ox + 5, ty - 7 + wave, 3, 8, '#0f172a');
    px(ctx, ox + 6, ty - 5 + wave, 2, 5, shadeHex(sleeveColor, 10));
    px(ctx, ox + 6, ty - 8 + wave, 2, 3, skinColor);

    px(ctx, ox + 24, ty - 7 - wave, 3, 8, '#0f172a');
    px(ctx, ox + 24, ty - 5 - wave, 2, 5, shadeHex(sleeveColor, 10));
    px(ctx, ox + 24, ty - 8 - wave, 2, 3, skinColor);
    if (hasWatch) px(ctx, ox + 24, ty - 5 - wave, 2, 1, accessoryItem.accentColor);
  } else if (interacting) {
    // Right arm extends forward/upward to reach & interact
    const reach = step % 2 === 1 ? -2 : 0;
    px(ctx, ox + 6, ty + 1, 3, 8, '#0f172a');
    px(ctx, ox + 7, ty + 1, 2, 6, shadeHex(sleeveColor, -12));
    px(ctx, ox + 7, ty + 7, 2, 2, skinColor);

    px(ctx, ox + 23, ty - 2 + reach, 3, 7, '#0f172a');
    px(ctx, ox + 23, ty - 1 + reach, 2, 4, shadeHex(sleeveColor, 10));
    px(ctx, ox + 24, ty - 3 + reach, 3, 3, skinColor);
    if (hasWatch) px(ctx, ox + 23, ty + reach, 2, 1, accessoryItem.accentColor);
  } else if (shopping) {
    // Shopping pose: holding a boutique tote bag on left arm, browsing with right hand
    const bagSway = step % 2 === 1 ? -1 : 1;
    px(ctx, ox + 6, ty + 1, 3, 7, '#0f172a');
    px(ctx, ox + 7, ty + 1, 2, 5, shadeHex(sleeveColor, -10));
    px(ctx, ox + 7, ty + 6, 2, 2, skinColor);
    // Shopping bag on wrist
    px(ctx, ox + 3, ty + 7 + bagSway, 6, 6, '#ec4899');
    px(ctx, ox + 4, ty + 8 + bagSway, 4, 4, '#f472b6');
    px(ctx, ox + 5, ty + 6 + bagSway, 2, 1, '#fef08a');

    px(ctx, ox + 23, ty + (step === 2 ? -1 : 1), 3, 8, '#0f172a');
    px(ctx, ox + 23, ty + 1 + (step === 2 ? -1 : 1), 2, 5, shadeHex(sleeveColor, -10));
    px(ctx, ox + 23, ty + 6 + (step === 2 ? -1 : 1), 2, 2, skinColor);
    if (hasWatch) px(ctx, ox + 23, ty + 5 + (step === 2 ? -1 : 1), 2, 1, accessoryItem.accentColor);
  } else if (dir === 'down' || dir === 'up') {
    const leftArmX = isFemale ? ox + 7 : ox + 6;
    const rightArmX = isFemale ? ox + 22 : ox + 23;
    px(ctx, leftArmX, ty + 1 + armSwing, 3, 8, '#0f172a');
    px(ctx, leftArmX + 1, ty + 1 + armSwing, 2, 6, shadeHex(sleeveColor, -12));
    px(ctx, leftArmX + 1, ty + 7 + armSwing, 2, 2, skinColor);

    px(ctx, rightArmX, ty + 1 - armSwing, 3, 8, '#0f172a');
    px(ctx, rightArmX, ty + 1 - armSwing, 2, 6, shadeHex(sleeveColor, -12));
    px(ctx, rightArmX, ty + 7 - armSwing, 2, 2, skinColor);
    if (hasWatch) {
      px(ctx, rightArmX, ty + 6 - armSwing, 2, 1, accessoryItem.accentColor);
    }
  } else {
    const ax = dir === 'left' ? ox + 13 - armSwing : ox + 15 + armSwing;
    px(ctx, ax, ty + 2, 4, 7, shadeHex(sleeveColor, 12));
    px(ctx, ax, ty + 7, 3, 3, skinColor);
    if (hasWatch) px(ctx, ax, ty + 6, 3, 1, accessoryItem.accentColor);
  }

  // Head (Female slightly softer tapered jawline at bottom corners)
  px(ctx, ox + 8, hy, 16, 13, '#0f172a');
  if (isFemale) {
    px(ctx, ox + 9, hy + 13, 14, 1, '#0f172a');
    px(ctx, ox + 9, hy + 1, 14, 11, skinColor);
    px(ctx, ox + 10, hy + 12, 12, 1, skinColor);
  } else {
    px(ctx, ox + 8, hy + 13, 16, 1, '#0f172a');
    px(ctx, ox + 9, hy + 1, 14, 12, skinColor);
  }

  // Face details: Eyebrows, Eyes, Cheeks, Lips, Facial Hair
  const browColor = shadeHex(hairColor, -20);
  if (dir === 'down') {
    // Eyebrows
    if (browStyle === 'thick') {
      px(ctx, ox + 11, hy + 5, 4, 2, browColor);
      px(ctx, ox + 17, hy + 5, 4, 2, browColor);
    } else if (browStyle === 'arched') {
      px(ctx, ox + 11, hy + 6, 2, 1, browColor);
      px(ctx, ox + 12, hy + 5, 2, 1, browColor);
      px(ctx, ox + 18, hy + 5, 2, 1, browColor);
      px(ctx, ox + 19, hy + 6, 2, 1, browColor);
    } else if (browStyle === 'soft') {
      px(ctx, ox + 12, hy + 6, 2, 1, browColor);
      px(ctx, ox + 18, hy + 6, 2, 1, browColor);
    } else {
      px(ctx, ox + 11, hy + 6, 3, 1, browColor);
      px(ctx, ox + 18, hy + 6, 3, 1, browColor);
    }

    // Eyes with Eye Style & Eye Color
    if (eyeStyle === 'wide') {
      px(ctx, ox + 11, hy + 7, 3, 3, '#ffffff');
      px(ctx, ox + 12, hy + 7, 2, 3, eyeColor);
      px(ctx, ox + 18, hy + 7, 3, 3, '#ffffff');
      px(ctx, ox + 18, hy + 7, 2, 3, eyeColor);
    } else if (eyeStyle === 'sharp') {
      px(ctx, ox + 11, hy + 8, 3, 2, eyeColor);
      px(ctx, ox + 18, hy + 8, 3, 2, eyeColor);
    } else if (eyeStyle === 'lashes') {
      px(ctx, ox + 11, hy + 7, 1, 1, '#0f172a');
      px(ctx, ox + 12, hy + 7, 2, 3, eyeColor);
      px(ctx, ox + 18, hy + 7, 2, 3, eyeColor);
      px(ctx, ox + 20, hy + 7, 1, 1, '#0f172a');
    } else {
      px(ctx, ox + 12, hy + 7, 2, 3, eyeColor);
      px(ctx, ox + 18, hy + 7, 2, 3, eyeColor);
    }

    // Facial Details
    if (facialDetail === 'freckles') {
      px(ctx, ox + 10, hy + 10, 1, 1, '#b45309');
      px(ctx, ox + 12, hy + 10, 1, 1, '#b45309');
      px(ctx, ox + 19, hy + 10, 1, 1, '#b45309');
      px(ctx, ox + 21, hy + 10, 1, 1, '#b45309');
    } else if (facialDetail === 'blush') {
      px(ctx, ox + 10, hy + 10, 3, 1, '#fb7185');
      px(ctx, ox + 19, hy + 10, 3, 1, '#fb7185');
    } else if (facialDetail === 'beauty_mark') {
      px(ctx, ox + 20, hy + 10, 1, 1, '#451a03');
    }

    // Mouth / Expression
    if (celebrating) {
      px(ctx, ox + 14, hy + 10, 4, 2, '#f43f5e');
    } else {
      px(ctx, ox + 14, hy + 11, 4, 1, isFemale ? '#db2777' : shadeHex(skinColor, -35));
    }

    // Male Facial Hair
    if (facialHair === 'stubble') {
      px(ctx, ox + 11, hy + 11, 1, 1, browColor);
      px(ctx, ox + 13, hy + 12, 6, 1, shadeHex(skinColor, -28));
      px(ctx, ox + 20, hy + 11, 1, 1, browColor);
    } else if (facialHair === 'goatee') {
      px(ctx, ox + 13, hy + 10, 6, 1, hairColor);
      px(ctx, ox + 14, hy + 11, 4, 2, hairColor);
    } else if (facialHair === 'beard') {
      px(ctx, ox + 9, hy + 10, 2, 3, hairColor);
      px(ctx, ox + 21, hy + 10, 2, 3, hairColor);
      px(ctx, ox + 10, hy + 11, 12, 2, hairColor);
    }
  } else if (dir === 'left') {
    px(ctx, ox + 10, hy + 6, 3, 1, browColor);
    px(ctx, ox + 11, hy + 7, 2, 3, eyeColor);
    if (facialDetail === 'blush') px(ctx, ox + 13, hy + 10, 2, 1, '#fb7185');
    px(ctx, ox + 10, hy + 11, 2, 1, isFemale ? '#db2777' : shadeHex(skinColor, -35));
    if (facialHair === 'beard') px(ctx, ox + 9, hy + 10, 5, 3, hairColor);
    else if (facialHair === 'goatee') px(ctx, ox + 9, hy + 11, 3, 2, hairColor);
  } else if (dir === 'right') {
    px(ctx, ox + 19, hy + 6, 3, 1, browColor);
    px(ctx, ox + 19, hy + 7, 2, 3, eyeColor);
    if (facialDetail === 'blush') px(ctx, ox + 17, hy + 10, 2, 1, '#fb7185');
    px(ctx, ox + 20, hy + 11, 2, 1, isFemale ? '#db2777' : shadeHex(skinColor, -35));
    if (facialHair === 'beard') px(ctx, ox + 18, hy + 10, 5, 3, hairColor);
    else if (facialHair === 'goatee') px(ctx, ox + 20, hy + 11, 3, 2, hairColor);
  }

  // Glasses
  if (glassesItem && dir !== 'up') {
    if (dir === 'down') {
      if (glassesItem.variant === 'visor') {
        px(ctx, ox + 10, hy + 6, 12, 4, glassesItem.primaryColor);
        px(ctx, ox + 11, hy + 7, 10, 2, glassesItem.accentColor);
      } else {
        px(ctx, ox + 10, hy + 6, 5, 4, glassesItem.primaryColor);
        px(ctx, ox + 17, hy + 6, 5, 4, glassesItem.primaryColor);
        px(ctx, ox + 15, hy + 7, 2, 1, glassesItem.primaryColor);
        px(ctx, ox + 11, hy + 7, 3, 2, glassesItem.accentColor);
        px(ctx, ox + 18, hy + 7, 3, 2, glassesItem.accentColor);
      }
    } else if (dir === 'left') {
      px(ctx, ox + 9, hy + 6, 6, 4, glassesItem.primaryColor);
      px(ctx, ox + 10, hy + 7, 3, 2, glassesItem.accentColor);
    } else {
      px(ctx, ox + 17, hy + 6, 6, 4, glassesItem.primaryColor);
      px(ctx, ox + 19, hy + 7, 3, 2, glassesItem.accentColor);
    }
  }

  // Hair (all 11 hairstyles including Back view variations!)
  if (dir === 'up') {
    px(ctx, ox + 9, hy + 1, 14, 11, hairColor);
    px(ctx, ox + 11, hy + 2, 10, 3, shadeHex(hairColor, 18));
    if (hairStyle === 'long_waves') {
      px(ctx, ox + 8, hy + 9, 16, 9, hairColor);
      px(ctx, ox + 10, hy + 11, 12, 5, shadeHex(hairColor, -14));
    } else if (hairStyle === 'ponytail') {
      px(ctx, ox + 13, hy + 5, 6, 2, shirtAccent);
      px(ctx, ox + 13, hy + 7, 6, 9, hairColor);
    } else if (hairStyle === 'space_buns') {
      px(ctx, ox + 6, hy - 2, 5, 5, hairColor);
      px(ctx, ox + 21, hy - 2, 5, 5, hairColor);
    } else if (hairStyle === 'bob') {
      px(ctx, ox + 8, hy + 8, 16, 4, hairColor);
    }
  } else {
    px(ctx, ox + 9, hy + 1, 14, hairStyle === 'buzz' ? 3 : 5, hairColor);
    if (hairStyle === 'spiky') {
      px(ctx, ox + 10, hy - 1, 3, 2, hairColor);
      px(ctx, ox + 15, hy - 2, 3, 3, hairColor);
      px(ctx, ox + 20, hy - 1, 3, 2, hairColor);
    } else if (hairStyle === 'pompadour') {
      px(ctx, ox + 10, hy - 2, 11, 4, hairColor);
      px(ctx, ox + 12, hy - 1, 7, 2, shadeHex(hairColor, 20));
    } else if (hairStyle === 'sidepart') {
      px(ctx, ox + 9, hy, 10, 3, hairColor);
      px(ctx, ox + 19, hy + 1, 4, 4, shadeHex(hairColor, -16));
      if (dir === 'down') px(ctx, ox + 11, hy + 4, 6, 2, hairColor);
    } else if (hairStyle === 'curly') {
      px(ctx, ox + 8, hy, 4, 6, hairColor);
      px(ctx, ox + 20, hy, 4, 6, hairColor);
      px(ctx, ox + 12, hy - 1, 8, 3, hairColor);
    } else if (hairStyle === 'bob') {
      if (dir === 'down') {
        px(ctx, ox + 8, hy + 4, 3, 7, hairColor);
        px(ctx, ox + 21, hy + 4, 3, 7, hairColor);
      } else if (dir === 'left') {
        px(ctx, ox + 17, hy + 5, 6, 7, hairColor);
      } else {
        px(ctx, ox + 9, hy + 5, 6, 7, hairColor);
      }
    } else if (hairStyle === 'long_waves') {
      px(ctx, ox + 10, hy, 12, 3, shadeHex(hairColor, 12));
      if (dir === 'down') {
        px(ctx, ox + 8, hy + 4, 3, 5, hairColor);
        px(ctx, ox + 21, hy + 4, 3, 5, hairColor);
      }
    } else if (hairStyle === 'ponytail') {
      px(ctx, ox + 11, hy, 10, 3, shadeHex(hairColor, 14));
      if (dir === 'down') {
        px(ctx, ox + 13, hy - 2, 6, 3, hairColor);
      }
    } else if (hairStyle === 'space_buns') {
      px(ctx, ox + 6, hy - 2, 5, 5, hairColor);
      px(ctx, ox + 21, hy - 2, 5, 5, hairColor);
      px(ctx, ox + 7, hy - 1, 2, 2, shadeHex(hairColor, 20));
      px(ctx, ox + 22, hy - 1, 2, 2, shadeHex(hairColor, 20));
    } else if (hairStyle === 'cap' && !hatItem) {
      px(ctx, ox + 8, hy, 16, 4, shirtAccent);
      if (dir === 'left') px(ctx, ox + 5, hy + 3, 6, 2, shirtAccent);
      else if (dir === 'right') px(ctx, ox + 21, hy + 3, 6, 2, shirtAccent);
      else px(ctx, ox + 10, hy + 3, 12, 2, shirtAccent);
    }
  }

  // Hats (drawn over hair)
  if (hatItem) {
    if (hatItem.variant === 'beanie') {
      px(ctx, ox + 8, hy - 1, 16, 6, hatItem.primaryColor);
      px(ctx, ox + 8, hy + 3, 16, 2, hatItem.accentColor);
      px(ctx, ox + 14, hy - 3, 4, 2, hatItem.accentColor);
    } else if (hatItem.variant === 'fedora') {
      px(ctx, ox + 6, hy + 3, 20, 2, hatItem.primaryColor);
      px(ctx, ox + 9, hy - 2, 14, 5, hatItem.primaryColor);
      px(ctx, ox + 9, hy + 1, 14, 2, hatItem.accentColor);
    } else {
      px(ctx, ox + 8, hy - 1, 16, 5, hatItem.primaryColor);
      px(ctx, ox + 13, hy, 6, 2, hatItem.accentColor);
      if (dir === 'left') px(ctx, ox + 4, hy + 3, 8, 2, hatItem.primaryColor);
      else if (dir === 'right') px(ctx, ox + 20, hy + 3, 8, 2, hatItem.primaryColor);
      else if (dir === 'down') px(ctx, ox + 10, hy + 3, 12, 2, hatItem.accentColor);
    }
  }

  // Over-ear Headphones accessory
  if (accessoryItem?.variant === 'headphones') {
    px(ctx, ox + 8, hy - 1, 16, 2, accessoryItem.primaryColor);
    px(ctx, ox + 6, hy + 4, 3, 6, accessoryItem.primaryColor);
    px(ctx, ox + 23, hy + 4, 3, 6, accessoryItem.primaryColor);
    px(ctx, ox + 7, hy + 5, 1, 4, accessoryItem.accentColor);
    px(ctx, ox + 24, hy + 5, 1, 4, accessoryItem.accentColor);
  }
}

/**
 * Renders a crisp real-time character preview (supporting front/back/left/right rotation and animation state).
 */
const MAX_CHAR_URL_CACHE = 64;
const charPreviewUrlCache = new Map<string, string>();
const charPortraitUrlCache = new Map<string, string>();

function setBoundedCache(cache: Map<string, string>, key: string, value: string): void {
  if (cache.has(key)) {
    cache.delete(key);
  } else if (cache.size >= MAX_CHAR_URL_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

/**
 * Renders a crisp character preview data URL at custom scale for Character Creator UI.
 */
export function renderCharacterPreviewDataUrl(
  preset: CharacterPreset,
  appearance?: CharacterAppearanceConfig,
  equipped?: EquippedClothing,
  direction: Direction = 'down',
  animState: AnimationState = 'idle',
  step = 0,
  outW = 128,
  outH = 160,
): string {
  if (typeof document === 'undefined') return '';
  const cacheKey = JSON.stringify([
    preset.id,
    appearance ?? null,
    equipped ?? null,
    direction,
    animState,
    step,
    outW,
    outH,
  ]);
  const cached = charPreviewUrlCache.get(cacheKey);
  if (cached !== undefined) {
    setBoundedCache(charPreviewUrlCache, cacheKey, cached);
    return cached;
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = false;

  const tmp = document.createElement('canvas');
  tmp.width = 32;
  tmp.height = 40;
  const tctx = tmp.getContext('2d');
  if (!tctx) return '';
  tctx.imageSmoothingEnabled = false;
  drawCharacterFrame(
    tctx,
    0,
    0,
    direction,
    step,
    preset,
    animState,
    equipped,
    undefined,
    appearance,
  );

  ctx.drawImage(tmp, 0, 0, 32, 40, 0, 0, outW, outH);
  const url = canvas.toDataURL();
  setBoundedCache(charPreviewUrlCache, cacheKey, url);
  return url;
}

/**
 * Renders a crisp 64x64 character portrait data URL for UI cards, HUD avatar, & Store previews.
 */
export function renderCharacterPortraitDataUrl(
  preset: CharacterPreset,
  equipped?: EquippedClothing,
  hairOverride?: HairOverride,
  appearance?: CharacterAppearanceConfig,
  direction: Direction = 'down',
): string {
  if (typeof document === 'undefined') return '';
  const cacheKey = JSON.stringify([
    preset.id,
    equipped ?? null,
    hairOverride ?? null,
    appearance ?? null,
    direction,
  ]);
  const cached = charPortraitUrlCache.get(cacheKey);
  if (cached !== undefined) {
    setBoundedCache(charPortraitUrlCache, cacheKey, cached);
    return cached;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = false;

  const tmp = document.createElement('canvas');
  tmp.width = 32;
  tmp.height = 40;
  const tctx = tmp.getContext('2d');
  if (!tctx) return '';
  tctx.imageSmoothingEnabled = false;
  drawCharacterFrame(
    tctx,
    0,
    0,
    direction,
    0,
    preset,
    'idle',
    equipped,
    hairOverride,
    appearance,
  );

  ctx.drawImage(tmp, 2, 0, 28, 38, 4, 2, 56, 60);
  const url = canvas.toDataURL();
  setBoundedCache(charPortraitUrlCache, cacheKey, url);
  return url;
}

const shopItemIconCache = new Map<string, string>();

/**
 * Renders a crisp 64x64 pixel-art illustration for every shop & inventory item.
 */
export function renderShopItemIconDataUrl(item: ShopItem): string {
  if (typeof document === 'undefined') return '';
  const cached = shopItemIconCache.get(item.id);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.imageSmoothingEnabled = false;

  const tmp = document.createElement('canvas');
  tmp.width = 16;
  tmp.height = 16;
  const t = tmp.getContext('2d');
  if (!t) return '';
  t.imageSmoothingEnabled = false;

  const p = (x: number, y: number, w: number, h: number, col: string) => {
    t.fillStyle = col;
    t.fillRect(x, y, w, h);
  };

  if (item.clothing) {
    const col = item.clothing.primaryColor;
    const acc = item.clothing.accentColor;
    const cat = item.clothing.category;
    if (cat === 'shirts' || cat === 'tshirts' || cat === 'hoodies' || cat === 'sweaters' || cat === 'jackets') {
      if (item.clothing.variant === 'hoodie') {
        p(5, 1, 6, 3, shadeHex(col, -16));
      }
      p(2, 4, 12, 4, shadeHex(col, 10));
      p(4, 3, 8, 10, col);
      p(5, 3, 6, 2, acc);
      if (cat === 'jackets' || item.clothing.variant === 'buttoned') {
        p(7, 5, 2, 8, acc);
      } else {
        p(6, 6, 4, 3, acc);
      }
    } else if (cat === 'trousers' || cat === 'shorts') {
      const h = cat === 'shorts' ? 6 : 10;
      p(4, 3, 8, 3, col);
      p(4, 3, 8, 1, acc);
      p(4, 6, 3, h - 2, shadeHex(col, -8));
      p(9, 6, 3, h - 2, shadeHex(col, -8));
    } else if (cat === 'skirts') {
      p(5, 3, 6, 2, shadeHex(col, -14));
      p(4, 5, 8, 3, col);
      p(3, 8, 10, 4, col);
      p(4, 11, 8, 1, acc);
    } else if (cat === 'shoes') {
      p(2, 6, 5, 4, col);
      p(2, 10, 7, 2, acc);
      p(8, 6, 5, 4, col);
      p(8, 10, 7, 2, acc);
    } else if (cat === 'hats') {
      p(3, 5, 10, 5, col);
      p(3, 9, 11, 2, acc);
      p(6, 3, 4, 2, shadeHex(col, 18));
    } else if (cat === 'glasses') {
      p(2, 6, 5, 4, col);
      p(9, 6, 5, 4, col);
      p(7, 7, 2, 1, col);
      p(3, 7, 3, 2, acc);
      p(10, 7, 3, 2, acc);
    } else if (item.clothing.variant === 'headphones') {
      p(4, 3, 8, 2, col);
      p(3, 5, 2, 6, col);
      p(11, 5, 2, 6, col);
      p(4, 6, 1, 4, acc);
      p(11, 6, 1, 4, acc);
    } else if (item.clothing.variant === 'backpack') {
      p(4, 3, 8, 10, col);
      p(5, 8, 6, 4, shadeHex(col, -18));
      p(6, 5, 4, 2, acc);
    } else if (item.clothing.variant === 'watch') {
      p(6, 2, 4, 12, '#334155');
      p(5, 5, 6, 6, col);
      p(6, 6, 4, 4, acc);
    } else {
      // Scarf / gold chain
      p(4, 4, 8, 3, col);
      p(9, 7, 3, 5, acc);
    }
  } else if (item.shop === 'cafe' || item.id === 'rest_lemonade' || item.id === 'groc_soda' || item.id === 'cin_slush' || item.id === 'gym_shake') {
    if (item.id === 'cafe_croissant' || item.id === 'cafe_bagel') {
      // Bakery pastry / bagel
      p(3, 5, 10, 7, item.iconColor);
      p(4, 6, 8, 5, '#fef3c7');
      p(6, 7, 4, 3, item.id === 'cafe_croissant' ? '#4338ca' : '#78350f');
    } else {
      // Beverage cup / tumbler + steam or straw
      p(9, 2, 2, 3, '#f8fafc');
      p(4, 4, 8, 2, '#e2e8f0');
      p(5, 6, 6, 8, item.iconColor);
      p(6, 8, 4, 3, '#fef3c7');
    }
  } else if (item.id === 'rest_burger') {
    p(3, 4, 10, 3, '#d97706');
    p(3, 7, 10, 2, '#22c55e');
    p(3, 9, 10, 2, '#78350f');
    p(3, 11, 10, 2, '#f59e0b');
  } else if (item.id === 'rest_ramen') {
    p(9, 2, 4, 1, '#b45309');
    p(4, 5, 8, 3, '#fef08a');
    p(3, 7, 10, 6, '#dc2626');
    p(5, 9, 6, 2, '#f8fafc');
  } else if (item.id === 'rest_pasta') {
    p(2, 8, 12, 4, '#f8fafc');
    p(4, 5, 8, 4, '#facc15');
    p(6, 4, 4, 2, '#78350f');
  } else if (item.id === 'groc_apples') {
    p(7, 2, 2, 2, '#78350f');
    p(8, 2, 3, 2, '#22c55e');
    p(4, 4, 8, 8, '#ef4444');
    p(5, 6, 2, 3, '#fca5a5');
  } else if (item.id === 'groc_picnic' || item.id === 'groc_sponge') {
    p(3, 5, 10, 8, item.iconColor);
    p(5, 3, 6, 3, '#cbd5e1');
    p(5, 8, 6, 2, '#fef08a');
  } else if (item.id === 'groc_candle') {
    p(7, 2, 2, 3, '#fef08a');
    p(5, 5, 6, 8, '#e2e8f0');
    p(6, 7, 4, 4, item.iconColor);
  } else if (item.id === 'groc_soap') {
    p(3, 5, 10, 6, '#c4b5fd');
    p(5, 6, 6, 2, '#ede9fe');
  } else if (item.id === 'cin_ticket') {
    p(2, 5, 12, 6, '#fbbf24');
    p(4, 6, 8, 4, '#7f1d1d');
    p(6, 7, 4, 2, '#fef08a');
  } else if (item.id === 'cin_popcorn') {
    p(4, 3, 8, 3, '#fef08a');
    p(5, 6, 6, 7, '#ef4444');
    p(7, 6, 2, 7, '#f8fafc');
  } else if (item.id === 'tech_console') {
    p(4, 2, 8, 12, item.iconColor);
    p(5, 4, 6, 4, '#0f172a');
    p(6, 5, 3, 2, '#38bdf8');
    p(5, 10, 2, 2, '#fef08a');
    p(9, 10, 2, 2, '#f43f5e');
  } else if (item.id === 'tech_watch') {
    p(6, 2, 4, 12, '#0f172a');
    p(5, 5, 6, 6, item.iconColor);
    p(6, 6, 4, 4, '#0f172a');
    p(7, 7, 2, 2, '#2dd4bf');
  } else if (item.id === 'tech_camera') {
    p(2, 5, 12, 8, '#334155');
    p(4, 3, 4, 2, '#94a3b8');
    p(6, 7, 4, 4, '#38bdf8');
    p(11, 6, 2, 2, '#fef08a');
  } else if (item.id === 'book_vinyl') {
    p(3, 3, 10, 10, '#0f172a');
    p(6, 6, 4, 4, item.iconColor);
    p(7, 7, 2, 2, '#fef08a');
  } else if (item.shop === 'bookstore') {
    p(3, 3, 10, 10, item.iconColor);
    p(4, 4, 8, 8, '#f8fafc');
    p(5, 5, 6, 4, item.iconColor);
  } else if (item.id === 'pet_corgi' || item.id === 'pet_calico') {
    p(4, 4, 2, 3, item.iconColor);
    p(10, 4, 2, 3, item.iconColor);
    p(4, 6, 8, 7, item.iconColor);
    p(6, 9, 4, 4, '#fef3c7');
    p(5, 8, 2, 2, '#0f172a');
    p(9, 8, 2, 2, '#0f172a');
  } else if (item.id === 'pet_treats') {
    p(3, 6, 10, 4, '#d97706');
    p(2, 5, 3, 6, '#f59e0b');
    p(11, 5, 3, 6, '#f59e0b');
  } else if (item.id === 'arc_trophy') {
    p(4, 3, 8, 5, '#fbbf24');
    p(6, 8, 4, 3, '#d97706');
    p(4, 11, 8, 3, '#78350f');
  } else if (item.id === 'arc_plush') {
    p(4, 3, 8, 9, '#34d399');
    p(5, 5, 2, 2, '#0f172a');
    p(9, 5, 2, 2, '#0f172a');
    p(7, 8, 2, 1, '#064e3b');
  } else if (item.id === 'clin_tonic') {
    p(6, 2, 4, 2, '#cbd5e1');
    p(4, 4, 8, 10, '#10b981');
    p(7, 6, 2, 6, '#ffffff');
    p(5, 8, 6, 2, '#ffffff');
  } else {
    p(3, 3, 10, 10, item.iconColor);
    p(5, 5, 6, 6, '#f8fafc');
  }

  ctx.drawImage(tmp, 0, 0, 16, 16, 4, 4, 56, 56);
  const url = canvas.toDataURL();
  shopItemIconCache.set(item.id, url);
  return url;
}

let customPlayerScratchCanvas: HTMLCanvasElement | null = null;

/**
 * Directly renders the player's actual customized pixel character onto any HTML5
 * mini-game <canvas> using the exact same appearance, hairstyle, and equipped clothing
 * drawn in the open world.
 */
export function drawCustomPlayerOnCanvas(
  ctx: CanvasRenderingContext2D,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  saveState: SaveDataV1,
  dir: Direction = 'down',
  step = 0,
  animMode: AnimationState = 'walk',
): void {
  if (!customPlayerScratchCanvas) {
    customPlayerScratchCanvas = document.createElement('canvas');
    customPlayerScratchCanvas.width = 32;
    customPlayerScratchCanvas.height = 40;
  }
  const sCtx = customPlayerScratchCanvas.getContext('2d');
  if (!sCtx) return;

  const preset =
    CHARACTER_PRESETS.find((p) => p.id === saveState.appearanceId) ?? CHARACTER_PRESETS[0];

  sCtx.clearRect(0, 0, 32, 40);
  sCtx.imageSmoothingEnabled = false;
  drawCharacterFrame(
    sCtx,
    0,
    0,
    dir,
    step,
    preset,
    animMode,
    saveState.equippedClothing,
    saveState.hairOverride,
    saveState.appearanceConfig,
  );

  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(customPlayerScratchCanvas, 0, 0, 32, 40, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
  ctx.imageSmoothingEnabled = prevSmooth;
}

