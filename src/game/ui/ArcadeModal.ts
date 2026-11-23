import {drawCustomPlayerOnCanvas} from '@/src/game/graphics/PixelArtGenerator';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {economySystem} from '@/src/game/systems/EconomySystem';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {ArcadeGameId} from '@/src/game/types/gameTypes';
import {createMiniGameShell, MiniGameShellHandle} from '@/src/game/ui/MiniGameShell';

export class ArcadeModal {
  private readonly parentEl: HTMLElement;
  private openState = false;
  private activeShell: MiniGameShellHandle | null = null;
  private onCloseCb?: () => void;

  constructor(parent: HTMLElement, onClose?: () => void) {
    this.parentEl = parent;
    this.onCloseCb = onClose;
  }

  public isOpen(): boolean {
    return this.openState;
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    if (this.activeShell) {
      const sh = this.activeShell;
      this.activeShell = null;
      sh.close();
    }
    this.onCloseCb?.();
  }

  public open(gameId: ArcadeGameId): void {
    if (this.activeShell) {
      this.activeShell.close();
      this.activeShell = null;
    }
    this.openState = true;

    if (gameId === 'starlight_drift') this.launchStarlightDrift();
    else if (gameId === 'brick_blitz') this.launchBrickBlitz();
    else if (gameId === 'turbo_lane_racer') this.launchTurboLaneRacer();
    else if (gameId === 'hoop_frenzy') this.launchHoopFrenzy();
    else if (gameId === 'reflex_surge') this.launchReflexSurge();
    else if (gameId === 'prism_match') this.launchPrismMatch();
    else this.launchMemoryMatrix();
  }

  private awardArcadeEnd(
    shell: MiniGameShellHandle,
    gameId: ArcadeGameId,
    score: number,
    headline: string,
    summary: string,
  ): void {
    const isBest = economySystem.recordHighScore(gameId, score);
    const coins = Math.min(48, Math.max(5, Math.floor(score / 10)));
    economySystem.awardCoins(coins, `Arcade (${gameId})`);
    audioSystem.playCoin();
    shell.finish({
      badge: isBest ? 'New Cabinet Record!' : 'Game Over',
      headline,
      summary,
      rewardText: `+${coins} Coins · +25 XP`,
    });
  }

