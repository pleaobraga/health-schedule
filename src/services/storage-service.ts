import { auth } from './firebase'
import { DEFAULT_SHIFTS, DEFAULT_RULES } from './validation/rule-engine'

import type {
  Person,
  MonthlyAvailability,
  CalendarEvent,
  DailyExpense,
  GuestProfile,
  GuestDataset,
  Address,
  ShiftDefinition,
  ShiftRule,
} from '../types'

const STORAGE_KEYS = {
  PERSONS: 'scale_manager_persons_v1',
  AVAILABILITIES: 'scale_manager_availabilities_v1',
  ASSIGNMENTS: 'scale_manager_assignments_v1',
  EVENTS: 'scale_manager_events_v1',
  EXPENSES: 'scale_manager_expenses_v1',
  MONTH_PARTICIPANTS: 'scale_manager_month_participants_v1',
  ADDRESSES: 'scale_manager_addresses_v1',
  SHIFT_DEFINITIONS: 'scale_manager_shift_definitions_v1',
  SHIFT_RULES: 'scale_manager_shift_rules_v1',
  MONTH_ACTIVE_SHIFTS: 'scale_manager_month_shifts_v1',
  MONTH_ACTIVE_RULES: 'scale_manager_month_rules_v1',
  MONTH_DAILY_SHIFTS: 'scale_manager_month_daily_shifts_v1',
  DAY_SHIFT_ASSIGNMENTS: 'scale_manager_day_shift_assignments_v1',
  GUEST_PROFILES: 'scale_manager_guest_profiles_v1',
  ACTIVE_GUEST_ID: 'scale_manager_active_guest_id_v1',
  GUEST_DATA_PREFIX: 'scale_manager_guest_data_v1_',
  ACTIVE_USER_ID: 'scale_manager_active_user_id_v1',
  USER_DATA_PREFIX: 'scale_manager_user_data_v1_',
  ONBOARDING_CHECKED: 'health-schedule:onboarding-checked',
  LIST_ORDER_PREFIX: 'scale_manager_list_order_v1_',
}

/** Lists whose display order can be rearranged with drag and drop */
export const LIST_ORDER_IDS = ['month-people', 'people', 'addresses', 'shifts', 'rules'] as const
export type ListOrderId = (typeof LIST_ORDER_IDS)[number]

let isRestoringDataset = false

