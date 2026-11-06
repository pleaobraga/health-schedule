import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { RulesManagementView } from './rules-management-view'
import { useScheduleStore } from '../../store/use-schedule-store'

import type { ShiftRule } from '../../types'

const renderRulesView = () => {
  return render(
    <MemoryRouter>
      <RulesManagementView />
    </MemoryRouter>
  )
}

describe('RulesManagementView', () => {
  beforeEach(() => {
    localStorage.clear()
    useScheduleStore.setState({
      shiftDefinitions: [
        {
          id: 'shift_d12',
          name: 'Plantão Diurno 12h',
          code: 'D12',
          startTime: '07:00',
          durationHours: 12,
          color: '#3B82F6',
          enabledByDefault: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      shiftRules: [
        {
          id: 'rule_max_1_day',
          name: 'Máximo 1 turno por dia',
          description: 'Evita sobrecarga e duplicação no mesmo dia civil',
          type: 'MAX_SHIFTS_PER_PERIOD',
          enabledByDefault: true,
          severity: 'ERROR',
          parameters: {
            scope: 'DAY',
            maxOccurrences: 1,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    })
  })

  it('lists the registered rules', () => {
    renderRulesView()

    expect(screen.getByTestId('rules-management-view')).toBeInTheDocument()
    expect(screen.getByText('Máximo 1 turno por dia')).toBeInTheDocument()
    expect(screen.getByText(/Evita sobrecarga/i)).toBeInTheDocument()
  })

  it('creates a new rule from the modal', () => {
    renderRulesView()

    fireEvent.click(screen.getByRole('button', { name: /nova regra/i }))

    fireEvent.change(screen.getByPlaceholderText(/Ex: Limite Semanal de Plantões/i), {
      target: { value: 'Máximo 2 turnos por semana' },
    })

    fireEvent.click(screen.getByRole('button', { name: /criar regra/i }))

    expect(screen.getByText('Máximo 2 turnos por semana')).toBeInTheDocument()
  })

  it('creates a max people per shift rule', () => {
    renderRulesView()

    fireEvent.click(screen.getByRole('button', { name: /nova regra/i }))

    fireEvent.change(screen.getByPlaceholderText(/Ex: Limite Semanal de Plantões/i), {
      target: { value: 'Máximo 2 pessoas no turno' },
    })

    // Select MAX_PEOPLE_PER_SHIFT
    const comboboxes = screen.getAllByRole('combobox')
    fireEvent.change(comboboxes[0], { target: { value: 'MAX_PEOPLE_PER_SHIFT' } })

    // Set maxPeople to 2
    const maxPeopleInput = screen.getByDisplayValue('1')
    fireEvent.change(maxPeopleInput, { target: { value: '2' } })

    fireEvent.click(screen.getByRole('button', { name: /criar regra/i }))

    expect(screen.getByText('Máximo 2 pessoas no turno')).toBeInTheDocument()
    expect(
      screen.getByText(/Dispara quando houver mais de 2 profissional\(is\) trabalhando simultaneamente no mesmo turno/i)
    ).toBeInTheDocument()
  })

  it('creates a weekend daily shift hours rule', () => {
    renderRulesView()

    fireEvent.click(screen.getByRole('button', { name: /nova regra/i }))

    fireEvent.change(screen.getByPlaceholderText(/Ex: Limite Semanal de Plantões/i), {
      target: { value: 'Plantão fim de semana 12h' },
    })

    const comboboxes = screen.getAllByRole('combobox')
    // Select DAILY_SHIFT_HOURS
    fireEvent.change(comboboxes[0], { target: { value: 'DAILY_SHIFT_HOURS' } })

    // Set targetDailyHours to 12
    const targetHoursInput = screen.getByDisplayValue('24')
    fireEvent.change(targetHoursInput, { target: { value: '12' } })

    // Select comparison: MAX
    const comparisonSelect = screen.getByDisplayValue(/Exatamente X horas/i)
    fireEvent.change(comparisonSelect, { target: { value: 'MAX' } })

    // Select dayFilterType: WEEKENDS
    const filterSelect = screen.getByDisplayValue(/Todos os dias do mês/i)
    fireEvent.change(filterSelect, { target: { value: 'WEEKENDS' } })

    fireEvent.click(screen.getByRole('button', { name: /criar regra/i }))

    expect(screen.getByText('Plantão fim de semana 12h')).toBeInTheDocument()
    expect(
      screen.getByText(/Dispara quando a carga horária de plantão do dia ultrapassar 12h em finais de semana/i)
    ).toBeInTheDocument()
  })

  it('duplicates a rule', () => {
    renderRulesView()

    const duplicateBtn = screen.getByTitle(/duplicar/i)
    fireEvent.click(duplicateBtn)

    expect(screen.getByText(/Máximo 1 turno por dia \(Cópia\)/i)).toBeInTheDocument()
  })

  it('deletes a rule after confirmation', () => {
    renderRulesView()

    const deleteBtn = screen.getByTitle(/excluir/i)
    fireEvent.click(deleteBtn)

    expect(screen.getByText(/deseja realmente excluir esta regra/i)).toBeInTheDocument()

    // Confirm delete in modal
    const confirmButtons = screen.getAllByRole('button', { name: /excluir/i })
    const confirmBtn = confirmButtons[confirmButtons.length - 1]
    fireEvent.click(confirmBtn)

    expect(screen.queryByText('Máximo 1 turno por dia')).not.toBeInTheDocument()
  })

  it('shows the severity banner and the rule trigger criteria', () => {
    renderRulesView()

    // Severity banner
    expect(
      screen.getByText(/Como funcionam os critérios de validação e severidade/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Não representa um defeito ou erro no cadastro da regra/i)
    ).toBeInTheDocument()

    // Trigger criteria
    expect(
      screen.getByText(/Critério de Disparo \(Quando gera erro\):/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Dispara quando o mesmo profissional for escalado em mais de 1 plantão/i)
    ).toBeInTheDocument()

    // The active month impact is not shown
    expect(screen.queryByText(/Impacto na Escala Atual/i)).not.toBeInTheDocument()
  })

  it('filters the rules with the search', () => {
    renderRulesView()

    expect(screen.getByText('Máximo 1 turno por dia')).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText(/buscar regras/i)
    fireEvent.change(searchInput, { target: { value: 'Inexistente' } })

    expect(screen.queryByText('Máximo 1 turno por dia')).not.toBeInTheDocument()
    expect(screen.getByText(/nenhuma regra encontrada/i)).toBeInTheDocument()
  })

  it('renders a drag handle to reorder the rules', () => {
    renderRulesView()

    expect(screen.getByTestId('drag-handle-rule_max_1_day')).toHaveAccessibleName(
      'Arrastar para reordenar Máximo 1 turno por dia',
    )
  })

  const storeRule = (overrides: Partial<ShiftRule>) => {
    const rule: ShiftRule = {
      id: 'rule_test',
      name: 'Regra de teste',
      type: 'MAX_SHIFTS_PER_PERIOD',
      enabledByDefault: true,
      severity: 'WARNING',
      parameters: {},
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      ...overrides,
    }
    useScheduleStore.setState({ shiftRules: [rule] })
  }

  const openEditForm = () => {
    fireEvent.click(screen.getByTitle('Editar'))
    return screen.getByTestId('rule-form')
  }

  describe('trigger criterion', () => {
    it.each<[string, Pick<ShiftRule, 'type' | 'parameters'>, RegExp]>([
      [
        'shifts per week',
        { type: 'MAX_SHIFTS_PER_PERIOD', parameters: { scope: 'WEEK', maxOccurrences: 3 } },
        /mais de 3 plantão\(ões\) na mesma semana/,
      ],
      [
        'shifts per month',
        { type: 'MAX_SHIFTS_PER_PERIOD', parameters: { scope: 'MONTH', maxOccurrences: 9 } },
        /mais de 9 plantão\(ões\) no mesmo mês/,
      ],
      [
        'shifts with default values',
        { type: 'MAX_SHIFTS_PER_PERIOD', parameters: {} },
        /mais de 1 plantão\(ões\) no mesmo dia/,
      ],
      [
        'hours per day',
        { type: 'MAX_HOURS_PER_PERIOD', parameters: { scope: 'DAY', maxHours: 12 } },
        /no mesmo dia ultrapassar 12h/,
      ],
      [
        'hours per week',
        { type: 'MAX_HOURS_PER_PERIOD', parameters: { scope: 'WEEK', maxHours: 44 } },
        /na semana ultrapassar 44h/,
      ],
      [
        'hours per month',
        { type: 'MAX_HOURS_PER_PERIOD', parameters: { scope: 'MONTH', maxHours: 180 } },
        /no mês ultrapassar 180h/,
      ],
      ['minimum rest', { type: 'MIN_REST_HOURS', parameters: { minRestHours: 36 } }, /menor que 36h/],
      [
        'consecutive days',
        { type: 'CONSECUTIVE_DAYS_LIMIT', parameters: { consecutiveDaysLimit: 2 } },
        /mais de 2 dia\(s\) seguidos/,
      ],
      [
        'people per shift',
        { type: 'MAX_PEOPLE_PER_SHIFT', parameters: { maxPeople: 2 } },
        /mais de 2 profissional\(is\)/,
      ],
      [
        'people per shift from an older rule',
        { type: 'MAX_PEOPLE_PER_SHIFT', parameters: { maxOccurrences: 4 } },
        /mais de 4 profissional\(is\)/,
      ],
      [
        'exact daily hours',
        { type: 'DAILY_SHIFT_HOURS', parameters: { targetDailyHours: 24, dayFilterType: 'WEEKENDS' } },
        /diferente de exatamente 24h em finais de semana/,
      ],
      [
        'maximum daily hours',
        {
          type: 'DAILY_SHIFT_HOURS',
          parameters: { targetDailyHours: 12, dailyHoursComparison: 'MAX', dayFilterType: 'WEEKDAYS' },
        },
        /ultrapassar 12h em dias de semana/,
      ],
      [
        'minimum daily hours',
        { type: 'DAILY_SHIFT_HOURS', parameters: { targetDailyHours: 6, dailyHoursComparison: 'MIN' } },
        /menor que 6h em todos os dias/,
      ],
    ])('explains %s', (_case, rule, expected) => {
      storeRule(rule)

      renderRulesView()

      expect(screen.getByText(expected)).toBeInTheDocument()
    })
  })

  describe('editing a rule', () => {
    it('fills the form with the rule and saves the changes on the same rule', () => {
      storeRule({ name: 'Antiga', description: 'Texto', parameters: { minRestHours: 36 }, type: 'MIN_REST_HOURS' })
      renderRulesView()

      const form = openEditForm()
      expect(within(form).getByDisplayValue('Texto')).toBeInTheDocument()
      expect(within(form).getByDisplayValue('36')).toBeInTheDocument()

      fireEvent.change(within(form).getByDisplayValue('Antiga'), { target: { value: ' Nova ' } })
      fireEvent.click(within(form).getByRole('button', { name: 'Salvar Regra' }))

      const { shiftRules } = useScheduleStore.getState()
      expect(shiftRules).toHaveLength(1)
      expect(shiftRules[0]).toMatchObject({
        id: 'rule_test',
        name: 'Nova',
        description: 'Texto',
        parameters: { minRestHours: 36 },
      })
    })

    it('keeps the specific days of a daily hours rule', () => {
      storeRule({
        type: 'DAILY_SHIFT_HOURS',
        parameters: {
          targetDailyHours: 12,
          dailyHoursComparison: 'MIN',
          dayFilterType: 'SPECIFIC_DAYS',
          specificDaysOfWeek: [1, 3],
        },
      })
      renderRulesView()

      fireEvent.click(within(openEditForm()).getByRole('button', { name: 'Salvar Regra' }))

      expect(useScheduleStore.getState().shiftRules[0]?.parameters).toEqual({
        targetDailyHours: 12,
        dailyHoursComparison: 'MIN',
        dayFilterType: 'SPECIFIC_DAYS',
        specificDaysOfWeek: [1, 3],
      })
    })

    it('limits the rule to the chosen shifts, and removes the limit when unchosen', () => {
      storeRule({ type: 'MIN_REST_HOURS', parameters: { minRestHours: 12 } })
      renderRulesView()

      let form = openEditForm()
      fireEvent.click(within(form).getByRole('button', { name: /Plantão Diurno 12h \(D12\)/ }))
      fireEvent.click(within(form).getByRole('button', { name: 'Salvar Regra' }))
      expect(useScheduleStore.getState().shiftRules[0]?.parameters.targetShiftIds).toEqual([
        'shift_d12',
      ])

      form = openEditForm()
      fireEvent.click(within(form).getByRole('button', { name: /Plantão Diurno 12h \(D12\)/ }))
      fireEvent.click(within(form).getByRole('button', { name: 'Salvar Regra' }))
      expect(useScheduleStore.getState().shiftRules[0]?.parameters.targetShiftIds).toBeUndefined()
    })

    it('does not save a rule with a blank name', () => {
      storeRule({ name: 'Antiga' })
      renderRulesView()

      const form = openEditForm()
      fireEvent.change(within(form).getByDisplayValue('Antiga'), { target: { value: '   ' } })
      fireEvent.submit(form)

      expect(useScheduleStore.getState().shiftRules[0]?.name).toBe('Antiga')
    })
  })
})
