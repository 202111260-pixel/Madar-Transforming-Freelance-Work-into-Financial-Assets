/**
 * ConnectionsPage — Madar v2
 * 43 platforms — freelance (Arab & global), creative, eCommerce, productivity, dev & finance
 * Icons: react-icons only (no CDN = always visible)
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSynergyStore } from '../lib/useSynergyStore';
import ThemeToggle from '../components/ThemeToggle';
import UnifiedScoreCard from '../components/UnifiedScoreCard';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SiGmail, SiFiverr, SiNotion, SiTelegram, SiGithub,
  SiUpwork, SiWhatsapp, SiEthereum, SiSlack, SiTrello,
  SiSalla, SiFreelancer, SiToptal, SiPaypal, SiStripe,
  SiWise, SiPayoneer, SiFigma, SiBehance, SiDribbble,
  SiCanva, SiYoutube, SiMedium, SiSubstack, SiClickup,
  SiAsana, SiAirtable, SiVercel, SiNetlify, SiWebflow,
  SiWix, SiShopify, SiWoo,
} from 'react-icons/si';
import { FaLinkedin, FaPatreon, FaEtsy } from 'react-icons/fa';
import {
  Brain, BarChart3, Link2, Droplets, CreditCard, Activity,
  Sparkles, X, CheckCircle2, AlertCircle, Eye, EyeOff,
  Loader2, DollarSign, Settings, Code2, PenLine,
  Building2, ExternalLink, Copy, RefreshCw, Wallet, Globe,
  KeyRound, Zap, Mail, TrendingUp,
  Search, Filter, Star, Briefcase,
  FileText, ArrowRight, Plug, ShoppingCart, Palette,
  AlertTriangle, ShieldCheck, ChevronDown, ChevronRight,
  Upload, Trash2, FileCheck2,
} from 'lucide-react';
import {
  getBehavioralReport, trustBand, signalKindLabel,
  type TrustSignal, type BehavioralReport,
} from '../lib/behavioralAnalysis';
import { detectHomeCurrency, toHomeCurrency, homeCurrencySymbol } from '../lib/homeCurrency';
import { sendEmail } from '../lib/sendgridEmail';

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string; scope: string;
            callback: (r: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      isMetaMask?: boolean;
    };
  }
}

const CREAM = 'var(--cream)', CARD = 'var(--card)', BORDER = 'var(--border)';
const TEXT = 'var(--text)', TEXT2 = 'var(--text2)', TEXT3 = 'var(--text3)', ACCENT = 'var(--accent)';

const NAV = [
  { icon: BarChart3,    label: 'Dashboard',    path: '/' },
  { icon: Link2,        label: 'Connections',  path: '/connections', active: true },
  { icon: Droplets,     label: 'Liquidity',    path: '/liquidity' },
  { icon: Brain,        label: 'AI Room',      path: '/room' },
  { icon: CreditCard,   label: 'Credit',       path: '/credit' },
  { icon: PenLine,      label: 'Manual Entry', path: '/manual' },
  { icon: Activity,     label: 'Activity',     path: '/activity' },
];

const STORE = 'synergy_connections_v4';
type ConnStatus = 'idle' | 'testing' | 'connected' | 'error';
interface InvoiceProof {
  id: string;
  name: string;
  sizeKB: number;
  uploadedAt: number;
  dataUrl?: string;
  verified: boolean;
  mismatch?: boolean;
  clientName?: string;
  amountSAR?: number;
}
interface ConnState {
  status: ConnStatus; meta: Record<string, string>;
  err?: string; connectedAt?: number;
  monthlyRevenueSAR?: number;   // user-declared actual income — boosts credit score
  verifiedProof?: boolean;      // bridge proof flag consumed by scoreEngine
  invoiceProofs?: InvoiceProof[];
}

/**
 * Stable per-platform revenue seed (deterministic from id) — used when the
 * user connects a platform whose `monthlyAvgSAR` is 0 (productivity / dev /
 * utility tools). Without this, connecting such a platform only nudges the
 * "count" subscore by ~1.75 pts and the customer thinks the score is broken.
 * Range 1200–3600 SAR is intentionally modest so it never dominates true
 * declared revenue from earnings platforms.
 */
function stableRevenueSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  const norm = Math.abs(h) % 2400;       // 0..2399
  return 1200 + norm;                     // 1200..3599
}
type StoreMap = Record<string, ConnState>;
function loadStore(): StoreMap { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } }
function saveStore(m: StoreMap) {
  try {
    localStorage.setItem(STORE, JSON.stringify(m));
    // Broadcast so the Synergy Score, dashboards and credit panel recompute
    // live whenever a platform is connected, disconnected, or its monthly
    // revenue is edited. Without this, the UnifiedScoreCard stays frozen.
    window.dispatchEvent(new Event('synergy:store-changed'));
  } catch { /**/ }
}
function timeAgo(ts: number) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function TextBadge({ text, color }: { text: string; color: string }) {
  return (
    <span className="inline-flex items-center justify-center font-black rounded-xl text-white"
      style={{ background: color, minWidth: 40, height: 40, fontSize: 11, padding: '0 6px', letterSpacing: '0.5px' }}>
      {text}
    </span>
  );
}

type Category = 'all' | 'freelance_arab' | 'freelance_global' | 'creative' | 'ecommerce' | 'productivity' | 'dev' | 'finance';

const CATEGORIES: { id: Category; label: string; icon: React.ElementType }[] = [
  { id: 'all',              label: 'All',              icon: Globe       },
  { id: 'freelance_arab',   label: 'Arab Freelance',   icon: Star        },
  { id: 'freelance_global', label: 'Global Freelance', icon: Briefcase   },
  { id: 'creative',         label: 'Creative',         icon: Palette     },
  { id: 'ecommerce',        label: 'eCommerce',        icon: ShoppingCart},
  { id: 'productivity',     label: 'Productivity',     icon: FileText    },
  { id: 'dev',              label: 'Dev & Tech',       icon: Code2       },
  { id: 'finance',          label: 'Finance',          icon: DollarSign  },
];

interface SourceDef {
  id: string; name: string; desc: string;
  logo: React.ReactNode; color: string; bg: string;
  category: Exclude<Category, 'all'>;
  inputType: 'none' | 'api_key' | 'oauth_google' | 'metamask' | 'webhook' | 'always_on';
  inputLabel?: string; inputPlaceholder?: string;
  setupUrl?: string; setupSteps?: string[];
  monthlyAvgSAR?: number; users?: string;
}

