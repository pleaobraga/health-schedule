import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { AddMonthParticipantsModal } from './add-month-participants-modal'
import { AddMonthRulesModal } from './add-month-rules-modal'
import { MonthAvailabilityModal } from './month-availability-modal'
import { PersonCard } from './person-card'
import { useListOrder } from '../../hooks/use-list-order'
import { useScheduleStore } from '../../store/use-schedule-store'
import { formatMonthYear } from '../../utils/date-utils'
import { sortByListOrder } from '../../utils/list-order'
import { SortableList } from '../common/sortable-list'
import { MonthShiftConfigModal } from '../modals/month-shift-config-modal'

import type { Person, ShiftRule } from '../../types'

export function Sidebar() {
  const { t, i18n } = useTranslation([
    'people',
    'settings',
    'calendar',
    'common',
  ])
  const navigate = useNavigate()
  const {
    persons,
    monthParticipants,
    availabilities,
    assignments,
    dayShiftAssignments,
    currentMonth,
    isEditMode,
    highlightedPersonId,
    setHighlightedPersonId,
    highlightedScheduledPersonId,
    setHighlightedScheduledPersonId,
    addPersonsToMonth,
    removePersonFromMonth,
    setPersonAvailability,
    insertAllPersonDaysToMonth,
    setCurrentView,
    shiftRules,
    getRegistryForMonth,
    monthDailyShifts,
    getActiveShiftIds,
    getActiveRuleIds,
    addRulesToMonth,
    removeRuleFromMonth,
  } = useScheduleStore()

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isAddRulesModalOpen, setIsAddRulesModalOpen] = useState(false)
  const [isShiftConfigModalOpen, setIsShiftConfigModalOpen] = useState(false)
  const [personForAvailability, setPersonForAvailability] =
    useState<Person | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Accordion state: Plantões Diários, Pessoas, Regras
  const [openSections, setOpenSections] = useState<{
    people: boolean
    dailyShifts: boolean
    rules: boolean
  }>({
    dailyShifts: true,
    people: true,
    rules: false,
  })

  // Global mobile minimize/expand state for screens < 1024px
  const [isMobileCollapsed, setIsMobileCollapsed] = useState(false)

  const toggleSection = (section: 'people' | 'dailyShifts' | 'rules') => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  // Active items for current month
  const monthRegistry = getRegistryForMonth(currentMonth)
  const currentParticipantIds = monthParticipants[currentMonth] || []
  const { order: personOrder, handleReorder } = useListOrder('month-people')
  const monthPersons = sortByListOrder(
    monthRegistry.persons.filter((p) => currentParticipantIds.includes(p.id)),
    personOrder,
  )
  const activeShiftIds = getActiveShiftIds(currentMonth)
  const activeShifts = monthRegistry.shiftDefinitions.filter((s) =>
    activeShiftIds.includes(s.id),
  )
  const activeRuleIds = getActiveRuleIds(currentMonth)
  const activeRules = monthRegistry.shiftRules.filter((r) => activeRuleIds.includes(r.id))

  // Configured daily shifts for current month
  const currentMonthDailyConfig = monthDailyShifts[currentMonth] || {}
  const configuredDailyShiftEntries = Object.entries(
    currentMonthDailyConfig,
  ).filter(([, days]) => Array.isArray(days) && days.length > 0)

  const filteredPersons = monthPersons.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase().trim()),
  )

  const getPersonAvailableDays = (personId: string): number[] => {
    const avail = availabilities.find(
      (a) => a.personId === personId && a.month === currentMonth,
    )
    return avail ? avail.availableDays : []
  }

  const getPersonWorkingDaysCount = (personId: string): number => {
    const workingDates = new Set<string>()
    Object.entries(assignments).forEach(([dateStr, personIds]) => {
      if (dateStr.startsWith(currentMonth) && personIds.includes(personId)) {
        workingDates.add(dateStr)
      }
    })
    Object.entries(dayShiftAssignments).forEach(([dateStr, shiftMap]) => {
      if (
        dateStr.startsWith(currentMonth) &&
        shiftMap &&
        Object.values(shiftMap).includes(personId)
      ) {
        workingDates.add(dateStr)
      }
    })
    return workingDates.size
  }

  const handleSaveAvailability = (
    personId: string,
    days: number[],
    shiftAvailability?: Record<string, number[]>,
    shiftRates?: Record<string, Record<number, number>>,
  ) => {
    setPersonAvailability(
      personId,
      currentMonth,
      days,
      shiftAvailability,
      shiftRates,
    )
  }

  const handleGoToGlobalManagement = () => {
    setCurrentView('people')
    navigate('/pessoas')
  }

  const handleGoToRulesManagement = () => {
    setCurrentView('settings')
    navigate('/configuracoes/regras')
  }

  const handleGoToShiftsManagement = () => {
    setCurrentView('settings')
    navigate('/configuracoes/turnos')
  }

  return (
    <aside className="w-full h-full max-h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col shadow-xs overflow-hidden transition-all duration-300 select-none">
      {/* Mobile Header Toggle on screens < 1024px */}
      <div className="lg:hidden p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
            {t('people:sidebar.mobileHeaderTitle')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileCollapsed(!isMobileCollapsed)}
          title={
            isMobileCollapsed
              ? t('people:sidebar.expandAria')
              : t('people:sidebar.collapseAria')
          }
          aria-label={
            isMobileCollapsed
              ? t('people:sidebar.expandAria')
              : t('people:sidebar.collapseAria')
          }
          aria-expanded={!isMobileCollapsed}
          data-testid="toggle-sidebar-collapse"
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        >
          <span className="text-[11px]">
            {isMobileCollapsed
              ? t('people:sidebar.expand')
              : t('people:sidebar.collapse')}
          </span>
          {isMobileCollapsed ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Accordion Panels Container */}
      <div
        className={`${
          isMobileCollapsed ? 'hidden lg:flex' : 'flex'
        } flex-col flex-1 min-h-0 p-3 space-y-3.5 overflow-y-auto custom-scrollbar`}
      >
        {/* =================================================================== */}
        {/* SECTION 1: PLANTÕES DO MÊS */}
        {/* =================================================================== */}
        <section
          className={`flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden transition-all ${
            openSections.dailyShifts ? 'flex-1 min-h-0' : 'shrink-0'
          }`}
        >
          {/* Section Header */}
          <div
            onClick={() => toggleSection('dailyShifts')}
            className="p-3 sm:px-4 py-2.5 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 cursor-pointer flex items-center justify-between shrink-0 transition"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-950/60 border border-violet-100 dark:border-violet-800/60 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
                <CalendarDays className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                  <span>{t('people:sidebar.dailyShiftsTitle')}</span>
                </h2>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {t('people:sidebar.dailyShiftsCount', {
                    configured: configuredDailyShiftEntries.length,
                  })}
                </p>
              </div>
            </div>

            <div
              className="flex items-center gap-1 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsShiftConfigModalOpen(true)}
                title={t('people:sidebar.configureDailyShiftsTooltip')}
                aria-label={t('people:sidebar.configureDailyShifts')}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-violet-600 hover:bg-violet-700 active:bg-violet-800 rounded-lg shadow-2xs transition"
              >
                <CalendarDays className="w-3 h-3" />
                <span className="hidden xs:inline">
                  {t('people:sidebar.configureDailyShifts')}
                </span>
              </button>
              <button
                type="button"
                onClick={handleGoToShiftsManagement}
                title={t('people:sidebar.manageShifts')}
                aria-label={t('people:sidebar.manageShifts')}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => toggleSection('dailyShifts')}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                aria-label={
                  openSections.dailyShifts
                    ? t('people:sidebar.collapse')
                    : t('people:sidebar.expand')
                }
              >
                {openSections.dailyShifts ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Section Body */}
          {openSections.dailyShifts && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-slate-900">
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2 min-h-0 custom-scrollbar">
                {configuredDailyShiftEntries.length === 0 ? (
                  <div className="text-center py-5 px-3">
                    <Clock className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600 mb-1.5" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t('people:sidebar.noDailyShifts')}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 mb-2.5">
                      {t('people:sidebar.noDailyShiftsDesc')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsShiftConfigModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-lg shadow-2xs transition"
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>{t('people:sidebar.configureDailyShifts')}</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {configuredDailyShiftEntries.map(([shiftId, days]) => {
                      const shift = monthRegistry.shiftDefinitions.find(
                        (s) => s.id === shiftId,
                      )
                      if (!shift) return null
                      return (
                        <div
                          key={shiftId}
                          className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 flex items-center justify-between gap-2.5"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              style={{ backgroundColor: shift.color }}
                              className="px-2 py-0.5 rounded-md text-white font-extrabold text-[10px] shrink-0 shadow-2xs"
                            >
                              {shift.code}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                {shift.name}
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                {t('people:sidebar.shiftSummary', {
                                  startTime: shift.startTime,
                                  hours: shift.durationHours,
                                })}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 shrink-0">
                            {days.length}{' '}
                            {days.length === 1
                              ? t('people:card.dayLabel')
                              : t('people:card.dayLabelPlural')}
                          </span>
                        </div>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => setIsShiftConfigModalOpen(true)}
                      className="w-full mt-1.5 py-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40 rounded-lg border border-dashed border-violet-200 dark:border-violet-800 transition flex items-center justify-center gap-1.5"
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>{t('people:sidebar.configureDailyShifts')}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        {/* =================================================================== */}
        {/* SECTION 2: PESSOAS DO MÊS */}
        {/* =================================================================== */}
        <section
          className={`flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden transition-all ${
            openSections.people ? 'flex-1 min-h-0' : 'shrink-0'
          }`}
        >
          {/* Section Header */}
          <div
            onClick={() => toggleSection('people')}
            className="p-3 sm:px-4 py-2.5 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 cursor-pointer flex items-center justify-between shrink-0 transition"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <Users className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                  <span>{t('people:sidebar.title')}</span>
                </h2>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {monthPersons.length === 1
                    ? t('people:sidebar.linkedCount', {
                        count: monthPersons.length,
                      })
                    : t('people:sidebar.linkedCountPlural', {
                        count: monthPersons.length,
                      })}
                </p>
              </div>
            </div>

            <div
              className="flex items-center gap-1 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                title={t('people:sidebar.linkButtonTooltip')}
                aria-label={t('people:sidebar.linkButtonTooltip')}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-2xs transition"
              >
                <UserPlus className="w-3 h-3" />
                <span className="hidden xs:inline">
                  {t('people:sidebar.linkButton')}
                </span>
              </button>

              <button
                type="button"
                onClick={handleGoToGlobalManagement}
                title={t('people:sidebar.managePeople')}
                aria-label={t('people:sidebar.managePeople')}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => toggleSection('people')}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                aria-label={
                  openSections.people
                    ? t('people:sidebar.collapse')
                    : t('people:sidebar.expand')
                }
              >
                {openSections.people ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Section Body */}
          {openSections.people && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-slate-900">
              {/* Search Bar */}
              {monthPersons.length > 0 && (
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 shrink-0">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('people:sidebar.searchPlaceholder')}
                      className="w-full pl-7 pr-3 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Scrollable Person List */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 min-h-0 custom-scrollbar">
                {monthPersons.length === 0 ? (
                  <div className="text-center py-6 px-3 flex flex-col items-center justify-center h-full">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-2">
                      <Users className="w-5 h-5" />
                    </div>
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {t('people:sidebar.emptyTitle')}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-[200px] leading-relaxed">
                      {t('people:sidebar.emptyDesc')}{' '}
                      <strong className="capitalize">
                        {formatMonthYear(currentMonth, i18n.language)}
                      </strong>
                      .
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(true)}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-xs transition"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{t('people:sidebar.addPersonsToMonth')}</span>
                    </button>
                  </div>
                ) : filteredPersons.length === 0 ? (
                  <div className="text-center py-6 px-3">
                    <Users className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600 mb-1.5" />
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {t('people:sidebar.noResults')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline mt-1 block mx-auto"
                    >
                      {t('people:sidebar.clearSearch')}
                    </button>
                  </div>
                ) : (
                  <SortableList
                    items={filteredPersons}
                    getItemLabel={(person) => person.name}
                    onReorder={(activeId, overId) =>
                      handleReorder(
                        monthPersons.map((p) => p.id),
                        activeId,
                        overId,
                      )
                    }
                    renderItem={(person, dragHandle) => {
                      const availDays = getPersonAvailableDays(person.id)
                      const workingDays = getPersonWorkingDaysCount(person.id)
                      const personAvail = availabilities.find(
                        (a) =>
                          a.personId === person.id && a.month === currentMonth,
                      )
                      const availableShifts = activeShifts
                        .filter(
                          (s) =>
                            (personAvail?.shiftAvailability?.[s.id]?.length ||
                              0) > 0,
                        )
                        .map((s) => ({
                          shift: s,
                          daysCount: personAvail!.shiftAvailability![s.id].length,
                        }))

                      return (
                        <PersonCard
                          person={person}
                          availableDaysCount={availDays.length}
                          workingDaysCount={workingDays}
                          availableShifts={availableShifts}
                          isHighlighted={highlightedPersonId === person.id}
                          isScheduledHighlighted={
                            highlightedScheduledPersonId === person.id
                          }
                          isEditMode={isEditMode}
                          onToggleHighlight={() =>
                            setHighlightedPersonId(person.id)
                          }
                          onToggleScheduledHighlight={() =>
                            setHighlightedScheduledPersonId(person.id)
                          }
                          onEdit={() => setPersonForAvailability(person)}
                          onInsertAllDays={(shiftId) =>
                            insertAllPersonDaysToMonth(
                              person.id,
                              currentMonth,
                              shiftId,
                            )
                          }
                          onRemoveFromMonth={() =>
                            removePersonFromMonth(person.id, currentMonth)
                          }
                          dragHandle={dragHandle}
                        />
                      )
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </section>

        {/* =================================================================== */}
        {/* SECTION 2: REGRAS DE VALIDAÇÃO DO MÊS */}
        {/* =================================================================== */}
        <section
          className={`flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden transition-all ${
            openSections.rules ? 'flex-1 min-h-0' : 'shrink-0'
          }`}
        >
          {/* Section Header */}
          <div
            onClick={() => toggleSection('rules')}
            className="p-3 sm:px-4 py-2.5 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 cursor-pointer flex items-center justify-between shrink-0 transition"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5 flex-wrap">
                  <span>{t('people:sidebar.rulesTitle')}</span>
                </h2>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {t('people:sidebar.rulesCount', {
                    active: activeRules.length,
                    total: shiftRules.length,
                  })}
                </p>
              </div>
            </div>

            <div
              className="flex items-center gap-1 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsAddRulesModalOpen(true)}
                title={t('people:sidebar.linkRulesButtonTooltip')}
                aria-label={t('people:sidebar.linkRulesButtonTooltip')}
                className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-2xs transition"
              >
                <ShieldCheck className="w-3 h-3" />
                <span className="hidden xs:inline">
                  {t('people:sidebar.linkButton')}
                </span>
              </button>
              <button
                type="button"
                onClick={handleGoToRulesManagement}
                title={t('people:sidebar.manageRules')}
                aria-label={t('people:sidebar.manageRules')}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => toggleSection('rules')}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                aria-label={
                  openSections.rules
                    ? t('people:sidebar.collapse')
                    : t('people:sidebar.expand')
                }
              >
                {openSections.rules ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Section Body */}
          {openSections.rules && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-slate-900">
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2 min-h-0 custom-scrollbar">
                {activeRules.length === 0 ? (
                  <div className="text-center py-6 px-3 flex flex-col items-center justify-center">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-2">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {t('people:sidebar.emptyRules')}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[200px] mt-0.5 mb-3 leading-tight">
                      {t('people:sidebar.emptyRulesDesc')}{' '}
                      <strong className="capitalize">
                        {formatMonthYear(currentMonth, i18n.language)}
                      </strong>
                      .
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAddRulesModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('people:sidebar.addRulesToMonth')}</span>
                    </button>
                  </div>
                ) : (
                  activeRules.map((rule: ShiftRule) => {
                    const isError = rule.severity === 'ERROR'

                    const getParamSummary = () => {
                      if (rule.type === 'MAX_SHIFTS_PER_PERIOD') {
                        const scopeLabel =
                          rule.parameters.scope === 'WEEK'
                            ? t('settings:rules.scopes.WEEK')
                            : rule.parameters.scope === 'MONTH'
                              ? t('settings:rules.scopes.MONTH')
                              : t('settings:rules.scopes.DAY')
                        return t('people:sidebar.paramMaxShifts', {
                          scope: scopeLabel,
                          count: rule.parameters.maxOccurrences || 1,
                        })
                      }
                      if (rule.type === 'MAX_HOURS_PER_PERIOD') {
                        const scopeLabel =
                          rule.parameters.scope === 'WEEK'
                            ? t('settings:rules.scopes.WEEK')
                            : rule.parameters.scope === 'MONTH'
                              ? t('settings:rules.scopes.MONTH')
                              : t('settings:rules.scopes.DAY')
                        return t('people:sidebar.paramMaxHours', {
                          scope: scopeLabel,
                          hours: rule.parameters.maxHours || 24,
                        })
                      }
                      if (rule.type === 'MIN_REST_HOURS') {
                        return t('people:sidebar.paramMinRest', {
                          hours: rule.parameters.minRestHours || 24,
                        })
                      }
                      if (rule.type === 'CONSECUTIVE_DAYS_LIMIT') {
                        return t('people:sidebar.paramConsecutiveDays', {
                          days: rule.parameters.consecutiveDaysLimit || 1,
                        })
                      }
                      if (rule.type === 'MAX_PEOPLE_PER_SHIFT') {
                        return t('people:sidebar.paramMaxPeople', {
                          count:
                            rule.parameters.maxPeople ??
                            rule.parameters.maxOccurrences ??
                            1,
                        })
                      }
                      if (rule.type === 'DAILY_SHIFT_HOURS') {
                        const hours = rule.parameters.targetDailyHours || 24
                        return `${hours}h/dia`
                      }
                      return undefined
                    }

                    const paramSummary = getParamSummary()

                    return (
                      <div
                        key={rule.id}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                {rule.name}
                              </span>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                                  isError
                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                }`}
                              >
                                {isError
                                  ? t('people:sidebar.errorSeverity')
                                  : t('people:sidebar.warningSeverity')}
                              </span>
                            </div>

                            {/* Parameters summary */}
                            {paramSummary && (
                              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-0.5">
                                {paramSummary}
                              </p>
                            )}

                            {rule.description && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                                {rule.description}
                              </p>
                            )}
                          </div>

                          {/* Remove rule from month button */}
                          <button
                            type="button"
                            onClick={() =>
                              removeRuleFromMonth(rule.id, currentMonth)
                            }
                            title={t('people:sidebar.removeRuleTooltip', {
                              name: rule.name,
                            })}
                            aria-label={t('people:sidebar.removeRuleTooltip', {
                              name: rule.name,
                            })}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Modals */}
      <AddMonthParticipantsModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        currentMonth={currentMonth}
        allPersons={persons}
        currentParticipantIds={currentParticipantIds}
        onAddParticipants={(ids) => addPersonsToMonth(ids, currentMonth)}
        onGoToGlobalManagement={handleGoToGlobalManagement}
      />

      <AddMonthRulesModal
        isOpen={isAddRulesModalOpen}
        onClose={() => setIsAddRulesModalOpen(false)}
        currentMonth={currentMonth}
        allRules={shiftRules}
        currentRuleIds={activeRuleIds}
        onAddRules={(ids) => addRulesToMonth(ids, currentMonth)}
        onGoToGlobalManagement={handleGoToRulesManagement}
      />

      <MonthAvailabilityModal
        isOpen={Boolean(personForAvailability)}
        onClose={() => setPersonForAvailability(null)}
        person={personForAvailability}
        currentMonth={currentMonth}
        activeShifts={activeShifts}
        initialAvailableDays={
          personForAvailability
            ? getPersonAvailableDays(personForAvailability.id)
            : []
        }
        initialShiftAvailability={
          personForAvailability
            ? availabilities.find(
                (a) =>
                  a.personId === personForAvailability.id &&
                  a.month === currentMonth,
              )?.shiftAvailability
            : undefined
        }
        initialShiftRates={
          personForAvailability
            ? availabilities.find(
                (a) =>
                  a.personId === personForAvailability.id &&
                  a.month === currentMonth,
              )?.shiftRates
            : undefined
        }
        onSave={handleSaveAvailability}
      />

      <MonthShiftConfigModal
        isOpen={isShiftConfigModalOpen}
        onClose={() => setIsShiftConfigModalOpen(false)}
        currentMonth={currentMonth}
      />
    </aside>
  )
}
