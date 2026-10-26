import {
  collection,
  doc,
  getDoc,
  getDocsFromServer,
  onSnapshot,
  setDoc,
  serverTimestamp
} from 'firebase/firestore'

import { auth, db } from './firebase'
import { StorageService } from './storage-service'

import type {
  MonthlyAvailability,
  CalendarEvent,
  DailyExpense,
  Person,
  Address,
  ShiftDefinition,
  ShiftRule,
} from '../types'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'

export const CLOUD_SYNC_STORAGE_KEY = 'scale_manager_cloud_sync_enabled'

/**
 * Version 2 month docs hold only their own month's slice and are fully replaced on save.
 * Version 1 (legacy, no `schemaVersion`) docs held a copy of the whole dataset.
 */
export const MONTH_DOC_SCHEMA_VERSION = 2

const SCHEDULES_COLLECTION = 'schedules'
const MONTH_ID_PATTERN = /^\d{4}-\d{2}$/

export interface MonthScheduleData {
  assignments?: Record<string, string[]>;
  monthParticipants?: Record<string, string[]>;
  availabilities?: MonthlyAvailability[];
  events?: CalendarEvent[];
  expenses?: DailyExpense[];
  dayShiftAssignments?: Record<string, Record<string, string>>;
  monthDailyShifts?: Record<string, Record<string, number[]>>;
  monthActiveShifts?: Record<string, string[]>;
  monthActiveRules?: Record<string, string[]>;
}

export interface MonthScheduleDoc extends MonthScheduleData {
  month: string; // 'YYYY-MM'
  schemaVersion?: number;
  updatedAt?: unknown;
}

export type CloudPullStatus = 'ok' | 'offline' | 'unauthorized' | 'error'

export interface CloudPullData {
  status: CloudPullStatus;
  /** Every month merged into one dataset, or null when the cloud has no month docs */
  monthData: MonthScheduleData | null;
  persons: Person[] | null;
  addresses: Address[] | null;
  shifts: ShiftDefinition[] | null;
  rules: ShiftRule[] | null;
}

const isMonthId = (value: string | undefined): value is string =>
  Boolean(value) && MONTH_ID_PATTERN.test(value!)

const isDateInMonth = (dateStr: string | undefined, month: string): boolean =>
  Boolean(dateStr) && dateStr!.startsWith(`${month}-`)

const pickDateKeys = <V>(record: Record<string, V> | undefined, month: string) =>
  Object.fromEntries(Object.entries(record ?? {}).filter(([date]) => isDateInMonth(date, month)))

const omitDateKeys = <V>(record: Record<string, V> | undefined, month: string) =>
  Object.fromEntries(Object.entries(record ?? {}).filter(([date]) => !isDateInMonth(date, month)))

const pickMonthKey = <V>(record: Record<string, V> | undefined, month: string) =>
  record && month in record ? { [month]: record[month] } : {}

const omitMonthKey = <V>(record: Record<string, V> | undefined, month: string) =>
  Object.fromEntries(Object.entries(record ?? {}).filter(([key]) => key !== month))

/**
 * Lists every 'YYYY-MM' month referenced by a schedule dataset.
 */
export function getMonthsInScheduleData(data: MonthScheduleData): string[] {
  const months = new Set<string>()
  const addMonth = (month: string | undefined) => {
    if (isMonthId(month)) months.add(month)
  }

  Object.keys(data.monthParticipants ?? {}).forEach(addMonth)
  Object.keys(data.monthDailyShifts ?? {}).forEach(addMonth)
  Object.keys(data.monthActiveShifts ?? {}).forEach(addMonth)
  Object.keys(data.monthActiveRules ?? {}).forEach(addMonth)
  Object.keys(data.assignments ?? {}).forEach((date) => addMonth(date.slice(0, 7)))
  Object.keys(data.dayShiftAssignments ?? {}).forEach((date) => addMonth(date.slice(0, 7)))
  data.availabilities?.forEach((a) => addMonth(a.month))
  data.events?.forEach((e) => addMonth(e.date?.slice(0, 7)))
  data.expenses?.forEach((exp) => addMonth(exp.date?.slice(0, 7)))

  return Array.from(months).sort()
}