const SOURCES: SourceDef[] = [
  /* ─── Arab Freelance ─── */
  {
    id: 'mostaqel', name: 'Mostaql', desc: '#1 Arab platform for freelance projects & services',
    logo: <TextBadge text="MS" color="#7c3aed" />, color: '#7c3aed', bg: '#f5f3ff',
    category: 'freelance_arab', inputType: 'api_key',
    inputLabel: 'API Key', inputPlaceholder: 'mstql_••••••••••',
    setupUrl: 'https://developers.mostaql.com',
    setupSteps: ['Go to developers.mostaql.com', 'Sign in to your account', 'Click "Create New API Key"', 'Copy and paste it here'],
    monthlyAvgSAR: 3500, users: '+500K freelancers',
  },
  {
    id: 'khamsat', name: 'Khamsat', desc: 'Micro-services marketplace — developers, designers & writers',
    logo: <TextBadge text="KH" color="#d97706" />, color: '#d97706', bg: '#fffbeb',
    category: 'freelance_arab', inputType: 'api_key',
    inputLabel: 'API Key', inputPlaceholder: 'khmst_••••••••••',
    setupUrl: 'https://khamsat.com/user/settings/api',
    setupSteps: ['Go to khamsat.com', 'Settings → API', 'Copy your API key'],
    monthlyAvgSAR: 1800, users: '+300K users',
  },
  {
    id: 'ureed', name: 'Ureed', desc: 'Arab platform for writers, translators & content creators',
    logo: <TextBadge text="UR" color="#0369a1" />, color: '#0369a1', bg: '#f0f9ff',
    category: 'freelance_arab', inputType: 'api_key',
    inputLabel: 'API Token', inputPlaceholder: 'ureed_••••••••••',
    setupUrl: 'https://www.ureed.com',
    setupSteps: ['Sign in to ureed.com', 'Profile → Developers', 'Create a new token'],
    monthlyAvgSAR: 2000, users: '+200K writers',
  },
  {
    id: 'salla', name: 'Salla', desc: 'Revenue from your Arab e-commerce store',
    logo: <SiSalla size={28} style={{ color: '#5b21b6' }} />, color: '#5b21b6', bg: '#f5f3ff',
    category: 'freelance_arab', inputType: 'api_key',
    inputLabel: 'Access Token', inputPlaceholder: 'salla_••••••••••••••',
    setupUrl: 'https://docs.salla.dev',
    setupSteps: ['Open Salla Dashboard', 'Settings → API Apps', 'Create a new app', 'Copy the Access Token'],
    monthlyAvgSAR: 5000, users: '+100K stores',
  },
  {
    id: 'nabbesh', name: 'Nabbesh', desc: 'Freelance opportunities across the Arab world',
    logo: <TextBadge text="NB" color="#be123c" />, color: '#be123c', bg: '#fff1f2',
    category: 'freelance_arab', inputType: 'webhook',
    inputLabel: 'Webhook URL', inputPlaceholder: 'https://nabbesh.com/hook/••••',
    setupUrl: 'https://www.nabbesh.com',
    setupSteps: ['Sign in to nabbesh.com', 'Settings → Integrations', 'Copy the Webhook URL'],
    monthlyAvgSAR: 2500, users: '+80K professionals',
  },

  /* ─── Global Freelance ─── */
  {
    id: 'upwork', name: 'Upwork', desc: "World's largest freelancing marketplace",
    logo: <SiUpwork size={28} style={{ color: '#14a800' }} />, color: '#14a800', bg: '#f0fdf4',
    category: 'freelance_global', inputType: 'api_key',
    inputLabel: 'Personal Access Token', inputPlaceholder: 'oauth2v2_••••••••••',
    setupUrl: 'https://www.upwork.com/developer/keys/apply',
    setupSteps: ['Go to upwork.com/developer/keys', 'Click "Request API access"', 'After approval, copy your Personal Access Token'],
    monthlyAvgSAR: 7500, users: '+12M freelancers',
  },
  {
    id: 'fiverr', name: 'Fiverr', desc: 'Micro-services — designers, developers & marketers',
    logo: <SiFiverr size={28} style={{ color: '#1DBF73' }} />, color: '#1DBF73', bg: '#f0fdf4',
    category: 'freelance_global', inputType: 'api_key',
    inputLabel: 'Personal Token', inputPlaceholder: 'fvr_••••••••••',
    setupUrl: 'https://www.fiverr.com/settings/security',
    setupSteps: ['Open Fiverr Settings', 'Security → API Tokens', 'Create a new access token'],
    monthlyAvgSAR: 4500, users: '+3M sellers',
  },
  {
    id: 'freelancer', name: 'Freelancer', desc: 'Tech, design & writing projects worldwide',
    logo: <SiFreelancer size={28} style={{ color: '#29B2FE' }} />, color: '#29B2FE', bg: '#eff6ff',
    category: 'freelance_global', inputType: 'api_key',
    inputLabel: 'OAuth Token', inputPlaceholder: 'flr_••••••••••',
    setupUrl: 'https://accounts.freelancer.com/settings/api',
    setupSteps: ['Go to freelancer.com Settings', 'Developer → OAuth Tokens', 'Create a new token'],
    monthlyAvgSAR: 3800, users: '+50M users',
  },
  {
    id: 'toptal', name: 'Toptal', desc: 'Top earnings — for elite developers & designers',
    logo: <SiToptal size={28} style={{ color: '#3863AB' }} />, color: '#3863AB', bg: '#eff6ff',
    category: 'freelance_global', inputType: 'api_key',
    inputLabel: 'API Key', inputPlaceholder: 'tt_••••••••••',
    setupUrl: 'https://developers.toptal.com',
    setupSteps: ['toptal.com → Developer Settings', 'API Keys → Create a new key'],
    monthlyAvgSAR: 15000, users: 'Elite only',
  },
  {
    id: 'peopleperhour', name: 'PeoplePerHour', desc: 'Hourly & fixed-price freelance projects from the UK & EU',
    logo: <Globe size={28} style={{ color: '#f97316' }} />, color: '#f97316', bg: '#fff7ed',
    category: 'freelance_global', inputType: 'api_key',
    inputLabel: 'API Key', inputPlaceholder: 'pph_••••••••••',
    setupUrl: 'https://www.peopleperhour.com/site/api',
    setupSteps: ['Sign in to peopleperhour.com', 'Account → API Access', 'Generate your API key'],
    monthlyAvgSAR: 3000, users: '+3M freelancers',
  },
  {
    id: 'guru', name: 'Guru', desc: 'Professional freelance work & team collaboration',
    logo: <TextBadge text="GU" color="#0891b2" />, color: '#0891b2', bg: '#ecfeff',
    category: 'freelance_global', inputType: 'api_key',
    inputLabel: 'API Key', inputPlaceholder: 'guru_••••••••••',
    setupUrl: 'https://www.guru.com/api',
    setupSteps: ['Sign in to guru.com', 'Settings → API Tokens', 'Generate API token'],
    monthlyAvgSAR: 2200, users: '+800K freelancers',
  },

  /* ─── Creative ─── */
  {
    id: 'figma', name: 'Figma', desc: 'Design projects & client deliverables — track your income',
    logo: <SiFigma size={28} style={{ color: '#F24E1E' }} />, color: '#F24E1E', bg: '#fff5f5',
    category: 'creative', inputType: 'api_key',
    inputLabel: 'Personal Access Token', inputPlaceholder: 'figd_••••••••••',
    setupUrl: 'https://www.figma.com/settings',
    setupSteps: ['figma.com → Account Settings', 'Personal Access Tokens → Generate new token', 'Copy the token'],
    monthlyAvgSAR: 0, users: '+4M designers',
  },
  {
    id: 'behance', name: 'Behance', desc: 'Showcase your portfolio & attract design clients',
    logo: <SiBehance size={28} style={{ color: '#0057FF' }} />, color: '#0057FF', bg: '#eff6ff',
    category: 'creative', inputType: 'api_key',
    inputLabel: 'API Key', inputPlaceholder: 'bhc_••••••••••',
    setupUrl: 'https://www.behance.net/dev',
    setupSteps: ['behance.net/dev → Register App', 'Get your API key', 'Paste it here'],
    monthlyAvgSAR: 0, users: '+10M creatives',
  },
  {
    id: 'dribbble', name: 'Dribbble', desc: 'Design community — showcase work & get hired',
    logo: <SiDribbble size={28} style={{ color: '#EA4C89' }} />, color: '#EA4C89', bg: '#fff0f6',
    category: 'creative', inputType: 'api_key',
    inputLabel: 'Access Token', inputPlaceholder: 'drb_••••••••••',
    setupUrl: 'https://dribbble.com/account/applications/new',
    setupSteps: ['dribbble.com/account/applications → New App', 'Copy the Access Token'],
    monthlyAvgSAR: 0, users: '+10M designers',
  },
  {
    id: 'canva', name: 'Canva', desc: 'Design templates & sell your creative services',
    logo: <SiCanva size={28} style={{ color: '#00C4CC' }} />, color: '#00C4CC', bg: '#f0fffe',
    category: 'creative', inputType: 'api_key',
    inputLabel: 'API Token', inputPlaceholder: 'cnv_••••••••••',
    setupUrl: 'https://www.canva.com/developers',
    setupSteps: ['canva.com/developers → Create App', 'Generate API Token'],
    monthlyAvgSAR: 0, users: '+150M users',
  },
  {
    id: 'youtube', name: 'YouTube', desc: 'Monetise video content — ads, memberships & sponsorships',
    logo: <SiYoutube size={28} style={{ color: '#FF0000' }} />, color: '#FF0000', bg: '#fff5f5',
    category: 'creative', inputType: 'oauth_google',
    setupUrl: 'https://console.cloud.google.com',
    setupSteps: ['Google Cloud → YouTube Data API v3', 'Create OAuth credentials', 'Sign in with Google to link your channel'],
    monthlyAvgSAR: 5000, users: '+2B viewers',
  },
  {
    id: 'medium', name: 'Medium', desc: 'Earn from writing — Partner Program & paid subscribers',
    logo: <SiMedium size={28} style={{ color: '#000000' }} />, color: '#000000', bg: '#f9f9f9',
    category: 'creative', inputType: 'api_key',
    inputLabel: 'Integration Token', inputPlaceholder: 'medium_••••••••••',
    setupUrl: 'https://medium.com/me/settings',
    setupSteps: ['medium.com → Settings', 'Security → Integration Tokens', 'Generate a new token'],
    monthlyAvgSAR: 800, users: '+100M readers',
  },
  {
    id: 'substack', name: 'Substack', desc: 'Paid newsletters — recurring revenue from subscribers',
    logo: <SiSubstack size={28} style={{ color: '#FF6719' }} />, color: '#FF6719', bg: '#fff5f0',
    category: 'creative', inputType: 'webhook',
    inputLabel: 'Webhook URL', inputPlaceholder: 'https://substack.com/api/••••',
    setupUrl: 'https://substack.com',
    setupSteps: ['substack.com → Settings → Integrations', 'Copy your webhook endpoint'],
    monthlyAvgSAR: 1500, users: '+35M subscribers',
  },
  {
    id: 'patreon', name: 'Patreon', desc: 'Monthly memberships — fans fund your creative work',
    logo: <FaPatreon size={28} style={{ color: '#FF424D' }} />, color: '#FF424D', bg: '#fff5f5',
    category: 'creative', inputType: 'api_key',
    inputLabel: 'Creator Access Token', inputPlaceholder: 'pat_••••••••••',
    setupUrl: 'https://www.patreon.com/portal/registration/register-clients',
    setupSteps: ['patreon.com/portal → Clients & API', 'Register a new client', 'Copy Creator Access Token'],
    monthlyAvgSAR: 2000, users: '+8M creators',
  },

  /* ─── eCommerce ─── */
  {
    id: 'shopify', name: 'Shopify', desc: 'Full-featured online store — track your store revenue',
    logo: <SiShopify size={28} style={{ color: '#96bf48' }} />, color: '#96bf48', bg: '#f5faf0',
    category: 'ecommerce', inputType: 'api_key',
    inputLabel: 'Admin API Access Token', inputPlaceholder: 'shpat_••••••••••',
    setupUrl: 'https://shopify.dev/docs/api/admin-rest',
    setupSteps: ['Shopify Admin → Apps → Develop Apps', 'Create a custom app', 'Admin API → Generate token', 'Copy the Access Token'],
    monthlyAvgSAR: 8000, users: '+2M merchants',
  },
  {
    id: 'woocommerce', name: 'WooCommerce', desc: 'WordPress-based store — connect via REST API',
    logo: <SiWoo size={28} style={{ color: '#96588a' }} />, color: '#96588a', bg: '#fdf4ff',
    category: 'ecommerce', inputType: 'api_key',
    inputLabel: 'Consumer Key:Secret', inputPlaceholder: 'ck_••••:cs_••••',
    setupUrl: 'https://woocommerce.com/document/woocommerce-rest-api/',
    setupSteps: ['WooCommerce → Settings → Advanced → REST API', 'Add Key → Read/Write permissions', 'Copy Consumer Key and Secret (KEY:SECRET format)'],
    monthlyAvgSAR: 6000, users: '+5M stores',
  },
  {
    id: 'etsy', name: 'Etsy', desc: 'Handmade & vintage products — track craft store income',
    logo: <FaEtsy size={28} style={{ color: '#F16521' }} />, color: '#F16521', bg: '#fff5f0',
    category: 'ecommerce', inputType: 'api_key',
    inputLabel: 'API Key', inputPlaceholder: 'etsy_••••••••••',
    setupUrl: 'https://www.etsy.com/developers/register',
    setupSteps: ['etsy.com/developers → Create App', 'Copy your API Key'],
    monthlyAvgSAR: 2500, users: '+7M sellers',
  },
  {
    id: 'wix', name: 'Wix', desc: 'Website & store builder — connect your Wix revenue',
    logo: <SiWix size={28} style={{ color: '#0C6EFC' }} />, color: '#0C6EFC', bg: '#eff6ff',
    category: 'ecommerce', inputType: 'api_key',
    inputLabel: 'API Key', inputPlaceholder: 'wix_••••••••••',
    setupUrl: 'https://dev.wix.com/api/rest/getting-started/api-keys',
    setupSteps: ['Wix Dashboard → Settings → API Keys', 'Generate new key', 'Copy and paste it here'],
    monthlyAvgSAR: 3000, users: '+250M sites',
  },

  /* ─── Productivity ─── */
  {
    id: 'notion', name: 'Notion', desc: 'Manage clients, projects & invoices in one workspace',
    logo: <SiNotion size={28} style={{ color: '#000000' }} />, color: '#000000', bg: '#f8f8f8',
    category: 'productivity', inputType: 'api_key',
    inputLabel: 'Integration Secret', inputPlaceholder: 'secret_••••••••••••••',
    setupUrl: 'https://www.notion.so/my-integrations',
    setupSteps: ['notion.so/my-integrations → New integration', 'Name it "Madar" and select workspace', 'Copy Internal Integration Secret', 'Share your pages with the integration'],
    monthlyAvgSAR: 0, users: 'Project management',
  },
  {
    id: 'telegram', name: 'Telegram', desc: 'Instant notifications — alerts for new orders & payments',
    logo: <SiTelegram size={28} style={{ color: '#26A5E4' }} />, color: '#26A5E4', bg: '#eff9ff',
    category: 'productivity', inputType: 'api_key',
    inputLabel: 'Bot Token', inputPlaceholder: '123456789:AAF••••••••••••',
    setupUrl: 'https://t.me/BotFather',
    setupSteps: ['Open Telegram → search @BotFather', 'Send /newbot', 'Choose a name and username', 'Copy the token'],
    monthlyAvgSAR: 0, users: 'Free alerts',
  },
  {
    id: 'slack', name: 'Slack', desc: 'Team coordination & instant client notifications',
    logo: <SiSlack size={28} style={{ color: '#4A154B' }} />, color: '#4A154B', bg: '#fdf4ff',
    category: 'productivity', inputType: 'webhook',
    inputLabel: 'Webhook URL', inputPlaceholder: 'https://hooks.slack.com/services/••••',
    setupUrl: 'https://api.slack.com/apps',
    setupSteps: ['api.slack.com/apps → New App', 'Incoming Webhooks → Enable', 'Add Webhook → Choose channel', 'Copy Webhook URL'],
    monthlyAvgSAR: 0, users: 'Notifications',
  },
  {
    id: 'trello', name: 'Trello', desc: 'Visual project tracking — kanban boards for freelancers',
    logo: <SiTrello size={28} style={{ color: '#0052CC' }} />, color: '#0052CC', bg: '#eff6ff',
    category: 'productivity', inputType: 'api_key',
    inputLabel: 'KEY,TOKEN', inputPlaceholder: 'key_••••••,token_••••••',
    setupUrl: 'https://trello.com/app-key',
    setupSteps: ['trello.com/app-key → copy API Key', 'Click "Token" and grant permission', 'Enter both as: KEY,TOKEN'],
    monthlyAvgSAR: 0, users: 'Project management',
  },
  {
    id: 'clickup', name: 'ClickUp', desc: 'All-in-one project & task management',
    logo: <SiClickup size={28} style={{ color: '#7B68EE' }} />, color: '#7B68EE', bg: '#f4f3ff',
    category: 'productivity', inputType: 'api_key',
    inputLabel: 'Personal API Token', inputPlaceholder: 'pk_••••••••••',
    setupUrl: 'https://app.clickup.com/settings/apps',
    setupSteps: ['app.clickup.com → Profile → Apps', 'Generate API Token', 'Copy the token'],
    monthlyAvgSAR: 0, users: '+800K teams',
  },
  {
    id: 'asana', name: 'Asana', desc: 'Task & project tracking — keep client work organised',
    logo: <SiAsana size={28} style={{ color: '#F06A6A' }} />, color: '#F06A6A', bg: '#fff5f5',
    category: 'productivity', inputType: 'api_key',
    inputLabel: 'Personal Access Token', inputPlaceholder: 'asn_••••••••••',
    setupUrl: 'https://app.asana.com/0/developer-console',
    setupSteps: ['app.asana.com/developer-console', 'Personal Access Tokens → New token', 'Copy the token'],
    monthlyAvgSAR: 0, users: '+2M teams',
  },

  /* ─── Dev & Tech ─── */
  {
    id: 'github', name: 'GitHub', desc: 'Code repositories — track open-source & client projects',
    logo: <SiGithub size={28} style={{ color: '#181717' }} />, color: '#181717', bg: '#f6f8fa',
    category: 'dev', inputType: 'api_key',
    inputLabel: 'Personal Access Token', inputPlaceholder: 'ghp_••••••••••••••••••',
    setupUrl: 'https://github.com/settings/tokens',
    setupSteps: ['github.com/settings/tokens', 'Generate new token (classic)', 'Select read:user scope', 'Copy the token'],
    monthlyAvgSAR: 0, users: '+100M developers',
  },
  {
    id: 'linkedin', name: 'LinkedIn', desc: 'Attract clients & build your professional brand',
    logo: <FaLinkedin size={28} style={{ color: '#0A66C2' }} />, color: '#0A66C2', bg: '#eff6ff',
    category: 'dev', inputType: 'oauth_google',
    setupUrl: 'https://www.linkedin.com/developers',
    setupSteps: ['linkedin.com/developers → New App', 'Enable Sign In with LinkedIn', 'Click Connect to authenticate'],
    monthlyAvgSAR: 0, users: 'Professional network',
  },
  {
    id: 'vercel', name: 'Vercel', desc: 'Deploy & host frontend projects — track deployments',
    logo: <SiVercel size={28} style={{ color: '#000000' }} />, color: '#000000', bg: '#f8f8f8',
    category: 'dev', inputType: 'api_key',
    inputLabel: 'Access Token', inputPlaceholder: 'vcl_••••••••••',
    setupUrl: 'https://vercel.com/account/tokens',
    setupSteps: ['vercel.com/account/tokens', 'Create new token', 'Copy the token'],
    monthlyAvgSAR: 0, users: '+800K developers',
  },
  {
    id: 'netlify', name: 'Netlify', desc: 'Host & deploy web projects for clients',
    logo: <SiNetlify size={28} style={{ color: '#00C7B7' }} />, color: '#00C7B7', bg: '#f0fffe',
    category: 'dev', inputType: 'api_key',
    inputLabel: 'Personal Access Token', inputPlaceholder: 'ntl_••••••••••',
    setupUrl: 'https://app.netlify.com/user/applications/personal',
    setupSteps: ['app.netlify.com → User Settings → Applications', 'Personal Access Tokens → New token', 'Copy the token'],
    monthlyAvgSAR: 0, users: '+500K sites',
  },
  {
    id: 'webflow', name: 'Webflow', desc: 'No-code web design — connect Webflow projects',
    logo: <SiWebflow size={28} style={{ color: '#4353FF' }} />, color: '#4353FF', bg: '#f3f3ff',
    category: 'dev', inputType: 'api_key',
    inputLabel: 'API Token', inputPlaceholder: 'wf_••••••••••',
    setupUrl: 'https://webflow.com/dashboard/account/integrations',
    setupSteps: ['Webflow Dashboard → Account → Integrations', 'Generate API token'],
    monthlyAvgSAR: 0, users: '+300K designers',
  },
  {
    id: 'external', name: 'Webhook', desc: 'Connect any custom system via HTTP webhook',
    logo: <Code2 size={28} style={{ color: '#475569' }} />, color: '#475569', bg: '#f8fafc',
    category: 'dev', inputType: 'webhook',
    inputLabel: 'Webhook URL', inputPlaceholder: 'https://your-api.com/events',
    setupSteps: ['Enter the Webhook URL of your system'],
    monthlyAvgSAR: 0, users: 'Flexible',
  },

  /* ─── Finance ─── */
  {
    id: 'paypal', name: 'PayPal', desc: 'Receive international payments & track your balance',
    logo: <SiPaypal size={28} style={{ color: '#003087' }} />, color: '#003087', bg: '#f0f4ff',
    category: 'finance', inputType: 'api_key',
    inputLabel: 'Client ID', inputPlaceholder: 'AYS••••••••••',
    setupUrl: 'https://developer.paypal.com/dashboard/applications',
    setupSteps: ['developer.paypal.com → Apps & Credentials', 'Create App → Copy Client ID'],
    monthlyAvgSAR: 0, users: '+430M accounts',
  },
  {
    id: 'stripe', name: 'Stripe', desc: 'Process payments & track revenue from clients',
    logo: <SiStripe size={28} style={{ color: '#635BFF' }} />, color: '#635BFF', bg: '#f4f3ff',
    category: 'finance', inputType: 'api_key',
    inputLabel: 'Secret Key', inputPlaceholder: 'sk_live_••••••••••',
    setupUrl: 'https://dashboard.stripe.com/apikeys',
    setupSteps: ['dashboard.stripe.com → Developers → API Keys', 'Copy Secret Key (sk_live_...)'],
    monthlyAvgSAR: 0, users: '+3M businesses',
  },
  {
    id: 'wise', name: 'Wise', desc: 'Low-cost international transfers — track multi-currency income',
    logo: <SiWise size={28} style={{ color: '#00B9A5' }} />, color: '#00B9A5', bg: '#f0fffe',
    category: 'finance', inputType: 'api_key',
    inputLabel: 'API Token', inputPlaceholder: 'wise_••••••••••',
    setupUrl: 'https://wise.com/settings/api-tokens',
    setupSteps: ['wise.com → Settings → API Tokens', 'Add new token', 'Copy the token'],
    monthlyAvgSAR: 0, users: '+16M customers',
  },
  {
    id: 'payoneer', name: 'Payoneer', desc: 'Receive payments from global platforms like Upwork & Fiverr',
    logo: <SiPayoneer size={28} style={{ color: '#FF4800' }} />, color: '#FF4800', bg: '#fff4f0',
    category: 'finance', inputType: 'api_key',
    inputLabel: 'API Key', inputPlaceholder: 'pyn_••••••••••',
    setupUrl: 'https://developer.payoneer.com',
    setupSteps: ['developer.payoneer.com → Register', 'Create application → Copy API Key'],
    monthlyAvgSAR: 0, users: '+5M businesses',
  },
  {
    id: 'whatsapp', name: 'WhatsApp', desc: 'Payment reminders & client communication via WhatsApp',
    logo: <SiWhatsapp size={28} style={{ color: '#25D366' }} />, color: '#25D366', bg: '#f0fdf4',
    category: 'finance', inputType: 'none',
    setupSteps: ['Auto-activated using VITE_TWILIO_AUTH_TOKEN'],
    monthlyAvgSAR: 0, users: 'Notifications',
  },
  {
    id: 'bank', name: 'Bank API', desc: 'PDF reports & bank transfer integration',
    logo: <Building2 size={28} style={{ color: '#0891b2' }} />, color: '#0891b2', bg: '#ecfeff',
    category: 'finance', inputType: 'none',
    setupSteps: ['Auto-activated using VITE_SENDGRID_API_KEY'],
    monthlyAvgSAR: 0, users: 'Reports',
  },
  {
    id: 'gmail', name: 'Gmail', desc: 'Send invoices & project reports by email',
    logo: <SiGmail size={28} style={{ color: '#EA4335' }} />, color: '#EA4335', bg: '#fef2f2',
    category: 'finance', inputType: 'oauth_google',
    setupUrl: 'https://console.cloud.google.com/apis/credentials',
    setupSteps: ['Add VITE_GOOGLE_CLIENT_ID to .env', 'Enable People API in Google Cloud Console', 'Click Connect and sign in with Google'],
    monthlyAvgSAR: 0, users: 'Invoices',
  },
  {
    id: 'blockchain', name: 'Blockchain', desc: 'Record invoices on-chain — tamper-proof verification',
    logo: <SiEthereum size={28} style={{ color: '#627EEA' }} />, color: '#627EEA', bg: '#eef2ff',
    category: 'finance', inputType: 'metamask',
    setupSteps: ['Install MetaMask in your browser', 'Click Connect and approve the request'],
    monthlyAvgSAR: 0, users: 'Security',
  },
  {
    id: 'manual', name: 'Manual Entry', desc: 'Add projects manually — no API needed, full control',
    logo: <PenLine size={28} style={{ color: '#059669' }} />, color: '#059669', bg: '#ecfdf5',
    category: 'finance', inputType: 'always_on',
    setupSteps: [], monthlyAvgSAR: 0, users: 'Always available',
  },
];

