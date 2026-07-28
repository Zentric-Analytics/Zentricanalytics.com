import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--za-color-text)',
        brand: 'var(--za-color-navy)',
        accent: 'var(--za-color-teal)',
        'brand-hover': 'var(--za-color-navy-hover)',
        mint: 'var(--za-color-mint)',
        canvas: 'var(--za-color-page)',
        surface: 'var(--za-color-card)',
        'surface-alt': 'var(--za-color-section-alt)',
        'za-border': 'var(--za-color-border)',
        'text-secondary': 'var(--za-color-text-secondary)',
        'text-muted': 'var(--za-color-text-muted)',
      },
      boxShadow: {
        button: 'var(--za-shadow-button)',
        card: 'var(--za-shadow-card)',
        elevated: 'var(--za-shadow-elevated)',
        workspace: 'var(--za-shadow-workspace)',
      },
      borderRadius: {
        button: 'var(--za-radius-button)',
        card: 'var(--za-radius-card)',
        panel: 'var(--za-radius-panel)',
      },
    },
  },
  plugins: [],
};
export default config;
