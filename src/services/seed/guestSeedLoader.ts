import { useCallback, useState } from 'react'

import { i18n } from '../../i18n'
import { useScheduleStore } from '../../store/use-schedule-store'
import { BackupService } from '../backup-service'
import { StorageService } from '../storage-service'

import type { AppDataSnapshot, CalendarEvent, DailyExpense } from '../../types'

export interface RelativeMonths {
  prevMonthStr: string
  currMonthStr: string
  nextMonthStr: string
}

/**
 * Calculates the dynamic 3-month window (M-1, M, M+1) relative to a reference date.
 * Year boundaries (e.g. Dec -> Jan or Jan -> Dec) are automatically handled.
 */
export function getRelativeMonths(refDate: Date = new Date()): RelativeMonths {
  const year = refDate.getFullYear()
  const month = refDate.getMonth()

  const formatYM = (y: number, m: number) => {
    const d = new Date(y, m, 1)
    const yearStr = d.getFullYear()
    const monthStr = String(d.getMonth() + 1).padStart(2, '0')
    return `${yearStr}-${monthStr}`
  }

  return {
    prevMonthStr: formatYM(year, month - 1),
    currMonthStr: formatYM(year, month),
    nextMonthStr: formatYM(year, month + 1),
  }
}

/**
 * Returns the exact number of days for a given 'YYYY-MM' string,
 * taking leap years into account.
 */
export function getDaysInMonth(yearMonthStr: string): number {
  const parts = yearMonthStr.split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])
  if (isNaN(y) || isNaN(m)) return 31
  return new Date(y, m, 0).getDate()
}

/**
 * Checks whether local storage has any persons or schedule assignments.
 */
export function isGuestDataEmpty(): boolean {
  const persons = StorageService.getPersons()
  const assignments = StorageService.getAssignments()
  const hasPersons = Array.isArray(persons) && persons.length > 0
  const hasAssignments =
    Boolean(assignments) &&
    typeof assignments === 'object' &&
    Object.values(assignments).some((arr) => Array.isArray(arr) && arr.length > 0)

  return !hasPersons && !hasAssignments
}

/**
 * Transforms template demo data into the user's dynamic 3-month window (M-1, M, M+1).
 * Clamps and filters day numbers to ensure validity across months of 28, 30, or 31 days.
 */
