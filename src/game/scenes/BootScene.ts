import Phaser from 'phaser';
import {SCENE_KEYS} from '@/src/config/constants';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {saveSystem} from '@/src/game/systems/SaveSystem';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({key: SCENE_KEYS.BOOT});
  }

  public create(): void {
    const state = saveSystem.load();
    audioSystem.applySettings(state.settings.audio);
    this.scene.start(SCENE_KEYS.PRELOAD);
  }
}
