import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import BounceCards from '../components/BounceCards';

/* ─────────────────────────────────────────────
   Dark-theme glass + Caveat constants
───────────────────────────────────────────── */
const CAVEAT: CSSProperties = { fontFamily: "'Caveat', cursive" };
const GLASS: CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderRadius: 14,
  padding: '10px 12px',
};
const G = '#4ade80';           // accent green
const GDIM = 'rgba(74,222,128,0.45)';

/* ─────────────────────────────────────────────
   8 collage images — /public/data/
───────────────────────────────────────────── */
const CSR_IMAGES = [
  '/data/card-analytics.jpeg',   // pie chart + hands
  '/data/card-0.jpeg',           // globe + location pins
  '/data/card-ai-team.jpeg',     // AI robot + woman
  '/data/card-growth.jpeg',      // coins + plants growth chart
  '/data/card-finance.jpeg',     // hand holding coin stack
  '/data/card-insights.jpeg',    // AI faces + lightbulb
  '/data/card-analyst.jpeg',     // woman + laptop + data
  '/data/card-economy.jpeg',     // hand + cash + city skyline
];


const TRANSFORM_STYLES = [
  'rotate(-20deg) translate(-315px)',
  'rotate(-12deg) translate(-210px)',
  'rotate(-5deg) translate(-105px)',
  'rotate(-1deg)',
  'rotate(4deg) translate(105px)',
  'rotate(11deg) translate(210px)',
  'rotate(16deg) translate(315px)',
  'rotate(21deg) translate(420px)',
];

