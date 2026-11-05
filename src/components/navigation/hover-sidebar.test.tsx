import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { HoverSidebar } from './hover-sidebar'
import { AuthProvider } from '../../context/auth-context'
import * as backupService from '../../services/backup-service'
import { useScheduleStore } from '../../store/use-schedule-store'
import { useToastStore } from '../../store/use-toast-store'

import type { AuthContextType } from '../../context/auth-context'
import type { User } from 'firebase/auth'

const renderWithRouter = (initialPath = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <HoverSidebar />
    </MemoryRouter>,
  )
}

describe('HoverSidebar', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    useScheduleStore.setState({
      currentView: 'calendar',
      isDarkMode: false,
    })
  })

  it('renders the logo, the navigation links and the theme toggle', () => {
    renderWithRouter()

    expect(screen.getAllByText('Escalas Mensais').length).toBeGreaterThan(0)
    expect(screen.getAllByText('HealthSchedule').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('link', { name: /calendário de escalas/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /gerenciar pessoas/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /turnos de trabalho/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /regras de validação/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /mudar para modo escuro/i }),
    ).toBeInTheDocument()
  })

  it.each([
    { link: /gerenciar pessoas/i, view: 'people', from: '/' },
    { link: /turnos de trabalho/i, view: 'shifts', from: '/' },
    { link: /regras de validação/i, view: 'rules', from: '/' },
    { link: /calendário de escalas/i, view: 'calendar', from: '/pessoas' },
  ])('sets the current view to "$view" from its navigation link', ({ link, view, from }) => {
    useScheduleStore.setState({ currentView: from === '/' ? 'calendar' : 'people' })
    renderWithRouter(from)

    fireEvent.click(screen.getByRole('link', { name: link }))

    expect(useScheduleStore.getState().currentView).toBe(view)
  })

  it('toggles between dark and light mode and updates the dark class on the document', () => {
    renderWithRouter()

    const toggleBtn = screen.getByRole('button', {
      name: /mudar para modo escuro/i,
    })
    fireEvent.click(toggleBtn)

    expect(useScheduleStore.getState().isDarkMode).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    const toggleLightBtn = screen.getByRole('button', {
      name: /mudar para modo claro/i,
    })
    fireEvent.click(toggleLightBtn)

    expect(useScheduleStore.getState().isDarkMode).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('does not show a direct Importar Dados link in the navigation', () => {
    renderWithRouter()

    expect(screen.queryByRole('link', { name: /importar dados/i })).not.toBeInTheDocument()
  })

  it('exports the data from the Exportar Dados button', async () => {
    vi.spyOn(backupService, 'exportAppData').mockResolvedValue()
    renderWithRouter()

    const exportBtn = screen.getByRole('button', { name: /exportar dados/i })
    expect(exportBtn).toBeInTheDocument()
    fireEvent.click(exportBtn)

    await waitFor(() => {
      expect(screen.getByText('Exportado!')).toBeInTheDocument()
    })
  })

  it('renders the bottom tab bar (no top header) and opens the fullscreen menu from Mais', () => {
    renderWithRouter()

    // Below 768px the bottom tab bar replaces the old top header
    const bottomNav = screen.getByTestId('mobile-bottom-nav')
    expect(bottomNav).toHaveClass('md:hidden')
    expect(screen.queryByTestId('mobile-header')).not.toBeInTheDocument()

    // Bottom bar shows Escala, Compras, Medicamentos and Mais, without Pessoas, Turnos and Ajustes
    expect(within(bottomNav).getByRole('link', { name: 'Escala' })).toBeInTheDocument()
    expect(within(bottomNav).getByRole('link', { name: 'Compras' })).toBeInTheDocument()
    expect(within(bottomNav).getByRole('link', { name: 'Medicamentos' })).toBeInTheDocument()
    expect(within(bottomNav).queryByRole('link', { name: 'Pessoas' })).not.toBeInTheDocument()
    expect(within(bottomNav).queryByRole('link', { name: 'Turnos' })).not.toBeInTheDocument()
    expect(within(bottomNav).queryByRole('link', { name: 'Ajustes' })).not.toBeInTheDocument()

    const menuBtn = screen.getByTestId('mobile-bottom-nav-more')

    // Fullscreen mobile menu initially closed
    expect(
      screen.queryByTestId('mobile-fullscreen-menu'),
    ).not.toBeInTheDocument()

    // Click to open fullscreen menu
    fireEvent.click(menuBtn)
    const fullscreenMenu = screen.getByTestId('mobile-fullscreen-menu')
    expect(fullscreenMenu).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /gerenciar pessoas/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /turnos de trabalho/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /configurações/i }).length).toBeGreaterThan(0)

    // Click to close menu
    const closeBtn = screen.getByTestId('mobile-menu-close')
    fireEvent.click(closeBtn)
    expect(
      screen.queryByTestId('mobile-fullscreen-menu'),
    ).not.toBeInTheDocument()
  })

  it('shows the guest name and the Convidado badge for guest users', () => {
    const mockAuth: Partial<AuthContextType> = {
      user: {
        uid: 'guest_123',
        displayName: 'Dr. Convidado',
        email: null,
      } as unknown as User,
      role: 'user',
      isAdmin: false,
      isGuest: true,
    }

    render(
      <AuthProvider value={mockAuth}>
        <MemoryRouter initialEntries={['/']}>
          <HoverSidebar />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(screen.getAllByText('Dr. Convidado').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Convidado').length).toBeGreaterThan(0)
  })

  it('pulls cloud data and shows a success toast without changing the sync toggle', async () => {
    localStorage.setItem('scale_manager_cloud_sync_enabled', 'false')
    const pullCloudDataMock = vi.fn().mockResolvedValue({ success: true, message: 'Dados atualizados!' })
    useScheduleStore.setState({ pullCloudData: pullCloudDataMock })

    renderWithRouter()

    const pullButtons = screen.getAllByRole('button', { name: /puxar dados da nuvem/i })
    expect(pullButtons.length).toBeGreaterThan(0)

    fireEvent.click(pullButtons[0])

    expect(pullCloudDataMock).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(useToastStore.getState().toasts).toEqual([
        expect.objectContaining({ type: 'success', message: 'Dados da nuvem carregados neste dispositivo.' }),
      ])
    })
    expect(localStorage.getItem('scale_manager_cloud_sync_enabled')).toBe('false')
  })

  it('shows an error toast when the pull fails while offline', async () => {
    useToastStore.setState({ toasts: [] })
    const pullCloudDataMock = vi
      .fn()
      .mockResolvedValue({ success: false, code: 'offline', message: '' })
    useScheduleStore.setState({ pullCloudData: pullCloudDataMock })

    renderWithRouter()
    fireEvent.click(screen.getAllByRole('button', { name: /puxar dados da nuvem/i })[0])

    await waitFor(() => {
      expect(useToastStore.getState().toasts).toEqual([
        expect.objectContaining({
          type: 'error',
          message: 'Sem conexão com a internet. Os dados locais não foram alterados.',
        }),
      ])
    })
  })

  it('hides Forçar Dados na Nuvem outside prod or for non-admins', () => {
    renderWithRouter()
    expect(screen.queryByRole('button', { name: /forçar dados na nuvem/i })).not.toBeInTheDocument()
  })

  it('force-pushes from Forçar Dados na Nuvem in prod for admins, without changing the sync toggle', async () => {
    localStorage.setItem('scale_manager_cloud_sync_enabled', 'false')
    const forcePushMock = vi.fn().mockResolvedValue({ success: true, message: 'Forçado!' })
    useScheduleStore.setState({ forcePushCloudData: forcePushMock })

    const mockAdminAuth: Partial<AuthContextType> = {
      user: {
        uid: 'admin_1',
        email: 'admin@teste.com',
      } as unknown as User,
      role: 'admin',
      isAdmin: true,
      isGuest: false,
    }

    render(
      <AuthProvider value={mockAdminAuth}>
        <MemoryRouter initialEntries={['/']}>
          <HoverSidebar isProdOverride={true} />
        </MemoryRouter>
      </AuthProvider>,
    )

    const forceButtons = screen.getAllByRole('button', { name: /forçar dados na nuvem/i })
    expect(forceButtons.length).toBeGreaterThan(0)

    fireEvent.click(forceButtons[0])

    expect(forcePushMock).toHaveBeenCalledTimes(1)
    expect(forcePushMock).toHaveBeenCalledWith(true)
    await waitFor(() => {
      expect(useToastStore.getState().toasts).toEqual([
        expect.objectContaining({ type: 'success', message: 'Dados deste dispositivo enviados para a nuvem.' }),
      ])
    })
    expect(localStorage.getItem('scale_manager_cloud_sync_enabled')).toBe('false')
  })

  it('renders the language selector', () => {
    renderWithRouter()

    const selectors = screen.getAllByTestId('language-selector')
    expect(selectors.length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(/idioma atual/i).length).toBeGreaterThan(0)
  })
})

