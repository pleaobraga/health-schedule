import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import {
  exportAppData,
  validateAndParseBackup,
  restoreAppData,
  mergeAppData,
  hasExistingLocalData,
  getBackupFilename,
} from './backup-service'
import { StorageService } from './storage-service'
import { useScheduleStore } from '../store/use-schedule-store'

import type { AppDataSnapshot } from '../types'

describe('BackupService', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('getBackupFilename', () => {
    it('builds the escala_backup_YYYY-MM-DD_HHmm.json file name', () => {
      const fixedDate = new Date(2026, 9, 17, 18, 45) // 2026-10-17 18:45
      const filename = getBackupFilename(fixedDate)
      expect(filename).toBe('escala_backup_2026-10-17_1845.json')
    })
  })

  describe('hasExistingLocalData', () => {
    it('returns false when localStorage is empty', async () => {
      const exists = await hasExistingLocalData()
      expect(exists).toBe(false)
    })

    it('returns false when the keys exist but are empty', async () => {
      localStorage.setItem('scale_manager_persons_v1', JSON.stringify([]))
      localStorage.setItem('scale_manager_assignments_v1', JSON.stringify({}))
      localStorage.setItem('scale_manager_month_participants_v1', JSON.stringify({}))

      const exists = await hasExistingLocalData()
      expect(exists).toBe(false)
    })

    it.each([
      ['people', 'scale_manager_persons_v1', [{ id: 'p1', name: 'Dr. Lucas', color: '#10b981' }]],
      ['assignments', 'scale_manager_assignments_v1', { '2026-10-01': ['p1'] }],
      ['month participants', 'scale_manager_month_participants_v1', { '2026-10': ['p1', 'p2'] }],
      ['events', 'scale_manager_events_v1', [{ id: 'e1', date: '2026-10-05', title: 'Shift' }]],
    ])('returns true when %s are saved', async (_label, key, value) => {
      localStorage.setItem(key, JSON.stringify(value))

      expect(await hasExistingLocalData()).toBe(true)
    })
  })

  describe('exportAppData', () => {
    it('downloads a full snapshot of the app data', async () => {
      StorageService.savePersons([{ id: 'p1', name: 'Dra. Camila', color: '#3b82f6' }])
      StorageService.saveMonthParticipants({ '2026-10': ['p1'] })
      StorageService.saveAssignments({ '2026-10-01': ['p1'] })

      const createObjectURLMock = vi.fn().mockReturnValue('blob:test-url')
      const revokeObjectURLMock = vi.fn()
      window.URL.createObjectURL = createObjectURLMock
      window.URL.revokeObjectURL = revokeObjectURLMock

      let clicked = false
      let downloadFilename = ''
      const appendChildSpy = vi.spyOn(document.body, 'appendChild')
      const removeChildSpy = vi.spyOn(document.body, 'removeChild')

      const originalCreateElement = document.createElement.bind(document)
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = originalCreateElement(tagName)
        if (tagName === 'a') {
          el.click = () => {
            clicked = true
            downloadFilename = (el as HTMLAnchorElement).download
          }
        }
        return el
      })

      await exportAppData()

      expect(createObjectURLMock).toHaveBeenCalled()
      expect(clicked).toBe(true)
      expect(downloadFilename).toMatch(/^escala_backup_\d{4}-\d{2}-\d{2}_\d{4}\.json$/)
      expect(appendChildSpy).toHaveBeenCalled()
      expect(removeChildSpy).toHaveBeenCalled()
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-url')
    })
  })

  describe('validateAndParseBackup', () => {
    it('rejects a null or undefined file', async () => {
      await expect(validateAndParseBackup(null as unknown as File)).rejects.toThrow(
        'Nenhum arquivo foi selecionado.'
      )
    })

    it('rejects a corrupted or invalid JSON file', async () => {
      const file = new File(['{ invalid json content '], 'backup.json', { type: 'application/json' })
      await expect(validateAndParseBackup(file)).rejects.toThrow(
        'Arquivo de backup inválido: formato JSON corrompido ou ilegível.'
      )
    })

    it('rejects JSON that is not an object', async () => {
      const file = new File(['["item1", "item2"]'], 'backup.json', { type: 'application/json' })
      await expect(validateAndParseBackup(file)).rejects.toThrow(
        'Estrutura do arquivo inválida: o backup deve ser um objeto JSON.'
      )
    })

    it('rejects JSON without a people list', async () => {
      const file = new File([JSON.stringify({ monthParticipants: {} })], 'backup.json', {
        type: 'application/json',
      })
      await expect(validateAndParseBackup(file)).rejects.toThrow(
        'Estrutura do arquivo inválida: campo "people" ausente ou inválido.'
      )
    })

    it('rejects people without id or name', async () => {
      const file = new File(
        [JSON.stringify({ people: [{ id: 'p1' }] })],
        'backup.json',
        { type: 'application/json' }
      )
      await expect(validateAndParseBackup(file)).rejects.toThrow(
        'Estrutura do arquivo inválida: profissional com formato incorreto (id ou name ausente).'
      )
    })

    it('returns a normalized snapshot that keeps the metadata', async () => {
      const payload = {
        exportedAt: '2026-10-17T12:00:00.000Z',
        people: [{ id: 'p1', name: 'Dr. Roberto', color: '#10b981', specialty: 'Cardiologia' }],
        monthParticipants: { '2026-10': ['p1'] },
        availabilities: [{ personId: 'p1', month: '2026-10', availableDays: [1, 2, 3] }],
        assignments: { '2026-10-01': ['p1'] },
        events: [{ id: 'ev-1', date: '2026-10-01', title: 'Reunião Inicial' }],
        customSetting: 'hospital_central',
      }

      const file = new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' })
      const parsed = await validateAndParseBackup(file)

      expect(parsed.people).toHaveLength(1)
      expect(parsed.people[0].name).toBe('Dr. Roberto')
      expect((parsed.people[0] as Record<string, unknown>).specialty).toBe('Cardiologia')
      expect(parsed.monthParticipants['2026-10']).toEqual(['p1'])
      expect(parsed.assignments['2026-10-01']).toEqual(['p1'])
      expect(parsed.events).toHaveLength(1)
      expect((parsed as Record<string, unknown>).customSetting).toBe('hospital_central')
    })

    it('accepts "persons" as a fallback for "people"', async () => {
      const payload = {
        persons: [{ id: 'p2', name: 'Dra. Julia', color: '#ec4899' }],
      }

      const file = new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' })
      const parsed = await validateAndParseBackup(file)

      expect(parsed.people).toHaveLength(1)
      expect(parsed.people[0].name).toBe('Dra. Julia')
    })
  })

  describe('restoreAppData', () => {
    it('saves the data, updates the store and goes back to the calendar', async () => {
      useScheduleStore.setState({ currentView: 'import', isEditMode: true })

      const snapshot: AppDataSnapshot = {
        exportedAt: '2026-10-17T15:00:00.000Z',
        people: [{ id: 'p_restore', name: 'Enf. Mariana', color: '#8b5cf6' }],
        monthParticipants: { '2026-11': ['p_restore'] },
        availabilities: [{ personId: 'p_restore', month: '2026-11', availableDays: [5, 10] }],
        assignments: { '2026-11-05': ['p_restore'] },
        events: [{ id: 'ev_11', date: '2026-11-05', title: 'Abertura Turno' }],
        theme: 'dark',
      }

      await restoreAppData(snapshot)

      // Verify StorageService
      const loadedPersons = StorageService.getPersons()
      expect(loadedPersons.find((p) => p.id === 'p_restore')).toBeDefined()

      const loadedParticipants = StorageService.getMonthParticipants()
      expect(loadedParticipants['2026-11']).toEqual(['p_restore'])

      // Verify store
      const storeState = useScheduleStore.getState()
      expect(storeState.currentView).toBe('calendar')
      expect(storeState.isEditMode).toBe(false)
      expect(storeState.hasUnsavedChanges).toBe(false)
      expect(storeState.persons).toHaveLength(1)
      expect(storeState.persons[0].name).toBe('Enf. Mariana')
      expect(storeState.isDarkMode).toBe(true)
    })

    it('restores shifts, rules and daily shift settings', async () => {
      const snapshot: AppDataSnapshot = {
        exportedAt: '2026-10-20T17:00:00.000Z',
        people: [{ id: 'p1', name: 'Dr. Lucas', color: '#3b82f6' }],
        monthParticipants: { '2026-10': ['p1'] },
        availabilities: [{ personId: 'p1', month: '2026-10', availableDays: [1, 2], shiftRates: { s1: { 1: 1500 } } }],
        assignments: { '2026-10-01': ['p1'] },
        events: [],
        shiftDefinitions: [
          {
            id: 's1',
            name: 'Plantão Diurno',
            code: 'D12',
            startTime: '07:00',
            durationHours: 12,
            color: '#3b82f6',
            enabledByDefault: true,
            createdAt: '2026-10-20T00:00:00.000Z',
            updatedAt: '2026-10-20T00:00:00.000Z',
          },
        ],
        shiftRules: [
          {
            id: 'r1',
            name: 'Intervalo mínimo',
            description: 'Descanso',
            type: 'MIN_REST_HOURS',
            enabledByDefault: true,
            severity: 'ERROR',
            parameters: { minRestHours: 11 },
            createdAt: '2026-10-20T00:00:00.000Z',
            updatedAt: '2026-10-20T00:00:00.000Z',
          },
        ],
        monthActiveShifts: { '2026-10': ['s1'] },
        monthActiveRules: { '2026-10': ['r1'] },
        monthDailyShifts: { '2026-10': { s1: [1, 2, 3] } },
        dayShiftAssignments: { '2026-10-01': { s1: 'p1' } },
      }

      await restoreAppData(snapshot)

      expect(StorageService.getShiftDefinitions()).toHaveLength(1)
      expect(StorageService.getShiftDefinitions()[0].id).toBe('s1')
      expect(StorageService.getShiftRules()).toHaveLength(1)
      expect(StorageService.getMonthActiveShiftsMap()['2026-10']).toEqual(['s1'])
      expect(StorageService.getMonthActiveRulesMap()['2026-10']).toEqual(['r1'])
      expect(StorageService.getMonthDailyShiftsMap()['2026-10']?.s1).toEqual([1, 2, 3])
      expect(StorageService.getDayShiftAssignments()['2026-10-01']).toEqual({ s1: 'p1' })

      const storeState = useScheduleStore.getState()
      expect(storeState.shiftDefinitions).toHaveLength(1)
      expect(storeState.shiftRules).toHaveLength(1)
      expect(storeState.dayShiftAssignments['2026-10-01']).toEqual({ s1: 'p1' })
    })
  })

  describe('mergeAppData', () => {
    it('overwrites conflicting data with the file and keeps the rest of the local data', async () => {
      // Initial local state
      StorageService.savePersons([
        { id: 'p1', name: 'Dr. Lucas Antigo', color: '#10b981' },
        { id: 'p_local_only', name: 'Dra. Helena Local', color: '#f59e0b' },
      ])
      StorageService.saveMonthParticipants({
        '2026-09': ['p_local_only'],
        '2026-10': ['p1', 'p_local_only'],
      })
      StorageService.saveAssignments({
        '2026-10-01': ['p1'],
        '2026-10-02': ['p_local_only'],
      })
      StorageService.saveDayShiftAssignments({
        '2026-10-01': { shift_d12: 'p1', shift_n12: 'p_local_only' },
        '2026-10-02': { shift_d12: 'p_local_only' },
      })
      StorageService.saveEvents([
        { id: 'ev1', date: '2026-10-01', title: 'Evento Antigo' },
        { id: 'ev_local', date: '2026-10-02', title: 'Evento Local Mantido' },
      ])
      StorageService.saveAddresses([
        { id: 'addr1', name: 'Clínica Antiga', street: 'Rua A', number: '10', neighborhood: 'Centro', city: 'SP' },
        { id: 'addr_local', name: 'Hospital Local', street: 'Rua B', number: '20', neighborhood: 'Sul', city: 'SP' },
      ])

      // Incoming snapshot that updates p1, 2026-10-01, ev1 and addr1, and adds p_new
      const incomingSnapshot: AppDataSnapshot = {
        exportedAt: '2026-10-21T12:00:00.000Z',
        people: [
          { id: 'p1', name: 'Dr. Lucas Atualizado', color: '#3b82f6' },
          { id: 'p_new', name: 'Enf. Novo', color: '#8b5cf6' },
        ],
        monthParticipants: {
          '2026-10': ['p1', 'p_new'],
        },
        availabilities: [
          { personId: 'p1', month: '2026-10', availableDays: [1, 5, 10] },
        ],
        assignments: {
          '2026-10-01': ['p_new'],
        },
        dayShiftAssignments: {
          '2026-10-01': { shift_d12: 'p_new' },
        },
        events: [
          { id: 'ev1', date: '2026-10-01', title: 'Evento Atualizado' },
        ],
        addresses: [
          { id: 'addr1', name: 'Clínica Atualizada', street: 'Rua Nova', number: '100', neighborhood: 'Centro', city: 'SP' },
        ],
      }

      await mergeAppData(incomingSnapshot)

      const persons = StorageService.getPersons()
      expect(persons).toHaveLength(3)
      expect(persons.find((p) => p.id === 'p1')?.name).toBe('Dr. Lucas Atualizado')
      expect(persons.find((p) => p.id === 'p_local_only')?.name).toBe('Dra. Helena Local')
      expect(persons.find((p) => p.id === 'p_new')?.name).toBe('Enf. Novo')

      const participants = StorageService.getMonthParticipants()
      expect(participants['2026-09']).toEqual(['p_local_only'])
      expect(participants['2026-10']).toEqual(['p1', 'p_local_only', 'p_new'])

      const assignments = StorageService.getAssignments()
      expect(assignments['2026-10-01']).toEqual(['p_new']) // Atualizado
      expect(assignments['2026-10-02']).toEqual(['p_local_only']) // Sem conflito mantido

      const dayShiftAssignments = StorageService.getDayShiftAssignments()
      expect(dayShiftAssignments['2026-10-01']).toEqual({
        shift_d12: 'p_new',
        shift_n12: 'p_local_only',
      })
      expect(dayShiftAssignments['2026-10-02']).toEqual({ shift_d12: 'p_local_only' })

      const events = StorageService.getEvents()
      expect(events).toHaveLength(2)
      expect(events.find((e) => e.id === 'ev1')?.title).toBe('Evento Atualizado')
      expect(events.find((e) => e.id === 'ev_local')?.title).toBe('Evento Local Mantido')

      const addresses = StorageService.getAddresses()
      expect(addresses).toHaveLength(2)
      expect(addresses.find((a) => a.id === 'addr1')?.name).toBe('Clínica Atualizada')
      expect(addresses.find((a) => a.id === 'addr_local')?.name).toBe('Hospital Local')
    })
  })
})

