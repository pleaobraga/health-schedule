import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Select } from './select'

const OPTIONS = (
  <>
    <option value="a">Alfa</option>
    <option value="b">Beta</option>
    <option value="c" disabled>
      Gama
    </option>
  </>
)

function renderSelect(props: Partial<Parameters<typeof Select>[0]> = {}) {
  const onValueChange = vi.fn()
  render(
    <>
      <Select data-testid="field" value="a" onValueChange={onValueChange} {...props}>
        {props.children ?? OPTIONS}
      </Select>
      <button type="button">Fora</button>
    </>,
  )
  return { onValueChange, trigger: screen.getByTestId('field-trigger') }
}

const menuOption = (name: string) =>
  within(screen.getByRole('listbox')).getByRole('option', { name })

describe('Select', () => {
  it('shows the label of the selected option', () => {
    const { trigger } = renderSelect({ value: 'b' })

    expect(trigger).toHaveTextContent('Beta')
  })

  it('falls back to the first option for an unknown value', () => {
    const { trigger } = renderSelect({ value: 'nope' })

    expect(trigger).toHaveTextContent('Alfa')
  })

  it('shows the placeholder when there are no options', () => {
    const { trigger } = renderSelect({ value: '', children: [], placeholder: 'Escolha' })

    expect(trigger).toHaveTextContent('Escolha')
  })

  it('reads options nested in groups', async () => {
    const { trigger } = renderSelect({
      children: (
        <optgroup label="Grupo">
          <option value="a">Alfa</option>
        </optgroup>
      ),
    })

    await userEvent.click(trigger)

    expect(menuOption('Alfa')).toBeInTheDocument()
  })

  it('opens on click, marks the selected option and chooses another one', async () => {
    const { trigger, onValueChange } = renderSelect()

    await userEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(menuOption('Alfa')).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(menuOption('Beta'))

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('b')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('renders the menu outside the container, so overflow cannot clip it', async () => {
    const { trigger } = renderSelect()

    await userEvent.click(trigger)

    expect(screen.getByRole('listbox').parentElement).toBe(document.body)
  })

  it('sends a change event with the chosen value', async () => {
    const onChange = vi.fn()
    const { trigger } = renderSelect({ onChange })

    await userEvent.click(trigger)
    await userEvent.click(menuOption('Beta'))

    expect(onChange.mock.calls[0]?.[0].target.value).toBe('b')
  })

  it('follows a change on the native field', () => {
    const { onValueChange } = renderSelect()

    fireEvent.change(screen.getByTestId('field'), { target: { value: 'b' } })

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('b')
  })

  it('closes on a second click, on Escape and on a click outside', async () => {
    const { trigger } = renderSelect()

    await userEvent.click(trigger)
    await userEvent.click(trigger)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    await userEvent.click(trigger)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('button', { name: 'Fora' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('does not choose a disabled option', async () => {
    const { trigger, onValueChange } = renderSelect()

    await userEvent.click(trigger)
    await userEvent.click(menuOption('Gama'), {
      pointerEventsCheck: 0,
    })

    expect(onValueChange).not.toHaveBeenCalled()
  })

  it('does not open while disabled', async () => {
    const { trigger } = renderSelect({ disabled: true })

    await userEvent.click(trigger, { pointerEventsCheck: 0 })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('opens with the arrow keys on the current option and chooses with Enter', async () => {
    const { trigger, onValueChange } = renderSelect()

    trigger.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await userEvent.keyboard('{ArrowDown}{Enter}')

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('b')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('wraps around with the arrow keys and chooses with Space', async () => {
    const { trigger, onValueChange } = renderSelect({
      children: (
        <>
          <option value="a">Alfa</option>
          <option value="b">Beta</option>
        </>
      ),
    })

    trigger.focus()
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{ }')

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('b')
  })

  it('passes the invalid state to the visible trigger', () => {
    const { trigger } = renderSelect({ 'aria-invalid': true })

    expect(trigger).toHaveAttribute('aria-invalid', 'true')
  })
})
