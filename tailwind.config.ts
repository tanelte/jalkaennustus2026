import type { Config } from 'tailwindcss';

/**
 * Tailwind theme mirrors the semantic CSS variables defined in
 * `app/globals.css` under `@layer base { :root { … } }`.
 * Single source of truth = CSS variables. Tailwind classes resolve to those.
 * See: specs/design/ux-design-specification.md §13.
 *
 * Two parallel token blocks coexist:
 *   1) UX §13 semantic tokens — used by app code (`bg-bg-app`, `text-text-body`, …).
 *   2) shadcn/ui HSL tokens — used by primitives under `components/ui/`.
 *
 * They do not collide. Dark theme is intentionally NOT delivered in this story;
 * shadcn's `darkMode` knob is left at its default and no `.dark` block is shipped.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // -------------------------- UX §13.1 — semantic tokens
        // surfaces & text
        'bg-app': 'var(--bg-app)',
        'surface-card': 'var(--surface-card)',
        'surface-card-dark': 'var(--surface-card-dark)',
        'border-default': 'var(--border-default)',
        'border-strong': 'var(--border-strong)',
        'text-primary': 'var(--text-primary)',
        'text-body': 'var(--text-body)',
        'text-muted': 'var(--text-muted)',
        'text-on-dark': 'var(--text-on-dark)',
        'text-on-dark-muted': 'var(--text-on-dark-muted)',
        // brand
        'brand-green': 'var(--brand-green)',
        'brand-green-hover': 'var(--brand-green-hover)',
        'brand-green-soft': 'var(--brand-green-soft)',
        // state pills (bg/text pairs)
        'state-open-bg': 'var(--state-open-bg)',
        'state-open-text': 'var(--state-open-text)',
        'state-closed-bg': 'var(--state-closed-bg)',
        'state-closed-text': 'var(--state-closed-text)',
        'state-upcoming-bg': 'var(--state-upcoming-bg)',
        'state-upcoming-text': 'var(--state-upcoming-text)',
        'state-error-bg': 'var(--state-error-bg)',
        'state-error-text': 'var(--state-error-text)',

        // -------------------------- shadcn/ui primitives (new-york, neutral)
        // Stock primitives consume these via Tailwind classes (`bg-background`,
        // `border-border`, etc.). They live behind their own token names so
        // they do not collide with UX §13.
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        // §13.2 — Inter loaded via next/font in app/layout.tsx (variable: --font-inter)
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // §13.4 — '2xl' is the only addition Tailwind doesn't ship by default at this value.
        // shadcn primitives reference `--radius` for their `lg`/`md`/`sm` rounding.
        '2xl': '1rem',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        // §13.5 — the dark "Sinu seis" card
        'card-dark':
          '0 1px 2px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
