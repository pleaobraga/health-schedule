# HealthSchedule (`health-scale`) — Comprehensive AI Project Context

> **Purpose of this document**: Provide an AI coding assistant or engineer with complete architectural, domain, data-model, state-management, persistence, and coding-standard context for the **HealthSchedule** (`health-scale`) codebase.

---

## 1. Project Overview & Domain

**HealthSchedule** is an offline-first, bilingual (`pt-BR` / `en-US`) **Monthly Shift & On-Call Schedule Manager** built for healthcare teams, clinics, home-care caregivers, and emergency departments.

### Core Capabilities
1. **Interactive Monthly Schedule Calendar**:
   - View Mode (read-only) and Edit Mode (draft editing with unsaved-changes guard, commit on Save, or revert on Discard).
   - Multi-shift daily allocation (`dayShiftAssignments` mapping each date + shift to a person, plus `assignments` array per date).
   - Visual highlights on the calendar for a selected person's **reported availability** (amber highlight + `Disp.` / `Avail.` badge) or **scheduled working days** (emerald highlight + `Escalado` / `Scheduled` badge).
   - Special events per day (`CalendarEvent`) with time, description, linked registered `Address`, and responsible staff member.
   - Fullscreen & print-optimized panoramic view (`FullScreenCalendarModal`).
2. **Customizable Shifts & Daily Shift Configuration**:
   - Global shift registry (`ShiftDefinition`: code, name, start time, duration in hours, color, `enabledByDefault`).
   - Per-month daily shift configuration (`monthDailyShifts`: defines which shifts occur on which days `1..31` of a given month `YYYY-MM`).
3. **Staff Registry & Monthly Participation**:
   - Global staff registry (`persons`: `id`, `name`, `color`, `active`).
   - Referential integrity protection (`PersonService.canDeletePerson`): staff with historical schedule assignments cannot be permanently deleted and are soft-deactivated (`active: false`) instead.
   - Per-month linked participants (`monthParticipants`: `YYYY-MM -> personId[]`).
   - Per-month & per-shift availability (`MonthlyAvailability`: `availableDays`, `shiftAvailability`, and per-day `shiftRates`).
   - Removing a previously saved availability day in `MonthAvailabilityModal` displays a fixed warning banner and automatically unlinks the person from that day/shift on the calendar.
4. **Dynamic Rule Engine & Compliance Auditing**:
   - Configurable labor and scheduling rules (`ShiftRule`):
     - `MAX_SHIFTS_PER_PERIOD` (`DAY` | `WEEK` | `MONTH`)
     - `MAX_HOURS_PER_PERIOD` (`DAY` | `WEEK` | `MONTH`)
     - `MIN_REST_HOURS` (minimum rest window between shifts)
     - `CONSECUTIVE_DAYS_LIMIT` (maximum consecutive working days)
     - `MAX_PEOPLE_PER_SHIFT`
     - `DAILY_SHIFT_HOURS` (`EXACT` | `MAX` | `MIN` hours per day on `ALL` | `WEEKDAYS` | `WEEKENDS` | `SPECIFIC_DAYS`)
   - Real-time validation errors (`ERROR` / `WARNING`) displayed per day cell and in `ScheduleAuditModal`.
5. **Financial Calculation, Shift Rates & Purchases (`/compras`)**:
   - Per-person, per-shift, per-day rates (`shiftRates[shiftId][dayNumber] = rateInBRL`).
   - Monthly financial closing modal (`MonthPaymentsModal`) and dedicated financial sheet in Excel exports.
   - Daily expenses and multi-item purchases (`DailyExpense`) registered in `/compras` (`PurchasesView`) or in the expenses tab of `DayEventsModal`: an expense with a `personId` (and snapshot `personName`) is a reimbursement for that professional, and one without is a general operational expense. Each purchase can include itemized lines (`items: ExpenseLine[]`, storing a historical `itemName` snapshot alongside `itemId`, `quantity`, and optional line `amount`) entered manually or imported from a `.xls` / `.xlsx` spreadsheet (`parseExpenseItemsFile`, `mergeImportedLines`), backed by a global item catalog (`expenseItems: ExpenseItem[]`) with repurchase interval history (`ItemHistory`) and catalog maintenance (`ItemMaintenance`: rename and merge). `calculateMonthExpensesSummary` aggregates `expense.amount` for `MonthPaymentsModal`. Expenses are not part of the Excel export.
