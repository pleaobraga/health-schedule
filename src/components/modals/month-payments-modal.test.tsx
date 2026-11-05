import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { MonthPaymentsModal } from './month-payments-modal'
import { i18n } from '../../i18n'
import { useScheduleStore } from '../../store/use-schedule-store'

describe('MonthPaymentsModal', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt-BR')
    useScheduleStore.setState({
      persons: [
        { id: 'p1', name: 'Dr. Lucas Ferreira', color: '#3b82f6', active: true },
        { id: 'p2', name: 'Dra. Beatriz Santos', color: '#ec4899', active: true },
      ],
      shiftDefinitions: [
        {
          id: 'shift_d12',
          name: 'Plantão Diurno 12h',
          code: 'D12',
          startTime: '07:00',
          durationHours: 12,
          color: '#3B82F6',
          enabledByDefault: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
      availabilities: [
        {
          personId: 'p1',
          month: '2026-10',
          availableDays: [1, 2],
          shiftAvailability: {
            shift_d12: [1, 2],
          },
          shiftRates: {
            shift_d12: { 1: 300, 2: 350 },
          },
        },
        {
          personId: 'p2',
          month: '2026-10',
          availableDays: [3],
          shiftAvailability: {
            shift_d12: [3],
          },
          shiftRates: {
            shift_d12: { 3: 400 },
          },
        },
      ],
      dayShiftAssignments: {
        '2026-10-01': { shift_d12: 'p1' },
        '2026-10-02': { shift_d12: 'p1' },
        '2026-10-03': { shift_d12: 'p2' },
      },
    })
  })

  it('exibe o total geral e os valores calculados por profissional', () => {
    render(
      <MonthPaymentsModal
        isOpen={true}
        onClose={vi.fn()}
        currentMonth="2026-10"
      />
    )

    // Grand total: 300 + 350 + 400 = 1050
    expect(screen.getByText('Fechamento de Valores do Mês')).toBeInTheDocument()
    // Check Dr. Lucas and Dra. Beatriz
    expect(screen.getByText('Dr. Lucas Ferreira')).toBeInTheDocument()
    expect(screen.getByText('Dra. Beatriz Santos')).toBeInTheDocument()

    // 3 shifts total
    expect(screen.getByText('3 plantões')).toBeInTheDocument()
  })

  it('expands a professional to show their shifts and daily amounts', () => {
    render(
      <MonthPaymentsModal
        isOpen={true}
        onClose={vi.fn()}
        currentMonth="2026-10"
      />
    )

    const drLucasCard = screen.getByText('Dr. Lucas Ferreira')
    fireEvent.click(drLucasCard)

    // Details should show days 1 and 2
    expect(screen.getByText(/Dia 1/i)).toBeInTheDocument()
    expect(screen.getByText(/Dia 2/i)).toBeInTheDocument()
  })

  it('permite filtrar profissionais por busca de texto', () => {
    render(
      <MonthPaymentsModal
        isOpen={true}
        onClose={vi.fn()}
        currentMonth="2026-10"
      />
    )

    const searchInput = screen.getByPlaceholderText(/Filtrar por nome/i)
    fireEvent.change(searchInput, { target: { value: 'Beatriz' } })

    expect(screen.getByText('Dra. Beatriz Santos')).toBeInTheDocument()
    expect(screen.queryByText('Dr. Lucas Ferreira')).not.toBeInTheDocument()
  })

  it('computes the amounts for professionals assigned through legacy assignments', () => {
    useScheduleStore.setState({
      persons: [
        { id: 'p1', name: 'Dr. Lucas Ferreira', color: '#3b82f6', active: true },
      ],
      dayShiftAssignments: {},
      assignments: {
        '2026-10-01': ['p1'],
        '2026-10-02': ['p1'],
      },
      availabilities: [
        {
          personId: 'p1',
          month: '2026-10',
          availableDays: [1, 2],
          shiftRates: {
            shift_d12: { 1: 500, 2: 500 },
          },
        },
      ],
    })

    render(
      <MonthPaymentsModal
        isOpen={true}
        onClose={vi.fn()}
        currentMonth="2026-10"
      />
    )

    // Should resolve rate to R$ 1000 total (500 + 500), not R$ 0
    expect(screen.getByText('Dr. Lucas Ferreira')).toBeInTheDocument()
    expect(screen.getByText('2 plantões')).toBeInTheDocument()
    expect(screen.getAllByText(/1\.000,00/).length).toBeGreaterThanOrEqual(2)
  })

  it('computes financial closing with linked reimbursements (with personId) and general operational expenses (without personId)', async () => {
    useScheduleStore.setState({
      persons: [
        { id: 'p1', name: 'Dra. Ana Silva', color: '#3B82F6', active: true },
        { id: 'p2', name: 'Dr. Carlos Souza', color: '#10B981', active: true },
      ],
      dayShiftAssignments: {
        '2026-10-01': { shift_d12: 'p1' }, // 1 shift for p1 (rate 400)
      },
      assignments: {},
      availabilities: [
        {
          personId: 'p1',
          month: '2026-10',
          availableDays: [1],
          shiftRates: { shift_d12: { 1: 400 } },
        },
      ],
      expenses: [
        {
          id: 'exp1',
          date: '2026-10-05',
          description: 'Medicamentos Especiais',
          amount: 150.0,
          personId: 'p1', // Linked reimbursement for p1
          category: 'MEDICATION',
          items: [],
          createdAt: '2026-10-05T10:00:00Z',
          updatedAt: '2026-10-05T10:00:00Z',
        },
        {
          id: 'exp2',
          date: '2026-10-15',
          description: 'Insumos de Curativo',
          amount: 250.0,
          // General expense without personId
          category: 'SUPPLIES',
          items: [],
          createdAt: '2026-10-15T10:00:00Z',
          updatedAt: '2026-10-15T10:00:00Z',
        },
      ],
    })

    render(
      <MonthPaymentsModal
        isOpen={true}
        onClose={vi.fn()}
        currentMonth="2026-10"
      />
    )

    // p1: Shift (400) + Reimbursement (150) = 550 total
    expect(screen.getByText('Dra. Ana Silva')).toBeInTheDocument()
    expect(screen.getByTestId('person-reimbursement-badge-p1')).toHaveTextContent(/150,00/)
    expect(screen.getByText(/550,00/)).toBeInTheDocument()

    // General operational expenses section: 250
    expect(screen.getByTestId('general-expenses-section')).toBeInTheDocument()
    expect(screen.getByText('Insumos de Curativo')).toBeInTheDocument()

    // Grand total = p1 (550) + General (250) = 800
    // Total a Pagar should display 800
    expect(screen.getAllByText(/800,00/).length).toBeGreaterThanOrEqual(1)

    // Expand p1 to see detailed reimbursement
    fireEvent.click(screen.getByText('Dra. Ana Silva'))
    expect(screen.getByText('Medicamentos Especiais')).toBeInTheDocument()

    // Date formatting in Portuguese (DD/MM/YYYY)
    expect(screen.getByText('05/10/2026')).toBeInTheDocument()
    expect(screen.getByText('15/10/2026')).toBeInTheDocument()
  })

  it('shows a past month with the person data it recorded', () => {
    useScheduleStore.setState({
      persons: [{ id: 'p1', name: 'Nome novo', color: '#222222' }],
      dayShiftAssignments: { '2020-01-01': { shift_d12: 'p1' } },
      assignments: {},
      availabilities: [],
      expenses: [],
      monthSnapshots: {
        '2020-01': {
          capturedAt: '2026-11-05T10:00:00.000Z',
          persons: [{ id: 'p1', name: 'Nome antigo', color: '#111111' }],
          shiftDefinitions: [],
          shiftRules: [],
          activeShiftIds: [],
          activeRuleIds: [],
        },
      },
    })

    render(
      <MonthPaymentsModal
        isOpen={true}
        onClose={vi.fn()}
        currentMonth="2020-01"
      />
    )

    expect(screen.getByText('Nome antigo')).toBeInTheDocument()
    expect(screen.queryByText('Nome novo')).not.toBeInTheDocument()
  })

  it('names a reimbursement of a removed professional in the active language and keeps it in the total', async () => {
    await i18n.changeLanguage('en-US')

    useScheduleStore.setState({
      persons: [],
      dayShiftAssignments: {},
      assignments: {},
      availabilities: [],
      expenses: [
        {
          id: 'exp-removed',
          date: '2026-10-05',
          description: 'Old reimbursement',
          amount: 120.0,
          personId: 'removed-person',
          items: [],
          createdAt: '2026-10-05T10:00:00Z',
          updatedAt: '2026-10-05T10:00:00Z',
        },
      ],
    })

    render(
      <MonthPaymentsModal
        isOpen={true}
        onClose={vi.fn()}
        currentMonth="2026-10"
      />
    )

    expect(screen.getByText('Removed professional')).toBeInTheDocument()
    expect(screen.getByTestId('person-reimbursement-badge-removed-person')).toHaveTextContent(/120[,.]00/)
  })

  it('names a shift of a removed professional in the active language', async () => {
    await i18n.changeLanguage('en-US')

    useScheduleStore.setState({
      persons: [],
      dayShiftAssignments: {
        '2026-10-01': { shift_d12: 'removed-person' },
      },
      assignments: {},
      availabilities: [],
      expenses: [],
    })

    render(
      <MonthPaymentsModal
        isOpen={true}
        onClose={vi.fn()}
        currentMonth="2026-10"
      />
    )

    expect(screen.getByText('Removed professional')).toBeInTheDocument()
  })

  it('formats expense dates in American format (MM/DD/YYYY) when language is English', async () => {
    await i18n.changeLanguage('en-US')

    useScheduleStore.setState({
      persons: [
        { id: 'p1', name: 'Dr. Lucas Ferreira', color: '#3b82f6', active: true },
      ],
      dayShiftAssignments: {},
      assignments: {},
      availabilities: [],
      expenses: [
        {
          id: 'exp1',
          date: '2026-10-05',
          description: 'Special Medication',
          amount: 150.0,
          personId: 'p1',
          category: 'MEDICATION',
          items: [],
          createdAt: '2026-10-05T10:00:00Z',
          updatedAt: '2026-10-05T10:00:00Z',
        },
        {
          id: 'exp2',
          date: '2026-10-15',
          description: 'Bandages',
          amount: 250.0,
          category: 'SUPPLIES',
          items: [],
          createdAt: '2026-10-15T10:00:00Z',
          updatedAt: '2026-10-15T10:00:00Z',
        },
      ],
    })

    render(
      <MonthPaymentsModal
        isOpen={true}
        onClose={vi.fn()}
        currentMonth="2026-10"
      />
    )

    // Expand Dr. Lucas
    fireEvent.click(screen.getByText('Dr. Lucas Ferreira'))

    // Dates should be formatted in American format: MM/DD/YYYY
    expect(screen.getByText('10/05/2026')).toBeInTheDocument()
    expect(screen.getByText('10/15/2026')).toBeInTheDocument()
  })

  it('displays saved personName for a deleted professional in the closing modal and uses amount regardless of item lines', async () => {
    await i18n.changeLanguage('pt-BR')

    useScheduleStore.setState({
      persons: [],
      dayShiftAssignments: {},
      assignments: {},
      availabilities: [],
      expenses: [
        {
          id: 'exp-deleted-named',
          date: '2026-10-08',
          description: 'Compra Farmácia',
          amount: 150.0,
          personId: 'deleted-caregiver',
          personName: 'Enf. Mariana',
          items: [
            {
              id: 'line-1',
              itemId: 'item-1',
              itemName: 'Luva Cirúrgica',
              quantity: 2,
              amount: 100.0,
            },
          ],
          createdAt: '2026-10-08T10:00:00Z',
          updatedAt: '2026-10-08T10:00:00Z',
        },
        {
          id: 'exp-general-no-lines',
          date: '2026-10-09',
          description: 'Transporte',
          amount: 50.0,
          items: [],
          createdAt: '2026-10-09T10:00:00Z',
          updatedAt: '2026-10-09T10:00:00Z',
        },
      ],
    })

    render(
      <MonthPaymentsModal
        isOpen={true}
        onClose={vi.fn()}
        currentMonth="2026-10"
      />
    )

    expect(screen.getByText('Enf. Mariana')).toBeInTheDocument()
    expect(screen.queryByText('Profissional removido')).not.toBeInTheDocument()
    expect(
      screen.getByTestId('person-reimbursement-badge-deleted-caregiver'),
    ).toHaveTextContent(/150,00/)
    expect(screen.getByTestId('kpi-total-to-pay')).toHaveTextContent(/200,00/)
  })
})

