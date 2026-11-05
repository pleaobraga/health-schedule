import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import { DayPicker, getDefaultClassNames } from 'react-day-picker'

import { cn } from '../../utils/cn'

import type { ComponentProps } from 'react'
import type { DayButton } from 'react-day-picker'

// shadcn's `ghost` Button variant, inlined because Calendar is the only consumer.
const GHOST_BUTTON_CLASSES =
  'inline-flex items-center justify-center rounded-md text-sm transition-colors outline-hidden hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50'

export function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()

  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <button
      ref={ref}
      data-day={day.isoDate}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      className={cn(
        GHOST_BUTTON_CLASSES,
        'flex aspect-square size-auto w-full min-w-(--cell-size) flex-col gap-1 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50 data-[selected-single=true]:bg-primary data-[selected-single=true]:font-bold data-[selected-single=true]:text-primary-foreground',
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  )
}

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  components,
  ...props
}: ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        'group/calendar bg-background p-3 [--cell-size:--spacing(8)] [[data-slot=popover-content]_&]:bg-transparent',
        className,
      )}
      captionLayout={captionLayout}
      classNames={{
        root: cn('w-fit', defaultClassNames.root),
        months: cn(
          'relative flex flex-col gap-4 md:flex-row',
          defaultClassNames.months,
        ),
        month: cn('flex w-full flex-col gap-4', defaultClassNames.month),
        nav: cn(
          'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
          defaultClassNames.nav,
        ),
        button_previous: cn(
          GHOST_BUTTON_CLASSES,
          'size-(--cell-size) p-0 select-none aria-disabled:opacity-50',
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          GHOST_BUTTON_CLASSES,
          'size-(--cell-size) p-0 select-none aria-disabled:opacity-50',
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          'flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)',
          defaultClassNames.month_caption,
        ),
        caption_label: cn(
          'text-sm font-medium capitalize select-none',
          defaultClassNames.caption_label,
        ),
        month_grid: cn('w-full border-collapse', defaultClassNames.month_grid),
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'flex-1 rounded-md text-[0.8rem] font-normal text-muted-foreground select-none',
          defaultClassNames.weekday,
        ),
        week: cn('mt-2 flex w-full', defaultClassNames.week),
        day: cn(
          'group/day relative aspect-square h-full w-full p-0 text-center select-none',
          defaultClassNames.day,
        ),
        today: cn(
          'rounded-md bg-accent text-accent-foreground',
          defaultClassNames.today,
        ),
        outside: cn(
          'text-muted-foreground aria-selected:text-muted-foreground',
          defaultClassNames.outside,
        ),
        disabled: cn(
          'text-muted-foreground opacity-50',
          defaultClassNames.disabled,
        ),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className: rootClassName, rootRef, ...rootProps }) => (
          <div
            data-slot="calendar"
            ref={rootRef}
            className={cn(rootClassName)}
            {...rootProps}
          />
        ),
        Chevron: ({
          className: chevronClassName,
          orientation,
          ...chevronProps
        }) => {
          if (orientation === 'left') {
            return (
              <ChevronLeftIcon
                className={cn('size-4', chevronClassName)}
                {...chevronProps}
              />
            )
          }

          if (orientation === 'right') {
            return (
              <ChevronRightIcon
                className={cn('size-4', chevronClassName)}
                {...chevronProps}
              />
            )
          }

          return (
            <ChevronDownIcon
              className={cn('size-4', chevronClassName)}
              {...chevronProps}
            />
          )
        },
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  )
}
