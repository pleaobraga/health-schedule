import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  Copy,
  DollarSign,
  MapPin,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { useScheduleStore } from '../../store/use-schedule-store'
import { formatAddress } from '../../utils/address-utils'
import { copyToClipboard } from '../../utils/clipboard-utils'
import { formatDisplayDate } from '../../utils/date-utils'
import { parseNumericRate } from '../../utils/shift-rate-utils'

import type { CalendarEvent, DailyExpense, DailyExpenseCategory, Person } from '../../types'

export function DayEventsModal() {
  const { t, i18n } = useTranslation(['calendar', 'common'])
  const {
    selectedDateForEvents,
    setSelectedDateForEvents,
    dayEventsModalTab,
    setDayEventsModalTab,
    events,
    expenses,
    addresses,
    addEvent,
    updateEvent,
    deleteEvent,
    addExpense,
    updateExpense,
    deleteExpense,
    assignments,
    persons,
    monthParticipants,
    currentMonth,
  } = useScheduleStore()

  const [activeTab, setActiveTab] = useState<'events' | 'expenses'>('events')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [addressSelection, setAddressSelection] = useState('')
  const [manualAddress, setManualAddress] = useState('')
  const [selectedPersonId, setSelectedPersonId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copiedEventAddressId, setCopiedEventAddressId] = useState<
    string | null
  >(null)

  // Expense form state
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [expenseDate, setExpenseDate] = useState('')
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expensePersonId, setExpensePersonId] = useState('')
  const [expenseCategory, setExpenseCategory] = useState<DailyExpenseCategory | ''>('')
  const [expenseError, setExpenseError] = useState<string | null>(null)

  const handleCopyAddress = async (id: string, text: string) => {
    const success = await copyToClipboard(text.trim())
    if (success) {
      setCopiedEventAddressId(id)
      setTimeout(() => {
        setCopiedEventAddressId((curr) => (curr === id ? null : curr))
      }, 2000)
    }
  }

  // Reset form when modal opens or date changes
  useEffect(() => {
    setIsFormOpen(false)
    setEditingEventId(null)
    setTitle('')
    setTime('')
    setAddressSelection('')
    setManualAddress('')
    const defaultPersonId =
      (selectedDateForEvents && assignments[selectedDateForEvents]?.[0]) || ''
    setSelectedPersonId(defaultPersonId)
    setError(null)

    // Reset expense form
    setIsExpenseFormOpen(false)
    setEditingExpenseId(null)
    setExpenseDate(selectedDateForEvents || '')
    setExpenseDescription('')
    setExpenseAmount('')
    setExpensePersonId('')
    setExpenseCategory('')
    setExpenseError(null)

    // Sync tab from store
    setActiveTab(dayEventsModalTab || 'events')
  }, [selectedDateForEvents, assignments, dayEventsModalTab])

  if (!selectedDateForEvents) return null

  const dayEvents = events.filter((e) => e.date === selectedDateForEvents)
  const dayExpenses = expenses.filter((e) => e.date === selectedDateForEvents)
  const personMap = new Map<string, Person>(persons.map((p) => [p.id, p]))

  // Resolve caregivers registered in the month
  const dateMonth = selectedDateForEvents.substring(0, 7)
  const currentMonthParticipantIds =
    monthParticipants[dateMonth] || monthParticipants[currentMonth] || []
  const monthPersons =
    currentMonthParticipantIds.length > 0
      ? persons.filter(
          (p) =>
            currentMonthParticipantIds.includes(p.id) && p.active !== false,
        )
      : persons.filter((p) => p.active !== false)

  const dayAssignedPersonId = assignments[selectedDateForEvents]?.[0] || ''
  const dayAssignedPerson = persons.find((p) => p.id === dayAssignedPersonId)

  // Ensure day-assigned person and the currently selected person are in the options list
  const caregiverOptions = [...monthPersons]
  if (
    dayAssignedPerson &&
    !caregiverOptions.some((p) => p.id === dayAssignedPerson.id)
  ) {
    caregiverOptions.unshift(dayAssignedPerson)
  }
  if (
    selectedPersonId &&
    !caregiverOptions.some((p) => p.id === selectedPersonId)
  ) {
    const customPerson = persons.find((p) => p.id === selectedPersonId)
    if (customPerson) caregiverOptions.push(customPerson)
  }

  const currentSelectedPerson = selectedPersonId
    ? personMap.get(selectedPersonId)
    : null

  const handleOpenAdd = () => {
    setEditingEventId(null)
    setTitle('')
    setTime('')
    setAddressSelection('')
    setManualAddress('')
    const defaultPersonId =
      (selectedDateForEvents && assignments[selectedDateForEvents]?.[0]) || ''
    setSelectedPersonId(defaultPersonId)
    setError(null)
    setIsFormOpen(true)
  }

  const handleStartEdit = (ev: CalendarEvent) => {
    setEditingEventId(ev.id)
    setTitle(ev.title)
    setTime(ev.time || '')
    const currentAddress = ev.address ?? ev.description ?? ''

    // Try matching with registered addresses
    const matchedAddress = addresses.find(
      (a) =>
        a.id === ev.addressId ||
        formatAddress(a) === currentAddress ||
        a.name === currentAddress,
    )

    if (matchedAddress) {
      setAddressSelection(matchedAddress.id)
      setManualAddress('')
    } else if (currentAddress) {
      setAddressSelection('__new__')
      setManualAddress(currentAddress)
    } else {
      setAddressSelection('')
      setManualAddress('')
    }

    setSelectedPersonId(ev.personId ?? (assignments[ev.date]?.[0] || ''))
    setError(null)
    setIsFormOpen(true)
  }

  const handleCancelForm = () => {
    setIsFormOpen(false)
    setEditingEventId(null)
    setTitle('')
    setTime('')
    setAddressSelection('')
    setManualAddress('')
    const defaultPersonId =
      (selectedDateForEvents && assignments[selectedDateForEvents]?.[0]) || ''
    setSelectedPersonId(defaultPersonId)
    setError(null)
  }

  const handleDeleteEvent = (eventId: string) => {
    if (editingEventId === eventId) {
      handleCancelForm()
    }
    deleteEvent(eventId)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError(t('calendar:eventsModal.errors.titleRequired'))
      return
    }

    const finalTime = time.trim() || undefined
    const finalPersonId = selectedPersonId.trim() || undefined

    let finalAddress: string | undefined
    let finalAddressId: string | undefined
    if (addressSelection === '__new__') {
      finalAddress = manualAddress.trim() || undefined
      finalAddressId = undefined
    } else if (addressSelection) {
      const selectedAddr = addresses.find((a) => a.id === addressSelection)
      if (selectedAddr) {
        finalAddress = formatAddress(selectedAddr)
        finalAddressId = selectedAddr.id
      }
    }

    if (editingEventId) {
      updateEvent(editingEventId, {
        title: title.trim(),
        time: finalTime,
        address: finalAddress,
        addressId: finalAddressId,
        description: undefined,
        personId: finalPersonId,
      })
    } else {
      addEvent({
        date: selectedDateForEvents,
        title: title.trim(),
        time: finalTime,
        address: finalAddress,
        addressId: finalAddressId,
        personId: finalPersonId,
      })
    }

    handleCancelForm()
  }

  const handleOpenAddExpense = () => {
    setEditingExpenseId(null)
    setExpenseDate(selectedDateForEvents || '')
    setExpenseDescription('')
    setExpenseAmount('')
    setExpensePersonId('')
    setExpenseCategory('')
    setExpenseError(null)
    setIsExpenseFormOpen(true)
  }

  const handleStartEditExpense = (exp: DailyExpense) => {
    setEditingExpenseId(exp.id)
    setExpenseDate(exp.date)
    setExpenseDescription(exp.description)
    setExpenseAmount(String(exp.amount))
    setExpensePersonId(exp.personId || '')
    setExpenseCategory(exp.category || '')
    setExpenseError(null)
    setIsExpenseFormOpen(true)
  }

  const handleCancelExpenseForm = () => {
    setIsExpenseFormOpen(false)
    setEditingExpenseId(null)
    setExpenseDate(selectedDateForEvents || '')
    setExpenseDescription('')
    setExpenseAmount('')
    setExpensePersonId('')
    setExpenseCategory('')
    setExpenseError(null)
  }

  const handleDeleteExpense = async (expenseId: string) => {
    if (editingExpenseId === expenseId) {
      handleCancelExpenseForm()
    }
    await deleteExpense(expenseId)
  }

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expenseDescription.trim()) {
      setExpenseError(t('calendar:eventsModal.errors.descriptionRequired'))
      return
    }

    const numericAmount = parseNumericRate(expenseAmount)
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setExpenseError(t('calendar:eventsModal.errors.amountRequired'))
      return
    }

    const targetDate = expenseDate || selectedDateForEvents
    const finalPersonId = expensePersonId.trim() || undefined
    const finalCategory = expenseCategory || undefined

    if (editingExpenseId) {
      await updateExpense(editingExpenseId, {
        date: targetDate,
        description: expenseDescription.trim(),
        amount: numericAmount,
        personId: finalPersonId,
        category: finalCategory,
      })
    } else {
      await addExpense({
        date: targetDate,
        description: expenseDescription.trim(),
        amount: numericAmount,
        personId: finalPersonId,
        category: finalCategory,
      })
    }

    handleCancelExpenseForm()
  }

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return createPortal(
    <div className="modal-overlay fixed inset-0 z-120 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="modal-panel bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col transition-colors">
        {/* Header */}
        <div className="modal-header px-6 pt-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 flex items-center justify-center text-red-600 dark:text-red-400">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {t('calendar:eventsModal.title')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDisplayDate(selectedDateForEvents, i18n.language)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedDateForEvents(null)}
              className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition"
              title={t('common:actions.close')}
              aria-label={t('common:actions.close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Switcher Tabs */}
          <div className="flex gap-2 -mb-px">
            <button
              type="button"
              onClick={() => {
                setActiveTab('events')
                setDayEventsModalTab('events')
              }}
              data-testid="tab-events"
              className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-bold border-b-2 transition cursor-pointer ${
                activeTab === 'events'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>{t('calendar:eventsModal.tabEvents')}</span>
              {dayEvents.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-extrabold">
                  {dayEvents.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('expenses')
                setDayEventsModalTab('expenses')
              }}
              data-testid="tab-expenses"
              className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-bold border-b-2 transition cursor-pointer ${
                activeTab === 'expenses'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>{t('calendar:eventsModal.tabExpenses')}</span>
              {dayExpenses.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold">
                  {dayExpenses.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          data-testid="day-events-modal-body"
          className="modal-body p-6 space-y-6 overflow-y-auto custom-scrollbar"
        >
          {activeTab === 'events' && (
            <div data-testid="events-tab-content" className="space-y-6 animate-fadeIn">
              {/* List of existing events */}
              <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                {t('calendar:eventsModal.eventsCount', {
                  count: dayEvents.length,
                })}
              </h4>

              {!isFormOpen && (
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-2xs transition"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{t('calendar:eventsModal.submitEvent')}</span>
                </button>
              )}
            </div>

            {dayEvents.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-center space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {t('calendar:eventsModal.noEvents')}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {t('calendar:eventsModal.noEventsSubtitle')}
                  </p>
                </div>
                {!isFormOpen && (
                  <button
                    type="button"
                    onClick={handleOpenAdd}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-xs transition mx-auto"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>{t('calendar:eventsModal.submitEvent')}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {dayEvents.map((ev) => {
                  const isBeingEdited = editingEventId === ev.id
                  return (
                    <div
                      key={ev.id}
                      className={`flex items-start justify-between p-3 rounded-xl border transition-all ${
                        isBeingEdited
                          ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {ev.title}
                          </span>
                          {ev.time && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/70 px-2 py-0.5 rounded-sm border border-indigo-200 dark:border-indigo-800 shrink-0">
                              <Clock className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                              <span>{ev.time}</span>
                            </span>
                          )}
                          {(() => {
                            const effectivePersonId =
                              ev.personId || assignments[ev.date]?.[0]
                            const person = effectivePersonId
                              ? personMap.get(effectivePersonId)
                              : null
                            if (!person) return null
                            return (
                              <span
                                data-testid="event-caregiver-badge"
                                style={{ backgroundColor: person.color }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-white px-2 py-0.5 rounded-md shadow-2xs shrink-0"
                                title={t(
                                  'calendar:eventsModal.responsibleBadge',
                                  { name: person.name },
                                )}
                              >
                                <User className="w-3 h-3 text-white/90" />
                                <span className="truncate max-w-[150px]">
                                  {person.name}
                                </span>
                              </span>
                            )
                          })()}
                        </div>
                        {(() => {
                          const displayAddr = ev.address || ev.description
                          if (!displayAddr) return null
                          const isCopied = copiedEventAddressId === ev.id
                          return (
                            <div className="flex items-start justify-between gap-2 p-2 bg-slate-100/70 dark:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/60 mt-1">
                              <div className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300 min-w-0 flex-1">
                                <MapPin className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
                                <p className="wrap-break-word whitespace-pre-line flex-1">
                                  {displayAddr}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleCopyAddress(ev.id, displayAddr)
                                }
                                title={
                                  isCopied
                                    ? t('calendar:eventsModal.copiedAddress')
                                    : t('calendar:eventsModal.copyAddress')
                                }
                                aria-label={t(
                                  'calendar:eventsModal.copyAddressAria',
                                )}
                                className="shrink-0 flex items-center gap-1 px-1.5 py-1 rounded-sm text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 transition shadow-2xs"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">
                                      {t('calendar:eventsModal.copied')}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span className="text-[10px]">
                                      {t('calendar:eventsModal.copy')}
                                    </span>
                                  </>
                                )}
                              </button>
                            </div>
                          )
                        })()}
                      </div>

                      {/* Action buttons: Edit and Delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(ev)}
                          title={t('calendar:eventsModal.edit')}
                          aria-label={t('calendar:eventsModal.editAria', {
                            title: ev.title,
                          })}
                          className={`p-1.5 rounded-lg transition ${
                            isBeingEdited
                              ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60'
                              : 'text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                          }`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(ev.id)}
                          title={t('calendar:eventsModal.delete')}
                          aria-label={t('calendar:eventsModal.deleteAria', {
                            title: ev.title,
                          })}
                          className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Form to add or edit event (shown only when isFormOpen is true) */}
          {isFormOpen && (
            <form
              onSubmit={handleSubmit}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3.5 animate-fadeIn"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  {editingEventId ? (
                    <>
                      <Pencil className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>{t('calendar:eventsModal.editEvent')}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>{t('calendar:eventsModal.addEvent')}</span>
                    </>
                  )}
                </h4>

                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>
                    {editingEventId
                      ? t('calendar:eventsModal.cancelEdit')
                      : t('common:actions.cancel')}
                  </span>
                </button>
              </div>

              {error && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {t('calendar:eventsModal.eventTitle')}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    if (error) setError(null)
                  }}
                  placeholder={t('calendar:eventsModal.eventTitlePlaceholder')}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              {/* Caregiver Selection */}
              <div>
                <label
                  htmlFor="event-person"
                  className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    <span>{t('calendar:eventsModal.responsibleStaff')}</span>
                  </span>
                  {dayAssignedPersonId &&
                    selectedPersonId === dayAssignedPersonId && (
                      <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                        {t('calendar:eventsModal.defaultStaff')}
                      </span>
                    )}
                </label>
                <div className="flex items-center gap-2">
                  {currentSelectedPerson && (
                    <span
                      className="w-4 h-4 rounded-full shrink-0 border border-black/10 dark:border-white/20 shadow-2xs"
                      style={{ backgroundColor: currentSelectedPerson.color }}
                      title={t('calendar:eventsModal.caregiverColorTitle', {
                        name: currentSelectedPerson.name,
                      })}
                      data-testid="selected-caregiver-color-preview"
                    />
                  )}
                  <select
                    id="event-person"
                    aria-label={t('calendar:eventsModal.responsibleStaff')}
                    value={selectedPersonId}
                    onChange={(e) => setSelectedPersonId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-slate-100 dark:scheme-dark"
                  >
                    <option value="">
                      {t('calendar:eventsModal.noCaregiverOption')}
                    </option>
                    {caregiverOptions.map((person) => {
                      const isDayAssigned = person.id === dayAssignedPersonId
                      return (
                        <option
                          key={person.id}
                          value={person.id}
                        >
                          {person.name}
                          {isDayAssigned
                            ? t('calendar:eventsModal.assignedOnDay')
                            : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="event-time"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  <Clock className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>{t('calendar:eventsModal.time')}</span>
                </label>
                <input
                  id="event-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-slate-100 dark:scheme-dark"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="event-address-select"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  <MapPin className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>{t('calendar:eventsModal.addressLabel')}</span>
                </label>

                <select
                  id="event-address-select"
                  aria-label={t('calendar:eventsModal.selectAddress')}
                  value={addressSelection}
                  onChange={(e) => {
                    const val = e.target.value
                    setAddressSelection(val)
                    if (val !== '__new__') {
                      setManualAddress('')
                    }
                  }}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-slate-100 dark:scheme-dark"
                >
                  <option value="">
                    {t('calendar:eventsModal.noAddressOption')}
                  </option>
                  {addresses.map((addr) => (
                    <option
                      key={addr.id}
                      value={addr.id}
                    >
                      {addr.name} — {addr.street}, {addr.number}
                    </option>
                  ))}
                  <option value="__new__">
                    {t('calendar:eventsModal.newAddressOption')}
                  </option>
                </select>

                {/* Preview of selected registered address */}
                {(() => {
                  if (!addressSelection || addressSelection === '__new__')
                    return null
                  const addr = addresses.find((a) => a.id === addressSelection)
                  if (!addr) return null
                  const isCopied = copiedEventAddressId === 'form-preview'
                  return (
                    <div
                      data-testid="selected-address-preview"
                      className="p-2.5 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line flex items-start justify-between gap-2 animate-fadeIn"
                    >
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {addr.name}
                          </div>
                          <div>
                            {addr.street}, {addr.number}
                            {addr.complement ? ` (${addr.complement})` : ''}
                          </div>
                          {(addr.neighborhood || addr.city) && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {[addr.neighborhood, addr.city]
                                .filter(Boolean)
                                .join(' - ')}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopyAddress('form-preview', formatAddress(addr))
                        }
                        title={
                          isCopied
                            ? t('calendar:eventsModal.copiedAddress')
                            : t('calendar:eventsModal.copyAddress')
                        }
                        aria-label={t(
                          'calendar:eventsModal.copySelectedAddress',
                        )}
                        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-slate-700 transition border border-slate-200/60 dark:border-slate-700/60 bg-white/70 dark:bg-slate-800 shadow-2xs"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">
                              {t('calendar:eventsModal.copied')}
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span className="text-[10px]">
                              {t('calendar:eventsModal.copy')}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  )
                })()}

                {/* Multi-line textarea displayed ONLY when 'Novo endereço' is selected */}
                {addressSelection === '__new__' && (
                  <div className="space-y-1 pt-1 animate-fadeIn">
                    <label
                      htmlFor="event-address-manual"
                      className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400"
                    >
                      {t('calendar:eventsModal.manualAddress')}
                    </label>
                    <textarea
                      id="event-address-manual"
                      rows={3}
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      placeholder={t(
                        'calendar:eventsModal.manualAddressPlaceholder',
                      )}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-y"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-xs transition"
                >
                  {editingEventId ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{t('calendar:eventsModal.saveEvent')}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('calendar:eventsModal.submitEvent')}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition"
                >
                  {t('common:actions.cancel')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Expenses Tab Content */}
      {activeTab === 'expenses' && (
        <div data-testid="expenses-tab-content" className="space-y-6 animate-fadeIn">
          {/* List of existing expenses */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                {t('calendar:eventsModal.expensesCount', {
                  count: dayExpenses.length,
                })}
              </h4>

              {!isExpenseFormOpen && (
                <button
                  type="button"
                  data-testid="open-add-expense-btn"
                  onClick={handleOpenAddExpense}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-2xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{t('calendar:eventsModal.submitExpense')}</span>
                </button>
              )}
            </div>

            {dayExpenses.length === 0 ? (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 text-center space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {t('calendar:eventsModal.noExpenses')}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    {t('calendar:eventsModal.noExpensesSubtitle')}
                  </p>
                </div>
                {!isExpenseFormOpen && (
                  <button
                    type="button"
                    data-testid="open-add-expense-btn"
                    onClick={handleOpenAddExpense}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-xs transition mx-auto cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>{t('calendar:eventsModal.submitExpense')}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {dayExpenses.map((exp) => {
                  const isBeingEdited = editingExpenseId === exp.id
                  const linkedPerson = exp.personId
                    ? personMap.get(exp.personId)
                    : null

                  return (
                    <div
                      key={exp.id}
                      className={`flex items-start justify-between p-3 rounded-xl border transition-all ${
                        isBeingEdited
                          ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {exp.description}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded-sm border border-emerald-200 dark:border-emerald-800 shrink-0">
                            <DollarSign className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>{formatBRL(exp.amount)}</span>
                          </span>
                          {exp.category && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-sm border border-slate-200 dark:border-slate-700 shrink-0">
                              <Tag className="w-2.5 h-2.5" />
                              <span>
                                {t(
                                  `calendar:eventsModal.categories.${exp.category}` as unknown as TemplateStringsArray,
                                )}
                              </span>
                            </span>
                          )}
                          {linkedPerson ? (
                            <span
                              data-testid="expense-reimbursement-badge"
                              style={{ backgroundColor: linkedPerson.color }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-white px-2 py-0.5 rounded-md shadow-2xs shrink-0"
                              title={t(
                                'calendar:eventsModal.reimbursementBadge',
                                { name: linkedPerson.name },
                              )}
                            >
                              <User className="w-3 h-3 text-white/90" />
                              <span className="truncate max-w-[150px]">
                                {linkedPerson.name}
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded-sm shrink-0">
                              <Receipt className="w-2.5 h-2.5" />
                              <span>
                                {t('calendar:eventsModal.generalExpenseBadge')}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons: Edit and Delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEditExpense(exp)}
                          title={t('calendar:eventsModal.editExpense')}
                          aria-label={t('calendar:eventsModal.editExpenseAria', {
                            description: exp.description,
                          })}
                          className={`p-1.5 rounded-lg transition cursor-pointer ${
                            isBeingEdited
                              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60'
                              : 'text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                          }`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(exp.id)}
                          title={t('common:actions.delete')}
                          aria-label={t('calendar:eventsModal.deleteExpenseAria', {
                            description: exp.description,
                          })}
                          className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Form to add or edit expense */}
          {isExpenseFormOpen && (
            <form
              onSubmit={handleSubmitExpense}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3.5 animate-fadeIn"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  {editingExpenseId ? (
                    <>
                      <Pencil className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{t('calendar:eventsModal.editExpense')}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{t('calendar:eventsModal.addExpense')}</span>
                    </>
                  )}
                </h4>

                <button
                  type="button"
                  onClick={handleCancelExpenseForm}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>
                    {editingExpenseId
                      ? t('calendar:eventsModal.cancelEditExpense')
                      : t('common:actions.cancel')}
                  </span>
                </button>
              </div>

              {expenseError && (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {expenseError}
                </div>
              )}

              {/* Date Field (Prefilled with selectedDateForEvents) */}
              <div>
                <label
                  htmlFor="expense-date"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('calendar:eventsModal.expenseDate')}
                </label>
                <input
                  id="expense-date"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 dark:text-slate-100 dark:scheme-dark"
                />
              </div>

              {/* Description Field */}
              <div>
                <label
                  htmlFor="expense-description"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('calendar:eventsModal.expenseDescription')}
                </label>
                <input
                  id="expense-description"
                  type="text"
                  value={expenseDescription}
                  onChange={(e) => {
                    setExpenseDescription(e.target.value)
                    if (expenseError) setExpenseError(null)
                  }}
                  placeholder={t(
                    'calendar:eventsModal.expenseDescriptionPlaceholder',
                  )}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              {/* Amount Field (BRL with currency formatting / parsing) */}
              <div>
                <label
                  htmlFor="expense-amount"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span>{t('calendar:eventsModal.expenseAmount')}</span>
                </label>
                <input
                  id="expense-amount"
                  type="text"
                  value={expenseAmount}
                  onChange={(e) => {
                    setExpenseAmount(e.target.value)
                    if (expenseError) setExpenseError(null)
                  }}
                  placeholder={t('calendar:eventsModal.expenseAmountPlaceholder')}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
              </div>

              {/* Caregiver Selection (Optional for reimbursement) */}
              <div>
                <label
                  htmlFor="expense-person"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  <User className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span>{t('calendar:eventsModal.expensePerson')}</span>
                </label>
                <select
                  id="expense-person"
                  aria-label={t('calendar:eventsModal.expensePerson')}
                  value={expensePersonId}
                  onChange={(e) => setExpensePersonId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 dark:text-slate-100 dark:scheme-dark"
                >
                  <option value="">
                    {t('calendar:eventsModal.noExpensePersonOption')}
                  </option>
                  {caregiverOptions.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Selection (Optional) */}
              <div>
                <label
                  htmlFor="expense-category"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  <Tag className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span>{t('calendar:eventsModal.expenseCategory')}</span>
                </label>
                <select
                  id="expense-category"
                  aria-label={t('calendar:eventsModal.expenseCategory')}
                  value={expenseCategory}
                  onChange={(e) =>
                    setExpenseCategory(e.target.value as DailyExpenseCategory | '')
                  }
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 dark:text-slate-100 dark:scheme-dark"
                >
                  <option value="">
                    {t('calendar:eventsModal.categories.none')}
                  </option>
                  <option value="MEDICATION">
                    {t('calendar:eventsModal.categories.MEDICATION')}
                  </option>
                  <option value="TRANSPORT">
                    {t('calendar:eventsModal.categories.TRANSPORT')}
                  </option>
                  <option value="SUPPLIES">
                    {t('calendar:eventsModal.categories.SUPPLIES')}
                  </option>
                  <option value="OTHER">
                    {t('calendar:eventsModal.categories.OTHER')}
                  </option>
                </select>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  data-testid="submit-expense-btn"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-xs transition cursor-pointer"
                >
                  {editingExpenseId ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{t('calendar:eventsModal.saveExpense')}</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('calendar:eventsModal.submitExpense')}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCancelExpenseForm}
                  className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition cursor-pointer"
                >
                  {t('common:actions.cancel')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
        </div>

        {/* Footer */}
        <div className="modal-footer px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={() => setSelectedDateForEvents(null)}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition"
          >
            {t('common:actions.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
