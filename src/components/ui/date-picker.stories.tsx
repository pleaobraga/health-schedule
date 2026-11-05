import { useState } from 'react'

import { DatePicker } from './date-picker'

import type { Meta, StoryObj } from '@storybook/react-vite'

function DatePickerDemo({ initial = '', invalid = false }) {
  const [value, setValue] = useState(initial)
  return (
    <div className="w-64">
      <DatePicker value={value} onChange={setValue} invalid={invalid} />
    </div>
  )
}

const meta: Meta<typeof DatePickerDemo> = {
  title: 'UI/DatePicker',
  component: DatePickerDemo,
}

export default meta
type Story = StoryObj<typeof DatePickerDemo>

export const Empty: Story = {}

export const WithValue: Story = { args: { initial: '2026-11-05' } }

export const Invalid: Story = { args: { invalid: true } }
