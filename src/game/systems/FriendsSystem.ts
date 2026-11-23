import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {auth, db, isFirebaseConfigured} from '@/src/firebase/firebaseApp';
import {authSystem} from '@/src/game/systems/AuthSystem';
import {multiplayerClient} from '@/src/game/systems/MultiplayerClient';
import {saveSystem} from '@/src/game/systems/SaveSystem';
import {FriendRecord, FriendRequestRecord, PublicPlayerProfile} from '@/src/game/types/gameTypes';

export interface SocialGraphSnapshot {
  friends: FriendRecord[];
  incomingRequests: FriendRequestRecord[];
  outgoingRequests: FriendRequestRecord[];
}

export function buildPairId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('__');
}

class FriendsSystem {
  public async getPublicProfile(targetUid: string): Promise<PublicPlayerProfile | null> {
    if (!targetUid || !isFirebaseConfigured() || !auth.currentUser) return null;
    if (multiplayerClient.isBlocked(targetUid)) return null;
    try {
      const snap = await getDoc(doc(db, 'publicProfiles', targetUid));
      if (!snap.exists()) return null;
      return snap.data() as PublicPlayerProfile;
    } catch {
      return null;
    }
  }

  public async searchByUsername(usernameInput: string): Promise<{
    found: boolean;
    uid?: string;
    username?: string;
    profile?: PublicPlayerProfile | null;
    error?: string;
  }> {
    const clean = usernameInput.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(clean)) {
      return {found: false, error: 'Enter a valid 3–20 character username.'};
    }
    if (!isFirebaseConfigured() || !auth.currentUser) {
      return {found: false, error: 'Sign in with a verified account to search players.'};
    }
    try {
      const uSnap = await getDoc(doc(db, 'usernames', clean));
      if (!uSnap.exists()) {
        return {found: false, error: `No citizen found with username "${usernameInput.trim()}".`};
      }
      const data = uSnap.data() as {uid?: string; username?: string};
      const targetUid = data.uid || '';
      if (!targetUid) {
        return {found: false, error: 'Invalid player reservation.'};
      }
      if (targetUid === auth.currentUser.uid) {
        return {found: false, error: 'That is your own account!'};
      }
      if (multiplayerClient.isBlocked(targetUid)) {
        return {found: false, error: 'This player is on your block list.'};
      }
      const profile = await this.getPublicProfile(targetUid);
      return {
        found: true,
        uid: targetUid,
        username: data.username || usernameInput.trim(),
        profile,
      };
    } catch {
      return {found: false, error: 'Could not search player registry right now.'};
    }
  }

  public async sendFriendRequest(
    targetUid: string,
    targetUsername: string,
  ): Promise<{ok: boolean; message: string}> {
    const user = auth.currentUser;
    const acct = authSystem.getCurrentUser();
    if (!user || !acct || !isFirebaseConfigured()) {
      return {ok: false, message: 'Sign in to add friends.'};
    }
    if (targetUid === user.uid) {
      return {ok: false, message: 'Cannot send a friend request to yourself.'};
    }
    if (multiplayerClient.isBlocked(targetUid)) {
      return {ok: false, message: 'Unblock this player before sending a friend request.'};
    }

    try {
      const pairId = buildPairId(user.uid, targetUid);
      const friendSnap = await getDoc(doc(db, 'friendships', pairId));
      if (friendSnap.exists()) {
        return {ok: false, message: `${targetUsername} is already on your friends list.`};
      }

      const existingQ = query(
        collection(db, 'friendRequests'),
        where('senderUid', '==', user.uid),
        where('receiverUid', '==', targetUid),
      );
      const existingSnap = await getDocs(existingQ);
      const hasPending = existingSnap.docs.some((d) => d.data().status === 'pending');
      if (hasPending) {
        return {ok: false, message: `Friend request already pending for ${targetUsername}.`};
      }

      const reverseQ = query(
        collection(db, 'friendRequests'),
        where('senderUid', '==', targetUid),
        where('receiverUid', '==', user.uid),
      );
      const reverseSnap = await getDocs(reverseQ);
      const hasIncoming = reverseSnap.docs.some((d) => d.data().status === 'pending');
      if (hasIncoming) {
        return {
          ok: false,
          message: `${targetUsername} already sent you a friend request! Accept it under Friend Requests.`,
        };
      }

      await addDoc(collection(db, 'friendRequests'), {
        senderUid: user.uid,
        senderUsername: acct.username,
        receiverUid: targetUid,
        receiverUsername: targetUsername.slice(0, 24),
        status: 'pending',
        createdAt: serverTimestamp(),
        createdAtMs: Date.now(),
      });
      return {ok: true, message: `Friend request sent to ${targetUsername}!`};
    } catch {
      return {ok: false, message: 'Could not send friend request. Check connection.'};
    }
  }

  public async acceptFriendRequest(req: FriendRequestRecord): Promise<{ok: boolean; message: string}> {
    const user = auth.currentUser;
    const acct = authSystem.getCurrentUser();
    if (!user || !acct || !isFirebaseConfigured()) {
      return {ok: false, message: 'Authentication required.'};
    }
    if (req.receiverUid !== user.uid) {
      return {ok: false, message: 'Only the recipient can accept this request.'};
    }
    try {
      const pairId = buildPairId(req.senderUid, req.receiverUid);
      await updateDoc(doc(db, 'friendRequests', req.requestId), {status: 'accepted'});
      await setDoc(doc(db, 'friendships', pairId), {
        pairId,
        uids: [req.senderUid, req.receiverUid].sort(),
        usernames: {
          [req.senderUid]: req.senderUsername,
          [req.receiverUid]: acct.username,
        },
        createdAt: serverTimestamp(),
      });
      return {ok: true, message: `You and ${req.senderUsername} are now friends!`};
    } catch {
      return {ok: false, message: 'Failed to accept friend request.'};
    }
  }

  public async declineFriendRequest(requestId: string): Promise<boolean> {
    if (!auth.currentUser || !isFirebaseConfigured()) return false;
    try {
      await updateDoc(doc(db, 'friendRequests', requestId), {status: 'declined'});
      return true;
    } catch {
      return false;
    }
  }

  public async cancelFriendRequest(requestId: string): Promise<boolean> {
    if (!auth.currentUser || !isFirebaseConfigured()) return false;
    try {
      await deleteDoc(doc(db, 'friendRequests', requestId));
      return true;
    } catch {
      return false;
    }
  }

  public async removeFriend(pairId: string): Promise<boolean> {
    if (!auth.currentUser || !isFirebaseConfigured()) return false;
    try {
      await deleteDoc(doc(db, 'friendships', pairId));
      return true;
    } catch {
      return false;
    }
  }

  public async loadSocialGraph(): Promise<SocialGraphSnapshot> {
    const user = auth.currentUser;
    if (!user || !isFirebaseConfigured()) {
      return {friends: [], incomingRequests: [], outgoingRequests: []};
    }
    try {
      const [friendSnap, inSnap, outSnap] = await Promise.all([
        getDocs(query(collection(db, 'friendships'), where('uids', 'array-contains', user.uid))),
        getDocs(query(collection(db, 'friendRequests'), where('receiverUid', '==', user.uid))),
        getDocs(query(collection(db, 'friendRequests'), where('senderUid', '==', user.uid))),
      ]);

      const incomingRequests: FriendRequestRecord[] = inSnap.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            requestId: d.id,
            senderUid: String(data.senderUid || ''),
            senderUsername: String(data.senderUsername || 'Citizen'),
            receiverUid: String(data.receiverUid || ''),
            receiverUsername: String(data.receiverUsername || 'Citizen'),
            status: (data.status as FriendRequestRecord['status']) || 'pending',
            createdAtMs: Number(data.createdAtMs || Date.now()),
          };
        })
        .filter((r) => r.status === 'pending' && !multiplayerClient.isBlocked(r.senderUid));

      const outgoingRequests: FriendRequestRecord[] = outSnap.docs
        .map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            requestId: d.id,
            senderUid: String(data.senderUid || ''),
            senderUsername: String(data.senderUsername || 'Citizen'),
            receiverUid: String(data.receiverUid || ''),
            receiverUsername: String(data.receiverUsername || 'Citizen'),
            status: (data.status as FriendRequestRecord['status']) || 'pending',
            createdAtMs: Number(data.createdAtMs || Date.now()),
          };
        })
        .filter((r) => r.status === 'pending');

      const rawFriends = friendSnap.docs.map((d) => {
        const data = d.data() as {
          uids?: string[];
          usernames?: Record<string, string>;
        };
        const uids = Array.isArray(data.uids) ? data.uids : [];
        const friendUid = uids.find((u) => u !== user.uid) || '';
        const uname = data.usernames?.[friendUid] || 'Citizen';
        return {uid: friendUid, username: uname, pairId: d.id};
      });

      const activeFriends = rawFriends.filter((f) => f.uid && !multiplayerClient.isBlocked(f.uid));
      const [profiles, liveStatuses] = await Promise.all([
        Promise.all(activeFriends.map((f) => this.getPublicProfile(f.uid))),
        multiplayerClient.fetchFriendsOnlineStatus(activeFriends.map((f) => f.uid)),
      ]);

      const friends: FriendRecord[] = activeFriends.map((f, idx) => ({
        ...f,
        profile: profiles[idx],
        liveStatus: liveStatuses[f.uid] ?? {
          isOnline: false,
          roomId: null,
          roomName: null,
          visibility: null,
        },
      }));

      saveSystem.setFriendCount(friends.length);
      return {friends, incomingRequests, outgoingRequests};
    } catch {
      return {friends: [], incomingRequests: [], outgoingRequests: []};
    }
  }
}

export const friendsSystem = new FriendsSystem();
