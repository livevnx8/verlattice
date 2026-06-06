import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VNX / BitLattice — Hedera Agent Network',
  description: 'Evidence-native agent swarm on Hedera. Real-time swarm status, evidence registry, proof receipts, and BitLattice decision flows.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="h-screen w-screen overflow-hidden bg-veda-bg text-veda-text antialiased">
        {children}
      </body>
    </html>
  );
}
