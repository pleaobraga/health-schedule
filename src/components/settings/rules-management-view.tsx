import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Plus,
  Search,
  Edit2,
  Copy,
  Trash2,
  Check,
  X,
  Layers,
  Info,
  HelpCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useListOrder } from '../../hooks/use-list-order'
import { useScheduleStore } from '../../store/use-schedule-store'
import { sortByListOrder } from '../../utils/list-order'
import { SortableList } from '../common/sortable-list'
import { Select } from '../ui/select'

import type {
  PeriodScope,
  RuleType,
  ShiftRule,
  DayFilterType,
  DailyHoursComparison,
} from '../../types'

export function RulesManagementView() {
  const { t } = useTranslation(['settings', 'common'])
  const {
    shiftRules,
    shiftDefinitions,
    addShiftRule,
    updateShiftRule,
    deleteShiftRule,
    duplicateShiftRule,
  } = useScheduleStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<ShiftRule | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<RuleType>('MAX_SHIFTS_PER_PERIOD')
  const [severity, setSeverity] = useState<'ERROR' | 'WARNING'>('ERROR')
  const [scope, setScope] = useState<PeriodScope>('DAY')
  const [maxOccurrences, setMaxOccurrences] = useState(1)
  const [maxHours, setMaxHours] = useState(24)
  const [minRestHours, setMinRestHours] = useState(24)
  const [consecutiveDaysLimit, setConsecutiveDaysLimit] = useState(1)
  const [maxPeople, setMaxPeople] = useState(1)
  const [targetDailyHours, setTargetDailyHours] = useState(24)
  const [dailyHoursComparison, setDailyHoursComparison] = useState<DailyHoursComparison>('EXACT')
  const [dayFilterType, setDayFilterType] = useState<DayFilterType>('ALL')
  const [specificDaysOfWeek, setSpecificDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5])
  const [targetShiftIds, setTargetShiftIds] = useState<string[]>([])
  const [enabledByDefault, setEnabledByDefault] = useState(true)

  const { order: ruleOrder, handleReorder } = useListOrder('rules')
  const sortedRules = sortByListOrder(shiftRules, ruleOrder)
  const filteredRules = sortedRules.filter((rule) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      rule.name.toLowerCase().includes(q) ||
      (rule.description && rule.description.toLowerCase().includes(q))
    )
  })

  const handleOpenCreateModal = () => {
    setEditingRule(null)
    setName('')
    setDescription('')
    setType('MAX_SHIFTS_PER_PERIOD')
    setSeverity('ERROR')
    setScope('DAY')
    setMaxOccurrences(1)
    setMaxHours(24)
    setMinRestHours(24)
    setConsecutiveDaysLimit(1)
    setMaxPeople(1)
    setTargetDailyHours(24)
    setDailyHoursComparison('EXACT')
    setDayFilterType('ALL')
    setSpecificDaysOfWeek([1, 2, 3, 4, 5])
    setTargetShiftIds([])
    setEnabledByDefault(true)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (rule: ShiftRule) => {
    setEditingRule(rule)
    setName(rule.name)
    setDescription(rule.description || '')
    setType(rule.type)
    setSeverity(rule.severity)
    setScope(rule.parameters.scope || 'DAY')
    setMaxOccurrences(rule.parameters.maxOccurrences ?? 1)
    setMaxHours(rule.parameters.maxHours ?? 24)
    setMinRestHours(rule.parameters.minRestHours ?? 24)
    setConsecutiveDaysLimit(rule.parameters.consecutiveDaysLimit ?? 1)
    setMaxPeople(rule.parameters.maxPeople ?? rule.parameters.maxOccurrences ?? 1)
    setTargetDailyHours(rule.parameters.targetDailyHours ?? 24)
    setDailyHoursComparison(rule.parameters.dailyHoursComparison ?? 'EXACT')
    setDayFilterType(rule.parameters.dayFilterType ?? 'ALL')
    setSpecificDaysOfWeek(rule.parameters.specificDaysOfWeek ?? [1, 2, 3, 4, 5])
    setTargetShiftIds(rule.parameters.targetShiftIds || [])
    setEnabledByDefault(rule.enabledByDefault)
    setIsModalOpen(true)
  }

  const handleToggleTargetShift = (shiftId: string) => {
    setTargetShiftIds((prev) =>
      prev.includes(shiftId) ? prev.filter((id) => id !== shiftId) : [...prev, shiftId]
    )
  }

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const parameters: ShiftRule['parameters'] = {}

    if (type === 'MAX_SHIFTS_PER_PERIOD') {
      parameters.scope = scope
      parameters.maxOccurrences = Number(maxOccurrences) || 1
    } else if (type === 'MAX_HOURS_PER_PERIOD') {
      parameters.scope = scope
      parameters.maxHours = Number(maxHours) || 24
    } else if (type === 'MIN_REST_HOURS') {
      parameters.minRestHours = Number(minRestHours) || 24
    } else if (type === 'CONSECUTIVE_DAYS_LIMIT') {
      parameters.consecutiveDaysLimit = Number(consecutiveDaysLimit) || 1
    } else if (type === 'MAX_PEOPLE_PER_SHIFT') {
      parameters.maxPeople = Number(maxPeople) || 1
    } else if (type === 'DAILY_SHIFT_HOURS') {
      parameters.targetDailyHours = Number(targetDailyHours) || 24
      parameters.dailyHoursComparison = dailyHoursComparison
      parameters.dayFilterType = dayFilterType
      if (dayFilterType === 'SPECIFIC_DAYS') {
        parameters.specificDaysOfWeek = specificDaysOfWeek
      }
    }

    if (targetShiftIds.length > 0) {
      parameters.targetShiftIds = targetShiftIds
    }

    if (editingRule) {
      updateShiftRule(editingRule.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        severity,
        parameters,
        enabledByDefault,
      })
    } else {
      addShiftRule({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        severity,
        parameters,
        enabledByDefault,
      })
    }
    setIsModalOpen(false)
  }

  const handleDelete = (id: string) => {
    deleteShiftRule(id)
    setDeleteConfirmId(null)
  }

  const getRuleTriggerCriterion = (rule: ShiftRule) => {
    switch (rule.type) {
      case 'MAX_SHIFTS_PER_PERIOD': {
        const count = rule.parameters.maxOccurrences ?? 1
        const rScope = rule.parameters.scope || 'DAY'
        if (rScope === 'DAY') {
          return t('settings:rules.logicExplanation.maxShiftsDay', { count })
        }
        if (rScope === 'WEEK') {
          return t('settings:rules.logicExplanation.maxShiftsWeek', { count })
        }
        return t('settings:rules.logicExplanation.maxShiftsMonth', { count })
      }
      case 'MAX_HOURS_PER_PERIOD': {
        const hours = rule.parameters.maxHours ?? 24
        const rScope = rule.parameters.scope || 'DAY'
        if (rScope === 'DAY') {
          return t('settings:rules.logicExplanation.maxHoursDay', { hours })
        }
        if (rScope === 'WEEK') {
          return t('settings:rules.logicExplanation.maxHoursWeek', { hours })
        }
        return t('settings:rules.logicExplanation.maxHoursMonth', { hours })
      }
      case 'MIN_REST_HOURS': {
        const hours = rule.parameters.minRestHours ?? 24
        return t('settings:rules.logicExplanation.minRest', { hours })
      }
      case 'CONSECUTIVE_DAYS_LIMIT': {
        const days = rule.parameters.consecutiveDaysLimit ?? 1
        return t('settings:rules.logicExplanation.consecutiveDays', { days })
      }
      case 'MAX_PEOPLE_PER_SHIFT': {
        const count = rule.parameters.maxPeople ?? rule.parameters.maxOccurrences ?? 1
        return t('settings:rules.logicExplanation.maxPeoplePerShift', { count })
      }
      case 'DAILY_SHIFT_HOURS': {
        const hours = rule.parameters.targetDailyHours ?? 24
        const comparison = rule.parameters.dailyHoursComparison ?? 'EXACT'
        const filter = rule.parameters.dayFilterType ?? 'ALL'
        if (comparison === 'MAX') {
          return t('settings:rules.logicExplanation.dailyShiftHoursMax', {
            hours,
            filter: t(`settings:rules.dayFiltersShort.${filter}`),
          })
        }
        if (comparison === 'MIN') {
          return t('settings:rules.logicExplanation.dailyShiftHoursMin', {
            hours,
            filter: t(`settings:rules.dayFiltersShort.${filter}`),
          })
        }
        return t('settings:rules.logicExplanation.dailyShiftHoursExact', {
          hours,
          filter: t(`settings:rules.dayFiltersShort.${filter}`),
        })
      }
      default:
        return ''
    }
  }

  return (
    <div
      data-testid="rules-management-view"
      className="flex-1 h-full overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col gap-6 max-w-[1500px] w-full mx-auto custom-scrollbar"
    >
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
            <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {t('settings:rules.title')}
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {t('settings:rules.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-xs transition-all shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{t('settings:rules.newRule')}</span>
          </button>
        </div>
      </div>

      {/* Educational Banner Explaining Severity vs Rules */}
      <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 rounded-2xl p-4 flex items-start gap-3.5 shadow-2xs">
        <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5">
          <Info className="w-4 h-4" />
        </div>
        <div className="space-y-1 text-xs">
          <h4 className="font-bold text-indigo-950 dark:text-indigo-200">
            {t('settings:rules.banner.title')}
          </h4>
          <p className="text-indigo-900/80 dark:text-indigo-300/80 leading-relaxed">
            {t('settings:rules.banner.description')}
          </p>
        </div>
      </div>

      {/* Search and Stats */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder={t('settings:rules.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs md:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 self-end sm:self-center">
          <span className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
            {t('settings:rules.totalRegistered', { count: shiftRules.length })}
          </span>
        </div>
      </div>

      {/* Rules List / Cards */}
      {filteredRules.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
          <ShieldCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm md:text-base font-bold text-slate-700 dark:text-slate-300">
            {searchQuery
              ? t('settings:rules.noSearchResults')
              : t('settings:rules.emptyTitle')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {!searchQuery && t('settings:rules.emptyDesc')}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition"
            >
              <Plus className="w-4 h-4" />
              <span>{t('settings:rules.newRule')}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SortableList
            items={filteredRules}
            layout="grid"
            getItemLabel={(rule) => rule.name}
            onReorder={(activeId, overId) =>
              handleReorder(sortedRules.map((item) => item.id), activeId, overId)
            }
            renderItem={(rule, dragHandle) => {
              const isError = rule.severity === 'ERROR'
              return (
                <div
                  className="h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between gap-4 transition hover:shadow-xs"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {dragHandle}
                        {/* Severity Badge */}
                        <span
                          title={
                            isError
                              ? t('settings:rules.severityDescriptions.ERROR')
                              : t('settings:rules.severityDescriptions.WARNING')
                          }
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border cursor-help ${
                            isError
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900/60'
                          }`}
                        >
                          {isError ? (
                            <ShieldAlert className="w-3 h-3 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                          )}
                          {isError
                            ? t('settings:rules.severities.ERROR')
                            : t('settings:rules.severities.WARNING')}
                        </span>

                        {/* Type Badge */}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          <Layers className="w-3 h-3 text-slate-400" />
                          {t(`settings:rules.types.${rule.type}`)}
                        </span>
                      </div>

                      {/* Default Active Badge */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                          rule.enabledByDefault
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {rule.enabledByDefault
                          ? t('common:status.defaultActive')
                          : t('common:status.defaultInactive')}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {rule.name}
                      </h3>
                      {rule.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {rule.description}
                        </p>
                      )}
                    </div>

                    {/* Trigger Criterion explanation */}
                    <div className="p-2.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-950 dark:text-indigo-300">
                        <HelpCircle className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>{t('settings:rules.logicExplanation.title')}</span>
                      </div>
                      <p className="text-[11px] text-indigo-900/80 dark:text-indigo-200/80 leading-snug">
                        {getRuleTriggerCriterion(rule)}
                      </p>
                    </div>

                    {/* Parameters Details */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      {rule.parameters.scope && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">
                            {t('settings:rules.scope')}:
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {t(`settings:rules.scopes.${rule.parameters.scope}`)}
                          </span>
                        </div>
                      )}

                      {rule.parameters.maxOccurrences !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">
                            {t('settings:rules.maxOccurrences')}:
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {rule.parameters.maxOccurrences}
                          </span>
                        </div>
                      )}

                      {rule.parameters.maxHours !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">
                            {t('settings:rules.maxHours')}:
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {t('settings:shifts.hoursBadge', { hours: rule.parameters.maxHours })}
                          </span>
                        </div>
                      )}

                      {rule.parameters.minRestHours !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">
                            {t('settings:rules.minRestHours')}:
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {t('settings:shifts.hoursBadge', { hours: rule.parameters.minRestHours })}
                          </span>
                        </div>
                      )}

                      {rule.parameters.consecutiveDaysLimit !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">
                            {t('settings:rules.consecutiveDaysLimit')}:
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {rule.parameters.consecutiveDaysLimit}
                          </span>
                        </div>
                      )}

                      {rule.parameters.maxPeople !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 font-medium">
                            {t('settings:rules.maxPeoplePerShift')}:
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {rule.parameters.maxPeople}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-slate-400 font-medium">
                          {t('settings:rules.targetShifts')}:
                        </span>
                        <div className="flex items-center gap-1 flex-wrap justify-end">
                          {!rule.parameters.targetShiftIds || rule.parameters.targetShiftIds.length === 0 ? (
                            <span className="text-[11px] text-slate-500 italic">
                              {t('settings:rules.allShiftsOption')}
                            </span>
                          ) : (
                            rule.parameters.targetShiftIds.map((sId) => {
                              const sDef = shiftDefinitions.find((s) => s.id === sId)
                              return (
                                <span
                                  key={sId}
                                  style={{
                                    backgroundColor: sDef?.color || '#64748B',
                                  }}
                                  className="px-1.5 py-0.5 rounded-sm text-[10px] font-bold text-white shadow-2xs"
                                >
                                  {sDef?.code || sId}
                                </span>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(rule)}
                      title={t('settings:rules.edit')}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => duplicateShiftRule(rule.id)}
                      title={t('settings:rules.duplicate')}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(rule.id)}
                      title={t('settings:rules.delete')}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            }}
          />
          </div>
        )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="modal-panel bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden flex flex-col transition-colors">
            <div className="modal-header flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-rose-50/60 dark:bg-rose-950/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 shadow-2xs">
                  <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {t('settings:rules.delete')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('settings:rules.deleteConfirm')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                title={t('common:actions.close')}
                aria-label={t('common:actions.close')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-footer px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                {t('settings:rules.cancel')}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 transition shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('settings:rules.delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="modal-panel bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full shadow-2xl">
            <div className="modal-header flex items-center justify-between px-6 pt-6 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingRule ? t('settings:rules.editRule') : t('settings:rules.newRule')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRule} data-testid="rule-form" className="modal-form">
              <div className="modal-body p-6 space-y-4 custom-scrollbar">
                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('settings:rules.name')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('settings:rules.namePlaceholder')}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {t('settings:rules.description')}
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('settings:rules.descriptionPlaceholder')}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                {/* Type and Severity Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Type */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('settings:rules.type')}
                    </label>
                    <Select
                      value={type}
                      onChange={(e) => setType(e.target.value as RuleType)}
                      className="w-full"
                    >
                      <option value="MAX_SHIFTS_PER_PERIOD">
                        {t('settings:rules.types.MAX_SHIFTS_PER_PERIOD')}
                      </option>
                      <option value="MAX_HOURS_PER_PERIOD">
                        {t('settings:rules.types.MAX_HOURS_PER_PERIOD')}
                      </option>
                      <option value="MIN_REST_HOURS">
                        {t('settings:rules.types.MIN_REST_HOURS')}
                      </option>
                      <option value="CONSECUTIVE_DAYS_LIMIT">
                        {t('settings:rules.types.CONSECUTIVE_DAYS_LIMIT')}
                      </option>
                      <option value="MAX_PEOPLE_PER_SHIFT">
                        {t('settings:rules.types.MAX_PEOPLE_PER_SHIFT')}
                      </option>
                      <option value="DAILY_SHIFT_HOURS">
                        {t('settings:rules.types.DAILY_SHIFT_HOURS')}
                      </option>
                    </Select>
                  </div>

                  {/* Severity */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('settings:rules.severity')}
                    </label>
                    <Select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as 'ERROR' | 'WARNING')}
                      className="w-full"
                    >
                      <option value="ERROR">{t('settings:rules.severitySelect.ERROR')}</option>
                      <option value="WARNING">{t('settings:rules.severitySelect.WARNING')}</option>
                    </Select>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                      {t(`settings:rules.severityDescriptions.${severity}`)}
                    </p>
                  </div>
                </div>

                {/* Conditional Parameter Inputs */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    {t('settings:rules.parametersTitle')}
                  </span>

                  {(type === 'MAX_SHIFTS_PER_PERIOD' || type === 'MAX_HOURS_PER_PERIOD') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          {t('settings:rules.scope')}
                        </label>
                        <Select
                          value={scope}
                          onChange={(e) => setScope(e.target.value as PeriodScope)}
                          className="w-full"
                        >
                          <option value="DAY">{t('settings:rules.scopes.DAY')}</option>
                          <option value="WEEK">{t('settings:rules.scopes.WEEK')}</option>
                          <option value="MONTH">{t('settings:rules.scopes.MONTH')}</option>
                        </Select>
                      </div>

                      {type === 'MAX_SHIFTS_PER_PERIOD' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {t('settings:rules.maxOccurrences')}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={maxOccurrences}
                            onChange={(e) => setMaxOccurrences(Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      )}

                      {type === 'MAX_HOURS_PER_PERIOD' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {t('settings:rules.maxHours')}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={720}
                            value={maxHours}
                            onChange={(e) => setMaxHours(Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {type === 'MIN_REST_HOURS' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t('settings:rules.minRestHours')}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={72}
                        value={minRestHours}
                        onChange={(e) => setMinRestHours(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  {type === 'CONSECUTIVE_DAYS_LIMIT' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t('settings:rules.consecutiveDaysLimit')}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={consecutiveDaysLimit}
                        onChange={(e) => setConsecutiveDaysLimit(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  {type === 'MAX_PEOPLE_PER_SHIFT' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        {t('settings:rules.maxPeoplePerShift')}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={maxPeople}
                        onChange={(e) => setMaxPeople(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  )}

                  {type === 'DAILY_SHIFT_HOURS' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {t('settings:rules.targetDailyHours')}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={72}
                            value={targetDailyHours}
                            onChange={(e) => setTargetDailyHours(Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            {t('settings:rules.dailyHoursComparison')}
                          </label>
                          <Select
                            value={dailyHoursComparison}
                            onChange={(e) => setDailyHoursComparison(e.target.value as DailyHoursComparison)}
                            className="w-full"
                          >
                            <option value="EXACT">{t('settings:rules.comparisons.EXACT')}</option>
                            <option value="MAX">{t('settings:rules.comparisons.MAX')}</option>
                            <option value="MIN">{t('settings:rules.comparisons.MIN')}</option>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                          {t('settings:rules.dayFilterType')}
                        </label>
                        <Select
                          value={dayFilterType}
                          onChange={(e) => setDayFilterType(e.target.value as DayFilterType)}
                          className="w-full"
                        >
                          <option value="ALL">{t('settings:rules.dayFilters.ALL')}</option>
                          <option value="WEEKDAYS">{t('settings:rules.dayFilters.WEEKDAYS')}</option>
                          <option value="WEEKENDS">{t('settings:rules.dayFilters.WEEKENDS')}</option>
                          <option value="SPECIFIC_DAYS">{t('settings:rules.dayFilters.SPECIFIC_DAYS')}</option>
                        </Select>
                      </div>

                      {dayFilterType === 'SPECIFIC_DAYS' && (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                            {t('settings:rules.daysOfWeekTitle')}
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { idx: 0, label: t('settings:rules.daysOfWeek.0') },
                              { idx: 1, label: t('settings:rules.daysOfWeek.1') },
                              { idx: 2, label: t('settings:rules.daysOfWeek.2') },
                              { idx: 3, label: t('settings:rules.daysOfWeek.3') },
                              { idx: 4, label: t('settings:rules.daysOfWeek.4') },
                              { idx: 5, label: t('settings:rules.daysOfWeek.5') },
                              { idx: 6, label: t('settings:rules.daysOfWeek.6') },
                            ].map(({ idx, label }) => {
                              const isSelected = specificDaysOfWeek.includes(idx)
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    setSpecificDaysOfWeek((prev) =>
                                      prev.includes(idx)
                                        ? prev.filter((d) => d !== idx)
                                        : [...prev, idx]
                                    )
                                  }}
                                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                  }`}
                                >
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Target Shifts Filter */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {t('settings:rules.targetShifts')}
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                      {t('settings:rules.allShiftsOption')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {shiftDefinitions.map((shift) => {
                        const isSelected = targetShiftIds.includes(shift.id)
                        return (
                          <button
                            key={shift.id}
                            type="button"
                            onClick={() => handleToggleTargetShift(shift.id)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                              isSelected
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-700 shadow-2xs'
                                : 'bg-white text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span
                              style={{ backgroundColor: shift.color }}
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                            />
                            <span>{shift.name} ({shift.code})</span>
                            {isSelected && <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Enabled By Default Toggle */}
                <div className="flex items-start justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="space-y-0.5">
                    <label
                      htmlFor="ruleEnabledByDefault"
                      className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                    >
                      {t('settings:rules.enabledByDefault')}
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t('settings:rules.enabledByDefaultDesc')}
                    </p>
                  </div>
                  <input
                    id="ruleEnabledByDefault"
                    type="checkbox"
                    checked={enabledByDefault}
                    onChange={(e) => setEnabledByDefault(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded-sm text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                  />
                </div>

              </div>

              {/* Modal Buttons */}
              <div className="modal-footer flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  {t('settings:rules.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-xs transition"
                >
                  {editingRule ? t('settings:rules.save') : t('settings:rules.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
