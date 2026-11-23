import {
  User,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import {httpsCallable} from 'firebase/functions';
import {
  OperationType,
  auth,
  db,
  functionsClient,
  handleFirestoreError,
  isCloudFunctionsEnabled,
  isFirebaseConfigured,
} from '@/src/firebase/firebaseApp';
import {
  buildFirestoreProfileData,
  buildFirestoreSaveData,
  cloudSaveManager,
  loadManager,
} from '@/src/game/systems/CloudSaveManager';
import {economySystem} from '@/src/game/systems/EconomySystem';
import {createDefaultSave, saveSystem} from '@/src/game/systems/SaveSystem';
import {AuthSessionUser, SaveDataV1} from '@/src/game/types/gameTypes';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export interface AuthActionResult {
  ok: boolean;
  user?: AuthSessionUser;
  errorCode?: string;
  message?: string;
  authSucceededButLoadFailed?: boolean;
}

export interface UsernameValidationResult {
  valid: boolean;
  trimmed: string;
  normalized: string;
  error?: string;
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsernameInput(raw: string): UsernameValidationResult {
  const trimmed = raw.trim();
  const normalized = trimmed.toLowerCase();
  if (!trimmed) {
    return {valid: false, trimmed, normalized, error: 'Please enter a username.'};
  }
  if (trimmed.length < 3 || trimmed.length > 20) {
    return {
      valid: false,
      trimmed,
      normalized,
      error: 'Username must be 3–20 characters long.',
    };
  }
  if (!USERNAME_RE.test(trimmed)) {
    return {
      valid: false,
      trimmed,
      normalized,
      error: 'Username can only contain letters, numbers, and underscores (_).',
    };
  }
  return {valid: true, trimmed, normalized};
}

export function validatePasswordInput(
  password: string,
  confirmPassword?: string,
): {valid: boolean; error?: string} {
  if (!password) {
    return {valid: false, error: 'Please enter a password.'};
  }
  if (password.length < 6) {
    return {valid: false, error: 'Password must be at least 6 characters.'};
  }
  if (password.length > 64) {
    return {valid: false, error: 'Password cannot exceed 64 characters.'};
  }
  if (confirmPassword !== undefined && password !== confirmPassword) {
    return {valid: false, error: 'Passwords do not match.'};
  }
  return {valid: true};
}

function fallbackHashHex(input: string): string {
  // Deterministic 64-bit x2 non-reversible digest fallback if WebCrypto subtle is absent
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const p3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
  const p4 = ((h1 + h2) >>> 0).toString(16).padStart(8, '0');
  return `${p1}${p2}${p3}${p4}`;
}

export async function deriveInternalAuthIdentifier(
  normalizedUsername: string,
): Promise<string> {
  const salted = `chaoscity.uid.v1::${normalizedUsername}`;
  let hex = '';
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const buf = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(salted),
    );
    hex = Array.from(new Uint8Array(buf))
      .slice(0, 16)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } else {
    hex = fallbackHashHex(salted);
  }
  return `u_${hex}@auth.chaoscity.internal`;
}

function isDevEnvironment(): boolean {
  const metaEnv = (import.meta as unknown as {env?: {DEV?: boolean; MODE?: string}}).env;
  if (typeof metaEnv?.DEV === 'boolean') return metaEnv.DEV;
  return metaEnv?.MODE !== 'production';
}

function sanitizeLogMessage(raw: string): string {
  // Strip any accidental internal auth handle or token-like strings before logging
  return raw
    .replace(/u_[0-9a-f]{16,64}@auth\.chaoscity\.internal/gi, '[internal-auth-id]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]')
    .slice(0, 260);
}

function logSafeAuthDiagnostic(stage: string, err: unknown, extra?: Record<string, string>): void {
  if (!isDevEnvironment()) return;
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as {code: unknown}).code)
      : 'unknown';
  const rawMsg = err instanceof Error ? err.message : String(err);
  console.warn('[CHAOS CITY Auth Diagnostic]', {
    stage,
    code,
    message: sanitizeLogMessage(rawMsg),
    ...(extra ?? {}),
  });
}

