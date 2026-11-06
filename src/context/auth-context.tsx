/* eslint-disable react-refresh/only-export-components */
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import React, { useEffect, useState } from 'react'

import {
  AuthContext,
  useAuth,
} from './auth-context-base'
import { CloudSyncService } from '../services/cloud-sync-service'
import { auth, requireAuth, requireDb } from '../services/firebase'
import { isGuestDataEmpty, loadGuestSeedData } from '../services/seed/guestSeedLoader'
import { StorageService } from '../services/storage-service'
import { useScheduleStore } from '../store/use-schedule-store'
import { getCurrentMonth } from '../utils/date-utils'

import type {
  AuthContextType,
  UserRole,
} from './auth-context-base'
import type { GuestProfile } from '../types'
import type { User } from 'firebase/auth'

export { AuthContext, useAuth }
export type { AuthContextType, UserRole }

const createGuestUser = (profile: GuestProfile): User => {
  return {
    uid: profile.id,
    displayName: profile.name,
    email: null,
    isAnonymous: true,
  } as unknown as User
}

// login() and onAuthStateChanged both restore the same account right after sign-in;
// sharing the in-flight restore avoids pulling from the cloud twice.
const restoresInFlight = new Map<string, Promise<void>>()

function restoreUserDataOrCloud(uid: string, isAdmin = false): Promise<void> {
  const inFlight = restoresInFlight.get(uid)
  if (inFlight) return inFlight

  const restore = runUserDataRestore(uid, isAdmin).finally(() => {
    restoresInFlight.delete(uid)
  })
  restoresInFlight.set(uid, restore)
  return restore
}

async function runUserDataRestore(uid: string, isAdmin: boolean): Promise<void> {
  StorageService.setActiveUserId(uid)
  const userDataset = StorageService.getUserDataset(uid)
  const hasLocalData =
    Boolean(userDataset) &&
    ((userDataset!.persons && userDataset!.persons.length > 0) ||
      (userDataset!.assignments &&
        Object.keys(userDataset!.assignments).length > 0) ||
      (userDataset!.monthParticipants &&
        Object.keys(userDataset!.monthParticipants).length > 0) ||
      (userDataset!.availabilities &&
        userDataset!.availabilities.length > 0) ||
      (userDataset!.monthDailyShifts &&
        Object.keys(userDataset!.monthDailyShifts).length > 0) ||
      (userDataset!.events && userDataset!.events.length > 0) ||
      (userDataset!.addresses && userDataset!.addresses.length > 0))

  if (hasLocalData && userDataset) {
    StorageService.restoreDataset(userDataset)
    useScheduleStore.getState().reloadFromStorage()
  } else {
    // If local dataset is missing or empty, attempt pulling data from Firestore cloud
    try {
      const cloudResult = await useScheduleStore.getState().pullCloudData(isAdmin)
      if (cloudResult.success) {
        StorageService.snapshotActiveUser(uid)
      } else if (userDataset) {
        StorageService.restoreDataset(userDataset)
        useScheduleStore.getState().reloadFromStorage()
      }
    } catch (err) {
      console.warn('Could not pull cloud data for authenticated user:', err)
      if (userDataset) {
        StorageService.restoreDataset(userDataset)
        useScheduleStore.getState().reloadFromStorage()
      }
    }
  }
}

export interface AuthProviderProps {
  children: React.ReactNode
  /**
   * Optional context override for testing and storybook isolation.
   */
  value?: Partial<AuthContextType>
}

