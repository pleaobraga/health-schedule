import {
  AlertCircle,
  Clock,
  Pill,
  Plus,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { useScheduleStore } from '../../store/use-schedule-store'
import {
  createMedicationId,
  searchMedicationProfessionals,
} from '../../utils/medication-schedule-utils'
import { DatePicker } from '../ui/date-picker'

import type {
  MedicationColumn,
  MedicationScheduleVersion,
  MedicationVersionInput,
} from '../../types'
import type { MedicationValidationError } from '../../utils/medication-schedule-utils'

export interface MedicationVersionFormProps {
  mode: 'NEW' | 'CORRECTION'
  baseVersion?: MedicationScheduleVersion
  version?: MedicationScheduleVersion
  onClose: () => void
}

export function MedicationVersionForm({
  mode,
  baseVersion,
  version,
  onClose,
}: MedicationVersionFormProps) {
  const { t } = useTranslation(['medications', 'common'])
  const { medicationVersions, addMedicationVersion, updateMedicationVersion } =
    useScheduleStore()

  const [effectiveDate, setEffectiveDate] = useState<string>(() =>
    mode === 'CORRECTION' && version ? version.effectiveDate : '',
  )
  const [professional, setProfessional] = useState<string>(() =>
    mode === 'CORRECTION' && version ? version.professional : '',
  )
  const [explanation, setExplanation] = useState<string>(() =>
    mode === 'CORRECTION' && version ? version.explanation : '',
  )
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false)

  const [medications, setMedications] = useState<MedicationColumn[]>(() => {
    if (mode === 'CORRECTION' && version) {
      return structuredClone(version.medications)
    }
    if (mode === 'NEW' && baseVersion) {
      return structuredClone(baseVersion.medications)
    }
    return []
  })

  const [times, setTimes] = useState<string[]>(() => {
    if (mode === 'CORRECTION' && version) {
      return [...version.times]
    }
    if (mode === 'NEW' && baseVersion) {
      return [...baseVersion.times]
    }
    return []
  })

  const [doses, setDoses] = useState<Record<string, Record<string, string>>>(
    () => {
      if (mode === 'CORRECTION' && version) {
        return structuredClone(version.doses)
      }
      if (mode === 'NEW' && baseVersion) {
        return structuredClone(baseVersion.doses)
      }
      return {}
    },
  )

  const [errors, setErrors] = useState<MedicationValidationError[]>([])
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  const profSuggestions = useMemo(() => {
    if (professional.trim().length < 3) return []
    return searchMedicationProfessionals(professional, medicationVersions)
  }, [professional, medicationVersions])

  const clearErrors = () => {
    if (errors.length > 0) {
      setErrors([])
    }
  }

  const handleAddMedication = () => {
    const newMed: MedicationColumn = {
      id: createMedicationId(),
      name: '',
      dosage: '',
      source: '',
      responsible: '',
    }
    setMedications((prev) => [...prev, newMed])
    clearErrors()
  }

  const handleRemoveMedication = (id: string) => {
    setMedications((prev) => prev.filter((m) => m.id !== id))
    setDoses((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    clearErrors()
  }

  const handleUpdateMedication = (
    id: string,
    field: keyof MedicationColumn,
    val: string,
  ) => {
    setMedications((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: val } : m)),
    )
    clearErrors()
  }

  const handleAddTime = () => {
    setTimes((prev) => [...prev, ''])
    clearErrors()
  }

  const handleRemoveTime = (timeToRemove: string) => {
    setTimes((prev) => prev.filter((t) => t !== timeToRemove))
    setDoses((prev) => {
      const next: Record<string, Record<string, string>> = {}
      for (const [medId, timeMap] of Object.entries(prev)) {
        next[medId] = { ...timeMap }
        delete next[medId][timeToRemove]
      }
      return next
    })
    clearErrors()
  }

  const handleUpdateTime = (index: number, newTime: string) => {
    const oldTime = times[index]
    setTimes((prev) => prev.map((t, idx) => (idx === index ? newTime : t)))

    if (oldTime && oldTime !== newTime) {
      setDoses((prev) => {
        const next: Record<string, Record<string, string>> = {}
        for (const [medId, timeMap] of Object.entries(prev)) {
          next[medId] = { ...timeMap }
          if (oldTime in next[medId]) {
            next[medId][newTime] = next[medId][oldTime]
            delete next[medId][oldTime]
          }
        }
        return next
      })
    }
    clearErrors()
  }

  const handleUpdateDose = (medId: string, time: string, doseText: string) => {
    setDoses((prev) => ({
      ...prev,
      [medId]: {
        ...(prev[medId] || {}),
        [time]: doseText,
      },
    }))
    clearErrors()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    const input: MedicationVersionInput = {
      effectiveDate,
      professional,
      explanation,
      medications,
      times,
      doses,
    }

    setIsSubmitting(true)
    try {
      if (mode === 'NEW') {
        const result = await addMedicationVersion(input)
        if (!result.ok) {
          setErrors(result.errors)
          return
        }
        onClose()
      } else if (mode === 'CORRECTION') {
        if (!version) return
        const result = await updateMedicationVersion(version.id, input)
        if (!result.ok) {
          setErrors(result.errors)
          return
        }
        onClose()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasDateError = Boolean(errors.find((e) => e.code.startsWith('DATE_')))
  const hasProfError = Boolean(
    errors.find((e) => e.code === 'PROFESSIONAL_REQUIRED'),
  )
  const hasExplError = Boolean(
    errors.find((e) => e.code === 'EXPLANATION_REQUIRED'),
  )

  const isMedNameInvalid = (medId: string) =>
    Boolean(
      errors.find(
        (e) =>
          (e.code === 'MEDICATION_NAME_REQUIRED' ||
            e.code === 'DUPLICATE_MEDICATION') &&
          (!e.medicationId || e.medicationId === medId),
      ),
    )

  const isTimeInvalid = (timeStr: string) =>
    Boolean(
      errors.find(
        (e) =>
          (e.code === 'TIME_INVALID' ||
            e.code === 'DUPLICATE_TIME' ||
            e.code === 'TIME_REQUIRED') &&
          (!e.time || e.time === timeStr),
      ),
    )

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="medication-form-title"
      data-testid="medication-version-form-modal"
      className="modal-overlay fixed inset-0 z-120 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn"
    >
      <div className="modal-panel bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] transition-colors">
        {/* Header */}
        <div className="modal-header flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <Pill className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3
                id="medication-form-title"
                className="text-base font-bold text-slate-900 dark:text-white truncate"
              >
                {mode === 'NEW'
                  ? t('medications:form.newTitle')
                  : t('medications:form.correctionTitle')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {mode === 'NEW'
                  ? t('medications:form.newSubtitle')
                  : t('medications:form.correctionSubtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title={t('common:actions.close')}
            aria-label={t('common:actions.close')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="modal-form flex flex-col flex-1 min-h-0"
        >
          <div className="modal-body p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
            {/* Error Banner */}
            {errors.length > 0 && (
              <div
                data-testid="medication-form-errors"
                className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 space-y-1.5"
              >
                {errors.map((err, idx) => (
                  <div
                    key={`${err.code}-${err.medicationId || ''}-${err.time || ''}-${idx}`}
                    data-testid={`medication-error-${err.code}`}
                    className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{t(`medications:errors.${err.code}`)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Version Metadata Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="medication-form-effective-date-input"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('medications:form.effectiveDate')}
                </label>
                <DatePicker
                  id="medication-form-effective-date-input"
                  data-testid="medication-form-effective-date-input"
                  value={effectiveDate}
                  invalid={hasDateError}
                  placeholder={t('medications:form.effectiveDatePlaceholder')}
                  onChange={(val) => {
                    setEffectiveDate(val)
                    clearErrors()
                  }}
                />
              </div>

              <div className="relative">
                <label
                  htmlFor="medication-form-professional-input"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('medications:form.professional')}
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="medication-form-professional-input"
                    data-testid="medication-form-professional-input"
                    type="text"
                    required
                    aria-invalid={hasProfError}
                    value={professional}
                    onChange={(e) => {
                      setProfessional(e.target.value)
                      setShowSuggestions(true)
                      clearErrors()
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder={t('medications:form.professionalPlaceholder')}
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                </div>

                {/* Autocomplete Suggestions */}
                {showSuggestions && profSuggestions.length > 0 && (
                  <div
                    data-testid="medication-prof-suggestions-list"
                    className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-1.5 space-y-1 max-h-40 overflow-y-auto"
                  >
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-2 py-0.5 block">
                      {t('medications:form.professionalSuggestions')}
                    </span>
                    {profSuggestions.map((sug, sIdx) => (
                      <button
                        key={`${sug}-${sIdx}`}
                        type="button"
                        data-testid={`medication-prof-suggestion-${sIdx}`}
                        onClick={() => {
                          setProfessional(sug)
                          setShowSuggestions(false)
                          clearErrors()
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-600 transition"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Explanation Field */}
            <div>
              <label
                htmlFor="medication-form-explanation-input"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                {t('medications:form.explanation')}
              </label>
              <textarea
                id="medication-form-explanation-input"
                data-testid="medication-form-explanation-input"
                required
                rows={2}
                aria-invalid={hasExplError}
                value={explanation}
                onChange={(e) => {
                  setExplanation(e.target.value)
                  clearErrors()
                }}
                placeholder={t('medications:form.explanationPlaceholder')}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
              />
            </div>

            {/* 2. Medications Columns Section */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('medications:form.medicationsSection')}
                </h4>
                <button
                  type="button"
                  data-testid="medication-add-column-button"
                  onClick={handleAddMedication}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('medications:form.addMedication')}</span>
                </button>
              </div>

              {medications.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  {t('medications:errors.MEDICATION_REQUIRED')}
                </p>
              ) : (
                <div className="space-y-3">
                  {medications.map((med, idx) => (
                    <div
                      key={med.id}
                      data-testid={`medication-column-row-${idx}`}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 flex-1 w-full">
                        <div>
                          <label
                            htmlFor={`medication-name-input-${idx}`}
                            className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1"
                          >
                            {t('medications:form.medicationName')}
                          </label>
                          <input
                            id={`medication-name-input-${idx}`}
                            data-testid={`medication-name-input-${idx}`}
                            type="text"
                            required
                            aria-invalid={isMedNameInvalid(med.id)}
                            value={med.name}
                            onChange={(e) =>
                              handleUpdateMedication(
                                med.id,
                                'name',
                                e.target.value,
                              )
                            }
                            placeholder={t(
                              'medications:form.medicationNamePlaceholder',
                            )}
                            className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`medication-dosage-input-${idx}`}
                            className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1"
                          >
                            {t('medications:form.medicationDosage')}
                          </label>
                          <input
                            id={`medication-dosage-input-${idx}`}
                            data-testid={`medication-dosage-input-${idx}`}
                            type="text"
                            value={med.dosage ?? ''}
                            onChange={(e) =>
                              handleUpdateMedication(
                                med.id,
                                'dosage',
                                e.target.value,
                              )
                            }
                            placeholder={t(
                              'medications:form.medicationDosagePlaceholder',
                            )}
                            className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`medication-source-input-${idx}`}
                            className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1"
                          >
                            {t('medications:form.medicationSource')}
                          </label>
                          <input
                            id={`medication-source-input-${idx}`}
                            data-testid={`medication-source-input-${idx}`}
                            type="text"
                            value={med.source ?? ''}
                            onChange={(e) =>
                              handleUpdateMedication(
                                med.id,
                                'source',
                                e.target.value,
                              )
                            }
                            placeholder={t(
                              'medications:form.medicationSourcePlaceholder',
                            )}
                            className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`medication-responsible-input-${idx}`}
                            className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1"
                          >
                            {t('medications:form.medicationResponsible')}
                          </label>
                          <input
                            id={`medication-responsible-input-${idx}`}
                            data-testid={`medication-responsible-input-${idx}`}
                            type="text"
                            value={med.responsible ?? ''}
                            onChange={(e) =>
                              handleUpdateMedication(
                                med.id,
                                'responsible',
                                e.target.value,
                              )
                            }
                            placeholder={t(
                              'medications:form.medicationResponsiblePlaceholder',
                            )}
                            className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        data-testid={`medication-remove-column-${idx}`}
                        onClick={() => handleRemoveMedication(med.id)}
                        title={t('medications:form.removeMedication', {
                          name: med.name || `#${idx + 1}`,
                        })}
                        aria-label={t('medications:form.removeMedication', {
                          name: med.name || `#${idx + 1}`,
                        })}
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition shrink-0 self-end md:self-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Times Rows Section */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('medications:form.timesSection')}
                </h4>
                <button
                  type="button"
                  data-testid="medication-add-time-button"
                  onClick={handleAddTime}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('medications:form.addTime')}</span>
                </button>
              </div>

              {times.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  {t('medications:errors.TIME_REQUIRED')}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {times.map((time, idx) => (
                    <div
                      key={`time-chip-${idx}`}
                      className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    >
                      <label
                        htmlFor={`medication-time-input-${idx}`}
                        className="sr-only"
                      >
                        {t('medications:form.timeInputLabel')}
                      </label>
                      <Clock className="w-3.5 h-3.5 text-slate-400 ml-1" />
                      <input
                        id={`medication-time-input-${idx}`}
                        data-testid={`medication-time-input-${idx}`}
                        type="text"
                        required
                        aria-invalid={isTimeInvalid(time)}
                        value={time}
                        onChange={(e) => handleUpdateTime(idx, e.target.value)}
                        placeholder={t('medications:form.timePlaceholder')}
                        className="w-16 px-1.5 py-1 text-xs font-bold text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                      />
                      <button
                        type="button"
                        data-testid={`medication-remove-time-${idx}`}
                        onClick={() => handleRemoveTime(time)}
                        title={t('medications:form.removeTime', { time })}
                        aria-label={t('medications:form.removeTime', { time })}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded-md transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Doses Grid Section */}
            {medications.length > 0 && times.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('medications:form.dosesSection')}
                </h4>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
                        <th className="p-2.5 font-bold text-slate-700 dark:text-slate-300 min-w-[70px]">
                          {t('medications:timeColumn')}
                        </th>
                        {medications.map((med) => (
                          <th
                            key={med.id}
                            className="p-2.5 font-bold text-slate-800 dark:text-slate-200 min-w-[140px]"
                          >
                            <span>{med.name || '—'}</span>
                            {med.dosage && (
                              <span className="block text-[10px] text-slate-500 font-normal">
                                {med.dosage}
                              </span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {times.map((time) => (
                        <tr key={time} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                            {time || '—'}
                          </td>
                          {medications.map((med) => (
                            <td key={med.id} className="p-1.5">
                              <input
                                data-testid={`medication-dose-input-${med.id}-${time}`}
                                type="text"
                                aria-label={t('medications:form.doseInputAria', {
                                  medication: med.name || '',
                                  time,
                                })}
                                value={doses[med.id]?.[time] ?? ''}
                                onChange={(e) =>
                                  handleUpdateDose(med.id, time, e.target.value)
                                }
                                placeholder={t(
                                  'medications:form.dosePlaceholder',
                                )}
                                className="w-full px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              data-testid="medication-form-cancel-button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              {t('medications:form.cancel')}
            </button>
            <button
              type="submit"
              data-testid="medication-form-submit-button"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              {mode === 'NEW'
                ? t('medications:form.saveNew')
                : t('medications:form.saveCorrection')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
