import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const stats = [
  { value: '3',       label: 'AI Agents' },
  { value: '9',       label: 'Currencies' },
  { value: '85%',     label: 'Advance Rate' },
  { value: '24h',     label: 'Decision Time' },
  { value: 'PDF',     label: 'Risk Reports' },
];

/* ── Floating stat cards ── */
const CARDS = [
  {
    pos: { top: '4%', left: '-18%' },
    rotate: -6,
    delay: 0.3,
    content: (
      <div style={{ background: '#111', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, padding: '10px 14px', width: 148 }}>
        <p style={{ color: 'rgba(167,139,250,0.65)', fontSize: 10, marginBottom: 4 }}>Risk Assessment</p>
        <p style={{ color: '#fff', fontSize: 26, fontWeight: 800, lineHeight: 1 }}>High</p>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginTop: 8 }}>
          <div style={{ height: '100%', width: '78%', background: '#7c3aed', borderRadius: 2 }} />
        </div>
      </div>
    ),
  },
  {
    pos: { top: '4%', right: '-18%' },
    rotate: 6,
    delay: 0.4,
    content: (
      <div style={{ background: '#111', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, padding: '10px 14px', width: 140 }}>
        <p style={{ color: 'rgba(167,139,250,0.65)', fontSize: 10, marginBottom: 6 }}>Invoices Analyzed</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
          {[18, 28, 20, 38, 30, 44].map((h, i) => (
            <div key={i} style={{ flex: 1, height: h, borderRadius: 3, background: i === 5 ? '#7c3aed' : 'rgba(139,92,246,0.2)' }} />
          ))}
        </div>
        <p style={{ color: '#fff', fontSize: 22, fontWeight: 800, marginTop: 6 }}>44</p>
      </div>
    ),
  },
  {
    pos: { top: '42%', left: '-20%' },
    rotate: -5,
    delay: 0.5,
    content: (
      <div style={{ background: '#111', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, padding: '10px 14px', width: 148 }}>
        <p style={{ color: 'rgba(167,139,250,0.65)', fontSize: 10, marginBottom: 6 }}>Invoices Processed</p>
        <p style={{ color: '#fff', fontSize: 26, fontWeight: 800, lineHeight: 1 }}>1,240+</p>
        <p style={{ color: 'rgba(167,139,250,0.45)', fontSize: 10, marginTop: 4 }}>Multi-source verified</p>
      </div>
    ),
  },
  {
    pos: { top: '42%', right: '-20%' },
    rotate: 5,
    delay: 0.55,
    content: (
      <div style={{ background: '#111', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, padding: '10px 14px', width: 136 }}>
        <p style={{ color: 'rgba(167,139,250,0.65)', fontSize: 10, marginBottom: 8 }}>Risk Score</p>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ display: 'block', margin: '0 auto' }}>
          <circle cx="24" cy="24" r="18" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
          <circle cx="24" cy="24" r="18" stroke="#7c3aed" strokeWidth="5"
            strokeDasharray="72 113" strokeDashoffset="28" strokeLinecap="round"
            transform="rotate(-90 24 24)" />
          <text x="24" y="29" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">Low</text>
        </svg>
      </div>
    ),
  },
  {
    pos: { bottom: '4%', left: '-14%' },
    rotate: -4,
    delay: 0.6,
    content: (
      <div style={{ background: '#111', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, padding: '10px 14px', width: 148 }}>
        <div style={{ display: 'flex', marginBottom: 6 }}>
          {(['#7c3aed','#a855f7','#c084fc','#e879f9'] as string[]).map((c, i) => (
            <div key={i} style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: '2px solid #111', marginLeft: i === 0 ? 0 : -8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700, zIndex: 4 - i }}>
              {['A','M','S','K'][i]}
            </div>
          ))}
          <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginLeft: 10, alignSelf: 'center' }}>+44</span>
        </div>
        <p style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>3 AI agents active</p>
        <p style={{ color: 'rgba(167,139,250,0.45)', fontSize: 10 }}>↗ cross-verification</p>
      </div>
    ),
  },
];

/* ── Showcase image ── */
function CenterVideo() {
  return (
    <div style={{
      width: '100%',
      maxWidth: 440,
      borderRadius: 20,
      overflow: 'hidden',
      aspectRatio: '4/5',
      background: '#000',
    }}>
      <img
        src="/data/logo2.jpg"
        alt="AI-powered invoice analysis"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  );
}

