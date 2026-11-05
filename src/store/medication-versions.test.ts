import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useScheduleStore } from './use-schedule-store'
import { CloudSyncService } from '../services/cloud-sync-service'
import { StorageService } from '../services/storage-service'

import type { MedicationVersionInput } from '../types'

const sampleInput: MedicationVersionInput = {
  effectiveDate: '2026-03-10',
  professional: 'Dra. Marina',
  explanation: 'Início do tratamento',
  medications: [
    {
      id: 'med_1',
      name: 'Lamotrigina',
      dosage: '100 mg',
      source: 'Farmácia Popular',
      responsible: 'Dra. Marina',
    },
  ],
  times: ['08:00', '20:00'],
  doses: {
    med_1: {
      '08:00': '1.5 comprimidos',
      '20:00': '2 gotas',
    },
  },
}

describe('medication versions in useScheduleStore', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    useScheduleStore.setState({ medicationVersions: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('creates the first version with an id starting with medver_', async () => {
    const result = await useScheduleStore.getState().addMedicationVersion(sampleInput)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.version.id).toMatch(/^medver_/)
    expect(result.version.effectiveDate).toBe('2026-03-10')
    expect(result.version.professional).toBe('Dra. Marina')
    expect(result.version.explanation).toBe('Início do tratamento')
    expect(result.version.doses.med_1?.['08:00']).toBe('1.5 comprimidos')
    expect(useScheduleStore.getState().medicationVersions).toEqual([result.version])
    expect(StorageService.getMedicationVersions()).toEqual([result.version])
  })

  it('rejects a version whose effectiveDate is before the latest version and leaves state and storage untouched', async () => {
    const first = await useScheduleStore.getState().addMedicationVersion(sampleInput)
    expect(first.ok).toBe(true)

    const snapshotBefore = structuredClone(useScheduleStore.getState().medicationVersions)
    const storageBefore = structuredClone(StorageService.getMedicationVersions())

    const rejected = await useScheduleStore.getState().addMedicationVersion({
      ...sampleInput,
      effectiveDate: '2026-03-09',
      explanation: 'Tentativa retroativa',
    })

    expect(rejected).toEqual({
      ok: false,
      errors: [{ code: 'DATE_BEFORE_LATEST' }],
    })
    expect(useScheduleStore.getState().medicationVersions).toEqual(snapshotBefore)
    expect(StorageService.getMedicationVersions()).toEqual(storageBefore)
  })

  it('keeps previous versions identical when creating a new version', async () => {
    const first = await useScheduleStore.getState().addMedicationVersion(sampleInput)
    expect(first.ok).toBe(true)
    if (!first.ok) return

    const savedFirstCopy = structuredClone(first.version)

    const second = await useScheduleStore.getState().addMedicationVersion({
      ...sampleInput,
      effectiveDate: '2026-03-13',
      professional: 'Dr. Carlos',
      explanation: 'Ajuste de dose noturna',
      doses: {
        med_1: {
          '08:00': '1.5 comprimidos',
          '20:00': '3 gotas',
        },
      },
    })

    expect(second.ok).toBe(true)
    const versions = useScheduleStore.getState().medicationVersions
    expect(versions).toHaveLength(2)
    expect(versions[0]).toEqual(savedFirstCopy)
  })

  it('uses the local calendar date at 23:30 on 2026-11-05 so 2026-11-05 is accepted and 2026-11-06 is rejected with DATE_IN_FUTURE', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 5, 23, 30, 0))

    const accepted = await useScheduleStore.getState().addMedicationVersion({
      ...sampleInput,
      effectiveDate: '2026-11-05',
    })
    expect(accepted.ok).toBe(true)

    const rejected = await useScheduleStore.getState().addMedicationVersion({
      ...sampleInput,
      effectiveDate: '2026-11-06',
    })
    expect(rejected).toEqual({
      ok: false,
      errors: [{ code: 'DATE_IN_FUTURE' }],
    })
  })

  it('updates an existing version while keeping id, createdAt and list length and updating updatedAt', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 10, 10, 0, 0))

    const created = await useScheduleStore.getState().addMedicationVersion(sampleInput)
    expect(created.ok).toBe(true)
    if (!created.ok) return

    vi.setSystemTime(new Date(2026, 2, 11, 14, 0, 0))

    const updated = await useScheduleStore
      .getState()
      .updateMedicationVersion(created.version.id, {
        ...sampleInput,
        explanation: 'Início do tratamento corrigido',
      })

    expect(updated.ok).toBe(true)
    if (!updated.ok) return
    expect(updated.version.id).toBe(created.version.id)
    expect(updated.version.createdAt).toBe(created.version.createdAt)
    expect(updated.version.updatedAt).not.toBe(created.version.updatedAt)
    expect(updated.version.explanation).toBe('Início do tratamento corrigido')
    expect(useScheduleStore.getState().medicationVersions).toHaveLength(1)
    expect(StorageService.getMedicationVersions()).toEqual([updated.version])
  })

  it('returns VERSION_NOT_FOUND when updating a non-existent version id', async () => {
    const result = await useScheduleStore
      .getState()
      .updateMedicationVersion('medver_missing', sampleInput)

    expect(result).toEqual({
      ok: false,
      errors: [{ code: 'VERSION_NOT_FOUND' }],
    })
  })

  it('deletes only the latest version and returns true, or returns false when there are no versions', async () => {
    expect(await useScheduleStore.getState().deleteLatestMedicationVersion()).toBe(false)

    const first = await useScheduleStore.getState().addMedicationVersion(sampleInput)
    const second = await useScheduleStore.getState().addMedicationVersion({
      ...sampleInput,
      effectiveDate: '2026-03-13',
      explanation: 'Segunda versão',
    })
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) return

    const deleted = await useScheduleStore.getState().deleteLatestMedicationVersion()
    expect(deleted).toBe(true)
    expect(useScheduleStore.getState().medicationVersions).toEqual([first.version])
    expect(StorageService.getMedicationVersions()).toEqual([first.version])
  })

  it('restores versions on reloadFromStorage and clears them on clearAllLocalData', async () => {
    const created = await useScheduleStore.getState().addMedicationVersion(sampleInput)
    expect(created.ok).toBe(true)
    if (!created.ok) return

    useScheduleStore.setState({ medicationVersions: [] })
    useScheduleStore.getState().reloadFromStorage()
    expect(useScheduleStore.getState().medicationVersions).toEqual([created.version])

    useScheduleStore.getState().clearAllLocalData()
    expect(useScheduleStore.getState().medicationVersions).toEqual([])
    expect(StorageService.getMedicationVersions()).toEqual([])
  })

  it('calls CloudSyncService.saveMedicationVersionsToCloud on add, update and delete when sync is enabled', async () => {
    CloudSyncService.setSyncEnabled(true)
    const syncSpy = vi
      .spyOn(CloudSyncService, 'saveMedicationVersionsToCloud')
      .mockResolvedValue(true)

    const created = await useScheduleStore.getState().addMedicationVersion(sampleInput)
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(syncSpy).toHaveBeenCalledTimes(1)
    expect(syncSpy).toHaveBeenLastCalledWith([created.version])

    const updated = await useScheduleStore
      .getState()
      .updateMedicationVersion(created.version.id, {
        ...sampleInput,
        explanation: 'Atualizada',
      })
    expect(updated.ok).toBe(true)
    if (!updated.ok) return
    expect(syncSpy).toHaveBeenCalledTimes(2)
    expect(syncSpy).toHaveBeenLastCalledWith([updated.version])

    const deleted = await useScheduleStore.getState().deleteLatestMedicationVersion()
    expect(deleted).toBe(true)
    expect(syncSpy).toHaveBeenCalledTimes(3)
    expect(syncSpy).toHaveBeenLastCalledWith([])
  })
})
