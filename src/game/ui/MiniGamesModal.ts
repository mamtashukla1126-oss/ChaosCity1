import {MINI_GAMES_CATALOG, MiniGameCatalogEntry} from '@/src/game/data/progressionData';
import {drawCustomPlayerOnCanvas} from '@/src/game/graphics/PixelArtGenerator';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {economySystem, ProgressionAwardSummary} from '@/src/game/systems/EconomySystem';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {createMiniGameShell, MiniGameShellHandle} from '@/src/game/ui/MiniGameShell';

export interface MiniGamesModalCallbacks {
  onLaunchGame: (gameId: MiniGameCatalogEntry['id']) => void;
  onLocateGame?: (entry: MiniGameCatalogEntry) => void;
  onAwarded?: (summary: ProgressionAwardSummary) => void;
  onClose?: () => void;
}

const FISH_SPECIES = [
  {name: 'Park Silver Minnow', minKg: 0.4, maxKg: 1.1, coins: 16, color: '#cbd5e1'},
  {name: 'Emerald Sun Perch', minKg: 1.2, maxKg: 2.8, coins: 24, color: '#34d399'},
  {name: 'Imperial Golden Koi', minKg: 2.9, maxKg: 5.4, coins: 34, color: '#fbbf24'},
  {name: 'Starlight Pond Carp', minKg: 5.5, maxKg: 8.6, coins: 46, color: '#38bdf8'},
];

export class MiniGamesModal {
  private readonly parentEl: HTMLElement;
  private readonly backdrop: HTMLDivElement;
  private openState = false;
  private rafId: number | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private activeShell: MiniGameShellHandle | null = null;
  private activeCat = 'All';

