import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { TestAppRouter } from './index'
import * as backupService from '../services/backup-service'
import { useScheduleStore } from '../store/use-schedule-store'

describe('Application router (HashRouter & route mapping)', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('renders the RootLayout with the sidebar and the CalendarView on "/"', async () => {
    vi.spyOn(backupService, 'hasExistingLocalData').mockResolvedValue(true)

    render(<TestAppRouter initialEntries={['/']} />)

    expect(screen.getByTestId('root-layout')).toBeInTheDocument()
    expect(screen.getByTestId('hover-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('calendar-view')).toBeInTheDocument()
  })

  it('renders the CalendarView on the "/calendario" alias', async () => {
    vi.spyOn(backupService, 'hasExistingLocalData').mockResolvedValue(true)

    render(<TestAppRouter initialEntries={['/calendario']} />)

    expect(screen.getByTestId('calendar-view')).toBeInTheDocument()
  })

  it('renders the people management screen on "/pessoas"', async () => {
    vi.spyOn(backupService, 'hasExistingLocalData').mockResolvedValue(true)

    render(<TestAppRouter initialEntries={['/pessoas']} />)

    expect(screen.getByText(/Cadastro Geral de Funcionários/i)).toBeInTheDocument()
    expect(useScheduleStore.getState().currentView).toBe('people')
  })

  it('renders the purchases screen on "/compras"', async () => {
    vi.spyOn(backupService, 'hasExistingLocalData').mockResolvedValue(true)

    render(<TestAppRouter initialEntries={['/compras']} />)

    expect(screen.getByTestId('purchases-view')).toBeInTheDocument()
    expect(useScheduleStore.getState().currentView).toBe('purchases')
  })

  it('renders the import screen on "/importar"', async () => {
    vi.spyOn(backupService, 'hasExistingLocalData').mockResolvedValue(true)

    render(<TestAppRouter initialEntries={['/importar']} />)

    expect(await screen.findByText('Restauração de Backup')).toBeInTheDocument()
    expect(screen.getByText(/Selecione o arquivo de backup/i)).toBeInTheDocument()
    expect(useScheduleStore.getState().currentView).toBe('import')
  })

  it('renders the shifts screen on "/turnos"', async () => {
    vi.spyOn(backupService, 'hasExistingLocalData').mockResolvedValue(true)

    render(<TestAppRouter initialEntries={['/turnos']} />)

    expect(screen.getByTestId('shifts-management-view')).toBeInTheDocument()
    expect(screen.getByText(/Gestão Global de Turnos/i)).toBeInTheDocument()
    expect(useScheduleStore.getState().currentView).toBe('shifts')
  })

  it('renders the validation rules screen on "/regras"', async () => {
    vi.spyOn(backupService, 'hasExistingLocalData').mockResolvedValue(true)

    render(<TestAppRouter initialEntries={['/regras']} />)

    expect(screen.getByTestId('rules-management-view')).toBeInTheDocument()
    expect(screen.getByText(/Gestão Global de Regras/i)).toBeInTheDocument()
    expect(useScheduleStore.getState().currentView).toBe('rules')
  })

  it('redirects the legacy "/configuracoes/turnos" route to "/turnos"', async () => {
    vi.spyOn(backupService, 'hasExistingLocalData').mockResolvedValue(true)

    render(<TestAppRouter initialEntries={['/configuracoes/turnos']} />)

    await waitFor(() => {
      expect(screen.getByTestId('shifts-management-view')).toBeInTheDocument()
    })
  })

  it('redirects the legacy "/configuracoes/regras" route to "/regras"', async () => {
    vi.spyOn(backupService, 'hasExistingLocalData').mockResolvedValue(true)

    render(<TestAppRouter initialEntries={['/configuracoes/regras']} />)

    await waitFor(() => {
      expect(screen.getByTestId('rules-management-view')).toBeInTheDocument()
    })
  })

  it('renders the settings screen on "/configuracoes"', async () => {
    vi.spyOn(backupService, 'hasExistingLocalData').mockResolvedValue(true)

    render(<TestAppRouter initialEntries={['/configuracoes']} />)

    expect(screen.getByTestId('settings-view')).toBeInTheDocument()
    expect(screen.getByText(/Configurações Gerais/i)).toBeInTheDocument()
  })

  it('redirects unknown routes (*) back to the root route', async () => {
    vi.spyOn(backupService, 'hasExistingLocalData').mockResolvedValue(true)

    render(<TestAppRouter initialEntries={['/rota-completamente-invalida']} />)

    await waitFor(() => {
      expect(screen.getByTestId('calendar-view')).toBeInTheDocument()
    })
  })

  it('navigates between routes through the sidebar links', async () => {
    vi.spyOn(backupService, 'hasExistingLocalData').mockResolvedValue(true)

    render(<TestAppRouter initialEntries={['/']} />)

    // Starts on calendar
    expect(screen.getByTestId('calendar-view')).toBeInTheDocument()

    // Click on people link
    const peopleLink = screen.getByRole('link', { name: /gerenciar pessoas/i })
    fireEvent.click(peopleLink)

    await waitFor(() => {
      expect(screen.getByText(/Cadastro Geral de Funcionários/i)).toBeInTheDocument()
    })

    // Click on shifts link
    const shiftsLink = screen.getByRole('link', { name: /turnos de trabalho/i })
    fireEvent.click(shiftsLink)

    await waitFor(() => {
      expect(screen.getByText(/Gestão Global de Turnos/i)).toBeInTheDocument()
    })

    // Click on settings link
    const settingsLink = screen.getByRole('link', { name: /configurações/i })
    fireEvent.click(settingsLink)

    await waitFor(() => {
      expect(screen.getByTestId('settings-view')).toBeInTheDocument()
    })
  })

  it('applies the active style to the NavLink of the current route', () => {
    vi.spyOn(backupService, 'hasExistingLocalData').mockResolvedValue(true)

    render(<TestAppRouter initialEntries={['/pessoas']} />)

    const peopleLink = screen.getByRole('link', { name: /gerenciar pessoas/i })
    expect(peopleLink.className).toContain('text-indigo-700')
    expect(peopleLink.className).toContain('font-bold')
  })

  it('redirects "/" to the import screen when local storage is empty, then lets the user open the calendar', async () => {
    vi.spyOn(backupService, 'hasExistingLocalData').mockResolvedValue(false)

    render(<TestAppRouter initialEntries={['/']} />)

    // Onboarding: the empty-storage check redirects to Settings > Import, a heavy first render,
    // so this wait gets more time than the 1s default when the whole suite runs in parallel
    await waitFor(
      () => {
        expect(screen.getByText(/Selecione o arquivo de backup/i)).toBeInTheDocument()
        expect(useScheduleStore.getState().currentView).toBe('import')
      },
      { timeout: 3000 },
    )

    // The user opens the calendar from the sidebar
    const calendarLink = screen.getByRole('link', { name: /calendário de escalas/i })
    fireEvent.click(calendarLink)

    // The calendar renders without being redirected back to the import screen
    await waitFor(() => {
      expect(screen.getByTestId('calendar-view')).toBeInTheDocument()
      expect(useScheduleStore.getState().currentView).toBe('calendar')
    })
  })
})

