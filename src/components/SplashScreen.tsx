import { useState, useEffect, useMemo } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

/** Generate deterministic particle configs so they don't change on re-render */
function buildParticles(count: number) {
  const particles: {
    left: string;
    top: string;
    size: number;
    delay: string;
    duration: string;
    opacity: number;
  }[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 360;
    const radius = 20 + (i * 37) % 60;
    const left = 50 + radius * Math.cos((angle * Math.PI) / 180) * 0.6;
    const top = 50 + radius * Math.sin((angle * Math.PI) / 180) * 0.4;
    particles.push({
      left: `${left}%`,
      top: `${top}%`,
      size: 2 + (i % 4),
      delay: `${(i * 0.12).toFixed(2)}s`,
      duration: `${2 + (i % 3) * 0.5}s`,
      opacity: 0.4 + (i % 5) * 0.12,
    });
  }
  return particles;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');
  const particles = useMemo(() => buildParticles(24), []);

  useEffect(() => {
    // enter → show
    const t1 = setTimeout(() => setPhase('show'), 100);
    // show → exit
    const t2 = setTimeout(() => setPhase('exit'), 2400);
    // exit → unmount
    const t3 = setTimeout(() => onFinish(), 3200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onFinish]);

  const isVisible = phase === 'show' || phase === 'enter';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        opacity: phase === 'exit' ? 0 : 1,
        transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: phase === 'exit' ? 'none' : 'auto',
      }}
    >
      {/* Aurora gradient background */}
      <div
        style={{
          position: 'absolute',
          inset: '-50%',
          background:
            'conic-gradient(from 180deg at 50% 50%, #7c3aed 0deg, #ec4899 72deg, #f97316 144deg, #06b6d4 216deg, #8b5cf6 288deg, #7c3aed 360deg)',
          animation: 'splash-aurora-spin 6s linear infinite',
          filter: 'blur(80px)',
          opacity: 0.6,
        }}
      />

      {/* Overlay to soften the gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(15,5,30,0.3) 0%, rgba(15,5,30,0.85) 100%)',
        }}
      />

      {/* Floating particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: i % 3 === 0 ? '#f9a8d4' : i % 3 === 1 ? '#c4b5fd' : '#67e8f9',
            opacity: isVisible ? p.opacity : 0,
            animation: `splash-float ${p.duration} ease-in-out ${p.delay} infinite alternate`,
            transition: 'opacity 0.6s ease',
            boxShadow: `0 0 ${p.size * 3}px ${p.size}px ${
              i % 3 === 0 ? 'rgba(249,168,212,0.4)' : i % 3 === 1 ? 'rgba(196,181,253,0.4)' : 'rgba(103,232,249,0.3)'
            }`,
          }}
        />
      ))}

      {/* Main content */}
      <div
        style={{
          position: 'relative',
          textAlign: 'center',
          transform: phase === 'enter' ? 'scale(0.9) translateY(12px)' : phase === 'exit' ? 'scale(1.05) translateY(-8px)' : 'scale(1) translateY(0)',
          opacity: phase === 'enter' ? 0 : phase === 'exit' ? 0 : 1,
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Sparkle icon */}
        <div
          style={{
            marginBottom: 16,
            animation: 'splash-sparkle-pulse 2s ease-in-out infinite',
          }}
        >
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path
              d="M24 4 Q24 20 40 20 Q24 20 24 36 Q24 20 8 20 Q24 20 24 4Z"
              fill="url(#splash-sparkle-grad)"
              style={{
                animation: 'splash-sparkle-rotate 4s ease-in-out infinite',
                transformOrigin: '24px 20px',
              }}
            />
            <circle cx="38" cy="10" r="4" fill="#fde68a" opacity="0.8">
              <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="12" cy="32" r="3" fill="#c4b5fd" opacity="0.6">
              <animate attributeName="r" values="2;4;2" dur="2.5s" repeatCount="indefinite" />
            </circle>
            <defs>
              <linearGradient id="splash-sparkle-grad" x1="8" y1="4" x2="40" y2="36">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="50%" stopColor="#fde68a" />
                <stop offset="100%" stopColor="#f9a8d4" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Brand name */}
        <div style={{ marginBottom: 8 }}>
          <span
            style={{
              fontFamily: "'Nunito', system-ui, sans-serif",
              fontSize: 36,
              fontWeight: 300,
              color: 'rgba(255,255,255,0.6)',
              letterSpacing: '-0.5px',
              animation: 'splash-text-glow 3s ease-in-out infinite',
            }}
          >
            minimal
          </span>
          <span
            style={{
              fontFamily: "'Nunito', system-ui, sans-serif",
              fontSize: 36,
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '1px',
              animation: 'splash-text-glow 3s ease-in-out 0.3s infinite',
              textShadow: '0 0 30px rgba(139,92,246,0.5), 0 0 60px rgba(236,72,153,0.3)',
            }}
          >
            QDA
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontFamily: "'Nunito', system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            opacity: phase === 'show' ? 1 : 0,
            transform: phase === 'show' ? 'translateY(0)' : 'translateY(6px)',
            transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s',
          }}
        >
          From fieldnotes to ethnography
        </div>

        {/* Progress line */}
        <div
          style={{
            marginTop: 32,
            width: 120,
            height: 2,
            borderRadius: 1,
            background: 'rgba(255,255,255,0.1)',
            overflow: 'hidden',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          <div
            style={{
              width: phase === 'enter' ? '0%' : '100%',
              height: '100%',
              borderRadius: 1,
              background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #f97316)',
              transition: 'width 2.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes splash-aurora-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes splash-float {
          from { transform: translateY(0) scale(1); }
          to   { transform: translateY(-18px) scale(1.3); }
        }
        @keyframes splash-sparkle-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.1); opacity: 0.8; }
        }
        @keyframes splash-sparkle-rotate {
          0%, 100% { transform: rotate(0deg) scale(1); }
          25%      { transform: rotate(5deg) scale(1.05); }
          75%      { transform: rotate(-5deg) scale(0.95); }
        }
        @keyframes splash-text-glow {
          0%, 100% { filter: brightness(1); }
          50%      { filter: brightness(1.2); }
        }
      `}</style>
    </div>
  );
}
