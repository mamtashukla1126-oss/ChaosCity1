import Phaser from 'phaser';
import {TILE_SIZE} from '@/src/config/constants';
import {ensureCustomVehicleTexture} from '@/src/game/graphics/VehicleArtGenerator';
import {cityClockSystem} from '@/src/game/systems/CityClockSystem';
import {Direction, VehicleCustomization, VehicleModelId} from '@/src/game/types/gameTypes';

interface TrafficPoint {
  x: number;
  y: number;
}

interface TrafficAgent {
  id: string;
  name: string;
  sprite: Phaser.GameObjects.Sprite;
  route: TrafficPoint[];
  wpIndex: number;
  maxSpeed: number;
  currentSpeed: number;
  direction: Direction;
}

const DIR_FRAME: Record<Direction, string> = {
  down: '0',
  up: '1',
  left: '2',
  right: '3',
};

const STOP_LINES = [
  // Original core intersections (West Ave 27..29, East Ave 51..53, Main Blvd 27..29, South Blvd 50..52)
  {axis: 'ew' as const, dir: 'right' as Direction, x: 26.2 * TILE_SIZE, y: 29.5 * TILE_SIZE},
  {axis: 'ew' as const, dir: 'left' as Direction, x: 30.8 * TILE_SIZE, y: 27.5 * TILE_SIZE},
  {axis: 'ew' as const, dir: 'right' as Direction, x: 50.2 * TILE_SIZE, y: 29.5 * TILE_SIZE},
  {axis: 'ew' as const, dir: 'left' as Direction, x: 54.8 * TILE_SIZE, y: 27.5 * TILE_SIZE},
  {axis: 'ew' as const, dir: 'right' as Direction, x: 26.2 * TILE_SIZE, y: 52.5 * TILE_SIZE},
  {axis: 'ew' as const, dir: 'left' as Direction, x: 30.8 * TILE_SIZE, y: 50.5 * TILE_SIZE},
  {axis: 'ew' as const, dir: 'right' as Direction, x: 50.2 * TILE_SIZE, y: 52.5 * TILE_SIZE},
  {axis: 'ew' as const, dir: 'left' as Direction, x: 54.8 * TILE_SIZE, y: 50.5 * TILE_SIZE},
  {axis: 'ns' as const, dir: 'down' as Direction, x: 27.5 * TILE_SIZE, y: 26.2 * TILE_SIZE},
  {axis: 'ns' as const, dir: 'up' as Direction, x: 29.5 * TILE_SIZE, y: 30.8 * TILE_SIZE},
  {axis: 'ns' as const, dir: 'down' as Direction, x: 51.5 * TILE_SIZE, y: 26.2 * TILE_SIZE},
  {axis: 'ns' as const, dir: 'up' as Direction, x: 53.5 * TILE_SIZE, y: 30.8 * TILE_SIZE},
  {axis: 'ns' as const, dir: 'down' as Direction, x: 27.5 * TILE_SIZE, y: 49.2 * TILE_SIZE},
  {axis: 'ns' as const, dir: 'up' as Direction, x: 29.5 * TILE_SIZE, y: 53.8 * TILE_SIZE},
  {axis: 'ns' as const, dir: 'down' as Direction, x: 51.5 * TILE_SIZE, y: 49.2 * TILE_SIZE},
  {axis: 'ns' as const, dir: 'up' as Direction, x: 53.5 * TILE_SIZE, y: 53.8 * TILE_SIZE},
  // Luxury & Industrial Ave (cols 94..96) & Uptown Connector (rows 14..16) & Main/South Blvd
  {axis: 'ew' as const, dir: 'right' as Direction, x: 93.2 * TILE_SIZE, y: 16.5 * TILE_SIZE},
  {axis: 'ew' as const, dir: 'left' as Direction, x: 97.8 * TILE_SIZE, y: 14.5 * TILE_SIZE},
  {axis: 'ew' as const, dir: 'right' as Direction, x: 93.2 * TILE_SIZE, y: 29.5 * TILE_SIZE},
  {axis: 'ew' as const, dir: 'left' as Direction, x: 97.8 * TILE_SIZE, y: 27.5 * TILE_SIZE},
  {axis: 'ew' as const, dir: 'right' as Direction, x: 93.2 * TILE_SIZE, y: 52.5 * TILE_SIZE},
  {axis: 'ew' as const, dir: 'left' as Direction, x: 97.8 * TILE_SIZE, y: 50.5 * TILE_SIZE},
  {axis: 'ns' as const, dir: 'down' as Direction, x: 94.5 * TILE_SIZE, y: 26.2 * TILE_SIZE},
  {axis: 'ns' as const, dir: 'up' as Direction, x: 96.5 * TILE_SIZE, y: 30.8 * TILE_SIZE},
  {axis: 'ns' as const, dir: 'down' as Direction, x: 94.5 * TILE_SIZE, y: 49.2 * TILE_SIZE},
  {axis: 'ns' as const, dir: 'up' as Direction, x: 96.5 * TILE_SIZE, y: 53.8 * TILE_SIZE},
  // Coastal & Airport Ave (cols 131..133) & Metro Expressway (rows 80..82)
  {axis: 'ew' as const, dir: 'right' as Direction, x: 130.2 * TILE_SIZE, y: 29.5 * TILE_SIZE},
  {axis: 'ew' as const, dir: 'left' as Direction, x: 134.8 * TILE_SIZE, y: 27.5 * TILE_SIZE},
  {axis: 'ns' as const, dir: 'down' as Direction, x: 131.5 * TILE_SIZE, y: 49.2 * TILE_SIZE},
  {axis: 'ns' as const, dir: 'up' as Direction, x: 133.5 * TILE_SIZE, y: 53.8 * TILE_SIZE},
  {axis: 'ew' as const, dir: 'right' as Direction, x: 50.2 * TILE_SIZE, y: 82.5 * TILE_SIZE},
  {axis: 'ew' as const, dir: 'left' as Direction, x: 54.8 * TILE_SIZE, y: 80.5 * TILE_SIZE},
  {axis: 'ew' as const, dir: 'right' as Direction, x: 93.2 * TILE_SIZE, y: 82.5 * TILE_SIZE},
  {axis: 'ew' as const, dir: 'left' as Direction, x: 97.8 * TILE_SIZE, y: 80.5 * TILE_SIZE},
];

