import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'AXIOM Dashboard — Local-First AI Agent Monitor',
  description:
    'A local-first AI agent monitoring system built with PowerSync, Supabase, and Mastra. ' +
    'Real-time agent status, P&L tracking, and task coordination — synced to local SQLite for instant reads.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-axiom-bg text-axiom-text font-sans antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