/* ─────────────────────────────────────────────
   Main section
───────────────────────────────────────────── */
export function PrimaryHeroSection() {
  return (
    <section
      style={{
        background: '#0a0a0a',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle noise grain */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
          opacity: 0.04,
          pointerEvents: 'none',
        }}
      />

      {/* Soft green glow blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div style={{ position: 'absolute', left: '10%', top: '20%', width: 400, height: 400, borderRadius: '50%', background: 'rgba(74,222,128,0.05)', filter: 'blur(120px)' }} />
        <div style={{ position: 'absolute', right: '10%', bottom: '25%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(74,222,128,0.04)', filter: 'blur(100px)' }} />
      </div>

      {/* ── Hand-drawn floating charts ── */}
      <DarkCharts />

      {/* Navbar spacer */}
      <div style={{ height: 100 }} />

      {/* ── Handwriting Title ── */}
      <motion.h1
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        style={{
          fontFamily: "'Caveat', 'Parisienne', cursive",
          fontSize: 'clamp(3rem, 6.5vw, 6rem)',
          fontWeight: 700,
          color: '#fff',
          textAlign: 'center',
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
          margin: '0 0 52px',
          maxWidth: 780,
          padding: '0 24px',
          zIndex: 2,
          position: 'relative',
        }}
      >
        Turn unpaid invoices into<br />
        <span style={{ color: G, fontWeight: 700 }}>instant liquidity</span> with AI.
      </motion.h1>

      {/* ── Cards area with floating badges ── */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
        style={{ position: 'relative', zIndex: 2 }}
      >
        {/* Badge — left (Analytics) */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 1.3 }}
          style={{
            position: 'absolute',
            left: 32,
            top: '30%',
            zIndex: 10,
            background: '#2563eb',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: "'Caveat', cursive",
            padding: '5px 13px',
            borderRadius: 999,
            boxShadow: '0 4px 20px rgba(37,99,235,0.5)',
            whiteSpace: 'nowrap',
          }}
        >
          # Sentinel
        </motion.div>

        {/* Badge — right (Insights) */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 1.5 }}
          style={{
            position: 'absolute',
            right: 32,
            top: '20%',
            zIndex: 10,
            background: '#16a34a',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: "'Caveat', cursive",
            padding: '5px 13px',
            borderRadius: 999,
            boxShadow: '0 4px 20px rgba(22,163,74,0.5)',
            whiteSpace: 'nowrap',
          }}
        >
          # Negotiator
        </motion.div>

        {/* Badge — left bottom (Growth) */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 1.7 }}
          style={{
            position: 'absolute',
            left: 48,
            bottom: '8%',
            zIndex: 10,
            background: '#d97706',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: "'Caveat', cursive",
            padding: '5px 13px',
            borderRadius: 999,
            boxShadow: '0 4px 20px rgba(217,119,6,0.5)',
            whiteSpace: 'nowrap',
          }}
        >
          # Treasurer
        </motion.div>

        {/* Badge — right bottom (AI) */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 1.9 }}
          style={{
            position: 'absolute',
            right: 48,
            bottom: '8%',
            zIndex: 10,
            background: '#7c3aed',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            fontFamily: "'Caveat', cursive",
            padding: '5px 13px',
            borderRadius: 999,
            boxShadow: '0 4px 20px rgba(124,58,237,0.5)',
            whiteSpace: 'nowrap',
          }}
        >
          # AI-Powered
        </motion.div>

        <BounceCards
          images={CSR_IMAGES}
          transformStyles={TRANSFORM_STYLES}
          containerWidth={1000}
          containerHeight={290}
          animationDelay={0.9}
          animationStagger={0.06}
          enableHover
        />
      </motion.div>

      {/* ── Subtitle ── */}
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.7 }}
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 'clamp(13px, 1.4vw, 15px)',
          color: 'rgba(255,255,255,0.35)',
          textAlign: 'center',
          maxWidth: 480,
          lineHeight: 1.8,
          margin: '36px 0 28px',
          padding: '0 24px',
          zIndex: 2,
          position: 'relative',
        }}
      >
        3 AI agents — Sentinel, Negotiator & Treasurer — analyze your invoices,<br />
        draft outreach, and underwrite a bank-ready liquidity bridge.
      </motion.p>

      {/* ── CTA Buttons ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.85 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          zIndex: 2,
          position: 'relative',
          marginBottom: 72,
        }}
      >
        <a
          href="/room"
          style={{
            background: '#f59e0b',
            color: '#000',
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
            padding: '11px 28px',
            borderRadius: 999,
            textDecoration: 'none',
            letterSpacing: '-0.01em',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          ⚡ Launch Agent Room
        </a>
        <a
          href="#how"
          style={{
            background: 'transparent',
            color: 'rgba(255,255,255,0.65)',
            fontSize: 14,
            fontWeight: 500,
            fontFamily: "'DM Sans', sans-serif",
            padding: '11px 22px',
            borderRadius: 999,
            textDecoration: 'none',
            letterSpacing: '-0.01em',
            border: '1px solid rgba(255,255,255,0.12)',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
        >
          How it Works
        </a>
      </motion.div>
    </section>
  );
}

/* ─────────────────────────────────────────────
   Hand-drawn floating charts — dark theme
───────────────────────────────────────────── */
function DarkCharts() {
  return (
    <>
      {/* ── Chart 1 : Line — top-left ── */}
      <motion.div
        className="absolute z-20 hidden lg:block"
        style={{ top: '12%', left: '4%' }}
        initial={{ opacity: 0, x: -24, rotate: -5 }}
        animate={{ opacity: 1, x: 0,  rotate: -5 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 1.6 }}
      >
        <div style={{ ...CAVEAT, color: GDIM, fontSize: 13, fontWeight: 700, marginBottom: 4, marginLeft: 6 }}>
          impact rising ↗
        </div>
        <div style={{ ...GLASS, width: 162 }}>
          <svg width="138" height="68" viewBox="0 0 138 68" fill="none">
            {[16, 32, 48, 64].map(y => (
              <line key={y} x1="0" y1={y} x2="138" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
            ))}
            <path
              d="M 4 58 C 18 54 26 46 38 42 C 50 38 58 44 70 34 C 82 24 94 16 110 10 L 134 6 L 134 64 L 4 64 Z"
              fill="rgba(74,222,128,0.08)"
            />
            <path
              d="M 4 58 C 18 54 26 46 38 42 C 50 38 58 44 70 34 C 82 24 94 16 110 10 L 134 6"
              stroke={G} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            />
            {([[4,58],[38,42],[70,34],[110,10],[134,6]] as [number,number][]).map(([x,y],i) => (
              <circle key={i} cx={x} cy={y} r={i===4?3.5:2} fill={i===4? G : GDIM} />
            ))}
            <path d="M 118 22 Q 128 14 132 9" stroke={GDIM} strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 129 6 L 133 10 L 136 5" stroke={GDIM} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <text x="82" y="12" style={CAVEAT} fontSize="9" fill={GDIM}>peak</text>
          </svg>
          <p style={{ ...CAVEAT, color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>quarterly growth</p>
        </div>
      </motion.div>

      {/* ── Chart 2 : Bar — top-right ── */}
      <motion.div
        className="absolute z-20 hidden lg:block"
        style={{ top: '12%', right: '4%' }}
        initial={{ opacity: 0, x: 24, rotate: 5 }}
        animate={{ opacity: 1, x: 0,  rotate: 5 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 1.9 }}
      >
        <div style={{ ...CAVEAT, color: GDIM, fontSize: 13, fontWeight: 700, marginBottom: 4, textAlign: 'right', marginRight: 6 }}>
          ← budget spread
        </div>
        <div style={{ ...GLASS, width: 148 }}>
          <svg width="124" height="64" viewBox="0 0 124 64" fill="none">
            <line x1="0" y1="60" x2="124" y2="60" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
            {[
              { x: 6,  h: 28, accent: true },
              { x: 24, h: 42 },
              { x: 42, h: 20 },
              { x: 60, h: 52, accent: true },
              { x: 78, h: 36 },
              { x: 96, h: 44 },
            ].map((b, i) => (
              <g key={i}>
                <rect
                  x={b.x} y={60 - b.h} width={14} height={b.h} rx={3}
                  fill={b.accent ? 'rgba(74,222,128,0.55)' : 'rgba(74,222,128,0.15)'}
                />
                <line x1={b.x} y1={60 - b.h} x2={b.x+14} y2={60 - b.h - 0.8} stroke="rgba(74,222,128,0.2)" strokeWidth="1" />
              </g>
            ))}
            <path d="M 58 10 Q 62 6 66 10" stroke={GDIM} strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 63 7 L 66 11 L 70 8" stroke={GDIM} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            <text x="30" y="9" style={CAVEAT} fontSize="9" fill={GDIM}>highest</text>
          </svg>
          <p style={{ ...CAVEAT, color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>budget by category</p>
        </div>
      </motion.div>

      {/* ── Stat Badge — left ── */}
      <motion.div
        className="absolute z-20 hidden lg:block"
        style={{ top: '40%', left: '4%' }}
        initial={{ opacity: 0, x: -20, rotate: -6 }}
        animate={{ opacity: 1, x: 0,  rotate: -6 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 2.1 }}
      >
        <div style={{ ...GLASS, width: 142 }}>
          <p style={{ ...CAVEAT, color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>total beneficiaries</p>
          <p style={{ color: '#fff', fontSize: 32, fontWeight: 800, lineHeight: 1.1, letterSpacing: '-1px' }}>2,847</p>
          <svg width="90" height="12" viewBox="0 0 90 12" fill="none">
            <path d="M 2 9 Q 25 5 45 8 Q 65 11 88 6" stroke={G} strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <p style={{ ...CAVEAT, color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 2 }}>across 11 governorates</p>
        </div>
      </motion.div>

      {/* ── Avatar Stack — right ── */}
      <motion.div
        className="absolute z-20 hidden lg:block"
        style={{ top: '38%', right: '4%' }}
        initial={{ opacity: 0, x: 20, rotate: -4 }}
        animate={{ opacity: 1, x: 0,  rotate: -4 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 2.2 }}
      >
        <div style={{ ...CAVEAT, color: GDIM, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
          48 teams active ↗
        </div>
        <div style={{ ...GLASS, width: 140 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            {(['#b91c1c','#7c3aed','#1d4ed8','#15803d'] as string[]).map((c, i) => (
              <div key={i} style={{
                width: 28, height: 28, borderRadius: '50%', background: c,
                border: '2px solid rgba(255,255,255,0.15)', marginLeft: i === 0 ? 0 : -10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: 'sans-serif', zIndex: 4 - i,
              }}>
                {['A','M','S','K'][i]}
              </div>
            ))}
            <span style={{ ...CAVEAT, color: 'rgba(255,255,255,0.5)', fontSize: 13, marginLeft: 8 }}>+44</span>
          </div>
          <svg width="116" height="8" viewBox="0 0 116 8" fill="none">
            <path d="M 2 6 Q 35 3 58 5 Q 82 7 114 4" stroke={GDIM} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p style={{ ...CAVEAT, color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 3 }}>team members</p>
        </div>
      </motion.div>

      {/* ── Progress Ring — left bottom ── */}
      <motion.div
        className="absolute z-20 hidden lg:block"
        style={{ top: '65%', left: '4%' }}
        initial={{ opacity: 0, x: -20, rotate: -5 }}
        animate={{ opacity: 1, x: 0,  rotate: -5 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 2.4 }}
      >
        <div style={{ ...CAVEAT, color: GDIM, fontSize: 12, fontWeight: 700, marginBottom: 4 }}>budget utilized</div>
        <div style={{ ...GLASS, width: 116, display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <circle cx="26" cy="26" r="20" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
            <circle cx="26" cy="26" r="20" stroke={G} strokeWidth="6"
              strokeDasharray="100 126" strokeDashoffset="31" strokeLinecap="round"
              transform="rotate(-90 26 26)" />
            <text x="26" y="30" textAnchor="middle" style={CAVEAT} fontSize="11" fontWeight="700" fill="#fff">78%</text>
          </svg>
          <p style={{ ...CAVEAT, color: 'rgba(255,255,255,0.3)', fontSize: 10, lineHeight: 1.4 }}>of annual<br />budget</p>
        </div>
      </motion.div>

      {/* ── SDG Score — right bottom ── */}
      <motion.div
        className="absolute z-20 hidden lg:block"
        style={{ top: '65%', right: '4%' }}
        initial={{ opacity: 0, x: 20, rotate: 4 }}
        animate={{ opacity: 1, x: 0,  rotate: 4 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 2.55 }}
      >
        <div style={{ ...CAVEAT, color: GDIM, fontSize: 12, fontWeight: 700, marginBottom: 4, textAlign: 'right' }}>SDG alignment</div>
        <div style={{ ...GLASS, width: 148 }}>
          <svg width="124" height="52" viewBox="0 0 124 52" fill="none">
            {/* donut segments */}
            <circle cx="26" cy="26" r="18" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
            <circle cx="26" cy="26" r="18" stroke="#f59e0b" strokeWidth="10"
              strokeDasharray="45 113" strokeDashoffset="28" strokeLinecap="butt" transform="rotate(-90 26 26)" />
            <circle cx="26" cy="26" r="18" stroke={G} strokeWidth="10"
              strokeDasharray="33 125" strokeDashoffset="-17" strokeLinecap="butt" transform="rotate(-90 26 26)" />
            <circle cx="26" cy="26" r="18" stroke="#3b82f6" strokeWidth="10"
              strokeDasharray="22 136" strokeDashoffset="-50" strokeLinecap="butt" transform="rotate(-90 26 26)" />
            <text x="26" y="30" textAnchor="middle" style={CAVEAT} fontSize="10" fontWeight="700" fill="#fff">SDG</text>
            {/* legend */}
            {[
              { x: 60, label: 'Env', color: G },
              { x: 60, label: 'Edu', color: '#f59e0b', dy: 16 },
              { x: 60, label: 'Health', color: '#3b82f6', dy: 32 },
            ].map((l, i) => (
              <g key={i}>
                <rect x={l.x} y={8 + (l.dy ?? 0)} width={7} height={7} rx={2} fill={l.color} />
                <text x={l.x + 10} y={15 + (l.dy ?? 0)} style={CAVEAT} fontSize="9" fill="rgba(255,255,255,0.45)">{l.label}</text>
              </g>
            ))}
          </svg>
          <p style={{ ...CAVEAT, color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 2 }}>goal distribution</p>
        </div>
      </motion.div>
    </>
  );
}