interface TrafficPreset {
  id: string;
  name: string;
  modelId: VehicleModelId;
  customization: VehicleCustomization;
  speed: number;
  route: TrafficPoint[];
}

const TRAFFIC_SPECS: TrafficPreset[] = [
  {
    id: 'traffic_taxi_1',
    name: 'Chaos City Cab',
    modelId: 'taxi',
    speed: 126,
    customization: {
      paintColor: '#eab308',
      secondaryColor: '#fef08a',
      wheelStyle: 'stock',
      spoilerStyle: 'none',
      decalStyle: 'two_tone',
      headlightStyle: 'warm',
    },
    route: [
      {x: 29.5 * TILE_SIZE, y: 29.5 * TILE_SIZE},
      {x: 51.5 * TILE_SIZE, y: 29.5 * TILE_SIZE},
      {x: 51.5 * TILE_SIZE, y: 50.5 * TILE_SIZE},
      {x: 29.5 * TILE_SIZE, y: 50.5 * TILE_SIZE},
    ],
  },
  {
    id: 'traffic_courier_2',
    name: 'City Parcel Van',
    modelId: 'van',
    speed: 112,
    customization: {
      paintColor: '#0284c7',
      secondaryColor: '#e0f2fe',
      wheelStyle: 'alloy_star',
      spoilerStyle: 'none',
      decalStyle: 'side_bolt',
      headlightStyle: 'ice_blue',
    },
    route: [
      {x: 51.5 * TILE_SIZE, y: 50.5 * TILE_SIZE},
      {x: 29.5 * TILE_SIZE, y: 50.5 * TILE_SIZE},
      {x: 29.5 * TILE_SIZE, y: 29.5 * TILE_SIZE},
      {x: 51.5 * TILE_SIZE, y: 29.5 * TILE_SIZE},
    ],
  },
  {
    id: 'traffic_blvd_3',
    name: 'Boulevard Coupe',
    modelId: 'coupe',
    speed: 138,
    customization: {
      paintColor: '#dc2626',
      secondaryColor: '#f87171',
      wheelStyle: 'gold_rim',
      spoilerStyle: 'street_lip',
      decalStyle: 'racing_stripe',
      headlightStyle: 'warm',
    },
    route: [
      {x: 6 * TILE_SIZE, y: 29.5 * TILE_SIZE},
      {x: 130 * TILE_SIZE, y: 29.5 * TILE_SIZE},
      {x: 130 * TILE_SIZE, y: 27.5 * TILE_SIZE},
      {x: 6 * TILE_SIZE, y: 27.5 * TILE_SIZE},
    ],
  },
  {
    id: 'traffic_bus_4',
    name: 'Chaos Metro Transit Bus',
    modelId: 'bus',
    speed: 108,
    customization: {
      paintColor: '#2563eb',
      secondaryColor: '#f8fafc',
      wheelStyle: 'stock',
      spoilerStyle: 'none',
      decalStyle: 'two_tone',
      headlightStyle: 'warm',
    },
    route: [
      {x: 130 * TILE_SIZE, y: 50.5 * TILE_SIZE},
      {x: 6 * TILE_SIZE, y: 50.5 * TILE_SIZE},
      {x: 6 * TILE_SIZE, y: 52.5 * TILE_SIZE},
      {x: 130 * TILE_SIZE, y: 52.5 * TILE_SIZE},
    ],
  },
  {
    id: 'traffic_moto_5',
    name: 'Eastside Rider',
    modelId: 'motorcycle',
    speed: 132,
    customization: {
      paintColor: '#8b5cf6',
      secondaryColor: '#ddd6fe',
      wheelStyle: 'sport_tread',
      spoilerStyle: 'none',
      decalStyle: 'side_bolt',
      headlightStyle: 'neon_gold',
    },
    route: [
      {x: 51.5 * TILE_SIZE, y: 8 * TILE_SIZE},
      {x: 51.5 * TILE_SIZE, y: 104 * TILE_SIZE},
      {x: 53.5 * TILE_SIZE, y: 104 * TILE_SIZE},
      {x: 53.5 * TILE_SIZE, y: 8 * TILE_SIZE},
    ],
  },
  {
    id: 'traffic_luxury_suv_6',
    name: 'Luxury Heights SUV',
    modelId: 'suv',
    speed: 132,
    customization: {
      paintColor: '#0f172a',
      secondaryColor: '#fbbf24',
      wheelStyle: 'gold_rim',
      spoilerStyle: 'none',
      decalStyle: 'two_tone',
      headlightStyle: 'ice_blue',
    },
    route: [
      {x: 80 * TILE_SIZE, y: 16.5 * TILE_SIZE},
      {x: 124 * TILE_SIZE, y: 16.5 * TILE_SIZE},
      {x: 124 * TILE_SIZE, y: 14.5 * TILE_SIZE},
      {x: 80 * TILE_SIZE, y: 14.5 * TILE_SIZE},
    ],
  },
  {
    id: 'traffic_express_7',
    name: 'Expressway Pickup',
    modelId: 'pickup',
    speed: 144,
    customization: {
      paintColor: '#ea580c',
      secondaryColor: '#fed7aa',
      wheelStyle: 'sport_tread',
      spoilerStyle: 'none',
      decalStyle: 'racing_stripe',
      headlightStyle: 'warm',
    },
    route: [
      {x: 16 * TILE_SIZE, y: 82.5 * TILE_SIZE},
      {x: 131 * TILE_SIZE, y: 82.5 * TILE_SIZE},
      {x: 131 * TILE_SIZE, y: 80.5 * TILE_SIZE},
      {x: 16 * TILE_SIZE, y: 80.5 * TILE_SIZE},
    ],
  },
  {
    id: 'traffic_coastal_8',
    name: 'Airport Coastal Shuttle',
    modelId: 'taxi',
    speed: 124,
    customization: {
      paintColor: '#06b6d4',
      secondaryColor: '#cffafe',
      wheelStyle: 'alloy_star',
      spoilerStyle: 'none',
      decalStyle: 'two_tone',
      headlightStyle: 'ice_blue',
    },
    route: [
      {x: 131.5 * TILE_SIZE, y: 17 * TILE_SIZE},
      {x: 131.5 * TILE_SIZE, y: 106 * TILE_SIZE},
      {x: 133.5 * TILE_SIZE, y: 106 * TILE_SIZE},
      {x: 133.5 * TILE_SIZE, y: 17 * TILE_SIZE},
    ],
  },
  {
    id: 'traffic_industrial_9',
    name: 'Ironworks Freight Van',
    modelId: 'van',
    speed: 118,
    customization: {
      paintColor: '#475569',
      secondaryColor: '#fb923c',
      wheelStyle: 'stock',
      spoilerStyle: 'none',
      decalStyle: 'two_tone',
      headlightStyle: 'warm',
    },
    route: [
      {x: 94.5 * TILE_SIZE, y: 16 * TILE_SIZE},
      {x: 94.5 * TILE_SIZE, y: 105 * TILE_SIZE},
      {x: 96.5 * TILE_SIZE, y: 105 * TILE_SIZE},
      {x: 96.5 * TILE_SIZE, y: 16 * TILE_SIZE},
    ],
  },
  {
    id: 'traffic_southring_10',
    name: 'South Ring Sedan',
    modelId: 'sedan',
    speed: 136,
    customization: {
      paintColor: '#10b981',
      secondaryColor: '#d1fae5',
      wheelStyle: 'alloy_star',
      spoilerStyle: 'street_lip',
      decalStyle: 'none',
      headlightStyle: 'warm',
    },
    route: [
      {x: 29.5 * TILE_SIZE, y: 106.5 * TILE_SIZE},
      {x: 132 * TILE_SIZE, y: 106.5 * TILE_SIZE},
      {x: 132 * TILE_SIZE, y: 104.5 * TILE_SIZE},
      {x: 29.5 * TILE_SIZE, y: 104.5 * TILE_SIZE},
    ],
  },
];

