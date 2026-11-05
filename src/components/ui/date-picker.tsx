import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { enUS, ptBR } from 'date-fns/locale'
import {
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { computePopoverPosition } from '../../utils/popover-position'

export interface DatePickerProps {
  id?: string
  value: string
  onChange: (dateStr: string) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
  'data-testid'?: string
  'aria-label'?: string
}

const ISO_DATE_FORMAT = 'yyyy-MM-dd'
const MONTH_YEAR_FORMAT = 'MMMM yyyy'
const DAY_NUMBER_FORMAT = 'd'

function parseIsoDateLocal(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [yearStr, monthStr, dayStr] = value.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  if (!year || !month || !day) return null
  const parsed = new Date(year, month - 1, day, 12, 0, 0)
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null
  }
  return parsed
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  invalid = false,
  className = '',
  'data-testid': testId,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const { i18n, t } = useTranslation('common')
  const isEnglish =
    i18n.language === 'en-US' || i18n.language.startsWith('en')
  const locale = isEnglish ? enUS : ptBR

  const selectedDate = useMemo(() => parseIsoDateLocal(value), [value])

  const [isOpen, setIsOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState<Date>(
    () => selectedDate ?? new Date(),
  )
  const [menuPosition, setMenuPosition] = useState<{
    top: number
    left: number
  }>({
    top: 0,
    left: 0,
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const displayValue = useMemo(() => {
    if (!selectedDate) return ''
    return format(selectedDate, isEnglish ? 'MM/dd/yyyy' : 'dd/MM/yyyy', {
      locale,
    })
  }, [isEnglish, locale, selectedDate])

  const weekdayHeaders = useMemo(() => {
    const start = startOfWeek(new Date(2026, 0, 4), { weekStartsOn: 0 })
    const end = endOfWeek(new Date(2026, 0, 4), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end }).map((day) =>
      format(day, 'EEEEEE', { locale }),
    )
  }, [locale])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth)
    const monthEnd = endOfMonth(monthStart)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [viewMonth])

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const menuWidth = popoverRef.current?.offsetWidth || 288
    const menuHeight = popoverRef.current?.offsetHeight || 332

    const coords = computePopoverPosition({
      triggerRect: rect,
      menuWidth,
      menuHeight,
      align: 'left',
      preferPlacement: 'bottom',
      offset: 6,
    })

    setMenuPosition(coords)
  }, [])

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition()
    }
  }, [isOpen, updatePosition])

  useEffect(() => {
    if (!isOpen) return

    updatePosition()

    const handleScrollOrResize = () => {
      updatePosition()
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!popoverRef.current || !popoverRef.current.contains(target))
      ) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
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

  const handleToggle = () => {
    if (disabled) return
    if (!isOpen) {
      setViewMonth(selectedDate ?? new Date())
      updatePosition()
    }
    setIsOpen((prev) => !prev)
  }

  const handleSelectDay = (day: Date) => {
    const formatted = format(day, 'yyyy-MM-dd')
    onChange(formatted)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  const handleSelectToday = () => {
    const now = new Date()
    const formatted = format(now, 'yyyy-MM-dd')
    setViewMonth(now)
    onChange(formatted)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  const baseTriggerClasses =
    'flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 shadow-2xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer'

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        id={id}
        data-testid={testId}
        aria-label={ariaLabel}
        type="date"
        tabIndex={-1}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => triggerRef.current?.focus()}
        className="sr-only"
      />

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        data-testid={testId ? `${testId}-trigger` : 'date-picker-trigger'}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-invalid={invalid}
        onClick={handleToggle}
        className={
          className ? `${baseTriggerClasses} ${className}` : baseTriggerClasses
        }
      >
        <span className="flex items-center gap-2 min-w-0">
          <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
          <span
            className={`truncate ${
              displayValue
                ? 'text-slate-900 dark:text-slate-100'
                : 'text-slate-400 dark:text-slate-500 font-normal'
            }`}
          >
            {displayValue || placeholder || t('datePicker.placeholder')}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            data-testid={testId ? `${testId}-popover` : 'date-picker-popover'}
            style={{
              position: 'fixed',
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
            }}
            className="z-150 w-72 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 text-slate-900 dark:text-slate-100 shadow-2xl animate-fadeIn select-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                data-testid={
                  testId ? `${testId}-prev-month` : 'date-picker-prev-month'
                }
                aria-label={t('datePicker.previousMonth')}
                title={t('datePicker.previousMonth')}
                onClick={() => setViewMonth((prev) => subMonths(prev, 1))}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="text-xs sm:text-sm font-bold capitalize text-slate-900 dark:text-slate-100">
                {format(viewMonth, MONTH_YEAR_FORMAT, { locale })}
              </div>

              <button
                type="button"
                data-testid={
                  testId ? `${testId}-next-month` : 'date-picker-next-month'
                }
                aria-label={t('datePicker.nextMonth')}
                title={t('datePicker.nextMonth')}
                onClick={() => setViewMonth((prev) => addMonths(prev, 1))}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 mb-1">
              {weekdayHeaders.map((dayLabel, idx) => (
                <div
                  key={`${dayLabel}-${idx}`}
                  className="text-center text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500 py-1"
                >
                  {dayLabel}
                </div>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {calendarDays.map((day) => {
                const dayIso = format(day, ISO_DATE_FORMAT)
                const dayNumber = format(day, DAY_NUMBER_FORMAT)
                const isSelected = Boolean(
                  selectedDate && isSameDay(day, selectedDate),
                )
                const inCurrentMonth = isSameMonth(day, viewMonth)
                const isCurrentDay = isToday(day)

                return (
                  <button
                    key={dayIso}
                    type="button"
                    data-testid={
                      testId
                        ? `${testId}-day-${dayIso}`
                        : `date-picker-day-${dayIso}`
                    }
                    onClick={() => handleSelectDay(day)}
                    className={`h-8 w-full rounded-lg text-xs flex items-center justify-center transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:text-white font-bold shadow-2xs'
                        : isCurrentDay
                          ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700'
                          : inCurrentMonth
                            ? 'text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-slate-800'
                            : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {dayNumber}
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                data-testid={testId ? `${testId}-today` : 'date-picker-today'}
                onClick={handleSelectToday}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition cursor-pointer"
              >
                {t('datePicker.today')}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
