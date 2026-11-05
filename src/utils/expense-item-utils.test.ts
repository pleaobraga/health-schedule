import { describe, expect, it } from 'vitest'

import {
  findExpenseItemByName,
  getMergedItemIds,
  normalizeItemName,
  resolveExpenseItemId,
} from './expense-item-utils'

import type { ExpenseItem } from '../types'

const item = (id: string, name: string, mergedIntoId?: string): ExpenseItem => ({
  id,
  name,
  normalizedName: normalizeItemName(name),
  mergedIntoId,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
})

describe('expense-item-utils - names and merge chains', () => {
  it.each([
    ['  Fralda   G ', 'fralda g'],
    ['LENÇO', 'lenco'],
    ['Água', 'agua'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeItemName(input)).toBe(expected)
  })

  it('finds an item ignoring case, accents and spaces', () => {
    expect(findExpenseItemByName(' lenco ', [item('a', 'Lenço')])?.id).toBe('a')
  })

  it('finds a merged item by its old name', () => {
    const items = [item('a', 'Fraldas', 'b'), item('b', 'Fralda')]
    expect(findExpenseItemByName('fraldas', items)?.id).toBe('a')
  })

  it('follows a merge chain to the final item', () => {
    const items = [item('a', 'A', 'b'), item('b', 'B', 'c'), item('c', 'C')]
    expect(resolveExpenseItemId('a', items)).toBe('c')
  })

  it('returns the same id for an unknown item', () => {
    expect(resolveExpenseItemId('x', [])).toBe('x')
    expect(getMergedItemIds('x', [])).toEqual(['x'])
  })

  it('lists an item and every item that leads to it', () => {
    const items = [item('a', 'A', 'b'), item('b', 'B', 'c'), item('c', 'C'), item('d', 'D')]
    expect([...getMergedItemIds('c', items)].sort()).toEqual(['a', 'b', 'c'])
  })

  it('ends on a merge cycle', () => {
    const items = [item('a', 'A', 'b'), item('b', 'B', 'a')]
    expect(['a', 'b']).toContain(resolveExpenseItemId('a', items))
    expect([...getMergedItemIds('a', items)].sort()).toEqual(['a', 'b'])
  })
})
