import type { Meta, StoryObj } from '@storybook/react-vite';
import { ElectricBolt, ElectricAtom, CircuitNode, SignalWave, FieldLines } from './icons';
import type { ElectricIconProps, ElectricIconName, ElectricTone } from './icons';

const ICONS = {
  bolt: ElectricBolt,
  atom: ElectricAtom,
  circuit: CircuitNode,
  wave: SignalWave,
  field: FieldLines,
} as const;

const TONES: ElectricTone[] = ['spark', 'violet', 'amber', 'danger', 'ghost'];

/** Thin wrapper so a single Storybook control can switch which icon renders. */
function Demo({ icon = 'bolt', ...props }: ElectricIconProps & { icon?: ElectricIconName }) {
  const Cmp = ICONS[icon];
  return <Cmp {...props} />;
}

const meta = {
  title: 'Electric/Icons',
  component: Demo,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Theme-aware physics/electricity icon family. Every icon reads the app CSS variables, so it recolors with the theme. Props: `size`, `tone`, `glow` (0 = flat, 1 = full neon), `animated`.',
      },
    },
  },
  argTypes: {
    icon: { control: 'select', options: Object.keys(ICONS) },
    size: { control: { type: 'range', min: 16, max: 160, step: 2 } },
    tone: { control: 'select', options: TONES },
    glow: { control: { type: 'range', min: 0, max: 1.5, step: 0.05 } },
    animated: { control: 'boolean' },
  },
  args: { icon: 'bolt', size: 96, tone: 'spark', glow: 1, animated: true },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Tweak any prop live from the controls panel. */
export const Playground: Story = {};

/** The full set at a glance. */
export const Family: Story = {
  args: { tone: 'spark', glow: 1, animated: true },
  render: (args) => (
    <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      {Object.entries(ICONS).map(([name, Cmp]) => (
        <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <Cmp size={72} tone={args.tone} glow={args.glow} animated={args.animated} />
          <span style={{ fontSize: 12, opacity: 0.7 }}>{name}</span>
        </div>
      ))}
    </div>
  ),
};

/** Every tone. `ghost` (white) is for use on filled/colored backgrounds. */
export const Tones: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
      {TONES.map((t) => (
        <div
          key={t}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            padding: '1.25rem',
            borderRadius: 18,
            background: t === 'ghost' ? 'var(--color-primary)' : 'var(--color-surface)',
            border: '1px solid color-mix(in srgb, var(--color-primary) 18%, transparent)',
          }}
        >
          <ElectricAtom size={56} tone={t} glow={0.9} />
          <span style={{ fontSize: 12, color: t === 'ghost' ? '#fff' : 'var(--color-on-surface-variant)' }}>{t}</span>
        </div>
      ))}
    </div>
  ),
};
