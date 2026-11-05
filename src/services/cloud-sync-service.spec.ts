import * as firestoreModule from 'firebase/firestore'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  CloudSyncService,
  CLOUD_SYNC_STORAGE_KEY,
  MONTH_DOC_SCHEMA_VERSION,
  getMonthsInScheduleData,
  mergeMonthDocs,
  sliceMonthScheduleData,
} from './cloud-sync-service'
import { StorageService } from './storage-service'

const mockAuth = vi.hoisted(() => ({ currentUser: null as { uid: string } | null }))

vi.mock('./firebase', () => ({ auth: mockAuth, db: {} }))

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof firestoreModule>()
  return {
    ...actual,
    doc: vi.fn().mockImplementation((_db, collection, id) => ({ path: `${collection}/${id}` })),
    collection: vi.fn().mockImplementation((_db, path) => ({ path })),
    getDoc: vi.fn().mockResolvedValue({
      exists: () => true,
      data: () => ({ role: 'admin' }),
    }),
    getDocsFromServer: vi.fn().mockResolvedValue({ docs: [] }),
    setDoc: vi.fn().mockResolvedValue(undefined),
    serverTimestamp: vi.fn().mockReturnValue('mock-server-timestamp'),
  }
})

const mockScheduleDocs = (docs: Record<string, Record<string, unknown>>) => {
  vi.mocked(firestoreModule.getDocsFromServer).mockResolvedValueOnce({
    docs: Object.entries(docs).map(([id, data]) => ({ id, data: () => data })),
  } as unknown as firestoreModule.QuerySnapshot)
}

const timestamp = (millis: number) => ({ toMillis: () => millis })

const fullDataset = {
  assignments: { '2026-10-01': ['p1'], '2026-11-03': ['p2'] },
  dayShiftAssignments: { '2026-10-01': { shift_d12: 'p1' } },
  monthParticipants: { '2026-10': ['p1'], '2026-11': ['p2'] },
  availabilities: [
    { personId: 'p1', month: '2026-10', availableDays: [1] },
    { personId: 'p2', month: '2026-11', availableDays: [3] },
  ],
  events: [
    { id: 'e1', date: '2026-10-09', title: 'Meeting' },
    { id: 'e2', date: '2026-11-20', title: 'Training' },
  ],
  monthDailyShifts: { '2026-11': { shift_d12: [3] } },
  monthActiveShifts: { '2026-10': ['shift_d12'] },
  monthActiveRules: { '2026-10': ['rule_1'] },
}

