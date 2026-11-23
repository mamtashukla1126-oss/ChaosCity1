import {VirtualJoystick} from '@/src/game/input/VirtualJoystick';
import {GameSettings} from '@/src/game/types/gameTypes';

export interface TouchActionCallbacks {
  onInteract: () => void;
  onEmote?: () => void;
  onAnyTouch?: () => void;
}

export class TouchController {
  private readonly container: HTMLDivElement;
  private readonly leftSlot: HTMLDivElement;
  private readonly rightSlot: HTMLDivElement;
  private readonly joystick: VirtualJoystick;
  private readonly emoteBtn: HTMLButtonElement;
  private readonly runBtn: HTMLButtonElement;
  private readonly interactBtn: HTMLButtonElement;

  private runPointerId: number | null = null;
  private isRunningHeld = false;
  private queuedInteract = false;
  private visible = false;

  constructor(parent: HTMLElement, private readonly callbacks: TouchActionCallbacks) {
    this.container = document.createElement('div');
    this.container.className =
      'absolute inset-x-0 bottom-0 flex items-end justify-between px-5 pb-5 pointer-events-none z-20';

    this.leftSlot = document.createElement('div');
    this.leftSlot.className = 'pointer-events-none';
    this.joystick = new VirtualJoystick(this.leftSlot);

    this.rightSlot = document.createElement('div');
    this.rightSlot.className = 'flex items-end gap-2.5 pointer-events-none';

    // Emote quick button
    this.emoteBtn = document.createElement('button');
    this.emoteBtn.type = 'button';
    this.emoteBtn.className =
      'ui-interactive w-12 h-12 rounded-full bg-[#0b1221]/85 border-2 border-amber-400/55 text-amber-200 font-display font-bold text-[10px] tracking-wider shadow-lg flex flex-col items-center justify-center touch-none active:scale-95';
    this.emoteBtn.innerHTML = `<span class="text-sm leading-none">👋</span><span class="text-[9px]">EMOTE</span>`;

    // Run Button (hold to sprint, supports multi-touch alongside joystick)
    this.runBtn = document.createElement('button');
    this.runBtn.type = 'button';
    this.runBtn.className =
      'ui-interactive w-16 h-16 rounded-full bg-[#0b1221]/85 border-2 border-sky-400/55 text-sky-100 font-display font-bold text-xs tracking-wider shadow-lg flex flex-col items-center justify-center gap-0.5 touch-none active:scale-95';
    this.runBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4a1 1 0 1 0 2 0 1 1 0 0 0-2 0"/><path d="M7 21l3-6 3 2 2 4"/><path d="M10 15l2-5 4 2 3-2"/><path d="M6 11l3-3 3 2"/></svg>
      <span>RUN</span>
    `;

    // Interact Button
    this.interactBtn = document.createElement('button');
    this.interactBtn.type = 'button';
    this.interactBtn.className =
      'ui-interactive w-18 h-18 rounded-full bg-[#0b1221]/85 border-2 border-slate-500/60 text-slate-300 font-display font-bold text-xs tracking-wider shadow-lg flex flex-col items-center justify-center gap-0.5 touch-none transition-all duration-150 active:scale-95';
    this.interactBtn.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v6"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>
      <span>USE</span>
    `;

    this.rightSlot.appendChild(this.emoteBtn);
    this.rightSlot.appendChild(this.runBtn);
    this.rightSlot.appendChild(this.interactBtn);
    this.container.appendChild(this.leftSlot);
    this.container.appendChild(this.rightSlot);
    parent.appendChild(this.container);

    this.runBtn.addEventListener('pointerdown', this.onRunDown);
    window.addEventListener('pointerup', this.onRunUp);
    window.addEventListener('pointercancel', this.onRunUp);

    this.interactBtn.addEventListener('pointerdown', this.onInteractDown);
    this.emoteBtn.addEventListener('pointerdown', this.onEmoteDown);
    window.addEventListener('touchstart', this.onFirstTouch, {passive: true});
  }

