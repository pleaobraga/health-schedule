import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { MedicationVersionForm } from './medications/medication-version-form'
import { DayEventsModal } from './modals/day-events-modal'
import { MonthShiftConfigModal } from './modals/month-shift-config-modal'
import { GlobalPersonModal } from './people-management/global-person-modal'
import { ItemMaintenance } from './purchases/item-maintenance'
import { PurchaseForm } from './purchases/purchase-form'
import { PersonModal } from './sidebar/person-modal'
import { DatePicker } from './ui/date-picker'
import { Select } from './ui/select'
import { CreateUserModal } from './users/create-user-modal'
import { AuthProvider } from '../context/auth-context'
import enAddresses from '../locales/en-US/addresses.json'
import enCalendar from '../locales/en-US/calendar.json'
import enMedications from '../locales/en-US/medications.json'
import enPurchases from '../locales/en-US/purchases.json'
import ptAddresses from '../locales/pt-BR/addresses.json'
import ptCalendar from '../locales/pt-BR/calendar.json'
import ptMedications from '../locales/pt-BR/medications.json'
import ptPurchases from '../locales/pt-BR/purchases.json'
import { AddressManagementView } from '../pages/address-management-view'
import { LoginPage } from '../pages/login-page'
import { useScheduleStore } from '../store/use-schedule-store'

const NO_DAYS: number[] = []

const labelTextOf = (input: Element): string => {
  let parent = input.parentElement
  while (parent) {
    const label = parent.querySelector('label')
    if (label) return label.textContent?.trim() ?? ''
    parent = parent.parentElement
  }
  return ''
}

const expectRequiredLabelsMarked = () => {
  const inputs = Array.from(document.querySelectorAll('input[required]'))
  expect(inputs.length).toBeGreaterThan(0)
  inputs.forEach((input) => {
    expect(labelTextOf(input)).toMatch(/\*$/)
  })
}

