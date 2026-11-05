import type { MonthScheduleData } from '../services/cloud-sync-service'
import type { MonthRegistrySnapshot, Person, ShiftDefinition, ShiftRule } from '../types'

export interface MonthRegistry {
  persons: Person[]
  shiftDefinitions: ShiftDefinition[]
  shiftRules: ShiftRule[]
}

export interface MonthReferencedIds {
  personIds: string[]
  shiftIds: string[]
  ruleIds: string[]
}

const isDateInMonth = (dateStr: string, month: string) => dateStr.startsWith(`${month}-`)

/**
 * Appends the live records a month references that the stored list does not have.
 * Stored records are never replaced, so a past month keeps what it recorded.
 */
const addReferencedRecords = <T extends { id: string }>(
  stored: T[],
  live: T[],
  referencedIds: string[],
): T[] => {
  const storedIds = new Set(stored.map((record) => record.id))
  const referenced = new Set(referencedIds)
  const missing = live.filter((record) => referenced.has(record.id) && !storedIds.has(record.id))
  return missing.length > 0 ? [...stored, ...missing] : stored
}

/**
 * Lists the people, shifts, and rules a month's own data points to.
 */
export function getMonthReferencedIds(month: string, data: MonthScheduleData): MonthReferencedIds {
  const personIds = new Set<string>(data.monthParticipants?.[month] ?? [])
  const shiftIds = new Set<string>([
    ...Object.keys(data.monthDailyShifts?.[month] ?? {}),
    ...(data.monthActiveShifts?.[month] ?? []),
  ])

  Object.entries(data.assignments ?? {}).forEach(([date, ids]) => {
    if (isDateInMonth(date, month)) ids.forEach((id) => personIds.add(id))
  })
  Object.entries(data.dayShiftAssignments ?? {}).forEach(([date, dayShifts]) => {
    if (!isDateInMonth(date, month)) return
    Object.entries(dayShifts).forEach(([shiftId, personId]) => {
      shiftIds.add(shiftId)
      personIds.add(personId)
    })
  })
  data.availabilities?.forEach((availability) => {
    if (availability.month === month) personIds.add(availability.personId)
  })
  data.events?.forEach((event) => {
    if (event.personId && isDateInMonth(event.date, month)) personIds.add(event.personId)
  })
  data.expenses?.forEach((expense) => {
    if (expense.personId && isDateInMonth(expense.date, month)) personIds.add(expense.personId)
  })

  return {
    personIds: Array.from(personIds),
    shiftIds: Array.from(shiftIds),
    ruleIds: [...(data.monthActiveRules?.[month] ?? [])],
  }
}

/**
 * Returns the registries a month must display: the snapshot for a past month that has one,
 * otherwise the live registries.
 */
export function getMonthRegistry({
  month,
  today,
  snapshot,
  persons,
  shiftDefinitions,
  shiftRules,
  referencedIds,
}: MonthRegistry & {
  month: string
  today: string
  snapshot?: MonthRegistrySnapshot
  referencedIds: MonthReferencedIds
}): MonthRegistry {
  if (!snapshot || month >= today) {
    return { persons, shiftDefinitions, shiftRules }
  }

  return {
    persons: addReferencedRecords(snapshot.persons, persons, referencedIds.personIds),
    shiftDefinitions: addReferencedRecords(
      snapshot.shiftDefinitions,
      shiftDefinitions,
      referencedIds.shiftIds,
    ),
    shiftRules: addReferencedRecords(snapshot.shiftRules, shiftRules, referencedIds.ruleIds),
  }
}

/**
 * Freezes past months before a registry change: creates missing snapshots and adds records that
 * past months reference but their snapshots lack. Stored records are never overwritten.
 */
export function captureMonthSnapshots({
  today,
  capturedAt,
  existing,
  data,
  persons,
  shiftDefinitions,
  shiftRules,
  getActiveShiftIds,
  getActiveRuleIds,
  months,
}: MonthRegistry & {
  today: string
  capturedAt: string
  existing: Record<string, MonthRegistrySnapshot>
  data: MonthScheduleData
  getActiveShiftIds: (month: string) => string[]
  getActiveRuleIds: (month: string) => string[]
  months: string[]
}): { snapshots: Record<string, MonthRegistrySnapshot>; changedMonths: string[] } {
  const snapshots = { ...existing }
  const changedMonths: string[] = []

  months
    .filter((month) => month < today)
    .forEach((month) => {
      const stored = snapshots[month]

      if (!stored) {
        snapshots[month] = {
          capturedAt,
          persons,
          shiftDefinitions,
          shiftRules,
          activeShiftIds: getActiveShiftIds(month),
          activeRuleIds: getActiveRuleIds(month),
        }
        changedMonths.push(month)
        return
      }

      const referencedIds = getMonthReferencedIds(month, data)
      const nextPersons = addReferencedRecords(stored.persons, persons, referencedIds.personIds)
      const nextShifts = addReferencedRecords(
        stored.shiftDefinitions,
        shiftDefinitions,
        referencedIds.shiftIds,
      )
      const nextRules = addReferencedRecords(stored.shiftRules, shiftRules, referencedIds.ruleIds)

      if (
        nextPersons !== stored.persons ||
        nextShifts !== stored.shiftDefinitions ||
        nextRules !== stored.shiftRules
      ) {
        snapshots[month] = {
          ...stored,
          persons: nextPersons,
          shiftDefinitions: nextShifts,
          shiftRules: nextRules,
        }
        changedMonths.push(month)
      }
    })

  return { snapshots, changedMonths }
}
