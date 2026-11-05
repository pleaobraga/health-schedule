import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MedicationsView } from './medications-view'
import { i18n } from '../i18n'
import { useScheduleStore } from '../store/use-schedule-store'

import type { MedicationScheduleVersion } from '../types'

const version1: MedicationScheduleVersion = {
  id: 'medver_1',
  effectiveDate: '2026-03-01',
  professional: 'Dra. Marina',
  explanation: 'Início do tratamento',
  medications: [
    {
      id: 'med_lamo',
      name: 'Lamotrigina',
      dosage: '100 mg',
      source: 'Farmácia Popular',
      responsible: 'Dra. Marina',
    },
    {
      id: 'med_vitd',
      name: 'Vitamina D',
      source: ' Drogaria Central ',
    },
  ],
  times: ['08:00', '20:00'],
  doses: {
    med_lamo: {
      '08:00': '1 comprimido',
      '20:00': '1 comprimido',
    },
    med_vitd: {
      '08:00': '2 gotas',
    },
  },
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
}

const version2: MedicationScheduleVersion = {
  id: 'medver_2',
  effectiveDate: '2026-03-13',
  professional: 'Dr. Carlos',
  explanation: 'Ajuste da dose matinal e inclusão de melatonina',
  medications: [
    {
      id: 'med_lamo',
      name: 'Lamotrigina',
      dosage: '100 mg',
      source: 'Farmácia Popular',
      responsible: 'Dra. Marina',
    },
    {
      id: 'med_vitd',
      name: 'Vitamina D',
    },
    {
      id: 'med_mela',
      name: 'Melatonina',
      dosage: '3 mg',
      source: 'Manipulação',
      responsible: 'Dr. Carlos',
    },
  ],
  times: ['08:00', '20:00', '22:00'],
  doses: {
    med_lamo: {
      '08:00': '1.5 comprimidos',
      '20:00': '1 comprimido',
    },
    med_vitd: {
      '08:00': '2 gotas',
    },
    med_mela: {
      '22:00': '1 cápsula',
    },
  },
  createdAt: '2026-03-13T10:00:00.000Z',
  updatedAt: '2026-03-13T10:00:00.000Z',
}