describe('required field labels', () => {
  it('marks the login fields', () => {
    render(
      <AuthProvider value={{ user: null, role: null, isGuest: false, loading: false, guestProfiles: [] }}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>,
    )

    expectRequiredLabelsMarked()
  })

  it('marks the new user fields', () => {
    render(<CreateUserModal isOpen onClose={vi.fn()} onUserCreated={vi.fn()} />)

    expectRequiredLabelsMarked()
  })

  it('marks the new shift fields of the month shift setup', () => {
    useScheduleStore.setState({ shiftDefinitions: [], monthDailyShifts: {} })
    render(<MonthShiftConfigModal isOpen onClose={vi.fn()} currentMonth="2026-10" />)

    fireEvent.click(screen.getAllByRole('button', { name: /Novo Plantão/i })[0])

    expectRequiredLabelsMarked()
  })

  it('marks the item name of a purchase line and the item maintenance fields', () => {
    useScheduleStore.setState({
      expenses: [],
      expenseItems: [
        { id: 'a', name: 'Fralda', normalizedName: 'fralda', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
        { id: 'b', name: 'Lenço', normalizedName: 'lenco', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      ],
    })

    const { unmount } = render(<PurchaseForm onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('purchase-add-line'))
    expect(screen.getByLabelText(/Nome do Item/i).id).toBe('purchase-line-name-0')
    expect(labelTextOf(screen.getByTestId('purchase-line-name-0'))).toMatch(/\*$/)
    unmount()

    render(
      <ItemMaintenance
        item={useScheduleStore.getState().expenseItems[0]}
        onClose={vi.fn()}
      />,
    )
    expect(document.querySelector('label[for="item-maintenance-rename-input"]')?.textContent).toMatch(/\*$/)
    expect(document.querySelector('label[for="item-maintenance-merge-select"]')?.textContent).toMatch(/\*$/)
  })

  it('marks the required fields in MedicationVersionForm', () => {
    render(<MedicationVersionForm mode="NEW" onClose={vi.fn()} />)

    expect(document.querySelector('label[for="medication-form-effective-date-input"]')?.textContent).toMatch(/\*$/)
    expect(document.querySelector('label[for="medication-form-professional-input"]')?.textContent).toMatch(/\*$/)
    expect(document.querySelector('label[for="medication-form-explanation-input"]')?.textContent).toMatch(/\*$/)
  })
})

describe('optional wording', () => {
  const collectStrings = (value: unknown): string[] => {
    if (typeof value === 'string') return [value]
    if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings)
    return []
  }

  it.each([
    ['pt-BR', [ptAddresses, ptCalendar, ptPurchases, ptMedications]],
    ['en-US', [enAddresses, enCalendar, enPurchases, enMedications]],
  ])('has no optional wording in %s form texts', (_, files) => {
    files.flatMap(collectStrings).forEach((text) => {
      expect(text).not.toMatch(/opcional|optional/i)
    })
  })

  it('shows the no-person expense option without an explanation', () => {
    expect(ptCalendar.eventsModal.noExpensePersonOption).toBe('Nenhum profissional')
    expect(enCalendar.eventsModal.noExpensePersonOption).toBe('No professional')
  })
})

describe('invalid required fields', () => {
  it('flags the visible trigger of DatePicker and Select', () => {
    render(
      <>
        <DatePicker data-testid="date" value="" onChange={vi.fn()} invalid />
        <Select data-testid="select" value="" aria-invalid onChange={vi.fn()}>
          <option value="">-</option>
        </Select>
      </>,
    )

    expect(screen.getByTestId('date-trigger')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByTestId('select-trigger')).toHaveAttribute('aria-invalid', 'true')
  })

  it('does not flag DatePicker and Select by default', () => {
    render(
      <>
        <DatePicker data-testid="date" value="" onChange={vi.fn()} />
        <Select data-testid="select" value="" onChange={vi.fn()}>
          <option value="">-</option>
        </Select>
      </>,
    )

    expect(screen.getByTestId('date-trigger')).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByTestId('select-trigger')).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('flags each empty address field in turn and clears it on typing', () => {
    useScheduleStore.setState({ addresses: [] })
    render(<AddressManagementView />)
    fireEvent.click(screen.getAllByRole('button', { name: /Novo Endereço/i })[0])

    const name = document.getElementById('address-name') as HTMLInputElement
    const street = document.getElementById('address-street') as HTMLInputElement
    const number = document.getElementById('address-number') as HTMLInputElement
    const submit = screen.getByRole('button', { name: /Cadastrar Endereço/i })

    fireEvent.click(submit)
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(street).not.toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(name, { target: { value: 'Clínica' } })
    expect(name).not.toHaveAttribute('aria-invalid', 'true')

    fireEvent.click(submit)
    expect(street).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(street, { target: { value: 'Rua A' } })
    fireEvent.click(submit)
    expect(number).toHaveAttribute('aria-invalid', 'true')
  })

  it('flags the event title and the expense fields', async () => {
    useScheduleStore.setState({
      selectedDateForEvents: '2026-10-15',
      dayEventsModalTab: 'events',
      events: [],
      expenses: [],
    })
    const { unmount } = render(<DayEventsModal />)

    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar Evento/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /^Adicionar Evento$/i }))

    const title = screen.getByPlaceholderText(/Auditoria ou Reunião/i)
    expect(title).toHaveAttribute('aria-invalid', 'true')
    fireEvent.change(title, { target: { value: 'Reunião' } })
    expect(title).not.toHaveAttribute('aria-invalid', 'true')
    unmount()

    useScheduleStore.setState({ dayEventsModalTab: 'expenses' })
    render(<DayEventsModal />)
    fireEvent.click(screen.getByTestId('tab-expenses'))
    fireEvent.click(screen.getAllByTestId('open-add-expense-btn')[0])

    const submit = screen.getByTestId('submit-expense-btn')
    await act(async () => {
      fireEvent.click(submit)
    })
    const description = document.getElementById('expense-description') as HTMLInputElement
    const amount = document.getElementById('expense-amount') as HTMLInputElement
    expect(description).toHaveAttribute('aria-invalid', 'true')
    expect(amount).not.toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(description, { target: { value: 'Farmácia' } })
    await act(async () => {
      fireEvent.click(submit)
    })
    expect(description).not.toHaveAttribute('aria-invalid', 'true')
    expect(amount).toHaveAttribute('aria-invalid', 'true')
  })

  it('flags the purchase fields from the validation errors', async () => {
    useScheduleStore.setState({ expenses: [], expenseItems: [] })
    render(<PurchaseForm onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('purchase-add-line'))

    await act(async () => {
      fireEvent.click(screen.getByTestId('purchase-submit'))
    })

    expect(screen.getByTestId('purchase-description-input')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByTestId('purchase-amount-input')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByTestId('purchase-line-name-0')).toHaveAttribute('aria-invalid', 'true')

    fireEvent.change(screen.getByTestId('purchase-description-input'), {
      target: { value: 'Mercado' },
    })
    expect(screen.getByTestId('purchase-description-input')).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('flags an empty purchase date on its visible trigger', async () => {
    useScheduleStore.setState({ expenses: [], expenseItems: [] })
    render(<PurchaseForm onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('purchase-date-input'), { target: { value: '' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('purchase-submit'))
    })

    expect(screen.getByTestId('purchase-date-input-trigger')).toHaveAttribute('aria-invalid', 'true')
  })

  it('flags the item maintenance fields', async () => {
    useScheduleStore.setState({
      expenses: [],
      expenseItems: [
        { id: 'a', name: 'Fralda', normalizedName: 'fralda', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
        { id: 'b', name: 'Lenço', normalizedName: 'lenco', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      ],
    })
    render(
      <ItemMaintenance
        item={useScheduleStore.getState().expenseItems[0]}
        onClose={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByTestId('item-maintenance-rename-input'), { target: { value: '  ' } })
    await act(async () => {
      fireEvent.click(screen.getByTestId('item-maintenance-rename-submit'))
    })
    expect(screen.getByTestId('item-maintenance-rename-input')).toHaveAttribute('aria-invalid', 'true')

    fireEvent.click(screen.getByTestId('item-maintenance-merge-submit'))
    expect(screen.getByTestId('item-maintenance-merge-select-trigger')).toHaveAttribute('aria-invalid', 'true')
  })

  it.each([
    [
      'PersonModal',
      () => (
        <PersonModal
          isOpen
          onClose={vi.fn()}
          currentMonth="2026-10"
          initialAvailableDays={NO_DAYS}
          onSave={vi.fn()}
        />
      ),
    ],
    ['GlobalPersonModal', () => <GlobalPersonModal isOpen onClose={vi.fn()} onSave={vi.fn()} />],
  ])('flags the empty name in %s', (_, renderModal) => {
    render(renderModal())

    const name = document.querySelector('form input[type="text"]') as HTMLInputElement
    fireEvent.submit(name.closest('form') as HTMLFormElement)

    expect(name).toHaveAttribute('aria-invalid', 'true')
  })

  it('flags a blank guest name', () => {
    render(
      <AuthProvider value={{ user: null, role: null, isGuest: false, loading: false, guestProfiles: [] }}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </AuthProvider>,
    )
    fireEvent.click(screen.getByTestId('enter-as-guest-btn'))

    const guestName = document.getElementById('new-guest-name') as HTMLInputElement
    fireEvent.change(guestName, { target: { value: '   ' } })
    fireEvent.submit(guestName.closest('form') as HTMLFormElement)

    expect(guestName).toHaveAttribute('aria-invalid', 'true')
  })
})