export class StorageService {
  /**
   * Load persons from storage (returns empty array if storage has no data)
   */
  static getPersons(): Person[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PERSONS)
      if (!data) {
        return []
      }
      const parsed: Person[] = JSON.parse(data)
      return parsed.map((p) => ({
        ...p,
        active: p.active !== false,
      }))
    } catch (err) {
      console.error('Failed to load persons from localStorage:', err)
      return []
    }
  }

  static savePersons(persons: Person[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PERSONS, JSON.stringify(persons))
      if (!isRestoringDataset) {
        StorageService.snapshotActiveSession()
      }
    } catch (err) {
      console.error('Failed to save persons to localStorage:', err)
    }
  }

  /**
   * Load availabilities (returns empty array if storage has no data)
   */
  static getAvailabilities(): MonthlyAvailability[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.AVAILABILITIES)
      if (!data) {
        return []
      }
      return JSON.parse(data)
    } catch (err) {
      console.error('Failed to load availabilities from localStorage:', err)
      return []
    }
  }

  static saveAvailabilities(availabilities: MonthlyAvailability[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.AVAILABILITIES, JSON.stringify(availabilities))
      if (!isRestoringDataset) {
        StorageService.snapshotActiveSession()
      }
    } catch (err) {
      console.error('Failed to save availabilities to localStorage:', err)
    }
  }

  /**
   * Load assignments ('YYYY-MM-DD' -> string[], returns empty object if storage has no data)
   */
  static getAssignments(): Record<string, string[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS)
      if (!data) {
        return {}
      }
      return JSON.parse(data)
    } catch (err) {
      console.error('Failed to load assignments from localStorage:', err)
      return {}
    }
  }

  static saveAssignments(assignments: Record<string, string[]>): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments))
      if (!isRestoringDataset) {
        StorageService.snapshotActiveSession()
      }
    } catch (err) {
      console.error('Failed to save assignments to localStorage:', err)
    }
  }

  /**
   * Load calendar events (returns empty array if storage has no data)
   */
  static getEvents(): CalendarEvent[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EVENTS)
      if (!data) {
        return []
      }
      return JSON.parse(data)
    } catch (err) {
      console.error('Failed to load events from localStorage:', err)
      return []
    }
  }

  static saveEvents(events: CalendarEvent[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events))
      if (!isRestoringDataset) {
        StorageService.snapshotActiveSession()
      }
    } catch (err) {
      console.error('Failed to save events to localStorage:', err)
    }
  }

  /**
   * Load daily expenses (returns empty array if storage has no data)
   */
  static getExpenses(): DailyExpense[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EXPENSES)
      if (!data) {
        return []
      }
      return JSON.parse(data)
    } catch (err) {
      console.error('Failed to load expenses from localStorage:', err)
      return []
    }
  }

  static saveExpenses(expenses: DailyExpense[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses))
      if (!isRestoringDataset) {
        StorageService.snapshotActiveSession()
      }
    } catch (err) {
      console.error('Failed to save expenses to localStorage:', err)
    }
  }

  /**
   * Load month participants ('YYYY-MM' -> personId[], returns empty object if storage has no data)
   */
  static getMonthParticipants(): Record<string, string[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MONTH_PARTICIPANTS)
      if (!data) {
        return {}
      }
      return JSON.parse(data)
    } catch (err) {
      console.error('Failed to load month participants from localStorage:', err)
      return {}
    }
  }

  static saveMonthParticipants(data: Record<string, string[]>): void {
    try {
      localStorage.setItem(STORAGE_KEYS.MONTH_PARTICIPANTS, JSON.stringify(data))
      if (!isRestoringDataset) {
        StorageService.snapshotActiveSession()
      }
    } catch (err) {
      console.error('Failed to save month participants to localStorage:', err)
    }
  }

  /**
   * Load registered addresses (returns empty array if storage has no data)
   */
  static getAddresses(): Address[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ADDRESSES)
      if (!data) {
        return []
      }
      return JSON.parse(data)
    } catch (err) {
      console.error('Failed to load addresses from localStorage:', err)
      return []
    }
  }

  static saveAddresses(addresses: Address[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ADDRESSES, JSON.stringify(addresses))
      if (!isRestoringDataset) {
        StorageService.snapshotActiveSession()
      }
    } catch (err) {
      console.error('Failed to save addresses to localStorage:', err)
    }
  }

  /**
   * Load shift definitions. Returns DEFAULT_SHIFTS if none in storage.
   */
  static getShiftDefinitions(): ShiftDefinition[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SHIFT_DEFINITIONS)
      if (!data) {
        return DEFAULT_SHIFTS
      }
      return JSON.parse(data)
    } catch (err) {
      console.error('Failed to load shift definitions from localStorage:', err)
      return DEFAULT_SHIFTS
    }
  }

  static saveShiftDefinitions(shifts: ShiftDefinition[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SHIFT_DEFINITIONS, JSON.stringify(shifts))
      if (!isRestoringDataset) {
        StorageService.snapshotActiveSession()
      }
    } catch (err) {
      console.error('Failed to save shift definitions to localStorage:', err)
    }
  }

  /**
   * Load shift rules. Returns DEFAULT_RULES if none in storage.
   */
  static getShiftRules(): ShiftRule[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SHIFT_RULES)
      if (!data) {
        return DEFAULT_RULES
      }
      return JSON.parse(data)
    } catch (err) {
      console.error('Failed to load shift rules from localStorage:', err)
      return DEFAULT_RULES
    }
  }

  static saveShiftRules(rules: ShiftRule[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SHIFT_RULES, JSON.stringify(rules))
      if (!isRestoringDataset) {
        StorageService.snapshotActiveSession()
      }
    } catch (err) {
      console.error('Failed to save shift rules to localStorage:', err)
    }
  }

  /**
   * Load month active shifts mapping ('YYYY-MM' -> string[])
   */
  static getMonthActiveShiftsMap(): Record<string, string[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MONTH_ACTIVE_SHIFTS)
      if (!data) return {}
      return JSON.parse(data)
    } catch (err) {
      console.error('Failed to load month active shifts from localStorage:', err)
      return {}
    }
  }

  static saveMonthActiveShiftsMap(map: Record<string, string[]>): void {
    try {
      localStorage.setItem(STORAGE_KEYS.MONTH_ACTIVE_SHIFTS, JSON.stringify(map))
      if (!isRestoringDataset) {
        StorageService.snapshotActiveSession()
      }
    } catch (err) {
      console.error('Failed to save month active shifts to localStorage:', err)
    }
  }

  /**
   * Load month active rules mapping ('YYYY-MM' -> string[])
   */
  static getMonthActiveRulesMap(): Record<string, string[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MONTH_ACTIVE_RULES)
      if (!data) return {}
      return JSON.parse(data)
    } catch (err) {
      console.error('Failed to load month active rules from localStorage:', err)
      return {}
    }
  }

  static saveMonthActiveRulesMap(map: Record<string, string[]>): void {
    try {
      localStorage.setItem(STORAGE_KEYS.MONTH_ACTIVE_RULES, JSON.stringify(map))
      if (!isRestoringDataset) {
        StorageService.snapshotActiveSession()
      }
    } catch (err) {
      console.error('Failed to save month active rules to localStorage:', err)
    }
  }

  /**
   * Load month daily shift mappings ('YYYY-MM' -> { [shiftId]: number[] })
   */
  static getMonthDailyShiftsMap(): Record<string, Record<string, number[]>> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MONTH_DAILY_SHIFTS)
      if (!data) return {}
      return JSON.parse(data)
    } catch (err) {
      console.error('Failed to load month daily shifts from localStorage:', err)
      return {}
    }
  }

  static saveMonthDailyShiftsMap(map: Record<string, Record<string, number[]>>): void {
    try {
      localStorage.setItem(STORAGE_KEYS.MONTH_DAILY_SHIFTS, JSON.stringify(map))
      if (!isRestoringDataset) {
        StorageService.snapshotActiveSession()
      }
    } catch (err) {
      console.error('Failed to save month daily shifts to localStorage:', err)
    }
  }

  /**
   * Load day shift assignments mapping ('YYYY-MM-DD' -> { [shiftId]: personId })
   */
  static getDayShiftAssignments(): Record<string, Record<string, string>> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DAY_SHIFT_ASSIGNMENTS)
      if (!data) return {}
      return JSON.parse(data)
    } catch (err) {
      console.error('Failed to load day shift assignments from localStorage:', err)
      return {}
    }
  }

  static saveDayShiftAssignments(map: Record<string, Record<string, string>>): void {
    try {
      localStorage.setItem(STORAGE_KEYS.DAY_SHIFT_ASSIGNMENTS, JSON.stringify(map))
      if (!isRestoringDataset) {
        StorageService.snapshotActiveSession()
      }
    } catch (err) {
      console.error('Failed to save day shift assignments to localStorage:', err)
    }
  }

  /**
   * Drag-and-drop display order of lists (device-local preference, never synced to the cloud).
   * Scoped per active guest profile / user so each dataset keeps its own order.
   */
  static getListOrderScope(): string {
    const activeGuestId = StorageService.getActiveGuestId()
    if (activeGuestId) return `guest_${activeGuestId}`
    const activeUserId = StorageService.getActiveUserId()
    if (activeUserId) return `user_${activeUserId}`
    return 'local'
  }

  static getListOrderKey(listId: ListOrderId): string {
    return `${STORAGE_KEYS.LIST_ORDER_PREFIX}${listId}_${StorageService.getListOrderScope()}`
  }

  static getListOrder(listId: ListOrderId): string[] {
    try {
      const data = localStorage.getItem(StorageService.getListOrderKey(listId))
      const parsed: unknown = data ? JSON.parse(data) : []
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
    } catch (err) {
      console.error('Failed to load list order from localStorage:', err)
      return []
    }
  }

  static saveListOrder(listId: ListOrderId, order: string[]): void {
    try {
      localStorage.setItem(StorageService.getListOrderKey(listId), JSON.stringify(order))
    } catch (err) {
      console.error('Failed to save list order to localStorage:', err)
    }
  }

  static clearListOrders(): void {
    LIST_ORDER_IDS.forEach((listId) => localStorage.removeItem(StorageService.getListOrderKey(listId)))
  }

  /**
   * Reset all active storage keys
   */
  static resetToDefault(): void {
    localStorage.removeItem(STORAGE_KEYS.PERSONS)
    localStorage.removeItem(STORAGE_KEYS.AVAILABILITIES)
    localStorage.removeItem(STORAGE_KEYS.ASSIGNMENTS)
    localStorage.removeItem(STORAGE_KEYS.EVENTS)
    localStorage.removeItem(STORAGE_KEYS.EXPENSES)
    localStorage.removeItem(STORAGE_KEYS.MONTH_PARTICIPANTS)
    localStorage.removeItem(STORAGE_KEYS.ADDRESSES)
    localStorage.removeItem(STORAGE_KEYS.SHIFT_DEFINITIONS)
    localStorage.removeItem(STORAGE_KEYS.SHIFT_RULES)
    localStorage.removeItem(STORAGE_KEYS.MONTH_ACTIVE_SHIFTS)
    localStorage.removeItem(STORAGE_KEYS.MONTH_ACTIVE_RULES)
    localStorage.removeItem(STORAGE_KEYS.MONTH_DAILY_SHIFTS)
    localStorage.removeItem(STORAGE_KEYS.DAY_SHIFT_ASSIGNMENTS)
  }

  /**
   * Clears all local application data for the current user/session.
   * If an active guest session is present, also removes the guest's saved dataset snapshot.
   */
  static clearAllLocalData(): void {
    StorageService.clearListOrders()
    const activeGuestId = StorageService.getActiveGuestId()
    if (activeGuestId) {
      StorageService.deleteGuestDataset(activeGuestId)
    }
    const activeUserId = StorageService.getActiveUserId()
    if (activeUserId) {
      StorageService.deleteUserDataset(activeUserId)
    }
    StorageService.resetToDefault()
    localStorage.setItem(STORAGE_KEYS.SHIFT_DEFINITIONS, JSON.stringify([]))
    localStorage.setItem(STORAGE_KEYS.SHIFT_RULES, JSON.stringify([]))
  }

  /**
   * Guest Profiles & Dataset Management
   */
  static getGuestProfiles(): GuestProfile[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.GUEST_PROFILES)
      if (!data) {
        return []
      }
      return JSON.parse(data)
    } catch (err) {
      console.error('Failed to load guest profiles from localStorage:', err)
      return []
    }
  }

  static saveGuestProfiles(profiles: GuestProfile[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.GUEST_PROFILES, JSON.stringify(profiles))
    } catch (err) {
      console.error('Failed to save guest profiles to localStorage:', err)
    }
  }

  static getActiveGuestId(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_GUEST_ID)
    } catch {
      return null
    }
  }

  static setActiveGuestId(id: string | null): void {
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_GUEST_ID, id)
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_GUEST_ID)
      }
    } catch (err) {
      console.error('Failed to set active guest id in localStorage:', err)
    }
  }

  static getGuestDataset(guestId: string): GuestDataset | null {
    try {
      const data = localStorage.getItem(`${STORAGE_KEYS.GUEST_DATA_PREFIX}${guestId}`)
      if (!data) {
        return null
      }
      return JSON.parse(data)
    } catch (err) {
      console.error('Failed to load guest dataset from localStorage:', err)
      return null
    }
  }

  static saveGuestDataset(guestId: string, dataset: GuestDataset): void {
    try {
      localStorage.setItem(`${STORAGE_KEYS.GUEST_DATA_PREFIX}${guestId}`, JSON.stringify(dataset))
    } catch (err) {
      console.error('Failed to save guest dataset to localStorage:', err)
    }
  }

  static deleteGuestDataset(guestId: string): void {
    try {
      localStorage.removeItem(`${STORAGE_KEYS.GUEST_DATA_PREFIX}${guestId}`)
    } catch (err) {
      console.error('Failed to delete guest dataset from localStorage:', err)
    }
  }

  static getCurrentDataset(): GuestDataset {
    return {
      persons: StorageService.getPersons(),
      availabilities: StorageService.getAvailabilities(),
      assignments: StorageService.getAssignments(),
      events: StorageService.getEvents(),
      expenses: StorageService.getExpenses(),
      monthParticipants: StorageService.getMonthParticipants(),
      addresses: StorageService.getAddresses(),
      shiftDefinitions: StorageService.getShiftDefinitions(),
      shiftRules: StorageService.getShiftRules(),
      monthActiveShifts: StorageService.getMonthActiveShiftsMap(),
      monthActiveRules: StorageService.getMonthActiveRulesMap(),
      monthDailyShifts: StorageService.getMonthDailyShiftsMap(),
      dayShiftAssignments: StorageService.getDayShiftAssignments(),
    }
  }

  static restoreDataset(dataset: Partial<GuestDataset>): void {
    isRestoringDataset = true
    try {
      StorageService.savePersons(dataset.persons || [])
      StorageService.saveAvailabilities(dataset.availabilities || [])
      StorageService.saveAssignments(dataset.assignments || {})
      StorageService.saveEvents(dataset.events || [])
      StorageService.saveExpenses(dataset.expenses || [])
      StorageService.saveMonthParticipants(dataset.monthParticipants || {})
      StorageService.saveAddresses(dataset.addresses || [])
      if (dataset.shiftDefinitions) {
        StorageService.saveShiftDefinitions(dataset.shiftDefinitions)
      }
      if (dataset.shiftRules) {
        StorageService.saveShiftRules(dataset.shiftRules)
      }
      if (dataset.monthActiveShifts) {
        StorageService.saveMonthActiveShiftsMap(dataset.monthActiveShifts)
      }
      if (dataset.monthActiveRules) {
        StorageService.saveMonthActiveRulesMap(dataset.monthActiveRules)
      }
      if (dataset.monthDailyShifts) {
        StorageService.saveMonthDailyShiftsMap(dataset.monthDailyShifts)
      }
      if (dataset.dayShiftAssignments) {
        StorageService.saveDayShiftAssignments(dataset.dayShiftAssignments)
      }
    } finally {
      isRestoringDataset = false
      StorageService.snapshotActiveSession()
    }
  }

  static snapshotActiveGuest(): void {
    const activeId = StorageService.getActiveGuestId()
    if (activeId) {
      const dataset = StorageService.getCurrentDataset()
      StorageService.saveGuestDataset(activeId, dataset)
    }
  }

  /**
   * Authenticated User Dataset Management
   */
  static getActiveUserId(): string | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID)
      if (stored) return stored
      return auth?.currentUser?.uid || null
    } catch {
      return auth?.currentUser?.uid || null
    }
  }

  static setActiveUserId(id: string | null): void {
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, id)
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER_ID)
      }
    } catch (err) {
      console.error('Failed to set active user id in localStorage:', err)
    }
  }

  static getUserDataset(userId: string): GuestDataset | null {
    try {
      const data = localStorage.getItem(`${STORAGE_KEYS.USER_DATA_PREFIX}${userId}`)
      if (!data) {
        return null
      }
      return JSON.parse(data)
    } catch (err) {
      console.error('Failed to load user dataset from localStorage:', err)
      return null
    }
  }

  static saveUserDataset(userId: string, dataset: GuestDataset): void {
    try {
      localStorage.setItem(`${STORAGE_KEYS.USER_DATA_PREFIX}${userId}`, JSON.stringify(dataset))
    } catch (err) {
      console.error('Failed to save user dataset to localStorage:', err)
    }
  }

  static deleteUserDataset(userId: string): void {
    try {
      localStorage.removeItem(`${STORAGE_KEYS.USER_DATA_PREFIX}${userId}`)
    } catch (err) {
      console.error('Failed to delete user dataset from localStorage:', err)
    }
  }

  static snapshotActiveUser(userId?: string): void {
    const activeId = userId || StorageService.getActiveUserId()
    if (activeId) {
      const dataset = StorageService.getCurrentDataset()
      StorageService.saveUserDataset(activeId, dataset)
    }
  }

  /**
   * Snapshots current working data to whichever profile/account is currently active:
   * guest profile if activeGuestId is present, or authenticated user if activeUserId is present.
   */
  static snapshotActiveSession(): void {
    const activeGuestId = StorageService.getActiveGuestId()
    if (activeGuestId) {
      StorageService.snapshotActiveGuest()
      return
    }

    const activeUserId = StorageService.getActiveUserId()
    if (activeUserId) {
      StorageService.snapshotActiveUser(activeUserId)
    }
  }

  static hasCheckedOnboarding(): boolean {
    if (typeof sessionStorage === 'undefined') return false
    return sessionStorage.getItem(STORAGE_KEYS.ONBOARDING_CHECKED) === 'true'
  }

  static setCheckedOnboarding(checked = true): void {
    if (typeof sessionStorage === 'undefined') return
    if (checked) {
      sessionStorage.setItem(STORAGE_KEYS.ONBOARDING_CHECKED, 'true')
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.ONBOARDING_CHECKED)
    }
  }

  static clearCheckedOnboarding(): void {
    if (typeof sessionStorage === 'undefined') return
    sessionStorage.removeItem(STORAGE_KEYS.ONBOARDING_CHECKED)
  }
}