6. **Offline-First Storage, Multi-Profile Guest Mode & Firebase Cloud Sync**:
   - 100% functional offline via `StorageService` (`localStorage`) with dataset isolation per authenticated user (`scale_manager_user_data_v1_<uid>`) and per guest profile (`scale_manager_guest_data_v1_<guestId>`).
   - Dynamic demo seed loader (`guestSeedLoader.ts`) for new guest sessions.
   - Optional real-time / on-demand **Firebase Firestore** synchronization (`CloudSyncService`) for `admin` users, supporting automatic sync on store mutations, manual Force Push, and Cloud Pull across browsers (including unscheduled future months).
7. **Data Portability & Export**:
   - Multi-sheet Excel export (`.xlsx` via SheetJS) and Print / Save as PDF with localized filenames:
     - Portuguese: `escala-<month 1..12>-<year>.xlsx` (e.g., `escala-10-2026.xlsx`)
     - English: `schedule-<month 1..12>-<year>.xlsx` (e.g., `schedule-10-2026.xlsx`)
   - Full JSON Backup export, overwrite restore, and non-destructive merge restore (`BackupService`).
8. **Versioned Medication Schedule (`/medicamentos`)**:
   - Matrix schedule view with medications in columns and time slots (HH:mm) in rows, supporting free-text doses (e.g. "1 comprimido", "1.5 comprimidos", "2 gotas") without numeric coercion.
   - Prescription versions with a required `effectiveDate` and `explanation`, and an optional `professional`.
   - Each version can hold any number of additional information entries (`notes`), with a required text and optional date and professional. They hold history from before the first version, may be dated before it, and are not copied into new versions.
   - Each medication can record the responsible doctor (`responsible`) and their specialty (`specialty`). The table shows the dosage beside the name and only the specialty as a tag; the doctor's name and the source stay out of it.
   - Automatic version comparison and change summaries (`MedicationVersionChange`) in version history (`getMedicationVersionHistory`), listed newest to oldest.
   - Version select in the table card, newest first, with instant return to current version (`getCurrentMedicationVersion`).
   - Specialty filter in the table card (`getMedicationSpecialties`, `matchesMedicationSpecialty`) that highlights the matching columns on screen. It keeps the other columns visible, changes no data, and does not affect the print sheet.
   - Grouping of medications by pharmacy/origin source (`groupMedicationsBySource`).
   - Professional autocomplete suggestions (`searchMedicationProfessionals`) based on past recorded versions.
   - Version creation, correction, and latest-version deletion (with confirmation).
   - The print sheet is portaled to `document.body`, because the app shell's scroll containers would clip it to one page. Page 1 holds the schedule, and page 2 holds the medications by source, then the changes.
   - High-contrast print/PDF export (`#medication-print-sheet`) via `window.print()` with localized filename title swap (`getMedicationFileBaseName`: `medicamentos-DD-MM-YYYY` / `medications-MM-DD-YYYY`) and page break before prescription history.

---

## 2. Tech Stack

| Category | Technology |
| :--- | :--- |
| **Runtime & Package Manager** | Node.js `>= 24.22.0`, `pnpm >= 12.14.0` |
| **Framework & Language** | React 19, TypeScript 5.9 (strict mode), Vite 8 |
| **Styling & Icons** | Tailwind CSS 4 (`dark` class strategy), `lucide-react`, shadcn/ui date picker (`radix-ui`, `react-day-picker`) |
| **State Management** | Zustand 5 (`useScheduleStore`) |
| **Routing** | React Router DOM 7 (`HashRouter` + `<Routes>` for GitHub Pages compatibility) |
| **Backend / Cloud** | Firebase 13 (Firebase Auth + Cloud Firestore) |
| **Internationalization** | `i18next`, `react-i18next` (`pt-BR` default, `en-US` secondary) |
| **Date & Spreadsheet** | `date-fns` 4, `xlsx` (SheetJS) |
| **Testing & Quality** | Vitest 5, React Testing Library, JSDOM, ESLint 10 (Flat Config), Storybook 10 |

