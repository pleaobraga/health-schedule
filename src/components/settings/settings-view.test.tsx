import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SettingsView } from './settings-view'
import { AuthProvider } from '../../context/auth-context'
import { CloudSyncService } from '../../services/cloud-sync-service'
import { useScheduleStore } from '../../store/use-schedule-store'
import { useToastStore } from '../../store/use-toast-store'

import type { AuthContextType } from '../../context/auth-context'
import type { User } from 'firebase/auth'

const signedOutAuth: Partial<AuthContextType> = {
  user: null,
  role: null,
  isGuest: false,
  loading: false,
}

const renderSettings = (authValue: Partial<AuthContextType> = signedOutAuth) => {
  return render(
    <AuthProvider value={authValue}>
      <MemoryRouter>
        <SettingsView />
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('SettingsView - clear local data', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    localStorage.clear()
    useScheduleStore.setState({
      persons: [{ id: 'p1', name: 'Dr. Silva', color: '#10b981', active: true }],
      assignments: { '2026-10-01': ['p1'] },
      events: [{ id: 'ev1', title: 'Plantão', date: '2026-10-01', description: '' }],
      addresses: [{ id: 'addr1', name: 'Consultório', street: 'Rua Central', number: '10' }],
      isDarkMode: false,
    })
  })

  it('renders the reset section with the clear button and a summary including shifts and addresses', () => {
    renderSettings()

    expect(screen.getByTestId('clear-local-data-card')).toBeInTheDocument()
    expect(screen.getByTestId('storage-summary-shifts')).toBeInTheDocument()
    expect(screen.getByTestId('storage-summary-addresses')).toBeInTheDocument()
    expect(screen.getByText('Turnos de Trabalho')).toBeInTheDocument()
    expect(screen.getByText('Endereços')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /limpar todos os dados locais/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/esta ação não altera nem remove nenhum dado salvo na nuvem/i),
    ).toBeInTheDocument()
  })

  it('asks for confirmation and keeps the data on Cancelar', () => {
    renderSettings()

    fireEvent.click(
      screen.getByRole('button', { name: /limpar todos os dados locais/i }),
    )

    expect(
      screen.getByText(/tem certeza de que deseja apagar todos os dados locais\?/i),
    ).toBeInTheDocument()

    const cancelBtn = screen.getByRole('button', { name: /cancelar/i })
    fireEvent.click(cancelBtn)

    expect(
      screen.queryByRole('heading', { name: /limpar todos os dados locais/i }),
    ).not.toBeInTheDocument()
    // The data is still in the store
    expect(useScheduleStore.getState().persons.length).toBe(1)
    expect(useScheduleStore.getState().addresses.length).toBe(1)
  })

  it('clears every local data and shows feedback after confirming', async () => {
    renderSettings()

    fireEvent.click(
      screen.getByRole('button', { name: /limpar todos os dados locais/i }),
    )

    const confirmBtn = screen.getByRole('button', { name: /sim, limpar tudo/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(
        screen.getByText('Todos os dados locais foram apagados com sucesso!'),
      ).toBeInTheDocument()
    })

    // The store is fully reset, shifts and rules included
    expect(useScheduleStore.getState().persons).toEqual([])
    expect(useScheduleStore.getState().assignments).toEqual({})
    expect(useScheduleStore.getState().events).toEqual([])
    expect(useScheduleStore.getState().addresses).toEqual([])
    expect(useScheduleStore.getState().shiftDefinitions).toEqual([])
    expect(useScheduleStore.getState().shiftRules).toEqual([])
  })

  it('shows the clear button to admins, regular users and guests', () => {
    const regularUserAuth: Partial<AuthContextType> = {
      user: {
        uid: 'user_123',
        email: 'medico@hospital.com',
      } as unknown as User,
      role: 'user',
      isAdmin: false,
      isGuest: false,
    }

    const { unmount } = renderSettings(regularUserAuth)
    expect(
      screen.getByRole('button', { name: /limpar todos os dados locais/i }),
    ).toBeInTheDocument()
    unmount()

    const guestUserAuth: Partial<AuthContextType> = {
      user: {
        uid: 'guest_456',
        displayName: 'Convidado Teste',
      } as unknown as User,
      role: 'user',
      isAdmin: false,
      isGuest: true,
    }

    renderSettings(guestUserAuth)
    expect(
      screen.getByRole('button', { name: /limpar todos os dados locais/i }),
    ).toBeInTheDocument()
  })

  it('switches between the Geral and Importar Dados tabs', () => {
    renderSettings()

    // Default tab is Geral
    expect(screen.getByTestId('clear-local-data-card')).toBeInTheDocument()

    // Click Importar Dados tab
    const importTab = screen.getByRole('tab', { name: /importar dados/i })
    fireEvent.click(importTab)

    // General sections are hidden, import view content is displayed
    expect(screen.queryByTestId('clear-local-data-card')).not.toBeInTheDocument()
    expect(screen.getByText(/Selecione o arquivo de backup/i)).toBeInTheDocument()

    // Click Geral tab
    const generalTab = screen.getByRole('tab', { name: /geral/i })
    fireEvent.click(generalTab)

    expect(screen.getByTestId('clear-local-data-card')).toBeInTheDocument()
  })

  it('opens the import tab from Importar ou Restaurar', async () => {
    renderSettings()

    const importButton = screen.getByRole('button', { name: /importar ou restaurar/i })
    await act(async () => {
      fireEvent.click(importButton)
    })

    expect(screen.getByText(/Selecione o arquivo de backup/i)).toBeInTheDocument()
  })
})

