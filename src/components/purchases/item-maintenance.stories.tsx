import { ItemMaintenance } from './item-maintenance'
import { useScheduleStore } from '../../store/use-schedule-store'

import type { Meta, StoryObj } from '@storybook/react-vite'

const sampleItem = {
  id: 'item-a',
  name: 'Fralda G',
  normalizedName: 'fralda g',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const meta: Meta<typeof ItemMaintenance> = {
  title: 'Purchases/ItemMaintenance',
  component: ItemMaintenance,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    item: sampleItem,
    onClose: () => {},
  },
}

export default meta
type Story = StoryObj<typeof ItemMaintenance>

export const Default: Story = {
  render: (args) => {
    useScheduleStore.setState({
      expenseItems: [
        sampleItem,
        {
          id: 'item-b',
          name: 'Fralda Geriátrica G',
          normalizedName: 'fralda geriatrica g',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    })
    return <ItemMaintenance {...args} />
  },
}

