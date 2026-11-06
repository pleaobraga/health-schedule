import { fireEvent, render, screen, within } from '@testing-library/react'
import { onAuthStateChanged } from 'firebase/auth'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from './auth-context'
import { AppRoutes } from '../router'
import { CloudSyncService } from '../services/cloud-sync-service'
import { StorageService } from '../services/storage-service'

import type * as firebaseAuth from 'firebase/auth'

vi.mock('../services/firebase', () => {
  const notConfigured = () => {
    throw new Error('Firebase is not configured')
  }
  return {
    auth: null,
    db: null,
    firebaseConfig: {},
    isFirebaseConfigured: false,
    requireAuth: notConfigured,
    requireDb: notConfigured,
  }
})

vi.mock('firebase/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof firebaseAuth>()),
  onAuthStateChanged: vi.fn(),
}))

function renderApp() {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/login']}>
        <AppRoutes />
      </MemoryRouter>
    </AuthProvider>,
  )
}

async function enterAsGuest(name: string) {
  fireEvent.click(await screen.findByTestId('enter-as-guest-btn'))
  const modal = screen.getByTestId('guest-modal')
  fireEvent.change(within(modal).getByRole('textbox'), {
    target: { value: name },
  })
  fireEvent.click(screen.getByTestId('create-guest-submit-btn'))
}

describe('guest mode without Firebase', () => {
  beforeEach(() => {
    vi.mocked(onAuthStateChanged).mockClear()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('seed is not needed here')),
    )
  })

  it('shows only the guest entry, without the email form or the auth listener', async () => {
    renderApp()

    expect(await screen.findByTestId('enter-as-guest-btn')).toBeInTheDocument()
    expect(
      screen.getByTestId('login-page').querySelector('form'),
    ).not.toBeInTheDocument()
    expect(onAuthStateChanged).not.toHaveBeenCalled()
  })

  it('enters as a guest and logs out', async () => {
    renderApp()

    await enterAsGuest('Convidado')

    expect(await screen.findByTestId('calendar-view')).toBeInTheDocument()
    expect(StorageService.getActiveGuestId()).not.toBeNull()

    fireEvent.click(
      within(screen.getByTestId('hover-sidebar')).getByRole('button', {
        name: 'Sair da Conta',
      }),
    )

    expect(await screen.findByTestId('login-page')).toBeInTheDocument()
    expect(StorageService.getActiveGuestId()).toBeNull()
  })

  it('reports cloud sync as off even if it was enabled on this device', () => {
    CloudSyncService.setSyncEnabled(true)

    expect(CloudSyncService.isSyncEnabled()).toBe(false)
  })
})
