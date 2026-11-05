import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MedicationVersionForm } from './medication-version-form'
import { i18n } from '../../i18n'
import { useScheduleStore } from '../../store/use-schedule-store'

import type { MedicationScheduleVersion } from '../../types'

const baseVersion: MedicationScheduleVersion = {
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
  ],
  times: ['08:00', '20:00'],
  doses: {
    med_lamo: {
      '08:00': '1 comprimido',
      '20:00': '1 comprimido',
    },
  },
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
}

describe('MedicationVersionForm', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('pt-BR')
    useScheduleStore.setState({ medicationVersions: [baseVersion] })
  })

  it('in NEW mode with a baseVersion, starts with table contents copied and empty date, professional and explanation', () => {
    render(
      <MedicationVersionForm
        mode="NEW"
        baseVersion={baseVersion}
        onClose={vi.fn()}
      />,
    )

    expect(
      screen.getByTestId('medication-form-effective-date-input'),
    ).toHaveValue('')
    expect(
      screen.getByTestId('medication-form-professional-input'),
    ).toHaveValue('')
    expect(
      screen.getByTestId('medication-form-explanation-input'),
    ).toHaveValue('')

    // Table copied from baseVersion
    expect(screen.getByTestId('medication-name-input-0')).toHaveValue(
      'Lamotrigina',
    )
    expect(screen.getByTestId('medication-dosage-input-0')).toHaveValue('100 mg')
    expect(screen.getByTestId('medication-time-input-0')).toHaveValue('08:00')
    expect(screen.getByTestId('medication-time-input-1')).toHaveValue('20:00')
    expect(
      screen.getByTestId('medication-dose-input-med_lamo-08:00'),
    ).toHaveValue('1 comprimido')
  })

  it('in NEW mode without baseVersion, starts with an empty table', () => {
    render(<MedicationVersionForm mode="NEW" onClose={vi.fn()} />)

    expect(screen.queryByTestId('medication-name-input-0')).not.toBeInTheDocument()
    expect(screen.queryByTestId('medication-time-input-0')).not.toBeInTheDocument()
  })

  it('saving creates a new version with preserved medication ids without mutating baseVersion or store on editing', async () => {
    const initialStoreVersions = structuredClone(
      useScheduleStore.getState().medicationVersions,
    )
    const onClose = vi.fn()

    render(
      <MedicationVersionForm
        mode="NEW"
        baseVersion={baseVersion}
        onClose={onClose}
      />,
    )

    // Edit fields in draft
    fireEvent.change(screen.getByTestId('medication-form-effective-date-input'), {
      target: { value: '2026-03-10' },
    })
    fireEvent.change(screen.getByTestId('medication-form-professional-input'), {
      target: { value: 'Dr. Carlos' },
    })
    fireEvent.change(screen.getByTestId('medication-form-explanation-input'), {
      target: { value: 'Aumento da dose matinal' },
    })
    fireEvent.change(
      screen.getByTestId('medication-dose-input-med_lamo-08:00'),
      { target: { value: '1.5 comprimidos' } },
    )

    // Before submit, store is unmutated
    expect(useScheduleStore.getState().medicationVersions).toEqual(
      initialStoreVersions,
    )

    // Submit
    fireEvent.click(screen.getByTestId('medication-form-submit-button'))

    // After submit, new version created with same medication ID for Lamotrigina
    await waitFor(() => {
      const versions = useScheduleStore.getState().medicationVersions
      expect(versions).toHaveLength(2)
      expect(versions[1].effectiveDate).toBe('2026-03-10')
      expect(versions[1].professional).toBe('Dr. Carlos')
      expect(versions[1].medications[0].id).toBe('med_lamo')
      expect(versions[1].doses.med_lamo?.['08:00']).toBe('1.5 comprimidos')
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('adding a new medication generates a createMedicationId, and removing a medication discards its doses', () => {
    render(
      <MedicationVersionForm
        mode="NEW"
        baseVersion={baseVersion}
        onClose={vi.fn()}
      />,
    )

    // Add new medication
    fireEvent.click(screen.getByTestId('medication-add-column-button'))
    expect(screen.getByTestId('medication-name-input-1')).toBeInTheDocument()
    fireEvent.change(screen.getByTestId('medication-name-input-1'), {
      target: { value: 'Vitamina C' },
    })

    // Remove Lamotrigina
    fireEvent.click(screen.getByTestId('medication-remove-column-0'))
    expect(
      screen.queryByTestId('medication-dose-input-med_lamo-08:00'),
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('medication-name-input-0')).toHaveValue(
      'Vitamina C',
    )
  })

  it('adding and removing times discards doses for that time slot', () => {
    render(
      <MedicationVersionForm
        mode="NEW"
        baseVersion={baseVersion}
        onClose={vi.fn()}
      />,
    )

    // Remove 20:00
    fireEvent.click(screen.getByTestId('medication-remove-time-1'))
    expect(
      screen.queryByTestId('medication-time-input-1'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('medication-dose-input-med_lamo-20:00'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByTestId('medication-dose-input-med_lamo-08:00'),
    ).toBeInTheDocument()
  })

  it('preserves free-text doses like 1.5 comprimidos and 2 gotas without altering them', async () => {
    render(
      <MedicationVersionForm
        mode="NEW"
        baseVersion={baseVersion}
        onClose={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByTestId('medication-form-effective-date-input'), {
      target: { value: '2026-03-05' },
    })
    fireEvent.change(screen.getByTestId('medication-form-professional-input'), {
      target: { value: 'Dra. Marina' },
    })
    fireEvent.change(screen.getByTestId('medication-form-explanation-input'), {
      target: { value: 'Ajuste de doses' },
    })

    fireEvent.change(
      screen.getByTestId('medication-dose-input-med_lamo-08:00'),
      { target: { value: '1.5 comprimidos' } },
    )
    fireEvent.change(
      screen.getByTestId('medication-dose-input-med_lamo-20:00'),
      { target: { value: '2 gotas' } },
    )

    fireEvent.click(screen.getByTestId('medication-form-submit-button'))

    await waitFor(() => {
      const latest = useScheduleStore.getState().medicationVersions[1]
      expect(latest).toBeDefined()
      expect(latest.doses.med_lamo?.['08:00']).toBe('1.5 comprimidos')
      expect(latest.doses.med_lamo?.['20:00']).toBe('2 gotas')
    })
  })

  it('shows translated error banners and marks aria-invalid on missing required fields', async () => {
    render(
      <MedicationVersionForm
        mode="NEW"
        baseVersion={baseVersion}
        onClose={vi.fn()}
      />,
    )

    // Submit with empty date and explanation
    fireEvent.click(screen.getByTestId('medication-form-submit-button'))

    await waitFor(() => {
      expect(screen.getByTestId('medication-form-errors')).toBeInTheDocument()
      expect(screen.getByTestId('medication-error-DATE_INVALID')).toBeInTheDocument()
      expect(
        screen.getByTestId('medication-error-EXPLANATION_REQUIRED'),
      ).toBeInTheDocument()
    })

    expect(
      screen.getByTestId('medication-form-explanation-input'),
    ).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows DATE_BEFORE_LATEST error when date is before the latest version date', async () => {
    render(
      <MedicationVersionForm
        mode="NEW"
        baseVersion={baseVersion}
        onClose={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByTestId('medication-form-effective-date-input'), {
      target: { value: '2026-02-28' },
    })
    fireEvent.change(screen.getByTestId('medication-form-professional-input'), {
      target: { value: 'Dr. Silva' },
    })
    fireEvent.change(screen.getByTestId('medication-form-explanation-input'), {
      target: { value: 'Tentativa retroativa' },
    })

    fireEvent.click(screen.getByTestId('medication-form-submit-button'))

    await waitFor(() => {
      expect(
        screen.getByTestId('medication-error-DATE_BEFORE_LATEST'),
      ).toBeInTheDocument()
    })
  })

  it('suggests previously recorded professionals when typing 3 or more letters and populates on selection', () => {
    render(
      <MedicationVersionForm
        mode="NEW"
        baseVersion={baseVersion}
        onClose={vi.fn()}
      />,
    )

    const profInput = screen.getByTestId('medication-form-professional-input')
    fireEvent.change(profInput, { target: { value: 'Mar' } })

    const suggestion = screen.getByTestId('medication-prof-suggestion-0')
    expect(suggestion).toHaveTextContent('Dra. Marina')

    fireEvent.click(suggestion)
    expect(profInput).toHaveValue('Dra. Marina')
  })

  it('in CORRECTION mode, pre-fills all version values and saves without creating a new version', async () => {
    const onClose = vi.fn()

    render(
      <MedicationVersionForm
        mode="CORRECTION"
        version={baseVersion}
        onClose={onClose}
      />,
    )

    expect(
      screen.getByTestId('medication-form-effective-date-input'),
    ).toHaveValue('2026-03-01')
    expect(
      screen.getByTestId('medication-form-professional-input'),
    ).toHaveValue('Dra. Marina')
    expect(
      screen.getByTestId('medication-form-explanation-input'),
    ).toHaveValue('Início do tratamento')

    // Change explanation
    fireEvent.change(screen.getByTestId('medication-form-explanation-input'), {
      target: { value: 'Início do tratamento com correção de texto' },
    })

    fireEvent.click(screen.getByTestId('medication-form-submit-button'))

    await waitFor(() => {
      const versions = useScheduleStore.getState().medicationVersions
      expect(versions).toHaveLength(1)
      expect(versions[0].explanation).toBe(
        'Início do tratamento com correção de texto',
      )
      expect(onClose).toHaveBeenCalled()
    })
  })

  const openWithVersion = () =>
    render(
      <MedicationVersionForm
        mode="NEW"
        baseVersion={baseVersion}
        onClose={vi.fn()}
      />,
    )

  const fillRequiredAndSubmit = async () => {
    fireEvent.change(
      screen.getByTestId('medication-form-effective-date-input'),
      { target: { value: '2026-03-15' } },
    )
    fireEvent.change(screen.getByTestId('medication-form-explanation-input'), {
      target: { value: 'Ajuste' },
    })
    fireEvent.click(screen.getByTestId('medication-form-submit-button'))
    await waitFor(() =>
      expect(useScheduleStore.getState().medicationVersions.length).toBeGreaterThan(0),
    )
    const { medicationVersions } = useScheduleStore.getState()
    return medicationVersions[medicationVersions.length - 1]
  }

  it('saves a version without a professional', async () => {
    useScheduleStore.setState({ medicationVersions: [] })
    openWithVersion()

    const saved = await fillRequiredAndSubmit()

    expect(saved?.professional).toBeUndefined()
  })

  it('uses the native time field, like day events, and keeps the row until the field loses focus', () => {
    openWithVersion()

    const first = screen.getByTestId('medication-time-input-0')
    expect(first).toHaveAttribute('type', 'time')

    fireEvent.change(first, { target: { value: '22:00' } })
    expect(screen.getByTestId('medication-time-input-0')).toHaveValue('22:00')

    fireEvent.blur(first)
    expect(screen.getByTestId('medication-time-input-0')).toHaveValue('20:00')
    expect(screen.getByTestId('medication-time-input-1')).toHaveValue('22:00')
  })

  it('sorts a newly added time into place and keeps blank rows last', () => {
    openWithVersion()

    fireEvent.click(screen.getByTestId('medication-add-time-button'))
    fireEvent.click(screen.getByTestId('medication-add-time-button'))
    const added = screen.getByTestId('medication-time-input-2')
    fireEvent.change(added, { target: { value: '06:30' } })
    fireEvent.blur(added)

    expect(screen.getByTestId('medication-time-input-0')).toHaveValue('06:30')
    expect(screen.getByTestId('medication-time-input-1')).toHaveValue('08:00')
    expect(screen.getByTestId('medication-time-input-2')).toHaveValue('20:00')
    expect(screen.getByTestId('medication-time-input-3')).toHaveValue('')
  })

  it('keeps the doses of a row when its time changes', async () => {
    useScheduleStore.setState({ medicationVersions: [] })
    openWithVersion()

    const dose = screen.getByTestId<HTMLInputElement>(
      'medication-dose-input-med_lamo-08:00',
    ).value
    const time = screen.getByTestId('medication-time-input-0')
    fireEvent.change(time, { target: { value: '07:15' } })
    fireEvent.blur(time)

    expect(
      screen.getByTestId('medication-dose-input-med_lamo-07:15'),
    ).toHaveValue(dose)

    const saved = await fillRequiredAndSubmit()
    expect(saved?.doses.med_lamo['07:15']).toBe(dose)
    expect(saved?.doses.med_lamo['08:00']).toBeUndefined()
  })

  it('removing one blank time row leaves the other blank row', () => {
    openWithVersion()

    fireEvent.click(screen.getByTestId('medication-add-time-button'))
    fireEvent.click(screen.getByTestId('medication-add-time-button'))
    fireEvent.click(screen.getByTestId('medication-remove-time-3'))

    expect(screen.getByTestId('medication-time-input-2')).toBeInTheDocument()
    expect(
      screen.queryByTestId('medication-time-input-3'),
    ).not.toBeInTheDocument()
  })

  it('adds as many pieces of additional information as needed and saves them', async () => {
    useScheduleStore.setState({ medicationVersions: [] })
    openWithVersion()

    for (let i = 0; i < 3; i += 1) {
      fireEvent.click(screen.getByTestId('medication-add-note-button'))
    }
    fireEvent.change(screen.getByTestId('medication-note-date-input-0'), {
      target: { value: '2025-01-10' },
    })
    fireEvent.change(
      screen.getByTestId('medication-note-professional-input-0'),
      { target: { value: 'Dr. Carlos' } },
    )
    fireEvent.change(screen.getByTestId('medication-note-text-input-0'), {
      target: { value: 'Dose reduzida' },
    })
    fireEvent.change(screen.getByTestId('medication-note-text-input-1'), {
      target: { value: 'Tomar depois do café' },
    })
    fireEvent.click(screen.getByTestId('medication-remove-note-1'))
    fireEvent.change(screen.getByTestId('medication-note-text-input-1'), {
      target: { value: 'Começou em 2024' },
    })

    const saved = await fillRequiredAndSubmit()

    expect(saved?.notes).toEqual([
      expect.objectContaining({
        date: '2025-01-10',
        professional: 'Dr. Carlos',
        text: 'Dose reduzida',
      }),
      expect.objectContaining({ text: 'Começou em 2024' }),
    ])
  })

  it('requires the explanation of a started note and marks it invalid', async () => {
    openWithVersion()

    fireEvent.click(screen.getByTestId('medication-add-note-button'))
    fireEvent.change(
      screen.getByTestId('medication-note-professional-input-0'),
      { target: { value: 'Dr. Carlos' } },
    )
    fireEvent.click(screen.getByTestId('medication-form-submit-button'))

    await waitFor(() =>
      expect(
        screen.getByTestId('medication-error-NOTE_TEXT_REQUIRED'),
      ).toBeInTheDocument(),
    )
    expect(screen.getByTestId('medication-note-text-input-0')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('starts a new version with no notes from the base, and keeps them when correcting', () => {
    const withNotes = {
      ...baseVersion,
      notes: [{ id: 'n1', text: 'Histórico antigo' }],
    }
    const { unmount } = render(
      <MedicationVersionForm
        mode="NEW"
        baseVersion={withNotes}
        onClose={vi.fn()}
      />,
    )
    expect(
      screen.queryByTestId('medication-note-text-input-0'),
    ).not.toBeInTheDocument()
    unmount()

    render(
      <MedicationVersionForm
        mode="CORRECTION"
        version={withNotes}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByTestId('medication-note-text-input-0')).toHaveValue(
      'Histórico antigo',
    )
  })

  it('records the specialty of the responsible doctor', async () => {
    useScheduleStore.setState({ medicationVersions: [] })
    openWithVersion()

    fireEvent.change(screen.getByTestId('medication-specialty-input-0'), {
      target: { value: 'Psiquiatra' },
    })

    const saved = await fillRequiredAndSubmit()
    expect(saved?.medications[0].specialty).toBe('Psiquiatra')
  })
})
