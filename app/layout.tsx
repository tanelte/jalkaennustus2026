import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AppFooter } from '@/components/app-footer';
import { BfcacheRefresh } from '@/components/bfcache-refresh';
import './globals.css';

// §13.2 Typography — Inter variable font, Estonian glyph support via latin-ext.
// The variable is exposed as `--font-inter` and consumed by `tailwind.config.ts`
// (`fontFamily.sans`) so `font-sans` (Tailwind default on body) picks it up.
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Jalkaennustus',
  description: 'Jalkaennustus — football prediction game',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // §15.1 / §19.1 — `AppFooter` is global. `AppHeader` is NOT mounted here
  // because login + select-user are unauthenticated; pages keep mounting their
  // own header. The body is a flex column so the footer sits at the viewport
  // bottom even on short pages. Children are not wrapped in <main> to avoid
  // nested <main> elements — each route renders its own <main>.
  return (
    <html lang="et" className={inter.variable}>
      <body className="min-h-screen flex flex-col font-sans bg-bg-app text-text-body">
        <BfcacheRefresh />
        <div className="flex-1">{children}</div>
        <AppFooter />
      </body>
    </html>
  );
}
