import Phaser from 'phaser';
import {TILE_SIZE} from '@/src/config/constants';

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

function createCanvas(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
): {tex: Phaser.Textures.CanvasTexture; ctx: CanvasRenderingContext2D} | null {
  if (scene.textures.exists(key)) return null;
  const tex = scene.textures.createCanvas(key, width, height);
  if (!tex) return null;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  return {tex, ctx};
}

function finalize(tex: Phaser.Textures.CanvasTexture): void {
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

export function getInteriorArtGenerationSteps(
  scene: Phaser.Scene,
): Array<{label: string; run: () => void}> {
  return [
    {label: 'Designing interior architecture tiles...', run: () => generateInteriorTileset(scene)},
    {label: 'Furnishing 35 interior venues & homes...', run: () => generateInteriorProps(scene)},
  ];
}

export function generateAllInteriorArt(scene: Phaser.Scene): void {
  for (const step of getInteriorArtGenerationSteps(scene)) {
    step.run();
  }
}

function generateInteriorTileset(scene: Phaser.Scene): void {
  const cols = 16;
  const rows = 2;
  const created = createCanvas(scene, 'interior_tileset', cols * TILE_SIZE, rows * TILE_SIZE);
  if (!created) return;
  const {tex, ctx} = created;

  const tileOrigin = (idx: number) => ({
    ox: (idx % cols) * TILE_SIZE,
    oy: Math.floor(idx / cols) * TILE_SIZE,
  });

  // 0: Warm Oak Hardwood Planks
  {
    const {ox, oy} = tileOrigin(0);
    px(ctx, ox, oy, 32, 32, '#9a6842');
    for (let y = 0; y < 32; y += 8) {
      px(ctx, ox, oy + y, 32, 1, '#7c4e2d');
      px(ctx, ox, oy + y + 1, 32, 1, '#b37b50');
    }
    px(ctx, ox + 12, oy, 1, 8, '#7c4e2d');
    px(ctx, ox + 24, oy + 8, 1, 8, '#7c4e2d');
    px(ctx, ox + 6, oy + 16, 1, 8, '#7c4e2d');
    px(ctx, ox + 19, oy + 24, 1, 8, '#7c4e2d');
  }

  // 1: Boutique Terrazzo Floor
  {
    const {ox, oy} = tileOrigin(1);
    px(ctx, ox, oy, 32, 32, '#e2e8f0');
    px(ctx, ox, oy, 32, 1, '#cbd5e1');
    px(ctx, ox, oy, 1, 32, '#cbd5e1');
    px(ctx, ox + 6, oy + 8, 2, 2, '#94a3b8');
    px(ctx, ox + 20, oy + 6, 2, 2, '#f472b6');
    px(ctx, ox + 12, oy + 22, 2, 2, '#38bdf8');
    px(ctx, ox + 25, oy + 19, 2, 2, '#94a3b8');
  }

  // 2: Cafe / Bistro Checker Tile
  {
    const {ox, oy} = tileOrigin(2);
    for (let y = 0; y < 32; y += 16) {
      for (let x = 0; x < 32; x += 16) {
        const dark = ((x + y) / 16) % 2 === 0;
        px(ctx, ox + x, oy + y, 16, 16, dark ? '#d6c3a5' : '#f8f1e5');
      }
    }
  }

  // 3: Supermarket / Clinic Clean Linoleum
  {
    const {ox, oy} = tileOrigin(3);
    px(ctx, ox, oy, 32, 32, '#f1f5f9');
    px(ctx, ox, oy + 31, 32, 1, '#cbd5e1');
    px(ctx, ox + 31, oy, 1, 32, '#cbd5e1');
    px(ctx, ox + 15, oy, 1, 32, '#e2e8f0');
    px(ctx, ox, oy + 15, 32, 1, '#e2e8f0');
  }

  // 4: Arcade Dark Neon-Grid Carpet
  {
    const {ox, oy} = tileOrigin(4);
    px(ctx, ox, oy, 32, 32, '#17153b');
    px(ctx, ox, oy, 32, 1, '#2e236c');
    px(ctx, ox, oy, 1, 32, '#2e236c');
    px(ctx, ox + 8, oy + 10, 2, 2, '#38bdf8');
    px(ctx, ox + 22, oy + 20, 2, 2, '#ec4899');
    px(ctx, ox + 14, oy + 25, 2, 1, '#facc15');
  }

  // 5: Cinema Velvet Carpet
  {
    const {ox, oy} = tileOrigin(5);
    px(ctx, ox, oy, 32, 32, '#7f1d1d');
    px(ctx, ox + 6, oy + 6, 4, 4, '#991b1b');
    px(ctx, ox + 20, oy + 20, 4, 4, '#991b1b');
    px(ctx, ox + 22, oy + 8, 2, 2, '#fbbf24');
  }

  // 6: Cinema Dark Auditorium Floor
  {
    const {ox, oy} = tileOrigin(6);
    px(ctx, ox, oy, 32, 32, '#18181b');
    px(ctx, ox, oy + 15, 32, 1, '#27272a');
    px(ctx, ox + 4, oy + 28, 3, 2, '#38bdf8');
  }

  // 7: Marble Lobby Tile (Bank / Office)
  {
    const {ox, oy} = tileOrigin(7);
    px(ctx, ox, oy, 32, 32, '#dbeafe');
    px(ctx, ox + 1, oy + 1, 30, 30, '#eff6ff');
    px(ctx, ox + 6, oy + 9, 8, 1, '#bfdbfe');
    px(ctx, ox + 16, oy + 22, 9, 1, '#bfdbfe');
  }

  // 8: Bathroom Mosaic Tile
  {
    const {ox, oy} = tileOrigin(8);
    px(ctx, ox, oy, 32, 32, '#e0f2fe');
    for (let y = 0; y < 32; y += 8) {
      for (let x = 0; x < 32; x += 8) {
        if (((x + y) / 8) % 2 === 0) px(ctx, ox + x, oy + y, 7, 7, '#bae6fd');
      }
    }
  }

  // 9: Kitchen Warm Tile
  {
    const {ox, oy} = tileOrigin(9);
    px(ctx, ox, oy, 32, 32, '#fef3c7');
    px(ctx, ox, oy + 15, 32, 1, '#fde68a');
    px(ctx, ox + 15, oy, 1, 32, '#fde68a');
  }

  // 10: Gym Turf / Rubber Mat
  {
    const {ox, oy} = tileOrigin(10);
    px(ctx, ox, oy, 32, 32, '#334155');
    px(ctx, ox + 4, oy + 4, 24, 24, '#3f4d63');
    px(ctx, ox + 8, oy + 15, 2, 2, '#475569');
    px(ctx, ox + 22, oy + 15, 2, 2, '#475569');
  }

  // 11: Cozy Patterned Rug
  {
    const {ox, oy} = tileOrigin(11);
    px(ctx, ox, oy, 32, 32, '#be123c');
    px(ctx, ox + 3, oy + 3, 26, 26, '#e11d48');
    px(ctx, ox + 6, oy + 6, 20, 20, '#fda4af');
    px(ctx, ox + 10, oy + 10, 12, 12, '#be123c');
  }

  // 12: Interior Slate Wall
  {
    const {ox, oy} = tileOrigin(12);
    px(ctx, ox, oy, 32, 32, '#1e293b');
    px(ctx, ox, oy, 32, 4, '#0f172a');
    px(ctx, ox, oy + 24, 32, 8, '#334155');
    px(ctx, ox, oy + 24, 32, 2, '#475569');
  }

  // 13: Interior Warm Wainscot Wall
  {
    const {ox, oy} = tileOrigin(13);
    px(ctx, ox, oy, 32, 32, '#f5ebe0');
    px(ctx, ox, oy, 32, 3, '#334155');
    px(ctx, ox, oy + 22, 32, 10, '#8d5b3e');
    px(ctx, ox, oy + 22, 32, 2, '#b07b58');
  }

  // 14: Interior Neon/Theater Dark Wall
  {
    const {ox, oy} = tileOrigin(14);
    px(ctx, ox, oy, 32, 32, '#0f172a');
    px(ctx, ox, oy, 32, 3, '#020617');
    px(ctx, ox, oy + 16, 32, 2, '#38bdf8');
    px(ctx, ox, oy + 26, 32, 6, '#1e1b4b');
  }

  // 15: Interior Partition Wall (solid divider)
  {
    const {ox, oy} = tileOrigin(15);
    px(ctx, ox, oy, 32, 32, '#475569');
    px(ctx, ox + 2, oy + 2, 28, 12, '#64748b');
    px(ctx, ox, oy + 18, 32, 14, '#334155');
  }

  // 16: Wall with Sunlit Window
  {
    const {ox, oy} = tileOrigin(16);
    px(ctx, ox, oy, 32, 32, '#f5ebe0');
    px(ctx, ox, oy + 22, 32, 10, '#8d5b3e');
    px(ctx, ox + 6, oy + 4, 20, 16, '#1e293b');
    px(ctx, ox + 8, oy + 6, 16, 12, '#7dd3fc');
    px(ctx, ox + 15, oy + 6, 2, 12, '#f8fafc');
    px(ctx, ox + 8, oy + 11, 16, 2, '#f8fafc');
  }

  // 17: Wall with Framed Mirror / Poster
  {
    const {ox, oy} = tileOrigin(17);
    px(ctx, ox, oy, 32, 32, '#f5ebe0');
    px(ctx, ox, oy + 22, 32, 10, '#8d5b3e');
    px(ctx, ox + 8, oy + 4, 16, 16, '#b45309');
    px(ctx, ox + 10, oy + 6, 12, 12, '#bae6fd');
    px(ctx, ox + 12, oy + 8, 4, 4, '#ffffff');
  }

  // 18: Salon / Gym Brick Accent Wall
  {
    const {ox, oy} = tileOrigin(18);
    px(ctx, ox, oy, 32, 32, '#27272a');
    for (let y = 4; y < 24; y += 6) {
      px(ctx, ox, oy + y, 32, 1, '#3f3f46');
    }
    px(ctx, ox, oy + 25, 32, 7, '#18181b');
  }

  // 19: Garage Epoxy Concrete Floor
  {
    const {ox, oy} = tileOrigin(19);
    px(ctx, ox, oy, 32, 32, '#475569');
    px(ctx, ox + 1, oy + 1, 30, 30, '#64748b');
    px(ctx, ox + 6, oy + 8, 2, 2, '#94a3b8');
    px(ctx, ox + 22, oy + 20, 2, 2, '#475569');
  }

  // 20: Garage Bay Yellow/Black Hazard Floor Trim
  {
    const {ox, oy} = tileOrigin(20);
    px(ctx, ox, oy, 32, 32, '#334155');
    px(ctx, ox, oy + 26, 32, 6, '#0f172a');
    for (let sx = 0; sx < 32; sx += 8) {
      px(ctx, ox + sx, oy + 27, 4, 4, '#facc15');
    }
  }

  finalize(tex);
}

function generateInteriorProps(scene: Phaser.Scene): void {
  const make = (key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const c = createCanvas(scene, key, w, h);
    if (!c) return;
    draw(c.ctx);
    finalize(c.tex);
  };

  // Exit Mat + Doorway
  make('int_exit_mat', 48, 24, (ctx) => {
    px(ctx, 2, 2, 44, 20, '#0f172a');
    px(ctx, 4, 4, 40, 16, '#059669');
    px(ctx, 6, 6, 36, 12, '#10b981');
    // Downward exit chevron
    px(ctx, 18, 9, 12, 2, '#fef08a');
    px(ctx, 20, 11, 8, 2, '#fef08a');
    px(ctx, 22, 13, 4, 2, '#fef08a');
  });

  // Cashier Counter
  make('int_cashier', 64, 40, (ctx) => {
    px(ctx, 2, 8, 60, 30, '#0f172a');
    px(ctx, 4, 10, 56, 26, '#78350f');
    px(ctx, 4, 10, 56, 7, '#d97706');
    px(ctx, 4, 26, 56, 8, '#92400e');
    // POS screen & register
    px(ctx, 22, 2, 18, 12, '#1e293b');
    px(ctx, 24, 4, 14, 8, '#38bdf8');
    px(ctx, 44, 6, 10, 6, '#cbd5e1');
  });

  // Clothing Rack
  make('int_rack', 48, 44, (ctx) => {
    px(ctx, 4, 34, 40, 6, 'rgba(15, 23, 42, 0.25)');
    px(ctx, 6, 8, 3, 30, '#475569');
    px(ctx, 39, 8, 3, 30, '#475569');
    px(ctx, 6, 8, 36, 3, '#cbd5e1');
    const colors = ['#38bdf8', '#f43f5e', '#facc15', '#10b981', '#a855f7'];
    colors.forEach((col, i) => {
      px(ctx, 10 + i * 6, 11, 5, 18, '#0f172a');
      px(ctx, 11 + i * 6, 12, 4, 15, col);
    });
  });

  // Display Mannequin
  make('int_mannequin', 28, 48, (ctx) => {
    px(ctx, 6, 38, 16, 6, '#334155');
    px(ctx, 12, 26, 4, 14, '#64748b');
    px(ctx, 8, 14, 12, 14, '#f43f5e');
    px(ctx, 10, 4, 8, 8, '#e2e8f0');
    px(ctx, 9, 2, 10, 4, '#0ea5e9');
  });

  // Tall Mirror
  make('int_mirror', 32, 42, (ctx) => {
    px(ctx, 4, 2, 24, 38, '#b45309');
    px(ctx, 7, 5, 18, 32, '#7dd3fc');
    px(ctx, 9, 8, 4, 14, '#e0f2fe');
    px(ctx, 15, 16, 4, 10, '#bae6fd');
  });

  // Changing Room Booth
  make('int_curtain', 56, 44, (ctx) => {
    px(ctx, 2, 4, 52, 38, '#0f172a');
    px(ctx, 4, 6, 48, 34, '#334155');
    px(ctx, 6, 8, 18, 30, '#be185d');
    px(ctx, 32, 8, 18, 30, '#be185d');
    px(ctx, 24, 10, 8, 28, '#1e293b');
    px(ctx, 4, 4, 48, 4, '#fbbf24');
  });

  // Cafe / Restaurant Table
  make('int_table_cafe', 40, 36, (ctx) => {
    px(ctx, 14, 22, 12, 12, '#475569');
    px(ctx, 4, 6, 32, 18, '#0f172a');
    px(ctx, 6, 8, 28, 14, '#d97706');
    px(ctx, 8, 10, 24, 10, '#fef3c7');
    px(ctx, 12, 12, 5, 5, '#78350f');
    px(ctx, 23, 12, 5, 5, '#ef4444');
  });

  // Chair
  make('int_chair', 24, 28, (ctx) => {
    px(ctx, 5, 4, 14, 12, '#0f172a');
    px(ctx, 7, 6, 10, 8, '#b45309');
    px(ctx, 5, 14, 14, 8, '#d97706');
    px(ctx, 6, 22, 3, 5, '#78350f');
    px(ctx, 15, 22, 3, 5, '#78350f');
  });

  // Bakery / Food Display Case
  make('int_food_case', 64, 40, (ctx) => {
    px(ctx, 2, 6, 60, 32, '#0f172a');
    px(ctx, 4, 8, 56, 16, '#bae6fd');
    px(ctx, 4, 24, 56, 12, '#92400e');
    // Pastries / dishes inside
    px(ctx, 10, 12, 8, 6, '#f59e0b');
    px(ctx, 24, 12, 8, 6, '#ec4899');
    px(ctx, 38, 12, 8, 6, '#22c55e');
    px(ctx, 50, 12, 6, 6, '#ef4444');
  });

  // Supermarket Shelf
  make('int_shelf_grocery', 64, 44, (ctx) => {
    px(ctx, 2, 4, 60, 38, '#1e293b');
    px(ctx, 4, 6, 56, 10, '#475569');
    px(ctx, 4, 19, 56, 10, '#475569');
    px(ctx, 4, 32, 56, 8, '#334155');
    const items = ['#ef4444', '#22c55e', '#facc15', '#38bdf8', '#f97316', '#a855f7'];
    items.forEach((col, i) => {
      px(ctx, 7 + i * 8, 8, 6, 7, col);
      px(ctx, 7 + i * 8, 21, 6, 7, items[(i + 2) % items.length]);
    });
  });

  // Shopping Baskets Stack
  make('int_basket_stack', 28, 32, (ctx) => {
    px(ctx, 4, 14, 20, 14, '#0f172a');
    px(ctx, 6, 16, 16, 10, '#ef4444');
    px(ctx, 6, 12, 16, 4, '#38bdf8');
    px(ctx, 10, 8, 8, 4, '#cbd5e1');
  });

  // Arcade Cabinet
  make('int_arcade_cab', 36, 48, (ctx) => {
    px(ctx, 4, 4, 28, 42, '#020617');
    px(ctx, 6, 6, 24, 8, '#ec4899');
    px(ctx, 8, 16, 20, 14, '#0ea5e9');
    px(ctx, 10, 18, 16, 10, '#1e1b4b');
    px(ctx, 14, 21, 4, 4, '#facc15');
    px(ctx, 6, 31, 24, 5, '#334155');
    px(ctx, 10, 32, 3, 3, '#ef4444');
    px(ctx, 20, 32, 3, 3, '#22c55e');
    px(ctx, 6, 37, 24, 8, '#312e81');
  });

  // Arcade Prize Case
  make('int_prize_case', 64, 42, (ctx) => {
    px(ctx, 2, 4, 60, 36, '#0f172a');
    px(ctx, 4, 6, 56, 22, '#312e81');
    px(ctx, 10, 10, 10, 12, '#fbbf24');
    px(ctx, 27, 10, 10, 12, '#34d399');
    px(ctx, 44, 10, 10, 12, '#f472b6');
    px(ctx, 4, 28, 56, 10, '#4f46e5');
  });

  // Cinema Ticket Booth
  make('int_cinema_booth', 64, 44, (ctx) => {
    px(ctx, 2, 6, 60, 36, '#0f172a');
    px(ctx, 4, 8, 56, 16, '#fde047');
    px(ctx, 8, 10, 48, 12, '#1e293b');
    px(ctx, 20, 13, 24, 6, '#38bdf8');
    px(ctx, 4, 24, 56, 16, '#991b1b');
    px(ctx, 4, 24, 56, 3, '#fbbf24');
  });

  // Cinema Seat
  make('int_cinema_seat', 28, 28, (ctx) => {
    px(ctx, 4, 4, 20, 12, '#0f172a');
    px(ctx, 6, 6, 16, 10, '#dc2626');
    px(ctx, 4, 16, 20, 9, '#991b1b');
    px(ctx, 2, 12, 3, 12, '#450a0a');
    px(ctx, 23, 12, 3, 12, '#450a0a');
  });

  // Cinema Widescreen
  make('int_cinema_screen', 192, 52, (ctx) => {
    px(ctx, 0, 2, 192, 48, '#0f172a');
    px(ctx, 4, 6, 12, 40, '#991b1b');
    px(ctx, 176, 6, 12, 40, '#991b1b');
    px(ctx, 18, 6, 156, 38, '#e2e8f0');
    px(ctx, 22, 10, 148, 30, '#0c4a6e');
    // Pixel starfield preview
    px(ctx, 42, 16, 4, 4, '#facc15');
    px(ctx, 88, 20, 18, 10, '#38bdf8');
    px(ctx, 132, 15, 6, 6, '#f43f5e');
  });

  // Velvet Rope Gate
  make('int_velvet_rope', 64, 20, (ctx) => {
    px(ctx, 2, 4, 6, 14, '#fbbf24');
    px(ctx, 56, 4, 6, 14, '#fbbf24');
    px(ctx, 8, 8, 48, 4, '#dc2626');
    px(ctx, 8, 12, 48, 2, '#991b1b');
  });

  // Living Room Sofa
  make('int_sofa', 64, 36, (ctx) => {
    px(ctx, 2, 6, 60, 26, '#0f172a');
    px(ctx, 4, 8, 56, 10, '#1d4ed8');
    px(ctx, 4, 18, 56, 12, '#2563eb');
    px(ctx, 4, 10, 8, 20, '#1e40af');
    px(ctx, 52, 10, 8, 20, '#1e40af');
    px(ctx, 14, 16, 10, 6, '#fbbf24');
    px(ctx, 40, 16, 10, 6, '#fbbf24');
  });

  // Cozy Bed
  make('int_bed', 44, 56, (ctx) => {
    px(ctx, 2, 2, 40, 52, '#0f172a');
    px(ctx, 4, 4, 36, 8, '#78350f');
    px(ctx, 4, 12, 36, 12, '#f8fafc');
    px(ctx, 7, 13, 12, 8, '#e2e8f0');
    px(ctx, 25, 13, 12, 8, '#e2e8f0');
    px(ctx, 4, 24, 36, 28, '#0284c7');
    px(ctx, 4, 24, 36, 4, '#38bdf8');
  });

  // Kitchen Counter & Stove
  make('int_kitchen_counter', 64, 40, (ctx) => {
    px(ctx, 2, 6, 60, 32, '#0f172a');
    px(ctx, 4, 8, 56, 12, '#e2e8f0');
    px(ctx, 4, 20, 56, 16, '#92400e');
    // Stove burners
    px(ctx, 10, 10, 8, 8, '#1e293b');
    px(ctx, 22, 10, 8, 8, '#1e293b');
    // Sink basin
    px(ctx, 38, 10, 16, 8, '#38bdf8');
  });

  // Fridge
  make('int_fridge', 32, 48, (ctx) => {
    px(ctx, 4, 4, 24, 42, '#0f172a');
    px(ctx, 6, 6, 20, 38, '#e2e8f0');
    px(ctx, 6, 22, 20, 2, '#94a3b8');
    px(ctx, 21, 10, 2, 8, '#64748b');
    px(ctx, 21, 26, 2, 10, '#64748b');
  });

  // Bathtub
  make('int_bathtub', 56, 36, (ctx) => {
    px(ctx, 2, 4, 52, 28, '#0f172a');
    px(ctx, 4, 6, 48, 24, '#f8fafc');
    px(ctx, 8, 10, 40, 16, '#38bdf8');
    px(ctx, 44, 15, 6, 4, '#94a3b8');
  });

  // TV Stand (2-frame spritesheet: '0'=OFF, '1'=ON bright broadcast)
  {
    const created = createCanvas(scene, 'int_tv', 96, 36);
    if (created) {
      // Frame 0: Powered OFF dark screen
      px(created.ctx, 4, 16, 40, 18, '#78350f');
      px(created.ctx, 8, 4, 32, 18, '#0f172a');
      px(created.ctx, 10, 6, 28, 14, '#1e293b');
      px(created.ctx, 12, 8, 8, 2, '#334155');
      px(created.ctx, 35, 19, 2, 2, '#ef4444'); // Standby LED

      // Frame 1: Powered ON glowing city channel
      px(created.ctx, 52, 16, 40, 18, '#78350f');
      px(created.ctx, 56, 4, 32, 18, '#0f172a');
      px(created.ctx, 58, 6, 28, 14, '#0ea5e9');
      px(created.ctx, 60, 8, 10, 8, '#facc15');
      px(created.ctx, 72, 9, 10, 6, '#f43f5e');
      px(created.ctx, 83, 19, 2, 2, '#22c55e'); // Active LED

      created.tex.add('0', 0, 0, 0, 48, 36);
      created.tex.add('1', 0, 48, 0, 48, 36);
      created.tex.refresh();
      created.tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  // Interactive Interior Wooden/Glass Exit Door (2-frame spritesheet: '0'=closed, '1'=open)
  {
    const created = createCanvas(scene, 'int_door_wood', 96, 34);
    if (created) {
      // Frame 0: Closed door leaf across exit doorway
      px(created.ctx, 2, 2, 44, 30, '#0f172a');
      px(created.ctx, 4, 4, 40, 26, '#78350f');
      px(created.ctx, 7, 7, 14, 10, '#38bdf8');
      px(created.ctx, 27, 7, 14, 10, '#38bdf8');
      px(created.ctx, 38, 18, 4, 5, '#fbbf24');

      // Frame 1: Open door revealing city light outside
      px(created.ctx, 50, 2, 44, 30, '#0f172a');
      px(created.ctx, 52, 4, 40, 26, '#0284c7');
      px(created.ctx, 54, 6, 36, 22, '#bae6fd');
      // Swung door edge on left
      px(created.ctx, 50, 2, 8, 30, '#92400e');

      created.tex.add('0', 0, 0, 0, 48, 34);
      created.tex.add('1', 0, 48, 0, 48, 34);
      created.tex.refresh();
      created.tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  // Interior Partition Swing Door (2-frame spritesheet: '0'=closed, '1'=open)
  {
    const created = createCanvas(scene, 'int_door_room', 128, 32);
    if (created) {
      // Frame 0: Closed wooden double door
      px(created.ctx, 2, 4, 60, 24, '#0f172a');
      px(created.ctx, 4, 6, 27, 20, '#92400e');
      px(created.ctx, 33, 6, 27, 20, '#92400e');
      px(created.ctx, 26, 14, 3, 4, '#fbbf24');
      px(created.ctx, 35, 14, 3, 4, '#fbbf24');

      // Frame 1: Doors swung open at sides
      px(created.ctx, 66, 4, 8, 24, '#78350f');
      px(created.ctx, 118, 4, 8, 24, '#78350f');
      px(created.ctx, 74, 10, 44, 12, 'rgba(56, 189, 248, 0.18)');

      created.tex.add('0', 0, 0, 0, 64, 32);
      created.tex.add('1', 0, 64, 0, 64, 32);
      created.tex.refresh();
      created.tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
  }

  // Personal Computer Desk Workstation (56x40)
  make('int_computer', 56, 40, (ctx) => {
    px(ctx, 2, 12, 52, 26, '#0f172a');
    px(ctx, 4, 14, 48, 14, '#78350f');
    px(ctx, 4, 28, 48, 8, '#451a03');
    // Monitor
    px(ctx, 14, 2, 24, 15, '#0f172a');
    px(ctx, 16, 4, 20, 11, '#38bdf8');
    px(ctx, 18, 6, 8, 5, '#fef08a');
    px(ctx, 28, 6, 6, 7, '#0ea5e9');
    // Keyboard + Mouse + Tower
    px(ctx, 18, 19, 14, 4, '#cbd5e1');
    px(ctx, 35, 20, 4, 3, '#94a3b8');
    px(ctx, 41, 6, 10, 14, '#1e293b');
    px(ctx, 43, 8, 6, 2, '#10b981');
  });

  // Bookshelf
  make('int_bookshelf', 56, 48, (ctx) => {
    px(ctx, 2, 2, 52, 44, '#0f172a');
    px(ctx, 4, 4, 48, 40, '#78350f');
    px(ctx, 6, 7, 44, 10, '#451a03');
    px(ctx, 6, 20, 44, 10, '#451a03');
    px(ctx, 6, 33, 44, 9, '#451a03');
    const cols = ['#ef4444', '#38bdf8', '#fbbf24', '#10b981', '#a855f7'];
    cols.forEach((c, i) => {
      px(ctx, 8 + i * 8, 8, 6, 9, c);
      px(ctx, 8 + i * 8, 21, 6, 9, cols[(i + 2) % cols.length]);
    });
  });

  // Desk (Office / Library / Tech)
  make('int_desk', 56, 38, (ctx) => {
    px(ctx, 2, 10, 52, 26, '#0f172a');
    px(ctx, 4, 12, 48, 14, '#b45309');
    px(ctx, 4, 26, 48, 8, '#78350f');
    px(ctx, 20, 4, 16, 10, '#1e293b');
    px(ctx, 22, 6, 12, 6, '#38bdf8');
  });

  // Bank Vault Door
  make('int_bank_vault', 64, 56, (ctx) => {
    px(ctx, 4, 4, 56, 50, '#0f172a');
    px(ctx, 6, 6, 52, 46, '#64748b');
    px(ctx, 12, 12, 40, 36, '#94a3b8');
    px(ctx, 26, 24, 12, 12, '#fbbf24');
    px(ctx, 30, 26, 4, 8, '#0f172a');
  });

  // Salon Chair + Mirror Station
  make('int_salon_chair', 34, 42, (ctx) => {
    px(ctx, 4, 4, 26, 14, '#ec4899');
    px(ctx, 6, 6, 22, 10, '#bae6fd');
    px(ctx, 7, 20, 20, 14, '#1e293b');
    px(ctx, 9, 22, 16, 10, '#f43f5e');
    px(ctx, 14, 34, 6, 6, '#94a3b8');
  });

  // Pet Pen
  make('int_pet_pen', 56, 44, (ctx) => {
    px(ctx, 2, 4, 52, 38, '#78350f');
    px(ctx, 6, 8, 44, 30, '#fef3c7');
    px(ctx, 10, 12, 36, 22, '#fde68a');
    // Cute pixel puppy/kitty inside
    px(ctx, 22, 18, 12, 10, '#d97706');
    px(ctx, 23, 14, 10, 8, '#f59e0b');
    px(ctx, 25, 17, 2, 2, '#0f172a');
    px(ctx, 29, 17, 2, 2, '#0f172a');
  });

  // Gym Treadmill
  make('int_treadmill', 34, 48, (ctx) => {
    px(ctx, 4, 4, 26, 14, '#1e293b');
    px(ctx, 8, 6, 18, 8, '#38bdf8');
    px(ctx, 4, 16, 26, 28, '#334155');
    px(ctx, 8, 18, 18, 24, '#0f172a');
    px(ctx, 10, 24, 14, 2, '#475569');
    px(ctx, 10, 32, 14, 2, '#475569');
  });

  // Gym Weights Rack
  make('int_weights', 56, 38, (ctx) => {
    px(ctx, 4, 12, 48, 22, '#1e293b');
    px(ctx, 8, 16, 40, 4, '#cbd5e1');
    px(ctx, 6, 13, 6, 10, '#f97316');
    px(ctx, 44, 13, 6, 10, '#f97316');
    px(ctx, 14, 24, 8, 6, '#38bdf8');
    px(ctx, 34, 24, 8, 6, '#38bdf8');
  });

  // Gym Punching Bag
  make('int_punchbag', 28, 48, (ctx) => {
    px(ctx, 12, 2, 4, 8, '#94a3b8');
    px(ctx, 6, 10, 16, 28, '#0f172a');
    px(ctx, 8, 12, 12, 24, '#dc2626');
    px(ctx, 8, 18, 12, 4, '#f8fafc');
  });

  // Clinic Exam Bed
  make('int_clinic_bed', 56, 38, (ctx) => {
    px(ctx, 2, 6, 52, 28, '#0f172a');
    px(ctx, 4, 8, 48, 24, '#f8fafc');
    px(ctx, 6, 12, 10, 16, '#bae6fd');
    px(ctx, 20, 10, 30, 20, '#38bdf8');
  });

  // Potted Plant
  make('int_plant', 28, 38, (ctx) => {
    px(ctx, 8, 24, 12, 12, '#b45309');
    px(ctx, 6, 22, 16, 4, '#d97706');
    px(ctx, 5, 8, 18, 15, '#15803d');
    px(ctx, 8, 6, 12, 12, '#22c55e');
    px(ctx, 10, 8, 6, 6, '#4ade80');
  });

  // Hydraulic Car Lift Bay with Tuned Sport Chassis (96x64)
  make('int_car_lift', 96, 64, (ctx) => {
    // Concrete bay shadow
    px(ctx, 4, 46, 88, 14, '#334155');
    // Left & right hydraulic lift pillars
    px(ctx, 6, 6, 10, 50, '#0f172a');
    px(ctx, 8, 8, 6, 46, '#f97316');
    px(ctx, 80, 6, 10, 50, '#0f172a');
    px(ctx, 82, 8, 6, 46, '#f97316');
    // Cross steel ramp bars
    px(ctx, 16, 36, 64, 6, '#1e293b');
    // Sport coupe resting on lift
    px(ctx, 20, 22, 56, 18, '#0f172a');
    px(ctx, 22, 24, 52, 14, '#0284c7');
    px(ctx, 32, 15, 30, 10, '#38bdf8');
    px(ctx, 35, 17, 11, 6, '#bae6fd');
    px(ctx, 48, 17, 11, 6, '#bae6fd');
    px(ctx, 22, 30, 52, 2, '#fde047');
    // Wheels
    px(ctx, 24, 34, 11, 10, '#0f172a');
    px(ctx, 26, 36, 7, 6, '#fbbf24');
    px(ctx, 61, 34, 11, 10, '#0f172a');
    px(ctx, 63, 36, 7, 6, '#fbbf24');
  });

  // Racing Tire & Alloy Rim Rack (56x36)
  make('int_tire_rack', 56, 36, (ctx) => {
    px(ctx, 2, 4, 52, 28, '#0f172a');
    px(ctx, 4, 6, 48, 24, '#334155');
    for (let i = 0; i < 4; i++) {
      const tx = 6 + i * 11;
      px(ctx, tx, 8, 9, 20, '#090d16');
      px(ctx, tx + 2, 12, 5, 12, i % 2 === 0 ? '#e2e8f0' : '#fbbf24');
    }
  });

  // Red Mechanic Toolbox Chest (44x36)
  make('int_toolbox', 44, 36, (ctx) => {
    px(ctx, 2, 4, 40, 28, '#0f172a');
    px(ctx, 4, 6, 36, 24, '#dc2626');
    px(ctx, 6, 10, 32, 4, '#ef4444');
    px(ctx, 6, 16, 32, 4, '#ef4444');
    px(ctx, 6, 22, 32, 4, '#ef4444');
    px(ctx, 17, 11, 10, 2, '#e2e8f0');
    px(ctx, 17, 17, 10, 2, '#e2e8f0');
    px(ctx, 17, 23, 10, 2, '#e2e8f0');
  });

  // Paint Mixing & Decal Station (56x44)
  make('int_paint_booth', 56, 44, (ctx) => {
    px(ctx, 2, 4, 52, 36, '#0f172a');
    px(ctx, 4, 6, 48, 32, '#1e293b');
    const swatches = ['#ef4444', '#f97316', '#facc15', '#10b981', '#38bdf8', '#a855f7'];
    swatches.forEach((col, i) => {
      px(ctx, 7 + i * 7, 10, 5, 10, col);
    });
    px(ctx, 8, 24, 40, 10, '#475569');
    px(ctx, 12, 26, 8, 6, '#38bdf8');
    px(ctx, 24, 26, 8, 6, '#f43f5e');
    px(ctx, 36, 26, 8, 6, '#facc15');
  });

  // Prompt 09 Interior Furniture Props
  make('int_med_bay', 60, 44, (ctx) => {
    px(ctx, 2, 4, 56, 36, '#0f172a');
    px(ctx, 4, 6, 52, 32, '#f8fafc');
    px(ctx, 8, 10, 26, 22, '#38bdf8');
    px(ctx, 38, 10, 14, 14, '#0f172a');
    px(ctx, 40, 12, 10, 10, '#10b981');
    px(ctx, 24, 2, 12, 6, '#ef4444');
  });

  make('int_police_desk', 64, 42, (ctx) => {
    px(ctx, 2, 8, 60, 32, '#0f172a');
    px(ctx, 4, 10, 56, 28, '#1e3a8a');
    px(ctx, 10, 4, 18, 12, '#38bdf8');
    px(ctx, 36, 4, 18, 12, '#38bdf8');
    px(ctx, 26, 22, 12, 8, '#fbbf24');
  });

  make('int_cell_gate', 56, 40, (ctx) => {
    px(ctx, 2, 4, 52, 34, '#0f172a');
    px(ctx, 4, 6, 48, 30, '#334155');
    for (let x = 8; x < 50; x += 6) {
      px(ctx, x, 6, 2, 30, '#cbd5e1');
    }
  });

  make('int_fire_truck', 96, 56, (ctx) => {
    px(ctx, 6, 42, 84, 10, 'rgba(15, 23, 42, 0.3)');
    px(ctx, 6, 14, 84, 30, '#0f172a');
    px(ctx, 8, 16, 80, 26, '#dc2626');
    px(ctx, 62, 18, 22, 14, '#7dd3fc');
    px(ctx, 12, 22, 44, 6, '#f8fafc');
    px(ctx, 14, 10, 40, 4, '#cbd5e1');
    px(ctx, 64, 10, 10, 4, '#ef4444');
    px(ctx, 18, 40, 14, 10, '#0f172a');
    px(ctx, 64, 40, 14, 10, '#0f172a');
  });

  make('int_gate_desk', 68, 40, (ctx) => {
    px(ctx, 2, 8, 64, 30, '#0f172a');
    px(ctx, 4, 10, 60, 26, '#0284c7');
    px(ctx, 18, 4, 32, 10, '#38bdf8');
    px(ctx, 22, 6, 24, 6, '#e0f2fe');
  });

  make('int_luxury_bed', 56, 58, (ctx) => {
    px(ctx, 2, 2, 52, 54, '#0f172a');
    px(ctx, 4, 4, 48, 10, '#b45309');
    px(ctx, 4, 14, 48, 14, '#fef3c7');
    px(ctx, 4, 28, 48, 26, '#581c87');
    px(ctx, 4, 28, 48, 4, '#fbbf24');
  });

  make('int_synth_stage', 64, 42, (ctx) => {
    px(ctx, 2, 8, 60, 30, '#0f172a');
    px(ctx, 4, 10, 56, 26, '#1e1b4b');
    for (let x = 8; x < 54; x += 6) {
      px(ctx, x, 14, 4, 12, '#f8fafc');
      if (x % 12 !== 0) px(ctx, x + 2, 14, 2, 7, '#0f172a');
    }
    px(ctx, 10, 30, 44, 3, '#22d3ee');
  });

  make('int_train_kiosk', 44, 44, (ctx) => {
    px(ctx, 4, 4, 36, 38, '#0f172a');
    px(ctx, 6, 6, 32, 34, '#92400e');
    px(ctx, 10, 10, 24, 14, '#fde68a');
    px(ctx, 14, 28, 16, 6, '#fbbf24');
  });

  make('int_flip_table', 56, 44, (ctx) => {
    px(ctx, 4, 6, 48, 34, '#0f172a');
    px(ctx, 6, 8, 44, 30, '#15803d');
    px(ctx, 10, 12, 36, 22, '#16a34a');
    px(ctx, 24, 19, 8, 8, '#fbbf24');
  });

  make('int_lucky_wheel', 48, 52, (ctx) => {
    px(ctx, 20, 30, 8, 18, '#475569');
    px(ctx, 8, 4, 32, 32, '#0f172a');
    px(ctx, 10, 6, 28, 28, '#fbbf24');
    px(ctx, 14, 10, 20, 20, '#38bdf8');
    px(ctx, 20, 16, 8, 8, '#ec4899');
  });

  make('int_mall_kiosk', 64, 42, (ctx) => {
    px(ctx, 2, 6, 60, 34, '#0f172a');
    px(ctx, 4, 8, 56, 30, '#7c3aed');
    px(ctx, 8, 12, 48, 12, '#f472b6');
    px(ctx, 12, 14, 10, 8, '#fef08a');
    px(ctx, 28, 14, 10, 8, '#38bdf8');
    px(ctx, 44, 14, 10, 8, '#34d399');
  });

  make('int_farm_stall', 64, 44, (ctx) => {
    px(ctx, 2, 4, 60, 38, '#78350f');
    px(ctx, 4, 6, 56, 12, '#16a34a');
    px(ctx, 6, 20, 14, 12, '#ef4444');
    px(ctx, 24, 20, 14, 12, '#facc15');
    px(ctx, 42, 20, 14, 12, '#fb923c');
  });

  make('int_forklift', 52, 44, (ctx) => {
    px(ctx, 6, 28, 28, 12, '#0f172a');
    px(ctx, 8, 20, 24, 16, '#eab308');
    px(ctx, 34, 8, 4, 32, '#475569');
    px(ctx, 38, 32, 12, 4, '#94a3b8');
    px(ctx, 12, 10, 14, 10, '#1e293b');
  });

  // Floor Lamp (24x44)
  make('int_lamp', 24, 44, (ctx) => {
    px(ctx, 7, 36, 10, 5, '#475569');
    px(ctx, 11, 16, 2, 22, '#cbd5e1');
    px(ctx, 5, 4, 14, 12, '#b45309');
    px(ctx, 6, 6, 12, 9, '#fde047');
    px(ctx, 9, 13, 6, 3, '#fef9c3');
  });

  // Walnut Double Wardrobe (46x48)
  make('int_wardrobe', 46, 48, (ctx) => {
    px(ctx, 2, 2, 42, 44, '#0f172a');
    px(ctx, 4, 4, 38, 40, '#78350f');
    px(ctx, 6, 6, 16, 34, '#92400e');
    px(ctx, 24, 6, 16, 34, '#92400e');
    px(ctx, 19, 20, 2, 5, '#fbbf24');
    px(ctx, 25, 20, 2, 5, '#fbbf24');
  });

  // Framed Skyline Painting (36x28)
  make('int_painting', 36, 28, (ctx) => {
    px(ctx, 2, 2, 32, 24, '#78350f');
    px(ctx, 5, 5, 26, 18, '#0ea5e9');
    px(ctx, 7, 13, 22, 10, '#1e293b');
    px(ctx, 10, 8, 5, 5, '#fde047');
    px(ctx, 18, 11, 8, 12, '#334155');
  });

  // Trophy Pedestal (28x42)
  make('int_trophy_stand', 28, 42, (ctx) => {
    px(ctx, 4, 20, 20, 20, '#0f172a');
    px(ctx, 6, 22, 16, 16, '#334155');
    px(ctx, 8, 6, 12, 10, '#fbbf24');
    px(ctx, 12, 16, 4, 4, '#d97706');
    px(ctx, 10, 8, 8, 4, '#fef08a');
  });

  // Mission Command Board (64x40)
  make('int_mission_board', 64, 40, (ctx) => {
    px(ctx, 2, 2, 60, 34, '#0f172a');
    px(ctx, 4, 4, 56, 30, '#78350f');
    px(ctx, 7, 7, 50, 24, '#1e293b');
    // Pinned mission dossiers
    px(ctx, 10, 10, 12, 14, '#fef3c7');
    px(ctx, 15, 9, 3, 3, '#ef4444');
    px(ctx, 26, 10, 12, 14, '#fde68a');
    px(ctx, 31, 9, 3, 3, '#facc15');
    px(ctx, 42, 10, 12, 14, '#bae6fd');
    px(ctx, 47, 9, 3, 3, '#38bdf8');
    // Red string links
    px(ctx, 18, 16, 12, 2, '#ef4444');
    px(ctx, 34, 18, 12, 2, '#facc15');
  });

  // Guild / Campaign Crest Banner (44x28)
  make('int_crest_banner', 44, 28, (ctx) => {
    px(ctx, 2, 2, 40, 24, '#0f172a');
    px(ctx, 4, 4, 36, 20, '#7f1d1d');
    px(ctx, 6, 6, 32, 16, '#991b1b');
    px(ctx, 18, 8, 8, 12, '#facc15');
    px(ctx, 15, 11, 14, 6, '#facc15');
    px(ctx, 20, 12, 4, 4, '#fef08a');
  });
}
