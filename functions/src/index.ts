import * as crypto from 'node:crypto';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {FieldValue, getFirestore} from 'firebase-admin/firestore';
import {defineSecret, defineString} from 'firebase-functions/params';
import {HttpsError, onCall} from 'firebase-functions/v2/https';

initializeApp();

const DATABASE_ID = 'ai-studio-chaoscity-9f2185e3-50e4-4627-83fe-0e5d2264917c';
const db = getFirestore(DATABASE_ID);
const auth = getAuth();

// Configure via: firebase functions:secrets:set AUTH_PEPPER
const AUTH_PEPPER = defineSecret('AUTH_PEPPER');
// Optional override if deploying outside default project API key
const FIREBASE_WEB_API_KEY = defineString('FIREBASE_WEB_API_KEY', {default: ''});

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

function validateUsername(raw: unknown): {trimmed: string; normalized: string} {
  if (typeof raw !== 'string') {
    throw new HttpsError('invalid-argument', 'Username must be a string.');
  }
  const trimmed = raw.trim();
  const normalized = trimmed.toLowerCase();
  if (!USERNAME_RE.test(trimmed)) {
    throw new HttpsError(
      'invalid-argument',
      'Username must be 3-20 characters and contain only letters, numbers, and underscores.',
    );
  }
  return {trimmed, normalized};
}

function validatePassword(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length < 6 || raw.length > 64) {
    throw new HttpsError(
      'invalid-argument',
      'Password must be between 6 and 64 characters.',
    );
  }
  return raw;
}

function derivePepperedAuthEmail(normalizedUsername: string, pepper: string): string {
  const digest = crypto
    .createHmac('sha256', pepper)
    .update(`chaoscity.fn.v1::${normalizedUsername}`)
    .digest('hex')
    .slice(0, 32);
  return `u_${digest}@auth.chaoscity.internal`;
}

function buildStarterAppearance() {
  return {
    gender: 'male',
    skinTone: '#f1c27d',
    hairStyle: 'short_tidy',
    hairColor: '#2d2320',
    eyeStyle: 'bright',
    eyeColor: '#2b5876',
    browStyle: 'classic',
    facialDetail: 'none',
    facialHair: 'none',
  };
}

function buildStarterOutfit() {
  return {
    shirt: 'cloth_tee_sunset',
    jacket: 'cloth_jacket_denim',
    trousers: 'cloth_pants_navy',
    shoes: 'cloth_shoes_runner',
    hat: null,
    glasses: null,
    accessory: null,
  };
}

export const checkUsernameAvailable = onCall(async (request) => {
  const {normalized} = validateUsername(request.data?.username);
  const snap = await db.collection('usernames').doc(normalized).get();
  return {
    available: !snap.exists,
    normalizedUsername: normalized,
  };
});

