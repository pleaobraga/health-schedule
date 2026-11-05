import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CalendarGrid } from './calendar-grid'
import { AuthProvider } from '../../context/auth-context'
import { useScheduleStore } from '../../store/use-schedule-store'
import { useToastStore } from '../../store/use-toast-store'

import type { AuthContextType } from '../../context/auth-context'
import type { User } from 'firebase/auth'

const mockAdminUser: User = {
  uid: 'admin-123',
  email: 'admin@healthscale.com',
  displayName: 'Admin User',
} as User

const mockAdminAuth: AuthContextType = {
  user: mockAdminUser,
  role: 'admin',
  isAdmin: true,
  isGuest: false,
  loading: false,
  guestProfiles: [],
  login: vi.fn(),
  loginAsGuest: vi.fn(),
  logout: vi.fn(),
  deleteGuestProfile: vi.fn(),
}

describe('CalendarGrid', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    useScheduleStore.setState({
      currentMonth: '2026-10',
      isEditMode: false,
      persons: [
        { id: 'p1', name: 'Dra. Camila', color: '#3b82f6', active: true },
      ],
      monthParticipants: { '2026-10': ['p1'] },
      assignments: {},
      events: [],
      availabilities: [],
    })
  })

  it('shows a past month with the person name it recorded', () => {
    useScheduleStore.setState({
      currentMonth: '2020-01',
      persons: [{ id: 'p1', name: 'Nome novo', color: '#222222', active: true }],
      monthParticipants: { '2020-01': ['p1'] },
      assignments: { '2020-01-15': ['p1'] },
      dayShiftAssignments: {},
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

    render(<CalendarGrid />)

    expect(screen.getAllByText('Nome antigo').length).toBeGreaterThan(0)
    expect(screen.queryByText('Nome novo')).not.toBeInTheDocument()
  })

  it('renders the month title and the month navigation', () => {
    render(
      <AuthProvider value={mockAdminAuth}>
        <CalendarGrid />
      </AuthProvider>,
    )

    expect(screen.getByRole('button', { name: /mês anterior/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /próximo mês/i })).toBeInTheDocument()
    expect(screen.getByText(/outubro/i)).toBeInTheDocument()
  })

  it('pulls cloud data from the actions menu and shows a success toast', async () => {
    const pullCloudDataMock = vi.fn().mockResolvedValue({
      success: true,
      message: 'Synced',
    })
    useScheduleStore.setState({ pullCloudData: pullCloudDataMock })

    render(
      <AuthProvider value={mockAdminAuth}>
        <CalendarGrid />
      </AuthProvider>,
    )

    const trigger = screen.getByTestId('calendar-actions-dropdown-trigger')
    fireEvent.click(trigger)

    const pullButton = screen.getByRole('menuitem', {
      name: /puxar dados da nuvem/i,
    })
    expect(pullButton).toBeInTheDocument()

    fireEvent.click(pullButton)

    expect(pullCloudDataMock).toHaveBeenCalledWith(true)

    await waitFor(() => {
      expect(useToastStore.getState().toasts).toEqual([
        expect.objectContaining({ type: 'success', message: 'Dados da nuvem carregados neste dispositivo.' }),
      ])
    })
  })

  it('toggles between view and edit mode with a single button', () => {
    render(
      <AuthProvider value={mockAdminAuth}>
        <CalendarGrid />
      </AuthProvider>,
    )

    // Button starts as "Edição"
    const editModeButton = screen.getByRole('button', { name: /edição/i })
    expect(editModeButton).toBeInTheDocument()
    fireEvent.click(editModeButton)

    // Store is now in edit mode and button text changes to "Visualização"
    expect(useScheduleStore.getState().isEditMode).toBe(true)
    const viewModeButton = screen.getByRole('button', { name: /visualização/i })
    expect(viewModeButton).toBeInTheDocument()

    // Clicking it switches back to view mode and button reverts to "Edição"
    fireEvent.click(viewModeButton)
    expect(useScheduleStore.getState().isEditMode).toBe(false)
    expect(screen.getByRole('button', { name: /edição/i })).toBeInTheDocument()
  })

  it('opens the actions menu with all its options', () => {
    render(
      <AuthProvider value={mockAdminAuth}>
        <CalendarGrid />
      </AuthProvider>,
    )

    const trigger = screen.getByTestId('calendar-actions-dropdown-trigger')
    expect(trigger).toBeInTheDocument()

    // Menu initially closed
    expect(
      screen.queryByTestId('calendar-actions-dropdown-menu'),
    ).not.toBeInTheDocument()

    // Open dropdown
    fireEvent.click(trigger)
    expect(
      screen.getByTestId('calendar-actions-dropdown-menu'),
    ).toBeInTheDocument()

    // Options inside menu
    expect(
      screen.getByRole('menuitem', { name: /puxar dados da nuvem/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /exportar excel/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /imprimir \/ pdf/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /tela cheia/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: /valores a pagar/i }),
    ).toBeInTheDocument()
  })

  it('opens the fullscreen calendar from the actions menu and closes the menu', () => {
    render(
      <AuthProvider value={mockAdminAuth}>
        <CalendarGrid />
      </AuthProvider>,
    )

    const trigger = screen.getByTestId('calendar-actions-dropdown-trigger')
    fireEvent.click(trigger)

    const fullscreenOption = screen.getByRole('menuitem', {
      name: /tela cheia/i,
    })
    fireEvent.click(fullscreenOption)

    expect(useScheduleStore.getState().isFullScreenModalOpen).toBe(true)
    expect(
      screen.queryByTestId('calendar-actions-dropdown-menu'),
    ).not.toBeInTheDocument()
  })

  it('closes the actions menu on Escape', () => {
    render(
      <AuthProvider value={mockAdminAuth}>
        <CalendarGrid />
      </AuthProvider>,
    )

    const trigger = screen.getByTestId('calendar-actions-dropdown-trigger')
    fireEvent.click(trigger)
    expect(
      screen.getByTestId('calendar-actions-dropdown-menu'),
    ).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(
      screen.queryByTestId('calendar-actions-dropdown-menu'),
    ).not.toBeInTheDocument()
  })

  it('falls back to the current month when currentMonth is empty', () => {
    useScheduleStore.setState({ currentMonth: '' })

    render(
      <AuthProvider value={mockAdminAuth}>
        <CalendarGrid />
      </AuthProvider>,
    )

    const expectedMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    expect(useScheduleStore.getState().currentMonth).toBe(expectedMonth)
  })

  it('in edit mode, hides the long notice on small screens and shows Salvar only when there are changes', () => {
    const saveMock = vi.fn()
    useScheduleStore.setState({
      validateCurrentSchedule: () => [],
      isEditMode: true,
      hasUnsavedChanges: false,
      saveSchedule: saveMock,
    })

    const { rerender } = render(
      <AuthProvider value={mockAdminAuth}>
        <CalendarGrid />
      </AuthProvider>,
    )

    expect(screen.getByTestId('edit-notice')).toHaveClass('mobile:hidden')
    expect(screen.queryByTestId('edit-notice-save-button')).not.toBeInTheDocument()

    act(() => {
      useScheduleStore.setState({ hasUnsavedChanges: true })
    })
    rerender(
      <AuthProvider value={mockAdminAuth}>
        <CalendarGrid />
      </AuthProvider>,
    )

    const saveBtn = screen.getByTestId('edit-notice-save-button')
    expect(saveBtn).toHaveTextContent(/^salvar$/i)
    fireEvent.click(saveBtn)
    expect(saveMock).toHaveBeenCalledTimes(1)
  })

  it('scrolls to the calendar when a highlight is turned on in the stacked layout (< 1024px)', () => {
    useScheduleStore.setState({
      validateCurrentSchedule: () => [],
      highlightedPersonId: null,
      highlightedScheduledPersonId: null,
    })
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    const matchMediaSpy = vi.fn().mockReturnValue({ matches: false })
    vi.stubGlobal('matchMedia', matchMediaSpy)

    render(
      <AuthProvider value={mockAdminAuth}>
        <CalendarGrid />
      </AuthProvider>,
    )
    expect(scrollSpy).not.toHaveBeenCalled()

    act(() => useScheduleStore.setState({ highlightedPersonId: 'p1' }))
    expect(matchMediaSpy).toHaveBeenCalledWith('(min-width: 1024px)')
    expect(scrollSpy).toHaveBeenCalledTimes(1)

    act(() =>
      useScheduleStore.setState({ highlightedPersonId: null, highlightedScheduledPersonId: 'p1' }),
    )
    expect(scrollSpy).toHaveBeenCalledTimes(2)

    // Turning the highlight off must not scroll
    act(() => useScheduleStore.setState({ highlightedScheduledPersonId: null }))
    expect(scrollSpy).toHaveBeenCalledTimes(2)

    // Side-by-side layout (>= 1024px) never scrolls
    matchMediaSpy.mockReturnValue({ matches: true })
    act(() => useScheduleStore.setState({ highlightedPersonId: 'p1' }))
    expect(scrollSpy).toHaveBeenCalledTimes(2)

    vi.unstubAllGlobals()
  })

  it('hides the "(dias destacados em verde)" hint on small screens', () => {
    useScheduleStore.setState({
      validateCurrentSchedule: () => [],
      highlightedPersonId: null,
      highlightedScheduledPersonId: 'p1',
    })

    render(
      <AuthProvider value={mockAdminAuth}>
        <CalendarGrid />
      </AuthProvider>,
    )

    const hint = screen.getByTestId('scheduled-days-highlighted-hint')
    expect(hint).toHaveTextContent('(dias destacados em verde)')
    expect(hint).toHaveClass('mobile:hidden')
  })

  it('asks for confirmation in a dialog before clearing the month', () => {
    const clearMonthAssignmentsMock = vi.fn()
    useScheduleStore.setState({ isEditMode: true, clearMonthAssignments: clearMonthAssignmentsMock })
    render(
      <AuthProvider value={mockAdminAuth}>
        <CalendarGrid />
      </AuthProvider>,
    )

    const clearButton = screen.getByRole('button', { name: /limpar mês/i })
    expect(clearButton).toHaveTextContent(/^limpar$/i)

    fireEvent.click(clearButton)
    const dialog = screen.getByRole('alertdialog', { name: /limpar mês/i })
    expect(dialog).toHaveTextContent(/outubro/i)
    expect(clearMonthAssignmentsMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(clearMonthAssignmentsMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /limpar mês/i }))
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'))
    expect(clearMonthAssignmentsMock).toHaveBeenCalledWith('2026-10')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('keeps the edit button on the title row below 1510px (hd), with its label except on <= 640px', () => {
    render(
      <AuthProvider value={mockAdminAuth}>
        <CalendarGrid />
      </AuthProvider>,
    )

    const editButton = screen.getByRole('button', { name: /^edição$/i })
    expect(editButton).toHaveClass('max-hd:order-2')
    // The label is hidden only on screens <= 640px
    const label = editButton.querySelector('span')
    expect(label).toHaveClass('mobile:hidden')
    expect(label?.className).not.toMatch(/max-hd:hidden/)
  })

  it('shows only the icon and the number of violations on screens <= 640px', () => {
    useScheduleStore.setState({
      validationErrors: [
        { id: 'v1', rule: 'empty_day', severity: 'error', message: 'Empty day', date: '2026-10-01' },
        { id: 'v2', rule: 'empty_day', severity: 'error', message: 'Empty day', date: '2026-10-02' },
      ],
    })
    render(
      <AuthProvider value={mockAdminAuth}>
        <CalendarGrid />
      </AuthProvider>,
    )

    expect(screen.getByTestId('audit-button-label')).toHaveTextContent('2 Violações')
    expect(screen.getByTestId('audit-button-label')).toHaveClass('mobile:hidden')
    expect(screen.getByTestId('audit-button-count')).toHaveTextContent(/^2$/)
    expect(screen.getByTestId('audit-button-count')).toHaveClass('hidden', 'mobile:inline')
  })

  it('fills at least the available height, stretching the week rows', () => {
    render(
      <AuthProvider value={mockAdminAuth}>
        <CalendarGrid />
      </AuthProvider>,
    )

    const calendar = screen.getByTestId('calendar-grid')
    expect(calendar).toHaveClass('flex', 'flex-col', 'flex-1')
    // Stacked layout (< lg): at least the viewport height
    expect(calendar.className).toMatch(/max-md:min-h-\[calc\(100dvh/)
    expect(calendar.className).toMatch(/md:max-lg:min-h-\[calc\(100dvh/)
    expect(screen.getByTestId('calendar-grid-body')).toHaveClass('flex-1')
  })
})