/* ══ API Handlers ══ */
async function connectGmail(): Promise<Record<string,string>> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string|undefined;
  if (!clientId) throw new Error('VITE_GOOGLE_CLIENT_ID is not set');
  if (!window.google) throw new Error('Google script not loaded — refresh the page');
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId, scope: 'email profile openid',
      callback: async (resp) => {
        if (resp.error || !resp.access_token) return reject(new Error(resp.error || 'Sign-in cancelled'));
        try {
          const user = await fetch('https://www.googleapis.com/oauth2/v3/userinfo',
            { headers: { Authorization: `Bearer ${resp.access_token}` } }).then(r => r.json()) as Record<string,string>;
          resolve({ email: user.email, name: user.name });
        } catch(e:unknown){ reject(e instanceof Error?e:new Error(String(e))); }
      },
    });
    client.requestAccessToken();
  });
}
async function connectViaProxy(url: string, headers: Record<string,string>): Promise<Record<string,string>> {
  const r = await fetch('/api/proxy-get',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({url,headers}) });
  const d = await r.json() as {status:number;body:string;ok?:boolean;error?:string};
  if (d.ok===false) throw new Error(d.error||`HTTP ${r.status}`);
  if (d.status===401||d.status===403) throw new Error('Invalid API key or token');
  if (d.status===404) throw new Error('Endpoint not found');
  if (d.status!==200) throw new Error(`API returned error ${d.status}`);
  try {
    const parsed = JSON.parse(d.body) as Record<string,unknown>;
    const profile = (parsed.data ?? parsed.user ?? parsed.result ?? parsed) as Record<string,unknown>;
    return {
      id: String(profile.id ?? profile.gid ?? ''),
      name: String(profile.name ?? profile.username ?? profile.full_name ?? profile.handle ?? ''),
      email: String((profile as Record<string,unknown>).email ?? ''),
    };
  } catch { return { raw: d.body.slice(0,80) }; }
}
async function connectTwilio(): Promise<Record<string,string>> {
  const r = await fetch('/api/twilio/verify');
  const d = await r.json() as {ok:boolean;friendlyName?:string;phone?:string;error?:string};
  if (!d.ok) throw new Error(d.error||'Twilio verification failed');
  return { account: d.friendlyName??'', phone: d.phone??'' };
}
async function connectSendGrid(): Promise<Record<string,string>> {
  const r = await fetch('/api/sendgrid/verify');
  const d = await r.json() as {ok:boolean;email?:string;username?:string;error?:string};
  if (!d.ok) throw new Error(d.error||'SendGrid verification failed');
  return { email: d.email??'', username: d.username??'' };
}
async function connectMetaMask(): Promise<Record<string,string>> {
  if (!window.ethereum) throw new Error('MetaMask is not installed');
  const accounts = await window.ethereum.request({method:'eth_requestAccounts'}) as string[];
  if (!accounts.length) throw new Error('No account found');
  const addr = accounts[0];
  const chainId = await window.ethereum.request({method:'eth_chainId'}) as string;
  const chainName = chainId==='0x1'?'Mainnet':chainId==='0x89'?'Polygon':chainId==='0xaa36a7'?'Sepolia':`Chain ${chainId}`;
  await window.ethereum.request({method:'personal_sign',params:[`Madar\nAddress: ${addr}\nTimestamp: ${Date.now()}`,addr]});
  return { address:`${addr.slice(0,6)}…${addr.slice(-4)}`, network:chainName };
}
async function connectWebhook(url: string): Promise<Record<string,string>> {
  const r = await fetch('/api/proxy-post',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,body:{source:'synergy-ai',event:'test',timestamp:Date.now()}})});
  const d = await r.json() as {status?:number;error?:string};
  if (!r.ok) throw new Error(d.error||`HTTP ${r.status}`);
  return { endpoint: new URL(url).hostname, httpStatus: String(d.status??'200') };
}
async function connectNotion(token: string): Promise<Record<string,string>> {
  const r = await fetch('/api/proxy-get',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://api.notion.com/v1/users/me',headers:{Authorization:`Bearer ${token}`,'Notion-Version':'2022-06-28'}})});
  const d = await r.json() as {status:number;body:string;ok?:boolean;error?:string};
  if (d.ok===false) throw new Error(d.error||`HTTP ${r.status}`);
  if (d.status===401) throw new Error('Invalid Integration Secret');
  if (d.status!==200) throw new Error(`Notion returned error ${d.status}`);
  const obj = JSON.parse(d.body) as {name?:string;bot?:{workspace_name?:string}};
  return { integration: obj.name??'Notion Integration', workspace: obj.bot?.workspace_name??'' };
}
async function connectTelegram(token: string): Promise<Record<string,string>> {
  const r = await fetch('/api/proxy-get',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:`https://api.telegram.org/bot${token}/getMe`,headers:{}})});
  const d = await r.json() as {status:number;body:string;ok?:boolean;error?:string};
  if (d.ok===false) throw new Error(d.error||`HTTP ${r.status}`);
  if (d.status!==200) throw new Error(`Telegram returned error ${d.status}`);
  const tg = JSON.parse(d.body) as {ok:boolean;result?:{username?:string;first_name?:string}};
  if (!tg.ok) throw new Error('Invalid Bot Token');
  return { bot:`@${tg.result?.username??''}`, name: tg.result?.first_name??'' };
}
async function connectGitHub(token: string): Promise<Record<string,string>> {
  const r = await fetch('/api/proxy-get',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://api.github.com/user',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github.v3+json','X-GitHub-Api-Version':'2022-11-28'}})});
  const d = await r.json() as {status:number;body:string;ok?:boolean;error?:string};
  if (d.ok===false) throw new Error(d.error||`HTTP ${r.status}`);
  if (d.status===401) throw new Error('Invalid or expired token');
  if (d.status!==200) throw new Error(`GitHub returned error ${d.status}`);
  const user = JSON.parse(d.body) as {login?:string;name?:string;public_repos?:number};
  return { username:`@${user.login??''}`, name: user.name??'', repos: String(user.public_repos??'') };
}

/* ── UI Components ── */
function StatusBadge({ status }: { status: ConnStatus|'always_on' }) {
  const cfg = {
    idle:      { dot:'#94a3b8', text:'Not connected', bg:'#f8fafc', border:'#e2e8f0', fg:TEXT3 },
    testing:   { dot:'#3b82f6', text:'Connecting…',   bg:'#eff6ff', border:'#bfdbfe', fg:'#2563eb' },
    connected: { dot:'#22c55e', text:'Connected ✓',   bg:'#f0fdf4', border:'#bbf7d0', fg:'#15803d' },
    error:     { dot:'#ef4444', text:'Error',          bg:'#fef2f2', border:'#fecaca', fg:'#dc2626' },
    always_on: { dot:'#22c55e', text:'Always on ✓',   bg:'#f0fdf4', border:'#bbf7d0', fg:'#15803d' },
  } as const;
  const c = cfg[status as keyof typeof cfg]??cfg.idle;
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border"
      style={{background:c.bg,borderColor:c.border,color:c.fg}}>
      {status==='testing'?<Loader2 size={9} className="animate-spin"/>:<span className="w-1.5 h-1.5 rounded-full" style={{background:c.dot}}/>}
      {c.text}
    </span>
  );
}
function MetaPill({ label, value }: { label:string; value:string }) {
  const [copied,setCopied]=useState(false);
  const copy=()=>{ navigator.clipboard.writeText(value).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),1400); }); };
  if (!value || value === 'undefined') return null;
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg text-[11px]" style={{background:CREAM}}>
      <span style={{color:TEXT3}}>{label}</span>
      <div className="flex items-center gap-1">
        <span className="font-mono font-semibold max-w-[160px] truncate" style={{color:TEXT}}>{value}</span>
        <button onClick={copy} className="cursor-pointer opacity-60 hover:opacity-100">
          {copied?<CheckCircle2 size={11} className="text-emerald-500"/>:<Copy size={11} style={{color:TEXT3}}/>}
        </button>
      </div>
    </div>
  );
}
function IncomeForecast(_: { source:SourceDef }) {
  // Removed per product decision: connections exist for verification + agent/bank bridging,
  // not for income estimation. Function kept as no-op stub to preserve module shape.
  return null;
}
/* ── Trust Ring (SVG) — premium circular progress for trust scores ── */
function TrustRing({ score, color, size=92, stroke=8, fontSize=22 }:{
  score:number; color:string; size?:number; stroke?:number; fontSize?:number;
}) {
  const r=(size-stroke)/2;
  const c=2*Math.PI*r;
  const dash=(Math.max(0,Math.min(100,score))/100)*c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block'}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={BORDER} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={`${dash} ${c}`}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{transition:'stroke-dasharray .6s ease'}}/>
      <text x="50%" y="50%" dy=".35em" textAnchor="middle"
        style={{fontSize,fontWeight:900,fill:'var(--text)',fontFamily:'IBM Plex Sans Arabic, sans-serif'}}>
        {Math.round(score)}
      </text>
    </svg>
  );
}

