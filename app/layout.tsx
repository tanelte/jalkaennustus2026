import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
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
  return (
    <html lang="et" className={inter.variable}>
      <body className="font-sans bg-bg-app text-text-body">{children}</body>
    </html>
  );
}
