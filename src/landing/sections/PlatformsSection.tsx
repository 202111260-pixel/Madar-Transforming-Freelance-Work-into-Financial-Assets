/**
 * PlatformsSection — animated dual-row marquee of all connected platform logos
 * Row 1: left → right | Row 2: right → left
 * Used between PrimaryHeroSection and HeroSection on the landing page.
 */
import { motion } from 'framer-motion';
import {
  SiFiverr, SiNotion, SiTelegram, SiGithub,
  SiUpwork, SiWhatsapp, SiSlack, SiTrello,
  SiSalla, SiFreelancer, SiToptal, SiPaypal, SiStripe,
  SiWise, SiPayoneer, SiFigma, SiBehance, SiDribbble,
  SiCanva, SiYoutube, SiMedium, SiSubstack, SiClickup,
  SiAsana, SiAirtable, SiVercel, SiNetlify, SiWebflow,
  SiWix, SiShopify, SiWoo, SiGmail,
} from 'react-icons/si';
import { FaLinkedin, FaPatreon, FaEtsy, FaBuilding, FaUniversity } from 'react-icons/fa';

interface PlatformItem {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

const ALL_PLATFORMS: PlatformItem[] = [
  { label: 'Upwork',       icon: <SiUpwork size={28} />,      color: '#14a800', bg: '#f0fdf4' },
  { label: 'Fiverr',       icon: <SiFiverr size={28} />,      color: '#1dbf73', bg: '#f0fdf4' },
  { label: 'Freelancer',   icon: <SiFreelancer size={28} />,  color: '#29b2fe', bg: '#eff6ff' },
  { label: 'Toptal',       icon: <SiToptal size={28} />,      color: '#3863ab', bg: '#eff6ff' },
  { label: 'Mostaql',      icon: <span style={{ fontWeight: 900, fontSize: 18 }}>MS</span>, color: '#7c3aed', bg: '#f5f3ff' },
  { label: 'Khamsat',      icon: <span style={{ fontWeight: 900, fontSize: 18 }}>KH</span>, color: '#d97706', bg: '#fffbeb' },
  { label: 'Ureed',        icon: <span style={{ fontWeight: 900, fontSize: 18 }}>UR</span>, color: '#0369a1', bg: '#f0f9ff' },
  { label: 'Salla',        icon: <SiSalla size={28} />,        color: '#5b21b6', bg: '#f5f3ff' },
  { label: 'Figma',        icon: <SiFigma size={28} />,        color: '#f24e1e', bg: '#fff5f5' },
  { label: 'Behance',      icon: <SiBehance size={28} />,      color: '#0057ff', bg: '#eff6ff' },
  { label: 'Dribbble',     icon: <SiDribbble size={28} />,     color: '#ea4c89', bg: '#fff0f6' },
  { label: 'Canva',        icon: <SiCanva size={28} />,        color: '#00c4cc', bg: '#f0fffe' },
  { label: 'YouTube',      icon: <SiYoutube size={28} />,      color: '#ff0000', bg: '#fff5f5' },
  { label: 'Medium',       icon: <SiMedium size={28} />,       color: '#000000', bg: '#f9f9f9' },
  { label: 'Substack',     icon: <SiSubstack size={28} />,     color: '#ff6719', bg: '#fff5f0' },
  { label: 'Patreon',      icon: <FaPatreon size={28} />,      color: '#ff424d', bg: '#fff5f5' },
  { label: 'Shopify',      icon: <SiShopify size={28} />,      color: '#96bf48', bg: '#f5faf0' },
  { label: 'WooCommerce',  icon: <SiWoo size={28} />,          color: '#96588a', bg: '#fdf4ff' },
  { label: 'Etsy',         icon: <FaEtsy size={28} />,         color: '#f16521', bg: '#fff5f0' },
  { label: 'Wix',          icon: <SiWix size={28} />,          color: '#0c6efc', bg: '#eff6ff' },
  { label: 'Notion',       icon: <SiNotion size={28} />,       color: '#000000', bg: '#f8f8f8' },
  { label: 'Telegram',     icon: <SiTelegram size={28} />,     color: '#26a5e4', bg: '#eff9ff' },
  { label: 'Slack',        icon: <SiSlack size={28} />,        color: '#4a154b', bg: '#fdf4ff' },
  { label: 'Trello',       icon: <SiTrello size={28} />,       color: '#0052cc', bg: '#eff6ff' },
  { label: 'ClickUp',      icon: <SiClickup size={28} />,      color: '#7b68ee', bg: '#f5f3ff' },
  { label: 'Asana',        icon: <SiAsana size={28} />,        color: '#f06a6a', bg: '#fff5f5' },
  { label: 'Airtable',     icon: <SiAirtable size={28} />,     color: '#18bfff', bg: '#eff9ff' },
  { label: 'GitHub',       icon: <SiGithub size={28} />,       color: '#24292e', bg: '#f6f8fa' },
  { label: 'Vercel',       icon: <SiVercel size={28} />,       color: '#000000', bg: '#f8f8f8' },
  { label: 'Netlify',      icon: <SiNetlify size={28} />,      color: '#00c7b7', bg: '#f0fffe' },
  { label: 'Webflow',      icon: <SiWebflow size={28} />,      color: '#4353ff', bg: '#f0f0ff' },
  { label: 'PayPal',       icon: <SiPaypal size={28} />,       color: '#003087', bg: '#eff6ff' },
  { label: 'Stripe',       icon: <SiStripe size={28} />,       color: '#635bff', bg: '#f5f3ff' },
  { label: 'Wise',         icon: <SiWise size={28} />,         color: '#48c75b', bg: '#f0fdf4' },
  { label: 'Payoneer',     icon: <SiPayoneer size={28} />,     color: '#ff4800', bg: '#fff5f0' },
  { label: 'LinkedIn',     icon: <FaLinkedin size={28} />,     color: '#0a66c2', bg: '#eff6ff' },
  { label: 'Gmail',        icon: <SiGmail size={28} />,        color: '#ea4335', bg: '#fff5f5' },
  { label: 'WhatsApp',     icon: <SiWhatsapp size={28} />,     color: '#25d366', bg: '#f0fdf4' },
];

// Split into two rows
const ROW1 = ALL_PLATFORMS.slice(0, 19);
const ROW2 = ALL_PLATFORMS.slice(19);

// Duplicate for seamless loop
const ROW1_DUP = [...ROW1, ...ROW1];
const ROW2_DUP = [...ROW2, ...ROW2];

function PlatformCard({ p }: { p: PlatformItem }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 8, padding: '16px 20px', borderRadius: 16, minWidth: 110,
      background: '#fff',
      border: '1.5px solid rgba(0,0,0,0.07)',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      <div style={{ color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, background: p.bg }}>
        {p.icon}
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', letterSpacing: '0.02em', textAlign: 'center', whiteSpace: 'nowrap' }}>
        {p.label}
      </span>
    </div>
  );
}

