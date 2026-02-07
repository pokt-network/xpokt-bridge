'use client';

export function Background() {
  return (
    <>
      {/* Animated star background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: [
              'radial-gradient(2px 2px at 20px 30px, rgba(255,255,255,0.8), transparent)',
              'radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.6), transparent)',
              'radial-gradient(1px 1px at 90px 40px, rgba(255,255,255,0.9), transparent)',
              'radial-gradient(2px 2px at 130px 80px, rgba(255,255,255,0.5), transparent)',
              'radial-gradient(1px 1px at 160px 120px, rgba(255,255,255,0.7), transparent)',
              'radial-gradient(2px 2px at 200px 50px, rgba(2,90,242,0.8), transparent)',
              'radial-gradient(1px 1px at 250px 160px, rgba(255,255,255,0.6), transparent)',
              'radial-gradient(2px 2px at 300px 90px, rgba(255,255,255,0.5), transparent)',
              'radial-gradient(1px 1px at 350px 130px, rgba(255,197,71,0.7), transparent)',
              'radial-gradient(2px 2px at 400px 60px, rgba(255,255,255,0.8), transparent)',
              'radial-gradient(1px 1px at 450px 180px, rgba(255,255,255,0.6), transparent)',
              'radial-gradient(2px 2px at 500px 100px, rgba(72,229,194,0.6), transparent)',
            ].join(', '),
            backgroundSize: '550px 200px',
            animation: 'twinkle 8s ease-in-out infinite alternate',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: [
              'radial-gradient(1px 1px at 50px 100px, rgba(255,255,255,0.5), transparent)',
              'radial-gradient(2px 2px at 100px 150px, rgba(2,90,242,0.5), transparent)',
              'radial-gradient(1px 1px at 180px 50px, rgba(255,255,255,0.6), transparent)',
              'radial-gradient(2px 2px at 220px 200px, rgba(255,255,255,0.4), transparent)',
              'radial-gradient(1px 1px at 280px 80px, rgba(255,197,71,0.5), transparent)',
              'radial-gradient(2px 2px at 350px 170px, rgba(255,255,255,0.7), transparent)',
              'radial-gradient(1px 1px at 420px 120px, rgba(255,255,255,0.5), transparent)',
              'radial-gradient(2px 2px at 480px 40px, rgba(72,229,194,0.4), transparent)',
            ].join(', '),
            backgroundSize: '520px 250px',
            animation: 'twinkle 12s ease-in-out infinite alternate-reverse',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: [
              'radial-gradient(1px 1px at 30px 180px, rgba(255,255,255,0.4), transparent)',
              'radial-gradient(1px 1px at 120px 60px, rgba(255,255,255,0.5), transparent)',
              'radial-gradient(2px 2px at 200px 140px, rgba(2,90,242,0.4), transparent)',
              'radial-gradient(1px 1px at 270px 30px, rgba(255,255,255,0.6), transparent)',
              'radial-gradient(1px 1px at 340px 200px, rgba(255,197,71,0.4), transparent)',
              'radial-gradient(2px 2px at 410px 90px, rgba(255,255,255,0.5), transparent)',
              'radial-gradient(1px 1px at 460px 160px, rgba(255,255,255,0.4), transparent)',
            ].join(', '),
            backgroundSize: '500px 220px',
            animation: 'twinkle 15s ease-in-out infinite alternate',
          }}
        />
      </div>

      {/* Gradient overlays */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background: [
            'radial-gradient(ellipse 80% 50% at 20% 20%, rgba(2,90,242,0.12) 0%, transparent 50%)',
            'radial-gradient(ellipse 60% 40% at 80% 75%, rgba(255,197,71,0.08) 0%, transparent 50%)',
            'radial-gradient(ellipse 100% 80% at 50% 100%, rgba(23,28,31,0.9) 0%, transparent 50%)',
          ].join(', '),
        }}
      />

      {/* Orbital rings */}
      <div className="fixed rounded-full pointer-events-none" style={{ zIndex: 1, width: 900, height: 900, top: -450, right: -300, border: '1px solid rgba(2,90,242,0.08)', animation: 'orbit-rotate 120s linear infinite' }} />
      <div className="fixed rounded-full pointer-events-none" style={{ zIndex: 1, width: 700, height: 700, bottom: -350, left: -200, border: '1px solid rgba(255,197,71,0.06)', animation: 'orbit-rotate 90s linear infinite reverse' }} />
      <div className="fixed rounded-full pointer-events-none" style={{ zIndex: 1, width: 500, height: 500, top: '30%', left: -250, border: '1px solid rgba(72,229,194,0.05)', animation: 'orbit-rotate 150s linear infinite' }} />
    </>
  );
}
