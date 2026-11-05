import { PurchaseForm } from './purchase-form'
import { useScheduleStore } from '../../store/use-schedule-store'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta: Meta<typeof PurchaseForm> = {
  title: 'Purchases/PurchaseForm',
  component: PurchaseForm,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    onClose: () => {},
  },
}

export default meta
type Story = StoryObj<typeof PurchaseForm>

export const NewPurchase: Story = {
  render: (args) => {
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
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })
    return <PurchaseForm {...args} />
  },
}

export const EditExistingPurchase: Story = {
  render: (args) => {
    const existing = {
      id: 'exp-1',
      date: '2026-11-05',
      description: 'Farmácia Central',
      amount: 145,
      category: 'MEDICATION' as const,
      personId: 'p-1',
      personName: 'Ana Paula',
      items: [
        {
          id: 'line-1',
          itemId: 'item-1',
          itemName: 'Fralda Geriátrica G',
          quantity: 2,
          amount: 130,
        },
      ],
      createdAt: '2026-11-05T10:00:00.000Z',
      updatedAt: '2026-11-05T10:00:00.000Z',
    }
    useScheduleStore.setState({
      expenses: [existing],
    })
    return <PurchaseForm {...args} expense={existing} />
  },
}