/* CSS marquee via keyframes injected once */
const STYLE_ID = 'platforms-marquee-styles';
function injectStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes marquee-ltr {
      0%   { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    @keyframes marquee-rtl {
      0%   { transform: translateX(-50%); }
      100% { transform: translateX(0); }
    }
    .marquee-ltr { animation: marquee-ltr 45s linear infinite; }
    .marquee-ltr:hover { animation-play-state: paused; }
    .marquee-rtl { animation: marquee-rtl 40s linear infinite; }
    .marquee-rtl:hover { animation-play-state: paused; }
  `;
  document.head.appendChild(s);
}

export function PlatformsSection() {
  injectStyles();

  return (
    <section style={{ background: '#fafafa', padding: '80px 0 72px', overflow: 'hidden', position: 'relative' }}>
      {/* Soft gradient edges */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
        background: 'linear-gradient(to right, #fafafa 0%, transparent 12%, transparent 88%, #fafafa 100%)' }} />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.55 }}
          style={{ textAlign: 'center', marginBottom: 48 }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(124,58,237,0.08)', border: '1.5px solid rgba(124,58,237,0.2)',
            borderRadius: 999, padding: '6px 18px', marginBottom: 20,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c3aed', display: 'inline-block',
              boxShadow: '0 0 0 3px rgba(124,58,237,0.25)' }} />
            <span style={{ color: '#7c3aed', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              40+ Integrations
            </span>
          </div>

          <h2 style={{ margin: 0, fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, color: '#111827',
            letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            Connect Every Platform<br />
            <span style={{ color: '#7c3aed' }}>You Already Work On</span>
          </h2>
          <p style={{ margin: '16px auto 0', fontSize: 16, color: '#6b7280', maxWidth: 520, lineHeight: 1.7 }}>
            Arab & global freelance platforms, creative tools, e-commerce stores, finance apps —
            Madar pulls your revenue data automatically.
          </p>
        </motion.div>
      </div>

      {/* Row 1 — left to right */}
      <div style={{ overflow: 'hidden', marginBottom: 16 }}>
        <div className="marquee-ltr" style={{ display: 'flex', gap: 12, width: 'max-content', paddingLeft: 12 }}>
          {ROW1_DUP.map((p, i) => <PlatformCard key={i} p={p} />)}
        </div>
      </div>

      {/* Row 2 — right to left */}
      <div style={{ overflow: 'hidden' }}>
        <div className="marquee-rtl" style={{ display: 'flex', gap: 12, width: 'max-content', paddingLeft: 12 }}>
          {ROW2_DUP.map((p, i) => <PlatformCard key={i} p={p} />)}
        </div>
      </div>

      {/* Stat bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        style={{ display: 'flex', justifyContent: 'center', gap: 48, marginTop: 48, flexWrap: 'wrap' }}
      >
        {[
          { n: '40+', label: 'Platforms' },
          { n: '9',   label: 'Currencies' },
          { n: '1-click', label: 'Connect' },
          { n: 'Real-time', label: 'Sync' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#111827', letterSpacing: '-0.02em' }}>{s.n}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</div>
          </div>
        ))}
      </motion.div>
    </section>
  );
}
