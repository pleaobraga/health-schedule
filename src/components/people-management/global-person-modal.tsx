import { X, Check, User, Palette, Pipette } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { TAILWIND_PALETTE } from '../../constants/tailwind-colors'

import type { Person } from '../../types'

export interface GlobalPersonModalProps {
  isOpen: boolean
  onClose: () => void
  personToEdit?: Person | null
  onSave: (name: string, color: string) => void
}

export function GlobalPersonModal({
  isOpen,
  onClose,
  personToEdit,
  onSave,
}: GlobalPersonModalProps) {
  const { t } = useTranslation(['people', 'common'])
  const [name, setName] = useState('')
  const [selectedColor, setSelectedColor] = useState(TAILWIND_PALETTE[0].hex)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (personToEdit) {
      setName(personToEdit.name)
      setSelectedColor(personToEdit.color)
    } else {
      setName('')
      setSelectedColor(TAILWIND_PALETTE[0].hex)
    }
    setError(null)
  }, [personToEdit, isOpen])

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError(t('people:globalModal.nameRequired'))
      return
    }
    onSave(trimmed, selectedColor)
    onClose()
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="global-person-modal-title"
      className="modal-overlay fixed inset-0 z-120 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn"
    >
      <div className="modal-panel bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden flex flex-col transition-colors">
        {/* Header */}
        <div className="modal-header flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs font-bold text-base"
              style={{ backgroundColor: selectedColor }}
            >
              {name.trim() ? name.trim().charAt(0).toUpperCase() : <User className="w-5 h-5" />}
            </div>
            <div>
              <h3
                id="global-person-modal-title"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                {personToEdit ? t('people:globalModal.editTitle') : t('people:globalModal.newTitle')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {personToEdit ? t('people:globalModal.editSubtitle') : t('people:globalModal.newSubtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title={t('common:close')}
            aria-label={t('common:close')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body p-6 space-y-5">
            {error && (
              <div className="p-3 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-medium">
                {error}
              </div>
            )}

            {/* Name Input */}
            <div>
              <label
                htmlFor="person-name-input"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                <User className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>{t('people:globalModal.nameLabel')}</span>
              </label>
              <input
                id="person-name-input"
                type="text"
                aria-invalid={Boolean(error)}
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (error) setError(null)
                }}
                placeholder={t('people:globalModal.namePlaceholder')}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-850 text-slate-900 dark:text-white placeholder:text-slate-400 transition"
              />
            </div>

            {/* Color Swatches */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>{t('people:globalModal.colorLabel')}</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {TAILWIND_PALETTE.find((c) => c.hex.toLowerCase() === selectedColor.toLowerCase())?.name || t('people:globalModal.customColor')}
                  </span>
                  <label
                    title={t('people:globalModal.customColor')}
                    className="relative flex items-center gap-1.5 cursor-pointer bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-0.5 rounded-sm border border-slate-200 dark:border-slate-700 transition"
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-black/10 shrink-0"
                      style={{ backgroundColor: selectedColor }}
                    />
                    <span className="text-[11px] font-mono font-medium text-slate-700 dark:text-slate-300">
                      {selectedColor.toUpperCase()}
                    </span>
                    <Pipette className="w-3 h-3 text-slate-400" />
                    <input
                      type="color"
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      aria-label={t('people:globalModal.customColor')}
                    />
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 max-h-32 overflow-y-auto p-1.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                {/* Native Colorpicker Tile */}
                {(() => {
                  const isCustom = !TAILWIND_PALETTE.some(
                    (c) => c.hex.toLowerCase() === selectedColor.toLowerCase(),
                  )
                  return (
                    <label
                      title={t('people:globalModal.customColor')}
                      aria-label={t('people:globalModal.customColor')}
                      className={`relative w-6 h-6 rounded-lg transition-transform hover:scale-110 flex items-center justify-center shrink-0 cursor-pointer shadow-2xs group ${
                        isCustom ? 'ring-2 ring-indigo-500 scale-105' : ''
                      }`}
                      style={{
                        background: isCustom
                          ? selectedColor
                          : 'linear-gradient(135deg, #f43f5e 0%, #eab308 50%, #3b82f6 100%)',
                      }}
                    >
                      <input
                        type="color"
                        value={selectedColor}
                        onChange={(e) => setSelectedColor(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        aria-label={t('people:globalModal.customColor')}
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

          </div>

          {/* Footer Actions */}
          <div className="modal-footer px-6 py-4 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {t('people:globalModal.cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-xs transition"
            >
              {personToEdit ? t('people:globalModal.save') : t('people:globalModal.create')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

