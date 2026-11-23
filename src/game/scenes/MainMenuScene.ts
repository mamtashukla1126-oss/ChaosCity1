import Phaser from 'phaser';
import {SCENE_KEYS} from '@/src/config/constants';
import {NPC} from '@/src/game/entities/NPC';
import {createCityMapData} from '@/src/game/maps/cityMap';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {CameraSystem} from '@/src/game/systems/CameraSystem';
import {CollisionSystem} from '@/src/game/systems/CollisionSystem';
import {gameSessionManager} from '@/src/game/systems/GameSessionManager';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {WorldSystem} from '@/src/game/systems/WorldSystem';
import {MainMenuUI} from '@/src/game/ui/MainMenuUI';

import {onFullscreenChange} from '@/src/game/utils/device';

export class MainMenuScene extends Phaser.Scene {
  private collisionSystem: CollisionSystem | null = null;
  private worldSystem: WorldSystem | null = null;
  private cameraSystem: CameraSystem | null = null;
  private npcs: NPC[] = [];
  private menuUI: MainMenuUI | null = null;
  private unsubFullscreen: (() => void) | null = null;
  private fsResizeTimer: number | null = null;
  private startingCity = false;

  private readonly onResizeBound = (): void => {
    if (!this.sys?.isActive()) return;
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    this.scale.resize(w, h);
    this.cameraSystem?.handleResize(w, h);
  };

  constructor() {
    super({key: SCENE_KEYS.MAIN_MENU});
  }

  public create(): void {
    this.startingCity = false;
    const uiOverlay = document.getElementById('ui-overlay');
    if (!uiOverlay) return;

    const save = saveSystem.getState();
    const mapData = createCityMapData();

    this.collisionSystem = new CollisionSystem(this);
    this.worldSystem = new WorldSystem(this, mapData, this.collisionSystem);
    this.worldSystem.build();

    this.npcs = mapData.npcs.map((cfg) => {
      const npc = new NPC(this, cfg);
      this.collisionSystem?.bindSpriteCollider(npc.sprite);
      return npc;
    });

    this.cameraSystem = new CameraSystem(this, Math.max(1.15, save.settings.cameraZoom));

    const startCity = () => {
      if (this.startingCity || !this.sys?.isActive()) return;
      this.startingCity = true;
      audioSystem.startCityMusic();
      this.scene.start(SCENE_KEYS.CITY);
    };

    this.menuUI = new MainMenuUI(uiOverlay, {
      onPlayStoryMode: () => startCity(),
      onPlayMultiplayer: () => startCity(),
      onSettingsChanged: (settings) => {
        this.cameraSystem?.setZoom(Math.max(1.1, settings.cameraZoom), true);
      },
    });

    const returnAction = gameSessionManager.consumeReturnToMainMenuAction();
    if (returnAction === 'open_multiplayer_hub') {
      this.menuUI.openMultiplayerHub();
    } else if (returnAction === 'open_friends') {
      this.menuUI.openFriends();
    }

    window.addEventListener('resize', this.onResizeBound);
    this.unsubFullscreen = onFullscreenChange(() => {
      if (this.fsResizeTimer !== null) window.clearTimeout(this.fsResizeTimer);
      this.fsResizeTimer = window.setTimeout(this.onResizeBound, 60);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
  }

  public update(_time: number, delta: number): void {
    const dtMs = Math.min(delta, 50);
    const dtSec = dtMs / 1000;
    this.cameraSystem?.updateMenuPan(dtSec);
    for (const npc of this.npcs) {
      npc.update(dtMs, false);
    }
  }

  private cleanup(): void {
    this.startingCity = false;
    if (this.fsResizeTimer !== null) {
      window.clearTimeout(this.fsResizeTimer);
      this.fsResizeTimer = null;
    }
    window.removeEventListener('resize', this.onResizeBound);
    this.unsubFullscreen?.();
    this.unsubFullscreen = null;
    this.menuUI?.destroy();
    this.menuUI = null;
    for (const npc of this.npcs) {
      npc.destroy();
    }
    this.npcs = [];
    this.worldSystem?.destroy();
    this.worldSystem = null;
    this.collisionSystem?.destroy();
    this.collisionSystem = null;
    this.cameraSystem = null;
  }
}
