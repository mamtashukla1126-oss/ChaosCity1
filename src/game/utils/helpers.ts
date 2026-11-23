export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

export function distanceSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function sanitizeDisplayName(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  if (!cleaned) return 'Explorer';
  return cleaned.slice(0, 16);
}

export function formatCoords(x: number, y: number): string {
  return `${Math.round(x)}, ${Math.round(y)}`;
}
