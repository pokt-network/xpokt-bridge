export function Footer() {
  return (
    <div style={{
      textAlign: 'center',
      marginTop: 24,
      fontSize: 12,
      color: 'rgba(255,255,255,0.3)',
    }}>
      Powered by{' '}
      <a
        href="https://wormhole.com/"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#025af2', textDecoration: 'none' }}
      >
        Wormhole
      </a>
      {' '}&middot;{' '}
      <a
        href="https://wormholescan.io/"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#025af2', textDecoration: 'none' }}
      >
        Track Transactions
      </a>
    </div>
  );
}
