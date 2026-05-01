import type { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

/* ── Design tokens ──────────────────────────────────────────── */
const CAVEAT: CSSProperties = { fontFamily: "'Caveat', cursive" };
const MONO: CSSProperties   = { fontFamily: "'Geist Mono', monospace" };
const SANS: CSSProperties   = { fontFamily: "'DM Sans', sans-serif" };

const AMBER   = '#f59e0b';
const AMBER_D = 'rgba(245,158,11,0.45)';
const TEAL    = '#2dd4bf';
const TEAL_D  = 'rgba(45,212,191,0.35)';

/* ── Shared helpers ─────────────────────────────────────────── */
const cardBase: CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 20,
  padding: 28,
  position: 'relative',
  overflow: 'hidden',
};

function Glow({ color, size, top, left, right, bottom }: { color: string; size: number; top?: string; left?: string; right?: string; bottom?: string }) {
  return (
    <div
      style={{
        position: 'absolute', width: size, height: size, borderRadius: '50%',
        background: color, filter: `blur(${size * 0.6}px)`, pointerEvents: 'none',
        top, left, right, bottom,
      }}
    />
  );
}

/* ── Mini SVG Visualizations ────────────────────────────────── */

function MiniMap() {
  // Simplified Oman shape with pulsing dots for governorates
  return (
    <svg width="100%" height="160" viewBox="0 0 200 160" fill="none">
      {/* Simplified Oman outline */}
      <path
        d="M 90 10 C 105 8, 140 12, 155 30 C 168 46, 170 70, 160 85
           C 150 100, 130 110, 115 125 C 100 140, 80 150, 65 145
           C 50 140, 42 125, 40 108 C 38 90, 45 70, 55 55
           C 65 40, 75 20, 90 10 Z"
        fill="rgba(245,158,11,0.06)"
        stroke="rgba(245,158,11,0.25)"
        strokeWidth="1.5"
      />
      {/* Governorate dots */}
      {[
        { cx: 120, cy: 38, r: 4, delay: 0 },     // Muscat
        { cx: 105, cy: 55, r: 3, delay: 0.3 },    // Ad Dakhiliyah
        { cx: 85,  cy: 70, r: 3, delay: 0.6 },    // Al Dhahirah
        { cx: 140, cy: 60, r: 3.5, delay: 0.2 },  // Ash Sharqiyah
        { cx: 70,  cy: 95, r: 3, delay: 0.5 },    // Al Wusta
        { cx: 75,  cy: 130, r: 3, delay: 0.8 },   // Dhofar
        { cx: 100, cy: 42, r: 2.5, delay: 0.4 },  // Al Batinah
      ].map((dot, i) => (
        <g key={i}>
          <motion.circle
            cx={dot.cx} cy={dot.cy} r={dot.r}
            fill={AMBER}
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.8 + dot.delay }}
          />
          <motion.circle
            cx={dot.cx} cy={dot.cy} r={dot.r * 2.5}
            fill="none"
            stroke={AMBER_D}
            strokeWidth="1"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 0.6, 0], scale: [0.5, 1.5, 2] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: dot.delay }}
          />
        </g>
      ))}
    </svg>
  );
}

function MiniBarChart() {
  const bars = [38, 55, 42, 68, 52, 78, 60, 85, 72];
  return (
    <svg width="100%" height="64" viewBox="0 0 180 64" fill="none">
      {bars.map((h, i) => (
        <motion.rect
          key={i}
          x={i * 20}
          y={64 - (h * 0.7)}
          width={14}
          height={h * 0.7}
          rx={4}
          fill={i === bars.length - 1 ? AMBER : 'rgba(245,158,11,0.18)'}
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 + i * 0.06 }}
          style={{ transformOrigin: 'bottom' }}
        />
      ))}
    </svg>
  );
}

function MiniDonut() {
  const segments = [
    { pct: 35, color: AMBER },
    { pct: 25, color: TEAL },
    { pct: 20, color: 'rgba(245,158,11,0.4)' },
    { pct: 20, color: 'rgba(45,212,191,0.3)' },
  ];
  const r = 36;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      {segments.map((seg, i) => {
        const dash = (seg.pct / 100) * circ;
        const currentOffset = offset;
        offset += dash;
        return (
          <motion.circle
            key={i}
            cx={50} cy={50} r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={10}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-currentOffset}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.15 }}
          />
        );
      })}
      <text x="50" y="48" textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">SDG</text>
      <text x="50" y="62" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.4)">aligned</text>
    </svg>
  );
}

