import { ItemHistory } from './item-history'
import { useScheduleStore } from '../../store/use-schedule-store'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta: Meta<typeof ItemHistory> = {
  title: 'Purchases/ItemHistory',
  component: ItemHistory,
  tags: ['autodocs'],
  args: {
    itemId: 'item-1',
  },
}

export default meta
type Story = StoryObj<typeof ItemHistory>

export const WithMultiplePurchases: Story = {
  render: (args) => {
    useScheduleStore.setState({
      expenseItems: [
        {
          id: 'item-1',
          name: 'Fralda Geriátrica G',
          normalizedName: 'fralda geriatrica g',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      expenses: [
        {
          id: 'e-1',
          date: '2026-09-10',
          description: 'Farmácia',
          amount: 85,
          items: [{ id: 'l-1', itemId: 'item-1', itemName: 'Fralda Geriátrica G' }],
          createdAt: '2026-09-10T10:00:00.000Z',
          updatedAt: '2026-09-10T10:00:00.000Z',
        },
        {
          id: 'e-2',
          date: '2026-10-05',
          description: 'Farmácia',
          amount: 90,
          items: [{ id: 'l-2', itemId: 'item-1', itemName: 'Fralda Geriátrica G' }],
          createdAt: '2026-10-05T10:00:00.000Z',
          updatedAt: '2026-10-05T10:00:00.000Z',
        },
      ],
    })
    return (
      <div className="max-w-xl p-4 bg-slate-100 dark:bg-slate-950">
        <ItemHistory {...args} />
      </div>
    )
  },
}

