import { beforeEach, describe, expect, it } from 'vitest'

import { useScheduleStore } from './use-schedule-store'
import { StorageService } from '../services/storage-service'
import { getCurrentMonth } from '../utils/date-utils'

import type { ShiftDefinition, ShiftRule } from '../types'

const PAST = '2020-01'
const CURRENT = getCurrentMonth()

const shift: ShiftDefinition = {
  id: 's1',
  name: 'Diurno',
  code: 'D12',
  startTime: '07:00',
  durationHours: 12,
  color: '#3B82F6',
  enabledByDefault: true,
  createdAt: '2020-01-01',
  updatedAt: '2020-01-01',
}

const consecutiveRule: ShiftRule = {
  id: 'r1',
  name: 'Dias seguidos',
  type: 'CONSECUTIVE_DAYS_LIMIT',
  enabledByDefault: true,
  severity: 'ERROR',
  parameters: { consecutiveDaysLimit: 1 },
  createdAt: '2020-01-01',
  updatedAt: '2020-01-01',
}

const store = () => useScheduleStore.getState()

describe('month snapshots', () => {
  beforeEach(() => {
    useScheduleStore.setState({
      currentMonth: PAST,
      isEditMode: false,
      persons: [{ id: 'p1', name: 'Nome antigo', color: '#111111', active: true }],
      shiftDefinitions: [shift],
      shiftRules: [consecutiveRule],
      assignments: { [`${PAST}-15`]: ['p1'], [`${PAST}-16`]: ['p1'] },
      savedAssignments: { [`${PAST}-15`]: ['p1'], [`${PAST}-16`]: ['p1'] },
      dayShiftAssignments: { [`${PAST}-15`]: { s1: 'p1' }, [`${PAST}-16`]: { s1: 'p1' } },
      savedDayShiftAssignments: { [`${PAST}-15`]: { s1: 'p1' }, [`${PAST}-16`]: { s1: 'p1' } },
      monthParticipants: { [PAST]: ['p1'] },
      monthDailyShifts: { [PAST]: { s1: [15, 16] } },
      monthActiveShifts: {},
      monthActiveRules: {},
      availabilities: [],
      events: [],
      expenses: [],
      monthSnapshots: {},
    })
  })

  it('keeps the old person data in a past month and shows the new data this month', () => {
    store().updatePerson('p1', 'Nome novo', '#222222')

    const pastPerson = store().getRegistryForMonth(PAST).persons[0]
    expect(pastPerson.name).toBe('Nome antigo')
    expect(pastPerson.color).toBe('#111111')
    expect(store().getRegistryForMonth(CURRENT).persons[0].name).toBe('Nome novo')
  })

  it('persists the snapshot in local storage', () => {
    store().updatePerson('p1', 'Nome novo', '#222222')

    expect(StorageService.getMonthSnapshots()[PAST].persons[0].name).toBe('Nome antigo')
  })

  it('does not overwrite a snapshot on a second change', () => {
    store().updatePerson('p1', 'Segundo nome', '#222222')
    const firstCapture = store().monthSnapshots[PAST].capturedAt

    store().updatePerson('p1', 'Terceiro nome', '#333333')

    expect(store().monthSnapshots[PAST].capturedAt).toBe(firstCapture)
    expect(store().getRegistryForMonth(PAST).persons[0].name).toBe('Nome antigo')
  })

  it('keeps past validation when a shift duration changes', () => {
    useScheduleStore.setState({
      availabilities: [
        { personId: 'p1', month: PAST, availableDays: [15, 16], shiftAvailability: { s1: [15, 16] } },
      ],
      shiftRules: [
        {
          ...consecutiveRule,
          type: 'MAX_HOURS_PER_PERIOD',
          parameters: { scope: 'DAY', maxHours: 12 },
        },
      ],
    })
    expect(store().validateCurrentSchedule()).toEqual([])

    store().updateShiftDefinition('s1', { durationHours: 24 })

    expect(store().validateCurrentSchedule()).toEqual([])
  })

  it('applies the new shift duration to the current month', () => {
    useScheduleStore.setState({
      currentMonth: CURRENT,
      availabilities: [
        { personId: 'p1', month: CURRENT, availableDays: [15], shiftAvailability: { s1: [15] } },
      ],
      shiftRules: [
        {
          ...consecutiveRule,
          type: 'MAX_HOURS_PER_PERIOD',
          parameters: { scope: 'DAY', maxHours: 12 },
        },
      ],
      dayShiftAssignments: { [`${CURRENT}-15`]: { s1: 'p1' } },
      assignments: { [`${CURRENT}-15`]: ['p1'] },
      monthDailyShifts: { [CURRENT]: { s1: [15] } },
    })
    expect(store().validateCurrentSchedule()).toEqual([])

    store().updateShiftDefinition('s1', { durationHours: 24 })

    expect(store().validateCurrentSchedule()).toHaveLength(1)
  })

  it('keeps a deleted shift on the days of a past month', () => {
    store().deleteShiftDefinition('s1')

    expect(store().getDayActiveShifts(`${PAST}-15`).map((s) => s.name)).toEqual(['Diurno'])
    expect(store().getRegistryForMonth(CURRENT).shiftDefinitions).toEqual([])
  })

  it('keeps past violations when a rule is edited and then deleted', () => {
    const violations = store().validateCurrentSchedule().length
    expect(violations).toBeGreaterThan(0)

    store().updateShiftRule('r1', { parameters: { consecutiveDaysLimit: 10 } })
    expect(store().validateCurrentSchedule()).toHaveLength(violations)

    store().deleteShiftRule('r1')
    expect(store().validateCurrentSchedule()).toHaveLength(violations)
  })

  it('does not activate a new default shift or rule in a past month', () => {
    store().addShiftDefinition({
      name: 'Novo turno',
      code: 'N1',
      startTime: '19:00',
      durationHours: 12,
      color: '#000000',
      enabledByDefault: true,
    })
    store().addShiftRule({
      name: 'Nova regra',
      type: 'MIN_REST_HOURS',
      enabledByDefault: true,
      severity: 'ERROR',
      parameters: { minRestHours: 12 },
    })

    expect(store().getActiveShiftIds(PAST)).toEqual(['s1'])
    expect(store().getActiveRuleIds(PAST)).toEqual(['r1'])
    expect(store().getActiveShiftIds(CURRENT)).toHaveLength(2)
    expect(store().getActiveRuleIds(CURRENT)).toHaveLength(2)
  })

  it('respects a direct change to the active shifts of a past month', () => {
    store().updatePerson('p1', 'Nome novo', '#222222')

    store().removeShiftFromMonth('s1', PAST)

    expect(store().getActiveShiftIds(PAST)).toEqual([])
  })

  it('freezes a person added directly to a past month from the next change on', () => {
    store().updatePerson('p1', 'Nome novo', '#222222')
    useScheduleStore.setState({
      persons: [...store().persons, { id: 'p2', name: 'Pessoa dois', color: '#444444' }],
    })

    store().assignPersonToShift(`${PAST}-17`, 's1', 'p2')
    expect(store().getRegistryForMonth(PAST).persons.map((p) => p.name)).toEqual([
      'Nome antigo',
      'Pessoa dois',
    ])

    store().updatePerson('p2', 'Pessoa renomeada', '#555555')
    expect(store().getRegistryForMonth(PAST).persons.map((p) => p.name)).toEqual([
      'Nome antigo',
      'Pessoa dois',
    ])
  })

  it('keeps past availability and participation when deleting a person', () => {
    useScheduleStore.setState({
      persons: [{ id: 'p3', name: 'Sem escala', color: '#666666' }],
      assignments: {},
      dayShiftAssignments: {},
      savedAssignments: {},
      savedDayShiftAssignments: {},
      monthParticipants: { [PAST]: ['p3'], [CURRENT]: ['p3'] },
      monthDailyShifts: {},
      availabilities: [
        { personId: 'p3', month: PAST, availableDays: [1], shiftRates: { s1: { 1: 300 } } },
        { personId: 'p3', month: CURRENT, availableDays: [1] },
      ],
    })

    expect(store().deletePerson('p3')).toBe(true)

    expect(store().availabilities.map((a) => a.month)).toEqual([PAST])
    expect(store().monthParticipants[PAST]).toEqual(['p3'])
    expect(store().monthParticipants[CURRENT]).toEqual([])
    expect(store().getRegistryForMonth(PAST).persons.map((p) => p.name)).toEqual(['Sem escala'])
    expect(store().getRegistryForMonth(CURRENT).persons).toEqual([])
  })

  it('removes a force-deleted person only from the current month on', () => {
    useScheduleStore.setState({
      assignments: { [`${PAST}-15`]: ['p1'], [`${CURRENT}-15`]: ['p1'] },
      savedAssignments: { [`${PAST}-15`]: ['p1'], [`${CURRENT}-15`]: ['p1'] },
    })

    store().deletePerson('p1', true)

    expect(store().assignments[`${PAST}-15`]).toEqual(['p1'])
    expect(store().assignments[`${CURRENT}-15`]).toEqual([])
  })

  it('reloads snapshots from storage and clears them with local data', () => {
    store().updatePerson('p1', 'Nome novo', '#222222')
    useScheduleStore.setState({ monthSnapshots: {} })

    store().reloadFromStorage()
    expect(Object.keys(store().monthSnapshots)).toContain(PAST)

    store().clearAllLocalData()
    expect(store().monthSnapshots).toEqual({})
    expect(StorageService.getMonthSnapshots()).toEqual({})
  })
})
