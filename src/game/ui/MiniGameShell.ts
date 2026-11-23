import {audioSystem} from '@/src/game/systems/AudioSystem';

export type MiniGameControlLayout = 'none' | 'left-right' | 'up-down' | 'dpad' | 'action-only';

export type MiniGamePhase = 'ready' | 'playing' | 'paused' | 'finished';

export interface MiniGameInputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  action: boolean;
  secondary: boolean;
}

export interface MiniGameCustomButton {
  id: string;
  label: string;
  keyHint?: string;
  accentClass?: string;
  onPress: () => void;
}

export interface MiniGameShellResult {
  headline: string;
  summary: string;
  rewardText?: string;
  badge?: string;
}

export interface MiniGameShellConfig {
  title: string;
  subtitle?: string;
  accentColor?: 'sky' | 'amber' | 'emerald' | 'rose' | 'violet';
  canvasWidth: number;
  canvasHeight: number;
  controls: MiniGameControlLayout;
  actionLabel?: string;
  secondaryLabel?: string;
  startPrompt?: string;
  startHint?: string;
  autoStart?: boolean;
  customButtons?: MiniGameCustomButton[];
  onStart?: () => void;
  onRestart?: () => void;
  onUpdate: (dt: number, input: Readonly<MiniGameInputState>, shell: MiniGameShellHandle) => void;
  onRender: (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    phase: MiniGamePhase,
    shell: MiniGameShellHandle,
  ) => void;
  onActionPress?: (shell: MiniGameShellHandle) => void;
  onSecondaryPress?: (shell: MiniGameShellHandle) => void;
  onCanvasPointerDown?: (canvasX: number, canvasY: number, shell: MiniGameShellHandle) => void;
  onClose?: () => void;
}

export interface MiniGameShellHandle {
  setStats: (html: string) => void;
  setPhase: (phase: MiniGamePhase) => void;
  finish: (result: MiniGameShellResult) => void;
  getPhase: () => MiniGamePhase;
  close: (quiet?: boolean) => void;
}

const ACCENT_BORDER: Record<NonNullable<MiniGameShellConfig['accentColor']>, string> = {
  sky: 'border-sky-500/40',
  amber: 'border-amber-500/40',
  emerald: 'border-emerald-500/40',
  rose: 'border-rose-500/40',
  violet: 'border-violet-500/40',
};

const ACCENT_BTN: Record<NonNullable<MiniGameShellConfig['accentColor']>, string> = {
  sky: 'bg-sky-500 hover:bg-sky-400 text-slate-950',
  amber: 'bg-amber-400 hover:bg-amber-300 text-slate-950',
  emerald: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950',
  rose: 'bg-rose-500 hover:bg-rose-400 text-white',
  violet: 'bg-violet-500 hover:bg-violet-400 text-white',
};

