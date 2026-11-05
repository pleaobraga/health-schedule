import { describe, expect, it } from 'vitest'

import {
  createMedicationId,
  getCurrentMedicationVersion,
  getMedicationVersionAt,
  getMedicationVersionChanges,
  getMedicationVersionHistory,
  groupMedicationsBySource,
  normalizeMedicationVersionInput,
  searchMedicationProfessionals,
  validateMedicationVersionInput,
} from './medication-schedule-utils'

import type {
  MedicationScheduleVersion,
  MedicationVersionInput,
} from '../types'

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

  describe('normalizeMedicationVersionInput', () => {
    it('trims strings, drops empty optional fields, drops blank or orphan doses, sorts times, and preserves free-text doses', () => {
      const raw: MedicationVersionInput = {
        effectiveDate: ' 2026-03-13 ',
        professional: '  Dra. Ana Lima  ',
        explanation: '  Reduziu dose noturna  ',
        medications: [
          {
            id: ' med-1 ',
            name: '  Prolopa  ',
            dosage: ' ',
            source: '',
            responsible: '   ',
          },
          {
            id: 'med-2',
            name: ' Quetiapina ',
            dosage: ' 200mg ',
            source: ' Farmácia Popular ',
            responsible: ' Psiquiatra ',
          },
        ],
        times: ['21:00', ' 06:00 '],
        doses: {
          'med-1': {
            '06:00': ' 1.5 comprimidos ',
            '21:00': '   ',
            '14:00': '1 comprimido',
          },
          'med-2': {
            '21:00': '2 gotas',
          },
          'med-orphan': {
            '06:00': '1 comprimido',
          },
        },
      }

      const normalized = normalizeMedicationVersionInput(raw)
      expect(normalized).toEqual({
        effectiveDate: '2026-03-13',
        professional: 'Dra. Ana Lima',
        explanation: 'Reduziu dose noturna',
        medications: [
          {
            id: 'med-1',
            name: 'Prolopa',
          },
          {
            id: 'med-2',
            name: 'Quetiapina',
            dosage: '200mg',
            source: 'Farmácia Popular',
            responsible: 'Psiquiatra',
          },
        ],
        times: ['06:00', '21:00'],
        doses: {
          'med-1': {
            '06:00': '1.5 comprimidos',
          },
          'med-2': {
            '21:00': '2 gotas',
          },
        },
      })
      expect(normalized.medications[0]).not.toHaveProperty('dosage')
      expect(normalized.medications[0]).not.toHaveProperty('source')
      expect(normalized.medications[0]).not.toHaveProperty('responsible')
    })
  })

  describe('validateMedicationVersionInput', () => {
    const validInput: MedicationVersionInput = {
      effectiveDate: '2026-03-13',
      professional: 'Dra. Ana Lima',
      explanation: 'Início do tratamento',
      medications: [{ id: 'med-1', name: 'Prolopa', dosage: '100/25' }],
      times: ['06:00', '21:00'],
      doses: {
        'med-1': { '06:00': '1 comprimido' },
      },
    }

    it('returns no errors when input is valid and date equals today or latest version date', () => {
      const existing = [version('v1', '2026-03-13')]
      expect(
        validateMedicationVersionInput(validInput, existing, {
          today: '2026-03-13',
        }),
      ).toEqual([])
    })

    it.each(['', '13/03/2026', '2026-02-30', '2026-13-01', '2026-00-10'])(
      'returns DATE_INVALID for invalid date "%s"',
      (invalidDate) => {
        const errors = validateMedicationVersionInput(
          { ...validInput, effectiveDate: invalidDate },
          [],
          { today: '2026-11-05' },
        )
        expect(errors).toContainEqual({ code: 'DATE_INVALID' })
      },
    )

    it('returns DATE_IN_FUTURE when effectiveDate is after today', () => {
      const errors = validateMedicationVersionInput(
        { ...validInput, effectiveDate: '2026-11-06' },
        [],
        { today: '2026-11-05' },
      )
      expect(errors).toContainEqual({ code: 'DATE_IN_FUTURE' })
    })

    it('returns DATE_BEFORE_LATEST when creating a new version before the latest version date', () => {
      const existing = [
        version('v1', '2026-02-13'),
        version('v2', '2026-03-20'),
      ]
      const errors = validateMedicationVersionInput(
        { ...validInput, effectiveDate: '2026-03-19' },
        existing,
        { today: '2026-11-05' },
      )
      expect(errors).toContainEqual({ code: 'DATE_BEFORE_LATEST' })
    })

    it('validates DATE_OUT_OF_RANGE when editing a version against its neighbor versions', () => {
      const existing = [
        version('v1', '2026-02-10'),
        version('v2', '2026-03-10'),
        version('v3', '2026-04-10'),
      ]

      // Equal to next version date -> valid
      expect(
        validateMedicationVersionInput(
          { ...validInput, effectiveDate: '2026-04-10' },
          existing,
          { today: '2026-11-05', editingVersionId: 'v2' },
        ),
      ).toEqual([])

      // Equal to previous version date -> valid
      expect(
        validateMedicationVersionInput(
          { ...validInput, effectiveDate: '2026-02-10' },
          existing,
          { today: '2026-11-05', editingVersionId: 'v2' },
        ),
      ).toEqual([])

      // After next version -> DATE_OUT_OF_RANGE
      expect(
        validateMedicationVersionInput(
          { ...validInput, effectiveDate: '2026-04-11' },
          existing,
          { today: '2026-11-05', editingVersionId: 'v2' },
        ),
      ).toContainEqual({ code: 'DATE_OUT_OF_RANGE' })

      // Before previous version -> DATE_OUT_OF_RANGE
      expect(
        validateMedicationVersionInput(
          { ...validInput, effectiveDate: '2026-02-09' },
          existing,
          { today: '2026-11-05', editingVersionId: 'v2' },
        ),
      ).toContainEqual({ code: 'DATE_OUT_OF_RANGE' })

      // Editing first version with an older date -> valid (no previous neighbor)
      expect(
        validateMedicationVersionInput(
          { ...validInput, effectiveDate: '2025-01-01' },
          existing,
          { today: '2026-11-05', editingVersionId: 'v1' },
        ),
      ).toEqual([])
    })

    it('returns PROFESSIONAL_REQUIRED and EXPLANATION_REQUIRED when blank', () => {
      const errors = validateMedicationVersionInput(
        { ...validInput, professional: '  ', explanation: '' },
        [],
        { today: '2026-11-05' },
      )
      expect(errors).toContainEqual({ code: 'PROFESSIONAL_REQUIRED' })
      expect(errors).toContainEqual({ code: 'EXPLANATION_REQUIRED' })
    })

    it('returns MEDICATION_REQUIRED when medications array is empty', () => {
      const errors = validateMedicationVersionInput(
        { ...validInput, medications: [] },
        [],
        { today: '2026-11-05' },
      )
      expect(errors).toContainEqual({ code: 'MEDICATION_REQUIRED' })
    })

    it('returns MEDICATION_NAME_REQUIRED with medicationId when a medication has an empty name', () => {
      const errors = validateMedicationVersionInput(
        {
          ...validInput,
          medications: [{ id: 'med-empty', name: '   ' }],
        },
        [],
        { today: '2026-11-05' },
      )
      expect(errors).toContainEqual({
        code: 'MEDICATION_NAME_REQUIRED',
        medicationId: 'med-empty',
      })
    })

    it('allows same medication name with different dosages (25mg vs 200mg) and rejects duplicates with same normalized name and dosage', () => {
      expect(
        validateMedicationVersionInput(
          {
            ...validInput,
            medications: [
              { id: 'm1', name: 'Quetiapina', dosage: '25mg' },
              { id: 'm2', name: 'Quetiapina', dosage: '200mg' },
            ],
          },
          [],
          { today: '2026-11-05' },
        ),
      ).toEqual([])

      const dupErrors = validateMedicationVersionInput(
        {
          ...validInput,
          medications: [
            { id: 'm1', name: 'Quetiapina' },
            { id: 'm2', name: 'quetiapina ' },
          ],
        },
        [],
        { today: '2026-11-05' },
      )
      expect(dupErrors).toContainEqual({
        code: 'DUPLICATE_MEDICATION',
        medicationId: 'm2',
      })
    })

    it('returns TIME_REQUIRED when times array is empty', () => {
      const errors = validateMedicationVersionInput(
        { ...validInput, times: [] },
        [],
        { today: '2026-11-05' },
      )
      expect(errors).toContainEqual({ code: 'TIME_REQUIRED' })
    })

    it.each(['7:00', '24:00', '12:60', ''])(
      'returns TIME_INVALID for invalid time "%s"',
      (badTime) => {
        const errors = validateMedicationVersionInput(
          { ...validInput, times: [badTime] },
          [],
          { today: '2026-11-05' },
        )
        expect(errors).toContainEqual({
          code: 'TIME_INVALID',
          time: badTime,
        })
      },
    )

    it('returns DUPLICATE_TIME when the same time is repeated', () => {
      const errors = validateMedicationVersionInput(
        { ...validInput, times: ['06:00', '21:00', '06:00'] },
        [],
        { today: '2026-11-05' },
      )
      expect(errors).toContainEqual({
        code: 'DUPLICATE_TIME',
        time: '06:00',
      })
    })
  })

  describe('groupMedicationsBySource and searchMedicationProfessionals', () => {
    it('groups by source, with medications without a source last', () => {
      const groups = groupMedicationsBySource({
        medications: [
          { id: 'm1', name: 'Dutam' },
          { id: 'm2', name: 'Prolopa', source: 'Posto de Saúde' },
          { id: 'm3', name: 'Rasagilina', source: 'Farmácia de Minas' },
          { id: 'm4', name: 'Entacapona', source: 'posto de saude' },
        ],
      })

      expect(
        groups.map((g) => [g.source, g.medications.map((m) => m.id)]),
      ).toEqual([
        ['Posto de Saúde', ['m2', 'm4']],
        ['Farmácia de Minas', ['m3']],
        [null, ['m1']],
      ])
    })

    it('returns empty array when version has no medications', () => {
      expect(groupMedicationsBySource({ medications: [] })).toEqual([])
    })

    it('suggests recent professionals without repeats', () => {
      const versions = [
        version('v1', '2026-01-01', { professional: 'Dra. Ana Lima' }),
        version('v2', '2026-02-01', { professional: 'Dr. Pedro Lima' }),
        version('v3', '2026-03-01', { professional: 'dra. ana lima' }),
      ]

      expect(searchMedicationProfessionals('lim', versions)).toEqual([
        'dra. ana lima',
        'Dr. Pedro Lima',
      ])
      expect(searchMedicationProfessionals('li', versions)).toEqual([])
    })

    it('returns at most 4 professional suggestions ordered from newest to oldest', () => {
      const versions = [
        version('v1', '2026-01-01', { professional: 'Dr. Carlos Silva' }),
        version('v2', '2026-02-01', { professional: 'Dra. Beatriz Silva' }),
        version('v3', '2026-03-01', { professional: 'Dr. Eduardo Silva' }),
        version('v4', '2026-04-01', { professional: 'Dra. Fernanda Silva' }),
        version('v5', '2026-05-01', { professional: 'Dr. Gabriel Silva' }),
      ]

      expect(searchMedicationProfessionals('silva', versions)).toEqual([
        'Dr. Gabriel Silva',
        'Dra. Fernanda Silva',
        'Dr. Eduardo Silva',
        'Dra. Beatriz Silva',
      ])
    })
  })
})
