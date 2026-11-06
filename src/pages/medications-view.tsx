import { format, parseISO } from 'date-fns'
import {
  Calendar,
  ChevronRight,
  Clock,
  History,
  Maximize2,
  Minimize2,
  Pencil,
  Pill,
  Plus,
  Printer,
  RotateCcw,
  Sparkles,
  Trash2,
  User as UserIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '../components/common/confirm-dialog'
import { MedicationVersionForm } from '../components/medications/medication-version-form'
import { MedicationVersionNotes } from '../components/medications/medication-version-notes'
import { Select } from '../components/ui/select'
import { useScheduleStore } from '../store/use-schedule-store'
import { cn } from '../utils/cn'
import {
  getCurrentMedicationVersion,
  getMedicationFileBaseName,
  getMedicationSpecialties,
  getMedicationVersionHistory,
  groupMedicationsBySource,
  matchesMedicationSpecialty,
  sortMedicationVersions,
} from '../utils/medication-schedule-utils'

import type { MedicationScheduleVersion } from '../types'
import type { MedicationVersionChange } from '../utils/medication-schedule-utils'

const DATE_FORMAT_PT = 'dd/MM/yyyy'
const DATE_FORMAT_EN = 'MM/dd/yyyy'

function formatDisplayDate(dateStr: string, language: string): string {
  try {
    const isEn = language?.toLowerCase().startsWith('en')
    const date = parseISO(dateStr)
    return format(date, isEn ? DATE_FORMAT_EN : DATE_FORMAT_PT)
  } catch {
    return dateStr
  }
}

export function MedicationsView() {
  const { t, i18n } = useTranslation(['medications', 'common'])
  const { medicationVersions, deleteLatestMedicationVersion } = useScheduleStore()

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [specialtyKey, setSpecialtyKey] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'NEW' | 'CORRECTION'>('NEW')
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isTableFullscreen, setIsTableFullscreen] = useState(false)

  useEffect(() => {
    if (!isTableFullscreen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsTableFullscreen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isTableFullscreen])

  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])

  const currentVersion = useMemo(
    () => getCurrentMedicationVersion(medicationVersions, today),
    [medicationVersions, today],
  )

  const sortedVersions = useMemo(
    () => sortMedicationVersions(medicationVersions),
    [medicationVersions],
  )

  const displayedVersion: MedicationScheduleVersion | undefined = useMemo(() => {
    if (selectedVersionId) {
      return medicationVersions.find((v) => v.id === selectedVersionId)
    }
    return currentVersion
  }, [selectedVersionId, medicationVersions, currentVersion])

  const specialties = displayedVersion
    ? getMedicationSpecialties(displayedVersion)
    : []
  const activeSpecialtyKey = specialties.some((s) => s.key === specialtyKey)
    ? specialtyKey
    : ''

  const latestVersion = sortedVersions[sortedVersions.length - 1]
  const isLatestVersion = Boolean(
    displayedVersion && latestVersion && displayedVersion.id === latestVersion.id,
  )

  const isViewingHistorical = Boolean(
    displayedVersion && currentVersion && displayedVersion.id !== currentVersion.id,
  )

  const sourceGroups = useMemo(
    () => (displayedVersion ? groupMedicationsBySource(displayedVersion) : []),
    [displayedVersion],
  )

  const history = useMemo(
    () => getMedicationVersionHistory(medicationVersions),
    [medicationVersions],
  )

  const printHistory = useMemo(() => {
    if (!displayedVersion) return []
    const idx = history.findIndex((h) => h.version.id === displayedVersion.id)
    return idx >= 0 ? history.slice(idx) : []
  }, [history, displayedVersion])

  const handleBackToCurrent = () => {
    setSelectedVersionId(null)
  }

  const handlePrint = () => {
    if (!displayedVersion) return
    const originalTitle = document.title
    document.title = getMedicationFileBaseName(
      displayedVersion.effectiveDate,
      i18n.language,
    )
    window.print()
    document.title = originalTitle
  }

  const renderChangeSummary = (change: MedicationVersionChange): string => {
    switch (change.type) {
      case 'MEDICATION_ADDED':
        return t('medications:changes.MEDICATION_ADDED', {
          medicationName: change.name,
        })
      case 'MEDICATION_REMOVED':
        return t('medications:changes.MEDICATION_REMOVED', {
          medicationName: change.name,
        })
      case 'MEDICATION_RENAMED':
        return t('medications:changes.MEDICATION_RENAMED', {
          before: change.from,
          after: change.to,
        })
      case 'DOSAGE_CHANGED':
        return t('medications:changes.DOSAGE_CHANGED', {
          medicationName: change.name,
          before: change.from || '—',
          after: change.to || '—',
        })
      case 'SOURCE_CHANGED':
        return t('medications:changes.SOURCE_CHANGED', {
          medicationName: change.name,
          before: change.from || '—',
          after: change.to || '—',
        })
      case 'RESPONSIBLE_CHANGED':
        return t('medications:changes.RESPONSIBLE_CHANGED', {
          medicationName: change.name,
          before: change.from || '—',
          after: change.to || '—',
        })
      case 'SPECIALTY_CHANGED':
        return t('medications:changes.SPECIALTY_CHANGED', {
          medicationName: change.name,
          before: change.from || '—',
          after: change.to || '—',
        })
      case 'TIME_ADDED':
        return t('medications:changes.TIME_ADDED', { time: change.time })
      case 'TIME_REMOVED':
        return t('medications:changes.TIME_REMOVED', { time: change.time })
      case 'DOSE_CHANGED':
        if (!change.from && change.to) {
          return t('medications:changes.DOSE_ADDED', {
            time: change.time,
            medicationName: change.name,
            after: change.to,
          })
        }
        if (change.from && !change.to) {
          return t('medications:changes.DOSE_REMOVED', {
            time: change.time,
            medicationName: change.name,
            before: change.from,
          })
        }
        return t('medications:changes.DOSE_CHANGED', {
          time: change.time,
          medicationName: change.name,
          before: change.from || '—',
          after: change.to || '—',
        })
      default:
        return ''
    }
  }

  return (
    <div
      data-testid="medications-view"
      className="flex-1 h-full overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col gap-6 max-w-[1500px] w-full mx-auto custom-scrollbar"
    >
      <div className="print:hidden flex flex-col gap-6 w-full">
        {/* 1. Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
              <Pill className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                {t('medications:title')}
              </h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {t('medications:subtitle')}
              </p>
            </div>
          </div>

          {medicationVersions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                data-testid="medications-print-button"
                onClick={handlePrint}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition cursor-pointer shrink-0"
              >
              <Printer className="w-4 h-4" />
              <span>{t('medications:printSchedule')}</span>
            </button>

            <button
              type="button"
              data-testid="medications-new-version-button"
              onClick={() => {
                setFormMode('NEW')
                setIsFormOpen(true)
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-xs transition cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>{t('medications:newVersion')}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Empty State */}
      {medicationVersions.length === 0 && (
        <div
          data-testid="medications-empty-state"
          className="flex flex-col items-center justify-center text-center p-8 sm:p-12 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl"
        >
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
            <Pill className="w-8 h-8" />
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
            {t('medications:emptyTitle')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-1.5 mb-6">
            {t('medications:emptyDescription')}
          </p>
          <button
            type="button"
            data-testid="medications-create-first-button"
            onClick={() => {
              setFormMode('NEW')
              setIsFormOpen(true)
            }}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{t('medications:createFirstVersion')}</span>
          </button>
        </div>
      )}

      {/* Version content */}
      {medicationVersions.length > 0 && (
        <>
          {/* 3. Schedule: version status, version select, specialty filter and table */}
          <div
            data-testid="medications-schedule-card"
            className={cn(
              'bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col',
              isTableFullscreen &&
                'fixed inset-0 z-120 rounded-none md:rounded-none border-0',
            )}
          >
            <div className="shrink-0 p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    {t('medications:scheduleTableTitle')}
                  </h2>
                </div>
                {isViewingHistorical ? (
                  <span
                    data-testid="medications-viewing-historical-badge"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                  >
                    <History className="w-3.5 h-3.5" />
                    {t('medications:viewingHistoricalBadge')}
                  </span>
                ) : (
                  <span
                    data-testid="medications-current-badge"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {t('medications:currentVersionBadge')}
                  </span>
                )}

                {isViewingHistorical && (
                  <button
                    type="button"
                    data-testid="medications-back-to-current"
                    onClick={handleBackToCurrent}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('medications:backToCurrent')}</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-end md:items-center gap-3">
                {/* Version Select */}
                <div className="flex items-center gap-2 mobile:flex-1 mobile:min-w-0 mobile:flex-col mobile:items-stretch">
                  <label
                    htmlFor="medications-version-select"
                    className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0"
                  >
                    {t('medications:versionSelectLabel')}:
                  </label>
                  <div className="w-64 mobile:w-full">
                    <Select
                      id="medications-version-select"
                      data-testid="medications-version-select"
                      value={displayedVersion?.id ?? ''}
                      className="w-full"
                      onValueChange={setSelectedVersionId}
                    >
                      {history.map(({ version }) => (
                        <option key={version.id} value={version.id}>
                          {[
                            formatDisplayDate(version.effectiveDate, i18n.language),
                            version.professional,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {/* Specialty Filter */}
                {specialties.length > 0 && (
                  <div className="flex items-center gap-2 mobile:order-last mobile:basis-full mobile:flex-col mobile:items-stretch">
                    <label
                      htmlFor="medications-specialty-filter"
                      className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0"
                    >
                      {t('medications:specialtyFilterLabel')}:
                    </label>
                    <div className="w-56 mobile:w-full">
                      <Select
                        id="medications-specialty-filter"
                        data-testid="medications-specialty-filter"
                        value={activeSpecialtyKey}
                        className="w-full"
                        onValueChange={setSpecialtyKey}
                      >
                        <option value="">{t('medications:allSpecialties')}</option>
                        {specialties.map((specialty) => (
                          <option key={specialty.key} value={specialty.key}>
                            {specialty.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                )}

                {displayedVersion && (
                  <button
                    type="button"
                    data-testid="medications-fullscreen-toggle"
                    onClick={() => setIsTableFullscreen((prev) => !prev)}
                    title={t(
                      isTableFullscreen
                        ? 'medications:exitFullscreen'
                        : 'medications:enterFullscreen',
                    )}
                    aria-label={t(
                      isTableFullscreen
                        ? 'medications:exitFullscreen'
                        : 'medications:enterFullscreen',
                    )}
                    className="shrink-0 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    {isTableFullscreen ? (
                      <Minimize2 className="w-4 h-4" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {displayedVersion && (
                  <div
                    data-testid="medications-table-scroll-container"
                    className={cn(
                      'overflow-x-auto custom-scrollbar',
                      isTableFullscreen && 'flex-1 overflow-y-auto',
                    )}
                  >
                    <table
                      data-testid="medications-schedule-table"
                      className="w-full text-left border-collapse"
                    >
                      <thead>
                        <tr className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                          <th className="p-3.5 sm:p-4 min-w-[100px] sticky left-0 z-10 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-800">
                            {t('medications:timeColumn')}
                          </th>
                          {displayedVersion.medications.map((med) => (
                            <th
                              key={med.id}
                              data-testid={`medication-col-header-${med.id}`}
                              data-highlighted={
                                matchesMedicationSpecialty(med, activeSpecialtyKey) || undefined
                              }
                              className="p-3.5 sm:p-4 min-w-[180px] max-w-[240px] border-r border-slate-200/70 dark:border-slate-800 last:border-r-0 align-top data-highlighted:bg-emerald-100 dark:data-highlighted:bg-emerald-950/70"
                            >
                              <div className="flex flex-col items-start gap-1.5">
                                <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                                  {med.name}
                                  {med.dosage && (
                                    <span
                                      data-testid={`medication-col-dosage-${med.id}`}
                                      className="ml-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400"
                                    >
                                      {med.dosage}
                                    </span>
                                  )}
                                </span>
                                {med.specialty && (
                                  <span
                                    data-testid={`medication-col-specialty-${med.id}`}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                                  >
                                    {med.specialty}
                                  </span>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm sm:text-base">
                        {displayedVersion.times.map((time) => (
                          <tr
                            key={time}
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="p-3.5 sm:p-4 font-bold text-slate-900 dark:text-white sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
                              {time}
                            </td>
                            {displayedVersion.medications.map((med) => {
                              const dose = displayedVersion.doses[med.id]?.[time]
                              return (
                                <td
                                  key={med.id}
                                  data-testid={`medication-dose-cell-${med.id}-${time}`}
                                  data-highlighted={
                                    matchesMedicationSpecialty(med, activeSpecialtyKey) || undefined
                                  }
                                  className="p-3.5 sm:p-4 border-r border-slate-100 dark:border-slate-800/80 last:border-r-0 font-medium text-slate-700 dark:text-slate-300 text-center align-middle data-highlighted:bg-emerald-50 dark:data-highlighted:bg-emerald-950/40"
                                >
                                  {dose?.trim() && (
                                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-semibold inline-block">
                                      {dose}
                                    </span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
            )}
          </div>

          {/* 4. Displayed Version Summary */}
          {displayedVersion && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    {t('medications:effectiveSince', {
                      date: formatDisplayDate(displayedVersion.effectiveDate, i18n.language),
                    })}
                  </span>
                  {displayedVersion.professional && (
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                      <UserIcon className="w-4 h-4 text-indigo-500" />
                      {t('medications:prescribedBy', {
                        professional: displayedVersion.professional,
                      })}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="medications-edit-version-button"
                    onClick={() => {
                      setFormMode('CORRECTION')
                      setIsFormOpen(true)
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>{t('medications:editVersion')}</span>
                  </button>

                  {isLatestVersion && (
                    <button
                      type="button"
                      data-testid="medications-delete-version-button"
                      onClick={() => setIsDeleteDialogOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{t('medications:deleteLatestVersion')}</span>
                    </button>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">
                  {t('medications:explanationLabel')}
                </span>
                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                  {displayedVersion.explanation}
                </p>
              </div>
            </div>
          )}

          {/* 6. Medications Grouped by Source */}
          {displayedVersion && (
            <div
              data-testid="medications-by-source"
              className="bg-white dark:bg-slate-900 p-5 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col gap-4"
            >
              <div className="flex items-center gap-2.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {t('medications:bySourceTitle')}
                </h3>
                <span className="text-xs text-slate-400 font-normal">
                  ({t('medications:bySourceSubtitle')})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {sourceGroups.map((group, groupIdx) => (
                  <div
                    key={`${group.source || 'nosource'}-${groupIdx}`}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col gap-2.5"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        {group.source || t('medications:noSourceGroup')}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {group.medications.length}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {group.medications.map((m) => (
                        <li
                          key={m.id}
                          className="text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between gap-2"
                        >
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {m.name}
                          </span>
                          {m.dosage && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium shrink-0">
                              {m.dosage}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. Version History */}
          <div
            data-testid="medications-version-history"
            className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {t('medications:historyTitle')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('medications:historySubtitle')}
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {history.map((entry) => {
                const isSelected = displayedVersion?.id === entry.version.id
                return (
                  <div
                    key={entry.version.id}
                    data-testid={`medication-history-item-${entry.version.id}`}
                    className={`py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-3.5 transition-colors ${
                      isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20 px-3 rounded-xl' : ''
                    }`}
                  >
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-extrabold text-slate-900 dark:text-white">
                          {formatDisplayDate(entry.version.effectiveDate, i18n.language)}
                        </span>
                        {entry.version.professional && (
                          <>
                            <span className="text-slate-400">•</span>
                            <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                              {entry.version.professional}
                            </span>
                          </>
                        )}
                        {entry.version.id === currentVersion?.id && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                            {t('medications:currentVersionBadge')}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {entry.version.explanation}
                      </p>

                      <MedicationVersionNotes notes={entry.version.notes} />

                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {entry.changes.length === 0 ? (
                          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 italic">
                            {t('medications:initialVersionSummary')}
                          </span>
                        ) : (
                          entry.changes.map((change, chIdx) => (
                            <span
                              key={`${change.type}-${chIdx}`}
                              className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            >
                              {renderChangeSummary(change)}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        data-testid={`medication-select-version-${entry.version.id}`}
                        onClick={() => setSelectedVersionId(entry.version.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span>
                          {isSelected
                            ? t('medications:viewingNow')
                            : t('medications:viewThisVersion')}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
      </div>

      {/* 8. Print Sheet (Rendered only for window.print, hidden on screen) */}
      {displayedVersion && createPortal(
        <div
          id="medication-print-sheet"
          data-testid="medication-print-sheet"
          className="hidden print:block w-full bg-white text-slate-900 p-6"
        >
          {/* Page 1: Header + Schedule Table (No professional in header) */}
          <div data-testid="medication-print-page-1" className="space-y-4">
            <div className="border-b border-slate-300 pb-3">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {t('medications:print.sheetTitle')}
              </h1>
              <p className="text-sm font-semibold text-slate-600 mt-1">
                {t('medications:print.effectiveDate', {
                  date: formatDisplayDate(displayedVersion.effectiveDate, i18n.language),
                })}
              </p>
            </div>

            <table
              data-testid="medication-print-table"
              className="w-full text-left border-collapse border border-slate-300"
            >
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-xs font-bold text-slate-900">
                  <th className="p-3 border border-slate-300 w-[100px]">
                    {t('medications:timeColumn')}
                  </th>
                  {displayedVersion.medications.map((med) => (
                    <th
                      key={med.id}
                      className="p-3 border border-slate-300 align-top"
                    >
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-extrabold text-sm text-slate-900">
                          {med.name}
                          {med.dosage && (
                            <span className="ml-1.5 text-[11px] font-semibold text-slate-700">
                              {med.dosage}
                            </span>
                          )}
                        </span>
                        {med.specialty && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-slate-700 border border-slate-400">
                            {med.specialty}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {displayedVersion.times.map((time) => (
                  <tr key={time}>
                    <td className="p-3 border border-slate-300 font-bold text-slate-900">
                      {time}
                    </td>
                    {displayedVersion.medications.map((med) => {
                      const dose = displayedVersion.doses[med.id]?.[time]
                      return (
                        <td
                          key={med.id}
                          className="p-3 border border-slate-300 font-medium text-slate-800 text-center"
                        >
                          {dose?.trim() && <span>{dose}</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Page 2: Sources and Changes (Page break before) */}
          <div
            data-testid="medication-print-page-2"
            className="print-page-break-before mt-8 pt-6 border-t border-slate-300 space-y-6"
          >
            <div data-testid="medication-print-sources">
              <h2 className="text-xl font-black text-slate-900 mb-3">
                {t('medications:bySourceTitle')}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {sourceGroups.map((group, groupIdx) => (
                  <div
                    key={`${group.source || 'nosource'}-${groupIdx}`}
                    className="break-inside-avoid p-3 rounded-lg border border-slate-300 text-xs"
                  >
                    <h3 className="font-extrabold text-slate-900 pb-1.5 mb-1.5 border-b border-slate-200">
                      {group.source || t('medications:noSourceGroup')}
                    </h3>
                    <ul className="space-y-1">
                      {group.medications.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center justify-between gap-2 text-slate-800"
                        >
                          <span className="font-semibold">{m.name}</span>
                          {m.dosage && (
                            <span className="text-[11px] text-slate-600 shrink-0">
                              {m.dosage}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div data-testid="medication-print-changes">
              <div className="mb-4">
                <h2 className="text-xl font-black text-slate-900">
                  {t('medications:print.changesTitle')}
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  {t('medications:print.changesSubtitle')}
                </p>
              </div>

              <div className="divide-y divide-slate-200 space-y-3">
                {printHistory.map((entry) => (
                  <div
                    key={entry.version.id}
                    className="pt-3 first:pt-0 flex flex-col gap-1 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-slate-900">
                        {formatDisplayDate(entry.version.effectiveDate, i18n.language)}
                      </span>
                      {entry.version.professional && (
                        <>
                          <span className="text-slate-400">•</span>
                          <span className="font-semibold text-slate-800">
                            {entry.version.professional}
                          </span>
                        </>
                      )}
                    </div>

                    <p className="text-slate-700 italic">
                      {entry.version.explanation}
                    </p>

                    <MedicationVersionNotes
                      notes={entry.version.notes}
                      printable
                    />

                    <div className="mt-1 flex flex-wrap gap-1">
                      {entry.changes.length === 0 ? (
                        <span className="text-[11px] font-medium text-slate-500">
                          {t('medications:initialVersionSummary')}
                        </span>
                      ) : (
                        entry.changes.map((change, chIdx) => (
                          <span
                            key={`${change.type}-${chIdx}`}
                            className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200"
                          >
                            {renderChangeSummary(change)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {isFormOpen && (
        <MedicationVersionForm
          mode={formMode}
          baseVersion={formMode === 'NEW' ? currentVersion : undefined}
          version={formMode === 'CORRECTION' ? displayedVersion : undefined}
          onClose={() => setIsFormOpen(false)}
        />
      )}

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title={t('medications:deleteConfirm.title')}
        description={
          displayedVersion
            ? t(
                displayedVersion.professional
                  ? 'medications:deleteConfirm.message'
                  : 'medications:deleteConfirm.messageNoProfessional',
                {
                  date: formatDisplayDate(displayedVersion.effectiveDate, i18n.language),
                  professional: displayedVersion.professional,
                },
              )
            : ''
        }
        confirmLabel={t('medications:deleteConfirm.confirm')}
        cancelLabel={t('medications:deleteConfirm.cancel')}
        variant="danger"
        isBusy={isDeleting}
        onConfirm={async () => {
          setIsDeleting(true)
          try {
            await deleteLatestMedicationVersion()
            setIsDeleteDialogOpen(false)
            setSelectedVersionId(null)
          } finally {
            setIsDeleting(false)
          }
        }}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </div>
  )
}