export const registerWithUsername = onCall(
  {secrets: [AUTH_PEPPER]},
  async (request) => {
    const {trimmed, normalized} = validateUsername(request.data?.username);
    const password = validatePassword(request.data?.password);
    const pepper = AUTH_PEPPER.value() || 'chaoscity-dev-pepper-change-me';

    const usernameRef = db.collection('usernames').doc(normalized);
    const existingSnap = await usernameRef.get();
    if (existingSnap.exists) {
      throw new HttpsError(
        'already-exists',
        'This username is already taken. Please choose another.',
      );
    }

    const internalEmail = derivePepperedAuthEmail(normalized, pepper);
    let createdUid: string | null = null;

    try {
      const userRecord = await auth.createUser({
        email: internalEmail,
        password,
        displayName: trimmed,
        emailVerified: true,
      });
      createdUid = userRecord.uid;
      const uid = userRecord.uid;

      const starterAppearance = buildStarterAppearance();
      const starterOutfit = buildStarterOutfit();
      const ownedClothing = [
        'cloth_tee_sunset',
        'cloth_jacket_denim',
        'cloth_pants_navy',
        'cloth_shoes_runner',
      ];
      const nowMs = Date.now();
      const starterInventory = ownedClothing.map((itemId) => ({
        itemId,
        quantity: 1,
        acquiredAt: nowMs,
      }));
      const starterAchievements = {
        unlockedIds: [],
        stats: {
          districtsVisited: 0,
          buildingsVisited: 0,
          itemsPurchased: 0,
          ownedClothingCount: ownedClothing.length,
          activitiesCompleted: 0,
        },
      };
      const starterMissions = {
        completedIds: [],
        visitedDistricts: [],
        visitedBuildings: [],
        itemsPurchased: 0,
        activitiesCompleted: 0,
      };
      const playerId = `plr_${uid.slice(0, 12)}`;

      await db.runTransaction(async (tx) => {
        const checkSnap = await tx.get(usernameRef);
        if (checkSnap.exists) {
          throw new HttpsError(
            'already-exists',
            'This username is already taken. Please choose another.',
          );
        }

        const userRef = db.collection('users').doc(uid);
        const saveRef = db.collection('saves').doc(uid);

        tx.set(usernameRef, {
          uid,
          username: trimmed,
          normalizedUsername: normalized,
          createdAt: FieldValue.serverTimestamp(),
        });

        tx.set(userRef, {
          uid,
          username: trimmed,
          normalizedUsername: normalized,
          playerId,
          appearanceId: 'alex_urban',
          appearanceConfig: starterAppearance,
          equippedClothing: starterOutfit,
          ownedClothing,
          inventoryCount: ownedClothing.length,
          coins: 250,
          achievementProgress: starterAchievements,
          missionProgress: starterMissions,
          saveVersion: 1,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          lastSavedAt: FieldValue.serverTimestamp(),
        });

        tx.set(saveRef, {
          uid,
          username: trimmed,
          normalizedUsername: normalized,
          schemaVersion: 1,
          saveVersion: 1,
          sessionId: `fn_${nowMs.toString(36)}`,
          playerId,
          playerName: trimmed,
          appearanceId: 'alex_urban',
          appearanceConfig: starterAppearance,
          lastPosition: null,
          settings: {
            masterVolume: 0.75,
            musicEnabled: true,
            sfxEnabled: true,
            graphicsQuality: 'high',
            cameraZoom: 1.5,
            joystickSensitivity: 1.0,
            touchMode: 'auto',
          },
          coins: 250,
          energy: 100,
          inventory: starterInventory,
          ownedClothing,
          equippedClothing: starterOutfit,
          hairOverride: {hairStyle: null, hairColor: null},
          outfitPresets: [
            {
              id: 'preset_starter',
              name: 'Street Classic',
              equipped: starterOutfit,
              builtIn: true,
            },
          ],
          selectedOutfitPresetId: 'preset_starter',
          claimedRewards: [],
          transactions: [],
          arcadeHighScores: {},
          cinemaTicketActive: false,
          achievements: starterAchievements,
          missions: starterMissions,
          clientUpdatedAt: nowMs,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      const customToken = await auth.createCustomToken(uid);
      return {
        customToken,
        uid,
        username: trimmed,
        normalizedUsername: normalized,
      };
    } catch (err) {
      if (createdUid) {
        try {
          await auth.deleteUser(createdUid);
        } catch {
          // Best-effort cleanup
        }
      }
      if (err instanceof HttpsError) throw err;
      throw new HttpsError(
        'already-exists',
        'This username is already taken. Please choose another.',
      );
    }
  },
);

export const loginWithUsername = onCall(
  {secrets: [AUTH_PEPPER]},
  async (request) => {
    const {normalized} = validateUsername(request.data?.username);
    const password = validatePassword(request.data?.password);
    const pepper = AUTH_PEPPER.value() || 'chaoscity-dev-pepper-change-me';

    const usernameSnap = await db.collection('usernames').doc(normalized).get();
    if (!usernameSnap.exists) {
      // Non-enumerating error message
      throw new HttpsError(
        'unauthenticated',
        'Invalid username or password. Please check your credentials and try again.',
      );
    }

    const apiKey = FIREBASE_WEB_API_KEY.value() || process.env.FIREBASE_WEB_API_KEY || '';
    if (!apiKey) {
      throw new HttpsError(
        'failed-precondition',
        'FIREBASE_WEB_API_KEY parameter is not configured on Cloud Functions.',
      );
    }

    const internalEmail = derivePepperedAuthEmail(normalized, pepper);
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          email: internalEmail,
          password,
          returnSecureToken: false,
        }),
      },
    );

    if (!verifyRes.ok) {
      throw new HttpsError(
        'unauthenticated',
        'Invalid username or password. Please check your credentials and try again.',
      );
    }

    const payload = (await verifyRes.json()) as {localId?: string};
    const uid = payload.localId;
    if (!uid) {
      throw new HttpsError('internal', 'Authentication verification failed.');
    }

    const customToken = await auth.createCustomToken(uid);
    return {customToken, uid};
  },
);

