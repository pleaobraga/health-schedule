import { MemoryRouter } from 'react-router-dom'

import { PurchasesView } from './purchases-view'
import { useScheduleStore } from '../store/use-schedule-store'
import { getCurrentMonth } from '../utils/date-utils'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta: Meta<typeof PurchasesView> = {
  title: 'Pages/PurchasesView',
  component: PurchasesView,
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
type Story = StoryObj<typeof PurchasesView>

export const WithPurchases: Story = {
  render: () => {
    const month = getCurrentMonth()
    useScheduleStore.setState({
      persons: [
        { id: 'p-1', name: 'Ana Paula', color: '#3B82F6', active: true },
        { id: 'p-2', name: 'Beatriz Silva', color: '#10B981', active: true },
      ],
      expenseItems: [
        {
          id: 'item-1',
          name: 'Fralda Geriátrica G',
          normalizedName: 'fralda geriatrica g',
          createdAt: '2026-01-01T10:00:00.000Z',
          updatedAt: '2026-01-01T10:00:00.000Z',
        },
        {
          id: 'item-2',
          name: 'Pomada Assadura',
          normalizedName: 'pomada assadura',
          createdAt: '2026-01-01T10:00:00.000Z',
          updatedAt: '2026-01-01T10:00:00.000Z',
        },
      ],
      expenses: [
        {
          id: 'exp-1',
          date: `${month}-12`,
          description: 'Drogasil - Reposição Quinzenal',
          amount: 185.9,
          category: 'MEDICATION',
          personId: 'p-1',
          personName: 'Ana Paula',
          items: [
            {
              id: 'l-1',
              itemId: 'item-1',
              itemName: 'Fralda Geriátrica G',
              quantity: 2,
              amount: 140,
            },
            {
              id: 'l-2',
              itemId: 'item-2',
              itemName: 'Pomada Assadura',
              quantity: 1,
              amount: 35.9,
            },
          ],
          createdAt: '2026-10-12T10:00:00.000Z',
          updatedAt: '2026-10-12T10:00:00.000Z',
        },
        {
          id: 'exp-2',
          date: `${month}-05`,
          description: 'Táxi Retorno Exame',
          amount: 48,
          category: 'TRANSPORT',
          items: [],
          createdAt: '2026-10-05T14:00:00.000Z',
          updatedAt: '2026-10-05T14:00:00.000Z',
        },
      ],
    })
    return <PurchasesView />
  },
}

export const EmptyState: Story = {
  render: () => {
    useScheduleStore.setState({
      expenses: [],
      expenseItems: [],
    })
    return <PurchasesView />
  },
}

