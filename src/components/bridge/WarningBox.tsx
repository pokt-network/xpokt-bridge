export function WarningBox() {
  return (
    <div
      style={{
        background: 'rgba(255, 197, 71, 0.1)',
        border: '1px solid rgba(255, 197, 71, 0.2)',
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
      }}
    >
      <div style={{ fontSize: 13, color: '#ffc547', marginBottom: 4 }}>
        {'\u26A0\uFE0F'} Solana bridges require manual claiming
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
        After the VAA is available (~15-25 min), you&apos;ll need to sign a transaction
        on the destination chain to receive your tokens.
      </div>
    </div>
  );
}
