import React, { useEffect, useRef } from 'react';
import createGlobe from 'cobe';

/* ─────────────────────────────────────────
   Arc Stats — AI Platform Showcase
───────────────────────────────────────── */
function CSRArcStats() {
  const W = 1100;
  const H = 480;
  const cx = 550;
  const cy = 626;
  const r = 510;

  function arcPoint(angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  const avatars = [
    { angle: 208, color: '#c8a882', initials: 'AM' },
    { angle: 228, color: '#5b8dd9', initials: 'KL' },
    { angle: 252, color: '#8b5e3c', initials: 'NR' },
    { angle: 276, color: '#4a7c59', initials: 'ST' },
    { angle: 300, color: '#9b6b9e', initials: 'MH' },
    { angle: 324, color: '#d4956b', initials: 'FO' },
  ];

  // Pulsing nodes on arc
  const nodes = [
    { angle: 240, pulse: true },
    { angle: 270, pulse: false },
    { angle: 312, pulse: true },
  ];

  // Stat chips inside arc
  const chips = [
    {
      angle: 222, offsetY: -34,
      icon: (
        <path d="M3 3v18h18M7 16l4-4 4 4 4-6" stroke="#16a34a" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ),
      label: '↑ 12%', color: '#16a34a',
    },
    {
      angle: 318, offsetY: -34,
      icon: (
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"
          stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ),
      label: '2 alerts', color: '#d97706',
    },
  ];

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: W, margin: '0 auto', height: H }}>

      {/* Subtle dot-grid background */}
      <svg
        width="100%" height="100%"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.35 }}
      >
        <defs>
          <pattern id="dotgrid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="rgba(26,32,26,0.18)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dotgrid)" />
      </svg>

      {/* LIVE indicator */}
      <div style={{
        position: 'absolute', top: 18, right: 24, zIndex: 20,
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(255,255,255,0.85)',
        border: '1px solid rgba(26,32,26,0.10)',
        borderRadius: 999, padding: '4px 12px',
        fontSize: 11, fontWeight: 600, color: '#1A201A',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', background: '#22c55e',
          display: 'inline-block',
          boxShadow: '0 0 0 2px rgba(34,197,94,0.25)',
        }} />
        LIVE
      </div>

      {/* Arc SVG */}
      <svg
        width="100%" height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
      >
        <defs>
          <radialGradient id="arcglow" cx="50%" cy="100%" r="60%">
            <stop offset="0%" stopColor="rgba(74,124,89,0.08)" />
            <stop offset="100%" stopColor="rgba(74,124,89,0)" />
          </radialGradient>
        </defs>

        {/* Arc glow fill */}
        <path
          d={`M 65 462 A ${r} ${r} 0 0 1 1035 462`}
          fill="url(#arcglow)"
        />

        {/* Main arc line */}
        <path
          d={`M 65 462 A ${r} ${r} 0 0 1 1035 462`}
          stroke="rgba(26,32,26,0.14)"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="5 7"
        />

        {/* Pulsing nodes */}
        {nodes.map((node, i) => {
          const pt = arcPoint(node.angle);
          return (
            <g key={i}>
              {node.pulse && (
                <circle cx={pt.x} cy={pt.y} r={10} fill="rgba(74,124,89,0.12)" />
              )}
              <circle cx={pt.x} cy={pt.y} r={4} fill={node.pulse ? '#4a7c59' : 'rgba(26,32,26,0.2)'} />
              <circle cx={pt.x} cy={pt.y} r={2} fill="white" />
            </g>
          );
        })}

        {/* Avatars */}
        {avatars.map((av, i) => {
          const pt = arcPoint(av.angle);
          return (
            <g key={i}>
              <circle cx={pt.x} cy={pt.y} r={17} fill={av.color} opacity={0.92} />
              <text x={pt.x} y={pt.y + 4.5} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#fff">
                {av.initials}
              </text>
              <circle cx={pt.x} cy={pt.y} r={18.5} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
            </g>
          );
        })}

        {/* Stat chips */}
        {chips.map((chip, i) => {
          const pt = arcPoint(chip.angle);
          const cw = 70; const ch = 24;
          const rx2 = pt.x - cw / 2;
          const ry2 = pt.y + chip.offsetY - ch / 2;
          return (
            <g key={i}>
              <rect x={rx2} y={ry2} width={cw} height={ch} rx={12}
                fill="rgba(255,255,255,0.92)" stroke="rgba(26,32,26,0.08)" strokeWidth="1" />
              {/* mini icon */}
              <svg x={rx2 + 8} y={ry2 + 4} width={16} height={16} viewBox="0 0 24 24">
                {chip.icon}
              </svg>
              <text x={rx2 + 31} y={ry2 + ch / 2 + 4.5} fontSize="9.5" fontWeight="700" fill={chip.color}>
                {chip.label}
              </text>
              <line
                x1={pt.x} y1={pt.y - 18}
                x2={pt.x} y2={ry2 + ch}
                stroke="rgba(26,32,26,0.12)" strokeWidth="1" strokeDasharray="2 3"
              />
            </g>
          );
        })}

        {/* AI Insight card — above arc center */}
        {(() => {
          const pt = arcPoint(270);
          const cw = 110; const ch = 44;
          const rx2 = pt.x - cw / 2;
          const ry2 = pt.y - 72;
          return (
            <g>
              <rect x={rx2} y={ry2} width={cw} height={ch} rx={10}
                fill="rgba(255,255,255,0.95)" stroke="rgba(74,124,89,0.25)" strokeWidth="1" />
              {/* AI sparkle icon */}
              <svg x={rx2 + 8} y={ry2 + 8} width={14} height={14} viewBox="0 0 24 24">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17 5.8 21.3l2.4-7.4L2 9.4h7.6L12 2z"
                  stroke="#4a7c59" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(74,124,89,0.12)" />
              </svg>
              <text x={rx2 + 28} y={ry2 + 17} fontSize="8" fontWeight="700" fill="#4a7c59">AI Analysis</text>
              <text x={rx2 + 8} y={ry2 + 33} fontSize="8.5" fontWeight="500" fill="rgba(26,32,26,0.55)">3 insights ready</text>
              <line
                x1={pt.x} y1={pt.y - 18} x2={pt.x} y2={ry2 + ch}
                stroke="rgba(74,124,89,0.2)" strokeWidth="1" strokeDasharray="2 3"
              />
            </g>
          );
        })()}
      </svg>

      {/* Floating card — Early Warning (left) */}
      <div style={{
        position: 'absolute', left: 32, top: 148, zIndex: 10,
        background: 'rgba(255,255,255,0.95)',
        border: '1px solid rgba(217,119,6,0.2)',
        borderRadius: 14, padding: '10px 14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
        minWidth: 172,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8,
            background: 'rgba(217,119,6,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"
                stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#1A201A' }}>Invoice Alert</div>
            <div style={{ fontSize: 9, color: 'rgba(26,32,26,0.4)' }}>Overdue payment risk</div>
          </div>
        </div>
        {/* Mini progress bar */}
        <div style={{ background: 'rgba(26,32,26,0.06)', borderRadius: 99, height: 5, overflow: 'hidden' }}>
          <div style={{ width: '87%', height: '100%', background: '#d97706', borderRadius: 99 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 9, color: 'rgba(26,32,26,0.4)' }}>Invoice #203</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#d97706' }}>87%</span>
        </div>
        {/* connector */}
        <div style={{
          position: 'absolute', bottom: -20, left: '50%',
          transform: 'translateX(-50%)',
          width: 1, height: 18, background: 'rgba(26,32,26,0.15)',
        }} />
      </div>

      {/* Floating card — AI Report (right) */}
      <div style={{
        position: 'absolute', right: 32, top: 118, zIndex: 10,
        background: 'rgba(255,255,255,0.95)',
        border: '1px solid rgba(74,124,89,0.2)',
        borderRadius: 14, padding: '10px 14px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
        minWidth: 178,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 8,
            background: 'rgba(74,124,89,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17 5.8 21.3l2.4-7.4L2 9.4h7.6L12 2z"
                stroke="#4a7c59" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#1A201A' }}>AI Analysis Ready</div>
            <div style={{ fontSize: 9, color: 'rgba(26,32,26,0.4)' }}>Liquidity bridge · Active</div>
          </div>
        </div>
        {/* Mini bar chart */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 22 }}>
          {[40, 65, 50, 80, 70, 90, 75].map((h, i) => (
            <div key={i} style={{
              flex: 1, height: `${h}%`, borderRadius: 3,
              background: i === 5 ? '#4a7c59' : 'rgba(74,124,89,0.2)',
            }} />
          ))}
        </div>
        {/* connector */}
        <div style={{
          position: 'absolute', bottom: -20, left: '50%',
          transform: 'translateX(-50%)',
          width: 1, height: 18, background: 'rgba(26,32,26,0.15)',
        }} />
      </div>

      {/* Center content */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center', width: '100%', maxWidth: 660, zIndex: 5,
      }}>
        {/* Stats row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          {[
            { value: '3', label: 'AI Agents' },
            { value: '85%', label: 'Advance Rate' },
            { value: '24h', label: 'Decision Time' },
          ].map((stat, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', padding: '0 22px' }}>
                <div style={{
                  fontFamily: "'Caveat', cursive",
                  fontSize: 'clamp(1.5rem, 2.6vw, 2.2rem)',
                  fontWeight: 700, color: '#1A3A1A', lineHeight: 1,
                }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 10.5, color: 'rgba(26,32,26,0.4)', marginTop: 3, letterSpacing: '0.03em' }}>
                  {stat.label}
                </div>
              </div>
              {i < 2 && <div style={{ width: 1, height: 30, background: 'rgba(26,32,26,0.10)' }} />}
            </div>
          ))}
        </div>

        {/* Heading */}
        <h2 style={{
          fontFamily: "'Caveat', 'Parisienne', cursive",
          fontSize: 'clamp(1.5rem, 2.8vw, 2.4rem)',
          fontWeight: 700, color: '#1A201A', lineHeight: 1.2,
          margin: '0 0 14px', letterSpacing: '-0.01em',
        }}>
          We Power The Smartest Invoice Liquidity Engine
        </h2>

        {/* Feature tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
          {[
            {
              label: 'Risk Reports',
              icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
            },
            {
              label: 'AI Consensus',
              icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17 5.8 21.3l2.4-7.4L2 9.4h7.6L12 2z" /></svg>,
            },
            {
              label: 'WhatsApp',
              icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" /><line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" /></svg>,
            },
            {
              label: 'Invoice Scoring',
              icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
            },
            {
              label: 'Bank Bridge',
              icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg>,
            },
          ].map((tag, i) => (
            <div key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              border: '1px solid rgba(26,32,26,0.13)',
              borderRadius: 999, padding: '5px 13px',
              fontSize: 11.5, fontWeight: 500,
              color: 'rgba(26,32,26,0.6)',
              background: 'rgba(255,255,255,0.65)',
              backdropFilter: 'blur(6px)',
            }}>
              {tag.icon}
              {tag.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Hero Section
───────────────────────────────────────── */
export function HeroSection() {
  return (
    <section className="relative flex flex-col overflow-hidden" style={{ minHeight: '100vh' }}>

      {/* Soft radial glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[8%] top-[20%] h-[340px] w-[340px] rounded-full bg-[#A8B89A]/15 blur-[130px]" />
        <div className="absolute right-[12%] bottom-[28%] h-[260px] w-[260px] rounded-full bg-[#4a7c59]/8 blur-[110px]" />
      </div>

      {/* Navbar spacer */}
      <div style={{ height: 80 }} />

      {/* Arc Stats */}
      <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 8, paddingLeft: 16, paddingRight: 16 }}>
        <CSRArcStats />
      </div>

      {/* Globe — centered, bottom half hidden */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', height: 240, width: '100%', overflow: 'hidden' }}>
          <Globe style={{ position: 'absolute', bottom: -320, left: '50%', transform: 'translateX(-50%)' }} />
        </div>
      </div>

    </section>
  );
}

/* ─────────────────────────────────────────
   Globe (cobe)
───────────────────────────────────────── */
function Globe({ style }: { style?: React.CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let phi = 0;
    let rafId: number;
    if (!canvasRef.current) return;
    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 600 * 2,
      height: 600 * 2,
      phi: 0, theta: 0,
      dark: 1, diffuse: 1.2,
      mapSamples: 16000, mapBrightness: 6,
      baseColor: [0.3, 0.3, 0.3],
      markerColor: [0.4, 0.7, 1.0],
      glowColor: [0.12, 0.12, 0.12],
      markers: [
        { location: [23.588, 58.3829], size: 0.08 },
        { location: [17.0151, 54.0924], size: 0.05 },
        { location: [24.4675, 56.741], size: 0.04 },
        { location: [22.9333, 57.5333], size: 0.04 },
      ],
    });
    function animate() {
      phi += 0.01;
      globe.update({ phi });
      rafId = requestAnimationFrame(animate);
    }
    rafId = requestAnimationFrame(animate);
    return () => { globe.destroy(); cancelAnimationFrame(rafId); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: 600, height: 600, maxWidth: '100%', aspectRatio: 1, ...style }}
    />
  );
}
