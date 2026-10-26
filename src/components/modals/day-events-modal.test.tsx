import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import { DayEventsModal } from './day-events-modal'
import { useScheduleStore } from '../../store/use-schedule-store'

describe('DayEventsModal', () => {
  beforeEach(() => {
    useScheduleStore.setState({
      selectedDateForEvents: null,
      events: [],
    })
  })

  it('renders nothing when selectedDateForEvents is null', () => {
    render(<DayEventsModal />)
    expect(screen.queryByText('Eventos do Dia')).not.toBeInTheDocument()
  })

  it('starts with the form closed and an empty state when the day has no events', () => {
    useScheduleStore.setState({ selectedDateForEvents: '2026-10-15' })
    render(<DayEventsModal />)

    expect(screen.getByText('Eventos do Dia')).toBeInTheDocument()
    expect(screen.getByText(/Nenhum evento registrado para este dia/i)).toBeInTheDocument()
    // The form starts closed
    expect(screen.queryByText('Novo Evento para este Dia')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Ex: Auditoria ou Reunião Clínica')).not.toBeInTheDocument()

    // Buttons to open the form are available
    const addButtons = screen.getAllByRole('button', { name: /Adicionar Evento/i })
    expect(addButtons.length).toBeGreaterThan(0)
  })

  it('opens the form with Adicionar Evento and closes it on Cancelar', () => {
    useScheduleStore.setState({ selectedDateForEvents: '2026-10-15' })
    render(<DayEventsModal />)

    // Open the form
    const addBtn = screen.getAllByRole('button', { name: /Adicionar Evento/i })[0]
    fireEvent.click(addBtn)

    expect(screen.getByText('Novo Evento para este Dia')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ex: Auditoria ou Reunião Clínica')).toBeInTheDocument()

    // Cancel
    const cancelBtn = screen.getAllByRole('button', { name: /^Cancelar$/i })[0]
    fireEvent.click(cancelBtn)

    expect(screen.queryByText('Novo Evento para este Dia')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Ex: Auditoria ou Reunião Clínica')).not.toBeInTheDocument()
  })

  it('lists the day events with edit and delete buttons', () => {
    useScheduleStore.setState({
      selectedDateForEvents: '2026-10-15',
      events: [
        {
          id: 'ev-1',
          date: '2026-10-15',
          title: 'Plantão Noturno',
          time: '19:00',
          description: 'Equipe de UTI',
        },
      ],
    })

    render(<DayEventsModal />)

    expect(screen.getByText('Plantão Noturno')).toBeInTheDocument()
    expect(screen.getByText('19:00')).toBeInTheDocument()
    expect(screen.getByText('Equipe de UTI')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Editar evento Plantão Noturno/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Excluir evento Plantão Noturno/i })).toBeInTheDocument()
    // The form is closed by default
    expect(screen.queryByText('Novo Evento para este Dia')).not.toBeInTheDocument()
  })

  it('adds an event with a time and a new inline address, then closes the form', () => {
    useScheduleStore.setState({
      selectedDateForEvents: '2026-10-15',
      events: [],
    })

    render(<DayEventsModal />)

    // Open the form
    const addBtn = screen.getAllByRole('button', { name: /Adicionar Evento/i })[0]
    fireEvent.click(addBtn)

    const titleInput = screen.getByPlaceholderText('Ex: Auditoria ou Reunião Clínica')
    fireEvent.change(titleInput, { target: { value: 'Reunião Geral' } })

    const timeInput = screen.getByLabelText(/Horário \(Opcional\)/i)
    fireEvent.change(timeInput, { target: { value: '14:30' } })

    // The manual address textarea is hidden by default
    expect(screen.queryByPlaceholderText(/Digite o endereço completo na hora/i)).not.toBeInTheDocument()

    // Pick "+ Novo endereço"
    const addressSelect = screen.getByLabelText('Selecionar endereço do evento')
    fireEvent.change(addressSelect, { target: { value: '__new__' } })

    // Textarea aparece
    const addressInput = screen.getByPlaceholderText(/Digite o endereço completo na hora/i)
    fireEvent.change(addressInput, { target: { value: 'Rua das Flores, 123\nBloco B' } })

    const submitBtn = screen.getByRole('button', { name: /^Adicionar Evento$/i })
    fireEvent.click(submitBtn)

    const storeEvents = useScheduleStore.getState().events
    expect(storeEvents).toHaveLength(1)
    expect(storeEvents[0]).toMatchObject({
      date: '2026-10-15',
      title: 'Reunião Geral',
      time: '14:30',
      address: 'Rua das Flores, 123\nBloco B',
    })

    // The form closes after saving
    expect(screen.queryByText('Novo Evento para este Dia')).not.toBeInTheDocument()
  })

  it('selects a registered address from the dropdown', () => {
    useScheduleStore.setState({
      selectedDateForEvents: '2026-10-15',
      events: [],
      addresses: [
        {
          id: 'addr-1',
          name: 'Clínica Paulista',
          street: 'Av Paulista',
          number: '1000',
          neighborhood: 'Bela Vista',
          city: 'São Paulo',
        },
      ],
    })

    render(<DayEventsModal />)

    // Open the form
    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar Evento/i })[0])

    const titleInput = screen.getByPlaceholderText('Ex: Auditoria ou Reunião Clínica')
    fireEvent.change(titleInput, { target: { value: 'Visita Domiciliar' } })

    const addressSelect = screen.getByLabelText('Selecionar endereço do evento')
    fireEvent.change(addressSelect, { target: { value: 'addr-1' } })

    // Preview of the selected address
    expect(screen.getByTestId('selected-address-preview')).toBeInTheDocument()
    expect(screen.getByText('Clínica Paulista')).toBeInTheDocument()

    // The manual textarea stays hidden
    expect(screen.queryByPlaceholderText(/Digite o endereço completo na hora/i)).not.toBeInTheDocument()

    const submitBtn = screen.getByRole('button', { name: /^Adicionar Evento$/i })
    fireEvent.click(submitBtn)

    const storeEvents = useScheduleStore.getState().events
    expect(storeEvents).toHaveLength(1)
    expect(storeEvents[0].address).toBe('Clínica Paulista\nAv Paulista, 1000\nBela Vista - São Paulo')

    // The form closes after saving
    expect(screen.queryByText('Novo Evento para este Dia')).not.toBeInTheDocument()
  })

  it('fills the form from the edit button, updates the event and closes the form', () => {
    useScheduleStore.setState({
      selectedDateForEvents: '2026-10-15',
      events: [
        {
          id: 'ev-1',
          date: '2026-10-15',
          title: 'Plantão Manhã',
          time: '07:00',
          address: 'Rua Antiga, 50',
        },
      ],
    })

    render(<DayEventsModal />)

    // The form starts closed
    expect(screen.queryByText('Editar Evento')).not.toBeInTheDocument()

    // Edit the existing event
    const editBtn = screen.getByRole('button', { name: /Editar evento Plantão Manhã/i })
    fireEvent.click(editBtn)

    // The form opens with the "Editar Evento" title
    expect(screen.getByText('Editar Evento')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Salvar Alterações/i })).toBeInTheDocument()
    expect(screen.getByText('Cancelar Edição')).toBeInTheDocument()

    const titleInput = screen.getByPlaceholderText('Ex: Auditoria ou Reunião Clínica')
    expect(titleInput).toHaveValue('Plantão Manhã')

    const timeInput = screen.getByLabelText(/Horário \(Opcional\)/i)
    expect(timeInput).toHaveValue('07:00')

    const addressInput = screen.getByPlaceholderText(/Digite o endereço completo na hora/i)
    expect(addressInput).toHaveValue('Rua Antiga, 50')

    // Modifica valores
    fireEvent.change(titleInput, { target: { value: 'Plantão Noturno Extra' } })
    fireEvent.change(timeInput, { target: { value: '22:00' } })
    fireEvent.change(addressInput, { target: { value: 'Rua Nova, 100\nApto 4' } })

    const saveBtn = screen.getByRole('button', { name: /Salvar Alterações/i })
    fireEvent.click(saveBtn)

    const storeEvents = useScheduleStore.getState().events
    expect(storeEvents[0].title).toBe('Plantão Noturno Extra')
    expect(storeEvents[0].time).toBe('22:00')
    expect(storeEvents[0].address).toBe('Rua Nova, 100\nApto 4')

    // The form closes after saving the edit
    expect(screen.queryByText('Editar Evento')).not.toBeInTheDocument()
    expect(screen.queryByText('Novo Evento para este Dia')).not.toBeInTheDocument()
  })

  it('cancels an edit and closes the form', () => {
    useScheduleStore.setState({
      selectedDateForEvents: '2026-10-15',
      events: [
        {
          id: 'ev-1',
          date: '2026-10-15',
          title: 'Plantão Manhã',
          time: '08:00',
        },
      ],
    })

    render(<DayEventsModal />)

    const editBtn = screen.getByRole('button', { name: /Editar evento Plantão Manhã/i })
    fireEvent.click(editBtn)

    expect(screen.getByText('Editar Evento')).toBeInTheDocument()

    const cancelBtn = screen.getByText('Cancelar Edição')
    fireEvent.click(cancelBtn)

    // The form is closed
    expect(screen.queryByText('Editar Evento')).not.toBeInTheDocument()
    expect(screen.queryByText('Novo Evento para este Dia')).not.toBeInTheDocument()
  })

  it('shows an error when saving an event without a title', () => {
    useScheduleStore.setState({
      selectedDateForEvents: '2026-10-15',
      events: [],
    })

    render(<DayEventsModal />)

    // Open the form
    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar Evento/i })[0])

    const submitBtn = screen.getByRole('button', { name: /^Adicionar Evento$/i })
    fireEvent.click(submitBtn)

    expect(screen.getByText('O título do evento é obrigatório.')).toBeInTheDocument()
    expect(useScheduleStore.getState().events).toHaveLength(0)
  })

  it('deletes an event', () => {
    useScheduleStore.setState({
      selectedDateForEvents: '2026-10-15',
      events: [
        {
          id: 'ev-1',
          date: '2026-10-15',
          title: 'Evento para Excluir',
        },
      ],
    })

    render(<DayEventsModal />)

    const deleteBtn = screen.getByRole('button', { name: /Excluir evento Evento para Excluir/i })
    fireEvent.click(deleteBtn)

    expect(useScheduleStore.getState().events).toHaveLength(0)
  })

  it('renders the clock icon with dark theme classes when the event has a time', () => {
    useScheduleStore.setState({
      selectedDateForEvents: '2026-10-15',
      events: [
        {
          id: 'ev-1',
          date: '2026-10-15',
          title: 'Plantão Noturno',
          time: '19:00',
        },
      ],
    })

    render(<DayEventsModal />)
    const clockIcon = document.body.querySelector('.lucide-clock')
    expect(clockIcon).toBeInTheDocument()
    expect(clockIcon).toHaveClass('dark:text-indigo-400')
  })

  it('preselects the caregiver assigned to the day for a new event', () => {
    useScheduleStore.setState({
      selectedDateForEvents: '2026-10-15',
      currentMonth: '2026-10',
      persons: [
        { id: 'p1', name: 'Maria Silva', color: '#3B82F6', active: true },
        { id: 'p2', name: 'Joana Santos', color: '#10B981', active: true },
      ],
      monthParticipants: { '2026-10': ['p1', 'p2'] },
      assignments: { '2026-10-15': ['p1'] },
      events: [],
    })

    render(<DayEventsModal />)

    // Open the form
    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar Evento/i })[0])

    const caregiverSelect = screen.getByLabelText(/Cuidadora \/ Profissional Responsável/i) as HTMLSelectElement
    expect(caregiverSelect.value).toBe('p1')

    const colorPreview = screen.getByTestId('selected-caregiver-color-preview')
    expect(colorPreview).toHaveStyle({ backgroundColor: '#3B82F6' })
  })

  it('links another caregiver of the month and saves its personId', () => {
    useScheduleStore.setState({
      selectedDateForEvents: '2026-10-15',
      currentMonth: '2026-10',
      persons: [
        { id: 'p1', name: 'Maria Silva', color: '#3B82F6', active: true },
        { id: 'p2', name: 'Joana Santos', color: '#10B981', active: true },
      ],
      monthParticipants: { '2026-10': ['p1', 'p2'] },
      assignments: { '2026-10-15': ['p1'] },
      events: [],
    })

    render(<DayEventsModal />)

    // Open the form
    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar Evento/i })[0])

    const titleInput = screen.getByPlaceholderText('Ex: Auditoria ou Reunião Clínica')
    fireEvent.change(titleInput, { target: { value: 'Curativo Especial' } })

    const caregiverSelect = screen.getByLabelText(/Cuidadora \/ Profissional Responsável/i)
    fireEvent.change(caregiverSelect, { target: { value: 'p2' } })

    const submitBtn = screen.getByRole('button', { name: /^Adicionar Evento$/i })
    fireEvent.click(submitBtn)

    const storeEvents = useScheduleStore.getState().events
    expect(storeEvents).toHaveLength(1)
    expect(storeEvents[0].personId).toBe('p2')
  })

  it('shows the colored badge of the linked caregiver in the events list', () => {
    useScheduleStore.setState({
      selectedDateForEvents: '2026-10-15',
      currentMonth: '2026-10',
      persons: [
        { id: 'p2', name: 'Joana Santos', color: '#10B981', active: true },
      ],
      monthParticipants: { '2026-10': ['p2'] },
      assignments: {},
      events: [
        {
          id: 'ev-1',
          date: '2026-10-15',
          title: 'Fisioterapia Respiratória',
          personId: 'p2',
        },
      ],
    })

    render(<DayEventsModal />)

    const badge = screen.getByTestId('event-caregiver-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('Joana Santos')
    expect(badge).toHaveStyle({ backgroundColor: '#10B981' })
  })

  it('copies the address of an event from the list', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    })

    useScheduleStore.setState({
      selectedDateForEvents: '2026-10-15',
      events: [
        {
          id: 'ev-1',
          date: '2026-10-15',
          title: 'Visita Técnica',
          address: 'Rua das Palmeiras, 250 - Apto 31',
        },
      ],
    })

    render(<DayEventsModal />)

    const copyBtn = screen.getByRole('button', { name: /Copiar endereço do evento/i })
    expect(copyBtn).toBeInTheDocument()
    expect(copyBtn).toHaveTextContent('Copiar')

    fireEvent.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalledWith('Rua das Palmeiras, 250 - Apto 31')
    expect(await screen.findByText('Copiado!')).toBeInTheDocument()
  })

  it('copies the address from the form preview', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    })

    useScheduleStore.setState({
      selectedDateForEvents: '2026-10-15',
      events: [],
      addresses: [
        {
          id: 'addr-1',
          name: 'Clínica Paulista',
          street: 'Av Paulista',
          number: '1000',
          neighborhood: 'Bela Vista',
          city: 'São Paulo',
        },
      ],
    })

    render(<DayEventsModal />)

    // Open the form
    fireEvent.click(screen.getAllByRole('button', { name: /Adicionar Evento/i })[0])

    const addressSelect = screen.getByLabelText('Selecionar endereço do evento')
    fireEvent.change(addressSelect, { target: { value: 'addr-1' } })

    const copyPreviewBtn = screen.getByRole('button', { name: /Copiar endereço selecionado/i })
    expect(copyPreviewBtn).toBeInTheDocument()

    fireEvent.click(copyPreviewBtn)

    expect(writeTextMock).toHaveBeenCalledWith('Clínica Paulista\nAv Paulista, 1000\nBela Vista - São Paulo')
    expect(await screen.findByText('Copiado!')).toBeInTheDocument()
  })
  it('uses the shared modal layout so the footer stays at the bottom on small screens', () => {
    useScheduleStore.setState({ selectedDateForEvents: '2026-10-15' })
    render(<DayEventsModal />)

    const body = screen.getByTestId('day-events-modal-body')
    expect(body).toHaveClass('modal-body')
    expect(body.parentElement).toHaveClass('modal-panel')
    expect(body.previousElementSibling).toHaveClass('modal-header')
    expect(body.nextElementSibling).toHaveClass('modal-footer')
  })

  describe('Expenses tab and actions', () => {
    const mockPersons = [
      { id: 'p1', name: 'Dra. Camila', color: '#3b82f6' },
      { id: 'p2', name: 'Dr. Lucas', color: '#10b981' },
    ]

    beforeEach(() => {
      useScheduleStore.setState({
        selectedDateForEvents: '2026-10-15',
        dayEventsModalTab: 'events',
        events: [],
        expenses: [],
        persons: mockPersons,
        monthParticipants: {},
      })
    })

    it('switches between Evento and Gasto tabs', () => {
      render(<DayEventsModal />)

      // Starts on events tab
      expect(screen.getByTestId('events-tab-content')).toBeInTheDocument()
      expect(screen.queryByTestId('expenses-tab-content')).not.toBeInTheDocument()

      // Click on Registrar Gasto tab
      const expenseTabBtn = screen.getByTestId('tab-expenses')
      fireEvent.click(expenseTabBtn)

      expect(screen.getByTestId('expenses-tab-content')).toBeInTheDocument()
      expect(screen.queryByTestId('events-tab-content')).not.toBeInTheDocument()

      // Click back on Evento tab
      const eventTabBtn = screen.getByTestId('tab-events')
      fireEvent.click(eventTabBtn)

      expect(screen.getByTestId('events-tab-content')).toBeInTheDocument()
      expect(screen.queryByTestId('expenses-tab-content')).not.toBeInTheDocument()
    })

    it('opens directly in expenses tab when dayEventsModalTab is expenses', () => {
      useScheduleStore.setState({
        selectedDateForEvents: '2026-10-15',
        dayEventsModalTab: 'expenses',
      })

      render(<DayEventsModal />)

      expect(screen.getByTestId('expenses-tab-content')).toBeInTheDocument()
      expect(screen.queryByTestId('events-tab-content')).not.toBeInTheDocument()
    })

    it('lists existing expenses with category and reimbursement person', () => {
      useScheduleStore.setState({
        selectedDateForEvents: '2026-10-15',
        dayEventsModalTab: 'expenses',
        expenses: [
          {
            id: 'exp-1',
            date: '2026-10-15',
            description: 'Compra de Medicamento',
            amount: 145.5,
            category: 'MEDICATION',
            personId: 'p1',
            createdAt: '2026-10-15T10:00:00Z',
            updatedAt: '2026-10-15T10:00:00Z',
          },
          {
            id: 'exp-2',
            date: '2026-10-15',
            description: 'Material de Limpeza',
            amount: 50.0,
            category: 'SUPPLIES',
            createdAt: '2026-10-15T11:00:00Z',
            updatedAt: '2026-10-15T11:00:00Z',
          },
        ],
      })

      render(<DayEventsModal />)

      expect(screen.getByText('Compra de Medicamento')).toBeInTheDocument()
      expect(screen.getByText('Material de Limpeza')).toBeInTheDocument()
      expect(screen.getByText('Dra. Camila')).toBeInTheDocument()
      expect(screen.getByTestId('expense-reimbursement-badge')).toHaveStyle({
        backgroundColor: '#3b82f6',
      })
      expect(
        screen.getByRole('button', { name: /Editar gasto Compra de Medicamento/i }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /Excluir gasto Compra de Medicamento/i }),
      ).toBeInTheDocument()
    })

    it('validates required fields when adding an expense', async () => {
      useScheduleStore.setState({
        selectedDateForEvents: '2026-10-15',
        dayEventsModalTab: 'expenses',
      })

      render(<DayEventsModal />)

      // Open form
      const openAddBtn = screen.getAllByTestId('open-add-expense-btn')[0]
      fireEvent.click(openAddBtn)

      // Try submitting empty
      const submitBtn = screen.getByTestId('submit-expense-btn')
      fireEvent.click(submitBtn)

      expect(
        screen.getByText(/A descrição do gasto é obrigatória/i),
      ).toBeInTheDocument()

      // Fill description but invalid amount
      const descInput = screen.getByLabelText(/Descrição do Gasto/i)
      fireEvent.change(descInput, { target: { value: 'Farmácia Central' } })
      fireEvent.click(submitBtn)

      expect(
        screen.getByText(/Informe um valor monetário válido maior que zero/i),
      ).toBeInTheDocument()
    })

    it('adds a new expense with caregiver and category successfully', async () => {
      useScheduleStore.setState({
        selectedDateForEvents: '2026-10-15',
        dayEventsModalTab: 'expenses',
        expenses: [],
      })

      render(<DayEventsModal />)

      // Open form
      const openAddBtn = screen.getAllByTestId('open-add-expense-btn')[0]
      fireEvent.click(openAddBtn)

      // Fill form
      fireEvent.change(
        screen.getByLabelText(/Descrição do Gasto/i),
        { target: { value: 'Medicamento Especial' } },
      )
      fireEvent.change(
        screen.getByLabelText(/Valor/i),
        { target: { value: '89.90' } },
      )
      fireEvent.change(
        screen.getByLabelText(/Reembolso para Profissional/i),
        { target: { value: 'p1' } },
      )
      fireEvent.change(
        screen.getByLabelText(/Categoria do Gasto/i),
        { target: { value: 'MEDICATION' } },
      )

      // Submit
      fireEvent.click(screen.getByTestId('submit-expense-btn'))

      // Verify expense added to store
      const updatedExpenses = useScheduleStore.getState().expenses
      expect(updatedExpenses).toHaveLength(1)
      expect(updatedExpenses[0]).toMatchObject({
        date: '2026-10-15',
        description: 'Medicamento Especial',
        amount: 89.9,
        personId: 'p1',
        category: 'MEDICATION',
      })
    })

    it('edits an existing expense successfully', async () => {
      useScheduleStore.setState({
        selectedDateForEvents: '2026-10-15',
        dayEventsModalTab: 'expenses',
        expenses: [
          {
            id: 'exp-1',
            date: '2026-10-15',
            description: 'Gasto Original',
            amount: 50.0,
            category: 'OTHER',
            createdAt: '2026-10-15T10:00:00Z',
            updatedAt: '2026-10-15T10:00:00Z',
          },
        ],
      })

      render(<DayEventsModal />)

      // Click edit button
      const editBtn = screen.getByRole('button', {
        name: /Editar gasto Gasto Original/i,
      })
      fireEvent.click(editBtn)

      // Check form is populated
      const descInput = screen.getByDisplayValue('Gasto Original')
      fireEvent.change(descInput, { target: { value: 'Gasto Atualizado' } })

      const amountInput = screen.getByDisplayValue('50')
      fireEvent.change(amountInput, { target: { value: '75' } })

      // Save
      const saveBtn = screen.getByTestId('submit-expense-btn')
      expect(saveBtn).toHaveTextContent('Salvar Gasto')
      fireEvent.click(saveBtn)

      const updatedExpenses = useScheduleStore.getState().expenses
      expect(updatedExpenses).toHaveLength(1)
      expect(updatedExpenses[0].description).toBe('Gasto Atualizado')
      expect(updatedExpenses[0].amount).toBe(75)
    })

    it('deletes an expense when the delete button is clicked', async () => {
      useScheduleStore.setState({
        selectedDateForEvents: '2026-10-15',
        dayEventsModalTab: 'expenses',
        expenses: [
          {
            id: 'exp-to-delete',
            date: '2026-10-15',
            description: 'Item a Excluir',
            amount: 30.0,
            createdAt: '2026-10-15T10:00:00Z',
            updatedAt: '2026-10-15T10:00:00Z',
          },
        ],
      })

      render(<DayEventsModal />)

      const deleteBtn = screen.getByRole('button', {
        name: /Excluir gasto Item a Excluir/i,
      })
      fireEvent.click(deleteBtn)

      const updatedExpenses = useScheduleStore.getState().expenses
      expect(updatedExpenses).toHaveLength(0)
    })
  })
})
