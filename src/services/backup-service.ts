import { CloudSyncService } from './cloud-sync-service'
import { StorageService } from './storage-service'
import { useScheduleStore } from '../store/use-schedule-store'

import type {
  AppDataSnapshot,
  MonthlyAvailability,
  ShiftDefinition,
  ShiftRule,
} from '../types'

/**
 * Generates the standardized filename for exports:
 * escala_backup_YYYY-MM-DD_HHmm.json
 */
export function getBackupFilename(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `escala_backup_${year}-${month}-${day}_${hours}${minutes}.json`
}

/**
 * Checks if the local storage contains any existing user data.
 * Returns false if the storage is completely empty or has no registered people/schedules.
 */
export async function hasExistingLocalData(): Promise<boolean> {
  try {
    const rawPersons = localStorage.getItem('scale_manager_persons_v1')
    const rawAssignments = localStorage.getItem('scale_manager_assignments_v1')
    const rawMonthParticipants = localStorage.getItem('scale_manager_month_participants_v1')
    const rawEvents = localStorage.getItem('scale_manager_events_v1')
    const rawDayShiftAssignments = localStorage.getItem('scale_manager_day_shift_assignments_v1')
    const rawShifts = localStorage.getItem('scale_manager_shifts_v1')

    if (!rawPersons && !rawAssignments && !rawMonthParticipants && !rawEvents && !rawDayShiftAssignments && !rawShifts) {
      return false
    }

    const persons = rawPersons ? JSON.parse(rawPersons) : []
    const assignments = rawAssignments ? JSON.parse(rawAssignments) : {}
    const monthParticipants = rawMonthParticipants ? JSON.parse(rawMonthParticipants) : {}
    const events = rawEvents ? JSON.parse(rawEvents) : []
    const dayShiftAssignments = rawDayShiftAssignments ? JSON.parse(rawDayShiftAssignments) : {}
    const shifts = rawShifts ? JSON.parse(rawShifts) : []

    const hasPersons = Array.isArray(persons) && persons.length > 0
    const hasAssignments =
      assignments &&
      typeof assignments === 'object' &&
      Object.values(assignments).some((v) => Array.isArray(v) && v.length > 0)
    const hasMonthParticipants =
      monthParticipants &&
      typeof monthParticipants === 'object' &&
      Object.values(monthParticipants).some((v) => Array.isArray(v) && v.length > 0)
    const hasEvents = Array.isArray(events) && events.length > 0
    const hasDayShiftAssignments =
      dayShiftAssignments &&
      typeof dayShiftAssignments === 'object' &&
      Object.values(dayShiftAssignments).some((v) => v && typeof v === 'object' && Object.keys(v).length > 0)
    const hasShifts = Array.isArray(shifts) && shifts.length > 0

    return Boolean(hasPersons || hasAssignments || hasMonthParticipants || hasEvents || hasDayShiftAssignments || hasShifts)
  } catch {
    return false
  }
}

/**
 * Exports current application state into a downloadable JSON file.
 * Preserves all existing fields, metadata, events, participants and configurations.
 */
