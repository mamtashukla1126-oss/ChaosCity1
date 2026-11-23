import Phaser from 'phaser';
import {SCENE_KEYS, TILE_SIZE} from '@/src/config/constants';
import {NPC} from '@/src/game/entities/NPC';
import {Player} from '@/src/game/entities/Player';
import {KeyboardController} from '@/src/game/input/KeyboardController';
import {TouchController} from '@/src/game/input/TouchController';
import {createInteriorLayout, InteriorLayout} from '@/src/game/interiors/interiorData';
import {getPropertyByBuildingId, getPropertyById} from '@/src/game/data/propertyData';
import {createCityMapData} from '@/src/game/maps/cityMap';
import {RemotePlayer} from '@/src/game/entities/RemotePlayer';
import {audioSystem} from '@/src/game/systems/AudioSystem';
import {authSystem} from '@/src/game/systems/AuthSystem';
import {CameraSystem} from '@/src/game/systems/CameraSystem';
import {cityClockSystem} from '@/src/game/systems/CityClockSystem';
import {cloudSaveManager} from '@/src/game/systems/CloudSaveManager';
import {CollisionSystem} from '@/src/game/systems/CollisionSystem';
import {economySystem, ProgressionAwardSummary} from '@/src/game/systems/EconomySystem';
import {friendsSystem} from '@/src/game/systems/FriendsSystem';
import {gameSessionManager} from '@/src/game/systems/GameSessionManager';
import {InteractionSystem} from '@/src/game/systems/InteractionSystem';
import {multiplayerClient} from '@/src/game/systems/MultiplayerClient';
import {ownerBadgeService} from '@/src/game/systems/OwnerBadgeService';
import {propertySystem} from '@/src/game/systems/PropertySystem';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {wantedState} from '@/src/game/systems/WantedSystem';
import {
  EmoteId,
  FurnitureCatalogItem,
  GameSettings,
  InteractiveObjectData,
  InteriorSceneLaunchData,
  PropertyDeed,
  PropertyDef,
  RemotePlayerState,
  SavedPosition,
  ServerInviteItem,
} from '@/src/game/types/gameTypes';
import {ActivityModal} from '@/src/game/ui/ActivityModal';
import {ArcadeModal} from '@/src/game/ui/ArcadeModal';
import {CinemaModal} from '@/src/game/ui/CinemaModal';
import {ComputerModal} from '@/src/game/ui/ComputerModal';
import {CutsceneOverlay} from '@/src/game/ui/CutsceneOverlay';
import {DecorateToolbar} from '@/src/game/ui/DecorateToolbar';
import {FriendsModal} from '@/src/game/ui/FriendsModal';
import {GameHUD} from '@/src/game/ui/GameHUD';
import {GarageModal} from '@/src/game/ui/GarageModal';
import {InventoryModal} from '@/src/game/ui/InventoryModal';
import {JournalModal, JournalTab} from '@/src/game/ui/JournalModal';
import {MiniGamesModal} from '@/src/game/ui/MiniGamesModal';
import {MissionManModal} from '@/src/game/ui/MissionManModal';
import {PauseMenu} from '@/src/game/ui/PauseMenu';
import {PhoneModal} from '@/src/game/ui/PhoneModal';
import {ProfileModal} from '@/src/game/ui/ProfileModal';
import {PropertyModal} from '@/src/game/ui/PropertyModal';
import {SettingsModal} from '@/src/game/ui/SettingsModal';
import {ShopModal} from '@/src/game/ui/ShopModal';
import {SocialModal, SocialTab} from '@/src/game/ui/SocialModal';
import {TvModal} from '@/src/game/ui/TvModal';
import {onFullscreenChange, shouldShowTouchControls} from '@/src/game/utils/device';

export class InteriorScene extends Phaser.Scene {
  private launchData: InteriorSceneLaunchData | null = null;
  private layout: InteriorLayout | null = null;
  private buildingId = 'b_house_1';
  private buildingLabel = 'Interior';
  private activeDeedId: string | null = null;
  private activeDeed: PropertyDeed | null = null;
  private activePropDef: PropertyDef | null = null;
  private readOnlyVisitor = false;
  private decorateMode = false;
  private pendingCatalogItem: FurnitureCatalogItem | null = null;
  private selectedFurnitureUid: string | null = null;
  private selectionRing: Phaser.GameObjects.Rectangle | null = null;

  private collisionSystem: CollisionSystem | null = null;
  private cameraSystem: CameraSystem | null = null;
  private interactionSystem: InteractionSystem | null = null;
  private keyboard: KeyboardController | null = null;
  private touchController: TouchController | null = null;

  private tilemap: Phaser.Tilemaps.Tilemap | null = null;
  private tileLayer: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer | null = null;
  private propSprites: Phaser.GameObjects.GameObject[] = [];
  private exitDoorSprite: Phaser.GameObjects.Image | null = null;
  private tvSprite: Phaser.GameObjects.Image | null = null;
  private tvPowerOn = false;
  private gateObjects: {
    gateId: string;
    sprite?: Phaser.GameObjects.Image;
    zone?: Phaser.GameObjects.Zone;
    isOpen?: boolean;
    bounds?: {centerX: number; centerY: number; width: number; height: number};
  }[] = [];

  private player: Player | null = null;
  private remotePlayersMap = new Map<string, RemotePlayer>();
  private npcs: NPC[] = [];

  private hud: GameHUD | null = null;
  private shopModal: ShopModal | null = null;
  private inventoryModal: InventoryModal | null = null;
  private arcadeModal: ArcadeModal | null = null;
  private cinemaModal: CinemaModal | null = null;
  private activityModal: ActivityModal | null = null;
  private tvModal: TvModal | null = null;
  private computerModal: ComputerModal | null = null;
  private garageModal: GarageModal | null = null;
  private phoneModal: PhoneModal | null = null;
  private cutsceneOverlay: CutsceneOverlay | null = null;
  private miniGamesModal: MiniGamesModal | null = null;
  private journalModal: JournalModal | null = null;
  private pauseMenu: PauseMenu | null = null;
  private settingsModal: SettingsModal | null = null;
  private socialModal: SocialModal | null = null;
  private friendsModal: FriendsModal | null = null;
  private missionManModal: MissionManModal | null = null;
  private missionManMarker: Phaser.GameObjects.Text | null = null;
  private propertyModal: PropertyModal | null = null;
  private profileModal: ProfileModal | null = null;
  private decorateToolbar: DecorateToolbar | null = null;

  private isPaused = false;
  private userUsedTouch = false;
  private entryGraceSec = 0.55;
  private clockUiTimerSec = 0;
  private exiting = false;
  private returningToMenu = false;
  private acceptingPropertyInvite = false;
  private unsubFullscreen: (() => void) | null = null;
  private unsubMpPlayers: (() => void) | null = null;
  private unsubMpEmote: (() => void) | null = null;
  private unsubMpNotice: (() => void) | null = null;
  private unsubMpPropUpdate: (() => void) | null = null;
  private unsubMpStatus: (() => void) | null = null;
  private unsubMpRoomClosed: (() => void) | null = null;
  private fsResizeTimer: number | null = null;
  private exitTimer: Phaser.Time.TimerEvent | null = null;

  private readonly onResizeBound = (): void => {
    if (!this.sys?.isActive() || !this.scale || !this.cameras?.main) return;
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    this.scale.resize(w, h);
    this.cameraSystem?.handleResize(w, h);
    this.syncTouchVisibility();
  };

  constructor() {
    super({key: SCENE_KEYS.INTERIOR});
  }

  public init(data: InteriorSceneLaunchData): void {
    this.launchData = data;
  }

