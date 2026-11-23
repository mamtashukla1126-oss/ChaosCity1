import {TILE_SIZE} from '@/src/config/constants';
import {economySystem, ProgressionAwardSummary} from '@/src/game/systems/EconomySystem';
import {WorldSystem} from '@/src/game/systems/WorldSystem';
import {CityEventKind, CityEventState, DistrictId} from '@/src/game/types/gameTypes';

interface CityEventTemplate {
  id: string;
  kind: CityEventKind;
  title: string;
  subtitle: string;
  districtId: DistrictId;
  tileX: number;
  tileY: number;
  rewardCoins: number;
  rewardXp: number;
  durationSec: number;
}

const DYNAMIC_EVENT_TEMPLATES: CityEventTemplate[] = [
  {
    id: 'evt_car_meet',
    kind: 'car_meet',
    title: 'Chaos Customs Car Meet',
    subtitle: 'Show off your ride outside Chaos Customs Garage',
    districtId: 'entertainment',
    tileX: 59.5,
    tileY: 38.5,
    rewardCoins: 45,
    rewardXp: 60,
    durationSec: 120,
  },
  {
    id: 'evt_surf_fest',
    kind: 'street_festival',
    title: 'Pacific Boardwalk Surf Fest',
    subtitle: 'Coastal Pier Lantern & Music Pop-Up',
    districtId: 'beach',
    tileX: 136.5,
    tileY: 56.0,
    rewardCoins: 55,
    rewardXp: 70,
    durationSec: 120,
  },
  {
    id: 'evt_park_lantern',
    kind: 'park_event',
    title: 'Central Park Fountain Gathering',
    subtitle: 'Meet residents at Central Fountain Plaza',
    districtId: 'central_park',
    tileX: 40.5,
    tileY: 16.5,
    rewardCoins: 40,
    rewardXp: 55,
    durationSec: 110,
  },
  {
    id: 'evt_express_rally',
    kind: 'express_run',
    title: 'Metro Expressway Checkpoint',
    subtitle: 'High-speed cruise past Westbound Toll Gate',
    districtId: 'highway',
    tileX: 88.5,
    tileY: 81.0,
    rewardCoins: 60,
    rewardXp: 75,
    durationSec: 120,
  },
  {
    id: 'evt_luxury_photo',
    kind: 'photo_challenge',
    title: 'Luxury Heights Skyline Showcase',
    subtitle: 'Visit Grand Crest Hotel terrace',
    districtId: 'luxury',
    tileX: 100.5,
    tileY: 16.0,
    rewardCoins: 50,
    rewardXp: 65,
    durationSec: 120,
  },
  {
    id: 'evt_valley_harvest',
    kind: 'treasure_hunt',
    title: 'Emerald Valley Harvest Pop-Up',
    subtitle: 'Stop by Valley Farm Market Barn',
    districtId: 'countryside',
    tileX: 30.5,
    tileY: 82.0,
    rewardCoins: 50,
    rewardXp: 65,
    durationSec: 120,
  },
];

export class CityEventSystem {
  private index = 0;
  private remainingSec = DYNAMIC_EVENT_TEMPLATES[0].durationSec;
  private claimedCurrent = false;
  private cooldownAfterClaimSec = 0;

  constructor(private readonly worldSystem: WorldSystem) {
    this.syncBeacon();
  }

  public getActiveEventState(): CityEventState | null {
    if (this.claimedCurrent && this.cooldownAfterClaimSec > 0) {
      return null;
    }
    const tpl = DYNAMIC_EVENT_TEMPLATES[this.index];
    return {
      id: tpl.id,
      kind: tpl.kind,
      title: tpl.title,
      subtitle: tpl.subtitle,
      districtId: tpl.districtId,
      worldX: tpl.tileX * TILE_SIZE,
      worldY: tpl.tileY * TILE_SIZE,
      rewardCoins: tpl.rewardCoins,
      rewardXp: tpl.rewardXp,
      remainingSec: Math.ceil(this.remainingSec),
    };
  }

  private advanceEvent(): void {
    this.index = (this.index + 1) % DYNAMIC_EVENT_TEMPLATES.length;
    this.remainingSec = DYNAMIC_EVENT_TEMPLATES[this.index].durationSec;
    this.claimedCurrent = false;
    this.cooldownAfterClaimSec = 0;
    this.syncBeacon();
  }

  private syncBeacon(): void {
    const state = this.getActiveEventState();
    if (!state) {
      this.worldSystem.setEventBeacon({x: 0, y: 0, active: false});
      return;
    }
    this.worldSystem.setEventBeacon({x: state.worldX, y: state.worldY, active: true});
  }

  public update(
    dtSec: number,
    paused: boolean,
    playerX: number,
    playerY: number,
  ): {eventCompleted: CityEventState; summary: ProgressionAwardSummary} | null {
    if (paused) return null;

    if (this.claimedCurrent) {
      this.cooldownAfterClaimSec -= dtSec;
      if (this.cooldownAfterClaimSec <= 0) {
        this.advanceEvent();
      }
      return null;
    }

    this.remainingSec -= dtSec;
    if (this.remainingSec <= 0) {
      this.advanceEvent();
      return null;
    }

    const active = this.getActiveEventState();
    if (!active) return null;

    const dist = Math.hypot(playerX - active.worldX, playerY - active.worldY);
    if (dist <= 62) {
      this.claimedCurrent = true;
      this.cooldownAfterClaimSec = 18;
      this.syncBeacon();
      economySystem.awardCoins(active.rewardCoins, `City Event: ${active.title}`);
      const summary = economySystem.awardXp(active.rewardXp, `City Event: ${active.title}`);
      summary.coinsAwarded = active.rewardCoins;
      return {eventCompleted: active, summary};
    }

    return null;
  }

  public destroy(): void {
    this.worldSystem.setEventBeacon({x: 0, y: 0, active: false});
  }
}
