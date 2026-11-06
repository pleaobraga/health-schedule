import { beforeEach, describe, expect, it } from 'vitest'

import { useScheduleStore } from './use-schedule-store'
import { StorageService } from '../services/storage-service'

import type { MonthlyAvailability, ShiftDefinition, ShiftRule } from '../types'

const MONTH = '2026-06'
const PAST_MONTH = '2026-05'
const DAY = '2026-06-20'

const shiftDefinition = (id: string, enabledByDefault = true): ShiftDefinition => ({
  id,
  name: `Turno ${id}`,
  code: id.toUpperCase(),
  startTime: '07:00',
  durationHours: 12,
  color: '#3B82F6',
  enabledByDefault,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
})

const shiftRule = (id: string, enabledByDefault = true): ShiftRule => ({
  id,
  name: `Regra ${id}`,
  type: 'MAX_SHIFTS_PER_PERIOD',
  enabledByDefault,
  severity: 'ERROR',
  parameters: { scope: 'DAY', maxOccurrences: 1 },
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
})

const availability = (
  personId: string,
  availableDays: number[],
  extra: Partial<MonthlyAvailability> = {},
): MonthlyAvailability => ({ personId, month: MONTH, availableDays, ...extra })

const store = () => useScheduleStore.getState()

describe('schedule actions', () => {
  beforeEach(() => {
    useScheduleStore.setState({
      currentMonth: MONTH,
      persons: [
        { id: 'p1', name: 'Ana', color: '#111111' },
        { id: 'p2', name: 'Bia', color: '#222222' },
        { id: 'p3', name: 'Caio', color: '#333333' },
      ],
      monthParticipants: { [MONTH]: ['p1', 'p2'] },
      availabilities: [],
      assignments: {},
      dayShiftAssignments: {},
      shiftDefinitions: [shiftDefinition('d12'), shiftDefinition('n12', false)],
      shiftRules: [shiftRule('r1'), shiftRule('r2', false)],
      monthActiveShifts: { [MONTH]: ['d12', 'n12'] },
      monthActiveRules: { [MONTH]: ['r1'] },
      monthDailyShifts: { [MONTH]: { d12: [20], n12: [20] } },
      monthSnapshots: {},
      hasUnsavedChanges: false,
      hasValidated: false,
      validationErrors: [],
    })
  })

  describe('assignments in the two day maps', () => {
    it('removes a replaced person from the day', () => {
      store().assignPersonToShift(DAY, 'd12', 'p1')

      store().assignPersonToShift(DAY, 'd12', 'p2')

      expect(store().dayShiftAssignments[DAY]).toEqual({ d12: 'p2' })
      expect(store().assignments[DAY]).toEqual(['p2'])
    })

    it('keeps a replaced person who still holds another shift that day', () => {
      store().assignPersonToShift(DAY, 'd12', 'p1')
      store().assignPersonToShift(DAY, 'n12', 'p1')

      store().assignPersonToShift(DAY, 'd12', 'p2')

      expect(store().dayShiftAssignments[DAY]).toEqual({ d12: 'p2', n12: 'p1' })
      expect(store().assignments[DAY]).toEqual(['p1', 'p2'])
    })

    it('does not repeat a person assigned again to the same shift', () => {
      store().assignPersonToShift(DAY, 'd12', 'p1')

      store().assignPersonToShift(DAY, 'd12', 'p1')

      expect(store().assignments[DAY]).toEqual(['p1'])
    })

    it('uses the given shift when adding a person to a day', () => {
      store().addPersonToDay(DAY, 'p1', 'n12')

      expect(store().dayShiftAssignments[DAY]).toEqual({ n12: 'p1' })
    })

    it('fills the first vacant shift of the day', () => {
      store().addPersonToDay(DAY, 'p1')
      store().addPersonToDay(DAY, 'p2')

      expect(store().dayShiftAssignments[DAY]).toEqual({ d12: 'p1', n12: 'p2' })
    })

    it('adds a person with no shift when every shift of the day is taken', () => {
      store().addPersonToDay(DAY, 'p1')
      store().addPersonToDay(DAY, 'p2')

      store().addPersonToDay(DAY, 'p3')

      expect(store().dayShiftAssignments[DAY]).toEqual({ d12: 'p1', n12: 'p2' })
      expect(store().assignments[DAY]).toEqual(['p1', 'p2', 'p3'])
    })

    it('adds a person with no shift on a day without active shifts, only once', () => {
      store().addPersonToDay('2026-06-21', 'p1')
      store().addPersonToDay('2026-06-21', 'p1')

      expect(store().assignments['2026-06-21']).toEqual(['p1'])
      expect(store().dayShiftAssignments['2026-06-21']).toBeUndefined()
      expect(store().hasUnsavedChanges).toBe(true)
    })

    it('removes a person from the day and from every shift they hold', () => {
      store().assignPersonToShift(DAY, 'd12', 'p1')
      store().assignPersonToShift(DAY, 'n12', 'p1')

      store().removePersonFromDay(DAY, 'p1')

      expect(store().assignments[DAY]).toEqual([])
      expect(store().dayShiftAssignments[DAY]).toEqual({})
    })

    it('keeps the other people when one is removed from the day', () => {
      store().assignPersonToShift(DAY, 'd12', 'p1')
      store().assignPersonToShift(DAY, 'n12', 'p2')

      store().removePersonFromDay(DAY, 'p1')

      expect(store().assignments[DAY]).toEqual(['p2'])
      expect(store().dayShiftAssignments[DAY]).toEqual({ n12: 'p2' })
    })

    it('revalidates after a change once the schedule has been validated', () => {
      useScheduleStore.setState({ hasValidated: true, validationErrors: [] })
      store().assignPersonToShift(DAY, 'd12', 'p1')

      store().assignPersonToShift(DAY, 'n12', 'p1')

      expect(store().validationErrors.length).toBeGreaterThan(0)
    })
  })

  describe('isPersonAvailable', () => {
    it.each([
      ['a day marked available', [20], {}, undefined, true],
      ['a day not marked', [21], {}, undefined, false],
      ['a day of the shift', [], { shiftAvailability: { d12: [20] } }, 'd12', true],
      ['another day of the shift', [20], { shiftAvailability: { d12: [21] } }, 'd12', false],
      ['a shift without per-shift days', [20], { shiftAvailability: { n12: [20] } }, 'd12', false],
      ['the general days without per-shift data', [20], {}, 'd12', true],
    ])('answers for %s', (_case, days, extra, shiftId, expected) => {
      useScheduleStore.setState({ availabilities: [availability('p1', days, extra)] })

      expect(store().isPersonAvailable('p1', MONTH, 20, shiftId)).toBe(expected)
    })

    it('answers no for a person with no availability that month', () => {
      expect(store().isPersonAvailable('p1', MONTH, 20)).toBe(false)
    })
  })

  describe('populateMonthWithAvailableCandidates', () => {
    it('fills empty days with the available participants of the month', () => {
      useScheduleStore.setState({
        availabilities: [availability('p1', [1]), availability('p2', [1, 2])],
      })

      store().populateMonthWithAvailableCandidates(MONTH)

      expect(store().assignments['2026-06-01']).toEqual(['p1', 'p2'])
      expect(store().assignments['2026-06-02']).toEqual(['p2'])
      expect(store().hasUnsavedChanges).toBe(true)
    })

    it('keeps days that already have people', () => {
      useScheduleStore.setState({
        assignments: { '2026-06-01': ['p2'] },
        availabilities: [availability('p1', [1])],
      })

      store().populateMonthWithAvailableCandidates(MONTH)

      expect(store().assignments['2026-06-01']).toEqual(['p2'])
    })

    it('ignores people outside the month and other months', () => {
      useScheduleStore.setState({
        availabilities: [
          availability('p3', [1]),
          { personId: 'p1', month: PAST_MONTH, availableDays: [1] },
        ],
      })

      store().populateMonthWithAvailableCandidates(MONTH)

      expect(store().assignments).toEqual({})
      expect(store().hasUnsavedChanges).toBe(false)
    })
  })

  describe('month configuration', () => {
    it('resets the month to the shifts and rules enabled by default', () => {
      store().resetMonthDefaults(MONTH)

      expect(store().monthActiveShifts[MONTH]).toEqual(['d12'])
      expect(store().monthActiveRules[MONTH]).toEqual(['r1'])
      expect(StorageService.getMonthActiveShiftsMap()[MONTH]).toEqual(['d12'])
      expect(StorageService.getMonthActiveRulesMap()[MONTH]).toEqual(['r1'])
    })

    it('leaves other months alone when resetting one', () => {
      useScheduleStore.setState({ monthActiveShifts: { [MONTH]: [], [PAST_MONTH]: ['n12'] } })

      store().resetMonthDefaults(MONTH)

      expect(store().monthActiveShifts[PAST_MONTH]).toEqual(['n12'])
    })

    it('toggles a shift of the month on and off', () => {
      store().toggleMonthShift('n12', MONTH)
      expect(store().getActiveShiftIds(MONTH)).toEqual(['d12'])
      expect(StorageService.getMonthActiveShiftsMap()[MONTH]).toEqual(['d12'])

      store().toggleMonthShift('n12', MONTH)
      expect(store().getActiveShiftIds(MONTH)).toEqual(['d12', 'n12'])
    })

    it('toggles a rule of the month on and off', () => {
      store().toggleMonthRule('r2', MONTH)
      expect(store().getActiveRuleIds(MONTH)).toEqual(['r1', 'r2'])
      expect(StorageService.getMonthActiveRulesMap()[MONTH]).toEqual(['r1', 'r2'])

      store().toggleMonthRule('r2', MONTH)
      expect(store().getActiveRuleIds(MONTH)).toEqual(['r1'])
    })

    it('adds only the shifts that are new to the month', () => {
      useScheduleStore.setState({ monthActiveShifts: { [MONTH]: ['d12'] } })

      store().addShiftsToMonth(['d12', 'n12'], MONTH)

      expect(store().getActiveShiftIds(MONTH)).toEqual(['d12', 'n12'])
      expect(StorageService.getMonthActiveShiftsMap()[MONTH]).toEqual(['d12', 'n12'])
    })

    it('adds a person to the month only once', () => {
      store().addPersonToMonth('p3', MONTH)
      store().addPersonToMonth('p3', MONTH)

      expect(store().monthParticipants[MONTH]).toEqual(['p1', 'p2', 'p3'])
      expect(StorageService.getMonthParticipants()[MONTH]).toEqual(['p1', 'p2', 'p3'])
    })
  })

  describe('duplicating registry entries', () => {
    it('copies a shift with a new id, marked name and code', () => {
      store().duplicateShiftDefinition('d12')

      const copy = store().shiftDefinitions[2]
      expect(store().shiftDefinitions).toHaveLength(3)
      expect(copy).toMatchObject({ name: 'Turno d12 (Cópia)', code: 'D12C' })
      expect(copy?.id).not.toBe('d12')
      expect(StorageService.getShiftDefinitions()).toHaveLength(3)
    })

    it('copies a rule with a new id and marked name', () => {
      store().duplicateShiftRule('r1')

      const copy = store().shiftRules[2]
      expect(store().shiftRules).toHaveLength(3)
      expect(copy).toMatchObject({ name: 'Regra r1 (Cópia)', type: 'MAX_SHIFTS_PER_PERIOD' })
      expect(copy?.id).not.toBe('r1')
    })

    it('ignores an id that does not exist', () => {
      store().duplicateShiftDefinition('nope')
      store().duplicateShiftRule('nope')

      expect(store().shiftDefinitions).toHaveLength(2)
      expect(store().shiftRules).toHaveLength(2)
    })

    it('freezes past months before changing the registry', () => {
      useScheduleStore.setState({ assignments: { '2026-05-10': ['p1'] } })

      store().duplicateShiftDefinition('d12')

      expect(store().monthSnapshots[PAST_MONTH]?.shiftDefinitions).toHaveLength(2)
    })
  })
})
