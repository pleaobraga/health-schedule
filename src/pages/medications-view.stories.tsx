import { MemoryRouter } from 'react-router-dom'

import { MedicationsView } from './medications-view'
import { useScheduleStore } from '../store/use-schedule-store'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta: Meta<typeof MedicationsView> = {
  title: 'Pages/MedicationsView',
  component: MedicationsView,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="min-h-screen flex bg-slate-100 dark:bg-slate-950">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof MedicationsView>

export const Empty: Story = {
  render: () => {
    useScheduleStore.setState({ medicationVersions: [] })
    return <MedicationsView />
  },
}

export const WithVersions: Story = {
  render: () => {
    useScheduleStore.setState({
      medicationVersions: [
        {
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
              specialty: 'Psiquiatra',
            },
            {
              id: 'med_vitd',
              name: 'Vitamina D',
              dosage: '50.000 UI',
              source: 'Drogaria Central',
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
        },
        {
          id: 'medver_2',
          effectiveDate: '2026-03-13',
          professional: 'Dr. Carlos',
          explanation: 'Ajuste de dose matinal e inclusão de Melatonina à noite',
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
              dosage: '50.000 UI',
              source: 'Drogaria Central',
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
        },
      ],
    })
    return <MedicationsView />
  },
}
