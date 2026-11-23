import {TouchMode} from '@/src/game/types/gameTypes';

export interface DeviceInfo {
  isTouchCapable: boolean;
  isMobileViewport: boolean;
  isPortrait: boolean;
  supportsFullscreen: boolean;
}

export interface FullscreenResult {
  active: boolean;
  error?: string;
}

interface PrefixedDocument extends Document {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void>;
}

interface PrefixedElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
  mozRequestFullScreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as PrefixedDocument;
  return Boolean(
    doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement,
  );
}

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as PrefixedDocument;
  const el = (document.getElementById('game-root') ?? document.documentElement) as PrefixedElement | null;
  if (!el) return false;

  const hasRequestMethod = Boolean(
    el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.mozRequestFullScreen ||
      el.msRequestFullscreen,
  );
  if (!hasRequestMethod) return false;

  if (typeof doc.fullscreenEnabled === 'boolean') return doc.fullscreenEnabled;
  if (typeof doc.webkitFullscreenEnabled === 'boolean') return doc.webkitFullscreenEnabled;
  return true;
}

export function detectDevice(): DeviceInfo {
  const hasTouch =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
      window.matchMedia('(pointer: coarse)').matches);

  const width = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const height = typeof window !== 'undefined' ? window.innerHeight : 720;
  const isMobileViewport = Math.min(width, height) <= 760 || (hasTouch && width <= 1024);
  const isPortrait = height > width;

  return {
    isTouchCapable: hasTouch,
    isMobileViewport,
    isPortrait,
    supportsFullscreen: isFullscreenSupported(),
  };
}

export function shouldShowTouchControls(mode: TouchMode, userUsedTouch: boolean): boolean {
  if (mode === 'always') return true;
  if (mode === 'off') return false;
  const info = detectDevice();
  return info.isTouchCapable || info.isMobileViewport || userUsedTouch;
}

export async function toggleFullscreen(): Promise<FullscreenResult> {
  if (typeof document === 'undefined') {
    return {active: false, error: 'Fullscreen is unavailable in this environment.'};
  }

  const doc = document as PrefixedDocument;
  const target = (document.getElementById('game-root') ??
    document.documentElement) as PrefixedElement;

  if (!isFullscreenSupported()) {
    return {
      active: false,
      error: 'Fullscreen is not supported or is restricted by this browser window.',
    };
  }

  try {
    if (isFullscreenActive()) {
      if (doc.exitFullscreen) await doc.exitFullscreen();
      else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      return {active: false};
    }

    if (target.requestFullscreen) {
      await target.requestFullscreen({navigationUI: 'hide'});
    } else if (target.webkitRequestFullscreen) {
      await target.webkitRequestFullscreen();
    } else if (target.mozRequestFullScreen) {
      await target.mozRequestFullScreen();
    } else if (target.msRequestFullscreen) {
      await target.msRequestFullscreen();
    }

    // Attempt landscape orientation hint only if supported and permitted by device/browser
    try {
      const orientation = screen?.orientation as ScreenOrientation & {
        lock?: (mode: string) => Promise<void>;
      };
      if (orientation && typeof orientation.lock === 'function' && detectDevice().isTouchCapable) {
        await orientation.lock('landscape').catch(() => undefined);
      }
    } catch {
      // Orientation lock is optional and not supported on all browsers
    }

    return {active: isFullscreenActive()};
  } catch {
    return {
      active: isFullscreenActive(),
      error: 'Fullscreen permission was blocked or declined by the browser.',
    };
  }
}

export function onFullscreenChange(callback: (active: boolean) => void): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const handler = () => callback(isFullscreenActive());
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
  };
}
