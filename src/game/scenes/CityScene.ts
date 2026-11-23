import Phaser from 'phaser';
import {CHARACTER_PRESETS, SCENE_KEYS, TILE_SIZE} from '@/src/config/constants';
import {BusStopSpot, getVehicleModelSpec} from '@/src/game/data/cityLifeData';
import {COLLECTIBLE_RELICS, SECRET_LOCATIONS} from '@/src/game/data/explorationData';
import {
  FULL_MISSIONS,
  getNpcMissionOfferState,
  MISSION_HOUSE_COORDS,
} from '@/src/game/data/progressionData';
import {getPropertyById} from '@/src/game/data/propertyData';
import {NPC} from '@/src/game/entities/NPC';
import {Player} from '@/src/game/entities/Player';
import {RemotePlayer} from '@/src/game/entities/RemotePlayer';
import {Vehicle} from '@/src/game/entities/Vehicle';
import {KeyboardController} from '@/src/game/input/KeyboardController';
import {TouchController} from '@/src/game/input/TouchController';
import {CityMapData, createCityMapData, getDistrictAtWorldPos} from '@/src/game/maps/cityMap';
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
import {CityEventSystem} from '@/src/game/systems/CityEventSystem';
import {TrafficSystem} from '@/src/game/systems/TrafficSystem';
import {WantedSystem} from '@/src/game/systems/WantedSystem';
import {WeatherSystem} from '@/src/game/systems/WeatherSystem';
import {WorldSystem} from '@/src/game/systems/WorldSystem';
import {
  ActiveTimedChallengeState,
  ArcadeGameId,
  CitySceneLaunchData,
  EmoteId,
  GameSettings,
  OwnedVehicleRecord,
  PropertyDeed,
  PropertyDef,
  RemotePlayerState,
  SavedPosition,
  ServerInviteItem,
  SharedActivityLobby,
} from '@/src/game/types/gameTypes';
import {ActivityModal} from '@/src/game/ui/ActivityModal';
import {ArcadeModal} from '@/src/game/ui/ArcadeModal';
import {CutsceneOverlay} from '@/src/game/ui/CutsceneOverlay';
import {FriendsModal} from '@/src/game/ui/FriendsModal';
import {GameHUD} from '@/src/game/ui/GameHUD';
import {GarageModal} from '@/src/game/ui/GarageModal';
import {InventoryModal} from '@/src/game/ui/InventoryModal';
import {JournalModal, JournalTab} from '@/src/game/ui/JournalModal';
import {MapOverlay} from '@/src/game/ui/MapOverlay';
import {MiniGamesModal} from '@/src/game/ui/MiniGamesModal';
import {PauseMenu} from '@/src/game/ui/PauseMenu';
import {PhoneModal} from '@/src/game/ui/PhoneModal';
import {ProfileModal} from '@/src/game/ui/ProfileModal';
import {PropertyModal} from '@/src/game/ui/PropertyModal';
import {SettingsModal} from '@/src/game/ui/SettingsModal';
import {SocialModal, SocialTab} from '@/src/game/ui/SocialModal';
import {onFullscreenChange, shouldShowTouchControls} from '@/src/game/utils/device';

export class CityScene extends Phaser.Scene {
  private launchData: CitySceneLaunchData | null = null;
  private collisionSystem: CollisionSystem | null = null;
  private worldSystem: WorldSystem | null = null;
  private cameraSystem: CameraSystem | null = null;
  private interactionSystem: InteractionSystem | null = null;
  private trafficSystem: TrafficSystem | null = null;
  private weatherSystem: WeatherSystem | null = null;
  private cityEventSystem: CityEventSystem | null = null;
  private wantedSystem: WantedSystem | null = null;
  private keyboard: KeyboardController | null = null;
  private touchController: TouchController | null = null;

  private player: Player | null = null;
  private remotePlayersMap = new Map<string, RemotePlayer>();
  private npcs: NPC[] = [];
  private vehicles: Vehicle[] = [];
  private activeVehicle: Vehicle | null = null;
  private spawnedPersonalVehicle: Vehicle | null = null;
  private vehiclePlayerColliders = new Map<string, Phaser.Physics.Arcade.Collider>();
  private vehicleAllColliders = new Map<
    string,
    {staticCol?: Phaser.Physics.Arcade.Collider; extraCols: Phaser.Physics.Arcade.Collider[]}
  >();
  private scratchVehiclePositions: {x: number; y: number}[] = [];
  private scratchNpcPositions: {x: number; y: number}[] = [];
  private acceptingPropertyInvite = false;
  private lastVehicleSpawnMs = 0;

  private mapData: CityMapData | null = null;
  private hud: GameHUD | null = null;
  private inventoryModal: InventoryModal | null = null;
  private activityModal: ActivityModal | null = null;
  private arcadeModal: ArcadeModal | null = null;
  private cutsceneOverlay: CutsceneOverlay | null = null;
  private miniGamesModal: MiniGamesModal | null = null;
  private journalModal: JournalModal | null = null;
  private mapOverlay: MapOverlay | null = null;
  private pauseMenu: PauseMenu | null = null;
  private settingsModal: SettingsModal | null = null;
  private garageModal: GarageModal | null = null;
  private phoneModal: PhoneModal | null = null;
  private socialModal: SocialModal | null = null;
  private friendsModal: FriendsModal | null = null;
  private propertyModal: PropertyModal | null = null;
  private profileModal: ProfileModal | null = null;

  private activeSharedLobby: SharedActivityLobby | null = null;
  private timedChallenge: ActiveTimedChallengeState | null = null;
  private timedCheckpoints: {x: number; y: number; label: string}[] = [];
  private timedElapsedSec = 0;
  private checkpointRingGfx: Phaser.GameObjects.Graphics | null = null;
  private customWaypoint: {x: number; y: number; label: string} | null = null;
  private objectiveUiTimerSec = 0;

  private isPaused = false;
  private userUsedTouch = false;
  private saveTimerSec = 0;
  private mapRefreshTimerSec = 0;
  private miniMapTimerSec = 0;
  private clockUiTimerSec = 0;
  private enteringBuilding = false;
  private returningToMenu = false;
  private lastRecordedDistrictId = '';
  private bumpCooldownSec = 0;
  private unsubFullscreen: (() => void) | null = null;
  private unsubEconomy: (() => void) | null = null;
  private unsubMpPlayers: (() => void) | null = null;
  private unsubMpEmote: (() => void) | null = null;
  private unsubMpNotice: (() => void) | null = null;
  private unsubMpLobbyStart: (() => void) | null = null;
  private unsubMpStatus: (() => void) | null = null;
  private unsubMpRoomClosed: (() => void) | null = null;
  private fsResizeTimer: number | null = null;

  private readonly onResizeBound = (): void => {
    if (!this.sys?.isActive() || !this.scale || !this.cameras?.main) return;
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    this.scale.resize(w, h);
    this.cameraSystem?.handleResize(w, h);
    this.syncTouchVisibility();
  };

  private readonly onBeforeUnloadBound = (): void => {
    this.persistCurrentPosition();
    void cloudSaveManager.flushNow(true);
  };

  constructor() {
    super({key: SCENE_KEYS.CITY});
  }

  public init(data?: CitySceneLaunchData): void {
    this.launchData = data ?? null;
  }