export function createMiniGameShell(
  parent: HTMLElement,
  config: MiniGameShellConfig,
): MiniGameShellHandle {
  const accent = config.accentColor ?? 'sky';
  let phase: MiniGamePhase = config.autoStart ? 'playing' : 'ready';
  let closed = false;
  let rafId = 0;
  let lastTs = performance.now();

  const touchInput: MiniGameInputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    action: false,
    secondary: false,
  };
  const keyInput: MiniGameInputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    action: false,
    secondary: false,
  };
  const combinedInput: MiniGameInputState = {
    left: false,
    right: false,
    up: false,
    down: false,
    action: false,
    secondary: false,
  };

  const buttonElements = new Map<keyof MiniGameInputState, HTMLButtonElement>();

  const syncCombined = () => {
    combinedInput.left = touchInput.left || keyInput.left;
    combinedInput.right = touchInput.right || keyInput.right;
    combinedInput.up = touchInput.up || keyInput.up;
    combinedInput.down = touchInput.down || keyInput.down;
    combinedInput.action = touchInput.action || keyInput.action;
    combinedInput.secondary = touchInput.secondary || keyInput.secondary;

    for (const [key, btn] of buttonElements.entries()) {
      if (combinedInput[key]) {
        btn.classList.add('ring-2', 'ring-white', 'scale-95', 'brightness-125');
      } else {
        btn.classList.remove('ring-2', 'ring-white', 'scale-95', 'brightness-125');
      }
    }
  };

  const releaseAllInputs = () => {
    (Object.keys(touchInput) as Array<keyof MiniGameInputState>).forEach((k) => {
      touchInput[k] = false;
      keyInput[k] = false;
    });
    syncCombined();
  };

  const backdrop = document.createElement('div');
  backdrop.className =
    'ui-interactive fixed inset-0 z-40 flex items-center justify-center bg-slate-950/82 backdrop-blur-sm p-1.5 sm:p-3';
  backdrop.dataset.minigameShell = 'true';

  const card = document.createElement('div');
  card.className = `w-full max-w-2xl max-h-[94dvh] flex flex-col overflow-hidden rounded-2xl border ${ACCENT_BORDER[accent]} bg-[#0b1220] text-slate-100 shadow-2xl select-none`;

  // Compact Header Bar
  const header = document.createElement('div');
  header.className =
    'shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 sm:py-2 border-b border-slate-800/90 bg-slate-900/80';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'min-w-0 flex items-center gap-2';
  const titleEl = document.createElement('h3');
  titleEl.className = 'text-xs sm:text-sm font-black tracking-wide text-white truncate';
  titleEl.textContent = config.title;
  titleWrap.appendChild(titleEl);
  if (config.subtitle) {
    const subEl = document.createElement('span');
    subEl.className =
      'hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate';
    subEl.textContent = config.subtitle;
    titleWrap.appendChild(subEl);
  }

  const statsEl = document.createElement('div');
  statsEl.className = 'flex items-center gap-2 text-[11px] sm:text-xs font-bold text-slate-200';

  const headerBtns = document.createElement('div');
  headerBtns.className = 'shrink-0 flex items-center gap-1';

  const pauseBtn = document.createElement('button');
  pauseBtn.type = 'button';
  pauseBtn.className =
    'px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] sm:text-xs font-bold text-slate-200 border border-slate-700 transition';
  pauseBtn.textContent = 'Pause';

  const restartBtn = document.createElement('button');
  restartBtn.type = 'button';
  restartBtn.className =
    'px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] sm:text-xs font-bold text-slate-200 border border-slate-700 transition';
  restartBtn.textContent = 'Restart';

  const exitBtn = document.createElement('button');
  exitBtn.type = 'button';
  exitBtn.className =
    'px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 text-[10px] sm:text-xs font-bold text-rose-200 border border-rose-500/40 transition';
  exitBtn.textContent = 'Exit';

  headerBtns.append(pauseBtn, restartBtn, exitBtn);
  header.append(titleWrap, statsEl, headerBtns);

  // Canvas Stage (strictly bounded, never overflows small viewports)
  const stage = document.createElement('div');
  stage.className =
    'flex-1 min-h-0 flex items-center justify-center relative bg-[#040711] p-1 sm:p-2 overflow-hidden';

  const canvas = document.createElement('canvas');
  canvas.width = config.canvasWidth;
  canvas.height = config.canvasHeight;
  canvas.className =
    'max-h-full max-w-full w-auto h-auto object-contain block rounded-lg border border-slate-800/80 bg-[#040711]';
  const ctx = canvas.getContext('2d');

  // Overlay for Ready / Paused / Result screens
  const overlay = document.createElement('div');
  overlay.className =
    'absolute inset-0 flex items-center justify-center bg-slate-950/78 backdrop-blur-[2px] p-3';

  const renderOverlay = (result?: MiniGameShellResult) => {
    if (phase === 'playing') {
      overlay.classList.add('hidden');
      pauseBtn.textContent = 'Pause';
      return;
    }
    overlay.classList.remove('hidden');
    pauseBtn.textContent = phase === 'paused' ? 'Resume' : 'Pause';

    if (phase === 'ready') {
      overlay.innerHTML = `
        <div class="max-w-sm w-full rounded-xl border border-slate-700/80 bg-slate-900/95 p-3 sm:p-4 text-center space-y-2 shadow-xl">
          <p class="text-sm sm:text-base font-black text-white">${config.title}</p>
          <p class="text-xs text-slate-300 leading-relaxed">${config.startPrompt ?? 'Ready to play!'}</p>
          ${config.startHint ? `<p class="text-[11px] font-semibold text-sky-300">${config.startHint}</p>` : ''}
          <div class="flex gap-2 justify-center pt-1">
            <button type="button" data-shell-cta="start" class="px-4 py-1.5 rounded-lg text-xs font-black ${ACCENT_BTN[accent]} shadow-md transition">PLAY NOW</button>
            <button type="button" data-shell-cta="exit" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition">EXIT</button>
          </div>
        </div>
      `;
    } else if (phase === 'paused') {
      overlay.innerHTML = `
        <div class="max-w-xs w-full rounded-xl border border-slate-700/80 bg-slate-900/95 p-3 sm:p-4 text-center space-y-2.5 shadow-xl">
          <p class="text-sm sm:text-base font-black text-white">GAME PAUSED</p>
          <div class="flex flex-col gap-1.5">
            <button type="button" data-shell-cta="resume" class="w-full py-1.5 rounded-lg text-xs font-black ${ACCENT_BTN[accent]} transition">RESUME</button>
            <button type="button" data-shell-cta="restart" class="w-full py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition">RESTART</button>
            <button type="button" data-shell-cta="exit" class="w-full py-1.5 rounded-lg text-xs font-bold bg-rose-500/20 hover:bg-rose-500/35 text-rose-200 border border-rose-500/40 transition">EXIT TO CITY</button>
          </div>
        </div>
      `;
    } else if (phase === 'finished') {
      const r = result ?? {
        headline: 'Round Complete!',
        summary: 'Great effort out there.',
      };
      overlay.innerHTML = `
        <div class="max-w-sm w-full rounded-xl border border-slate-700/80 bg-slate-900/95 p-3 sm:p-4 text-center space-y-2 shadow-xl">
          ${r.badge ? `<div class="inline-block px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-[10px] font-black uppercase tracking-wider text-amber-300">${r.badge}</div>` : ''}
          <p class="text-sm sm:text-base font-black text-white">${r.headline}</p>
          <p class="text-xs text-slate-300">${r.summary}</p>
          ${r.rewardText ? `<p class="text-xs font-extrabold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded-lg py-1 px-2">${r.rewardText}</p>` : ''}
          <div class="flex gap-2 justify-center pt-1">
            <button type="button" data-shell-cta="restart" class="px-4 py-1.5 rounded-lg text-xs font-black ${ACCENT_BTN[accent]} shadow-md transition">PLAY AGAIN</button>
            <button type="button" data-shell-cta="exit" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition">EXIT</button>
          </div>
        </div>
      `;
    }

    overlay.querySelector('[data-shell-cta="start"]')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      phase = 'playing';
      config.onStart?.();
      renderOverlay();
    });
    overlay.querySelector('[data-shell-cta="resume"]')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      phase = 'playing';
      renderOverlay();
    });
    overlay.querySelector('[data-shell-cta="restart"]')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      releaseAllInputs();
      config.onRestart?.();
      phase = 'playing';
      renderOverlay();
    });
    overlay.querySelector('[data-shell-cta="exit"]')?.addEventListener('click', () => {
      handle.close();
    });
  };

  stage.append(canvas, overlay);

  // Compact Control Strip (mounts ONLY requested buttons)
  const controlsBar = document.createElement('div');
  const hasButtons = config.controls !== 'none' || (config.customButtons && config.customButtons.length > 0);
  controlsBar.className = hasButtons
    ? 'shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 sm:py-2 border-t border-slate-800/90 bg-slate-900/90'
    : 'hidden';

  const makeHoldButton = (
    inputKey: keyof MiniGameInputState,
    label: string,
    extraClass = 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600',
  ): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `px-3 py-1.5 sm:py-2 rounded-xl border text-xs sm:text-sm font-black transition touch-none active:scale-95 ${extraClass}`;
    btn.textContent = label;
    btn.dataset.controlKey = inputKey;

    const down = (e: Event) => {
      e.preventDefault();
      if (phase === 'ready') {
        phase = 'playing';
        config.onStart?.();
        renderOverlay();
      }
      touchInput[inputKey] = true;
      syncCombined();
      if (inputKey === 'action' && phase === 'playing') {
        config.onActionPress?.(handle);
      } else if (inputKey === 'secondary' && phase === 'playing') {
        config.onSecondaryPress?.(handle);
      }
    };
    const up = (e: Event) => {
      e.preventDefault();
      touchInput[inputKey] = false;
      syncCombined();
    };

    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
    buttonElements.set(inputKey, btn);
    return btn;
  };

  if (hasButtons) {
    const leftGroup = document.createElement('div');
    leftGroup.className = 'flex flex-wrap items-center gap-1.5';
    const rightGroup = document.createElement('div');
    rightGroup.className = 'flex items-center gap-1.5 ml-auto';

    if (config.controls === 'left-right') {
      leftGroup.append(
        makeHoldButton('left', '◀ LEFT'),
        makeHoldButton('right', 'RIGHT ▶'),
      );
    } else if (config.controls === 'up-down') {
      leftGroup.append(
        makeHoldButton('up', '▲ UP'),
        makeHoldButton('down', '▼ DOWN'),
      );
    } else if (config.controls === 'dpad') {
      leftGroup.append(
        makeHoldButton('left', '◀'),
        makeHoldButton('up', '▲'),
        makeHoldButton('down', '▼'),
        makeHoldButton('right', '▶'),
      );
    }

    if (config.customButtons?.length) {
      for (const cb of config.customButtons) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className =
          cb.accentClass ??
          'px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-black text-slate-100 active:scale-95 transition';
        b.textContent = cb.label;
        b.addEventListener('click', () => {
          if (phase === 'ready') {
            phase = 'playing';
            config.onStart?.();
            renderOverlay();
          }
          if (phase === 'playing') cb.onPress();
        });
        leftGroup.appendChild(b);
      }
    }

    if (config.secondaryLabel) {
      rightGroup.appendChild(
        makeHoldButton(
          'secondary',
          config.secondaryLabel,
          'bg-slate-700 hover:bg-slate-600 text-white border-slate-500',
        ),
      );
    }
    if (config.actionLabel) {
      rightGroup.appendChild(
        makeHoldButton(
          'action',
          config.actionLabel,
          `${ACCENT_BTN[accent]} border-white/25 min-w-[84px]`,
        ),
      );
    }

    controlsBar.append(leftGroup, rightGroup);
  }

  card.append(header, stage, controlsBar);
  backdrop.appendChild(card);
  parent.appendChild(backdrop);

  const handle: MiniGameShellHandle = {
    setStats(html: string) {
      statsEl.innerHTML = html;
    },
    setPhase(next: MiniGamePhase) {
      phase = next;
      renderOverlay();
    },
    finish(result: MiniGameShellResult) {
      phase = 'finished';
      releaseAllInputs();
      renderOverlay(result);
    },
    getPhase() {
      return phase;
    },
    close(quiet = false) {
      if (closed) return;
      closed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseAllInputs);
      window.removeEventListener('pointerup', onGlobalPointerUp);
      backdrop.remove();
      if (!quiet) {
        audioSystem.playButtonClick();
        config.onClose?.();
      }
    },
  };

  pauseBtn.addEventListener('click', () => {
    audioSystem.playButtonClick();
    if (phase === 'playing') {
      phase = 'paused';
      releaseAllInputs();
      renderOverlay();
    } else if (phase === 'paused') {
      phase = 'playing';
      renderOverlay();
    }
  });

  restartBtn.addEventListener('click', () => {
    audioSystem.playButtonClick();
    releaseAllInputs();
    config.onRestart?.();
    phase = 'playing';
    renderOverlay();
  });

  exitBtn.addEventListener('click', () => {
    handle.close();
  });

  const onGlobalPointerUp = () => {
    if (
      touchInput.left ||
      touchInput.right ||
      touchInput.up ||
      touchInput.down ||
      touchInput.action ||
      touchInput.secondary
    ) {
      touchInput.left = false;
      touchInput.right = false;
      touchInput.up = false;
      touchInput.down = false;
      touchInput.action = false;
      touchInput.secondary = false;
      syncCombined();
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (closed) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handle.close();
      return;
    }
    if (e.key === 'p' || e.key === 'P') {
      e.stopPropagation();
      if (phase === 'playing') {
        phase = 'paused';
        releaseAllInputs();
        renderOverlay();
      } else if (phase === 'paused') {
        phase = 'playing';
        renderOverlay();
      }
      return;
    }

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      e.stopPropagation();
      keyInput.left = true;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      e.stopPropagation();
      keyInput.right = true;
    } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.stopPropagation();
      keyInput.up = true;
    } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      e.stopPropagation();
      keyInput.down = true;
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (phase === 'ready') {
        phase = 'playing';
        config.onStart?.();
        renderOverlay();
        return;
      }
      if (!keyInput.action && phase === 'playing') {
        config.onActionPress?.(handle);
      }
      keyInput.action = true;
    } else if (e.key === 'Shift' || e.key === 'e' || e.key === 'E' || e.key === 'f' || e.key === 'F') {
      e.stopPropagation();
      if (!keyInput.secondary && phase === 'playing') {
        config.onSecondaryPress?.(handle);
      }
      keyInput.secondary = true;
    }
    syncCombined();
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keyInput.left = false;
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keyInput.right = false;
    else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keyInput.up = false;
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') keyInput.down = false;
    else if (e.key === ' ' || e.key === 'Enter') keyInput.action = false;
    else if (e.key === 'Shift' || e.key === 'e' || e.key === 'E' || e.key === 'f' || e.key === 'F') {
      keyInput.secondary = false;
    }
    syncCombined();
  };

  if (config.onCanvasPointerDown) {
    canvas.classList.add('cursor-pointer', 'touch-none');
    canvas.addEventListener('pointerdown', (e) => {
      if (closed || phase !== 'playing') return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const cx = ((e.clientX - rect.left) / rect.width) * config.canvasWidth;
      const cy = ((e.clientY - rect.top) / rect.height) * config.canvasHeight;
      config.onCanvasPointerDown?.(cx, cy, handle);
    });
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAllInputs);
  window.addEventListener('pointerup', onGlobalPointerUp);

  renderOverlay();

  const tick = (now: number) => {
    if (closed) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
    lastTs = now;

    if (phase === 'playing') {
      config.onUpdate(dt, combinedInput, handle);
    }
    if (ctx) {
      config.onRender(ctx, config.canvasWidth, config.canvasHeight, phase, handle);
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  return handle;
}
