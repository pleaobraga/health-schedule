import { Calendar } from './calendar'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta: Meta<typeof Calendar> = {
  title: 'UI/Calendar',
  component: Calendar,
}

export default meta
type Story = StoryObj<typeof Calendar>

export const Default: Story = {}
