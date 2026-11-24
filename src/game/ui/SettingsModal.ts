import {
  CAMERA_MAX_ZOOM,
  CAMERA_MIN_ZOOM,
  DEFAULT_KEYBINDS,
} from '@/src/config/constants';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {cloudSaveManager} from '@/src/game/systems/CloudSaveManager';
import {economySystem} from '@/src/game/systems/EconomySystem';
import {multiplayerClient} from '@/src/game/systems/MultiplayerClient';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {
  EffectsQuality,
  GameSettings,
  GraphicsQuality,
  KeybindConfig,
  ProfileVisibility,
  RenderDistanceMode,
  TouchMode,
} from '@/src/game/types/gameTypes';
import {
  isFullscreenActive,
  onFullscreenChange,
  toggleFullscreen,
} from '@/src/game/utils/device';

export interface SettingsModalCallbacks {
  onSettingsChanged: (settings: GameSettings) => void;
  onClose: () => void;
  onSaveReset?: () => void;
}

type SettingsTab = 'graphics' | 'audio' | 'controls' | 'display';

const KEYBIND_LABELS: {key: keyof KeybindConfig; label: string}[] = [
  {key: 'moveUp', label: 'Move Up'},
  {key: 'moveDown', label: 'Move Down'},
  {key: 'moveLeft', label: 'Move Left'},
  {key: 'moveRight', label: 'Move Right'},
  {key: 'run', label: 'Sprint / Boost'},
  {key: 'interact', label: 'Interact / Enter'},
  {key: 'map', label: 'City Map'},
  {key: 'phone', label: 'Phone / Apps'},
  {key: 'emote', label: 'Quick Emote'},
];

function formatKeyCode(code: string): string {
  return code
    .replace(/^Key/, '')
    .replace(/^Arrow/, 'Arrow ')
    .replace(/^ShiftLeft$/, 'L-Shift')
    .replace(/^ShiftRight$/, 'R-Shift');
}