const AUTHORITATIVE_PRICES: Record<string, {price: number; stackable: boolean}> = {
  cloth_tee_sunset: {price: 35, stackable: false},
  cloth_jacket_denim: {price: 75, stackable: false},
  cloth_pants_navy: {price: 45, stackable: false},
  cloth_shoes_runner: {price: 50, stackable: false},
  cin_ticket: {price: 25, stackable: false},
};

export const purchaseShopItem = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const itemId = typeof request.data?.itemId === 'string' ? request.data.itemId.trim() : '';
  const catalogEntry = AUTHORITATIVE_PRICES[itemId];
  if (!catalogEntry) {
    throw new HttpsError('invalid-argument', 'Unknown item.');
  }

  const saveRef = db.collection('saves').doc(uid);
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(saveRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Cloud save not found.');
    }
    const data = snap.data()!;
    const coins = Number(data.coins ?? 0);
    if (coins < catalogEntry.price) {
      throw new HttpsError('failed-precondition', 'Not enough coins.');
    }
    const inventory: Array<{itemId: string; quantity: number; acquiredAt: number}> =
      Array.isArray(data.inventory) ? [...data.inventory] : [];
    const existingIdx = inventory.findIndex((e) => e.itemId === itemId);
    if (existingIdx >= 0 && !catalogEntry.stackable) {
      throw new HttpsError('already-exists', 'Item already owned.');
    }
    if (existingIdx >= 0) {
      inventory[existingIdx] = {
        ...inventory[existingIdx],
        quantity: inventory[existingIdx].quantity + 1,
      };
    } else {
      inventory.push({itemId, quantity: 1, acquiredAt: Date.now()});
    }

    const nextCoins = coins - catalogEntry.price;
    const nextVersion = Number(data.saveVersion ?? 1) + 1;

    tx.update(saveRef, {
      coins: nextCoins,
      inventory,
      saveVersion: nextVersion,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(userRef, {
      coins: nextCoins,
      saveVersion: nextVersion,
      updatedAt: FieldValue.serverTimestamp(),
      lastSavedAt: FieldValue.serverTimestamp(),
    });
    return {ok: true, balance: nextCoins, saveVersion: nextVersion};
  });
});

export const claimCityReward = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const rewardKey =
    typeof request.data?.rewardKey === 'string' ? request.data.rewardKey.trim() : '';
  const REWARDS: Record<string, number> = {
    bank_daily_bonus: 50,
    gym_workout_reward: 25,
    library_trivia_reward: 30,
    office_shift_reward: 45,
  };
  const amount = REWARDS[rewardKey];
  if (!amount) {
    throw new HttpsError('invalid-argument', 'Unknown reward key.');
  }

  const saveRef = db.collection('saves').doc(uid);
  const userRef = db.collection('users').doc(uid);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(saveRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Cloud save not found.');
    }
    const data = snap.data()!;
    const claimed: string[] = Array.isArray(data.claimedRewards)
      ? [...data.claimedRewards]
      : [];
    if (claimed.includes(rewardKey)) {
      return {ok: false, balance: Number(data.coins ?? 0), alreadyClaimed: true};
    }
    claimed.push(rewardKey);
    const nextCoins = Math.min(1_000_000, Number(data.coins ?? 0) + amount);
    const nextVersion = Number(data.saveVersion ?? 1) + 1;

    tx.update(saveRef, {
      coins: nextCoins,
      claimedRewards: claimed,
      saveVersion: nextVersion,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(userRef, {
      coins: nextCoins,
      saveVersion: nextVersion,
      updatedAt: FieldValue.serverTimestamp(),
      lastSavedAt: FieldValue.serverTimestamp(),
    });
    return {ok: true, balance: nextCoins, saveVersion: nextVersion};
  });
});