describe('MedicationsView', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('pt-BR')
    useScheduleStore.setState({ medicationVersions: [] })
  })

  it('opens without error when there are no versions and offers to create the first one', () => {
    render(<MedicationsView />)

    expect(screen.getByTestId('medications-view')).toBeInTheDocument()
    expect(screen.getByTestId('medications-empty-state')).toBeInTheDocument()
    expect(
      screen.getByTestId('medications-create-first-button'),
    ).toBeInTheDocument()
  })

  it('opens on the current version with medications, dosages, times and free-text doses', () => {
    useScheduleStore.setState({ medicationVersions: [version1, version2] })

    render(<MedicationsView />)

    const table = screen.getByTestId('medications-schedule-table')
    expect(within(table).getByText('Lamotrigina')).toBeInTheDocument()
    expect(within(table).getByText('100 mg')).toBeInTheDocument()
    expect(within(table).queryByText('Dra. Marina')).not.toBeInTheDocument()
    expect(within(table).getByText('Vitamina D')).toBeInTheDocument()
    expect(within(table).getByText('Melatonina')).toBeInTheDocument()
    expect(within(table).getByText('3 mg')).toBeInTheDocument()
    expect(within(table).queryByText('Dr. Carlos')).not.toBeInTheDocument()
    expect(within(table).getByText('08:00')).toBeInTheDocument()
    expect(within(table).getByText('20:00')).toBeInTheDocument()
    expect(within(table).getByText('22:00')).toBeInTheDocument()
    expect(within(table).getByText('1.5 comprimidos')).toBeInTheDocument()
    expect(within(table).getByText('2 gotas')).toBeInTheDocument()
    expect(within(table).getByText('1 cápsula')).toBeInTheDocument()

    // Vitamin D has no dosage or specialty on version2
    const vitdHeader = screen.getByTestId('medication-col-header-med_vitd')
    expect(within(vitdHeader).getByText('Vitamina D')).toBeInTheDocument()
    expect(
      within(vitdHeader).queryByTestId('medication-col-dosage-med_vitd'),
    ).not.toBeInTheDocument()
    expect(
      within(vitdHeader).queryByTestId('medication-col-specialty-med_vitd'),
    ).not.toBeInTheDocument()
  })

  it('lists versions from newest to oldest with date, professional, explanation and change summaries', () => {
    useScheduleStore.setState({ medicationVersions: [version1, version2] })

    render(<MedicationsView />)

    const historyItems = screen.getAllByTestId(/^medication-history-item-/)
    expect(historyItems).toHaveLength(2)
    expect(historyItems[0]).toHaveAttribute(
      'data-testid',
      'medication-history-item-medver_2',
    )
    expect(historyItems[1]).toHaveAttribute(
      'data-testid',
      'medication-history-item-medver_1',
    )

    expect(within(historyItems[0]).getByText(/Dr\. Carlos/)).toBeInTheDocument()
    expect(
      within(historyItems[0]).getByText(
        /Ajuste da dose matinal e inclusão de melatonina/,
      ),
    ).toBeInTheDocument()
    expect(
      within(historyItems[0]).getByText(/Medicamento incluído: Melatonina/),
    ).toBeInTheDocument()

    expect(within(historyItems[1]).getByText(/Dra\. Marina/)).toBeInTheDocument()
    expect(
      within(historyItems[1]).getByText(/Início do tratamento/),
    ).toBeInTheDocument()
  })

  it('displays a selected older version, offers a direct way back to current, and does not mutate medicationVersions', () => {
    const initialVersions = structuredClone([version1, version2])
    useScheduleStore.setState({ medicationVersions: initialVersions })

    render(<MedicationsView />)

    fireEvent.click(screen.getByTestId('medication-select-version-medver_1'))

    const table = screen.getByTestId('medications-schedule-table')
    expect(within(table).queryByText('Melatonina')).not.toBeInTheDocument()
    expect(
      within(table).queryByText('1.5 comprimidos'),
    ).not.toBeInTheDocument()
    expect(within(table).getAllByText('1 comprimido')).toHaveLength(2)

    // Source grouping follows the displayed version (version1 has Drogaria Central, no Manipulação)
    const sourceSection = screen.getByTestId('medications-by-source')
    expect(
      within(sourceSection).getByText('Drogaria Central'),
    ).toBeInTheDocument()
    expect(
      within(sourceSection).queryByText('Manipulação'),
    ).not.toBeInTheDocument()

    // Direct path back to current version
    const backBtn = screen.getByTestId('medications-back-to-current')
    fireEvent.click(backBtn)

    expect(
      within(screen.getByTestId('medications-schedule-table')).getByText(
        'Melatonina',
      ),
    ).toBeInTheDocument()
    expect(useScheduleStore.getState().medicationVersions).toEqual(
      initialVersions,
    )
  })

  it('looks up the version active on a queried date, or shows that no schedule existed before the first version', () => {
    useScheduleStore.setState({ medicationVersions: [version1, version2] })

    render(<MedicationsView />)

    const dateInput = screen.getByTestId('medications-lookup-date-input')

    // Date between version1 (2026-03-01) and version2 (2026-03-13) shows version1
    fireEvent.change(dateInput, { target: { value: '2026-03-05' } })
    expect(
      within(screen.getByTestId('medications-schedule-table')).queryByText(
        'Melatonina',
      ),
    ).not.toBeInTheDocument()

    // Date before version1 shows that no schedule existed on that date
    fireEvent.change(dateInput, { target: { value: '2026-02-15' } })
    expect(
      screen.getByTestId('medications-no-version-at-date'),
    ).toBeInTheDocument()

    // Back to current version
    fireEvent.click(screen.getByTestId('medications-back-to-current'))
    expect(
      within(screen.getByTestId('medications-schedule-table')).getByText(
        'Melatonina',
      ),
    ).toBeInTheDocument()
  })

  it('keeps a 10-medication schedule inside its own horizontally scrollable container', () => {
    const tenMedsVersion: MedicationScheduleVersion = {
      ...version1,
      medications: Array.from({ length: 10 }, (_, idx) => ({
        id: `med_${idx + 1}`,
        name: `Medicamento ${idx + 1}`,
        dosage: `${(idx + 1) * 10} mg`,
      })),
    }
    useScheduleStore.setState({ medicationVersions: [tenMedsVersion] })

    render(<MedicationsView />)

    const scrollContainer = screen.getByTestId(
      'medications-table-scroll-container',
    )
    expect(scrollContainer.className).toContain('overflow-x-auto')
    expect(within(scrollContainer).getByText('Medicamento 10')).toBeInTheDocument()
  })

  it('shows the edit and delete actions on the latest version and confirms deletion with ConfirmDialog', async () => {
    useScheduleStore.setState({ medicationVersions: [version1, version2] })

    render(<MedicationsView />)

    // On version2 (current and latest), both edit and delete buttons are present
    expect(screen.getByTestId('medications-edit-version-button')).toBeInTheDocument()
    const deleteBtn = screen.getByTestId('medications-delete-version-button')
    expect(deleteBtn).toBeInTheDocument()

    // Clicking delete opens ConfirmDialog
    fireEvent.click(deleteBtn)
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText(/Excluir versão mais recente\?/i)).toBeInTheDocument()

    // Confirm deletion
    const confirmBtn = screen.getByRole('button', { name: /Sim, excluir versão/i })
    fireEvent.click(confirmBtn)

    // Now only version1 remains and dialog is closed
    await waitFor(() => {
      expect(useScheduleStore.getState().medicationVersions).toEqual([version1])
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  it('hides the delete button when viewing an older version', () => {
    useScheduleStore.setState({ medicationVersions: [version1, version2] })

    render(<MedicationsView />)

    // Select older version1
    fireEvent.click(screen.getByTestId('medication-select-version-medver_1'))

    // Edit is available to correct that historical version, but delete is not
    expect(screen.getByTestId('medications-edit-version-button')).toBeInTheDocument()
    expect(screen.queryByTestId('medications-delete-version-button')).not.toBeInTheDocument()
  })

  it('prints the displayed version with its file name and restores the title', () => {
    let titleDuringPrint = ''
    document.title = 'Original Title'
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {
      titleDuringPrint = document.title
    })

    useScheduleStore.setState({ medicationVersions: [version1, version2] })
    render(<MedicationsView />)

    fireEvent.click(screen.getByTestId('medications-print-button'))

    expect(printSpy).toHaveBeenCalled()
    expect(titleDuringPrint).toBe('medicamentos-13-03-2026')
    expect(document.title).toBe('Original Title')
    printSpy.mockRestore()
  })

  it('prints an older version with its own file name and changes when viewing historical version', () => {
    let titleDuringPrint = ''
    document.title = 'Original Title'
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {
      titleDuringPrint = document.title
    })

    useScheduleStore.setState({ medicationVersions: [version1, version2] })
    render(<MedicationsView />)

    // Select older version1 (2026-03-01)
    fireEvent.click(screen.getByTestId('medication-select-version-medver_1'))

    fireEvent.click(screen.getByTestId('medications-print-button'))

    expect(titleDuringPrint).toBe('medicamentos-01-03-2026')
    expect(document.title).toBe('Original Title')

    const printSheet = screen.getByTestId('medication-print-sheet')
    expect(printSheet).toBeInTheDocument()

    // Table in print sheet does not contain Melatonina (introduced in version2)
    const printTable = within(printSheet).getByTestId('medication-print-table')
    expect(within(printTable).queryByText('Melatonina')).not.toBeInTheDocument()

    // Changes section starts at version1 and does not include version2
    const changesSection = within(printSheet).getByTestId('medication-print-changes')
    expect(within(changesSection).queryByText(/Melatonina/)).not.toBeInTheDocument()
    expect(within(changesSection).getByText(/Primeira versão cadastrada/)).toBeInTheDocument()

    printSpy.mockRestore()
  })

  it('structures the print sheet with title, date and table without version professional on page 1, and page break before changes', () => {
    useScheduleStore.setState({ medicationVersions: [version1, version2] })
    render(<MedicationsView />)

    const printSheet = screen.getByTestId('medication-print-sheet')
    expect(printSheet).toHaveClass('hidden')
    expect(printSheet).toHaveClass('print:block')

    const page1 = within(printSheet).getByTestId('medication-print-page-1')
    expect(within(page1).getByText('Quadro de Horários de Medicamentos')).toBeInTheDocument()
    expect(within(page1).getByText(/Vigência a partir de 13\/03\/2026/)).toBeInTheDocument()
    // Does not include prescribing professional of version in page 1 header
    expect(within(page1).queryByText(/Prescrito por Dra. Marina/)).not.toBeInTheDocument()

    // The table shows the specialty, not the name of the responsible doctor
    expect(within(page1).queryByText('Dra. Marina')).not.toBeInTheDocument()

    const page2 = within(printSheet).getByTestId('medication-print-page-2')
    expect(page2).toHaveClass('print-page-break-before')
    const changes = within(page2).getByTestId('medication-print-changes')
    // Shows changes down to first version
    expect(within(changes).getByText(/Melatonina/)).toBeInTheDocument()
    expect(within(changes).getByText(/Primeira versão cadastrada/)).toBeInTheDocument()
  })

  it('does not show print action when there are no versions', () => {
    useScheduleStore.setState({ medicationVersions: [] })
    render(<MedicationsView />)

    expect(screen.queryByTestId('medications-print-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('medication-print-sheet')).not.toBeInTheDocument()
  })

  it('keeps the version status and date lookup in the table card, right below the header', () => {
    useScheduleStore.setState({ medicationVersions: [version1, version2] })

    render(<MedicationsView />)

    const table = screen.getByTestId('medications-schedule-table')
    const card = table.parentElement?.parentElement as HTMLElement

    expect(card).toContainElement(screen.getByTestId('medications-current-badge'))
    expect(card).toContainElement(
      screen.getByTestId('medications-lookup-date-input'),
    )
    expect(
      card.compareDocumentPosition(
        screen.getByTestId('medications-edit-version-button'),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('keeps the date lookup available when no version existed on the queried date', () => {
    useScheduleStore.setState({ medicationVersions: [version1, version2] })

    render(<MedicationsView />)

    fireEvent.change(screen.getByTestId('medications-lookup-date-input'), {
      target: { value: '2026-02-15' },
    })

    expect(
      screen.getByTestId('medications-no-version-at-date'),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('medications-lookup-date-input'),
    ).toBeInTheDocument()
  })

  it('shows the dosage beside the name and only the specialty as a tag, on screen and in print', () => {
    useScheduleStore.setState({
      medicationVersions: [
        {
          ...version1,
          medications: [
            {
              id: 'med_lamo',
              name: 'Lamotrigina',
              dosage: '100 mg',
              source: 'Farmácia Popular',
              responsible: 'Dra. Marina',
              specialty: 'Psiquiatra',
            },
            {
              id: 'med_vitd',
              name: 'Vitamina D',
              responsible: 'Dr. Carlos',
            },
          ],
        },
      ],
    })

    render(<MedicationsView />)

    const header = screen.getByTestId('medication-col-header-med_lamo')
    const printTable = screen.getByTestId('medication-print-table')

    expect(
      screen.getByTestId('medication-col-dosage-med_lamo').parentElement,
    ).toHaveTextContent('Lamotrigina100 mg')
    expect(
      screen.getByTestId('medication-col-specialty-med_lamo'),
    ).toHaveTextContent('Psiquiatra')
    expect(
      screen.queryByTestId('medication-col-specialty-med_vitd'),
    ).not.toBeInTheDocument()

    for (const table of [header, printTable]) {
      expect(table).toHaveTextContent('Psiquiatra')
      expect(table).not.toHaveTextContent('Dra. Marina')
      expect(table).not.toHaveTextContent('Dr. Carlos')
      expect(table).not.toHaveTextContent('Farmácia Popular')
    }
    expect(screen.getByTestId('medications-by-source')).toHaveTextContent(
      'Farmácia Popular',
    )
  })

  it('lists the additional information in the history and on the printed changes', () => {
    useScheduleStore.setState({
      medicationVersions: [
        {
          ...version1,
          notes: [
            {
              id: 'n1',
              date: '2025-01-10',
              professional: 'Dr. Carlos',
              text: 'Dose reduzida',
            },
            { id: 'n2', text: 'Tomar depois do café' },
          ],
        },
      ],
    })

    render(<MedicationsView />)

    const history = screen.getByTestId('medications-version-history')
    expect(
      within(history).getByText('10/01/2025 • Dr. Carlos • Dose reduzida'),
    ).toBeInTheDocument()
    expect(within(history).getByText('Tomar depois do café')).toBeInTheDocument()
    expect(
      within(screen.getByTestId('medication-print-changes')).getByText(
        'Tomar depois do café',
      ),
    ).toBeInTheDocument()
  })

  it('renders a version with no professional without an empty label', () => {
    useScheduleStore.setState({
      medicationVersions: [{ ...version1, professional: undefined }],
    })

    render(<MedicationsView />)

    expect(screen.queryByText(/Prescrito por/)).not.toBeInTheDocument()
    expect(screen.queryByText('undefined')).not.toBeInTheDocument()
  })

  it('lists on printed page 2 which medications are in each place, before the changes', () => {
    useScheduleStore.setState({
      medicationVersions: [
        {
          ...version1,
          medications: [
            { id: 'a', name: 'Quetiapina', dosage: '200mg', source: 'Posto' },
            { id: 'b', name: 'Prolopa', source: 'Posto' },
            { id: 'c', name: 'Dutam', source: 'Farmácia' },
            { id: 'd', name: 'Vitamina D' },
          ],
        },
      ],
    })

    render(<MedicationsView />)

    const page2 = screen.getByTestId('medication-print-page-2')
    const sources = within(page2).getByTestId('medication-print-sources')
    const [posto, farmacia, withoutSource] = within(sources).getAllByRole('list')

    expect(posto).toHaveTextContent('Quetiapina200mgProlopa')
    expect(farmacia).toHaveTextContent('Dutam')
    expect(withoutSource).toHaveTextContent('Vitamina D')
    expect(
      sources.compareDocumentPosition(
        within(page2).getByTestId('medication-print-changes'),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
