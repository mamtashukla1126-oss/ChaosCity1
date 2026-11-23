import {doc, getDoc} from 'firebase/firestore';
import {db, isFirebaseConfigured} from '@/src/firebase/firebaseApp';

export interface OwnerConfigRecord {
  ownerUid: string;
  normalizedUsername: string;
  loaded: boolean;
}

class OwnerBadgeService {
  private config: OwnerConfigRecord = {
    ownerUid: '',
    normalizedUsername: 'owneranant',
    loaded: false,
  };
  private serverVerifiedUids = new Set<string>();
  private loadingPromise: Promise<OwnerConfigRecord> | null = null;

  public async refreshOwnerConfig(): Promise<OwnerConfigRecord> {
    if (!isFirebaseConfigured()) {
      return this.config;
    }
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      try {
        const snap = await getDoc(doc(db, 'systemConfig', 'owner'));
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          this.config = {
            ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid.trim() : '',
            normalizedUsername:
              typeof data.normalizedUsername === 'string' && data.normalizedUsername.trim()
                ? data.normalizedUsername.trim().toLowerCase()
                : 'owneranant',
            loaded: true,
          };
        } else {
          this.config = {...this.config, loaded: true};
        }
      } catch {
        // Missing permissions before sign-in or unprovisioned doc -> keep verified set strict & empty
        this.config = {...this.config, loaded: false};
      } finally {
        this.loadingPromise = null;
      }
      return this.config;
    })();

    return this.loadingPromise;
  }

  public setServerVerifiedOwner(uid: string, verified: boolean): void {
    if (!uid) return;
    if (verified) {
      this.serverVerifiedUids.add(uid);
    } else {
      this.serverVerifiedUids.delete(uid);
    }
  }

  public clearCache(): void {
    this.serverVerifiedUids.clear();
  }

  /**
   * Authoritative check: NEVER grants badge from username alone or client localStorage.
   * Requires EITHER verified backend/WS server flag OR Firestore /systemConfig/owner UID match + normalizedUsername.
   */
  public isVerifiedOwnerAccount(
    uid?: string | null,
    username?: string | null,
    serverVerifiedFlag?: boolean,
  ): boolean {
    if (!uid || !username) return false;
    const normalized = username.trim().toLowerCase();
    if (serverVerifiedFlag === true) {
      this.serverVerifiedUids.add(uid);
      return true;
    }
    if (this.serverVerifiedUids.has(uid) && normalized === this.config.normalizedUsername) {
      return true;
    }
    if (
      this.config.ownerUid &&
      uid === this.config.ownerUid &&
      normalized === this.config.normalizedUsername
    ) {
      return true;
    }
    return false;
  }

  public getStatus(): OwnerConfigRecord & {hasServerVerifiedOwner: boolean} {
    return {
      ...this.config,
      hasServerVerifiedOwner: this.serverVerifiedUids.size > 0,
    };
  }

  public renderBadgeHtml(compact = false): string {
    if (compact) {
      return `<span class="cc-owner-badge cc-owner-badge--compact" title="Verified CHAOS CITY Owner">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><path d="M3 18h18v2H3v-2zm0-2l2-9 4.5 4L12 4l2.5 7L19 7l2 9H3z"/></svg>
        <span>OWNER</span>
      </span>`;
    }
    return `<span class="cc-owner-badge" title="Verified CHAOS CITY Owner">
      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M3 18h18v2H3v-2zm0-2l2-9 4.5 4L12 4l2.5 7L19 7l2 9H3z"/></svg>
      <span>OWNER</span>
    </span>`;
  }
}

export const ownerBadgeService = new OwnerBadgeService();
