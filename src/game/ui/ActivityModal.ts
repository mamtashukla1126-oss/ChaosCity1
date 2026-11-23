import {BUS_STOPS, BusStopSpot, VEHICLE_MODELS} from '@/src/game/data/cityLifeData';
import {drawCustomPlayerOnCanvas} from '@/src/game/graphics/PixelArtGenerator';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {economySystem} from '@/src/game/systems/EconomySystem';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {createMiniGameShell, MiniGameShellHandle} from '@/src/game/ui/MiniGameShell';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface TriviaQ {
  key: string;
  q: string;
  choices: string[];
  answerIdx: number;
}

const TRIVIA_QUESTIONS: TriviaQ[] = [
  {
    key: 'trivia_q1',
    q: 'Which landmark stands at the heart of Central Park where cobblestone paths intersect?',
    choices: ['Central Fountain', 'Skyline Helipad', 'Neon Tram Depot'],
    answerIdx: 0,
  },
  {
    key: 'trivia_q2',
    q: 'Where can residents preview and purchase all 12 clothing & accessory categories with live preview?',
    choices: ['FreshMart Grocery', 'Threadz Boutique', 'IronWorks Gym'],
    answerIdx: 1,
  },
  {
    key: 'trivia_q3',
    q: 'Which Entertainment Zone venue features playable Starlight Drift & Brick Blitz cabinets?',
    choices: ['Central Bank', 'Pixel Palace Arcade', 'City Gazette'],
    answerIdx: 1,
  },
  {
    key: 'trivia_q4',
    q: 'How many connected districts make up the expanded CHAOS CITY world map?',
    choices: ['Five', 'Eight', 'Eleven'],
    answerIdx: 2,
  },
];

interface GazetteIssue {
  num: number;
  date: string;
  headline: string;
  district: string;
  body: string;
  tip: string;
}

const GAZETTE_ISSUES: GazetteIssue[] = [
  {
    num: 1,
    date: 'Issue #01 · Founders Edition',
    headline: 'Central Park Basin Restored With Wishing Wells',
    district: 'Central Park',
    body: 'City engineers installed dual recirculating limestone fountains at both the grand cobblestone hub and the north promenade. Residents toss coins for an energizing mist refresh.',
    tip: 'Resident Tip: Toss a coin at either fountain for +10 Energy and a lucky coin surprise.',
  },
  {
    num: 2,
    date: 'Issue #02 · Metro Mobility',
    headline: 'Park-and-Drive Vehicles Deployed Across 3 Corridors',
    district: 'Downtown & Shopping District',
    body: 'Three neighborhood vehicles—Skyline Roadster, Plaza Compact, and Metro Scooter—are parked along open avenues for quick travel between districts.',
    tip: 'Resident Tip: Approach any parked vehicle and press E / TAP to hop in and drive.',
  },
  {
    num: 3,
    date: 'Issue #03 · Culture & Style',
    headline: 'Threadz Atelier & Glow Studio Unveil Seasonal Styles',
    district: 'Shopping District',
    body: 'Custom outfits tailored at Threadz Boutique automatically sync with saved presets and hairstyles across your resident workstation and cloud profile.',
    tip: 'Resident Tip: Try Live Try-On inside Threadz Boutique or your home computer terminal.',
  },
  {
    num: 4,
    date: 'Issue #04 · Nightlife & Sport',
    headline: 'Eastside Court & Starlight Cinema Lead Evening Crowds',
    district: 'Entertainment Zone & Residential',
    body: 'After hitting three-pointers at Eastside Court, catch Screen 1 features at Starlight Cinema or unwind at Bean & Byte Cafe for freshly brewed espresso.',
    tip: 'Resident Tip: Beat your high score at Eastside Streetball to earn extra Coins.',
  },
];

export class ActivityModal {
  private readonly parentEl: HTMLElement;
  private readonly backdrop: HTMLDivElement;
  private openState = false;
  private rafId: number | null = null;
  private scanTimer: number | null = null;
  private keyDownHandler: ((e: KeyboardEvent) => void) | null = null;
  private activeShell: MiniGameShellHandle | null = null;
  private onCloseCb?: () => void;
  private onCelebrateCb?: () => void;

  constructor(parent: HTMLElement, onClose?: () => void, onCelebrate?: () => void) {
    this.parentEl = parent;
    this.onCloseCb = onClose;
    this.onCelebrateCb = onCelebrate;
    this.backdrop = document.createElement('div');
    this.backdrop.className =
      'ui-interactive fixed inset-0 z-40 hidden items-center justify-center bg-[#040812]/80 p-3 sm:p-4';
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

  private clearActiveLoops(quiet = false): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.scanTimer !== null) {
      window.clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.keyDownHandler) {
      window.removeEventListener('keydown', this.keyDownHandler);
      this.keyDownHandler = null;
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
    this.clearActiveLoops(true);
    this.backdrop.style.display = 'none';
    this.backdrop.innerHTML = '';
    this.onCloseCb?.();
  }

  public openGymWorkout(title: string, subtitle: string): void {
    this.clearActiveLoops();
    this.openState = true;
    let reps = 0;
    const targetReps = 12;
    let completed = false;
    let feedback = 'Tap the rep button rapidly to complete your set and earn Coins!';

    const render = () => {
      const pct = Math.min(100, Math.round((reps / targetReps) * 100));
      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-5 text-slate-100 space-y-4">
          <div class="flex items-center justify-between border-b border-[#22355c] pb-3">
            <div>
              <div class="text-xs font-semibold text-orange-300">${esc(subtitle)}</div>
              <h2 class="font-display text-lg font-bold text-white">${esc(title)}</h2>
            </div>
            <button id="cc-act-close" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">Close</button>
          </div>

          <div class="space-y-2">
            <div class="flex justify-between text-xs font-mono-tabular">
              <span class="text-slate-300">Progress: ${reps} / ${targetReps} reps</span>
              <span class="text-amber-300 font-bold">${pct}%</span>
            </div>
            <div class="h-3 rounded bg-[#060b16] border border-[#22355c] overflow-hidden">
              <div class="h-full bg-orange-400 transition-all" style="width:${pct}%"></div>
            </div>
          </div>

          <p class="text-xs ${completed ? 'text-emerald-300 font-semibold' : 'text-slate-300'}">${feedback}</p>

          <div class="flex justify-center pt-1">
            ${
              completed
                ? `<button id="cc-gym-again" type="button" class="cc-btn-secondary px-5 py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer">Another Set</button>`
                : `<button id="cc-gym-rep" type="button" class="cc-btn-primary px-8 py-3 rounded-xl text-sm font-bold min-h-[48px] cursor-pointer">REP! (+1)</button>`
            }
          </div>
        </div>
      `;

      this.backdrop.querySelector('#cc-act-close')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });

      this.backdrop.querySelector('#cc-gym-rep')?.addEventListener('click', () => {
        reps += 1;
        audioSystem.playInteract();
        if (reps >= targetReps) {
          completed = true;
          const bal = economySystem.awardCoins(15, 'IronWorks Gym Workout Bonus');
          economySystem.recordActivityCompletion('mission_gym_set');
          audioSystem.playCoin();
          this.onCelebrateCb?.();
          feedback = `Workout complete! Earned +15 Coins (Balance: ${bal}c). Check the Smoothie Bar too!`;
        }
        render();
      });

      this.backdrop.querySelector('#cc-gym-again')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        reps = 0;
        completed = false;
        feedback = 'Keep pushing! Complete another 12 reps for +15 Coins.';
        render();
      });
    };

    render();
    this.backdrop.style.display = 'flex';
  }

  public openLibraryTrivia(title: string, subtitle: string): void {
    this.clearActiveLoops();
    this.openState = true;
    let qIdx = 0;
    let feedback: {text: string; ok: boolean} | null = null;

    const render = () => {
      const cur = TRIVIA_QUESTIONS[qIdx];
      const alreadyClaimed = economySystem.hasClaimedReward(cur.key);

      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-5 text-slate-100 space-y-4">
          <div class="flex items-center justify-between border-b border-[#22355c] pb-3">
            <div>
              <div class="text-xs font-semibold text-emerald-300">${esc(subtitle)}</div>
              <h2 class="font-display text-lg font-bold text-white">${esc(title)}</h2>
            </div>
            <button id="cc-act-close" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">Close</button>
          </div>

          <div class="flex items-center justify-between text-xs font-mono-tabular text-slate-400">
            <span>Question ${qIdx + 1} / ${TRIVIA_QUESTIONS.length}</span>
            <span class="${alreadyClaimed ? 'text-emerald-300' : 'text-amber-300'}">${alreadyClaimed ? 'Reward Claimed' : 'Reward: +15 Coins'}</span>
          </div>

          <p class="text-sm font-semibold text-white leading-relaxed">${cur.q}</p>

          <div class="space-y-2">
            ${cur.choices
              .map(
                (ch, i) => `
                  <button type="button" data-ans-idx="${i}" class="cc-triv-opt w-full text-left px-3.5 py-2.5 rounded-xl bg-[#0d1629] border border-[#22355c] hover:border-sky-400 text-xs font-medium text-slate-200 min-h-[44px] cursor-pointer">
                    ${ch}
                  </button>
                `,
              )
              .join('')}
          </div>

          ${
            feedback
              ? `<div class="px-3 py-2 rounded-lg text-xs border ${
                  feedback.ok
                    ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                    : 'bg-rose-500/15 border-rose-400/50 text-rose-200'
                }">${feedback.text}</div>`
              : ''
          }