/**
 * Extracts only one month's data from a full schedule dataset.
 */
export function sliceMonthScheduleData(
  data: MonthScheduleData,
  month: string,
): Required<MonthScheduleData> {
  return {
    assignments: pickDateKeys(data.assignments, month),
    dayShiftAssignments: pickDateKeys(data.dayShiftAssignments, month),
    monthParticipants: pickMonthKey(data.monthParticipants, month),
    monthDailyShifts: pickMonthKey(data.monthDailyShifts, month),
    monthActiveShifts: pickMonthKey(data.monthActiveShifts, month),
    monthActiveRules: pickMonthKey(data.monthActiveRules, month),
    availabilities: (data.availabilities ?? []).filter((a) => a.month === month),
    events: (data.events ?? []).filter((e) => isDateInMonth(e.date, month)),
    expenses: (data.expenses ?? []).filter((exp) => isDateInMonth(exp.date, month)),
  }
}

/**
 * Replaces everything a dataset holds for `month` with the given month slice.
 */
export function replaceMonthScheduleData(
  base: MonthScheduleData,
  month: string,
  slice: MonthScheduleData,
): Required<MonthScheduleData> {
  const monthSlice = sliceMonthScheduleData(slice, month)
  return {
    assignments: { ...omitDateKeys(base.assignments, month), ...monthSlice.assignments },
    dayShiftAssignments: {
      ...omitDateKeys(base.dayShiftAssignments, month),
      ...monthSlice.dayShiftAssignments,
    },
    monthParticipants: {
      ...omitMonthKey(base.monthParticipants, month),
      ...monthSlice.monthParticipants,
    },
    monthDailyShifts: {
      ...omitMonthKey(base.monthDailyShifts, month),
      ...monthSlice.monthDailyShifts,
    },
    monthActiveShifts: {
      ...omitMonthKey(base.monthActiveShifts, month),
      ...monthSlice.monthActiveShifts,
    },
    monthActiveRules: {
      ...omitMonthKey(base.monthActiveRules, month),
      ...monthSlice.monthActiveRules,
    },
    availabilities: [
      ...(base.availabilities ?? []).filter((a) => a.month !== month),
      ...monthSlice.availabilities,
    ],
    events: [
      ...(base.events ?? []).filter((e) => !isDateInMonth(e.date, month)),
      ...monthSlice.events,
    ],
    expenses: [
      ...(base.expenses ?? []).filter((exp) => !isDateInMonth(exp.date, month)),
      ...monthSlice.expenses,
    ],
  }
}

const getUpdatedAtMillis = (value: unknown): number => {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis()
  }
  return 0
}

/**
 * Merges month docs into a single dataset. The newest legacy (v1) doc is used as the base,
 * since it holds a full copy of the dataset, and every v2 month slice replaces its month.
 */
export function mergeMonthDocs(monthDocs: MonthScheduleDoc[]): MonthScheduleData | null {
  if (monthDocs.length === 0) return null

  const legacyDocs = monthDocs.filter((d) => d.schemaVersion !== MONTH_DOC_SCHEMA_VERSION)
  const sliceDocs = monthDocs.filter((d) => d.schemaVersion === MONTH_DOC_SCHEMA_VERSION)

  const newestLegacy = [...legacyDocs].sort(
    (a, b) => getUpdatedAtMillis(b.updatedAt) - getUpdatedAtMillis(a.updatedAt),
  )[0]

  let merged: MonthScheduleData = {
    assignments: { ...newestLegacy?.assignments },
    monthParticipants: { ...newestLegacy?.monthParticipants },
    availabilities: [...(newestLegacy?.availabilities ?? [])],
    events: [...(newestLegacy?.events ?? [])],
    expenses: [...(newestLegacy?.expenses ?? [])],
    dayShiftAssignments: { ...newestLegacy?.dayShiftAssignments },
    monthDailyShifts: { ...newestLegacy?.monthDailyShifts },
    monthActiveShifts: { ...newestLegacy?.monthActiveShifts },
    monthActiveRules: { ...newestLegacy?.monthActiveRules },
  }

  sliceDocs.forEach((slice) => {
    merged = replaceMonthScheduleData(merged, slice.month, slice)
  })

  return merged
}