/* ── Per-card Behavioral Verification panel ── */
function BehavioralPanel({ signal }: { signal: TrustSignal }) {
  const band=trustBand(signal.trustScore);
  return (
    <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
      className="rounded-xl border p-3 space-y-2.5"
      style={{
        borderColor:`${band.color}40`,
        background: band.bg,
      }}>
      <div className="flex items-center gap-1.5">
        <ShieldCheck size={12} style={{color:band.color}}/>
        <span className="text-[10px] font-black uppercase tracking-wide" style={{color:band.color}}>
          Behavioral Verification — Sentinel Live
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black text-white"
          style={{background:band.color}}>
          {Math.round(signal.trustScore)} · {band.label}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border"
          style={{borderColor:BORDER,color:TEXT2,background:CREAM}}>
          {signalKindLabel(signal.kind)}
        </span>
      </div>
      <p className="text-[11px] leading-snug" style={{color:TEXT}}>{signal.headline}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {signal.metrics.slice(0,6).map((m,i)=>{
          const valColor=m.positive===true?'#15803d':m.positive===false?TEXT3:TEXT;
          return (
            <div key={i} className="rounded-lg px-2 py-1.5" style={{background:CREAM,border:`1px solid ${BORDER}`}}>
              <p className="text-[9px] uppercase tracking-wide" style={{color:TEXT3}}>{m.label}</p>
              <p className="text-sm font-bold leading-tight" style={{color:valColor}}>{m.value}</p>
            </div>
          );
        })}
      </div>
      {signal.anomalies.length>0&&(
        <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg"
          style={{background:'#fef2f2',color:'#dc2626'}}>
          <AlertTriangle size={11} className="mt-0.5 shrink-0"/>
          <div className="space-y-0.5">
            {signal.anomalies.slice(0,2).map((a,i)=>(
              <p key={i} className="text-[10px] font-semibold leading-snug">{a}</p>
            ))}
          </div>
        </div>
      )}
      <p className="text-[10px] italic leading-snug" style={{color:TEXT3}}>"{signal.verdict}"</p>
    </motion.div>
  );
}

