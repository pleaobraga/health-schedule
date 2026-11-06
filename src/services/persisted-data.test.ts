import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  exportAppData,
  mergeAppData,
  restoreAppData,
  validateAndParseBackup,
} from './backup-service'
import {
  getMonthsInScheduleData,
  MONTH_DOC_SCHEMA_VERSION,
  mergeMonthDocs,
  sliceMonthScheduleData,
} from './cloud-sync-service'
import { StorageService } from './storage-service'
import { useScheduleStore } from '../store/use-schedule-store'

import type { MonthScheduleData } from './cloud-sync-service'
import type {
  AppDataSnapshot,
  CalendarEvent,
  DailyExpense,
  GuestDataset,
  MedicationScheduleVersion,
  MonthlyAvailability,
  Person,
  ShiftDefinition,
  ShiftRule,
} from '../types'

const MAY = '2026-05'
const JUNE = '2026-06'

const person: Person = { id: 'p1', name: 'Ana', color: '#111111', active: true }

const shift: ShiftDefinition = {
  id: 's1',
  name: 'Diurno',
  code: 'D12',
  startTime: '07:00',
  durationHours: 12,
  color: '#3B82F6',
  enabledByDefault: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

const rule: ShiftRule = {
  id: 'r1',
  name: 'Limite',
  type: 'MAX_SHIFTS_PER_PERIOD',
  enabledByDefault: true,
  severity: 'ERROR',
  parameters: { scope: 'DAY', maxOccurrences: 1 },
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

const availabilities: MonthlyAvailability[] = [
  {
    personId: 'p1',
    month: MAY,
    availableDays: [1, 2],
    shiftAvailability: { s1: [1] },
    shiftRates: { s1: { 1: 100 } },
  },
  { personId: 'p1', month: JUNE, availableDays: [3] },
]

const events: CalendarEvent[] = [
  { id: 'e1', date: '2026-05-01', title: 'Consulta', time: '09:00', personId: 'p1' },
  { id: 'e2', date: '2026-06-02', title: 'Exame' },
]

const expenses: DailyExpense[] = [
  {
    id: 'x1',
    date: '2026-05-03',
    description: 'Farmácia',
    amount: 10,
    items: [{ id: 'l1', itemId: 'i1', itemName: 'Luva', quantity: 1, amount: 10 }],
    createdAt: '2026-05-03T10:00:00.000Z',
    updatedAt: '2026-05-03T10:00:00.000Z',
  },
  {
    id: 'x2',
    date: '2026-06-04',
    description: 'Táxi',
    amount: 20,
    items: [],
    createdAt: '2026-06-04T10:00:00.000Z',
    updatedAt: '2026-06-04T10:00:00.000Z',
  },
]

const medicationVersion: MedicationScheduleVersion = {
  id: 'medver_1',
  effectiveDate: '2026-05-01',
  explanation: 'Início',
  notes: [{ id: 'n1', text: 'Nota' }],
  medications: [{ id: 'med_1', name: 'Dutam', specialty: 'Urologista' }],
  times: ['08:00'],
  doses: { med_1: { '08:00': '1 comprimido' } },
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
}

const monthData: Required<MonthScheduleData> = {
  assignments: { '2026-05-01': ['p1'], '2026-06-02': ['p1'] },
  dayShiftAssignments: { '2026-05-01': { s1: 'p1' }, '2026-06-02': { s1: 'p1' } },
  monthParticipants: { [MAY]: ['p1'], [JUNE]: ['p1'] },
  monthActiveShifts: { [MAY]: ['s1'], [JUNE]: ['s1'] },
  monthActiveRules: { [MAY]: ['r1'], [JUNE]: ['r1'] },
  monthDailyShifts: { [MAY]: { s1: [1, 2] }, [JUNE]: { s1: [2] } },
  monthSnapshots: {
    [MAY]: {
      capturedAt: '2026-06-01T10:00:00.000Z',
      persons: [person],
      shiftDefinitions: [shift],
      shiftRules: [rule],
      activeShiftIds: ['s1'],
      activeRuleIds: ['r1'],
    },
  },
  availabilities,
  events,
  expenses,
}

// Required makes a new optional field a type error until it is added here and to the checks below.
const fullSnapshot: Required<AppDataSnapshot> = {
  ...monthData,
  exportedAt: '2026-06-15T12:00:00.000Z',
  people: [person],
  expenseItems: [
    {
      id: 'i1',
      name: 'Luva',
      normalizedName: 'luva',
      createdAt: '2026-05-03T10:00:00.000Z',
      updatedAt: '2026-05-03T10:00:00.000Z',
    },
  ],
  medicationVersions: [medicationVersion],
  addresses: [{ id: 'a1', name: 'Casa', street: 'Rua A', number: '1' }],
  shiftDefinitions: [shift],
  shiftRules: [rule],
  theme: 'dark',
}

const { exportedAt: _exportedAt, theme: _theme, people, ...sharedFields } = fullSnapshot
const fullDataset: Required<GuestDataset> = {
  ...sharedFields,
  persons: people as Person[],
} as Required<GuestDataset>

function pickStoreData() {
  const state = useScheduleStore.getState()
  const pick = <K extends keyof GuestDataset>(key: K) => state[key]
  return Object.fromEntries(
    (Object.keys(fullDataset) as (keyof GuestDataset)[]).map((key) => [key, pick(key)]),
  )
}

async function captureExport(): Promise<AppDataSnapshot> {
  let exported: Blob | undefined
  URL.createObjectURL = vi.fn((blob: Blob) => {
    exported = blob
    return 'blob:backup'
  })
  URL.revokeObjectURL = vi.fn()

  await exportAppData()

  return JSON.parse((await exported?.text()) ?? '{}')
}

const emptyDataset = {
  persons: [],
  availabilities: [],
  assignments: {},
  events: [],
  expenses: [],
  expenseItems: [],
  medicationVersions: [],
  monthParticipants: {},
  addresses: [],
  shiftDefinitions: [],
  shiftRules: [],
  monthActiveShifts: {},
  monthActiveRules: {},
  monthDailyShifts: {},
  dayShiftAssignments: {},
  monthSnapshots: {},
}

describe('persisted data', () => {
  beforeEach(() => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    useScheduleStore.getState().clearAllLocalData()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.classList.remove('dark')
  })

  it('checks every field the app stores', () => {
    expect(Object.keys(fullDataset).sort()).toEqual(
      Object.keys(StorageService.getCurrentDataset()).sort(),
    )
    expect(Object.keys(emptyDataset).sort()).toEqual(Object.keys(fullDataset).sort())
  })

  it('exports every field written by a restore', async () => {
    await restoreAppData(fullSnapshot)

    expect(await captureExport()).toEqual({
      ...fullSnapshot,
      exportedAt: expect.any(String),
    })
  })

  it('updates the store with every restored field', async () => {
    await restoreAppData(fullSnapshot)

    expect(pickStoreData()).toEqual(fullDataset)
  })

  it('keeps every field through a backup file', async () => {
    await restoreAppData(fullSnapshot)
    const backup = await captureExport()

    useScheduleStore.getState().clearAllLocalData()
    const parsed = await validateAndParseBackup(
      new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' }),
    )
    await restoreAppData(parsed)

    expect(StorageService.getCurrentDataset()).toEqual(fullDataset)
  })

  it('merges every field into empty storage', async () => {
    await mergeAppData(fullSnapshot)

    expect(StorageService.getCurrentDataset()).toEqual(fullDataset)
    expect(pickStoreData()).toEqual(fullDataset)
  })

  it('does not duplicate anything when the same backup is merged twice', async () => {
    await mergeAppData(fullSnapshot)
    await mergeAppData(fullSnapshot)

    expect(StorageService.getCurrentDataset()).toMatchObject(fullDataset)
  })

  it('keeps every field when a profile is swapped out and back', async () => {
    await restoreAppData(fullSnapshot)
    const snapshot = StorageService.getCurrentDataset()

    StorageService.resetToDefault()
    useScheduleStore.getState().reloadFromStorage()
    StorageService.restoreDataset(snapshot)
    useScheduleStore.getState().reloadFromStorage()

    expect(StorageService.getCurrentDataset()).toEqual(fullDataset)
    expect(pickStoreData()).toEqual(fullDataset)
  })

  it('clears every field from storage and the store', async () => {
    await restoreAppData(fullSnapshot)

    useScheduleStore.getState().clearAllLocalData()

    expect(StorageService.getCurrentDataset()).toEqual(emptyDataset)
    expect(pickStoreData()).toEqual(emptyDataset)
  })

  describe('cloud month documents', () => {
    it('finds every month in the data', () => {
      expect(getMonthsInScheduleData(monthData)).toEqual([MAY, JUNE])
    })

    it('rebuilds every field from the month slices', () => {
      const docs = [MAY, JUNE].map((month) => ({
        month,
        schemaVersion: MONTH_DOC_SCHEMA_VERSION,
        ...sliceMonthScheduleData(monthData, month),
      }))

      expect(mergeMonthDocs(docs)).toEqual(monthData)
    })

    it('keeps other months out of a month slice', () => {
      const slice = sliceMonthScheduleData(monthData, JUNE)

      expect(slice).toEqual({
        assignments: { '2026-06-02': ['p1'] },
        dayShiftAssignments: { '2026-06-02': { s1: 'p1' } },
        monthParticipants: { [JUNE]: ['p1'] },
        monthActiveShifts: { [JUNE]: ['s1'] },
        monthActiveRules: { [JUNE]: ['r1'] },
        monthDailyShifts: { [JUNE]: { s1: [2] } },
        monthSnapshots: {},
        availabilities: [availabilities[1]],
        events: [events[1]],
        expenses: [expenses[1]],
      })
    })
  })
})
