import {
  CalendarDays,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Printer,
  X,
} from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { useScheduleStore } from '../../store/use-schedule-store'
import {
  formatDateWithWeekday,
  formatMonthYear,
  getMonthCalendarGrid,
} from '../../utils/date-utils'
import { getScheduleFileBaseName } from '../../utils/export-to-excel'
import { formatBRL } from '../../utils/shift-rate-utils'

import type { ShiftDefinition } from '../../types'

export function FullScreenCalendarModal() {
  const { t, i18n } = useTranslation(['calendar', 'common'])
  const {
    isFullScreenModalOpen,
    setFullScreenModalOpen,
    currentMonth,
    goToPreviousMonth,
    goToNextMonth,
    persons,
    assignments,
    dayShiftAssignments = {},
    shiftDefinitions = [],
    monthActiveShifts = {},
    events,
    expenses,
    getDayActiveShifts,
    setSelectedDateForEvents,
  } = useScheduleStore()

  const weekdays = [
    {
      short: t('calendar:weekdays.sun'),
      full: t('calendar:weekdays.sunday'),
      isWeekend: true,
    },
    {
      short: t('calendar:weekdays.mon'),
      full: t('calendar:weekdays.monday'),
      isWeekend: false,
    },
    {
      short: t('calendar:weekdays.tue'),
      full: t('calendar:weekdays.tuesday'),
      isWeekend: false,
    },
    {
      short: t('calendar:weekdays.wed'),
      full: t('calendar:weekdays.wednesday'),
      isWeekend: false,
    },
    {
      short: t('calendar:weekdays.thu'),
      full: t('calendar:weekdays.thursday'),
      isWeekend: false,
    },
    {
      short: t('calendar:weekdays.fri'),
      full: t('calendar:weekdays.friday'),
      isWeekend: false,
    },
    {
      short: t('calendar:weekdays.sat'),
      full: t('calendar:weekdays.saturday'),
      isWeekend: true,
    },
  ]

  const daysGrid = getMonthCalendarGrid(currentMonth)
  const personMap = new Map(persons.map((p) => [p.id, p]))

  const activeShiftIds = useMemo(() => {
    return (
      monthActiveShifts[currentMonth] ??
      shiftDefinitions.filter((s) => s.enabledByDefault).map((s) => s.id)
    )
  }, [monthActiveShifts, currentMonth, shiftDefinitions])

  const activeShifts = useMemo(() => {
    const map = new Map(shiftDefinitions.map((s) => [s.id, s]))
    return activeShiftIds
      .map((id) => map.get(id))
      .filter((s): s is ShiftDefinition => Boolean(s))
  }, [shiftDefinitions, activeShiftIds])

  const shiftMap = useMemo(() => {
    return new Map(shiftDefinitions.map((s) => [s.id, s]))
  }, [shiftDefinitions])

  // Events of the current month sorted chronologically by date and time
  const monthEvents = events
    .filter((e) => e.date.startsWith(currentMonth))
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      const timeCompare = (a.time || '').localeCompare(b.time || '')
      if (timeCompare !== 0) return timeCompare
      return a.title.localeCompare(b.title)
    })

  // Close on ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreenModalOpen) {
        setFullScreenModalOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullScreenModalOpen, setFullScreenModalOpen])

  if (!isFullScreenModalOpen) return null

  const handlePrint = () => {
    const previousTitle = document.title
    document.title = getScheduleFileBaseName(currentMonth, i18n.language)
    window.print()
    document.title = previousTitle
  }

  return createPortal(
    <div
      id="fullscreen-calendar-modal-container"
      className="modal-overlay fixed inset-0 z-110 flex items-center justify-center p-0 m-0 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-fadeIn print:p-0 print:m-0 print:static print:bg-transparent print:backdrop-blur-none print:z-auto"
    >
      <div className="w-full h-full bg-white dark:bg-slate-900 rounded-none sm:rounded-2xl md:rounded-3xl shadow-none sm:shadow-2xl border-0 sm:border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transition-colors print:rounded-none print:border-none print:shadow-none print:bg-white print:text-slate-900 print:h-auto print:overflow-visible dark:print:bg-white dark:print:text-slate-900">
        {/* Fullscreen Header */}
        <div className="px-3 sm:px-5 py-2.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-2 sm:gap-3 shrink-0 print:px-2 print:py-2 print:border-b-2 print:border-slate-800 print:bg-white dark:print:bg-white dark:print:border-slate-800">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-linear-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-xs shrink-0 print:hidden">
              <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 className="text-sm sm:text-lg md:text-xl font-extrabold text-slate-900 dark:text-white print:text-slate-950 dark:print:text-slate-950 print:text-2xl tracking-tight truncate">
                  {formatMonthYear(currentMonth, i18n.language, { compact: true })}
                </h2>

                {/* Month Navigation */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg sm:rounded-xl p-0.5 sm:p-1 border border-slate-200/80 dark:border-slate-700 shrink-0 print:hidden ml-1">
                  <button
                    type="button"
                    onClick={goToPreviousMonth}
                    title={t('calendar:prevMonth')}
                    className="p-1 sm:p-1.5 rounded-md sm:rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition shadow-2xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={goToNextMonth}
                    title={t('calendar:nextMonth')}
                    className="p-1 sm:p-1.5 rounded-md sm:rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition shadow-2xs"
                  >
                    <ChevronRight className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
              <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 print:block print:text-slate-600 dark:print:text-slate-600">
                {t('calendar:fullscreenSubtitle')}
              </p>
            </div>
          </div>

          {/* Action Controls - Hidden when printing */}
          <div className="flex items-center gap-1.5 sm:gap-2 print:hidden shrink-0">
            {/* Print button */}
            <button
              type="button"
              onClick={handlePrint}
              title={t('calendar:printTooltip')}
              className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-2 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 text-xs font-bold transition shadow-2xs"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">{t('calendar:printPdf')}</span>
            </button>

            {/* Close button */}
            <button
              type="button"
              onClick={() => setFullScreenModalOpen(false)}
              title={t('calendar:fullscreenClose')}
              className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Calendar Grid Container */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-slate-50/50 dark:bg-slate-950 print:overflow-visible print:bg-white dark:print:bg-white print:h-auto">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0 print:bg-slate-100 dark:print:bg-slate-100 print:text-slate-900 dark:print:text-slate-900 print:border-b-2 print:border-slate-400 dark:print:border-slate-400">
            {weekdays.map((day) => (
              <div
                key={day.full}
                className={`py-2 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0 print:border-r print:border-slate-300 dark:print:border-slate-300 ${
                  day.isWeekend
                    ? 'text-indigo-950/70 dark:text-indigo-300 bg-slate-200/40 dark:bg-slate-700/40 print:bg-slate-200/60 dark:print:bg-slate-200/60 dark:print:text-indigo-950'
                    : ''
                }`}
              >
                <span className="hidden sm:inline">{day.full}</span>
                <span className="sm:hidden">{day.short}</span>
              </div>
            ))}
          </div>

          {/* Grid Cells */}
          <div className="flex-1 grid grid-cols-7 border-l border-slate-200 dark:border-slate-800 auto-rows-fr overflow-y-auto print:overflow-visible print:border-l-2 print:border-slate-400 dark:print:border-slate-400 print:h-auto">
            {daysGrid.map((dayInfo) => {
              const assigned = assignments[dayInfo.dateStr] || []
              const dayShiftMap = dayShiftAssignments[dayInfo.dateStr] || {}
              const dayEvents = events.filter((e) => e.date === dayInfo.dateStr)
              const hasEvents = dayEvents.length > 0
              const dayExpenses = expenses.filter((e) => e.date === dayInfo.dateStr)
              const dayExpensesTotal = dayExpenses.reduce(
                (sum, curr) => sum + (curr.amount || 0),
                0,
              )
              const hasExpenses = dayExpensesTotal > 0
              const hasMultiplePersons = assigned.length > 1
              const dayShifts = getDayActiveShifts(dayInfo.dateStr)

              const getPersonShift = (personId: string): ShiftDefinition | undefined => {
                const entry = Object.entries(dayShiftMap).find(([, pId]) => pId === personId)
                if (entry) {
                  return shiftMap.get(entry[0])
                }
                if (dayShifts.length > 0) {
                  const personIndex = assigned.indexOf(personId)
                  if (personIndex >= 0 && personIndex < dayShifts.length) {
                    return dayShifts[personIndex]
                  }
                  return dayShifts[0]
                }
                return shiftDefinitions[0]
              }

              const sortedAssigned = hasMultiplePersons
                ? [...assigned].sort((aId, bId) => {
                    const shiftA = getPersonShift(aId)
                    const shiftB = getPersonShift(bId)
                    if (shiftA && shiftB) {
                      return shiftA.startTime.localeCompare(shiftB.startTime)
                    }
                    if (shiftA) return -1
                    if (shiftB) return 1
                    return 0
                  })
                : assigned

              return (
                <div
                  key={dayInfo.dateStr}
                  className={`border-b border-r border-slate-200 dark:border-slate-800 p-2 mobile:p-0 md:p-3 flex flex-col justify-between transition-colors min-h-[90px] print:min-h-[105px] print:p-1.5 print:border-slate-300 dark:print:border-slate-300 print:bg-white dark:print:bg-white ${
                    !dayInfo.isCurrentMonth
                      ? 'bg-slate-100/60 dark:bg-slate-950/50 text-slate-400 dark:text-slate-600 print:bg-slate-100/70 dark:print:bg-slate-100/70 print:text-slate-400 dark:print:text-slate-400'
                      : dayInfo.isToday
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 ring-1 ring-inset ring-indigo-200 dark:ring-indigo-800/60 hover:bg-indigo-100/50 dark:hover:bg-indigo-900/40 print:bg-white dark:print:bg-white'
                        : 'bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 print:bg-white dark:print:bg-white'
                  }`}
                >
                  {/* Cell Top Header */}
                  <div
                    className={`flex items-center justify-between mb-1.5 mobile:justify-center mobile:pt-1 mobile:pb-0.5 ${
                      hasEvents
                        ? 'mobile:bg-red-50 mobile:dark:bg-red-950/60'
                        : hasExpenses
                        ? 'mobile:bg-emerald-50 mobile:dark:bg-emerald-950/60'
                        : ''
                    }`}
                  >
                    {/* Day number: on small screens (<= 640px) it opens the events modal */}
                    <button
                      type="button"
                      onClick={() => setSelectedDateForEvents(dayInfo.dateStr)}
                      tabIndex={-1}
                      data-testid={`fullscreen-day-number-${dayInfo.dateStr}`}
                      aria-label={
                        hasEvents
                          ? t('calendar:dayCell.eventsTooltip', { count: dayEvents.length })
                          : t('calendar:dayCell.viewOrAddEvents')
                      }
                      className={`pointer-events-none mobile:pointer-events-auto mobile:cursor-pointer text-sm md:text-base font-semibold inline-flex items-center justify-center transition-colors print:w-6 print:h-6 print:text-xs ${
                        hasEvents
                          ? 'text-red-600 font-extrabold dark:text-red-400 bg-red-50 dark:bg-red-950/60 w-7 h-7 rounded-full mobile:bg-transparent mobile:dark:bg-transparent mobile:w-auto mobile:h-auto mobile:rounded-none print:w-6 print:h-6 print:bg-red-100 dark:print:bg-red-100 print:text-red-700 dark:print:text-red-700'
                          : dayInfo.isToday
                            ? 'text-indigo-600 dark:text-indigo-400 font-bold px-1 print:text-slate-900 dark:print:text-slate-900'
                            : dayInfo.isCurrentMonth
                              ? 'text-slate-800 dark:text-slate-200 print:text-slate-900 dark:print:text-slate-900 font-bold'
                              : 'text-slate-400 dark:text-slate-600 print:text-slate-400 dark:print:text-slate-400'
                      }`}
                    >
                      {dayInfo.dayNumber}
                    </button>

                    {/* Right header actions: Expenses icon + Events Count Tag */}
                    <div className="flex items-center gap-0.5">
                      {hasExpenses && (
                        <button
                          type="button"
                          onClick={() => setSelectedDateForEvents(dayInfo.dateStr, 'expenses')}
                          data-testid={`fullscreen-expense-badge-${dayInfo.dateStr}`}
                          aria-label={t('calendar:dayCell.expensesTooltip', {
                            amount: formatBRL(dayExpensesTotal),
                          })}
                          title={t('calendar:dayCell.expensesTooltip', {
                            amount: formatBRL(dayExpensesTotal),
                          })}
                          className="mobile:hidden p-1 rounded-md text-xs transition flex items-center text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 print:text-emerald-800 cursor-pointer"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Events Count Tag */}
                      {hasEvents && (
                        <span
                          className="mobile:hidden inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-1.5 py-0.5 rounded-md print:bg-red-50 dark:print:bg-red-50 print:border print:border-red-300 dark:print:border-red-300 print:text-red-700 dark:print:text-red-700"
                          title={dayEvents.map((e) => e.title).join(' | ')}
                        >
                          <CalendarIcon className="w-3 h-3" />
                          <span>{dayEvents.length}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cell Body with Assigned Persons */}
                  <div className="flex-1 flex flex-col justify-center space-y-1">
                    {sortedAssigned.length === 0 ? (
                      dayShifts.length > 0 ? (
                        <div className="text-center py-1">
                          <span className="text-xs text-slate-300 dark:text-slate-600 italic print:text-slate-400 dark:print:text-slate-400">
                            {t('calendar:dayCell.vacant')}
                          </span>
                        </div>
                      ) : null
                    ) : (
                      sortedAssigned.map((personId) => {
                        const person = personMap.get(personId)
                        if (!person) return null
                        const personShift = getPersonShift(personId)

                        return (
                          <div
                            key={personId}
                            style={{
                              backgroundColor: person.color,
                              borderColor: person.color,
                              color: '#ffffff',
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact',
                            }}
                            className="text-white text-xs md:text-sm font-semibold px-2 mobile:px-1 py-1 rounded-lg mobile:rounded-sm shadow-2xs flex items-center justify-between truncate w-full print:text-white print:font-bold print:border-2 print:rounded-md print:px-2 print:py-0.5 print:shadow-none print-person-chip"
                            title={
                              personShift
                                ? `${personShift.name}: ${person.name}`
                                : person.name
                            }
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              {personShift && (
                                <span
                                  data-testid={`shift-badge-${dayInfo.dateStr}-${personShift.code}`}
                                  style={{
                                    backgroundColor: personShift.color || 'rgba(0,0,0,0.3)',
                                    color: '#ffffff',
                                    WebkitPrintColorAdjust: 'exact',
                                    printColorAdjust: 'exact',
                                  }}
                                  className="mobile:hidden text-[9px] md:text-[10px] font-black uppercase px-1.5 py-0.2 rounded-sm shrink-0 shadow-xs print:text-[8px] print:px-1"
                                >
                                  {personShift.code}
                                </span>
                              )}
                              <span className="truncate">{person.name}</span>
                            </div>
                          </div>
                        )
                      })
                    )}

                    {hasMultiplePersons &&
                      (!activeShifts ||
                        activeShifts.length <= 1 ||
                        !dayShiftMap ||
                        Object.keys(dayShiftMap).length <= 1) && (
                        <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded-sm border border-rose-200 dark:border-rose-800 block text-center print:bg-rose-100 dark:print:bg-rose-100 print:text-rose-800 dark:print:text-rose-800 print:border-rose-300 dark:print:border-rose-300">
                          {t('calendar:dayCell.conflict', {
                            count: assigned.length,
                          })}
                        </span>
                      )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Print-only Events Section: list all events of the month ordered chronologically by date */}
        {monthEvents.length > 0 && (
          <div
            data-testid="print-events-section"
            className="hidden print:block print:break-before-page print-page-break-before w-full print:pt-6 print:px-2 print:bg-white print:text-slate-900 dark:print:bg-white dark:print:text-slate-900"
          >
            <div className="mb-4 pb-2 border-b-2 border-slate-800 dark:border-slate-800 print:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-slate-950 dark:text-slate-950 print:text-slate-950 tracking-tight">
                  {t('calendar:fullscreenEventsTitle', {
                    month: formatMonthYear(currentMonth, i18n.language),
                  })}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-600 print:text-slate-600 mt-0.5">
                  {t('calendar:fullscreenEventsSubtitle')}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-800 print:text-slate-800 bg-slate-100 dark:bg-slate-100 print:bg-slate-100 px-3 py-1 rounded-full border border-slate-300 dark:border-slate-300 print:border-slate-300">
                  {t('calendar:totalEventsBadge', {
                    count: monthEvents.length,
                    label:
                      monthEvents.length === 1
                        ? t('calendar:eventLabel')
                        : t('calendar:eventsLabel'),
                  })}
                </span>
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-300 dark:border-slate-300 print:border-slate-300 text-left text-xs bg-white dark:bg-white print:bg-white text-slate-900 dark:text-slate-900 print:text-slate-900">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-100 print:bg-slate-100 border-b-2 border-slate-400 dark:border-slate-400 print:border-slate-400 text-slate-900 dark:text-slate-900 print:text-slate-900 font-bold">
                  <th className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-300 print:border-slate-300 w-36 text-slate-900 dark:text-slate-900 print:text-slate-900">
                    {t('calendar:table.date')}
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-300 print:border-slate-300 w-24 text-slate-900 dark:text-slate-900 print:text-slate-900">
                    {t('calendar:table.time')}
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-300 print:border-slate-300 w-1/4 text-slate-900 dark:text-slate-900 print:text-slate-900">
                    {t('calendar:table.event')}
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-300 print:border-slate-300 text-slate-900 dark:text-slate-900 print:text-slate-900">
                    {t('calendar:table.address')}
                  </th>
                  <th className="py-2.5 px-3 w-48 text-slate-900 dark:text-slate-900 print:text-slate-900">
                    {t('calendar:table.responsible')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-200 print:divide-slate-200">
                {monthEvents.map((event) => {
                  const { formattedDate, weekday } = formatDateWithWeekday(
                    event.date,
                    i18n.language,
                  )
                  const assignedIds = assignments[event.date] || []
                  const servicePersonId = event.personId || assignedIds[0]
                  const servicePerson = servicePersonId
                    ? personMap.get(servicePersonId)
                    : null
                  const displayAddress = event.address || event.description

                  return (
                    <tr
                      key={event.id}
                      className="print:break-inside-avoid print-break-inside-avoid odd:bg-white even:bg-slate-50/60 dark:odd:bg-white dark:even:bg-slate-50/60 print:odd:bg-white print:even:bg-slate-50/60"
                    >
                      <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-200 print:border-slate-200 font-bold text-slate-950 dark:text-slate-950 print:text-slate-950 whitespace-nowrap">
                        <div>{formattedDate}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-500 print:text-slate-500 font-medium">
                          {weekday}
                        </div>
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-200 print:border-slate-200 whitespace-nowrap">
                        {event.time ? (
                          <span className="font-semibold text-slate-800 dark:text-slate-800 print:text-slate-800">
                            {event.time}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-400 print:text-slate-400 italic">
                            {t('calendar:allDay')}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-200 print:border-slate-200 font-bold text-slate-900 dark:text-slate-900 print:text-slate-900">
                        {event.title}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-200 print:border-slate-200 text-slate-600 dark:text-slate-600 print:text-slate-600 whitespace-pre-line">
                        {displayAddress || (
                          <span className="text-slate-400 dark:text-slate-400 print:text-slate-400 italic">
                            -
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-700 dark:text-slate-700 print:text-slate-700">
                        {servicePerson ? (
                          <span
                            style={{
                              backgroundColor: servicePerson.color,
                              borderColor: servicePerson.color,
                              color: '#ffffff',
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact',
                            }}
                            className="inline-block px-2 py-0.5 rounded-sm text-[11px] font-bold text-white print:text-white print-person-chip shadow-2xs"
                          >
                            {servicePerson.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-400 print:text-slate-400 italic">
                            -
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>,

    document.body,
  )
}
