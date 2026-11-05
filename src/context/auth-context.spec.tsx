import { act, renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider, useAuth } from './auth-context'
import demoJson from '../../public/demo/demo.json'
import { StorageService } from '../services/storage-service'
import { useScheduleStore } from '../store/use-schedule-store'

import type * as firebaseAuth from 'firebase/auth'
import type * as firestoreModule from 'firebase/firestore'

const mockSignInWithEmailAndPassword = vi.fn()
const mockSignOut = vi.fn().mockResolvedValue(undefined)
const mockOnAuthStateChanged = vi.fn((...args: unknown[]) => {
  const callback = args[1] as ((user: unknown) => void) | undefined
  if (typeof callback === 'function') {
    callback(null)
  }
  return vi.fn()
})

vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof firebaseAuth>()
  return {
    ...actual,
    signInWithEmailAndPassword: (...args: unknown[]) => mockSignInWithEmailAndPassword(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
    onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  }
})

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof firestoreModule>()
  return {
    ...actual,
    doc: vi.fn().mockReturnValue({}),
    collection: vi.fn().mockReturnValue({}),
    getDoc: vi.fn().mockResolvedValue({
      exists: () => true,
      data: () => ({ role: 'admin' }),
    }),
    getDocsFromServer: vi.fn().mockResolvedValue({ docs: [] }),
    setDoc: vi.fn().mockResolvedValue(undefined),
  }
})