function mapFirebaseAuthError(err: unknown, mode: 'signup' | 'login'): {
  code: string;
  message: string;
} {
  const rawCode =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as {code: unknown}).code)
      : '';
  const rawMsg = err instanceof Error ? err.message : String(err);

  if (
    rawCode === 'auth/email-already-in-use' ||
    rawMsg.includes('USERNAME_TAKEN') ||
    rawCode === 'functions/already-exists' ||
    rawCode === 'already-exists'
  ) {
    return {
      code: 'username_taken',
      message: 'This username is already taken. Please choose another.',
    };
  }
  if (
    rawCode === 'auth/wrong-password' ||
    rawCode === 'auth/user-not-found' ||
    rawCode === 'auth/invalid-credential' ||
    rawCode === 'auth/invalid-login-credentials' ||
    rawCode === 'functions/unauthenticated' ||
    rawCode === 'unauthenticated'
  ) {
    return {
      code: 'invalid_credentials',
      message: 'Invalid username or password. Please check your credentials and try again.',
    };
  }
  if (rawCode === 'auth/weak-password') {
    return {
      code: 'weak_password',
      message: 'Password is too weak. Use at least 6 characters.',
    };
  }
  if (rawCode === 'auth/too-many-requests' || rawCode === 'resource-exhausted') {
    return {
      code: 'rate_limited',
      message: 'Too many attempts. Please wait a minute and try again.',
    };
  }
  if (
    rawCode === 'auth/operation-not-allowed' ||
    rawCode === 'auth/configuration-not-found' ||
    rawMsg.includes('CONFIGURATION_NOT_FOUND')
  ) {
    return {
      code: 'provider_disabled',
      message:
        'Authentication sign-in provider is not enabled in Firebase Console (Authentication → Sign-in method → Email/Password).',
    };
  }
  if (
    rawCode === 'permission-denied' ||
    rawCode === 'firestore/permission-denied' ||
    rawMsg.includes('Missing or insufficient permissions') ||
    rawMsg.includes('PERMISSION_DENIED')
  ) {
    return {
      code: 'permission_denied',
      message:
        'Could not save your account profile due to Firestore security rules permissions. Please try again or contact support.',
    };
  }
  if (
    rawCode === 'invalid-argument' ||
    rawCode === 'functions/invalid-argument' ||
    rawCode === 'failed-precondition' ||
    rawCode === 'functions/failed-precondition'
  ) {
    return {
      code: rawCode,
      message:
        rawMsg && rawMsg.length < 160 && !rawMsg.includes('@')
          ? rawMsg
          : 'Account configuration or input validation failed. Please verify your username and try again.',
    };
  }
  if (
    rawCode === 'auth/network-request-failed' ||
    rawCode === 'unavailable' ||
    rawCode === 'functions/unavailable' ||
    rawCode === 'deadline-exceeded' ||
    rawMsg.includes('network') ||
    rawMsg.includes('offline')
  ) {
    return {
      code: 'network_error',
      message: 'Network error communicating with CHAOS CITY servers. Please check your connection and try again.',
    };
  }
  if (rawCode === 'auth/api-key-not-valid' || rawCode === 'auth/invalid-api-key') {
    return {
      code: 'invalid_firebase_config',
      message: 'Firebase project configuration is invalid. Please verify firebase-applet-config.json.',
    };
  }
  return {
    code: rawCode || 'auth_failed',
    message:
      mode === 'signup'
        ? `Account creation failed (${rawCode || 'unexpected error'}). Please try again.`
        : `Sign-in failed (${rawCode || 'unexpected error'}). Please try again.`,
  };
}

class AuthSystem {
  private currentUser: AuthSessionUser | null = null;
  private initialized = false;
  private authInitPromise: Promise<void> | null = null;
  private authListeners = new Set<(user: AuthSessionUser | null) => void>();
  private suppressNextAuthStateChange = false;
  private lastHydrateError: string | null = null;

  public getLastHydrateError(): string | null {
    return this.lastHydrateError;
  }

  public clearLastHydrateError(): void {
    this.lastHydrateError = null;
  }

  public getCurrentUser(): AuthSessionUser | null {
    return this.currentUser;
  }

  public isSignedIn(): boolean {
    return Boolean(this.currentUser);
  }

  public subscribe(listener: (user: AuthSessionUser | null) => void): () => void {
    this.authListeners.add(listener);
    listener(this.currentUser);
    return () => {
      this.authListeners.delete(listener);
    };
  }

  private emit(): void {
    for (const fn of this.authListeners) {
      fn(this.currentUser);
    }
  }