export function ShowcaseSection() {
  return (
    <section style={{ background: '#000000', minHeight: '100vh', paddingTop: 80 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>

        {/* ── TWO COLUMNS ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 64,
          alignItems: 'center',
          minHeight: 'calc(100vh - 240px)',
        }}>

          {/* LEFT */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7 }}
          >
            {/* badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(139,92,246,0.12)',
              border: '1px solid rgba(139,92,246,0.28)',
              borderRadius: 999, padding: '5px 14px', marginBottom: 28,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', display: 'inline-block' }} />
              <span style={{ color: '#c4b5fd', fontSize: 12, fontWeight: 600 }}>AI-Powered Freelancer Liquidity Platform</span>
            </div>

            {/* heading */}
            <h2 style={{ color: '#fff', fontSize: 'clamp(2.2rem, 4.5vw, 3.8rem)', fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.02em', margin: 0 }}>
              Analyze Invoices
            </h2>
            <h2 style={{
              fontFamily: "'Caveat', cursive",
              fontSize: 'clamp(2.4rem, 4.8vw, 4rem)',
              fontWeight: 700, lineHeight: 1.12, margin: 0,
              color: '#4ade80',
              textDecoration: 'underline',
              textDecorationStyle: 'wavy',
              textDecorationColor: 'rgba(74,222,128,0.4)',
              textUnderlineOffset: 6,
            }}>
              with confidence
            </h2>
            <h2 style={{ color: '#fff', fontSize: 'clamp(2.2rem, 4.5vw, 3.8rem)', fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.02em', margin: '0 0 24px' }}>
              Get Liquidity Now
            </h2>

            {/* subtitle */}
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16, lineHeight: 1.7, maxWidth: 460, marginBottom: 36 }}>
              Submit any invoice, get multi-agent AI analysis on payment risk,
              collection strategy, and bank-ready advance — with professional PDF risk reports.
            </p>

            {/* CTA + tagline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
              <Link
                to="/room"
                style={{
                  background: '#7c3aed',
                  color: '#fff', fontWeight: 700, fontSize: 15,
                  padding: '13px 32px', borderRadius: 999,
                  textDecoration: 'none',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#6d28d9'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#7c3aed'; }}
              >
                Analyze Invoice →
              </Link>

              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <svg style={{ position: 'absolute', top: -20, left: -28, width: 36, height: 28, opacity: 0.55 }} viewBox="0 0 36 28" fill="none">
                  <path d="M 30 4 Q 20 2 8 14 Q 4 18 2 24" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M 2 20 L 2 25 L 7 24" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ fontFamily: "'Caveat', cursive", color: '#4ade80', fontWeight: 700, fontSize: 17, lineHeight: 1.55 }}>Real invoice data.</span>
                <span style={{ fontFamily: "'Caveat', cursive", color: '#4ade80', fontWeight: 700, fontSize: 17, lineHeight: 1.55 }}>Real AI agents.</span>
                <span style={{ fontFamily: "'Caveat', cursive", color: '#4ade80', fontWeight: 700, fontSize: 17, lineHeight: 1.55 }}>Real liquidity.</span>
              </div>
            </div>
          </motion.div>

          {/* RIGHT — video + floating cards */}
          <motion.div
            initial={{ opacity: 0, x: 32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            style={{ display: 'flex', justifyContent: 'center' }}
          >
            <div style={{ position: 'relative', width: '100%', maxWidth: 440 }}>
              {/* floating cards */}
              {CARDS.map((card, i) => (
                <motion.div
                  key={i}
                  style={{ position: 'absolute', zIndex: 10, ...card.pos }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1, rotate: card.rotate }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.6, delay: card.delay }}
                >
                  {card.content}
                </motion.div>
              ))}

              {/* video */}
              <CenterVideo />
            </div>
          </motion.div>
        </div>

        {/* ── STATS ROW ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 10,
            paddingBottom: 60,
          }}
        >
          {stats.map((s, i) => (
            <div key={i} style={{
              background: '#000',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: 14,
              padding: '20px 18px',
            }}>
              <p style={{ color: '#fff', fontSize: 'clamp(1.4rem, 2vw, 1.9rem)', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>
                {s.value}
              </p>
              <p style={{ color: 'rgba(167,139,250,0.6)', fontSize: 12, marginTop: 6 }}>{s.label}</p>
            </div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}