function MiniSparkline() {
  const points = '0,40 18,35 36,28 54,32 72,18 90,22 108,10 126,14 144,6';
  return (
    <svg width="100%" height="56" viewBox="0 0 160 56" fill="none" style={{ marginTop: 8 }}>
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={TEAL} stopOpacity="0.3" />
          <stop offset="100%" stopColor={TEAL} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.polyline
        points={points}
        fill="none"
        stroke={TEAL}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, delay: 0.4 }}
      />
      <polygon points={`0,56 ${points} 144,56`} fill="url(#sparkGrad)" opacity="0.5" />
    </svg>
  );
}

function PulseRing({ color, size = 48 }: { color: string; size?: number }) {
  return (
    <motion.div
      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        width: size, height: size, borderRadius: '50%',
        border: `2px solid ${color}`, position: 'absolute',
        top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        pointerEvents: 'none',
      }}
    />
  );
}

/* ── Animated counter ───────────────────────────────────────── */
function Counter({ value, suffix = '' }: { value: number; suffix?: string }) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      style={{ display: 'inline' }}
    >
      <motion.span
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        {value.toLocaleString()}{suffix}
      </motion.span>
    </motion.span>
  );
}

/* ── Card wrapper ───────────────────────────────────────────── */
function BentoCard({
  children,
  delay = 0,
  style = {},
}: {
  children: ReactNode;
  delay?: number;
  style?: CSSProperties;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay }}
      style={{ ...cardBase, ...style }}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BENTO SECTION — main export
