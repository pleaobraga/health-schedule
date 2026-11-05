import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'

import { PurchaseForm } from './purchase-form'
import { useScheduleStore } from '../../store/use-schedule-store'
import { EXPENSE_IMPORT_MAX_BYTES } from '../../utils/expense-item-import'
import { searchExpenseItems } from '../../utils/expense-item-utils'
import { calculateMonthExpensesSummary } from '../../utils/shift-rate-utils'

const workbookFile = (
  rows: unknown[][],
  bookType: 'xlsx' | 'xls' = 'xlsx',
) => {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Lista')
  const data = XLSX.write(book, { type: 'array', bookType })
  return new File([data], `lista.${bookType}`)
}

describe('PurchaseForm', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()

    useScheduleStore.setState({
      currentMonth: '2026-11',
      persons: [
        { id: 'person-1', name: 'Ana Paula', color: '#3B82F6', active: true },
        { id: 'person-2', name: 'Beatriz Silva', color: '#10B981', active: true },
      ],
      expenseItems: [
        {
          id: 'item-1',
          name: 'Fralda Geriátrica',
          normalizedName: 'fralda geriatrica',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'item-2',
          name: 'Fralda Noturna',
          normalizedName: 'fralda noturna',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'item-3',
          name: 'Fralda Anatômica',
          normalizedName: 'fralda anatomica',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'item-4',
          name: 'Fralda Confort',
          normalizedName: 'fralda confort',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'item-5',
          name: 'Fralda Extra',
          normalizedName: 'fralda extra',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      expenses: [
        {
          id: 'exp-prev',
          date: '2026-10-01',
          description: 'Compra Outubro',
          amount: 100,
          items: [
            {
              id: 'line-prev-1',
              itemId: 'item-1',
              itemName: 'Fralda Geriátrica',
              quantity: 1,
              amount: 100,
            },
          ],
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-01T10:00:00.000Z',
        },
      ],
      monthSnapshots: {},
    })
  })

  it('saves a purchase with date, description, amount, category, professional, and two items', async () => {
    const onClose = vi.fn()
    render(<PurchaseForm onClose={onClose} />)

    fireEvent.change(screen.getByTestId('purchase-date-input'), {
      target: { value: '2026-11-05' },
    })
    fireEvent.change(screen.getByTestId('purchase-description-input'), {
      target: { value: 'Supermercado Central' },
    })
    fireEvent.change(screen.getByTestId('purchase-amount-input'), {
      target: { value: '150,00' },
    })
    fireEvent.change(screen.getByTestId('purchase-category-select'), {
      target: { value: 'SUPPLIES' },
    })
    fireEvent.change(screen.getByTestId('purchase-person-select'), {
      target: { value: 'person-1' },
    })

    // Add two lines
    fireEvent.click(screen.getByTestId('purchase-add-line'))
    fireEvent.click(screen.getByTestId('purchase-add-line'))

    fireEvent.change(screen.getByTestId('purchase-line-name-0'), {
      target: { value: 'Fralda Geriátrica' },
    })
    fireEvent.change(screen.getByTestId('purchase-line-qty-0'), {
      target: { value: '2' },
    })
    fireEvent.change(screen.getByTestId('purchase-line-amount-0'), {
      target: { value: '90,00' },
    })

    fireEvent.change(screen.getByTestId('purchase-line-name-1'), {
      target: { value: 'Sabonete Neutro' },
    })
    fireEvent.change(screen.getByTestId('purchase-line-qty-1'), {
      target: { value: '3' },
    })
    fireEvent.change(screen.getByTestId('purchase-line-amount-1'), {
      target: { value: '60,00' },
    })

    fireEvent.click(screen.getByTestId('purchase-submit'))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    const saved = useScheduleStore
      .getState()
      .expenses.find((e) => e.description === 'Supermercado Central')
    expect(saved).toBeDefined()
    expect(saved?.date).toBe('2026-11-05')
    expect(saved?.amount).toBe(150)
    expect(saved?.category).toBe('SUPPLIES')
    expect(saved?.personId).toBe('person-1')
    expect(saved?.personName).toBe('Ana Paula')
    expect(saved?.items).toHaveLength(2)
    expect(saved?.items[0].itemId).toBe('item-1')
    expect(saved?.items[0].quantity).toBe(2)
    expect(saved?.items[0].amount).toBe(90)
    expect(saved?.items[1].itemName).toBe('Sabonete Neutro')
    expect(saved?.items[1].quantity).toBe(3)
    expect(saved?.items[1].amount).toBe(60)
  })

  it('saves an expense without items', async () => {
    const onClose = vi.fn()
    render(<PurchaseForm onClose={onClose} />)

    fireEvent.change(screen.getByTestId('purchase-date-input'), {
      target: { value: '2026-11-05' },
    })
    fireEvent.change(screen.getByTestId('purchase-description-input'), {
      target: { value: 'Táxi Plantão' },
    })
    fireEvent.change(screen.getByTestId('purchase-amount-input'), {
      target: { value: '38,50' },
    })

    fireEvent.click(screen.getByTestId('purchase-submit'))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    const saved = useScheduleStore
      .getState()
      .expenses.find((e) => e.description === 'Táxi Plantão')
    expect(saved).toBeDefined()
    expect(saved?.amount).toBe(38.5)
    expect(saved?.items).toEqual([])
  })

  it('saves without professional and category so the purchase has no personId, personName or category and enters monthly closing as a general expense', async () => {
    const onClose = vi.fn()
    render(<PurchaseForm onClose={onClose} />)

    fireEvent.change(screen.getByTestId('purchase-date-input'), {
      target: { value: '2026-11-05' },
    })
    fireEvent.change(screen.getByTestId('purchase-description-input'), {
      target: { value: 'Mercado Bairro' },
    })
    fireEvent.change(screen.getByTestId('purchase-amount-input'), {
      target: { value: '75,00' },
    })

    fireEvent.click(screen.getByTestId('purchase-submit'))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    const saved = useScheduleStore
      .getState()
      .expenses.find((e) => e.description === 'Mercado Bairro')
    expect(saved).toBeDefined()
    expect(saved?.personId).toBeUndefined()
    expect(saved?.personName).toBeUndefined()
    expect(saved?.category).toBeUndefined()

    const closingSummary = calculateMonthExpensesSummary(
      useScheduleStore.getState().expenses,
      '2026-11',
    )
    expect(closingSummary.generalExpensesTotal).toBe(75)
    expect(closingSummary.generalExpenses.map((e) => e.id)).toContain(saved?.id)
  })

  it('shows no suggestions for 2 characters, shows suggestions for 3 characters, and caps at 4 results', () => {
    render(<PurchaseForm onClose={vi.fn()} />)

    fireEvent.click(screen.getByTestId('purchase-add-line'))
    const nameInput = screen.getByTestId('purchase-line-name-0')

    // 2 chars -> no suggestions
    fireEvent.change(nameInput, { target: { value: 'Fr' } })
    expect(
      screen.queryByTestId('purchase-line-suggestions-0'),
    ).not.toBeInTheDocument()

    // 3 chars -> suggestions shown, max 4 even though 5 items match "Fra"
    fireEvent.change(nameInput, { target: { value: 'Fra' } })
    const suggestionsBox = screen.getByTestId('purchase-line-suggestions-0')
    expect(suggestionsBox).toBeInTheDocument()
    const optionButtons = suggestionsBox.querySelectorAll('button')
    expect(optionButtons.length).toBe(4)
  })

  it('selects a suggestion using its itemId and shows last purchase date and elapsed days relative to the purchase date', async () => {
    const onClose = vi.fn()
    render(<PurchaseForm onClose={onClose} />)

    fireEvent.change(screen.getByTestId('purchase-date-input'), {
      target: { value: '2026-10-15' },
    })
    fireEvent.change(screen.getByTestId('purchase-description-input'), {
      target: { value: 'Farmácia' },
    })
    fireEvent.change(screen.getByTestId('purchase-amount-input'), {
      target: { value: '100' },
    })

    fireEvent.click(screen.getByTestId('purchase-add-line'))
    const nameInput = screen.getByTestId('purchase-line-name-0')
    fireEvent.change(nameInput, { target: { value: 'Fralda' } })

    const suggestionBtn = screen.getByTestId(
      'purchase-suggestion-0-item-1',
    )
    fireEvent.click(suggestionBtn)

    // Last purchase was 2026-10-01, purchase date is 2026-10-15 -> 14 days
    const lastPurchaseBadge = screen.getByTestId('line-last-purchase-0')
    expect(lastPurchaseBadge).toHaveTextContent('01/10/2026')
    expect(lastPurchaseBadge).toHaveTextContent('14')

    // Changing the purchase date recalculates the elapsed days (2026-10-21 -> 20 days)
    fireEvent.change(screen.getByTestId('purchase-date-input'), {
      target: { value: '2026-10-21' },
    })
    expect(screen.getByTestId('line-last-purchase-0')).toHaveTextContent('20')

    fireEvent.click(screen.getByTestId('purchase-submit'))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    const saved = useScheduleStore
      .getState()
      .expenses.find((e) => e.description === 'Farmácia')
    expect(saved?.items[0].itemId).toBe('item-1')
  })

  it('creates a new item when typing a new name, shows no prior date/days for it, and includes it in the next search', async () => {
    const onClose = vi.fn()
    const { unmount } = render(<PurchaseForm onClose={onClose} />)

    fireEvent.change(screen.getByTestId('purchase-date-input'), {
      target: { value: '2026-11-05' },
    })
    fireEvent.change(screen.getByTestId('purchase-description-input'), {
      target: { value: 'Compra Item Novo' },
    })
    fireEvent.change(screen.getByTestId('purchase-amount-input'), {
      target: { value: '45' },
    })

    fireEvent.click(screen.getByTestId('purchase-add-line'))
    fireEvent.change(screen.getByTestId('purchase-line-name-0'), {
      target: { value: 'Termômetro Digital' },
    })

    // New item has no prior date or days
    expect(screen.queryByTestId('line-last-purchase-0')).not.toBeInTheDocument()
    expect(screen.getByTestId('line-new-item-0')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('purchase-submit'))
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    unmount()

    // Render again and search for "Term"
    render(<PurchaseForm onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('purchase-add-line'))
    fireEvent.change(screen.getByTestId('purchase-line-name-0'), {
      target: { value: 'Term' },
    })

    expect(
      screen.getByTestId('purchase-line-suggestions-0'),
    ).toHaveTextContent('Termômetro Digital')
  })

  it('excludes the expense being edited when computing last purchase for its items', () => {
    const existingExpense = useScheduleStore.getState().expenses[0]
    render(<PurchaseForm expense={existingExpense} onClose={vi.fn()} />)

    // exp-prev is the only purchase of item-1 (on 2026-10-01), so when editing it there is no prior purchase
    expect(screen.queryByTestId('line-last-purchase-0')).not.toBeInTheDocument()
    expect(screen.getByTestId('line-no-prior-0')).toBeInTheDocument()
  })

  it('parses decimal comma in quantity (1,5 -> 1.5), line amount (10,50 -> 10.5), and saves empty quantity as 1', async () => {
    const onClose = vi.fn()
    render(<PurchaseForm onClose={onClose} />)

    fireEvent.change(screen.getByTestId('purchase-date-input'), {
      target: { value: '2026-11-05' },
    })
    fireEvent.change(screen.getByTestId('purchase-description-input'), {
      target: { value: 'Feira Livre' },
    })
    fireEvent.change(screen.getByTestId('purchase-amount-input'), {
      target: { value: '25,00' },
    })

    fireEvent.click(screen.getByTestId('purchase-add-line'))
    fireEvent.click(screen.getByTestId('purchase-add-line'))

    fireEvent.change(screen.getByTestId('purchase-line-name-0'), {
      target: { value: 'Maçã Gala' },
    })
    fireEvent.change(screen.getByTestId('purchase-line-qty-0'), {
      target: { value: '1,5' },
    })
    fireEvent.change(screen.getByTestId('purchase-line-amount-0'), {
      target: { value: '10,50' },
    })

    fireEvent.change(screen.getByTestId('purchase-line-name-1'), {
      target: { value: ' Soro Fisiológico ' },
    })
    fireEvent.change(screen.getByTestId('purchase-line-qty-1'), {
      target: { value: '' },
    })

    fireEvent.click(screen.getByTestId('purchase-submit'))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    const saved = useScheduleStore
      .getState()
      .expenses.find((e) => e.description === 'Feira Livre')
    expect(saved?.items[0].quantity).toBe(1.5)
    expect(saved?.items[0].amount).toBe(10.5)
    expect(saved?.items[1].quantity).toBe(1)
  })

  it('displays translated validation errors from validateExpenseInput and does not save', async () => {
    const onClose = vi.fn()
    render(<PurchaseForm onClose={onClose} />)

    fireEvent.change(screen.getByTestId('purchase-description-input'), {
      target: { value: '' },
    })
    fireEvent.change(screen.getByTestId('purchase-amount-input'), {
      target: { value: '0' },
    })

    fireEvent.click(screen.getByTestId('purchase-submit'))

    expect(
      await screen.findByTestId('purchase-error-DESCRIPTION_REQUIRED'),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('purchase-error-AMOUNT_INVALID'),
    ).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows the duplicate item error when the same item is added twice', async () => {
    const onClose = vi.fn()
    render(<PurchaseForm onClose={onClose} />)

    fireEvent.change(screen.getByTestId('purchase-date-input'), {
      target: { value: '2026-11-05' },
    })
    fireEvent.change(screen.getByTestId('purchase-description-input'), {
      target: { value: 'Farmácia' },
    })
    fireEvent.change(screen.getByTestId('purchase-amount-input'), {
      target: { value: '80' },
    })

    fireEvent.click(screen.getByTestId('purchase-add-line'))
    fireEvent.click(screen.getByTestId('purchase-add-line'))

    fireEvent.change(screen.getByTestId('purchase-line-name-0'), {
      target: { value: 'Fralda Geriátrica' },
    })
    fireEvent.change(screen.getByTestId('purchase-line-name-1'), {
      target: { value: 'fralda geriatrica' },
    })

    fireEvent.click(screen.getByTestId('purchase-submit'))

    expect(
      await screen.findByTestId('purchase-error-DUPLICATE_ITEM'),
    ).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not block saving when the total differs from the sum of item lines', async () => {
    const onClose = vi.fn()
    render(<PurchaseForm onClose={onClose} />)

    fireEvent.change(screen.getByTestId('purchase-date-input'), {
      target: { value: '2026-11-05' },
    })
    fireEvent.change(screen.getByTestId('purchase-description-input'), {
      target: { value: 'Compra com Frete' },
    })
    fireEvent.change(screen.getByTestId('purchase-amount-input'), {
      target: { value: '120,00' },
    })

    fireEvent.click(screen.getByTestId('purchase-add-line'))
    fireEvent.change(screen.getByTestId('purchase-line-name-0'), {
      target: { value: 'Fralda Geriátrica' },
    })
    fireEvent.change(screen.getByTestId('purchase-line-amount-0'), {
      target: { value: '100,00' },
    })

    // Shows summary difference in form
    expect(
      screen.getByTestId('purchase-form-summary-diff'),
    ).toHaveTextContent(/20,00/)

    fireEvent.click(screen.getByTestId('purchase-submit'))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it('preserves the saved itemName when editing a purchase even if the catalog item was renamed', async () => {
    // Rename item-1 in catalog directly to simulate past purchase vs renamed catalog item
    useScheduleStore.setState((state) => ({
      expenseItems: state.expenseItems.map((it) =>
        it.id === 'item-1'
          ? {
              ...it,
              name: 'Fralda Geriátrica Plus',
              normalizedName: 'fralda geriatrica plus',
            }
          : it,
      ),
    }))

    const existingExpense = useScheduleStore.getState().expenses[0]
    const onClose = vi.fn()
    render(<PurchaseForm expense={existingExpense} onClose={onClose} />)

    fireEvent.change(screen.getByTestId('purchase-amount-input'), {
      target: { value: '115,00' },
    })

    fireEvent.click(screen.getByTestId('purchase-submit'))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    const updated = useScheduleStore.getState().expenses[0]
    expect(updated.amount).toBe(115)
    expect(updated.items[0].itemName).toBe('Fralda Geriátrica')
  })

  it('deletes the purchase from the edit form while keeping its item in search', async () => {
    const existingExpense = useScheduleStore.getState().expenses[0]
    const onClose = vi.fn()
    render(<PurchaseForm expense={existingExpense} onClose={onClose} />)

    fireEvent.click(screen.getByTestId('purchase-form-delete'))

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    expect(useScheduleStore.getState().expenses).toHaveLength(0)
    expect(
      useScheduleStore.getState().expenseItems.find((i) => i.id === 'item-1'),
    ).toBeDefined()
  })

  describe('spreadsheet item import', () => {
    it('populates item lines from a spreadsheet without modifying expenses until saved, shows last purchase for existing items, and creates new items in search after saving', async () => {
      const onClose = vi.fn()
      render(<PurchaseForm onClose={onClose} />)

      const fileInput = screen.getByTestId(
        'purchase-import-input',
      ) as HTMLInputElement
      expect(fileInput.getAttribute('accept')).toBe('.xls,.xlsx')

      fireEvent.change(screen.getByTestId('purchase-date-input'), {
        target: { value: '2026-10-15' },
      })
      fireEvent.change(screen.getByTestId('purchase-description-input'), {
        target: { value: 'Compra Planilha' },
      })

      const initialExpensesCount = useScheduleStore.getState().expenses.length

      const file = workbookFile([
        ['Nome', 'Qtd', 'Valor'],
        ['Fralda Geriátrica', 2, 120],
        ['Algodão Hidrófilo', 1, 15],
      ])

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByTestId('purchase-line-name-0')).toHaveValue(
          'Fralda Geriátrica',
        )
      })
      expect(screen.getByTestId('purchase-line-qty-0')).toHaveValue('2')
      expect(screen.getByTestId('purchase-line-amount-0')).toHaveValue('120')
      expect(screen.getByTestId('purchase-line-name-1')).toHaveValue(
        'Algodão Hidrófilo',
      )
      expect(screen.getByTestId('purchase-line-qty-1')).toHaveValue('1')
      expect(screen.getByTestId('purchase-line-amount-1')).toHaveValue('15')

      // Total was empty, so it receives the sum (120 + 15 = 135)
      expect(screen.getByTestId('purchase-amount-input')).toHaveValue('135')

      // Existing item shows last purchase date (01/10/2026) and elapsed days (14)
      const lastPurchaseBadge = screen.getByTestId('line-last-purchase-0')
      expect(lastPurchaseBadge).toHaveTextContent('01/10/2026')
      expect(lastPurchaseBadge).toHaveTextContent('14')

      // Store expenses have not changed before saving
      expect(useScheduleStore.getState().expenses).toHaveLength(
        initialExpensesCount,
      )

      // Save the purchase
      fireEvent.click(screen.getByTestId('purchase-submit'))

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1)
      })

      expect(useScheduleStore.getState().expenses).toHaveLength(
        initialExpensesCount + 1,
      )

      const searchResults = searchExpenseItems(
        'Algod',
        useScheduleStore.getState().expenseItems,
        useScheduleStore.getState().expenses,
        { referenceDate: '2026-11-01' },
      )
      expect(searchResults.map((s) => s.item.name)).toContain(
        'Algodão Hidrófilo',
      )
    })

    it('keeps a pre-filled total unchanged when importing items, and leaves total empty when spreadsheet has no amounts', async () => {
      const { unmount } = render(<PurchaseForm onClose={vi.fn()} />)

      fireEvent.change(screen.getByTestId('purchase-amount-input'), {
        target: { value: '250,00' },
      })

      const fileWithAmounts = workbookFile([
        ['Nome', 'Valor'],
        ['Fralda Geriátrica', 100],
      ])
      fireEvent.change(screen.getByTestId('purchase-import-input'), {
        target: { files: [fileWithAmounts] },
      })

      await waitFor(() => {
        expect(screen.getByTestId('purchase-line-name-0')).toHaveValue(
          'Fralda Geriátrica',
        )
      })
      expect(screen.getByTestId('purchase-amount-input')).toHaveValue('250,00')

      unmount()

      // Render fresh form with empty total and import spreadsheet without amounts
      render(<PurchaseForm onClose={vi.fn()} />)
      const fileWithoutAmounts = workbookFile([['Nome'], ['Gaze Estéril']])
      fireEvent.change(screen.getByTestId('purchase-import-input'), {
        target: { files: [fileWithoutAmounts] },
      })

      await waitFor(() => {
        expect(screen.getByTestId('purchase-line-name-0')).toHaveValue(
          'Gaze Estéril',
        )
      })
      expect(screen.getByTestId('purchase-amount-input')).toHaveValue('')
    })

    it('displays import warnings with row numbers and allows importing the same file twice to sum items', async () => {
      render(<PurchaseForm onClose={vi.fn()} />)

      const file = workbookFile([
        ['Nome', 'Qtd', 'Valor'],
        ['Sabonete Líquido', 0, 10],
        ['Luva Descartável', 2, 'invalido'],
      ])

      const fileInput = screen.getByTestId(
        'purchase-import-input',
      ) as HTMLInputElement

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByTestId('purchase-line-name-0')).toHaveValue(
          'Sabonete Líquido',
        )
      })
      expect(fileInput.value).toBe('')

      const warningsBox = screen.getByTestId('purchase-import-warnings')
      expect(warningsBox).toHaveTextContent('2')
      expect(warningsBox).toHaveTextContent('3')

      // Import the exact same file a second time -> quantities and amounts sum
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByTestId('purchase-line-qty-0')).toHaveValue('2')
      })
      expect(screen.getByTestId('purchase-line-amount-0')).toHaveValue('20')
      expect(screen.getByTestId('purchase-line-qty-1')).toHaveValue('4')
    })

    it('shows translated error messages for each import error code without modifying the form', async () => {
      render(<PurchaseForm onClose={vi.fn()} />)

      const fileInput = screen.getByTestId('purchase-import-input')

      // 1. EMPTY_FILE
      fireEvent.change(fileInput, {
        target: { files: [workbookFile([['Nome', 'Valor']])] },
      })
      expect(
        await screen.findByTestId('purchase-import-error-EMPTY_FILE'),
      ).toBeInTheDocument()
      expect(screen.queryByTestId('purchase-line-name-0')).not.toBeInTheDocument()

      // 2. UNREADABLE_FILE
      fireEvent.change(fileInput, {
        target: { files: [new File(['abc'], 'corrompido.xlsx')] },
      })
      expect(
        await screen.findByTestId('purchase-import-error-UNREADABLE_FILE'),
      ).toBeInTheDocument()

      // 3. FILE_TOO_LARGE
      const hugeFile = new File(
        [new Uint8Array(EXPENSE_IMPORT_MAX_BYTES + 1)],
        'enorme.xlsx',
      )
      fireEvent.change(fileInput, { target: { files: [hugeFile] } })
      expect(
        await screen.findByTestId('purchase-import-error-FILE_TOO_LARGE'),
      ).toBeInTheDocument()

      // 4. TOO_MANY_ITEMS
      const manyRows: unknown[][] = [['Nome', 'Valor']]
      for (let i = 1; i <= 201; i++) {
        manyRows.push([`Item ${i}`, 1])
      }
      fireEvent.change(fileInput, {
        target: { files: [workbookFile(manyRows)] },
      })
      expect(
        await screen.findByTestId('purchase-import-error-TOO_MANY_ITEMS'),
      ).toBeInTheDocument()
      expect(screen.queryByTestId('purchase-line-name-0')).not.toBeInTheDocument()
    })
  })
})

