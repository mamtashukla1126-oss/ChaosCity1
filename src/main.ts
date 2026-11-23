import Phaser from 'phaser';
import {createPhaserConfig} from '@/src/config/gameConfig';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {OrientationOverlay} from '@/src/game/ui/OrientationOverlay';
import {globalErrorBoundary} from '@/src/game/utils/errorBoundary';
import '@/src/styles/main.css';

function bootstrapGame(): void {
  const root = document.getElementById('game-root');
  if (!root) {
    throw new Error('Missing #game-root container element.');
  }

  const phaserContainer = document.createElement('div');
  phaserContainer.id = 'phaser-container';
  root.appendChild(phaserContainer);

  const uiOverlay = document.createElement('div');
  uiOverlay.id = 'ui-overlay';
  root.appendChild(uiOverlay);

  let gameInstance: Phaser.Game | null = null;
  globalErrorBoundary.install({
    getPhaserGame: () => gameInstance,
  });

  // Landscape orientation guard for portrait mobile viewports
  new OrientationOverlay(uiOverlay);

  // Unlock Web Audio strictly on first user gesture
  const unlockOnce = (): void => {
    audioSystem.unlock();
    window.removeEventListener('pointerdown', unlockOnce);
    window.removeEventListener('keydown', unlockOnce);
  };
  window.addEventListener('pointerdown', unlockOnce, {passive: true});
  window.addEventListener('keydown', unlockOnce, {passive: true});

  const config = createPhaserConfig('phaser-container');
  gameInstance = new Phaser.Game(config);
}

bootstrapGame();
