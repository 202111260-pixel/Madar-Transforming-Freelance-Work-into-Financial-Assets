/**
 * CreditPanelPage v2 — Madar
 * Composite risk score (Connections + Manual Projects + AI Report)
 * Transmission Flow diagram · Bank Review Status · Real bank logos
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSynergyStore } from '../lib/useSynergyStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, BarChart3, Link2, Droplets, CreditCard, Activity,
  Sparkles, PenLine, Shield, ShieldCheck, CheckCircle2, X, FileText,
  Download, Building2, ChevronRight, Clock, BadgeCheck,
  AlertTriangle, TrendingUp, Zap, ArrowRight, Loader2,
  Lock, CircleCheck, RefreshCw, Send, FileCheck, User,
  Layers, Network, ClipboardList, Info, Users, DollarSign,
  Cpu, Landmark, MessageCircle, MessageSquare, ScanLine, Hash,
  Workflow, Calendar as CalendarIcon, Bell, Search, XCircle,
  Upload, Copy,
} from 'lucide-react';
import { buildRiskReportPdf } from '../lib/synergyPdf';
import { computeUnifiedScore } from '../lib/scoreEngine';
import { sendEmail } from '../lib/sendgridEmail';
import { homeCurrencySymbol, toHomeCurrency } from '../lib/homeCurrency';
import { MODEL_LABELS } from '../lib/synergyPipeline';
import ThemeToggle from '../components/ThemeToggle';

/** Format a SAR-stored amount in the user's HOME currency (label + value). */
function fmtHome(sarAmount: number): string {
  return `${homeCurrencySymbol()} ${toHomeCurrency(sarAmount, 'SAR').toLocaleString()}`;
}

const CREAM = 'var(--cream)', CARD = 'var(--card)', BORDER = 'var(--border)';
const TEXT = 'var(--text)', TEXT2 = 'var(--text2)', TEXT3 = 'var(--text3)', ACCENT = 'var(--accent)';
const DARK = '#111827';
const CREDIT_STORE  = 'synergy_credit_offer_v1';
const CONN_STORE    = 'synergy_connections_v4';
const INV_STORE     = 'synergy_invoices_v1';
const ACTIVITY_STORE = 'synergy_activity_log_v1';
const BANK_REVIEW_STORE = 'synergy_bank_review_v1';
const REPORTS_STORE = 'synergy_reports_v1';
const BASE_BRIDGE_SAR = 200;
const PREMIUM_BRIDGE_SAR = 300; // unlocked when composite score > 70
const TOTAL_PLATFORMS = 12;

/* ═══════════════════════════════════════════════════════════
   Bank SVG Logos — brand-accurate colors & shapes
═══════════════════════════════════════════════════════════ */
const BankLogo = ({ idx, size = 40 }: { idx: number; size?: number }) => {
  const logos = [
    // Al-Rajhi Bank — green + Arabic arch motif
    <svg key={0} width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#006432"/>
      <path d="M8 28 Q12 18 20 18 Q28 18 32 28" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M14 28 Q17 22 20 22 Q23 22 26 28" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <circle cx="20" cy="14" r="3" fill="#fff"/>
      <rect x="10" y="29" width="20" height="2" rx="1" fill="#fff" opacity="0.6"/>
    </svg>,
    // Emirates NBD — navy + gold wave
    <svg key={1} width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#003087"/>
      <path d="M6 16 L12 16 L12 13 L18 13 L18 16 L22 16 L22 13 L28 13 L28 16 L34 16" stroke="#c8a85b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="6" y="20" width="28" height="2" rx="1" fill="#c8a85b" opacity="0.8"/>
      <rect x="10" y="25" width="20" height="2" rx="1" fill="#c8a85b" opacity="0.5"/>
      <rect x="14" y="29" width="12" height="2" rx="1" fill="#c8a85b" opacity="0.3"/>
    </svg>,
    // Alinma Bank — violet + star
    <svg key={2} width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#6b0d72"/>
      <path d="M20 8 L22.5 15 L30 15 L24 19.5 L26.5 27 L20 22.5 L13.5 27 L16 19.5 L10 15 L17.5 15 Z" fill="#fff" opacity="0.9"/>
    </svg>,
    // Riyad Bank — dark blue + geometric
    <svg key={3} width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#1a3a6e"/>
      <rect x="8" y="12" width="10" height="16" rx="2" fill="#fff" opacity="0.9"/>
      <rect x="22" y="17" width="10" height="11" rx="2" fill="#fff" opacity="0.9"/>
      <rect x="8" y="30" width="24" height="2" rx="1" fill="#c8a85b"/>
    </svg>,
  ];
  return logos[idx % logos.length];
};

/* Bank metadata */
const BANKS = [
  { name: 'Al-Rajhi Bank',  country: 'Saudi Arabia', badge: 'Al-Rajhi',     color: '#006432' },
  { name: 'Emirates NBD',   country: 'UAE',          badge: 'Emirates NBD', color: '#003087' },
  { name: 'Alinma Bank',    country: 'Saudi Arabia', badge: 'Alinma',       color: '#6b0d72' },
  { name: 'Riyad Bank',     country: 'Saudi Arabia', badge: 'Riyad Bank',   color: '#1a3a6e' },
];

/* ═══════════════════════════════════════════════════════════
   Nav
═══════════════════════════════════════════════════════════ */
const NAV = [
  { icon: BarChart3,  label: 'Dashboard',    path: '/' },
  { icon: Link2,      label: 'Connections',  path: '/connections' },
  { icon: Droplets,   label: 'Liquidity',    path: '/manual' },
  { icon: Brain,      label: 'AI Room',      path: '/room' },
  { icon: CreditCard, label: 'Credit Panel', path: '/credit', active: true },
  { icon: Activity,   label: 'Activity Log', path: '/activity' },
];

/* ═══════════════════════════════════════════════════════════
   Composite Risk Score
═══════════════════════════════════════════════════════════ */
interface ScoreBreakdown {
  total: number;
  aiScore: number;           // from pipeline
  connScore: number;         // from connections
  invScore: number;          // from manual invoices
  clientBonus: number;       // +5% per unique client
  revenueBonus: number;      // +2 pts per platform with declared revenue
  connectedCount: number;
  revenueVerifiedCount: number;
  clientCount: number;
  invTotal: number;
  invPaid: number;
  label: string;
  labelColor: string;
  premiumBridge: boolean;    // score > 70 → higher cap
}

function computeCompositeScore(pipelineScore: number): ScoreBreakdown {
  // Delegate to the unified score engine — ALL pages share these numbers now.
  const unified = computeUnifiedScore({ latestAiScore: pipelineScore });
  const aiC      = unified.components.find(c => c.key === 'ai')!;
  const connC    = unified.components.find(c => c.key === 'connections')!;
  const projC    = unified.components.find(c => c.key === 'projects')!;
  const clientsC = unified.components.find(c => c.key === 'clients')!;
  const proofsC  = unified.components.find(c => c.key === 'proofs')!;

  const total = unified.total;

  let label = 'Poor', labelColor = '#dc2626';
  if (total >= 85)      { label = 'Excellent';        labelColor = '#15803d'; }
  else if (total >= 70) { label = 'Good — Bank-Ready'; labelColor = '#059669'; }
  else if (total >= 50) { label = 'Fair';             labelColor = '#d97706'; }

  return {
    total,
    aiScore:    aiC.raw,
    connScore:  connC.raw,
    invScore:   projC.raw,
    clientBonus: clientsC.contribution,
    revenueBonus: proofsC.contribution,         // re-purposed slot: "Verified Proofs" bonus
    connectedCount: unified.meta.connectedCount,
    revenueVerifiedCount: unified.meta.verifiedProofs,
    clientCount: unified.meta.uniqueClients,
    invTotal: unified.meta.invoiceCount,
    invPaid:  unified.meta.paidCount,
    label, labelColor,
    premiumBridge: unified.bankReady,
  };
}

/* ═══════════════════════════════════════════════════════════
   Types
═══════════════════════════════════════════════════════════ */
export interface CreditOffer {
  offerRef: string; bankIdx: number; freelancerName: string; activeSince: string;
  invoicesPaid: number; invoiceRef: string; clientName: string; invoiceAmountSAR: number;
  bridgeAmountSAR: number; coveragePercent: number; rateMonthly: number; termDays: number;
  repaymentRef: string; pendingSAR: number; expectedSAR: number; defaultRisk: number;
  riskScore: number; paymentProb: number; blockchainHash: string; generatedAt: number;
  pipeline?: unknown;
}

function buildDemoOffer(): CreditOffer {
  // Derive from REAL store data when available (connections + invoices) so the
  // user does not see fake "Salem Al-Harthy / 3000 SAR" placeholders. Falls
  // back to a clearly-labelled empty-state offer only when nothing is wired.
  try {
    const conns = JSON.parse(localStorage.getItem('synergy_connections_v4') || '{}') as Record<
      string, { status?: string; monthlyRevenueSAR?: number }
    >;
    const invs = JSON.parse(localStorage.getItem('synergy_invoices_v1') || '[]') as Array<{
      status?: string; clientName?: string; amount?: number; currency?: string;
    }>;
    const connectedCount = Object.values(conns).filter(c => c.status === 'connected').length;
    const monthlyRevenueSAR = Object.values(conns).reduce(
      (s, c) => s + (c.status === 'connected' ? (c.monthlyRevenueSAR ?? 0) : 0), 0,
    );
    const pendingInvs = invs.filter(i => i.status === 'pending' || i.status === 'overdue');
    const sarRates: Record<string, number> = {
      SAR: 1, USD: 3.75, OMR: 9.75, AED: 1.02, EUR: 4.1, EGP: 0.075,
      BHD: 9.95, KWD: 12.2, QAR: 1.03,
    };
    const pendingSAR = pendingInvs.reduce(
      (s, i) => s + Math.round((i.amount ?? 0) * (sarRates[i.currency ?? 'SAR'] ?? 1)), 0,
    );
    const portfolioBaseSAR = pendingSAR > 0 ? pendingSAR : monthlyRevenueSAR;
    const hasRealData = connectedCount > 0 || invs.length > 0;
    if (hasRealData && portfolioBaseSAR > 0) {
      const unified = computeUnifiedScore({});
      const score = unified.total;
      const cap = score >= 70 ? 0.85 : score >= 50 ? 0.7 : 0.6;
      const bridgeAmountSAR = Math.max(80, Math.round(portfolioBaseSAR * cap / 10) * 10);
      const uniqueClients = new Set(
        invs.map(i => (i.clientName || '').trim().toLowerCase()).filter(Boolean),
      ).size;
      const clientLabel = uniqueClients > 1
        ? `ALL CLIENTS (Portfolio Scan)`
        : (invs[0]?.clientName || 'Portfolio');
      return {
        offerRef: 'LB-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        bankIdx: 0,
        freelancerName: 'You',
        activeSince: 'Live',
        invoicesPaid: invs.filter(i => i.status === 'paid').length,
        invoiceRef: 'PORTFOLIO',
        clientName: clientLabel,
        invoiceAmountSAR: Math.round(portfolioBaseSAR),
        bridgeAmountSAR,
        coveragePercent: Math.round(cap * 100),
        rateMonthly: score >= 70 ? 1.2 : score >= 50 ? 1.5 : 2.0,
        termDays: 30,
        repaymentRef: '#PORTFOLIO',
        pendingSAR: Math.round(pendingSAR),
        expectedSAR: Math.round(pendingSAR * 0.95),
        defaultRisk: Math.max(2, Math.round((100 - score) / 4 * 10) / 10),
        riskScore: score,
        paymentProb: Math.min(99, score + 5),
        blockchainHash: '—',
        generatedAt: Date.now(),
      };
    }
  } catch { /* fall through to empty-state offer */ }
  return {
    offerRef: 'LB-EMPTY', bankIdx: 0, freelancerName: 'You', activeSince: '—',
    invoicesPaid: 0, invoiceRef: '—', clientName: 'No portfolio data yet',
    invoiceAmountSAR: 0, bridgeAmountSAR: 0, coveragePercent: 0,
    rateMonthly: 1.2, termDays: 30, repaymentRef: '#—',
    pendingSAR: 0, expectedSAR: 0, defaultRisk: 0,
    riskScore: 0, paymentProb: 0, blockchainHash: '—',
    generatedAt: Date.now(),
  };
}
function loadOffer(): CreditOffer {
  // Defensive load: the seed scripts (Supabase mirror) may store a
  // domain-shape `creditOffer` ({status, principalOMR, bank, ...}) that does
  // NOT match the legacy `CreditOffer` interface. We always merge with the
  // demo offer so every required string/number field is present, preventing
  // crashes like `Cannot read properties of undefined (reading 'replace')`.
  const fallback = buildDemoOffer();
  try {
    const r = localStorage.getItem(CREDIT_STORE);
    if (!r) return fallback;
    const parsed = JSON.parse(r) as Partial<CreditOffer> & Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return fallback;
    // Map seed shape (principalOMR / bank) onto legacy interface fields when
    // the legacy fields are missing, so OMR seeds still drive the panel.
    const omrToSar = 9.75;
    const seedPrincipal = typeof parsed.principalOMR === 'number'
      ? Math.round((parsed.principalOMR as number) * omrToSar) : undefined;
    const seedCollateral = typeof parsed.collateralAmountOMR === 'number'
      ? Math.round((parsed.collateralAmountOMR as number) * omrToSar) : undefined;
    return {
      ...fallback,
      ...parsed,
      offerRef: typeof parsed.offerRef === 'string' && parsed.offerRef
        ? parsed.offerRef : fallback.offerRef,
      freelancerName: typeof parsed.freelancerName === 'string' && parsed.freelancerName
        ? parsed.freelancerName : fallback.freelancerName,
      clientName: typeof parsed.clientName === 'string' && parsed.clientName
        ? parsed.clientName : (parsed.collateralClient as string | undefined) ?? fallback.clientName,
      invoiceRef: typeof parsed.invoiceRef === 'string' && parsed.invoiceRef
        ? parsed.invoiceRef : (parsed.collateralInvoiceId as string | undefined) ?? fallback.invoiceRef,
      repaymentRef: typeof parsed.repaymentRef === 'string' && parsed.repaymentRef
        ? parsed.repaymentRef : fallback.repaymentRef,
      blockchainHash: typeof parsed.blockchainHash === 'string' && parsed.blockchainHash
        ? parsed.blockchainHash : fallback.blockchainHash,
      activeSince: typeof parsed.activeSince === 'string' && parsed.activeSince
        ? parsed.activeSince : fallback.activeSince,
      bridgeAmountSAR: typeof parsed.bridgeAmountSAR === 'number'
        ? parsed.bridgeAmountSAR : seedPrincipal ?? fallback.bridgeAmountSAR,
      invoiceAmountSAR: typeof parsed.invoiceAmountSAR === 'number'
        ? parsed.invoiceAmountSAR : seedCollateral ?? fallback.invoiceAmountSAR,
      bankIdx: typeof parsed.bankIdx === 'number' ? parsed.bankIdx : fallback.bankIdx,
      invoicesPaid: typeof parsed.invoicesPaid === 'number'
        ? parsed.invoicesPaid : fallback.invoicesPaid,
      coveragePercent: typeof parsed.coveragePercent === 'number'
        ? parsed.coveragePercent : fallback.coveragePercent,
      rateMonthly: typeof parsed.rateMonthly === 'number'
        ? parsed.rateMonthly : ((parsed.feePct as number) ?? fallback.rateMonthly),
      termDays: typeof parsed.termDays === 'number' ? parsed.termDays : fallback.termDays,
      pendingSAR: typeof parsed.pendingSAR === 'number' ? parsed.pendingSAR : fallback.pendingSAR,
      expectedSAR: typeof parsed.expectedSAR === 'number'
        ? parsed.expectedSAR : fallback.expectedSAR,
      defaultRisk: typeof parsed.defaultRisk === 'number'
        ? parsed.defaultRisk : fallback.defaultRisk,
      riskScore: typeof parsed.riskScore === 'number'
        ? parsed.riskScore : ((parsed.scoreAtApproval as number) ?? fallback.riskScore),
      paymentProb: typeof parsed.paymentProb === 'number'
        ? parsed.paymentProb : fallback.paymentProb,
      generatedAt: typeof parsed.generatedAt === 'number'
        ? parsed.generatedAt : fallback.generatedAt,
    };
  } catch { /**/ }
  return fallback;
}

type ReviewStep = 'idle' | 'sent' | 'reviewed' | 'decision';

interface BankReviewState {
  offerRef: string;
  bankIdx: number;
  step: ReviewStep;
  submittedAt: number;
  reviewedAt?: number | null;
  decidedAt?: number | null;
  decision?: 'approved' | 'conditional' | null;
  score: number;
  response: string;
  source?: 'agent-room' | 'credit-panel';
}

function clampScore(v: number): number {
  if (!Number.isFinite(v)) return 50;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function loadBankReviewState(offerRef: string): BankReviewState | null {
  try {
    const raw = localStorage.getItem(BANK_REVIEW_STORE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BankReviewState;
    if (!parsed || parsed.offerRef !== offerRef) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveBankReviewState(state: BankReviewState) {
  localStorage.setItem(BANK_REVIEW_STORE, JSON.stringify(state));
}

/* ═══════════════════════════════════════════════════════════
   Small components
═══════════════════════════════════════════════════════════ */
function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 65 ? '#22c55e' : score >= 45 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e7e5e4" strokeWidth="8"/>
      <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ - dash}
        initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.2, ease: 'easeOut' }}/>
    </svg>
  );
}

function ScoreBar({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon size={10} style={{ color }} />
          <span className="text-[11px] font-medium" style={{ color: TEXT2 }}>{label}</span>
        </div>
        <span className="text-[11px] font-black" style={{ color }}>{value}/100</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#e7e5e4' }}>
        <motion.div className="h-full rounded-full" style={{ background: color }}
          initial={{ width: 0 }} animate={{ width: value + '%' }}
          transition={{ duration: 0.9, ease: 'easeOut' }}/>
      </div>
    </div>
  );
}

function TimelineStep({ n, label, sub, isLast, done }: { n: number; label: string; sub: string; isLast?: boolean; done?: boolean }) {
  return (
    <div className="flex flex-col items-center flex-1 relative">
      <div className={'w-8 h-8 rounded-full flex items-center justify-center z-10 ' +
        (done ? 'bg-emerald-600' : n === 1 ? 'bg-gray-900' : 'border-2')}
        style={!done && n !== 1 ? { borderColor: TEXT3, background: CARD } : {}}>
        {done
          ? <CheckCircle2 size={15} className="text-white" />
          : <span className={'text-[12px] font-black ' + (n === 1 ? 'text-white' : '')} style={n !== 1 ? { color: TEXT3 } : {}}>{n}</span>}
      </div>
      {!isLast && (
        <div className="absolute top-4 left-[calc(50%+16px)] right-[-50%] h-[1px] border-t-2 border-dashed z-0" style={{ borderColor: BORDER }}/>
      )}
      <p className="text-[10px] font-semibold mt-2 uppercase tracking-wide text-center" style={{ color: TEXT3 }}>{label}</p>
      <p className="text-[12px] font-extrabold mt-0.5 text-center" style={{ color: TEXT }}>{sub}</p>
    </div>
  );
}

function Scenario({ bullet, title, sub, recommended }: { bullet: string; title: string; sub: string; recommended?: boolean }) {
  return (
    <div className={'flex items-start gap-2.5 py-2.5 border-b last:border-0 ' + (recommended ? '' : 'opacity-60')} style={{ borderColor: BORDER }}>
      <span className={'text-[14px] font-black mt-0.5 shrink-0 ' + (recommended ? 'text-blue-600' : '')} style={!recommended ? { color: TEXT3 } : {}}>{bullet}</span>
      <div className="flex-1">
        <p className={'text-[13px] font-bold ' + (recommended ? 'text-blue-700' : '')} style={!recommended ? { color: TEXT } : {}}>{title}</p>
        <p className="text-[11px] mt-0.5" style={{ color: TEXT3 }}>{sub}</p>
      </div>
    </div>
  );
}

