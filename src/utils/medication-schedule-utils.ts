import { format, isValid, parseISO } from 'date-fns'

import { normalizeItemName } from './expense-item-utils'

import type {
  MedicationColumn,
  MedicationScheduleVersion,
  MedicationVersionInput,
  MedicationVersionNote,
} from '../types'

export const PROFESSIONAL_SEARCH_MIN_LENGTH = 3
export const PROFESSIONAL_SEARCH_MAX_RESULTS = 4

export type MedicationValidationCode =
  | 'DATE_INVALID'
  | 'DATE_IN_FUTURE'
  | 'DATE_BEFORE_LATEST'
  | 'DATE_OUT_OF_RANGE'
  | 'EXPLANATION_REQUIRED'
  | 'NOTE_TEXT_REQUIRED'
  | 'MEDICATION_REQUIRED'
  | 'MEDICATION_NAME_REQUIRED'
  | 'DUPLICATE_MEDICATION'
  | 'TIME_REQUIRED'
  | 'TIME_INVALID'
  | 'DUPLICATE_TIME'
  | 'VERSION_NOT_FOUND'

export interface MedicationSpecialty {
  key: string
  label: string
}

export interface MedicationValidationError {
  code: MedicationValidationCode
  medicationId?: string
  time?: string
  noteId?: string
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
  | {
      type: 'SPECIALTY_CHANGED'
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

export function createMedicationNoteId(): string {
  const random = Math.random().toString(36).slice(2, 9)
  return `mednote_${Date.now()}_${random}`
}

function isValidIsoDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = parseISO(value)
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value
}

export function normalizeMedicationVersionInput(
  input: MedicationVersionInput,
): MedicationVersionInput {
  const effectiveDate = (input.effectiveDate ?? '').trim()
  const professional = input.professional?.trim()
  const explanation = (input.explanation ?? '').trim()

  const medications: MedicationColumn[] = (input.medications ?? []).map(
    (med) => {
      const normalizedMed: MedicationColumn = {
        id: (med.id ?? '').trim(),
        name: (med.name ?? '').trim(),
      }
      const dosage = med.dosage?.trim()
      if (dosage) {
        normalizedMed.dosage = dosage
      }
      const source = med.source?.trim()
      if (source) {
        normalizedMed.source = source
      }
      const responsible = med.responsible?.trim()
      if (responsible) {
        normalizedMed.responsible = responsible
      }
      const specialty = med.specialty?.trim()
      if (specialty) {
        normalizedMed.specialty = specialty
      }
      return normalizedMed
    },
  )

  const times = (input.times ?? [])
    .map((t) => t.trim())
    .sort((a, b) => a.localeCompare(b))

  const validMedIds = new Set(medications.map((m) => m.id))
  const validTimes = new Set(times)

  const doses: Record<string, Record<string, string>> = {}
  const rawDoses = input.doses ?? {}

  for (const [rawMedId, timeMap] of Object.entries(rawDoses)) {
    const medId = rawMedId.trim()
    if (!validMedIds.has(medId) || !timeMap) continue

    for (const [rawTime, rawDose] of Object.entries(timeMap)) {
      const time = rawTime.trim()
      if (!validTimes.has(time)) continue
      const dose = (rawDose ?? '').trim()
      if (!dose) continue

      if (!doses[medId]) {
        doses[medId] = {}
      }
      doses[medId][time] = dose
    }
  }

  const notes = normalizeMedicationNotes(input.notes)

  return {
    effectiveDate,
    ...(professional ? { professional } : {}),
    explanation,
    ...(notes.length > 0 ? { notes } : {}),
    medications,
    times,
    doses,
  }
}

function normalizeMedicationNotes(
  notes: MedicationVersionNote[] | undefined,
): MedicationVersionNote[] {
  const normalized: MedicationVersionNote[] = []

  for (const note of notes ?? []) {
    const date = note.date?.trim()
    const professional = note.professional?.trim()
    const text = (note.text ?? '').trim()
    if (!date && !professional && !text) continue

    normalized.push({
      id: note.id,
      ...(date ? { date } : {}),
      ...(professional ? { professional } : {}),
      text,
    })
  }

  // Newest first, matching the version history; undated notes go last.
  return normalized.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
}

export function validateMedicationVersionInput(
  input: MedicationVersionInput,
  versions: MedicationScheduleVersion[],
  options: { today: string; editingVersionId?: string },
): MedicationValidationError[] {
  const errors: MedicationValidationError[] = []
  const effectiveDate = (input.effectiveDate ?? '').trim()

  if (!isValidIsoDateString(effectiveDate)) {
    errors.push({ code: 'DATE_INVALID' })
  } else {
    if (effectiveDate > options.today) {
      errors.push({ code: 'DATE_IN_FUTURE' })
    }

    const sorted = sortMedicationVersions(versions)
    if (options.editingVersionId !== undefined) {
      const idx = sorted.findIndex((v) => v.id === options.editingVersionId)
      if (idx >= 0) {
        const prev = idx > 0 ? sorted[idx - 1] : undefined
        const next = idx < sorted.length - 1 ? sorted[idx + 1] : undefined
        if (
          (prev && effectiveDate < prev.effectiveDate) ||
          (next && effectiveDate > next.effectiveDate)
        ) {
          errors.push({ code: 'DATE_OUT_OF_RANGE' })
        }
      }
    } else if (sorted.length > 0) {
      const latest = sorted[sorted.length - 1]
      if (effectiveDate < latest.effectiveDate) {
        errors.push({ code: 'DATE_BEFORE_LATEST' })
      }
    }
  }

  if (!(input.explanation ?? '').trim()) {
    errors.push({ code: 'EXPLANATION_REQUIRED' })
  }

  for (const note of input.notes ?? []) {
    const isBlank =
      !note.date?.trim() && !note.professional?.trim() && !note.text?.trim()
    if (!isBlank && !note.text?.trim()) {
      errors.push({ code: 'NOTE_TEXT_REQUIRED', noteId: note.id })
    }
  }

  const medications = input.medications ?? []
  if (medications.length === 0) {
    errors.push({ code: 'MEDICATION_REQUIRED' })
  } else {
    const seenKeys = new Set<string>()
    for (const med of medications) {
      const normName = normalizeItemName(med.name ?? '')
      if (!normName) {
        errors.push({
          code: 'MEDICATION_NAME_REQUIRED',
          medicationId: med.id,
        })
      } else {
        const normDosage = normalizeItemName(med.dosage ?? '')
        const key = `${normName}::${normDosage}`
        if (seenKeys.has(key)) {
          errors.push({
            code: 'DUPLICATE_MEDICATION',
            medicationId: med.id,
          })
        } else {
          seenKeys.add(key)
        }
      }
    }
  }

  const times = input.times ?? []
  if (times.length === 0) {
    errors.push({ code: 'TIME_REQUIRED' })
  } else {
    const seenTimes = new Set<string>()
    for (const rawTime of times) {
      const time = (rawTime ?? '').trim()
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        errors.push({
          code: 'TIME_INVALID',
          time: rawTime,
        })
      } else if (seenTimes.has(time)) {
        errors.push({
          code: 'DUPLICATE_TIME',
          time,
        })
      } else {
        seenTimes.add(time)
      }
    }
  }

