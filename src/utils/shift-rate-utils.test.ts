import { describe, it, expect } from 'vitest'

import {
  calculateMonthExpensesSummary,
  getPersonShiftRate,
  parseNumericRate,
} from './shift-rate-utils'

import type { DailyExpense, MonthlyAvailability } from '../types'

describe('shift-rate-utils', () => {
  describe('parseNumericRate', () => {
    it('parses numeric values in several formats', () => {
      expect(parseNumericRate('1500')).toBe(1500)
      expect(parseNumericRate('1500,50')).toBe(1500.5)
      expect(parseNumericRate('1.500,00')).toBe(1500)
      expect(parseNumericRate('R$ 1.800,00')).toBe(1800)
      expect(parseNumericRate('')).toBe(0)
    })
  })

  describe('getPersonShiftRate', () => {
    const baseAvail: MonthlyAvailability[] = [
      {
        personId: 'p1',
        month: '2026-10',
        availableDays: [1, 2, 3],
        shiftRates: {
          shift_d12: {
            1: 1500,
            2: 1600,
            0: 1400, // base rate
          },
        },
      },
      {
        personId: 'p2',
        month: '2026-10',
        availableDays: [1, 2],
        shiftRates: {
          default: {
            1: 1200,
            2: 1300,
          },
        },
      },
    ]

    it('returns the exact rate for the shiftId and day', () => {
      const rate = getPersonShiftRate(baseAvail, 'p1', '2026-10', 'shift_d12', 1)
      expect(rate).toBe(1500)
    })

    it('uses the shift rate for legacy assignments without a shiftId', () => {
      // p1 has shift_d12 rates, but is assigned without shiftId
      const rate = getPersonShiftRate(baseAvail, 'p1', '2026-10', undefined, 1)
      expect(rate).toBe(1500)
    })

    it('uses the default rate when the requested shiftId has none', () => {
      const rate = getPersonShiftRate(baseAvail, 'p2', '2026-10', 'shift_random', 1)
      expect(rate).toBe(1200)
    })

    it('falls back to the shift base rate when the day has no rate', () => {
      // p1 on day 10 (not in days 1, 2)
      const rate = getPersonShiftRate(baseAvail, 'p1', '2026-10', 'shift_d12', 10)
      expect(rate).toBe(1400)
    })

    it('returns 0 when the professional has no rates', () => {
      const rate = getPersonShiftRate(baseAvail, 'p_unknown', '2026-10', 'shift_d12', 1)
      expect(rate).toBe(0)
    })
  })

  describe('calculateMonthExpensesSummary', () => {
    const expenses: DailyExpense[] = [
      {
        id: 'exp1',
        date: '2026-10-05',
        description: 'Medicamentos Farmácia',
        amount: 85.5,
        personId: 'p1', // Linked to p1
        category: 'MEDICATION',
        createdAt: '2026-10-05T10:00:00Z',
        updatedAt: '2026-10-05T10:00:00Z',
      },
      {
        id: 'exp2',
        date: '2026-10-12',
        description: 'Combustível / Transporte',
        amount: 50.0,
        personId: 'p1', // Linked to p1
        category: 'TRANSPORT',
        createdAt: '2026-10-12T10:00:00Z',
        updatedAt: '2026-10-12T10:00:00Z',
      },
      {
        id: 'exp3',
        date: '2026-10-18',
        description: 'Luvas e Insumos Gerais',
        amount: 120.0,
        // No personId -> General operational expense
        category: 'SUPPLIES',
        createdAt: '2026-10-18T10:00:00Z',
        updatedAt: '2026-10-18T10:00:00Z',
      },
      {
        id: 'exp4',
        date: '2026-11-01',
        description: 'Gasto de outro mês',
        amount: 99.0,
        personId: 'p1',
        createdAt: '2026-11-01T10:00:00Z',
        updatedAt: '2026-11-01T10:00:00Z',
      },
    ]

    it('calculates reimbursements for professionals and general operational expenses correctly', () => {
      const summary = calculateMonthExpensesSummary(expenses, '2026-10')

      // Linked reimbursement for p1: 85.5 + 50.0 = 135.5
      expect(summary.personReimbursements['p1']).toBe(135.5)
      expect(summary.personExpenses['p1']).toHaveLength(2)
      expect(summary.totalReimbursements).toBe(135.5)

      // General operational expenses without personId: 120.0
      expect(summary.generalExpenses).toHaveLength(1)
      expect(summary.generalExpenses[0].id).toBe('exp3')
      expect(summary.generalExpensesTotal).toBe(120.0)

      // Total expenses for the month: 135.5 + 120.0 = 255.5
      expect(summary.totalExpenses).toBe(255.5)
    })

    it('handles empty expenses or missing dates gracefully', () => {
      const emptySummary = calculateMonthExpensesSummary([], '2026-10')
      expect(emptySummary.totalReimbursements).toBe(0)
      expect(emptySummary.generalExpensesTotal).toBe(0)
      expect(emptySummary.totalExpenses).toBe(0)
      expect(emptySummary.generalExpenses).toEqual([])
    })
  })
})