export class TrafficSystem {
  private readonly agents: TrafficAgent[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    for (const spec of TRAFFIC_SPECS) {
      const texKey = `traffic_tex_${spec.id}`;
      ensureCustomVehicleTexture(scene, texKey, spec.modelId, spec.customization);
      const start = spec.route[0];
      const sprite = scene.add.sprite(start.x, start.y, texKey, '3');
      sprite.setOrigin(0.5, 0.65);
      sprite.setDepth(start.y + 6);

      this.agents.push({
        id: spec.id,
        name: spec.name,
        sprite,
        route: spec.route,
        wpIndex: 1,
        maxSpeed: spec.speed,
        currentSpeed: spec.speed * 0.6,
        direction: 'right',
      });
    }
  }

  public update(
    dtSec: number,
    paused: boolean,
    playerPos: {x: number; y: number},
    worldVehicles: {x: number; y: number}[],
  ): void {
    if (paused) return;
    const signal = cityClockSystem.getTrafficSignal();

    for (const agent of this.agents) {
      const target = agent.route[agent.wpIndex];
      const dx = target.x - agent.sprite.x;
      const dy = target.y - agent.sprite.y;
      const dist = Math.hypot(dx, dy);

      const distToPlayer = Math.hypot(agent.sprite.x - playerPos.x, agent.sprite.y - playerPos.y);
      const nearPlayer = distToPlayer < 1300;
      agent.sprite.setVisible(nearPlayer);

      if (dist <= 6) {
        agent.sprite.setPosition(target.x, target.y);
        agent.wpIndex = (agent.wpIndex + 1) % agent.route.length;
        continue;
      }

      const ux = dx / dist;
      const uy = dy / dist;
      if (Math.abs(ux) > Math.abs(uy)) {
        agent.direction = ux < 0 ? 'left' : 'right';
      } else {
        agent.direction = uy < 0 ? 'up' : 'down';
      }

      // Simplified lightweight movement when far from camera
      if (!nearPlayer) {
        const step = Math.min(dist, agent.maxSpeed * 0.85 * dtSec);
        agent.sprite.x += ux * step;
        agent.sprite.y += uy * step;
        continue;
      }

      let mustYield = false;

      // 1. Traffic light check when approaching an intersection stop line
      for (const sl of STOP_LINES) {
        if (sl.dir !== agent.direction) continue;
        const lightColor = sl.axis === 'ew' ? signal.ew : signal.ns;
        if (lightColor === 'green') continue;
        const aheadX = sl.x - agent.sprite.x;
        const aheadY = sl.y - agent.sprite.y;
        const forwardDot = aheadX * ux + aheadY * uy;
        const lateralDist = Math.abs(aheadX * -uy + aheadY * ux);
        if (forwardDot >= 0 && forwardDot <= 36 && lateralDist <= 20) {
          mustYield = true;
          break;
        }
      }

      // 2. Yield to player, parked/driven cars, and other traffic ahead
      if (!mustYield) {
        const obstacles = [playerPos, ...worldVehicles];
        for (const obs of obstacles) {
          const ox = obs.x - agent.sprite.x;
          const oy = obs.y - agent.sprite.y;
          const forwardDot = ox * ux + oy * uy;
          const lateralDist = Math.abs(ox * -uy + oy * ux);
          if (forwardDot > 0 && forwardDot < 74 && lateralDist < 34) {
            mustYield = true;
            break;
          }
        }
      }

      if (!mustYield) {
        for (const other of this.agents) {
          if (other.id === agent.id) continue;
          const ox = other.sprite.x - agent.sprite.x;
          const oy = other.sprite.y - agent.sprite.y;
          const forwardDot = ox * ux + oy * uy;
          const lateralDist = Math.abs(ox * -uy + oy * ux);
          if (forwardDot > 0 && forwardDot < 82 && lateralDist < 28) {
            mustYield = true;
            break;
          }
        }
      }

      const desiredSpeed = mustYield ? 0 : agent.maxSpeed;
      const accel = mustYield ? 8.5 : 4.2;
      agent.currentSpeed = Phaser.Math.Linear(
        agent.currentSpeed,
        desiredSpeed,
        Math.min(1, dtSec * accel),
      );

      if (agent.currentSpeed > 2) {
        const step = Math.min(dist, agent.currentSpeed * dtSec);
        agent.sprite.x += ux * step;
        agent.sprite.y += uy * step;
      }

      agent.sprite.setFrame(DIR_FRAME[agent.direction]);
      agent.sprite.setDepth(agent.sprite.y + 6);
    }
  }

  public getPositions(): {x: number; y: number; name: string}[] {
    return this.agents.map((a) => ({
      x: a.sprite.x,
      y: a.sprite.y,
      name: a.name,
    }));
  }

  public destroy(): void {
    for (const a of this.agents) {
      a.sprite.destroy();
    }
    this.agents.length = 0;
  }
}