export function transformSeedData(
  rawDemo: AppDataSnapshot,
  refDate: Date = new Date()
): AppDataSnapshot {
  const { prevMonthStr, currMonthStr, nextMonthStr } = getRelativeMonths(refDate)

  // 1. Detect source months from raw template
  const detectedMonths = new Set<string>()

  if (rawDemo.monthParticipants) {
    Object.keys(rawDemo.monthParticipants).forEach((m) => detectedMonths.add(m))
  }
  if (rawDemo.monthActiveShifts) {
    Object.keys(rawDemo.monthActiveShifts).forEach((m) => detectedMonths.add(m))
  }
  if (rawDemo.monthActiveRules) {
    Object.keys(rawDemo.monthActiveRules).forEach((m) => detectedMonths.add(m))
  }
  if (rawDemo.monthDailyShifts) {
    Object.keys(rawDemo.monthDailyShifts).forEach((m) => detectedMonths.add(m))
  }
  if (rawDemo.availabilities && Array.isArray(rawDemo.availabilities)) {
    rawDemo.availabilities.forEach((a: unknown) => {
      const avail = a as { month?: string }
      if (avail.month) detectedMonths.add(avail.month)
    })
  }
  if (rawDemo.assignments) {
    Object.keys(rawDemo.assignments).forEach((d) => {
      if (d.length >= 7) detectedMonths.add(d.slice(0, 7))
    })
  }
  if (rawDemo.events) {
    rawDemo.events.forEach((e: unknown) => {
      const ev = e as { date?: string }
      if (ev.date && ev.date.length >= 7) detectedMonths.add(ev.date.slice(0, 7))
    })
  }

  const sortedSourceMonths = Array.from(detectedMonths).sort()
  const sourcePrev = sortedSourceMonths[0] || '2026-09'
  const sourceCurr = sortedSourceMonths[1] || '2026-10'
  const sourceNext = sortedSourceMonths[2] || '2026-11'

  const monthMap: Record<string, string> = {
    [sourcePrev]: prevMonthStr,
    [sourceCurr]: currMonthStr,
    [sourceNext]: nextMonthStr,
  }

  // 2. monthParticipants
  const monthParticipants: Record<string, string[]> = {}
  if (rawDemo.monthParticipants) {
    for (const [srcM, participants] of Object.entries(rawDemo.monthParticipants)) {
      const tgtM = monthMap[srcM] || srcM
      monthParticipants[tgtM] = Array.isArray(participants) ? [...participants] : []
    }
  }

  // 3. monthActiveShifts
  const monthActiveShifts: Record<string, string[]> = {}
  if (rawDemo.monthActiveShifts) {
    for (const [srcM, shifts] of Object.entries(rawDemo.monthActiveShifts)) {
      const tgtM = monthMap[srcM] || srcM
      monthActiveShifts[tgtM] = Array.isArray(shifts) ? [...shifts] : []
    }
  }

  // 4. monthActiveRules
  const monthActiveRules: Record<string, string[]> = {}
  if (rawDemo.monthActiveRules) {
    for (const [srcM, rules] of Object.entries(rawDemo.monthActiveRules)) {
      const tgtM = monthMap[srcM] || srcM
      monthActiveRules[tgtM] = Array.isArray(rules) ? [...rules] : []
    }
  }

  // 5. monthDailyShifts
  const monthDailyShifts: Record<string, Record<string, number[]>> = {}
  if (rawDemo.monthDailyShifts) {
    for (const [srcM, shiftsRecord] of Object.entries(rawDemo.monthDailyShifts)) {
      const tgtM = monthMap[srcM] || srcM
      const maxDays = getDaysInMonth(tgtM)
      const newShiftsRecord: Record<string, number[]> = {}
      if (shiftsRecord && typeof shiftsRecord === 'object') {
        for (const [shiftId, days] of Object.entries(shiftsRecord)) {
          if (Array.isArray(days)) {
            newShiftsRecord[shiftId] = days.filter(
              (d) => typeof d === 'number' && d >= 1 && d <= maxDays
            )
          }
        }
      }
      monthDailyShifts[tgtM] = newShiftsRecord
    }
  }

  // 6. assignments (only keeping valid days 1..maxDays for each target month)
  const assignments: Record<string, string[]> = {}
  if (rawDemo.assignments && typeof rawDemo.assignments === 'object') {
    for (const [dateStr, persons] of Object.entries(rawDemo.assignments)) {
      const srcM = dateStr.slice(0, 7)
      const tgtM = monthMap[srcM] || srcM
      const day = parseInt(dateStr.slice(8, 10), 10)
      const maxDays = getDaysInMonth(tgtM)
      if (isNaN(day) || day < 1 || day > maxDays) {
        continue
      }
      const newDateStr = `${tgtM}-${String(day).padStart(2, '0')}`
      assignments[newDateStr] = Array.isArray(persons) ? [...persons] : []
    }
  }

  // 7. dayShiftAssignments (normalizing possible array values e.g. ["p_seed_01"] to string and validating days 1..maxDays)
  const dayShiftAssignments: Record<string, Record<string, string>> = {}
  if (rawDemo.dayShiftAssignments && typeof rawDemo.dayShiftAssignments === 'object') {
    for (const [dateStr, shiftsObj] of Object.entries(rawDemo.dayShiftAssignments)) {
      const srcM = dateStr.slice(0, 7)
      const tgtM = monthMap[srcM] || srcM
      const day = parseInt(dateStr.slice(8, 10), 10)
      const maxDays = getDaysInMonth(tgtM)
      if (isNaN(day) || day < 1 || day > maxDays) {
        continue
      }
      const targetDateStr = `${tgtM}-${String(day).padStart(2, '0')}`

      const normalizedShifts: Record<string, string> = {}
      if (shiftsObj && typeof shiftsObj === 'object') {
        for (const [shiftId, val] of Object.entries(shiftsObj)) {
          const personId = Array.isArray(val)
            ? val[0]
            : typeof val === 'string'
              ? val
              : ''
          if (personId) {
            normalizedShifts[shiftId] = personId
          }
        }
      }
      dayShiftAssignments[targetDateStr] = normalizedShifts
    }
  }

  // 8. availabilities
  const rawAvailabilities = Array.isArray(rawDemo.availabilities)
    ? rawDemo.availabilities
    : rawDemo.availabilities && typeof rawDemo.availabilities === 'object'
      ? Object.values(rawDemo.availabilities)
      : []

  const availabilities = rawAvailabilities.map((a: unknown) => {
    const avail = a as {
      personId: string
      month: string
      availableDays?: number[]
      shiftAvailability?: Record<string, number[]>
      shiftRates?: Record<string, Record<string, number>>
      [key: string]: unknown
    }
    const srcM = avail.month
    const tgtM = monthMap[srcM] || srcM
    const maxDays = getDaysInMonth(tgtM)

    const availableDays = Array.isArray(avail.availableDays)
      ? avail.availableDays.filter((d: number) => typeof d === 'number' && d >= 1 && d <= maxDays)
      : []

    const shiftAvailability: Record<string, number[]> = {}
    if (avail.shiftAvailability && typeof avail.shiftAvailability === 'object') {
      for (const [sId, days] of Object.entries(avail.shiftAvailability)) {
        if (Array.isArray(days)) {
          shiftAvailability[sId] = days.filter(
            (d: number) => typeof d === 'number' && d >= 1 && d <= maxDays
          )
        }
      }
    }

    const shiftRates: Record<string, Record<string, number>> = {}
    if (avail.shiftRates && typeof avail.shiftRates === 'object') {
      for (const [sId, rates] of Object.entries(avail.shiftRates)) {
        if (rates && typeof rates === 'object') {
          const filteredRates: Record<string, number> = {}
          for (const [dayStr, rateVal] of Object.entries(rates)) {
            const d = parseInt(dayStr, 10)
            if (!isNaN(d) && d >= 1 && d <= maxDays) {
              filteredRates[dayStr] = rateVal
            }
          }
          shiftRates[sId] = filteredRates
        }
      }
    }

    return {
      ...avail,
      month: tgtM,
      availableDays,
      shiftAvailability,
      shiftRates,
    }
  })

  // 9. events (preserving addressId, personId, time, title and validating day within 1..maxDays)
  const events = (rawDemo.events || []).map((e) => {
    const ev = e as CalendarEvent & { [key: string]: unknown }
    if (!ev.date || ev.date.length < 7) return { ...ev }
    const srcM = ev.date.slice(0, 7)
    const tgtM = monthMap[srcM] || srcM
    const day = parseInt(ev.date.slice(8, 10), 10)
    const maxDays = getDaysInMonth(tgtM)
    const clampedDay = isNaN(day) ? 1 : Math.min(Math.max(1, day), maxDays)
    return {
      ...ev,
      date: `${tgtM}-${String(clampedDay).padStart(2, '0')}`,
    }
  })

  // 10. expenses (a purchase in the current month never lands after the reference date)
  const expenses = (rawDemo.expenses || []).map((e) => {
    const expense = e as DailyExpense
    const srcM = expense.date.slice(0, 7)
    const tgtM = monthMap[srcM] || srcM
    const day = parseInt(expense.date.slice(8, 10), 10)
    const maxDays = getDaysInMonth(tgtM)
    const lastDay = tgtM === currMonthStr ? Math.min(maxDays, refDate.getDate()) : maxDays
    const clampedDay = isNaN(day) ? 1 : Math.min(Math.max(1, day), lastDay)
    const date = `${tgtM}-${String(clampedDay).padStart(2, '0')}`
    const timestamp = `${date}T12:00:00.000Z`
    return { ...expense, date, createdAt: timestamp, updatedAt: timestamp }
  })

  return {
    ...rawDemo,
    exportedAt: new Date().toISOString(),
    monthParticipants,
    monthActiveShifts,
    monthActiveRules,
    monthDailyShifts,
    assignments,
    dayShiftAssignments,
    availabilities,
    events,
    expenses,
    expenseItems: rawDemo.expenseItems || [],
    people: rawDemo.people || [],
    addresses: rawDemo.addresses || [],
    shiftDefinitions: rawDemo.shiftDefinitions || [],
    shiftRules: rawDemo.shiftRules || [],
    theme: rawDemo.theme || 'dark',
  }
}