  constructor(
    parent: HTMLElement,
    private readonly callbacks: MiniGamesModalCallbacks,
  ) {
    this.parentEl = parent;
    this.backdrop = document.createElement('div');
    this.backdrop.className =
      'ui-interactive fixed inset-0 z-40 hidden items-center justify-center bg-[#040812]/85 p-3 sm:p-4';
    parent.appendChild(this.backdrop);

    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) {
        this.close();
      }
    });
  }

  public isOpen(): boolean {
    return this.openState;
  }

  private stopLoop(quiet = false): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.activeShell) {
      const sh = this.activeShell;
      this.activeShell = null;
      sh.close(quiet);
    }
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    this.stopLoop(true);
    this.backdrop.style.display = 'none';
    this.backdrop.innerHTML = '';
    this.callbacks.onClose?.();
  }

  public openHub(): void {
    this.stopLoop();
    this.openState = true;
    this.renderHub();
    this.backdrop.style.display = 'flex';
  }

  private renderHub(): void {
    const save = saveSystem.getState();
    const cats = ['All', 'Luck & Cutscene', 'Fishing', 'Sports', 'Arcade', 'Time Trial', 'Brain & Reflex'];
    const items =
      this.activeCat === 'All'
        ? MINI_GAMES_CATALOG
        : MINI_GAMES_CATALOG.filter((g) => g.category === this.activeCat);

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-4xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
        <div class="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[#22355c] shrink-0">
          <div>
            <div class="font-mono-tabular text-[11px] font-bold text-sky-300">CHAOS CITY ARCADE & CHALLENGES</div>
            <h2 class="font-display text-lg sm:text-xl font-bold text-white">Mini-Games Hub (${MINI_GAMES_CATALOG.length} Playable)</h2>
          </div>
          <button id="cc-mg-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[42px] cursor-pointer">Close</button>
        </div>

        <div class="flex flex-wrap items-center gap-1.5 px-4 sm:px-5 py-2.5 bg-[#091020] border-b border-[#22355c] shrink-0">
          ${cats
            .map(
              (c) => `
                <button type="button" data-mg-cat="${c}" class="cc-mg-cat px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[34px] cursor-pointer ${
                  c === this.activeCat
                    ? 'bg-sky-500 text-[#06101f]'
                    : 'bg-[#131f38] text-slate-300 border border-[#22355c] hover:text-white'
                }">${c}</button>
              `,
            )
            .join('')}
        </div>

        <div class="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          ${items
            .map(
              (entry) => `
                <div class="rounded-xl bg-[#091020] border border-[#22355c] p-4 flex flex-col justify-between gap-3">
                  <div>
                    <div class="flex items-center justify-between gap-2 mb-1">
                      <span class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-sky-300">${entry.category}</span>
                      <span class="font-mono-tabular text-[11px] font-bold text-amber-300">${entry.rewardText}</span>
                    </div>
                    <h3 class="font-display font-bold text-base text-white">${entry.name}</h3>
                    <div class="text-[11px] text-emerald-300 mt-0.5">Location: ${entry.locationName}</div>
                    <p class="text-xs text-slate-300 mt-2 leading-relaxed">${entry.description}</p>
                  </div>
                  <div class="pt-2 border-t border-[#1b2c4e] flex flex-wrap items-center justify-between gap-2">
                    <span class="font-mono-tabular text-[11px] text-slate-400">${entry.getBestLabel(save)}</span>
                    <div class="flex items-center gap-2">
                      ${
                        this.callbacks.onLocateGame
                          ? `<button type="button" data-mg-locate="${entry.id}" class="cc-mg-locate cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer">Locate</button>`
                          : ''
                      }
                      <button type="button" data-mg-play="${entry.id}" class="cc-mg-play cc-btn-primary px-4 py-1.5 rounded-lg text-xs font-bold min-h-[38px] cursor-pointer">Play Now</button>
                    </div>
                  </div>
                </div>
              `,
            )
            .join('')}
        </div>
      </div>
    `;

    this.backdrop.querySelector('#cc-mg-close')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.close();
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-mg-cat').forEach((btn) => {
      btn.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.activeCat = btn.dataset.mgCat ?? 'All';
        this.renderHub();
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-mg-locate').forEach((btn) => {
      btn.addEventListener('click', () => {
        const entry = MINI_GAMES_CATALOG.find((e) => e.id === btn.dataset.mgLocate);
        if (!entry) return;
        audioSystem.playInteract();
        this.close();
        this.callbacks.onLocateGame?.(entry);
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-mg-play').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.mgPlay as MiniGameCatalogEntry['id'];
        if (!id) return;
        audioSystem.playInteract();
        if (id === 'fishing_pond') {
          this.openFishingGame();
        } else if (id === 'neon_memory') {
          this.openMemoryGame();
        } else {
          this.close();
          this.callbacks.onLaunchGame(id);
        }
      });
    });
  }

  /**
   * Real Playable Fishing Mini-Game (MiniGameShell + Custom Player Sprite on Pier)
   */
  public openFishingGame(): void {
    this.stopLoop();
    this.openState = true;
    this.backdrop.style.display = 'none';

    type FishPhase = 'ready' | 'casting' | 'waiting' | 'bite' | 'caught' | 'missed';
    let fishPhase: FishPhase = 'ready';
    let timer = 0;
    const biteDuration = 1.85;
    let waitTarget = 1.8;
    let bobberX = 200;
    let bobberY = 104;
    let statusMsg = 'Tap CAST / REEL or press Space to cast over the lily pond!';
    let lastFishColor = '#fbbf24';
    let lastCatchSummary = '';

    const resetPond = () => {
      fishPhase = 'ready';
      timer = 0;
      lastCatchSummary = '';
      statusMsg = 'Tap CAST / REEL or press Space to cast your line!';
    };

    const handleAction = () => {
      if (fishPhase === 'ready' || fishPhase === 'caught' || fishPhase === 'missed') {
        fishPhase = 'casting';
        timer = 0;
        waitTarget = 1.2 + Math.random() * 1.9;
        bobberX = 120 + Math.random() * 160;
        bobberY = 82 + Math.random() * 44;
        statusMsg = 'Casting line across the lily pads...';
        audioSystem.playInteract();
      } else if (fishPhase === 'waiting') {
        fishPhase = 'missed';
        statusMsg = 'Pulled too early! Wait for the golden BITE splash.';
        audioSystem.playError();
      } else if (fishPhase === 'bite') {
        fishPhase = 'caught';
        const roll = Math.random();
        const fish =
          roll > 0.88
            ? FISH_SPECIES[3]
            : roll > 0.62
              ? FISH_SPECIES[2]
              : roll > 0.3
                ? FISH_SPECIES[1]
                : FISH_SPECIES[0];
        const weight = fish.minKg + Math.random() * (fish.maxKg - fish.minKg);
        lastFishColor = fish.color;
        const summary = economySystem.recordFishCaught(weight, fish.coins);
        this.callbacks.onAwarded?.(summary);
        audioSystem.playCoin();
        lastCatchSummary = `${fish.name} (${weight.toFixed(1)} kg)`;
        statusMsg = `Caught ${lastCatchSummary}! +${summary.coinsAwarded} Coins · +${summary.xpAwarded} XP`;
      }
    };

    this.activeShell = createMiniGameShell(this.parentEl, {
      title: 'Lily Pond Fishing',
      subtitle: 'CENTRAL PARK PIER',
      accentColor: 'sky',
      canvasWidth: 400,
      canvasHeight: 240,
      controls: 'action-only',
      actionLabel: 'CAST / REEL',
      autoStart: true,
      startPrompt: 'Cast your line and press REEL immediately when a fish bites the bobber!',
      startHint: 'Space / Enter or tap CAST / REEL',
      onRestart: resetPond,
      onActionPress: handleAction,
      onClose: () => {
        if (this.openState) {
          this.openState = false;
          this.activeShell = null;
          this.callbacks.onClose?.();
        }
      },
      onUpdate: (dt, _input, shell) => {
        timer += dt;
        if (fishPhase === 'casting' && timer >= 0.45) {
          fishPhase = 'waiting';
          timer = 0;
          statusMsg = 'Steady... reel in as soon as the bobber splashes!';
        } else if (fishPhase === 'waiting' && timer >= waitTarget) {
          fishPhase = 'bite';
          timer = 0;
          statusMsg = 'BITE DETECTED! Press CAST / REEL NOW!';
          audioSystem.playInteract();
        } else if (fishPhase === 'bite' && timer >= biteDuration) {
          fishPhase = 'missed';
          statusMsg = 'It slipped the hook! Cast again.';
          audioSystem.playError();
        }

        const rec = saveSystem.getState().miniGameRecords;
        shell.setStats(
          `<span class="text-sky-300">Caught ${rec.fishCaught}</span><span class="text-amber-300">Best ${rec.bestFishWeightKg.toFixed(1)}kg</span>`,
        );
      },
      onRender: (ctx, W, H) => {
        const now = performance.now();
        ctx.fillStyle = '#0f3d2e';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(24, 34, W - 48, 134);
        ctx.fillStyle = '#0369a1';
        ctx.fillRect(24, 34, W - 48, 22);

        // Lily pads
        const pads = [[72, 74], [300, 66], [108, 134], [308, 132]];
        for (const [lx, ly] of pads) {
          ctx.fillStyle = '#15803d';
          ctx.fillRect(lx, ly, 26, 18);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(lx + 4, ly + 3, 18, 12);
        }

        // Wooden pier
        ctx.fillStyle = '#78350f';
        ctx.fillRect(148, 168, 104, 72);
        ctx.fillStyle = '#b45309';
        ctx.fillRect(154, 170, 92, 68);

        // Fishing rod from player hands
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(214, 188);
        ctx.lineTo(222, 146);
        ctx.stroke();

        // Customized Angler Sprite on Pier!
        drawCustomPlayerOnCanvas(
          ctx,
          176,
          172,
          48,
          60,
          saveSystem.getState(),
          'up',
          0,
          fishPhase === 'caught' ? 'celebrate' : 'walk',
        );

        if (fishPhase === 'waiting' || fishPhase === 'bite' || fishPhase === 'casting') {
          const dip =
            fishPhase === 'bite' ? Math.sin(now * 0.04) * 5 + 4 : Math.sin(now * 0.005) * 1.5;
          ctx.strokeStyle = 'rgba(241, 245, 249, 0.72)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(222, 146);
          ctx.lineTo(bobberX, bobberY + dip);
          ctx.stroke();

          if (fishPhase === 'bite') {
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.ellipse(bobberX, bobberY + 4, 18 + Math.sin(now * 0.02) * 5, 8, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(bobberX - 5, bobberY - 6 + dip, 10, 6);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(bobberX - 5, bobberY + dip, 10, 5);
        }

        if (fishPhase === 'caught') {
          ctx.fillStyle = lastFishColor;
          ctx.fillRect(179, 86, 42, 22);
          ctx.fillRect(169, 91, 12, 12);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(211, 92, 4, 4);
        }

        // Top prompt bar
        ctx.fillStyle = fishPhase === 'bite' ? 'rgba(234, 179, 8, 0.92)' : 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(20, 6, W - 40, 18);
        ctx.fillStyle = fishPhase === 'bite' ? '#0f172a' : '#e0f2fe';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(statusMsg, W / 2, 18);
      },
    });
  }

  /**
   * Real Playable Neon Memory Arena (MiniGameShell + 4 Colored Touch/Keyboard Pads)
   */
  public openMemoryGame(): void {
    this.stopLoop();
    this.openState = true;
    this.backdrop.style.display = 'none';

    const pads = [
      {idx: 0, label: 'CYAN', bg: '#0284c7', lit: '#7dd3fc', x: 52, y: 40},
      {idx: 1, label: 'PINK', bg: '#db2777', lit: '#f9a8d4', x: 208, y: 40},
      {idx: 2, label: 'GOLD', bg: '#d97706', lit: '#fde047', x: 52, y: 128},
      {idx: 3, label: 'MINT', bg: '#059669', lit: '#6ee7b7', x: 208, y: 128},
    ];

    let round = 1;
    const maxRounds = 5;
    let sequence: number[] = [Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)];
    let showIdx = 0;
    let showTimer = 0.45;
    let flashTimer = 0;
    let playerIdx = 0;
    let phaseState: 'showing' | 'input' | 'pause' = 'showing';
    let activePad = -1;
    let statusText = 'Round 1: Watch the glowing neon pattern...';
    let shellRef: MiniGameShellHandle | null = null;

    const resetRun = () => {
      round = 1;
      sequence = [Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)];
      showIdx = 0;
      showTimer = 0.45;
      flashTimer = 0;
      playerIdx = 0;
      activePad = -1;
      phaseState = 'showing';
      statusText = 'Round 1: Watch the glowing neon pattern...';
    };

    const pickPad = (idx: number) => {
      if (!shellRef || shellRef.getPhase() !== 'playing' || phaseState !== 'input') return;
      activePad = idx;
      flashTimer = 0.22;
      audioSystem.playInteract();
      if (idx !== sequence[playerIdx]) {
        const summary = economySystem.recordMemoryGameResult(round, false);
        this.callbacks.onAwarded?.(summary);
        audioSystem.playError();
        shellRef.finish({
          badge: 'Pattern Mismatch',
          headline: `Reached Round ${round} / ${maxRounds}`,
          summary: 'Almost! Watch the color sequence carefully on the next run.',
          rewardText: `+${summary.coinsAwarded} Coins · +${summary.xpAwarded} XP`,
        });
        return;
      }
      playerIdx += 1;
      if (playerIdx >= sequence.length) {
        if (round >= maxRounds) {
          const summary = economySystem.recordMemoryGameResult(round, true);
          this.callbacks.onAwarded?.(summary);
          audioSystem.playCoin();
          shellRef.finish({
            badge: 'Perfect Recall!',
            headline: 'All 5 Rounds Cleared!',
            summary: 'Flawless memory streak in the Neon Memory Arena!',
            rewardText: `+${summary.coinsAwarded} Coins · +${summary.xpAwarded} XP`,
          });
          return;
        }
        round += 1;
        sequence.push(Math.floor(Math.random() * 4));
        phaseState = 'pause';
        showTimer = 0.6;
        statusText = `Clean! Advancing to Round ${round}...`;
      }
    };

    const numKeyHandler = (e: KeyboardEvent) => {
      if (e.key === '1') {
        e.stopPropagation();
        pickPad(0);
      } else if (e.key === '2') {
        e.stopPropagation();
        pickPad(1);
      } else if (e.key === '3') {
        e.stopPropagation();
        pickPad(2);
      } else if (e.key === '4') {
        e.stopPropagation();
        pickPad(3);
      }
    };
    window.addEventListener('keydown', numKeyHandler);
    this.keyHandler = numKeyHandler;

    shellRef = createMiniGameShell(this.parentEl, {
      title: 'Neon Memory Arena',
      subtitle: 'ENTERTAINMENT KIOSK',
      accentColor: 'violet',
      canvasWidth: 400,
      canvasHeight: 230,
      controls: 'none',
      autoStart: true,
      customButtons: pads.map((p, i) => ({
        id: `pad_${i}`,
        label: `${i + 1}: ${p.label}`,
        accentClass: `px-2.5 py-1.5 rounded-xl text-xs font-black text-white border border-white/25 cursor-pointer active:scale-95 transition`,
        onPress: () => pickPad(p.idx),
      })),
      onCanvasPointerDown: (cx, cy) => {
        for (const p of pads) {
          if (cx >= p.x && cx <= p.x + 140 && cy >= p.y && cy <= p.y + 74) {
            pickPad(p.idx);
            break;
          }
        }
      },
      onRestart: resetRun,
      onClose: () => {
        window.removeEventListener('keydown', numKeyHandler);
        this.keyHandler = null;
        if (this.openState) {
          this.openState = false;
          this.activeShell = null;
          this.callbacks.onClose?.();
        }
      },
      onUpdate: (dt, _input, shell) => {
        if (flashTimer > 0) {
          flashTimer = Math.max(0, flashTimer - dt);
          if (flashTimer === 0) activePad = -1;
        }
        if (phaseState === 'pause') {
          showTimer -= dt;
          if (showTimer <= 0) {
            phaseState = 'showing';
            showIdx = 0;
            showTimer = 0.3;
            statusText = `Round ${round}: Watch carefully...`;
          }
        } else if (phaseState === 'showing') {
          showTimer -= dt;
          if (showTimer <= 0) {
            if (showIdx < sequence.length) {
              activePad = sequence[showIdx];
              flashTimer = 0.34;
              audioSystem.playInteract();
              showIdx += 1;
              showTimer = 0.54;
            } else {
              phaseState = 'input';
              playerIdx = 0;
              statusText = `Your turn! Repeat all ${sequence.length} flashes.`;
            }
          }
        }
        shell.setStats(
          `<span class="text-sky-300">Round ${round}/${maxRounds}</span><span class="text-amber-300">Best R${saveSystem.getState().miniGameRecords.bestMemoryRound}</span>`,
        );
      },
      onRender: (ctx, W, H) => {
        ctx.fillStyle = '#060c1a';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#e0f2fe';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(statusText, W / 2, 22);

        for (const p of pads) {
          const lit = activePad === p.idx;
          ctx.fillStyle = lit ? p.lit : p.bg;
          ctx.fillRect(p.x, p.y, 140, 74);
          ctx.strokeStyle = lit ? '#ffffff' : 'rgba(255,255,255,0.22)';
          ctx.lineWidth = lit ? 4 : 2;
          ctx.strokeRect(p.x, p.y, 140, 74);
          ctx.fillStyle = lit ? '#0f172a' : '#ffffff';
          ctx.font = 'bold 13px monospace';
          ctx.fillText(`${p.idx + 1}. ${p.label}`, p.x + 70, p.y + 42);
        }
      },
    });
    this.activeShell = shellRef;
  }

  public destroy(): void {
    this.openState = false;
    this.stopLoop(true);
    this.backdrop.remove();
  }
}