describe('AuthContext - multiple guests with isolated local data', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => demoJson,
    }) as unknown as typeof fetch
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  )

  it('starts with no guest session when nothing is stored', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isGuest).toBe(false)
    expect(result.current.isAdmin).toBe(false)
    expect(result.current.guestProfiles).toEqual([])
  })


  it('creates a new guest profile without admin privileges', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.loginAsGuest('Dr. Lucas')
    })

    expect(result.current.user).not.toBeNull()
    expect(result.current.user?.displayName).toBe('Dr. Lucas')
    expect(result.current.isGuest).toBe(true)
    expect(result.current.role).toBe('user')
    expect(result.current.isAdmin).toBe(false)
    expect(result.current.guestProfiles).toHaveLength(1)
    expect(result.current.guestProfiles[0].name).toBe('Dr. Lucas')
    expect(StorageService.getActiveGuestId()).toBe(result.current.guestProfiles[0].id)
  })

  it('switches between guest accounts and restores each isolated dataset', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    // 1. Guest 1 signs in and saves data
    await act(async () => {
      await result.current.loginAsGuest('Dr. Primeiro')
    })

    const guest1Id = result.current.guestProfiles[0].id
    StorageService.savePersons([
      { id: 'p-1', name: 'Paciente A', color: '#3b82f6', active: true },
    ])

    // 2. Guest 1 signs out
    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isGuest).toBe(false)
    expect(StorageService.getActiveGuestId()).toBeNull()
    // The active data is cleared so nothing leaks
    expect(StorageService.getPersons()).toEqual([])

    // 3. Guest 2 signs in and saves other data
    await act(async () => {
      await result.current.loginAsGuest('Dra. Segunda')
    })

    expect(result.current.user?.displayName).toBe('Dra. Segunda')
    expect(result.current.guestProfiles).toHaveLength(2)
    StorageService.savePersons([
      { id: 'p-2', name: 'Paciente B', color: '#10b981', active: true },
    ])

    // 4. Guest 2 signs out
    await act(async () => {
      await result.current.logout()
    })

    expect(StorageService.getPersons()).toEqual([])

    // 5. Guest 1 is picked again from the list
    await act(async () => {
      await result.current.loginAsGuest('', guest1Id)
    })

    expect(result.current.user?.displayName).toBe('Dr. Primeiro')
    expect(result.current.isGuest).toBe(true)
    // Guest 1 data is restored
    const restoredPersons = StorageService.getPersons()
    expect(restoredPersons).toHaveLength(1)
    expect(restoredPersons[0].name).toBe('Paciente A')
  })

  it('deletes a guest profile and its dataset', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.loginAsGuest('Dr. Temporario')
    })

    const guestId = result.current.guestProfiles[0].id
    expect(StorageService.getGuestProfiles()).toHaveLength(1)
    expect(StorageService.getGuestDataset(guestId)).not.toBeNull()

    act(() => {
      result.current.deleteGuestProfile(guestId)
    })

    expect(result.current.user).toBeNull()
    expect(result.current.guestProfiles).toHaveLength(0)
    expect(StorageService.getGuestProfiles()).toHaveLength(0)
    expect(StorageService.getGuestDataset(guestId)).toBeNull()
  })

  it('keeps the admin data across logout, a guest session and a new login()', async () => {
    const mockUser = {
      uid: 'admin-uid-1',
      email: 'admin@healthscale.com',
      displayName: 'Administrador Geral',
    }
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: mockUser,
    })
    mockSignOut.mockResolvedValue(undefined)

    const { result } = renderHook(() => useAuth(), { wrapper })

    // 1. Admin signs in
    await act(async () => {
      await result.current.login('admin@healthscale.com', 'admin123')
    })

    expect(result.current.user?.uid).toBe('admin-uid-1')
    expect(result.current.isGuest).toBe(false)

    // 2. Admin adds a person, an address and an assignment
    act(() => {
      useScheduleStore.getState().addPerson('Dra. Maria Plantonista', '#10b981')
      useScheduleStore.getState().addAddress({
        name: 'Hospital Central',
        street: 'Av. Paulista',
        number: '1500',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
      })
    })

    const createdPerson = useScheduleStore.getState().persons[0]
    expect(createdPerson).toBeDefined()
    expect(createdPerson.name).toBe('Dra. Maria Plantonista')

    act(() => {
      useScheduleStore.getState().addPersonToDay('2026-10-15', createdPerson.id)
    })

    await act(async () => {
      await useScheduleStore.getState().saveSchedule()
    })

    expect(useScheduleStore.getState().assignments['2026-10-15']).toEqual([createdPerson.id])
    expect(useScheduleStore.getState().addresses).toHaveLength(1)

    // The admin snapshot in localStorage is filled
    const adminSnapshotBefore = StorageService.getUserDataset('admin-uid-1')
    expect(adminSnapshotBefore?.persons).toHaveLength(1)
    expect(adminSnapshotBefore?.addresses).toHaveLength(1)
    expect(adminSnapshotBefore?.assignments['2026-10-15']).toEqual([createdPerson.id])

    // 3. Admin signs out
    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(useScheduleStore.getState().persons).toEqual([])
    expect(useScheduleStore.getState().addresses).toEqual([])
    expect(useScheduleStore.getState().assignments).toEqual({})

    // 4. The user enters as a guest
    await act(async () => {
      await result.current.loginAsGuest('Visitante Clínico')
    })

    expect(result.current.isGuest).toBe(true)
    expect(StorageService.getActiveGuestId()).not.toBeNull()

    // 5. The guest signs out
    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(useScheduleStore.getState().persons).toEqual([])

    // 6. Admin signs in again through login()
    await act(async () => {
      await result.current.login('admin@healthscale.com', 'admin123')
    })

    expect(result.current.user?.uid).toBe('admin-uid-1')
    expect(result.current.isGuest).toBe(false)

    // 7. The admin data is fully restored in the store and in localStorage
    const restoredPersons = useScheduleStore.getState().persons
    const restoredAddresses = useScheduleStore.getState().addresses
    const restoredAssignments = useScheduleStore.getState().assignments

    expect(restoredPersons).toHaveLength(1)
    expect(restoredPersons[0].name).toBe('Dra. Maria Plantonista')
    expect(restoredAddresses).toHaveLength(1)
    expect(restoredAddresses[0].name).toBe('Hospital Central')
    expect(restoredAssignments['2026-10-15']).toEqual([createdPerson.id])

    expect(StorageService.getPersons()).toHaveLength(1)
    expect(StorageService.getAddresses()).toHaveLength(1)
    expect(StorageService.getAssignments()['2026-10-15']).toEqual([createdPerson.id])
  })

  it('pulls cloud data on login when the local user dataset is empty', async () => {
    const mockUser = {
      uid: 'admin-new-device',
      email: 'novo-admin@healthscale.com',
    }
    mockSignInWithEmailAndPassword.mockResolvedValue({
      user: mockUser,
    })

    const pullCloudDataSpy = vi.spyOn(useScheduleStore.getState(), 'pullCloudData').mockImplementation(async () => {
      useScheduleStore.setState({
        persons: [{ id: 'p-cloud', name: 'Dr. Da Nuvem', color: '#6366f1', active: true }],
        addresses: [{ id: 'addr-cloud', name: 'Clínica Nuvem', street: 'Rua das Nuvens', number: '10' }],
        assignments: { '2026-10-25': ['p-cloud'] },
      })
      StorageService.savePersons([{ id: 'p-cloud', name: 'Dr. Da Nuvem', color: '#6366f1', active: true }])
      StorageService.saveAddresses([{ id: 'addr-cloud', name: 'Clínica Nuvem', street: 'Rua das Nuvens', number: '10' }])
      StorageService.saveAssignments({ '2026-10-25': ['p-cloud'] })
      return { success: true, code: 'success', message: 'Sincronizado' }
    })

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login('novo-admin@healthscale.com', 'pass123')
    })

    expect(pullCloudDataSpy).toHaveBeenCalled()
    expect(useScheduleStore.getState().persons).toHaveLength(1)
    expect(useScheduleStore.getState().persons[0].name).toBe('Dr. Da Nuvem')
    expect(useScheduleStore.getState().addresses).toHaveLength(1)
    expect(useScheduleStore.getState().assignments['2026-10-25']).toEqual(['p-cloud'])
  })
})
