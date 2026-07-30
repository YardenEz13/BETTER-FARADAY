import React, { useEffect } from 'react';
import type { Preview, Decorator } from '@storybook/react-vite';

// Pull in the real app styling so components render exactly as they do in
// production: CSS variables (--color-primary / --color-inverse-primary "spark"),
// the clay/glass surfaces, fonts, and the RTL-aware base.
import '../src/index.css';

/** Mirrors the app's ThemeContext: data-theme on <html> + <body>, dir=rtl. */
function AppThemeFrame({ theme, children }: { theme: string; children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('dir', 'rtl');
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div
      dir="rtl"
      style={{
        background: 'var(--color-background)',
        color: 'var(--color-on-background)',
        padding: '2.5rem',
        minHeight: '100%',
        fontFamily: "'Assistant', system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}

const withAppTheme: Decorator = (Story, context) => (
  <AppThemeFrame theme={(context.globals.theme as string) ?? 'light'}>
    <Story />
  </AppThemeFrame>
);

export const globalTypes = {
  theme: {
    description: 'App color theme',
    defaultValue: 'light',
    toolbar: {
      title: 'Theme',
      icon: 'circlehollow',
      items: [
        { value: 'light', title: 'Light', icon: 'sun' },
        { value: 'dark', title: 'Dark', icon: 'moon' },
      ],
      dynamicTitle: true,
    },
  },
};

const preview: Preview = {
  decorators: [withAppTheme],
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: { test: 'todo' },
  },
};

export default preview;
