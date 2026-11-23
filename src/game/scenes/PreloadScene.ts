import Phaser from 'phaser';
import {SCENE_KEYS} from '@/src/config/constants';
import {isFirebaseConfigured, testFirestoreConnection} from '@/src/firebase/firebaseApp';
import {getInteriorArtGenerationSteps} from '@/src/game/graphics/InteriorArtGenerator';
import {getPixelArtGenerationSteps} from '@/src/game/graphics/PixelArtGenerator';
import {authSystem} from '@/src/game/systems/AuthSystem';
import {ownerBadgeService} from '@/src/game/systems/OwnerBadgeService';
import {LoadingScreen} from '@/src/game/ui/LoadingScreen';

const NEXT_FRAME = (): Promise<void> =>
  new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<{value: T; timedOut: boolean}> {
  let timerId = 0;
  try {
    const res = await Promise.race([
      promise.then((value) => ({value, timedOut: false})),
      new Promise<{value: T; timedOut: boolean}>((resolve) => {
        timerId = window.setTimeout(() => resolve({value: fallback, timedOut: true}), ms);
      }),
    ]);
    return res;
  } finally {
    if (timerId) window.clearTimeout(timerId);
  }
}

export class PreloadScene extends Phaser.Scene {
  private loaderUI: LoadingScreen | null = null;
  private cancelled = false;
  private transitioning = false;

  constructor() {
    super({key: SCENE_KEYS.PRELOAD});
  }

  public create(): void {
    this.cancelled = false;
    this.transitioning = false;

    const uiOverlay = document.getElementById('ui-overlay') ?? document.body;
    this.loaderUI = new LoadingScreen(uiOverlay, {
      onRetryCloud: () => {
        void this.verifyCloudAndProceed();
      },
      onContinueOffline: () => {
        void this.finishAndEnterMenu('Starting in offline local backup mode...');
      },
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    void this.runBootSequence();
  }

  private async runBootSequence(): Promise<void> {
    if (!this.loaderUI || this.cancelled) return;

    this.loaderUI.setProgress(4, 'Initializing pixel-art engine...', 'Preparing procedural textures');
    await NEXT_FRAME();
    if (this.cancelled || !this.loaderUI) return;

    const pixelSteps = getPixelArtGenerationSteps(this);
    const interiorSteps = getInteriorArtGenerationSteps(this);
    const allSteps = [...pixelSteps, ...interiorSteps];
    const total = Math.max(1, allSteps.length);

    for (let i = 0; i < allSteps.length; i++) {
      if (this.cancelled || !this.loaderUI) return;
      const step = allSteps[i];
      const pct = 8 + Math.round(((i + 0.5) / total) * 64);
      this.loaderUI.setProgress(pct, step.label, `Asset batch ${i + 1} of ${total}`);
      await NEXT_FRAME();
      if (this.cancelled || !this.loaderUI) return;
      step.run();
    }

    await this.verifyCloudAndProceed();
  }

  private async verifyCloudAndProceed(): Promise<void> {
    if (this.cancelled || !this.loaderUI) return;

    if (!isFirebaseConfigured()) {
      this.loaderUI.setProgress(92, 'Local storage ready...', 'Offline mode active');
      await NEXT_FRAME();
      await this.finishAndEnterMenu('Ready to enter CHAOS CITY');
      return;
    }

    this.loaderUI.setProgress(78, 'Connecting to Firebase Auth...', 'Checking resident session');
    const authInit = await withTimeout(
      authSystem
        .initAuthListener()
        .then(() => ({ok: true}))
        .catch(() => ({ok: false})),
      7000,
      {ok: false},
    );
    if (this.cancelled || !this.loaderUI) return;

    if (authInit.timedOut || !authInit.value.ok) {
      this.loaderUI.setProgress(82, 'Cloud session check delayed', 'Connection slow or unavailable');
      this.loaderUI.showError(
        'Unable to reach CHAOS CITY authentication within 7 seconds. You can retry cloud verification or continue in offline local mode.',
        true,
      );
      return;
    }

    this.loaderUI.setProgress(88, 'Verifying Firestore & owner registry...', 'Checking cloud save state');
    const [connected] = await Promise.all([
      withTimeout(testFirestoreConnection(), 4500, false),
      withTimeout(ownerBadgeService.refreshOwnerConfig(), 3500, null),
    ]);
    if (this.cancelled || !this.loaderUI) return;

    const activeUser = authSystem.getCurrentUser();
    if (!connected.value || connected.timedOut) {
      if (activeUser) {
        this.loaderUI.showError(
          `Signed in as @${activeUser.username}, but Cloud Firestore is currently unreachable. Retry cloud load or continue with your local backup.`,
          true,
        );
        return;
      }
      await this.finishAndEnterMenu('Cloud offline · Local backup ready');
      return;
    }

    if (activeUser && authSystem.getLastHydrateError()) {
      this.loaderUI.showError(
        authSystem.getLastHydrateError() ?? 'Could not restore your cloud save from Firestore.',
        true,
      );
      return;
    }

    await this.finishAndEnterMenu(
      activeUser ? `Cloud save restored for @${activeUser.username}` : 'City world ready',
    );
  }

  private async finishAndEnterMenu(subLabel: string): Promise<void> {
    if (this.cancelled || this.transitioning || !this.loaderUI) return;
    this.transitioning = true;
    this.loaderUI.setProgress(100, 'Welcome to CHAOS CITY', subLabel);
    await new Promise<void>((r) => window.setTimeout(r, 180));
    if (this.cancelled) return;
    await this.loaderUI?.fadeOutAndDestroy();
    this.loaderUI = null;
    if (!this.cancelled && this.sys?.isActive()) {
      this.scene.start(SCENE_KEYS.MAIN_MENU);
    }
  }

  private cleanup(): void {
    this.cancelled = true;
    this.loaderUI?.destroy();
    this.loaderUI = null;
  }
}
