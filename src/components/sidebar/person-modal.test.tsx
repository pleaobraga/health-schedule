import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PersonModal } from './person-modal'

import type { PersonModalProps } from './person-modal'

const person = { id: 'p1', name: 'Dra. Camila', color: '#123456' }

function renderModal(props: Partial<PersonModalProps> = {}) {
  const handlers = { onClose: vi.fn(), onSave: vi.fn(), onDelete: vi.fn() }
  render(<PersonModal isOpen={true} currentMonth="2026-10" {...handlers} {...props} />)
  return handlers
}

const nameInput = () => screen.getByPlaceholderText('Ex: Dra. Camila Santos')

describe('PersonModal', () => {
  it('renders nothing while closed', () => {
    renderModal({ isOpen: false })

    expect(screen.queryByPlaceholderText('Ex: Dra. Camila Santos')).not.toBeInTheDocument()
  })

  it('requires a name, marks the field and clears the error on typing', () => {
    const { onSave, onClose } = renderModal()

    fireEvent.change(nameInput(), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar Pessoa' }))

    expect(screen.getByText('Por favor, informe o nome da pessoa.')).toBeInTheDocument()
    expect(nameInput()).toHaveAttribute('aria-invalid', 'true')
    expect(onSave).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.change(nameInput(), { target: { value: 'Bia' } })

    expect(screen.queryByText('Por favor, informe o nome da pessoa.')).not.toBeInTheDocument()
  })

  it('saves a new person with a trimmed name and closes', () => {
    const { onSave, onClose } = renderModal()

    fireEvent.change(nameInput(), { target: { value: '  Bia  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar Pessoa' }))

    expect(onSave).toHaveBeenCalledExactlyOnceWith('Bia', expect.any(String), [])
    expect(onClose).toHaveBeenCalled()
  })

  it('fills the form with the person being edited, days included', () => {
    const { onSave } = renderModal({ personToEdit: person, initialAvailableDays: [3, 4] })

    expect(nameInput()).toHaveValue('Dra. Camila')

    fireEvent.click(screen.getByRole('button', { name: 'Salvar Alterações' }))

    expect(onSave).toHaveBeenCalledExactlyOnceWith('Dra. Camila', '#123456', [3, 4])
  })

  it('offers no delete action for a new person', () => {
    renderModal()

    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
  })

  it('deletes only after the confirmation', () => {
    const { onDelete, onClose } = renderModal({ personToEdit: person })

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(
      screen.getByText(/Tem certeza que deseja remover Dra. Camila\?/),
    ).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Excluir' }).pop() as HTMLElement)

    expect(onDelete).toHaveBeenCalledExactlyOnceWith('p1')
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps the person when the confirmation is cancelled', () => {
    const { onDelete, onClose } = renderModal({ personToEdit: person })

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    fireEvent.click(screen.getAllByRole('button', { name: /Cancelar/ }).pop() as HTMLElement)

    expect(onDelete).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
