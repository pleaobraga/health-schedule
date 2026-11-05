import type {
  MedicationColumn,
  MedicationScheduleVersion,
} from '../types'

export const PROFESSIONAL_SEARCH_MIN_LENGTH = 3
export const PROFESSIONAL_SEARCH_MAX_RESULTS = 4

export type MedicationValidationCode =
  | 'DATE_INVALID'
  | 'DATE_IN_FUTURE'
  | 'DATE_BEFORE_LATEST'
  | 'DATE_OUT_OF_RANGE'
  | 'PROFESSIONAL_REQUIRED'
  | 'EXPLANATION_REQUIRED'
  | 'MEDICATION_REQUIRED'
  | 'MEDICATION_NAME_REQUIRED'
  | 'DUPLICATE_MEDICATION'
  | 'TIME_REQUIRED'
  | 'TIME_INVALID'
  | 'DUPLICATE_TIME'
  | 'VERSION_NOT_FOUND'

export interface MedicationValidationError {
  code: MedicationValidationCode
  medicationId?: string
  time?: string
}

export type MedicationVersionChange =
  | {
      type: 'MEDICATION_ADDED'
      medicationId: string
      name: string
      dosage?: string
    }
  | {
      type: 'MEDICATION_REMOVED'
      medicationId: string
      name: string
      dosage?: string
    }
  | {
      type: 'MEDICATION_RENAMED'
      medicationId: string
      from: string
      to: string
    }
  | {
      type: 'DOSAGE_CHANGED'
      medicationId: string
      name: string
      from?: string
      to?: string
    }
  | {
      type: 'SOURCE_CHANGED'
      medicationId: string
      name: string
      from?: string
      to?: string
    }
  | {
      type: 'RESPONSIBLE_CHANGED'
      medicationId: string
      name: string
      from?: string
      to?: string
    }
  | { type: 'TIME_ADDED'; time: string }
  | { type: 'TIME_REMOVED'; time: string }
  | {
      type: 'DOSE_CHANGED'
      medicationId: string
      name: string
      time: string
      from?: string
      to?: string
    }

export interface MedicationVersionHistoryEntry {
  version: MedicationScheduleVersion
  changes: MedicationVersionChange[]
}

export interface MedicationSourceGroup {
  source: string | null
  medications: MedicationColumn[]
}

export function createMedicationId(): string {
  const random = Math.random().toString(36).slice(2, 9)
  return `med_${Date.now()}_${random}`
}

export function sortMedicationVersions(
  versions: MedicationScheduleVersion[],
): MedicationScheduleVersion[] {
  return [...versions].sort((a, b) => {
    const dateCompare = a.effectiveDate.localeCompare(b.effectiveDate)
    if (dateCompare !== 0) return dateCompare
    return a.createdAt.localeCompare(b.createdAt)
  })
}

export function getMedicationVersionAt(
  versions: MedicationScheduleVersion[],
  date: string,
): MedicationScheduleVersion | undefined {
  if (versions.length === 0) return undefined
  const sorted = sortMedicationVersions(versions)
  let result: MedicationScheduleVersion | undefined
  for (const ver of sorted) {
    if (ver.effectiveDate <= date) {
      result = ver
    } else {
      break
    }
  }
  return result
}

export function getCurrentMedicationVersion(
  versions: MedicationScheduleVersion[],
  today: string,
): MedicationScheduleVersion | undefined {
  return getMedicationVersionAt(versions, today)
}

function normalizeDoseForCompare(dose: string | undefined): string {
  return (dose ?? '').trim().toLowerCase()
}

