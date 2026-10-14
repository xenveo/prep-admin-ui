/**
 * PrepPilot admin console — Tailwind preset (v0.1).
 * Colours point at the CSS custom properties in tokens.css, so light/dark
 * switching happens in CSS and utilities stay theme-agnostic.
 * Usage: import tokens.css once globally, then in tailwind.config.js:
 *   presets: [require('./docs/design/preppilot-admin/tokens/tailwind.preset.js')]
 * Only use this if the repo already uses Tailwind; otherwise use tokens.css directly.
 */
const v = (name) => `var(--${name})`;

module.exports = {
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        ink: { DEFAULT: v('ink'), muted: v('ink-muted') },
        line: { DEFAULT: v('line'), input: v('input-line'), neutral: v('neutral-line') },
        primary: { DEFAULT: v('primary'), on: v('on-primary'), text: v('primary-text'), soft: v('primary-soft'), tint: v('primary-tint') },
        improve: { DEFAULT: v('improve'), text: v('improve-text'), soft: v('improve-soft') },
        ai: { text: v('ai-text') },
        error: { DEFAULT: v('error'), on: v('on-error') },
        neutral: { soft: v('neutral-soft'), text: v('neutral-text') },
        'row-hover': v('row-hover'),
        band: {
          ready: v('band-ready'), 'ready-tint': v('band-ready-tint'), 'ready-on': v('band-ready-on'),
          nearly: v('band-nearly'), 'nearly-tint': v('band-nearly-tint'), 'nearly-on': v('band-nearly-on'),
          developing: v('band-developing'), 'developing-tint': v('band-developing-tint'), 'developing-on': v('band-developing-on'),
          'not-ready': v('band-not-ready'), 'not-ready-tint': v('band-not-ready-tint'), 'not-ready-on': v('band-not-ready-on'),
        },
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'] },
      fontSize: {
        title: ['20px', { lineHeight: '28px', fontWeight: '600' }],
        section: ['16px', { lineHeight: '24px', fontWeight: '600' }],
        body: ['14px', { lineHeight: '22px' }],
        cell: ['14px', { lineHeight: '20px' }],
        small: ['13px', { lineHeight: '20px' }],
        meta: ['12px', { lineHeight: '16px' }],
      },
      spacing: { sidebar: '240px', 'sidebar-collapsed': '64px', panel: '560px', modal: '640px', row: '44px', 'row-2': '52px', control: '36px', 'control-sm': '32px' },
      borderRadius: { DEFAULT: '8px', sm: '6px', chip: '999px', card: '12px' },
      boxShadow: { panel: v('shadow-panel'), menu: v('shadow-menu'), none: 'none' },
      backgroundColor: { 'scrim-panel': v('scrim-panel'), 'scrim-modal': v('scrim-modal') },
    },
  },
};