const toMonthScheduleDoc = (month: string, data: DocumentData): MonthScheduleDoc => ({
  month,
  schemaVersion: data.schemaVersion,
  assignments: data.assignments,
  monthParticipants: data.monthParticipants,
  availabilities: data.availabilities,
  events: data.events,
  expenses: data.expenses,
  dayShiftAssignments: data.dayShiftAssignments,
  monthDailyShifts: data.monthDailyShifts,
  monthActiveShifts: data.monthActiveShifts,
  monthActiveRules: data.monthActiveRules,
  updatedAt: data.updatedAt,
})

const isOfflineError = (err: unknown): boolean =>
  (err as { code?: string })?.code === 'unavailable'

export class CloudSyncService {
  private static adminStatusCache: { uid: string; isAdmin: boolean } | null = null

  private static getSyncStorageKey(): string {
    const uid = StorageService.getActiveUserId()
    return uid ? `${CLOUD_SYNC_STORAGE_KEY}_${uid}` : CLOUD_SYNC_STORAGE_KEY
  }

  /**
   * Retrieves whether cloud synchronization is enabled for the active account on this device.
   * Defaults to false (offline/local-only).
   */
  static isSyncEnabled(): boolean {
    try {
      if (typeof localStorage === 'undefined') return false
      const key = this.getSyncStorageKey()
      const stored = localStorage.getItem(key)
      if (stored !== null) return stored === 'true'

      // Migrates the old device-wide toggle to the first account that reads it
      const legacy = localStorage.getItem(CLOUD_SYNC_STORAGE_KEY)
      if (legacy !== null && key !== CLOUD_SYNC_STORAGE_KEY) {
        localStorage.setItem(key, legacy)
        localStorage.removeItem(CLOUD_SYNC_STORAGE_KEY)
      }
      return legacy === 'true'
    } catch {
      return false
    }
  }