export class SettingsModal {
  private readonly backdrop: HTMLDivElement;
  private activeTab: SettingsTab = 'graphics';
  private rebindingKey: keyof KeybindConfig | null = null;
  private confirmResetArmed = false;
  private fsNotice = '';
  private unsubFullscreen: (() => void) | null = null;
  private readonly onKeyCaptureBound = (e: KeyboardEvent): void => {
    if (!this.isOpen() || !this.rebindingKey) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.code === 'Escape') {
      this.rebindingKey = null;
      this.render();
      return;
    }
    const cur = saveSystem.getState().settings;
    const updated = saveSystem.updateSettings({
      keybinds: {
        ...cur.keybinds,
        [this.rebindingKey]: e.code,
      },
    });
    this.rebindingKey = null;
    audioSystem.playInteract();
    this.callbacks.onSettingsChanged(updated.settings);
    this.render();
  };

  constructor(
    parent: HTMLElement,
    private readonly callbacks: SettingsModalCallbacks,
  ) {
    this.backdrop = document.createElement('div');
    this.backdrop.className =
      'ui-interactive fixed inset-0 z-40 hidden items-center justify-center bg-[#040812]/82 p-3 sm:p-4';
    parent.appendChild(this.backdrop);
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop && this.isOpen()) {
        audioSystem.playButtonClick();
        this.close();
        this.callbacks.onClose();
      }
    });
    this.unsubFullscreen = onFullscreenChange(() => {
      if (this.isOpen()) this.render();
    });
    window.addEventListener('keydown', this.onKeyCaptureBound, true);
  }

  public open(tab: SettingsTab = 'graphics'): void {
    this.confirmResetArmed = false;
    this.rebindingKey = null;
    this.activeTab = tab;
    this.render();
    this.backdrop.style.display = 'flex';
  }

  public close(): void {
    this.rebindingKey = null;
    this.backdrop.style.display = 'none';
  }

  public isOpen(): boolean {
    return this.backdrop.style.display === 'flex';
  }

  private render(): void {
    const state = saveSystem.getState();
    const s = state.settings;
    const fsActive = isFullscreenActive();

    this.backdrop.innerHTML = `
      <div class="cc-panel rounded-2xl w-full max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden text-slate-100">
        <div class="flex items-center justify-between border-b border-[#22355c] px-5 py-3.5 shrink-0">
          <div>
            <h2 class="font-display text-lg sm:text-xl font-bold text-white">Settings & Controls</h2>
            <p class="text-[11px] text-slate-400">Synced with your save profile across PC & Android</p>
          </div>
          <button id="cc-set-close" type="button" class="cc-btn-secondary px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
            Done
          </button>
        </div>

        <div class="flex flex-wrap gap-1.5 px-5 py-2.5 bg-[#091020] border-b border-[#22355c] shrink-0">
          ${(
            [
              {id: 'graphics', label: 'Graphics'},
              {id: 'audio', label: 'Audio'},
              {id: 'controls', label: 'Controls & Touch'},
              {id: 'display', label: 'Display & Privacy'},
            ] as {id: SettingsTab; label: string}[]
          )
            .map(
              (t) => `<button type="button" data-stab="${t.id}" class="cc-set-tab px-3 py-1.5 rounded-lg text-xs font-bold min-h-[36px] cursor-pointer ${
                this.activeTab === t.id
                  ? 'bg-sky-500 text-[#06101f]'
                  : 'bg-[#131f38] text-slate-300 border border-[#22355c] hover:text-white'
              }">${t.label}</button>`,
            )
            .join('')}
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-4">
          ${
            this.activeTab === 'graphics'
              ? this.renderGraphicsTab(s)
              : this.activeTab === 'audio'
                ? this.renderAudioTab(s)
                : this.activeTab === 'controls'
                  ? this.renderControlsTab(s)
                  : this.renderDisplayPrivacyTab(s, state.privacySettings, fsActive)
          }
          ${
            this.fsNotice
              ? `<p class="text-xs text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-lg px-3 py-2">${this.fsNotice}</p>`
              : ''
          }
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderGraphicsTab(s: GameSettings): string {
    const qVal = s.graphicsQuality === 'balanced' ? 'medium' : s.graphicsQuality;
    return `
      <div class="space-y-3.5 text-xs">
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#091020] border border-[#22355c] p-3">
          <div>
            <div class="text-sm font-semibold text-white">Graphics Preset</div>
            <div class="text-[11px] text-slate-400">Adjusts sprite particles, dynamic glow halos & world detail</div>
          </div>
          <div class="flex gap-1 bg-[#060b16] p-1 rounded-lg border border-[#22355c]">
            ${(['low', 'medium', 'high'] as GraphicsQuality[])
              .map(
                (q) => `<button data-quality="${q}" type="button" class="cc-q-btn px-3 py-1.5 rounded-md text-xs font-bold capitalize cursor-pointer ${
                  qVal === q ? 'bg-sky-500 text-[#06101f]' : 'text-slate-300 hover:text-white'
                }">${q}</button>`,
              )
              .join('')}
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#091020] border border-[#22355c] p-3">
          <div>
            <div class="text-sm font-semibold text-white">Effects Quality</div>
            <div class="text-[11px] text-slate-400">Rain, weather particles, sprint dust & street lamp glow</div>
          </div>
          <div class="flex gap-1 bg-[#060b16] p-1 rounded-lg border border-[#22355c]">
            ${(['low', 'medium', 'high'] as EffectsQuality[])
              .map(
                (eq) => `<button data-eq="${eq}" type="button" class="cc-eq-btn px-3 py-1.5 rounded-md text-xs font-bold capitalize cursor-pointer ${
                  s.effectsQuality === eq ? 'bg-sky-500 text-[#06101f]' : 'text-slate-300 hover:text-white'
                }">${eq}</button>`,
              )
              .join('')}
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#091020] border border-[#22355c] p-3">
          <div>
            <div class="text-sm font-semibold text-white">Dynamic Cloud & World Shadows</div>
            <div class="text-[11px] text-slate-400">Disable to maximize battery life on mobile Android</div>
          </div>
          <button id="cc-set-shadows" type="button" class="cc-btn-secondary px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
            s.shadowsEnabled ? 'border-emerald-400/60 text-emerald-300' : 'text-slate-400'
          }">${s.shadowsEnabled ? 'Enabled' : 'Disabled'}</button>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#091020] border border-[#22355c] p-3">
          <div>
            <div class="text-sm font-semibold text-white">Render Distance</div>
            <div class="text-[11px] text-slate-400">Controls active chunk culling radius around the camera</div>
          </div>
          <div class="flex gap-1 bg-[#060b16] p-1 rounded-lg border border-[#22355c]">
            ${(['near', 'medium', 'far'] as RenderDistanceMode[])
              .map(
                (rd) => `<button data-rd="${rd}" type="button" class="cc-rd-btn px-3 py-1.5 rounded-md text-xs font-bold capitalize cursor-pointer ${
                  s.renderDistance === rd ? 'bg-sky-500 text-[#06101f]' : 'text-slate-300 hover:text-white'
                }">${rd}</button>`,
              )
              .join('')}
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#091020] border border-[#22355c] p-3">
          <div>
            <div class="text-sm font-semibold text-white">Performance Mode (60fps Eco)</div>
            <div class="text-[11px] text-slate-400">Turns off halos/clouds and trims visual particles for low-end devices</div>
          </div>
          <button id="cc-set-perf" type="button" class="cc-btn-secondary px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
            s.performanceMode ? 'border-amber-400 text-amber-300 bg-amber-500/15' : ''
          }">${s.performanceMode ? 'Active' : 'Off'}</button>
        </div>
      </div>
    `;
  }

  private renderAudioTab(s: GameSettings): string {
    return `
      <div class="space-y-4 rounded-xl bg-[#091020] border border-[#22355c] p-4">
        <div class="flex items-center justify-between gap-4">
          <label for="cc-set-master" class="text-sm font-medium text-slate-200">Master Volume</label>
          <div class="flex items-center gap-3 w-52">
            <input id="cc-set-master" type="range" min="0" max="100" value="${Math.round((s.audio.masterVolume ?? 1) * 100)}" class="cc-slider flex-1" />
            <span id="cc-set-master-val" class="font-mono-tabular text-xs text-sky-300 w-10 text-right">${Math.round((s.audio.masterVolume ?? 1) * 100)}%</span>
          </div>
        </div>

        <div class="flex items-center justify-between gap-4">
          <label for="cc-set-music" class="text-sm font-medium text-slate-200">Music Volume</label>
          <div class="flex items-center gap-3 w-52">
            <input id="cc-set-music" type="range" min="0" max="100" value="${Math.round(s.audio.musicVolume * 100)}" class="cc-slider flex-1" />
            <span id="cc-set-music-val" class="font-mono-tabular text-xs text-sky-300 w-10 text-right">${Math.round(s.audio.musicVolume * 100)}%</span>
          </div>
        </div>

        <div class="flex items-center justify-between gap-4">
          <label for="cc-set-sfx" class="text-sm font-medium text-slate-200">Sound Effects</label>
          <div class="flex items-center gap-3 w-52">
            <input id="cc-set-sfx" type="range" min="0" max="100" value="${Math.round(s.audio.sfxVolume * 100)}" class="cc-slider flex-1" />
            <span id="cc-set-sfx-val" class="font-mono-tabular text-xs text-sky-300 w-10 text-right">${Math.round(s.audio.sfxVolume * 100)}%</span>
          </div>
        </div>

        <div class="flex items-center justify-between gap-4 pt-2 border-t border-[#1e2f52]">
          <span class="text-sm font-medium text-slate-200">Audio Mute</span>
          <button id="cc-set-mute" type="button" class="cc-btn-secondary px-4 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer ${s.audio.muted ? 'border-amber-400 text-amber-300' : ''}">
            ${s.audio.muted ? 'Muted' : 'Active'}
          </button>
        </div>
      </div>
    `;
  }

  private renderControlsTab(s: GameSettings): string {
    return `
      <!-- Android & Touch Controls -->
      <div class="rounded-xl bg-[#091020] border border-[#22355c] p-4 space-y-3">
        <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-sky-300">
          Android / Touch Controls Layout
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <span class="text-xs font-medium text-slate-200">Touch Controls Visibility</span>
          <div class="flex gap-1 bg-[#060b16] p-1 rounded-lg border border-[#22355c]">
            ${(['auto', 'always', 'off'] as TouchMode[])
              .map(
                (t) => `<button data-touch="${t}" type="button" class="cc-t-btn px-2.5 py-1.5 rounded-md text-xs font-semibold capitalize cursor-pointer ${
                  s.touchMode === t ? 'bg-sky-500 text-[#06101f]' : 'text-slate-300 hover:text-white'
                }">${t}</button>`,
              )
              .join('')}
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <span class="text-xs font-medium text-slate-200">Joystick Side</span>
          <div class="flex gap-1 bg-[#060b16] p-1 rounded-lg border border-[#22355c]">
            <button data-jside="left" type="button" class="cc-jside-btn px-3 py-1 rounded-md text-xs font-bold cursor-pointer ${s.joystickSide === 'left' ? 'bg-sky-500 text-[#06101f]' : 'text-slate-300'}">Left</button>
            <button data-jside="right" type="button" class="cc-jside-btn px-3 py-1 rounded-md text-xs font-bold cursor-pointer ${s.joystickSide === 'right' ? 'bg-sky-500 text-[#06101f]' : 'text-slate-300'}">Right</button>
          </div>
        </div>

        <div class="flex items-center justify-between gap-4">
          <label for="cc-set-sens" class="text-xs font-medium text-slate-200">Joystick Sensitivity</label>
          <div class="flex items-center gap-3 w-48">
            <input id="cc-set-sens" type="range" min="60" max="180" step="10" value="${Math.round(s.joystickSensitivity * 100)}" class="cc-slider flex-1" />
            <span id="cc-set-sens-val" class="font-mono-tabular text-xs text-sky-300 w-10 text-right">${s.joystickSensitivity.toFixed(1)}x</span>
          </div>
        </div>

        <div class="flex items-center justify-between gap-4">
          <label for="cc-set-tscale" class="text-xs font-medium text-slate-200">Touch Button Scale</label>
          <div class="flex items-center gap-3 w-48">
            <input id="cc-set-tscale" type="range" min="75" max="140" step="5" value="${Math.round((s.touchButtonScale ?? 1) * 100)}" class="cc-slider flex-1" />
            <span id="cc-set-tscale-val" class="font-mono-tabular text-xs text-sky-300 w-10 text-right">${Math.round((s.touchButtonScale ?? 1) * 100)}%</span>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] text-slate-300">Joystick X Offset</span>
            <input id="cc-set-jox" type="range" min="-60" max="120" step="5" value="${s.joystickOffsetX ?? 0}" class="cc-slider w-28" />
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] text-slate-300">Joystick Y Offset</span>
            <input id="cc-set-joy" type="range" min="-80" max="60" step="5" value="${s.joystickOffsetY ?? 0}" class="cc-slider w-28" />
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] text-slate-300">Action Pad X Offset</span>
            <input id="cc-set-aox" type="range" min="-120" max="60" step="5" value="${s.actionOffsetX ?? 0}" class="cc-slider w-28" />
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] text-slate-300">Action Pad Y Offset</span>
            <input id="cc-set-aoy" type="range" min="-80" max="60" step="5" value="${s.actionOffsetY ?? 0}" class="cc-slider w-28" />
          </div>
        </div>
      </div>

      <!-- PC Keyboard & Mouse -->
      <div class="rounded-xl bg-[#091020] border border-[#22355c] p-4 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-amber-300">
            PC Keybinds & Mouse
          </div>
          <button id="cc-set-kbreset" type="button" class="text-[11px] font-semibold text-sky-300 hover:text-sky-200 cursor-pointer">
            Reset Default Keys
          </button>
        </div>

        <div class="flex items-center justify-between gap-3">
          <span class="text-xs font-medium text-slate-200">Click Remote Players / Objects with Mouse</span>
          <button id="cc-set-mouseint" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer">
            ${s.mouseInteractEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          ${KEYBIND_LABELS.map((item) => {
            const listening = this.rebindingKey === item.key;
            const curCode = s.keybinds?.[item.key] || DEFAULT_KEYBINDS[item.key];
            return `
              <button type="button" data-rebind="${item.key}" class="cc-rebind-btn rounded-lg border px-2.5 py-2 flex items-center justify-between gap-2 text-xs cursor-pointer ${
                listening ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-[#0e172c] border-[#22355c] text-slate-200'
              }">
                <span class="truncate">${item.label}</span>
                <span class="font-mono-tabular text-[11px] font-bold ${listening ? 'text-amber-300' : 'text-sky-300'}">
                  ${listening ? 'Press key...' : formatKeyCode(curCode)}
                </span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  private renderDisplayPrivacyTab(
    s: GameSettings,
    priv: ReturnType<typeof saveSystem.getState>['privacySettings'],
    fsActive: boolean,
  ): string {
    return `
      <div class="rounded-xl bg-[#091020] border border-[#22355c] p-4 space-y-3.5">
        <div class="flex items-center justify-between gap-4">
          <label for="cc-set-zoom" class="text-xs sm:text-sm font-medium text-slate-200">Camera Zoom</label>
          <div class="flex items-center gap-3 w-52">
            <input id="cc-set-zoom" type="range" min="${Math.round(CAMERA_MIN_ZOOM * 100)}" max="${Math.round(CAMERA_MAX_ZOOM * 100)}" step="5" value="${Math.round(s.cameraZoom * 100)}" class="cc-slider flex-1" />
            <span id="cc-set-zoom-val" class="font-mono-tabular text-xs text-sky-300 w-10 text-right">${s.cameraZoom.toFixed(2)}x</span>
          </div>
        </div>

        <div class="flex items-center justify-between gap-4">
          <label for="cc-set-uiscale" class="text-xs sm:text-sm font-medium text-slate-200">HUD Interface Scale</label>
          <div class="flex items-center gap-3 w-52">
            <input id="cc-set-uiscale" type="range" min="85" max="120" step="5" value="${Math.round((s.uiScale ?? 1) * 100)}" class="cc-slider flex-1" />
            <span id="cc-set-uiscale-val" class="font-mono-tabular text-xs text-sky-300 w-10 text-right">${Math.round((s.uiScale ?? 1) * 100)}%</span>
          </div>
        </div>

        <div class="flex items-center justify-between gap-4">
          <span class="text-xs sm:text-sm font-medium text-slate-200">Multiplayer & Event Toasts</span>
          <button id="cc-set-notif" type="button" class="cc-btn-secondary px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer">
            ${s.notificationsEnabled ? 'Enabled' : 'Muted'}
          </button>
        </div>
      </div>

      <!-- Privacy & Multiplayer Defaults -->
      <div class="rounded-xl bg-[#091020] border border-[#22355c] p-4 space-y-3 text-xs">
        <div class="font-mono-tabular text-[10px] font-bold uppercase tracking-wider text-sky-300">
          Privacy & Social Preferences
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-slate-200">Profile Visibility</span>
          <div class="flex gap-1">
            ${(['public', 'friends', 'private'] as ProfileVisibility[])
              .map(
                (v) => `<button type="button" data-spvis="${v}" class="cc-set-pvis px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize cursor-pointer ${
                  priv.profileVisibility === v ? 'bg-sky-500 text-[#06101f]' : 'bg-[#131f38] text-slate-300'
                }">${v}</button>`,
              )
              .join('')}
          </div>
        </div>

        <div class="flex items-center justify-between gap-2">
          <span class="text-slate-200">Allow Property / Activity Invites</span>
          <button id="cc-set-pinv" type="button" class="cc-btn-secondary px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer">
            ${priv.allowMultiplayerInvites ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <div class="flex items-center justify-between gap-2">
          <span class="text-slate-200">Show Online Presence</span>
          <button id="cc-set-ponl" type="button" class="cc-btn-secondary px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer">
            ${priv.showOnlineStatus ? 'Visible' : 'Hidden'}
          </button>
        </div>
      </div>

      <div class="pt-1 flex flex-wrap items-center justify-between gap-3">
        <button id="cc-set-fs" type="button" class="cc-btn-secondary px-4 py-2 rounded-lg text-xs font-semibold min-h-[40px] cursor-pointer">
          ${fsActive ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        </button>
        <button id="cc-set-reset" type="button" class="px-4 py-2 rounded-lg text-xs font-semibold min-h-[40px] border border-rose-500/40 bg-rose-950/40 text-rose-200 hover:border-rose-400 cursor-pointer">
          Reset Local Save
        </button>
      </div>
    `;
  }

  private bindEvents(): void {
    this.backdrop.querySelector('#cc-set-close')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.close();
      this.callbacks.onClose();
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-set-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.activeTab = (btn.dataset.stab as SettingsTab) || 'graphics';
        this.rebindingKey = null;
        this.render();
      });
    });

    // Graphics tab
    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-q-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        audioSystem.playButtonClick();
        const q = btn.dataset.quality as GraphicsQuality;
        const updated = saveSystem.updateSettings({graphicsQuality: q});
        this.callbacks.onSettingsChanged(updated.settings);
        this.render();
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-eq-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        audioSystem.playButtonClick();
        const eq = btn.dataset.eq as EffectsQuality;
        const updated = saveSystem.updateSettings({effectsQuality: eq});
        this.callbacks.onSettingsChanged(updated.settings);
        this.render();
      });
    });

    this.backdrop.querySelector('#cc-set-shadows')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      const cur = saveSystem.getState().settings.shadowsEnabled;
      const updated = saveSystem.updateSettings({shadowsEnabled: !cur});
      this.callbacks.onSettingsChanged(updated.settings);
      this.render();
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-rd-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        audioSystem.playButtonClick();
        const rd = btn.dataset.rd as RenderDistanceMode;
        const updated = saveSystem.updateSettings({renderDistance: rd});
        this.callbacks.onSettingsChanged(updated.settings);
        this.render();
      });
    });

    this.backdrop.querySelector('#cc-set-perf')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      const cur = saveSystem.getState().settings.performanceMode;
      const updated = saveSystem.updateSettings({performanceMode: !cur});
      this.callbacks.onSettingsChanged(updated.settings);
      this.render();
    });

    // Audio tab
    const masterInput = this.backdrop.querySelector<HTMLInputElement>('#cc-set-master');
    const masterVal = this.backdrop.querySelector('#cc-set-master-val');
    masterInput?.addEventListener('input', () => {
      const vol = Number(masterInput.value) / 100;
      if (masterVal) masterVal.textContent = `${masterInput.value}%`;
      const updated = saveSystem.updateSettings({
        audio: {...saveSystem.getState().settings.audio, masterVolume: vol},
      });
      audioSystem.applySettings(updated.settings.audio);
      this.callbacks.onSettingsChanged(updated.settings);
    });

    const musicInput = this.backdrop.querySelector<HTMLInputElement>('#cc-set-music');
    const musicVal = this.backdrop.querySelector('#cc-set-music-val');
    musicInput?.addEventListener('input', () => {
      const vol = Number(musicInput.value) / 100;
      if (musicVal) musicVal.textContent = `${musicInput.value}%`;
      const updated = saveSystem.updateSettings({
        audio: {...saveSystem.getState().settings.audio, musicVolume: vol},
      });
      audioSystem.applySettings(updated.settings.audio);
      this.callbacks.onSettingsChanged(updated.settings);
    });

    const sfxInput = this.backdrop.querySelector<HTMLInputElement>('#cc-set-sfx');
    const sfxVal = this.backdrop.querySelector('#cc-set-sfx-val');
    sfxInput?.addEventListener('input', () => {
      const vol = Number(sfxInput.value) / 100;
      if (sfxVal) sfxVal.textContent = `${sfxInput.value}%`;
      const updated = saveSystem.updateSettings({
        audio: {...saveSystem.getState().settings.audio, sfxVolume: vol},
      });
      audioSystem.applySettings(updated.settings.audio);
      this.callbacks.onSettingsChanged(updated.settings);
    });

    this.backdrop.querySelector('#cc-set-mute')?.addEventListener('click', () => {
      const cur = saveSystem.getState().settings.audio;
      const updated = saveSystem.updateSettings({audio: {...cur, muted: !cur.muted}});
      audioSystem.applySettings(updated.settings.audio);
      audioSystem.playButtonClick();
      this.callbacks.onSettingsChanged(updated.settings);
      this.render();
    });

    // Controls tab
    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-t-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        audioSystem.playButtonClick();
        const t = btn.dataset.touch as TouchMode;
        const updated = saveSystem.updateSettings({touchMode: t});
        this.callbacks.onSettingsChanged(updated.settings);
        this.render();
      });
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-jside-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        audioSystem.playButtonClick();
        const side = btn.dataset.jside === 'right' ? 'right' : 'left';
        const updated = saveSystem.updateSettings({joystickSide: side});
        this.callbacks.onSettingsChanged(updated.settings);
        this.render();
      });
    });

    const sensInput = this.backdrop.querySelector<HTMLInputElement>('#cc-set-sens');
    const sensVal = this.backdrop.querySelector('#cc-set-sens-val');
    sensInput?.addEventListener('input', () => {
      const sens = Number(sensInput.value) / 100;
      if (sensVal) sensVal.textContent = `${sens.toFixed(1)}x`;
      const updated = saveSystem.updateSettings({joystickSensitivity: sens});
      this.callbacks.onSettingsChanged(updated.settings);
    });

    const tscaleInput = this.backdrop.querySelector<HTMLInputElement>('#cc-set-tscale');
    const tscaleVal = this.backdrop.querySelector('#cc-set-tscale-val');
    tscaleInput?.addEventListener('input', () => {
      const sc = Number(tscaleInput.value) / 100;
      if (tscaleVal) tscaleVal.textContent = `${tscaleInput.value}%`;
      const updated = saveSystem.updateSettings({touchButtonScale: sc});
      this.callbacks.onSettingsChanged(updated.settings);
    });

    const bindOffsetSlider = (id: string, field: keyof GameSettings) => {
      const el = this.backdrop.querySelector<HTMLInputElement>(id);
      el?.addEventListener('input', () => {
        const updated = saveSystem.updateSettings({[field]: Number(el.value)});
        this.callbacks.onSettingsChanged(updated.settings);
      });
    };
    bindOffsetSlider('#cc-set-jox', 'joystickOffsetX');
    bindOffsetSlider('#cc-set-joy', 'joystickOffsetY');
    bindOffsetSlider('#cc-set-aox', 'actionOffsetX');
    bindOffsetSlider('#cc-set-aoy', 'actionOffsetY');

    this.backdrop.querySelector('#cc-set-mouseint')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      const cur = saveSystem.getState().settings.mouseInteractEnabled;
      const updated = saveSystem.updateSettings({mouseInteractEnabled: !cur});
      this.callbacks.onSettingsChanged(updated.settings);
      this.render();
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-rebind-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.rebind as keyof KeybindConfig | undefined;
        if (!k) return;
        audioSystem.playButtonClick();
        this.rebindingKey = this.rebindingKey === k ? null : k;
        this.render();
      });
    });

    this.backdrop.querySelector('#cc-set-kbreset')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      const updated = saveSystem.updateSettings({keybinds: {...DEFAULT_KEYBINDS}});
      this.rebindingKey = null;
      this.callbacks.onSettingsChanged(updated.settings);
      this.render();
    });

    // Display & Privacy tab
    const zoomInput = this.backdrop.querySelector<HTMLInputElement>('#cc-set-zoom');
    const zoomVal = this.backdrop.querySelector('#cc-set-zoom-val');
    zoomInput?.addEventListener('input', () => {
      const zoom = Number(zoomInput.value) / 100;
      if (zoomVal) zoomVal.textContent = `${zoom.toFixed(2)}x`;
      const updated = saveSystem.updateSettings({cameraZoom: zoom});
      this.callbacks.onSettingsChanged(updated.settings);
    });

    const uiInput = this.backdrop.querySelector<HTMLInputElement>('#cc-set-uiscale');
    const uiVal = this.backdrop.querySelector('#cc-set-uiscale-val');
    uiInput?.addEventListener('input', () => {
      const sc = Number(uiInput.value) / 100;
      if (uiVal) uiVal.textContent = `${uiInput.value}%`;
      const updated = saveSystem.updateSettings({uiScale: sc});
      this.callbacks.onSettingsChanged(updated.settings);
    });

    this.backdrop.querySelector('#cc-set-notif')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      const cur = saveSystem.getState().settings.notificationsEnabled;
      const updated = saveSystem.updateSettings({notificationsEnabled: !cur});
      this.callbacks.onSettingsChanged(updated.settings);
      this.render();
    });

    this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-set-pvis').forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.spvis as ProfileVisibility;
        saveSystem.updatePrivacySettings({profileVisibility: v});
        audioSystem.playButtonClick();
        const mpSt = multiplayerClient.getStatus();
        void cloudSaveManager.syncPublicProfile(
          mpSt.status === 'connected' ? mpSt.roomId : null,
          mpSt.status === 'connected',
        );
        this.render();
      });
    });

    this.backdrop.querySelector('#cc-set-pinv')?.addEventListener('click', () => {
      const cur = saveSystem.getState().privacySettings.allowMultiplayerInvites;
      saveSystem.updatePrivacySettings({allowMultiplayerInvites: !cur});
      audioSystem.playButtonClick();
      this.render();
    });

    this.backdrop.querySelector('#cc-set-ponl')?.addEventListener('click', () => {
      const cur = saveSystem.getState().privacySettings.showOnlineStatus;
      saveSystem.updatePrivacySettings({showOnlineStatus: !cur});
      audioSystem.playButtonClick();
      const mpSt = multiplayerClient.getStatus();
      void cloudSaveManager.syncPublicProfile(
        mpSt.status === 'connected' ? mpSt.roomId : null,
        mpSt.status === 'connected',
      );
      this.render();
    });

    this.backdrop.querySelector('#cc-set-fs')?.addEventListener('click', async () => {
      audioSystem.playButtonClick();
      this.fsNotice = '';
      const res = await toggleFullscreen();
      if (res.error) this.fsNotice = res.error;
      this.render();
    });

    const resetBtn = this.backdrop.querySelector<HTMLButtonElement>('#cc-set-reset');
    resetBtn?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      if (!this.confirmResetArmed) {
        this.confirmResetArmed = true;
        resetBtn.textContent = 'Confirm Reset?';
        return;
      }
      const fresh = saveSystem.reset();
      economySystem.notifyExternalReset();
      audioSystem.applySettings(fresh.settings.audio);
      this.callbacks.onSettingsChanged(fresh.settings);
      this.callbacks.onSaveReset?.();
      this.confirmResetArmed = false;
      this.render();
    });
  }

  public destroy(): void {
    this.close();
    window.removeEventListener('keydown', this.onKeyCaptureBound, true);
    this.unsubFullscreen?.();
    this.backdrop.remove();
  }
}