---

## 3. Directory Structure

```text
src/
├── components/
│   ├── auth/                  # Route guards (PrivateRoute, AdminRoute)
│   ├── calendar/              # CalendarView, CalendarGrid, CalendarHeader, DayCell, CandidatePicker
│   ├── common/                # ConfirmDialog, ErrorBoundary, LanguageSelector, SortableList, ToastViewport
│   ├── import/                # ImportView, ConfirmOverwriteModal (backup restore/merge & cloud pull)
│   ├── layout/                # RootLayout (navigation, route outlet, global modals, toasts, onboarding redirect)
│   ├── modals/                # FullScreenCalendarModal, MonthShiftConfigModal, MonthPaymentsModal,
│   │                          # DayEventsModal, AddDayShiftModal, DayViolationsModal, ScheduleAuditModal,
│   │                          # UnsavedChangesModal
│   ├── medications/           # MedicationVersionForm
│   ├── navigation/            # HoverSidebar (left rail) and MobileBottomNav (tab bar below 768px)
│   ├── people-management/     # PeopleManagementView, GlobalPersonModal, DeactivatePersonModal, ConfirmDeleteModal
│   ├── purchases/             # PurchaseForm, ItemHistory, ItemMaintenance
│   ├── settings/              # SettingsView, ShiftsManagementView, RulesManagementView,
│   │                          # ConfirmClearLocalDataModal, EnableCloudSyncModal
│   ├── sidebar/               # Sidebar (Month panel: Daily Shifts, Month People, Validation Rules),
│   │                          # PersonCard, MonthAvailabilityModal, AddMonthParticipantsModal, AddMonthRulesModal
│   └── users/                 # CreateUserModal
├── context/
│   ├── auth-context-base.ts   # AuthContext definition & types
│   └── auth-context.tsx       # AuthProvider (Firebase Auth, Firestore role lookup, Guest mode, dataset switching)
├── hooks/
│   ├── use-cloud-sync.ts      # Empty placeholder: sync calls live in store actions
│   └── use-list-order.ts      # Drag-and-drop list order, stored per device and never synced
├── i18n.ts                    # i18next initialization & language persistence ('health-schedule:language')
├── locales/
│   ├── pt-BR/                 # JSON namespaces: common, auth, calendar, people, settings, import, addresses, users, purchases, medications
│   └── en-US/                 # JSON namespaces: common, auth, calendar, people, settings, import, addresses, users, purchases, medications
├── pages/
│   ├── address-management-view.tsx # Global Address CRUD
│   ├── login-page.tsx              # Firebase Login + Guest Profile Login
│   ├── medications-view.tsx        # Medication Schedule matrix, version history, date lookup, source groups & PDF export
│   ├── purchases-view.tsx          # Monthly purchases, item filters, repurchase history & catalog maintenance
│   └── user-management-view.tsx    # Admin user role management (Firestore 'users' collection)
├── router/
│   ├── index.tsx              # AppRoutes, AppRouter (HashRouter), TestAppRouter (MemoryRouter)
│   ├── route-config.ts        # Route metadata only
│   └── routes.tsx             # Re-exports
├── services/
│   ├── seed/                  # guestSeedLoader.ts (demo data generator)
│   ├── validation/            # rule-engine.ts (DEFAULT_SHIFTS, DEFAULT_RULES, rule evaluation logic)
│   ├── backup-service.ts      # JSON export, validation, overwrite restore, and merge restore
│   ├── cloud-sync-service.ts  # Firestore read/write service (schedules, people, addresses, shifts, rules)
│   ├── firebase.ts            # Firebase app, auth, and Firestore initialization
│   ├── person-service.ts      # Referential integrity checks for staff deletion
│   └── storage-service.ts     # LocalStorage wrapper + Guest/User dataset snapshot isolation
├── store/
│   ├── use-schedule-store.ts  # Single source of truth Zustand store
│   └── use-toast-store.ts     # Toast notifications
├── types/
│   ├── index.ts               # Core domain types (Person, MonthlyAvailability, CalendarEvent, DailyExpense, Address, etc.)
│   └── scheduleConfig.ts      # ShiftDefinition, ShiftRule, RuleViolation, MonthScheduleDocument
└── utils/
    ├── address-utils.ts       # Address formatting helpers
    ├── auth-errors.ts         # Firebase Auth error codes to localized messages
    ├── clipboard-utils.ts     # Clipboard copy with execCommand fallback
    ├── cloud-feedback.ts      # Toasts for cloud push and pull results
    ├── date-utils.ts          # Month navigation, calendar 42-day grid generation, past-event checks
    ├── expense-item-import.ts # Spreadsheet (.xls / .xlsx) parser & line merge helpers for purchase items
    ├── expense-item-utils.ts  # Item normalization, fuzzy search, repurchase history, filters, line resolution & merge helpers
    ├── export-to-excel.ts     # Multi-sheet XLSX workbook generator & localized filename builder
    ├── list-order.ts          # Sorting and reordering by a saved id order
    ├── medication-schedule-utils.ts # Medication ID generation, version sorting, lookup, validation, diffs, source grouping, search & PDF filename
    ├── month-registry.ts      # Month snapshot capture and per-month registry lookup
    ├── popover-position.ts    # Viewport-clamped fixed popover positioning utility (for React portals)
    ├── shift-rate-utils.ts    # Shift rate lookup, monthly payment calculations & expense summaries
    └── validate-schedule.ts   # Bridge between store state and rule-engine validation
```

