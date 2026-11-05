import { act, fireEvent, render, screen } from '@testing-library/react'
import { format } from 'date-fns'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ItemHistory } from './item-history'
import { i18n } from '../../i18n'
import { useScheduleStore } from '../../store/use-schedule-store'

describe('ItemHistory', () => {
  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
    await i18n.changeLanguage('pt-BR')

    useScheduleStore.setState({
      expenseItems: [
        {
          id: 'item-1',
          name: 'Fralda Geriátrica',
          normalizedName: 'fralda geriatrica',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'item-single',
          name: 'Sabonete Líquido',
          normalizedName: 'sabonete liquido',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'item-empty',
          name: 'Algodão Hidrófilo',
          normalizedName: 'algodao hidrofilo',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      expenses: [
        {
          id: 'exp-oct',
          date: '2026-10-01',
          description: 'Farmácia Outubro',
          amount: 90,
          items: [
            {
              id: 'l-oct',
              itemId: 'item-1',
              itemName: 'Fralda Geriátrica',
              quantity: 1,
            },
          ],
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-01T10:00:00.000Z',
        },
        {
          id: 'exp-nov',
          date: '2026-11-02',
          description: 'Farmácia Novembro',
          amount: 95,
          items: [
            {
              id: 'l-nov',
              itemId: 'item-1',
              itemName: 'Fralda Geriátrica',
              quantity: 1,
            },
          ],
          createdAt: '2026-11-02T10:00:00.000Z',
          updatedAt: '2026-11-02T10:00:00.000Z',
        },
        {
          id: 'exp-single',
          date: '2026-10-15',
          description: 'Compra Única',
          amount: 25,
          items: [
            {
              id: 'l-single',
              itemId: 'item-single',
              itemName: 'Sabonete Líquido',
              quantity: 1,
            },
          ],
          createdAt: '2026-10-15T10:00:00.000Z',
          updatedAt: '2026-10-15T10:00:00.000Z',
        },
      ],
    })
  })

  it('shows the last purchase date and elapsed days up to today in the initial LAST mode', () => {
    render(<ItemHistory itemId="item-1" />)

    expect(screen.getByTestId('item-history-last-date')).toHaveTextContent(
      '02/11/2026',
    )
    expect(screen.getByTestId('item-history-days-since')).toBeInTheDocument()
    // In LAST mode, only 1 entry is rendered in the entries list
    expect(screen.getAllByTestId(/^item-history-entry-/)).toHaveLength(1)
  })

  it('lists all purchase dates across months and shows 32 days between 2026-10-01 and 2026-11-02 in FULL mode', () => {
    render(<ItemHistory itemId="item-1" />)

    fireEvent.click(screen.getByTestId('item-history-mode-full'))

    const entries = screen.getAllByTestId(/^item-history-entry-/)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toHaveTextContent('01/10/2026')
    expect(entries[1]).toHaveTextContent('02/11/2026')
    expect(entries[1]).toHaveTextContent('32')
    expect(screen.getByTestId('item-history-avg-interval')).toHaveTextContent(
      '32',
    )
  })

  it('does not show an interval for an item with a single purchase and does not crash for an item with zero purchases', () => {
    const { rerender } = render(<ItemHistory itemId="item-single" />)

    fireEvent.click(screen.getByTestId('item-history-mode-full'))
    expect(
      screen.queryByTestId('item-history-avg-interval'),
    ).not.toBeInTheDocument()
    expect(screen.getAllByTestId(/^item-history-entry-/)).toHaveLength(1)

    rerender(<ItemHistory itemId="item-empty" />)
    expect(screen.getByTestId('item-history-empty')).toBeInTheDocument()
    expect(screen.queryAllByTestId(/^item-history-entry-/)).toHaveLength(0)
  })

  it('formats dates according to the active language (pt-BR vs en-US)', async () => {
    // Ensure a purchase date that is on or before today so it is always included
    const today = format(new Date(), 'yyyy-MM-dd')
    useScheduleStore.setState({
      expenses: [
        {
          id: 'exp-1',
          date: '2026-10-05',
          description: 'Compra',
          amount: 50,
          items: [{ id: 'l-1', itemId: 'item-1', itemName: 'Fralda Geriátrica' }],
          createdAt: `${today}T10:00:00.000Z`,
          updatedAt: `${today}T10:00:00.000Z`,
        },
      ],
    })

    const { rerender } = render(<ItemHistory itemId="item-1" />)
    expect(screen.getByTestId('item-history-last-date')).toHaveTextContent(
      '05/10/2026',
    )

    await act(async () => {
      await i18n.changeLanguage('en-US')
    })
    rerender(<ItemHistory itemId="item-1" />)
    expect(screen.getByTestId('item-history-last-date')).toHaveTextContent(
      '10/05/2026',
    )
  })
})

