'use client';

import { useState, useEffect } from 'react';
import { Background } from '@/components/layout/Background';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BridgeCard } from '@/components/bridge/BridgeCard';
import { ConvertCard } from '@/components/bridge/ConvertCard';
import { PendingTransactionsModal } from '@/components/bridge/PendingTransactions';

export default function Home() {
  // Prevent hydration mismatch: wallet-dependent components (BridgeCard,
  // ConvertCard, Header wallet buttons) read wallet/balance state that
  // differs between server (no wallet) and client (wallet auto-connected).
  // Defer rendering until after hydration completes.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      <Background />
      <div style={{ position: 'relative', zIndex: 2, minHeight: '100vh' }}>
        <Header />

        <main style={{ maxWidth: 520, margin: '0 auto', padding: '0 24px 48px' }}>
          {/* Headline */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: '#ffc547' }}>
              The POKT Multichain Bridge
            </h1>
          </div>

          {mounted ? (
            <>
              <BridgeCard />
              <ConvertCard />
            </>
          ) : (
            /* Server/initial render placeholder matching card dimensions */
            <div
              style={{
                background: 'linear-gradient(180deg, #232a2f 0%, #1e2428 100%)',
                borderRadius: 24,
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 80px rgba(2,90,242,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
                overflow: 'hidden',
                minHeight: 500,
              }}
            >
              {/* Skeleton tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ flex: 1, padding: '18px 24px', textAlign: 'center', color: '#f6f6f6', fontSize: 15, fontWeight: 500, position: 'relative' }}>
                  EVM
                  <div style={{ position: 'absolute', bottom: -1, left: 24, right: 24, height: 2, background: '#4c9bf5', borderRadius: '2px 2px 0 0' }} />
                </div>
                <div style={{ flex: 1, padding: '18px 24px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: 500 }}>
                  Solana
                </div>
              </div>
              {/* Loading indicator */}
              <div style={{ padding: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <div
                  className="animate-spin-slow"
                  style={{
                    width: 32,
                    height: 32,
                    border: '3px solid rgba(255,255,255,0.1)',
                    borderTopColor: '#025af2',
                    borderRadius: '50%',
                  }}
                />
              </div>
            </div>
          )}
          <Footer />
        </main>
      </div>

      {/* Modal rendered at page level */}
      {mounted && <PendingTransactionsModal />}
    </>
  );
}
