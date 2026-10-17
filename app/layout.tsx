import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BloomWell',
  description: 'A premium women’s health, cycle tracking, and nutrition companion.',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
