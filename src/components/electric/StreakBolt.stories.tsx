import type { Meta, StoryObj } from '@storybook/react-vite';
import { StreakBolt } from './StreakBolt';

const meta = {
  title: 'Electric/StreakBolt',
  component: StreakBolt,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "The streak stat's icon: a lightning bolt that charges from the tail up as the streak grows, with a spark racing down it and a strike-flicker halo. `atRisk` flickers harder.",
      },
    },
  },
  argTypes: {
    days: { control: { type: 'range', min: 0, max: 10, step: 1 } },
    size: { control: { type: 'range', min: 12, max: 128, step: 2 } },
    atRisk: { control: 'boolean' },
  },
  args: { days: 4, size: 64, atRisk: false },
} satisfies Meta<typeof StreakBolt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const AtRisk: Story = { args: { days: 3, atRisk: true } };

/** The whole charge ramp, 0 → 7+ days. */
export const ChargeRamp: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 9].map((d) => (
        <div key={d} style={{ textAlign: 'center' }}>
          <StreakBolt days={d} size={56} title={`${d} ימים`} />
          <div style={{ fontSize: 12, fontWeight: 700 }}>{d}</div>
        </div>
      ))}
    </div>
  ),
};
