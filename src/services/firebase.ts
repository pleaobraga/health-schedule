import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore'

import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type {
  Firestore} from 'firebase/firestore'


/**
 * Firebase application configuration sourced from Vite environment variables.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

/**
 * False when the VITE_FIREBASE_* values are missing. Guest mode runs entirely on local storage,
 * so the app still starts: auth and db stay null, and login and cloud sync are unavailable.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId,
)

/**
 * Singleton Firebase app instance.
 */
const app: FirebaseApp | null = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null

/**
 * Firebase Authentication instance.
 */
export const auth: Auth | null = app ? getAuth(app) : null

/**
 * Firestore database instance with multi-tab offline persistence enabled.
 * Falls back to default Firestore if running in environments without IndexedDB (e.g. Node/Vitest).
 */
export const db: Firestore | null = (() => {
  if (!app) return null
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
      ignoreUndefinedProperties: true,
    })
  } catch {
    return getFirestore(app)
  }
})()

/**
 * For code that only runs with a signed-in account, which requires a configured Firebase.
 */
export function requireAuth(): Auth {
  if (!auth) throw new Error('Firebase is not configured')
  return auth
}

export function requireDb(): Firestore {
  if (!db) throw new Error('Firebase is not configured')
  return db
}