  public create(): void {
    const uiOverlay = document.getElementById('ui-overlay');
    if (!uiOverlay) return;

    this.isPaused = false;
    this.enteringBuilding = false;
    this.returningToMenu = false;
    this.saveTimerSec = 0;
    this.clockUiTimerSec = 0;
    this.objectiveUiTimerSec = 0;
    this.timedChallenge = null;
    this.timedCheckpoints = [];
    this.timedElapsedSec = 0;
    this.customWaypoint = null;
    this.activeVehicle = null;
    this.spawnedPersonalVehicle = null;
    this.bumpCooldownSec = 0;
    this.acceptingPropertyInvite = false;
    this.vehiclePlayerColliders.clear();
    this.vehicleAllColliders.clear();
    const isMp = gameSessionManager.isMultiplayer();
    if (
      isMp &&
      !gameSessionManager.getPendingJoin() &&
      multiplayerClient.getStatus().status === 'disconnected'
    ) {
      gameSessionManager.leaveToMenu(true);
      this.scene.start(SCENE_KEYS.MAIN_MENU);
      return;
    }
    if (!isMp) {
      multiplayerClient.disconnect(true);
    }

    const save = saveSystem.getState();
    const mapData = createCityMapData();
    this.mapData = mapData;

    // 1. World & Collisions
    this.collisionSystem = new CollisionSystem(this);
    this.worldSystem = new WorldSystem(this, mapData, this.collisionSystem);
    this.worldSystem.build();
    this.worldSystem.syncCollectedShards(save.collectedIds ?? []);
    this.worldSystem.syncCollectedRelics([...(save.collectibles ?? []), ...(save.collectedIds ?? [])]);
    this.worldSystem.applyGraphicsSettings(save.settings);
    document.documentElement.style.setProperty('--cc-ui-scale', String(save.settings.uiScale ?? 1));
    this.checkpointRingGfx = this.add.graphics().setDepth(3);

    // 2. Spawn Point Validation (prioritize explicit interior returnPos, then saved walkable pos)
    let spawnX = mapData.spawnPoint.x;
    let spawnY = mapData.spawnPoint.y;
    let spawnDir: 'down' | 'up' | 'left' | 'right' = 'down';

    const override = this.launchData?.spawnOverride;
    this.launchData = null;
    if (override && this.worldSystem.isWalkablePosition(override.x, override.y)) {
      spawnX = override.x;
      spawnY = override.y;
      spawnDir = override.direction;
    } else if (
      save.lastPosition &&
      this.worldSystem.isWalkablePosition(save.lastPosition.x, save.lastPosition.y)
    ) {
      spawnX = save.lastPosition.x;
      spawnY = save.lastPosition.y;
      spawnDir = save.lastPosition.direction;
    }

    // 3. Player (with live custom equipped clothing & hair)
    this.player = new Player(
      this,
      spawnX,
      spawnY,
      save.appearanceId,
      save.playerName,
    );
    this.player.setDirection(spawnDir);
    this.player.setParticlesEnabled(save.settings.graphicsQuality === 'high');
    this.collisionSystem.bindSpriteCollider(this.player.sprite);

    // 4. Living City NPCs (14 scheduled residents)
    this.npcs = mapData.npcs.map((cfg) => {
      const npc = new NPC(this, cfg);
      this.collisionSystem?.bindSpriteCollider(npc.sprite);
      if (this.player) {
        this.physics.add.collider(this.player.sprite, npc.sprite);
      }
      return npc;
    });

    // 4b. Drivable Street Vehicles + Autonomous City Traffic
    this.vehicles = mapData.vehicles.map((cfg) => this.createAndBindVehicle(cfg));
    this.trafficSystem = new TrafficSystem(this);

    // 5. Camera
    this.cameraSystem = new CameraSystem(this, save.settings.cameraZoom);
    this.cameraSystem.followTarget(this.player.sprite);

    // 6. Interaction, Weather, Dynamic Events, Wanted Patrols & Input
    this.interactionSystem = new InteractionSystem(this, mapData.interactives, this.npcs);
    const collectedIds = save.collectedIds ?? [];
    const collectedRelics = save.collectibles ?? [];
    for (const obj of mapData.interactives) {
      if (obj.kind === 'collectible_shard' && obj.collectibleId && collectedIds.includes(obj.collectibleId)) {
        this.interactionSystem.disableObject(obj.id);
      }
      if (obj.kind === 'collectible_relic' && obj.collectibleId && collectedRelics.includes(obj.collectibleId)) {
        this.interactionSystem.disableObject(obj.id);
      }
    }
    this.weatherSystem = new WeatherSystem(this);
    this.cityEventSystem = new CityEventSystem(this.worldSystem);
    this.wantedSystem = new WantedSystem(this, this.worldSystem, this.collisionSystem, {
      onAlertToast: (msg) => this.hud?.showToast(msg, 3800),
    });
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

    // 7. UI Overlays
    const syncAppearance = () => {
      const fresh = saveSystem.getState();
      this.player?.applyAppearance(fresh.appearanceId, fresh.playerName);
      this.hud?.setPlayerInfo(fresh.appearanceId, fresh.playerName);
      multiplayerClient.syncProfile();
      void cloudSaveManager.syncPublicProfile(
        multiplayerClient.getStatus().status === 'connected'
          ? multiplayerClient.getStatus().roomId
          : null,
        multiplayerClient.getStatus().status === 'connected',
      );
    };

    this.mapOverlay = new MapOverlay(uiOverlay, mapData);
    this.inventoryModal = new InventoryModal(uiOverlay, {
      onAppearanceChanged: syncAppearance,
    });
    this.activityModal = new ActivityModal(
      uiOverlay,
      () => this.completeSharedLobbyIfActive(120),
      () => this.player?.playActionAnimation('celebrate'),
    );
    this.arcadeModal = new ArcadeModal(uiOverlay, () => this.completeSharedLobbyIfActive(100));
    this.cutsceneOverlay = new CutsceneOverlay(uiOverlay);
    this.miniGamesModal = new MiniGamesModal(uiOverlay, {
      onLaunchGame: (gameId) => {
        if (gameId === 'fountain_flip') {
          this.worldSystem?.spawnFountainCoinEffect(40.5 * TILE_SIZE, 15.8 * TILE_SIZE);
          this.cutsceneOverlay?.openFountainCoinFlip('Central Park Fountain · Coin Flip', (s) =>
            this.notifyProgression(s),
          );
        } else if (gameId === 'streetball') {
          this.activityModal?.openBasketballMiniGame(
            'Eastside Streetball Court',
            'Entertainment District',
          );
        } else if (gameId === 'soccer_penalty') {
          this.activityModal?.openSoccerMiniGame('Eastside Soccer Pitch', 'Penalty Shootout');
        } else if (
          gameId === 'starlight_drift' ||
          gameId === 'brick_blitz' ||
          gameId === 'turbo_lane_racer' ||
          gameId === 'hoop_frenzy' ||
          gameId === 'reflex_surge' ||
          gameId === 'prism_match' ||
          gameId === 'memory_matrix'
        ) {
          this.arcadeModal?.open(gameId as ArcadeGameId);
        } else if (gameId === 'race_trial') {
          this.startBoulevardRaceTrial();
        } else if (gameId === 'park_sprint') {
          this.startParkAgilitySprint();
        } else if (gameId === 'courier_delivery') {
          this.startExpressDelivery();
        }
      },
      onLocateGame: (entry) => {
        this.customWaypoint = {x: entry.worldX, y: entry.worldY, label: entry.name};
        this.refreshObjectiveBanner();
        this.hud?.showToast(`GPS Waypoint pinned: ${entry.name} (${entry.locationName})`);
      },
      onAwarded: (summary) => this.notifyProgression(summary),
    });
    this.journalModal = new JournalModal(uiOverlay, {
      onTrackLocation: (x, y, label, missionId) => {
        this.customWaypoint = missionId ? null : {x, y, label};
        this.refreshObjectiveBanner();
        this.hud?.showToast(`Tracking "${label}" on MiniMap & City GPS!`);
      },
      onPlayStoryCutscene: (ch, mode, rewardBanner) => {
        const lines = mode === 'intro' ? ch.introDialogue : ch.outroDialogue;
        const cutId = `${ch.chapter}_${mode}`;
        this.cutsceneOverlay?.openStoryCutscene(ch.title, ch.subtitle, lines, rewardBanner, () => {
          economySystem.markStoryCutsceneWatched(cutId);
          this.refreshObjectiveBanner();
        });
      },
      onAwarded: (summary) => this.notifyProgression(summary),
      onMissionStateChanged: () => {
        this.refreshObjectiveBanner();
        this.syncNpcQuestMarkers();
      },
    });
    this.garageModal = new GarageModal(uiOverlay, {
      onVehicleUpdated: (record) => this.syncLivePersonalVehicle(record),
    });
    this.profileModal = new ProfileModal(uiOverlay, {
      onOpenSettings: () => {
        this.pauseGame(false);
        this.settingsModal?.open();
      },
      onNotice: (msg) => this.hud?.showToast(msg),
    });
    this.propertyModal = new PropertyModal(uiOverlay, {
      onEnterProperty: (prop, deed, readOnlyVisitor) =>
        this.enterPropertyInterior(prop, deed, readOnlyVisitor),
      onTrackProperty: (prop) => {
        this.customWaypoint = {x: prop.exteriorX, y: prop.exteriorY, label: prop.name};
        this.refreshObjectiveBanner();
        this.hud?.showToast(`GPS Waypoint pinned: ${prop.name} (${prop.districtName})`);
      },
      onAwarded: (summary) => this.notifyProgression(summary),
    });

    this.socialModal = new SocialModal(uiOverlay, {
      getPlayerWorldPos: () => {
        const st = this.player?.getEntityState();
        return {x: st?.x ?? spawnX, y: st?.y ?? spawnY, interiorId: null, propertyDeedId: null};
      },
      onViewProfile: (uid, prof, fallbackName) => {
        this.closeAllModals('profile');
        this.profileModal?.openPublicProfile(uid, prof, fallbackName);
      },
      onTriggerEmote: (em) => this.triggerQuickEmote(em),
      onLaunchSharedGame: (lob) => this.launchSharedLobbyActivity(lob),
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

    this.phoneModal = new PhoneModal(uiOverlay, {
      onOpenFullMap: () => this.toggleMap(),
      onOpenMiniGamesHub: () => this.openMiniGamesHub(),
      onOpenJournal: (tab) => this.toggleJournal(tab),
      onOpenSocial: isMp ? (tab) => this.toggleSocial(tab) : undefined,
      onOpenProperties: () => this.openProperties(),
      onOpenProfile: () => this.openSelfProfile(),
      onSpawnVehicle: (vehicleId) => this.spawnPersonalVehicle(vehicleId),
      onDespawnVehicle: () => this.despawnPersonalVehicle(),
      hasSpawnedPersonalVehicle: () => Boolean(this.spawnedPersonalVehicle),
      getSpawnCooldownSec: () => this.getVehicleSpawnCooldownSec(),
      getCurrentDistrictName: () => {
        if (!this.player) return 'CHAOS CITY';
        const st = this.player.getEntityState();
        return getDistrictAtWorldPos(st.x, st.y).name;
      },
      getPlayerCoords: () => {
        const st = this.player?.getEntityState();
        return {x: st?.x ?? spawnX, y: st?.y ?? spawnY};
      },
      getPersonalVehicleCoords: () =>
        this.spawnedPersonalVehicle
          ? {
              x: this.spawnedPersonalVehicle.sprite.x,
              y: this.spawnedPersonalVehicle.sprite.y,
              name: this.spawnedPersonalVehicle.config.name,
            }
          : null,
      getNpcDirectory: () => {
        const phase = cityClockSystem.getPhase();
        return this.npcs.map((n) => ({
          id: n.config.id,
          name: n.config.name,
          role: n.config.role,
          district: n.config.district,
          activityLabel: n.getCurrentActivityLabel(phase),
        }));
      },
      onAppearanceChanged: syncAppearance,
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
        syncAppearance();
        this.applySettings(saveSystem.getState().settings);
        this.syncNpcQuestMarkers();
        this.refreshObjectiveBanner();
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

    this.hud = new GameHUD(uiOverlay, mapData, {
      onOpenMap: () => this.toggleMap(),
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
      onRideRemoteVehicle: (rp) => {
        multiplayerClient.requestRide(rp.uid);
      },
      onCancelTimedChallenge: () => this.cancelTimedChallenge(true),
      onOpenInventory: () => this.toggleInventory(),
      onOpenSettings: () => {
        this.pauseGame(false);
        this.settingsModal?.open();
      },
      onPause: () => this.pauseGame(true),
      onTriggerInteract: () => this.handleInteractAction(),
      onFountainCoinToss: (fx, fy) => this.worldSystem?.spawnFountainCoinEffect(fx, fy),
      onCycleOutfit: () => this.cyclePlayerOutfit(),
      onExitVehicle: () => this.exitActiveVehicle(),
      onNpcChatMore: (npcObjId, step) => {
        const rawId = npcObjId.replace(/^int_/, '');
        const npc = this.npcs.find((n) => n.config.id === rawId);
        return npc ? npc.getNextChatLine(step) : null;
      },
      onMissionAction: (action, missionId) => {
        const m = FULL_MISSIONS.find((x) => x.id === missionId);
        if (!m) return {ok: false, message: 'Mission not found.'};
        if (action === 'accept') {
          const ok = economySystem.acceptMission(missionId);
          if (!ok) return {ok: false, message: 'Mission could not be accepted.'};
          this.customWaypoint = null;
          this.refreshObjectiveBanner();
          this.syncNpcQuestMarkers();
          return {
            ok: true,
            message: `Accepted "${m.title}" & pinned ${m.targetMarker.label} on GPS!`,
          };
        }
        if (action === 'pause') {
          economySystem.pauseMission();
          this.refreshObjectiveBanner();
          this.syncNpcQuestMarkers();
          return {
            ok: true,
            message: `Paused "${m.title}". Resume anytime in Journal [J].`,
          };
        }
        if (action === 'abandon') {
          economySystem.abandonMission(missionId);
          this.refreshObjectiveBanner();
          this.syncNpcQuestMarkers();
          return {
            ok: true,
            message: `Abandoned "${m.title}". Speak with ${m.npcOrLocation} anytime to re-accept.`,
          };
        }
        const res = economySystem.claimMissionReward(missionId);
        if (!res.ok) return {ok: false, message: res.reason ?? 'Complete objective first.'};
        if (res.summary) this.notifyProgression(res.summary);
        this.refreshObjectiveBanner();
        this.syncNpcQuestMarkers();
        return {
          ok: true,
          message: `Completed "${m.title}"! Claimed +${res.coinsAwarded} Coins & +${res.summary?.xpAwarded ?? 0} XP!`,
        };
      },
    });

    this.hud.setPlayerInfo(save.appearanceId, save.playerName);
    const initialDistrict = getDistrictAtWorldPos(spawnX, spawnY);
    this.hud.setDistrictName(initialDistrict.name);
    this.syncClockDisplay();
    this.lastRecordedDistrictId = initialDistrict.id;
    economySystem.recordDistrictVisit(initialDistrict.id);
    this.syncNpcQuestMarkers();
    this.refreshObjectiveBanner();
    this.hud.updateMiniMap(
      spawnX,
      spawnY,
      spawnDir,
      this.npcs.map((n) => ({x: n.sprite.x, y: n.sprite.y})),
      this.trafficSystem.getPositions(),
      null,
      this.getActiveWaypointTarget(),
      this.wantedSystem?.getPoliceBlips() ?? [],
      this.getMapExtras().eventBeaconPos,
      this.getQuestPins(),
    );
    this.syncTouchVisibility();

    this.unsubEconomy = economySystem.subscribe(() => {
      if (!this.sys?.isActive()) return;
      this.syncNpcQuestMarkers();
      this.refreshObjectiveBanner();
    });

    // Strict mode separation: Multiplayer WebSocket & remote players ONLY in Multiplayer Mode
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
      this.unsubMpLobbyStart = multiplayerClient.onLobbyStarted((lob) => {
        if (!this.sys?.isActive()) return;
        this.launchSharedLobbyActivity(lob);
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

      if (authSystem.getCurrentUser()) {
        void ownerBadgeService.refreshOwnerConfig().then(() => {
          if (this.sys?.isActive()) this.player?.refreshOwnerBadge();
        });
        const pending = gameSessionManager.getPendingJoin();
        const mpNow = multiplayerClient.getStatus();
        if (mpNow.status === 'connected' && (!pending || pending.roomId === mpNow.roomId)) {
          this.syncRemotePlayers(multiplayerClient.getRemotePlayers());
        } else if (pending) {
          void multiplayerClient.connect(
            pending.roomId,
            {x: spawnX, y: spawnY, interiorId: null, propertyDeedId: null},
            {password: pending.password, roomCode: pending.roomCode},
          );
        }
      }
    } else {
      multiplayerClient.disconnect(true);
      if (authSystem.getCurrentUser()) {
        void ownerBadgeService.refreshOwnerConfig().then(() => {
          if (this.sys?.isActive()) this.player?.refreshOwnerBadge();
        });
      }
    }

    window.addEventListener('resize', this.onResizeBound);
    window.addEventListener('beforeunload', this.onBeforeUnloadBound);
    this.unsubFullscreen = onFullscreenChange(() => {
      if (this.fsResizeTimer !== null) {
        window.clearTimeout(this.fsResizeTimer);
      }
      this.fsResizeTimer = window.setTimeout(this.onResizeBound, 60);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);

    audioSystem.startCityMusic();
  }

  private createAndBindVehicle(cfg: ConstructorParameters<typeof Vehicle>[1]): Vehicle {
    const veh = new Vehicle(this, cfg);
    const staticCol = this.collisionSystem?.bindSpriteCollider(veh.sprite);
    const extraCols: Phaser.Physics.Arcade.Collider[] = [];
    for (const npc of this.npcs) {
      extraCols.push(this.physics.add.collider(veh.sprite, npc.sprite));
    }
    if (this.player) {
      const col = this.physics.add.collider(this.player.sprite, veh.sprite);
      this.vehiclePlayerColliders.set(veh.config.id, col);
      extraCols.push(col);
    }
    for (const other of this.vehicles) {
      extraCols.push(this.physics.add.collider(veh.sprite, other.sprite));
    }
    this.vehicleAllColliders.set(veh.config.id, {staticCol, extraCols});
    return veh;
  }

  public update(_time: number, delta: number): void {
    if (!this.player || !this.keyboard || !this.touchController) return;
    if (this.enteringBuilding) return;

    const dtMs = Math.min(delta, 50);
    const dtSec = dtMs / 1000;

    const keyInput = this.keyboard.consumeSnapshot();
    const touchInput = this.touchController.getState();

    // Handle global UI toggles first
    if (keyInput.pauseJustPressed) {
      if (this.cutsceneOverlay?.isOpen()) {
        this.cutsceneOverlay.close();
        return;
      }
      if (this.arcadeModal?.isOpen()) {
        this.arcadeModal.close();
        return;
      }
      if (this.miniGamesModal?.isOpen()) {
        this.miniGamesModal.close();
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
      if (this.phoneModal?.isOpen()) {
        this.phoneModal.close();
        return;
      }
      if (this.garageModal?.isOpen()) {
        this.garageModal.close();
        return;
      }
      if (this.inventoryModal?.isOpen()) {
        this.inventoryModal.close();
        return;
      }
      if (this.activityModal?.isOpen()) {
        this.activityModal.close();
        return;
      }
      if (this.hud?.isInteractionPanelOpen()) {
        this.hud.closeInteractionPanel();
        return;
      }
      if (this.mapOverlay?.isOpen()) {
        this.mapOverlay.close();
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

    if (keyInput.mapJustPressed && !this.isPaused && !this.settingsModal?.isOpen()) {
      this.toggleMap();
      return;
    }

    // Freeze movement while paused or inside modals
    const uiBlockingMovement =
      this.isPaused ||
      Boolean(this.cutsceneOverlay?.isOpen()) ||
      Boolean(this.arcadeModal?.isOpen()) ||
      Boolean(this.miniGamesModal?.isOpen()) ||
      Boolean(this.friendsModal?.isOpen()) ||
      Boolean(this.socialModal?.isOpen()) ||
      Boolean(this.propertyModal?.isOpen()) ||
      Boolean(this.profileModal?.isOpen()) ||
      Boolean(this.journalModal?.isOpen()) ||
      Boolean(this.mapOverlay?.isOpen()) ||
      Boolean(this.phoneModal?.isOpen()) ||
      Boolean(this.garageModal?.isOpen()) ||
      Boolean(this.inventoryModal?.isOpen()) ||
      Boolean(this.activityModal?.isOpen()) ||
      Boolean(this.settingsModal?.isOpen()) ||
      Boolean(this.hud?.isInteractionPanelOpen());

    cityClockSystem.update(dtSec, uiBlockingMovement);
    this.worldSystem?.updateAtmosphere(dtSec, uiBlockingMovement);
    this.worldSystem?.updateChunkCulling(this.cameras.main);

    this.clockUiTimerSec += dtSec;
    if (this.clockUiTimerSec >= 0.5) {
      this.clockUiTimerSec = 0;
      this.syncClockDisplay();
    }

    if (uiBlockingMovement) {
      this.player.stopImmediately();
      this.activeVehicle?.stopImmediately();
      const stPaused = this.player.getEntityState();
      this.weatherSystem?.update(dtSec, true, stPaused.x, stPaused.y, false);
      this.wantedSystem?.update(dtSec, true, stPaused.x, stPaused.y, 0, false);
      for (const npc of this.npcs) {
        npc.update(dtMs, true);
      }
      if (this.mapOverlay?.isOpen()) {
        this.mapRefreshTimerSec += dtSec;
        if (this.mapRefreshTimerSec >= 0.25) {
          this.mapRefreshTimerSec = 0;
          this.mapOverlay.renderMap(
            stPaused.x,
            stPaused.y,
            getDistrictAtWorldPos(stPaused.x, stPaused.y).name,
            this.npcs.map((n) => ({x: n.sprite.x, y: n.sprite.y})),
            this.getMapExtras(),
          );
        }
      }
      return;
    }

    // Merge keyboard & touch inputs
    const curSettings = saveSystem.getState().settings;
    const mergedMoveX = Math.abs(touchInput.moveX) > 0.01 ? touchInput.moveX : keyInput.moveX;
    const mergedMoveY = Math.abs(touchInput.moveY) > 0.01 ? touchInput.moveY : keyInput.moveY;
    const mergedRunning = keyInput.isRunning || touchInput.isRunning;
    const particlesOn =
      !curSettings.performanceMode &&
      curSettings.effectsQuality !== 'low' &&
      curSettings.graphicsQuality !== 'low';
    const traction = this.weatherSystem?.getTractionMultiplier() ?? 1.0;
    const hlIntensity = this.weatherSystem?.getHeadlightIntensity() ?? 0.4;

    if (this.bumpCooldownSec > 0) {
      this.bumpCooldownSec = Math.max(0, this.bumpCooldownSec - dtSec);
    }

    if (keyInput.emoteJustPressed) {
      this.triggerQuickEmote('wave');
    }

    const ridingDriverUid = multiplayerClient.getStatus().ridingDriverUid;
    const ridingDriver = ridingDriverUid ? this.remotePlayersMap.get(ridingDriverUid) : undefined;

    if (this.activeVehicle) {
      this.activeVehicle.updateDriving(
        dtSec,
        mergedMoveX,
        mergedMoveY,
        mergedRunning,
        particlesOn,
        traction,
        hlIntensity,
      );
      this.player.syncPositionToVehicle(
        this.activeVehicle.sprite.x,
        this.activeVehicle.sprite.y,
        this.activeVehicle.getDirection(),
      );
      this.hud?.setInteractionTarget(null);
      this.hud?.setSittingState(false);
      const activeSpeed = this.activeVehicle.getCurrentSpeed();
      this.hud?.setDrivingState(
        this.activeVehicle.config.name,
        activeSpeed,
        this.activeVehicle.getCondition(),
      );
      this.touchController.setInteractAvailable(true);

      // High-speed fender-bender detection (vehicle body wear + wanted trigger on traffic bumps)
      if (this.bumpCooldownSec <= 0 && activeSpeed > 135) {
        const vx = this.activeVehicle.sprite.x;
        const vy = this.activeVehicle.sprite.y;
        const hitTraffic = (this.trafficSystem?.getPositions() ?? []).some(
          (tp) => Math.hypot(tp.x - vx, tp.y - vy) < 36,
        );
        const hitParked =
          !hitTraffic &&
          this.vehicles.some(
            (ov) => ov !== this.activeVehicle && Math.hypot(ov.sprite.x - vx, ov.sprite.y - vy) < 38,
          );
        if (hitTraffic || hitParked) {
          this.bumpCooldownSec = 1.6;
          const dmg = hitTraffic ? 6 : 4;
          const nextCond = this.activeVehicle.config.ownedRecordId
            ? economySystem.damageVehicle(this.activeVehicle.config.ownedRecordId, dmg)
            : Math.max(10, this.activeVehicle.getCondition() - dmg);
          this.activeVehicle.setCondition(nextCond);
          if (hitTraffic && activeSpeed > 170) {
            this.wantedSystem?.reportTrafficBump();
          }
        }
      }
    } else if (ridingDriver) {
      this.player.setDriving(true);
      this.player.syncPositionToVehicle(
        ridingDriver.sprite.x + 8,
        ridingDriver.sprite.y,
        ridingDriver.state.dir,
      );
      this.hud?.setInteractionTarget(null);
      this.hud?.setDrivingState(`Passenger · ${ridingDriver.state.displayName}`, 0, 100);
      this.touchController.setInteractAvailable(true);
    } else {
      if (this.player.getIsSitting() === false && this.player.getEntityState().isDriving) {
        this.player.setDriving(false);
        this.cameraSystem?.followTarget(this.player.sprite);
      }
      this.player.update(dtSec, {
        moveX: mergedMoveX,
        moveY: mergedMoveY,
        isRunning: mergedRunning,
        interactJustPressed: keyInput.interactJustPressed,
        mapJustPressed: false,
        pauseJustPressed: false,
      });

      const stForInteract = this.player.getEntityState();
      const vehicleInteractives = this.vehicles
        .filter((v) => !v.isOccupied())
        .map((v) => v.toInteractiveData());
      const target =
        this.interactionSystem?.update(dtSec, stForInteract.x, stForInteract.y, vehicleInteractives) ??
        null;
      this.hud?.setInteractionTarget(target);
      this.hud?.setSittingState(this.player.getIsSitting());
      this.hud?.setDrivingState(null, 0, 100);
      this.touchController.setInteractAvailable(Boolean(target) || this.player.getIsSitting());
    }

    const st = this.player.getEntityState();
    if (gameSessionManager.isMultiplayer()) {
      for (const rp of this.remotePlayersMap.values()) {
        rp.update(dtSec);
      }
    }
    for (const v of this.vehicles) {
      if (v === this.activeVehicle) continue;
      if (
        (v.config.modelId === 'police' || hlIntensity > 0.55) &&
        Math.hypot(v.sprite.x - st.x, v.sprite.y - st.y) < 800
      ) {
        v.updateVisualFx(dtSec, hlIntensity);
      }
    }

    const currentPhase = cityClockSystem.getPhase();
    const fastCar = this.activeVehicle
      ? {
          x: this.activeVehicle.sprite.x,
          y: this.activeVehicle.sprite.y,
          speed: this.activeVehicle.getCurrentSpeed(),
        }
      : null;
    for (const npc of this.npcs) {
      npc.update(dtMs, false, currentPhase, {x: st.x, y: st.y}, fastCar);
    }

    this.scratchVehiclePositions.length = 0;
    for (const v of this.vehicles) {
      this.scratchVehiclePositions.push({x: v.sprite.x, y: v.sprite.y});
    }
    this.trafficSystem?.update(
      dtSec,
      false,
      {x: st.x, y: st.y},
      this.scratchVehiclePositions,
    );

    this.weatherSystem?.update(dtSec, false, st.x, st.y, particlesOn);
    const evtRes = this.cityEventSystem?.update(dtSec, false, st.x, st.y);
    if (evtRes) {
      audioSystem.playCoin();
      this.hud?.showToast(
        `Event Complete: ${evtRes.eventCompleted.title}! +${evtRes.summary.coinsAwarded} Coins · +${evtRes.summary.xpAwarded} XP`,
        4200,
      );
      this.notifyProgression(evtRes.summary);
    }
    this.wantedSystem?.update(
      dtSec,
      false,
      st.x,
      st.y,
      this.activeVehicle ? this.activeVehicle.getCurrentSpeed() : 0,
      Boolean(this.activeVehicle),
    );

    const currentDistrict = getDistrictAtWorldPos(st.x, st.y);
    this.hud?.setDistrictName(currentDistrict.name);
    if (currentDistrict.id !== this.lastRecordedDistrictId) {
      this.lastRecordedDistrictId = currentDistrict.id;
      economySystem.recordDistrictVisit(currentDistrict.id);
    }

    this.updateTimedChallenge(dtSec, _time, st.x, st.y);

    this.objectiveUiTimerSec += dtSec;
    if (this.objectiveUiTimerSec >= 0.25) {
      this.objectiveUiTimerSec = 0;
      this.refreshObjectiveBanner();
    }

    this.miniMapTimerSec += dtSec;
    if (this.miniMapTimerSec >= 0.12) {
      this.miniMapTimerSec = 0;
      const extras = this.getMapExtras();
      this.scratchNpcPositions.length = 0;
      for (const n of this.npcs) {
        this.scratchNpcPositions.push({x: n.sprite.x, y: n.sprite.y});
      }
      this.hud?.updateMiniMap(
        st.x,
        st.y,
        st.direction,
        this.scratchNpcPositions,
        extras.trafficPositions,
        extras.personalCarPos,
        extras.waypointTarget,
        extras.policePositions,
        extras.eventBeaconPos,
        extras.questPins,
      );
    }

    if (keyInput.interactJustPressed) {
      this.handleInteractAction();
    }

    // Authoritative multiplayer state sync ONLY when in Multiplayer mode
    if (gameSessionManager.isMultiplayer()) {
      const pBody = this.player.sprite.body as Phaser.Physics.Arcade.Body | undefined;
      multiplayerClient.sendMove({
        x: st.x,
        y: st.y,
        vx: pBody?.velocity.x ?? 0,
        vy: pBody?.velocity.y ?? 0,
        dir: this.activeVehicle ? this.activeVehicle.getDirection() : st.direction,
        anim: st.animState,
        interiorId: null,
        propertyDeedId: null,
        vehicle: this.activeVehicle
          ? {
              id: this.activeVehicle.config.id,
              modelId: this.activeVehicle.config.modelId ?? 'sedan',
              texture: this.activeVehicle.config.texture,
              customization: this.activeVehicle.config.customization ?? {
                paintColor: '#ef4444',
                secondaryColor: '#f8fafc',
                wheelStyle: 'stock',
                spoilerStyle: 'none',
                decalStyle: 'none',
                headlightStyle: 'warm',
              },
              isScooter: Boolean(this.activeVehicle.config.isScooter),
              passengers: [],
            }
          : null,
      });
    }

    // Periodic safe position save
    this.saveTimerSec += dtSec;
    if (this.saveTimerSec >= 4.0) {
      this.saveTimerSec = 0;
      this.persistCurrentPosition();
    }
  }

  private syncClockDisplay(): void {
    const badge = cityClockSystem.getPhaseBadge();
    this.hud?.setClockDisplay(`${badge.icon} ${cityClockSystem.getFormattedTime()}`);
    if (this.weatherSystem) {
      this.hud?.setWeatherDisplay(this.weatherSystem.getBadge());
    }
    if (this.wantedSystem) {
      this.hud?.setWantedStars(
        this.wantedSystem.getWantedStars(),
        this.wantedSystem.getEvadeSeconds(),
      );
    }
  }

  private syncNpcQuestMarkers(): void {
    const save = saveSystem.getState();
    for (const npc of this.npcs) {
      npc.setQuestMarkerState(getNpcMissionOfferState(npc.config.id, save));
    }
  }

  private getQuestPins(): {
    x: number;
    y: number;
    state: 'ready' | 'available' | 'active';
    label: string;
  }[] {
    const pins: {
      x: number;
      y: number;
      state: 'ready' | 'available' | 'active';
      label: string;
    }[] = [];
    for (const npc of this.npcs) {
      const qState = npc.getQuestMarkerState();
      if (qState) {
        pins.push({
          x: npc.sprite.x,
          y: npc.sprite.y,
          state: qState,
          label: npc.config.name,
        });
      }
    }
    return pins;
  }

  private getMapExtras() {
    const activeEvent = this.cityEventSystem?.getActiveEventState() ?? null;
    const save = saveSystem.getState();
    const collectedRelicsSet = new Set(save.collectibles ?? []);
    const discoveredSecretsSet = new Set(save.discoveredSecrets ?? []);
    return {
      trafficPositions: this.trafficSystem?.getPositions() ?? [],
      personalCarPos: this.spawnedPersonalVehicle
        ? {
            x: this.spawnedPersonalVehicle.sprite.x,
            y: this.spawnedPersonalVehicle.sprite.y,
            name: this.spawnedPersonalVehicle.config.name,
          }
        : null,
      waypointTarget: this.getActiveWaypointTarget(),
      policePositions: this.wantedSystem?.getPoliceBlips() ?? [],
      eventBeaconPos: activeEvent
        ? {
            x: activeEvent.worldX,
            y: activeEvent.worldY,
            label: activeEvent.title,
          }
        : null,
      questPins: this.getQuestPins(),
      remotePlayers: gameSessionManager.isMultiplayer()
        ? multiplayerClient
            .getRemotePlayers()
            .filter((p) => !p.interiorId)
            .map((p) => ({
              x: p.x,
              y: p.y,
              displayName: p.displayName,
              isOwner: ownerBadgeService.isVerifiedOwnerAccount(p.uid, p.username, p.isOwner),
            }))
        : [],
      ownedPropertyMarkers: propertySystem.getOwnedPropertyDefs().map((p) => ({
        x: p.exteriorX,
        y: p.exteriorY,
        name: p.name,
      })),
      discoveredRelics: COLLECTIBLE_RELICS.filter((r) => collectedRelicsSet.has(r.id)).map((r) => ({
        x: r.tileX * TILE_SIZE,
        y: r.tileY * TILE_SIZE,
        name: r.name,
      })),
      discoveredSecrets: SECRET_LOCATIONS.filter((s) => discoveredSecretsSet.has(s.id)).map((s) => ({
        x: s.entryTileX * TILE_SIZE,
        y: s.entryTileY * TILE_SIZE,
        name: s.name,
      })),
    };
  }

  private getVehicleSpawnCooldownSec(): number {
    const diff = Date.now() - this.lastVehicleSpawnMs;
    if (diff >= 3000) return 0;
    return Math.ceil((3000 - diff) / 1000);
  }

  private spawnPersonalVehicle(
    vehicleId: string,
  ): {ok: boolean; message: string} {
    if (!this.player || !this.worldSystem) {
      return {ok: false, message: 'City world is still loading.'};
    }
    const cd = this.getVehicleSpawnCooldownSec();
    if (cd > 0) {
      return {ok: false, message: `Wait ${cd}s before dispatching another ride.`};
    }
    if (this.activeVehicle) {
      return {ok: false, message: 'Exit your current vehicle before spawning a new ride.'};
    }

    const record = economySystem.getVehicleById(vehicleId);
    if (!record) {
      return {ok: false, message: 'Selected vehicle not found in your garage.'};
    }

    const st = this.player.getEntityState();
    const candidates = [
      {dx: 58, dy: 0},
      {dx: -58, dy: 0},
      {dx: 0, dy: 54},
      {dx: 0, dy: -54},
      {dx: 54, dy: 44},
      {dx: -54, dy: 44},
      {dx: 54, dy: -44},
      {dx: -54, dy: -44},
      {dx: 88, dy: 0},
      {dx: -88, dy: 0},
      {dx: 0, dy: 84},
      {dx: 0, dy: -84},
    ];

    const dynamicObstacles: {x: number; y: number; minDist: number}[] = [
      ...this.npcs.map((n) => ({x: n.sprite.x, y: n.sprite.y, minDist: 42})),
      ...this.vehicles
        .filter((v) => v !== this.spawnedPersonalVehicle)
        .map((v) => ({x: v.sprite.x, y: v.sprite.y, minDist: 56})),
      ...(this.trafficSystem?.getPositions().map((t) => ({x: t.x, y: t.y, minDist: 56})) ?? []),
    ];

    let chosenX: number | null = null;
    let chosenY: number | null = null;
    let lastReason = 'No clear road or curb clearance nearby.';

    for (const off of candidates) {
      const cx = Math.round(st.x + off.dx);
      const cy = Math.round(st.y + off.dy);
      const check = this.worldSystem.isSafeVehicleSpawnSpot(cx, cy, dynamicObstacles);
      if (check.ok) {
        chosenX = cx;
        chosenY = cy;
        break;
      }
      if (check.reason) lastReason = check.reason;
    }

    if (chosenX === null || chosenY === null) {
      return {ok: false, message: `Cannot spawn here: ${lastReason}`};
    }

    // Remove previous personal spawned vehicle cleanly (1 active personal vehicle rule)
    this.removePersonalVehicleEntity();

    const spec = getVehicleModelSpec(record.modelId);
    const dir = st.direction === 'up' || st.direction === 'down' ? 'right' : st.direction;
    const spawned = this.createAndBindVehicle({
      id: 'personal_spawned_vehicle',
      name: record.name,
      subtitle: 'Personal Vehicle',
      texture: `veh_${record.modelId}`,
      x: chosenX,
      y: chosenY,
      direction: dir,
      maxSpeed: spec.baseSpeed,
      isScooter: spec.isScooter,
      modelId: record.modelId,
      ownedRecordId: record.id,
      customization: {...record.customization},
      upgrades: {...record.upgrades},
      condition: record.condition ?? 100,
    });
    this.vehicles.push(spawned);
    this.spawnedPersonalVehicle = spawned;
    this.lastVehicleSpawnMs = Date.now();
    economySystem.markVehicleSpawned();

    this.hud?.showToast(`${record.name} delivered nearby! Approach it and press E to drive.`);
    return {
      ok: true,
      message: `${record.name} dispatched nearby! Close Phone and press E to drive.`,
    };
  }

  private despawnPersonalVehicle(): {ok: boolean; message: string} {
    if (!this.spawnedPersonalVehicle) {
      return {ok: false, message: 'No personal vehicle is currently deployed.'};
    }
    if (this.activeVehicle === this.spawnedPersonalVehicle) {
      this.exitActiveVehicle();
    }
    const name = this.spawnedPersonalVehicle.config.name;
    this.removePersonalVehicleEntity();
    return {ok: true, message: `Returned ${name} safely to Chaos Customs Garage.`};
  }

  private removePersonalVehicleEntity(): void {
    if (!this.spawnedPersonalVehicle) return;
    const target = this.spawnedPersonalVehicle;
    const id = target.config.id;
    const entry = this.vehicleAllColliders.get(id);
    if (entry) {
      if (entry.staticCol) {
        this.collisionSystem?.removeCollider(entry.staticCol);
      }
      for (const c of entry.extraCols) {
        try {
          c.destroy();
        } catch {
          // ignore already destroyed collider
        }
      }
      this.vehicleAllColliders.delete(id);
    }
    this.vehiclePlayerColliders.delete(id);
    this.vehicles = this.vehicles.filter((v) => v !== target);
    target.destroy();
    this.spawnedPersonalVehicle = null;
  }

  private syncLivePersonalVehicle(record: OwnedVehicleRecord): void {
    if (
      this.spawnedPersonalVehicle &&
      this.spawnedPersonalVehicle.config.ownedRecordId === record.id
    ) {
      this.spawnedPersonalVehicle.applyCustomizationAndUpgrades(record);
    }
  }

  private handleInteractAction(): void {
    if (!this.player || !this.hud || !this.interactionSystem) return;
    if (
      this.isPaused ||
      this.cutsceneOverlay?.isOpen() ||
      this.arcadeModal?.isOpen() ||
      this.miniGamesModal?.isOpen() ||
      this.socialModal?.isOpen() ||
      this.propertyModal?.isOpen() ||
      this.profileModal?.isOpen() ||
      this.journalModal?.isOpen() ||
      this.mapOverlay?.isOpen() ||
      this.phoneModal?.isOpen() ||
      this.garageModal?.isOpen() ||
      this.inventoryModal?.isOpen() ||
      this.activityModal?.isOpen() ||
      this.settingsModal?.isOpen()
    ) {
      return;
    }

    if (this.hud.isInteractionPanelOpen()) {
      this.hud.closeInteractionPanel();
      return;
    }

    if (multiplayerClient.getStatus().ridingDriverUid) {
      multiplayerClient.exitRide();
      this.player.setDriving(false);
      this.cameraSystem?.followTarget(this.player.sprite);
      return;
    }

    if (this.activeVehicle) {
      this.exitActiveVehicle();
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

    if (target.kind === 'vehicle' && target.vehicleId) {
      this.enterVehicle(target.vehicleId);
      return;
    }

    if (target.kind === 'building_entrance' && target.buildingId) {
      this.enterBuilding(target.buildingId, target.x, target.y);
      return;
    }

    if (target.kind === 'property_sign') {
      audioSystem.playInteract();
      this.closeAllModals('property');
      this.propertyModal?.open(target.propertyId, 'catalog');
      return;
    }

    if (target.kind === 'collectible_relic') {
      const relicId = target.collectibleId ?? target.id;
      const res = economySystem.claimCollectibleRelic(relicId);
      if (res.ok) {
        audioSystem.playCoin();
        this.worldSystem?.hideCollectible(relicId);
        this.interactionSystem.disableObject(target.id);
        this.player.playActionAnimation('celebrate');
        this.hud.showToast(
          `${target.title} Discovered! (${res.total}/${COLLECTIBLE_RELICS.length} Relics)`,
          4000,
        );
        if (res.summary) this.notifyProgression(res.summary);
        this.refreshObjectiveBanner();
      }
      return;
    }

    if (target.kind === 'secret_portal') {
      const secretId = target.secretId ?? target.id;
      const res = economySystem.claimSecretDiscovery(secretId);
      audioSystem.playInteract();
      this.player.playActionAnimation('celebrate');
      if (res.firstDiscovery) {
        audioSystem.playCoin();
        this.hud.showToast(`SECRET DISCOVERED: ${target.title}!`, 4400);
        if (res.summary) this.notifyProgression(res.summary);
        this.refreshObjectiveBanner();
      } else {
        this.hud.openInteractionPanel(target);
      }
      return;
    }

    if (target.kind === 'collectible_shard') {
      const shardId = target.collectibleId ?? target.id;
      const res = economySystem.claimCollectible(shardId, 25, 35);
      if (res.ok) {
        audioSystem.playCoin();
        this.worldSystem?.hideCollectible(shardId);
        this.interactionSystem.disableObject(target.id);
        this.player.playActionAnimation('celebrate');
        this.hud.showToast(
          `Starlight Shard Collected! (${res.total}/14) +25 Coins · +35 XP`,
          3800,
        );
        this.refreshObjectiveBanner();
      }
      return;
    }

    if (target.kind === 'fountain_flip' || target.kind === 'fountain') {
      audioSystem.playSplash();
      this.worldSystem?.spawnFountainCoinEffect(target.x, target.y);
      this.cutsceneOverlay?.openFountainCoinFlip(target.title, (s) => this.notifyProgression(s));
      return;
    }

    if (target.kind === 'fishing_spot') {
      audioSystem.playInteract();
      this.miniGamesModal?.openFishingGame();
      return;
    }

    if (target.kind === 'memory_kiosk') {
      audioSystem.playInteract();
      this.miniGamesModal?.openMemoryGame();
      return;
    }

    if (target.kind === 'race_trial') {
      audioSystem.playInteract();
      this.startBoulevardRaceTrial();
      return;
    }

    if (target.kind === 'park_sprint') {
      audioSystem.playInteract();
      this.startParkAgilitySprint();
      return;
    }

    if (target.kind === 'delivery_desk') {
      audioSystem.playInteract();
      this.startExpressDelivery();
      return;
    }

    if (target.kind === 'basketball') {
      audioSystem.playInteract();
      this.activityModal?.openBasketballMiniGame(target.title, target.subtitle);
      return;
    }

    if (target.kind === 'soccer') {
      audioSystem.playWhistle();
      this.activityModal?.openSoccerMiniGame(target.title, target.subtitle);
      return;
    }

    if (target.kind === 'bus_stop') {
      audioSystem.playInteract();
      this.activityModal?.openBusTransitModal(target.busStopId, (stop) =>
        this.teleportToBusStop(stop),
      );
      return;
    }

    audioSystem.playInteract();

    if (target.kind === 'bench' && target.seatX !== undefined && target.seatY !== undefined) {
      this.player.sitAt(target.seatX, target.seatY);
      this.hud.setSittingState(true);
      return;
    }

    if (target.kind === 'npc') {
      const rawId = target.id.replace(/^int_/, '');
      const npc = this.npcs.find((n) => n.config.id === rawId);
      if (npc) {
        const newlyMet = economySystem.recordNpcMet(npc.config.id);
        const phase = cityClockSystem.getPhase();
        const enriched = {
          ...target,
          subtitle: `${npc.config.role} · ${npc.getCurrentActivityLabel(phase)}`,
          description: npc.getNextChatLine(0),
          details: newlyMet
            ? [`Added ${npc.config.name} to your Smartphone Contacts!`]
            : [`Known Resident · Schedule: ${npc.getCurrentActivityLabel(phase)}`],
          actionLabel: 'Chat More',
        };
        this.player.playActionAnimation('interact');
        this.hud.openInteractionPanel(enriched);
        return;
      }
    }

    this.player.playActionAnimation('interact');
    this.hud.openInteractionPanel(target);
  }

  private teleportToBusStop(stop: BusStopSpot): void {
    if (!this.player) return;
    this.player.stopImmediately();
    const destY =
      this.worldSystem && this.worldSystem.isWalkablePosition(stop.x, stop.y + 8)
        ? stop.y + 8
        : stop.y;
    this.player.sprite.setPosition(stop.x, destY);
    this.player.setDirection('down');
    this.cameras.main.fadeIn(220, 4, 8, 18);
    audioSystem.playDoor();
    this.hud?.setDistrictName(stop.district);
    this.hud?.showToast(`Arrived at ${stop.name} (${stop.district}) via City Bus Express!`);
    this.persistCurrentPosition();
  }

  private enterVehicle(vehicleId: string): void {
    if (!this.player || this.activeVehicle) return;
    const veh = this.vehicles.find((v) => v.config.id === vehicleId && !v.isOccupied());
    if (!veh) return;

    if (veh.config.ownedRecordId) {
      const owned = economySystem.getVehicleById(veh.config.ownedRecordId);
      if (owned) {
        veh.setCondition(owned.condition ?? 100);
      }
    }

    const collider = this.vehiclePlayerColliders.get(vehicleId);
    if (collider) collider.active = false;

    veh.setOccupied(true);
    this.activeVehicle = veh;
    this.player.setDriving(true);
    this.player.syncPositionToVehicle(veh.sprite.x, veh.sprite.y, veh.getDirection());
    this.cameraSystem?.followTarget(veh.sprite);
    this.tweens.add({
      targets: veh.sprite,
      scaleX: 1.08,
      scaleY: 0.92,
      duration: 115,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
    audioSystem.playHorn();
    this.hud?.setDrivingState(veh.config.name, 0, veh.getCondition());
    if (veh.config.alarmed) {
      veh.config.alarmed = false;
      this.wantedSystem?.reportAlarmedVehicleEntry(veh.config.name);
    } else {
      this.hud?.showToast(`Driving ${veh.config.name} · Press E or EXIT to step out.`);
    }
    this.interactionSystem?.startCooldown(`veh_${vehicleId}`, 450);
  }

  private exitActiveVehicle(): void {
    if (!this.player || !this.activeVehicle || !this.worldSystem) return;
    const veh = this.activeVehicle;
    const exitPos = veh.findSafeExitPosition(this.worldSystem);
    veh.stopImmediately();
    veh.setOccupied(false);

    this.activeVehicle = null;
    this.player.setDriving(false);
    this.player.sprite.setPosition(exitPos.x, exitPos.y);
    this.player.setDirection('down');

    const collider = this.vehiclePlayerColliders.get(veh.config.id);
    if (collider) collider.active = true;

    this.cameraSystem?.followTarget(this.player.sprite);
    this.tweens.add({
      targets: veh.sprite,
      scaleX: 1.05,
      scaleY: 0.95,
      duration: 100,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
    audioSystem.playDoor();
    this.hud?.setDrivingState(null, 0);
    this.interactionSystem?.startCooldown(`veh_${veh.config.id}`, 500);
  }

  private enterBuilding(buildingId: string, doorX: number, doorY: number): void {
    if (this.enteringBuilding || this.returningToMenu) return;
    this.enteringBuilding = true;
    this.closeAllModals();
    this.player?.stopImmediately();
    audioSystem.playDoor();

    const rawReturnX = Math.round(doorX);
    const rawReturnY = Math.round(doorY + 8);
    const returnPos: SavedPosition =
      this.worldSystem && this.worldSystem.isWalkablePosition(rawReturnX, rawReturnY)
        ? {x: rawReturnX, y: rawReturnY, direction: 'down'}
        : {x: Math.round(doorX), y: Math.round(doorY), direction: 'down'};

    saveSystem.updatePosition(returnPos);
    void cloudSaveManager.flushNow(true);

    const ownedProp = propertySystem.getOwnedPropertyForBuilding(buildingId);

    const launchInterior = async () => {
      try {
        let propertyDeedId: string | undefined;
        let propertyOwnerUid: string | undefined;
        if (ownedProp) {
          const deed = await propertySystem.getOrCreateOwnDeed(ownedProp.id);
          if (deed) {
            propertyDeedId = deed.deedId;
            propertyOwnerUid = deed.ownerUid;
          }
        }
        if (!this.sys?.isActive() || this.returningToMenu) return;
        this.scene.start(SCENE_KEYS.INTERIOR, {
          buildingId,
          returnPos,
          propertyDeedId,
          propertyOwnerUid,
          readOnlyVisitor: false,
        });
      } catch {
        if (this.sys?.isActive()) {
          this.enteringBuilding = false;
        }
      }
    };

    if (this.worldSystem) {
      this.worldSystem.animateBuildingDoorOpen(buildingId, () => {
        void launchInterior();
      });
    } else {
      void launchInterior();
    }
  }

  private enterPropertyInterior(
    prop: PropertyDef,
    deed: PropertyDeed,
    readOnlyVisitor: boolean,
  ): void {
    if (this.enteringBuilding || this.returningToMenu) return;
    this.enteringBuilding = true;
    this.closeAllModals();
    this.player?.stopImmediately();
    this.persistCurrentPosition();
    const st = this.player?.getEntityState();
    const returnPos: SavedPosition = st
      ? {x: Math.round(st.x), y: Math.round(st.y), direction: st.direction}
      : {x: Math.round(prop.exteriorX), y: Math.round(prop.exteriorY + 8), direction: 'down'};
    saveSystem.updatePosition(returnPos);
    void cloudSaveManager.flushNow(true);
    this.scene.start(SCENE_KEYS.INTERIOR, {
      buildingId: prop.buildingId,
      returnPos,
      propertyDeedId: deed.deedId,
      propertyOwnerUid: deed.ownerUid,
      readOnlyVisitor,
    });
  }

  private async acceptPropertyInvite(deedId: string): Promise<void> {
    if (this.acceptingPropertyInvite || this.enteringBuilding || this.returningToMenu) return;
    this.acceptingPropertyInvite = true;
    try {
      const deed = await propertySystem.loadDeed(deedId, true);
      if (!this.sys?.isActive() || this.enteringBuilding || this.returningToMenu) return;
      if (!deed) {
        this.hud?.showToast('Unable to access invited residence right now.', 3200);
        return;
      }
      const prop = getPropertyById(deed.propertyId);
      if (!prop) return;
      const selfUid = authSystem.getCurrentUser()?.uid;
      this.enterPropertyInterior(prop, deed, deed.ownerUid !== selfUid);
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

  private syncRemotePlayers(players: RemotePlayerState[]): void {
    const activeOutside = new Set<string>();
    const settings = saveSystem.getState().settings;
    const shadowsOn = settings.shadowsEnabled && !settings.performanceMode;

    for (const p of players) {
      if (p.interiorId) continue;
      activeOutside.add(p.uid);
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
      if (!activeOutside.has(uid)) {
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

  private launchSharedLobbyActivity(lob: SharedActivityLobby): void {
    this.activeSharedLobby = lob;
    this.closeAllModals();
    const id = lob.activityId;
    if (id === 'streetball') {
      this.activityModal?.openBasketballMiniGame('Shared Lobby · Streetball', 'Multiplayer Match');
    } else if (id === 'soccer_penalty') {
      this.activityModal?.openSoccerMiniGame('Shared Lobby · Penalty Shootout', 'Multiplayer Match');
    } else if (id === 'fountain_flip') {
      this.cutsceneOverlay?.openFountainCoinFlip('Shared Lobby · Lucky Fountain', (s) => {
        this.notifyProgression(s);
        this.completeSharedLobbyIfActive(110);
      });
    } else if (
      id === 'starlight_drift' ||
      id === 'brick_blitz' ||
      id === 'turbo_lane_racer' ||
      id === 'hoop_frenzy' ||
      id === 'reflex_surge' ||
      id === 'prism_match' ||
      id === 'memory_matrix'
    ) {
      this.arcadeModal?.open(id as ArcadeGameId);
    } else {
      this.miniGamesModal?.openHub();
    }
  }

  private completeSharedLobbyIfActive(baseScore: number): void {
    const lob = this.activeSharedLobby;
    if (!lob) return;
    this.activeSharedLobby = null;
    multiplayerClient.finishLobby(lob.lobbyId, baseScore);
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
    this.refreshObjectiveBanner();
  }

  private startBoulevardRaceTrial(): void {
    this.timedCheckpoints = [
      {x: 52.5 * TILE_SIZE, y: 28.5 * TILE_SIZE, label: 'East Boulevard Junction'},
      {x: 52.5 * TILE_SIZE, y: 51.5 * TILE_SIZE, label: 'Entertainment South Turn'},
      {x: 28.5 * TILE_SIZE, y: 51.5 * TILE_SIZE, label: 'Shopping Ave Crossroad'},
      {x: 32.5 * TILE_SIZE, y: 28.5 * TILE_SIZE, label: 'Boulevard Finish Arch'},
    ];
    this.timedElapsedSec = 0;
    this.timedChallenge = {
      kind: 'race',
      title: 'Boulevard Time Trial',
      startedAtMs: Date.now(),
      timeLimitSec: 55,
      currentStep: 0,
      totalSteps: this.timedCheckpoints.length,
      targetX: this.timedCheckpoints[0].x,
      targetY: this.timedCheckpoints[0].y,
      targetLabel: this.timedCheckpoints[0].label,
    };
    this.refreshObjectiveBanner();
    this.hud?.showToast(
      'Boulevard Time Trial started! Hit all 4 glowing checkpoints (spawn or grab a car!) within 55s.',
      4200,
    );
  }

  private startParkAgilitySprint(): void {
    this.timedCheckpoints = [
      {x: 40.5 * TILE_SIZE, y: 19.0 * TILE_SIZE, label: 'South Cobble Walk'},
      {x: 33.5 * TILE_SIZE, y: 15.5 * TILE_SIZE, label: 'West Park Gate'},
      {x: 40.5 * TILE_SIZE, y: 6.0 * TILE_SIZE, label: 'North Park Promenade'},
      {x: 47.5 * TILE_SIZE, y: 15.5 * TILE_SIZE, label: 'East Park Gate'},
    ];
    this.timedElapsedSec = 0;
    this.timedChallenge = {
      kind: 'park_sprint',
      title: 'Park Agility Sprint',
      startedAtMs: Date.now(),
      timeLimitSec: 40,
      currentStep: 0,
      totalSteps: this.timedCheckpoints.length,
      targetX: this.timedCheckpoints[0].x,
      targetY: this.timedCheckpoints[0].y,
      targetLabel: this.timedCheckpoints[0].label,
    };
    this.refreshObjectiveBanner();
    this.hud?.showToast(
      'Park Agility Sprint active! Dash through all 4 cobblestone checkpoint rings in 40s!',
      3800,
    );
  }

  private startExpressDelivery(): void {
    const candidateIds = [
      'b_cafe',
      'b_clothing',
      'b_grocery',
      'b_arcade',
      'b_cinema',
      'b_salon',
      'b_restaurant',
      'b_garage',
    ];
    const buildings = this.mapData?.buildings.filter((b) => candidateIds.includes(b.id)) ?? [];
    const chosen =
      buildings.length > 0
        ? buildings[Math.floor(Math.random() * buildings.length)]
        : null;
    const target = chosen
      ? {
          x: chosen.doorTileX * TILE_SIZE,
          y: chosen.doorTileY * TILE_SIZE + 8,
          label: chosen.label,
        }
      : {x: 46.5 * TILE_SIZE, y: 37.8 * TILE_SIZE, label: 'Pixel Palace Arcade'};

    this.timedCheckpoints = [target];
    this.timedElapsedSec = 0;
    this.timedChallenge = {
      kind: 'delivery',
      title: 'Express Courier Delivery',
      startedAtMs: Date.now(),
      timeLimitSec: 50,
      currentStep: 0,
      totalSteps: 1,
      targetX: target.x,
      targetY: target.y,
      targetLabel: target.label,
    };
    this.refreshObjectiveBanner();
    this.hud?.showToast(
      `Express Parcel picked up! Deliver to ${target.label} within 50 seconds!`,
      4200,
    );
  }

  private cancelTimedChallenge(showMsg: boolean): void {
    if (!this.timedChallenge) return;
    const title = this.timedChallenge.title;
    this.timedChallenge = null;
    this.timedCheckpoints = [];
    this.checkpointRingGfx?.clear();
    this.refreshObjectiveBanner();
    if (showMsg) {
      this.hud?.showToast(`Cancelled ${title}.`);
    }
  }

  private updateTimedChallenge(dtSec: number, timeNowMs: number, px: number, py: number): void {
    const ch = this.timedChallenge;
    if (!ch || !this.checkpointRingGfx) {
      this.checkpointRingGfx?.clear();
      return;
    }

    this.timedElapsedSec += dtSec;
    const remaining = Math.max(0, ch.timeLimitSec - this.timedElapsedSec);

    if (remaining <= 0) {
      audioSystem.playError();
      const title = ch.title;
      this.timedChallenge = null;
      this.timedCheckpoints = [];
      this.checkpointRingGfx.clear();
      this.refreshObjectiveBanner();
      this.hud?.showToast(`Time's up on ${title}! Return to start marker to retry.`, 4000);
      return;
    }

    // Draw pulsing ground checkpoint beacon
    const pulse = 1 + Math.sin(timeNowMs * 0.008) * 0.14;
    const radius = (ch.kind === 'race' ? 48 : 34) * pulse;
    const ringColor = ch.kind === 'race' ? 0xfbbf24 : ch.kind === 'delivery' ? 0x38bdf8 : 0x34d399;
    this.checkpointRingGfx.clear();
    this.checkpointRingGfx.lineStyle(4, ringColor, 0.9);
    this.checkpointRingGfx.strokeCircle(ch.targetX, ch.targetY, radius);
    this.checkpointRingGfx.fillStyle(ringColor, 0.18);
    this.checkpointRingGfx.fillCircle(ch.targetX, ch.targetY, radius * 0.72);

    const dist = Math.hypot(px - ch.targetX, py - ch.targetY);
    const triggerRadius = ch.kind === 'race' ? 78 : 56;
    if (dist <= triggerRadius) {
      const nextStep = ch.currentStep + 1;
      if (nextStep < this.timedCheckpoints.length) {
        const nextCp = this.timedCheckpoints[nextStep];
        this.timedChallenge = {
          ...ch,
          currentStep: nextStep,
          targetX: nextCp.x,
          targetY: nextCp.y,
          targetLabel: nextCp.label,
        };
        audioSystem.playInteract();
        this.refreshObjectiveBanner();
        this.hud?.showToast(
          `Checkpoint ${nextStep}/${ch.totalSteps}! Next: ${nextCp.label}`,
          2200,
        );
      } else {
        // Finished timed challenge!
        let summary: ProgressionAwardSummary;
        if (ch.kind === 'race') {
          summary = economySystem.recordRaceCompleted(this.timedElapsedSec);
        } else if (ch.kind === 'park_sprint') {
          summary = economySystem.recordParkSprintCompleted(this.timedElapsedSec);
        } else {
          summary = economySystem.recordDeliveryCompleted(remaining);
        }
        audioSystem.playCoin();
        this.player?.playActionAnimation('celebrate');
        this.timedChallenge = null;
        this.timedCheckpoints = [];
        this.checkpointRingGfx.clear();
        this.hud?.showToast(
          `${ch.title} COMPLETE (${this.timedElapsedSec.toFixed(1)}s)! +${summary.coinsAwarded} Coins · +${summary.xpAwarded} XP`,
          4200,
        );
        this.notifyProgression(summary);
      }
    }
  }

  private getActiveWaypointTarget(): {x: number; y: number; label: string} | null {
    if (this.timedChallenge) {
      return {
        x: this.timedChallenge.targetX,
        y: this.timedChallenge.targetY,
        label: this.timedChallenge.targetLabel,
      };
    }
    if (this.customWaypoint) {
      return this.customWaypoint;
    }
    if (gameSessionManager.isStoryMode()) {
      const storySnap = economySystem.getStoryCampaignSnapshot();
      if (storySnap.mission) {
        if (storySnap.accepted && !storySnap.complete && storySnap.mission.targetMarker) {
          return storySnap.mission.targetMarker;
        }
        return MISSION_HOUSE_COORDS;
      }
    }
    const activeId = economySystem.getActiveMissionId();
    if (activeId) {
      const def = FULL_MISSIONS.find((m) => m.id === activeId);
      const save = saveSystem.getState();
      if (def && !save.claimedRewards.includes(`mission_reward_${def.id}`)) {
        return {
          x: def.targetMarker.x,
          y: def.targetMarker.y,
          label: def.targetMarker.label,
        };
      }
    }
    return null;
  }

  private refreshObjectiveBanner(): void {
    if (!this.hud) return;
    if (this.timedChallenge) {
      const rem = Math.max(0, Math.ceil(this.timedChallenge.timeLimitSec - this.timedElapsedSec));
      this.hud.setObjectiveBanner({
        title: `${this.timedChallenge.title} · ${rem}s (${this.timedChallenge.currentStep + 1}/${this.timedChallenge.totalSteps})`,
        detail: `Target: ${this.timedChallenge.targetLabel}`,
        isTimed: true,
      });
      return;
    }
    if (this.customWaypoint) {
      this.hud.setObjectiveBanner({
        title: 'GPS Waypoint',
        detail: this.customWaypoint.label,
        isTimed: false,
      });
      return;
    }
    if (gameSessionManager.isStoryMode()) {
      const storySnap = economySystem.getStoryCampaignSnapshot();
      if (storySnap.mission) {
        const stg = storySnap.mission.stage;
        const detail = !storySnap.accepted
          ? `Visit The Mission House (Downtown) · ${storySnap.mission.title}`
          : storySnap.complete
            ? `${storySnap.mission.title} READY — Return to The Mission House!`
            : `${storySnap.mission.title} (${storySnap.cur}/${storySnap.goal}) · ${storySnap.detail}`;
        this.hud.setObjectiveBanner({
          title: `STORY · STAGE ${stg}/7`,
          detail,
          isTimed: false,
        });
        return;
      }
    }
    const activeId = economySystem.getActiveMissionId();
    const def = activeId ? FULL_MISSIONS.find((m) => m.id === activeId) : null;
    if (def) {
      const st = saveSystem.getState();
      if (!st.claimedRewards.includes(`mission_reward_${def.id}`)) {
        const prog = def.getProgress(st);
        const detail =
          prog >= def.goal
            ? `${def.title} READY! Open Journal [J] to claim!`
            : `${def.title} (${prog}/${def.goal}) · ${def.targetMarker.label}`;
        this.hud.setObjectiveBanner({
          title: 'Active Mission',
          detail,
          isTimed: false,
        });
        return;
      }
    }
    this.hud.setObjectiveBanner(null);
  }

  private closeAllModals(
    except?:
      | 'journal'
      | 'minigames'
      | 'phone'
      | 'inventory'
      | 'map'
      | 'garage'
      | 'activity'
      | 'arcade'
      | 'social'
      | 'friends'
      | 'property'
      | 'profile',
  ): void {
    if (except !== 'journal') this.journalModal?.close();
    if (except !== 'minigames') this.miniGamesModal?.close();
    if (except !== 'phone') this.phoneModal?.close();
    if (except !== 'inventory') this.inventoryModal?.close();
    if (except !== 'map') this.mapOverlay?.close();
    if (except !== 'garage') this.garageModal?.close();
    if (except !== 'activity') this.activityModal?.close();
    if (except !== 'arcade') this.arcadeModal?.close();
    if (except !== 'social') this.socialModal?.close();
    if (except !== 'friends') this.friendsModal?.close();
    if (except !== 'property') this.propertyModal?.close();
    if (except !== 'profile') this.profileModal?.close();
    this.cutsceneOverlay?.close();
    this.hud?.closeInteractionPanel();
    this.keyboard?.clearQueuedActions();
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
    const st = this.player?.getEntityState();
    const joinPayload = {
      roomId: res.server.id,
      roomName: res.server.name,
      roomCode: res.server.roomCode,
      visibility: res.server.visibility,
      hostUid: res.server.hostUid,
      hostUsername: res.server.hostUsername,
      maxPlayers: res.server.maxPlayers,
      password,
    };
    gameSessionManager.enterMultiplayerMode(joinPayload);
    multiplayerClient.disconnect(true);
    for (const rp of this.remotePlayersMap.values()) rp.destroy();
    this.remotePlayersMap.clear();
    await multiplayerClient.connect(
      joinPayload.roomId,
      {
        x: st?.x ?? 20 * TILE_SIZE,
        y: st?.y ?? 20 * TILE_SIZE,
        interiorId: null,
        propertyDeedId: null,
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

  private cyclePlayerOutfit(): {appearanceId: string; presetName: string} {
    const save = saveSystem.getState();
    const idx = CHARACTER_PRESETS.findIndex((p) => p.id === save.appearanceId);
    const nextPreset = CHARACTER_PRESETS[(idx + 1) % CHARACTER_PRESETS.length];
    saveSystem.updateAppearance(nextPreset.id);
    this.player?.applyAppearance(nextPreset.id, save.playerName);
    this.hud?.setPlayerInfo(nextPreset.id, save.playerName);
    multiplayerClient.syncProfile();
    return {appearanceId: nextPreset.id, presetName: nextPreset.name};
  }

  private toggleMap(): void {
    if (!this.mapOverlay || !this.player) return;
    if (this.mapOverlay.isOpen()) {
      this.mapOverlay.close();
    } else {
      this.closeAllModals('map');
      const st = this.player.getEntityState();
      this.mapOverlay.open(
        st.x,
        st.y,
        getDistrictAtWorldPos(st.x, st.y).name,
        this.npcs.map((n) => ({x: n.sprite.x, y: n.sprite.y})),
        this.getMapExtras(),
      );
    }
  }

  private pauseGame(showPauseMenu: boolean): void {
    if (this.isPaused && !showPauseMenu) return;
    this.isPaused = true;
    this.physics.pause();
    this.keyboard?.clearHeldKeys();
    this.touchController?.reset();
    this.persistCurrentPosition();
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
    if (this.returningToMenu || this.enteringBuilding) return;
    this.returningToMenu = true;
    this.closeAllModals();
    this.persistCurrentPosition();
    void cloudSaveManager.flushNow(true);
    gameSessionManager.leaveToMenu(openHub);
    this.physics.resume();
    this.scene.start(SCENE_KEYS.MAIN_MENU);
  }

  private applySettings(settings: GameSettings): void {
    this.cameraSystem?.setZoom(settings.cameraZoom, true);
    this.worldSystem?.applyGraphicsSettings(settings);
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

  private persistCurrentPosition(): void {
    if (!this.player || !this.worldSystem) return;
    if (this.player.getIsSitting()) return;
    if (this.activeVehicle) {
      const safe = this.activeVehicle.findSafeExitPosition(this.worldSystem);
      saveSystem.updatePosition({
        x: Math.round(safe.x),
        y: Math.round(safe.y),
        direction: 'down',
      });
      return;
    }
    const st = this.player.getEntityState();
    if (this.worldSystem.isWalkablePosition(st.x, st.y)) {
      saveSystem.updatePosition({
        x: Math.round(st.x),
        y: Math.round(st.y),
        direction: st.direction,
      });
    }
  }

  private cleanup(): void {
    window.removeEventListener('resize', this.onResizeBound);
    window.removeEventListener('beforeunload', this.onBeforeUnloadBound);
    this.unsubFullscreen?.();
    this.unsubFullscreen = null;
    this.unsubEconomy?.();
    this.unsubEconomy = null;
    this.unsubMpPlayers?.();
    this.unsubMpPlayers = null;
    this.unsubMpEmote?.();
    this.unsubMpEmote = null;
    this.unsubMpNotice?.();
    this.unsubMpNotice = null;
    this.unsubMpLobbyStart?.();
    this.unsubMpLobbyStart = null;
    this.unsubMpStatus?.();
    this.unsubMpStatus = null;
    this.unsubMpRoomClosed?.();
    this.unsubMpRoomClosed = null;
    if (this.fsResizeTimer !== null) {
      window.clearTimeout(this.fsResizeTimer);
      this.fsResizeTimer = null;
    }

    for (const rp of this.remotePlayersMap.values()) {
      rp.destroy();
    }
    this.remotePlayersMap.clear();

    this.keyboard?.destroy();
    this.keyboard = null;
    this.touchController?.destroy();
    this.touchController = null;
    this.hud?.destroy();
    this.hud = null;
    this.inventoryModal?.destroy();
    this.inventoryModal = null;
    this.activityModal?.destroy();
    this.activityModal = null;
    this.arcadeModal?.destroy();
    this.arcadeModal = null;
    this.cutsceneOverlay?.destroy();
    this.cutsceneOverlay = null;
    this.miniGamesModal?.destroy();
    this.miniGamesModal = null;
    this.journalModal?.destroy();
    this.journalModal = null;
    this.checkpointRingGfx?.destroy();
    this.checkpointRingGfx = null;
    this.mapOverlay?.destroy();
    this.mapOverlay = null;
    this.pauseMenu?.destroy();
    this.pauseMenu = null;
    this.settingsModal?.destroy();
    this.settingsModal = null;
    this.garageModal?.destroy();
    this.garageModal = null;
    this.phoneModal?.destroy();
    this.phoneModal = null;
    this.socialModal?.destroy();
    this.socialModal = null;
    this.friendsModal?.destroy();
    this.friendsModal = null;
    this.propertyModal?.destroy();
    this.propertyModal = null;
    this.profileModal?.destroy();
    this.profileModal = null;
    this.interactionSystem?.destroy();
    this.interactionSystem = null;
    this.wantedSystem?.destroy();
    this.wantedSystem = null;
    this.cityEventSystem?.destroy();
    this.cityEventSystem = null;
    this.weatherSystem?.destroy();
    this.weatherSystem = null;
    this.trafficSystem?.destroy();
    this.trafficSystem = null;
    this.activeVehicle = null;
    this.spawnedPersonalVehicle = null;
    this.vehiclePlayerColliders.clear();
    this.vehicleAllColliders.clear();
    for (const v of this.vehicles) {
      v.destroy();
    }
    this.vehicles = [];
    this.player?.destroy();
    this.player = null;
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
