import { describe, expect, it } from 'vitest'

import {
  captureMonthSnapshots,
  getMonthReferencedIds,
  getMonthRegistry,
} from './month-registry'

import type { MonthRegistrySnapshot, Person, ShiftDefinition, ShiftRule } from '../types'

const person = (id: string, name: string): Person => ({ id, name, color: '#000000' })

const shift = (id: string, name: string): ShiftDefinition => ({
  id,
  name,
  code: id,
  startTime: '07:00',
  durationHours: 12,
  color: '#000000',
  enabledByDefault: true,
  createdAt: '2020-01-01',
  updatedAt: '2020-01-01',
})

const rule = (id: string, name: string): ShiftRule => ({
  id,
  name,
  type: 'CONSECUTIVE_DAYS_LIMIT',
  enabledByDefault: true,
  severity: 'ERROR',
  parameters: { consecutiveDaysLimit: 1 },
  createdAt: '2020-01-01',
  updatedAt: '2020-01-01',
})

const snapshot: MonthRegistrySnapshot = {
  capturedAt: '2026-11-01T10:00:00.000Z',
  persons: [person('p1', 'Nome antigo')],
  shiftDefinitions: [shift('s1', 'Turno antigo')],
  shiftRules: [rule('r1', 'Regra antiga')],
  activeShiftIds: ['s1'],
  activeRuleIds: ['r1'],
}

const live = {
  persons: [person('p1', 'Nome novo'), person('p2', 'Pessoa nova')],
  shiftDefinitions: [shift('s1', 'Turno novo'), shift('s2', 'Turno adicional')],
  shiftRules: [rule('r1', 'Regra nova'), rule('r2', 'Regra adicional')],
}

const noReferences = { personIds: [], shiftIds: [], ruleIds: [] }

describe('getMonthRegistry', () => {
  it.each(['2026-11', '2026-12'])('uses live registries for %s, even with a snapshot', (month) => {
    const registry = getMonthRegistry({
      month,
      today: '2026-11',
      snapshot,
      ...live,
      referencedIds: noReferences,
    })

    expect(registry.persons.map((p) => p.name)).toEqual(['Nome novo', 'Pessoa nova'])
  })

  it('uses live registries for a past month without a snapshot', () => {
    const registry = getMonthRegistry({
      month: '2026-10',
      today: '2026-11',
      ...live,
      referencedIds: noReferences,
    })

    expect(registry.shiftDefinitions.map((s) => s.name)).toEqual(['Turno novo', 'Turno adicional'])
  })

  it('uses the snapshot for a past month and hides unreferenced new records', () => {
    const registry = getMonthRegistry({
      month: '2026-10',
      today: '2026-11',
      snapshot,
      ...live,
      referencedIds: noReferences,
    })

    expect(registry.persons.map((p) => p.name)).toEqual(['Nome antigo'])
    expect(registry.shiftDefinitions.map((s) => s.name)).toEqual(['Turno antigo'])
    expect(registry.shiftRules.map((r) => r.name)).toEqual(['Regra antiga'])
  })

  it('adds live records the month references when the snapshot lacks them', () => {
    const registry = getMonthRegistry({
      month: '2026-10',
      today: '2026-11',
      snapshot,
      ...live,
      referencedIds: { personIds: ['p2'], shiftIds: ['s2'], ruleIds: ['r2'] },
    })

    expect(registry.persons.map((p) => p.name)).toEqual(['Nome antigo', 'Pessoa nova'])
    expect(registry.shiftDefinitions.map((s) => s.name)).toEqual(['Turno antigo', 'Turno adicional'])
    expect(registry.shiftRules.map((r) => r.name)).toEqual(['Regra antiga', 'Regra adicional'])
  })
})

describe('getMonthReferencedIds', () => {
  it('collects only the ids used by the given month', () => {
    const referenced = getMonthReferencedIds('2026-10', {
      assignments: { '2026-10-01': ['p1'], '2026-11-01': ['other'] },
      dayShiftAssignments: { '2026-10-02': { s1: 'p2' }, '2026-09-01': { other: 'other' } },
      monthParticipants: { '2026-10': ['p3'] },
      availabilities: [
        { personId: 'p4', month: '2026-10', availableDays: [] },
        { personId: 'other', month: '2026-11', availableDays: [] },
      ],
      events: [{ id: 'e1', date: '2026-10-03', title: 'Evento', personId: 'p5' }],
      expenses: [
        {
          id: 'x1',
          date: '2026-10-04',
          description: 'Gasto',
          amount: 10,
          personId: 'p6',
          items: [],
          createdAt: '2026-10-04',
          updatedAt: '2026-10-04',
        },
      ],
      monthDailyShifts: { '2026-10': { s2: [1] } },
      monthActiveShifts: { '2026-10': ['s3'] },
      monthActiveRules: { '2026-10': ['r1'] },
    })

    expect([...referenced.personIds].sort()).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6'])
    expect([...referenced.shiftIds].sort()).toEqual(['s1', 's2', 's3'])
    expect(referenced.ruleIds).toEqual(['r1'])
  })
})

describe('captureMonthSnapshots', () => {
  const baseInput = {
    today: '2026-11',
    capturedAt: '2026-11-05T10:00:00.000Z',
    ...live,
    getActiveShiftIds: () => ['s1', 's2'],
    getActiveRuleIds: () => ['r1'],
  }

  it('creates a snapshot only for past months with data', () => {
    const result = captureMonthSnapshots({
      ...baseInput,
      existing: {},
      months: ['2026-10', '2026-11', '2026-12'],
      data: {
        assignments: {
          '2026-10-01': ['p1'],
          '2026-11-01': ['p1'],
          '2026-12-01': ['p1'],
        },
      },
    })

    expect(Object.keys(result.snapshots)).toEqual(['2026-10'])
    expect(result.changedMonths).toEqual(['2026-10'])
    expect(result.snapshots['2026-10']).toEqual({
      capturedAt: '2026-11-05T10:00:00.000Z',
      ...live,
      activeShiftIds: ['s1', 's2'],
      activeRuleIds: ['r1'],
    })
  })

  it('keeps stored records and reports no change when nothing is missing', () => {
    const result = captureMonthSnapshots({
      ...baseInput,
      existing: { '2026-10': snapshot },
      months: ['2026-10'],
      data: { assignments: { '2026-10-01': ['p1'] } },
    })

    expect(result.snapshots['2026-10']).toEqual(snapshot)
    expect(result.changedMonths).toEqual([])
  })

  it('adds referenced records missing from a snapshot without overwriting the others', () => {
    const result = captureMonthSnapshots({
      ...baseInput,
      existing: { '2026-10': snapshot },
      months: ['2026-10'],
      data: {
        assignments: { '2026-10-01': ['p1', 'p2'] },
        dayShiftAssignments: { '2026-10-01': { s2: 'p2' } },
      },
    })

    const updated = result.snapshots['2026-10']
    expect(updated.persons.map((p) => p.name)).toEqual(['Nome antigo', 'Pessoa nova'])
    expect(updated.shiftDefinitions.map((s) => s.name)).toEqual(['Turno antigo', 'Turno adicional'])
    expect(updated.capturedAt).toBe(snapshot.capturedAt)
    expect(result.changedMonths).toEqual(['2026-10'])
  })
})