describe('SettingsView - enable cloud sync', () => {
  const adminAuth: Partial<AuthContextType> = {
    user: { uid: 'admin_1' } as User,
    role: 'admin',
    isAdmin: true,
  }

  const { pullCloudData, forcePushCloudData } = useScheduleStore.getState()

  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
    localStorage.clear()
  })

  afterEach(() => {
    act(() => {
      useScheduleStore.setState({ pullCloudData, forcePushCloudData })
    })
    vi.restoreAllMocks()
  })

  const handleOpenEnableModal = () => {
    fireEvent.click(screen.getByTestId('toggle-sync-button'))
    return screen.getByRole('dialog', { name: /ativar sincronização na nuvem/i })
  }

  it('asks which data wins before enabling, without sending anything', () => {
    const pushSpy = vi.fn()
    useScheduleStore.setState({ forcePushCloudData: pushSpy })
    renderSettings(adminAuth)

    handleOpenEnableModal()

    expect(pushSpy).not.toHaveBeenCalled()
    expect(CloudSyncService.isSyncEnabled()).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /^cancelar$/i }))
    expect(screen.queryByRole('dialog', { name: /ativar sincronização/i })).not.toBeInTheDocument()
    expect(CloudSyncService.isSyncEnabled()).toBe(false)
  })

  it('enables sync after pulling the cloud data', async () => {
    const pullSpy = vi.fn().mockResolvedValue({ success: true, code: 'success', message: '' })
    useScheduleStore.setState({ pullCloudData: pullSpy })
    renderSettings(adminAuth)

    handleOpenEnableModal()
    fireEvent.click(screen.getByTestId('enable-sync-pull'))

    await waitFor(() => expect(CloudSyncService.isSyncEnabled()).toBe(true))
    expect(pullSpy).toHaveBeenCalledWith(true)
  })

  it('keeps sync disabled when the push fails while offline', async () => {
    const pushSpy = vi.fn().mockResolvedValue({ success: false, code: 'offline', message: '' })
    useScheduleStore.setState({ forcePushCloudData: pushSpy })
    renderSettings(adminAuth)

    handleOpenEnableModal()
    fireEvent.click(screen.getByTestId('enable-sync-push'))

    await waitFor(() => {
      expect(useToastStore.getState().toasts).toEqual([
        expect.objectContaining({ type: 'error', message: expect.stringMatching(/sem conexão/i) }),
      ])
    })
    expect(pushSpy).toHaveBeenCalledWith(true)
    expect(CloudSyncService.isSyncEnabled()).toBe(false)
  })
})
