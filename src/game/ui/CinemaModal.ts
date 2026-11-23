import {audioSystem} from '@/src/game/systems/AudioSystem';
import {economySystem} from '@/src/game/systems/EconomySystem';

export class CinemaModal {
  private readonly backdrop: HTMLDivElement;
  private openState = false;
  private rafId: number | null = null;
  private onCloseCb?: () => void;

  constructor(parent: HTMLElement, onClose?: () => void) {
    this.onCloseCb = onClose;
    this.backdrop = document.createElement('div');
    this.backdrop.className =
      'ui-interactive fixed inset-0 z-40 hidden items-center justify-center bg-[#040812]/88 p-3 sm:p-4';
    parent.appendChild(this.backdrop);
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public close(): void {
    if (!this.openState) return;
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.openState = false;
    this.backdrop.style.display = 'none';
    this.backdrop.innerHTML = '';
    this.onCloseCb?.();
  }

  public open(): void {
    this.openState = true;
    let playing = true;
    let feedback = '';

    const popcornQty = economySystem.getItemQuantity('cin_popcorn');
    const sodaQty = economySystem.getItemQuantity('cin_soda');

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
        <div class="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#22355c]">
          <div>
            <div class="text-xs font-semibold text-rose-300">STARLIGHT CINEMA · SCREEN 1</div>
            <h2 class="font-display text-lg font-bold text-white">Now Playing: "Pixels of Tomorrow"</h2>
          </div>
          <button id="cc-cin-exit" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer">
            Leave Theater
          </button>
        </div>

        <div class="p-4 space-y-3 overflow-y-auto">
          <div class="rounded-xl overflow-hidden border-2 border-rose-500/40 bg-[#04060d]">
            <canvas id="cc-cin-canvas" width="420" height="220" class="w-full h-auto block"></canvas>
          </div>

          <div id="cc-cin-caption" class="text-center text-xs font-medium text-sky-200 min-h-[18px]"></div>

          ${
            feedback
              ? `<div class="text-xs text-emerald-300 text-center">${feedback}</div>`
              : ''
          }
          <div id="cc-cin-snack-msg" class="hidden px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-xs text-emerald-200 text-center"></div>

          <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#22355c]">
            <button id="cc-cin-toggle" type="button" class="cc-btn-secondary px-4 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
              Pause Film
            </button>
            <div class="flex items-center gap-2">
              ${
                popcornQty > 0
                  ? `<button id="cc-cin-pop" type="button" class="cc-btn-primary px-3.5 py-2 rounded-lg text-xs font-bold min-h-[40px] cursor-pointer">Eat Popcorn (×${popcornQty})</button>`
                  : ''
              }
              ${
                sodaQty > 0
                  ? `<button id="cc-cin-soda" type="button" class="cc-btn-primary px-3.5 py-2 rounded-lg text-xs font-bold min-h-[40px] cursor-pointer">Drink Slush (×${sodaQty})</button>`
                  : ''
              }
            </div>
          </div>
        </div>
      </div>
    `;

    this.backdrop.style.display = 'flex';
    const canvas = this.backdrop.querySelector('#cc-cin-canvas') as HTMLCanvasElement;
    const caption = this.backdrop.querySelector('#cc-cin-caption') as HTMLElement;
    const toggleBtn = this.backdrop.querySelector('#cc-cin-toggle') as HTMLButtonElement;
    const snackMsg = this.backdrop.querySelector('#cc-cin-snack-msg') as HTMLElement;
    const ctx = canvas.getContext('2d');

    this.backdrop.querySelector('#cc-cin-exit')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.close();
    });

    toggleBtn.addEventListener('click', () => {
      audioSystem.playButtonClick();
      playing = !playing;
      toggleBtn.textContent = playing ? 'Pause Film' : 'Resume Film';
    });

    const wireSnack = (btnId: string, itemId: string, label: string) => {
      const btn = this.backdrop.querySelector(btnId) as HTMLButtonElement | null;
      btn?.addEventListener('click', () => {
        const res = economySystem.consumeItem(itemId);
        if (res.ok) {
          audioSystem.playInteract();
          const left = economySystem.getItemQuantity(itemId);
          snackMsg.textContent = `Enjoyed ${label}! Energy restored to ${res.newEnergy}/100.`;
          snackMsg.classList.remove('hidden');
          if (left <= 0) {
            btn.remove();
          } else {
            btn.textContent = `${label} (×${left})`;
          }
        }
      });
    };
    wireSnack('#cc-cin-pop', 'cin_popcorn', 'Popcorn');
    wireSnack('#cc-cin-soda', 'cin_soda', 'Galaxy Slush');

    let simSec = 0;
    let last = performance.now();

    const captions = [
      'Scene 1 · Night falls gently over CHAOS CITY Skyline...',
      'Scene 2 · A neon tram glides across Central Park Boulevard.',
      'Scene 3 · Stars align above the Central Fountain plaza.',
      'Credits · Directed in Pixel-Scope · Thank you for visiting Starlight Cinema!',
    ];

    const renderFilm = (now: number) => {
      if (!this.openState) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (playing) simSec = (simSec + dt) % 16;

      if (ctx) {
        // Sky gradient bars
        ctx.fillStyle = '#070b1a';
        ctx.fillRect(0, 0, 420, 220);
        ctx.fillStyle = '#0f1733';
        ctx.fillRect(0, 70, 420, 80);

        // Twinkling stars
        for (let i = 0; i < 24; i++) {
          const sx = (i * 37 + 13) % 416;
          const sy = (i * 19 + 8) % 95;
          ctx.fillStyle = (Math.floor(simSec * 3) + i) % 3 === 0 ? '#bae6fd' : '#475569';
          ctx.fillRect(sx, sy, 2, 2);
        }

        // Crescent moon / Pixel sun
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(340, 24, 24, 24);
        ctx.fillStyle = '#070b1a';
        ctx.fillRect(348, 22, 18, 18);

        // City silhouette
        const blds = [
          [16, 108, 44, 72], [68, 86, 52, 94], [128, 120, 40, 60],
          [176, 74, 58, 106], [244, 98, 46, 82], [300, 114, 48, 66], [356, 88, 52, 92],
        ];
        for (const [bx, by, bw, bh] of blds) {
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(bx, by, bw, bh);
          ctx.fillStyle = '#38bdf8';
          for (let wy = by + 8; wy < by + bh - 12; wy += 14) {
            ctx.fillRect(bx + 8, wy, 6, 6);
            ctx.fillRect(bx + bw - 14, wy, 6, 6);
          }
        }

        // Gliding neon shuttle / tram
        const tramX = ((simSec / 16) * 500) - 60;
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(tramX, 168, 54, 16);
        ctx.fillStyle = '#bae6fd';
        ctx.fillRect(tramX + 6, 171, 12, 6);
        ctx.fillRect(tramX + 22, 171, 12, 6);
        ctx.fillRect(tramX + 38, 171, 10, 6);

        // Ground boulevard
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 184, 420, 36);
        ctx.fillStyle = '#facc15';
        for (let lx = 0; lx < 420; lx += 36) {
          ctx.fillRect(lx, 200, 18, 3);
        }

        // Film frame border
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, 416, 216);
      }

      const capIdx = Math.min(3, Math.floor(simSec / 4));
      caption.textContent = captions[capIdx];
      this.rafId = window.requestAnimationFrame(renderFilm);
    };

    this.rafId = window.requestAnimationFrame(renderFilm);
  }

  public destroy(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.openState = false;
    this.backdrop.remove();
  }
}