  private launchStarlightDrift(): void {
    let shipX = 200;
    const shipY = 206;
    let score = 0;
    let shields = 3;
    let timeLeft = 25;
    let spawnTimer = 0;
    const entities: Array<{x: number; y: number; vy: number; kind: 'star' | 'meteor'}> = [];

    const reset = () => {
      shipX = 200;
      score = 0;
      shields = 3;
      timeLeft = 25;
      spawnTimer = 0;
      entities.length = 0;
    };

    this.activeShell = createMiniGameShell(this.parentEl, {
      title: 'CABINET 01 · STARLIGHT DRIFT',
      subtitle: 'PIXEL PALACE ARCADE',
      accentColor: 'sky',
      canvasWidth: 400,
      canvasHeight: 240,
      controls: 'left-right',
      autoStart: true,
      onRestart: reset,
      onClose: () => {
        if (this.openState) {
          this.openState = false;
          this.activeShell = null;
          this.onCloseCb?.();
        }
      },
      onUpdate: (dt, input, shell) => {
        timeLeft = Math.max(0, timeLeft - dt);
        if (input.left) shipX -= 235 * dt;
        if (input.right) shipX += 235 * dt;
        shipX = Math.max(24, Math.min(376, shipX));

        spawnTimer += dt;
        if (spawnTimer >= 0.4) {
          spawnTimer = 0;
          entities.push({
            x: 24 + Math.random() * 352,
            y: -12,
            vy: 115 + Math.random() * 90,
            kind: Math.random() < 0.58 ? 'star' : 'meteor',
          });
        }

        for (let i = entities.length - 1; i >= 0; i--) {
          const ent = entities[i];
          ent.y += ent.vy * dt;
          if (Math.abs(ent.x - shipX) < 18 && Math.abs(ent.y - shipY) < 16) {
            entities.splice(i, 1);
            if (ent.kind === 'star') {
              score += 15;
              audioSystem.playCoin();
            } else {
              shields -= 1;
              audioSystem.playError();
            }
          } else if (ent.y > 256) {
            entities.splice(i, 1);
          }
        }

        const best = Math.max(score, economySystem.getHighScore('starlight_drift'));
        shell.setStats(
          `<span class="text-white">Score ${score}</span><span class="text-sky-300">Best ${best}</span><span class="text-amber-300">🛡️${shields} · ${Math.ceil(timeLeft)}s</span>`,
        );

        if (shields <= 0 || timeLeft <= 0) {
          this.awardArcadeEnd(
            shell,
            'starlight_drift',
            score,
            shields > 0 ? `Sector Cleared · ${score} pts` : `Shields Down · ${score} pts`,
            'Collected starlight shards across the cosmic drift lane.',
          );
        }
      },
      onRender: (ctx, W, H) => {
        const now = performance.now();
        ctx.fillStyle = '#040711';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#1e293b';
        for (let i = 0; i < 20; i++) {
          ctx.fillRect((i * 53) % (W - 4), (now * 0.04 + i * 47) % H, 2, 2);
        }
        // Pilot Avatar HUD Corner
        drawCustomPlayerOnCanvas(ctx, 8, 8, 28, 35, saveSystem.getState(), 'down', 0, 'walk');

        for (const ent of entities) {
          if (ent.kind === 'star') {
            ctx.fillStyle = '#fbbf24';
            ctx.fillRect(ent.x - 6, ent.y - 6, 12, 12);
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(ent.x - 3, ent.y - 3, 6, 6);
          } else {
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(ent.x - 8, ent.y - 8, 16, 16);
            ctx.fillStyle = '#991b1b';
            ctx.fillRect(ent.x - 4, ent.y - 4, 8, 8);
          }
        }
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(shipX - 13, shipY - 2, 26, 10);
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(shipX - 4, shipY - 10, 8, 12);
      },
    });
  }

