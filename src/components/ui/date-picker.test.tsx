import { fireEvent, render, screen } from '@testing-library/react'
import { format } from 'date-fns'
import { describe, expect, it, vi } from 'vitest'

import { DatePicker } from './date-picker'

const day = (iso: string) =>
  document.querySelector<HTMLButtonElement>(`button[data-day="${iso}"]`)

describe('DatePicker', () => {
  it('opens on the month of the value and reports the picked day as YYYY-MM-DD', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-03-13" onChange={onChange} data-testid="d" />)

    expect(screen.getByTestId('d-trigger')).toHaveTextContent('13/03/2026')
    fireEvent.click(screen.getByTestId('d-trigger'))
    expect(screen.getByTestId('d-popover')).toHaveTextContent(/março 2026/i)

    fireEvent.click(day('2026-03-20') as HTMLButtonElement)

    expect(onChange).toHaveBeenCalledWith('2026-03-20')
    expect(screen.queryByTestId('d-popover')).not.toBeInTheDocument()
  })

  it('keeps the value when the selected day is clicked again', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-03-13" onChange={onChange} data-testid="d" />)

    fireEvent.click(screen.getByTestId('d-trigger'))
    fireEvent.click(day('2026-03-13') as HTMLButtonElement)

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByTestId('d-popover')).not.toBeInTheDocument()
  })

  it('navigates months with translated controls', () => {
    render(<DatePicker value="2026-03-13" onChange={vi.fn()} data-testid="d" />)

    fireEvent.click(screen.getByTestId('d-trigger'))
    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }))
    expect(screen.getByTestId('d-popover')).toHaveTextContent(/fevereiro 2026/i)

    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(screen.getByTestId('d-popover')).toHaveTextContent(/março 2026/i)
  })

  it('picks today through the shortcut', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2020-01-01" onChange={onChange} data-testid="d" />)

    fireEvent.click(screen.getByTestId('d-trigger'))
    fireEvent.click(screen.getByTestId('d-today'))

    expect(onChange).toHaveBeenCalledWith(format(new Date(), 'yyyy-MM-dd'))
  })
})