═══════════════════════════════════════════════════════════════ */
export function BentoSection() {
  return (
    <section
      style={{
        background: '#050505',
        padding: '120px 0 100px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle noise grain */}
      <div
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
          opacity: 0.03,
          pointerEvents: 'none',
        }}
      />

      {/* Background glow blobs */}
      <Glow color="rgba(245,158,11,0.04)" size={500} top="-5%" left="5%" />
      <Glow color="rgba(45,212,191,0.03)" size={400} bottom="-10%" right="8%" />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px', position: 'relative', zIndex: 1 }}>

        {/* ── Section Header ── */}
        <div style={{ marginBottom: 64 }}>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}
          >
            <div style={{ width: 28, height: 1.5, background: AMBER, borderRadius: 1 }} />
            <span style={{ ...MONO, color: AMBER_D, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase' as const, fontWeight: 600 }}>
              Platform Capabilities
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            style={{
              ...CAVEAT,
              fontSize: 'clamp(2.8rem, 5vw, 4.2rem)',
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.12,
              margin: 0,
            }}
          >
            Everything you need,{' '}
            <span style={{ color: AMBER }}>one place</span>
          </motion.h2>
        </div>

        {/* ── Bento Grid ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gridTemplateRows: 'auto',
            gap: 16,
          }}
        >

          {/* ━━ Card 1 — Governorate Coverage (large, spans 7 cols) ━━ */}
          <BentoCard delay={0.1} style={{ gridColumn: 'span 7', minHeight: 280 }}>
            <Glow color="rgba(245,158,11,0.06)" size={200} top="-30%" right="5%" />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32, position: 'relative', zIndex: 1 }}>
              <div style={{ flex: '0 0 200px' }}>
                <MiniMap />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ ...MONO, color: AMBER_D, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' as const, margin: '0 0 10px' }}>
                  Invoice Coverage
                </p>
                <p style={{ ...SANS, color: '#fff', fontSize: 42, fontWeight: 800, lineHeight: 1, margin: '0 0 4px', letterSpacing: '-0.03em' }}>
                  <Counter value={9} />
                </p>
                <p style={{ ...CAVEAT, color: 'rgba(255,255,255,0.5)', fontSize: 22, margin: '0 0 16px' }}>
                  Currencies Supported
                </p>
                <p style={{ ...SANS, color: 'rgba(255,255,255,0.3)', fontSize: 13, lineHeight: 1.7, maxWidth: 280 }}>
                  Invoice data from freelance platforms, email, WhatsApp, and manual entry — across the Arab market and beyond.
                </p>
                {/* Small region pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16 }}>
                  {['SAR', 'USD', 'OMR', 'AED', 'EGP'].map(r => (
                    <span key={r} style={{
                      ...MONO,
                      fontSize: 9,
                      color: 'rgba(255,255,255,0.4)',
                      background: 'rgba(245,158,11,0.08)',
                      border: '1px solid rgba(245,158,11,0.15)',
                      borderRadius: 6, padding: '3px 8px',
                    }}>
                      {r}
                    </span>
                  ))}
                  <span style={{ ...MONO, fontSize: 9, color: AMBER_D, padding: '3px 4px' }}>+4 more</span>
                </div>
              </div>
            </div>
          </BentoCard>

          {/* ━━ Card 2 — AI Insights (spans 5 cols) ━━ */}
          <BentoCard delay={0.2} style={{ gridColumn: 'span 5', minHeight: 280, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Glow color="rgba(45,212,191,0.05)" size={180} bottom="-20%" left="-10%" />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(45,212,191,0.1)',
                  border: '1px solid rgba(45,212,191,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="2" strokeLinecap="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                </div>
                <p style={{ ...MONO, color: TEAL_D, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' as const, margin: 0 }}>
                  AI-Powered
                </p>
              </div>
              <p style={{ ...SANS, color: '#fff', fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
                3-Agent AI Pipeline
              </p>
              <p style={{ ...SANS, color: 'rgba(255,255,255,0.3)', fontSize: 13, lineHeight: 1.7, margin: '0 0 20px' }}>
                DeepSeek R1, Gemini Pro & Claude Opus collaborate in real-time — risk scoring, smart collection, and liquidity decisioning.
              </p>
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              {/* AI insight cards preview */}
              {[
                { text: 'HIGH risk — Invoice #203 overdue 14 days, trust grade D', color: AMBER },
                { text: 'WhatsApp reminder sent — 3% early-pay discount offered', color: TEAL },
                { text: 'Bridge eligible — SAR 2,550 advance at 1.2% APR', color: '#a78bfa' },
              ].map((insight, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.5 + i * 0.12 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', marginBottom: i < 2 ? 6 : 0,
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 10,
                  }}
                >
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: insight.color, flexShrink: 0 }} />
                  <span style={{ ...SANS, color: 'rgba(255,255,255,0.45)', fontSize: 11.5 }}>{insight.text}</span>
                </motion.div>
              ))}
            </div>
          </BentoCard>

          {/* ━━ Card 3 — Budget Tracking (spans 4 cols) ━━ */}
          <BentoCard delay={0.15} style={{ gridColumn: 'span 4', minHeight: 220 }}>
            <p style={{ ...MONO, color: AMBER_D, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' as const, margin: '0 0 8px' }}>
              Liquidity Unlocked
            </p>
            <p style={{ ...SANS, color: '#fff', fontSize: 34, fontWeight: 800, lineHeight: 1, margin: '0 0 2px', letterSpacing: '-0.02em' }}>
              SAR <Counter value={2} suffix="M+" />
            </p>
            <p style={{ ...CAVEAT, color: 'rgba(255,255,255,0.45)', fontSize: 18, margin: '0 0 16px' }}>
              Invoices processed
            </p>
            <MiniBarChart />
          </BentoCard>

          {/* ━━ Card 4 — SDG Alignment (spans 3 cols) ━━ */}
          <BentoCard delay={0.25} style={{ gridColumn: 'span 3', minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <MiniDonut />
            <p style={{ ...SANS, color: '#fff', fontSize: 15, fontWeight: 700, margin: '12px 0 4px' }}>
              Risk Graded
            </p>
            <p style={{ ...SANS, color: 'rgba(255,255,255,0.3)', fontSize: 11.5 }}>
              A–D investment<br />safety rating
            </p>
          </BentoCard>

          {/* ━━ Card 5 — Early Warning (spans 5 cols) ━━ */}
          <BentoCard delay={0.3} style={{ gridColumn: 'span 5', minHeight: 220 }}>
            <Glow color="rgba(245,158,11,0.05)" size={160} top="-30%" right="-10%" />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <p style={{ ...MONO, color: AMBER_D, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' as const, margin: '0 0 6px' }}>
                    Collection Engine
                  </p>
                  <p style={{ ...SANS, color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>
                    Real-time Invoice Monitoring
                  </p>
                </div>
                {/* Pulse indicator */}
                <div style={{ position: 'relative', width: 48, height: 48 }}>
                  <PulseRing color={AMBER_D} size={48} />
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                    width: 14, height: 14, borderRadius: '50%', background: AMBER,
                  }} />
                </div>
              </div>
              <p style={{ ...SANS, color: 'rgba(255,255,255,0.3)', fontSize: 13, lineHeight: 1.7, marginBottom: 18 }}>
                AI-triggered alerts when invoices become overdue, clients go silent, or liquidity gaps are detected in your cash flow.
              </p>
              {/* Mini risk sparkline */}
              <MiniSparkline />
            </div>
          </BentoCard>

          {/* ━━ Card 6 — Quick Stats Row (spans 5 cols, 2 mini cards) ━━ */}
          <BentoCard delay={0.2} style={{ gridColumn: 'span 5', padding: 0, background: 'none', border: 'none', borderRadius: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, height: '100%' }}>
              {/* Mini card — Partners */}
              <div style={{ ...cardBase, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24 }}>
                <div style={{ display: 'flex', marginBottom: 14 }}>
                  {(['#f59e0b', '#2dd4bf', '#a78bfa', '#f472b6'] as string[]).map((c, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: 0.4 + i * 0.08 }}
                      style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: c, border: '2px solid #111',
                        marginLeft: i === 0 ? 0 : -10,
                        zIndex: 4 - i,
                      }}
                    />
                  ))}
                </div>
                <p style={{ ...SANS, color: '#fff', fontSize: 26, fontWeight: 800, lineHeight: 1, margin: '0 0 4px' }}>
                  <Counter value={120} suffix="+" />
                </p>
                <p style={{ ...CAVEAT, color: 'rgba(255,255,255,0.4)', fontSize: 17, margin: 0 }}>Invoices Analyzed</p>
              </div>

              {/* Mini card — Ideas */}
              <div style={{ ...cardBase, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 24 }}>
                <motion.div
                  animate={{ rotate: [0, 8, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ marginBottom: 14 }}
                >
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                    <rect x="2" y="2" width="32" height="32" rx="8" fill="rgba(245,158,11,0.1)" stroke={AMBER_D} strokeWidth="1" />
                    <path d="M18 10v6l4 4" stroke={AMBER} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="18" cy="18" r="8" stroke={AMBER} strokeWidth="1.5" fill="none" />
                  </svg>
                </motion.div>
                <p style={{ ...SANS, color: '#fff', fontSize: 26, fontWeight: 800, lineHeight: 1, margin: '0 0 4px' }}>
                  <Counter value={340} suffix="+" />
                </p>
                <p style={{ ...CAVEAT, color: 'rgba(255,255,255,0.4)', fontSize: 17, margin: 0 }}>Reports Generated</p>
              </div>
            </div>
          </BentoCard>

          {/* ━━ Card 7 — CTA (spans 7 cols) ━━ */}
          <BentoCard delay={0.35} style={{
            gridColumn: 'span 7',
            background: `linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(45,212,191,0.06) 100%)`,
            border: '1px solid rgba(245,158,11,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 100,
            padding: '24px 32px',
          }}>
            <div>
              <p style={{ ...SANS, color: '#fff', fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>
                Ready to unlock your invoice liquidity?
              </p>
              <p style={{ ...SANS, color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0 }}>
                Analyze any invoice and get a bank-ready advance in minutes.
              </p>
            </div>
            <Link
              to="/room"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: AMBER, color: '#000', fontWeight: 700, fontSize: 14,
                padding: '11px 28px', borderRadius: 999, textDecoration: 'none',
                transition: 'background 0.2s, transform 0.2s',
                flexShrink: 0,
                ...SANS,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#d97706'; (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = AMBER; (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
            >
              Get Started
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </BentoCard>
        </div>
      </div>
    </section>
  );
}