          <div class="flex justify-between pt-2 border-t border-[#22355c]">
            <button id="cc-triv-prev" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">Prev</button>
            <button id="cc-triv-next" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">Next</button>
          </div>
        </div>
      `;

      this.backdrop.querySelector('#cc-act-close')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });
      this.backdrop.querySelector('#cc-triv-prev')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        qIdx = (qIdx - 1 + TRIVIA_QUESTIONS.length) % TRIVIA_QUESTIONS.length;
        feedback = null;
        render();
      });
      this.backdrop.querySelector('#cc-triv-next')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        qIdx = (qIdx + 1) % TRIVIA_QUESTIONS.length;
        feedback = null;
        render();
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-triv-opt').forEach((btn) => {
        btn.addEventListener('click', () => {
          const picked = Number(btn.dataset.ansIdx);
          if (picked === cur.answerIdx) {
            if (!economySystem.hasClaimedReward(cur.key)) {
              const bal = economySystem.awardCoins(15, `City Trivia (${cur.key})`, cur.key);
              economySystem.recordActivityCompletion('mission_library_trivia');
              audioSystem.playCoin();
              this.onCelebrateCb?.();
              feedback = {text: `Correct! Earned +15 Coins (Balance: ${bal}c).`, ok: true};
            } else {
              audioSystem.playInteract();
              feedback = {text: 'Correct! You already collected the reward for this question.', ok: true};
            }
          } else {
            audioSystem.playError();
            feedback = {text: 'Not quite — try another answer!', ok: false};
          }
          render();
        });
      });
    };

    render();
    this.backdrop.style.display = 'flex';
  }

  public openGazetteArchives(title: string, subtitle: string): void {
    this.clearActiveLoops();
    this.openState = true;
    let idx = 0;

    const render = () => {
      const issue = GAZETTE_ISSUES[idx];
      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-lg max-h-[92dvh] overflow-y-auto p-5 text-slate-100 space-y-4">
          <div class="flex items-center justify-between border-b border-[#22355c] pb-3">
            <div>
              <div class="text-xs font-semibold text-amber-300">${esc(subtitle)}</div>
              <h2 class="font-display text-lg font-bold text-white">${esc(title)}</h2>
            </div>
            <button id="cc-act-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[44px] cursor-pointer">Close</button>
          </div>

          <div class="grid grid-cols-4 gap-1.5">
            ${GAZETTE_ISSUES.map(
              (g, i) => `
                <button type="button" data-gaz="${i}" class="cc-gaz-tab px-2 py-2 rounded-lg text-xs font-bold min-h-[40px] cursor-pointer ${
                  i === idx
                    ? 'bg-amber-400 text-[#06101f]'
                    : 'bg-[#0d1629] text-slate-300 border border-[#22355c]'
                }">Issue #${g.num}</button>
              `,
            ).join('')}
          </div>

          <div class="rounded-xl bg-[#091020] border border-amber-400/35 p-4 space-y-2.5">
            <div class="flex items-center justify-between text-[11px] font-mono-tabular text-amber-300">
              <span>${issue.date}</span>
              <span>${issue.district}</span>
            </div>
            <h3 class="font-display text-base font-bold text-white">${issue.headline}</h3>
            <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">${issue.body}</p>
            <div class="px-3 py-2 rounded-lg bg-[#0d1629] border border-sky-400/30 text-xs text-sky-200">
              ${issue.tip}
            </div>
          </div>

          <div class="flex items-center justify-between pt-1">
            <button id="cc-gaz-prev" type="button" class="cc-btn-secondary px-4 py-2 rounded-lg text-xs font-semibold min-h-[44px] cursor-pointer">Previous Issue</button>
            <button id="cc-gaz-next" type="button" class="cc-btn-primary px-4 py-2 rounded-lg text-xs font-bold min-h-[44px] cursor-pointer">Next Issue</button>
          </div>
        </div>
      `;

      this.backdrop.querySelector('#cc-act-close')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });
      this.backdrop.querySelector('#cc-gaz-prev')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        idx = (idx - 1 + GAZETTE_ISSUES.length) % GAZETTE_ISSUES.length;
        render();
      });
      this.backdrop.querySelector('#cc-gaz-next')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        idx = (idx + 1) % GAZETTE_ISSUES.length;
        render();
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-gaz-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          audioSystem.playButtonClick();
          idx = Number(btn.dataset.gaz) || 0;
          render();
        });
      });
    };

    render();
    this.backdrop.style.display = 'flex';
  }

  public openOfficeShift(title: string, subtitle: string): void {
    this.clearActiveLoops();
    this.openState = true;
    const routes = [
      {parcel: 'Parcel #A1 · Espresso Roast', dest: 'Shopping District'},
      {parcel: 'Parcel #B4 · Fountain Pumps', dest: 'Central Park'},
      {parcel: 'Parcel #C9 · Tech Server Rack', dest: 'Downtown'},
      {parcel: 'Parcel #D2 · Film Reels', dest: 'Entertainment Zone'},
    ];
    let step = 0;
    let feedback: {text: string; ok: boolean} | null = null;
    let done = false;

    const render = () => {
      const cur = routes[step];
      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-5 text-slate-100 space-y-4">
          <div class="flex items-center justify-between border-b border-[#22355c] pb-3">
            <div>
              <div class="text-xs font-semibold text-sky-300">${esc(subtitle)}</div>
              <h2 class="font-display text-lg font-bold text-white">${esc(title)}</h2>
            </div>
            <button id="cc-act-close" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">Close</button>
          </div>

          ${
            done
              ? `<div class="space-y-3 text-center py-2">
                  <div class="text-sm font-bold text-emerald-300">Shift Complete! +20 Coins Credited</div>
                  <p class="text-xs text-slate-300">Balance: ${economySystem.getCoins()} Coins. Great dispatch work!</p>
                  <button id="cc-off-again" type="button" class="cc-btn-primary px-5 py-2 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer">Run Another Shift</button>
                </div>`
              : `<div class="space-y-3">
                  <div class="text-xs font-mono-tabular text-slate-400">Dispatch ${step + 1} / ${routes.length}</div>
                  <div class="p-3.5 rounded-xl bg-[#091020] border border-sky-400/40 text-sm font-bold text-white">
                    ${cur.parcel}
                  </div>
                  <div class="text-xs text-slate-300">Route this parcel to the matching district:</div>
                  <div class="grid grid-cols-2 gap-2">
                    ${['Downtown', 'Central Park', 'Shopping District', 'Entertainment Zone']
                      .map(
                        (d) => `
                          <button type="button" data-dest="${d}" class="cc-off-btn cc-btn-secondary px-3 py-2.5 rounded-lg text-xs font-semibold min-h-[44px] cursor-pointer">${d}</button>
                        `,
                      )
                      .join('')}
                  </div>
                </div>`
          }

          ${
            feedback
              ? `<div class="px-3 py-2 rounded-lg text-xs border ${
                  feedback.ok
                    ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
                    : 'bg-rose-500/15 border-rose-400/50 text-rose-200'
                }">${feedback.text}</div>`
              : ''
          }
        </div>
      `;

      this.backdrop.querySelector('#cc-act-close')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });

      this.backdrop.querySelector('#cc-off-again')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        step = 0;
        done = false;
        feedback = null;
        render();
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-off-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const picked = btn.dataset.dest;
          if (picked === cur.dest) {
            audioSystem.playInteract();
            if (step + 1 >= routes.length) {
              done = true;
              const bal = economySystem.awardCoins(20, 'Skyline Commerce Dispatch Shift');
              economySystem.recordActivityCompletion('mission_office_shift');
              audioSystem.playCoin();
              this.onCelebrateCb?.();
              feedback = {text: `All parcels routed! Balance: ${bal} Coins.`, ok: true};
            } else {
              step += 1;
              feedback = {text: 'Parcel routed cleanly!', ok: true};
            }
          } else {
            audioSystem.playError();
            feedback = {text: 'Wrong district hub — check the parcel manifest.', ok: false};
          }
          render();
        });
      });
    };

    render();
    this.backdrop.style.display = 'flex';
  }

  public openBasketballMiniGame(title: string, subtitle: string): void {
    this.clearActiveLoops();
    this.openState = true;
    this.backdrop.style.display = 'none';

    let timeLeft = 30;
    let score = 0;
    let shotsMade = 0;
    let shotsTaken = 0;
    let streak = 0;
    let playerX = 200;
    let playerStep = 0;
    let walkAnimAcc = 0;
    let jumpTimer = 0;
    let hoopX = 200;
    let hoopDir = 1;
    let needle = 0.5;
    let needleDir = 1;
    let shotAnimT = 0;
    let shotStartX = 200;
    let shotTargetX = 200;
    let shotSuccess = false;
    let bannerText = 'Run Left/Right & Shoot when the needle hits green!';

    const resetState = () => {
      timeLeft = 30;
      score = 0;
      shotsMade = 0;
      shotsTaken = 0;
      streak = 0;
      playerX = 200;
      hoopX = 200;
      hoopDir = 1;
      needle = 0.5;
      needleDir = 1;
      shotAnimT = 0;
      jumpTimer = 0;
      bannerText = 'Run Left/Right & Shoot when the needle hits green!';
    };

    const shoot = (shell: MiniGameShellHandle) => {
      if (shell.getPhase() !== 'playing' || shotAnimT > 0) return;
      shotsTaken += 1;
      const meterOk = Math.abs(needle - 0.5) <= 0.19;
      const alignBonus = Math.abs(playerX - hoopX) <= 44;
      const made = meterOk || (alignBonus && Math.abs(needle - 0.5) <= 0.25);

      shotAnimT = 0.58;
      jumpTimer = 0.45;
      shotStartX = playerX;
      shotTargetX = hoopX + (made ? 0 : needle < 0.5 ? -36 : 36);
      shotSuccess = made;

      if (made) {
        streak += 1;
        shotsMade += 1;
        const pts = Math.abs(needle - 0.5) <= 0.08 ? 3 : 2;
        score += pts + Math.min(2, streak - 1);
        audioSystem.playSwish();
        bannerText = pts === 3 ? `SWISH! +3 pts (x${streak})` : `BUCKET! +${pts} pts`;
      } else {
        streak = 0;
        audioSystem.playError();
        bannerText = 'Rimmed out — line up under the hoop!';
      }
    };

    this.activeShell = createMiniGameShell(this.parentEl, {
      title,
      subtitle,
      accentColor: 'amber',
      canvasWidth: 400,
      canvasHeight: 240,
      controls: 'left-right',
      actionLabel: 'SHOOT',
      autoStart: true,
      startPrompt: 'Move your character along the court and tap SHOOT when the timing needle hits green!',
      startHint: 'Move: Arrow Keys / A-D · Shoot: Space / SHOOT button',
      onRestart: resetState,
      onActionPress: shoot,
      onCanvasPointerDown: (x, _y, shell) => {
        if (shell.getPhase() !== 'playing' || shotAnimT > 0) return;
        playerX = Math.max(48, Math.min(352, x));
        shoot(shell);
      },
      onClose: () => {
        if (this.openState) {
          this.openState = false;
          this.activeShell = null;
          this.onCloseCb?.();
        }
      },
      onUpdate: (dt, input, shell) => {
        timeLeft = Math.max(0, timeLeft - dt);
        const moving = input.left !== input.right;
        if (input.left) playerX -= 165 * dt;
        if (input.right) playerX += 165 * dt;
        playerX = Math.max(48, Math.min(352, playerX));

        if (moving) {
          walkAnimAcc += dt;
          if (walkAnimAcc >= 0.14) {
            walkAnimAcc = 0;
            playerStep = (playerStep + 1) % 4;
          }
        } else {
          playerStep = 0;
        }

        if (jumpTimer > 0) jumpTimer = Math.max(0, jumpTimer - dt);

        if (score >= 4) {
          hoopX += hoopDir * Math.min(85, 32 + score * 2) * dt;
          if (hoopX > 315) {
            hoopX = 315;
            hoopDir = -1;
          } else if (hoopX < 85) {
            hoopX = 85;
            hoopDir = 1;
          }
        }

        if (shotAnimT > 0) {
          shotAnimT = Math.max(0, shotAnimT - dt);
        } else {
          const speed = 1.2 + Math.min(0.85, streak * 0.12);
          needle += needleDir * speed * dt;
          if (needle >= 1) {
            needle = 1;
            needleDir = -1;
          } else if (needle <= 0) {
            needle = 0;
            needleDir = 1;
          }
        }

        const best = Math.max(score, economySystem.getHighScore('streetball'));
        shell.setStats(
          `<span class="text-amber-300">${score} pts</span><span class="text-sky-300">Best ${best}</span><span class="text-emerald-300">${Math.ceil(timeLeft)}s</span>`,
        );

        if (timeLeft <= 0) {
          const isBest = economySystem.recordHighScore('streetball', score);
          const coins = score > 0 ? Math.min(40, 10 + Math.floor(score / 2)) : 5;
          economySystem.awardCoins(coins, 'Eastside Streetball Shootout');
          audioSystem.playCoin();
          if (score >= 6) this.onCelebrateCb?.();
          shell.finish({
            badge: isBest ? 'New Court Record!' : 'Final Buzzer',
            headline: `Final Score: ${score} pts (${shotsMade}/${shotsTaken} Made)`,
            summary: `Best Streak & court rhythm earned you City Arena XP!`,
            rewardText: `+${coins} Coins · +25 XP`,
          });
        }
      },
      onRender: (ctx, W, H) => {
        ctx.clearRect(0, 0, W, H);
        // Night stadium sky + bleachers
        ctx.fillStyle = '#0c182f';
        ctx.fillRect(0, 0, W, 158);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(16, 118, W - 32, 34);
        // Hardwood court
        ctx.fillStyle = '#b45309';
        ctx.fillRect(0, 152, W, H - 152);
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 2;
        ctx.strokeRect(24, 158, W - 48, 52);

        // Moving Backboard & Rim
        ctx.fillStyle = '#475569';
        ctx.fillRect(hoopX - 4, 24, 8, 128);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(hoopX - 42, 24, 84, 50);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.strokeRect(hoopX - 19, 40, 38, 22);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(hoopX - 24, 68, 48, 6);
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(hoopX - 18, 74, 36, 22);

        // Customized Player Character Sprite on Court!
        const jumpOffset = jumpTimer > 0 ? Math.sin((jumpTimer / 0.45) * Math.PI) * 18 : 0;
        const spriteAnim = shotSuccess && jumpTimer > 0 ? 'celebrate' : 'walk';
        drawCustomPlayerOnCanvas(
          ctx,
          playerX - 24,
          144 - jumpOffset,
          48,
          60,
          saveSystem.getState(),
          'up',
          playerStep,
          spriteAnim,
        );

        // Basketball
        let bx = playerX + 16;
        let by = 166 - jumpOffset;
        if (shotAnimT > 0) {
          const p = 1 - shotAnimT / 0.58;
          bx = shotStartX + (shotTargetX - shotStartX) * p;
          by = 166 - Math.sin(p * Math.PI) * 112 + (shotSuccess ? -82 * p : -34 * p);
        }
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(bx, by, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#7c2d12';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Top banner feedback
        ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
        ctx.fillRect(24, 6, W - 48, 16);
        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(bannerText, W / 2, 17);

        // Timing Meter Bar
        const barX = 48;
        const barW = W - 96;
        const barY = 216;
        ctx.fillStyle = '#060b16';
        ctx.fillRect(barX, barY, barW, 14);
        ctx.fillStyle = '#16a34a';
        ctx.fillRect(barX + barW * 0.31, barY + 1, barW * 0.38, 12);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(barX + barW * 0.43, barY + 1, barW * 0.14, 12);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(barX + needle * barW - 3, barY - 2, 6, 18);
      },
    });
  }

  public openInfoAction(
    title: string,
    subtitle: string,
    description: string,
    mode: 'clinic_checkup' | 'bed' | 'kitchen' | 'pet_play' | 'info',
    petSpecies?: string,
  ): void {
    this.clearActiveLoops();
    this.openState = true;

    if (mode === 'kitchen') {
      this.openInteractiveKitchen(title, subtitle, description);
      return;
    }
    if (mode === 'clinic_checkup') {
      this.openInteractiveClinic(title, subtitle, description);
      return;
    }
    if (mode === 'pet_play') {
      this.openInteractivePetCare(title, subtitle, description, petSpecies ?? 'Friendly Pet');
      return;
    }

    let resultMsg = '';
    const actionLabel = mode === 'bed' ? 'Rest in Bed (100% Energy & Save)' : '';

    const render = () => {
      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-5 text-slate-100 space-y-4">
          <div class="flex items-start justify-between gap-3 border-b border-[#22355c] pb-3">
            <div>
              <div class="text-xs font-semibold text-sky-300">${esc(subtitle)}</div>
              <h2 class="font-display text-lg font-bold text-white">${esc(title)}</h2>
            </div>
            <button id="cc-act-close" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">Close</button>
          </div>

          <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">${esc(description)}</p>

          ${
            resultMsg
              ? `<div class="px-3.5 py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-400/50 text-xs text-emerald-200">${resultMsg}</div>`
              : ''
          }

          <div class="flex justify-end gap-2 pt-1">
            ${
              actionLabel
                ? `<button id="cc-act-do" type="button" class="cc-btn-primary px-4 py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer">${actionLabel}</button>`
                : ''
            }
          </div>
        </div>
      `;

      this.backdrop.querySelector('#cc-act-close')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });

      this.backdrop.querySelector('#cc-act-do')?.addEventListener('click', () => {
        audioSystem.playInteract();
        if (mode === 'bed') {
          economySystem.restoreFullEnergy();
          saveSystem.save(saveSystem.getState());
          resultMsg = 'Refreshed! Energy restored to 100/100 and local progress saved.';
        }
        render();
      });
    };

    render();
    this.backdrop.style.display = 'flex';
  }

  private openInteractiveKitchen(title: string, subtitle: string, description: string): void {
    const recipes = [
      {id: 'tea', name: 'Warm Herbal Tea', detail: 'Brew soothing chamomile tea (+40 Energy)', energy: 40},
      {id: 'toast', name: 'Honey Brioche Toast', detail: 'Griddle warm golden toast (+55 Energy)', energy: 55},
      {id: 'bowl', name: 'Metro Noodle Bowl', detail: 'Cook a full hot meal (+75 Energy)', energy: 75},
    ];
    let cooking = false;
    let feedback = '';

    const render = () => {
      const curEnergy = economySystem.getEnergy();
      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-5 text-slate-100 space-y-4">
          <div class="flex items-start justify-between gap-3 border-b border-[#22355c] pb-3">
            <div>
              <div class="text-xs font-semibold text-amber-300">${esc(subtitle)}</div>
              <h2 class="font-display text-lg font-bold text-white">${esc(title)}</h2>
            </div>
            <button id="cc-act-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[44px] cursor-pointer">Close</button>
          </div>

          <div class="flex items-center justify-between text-xs bg-[#091020] border border-[#22355c] rounded-xl px-3.5 py-2">
            <span class="text-slate-300">${esc(description)}</span>
            <span class="font-mono-tabular font-bold text-emerald-300 shrink-0 ml-2">Energy ${curEnergy}/100</span>
          </div>

          <div class="space-y-2">
            ${recipes
              .map(
                (r) => `
                  <button type="button" data-rec="${r.id}" ${cooking ? 'disabled' : ''} class="cc-kit-btn w-full text-left p-3 rounded-xl bg-[#0d1629] border border-[#22355c] hover:border-amber-400 flex items-center justify-between gap-3 min-h-[48px] cursor-pointer">
                    <div>
                      <div class="font-display font-bold text-sm text-white">${r.name}</div>
                      <div class="text-xs text-slate-400">${r.detail}</div>
                    </div>
                    <span class="px-3 py-1.5 rounded-lg bg-amber-400 text-[#06101f] font-bold text-xs shrink-0">Cook</span>
                  </button>
                `,
              )
              .join('')}
          </div>

          ${
            cooking
              ? `<div class="px-3.5 py-2.5 rounded-lg bg-sky-500/15 border border-sky-400/50 text-xs text-sky-200 font-semibold">Simmering on the stove...</div>`
              : feedback
                ? `<div class="px-3.5 py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-400/50 text-xs text-emerald-200">${feedback}</div>`
                : ''
          }
        </div>
      `;

      this.backdrop.querySelector('#cc-act-close')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-kit-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const rec = recipes.find((r) => r.id === btn.dataset.rec);
          if (!rec || cooking) return;
          audioSystem.playInteract();
          cooking = true;
          render();
          this.scanTimer = window.setTimeout(() => {
            if (!this.openState) return;
            cooking = false;
            const nextE = economySystem.restoreEnergy(rec.energy);
            audioSystem.playCoin();
            this.onCelebrateCb?.();
            feedback = `Prepared ${rec.name}! Energy restored to ${nextE}/100.`;
            render();
          }, 550);
        });
      });
    };

    render();
    this.backdrop.style.display = 'flex';
  }

  private openInteractiveClinic(title: string, subtitle: string, description: string): void {
    let scanning = false;
    let complete = false;
    let phase = 0;

    const render = () => {
      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-5 text-slate-100 space-y-4">
          <div class="flex items-start justify-between gap-3 border-b border-[#22355c] pb-3">
            <div>
              <div class="text-xs font-semibold text-emerald-300">${esc(subtitle)}</div>
              <h2 class="font-display text-lg font-bold text-white">${esc(title)}</h2>
            </div>
            <button id="cc-act-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[44px] cursor-pointer">Close</button>
          </div>

          <p class="text-xs text-slate-300 leading-relaxed">${esc(description)}</p>
          <canvas id="cc-ecg-canvas" width="360" height="86" class="w-full h-auto rounded-xl bg-[#040a14] border border-emerald-500/40 block"></canvas>

          ${
            complete
              ? `<div class="px-3.5 py-2.5 rounded-lg bg-emerald-500/15 border border-emerald-400/50 text-xs text-emerald-200 font-semibold">Vitals Optimal · 72 BPM! Energy restored to 100/100.</div>`
              : ''
          }

          <div class="flex justify-end">
            <button id="cc-clinic-scan" type="button" ${scanning ? 'disabled' : ''} class="cc-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer">
              ${scanning ? 'Running Vital Scan...' : complete ? 'Re-Run Vital Checkup' : 'Start Free Vital Checkup'}
            </button>
          </div>
        </div>
      `;

      this.backdrop.querySelector('#cc-act-close')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });

      this.backdrop.querySelector('#cc-clinic-scan')?.addEventListener('click', () => {
        if (scanning) return;
        scanning = true;
        complete = false;
        audioSystem.playInteract();
        render();
        this.scanTimer = window.setTimeout(() => {
          if (!this.openState) return;
          scanning = false;
          complete = true;
          economySystem.restoreFullEnergy();
          audioSystem.playCoin();
          this.onCelebrateCb?.();
          render();
        }, 900);
      });
    };

    const drawEcg = () => {
      if (!this.openState) return;
      phase += scanning ? 0.16 : 0.06;
      const canvas = this.backdrop.querySelector<HTMLCanvasElement>('#cc-ecg-canvas');
      const ctx = canvas?.getContext('2d');
      if (ctx && canvas) {
        const W = canvas.width;
        const H = canvas.height;
        ctx.fillStyle = '#040a14';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = '#0f2942';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 24) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, H);
          ctx.stroke();
        }
        ctx.strokeStyle = complete || scanning ? '#34d399' : '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let x = 0; x < W; x += 4) {
          const cycle = ((x * 0.08 - phase) % 6.28 + 6.28) % 6.28;
          let yOff = 0;
          if (cycle > 2.6 && cycle < 2.9) yOff = -24;
          else if (cycle >= 2.9 && cycle < 3.2) yOff = 18;
          else if (cycle >= 3.2 && cycle < 3.5) yOff = -8;
          const y = H / 2 + yOff;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      this.rafId = window.requestAnimationFrame(drawEcg);
    };

    render();
    this.backdrop.style.display = 'flex';
    this.rafId = window.requestAnimationFrame(drawEcg);
  }

  private openInteractivePetCare(
    title: string,
    subtitle: string,
    description: string,
    petSpecies: string,
  ): void {
    let happiness = 60;
    let actionMsg = description;
    let bouncePhase = 0;

    const render = () => {
      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-5 text-slate-100 space-y-4">
          <div class="flex items-start justify-between gap-3 border-b border-[#22355c] pb-3">
            <div>
              <div class="text-xs font-semibold text-amber-300">${esc(subtitle)}</div>
              <h2 class="font-display text-lg font-bold text-white">${esc(title)}</h2>
            </div>
            <button id="cc-act-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[44px] cursor-pointer">Close</button>
          </div>

          <canvas id="cc-pet-canvas" width="320" height="118" class="w-full h-auto rounded-xl bg-[#091020] border border-[#22355c] block"></canvas>

          <div class="space-y-1">
            <div class="flex justify-between text-xs font-mono-tabular">
              <span class="text-slate-300">${esc(petSpecies)} Mood</span>
              <span class="text-amber-300 font-bold">${happiness}% Happy</span>
            </div>
            <div class="h-2.5 rounded bg-[#060b16] overflow-hidden">
              <div class="h-full bg-pink-400 transition-all" style="width:${happiness}%"></div>
            </div>
          </div>

          <p class="text-xs text-emerald-200 bg-emerald-500/10 border border-emerald-400/30 rounded-lg px-3 py-2">${esc(actionMsg)}</p>

          <div class="grid grid-cols-3 gap-2">
            <button type="button" data-pet-act="pet" class="cc-pet-btn cc-btn-primary py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer">Pet</button>
            <button type="button" data-pet-act="play" class="cc-pet-btn cc-btn-secondary py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer">Play Ball</button>
            <button type="button" data-pet-act="treat" class="cc-pet-btn cc-btn-secondary py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer">Give Treat</button>
          </div>
        </div>
      `;

      this.backdrop.querySelector('#cc-act-close')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-pet-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const act = btn.dataset.petAct;
          happiness = Math.min(100, happiness + 15);
          audioSystem.playInteract();
          this.onCelebrateCb?.();
          if (act === 'pet') {
            actionMsg = `${petSpecies} leans in happily for warm ear scratches!`;
          } else if (act === 'play') {
            actionMsg = `${petSpecies} leaps after the bouncy ball and brings it right back!`;
          } else {
            actionMsg = `${petSpecies} crunches a wholesome oat treat happily!`;
          }
          render();
        });
      });
    };

    const isCat = petSpecies.toLowerCase().includes('cat');
    const animatePet = () => {
      if (!this.openState) return;
      bouncePhase += 0.08;
      const canvas = this.backdrop.querySelector<HTMLCanvasElement>('#cc-pet-canvas');
      const ctx = canvas?.getContext('2d');
      if (ctx && canvas) {
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#091020';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#172544';
        ctx.fillRect(0, H - 24, W, 24);

        const bounce = Math.abs(Math.sin(bouncePhase)) * (happiness >= 80 ? 8 : 3);
        const cx = W / 2;
        const cy = H - 50 - bounce;
        // Cute pixel pet body & ears
        ctx.fillStyle = isCat ? '#f59e0b' : '#d97706';
        ctx.fillRect(cx - 22, cy, 44, 24); // torso
        ctx.fillRect(cx - 18, cy - 22, 34, 24); // head
        ctx.fillRect(cx - 18, cy - 30, 8, 10); // ear L
        ctx.fillRect(cx + 8, cy - 30, 8, 10); // ear R
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(cx - 8, cy - 10, 14, 10); // muzzle
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(cx - 10, cy - 16, 4, 4);
        ctx.fillRect(cx + 4, cy - 16, 4, 4);
        // Wagging tail
        const wag = Math.sin(bouncePhase * 2) * 5;
        ctx.fillStyle = isCat ? '#78350f' : '#fef3c7';
        ctx.fillRect(cx + 22, cy + 4 + wag, 10, 8);
      }
      this.rafId = window.requestAnimationFrame(animatePet);
    };

    render();
    this.backdrop.style.display = 'flex';
    this.rafId = window.requestAnimationFrame(animatePet);
  }

  public openSoccerMiniGame(title: string, subtitle: string): void {
    this.clearActiveLoops();
    this.openState = true;
    this.backdrop.style.display = 'none';

    let kicksLeft = 5;
    let goals = 0;
    let saves = 0;
    let strikerX = 200;
    let aimX = 200;
    let strikerStep = 0;
    let walkAcc = 0;
    let kickAnimT = 0;
    let resetDelay = 0;
    let ballX = 200;
    let ballY = 176;
    let shotStartX = 200;
    let shotTargetX = 200;
    let keeperX = 200;
    let targetKeeperX = 200;
    let keeperGoalSide: 'left' | 'center' | 'right' = 'center';
    let lastOutcome: 'idle' | 'goal' | 'saved' = 'idle';
    let statusMsg = 'Position & aim Left/Right, then tap KICK!';

    const resetMatch = () => {
      kicksLeft = 5;
      goals = 0;
      saves = 0;
      strikerX = 200;
      aimX = 200;
      kickAnimT = 0;
      resetDelay = 0;
      ballX = 200;
      ballY = 176;
      keeperX = 200;
      targetKeeperX = 200;
      lastOutcome = 'idle';
      statusMsg = 'Position & aim Left/Right, then tap KICK!';
    };

    const kickBall = (shell: MiniGameShellHandle) => {
      if (shell.getPhase() !== 'playing' || kickAnimT > 0 || resetDelay > 0 || kicksLeft <= 0) {
        return;
      }
      kicksLeft -= 1;
      audioSystem.playWhistle();
      kickAnimT = 0.46;
      shotStartX = strikerX;
      shotTargetX = Math.max(84, Math.min(316, aimX));

      const shotLane: 'left' | 'center' | 'right' =
        shotTargetX < 155 ? 'left' : shotTargetX > 245 ? 'right' : 'center';
      const lanes: Array<'left' | 'center' | 'right'> = ['left', 'center', 'right'];
      keeperGoalSide =
        Math.random() < 0.35 ? shotLane : lanes[Math.floor(Math.random() * lanes.length)];
      targetKeeperX = keeperGoalSide === 'left' ? 115 : keeperGoalSide === 'right' ? 285 : 200;
      lastOutcome = shotLane === keeperGoalSide ? 'saved' : 'goal';
    };

    this.activeShell = createMiniGameShell(this.parentEl, {
      title,
      subtitle,
      accentColor: 'emerald',
      canvasWidth: 400,
      canvasHeight: 240,
      controls: 'left-right',
      actionLabel: 'KICK!',
      autoStart: true,
      startPrompt: 'Line up your customized striker & target reticle, then press KICK!',
      startHint: 'Move & Aim: Arrow Keys / A-D · Kick: Space / KICK button',
      onRestart: resetMatch,
      onActionPress: kickBall,
      onCanvasPointerDown: (x, _y, shell) => {
        if (shell.getPhase() !== 'playing' || kickAnimT > 0 || resetDelay > 0) return;
        aimX = Math.max(84, Math.min(316, x));
        kickBall(shell);
      },
      onClose: () => {
        if (this.openState) {
          this.openState = false;
          this.activeShell = null;
          this.onCloseCb?.();
        }
      },
      onUpdate: (dt, input, shell) => {
        if (kickAnimT <= 0 && resetDelay <= 0) {
          const moving = input.left !== input.right;
          if (input.left) {
            strikerX -= 155 * dt;
            aimX -= 220 * dt;
          }
          if (input.right) {
            strikerX += 155 * dt;
            aimX += 220 * dt;
          }
          strikerX = Math.max(96, Math.min(304, strikerX));
          aimX = Math.max(84, Math.min(316, aimX));
          ballX = strikerX;
          ballY = 176;

          if (moving) {
            walkAcc += dt;
            if (walkAcc >= 0.14) {
              walkAcc = 0;
              strikerStep = (strikerStep + 1) % 4;
            }
          } else {
            strikerStep = 0;
          }
        } else if (kickAnimT > 0) {
          kickAnimT = Math.max(0, kickAnimT - dt);
          const p = 1 - kickAnimT / 0.46;
          ballX = shotStartX + (shotTargetX - shotStartX) * p;
          ballY = 176 + (56 - 176) * p - Math.sin(p * Math.PI) * 20;
          keeperX = 200 + (targetKeeperX - 200) * Math.min(1, p * 1.15);

          if (kickAnimT === 0) {
            resetDelay = 0.55;
            if (lastOutcome === 'saved') {
              saves += 1;
              audioSystem.playError();
              statusMsg = `Keeper dove ${keeperGoalSide.toUpperCase()} and punched it out!`;
            } else {
              goals += 1;
              audioSystem.playSwish();
              this.onCelebrateCb?.();
              statusMsg = `GOAL! Top corner strike past the keeper!`;
            }
          }
        } else if (resetDelay > 0) {
          resetDelay = Math.max(0, resetDelay - dt);
          if (resetDelay === 0) {
            if (kicksLeft <= 0) {
              const isBest = economySystem.recordHighScore('soccer_kick', goals);
              const coins = Math.max(8, goals * 8 + (goals === 5 ? 10 : 0));
              economySystem.awardCoins(coins, `Soccer Shootout (${goals}/5 Goals)`);
              economySystem.recordActivityCompletion('mission_soccer_match');
              audioSystem.playCoin();
              shell.finish({
                badge: isBest ? 'Golden Boot Record!' : 'Full Time Whistle',
                headline: `Final Score: ${goals}/5 Goals (${saves} Saved)`,
                summary: `Clean penalty finishing in front of the stadium crowd.`,
                rewardText: `+${coins} Coins · +25 XP`,
              });
              return;
            }
            ballX = strikerX;
            ballY = 176;
            keeperX = 200;
          }
        }

        const best = Math.max(goals, economySystem.getHighScore('soccer_kick'));
        shell.setStats(
          `<span class="text-emerald-300">Goals ${goals}</span><span class="text-sky-300">Kicks ${kicksLeft}</span><span class="text-amber-300">Best ${best}</span>`,
        );
      },
      onRender: (ctx, W, H) => {
        ctx.fillStyle = '#14532d';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#166534';
        ctx.fillRect(0, 46, W, 42);
        ctx.fillRect(0, 132, W, 42);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(56, 40, W - 112, 118);

        // Goal Frame & Net
        ctx.fillStyle = 'rgba(15, 23, 42, 0.38)';
        ctx.fillRect(72, 22, W - 144, 48);
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 4;
        ctx.strokeRect(72, 22, W - 144, 48);

        // Aim Reticle on Goal Line
        if (kickAnimT <= 0 && resetDelay <= 0) {
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(aimX, 54, 10, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Goalkeeper
        ctx.fillStyle = '#f97316';
        ctx.fillRect(keeperX - 16, 46, 32, 18);
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(keeperX - 6, 38, 12, 10);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(keeperX - 20, 48, 5, 6);
        ctx.fillRect(keeperX + 15, 48, 5, 6);

        // Soccer Ball
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(ballX, ballY, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(ballX, ballY, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(ballX - 2, ballY - 2, 4, 4);

        // Customized Striker Character Sprite!
        const strikerAnim =
          resetDelay > 0 && lastOutcome === 'goal' ? 'celebrate' : 'walk';
        drawCustomPlayerOnCanvas(
          ctx,
          strikerX - 24,
          176,
          48,
          60,
          saveSystem.getState(),
          'up',
          strikerStep,
          strikerAnim,
        );

        // Status banner
        ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
        ctx.fillRect(28, 4, W - 56, 15);
        ctx.fillStyle = '#a7f3d0';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(statusMsg, W / 2, 15);
      },
    });
  }

  public openBusTransitModal(
    currentStopId: string | undefined,
    onRideToStop: (stop: BusStopSpot) => void,
  ): void {
    this.clearActiveLoops();
    this.openState = true;
    let boardingStop: BusStopSpot | null = null;

    const render = () => {
      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-5 text-slate-100 space-y-4">
          <div class="flex items-start justify-between gap-3 border-b border-[#22355c] pb-3">
            <div>
              <div class="text-xs font-semibold text-sky-300">Chaos Transit Civic Loop</div>
              <h2 class="font-display text-lg font-bold text-white">City Bus Express</h2>
            </div>
            <button id="cc-act-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[44px] cursor-pointer">Close</button>
          </div>

          <p class="text-xs text-slate-300 leading-relaxed">
            Ride the complimentary electric city shuttle directly to any major district hub.
          </p>

          <div class="space-y-2 max-h-[48dvh] overflow-y-auto pr-1">
            ${BUS_STOPS.map((stop) => {
              const isHere = stop.id === currentStopId;
              return `
                <button type="button" data-bus-id="${stop.id}" ${isHere || boardingStop ? 'disabled' : ''} class="cc-bus-btn w-full text-left p-3 rounded-xl border transition min-h-[50px] flex items-center justify-between gap-3 ${
                  isHere
                    ? 'bg-emerald-500/15 border-emerald-400/50 cursor-default'
                    : 'bg-[#091020] border-[#22355c] hover:border-sky-400 cursor-pointer'
                }">
                  <div>
                    <div class="font-display text-sm font-bold text-white">${stop.name}</div>
                    <div class="text-[11px] text-sky-300">${stop.district}</div>
                  </div>
                  <span class="px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
                    isHere
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-sky-500 text-[#06101f]'
                  }">${isHere ? 'You Are Here' : 'Ride Free'}</span>
                </button>
              `;
            }).join('')}
          </div>

          ${
            boardingStop
              ? `<div class="px-3.5 py-2.5 rounded-xl bg-sky-500/15 border border-sky-400/50 text-xs text-sky-200 font-semibold text-center">
                  Boarding shuttle to ${boardingStop.name}...
                </div>`
              : ''
          }
        </div>
      `;

      this.backdrop.querySelector('#cc-act-close')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
      });

      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-bus-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const stop = BUS_STOPS.find((s) => s.id === btn.dataset.busId);
          if (!stop || stop.id === currentStopId || boardingStop) return;
          boardingStop = stop;
          audioSystem.playDoor();
          render();
          this.scanTimer = window.setTimeout(() => {
            if (!this.openState) return;
            this.close();
            onRideToStop(stop);
          }, 420);
        });
      });
    };

    render();
    this.backdrop.style.display = 'flex';
  }

  /**
   * Starlight Lucky Lounge (FREE Fun Tokens only — zero real money, 50/50 transparent odds)
   */
  public openLuckyLoungeModal(initialMode: 'coin_flip' | 'lucky_wheel' = 'coin_flip'): void {
    this.clearActiveLoops();
    this.openState = true;
    let mode = initialMode;
    let stake = 10;
    let pick: 'sun' | 'moon' = 'sun';
    let spinning = false;
    let wheelAngle = 0;
    let flipScale = 1;
    let resultText = 'Play with FREE Fun Tokens only! Transparent 50.0% odds per round.';

    const render = () => {
      const tokens = economySystem.getLoungeTokens();
      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
          <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#22355c]">
            <div>
              <div class="text-[11px] font-bold text-amber-300">STARLIGHT LUCKY LOUNGE · FREE FUN TOKENS ONLY</div>
              <h2 class="font-display text-base sm:text-lg font-bold text-white">${mode === 'coin_flip' ? '50/50 Sun & Moon Flip' : '50/50 Neon Prize Wheel'}</h2>
            </div>
            <button id="cc-act-close" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer">Close</button>
          </div>
          <div class="p-4 space-y-3 overflow-y-auto">
            <div class="flex items-center justify-between text-xs bg-[#091020] border border-amber-400/35 rounded-xl px-3 py-2">
              <span>Fun Tokens: <strong class="text-amber-300 font-mono-tabular">${tokens} FT</strong></span>
              <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">Odds: 50.0%</span>
              <button id="cc-ll-refill" type="button" class="px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-400 text-[#06101f] font-black text-[11px] cursor-pointer">Free +25 FT</button>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button type="button" data-ll-mode="coin_flip" class="cc-ll-mode py-1.5 rounded-lg text-xs font-bold border ${mode === 'coin_flip' ? 'bg-amber-400 text-[#06101f] border-amber-300' : 'bg-[#0d1629] text-slate-300 border-[#22355c]'}">50/50 Coin Flip</button>
              <button type="button" data-ll-mode="lucky_wheel" class="cc-ll-mode py-1.5 rounded-lg text-xs font-bold border ${mode === 'lucky_wheel' ? 'bg-fuchsia-500 text-white border-fuchsia-400' : 'bg-[#0d1629] text-slate-300 border-[#22355c]'}">50/50 Lucky Wheel</button>
            </div>

            <canvas id="cc-ll-canvas" width="320" height="120" class="w-full h-auto rounded-xl bg-[#050914] border border-[#22355c] block"></canvas>

            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="text-slate-300 font-semibold">Pick Side:</span>
              <div class="flex gap-1.5">
                <button type="button" data-ll-pick="sun" class="cc-ll-pick px-3 py-1 rounded-lg font-bold border ${pick === 'sun' ? 'bg-amber-400 text-[#06101f] border-amber-300' : 'bg-[#0d1629] text-slate-300 border-[#22355c]'}">GOLD SUN</button>
                <button type="button" data-ll-pick="moon" class="cc-ll-pick px-3 py-1 rounded-lg font-bold border ${pick === 'moon' ? 'bg-sky-400 text-[#06101f] border-sky-300' : 'bg-[#0d1629] text-slate-300 border-[#22355c]'}">CYAN MOON</button>
              </div>
            </div>

            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="text-slate-300 font-semibold">Fun Stake:</span>
              <div class="flex gap-1.5">
                ${[5, 10, 20]
                  .map(
                    (s) =>
                      `<button type="button" data-ll-stake="${s}" class="cc-ll-stake px-2.5 py-1 rounded-lg font-bold border ${stake === s ? 'bg-emerald-400 text-[#06101f] border-emerald-300' : 'bg-[#0d1629] text-slate-300 border-[#22355c]'}">${s} FT</button>`,
                  )
                  .join('')}
              </div>
            </div>

            <p class="text-xs text-center text-sky-200 bg-[#091020] border border-[#22355c] rounded-lg px-3 py-2">${resultText}</p>

            <button id="cc-ll-play" type="button" ${spinning ? 'disabled' : ''} class="w-full cc-btn-primary py-2.5 rounded-xl text-xs font-black min-h-[42px] cursor-pointer disabled:opacity-50">
              ${spinning ? 'SPINNING...' : mode === 'coin_flip' ? `FLIP TOKEN (${stake} FT)` : `SPIN WHEEL (${stake} FT)`}
            </button>
          </div>
        </div>
      `;

      this.backdrop.querySelector('#cc-act-close')?.addEventListener('click', () => this.close());
      this.backdrop.querySelector('#cc-ll-refill')?.addEventListener('click', () => {
        audioSystem.playCoin();
        const refill = economySystem.claimFreeLoungeTokens();
        resultText = refill.ok
          ? `Claimed +${refill.added} Free Fun Tokens! Ready for 50/50 play.`
          : refill.reason ?? `You already have ${economySystem.getLoungeTokens()} Fun Tokens!`;
        render();
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-ll-mode').forEach((b) =>
        b.addEventListener('click', () => {
          if (spinning) return;
          mode = (b.dataset.llMode as typeof mode) ?? 'coin_flip';
          render();
        }),
      );
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-ll-pick').forEach((b) =>
        b.addEventListener('click', () => {
          if (spinning) return;
          pick = (b.dataset.llPick as typeof pick) ?? 'sun';
          render();
        }),
      );
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-ll-stake').forEach((b) =>
        b.addEventListener('click', () => {
          if (spinning) return;
          stake = Number(b.dataset.llStake) || 10;
          render();
        }),
      );
      this.backdrop.querySelector('#cc-ll-play')?.addEventListener('click', () => {
        if (spinning) return;
        if (economySystem.getLoungeTokens() < stake) {
          audioSystem.playError();
          resultText = 'Not enough Fun Tokens! Tap "Free +25 FT" above for free tokens.';
          render();
          return;
        }
        economySystem.adjustLoungeTokens(-stake);
        spinning = true;
        audioSystem.playInteract();
        const outcome: 'sun' | 'moon' = Math.random() < 0.5 ? 'sun' : 'moon';
        const won = outcome === pick;
        const start = performance.now();
        const dur = 680;
        const animateSpin = (now: number) => {
          if (!this.openState) return;
          const t = Math.min(1, (now - start) / dur);
          wheelAngle = t * Math.PI * 6 + (outcome === 'sun' ? 0.5 : Math.PI + 0.5);
          flipScale = Math.abs(Math.cos(t * Math.PI * 5));
          drawCanvas();
          if (t < 1) {
            this.rafId = requestAnimationFrame(animateSpin);
            return;
          }
          spinning = false;
          flipScale = 1;
          if (won) {
            economySystem.adjustLoungeTokens(stake * 2);
            economySystem.awardXp(10, 'Lucky Lounge Win');
            audioSystem.playCoin();
            this.onCelebrateCb?.();
            resultText = `${outcome === 'sun' ? 'GOLD SUN' : 'CYAN MOON'}! You won +${stake * 2} Fun Tokens (+10 XP)!`;
          } else {
            audioSystem.playError();
            resultText = `Landed ${outcome === 'sun' ? 'GOLD SUN' : 'CYAN MOON'}. 50/50 fair roll — spin again!`;
          }
          render();
        };
        render();
        this.rafId = requestAnimationFrame(animateSpin);
      });
      drawCanvas();
    };

    const drawCanvas = () => {
      const c = this.backdrop.querySelector<HTMLCanvasElement>('#cc-ll-canvas');
      const ctx = c?.getContext('2d');
      if (!ctx || !c) return;
      ctx.fillStyle = '#050914';
      ctx.fillRect(0, 0, c.width, c.height);
      const cx = c.width / 2;
      const cy = c.height / 2;
      if (mode === 'coin_flip') {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(Math.max(0.15, flipScale), 1);
        ctx.fillStyle = pick === 'sun' ? '#fbbf24' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pick === 'sun' ? 'SUN' : 'MOON', 0, 5);
        ctx.restore();
      } else {
        for (let i = 0; i < 6; i++) {
          const a0 = wheelAngle + (i * Math.PI) / 3;
          const a1 = a0 + Math.PI / 3;
          ctx.fillStyle = i % 2 === 0 ? '#fbbf24' : '#38bdf8';
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, 46, a0, a1);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 2, cy - 52, 4, 12);
      }
    };

    render();
    this.backdrop.style.display = 'flex';
  }

  /**
   * Pulse Music & Synth Store playable 8-key WebAudio synthesizer
   */
  public openMusicSynthModal(): void {
    this.clearActiveLoops();
    this.openState = true;
    const notes = [
      {label: 'C4', freq: 261.63, col: 'bg-sky-500'},
      {label: 'D4', freq: 293.66, col: 'bg-indigo-500'},
      {label: 'E4', freq: 329.63, col: 'bg-violet-500'},
      {label: 'F4', freq: 349.23, col: 'bg-fuchsia-500'},
      {label: 'G4', freq: 392.0, col: 'bg-pink-500'},
      {label: 'A4', freq: 440.0, col: 'bg-amber-500'},
      {label: 'B4', freq: 493.88, col: 'bg-emerald-500'},
      {label: 'C5', freq: 523.25, col: 'bg-cyan-400'},
    ];
    let lastPlayed = 'Tap any synth pad to jam!';
    let jamCount = 0;

    const render = () => {
      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-5 text-slate-100 space-y-4">
          <div class="flex items-center justify-between border-b border-[#22355c] pb-3">
            <div>
              <div class="text-xs font-semibold text-cyan-300">PULSE MUSIC & SYNTH STORE</div>
              <h2 class="font-display text-lg font-bold text-white">Starlight Pocket Synth</h2>
            </div>
            <button id="cc-act-close" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer">Close</button>
          </div>
          <p class="text-xs text-sky-200 bg-[#091020] border border-[#22355c] rounded-lg px-3 py-2">${lastPlayed}</p>
          <div class="grid grid-cols-4 gap-2">
            ${notes
              .map(
                (n) => `
                  <button type="button" data-synth-freq="${n.freq}" data-synth-lbl="${n.label}" class="cc-synth-key ${n.col} hover:brightness-110 active:scale-95 text-slate-950 font-black py-4 rounded-xl text-sm shadow-lg transition cursor-pointer">${n.label}</button>
                `,
              )
              .join('')}
          </div>
        </div>
      `;
      this.backdrop.querySelector('#cc-act-close')?.addEventListener('click', () => this.close());
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-synth-key').forEach((btn) => {
        btn.addEventListener('click', () => {
          const freq = Number(btn.dataset.synthFreq) || 440;
          const lbl = btn.dataset.synthLbl ?? 'C4';
          audioSystem.playSynthNote(freq, 0.22, 'triangle', 0.14);
          jamCount += 1;
          if (jamCount === 8) {
            economySystem.awardXp(15, 'Pulse Music Synth Jam');
            lastPlayed = `Played ${lbl}! Groove bonus +15 XP!`;
          } else {
            lastPlayed = `Synth note: ${lbl} (${Math.round(freq)} Hz)`;
          }
          render();
        });
      });
    };

    render();
    this.backdrop.style.display = 'flex';
  }

  /**
   * Apex Repair Workshop — Inspect & restore damaged vehicle condition (%)
   */
  public openRepairBayModal(): void {
    this.clearActiveLoops();
    this.openState = true;
    let feedback = '';

    const render = () => {
      const save = saveSystem.getState();
      const coins = economySystem.getCoins();
      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
          <div class="flex items-center justify-between px-4 py-3 border-b border-[#22355c]">
            <div>
              <div class="text-xs font-semibold text-amber-300">APEX REPAIR WORKSHOP</div>
              <h2 class="font-display text-lg font-bold text-white">Vehicle Diagnostic & Repair Bay</h2>
            </div>
            <button id="cc-act-close" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">Close</button>
          </div>
          <div class="p-4 space-y-3 overflow-y-auto">
            <div class="flex justify-between text-xs bg-[#091020] border border-[#22355c] rounded-xl px-3 py-2">
              <span class="text-slate-300">Owned Vehicles (${save.vehicles.length})</span>
              <span class="font-bold text-amber-300">${coins} Coins</span>
            </div>
            <div class="space-y-2">
              ${save.vehicles
                .map((v) => {
                  const spec = VEHICLE_MODELS.find((m) => m.modelId === v.modelId);
                  const cond = Math.max(0, Math.min(100, Math.round(v.condition ?? 100)));
                  const cost = Math.max(5, Math.round((100 - cond) * 0.5));
                  return `
                    <div class="p-3 rounded-xl bg-[#091020] border border-[#22355c] flex items-center justify-between gap-3">
                      <div class="min-w-0 flex-1">
                        <div class="font-bold text-sm text-white truncate">${spec?.name ?? v.modelId}</div>
                        <div class="mt-1 h-2 w-full rounded bg-slate-800 overflow-hidden">
                          <div class="h-full ${cond > 60 ? 'bg-emerald-400' : cond > 30 ? 'bg-amber-400' : 'bg-rose-500'}" style="width:${cond}%"></div>
                        </div>
                        <div class="text-[11px] text-slate-400 mt-0.5">Condition: ${cond}%</div>
                      </div>
                      <button type="button" data-repair-id="${v.id}" ${cond >= 100 ? 'disabled' : ''} class="cc-rep-btn px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${cond >= 100 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-400 hover:bg-amber-300 text-[#06101f] cursor-pointer'}">
                        ${cond >= 100 ? '100% Mint' : `Repair (${cost}c)`}
                      </button>
                    </div>
                  `;
                })
                .join('')}
            </div>
            ${feedback ? `<div class="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-xs text-emerald-200">${feedback}</div>` : ''}
          </div>
        </div>
      `;
      this.backdrop.querySelector('#cc-act-close')?.addEventListener('click', () => this.close());
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-rep-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.repairId;
          const v = saveSystem.getState().vehicles.find((x) => x.id === id);
          if (!v) return;
          const cond = v.condition ?? 100;
          const cost = Math.max(5, Math.round((100 - cond) * 0.5));
          const rep = economySystem.repairVehicle(v.id, cost);
          if (rep.ok) {
            audioSystem.playCoin();
            feedback = 'Vehicle chassis & engine restored to 100%!';
          } else {
            audioSystem.playError();
            feedback = rep.reason ?? `Need ${cost} Coins for full repair.`;
          }
          render();
        });
      });
    };

    render();
    this.backdrop.style.display = 'flex';
  }

  /**
   * Fire Station Training Drill (Playable MiniGameShell Hose Target Challenge)
   */
  public openFireDrillModal(): void {
    this.clearActiveLoops();
    this.openState = true;
    this.backdrop.style.display = 'none';

    let px = 200;
    let py = 175;
    let step = 0;
    let walkAcc = 0;
    let score = 0;
    let timeLeft = 25;
    let flameX = 110;
    let flameY = 72;
    let sprayTimer = 0;

    const respawnFlame = () => {
      flameX = 64 + Math.random() * 272;
      flameY = 48 + Math.random() * 96;
    };

    this.activeShell = createMiniGameShell(this.parentEl, {
      title: 'Fire Station Hose Drill',
      subtitle: 'CHAOS FIRE DEPT',
      accentColor: 'rose',
      canvasWidth: 400,
      canvasHeight: 240,
      controls: 'dpad',
      actionLabel: 'SPRAY!',
      autoStart: true,
      startPrompt: 'Move near each training flare and press SPRAY to extinguish it!',
      onRestart: () => {
        px = 200;
        py = 175;
        score = 0;
        timeLeft = 25;
        respawnFlame();
      },
      onActionPress: (shell) => {
        if (shell.getPhase() !== 'playing') return;
        sprayTimer = 0.25;
        audioSystem.playInteract();
        if (Math.hypot(px - flameX, py - flameY) < 76) {
          score += 1;
          audioSystem.playCoin();
          respawnFlame();
        }
      },
      onClose: () => {
        if (this.openState) {
          this.openState = false;
          this.activeShell = null;
          this.onCloseCb?.();
        }
      },
      onUpdate: (dt, input, shell) => {
        timeLeft = Math.max(0, timeLeft - dt);
        if (sprayTimer > 0) sprayTimer = Math.max(0, sprayTimer - dt);
        const moving = input.left !== input.right || input.up !== input.down;
        if (input.left) px -= 160 * dt;
        if (input.right) px += 160 * dt;
        if (input.up) py -= 130 * dt;
        if (input.down) py += 130 * dt;
        px = Math.max(36, Math.min(364, px));
        py = Math.max(46, Math.min(208, py));
        if (moving) {
          walkAcc += dt;
          if (walkAcc >= 0.14) {
            walkAcc = 0;
            step = (step + 1) % 4;
          }
        }
        shell.setStats(
          `<span class="text-rose-300">Flares ${score}</span><span class="text-emerald-300">${Math.ceil(timeLeft)}s</span>`,
        );
        if (timeLeft <= 0) {
          const coins = Math.min(40, 8 + score * 4);
          economySystem.awardCoins(coins, 'Fire Station Drill');
          audioSystem.playCoin();
          shell.finish({
            badge: 'Safety Certified',
            headline: `Extinguished ${score} Training Flares!`,
            summary: 'Quick hose positioning kept the drill bay secure.',
            rewardText: `+${coins} Coins · +25 XP`,
          });
        }
      },
      onRender: (ctx, W, H) => {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#334155';
        ctx.fillRect(24, 24, W - 48, H - 48);

        // Flare target
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(flameX, flameY, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(flameX, flameY - 2, 9, 0, Math.PI * 2);
        ctx.fill();

        if (sprayTimer > 0) {
          ctx.strokeStyle = '#7dd3fc';
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(px, py - 10);
          ctx.lineTo(flameX, flameY);
          ctx.stroke();
        }

        drawCustomPlayerOnCanvas(
          ctx,
          px - 22,
          py - 30,
          44,
          56,
          saveSystem.getState(),
          'up',
          step,
          'walk',
        );
      },
    });
  }

  /**
   * Police Precinct Terminal — View active Wanted status & clear record
   */
  public openPoliceTerminalModal(
    wantedStars: number,
    onClearWanted: () => void,
  ): void {
    this.clearActiveLoops();
    this.openState = true;
    let cleared = wantedStars === 0;
    let msg =
      wantedStars > 0
        ? `Active Alert: ${wantedStars} Wanted Star(s). Turn in notice or pay civic fine to clear.`
        : 'Record clean! 0 active Wanted Stars on your resident file.';

    const render = () => {
      this.backdrop.innerHTML = `
        <div class="cc-panel rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-5 text-slate-100 space-y-4">
          <div class="flex items-center justify-between border-b border-[#22355c] pb-3">
            <div>
              <div class="text-xs font-semibold text-sky-300">CHAOS POLICE PRECINCT HQ</div>
              <h2 class="font-display text-lg font-bold text-white">Precinct Dispatch Terminal</h2>
            </div>
            <button id="cc-act-close" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer">Close</button>
          </div>
          <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3.5 space-y-1">
            <div class="text-xs text-slate-400">Active Wanted Level</div>
            <div class="text-lg font-black ${cleared ? 'text-emerald-300' : 'text-amber-300'}">${cleared ? 'CLEAN RECORD (0★)' : '★'.repeat(wantedStars)}</div>
          </div>
          <p class="text-xs text-slate-200">${msg}</p>
          ${
            !cleared
              ? `<button id="cc-pol-clear" type="button" class="w-full cc-btn-primary py-2.5 rounded-xl text-xs font-black cursor-pointer">Clear Wanted Record (15 Coins Civic Fee)</button>`
              : ''
          }
        </div>
      `;
      this.backdrop.querySelector('#cc-act-close')?.addEventListener('click', () => this.close());
      this.backdrop.querySelector('#cc-pol-clear')?.addEventListener('click', () => {
        const fine = 15;
        if (economySystem.getCoins() >= fine) {
          economySystem.spendCoins(fine, 'Police Precinct Clearance');
          onClearWanted();
          cleared = true;
          audioSystem.playCoin();
          msg = 'Civic record cleared! Patrol units have stood down.';
        } else {
          onClearWanted();
          cleared = true;
          audioSystem.playInteract();
          msg = 'Community warning issued and Wanted status cleared!';
        }
        render();
      });
    };

    render();
    this.backdrop.style.display = 'flex';
  }

  /**
   * City Hospital ER Checkup — Reuses interactive ECG Vital Scan + 100% Energy heal
   */
  public openHospitalHealModal(): void {
    this.clearActiveLoops();
    this.openState = true;
    this.openInteractiveClinic(
      'Chaos City Hospital · ER Checkup',
      'CITY MEDICAL CENTER',
      'Run an instant ECG diagnostic scan to restore Energy to 100/100 free of charge.',
    );
  }

  public destroy(): void {
    this.openState = false;
    this.clearActiveLoops(true);
    this.backdrop.remove();
  }
}
