import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ItemHistory } from './item-history'
import { ItemMaintenance } from './item-maintenance'
import { useScheduleStore } from '../../store/use-schedule-store'
import { searchExpenseItems } from '../../utils/expense-item-utils'

describe('ItemMaintenance', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()

    useScheduleStore.setState({
      expenseItems: [
        {
          id: 'item-a',
          name: 'Fralda G',
          normalizedName: 'fralda g',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'item-b',
          name: 'Fralda Geriátrica G',
          normalizedName: 'fralda geriatrica g',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      expenses: [
        {
          id: 'exp-a',
          date: '2026-10-01',
          description: 'Compra A',
          amount: 80,
          items: [
            {
              id: 'line-a',
              itemId: 'item-a',
              itemName: 'Fralda G',
              quantity: 1,
            },
          ],
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-01T10:00:00.000Z',
        },
        {
          id: 'exp-b',
          date: '2026-11-02',
          description: 'Compra B',
          amount: 90,
          items: [
            {
              id: 'line-b',
              itemId: 'item-b',
              itemName: 'Fralda Geriátrica G',
              quantity: 1,
            },
          ],
          createdAt: '2026-11-02T10:00:00.000Z',
          updatedAt: '2026-11-02T10:00:00.000Z',
        },
      ],
    })
  })

  it('shows translated errors when renaming to an empty name (NAME_REQUIRED) or a conflicting name (NAME_CONFLICT)', async () => {
    const itemA = useScheduleStore.getState().expenseItems[0]
    render(<ItemMaintenance item={itemA} onClose={vi.fn()} />)

    const renameInput = screen.getByTestId('item-maintenance-rename-input')

    // Empty name -> NAME_REQUIRED
    fireEvent.change(renameInput, { target: { value: '   ' } })
    fireEvent.click(screen.getByTestId('item-maintenance-rename-submit'))

    expect(
      await screen.findByTestId('item-maintenance-error-NAME_REQUIRED'),
    ).toBeInTheDocument()

    // Conflicting name -> NAME_CONFLICT
    fireEvent.change(renameInput, { target: { value: 'Fralda Geriátrica G' } })
    fireEvent.click(screen.getByTestId('item-maintenance-rename-submit'))

    expect(
      await screen.findByTestId('item-maintenance-error-NAME_CONFLICT'),
    ).toBeInTheDocument()
  })

  it('asks for confirmation before merging, then removes the source item from search and combines purchase history in the target item', async () => {
    const itemA = useScheduleStore.getState().expenseItems[0]
    const onClose = vi.fn()
    const { unmount } = render(
      <ItemMaintenance item={itemA} onClose={onClose} />,
    )

    fireEvent.change(screen.getByTestId('item-maintenance-merge-select'), {
      target: { value: 'item-b' },
    })
    fireEvent.click(screen.getByTestId('item-maintenance-merge-submit'))

    // ConfirmDialog opens
    const confirmBtn = await screen.findByTestId('confirm-dialog-confirm')
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    // Source item disappears from search
    const state = useScheduleStore.getState()
    const searchResults = searchExpenseItems(
      'Fralda',
      state.expenseItems,
      state.expenses,
      { referenceDate: '2026-11-05' },
    )
    expect(searchResults.map((r) => r.item.id)).toEqual(['item-b'])

    unmount()

    // Target item history now combines purchases of item-a and item-b (2026-10-01 and 2026-11-02 -> 32 days)
    render(<ItemHistory itemId="item-b" />)
    fireEvent.click(screen.getByTestId('item-history-mode-full'))
    expect(screen.getAllByTestId(/^item-history-entry-/)).toHaveLength(2)
    expect(screen.getByTestId('item-history-avg-interval')).toHaveTextContent(
      '32',
    )
  })
})