---

## 4. Core Data Models & Store State (`useScheduleStore`)

All application state lives in `src/store/use-schedule-store.ts`:

### Primary Entities
- `persons: Person[]`
  - `{ id: string, name: string, color: string, active?: boolean }`
- `monthParticipants: Record<string, string[]>`
  - Maps `'YYYY-MM'` -> `personId[]` (staff linked to that specific month).
- `availabilities: MonthlyAvailability[]`
  - `{ personId: string, month: 'YYYY-MM', availableDays: number[], shiftAvailability?: Record<shiftId, number[]>, shiftRates?: Record<shiftId, Record<dayNum, number>> }`
- `assignments: Record<string, string[]>` & `savedAssignments: Record<string, string[]>`
  - Maps `'YYYY-MM-DD'` -> `personId[]` assigned on that date.
- `dayShiftAssignments: Record<string, Record<string, string>>` & `savedDayShiftAssignments`
  - Maps `'YYYY-MM-DD'` -> `{ [shiftId]: personId }`. Everyone in a day's shift map is also in `assignments[date]`, which can additionally hold people with no shift.
- `shiftDefinitions: ShiftDefinition[]`
  - `{ id, name, code, startTime: 'HH:mm', durationHours: number, color, enabledByDefault, createdAt, updatedAt }`
- `shiftRules: ShiftRule[]`
  - `{ id, name, description, type: RuleType, enabledByDefault, severity: 'ERROR' | 'WARNING', parameters: {...}, createdAt, updatedAt }`
- `monthDailyShifts: Record<string, Record<string, number[]>>`
  - Maps `'YYYY-MM'` -> `{ [shiftId]: dayNumbers[] }`. Defines which shifts are active on each day of a month.
  - **Important**: `getDayActiveShifts(dateStr)` returns `[]` if no daily shift is configured for that month in `monthDailyShifts[month]`.
- `monthActiveShifts: Record<string, string[]>` & `monthActiveRules: Record<string, string[]>`
  - Per-month active shift IDs and rule IDs.
- `events: CalendarEvent[]`
  - `{ id, date: 'YYYY-MM-DD', title, time?: 'HH:mm', description?, address?, addressId?, personId? }`
- `expenses: DailyExpense[]`
  - `{ id, date: 'YYYY-MM-DD', description, amount, personId?, personName?, category?: 'MEDICATION' | 'TRANSPORT' | 'SUPPLIES' | 'OTHER', items: ExpenseLine[], createdAt, updatedAt }`
  - Each `ExpenseLine` has `{ id?, itemId, itemName, quantity, amount? }`, preserving `itemName` as a snapshot on the purchase so past months (`month < getCurrentMonth()`) never change when the catalog changes.
  - Managed by `addExpense`, `updateExpense`, and `deleteExpense`. Like events, expenses persist immediately, independent of the edit-mode draft.