  public initAuthListener(): Promise<void> {
    if (this.authInitPromise) return this.authInitPromise;
    if (typeof window === 'undefined' || !isFirebaseConfigured()) {
      this.initialized = true;
      this.authInitPromise = Promise.resolve();
      return this.authInitPromise;
    }

    this.authInitPromise = new Promise<void>((resolve) => {
      let resolvedOnce = false;
      onAuthStateChanged(auth, async (fbUser) => {
        if (this.suppressNextAuthStateChange) {
          if (!resolvedOnce) {
            resolvedOnce = true;
            this.initialized = true;
            resolve();
          }
          return;
        }

        if (!fbUser) {
          this.currentUser = null;
          this.lastHydrateError = null;
          cloudSaveManager.bindAuthenticatedSession(null);
          saveSystem.setActiveAccountUid(null);
          economySystem.notifyExternalReset();
          this.emit();
        } else {
          await this.hydrateAuthenticatedSession(fbUser);
        }

        if (!resolvedOnce) {
          resolvedOnce = true;
          this.initialized = true;
          resolve();
        }
      });
    });

    return this.authInitPromise;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  private async hydrateAuthenticatedSession(
    fbUser: User,
    fallbackUsername?: string,
  ): Promise<AuthActionResult> {
    const uid = fbUser.uid;
    let displayUsername = fbUser.displayName || fallbackUsername || 'Resident';
    let normalizedUsername = normalizeUsername(displayUsername);
    let createdAtMs = Date.now();

    try {
      const profileSnap = await getDocFromServer(doc(db, 'users', uid));
      if (profileSnap.exists()) {
        const d = profileSnap.data();
        if (typeof d.username === 'string' && d.username) {
          displayUsername = d.username;
        }
        if (typeof d.normalizedUsername === 'string' && d.normalizedUsername) {
          normalizedUsername = d.normalizedUsername;
        }
        if (d.createdAt && typeof d.createdAt.toMillis === 'function') {
          createdAtMs = d.createdAt.toMillis();
        }
      }
    } catch {
      // Continue to cloud save loader which reports network unavailability clearly if unreachable
    }

    const loadRes = await loadManager.loadCloudSaveForUser(
      uid,
      displayUsername !== 'Resident' ? displayUsername : fallbackUsername,
    );
    if (
      (displayUsername === 'Resident' || normalizedUsername === 'resident') &&
      loadRes.resolvedUsername
    ) {
      displayUsername = loadRes.resolvedUsername;
      normalizedUsername =
        loadRes.resolvedNormalizedUsername || normalizeUsername(loadRes.resolvedUsername);
    }

    if (!loadRes.ok || !loadRes.state) {
      this.lastHydrateError = loadRes.message ?? 'Could not load cloud save.';
      this.currentUser = {
        uid,
        username: displayUsername,
        normalizedUsername,
        createdAtMs,
      };
      this.emit();
      return {
        ok: false,
        user: this.currentUser,
        errorCode: loadRes.errorCode ?? 'cloud_load_failed',
        message: this.lastHydrateError,
        authSucceededButLoadFailed: true,
      };
    }

    this.lastHydrateError = null;
    const sessionUser: AuthSessionUser = {
      uid,
      username: displayUsername,
      normalizedUsername,
      createdAtMs,
    };
    const needsImmediateSync =
      loadRes.source === 'local_newer' || loadRes.source === 'cloud_initialized';
    this.currentUser = sessionUser;
    cloudSaveManager.bindAuthenticatedSession(
      sessionUser,
      loadRes.state.saveVersion,
      needsImmediateSync ? null : loadRes.state.cloudConfirmedAt,
    );
    economySystem.notifyExternalReset();
    this.emit();

    if (needsImmediateSync) {
      void cloudSaveManager.flushNow(true);
    }

    return {ok: true, user: sessionUser};
  }

  public async retryCloudLoadForCurrentUser(): Promise<AuthActionResult> {
    const fbUser = auth.currentUser;
    if (!fbUser) {
      return {ok: false, errorCode: 'not_signed_in', message: 'No active account session.'};
    }
    return this.hydrateAuthenticatedSession(fbUser);
  }

  public async checkUsernameAvailability(
    rawUsername: string,
  ): Promise<{available: boolean; error?: string; normalized: string}> {
    const v = validateUsernameInput(rawUsername);
    if (!v.valid) {
      return {available: false, error: v.error, normalized: v.normalized};
    }
    if (!isFirebaseConfigured()) {
      return {
        available: false,
        error: 'Firebase is not configured.',
        normalized: v.normalized,
      };
    }

    if (isCloudFunctionsEnabled()) {
      try {
        const fn = httpsCallable<
          {username: string},
          {available: boolean; normalizedUsername: string}
        >(functionsClient, 'checkUsernameAvailable');
        const res = await fn({username: v.trimmed});
        return {
          available: res.data.available,
          normalized: res.data.normalizedUsername,
          error: res.data.available
            ? undefined
            : 'This username is already taken. Please choose another.',
        };
      } catch (err) {
        logSafeAuthDiagnostic('check_username_cloud_function', err, {
          normalizedUsername: v.normalized,
        });
        return {
          available: false,
          error: 'Unable to verify username with backend function right now.',
          normalized: v.normalized,
        };
      }
    }

    try {
      const snap = await getDoc(doc(db, 'usernames', v.normalized));
      if (snap.exists()) {
        return {
          available: false,
          normalized: v.normalized,
          error: 'This username is already taken. Please choose another.',
        };
      }
      return {available: true, normalized: v.normalized};
    } catch (err) {
      logSafeAuthDiagnostic('check_username_firestore', err, {
        normalizedUsername: v.normalized,
      });
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Missing or insufficient permissions')) {
        return {
          available: false,
          normalized: v.normalized,
          error: 'Username lookup blocked by Firestore permissions.',
        };
      }
      return {
        available: false,
        normalized: v.normalized,
        error: 'Network error checking username availability.',
      };
    }
  }

