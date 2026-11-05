import { Plus, Check } from 'lucide-react'
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { useScheduleStore } from '../../store/use-schedule-store'
import { computePopoverPosition } from '../../utils/popover-position'

import type { Person } from '../../types'

export interface CandidatePickerProps {
  dateStr: string
  dayNumber: number
  month: string
  assignedPersonIds: string[]
  allPersons: Person[]
  isPersonAvailable: (personId: string, dayNumber: number) => boolean
  onSelectPerson: (personId: string, shiftId?: string) => void
  shiftId?: string
  shiftCode?: string
  shiftName?: string
  buttonLabel?: string
  compact?: boolean
}

export function CandidatePicker({
  dayNumber,
  month,
  assignedPersonIds,
  allPersons,
  isPersonAvailable,
  onSelectPerson,
  shiftId,
  shiftCode,
  shiftName,
  buttonLabel,
  compact = false,
}: CandidatePickerProps) {
  const { t } = useTranslation(['calendar', 'common'])
  const [isOpen, setIsOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const hasActiveMonthShifts = useScheduleStore(
    (state) => state.getActiveShiftIds(month).length > 0,
  )
  const hasActiveShifts = Boolean(shiftId) || hasActiveMonthShifts

  const unassignedPersons = allPersons.filter(
    (p) => !assignedPersonIds.includes(p.id)
  )

  const availablePersons = unassignedPersons.filter((p) =>
    isPersonAvailable(p.id, dayNumber)
  )

  const unavailablePersons = unassignedPersons.filter(
    (p) => !isPersonAvailable(p.id, dayNumber)
  )

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const menuWidth = menuRef.current?.offsetWidth || 224
    const menuHeight = menuRef.current?.offsetHeight || 220

    setMenuPosition(
      computePopoverPosition({
        triggerRect: rect,
        menuWidth,
        menuHeight,
        align: 'left',
        preferPlacement: 'bottom',
      })
    )
  }, [])

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition()
    }
  }, [isOpen, unassignedPersons.length, updatePosition])

  useEffect(() => {
    if (!isOpen) return

    updatePosition()

    const handleScrollOrResize = () => {
      updatePosition()
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        (!menuRef.current || !menuRef.current.contains(e.target as Node))
      ) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, updatePosition])

  if (unassignedPersons.length === 0) return null

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!hasActiveShifts) return
          if (!isOpen) {
            updatePosition()
          }
          setIsOpen(!isOpen)
        }}
        disabled={!hasActiveShifts}
        title={
          !hasActiveShifts
            ? t('calendar:candidatePicker.noActiveShifts')
            : shiftName
            ? `${t('calendar:dayCell.addPerson')} - ${shiftName}`
            : t('calendar:dayCell.addPersonTooltip')
        }
        aria-label={t('calendar:dayCell.addPerson')}
        className={`flex items-center gap-1 font-medium rounded-md border transition ${
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'p-1 sm:px-2 sm:py-0.5 text-[11px]'
        } ${
          !hasActiveShifts
            ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
        }`}
      >
        <Plus className={compact ? 'w-3 h-3 text-slate-600 dark:text-slate-400' : 'w-3.5 h-3.5 sm:w-3 sm:h-3 text-slate-600 dark:text-slate-400'} />
        <span className={compact ? 'inline font-semibold' : 'hidden sm:inline'}>
          {buttonLabel || (compact && shiftCode ? shiftCode : t('calendar:dayCell.addPerson'))}
        </span>
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              maxHeight: 'calc(100vh - 24px)',
              zIndex: 9999,
            }}
            className="w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 animate-fadeIn flex flex-col overflow-hidden"
          >
            <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 flex items-center justify-between shrink-0">
              <span>{t('calendar:candidatePicker.assignPerson')}</span>
              {shiftCode && (
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">{shiftCode}</span>
              )}
            </div>

            <div className="max-h-52 overflow-y-auto py-1 custom-scrollbar">
              {availablePersons.length === 0 && (
                <div className="px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded-lg m-1.5 border border-amber-200/80 dark:border-amber-800/80 text-center font-medium">
                  {t('calendar:candidatePicker.noAvailable', { day: dayNumber })}
                </div>
              )}

              {availablePersons.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => {
                    if (shiftId) {
                      onSelectPerson(person.id, shiftId)
                    } else {
                      onSelectPerson(person.id)
                    }
                    setIsOpen(false)
                  }}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-between text-xs transition cursor-pointer"
                  title={t('calendar:candidatePicker.addPerson', { name: person.name })}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: person.color }}
                    />
                    <span className="truncate text-slate-700 dark:text-slate-200 font-medium">
                      {person.name}
                    </span>
                  </div>
                  <span title={t('calendar:candidatePicker.markedAvailable')} className="text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                </button>
              ))}

              {unavailablePersons.length > 0 && (
                <>
                  <div className="px-2.5 pt-2 pb-1 text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-t border-slate-100 dark:border-slate-700 mt-1">
                    {t('calendar:candidatePicker.noAvailabilityCount', { count: unavailablePersons.length })}
                  </div>
                  {unavailablePersons.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="w-full text-left px-2.5 py-1.5 opacity-40 cursor-not-allowed bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between text-xs transition"
                      title={t('calendar:candidatePicker.unavailableTooltip', { name: person.name, day: dayNumber })}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: person.color }}
                        />
                        <span className="truncate text-slate-500 dark:text-slate-400 font-medium">
                          {person.name}
                        </span>
                      </div>
                      <span
                        title={t('calendar:candidatePicker.noAvailabilityForDate')}
                        className="text-[9px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-sm shrink-0"
                      >
                        {t('calendar:candidatePicker.unavailableBadge')}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