export function getMedicationVersionChanges(
  previous: MedicationScheduleVersion | undefined,
  next: MedicationScheduleVersion,
): MedicationVersionChange[] {
  if (!previous) return []

  const changes: MedicationVersionChange[] = []
  const prevMedMap = new Map(previous.medications.map((m) => [m.id, m]))
  const nextMedMap = new Map(next.medications.map((m) => [m.id, m]))

  for (const prevMed of previous.medications) {
    if (!nextMedMap.has(prevMed.id)) {
      const removedChange: MedicationVersionChange = {
        type: 'MEDICATION_REMOVED',
        medicationId: prevMed.id,
        name: prevMed.name,
      }
      if (prevMed.dosage !== undefined) {
        removedChange.dosage = prevMed.dosage
      }
      changes.push(removedChange)
    }
  }

  for (const nextMed of next.medications) {
    const prevMed = prevMedMap.get(nextMed.id)
    if (!prevMed) {
      const addedChange: MedicationVersionChange = {
        type: 'MEDICATION_ADDED',
        medicationId: nextMed.id,
        name: nextMed.name,
      }
      if (nextMed.dosage !== undefined) {
        addedChange.dosage = nextMed.dosage
      }
      changes.push(addedChange)
      continue
    }

    if (prevMed.name !== nextMed.name) {
      changes.push({
        type: 'MEDICATION_RENAMED',
        medicationId: nextMed.id,
        from: prevMed.name,
        to: nextMed.name,
      })
    }

    if ((prevMed.dosage || undefined) !== (nextMed.dosage || undefined)) {
      changes.push({
        type: 'DOSAGE_CHANGED',
        medicationId: nextMed.id,
        name: nextMed.name,
        from: prevMed.dosage || undefined,
        to: nextMed.dosage || undefined,
      })
    }

    if ((prevMed.source || undefined) !== (nextMed.source || undefined)) {
      changes.push({
        type: 'SOURCE_CHANGED',
        medicationId: nextMed.id,
        name: nextMed.name,
        from: prevMed.source || undefined,
        to: nextMed.source || undefined,
      })
    }

    if (
      (prevMed.responsible || undefined) !== (nextMed.responsible || undefined)
    ) {
      changes.push({
        type: 'RESPONSIBLE_CHANGED',
        medicationId: nextMed.id,
        name: nextMed.name,
        from: prevMed.responsible || undefined,
        to: nextMed.responsible || undefined,
      })
    }
  }

  const prevTimesSet = new Set(previous.times)
  const nextTimesSet = new Set(next.times)

  for (const time of previous.times) {
    if (!nextTimesSet.has(time)) {
      changes.push({ type: 'TIME_REMOVED', time })
    }
  }

  for (const time of next.times) {
    if (!prevTimesSet.has(time)) {
      changes.push({ type: 'TIME_ADDED', time })
    }
  }

  const allTimes = Array.from(
    new Set([...previous.times, ...next.times]),
  ).sort()

  for (const nextMed of next.medications) {
    const prevMed = prevMedMap.get(nextMed.id)
    if (!prevMed) continue

    const prevMedDoses = previous.doses[nextMed.id] ?? {}
    const nextMedDoses = next.doses[nextMed.id] ?? {}

    for (const time of allTimes) {
      const prevRaw = prevMedDoses[time]
      const nextRaw = nextMedDoses[time]
      const prevNorm = normalizeDoseForCompare(prevRaw)
      const nextNorm = normalizeDoseForCompare(nextRaw)

      if (prevNorm !== nextNorm) {
        changes.push({
          type: 'DOSE_CHANGED',
          medicationId: nextMed.id,
          name: nextMed.name,
          time,
          from: prevNorm ? prevRaw?.trim() : undefined,
          to: nextNorm ? nextRaw?.trim() : undefined,
        })
      }
    }
  }

  return changes
}

export function getMedicationVersionHistory(
  versions: MedicationScheduleVersion[],
): MedicationVersionHistoryEntry[] {
  const sorted = sortMedicationVersions(versions)
  const entries: MedicationVersionHistoryEntry[] = sorted.map((ver, index) => {
    const previous = index > 0 ? sorted[index - 1] : undefined
    return {
      version: ver,
      changes: getMedicationVersionChanges(previous, ver),
    }
  })
  return entries.reverse()
}
