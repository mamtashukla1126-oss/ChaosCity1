import {FirebaseApp, initializeApp} from 'firebase/app';
import {Auth, getAuth} from 'firebase/auth';
import {Firestore, doc, getDocFromServer, getFirestore} from 'firebase/firestore';
import {Functions, getFunctions} from 'firebase/functions';
import firebaseConfig from '@/firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedFunctions: Functions | null = null;

function isPlaceholderConfig(): boolean {
  return (
    !firebaseConfig?.apiKey ||
    !firebaseConfig?.projectId ||
    firebaseConfig.projectId === 'remixed-project-id'
  );
}

export function isFirebaseConfigured(): boolean {
  return !isPlaceholderConfig();
}

export function isCloudFunctionsEnabled(): boolean {
  const env = (import.meta as unknown as {env?: Record<string, string | undefined>}).env;
  return env?.VITE_USE_CLOUD_FUNCTIONS === 'true';
}

function getFunctionsRegion(): string {
  const env = (import.meta as unknown as {env?: Record<string, string | undefined>}).env;
  return env?.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1';
}

export function getFirebaseServices(): {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  functions: Functions;
} {
  if (!cachedApp) {
    cachedApp = initializeApp(firebaseConfig);
    cachedDb = getFirestore(cachedApp, firebaseConfig.firestoreDatabaseId);
    cachedAuth = getAuth(cachedApp);
    cachedFunctions = getFunctions(cachedApp, getFunctionsRegion());
  }
  return {
    app: cachedApp,
    auth: cachedAuth!,
    db: cachedDb!,
    functions: cachedFunctions!,
  };
}

export const firebaseApp = getFirebaseServices().app;
export const db = getFirebaseServices().db;
export const auth = getFirebaseServices().auth;
export const functionsClient = getFirebaseServices().functions;

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const user = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: user?.uid ?? null,
      email: user?.email ?? null,
      emailVerified: user?.emailVerified ?? null,
      isAnonymous: user?.isAnonymous ?? null,
      tenantId: user?.tenantId ?? null,
      providerInfo:
        user?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;

export async function testFirestoreConnection(): Promise<boolean> {
  if (typeof window === 'undefined' || !isFirebaseConfigured()) {
    return false;
  }
  if (connectionTested) return true;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: client is offline.');
      return false;
    }
    // Permission denied / missing probe doc still confirms network connectivity to Firestore server
    return true;
  }
}

if (typeof window !== 'undefined') {
  void testFirestoreConnection();
}
