import {saveSystem} from '@/src/game/systems/SaveSystem';
import {InputSnapshot} from '@/src/game/types/gameTypes';

export class KeyboardController {
  private heldKeys = new Set<string>();
  private queuedInteract = false;
  private queuedMap = false;
  private queuedPause = false;
  private queuedInventory = false;
  private queuedPhone = false;
  private queuedJournal = false;
  private queuedEmote = false;

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.defaultPrevented) return;
    const target = e.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
      return;
    }

    const code = e.code;
    const kb = saveSystem.getState().settings.keybinds;
    if (!this.heldKeys.has(code)) {
      if (code === kb.interact || code === 'Space') {
        this.queuedInteract = true;
      } else if (code === kb.map) {
        this.queuedMap = true;
      } else if (code === 'KeyI' || code === 'KeyB') {
        this.queuedInventory = true;
      } else if (code === kb.phone) {
        this.queuedPhone = true;
      } else if (code === 'KeyJ') {
        this.queuedJournal = true;
      } else if (code === kb.emote) {
        this.queuedEmote = true;
      } else if (code === 'Escape') {
        this.queuedPause = true;
      }
    }
    this.heldKeys.add(code);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private readonly onBlur = (): void => {
    this.clearHeldKeys();
  };

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onBlur);
  }

  public clearHeldKeys(): void {
    this.heldKeys.clear();
  }

  public clearQueuedActions(): void {
    this.queuedInteract = false;
    this.queuedMap = false;
    this.queuedPause = false;
    this.queuedInventory = false;
    this.queuedPhone = false;
    this.queuedJournal = false;
    this.queuedEmote = false;
  }

  public consumeSnapshot(): InputSnapshot & {
    inventoryJustPressed: boolean;
    phoneJustPressed: boolean;
    journalJustPressed: boolean;
    emoteJustPressed: boolean;
  } {
    const kb = saveSystem.getState().settings.keybinds;
    let moveX = 0;
    let moveY = 0;

    if (this.heldKeys.has(kb.moveLeft) || this.heldKeys.has('ArrowLeft')) moveX -= 1;
    if (this.heldKeys.has(kb.moveRight) || this.heldKeys.has('ArrowRight')) moveX += 1;
    if (this.heldKeys.has(kb.moveUp) || this.heldKeys.has('ArrowUp')) moveY -= 1;
    if (this.heldKeys.has(kb.moveDown) || this.heldKeys.has('ArrowDown')) moveY += 1;

    const isRunning =
      this.heldKeys.has(kb.run) ||
      this.heldKeys.has('ShiftLeft') ||
      this.heldKeys.has('ShiftRight');

    const snapshot = {
      moveX,
      moveY,
      isRunning,
      interactJustPressed: this.queuedInteract,
      mapJustPressed: this.queuedMap,
      pauseJustPressed: this.queuedPause,
      inventoryJustPressed: this.queuedInventory,
      phoneJustPressed: this.queuedPhone,
      journalJustPressed: this.queuedJournal,
      emoteJustPressed: this.queuedEmote,
    };

    this.queuedInteract = false;
    this.queuedMap = false;
    this.queuedPause = false;
    this.queuedInventory = false;
    this.queuedPhone = false;
    this.queuedJournal = false;
    this.queuedEmote = false;

    return snapshot;
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onBlur);
    this.heldKeys.clear();
  }
}