export async function exportAppData(): Promise<void> {
  const persons = StorageService.getPersons()
  const monthParticipants = StorageService.getMonthParticipants()
  const availabilities = StorageService.getAvailabilities()
  const assignments = StorageService.getAssignments()
  const events = StorageService.getEvents()
  const expenses = StorageService.getExpenses()
  const addresses = StorageService.getAddresses()
  const shiftDefinitions = StorageService.getShiftDefinitions()
  const shiftRules = StorageService.getShiftRules()
  const monthActiveShifts = StorageService.getMonthActiveShiftsMap()
  const monthActiveRules = StorageService.getMonthActiveRulesMap()
  const monthDailyShifts = StorageService.getMonthDailyShiftsMap()
  const dayShiftAssignments = StorageService.getDayShiftAssignments()
  const theme = localStorage.getItem('theme') || 'light'

  const snapshot: AppDataSnapshot = {
    exportedAt: new Date().toISOString(),
    people: persons,
    monthParticipants,
    availabilities,
    assignments,
    events,
    expenses,
    addresses,
    shiftDefinitions,
    shiftRules,
    monthActiveShifts,
    monthActiveRules,
    monthDailyShifts,
    dayShiftAssignments,
    theme,
  }

  const filename = getBackupFilename()
  const jsonContent = JSON.stringify(snapshot, null, 2)
  const blob = new Blob([jsonContent], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Validates and parses an uploaded JSON backup file.
 * Returns the normalized AppDataSnapshot or throws a descriptive error.
 */
export async function validateAndParseBackup(file: File): Promise<AppDataSnapshot> {
  if (!file) {
    throw new Error('Nenhum arquivo foi selecionado.')
  }

  const text = await file.text()
  let json: unknown

  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('Arquivo de backup inválido: formato JSON corrompido ou ilegível.')
  }

  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error('Estrutura do arquivo inválida: o backup deve ser um objeto JSON.')
  }

  const raw = json as Record<string, unknown>
  const people = raw.people ?? raw.persons

  if (!Array.isArray(people)) {
    throw new Error('Estrutura do arquivo inválida: campo "people" ausente ou inválido.')
  }

  for (const person of people) {
    if (
      !person ||
      typeof person !== 'object' ||
      typeof (person as { id?: unknown }).id !== 'string' ||
      typeof (person as { name?: unknown }).name !== 'string'
    ) {
      throw new Error('Estrutura do arquivo inválida: profissional com formato incorreto (id ou name ausente).')
    }
  }

  const monthParticipants =
    raw.monthParticipants && typeof raw.monthParticipants === 'object' && !Array.isArray(raw.monthParticipants)
      ? (raw.monthParticipants as Record<string, string[]>)
      : {}

  const assignments =
    raw.assignments && typeof raw.assignments === 'object' && !Array.isArray(raw.assignments)
      ? (raw.assignments as Record<string, unknown>)
      : {}

  const events = Array.isArray(raw.events) ? raw.events : []
  const expenses = Array.isArray(raw.expenses) ? raw.expenses : []
  const addresses = Array.isArray(raw.addresses) ? raw.addresses : []
  const availabilities = raw.availabilities ?? []
  const shiftDefinitions = Array.isArray(raw.shiftDefinitions) ? (raw.shiftDefinitions as ShiftDefinition[]) : undefined
  const shiftRules = Array.isArray(raw.shiftRules) ? (raw.shiftRules as ShiftRule[]) : undefined
  const monthActiveShifts =
    raw.monthActiveShifts && typeof raw.monthActiveShifts === 'object' && !Array.isArray(raw.monthActiveShifts)
      ? (raw.monthActiveShifts as Record<string, string[]>)
      : undefined
  const monthActiveRules =
    raw.monthActiveRules && typeof raw.monthActiveRules === 'object' && !Array.isArray(raw.monthActiveRules)
      ? (raw.monthActiveRules as Record<string, string[]>)
      : undefined
  const monthDailyShifts =
    raw.monthDailyShifts && typeof raw.monthDailyShifts === 'object' && !Array.isArray(raw.monthDailyShifts)
      ? (raw.monthDailyShifts as Record<string, Record<string, number[]>>)
      : undefined
  const dayShiftAssignments =
    raw.dayShiftAssignments && typeof raw.dayShiftAssignments === 'object' && !Array.isArray(raw.dayShiftAssignments)
      ? (raw.dayShiftAssignments as Record<string, Record<string, string>>)
      : undefined

  return {
    ...raw,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(),
    people: people as AppDataSnapshot['people'],
    monthParticipants,
    availabilities: availabilities as AppDataSnapshot['availabilities'],
    assignments,
    events,
    expenses,
    addresses,
    shiftDefinitions,
    shiftRules,
    monthActiveShifts,
    monthActiveRules,
    monthDailyShifts,
    dayShiftAssignments,
  }
}

/**
 * Restores data from an AppDataSnapshot into localStorage and updates the global store.
 * Redirection to the calendar view is handled automatically.
 */
