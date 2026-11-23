import {JOYSTICK_DEAD_ZONE} from '@/src/config/constants';
import {clamp} from '@/src/game/utils/helpers';

export class VirtualJoystick {
  private readonly rootEl: HTMLDivElement;
  private readonly baseEl: HTMLDivElement;
  private readonly knobEl: HTMLDivElement;
  private readonly glowEl: HTMLDivElement;

  private activePointerId: number | null = null;
  private centerX = 0;
  private centerY = 0;
  private maxRadius = 46;
  private sensitivity = 1.0;

  public vectorX = 0;
  public vectorY = 0;

  constructor(parent: HTMLElement) {
    this.rootEl = document.createElement('div');
    this.rootEl.className =
      'ui-interactive relative w-36 h-36 flex items-center justify-center touch-none select-none';
    this.rootEl.setAttribute('aria-label', 'Movement joystick');

    this.baseEl = document.createElement('div');
    this.baseEl.className =
      'relative w-28 h-28 rounded-full bg-[#0b1221]/80 border-2 border-sky-400/50 shadow-lg flex items-center justify-center';

    this.glowEl = document.createElement('div');
    this.glowEl.className =
      'absolute inset-1 rounded-full border border-sky-300/20 pointer-events-none transition-opacity duration-150 opacity-0';

    // Subtle directional ticks on base
    const ticks = document.createElement('div');
    ticks.className = 'absolute inset-0 pointer-events-none';
    ticks.innerHTML = `
      <span class="absolute top-1.5 left-1/2 -translate-x-1/2 w-1 h-2 bg-sky-300/40 rounded-full"></span>
      <span class="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-2 bg-sky-300/40 rounded-full"></span>
      <span class="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-1 bg-sky-300/40 rounded-full"></span>
      <span class="absolute right-1.5 top-1/2 -translate-y-1/2 w-2 h-1 bg-sky-300/40 rounded-full"></span>
    `;

    this.knobEl = document.createElement('div');
    this.knobEl.className =
      'w-12 h-12 rounded-full bg-gradient-to-b from-sky-300 to-sky-500 border-2 border-white/90 shadow-md pointer-events-none transition-transform duration-75';

    this.baseEl.appendChild(this.glowEl);
    this.baseEl.appendChild(ticks);
    this.baseEl.appendChild(this.knobEl);
    this.rootEl.appendChild(this.baseEl);
    parent.appendChild(this.rootEl);

    this.rootEl.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
  }

  public setSensitivity(val: number): void {
    this.sensitivity = clamp(val, 0.6, 1.8);
  }

  public setScale(scale: number): void {
    const s = clamp(scale, 0.75, 1.35);
    this.rootEl.style.transform = `scale(${s.toFixed(2)})`;
    this.rootEl.style.transformOrigin = 'center center';
  }

  public setVisible(visible: boolean): void {
    this.rootEl.style.display = visible ? 'flex' : 'none';
    if (!visible) this.reset();
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.activePointerId !== null) return;
    e.preventDefault();
    e.stopPropagation();

    this.activePointerId = e.pointerId;
    const rect = this.baseEl.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;
    this.maxRadius = rect.width * 0.4;
    this.glowEl.style.opacity = '1';
    this.knobEl.style.transitionDuration = '0ms';

    this.updateKnobFromPointer(e.clientX, e.clientY);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.activePointerId !== e.pointerId) return;
    e.preventDefault();
    this.updateKnobFromPointer(e.clientX, e.clientY);
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.activePointerId !== e.pointerId) return;
    this.reset();
  };

  private updateKnobFromPointer(clientX: number, clientY: number): void {
    const dx = clientX - this.centerX;
    const dy = clientY - this.centerY;
    const dist = Math.hypot(dx, dy);

    const clampedDist = Math.min(dist, this.maxRadius);
    const angle = Math.atan2(dy, dx);
    const knobX = dist > 0 ? Math.cos(angle) * clampedDist : 0;
    const knobY = dist > 0 ? Math.sin(angle) * clampedDist : 0;

    this.knobEl.style.transform = `translate(${knobX.toFixed(1)}px, ${knobY.toFixed(1)}px)`;

    const norm = clamp((dist / this.maxRadius) * this.sensitivity, 0, 1);
    if (norm < JOYSTICK_DEAD_ZONE) {
      this.vectorX = 0;
      this.vectorY = 0;
    } else {
      const scaled = (norm - JOYSTICK_DEAD_ZONE) / (1 - JOYSTICK_DEAD_ZONE);
      this.vectorX = Math.cos(angle) * scaled;
      this.vectorY = Math.sin(angle) * scaled;
    }
  }

  public reset(): void {
    this.activePointerId = null;
    this.vectorX = 0;
    this.vectorY = 0;
    this.glowEl.style.opacity = '0';
    this.knobEl.style.transitionDuration = '110ms';
    this.knobEl.style.transform = 'translate(0px, 0px)';
  }

  public destroy(): void {
    this.rootEl.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.rootEl.remove();
  }
}
