import { Check, ChevronDown } from 'lucide-react'
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

import { computePopoverPosition } from '../../utils/popover-position'

import type { ChangeEvent, KeyboardEvent, ReactNode, SelectHTMLAttributes } from 'react'

export interface SelectOptionItem {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value?: string
  onValueChange?: (value: string) => void
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void
  placeholder?: string
  'data-testid'?: string
}

function extractTextFromNode(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return ''
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(extractTextFromNode).join('')
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractTextFromNode(node.props.children)
  }
  return ''
}

function extractOptionsFromChildren(children: ReactNode): SelectOptionItem[] {
  const result: SelectOptionItem[] = []

  const visit = (nodes: ReactNode) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return
      const element = child as React.ReactElement<{
        value?: string | number
        disabled?: boolean
        children?: ReactNode
      }>
      if (element.type === 'option') {
        const val =
          element.props.value !== undefined ? String(element.props.value) : ''
        const label = extractTextFromNode(element.props.children).trim()
        result.push({
          value: val,
          label,
          disabled: Boolean(element.props.disabled),
        })
      } else if (element.props && element.props.children) {
        visit(element.props.children)
      }
    })
  }

  visit(children)
  return result
}

export function Select({
  id,
  value = '',
  onValueChange,
  onChange,
  placeholder,
  disabled = false,
  className = '',
  children,
  'data-testid': testId,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  ...rest
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
  const [menuPosition, setMenuPosition] = useState<{
    top: number
    left: number
    width: number
  }>({
    top: 0,
    left: 0,
    width: 200,
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const nativeSelectRef = useRef<HTMLSelectElement>(null)

  const options = useMemo(
    () => extractOptionsFromChildren(children),
    [children],
  )

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) ?? options[0],
    [options, value],
  )

  const displayLabel = selectedOption ? selectedOption.label : (placeholder ?? '')

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const targetWidth = Math.max(rect.width, 180)
    const menuWidth = menuRef.current?.offsetWidth || targetWidth
    const estimatedHeight = Math.min(options.length * 36 + 12, 260)
    const menuHeight = menuRef.current?.offsetHeight || estimatedHeight

    const coords = computePopoverPosition({
      triggerRect: rect,
      menuWidth,
      menuHeight,
      align: 'left',
      preferPlacement: 'bottom',
      offset: 6,
    })

    setMenuPosition({
      ...coords,
      width: rect.width > 0 ? rect.width : targetWidth,
    })
  }, [options.length])

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
        (!menuRef.current || !menuRef.current.contains(target))
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

  const emitChange = (nextValue: string) => {
    onValueChange?.(nextValue)
    if (onChange) {
      const syntheticEvent = {
        target: { value: nextValue },
        currentTarget: { value: nextValue },
      } as unknown as ChangeEvent<HTMLSelectElement>
      onChange(syntheticEvent)
    }
  }

  const handleNativeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onValueChange?.(event.target.value)
    onChange?.(event)
  }

  const handleSelectOption = (opt: SelectOptionItem) => {
    if (opt.disabled) return
    emitChange(opt.value)
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  const handleToggle = () => {
    if (disabled) return
    if (!isOpen) {
      updatePosition()
      const idx = options.findIndex((o) => o.value === value)
      setHighlightedIndex(idx >= 0 ? idx : 0)
    }
    setIsOpen((prev) => !prev)
  }

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!isOpen) {
        updatePosition()
        const idx = options.findIndex((o) => o.value === value)
        setHighlightedIndex(idx >= 0 ? idx : 0)
        setIsOpen(true)
      } else {
        setHighlightedIndex((prev) =>
          options.length > 0 ? (prev + 1) % options.length : -1,
        )
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isOpen) {
        updatePosition()
        const idx = options.findIndex((o) => o.value === value)
        setHighlightedIndex(idx >= 0 ? idx : 0)
        setIsOpen(true)
      } else {
        setHighlightedIndex((prev) =>
          options.length > 0
            ? (prev - 1 + options.length) % options.length
            : -1,
        )
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      if (isOpen && highlightedIndex >= 0 && options[highlightedIndex]) {
        event.preventDefault()
        handleSelectOption(options[highlightedIndex])
      }
    }
  }

  const wrapperLayoutClass = className.includes('flex-1')
    ? 'relative flex-1 min-w-0'
    : className.includes('w-full')
      ? 'relative w-full'
      : 'relative'

  const baseTriggerClasses =
    'flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 shadow-2xs transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer'

  return (
    <div ref={containerRef} className={wrapperLayoutClass}>
      <select
        ref={nativeSelectRef}
        id={id}
        data-testid={testId}
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        tabIndex={-1}
        onChange={handleNativeChange}
        onFocus={() => triggerRef.current?.focus()}
        className="sr-only"
        {...rest}
      >
        {children}
      </select>

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        data-testid={testId ? `${testId}-trigger` : undefined}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-invalid={ariaInvalid}
        onClick={handleToggle}
        onKeyDown={handleTriggerKeyDown}
        className={className ? `${baseTriggerClasses} ${className}` : baseTriggerClasses}
      >
        <span className="truncate text-left">{displayLabel}</span>
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
            ref={menuRef}
            role="listbox"
            data-testid={testId ? `${testId}-content` : undefined}
            style={{
              position: 'fixed',
              top: `${menuPosition.top}px`,
              left: `${menuPosition.left}px`,
              minWidth: `${menuPosition.width}px`,
              maxWidth: 'calc(100vw - 24px)',
            }}
            className="z-150 max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1 text-slate-900 dark:text-slate-100 shadow-xl animate-fadeIn custom-scrollbar"
          >
            {options.map((opt, idx) => {
              const isSelected = opt.value === value
              const isHighlighted = idx === highlightedIndex
              return (
                <button
                  key={`${opt.value}-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  data-testid={
                    testId
                      ? `${testId}-option-${opt.value || 'empty'}`
                      : undefined
                  }
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleSelectOption(opt)}
                  className={`relative flex w-full cursor-pointer select-none items-center rounded-lg py-1.5 pl-7 pr-2.5 text-xs sm:text-sm font-medium outline-hidden transition-colors disabled:pointer-events-none disabled:opacity-50 ${
                    isSelected
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-semibold'
                      : isHighlighted
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </span>
                  <span className="truncate text-left">{opt.label}</span>
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}