  private launchBrickBlitz(): void {
    let paddleX = 166;
    const paddleW = 68;
    let ballX = 200;
    let ballY = 185;
    let ballVx = 150;
    let ballVy = -165;
    let score = 0;
    let lives = 3;
    const bricks: Array<{x: number; y: number; w: number; h: number; alive: boolean; color: string}> = [];

    const reset = () => {
      paddleX = 166;
      ballX = 200;
      ballY = 185;
      ballVx = 150;
      ballVy = -165;
      score = 0;
      lives = 3;
      bricks.length = 0;
      const colors = ['#f43f5e', '#f59e0b', '#10b981', '#38bdf8'];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 8; c++) {
          bricks.push({x: 24 + c * 44, y: 24 + r * 18, w: 40, h: 13, alive: true, color: colors[r]});
        }
      }
    };
    reset();

    this.activeShell = createMiniGameShell(this.parentEl, {
      title: 'CABINET 02 · BRICK BLITZ',
      subtitle: 'PIXEL PALACE ARCADE',
      accentColor: 'rose',
      canvasWidth: 400,
      canvasHeight: 240,
      controls: 'left-right',
      autoStart: true,
      onRestart: reset,
      onClose: () => {
        if (this.openState) {
          this.openState = false;
          this.activeShell = null;
          this.onCloseCb?.();
        }
      },
      onUpdate: (dt, input, shell) => {
        if (input.left) paddleX -= 265 * dt;
        if (input.right) paddleX += 265 * dt;
        paddleX = Math.max(8, Math.min(392 - paddleW, paddleX));

        ballX += ballVx * dt;
        ballY += ballVy * dt;
        if (ballX <= 6) {
          ballX = 6;
          ballVx = Math.abs(ballVx);
        } else if (ballX >= 394) {
          ballX = 394;
          ballVx = -Math.abs(ballVx);
        }
        if (ballY <= 6) {
          ballY = 6;
          ballVy = Math.abs(ballVy);
        }

        if (ballVy > 0 && ballY >= 210 && ballY <= 222 && ballX >= paddleX - 4 && ballX <= paddleX + paddleW + 4) {
          const hitNorm = (ballX - (paddleX + paddleW / 2)) / (paddleW / 2);
          ballVx = hitNorm * 220;
          ballVy = -Math.abs(ballVy);
          audioSystem.playButtonClick();
        }

        let remaining = 0;
        for (const b of bricks) {
          if (!b.alive) continue;
          remaining++;
          if (ballX >= b.x - 4 && ballX <= b.x + b.w + 4 && ballY >= b.y - 4 && ballY <= b.y + b.h + 4) {
            b.alive = false;
            remaining--;
            score += 10;
            ballVy = -ballVy;
            audioSystem.playInteract();
            break;
          }
        }

        if (remaining === 0) {
          score += 50;
          this.awardArcadeEnd(shell, 'brick_blitz', score, `Wave Cleared · ${score} pts!`, 'Destroyed every neon brick!');
          return;
        }

        if (ballY > 246) {
          lives -= 1;
          audioSystem.playError();
          if (lives <= 0) {
            this.awardArcadeEnd(shell, 'brick_blitz', score, `Final Score · ${score} pts`, 'Out of arcade balls!');
            return;
          }
          ballX = paddleX + paddleW / 2;
          ballY = 195;
          ballVx = 145;
          ballVy = -165;
        }

        const best = Math.max(score, economySystem.getHighScore('brick_blitz'));
        shell.setStats(
          `<span class="text-white">Score ${score}</span><span class="text-sky-300">Best ${best}</span><span class="text-rose-300">♥${lives}</span>`,
        );
      },
      onRender: (ctx, W, H) => {
        ctx.fillStyle = '#040711';
        ctx.fillRect(0, 0, W, H);
        for (const b of bricks) {
          if (!b.alive) continue;
          ctx.fillStyle = b.color;
          ctx.fillRect(b.x, b.y, b.w, b.h);
        }
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(paddleX, 214, paddleW, 9);
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(ballX - 5, ballY - 5, 10, 10);
      },
    });
  }

  private launchTurboLaneRacer(): void {
    const laneXs = [132, 200, 268];
    let laneIdx = 1;
    let carX = laneXs[1];
    let score = 0;
    let timeLeft = 30;
    let spawnT = 0;
    let stepCd = 0;
    const obs: Array<{lane: number; y: number; isStar: boolean}> = [];

    const reset = () => {
      laneIdx = 1;
      carX = laneXs[1];
      score = 0;
      timeLeft = 30;
      spawnT = 0;
      obs.length = 0;
    };

    this.activeShell = createMiniGameShell(this.parentEl, {
      title: 'CABINET 03 · TURBO LANE RACER',
      subtitle: 'PIXEL PALACE ARCADE',
      accentColor: 'amber',
      canvasWidth: 400,
      canvasHeight: 240,
      controls: 'left-right',
      autoStart: true,
      onRestart: reset,
      onClose: () => {
        if (this.openState) {
          this.openState = false;
          this.activeShell = null;
          this.onCloseCb?.();
        }
      },
      onUpdate: (dt, input, shell) => {
        timeLeft = Math.max(0, timeLeft - dt);
        score += dt * 12;
        if (stepCd > 0) stepCd = Math.max(0, stepCd - dt);
        if (stepCd === 0) {
          if (input.left && laneIdx > 0) {
            laneIdx -= 1;
            stepCd = 0.16;
          } else if (input.right && laneIdx < 2) {
            laneIdx += 1;
            stepCd = 0.16;
          }
        }
        carX += (laneXs[laneIdx] - carX) * Math.min(1, dt * 15);

        spawnT += dt;
        if (spawnT >= 0.56) {
          spawnT = 0;
          obs.push({
            lane: Math.floor(Math.random() * 3),
            y: -28,
            isStar: Math.random() < 0.32,
          });
        }

        for (let i = obs.length - 1; i >= 0; i--) {
          const o = obs[i];
          o.y += 185 * dt;
          if (Math.abs(laneXs[o.lane] - carX) < 24 && Math.abs(o.y - 196) < 22) {
            obs.splice(i, 1);
            if (o.isStar) {
              score += 25;
              audioSystem.playCoin();
            } else {
              audioSystem.playError();
              this.awardArcadeEnd(
                shell,
                'turbo_lane_racer',
                Math.round(score),
                `Crash! Score ${Math.round(score)}`,
                'Dodged highway express traffic at top speed!',
              );
              return;
            }
          } else if (o.y > 260) {
            obs.splice(i, 1);
          }
        }

        const sc = Math.round(score);
        shell.setStats(
          `<span class="text-amber-300">Score ${sc}</span><span class="text-emerald-300">${Math.ceil(timeLeft)}s</span>`,
        );
        if (timeLeft <= 0) {
          this.awardArcadeEnd(
            shell,
            'turbo_lane_racer',
            sc,
            `Finish Line · ${sc} pts!`,
            'Completed the 30-second Turbo Highway run!',
          );
        }
      },
      onRender: (ctx, W, H) => {
        const now = performance.now();
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#334155';
        ctx.fillRect(92, 0, 216, H);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(94, 0, 4, H);
        ctx.fillRect(302, 0, 4, H);
        const dashOffset = (now * 0.25) % 36;
        ctx.fillStyle = '#f8fafc';
        for (let y = -36 + dashOffset; y < H; y += 36) {
          ctx.fillRect(164, y, 4, 20);
          ctx.fillRect(232, y, 4, 20);
        }

        for (const o of obs) {
          const ox = laneXs[o.lane];
          if (o.isStar) {
            ctx.fillStyle = '#fde047';
            ctx.fillRect(ox - 8, o.y - 8, 16, 16);
          } else {
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(ox - 14, o.y - 18, 28, 36);
            ctx.fillStyle = '#7dd3fc';
            ctx.fillRect(ox - 10, o.y - 8, 20, 10);
          }
        }

        // Player GT racer
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(carX - 14, 178, 28, 38);
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(carX - 10, 186, 20, 10);
      },
    });
  }

  private launchHoopFrenzy(): void {
    let playerX = 200;
    let step = 0;
    let walkAcc = 0;
    let hoopX = 200;
    let hoopDir = 1;
    let ballActive = false;
    let bx = 200;
    let by = 180;
    let score = 0;
    let timeLeft = 28;

    const reset = () => {
      playerX = 200;
      hoopX = 200;
      ballActive = false;
      score = 0;
      timeLeft = 28;
    };

    this.activeShell = createMiniGameShell(this.parentEl, {
      title: 'CABINET 04 · HOOP FRENZY',
      subtitle: 'PIXEL PALACE ARCADE',
      accentColor: 'amber',
      canvasWidth: 400,
      canvasHeight: 240,
      controls: 'left-right',
      actionLabel: 'SHOOT',
      autoStart: true,
      onRestart: reset,
      onActionPress: () => {
        if (!ballActive) {
          ballActive = true;
          bx = playerX;
          by = 172;
          audioSystem.playSwish();
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
        const moving = input.left !== input.right;
        if (input.left) playerX -= 185 * dt;
        if (input.right) playerX += 185 * dt;
        playerX = Math.max(52, Math.min(348, playerX));
        if (moving) {
          walkAcc += dt;
          if (walkAcc >= 0.14) {
            walkAcc = 0;
            step = (step + 1) % 4;
          }
        }
        hoopX += hoopDir * (85 + score * 0.4) * dt;
        if (hoopX > 328) {
          hoopX = 328;
          hoopDir = -1;
        } else if (hoopX < 72) {
          hoopX = 72;
          hoopDir = 1;
        }

        if (ballActive) {
          by -= 330 * dt;
          if (by <= 68) {
            ballActive = false;
            if (Math.abs(bx - hoopX) < 30) {
              score += 20;
              audioSystem.playCoin();
            } else {
              audioSystem.playError();
            }
          }
        }

        shell.setStats(
          `<span class="text-amber-300">Score ${score}</span><span class="text-emerald-300">${Math.ceil(timeLeft)}s</span>`,
        );
        if (timeLeft <= 0) {
          this.awardArcadeEnd(
            shell,
            'hoop_frenzy',
            score,
            `Buzzer! ${score} pts`,
            'Fast-break arcade shooting streak!',
          );
        }
      },
      onRender: (ctx, W, H) => {
        ctx.fillStyle = '#0c162b';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#92400e';
        ctx.fillRect(0, 178, W, H - 178);
        // Moving Rim
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(hoopX - 32, 24, 64, 38);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(hoopX - 24, 62, 48, 6);
        if (ballActive) {
          ctx.fillStyle = '#fb923c';
          ctx.beginPath();
          ctx.arc(bx, by, 9, 0, Math.PI * 2);
          ctx.fill();
        }
        drawCustomPlayerOnCanvas(
          ctx,
          playerX - 24,
          164,
          48,
          60,
          saveSystem.getState(),
          'up',
          step,
          'walk',
        );
      },
    });
  }

  private launchReflexSurge(): void {
    type DirKey = 'up' | 'down' | 'left' | 'right';
    const dirs: DirKey[] = ['up', 'down', 'left', 'right'];
    let targetDir: DirKey = dirs[Math.floor(Math.random() * 4)];
    let score = 0;
    let timeLeft = 25;
    let prevMask = {up: false, down: false, left: false, right: false};

    const nextTarget = () => {
      targetDir = dirs[Math.floor(Math.random() * 4)];
    };

    this.activeShell = createMiniGameShell(this.parentEl, {
      title: 'CABINET 05 · REFLEX SURGE',
      subtitle: 'PIXEL PALACE ARCADE',
      accentColor: 'emerald',
      canvasWidth: 400,
      canvasHeight: 240,
      controls: 'dpad',
      autoStart: true,
      onRestart: () => {
        score = 0;
        timeLeft = 25;
        prevMask.up = false;
        prevMask.down = false;
        prevMask.left = false;
        prevMask.right = false;
        nextTarget();
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
        for (const d of dirs) {
          if (input[d] && !prevMask[d]) {
            if (d === targetDir) {
              score += 15;
              audioSystem.playCoin();
              nextTarget();
            } else {
              score = Math.max(0, score - 5);
              audioSystem.playError();
            }
          }
          prevMask[d] = input[d];
        }
        shell.setStats(
          `<span class="text-emerald-300">Score ${score}</span><span class="text-amber-300">${Math.ceil(timeLeft)}s</span>`,
        );
        if (timeLeft <= 0) {
          this.awardArcadeEnd(
            shell,
            'reflex_surge',
            score,
            `Reflex Score · ${score} pts`,
            'Matched neon directional pulses in real time!',
          );
        }
      },
      onRender: (ctx, W, H) => {
        ctx.fillStyle = '#040914';
        ctx.fillRect(0, 0, W, H);
        const cx = W / 2;
        const cy = H / 2;
        const nodes: Array<{d: DirKey; x: number; y: number; lbl: string}> = [
          {d: 'up', x: cx - 32, y: 26, lbl: '▲ UP'},
          {d: 'down', x: cx - 32, y: 162, lbl: '▼ DOWN'},
          {d: 'left', x: 74, y: cy - 26, lbl: '◀ LEFT'},
          {d: 'right', x: W - 138, y: cy - 26, lbl: 'RIGHT ▶'},
        ];
        for (const n of nodes) {
          const active = n.d === targetDir;
          ctx.fillStyle = active ? '#22c55e' : '#1e293b';
          ctx.fillRect(n.x, n.y, 64, 52);
          ctx.strokeStyle = active ? '#fde047' : '#475569';
          ctx.lineWidth = active ? 3 : 2;
          ctx.strokeRect(n.x, n.y, 64, 52);
          ctx.fillStyle = active ? '#052e16' : '#cbd5e1';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(n.lbl, n.x + 32, n.y + 30);
        }
      },
    });
  }

  private launchPrismMatch(): void {
    const colors = ['#f43f5e', '#38bdf8', '#fbbf24', '#34d399', '#a78bfa', '#fb923c', '#f472b6', '#22d3ee'];
    let cards: Array<{col: string; open: boolean; matched: boolean}> = [];
    let curIdx = 0;
    let firstPick: number | null = null;
    let hideTimer = 0;
    let pendingPair: [number, number] | null = null;
    let moves = 0;
    let matches = 0;
    let moveCd = 0;

    const reset = () => {
      const pool = [...colors, ...colors];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      cards = pool.map((col) => ({col, open: false, matched: false}));
      curIdx = 0;
      firstPick = null;
      hideTimer = 0;
      pendingPair = null;
      moves = 0;
      matches = 0;
      moveCd = 0;
    };
    reset();

      const flipCurrentCard = (shell: MiniGameShellHandle) => {
        if (pendingPair) return;
        const card = cards[curIdx];
        if (!card || card.open || card.matched) return;
        card.open = true;
        audioSystem.playInteract();
        if (firstPick === null) {
          firstPick = curIdx;
        } else {
          moves += 1;
          if (cards[firstPick].col === card.col) {
            cards[firstPick].matched = true;
            card.matched = true;
            firstPick = null;
            matches += 1;
            audioSystem.playCoin();
            if (matches >= 8) {
              const score = Math.max(40, 220 - moves * 8);
              this.awardArcadeEnd(shell, 'prism_match', score, `Board Cleared · ${moves} Moves!`, 'All 8 prism pairs synchronized!');
            }
          } else {
            pendingPair = [firstPick, curIdx];
            firstPick = null;
            hideTimer = 0.45;
          }
        }
      };

    this.activeShell = createMiniGameShell(this.parentEl, {
      title: 'CABINET 06 · PRISM MATCH',
      subtitle: 'PIXEL PALACE ARCADE',
      accentColor: 'violet',
      canvasWidth: 400,
      canvasHeight: 240,
      controls: 'dpad',
      actionLabel: 'FLIP',
      autoStart: true,
      onRestart: reset,
      onActionPress: flipCurrentCard,
      onCanvasPointerDown: (cx, cy, shell) => {
        for (let i = 0; i < 16; i++) {
          const r = Math.floor(i / 4);
          const c = i % 4;
          const x = 86 + c * 58;
          const y = 20 + r * 52;
          if (cx >= x && cx <= x + 50 && cy >= y && cy <= y + 44) {
            curIdx = i;
            flipCurrentCard(shell);
            break;
          }
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
        if (pendingPair) {
          hideTimer -= dt;
          if (hideTimer <= 0) {
            cards[pendingPair[0]].open = false;
            cards[pendingPair[1]].open = false;
            pendingPair = null;
          }
        }
        if (moveCd > 0) moveCd = Math.max(0, moveCd - dt);
        if (moveCd === 0) {
          if (input.left) {
            curIdx = (curIdx + 15) % 16;
            moveCd = 0.14;
          } else if (input.right) {
            curIdx = (curIdx + 1) % 16;
            moveCd = 0.14;
          } else if (input.up) {
            curIdx = (curIdx + 12) % 16;
            moveCd = 0.14;
          } else if (input.down) {
            curIdx = (curIdx + 4) % 16;
            moveCd = 0.14;
          }
        }
        shell.setStats(
          `<span class="text-violet-300">Pairs ${matches}/8</span><span class="text-slate-300">Moves ${moves}</span>`,
        );
      },
      onRender: (ctx, W, H) => {
        ctx.fillStyle = '#080b18';
        ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 16; i++) {
          const r = Math.floor(i / 4);
          const c = i % 4;
          const x = 86 + c * 58;
          const y = 20 + r * 52;
          const card = cards[i];
          ctx.fillStyle = card.open || card.matched ? card.col : '#1e293b';
          ctx.fillRect(x, y, 50, 44);
          ctx.strokeStyle = i === curIdx ? '#fde047' : '#475569';
          ctx.lineWidth = i === curIdx ? 3 : 1.5;
          ctx.strokeRect(x, y, 50, 44);
        }
      },
    });
  }

  private launchMemoryMatrix(): void {
    let curIdx = 4;
    let moveCd = 0;
    let level = 1;
    let targets = new Set<number>();
    let picked = new Set<number>();
    let revealTimer = 1.6;
    let score = 0;

    const setupLevel = () => {
      targets.clear();
      picked.clear();
      const count = Math.min(6, 2 + level);
      while (targets.size < count) {
        targets.add(Math.floor(Math.random() * 9));
      }
      revealTimer = 1.5;
    };
    setupLevel();

    const markCurrentCell = (shell: MiniGameShellHandle) => {
      if (revealTimer > 0 || picked.has(curIdx)) return;
      if (targets.has(curIdx)) {
        picked.add(curIdx);
        score += 20;
        audioSystem.playCoin();
        if (picked.size >= targets.size) {
          if (level >= 4) {
            this.awardArcadeEnd(shell, 'memory_matrix', score + 50, `Matrix Master · ${score + 50} pts!`, 'Cleared all 4 cyber matrix waves!');
            return;
          }
          level += 1;
          setupLevel();
        }
      } else {
        audioSystem.playError();
        this.awardArcadeEnd(shell, 'memory_matrix', score, `Grid Fault · ${score} pts`, `Reached Cyber Matrix Wave ${level}.`);
      }
    };

    this.activeShell = createMiniGameShell(this.parentEl, {
      title: 'CABINET 07 · MEMORY MATRIX',
      subtitle: 'PIXEL PALACE ARCADE',
      accentColor: 'sky',
      canvasWidth: 400,
      canvasHeight: 240,
      controls: 'dpad',
      actionLabel: 'MARK',
      autoStart: true,
      onRestart: () => {
        curIdx = 4;
        moveCd = 0;
        level = 1;
        score = 0;
        setupLevel();
      },
      onActionPress: markCurrentCell,
      onCanvasPointerDown: (cx, cy, shell) => {
        for (let i = 0; i < 9; i++) {
          const r = Math.floor(i / 3);
          const c = i % 3;
          const x = 104 + c * 66;
          const y = 32 + r * 64;
          if (cx >= x && cx <= x + 58 && cy >= y && cy <= y + 56) {
            curIdx = i;
            markCurrentCell(shell);
            break;
          }
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
        if (revealTimer > 0) revealTimer = Math.max(0, revealTimer - dt);
        if (moveCd > 0) moveCd = Math.max(0, moveCd - dt);
        if (moveCd === 0) {
          if (input.left) {
            curIdx = (curIdx + 8) % 9;
            moveCd = 0.14;
          } else if (input.right) {
            curIdx = (curIdx + 1) % 9;
            moveCd = 0.14;
          } else if (input.up) {
            curIdx = (curIdx + 6) % 9;
            moveCd = 0.14;
          } else if (input.down) {
            curIdx = (curIdx + 3) % 9;
            moveCd = 0.14;
          }
        }
        shell.setStats(
          `<span class="text-sky-300">Wave ${level}/4</span><span class="text-amber-300">Score ${score}</span>`,
        );
      },
      onRender: (ctx, W, H) => {
        ctx.fillStyle = '#040814';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#bae6fd';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          revealTimer > 0 ? 'MEMORIZE THE GLOWING BLUE CELLS!' : `MARK ALL ${targets.size} CELLS`,
          W / 2,
          20,
        );
        for (let i = 0; i < 9; i++) {
          const r = Math.floor(i / 3);
          const c = i % 3;
          const x = 104 + c * 66;
          const y = 32 + r * 64;
          const lit = (revealTimer > 0 && targets.has(i)) || picked.has(i);
          ctx.fillStyle = lit ? '#38bdf8' : '#1e293b';
          ctx.fillRect(x, y, 58, 56);
          ctx.strokeStyle = i === curIdx ? '#fde047' : '#475569';
          ctx.lineWidth = i === curIdx ? 3 : 2;
          ctx.strokeRect(x, y, 58, 56);
        }
      },
    });
  }

  public destroy(): void {
    this.openState = false;
    if (this.activeShell) {
      const sh = this.activeShell;
      this.activeShell = null;
      sh.close(true);
    }
  }
}
