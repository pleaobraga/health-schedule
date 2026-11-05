import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PurchasesView } from './purchases-view'
import { TestAppRouter } from '../router'
import * as backupService from '../services/backup-service'
import { useScheduleStore } from '../store/use-schedule-store'
import { getCurrentMonth } from '../utils/date-utils'

describe('PurchasesView', () => {
  const currentMonth = getCurrentMonth()

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()

    useScheduleStore.setState({
      currentMonth: '2025-05',
      persons: [
        { id: 'person-1', name: 'Ana Paula', color: '#3B82F6', active: true },
        { id: 'person-2', name: 'Beatriz Silva', color: '#10B981', active: true },
      ],
      expenseItems: [
        {
          id: 'item-1',
          name: 'Fralda G',
          normalizedName: 'fralda g',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'item-2',
          name: 'Luva Descartável',
          normalizedName: 'luva descartavel',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      expenses: [
        {
          id: 'exp-current-1',
          date: `${currentMonth}-10`,
          description: 'Farmácia Central',
          amount: 120,
          category: 'MEDICATION',
          personId: 'person-1',
          personName: 'Ana Paula',
          items: [
            {
              id: 'line-1',
              itemId: 'item-1',
              itemName: 'Fralda G',
              quantity: 2,
              amount: 80,
            },
            {
              id: 'line-2',
              itemId: 'item-2',
              itemName: 'Luva Descartável',
              quantity: 1,
              amount: 30,
            },
          ],
          createdAt: '2026-10-10T10:00:00.000Z',
          updatedAt: '2026-10-10T10:00:00.000Z',
        },
        {
          id: 'exp-current-2',
          date: `${currentMonth}-08`,
          description: 'Uber Consulta',
          amount: 45,
          category: 'TRANSPORT',
          items: [],
          createdAt: '2026-10-08T10:00:00.000Z',
          updatedAt: '2026-10-08T10:00:00.000Z',
        },
        {
          id: 'exp-other-month',
          date: '2020-01-15',
          description: 'Compra Antiga de Outro Mês',
          amount: 99,
          category: 'OTHER',
          items: [
            {
              id: 'line-old',
              itemId: 'item-1',
              itemName: 'Fralda G',
              quantity: 1,
            },
          ],
          createdAt: '2020-01-15T10:00:00.000Z',
          updatedAt: '2020-01-15T10:00:00.000Z',
        },
      ],
      monthSnapshots: {},
    })
  })

  it('opens in the current month without listing purchases from another month', () => {
    render(
      <MemoryRouter>
        <PurchasesView />
      </MemoryRouter>,
    )

    expect(screen.getByTestId('purchases-view')).toBeInTheDocument()
    expect(screen.getByText('Farmácia Central')).toBeInTheDocument()
    expect(screen.getByText('Uber Consulta')).toBeInTheDocument()
    expect(
      screen.queryByText('Compra Antiga de Outro Mês'),
    ).not.toBeInTheDocument()
  })

  it('changes the filter month without altering the schedule store currentMonth', () => {
    render(
      <MemoryRouter>
        <PurchasesView />
      </MemoryRouter>,
    )

    expect(useScheduleStore.getState().currentMonth).toBe('2025-05')

    const prevMonthBtn = screen.getByTestId('purchases-prev-month')
    fireEvent.click(prevMonthBtn)

    expect(useScheduleStore.getState().currentMonth).toBe('2025-05')
    expect(screen.queryByText('Farmácia Central')).not.toBeInTheDocument()
  })

  it('filters purchases by category, professional, and item', () => {
    render(
      <MemoryRouter>
        <PurchasesView />
      </MemoryRouter>,
    )

    // Filter by category: TRANSPORT
    const categorySelect = screen.getByTestId('purchases-filter-category')
    fireEvent.change(categorySelect, { target: { value: 'TRANSPORT' } })

    expect(screen.getByText('Uber Consulta')).toBeInTheDocument()
    expect(screen.queryByText('Farmácia Central')).not.toBeInTheDocument()

    // Reset category and filter by professional
    fireEvent.change(categorySelect, { target: { value: '' } })
    const personSelect = screen.getByTestId('purchases-filter-person')
    fireEvent.change(personSelect, { target: { value: 'person-1' } })

    expect(screen.getByText('Farmácia Central')).toBeInTheDocument()
    expect(screen.queryByText('Uber Consulta')).not.toBeInTheDocument()

    // Reset professional and filter by item
    fireEvent.change(personSelect, { target: { value: '' } })
    const itemSelect = screen.getByTestId('purchases-filter-item')
    fireEvent.change(itemSelect, { target: { value: 'item-1' } })

    expect(screen.getByText('Farmácia Central')).toBeInTheDocument()
    expect(screen.queryByText('Uber Consulta')).not.toBeInTheDocument()
  })

  it('shows expenses without items alongside multi-item purchases', () => {
    render(
      <MemoryRouter>
        <PurchasesView />
      </MemoryRouter>,
    )

    expect(screen.getByText('Uber Consulta')).toBeInTheDocument()
    expect(screen.getByText('Farmácia Central')).toBeInTheDocument()
  })

  it('renders itemName, quantity, and line amount for each purchase line, plus the difference when total differs from subtotal', () => {
    render(
      <MemoryRouter>
        <PurchasesView />
      </MemoryRouter>,
    )

    expect(
      within(screen.getByTestId('expense-line-line-1')).getByText('Fralda G'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('expense-line-line-2')).getByText(
        'Luva Descartável',
      ),
    ).toBeInTheDocument()
    expect(screen.getByTestId('expense-line-qty-line-1')).toHaveTextContent('2')
    expect(screen.getByTestId('expense-line-amount-line-1')).toHaveTextContent(
      /80,00/,
    )
    expect(screen.getByTestId('expense-line-amount-line-2')).toHaveTextContent(
      /30,00/,
    )

    // Total is 120, lines sum to 110 -> difference +10,00
    expect(
      screen.getByTestId('expense-summary-diff-exp-current-1'),
    ).toHaveTextContent(/10,00/)

    // Exposes last purchase for each item line and opens item history showing all months
    expect(
      screen.getByTestId('expense-line-last-purchase-line-1'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('open-item-history-line-1'))
    expect(screen.getByTestId('item-history')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('item-history-mode-full'))
    expect(
      screen.getByTestId('item-history-entry-2020-01-15'),
    ).toBeInTheDocument()
  })

  it('navigates from the sidebar link to "/compras"', async () => {
    vi.spyOn(backupService, 'hasExistingLocalData').mockResolvedValue(true)

    render(<TestAppRouter initialEntries={['/']} />)

    const purchasesLinks = screen.getAllByRole('link', { name: /compras/i })
    fireEvent.click(purchasesLinks[0])

    await waitFor(() => {
      expect(screen.getByTestId('purchases-view')).toBeInTheDocument()
      expect(useScheduleStore.getState().currentView).toBe('purchases')
    })
  })
})
