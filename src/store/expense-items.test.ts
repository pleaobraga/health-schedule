import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useScheduleStore } from './use-schedule-store'
import { CloudSyncService } from '../services/cloud-sync-service'
import { StorageService } from '../services/storage-service'

describe('useScheduleStore - expense purchases and items', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    useScheduleStore.setState({
      currentMonth: '2026-10',
      persons: [
        { id: 'p1', name: 'Dra. Camila', color: '#3b82f6', active: true },
        { id: 'p2', name: 'Dr. Lucas', color: '#10b981', active: true },
      ],
      expenses: [],
      expenseItems: [],
      monthSnapshots: {},
    })
  })

  it('adds an expense with a new item line and creates the item in the registry', async () => {
    const res = await useScheduleStore.getState().addExpense({
      date: '2026-10-15',
      description: 'Farmácia Central',
      amount: 30,
      items: [{ name: 'Fralda', quantity: 2, amount: 30 }],
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return

    const { expenseItems, expenses } = useScheduleStore.getState()
    expect(expenseItems).toHaveLength(1)
    expect(expenseItems[0].name).toBe('Fralda')
    expect(expenseItems[0].id).toMatch(/^expitem_/)
    expect(res.expense.items).toEqual([
      {
        id: expect.any(String),
        itemId: expenseItems[0].id,
        itemName: 'Fralda',
        quantity: 2,
        amount: 30,
      },
    ])
    expect(expenses).toEqual([res.expense])
  })

  it('reuses an existing item on a second purchase with normalized name', async () => {
    await useScheduleStore.getState().addExpense({
      date: '2026-10-15',
      description: 'Compra 1',
      amount: 30,
      items: [{ name: 'Fralda', quantity: 1 }],
    })

    const res2 = await useScheduleStore.getState().addExpense({
      date: '2026-10-20',
      description: 'Compra 2',
      amount: 35,
      items: [{ name: ' fralda ', quantity: 1 }],
    })

    expect(res2.ok).toBe(true)
    expect(useScheduleStore.getState().expenseItems).toHaveLength(1)
  })

  it('rejects an invalid expense without creating new items in the registry', async () => {
    const res = await useScheduleStore.getState().addExpense({
      date: '2026-10-15',
      description: 'Compra inválida',
      amount: 0,
      items: [{ name: 'Novo Item' }],
    })

    expect(res).toEqual({
      ok: false,
      errors: [{ code: 'AMOUNT_INVALID' }],
    })
    expect(useScheduleStore.getState().expenseItems).toEqual([])
    expect(useScheduleStore.getState().expenses).toEqual([])
  })

  it('stores personName when personId is provided and omits it when absent', async () => {
    const withPerson = await useScheduleStore.getState().addExpense({
      date: '2026-10-15',
      description: 'Reembolso',
      amount: 40,
      personId: 'p1',
    })
    const withoutPerson = await useScheduleStore.getState().addExpense({
      date: '2026-10-16',
      description: 'Geral',
      amount: 25,
    })

    expect(withPerson.ok && withPerson.expense.personName).toBe('Dra. Camila')
    expect(withoutPerson.ok && withoutPerson.expense.personName).toBeUndefined()
  })

  it('keeps saved lines when updateExpense is called without items', async () => {
    const created = await useScheduleStore.getState().addExpense({
      date: '2026-10-15',
      description: 'Farmácia',
      amount: 30,
      items: [{ name: 'Fralda', quantity: 2, amount: 30 }],
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const updated = await useScheduleStore
      .getState()
      .updateExpense(created.expense.id, { amount: 99 })

    expect(updated.ok).toBe(true)
    if (!updated.ok) return
    expect(updated.expense.amount).toBe(99)
    expect(updated.expense.items).toEqual(created.expense.items)
  })

  it('preserves old itemName and personName when updating an expense without changing personId or item', async () => {
    const created = await useScheduleStore.getState().addExpense({
      date: '2026-10-15',
      description: 'Farmácia',
      amount: 30,
      personId: 'p1',
      items: [{ name: 'Fralda', quantity: 2 }],
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    // Simulate renaming person and item in registry directly
    useScheduleStore.getState().updatePerson('p1', 'Dra. Camila Novo Nome', '#3b82f6')
    const itemId = created.expense.items[0].itemId
    useScheduleStore.setState({
      expenseItems: useScheduleStore
        .getState()
        .expenseItems.map((it) =>
          it.id === itemId ? { ...it, name: 'Fralda Novo Nome' } : it,
        ),
    })

    const updated = await useScheduleStore.getState().updateExpense(created.expense.id, {
      description: 'Farmácia Editada',
      personId: 'p1',
      items: [{ id: created.expense.items[0].id, itemId, quantity: 3 }],
    })

    expect(updated.ok).toBe(true)
    if (!updated.ok) return
    expect(updated.expense.personName).toBe('Dra. Camila')
    expect(updated.expense.items[0].itemName).toBe('Fralda')
    expect(updated.expense.items[0].quantity).toBe(3)
  })

  it('updates personName when personId changes to another person or to undefined', async () => {
    const created = await useScheduleStore.getState().addExpense({
      date: '2026-10-15',
      description: 'Farmácia',
      amount: 30,
      personId: 'p1',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const changedToP2 = await useScheduleStore
      .getState()
      .updateExpense(created.expense.id, { personId: 'p2' })
    expect(changedToP2.ok && changedToP2.expense.personName).toBe('Dr. Lucas')

    const clearedPerson = await useScheduleStore
      .getState()
      .updateExpense(created.expense.id, { personId: undefined })
    expect(clearedPerson.ok && clearedPerson.expense.personName).toBeUndefined()
  })

  it('returns EXPENSE_NOT_FOUND when updating a non-existent expense id', async () => {
    const res = await useScheduleStore
      .getState()
      .updateExpense('exp_missing', { amount: 50 })

    expect(res).toEqual({
      ok: false,
      errors: [{ code: 'EXPENSE_NOT_FOUND' }],
    })
  })

  it('syncs both the old month and the new month when updateExpense moves an expense across months', async () => {
    const created = await useScheduleStore.getState().addExpense({
      date: '2026-10-15',
      description: 'Farmácia',
      amount: 50,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    vi.spyOn(CloudSyncService, 'isSyncEnabled').mockReturnValue(true)
    const saveMonthSpy = vi
      .spyOn(CloudSyncService, 'saveMonthToCloud')
      .mockResolvedValue(true)

    await useScheduleStore
      .getState()
      .updateExpense(created.expense.id, { date: '2026-11-02' })

    const syncedMonths = saveMonthSpy.mock.calls.map(([month]) => month).sort()
    expect(syncedMonths).toEqual(['2026-10', '2026-11'])
  })

  it('syncs the item registry to the cloud when a new item is created with sync enabled', async () => {
    vi.spyOn(CloudSyncService, 'isSyncEnabled').mockReturnValue(true)
    vi.spyOn(CloudSyncService, 'saveMonthToCloud').mockResolvedValue(true)
    const saveItemsSpy = vi
      .spyOn(CloudSyncService, 'saveExpenseItemsToCloud')
      .mockResolvedValue(true)

    await useScheduleStore.getState().addExpense({
      date: '2026-10-15',
      description: 'Farmácia',
      amount: 50,
      items: [{ name: 'Pomada' }],
    })

    expect(saveItemsSpy).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'Pomada' })]),
    )
  })

  it('preserves expense lines and the item registry after reloadFromStorage', async () => {
    await useScheduleStore.getState().addExpense({
      date: '2026-10-15',
      description: 'Farmácia',
      amount: 50,
      items: [{ name: 'Gaze Estéril', quantity: 4, amount: 50 }],
    })

    useScheduleStore.setState({ expenses: [], expenseItems: [] })
    useScheduleStore.getState().reloadFromStorage()

    expect(useScheduleStore.getState().expenseItems).toHaveLength(1)
    expect(useScheduleStore.getState().expenseItems[0].name).toBe('Gaze Estéril')
    expect(useScheduleStore.getState().expenses).toHaveLength(1)
    expect(useScheduleStore.getState().expenses[0].items).toEqual([
      expect.objectContaining({
        itemName: 'Gaze Estéril',
        quantity: 4,
        amount: 50,
      }),
    ])
    expect(StorageService.getExpenseItems()).toHaveLength(1)
  })
})
