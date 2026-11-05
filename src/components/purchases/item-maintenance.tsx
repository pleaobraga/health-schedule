import { AlertCircle, GitMerge, Package, Pencil, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { useScheduleStore } from '../../store/use-schedule-store'
import { ConfirmDialog } from '../common/confirm-dialog'
import { Select } from '../ui/select'

import type { ExpenseItemActionCode } from '../../store/use-schedule-store'
import type { ExpenseItem } from '../../types'

export interface ItemMaintenanceProps {
  item: ExpenseItem
  onClose: () => void
}

export function ItemMaintenance({ item, onClose }: ItemMaintenanceProps) {
  const { t } = useTranslation(['purchases', 'common'])
  const { expenseItems, renameExpenseItem, mergeExpenseItems } =
    useScheduleStore()

  const [newName, setNewName] = useState(item.name)
  const [targetId, setTargetId] = useState('')
  const [errorCode, setErrorCode] = useState<ExpenseItemActionCode | null>(null)
  const [isConfirmMergeOpen, setIsConfirmMergeOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setNewName(item.name)
    setTargetId('')
    setErrorCode(null)
  }, [item])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isConfirmMergeOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isConfirmMergeOpen, onClose])

  const mergeTargets = useMemo(
    () =>
      expenseItems
        .filter((candidate) => !candidate.mergedIntoId && candidate.id !== item.id)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [expenseItems, item.id],
  )

  const selectedTarget = useMemo(
    () => mergeTargets.find((candidate) => candidate.id === targetId),
    [mergeTargets, targetId],
  )

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    try {
      const result = await renameExpenseItem(item.id, newName)
      if (!result.ok) {
        setErrorCode(result.code)
        return
      }
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenMergeConfirm = (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetId || targetId === item.id) {
      setErrorCode('SAME_ITEM')
      return
    }
    setErrorCode(null)
    setIsConfirmMergeOpen(true)
  }

  const handleConfirmMerge = async () => {
    if (!targetId || isSubmitting) return
    setIsSubmitting(true)
    try {
      const result = await mergeExpenseItems(item.id, targetId)
      setIsConfirmMergeOpen(false)
      if (!result.ok) {
        setErrorCode(result.code)
        return
      }
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-maintenance-title"
        data-testid="item-maintenance-modal"
        className="modal-overlay fixed inset-0 z-120 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn"
      >
        <div className="modal-panel bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] transition-colors">
          {/* Header */}
          <div className="modal-header flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <Package className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3
                  id="item-maintenance-title"
                  className="text-base font-bold text-slate-900 dark:text-white truncate"
                >
                  {item.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {t('purchases:maintenance.title')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              title={t('common:actions.close')}
              aria-label={t('common:actions.close')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="modal-body p-6 overflow-y-auto space-y-6 custom-scrollbar">
            {errorCode && (
              <div
                data-testid={`item-maintenance-error-${errorCode}`}
                className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {t(
                    `purchases:errors.${errorCode}` as unknown as TemplateStringsArray,
                  )}
                </span>
              </div>
            )}

            {/* Rename Section */}
            <form onSubmit={handleRenameSubmit} className="space-y-3" noValidate>
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('purchases:maintenance.renameTitle')}
                </h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t('purchases:maintenance.renameHint')}
              </p>
              <div>
                <label
                  htmlFor="item-maintenance-rename-input"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('purchases:maintenance.renameLabel')}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="item-maintenance-rename-input"
                    data-testid="item-maintenance-rename-input"
                    type="text"
                    value={newName}
                    onChange={(e) => {
                      setNewName(e.target.value)
                      setErrorCode(null)
                    }}
                    className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    data-testid="item-maintenance-rename-submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 transition cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {t('purchases:maintenance.renameButton')}
                  </button>
                </div>
              </div>
            </form>

            {/* Merge Section */}
            <form
              onSubmit={handleOpenMergeConfirm}
              className="pt-5 border-t border-slate-100 dark:border-slate-800 space-y-3"
              noValidate
            >
              <div className="flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('purchases:maintenance.mergeTitle')}
                </h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t('purchases:maintenance.mergeHint')}
              </p>
              <div>
                <label
                  htmlFor="item-maintenance-merge-select"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('purchases:maintenance.mergeLabel')}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select
                    id="item-maintenance-merge-select"
                    data-testid="item-maintenance-merge-select"
                    value={targetId}
                    onChange={(e) => {
                      setTargetId(e.target.value)
                      setErrorCode(null)
                    }}
                    className="flex-1 focus:ring-amber-500/30 focus:border-amber-500"
                  >
                    <option value="">
                      {t('purchases:maintenance.mergeSelectPlaceholder')}
                    </option>
                    {mergeTargets.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="submit"
                    data-testid="item-maintenance-merge-submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-bold rounded-xl text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 transition cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {t('purchases:maintenance.mergeButton')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isConfirmMergeOpen}
        title={t('purchases:maintenance.mergeConfirmTitle')}
        description={t('purchases:maintenance.mergeConfirmDescription', {
          source: item.name,
          target: selectedTarget?.name ?? '',
        })}
        confirmLabel={t('purchases:maintenance.mergeConfirmButton')}
        variant="warning"
        isBusy={isSubmitting}
        onCancel={() => setIsConfirmMergeOpen(false)}
        onConfirm={handleConfirmMerge}
      />
    </>,
    document.body,
  )
}

