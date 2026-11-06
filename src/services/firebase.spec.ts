import { afterEach, describe, expect, it, vi } from 'vitest'

async function importFirebase() {
  vi.resetModules()
  return import('./firebase')
}

describe('firebase', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('stays uninitialized without an API key instead of throwing on import', async () => {
    vi.stubEnv('VITE_FIREBASE_API_KEY', '')

    const firebase = await importFirebase()

    expect(firebase.isFirebaseConfigured).toBe(false)
    expect(firebase.auth).toBeNull()
    expect(firebase.db).toBeNull()
    expect(() => firebase.requireAuth()).toThrow('Firebase is not configured')
    expect(() => firebase.requireDb()).toThrow('Firebase is not configured')
  })

  it('initializes auth and Firestore when configured', async () => {
    const firebase = await importFirebase()

    expect(firebase.isFirebaseConfigured).toBe(true)
    expect(firebase.requireAuth()).toBe(firebase.auth)
    expect(firebase.requireDb()).toBe(firebase.db)
  })
})
