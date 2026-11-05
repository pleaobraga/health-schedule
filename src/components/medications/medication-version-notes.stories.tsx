import { MedicationVersionNotes } from './medication-version-notes'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta: Meta<typeof MedicationVersionNotes> = {
  title: 'Medications/MedicationVersionNotes',
  component: MedicationVersionNotes,
}

export default meta
type Story = StoryObj<typeof MedicationVersionNotes>

const notes = [
  {
    id: 'note_1',
    date: '2026-02-10',
    professional: 'Dra. Marina',
    text: 'Dose reduzida após a consulta',
  },
  { id: 'note_2', text: 'Tomar depois do café' },
]

export const Default: Story = { args: { notes } }

export const Printable: Story = { args: { notes, printable: true } }
