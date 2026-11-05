import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../context/auth-context'
import { i18n, LANGUAGE_STORAGE_KEY } from '../i18n'
import { LoginPage } from './login-page'
import { useScheduleStore } from '../store/use-schedule-store'
import { getFriendlyAuthErrorMessage } from '../utils/auth-errors'

import type { AuthContextType } from '../context/auth-context'

describe('LoginPage', () => {
  beforeEach(async () => {
    vi.restoreAllMocks()
    localStorage.clear()
    if (typeof document !== 'undefined') {
      document.cookie = ''
    }
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'pt-BR')
    await i18n.changeLanguage('pt-BR')
  })

  const renderWithAuth = (
    authOverrides?: Partial<AuthContextType>,
    initialEntries = ['/login'],
  ) => {
    const defaultAuth: Partial<AuthContextType> = {
      user: null,
      role: null,
      isAdmin: false,
      isGuest: false,
      loading: false,
      login: vi.fn(),
      loginAsGuest: vi.fn(),
      logout: vi.fn(),
      guestProfiles: [],
      deleteGuestProfile: vi.fn(),
      ...authOverrides,
    }

    return render(
      <AuthProvider value={defaultAuth}>
        <MemoryRouter initialEntries={initialEntries}>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>,
    )
  }

  it('renders the email and password fields and the login button', () => {
    renderWithAuth()

    expect(screen.getByTestId('login-page')).toBeInTheDocument()
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^senha \*$/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /entrar na aplicação/i }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('enter-as-guest-btn')).toBeInTheDocument()
  })

  it('toggles the password visibility', () => {
    renderWithAuth()

    const passwordInput = screen.getByLabelText(/^senha \*$/i) as HTMLInputElement
    expect(passwordInput.type).toBe('password')

    const toggleBtn = screen.getByRole('button', { name: /exibir senha/i })
    fireEvent.click(toggleBtn)
    expect(passwordInput.type).toBe('text')

    fireEvent.click(screen.getByRole('button', { name: /ocultar senha/i }))
    expect(passwordInput.type).toBe('password')
  })

  it('shows a friendly error for invalid credentials', async () => {
    const mockLogin = vi
      .fn()
      .mockRejectedValue({ code: 'auth/invalid-credential' })
    renderWithAuth({ login: mockLogin })

    const emailInput = screen.getByLabelText(/e-mail/i)
    const passwordInput = screen.getByLabelText(/^senha \*$/i)

    fireEvent.change(emailInput, { target: { value: 'errado@exemplo.com' } })
    fireEvent.change(passwordInput, { target: { value: 'senha123' } })

    const submitBtn = screen.getByRole('button', {
      name: /entrar na aplicação/i,
    })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('errado@exemplo.com', 'senha123')
      expect(screen.getByTestId('login-error-banner')).toBeInTheDocument()
      expect(
        screen.getByText(
          getFriendlyAuthErrorMessage('auth/invalid-credential'),
        ),
      ).toBeInTheDocument()
    })
  })

  it('disables the button while submitting to prevent double submits', async () => {
    let resolveLogin: () => void = () => {}
    const mockLogin = vi.fn().mockReturnValue(
      new Promise<void>((res) => {
        resolveLogin = res
      }),
    )

    renderWithAuth({ login: mockLogin })

    fireEvent.change(screen.getByLabelText(/e-mail/i), {
      target: { value: 'medico@hospital.com' },
    })
    fireEvent.change(screen.getByLabelText(/^senha \*$/i), {
      target: { value: 'segredo123' },
    })

    const submitBtn = screen.getByRole('button', {
      name: /entrar na aplicação/i,
    })
    fireEvent.click(submitBtn)

    // Should indicate loading state and be disabled
    expect(screen.getByText(/autenticando.../i)).toBeInTheDocument()
    expect(submitBtn).toBeDisabled()

    // Finish submission
    resolveLogin()
    await waitFor(() => {
      expect(submitBtn).not.toBeDisabled()
    })
  })

  it('opens the guest modal and lists the saved accounts', () => {
    const mockProfiles = [
      {
        id: 'g1',
        name: 'Dr. Roberto',
        createdAt: '2026-10-18T10:00:00Z',
        lastActiveAt: '2026-10-18T10:00:00Z',
      },
      {
        id: 'g2',
        name: 'Dra. Mariana',
        createdAt: '2026-10-18T11:00:00Z',
        lastActiveAt: '2026-10-18T11:00:00Z',
      },
    ]

    renderWithAuth({ guestProfiles: mockProfiles })

    // Open modal
    fireEvent.click(screen.getByTestId('enter-as-guest-btn'))

    expect(screen.getByTestId('guest-modal')).toBeInTheDocument()
    expect(screen.getByText('Dr. Roberto')).toBeInTheDocument()
    expect(screen.getByText('Dra. Mariana')).toBeInTheDocument()
  })

  it('signs in as an existing guest from the list', async () => {
    const mockLoginAsGuest = vi.fn().mockResolvedValue(undefined)
    const mockProfiles = [
      {
        id: 'g1',
        name: 'Dr. Roberto',
        createdAt: '2026-10-18T10:00:00Z',
        lastActiveAt: '2026-10-18T10:00:00Z',
      },
    ]

    renderWithAuth({
      loginAsGuest: mockLoginAsGuest,
      guestProfiles: mockProfiles,
    })

    fireEvent.click(screen.getByTestId('enter-as-guest-btn'))
    fireEvent.click(screen.getByTestId('select-guest-g1'))

    await waitFor(() => {
      expect(mockLoginAsGuest).toHaveBeenCalledWith('', 'g1')
    })
  })

  it('creates a new guest from a name', async () => {
    const mockLoginAsGuest = vi.fn().mockResolvedValue(undefined)

    renderWithAuth({
      loginAsGuest: mockLoginAsGuest,
      guestProfiles: [],
    })

    fireEvent.click(screen.getByTestId('enter-as-guest-btn'))

    const nameInput = screen.getByPlaceholderText(/Nome do novo usuário/i)
    fireEvent.change(nameInput, { target: { value: 'Dra. Vanessa' } })

    fireEvent.click(screen.getByTestId('create-guest-submit-btn'))

    await waitFor(() => {
      expect(mockLoginAsGuest).toHaveBeenCalledWith('Dra. Vanessa')
    })
  })

  it('deletes a saved guest profile', () => {
    const mockDelete = vi.fn()
    const mockProfiles = [
      {
        id: 'g1',
        name: 'Dr. Roberto',
        createdAt: '2026-10-18T10:00:00Z',
        lastActiveAt: '2026-10-18T10:00:00Z',
      },
    ]

    renderWithAuth({
      guestProfiles: mockProfiles,
      deleteGuestProfile: mockDelete,
    })

    fireEvent.click(screen.getByTestId('enter-as-guest-btn'))
    fireEvent.click(screen.getByTestId('delete-guest-g1'))

    expect(mockDelete).toHaveBeenCalledWith('g1')
  })

  describe('language detection', () => {
    it('starts in Portuguese when the browser is "pt-BR" and nothing is saved', async () => {
      localStorage.clear()
      document.cookie = ''
      const originalLang = navigator.language
      Object.defineProperty(navigator, 'language', {
        value: 'pt-BR',
        configurable: true,
      })

      renderWithAuth()

      await waitFor(() => {
        expect(i18n.language).toBe('pt-BR')
      })

      Object.defineProperty(navigator, 'language', {
        value: originalLang,
        configurable: true,
      })
    })

    it('starts in Portuguese when the browser is "pt" and nothing is saved', async () => {
      localStorage.clear()
      document.cookie = ''
      const originalLang = navigator.language
      Object.defineProperty(navigator, 'language', {
        value: 'pt',
        configurable: true,
      })

      renderWithAuth()

      await waitFor(() => {
        expect(i18n.language).toBe('pt-BR')
      })

      Object.defineProperty(navigator, 'language', {
        value: originalLang,
        configurable: true,
      })
    })

    it('starts in English for any other browser language (e.g. "fr" or "es") when nothing is saved', async () => {
      localStorage.clear()
      document.cookie = ''
      const originalLang = navigator.language
      Object.defineProperty(navigator, 'language', {
        value: 'fr-FR',
        configurable: true,
      })

      renderWithAuth()

      await waitFor(() => {
        expect(i18n.language).toBe('en-US')
      })

      Object.defineProperty(navigator, 'language', {
        value: originalLang,
        configurable: true,
      })
    })

    it('keeps the language saved in localStorage regardless of the browser language', async () => {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, 'pt-BR')
      const originalLang = navigator.language
      Object.defineProperty(navigator, 'language', {
        value: 'en-US',
        configurable: true,
      })

      renderWithAuth()

      await waitFor(() => {
        expect(i18n.language).toBe('pt-BR')
      })

      Object.defineProperty(navigator, 'language', {
        value: originalLang,
        configurable: true,
      })
    })
  })

  describe('theme toggle', () => {
    it('renders the theme toggle next to the language selector and toggles the theme', () => {
      renderWithAuth()

      const themeBtn = screen.getByTestId('login-theme-toggle-btn')
      expect(themeBtn).toBeInTheDocument()

      const initialDarkMode = useScheduleStore.getState().isDarkMode
      fireEvent.click(themeBtn)
      expect(useScheduleStore.getState().isDarkMode).toBe(!initialDarkMode)

      fireEvent.click(themeBtn)
      expect(useScheduleStore.getState().isDarkMode).toBe(initialDarkMode)
    })
  })
})
