import {multiplayerClient} from '@/src/game/systems/MultiplayerClient';
import {GameMode, PendingMultiplayerJoin} from '@/src/game/types/gameTypes';

class GameSessionManager {
  private mode: GameMode = 'story';
  private pendingJoin: PendingMultiplayerJoin | null = null;
  private returnToMainMenuAction: 'none' | 'open_multiplayer_hub' | 'open_friends' = 'none';
  private listeners = new Set<(mode: GameMode) => void>();

  public getMode(): GameMode {
    return this.mode;
  }

  public isStoryMode(): boolean {
    return this.mode === 'story';
  }

  public isMultiplayer(): boolean {
    return this.mode === 'multiplayer';
  }

  public getPendingJoin(): PendingMultiplayerJoin | null {
    return this.pendingJoin ? {...this.pendingJoin} : null;
  }

  public clearPendingJoin(): void {
    this.pendingJoin = null;
  }

  public setReturnToMainMenuAction(action: 'none' | 'open_multiplayer_hub' | 'open_friends'): void {
    this.returnToMainMenuAction = action;
  }

  public consumeReturnToMainMenuAction(): 'none' | 'open_multiplayer_hub' | 'open_friends' {
    const next = this.returnToMainMenuAction;
    this.returnToMainMenuAction = 'none';
    return next;
  }

  public enterStoryMode(): void {
    this.mode = 'story';
    this.pendingJoin = null;
    multiplayerClient.disconnect(true);
    this.emit();
  }

  public enterMultiplayerMode(joinTarget: PendingMultiplayerJoin): void {
    this.mode = 'multiplayer';
    this.pendingJoin = {...joinTarget};
    this.emit();
  }

  public leaveToMenu(openHub = false): void {
    const wasMp = this.mode === 'multiplayer';
    this.pendingJoin = null;
    this.mode = 'story';
    multiplayerClient.disconnect(true);
    this.returnToMainMenuAction = openHub || wasMp ? 'open_multiplayer_hub' : 'none';
    this.emit();
  }

  public subscribe(fn: (mode: GameMode) => void): () => void {
    this.listeners.add(fn);
    fn(this.mode);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    for (const fn of this.listeners) {
      fn(this.mode);
    }
  }
}

export const gameSessionManager = new GameSessionManager();
