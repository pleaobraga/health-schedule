import { Popover, PopoverContent, PopoverTrigger } from './popover'

import type { Meta, StoryObj } from '@storybook/react-vite'

const meta: Meta<typeof Popover> = {
  title: 'UI/Popover',
  component: Popover,
}

export default meta
type Story = StoryObj<typeof Popover>

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger>Abrir</PopoverTrigger>
      <PopoverContent>Conteúdo</PopoverContent>
    </Popover>
  ),
}