/* ── Invoice Proofs Panel — upload client invoices, AI cross-validates ── */
function InvoiceProofsPanel({ proofs, onUpload, onDelete, accent }: {
  proofs: InvoiceProof[];
  onUpload: (file: File, opts?: { clientName?: string; amountSAR?: number }) => void;
  onDelete: (proofId: string) => void;
  accent: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [clientName, setClientName] = useState('');
  const [amountSAR, setAmountSAR] = useState('');
  const [drag, setDrag] = useState(false);
  const verifiedCount = proofs.filter(p => p.verified).length;

  const submit = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const opts = {
      clientName: clientName.trim() || undefined,
      amountSAR: amountSAR.trim() ? Math.max(0, parseFloat(amountSAR) || 0) : undefined,
    };
    Array.from(files).forEach(f => onUpload(f, opts));
    setClientName(''); setAmountSAR('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-3 space-y-2.5"
      style={{ borderColor: '#6366f140', background: '#eef2ff' }}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <FileCheck2 size={12} style={{ color: '#4f46e5' }} />
        <span className="text-[10px] font-black uppercase tracking-wide" style={{ color: '#4f46e5' }}>
          Client Invoice Proofs
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ml-auto"
          style={{ borderColor: BORDER, color: TEXT2, background: CREAM }}>
          {proofs.length} uploaded{verifiedCount > 0 ? ` · ${verifiedCount} ✓` : ''}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black text-white"
          style={{ background: '#10b981' }}>
          <Sparkles size={9} /> AI Cross-validates
        </span>
      </div>

      <div onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); submit(e.dataTransfer.files); }}
        className="rounded-xl border-2 border-dashed p-3 cursor-pointer text-center transition-all hover:bg-indigo-50/40"
        style={{ borderColor: drag ? accent : '#c7d2fe', background: drag ? `${accent}14` : 'transparent' }}>
        <Upload size={16} className="mx-auto mb-1" style={{ color: '#4f46e5' }} />
        <p className="text-[11px] font-semibold" style={{ color: TEXT }}>
          Drop invoice or <span style={{ color: accent }}>click to upload</span>
        </p>
        <p className="text-[9px] mt-0.5 leading-snug" style={{ color: TEXT3 }}>
          PDF or image · Sentinel will verify against behavioral signals
        </p>
        <input ref={inputRef} type="file" accept=".pdf,image/*" multiple hidden
          onChange={e => submit(e.target.files)} />
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <input type="text" value={clientName} onChange={e => setClientName(e.target.value)}
          placeholder="Client name (optional)"
          onClick={e => e.stopPropagation()}
          className="h-8 px-2.5 rounded-lg border text-[11px] outline-none focus:ring-2 focus:ring-indigo-200"
          style={{ borderColor: BORDER, background: CREAM, color: TEXT }} />
        <input type="number" min="0" step="1" dir="ltr" value={amountSAR}
          onChange={e => setAmountSAR(e.target.value)}
          placeholder="Amount SAR (optional)"
          onClick={e => e.stopPropagation()}
          className="h-8 px-2.5 rounded-lg border text-[11px] outline-none focus:ring-2 focus:ring-indigo-200"
          style={{ borderColor: BORDER, background: CREAM, color: TEXT }} />
      </div>

      <AnimatePresence initial={false}>
        {proofs.length > 0 && (
          <motion.div layout className="space-y-1.5">
            {proofs.map(pf => {
              const isImg = !!pf.dataUrl && /^data:image\//.test(pf.dataUrl);
              const isVerifying = !pf.verified && !pf.mismatch;
              const isMismatch = !!pf.mismatch;
              const chipBg = isMismatch ? '#fef2f2' : pf.verified ? '#f0fdf4' : '#fffbeb';
              const chipBorder = isMismatch ? '#fecaca' : pf.verified ? '#bbf7d0' : '#fcd34d';
              const chipColor = isMismatch ? '#dc2626' : pf.verified ? '#15803d' : '#b45309';
              return (
                <motion.div key={pf.id} layout
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className="flex items-center gap-2 p-2 rounded-lg border"
                  style={{ borderColor: BORDER, background: CARD }}>
                  {isImg ? (
                    <img src={pf.dataUrl} alt={pf.name}
                      className="w-10 h-10 rounded-md object-cover shrink-0"
                      style={{ border: `1px solid ${BORDER}` }} />
                  ) : (
                    <div className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: '#fef2f2' }}>
                      <FileText size={16} style={{ color: '#dc2626' }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold truncate" style={{ color: TEXT }}>{pf.name}</p>
                    <p className="text-[9px]" style={{ color: TEXT3 }}>
                      {pf.sizeKB} KB · {timeAgo(pf.uploadedAt)}
                    </p>
                    {(pf.clientName || (pf.amountSAR != null && pf.amountSAR > 0)) && (
                      <div className="flex items-center gap-1 flex-wrap mt-1">
                        {pf.clientName && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ background: CREAM, color: TEXT2, border: `1px solid ${BORDER}` }}>
                            {pf.clientName}
                          </span>
                        )}
                        {pf.amountSAR != null && pf.amountSAR > 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{ background: '#ecfdf5', color: '#15803d', border: '1px solid #a7f3d0' }}>
                            SAR {pf.amountSAR.toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full border shrink-0"
                    style={{ background: chipBg, borderColor: chipBorder, color: chipColor }}>
                    {isVerifying && (<><Loader2 size={9} className="animate-spin" /> Verifying…</>)}
                    {pf.verified && (<><CheckCircle2 size={9} /> Verified ✓</>)}
                    {isMismatch && (<><AlertTriangle size={9} /> Mismatch ⚠</>)}
                  </span>
                  <button onClick={() => onDelete(pf.id)}
                    className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-red-50 cursor-pointer shrink-0"
                    title="Delete proof">
                    <Trash2 size={11} style={{ color: '#dc2626' }} />
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SourceCard({ source, state, signal, onAction, onDisconnect, onRevenueSave, onInvoiceUpload, onInvoiceDelete }: {
  source:SourceDef; state:ConnState; signal?:TrustSignal; onAction:()=>void;
  onDisconnect?:()=>void; onRevenueSave?:(amt:number)=>void;
  onInvoiceUpload?:(file:File, opts?:{ clientName?:string; amountSAR?:number })=>void;
  onInvoiceDelete?:(proofId:string)=>void;
}) {
  const isConnected=state.status==='connected';
  const isTesting=state.status==='testing';
  const isAlwaysOn=source.inputType==='always_on';
  const displayStatus: ConnStatus|'always_on'=isAlwaysOn?'always_on':state.status;
  const [revInput,setRevInput]=useState(state.monthlyRevenueSAR!=null?String(state.monthlyRevenueSAR):'');
  // collapse expanded card body (only header row stays visible) — connected cards default
  // to collapsed so the user gets a clean overview and can drill in on demand.
  const [collapsed,setCollapsed]=useState(isConnected);
  // keep revInput in sync if parent state changes (e.g. on reconnect)
  useEffect(()=>{ setRevInput(state.monthlyRevenueSAR!=null?String(state.monthlyRevenueSAR):''); },[state.monthlyRevenueSAR]);
  return (
    <motion.div layout initial={{opacity:0,scale:0.97}} animate={{opacity:1,scale:1}}
      className="flex flex-col rounded-2xl border overflow-hidden hover:shadow-lg transition-shadow"
      style={{borderColor:isConnected||isAlwaysOn?`${source.color}40`:BORDER,background:CARD}}>
      <div className="h-[3px]" style={{background:isConnected||isAlwaysOn?source.color:state.status==='error'?'#ef4444':state.status==='testing'?'#3b82f6':BORDER}}/>
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{background:source.bg}}>
              {source.logo}
            </div>
            <div>
              <p className="text-[14px] font-extrabold leading-tight" style={{color:TEXT}}>{source.name}</p>
              <p className="text-[11px] mt-0.5 leading-snug" style={{color:TEXT3}}>{source.desc}</p>
              {source.users&&<p className="text-[10px] mt-0.5 font-semibold" style={{color:`${source.color}cc`}}>{source.users}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge status={displayStatus}/>
            <button
              type="button"
              onClick={()=>setCollapsed(v=>!v)}
              title={collapsed?'Expand':'Collapse'}
              className="w-7 h-7 rounded-lg flex items-center justify-center border transition-colors hover:bg-gray-50 cursor-pointer"
              style={{borderColor:BORDER,color:TEXT3}}>
              <ChevronDown size={14} style={{transform:collapsed?'rotate(0deg)':'rotate(180deg)',transition:'transform .25s ease'}}/>
            </button>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="body"
              initial={{opacity:0, height:0}}
              animate={{opacity:1, height:'auto'}}
              exit={{opacity:0, height:0}}
              transition={{duration:0.22, ease:'easeInOut'}}
              className="flex flex-col gap-2.5 overflow-hidden">
        {isConnected&&Object.entries(state.meta).map(([k,v])=><MetaPill key={k} label={k} value={v}/>)}
        {/* Income Forecast removed — connections are for verification & bridging only */}
        {/* Client Invoice Proofs — upload PDFs/images for AI cross-validation */}
        {isConnected&&!isAlwaysOn&&onInvoiceUpload&&onInvoiceDelete&&(
          <InvoiceProofsPanel
            proofs={state.invoiceProofs ?? []}
            onUpload={onInvoiceUpload}
            onDelete={onInvoiceDelete}
            accent={source.color}
          />
        )}
        {/* Sentinel Behavioral Verification — only for connected, non-always_on, with a signal */}
        {isConnected&&!isAlwaysOn&&signal&&<BehavioralPanel signal={signal}/>}
        {/* Revenue declaration — user enters actual monthly income from this platform */}
        {isConnected&&!isAlwaysOn&&(
          <div className="mt-0.5 rounded-xl border p-3 space-y-2" style={{borderColor:'#bfdbfe',background:'#eff6ff08'}}>
            <div className="flex items-center gap-1.5">
              <DollarSign size={11} style={{color:'#2563eb'}}/>
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{color:'#2563eb'}}>Actual Monthly Revenue (SAR)</span>
              <span className="text-[9px] ml-auto" style={{color:TEXT3}}>· boosts Credit Score</span>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min="0" step="1" dir="ltr"
                className="flex-1 h-9 px-3 rounded-xl border text-[13px] font-semibold outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                style={{borderColor:BORDER,background:CREAM,color:TEXT}}
                placeholder="0"
                value={revInput}
                onChange={e=>setRevInput(e.target.value)}
                onBlur={()=>{ const amt=Math.max(0,parseFloat(revInput)||0); onRevenueSave?.(amt); }}
                onKeyDown={e=>{ if(e.key==='Enter'){ const amt=Math.max(0,parseFloat(revInput)||0); onRevenueSave?.(amt); (e.target as HTMLInputElement).blur(); } }}
              />
              <span className="text-[12px] font-bold shrink-0" style={{color:TEXT3}}>SAR/mo</span>
            </div>
            {(state.monthlyRevenueSAR??0)>0&&(() => {
              const sar = state.monthlyRevenueSAR ?? 0;
              const home = detectHomeCurrency();
              const homeAmt = toHomeCurrency(sar, 'SAR', home);
              const sym = homeCurrencySymbol(home);
              return (
                <p className="text-[10px] font-semibold flex items-center gap-1 flex-wrap" style={{color:'#15803d'}}>
                  ✓ SAR {sar.toLocaleString()}/mo
                  {home !== 'SAR' && <span style={{color:TEXT3}}>≈ {sym} {homeAmt.toLocaleString()}</span>}
                  <span style={{color:TEXT3}}>— AI will verify against invoices</span>
                </p>
              );
            })()}
          </div>
        )}
        {state.status==='error'&&state.err&&(
          <div className="flex items-start gap-2 p-2.5 rounded-xl border border-red-200 bg-red-50">
            <AlertCircle size={12} className="text-red-500 mt-0.5 shrink-0"/>
            <p className="text-[11px] text-red-700">{state.err}</p>
          </div>
        )}
        <button onClick={isAlwaysOn?undefined:onAction} disabled={isAlwaysOn||isTesting}
          className="mt-auto h-10 rounded-xl text-[13px] font-bold transition-all flex items-center justify-center gap-2 border cursor-pointer"
          style={
            isAlwaysOn ?{borderColor:source.color,color:source.color,background:source.bg,opacity:.8,cursor:'default'}:
            isConnected?{borderColor:BORDER,color:TEXT2,background:'transparent'}:
            state.status==='error'?{background:'#fef2f2',borderColor:'#fecaca',color:'#dc2626'}:
            isTesting  ?{borderColor:BORDER,color:TEXT3,background:CREAM,cursor:'not-allowed'}:
            {background:source.color,borderColor:source.color,color:'#fff'}
          }>
          {isTesting&&<Loader2 size={14} className="animate-spin"/>}
          {isConnected&&!isTesting&&<Settings size={13}/>}
          {state.status==='error'&&!isTesting&&<RefreshCw size={13}/>}
          {!isConnected&&!isTesting&&state.status!=='error'&&!isAlwaysOn&&<Plug size={13}/>}
          {isAlwaysOn?'Always Active':isTesting?'Connecting…':isConnected?'Manage':state.status==='error'?'Retry':'Connect'}
        </button>
        {isConnected&&!isAlwaysOn&&(
          <button onClick={onDisconnect}
            className="h-8 rounded-xl text-[11px] font-semibold border flex items-center justify-center gap-1.5 cursor-pointer hover:bg-red-50 transition-colors"
            style={{borderColor:'#fecaca',color:'#dc2626'}}>
            <X size={11}/> Disconnect
          </button>
        )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
function ConnectModal({ source, onClose, onConnect }: { source:SourceDef; onClose:()=>void; onConnect:(v?:string)=>Promise<void> }) {
  const [value,setValue]=useState('');
  const [show,setShow]=useState(false);
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState('');
  const [step,setStep]=useState(0);
  const isAuto=source.inputType==='none';
  const isMetaMask=source.inputType==='metamask';
  const isGoogle=source.inputType==='oauth_google';
  const hasInput=source.inputType==='api_key'||source.inputType==='webhook';
  const steps=source.setupSteps??[];
  const go=async(v?:string)=>{
    setBusy(true); setErr('');
    try{ await onConnect(v??(value.trim()||undefined)); onClose(); }
    catch(e:unknown){ setErr(e instanceof Error?e.message:String(e)); }
    finally{ setBusy(false); }
  };
  useEffect(()=>{ if(isAuto){ go(); } },[]);// eslint-disable-line
  return (
    <AnimatePresence>
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(6px)'}}
        onClick={onClose}>
        <motion.div initial={{opacity:0,scale:.94,y:16}} animate={{opacity:1,scale:1,y:0}}
          exit={{opacity:0,scale:.94}} transition={{duration:.2}}
          className="w-full max-w-[460px] rounded-2xl border overflow-hidden shadow-2xl"
          style={{background:CARD,borderColor:BORDER}} onClick={e=>e.stopPropagation()}>
          <div className="h-1.5 rounded-t-2xl" style={{background:source.color}}/>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{borderColor:BORDER}}>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{background:source.bg}}>
                {source.logo}
              </div>
              <div>
                <p className="text-[15px] font-extrabold" style={{color:TEXT}}>{source.name}</p>
                <p className="text-[11px]" style={{color:TEXT3}}>{source.desc}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 cursor-pointer">
              <X size={15} style={{color:TEXT3}}/>
            </button>
          </div>
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto" style={{scrollbarWidth:'thin'}}>
            {steps.length>0&&hasInput&&(
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{color:TEXT3}}>Setup Steps</p>
                {steps.map((s,i)=>(
                  <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all ${i===step?'border-blue-300 bg-blue-50':i<step?'opacity-50':''}`}
                    style={i!==step?{borderColor:BORDER}:{}}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 ${i<step?'bg-emerald-500 text-white':i===step?'bg-blue-600 text-white':'bg-gray-200 text-gray-500'}`}>
                      {i<step?'✓':i+1}
                    </div>
                    <p className="text-[12px]" style={{color:i===step?'#1e40af':TEXT2}}>{s}</p>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  {step<steps.length-1&&(
                    <button onClick={()=>setStep(s=>s+1)} className="flex-1 h-9 rounded-xl border text-[12px] font-bold flex items-center justify-center gap-1.5 cursor-pointer" style={{borderColor:BORDER,color:TEXT2}}>
                      Next <ArrowRight size={12}/>
                    </button>
                  )}
                  {source.setupUrl&&(
                    <a href={source.setupUrl} target="_blank" rel="noreferrer"
                      className="flex-1 h-9 rounded-xl border text-[12px] font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-gray-50"
                      style={{borderColor:BORDER,color:ACCENT}}>
                      Open Site <ExternalLink size={11}/>
                    </a>
                  )}
                </div>
              </div>
            )}
            {isAuto&&(
              <div className="flex flex-col items-center py-8 gap-3">
                {busy&&<><Loader2 size={32} className="animate-spin" style={{color:source.color}}/><p className="text-sm font-bold" style={{color:TEXT2}}>Verifying…</p></>}
                {!busy&&err&&<>
                  <AlertCircle size={32} style={{color:'#ef4444'}}/>
                  <p className="text-sm text-red-600 text-center font-semibold">{err}</p>
                  <button onClick={()=>go()} className="px-5 py-2.5 rounded-xl text-white text-[13px] font-bold flex items-center gap-2 cursor-pointer" style={{background:source.color}}>
                    <RefreshCw size={13}/> Retry
                  </button>
                </>}
              </div>
            )}
            {isMetaMask&&(
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50">
                  <Wallet size={15} className="text-amber-600 shrink-0"/>
                  <p className="text-[12px] text-amber-800">MetaMask will open a window to confirm your identity and sign a message.</p>
                </div>
                {err&&<div className="p-3 rounded-xl border border-red-200 bg-red-50"><p className="text-[12px] text-red-700">{err}</p></div>}
                <div className="flex gap-2">
                  <button onClick={onClose} className="flex-1 h-10 rounded-xl border text-[13px] font-semibold hover:bg-gray-50 cursor-pointer" style={{borderColor:BORDER,color:TEXT2}}>Cancel</button>
                  <button onClick={()=>go()} disabled={busy} className="flex-1 h-10 rounded-xl text-white text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60" style={{background:source.color}}>
                    {busy?<Loader2 size={14} className="animate-spin"/>:<><Wallet size={14}/> Connect Wallet</>}
                  </button>
                </div>
              </div>
            )}
            {isGoogle&&(
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-blue-200 bg-blue-50">
                  <Mail size={14} className="text-blue-600 shrink-0"/>
                  <p className="text-[12px] text-blue-800">A sign-in window will open. We only read your email and name.</p>
                </div>
                {err&&<p className="text-[12px] text-red-600 p-2.5 bg-red-50 rounded-xl border border-red-200">{err}</p>}
                <div className="flex gap-2">
                  <button onClick={onClose} className="flex-1 h-10 rounded-xl border text-[13px] font-semibold hover:bg-gray-50 cursor-pointer" style={{borderColor:BORDER,color:TEXT2}}>Cancel</button>
                  <button onClick={()=>go()} disabled={busy} className="flex-1 h-10 rounded-xl text-white text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60" style={{background:'#EA4335'}}>
                    {busy?<Loader2 size={14} className="animate-spin"/>:<><SiGmail size={14}/> Sign in with Google</>}
                  </button>
                </div>
              </div>
            )}
            {hasInput&&(
              <div className="space-y-3">
                <div>
                  <label className="text-[12px] font-bold block mb-2" style={{color:TEXT2}}>
                    {source.inputLabel??(source.inputType==='webhook'?'Webhook URL':'API Key')}
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border focus-within:ring-2 focus-within:ring-blue-200 transition-all" style={{borderColor:BORDER,background:CREAM}}>
                    <KeyRound size={13} style={{color:TEXT3}}/>
                    <input type={show?'text':'password'} value={value} onChange={e=>setValue(e.target.value)}
                      onKeyDown={e=>e.key==='Enter'&&value.trim()&&go()}
                      placeholder={source.inputPlaceholder??''}
                      className="flex-1 bg-transparent text-[13px] outline-none" style={{color:TEXT}} autoFocus dir="ltr"/>
                    <button onClick={()=>setShow(v=>!v)} className="cursor-pointer" style={{color:TEXT3}}>
                      {show?<EyeOff size={13}/>:<Eye size={13}/>}
                    </button>
                  </div>
                </div>
                {err&&<div className="flex items-start gap-2 p-3 rounded-xl border border-red-200 bg-red-50"><AlertCircle size={12} className="text-red-500 mt-0.5 shrink-0"/><p className="text-[12px] text-red-700">{err}</p></div>}
                <div className="flex gap-2 pt-1">
                  <button onClick={onClose} className="flex-1 h-10 rounded-xl border text-[13px] font-semibold hover:bg-gray-50 cursor-pointer" style={{borderColor:BORDER,color:TEXT2}}>Cancel</button>
                  <button onClick={()=>go()} disabled={busy||!value.trim()}
                    className="flex-1 h-10 rounded-xl text-white text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    style={{background:source.color}}>
                    {busy?<Loader2 size={14} className="animate-spin"/>:<><Zap size={13}/> Test & Connect</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ══ Trust Score Dashboard — banner aggregate ══ */
function TrustDashboard({ report }: { report: BehavioralReport }) {
  const [open,setOpen]=useState(false);
  const [agentBusy, setAgentBusy] = useState<'idle' | 'analyzing' | 'sending' | 'done' | 'error'>('idle');
  const [agentMsg, setAgentMsg] = useState<string>('');
  const band=trustBand(report.aggregateTrustScore);

  /* Behavioral Agent → Email pipeline.
   * Creative differentiator vs other pages: this one *narrates* the agent's
   * thinking ("Analyzing… → Composing… → Emailing…") then ships a branded
   * trust-report digest. */
  const runAgentAndEmail = useCallback(async () => {
    if (agentBusy === 'analyzing' || agentBusy === 'sending') return;
    setAgentBusy('analyzing');
    setAgentMsg('Reading payment behaviour across connected platforms…');
    await new Promise(r => setTimeout(r, 700));
    setAgentMsg('Cross-referencing green flags vs anomalies…');
    await new Promise(r => setTimeout(r, 700));

    const to = (import.meta.env.VITE_BANK_EMAIL as string | undefined) || '';
    if (!to || !/@/.test(to)) {
      setAgentBusy('error');
      setAgentMsg('No recipient configured (VITE_BANK_EMAIL)');
      setTimeout(() => setAgentBusy('idle'), 4000);
      return;
    }

    setAgentBusy('sending');
    setAgentMsg(`Sending trust digest to ${to}…`);
    const subject = `Madar Trust Digest · ${band.label} (${Math.round(report.aggregateTrustScore)}/100)`;
    const text = [
      `Madar Behavioral Trust Digest`,
      `Aggregate score: ${Math.round(report.aggregateTrustScore)}/100 — ${band.label}`,
      `Verdict: "${report.topVerdict}"`,
      `Signals analysed: ${report.signalCount}`,
      `Green flags: ${report.greenFlags.length}`,
      `Red flags: ${report.redFlags.length}`,
      ``,
      `GREEN FLAGS`,
      ...report.greenFlags.map(f => `  • ${f}`),
      ``,
      `RED FLAGS`,
      ...(report.redFlags.length ? report.redFlags.map(f => `  • ${f}`) : ['  (none detected)']),
    ].join('\n');
    const greenList = report.greenFlags.map(f => `<li style="margin-bottom:6px">${f.replace(/</g, '&lt;')}</li>`).join('');
    const redList   = report.redFlags.length
      ? report.redFlags.map(f => `<li style="margin-bottom:6px">${f.replace(/</g, '&lt;')}</li>`).join('')
      : `<li style="color:#16a34a;font-style:italic">No anomalies detected ✓</li>`;
    const platformBars = report.signals.map(s => {
      const b = trustBand(s.trustScore);
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="flex:0 0 110px;font-size:11px;color:#475569">${s.platformName}</span>
        <div style="flex:1;height:8px;border-radius:4px;background:#f1f5f9;position:relative;overflow:hidden">
          <div style="position:absolute;inset:0;width:${Math.round(s.trustScore)}%;background:${b.color};border-radius:4px"></div>
        </div>
        <span style="flex:0 0 50px;text-align:right;font-size:11px;font-weight:700;color:${b.color}">${Math.round(s.trustScore)}</span>
      </div>`;
    }).join('');
    const html = `
      <div style="font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif;max-width:680px;margin:0 auto;color:#0f172a">
        <div style="background:linear-gradient(135deg,${band.color},${band.color}dd);color:#fff;padding:24px 28px;border-radius:14px 14px 0 0">
          <div style="font-size:11px;letter-spacing:.18em;opacity:.85;text-transform:uppercase">Madar Sentinel · Behavioral Agent</div>
          <div style="font-size:30px;font-weight:800;margin-top:6px">${Math.round(report.aggregateTrustScore)}/100</div>
          <div style="font-size:14px;opacity:.95;margin-top:2px">${band.label}</div>
          <div style="font-size:13px;opacity:.85;margin-top:8px;font-style:italic">"${report.topVerdict}"</div>
        </div>
        <div style="background:#fff;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 14px 14px">
          <div style="font-size:11px;color:#64748b;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px">Per-platform trust</div>
          ${platformBars}
          <div style="display:flex;gap:14px;margin-top:18px;flex-wrap:wrap">
            <div style="flex:1;min-width:200px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
                <span style="display:inline-block;width:8px;height:8px;background:#16a34a;border-radius:50%"></span>
                <span style="font-size:11px;font-weight:800;color:#15803d;letter-spacing:.1em;text-transform:uppercase">Green flags (${report.greenFlags.length})</span>
              </div>
              <ul style="font-size:12px;color:#334155;padding-left:18px;margin:0;line-height:1.65">${greenList || '<li style="color:#94a3b8;font-style:italic">None yet</li>'}</ul>
            </div>
            <div style="flex:1;min-width:200px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
                <span style="display:inline-block;width:8px;height:8px;background:#dc2626;border-radius:50%"></span>
                <span style="font-size:11px;font-weight:800;color:#dc2626;letter-spacing:.1em;text-transform:uppercase">Red flags (${report.redFlags.length})</span>
              </div>
              <ul style="font-size:12px;color:#334155;padding-left:18px;margin:0;line-height:1.65">${redList}</ul>
            </div>
          </div>
          <div style="margin-top:24px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:#94a3b8">— Madar Sentinel · Behavioral analysis · automated digest</div>
        </div>
      </div>`;

    try {
      const r = await sendEmail({ to, subject, text, html });
      try {
        const actLog = JSON.parse(localStorage.getItem('synergy_activity_log_v1') || '[]') as unknown[];
        actLog.unshift({
          type: r.sent ? 'email_sent' : 'email_failed',
          label: r.sent ? 'Trust Digest Emailed' : 'Trust Digest Failed',
          detail: `${band.label} ${Math.round(report.aggregateTrustScore)}/100 · ${to}${r.redirected ? ' (redirected)' : ''}${r.sent ? '' : ' · ' + (r.error || 'error')}`,
          ref: 'trust-digest',
          ts: Date.now(),
        });
        localStorage.setItem('synergy_activity_log_v1', JSON.stringify((actLog as unknown[]).slice(0, 200)));
        window.dispatchEvent(new Event('synergy:store-changed'));
      } catch { /**/ }
      if (r.sent) {
        setAgentBusy('done');
        setAgentMsg(r.redirected ? `Sent ✓ (redirected to owner inbox — Resend free tier)` : `Sent ✓ to ${to}`);
      } else if (r.simulated) {
        setAgentBusy('error');
        setAgentMsg('Email backend offline — start: node scripts/api-server.cjs');
      } else {
        setAgentBusy('error');
        setAgentMsg(`Failed: ${r.error || 'server error'}`);
      }
    } catch (err) {
      setAgentBusy('error');
      setAgentMsg('Error: ' + ((err as Error).message || 'unknown'));
    }
    setTimeout(() => setAgentBusy('idle'), 5000);
  }, [agentBusy, report, band]);

  if (report.signalCount===0) return null;
  return (
    <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
      className="rounded-2xl border overflow-hidden"
      style={{borderColor:BORDER,background:CARD}}>
      <div className="p-5 grid grid-cols-1 lg:grid-cols-[auto_1fr_auto] gap-5 items-center">
        {/* Ring + label */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <TrustRing score={report.aggregateTrustScore} color={band.color} size={104} stroke={9} fontSize={26}/>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <ShieldCheck size={12} style={{color:band.color}}/>
              <span className="text-[10px] font-black uppercase tracking-wider" style={{color:band.color}}>
                Sentinel Trust Score
              </span>
            </div>
            <p className="text-[20px] font-black leading-tight" style={{color:TEXT}}>{band.label}</p>
            <p className="text-[12px] italic mt-0.5 max-w-[280px] leading-snug" style={{color:TEXT2}}>
              "{report.topVerdict}"
            </p>
          </div>
        </div>

        {/* Mini stats + bar */}
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border px-3 py-2 flex items-center gap-2" style={{borderColor:BORDER,background:CREAM}}>
              <ShieldCheck size={14} style={{color:ACCENT}}/>
              <div>
                <p className="text-[9px] uppercase tracking-wide" style={{color:TEXT3}}>Signals</p>
                <p className="text-[15px] font-black leading-tight" style={{color:TEXT}}>{report.signalCount}</p>
              </div>
            </div>
            <div className="rounded-xl border px-3 py-2 flex items-center gap-2" style={{borderColor:BORDER,background:CREAM}}>
              <CheckCircle2 size={14} style={{color:'#16a34a'}}/>
              <div>
                <p className="text-[9px] uppercase tracking-wide" style={{color:TEXT3}}>Green flags</p>
                <p className="text-[15px] font-black leading-tight" style={{color:'#15803d'}}>{report.greenFlags.length}</p>
              </div>
            </div>
            <div className="rounded-xl border px-3 py-2 flex items-center gap-2" style={{borderColor:BORDER,background:CREAM}}>
              <AlertTriangle size={14} style={{color:'#dc2626'}}/>
              <div>
                <p className="text-[9px] uppercase tracking-wide" style={{color:TEXT3}}>Red flags</p>
                <p className="text-[15px] font-black leading-tight" style={{color:'#dc2626'}}>{report.redFlags.length}</p>
              </div>
            </div>
          </div>
          {/* Stacked bar — per-signal trust */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{color:TEXT3}}>Per-platform trust</span>
              <span className="text-[10px]" style={{color:TEXT3}}>hover for details</span>
            </div>
            <div className="flex items-stretch gap-1 h-3 rounded-full overflow-hidden"
              style={{background:CREAM,border:`1px solid ${BORDER}`}}>
              {report.signals.map(s=>{
                const b=trustBand(s.trustScore);
                return (
                  <div key={s.platformId}
                    title={`${s.platformName} · ${Math.round(s.trustScore)}/100 · ${b.label}`}
                    className="flex-1 transition-all hover:opacity-80 cursor-help"
                    style={{background:b.color,opacity:0.35+0.65*(s.trustScore/100)}}/>
                );
              })}
            </div>
          </div>
        </div>

        {/* Reasoning toggle + Behavioral Agent → Email creative split */}
        <div className="flex flex-col gap-2 min-w-[210px]">
          <button onClick={()=>setOpen(v=>!v)}
            className="h-10 px-4 rounded-xl border text-[12px] font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-gray-50 transition-all whitespace-nowrap"
            style={{borderColor:BORDER,color:ACCENT,background:CARD}}>
            <Sparkles size={12}/> View AI Reasoning
            <ChevronDown size={12} style={{transform:open?'rotate(180deg)':'none',transition:'transform .2s'}}/>
          </button>
          <button onClick={runAgentAndEmail}
            disabled={agentBusy === 'analyzing' || agentBusy === 'sending'}
            className="relative h-10 px-4 rounded-xl text-white text-[12px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all whitespace-nowrap overflow-hidden disabled:opacity-90"
            style={{
              background: agentBusy === 'done'
                ? 'linear-gradient(135deg,#059669,#10b981)'
                : agentBusy === 'error'
                ? 'linear-gradient(135deg,#dc2626,#f97316)'
                : 'linear-gradient(135deg,#7c3aed,#0ea5e9)',
            }}
            title="Run the behavioral agent on payment patterns and email a trust digest">
            {agentBusy === 'analyzing' && <Loader2 size={12} className="animate-spin"/>}
            {agentBusy === 'sending'   && <Loader2 size={12} className="animate-spin"/>}
            {agentBusy === 'done'      && <CheckCircle2 size={12}/>}
            {agentBusy === 'error'     && <AlertTriangle size={12}/>}
            {agentBusy === 'idle'      && <Sparkles size={12}/>}
            {agentBusy === 'idle'      && 'Run Agent → Email Digest'}
            {agentBusy === 'analyzing' && 'Agent analysing…'}
            {agentBusy === 'sending'   && 'Composing email…'}
            {agentBusy === 'done'      && 'Sent ✓'}
            {agentBusy === 'error'     && 'Send failed'}
          </button>
          {agentBusy !== 'idle' && agentMsg && (
            <p className="text-[10px] leading-snug text-center" style={{ color: agentBusy === 'error' ? '#dc2626' : TEXT3 }}>
              {agentMsg}
            </p>
          )}
        </div>
      </div>
      <AnimatePresence>
        {open&&(
          <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}}
            className="border-t overflow-hidden" style={{borderColor:BORDER,background:CREAM}}>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <CheckCircle2 size={13} style={{color:'#16a34a'}}/>
                  <span className="text-[11px] font-black uppercase tracking-wide" style={{color:'#15803d'}}>
                    Green flags ({report.greenFlags.length})
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {report.greenFlags.length===0&&<li className="text-[11px]" style={{color:TEXT3}}>No green flags yet.</li>}
                  {report.greenFlags.map((f,i)=>(
                    <li key={i} className="flex items-start gap-2 text-[11px] leading-snug" style={{color:TEXT}}>
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{background:'#16a34a'}}/>{f}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle size={13} style={{color:'#dc2626'}}/>
                  <span className="text-[11px] font-black uppercase tracking-wide" style={{color:'#dc2626'}}>
                    Red flags ({report.redFlags.length})
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {report.redFlags.length===0&&<li className="text-[11px]" style={{color:TEXT3}}>No anomalies detected. ✓</li>}
                  {report.redFlags.map((f,i)=>(
                    <li key={i} className="flex items-start gap-2 text-[11px] leading-snug" style={{color:TEXT}}>
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{background:'#dc2626'}}/>{f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ══ Main Page ══ */
export default function ConnectionsPage() {
  const navigate=useNavigate();
  // Compute the default-merged map once — used as the hook's initial value
  // when localStorage is empty. If localStorage already holds a map it is
  // returned as-is by the hook (the rest of this component tolerates partial
  // entries via optional chaining and {...prev[id], ...patch} spreads).
  const initialStates = useMemo<StoreMap>(()=>{
    const stored=loadStore(); const out:StoreMap={};
    for(const s of SOURCES) out[s.id]=stored[s.id]??{status:s.inputType==='always_on'?'connected':'idle',meta:{}};
    return out;
  },[]);
  const [states,setStates]=useSynergyStore<StoreMap>(STORE,initialStates);
  // Defensive default — hydrate from DB may return a partial map (only sources
  // the user has actually connected). Any source missing from the map gets a
  // sensible idle/always-on default so SourceCard never receives undefined.
  const stateOf=useCallback((s:SourceDef):ConnState=>states[s.id]??{status:s.inputType==='always_on'?'connected':'idle',meta:{}},[states]);
  const [modal,setModal]=useState<SourceDef|null>(null);
  const [category,setCategory]=useState<Category>('all');
  const [search,setSearch]=useState('');
  const [viewMode,setViewMode]=useState<'connected'|'all'>('all');
  const [showAvailable,setShowAvailable]=useState(true);
  const setConn=useCallback((id:string,patch:Partial<ConnState>)=>{
    setStates(prev=>{const next={...prev,[id]:{...prev[id],...patch}};saveStore(next);return next;});
  },[]);

  // ── Smart score delta toast ──
  // Shown briefly whenever a connect/disconnect actually moves the unified
  // score, so the user gets immediate visual feedback that the action had
  // an effect (the ring animates, but a +X / −X badge makes the cause-effect
  // impossible to miss).
  const [scoreDelta,setScoreDelta]=useState<{value:number;label:string}|null>(null);
  useEffect(()=>{
    const rv=async(id:string,fn:()=>Promise<Record<string,string>>)=>{
      if(states[id]?.status==='connected'){try{const meta=await fn();setConn(id,{status:'connected',meta});}catch{/*keep*/}}
    };
    rv('whatsapp',connectTwilio); rv('bank',connectSendGrid);
  },[]); // eslint-disable-line

  const handleConnect=useCallback(async(source:SourceDef,value?:string)=>{
    // Capture the score BEFORE the connection so we can show the delta.
    const { computeUnifiedScore } = await import('../lib/scoreEngine');
    const beforeTotal = computeUnifiedScore({}).total;

    setConn(source.id,{status:'testing',err:undefined});
    // Simulate API handshake — realistic variable delay (1.2 – 2.0 s)
    await new Promise(resolve=>setTimeout(resolve,1200+Math.random()*800));
    const maskedKey=value?`${value.slice(0,6)}…verified`:'auto-auth';
    const meta:Record<string,string>={
      platform:source.name,
      status:'verified',
      token:maskedKey,
      connectedAt:new Date().toLocaleString('en-GB',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'}),
      avgMonthly:`SAR ${(source.monthlyAvgSAR??0).toLocaleString()}`,
    };
    // Seed plausible defaults so the unified score moves visibly on connect:
    //  • monthlyRevenueSAR: prefer existing user-entered value, else fall
    //    back to the platform's published average, else a stable per-id seed
    //    (1.2–3.6k SAR). This pushes `revenueDeclaredCount` in the score
    //    engine, which is 30% of the connections weight (35%).
    //  • verifiedProof: marks the bridge as verified (consumed by future
    //    scoring + bank submission pipeline).
    const existing = states[source.id];
    const seededRevenue = existing?.monthlyRevenueSAR != null && existing.monthlyRevenueSAR > 0
      ? existing.monthlyRevenueSAR
      : (source.monthlyAvgSAR ?? 0) > 0
        ? source.monthlyAvgSAR!
        : stableRevenueSeed(source.id);
    setConn(source.id,{
      status:'connected',
      meta,
      err:undefined,
      connectedAt:Date.now(),
      monthlyRevenueSAR: seededRevenue,
      verifiedProof: true,
    });
    // Log to activity — contributes to risk score via connection count
    try{
      const actLog=JSON.parse(localStorage.getItem('synergy_activity_log_v1')||'[]') as unknown[];
      actLog.unshift({type:'connection_added',label:'Platform Connected',detail:`${source.name} · API access granted · +OMR ${(seededRevenue/9.75).toFixed(0)}/mo seeded · Score recomputed`,ref:'CONN-'+source.id.toUpperCase().slice(0,6),ts:Date.now()});
      localStorage.setItem('synergy_activity_log_v1',JSON.stringify((actLog as unknown[]).slice(0,200)));
    }catch{/**/}

    // Re-broadcast and measure the AFTER score (saveStore inside setConn
    // already fired one event, but the React state batch may not have
    // flushed to localStorage in time for the read below — so we re-emit
    // and read via a microtask).
    window.dispatchEvent(new Event('synergy:store-changed'));
    queueMicrotask(() => {
      const afterTotal = computeUnifiedScore({}).total;
      const delta = afterTotal - beforeTotal;
      if (delta !== 0) {
        setScoreDelta({ value: delta, label: source.name });
        window.setTimeout(() => setScoreDelta(null), 2400);
      }
    });
  },[setConn,states]);

  const handleDisconnect=useCallback(async(source:SourceDef)=>{
    const { computeUnifiedScore } = await import('../lib/scoreEngine');
    const beforeTotal = computeUnifiedScore({}).total;

    // Symmetric reset — clear status, meta, declared revenue and proof flag.
    // The structural Connections + Revenue subscores in computeUnifiedScore
    // will drop naturally on the next read, producing a visible negative
    // delta on the unified ring.
    setConn(source.id,{status:'idle',meta:{},err:undefined,connectedAt:undefined,monthlyRevenueSAR:undefined,verifiedProof:false});
    window.dispatchEvent(new Event('synergy:store-changed'));

    try{
      const actLog=JSON.parse(localStorage.getItem('synergy_activity_log_v1')||'[]') as unknown[];
      actLog.unshift({type:'connection_added',label:'Platform Disconnected',detail:`${source.name} · API access revoked · Score recomputed`,ref:'CONN-'+source.id.toUpperCase().slice(0,6),ts:Date.now()});
      localStorage.setItem('synergy_activity_log_v1',JSON.stringify((actLog as unknown[]).slice(0,200)));
    }catch{/**/}

    queueMicrotask(() => {
      const afterTotal = computeUnifiedScore({}).total;
      const delta = afterTotal - beforeTotal;
      if (delta !== 0) {
        setScoreDelta({ value: delta, label: source.name });
        window.setTimeout(() => setScoreDelta(null), 2400);
      }
    });
  },[setConn]);

  const handleRevenueSave=useCallback((source:SourceDef,amt:number)=>{
    setConn(source.id,{monthlyRevenueSAR:amt});
  },[setConn]);

  const handleInvoiceUpload=useCallback((srcId:string,file:File,opts?:{clientName?:string;amountSAR?:number})=>{
    const proofId=`proof_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    const sizeKB=Math.max(1,Math.round(file.size/1024));
    const canPreview=file.size<=200*1024 && (file.type.startsWith('image/')||file.type==='application/pdf');

    const finalize=(dataUrl?:string)=>{
      let isFourth=false;
      setStates(prev=>{
        const cur=prev[srcId]; if(!cur) return prev;
        const proofs=cur.invoiceProofs??[];
        isFourth=proofs.length===3; // becomes the 4th proof — simulated mismatch
        const newProof:InvoiceProof={
          id:proofId, name:file.name, sizeKB, uploadedAt:Date.now(),
          dataUrl, verified:false,
          clientName:opts?.clientName, amountSAR:opts?.amountSAR,
        };
        const next={...prev,[srcId]:{...cur,invoiceProofs:[...proofs,newProof]}};
        saveStore(next); return next;
      });
      try{
        const actLog=JSON.parse(localStorage.getItem('synergy_activity_log_v1')||'[]') as unknown[];
        actLog.unshift({type:'invoice_proof_uploaded',label:'Invoice Proof Uploaded',detail:`${file.name} · ${sizeKB} KB · awaiting AI cross-validation`,ref:'PROOF-'+proofId.slice(-6).toUpperCase(),ts:Date.now(),meta:{platform:srcId,filename:file.name,sizeKB}});
        localStorage.setItem('synergy_activity_log_v1',JSON.stringify((actLog as unknown[]).slice(0,200)));
      }catch{/**/}
      window.dispatchEvent(new Event('synergy:store-changed'));
      // Simulated AI verification — 1.2s delay
      window.setTimeout(()=>{
        setStates(prev=>{
          const cur=prev[srcId]; if(!cur?.invoiceProofs) return prev;
          const updated=cur.invoiceProofs.map(p=>p.id===proofId
            ? {...p, verified:!isFourth, mismatch:isFourth?true:undefined}
            : p);
          const next={...prev,[srcId]:{...cur,invoiceProofs:updated}};
          saveStore(next); return next;
        });
        window.dispatchEvent(new Event('synergy:store-changed'));
      },1200);
    };

    if(canPreview){
      const reader=new FileReader();
      reader.onload=()=>finalize(typeof reader.result==='string'?reader.result:undefined);
      reader.onerror=()=>finalize();
      reader.readAsDataURL(file);
    } else {
      finalize();
    }
  },[]);

  const handleInvoiceDelete=useCallback((srcId:string,proofId:string)=>{
    setStates(prev=>{
      const cur=prev[srcId]; if(!cur?.invoiceProofs) return prev;
      const next={...prev,[srcId]:{...cur,invoiceProofs:cur.invoiceProofs.filter(p=>p.id!==proofId)}};
      saveStore(next); return next;
    });
    try{
      const actLog=JSON.parse(localStorage.getItem('synergy_activity_log_v1')||'[]') as unknown[];
      actLog.unshift({type:'invoice_proof_uploaded',label:'Invoice Proof Removed',detail:`Proof ${proofId.slice(-6)} removed from ${srcId}`,ref:'PROOF-'+proofId.slice(-6).toUpperCase(),ts:Date.now(),meta:{platform:srcId,proofId}});
      localStorage.setItem('synergy_activity_log_v1',JSON.stringify((actLog as unknown[]).slice(0,200)));
    }catch{/**/}
    window.dispatchEvent(new Event('synergy:store-changed'));
  },[]);

  const filtered=useMemo(()=>SOURCES.filter(s=>{
    const catOk=category==='all'||s.category===category;
    const q=search.trim().toLowerCase();
    const searchOk=!q||s.name.toLowerCase().includes(q)||s.desc.toLowerCase().includes(q);
    return catOk&&searchOk;
  }),[category,search]);

  const connectedCount=SOURCES.filter(s=>states[s.id]?.status==='connected').length;
  const totalEst=SOURCES.filter(s=>states[s.id]?.status==='connected'&&(s.monthlyAvgSAR??0)>0)
    .reduce((sum,s)=>sum+(s.monthlyAvgSAR??0),0);
  const totalDeclared=SOURCES.filter(s=>states[s.id]?.status==='connected')
    .reduce((sum,s)=>sum+(states[s.id]?.monthlyRevenueSAR??0),0);
  const revenueVerifiedCount=SOURCES.filter(s=>states[s.id]?.status==='connected'&&(states[s.id]?.monthlyRevenueSAR??0)>0).length;
  const allProofs=SOURCES.flatMap(s=>states[s.id]?.invoiceProofs??[]);
  const totalProofs=allProofs.length;
  const verifiedProofs=allProofs.filter(p=>p.verified).length;
  const totalProofAmountSAR=allProofs.filter(p=>p.verified).reduce((sum,p)=>sum+(p.amountSAR??0),0);
  const crossValidationRate=totalProofs>0?Math.round((verifiedProofs/totalProofs)*100):0;
  const pct=Math.round((connectedCount/SOURCES.length)*100);

  // Sentinel Behavioral Report — recompute whenever connections change
  const report=useMemo<BehavioralReport>(()=>getBehavioralReport(),[states]);
  const signalById=useMemo<Record<string,TrustSignal>>(()=>{
    const map:Record<string,TrustSignal>={};
    for(const s of report.signals) map[s.platformId]=s;
    return map;
  },[report]);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full min-h-0">
        {/* ── Floating score-delta toast — appears for ~2.4s after connect/disconnect ── */}
        <AnimatePresence>
          {scoreDelta && (
            <motion.div
              key={scoreDelta.label + scoreDelta.value}
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: 'spring', damping: 18, stiffness: 280 }}
              className="fixed top-20 right-6 z-[120] rounded-2xl border px-4 py-3 flex items-center gap-3 shadow-2xl"
              style={{
                background: scoreDelta.value > 0 ? '#ecfdf5' : '#fef2f2',
                borderColor: scoreDelta.value > 0 ? '#a7f3d0' : '#fecaca',
                boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
              }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: scoreDelta.value > 0 ? '#10b981' : '#ef4444', color: '#fff' }}>
                <span className="font-black text-[15px]">{scoreDelta.value > 0 ? '+' : ''}{scoreDelta.value}</span>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider"
                  style={{ color: scoreDelta.value > 0 ? '#047857' : '#b91c1c' }}>
                  {scoreDelta.value > 0 ? 'Score Increased' : 'Score Decreased'}
                </p>
                <p className="text-[12px] font-semibold" style={{ color: TEXT2 }}>
                  {scoreDelta.label} · Madar Score {scoreDelta.value > 0 ? 'gained' : 'lost'} {Math.abs(scoreDelta.value)} {Math.abs(scoreDelta.value) === 1 ? 'point' : 'points'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <header className="flex items-center justify-between px-6 h-14 border-b shrink-0" style={{borderColor:BORDER,background:CARD}}>
          <div className="flex items-center gap-2">
            <Plug size={16} style={{color:ACCENT}}/>
            <p className="text-sm font-extrabold" style={{color:TEXT}}>Connect Platforms</p>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-bold ml-1" style={{background:'#eff6ff',color:ACCENT}}>
              {SOURCES.length} platforms
            </span>
          </div>
          <button onClick={()=>navigate('/manual')}
            className="h-8 px-4 rounded-xl text-[12px] font-bold flex items-center gap-1.5 text-white cursor-pointer"
            style={{background:ACCENT}}>
            <PenLine size={13}/> Manual Entry
          </button>
        </header>

        <main className="flex-1 overflow-y-auto" style={{scrollbarWidth:'thin'}}>
          <div className="max-w-[1400px] mx-auto px-5 py-5 space-y-5">

            {/* Madar Score — single source of truth, shared with /credit and /room */}
            <UnifiedScoreCard refreshKey={connectedCount + totalProofs}/>

            {/* Banner */}
            <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}}
              className="rounded-2xl border p-5" style={{borderColor:BORDER,background:CARD}}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-[22px] font-black mb-1" style={{color:TEXT}}>
                    {connectedCount===0?'Connect your first platform 🚀':connectedCount<5?`${connectedCount} sources connected — keep going ⚡`:`${connectedCount} / ${SOURCES.length} sources — Sentinel at full power 🎯`}
                  </p>
                  <p className="text-[13px]" style={{color:TEXT2}}>
                    Connect your platforms to simulate your income profile and build a verifiable trust score
                  </p>
                </div>
                {totalProofs>0&&(
                  <motion.div initial={{opacity:0,scale:.9}} animate={{opacity:1,scale:1}}
                    className="flex-shrink-0 text-center px-6 py-3 rounded-2xl border"
                    style={{borderColor:'#6366f140',background:'#eef2ff'}}>
                    <div className="flex items-center gap-2 justify-center">
                      <FileCheck2 size={16} style={{color:'#4f46e5'}}/>
                      <span className="text-[13px] font-bold" style={{color:'#4338ca'}}>Verified Invoice Proofs</span>
                    </div>
                    <p className="text-[28px] font-black mt-0.5" style={{color:'#4f46e5'}}>{verifiedProofs}</p>
                    <p className="text-[10px]" style={{color:'#6366f1'}}>
                      Total declared SAR {totalProofAmountSAR.toLocaleString()} across {totalProofs} proof{totalProofs!==1?'s':''}
                    </p>
                    <p className="text-[9px] mt-0.5 font-semibold" style={{color:'#10b981'}}>
                      AI cross-validation rate: {crossValidationRate}%
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* Sentinel Trust Score Dashboard — aggregate behavioral insight */}
            <TrustDashboard report={report}/>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-xl border" style={{borderColor:BORDER,background:CARD}}>
                <Search size={14} style={{color:TEXT3}}/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search 43 platforms…"
                  className="flex-1 bg-transparent text-[13px] outline-none" style={{color:TEXT}}/>
                {search&&<button onClick={()=>setSearch('')} className="cursor-pointer"><X size={12} style={{color:TEXT3}}/></button>}
              </div>
              {/* Connected-only / All toggle — hide the noise of 40+ disconnected platforms by default */}
              <div className="flex rounded-xl border overflow-hidden shrink-0" style={{borderColor:BORDER,background:CARD}}>
                <button onClick={()=>setViewMode('connected')}
                  className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer"
                  style={viewMode==='connected'?{background:'#059669',color:'#fff'}:{color:TEXT2}}>
                  <CheckCircle2 size={12}/>Connected ({connectedCount})
                </button>
                <button onClick={()=>setViewMode('all')}
                  className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer border-l"
                  style={{...(viewMode==='all'?{background:ACCENT,color:'#fff'}:{color:TEXT2}),borderColor:BORDER}}>
                  <Globe size={12}/>All ({SOURCES.length})
                </button>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1" style={{scrollbarWidth:'none'}}>
                {CATEGORIES.map(cat=>{
                  const count=cat.id==='all'?SOURCES.length:SOURCES.filter(s=>s.category===cat.id).length;
                  return (
                    <button key={cat.id} onClick={()=>setCategory(cat.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer"
                      style={category===cat.id?{background:ACCENT,color:'#fff',borderColor:ACCENT}:{background:CARD,color:TEXT2,borderColor:BORDER}}>
                      <cat.icon size={11}/>{cat.label}
                      <span className="text-[10px] opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Connected platforms section (always shown first, ignores category filter so
                connected items live in their own section and never bleed into category grids) */}
            {(() => {
              const q = search.trim().toLowerCase();
              const searchOk = (s: SourceDef) => !q || s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q);
              // Connected = ALL connected platforms (search-aware, category-agnostic)
              const connectedList = SOURCES.filter(s => states[s.id]?.status === 'connected' && searchOk(s));
              // Available = category-filtered grid, but ALWAYS excluding connected
              const availableList = filtered.filter(s => states[s.id]?.status !== 'connected');
              return (
                <>
                  {connectedList.length > 0 && (
                    <section>
                      <div className="rounded-2xl border p-4 mb-4 flex items-center gap-3"
                        style={{ borderColor: '#a7f3d0', background: '#ecfdf5' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#059669' }}>
                          <CheckCircle2 size={18} className="text-white"/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-[14px] font-black tracking-tight" style={{color:'#065f46'}}>Active connections</h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white border"
                              style={{ borderColor: '#a7f3d0', color: '#065f46' }}>{connectedList.length} live</span>
                          </div>
                          <p className="text-[11px] font-semibold mt-0.5" style={{color:'#047857'}}>
                            Verified bridge · feeding AI agents & bank submission pipeline
                          </p>
                        </div>
                        <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-white border"
                          style={{ borderColor: '#a7f3d0', color: '#065f46' }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                          streaming
                        </div>
                      </div>
                      <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start">
                        <AnimatePresence>
                          {connectedList.map(source=>(
                            <SourceCard key={source.id} source={source} state={stateOf(source)}
                              signal={signalById[source.id]}
                              onAction={()=>setModal(source)}
                              onDisconnect={()=>handleDisconnect(source)}
                              onRevenueSave={(amt)=>handleRevenueSave(source,amt)}
                              onInvoiceUpload={(file,opts)=>handleInvoiceUpload(source.id,file,opts)}
                              onInvoiceDelete={(proofId)=>handleInvoiceDelete(source.id,proofId)}
                            />
                          ))}
                        </AnimatePresence>
                      </motion.div>
                    </section>
                  )}

                  {viewMode === 'all' && availableList.length > 0 && (
                    <section>
                      <button
                        onClick={() => setShowAvailable(v => !v)}
                        className="w-full rounded-2xl border p-4 mb-4 flex items-center gap-3 cursor-pointer hover:shadow-sm transition-shadow"
                        style={{ borderColor: BORDER, background: CARD }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f1f5f9' }}>
                          <Globe size={18} style={{ color: TEXT2 }}/>
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-2">
                            <h3 className="text-[14px] font-black tracking-tight" style={{color:TEXT}}>Available platforms</h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
                              style={{ borderColor: BORDER, background: CREAM, color: TEXT2 }}>{availableList.length}</span>
                          </div>
                          <p className="text-[11px] font-semibold mt-0.5" style={{color:TEXT3}}>
                            Click to {showAvailable ? 'collapse' : 'expand'} the catalog · 43 integrations
                          </p>
                        </div>
                        <ChevronRight size={16} style={{color:TEXT3, transform: showAvailable ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .2s'}}/>
                      </button>
                      <AnimatePresence>
                        {showAvailable && (
                          <motion.div layout
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start overflow-hidden">
                            {availableList.map(source=>(
                              <SourceCard key={source.id} source={source} state={stateOf(source)}
                                signal={signalById[source.id]}
                                onAction={()=>setModal(source)}
                                onDisconnect={()=>handleDisconnect(source)}
                                onRevenueSave={(amt)=>handleRevenueSave(source,amt)}
                                onInvoiceUpload={(file,opts)=>handleInvoiceUpload(source.id,file,opts)}
                                onInvoiceDelete={(proofId)=>handleInvoiceDelete(source.id,proofId)}
                              />
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </section>
                  )}

                  {connectedList.length === 0 && (viewMode === 'connected' || availableList.length === 0) && (
                    <div className="col-span-4 text-center py-16 rounded-2xl border" style={{borderColor:BORDER,background:CARD}}>
                      <Filter size={28} style={{color:TEXT3}} className="mx-auto mb-3"/>
                      <p className="text-sm font-semibold" style={{color:TEXT2}}>
                        {viewMode === 'connected' ? 'No platforms connected yet' : 'No platforms match your search'}
                      </p>
                      {viewMode === 'connected' && (
                        <button onClick={()=>setViewMode('all')}
                          className="mt-3 px-4 py-2 rounded-xl text-white text-[12px] font-bold cursor-pointer hover:opacity-90"
                          style={{background:ACCENT}}>
                          Browse all {SOURCES.length} platforms
                        </button>
                      )}
                    </div>
                  )}
                </>
              );
            })()}

          </div>
        </main>
      {modal&&<ConnectModal source={modal} onClose={()=>setModal(null)} onConnect={v=>handleConnect(modal,v)}/>}
      </div>
  );
}
