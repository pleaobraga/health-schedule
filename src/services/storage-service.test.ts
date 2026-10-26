import { describe, it, expect, beforeEach } from 'vitest'

import { StorageService } from './storage-service'

import type { Person, CalendarEvent, MonthlyAvailability } from '../types'

describe('StorageService - local-first persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns an empty list when storage is empty', () => {
    const persons = StorageService.getPersons()
    expect(persons).toEqual([])
  })


  it('saves and loads people, defaulting active to true', () => {
    const newPersons: Person[] = [
      { id: 'custom-1', name: 'Dr. Teste Silva', color: '#ef4444', active: true },
    ]
    StorageService.savePersons(newPersons)

    const loaded = StorageService.getPersons()
    expect(loaded).toEqual(newPersons)
    expect(loaded[0].active).toBe(true)
  })

  it.each([
    {
      label: 'monthly availabilities',
      value: [{ personId: 'p1', month: '2026-10', availableDays: [5, 10, 15] }] as MonthlyAvailability[],
      save: StorageService.saveAvailabilities,
      load: StorageService.getAvailabilities,
    },
    {
      label: 'calendar assignments',
      value: { '2026-10-01': ['p1'], '2026-10-02': ['p2'] } as Record<string, string[]>,
      save: StorageService.saveAssignments,
      load: StorageService.getAssignments,
    },
    {
      label: 'calendar events',
      value: [{ id: 'ev-test', date: '2026-10-20', title: 'Schedule meeting' }] as CalendarEvent[],
      save: StorageService.saveEvents,
      load: StorageService.getEvents,
    },
    {
      label: 'daily expenses',
      value: [
        {
          id: 'exp-test',
          date: '2026-10-20',
          description: 'Farmácia',
          amount: 45.5,
          category: 'MEDICATION',
          createdAt: '2026-10-20T10:00:00.000Z',
          updatedAt: '2026-10-20T10:00:00.000Z',
        },
      ],
      save: StorageService.saveExpenses,
      load: StorageService.getExpenses,
    },
    {
      label: 'month participants',
      value: { '2026-10': ['p1', 'p2'] } as Record<string, string[]>,
      save: StorageService.saveMonthParticipants,
      load: StorageService.getMonthParticipants,
    },
  ])('saves and loads $label', ({ value, save, load }) => {
    ;(save as (v: typeof value) => void)(value)

    expect(load()).toEqual(value)
  })

  it('clears the data on resetToDefault', () => {
    // Modify data
    StorageService.savePersons([{ id: 'tmp', name: 'Temporário', color: '#000000' }])
    expect(StorageService.getPersons()[0].name).toBe('Temporário')

    // Execute reset
    StorageService.resetToDefault()

    // When reloading, should return empty
    const reloaded = StorageService.getPersons()
    expect(reloaded).toEqual([])
  })

  it('clearAllLocalData clears the local data and the active guest dataset', () => {
    StorageService.setActiveGuestId('guest_999')
    StorageService.savePersons([{ id: 'g_p1', name: 'Dr. Convidado', color: '#ff0000' }])
    StorageService.saveAddresses([{ id: 'g_a1', name: 'Endereço 1', street: 'Rua A', number: '10' }])

    // Should have snapshot in guest dataset
    expect(StorageService.getGuestDataset('guest_999')).toBeDefined()

    // Clear all
    StorageService.clearAllLocalData()

    expect(StorageService.getPersons()).toEqual([])
    expect(StorageService.getAddresses()).toEqual([])
    expect(StorageService.getShiftDefinitions()).toEqual([])
    expect(StorageService.getShiftRules()).toEqual([])
    expect(StorageService.getGuestDataset('guest_999')).toBeNull()
  })


  it('manages guest profiles and their isolated datasets', () => {
    const profiles = [
      {
        id: 'guest_1',
        name: 'Dr. Roberto',
        createdAt: '2026-10-18T10:00:00Z',
        lastActiveAt: '2026-10-18T10:00:00Z',
      },
    ]

    StorageService.saveGuestProfiles(profiles)
    expect(StorageService.getGuestProfiles()).toEqual(profiles)

    StorageService.setActiveGuestId('guest_1')
    expect(StorageService.getActiveGuestId()).toBe('guest_1')

    // Save dataset for guest_1
    const dataset = {
      persons: [{ id: 'p1', name: 'Dr. Roberto', color: '#10b981', active: true }],
      availabilities: [],
      assignments: { '2026-10-15': ['p1'] },
      events: [],
      monthParticipants: { '2026-10': ['p1'] },
    }

    StorageService.saveGuestDataset('guest_1', dataset)
    expect(StorageService.getGuestDataset('guest_1')).toEqual(dataset)

    // Test restoring dataset
    StorageService.resetToDefault()
    expect(StorageService.getPersons()).toEqual([])

    StorageService.restoreDataset(dataset)
    expect(StorageService.getPersons()).toHaveLength(1)
    expect(StorageService.getAssignments()['2026-10-15']).toEqual(['p1'])

    // Test deleting dataset
    StorageService.deleteGuestDataset('guest_1')
    expect(StorageService.getGuestDataset('guest_1')).toBeNull()

    StorageService.setActiveGuestId(null)
    expect(StorageService.getActiveGuestId()).toBeNull()
  })

  it('manages isolated datasets of signed-in users with snapshotActiveSession', () => {
    // 1. Define active user
    StorageService.setActiveUserId('user_admin_123')
    expect(StorageService.getActiveUserId()).toBe('user_admin_123')

    // 2. Save data for active user
    StorageService.savePersons([{ id: 'p_admin', name: 'Dr. Admin', color: '#6366f1', active: true }])
    StorageService.saveAssignments({ '2026-10-15': ['p_admin'] })

    // 3. User dataset snapshot should be automatically populated via snapshotActiveSession
    const userSnapshot = StorageService.getUserDataset('user_admin_123')
    expect(userSnapshot).toBeDefined()
    expect(userSnapshot?.persons).toHaveLength(1)
    expect(userSnapshot?.persons[0].id).toBe('p_admin')
    expect(userSnapshot?.assignments['2026-10-15']).toEqual(['p_admin'])

    // 4. Simulate switching to guest (wipes active working keys)
    StorageService.setActiveUserId(null)
    StorageService.resetToDefault()
    expect(StorageService.getPersons()).toEqual([])
    expect(StorageService.getAssignments()).toEqual({})

    // 5. Restore user dataset when user logs back in
    const reloadedSnapshot = StorageService.getUserDataset('user_admin_123')
    expect(reloadedSnapshot).not.toBeNull()
    StorageService.restoreDataset(reloadedSnapshot!)
    expect(StorageService.getPersons()).toHaveLength(1)
    expect(StorageService.getPersons()[0].name).toBe('Dr. Admin')
    expect(StorageService.getAssignments()['2026-10-15']).toEqual(['p_admin'])

    // 6. Test deleteUserDataset
    StorageService.deleteUserDataset('user_admin_123')
    expect(StorageService.getUserDataset('user_admin_123')).toBeNull()
  })

  it('saves list order per list and per guest / user profile', () => {
    StorageService.setActiveGuestId('guest-a')
    StorageService.saveListOrder('people', ['p2', 'p1'])
    StorageService.saveListOrder('shifts', ['s1'])

    StorageService.setActiveGuestId('guest-b')
    expect(StorageService.getListOrder('people')).toEqual([])
    StorageService.saveListOrder('people', ['p1'])

    StorageService.setActiveGuestId('guest-a')
    expect(StorageService.getListOrder('people')).toEqual(['p2', 'p1'])
    expect(StorageService.getListOrder('shifts')).toEqual(['s1'])
    expect(StorageService.getListOrderKey('people')).toBe('scale_manager_list_order_v1_people_guest_guest-a')
    StorageService.setActiveGuestId(null)
  })

  it('keeps list order out of the dataset (backup / sync) and clears it with the local data', () => {
    StorageService.saveListOrder('month-people', ['p1', 'p2'])
    StorageService.saveListOrder('addresses', ['a1'])
    expect(JSON.stringify(StorageService.getCurrentDataset())).not.toContain('list_order')

    StorageService.clearAllLocalData()
    expect(StorageService.getListOrder('month-people')).toEqual([])
    expect(StorageService.getListOrder('addresses')).toEqual([])
  })

  it('ignores invalid saved list order values', () => {
    localStorage.setItem(StorageService.getListOrderKey('rules'), '{"not":"an array"}')
    expect(StorageService.getListOrder('rules')).toEqual([])
  })
})
