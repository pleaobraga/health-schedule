import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import { DayCell } from './day-cell'

import type { Person, CalendarEvent, DailyExpense } from '../../types'
import type { CalendarDayInfo } from '../../utils/date-utils'

describe('DayCell', () => {
  const mockDayInfo: CalendarDayInfo = {
    date: new Date(2026, 9, 15),
    dateStr: '2026-10-15',
    dayNumber: 15,
    isCurrentMonth: true,
    isToday: false,
    dayOfWeek: 4,
  }

  const mockPersons: Person[] = [
    { id: 'p1', name: 'Dra. Camila', color: '#3b82f6' },
    { id: 'p2', name: 'Dr. Lucas', color: '#10b981' },
  ]

  it('renders the day number in the default color when the day has no events', () => {
    render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={false}
        assignedPersonIds={['p1']}
        allPersons={mockPersons}
        events={[]}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={vi.fn()}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    const dayNumber = screen.getByText('15')
    expect(dayNumber).toBeInTheDocument()
    expect(dayNumber.className).not.toContain('text-red-600 font-extrabold')
  })

  it('renders the day number in red when the day has events', () => {
    const mockEvents: CalendarEvent[] = [
      { id: 'ev-1', date: '2026-10-15', title: 'Team meeting' },
    ]

    render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={false}
        assignedPersonIds={['p1']}
        allPersons={mockPersons}
        events={mockEvents}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={vi.fn()}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    const dayNumber = screen.getByText('15')
    expect(dayNumber).toBeInTheDocument()
    expect(dayNumber.className).toContain('text-red-600 font-extrabold')
  })

  it('opens the day events when the calendar icon is clicked', () => {
    const handleOpenEvents = vi.fn()
    render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={false}
        assignedPersonIds={['p1']}
        allPersons={mockPersons}
        events={[]}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={handleOpenEvents}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    const eventBtn = screen.getByTitle(/Ver ou adicionar eventos/i)
    fireEvent.click(eventBtn)
    expect(handleOpenEvents).toHaveBeenCalledTimes(1)
  })

  it('opens the day events when the day number is tapped on small screens', () => {
    const handleOpenEvents = vi.fn()
    render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={false}
        assignedPersonIds={[]}
        allPersons={mockPersons}
        events={[]}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={handleOpenEvents}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    const dayNumberBtn = screen.getByTestId('day-number-button')
    expect(dayNumberBtn).toHaveTextContent('15')
    expect(dayNumberBtn).toHaveClass('pointer-events-none', 'mobile:pointer-events-auto')
    expect(screen.getByTitle(/Ver ou adicionar eventos/i)).toHaveClass('mobile:hidden')

    fireEvent.click(dayNumberBtn)
    expect(handleOpenEvents).toHaveBeenCalledTimes(1)
  })

  it('shows the assigned person name in view mode', () => {
    render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={false}
        assignedPersonIds={['p1']}
        allPersons={mockPersons}
        events={[]}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={vi.fn()}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    expect(screen.getByText('Dra. Camila')).toBeInTheDocument()
  })

  it('shows removable person tags in edit mode', () => {
    const handleRemove = vi.fn()
    render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={true}
        assignedPersonIds={['p1', 'p2']}
        allPersons={mockPersons}
        events={[]}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={vi.fn()}
        onRemovePerson={handleRemove}
        onAddPerson={vi.fn()}
      />
    )

    expect(screen.getByText('Dra. Camila')).toBeInTheDocument()
    expect(screen.getByText('Dr. Lucas')).toBeInTheDocument()

    const removeBtn = screen.getByTitle('Remover Dra. Camila deste dia')
    fireEvent.click(removeBtn)
    expect(handleRemove).toHaveBeenCalledWith('p1')
  })

  it('shows the availability badge for the highlighted professional', () => {
    render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={false}
        assignedPersonIds={[]}
        allPersons={mockPersons}
        events={[]}
        highlightedPerson={mockPersons[0]}
        isHighlightedPersonAvailable={true}
        isPersonAvailable={() => true}
        onOpenEvents={vi.fn()}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    expect(screen.getByText('Disp.')).toBeInTheDocument()
  })

  it('highlights today with a cell background, without a circle around the day number', () => {
    const todayInfo: CalendarDayInfo = {
      ...mockDayInfo,
      isToday: true,
    }

    const { container } = render(
      <DayCell
        dayInfo={todayInfo}
        currentMonth="2026-10"
        isEditMode={false}
        assignedPersonIds={['p1']}
        allPersons={mockPersons}
        events={[]}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={vi.fn()}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    const cellElement = container.firstChild as HTMLElement
    expect(cellElement.className).toContain('bg-indigo-50/70')

    const dayNumber = screen.getByText('15')
    expect(dayNumber.className).not.toContain('bg-indigo-600 text-white')
    expect(dayNumber.className).toContain('text-indigo-600')
  })

  it('renders several shifts on the same day with a different person on each 12h shift', () => {
    const activeShifts = [
      {
        id: 'shift_d12',
        name: 'Plantão Diurno 12h',
        code: 'D12',
        startTime: '07:00',
        durationHours: 12,
        color: '#3b82f6',
        enabledByDefault: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'shift_n12',
        name: 'Plantão Noturno 12h',
        code: 'N12',
        startTime: '19:00',
        durationHours: 12,
        color: '#6366f1',
        enabledByDefault: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]

    render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={false}
        assignedPersonIds={['p1', 'p2']}
        dayShiftMap={{
          shift_d12: 'p1',
          shift_n12: 'p2',
        }}
        activeShifts={activeShifts}
        allPersons={mockPersons}
        events={[]}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={vi.fn()}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    // Should display both shift codes
    expect(screen.getByText('D12')).toBeInTheDocument()
    expect(screen.getByText('N12')).toBeInTheDocument()

    // Should display both doctor names
    expect(screen.getByText('Dra. Camila')).toBeInTheDocument()
    expect(screen.getByText('Dr. Lucas')).toBeInTheDocument()

    // Should NOT show conflict error because they are allocated in distinct 12h shifts covering the day
    expect(screen.queryByText(/Conflito/i)).not.toBeInTheDocument()

    // Small screens (<= 640px): shift code is hidden and the name chip spans the full width
    expect(screen.getByTestId('shift-badge-2026-10-15-D12')).toHaveClass('mobile:hidden')
    expect(screen.getByText('Dra. Camila').closest('[title]')).toHaveClass('w-full', 'mobile:px-1')
  })

  it('in edit mode with several active shifts, the add button opens the shift assignment modal', () => {
    const activeShifts = [
      {
        id: 'shift_d12',
        name: 'Plantão Diurno 12h',
        code: 'D12',
        startTime: '07:00',
        durationHours: 12,
        color: '#3b82f6',
        enabledByDefault: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'shift_n12',
        name: 'Plantão Noturno 12h',
        code: 'N12',
        startTime: '19:00',
        durationHours: 12,
        color: '#6366f1',
        enabledByDefault: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]

    const handleRemoveFromShift = vi.fn()
    const handleAssignPersonToShift = vi.fn()

    render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={true}
        assignedPersonIds={['p1']}
        dayShiftMap={{
          shift_d12: 'p1',
        }}
        activeShifts={activeShifts}
        allPersons={mockPersons}
        events={[]}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={vi.fn()}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
        onRemovePersonFromShift={handleRemoveFromShift}
        onAssignPersonToShift={handleAssignPersonToShift}
      />
    )

    // Displays allocated shift
    expect(screen.getByText('D12')).toBeInTheDocument()
    expect(screen.getByText('Dra. Camila')).toBeInTheDocument()

    // Clicking remove on D12
    const removeBtn = screen.getByTitle(/Remover Dra. Camila/i)
    fireEvent.click(removeBtn)
    expect(handleRemoveFromShift).toHaveBeenCalledWith('shift_d12')

    // Single add button is present
    const addBtn = screen.getByTitle(/Adicionar pessoa a este dia/i)
    expect(addBtn).toBeInTheDocument()

    // Clicking Add opens the AddDayShiftModal
    fireEvent.click(addBtn)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/1\. Selecione o Plantão \/ Escala/i)).toBeInTheDocument()
    expect(screen.getByText(/2\. Selecione o\(a\) Profissional/i)).toBeInTheDocument()
  })

  it('in edit mode with a single active shift, the add button opens the inline picker', () => {
    const singleShift = [
      {
        id: 'shift_p24',
        name: 'Plantão 24h',
        code: 'P24',
        startTime: '07:00',
        durationHours: 24,
        color: '#8b5cf6',
        enabledByDefault: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]

    render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={true}
        assignedPersonIds={[]}
        dayShiftMap={{}}
        activeShifts={singleShift}
        allPersons={mockPersons}
        events={[]}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={vi.fn()}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    // Single Add button renders inline CandidatePicker
    const addBtn = screen.getByRole('button', { name: 'Adicionar' })
    expect(addBtn).toBeInTheDocument()

    // Clicking it opens inline picker, NOT the multi-shift dialog
    fireEvent.click(addBtn)
    expect(screen.getByText(/Escalar pessoa/i)).toBeInTheDocument()
    expect(screen.queryByText(/1\. Selecione o Plantão \/ Escala/i)).not.toBeInTheDocument()
  })

  it('always shows the shift code badge, in view and edit mode', () => {
    const singleShift = [
      {
        id: 'shift_d12',
        name: 'Plantão Diurno 12h',
        code: 'D12',
        startTime: '07:00',
        durationHours: 12,
        color: '#3b82f6',
        enabledByDefault: true,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]

    // Read mode
    const { unmount } = render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={false}
        assignedPersonIds={['p1']}
        dayShiftMap={{ shift_d12: 'p1' }}
        activeShifts={singleShift}
        allPersons={mockPersons}
        events={[]}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={vi.fn()}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    expect(screen.getByText('Dra. Camila')).toBeInTheDocument()
    expect(screen.getByTestId('shift-badge-2026-10-15-D12')).toBeInTheDocument()
    expect(screen.getByTestId('shift-badge-2026-10-15-D12')).toHaveTextContent('D12')
    unmount()

    // Edit mode
    render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={true}
        assignedPersonIds={['p1']}
        dayShiftMap={{ shift_d12: 'p1' }}
        activeShifts={singleShift}
        allPersons={mockPersons}
        events={[]}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={vi.fn()}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    expect(screen.getByText('Dra. Camila')).toBeInTheDocument()
    expect(screen.getByTestId('shift-badge-2026-10-15-D12')).toBeInTheDocument()
    expect(screen.getByTestId('shift-badge-2026-10-15-D12')).toHaveTextContent('D12')
  })

  it('renders neither "Vago" nor a picker when the day has no shift and nobody assigned', () => {
    // Read mode
    const { unmount } = render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={false}
        assignedPersonIds={[]}
        dayShiftMap={{}}
        activeShifts={[]}
        allPersons={mockPersons}
        events={[]}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={vi.fn()}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    expect(screen.queryByText(/vago/i)).not.toBeInTheDocument()
    unmount()

    // Edit mode
    render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={true}
        assignedPersonIds={[]}
        dayShiftMap={{}}
        activeShifts={[]}
        allPersons={mockPersons}
        events={[]}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={vi.fn()}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    expect(screen.queryByText(/vago/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /escalar pessoa/i })).not.toBeInTheDocument()
  })

  it('hides the "Escalado" tag on small screens when highlighting scheduled days', () => {
    render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={false}
        assignedPersonIds={['p1']}
        allPersons={mockPersons}
        events={[]}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        highlightedScheduledPerson={mockPersons[0]}
        isHighlightedPersonScheduled
        isPersonAvailable={() => true}
        onOpenEvents={vi.fn()}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    expect(screen.getByTestId('scheduled-highlight-badge')).toHaveClass('mobile:hidden')
  })

  it('on small screens, a day with events gets a red background on the whole number row, without a circle', () => {
    const events: CalendarEvent[] = [{ id: 'e1', date: '2026-10-15', title: 'Meeting' }]
    render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={false}
        assignedPersonIds={[]}
        allPersons={mockPersons}
        events={events}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={vi.fn()}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    const dayNumberBtn = screen.getByTestId('day-number-button')
    expect(dayNumberBtn).toHaveClass('mobile:rounded-none', 'mobile:bg-transparent', 'mobile:w-auto')
    expect(dayNumberBtn.parentElement?.parentElement).toHaveClass('mobile:bg-red-50')
  })

  it('renders daily expense badge with only the $ icon when expenses are present and triggers onOpenExpenses on click', () => {
    const expenses: DailyExpense[] = [
      {
        id: 'exp-1',
        date: '2026-10-15',
        description: 'Farmácia',
        amount: 85.5,
        createdAt: '2026-10-15T10:00:00Z',
        updatedAt: '2026-10-15T10:00:00Z',
      },
    ]
    const onOpenExpenses = vi.fn()
    const onOpenEvents = vi.fn()

    render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={false}
        assignedPersonIds={[]}
        allPersons={mockPersons}
        events={[]}
        dailyExpenses={expenses}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={onOpenEvents}
        onOpenExpenses={onOpenExpenses}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    const badge = screen.getByTestId('day-expense-badge-2026-10-15')
    expect(badge).toBeInTheDocument()
    // It should NOT contain formatted text in the button body, only the $ icon
    expect(badge).not.toHaveTextContent('R$')

    fireEvent.click(badge)
    expect(onOpenExpenses).toHaveBeenCalledTimes(1)
    expect(onOpenEvents).not.toHaveBeenCalled()
  })

  it('on small screens, a day with only expenses gets a green background on the number row', () => {
    const expenses: DailyExpense[] = [
      {
        id: 'exp-1',
        date: '2026-10-15',
        description: 'Farmácia',
        amount: 50,
        createdAt: '2026-10-15T10:00:00Z',
        updatedAt: '2026-10-15T10:00:00Z',
      },
    ]
    const onOpenExpenses = vi.fn()

    render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={false}
        assignedPersonIds={[]}
        allPersons={mockPersons}
        events={[]}
        dailyExpenses={expenses}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={vi.fn()}
        onOpenExpenses={onOpenExpenses}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    const dayNumberBtn = screen.getByTestId('day-number-button')
    expect(dayNumberBtn.parentElement?.parentElement).toHaveClass('mobile:bg-emerald-50')

    // Clicking day number on mobile triggers onOpenExpenses
    fireEvent.click(dayNumberBtn)
    expect(onOpenExpenses).toHaveBeenCalledTimes(1)
  })

  it('on small screens, a day with both events and expenses preserves the red background on the number row', () => {
    const events: CalendarEvent[] = [{ id: 'e1', date: '2026-10-15', title: 'Meeting' }]
    const expenses: DailyExpense[] = [
      {
        id: 'exp-1',
        date: '2026-10-15',
        description: 'Farmácia',
        amount: 50,
        createdAt: '2026-10-15T10:00:00Z',
        updatedAt: '2026-10-15T10:00:00Z',
      },
    ]

    render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={false}
        assignedPersonIds={[]}
        allPersons={mockPersons}
        events={events}
        dailyExpenses={expenses}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={vi.fn()}
        onOpenExpenses={vi.fn()}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    const dayNumberBtn = screen.getByTestId('day-number-button')
    expect(dayNumberBtn.parentElement?.parentElement).toHaveClass('mobile:bg-red-50')
    expect(dayNumberBtn.parentElement?.parentElement).not.toHaveClass('mobile:bg-emerald-50')
  })

  it('does not render daily expense badge when expenses array is empty or zero', () => {
    render(
      <DayCell
        dayInfo={mockDayInfo}
        currentMonth="2026-10"
        isEditMode={false}
        assignedPersonIds={[]}
        allPersons={mockPersons}
        events={[]}
        dailyExpenses={[]}
        highlightedPerson={null}
        isHighlightedPersonAvailable={false}
        isPersonAvailable={() => true}
        onOpenEvents={vi.fn()}
        onRemovePerson={vi.fn()}
        onAddPerson={vi.fn()}
      />
    )

    expect(screen.queryByTestId('day-expense-badge-2026-10-15')).not.toBeInTheDocument()
  })
})
