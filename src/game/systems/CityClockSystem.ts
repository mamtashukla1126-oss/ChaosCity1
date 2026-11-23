import {CITY_EVENTS} from '@/src/game/data/cityLifeData';
import {CityEventDefinition} from '@/src/game/data/cityLifeData';
import {TimeOfDayPhase} from '@/src/game/types/gameTypes';

export interface CityAtmosphereState {
  phase: TimeOfDayPhase;
  tintColor: number;
  tintAlpha: number;
  lampAlpha: number;
  cloudAlpha: number;
}

export interface TrafficSignalState {
  ew: 'green' | 'yellow' | 'red';
  ns: 'green' | 'yellow' | 'red';
}

/**
 * Shared CHAOS CITY time-of-day clock & intersection traffic signal controller.
 * One full 24h city cycle runs ~8 real-world minutes (3 game minutes per real second).
 */
class CityClockSystem {
  private minutesOfDay = 9 * 60 + 30; // Start at pleasant 09:30 AM
  private signalTimerSec = 0;

  public update(dtSec: number, paused: boolean): void {
    if (paused) return;
    this.minutesOfDay = (this.minutesOfDay + dtSec * 3.0) % (24 * 60);
    this.signalTimerSec = (this.signalTimerSec + dtSec) % 12;
  }

  public getMinutesOfDay(): number {
    return this.minutesOfDay;
  }

  public getPhase(): TimeOfDayPhase {
    const h = this.minutesOfDay / 60;
    if (h >= 6 && h < 12) return 'morning';
    if (h >= 12 && h < 17.5) return 'afternoon';
    if (h >= 17.5 && h < 20.5) return 'dusk';
    return 'night';
  }

  public getFormattedTime(): string {
    const total = Math.floor(this.minutesOfDay);
    const h24 = Math.floor(total / 60) % 24;
    const mins = total % 60;
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${String(h12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;
  }

  public getPhaseBadge(): {label: string; icon: string} {
    switch (this.getPhase()) {
      case 'morning':
        return {label: 'Morning', icon: '🌅'};
      case 'afternoon':
        return {label: 'Afternoon', icon: '☀️'};
      case 'dusk':
        return {label: 'Sunset', icon: '🌇'};
      case 'night':
        return {label: 'Night', icon: '🌙'};
    }
  }

  public getActiveEvent(): CityEventDefinition {
    return CITY_EVENTS[this.getPhase()];
  }

  public getTrafficSignal(): TrafficSignalState {
    const t = this.signalTimerSec;
    if (t < 4.8) return {ew: 'green', ns: 'red'};
    if (t < 6.0) return {ew: 'yellow', ns: 'red'};
    if (t < 10.8) return {ew: 'red', ns: 'green'};
    return {ew: 'red', ns: 'yellow'};
  }

  public getAtmosphere(): CityAtmosphereState {
    const h = this.minutesOfDay / 60;
    const phase = this.getPhase();

    if (h >= 7.5 && h < 16.8) {
      return {phase, tintColor: 0x0f172a, tintAlpha: 0, lampAlpha: 0.08, cloudAlpha: 0.14};
    }
    if (h >= 16.8 && h < 19.6) {
      // Sunset dusk warmth
      const t = Math.sin(((h - 16.8) / 2.8) * Math.PI);
      return {
        phase,
        tintColor: 0xea580c,
        tintAlpha: Number((t * 0.16).toFixed(3)),
        lampAlpha: Number((0.25 + t * 0.55).toFixed(3)),
        cloudAlpha: 0.1,
      };
    }
    if (h >= 19.6 && h < 21.2) {
      // Transition into indigo starlight night
      const t = (h - 19.6) / 1.6;
      return {
        phase,
        tintColor: 0x0f172a,
        tintAlpha: Number((t * 0.34).toFixed(3)),
        lampAlpha: Number((0.6 + t * 0.35).toFixed(3)),
        cloudAlpha: 0.05,
      };
    }
    if (h >= 5.5 && h < 7.5) {
      // Dawn clearing
      const t = 1 - (h - 5.5) / 2.0;
      return {
        phase,
        tintColor: 0x1e293b,
        tintAlpha: Number((t * 0.32).toFixed(3)),
        lampAlpha: Number((0.15 + t * 0.7).toFixed(3)),
        cloudAlpha: 0.11,
      };
    }
    // Night (21:12 .. 05:30)
    return {phase, tintColor: 0x0b132b, tintAlpha: 0.34, lampAlpha: 0.92, cloudAlpha: 0.04};
  }
}

export const cityClockSystem = new CityClockSystem();