- `expenseItems: ExpenseItem[]`
  - `{ id, name, mergedIntoId?, normalizedName?, defaultCategory?, createdAt, updatedAt }`
  - Global catalog of purchased items, persisted in `localStorage` (`scale_manager_expense_items_v1`) and synced to `schedules/_master_expense_items`. Managed via `renameExpenseItem` (updates the catalog item and `ExpenseLine.itemName` in purchases from `getCurrentMonth()` onward, leaving past months untouched) and `mergeExpenseItems` (sets `mergedIntoId: targetId` on the source item without modifying any `DailyExpense`, combining their repurchase histories and filters).
- `addresses: Address[]`
  - `{ id, name, street, number, complement?, neighborhood?, city? }`
- `medicationVersions: MedicationScheduleVersion[]`
  - `{ id, effectiveDate, professional, explanation, medications: MedicationColumn[], times: string[], doses: Record<medicationId, Record<time, string>>, createdAt, updatedAt }`
  - Global prescription versions for the versioned medication schedule matrix, persisted in `localStorage` (`scale_manager_medication_versions_v1`) and synced to `schedules/_master_medication_versions`. Managed via `addMedicationVersion`, `updateMedicationVersion`, and `deleteLatestMedicationVersion`.
- `monthSnapshots: Record<string, MonthRegistrySnapshot>`
  - Maps `'YYYY-MM'` -> `{ capturedAt, persons, shiftDefinitions, shiftRules, activeShiftIds, activeRuleIds }` for past months.

### UI & Highlight State
- `currentMonth: string` (`'YYYY-MM'`, defaults to `getCurrentMonth()`)
- `isEditMode: boolean` & `hasUnsavedChanges: boolean`
- `highlightedPersonId: string | null` — Highlights a person's **available days** in yellow/amber on the calendar.
- `highlightedScheduledPersonId: string | null` — Highlights a person's **scheduled working days** in green/emerald on the calendar (mutually exclusive with `highlightedPersonId`).
- `dayEventsModalTab: 'events' | 'expenses'` — Active tab of `DayEventsModal`, set through `setSelectedDateForEvents(dateStr, initialTab)`.

---

## 5. Key Business Rules & Domain Invariants

1. **Availability Modification & Calendar Unlinking**:
   - When `setPersonAvailability(personId, month, availableDays, shiftAvailability, shiftRates)` is called, if the person was already assigned to any day or shift in `month` whose availability was removed, they are automatically removed from `assignments[dateStr]` and `dayShiftAssignments[dateStr]`.
   - In `MonthAvailabilityModal`, a fixed warning banner right below the modal header is displayed **only** if the user removes at least one previously saved availability day; if the user adds that day back before saving, the warning disappears.
2. **Address Update/Delete Cascade**:
   - Updating or deleting an `Address` cascades to **future** `CalendarEvent` records (`!isEventInPast(ev.date, ev.time)`), while **past** events preserve their historical address text untouched.
3. **Staff Deletion vs. Deactivation**:
   - `deletePerson(id)` checks `canDeletePerson(id)`. If the person has any assignments in `assignments`, deletion is blocked and the UI prompts to deactivate (`deactivatePerson(id)`) instead. The check looks only at `assignments`, so expenses do not block deletion. A deleted person's expenses are intentionally kept to preserve financial history. When an expense is saved with a `personId`, its `personName` snapshot is stored on the `DailyExpense`; if the person is later deleted, the UI displays `expense.personName` (falling back to `calendar:removedProfessional` only for legacy records without `personName`), and past months with a snapshot also keep the name. Amounts stay in the monthly totals. Deletion removes availabilities, participation, and assignments only from the current month on.
