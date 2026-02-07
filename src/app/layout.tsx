import type { Metadata } from 'next';
import { Rubik } from 'next/font/google';
import { WalletProviders } from '@/components/wallet/WalletProviders';
import './globals.css';

const rubik = Rubik({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'POKT Multichain Bridge',
  description: 'Bridge POKT tokens between Ethereum, Base, and Solana',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={rubik.className} suppressHydrationWarning>
        <WalletProviders>
          {children}
        </WalletProviders>
      </body>
    </html>
  );
}
