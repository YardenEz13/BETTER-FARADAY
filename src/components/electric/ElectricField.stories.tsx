import type { Meta, StoryObj } from '@storybook/react-vite';
import { ElectricField } from './ElectricField';

const meta = {
  title: 'Electric/ElectricField',
  component: ElectricField,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Animated circuit-field backdrop for hero sections and dashboard headers. Absolutely positioned (inset: 0) — drop it into a `position: relative` container behind your content. Honors prefers-reduced-motion.',
      },
    },
  },
  argTypes: {
    intensity: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
    density: { control: 'inline-radio', options: ['sparse', 'normal', 'dense'] },
  },
  args: { intensity: 0.6, density: 'normal' },
  decorators: [
    (Story) => (
      <div
        style={{
          position: 'relative',
          height: 280,
          borderRadius: 24,
          overflow: 'hidden',
          background: 'var(--color-surface)',
          border: '1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)',
        }}
      >
        <Story />
        <div style={{ position: 'relative', padding: '2.5rem' }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: 0 }}>מפת הלמידה שלי</h1>
          <p style={{ opacity: 0.75, marginTop: 8 }}>Circuit-field backdrop behind real content.</p>
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof ElectricField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dense: Story = { args: { density: 'dense', intensity: 0.85 } };
export const Sparse: Story = { args: { density: 'sparse', intensity: 0.4 } };
