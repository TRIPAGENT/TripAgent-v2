/** @type {import('tailwindcss').Config} */
/*
 * Nocturne tokens for Tailwind utilities. The CSS variables in
 * src/styles/nocturne.css are the source of truth; these mirror them.
 *
 * The legacy names (ink, paper, rule, accent…) are kept and remapped onto the
 * dark system so any utility still using them renders correctly: "ink" was the
 * text colour and is now ivory, "paper" was the ground and is now obsidian.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Nocturne
        'ink-0': '#0A0A0B',
        'ink-1': '#111112',
        'ink-2': '#17171A',
        'ink-3': '#202023',
        'ink-4': '#2A2A2E',
        ivory: '#F2EDE4',
        'ivory-2': 'rgba(242, 237, 228, 0.74)',
        'ivory-3': 'rgba(242, 237, 228, 0.56)',
        line: 'rgba(242, 237, 228, 0.10)',
        'line-2': 'rgba(242, 237, 228, 0.18)',
        champagne: '#D8C29A',
        'champagne-2': '#B99B6B',
        paper: '#F4EFE6',
        'paper-2': '#EAE3D7',
        'paper-ink': '#191613',
        'paper-ink-2': '#5E574E',
        'paper-accent': '#8A6A3A',
        sage: '#9CC5AD',
        amber: '#E6B071',
        rose: '#E58C7B',
        // Legacy names, remapped onto the dark system
        ink: '#F2EDE4',
        'ink-deep': '#0A0A0B',
        'ink-warm': '#111112',
        'ink-muted': 'rgba(242, 237, 228, 0.74)',
        'ink-faint': 'rgba(242, 237, 228, 0.56)',
        'paper-alt': '#111112',
        rule: 'rgba(242, 237, 228, 0.12)',
        accent: '#D8C29A',
        'accent-deep': '#B99B6B',
        'accent-wash': 'rgba(216, 194, 154, 0.14)',
        'on-image': '#FFFFFF',
        background: '#0A0A0B',
        surface: '#17171A',
      },
      borderRadius: {
        xs: '8px',
        sm: '12px',
        md: '18px',
        lg: '24px',
        xl: '32px',
      },
      fontFamily: {
        display: ['Fraunces', '"Cormorant Garamond"', 'Georgia', 'serif'],
        serif: ['Fraunces', '"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Jost', '"Work Sans"', '-apple-system', '"Helvetica Neue"', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        eyebrow: '0.14em',
        label: '0.14em',
      },
      boxShadow: {
        dock: '0 18px 48px rgba(0, 0, 0, .55), 0 2px 8px rgba(0, 0, 0, .35)',
        float: '0 18px 48px rgba(0, 0, 0, .55), 0 2px 8px rgba(0, 0, 0, .35)',
        card: '0 10px 30px rgba(0, 0, 0, .35)',
      },
      maxWidth: {
        measure: '62ch',
        lead: '52ch',
        quote: '46ch',
        app: '430px',
      },
    },
  },
  plugins: [],
}
