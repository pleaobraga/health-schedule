import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FullScreenCalendarModal } from './fullscreen-calendar-modal'
import { useScheduleStore } from '../../store/use-schedule-store'

describe('FullScreenCalendarModal', () => {
  beforeEach(() => {
    useScheduleStore.setState({
      isFullScreenModalOpen: false,
      currentMonth: '2026-10',
      persons: [{ id: 'p1', name: 'Dr. Roberto Alves', color: '#3B82F6' }],
      assignments: {
        '2026-10-15': ['p1'],
      },
      events: [{ id: 'e1', date: '2026-10-15', title: 'Dia do Professor' }],
    })
  })

  it('shows a past month with the person name it recorded', () => {
    useScheduleStore.setState({
      isFullScreenModalOpen: true,
      currentMonth: '2020-01',
      persons: [{ id: 'p1', name: 'Nome novo', color: '#222222' }],
      assignments: { '2020-01-15': ['p1'] },
      monthSnapshots: {
        '2020-01': {
          capturedAt: '2026-11-05T10:00:00.000Z',
          persons: [{ id: 'p1', name: 'Nome antigo', color: '#111111' }],
          shiftDefinitions: [],
          shiftRules: [],
          activeShiftIds: [],
          activeRuleIds: [],
        },
      },
    })

    render(<FullScreenCalendarModal />)

    expect(screen.getAllByText('Nome antigo').length).toBeGreaterThan(0)
    expect(screen.queryByText('Nome novo')).not.toBeInTheDocument()
  })

  it('does not render when isFullScreenModalOpen is false', () => {
    render(<FullScreenCalendarModal />)
    expect(screen.queryByText(/outubro 2026/i)).not.toBeInTheDocument()
  })

  it('renders correctly with month and year and assignments when open', () => {
    useScheduleStore.setState({ isFullScreenModalOpen: true })
    render(<FullScreenCalendarModal />)

    // Title should show month and year
    expect(
      screen.getByRole('heading', { level: 2, name: /^outubro 2026$/i }),
    ).toBeInTheDocument()

    // Should render assigned person name
    expect(screen.getAllByText('Dr. Roberto Alves')[0]).toBeInTheDocument()
  })

  it('closes when close button is clicked', () => {
    useScheduleStore.setState({ isFullScreenModalOpen: true })
    render(<FullScreenCalendarModal />)

    const closeBtn = screen.getByTitle(/fechar tela cheia/i)
    fireEvent.click(closeBtn)

    expect(useScheduleStore.getState().isFullScreenModalOpen).toBe(false)
  })

  it('closes on Escape key press', () => {
    useScheduleStore.setState({ isFullScreenModalOpen: true })
    render(<FullScreenCalendarModal />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useScheduleStore.getState().isFullScreenModalOpen).toBe(false)
  })

  it('renders print button and triggers print on click with formatted document title', () => {
    let titleDuringPrint = ''
    document.title = 'Original Title'
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {
      titleDuringPrint = document.title
    })
    useScheduleStore.setState({ isFullScreenModalOpen: true, currentMonth: '2026-10' })
    render(<FullScreenCalendarModal />)

    const printBtn = screen.getByTitle(/imprimir escala do mês/i)
    expect(printBtn).toBeInTheDocument()
    expect(screen.queryByTitle(/exportar para excel/i)).not.toBeInTheDocument()

    fireEvent.click(printBtn)
    expect(printSpy).toHaveBeenCalledTimes(1)
    expect(titleDuringPrint).toBe('escala-10-2026')
    expect(document.title).toBe('Original Title')
    printSpy.mockRestore()
  })

  it('renders print-only events section with events ordered chronologically by date and time', () => {
    useScheduleStore.setState({
      isFullScreenModalOpen: true,
      currentMonth: '2026-10',
      persons: [
        { id: 'p1', name: 'Dr. Roberto Alves', color: '#3B82F6' },
        { id: 'p2', name: 'Dra. Ana Paula', color: '#10B981' },
      ],
      assignments: {
        '2026-10-05': ['p1'],
        '2026-10-20': ['p2'],
      },
      events: [
        // Out of order purposely
        {
          id: 'e3',
          date: '2026-10-20',
          time: '14:00',
          title: 'Treinamento de Equipe',
          description: 'Sala de reuniões 2',
        },
        { id: 'e1', date: '2026-10-05', time: '08:00', title: 'Reunião Geral' },
        {
          id: 'e2',
          date: '2026-10-15',
          title: 'Dia do Professor',
          description: 'Feriado escolar',
        },
        { id: 'e_other', date: '2026-11-02', title: 'Finados - Outro mês' },
      ],
    })

    render(<FullScreenCalendarModal />)

    const printSection = screen.getByTestId('print-events-section')
    expect(printSection).toBeInTheDocument()

    // Out of month event must NOT be listed
    expect(screen.queryByText('Finados - Outro mês')).not.toBeInTheDocument()

    // Header info
    expect(
      screen.getByText(/eventos do mês – outubro de 2026/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/total: 3 eventos/i)).toBeInTheDocument()

    // Check all event titles are rendered
    expect(screen.getByText('Reunião Geral')).toBeInTheDocument()
    expect(screen.getByText('Dia do Professor')).toBeInTheDocument()
    expect(screen.getByText('Treinamento de Equipe')).toBeInTheDocument()

    // Check chronological order of events in the table rows
    const rows = printSection.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(3)

    // Row 1: 05/10/2026
    expect(rows[0]).toHaveTextContent('05/10/2026')
    expect(rows[0]).toHaveTextContent('08:00')
    expect(rows[0]).toHaveTextContent('Reunião Geral')
    expect(rows[0]).toHaveTextContent('Dr. Roberto Alves')

    // Row 2: 15/10/2026
    expect(rows[1]).toHaveTextContent('15/10/2026')
    expect(rows[1]).toHaveTextContent('Dia todo')
    expect(rows[1]).toHaveTextContent('Dia do Professor')
    expect(rows[1]).toHaveTextContent('Feriado escolar')

    // Row 3: 20/10/2026
    expect(rows[2]).toHaveTextContent('20/10/2026')
    expect(rows[2]).toHaveTextContent('14:00')
    expect(rows[2]).toHaveTextContent('Treinamento de Equipe')
    expect(rows[2]).toHaveTextContent('Sala de reuniões 2')
    expect(rows[2]).toHaveTextContent('Dra. Ana Paula')
  })

  it('does not render print events section when there are no events in current month', () => {
    useScheduleStore.setState({
      isFullScreenModalOpen: true,
      currentMonth: '2026-10',
      events: [
        { id: 'e_nov', date: '2026-11-15', title: 'Proclamação da República' },
      ],
    })

    render(<FullScreenCalendarModal />)
    expect(screen.queryByTestId('print-events-section')).not.toBeInTheDocument()
  })

  it('uses light print colors (dark:print) for the title and the events section', () => {
    useScheduleStore.setState({
      isFullScreenModalOpen: true,
      currentMonth: '2026-10',
      events: [{ id: 'e1', date: '2026-10-15', title: 'Reunião Clínica' }],
    })

    render(<FullScreenCalendarModal />)

    const printSection = screen.getByTestId('print-events-section')
    expect(printSection).toHaveClass(
      'dark:print:bg-white',
      'dark:print:text-slate-900',
    )

    const table = printSection.querySelector('table')
    expect(table).toHaveClass('dark:bg-white', 'dark:text-slate-900')

    const title = screen.getByRole('heading', {
      level: 3,
      name: /eventos do mês/i,
    })
    expect(title).toHaveClass('dark:text-slate-950', 'print:text-slate-950')

    expect(screen.getByRole('heading', { level: 2, name: /^outubro 2026$/i })).toHaveClass(
      'dark:print:text-slate-950',
    )
  })

  it('prints the person in charge column with their color, without the day schedule column', () => {
    useScheduleStore.setState({
      isFullScreenModalOpen: true,
      currentMonth: '2026-10',
      persons: [
        { id: 'p1', name: 'Ana Souza', color: '#EF4444', active: true },
        { id: 'p2', name: 'Beatriz Lima', color: '#10B981', active: true },
      ],
      assignments: {
        '2026-10-15': ['p1'],
      },
      events: [
        {
          id: 'e1',
          date: '2026-10-15',
          title: 'Curativo Complexo',
          personId: 'p2',
        },
      ],
    })

    render(<FullScreenCalendarModal />)

    const printSection = screen.getByTestId('print-events-section')
    expect(printSection).toBeInTheDocument()

    // Headers
    expect(
      within(printSection).getByText('Responsável do Serviço'),
    ).toBeInTheDocument()
    expect(
      within(printSection).queryByText('Escala do Dia'),
    ).not.toBeInTheDocument()

    // Responsible caregiver badge with color
    const responsibleBadge = within(printSection).getByText('Beatriz Lima')
    expect(responsibleBadge).toHaveClass('print-person-chip')
    expect(responsibleBadge).toHaveStyle({ backgroundColor: '#10B981' })
  })

  it('shows the shift code even when a single person is assigned to the day', () => {
    useScheduleStore.setState({
      isFullScreenModalOpen: true,
      currentMonth: '2026-10',
      shiftDefinitions: [
        {
          id: 's_d12',
          name: 'Plantão Diurno 12h',
          code: 'D12',
          startTime: '07:00',
          durationHours: 12,
          color: '#3B82F6',
          enabledByDefault: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
      persons: [{ id: 'p1', name: 'Dr. Roberto Alves', color: '#3B82F6' }],
      assignments: {
        '2026-10-15': ['p1'],
      },
      dayShiftAssignments: {
        '2026-10-15': { s_d12: 'p1' },
      },
      events: [],
    })

    render(<FullScreenCalendarModal />)

    // Name must be present
    expect(screen.getByText('Dr. Roberto Alves')).toBeInTheDocument()
    // Shift badge D12 must be present
    expect(screen.getByTestId('shift-badge-2026-10-15-D12')).toBeInTheDocument()
    expect(screen.getByTestId('shift-badge-2026-10-15-D12')).toHaveTextContent('D12')
  })

  it('shows the shift code of each professional when several people are assigned to the day', () => {
    useScheduleStore.setState({
      isFullScreenModalOpen: true,
      currentMonth: '2026-10',
      shiftDefinitions: [
        {
          id: 's_d12',
          name: 'Plantão Diurno 12h',
          code: 'D12',
          startTime: '07:00',
          durationHours: 12,
          color: '#3B82F6',
          enabledByDefault: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        {
          id: 's_n12',
          name: 'Plantão Noturno 12h',
          code: 'N12',
          startTime: '19:00',
          durationHours: 12,
          color: '#8B5CF6',
          enabledByDefault: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
      persons: [
        { id: 'p1', name: 'Dra. Camila', color: '#10B981' },
        { id: 'p2', name: 'Dra. Ana', color: '#F59E0B' },
      ],
      assignments: {
        '2026-10-15': ['p1', 'p2'],
      },
      dayShiftAssignments: {
        '2026-10-15': {
          s_d12: 'p1',
          s_n12: 'p2',
        },
      },
      events: [],
    })

    render(<FullScreenCalendarModal />)

    expect(screen.getByText('Dra. Camila')).toBeInTheDocument()
    expect(screen.getByText('Dra. Ana')).toBeInTheDocument()

    // Shift badges must be present because there is more than 1 person assigned
    expect(screen.getByTestId('shift-badge-2026-10-15-D12')).toBeInTheDocument()
    expect(screen.getByTestId('shift-badge-2026-10-15-D12')).toHaveTextContent('D12')

    expect(screen.getByTestId('shift-badge-2026-10-15-N12')).toBeInTheDocument()
    expect(screen.getByTestId('shift-badge-2026-10-15-N12')).toHaveTextContent('N12')
  })

  it('keeps the dark class on the document while printing so the on-screen modal does not change', () => {
    document.documentElement.classList.add('dark')
    useScheduleStore.setState({ isFullScreenModalOpen: true, isDarkMode: true })

    let darkDuringPrint = false
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {
      darkDuringPrint = document.documentElement.classList.contains('dark')
    })

    render(<FullScreenCalendarModal />)

    const printBtn = screen.getByTitle(/imprimir escala do mês/i)
    fireEvent.click(printBtn)

    expect(printSpy).toHaveBeenCalledTimes(1)
    expect(darkDuringPrint).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    printSpy.mockRestore()
    document.documentElement.classList.remove('dark')
  })

  it('on screens <= 640px hides the events tag and shift code, and the day number opens the events modal', () => {
    useScheduleStore.setState({
      isFullScreenModalOpen: true,
      currentMonth: '2026-10',
      selectedDateForEvents: null,
      shiftDefinitions: [
        {
          id: 's_d12',
          name: 'Plantão Diurno 12h',
          code: 'D12',
          startTime: '07:00',
          durationHours: 12,
          color: '#3B82F6',
          enabledByDefault: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
      dayShiftAssignments: {
        '2026-10-15': { s_d12: 'p1' },
      },
    })

    render(<FullScreenCalendarModal />)

    expect(screen.getByTestId('shift-badge-2026-10-15-D12')).toHaveClass('mobile:hidden')
    expect(screen.getByTitle('Dia do Professor')).toHaveClass('mobile:hidden')
    expect(screen.getAllByText('Dr. Roberto Alves')[0].closest('[title]')).toHaveClass('w-full', 'mobile:px-1')

    const dayNumberBtn = screen.getByTestId('fullscreen-day-number-2026-10-15')
    expect(dayNumberBtn).toHaveClass('pointer-events-none', 'mobile:pointer-events-auto')
    fireEvent.click(dayNumberBtn)
    expect(useScheduleStore.getState().selectedDateForEvents).toBe('2026-10-15')
  })

  it('signals a day with purchases in fullscreen on desktop and <= 640px, and opens expenses tab when clicked', () => {
    useScheduleStore.setState({
      isFullScreenModalOpen: true,
      currentMonth: '2026-10',
      selectedDateForEvents: null,
      events: [],
      expenses: [
        {
          id: 'exp-1',
          date: '2026-10-18',
          description: 'Farmácia',
          amount: 120.0,
          items: [
            {
              id: 'line-1',
              itemId: 'item-1',
              itemName: 'Fralda G',
              quantity: 2,
              amount: 120.0,
            },
          ],
          createdAt: '2026-10-18T10:00:00Z',
          updatedAt: '2026-10-18T10:00:00Z',
        },
      ],
    })

    render(<FullScreenCalendarModal />)

    const badge = screen.getByTestId('fullscreen-expense-badge-2026-10-18')
    expect(badge).toBeInTheDocument()
    expect(badge.getAttribute('title')).toMatch(/1 gasto\(s\) totalizando R\$\s*120,00/)

    const dayNumberBtn = screen.getByTestId('fullscreen-day-number-2026-10-18')
    expect(dayNumberBtn.parentElement).toHaveClass('mobile:bg-emerald-50')
    expect(dayNumberBtn).toHaveClass('mobile:text-emerald-700', 'mobile:font-extrabold')

    fireEvent.click(dayNumberBtn)
    expect(useScheduleStore.getState().selectedDateForEvents).toBe('2026-10-18')
    expect(useScheduleStore.getState().dayEventsModalTab).toBe('expenses')
  })
})
