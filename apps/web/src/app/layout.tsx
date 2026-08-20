import type { Metadata, Viewport } from 'next';
import { Instrument_Sans, JetBrains_Mono, Newsreader } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

const sans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const serif = Newsreader({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Advani Family Office — Internal Dashboard',
  description:
    'Back-office dashboard for the Advani Family Office portfolio: investments, ' +
    'assets, transactions, distributions and compliance filings.',
  // Internal tooling should never end up in an index.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sans.variable} ${serif.variable} ${mono.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AuthProvider>{children}</AuthProvider>
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