/**
 * Checks whether the given or active application language is English.
 */
export function isEnglishLanguage(language?: string): boolean {
  const activeLang = (language ?? i18n?.language ?? '').trim().toLowerCase()
  return activeLang.startsWith('en')
}

/**
 * Resolves the full or relative URL to the demo JSON based on active language.
 * Ensures compatibility with Vite base URL and Node.js/JSDOM fetch environments.
 */
export function resolveSeedUrl(customUrl?: string, language?: string): string {
  if (customUrl) return customUrl
  const base = import.meta.env?.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const fileName = isEnglishLanguage(language) ? 'demo-en.json' : 'demo.json'
  const relativePath = `${normalizedBase}demo/${fileName}`

  if (
    typeof window !== 'undefined' &&
    window.location &&
    window.location.origin &&
    window.location.origin !== 'null'
  ) {
    try {
      return new URL(relativePath, window.location.origin).toString()
    } catch {
      return relativePath
    }
  }
  return relativePath
}

/**
 * Fetches the demo seed JSON from the public directory.
 */
export async function fetchSeedJson(
  customUrl?: string,
  language?: string
): Promise<AppDataSnapshot> {
  const url = resolveSeedUrl(customUrl, language)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load seed JSON from ${url}: status ${response.status}`)
  }
  return (await response.json()) as AppDataSnapshot
}

/**
 * Loads and restores dynamic guest seed data into the application state and localStorage.
 */
export async function loadGuestSeedData(options?: {
  refDate?: Date
  customUrl?: string
  rawJson?: AppDataSnapshot
  language?: string
}): Promise<AppDataSnapshot> {
  const raw =
    options?.rawJson || (await fetchSeedJson(options?.customUrl, options?.language))
  const transformed = transformSeedData(raw, options?.refDate)

  // 1. Populate storage and zustand store
  await BackupService.restoreAppData(transformed)

  // 2. Set currentMonth to the dynamic current month (M)
  const { currMonthStr } = getRelativeMonths(options?.refDate)
  useScheduleStore.setState({ currentMonth: currMonthStr })

  // 3. Mark onboarding as checked to prevent redirect to /configuracoes?tab=importar
  StorageService.setCheckedOnboarding(true)

  // 4. Snapshot to active guest profile if present
  const activeGuestId = StorageService.getActiveGuestId()
  if (activeGuestId) {
    StorageService.snapshotActiveGuest()
  }

  return transformed
}

/**
 * React Hook for executing the seed loader with loading and error states.
 */
export function useGuestSeedLoader() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const loadSeed = useCallback(
    async (options?: {
      refDate?: Date
      customUrl?: string
      rawJson?: AppDataSnapshot
      language?: string
    }) => {
      try {
        setIsLoading(true)
        setError(null)
        return await loadGuestSeedData(options)
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        throw e
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  return { loadSeed, isLoading, error }
}
