import {CHARACTER_PRESETS} from '@/src/config/constants';
import {StoryCutsceneLine} from '@/src/game/data/progressionData';
import {renderCharacterPreviewDataUrl} from '@/src/game/graphics/PixelArtGenerator';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {economySystem, ProgressionAwardSummary} from '@/src/game/systems/EconomySystem';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {ShopDomain, ShopItem} from '@/src/game/types/gameTypes';

const esc = (str: string): string =>
  String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export class CutsceneOverlay {
  private readonly backdrop: HTMLDivElement;
  private openState = false;
  private rafId: number | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private onCloseCb?: () => void;

  constructor(parent: HTMLElement, onClose?: () => void) {
    this.onCloseCb = onClose;
    this.backdrop = document.createElement('div');
    this.backdrop.className =
      'ui-interactive fixed inset-0 z-50 hidden items-center justify-center bg-[#030712]/88 p-3 sm:p-4';
    parent.appendChild(this.backdrop);
  }

  public isOpen(): boolean {
    return this.openState;
  }

  private stopAnim(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }

  public close(): void {
    if (!this.openState) return;
    this.stopAnim();
    this.openState = false;
    this.backdrop.style.display = 'none';
    this.backdrop.innerHTML = '';
    this.onCloseCb?.();
  }

  private getPlayerPreview(animState: 'idle' | 'celebrate' | 'sit' | 'sleep' | 'interact'): string {
    const st = saveSystem.getState();
    const preset = CHARACTER_PRESETS.find((p) => p.id === st.appearanceId) ?? CHARACTER_PRESETS[0];
    return renderCharacterPreviewDataUrl(
      preset,
      st.appearanceConfig,
      st.equippedClothing,
      'down',
      animState,
      0,
      96,
      120,
    );
  }

  /**
   * Playable 2D Cutscene + Random Mini-Game: Fountain Coin Flip!
   */
  public openFountainCoinFlip(
    fountainTitle: string,
    onAwarded?: (summary: ProgressionAwardSummary) => void,
  ): void {
    this.stopAnim();
    this.openState = true;
    let choice: 'heads' | 'tails' = 'heads';
    let phase: 'pick' | 'flipping' | 'result' = 'pick';
    let flipStart = 0;
    let outcome: 'heads' | 'tails' = 'heads';
    let won = false;
    let summaryText = '';

    const playerImg = new Image();
    playerImg.src = this.getPlayerPreview('interact');
    const celebrateImg = new Image();
    celebrateImg.src = this.getPlayerPreview('celebrate');

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-lg max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
        <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#22355c] shrink-0">
          <div>
            <div class="font-mono-tabular text-[11px] font-bold text-sky-300">2D CUTSCENE & MINI-GAME</div>
            <h2 class="font-display text-base sm:text-lg font-bold text-white">${esc(fountainTitle)}</h2>
          </div>
          <button id="cc-cut-exit" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
            Exit
          </button>
        </div>

        <div class="p-4 flex flex-col items-center gap-3 overflow-y-auto">
          <div class="relative rounded-xl overflow-hidden border-2 border-[#2a4270] bg-[#060d1c] w-full max-w-[400px]">
            <canvas id="cc-flip-canvas" width="380" height="230" class="w-full h-auto block"></canvas>
          </div>

          <div id="cc-flip-status" class="text-xs sm:text-sm font-semibold text-sky-200 text-center min-h-[20px]">
            Call Heads or Tails before tossing your golden Chaos Coin!
          </div>

          <div id="cc-flip-pick-row" class="flex flex-wrap items-center justify-center gap-2.5 w-full">
            <button id="cc-flip-heads" type="button" class="cc-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer">
              Toss · Call HEADS
            </button>
            <button id="cc-flip-tails" type="button" class="px-5 py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer bg-amber-500 text-slate-950 hover:bg-amber-400">
              Toss · Call TAILS
            </button>
          </div>

          <div id="cc-flip-after-row" class="hidden flex-wrap items-center justify-center gap-2.5 w-full">
            <button id="cc-flip-replay" type="button" class="cc-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer">
              Flip Another Coin
            </button>
            <button id="cc-flip-done" type="button" class="cc-btn-secondary px-5 py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer">
              Back to Park
            </button>
          </div>
        </div>
      </div>
    `;

    this.backdrop.style.display = 'flex';
    const canvas = this.backdrop.querySelector('#cc-flip-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    const statusEl = this.backdrop.querySelector('#cc-flip-status') as HTMLElement;
    const pickRow = this.backdrop.querySelector('#cc-flip-pick-row') as HTMLElement;
    const afterRow = this.backdrop.querySelector('#cc-flip-after-row') as HTMLElement;

    const triggerToss = (picked: 'heads' | 'tails') => {
      if (phase === 'flipping') return;
      choice = picked;
      outcome = Math.random() < 0.5 ? 'heads' : 'tails';
      won = outcome === choice;
      phase = 'flipping';
      flipStart = performance.now();
      audioSystem.playInteract();
      pickRow.classList.add('hidden');
      afterRow.classList.add('hidden');
      statusEl.textContent = `You called ${picked.toUpperCase()}... Watch the coin arc!`;
    };

    this.backdrop.querySelector('#cc-cut-exit')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.close();
    });
    this.backdrop.querySelector('#cc-flip-done')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.close();
    });
    this.backdrop.querySelector('#cc-flip-heads')?.addEventListener('click', () => triggerToss('heads'));
    this.backdrop.querySelector('#cc-flip-tails')?.addEventListener('click', () => triggerToss('tails'));
    this.backdrop.querySelector('#cc-flip-replay')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      phase = 'pick';
      afterRow.classList.add('hidden');
      afterRow.classList.remove('flex');
      pickRow.classList.remove('hidden');
      statusEl.textContent = 'Call Heads or Tails for another lucky toss!';
    });

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    const draw = (now: number) => {
      if (!this.openState || !ctx) return;

      // Background night-sky & Central Park greenery
      const sky = ctx.createLinearGradient(0, 0, 0, 230);
      sky.addColorStop(0, '#0f172a');
      sky.addColorStop(0.55, '#1e3a5f');
      sky.addColorStop(1, '#14532d');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, 380, 230);

      // Stone cobblestone terrace
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, 146, 380, 84);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, 146, 380, 4);

      // Marble Wishing Fountain Basin (Right)
      ctx.fillStyle = '#475569';
      ctx.fillRect(185, 134, 165, 58);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(190, 130, 155, 52);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(202, 138, 131, 34);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(206, 140, 123, 28);

      // Fountain pedestal & animated water jet
      const jetWave = Math.sin(now * 0.01) * 4;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(258, 102, 18, 42);
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(264, 70 + jetWave, 6, 34 - jetWave);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(252 - jetWave, 86, 5, 5);
      ctx.fillRect(277 + jetWave, 86, 5, 5);

      // Player sprite portrait standing left side
      const activeSprite = phase === 'result' && won ? celebrateImg : playerImg;
      if (activeSprite.complete && activeSprite.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(activeSprite, 48, 86, 76, 95);
      }

      if (phase === 'flipping') {
        const elapsed = (now - flipStart) / 1000;
        const duration = 1.65;
        const t = Math.min(1, elapsed / duration);
        const coinX = 112 + t * 155;
        const coinY = 128 - Math.sin(t * Math.PI) * 94 + t * 22;
        const spinScale = Math.abs(Math.cos(elapsed * 16));
        const cw = Math.max(3, 18 * spinScale);

        // Spinning coin
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(coinX - cw / 2 - 1, coinY - 9, cw + 2, 18);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(coinX - cw / 2 + 1, coinY - 7, Math.max(2, cw - 2), 14);

        if (t >= 1) {
          phase = 'result';
          const summary = economySystem.recordFountainFlip(won);
          onAwarded?.(summary);
          if (won) {
            audioSystem.playCoin();
          } else {
            audioSystem.playInteract();
          }
          const extras: string[] = [];
          if (summary.unlockedItems.length > 0) extras.push(`Unlocked: ${summary.unlockedItems.join(', ')}`);
          if (summary.leveledUpTo) extras.push(`LEVEL UP -> Lv.${summary.leveledUpTo}!`);
          summaryText = `${outcome.toUpperCase()}! ${won ? 'PERFECT CALL!' : 'Nice wish!'} +${summary.coinsAwarded} Coins · +${summary.xpAwarded} XP · +10 Energy${extras.length ? ` · ${extras.join(' · ')}` : ''}`;
          statusEl.textContent = summaryText;
          afterRow.classList.remove('hidden');
          afterRow.classList.add('flex');
        }
      } else if (phase === 'result') {
        // Splash ripples & floating result badge inside fountain
        const pulse = ((now % 900) / 900);
        ctx.strokeStyle = won ? 'rgba(250, 204, 21, 0.85)' : 'rgba(186, 230, 253, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(267, 152, 14 + pulse * 26, 6 + pulse * 9, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Result coin face graphic
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(243, 44, 48, 48);
        ctx.fillStyle = won ? '#fbbf24' : '#94a3b8';
        ctx.fillRect(246, 47, 42, 42);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(outcome === 'heads' ? 'H' : 'T', 267, 75);
      }

      this.rafId = window.requestAnimationFrame(draw);
    };

    this.rafId = window.requestAnimationFrame(draw);
  }

  /**
   * 2D Cutscene for Café & Restaurant Order + Eat/Drink!
   */
  public openDineInCutscene(item: ShopItem, domain: ShopDomain, onComplete?: () => void): void {
    this.stopAnim();
    this.openState = true;
    const start = performance.now();
    const sitImg = new Image();
    sitImg.src = this.getPlayerPreview('sit');

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
        <div class="flex items-center justify-between px-4 py-3 border-b border-[#22355c] shrink-0">
          <div>
            <div class="font-mono-tabular text-[11px] font-bold text-emerald-300">${domain === 'cafe' ? 'BEAN & BYTE CAFE' : 'SUNSET BISTRO'}</div>
            <h2 class="font-display text-base font-bold text-white">Enjoying ${esc(item.name)}</h2>
          </div>
          <button id="cc-dine-skip" type="button" class="cc-btn-secondary px-3.5 py-1.5 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer">Skip</button>
        </div>
        <div class="p-4 flex flex-col items-center gap-3 overflow-y-auto">
          <canvas id="cc-dine-canvas" width="340" height="190" class="w-full h-auto rounded-xl border border-[#2a4270] bg-[#060b16]"></canvas>
          <div class="text-xs text-emerald-200 font-semibold text-center">
            Energy restored to ${economySystem.getEnergy()}/100${item.speedBoostSec ? ` · +${item.speedBoostSec}s Speed Boost active!` : ''}
          </div>
        </div>
      </div>
    `;
    this.backdrop.style.display = 'flex';

    let finished = false;
    const finish = () => {
      if (finished || !this.openState) return;
      finished = true;
      this.close();
      onComplete?.();
    };
    this.backdrop.querySelector('#cc-dine-skip')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      finish();
    });
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        finish();
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    const canvas = this.backdrop.querySelector('#cc-dine-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');

    const draw = (now: number) => {
      if (!this.openState || !ctx) return;
      const elapsed = (now - start) / 1000;
      if (elapsed >= 2.6) {
        finish();
        return;
      }

      // Cozy cafe/bistro wallpaper
      ctx.fillStyle = domain === 'cafe' ? '#451a03' : '#3b0764';
      ctx.fillRect(0, 0, 340, 190);
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(28, 22, 86, 56);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(32, 26, 78, 48);

      // Counter / wood table
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, 128, 340, 62);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(0, 124, 340, 10);

      // Seated character
      if (sitImg.complete && sitImg.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sitImg, 96, 56, 76, 95);
      }

      // Plate / Cup on table with steam animation
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(198, 114, 36, 12);
      ctx.fillStyle = item.iconColor;
      ctx.fillRect(204, 102, 24, 14);
      const steamOffset = (elapsed * 22) % 18;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(208, 94 - steamOffset, 4, 6);
      ctx.fillRect(218, 90 - steamOffset * 0.8, 4, 6);

      // Floating "+Energy" heart sparks
      const heartY = 58 - elapsed * 14;
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`+${item.energyRestore ?? 25} Energy`, 228, Math.max(24, heartY));

      this.rafId = window.requestAnimationFrame(draw);
    };
    this.rafId = window.requestAnimationFrame(draw);
  }

  /**
   * 2D Cutscene for Bed Rest -> Sleep-to-Morning!
   */
  public openSleepCutscene(onComplete?: () => void): void {
    this.stopAnim();
    this.openState = true;
    const start = performance.now();
    const sleepImg = new Image();
    sleepImg.src = this.getPlayerPreview('sleep');

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
        <div class="flex items-center justify-between px-4 py-3 border-b border-[#22355c] shrink-0">
          <div>
            <div class="font-mono-tabular text-[11px] font-bold text-indigo-300">HOME BEDROOM</div>
            <h2 class="font-display text-base font-bold text-white">Resting Until Morning...</h2>
          </div>
          <button id="cc-sleep-skip" type="button" class="cc-btn-secondary px-3.5 py-1.5 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer">Wake Up</button>
        </div>
        <div class="p-4 flex flex-col items-center gap-3 overflow-y-auto">
          <canvas id="cc-sleep-canvas" width="340" height="190" class="w-full h-auto rounded-xl border border-[#2a4270]"></canvas>
          <div id="cc-sleep-label" class="text-xs font-semibold text-indigo-200">Recharging energy...</div>
        </div>
      </div>
    `;
    this.backdrop.style.display = 'flex';

    let finished = false;
    const finish = () => {
      if (finished || !this.openState) return;
      finished = true;
      economySystem.restoreFullEnergy();
      this.close();
      onComplete?.();
    };
    this.backdrop.querySelector('#cc-sleep-skip')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      finish();
    });
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        finish();
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    const canvas = this.backdrop.querySelector('#cc-sleep-canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    const labelEl = this.backdrop.querySelector('#cc-sleep-label') as HTMLElement;

    const draw = (now: number) => {
      if (!this.openState || !ctx) return;
      const t = Math.min(1, (now - start) / 2600);
      if (t >= 1) {
        finish();
        return;
      }

      // Transition sky window from deep night to warm dawn
      ctx.fillStyle = t < 0.6 ? '#0f172a' : '#1e293b';
      ctx.fillRect(0, 0, 340, 190);
      ctx.fillStyle = t < 0.65 ? '#1e1b4b' : '#f59e0b';
      ctx.fillRect(215, 22, 84, 56);
      if (t < 0.65) {
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(245, 34, 14, 14);
      } else {
        labelEl.textContent = 'Good Morning! Energy 100/100!';
      }

      // Bed frame & blanket
      ctx.fillStyle = '#78350f';
      ctx.fillRect(66, 98, 138, 60);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(72, 104, 42, 24);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(108, 104, 90, 48);

      if (sleepImg.complete && sleepImg.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sleepImg, 78, 72, 64, 80);
      }

      // Floating Zzz
      const zY = 64 - ((now * 0.03) % 28);
      ctx.fillStyle = '#bae6fd';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('Z z z', 136, zY);

      this.rafId = window.requestAnimationFrame(draw);
    };
    this.rafId = window.requestAnimationFrame(draw);
  }

  /**
   * Multi-line Story Cutscene Modal with Character Portraits, Next & Skip.
   */
  public openStoryCutscene(
    title: string,
    subtitle: string,
    lines: StoryCutsceneLine[],
    rewardBanner?: string,
    onDone?: () => void,
  ): void {
    this.stopAnim();
    this.openState = true;
    let idx = 0;

    let finished = false;
    const finishStory = () => {
      if (finished || !this.openState) return;
      finished = true;
      this.close();
      onDone?.();
    };

    const render = () => {
      const line = lines[idx];
      if (!line) {
        finishStory();
        return;
      }
      const preset =
        CHARACTER_PRESETS.find((p) => p.id === line.portraitId) ?? CHARACTER_PRESETS[0];
      const npcImg = renderCharacterPreviewDataUrl(preset, undefined, undefined, 'down', 'idle', 0, 88, 110);
      const isLast = idx >= lines.length - 1;

      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
          <div class="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-[#22355c] bg-[#080f1f] shrink-0">
            <div>
              <div class="font-mono-tabular text-[11px] font-bold text-amber-300">${esc(subtitle)}</div>
              <h2 class="font-display text-base sm:text-lg font-bold text-white">${esc(title)}</h2>
            </div>
            <button id="cc-story-skip" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer">
              Skip Cutscene
            </button>
          </div>

          <div class="p-4 sm:p-5 space-y-4 overflow-y-auto">
            <div class="rounded-xl bg-gradient-to-br from-[#0d1930] to-[#132645] border border-sky-400/30 p-4 flex items-center gap-4">
              <img src="${npcImg}" alt="${esc(line.speaker)}" class="w-20 h-24 rounded-xl bg-[#050914] border border-[#2a4270] object-contain shrink-0" style="image-rendering: pixelated;" />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="font-display font-bold text-sm text-amber-300">${esc(line.speaker)}</span>
                  <span class="text-[11px] font-mono-tabular text-sky-300">${esc(line.role)}</span>
                </div>
                <p class="text-sm text-slate-100 leading-relaxed">${esc(line.line)}</p>
              </div>
            </div>

            ${
              rewardBanner && isLast
                ? `<div class="rounded-xl bg-emerald-500/15 border border-emerald-400/50 px-4 py-3 text-xs font-bold text-emerald-200 text-center">
                    ${esc(rewardBanner)}
                  </div>`
                : ''
            }

            <div class="flex items-center justify-between gap-2">
              <span class="font-mono-tabular text-[11px] text-slate-400">Scene ${idx + 1} of ${lines.length}</span>
              <button id="cc-story-next" type="button" class="cc-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer">
                ${isLast ? 'Continue' : 'Next Dialogue'}
              </button>
            </div>
          </div>
        </div>
      `;

      this.backdrop.style.display = 'flex';
      this.backdrop.querySelector('#cc-story-skip')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        finishStory();
      });
      this.backdrop.querySelector('#cc-story-next')?.addEventListener('click', () => {
        audioSystem.playInteract();
        if (isLast) {
          finishStory();
        } else {
          idx += 1;
          render();
        }
      });
    };

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finishStory();
      } else if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (idx >= lines.length - 1) {
          finishStory();
        } else {
          idx += 1;
          render();
        }
      }
    };
    window.addEventListener('keydown', this.keyHandler);
    render();
  }

  public openKaiEndingCutscene(
    playerName: string,
    allegianceLabel: string,
    onDone?: () => void,
  ): void {
    this.stopAnim();
    this.openState = true;

    let step = 0; // 0: Mission Man Quote, 1: Kai Lead Gang Leader Crown, 2: Chaos City 2 Teaser
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this.stopAnim();
      this.openState = false;
      this.backdrop.style.display = 'none';
      onDone?.();
    };

    const kaiCelebrationImg = this.getPlayerPreview('celebrate');

    const renderStep = () => {
      if (step === 0) {
        this.backdrop.innerHTML = `
          <div class="cc-panel rounded-2xl w-full max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100 border-amber-400/50 shadow-[0_0_60px_rgba(250,204,21,0.18)]">
            <div class="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-amber-400/25 bg-gradient-to-r from-[#140e07] via-[#0b1326] to-[#140e07] shrink-0">
              <div>
                <div class="font-mono-tabular text-[11px] font-bold text-amber-300 tracking-widest">THE MISSION HOUSE · FINAL CEREMONY</div>
                <h2 class="font-display text-lg font-extrabold text-white">The Word of The Mission Man</h2>
              </div>
              <span class="font-mono-tabular text-[11px] px-2.5 py-1 rounded bg-amber-500/15 border border-amber-400/40 text-amber-200 font-bold">SCENE 1 / 3</span>
            </div>
            <div class="p-5 sm:p-6 space-y-5 overflow-y-auto bg-gradient-to-b from-[#070d1b] to-[#040711]">
              <div class="rounded-2xl bg-gradient-to-br from-[#171124] to-[#0e1933] border border-amber-400/40 p-5 flex flex-col sm:flex-row items-center gap-5">
                ${
                  kaiCelebrationImg
                    ? `<img src="${kaiCelebrationImg}" alt="${esc(playerName)}" class="w-24 h-28 rounded-xl bg-[#050914] border-2 border-amber-400/60 object-contain shrink-0" style="image-rendering: pixelated;" />`
                    : `<div class="w-24 h-28 rounded-xl bg-[#050914] border-2 border-amber-400/60 flex items-center justify-center text-3xl shrink-0">👑</div>`
                }
                <div class="min-w-0 flex-1 text-center sm:text-left">
                  <div class="flex items-center justify-center sm:justify-start gap-2 mb-2">
                    <span class="font-display font-bold text-base text-amber-300">The Mission Man</span>
                    <span class="text-[11px] font-mono-tabular text-sky-300">Syndicate Strategist</span>
                  </div>
                  <p class="text-sm sm:text-base text-slate-100 leading-relaxed font-medium italic">
                    "Kai... you've come a long way. You've earned your place. From today onward, you are the LEAD GANG LEADER."
                  </p>
                </div>
              </div>
              <div class="flex justify-end">
                <button id="cc-ending-next" type="button" class="cc-btn-primary px-6 py-3 rounded-xl text-sm font-bold min-h-[46px] cursor-pointer">
                  Claim Your Title
                </button>
              </div>
            </div>
          </div>
        `;
      } else if (step === 1) {
        this.backdrop.innerHTML = `
          <div class="cc-panel rounded-2xl w-full max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100 border-amber-400/70 shadow-[0_0_80px_rgba(250,204,21,0.28)]">
            <div class="px-6 py-5 bg-gradient-to-b from-[#2b1b06] via-[#131932] to-[#060b17] text-center space-y-4 overflow-y-auto">
              <div class="font-mono-tabular text-xs font-bold tracking-[0.25em] text-amber-300 uppercase">STORY CAMPAIGN COMPLETE</div>
              <div class="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-600 text-slate-950 flex items-center justify-center text-4xl font-black shadow-[0_0_40px_rgba(250,204,21,0.55)]">
                ♛
              </div>
              <div>
                <h2 class="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-200">
                  KAI — THE LEAD GANG LEADER
                </h2>
                <p class="text-xs sm:text-sm text-sky-200 mt-1.5">
                  Citizen: <b class="text-white">${esc(playerName)}</b> · Path: <b class="text-amber-300">${esc(allegianceLabel)}</b>
                </p>
              </div>
              <div class="rounded-xl bg-emerald-500/15 border border-emerald-400/50 px-4 py-3 text-xs sm:text-sm font-bold text-emerald-200">
                +300 Coins · +350 XP · Title Unlocked: "Lead Gang Leader" · Achievement Unlocked!
              </div>
              <div class="pt-2 flex justify-center">
                <button id="cc-ending-next" type="button" class="cc-btn-primary px-7 py-3 rounded-xl text-sm font-bold min-h-[46px] cursor-pointer">
                  Continue
                </button>
              </div>
            </div>
          </div>
        `;
      } else {
        this.backdrop.innerHTML = `
          <div class="cc-panel rounded-2xl w-full max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100 border-rose-500/60 shadow-[0_0_90px_rgba(244,63,94,0.3)]">
            <div class="px-6 py-8 bg-gradient-to-b from-[#03050b] via-[#0c081a] to-[#1a0918] text-center space-y-5 overflow-y-auto">
              <div class="font-mono-tabular text-[11px] font-bold tracking-[0.28em] text-rose-400 uppercase">
                POST-CREDITS TRANSMISSION
              </div>
              <p class="font-display text-lg sm:text-2xl font-bold tracking-wide text-slate-100 leading-snug">
                THE CITY HAS CHANGED. A NEW POWER IS RISING.
              </p>
              <div class="h-px w-40 mx-auto bg-gradient-to-r from-transparent via-rose-400 to-transparent"></div>
              <div class="py-2">
                <div class="font-display text-3xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-amber-300 via-rose-400 to-sky-400 bg-clip-text text-transparent">
                  CHAOS CITY 2
                </div>
                <div class="font-mono-tabular text-xs sm:text-sm font-bold tracking-[0.35em] text-amber-300 mt-2">
                  THE STORY CONTINUES...
                </div>
              </div>
              <p class="text-xs text-slate-400 max-w-md mx-auto">
                Your free-roam city progress, vehicles, homes, coins, and Lead Gang Leader title remain fully unlocked in Chaos City.
              </p>
              <div class="pt-2 flex justify-center">
                <button id="cc-ending-next" type="button" class="cc-btn-primary px-7 py-3 rounded-xl text-sm font-bold min-h-[46px] cursor-pointer">
                  Return to Chaos City
                </button>
              </div>
            </div>
          </div>
        `;
      }

      this.backdrop.style.display = 'flex';
      this.backdrop.querySelector('#cc-ending-next')?.addEventListener('click', () => {
        audioSystem.playCoin();
        if (step < 2) {
          step += 1;
          renderStep();
        } else {
          finish();
        }
      });
    };

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (step < 2) {
          step += 1;
          renderStep();
        } else {
          finish();
        }
      }
    };
    window.addEventListener('keydown', this.keyHandler);
    audioSystem.playCoin();
    renderStep();
  }

  public destroy(): void {
    this.openState = false;
    this.stopAnim();
    this.backdrop.remove();
  }
}
