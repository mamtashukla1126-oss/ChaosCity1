import {
  detectDevice,
  isFullscreenActive,
  onFullscreenChange,
  toggleFullscreen,
} from '@/src/game/utils/device';

const EXPAND_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`;
const MINIMIZE_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>`;

export class OrientationOverlay {
  private readonly el: HTMLDivElement;
  private readonly fsBtn: HTMLButtonElement;
  private readonly fsNoticeEl: HTMLParagraphElement;
  private unsubFullscreen: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className =
      'ui-interactive fixed inset-0 z-50 hidden flex-col items-center justify-start pt-8 sm:pt-12 bg-[#060b16] px-4 sm:px-6 text-center';
    this.el.innerHTML = `
      <div class="cc-panel rounded-2xl p-5 sm:p-6 max-w-md w-full flex flex-col items-center gap-4">
        <div class="w-full flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center text-sky-400 shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="7" y="2" width="10" height="20" rx="2" />
                <path d="M12 18h.01" />
                <path d="M2 12c0 4 2 7 5 9" />
                <path d="M22 12c0-4-2-7-5-9" />
              </svg>
            </div>
            <h2 class="font-display text-base sm:text-xl font-bold text-white tracking-tight text-left truncate">
              Landscape Recommended
            </h2>
          </div>
          <button
            id="cc-orient-fs"
            type="button"
            aria-label="Enter Fullscreen"
            title="Toggle Fullscreen"
            class="cc-btn-secondary min-w-[44px] min-h-[44px] px-3 py-2 rounded-xl border-sky-400/60 text-sky-300 flex items-center justify-center shrink-0 cursor-pointer"
          >
            ${EXPAND_ICON}
          </button>
        </div>
        <p class="text-sm text-slate-300 leading-relaxed">
          Please rotate your device to landscape mode to play CHAOS CITY.
        </p>
        <p id="cc-orient-fs-msg" class="hidden text-xs text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-lg px-3 py-2 w-full"></p>
      </div>
    `;
    parent.appendChild(this.el);

    this.fsBtn = this.el.querySelector('#cc-orient-fs') as HTMLButtonElement;
    this.fsNoticeEl = this.el.querySelector('#cc-orient-fs-msg') as HTMLParagraphElement;

    this.fsBtn.addEventListener('click', async () => {
      this.fsNoticeEl.classList.add('hidden');
      const result = await toggleFullscreen();
      this.syncFullscreenIcon(result.active);
      if (result.error) {
        this.fsNoticeEl.textContent = result.error;
        this.fsNoticeEl.classList.remove('hidden');
      }
    });

    this.syncFullscreenIcon(isFullscreenActive());
    this.unsubFullscreen = onFullscreenChange((active) => {
      this.syncFullscreenIcon(active);
    });

    this.check();
    window.addEventListener('resize', this.check);
    window.addEventListener('orientationchange', this.check);
  }

  private syncFullscreenIcon(active: boolean): void {
    this.fsBtn.innerHTML = active ? MINIMIZE_ICON : EXPAND_ICON;
    this.fsBtn.setAttribute(
      'aria-label',
      active ? 'Exit Fullscreen' : 'Enter Fullscreen',
    );
    this.fsBtn.title = active ? 'Exit Fullscreen' : 'Enter Fullscreen';
  }

  public check = (): void => {
    const info = detectDevice();
    const show = info.isTouchCapable && info.isPortrait && window.innerWidth < 820;
    this.el.style.display = show ? 'flex' : 'none';
  };

  public destroy(): void {
    this.unsubFullscreen?.();
    window.removeEventListener('resize', this.check);
    window.removeEventListener('orientationchange', this.check);
    this.el.remove();
  }
}