4. **Clear All Local Data**:
   - `clearAllLocalData()` in `useScheduleStore` and `StorageService.clearAllLocalData()` wipes **all** local data—including `persons`, `monthParticipants`, `availabilities`, `assignments`, `dayShiftAssignments`, `events`, `expenses`, `expenseItems`, `addresses`, `shiftDefinitions` (set to `[]`), `shiftRules` (set to `[]`), `monthActiveShifts`, `monthActiveRules`, and `monthDailyShifts`—as well as the active user/guest snapshot.
5. **Export & Print Filenames**:
   - `getScheduleFileBaseName(month, language)` in `src/utils/export-to-excel.ts` formats the filename as:
     - `escala-<1..12>-<YYYY>` when language is Portuguese (`pt*`)
     - `schedule-<1..12>-<YYYY>` when language is English (`en*`)
   - Used both for `.xlsx` downloads and for setting `document.title` during `window.print()`.

---

6. **Past Months Are Immutable to Registry Changes**:
   - A change to people, shifts, or rules never alters what a past month (any month before `getCurrentMonth()`) shows. Directly editing a past month stays allowed.
   - Before each such change, `freezePastMonths` creates a snapshot for every past month with data and no snapshot, and adds records that existing snapshots lack. Stored records are never overwritten.
   - `getRegistryForMonth(month)` returns the snapshot for a past month, plus live records the month references that the snapshot lacks, and the live registries otherwise. `getActiveShiftIds` and `getActiveRuleIds` read an explicit month list first, then the snapshot, then `enabledByDefault`.
   - Protection starts at the first registry change made after this mechanism shipped; earlier changes cannot be undone.

## 6. Cloud Synchronization Architecture (`CloudSyncService`)

Firestore documents are stored under the `schedules` collection:
- `schedules/_master_people` -> `{ persons: Person[], updatedAt }`
- `schedules/_master_addresses` -> `{ addresses: Address[], updatedAt }`
- `schedules/_master_shifts` -> `{ shifts: ShiftDefinition[], updatedAt }`
- `schedules/_master_rules` -> `{ rules: ShiftRule[], updatedAt }`
- `schedules/_master_expense_items` -> `{ items: ExpenseItem[], updatedAt }`
- `schedules/_master_medication_versions` -> `{ versions: MedicationScheduleVersion[], updatedAt }`
- `schedules/{YYYY-MM}` -> `{ month, schemaVersion, assignments, monthParticipants, availabilities, events, expenses, dayShiftAssignments, monthDailyShifts, monthActiveShifts, monthActiveRules, monthSnapshots, updatedAt }`

Each schema v2 month document holds only that month's data. Older v1 documents hold a full copy of the dataset, so `mergeMonthDocs` uses the newest v1 document as a base and replaces each month with its v2 slice.

`firestore.rules` allows any authenticated user to read and write `schedules`. The admin-only restriction on sync is enforced in the client by `CloudSyncService`.

### Sync Behavior
- **Toggle Control**: Controlled by `CloudSyncService.isSyncEnabled()` (`localStorage` key `scale_manager_cloud_sync_enabled`). Toggling it ON in `SettingsView` immediately triggers `forcePushCloudData`.
- **Automatic Sync on Edits**: When `CloudSyncService.isSyncEnabled()` is `true`, all store actions for people, addresses, shifts, rules, events, expenses, month participants, availabilities, and month daily shifts automatically sync to Firestore—even for future months that are not scheduled yet. Actions rewrite only the month they touched (`syncMonthScheduleIfEnabled`).
- **Draft Protection**: While in edit mode, `buildMonthCloudPayload` sends `savedAssignments` and `savedDayShiftAssignments`, so unsaved drafts never reach Firestore.
- **Multi-Month Push & Pull**:
  - `saveSchedule` and `forcePushCloudData` save `schedules/{month}` for every month referenced by the dataset (`getMonthsInScheduleData`), plus `currentMonth` and `getCurrentMonth()`.
  - `pullCloudData` fetches every schedule document through `pullAllFromCloud`, merges them with `mergeMonthDocs`, and replaces the whole local schedule, including any draft.

---

## 7. Routing Structure (`src/router/index.tsx`)