export async function restoreAppData(data: AppDataSnapshot): Promise<void> {
  const people = (data.people || []).map((p) => ({
    ...p,
    id: p.id,
    name: p.name,
    color: p.color || '#3b82f6',
  }))

  StorageService.savePersons(people)

  const monthParticipants = data.monthParticipants || {}
  StorageService.saveMonthParticipants(monthParticipants)

  let availabilities: MonthlyAvailability[] = []
  if (Array.isArray(data.availabilities)) {
    availabilities = data.availabilities as MonthlyAvailability[]
  } else if (data.availabilities && typeof data.availabilities === 'object') {
    availabilities = Object.values(data.availabilities) as MonthlyAvailability[]
  }
  StorageService.saveAvailabilities(availabilities)

  const assignments = (data.assignments || {}) as Record<string, string[]>
  StorageService.saveAssignments(assignments)

  const events = Array.isArray(data.events) ? data.events : []
  StorageService.saveEvents(events)

  const expenses = Array.isArray(data.expenses) ? data.expenses : []
  StorageService.saveExpenses(expenses)

  const addresses = Array.isArray(data.addresses) ? data.addresses : []
  StorageService.saveAddresses(addresses)

  if (data.shiftDefinitions && Array.isArray(data.shiftDefinitions)) {
    StorageService.saveShiftDefinitions(data.shiftDefinitions)
  }

  if (data.shiftRules && Array.isArray(data.shiftRules)) {
    StorageService.saveShiftRules(data.shiftRules)
  }

  StorageService.saveMonthActiveShiftsMap(data.monthActiveShifts || {})
  StorageService.saveMonthActiveRulesMap(data.monthActiveRules || {})
  StorageService.saveMonthDailyShiftsMap(data.monthDailyShifts || {})
  StorageService.saveDayShiftAssignments(data.dayShiftAssignments || {})

  if (data.theme === 'dark' || data.theme === 'light') {
    localStorage.setItem('theme', data.theme)
    if (typeof document !== 'undefined') {
      if (data.theme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }

  const restoredShiftDefinitions = data.shiftDefinitions || StorageService.getShiftDefinitions()
  const restoredShiftRules = data.shiftRules || StorageService.getShiftRules()
  const restoredMonthActiveShifts = data.monthActiveShifts || {}
  const restoredMonthActiveRules = data.monthActiveRules || {}
  const restoredMonthDailyShifts = data.monthDailyShifts || {}
  const restoredDayShiftAssignments = data.dayShiftAssignments || {}

  // Update zustand store
  useScheduleStore.setState({
    persons: people,
    monthParticipants,
    availabilities,
    assignments,
    savedAssignments: { ...assignments },
    events,
    addresses,
    shiftDefinitions: restoredShiftDefinitions,
    shiftRules: restoredShiftRules,
    monthActiveShifts: restoredMonthActiveShifts,
    monthActiveRules: restoredMonthActiveRules,
    monthDailyShifts: restoredMonthDailyShifts,
    dayShiftAssignments: restoredDayShiftAssignments,
    savedDayShiftAssignments: { ...restoredDayShiftAssignments },
    hasUnsavedChanges: false,
    isEditMode: false,
    validationErrors: [],
    hasValidated: false,
    currentView: 'calendar',
    ...(data.theme === 'dark' || data.theme === 'light' ? { isDarkMode: data.theme === 'dark' } : {}),
  })

  if (CloudSyncService.isSyncEnabled()) {
    await useScheduleStore.getState().forcePushCloudData()
  }
}

/**
 * Merges incoming AppDataSnapshot with current local data:
 * records present in the backup update existing ones on conflict,
 * while non-conflicting existing local data is preserved.
 */
export async function mergeAppData(data: AppDataSnapshot): Promise<void> {
  // 1. Merge people by id
  const currentPersons = StorageService.getPersons()
  const incomingPersons = (data.people || []).map((p) => ({
    ...p,
    id: p.id,
    name: p.name,
    color: p.color || '#3b82f6',
  }))
  const personMap = new Map(currentPersons.map((p) => [p.id, p]))
  for (const p of incomingPersons) {
    const existing = personMap.get(p.id)
    personMap.set(p.id, existing ? { ...existing, ...p } : p)
  }
  const mergedPeople = Array.from(personMap.values())
  StorageService.savePersons(mergedPeople)

  // 2. Merge monthParticipants per month (union of participant IDs)
  const currentMonthParticipants = StorageService.getMonthParticipants()
  const incomingMonthParticipants = data.monthParticipants || {}
  const mergedMonthParticipants: Record<string, string[]> = { ...currentMonthParticipants }
  for (const [month, ids] of Object.entries(incomingMonthParticipants)) {
    if (Array.isArray(ids)) {
      const existingIds = mergedMonthParticipants[month] || []
      mergedMonthParticipants[month] = Array.from(new Set([...existingIds, ...ids]))
    }
  }
  StorageService.saveMonthParticipants(mergedMonthParticipants)

  // 3. Merge availabilities by (personId + month)
  const currentAvailabilities = StorageService.getAvailabilities()
  let incomingAvailabilities: MonthlyAvailability[] = []
  if (Array.isArray(data.availabilities)) {
    incomingAvailabilities = data.availabilities as MonthlyAvailability[]
  } else if (data.availabilities && typeof data.availabilities === 'object') {
    incomingAvailabilities = Object.values(data.availabilities) as MonthlyAvailability[]
  }
  const availMap = new Map<string, MonthlyAvailability>(
    currentAvailabilities.map((a) => [`${a.personId}_${a.month}`, a])
  )
  for (const incoming of incomingAvailabilities) {
    const key = `${incoming.personId}_${incoming.month}`
    const existing = availMap.get(key)
    if (existing) {
      availMap.set(key, {
        ...existing,
        ...incoming,
        shiftAvailability: {
          ...(existing.shiftAvailability || {}),
          ...(incoming.shiftAvailability || {}),
        },
        shiftRates: {
          ...(existing.shiftRates || {}),
          ...(incoming.shiftRates || {}),
        },
      })
    } else {
      availMap.set(key, incoming)
    }
  }
  const mergedAvailabilities = Array.from(availMap.values())
  StorageService.saveAvailabilities(mergedAvailabilities)

  // 4. Merge assignments by date (incoming date overrides conflicting date, non-conflicting dates remain)
  const currentAssignments = StorageService.getAssignments()
  const incomingAssignments = (data.assignments || {}) as Record<string, string[]>
  const mergedAssignments: Record<string, string[]> = { ...currentAssignments }
  for (const [dateStr, personIds] of Object.entries(incomingAssignments)) {
    if (Array.isArray(personIds)) {
      mergedAssignments[dateStr] = [...personIds]
    }
  }
  StorageService.saveAssignments(mergedAssignments)

  // 5. Merge events by id
  const currentEvents = StorageService.getEvents()
  const incomingEvents = Array.isArray(data.events) ? data.events : []
  const eventMap = new Map(currentEvents.map((e) => [e.id, e]))
  for (const ev of incomingEvents) {
    const existing = eventMap.get(ev.id)
    eventMap.set(ev.id, existing ? { ...existing, ...ev } : ev)
  }
  const mergedEvents = Array.from(eventMap.values())
  StorageService.saveEvents(mergedEvents)

  // 5b. Merge expenses by id
  const currentExpenses = StorageService.getExpenses()
  const incomingExpenses = Array.isArray(data.expenses) ? data.expenses : []
  const expenseMap = new Map(currentExpenses.map((exp) => [exp.id, exp]))
  for (const exp of incomingExpenses) {
    const existing = expenseMap.get(exp.id)
    expenseMap.set(exp.id, existing ? { ...existing, ...exp } : exp)
  }
  const mergedExpenses = Array.from(expenseMap.values())
  StorageService.saveExpenses(mergedExpenses)

  // 6. Merge addresses by id
  const currentAddresses = StorageService.getAddresses()
  const incomingAddresses = Array.isArray(data.addresses) ? data.addresses : []
  const addressMap = new Map(currentAddresses.map((a) => [a.id, a]))
  for (const addr of incomingAddresses) {
    const existing = addressMap.get(addr.id)
    addressMap.set(addr.id, existing ? { ...existing, ...addr } : addr)
  }
  const mergedAddresses = Array.from(addressMap.values())
  StorageService.saveAddresses(mergedAddresses)

  // 7. Merge shiftDefinitions by id
  const currentShifts = StorageService.getShiftDefinitions()
  let mergedShiftDefinitions = currentShifts
  if (data.shiftDefinitions && Array.isArray(data.shiftDefinitions)) {
    const shiftMap = new Map(currentShifts.map((s) => [s.id, s]))
    for (const s of data.shiftDefinitions) {
      const existing = shiftMap.get(s.id)
      shiftMap.set(s.id, existing ? { ...existing, ...s } : s)
    }
    mergedShiftDefinitions = Array.from(shiftMap.values())
    StorageService.saveShiftDefinitions(mergedShiftDefinitions)
  }

  // 8. Merge shiftRules by id
  const currentRules = StorageService.getShiftRules()
  let mergedShiftRules = currentRules
  if (data.shiftRules && Array.isArray(data.shiftRules)) {
    const ruleMap = new Map(currentRules.map((r) => [r.id, r]))
    for (const r of data.shiftRules) {
      const existing = ruleMap.get(r.id)
      ruleMap.set(r.id, existing ? { ...existing, ...r } : r)
    }
    mergedShiftRules = Array.from(ruleMap.values())
    StorageService.saveShiftRules(mergedShiftRules)
  }

  // 9. Merge monthActiveShifts
  const currentMonthActiveShifts = StorageService.getMonthActiveShiftsMap()
  const mergedMonthActiveShifts: Record<string, string[]> = { ...currentMonthActiveShifts }
  if (data.monthActiveShifts) {
    for (const [month, sIds] of Object.entries(data.monthActiveShifts)) {
      if (Array.isArray(sIds)) {
        const existingIds = mergedMonthActiveShifts[month] || []
        mergedMonthActiveShifts[month] = Array.from(new Set([...existingIds, ...sIds]))
      }
    }
    StorageService.saveMonthActiveShiftsMap(mergedMonthActiveShifts)
  }

  // 10. Merge monthActiveRules
  const currentMonthActiveRules = StorageService.getMonthActiveRulesMap()
  const mergedMonthActiveRules: Record<string, string[]> = { ...currentMonthActiveRules }
  if (data.monthActiveRules) {
    for (const [month, rIds] of Object.entries(data.monthActiveRules)) {
      if (Array.isArray(rIds)) {
        const existingIds = mergedMonthActiveRules[month] || []
        mergedMonthActiveRules[month] = Array.from(new Set([...existingIds, ...rIds]))
      }
    }
    StorageService.saveMonthActiveRulesMap(mergedMonthActiveRules)
  }

  // 11. Merge monthDailyShifts
  const currentMonthDailyShifts = StorageService.getMonthDailyShiftsMap()
  const mergedMonthDailyShifts: Record<string, Record<string, number[]>> = {
    ...currentMonthDailyShifts,
  }
  if (data.monthDailyShifts) {
    for (const [month, shiftsObj] of Object.entries(data.monthDailyShifts)) {
      if (shiftsObj && typeof shiftsObj === 'object') {
        mergedMonthDailyShifts[month] = {
          ...(mergedMonthDailyShifts[month] || {}),
          ...shiftsObj,
        }
      }
    }
    StorageService.saveMonthDailyShiftsMap(mergedMonthDailyShifts)
  }

  // 12. Merge dayShiftAssignments
  const currentDayShiftAssignments = StorageService.getDayShiftAssignments()
  const mergedDayShiftAssignments: Record<string, Record<string, string>> = {
    ...currentDayShiftAssignments,
  }
  if (data.dayShiftAssignments) {
    for (const [dateStr, shiftsObj] of Object.entries(data.dayShiftAssignments)) {
      if (shiftsObj && typeof shiftsObj === 'object') {
        mergedDayShiftAssignments[dateStr] = {
          ...(mergedDayShiftAssignments[dateStr] || {}),
          ...shiftsObj,
        }
      }
    }
    StorageService.saveDayShiftAssignments(mergedDayShiftAssignments)
  }

  // Update zustand store
  useScheduleStore.setState({
    persons: mergedPeople,
    monthParticipants: mergedMonthParticipants,
    availabilities: mergedAvailabilities,
    assignments: mergedAssignments,
    savedAssignments: { ...mergedAssignments },
    events: mergedEvents,
    addresses: mergedAddresses,
    shiftDefinitions: mergedShiftDefinitions,
    shiftRules: mergedShiftRules,
    monthActiveShifts: mergedMonthActiveShifts,
    monthActiveRules: mergedMonthActiveRules,
    monthDailyShifts: mergedMonthDailyShifts,
    dayShiftAssignments: mergedDayShiftAssignments,
    savedDayShiftAssignments: { ...mergedDayShiftAssignments },
    hasUnsavedChanges: false,
    isEditMode: false,
    validationErrors: [],
    hasValidated: false,
    currentView: 'calendar',
  })

  if (CloudSyncService.isSyncEnabled()) {
    await useScheduleStore.getState().forcePushCloudData()
  }
}

export const BackupService = {
  exportAppData,
  validateAndParseBackup,
  restoreAppData,
  mergeAppData,
  hasExistingLocalData,
  getBackupFilename,
}