  public async registerWithUsername(
    rawUsername: string,
    password: string,
    confirmPassword: string,
  ): Promise<AuthActionResult> {
    const uCheck = validateUsernameInput(rawUsername);
    if (!uCheck.valid) {
      return {ok: false, errorCode: 'invalid_username', message: uCheck.error};
    }
    const pCheck = validatePasswordInput(password, confirmPassword);
    if (!pCheck.valid) {
      return {ok: false, errorCode: 'invalid_password', message: pCheck.error};
    }
    if (!isFirebaseConfigured()) {
      return {
        ok: false,
        errorCode: 'not_configured',
        message: 'Firebase is not configured for this project.',
      };
    }

    if (isCloudFunctionsEnabled()) {
      return this.registerViaCloudFunction(uCheck.trimmed, password);
    }

    // 1. Immediate pre-check before Auth creation
    const avail = await this.checkUsernameAvailability(uCheck.trimmed);
    if (!avail.available) {
      return {
        ok: false,
        errorCode: 'username_taken',
        message: avail.error ?? 'This username is already taken. Please choose another.',
      };
    }

    this.suppressNextAuthStateChange = true;
    let createdUser: User | null = null;
    let currentStage = 'derive_identifier';

    try {
      const internalIdentifier = await deriveInternalAuthIdentifier(uCheck.normalized);
      currentStage = 'firebase_auth_create_user';
      const cred = await createUserWithEmailAndPassword(auth, internalIdentifier, password);
      createdUser = cred.user;
      const uid = createdUser.uid;
      await updateProfile(createdUser, {displayName: uCheck.trimmed}).catch(() => undefined);

      const starterSave: SaveDataV1 = createDefaultSave(uCheck.trimmed);
      starterSave.saveVersion = 1;
      const sessionId = cloudSaveManager.getSessionId();

      // 2. Atomic Firestore Transaction: reserve normalized username + create profile + create cloud save
      currentStage = 'firestore_registration_transaction';
      await runTransaction(db, async (tx) => {
        const usernameRef = doc(db, 'usernames', uCheck.normalized);
        const existingNameSnap = await tx.get(usernameRef);
        if (existingNameSnap.exists()) {
          throw new Error('USERNAME_TAKEN');
        }

        const userRef = doc(db, 'users', uid);
        const saveRef = doc(db, 'saves', uid);

        tx.set(usernameRef, {
          uid,
          username: uCheck.trimmed,
          normalizedUsername: uCheck.normalized,
          createdAt: serverTimestamp(),
        });

        tx.set(
          userRef,
          buildFirestoreProfileData(uid, uCheck.trimmed, uCheck.normalized, starterSave, true),
        );

        tx.set(
          saveRef,
          buildFirestoreSaveData(
            uid,
            uCheck.trimmed,
            uCheck.normalized,
            sessionId,
            starterSave,
            true,
          ),
        );
      });

      const now = Date.now();
      starterSave.cloudConfirmedAt = now;
      saveSystem.applyCloudLoadedSave(starterSave, uid);

      const sessionUser: AuthSessionUser = {
        uid,
        username: uCheck.trimmed,
        normalizedUsername: uCheck.normalized,
        createdAtMs: now,
      };
      this.currentUser = sessionUser;
      cloudSaveManager.bindAuthenticatedSession(sessionUser, starterSave.saveVersion, now);
      economySystem.notifyExternalReset();
      this.emit();
      void cloudSaveManager.syncPublicProfile(null, false);

      return {ok: true, user: sessionUser};
    } catch (err) {
      logSafeAuthDiagnostic(`register_${currentStage}`, err, {
        normalizedUsername: uCheck.normalized,
        authUserCreated: createdUser ? 'yes' : 'no',
      });
      // Rollback Auth user cleanly if Firestore username reservation/profile creation failed
      if (createdUser) {
        try {
          await deleteUser(createdUser);
        } catch (rollbackErr) {
          logSafeAuthDiagnostic('register_auth_rollback_delete', rollbackErr);
          try {
            await signOut(auth);
          } catch {
            // ignore
          }
        }
      }
      const mapped = mapFirebaseAuthError(err, 'signup');
      return {ok: false, errorCode: mapped.code, message: mapped.message};
    } finally {
      this.suppressNextAuthStateChange = false;
    }
  }