  public create(): void {
    const uiOverlay = document.getElementById('ui-overlay');
    if (!uiOverlay) return;

    const cityData = createCityMapData();
    const fallbackBuilding = cityData.buildings[0];
    const buildingId = this.launchData?.buildingId ?? fallbackBuilding.id;
    const buildingMeta =
      cityData.buildings.find((b) => b.id === buildingId) ?? fallbackBuilding;
    this.buildingId = buildingId;
    this.buildingLabel = buildingMeta.label;

    const returnPos: SavedPosition = this.launchData?.returnPos ?? {
      x: buildingMeta.doorTileX * TILE_SIZE,
      y: buildingMeta.doorTileY * TILE_SIZE + 8,
      direction: 'down',
    };
    const propertyDeedId = this.launchData?.propertyDeedId;
    const propertyOwnerUid = this.launchData?.propertyOwnerUid;
    const readOnlyVisitor = Boolean(this.launchData?.readOnlyVisitor);
    this.launchData = {
      buildingId,
      returnPos,
      propertyDeedId,
      propertyOwnerUid,
      readOnlyVisitor,
    };

    this.activeDeedId = propertyDeedId ?? null;
    this.activePropDef =
      getPropertyByBuildingId(buildingId) ??
      (propertyDeedId ? getPropertyById(propertyDeedId.split('__')[1] ?? '') ?? null : null);
    this.readOnlyVisitor = readOnlyVisitor;
    this.activeDeed = null;
    this.decorateMode = false;
    this.pendingCatalogItem = null;
    this.selectedFurnitureUid = null;
    this.selectionRing = null;

    // Always keep external save position anchored safely outside at this building's entrance
    saveSystem.updatePosition(returnPos);
    economySystem.recordBuildingVisit(buildingId);

    this.isPaused = false;
    this.exiting = false;
    this.returningToMenu = false;
    this.acceptingPropertyInvite = false;
    this.exitTimer = null;
    this.entryGraceSec = 0.55;
    this.propSprites = [];
    this.gateObjects = [];
    this.exitDoorSprite = null;
    this.tvSprite = null;
    this.tvPowerOn = false;

    const layout = createInteriorLayout(buildingId, buildingMeta.label, null);
    this.layout = layout;
    const roomW = layout.cols * TILE_SIZE;
    const roomH = layout.rows * TILE_SIZE;

    const save = saveSystem.getState();
    document.documentElement.style.setProperty('--cc-ui-scale', String(save.settings.uiScale ?? 1));

    this.cameras.main.setBackgroundColor(layout.ambientBgHex);
    this.physics.world.setBounds(0, 0, roomW, roomH);
    this.collisionSystem = new CollisionSystem(this);

    // 4. Player
    this.player = new Player(
      this,
      layout.spawnPoint.x,
      layout.spawnPoint.y,
      save.appearanceId,
      save.playerName,
    );
    this.player.setWorldBounds(roomW, roomH);
    this.player.setDirection('up');
    const particlesOn =
      !save.settings.performanceMode &&
      save.settings.effectsQuality !== 'low' &&
      save.settings.graphicsQuality !== 'low';
    this.player.setParticlesEnabled(particlesOn);
    this.collisionSystem.bindSpriteCollider(this.player.sprite);

    // 5. Interior NPCs
    this.npcs = layout.npcs.map((cfg) => {
      const npc = new NPC(this, cfg);
      this.collisionSystem?.bindSpriteCollider(npc.sprite);
      if (this.player) {
        this.physics.add.collider(this.player.sprite, npc.sprite);
      }
      return npc;
    });

    // Build interior tiles, walls, props & interactives
    this.buildRoomContents(layout);
    this.missionManMarker = null;
    if (this.buildingId === 'b_mission_house') {
      const mmNpc = this.npcs.find((n) => n.config.id === 'npc_mission_man');
      if (mmNpc) {
        this.missionManMarker = this.add
          .text(mmNpc.sprite.x, mmNpc.sprite.y - 36, '!', {
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '15px',
            fontStyle: 'bold',
            color: '#fde047',
            backgroundColor: '#0b1326',
            padding: {left: 5, right: 5, top: 2, bottom: 2},
          })
          .setOrigin(0.5)
          .setDepth(9500);
        this.tweens.add({
          targets: this.missionManMarker,
          y: mmNpc.sprite.y - 42,
          duration: 750,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        this.refreshMissionManMarker();
      }
    }

    // 6. Camera
    this.cameraSystem = new CameraSystem(
      this,
      Math.max(save.settings.cameraZoom, 1.35),
      roomW,
      roomH,
    );
    this.cameraSystem.followTarget(this.player.sprite);

    // Canvas decorate placement / selection pointer handler
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (
        !this.sys?.isActive() ||
        this.exiting ||
        this.isPaused ||
        this.returningToMenu ||
        this.isAnyModalOpen() ||
        !this.decorateMode ||
        !this.activeDeed ||
        !this.activePropDef ||
        this.readOnlyVisitor
      ) {
        return;
      }
      if (this.pendingCatalogItem && this.layout) {
        const wx = Math.round(pointer.worldX / 8) * 8;
        const wy = Math.round(pointer.worldY / 8) * 8;
        const col = Math.floor(wx / TILE_SIZE);
        const row = Math.floor(wy / TILE_SIZE);
        if (row < 2 || row >= this.layout.rows - 1 || col < 1 || col >= this.layout.cols - 1) {
          this.hud?.showToast('Place furniture inside the room floor boundaries!');
          return;
        }
        if (this.activeDeed.furniture.length >= this.activePropDef.maxFurniture) {
          this.hud?.showToast(`Furniture limit (${this.activePropDef.maxFurniture}) reached!`);
          return;
        }
        if (economySystem.getCoins() < this.pendingCatalogItem.price) {
          audioSystem.playError();
          this.hud?.showToast(`Need ${this.pendingCatalogItem.price} Coins for ${this.pendingCatalogItem.name}!`);
          return;
        }
        const spent = economySystem.spendCoins(
          this.pendingCatalogItem.price,
          `Furniture: ${this.pendingCatalogItem.name}`,
        );
        if (!spent) return;
        const placedUid = `furn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        this.activeDeed = {
          ...this.activeDeed,
          furniture: [
            ...this.activeDeed.furniture,
            {
              uid: placedUid,
              catalogId: this.pendingCatalogItem.id,
              texture: this.pendingCatalogItem.texture,
              x: wx,
              y: wy,
              rotationDeg: 0,
            },
          ],
        };
        this.selectedFurnitureUid = placedUid;
        this.pendingCatalogItem = null;
        this.decorateToolbar?.clearPendingCatalogItem();
        audioSystem.playInteract();
        this.rebuildPropertyRoom();
      }
    });

    // 8. Input & Modals
    this.keyboard = new KeyboardController();
    this.touchController = new TouchController(uiOverlay, {
      onInteract: () => this.handleInteractAction(),
      onEmote: () => this.triggerQuickEmote('wave'),
      onAnyTouch: () => {
        if (!this.userUsedTouch) {
          this.userUsedTouch = true;
          this.syncTouchVisibility();
        }
      },
    });
    this.touchController.applyLayout(save.settings);

    const refreshPlayerAppearance = () => {
      const cur = saveSystem.getState();
      this.player?.applyAppearance(cur.appearanceId, cur.playerName);
      this.hud?.setPlayerInfo(cur.appearanceId, cur.playerName);
      multiplayerClient.syncProfile();
    };

    this.shopModal = new ShopModal(uiOverlay, {
      onAppearanceChanged: refreshPlayerAppearance,
      onItemPurchased: () => this.player?.playActionAnimation('celebrate'),
      onDineInCutscene: (item, domain) => {
        this.cutsceneOverlay?.openDineInCutscene(item, domain, () => {
          this.player?.playActionAnimation('celebrate');
          this.hud?.showToast(`Enjoyed ${item.name}! Energy ${economySystem.getEnergy()}/100.`);
        });
      },
      onCinemaUnlocked: () => this.unlockCinemaGate(),
      onClose: () => {
        // Let any ongoing celebrate animation finish, otherwise stop looping shop pose
        if (this.player?.getEntityState().animState === 'shop') {
          this.player.stopActionAnimation();
        }
      },
    });
    this.inventoryModal = new InventoryModal(uiOverlay, {
      onAppearanceChanged: refreshPlayerAppearance,
    });
    this.arcadeModal = new ArcadeModal(uiOverlay);
    this.cinemaModal = new CinemaModal(uiOverlay);
    this.activityModal = new ActivityModal(
      uiOverlay,
      undefined,
      () => this.player?.playActionAnimation('celebrate'),
    );
    this.cutsceneOverlay = new CutsceneOverlay(uiOverlay);
    this.miniGamesModal = new MiniGamesModal(uiOverlay, {
      onLaunchGame: (gameId) => {
        if (
          gameId === 'starlight_drift' ||
          gameId === 'brick_blitz' ||
          gameId === 'turbo_lane_racer' ||
          gameId === 'hoop_frenzy' ||
          gameId === 'reflex_surge' ||
          gameId === 'prism_match' ||
          gameId === 'memory_matrix'
        ) {
          this.arcadeModal?.open(gameId);
        } else if (gameId === 'streetball') {
          this.activityModal?.openBasketballMiniGame('Eastside Streetball', 'Quick Practice');
        } else if (gameId === 'soccer_penalty') {
          this.activityModal?.openSoccerMiniGame('Eastside Penalty Cup', 'Quick Practice');
        } else if (gameId === 'fountain_flip') {
          this.cutsceneOverlay?.openFountainCoinFlip('Central Park Fountain · Preview', (s) =>
            this.notifyProgression(s),
          );
        } else {
          this.hud?.showToast('Step outside into CHAOS CITY to start that outdoor timed challenge!');
        }
      },
      onAwarded: (summary) => this.notifyProgression(summary),
    });
    this.journalModal = new JournalModal(uiOverlay, {
      onTrackLocation: (_x, _y, label) => {
        this.hud?.showToast(`Tracking "${label}"! Step outside to follow the golden GPS marker.`);
      },
      onPlayStoryCutscene: (ch, mode, rewardBanner) => {
        const lines = mode === 'intro' ? ch.introDialogue : ch.outroDialogue;
        const cutId = `${ch.chapter}_${mode}`;
        this.cutsceneOverlay?.openStoryCutscene(ch.title, ch.subtitle, lines, rewardBanner, () => {
          economySystem.markStoryCutsceneWatched(cutId);
        });
      },
      onAwarded: (summary) => this.notifyProgression(summary),
    });

    const sofaObj = layout.interactives.find(
      (i) => i.kind === 'bench' && i.seatX !== undefined && i.seatY !== undefined,
    );
    this.tvModal = new TvModal(uiOverlay, {
      onPowerChanged: (isOn) => {
        this.tvPowerOn = isOn;
        this.tvSprite?.setFrame(isOn ? '1' : '0');
      },
      onSettingsChanged: (settings) => this.applySettings(settings),
      isSitting: () => Boolean(this.player?.getIsSitting()),
      onSitToggle: sofaObj
        ? () => {
            if (!this.player) return false;
            if (this.player.getIsSitting()) {
              this.player.standUp();
              this.hud?.setSittingState(false);
              return false;
            } else if (sofaObj.seatX !== undefined && sofaObj.seatY !== undefined) {
              this.player.sitAt(sofaObj.seatX, sofaObj.seatY);
              this.hud?.setSittingState(true);
              return true;
            }
            return false;
          }
        : undefined,
    });

    this.computerModal = new ComputerModal(uiOverlay, {
      onSettingsChanged: (settings) => this.applySettings(settings),
    });

    this.garageModal = new GarageModal(uiOverlay, {
      onVehicleUpdated: (veh) => {
        this.hud?.showToast(`Updated ${veh.name} — ready to spawn outdoors!`);
      },
    });

    this.profileModal = new ProfileModal(uiOverlay, {
      onOpenSettings: () => {
        this.pauseGame(false);
        this.settingsModal?.open();
      },
      onNotice: (msg) => this.hud?.showToast(msg),
    });
    this.propertyModal = new PropertyModal(uiOverlay, {
      onEnterProperty: (prop, deed, ro) => {
        this.closeAllModals();
        this.scene.start(SCENE_KEYS.INTERIOR, {
          buildingId: prop.buildingId,
          returnPos,
          propertyDeedId: deed.deedId,
          propertyOwnerUid: deed.ownerUid,
          readOnlyVisitor: ro,
        });
      },
      onAwarded: (summary) => this.notifyProgression(summary),
    });
    const isMp = gameSessionManager.isMultiplayer();

    this.socialModal = new SocialModal(uiOverlay, {
      getPlayerWorldPos: () => {
        const st = this.player?.getEntityState();
        return {
          x: st?.x ?? layout.spawnPoint.x,
          y: st?.y ?? layout.spawnPoint.y,
          interiorId: this.buildingId,
          propertyDeedId: this.activeDeedId,
        };
      },
      onViewProfile: (uid, prof, fallbackName) => {
        this.closeAllModals('profile');
        this.profileModal?.openPublicProfile(uid, prof, fallbackName);
      },
      onTriggerEmote: (em) => this.triggerQuickEmote(em),
      onNotice: (msg) => this.hud?.showToast(msg),
    });

    this.friendsModal = new FriendsModal(uiOverlay, {
      onViewProfile: (uid, prof, fallbackName) => {
        this.closeAllModals('profile');
        this.profileModal?.openPublicProfile(uid, prof, fallbackName);
      },
      onInvitedToServer: (targetUsername) => {
        this.hud?.showToast(`Server invite sent to @${targetUsername}!`);
      },
    });
    this.missionManModal = new MissionManModal(uiOverlay);

    this.decorateToolbar = new DecorateToolbar(uiOverlay, {
      onToggleDecorate: (active) => {
        this.decorateMode = active;
        if (!active) {
          this.pendingCatalogItem = null;
          this.selectedFurnitureUid = null;
          this.selectionRing?.setVisible(false);
        }
      },
      onChangeFloor: (floorStyle) => {
        if (!this.activeDeed || this.readOnlyVisitor) return;
        this.activeDeed = {...this.activeDeed, floorStyle};
        this.rebuildPropertyRoom();
      },
      onChangeWall: (wallStyle) => {
        if (!this.activeDeed || this.readOnlyVisitor) return;
        this.activeDeed = {...this.activeDeed, wallStyle};
        this.rebuildPropertyRoom();
      },
      onSelectPlacementCatalogItem: (item) => {
        this.pendingCatalogItem = item;
        if (item) this.selectedFurnitureUid = null;
      },
      onNudgeSelected: (dx, dy) => {
        if (!this.activeDeed || !this.selectedFurnitureUid || !this.layout || this.readOnlyVisitor) return;
        const maxX = (this.layout.cols - 1.5) * TILE_SIZE;
        const maxY = (this.layout.rows - 1.5) * TILE_SIZE;
        this.activeDeed = {
          ...this.activeDeed,
          furniture: this.activeDeed.furniture.map((f) =>
            f.uid === this.selectedFurnitureUid
              ? {
                  ...f,
                  x: Phaser.Math.Clamp(f.x + dx, TILE_SIZE * 1.5, maxX),
                  y: Phaser.Math.Clamp(f.y + dy, TILE_SIZE * 2.2, maxY),
                }
              : f,
          ),
        };
        this.rebuildPropertyRoom();
      },
      onRotateSelected: () => {
        if (!this.activeDeed || !this.selectedFurnitureUid || this.readOnlyVisitor) return;
        this.activeDeed = {
          ...this.activeDeed,
          furniture: this.activeDeed.furniture.map((f) =>
            f.uid === this.selectedFurnitureUid
              ? {...f, rotationDeg: ((f.rotationDeg ?? 0) + 90) % 360}
              : f,
          ),
        };
        this.rebuildPropertyRoom();
      },
      onRemoveSelected: () => {
        if (!this.activeDeed || !this.selectedFurnitureUid || this.readOnlyVisitor) return;
        this.activeDeed = {
          ...this.activeDeed,
          furniture: this.activeDeed.furniture.filter((f) => f.uid !== this.selectedFurnitureUid),
        };
        this.selectedFurnitureUid = null;
        this.rebuildPropertyRoom();
      },
      onSaveDeed: async () => {
        if (!this.activeDeed || this.readOnlyVisitor) return false;
        const ok = await propertySystem.saveDeed(this.activeDeed);
        this.hud?.showToast(ok ? 'Property layout saved & synced!' : 'Saved locally (offline).');
        return ok;
      },
    });

    this.phoneModal = new PhoneModal(uiOverlay, {
      onOpenGarage: buildingId === 'b_garage' ? (tab) => this.garageModal?.open(tab) : undefined,
      onOpenMiniGamesHub: () => this.openMiniGamesHub(),
      onOpenJournal: (tab) => this.toggleJournal(tab),
      onOpenSocial: isMp ? (tab) => this.toggleSocial(tab) : undefined,
      onOpenProperties: () => this.openProperties(),
      onOpenProfile: () => this.openSelfProfile(),
      onSpawnVehicle: () => ({
        ok: false,
        message: 'Step outside into CHAOS CITY first before spawning your vehicle!',
      }),
      onDespawnVehicle: () => ({
        ok: false,
        message: 'No vehicle deployed outdoors from inside this building.',
      }),
      hasSpawnedPersonalVehicle: () => false,
      getSpawnCooldownSec: () => 0,
      getCurrentDistrictName: () => this.layout?.title ?? layout.title,
      getPlayerCoords: () => returnPos,
      getPersonalVehicleCoords: () => null,
      getNpcDirectory: () => {
        const phase = cityClockSystem.getPhase();
        return cityData.npcs.map((n) => {
          const slot = n.routine?.find((r) => r.phase === phase);
          return {
            id: n.id,
            name: n.name,
            role: n.role,
            district: n.district,
            activityLabel: slot ? slot.locationLabel : `${n.role} · Around City`,
          };
        });
      },
      onAppearanceChanged: refreshPlayerAppearance,
      onSettingsChanged: (settings) => this.applySettings(settings),
    });

    this.settingsModal = new SettingsModal(uiOverlay, {
      onSettingsChanged: (settings) => this.applySettings(settings),
      onClose: () => {
        if (!this.pauseMenu?.isOpen() && this.isPaused) {
          this.resumeGame();
        }
      },
      onSaveReset: () => {
        refreshPlayerAppearance();
        this.applySettings(saveSystem.getState().settings);
      },
    });

    this.pauseMenu = new PauseMenu(uiOverlay, {
      onResume: () => this.resumeGame(),
      onOpenSocial: isMp
        ? () => {
            this.resumeGame();
            this.toggleSocial('servers');
          }
        : undefined,
      onOpenProperties: () => {
        this.resumeGame();
        this.openProperties();
      },
      onOpenProfile: () => {
        this.resumeGame();
        this.openSelfProfile();
      },
      onOpenJournal: () => {
        this.resumeGame();
        this.toggleJournal(isMp ? 'missions' : 'story');
      },
      onOpenMiniGames: () => {
        this.resumeGame();
        this.openMiniGamesHub();
      },
      onOpenSettings: () => this.settingsModal?.open(),
      onReturnToMenu: () => this.returnToMainMenu(isMp),
    });

    this.hud = new GameHUD(uiOverlay, null, {
      onOpenPhone: () => this.togglePhone(),
      onOpenJournal: (tab) => this.toggleJournal(tab ?? 'missions'),
      onOpenMiniGames: () => this.openMiniGamesHub(),
      onOpenSocial: isMp ? (tab) => this.toggleSocial(tab) : undefined,
      onOpenFriends: isMp ? () => this.openFriendsModal() : undefined,
      onLeaveServer: isMp ? () => this.returnToMainMenu(true) : undefined,
      onCloseHostedServer: isMp ? () => void this.closeHostedServerRoom() : undefined,
      onAcceptServerInvite: isMp ? (inv, pw) => this.acceptLiveServerInvite(inv, pw) : undefined,
      onDeclineServerInvite: isMp
        ? (inviteId) => {
            void multiplayerClient.respondToServerInvite(inviteId, 'decline');
          }
        : undefined,
      onOpenProperties: () => this.openProperties(),
      onOpenProfile: () => this.openSelfProfile(),
      onQuickEmote: (em) => this.triggerQuickEmote(em),
      onAcceptPropertyInvite: (deedId) => void this.acceptPropertyInvite(deedId),
      onViewRemoteProfile: (rp) => {
        this.closeAllModals('profile');
        this.profileModal?.openPublicProfile(rp.uid, null, rp.displayName);
      },
      onSendFriendRequest: (rp) => {
        void friendsSystem.sendFriendRequest(rp.uid, rp.username).then((res) => {
          this.hud?.showToast(res.message);
        });
      },
      onInviteRemoteToProperty: (rp) => this.inviteRemoteToFirstOwnedProperty(rp),
      onOpenInventory: () => this.toggleInventory(),
      onExitBuilding: () => this.exitToCity(),
      onOpenSettings: () => {
        this.pauseGame(false);
        this.settingsModal?.open();
      },
      onPause: () => this.pauseGame(true),
      onTriggerInteract: () => this.handleInteractAction(),
      onWakeUp: () => this.wakeUpFromBed(),
      onNpcChatMore: (npcObjId, step) => {
        const rawId = npcObjId.replace(/^int_/, '');
        const npc = this.npcs.find((n) => n.config.id === rawId);
        return npc ? npc.getNextChatLine(step) : null;
      },
    });

    this.hud.setPlayerInfo(save.appearanceId, save.playerName);
    this.hud.setDistrictName(layout.title);
    this.syncClockDisplay();
    this.syncTouchVisibility();

    // Load property deed if entering a player-owned residence
    if (this.activeDeedId) {
      void this.loadAndApplyPropertyDeed(this.activeDeedId);
    }

    // Multiplayer indoor sync ONLY when in Multiplayer mode
    if (isMp) {
      this.unsubMpPlayers = multiplayerClient.onPlayersChange((players) => {
        if (!this.sys?.isActive()) return;
        this.syncRemotePlayers(players);
      });
      this.unsubMpEmote = multiplayerClient.onEmote((evt) => {
        if (!this.sys?.isActive()) return;
        if (evt.uid === authSystem.getCurrentUser()?.uid) {
          this.player?.showEmoteBubble(evt.emoteId);
        } else {
          this.remotePlayersMap.get(evt.uid)?.triggerEmote(evt.emoteId);
        }
      });
      this.unsubMpNotice = multiplayerClient.onNotice((msg) => {
        if (!this.sys?.isActive()) return;
        this.hud?.showToast(msg, 3600);
      });
      this.unsubMpPropUpdate = multiplayerClient.onPropertyUpdated((deedId) => {
        if (!this.sys?.isActive()) return;
        if (deedId === this.activeDeedId && this.readOnlyVisitor) {
          void this.loadAndApplyPropertyDeed(deedId);
          this.hud?.showToast('Homeowner updated room decor!');
        }
      });
      this.unsubMpStatus = multiplayerClient.onStatusChange(() => {
        if (!this.sys?.isActive()) return;
        this.player?.refreshOwnerBadge();
      });
      this.unsubMpRoomClosed = multiplayerClient.onRoomClosed((evt) => {
        if (!this.sys?.isActive() || this.returningToMenu) return;
        this.hud?.showToast(evt.message || 'Server was closed by the host.', 3500);
        this.returnToMainMenu(true);
      });

      this.syncRemotePlayers(multiplayerClient.getRemotePlayers());
    } else {
      multiplayerClient.disconnect(true);
    }

    window.addEventListener('resize', this.onResizeBound);
    this.unsubFullscreen = onFullscreenChange(() => {
      if (this.fsResizeTimer !== null) {
        window.clearTimeout(this.fsResizeTimer);
      }
      this.fsResizeTimer = window.setTimeout(this.onResizeBound, 60);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);

    this.cameras.main.fadeIn(180, 4, 8, 18);
  }

  public update(_time: number, delta: number): void {
    if (!this.player || !this.keyboard || !this.touchController || !this.layout) return;
    if (this.exiting) return;

    const dtMs = Math.min(delta, 50);
    const dtSec = dtMs / 1000;
    if (this.entryGraceSec > 0) {
      this.entryGraceSec = Math.max(0, this.entryGraceSec - dtSec);
    }

    const keyInput = this.keyboard.consumeSnapshot();
    const touchInput = this.touchController.getState();

    if (keyInput.pauseJustPressed) {
      if (this.cutsceneOverlay?.isOpen()) {
        this.cutsceneOverlay.close();
        return;
      }
      if (this.miniGamesModal?.isOpen()) {
        this.miniGamesModal.close();
        return;
      }
      if (this.missionManModal?.isOpen()) {
        this.missionManModal.close();
        return;
      }
      if (this.friendsModal?.isOpen()) {
        this.friendsModal.close();
        return;
      }
      if (this.socialModal?.isOpen()) {
        this.socialModal.close();
        return;
      }
      if (this.propertyModal?.isOpen()) {
        this.propertyModal.close();
        return;
      }
      if (this.profileModal?.isOpen()) {
        this.profileModal.close();
        return;
      }
      if (this.journalModal?.isOpen()) {
        this.journalModal.close();
        return;
      }
      if (this.settingsModal?.isOpen()) {
        this.settingsModal.close();
        if (!this.pauseMenu?.isOpen()) this.resumeGame();
        return;
      }
      if (this.shopModal?.isOpen()) {
        this.shopModal.close();
        return;
      }
      if (this.inventoryModal?.isOpen()) {
        this.inventoryModal.close();
        return;
      }
      if (this.arcadeModal?.isOpen()) {
        this.arcadeModal.close();
        return;
      }
      if (this.cinemaModal?.isOpen()) {
        this.cinemaModal.close();
        return;
      }
      if (this.activityModal?.isOpen()) {
        this.activityModal.close();
        return;
      }
      if (this.tvModal?.isOpen()) {
        this.tvModal.close();
        return;
      }
      if (this.phoneModal?.isOpen()) {
        this.phoneModal.close();
        return;
      }
      if (this.garageModal?.isOpen()) {
        this.garageModal.close();
        return;
      }
      if (this.computerModal?.isOpen()) {
        this.computerModal.close();
        return;
      }
      if (this.hud?.isInteractionPanelOpen()) {
        this.hud.closeInteractionPanel();
        return;
      }
      if (this.isPaused) {
        this.resumeGame();
      } else {
        this.pauseGame(true);
      }
      return;
    }

    if (keyInput.journalJustPressed && !this.isPaused && !this.settingsModal?.isOpen()) {
      this.toggleJournal('missions');
      return;
    }

    if (keyInput.phoneJustPressed && !this.isPaused && !this.settingsModal?.isOpen()) {
      this.togglePhone();
      return;
    }

    if (keyInput.inventoryJustPressed && !this.isPaused && !this.settingsModal?.isOpen()) {
      this.toggleInventory();
      return;
    }

    const uiBlocking = this.isPaused || this.isAnyModalOpen();

    cityClockSystem.update(dtSec, uiBlocking);
    this.clockUiTimerSec += dtSec;
    if (this.clockUiTimerSec >= 0.5) {
      this.clockUiTimerSec = 0;
      this.syncClockDisplay();
    }

    if (uiBlocking) {
      this.player.stopImmediately();
      for (const npc of this.npcs) {
        npc.update(dtMs, true);
      }
      return;
    }

    if (keyInput.emoteJustPressed) {
      this.triggerQuickEmote('wave');
    }

    if (this.player.getIsSleeping()) {
      for (const npc of this.npcs) {
        npc.update(dtMs, false);
      }
      for (const rp of this.remotePlayersMap.values()) {
        rp.update(dtSec);
      }
      this.hud?.setInteractionTarget(null);
      this.hud?.setSleepingState(true);
      this.touchController.setInteractAvailable(true);
      if (keyInput.interactJustPressed) {
        this.wakeUpFromBed();
      }
      return;
    }

    const mergedMoveX = Math.abs(touchInput.moveX) > 0.01 ? touchInput.moveX : keyInput.moveX;
    const mergedMoveY = Math.abs(touchInput.moveY) > 0.01 ? touchInput.moveY : keyInput.moveY;
    const mergedRunning = keyInput.isRunning || touchInput.isRunning;

    this.player.update(dtSec, {
      moveX: mergedMoveX,
      moveY: mergedMoveY,
      isRunning: mergedRunning,
      interactJustPressed: keyInput.interactJustPressed,
      mapJustPressed: false,
      pauseJustPressed: false,
    });

    for (const npc of this.npcs) {
      npc.update(dtMs, false);
    }
    if (gameSessionManager.isMultiplayer()) {
      for (const rp of this.remotePlayersMap.values()) {
        rp.update(dtSec);
      }
    }

    const st = this.player.getEntityState();
    const target = this.interactionSystem?.update(dtSec, st.x, st.y) ?? null;
    this.hud?.setInteractionTarget(target);
    this.hud?.setSittingState(this.player.getIsSitting());
    this.hud?.setSleepingState(false);
    this.touchController.setInteractAvailable(Boolean(target) || this.player.getIsSitting());

    if (gameSessionManager.isMultiplayer()) {
      const pBody = this.player.sprite.body as Phaser.Physics.Arcade.Body | undefined;
      multiplayerClient.sendMove({
        x: st.x,
        y: st.y,
        vx: pBody?.velocity.x ?? 0,
        vy: pBody?.velocity.y ?? 0,
        dir: st.direction,
        anim: st.animState,
        interiorId: this.buildingId,
        propertyDeedId: this.activeDeedId,
        vehicle: null,
      });
    }

    // Automatic walk-over exit mat detection after brief entry grace period
    if (
      this.entryGraceSec <= 0 &&
      !this.player.getIsSitting() &&
      mergedMoveY > 0.15 &&
      Math.abs(st.x - this.layout.exitPoint.x) <= 34 &&
      st.y >= (this.layout.rows - 1) * TILE_SIZE - 4
    ) {
      this.exitToCity();
      return;
    }

    if (keyInput.interactJustPressed) {
      this.handleInteractAction();
    }
  }

  private handleInteractAction(): void {
    if (!this.player || !this.hud || !this.interactionSystem) return;
    if (
      this.isPaused ||
      this.cutsceneOverlay?.isOpen() ||
      this.missionManModal?.isOpen() ||
      this.friendsModal?.isOpen() ||
      this.miniGamesModal?.isOpen() ||
      this.socialModal?.isOpen() ||
      this.propertyModal?.isOpen() ||
      this.profileModal?.isOpen() ||
      this.journalModal?.isOpen() ||
      this.settingsModal?.isOpen() ||
      this.shopModal?.isOpen() ||
      this.inventoryModal?.isOpen() ||
      this.arcadeModal?.isOpen() ||
      this.cinemaModal?.isOpen() ||
      this.activityModal?.isOpen() ||
      this.tvModal?.isOpen() ||
      this.garageModal?.isOpen() ||
      this.phoneModal?.isOpen() ||
      this.computerModal?.isOpen()
    ) {
      return;
    }

    if (this.hud.isInteractionPanelOpen()) {
      this.hud.closeInteractionPanel();
      return;
    }

    if (this.player.getIsSleeping()) {
      this.wakeUpFromBed();
      return;
    }

    if (this.player.getIsSitting()) {
      audioSystem.playButtonClick();
      this.player.standUp();
      this.hud.setSittingState(false);
      return;
    }

    const target = this.interactionSystem.getActiveTarget();
    if (!target) return;

    if (target.kind === 'exit_door') {
      this.exitToCity();
      return;
    }

    if (target.kind === 'interior_door' && target.doorId) {
      this.toggleInteriorDoor(target.doorId, target.id);
      return;
    }

    if (target.kind === 'interior_bed') {
      const seatX = target.seatX ?? target.x;
      const seatY = target.seatY ?? target.y;
      this.player.sleepAt(seatX, seatY);
      audioSystem.playSleepChime();
      economySystem.restoreFullEnergy();
      saveSystem.save(saveSystem.getState(), true);
      this.hud.setSleepingState(true);
      this.interactionSystem.startCooldown(target.id, 450);
      this.cutsceneOverlay?.openSleepCutscene(() => {
        this.wakeUpFromBed();
        this.hud?.showToast('Good morning! Energy restored to 100/100 and saved.');
      });
      return;
    }

    audioSystem.playInteract();

    if (target.kind === 'bench' && target.seatX !== undefined && target.seatY !== undefined) {
      this.player.sitAt(target.seatX, target.seatY);
      this.hud.setSittingState(true);
      return;
    }

    if (target.kind === 'interior_tv') {
      this.tvPowerOn = true;
      this.tvSprite?.setFrame('1');
      this.tvModal?.open(target.title, target.subtitle, this.tvPowerOn);
      return;
    }

    if (target.kind === 'interior_computer') {
      this.player.playActionAnimation('interact');
      this.computerModal?.open(target.title, target.subtitle);
      return;
    }

    if (target.kind === 'interior_shop' && target.shopDomain) {
      this.player.playActionAnimation('shop');
      this.shopModal?.openShop(target.shopDomain, target.title, target.subtitle, target.initialTab);
      return;
    }

    if (target.kind === 'interior_wardrobe') {
      this.player.playActionAnimation('interact');
      this.inventoryModal?.open('wardrobe');
      return;
    }

    if (target.kind === 'interior_salon') {
      this.player.playActionAnimation('interact');
      this.shopModal?.openSalon(target.title, target.subtitle);
      return;
    }

    if (target.kind === 'interior_bank') {
      this.player.playActionAnimation('interact');
      this.shopModal?.openBank(target.title, target.subtitle);
      return;
    }

    if (target.kind === 'interior_garage') {
      this.player.playActionAnimation('interact');
      this.garageModal?.open(target.garageTab ?? 'customize');
      return;
    }

    if (target.kind === 'interior_arcade' && target.arcadeGameId) {
      this.arcadeModal?.open(target.arcadeGameId);
      return;
    }

    if (target.kind === 'interior_cinema_ticket') {
      if (economySystem.isCinemaUnlocked()) {
        this.hud.showToast('Your Starlight Cinema Ticket is active! Walk straight into Screening Room 1.');
      } else {
        this.shopModal?.openShop('cinema_concessions', 'Starlight Box Office', 'Buy a Cinema Ticket (25c)');
      }
      return;
    }

    if (target.kind === 'interior_cinema_screen') {
      if (!economySystem.isCinemaUnlocked()) {
        this.hud.showToast('Purchase a Cinema Ticket (25c) at the Box Office first!');
      } else {
        this.cinemaModal?.open();
      }
      return;
    }

    if (target.kind === 'interior_gym_workout') {
      this.activityModal?.openGymWorkout(target.title, target.subtitle);
      return;
    }

    if (target.kind === 'interior_library_trivia') {
      this.activityModal?.openLibraryTrivia(target.title, target.subtitle);
      return;
    }

    if (target.kind === 'interior_office_task') {
      this.activityModal?.openOfficeShift(target.title, target.subtitle);
      return;
    }

    if (target.kind === 'interior_clinic_checkup') {
      this.player.playActionAnimation('interact');
      this.activityModal?.openInfoAction(target.title, target.subtitle, target.description, 'clinic_checkup');
      return;
    }

    if (target.kind === 'interior_kitchen') {
      this.player.playActionAnimation('interact');
      this.activityModal?.openInfoAction(target.title, target.subtitle, target.description, 'kitchen');
      return;
    }

    if (target.kind === 'interior_pet_play') {
      this.player.playActionAnimation('interact');
      this.spawnHeartEffect(target.x, target.y - 12);
      this.activityModal?.openInfoAction(
        target.title,
        target.subtitle,
        target.description,
        'pet_play',
        target.petSpecies,
      );
      return;
    }

    if (target.infoKey === 'gazette_archives') {
      this.player.playActionAnimation('interact');
      this.activityModal?.openGazetteArchives(target.title, target.subtitle);
      return;
    }

    if (target.kind === 'interior_info') {
      this.player.playActionAnimation('interact');
      this.activityModal?.openInfoAction(target.title, target.subtitle, target.description, 'info');
      return;
    }

    if (target.kind === 'interior_casino_lounge') {
      this.player.playActionAnimation('interact');
      const mode = target.infoKey === 'lucky_wheel' ? 'lucky_wheel' : 'coin_flip';
      this.activityModal?.openLuckyLoungeModal(mode);
      return;
    }

    if (target.kind === 'interior_repair') {
      this.player.playActionAnimation('interact');
      this.activityModal?.openRepairBayModal();
      return;
    }

    if (target.kind === 'interior_hospital_heal') {
      this.player.playActionAnimation('interact');
      this.activityModal?.openHospitalHealModal();
      return;
    }

    if (target.kind === 'interior_police_term') {
      this.player.playActionAnimation('interact');
      this.activityModal?.openPoliceTerminalModal(wantedState.getStars(), () => {
        wantedState.clearWanted('Police Precinct Terminal');
        this.hud?.showToast('Wanted status cleared at CCPD Precinct Terminal!');
      });
      return;
    }

    if (target.kind === 'interior_fire_drill') {
      this.player.playActionAnimation('interact');
      this.activityModal?.openFireDrillModal();
      return;
    }

    if (target.kind === 'interior_music_synth') {
      this.player.playActionAnimation('interact');
      this.activityModal?.openMusicSynthModal();
      return;
    }

    if (target.kind === 'interior_train_transit') {
      this.player.playActionAnimation('interact');
      this.activityModal?.openBusTransitModal(undefined, (stop) => {
        if (!this.launchData) return;
        this.launchData.returnPos = {
          x: stop.x,
          y: stop.y,
          direction: 'down',
        };
        this.exitToCity();
      });
      return;
    }

    if (target.kind === 'interior_mission_man') {
      economySystem.recordNpcMet('npc_mission_man');
      this.player.playActionAnimation('interact');
      this.closeAllModals();
      this.missionManModal?.openMissionMan(
        saveSystem.getState().playerName,
        () => {
          this.refreshMissionManMarker();
        },
        (choiceLabel) => {
          this.closeAllModals();
          this.cutsceneOverlay?.openKaiEndingCutscene(
            saveSystem.getState().playerName,
            choiceLabel,
            () => {
              economySystem.markStoryTeaserViewed();
              void cloudSaveManager.flushNow(true);
              this.refreshMissionManMarker();
              this.hud?.showToast('KAI — THE LEAD GANG LEADER! Story Campaign Complete!', 5000);
            },
          );
        },
      );
      return;
    }

    if (target.kind === 'interior_mission_board') {
      this.player.playActionAnimation('interact');
      this.closeAllModals();
      this.missionManModal?.openMissionBoard();
      return;
    }

    if (target.kind === 'npc') {
      const rawId = target.id.replace(/^int_/, '');
      const npc = this.npcs.find((n) => n.config.id === rawId);
      if (npc) {
        economySystem.recordNpcMet(npc.config.id);
        this.player.playActionAnimation('interact');
        this.hud.openInteractionPanel({
          ...target,
          description: npc.getNextChatLine(0),
          actionLabel: 'Chat More',
        });
        return;
      }
    }

    this.player.playActionAnimation('interact');
    this.hud.openInteractionPanel(target);
  }

  private refreshMissionManMarker(): void {
    if (!this.missionManMarker) return;
    const snap = economySystem.getStoryCampaignSnapshot();
    if (!snap.mission) {
      this.missionManMarker.setText('♛');
      this.missionManMarker.setColor('#fde047');
    } else if (!snap.accepted || snap.complete) {
      this.missionManMarker.setText('!');
      this.missionManMarker.setColor('#fde047');
    } else {
      this.missionManMarker.setText('?');
      this.missionManMarker.setColor('#38bdf8');
    }
  }

  private wakeUpFromBed(): void {
    if (!this.player?.getIsSleeping()) return;
    this.player.wakeUp();
    audioSystem.playWakeChime();
    this.hud?.setSleepingState(false);
    this.interactionSystem?.startCooldown('home_bed', 500);
  }

  private spawnHeartEffect(x: number, y: number): void {
    for (let i = 0; i < 4; i++) {
      const heart = this.add
        .image(x + (i - 1.5) * 9, y, 'fx_heart')
        .setDepth(9000);
      this.tweens.add({
        targets: heart,
        y: y - 26 - i * 4,
        alpha: 0,
        duration: 620,
        delay: i * 80,
        ease: 'Sine.easeOut',
        onComplete: () => heart.destroy(),
      });
    }
  }

  private toggleInteriorDoor(doorId: string, objectId: string): void {
    const doorObj = this.gateObjects.find((g) => g.gateId === doorId);
    if (!doorObj) return;
    audioSystem.playDoor();
    const nextOpen = !doorObj.isOpen;
    doorObj.isOpen = nextOpen;
    doorObj.sprite?.setFrame(nextOpen ? '1' : '0');

    if (nextOpen) {
      if (doorObj.zone) {
        this.collisionSystem?.removeStaticZone(doorObj.zone);
        doorObj.zone = undefined;
      }
    } else if (doorObj.bounds && !doorObj.zone) {
      doorObj.zone = this.collisionSystem?.addStaticRect(
        doorObj.bounds.centerX,
        doorObj.bounds.centerY,
        doorObj.bounds.width,
        doorObj.bounds.height,
      );
    }
    this.interactionSystem?.startCooldown(objectId, 380);
  }

  private unlockCinemaGate(): void {
    for (const g of this.gateObjects) {
      if (g.gateId === 'cinema_gate') {
        g.sprite?.destroy();
        if (g.zone) {
          this.collisionSystem?.removeStaticZone(g.zone);
        }
      }
    }
    this.gateObjects = this.gateObjects.filter((g) => g.gateId !== 'cinema_gate');
    this.hud?.showToast('Ticket verified! Velvet rope lifted — enjoy Screening Room 1.');
  }

  private syncClockDisplay(): void {
    const badge = cityClockSystem.getPhaseBadge();
    this.hud?.setClockDisplay(`${badge.icon} ${cityClockSystem.getFormattedTime()}`);
  }

  private notifyProgression(summary: ProgressionAwardSummary): void {
    const parts: string[] = [];
    if (summary.leveledUpTo) parts.push(`LEVEL UP -> Citizen Lv.${summary.leveledUpTo}!`);
    if (summary.unlockedVehicles.length > 0) parts.push(`Unlocked Vehicle: ${summary.unlockedVehicles.join(', ')}`);
    if (summary.unlockedItems.length > 0) parts.push(`Unlocked Item: ${summary.unlockedItems.join(', ')}`);
    if (summary.unlockedTitles.length > 0) parts.push(`New Title: "${summary.unlockedTitles.join(', ')}"`);
    if (parts.length > 0) {
      this.player?.playActionAnimation('celebrate');
      this.hud?.showToast(parts.join(' · '), 4500);
    }
  }

  private buildRoomContents(layout: InteriorLayout): void {
    if (!this.collisionSystem) return;
    this.collisionSystem.clearStaticRects();

    for (const obj of this.propSprites) {
      obj.destroy();
    }
    this.propSprites = [];
    this.gateObjects = [];
    this.exitDoorSprite = null;
    this.tvSprite = null;
    this.selectionRing?.destroy();
    this.selectionRing = null;
    this.tileLayer?.destroy();
    this.tileLayer = null;
    this.tilemap?.destroy();
    this.tilemap = null;

    this.tilemap = this.make.tilemap({
      data: layout.tiles,
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    const tileset = this.tilemap.addTilesetImage('interior_tileset');
    if (tileset) {
      this.tileLayer = this.tilemap.createLayer(0, tileset, 0, 0);
      this.tileLayer?.setDepth(0);
    }

    const cinemaUnlocked = economySystem.isCinemaUnlocked();

    for (const wRect of layout.wallRects) {
      if (wRect.gateId === 'cinema_gate' && cinemaUnlocked) {
        continue;
      }
      const zone = this.collisionSystem.addStaticRect(
        wRect.centerX,
        wRect.centerY,
        wRect.width,
        wRect.height,
      );
      if (wRect.gateId) {
        this.gateObjects.push({gateId: wRect.gateId, zone});
      }
    }

    for (const prop of layout.props) {
      if (prop.gateId === 'cinema_gate' && cinemaUnlocked) {
        continue;
      }
      const initialFrame =
        prop.texture === 'int_tv' || prop.texture === 'int_door_room' ? '0' : undefined;
      const sprite = this.add.image(prop.x, prop.y, prop.texture, initialFrame).setOrigin(0.5, 0.5);
      if (prop.rotationDeg) {
        sprite.setAngle(prop.rotationDeg);
      }
      if (prop.texture === 'int_exit_mat') {
        sprite.setDepth(2);
      } else {
        sprite.setDepth(prop.y + (prop.depthOffsetY ?? sprite.height * 0.28));
      }
      if (prop.texture === 'int_tv') {
        this.tvSprite = sprite;
      }

      if (prop.deedFurnitureUid && !this.readOnlyVisitor) {
        sprite.setInteractive({useHandCursor: true});
        sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if (
            !this.sys?.isActive() ||
            this.exiting ||
            this.isPaused ||
            this.returningToMenu ||
            this.isAnyModalOpen() ||
            !this.decorateMode ||
            !this.activeDeed ||
            this.pendingCatalogItem
          ) {
            return;
          }
          pointer.event.stopPropagation();
          this.selectedFurnitureUid = prop.deedFurnitureUid ?? null;
          this.updateSelectionRing(sprite);
          const item =
            this.activeDeed.furniture.find((f) => f.uid === this.selectedFurnitureUid) ?? null;
          this.decorateToolbar?.updateState(this.activeDeed, item);
        });
        if (prop.deedFurnitureUid === this.selectedFurnitureUid) {
          this.updateSelectionRing(sprite);
        }
      }

      this.propSprites.push(sprite);

      let gateZone: Phaser.GameObjects.Zone | undefined;
      let gateBounds: {centerX: number; centerY: number; width: number; height: number} | undefined;
      if (prop.solid && prop.colliderW && prop.colliderH) {
        gateBounds = {
          centerX: prop.x,
          centerY: prop.y + (prop.colliderOffsetY ?? 0),
          width: prop.colliderW,
          height: prop.colliderH,
        };
        gateZone = this.collisionSystem.addStaticRect(
          gateBounds.centerX,
          gateBounds.centerY,
          gateBounds.width,
          gateBounds.height,
        );
      }
      if (prop.gateId) {
        this.gateObjects.push({
          gateId: prop.gateId,
          sprite,
          zone: gateZone,
          isOpen: false,
          bounds: gateBounds,
        });
      }
    }

    // Animated Exit Door frame at south mat
    this.exitDoorSprite = this.add
      .image(layout.exitPoint.x, (layout.rows - 1) * TILE_SIZE - 12, 'int_door_wood', '0')
      .setOrigin(0.5, 0.5)
      .setDepth(4);
    this.propSprites.push(this.exitDoorSprite);

    for (const lbl of layout.roomLabels) {
      const t = this.add
        .text(lbl.x, lbl.y, lbl.text, {
          fontFamily: 'Outfit, sans-serif',
          fontSize: '10px',
          fontStyle: 'bold',
          color: '#e2e8f0',
          backgroundColor: 'rgba(6, 11, 22, 0.72)',
          padding: {x: 5, y: 2},
        })
        .setOrigin(0.5, 0.5)
        .setDepth(4);
      this.propSprites.push(t);
    }

    const exitInteractive: InteractiveObjectData = {
      id: 'int_exit_door',
      kind: 'exit_door',
      title: 'Exit Building',
      subtitle: layout.title,
      description: 'Return outside to CHAOS CITY.',
      promptLabel: 'Exit to CHAOS CITY',
      x: layout.exitPoint.x,
      y: layout.exitPoint.y - 10,
      radius: 48,
    };

    this.interactionSystem?.destroy();
    this.interactionSystem = new InteractionSystem(
      this,
      [exitInteractive, ...layout.interactives],
      this.npcs,
    );
  }

  private updateSelectionRing(target: Phaser.GameObjects.Image): void {
    this.selectionRing?.destroy();
    this.selectionRing = this.add
      .rectangle(target.x, target.y, target.displayWidth + 8, target.displayHeight + 8)
      .setStrokeStyle(2, 0xfbbf24, 0.95)
      .setFillStyle(0xfbbf24, 0.12)
      .setDepth(9990);
  }

  private async loadAndApplyPropertyDeed(deedId: string): Promise<void> {
    const deed = await propertySystem.loadDeed(deedId, true);
    if (!deed || !this.sys?.isActive() || this.exiting || this.returningToMenu) return;
    this.activeDeed = deed;
    if (!this.activePropDef) {
      this.activePropDef = getPropertyById(deed.propertyId) ?? null;
    }
    this.rebuildPropertyRoom();
    if (!this.readOnlyVisitor && this.activePropDef) {
      this.decorateToolbar?.show(this.activePropDef, deed);
    } else {
      this.decorateToolbar?.hide();
    }
  }

  private rebuildPropertyRoom(): void {
    if (!this.activeDeed) return;
    const layout = createInteriorLayout(this.buildingId, this.buildingLabel, this.activeDeed);
    this.layout = layout;
    this.buildRoomContents(layout);
    this.hud?.setDistrictName(layout.title);
    const sel =
      this.activeDeed.furniture.find((f) => f.uid === this.selectedFurnitureUid) ?? null;
    this.decorateToolbar?.updateState(this.activeDeed, sel);
  }

  private syncRemotePlayers(players: RemotePlayerState[]): void {
    const insideSameRoom = new Set<string>();
    const settings = saveSystem.getState().settings;
    const shadowsOn = settings.shadowsEnabled && !settings.performanceMode;

    for (const p of players) {
      if (
        p.interiorId !== this.buildingId ||
        (p.propertyDeedId ?? null) !== (this.activeDeedId ?? null)
      ) {
        continue;
      }
      insideSameRoom.add(p.uid);
      const existing = this.remotePlayersMap.get(p.uid);
      if (existing) {
        existing.applyState(p, false);
        existing.setShadowVisible(shadowsOn);
      } else {
        const rp = new RemotePlayer(this, p, (uid) => {
          if (!saveSystem.getState().settings.mouseInteractEnabled) return;
          const live = this.remotePlayersMap.get(uid)?.state;
          if (live) this.hud?.openRemotePlayerMenu(live);
        });
        rp.setShadowVisible(shadowsOn);
        this.remotePlayersMap.set(p.uid, rp);
      }
    }

    for (const [uid, rp] of this.remotePlayersMap.entries()) {
      if (!insideSameRoom.has(uid)) {
        rp.destroy();
        this.remotePlayersMap.delete(uid);
      }
    }
  }

  private triggerQuickEmote(emoteId: EmoteId): void {
    this.player?.showEmoteBubble(emoteId);
    if (multiplayerClient.getStatus().status === 'connected') {
      multiplayerClient.sendEmote(emoteId);
    }
  }

  private async acceptPropertyInvite(deedId: string): Promise<void> {
    if (this.acceptingPropertyInvite || this.exiting || this.returningToMenu) return;
    this.acceptingPropertyInvite = true;
    try {
      const deed = await propertySystem.loadDeed(deedId, true);
      if (!this.sys?.isActive() || this.exiting || this.returningToMenu) return;
      if (!deed || !this.launchData) {
        this.hud?.showToast('Unable to access invited residence right now.', 3200);
        return;
      }
      const prop = getPropertyById(deed.propertyId);
      if (!prop) return;
      const selfUid = authSystem.getCurrentUser()?.uid;
      this.exiting = true;
      this.closeAllModals();
      this.scene.start(SCENE_KEYS.INTERIOR, {
        buildingId: prop.buildingId,
        returnPos: this.launchData.returnPos,
        propertyDeedId: deed.deedId,
        propertyOwnerUid: deed.ownerUid,
        readOnlyVisitor: deed.ownerUid !== selfUid,
      });
    } finally {
      this.acceptingPropertyInvite = false;
    }
  }

  private inviteRemoteToFirstOwnedProperty(rp: RemotePlayerState): void {
    const owned = propertySystem.getOwnedPropertyDefs();
    if (owned.length === 0) {
      this.hud?.showToast('Purchase a residential property first to send home invites!');
      return;
    }
    const prop = owned[0];
    const selfUid = authSystem.getCurrentUser()?.uid;
    if (!selfUid) {
      this.hud?.showToast('Sign in to send multiplayer property invites.');
      return;
    }
    const deedId = propertySystem.makeDeedId(selfUid, prop.id);
    void propertySystem.invitePlayerToProperty(prop.id, rp.uid);
    multiplayerClient.sendPropertyInvite(rp.uid, deedId, prop.name);
    this.hud?.showToast(`Invited ${rp.displayName} to ${prop.name}!`);
  }

  private closeAllModals(
    except?:
      | 'journal'
      | 'minigames'
      | 'phone'
      | 'inventory'
      | 'shop'
      | 'tv'
      | 'computer'
      | 'garage'
      | 'cinema'
      | 'activity'
      | 'arcade'
      | 'social'
      | 'friends'
      | 'missionman'
      | 'property'
      | 'profile',
  ): void {
    if (except !== 'journal') this.journalModal?.close();
    if (except !== 'minigames') this.miniGamesModal?.close();
    if (except !== 'phone') this.phoneModal?.close();
    if (except !== 'inventory') this.inventoryModal?.close();
    if (except !== 'shop') this.shopModal?.close();
    if (except !== 'tv') this.tvModal?.close();
    if (except !== 'computer') this.computerModal?.close();
    if (except !== 'garage') this.garageModal?.close();
    if (except !== 'cinema') this.cinemaModal?.close();
    if (except !== 'activity') this.activityModal?.close();
    if (except !== 'arcade') this.arcadeModal?.close();
    if (except !== 'social') this.socialModal?.close();
    if (except !== 'friends') this.friendsModal?.close();
    if (except !== 'missionman') this.missionManModal?.close();
    if (except !== 'property') this.propertyModal?.close();
    if (except !== 'profile') this.profileModal?.close();
    this.cutsceneOverlay?.close();
    this.hud?.closeInteractionPanel();
    this.keyboard?.clearQueuedActions();
  }

  private isAnyModalOpen(): boolean {
    return Boolean(
      this.cutsceneOverlay?.isOpen() ||
        this.missionManModal?.isOpen() ||
        this.friendsModal?.isOpen() ||
        this.miniGamesModal?.isOpen() ||
        this.socialModal?.isOpen() ||
        this.propertyModal?.isOpen() ||
        this.profileModal?.isOpen() ||
        this.journalModal?.isOpen() ||
        this.settingsModal?.isOpen() ||
        this.shopModal?.isOpen() ||
        this.inventoryModal?.isOpen() ||
        this.arcadeModal?.isOpen() ||
        this.cinemaModal?.isOpen() ||
        this.activityModal?.isOpen() ||
        this.tvModal?.isOpen() ||
        this.garageModal?.isOpen() ||
        this.phoneModal?.isOpen() ||
        this.computerModal?.isOpen() ||
        this.hud?.isInteractionPanelOpen(),
    );
  }

  private toggleSocial(tab: SocialTab = 'servers'): void {
    if (!this.socialModal || !gameSessionManager.isMultiplayer()) return;
    if (this.socialModal.isOpen()) {
      this.socialModal.close();
    } else {
      this.closeAllModals('social');
      this.socialModal.open(tab);
    }
  }

  private openFriendsModal(): void {
    if (!this.friendsModal) return;
    if (this.friendsModal.isOpen()) {
      this.friendsModal.close();
    } else {
      this.closeAllModals('friends');
      this.friendsModal.open('list');
    }
  }

  private async closeHostedServerRoom(): Promise<void> {
    if (!gameSessionManager.isMultiplayer()) return;
    const res = await multiplayerClient.closeHostedServer();
    if (!res.ok) {
      this.hud?.showToast(res.error ?? 'Only the room host can close this server.');
      return;
    }
    this.hud?.showToast('Hosted server closed cleanly.');
    this.returnToMainMenu(true);
  }

  private async acceptLiveServerInvite(
    inv: ServerInviteItem,
    password?: string,
  ): Promise<{ok: boolean; requiresPassword?: boolean; error?: string}> {
    const res = await multiplayerClient.respondToServerInvite(inv.inviteId, 'accept', password);
    if (!res.ok || !res.server) {
      return {ok: false, requiresPassword: res.requiresPassword, error: res.error};
    }
    const joinPayload = {
      roomId: res.server.id,
      roomName: res.server.name,
      roomCode: res.server.roomCode,
      visibility: res.server.visibility,
      password,
    };
    gameSessionManager.enterMultiplayerMode(joinPayload);
    multiplayerClient.disconnect(true);
    for (const rp of this.remotePlayersMap.values()) rp.destroy();
    this.remotePlayersMap.clear();
    const st = this.player?.getEntityState();
    await multiplayerClient.connect(
      joinPayload.roomId,
      {
        x: st?.x ?? this.layout?.spawnPoint.x ?? 160,
        y: st?.y ?? this.layout?.spawnPoint.y ?? 160,
        interiorId: this.buildingId,
        propertyDeedId: this.activeDeedId,
      },
      {password: joinPayload.password, roomCode: joinPayload.roomCode},
    );
    this.hud?.showToast(`Joined ${res.server.name} [${res.server.roomCode}]!`);
    return {ok: true};
  }

  private openProperties(): void {
    if (!this.propertyModal) return;
    if (this.propertyModal.isOpen()) {
      this.propertyModal.close();
    } else {
      this.closeAllModals('property');
      this.propertyModal.open(undefined, 'catalog');
    }
  }

  private openSelfProfile(): void {
    if (!this.profileModal) return;
    if (this.profileModal.isOpen()) {
      this.profileModal.close();
    } else {
      this.closeAllModals('profile');
      this.profileModal.openSelf();
    }
  }

  private toggleJournal(tab: JournalTab = 'missions'): void {
    if (!this.journalModal) return;
    if (this.journalModal.isOpen()) {
      this.journalModal.close();
    } else {
      this.closeAllModals('journal');
      this.journalModal.open(tab);
    }
  }

  private openMiniGamesHub(): void {
    if (!this.miniGamesModal) return;
    this.closeAllModals('minigames');
    this.miniGamesModal.openHub();
  }

  private togglePhone(): void {
    if (!this.phoneModal) return;
    if (this.phoneModal.isOpen()) {
      this.phoneModal.close();
    } else {
      this.closeAllModals('phone');
      this.phoneModal.open('home');
    }
  }

  private toggleInventory(): void {
    if (!this.inventoryModal) return;
    if (this.inventoryModal.isOpen()) {
      this.inventoryModal.close();
    } else {
      this.closeAllModals('inventory');
      this.inventoryModal.open('items');
    }
  }

  private exitToCity(): void {
    if (this.exiting || this.returningToMenu || !this.launchData) return;
    this.exiting = true;
    this.closeAllModals();
    audioSystem.playDoor();
    this.exitDoorSprite?.setFrame('1');
    const returnPos = this.launchData.returnPos;
    saveSystem.updatePosition(returnPos);
    void cloudSaveManager.flushNow(true);
    this.exitTimer = this.time.delayedCall(120, () => {
      this.exitTimer = null;
      if (!this.sys?.isActive() || this.returningToMenu) return;
      this.scene.start(SCENE_KEYS.CITY, {spawnOverride: returnPos});
    });
  }

  private pauseGame(showPauseMenu: boolean): void {
    if (this.isPaused && !showPauseMenu) return;
    this.isPaused = true;
    this.physics.pause();
    this.keyboard?.clearHeldKeys();
    this.touchController?.reset();
    if (showPauseMenu) {
      this.pauseMenu?.open();
    }
  }

  private resumeGame(): void {
    this.isPaused = false;
    this.pauseMenu?.close();
    this.settingsModal?.close();
    this.physics.resume();
    this.keyboard?.clearHeldKeys();
    this.keyboard?.clearQueuedActions();
  }

  private returnToMainMenu(openHub = gameSessionManager.isMultiplayer()): void {
    if (this.returningToMenu || this.exiting) return;
    this.returningToMenu = true;
    this.closeAllModals();
    if (this.launchData?.returnPos) {
      saveSystem.updatePosition(this.launchData.returnPos);
    }
    void cloudSaveManager.flushNow(true);
    gameSessionManager.leaveToMenu(openHub);
    this.physics.resume();
    this.scene.start(SCENE_KEYS.MAIN_MENU);
  }

  private applySettings(settings: GameSettings): void {
    this.cameraSystem?.setZoom(Math.max(settings.cameraZoom, 1.35), true);
    const particlesOn =
      !settings.performanceMode &&
      settings.effectsQuality !== 'low' &&
      settings.graphicsQuality !== 'low';
    this.player?.setParticlesEnabled(particlesOn);
    const shadowsOn = settings.shadowsEnabled && !settings.performanceMode;
    for (const rp of this.remotePlayersMap.values()) {
      rp.setShadowVisible(shadowsOn);
    }
    this.touchController?.applyLayout(settings);
    document.documentElement.style.setProperty('--cc-ui-scale', String(settings.uiScale ?? 1));
    this.syncTouchVisibility();
  }

  private syncTouchVisibility(): void {
    const mode = saveSystem.getState().settings.touchMode;
    const show = shouldShowTouchControls(mode, this.userUsedTouch);
    this.touchController?.setVisible(show);
    this.hud?.setTouchVisible(show);
  }

  private cleanup(): void {
    window.removeEventListener('resize', this.onResizeBound);
    this.unsubFullscreen?.();
    this.unsubFullscreen = null;
    this.unsubMpPlayers?.();
    this.unsubMpPlayers = null;
    this.unsubMpEmote?.();
    this.unsubMpEmote = null;
    this.unsubMpNotice?.();
    this.unsubMpNotice = null;
    this.unsubMpPropUpdate?.();
    this.unsubMpPropUpdate = null;
    this.unsubMpStatus?.();
    this.unsubMpStatus = null;
    this.unsubMpRoomClosed?.();
    this.unsubMpRoomClosed = null;
    if (this.fsResizeTimer !== null) {
      window.clearTimeout(this.fsResizeTimer);
      this.fsResizeTimer = null;
    }
    if (this.exitTimer) {
      this.exitTimer.remove(false);
      this.exitTimer = null;
    }

    for (const rp of this.remotePlayersMap.values()) {
      rp.destroy();
    }
    this.remotePlayersMap.clear();

    this.missionManMarker?.destroy();
    this.missionManMarker = null;
    this.missionManModal?.destroy();
    this.missionManModal = null;
    this.friendsModal?.destroy();
    this.friendsModal = null;
    this.selectionRing?.destroy();
    this.selectionRing = null;
    this.decorateToolbar?.destroy();
    this.decorateToolbar = null;
    this.socialModal?.destroy();
    this.socialModal = null;
    this.propertyModal?.destroy();
    this.propertyModal = null;
    this.profileModal?.destroy();
    this.profileModal = null;
    this.keyboard?.destroy();
    this.keyboard = null;
    this.touchController?.destroy();
    this.touchController = null;
    this.hud?.destroy();
    this.hud = null;
    this.shopModal?.destroy();
    this.shopModal = null;
    this.inventoryModal?.destroy();
    this.inventoryModal = null;
    this.arcadeModal?.destroy();
    this.arcadeModal = null;
    this.cinemaModal?.destroy();
    this.cinemaModal = null;
    this.activityModal?.destroy();
    this.activityModal = null;
    this.tvModal?.destroy();
    this.tvModal = null;
    this.computerModal?.destroy();
    this.computerModal = null;
    this.garageModal?.destroy();
    this.garageModal = null;
    this.phoneModal?.destroy();
    this.phoneModal = null;
    this.cutsceneOverlay?.destroy();
    this.cutsceneOverlay = null;
    this.miniGamesModal?.destroy();
    this.miniGamesModal = null;
    this.journalModal?.destroy();
    this.journalModal = null;
    this.pauseMenu?.destroy();
    this.pauseMenu = null;
    this.settingsModal?.destroy();
    this.settingsModal = null;
    this.interactionSystem?.destroy();
    this.interactionSystem = null;
    this.player?.destroy();
    this.player = null;
    for (const npc of this.npcs) {
      npc.destroy();
    }
    this.npcs = [];
    for (const obj of this.propSprites) {
      obj.destroy();
    }
    this.propSprites = [];
    this.exitDoorSprite = null;
    this.tvSprite = null;
    this.gateObjects = [];
    this.tileLayer?.destroy();
    this.tileLayer = null;
    this.tilemap?.destroy();
    this.tilemap = null;
    this.collisionSystem?.destroy();
    this.collisionSystem = null;
    this.cameraSystem = null;
  }
}