  private onFirstTouch = (): void => {
    this.callbacks.onAnyTouch?.();
  };

  private onEmoteDown = (e: PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    this.callbacks.onEmote?.();
  };

  private onRunDown = (e: PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    this.runPointerId = e.pointerId;
    this.isRunningHeld = true;
    this.runBtn.classList.add('border-sky-300', 'bg-sky-500/35', 'text-white');
  };

  private onRunUp = (e: PointerEvent): void => {
    if (this.runPointerId !== e.pointerId) return;
    this.runPointerId = null;
    this.isRunningHeld = false;
    this.runBtn.classList.remove('border-sky-300', 'bg-sky-500/35', 'text-white');
  };

  private onInteractDown = (e: PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    this.queuedInteract = true;
    this.callbacks.onInteract();
  };

  public applyLayout(settings: GameSettings): void {
    this.joystick.setSensitivity(settings.joystickSensitivity ?? 1);
    const scale = settings.touchButtonScale ?? 1;
    this.joystick.setScale(scale);

    const swap = settings.joystickSide === 'right';
    this.container.classList.toggle('flex-row-reverse', swap);
    this.container.classList.toggle('flex-row', !swap);

    const jx = settings.joystickOffsetX ?? 0;
    const jy = -(settings.joystickOffsetY ?? 0);
    this.leftSlot.style.transform = `translate(${jx}px, ${jy}px)`;

    const ax = settings.actionOffsetX ?? 0;
    const ay = -(settings.actionOffsetY ?? 0);
    this.rightSlot.style.transform = `translate(${ax}px, ${ay}px) scale(${scale.toFixed(2)})`;
    this.rightSlot.style.transformOrigin = swap ? 'bottom left' : 'bottom right';
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.container.style.display = visible ? 'flex' : 'none';
    this.joystick.setVisible(visible);
    if (!visible) {
      this.reset();
    }
  }

  public setSensitivity(val: number): void {
    this.joystick.setSensitivity(val);
  }

  public setInteractAvailable(available: boolean): void {
    if (available) {
      this.interactBtn.classList.remove('border-slate-500/60', 'text-slate-300', 'bg-[#0b1221]/85');
      this.interactBtn.classList.add(
        'border-sky-300',
        'bg-sky-500',
        'text-[#06101f]',
      );
    } else {
      this.interactBtn.classList.add('border-slate-500/60', 'text-slate-300', 'bg-[#0b1221]/85');
      this.interactBtn.classList.remove(
        'border-sky-300',
        'bg-sky-500',
        'text-[#06101f]',
      );
    }
  }

  public getState(): {moveX: number; moveY: number; isRunning: boolean; interactJustPressed: boolean} {
    const interactJustPressed = this.queuedInteract;
    this.queuedInteract = false;
    if (!this.visible) {
      return {moveX: 0, moveY: 0, isRunning: false, interactJustPressed: false};
    }
    return {
      moveX: this.joystick.vectorX,
      moveY: this.joystick.vectorY,
      isRunning: this.isRunningHeld,
      interactJustPressed,
    };
  }

  public reset(): void {
    this.joystick.reset();
    this.runPointerId = null;
    this.isRunningHeld = false;
    this.queuedInteract = false;
    this.runBtn.classList.remove('border-sky-300', 'bg-sky-500/35', 'text-white');
  }

  public destroy(): void {
    this.runBtn.removeEventListener('pointerdown', this.onRunDown);
    window.removeEventListener('pointerup', this.onRunUp);
    window.removeEventListener('pointercancel', this.onRunUp);
    this.interactBtn.removeEventListener('pointerdown', this.onInteractDown);
    this.emoteBtn.removeEventListener('pointerdown', this.onEmoteDown);
    window.removeEventListener('touchstart', this.onFirstTouch);
    this.joystick.destroy();
    this.container.remove();
  }
}
