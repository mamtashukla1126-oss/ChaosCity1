import {CHARACTER_PRESETS, TILE_SIZE} from '@/src/config/constants';
import {getShopItemById} from '@/src/game/data/catalog';
import {getVehicleModelSpec} from '@/src/game/data/cityLifeData';
import {
  FULL_MISSIONS,
  getXpLevelProgress,
  MINI_GAMES_CATALOG,
} from '@/src/game/data/progressionData';
import {
  renderCharacterPortraitDataUrl,
  renderShopItemIconDataUrl,
} from '@/src/game/graphics/PixelArtGenerator';
import {renderVehiclePreviewDataUrl} from '@/src/game/graphics/VehicleArtGenerator';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {authSystem} from '@/src/game/systems/AuthSystem';
import {cityClockSystem} from '@/src/game/systems/CityClockSystem';
import {CITY_ACHIEVEMENTS, economySystem} from '@/src/game/systems/EconomySystem';
import {multiplayerClient} from '@/src/game/systems/MultiplayerClient';
import {ownerBadgeService} from '@/src/game/systems/OwnerBadgeService';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {GameSettings, PhoneAppId} from '@/src/game/types/gameTypes';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface PhoneNpcDirectoryEntry {
  id: string;
  name: string;
  role: string;
  district: string;
  activityLabel: string;
}

export interface PhoneModalCallbacks {
  onOpenFullMap?: () => void;
  onOpenGarage?: (tab?: 'customize' | 'showroom') => void;
  onOpenMiniGamesHub?: () => void;
  onOpenJournal?: (tab?: 'missions' | 'story' | 'exploration' | 'progression' | 'achievements') => void;
  onOpenSocial?: (tab?: 'servers' | 'chat' | 'friends' | 'lobbies') => void;
  onOpenProperties?: () => void;
  onOpenProfile?: () => void;
  onSpawnVehicle: (vehicleId: string) => {ok: boolean; message: string};
  onDespawnVehicle: () => {ok: boolean; message: string};
  hasSpawnedPersonalVehicle: () => boolean;
  getSpawnCooldownSec: () => number;
  getCurrentDistrictName: () => string;
  getPlayerCoords: () => {x: number; y: number};
  getPersonalVehicleCoords: () => {x: number; y: number; name: string} | null;
  getNpcDirectory: () => PhoneNpcDirectoryEntry[];
  onAppearanceChanged: () => void;
  onSettingsChanged: (settings: GameSettings) => void;
  onClose?: () => void;
}

const APP_TILES: {
  id: PhoneAppId;
  label: string;
  icon: string;
  accent: string;
}[] = [
  {id: 'spawner', label: 'Spawner', icon: '🚗', accent: 'from-orange-500/30 to-amber-500/20 border-orange-400/50'},
  {id: 'missions', label: 'Missions', icon: '🎯', accent: 'from-emerald-500/30 to-teal-500/20 border-emerald-400/50'},
  {id: 'games', label: 'Mini-Games', icon: '🎮', accent: 'from-fuchsia-500/30 to-purple-500/20 border-fuchsia-400/50'},
  {id: 'map', label: 'City GPS', icon: '🗺️', accent: 'from-sky-500/30 to-cyan-500/20 border-sky-400/50'},
  {id: 'garage', label: 'Garage', icon: '🔧', accent: 'from-rose-500/30 to-orange-500/20 border-rose-400/50'},
  {id: 'inventory', label: 'Bag & Fit', icon: '🎒', accent: 'from-indigo-500/30 to-violet-500/20 border-indigo-400/50'},
  {id: 'contacts', label: 'Residents', icon: '👥', accent: 'from-pink-500/30 to-fuchsia-500/20 border-pink-400/50'},
  {id: 'profile', label: 'ID Card', icon: '🪪', accent: 'from-cyan-500/30 to-blue-500/20 border-cyan-400/50'},
  {id: 'settings', label: 'Settings', icon: '⚙️', accent: 'from-slate-500/30 to-slate-600/20 border-slate-400/50'},
];

export class PhoneModal {
  private readonly backdrop: HTMLDivElement;
  private openState = false;
  private currentApp: PhoneAppId = 'home';
  private feedback: {text: string; error: boolean} | null = null;
  private refreshInterval: number | null = null;

