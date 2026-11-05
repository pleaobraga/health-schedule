# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

HealthSchedule is a client-only, offline-first React SPA for monthly healthcare shift schedules, in `pt-BR` (default) and `en-US`. See [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for the domain, data models, and rule types. Read it before changing store or sync behavior.

## Commands

```bash
pnpm dev                                       # Vite dev server on :5173
pnpm validate                                  # typecheck + lint + tests (stops at the first failure)
pnpm typecheck                                 # tsc --noEmit
pnpm lint                                      # pnpm lint:fix to autofix
pnpm test:run                                  # all tests once (pnpm test:watch for watch mode)
pnpm vitest run src/utils/date-utils.test.ts   # one test file
pnpm vitest run <file> -t 'test name'          # tests matching a name
pnpm build                                     # tsc -b && vite build
pnpm storybook                                 # Storybook on :6006
```

The app runs in guest mode without Firebase credentials. `pre-commit` runs lint-staged; `pre-push` and CI run typecheck, lint, and tests, and a push to `main` deploys to GitHub Pages.

## Architecture

**Data flow.** Components call actions on `useScheduleStore` ([src/store/use-schedule-store.ts](src/store/use-schedule-store.ts)). An action writes to `localStorage` through `StorageService`, updates Zustand state, and pushes to Firestore through `CloudSyncService` only if `isSyncEnabled()`. Local storage is the source of truth. The `useCloudSync` hook is an empty placeholder, so sync calls live in the store actions.

**Adding a persisted field.** There is no central schema. `DailyExpense` (commit `cb59d1a`) is the reference example. A new field must be wired through all of these:

- `src/types/index.ts` (`AppDataSnapshot`, `GuestDataset`) and `MonthScheduleDocument` in `src/types/scheduleConfig.ts`
- `StorageService`: key, getter and saver, `clearAllLocalData`, and the dataset snapshot (`getCurrentDataset` / `restoreDataset`)
- The store: initial state, `saveSchedule`, `buildMonthCloudPayload`, `pullCloudData`, `reloadFromStorage`, `clearAllLocalData`
- `backup-service.ts`: export, normalization, overwrite restore, and merge restore
- `cloud-sync-service.ts`: `getMonthsInScheduleData`, `sliceMonthScheduleData`, `replaceMonthScheduleData`, `mergeMonthDocs`, `toMonthScheduleDoc`

**Draft editing.** Only `assignments` and `dayShiftAssignments` have drafts. In edit mode they hold unsaved changes, and `savedAssignments` / `savedDayShiftAssignments` hold the committed copies. Cloud payloads must send the `saved*` copies while editing (see `buildMonthCloudPayload`). Everything else, including events and expenses, persists as soon as its action runs.

**Assignments live in two maps.** `assignments` is date to person IDs, and `dayShiftAssignments` is date to shift ID to person ID. Everyone in a day's shift map is also in `assignments`, which can additionally hold people with no shift (`addPersonToDay` on a day with no active shifts). Removing a person from one shift keeps them in `assignments` while they hold another shift that day. Use the existing store actions, which maintain this.

**Daily shifts.** `getDayActiveShifts` returns `[]` when a month has no `monthDailyShifts` configuration; it does not fall back to global shifts.

**Isolated datasets.** Each user and guest profile has a snapshot in `localStorage`. `auth-context.tsx` swaps them with `StorageService.restoreDataset` followed by `reloadFromStorage()`, so data missing from the snapshot is lost on account switch.

**Cloud documents.** `schedules/{YYYY-MM}` (schema v2) holds only that month. Older v1 docs hold a full dataset copy, so `mergeMonthDocs` uses the newest one as a base and applies v2 slices on top. Global data lives in `schedules/_master_{people,addresses,shifts,rules,expense_items}`. A pull fetches every doc and replaces the local schedule, including any draft. `firestore.rules` lets any authenticated user read and write `schedules`; the admin restriction is enforced only in the client.

**History rule.** A registry change (people, shifts, rules, expense items, addresses) must never change what a past month shows; a past month is any month before `getCurrentMonth()`. Directly editing a past month stays allowed. Before any change to people, shifts, or rules, the store's `freezePastMonths` saves them per past month in `monthSnapshots`. Screens showing a month must read `getRegistryForMonth(month)`, not `persons`, `shiftDefinitions`, or `shiftRules`, and any new registry-changing action must call `freezePastMonths` first. Registry screens and pick lists use the live data.

**Rendering.**

- `DayEventsModal`, `FullScreenCalendarModal`, and `UnsavedChangesModal` are mounted once in `RootLayout` and driven by store state.
- `FullScreenCalendarModal` renders its own cells and does not use `DayCell`. Calendar cell changes must be made in both places.
- `HoverSidebar` renders the desktop rail and `MobileBottomNav` (including `/compras` for `PurchasesView`).
- Routes are in [src/router/index.tsx](src/router/index.tsx) with `HashRouter`, which GitHub Pages requires. `route-config.ts` is metadata only.

**Testing.** Vitest uses jsdom and globals. `src/test/setup.ts` forces `pt-BR` and clears `localStorage` after each test. Use `TestAppRouter` for routed tests; it defaults to an authenticated admin. Both `.test` and `.spec` suffixes exist.

## Conventions

ESLint enforces these:

- No literal strings in JSX or in `title`, `aria-label`, `placeholder`, and `alt` (stories, tests, and `src/router` are exempt)
- No semicolons, no default exports (same exemptions, plus config files), `import type` for types, and alphabetized import groups

Not enforced by tooling:

- Add or change every i18n key in both `src/locales/pt-BR/` and `src/locales/en-US/`. Use `t('namespace:key')`, and set `ns` explicitly on `<Trans>`.
- File and folder names are kebab-case. `RuleEngine.ts`, `guestSeedLoader.ts`, and `scheduleConfig.ts` are legacy exceptions.
- Every UI component has a co-located `.stories.tsx`. Put components next to their consumer, and move them to `components/common` only when shared across features.
- React 19 style: no `React` import for JSX, no `forwardRef` or `React.FC`, `use(Context)` over `useContext`, and no `useMemo` / `useCallback` / `memo` without a measured bottleneck.
- Props use an `interface`, and event handlers use the `handle` prefix.
- Add `dark:*` variants to all new UI, and `print:*` overrides where the view prints.
- Form fields:
  - A required field ends its label with ` *`, and an optional field has no marker: never write "(Opcional)" or "(Optional)" in labels, placeholders, or hints.
  - Select options carry only the name, with no explanation in parentheses. Names like "Português (Brasil)" and units like "(R$)" in labels are fine.
  - A violated required field turns red. Native `required` gets this from `:user-invalid`. App validation sets `aria-invalid` on the input from the same condition as the error message, `invalid` on `DatePicker`, and `aria-invalid` on `Select`. The style lives once in `src/index.css`; don't add red border classes per field.
  - `src/components/required-fields.test.tsx` covers these rules; add new forms to it.
- Popovers inside scrollable or `overflow-hidden` containers use `createPortal` to `document.body` with `computePopoverPosition` ([src/utils/popover-position.ts](src/utils/popover-position.ts)).
- Keep Firestore usage within the free Spark plan: no audit logs or telemetry, and rewrite only the month an action touched (`syncMonthScheduleIfEnabled`).
- `.ai-rules.md` holds the full local rules but is gitignored, so it may be missing on a fresh clone.

Breakpoints (defined in [src/index.css](src/index.css)):

- `mobile:` is `width <= 40rem` (640px)
- `max-lg:` is the stacked calendar layout
- `md:` is where the bottom nav gives way to the desktop rail
- `hd` / `max-hd:` is 1510px, used by the two-row calendar toolbar

After changes to code, docs, or config, end the response with a suggested Conventional Commit message of about 50 characters, such as `fix(pdf): force light theme export`.
