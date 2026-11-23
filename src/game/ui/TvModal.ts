import {audioSystem} from '@/src/game/systems/AudioSystem';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {GameSettings} from '@/src/game/types/gameTypes';

export interface TvModalCallbacks {
  onPowerChanged?: (isOn: boolean) => void;
  onSettingsChanged?: (settings: GameSettings) => void;
  onSitToggle?: () => boolean;
  isSitting?: () => boolean;
  onClose?: () => void;
}

interface TvChannel {
  num: number;
  callSign: string;
  title: string;
  tag: string;
  accent: string;
}

const TV_CHANNELS: TvChannel[] = [
  {num: 1, callSign: 'WCCY', title: 'CHAOS CITY Live News', tag: 'NEWS', accent: '#38bdf8'},
  {num: 2, callSign: 'SPTS', title: 'Eastside Hoops Highlight', tag: 'SPORTS', accent: '#f97316'},
  {num: 3, callSign: 'SKY3', title: 'Central Park Sky Weather', tag: 'WEATHER', accent: '#34d399'},
  {num: 4, callSign: 'TOON', title: 'Starlight Retro Squadron', tag: 'CARTOON', accent: '#a855f7'},
  {num: 5, callSign: 'BEAT', title: 'Boulevard Lo-Fi Chill', tag: 'MUSIC', accent: '#ec4899'},
];

const esc = (str: string): string =>
  String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

export class TvModal {
  private readonly backdrop: HTMLDivElement;
  private openState = false;
  private isPowerOn = true;
  private channelIdx = 0;
  private rafId: number | null = null;
  private lastTickMs = 0;
  private elapsedSec = 0;
  private canvas: HTMLCanvasElement | null = null;