describe('BackupService month snapshots', () => {
  const snapshot = {
    capturedAt: '2026-11-05T10:00:00.000Z',
    persons: [{ id: 'p1', name: 'Nome antigo', color: '#111111' }],
    shiftDefinitions: [],
    shiftRules: [],
    activeShiftIds: [],
    activeRuleIds: [],
  }

  const baseBackup: AppDataSnapshot = {
    exportedAt: '2026-11-05T10:00:00.000Z',
    people: [],
    monthParticipants: {},
    availabilities: [],
    assignments: {},
    events: [],
  }

  beforeEach(() => {
    localStorage.clear()
    useScheduleStore.setState({ monthSnapshots: {} })
  })

  it('keeps snapshots through validation', async () => {
    const file = new File(
      [JSON.stringify({ ...baseBackup, monthSnapshots: { '2026-10': snapshot } })],
      'backup.json',
      { type: 'application/json' },
    )

    const parsed = await validateAndParseBackup(file)

    expect(parsed.monthSnapshots).toEqual({ '2026-10': snapshot })
  })

  it('restores snapshots to storage and to the store', async () => {
    await restoreAppData({ ...baseBackup, monthSnapshots: { '2026-10': snapshot } })

    expect(StorageService.getMonthSnapshots()).toEqual({ '2026-10': snapshot })
    expect(useScheduleStore.getState().monthSnapshots).toEqual({ '2026-10': snapshot })
  })

  it('keeps the local snapshot of a month when merging and adds the missing ones', async () => {
    const local = { ...snapshot, capturedAt: '2026-01-01T00:00:00.000Z' }
    StorageService.saveMonthSnapshots({ '2026-10': local })

    await mergeAppData({
      ...baseBackup,
      monthSnapshots: { '2026-09': snapshot, '2026-10': snapshot },
    })

    expect(useScheduleStore.getState().monthSnapshots).toEqual({
      '2026-09': snapshot,
      '2026-10': local,
    })
  })
})