describe('CloudSyncService', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockAuth.currentUser = null
    CloudSyncService.clearCachedAdminStatus()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('sync toggle', () => {
    it('stores the toggle in localStorage', () => {
      expect(CloudSyncService.isSyncEnabled()).toBe(false)

      CloudSyncService.setSyncEnabled(true)
      expect(CloudSyncService.isSyncEnabled()).toBe(true)

      CloudSyncService.setSyncEnabled(false)
      expect(CloudSyncService.isSyncEnabled()).toBe(false)
    })

    it('keeps a separate toggle per account', () => {
      StorageService.setActiveUserId('admin_a')
      CloudSyncService.setSyncEnabled(true)
      expect(localStorage.getItem(`${CLOUD_SYNC_STORAGE_KEY}_admin_a`)).toBe('true')

      StorageService.setActiveUserId('admin_b')
      expect(CloudSyncService.isSyncEnabled()).toBe(false)

      StorageService.setActiveUserId('admin_a')
      expect(CloudSyncService.isSyncEnabled()).toBe(true)
    })

    it('moves the old device-wide toggle to the first account that reads it', () => {
      localStorage.setItem(CLOUD_SYNC_STORAGE_KEY, 'true')
      StorageService.setActiveUserId('admin_a')

      expect(CloudSyncService.isSyncEnabled()).toBe(true)
      expect(localStorage.getItem(`${CLOUD_SYNC_STORAGE_KEY}_admin_a`)).toBe('true')
      expect(localStorage.getItem(CLOUD_SYNC_STORAGE_KEY)).toBeNull()

      StorageService.setActiveUserId('admin_b')
      expect(CloudSyncService.isSyncEnabled()).toBe(false)
    })
  })

  describe('admin check', () => {
    it('reuses the cached role instead of reading Firestore on every write', async () => {
      mockAuth.currentUser = { uid: 'u1' }
      CloudSyncService.setCachedAdminStatus('u1', true)

      expect(await CloudSyncService.isCurrentUserAdmin()).toBe(true)
      expect(firestoreModule.getDoc).not.toHaveBeenCalled()
    })

    it('reads the role from Firestore only once without a cache', async () => {
      mockAuth.currentUser = { uid: 'u1' }

      expect(await CloudSyncService.isCurrentUserAdmin()).toBe(true)
      expect(await CloudSyncService.isCurrentUserAdmin()).toBe(true)
      expect(firestoreModule.getDoc).toHaveBeenCalledTimes(1)
    })
  })

  describe('month snapshots in month docs', () => {
    const snapshot = {
      capturedAt: '2026-11-05T10:00:00.000Z',
      persons: [{ id: 'p1', name: 'Nome antigo', color: '#111111' }],
      shiftDefinitions: [],
      shiftRules: [],
      activeShiftIds: [],
      activeRuleIds: [],
    }

    it('keeps each snapshot only in the doc of its own month', () => {
      const data = { monthSnapshots: { '2026-09': snapshot, '2026-10': snapshot } }

      expect(sliceMonthScheduleData(data, '2026-10').monthSnapshots).toEqual({ '2026-10': snapshot })
      expect(getMonthsInScheduleData(data)).toEqual(['2026-09', '2026-10'])
    })

    it('restores snapshots when month docs are merged', () => {
      const merged = mergeMonthDocs([
        {
          month: '2026-10',
          schemaVersion: MONTH_DOC_SCHEMA_VERSION,
          monthSnapshots: { '2026-10': snapshot },
        },
      ])

      expect(merged?.monthSnapshots).toEqual({ '2026-10': snapshot })
    })
  })

  describe('month doc helpers', () => {
    it('lists every month referenced by the dataset', () => {
      expect(getMonthsInScheduleData(fullDataset)).toEqual(['2026-10', '2026-11'])
    })

    it('extracts only the data of the given month', () => {
      expect(sliceMonthScheduleData(fullDataset, '2026-11')).toEqual({
        assignments: { '2026-11-03': ['p2'] },
        dayShiftAssignments: {},
        monthParticipants: { '2026-11': ['p2'] },
        monthDailyShifts: { '2026-11': { shift_d12: [3] } },
        monthActiveShifts: {},
        monthActiveRules: {},
        monthSnapshots: {},
        availabilities: [{ personId: 'p2', month: '2026-11', availableDays: [3] }],
        events: [{ id: 'e2', date: '2026-11-20', title: 'Training' }],
        expenses: [],
      })
    })

    it('uses the newest legacy doc as the base and applies the new-format months over it', () => {
      const merged = mergeMonthDocs([
        {
          month: '2026-09',
          updatedAt: timestamp(1),
          assignments: { '2026-09-01': ['velho'] },
        },
        {
          month: '2026-10',
          updatedAt: timestamp(2),
          assignments: { '2026-09-01': ['p1'], '2026-10-01': ['p1'], '2026-10-02': ['p1'] },
          monthParticipants: { '2026-09': ['p1'], '2026-10': ['p1'] },
        },
        {
          month: '2026-10',
          schemaVersion: MONTH_DOC_SCHEMA_VERSION,
          assignments: { '2026-10-01': ['p2'] },
          monthParticipants: { '2026-10': ['p2'] },
        },
      ])

      // 2026-09 comes from the newest legacy doc; 2026-10 is fully replaced (day 02 was removed)
      expect(merged?.assignments).toEqual({ '2026-09-01': ['p1'], '2026-10-01': ['p2'] })
      expect(merged?.monthParticipants).toEqual({ '2026-09': ['p1'], '2026-10': ['p2'] })
    })

    it('returns null when there are no month docs', () => {
      expect(mergeMonthDocs([])).toBeNull()
    })
  })

  describe('writes', () => {
    it('does not write to Firestore when the toggle is off', async () => {
      const result = await CloudSyncService.saveMonthToCloud('2026-10', fullDataset, true)
      expect(result).toBe(false)
      expect(firestoreModule.setDoc).not.toHaveBeenCalled()
    })

    it('does not write to Firestore for non-admin users', async () => {
      CloudSyncService.setSyncEnabled(true)
      const result = await CloudSyncService.saveMonthToCloud('2026-10', fullDataset, false)
      expect(result).toBe(false)
      expect(firestoreModule.setDoc).not.toHaveBeenCalled()
    })

    it('replaces the month doc (no merge) with only that month data', async () => {
      CloudSyncService.setSyncEnabled(true)

      const result = await CloudSyncService.saveMonthToCloud('2026-10', fullDataset, true)

      expect(result).toBe(true)
      expect(firestoreModule.setDoc).toHaveBeenCalledTimes(1)
      expect(firestoreModule.setDoc).toHaveBeenCalledWith(
        { path: 'schedules/2026-10' },
        {
          ...sliceMonthScheduleData(fullDataset, '2026-10'),
          month: '2026-10',
          schemaVersion: MONTH_DOC_SCHEMA_VERSION,
          updatedAt: 'mock-server-timestamp',
        },
      )
    })

    it('syncs master lists without undefined properties', async () => {
      CloudSyncService.setSyncEnabled(true)

      const result = await CloudSyncService.saveAddressesToCloud(
        [{ id: 'a1', label: 'Clinic', street: 'Main St', number: undefined } as never],
        true,
      )

      expect(result).toBe(true)
      expect(firestoreModule.setDoc).toHaveBeenCalledWith(
        { path: 'schedules/_master_addresses' },
        {
          addresses: [{ id: 'a1', label: 'Clinic', street: 'Main St' }],
          updatedAt: 'mock-server-timestamp',
        },
      )
    })

    it('returns false when Firestore rejects the write', async () => {
      CloudSyncService.setSyncEnabled(true)
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(firestoreModule.setDoc).mockRejectedValueOnce(new Error('permission-denied'))

      expect(await CloudSyncService.savePeopleToCloud([], true)).toBe(false)
    })

    it('does not wait for the server while offline (the write stays queued)', async () => {
      CloudSyncService.setSyncEnabled(true)
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
      vi.mocked(firestoreModule.setDoc).mockReturnValueOnce(new Promise<void>(() => {}))

      const result = await CloudSyncService.saveMonthToCloud('2026-10', fullDataset, true)

      expect(result).toBe(true)
      expect(firestoreModule.setDoc).toHaveBeenCalledTimes(1)
    })
  })

  describe('pullAllFromCloud', () => {
    it('merges every month and the master lists read from the server, even with the toggle off', async () => {
      mockScheduleDocs({
        '2026-10': {
          schemaVersion: MONTH_DOC_SCHEMA_VERSION,
          ...sliceMonthScheduleData(fullDataset, '2026-10'),
        },
        '2026-11': {
          schemaVersion: MONTH_DOC_SCHEMA_VERSION,
          ...sliceMonthScheduleData(fullDataset, '2026-11'),
        },
        _master_people: { persons: [{ id: 'p1', name: 'Dra. Marina', color: '#10b981' }] },
        _master_addresses: { addresses: [] },
        _master_shifts: { shifts: [{ id: 'shift_d12' }] },
      })

      const result = await CloudSyncService.pullAllFromCloud(true)

      expect(result.status).toBe('ok')
      expect(result.monthData?.assignments).toEqual(fullDataset.assignments)
      expect(result.monthData?.events).toEqual(fullDataset.events)
      expect(result.persons).toEqual([{ id: 'p1', name: 'Dra. Marina', color: '#10b981' }])
      expect(result.addresses).toEqual([])
      expect(result.shifts).toEqual([{ id: 'shift_d12' }])
      expect(result.rules).toBeNull()
      expect(firestoreModule.getDoc).not.toHaveBeenCalled()
    })

    it('does not read data for non-admin users', async () => {
      const result = await CloudSyncService.pullAllFromCloud(false)
      expect(result.status).toBe('unauthorized')
      expect(firestoreModule.getDocsFromServer).not.toHaveBeenCalled()
    })

    it('returns offline without using the local cache when there is no connection', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

      const result = await CloudSyncService.pullAllFromCloud(true)

      expect(result.status).toBe('offline')
      expect(result.monthData).toBeNull()
      expect(firestoreModule.getDocsFromServer).not.toHaveBeenCalled()
    })

    it('returns offline when the server is unavailable', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(firestoreModule.getDocsFromServer).mockRejectedValueOnce({ code: 'unavailable' })

      const result = await CloudSyncService.pullAllFromCloud(true)
      expect(result.status).toBe('offline')
    })
  })

  describe('pushAllToCloud', () => {
    it('writes every local month, clears cloud-only months and sends the master lists without the toggle', async () => {
      mockScheduleDocs({ '2026-08': { assignments: { '2026-08-01': ['p9'] } }, _master_people: {} })

      const success = await CloudSyncService.pushAllToCloud(
        {
          monthData: fullDataset,
          persons: [{ id: 'p1', name: 'Dra. Marina', color: '#10b981', active: true }],
          addresses: [],
          shifts: [],
          rules: [],
        },
        true,
        true,
        ['2026-12'],
      )

      expect(success).toBe(true)
      const savedPaths = vi
        .mocked(firestoreModule.setDoc)
        .mock.calls.map(([ref]) => (ref as unknown as { path: string }).path)
      expect(savedPaths.sort()).toEqual([
        'schedules/2026-08',
        'schedules/2026-10',
        'schedules/2026-11',
        'schedules/2026-12',
        'schedules/_master_addresses',
        'schedules/_master_people',
        'schedules/_master_rules',
        'schedules/_master_shifts',
      ])
      expect(firestoreModule.setDoc).toHaveBeenCalledWith(
        { path: 'schedules/2026-08' },
        expect.objectContaining({ assignments: {}, schemaVersion: MONTH_DOC_SCHEMA_VERSION }),
      )
      expect(CloudSyncService.isSyncEnabled()).toBe(false)
    })

    it('sends nothing for non-admin users', async () => {
      const success = await CloudSyncService.pushAllToCloud(
        { monthData: fullDataset, persons: [], addresses: [] },
        false,
      )
      expect(success).toBe(false)
      expect(firestoreModule.setDoc).not.toHaveBeenCalled()
    })

    it('saves expenseItems to schedules/_master_expense_items in the items field and pulls them back', async () => {
      CloudSyncService.setSyncEnabled(true)
      const items = [
        {
          id: 'item_1',
          name: 'Fralda G',
          normalizedName: 'fralda g',
          createdAt: '2026-11-05T10:00:00.000Z',
          updatedAt: '2026-11-05T10:00:00.000Z',
        },
      ]

      const saved = await CloudSyncService.saveExpenseItemsToCloud(items, true)
      expect(saved).toBe(true)
      expect(firestoreModule.setDoc).toHaveBeenCalledWith(
        { path: 'schedules/_master_expense_items' },
        {
          items,
          updatedAt: 'mock-server-timestamp',
        },
      )

      mockScheduleDocs({
        _master_expense_items: { items },
      })
      const pulled = await CloudSyncService.pullAllFromCloud(true)
      expect(pulled.expenseItems).toEqual(items)

      mockScheduleDocs({})
      const pulledWithoutDoc = await CloudSyncService.pullAllFromCloud(true)
      expect(pulledWithoutDoc.expenseItems).toBeNull()
    })

    it('writes expenseItems in pushAllToCloud when provided and keeps expense lines and personName in sliceMonthScheduleData', async () => {
      const items = [
        {
          id: 'item_1',
          name: 'Fralda G',
          normalizedName: 'fralda g',
          createdAt: '2026-11-05T10:00:00.000Z',
          updatedAt: '2026-11-05T10:00:00.000Z',
        },
      ]
      const expenseWithLines = {
        id: 'exp_1',
        date: '2026-10-12',
        description: 'Farmácia',
        amount: 59.9,
        personId: 'p1',
        personName: 'Dra. Marina',
        items: [
          {
            id: 'line_1',
            itemId: 'item_1',
            itemName: 'Fralda G',
            quantity: 2,
            amount: 59.9,
          },
        ],
        createdAt: '2026-10-12T10:00:00.000Z',
        updatedAt: '2026-10-12T10:00:00.000Z',
      }

      const slice = sliceMonthScheduleData(
        { ...fullDataset, expenses: [expenseWithLines] },
        '2026-10',
      )
      expect(slice.expenses).toEqual([expenseWithLines])

      mockScheduleDocs({})
      const success = await CloudSyncService.pushAllToCloud(
        {
          monthData: { ...fullDataset, expenses: [expenseWithLines] },
          persons: [],
          addresses: [],
          expenseItems: items,
        },
        true,
        true,
      )
      expect(success).toBe(true)
      expect(firestoreModule.setDoc).toHaveBeenCalledWith(
        { path: 'schedules/_master_expense_items' },
        {
          items,
          updatedAt: 'mock-server-timestamp',
        },
      )
    })
  })
})
