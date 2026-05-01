import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import { motion } from 'framer-motion';
import { StaggeredMenu } from './landing/components/StaggeredMenu';
import { PrimaryHeroSection } from './landing/sections/PrimaryHeroSection';
import { HeroSection } from './landing/sections/HeroSection';
import { ShowcaseSection } from './landing/sections/ShowcaseSection';
import { BentoSection } from './landing/sections/BentoSection';
import { FAQSection } from './landing/sections/FAQSection';
import Stepper, { Step } from './landing/components/Stepper';
import { SiReact, SiTypescript, SiTailwindcss, SiVite, SiGithub } from 'react-icons/si';
import { TbBrandFramerMotion } from 'react-icons/tb';
import { BiChart } from 'react-icons/bi';
import { FaLeaf, FaShieldAlt, FaLock } from 'react-icons/fa';
import {
  ShieldCheck, BadgeCheck, CheckCircle2, X,
} from 'lucide-react';
// api stub for preview — kept for future contact form
const api = { post: async (..._args: unknown[]) => ({ data: {} }) };  // eslint-disable-line @typescript-eslint/no-unused-vars

// Disable browser scroll restoration at module load time (before any render)
if (typeof window !== 'undefined' && 'scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

export default function LandingPage() {
  const lenisRef = useRef<Lenis | null>(null);
  const [pricingOpen, setPricingOpen] = useState(false);

  // Runs synchronously before browser paint — resets scroll before user sees anything
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.current = lenis;
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  return (
    <div className="landing-page min-h-screen antialiased" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {pricingOpen && <PricingModal onClose={() => setPricingOpen(false)} />}
      <StaggeredMenu
        isFixed
        position="right"
        logoText="Madar"
        menuButtonColor="#1a1400"
        openMenuButtonColor="#ffffff"
        changeMenuColorOnOpen={true}
        colors={['#f59e0b', '#d97706', '#92400e']}
        accentColor="#f59e0b"
        displayItemNumbering
        displaySocials
        items={[
          { label: 'Home',         ariaLabel: 'Go to home',                  link: '/' },
          { label: 'Connections',  ariaLabel: 'Connect your platforms',      link: '/connections' },
          { label: 'Agent Room',   ariaLabel: 'Multi-agent AI reasoning',    link: '/room' },
          { label: 'Credit Panel', ariaLabel: 'Bank credit underwriting',    link: '/credit' },
          { label: 'How it Works', ariaLabel: 'Learn how it works',          link: '#how' },
          { label: 'Contact',      ariaLabel: 'Contact the team',            link: '#contact' },
        ]}
        socialItems={[
          { label: 'GitHub',   link: 'https://github.com' },
          { label: 'LinkedIn', link: 'https://linkedin.com' },
          { label: 'Twitter',  link: 'https://twitter.com' },
        ]}
      />

      {/* Pricing CTA bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto', marginTop: 14 }}>
          <button
            onClick={() => setPricingOpen(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(10,10,10,0.82)', backdropFilter: 'blur(12px)',
              border: '1px solid rgba(245,158,11,0.35)', borderRadius: 999,
              padding: '7px 20px', cursor: 'pointer', color: '#f59e0b',
              fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
              boxShadow: '0 2px 16px rgba(0,0,0,0.35)',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', boxShadow: '0 0 6px #f59e0b' }} />
            الباقات والأسعار
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      </div>

      {/* Section 1 — Primary Hero (BounceCards) */}
      <PrimaryHeroSection />

      {/* Islamic Factoring announcement bar */}
      <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '12px 0', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#059669', color: 'white', borderRadius: 999, padding: '4px 14px', fontSize: 12, fontWeight: 700 }}>
            <ShieldCheck size={12} /> Islamic Factoring
          </span>
          <span style={{ color: '#065f46', fontSize: 14, fontWeight: 600 }}>Madar does not lend &middot; we purchase your receivables for a flat 2.2% admin fee</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#d1fae5', color: '#065f46', borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
            <BadgeCheck size={12} /> 100% Riba-free
          </span>
        </div>
      </div>

      {/* Section 3 — Hero (Threads + Globe) */}
      <div className="relative" style={{ background: '#FFFFFF' }}>
        <HeroSection />
      </div>

      {/* Section 3 — Bento Grid (Capabilities) */}
      <BentoSection />

      {/* Section 4 — Showcase */}
      <ShowcaseSection />

      {/* Section 5 — FAQ */}
      <section style={{ background: '#fff', padding: '100px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px', display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 80, alignItems: 'start' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            style={{ position: 'sticky', top: 100 }}
          >
            <h2 style={{ fontFamily: "'Caveat', cursive", fontSize: 'clamp(3rem, 5vw, 4.5rem)', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.1, margin: 0 }}>
              Frequently asked<br />questions
            </h2>
            <p style={{ color: '#6b7280', fontSize: 15, marginTop: 16, lineHeight: 1.7, maxWidth: 320 }}>
              Everything you need to know about Madar and how it turns unpaid invoices into immediate liquidity.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <FAQSection />
          </motion.div>
        </div>
      </section>

      {/* Icon strip — tech stack + trust signals */}
      <div style={{ background: '#000', padding: '56px 0 48px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 48px' }}>
          <p style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', textAlign: 'center', marginBottom: 32 }}>Built with</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 28, alignItems: 'center' }}>
            {[
              { Icon: SiReact,             label: 'React 19',       color: '#61dafb' },
              { Icon: SiTypescript,         label: 'TypeScript',     color: '#3178c6' },
              { Icon: SiTailwindcss,         label: 'Tailwind v4',   color: '#38bdf8' },
              { Icon: SiVite,               label: 'Vite',           color: '#a78bfa' },
              { Icon: TbBrandFramerMotion,   label: 'Framer',         color: '#eb5757' },
              { Icon: SiGithub,             label: 'GitHub',         color: '#f0f6fc' },
              { Icon: BiChart,              label: 'Recharts',       color: '#f59e0b' },
              { Icon: FaShieldAlt,          label: 'ZenMux AI',      color: '#10b981' },
              { Icon: FaLock,               label: 'SHA-256',        color: '#94a3b8' },
              { Icon: FaLeaf,               label: 'Sharia',         color: '#4ade80' },
            ].map(({ Icon, label, color }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                <Icon size={26} color={color} style={{ opacity: 0.85 }} />
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.08em' }}>{label}</span>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.14)', fontSize: 11, marginTop: 40, fontFamily: "'DM Sans', sans-serif" }}>
            © 2026 Madar · Hackathon demo · Not a licensed financial service
          </p>
        </div>
      </div>

      {/* Section — Contact */}
      <ContactSection />

    </div>
  );
}

/* ── ContactSection ── */
function ContactSection() {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [message, setMessage] = useState('');
  const [status,  setStatus]  = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function handleSubmit() {
    if (!email.trim()) return;
    setStatus('loading');
    try {
      await api.post('/contact', {
        email:   email.trim(),
        name:    name.trim()    || undefined,
        message: message.trim() || undefined,
      });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: '12px 16px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 8,
    fontFamily: "'Geist Mono', monospace",
  };

  const green = '#4ade80';
  const greenDim = 'rgba(74,222,128,0.5)';

  return (
    <section style={{ background: '#000', padding: '100px 0 80px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 48px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'start' }}>

        {/* LEFT — Stepper form */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          style={{ position: 'relative' }}
        >
          {/* Top-left arrow */}
          <motion.svg
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.5 }}
            width="90" height="90" viewBox="0 0 90 90" fill="none"
            style={{ position: 'absolute', top: -70, left: -50, pointerEvents: 'none', overflow: 'visible' }}
          >
            <path d="M18 8 C 22 42, 52 55, 72 72" stroke={green} strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="5 4" />
            <path d="M63 76 L72 72 L68 62" stroke={green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </motion.svg>

          {/* Sparkle star */}
          <motion.svg
            animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            width="32" height="32" viewBox="0 0 32 32" fill="none"
            style={{ position: 'absolute', top: -50, right: -10, pointerEvents: 'none', overflow: 'visible' }}
          >
            <path d="M16 1 L18 12 L29 16 L18 20 L16 31 L14 20 L3 16 L14 12 Z" fill={greenDim} stroke={green} strokeWidth="0.8" />
          </motion.svg>

          {/* Vertical dashed line */}
          <motion.svg
            initial={{ opacity: 0, scaleY: 0 }}
            whileInView={{ opacity: 1, scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            width="16" height="120" viewBox="0 0 16 120" fill="none"
            style={{ position: 'absolute', top: 20, right: -52, pointerEvents: 'none', overflow: 'visible', transformOrigin: 'top' }}
          >
            <line x1="8" y1="0" x2="8" y2="100" stroke={green} strokeWidth="1.5" strokeDasharray="5 5" strokeLinecap="round" />
            <path d="M3 95 L8 105 L13 95" stroke={green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </motion.svg>

          {/* Bottom-left arrow */}
          <motion.svg
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.7 }}
            width="80" height="70" viewBox="0 0 80 70" fill="none"
            style={{ position: 'absolute', bottom: -60, left: -40, pointerEvents: 'none', overflow: 'visible' }}
          >
            <path d="M12 62 C 18 38, 44 22, 68 12" stroke={green} strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="5 4" />
            <path d="M58 8 L68 12 L64 22" stroke={green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </motion.svg>

          {/* Spinning circle */}
          <motion.svg
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            width="44" height="44" viewBox="0 0 44 44" fill="none"
            style={{ position: 'absolute', bottom: -40, right: -30, pointerEvents: 'none', overflow: 'visible' }}
          >
            <circle cx="22" cy="22" r="18" stroke={greenDim} strokeWidth="1.5" strokeDasharray="6 5" strokeLinecap="round" />
            <circle cx="22" cy="4" r="3" fill={green} />
          </motion.svg>

          {/* Floating dots */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', top: -20, right: -32, width: 7, height: 7, borderRadius: '50%', background: green, pointerEvents: 'none' }}
          />
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            style={{ position: 'absolute', top: 80, right: -44, width: 5, height: 5, borderRadius: '50%', background: greenDim, pointerEvents: 'none' }}
          />

          {/* Form */}
          {status === 'success' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14, padding: '48px 8px' }}
            >
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p style={{ color: '#4ade80', fontSize: 18, fontWeight: 700, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>Sent successfully!</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>We'll reach out to you shortly at your email address.</p>
              <button
                onClick={() => { setStatus('idle'); setName(''); setEmail(''); setMessage(''); }}
                style={{ marginTop: 4, background: 'none', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
              >
                Send another
              </button>
            </motion.div>
          ) : (
            <Stepper
              backButtonText="Back"
              nextButtonText="Continue"
              onFinalStepCompleted={handleSubmit}
              nextButtonProps={{ disabled: status === 'loading' }}
            >
              <Step>
                <p style={labelStyle}>Step 1 of 3</p>
                <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: '0 0 6px', fontFamily: "'DM Sans', sans-serif" }}>What's your name?</h3>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, margin: '0 0 20px', fontFamily: "'DM Sans', sans-serif" }}>Optional — helps us address you personally.</p>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mohammed Al-Abri" style={inputStyle} autoFocus />
              </Step>
              <Step>
                <p style={labelStyle}>Step 2 of 3</p>
                <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: '0 0 6px', fontFamily: "'DM Sans', sans-serif" }}>What's your email?</h3>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, margin: '0 0 20px', fontFamily: "'DM Sans', sans-serif" }}>We'll send you a demo link and invoice analysis sample.</p>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@company.com" style={inputStyle} autoFocus />
              </Step>
              <Step>
                <p style={labelStyle}>Step 3 of 3</p>
                <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: '0 0 6px', fontFamily: "'DM Sans', sans-serif" }}>Tell us about your project</h3>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, margin: '0 0 20px', fontFamily: "'DM Sans', sans-serif" }}>Optional — describe your freelance work and invoicing challenges.</p>
                <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="e.g. I have 7 pending invoices totaling SAR 23,000 and need liquidity within 10 days..." rows={4} style={{ ...inputStyle, resize: 'none', minHeight: 110 }} autoFocus />
                {status === 'error' && (
                  <p style={{ color: '#f87171', fontSize: 13, margin: '10px 0 0', fontFamily: "'DM Sans', sans-serif" }}>Something went wrong, please try again.</p>
                )}
              </Step>
            </Stepper>
          )}
        </motion.div>

        {/* RIGHT — heading */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          style={{ position: 'sticky', top: 100 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <svg width="36" height="14" viewBox="0 0 36 14" fill="none">
              <path d="M36 7 L6 7" stroke="#4ade80" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="3 3" />
              <path d="M10 3 L4 7 L10 11" stroke="#4ade80" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase' }}>Get in touch</span>
          </div>
          <h2 style={{ fontFamily: "'Caveat', cursive", fontSize: 'clamp(3rem, 5vw, 4.5rem)', fontWeight: 700, color: '#fff', lineHeight: 1.1, margin: '0 0 20px' }}>
            Unpaid<br />invoices?<br />Get liquidity.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 15, lineHeight: 1.8, maxWidth: 340, margin: '0 0 36px' }}>
            Leave your details and we'll show you how Madar turns invoices into instant cash with multi-agent AI.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {['3-Agent AI Pipeline', 'Real-time Risk Scoring', 'Bank-Ready PDF Reports'].map(text => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={14} color="#4ade80" />
                <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 17, fontFamily: "'Caveat', cursive" }}>{text}</span>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  );
}

/* ── PricingModal ── */
const PLANS = [
  {
    name: 'Starter',
    tag: 'للأفراد',
    price: 'مجاني',
    sub: 'دائماً مجاني',
    color: '#94a3b8',
    glow: 'rgba(148,163,184,0.12)',
    border: 'rgba(148,163,184,0.18)',
    features: [
      { text: '3 فواتير شهرياً', included: true },
      { text: 'تقرير PDF أساسي', included: true },
      { text: 'نقاط ائتمان فورية', included: true },
      { text: 'دعم بريد إلكتروني', included: true },
      { text: 'وكلاء AI كاملة', included: false },
      { text: 'تكامل بنكي', included: false },
    ],
    cta: 'ابدأ مجاناً',
    popular: false,
  },
  {
    name: 'Growth',
    tag: 'للمستقلين',
    price: '49',
    currency: 'ر.ع.',
    sub: 'شهرياً · لا عقود',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.13)',
    border: 'rgba(245,158,11,0.45)',
    features: [
      { text: '25 فاتورة شهرياً', included: true },
      { text: 'تقارير PDF احترافية', included: true },
      { text: 'نقاط ائتمان متقدمة', included: true },
      { text: 'دعم أولوية', included: true },
      { text: '3 وكلاء AI كاملة', included: true },
      { text: 'تكامل بنكي', included: false },
    ],
    cta: 'ابدأ الآن',
    popular: true,
  },
  {
    name: 'Enterprise',
    tag: 'للشركات',
    price: 'مخصص',
    sub: 'تسعير حسب الحجم',
    color: '#34d399',
    glow: 'rgba(52,211,153,0.12)',
    border: 'rgba(52,211,153,0.3)',
    features: [
      { text: 'فواتير غير محدودة', included: true },
      { text: 'تقارير مخصصة', included: true },
      { text: 'نقاط ائتمان متقدمة', included: true },
      { text: 'مدير حساب مخصص', included: true },
      { text: '3 وكلاء AI كاملة', included: true },
      { text: 'تكامل بنكي مباشر', included: true },
    ],
    cta: 'تواصل معنا',
    popular: false,
  },
] as const;

function PricingModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(14px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, #111114 0%, #0c0c10 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 24, width: '100%', maxWidth: 920,
          padding: '52px 44px 44px', position: 'relative',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
          overflowY: 'auto', maxHeight: '90vh',
        }}
      >
        {/* Ambient glow top-center */}
        <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 320, height: 120, background: 'radial-gradient(ellipse at center, rgba(245,158,11,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Close */}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', transition: 'background 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
        >
          <X size={15} />
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 999, padding: '4px 14px', fontSize: 11, fontWeight: 600, color: '#f59e0b', fontFamily: "'Geist Mono', monospace", letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 18 }}>
            الباقات والأسعار
          </span>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(1.7rem, 3.5vw, 2.4rem)', fontWeight: 800, color: '#fff', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
            ابدأ اليوم. كبّر بالسرعة التي تريد.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 14, fontFamily: "'DM Sans', sans-serif", margin: 0 }}>
            رسوم إدارية 2.2% فقط على كل فاتورة · لا فوائد · متوافق مع الشريعة الإسلامية
          </p>
        </div>

        {/* Plans grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.35, ease: 'easeOut' }}
              style={{
                position: 'relative',
                background: plan.popular
                  ? `linear-gradient(145deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.04) 100%)`
                  : `linear-gradient(145deg, ${plan.glow} 0%, rgba(0,0,0,0) 100%)`,
                border: `1px solid ${plan.border}`,
                borderRadius: 18,
                padding: '32px 26px 26px',
                display: 'flex', flexDirection: 'column',
                boxShadow: plan.popular ? `0 0 40px rgba(245,158,11,0.08)` : 'none',
              }}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div style={{
                  position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                  background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                  color: '#000', fontSize: 11, fontWeight: 800, borderRadius: 999,
                  padding: '4px 16px', fontFamily: "'DM Sans', sans-serif",
                  whiteSpace: 'nowrap', letterSpacing: '0.04em',
                  boxShadow: '0 4px 12px rgba(245,158,11,0.4)',
                }}>
                  ⭐ الأكثر شعبية
                </div>
              )}

              {/* Plan header */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 700, color: plan.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{plan.name}</span>
                  <span style={{ background: `${plan.glow}`, border: `1px solid ${plan.border}`, borderRadius: 999, padding: '2px 10px', fontSize: 11, color: plan.color, fontFamily: "'DM Sans', sans-serif" }}>{plan.tag}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                  {'currency' in plan ? (
                    <>
                      <span style={{ fontSize: 38, fontWeight: 900, color: '#fff', fontFamily: "'DM Sans', sans-serif", lineHeight: 1 }}>{plan.price}</span>
                      <span style={{ fontSize: 16, color: plan.color, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>{plan.currency}</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 32, fontWeight: 900, color: '#fff', fontFamily: "'DM Sans', sans-serif", lineHeight: 1 }}>{plan.price}</span>
                  )}
                </div>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{plan.sub}</p>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${plan.border}, transparent)`, marginBottom: 20 }} />

              {/* Features */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, flex: 1, marginBottom: 28 }}>
                {plan.features.map(f => (
                  <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {f.included ? (
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: `rgba(${plan.color === '#f59e0b' ? '245,158,11' : plan.color === '#34d399' ? '52,211,153' : '148,163,184'},0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2 6 5 9 10 3" stroke={plan.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    ) : (
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><line x1="2" y1="2" x2="8" y2="8" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round"/><line x1="8" y1="2" x2="2" y2="8" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </div>
                    )}
                    <span style={{ color: f.included ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.22)', fontSize: 13, fontFamily: "'DM Sans', sans-serif", textDecoration: f.included ? 'none' : 'line-through' }}>{f.text}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 12,
                  border: plan.popular ? 'none' : `1px solid ${plan.border}`,
                  background: plan.popular
                    ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'
                    : `rgba(255,255,255,0.04)`,
                  color: plan.popular ? '#000' : '#fff',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: '0.02em',
                  boxShadow: plan.popular ? '0 4px 20px rgba(245,158,11,0.35)' : 'none',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = plan.popular ? '0 8px 28px rgba(245,158,11,0.45)' : '0 4px 16px rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = plan.popular ? '0 4px 20px rgba(245,158,11,0.35)' : 'none'; }}
              >
                {plan.cta}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Footer trust row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 32, flexWrap: 'wrap' }}>
          {['🔐 تشفير SHA-256', '☪️ متوافق مع الشريعة', '🏦 مراجعة بنكية فورية', '🚫 لا ربا'].map(item => (
            <span key={item} style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>{item}</span>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
