import { X, Check, Trash2, User, Palette, Pipette } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { AvailabilityMiniCalendar } from './availability-mini-calendar'
import { TAILWIND_PALETTE } from '../../constants/tailwind-colors'
import { ConfirmDialog } from '../common/confirm-dialog'

import type { Person } from '../../types'

// Stable default: a new array on each render would retrigger the effect below forever
const NO_AVAILABLE_DAYS: number[] = []

export interface PersonModalProps {
  isOpen: boolean
  onClose: () => void
  personToEdit?: Person | null
  currentMonth: string
  initialAvailableDays?: number[]
  onSave: (name: string, color: string, availableDays: number[]) => void
  onDelete?: (id: string) => void
}

export function PersonModal({
  isOpen,
  onClose,
  personToEdit,
  currentMonth,
  initialAvailableDays = NO_AVAILABLE_DAYS,
  onSave,
  onDelete,
}: PersonModalProps) {
  const { t } = useTranslation(['people', 'common'])
  const [name, setName] = useState('')
  const [selectedColor, setSelectedColor] = useState(TAILWIND_PALETTE[0].hex)
  const [availableDays, setAvailableDays] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  useEffect(() => {
    if (personToEdit) {
      setName(personToEdit.name)
      setSelectedColor(personToEdit.color)
      setAvailableDays(initialAvailableDays)
    } else {
      setName('')
      setSelectedColor(TAILWIND_PALETTE[0].hex)
      setAvailableDays([])
    }
    setError(null)
  }, [personToEdit, initialAvailableDays, isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('people:personModal.nameRequired'))
      return
    }
    onSave(name.trim(), selectedColor, availableDays)
    onClose()
  }

  const handleConfirmDelete = () => {
    if (personToEdit && onDelete) {
      onDelete(personToEdit.id)
    }
    setIsDeleteConfirmOpen(false)
    onClose()
  }

  return createPortal(
    <div className="modal-overlay fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="modal-panel bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col transition-colors">
        {/* Header */}
        <div className="modal-header flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div
              className="w-4 h-4 rounded-full shadow-xs"
              style={{ backgroundColor: selectedColor }}
            />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              {personToEdit ? t('people:personModal.editTitle') : t('people:personModal.newTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common:actions.close')}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body p-6 space-y-5">
            {error && (
              <div className="p-3 text-xs rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-medium">
                {error}
              </div>
            )}

            {/* Name Input */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                {t('people:personModal.nameLabel')}
              </label>
              <input
                type="text"
                aria-invalid={Boolean(error)}
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (error) setError(null)
                }}
                placeholder={t('people:personModal.namePlaceholder')}
                autoFocus
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 dark:text-slate-100 transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Color Swatches */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>{t('people:personModal.colorLabel')}</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {TAILWIND_PALETTE.find((c) => c.hex.toLowerCase() === selectedColor.toLowerCase())
                      ?.name || t('people:personModal.customColor')}
                  </span>
                  <label
                    title={t('people:personModal.pickColorTooltip')}
                    className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-600 cursor-pointer transition shadow-2xs"
                  >
                    <Pipette className="w-3 h-3 text-slate-500" />
                    <span>{selectedColor.toUpperCase()}</span>
                    <input
                      type="color"
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="sr-only"
                      aria-label={t('people:personModal.colorPickerAria')}
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 max-h-32 overflow-y-auto p-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                {/* Native Colorpicker Tile */}
                {(() => {
                  const isCustom = !TAILWIND_PALETTE.some(
                    (c) => c.hex.toLowerCase() === selectedColor.toLowerCase()
                  )
                  return (
                    <label
                      title={t('people:personModal.customColor')}
                      aria-label={t('people:personModal.customColor')}
                      className={`relative w-6 h-6 rounded-lg transition-transform hover:scale-110 flex items-center justify-center shrink-0 cursor-pointer shadow-2xs group ${
                        isCustom ? 'ring-2 ring-indigo-500 scale-105' : ''
                      }`}
                      style={{
                        background: isCustom
                          ? selectedColor
                          : 'linear-gradient(135deg, #f43f5e 0%, #ec4899 20%, #8b5cf6 40%, #3b82f6 60%, #10b981 80%, #f59e0b 100%)',
                      }}
                    >
                      <input
                        type="color"
                        value={selectedColor}
                        onChange={(e) => setSelectedColor(e.target.value)}
                        className="sr-only"
                        aria-label={t('people:personModal.customColor')}
                      />
                      {isCustom ? (
                        <Check className="w-3.5 h-3.5 text-white stroke-3 drop-shadow-xs" />
                      ) : (
                        <Pipette className="w-3.5 h-3.5 text-white drop-shadow-xs group-hover:scale-110 transition-transform" />
                      )}
                    </label>
                  )
                })()}

                {TAILWIND_PALETTE.map((pal) => (
                  <button
                    key={pal.hex}
                    type="button"
                    onClick={() => setSelectedColor(pal.hex)}
                    style={{ backgroundColor: pal.hex }}
                    className="w-6 h-6 rounded-lg transition-transform hover:scale-110 flex items-center justify-center shrink-0 cursor-pointer"
                    title={pal.name}
                    aria-label={pal.name}
                  >
                    {selectedColor.toLowerCase() === pal.hex.toLowerCase() && (
                      <Check className="w-3.5 h-3.5 text-white stroke-3" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Availability Mini Calendar */}
            <div>
              <AvailabilityMiniCalendar
                month={currentMonth}
                selectedDays={availableDays}
                onChange={setAvailableDays}
                accentColor={selectedColor}
              />
            </div>

          </div>

          {/* Actions */}
          <div className="modal-footer px-6 py-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            {personToEdit && onDelete ? (
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('people:personModal.delete')}
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition"
              >
                {t('people:personModal.cancel')}
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-xs rounded-xl transition"
              >
                {personToEdit ? t('people:personModal.save') : t('people:personModal.create')}
              </button>
            </div>
          </div>
        </form>
      </div>

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen && Boolean(personToEdit)}
        title={t('people:personModal.deleteTitle')}
        description={t('people:personModal.deleteConfirm', { name: personToEdit?.name ?? '' })}
        confirmLabel={t('common:actions.delete')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />
    </div>,
    document.body
  )
}