  private async registerViaCloudFunction(
    username: string,
    password: string,
  ): Promise<AuthActionResult> {
    this.suppressNextAuthStateChange = true;
    try {
      const fn = httpsCallable<
        {username: string; password: string},
        {customToken: string; uid: string; username: string; normalizedUsername: string}
      >(functionsClient, 'registerWithUsername');
      const res = await fn({username, password});
      const cred = await signInWithCustomToken(auth, res.data.customToken);
      return await this.hydrateAuthenticatedSession(cred.user);
    } catch (err) {
      logSafeAuthDiagnostic('register_cloud_function', err, {
        normalizedUsername: normalizeUsername(username),
      });
      const mapped = mapFirebaseAuthError(err, 'signup');
      return {ok: false, errorCode: mapped.code, message: mapped.message};
    } finally {
      this.suppressNextAuthStateChange = false;
    }
  }

  public async loginWithUsername(
    rawUsername: string,
    password: string,
  ): Promise<AuthActionResult> {
    const uCheck = validateUsernameInput(rawUsername);
    if (!uCheck.valid) {
      return {ok: false, errorCode: 'invalid_username', message: uCheck.error};
    }
    const pCheck = validatePasswordInput(password);
    if (!pCheck.valid) {
      return {ok: false, errorCode: 'invalid_password', message: pCheck.error};
    }
    if (!isFirebaseConfigured()) {
      return {
        ok: false,
        errorCode: 'not_configured',
        message: 'Firebase is not configured for this project.',
      };
    }

    this.suppressNextAuthStateChange = true;
    try {
      if (isCloudFunctionsEnabled()) {
        const fn = httpsCallable<
          {username: string; password: string},
          {customToken: string}
        >(functionsClient, 'loginWithUsername');
        const res = await fn({username: uCheck.trimmed, password});
        const cred = await signInWithCustomToken(auth, res.data.customToken);
        return await this.hydrateAuthenticatedSession(cred.user, uCheck.trimmed);
      }

      const internalIdentifier = await deriveInternalAuthIdentifier(uCheck.normalized);
      const cred = await signInWithEmailAndPassword(auth, internalIdentifier, password);
      return await this.hydrateAuthenticatedSession(cred.user, uCheck.trimmed);
    } catch (err) {
      logSafeAuthDiagnostic('login_with_username', err, {
        normalizedUsername: uCheck.normalized,
      });
      const mapped = mapFirebaseAuthError(err, 'login');
      return {ok: false, errorCode: mapped.code, message: mapped.message};
    } finally {
      this.suppressNextAuthStateChange = false;
    }
  }

  public async startNewGameForAccount(): Promise<{ok: boolean; message?: string}> {
    if (!this.currentUser) {
      saveSystem.resetForNewGame();
      economySystem.notifyExternalReset();
      return {ok: true};
    }
    saveSystem.resetForNewGame(this.currentUser.username);
    economySystem.notifyExternalReset();
    const ok = await cloudSaveManager.flushNow(true);
    if (!ok) {
      return {
        ok: false,
        message: 'Started fresh locally, but cloud sync could not confirm yet. Retry save from the HUD or Menu.',
      };
    }
    return {ok: true};
  }

  public async logout(): Promise<void> {
    if (this.currentUser) {
      try {
        await cloudSaveManager.flushNow();
      } catch {
        // Proceed with sign-out even if network is currently offline; local UID backup stays safe
      }
    }
    this.suppressNextAuthStateChange = true;
    try {
      if (isFirebaseConfigured()) {
        await signOut(auth);
      }
    } finally {
      this.currentUser = null;
      this.lastHydrateError = null;
      cloudSaveManager.bindAuthenticatedSession(null);
      saveSystem.setActiveAccountUid(null);
      economySystem.notifyExternalReset();
      this.suppressNextAuthStateChange = false;
      this.emit();
    }
  }
}

export const authSystem = new AuthSystem();
