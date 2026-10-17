import type { Metadata, Viewport } from 'next';
import { GeistMono } from 'geist/font/mono';
import { Manrope } from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
  fallback: ['Manrope Fallback', 'Arial', 'sans-serif'],
});

export const metadata: Metadata = {
  title: {
    default: 'resaikel — turn waste into worth',
    template: '%s · resaikel',
  },
  description:
    'resaikel transforms leftover materials into manufacturable products and real business ' +
    'opportunities through AI-powered material, production and market intelligence.',
  applicationName: 'resaikel',
};

export const viewport: Viewport = {
  themeColor: '#fcf9f3',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh bg-canvas text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-ink-inverse"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
