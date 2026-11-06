import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { MonthShiftConfigModal } from './month-shift-config-modal'
import { useScheduleStore } from '../../store/use-schedule-store'

describe('MonthShiftConfigModal', () => {
  const currentMonth = '2026-10'

  beforeEach(() => {
    useScheduleStore.setState({
      currentMonth,
      shiftDefinitions: [
        {
          id: 'shift_d12',
          name: 'Plantão Diurno 12h',
          code: 'D12',
          startTime: '07:00',
          durationHours: 12,
          color: '#3b82f6',
          enabledByDefault: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        {
          id: 'shift_n12',
          name: 'Plantão Noturno 12h',
          code: 'N12',
          startTime: '19:00',
          durationHours: 12,
          color: '#8b5cf6',
          enabledByDefault: true,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
      monthDailyShifts: {},
    })
  })

  it('renders nothing when isOpen is false', () => {
    render(
      <MonthShiftConfigModal
        isOpen={false}
        onClose={vi.fn()}
        currentMonth={currentMonth}
      />
    )
    expect(screen.queryByText(/Configurar Plantões e Horas por Dia/i)).not.toBeInTheDocument()
  })

  it('lists the registered shifts when open', () => {
    render(
      <MonthShiftConfigModal
        isOpen={true}
        onClose={vi.fn()}
        currentMonth={currentMonth}
      />
    )

    expect(screen.getByText(/Configurar Plantões Diários/i)).toBeInTheDocument()
    expect(screen.getAllByText('Plantão Diurno 12h').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Plantão Noturno 12h')).toBeInTheDocument()
  })

  it('applies a day shortcut and saves it to the store', () => {
    const handleClose = vi.fn()
    render(
      <MonthShiftConfigModal
        isOpen={true}
        onClose={handleClose}
        currentMonth={currentMonth}
      />
    )

    // Click "Todos os Dias" shortcut for the first shift (D12)
    const allDaysBtn = screen.getByRole('button', { name: /todos os dias/i })
    fireEvent.click(allDaysBtn)

    // October 2026 has 31 days
    expect(screen.getByText(/31 dias selecionados/i)).toBeInTheDocument()

    // Click "Salvar Configuração"
    const saveBtn = screen.getByRole('button', { name: /salvar configuração/i })
    fireEvent.click(saveBtn)

    const savedState = useScheduleStore.getState().monthDailyShifts[currentMonth]
    expect(savedState).toBeDefined()
    expect(savedState['shift_d12']).toHaveLength(31)
    expect(handleClose).toHaveBeenCalled()
  })

  it('creates a new shift type with a custom start time and duration', () => {
    render(
      <MonthShiftConfigModal
        isOpen={true}
        onClose={vi.fn()}
        currentMonth={currentMonth}
      />
    )

    // Click "Novo Plantão"
    const newShiftBtn = screen.getByRole('button', { name: /novo plantão/i })
    fireEvent.click(newShiftBtn)

    // Fill form
    const nameInput = screen.getByPlaceholderText(/ex: plantão 12h noturno/i)
    fireEvent.change(nameInput, { target: { value: 'Plantão Fim de Semana 24h' } })

    const durationInput = screen.getByDisplayValue('12')
    fireEvent.change(durationInput, { target: { value: '24' } })

    const timeInput = screen.getByDisplayValue('07:00')
    fireEvent.change(timeInput, { target: { value: '08:00' } })

    // Save shift
    const createBtn = screen.getByRole('button', { name: /salvar plantão/i })
    fireEvent.click(createBtn)

    // New shift should now appear in the list and in store definitions
    expect(screen.getByText('Plantão Fim de Semana 24h')).toBeInTheDocument()
    const defs = useScheduleStore.getState().shiftDefinitions
    expect(defs.some((d) => d.name === 'Plantão Fim de Semana 24h' && d.durationHours === 24)).toBe(true)
  })

  const openModal = () => {
    const handleClose = vi.fn()
    render(
      <MonthShiftConfigModal isOpen={true} onClose={handleClose} currentMonth={currentMonth} />,
    )
    return handleClose
  }

  const save = () => fireEvent.click(screen.getByRole('button', { name: /salvar configuração/i }))
  const savedDays = (shiftId = 'shift_d12') =>
    useScheduleStore.getState().monthDailyShifts[currentMonth]?.[shiftId]

  // October 2026 starts on a Thursday and has 31 days
  it.each([
    ['Dias Úteis', 22, [1, 2, 5]],
    ['Finais de Semana', 9, [3, 4, 10]],
    ['Pares', 15, [2, 4, 6]],
    ['Ímpares', 16, [1, 3, 5]],
  ])('selects the days of the "%s" shortcut', (label, count, firstDays) => {
    openModal()

    fireEvent.click(screen.getByRole('button', { name: label }))
    save()

    expect(savedDays()).toHaveLength(count)
    expect(savedDays()?.slice(0, 3)).toEqual(firstDays)
  })

  it('clears the selected days', () => {
    useScheduleStore.setState({ monthDailyShifts: { [currentMonth]: { shift_d12: [1, 2] } } })
    openModal()

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }))
    save()

    expect(savedDays()).toEqual([])
  })

  it('toggles a single day and keeps the days in order', () => {
    useScheduleStore.setState({ monthDailyShifts: { [currentMonth]: { shift_d12: [1, 20] } } })
    openModal()

    fireEvent.click(screen.getByRole('button', { name: /^10/ }))
    fireEvent.click(screen.getByRole('button', { name: /^1(?!\d)/ }))
    save()

    expect(savedDays()).toEqual([10, 20])
  })

  it('changes the days of the shift picked in the list only', () => {
    openModal()

    fireEvent.click(screen.getAllByText('N12')[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: 'Pares' }))
    save()

    expect(savedDays('shift_n12')).toHaveLength(15)
    expect(savedDays('shift_d12')).toEqual([])
  })

  it('removes a shift from the month and moves to the next one', () => {
    openModal()

    fireEvent.click(screen.getAllByRole('button', { name: 'Remover plantão deste mês' })[0] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: 'Pares' }))
    save()

    expect(savedDays('shift_d12')).toBeUndefined()
    expect(savedDays('shift_n12')).toHaveLength(15)
  })

  it('adds back a registered shift that is out of the month', () => {
    useScheduleStore.setState({ monthDailyShifts: { [currentMonth]: { shift_d12: [1] } } })
    openModal()

    fireEvent.click(screen.getByRole('button', { name: /Plantão Noturno 12h/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Ímpares' }))
    save()

    expect(savedDays('shift_n12')).toHaveLength(16)
    expect(savedDays('shift_d12')).toEqual([1])
  })

  it('does not save anything when closed without saving', () => {
    const handleClose = openModal()

    fireEvent.click(screen.getByRole('button', { name: 'Pares' }))
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(handleClose).toHaveBeenCalled()
    expect(savedDays()).toBeUndefined()
  })
})
