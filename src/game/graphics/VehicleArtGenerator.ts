import Phaser from 'phaser';
import {getVehicleModelSpec} from '@/src/game/data/cityLifeData';
import {Direction, VehicleCustomization, VehicleModelId} from '@/src/game/types/gameTypes';

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

function shadeHex(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex;
  const num = parseInt(clean, 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function getHeadlightColor(style: VehicleCustomization['headlightStyle']): string {
  switch (style) {
    case 'ice_blue':
      return '#7dd3fc';
    case 'neon_gold':
      return '#facc15';
    case 'crimson':
      return '#fb7185';
    case 'warm':
    default:
      return '#fef08a';
  }
}

function getWheelColors(style: VehicleCustomization['wheelStyle']): {
  tire: string;
  rim: string;
  accent: string;
} {
  switch (style) {
    case 'alloy_star':
      return {tire: '#0f172a', rim: '#e2e8f0', accent: '#94a3b8'};
    case 'gold_rim':
      return {tire: '#0f172a', rim: '#fbbf24', accent: '#b45309'};
    case 'sport_tread':
      return {tire: '#1e293b', rim: '#38bdf8', accent: '#0284c7'};
    case 'stock':
    default:
      return {tire: '#0f172a', rim: '#64748b', accent: '#475569'};
  }
}

function drawScooterFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  dirIdx: number,
  c: VehicleCustomization,
  isMoto = false,
): void {
  const headlight = getHeadlightColor(c.headlightStyle);
  const wheel = getWheelColors(c.wheelStyle);

  px(ctx, ox + 10, 31, 20, 5, 'rgba(15, 23, 42, 0.3)');

  if (dirIdx === 0 || dirIdx === 1) {
    px(ctx, ox + 17, 5, 6, 27, '#0f172a');
    px(ctx, ox + 18, 7, 4, 23, c.paintColor);
    if (isMoto) {
      px(ctx, ox + 15, 9, 10, 8, c.secondaryColor);
    }
    if (c.decalStyle === 'racing_stripe' || c.decalStyle === 'two_tone') {
      px(ctx, ox + 19, 8, 2, 20, c.secondaryColor);
    }
    px(ctx, ox + 12, 11, 16, 3, '#cbd5e1');
    px(ctx, ox + 10, 11, 3, 3, '#0f172a');
    px(ctx, ox + 27, 11, 3, 3, '#0f172a');
    px(ctx, ox + 17, dirIdx === 0 ? 27 : 6, 6, 4, wheel.rim);
    px(ctx, ox + 18, dirIdx === 0 ? 27 : 7, 4, 3, dirIdx === 0 ? headlight : '#ef4444');
    if (c.spoilerStyle !== 'none') {
      px(ctx, ox + 15, dirIdx === 0 ? 6 : 29, 10, 3, c.secondaryColor);
    }
  } else {
    const left = dirIdx === 2;
    px(ctx, ox + 7, 24, 9, 9, wheel.tire);
    px(ctx, ox + 9, 26, 5, 5, wheel.rim);
    px(ctx, ox + 24, 24, 9, 9, wheel.tire);
    px(ctx, ox + 26, 26, 5, 5, wheel.rim);

    px(ctx, ox + 9, 19, 22, 8, '#0f172a');
    px(ctx, ox + 10, 20, 20, 6, c.paintColor);
    if (isMoto) {
      px(ctx, ox + (left ? 11 : 21), 15, 8, 6, c.secondaryColor);
    }
    if (c.decalStyle === 'side_bolt' || c.decalStyle === 'two_tone') {
      px(ctx, ox + 12, 22, 16, 2, c.secondaryColor);
    }

    px(ctx, ox + (left ? 11 : 25), 10, 4, 12, '#cbd5e1');
    px(ctx, ox + (left ? 8 : 28), 11, 4, 4, headlight);
    px(ctx, ox + (left ? 19 : 11), 15, 10, 5, '#1e293b');
    if (c.spoilerStyle !== 'none') {
      px(ctx, ox + (left ? 27 : 9), 15, 4, 3, c.secondaryColor);
    }
  }
}

function drawCarFrame(
  ctx: CanvasRenderingContext2D,
  ox: number,
  dirIdx: number,
  modelId: VehicleModelId,
  c: VehicleCustomization,
): void {
  const bodyHex = c.paintColor;
  const roofHex = c.secondaryColor || shadeHex(bodyHex, 32);
  const darkTrim = shadeHex(bodyHex, -42);
  const headlight = getHeadlightColor(c.headlightStyle);
  const wheel = getWheelColors(c.wheelStyle);

  const isCompact = modelId === 'compact';
  const isCoupe = modelId === 'coupe' || modelId === 'interceptor';
  const isInterceptor = modelId === 'interceptor';
  const isHeavy = modelId === 'suv' || modelId === 'van' || modelId === 'bus' || modelId === 'pickup';
  const isBus = modelId === 'bus';
  const isPickup = modelId === 'pickup';
  const isPolice = modelId === 'police';
  const isTaxi = modelId === 'taxi';

  if (dirIdx === 0 || dirIdx === 1) {
    const bodyW = isBus ? 44 : isHeavy || isInterceptor ? 42 : isCoupe ? 40 : isCompact ? 34 : 38;
    const bodyX = Math.floor((64 - bodyW) / 2);
    const bodyY = isBus ? 2 : isCompact ? 6 : 4;
    const bodyH = isBus ? 42 : isInterceptor ? 40 : isCompact ? 34 : 38;

    px(ctx, ox + bodyX - 2, 38, bodyW + 4, 7, isInterceptor ? 'rgba(56, 189, 248, 0.32)' : 'rgba(15, 23, 42, 0.34)');

    px(ctx, ox + bodyX - 2, 10, 4, 10, wheel.tire);
    px(ctx, ox + bodyX + bodyW - 2, 10, 4, 10, wheel.tire);
    px(ctx, ox + bodyX - 2, 27, 4, 10, wheel.tire);
    px(ctx, ox + bodyX + bodyW - 2, 27, 4, 10, wheel.tire);
    px(ctx, ox + bodyX - 2, 13, 2, 4, wheel.rim);
    px(ctx, ox + bodyX + bodyW, 13, 2, 4, wheel.rim);
    px(ctx, ox + bodyX - 2, 30, 2, 4, wheel.rim);
    px(ctx, ox + bodyX + bodyW, 30, 2, 4, wheel.rim);

    px(ctx, ox + bodyX, bodyY, bodyW, bodyH, '#0f172a');
    px(ctx, ox + bodyX + 2, bodyY + 2, bodyW - 4, bodyH - 4, bodyHex);

    if (c.decalStyle === 'two_tone' || isPolice) {
      px(ctx, ox + bodyX + 2, dirIdx === 0 ? bodyY + bodyH - 12 : bodyY + 2, bodyW - 4, 10, roofHex);
    }

    const roofY = isBus ? 6 : isCompact ? 12 : 13;
    const roofH = isBus ? 30 : isPickup ? 12 : isHeavy ? 21 : isCompact ? 15 : 17;
    px(ctx, ox + bodyX + 4, roofY, bodyW - 8, roofH, darkTrim);
    px(ctx, ox + bodyX + 5, roofY + 1, bodyW - 10, roofH - 2, isCoupe ? '#0f172a' : roofHex);

    if (isPickup) {
      const bedY = dirIdx === 0 ? bodyY + 4 : bodyY + bodyH - 15;
      px(ctx, ox + bodyX + 5, bedY, bodyW - 10, 10, '#1e293b');
    }

    if (isPolice) {
      px(ctx, ox + 22, roofY + 5, 9, 4, '#3b82f6');
      px(ctx, ox + 33, roofY + 5, 9, 4, '#ef4444');
    } else if (isTaxi) {
      px(ctx, ox + 25, roofY + 5, 14, 4, '#facc15');
    }

    px(ctx, ox + bodyX + 5, dirIdx === 0 ? roofY + roofH - 8 : roofY - 3, bodyW - 10, 7, '#7dd3fc');
    px(ctx, ox + bodyX + 6, dirIdx === 0 ? roofY - 3 : roofY + roofH - 6, bodyW - 12, 5, '#38bdf8');

    if (c.decalStyle === 'racing_stripe') {
      px(ctx, ox + 28, bodyY + 2, 3, bodyH - 4, '#f8fafc');
      px(ctx, ox + 33, bodyY + 2, 3, bodyH - 4, '#f8fafc');
    } else if (c.decalStyle === 'side_bolt') {
      px(ctx, ox + bodyX + 3, bodyY + 5, 3, bodyH - 10, '#fde047');
      px(ctx, ox + bodyX + bodyW - 6, bodyY + 5, 3, bodyH - 10, '#fde047');
    }

    if (c.spoilerStyle !== 'none') {
      const spY = dirIdx === 0 ? bodyY + 1 : bodyY + bodyH - 5;
      px(ctx, ox + bodyX - 1, spY - 1, bodyW + 2, 5, '#0f172a');
      px(ctx, ox + bodyX, spY, bodyW, 3, roofHex);
    }

    const frontY = dirIdx === 0 ? bodyY + bodyH - 5 : bodyY + 2;
    const tailY = dirIdx === 0 ? bodyY + 2 : bodyY + bodyH - 5;
    px(ctx, ox + bodyX + 3, frontY, 6, 3, headlight);
    px(ctx, ox + bodyX + bodyW - 9, frontY, 6, 3, headlight);
    px(ctx, ox + bodyX + 3, tailY, 6, 3, '#ef4444');
    px(ctx, ox + bodyX + bodyW - 9, tailY, 6, 3, '#ef4444');
  } else {
    const facingLeft = dirIdx === 2;
    const len = isBus ? 60 : isCompact ? 48 : 56;
    const startX = Math.floor((64 - len) / 2);

    px(ctx, ox + startX, 36, len, 7, 'rgba(15, 23, 42, 0.34)');

    const bodyTop = isHeavy ? 14 : isCoupe ? 19 : 18;
    const bodyH = isHeavy ? 20 : isCoupe ? 16 : 17;
    px(ctx, ox + startX, bodyTop, len, bodyH, '#0f172a');
    px(ctx, ox + startX + 2, bodyTop + 2, len - 4, bodyH - 4, bodyHex);

    if (c.decalStyle === 'two_tone' || isPolice) {
      px(ctx, ox + startX + 2, bodyTop + bodyH - 6, len - 4, 4, roofHex);
    }

    const cabW = isBus ? 50 : isPickup ? 24 : isHeavy ? 42 : isCoupe ? 30 : isCompact ? 30 : 36;
    const cabX = isPickup
      ? facingLeft
        ? startX + 10
        : startX + len - 34
      : facingLeft
        ? startX + Math.floor((len - cabW) * 0.65)
        : startX + Math.floor((len - cabW) * 0.35);
    const cabY = isHeavy ? 7 : isCoupe ? 10 : 9;
    px(ctx, ox + cabX, cabY, cabW, 11, '#0f172a');
    px(ctx, ox + cabX + 2, cabY + 2, cabW - 4, 8, isCoupe ? darkTrim : roofHex);
    px(ctx, ox + cabX + 4, cabY + 4, Math.floor((cabW - 10) / 2), 5, '#7dd3fc');
    px(ctx, ox + cabX + 6 + Math.floor((cabW - 10) / 2), cabY + 4, Math.floor((cabW - 10) / 2), 5, '#7dd3fc');

    if (isPolice) {
      px(ctx, ox + cabX + Math.floor(cabW / 2) - 5, cabY - 3, 5, 4, '#3b82f6');
      px(ctx, ox + cabX + Math.floor(cabW / 2), cabY - 3, 5, 4, '#ef4444');
    } else if (isTaxi) {
      px(ctx, ox + cabX + Math.floor(cabW / 2) - 5, cabY - 3, 10, 4, '#facc15');
    }

    if (c.decalStyle === 'racing_stripe') {
      px(ctx, ox + startX + 3, bodyTop + 6, len - 6, 3, '#f8fafc');
    } else if (c.decalStyle === 'side_bolt') {
      px(ctx, ox + startX + 8, bodyTop + 6, len - 16, 2, '#fde047');
    }

    if (c.spoilerStyle !== 'none') {
      const rearX = facingLeft ? startX + len - 9 : startX + 2;
      px(ctx, ox + rearX, bodyTop - 4, 7, 4, '#0f172a');
      px(ctx, ox + rearX + 1, bodyTop - 3, 5, 2, roofHex);
    }

    const w1X = startX + 5;
    const w2X = startX + len - 16;
    for (const wx of [w1X, w2X]) {
      px(ctx, ox + wx, 30, 11, 10, wheel.tire);
      px(ctx, ox + wx + 2, 32, 7, 6, wheel.rim);
      px(ctx, ox + wx + 4, 34, 3, 2, wheel.accent);
    }

    const headX = facingLeft ? startX + 1 : startX + len - 6;
    const tailX = facingLeft ? startX + len - 5 : startX + 1;
    px(ctx, ox + headX, bodyTop + 3, 5, 4, headlight);
    px(ctx, ox + tailX, bodyTop + 3, 4, 4, '#ef4444');
  }
}

export function getVehicleCustomizationKey(
  modelId: VehicleModelId,
  c: VehicleCustomization,
): string {
  const raw = `${modelId}_${c.paintColor}_${c.secondaryColor}_${c.wheelStyle}_${c.spoilerStyle}_${c.decalStyle}_${c.headlightStyle}`;
  return `veh_custom_${raw.replace(/[^a-zA-Z0-9_]/g, '')}`;
}

export function ensureCustomVehicleTexture(
  scene: Phaser.Scene,
  textureKey: string,
  modelId: VehicleModelId,
  c: VehicleCustomization,
): string {
  if (scene.textures.exists(textureKey)) {
    return textureKey;
  }
  const spec = getVehicleModelSpec(modelId);
  const frameW = spec.isScooter ? 40 : 64;
  const frameH = spec.isScooter ? 40 : 48;
  const tex = scene.textures.createCanvas(textureKey, frameW * 4, frameH);
  if (!tex) return textureKey;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, frameW * 4, frameH);

  for (let d = 0; d < 4; d++) {
    const ox = d * frameW;
    if (spec.isScooter) {
      drawScooterFrame(ctx, ox, d, c, modelId === 'motorcycle');
    } else {
      drawCarFrame(ctx, ox, d, modelId, c);
    }
    tex.add(String(d), 0, ox, 0, frameW, frameH);
  }
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return textureKey;
}

