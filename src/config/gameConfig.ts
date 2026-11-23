import Phaser from 'phaser';
import {BootScene} from '@/src/game/scenes/BootScene';
import {CityScene} from '@/src/game/scenes/CityScene';
import {InteriorScene} from '@/src/game/scenes/InteriorScene';
import {MainMenuScene} from '@/src/game/scenes/MainMenuScene';
import {PreloadScene} from '@/src/game/scenes/PreloadScene';

export function createPhaserConfig(parentId: string): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: parentId,
    backgroundColor: '#060b16',
    width: window.innerWidth || 1280,
    height: window.innerHeight || 720,
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: {x: 0, y: 0},
        debug: false,
      },
    },
    input: {
      activePointers: 3,
    },
    scene: [BootScene, PreloadScene, MainMenuScene, CityScene, InteriorScene],
  };
}
