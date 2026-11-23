import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {auth, db, isFirebaseConfigured} from '@/src/firebase/firebaseApp';
import {
  buildDefaultDeed,
  getPropertyByBuildingId,
  getPropertyById,
  PROPERTIES_CATALOG,
} from '@/src/game/data/propertyData';
import {authSystem} from '@/src/game/systems/AuthSystem';
import {multiplayerClient} from '@/src/game/systems/MultiplayerClient';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {PropertyDeed} from '@/src/game/types/gameTypes';

const LOCAL_DEED_CACHE_PREFIX = 'chaos_city_deed_';

class PropertySystem {
  private memoryCache = new Map<string, PropertyDeed>();

  public makeDeedId(ownerUid: string, propertyId: string): string {
    return `${ownerUid}__${propertyId}`;
  }

  private writeLocalCache(deed: PropertyDeed): void {
    this.memoryCache.set(deed.deedId, deed);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(`${LOCAL_DEED_CACHE_PREFIX}${deed.deedId}`, JSON.stringify(deed));
      }
    } catch {
      // ignore storage quota errors
    }
  }

  private readLocalCache(deedId: string): PropertyDeed | null {
    const mem = this.memoryCache.get(deedId);
    if (mem) return mem;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(`${LOCAL_DEED_CACHE_PREFIX}${deedId}`);
        if (raw) {
          const parsed = JSON.parse(raw) as PropertyDeed;
          this.memoryCache.set(deedId, parsed);
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  public getOwnedPropertyDefs() {
    const ownedIds = saveSystem.getState().ownedProperties ?? [];
    return PROPERTIES_CATALOG.filter((p) => ownedIds.includes(p.id));
  }

  public getOwnedPropertyForBuilding(buildingId: string) {
    const prop = getPropertyByBuildingId(buildingId);
    if (!prop) return null;
    const owned = saveSystem.getState().ownedProperties ?? [];
    return owned.includes(prop.id) ? prop : null;
  }

  public async getOrCreateOwnDeed(propertyId: string): Promise<PropertyDeed | null> {
    const def = getPropertyById(propertyId);
    if (!def) return null;

    const uid = auth.currentUser?.uid || saveSystem.getState().playerId;
    const username = authSystem.getCurrentUser()?.username || saveSystem.getState().playerName || 'Resident';
    const deedId = this.makeDeedId(uid, def.id);

    const existing = await this.loadDeed(deedId, true);
    if (existing) return existing;

    const fresh = buildDefaultDeed(
      def,
      uid,
      username,
      saveSystem.getState().privacySettings.allowPropertyVisitorsDefault,
    );
    await this.saveDeed(fresh);
    return fresh;
  }

  public async loadDeed(deedId: string, forceRemote = false): Promise<PropertyDeed | null> {
    if (!deedId) return null;
    if (!forceRemote) {
      const cached = this.memoryCache.get(deedId);
      if (cached) return cached;
    }

    if (isFirebaseConfigured() && auth.currentUser) {
      try {
        const snap = await getDoc(doc(db, 'propertyDeeds', deedId));
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          const def = getPropertyById(String(data.propertyId || ''));
          const deed: PropertyDeed = {
            deedId: String(data.deedId || deedId),
            ownerUid: String(data.ownerUid || ''),
            ownerUsername: String(data.ownerUsername || 'Citizen'),
            propertyId: String(data.propertyId || def?.id || ''),
            title: String(data.title || def?.name || 'Property'),
            tier: (data.tier as PropertyDeed['tier']) || def?.tier || 'apartment',
            allowVisitors: Boolean(data.allowVisitors),
            invitedUids: Array.isArray(data.invitedUids) ? (data.invitedUids as string[]) : [],
            floorStyle: String(data.floorStyle || def?.defaultFloorStyle || 'oak'),
            wallStyle: String(data.wallStyle || def?.defaultWallStyle || 'wainscot'),
            furniture: Array.isArray(data.furniture)
              ? (data.furniture as PropertyDeed['furniture'])
              : [],
            updatedAtMs: Date.now(),
          };
          this.writeLocalCache(deed);
          return deed;
        }
      } catch {
        // Fallback to local cache if owner offline or network blocked
      }
    }

    return this.readLocalCache(deedId);
  }

  public async saveDeed(deed: PropertyDeed): Promise<boolean> {
    const nextDeed: PropertyDeed = {
      ...deed,
      updatedAtMs: Date.now(),
    };
    this.writeLocalCache(nextDeed);

    if (!isFirebaseConfigured() || !auth.currentUser || auth.currentUser.uid !== deed.ownerUid) {
      return true;
    }

    try {
      await setDoc(doc(db, 'propertyDeeds', deed.deedId), {
        deedId: nextDeed.deedId,
        ownerUid: nextDeed.ownerUid,
        ownerUsername: nextDeed.ownerUsername.slice(0, 20),
        propertyId: nextDeed.propertyId,
        title: nextDeed.title.slice(0, 60),
        tier: nextDeed.tier,
        allowVisitors: Boolean(nextDeed.allowVisitors),
        invitedUids: nextDeed.invitedUids.slice(0, 40),
        floorStyle: nextDeed.floorStyle,
        wallStyle: nextDeed.wallStyle,
        furniture: nextDeed.furniture.slice(0, 60),
        updatedAt: serverTimestamp(),
      });
      multiplayerClient.notifyPropertyUpdated(nextDeed.deedId);
      return true;
    } catch {
      return false;
    }
  }

  public async invitePlayerToProperty(propertyId: string, targetUid: string): Promise<PropertyDeed | null> {
    const deed = await this.getOrCreateOwnDeed(propertyId);
    if (!deed || !targetUid) return deed;
    if (!deed.invitedUids.includes(targetUid)) {
      const updated: PropertyDeed = {
        ...deed,
        invitedUids: [...deed.invitedUids, targetUid].slice(0, 40),
      };
      await this.saveDeed(updated);
      return updated;
    }
    return deed;
  }

  public async listPublicOpenProperties(): Promise<PropertyDeed[]> {
    if (!isFirebaseConfigured() || !auth.currentUser) return [];
    try {
      const q = query(collection(db, 'propertyDeeds'), where('allowVisitors', '==', true));
      const snap = await getDocs(q);
      const out: PropertyDeed[] = [];
      for (const d of snap.docs) {
        const data = d.data() as Record<string, unknown>;
        const ownerUid = String(data.ownerUid || '');
        if (!ownerUid || multiplayerClient.isBlocked(ownerUid)) continue;
        out.push({
          deedId: String(data.deedId || d.id),
          ownerUid,
          ownerUsername: String(data.ownerUsername || 'Citizen'),
          propertyId: String(data.propertyId || ''),
          title: String(data.title || 'Open Residence'),
          tier: (data.tier as PropertyDeed['tier']) || 'apartment',
          allowVisitors: true,
          invitedUids: Array.isArray(data.invitedUids) ? (data.invitedUids as string[]) : [],
          floorStyle: String(data.floorStyle || 'oak'),
          wallStyle: String(data.wallStyle || 'wainscot'),
          furniture: Array.isArray(data.furniture)
            ? (data.furniture as PropertyDeed['furniture'])
            : [],
          updatedAtMs: Date.now(),
        });
      }
      return out;
    } catch {
      return [];
    }
  }
}

export const propertySystem = new PropertySystem();