describe('BackupService expenses and expenseItems', () => {
  const sampleItem = {
    id: 'item_1',
    name: 'Fralda G',
    normalizedName: 'fralda g',
    createdAt: '2026-11-05T10:00:00.000Z',
    updatedAt: '2026-11-05T10:00:00.000Z',
  }

  const sampleExpense = {
    id: 'exp_1',
    date: '2026-11-05',
    description: 'Farmácia',
    amount: 59.9,
    personId: 'p1',
    personName: 'Dra. Camila',
    items: [
      {
        id: 'line_1',
        itemId: 'item_1',
        itemName: 'Fralda G',
        quantity: 2,
        amount: 59.9,
      },
    ],
    createdAt: '2026-11-05T10:00:00.000Z',
    updatedAt: '2026-11-05T10:00:00.000Z',
  }

  beforeEach(() => {
    localStorage.clear()
    useScheduleStore.setState({ expenses: [], expenseItems: [] })
  })

  it('includes expenseItems when exporting app data', async () => {
    StorageService.savePersons([{ id: 'p1', name: 'Dra. Camila', color: '#3b82f6' }])
    StorageService.saveExpenseItems([sampleItem])

    let exportedBlob: Blob | null = null
    window.URL.createObjectURL = vi.fn().mockImplementation((blob: Blob) => {
      exportedBlob = blob
      return 'blob:test-url'
    })
    window.URL.revokeObjectURL = vi.fn()

    await exportAppData()

    expect(exportedBlob).not.toBeNull()
    const parsed = JSON.parse(await exportedBlob!.text())
    expect(parsed.expenseItems).toEqual([sampleItem])
  })

  it('normalizes non-array expenseItems to an empty array in validateAndParseBackup', async () => {
    const file = new File(
      [
        JSON.stringify({
          people: [{ id: 'p1', name: 'Dra. Camila', color: '#3b82f6' }],
          expenseItems: 'invalid',
        }),
      ],
      'backup.json',
      { type: 'application/json' },
    )

    const parsed = await validateAndParseBackup(file)
    expect(parsed.expenseItems).toEqual([])
  })

  it('restoreAppData updates storage and store for expenses and expenseItems before forcePushCloudData', async () => {
    localStorage.setItem('scale_manager_cloud_sync_enabled', 'true')
    let pushedExpenses: unknown = null
    let pushedExpenseItems: unknown = null
    const pushSpy = vi
      .spyOn(useScheduleStore.getState(), 'forcePushCloudData')
      .mockImplementation(async () => {
        pushedExpenses = useScheduleStore.getState().expenses
        pushedExpenseItems = useScheduleStore.getState().expenseItems
        return { success: true, code: 'success', message: 'ok' }
      })

    await restoreAppData({
      exportedAt: '2026-11-05T10:00:00.000Z',
      people: [{ id: 'p1', name: 'Dra. Camila', color: '#3b82f6' }],
      monthParticipants: {},
      availabilities: [],
      assignments: {},
      events: [],
      expenses: [sampleExpense],
      expenseItems: [sampleItem],
    })

    expect(StorageService.getExpenses()).toEqual([sampleExpense])
    expect(StorageService.getExpenseItems()).toEqual([sampleItem])
    expect(useScheduleStore.getState().expenses).toEqual([sampleExpense])
    expect(useScheduleStore.getState().expenseItems).toEqual([sampleItem])
    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(pushedExpenses).toEqual([sampleExpense])
    expect(pushedExpenseItems).toEqual([sampleItem])
  })

  it('mergeAppData merges expenses and expenseItems by id and updates both in the store', async () => {
    StorageService.saveExpenses([
      { ...sampleExpense, id: 'exp_1', description: 'Antiga' },
      { ...sampleExpense, id: 'exp_local', description: 'Local' },
    ])
    StorageService.saveExpenseItems([
      { ...sampleItem, id: 'item_1', name: 'Antigo' },
      { ...sampleItem, id: 'item_local', name: 'Local' },
    ])

    await mergeAppData({
      exportedAt: '2026-11-05T10:00:00.000Z',
      people: [],
      monthParticipants: {},
      availabilities: [],
      assignments: {},
      events: [],
      expenses: [{ ...sampleExpense, id: 'exp_1', description: 'Nova' }],
      expenseItems: [{ ...sampleItem, id: 'item_1', name: 'Novo' }],
    })

    expect(useScheduleStore.getState().expenses.map((e) => e.description)).toEqual([
      'Nova',
      'Local',
    ])
    expect(useScheduleStore.getState().expenseItems.map((i) => i.name)).toEqual([
      'Novo',
      'Local',
    ])
  })
})

