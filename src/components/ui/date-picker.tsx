import { format } from 'date-fns'
import { enUS, ptBR } from 'date-fns/locale'
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'


import { Calendar } from './calendar'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { cn } from '../../utils/cn'

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

function parseIsoDateLocal(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [yearStr, monthStr, dayStr] = value.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const day = Number(dayStr)
  if (!year || !month || !day) return undefined
  const parsed = new Date(year, month - 1, day, 12, 0, 0)
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return undefined
  }
  return parsed
}

/**
 * The app's only date field: the shadcn date picker (Popover + Calendar).
 * The screen-reader input keeps `<label htmlFor>` and form semantics working.
 */
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
  const isEnglish = i18n.language.startsWith('en')
  const locale = isEnglish ? enUS : ptBR

  const selectedDate = parseIsoDateLocal(value)
  const displayValue = selectedDate
    ? format(selectedDate, isEnglish ? 'MM/dd/yyyy' : 'dd/MM/yyyy', { locale })
    : ''

  const [isOpen, setIsOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState<Date>(
    () => selectedDate ?? new Date(),
  )

  const triggerRef = useRef<HTMLButtonElement>(null)

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setViewMonth(selectedDate ?? new Date())
    }
    setIsOpen(open)
  }

  const handleSelectDay = (day: Date | undefined) => {
    if (day) {
      onChange(format(day, ISO_DATE_FORMAT))
    }
    setIsOpen(false)
  }

  return (
    <div className="relative w-full">
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

      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            disabled={disabled}
            data-testid={testId ? `${testId}-trigger` : 'date-picker-trigger'}
            aria-invalid={invalid}
            className={cn(
              'flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 shadow-2xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
              className,
            )}
          >
            <span className="flex items-center gap-2 min-w-0">
              <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              <span
                className={cn(
                  'truncate',
                  !displayValue &&
                    'text-slate-400 dark:text-slate-500 font-normal',
                )}
              >
                {displayValue || placeholder || t('datePicker.placeholder')}
              </span>
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200',
                isOpen && 'rotate-180',
              )}
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={6}
          collisionPadding={8}
          data-testid={testId ? `${testId}-popover` : 'date-picker-popover'}
          className="z-150 w-auto rounded-2xl p-0 shadow-2xl"
        >
          <Calendar
            mode="single"
            locale={locale}
            selected={selectedDate}
            onSelect={handleSelectDay}
            month={viewMonth}
            onMonthChange={setViewMonth}
            labels={{
              labelPrevious: () => t('datePicker.previousMonth'),
              labelNext: () => t('datePicker.nextMonth'),
            }}
          />
          <div className="flex justify-end border-t border-border p-2">
            <button
              type="button"
              data-testid={testId ? `${testId}-today` : 'date-picker-today'}
              onClick={() => handleSelectDay(new Date())}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition cursor-pointer"
            >
              {t('datePicker.today')}
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
