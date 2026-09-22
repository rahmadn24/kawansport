import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KawanSport CMS',
  description: 'CMS admin / venue owner / seller KawanSport',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