/* ── Transmission Flow diagram ── */
function TransmissionFlow({ step }: { step: ReviewStep }) {
  const submitted = step === 'sent' || step === 'reviewed' || step === 'decision';
  const receivedByBank = step === 'reviewed' || step === 'decision';

  const steps = [
    { icon: User,      label: 'User',         sub: 'clicks Send',      done: submitted },
    { icon: FileCheck, label: 'PDF',          sub: 'signed & sealed',  done: submitted },
    { icon: Send,      label: 'API',          sub: 'POST /reports',    done: submitted },
    { icon: Building2, label: 'Partner Bank', sub: receivedByBank ? 'received' : '(simulated)', done: receivedByBank },
  ];
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER, background: CARD }}>
      <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: BORDER }}>
        <Network size={14} style={{ color: TEXT3 }}/>
        <p className="text-[15px] font-extrabold" style={{ fontFamily: "'Caveat',cursive", color: TEXT }}>Transmission Flow</p>
      </div>
      <div className="px-5 py-5">
        <div className="flex items-center justify-between gap-2">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={'w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all ' +
                    (step.done ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50')}
                    style={!step.done && i === steps.length - 1 ? { borderColor: '#003087', background: '#eef4ff' } : {}}>
                    <Icon size={20} style={{ color: step.done ? '#059669' : i === steps.length - 1 ? '#003087' : TEXT3 }}/>
                  </div>
                  <p className="text-[11px] font-bold mt-1.5 text-center" style={{ color: TEXT }}>{step.label}</p>
                  <p className="text-[9px] text-center" style={{ color: TEXT3 }}>{step.sub}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="flex items-center w-6 shrink-0 mb-4">
                    <div className={'flex-1 h-[2px] ' + (step.done ? 'bg-emerald-400' : '')} style={{ background: step.done ? undefined : BORDER }}/>
                    <ArrowRight size={10} style={{ color: step.done ? '#059669' : TEXT3 }}/>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Bank Review Status ── */
function BankReviewStatus({
  offer,
  review,
  onSubmitToBank,
  onDownloadPdf,
}: {
  offer: CreditOffer;
  review: BankReviewState | null;
  onSubmitToBank: () => void;
  onDownloadPdf: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const step = review?.step || 'idle';

  useEffect(() => {
    if (!review || review.step === 'decision') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [review]);

  const elapsed = review ? Math.max(0, Math.floor((now - review.submittedAt) / 1000)) : 0;
  const currentStepIdx = [
    { key: 'sent', done: step === 'sent' || step === 'reviewed' || step === 'decision' },
    { key: 'reviewed', done: step === 'reviewed' || step === 'decision' },
    { key: 'decision', done: step === 'decision' },
  ].findIndex(s => !s.done);

  const steps = [
    {
      key: 'sent',
      label: 'Sent',
      done: step === 'sent' || step === 'reviewed' || step === 'decision',
      time: review?.submittedAt ? new Date(review.submittedAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—',
    },
    {
      key: 'reviewed',
      label: 'Reviewed',
      done: step === 'reviewed' || step === 'decision',
      time: review?.reviewedAt ? new Date(review.reviewedAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—',
    },
    {
      key: 'decision',
      label: 'Decision',
      done: step === 'decision',
      time: review?.decidedAt
        ? `${review.decision === 'approved' ? 'Approved' : 'Conditional'} · ${review.score}/100`
        : step === 'idle' ? '—' : `pending · ${elapsed}s`,
    },
  ];

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER, background: CARD }}>
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-2">
          <BankLogo idx={offer.bankIdx} size={24}/>
          <p className="text-[15px] font-extrabold" style={{ fontFamily: "'Caveat',cursive", color: TEXT }}>Bank Review Status</p>
        </div>
        {step === 'idle' && (
          <button onClick={onSubmitToBank}
            className="h-7 px-3 rounded-lg text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer"
            style={{ background: ACCENT }}>
            <Send size={10}/> Submit
          </button>
        )}
      </div>
      <div className="p-5 space-y-4">
        {/* Steps */}
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={'w-9 h-9 rounded-full flex items-center justify-center border-2 ' +
                  (s.done ? 'bg-gray-900 border-gray-900' :
                   step !== 'idle' && i === currentStepIdx ? 'border-blue-400 bg-blue-50' :
                   'border-gray-200 bg-gray-50')}>
                  {s.done
                    ? <CheckCircle2 size={16} className="text-white"/>
                    : step !== 'idle' && i === currentStepIdx
                      ? <Loader2 size={14} className="text-blue-500 animate-spin"/>
                      : <span className="text-[11px] font-bold" style={{ color: TEXT3 }}>{i + 1}</span>}
                </div>
                <p className="text-[11px] font-bold mt-1" style={{ color: s.done ? TEXT : TEXT3 }}>{s.label}</p>
                <p className="text-[9px]" style={{ color: TEXT3 }}>{s.time}</p>
                {!s.done && step !== 'idle' && i === currentStepIdx && (
                  <p className="text-[9px]" style={{ color: ACCENT }}>pending · {elapsed}s</p>
                )}
              </div>
              {i < steps.length - 1 && (
                <div className="w-8 h-[2px] mb-5" style={{ background: s.done ? '#111827' : BORDER }}/>
              )}
            </div>
          ))}
        </div>

        {/* Response preview */}
        {step !== 'idle' && review && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-xl border" style={{ borderColor: BORDER, background: CREAM }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: TEXT3 }}>
              Bank response preview:
            </p>
            <p className="text-[13px] italic font-semibold" style={{ color: TEXT }}>
              "{review.response}"
            </p>
            {step === 'decision' && (
              <div className="flex items-center gap-1.5 mt-2">
                <CheckCircle2 size={12} className={review.decision === 'approved' ? 'text-emerald-500' : 'text-amber-500'}/>
                <span className="text-[11px] font-bold" style={{ color: review.decision === 'approved' ? '#047857' : '#92400e' }}>
                  {review.decision === 'approved' ? 'Bank Approved' : 'Conditional Approval'} — Score {review.score}/100
                </span>
              </div>
            )}
            {step === 'decision' && (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                padding: '8px 16px',
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span style={{ color: '#059669', fontWeight: 700, fontSize: 13 }}>❆</span>
                <span style={{ color: '#065f46', fontSize: 12 }}>
                  This is an Islamic factoring contract — the 2.2% admin fee is fixed and never compounds.
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* PDF download row */}
        <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: BORDER }}>
          <FileText size={12} style={{ color: TEXT3 }}/>
          <span className="text-[11px] flex-1" style={{ color: TEXT3 }}>
            RISK_REPORT_{offer.offerRef}.pdf
            <span className="ml-1 text-[10px]">· 2.3 MB · signed</span>
          </span>
          <button onClick={onDownloadPdf}
            className="h-7 px-3 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-gray-50"
            style={{ borderColor: BORDER, color: TEXT2 }}>
            <Download size={11}/> Download
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   BankAnalysisLiveOverlay — pre-submission AI underwriting theatre
   ─────────────────────────────────────────────────────────────────
   Slow, bank-operation feel · 6 agents over ~19s with streaming
   terminal console. Mimics a real underwriting room — agent cards
   + ZenMux router console showing live POST /chat/completions calls.
   ══════════════════════════════════════════════════════════════════ */
function BankAnalysisLiveOverlay({
  offer, bankName, score, onComplete, onCancel,
}: {
  offer: CreditOffer;
  bankName: string;
  score: number;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const TOTAL_DURATION = 19_200;
  const [t0] = useState(() => performance.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const e = Math.min(TOTAL_DURATION + 1_400, performance.now() - t0);
      setElapsed(e);
      if (e < TOTAL_DURATION + 1_400) raf = requestAnimationFrame(tick);
      else onComplete();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [t0, onComplete]);

  const bridgeHome = toHomeCurrency(offer.bridgeAmountSAR, 'SAR').toLocaleString();
  const homeSym = homeCurrencySymbol();

  /* 6 agents · staggered start/finish · totals ~19.2s */
  const agents = useMemo(() => [
    { key: 'profiler',   label: 'Profiler',   role: 'Identity & Market Context',  model: MODEL_LABELS.profiler   ?? 'deepseek/deepseek-r1-0528',   color: '#0ea5e9', icon: User,         startAt:     0, finishAt:  3_800, tokens: 1_124 },
    { key: 'sentinel',   label: 'Sentinel',   role: 'Risk Forensics',             model: MODEL_LABELS.sentinel   ?? 'deepseek/deepseek-r1-0528',   color: '#dc2626', icon: ShieldCheck,  startAt: 1_200, finishAt:  7_500, tokens: 1_842 },
    { key: 'negotiator', label: 'Negotiator', role: 'Collection Strategy',        model: MODEL_LABELS.negotiator ?? 'google/gemini-3.1-pro',       color: '#059669', icon: MessageSquare,startAt: 2_400, finishAt: 10_400, tokens: 2_105 },
    { key: 'treasurer',  label: 'Treasurer',  role: 'Cashflow Underwriting',      model: MODEL_LABELS.treasurer  ?? 'anthropic/claude-opus-4.6',   color: '#2563eb', icon: Landmark,     startAt: 3_600, finishAt: 13_800, tokens: 2_387 },
    { key: 'master',     label: 'Master',     role: 'Consensus + Verdict',        model: MODEL_LABELS.master     ?? 'anthropic/claude-opus-4.6',   color: '#7c3aed', icon: Brain,        startAt:10_400, finishAt: 17_200, tokens: 1_564 },
    { key: 'auditor',    label: 'Auditor',    role: 'Compliance & Validation',    model: MODEL_LABELS.auditor    ?? 'anthropic/claude-opus-4.6',   color: '#f59e0b', icon: BadgeCheck,   startAt:15_200, finishAt: 19_200, tokens: 1_287 },
  ] as const, []);

  /* Streaming console log entries (revealed as elapsed crosses each `at`) */
  const logEntries = useMemo(() => [
    { at:    250, agent: 'profiler',   text: 'POST /chat/completions → deepseek/deepseek-r1-0528' },
    { at:    900, agent: 'profiler',   text: `loading freelancer profile · ref ${offer.offerRef}` },
    { at:  1_700, agent: 'profiler',   text: 'industry sector classified · platform_trust_index = 0.91' },
    { at:  2_900, agent: 'profiler',   text: 'geographic_risk_score = 0.18 · GCC tier-1 economy' },
    { at:  3_800, agent: 'profiler',   text: 'verdict ready → operator profile = low-risk' },
    { at:  1_500, agent: 'sentinel',   text: 'POST /chat/completions → deepseek/deepseek-r1-0528' },
    { at:  2_300, agent: 'sentinel',   text: 'parsing 16 invoices · 12 platform connectors' },
    { at:  3_700, agent: 'sentinel',   text: 'cross-validating amounts vs Notion + GitHub commit history' },
    { at:  5_200, agent: 'sentinel',   text: 'invoice_authenticity_score = 0.94 · fraud_signal = none' },
    { at:  6_800, agent: 'sentinel',   text: `composite risk score = ${score}/100 · default_risk 18%` },
    { at:  7_500, agent: 'sentinel',   text: 'verdict ready → trust grade B+' },
    { at:  2_700, agent: 'negotiator', text: 'POST /chat/completions → google/gemini-3.1-pro-preview' },
    { at:  4_400, agent: 'negotiator', text: 'analysing prior collection history (avg delay = 4.2d)' },
    { at:  6_300, agent: 'negotiator', text: 'simulating 4 dunning ladders · channel = SMS first' },
    { at:  8_200, agent: 'negotiator', text: `expected DSO = ${offer.termDays - 8}d · best-case ${offer.termDays - 14}d` },
    { at: 10_400, agent: 'negotiator', text: 'verdict ready → recovery plan composed' },
    { at:  4_100, agent: 'treasurer',  text: 'POST /chat/completions → anthropic/claude-opus-4.6' },
    { at:  6_000, agent: 'treasurer',  text: `computing 6-month cashflow projection · ${homeSym} base` },
    { at:  8_400, agent: 'treasurer',  text: `advance ${homeSym} ${bridgeHome} · ATR ${offer.coveragePercent}%` },
    { at: 10_700, agent: 'treasurer',  text: 'serviceable_income = 7,500 · obligations = 1,650/mo' },
    { at: 12_400, agent: 'treasurer',  text: 'repayment coverage ratio = 1.42x · capital adequacy ✓' },
    { at: 13_800, agent: 'treasurer',  text: 'verdict ready → factoring approved' },
    { at: 10_700, agent: 'master',     text: 'awaiting tri-agent consensus …' },
    { at: 11_900, agent: 'master',     text: 'merging Profiler + Sentinel + Negotiator + Treasurer outputs' },
    { at: 13_800, agent: 'master',     text: 'consensus weights · sentinel 0.32 · treasurer 0.28' },
    { at: 15_400, agent: 'master',     text: 'no contradictions detected · confidence = 0.82' },
    { at: 16_400, agent: 'master',     text: 'composing executive summary in Arabic + English' },
    { at: 17_200, agent: 'master',     text: `master_decision = APPROVED · score ${score}/100` },
    { at: 15_500, agent: 'auditor',    text: 'POST /chat/completions → anthropic/claude-opus-4.6' },
    { at: 16_700, agent: 'auditor',    text: 'consistency_score = 0.96 · contradictions_found = 0' },
    { at: 17_800, agent: 'auditor',    text: 'confidence interval [0.88 – 0.94] · validation_passed ✓' },
    { at: 18_600, agent: 'auditor',    text: 'signing PDF · embedding SHA-256 cryptographic seal' },
    { at: 19_200, agent: 'auditor',    text: 'audit complete → ready for transmission' },
  ] as const, [offer.offerRef, offer.termDays, offer.coveragePercent, score, homeSym, bridgeHome]);

  const visibleLogs = logEntries.filter(e => elapsed >= e.at).slice(-9);
  const allDone = elapsed >= TOTAL_DURATION;
  const overallProgress = Math.min(1, elapsed / TOTAL_DURATION);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[85] flex items-center justify-center px-4 py-6 overflow-y-auto"
      style={{ background: 'radial-gradient(ellipse at center, rgba(15,23,42,0.94), rgba(2,6,23,0.99))', backdropFilter: 'blur(10px)' }}
    >
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 22, stiffness: 220 }}
        className="relative z-10 w-full max-w-[860px] rounded-3xl overflow-hidden"
        style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
        }}
      >
        {/* Top progress rail */}
        <div className="h-1" style={{ background: '#f1f5f9' }}>
          <motion.div
            className="h-full"
            style={{
              width: `${overallProgress * 100}%`,
              background: 'linear-gradient(90deg, #0ea5e9, #dc2626, #059669, #2563eb, #7c3aed, #f59e0b)',
              boxShadow: '0 0 12px rgba(124,58,237,0.6)',
            }}
          />
        </div>

        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: BORDER }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#0f172a' }}>
            <Cpu size={17} className="text-white"/>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-extrabold leading-tight" style={{ color: TEXT }}>AI Underwriting Theater</p>
            <p className="text-[11px] font-mono leading-tight" style={{ color: TEXT3 }}>
              6 LLMs · ZenMux router · pre-submission analysis for {bankName}
            </p>
          </div>
          <span className={'inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ' + (allDone ? 'text-emerald-700' : 'text-blue-700')}
            style={{ borderColor: allDone ? '#a7f3d0' : '#bfdbfe', background: allDone ? '#ecfdf5' : '#eff6ff' }}>
            <span className={'w-1.5 h-1.5 rounded-full ' + (allDone ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse')}/>
            {allDone ? 'consensus reached' : 'reasoning'}
            <span className="font-mono">· {(elapsed / 1000).toFixed(1)}s</span>
          </span>
          <button onClick={onCancel} className="hover:opacity-70 ml-1" aria-label="Cancel">
            <X size={18} style={{ color: TEXT3 }}/>
          </button>
        </div>

        {/* Reference meta strip — terminal style */}
        <div className="px-5 py-2 border-b flex items-center gap-4 font-mono text-[10.5px]"
          style={{ borderColor: BORDER, background: '#0f172a', color: '#94a3b8' }}>
          <div className="flex items-center gap-1.5"><Hash size={10}/> <span>{offer.offerRef}</span></div>
          <div className="flex items-center gap-1.5"><DollarSign size={10}/> <span>{homeSym} {bridgeHome}</span></div>
          <div className="flex items-center gap-1.5"><FileCheck size={10}/> <span>LTV {offer.coveragePercent}%</span></div>
          <div className="flex items-center gap-1.5"><Clock size={10}/> <span>{offer.termDays}d term</span></div>
          <div className="ml-auto flex items-center gap-1.5"><Lock size={10}/> <span>TLS 1.3 · zero human review</span></div>
        </div>

        {/* Agent grid (3 cols × 2 rows) */}
        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" style={{ background: CREAM }}>
          {agents.map(a => {
            const started   = elapsed >= a.startAt;
            const finished  = elapsed >= a.finishAt;
            const running   = started && !finished;
            const progress  = started ? Math.min(1, (elapsed - a.startAt) / (a.finishAt - a.startAt)) : 0;
            const liveTokens = Math.round(a.tokens * progress);
            const Icon = a.icon;
            return (
              <div key={a.key} className="rounded-xl border p-3 relative overflow-hidden"
                style={{
                  borderColor: finished ? a.color + '60' : BORDER,
                  background: '#fff',
                }}>
                {/* progress bar (top edge) */}
                <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: '#f1f5f9' }}>
                  <div className="h-full transition-all duration-200"
                    style={{ width: (progress * 100) + '%', background: a.color }}/>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: finished ? a.color : '#f1f5f9', color: finished ? '#fff' : a.color }}>
                    {running
                      ? <Loader2 size={16} className="animate-spin"/>
                      : finished ? <CheckCircle2 size={16}/> : <Icon size={16}/>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[12px] font-extrabold leading-tight" style={{ color: TEXT }}>{a.label}</p>
                      {finished && <BadgeCheck size={11} style={{ color: a.color }}/>}
                    </div>
                    <p className="text-[10px] font-semibold leading-tight" style={{ color: TEXT3 }}>{a.role}</p>
                    <p className="text-[9px] font-mono mt-1 truncate" style={{ color: TEXT3 }}>{a.model}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t" style={{ borderColor: BORDER }}>
                  <span className="text-[10px] font-mono" style={{ color: started ? TEXT2 : TEXT3 }}>
                    {liveTokens.toLocaleString()} <span style={{ color: TEXT3 }}>tok</span>
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: finished ? a.color : running ? '#2563eb' : TEXT3 }}>
                    {finished ? 'done' : running ? 'streaming' : 'queued'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live console */}
        <div className="px-5 py-3 border-t font-mono text-[11px] space-y-1"
          style={{ borderColor: BORDER, background: '#0f172a', minHeight: 180 }}>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold" style={{ color: '#64748b' }}>
            <Workflow size={11}/>
            <span>console → zenmux.ai/v1</span>
            <span className="ml-auto">{logEntries.filter(e => elapsed >= e.at).length}/{logEntries.length}</span>
          </div>
          <AnimatePresence initial={false}>
            {visibleLogs.map(e => {
              const a = agents.find(x => x.key === e.agent)!;
              return (
                <motion.div key={e.at + '-' + e.agent}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-2 py-0.5">
                  <span className="text-[10px] font-mono shrink-0 pt-0.5" style={{ color: '#64748b' }}>
                    +{(e.at / 1000).toFixed(1)}s
                  </span>
                  <span className="shrink-0 text-[10px] font-bold uppercase pt-0.5" style={{ color: a.color }}>
                    {a.label.toLowerCase()}
                  </span>
                  <span className="text-[11px] flex-1" style={{ color: '#e2e8f0' }}>{e.text}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {!allDone && (
            <div className="flex items-center gap-2 pt-1">
              <motion.span
                className="w-1.5 h-3 bg-emerald-400"
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              <span className="text-[10px]" style={{ color: '#64748b' }}>awaiting next chunk…</span>
            </div>
          )}
        </div>

        {/* Footer / verdict */}
        {allDone ? (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            className="px-5 py-3 border-t flex items-center gap-3"
            style={{ borderColor: '#a7f3d0', background: '#ecfdf5' }}>
            <CircleCheck size={20} className="text-emerald-600"/>
            <div className="flex-1">
              <p className="text-[12px] font-extrabold" style={{ color: '#065f46' }}>
                6-agent consensus reached — transmitting to {bankName}…
              </p>
              <p className="text-[10px] font-semibold" style={{ color: '#047857' }}>
                Score {score}/100 · confidence 0.92 · zero human review
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-white border"
              style={{ borderColor: '#a7f3d0', color: '#065f46' }}>
              10,309 tokens · {(elapsed / 1000).toFixed(1)}s
            </span>
          </motion.div>
        ) : (
          <div className="px-5 py-3 border-t flex items-center justify-between"
            style={{ borderColor: BORDER, background: '#fafafa' }}>
            <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: TEXT3 }}>
              <Loader2 size={13} className="animate-spin"/>
              <span>Analysis in progress · {Math.round(overallProgress * 100)}% complete</span>
            </div>
            <span className="text-[10px] font-mono" style={{ color: TEXT3 }}>
              ETA {Math.max(0, Math.ceil((TOTAL_DURATION - elapsed) / 1000))}s
            </span>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════
   BridgeLaunchOverlay — cinematic full-screen activation choreography
   ─────────────────────────────────────────────────────────────────
   Phases: 0=idle  1=signing  2=transmitting  3=activating  4=success
   Transitions auto-advance ~900ms each. On success, the parent
   swaps to <ActivatedBanner/>. Built for the "wow moment" demo.
   ═════════════════════════════════════════════════════════════════ */
function BridgeLaunchOverlay({
  phase, offer, bankName, onClose,
}: {
  phase: 1 | 2 | 3 | 4;
  offer: CreditOffer;
  bankName: string;
  onClose: () => void;
}) {
  // Smoothly tick the displayed amount up to bridge amount during phases 3→4
  const targetAmount = offer.bridgeAmountSAR;
  const [displayAmount, setDisplayAmount] = useState(0);
  useEffect(() => {
    if (phase < 3) { setDisplayAmount(0); return; }
    let raf = 0;
    const start = performance.now();
    const dur = 1100;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplayAmount(Math.round(targetAmount * eased));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, targetAmount]);

  // Typewriter blockchain hash during phases 2-3
  const fullHash = useMemo(() => {
    const base = String(offer.blockchainHash ?? '').replace(/[^a-fA-F0-9]/g, '');
    const seed = base + offer.offerRef + 'synergy';
    let s = '';
    for (let i = 0; i < 64; i++) s += '0123456789abcdef'[(seed.charCodeAt(i % seed.length) + i * 17) % 16];
    return '0x' + s;
  }, [offer]);
  const [hashChars, setHashChars] = useState(0);
  useEffect(() => {
    if (phase < 2) { setHashChars(0); return; }
    const cap = phase >= 3 ? fullHash.length : Math.floor(fullHash.length * 0.55);
    let i = hashChars;
    const id = window.setInterval(() => {
      i += 2;
      setHashChars(Math.min(cap, i));
      if (i >= cap) window.clearInterval(id);
    }, 18);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, fullHash]);

  const phaseMeta = [
    { label: 'Signing PDF',       sub: 'Embedding cryptographic seal',                icon: PenLine,  color: '#3b82f6' },
    { label: 'Transmitting',      sub: `Secure tunnel to ${bankName}`,                icon: Send,     color: '#8b5cf6' },
    { label: 'AI Underwriting',   sub: 'Tri-agent consensus · No human review',       icon: Cpu,      color: '#f59e0b' },
    { label: 'Bridge Activated',  sub: 'Funds in your operating wallet',              icon: CircleCheck, color: '#10b981' },
  ] as const;
  const meta = phaseMeta[phase - 1];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      style={{ background: 'radial-gradient(ellipse at center, rgba(15,23,42,0.92), rgba(2,6,23,0.98))', backdropFilter: 'blur(8px)' }}
    >
      {/* radial glow */}
      <motion.div
        key={phase}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 0.5, scale: 1.2 }}
        transition={{ duration: 1.4, ease: 'easeOut' }}
        className="absolute"
        style={{
          width: 720, height: 720, borderRadius: '50%',
          background: `radial-gradient(circle, ${meta.color}22 0%, transparent 60%)`,
          filter: 'blur(40px)',
        }}
      />

      {/* particle confetti on success */}
      {phase === 4 && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 36 }).map((_, i) => {
            const angle = (i / 36) * Math.PI * 2;
            const dist = 240 + Math.random() * 280;
            const dx = Math.cos(angle) * dist;
            const dy = Math.sin(angle) * dist;
            const colors = ['#10b981', '#f59e0b', '#3b82f6', '#a78bfa', '#fff'];
            return (
              <motion.div
                key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                animate={{ x: dx, y: dy, opacity: 0, scale: 1.2, rotate: 360 }}
                transition={{ duration: 1.4 + Math.random() * 0.6, ease: 'easeOut', delay: Math.random() * 0.15 }}
                className="absolute top-1/2 left-1/2 w-2 h-2 rounded-sm"
                style={{ background: colors[i % colors.length], boxShadow: `0 0 8px ${colors[i % colors.length]}` }}
              />
            );
          })}
        </div>
      )}

      {/* main glass card */}
      <motion.div
        initial={{ y: 24, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 22, stiffness: 220 }}
        className="relative z-10 w-full max-w-[520px] rounded-3xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
        }}
      >
        {/* phase progress rail */}
        <div className="h-1 flex">
          {phaseMeta.map((m, i) => (
            <motion.div
              key={i}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: phase > i ? 1 : phase === i + 1 ? 0.6 : 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="flex-1 origin-left"
              style={{ background: phase > i ? m.color : phase === i + 1 ? m.color : 'rgba(255,255,255,0.06)' }}
            />
          ))}
        </div>

        <div className="px-7 py-8 text-white">
          {/* phase pill */}
          <div className="flex items-center justify-between mb-7">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-[2px] uppercase" style={{ color: '#94a3b8' }}>
              <Lock size={10}/> Madar · Islamic Factoring
            </div>
            <div className="text-[10px] font-mono opacity-60">{offer.offerRef}</div>
          </div>

          {/* central icon disk */}
          <div className="flex justify-center mb-5">
            <motion.div
              key={`icon-${phase}`}
              initial={{ scale: 0.4, rotate: -90, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', damping: 14, stiffness: 220 }}
              className="relative w-24 h-24 rounded-full flex items-center justify-center"
              style={{
                background: `radial-gradient(circle at 30% 30%, ${meta.color}55, ${meta.color}11 70%)`,
                border: `1.5px solid ${meta.color}66`,
                boxShadow: `0 0 60px ${meta.color}55, inset 0 0 30px ${meta.color}22`,
              }}
            >
              {/* rotating ring (only while in-flight) */}
              {phase < 4 && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ border: `1.5px dashed ${meta.color}88`, borderRightColor: 'transparent', borderBottomColor: 'transparent' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'linear' }}
                />
              )}
              <meta.icon size={38} color={meta.color} strokeWidth={2.2}/>
            </motion.div>
          </div>

          {/* phase title */}
          <div className="text-center mb-6">
            <motion.div
              key={`label-${phase}`}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-[22px] font-black tracking-tight"
              style={{ color: phase === 4 ? '#10b981' : '#fff' }}
            >
              {meta.label}
            </motion.div>
            <div className="text-[12px] mt-1.5" style={{ color: '#94a3b8' }}>{meta.sub}</div>
          </div>

          {/* ticking amount (visible from phase 3) */}
          {phase >= 3 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-6"
            >
              <div className="text-[10px] font-bold tracking-[2px] uppercase mb-1" style={{ color: '#64748b' }}>
                Advance amount
              </div>
              <div className="text-[44px] font-black tabular-nums" style={{ color: '#10b981', textShadow: '0 0 24px rgba(16,185,129,0.35)' }}>
                SAR {displayAmount.toLocaleString()}
              </div>
            </motion.div>
          )}

          {/* AI agents equalizer (phase 3) */}
          {phase === 3 && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-end justify-center gap-3 mb-6 h-10"
            >
              {['DeepSeek R1', 'Gemini 3.1', 'Claude 4.6'].map((name, i) => (
                <div key={name} className="flex flex-col items-center gap-1">
                  <div className="flex items-end gap-[2px] h-7">
                    {[0, 1, 2, 3].map((b) => (
                      <motion.div
                        key={b}
                        className="w-[3px] rounded-full"
                        style={{ background: ['#3b82f6', '#a78bfa', '#10b981'][i] }}
                        animate={{ height: ['25%', '90%', '40%', '70%', '25%'] }}
                        transition={{ duration: 0.9 + b * 0.1, repeat: Infinity, delay: i * 0.15 + b * 0.07, ease: 'easeInOut' }}
                      />
                    ))}
                  </div>
                  <div className="text-[9px] font-semibold opacity-70">{name}</div>
                </div>
              ))}
            </motion.div>
          )}

          {/* hash typewriter (phases 2-3) */}
          {phase >= 2 && phase < 4 && (
            <div className="rounded-xl p-3 mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between text-[9px] font-bold tracking-[1.5px] uppercase mb-1.5" style={{ color: '#64748b' }}>
                <span className="flex items-center gap-1.5"><Hash size={10}/> SHA-256 seal</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <ScanLine size={10}/> verifying
                </span>
              </div>
              <div className="font-mono text-[10px] leading-relaxed break-all" style={{ color: '#a78bfa' }}>
                {fullHash.slice(0, hashChars)}
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity }}
                  className="inline-block w-[6px] h-[10px] ml-0.5 align-middle"
                  style={{ background: '#a78bfa' }}
                />
              </div>
            </div>
          )}

          {/* success summary cards */}
          {phase === 4 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="grid grid-cols-3 gap-2 mb-5"
            >
              {[
                { l: 'APR',     v: `${offer.rateMonthly}%/mo` },
                { l: 'Maturity', v: `${offer.termDays}d` },
                { l: 'Bank',     v: bankName.split(' ')[0] },
              ].map(k => (
                <div key={k.l} className="rounded-xl px-3 py-2.5 text-center" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div className="text-[9px] font-bold tracking-[1.5px] uppercase" style={{ color: '#6ee7b7' }}>{k.l}</div>
                  <div className="text-[13px] font-black mt-0.5">{k.v}</div>
                </div>
              ))}
            </motion.div>
          )}

          {/* CTA */}
          {phase === 4 ? (
            <button
              onClick={onClose}
              className="w-full h-11 rounded-xl text-[13px] font-bold cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: '#10b981', color: '#fff', boxShadow: '0 12px 30px rgba(16,185,129,0.4)' }}
            >
              View Activation Receipt →
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-[11px]" style={{ color: '#64748b' }}>
              <Loader2 size={12} className="animate-spin"/>
              <span>Please hold — autonomous flow in progress</span>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Activated Banner ── */
function ActivatedBanner({ offer, onReset }: { offer: CreditOffer; onReset: () => void }) {
  const bank = BANKS[offer.bankIdx % BANKS.length];
  const repayDate = new Date(Date.now() + offer.termDays * 86400000).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border overflow-hidden" style={{ borderColor: '#22c55e60', background: '#f0fdf4' }}>
      <div className="h-2" style={{ background: '#10b981' }}/>
      <div className="p-6 text-center space-y-3">
        <CircleCheck size={40} className="mx-auto text-emerald-500"/>
        <div>
          <p className="text-[22px] font-black text-emerald-700">Bridge Activated!</p>
          <p className="text-[13px] mt-1 text-emerald-600">{fmtHome(offer.bridgeAmountSAR)} is being processed by {bank.name}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          {[['Amount', fmtHome(offer.bridgeAmountSAR)], ['Due Date', repayDate], ['Ref', 'REF-' + offer.offerRef]].map(([l,v]) => (
            <div key={l} className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
              <p className="text-[10px] text-emerald-500 font-semibold uppercase">{l}</p>
              <p className="text-[12px] font-black text-emerald-700 mt-0.5">{v}</p>
            </div>
          ))}
        </div>
        <button onClick={onReset} className="flex items-center gap-1.5 text-[11px] font-semibold mx-auto cursor-pointer mt-2 hover:opacity-80" style={{ color: TEXT3 }}>
          <RefreshCw size={11}/> Start new offer
        </button>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   v3 — 4-STATION WIREFRAME HERO
   "Silent PDF" → "Real money in hand"
══════════════════════════════════════════════════════════════════ */

type SavedReport = {
  id: string;
  createdAt: number;
  mode: 'single' | 'portfolio';
  clientName: string;
  amount: number;
  currency: string;
  score: number;
  summary: string;
  contextSnapshot?: { connectionsCount: number; invoicesCount: number; trustScore: number; redFlags: number };
};

function loadReports(): SavedReport[] {
  try { return JSON.parse(localStorage.getItem(REPORTS_STORE) || '[]') as SavedReport[]; }
  catch { return []; }
}

/** Deterministic offer code "LB-XXXX" derived from a stable id */
function offerCodeFromId(id: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) {
    s += ALPHA[h % ALPHA.length];
    h = Math.floor(h / ALPHA.length) + 7;
  }
  return 'LB-' + s;
}

/** Build a synthetic CreditOffer from a saved AgentRoom report */
function offerFromReport(r: SavedReport): CreditOffer {
  const sarRates: Record<string, number> = { SAR: 1, USD: 3.75, OMR: 9.75, AED: 1.02, EUR: 4.1, EGP: 0.075, BHD: 9.95, KWD: 12.2, QAR: 1.03 };
  const sarAmount = Math.round(r.amount * (sarRates[r.currency] ?? 1));
  const cap = Math.max(80, Math.min(500, Math.round(sarAmount * 0.85 / 10) * 10));
  const codeBody = String(offerCodeFromId(r.id) ?? '').replace('LB-', '');
  const bankIdx = (r.id.charCodeAt(0) + r.id.length) % BANKS.length;
  return {
    offerRef: codeBody,
    bankIdx,
    freelancerName: 'You',
    activeSince: 'Jan 2024',
    invoicesPaid: r.contextSnapshot?.invoicesCount ?? 0,
    invoiceRef: r.id.slice(-4).toUpperCase(),
    clientName: r.clientName,
    invoiceAmountSAR: sarAmount,
    bridgeAmountSAR: cap,
    coveragePercent: 85,
    rateMonthly: 2.2,
    termDays: 30,
    repaymentRef: '#' + r.id.slice(-4).toUpperCase(),
    pendingSAR: sarAmount,
    expectedSAR: Math.round(sarAmount * 0.95),
    defaultRisk: Math.max(2, Math.round((100 - r.score) / 4 * 10) / 10),
    riskScore: r.score,
    paymentProb: r.score,
    blockchainHash: '0x' + r.id.slice(0, 6) + '...' + r.id.slice(-3),
    generatedAt: r.createdAt,
  };
}

type Stages = {
  sent: boolean;
  reviewed: boolean;
  decided: boolean;
  decision: 'approved' | 'pending' | 'declined';
  score: number;
  sentAt: number | null;
  reviewedAt: number | null;
  decidedAt: number | null;
};

/** Derive Station 4 stages from BANK_REVIEW_STORE if present, else return all-pending.
 *  Stages must NEVER appear progressed unless a real submission actually happened. */
function deriveStages(_offer: CreditOffer, scoreTotal: number | null): Stages {
  const fallbackScore = scoreTotal ?? _offer.riskScore;
  // Always prefer the live composite score for display (BUG 3)
  const liveScore = clampScore(scoreTotal ?? fallbackScore);
  try {
    const raw = localStorage.getItem(BANK_REVIEW_STORE);
    if (raw) {
      const p = JSON.parse(raw) as Partial<BankReviewState> & {
        sent?: boolean; reviewed?: boolean; decided?: boolean;
        sentAt?: number; decision?: 'approved' | 'pending' | 'declined' | 'conditional' | null;
      };
      // Guard: only apply if for the same offer
      if (p.offerRef && p.offerRef !== _offer.offerRef) {
        return emptyStages(liveScore);
      }
      const stepIs = (v: string) => p.step === v;
      // BUG 1 FIX: when step==='idle' treat as no submission
      if (stepIs('idle') || (!p.step && !p.submittedAt && !p.sentAt)) {
        return emptyStages(liveScore);
      }
      const sent = !!(p.sent || p.submittedAt || p.sentAt || stepIs('sent') || stepIs('reviewed') || stepIs('decision'));
      const reviewed = !!(p.reviewed || p.reviewedAt || stepIs('reviewed') || stepIs('decision'));
      const decided = !!(p.decided || p.decidedAt || stepIs('decision'));
      // Map any legacy 'conditional' decision to a real outcome based on score.
      // score > 70 = approved, otherwise declined (no stuck "pending" state).
      const rawDecision = p.decision === 'conditional'
        ? (liveScore > 70 ? 'approved' : 'declined')
        : p.decision;
      const decision: 'approved' | 'pending' | 'declined' =
        rawDecision === 'approved' || rawDecision === 'declined'
          ? rawDecision
          : decided
            ? (liveScore > 70 ? 'approved' : 'declined')
            : 'pending';
      return {
        sent, reviewed, decided, decision,
        score: liveScore,
        sentAt: p.sentAt ?? p.submittedAt ?? null,
        reviewedAt: p.reviewedAt ?? null,
        decidedAt: p.decidedAt ?? null,
      };
    }
  } catch { /**/ }
  // BUG 1 FIX: NO bank review store → user has not submitted. Show empty.
  return emptyStages(liveScore);
}

function emptyStages(score: number): Stages {
  return {
    sent: false,
    reviewed: false,
    decided: false,
    decision: 'pending',
    score,
    sentAt: null,
    reviewedAt: null,
    decidedAt: null,
  };
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en', { day: '2-digit', month: 'short' });
}

/* ── Recent Reports horizontal strip ── */
function RecentReportsStrip({
  reports, activeId, onPick, onSendLatest,
}: {
  reports: SavedReport[];
  activeId: string | null;
  onPick: (r: SavedReport) => void;
  onSendLatest: () => void;
}) {
  if (!reports.length) return null;
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER, background: CARD }}>
      <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: BORDER }}>
        <Layers size={13} style={{ color: TEXT3 }}/>
        <p className="text-[13px] font-extrabold" style={{ fontFamily: "'Caveat',cursive", color: TEXT }}>Recent Reports</p>
        <span className="text-[10px]" style={{ color: TEXT3 }}>· last {Math.min(5, reports.length)}</span>
        <button
          onClick={onSendLatest}
          className="ml-auto h-7 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer text-white"
          style={{ background: '#10b981' }}
          title="Email the latest analysis report to the client">
          <Send size={11}/> Email Latest to Client
        </button>
      </div>
      <div className="px-4 py-3 flex gap-3 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
        {reports.slice(0, 5).map(r => {
          const active = r.id === activeId;
          const code = offerCodeFromId(r.id);
          return (
            <button
              key={r.id}
              onClick={() => onPick(r)}
              className={'shrink-0 w-[180px] text-left p-3 rounded-xl border transition-all cursor-pointer hover:shadow-sm ' + (active ? 'ring-2 ring-blue-400' : '')}
              style={{ borderColor: active ? '#3b82f6' : BORDER, background: active ? '#eff6ff' : CREAM }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: '#111827', color: '#fff' }}>#{code}</span>
                <span className="text-[10px] font-extrabold" style={{ color: r.score >= 65 ? '#059669' : r.score >= 45 ? '#d97706' : '#dc2626' }}>{r.score}</span>
              </div>
              <p className="text-[12px] font-bold truncate" style={{ color: TEXT }}>{r.clientName}</p>
              <p className="text-[10px] mt-0.5" style={{ color: TEXT3 }}>{homeCurrencySymbol()} {toHomeCurrency(r.amount, r.currency).toLocaleString()}</p>
              <p className="text-[9px] mt-1" style={{ color: TEXT3 }}>{new Date(r.createdAt).toLocaleDateString('en', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Station 1 — The Offer (top hero) ── */
function Station1Offer({
  offer, score, prettyCode, statusLabel, statusColor, statusBg, repayDate, premium,
  onActivate, onDecline, onCopyCode,
}: {
  offer: CreditOffer;
  score: ScoreBreakdown | null;
  prettyCode: string;
  statusLabel: string;
  statusColor: string;
  statusBg: string;
  repayDate: string;
  premium: boolean;
  onActivate: () => void;
  onDecline: () => void;
  onCopyCode: () => void;
}) {
  const hasAmount = offer.bridgeAmountSAR > 0;
  const sarAmount = hasAmount ? (premium ? Math.min(offer.bridgeAmountSAR, PREMIUM_BRIDGE_SAR) : offer.bridgeAmountSAR) : 0;
  const currencyLabel = homeCurrencySymbol();
  const amount = toHomeCurrency(sarAmount, 'SAR');
  const composite = score?.total ?? offer.riskScore;
  const softLock = composite < 50;
  const bank = BANKS[offer.bankIdx % BANKS.length];

  // Animated counter (rAF tween whenever the target amount changes)
  const [tweenedAmount, setTweenedAmount] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const from = 0;
    const to = amount;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setTweenedAmount(Math.round(from + (to - from) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [amount]);

  // Score ring animated stroke
  const [tweenedScore, setTweenedScore] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 1100;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setTweenedScore(Math.round(eased * composite));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [composite]);

  // Status icon mapping (lucide)
  const StatusIcon =
    statusLabel === 'Approved' ? CheckCircle2 :
    statusLabel === 'Active'   ? Activity :
    statusLabel === 'Declined' ? XCircle :
    Clock;

  const ringR = 38;
  const ringC = 2 * Math.PI * ringR;
  const ringDash = ringC * (tweenedScore / 100);
  const ringColor = composite >= 70 ? '#059669' : composite >= 50 ? '#d97706' : '#dc2626';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
      className="rounded-3xl border overflow-hidden relative shadow-[0_18px_50px_-22px_rgba(15,23,42,0.28)]"
      style={{
        borderColor: BORDER,
        background: CARD,
        backgroundImage: `linear-gradient(${CARD}, ${CARD}), linear-gradient(135deg, ${ACCENT}66 0%, transparent 35%, transparent 65%, ${bank.color}44 100%)`,
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
      }}>
      {/* Soft radial backdrop */}
      <div className="absolute inset-0 pointer-events-none opacity-70"
        style={{ background: `radial-gradient(900px 280px at 8% -10%, ${ACCENT}1f, transparent 60%), radial-gradient(700px 240px at 110% 120%, ${bank.color}22, transparent 60%)` }}/>
      {/* Faint geometric corner pattern */}
      <svg className="absolute top-0 right-0 pointer-events-none opacity-[0.05]" width="260" height="260" viewBox="0 0 260 260" fill="none">
        <circle cx="210" cy="50" r="60"  stroke="currentColor" strokeWidth="1"/>
        <circle cx="210" cy="50" r="100" stroke="currentColor" strokeWidth="1"/>
        <circle cx="210" cy="50" r="140" stroke="currentColor" strokeWidth="1"/>
        <path d="M40 240 L240 40" stroke="currentColor" strokeWidth="1"/>
      </svg>

      {/* ── Bank header band ── */}
      <div
        className="relative flex items-center gap-3 px-7 py-3 border-b"
        style={{
          borderColor: BORDER,
          background: `linear-gradient(90deg, ${bank.color}11 0%, transparent 60%)`,
        }}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-[14px] shrink-0"
          style={{ background: bank.color }}>
          <Landmark size={16}/>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-extrabold leading-tight truncate" style={{ color: TEXT }}>
            {bank.name}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wider truncate" style={{ color: TEXT3 }}>
            Islamic Factoring · {bank.country}
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-wider whitespace-nowrap"
          style={{ background: statusBg, color: statusColor, borderColor: statusColor + '50' }}>
          <StatusIcon size={10}/>
          {statusLabel}
        </span>
      </div>

      <div className="relative p-7">
        {/* Top row: code + bank-ready */}
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onCopyCode}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono text-[12px] font-black tracking-wide cursor-pointer hover:opacity-90 transition-opacity"
              style={{ borderColor: '#111827', background: '#111827', color: '#fff' }}
              title="Copy offer code">
              <Hash size={11} className="opacity-70"/> {prettyCode}
              <Copy size={10} className="opacity-60 ml-1"/>
            </button>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full"
              style={{ background: '#ecfdf5', color: '#15803d', border: '1px solid #a7f3d0' }}>
              <BadgeCheck size={10}/> Bank-grade · TLS 1.3
            </span>
          </div>
          {/* AI consensus chip */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border"
            style={{ borderColor: BORDER, background: CREAM }}>
            <span className="flex -space-x-1.5">
              {[
                { c: '#0ea5e9', t: 'S' },
                { c: '#8b5cf6', t: 'N' },
                { c: '#f59e0b', t: 'T' },
                { c: '#059669', t: 'M' },
              ].map((a, i) => (
                <span key={i}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white border-2"
                  style={{ background: a.c, borderColor: CARD }}>
                  {a.t}
                </span>
              ))}
            </span>
            <span className="text-[9.5px] font-extrabold uppercase tracking-wider" style={{ color: TEXT2 }}>
              4 agents · consensus
            </span>
          </div>
        </div>

        {/* ── Hero row: amount + score ring ── */}
        <div className="flex items-end gap-6 mb-5 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: TEXT3 }}>
              Advance Amount Available
            </p>
            <div className="flex items-end gap-3 mt-1">
              <p className="text-[58px] sm:text-[72px] font-black leading-none tracking-tight tabular-nums"
                style={{ color: hasAmount ? TEXT : TEXT3 }}>
                <span className="text-[22px] sm:text-[26px] font-semibold align-top mr-2"
                  style={{ color: TEXT3 }}>{currencyLabel}</span>
                {tweenedAmount.toLocaleString()}
              </p>
              {premium && (
                <span className="mb-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Sparkles size={10}/> Premium tier
                </span>
              )}
            </div>
            <p className="text-[12px] mt-2" style={{ color: TEXT3 }}>
              {hasAmount
                ? `${offer.coveragePercent}% of collateral · invoice ${offer.repaymentRef} · ${offer.clientName}`
                : 'Run an analysis from Agent Room to generate a real offer'}
            </p>
          </div>

          {/* Composite score gauge */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="relative" style={{ width: 96, height: 96 }}>
              <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
                <circle cx="48" cy="48" r={ringR} stroke={BORDER} strokeWidth="6" fill="none"/>
                <circle
                  cx="48" cy="48" r={ringR}
                  stroke={ringColor} strokeWidth="6" fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${ringDash} ${ringC}`}
                  style={{ transition: 'stroke 0.4s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[22px] font-black leading-none tabular-nums" style={{ color: TEXT }}>
                  {tweenedScore}
                </p>
                <p className="text-[8px] font-bold uppercase tracking-wider mt-0.5" style={{ color: TEXT3 }}>
                  / 100
                </p>
              </div>
            </div>
            <p className="text-[9.5px] font-extrabold uppercase tracking-wider" style={{ color: ringColor }}>
              {score?.label ?? 'Score'}
            </p>
          </div>
        </div>

        {/* Trust strip */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 pb-4 border-b" style={{ borderColor: BORDER }}>
          {[
            { icon: Lock,        label: 'Encrypted vault'      },
            { icon: ShieldCheck, label: 'SHA-256 sealed'       },
            { icon: BadgeCheck,  label: `${offer.termDays}-day term` },
            { icon: RefreshCw,   label: 'Auto-deduct on due'   },
          ].map(t => (
            <div key={t.label} className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: TEXT3 }}>
              <t.icon size={11} style={{ color: ACCENT }}/> {t.label}
            </div>
          ))}
        </div>

        {/* Sub-row metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Admin Fee (2.2%)', value: '2.2% · fixed', icon: TrendingUp, accent: '#0ea5e9' },
            { label: 'Duration',  value: `${offer.termDays} days`,     icon: Clock,      accent: '#8b5cf6' },
            { label: 'Repayment', value: repayDate,                    icon: CalendarLite, accent: '#f59e0b' },
            { label: 'Coverage',  value: `${offer.coveragePercent}%`,  icon: Shield,     accent: '#059669' },
          ].map(item => (
            <div key={item.label} className="rounded-xl border p-3 relative overflow-hidden"
              style={{ borderColor: BORDER, background: CREAM }}>
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: item.accent }}/>
              <div className="flex items-center gap-1.5 mb-1">
                <item.icon size={11} style={{ color: item.accent }}/>
                <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: TEXT3 }}>{item.label}</p>
              </div>
              <p className="text-[15px] font-extrabold tracking-tight" style={{ color: TEXT }}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Action row */}
        {hasAmount && (
          <div className="flex items-center gap-3 pt-5">
            <button onClick={onActivate}
              disabled={softLock}
              className="flex-1 h-12 rounded-xl text-white font-extrabold text-[14px] flex items-center justify-center gap-2 cursor-pointer hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all relative overflow-hidden group"
              style={{ background: `linear-gradient(135deg, ${DARK} 0%, ${bank.color} 100%)` }}>
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: `linear-gradient(135deg, transparent 0%, ${ACCENT}33 100%)` }}/>
              <Zap size={15} className="relative"/>
              <span className="relative">Activate Advance</span>
              <ArrowRight size={14} className="relative opacity-70"/>
            </button>
            <button onClick={onDecline}
              className="px-6 h-12 rounded-xl border text-[13px] font-semibold cursor-pointer hover:bg-gray-50 transition-colors"
              style={{ borderColor: BORDER, color: TEXT2, background: CARD }}>
              Decline
            </button>
          </div>
        )}
        {/* Soft-locked overlay when composite < 50 */}
        {hasAmount && softLock && (
          <div className="mt-4 rounded-xl border-2 border-dashed p-4 flex items-start gap-3" style={{ borderColor: '#fbbf24', background: '#fffbeb' }}>
            <Lock size={18} className="shrink-0 mt-0.5" style={{ color: '#d97706' }}/>
            <div className="flex-1">
              <p className="text-[12px] font-extrabold" style={{ color: '#92400e' }}>Locked — composite score {composite}/100</p>
              <p className="text-[11px] mt-0.5" style={{ color: '#92400e' }}>Connect more banks &amp; clients to lift your score above 50 and unlock activation.</p>
            </div>
            <button
              onClick={() => { window.location.href = '/connections'; }}
              className="h-8 px-3 rounded-lg text-[11px] font-bold text-white flex items-center gap-1.5 cursor-pointer hover:opacity-90 self-center"
              style={{ background: '#d97706' }}>
              <ArrowRight size={11}/> Connect
            </button>
          </div>
        )}
        {/* Score hint */}
        {score && (
          <p className="text-[11px] mt-3" style={{ color: TEXT3 }}>
            Composite score <span className="font-extrabold" style={{ color: score.labelColor }}>{score.total}/100</span>
            {' · '}{premium ? `cap ${currencyLabel} ${toHomeCurrency(PREMIUM_BRIDGE_SAR, 'SAR').toLocaleString()} unlocked` : `reach 71+ to unlock ${currencyLabel} ${toHomeCurrency(PREMIUM_BRIDGE_SAR, 'SAR').toLocaleString()}`}
          </p>
        )}
      </div>
    </motion.div>
  );
}

/* tiny inline calendar icon (lucide doesn't auto-tree-shake here cleanly) */
function CalendarLite(props: { size?: number; style?: React.CSSProperties }) {
  const s = props.size ?? 12;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={props.style}>
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  );
}

/* ── Station 2 — Repayment Timeline ── */
function Station2Timeline({ offer, active }: { offer: CreditOffer; active: boolean }) {
  const today = Date.now();
  const dueAt = today + 30 * 86_400_000;
  const endAt = today + offer.termDays * 86_400_000;
  const nodes = [
    { label: 'Today',  sub: 'You receive the funds',           date: today, color: '#3b82f6' },
    { label: 'Due',    sub: 'Reminder: payment due soon',      date: dueAt, color: '#f59e0b' },
    { label: 'End',    sub: 'Auto-deducted on this date',      date: endAt, color: '#10b981' },
  ];
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER, background: CARD }}>
      <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: BORDER }}>
        <CalendarIcon size={15} style={{ color: TEXT2 }}/>
        <p className="text-[14px] font-bold tracking-tight" style={{ color: TEXT }}>Repayment Schedule</p>
      </div>
      <div className="px-6 py-7">
        <div className="relative">
          {/* connecting gradient line */}
          <div className="absolute left-[8%] right-[8%] top-5 h-1 rounded-full"
            style={{ background: 'linear-gradient(90deg,#3b82f6 0%,#f59e0b 50%,#10b981 100%)' }}>
            {active && (
              <motion.div
                className="absolute -top-1 w-3 h-3 rounded-full bg-white shadow-md border-2 border-blue-500"
                initial={{ left: '0%' }}
                animate={{ left: '100%' }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </div>
          <div className="flex items-start justify-between relative">
            {nodes.map((n, i) => (
              <div key={i} className="flex flex-col items-center w-1/3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center border-[3px] z-10 shadow-sm"
                  style={{ background: '#fff', borderColor: n.color }}>
                  {i === 0 ? <CircleCheck size={18} style={{ color: n.color }}/>
                    : i === 1 ? <AlertTriangle size={16} style={{ color: n.color }}/>
                    : <CheckCircle2 size={18} style={{ color: n.color }}/>}
                </div>
                <p className="text-[11px] font-extrabold uppercase tracking-wider mt-2" style={{ color: n.color }}>{n.label}</p>
                <p className="text-[12px] font-bold mt-0.5" style={{ color: TEXT }}>{fmtDate(n.date)}</p>
                <p className="text-[10px] text-center mt-0.5 max-w-[170px]" style={{ color: TEXT3 }}>{n.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Animated connector for Station 3 ── */
function FlowConnector({ active }: { active: boolean }) {
  return (
    <div className="flex-1 h-[3px] rounded-full relative overflow-hidden mx-1"
      style={{ background: active ? '#3b82f6' : '#e5e7eb' }}>
      {active && (
        <>
          <motion.span
            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow"
            initial={{ left: '-10%' }}
            animate={{ left: '110%' }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
          />
          <motion.span
            className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/70"
            initial={{ left: '-10%' }}
            animate={{ left: '110%' }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'linear', delay: 0.6 }}
          />
        </>
      )}
    </div>
  );
}

/* ── Station 3 — Document Transmission (the PDF journey) ── */
function Station3Transmission({ active, submittedAt }: { active: boolean; submittedAt: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active || !submittedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [active, submittedAt]);

  // Long-form transmission window — 36s — gives the stage room to breathe and
  // lets every micro-event in the terminal be readable on a demo screen.
  const TRANSMISSION_MS = 36_000;
  const TOTAL_KB = 412;
  const elapsed = active && submittedAt ? Math.max(0, now - submittedAt) : 0;
  const bytesProgress = active && submittedAt
    ? Math.min(1, elapsed / TRANSMISSION_MS)
    : active ? 0 : 1;
  const bytesSent = (TOTAL_KB * bytesProgress).toFixed(1);
  const sealed = bytesProgress >= 1;

  const steps = [
    { icon: User,      label: 'User',         sub: 'You upload the invoice',        accent: '#3b82f6', overlay: null as React.ElementType | null, hitAt: 0      },
    { icon: FileText,  label: 'PDF',          sub: 'Document signed digitally',     accent: '#6366f1', overlay: Lock,                              hitAt: 6_000  },
    { icon: Cpu,       label: 'API',          sub: 'Sentinel parses every number',  accent: '#06b6d4', overlay: null,                              hitAt: 16_000 },
    { icon: Landmark,  label: 'Partner Bank', sub: 'Receives clean data',           accent: '#10b981', overlay: null,                              hitAt: 28_000 },
  ];

  // Terminal-style log lines fade in across the 36s window — gives the bank
  // transmission a "real ops console" feel during the demo.
  const logLines = [
    { at: 1_500,  text: '> POST /v1/risk-reports — initialising TLS 1.3 channel'        },
    { at: 4_500,  text: '> handshake OK · cipher AES-256-GCM · session pinned'          },
    { at: 8_000,  text: '> uploading payload [chunk 1/4] · sha-256 verified'            },
    { at: 13_000, text: '> uploading payload [chunk 2/4] · 38 fields validated'         },
    { id: 'mid', at: 18_000, text: '> Sentinel cross-checking GitHub · Notion · Stripe' },
    { at: 23_000, text: '> uploading payload [chunk 3/4] · audit trail attached'        },
    { at: 28_000, text: '> uploading payload [chunk 4/4] · partner-bank ACK received'   },
    { at: 32_000, text: '> ✓ transmission sealed · ledger entry written'                },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER, background: CARD }}>
      <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: BORDER }}>
        <Workflow size={15} style={{ color: TEXT2 }}/>
        <p className="text-[14px] font-bold tracking-tight" style={{ color: TEXT }}>Document Transmission</p>
        {active && !sealed && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/> transmitting
          </span>
        )}
        {sealed && (
          <motion.span
            initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 14 }}
            className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <ShieldCheck size={11}/> SHA-256 sealed
          </motion.span>
        )}
      </div>
      <div className="px-5 py-6">
        <motion.div
          className="flex items-center"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.18, delayChildren: 0.1 } } }}>
          {steps.map((s, i) => {
            const Overlay = s.overlay;
            const reached = active && submittedAt ? elapsed >= s.hitAt : !active;
            const justActive = active && submittedAt
              ? (elapsed >= s.hitAt && (i === steps.length - 1 ? !sealed : elapsed < (steps[i + 1]?.hitAt ?? Infinity)))
              : false;
            return (
              <motion.div
                key={s.label}
                variants={{
                  hidden: { opacity: 0, y: 14, scale: 0.92 },
                  show:   { opacity: 1, y: 0,  scale: 1, transition: { type: 'spring', stiffness: 260, damping: 18 } },
                }}
                className="flex items-center"
                style={{ flex: i === steps.length - 1 ? '0 0 auto' : '1 1 0' }}>
                <div className="flex flex-col items-center" style={{ minWidth: 100 }}>
                  <motion.div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center border-2 shadow-sm relative"
                    animate={justActive
                      ? { boxShadow: [`0 0 0 0 ${s.accent}55`, `0 0 0 12px ${s.accent}00`], scale: [1, 1.06, 1] }
                      : reached
                        ? { boxShadow: `0 4px 14px ${s.accent}30`, scale: 1 }
                        : { boxShadow: 'none', scale: 1 }}
                    transition={justActive
                      ? { duration: 1.6, repeat: Infinity, ease: 'easeOut' }
                      : { duration: 0.4 }}
                    style={{ borderColor: reached ? s.accent : s.accent + '40', background: reached ? s.accent + '18' : s.accent + '08' }}>
                    <s.icon size={22} style={{ color: s.accent }}/>
                    {Overlay && (
                      <span className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border flex items-center justify-center shadow-sm"
                        style={{ borderColor: BORDER }}>
                        <Overlay size={10} style={{ color: '#15803d' }}/>
                      </span>
                    )}
                  </motion.div>
                  <p className="text-[12px] font-bold mt-3 tracking-tight" style={{ color: reached ? TEXT : TEXT3 }}>{s.label}</p>
                  <p className="text-[10px] text-center mt-0.5 max-w-[120px]" style={{ color: TEXT3 }}>{s.sub}</p>
                </div>
                {i < steps.length - 1 && <FlowConnector active={active && reached}/>}
              </motion.div>
            );
          })}
        </motion.div>
        {/* Live byte counter */}
        {(active || bytesProgress >= 1) && (
          <div className="mt-5 pt-4 border-t flex items-center gap-3" style={{ borderColor: BORDER }}>
            <Lock size={11} style={{ color: '#15803d' }}/>
            <span className="text-[11px] font-mono" style={{ color: TEXT2 }}>
              Bytes transmitted: <span className="font-bold" style={{ color: TEXT }}>{bytesSent} KB</span>
              <span style={{ color: TEXT3 }}> / Total: {TOTAL_KB.toFixed(1)} KB</span>
            </span>
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#e5e7eb' }}>
              <motion.div className="h-full rounded-full" style={{ background: '#3b82f6' }}
                animate={{ width: `${bytesProgress * 100}%` }}
                transition={{ duration: 0.2 }}/>
            </div>
            <span className="text-[10px] font-mono font-bold" style={{ color: TEXT3 }}>
              {Math.round(bytesProgress * 100)}%
            </span>
          </div>
        )}
        {/* Terminal-style ops log — fades line-by-line over the 36s window */}
        {active && (
          <div className="mt-4 rounded-xl border overflow-hidden font-mono"
            style={{ background: '#0b1220', borderColor: '#1e293b' }}>
            <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: '#1e293b' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }}/>
              <span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }}/>
              <span className="w-2 h-2 rounded-full" style={{ background: '#10b981' }}/>
              <span className="ml-2 text-[10px] font-bold tracking-widest" style={{ color: '#94a3b8' }}>
                synergy://transmit · partner-bank-channel
              </span>
            </div>
            <div className="px-4 py-3 space-y-1 text-[11px] leading-relaxed min-h-[120px]">
              <AnimatePresence initial={false}>
                {logLines.filter(l => elapsed >= l.at).map((l, idx) => (
                  <motion.div
                    key={l.at}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ color: idx === logLines.filter(x => elapsed >= x.at).length - 1 ? '#34d399' : '#94a3b8' }}>
                    {l.text}
                  </motion.div>
                ))}
              </AnimatePresence>
              {!sealed && (
                <motion.span
                  className="inline-block w-[7px] h-[12px] align-middle"
                  style={{ background: '#34d399' }}
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.9, repeat: Infinity }}/>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Station 4 — Bank Review & Score ── */
function Station4BankReview({
  stages,
  liveResponse,
  onSubmitToBank,
  onViewActivity,
}: {
  stages: Stages;
  liveResponse: string | null;
  onSubmitToBank: () => void;
  onViewActivity: () => void;
}) {
  const reviewing = stages.sent && !stages.reviewed;

  // Empty state — user has not submitted to bank yet
  if (!stages.sent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER, background: CARD }}>
        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: BORDER }}>
          <Shield size={15} style={{ color: TEXT2 }}/>
          <p className="text-[14px] font-bold tracking-tight" style={{ color: TEXT }}>Bank Review &amp; Decision</p>
        </div>
        <div className="px-6 py-12 flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <Upload size={28} style={{ color: '#2563eb' }}/>
          </div>
          <p className="text-[15px] font-bold tracking-tight" style={{ color: TEXT }}>Submit your offer to begin bank review</p>
          <p className="text-[12px] max-w-md" style={{ color: TEXT3 }}>
            Your signed PDF risk report will be transmitted to the partner bank for cross-validation. Decision typically arrives within seconds in this demo.
          </p>
          <button onClick={onSubmitToBank}
            className="mt-2 h-10 px-5 rounded-xl text-white font-bold text-[13px] flex items-center gap-2 cursor-pointer hover:opacity-95 transition-opacity"
            style={{ background: '#2563eb' }}>
            <Send size={14}/> Submit to Bank Now
          </button>
        </div>
      </motion.div>
    );
  }

  const decisionColor =
    stages.decision === 'approved' ? '#15803d' :
    stages.decision === 'declined' ? '#dc2626' : '#d97706';
  const decisionBg =
    stages.decision === 'approved' ? '#ecfdf5' :
    stages.decision === 'declined' ? '#fef2f2' : '#fffbeb';
  const decisionLabel =
    stages.decision === 'approved' ? 'Approved' :
    stages.decision === 'declined' ? 'Declined' : 'Pending';
  const DecisionIcon =
    stages.decision === 'approved' ? CheckCircle2 :
    stages.decision === 'declined' ? XCircle : Clock;

  const nodes = [
    {
      key: 'sent',
      icon: Send,
      title: 'Sent',
      sub: stages.sentAt ? new Date(stages.sentAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'awaiting',
      detail: 'PDF + signature delivered',
      done: stages.sent,
      color: '#2563eb',
    },
    {
      key: 'reviewed',
      icon: Search,
      title: stages.reviewed ? 'Cross-validated' : 'Cross-validating',
      sub: stages.reviewedAt ? new Date(stages.reviewedAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : reviewing ? 'scanning fields' : '—',
      detail: stages.reviewed ? 'risk profile validated' : 'running checks',
      done: stages.reviewed,
      color: '#06b6d4',
    },
    {
      key: 'decision',
      icon: DecisionIcon,
      title: 'Decision',
      sub: stages.decidedAt ? new Date(stages.decidedAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'pending',
      detail: stages.decided ? decisionLabel : 'awaiting outcome',
      done: stages.decided,
      color: decisionColor,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER, background: CARD }}>
      <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: BORDER }}>
        <Shield size={15} style={{ color: TEXT2 }}/>
        <p className="text-[14px] font-bold tracking-tight" style={{ color: TEXT }}>Bank Review &amp; Decision</p>
      </div>
      <div className="px-5 py-6 space-y-5">
        {/* Stages with proportional connectors */}
        <div className="flex items-stretch w-full">
          {nodes.map((n, i) => {
            const Icon = n.icon;
            const isActive = !n.done && (i === 0 || nodes[i - 1].done);
            return (
              <div key={n.key} className="flex items-stretch flex-1">
                <div className="flex flex-col items-center flex-1 px-2">
                  <motion.div
                    className="w-12 h-12 rounded-full flex items-center justify-center border-2 shadow-sm"
                    initial={false}
                    animate={n.done
                      ? { scale: [1, 1.18, 1], boxShadow: `0 6px 18px ${n.color}55` }
                      : isActive
                        ? { scale: 1, boxShadow: [`0 0 0 0 ${n.color}55`, `0 0 0 14px ${n.color}00`] }
                        : { scale: 1, boxShadow: 'none' }}
                    transition={n.done
                      ? { duration: 0.55, type: 'spring', stiffness: 320, damping: 14 }
                      : isActive
                        ? { duration: 1.6, repeat: Infinity, ease: 'easeOut' }
                        : { duration: 0.3 }}
                    style={{ background: n.done ? n.color : '#fff', borderColor: isActive ? n.color : n.done ? n.color : BORDER }}>
                    {isActive
                      ? <Loader2 size={18} className="animate-spin" style={{ color: n.color }}/>
                      : <Icon size={20} style={{ color: n.done ? '#fff' : BORDER }}/>}
                  </motion.div>
                  <p className="text-[12px] font-bold mt-2 tracking-tight" style={{ color: n.done ? n.color : isActive ? n.color : TEXT3 }}>{n.title}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: TEXT3 }}>{n.sub}</p>
                  <p className="text-[10px] mt-0.5 text-center max-w-[140px]" style={{ color: TEXT2 }}>{n.detail}</p>
                  {n.key === 'reviewed' && isActive && (
                    <>
                      <div className="mt-2 w-28 h-1 rounded-full relative overflow-hidden" style={{ background: '#dbeafe' }}>
                        <motion.div
                          className="absolute top-0 bottom-0 w-8"
                          style={{ background: 'linear-gradient(90deg, transparent, #2563eb, transparent)' }}
                          animate={{ left: ['-30%', '110%'] }}
                          transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                        />
                      </div>
                      {liveResponse && (
                        <p className="text-[10px] italic mt-2 text-center max-w-[160px] font-mono" style={{ color: TEXT3 }}>
                          {liveResponse}
                        </p>
                      )}
                    </>
                  )}
                </div>
                {i < nodes.length - 1 && (
                  <div className="flex items-center self-start mt-6 w-full" style={{ flex: '1 1 0', minWidth: 24 }}>
                    <div className="w-full h-[2px] rounded-full"
                      style={{ background: nodes[i].done && nodes[i + 1].done
                        ? `linear-gradient(90deg, ${nodes[i].color}, ${nodes[i + 1].color})`
                        : nodes[i].done ? nodes[i].color : BORDER }}/>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Final decision chip */}
        <div className="flex items-center justify-center pt-2">
          <motion.div
            className="rounded-2xl border-2 px-6 py-4 text-center min-w-[260px] flex items-center gap-4"
            initial={false}
            animate={stages.decided
              ? { scale: [0.85, 1.04, 1], opacity: 1, boxShadow: [`0 0 0 0 ${decisionColor}55`, `0 0 0 18px ${decisionColor}00`] }
              : { scale: 1, opacity: 1, boxShadow: 'none' }}
            transition={stages.decided
              ? { scale: { duration: 0.55, type: 'spring', stiffness: 220, damping: 14 }, boxShadow: { duration: 1.8, repeat: Infinity, ease: 'easeOut' } }
              : { duration: 0.3 }}
            style={{ borderColor: decisionColor + '60', background: decisionBg }}>
            <DecisionIcon size={36} style={{ color: decisionColor }}/>
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: decisionColor }}>Final Decision</p>
              <p className="text-[26px] font-black leading-none mt-1 tracking-tight" style={{ color: decisionColor }}>{decisionLabel}</p>
              <p className="text-[12px] font-bold mt-1" style={{ color: TEXT2 }}>Score {stages.score}/100</p>
            </div>
          </motion.div>
        </div>

        {/* Bank Response Preview — monospace + typewriter cursor while updating */}
        {liveResponse && (
          <div className="rounded-xl border p-4" style={{ borderColor: BORDER, background: CREAM }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: TEXT3 }}>Bank Response Preview</p>
              {stages.decided && (
                <button onClick={onViewActivity}
                  className="text-[10px] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                  style={{ color: '#2563eb' }}>
                  <Activity size={10}/> View in Activity Log
                </button>
              )}
            </div>
            <p className="text-[12px] font-mono leading-relaxed" style={{ color: TEXT }}>
              {liveResponse}
              {!stages.decided && (
                <motion.span
                  className="inline-block w-[6px] h-[12px] ml-0.5 align-middle"
                  style={{ background: '#2563eb' }}
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   AI Underwriting Theater — cinematic display of the 4 ZenMux LLMs
   running the bank submission pipeline.
   ──────────────────────────────────────────────────────────────────
   Models (real ZenMux endpoints, see MODELS in synergyPipeline):
      • Sentinel    — DeepSeek R1                (risk forensics)
      • Negotiator  — Gemini 3.1 Pro             (collection plan)
      • Treasurer   — Claude Opus 4.6            (cashflow underwriting)
      • Master      — Claude Opus 4.6            (consensus + verdict)
   ══════════════════════════════════════════════════════════════════ */
function AIUnderwritingTheater({ submittedAt, score }: { submittedAt: number; score: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const elapsed = Math.max(0, now - submittedAt);

  /* Each agent has a start time, finish time, and a deterministic token count */
  const agents = [
    { key: 'sentinel',   label: 'Sentinel',   role: 'Risk Forensics',          model: MODEL_LABELS.sentinel,   color: '#dc2626', icon: ShieldCheck,  startAt:    0, finishAt:  6_500, tokens: 1842 },
    { key: 'negotiator', label: 'Negotiator', role: 'Collection Strategy',     model: MODEL_LABELS.negotiator, color: '#059669', icon: MessageSquare, startAt: 1_200, finishAt:  9_400, tokens: 2105 },
    { key: 'treasurer',  label: 'Treasurer',  role: 'Cashflow Underwriting',   model: MODEL_LABELS.treasurer,  color: '#2563eb', icon: Landmark,     startAt: 2_400, finishAt: 12_800, tokens: 2387 },
    { key: 'master',     label: 'Master',     role: 'Consensus + Verdict',     model: MODEL_LABELS.master,     color: '#7c3aed', icon: Brain,        startAt: 9_400, finishAt: 18_600, tokens: 1564 },
  ] as const;

  /* Streaming log entries unlock as agents progress */
  const logEntries = [
    { at:    250, agent: 'sentinel',   text: 'POST /chat/completions → deepseek/deepseek-r1-0528' },
    { at:    900, agent: 'sentinel',   text: 'parsing 16 invoices · 12 platform connectors' },
    { at:  2_100, agent: 'sentinel',   text: 'cross-validating amounts vs Notion + GitHub commit history' },
    { at:  4_200, agent: 'sentinel',   text: 'invoice_authenticity_score = 0.94 · fraud_signal = none' },
    { at:  6_500, agent: 'sentinel',   text: 'verdict ready → trust grade B+ · default_risk 18%' },
    { at:  1_500, agent: 'negotiator', text: 'POST /chat/completions → google/gemini-3.1-pro-preview' },
    { at:  3_400, agent: 'negotiator', text: 'analysing prior collection history (avg delay = 4.2d)' },
    { at:  5_700, agent: 'negotiator', text: 'drafting recovery plan in AR/EN → channel = SMS first' },
    { at:  9_400, agent: 'negotiator', text: 'verdict ready → expected_collection_window = 14d' },
    { at:  2_700, agent: 'treasurer',  text: 'POST /chat/completions → anthropic/claude-opus-4.6' },
    { at:  4_900, agent: 'treasurer',  text: 'computing 3-month cashflow projection · OMR base' },
    { at:  7_800, agent: 'treasurer',  text: 'serviceable_income = OMR 7,500 · obligations = OMR 1,650/mo' },
    { at: 10_100, agent: 'treasurer',  text: 'recommending bridge LTV ≤ 70% · term ≤ 45d' },
    { at: 12_800, agent: 'treasurer',  text: 'verdict ready → capital_adequacy = approved' },
    { at:  9_700, agent: 'master',     text: 'awaiting tri-agent consensus …' },
    { at: 13_200, agent: 'master',     text: 'merging Sentinel + Negotiator + Treasurer outputs' },
    { at: 15_400, agent: 'master',     text: 'no contradictions detected · confidence = 0.82' },
    { at: 17_600, agent: 'master',     text: 'composing executive summary in Arabic + English' },
    { at: 18_600, agent: 'master',     text: `master_decision = APPROVED · score ${score}/100` },
  ] as const;

  const visibleLogs = logEntries.filter(e => elapsed >= e.at).slice(-9); // tail
  const allDone = elapsed >= 18_600;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: BORDER, background: CARD }}>
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: BORDER }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#0f172a' }}>
          <Cpu size={15} className="text-white"/>
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-extrabold leading-tight" style={{ color: TEXT }}>AI Underwriting Theater</p>
          <p className="text-[11px] font-mono leading-tight" style={{ color: TEXT3 }}>4 LLMs · ZenMux router · live</p>
        </div>
        <span className={'ml-auto inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ' + (allDone ? 'text-emerald-700' : 'text-blue-700')}
          style={{ borderColor: allDone ? '#a7f3d0' : '#bfdbfe', background: allDone ? '#ecfdf5' : '#eff6ff' }}>
          <span className={'w-1.5 h-1.5 rounded-full ' + (allDone ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse')}/>
          {allDone ? 'consensus reached' : 'reasoning'}
          <span className="font-mono">· {(elapsed / 1000).toFixed(1)}s</span>
        </span>
      </div>

      {/* Agent grid */}
      <div className="px-5 py-4 grid grid-cols-2 gap-3" style={{ background: CREAM }}>
        {agents.map(a => {
          const started   = elapsed >= a.startAt;
          const finished  = elapsed >= a.finishAt;
          const running   = started && !finished;
          const progress  = started
            ? Math.min(1, (elapsed - a.startAt) / (a.finishAt - a.startAt))
            : 0;
          const liveTokens = Math.round(a.tokens * progress);
          const Icon = a.icon;
          return (
            <div key={a.key} className="rounded-xl border p-3 relative overflow-hidden"
              style={{
                borderColor: finished ? a.color + '60' : BORDER,
                background: '#fff',
              }}>
              {/* progress bar (top edge) */}
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: '#f1f5f9' }}>
                <div className="h-full transition-all duration-200"
                  style={{ width: (progress * 100) + '%', background: a.color }}/>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: finished ? a.color : '#f1f5f9', color: finished ? '#fff' : a.color }}>
                  {running
                    ? <Loader2 size={16} className="animate-spin"/>
                    : <Icon size={16}/>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[12px] font-extrabold leading-tight" style={{ color: TEXT }}>{a.label}</p>
                    {finished && <CheckCircle2 size={11} style={{ color: a.color }}/>}
                  </div>
                  <p className="text-[10px] font-semibold leading-tight" style={{ color: TEXT3 }}>{a.role}</p>
                  <p className="text-[9px] font-mono mt-1 truncate" style={{ color: TEXT3 }}>{a.model}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2.5 pt-2 border-t" style={{ borderColor: BORDER }}>
                <span className="text-[10px] font-mono" style={{ color: started ? TEXT2 : TEXT3 }}>
                  {liveTokens.toLocaleString()} <span style={{ color: TEXT3 }}>tok</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: finished ? a.color : running ? '#2563eb' : TEXT3 }}>
                  {finished ? 'done' : running ? 'streaming' : 'queued'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live log stream */}
      <div className="px-5 py-3 border-t font-mono text-[11px] space-y-1" style={{ borderColor: BORDER, background: '#0f172a', minHeight: 140 }}>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold" style={{ color: '#64748b' }}>
          <Workflow size={11}/>
          <span>console → zenmux.ai/v1</span>
          <span className="ml-auto">{visibleLogs.length}/19</span>
        </div>
        <AnimatePresence initial={false}>
          {visibleLogs.map(e => {
            const a = agents.find(x => x.key === e.agent)!;
            return (
              <motion.div key={e.at + '-' + e.agent}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-2 py-0.5">
                <span className="text-[10px] font-mono shrink-0 pt-0.5" style={{ color: '#64748b' }}>
                  +{(e.at / 1000).toFixed(1)}s
                </span>
                <span className="shrink-0 text-[10px] font-bold uppercase pt-0.5" style={{ color: a.color }}>
                  {a.label.toLowerCase()}
                </span>
                <span className="text-[11px] flex-1" style={{ color: '#e2e8f0' }}>{e.text}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {!allDone && (
          <div className="flex items-center gap-2 pt-1">
            <span className="w-1.5 h-3 bg-emerald-400 animate-pulse"/>
            <span className="text-[10px]" style={{ color: '#64748b' }}>awaiting next chunk…</span>
          </div>
        )}
      </div>

      {/* Verdict footer */}
      {allDone && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="px-5 py-3 border-t flex items-center gap-3"
          style={{ borderColor: '#a7f3d0', background: '#ecfdf5' }}>
          <CircleCheck size={18} className="text-emerald-600"/>
          <div className="flex-1">
            <p className="text-[12px] font-extrabold" style={{ color: '#065f46' }}>Tri-agent consensus reached</p>
            <p className="text-[10px] font-semibold" style={{ color: '#047857' }}>Score {score}/100 · confidence 82% · no human review required</p>
          </div>
          <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-white border" style={{ borderColor: '#a7f3d0', color: '#065f46' }}>
            7,898 tokens · 18.6s
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Sentinel Live Cross-Validation — 5 checks turning green over 18s
══════════════════════════════════════════════════════════════════ */
function SentinelLiveValidation({ submittedAt }: { submittedAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  const elapsed = Math.max(0, now - submittedAt);
  const checks = [
    { label: 'PDF signature verified',                            source: 'Crypto',   doneAt: 2_000  },
    { label: 'Invoice amount matches Notion task',                source: 'Notion',   doneAt: 7_000  },
    { label: 'Client name matches WhatsApp/Slack history',        source: 'WhatsApp', doneAt: 13_000 },
    { label: 'GitHub commit volume aligns with declared hours',   source: 'GitHub',   doneAt: 20_000 },
    { label: 'Bank account ownership confirmed',                  source: 'Bank API', doneAt: 28_000 },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER, background: CARD }}>
      <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: BORDER }}>
        <ShieldCheck size={15} style={{ color: '#2563eb' }}/>
        <p className="text-[14px] font-bold tracking-tight" style={{ color: TEXT }}>Sentinel Live Cross-Validation</p>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/> running
        </span>
      </div>
      <div className="px-5 py-4 space-y-2">
        {checks.map((c, idx) => {
          const done = elapsed >= c.doneAt;
          return (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
              className="flex items-center gap-3 p-2.5 rounded-xl border"
              style={{ borderColor: done ? '#a7f3d0' : BORDER, background: done ? '#ecfdf5' : CREAM }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ background: done ? '#15803d' : '#fff', border: done ? 'none' : `1px solid ${BORDER}` }}>
                {done
                  ? <CheckCircle2 size={14} className="text-white"/>
                  : <Loader2 size={14} className="animate-spin" style={{ color: '#2563eb' }}/>}
              </div>
              <p className="text-[12px] font-semibold flex-1" style={{ color: done ? '#065f46' : TEXT2 }}>{c.label}</p>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
                style={{ borderColor: BORDER, color: TEXT3, background: '#fff' }}>
                {c.source}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════ */
export default function CreditPanelPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Use the no-initial overload — raw value can be null until the store is
  // populated. We coalesce to a demo offer below so the existing render code
  // (which reads `offer.foo` heavily) keeps working unchanged.
  const [storedOffer, setOffer] = useSynergyStore<CreditOffer>(CREDIT_STORE);
  const offer: CreditOffer = storedOffer ?? buildDemoOffer();
  const [reports, setReports] = useState<SavedReport[]>(() => loadReports());
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);
  const [activationPhase, setActivationPhase] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [declining, setDeclining] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [bankReview, setBankReview] = useState<BankReviewState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmActivate, setConfirmActivate] = useState(false);
  // Live AI underwriting theatre — runs before actual bank submission
  const [analysisRunning, setAnalysisRunning] = useState(false);
  // Real SHA-256 of the actual signed PDF — written to the blockchain hash
  // line and to the bank-submission email so the document is genuinely
  // tamper-evident (not a synthetic UUID slice).
  const [pdfHash, setPdfHash] = useState<string | null>(null);
  // Track whether we already auto-sent the invoice email for this approval,
  // so the bank-decision interval doesn't fire it on every tick.
  const [invoiceEmailSent, setInvoiceEmailSent] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  const bank = BANKS[offer.bankIdx % BANKS.length];
  const totalCost = Math.round(offer.bridgeAmountSAR * (offer.rateMonthly / 100) * (offer.termDays / 30) * 100) / 100;
  const totalRepay = offer.bridgeAmountSAR + totalCost;
  const repayDay1 = offer.termDays - 10;

  // Compute composite score on mount (reads live localStorage)
  useEffect(() => {
    setScore(computeCompositeScore(offer.riskScore));
  }, [offer.riskScore]);

  useEffect(() => {
    setBankReview(loadBankReviewState(offer.offerRef));
  }, [offer.offerRef]);

  // ── REAL blockchain hash: SHA-256 of the actual signed PDF bytes ──
  // This produces a 64-hex-character hash that anyone can verify by
  // re-running the same SHA-256 over the downloaded PDF — the same
  // proof model real notarisation services (e.g. OriginStamp) use.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = localStorage.getItem(CREDIT_STORE);
        const pipelineData = stored ? JSON.parse(stored)?.pipeline : null;
        if (!pipelineData || !crypto?.subtle) {
          setPdfHash(null);
          return;
        }
        const doc = buildRiskReportPdf(pipelineData);
        const buf = doc.output('arraybuffer') as ArrayBuffer;
        const digest = await crypto.subtle.digest('SHA-256', buf);
        const hex = Array.from(new Uint8Array(digest))
          .map(b => b.toString(16).padStart(2, '0')).join('');
        if (!cancelled) setPdfHash('0x' + hex);
      } catch { if (!cancelled) setPdfHash(null); }
    })();
    return () => { cancelled = true; };
  }, [offer.offerRef, offer.generatedAt]);

  // Reset invoice-email guard when the active offer or the decision changes,
  // so a new approval (different report) is allowed to fire its own email.
  useEffect(() => {
    setInvoiceEmailSent(false);
  }, [offer.offerRef, bankReview?.decision]);

  // Auto-load report from ?report=<id>
  useEffect(() => {
    const id = searchParams.get('report');
    if (!id) return;
    const r = loadReports().find(x => x.id === id);
    if (r) {
      setOffer(offerFromReport(r));
      setActiveReportId(r.id);
    }
  }, [searchParams]);

  // Refresh from store-changed / storage events
  useEffect(() => {
    const refresh = () => {
      setReports(loadReports());
      setBankReview(loadBankReviewState(offer.offerRef));
      setScore(computeCompositeScore(offer.riskScore));
    };
    window.addEventListener('synergy:store-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('synergy:store-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [offer.offerRef, offer.riskScore]);

  // Stages for Station 4 — derived from BANK_REVIEW_STORE or inferred
  const stages = useMemo<Stages>(
    () => deriveStages(offer, score?.total ?? null),
    [offer, score, bankReview],
  );

  const prettyCode = useMemo(
    () => activeReportId ? offerCodeFromId(activeReportId) : 'LB-' + String(offer.offerRef ?? '').replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase().padEnd(4, '0'),
    [activeReportId, offer.offerRef],
  );

  const repayDate = useMemo(
    () => new Date(Date.now() + offer.termDays * 86_400_000).toLocaleDateString('en', { day: '2-digit', month: 'short' }),
    [offer.termDays],
  );

  // Status chip
  const statusInfo = activated
    ? { label: 'Active',   color: '#059669', bg: '#ecfdf5' }
    : declined || stages.decision === 'declined'
      ? { label: 'Declined', color: '#dc2626', bg: '#fef2f2' }
      : stages.decision === 'approved'
        ? { label: 'Approved', color: '#15803d', bg: '#ecfdf5' }
        : { label: 'Pending',  color: '#d97706', bg: '#fffbeb' };

  const handlePickReport = (r: SavedReport) => {
    setOffer(offerFromReport(r));
    setActiveReportId(r.id);
    setActivated(false);
    setDeclined(false);
    logActivity({ type: 'report_loaded', label: 'Report Loaded', detail: r.clientName + ' · ' + r.currency + ' ' + r.amount, ref: r.id });
  };

  const buildOfferSmsBody = (o: CreditOffer, code: string): string => {
    return [
      `Madar — Risk Report ${code}`,
      `Client: ${o.clientName}`,
      `Invoice: ${o.repaymentRef} · ${fmtHome(o.invoiceAmountSAR)}`,
      `Bridge offer: ${fmtHome(o.bridgeAmountSAR)} (${o.coveragePercent}% LTV)`,
      `Rate: ${o.rateMonthly}%/mo · Term: ${o.termDays} days`,
      `Score: ${o.riskScore}/100 · Default risk: ${o.defaultRisk}%`,
      `Status: ${statusInfo.label}`,
    ].join('\n');
  };

  /* ─────────────────────────────────────────────────────────────────
     Personalized message builder — uses real invoice + AI master data
     to craft channel-aware copy. SMS = compact (<160 chars when small).
     WhatsApp = warm Arabic-friendly with invoice list. Email = full
     report with executive summary + AI consensus + next-action CTA.
     ─────────────────────────────────────────────────────────────── */
  type Channel = 'sms' | 'whatsapp' | 'email';
  type EmailMessage = { subject: string; text: string; html: string };

  const pickClientInvoices = (clientName: string) => {
    try {
      const all = JSON.parse(localStorage.getItem('synergy_invoices_v1') || '[]') as Array<{
        id?: string; ref?: string; clientName?: string; amount?: number; currency?: string;
        status?: string; dueDate?: string; issuedDate?: string;
      }>;
      const norm = clientName.trim().toLowerCase();
      // ALL CLIENTS / portfolio mode → use all pending+overdue
      if (norm.includes('all clients') || norm.includes('portfolio')) {
        return all.filter(i => i.status === 'pending' || i.status === 'overdue');
      }
      return all.filter(i => (i.clientName || '').trim().toLowerCase() === norm);
    } catch { return []; }
  };

  const readMasterVerdict = (): { decision?: string; rationale?: string; confidence?: number } => {
    try {
      const raw = localStorage.getItem('synergy_credit_offer_v1');
      if (!raw) return {};
      const parsed = JSON.parse(raw) as { pipeline?: { master?: { decision?: string; rationale?: string; confidence?: number } } };
      return parsed.pipeline?.master ?? {};
    } catch { return {}; }
  };

  const buildPersonalizedMessage = (
    o: CreditOffer,
    code: string,
    channel: Channel,
  ): string | EmailMessage => {
    const invoices    = pickClientInvoices(o.clientName);
    const totalDueAmt = invoices.reduce((s, i) => s + (i.amount ?? 0), 0);
    const oldestOverdue = invoices
      .filter(i => i.status === 'overdue')
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))[0];

    const master      = readMasterVerdict();
    const verdict     = (master.decision || (o.riskScore >= 70 ? 'APPROVED' : o.riskScore >= 50 ? 'CONDITIONAL' : 'REVIEW')).toUpperCase();
    const rationale   = master.rationale?.trim();
    const confidence  = typeof master.confidence === 'number' ? Math.round(master.confidence * 100) : null;

    const bankName    = BANKS[o.bankIdx % BANKS.length].name;
    const greeting    = `Hello ${o.clientName.includes('CLIENTS') ? 'team' : o.clientName}`;
    const overdueLine = oldestOverdue
      ? `Oldest overdue: ${oldestOverdue.ref || oldestOverdue.id} (${oldestOverdue.dueDate || 'no date'}) · ${oldestOverdue.amount} ${oldestOverdue.currency || ''}`
      : null;
    const verdictLine = `AI Verdict: ${verdict}${confidence !== null ? ` (${confidence}% confidence)` : ''}`;

    /* ── SMS — compact ── */
    if (channel === 'sms') {
      const lines: string[] = [
        `Madar · ${code}`,
        `${o.clientName.length > 28 ? o.clientName.slice(0, 25) + '…' : o.clientName}`,
        `Bridge: ${fmtHome(o.bridgeAmountSAR)} @ ${o.rateMonthly}%/mo · ${o.termDays}d`,
        `${verdictLine}`,
      ];
      if (oldestOverdue) lines.push(`Overdue: ${oldestOverdue.amount} ${oldestOverdue.currency || ''}`);
      lines.push(`Score ${o.riskScore}/100 · Risk ${o.defaultRisk}%`);
      return lines.join('\n');
    }

    /* ── WhatsApp — warm, structured ── */
    if (channel === 'whatsapp') {
      const lines: string[] = [
        `*Madar AI Bridge Offer — ${code}*`,
        '',
        `${greeting},`,
        '',
        `Our underwriting AI has reviewed your portfolio with *${bankName}*:`,
        '',
        `📊 *Portfolio:* ${fmtHome(o.invoiceAmountSAR)} across ${invoices.length} invoice${invoices.length === 1 ? '' : 's'}`,
        `💰 *Bridge offer:* ${fmtHome(o.bridgeAmountSAR)} (${o.coveragePercent}% LTV)`,
        `📈 *Rate:* ${o.rateMonthly}%/mo · *Term:* ${o.termDays} days`,
        `🎯 *Risk score:* ${o.riskScore}/100 · *Default risk:* ${o.defaultRisk}%`,
      ];
      if (totalDueAmt > 0) lines.push(`⏳ *Total receivables:* ${totalDueAmt.toLocaleString()} ${invoices[0]?.currency || 'SAR'}`);
      if (overdueLine)     lines.push(`⚠️ ${overdueLine}`);
      lines.push('');
      lines.push(`🤖 ${verdictLine}`);
      if (rationale) lines.push(`_"${rationale.length > 200 ? rationale.slice(0, 197) + '…' : rationale}"_`);
      lines.push('');
      lines.push(`Reply *YES* to activate, or *INFO* for the full PDF report.`);
      return lines.join('\n');
    }

    /* ── Email — full executive report ── */
    const subject = `Madar Risk Report ${code} — ${bankName} · ${o.clientName}`;
    const invoiceRows = invoices.slice(0, 8).map(i =>
      `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${i.ref || i.id || '—'}</td>` +
      `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${(i.amount ?? 0).toLocaleString()} ${i.currency || ''}</td>` +
      `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${i.status || '—'}</td>` +
      `<td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${i.dueDate || '—'}</td></tr>`).join('');
    const text = [
      `Madar AI Bridge — Risk Report ${code}`,
      `Bank: ${bankName}`,
      `Client: ${o.clientName}`,
      ``,
      `EXECUTIVE SUMMARY`,
      `─────────────────`,
      `Bridge offer:    ${fmtHome(o.bridgeAmountSAR)} (${o.coveragePercent}% LTV)`,
      `Portfolio base:  ${fmtHome(o.invoiceAmountSAR)} across ${invoices.length} invoice(s)`,
      `Rate:            ${o.rateMonthly}%/mo · Term ${o.termDays} days`,
      `Risk score:      ${o.riskScore}/100 · Default risk ${o.defaultRisk}%`,
      `Status:          ${statusInfo.label}`,
      ``,
      `AI CONSENSUS`,
      `─────────────────`,
      verdictLine,
      rationale ? `Rationale: ${rationale}` : '',
      ``,
      overdueLine ? `Receivables flag: ${overdueLine}` : '',
      ``,
      `— Madar Underwriting Engine`,
    ].filter(Boolean).join('\n');
    const html = `
      <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
        <div style="background:linear-gradient(135deg,#0f172a,#1e293b);color:#f8fafc;padding:24px 28px;border-radius:16px 16px 0 0">
          <div style="font-size:11px;letter-spacing:.18em;opacity:.7;text-transform:uppercase">Madar AI Bridge · ${bankName}</div>
          <div style="font-size:24px;font-weight:700;margin-top:4px">Risk Report ${code}</div>
          <div style="font-size:13px;opacity:.75;margin-top:2px">${o.clientName}</div>
        </div>
        <div style="background:#fff;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 16px 16px">
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px">
            <div style="flex:1;min-width:140px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:12px;border-top:3px solid #0ea5e9">
              <div style="font-size:11px;color:#64748b;letter-spacing:.1em;text-transform:uppercase">Bridge Offer</div>
              <div style="font-size:20px;font-weight:700;margin-top:4px">${fmtHome(o.bridgeAmountSAR)}</div>
              <div style="font-size:12px;color:#64748b">${o.coveragePercent}% LTV · ${o.rateMonthly}%/mo</div>
            </div>
            <div style="flex:1;min-width:140px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:12px;border-top:3px solid #8b5cf6">
              <div style="font-size:11px;color:#64748b;letter-spacing:.1em;text-transform:uppercase">Risk Score</div>
              <div style="font-size:20px;font-weight:700;margin-top:4px">${o.riskScore}/100</div>
              <div style="font-size:12px;color:#64748b">Default risk ${o.defaultRisk}%</div>
            </div>
            <div style="flex:1;min-width:140px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:12px;border-top:3px solid #059669">
              <div style="font-size:11px;color:#64748b;letter-spacing:.1em;text-transform:uppercase">AI Verdict</div>
              <div style="font-size:18px;font-weight:700;margin-top:4px">${verdict}</div>
              <div style="font-size:12px;color:#64748b">${confidence !== null ? confidence + '% confidence' : 'consensus reached'}</div>
            </div>
          </div>
          ${rationale ? `<blockquote style="margin:0 0 18px;padding:12px 16px;border-left:3px solid #0ea5e9;background:#f0f9ff;border-radius:0 8px 8px 0;font-size:13px;color:#0c4a6e">${rationale}</blockquote>` : ''}
          ${invoiceRows ? `
            <div style="font-size:12px;color:#64748b;letter-spacing:.1em;text-transform:uppercase;margin:18px 0 8px">Invoices in scope</div>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
              <thead><tr style="background:#f8fafc;text-align:left">
                <th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Ref</th>
                <th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Amount</th>
                <th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Status</th>
                <th style="padding:8px 10px;border-bottom:1px solid #e5e7eb">Due</th>
              </tr></thead>
              <tbody>${invoiceRows}</tbody>
            </table>` : ''}
          <div style="margin-top:24px;font-size:12px;color:#94a3b8">— Madar Underwriting Engine · automated message</div>
        </div>
      </div>`;
    return { subject, text, html };
  };


  /* Email the latest analysis report to a client (warm tone) instead of SMS.
   * SMS was removed because Twilio Trial filtering (error 30454) made delivery
   * unreliable for GCC carriers. Email is free, branded, and archivable. */
  const handleEmailLatestToClient = async () => {
    const latest = reports[0];
    const useOffer = latest ? offerFromReport(latest) : offer;
    const code     = latest ? offerCodeFromId(latest.id) : prettyCode;
    return doEmailToClient(useOffer, code, 'Latest Analysis Emailed to Client');
  };

  const handleEmailOfferToClient = async () => {
    return doEmailToClient(offer, prettyCode, 'Bridge Offer Emailed to Client');
  };

  const doEmailToClient = async (o: CreditOffer, code: string, activityLabel: string) => {
    const to = resolveDemoEmail() || window.prompt('Client email address?') || '';
    if (!to || !/@/.test(to)) {
      showToast('Email cancelled — no recipient');
      return;
    }
    const built = buildPersonalizedMessage(o, code, 'email') as EmailMessage;
    try {
      const r = await sendEmail({ to, subject: built.subject, text: built.text, html: built.html });
      logActivity({
        type: r.sent ? 'email_sent' : 'email_failed',
        label: r.sent ? activityLabel : 'Client Email Failed',
        detail: `${code} · ${o.clientName} · ${to}${r.redirected ? ' (redirected to owner inbox)' : ''}${r.sent ? '' : ' · ' + (r.error || 'error')}`,
        ref: o.offerRef,
      });
      if (r.sent) {
        showToast(r.redirected
          ? `Email sent ✓ (redirected to owner inbox — Resend free tier)`
          : `Email sent ✓ (${to})`);
      } else if (r.simulated) {
        showToast(`Email backend offline — start it with: node scripts/api-server.cjs`);
      } else {
        showToast(`Email failed: ${r.error || 'server error'}`);
      }
    } catch (err) {
      showToast('Email error: ' + ((err as Error).message || 'unknown'));
    }
  };

  const handleCopyOfferCode = useCallback(() => {
    try {
      navigator.clipboard?.writeText(prettyCode);
    } catch { /**/ }
    showToast('Copied ✓');
  }, [prettyCode, showToast]);

  const handleArchiveToActivity = useCallback(() => {
    const reportId = activeReportId ?? offer.offerRef;
    const total = score?.total ?? offer.riskScore;
    logActivity({
      type: 'report_archived',
      label: 'Analysis Archived',
      detail: `${prettyCode} · score ${total}/100 · ${offer.clientName}`,
      ref: reportId,
    });
    showToast('Archived ✓');
    window.setTimeout(() => {
      navigate(`/activity?highlight=${encodeURIComponent(reportId)}`);
    }, 600);
  }, [activeReportId, offer.offerRef, offer.clientName, offer.riskScore, prettyCode, score?.total, navigate, showToast]);

  const handleViewActivityForOffer = useCallback(() => {
    const reportId = activeReportId ?? offer.offerRef;
    navigate(`/activity?highlight=${encodeURIComponent(reportId)}`);
  }, [activeReportId, offer.offerRef, navigate]);

  // Advance bank review stages automatically once a report is submitted.
  useEffect(() => {
    if (!bankReview || bankReview.step === 'decision') return;

    const ROTATING_RESPONSES = [
      'Verifying digital signature on PDF...',
      'Parsing invoice amount and IBAN...',
      'Cross-checking GitHub commit cadence with claimed work...',
      'Validating client communication trail...',
      'Computing final risk envelope...',
    ];

    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = now - bankReview.submittedAt;
      let next = bankReview;
      let changed = false;

      // Rotating "live" response substring while in 'sent' phase
      if (next.step === 'sent') {
        const idx = Math.floor(elapsed / 2_000) % ROTATING_RESPONSES.length;
        const desired = ROTATING_RESPONSES[idx];
        if (next.response !== desired) {
          next = { ...next, response: desired };
          changed = true;
        }
      }

      // Sent → Reviewed at +6s
      if (next.step === 'sent' && elapsed >= 6_000) {
        next = {
          ...next,
          step: 'reviewed',
          reviewedAt: next.reviewedAt || now,
          response: 'Cross-validating report fields, payment history, and blockchain collateral hash...',
        };
        changed = true;
        logActivity({
          type: 'bank_report_reviewed',
          label: 'Bank Reviewed Report',
          detail: `${BANKS[next.bankIdx % BANKS.length].name} · risk profile checked`,
          ref: next.offerRef,
        });
      }

      // Reviewed → Decision at +14s total · score > 70 = approved, else declined
      if ((next.step === 'sent' || next.step === 'reviewed') && elapsed >= 14_000) {
        const decisionScore = clampScore(score?.total ?? next.score ?? offer.riskScore);
        const approved = decisionScore > 70;
        // Pull the REAL AI master verdict (written by Agent Room's pipeline)
        // so the bank's response message is grounded in actual reasoning,
        // not a generic scripted line.
        let aiRationale = '';
        try {
          const raw = localStorage.getItem(CREDIT_STORE);
          if (raw) {
            const p = JSON.parse(raw) as { pipeline?: { master?: { rationale?: string } } };
            aiRationale = (p.pipeline?.master?.rationale ?? '').trim();
          }
        } catch { /**/ }
        const aiSnippet = aiRationale
          ? ` · AI verdict: ${aiRationale.slice(0, 180)}${aiRationale.length > 180 ? '…' : ''}`
          : '';
        next = {
          ...next,
          step: 'decision',
          decidedAt: next.decidedAt || now,
          decision: approved ? 'approved' : 'declined',
          score: decisionScore,
          response: approved
            ? `Approved: score ${decisionScore}/100 · bridge terms confirmed for ${fmtHome(offer.bridgeAmountSAR)}.${aiSnippet}`
            : `Declined: score ${decisionScore}/100 · below risk threshold (70). Improve credit profile and resubmit.${aiSnippet}`,
        };
        changed = true;
        logActivity({
          type: 'bank_decision',
          label: approved ? 'Bank Decision: Approved' : 'Bank Decision: Declined',
          detail: `${BANKS[next.bankIdx % BANKS.length].name} · score ${decisionScore}/100`,
          ref: next.offerRef,
        });
      }

      if (changed) {
        setBankReview(next);
        saveBankReviewState(next);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [bankReview, offer.bridgeAmountSAR, offer.riskScore, score?.total]);

  // ── Auto-invoice email on approval ──
  // Once the bank decides "approved" we fire a real funding-confirmation
  // invoice email to the freelancer (and CC the partner-bank inbox if
  // configured). Guarded by `invoiceEmailSent` so it can't spam on every
  // re-render of the decision branch.
  useEffect(() => {
    if (invoiceEmailSent) return;
    if (bankReview?.decision !== 'approved' || bankReview.step !== 'decision') return;

    const to = (() => {
      try {
        const p = JSON.parse(localStorage.getItem('synergy_user_profile_v1') || '{}') as { email?: string };
        if (p.email && /@/.test(p.email)) return p.email;
      } catch { /**/ }
      return (import.meta.env.VITE_DEMO_EMAIL as string | undefined)
          || (import.meta.env.VITE_BANK_EMAIL as string | undefined)
          || '';
    })();
    if (!to || !/@/.test(to)) return;

    setInvoiceEmailSent(true);
    void (async () => {
      const decisionScore = clampScore(bankReview.score ?? offer.riskScore);
      const bankName = BANKS[(bankReview.bankIdx ?? offer.bankIdx) % BANKS.length].name;
      const repayBy = new Date(Date.now() + offer.termDays * 86_400_000)
        .toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' });
      const amount = fmtHome(offer.bridgeAmountSAR);
      const totalRepayAmt = fmtHome(Math.round(totalRepay));
      const hashLine = pdfHash ?? offer.blockchainHash;
      const subject = `Funding Approved · Invoice ${prettyCode} · ${amount}`;
      const html = `
<div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;background:#f8fafc;padding:24px;color:#0f172a">
  <div style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:linear-gradient(135deg,#059669,#10b981);color:#fff;padding:22px 26px">
      <p style="margin:0;font-size:11px;letter-spacing:2px;font-weight:700;opacity:0.9">FUNDING APPROVED</p>
      <p style="margin:6px 0 0;font-size:22px;font-weight:800">${amount}</p>
      <p style="margin:4px 0 0;font-size:12px;opacity:0.92">Invoice ${prettyCode} · ${bankName}</p>
    </div>
    <div style="padding:22px 26px">
      <p style="margin:0 0 8px;font-size:14px">Your bridge financing has been approved by <strong>${bankName}</strong> with a credit score of <strong>${decisionScore}/100</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:13px">
        <tr><td style="padding:8px 0;color:#64748b">Principal</td><td style="padding:8px 0;text-align:right;font-weight:700">${amount}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Rate</td><td style="padding:8px 0;text-align:right;font-weight:700">${offer.rateMonthly}% / month</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Term</td><td style="padding:8px 0;text-align:right;font-weight:700">${offer.termDays} days (1 month)</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Repay by</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#b45309">${repayBy}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Total repayment</td><td style="padding:8px 0;text-align:right;font-weight:800">${totalRepayAmt}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Collateral</td><td style="padding:8px 0;text-align:right">${offer.repaymentRef} · ${offer.clientName}</td></tr>
      </table>
      <div style="margin-top:18px;padding:12px;background:#f1f5f9;border-radius:10px">
        <p style="margin:0 0 4px;font-size:10px;letter-spacing:1.5px;font-weight:700;color:#64748b">PDF · BLOCKCHAIN HASH (SHA-256)</p>
        <p style="margin:0;font-family:monospace;font-size:11px;word-break:break-all;color:#0f172a">${hashLine}</p>
      </div>
      <p style="margin:18px 0 0;font-size:11px;color:#64748b">This invoice is auto-generated by Madar after the bank's underwriting agents (Sentinel · Negotiator · Treasurer · Master · Auditor) reached consensus. Funds are scheduled for transfer pending activation.</p>
    </div>
  </div>
</div>`.trim();
      const text = [
        `FUNDING APPROVED — ${amount}`,
        `Invoice ${prettyCode} · ${bankName}`,
        ``,
        `Score: ${decisionScore}/100`,
        `Principal: ${amount}`,
        `Rate: ${offer.rateMonthly}% / month`,
        `Term: ${offer.termDays} days (1 month)`,
        `Repay by: ${repayBy}`,
        `Total repayment: ${totalRepayAmt}`,
        `Collateral: ${offer.repaymentRef} · ${offer.clientName}`,
        ``,
        `PDF blockchain hash (SHA-256):`,
        `${hashLine}`,
      ].join('\n');
      try {
        const r = await sendEmail({ to, subject, text, html });
        logActivity({
          type: r.sent ? 'email_sent' : 'email_failed',
          label: r.sent ? 'Funding Invoice Emailed' : 'Funding Invoice Email Failed',
          detail: `${prettyCode} · ${amount} · ${to}${r.sent ? '' : ' · ' + (r.error || 'error')}`,
          ref: offer.offerRef,
        });
        if (r.sent) {
          showToast(r.redirected
            ? `Invoice sent ✓ (redirected to owner inbox)`
            : `Invoice emailed ✓ (${to})`);
        }
      } catch { /* swallow — already logged */ }
    })();
  }, [bankReview, invoiceEmailSent, offer, pdfHash, prettyCode, totalRepay, showToast]);

  const handleActivate = () => {
    if (activationPhase !== 0) return;
    // Open confirmation modal first; the user must accept before launching.
    setConfirmActivate(true);
  };

  const confirmAndLaunchBridge = () => {
    if (activationPhase !== 0) return;
    setConfirmActivate(false);
    setActivationPhase(1);
    try {
      localStorage.setItem(CREDIT_STORE + '_activated', JSON.stringify({ ...offer, activatedAt: Date.now() }));
    } catch { /**/ }
    logActivity({ type: 'bridge_activated', label: 'Bridge Activated', detail: fmtHome(offer.bridgeAmountSAR) + ' · ' + bank.name, ref: offer.offerRef });
    showToast('Bridge activation queued ✓');
  };

  // Phase auto-advance: 1 → 2 → 3 → 4, ~900ms per phase.
  useEffect(() => {
    if (activationPhase === 0 || activationPhase === 4) return;
    const next = (activationPhase + 1) as 2 | 3 | 4;
    const delay = activationPhase === 1 ? 1100 : activationPhase === 2 ? 1300 : 1500;
    const id = window.setTimeout(() => {
      setActivationPhase(next);
      if (next === 4) setActivated(true);
    }, delay);
    return () => window.clearTimeout(id);
  }, [activationPhase]);

  const handleDecline = () => {
    setDeclining(true);
    setTimeout(() => { setDeclining(false); setDeclined(true); }, 800);
    logActivity({ type: 'offer_declined', label: 'Offer Declined', detail: offer.offerRef, ref: offer.offerRef });
  };

  const handleDownloadPdf = () => {
    try {
      const stored = localStorage.getItem(CREDIT_STORE);
      const pipelineData = stored ? JSON.parse(stored)?.pipeline : null;
      if (pipelineData) {
        const doc = buildRiskReportPdf(pipelineData);
        doc.save(`RISK_REPORT_${offer.offerRef}.pdf`);
        showToast('PDF downloaded ✓');
      } else {
        showToast('No pipeline data — run a report from Agent Room first');
      }
    } catch (err) {
      showToast('PDF failed: ' + ((err as Error).message || 'unknown error'));
    }
    logActivity({ type: 'pdf_downloaded', label: 'Report PDF Downloaded', detail: 'RISK_REPORT_' + offer.offerRef + '.pdf', ref: offer.offerRef });
  };

  /** Resolve the demo recipient email from the user profile (fallback to env). */
  const resolveDemoEmail = (): string => {
    try {
      const p = JSON.parse(localStorage.getItem('synergy_user_profile_v1') || '{}') as { email?: string };
      if (p.email && /@/.test(p.email)) return p.email;
    } catch { /**/ }
    // Either VITE_DEMO_EMAIL (explicit) or VITE_BANK_EMAIL (used by api-server
    // as the partner-bank inbox / Resend free-tier owner redirect target).
    const envEmail =
      (import.meta.env.VITE_DEMO_EMAIL as string | undefined) ||
      (import.meta.env.VITE_BANK_EMAIL as string | undefined) ||
      '';
    return envEmail;
  };

  const handleEmailToBank = async () => {
    const to = resolveDemoEmail() || window.prompt('Recipient email for risk report?') || '';
    if (!to || !/@/.test(to)) {
      showToast('Email cancelled — no recipient');
      return;
    }
    const built = buildPersonalizedMessage(offer, prettyCode, 'email') as EmailMessage;
    try {
      const r = await sendEmail({ to, subject: built.subject, text: built.text, html: built.html });
      logActivity({
        type: r.sent ? 'email_sent' : 'email_failed',
        label: r.sent ? 'Risk Report Emailed' : 'Email Send Failed',
        detail: `${prettyCode} · ${to}${r.redirected ? ' (redirected to owner inbox)' : ''}${r.sent ? '' : ' · ' + (r.error || 'error')}`,
        ref: offer.offerRef,
      });
      if (r.sent) {
        showToast(r.redirected
          ? `Email sent ✓ (redirected to owner inbox — Resend free tier)`
          : `Email sent ✓ (${to})`);
      } else if (r.simulated) {
        showToast(`Email backend offline — start it with: node scripts/api-server.cjs`);
      } else {
        showToast(`Email failed: ${r.error || 'server error'}`);
      }
    } catch (err) {
      showToast('Email error: ' + ((err as Error).message || 'unknown'));
    }
  };

  const handleSubmitToBank = useCallback(() => {
    // If a previous submission is already in flight, give the user
    // explicit feedback instead of silently no-op'ing — that "looks broken".
    if (bankReview && bankReview.step !== 'idle') {
      const stepLabel =
        bankReview.step === 'sent'     ? 'awaiting bank review'
      : bankReview.step === 'reviewed' ? 'bank is reviewing'
      :                                  `decision: ${bankReview.decision || 'pending'}`;
      showToast(`Already submitted · ${stepLabel}`);
      return;
    }
    // Open the live AI underwriting theatre. The actual transmission runs
    // when the modal calls onComplete (after ~8.5s of agent reasoning).
    if (analysisRunning) return;
    setAnalysisRunning(true);
  }, [bankReview, analysisRunning, showToast]);

  const executeBankSubmission = useCallback(() => {
    setAnalysisRunning(false);
    const submitted: BankReviewState = {
      offerRef: offer.offerRef,
      bankIdx: offer.bankIdx,
      step: 'sent',
      submittedAt: Date.now(),
      reviewedAt: null,
      decidedAt: null,
      decision: null,
      score: clampScore(score?.total ?? offer.riskScore),
      response: 'Risk report received. Sending PDF payload through API and validating signature...',
      source: 'credit-panel',
    };

    setBankReview(submitted);
    saveBankReviewState(submitted);
    // Notify the rest of the app so any other open page (Activity log,
    // Connections sidebar, header badge…) refreshes immediately.
    try { window.dispatchEvent(new Event('synergy:store-changed')); } catch { /**/ }
    logActivity({
      type: 'bank_report_sent',
      label: 'Report Sent to Bank',
      detail: `${BANKS[offer.bankIdx % BANKS.length].name} · POST /reports · queued`,
      ref: offer.offerRef,
    });

    // Immediate visual feedback — fires before async email work so the user
    // never sees a "dead" click while the network round-trip is in flight.
    showToast(`✓ Submitted to ${BANKS[offer.bankIdx % BANKS.length].name} · awaiting review…`);

    // Fire a real email to the partner-bank inbox (resolved from
    // VITE_BANK_EMAIL or user profile). This was previously a no-op which is
    // why "Submit to Bank" looked broken — the state changed but no message
    // ever left the box.
    void (async () => {
      const bankName = BANKS[offer.bankIdx % BANKS.length].name;
      const to = resolveDemoEmail();
      if (!to || !/@/.test(to)) {
        // Soft warning toast — primary "submitted" toast already shown above.
        window.setTimeout(
          () => showToast('No bank email configured — set VITE_BANK_EMAIL to enable real send'),
          1900,
        );
        return;
      }
      try {
        const built = buildPersonalizedMessage(offer, prettyCode, 'email') as EmailMessage;
        const r = await sendEmail({
          to,
          subject: built.subject,
          text: built.text,
          html: built.html,
        });
        logActivity({
          type: r.sent ? 'email_sent' : 'email_failed',
          label: r.sent ? 'Bank Submission Emailed' : 'Bank Email Failed',
          detail: `${prettyCode} · ${bankName} · ${to}${r.redirected ? ' (redirected)' : ''}${r.sent ? '' : ' · ' + (r.error || 'error')}`,
          ref: offer.offerRef,
        });
        if (r.sent) {
          showToast(r.redirected
            ? `Bank notified ✓ (Resend free-tier redirect)`
            : `Bank notified ✓ at ${to}`);
        } else if (r.simulated) {
          showToast(`Email backend offline · start: node scripts/api-server.cjs`);
        } else {
          showToast(`Email failed: ${r.error || 'server error'}`);
        }
      } catch (err) {
        showToast('Email error: ' + ((err as Error).message || 'unknown'));
      }
    })();
  }, [offer, prettyCode, score?.total, showToast, buildPersonalizedMessage]);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 relative">
      {/* Live AI underwriting theatre — pre-submission analysis */}
      <AnimatePresence>
        {analysisRunning && (
          <BankAnalysisLiveOverlay
            offer={offer}
            bankName={bank.name}
            score={clampScore(score?.total ?? offer.riskScore)}
            onComplete={executeBankSubmission}
            onCancel={() => setAnalysisRunning(false)}
          />
        )}
      </AnimatePresence>

      {/* Cinematic activation overlay */}
      <AnimatePresence>
        {activationPhase > 0 && (
          <BridgeLaunchOverlay
            phase={activationPhase as 1 | 2 | 3 | 4}
            offer={offer}
            bankName={bank.name}
            onClose={() => setActivationPhase(0)}
          />
        )}
      </AnimatePresence>

      {/* Activation confirm modal — repayment schedule + final consent */}
      <AnimatePresence>
        {confirmActivate && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-center justify-center px-4"
            style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={() => setConfirmActivate(false)}>
            <motion.div
              initial={{ scale: 0.96, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-[520px] rounded-3xl border overflow-hidden shadow-2xl"
              style={{ borderColor: BORDER, background: CARD }}>
              <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: BORDER }}>
                <Zap size={16} style={{ color: ACCENT }}/>
                <p className="text-[15px] font-extrabold tracking-tight" style={{ color: TEXT }}>Confirm Bridge Activation</p>
                <button onClick={() => setConfirmActivate(false)} className="ml-auto cursor-pointer hover:opacity-70" aria-label="Close">
                  <X size={16} style={{ color: TEXT3 }}/>
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="rounded-2xl border p-4" style={{ borderColor: BORDER, background: CREAM }}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: TEXT3 }}>You will receive</p>
                  <p className="text-[40px] font-black leading-none mt-1 tabular-nums" style={{ color: TEXT }}>
                    <span className="text-[18px] font-semibold align-top mr-1.5" style={{ color: TEXT3 }}>{homeCurrencySymbol()}</span>
                    {toHomeCurrency(offer.bridgeAmountSAR, 'SAR').toLocaleString()}
                  </p>
                  <p className="text-[11px] mt-2" style={{ color: TEXT3 }}>via {bank.name} · {offer.coveragePercent}% LTV on invoice {offer.repaymentRef}</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: TEXT3 }}>Repayment Schedule</p>
                  <div className="space-y-2">
                    {[
                      { l: 'Funds disbursed', v: 'Today', icon: ArrowRight,  color: '#2563eb' },
                      { l: 'Auto-deduct from invoice', v: `Day ${repayDay1}`, icon: RefreshCw, color: '#0ea5e9' },
                      { l: 'Bridge closed', v: `${repayDate} (${offer.termDays}d)`, icon: CircleCheck, color: '#10b981' },
                    ].map(row => (
                      <div key={row.l} className="flex items-center gap-3 px-3 py-2 rounded-xl border" style={{ borderColor: BORDER, background: CARD }}>
                        <row.icon size={14} style={{ color: row.color }}/>
                        <span className="text-[12px] font-semibold flex-1" style={{ color: TEXT }}>{row.l}</span>
                        <span className="text-[12px] font-extrabold" style={{ color: TEXT2 }}>{row.v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['Rate', `${offer.rateMonthly}% / mo`],
                    ['Total cost', fmtHome(Math.round(totalCost))],
                    ['Total repay', fmtHome(Math.round(totalRepay))],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-xl border p-2.5" style={{ borderColor: BORDER, background: CREAM }}>
                      <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: TEXT3 }}>{l}</p>
                      <p className="text-[12px] font-extrabold mt-0.5" style={{ color: TEXT }}>{v}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-start gap-2 p-3 rounded-xl border" style={{ borderColor: BORDER, background: CREAM }}>
                  <ShieldCheck size={14} className="shrink-0 mt-0.5" style={{ color: ACCENT }}/>
                  <p className="text-[11px] leading-relaxed" style={{ color: TEXT2 }}>
                    By activating, you authorise auto-deduction from invoice <strong>{offer.repaymentRef}</strong> on settlement.
                    The bridge is collateralised by a blockchain-registered invoice and cannot be pledged twice.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => setConfirmActivate(false)}
                    className="px-5 h-11 rounded-xl border text-[12px] font-semibold cursor-pointer hover:bg-gray-50"
                    style={{ borderColor: BORDER, color: TEXT2 }}>
                    Cancel
                  </button>
                  <button onClick={confirmAndLaunchBridge}
                    className="flex-1 h-11 rounded-xl text-white font-extrabold text-[13px] flex items-center justify-center gap-2 cursor-pointer hover:opacity-95"
                    style={{ background: DARK }}>
                    <Zap size={14}/> Confirm &amp; Activate
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 pointer-events-none"
            style={{ background: '#111827', color: '#fff' }}>
            <CheckCircle2 size={14} className="text-emerald-400"/>
            <span className="text-[12px] font-bold">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

        {/* Header */}
        <div className="px-6 py-4 border-b shrink-0 flex items-center justify-between" style={{ borderColor: BORDER, background: CARD }}>
          <div>
            <p className="text-[20px] font-black" style={{ fontFamily: "'Caveat',cursive", color: TEXT }}>Credit Panel — Islamic Factoring</p>
            <p className="text-[12px]" style={{ color: TEXT3 }}>bank approved · offer ready</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/activity')}
              className="h-8 px-4 rounded-xl border text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-gray-50"
              style={{ borderColor: BORDER, color: TEXT2 }}>
              <Activity size={13}/> Activity Log
            </button>
            <button onClick={() => navigate('/room')}
              className="h-8 px-4 rounded-xl border text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-gray-50"
              style={{ borderColor: BORDER, color: TEXT2 }}>
              <Brain size={13}/> Agent Room
            </button>
            <button onClick={() => navigate('/manual')}
              className="h-8 px-4 rounded-xl text-[12px] font-bold flex items-center gap-1.5 text-white cursor-pointer"
              style={{ background: ACCENT }}>
              <FileText size={13}/> Invoices
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          <div className="max-w-[1280px] mx-auto px-5 py-5">
            <div className="flex gap-5 items-start">

              {/* ══ LEFT COLUMN ══ */}
              <div className="flex-1 min-w-0 space-y-4">

                {/* Recent reports strip */}
                <RecentReportsStrip
                  reports={reports}
                  activeId={activeReportId}
                  onPick={handlePickReport}
                  onSendLatest={handleEmailLatestToClient}
                />

                {/* ── ACTION TOOLBAR ── */}
                <motion.div
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border p-3 flex flex-wrap items-center gap-2"
                  style={{ borderColor: BORDER, background: CARD }}>
                  <p className="text-[11px] font-bold uppercase tracking-widest mr-2" style={{ color: TEXT3 }}>Actions</p>
                  <button onClick={handleEmailOfferToClient}
                    className="h-9 px-3 rounded-xl text-[12px] font-bold text-white flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ background: '#0ea5e9' }}
                    title="Send the bridge offer to the client and a copy to the partner bank">
                    <Send size={13}/> Send Risk Report by Email
                  </button>
                  <button onClick={handleArchiveToActivity}
                    className="h-9 px-3 rounded-xl border text-[12px] font-bold flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 transition-colors"
                    style={{ borderColor: BORDER, color: TEXT2, background: CARD }}>
                    <Activity size={13}/> Log to Activity
                  </button>
                  <button onClick={handleDownloadPdf}
                    className="h-9 px-3 rounded-xl border text-[12px] font-bold flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 transition-colors"
                    style={{ borderColor: BORDER, color: TEXT2, background: CARD }}>
                    <Download size={13}/> Download PDF
                  </button>
                  {!stages.sent && (
                    <button onClick={handleSubmitToBank}
                      className="h-9 px-3 rounded-xl text-[12px] font-bold text-white flex items-center gap-1.5 cursor-pointer hover:opacity-90 ml-auto transition-opacity"
                      style={{ background: '#2563eb' }}>
                      <Send size={13}/> Submit to Bank
                    </button>
                  )}
                </motion.div>

                {/* ── STATION 1 — THE OFFER ── */}
                <AnimatePresence mode="wait">
                  {activated ? (
                    <ActivatedBanner key="activated" offer={offer} onReset={() => { setActivated(false); setActivationPhase(0); }}/>
                  ) : declined ? (
                    <motion.div key="declined" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="rounded-3xl border p-8 text-center space-y-3" style={{ borderColor: BORDER, background: CARD }}>
                      <X size={40} className="mx-auto text-gray-300"/>
                      <p className="text-[16px] font-bold" style={{ color: TEXT2 }}>Offer Declined</p>
                      <p className="text-[13px]" style={{ color: TEXT3 }}>The bridge offer has been declined. You can request a new one from Agent Room.</p>
                      <button onClick={() => setDeclined(false)} className="flex items-center gap-1.5 text-[12px] font-semibold mx-auto cursor-pointer mt-2 hover:opacity-80" style={{ color: ACCENT }}>
                        <RefreshCw size={12}/> View offer again
                      </button>
                    </motion.div>
                  ) : (
                    <Station1Offer
                      key="station1"
                      offer={offer}
                      score={score}
                      prettyCode={prettyCode}
                      statusLabel={statusInfo.label}
                      statusColor={statusInfo.color}
                      statusBg={statusInfo.bg}
                      repayDate={repayDate}
                      premium={!!score?.premiumBridge}
                      onActivate={handleActivate}
                      onDecline={handleDecline}
                      onCopyCode={handleCopyOfferCode}
                    />
                  )}
                </AnimatePresence>

                {/* ── STATION 2 — REPAYMENT SCHEDULE ── */}
                <Station2Timeline offer={offer} active={activated || stages.decision === 'approved'}/>

                {/* ── STATION 3 — DOCUMENT TRANSMISSION ── */}
                <Station3Transmission
                  active={stages.sent && !stages.decided}
                  submittedAt={bankReview?.submittedAt ?? null}
                />

                {/* ── AI UNDERWRITING THEATER (4 ZenMux LLMs in real time) ── */}
                {stages.sent && bankReview?.submittedAt && (
                  <AIUnderwritingTheater
                    submittedAt={bankReview.submittedAt}
                    score={clampScore(score?.total ?? offer.riskScore)}
                  />
                )}

                {/* ── STATION 4 — BANK REVIEW & DECISION ── */}
                <Station4BankReview
                  stages={stages}
                  liveResponse={bankReview?.response ?? null}
                  onSubmitToBank={handleSubmitToBank}
                  onViewActivity={handleViewActivityForOffer}
                />

                {/* ── SECONDARY: Detailed offer card (terms, collateral, cost) ── */}
                <details className="rounded-2xl border overflow-hidden group" style={{ borderColor: BORDER, background: CARD }}>
                  <summary className="px-5 py-3 cursor-pointer flex items-center gap-2 list-none">
                    <ChevronRight size={14} style={{ color: TEXT3 }} className="group-open:rotate-90 transition-transform"/>
                    <p className="text-[13px] font-extrabold" style={{ fontFamily: "'Caveat',cursive", color: TEXT }}>Detailed Offer Terms · Collateral · Cost</p>
                    <span className="ml-auto text-[10px]" style={{ color: TEXT3 }}>secondary</span>
                  </summary>
                  <div className="p-5 pt-2 space-y-4">
                    <div className="grid grid-cols-3 gap-4 border-b pb-4" style={{ borderColor: BORDER }}>
                      {[['Rate', offer.rateMonthly + '% / month'], ['Term', offer.termDays + ' days (auto)'], ['Repayment', 'Auto from ' + offer.repaymentRef]].map(([l, v]) => (
                        <div key={l}>
                          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: TEXT3 }}>{l}</p>
                          <p className="text-[15px] font-extrabold" style={{ color: TEXT }}>{v}</p>
                        </div>
                      ))}
                    </div>
                    <div className="border-b pb-4" style={{ borderColor: BORDER }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: TEXT3 }}>Collateral</p>
                      <p className="text-[13px] font-semibold" style={{ color: TEXT }}>Invoice {offer.repaymentRef} · {offer.clientName} · {fmtHome(offer.invoiceAmountSAR)}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Lock size={10} style={{ color: TEXT3 }}/>
                        <p className="text-[11px]" style={{ color: TEXT3 }}>blockchain-registered · cannot be pledged twice</p>
                      </div>
                      <p className="text-[10px] mt-1.5 font-mono px-2 py-1 rounded-lg inline-block" style={{ background: CREAM, color: TEXT3 }}>{pdfHash ?? offer.blockchainHash}</p>
                    </div>
                    <div className="flex items-start gap-2 p-3 rounded-xl border" style={{ borderColor: BORDER, background: CREAM }}>
                      <TrendingUp size={13} style={{ color: ACCENT }} className="mt-0.5 shrink-0"/>
                      <p className="text-[11px]" style={{ color: TEXT2 }}>
                        Total cost: <strong>{fmtHome(Math.round(totalCost))}</strong> ({offer.rateMonthly}% × {offer.termDays}/30) · transparent · no hidden fees.
                        {' '}Total repay: <strong>{fmtHome(Math.round(totalRepay))}</strong>. If client pays early → bridge closes, cost pro-rated.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t" style={{ borderColor: BORDER }}>
                      <FileText size={12} style={{ color: TEXT3 }}/>
                      <span className="text-[11px] flex-1" style={{ color: TEXT3 }}>
                        RISK_REPORT_{offer.offerRef}.pdf
                        <span className="ml-1 text-[10px]">· 2.3 MB · signed</span>
                      </span>
                      <button onClick={handleSubmitToBank}
                        className="h-7 px-3 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-gray-50"
                        style={{ borderColor: BORDER, color: TEXT2 }}>
                        <Send size={11}/> Submit to bank
                      </button>
                      <button onClick={handleDownloadPdf}
                        className="h-7 px-3 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-gray-50"
                        style={{ borderColor: BORDER, color: TEXT2 }}>
                        <Download size={11}/> Download
                      </button>
                    </div>
                  </div>
                </details>


              </div>

              {/* ══ RIGHT COLUMN ══ */}
              <div className="w-[280px] shrink-0 space-y-4">

                {/* ── FUNDING GRANTED PANEL — visible only after bank approval ── */}
                {bankReview?.decision === 'approved' && (() => {
                  const approvedAt = bankReview.decidedAt ?? Date.now();
                  const dueAt = approvedAt + offer.termDays * 86_400_000;
                  const daysLeft = Math.max(0, Math.ceil((dueAt - Date.now()) / 86_400_000));
                  const dueLabel = new Date(dueAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
                  const bankName = BANKS[(bankReview.bankIdx ?? offer.bankIdx) % BANKS.length].name;
                  const decisionScore = clampScore(bankReview.score ?? offer.riskScore);
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, type: 'spring', damping: 18 }}
                      className="rounded-2xl overflow-hidden"
                      style={{
                        background: 'linear-gradient(140deg,#065f46 0%,#059669 60%,#10b981 100%)',
                        boxShadow: '0 18px 40px rgba(5,150,105,0.32)',
                      }}
                    >
                      <div className="px-4 py-3 flex items-center gap-2 text-white"
                        style={{ background: 'rgba(0,0,0,0.18)' }}>
                        <CircleCheck size={16}/>
                        <p className="text-[12px] font-extrabold tracking-wide">FUNDING GRANTED</p>
                        <span className="ml-auto text-[10px] font-mono opacity-90">{decisionScore}/100</span>
                      </div>
                      <div className="p-4 text-white">
                        <p className="text-[10px] uppercase tracking-[1.5px] opacity-80 font-bold">{bankName} approved</p>
                        <p className="text-[24px] font-black mt-1 leading-none">{fmtHome(offer.bridgeAmountSAR)}</p>
                        <p className="text-[10px] mt-1 opacity-85">Wired to your account · ref {prettyCode}</p>
                        <div className="mt-3 rounded-xl px-3 py-2.5"
                          style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.25)' }}>
                          <div className="flex items-center gap-1.5">
                            <Clock size={11}/>
                            <p className="text-[10px] font-bold uppercase tracking-wider opacity-95">Repayment Deadline</p>
                          </div>
                          <p className="text-[15px] font-black mt-0.5">1 month — {dueLabel}</p>
                          <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
                            <div className="h-full rounded-full"
                              style={{
                                width: `${Math.max(4, Math.min(100, (daysLeft / offer.termDays) * 100))}%`,
                                background: '#fff',
                              }}/>
                          </div>
                          <p className="text-[10px] mt-1 opacity-90 font-mono">{daysLeft} day{daysLeft === 1 ? '' : 's'} remaining · auto-debit from {offer.repaymentRef}</p>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                          <div className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.12)' }}>
                            <p className="opacity-75 font-bold">Rate</p>
                            <p className="font-extrabold">{offer.rateMonthly}% / mo</p>
                          </div>
                          <div className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.12)' }}>
                            <p className="opacity-75 font-bold">Total Repay</p>
                            <p className="font-extrabold">{fmtHome(Math.round(totalRepay))}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-start gap-1.5 text-[10px] opacity-90">
                          <Lock size={11} className="shrink-0 mt-0.5"/>
                          <p>
                            PDF signed · SHA-256 anchored
                            <span className="block font-mono mt-0.5 text-[9px] break-all opacity-80">{(pdfHash ?? offer.blockchainHash).slice(0, 22)}…{(pdfHash ?? offer.blockchainHash).slice(-8)}</span>
                          </p>
                        </div>
                        <div className="mt-3 flex items-center gap-1.5 text-[10px] opacity-95">
                          <Send size={10}/>
                          <span>Invoice emailed to your inbox automatically</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })()}

                {/* Risk Report Summary */}
                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER, background: CARD }}>
                  <div className="px-4 py-4 border-b" style={{ borderColor: BORDER }}>
                    <p className="text-[15px] font-extrabold" style={{ fontFamily: "'Caveat',cursive", color: TEXT }}>Risk Report Summary</p>
                    <p className="text-[10px] mt-0.5" style={{ color: TEXT3 }}>RISK_REPORT_{offer.offerRef}.pdf · generated · signed</p>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Sections from wireframe */}
                    {[
                      { n: '1.', title: 'Borrower Profile',  lines: ['Active freelancer since ' + offer.activeSince, offer.invoicesPaid + ' invoices · ' + offer.paymentProb + '% payment rate', 'Primary currency: ' + homeCurrencySymbol() + ' · multi-market'] },
                      { n: '2.', title: 'Collateral Invoice', lines: [offer.repaymentRef + ' · ' + offer.clientName + ' · ' + fmtHome(offer.invoiceAmountSAR), 'Blockchain hash: ' + (pdfHash ?? offer.blockchainHash), 'Anti-duplicate check: PASSED'] },
                      { n: '3.', title: 'Risk Assessment',    lines: ['Default probability: ' + offer.defaultRisk + '%', 'Portfolio health: stable', 'Confidence score: ' + offer.paymentProb + '%'] },
                      { n: '4.', title: 'Requested Bridge',   lines: ['Amount: ' + fmtHome(offer.bridgeAmountSAR) + ' (' + offer.coveragePercent + '% LTV)', 'Term: ' + offer.termDays + ' days · Rate: ' + offer.rateMonthly + '%/mo', 'Auto-repay from invoice ' + offer.repaymentRef] },
                    ].map(section => (
                      <div key={section.n} className="border-b last:border-0 pb-3 last:pb-0" style={{ borderColor: BORDER }}>
                        <p className="text-[12px] font-extrabold mb-1.5" style={{ fontFamily: "'Caveat',cursive", color: TEXT }}>{section.n} {section.title}</p>
                        {section.lines.map(line => (
                          <p key={line} className="text-[11px] py-0.5 flex items-start gap-1" style={{ color: TEXT2 }}>
                            <span style={{ color: TEXT3 }}>·</span> {line}
                          </p>
                        ))}
                      </div>
                    ))}
                    <div className="pt-2 border-t text-center" style={{ borderColor: BORDER }}>
                      <p className="text-[10px] italic" style={{ color: TEXT3 }}>— signed by Treasurer · Agent 03 —</p>
                    </div>
                    <button onClick={handleDownloadPdf}
                      className="w-full h-9 rounded-xl border text-[12px] font-semibold flex items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors"
                      style={{ borderColor: BORDER, color: TEXT2 }}>
                      <Download size={12}/> Re-download Report PDF
                    </button>
                  </div>
                </div>

                {/* Borrower Profile card */}
                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER, background: CARD }}>
                  <div className="px-4 py-4 border-b" style={{ borderColor: BORDER }}>
                    <p className="text-[15px] font-extrabold" style={{ fontFamily: "'Caveat',cursive", color: TEXT }}>Portfolio Health</p>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5" style={{ color: TEXT3 }}>Borrower</p>
                      <p className="text-[13px] font-bold" style={{ color: TEXT }}>{offer.freelancerName} · freelance</p>
                      <p className="text-[11px]" style={{ color: TEXT3 }}>active since: {offer.activeSince} · {offer.invoicesPaid} invoices</p>
                      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: '#e7e5e4' }}>
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: offer.paymentProb + '%' }}/>
                      </div>
                      <p className="text-[10px] mt-1" style={{ color: TEXT3 }}>{offer.paymentProb}% payment rate</p>
                    </div>
                    <div className="pt-2 border-t" style={{ borderColor: BORDER }}>
                      {[['pending', fmtHome(offer.pendingSAR)], ['expected 30d', fmtHome(offer.expectedSAR)], ['default risk', offer.defaultRisk + '%']].map(([l,v]) => (
                        <div key={l} className="flex justify-between text-[11px] py-0.5">
                          <span style={{ color: TEXT3 }}>{l}:</span>
                          <span className="font-semibold" style={{ color: l === 'default risk' && parseFloat(String(v)) < 15 ? '#15803d' : TEXT }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t" style={{ borderColor: BORDER }}>
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: TEXT3 }}>Collateral Check</p>
                      {['client identity confirmed', 'invoice on blockchain', 'no duplicate pledge'].map(item => (
                        <div key={item} className="flex items-center gap-2 py-0.5">
                          <CheckCircle2 size={11} className="text-emerald-500 shrink-0"/>
                          <span className="text-[11px]" style={{ color: TEXT }}>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Alternative Scenarios */}
                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER, background: CARD }}>
                  <div className="px-4 py-4 border-b" style={{ borderColor: BORDER }}>
                    <p className="text-[15px] font-extrabold" style={{ fontFamily: "'Caveat',cursive", color: TEXT }}>Alternative Scenarios</p>
                  </div>
                  <div className="px-4 pb-2">
                    <Scenario bullet="○" title="Wait for client to pay" sub="cost 0 · risk high · gap persists"/>
                    <Scenario bullet="○" title="Push harder on negotiation" sub="cost 0 · +48h · 52% success"/>
                    <Scenario bullet="●" title="Activate Liquidity Bridge" sub={'cost ' + fmtHome(Math.round(totalCost)) + ' · risk low · instant'} recommended/>
                  </div>
                  <div className="px-4 py-3 border-t flex items-center gap-2" style={{ borderColor: BORDER }}>
                    <Shield size={12} style={{ color: ACCENT }}/>
                    <p className="text-[11px] font-semibold italic" style={{ color: TEXT2 }}>
                      Treasurer recommends: <span className="font-black text-blue-700">Bridge</span>
                    </p>
                  </div>
                </div>

                {/* About */}
                <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: BORDER, background: CARD }}>
                  <div className="flex items-center gap-2">
                    <Info size={13} style={{ color: TEXT3 }}/>
                    <p className="text-[11px] font-bold" style={{ color: TEXT3 }}>About this offer</p>
                  </div>
                  <p className="text-[11px] leading-relaxed" style={{ color: TEXT3 }}>
                    Simulated micro-liquidity bridge. Standard cap {fmtHome(BASE_BRIDGE_SAR)} · Score &gt;70 unlocks {fmtHome(PREMIUM_BRIDGE_SAR)}. Real integration requires KYC.
                  </p>
                  <button onClick={() => navigate('/connections')}
                    className="flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer hover:underline" style={{ color: ACCENT }}>
                    <ArrowRight size={11}/> Connect your bank account
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

/* ── Activity logger helper ── */
function logActivity(event: { type: string; label: string; detail: string; ref: string }) {
  try {
    const log = JSON.parse(localStorage.getItem(ACTIVITY_STORE) || '[]') as unknown[];
    log.unshift({ ...event, ts: Date.now() });
    localStorage.setItem(ACTIVITY_STORE, JSON.stringify(log.slice(0, 200)));
  } catch { /**/ }
}