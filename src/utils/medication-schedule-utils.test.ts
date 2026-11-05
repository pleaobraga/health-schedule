import { describe, expect, it } from 'vitest'

import {
  createMedicationId,
  getCurrentMedicationVersion,
  getMedicationVersionAt,
  getMedicationVersionChanges,
  getMedicationVersionHistory,
} from './medication-schedule-utils'

import type { MedicationScheduleVersion } from '../types'

const version = (
  id: string,
  effectiveDate: string,
  overrides: Partial<MedicationScheduleVersion> = {},
  createdAt = `${effectiveDate}T10:00:00Z`,
): MedicationScheduleVersion => ({
  id,
  effectiveDate,
  professional: 'Dra. Ana Lima',
  explanation: 'Ajuste de rotina',
  medications: [
    { id: 'med-1', name: 'Prolopa', dosage: '100/25' },
    { id: 'med-2', name: 'Quetiapina', dosage: '200mg' },
  ],
  times: ['06:00', '21:00'],
  doses: {
    'med-1': { '06:00': '1 comprimido' },
    'med-2': { '21:00': '1 comprimido' },
  },
  createdAt,
  updatedAt: createdAt,
  ...overrides,
})

describe('medication-schedule-utils', () => {
  describe('createMedicationId', () => {
    it('creates unique medication IDs starting with med_', () => {
      const id1 = createMedicationId()
      const id2 = createMedicationId()
      expect(id1).toMatch(/^med_\d+_/)
      expect(id2).toMatch(/^med_\d+_/)
      expect(id1).not.toBe(id2)
    })
  })

  describe('getMedicationVersionAt, getCurrentMedicationVersion, and getMedicationVersionHistory', () => {
    const versions = [
      version('v2', '2026-03-13', {}, '2026-03-13T10:00:00Z'),
      version('v1', '2026-02-13', {}, '2026-02-13T10:00:00Z'),
      version('v3', '2026-03-13', {}, '2026-03-13T18:00:00Z'),
    ]

    it.each([
      ['2026-02-12', undefined],
      ['2026-02-13', 'v1'],
      ['2026-03-01', 'v1'],
      ['2026-03-13', 'v3'],
      ['2026-12-31', 'v3'],
    ])('finds the version in force on %s', (date, expected) => {
      expect(getMedicationVersionAt(versions, date)?.id).toBe(expected)
    })

    it('returns undefined without versions', () => {
      expect(getCurrentMedicationVersion([], '2026-11-05')).toBeUndefined()
    })

    it('returns the version in force on today via getCurrentMedicationVersion', () => {
      expect(getCurrentMedicationVersion(versions, '2026-03-01')?.id).toBe('v1')
      expect(getCurrentMedicationVersion(versions, '2026-03-13')?.id).toBe('v3')
    })

    it('lists versions from newest to oldest, comparing each with the previous one', () => {
      const history = getMedicationVersionHistory(versions)
      expect(history.map((entry) => entry.version.id)).toEqual([
        'v3',
        'v2',
        'v1',
      ])
      expect(history[2].changes).toEqual([])
    })
  })

  describe('getMedicationVersionChanges', () => {
    const base = version('v1', '2026-02-13', {
      medications: [
        {
          id: 'med-1',
          name: 'Prolopa',
          dosage: '100/25',
          source: 'Posto de Saúde',
          responsible: 'Neurologista',
        },
        {
          id: 'med-2',
          name: 'Quetiapina',
        },
      ],
      times: ['06:00', '21:00'],
      doses: {
        'med-1': { '06:00': '1 comprimido' },
        'med-2': { '21:00': '1 comprimido' },
      },
    })

    it('returns empty array when previous is undefined', () => {
      expect(getMedicationVersionChanges(undefined, base)).toEqual([])
    })

    it('returns empty array when versions are equal', () => {
      const copy = structuredClone(base)
      expect(getMedicationVersionChanges(base, copy)).toEqual([])
    })

    it('detects MEDICATION_ADDED without emitting DOSE_CHANGED for the added medication', () => {
      const next = version('v2', '2026-03-13', {
        medications: [
          ...base.medications,
          { id: 'med-3', name: 'Dutam', dosage: '0.5mg' },
        ],
        times: base.times,
        doses: {
          ...base.doses,
          'med-3': { '21:00': '1 cápsula' },
        },
      })
      expect(getMedicationVersionChanges(base, next)).toEqual([
        {
          type: 'MEDICATION_ADDED',
          medicationId: 'med-3',
          name: 'Dutam',
          dosage: '0.5mg',
        },
      ])
    })

    it('detects MEDICATION_REMOVED using the name from previous', () => {
      const next = version('v2', '2026-03-13', {
        medications: [base.medications[0]],
        times: base.times,
        doses: {
          'med-1': { '06:00': '1 comprimido' },
        },
      })
      expect(getMedicationVersionChanges(base, next)).toEqual([
        {
          type: 'MEDICATION_REMOVED',
          medicationId: 'med-2',
          name: 'Quetiapina',
        },
      ])
    })

    it('detects MEDICATION_RENAMED when id is the same with another name, without adding or removing', () => {
      const next = version('v2', '2026-03-13', {
        medications: [
          base.medications[0],
          { id: 'med-2', name: 'Hemifumarato de Quetiapina' },
        ],
        times: base.times,
        doses: base.doses,
      })
      expect(getMedicationVersionChanges(base, next)).toEqual([
        {
          type: 'MEDICATION_RENAMED',
          medicationId: 'med-2',
          from: 'Quetiapina',
          to: 'Hemifumarato de Quetiapina',
        },
      ])
    })

    it('detects DOSAGE_CHANGED from undefined to 200mg', () => {
      const next = version('v2', '2026-03-13', {
        medications: [
          base.medications[0],
          { id: 'med-2', name: 'Quetiapina', dosage: '200mg' },
        ],
        times: base.times,
        doses: base.doses,
      })
      expect(getMedicationVersionChanges(base, next)).toEqual([
        {
          type: 'DOSAGE_CHANGED',
          medicationId: 'med-2',
          name: 'Quetiapina',
          from: undefined,
          to: '200mg',
        },
      ])
    })

    it('detects SOURCE_CHANGED', () => {
      const next = version('v2', '2026-03-13', {
        medications: [
          { ...base.medications[0], source: 'Farmácia Popular' },
          base.medications[1],
        ],
        times: base.times,
        doses: base.doses,
      })
      expect(getMedicationVersionChanges(base, next)).toEqual([
        {
          type: 'SOURCE_CHANGED',
          medicationId: 'med-1',
          name: 'Prolopa',
          from: 'Posto de Saúde',
          to: 'Farmácia Popular',
        },
      ])
    })

    it('detects RESPONSIBLE_CHANGED', () => {
      const next = version('v2', '2026-03-13', {
        medications: [
          { ...base.medications[0], responsible: 'Geriatra' },
          base.medications[1],
        ],
        times: base.times,
        doses: base.doses,
      })
      expect(getMedicationVersionChanges(base, next)).toEqual([
        {
          type: 'RESPONSIBLE_CHANGED',
          medicationId: 'med-1',
          name: 'Prolopa',
          from: 'Neurologista',
          to: 'Geriatra',
        },
      ])
    })

    it('detects TIME_ADDED and TIME_REMOVED', () => {
      const next = version('v2', '2026-03-13', {
        medications: base.medications,
        times: ['06:00', '14:00'],
        doses: {
          'med-1': { '06:00': '1 comprimido' },
        },
      })
      const changes = getMedicationVersionChanges(base, next)
      expect(changes).toContainEqual({ type: 'TIME_ADDED', time: '14:00' })
      expect(changes).toContainEqual({ type: 'TIME_REMOVED', time: '21:00' })
    })

    it('detects DOSE_CHANGED from "1 comprimido" to "0.5 comprimido" at 21:00', () => {
      const next = version('v2', '2026-03-13', {
        medications: base.medications,
        times: base.times,
        doses: {
          'med-1': { '06:00': '1 comprimido' },
          'med-2': { '21:00': '0.5 comprimido' },
        },
      })
      expect(getMedicationVersionChanges(base, next)).toEqual([
        {
          type: 'DOSE_CHANGED',
          medicationId: 'med-2',
          name: 'Quetiapina',
          time: '21:00',
          from: '1 comprimido',
          to: '0.5 comprimido',
        },
      ])
    })

    it('ignores case and outer whitespace differences in dose comparison', () => {
      const prevWithCaps = version('v1', '2026-02-13', {
        medications: base.medications,
        times: base.times,
        doses: {
          'med-1': { '06:00': '1 Comprimido' },
          'med-2': { '21:00': '1 comprimido' },
        },
      })
      const nextWithLowerAndSpaces = version('v2', '2026-03-13', {
        medications: base.medications,
        times: base.times,
        doses: {
          'med-1': { '06:00': ' 1 comprimido ' },
          'med-2': { '21:00': '1 comprimido' },
        },
      })
      expect(
        getMedicationVersionChanges(prevWithCaps, nextWithLowerAndSpaces),
      ).toEqual([])
    })

    it('detects DOSE_CHANGED with to: undefined when a dose is removed', () => {
      const next = version('v2', '2026-03-13', {
        medications: base.medications,
        times: base.times,
        doses: {
          'med-1': { '06:00': '1 comprimido' },
        },
      })
      expect(getMedicationVersionChanges(base, next)).toEqual([
        {
          type: 'DOSE_CHANGED',
          medicationId: 'med-2',
          name: 'Quetiapina',
          time: '21:00',
          from: '1 comprimido',
          to: undefined,
        },
      ])
    })
  })
})