describe('BackupService medicationVersions', () => {
  const sampleVersion = {
    id: 'medver_1',
    effectiveDate: '2026-03-13',
    professional: 'Dra. Marina',
    explanation: 'Ajuste de dose',
    medications: [{ id: 'med_1', name: 'Lamotrigina', dosage: '100 mg' }],
    times: ['08:00'],
    doses: { med_1: { '08:00': '1.5 comprimidos' } },
    createdAt: '2026-03-13T10:00:00.000Z',
    updatedAt: '2026-03-13T10:00:00.000Z',
  }

  beforeEach(() => {
    localStorage.clear()
    useScheduleStore.setState({ medicationVersions: [] })
  })

  it('includes medicationVersions when exporting app data', async () => {
    StorageService.savePersons([{ id: 'p1', name: 'Dra. Camila', color: '#3b82f6' }])
    StorageService.saveMedicationVersions([sampleVersion])

    let exportedBlob: Blob | null = null
    window.URL.createObjectURL = vi.fn().mockImplementation((blob: Blob) => {
      exportedBlob = blob
      return 'blob:test-url'
    })
    window.URL.revokeObjectURL = vi.fn()

    await exportAppData()

    expect(exportedBlob).not.toBeNull()
    const parsed = JSON.parse(await exportedBlob!.text())
    expect(parsed.medicationVersions).toEqual([sampleVersion])
  })

  it('normalizes non-array medicationVersions to an empty array in validateAndParseBackup', async () => {
    const file = new File(
      [
        JSON.stringify({
          people: [{ id: 'p1', name: 'Dra. Camila', color: '#3b82f6' }],
          medicationVersions: 'invalid',
        }),
      ],
      'backup.json',
      { type: 'application/json' },
    )

    const parsed = await validateAndParseBackup(file)
    expect(parsed.medicationVersions).toEqual([])
  })

  it('restoreAppData updates storage and store for medicationVersions before forcePushCloudData', async () => {
    localStorage.setItem('scale_manager_cloud_sync_enabled', 'true')
    let pushedVersions: unknown = null
    const pushSpy = vi
      .spyOn(useScheduleStore.getState(), 'forcePushCloudData')
      .mockImplementation(async () => {
        pushedVersions = useScheduleStore.getState().medicationVersions
        return { success: true, code: 'success', message: 'ok' }
      })

    await restoreAppData({
      exportedAt: '2026-11-05T10:00:00.000Z',
      people: [{ id: 'p1', name: 'Dra. Camila', color: '#3b82f6' }],
      monthParticipants: {},
      availabilities: [],
      assignments: {},
      events: [],
      medicationVersions: [sampleVersion],
    })

    expect(StorageService.getMedicationVersions()).toEqual([sampleVersion])
    expect(useScheduleStore.getState().medicationVersions).toEqual([sampleVersion])
    expect(pushSpy).toHaveBeenCalledTimes(1)
    expect(pushedVersions).toEqual([sampleVersion])
  })

  it('mergeAppData merges medicationVersions by id and updates the store', async () => {
    StorageService.saveMedicationVersions([
      { ...sampleVersion, id: 'medver_1', explanation: 'Antiga' },
      { ...sampleVersion, id: 'medver_local', explanation: 'Local' },
    ])

    await mergeAppData({
      exportedAt: '2026-11-05T10:00:00.000Z',
      people: [],
      monthParticipants: {},
      availabilities: [],
      assignments: {},
      events: [],
      medicationVersions: [{ ...sampleVersion, id: 'medver_1', explanation: 'Nova' }],
    })

    expect(useScheduleStore.getState().medicationVersions.map((v) => v.explanation)).toEqual([
      'Nova',
      'Local',
    ])
  })
})