Uses `HashRouter` with `<Routes>` (`#/...`):
- `/login` — Public login & guest profile selection page.
- `/` — Protected by `PrivateRoute`, renders `CalendarView`. `RootLayout` redirects to `/configuracoes?tab=importar` on first onboarding when storage is empty.
  - `/calendario` — Alias of the main schedule view (`Sidebar` + `CalendarGrid`).
  - `/pessoas` — Global staff management (`PeopleManagementView`).
  - `/turnos` — Global shift definitions management (`ShiftsManagementView`).
  - `/regras` — Global validation rules management (`RulesManagementView`).
  - `/enderecos` — Global address registry (`AddressManagementView`).
  - `/compras` — Monthly purchases, itemized lines, repurchase history, and item catalog maintenance (`PurchasesView`).
  - `/medicamentos` — Medication schedule matrix, version history, date lookup, source groups, and PDF export (`MedicationsView`).
  - `/configuracoes` — General settings, language, theme, cloud sync, local storage summary & clear, and Import tab (`?tab=importar`).
  - `/importar`, `/configuracoes/importar` — Redirect to `/configuracoes?tab=importar`.
  - `/configuracoes/turnos`, `/configuracoes/regras` — Redirect to `/turnos` and `/regras`.
  - `/usuarios` — Protected by `AdminRoute` (`UserManagementView`).
  - Any other path redirects to `/calendario`.

---

## 8. Coding Standards & UI Guidelines

1. **Zero Hardcoded UI Strings (Strict i18n)**:
   - ESLint enforces `i18next/no-literal-string` on JSX text and attributes (`title`, `placeholder`, `aria-label`, `alt`).
   - Every visible string in `.tsx` components must use `t('namespace:key')` and exist in both `src/locales/pt-BR/*.json` and `src/locales/en-US/*.json`.
2. **TypeScript Strictness**:
   - No implicit or explicit `any`. Run `pnpm lint` and `pnpm build` (`tsc -b && vite build`) to verify zero type or lint errors.
3. **Portal-Based Popovers & Menus**:
   - Floating menus/popovers inside scrollable or `overflow-hidden` containers (such as `CandidatePicker`, `PersonCard` shift balloon, `CalendarGrid` options menu, and `LanguageSelector`) must render via `createPortal(..., document.body)` with `position: fixed` and coordinates calculated via `computePopoverPosition` (`src/utils/popover-position.ts`) so they are never clipped by page or container boundaries.
4. **Dark Mode Parity**:
   - Every component must include `dark:*` Tailwind classes for backgrounds, borders, and text contrast, plus `print:*` overrides where applicable.
5. **Form Field Rules**:
   - Required fields end their label with ` *`. Optional fields have no marker, and "(Opcional)" / "(Optional)" never appear in labels, placeholders, or hints.
   - Select options contain only the name, without explanations in parentheses.
   - A violated required field turns red through one shared style in `src/index.css`: `:user-invalid` for native `required`, and `aria-invalid` for app validation, set from the same condition as the error message. `DatePicker` takes `invalid`, and `Select` forwards `aria-invalid` to its visible trigger.
   - `src/components/required-fields.test.tsx` covers these rules.
   - Date fields always use `DatePicker` from `src/components/ui/date-picker.tsx`, the shadcn date picker (`Popover` + `Calendar`, built on `radix-ui` and `react-day-picker`). Never use a native `type="date"` or write another calendar; ESLint blocks native date inputs everywhere except that file.
   - Time fields use the native `<input type="time">` with the same classes as the day events field in `day-events-modal.tsx`.
   - shadcn components are copied by hand into `src/components/ui/`, following this project's conventions. Their tokens (`--popover`, `--primary`, and so on) live in `src/index.css`, mapped to the slate and emerald palette. There is no `components.json`, so the shadcn CLI is not used.
6. **Calendar Cell Parity**:
   - `FullScreenCalendarModal` renders its own day cells instead of reusing `DayCell`, so calendar cell changes must be applied to both.

---

## 9. Useful Commands

```bash
pnpm dev          # Start Vite dev server
pnpm test:run     # Run all Vitest unit & integration tests once
pnpm lint         # Run ESLint validation (including i18n literal checks)
pnpm typecheck    # Run tsc --noEmit
pnpm build        # Run tsc -b && vite build
pnpm validate     # Run typecheck + lint + test
```

