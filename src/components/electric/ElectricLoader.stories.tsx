import type { Meta, StoryObj } from '@storybook/react-vite';
import { ElectricLoader } from './ElectricLoader';

const meta = {
  title: 'Electric/ElectricLoader',
  component: ElectricLoader,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'On-theme loading indicator: a slowly rotating electric atom (its electron orbits) over an optional label. Drop-in replacement for the generic border-spinner used across the app.',
      },
    },
  },
  argTypes: {
    size: { control: { type: 'range', min: 24, max: 120, step: 4 } },
    tone: { control: 'select', options: ['spark', 'violet', 'amber', 'danger'] },
    fullscreen: { control: 'boolean' },
  },
  // fullscreen=false here so the spinner doesn't force min-h-screen inside the story canvas
  args: { size: 56, label: 'טוען…', tone: 'spark', fullscreen: false },
} satisfies Meta<typeof ElectricLoader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithDataLabel: Story = { args: { label: 'טוען נתוני כיתה...' } };
export const NoLabel: Story = { args: { label: undefined } };
