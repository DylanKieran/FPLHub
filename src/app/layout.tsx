import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FPL Analytics Hub — Fantasy Premier League Data Analysis',
  description: 'Advanced data analytics, transfer recommendations, captain picks, and chip strategy for Fantasy Premier League managers.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-64 min-w-0">
            <div className="max-w-content mx-auto p-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