export function AuthProvider({
  children,
  value,
}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [isGuest, setIsGuest] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [guestProfiles, setGuestProfiles] = useState<GuestProfile[]>(() =>
    StorageService.getGuestProfiles()
  )

  useEffect(() => {
    // If an external value override is provided (e.g. in unit tests), bypass auth listener
    if (value && value.user !== undefined) {
      setUser(value.user)
      setRole(value.role ?? 'user')
      setIsGuest(value.isGuest ?? false)
      setLoading(value.loading ?? false)
      return
    }

    // Check if an active guest session exists in localStorage
    const activeGuestId = StorageService.getActiveGuestId()
    const profiles = StorageService.getGuestProfiles()
    setGuestProfiles(profiles)

    if (activeGuestId) {
      const activeProfile = profiles.find((p) => p.id === activeGuestId)
      if (activeProfile) {
        setUser(createGuestUser(activeProfile))
        setRole('user')
        setIsGuest(true)
        setLoading(false)

        if (isGuestDataEmpty()) {
          loadGuestSeedData().catch((err) => {
            console.warn('Could not load guest seed data on boot:', err)
          })
        }
        return
      }
    }

    if (!auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        if (!currentUser) {
          if (!StorageService.getActiveGuestId()) {
            setUser(null)
            setRole(null)
            setIsGuest(false)
          }
          setLoading(false)
          return
        }

        if (StorageService.getActiveGuestId()) {
          StorageService.snapshotActiveGuest()
          StorageService.setActiveGuestId(null)
        }
        setIsGuest(false)
        setUser(currentUser)

        // Snapshot previous authenticated user if switching accounts
        const previousActiveUserId = StorageService.getActiveUserId()
        if (previousActiveUserId && previousActiveUserId !== currentUser.uid) {
          StorageService.saveUserDataset(
            previousActiveUserId,
            StorageService.getCurrentDataset(),
          )
        }

        // Retrieve user role dynamically from Firestore 'users' collection
        let userIsAdmin = false
        try {
          const userDoc = await getDoc(doc(requireDb(), 'users', currentUser.uid))

          if (userDoc.exists()) {
            userIsAdmin = userDoc.data()?.role === 'admin'
            CloudSyncService.setCachedAdminStatus(currentUser.uid, userIsAdmin)
            setRole(userIsAdmin ? 'admin' : 'user')
          } else {
            // Se o documento ainda não existir, cria o registro inicial com role 'user'
            try {
              await setDoc(doc(requireDb(), 'users', currentUser.uid), {
                email: currentUser.email,
                role: 'user',
                displayName:
                  currentUser.displayName ||
                  currentUser.email?.split('@')[0] ||
                  'Usuário',
                createdAt: new Date().toISOString(),
              })
            } catch {
              // Se falhar a criação por regras ou offline, mantém como 'user'
            }
            setRole('user')
          }
        } catch (err) {
          console.error('Failed to load user document from Firestore:', err)
          setRole('user')
        }

        // Restore authenticated user's isolated local data if it exists, or fetch from cloud
        await restoreUserDataOrCloud(currentUser.uid, userIsAdmin)

        // Always guarantee calendar opens in the current month of today
        useScheduleStore.setState({ currentMonth: getCurrentMonth() })
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [value])

  const login = async (email: string, password: string): Promise<void> => {
    const firebaseAuth = requireAuth()

    if (StorageService.getActiveGuestId()) {
      StorageService.snapshotActiveGuest()
      StorageService.setActiveGuestId(null)
      StorageService.resetToDefault()
      useScheduleStore.getState().reloadFromStorage()
    } else {
      const currentActiveUid =
        StorageService.getActiveUserId() || user?.uid || auth?.currentUser?.uid
      if (currentActiveUid) {
        StorageService.saveUserDataset(
          currentActiveUid,
          StorageService.getCurrentDataset(),
        )
      }
      StorageService.setActiveUserId(null)
      StorageService.resetToDefault()
      useScheduleStore.getState().reloadFromStorage()
    }
    StorageService.clearCheckedOnboarding()
    setIsGuest(false)
    useScheduleStore.setState({ currentMonth: getCurrentMonth() })

    const credential = await signInWithEmailAndPassword(firebaseAuth, email, password)
    const authenticatedUser = credential.user

    let userIsAdmin = false
    try {
      const userDoc = await getDoc(doc(requireDb(), 'users', authenticatedUser.uid))
      if (userDoc.exists()) {
        userIsAdmin = userDoc.data()?.role === 'admin'
        CloudSyncService.setCachedAdminStatus(authenticatedUser.uid, userIsAdmin)
      }
    } catch {
      // offline fallback
    }

    await restoreUserDataOrCloud(authenticatedUser.uid, userIsAdmin)
    setUser(authenticatedUser)
    setRole(userIsAdmin ? 'admin' : 'user')
  }

  const loginAsGuest = async (
    name: string,
    existingId?: string,
  ): Promise<void> => {
    StorageService.clearCheckedOnboarding()
    if (StorageService.getActiveGuestId()) {
      StorageService.snapshotActiveGuest()
    } else {
      const uid =
        StorageService.getActiveUserId() || user?.uid || auth?.currentUser?.uid
      if (uid) {
        StorageService.saveUserDataset(uid, StorageService.getCurrentDataset())
      }
      StorageService.setActiveUserId(null)
    }

    const profiles = StorageService.getGuestProfiles()

    if (existingId) {
      const existing = profiles.find((p) => p.id === existingId)
      if (!existing) {
        throw new Error('Perfil de convidado não encontrado.')
      }

      const updatedProfile: GuestProfile = {
        ...existing,
        lastActiveAt: new Date().toISOString(),
      }
      const updatedProfiles = profiles.map((p) =>
        p.id === existingId ? updatedProfile : p
      )

      StorageService.saveGuestProfiles(updatedProfiles)
      StorageService.setActiveGuestId(existingId)

      const savedDataset = StorageService.getGuestDataset(existingId)
      if (savedDataset) {
        StorageService.restoreDataset(savedDataset)
      } else {
        StorageService.resetToDefault()
      }
      useScheduleStore.getState().reloadFromStorage()

      if (isGuestDataEmpty()) {
        try {
          await loadGuestSeedData()
        } catch (err) {
          console.warn('Could not load guest seed data for existing guest:', err)
        }
      }

      useScheduleStore.setState({ currentMonth: getCurrentMonth() })
      setGuestProfiles(updatedProfiles)
      setUser(createGuestUser(updatedProfile))
      setRole('user')
      setIsGuest(true)
      setLoading(false)
      return
    }

    const trimmed = name.trim()
    if (!trimmed) {
      throw new Error('Por favor, informe um nome para o convidado.')
    }

    const newId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const newProfile: GuestProfile = {
      id: newId,
      name: trimmed,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    }

    const updatedProfiles = [newProfile, ...profiles]
    StorageService.saveGuestProfiles(updatedProfiles)
    StorageService.setActiveGuestId(newId)
    StorageService.resetToDefault()

    try {
      await loadGuestSeedData()
    } catch (err) {
      console.warn('Could not load guest seed data for new guest:', err)
      StorageService.saveGuestDataset(newId, {
        persons: [],
        availabilities: [],
        assignments: {},
        events: [],
        monthParticipants: {},
      })
      useScheduleStore.getState().reloadFromStorage()
    }

    useScheduleStore.setState({ currentMonth: getCurrentMonth() })
    setGuestProfiles(updatedProfiles)
    setUser(createGuestUser(newProfile))
    setRole('user')
    setIsGuest(true)
    setLoading(false)
  }

  const logout = async (): Promise<void> => {
    StorageService.clearCheckedOnboarding()
    if (isGuest || StorageService.getActiveGuestId()) {
      StorageService.snapshotActiveGuest()
      StorageService.setActiveGuestId(null)
      StorageService.resetToDefault()
      useScheduleStore.getState().reloadFromStorage()
      useScheduleStore.setState({ currentMonth: getCurrentMonth() })
      setUser(null)
      setRole(null)
      setIsGuest(false)
      setGuestProfiles(StorageService.getGuestProfiles())
      return
    }

    // Authenticated user logout: snapshot and isolate their data locally
    const uid =
      StorageService.getActiveUserId() || user?.uid || auth?.currentUser?.uid
    if (uid) {
      StorageService.saveUserDataset(uid, StorageService.getCurrentDataset())
    }
    StorageService.setActiveUserId(null)
    StorageService.resetToDefault()
    useScheduleStore.getState().reloadFromStorage()
    useScheduleStore.setState({ currentMonth: getCurrentMonth() })

    CloudSyncService.clearCachedAdminStatus()
    if (auth) {
      await signOut(auth)
    }
    setUser(null)
    setRole(null)
    setIsGuest(false)
  }

  const deleteGuestProfile = (id: string): void => {
    const profiles = StorageService.getGuestProfiles()
    const updatedProfiles = profiles.filter((p) => p.id !== id)
    StorageService.saveGuestProfiles(updatedProfiles)
    StorageService.deleteGuestDataset(id)
    setGuestProfiles(updatedProfiles)

    if (StorageService.getActiveGuestId() === id) {
      StorageService.setActiveGuestId(null)
      StorageService.resetToDefault()
      useScheduleStore.getState().reloadFromStorage()
      useScheduleStore.setState({ currentMonth: getCurrentMonth() })
      setUser(null)
      setRole(null)
      setIsGuest(false)
    }
  }

  const isAdmin = role === 'admin'

  const contextValue: AuthContextType = {
    user: value?.user !== undefined ? value.user : user,
    role: value?.role !== undefined ? value.role : role,
    isAdmin: value?.isAdmin !== undefined ? value.isAdmin : isAdmin,
    isGuest: value?.isGuest !== undefined ? value.isGuest : isGuest,
    loading: value?.loading !== undefined ? value.loading : loading,
    login: value?.login || login,
    loginAsGuest: value?.loginAsGuest || loginAsGuest,
    logout: value?.logout || logout,
    guestProfiles:
      value?.guestProfiles !== undefined ? value.guestProfiles : guestProfiles,
    deleteGuestProfile: value?.deleteGuestProfile || deleteGuestProfile,
  }

  return (
    <AuthContext value={contextValue}>{children}</AuthContext>
  )
}