  constructor(
    parent: HTMLElement,
    private readonly callbacks: TvModalCallbacks = {},
  ) {
    this.backdrop = document.createElement('div');
    this.backdrop.className =
      'ui-interactive fixed inset-0 z-40 hidden items-center justify-center bg-[#040812]/82 p-3 sm:p-4';
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

  public getIsPowerOn(): boolean {
    return this.isPowerOn;
  }

  public open(title = 'Living Room Smart TV', subtitle = 'WCCY Digital Cable · 5 Live Channels', initialPowerOn = true): void {
    this.openState = true;
    this.isPowerOn = initialPowerOn;
    this.elapsedSec = 0;
    this.callbacks.onPowerChanged?.(this.isPowerOn);
    this.render(title, subtitle);
    this.backdrop.style.display = 'flex';
    this.startLoop();
  }

  public close(): void {
    if (!this.openState) return;
    this.stopLoop();
    this.openState = false;
    this.canvas = null;
    this.backdrop.style.display = 'none';
    this.backdrop.innerHTML = '';
    this.callbacks.onClose?.();
  }

  private render(title: string, subtitle: string): void {
    const curCh = TV_CHANNELS[this.channelIdx];
    const audio = saveSystem.getState().settings.audio;
    const masterVolPct = Math.round(((audio.musicVolume + audio.sfxVolume) * 0.5) * 100);
    const sitting = this.callbacks.isSitting?.() ?? false;

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-xl max-h-[92dvh] overflow-y-auto p-4 sm:p-5 text-slate-100 space-y-3.5">
        <div class="flex items-center justify-between gap-2 border-b border-[#22355c] pb-3">
          <div class="min-w-0">
            <div class="text-xs font-semibold text-sky-300 truncate">${esc(subtitle)}</div>
            <h2 class="font-display text-lg font-bold text-white truncate">${esc(title)}</h2>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            ${
              this.callbacks.onSitToggle
                ? `<button id="cc-tv-sit" type="button" class="cc-btn-secondary px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] cursor-pointer">${sitting ? 'Stand Up' : 'Sit on Sofa'}</button>`
                : ''
            }
            <button id="cc-tv-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[44px] cursor-pointer">
              Close
            </button>
          </div>
        </div>

        <!-- Screen Frame -->
        <div class="rounded-xl bg-[#04070f] border-4 border-[#1f2937] p-2 shadow-inner">
          <div class="flex items-center justify-between px-2 pb-1.5 text-[11px] font-mono-tabular">
            <span class="${this.isPowerOn ? 'text-sky-300 font-bold' : 'text-slate-500'}">
              ${this.isPowerOn ? `CH 0${curCh.num} · ${curCh.callSign} · ${curCh.title}` : 'STANDBY MODE · SIGNAL OFF'}
            </span>
            <span class="px-2 py-0.5 rounded bg-[#0d1629] border border-[#22355c] ${this.isPowerOn ? 'text-emerald-300' : 'text-slate-500'}">
              ${this.isPowerOn ? curCh.tag : 'OFF'}
            </span>
          </div>
          <canvas id="cc-tv-canvas" width="440" height="236" class="w-full h-auto rounded-lg border border-[#22355c] bg-[#060b16] block"></canvas>
        </div>

        <!-- Remote Control Deck -->
        <div class="rounded-xl bg-[#091020] border border-[#22355c] p-3 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <button id="cc-tv-power" type="button" class="px-4 py-2 rounded-lg text-xs font-bold min-h-[44px] cursor-pointer border ${
              this.isPowerOn
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                : 'bg-rose-500/20 border-rose-400 text-rose-200'
            }">
              Power: ${this.isPowerOn ? 'ON' : 'OFF'}
            </button>

            <div class="flex items-center gap-1.5">
              <button id="cc-tv-prev" type="button" class="cc-btn-secondary px-3 py-2 rounded-lg text-xs font-bold min-h-[44px] cursor-pointer">
                Ch -
              </button>
              <button id="cc-tv-next" type="button" class="cc-btn-secondary px-3 py-2 rounded-lg text-xs font-bold min-h-[44px] cursor-pointer">
                Ch +
              </button>
            </div>

            <button id="cc-tv-mute" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[44px] cursor-pointer ${
              audio.muted ? 'border-amber-400 text-amber-300' : ''
            }">
              ${audio.muted ? 'Unmute Audio' : 'Mute Audio'}
            </button>
          </div>

          <div class="grid grid-cols-5 gap-1.5">
            ${TV_CHANNELS.map(
              (ch, i) => `
                <button type="button" data-tv-ch="${i}" class="cc-tv-ch-btn px-2 py-2 rounded-lg text-[11px] font-bold min-h-[44px] cursor-pointer border ${
                  this.channelIdx === i && this.isPowerOn
                    ? 'bg-sky-500 text-[#06101f] border-sky-300'
                    : 'bg-[#0d1629] text-slate-300 border-[#22355c] hover:border-sky-400/50'
                }">
                  CH ${ch.num}<br/><span class="text-[9px] font-normal opacity-80">${ch.callSign}</span>
                </button>
              `,
            ).join('')}
          </div>

          <div class="flex items-center gap-3 pt-1">
            <label for="cc-tv-vol" class="text-xs font-semibold text-slate-300 shrink-0">TV &amp; Game Volume</label>
            <input id="cc-tv-vol" type="range" min="0" max="100" value="${masterVolPct}" class="cc-slider flex-1" />
            <span id="cc-tv-vol-val" class="font-mono-tabular text-xs text-sky-300 w-10 text-right">${masterVolPct}%</span>
          </div>
        </div>
      </div>
    `;

    this.canvas = this.backdrop.querySelector('#cc-tv-canvas');

    this.backdrop.querySelector('#cc-tv-close')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.close();
    });

    this.backdrop.querySelector('#cc-tv-sit')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.callbacks.onSitToggle?.();
      this.render(title, subtitle);
    });

    this.backdrop.querySelector('#cc-tv-power')?.addEventListener('click', () => {
      this.isPowerOn = !this.isPowerOn;
      audioSystem.playChannelSwitch();
      this.callbacks.onPowerChanged?.(this.isPowerOn);
      this.render(title, subtitle);
    });

    this.backdrop.querySelector('#cc-tv-prev')?.addEventListener('click', () => {
      if (!this.isPowerOn) this.isPowerOn = true;
      this.channelIdx = (this.channelIdx - 1 + TV_CHANNELS.length) % TV_CHANNELS.length;
      audioSystem.playChannelSwitch();
      this.callbacks.onPowerChanged?.(true);
      this.render(title, subtitle);
    });

    this.backdrop.querySelector('#cc-tv-next')?.addEventListener('click', () => {
      if (!this.isPowerOn) this.isPowerOn = true;
      this.channelIdx = (this.channelIdx + 1) % TV_CHANNELS.length;
      audioSystem.playChannelSwitch();
      this.callbacks.onPowerChanged?.(true);
      this.render(title, subtitle);
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-tv-ch-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextIdx = Number(btn.dataset.tvCh);
        if (!Number.isFinite(nextIdx)) return;
        this.isPowerOn = true;
        this.channelIdx = nextIdx;
        audioSystem.playChannelSwitch();
        this.callbacks.onPowerChanged?.(true);
        this.render(title, subtitle);
      });
    });

    this.backdrop.querySelector('#cc-tv-mute')?.addEventListener('click', () => {
      const cur = saveSystem.getState().settings.audio;
      const updated = saveSystem.updateSettings({
        audio: {...cur, muted: !cur.muted},
      });
      audioSystem.applySettings(updated.settings.audio);
      audioSystem.playButtonClick();
      this.callbacks.onSettingsChanged?.(updated.settings);
      this.render(title, subtitle);
    });

    const volInput = this.backdrop.querySelector<HTMLInputElement>('#cc-tv-vol');
    const volVal = this.backdrop.querySelector('#cc-tv-vol-val');
    volInput?.addEventListener('input', () => {
      const val = Number(volInput.value) / 100;
      if (volVal) volVal.textContent = `${volInput.value}%`;
      const cur = saveSystem.getState().settings.audio;
      const updated = saveSystem.updateSettings({
        audio: {
          ...cur,
          musicVolume: val,
          sfxVolume: Math.min(1, val + 0.1),
          muted: val === 0 ? true : false,
        },
      });
      audioSystem.applySettings(updated.settings.audio);
      this.callbacks.onSettingsChanged?.(updated.settings);
    });
  }

  private startLoop(): void {
    this.stopLoop();
    this.lastTickMs = performance.now();
    const tick = (now: number) => {
      if (!this.openState) return;
      const dtSec = Math.min(0.05, Math.max(0.001, (now - this.lastTickMs) / 1000));
      this.lastTickMs = now;
      this.elapsedSec += dtSec;
      this.drawFrame();
      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private drawFrame(): void {
    const ctx = this.canvas?.getContext('2d');
    if (!ctx || !this.canvas) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const t = this.elapsedSec;

    if (!this.isPowerOn) {
      ctx.fillStyle = '#050811';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.strokeRect(12, 12, W - 24, H - 24);
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 14px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TV POWER OFF', W / 2, H / 2 - 6);
      ctx.font = '11px Plus Jakarta Sans, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Press Power ON to tune into CHAOS CITY cable.', W / 2, H / 2 + 16);
      return;
    }

    const ch = TV_CHANNELS[this.channelIdx];
    ctx.clearRect(0, 0, W, H);

    if (ch.num === 1) {
      // WCCY News Desk
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0b1e3f');
      grad.addColorStop(1, '#102a54');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // City skyline backdrop silhouettes
      ctx.fillStyle = '#17386d';
      [20, 62, 108, 164, 232, 290, 344, 390].forEach((bx, idx) => {
        const bh = 42 + ((idx * 23) % 58);
        ctx.fillRect(bx, 138 - bh, 34, bh);
      });

      // Anchor Desk
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 146, W, 56);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(0, 146, W, 4);

      // Animated News Anchor (bobs gently while talking)
      const bob = Math.round(Math.sin(t * 5.2) * 1.5);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(184, 104 + bob, 56, 42); // suit
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(204, 108 + bob, 16, 20); // shirt
      ctx.fillStyle = '#e0ac69';
      ctx.fillRect(194, 70 + bob, 36, 36); // head
      ctx.fillStyle = '#312e81';
      ctx.fillRect(192, 64 + bob, 40, 12); // hair
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(202, 84 + bob, 4, 4);
      ctx.fillRect(218, 84 + bob, 4, 4);
      const mouthH = Math.floor((t * 6) % 2) === 0 ? 4 : 2;
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(206, 94 + bob, 12, mouthH);

      // Headline graphic
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(16, 16, 118, 22);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('WCCY LIVE DESK', 24, 31);

      // Scrolling news ticker
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(0, H - 30, W, 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Plus Jakarta Sans, sans-serif';
      const ticker =
        'BREAKING: Central Park Fountain coin blessings boost energy!  ·  New drivable Roadsters parked downtown!  ·  Pixel Palace Arcade hosts high-score playoffs tonight!   ';
      const tw = ctx.measureText(ticker).width;
      const offset = (t * 68) % tw;
      ctx.fillText(ticker, 16 - offset, H - 11);
      ctx.fillText(ticker, 16 - offset + tw, H - 11);
    } else if (ch.num === 2) {
      // Eastside Hoops Sports
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(0, 152, W, H - 152);
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 2;
      ctx.strokeRect(22, 158, W - 44, 62);

      // Hoop
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(354, 48, 8, 54);
      ctx.strokeStyle = '#ef4444';
      ctx.strokeRect(334, 62, 22, 18);
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(322, 82, 34, 5);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(326, 87, 26, 20);

      // Bouncing Basketball Trajectory
      const bx = 74 + ((t * 115) % 276);
      const norm = ((bx - 74) / 276);
      const by = 148 - Math.sin(norm * Math.PI) * 92;
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(bx, by, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7c2d12';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Scorebug
      ctx.fillStyle = 'rgba(6,11,22,0.88)';
      ctx.fillRect(16, 16, 186, 30);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 12px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      const pts = 68 + Math.floor(t / 3) * 2;
      ctx.fillText(`EASTSIDE ${pts} : 66`, 26, 35);
    } else if (ch.num === 3) {
      // Central Park Weather
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0284c7');
      sky.addColorStop(1, '#bae6fd');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Sun
      const sunPulse = Math.sin(t * 2.4) * 3;
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(348, 66, 28 + sunPulse, 0, Math.PI * 2);
      ctx.fill();

      // Drifting Clouds
      const c1 = (t * 28) % (W + 120) - 60;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(c1, 52, 74, 24);
      ctx.fillRect(c1 + 14, 38, 44, 18);

      // Green Park Ground
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(0, 158, W, H - 158);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(16, 16, 200, 74);
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 13px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('CENTRAL PARK SKYCAST', 28, 38);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px JetBrains Mono, monospace';
      ctx.fillText('24°C · SUNNY', 28, 66);
      ctx.font = '10px Plus Jakarta Sans, sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('Light breeze · Ideal for driving & court play', 28, 82);
    } else if (ch.num === 4) {
      // Starlight Retro Cartoons
      ctx.fillStyle = '#09071a';
      ctx.fillRect(0, 0, W, H);
      // Twinkling parallax stars
      for (let i = 0; i < 28; i++) {
        const sx = ((i * 53 - t * (40 + (i % 3) * 30)) % W + W) % W;
        const sy = (i * 37) % H;
        ctx.fillStyle = i % 3 === 0 ? '#facc15' : '#e2e8f0';
        ctx.fillRect(sx, sy, 3, 3);
      }

      // Pixel Starship
      const shipY = H / 2 + Math.sin(t * 3.1) * 44;
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(88, shipY - 12, 42, 24);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(122, shipY - 6, 18, 12);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(68 - (Math.floor(t * 14) % 10), shipY - 5, 18, 10);

      // Laser Pew
      const lx = ((t * 320) % 280) + 146;
      ctx.fillStyle = '#34d399';
      ctx.fillRect(lx, shipY - 2, 22, 4);

      ctx.fillStyle = '#f5d0fe';
      ctx.font = 'bold 12px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('STARLIGHT SQUADRON · EP. 14', 16, 28);
    } else {
      // Lo-Fi City Beat Music Channel
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(1, '#3b0764');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Equalizer Bars
      const barCount = 16;
      const bw = 18;
      for (let i = 0; i < barCount; i++) {
        const amp = Math.abs(Math.sin(t * 3.8 + i * 0.65)) * 105 + 16;
        ctx.fillStyle = i % 2 === 0 ? '#ec4899' : '#38bdf8';
        ctx.fillRect(36 + i * (bw + 6), 192 - amp, bw, amp);
      }

      ctx.fillStyle = '#fdf4ff';
      ctx.font = 'bold 14px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('NOW PLAYING: BOULEVARD RAIN (LO-FI)', 24, 34);
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.fillStyle = '#f9a8d4';
      ctx.fillText('AUDIO SYNCED WITH GAME MIXER', 24, 54);
    }

    // Subtle scanlines overlay when powered on
    ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
    for (let y = 0; y < H; y += 4) {
      ctx.fillRect(0, y, W, 1);
    }
  }

  public destroy(): void {
    this.openState = false;
    this.stopLoop();
    this.canvas = null;
    this.backdrop.remove();
  }
}
