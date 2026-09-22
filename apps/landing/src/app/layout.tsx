import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://kawansport.id'),
  title: {
    default: 'KawanSport — main bareng, naik level | Cari Lawan, Booking & Event Olahraga',
    template: '%s | KawanSport',
  },
  description: 'KawanSport — main bareng, naik level. Cari lawan setara ELO, booking lapangan real-time, ikut event & liga, dan belanja gear. Untuk pemain & venue di kawansport.id.',
  keywords: ['olahraga', 'booking lapangan', 'komunitas olahraga', 'marketplace olahraga', 'partner olahraga', 'event olahraga', 'KawanSport'],
  authors: [{ name: 'KawanSport Team' }],
  creator: 'KawanSport',
  publisher: 'KawanSport',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    url: 'https://kawansport.id',
    siteName: 'KawanSport',
    title: 'KawanSport — Komunitas Olahraga & Booking Lapangan Terpercaya',
    description: 'Temukan partner olahraga, booking lapangan mudah, dan beli perlengkapan di marketplace KawanSport.',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'KawanSport - Komunitas Olahraga Indonesia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KawanSport — Komunitas Olahraga & Booking Lapangan',
    description: 'Temukan partner olahraga, booking lapangan mudah, dan beli perlengkapan di marketplace KawanSport.',
    images: ['/og-image.svg'],
    creator: '@kawansport_id',
  },
  verification: {
    google: 'google-site-verification-code',
  },
};

export const viewport: Viewport = {
  themeColor: '#052e1b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}