  /**
   * Updates the sync toggle state of the active account and saves it in localStorage.
   */
  static setSyncEnabled(enabled: boolean): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.getSyncStorageKey(), enabled ? 'true' : 'false')
      }
    } catch (err) {
      console.error('Failed to update sync enabled state:', err)
    }
  }

  /**
   * Whether the browser reports a network connection.
   */
  static isOnline(): boolean {
    return typeof navigator === 'undefined' || navigator.onLine !== false
  }

  /**
   * Remembers the role already loaded by the auth flow, avoiding a Firestore read per save.
   */
  static setCachedAdminStatus(uid: string, isAdmin: boolean): void {
    this.adminStatusCache = { uid, isAdmin }
  }

  static clearCachedAdminStatus(): void {
    this.adminStatusCache = null
  }

  /**
   * Checks dynamically in Firestore if the current authenticated user has the 'admin' role.
   * No emails are hardcoded.
   */
  static async isCurrentUserAdmin(): Promise<boolean> {
    const uid = auth.currentUser?.uid
    if (!uid) return false
    if (this.adminStatusCache?.uid === uid) return this.adminStatusCache.isAdmin
    try {
      const userDoc = await getDoc(doc(db, 'users', uid))
      const isAdmin = userDoc.exists() && userDoc.data()?.role === 'admin'
      this.setCachedAdminStatus(uid, isAdmin)
      return isAdmin
    } catch {
      return false
    }
  }

  private static async isAllowed(isAdmin?: boolean, ignoreSyncEnabled = false): Promise<boolean> {
    const authorized = isAdmin !== undefined ? isAdmin : await this.isCurrentUserAdmin()
    return authorized && (ignoreSyncEnabled || this.isSyncEnabled())
  }

  /**
   * Firestore only resolves a write once the server acknowledges it. While offline the write
   * stays queued in the persistent cache, so it is not awaited (it is sent on reconnect).
   */
  private static async commitWrite(write: Promise<void>, label: string): Promise<boolean> {
    if (!this.isOnline()) {
      write.catch((err) => console.error(`Queued Firestore write failed (${label}):`, err))
      return true
    }
    try {
      await write
      return true
    } catch (err) {
      console.error(`Failed to save ${label} to Firestore:`, err)
      return false
    }
  }

  /**
   * Reads every schedule doc straight from the server, never from the offline cache, so a pull
   * can't silently replace local data with a stale cached copy.
   */
  private static async fetchScheduleDocsFromServer(): Promise<QueryDocumentSnapshot[]> {
    const snapshot = await getDocsFromServer(collection(db, SCHEDULES_COLLECTION))
    return snapshot.docs
  }

  /**
   * Lists the month docs currently stored in the cloud (empty when offline or on failure).
   */
  static async listCloudMonths(): Promise<string[]> {
    if (!this.isOnline()) return []
    try {
      const docs = await this.fetchScheduleDocsFromServer()
      return docs.map((d) => d.id).filter(isMonthId)
    } catch (err) {
      console.error('Failed to list cloud months:', err)
      return []
    }
  }

  /**
   * Subscribes to real-time Firestore updates for a specific month schedule doc.
   * Returns an unsubscribe function or null if offline / disabled.
   */
  static subscribeMonthSchedule(
    month: string,
    onUpdate: (doc: MonthScheduleDoc) => void,
    onError?: (error: unknown) => void,
  ): (() => void) | null {
    if (!this.isOnline() || !this.isSyncEnabled()) return null
    try {
      return onSnapshot(
        doc(db, SCHEDULES_COLLECTION, month),
        (snapshot) => {
          if (!snapshot.exists()) return
          onUpdate(toMonthScheduleDoc(month, snapshot.data()))
        },
        (err) => {
          console.error(`Error in onSnapshot listener for ${month}:`, err)
          onError?.(err)
        },
      )
    } catch (err) {
      console.error('Failed to attach onSnapshot listener:', err)
      return null
    }
  }

  /**
   * Pulls the whole schedule (every month doc plus master lists) from the server on demand.
   * By default, ignores the local sync toggle for on-demand pull requests.
   */
  static async pullAllFromCloud(
    isAdmin?: boolean,
    ignoreSyncEnabled = true,
  ): Promise<CloudPullData> {
    const empty: Omit<CloudPullData, 'status'> = {
      monthData: null,
      persons: null,
      addresses: null,
      shifts: null,
      rules: null,
    }

    if (!(await this.isAllowed(isAdmin, ignoreSyncEnabled))) {
      return { status: 'unauthorized', ...empty }
    }
    if (!this.isOnline()) {
      return { status: 'offline', ...empty }
    }

    try {
      const docs = await this.fetchScheduleDocsFromServer()
      const byId = new Map(docs.map((d) => [d.id, d.data()]))
      const monthDocs = docs
        .filter((d) => isMonthId(d.id))
        .map((d) => toMonthScheduleDoc(d.id, d.data()))

      return {
        status: 'ok',
        monthData: mergeMonthDocs(monthDocs),
        persons: (byId.get('_master_people')?.persons as Person[]) ?? null,
        addresses: (byId.get('_master_addresses')?.addresses as Address[]) ?? null,
        shifts: (byId.get('_master_shifts')?.shifts as ShiftDefinition[]) ?? null,
        rules: (byId.get('_master_rules')?.rules as ShiftRule[]) ?? null,
      }
    } catch (err) {
      console.error('Failed to pull schedules from Firestore:', err)
      return { status: isOfflineError(err) ? 'offline' : 'error', ...empty }
    }
  }

  /**
   * Replaces the cloud doc of one month with that month's slice of `data` (the full local dataset).
   * If ignoreSyncEnabled is true, bypasses the sync toggle check.
   */
  static async saveMonthToCloud(
    month: string,
    data: MonthScheduleData,
    isAdmin?: boolean,
    ignoreSyncEnabled = false,
  ): Promise<boolean> {
    if (!(await this.isAllowed(isAdmin, ignoreSyncEnabled))) return false

    const slice = JSON.parse(JSON.stringify(sliceMonthScheduleData(data, month)))
    return this.commitWrite(
      setDoc(doc(db, SCHEDULES_COLLECTION, month), {
        ...slice,
        month,
        schemaVersion: MONTH_DOC_SCHEMA_VERSION,
        updatedAt: serverTimestamp(),
      }),
      `schedule ${month}`,
    )
  }

  /**
   * Replaces the cloud docs of several months with their slices of `data`.
   */
  static async saveMonthsToCloud(
    months: string[],
    data: MonthScheduleData,
    isAdmin?: boolean,
    ignoreSyncEnabled = false,
  ): Promise<boolean> {
    const results = await Promise.all(
      Array.from(new Set(months))
        .filter(isMonthId)
        .map((m) => this.saveMonthToCloud(m, data, isAdmin, ignoreSyncEnabled)),
    )
    return results.every(Boolean)
  }

  private static async saveMasterListToCloud(
    docId: string,
    field: string,
    items: unknown[],
    isAdmin?: boolean,
    ignoreSyncEnabled = false,
  ): Promise<boolean> {
    if (!(await this.isAllowed(isAdmin, ignoreSyncEnabled))) return false

    return this.commitWrite(
      setDoc(doc(db, SCHEDULES_COLLECTION, docId), {
        [field]: JSON.parse(JSON.stringify(items)),
        updatedAt: serverTimestamp(),
      }),
      field,
    )
  }

  /**
   * Syncs master personnel to Firestore when saving if sync is active.
   */
  static async savePeopleToCloud(
    persons: Person[],
    isAdmin?: boolean,
    ignoreSyncEnabled = false,
  ): Promise<boolean> {
    return this.saveMasterListToCloud('_master_people', 'persons', persons, isAdmin, ignoreSyncEnabled)
  }

  /**
   * Syncs master registered addresses to Firestore when saving if sync is active.
   */
  static async saveAddressesToCloud(
    addresses: Address[],
    isAdmin?: boolean,
    ignoreSyncEnabled = false,
  ): Promise<boolean> {
    return this.saveMasterListToCloud(
      '_master_addresses',
      'addresses',
      addresses,
      isAdmin,
      ignoreSyncEnabled,
    )
  }

  /**
   * Syncs master shift definitions to Firestore when saving if sync is active.
   */
  static async saveShiftsToCloud(
    shifts: ShiftDefinition[],
    isAdmin?: boolean,
    ignoreSyncEnabled = false,
  ): Promise<boolean> {
    return this.saveMasterListToCloud('_master_shifts', 'shifts', shifts, isAdmin, ignoreSyncEnabled)
  }

  /**
   * Syncs master shift rules to Firestore when saving if sync is active.
   */
  static async saveRulesToCloud(
    rules: ShiftRule[],
    isAdmin?: boolean,
    ignoreSyncEnabled = false,
  ): Promise<boolean> {
    return this.saveMasterListToCloud('_master_rules', 'rules', rules, isAdmin, ignoreSyncEnabled)
  }

  /**
   * Makes the cloud an exact copy of the local data: every local month plus every month already
   * in the cloud is rewritten (months that no longer exist locally become empty), along with the
   * master lists. Does not require or alter the local sync toggle.
   */
  static async pushAllToCloud(
    data: {
      monthData: MonthScheduleData;
      persons: Person[];
      addresses: Address[];
      shifts?: ShiftDefinition[];
      rules?: ShiftRule[];
    },
    isAdmin?: boolean,
    ignoreSyncEnabled = true,
    extraMonths: string[] = [],
  ): Promise<boolean> {
    if (!(await this.isAllowed(isAdmin, ignoreSyncEnabled))) return false

    const cloudMonths = await this.listCloudMonths()
    const monthsToSave = [
      ...extraMonths,
      ...getMonthsInScheduleData(data.monthData),
      ...cloudMonths,
    ]

    const promises: Promise<boolean>[] = [
      this.saveMonthsToCloud(monthsToSave, data.monthData, isAdmin, ignoreSyncEnabled),
      this.savePeopleToCloud(data.persons, isAdmin, ignoreSyncEnabled),
      this.saveAddressesToCloud(data.addresses, isAdmin, ignoreSyncEnabled),
    ]

    if (data.shifts) {
      promises.push(this.saveShiftsToCloud(data.shifts, isAdmin, ignoreSyncEnabled))
    }
    if (data.rules) {
      promises.push(this.saveRulesToCloud(data.rules, isAdmin, ignoreSyncEnabled))
    }

    const results = await Promise.all(promises)
    return results.every(Boolean)
  }
}