  constructor(
    parent: HTMLElement,
    private readonly callbacks: PhoneModalCallbacks,
  ) {
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

  public open(initialApp: PhoneAppId = 'home'): void {
    this.openState = true;
    this.currentApp = initialApp;
    this.feedback = null;
    audioSystem.playPhoneChime();
    this.render();
    this.backdrop.style.display = 'flex';

    if (this.refreshInterval !== null) {
      window.clearInterval(this.refreshInterval);
    }
    this.refreshInterval = window.setInterval(() => {
      if (!this.openState) return;
      const clockEl = this.backdrop.querySelector('#cc-phone-clock');
      if (clockEl) {
        const badge = cityClockSystem.getPhaseBadge();
        clockEl.textContent = `${badge.icon} ${cityClockSystem.getFormattedTime()}`;
      }
    }, 500);
  }

  public close(): void {
    if (!this.openState) return;
    this.openState = false;
    if (this.refreshInterval !== null) {
      window.clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.backdrop.style.display = 'none';
    this.backdrop.innerHTML = '';
    this.callbacks.onClose?.();
  }

  private navigate(app: PhoneAppId): void {
    audioSystem.playButtonClick();
    this.currentApp = app;
    this.feedback = null;
    this.render();
  }

  private render(): void {
    const badge = cityClockSystem.getPhaseBadge();
    const formattedTime = cityClockSystem.getFormattedTime();
    const save = saveSystem.getState();

    this.backdrop.innerHTML = `
      <div class="w-full max-w-md max-h-[92dvh] rounded-[28px] border-2 border-[#334155] bg-[#080f1e] shadow-2xl flex flex-col overflow-hidden text-slate-100">
        <!-- Phone Status Bar -->
        <div class="flex items-center justify-between px-4 py-2.5 bg-[#050914] border-b border-[#1e293b] shrink-0">
          <div id="cc-phone-clock" class="font-mono-tabular text-[11px] font-bold text-sky-300">
            ${badge.icon} ${formattedTime}
          </div>
          <div class="flex items-center gap-2">
            <span class="font-mono-tabular text-[11px] font-bold text-amber-300">${save.coins}c</span>
            <button id="cc-phone-close" type="button" class="px-2.5 py-1 rounded-lg bg-[#131f38] border border-[#2b416f] text-[11px] font-semibold text-slate-200 min-h-[34px] cursor-pointer">
              Close [P]
            </button>
          </div>
        </div>

        <!-- App Title Bar (when inside an app) -->
        ${
          this.currentApp !== 'home'
            ? `<div class="flex items-center justify-between px-4 py-2 bg-[#0b1428] border-b border-[#1e293b] shrink-0">
                <button id="cc-phone-back" type="button" class="px-2.5 py-1.5 rounded-lg bg-[#131f38] border border-[#2b416f] text-xs font-semibold text-sky-300 min-h-[36px] cursor-pointer">
                  ← Home
                </button>
                <span class="font-display text-sm font-bold text-white uppercase tracking-wide">${this.getAppTitle(this.currentApp)}</span>
                <span class="w-14"></span>
              </div>`
            : ''
        }

        ${
          this.feedback
            ? `<div class="mx-4 mt-3 px-3 py-2 rounded-xl text-xs font-semibold border shrink-0 ${
                this.feedback.error
                  ? 'bg-rose-500/15 border-rose-400/50 text-rose-200'
                  : 'bg-emerald-500/15 border-emerald-400/50 text-emerald-200'
              }">${esc(this.feedback.text)}</div>`
            : ''
        }

        <!-- Scrollable Screen Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3.5">
          ${this.renderAppContent()}
        </div>

        <!-- Bottom Phone Nav Bar -->
        <div class="flex items-center justify-around px-4 py-2 bg-[#050914] border-t border-[#1e293b] shrink-0">
          <button id="cc-phone-nav-home" type="button" class="px-4 py-1.5 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer ${
            this.currentApp === 'home' ? 'text-sky-300 bg-sky-500/15' : 'text-slate-400 hover:text-white'
          }">Home</button>
          <button id="cc-phone-nav-spawner" type="button" class="px-4 py-1.5 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer ${
            this.currentApp === 'spawner' ? 'text-orange-300 bg-orange-500/15' : 'text-slate-400 hover:text-white'
          }">Spawner</button>
          <button id="cc-phone-nav-missions" type="button" class="px-4 py-1.5 rounded-lg text-xs font-semibold min-h-[38px] cursor-pointer ${
            this.currentApp === 'missions' ? 'text-emerald-300 bg-emerald-500/15' : 'text-slate-400 hover:text-white'
          }">Missions</button>
        </div>
      </div>
    `;

    this.backdrop.querySelector('#cc-phone-close')?.addEventListener('click', () => {
      audioSystem.playButtonClick();
      this.close();
    });
    this.backdrop.querySelector('#cc-phone-back')?.addEventListener('click', () => this.navigate('home'));
    this.backdrop.querySelector('#cc-phone-nav-home')?.addEventListener('click', () => this.navigate('home'));
    this.backdrop.querySelector('#cc-phone-nav-spawner')?.addEventListener('click', () => this.navigate('spawner'));
    this.backdrop.querySelector('#cc-phone-nav-missions')?.addEventListener('click', () => this.navigate('missions'));

    this.bindAppEvents();
  }

  private getAppTitle(app: PhoneAppId): string {
    switch (app) {
      case 'spawner':
        return 'Vehicle Spawner';
      case 'missions':
        return 'City Missions';
      case 'games':
        return 'Mini-Games';
      case 'map':
        return 'City GPS';
      case 'garage':
        return 'My Garage';
      case 'inventory':
        return 'Bag & Outfits';
      case 'contacts':
        return 'Residents';
      case 'profile':
        return 'Resident ID';
      case 'settings':
        return 'Settings';
      default:
        return 'Chaos Phone';
    }
  }

  private renderAppContent(): string {
    switch (this.currentApp) {
      case 'spawner':
        return this.renderSpawnerApp();
      case 'missions':
        return this.renderMissionsApp();
      case 'games':
        return this.renderGamesApp();
      case 'map':
        return this.renderMapApp();
      case 'garage':
        return this.renderGarageApp();
      case 'inventory':
        return this.renderInventoryApp();
      case 'contacts':
        return this.renderContactsApp();
      case 'profile':
        return this.renderProfileApp();
      case 'settings':
        return this.renderSettingsApp();
      case 'home':
      default:
        return this.renderHomeApp();
    }
  }

  private renderHomeApp(): string {
    const save = saveSystem.getState();
    const xpProg = getXpLevelProgress(save.progression?.xp ?? 0);
    const activeEvent = cityClockSystem.getActiveEvent();
    const activeVeh = economySystem.getVehicleById(economySystem.getActiveVehicleId() ?? '');
    const claimableMissions = FULL_MISSIONS.filter((m) => {
      const claimed = save.claimedRewards.includes(`mission_reward_${m.id}`);
      return !claimed && m.getProgress(save) >= m.goal;
    }).length;

    return `
      <div class="rounded-xl bg-[#0e172c] border border-[#22355c] px-3.5 py-2.5 flex items-center justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="font-mono-tabular text-[10px] font-bold text-amber-300 truncate">CITIZEN LV.${xpProg.level} · "${esc(save.progression?.selectedTitle ?? 'New Arrival')}"</div>
          <div class="w-full max-w-[160px] h-1.5 rounded-full bg-[#060b16] overflow-hidden mt-1">
            <div class="h-full bg-gradient-to-r from-sky-400 to-amber-400" style="width:${xpProg.percent}%"></div>
          </div>
        </div>
        <button type="button" id="cc-phone-open-prog" class="cc-btn-secondary px-2.5 py-1 rounded-lg text-[10px] font-bold min-h-[32px] cursor-pointer shrink-0">
          ${save.progression?.xp ?? 0} XP
        </button>
      </div>
      <div class="rounded-2xl bg-gradient-to-br from-sky-500/20 to-indigo-600/20 border border-sky-400/40 p-3.5 space-y-1">
        <div class="flex items-center justify-between text-[10px] font-mono-tabular uppercase tracking-wider text-sky-300">
          <span>Live City Event</span>
          <span>${activeEvent.subtitle.split('·')[0].trim()}</span>
        </div>
        <div class="font-display text-sm font-bold text-white">${activeEvent.title}</div>
        <p class="text-[11px] text-slate-300 leading-snug">${activeEvent.bonusText}</p>
      </div>

      ${
        activeVeh
          ? `<div class="rounded-xl bg-[#0e172c] border border-[#22355c] p-3 flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="text-[10px] text-slate-400">Active Ride</div>
                <div class="text-xs font-bold text-white truncate">${activeVeh.name}</div>
              </div>
              <button type="button" id="cc-phone-quick-spawn" class="cc-btn-primary px-3 py-2 rounded-lg text-[11px] font-bold min-h-[38px] cursor-pointer shrink-0">
                Quick Spawn
              </button>
            </div>`
          : ''
      }

      <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
        ${
          this.callbacks.onOpenSocial
            ? `<button type="button" id="cc-phone-open-social" class="relative rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 border border-emerald-400/50 p-2.5 flex flex-col items-center justify-center gap-1 min-h-[72px] cursor-pointer hover:brightness-110 transition">
                <span class="text-2xl leading-none">🌐</span>
                <span class="text-[10px] font-bold text-white tracking-tight">Social</span>
              </button>`
            : ''
        }
        ${
          this.callbacks.onOpenProperties
            ? `<button type="button" id="cc-phone-open-props" class="relative rounded-2xl bg-gradient-to-br from-amber-500/30 to-yellow-500/20 border border-amber-400/50 p-2.5 flex flex-col items-center justify-center gap-1 min-h-[72px] cursor-pointer hover:brightness-110 transition">
                <span class="text-2xl leading-none">🏠</span>
                <span class="text-[10px] font-bold text-white tracking-tight">Homes</span>
              </button>`
            : ''
        }
        ${APP_TILES.map((tile) => {
          const badgeHtml =
            tile.id === 'missions' && claimableMissions > 0
              ? `<span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 text-[#06101f] font-mono-tabular text-[10px] font-bold flex items-center justify-center">${claimableMissions}</span>`
              : '';
          return `
            <button type="button" data-phone-app="${tile.id}" class="cc-phone-tile relative rounded-2xl bg-gradient-to-br ${tile.accent} border p-2.5 flex flex-col items-center justify-center gap-1 min-h-[72px] cursor-pointer hover:brightness-110 transition">
              ${badgeHtml}
              <span class="text-2xl leading-none">${tile.icon}</span>
              <span class="text-[10px] font-bold text-white tracking-tight">${tile.label}</span>
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  private renderSpawnerApp(): string {
    const owned = economySystem.getOwnedVehicles();
    const activeId = economySystem.getActiveVehicleId();
    const hasSpawned = this.callbacks.hasSpawnedPersonalVehicle();
    const cooldown = this.callbacks.getSpawnCooldownSec();
    const parkedPos = this.callbacks.getPersonalVehicleCoords();

    return `
      <div class="rounded-xl bg-[#0d1629] border border-[#22355c] p-3 text-xs text-slate-300 space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="font-bold text-white">Chaos Valet Dispatch</span>
          <span class="font-mono-tabular text-[11px] ${cooldown > 0 ? 'text-amber-300' : 'text-emerald-300'}">
            ${cooldown > 0 ? `Cooldown ${cooldown}s` : 'Ready'}
          </span>
        </div>
        <p class="text-[11px] text-slate-400">
          Spawns your selected customized vehicle in a clear outdoor spot nearby.
        </p>
        ${
          parkedPos
            ? `<div class="pt-1 flex items-center justify-between gap-2 text-[11px] text-sky-300">
                <span>Currently Parked: <b>${parkedPos.name}</b> (${Math.round(parkedPos.x / TILE_SIZE)}, ${Math.round(parkedPos.y / TILE_SIZE)})</span>
                <button id="cc-phone-despawn" type="button" class="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-200 font-bold min-h-[32px] cursor-pointer">
                  Recall
                </button>
              </div>`
            : ''
        }
      </div>

      <div class="space-y-2.5">
        ${owned
          .map((v) => {
            const spec = getVehicleModelSpec(v.modelId);
            const img = renderVehiclePreviewDataUrl(v.modelId, v.customization, 'right');
            const isActive = v.id === activeId;
            return `
              <div class="rounded-xl bg-[#0e172c] border ${
                isActive ? 'border-orange-400/60' : 'border-[#22355c]'
              } p-3 flex items-center gap-3">
                <div class="w-16 h-14 rounded-lg bg-[#060b16] border border-[#1a2947] flex items-center justify-center shrink-0">
                  <img src="${img}" alt="${v.name}" class="max-h-12 w-auto object-contain" style="image-rendering: pixelated;" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <div class="font-display text-xs font-bold text-white truncate">${v.name}</div>
                    ${isActive ? `<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">ACTIVE</span>` : ''}
                  </div>
                  <div class="text-[10px] text-slate-400">
                    ${Math.round(spec.baseSpeed * (1 + ((v.upgrades.engine ?? 1) - 1) * 0.1))} km/h · Eng T${v.upgrades.engine}
                  </div>
                </div>
                <button type="button" data-spawn-vid="${v.id}" ${cooldown > 0 ? 'disabled' : ''} class="cc-phone-spawn cc-btn-primary px-3 py-2 rounded-xl text-xs font-bold min-h-[42px] cursor-pointer shrink-0 disabled:opacity-50">
                  ${hasSpawned && isActive ? 'Re-Spawn' : 'Spawn'}
                </button>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  private renderMissionsApp(): string {
    const save = saveSystem.getState();
    const activeEvent = cityClockSystem.getActiveEvent();
    return `
      <div class="rounded-xl bg-amber-500/10 border border-amber-400/40 p-3 flex items-center justify-between gap-2">
        <div class="min-w-0">
          <div class="text-[10px] font-mono-tabular font-bold uppercase text-amber-300">Active Phase: ${activeEvent.title}</div>
          <div class="text-[11px] text-slate-300 truncate">${activeEvent.bonusText}</div>
        </div>
        ${
          this.callbacks.onOpenJournal
            ? `<div class="flex items-center gap-1.5 shrink-0">
                <button id="cc-phone-open-story-quests" type="button" class="cc-btn-secondary px-2.5 py-1.5 rounded-lg text-[10px] font-bold border-amber-400/50 text-amber-200 min-h-[34px] cursor-pointer">Story Quests (${save.story.completedChapters.length}/5)</button>
                <button id="cc-phone-open-journal" type="button" class="cc-btn-primary px-3 py-1.5 rounded-lg text-[11px] font-bold min-h-[34px] cursor-pointer">Full Journal</button>
              </div>`
            : ''
        }
      </div>

      <div class="space-y-2.5">
        ${FULL_MISSIONS.map((m) => {
          const prog = m.getProgress(save);
          const done = prog >= m.goal;
          const claimed = save.claimedRewards.includes(`mission_reward_${m.id}`);
          const pct = Math.min(100, Math.round((prog / m.goal) * 100));
          return `
            <div class="rounded-xl bg-[#0e172c] border ${
              claimed ? 'border-emerald-500/30 opacity-80' : done ? 'border-emerald-400/70' : 'border-[#22355c]'
            } p-3 space-y-2">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="text-[10px] font-mono-tabular uppercase text-sky-300">${m.category}</div>
                  <div class="font-display text-xs font-bold text-white">${m.title}</div>
                  <div class="text-[11px] text-slate-400">${m.description}</div>
                </div>
                <span class="px-2 py-0.5 rounded bg-amber-400/15 text-amber-300 font-mono-tabular text-[11px] font-bold shrink-0">+${m.rewardCoins}c</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="flex-1 h-2 rounded-full bg-[#060b16] overflow-hidden">
                  <div class="h-full ${done ? 'bg-emerald-400' : 'bg-sky-400'}" style="width:${pct}%"></div>
                </div>
                <span class="font-mono-tabular text-[10px] text-slate-300">${prog}/${m.goal}</span>
                ${
                  claimed
                    ? `<span class="text-[10px] font-bold text-emerald-300">Claimed</span>`
                    : done
                      ? `<button type="button" data-claim-mid="${m.id}" class="cc-phone-claim px-3 py-1 rounded-lg bg-emerald-400 text-[#06101f] text-[11px] font-bold min-h-[34px] cursor-pointer">Claim</button>`
                      : `<span class="text-[10px] text-slate-500">In Progress</span>`
                }
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  private renderGamesApp(): string {
    const save = saveSystem.getState();
    return `
      <div class="rounded-xl bg-fuchsia-500/10 border border-fuchsia-400/40 p-3 space-y-2">
        <div class="font-display text-xs font-bold text-white">${MINI_GAMES_CATALOG.length} Playable Mini-Games</div>
        <p class="text-[11px] text-slate-300">Launch any playable challenge across Central Park, Downtown, Eastside Courts, or Pixel Palace.</p>
        ${
          this.callbacks.onOpenMiniGamesHub
            ? `<button id="cc-phone-open-mghub" type="button" class="cc-btn-primary w-full py-2.5 rounded-xl text-xs font-bold min-h-[42px] cursor-pointer">Open Mini-Games Hub</button>`
            : ''
        }
      </div>
      <div class="space-y-2">
        ${MINI_GAMES_CATALOG.map(
          (g) => `
          <div class="rounded-xl bg-[#0e172c] border border-[#22355c] p-3 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="font-display text-xs font-bold text-white truncate">${g.name}</div>
              <div class="text-[10px] text-sky-300 truncate">${g.locationName} · ${g.getBestLabel(save)}</div>
            </div>
            <span class="font-mono-tabular text-[10px] font-bold text-amber-300 shrink-0">${g.rewardText}</span>
          </div>
        `,
        ).join('')}
      </div>
    `;
  }

  private renderMapApp(): string {
    const pos = this.callbacks.getPlayerCoords();
    const tileX = Math.round(pos.x / TILE_SIZE);
    const tileY = Math.round(pos.y / TILE_SIZE);
    const district = this.callbacks.getCurrentDistrictName();
    const parked = this.callbacks.getPersonalVehicleCoords();

    return `
      <div class="rounded-xl bg-[#0e172c] border border-[#22355c] p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-[10px] text-sky-300 uppercase font-semibold">Current Location</div>
            <div class="font-display text-base font-bold text-white">${district}</div>
          </div>
          <span class="font-mono-tabular text-xs px-2.5 py-1 rounded-lg bg-[#060b16] border border-[#22355c] text-sky-200">
            Tile ${tileX}, ${tileY}
          </span>
        </div>

        <div class="rounded-lg bg-[#060b16] border border-[#1a2947] p-3 text-xs space-y-1.5">
          <div class="text-slate-300 flex items-center justify-between">
            <span>Personal Ride Tracker</span>
            <span class="font-mono-tabular text-amber-300">
              ${parked ? `${parked.name} (${Math.round(parked.x / TILE_SIZE)}, ${Math.round(parked.y / TILE_SIZE)})` : 'In Garage'}
            </span>
          </div>
          <div class="text-[11px] text-slate-400">
            Transit Tip: Visit any of the 10 Bus Stops or Starlight Metro Station across the 11 Districts for instant shuttle rides.
          </div>
        </div>

        ${
          this.callbacks.onOpenFullMap
            ? `<button id="cc-phone-open-map" type="button" class="cc-btn-primary w-full py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer">
                Open Full Interactive City Map [M]
              </button>`
            : `<div class="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-400/40 rounded-lg px-3 py-2">
                Full interactive GPS map is available once you step outdoors into CHAOS CITY.
              </div>`
        }
      </div>
    `;
  }

  private renderGarageApp(): string {
    const owned = economySystem.getOwnedVehicles();
    const activeId = economySystem.getActiveVehicleId();

    return `
      <div class="space-y-2.5">
        ${owned
          .map((v) => {
            const spec = getVehicleModelSpec(v.modelId);
            const img = renderVehiclePreviewDataUrl(v.modelId, v.customization, 'right');
            const isAct = v.id === activeId;
            return `
              <div class="rounded-xl bg-[#0e172c] border ${
                isAct ? 'border-emerald-400/60' : 'border-[#22355c]'
              } p-3 flex items-center gap-3">
                <div class="w-16 h-14 rounded-lg bg-[#060b16] flex items-center justify-center shrink-0">
                  <img src="${img}" alt="${v.name}" class="max-h-12 w-auto object-contain" style="image-rendering: pixelated;" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="font-display text-xs font-bold text-white truncate">${v.name}</div>
                  <div class="text-[10px] text-slate-400">
                    Top ${Math.round(spec.baseSpeed * (1 + ((v.upgrades.engine ?? 1) - 1) * 0.1))} km/h · Cond ${v.condition ?? 100}%
                  </div>
                </div>
                <button type="button" data-phone-set-act="${v.id}" class="cc-phone-setact px-2.5 py-2 rounded-lg text-[11px] font-bold min-h-[38px] cursor-pointer ${
                  isAct ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' : 'cc-btn-secondary'
                }">${isAct ? 'Active' : 'Use'}</button>
              </div>
            `;
          })
          .join('')}
      </div>

      ${
        this.callbacks.onOpenGarage
          ? `<button id="cc-phone-open-garage" type="button" class="cc-btn-primary w-full py-2.5 rounded-xl text-xs font-bold min-h-[44px] cursor-pointer">
              Open Garage Customizer & Showroom
            </button>`
          : `<div class="rounded-xl bg-orange-500/10 border border-orange-400/40 p-3 text-xs text-orange-200">
              Drive or take the bus to <b>Chaos Customs Garage</b> in the Entertainment District to repaint, install spoilers, and upgrade engine tiers!
            </div>`
      }
    `;
  }

  private renderInventoryApp(): string {
    const inv = economySystem.getInventory().filter((e) => e.quantity > 0);
    const boost = economySystem.getSpeedBoostRemainingSec();
    if (inv.length === 0) {
      return `
        <div class="rounded-xl bg-[#0e172c] border border-[#22355c] p-5 text-center space-y-1">
          <div class="text-sm font-bold text-white">Your Bag is Empty</div>
          <p class="text-xs text-slate-400">Pick up snacks, coffee, and streetwear from shops across Shopping District.</p>
        </div>
      `;
    }

    return `
      ${
        boost > 0
          ? `<div class="px-3 py-2 rounded-xl bg-sky-500/15 border border-sky-400/40 text-xs text-sky-200 font-semibold">Speed Boost Active: ${boost}s remaining</div>`
          : ''
      }
      <div class="space-y-2">
        ${inv
          .map((entry) => {
            const item = getShopItemById(entry.itemId);
            if (!item) return '';
            const icon = renderShopItemIconDataUrl(item);
            const equipped = economySystem.isItemEquipped(item.id);
            return `
              <div class="rounded-xl bg-[#0e172c] border border-[#22355c] p-2.5 flex items-center gap-2.5">
                <img src="${icon}" alt="${item.name}" class="w-10 h-10 rounded-lg bg-[#060b16] p-1 object-contain shrink-0" style="image-rendering: pixelated;" />
                <div class="min-w-0 flex-1">
                  <div class="text-xs font-bold text-white truncate">${item.name}</div>
                  <div class="text-[10px] text-slate-400 truncate">Qty ${entry.quantity} · ${item.subCategory}</div>
                </div>
                ${
                  item.kind === 'consumable'
                    ? `<button type="button" data-phone-use="${item.id}" class="cc-phone-use cc-btn-primary px-3 py-1.5 rounded-lg text-[11px] font-bold min-h-[38px] cursor-pointer">Use</button>`
                    : item.clothing
                      ? `<button type="button" data-phone-wear="${item.id}" class="cc-phone-wear px-3 py-1.5 rounded-lg text-[11px] font-bold min-h-[38px] cursor-pointer ${
                          equipped
                            ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-300'
                            : 'cc-btn-secondary'
                        }">${equipped ? 'Unequip' : 'Wear'}</button>`
                      : `<span class="text-[10px] text-slate-400 px-2">Pass</span>`
                }
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  private renderContactsApp(): string {
    const save = saveSystem.getState();
    const metSet = new Set(save.missions.metNpcs ?? []);
    const list = this.callbacks.getNpcDirectory();

    return `
      <div class="text-xs text-slate-400 px-1">
        Met <b class="text-white">${metSet.size}</b> / ${list.length} CHAOS CITY Residents
      </div>
      <div class="space-y-2">
        ${list
          .map((npc) => {
            const isMet = metSet.has(npc.id);
            return `
              <div class="rounded-xl bg-[#0e172c] border ${
                isMet ? 'border-emerald-400/40' : 'border-[#22355c]'
              } p-3 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-display text-xs font-bold text-white">${npc.name}</span>
                    <span class="text-[10px] text-sky-300">${npc.role}</span>
                  </div>
                  <div class="text-[11px] text-slate-400 truncate">Now: ${npc.activityLabel}</div>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                  isMet ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }">${isMet ? 'Met' : 'Unmet'}</span>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  private renderProfileApp(): string {
    const save = saveSystem.getState();
    const preset = CHARACTER_PRESETS.find((p) => p.id === save.appearanceId) ?? CHARACTER_PRESETS[0];
    const portrait = renderCharacterPortraitDataUrl(
      preset,
      save.equippedClothing,
      save.hairOverride,
      save.appearanceConfig,
    );
    const unlockedCount = save.achievements.unlockedIds.length;
    const shards = (save.collectedIds ?? []).length;
    const tokens = save.loungeTokens ?? 50;

    const user = authSystem.getCurrentUser();
    const mp = multiplayerClient.getStatus();
    const isOwner = ownerBadgeService.isVerifiedOwnerAccount(user?.uid, user?.username, mp.selfIsOwner);

    return `
      <div class="rounded-2xl bg-[#0e172c] border border-[#22355c] p-4 flex items-center gap-3.5">
        <div class="w-16 h-16 rounded-xl bg-[#060b16] border border-sky-400/50 flex items-center justify-center shrink-0">
          <img src="${portrait}" alt="${esc(save.playerName)}" class="w-14 h-14 object-contain" style="image-rendering: pixelated;" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-[10px] font-mono-tabular uppercase text-sky-300">Lv.${save.progression?.level ?? 1} · ${esc(save.progression?.selectedTitle ?? 'New Arrival')}</div>
          <div class="flex flex-wrap items-center gap-1.5">
            ${isOwner ? ownerBadgeService.renderBadgeHtml(true) : ''}
            <span class="font-display text-lg font-bold text-white truncate">${esc(save.playerName)}</span>
          </div>
          <div class="text-xs text-slate-300">${save.coins} Coins · ${tokens} FT · ⚡${save.energy}/100</div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2.5 text-xs">
        <div class="rounded-xl bg-[#0d1629] border border-[#22355c] p-3">
          <div class="text-slate-400 text-[10px]">Districts Visited</div>
          <div class="font-mono-tabular text-base font-bold text-white">${save.missions.visitedDistricts.length} / 11</div>
        </div>
        <div class="rounded-xl bg-[#0d1629] border border-[#22355c] p-3">
          <div class="text-slate-400 text-[10px]">Starlight Shards</div>
          <div class="font-mono-tabular text-base font-bold text-sky-300">${shards} / 14</div>
        </div>
        <div class="rounded-xl bg-[#0d1629] border border-[#22355c] p-3">
          <div class="text-slate-400 text-[10px]">Vehicles Owned</div>
          <div class="font-mono-tabular text-base font-bold text-amber-300">${save.vehicles.length}</div>
        </div>
        <div class="rounded-xl bg-[#0d1629] border border-[#22355c] p-3">
          <div class="text-slate-400 text-[10px]">Badges Unlocked</div>
          <div class="font-mono-tabular text-base font-bold text-emerald-300">${unlockedCount} / ${CITY_ACHIEVEMENTS.length}</div>
        </div>
      </div>
    `;
  }

  private renderSettingsApp(): string {
    const s = saveSystem.getState().settings;
    return `
      <div class="rounded-xl bg-[#0e172c] border border-[#22355c] p-3.5 space-y-3.5 text-xs">
        <div class="space-y-1">
          <div class="flex justify-between">
            <span class="font-semibold text-slate-200">Music Volume</span>
            <span id="cc-ps-mus-val" class="font-mono-tabular text-sky-300">${Math.round(s.audio.musicVolume * 100)}%</span>
          </div>
          <input id="cc-ps-mus" type="range" min="0" max="100" value="${Math.round(s.audio.musicVolume * 100)}" class="w-full accent-sky-400 cursor-pointer" />
        </div>

        <div class="space-y-1">
          <div class="flex justify-between">
            <span class="font-semibold text-slate-200">SFX Volume</span>
            <span id="cc-ps-sfx-val" class="font-mono-tabular text-sky-300">${Math.round(s.audio.sfxVolume * 100)}%</span>
          </div>
          <input id="cc-ps-sfx" type="range" min="0" max="100" value="${Math.round(s.audio.sfxVolume * 100)}" class="w-full accent-sky-400 cursor-pointer" />
        </div>

        <div class="flex items-center justify-between pt-1">
          <span class="font-semibold text-slate-200">Mute All Audio</span>
          <button id="cc-ps-mute" type="button" class="px-3 py-1.5 rounded-lg text-xs font-bold min-h-[38px] cursor-pointer ${
            s.audio.muted ? 'bg-rose-500/20 border border-rose-400 text-rose-200' : 'bg-emerald-500/20 border border-emerald-400 text-emerald-200'
          }">${s.audio.muted ? 'Muted' : 'Audio On'}</button>
        </div>

        <div class="flex items-center justify-between pt-1 border-t border-[#1e293b]">
          <span class="font-semibold text-slate-200">Graphics Effects</span>
          <button id="cc-ps-gfx" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-bold min-h-[38px] cursor-pointer">
            ${s.graphicsQuality === 'high' ? 'High' : 'Balanced'}
          </button>
        </div>

        <div class="flex items-center justify-between">
          <span class="font-semibold text-slate-200">Touch Controls</span>
          <button id="cc-ps-touch" type="button" class="cc-btn-secondary px-3 py-1.5 rounded-lg text-xs font-bold min-h-[38px] uppercase cursor-pointer">
            ${s.touchMode}
          </button>
        </div>
      </div>
    `;
  }

  private bindAppEvents(): void {
    if (this.currentApp === 'home') {
      this.backdrop.querySelector('#cc-phone-open-social')?.addEventListener('click', () => {
        if (!this.callbacks.onOpenSocial) return;
        audioSystem.playButtonClick();
        this.close();
        this.callbacks.onOpenSocial('servers');
      });
      this.backdrop.querySelector('#cc-phone-open-props')?.addEventListener('click', () => {
        if (!this.callbacks.onOpenProperties) return;
        audioSystem.playButtonClick();
        this.close();
        this.callbacks.onOpenProperties();
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-phone-tile').forEach((btn) => {
        btn.addEventListener('click', () => {
          const next = btn.dataset.phoneApp as PhoneAppId;
          if (next === 'games' && this.callbacks.onOpenMiniGamesHub) {
            audioSystem.playButtonClick();
            this.close();
            this.callbacks.onOpenMiniGamesHub();
            return;
          }
          if (next === 'profile' && this.callbacks.onOpenProfile) {
            audioSystem.playButtonClick();
            this.close();
            this.callbacks.onOpenProfile();
            return;
          }
          if (next) this.navigate(next);
        });
      });

      this.backdrop.querySelector('#cc-phone-open-prog')?.addEventListener('click', () => {
        if (!this.callbacks.onOpenJournal) return;
        audioSystem.playButtonClick();
        this.close();
        this.callbacks.onOpenJournal('progression');
      });

      this.backdrop.querySelector('#cc-phone-quick-spawn')?.addEventListener('click', () => {
        const activeId = economySystem.getActiveVehicleId();
        if (!activeId) return;
        const res = this.callbacks.onSpawnVehicle(activeId);
        if (res.ok) {
          audioSystem.playUpgrade();
          this.feedback = {text: res.message, error: false};
        } else {
          audioSystem.playError();
          this.feedback = {text: res.message, error: true};
        }
        this.render();
      });
    } else if (this.currentApp === 'spawner') {
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-phone-spawn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const vid = btn.dataset.spawnVid;
          if (!vid) return;
          economySystem.setActiveVehicleId(vid);
          const res = this.callbacks.onSpawnVehicle(vid);
          if (res.ok) {
            audioSystem.playUpgrade();
            this.feedback = {text: res.message, error: false};
          } else {
            audioSystem.playError();
            this.feedback = {text: res.message, error: true};
          }
          this.render();
        });
      });

      this.backdrop.querySelector('#cc-phone-despawn')?.addEventListener('click', () => {
        const res = this.callbacks.onDespawnVehicle();
        if (res.ok) {
          audioSystem.playButtonClick();
          this.feedback = {text: res.message, error: false};
        } else {
          audioSystem.playError();
          this.feedback = {text: res.message, error: true};
        }
        this.render();
      });
    } else if (this.currentApp === 'missions') {
      this.backdrop.querySelector('#cc-phone-open-story-quests')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
        this.callbacks.onOpenJournal?.('story');
      });
      this.backdrop.querySelector('#cc-phone-open-journal')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
        this.callbacks.onOpenJournal?.('missions');
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-phone-claim').forEach((btn) => {
        btn.addEventListener('click', () => {
          const mid = btn.dataset.claimMid;
          if (!mid) return;
          const res = economySystem.claimMissionReward(mid);
          if (res.ok) {
            audioSystem.playCoin();
            this.feedback = {
              text: `Mission completed! Claimed +${res.coinsAwarded} Coins.`,
              error: false,
            };
          } else {
            audioSystem.playError();
            this.feedback = {text: res.reason ?? 'Cannot claim yet.', error: true};
          }
          this.render();
        });
      });
    } else if (this.currentApp === 'games') {
      this.backdrop.querySelector('#cc-phone-open-mghub')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
        this.callbacks.onOpenMiniGamesHub?.();
      });
    } else if (this.currentApp === 'map') {
      this.backdrop.querySelector('#cc-phone-open-map')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
        this.callbacks.onOpenFullMap?.();
      });
    } else if (this.currentApp === 'garage') {
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-phone-setact').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.phoneSetAct;
          if (!id) return;
          audioSystem.playButtonClick();
          economySystem.setActiveVehicleId(id);
          this.feedback = {text: 'Updated Active Ride for Spawner & Garage!', error: false};
          this.render();
        });
      });
      this.backdrop.querySelector('#cc-phone-open-garage')?.addEventListener('click', () => {
        audioSystem.playButtonClick();
        this.close();
        this.callbacks.onOpenGarage?.('customize');
      });
    } else if (this.currentApp === 'inventory') {
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-phone-use').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.phoneUse;
          if (!id) return;
          const res = economySystem.consumeItem(id);
          if (res.ok) {
            audioSystem.playInteract();
            this.feedback = {
              text: `Restored +${res.energyRestored} Energy${res.speedBoostSec ? ` & +${res.speedBoostSec}s Speed Boost` : ''}!`,
              error: false,
            };
          } else {
            audioSystem.playError();
            this.feedback = {text: res.reason ?? 'Could not use item.', error: true};
          }
          this.render();
        });
      });
      this.backdrop.querySelectorAll<HTMLButtonElement>('.cc-phone-wear').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.phoneWear;
          if (!id) return;
          const item = getShopItemById(id);
          if (!item?.clothing) return;
          if (economySystem.isItemEquipped(id)) {
            economySystem.unequipSlot(item.clothing.slot);
            this.feedback = {text: `Unequipped ${item.name}.`, error: false};
          } else {
            economySystem.equipClothing(id);
            this.feedback = {text: `Equipped ${item.name}!`, error: false};
          }
          audioSystem.playInteract();
          this.callbacks.onAppearanceChanged();
          this.render();
        });
      });
    } else if (this.currentApp === 'settings') {
      const musSlider = this.backdrop.querySelector<HTMLInputElement>('#cc-ps-mus');
      const sfxSlider = this.backdrop.querySelector<HTMLInputElement>('#cc-ps-sfx');
      const musVal = this.backdrop.querySelector('#cc-ps-mus-val');
      const sfxVal = this.backdrop.querySelector('#cc-ps-sfx-val');

      const saveAndApply = (next: GameSettings) => {
        saveSystem.updateSettings(next);
        audioSystem.applySettings(next.audio);
        this.callbacks.onSettingsChanged(next);
      };

      musSlider?.addEventListener('input', () => {
        const cur = saveSystem.getState().settings;
        const val = Number(musSlider.value) / 100;
        if (musVal) musVal.textContent = `${musSlider.value}%`;
        saveAndApply({...cur, audio: {...cur.audio, musicVolume: val}});
      });

      sfxSlider?.addEventListener('input', () => {
        const cur = saveSystem.getState().settings;
        const val = Number(sfxSlider.value) / 100;
        if (sfxVal) sfxVal.textContent = `${sfxSlider.value}%`;
        saveAndApply({...cur, audio: {...cur.audio, sfxVolume: val}});
      });

      this.backdrop.querySelector('#cc-ps-mute')?.addEventListener('click', () => {
        const cur = saveSystem.getState().settings;
        saveAndApply({...cur, audio: {...cur.audio, muted: !cur.audio.muted}});
        audioSystem.playButtonClick();
        this.render();
      });

      this.backdrop.querySelector('#cc-ps-gfx')?.addEventListener('click', () => {
        const cur = saveSystem.getState().settings;
        saveAndApply({...cur, graphicsQuality: cur.graphicsQuality === 'high' ? 'balanced' : 'high'});
        audioSystem.playButtonClick();
        this.render();
      });

      this.backdrop.querySelector('#cc-ps-touch')?.addEventListener('click', () => {
        const cur = saveSystem.getState().settings;
        const order: GameSettings['touchMode'][] = ['auto', 'always', 'off'];
        const nextMode = order[(order.indexOf(cur.touchMode) + 1) % order.length];
        saveAndApply({...cur, touchMode: nextMode});
        audioSystem.playButtonClick();
        this.render();
      });
    }
  }

  public destroy(): void {
    this.openState = false;
    if (this.refreshInterval !== null) {
      window.clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.backdrop.remove();
  }
}
