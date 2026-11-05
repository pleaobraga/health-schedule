import { MedicationVersionForm } from './medication-version-form'

import type { MedicationScheduleVersion } from '../../types'
import type { Meta, StoryObj } from '@storybook/react-vite'

const sampleVersion: MedicationScheduleVersion = {
  id: 'medver_1',
  effectiveDate: '2026-03-01',
  professional: 'Dra. Marina',
  explanation: 'Início do acompanhamento medicamentoso',
  medications: [
    {
      id: 'med_lamo',
      name: 'Lamotrigina',
      dosage: '100 mg',
      source: 'Farmácia Popular',
      responsible: 'Dra. Marina',
    },
    {
      id: 'med_ser',
      name: 'Sertralina',
      dosage: '50 mg',
      source: 'Drogaria Central',
      responsible: 'Dr. Carlos',
    },
  ],
  times: ['08:00', '20:00'],
  doses: {
    med_lamo: {
      '08:00': '1 comprimido',
      '20:00': '1 comprimido',
    },
    med_ser: {
      '08:00': '1 comprimido',
    },
  },
  createdAt: '2026-03-01T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
}

const meta: Meta<typeof MedicationVersionForm> = {
  title: 'Components/Medications/MedicationVersionForm',
  component: MedicationVersionForm,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    onClose: () => {},
  },
}

export default meta
type Story = StoryObj<typeof MedicationVersionForm>

export const NewFirstVersion: Story = {
  args: {
    mode: 'NEW',
  },
}

export const NewFromBase: Story = {
  args: {
    mode: 'NEW',
    baseVersion: sampleVersion,
  },
}

export const CorrectionMode: Story = {
  args: {
    mode: 'CORRECTION',
    version: sampleVersion,
  },
}