const DIR_TO_IDX: Record<Direction, number> = {
  down: 0,
  up: 1,
  left: 2,
  right: 3,
};

export function renderVehiclePreviewDataUrl(
  modelId: VehicleModelId,
  c: VehicleCustomization,
  dir: Direction = 'right',
): string {
  if (typeof document === 'undefined') return '';
  const spec = getVehicleModelSpec(modelId);
  const frameW = spec.isScooter ? 40 : 64;
  const frameH = spec.isScooter ? 40 : 48;

  const off = document.createElement('canvas');
  off.width = frameW;
  off.height = frameH;
  const octx = off.getContext('2d');
  if (!octx) return '';
  octx.imageSmoothingEnabled = false;

  const dirIdx = DIR_TO_IDX[dir] ?? 3;
  if (spec.isScooter) {
    drawScooterFrame(octx, 0, dirIdx, c, modelId === 'motorcycle');
  } else {
    drawCarFrame(octx, 0, dirIdx, modelId, c);
  }

  const out = document.createElement('canvas');
  out.width = frameW * 3;
  out.height = frameH * 3;
  const ctx = out.getContext('2d');
  if (!ctx) return off.toDataURL();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off, 0, 0, frameW, frameH, 0, 0, out.width, out.height);
  return out.toDataURL();
}