  return errors
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

    if ((prevMed.specialty || undefined) !== (nextMed.specialty || undefined)) {
      changes.push({
        type: 'SPECIALTY_CHANGED',
        medicationId: nextMed.id,
        name: nextMed.name,
        from: prevMed.specialty || undefined,
        to: nextMed.specialty || undefined,
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

export function getMedicationSpecialties(
  version: Pick<MedicationScheduleVersion, 'medications'>,
): MedicationSpecialty[] {
  const specialties = new Map<string, MedicationSpecialty>()

  for (const med of version.medications ?? []) {
    const label = med.specialty?.trim() ?? ''
    const key = normalizeItemName(label)
    if (key && !specialties.has(key)) {
      specialties.set(key, { key, label })
    }
  }

  return Array.from(specialties.values())
}

export function getMedicationSpecialtyIndex(
  specialty: string,
  versions: MedicationScheduleVersion[],
): number {
  const keys = new Set(
    sortMedicationVersions(versions).flatMap((version) =>
      getMedicationSpecialties(version).map(({ key }) => key),
    ),
  )

  return Array.from(keys).indexOf(normalizeItemName(specialty))
}

export function matchesMedicationSpecialty(
  medication: MedicationColumn,
  specialtyKey: string,
): boolean {
  return (
    specialtyKey !== '' &&
    normalizeItemName(medication.specialty ?? '') === specialtyKey
  )
}

export function groupMedicationsBySource(
  version: Pick<MedicationScheduleVersion, 'medications'>,
): MedicationSourceGroup[] {
  const groupsMap = new Map<string, MedicationSourceGroup>()
  const withoutSource: MedicationColumn[] = []

  for (const med of version.medications ?? []) {
    const rawSource = med.source?.trim() ?? ''
    const normSource = normalizeItemName(rawSource)
    if (!normSource) {
      withoutSource.push(med)
      continue
    }

    const existing = groupsMap.get(normSource)
    if (existing) {
      existing.medications.push(med)
    } else {
      groupsMap.set(normSource, {
        source: rawSource,
        medications: [med],
      })
    }
  }

  const result = Array.from(groupsMap.values())
  if (withoutSource.length > 0) {
    result.push({
      source: null,
      medications: withoutSource,
    })
  }
  return result
}

export function searchMedicationProfessionals(
  query: string,
  versions: MedicationScheduleVersion[],
): string[] {
  const normQuery = normalizeItemName(query ?? '')
  if (normQuery.length < PROFESSIONAL_SEARCH_MIN_LENGTH) {
    return []
  }

  const newestFirst = sortMedicationVersions(versions).reverse()
  const seenNormalized = new Set<string>()
  const results: string[] = []

  for (const ver of newestFirst) {
    const rawProf = (ver.professional ?? '').trim()
    const normProf = normalizeItemName(rawProf)
    if (!normProf || seenNormalized.has(normProf)) continue

    if (normProf.includes(normQuery)) {
      seenNormalized.add(normProf)
      results.push(rawProf)
      if (results.length >= PROFESSIONAL_SEARCH_MAX_RESULTS) {
        break
      }
    }
  }

  return results
}

export function getMedicationFileBaseName(
  effectiveDate: string,
  language: string,
): string {
  const isPt = language?.toLowerCase().startsWith('pt')
  try {
    const parsed = parseISO(effectiveDate)
    const formattedDate = format(parsed, isPt ? 'dd-MM-yyyy' : 'MM-dd-yyyy')
    return `${isPt ? 'medicamentos' : 'medications'}-${formattedDate}`
  } catch {
    return `${isPt ? 'medicamentos' : 'medications'}-${effectiveDate}`
  }
}
