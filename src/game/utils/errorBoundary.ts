import {SCENE_KEYS} from '@/src/config/constants';

export interface ErrorBoundaryOptions {
  getPhaserGame?: () => Phaser.Game | null;
}

class GlobalErrorBoundary {
  private installed = false;
  private bannerEl: HTMLDivElement | null = null;
  private gameGetter: (() => Phaser.Game | null) | null = null;

  public install(options: ErrorBoundaryOptions = {}): void {
    this.gameGetter = options.getPhaserGame ?? null;
    if (this.installed) return;
    this.installed = true;

    window.addEventListener('error', (event) => {
      const msg = event.error?.message || event.message || 'Unexpected runtime error';
      // Ignore benign ResizeObserver browser noise or Vite HMR messages
      if (
        msg.includes('ResizeObserver loop') ||
        msg.includes('WebSocket connection')
      ) {
        return;
      }
      console.error('[CHAOS CITY Runtime Error]', event.error ?? event.message);
      this.showRecoveryBanner(msg);
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const msg =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : 'Async operation failed';
      if (msg.includes('WebSocket') || msg.includes('AbortError')) {
        return;
      }
      console.error('[CHAOS CITY Unhandled Rejection]', reason);
      this.showRecoveryBanner(msg);
    });
  }

  public showRecoveryBanner(detail: string): void {
    if (typeof document === 'undefined') return;
    if (this.bannerEl && this.bannerEl.isConnected) {
      const msgEl = this.bannerEl.querySelector('#cc-err-detail');
      if (msgEl) msgEl.textContent = detail;
      this.bannerEl.style.display = 'flex';
      return;
    }

    const parent = document.getElementById('ui-overlay') ?? document.body;
    const wrapper = document.createElement('div');
    wrapper.id = 'cc-error-boundary';
    wrapper.className =
      'ui-interactive fixed inset-0 z-[90] flex items-center justify-center bg-[#040812]/80 p-4';
    wrapper.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-md p-5 border border-rose-500/50 text-slate-100 shadow-2xl">
        <div class="text-[11px] font-bold uppercase tracking-wider text-rose-300">CHAOS CITY Safeguard</div>
        <h2 class="font-display text-lg font-bold text-white mt-1">An interaction hit a snag</h2>
        <p id="cc-err-detail" class="text-xs text-slate-300 mt-2 bg-[#070d1c] border border-[#22355c] rounded-lg px-3 py-2 break-words"></p>
        <div class="flex flex-wrap gap-2 mt-4">
          <button id="cc-err-resume" type="button" class="cc-btn-primary px-4 py-2 rounded-lg text-xs font-bold min-h-[40px] cursor-pointer">
            Resume Safely
          </button>
          <button id="cc-err-menu" type="button" class="cc-btn-secondary px-4 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
            Return to Main Menu
          </button>
        </div>
      </div>
    `;

    const detailEl = wrapper.querySelector('#cc-err-detail');
    if (detailEl) detailEl.textContent = detail;

    wrapper.querySelector('#cc-err-resume')?.addEventListener('click', () => {
      this.hide();
    });

    wrapper.querySelector('#cc-err-menu')?.addEventListener('click', () => {
      this.hide();
      try {
        const game = this.gameGetter?.();
        if (game?.scene) {
          for (const key of [SCENE_KEYS.CITY, SCENE_KEYS.INTERIOR, SCENE_KEYS.BOOT]) {
            if (game.scene.isActive(key) || game.scene.isPaused(key)) {
              game.scene.stop(key);
            }
          }
          game.scene.start(SCENE_KEYS.MAIN_MENU);
        } else {
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    });

    parent.appendChild(wrapper);
    this.bannerEl = wrapper;
  }

  public hide(): void {
    if (this.bannerEl) {
      this.bannerEl.style.display = 'none';
    }
  }
}

export const globalErrorBoundary = new GlobalErrorBoundary();
