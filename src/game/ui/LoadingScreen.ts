import {GAME_TAGLINE, GAME_VERSION} from '@/src/config/constants';

export interface LoadingScreenCallbacks {
  onRetryCloud?: () => void;
  onContinueOffline?: () => void;
}

export class LoadingScreen {
  private readonly root: HTMLDivElement;
  private readonly barFill: HTMLDivElement;
  private readonly pctEl: HTMLElement;
  private readonly stageEl: HTMLElement;
  private readonly subStatusEl: HTMLElement;
  private readonly errorPanel: HTMLDivElement;
  private readonly errorTextEl: HTMLElement;
  private readonly retryBtn: HTMLButtonElement;
  private readonly offlineBtn: HTMLButtonElement;
  private destroyed = false;

  constructor(
    parent: HTMLElement,
    private readonly callbacks: LoadingScreenCallbacks = {},
  ) {
    this.root = document.createElement('div');
    this.root.id = 'cc-novacore-loader';
    this.root.className =
      'ui-interactive fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050a14] text-slate-100 p-4 sm:p-6 overflow-y-auto transition-opacity duration-300';

    this.root.innerHTML = `
      <div class="w-full max-w-lg flex flex-col items-center text-center gap-3 sm:gap-5 my-auto">
        <!-- Studio Mark + Presenter Line -->
        <div class="flex flex-col items-center gap-2">
          <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#0b1528] border border-sky-400/40 shadow-[0_0_28px_rgba(56,189,248,0.2)] flex items-center justify-center">
            <svg viewBox="0 0 48 48" class="w-8 h-8 sm:w-9 sm:h-9" aria-hidden="true">
              <defs>
                <linearGradient id="ncCoreGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#7dd3fc" />
                  <stop offset="55%" stop-color="#38bdf8" />
                  <stop offset="100%" stop-color="#0284c7" />
                </linearGradient>
              </defs>
              <polygon points="24,4 42,14 42,34 24,44 6,34 6,14" fill="none" stroke="url(#ncCoreGrad)" stroke-width="2.5" stroke-linejoin="round" />
              <polygon points="24,11 35,18 35,30 24,37 13,30 13,18" fill="#0f2544" stroke="#fbbf24" stroke-width="1.6" stroke-linejoin="round" />
              <circle cx="24" cy="24" r="4" fill="#38bdf8" />
            </svg>
          </div>
          <div class="font-display text-[11px] sm:text-xs font-bold tracking-[0.34em] text-sky-300 uppercase">
            NOVACORE GAMES PRESENTS
          </div>
        </div>

        <!-- CHAOS CITY Display Emblem -->
        <div class="w-full flex flex-col items-center">
          <svg viewBox="0 0 460 72" class="w-full max-w-[330px] sm:max-w-[400px] h-auto drop-shadow-[0_6px_22px_rgba(14,165,233,0.28)]" role="img" aria-label="CHAOS CITY">
            <defs>
              <linearGradient id="ccLoaderGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#f8fafc" />
                <stop offset="55%" stop-color="#bae6fd" />
                <stop offset="100%" stop-color="#38bdf8" />
              </linearGradient>
            </defs>
            <rect x="6" y="10" width="8" height="50" fill="#fbbf24" rx="2" />
            <text x="26" y="54" font-family="Outfit, sans-serif" font-weight="800" font-size="50" letter-spacing="3.5" fill="url(#ccLoaderGrad)">CHAOS CITY</text>
          </svg>
          <p class="font-display text-[11px] sm:text-xs font-semibold tracking-[0.22em] text-slate-400 mt-1">
            ${GAME_TAGLINE} · ${GAME_VERSION}
          </p>
        </div>

        <!-- Real Progress Panel -->
        <div class="w-full max-w-md rounded-2xl bg-[#0a1324] border border-[#1d3158] px-4 py-3.5 sm:px-5 sm:py-4 shadow-xl space-y-2.5 text-left">
          <div class="flex items-center justify-between gap-2 text-xs">
            <span id="cc-load-stage" class="font-semibold text-slate-100 truncate">
              Initializing CHAOS CITY systems...
            </span>
            <span id="cc-load-pct" class="font-mono-tabular font-bold text-sky-300 shrink-0">
              0%
            </span>
          </div>

          <div class="w-full h-2.5 rounded-full bg-[#050a14] border border-[#1c2d50] overflow-hidden">
            <div
              id="cc-load-fill"
              class="h-full rounded-full bg-gradient-to-r from-sky-500 via-sky-300 to-amber-300 transition-[width] duration-150 ease-out"
              style="width: 0%"
            ></div>
          </div>

          <div class="flex items-center justify-between gap-2 text-[11px] font-mono-tabular text-slate-400">
            <span id="cc-load-sub" class="truncate">Preparing city world & pixel engine</span>
            <span class="text-slate-500 shrink-0">11 DISTRICTS · 35 VENUES</span>
          </div>
        </div>

        <!-- Real Error / Timeout Recovery Panel -->
        <div
          id="cc-load-error"
          class="hidden w-full max-w-md rounded-2xl bg-rose-950/40 border border-rose-400/50 px-4 py-3 text-left space-y-2.5"
        >
          <div class="text-xs font-bold text-rose-200 uppercase tracking-wider">
            Cloud Sync Notice
          </div>
          <p id="cc-load-error-msg" class="text-xs text-rose-100/90 leading-relaxed"></p>
          <div class="flex flex-wrap gap-2 pt-0.5">
            <button
              id="cc-load-retry"
              type="button"
              class="cc-btn-primary px-4 py-2 rounded-xl text-xs font-bold min-h-[40px] cursor-pointer"
            >
              Retry Cloud Load
            </button>
            <button
              id="cc-load-offline"
              type="button"
              class="cc-btn-secondary px-4 py-2 rounded-xl text-xs font-semibold min-h-[40px] cursor-pointer"
            >
              Continue Offline
            </button>
          </div>
        </div>
      </div>
    `;

    parent.appendChild(this.root);

    this.barFill = this.root.querySelector('#cc-load-fill') as HTMLDivElement;
    this.pctEl = this.root.querySelector('#cc-load-pct') as HTMLElement;
    this.stageEl = this.root.querySelector('#cc-load-stage') as HTMLElement;
    this.subStatusEl = this.root.querySelector('#cc-load-sub') as HTMLElement;
    this.errorPanel = this.root.querySelector('#cc-load-error') as HTMLDivElement;
    this.errorTextEl = this.root.querySelector('#cc-load-error-msg') as HTMLElement;
    this.retryBtn = this.root.querySelector('#cc-load-retry') as HTMLButtonElement;
    this.offlineBtn = this.root.querySelector('#cc-load-offline') as HTMLButtonElement;

    this.retryBtn.addEventListener('click', () => {
      this.hideError();
      this.callbacks.onRetryCloud?.();
    });
    this.offlineBtn.addEventListener('click', () => {
      this.hideError();
      this.callbacks.onContinueOffline?.();
    });
  }

  public setProgress(percent: number, stageLabel: string, subLabel?: string): void {
    if (this.destroyed) return;
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    this.barFill.style.width = `${clamped}%`;
    this.pctEl.textContent = `${clamped}%`;
    this.stageEl.textContent = stageLabel;
    if (subLabel !== undefined) {
      this.subStatusEl.textContent = subLabel;
    }
  }

  public showError(message: string, allowRetry = true): void {
    if (this.destroyed) return;
    this.errorTextEl.textContent = message;
    this.retryBtn.classList.toggle('hidden', !allowRetry);
    this.errorPanel.classList.remove('hidden');
  }

  public hideError(): void {
    if (this.destroyed) return;
    this.errorPanel.classList.add('hidden');
  }

  public async fadeOutAndDestroy(): Promise<void> {
    if (this.destroyed) return;
    this.root.style.opacity = '0';
    this.root.style.pointerEvents = 'none';
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 240);
    });
    this.destroy();
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.root.remove();
  }
}
