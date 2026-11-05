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

    // Submit with empty date, professional and explanation
    fireEvent.click(screen.getByTestId('medication-form-submit-button'))

    await waitFor(() => {
      expect(screen.getByTestId('medication-form-errors')).toBeInTheDocument()
      expect(screen.getByTestId('medication-error-DATE_INVALID')).toBeInTheDocument()
      expect(
        screen.getByTestId('medication-error-PROFESSIONAL_REQUIRED'),
      ).toBeInTheDocument()
      expect(
        screen.getByTestId('medication-error-EXPLANATION_REQUIRED'),
      ).toBeInTheDocument()
    })

    expect(
      screen.getByTestId('medication-form-professional-input'),
    ).toHaveAttribute('aria-invalid', 'true')
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
})
