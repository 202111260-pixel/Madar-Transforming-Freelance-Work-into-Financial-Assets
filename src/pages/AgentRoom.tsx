import { useCallback, useState, useTransition, useMemo, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import GeneratingLoader from '../components/GeneratingLoader';
import ThemeToggle from '../components/ThemeToggle';
import UnifiedScoreCard from '../components/UnifiedScoreCard';
import { computeUnifiedScore, persistLatestAiScore } from '../lib/scoreEngine';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
  AreaChart, Area, PieChart, Pie,
} from 'recharts';
import {
  ShieldCheck, Send, Building2, Coins, Plus, Home, X, Zap, Brain,
  BarChart3, Activity, Clock, Banknote, CheckCircle2, AlertTriangle,
  XCircle, Loader2, Eye, FileText, Target, Shield, Sparkles, Timer,
  ArrowUpRight, ChevronRight, Gauge, CircleDot, Download, Mail,
  MessageCircle, User, Briefcase, Calendar, Hash, FileCheck,
  Keyboard, Mail as MailIcon, Camera, MessageSquare, Mic,
  TrendingUp, Wallet, Copy, Link2, CreditCard, BadgeCheck as BadgeIcon,
  Network, Users, Volume2, Pause as PauseIcon,
} from 'lucide-react';
import {
  runSynergyPipeline, MODEL_LABELS,
  type StepStatus, type SentinelResult, type NegotiatorResult,
  type TreasurerResult, type MasterReport, type PipelineResult,
  type ProfilerResult, type AuditorResult,
  type InvoiceInput, type InvoiceSource,
} from '../lib/synergyPipeline';
import { sendEmail, type EmailSendResult } from '../lib/sendgridEmail';
import type { WhatsAppSendResult } from '../lib/twilioWhatsapp';
import { buildRiskReportPdf, pdfToBase64 } from '../lib/synergyPdf';
import { synthesizeSpeech } from '../lib/zenmux';
import {
  buildBehavioralContextBlock, getBehavioralReport, trustBand,
} from '../lib/behavioralAnalysis';
import {
  detectHomeCurrency, toHomeCurrency, homeCurrencySymbol,
} from '../lib/homeCurrency';
import MagicRings from '../components/MagicRings';

/* ── Tokens (CSS custom properties — dark mode aware) ── */
const CREAM  = 'var(--cream)';
const CARD   = 'var(--card)';
const BORDER = 'var(--border)';
const TEXT   = 'var(--text)';
const TEXT2  = 'var(--text2)';
const TEXT3  = 'var(--text3)';
const ACCENT = 'var(--accent)';

const AGENTS = {
  profiler:   { color: '#7c3aed', bg: '#f5f3ff', icon: Brain,          name: 'Profiler',   tag: 'Sub-Agent 00 · Context Enrichment' },
  sentinel:   { color: '#2563eb', bg: '#eef4ff', icon: ShieldCheck,    name: 'Sentinel',   tag: 'Agent 01 · Risk Scanner' },
  negotiator: { color: '#059669', bg: '#ecfdf5', icon: MessageCircle, name: 'Negotiator', tag: 'Agent 02 · Smart Collection' },
  treasurer:  { color: '#d97706', bg: '#fffbeb', icon: Building2,     name: 'Treasurer',  tag: 'Agent 03 · Liquidity & Bank' },
  auditor:    { color: '#0ea5e9', bg: '#f0f9ff', icon: BadgeIcon,      name: 'Auditor',    tag: 'Sub-Agent 05 · Validation & Bank Letter' },
} as const;

const BANK_REVIEW_STORE    = 'synergy_bank_review_v1';
const REPORTS_STORE        = 'synergy_reports_v1';
const AUTO_NAV_STORE       = 'synergy_auto_navigate';
const SUBMITTED_HASHES_KEY = 'synergy_submitted_hashes_v1';

type BankDecision = 'approved' | 'conditional' | 'declined' | null;

interface SubmittedHashEntry {
  offerRef: string;
  clientName: string;
  submittedAt: number;
  decision: BankDecision;
}

function getSubmittedHashes(): Record<string, SubmittedHashEntry> {
  try { return JSON.parse(localStorage.getItem(SUBMITTED_HASHES_KEY) || '{}'); } catch { return {}; }
}

function isHashSubmitted(hash: string): boolean {
  return !!getSubmittedHashes()[hash];
}

function writeSubmittedHash(hash: string, entry: SubmittedHashEntry) {
  const store = getSubmittedHashes();
  store[hash] = entry;
  try { localStorage.setItem(SUBMITTED_HASHES_KEY, JSON.stringify(store)); } catch { /**/ }
}

const CURRENCIES = ['SAR', 'USD', 'OMR', 'AED', 'EGP', 'BHD', 'KWD', 'QAR', 'EUR'];

const SAR_RATES: Record<string, number> = { SAR: 1, USD: 3.75, OMR: 9.75, AED: 1.02, EUR: 4.1, EGP: 0.075, BHD: 9.95, KWD: 12.2, QAR: 1.03 };
const toSARAmt = (amt: number, cur: string) => amt * (SAR_RATES[cur] ?? 1);

/**
 * Render any amount as the user's HOME currency (OMR for the seeded persona).
 * Use everywhere we display money — keeps the dashboard from mixing SAR with OMR.
 */
const formatHome = (amount: number, fromCurrency: string): string => {
  const home = detectHomeCurrency();
  const v = toHomeCurrency(amount || 0, fromCurrency || home, home);
  return `${v.toLocaleString()} ${homeCurrencySymbol(home)}`;
};

type SavedReport = {
  id: string;
  createdAt: number;
  mode: 'single' | 'portfolio';
  clientName: string;
  amount: number;
  currency: string;
  score: number;
  /** Transparent breakdown of how `score` was computed. */
  scoreBreakdown?: {
    paymentProbability: number;   // Sentinel.predicted_payment_probability (0-100)
    liquidityScore: number;       // Treasurer.liquidity_score (0-100)
    authenticity: number;         // Sentinel.invoice_authenticity_score (0-100)
    trustGradePenalty: number;    // -10 per grade below A (D=-30, C=-20, B=-10, A=0)
    behavioralTrust: number;      // BehavioralReport.aggregateTrustScore (0-100)
    formula: string;              // human-readable formula
  };
  summary: string;
  contextSnapshot: { connectionsCount: number; invoicesCount: number; trustScore: number; redFlags: number };
};

const PORTFOLIO_CLIENT_NAME = 'ALL CLIENTS (Portfolio Scan)';

function loadReports(): SavedReport[] {
  try { return JSON.parse(localStorage.getItem(REPORTS_STORE) || '[]') as SavedReport[]; }
  catch { return []; }
}
function pushReport(r: SavedReport) {
  try {
    const all = [r, ...loadReports()].slice(0, 20);
    localStorage.setItem(REPORTS_STORE, JSON.stringify(all));
    window.dispatchEvent(new Event('synergy:store-changed'));
  } catch { /**/ }
}
function relativeTime(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SOURCE_OPTS: { value: InvoiceSource; label: string; icon: React.ElementType }[] = [
  { value: 'manual',   label: 'Manual entry',     icon: Keyboard },
  { value: 'email',    label: 'Read from email',  icon: MailIcon },
  { value: 'photo',    label: 'Photo / OCR',      icon: Camera },
  { value: 'whatsapp', label: 'WhatsApp forward', icon: MessageSquare },
  { value: 'voice',    label: 'Voice note',       icon: Mic },
];

/* ══════════════════════════════════════════════════════════════════
   Micro components
   ══════════════════════════════════════════════════════════════════ */
function StatusPill({ status, color }: { status: StepStatus; color: string }) {
  const c = {
    idle:    { Icon: CircleDot,    text: 'Waiting',    bg: '#f5f5f4', border: '#e7e5e4', fg: TEXT3 },
    loading: { Icon: Loader2,      text: 'Analyzing',  bg: `${color}10`, border: `${color}30`, fg: color },
    done:    { Icon: CheckCircle2, text: 'Complete',   bg: '#ecfdf5', border: '#a7f3d0', fg: '#059669' },
    error:   { Icon: XCircle,      text: 'Error',      bg: '#fef2f2', border: '#fecaca', fg: '#dc2626' },
  }[status];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border"
      style={{ background: c.bg, borderColor: c.border, color: c.fg }}>
      <c.Icon size={10} className={status === 'loading' ? 'animate-spin' : ''} />
      {c.text}
    </span>
  );
}

function DataRow({ label, value, icon: Icon }: { label: string; value: string | number; icon?: React.ElementType }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: `${BORDER}80` }}>
      <span className="flex items-center gap-2 text-[11px]" style={{ color: TEXT3 }}>
        {Icon && <Icon size={11} />}{label}
      </span>
      <span className="text-[12px] font-semibold font-mono text-right max-w-[60%] truncate" style={{ color: TEXT }}>{value}</span>
    </div>
  );
}

function Section({ title, icon: Icon, children, className = '' }: {
  title: string; icon: React.ElementType; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${className}`} style={{ borderColor: BORDER, background: CARD }}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: CREAM }}>
          <Icon size={14} style={{ color: ACCENT }} />
        </div>
        <p className="text-sm font-bold" style={{ color: TEXT }}>{title}</p>
      </div>
      {children}
    </div>
  );
}

function KPI({ label, value, sub, icon: Icon, trend, color = ACCENT, delay = 0 }: {
  label: string; value: string; sub?: string; icon: React.ElementType; trend?: string; color?: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="p-5 rounded-2xl border"
      style={{ borderColor: BORDER, background: CARD }}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: CREAM }}>
          <Icon size={17} style={{ color }} />
        </div>
        {trend && (
          <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
            <ArrowUpRight size={10} />{trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-black tracking-tight" style={{ color: TEXT }}>{value}</p>
      <p className="text-[11px] mt-0.5" style={{ color: TEXT3 }}>{label}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: TEXT3 }}>{sub}</p>}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Agent Card
   ══════════════════════════════════════════════════════════════════ */
function AgentCard({
  agentKey, modelLabel, status, summary, details,
}: {
  agentKey: keyof typeof AGENTS;
  modelLabel: string;
  status: StepStatus;
  summary: string;
  details: React.ReactNode;
}) {
  const a = AGENTS[agentKey];
  const Icon = a.icon;
  // ── ChatGPT-style typewriter for the summary ──
  // When `summary` arrives, reveal it character-by-character so the three
  // agents appear to "speak" in parallel as their responses come in.
  const [revealed, setRevealed] = useState('');
  useEffect(() => {
    if (!summary) { setRevealed(''); return; }
    setRevealed('');
    let i = 0;
    const step = Math.max(1, Math.ceil(summary.length / 220)); // finish in ~220 ticks
    const id = setInterval(() => {
      i = Math.min(summary.length, i + step);
      setRevealed(summary.slice(0, i));
      if (i >= summary.length) clearInterval(id);
    }, 14);
    return () => clearInterval(id);
  }, [summary]);
  // The three core agents get the animated rings backdrop
  const showRings = agentKey === 'sentinel' || agentKey === 'negotiator' || agentKey === 'treasurer';
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="relative flex flex-col rounded-2xl border overflow-hidden"
      style={{ borderColor: BORDER, background: CARD }}>
      {/* Animated MagicRings backdrop — three flowing lines per agent */}
      {showRings && (
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{ opacity: status === 'loading' ? 0.6 : status === 'done' ? 0.28 : 0.16, transition: 'opacity 600ms ease' }}
          aria-hidden
        >
          <MagicRings
            color={a.color}
            colorTwo={
              agentKey === 'sentinel'   ? '#06b6d4' :   // blue → cyan
              agentKey === 'negotiator' ? '#84cc16' :   // green → lime
              /* treasurer */             '#f97316'     // amber → orange
            }
            ringCount={3}
            speed={status === 'loading' ? 1.4 : 0.6}
            attenuation={11}
            lineThickness={1.8}
            baseRadius={0.34}
            radiusStep={0.12}
            scaleRate={0.14}
            opacity={1}
            noiseAmount={0.04}
            ringGap={1.5}
            parallax={0}
          />
        </div>
      )}
      <div className="relative z-10 flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: `${BORDER}80` }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: a.bg }}>
            <Icon size={20} style={{ color: a.color }} />
          </div>
          <div>
            <p className="text-sm font-black leading-none tracking-tight" style={{ color: a.color }}>{a.name}</p>
            <p className="text-[10px] mt-0.5 font-mono" style={{ color: TEXT3 }}>{a.tag} · {modelLabel}</p>
          </div>
        </div>
        <StatusPill status={status} color={a.color} />
      </div>
      <div className="relative z-10 flex-1 px-5 py-4 space-y-3 overflow-y-auto max-h-[520px]" style={{ scrollbarWidth: 'thin' }}>
        {status === 'idle' && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Icon size={24} style={{ color: `${a.color}30` }} />
            <p className="text-xs mt-2" style={{ color: TEXT3 }}>Waiting for analysis</p>
          </div>
        )}
        {status === 'loading' && (
          <div className="space-y-3 py-3">
            {[95, 70, 50].map((w, i) => (
              <div key={i} className="h-2 rounded-full overflow-hidden" style={{ background: `${BORDER}60` }}>
                <motion.div className="h-full rounded-full" style={{ background: a.color }}
                  initial={{ width: 0 }} animate={{ width: `${w}%` }}
                  transition={{ duration: 1.5, delay: i * 0.2, repeat: Infinity, repeatType: 'reverse' }} />
              </div>
            ))}
            <p className="text-[11px] text-center mt-3" style={{ color: TEXT3 }}>Processing via {modelLabel.split('·')[0]}...</p>
          </div>
        )}
        {(status === 'done' || status === 'error') && summary && (
          <p className="text-[13px] leading-[1.9]" style={{ color: TEXT2 }}>
            {revealed}
            {revealed.length < summary.length && (
              <span
                className="inline-block w-[2px] h-[14px] align-middle ml-0.5 animate-pulse"
                style={{ background: a.color }}
              />
            )}
          </p>
        )}
        {status === 'done' && revealed.length >= summary.length && details}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Live Agent Telemetry — real-time per-agent activity panel
   ══════════════════════════════════════════════════════════════════ */
type MicroState = 'idle' | 'reading' | 'thinking' | 'streaming' | 'done' | 'error';

const MICRO_PILL: Record<MicroState, { label: string; bg: string; border: string; fg: string }> = {
  idle:      { label: 'Idle',            bg: '#f5f5f4', border: '#e7e5e4', fg: '#78716c' },
  reading:   { label: 'Reading context', bg: '#eef4ff', border: '#bfdbfe', fg: '#2563eb' },
  thinking:  { label: 'Thinking',        bg: '#fffbeb', border: '#fde68a', fg: '#b45309' },
  streaming: { label: 'Streaming',       bg: '#eef2ff', border: '#c7d2fe', fg: '#4338ca' },
  done:      { label: 'Done',            bg: '#ecfdf5', border: '#a7f3d0', fg: '#059669' },
  error:     { label: 'Error',           bg: '#fef2f2', border: '#fecaca', fg: '#dc2626' },
};

const AGENT_TASKS = {
  profiler: [
    'Classifying industry sector…',
    'Scoring geographic risk…',
    'Computing platform trust index…',
    'Building behavioral fingerprint…',
    'Mapping risk amplifiers & mitigators…',
  ],
  sentinel: [
    'Reading 43 platform metadata streams…',
    'Cross-checking commit timestamps…',
    'Detecting fraud anomalies…',
    'Computing trust score…',
    'Reconciling KYC fingerprints…',
  ],
  negotiator: [
    'Analyzing client communication history…',
    'Estimating payment probability…',
    'Comparing late-pay patterns…',
    'Drafting WhatsApp follow-up…',
    'Tuning escalation tone…',
  ],
  treasurer: [
    'Computing cashflow envelope…',
    'Modeling 30/45/60-day scenarios…',
    'Sizing the bridge loan…',
    'Stress-testing default risk…',
    'Building bank-grade risk grade…',
  ],
  auditor: [
    'Cross-checking agent consistency…',
    'Computing confidence bands…',
    'Detecting inter-agent contradictions…',
    'Drafting bank recommendation letter…',
    'Finalizing action matrix…',
  ],
} as const;

type AgentKey = keyof typeof AGENT_TASKS;

function TelemetryRow({
  agentKey, micro, tokens, taskIdx, summary, latencyMs,
}: {
  agentKey: AgentKey;
  micro: MicroState;
  tokens: number;
  taskIdx: number;
  summary?: string;
  latencyMs?: number;
}) {
  const a = AGENTS[agentKey];
  const Icon = a.icon;
  const pill = MICRO_PILL[micro];
  const modelLabel = MODEL_LABELS[agentKey];
  const isActive = micro === 'reading' || micro === 'thinking' || micro === 'streaming';
  const isDone = micro === 'done';
  const taskList = AGENT_TASKS[agentKey];
  const currentTask = taskList[taskIdx % taskList.length];

  return (
    <div
      className="flex items-center gap-3 sm:gap-4 px-4 py-3 rounded-xl border transition-all"
      style={{
        borderColor: isActive ? `${a.color}55` : BORDER,
        background: isActive ? `${a.color}06` : CREAM,
      }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: a.bg }}>
        <Icon size={18} style={{ color: a.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-black tracking-tight" style={{ color: TEXT }}>{a.name}</p>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: '#fff', border: `1px solid ${BORDER}`, color: TEXT3 }}>
            {modelLabel.split(' · ')[0]}
          </span>
          <span
            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border"
            style={{ background: pill.bg, borderColor: pill.border, color: pill.fg }}
          >
            {micro === 'streaming' || micro === 'thinking' || micro === 'reading' ? (
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: pill.fg }}
              />
            ) : isDone ? (
              <CheckCircle2 size={10} />
            ) : micro === 'error' ? (
              <XCircle size={10} />
            ) : (
              <CircleDot size={10} />
            )}
            {pill.label}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2">
          {isActive ? (
            <motion.div
              key={taskIdx}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex items-center gap-1.5 text-[11px] truncate"
              style={{ color: TEXT2 }}
            >
              <motion.span
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="inline-flex"
              >
                <Sparkles size={11} style={{ color: a.color }} />
              </motion.span>
              <span className="truncate">{currentTask}</span>
            </motion.div>
          ) : isDone && summary ? (
            <p className="flex items-center gap-1.5 text-[11px] truncate" style={{ color: TEXT2 }}>
              <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
              <span className="truncate">{summary}</span>
            </p>
          ) : (
            <p className="text-[11px]" style={{ color: TEXT3 }}>Awaiting upstream signal…</p>
          )}
        </div>
      </div>

      <div className="hidden sm:flex flex-col items-end shrink-0 min-w-[78px]">
        <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: TEXT3 }}>
          {isDone && latencyMs ? `${(latencyMs / 1000).toFixed(1)}s · tokens` : 'Tokens'}
        </p>
        <p className="text-[15px] font-black font-mono tabular-nums" style={{ color: isActive ? a.color : TEXT2 }}>
          {tokens.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function LiveAgentTelemetry({
  micro, tokens, tasks, summaries, usage, language, onLanguageChange,
}: {
  micro: Record<AgentKey, MicroState>;
  tokens: Record<AgentKey, number>;
  tasks: Record<AgentKey, number>;
  summaries: Record<AgentKey, string | undefined>;
  usage?: Partial<Record<'sentinel'|'negotiator'|'treasurer'|'master', { totalTokens: number; latencyMs: number }>>;
  language: 'ar' | 'en';
  onLanguageChange: (l: 'ar' | 'en') => void;
}) {
  const totalTokens = (usage?.sentinel?.totalTokens || 0) + (usage?.negotiator?.totalTokens || 0) + (usage?.treasurer?.totalTokens || 0) + (usage?.master?.totalTokens || 0);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border p-4 sm:p-5"
      style={{ borderColor: BORDER, background: CARD }}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <motion.span
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          >
            <Activity size={14} style={{ color: ACCENT }} />
          </motion.span>
          <p className="text-[12px] font-black uppercase tracking-wider" style={{ color: TEXT }}>Live Agent Telemetry</p>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ background: '#ecfdf5', color: '#059669' }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 align-middle animate-pulse" />
            connected
          </span>
          {totalTokens > 0 && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border" style={{ borderColor: BORDER, color: TEXT2 }}>
              {totalTokens.toLocaleString()} real tokens
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: TEXT3 }}>Output language</span>
          <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: BORDER }}>
            <button onClick={() => onLanguageChange('ar')} className={`px-2.5 py-1 text-[10px] font-bold cursor-pointer ${language === 'ar' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500'}`}>AR</button>
            <button onClick={() => onLanguageChange('en')} className={`px-2.5 py-1 text-[10px] font-bold cursor-pointer ${language === 'en' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500'}`}>EN</button>
          </div>
          <p className="text-[10px] font-mono" style={{ color: TEXT3 }}>4 agents · sequential</p>
        </div>
      </div>

      <div className="space-y-2">
        {/* Profiler hidden from UI — still runs in pipeline */}
        <TelemetryRow agentKey="sentinel"   micro={micro.sentinel}   tokens={tokens.sentinel}   taskIdx={tasks.sentinel}   summary={summaries.sentinel}   latencyMs={usage?.sentinel?.latencyMs} />
        <TelemetryRow agentKey="negotiator" micro={micro.negotiator} tokens={tokens.negotiator} taskIdx={tasks.negotiator} summary={summaries.negotiator} latencyMs={usage?.negotiator?.latencyMs} />
        <TelemetryRow agentKey="treasurer"  micro={micro.treasurer}  tokens={tokens.treasurer}  taskIdx={tasks.treasurer}  summary={summaries.treasurer}  latencyMs={usage?.treasurer?.latencyMs} />
        <TelemetryRow agentKey="auditor"    micro={micro.auditor}    tokens={tokens.auditor}    taskIdx={tasks.auditor}    summary={summaries.auditor}    latencyMs={undefined} />
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   New Invoice Modal
   ══════════════════════════════════════════════════════════════════ */
function NewInvoiceModal({
  open, onClose, onSubmit, initialValues,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (inv: InvoiceInput) => void;
  initialValues?: Partial<InvoiceInput>;
}) {
  const [freelancerName, setFreelancerName] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('SAR');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [source, setSource] = useState<InvoiceSource>('manual');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState('');

  // Liquidity Tools picker
  const [showPicker, setShowPicker] = useState(false);
  const savedInvoices = useState<Array<{ id: string; number: number; clientName: string; amount: number; currency: string; issueDate: string; dueDate: string; projectRef: string; notes: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('synergy_invoices_v1') || '[]'); } catch { return []; }
  })[0];

  // Reset fields when modal opens
  useEffect(() => {
    if (!open) return;
    setShowPicker(false);
    if (initialValues) {
      setFreelancerName(initialValues.freelancerName || '');
      setClientName(initialValues.clientName || '');
      setClientPhone(initialValues.clientPhone || '');
      setClientEmail(initialValues.clientEmail || '');
      setAmount(initialValues.amount ? String(initialValues.amount) : '');
      setCurrency(initialValues.currency || 'SAR');
      setIssueDate(initialValues.issueDate || '');
      setDueDate(initialValues.dueDate || '');
      setDescription(initialValues.description || '');
      setNotes(initialValues.notes || '');
      setHistory('');
      setSource(initialValues.source || 'manual');
    } else {
      setFreelancerName(''); setClientName(''); setClientPhone(''); setClientEmail('');
      setAmount(''); setCurrency('SAR'); setIssueDate(''); setDueDate('');
      setDescription(''); setNotes(''); setHistory(''); setSource('manual');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const inputCls = `w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
        onClick={onClose}>
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 8 }}
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          className="w-full max-w-2xl rounded-2xl border overflow-hidden max-h-[92vh] flex flex-col"
          style={{ background: CARD, borderColor: BORDER }}
          onClick={e => e.stopPropagation()}>

          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#eef4ff' }}>
                <Plus size={16} className="text-blue-600" />
              </div>
              <p className="text-sm font-bold" style={{ color: TEXT }}>New Invoice Analysis</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg border flex items-center justify-center hover:bg-gray-50 cursor-pointer"
              style={{ borderColor: BORDER, color: TEXT3 }}>
              <X size={14} />
            </button>
          </div>

          <div className="p-6 space-y-4 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {/* Quick-fill from Liquidity Tools */}
            {savedInvoices.length > 0 && (
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                <button type="button" onClick={() => setShowPicker(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] font-semibold cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{ background: 'var(--cream)', color: 'var(--text2)' }}>
                  <span className="flex items-center gap-2">
                    <FileText size={12} /> Quick-fill from Liquidity Tools ({savedInvoices.length})
                  </span>
                  <ChevronRight size={11} style={{ transform: showPicker ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {showPicker && (
                  <div style={{ borderTop: `1px solid var(--border)` }}>
                    {savedInvoices.slice(0, 8).map(inv => (
                      <button key={inv.id} type="button"
                        onClick={() => {
                          setClientName(inv.clientName || '');
                          setAmount(String(inv.amount || ''));
                          setCurrency(inv.currency || 'SAR');
                          setIssueDate(inv.issueDate || '');
                          setDueDate(inv.dueDate || '');
                          setDescription(inv.projectRef || '');
                          setNotes(inv.notes || '');
                          setClientPhone('');
                          setClientEmail('');
                          setHistory('');
                          setShowPicker(false);
                        }}
                        className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] cursor-pointer hover:bg-blue-50 transition-colors border-b last:border-0"
                        style={{ borderColor: 'var(--border)' }}>
                        <span className="font-semibold" style={{ color: 'var(--text)' }}>{inv.clientName}</span>
                        <span className="font-mono text-[11px]" style={{ color: 'var(--text3)' }}>
                          {inv.currency} {(inv.amount || 0).toLocaleString()} · #{inv.number}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Source picker */}
            <div>
              <label className="text-[11px] font-medium block mb-2" style={{ color: TEXT3 }}>Invoice source</label>
              <div className="grid grid-cols-5 gap-2">
                {SOURCE_OPTS.map(opt => {
                  const I = opt.icon;
                  const active = source === opt.value;
                  return (
                    <button key={opt.value} type="button" onClick={() => setSource(opt.value)}
                      className="flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-[10px] font-medium transition-all cursor-pointer"
                      style={{
                        borderColor: active ? ACCENT : BORDER,
                        background: active ? '#eef4ff' : CREAM,
                        color: active ? ACCENT : TEXT2,
                      }}>
                      <I size={16} />
                      {opt.label.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: TEXT3 }}>Freelancer name</label>
                <input value={freelancerName} onChange={e => setFreelancerName(e.target.value)} className={inputCls} style={{ borderColor: BORDER, background: CREAM, color: TEXT }} />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: TEXT3 }}>Client name</label>
                <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Client / company" className={inputCls} style={{ borderColor: BORDER, background: CREAM, color: TEXT }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: TEXT3 }}>Client WhatsApp <span style={{ color: '#d4d0ca' }}>(+countrycode)</span></label>
                <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="+966 5xx xxx xxx" className={inputCls} style={{ borderColor: BORDER, background: CREAM, color: TEXT }} />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: TEXT3 }}>Client email <span style={{ color: '#d4d0ca' }}>(optional)</span></label>
                <input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@example.com" className={inputCls} style={{ borderColor: BORDER, background: CREAM, color: TEXT }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: TEXT3 }}>Amount</label>
                <input value={amount} onChange={e => setAmount(e.target.value)} type="number" className={inputCls} style={{ borderColor: BORDER, background: CREAM, color: TEXT }} />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: TEXT3 }}>Currency</label>
                <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls} style={{ borderColor: BORDER, background: CREAM, color: TEXT }}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: TEXT3 }}>Issued</label>
                <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className={inputCls} style={{ borderColor: BORDER, background: CREAM, color: TEXT }} />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1.5" style={{ color: TEXT3 }}>Due</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} style={{ borderColor: BORDER, background: CREAM, color: TEXT }} />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium block mb-1.5" style={{ color: TEXT3 }}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Logo design + 3 social posts" className={`${inputCls} resize-none`} style={{ borderColor: BORDER, background: CREAM, color: TEXT }} />
            </div>

            <div>
              <label className="text-[11px] font-medium block mb-1.5" style={{ color: TEXT3 }}>Prior history with this client <span style={{ color: '#d4d0ca' }}>(optional)</span></label>
              <textarea value={history} onChange={e => setHistory(e.target.value)} rows={2} placeholder="Paid 2 prior invoices on time, last one 14 days late." className={`${inputCls} resize-none`} style={{ borderColor: BORDER, background: CREAM, color: TEXT }} />
            </div>

            <div>
              <label className="text-[11px] font-medium block mb-1.5" style={{ color: TEXT3 }}>Notes <span style={{ color: '#d4d0ca' }}>(optional)</span></label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Client said they would pay last week, then went silent." className={`${inputCls} resize-none`} style={{ borderColor: BORDER, background: CREAM, color: TEXT }} />
            </div>
          </div>

          <div className="flex gap-3 px-6 py-4 border-t" style={{ borderColor: BORDER }}>
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border text-sm font-medium hover:bg-gray-50 transition-all cursor-pointer"
              style={{ borderColor: BORDER, color: TEXT2 }}>Cancel</button>
            <button onClick={() => {
              const amt = parseFloat(amount);
              const errs: string[] = [];
              if (!clientName.trim()) errs.push('Client name is required');
              if (!Number.isFinite(amt) || amt <= 0) errs.push('Amount must be greater than 0');
              if (!issueDate) errs.push('Issue date is required');
              if (!dueDate) errs.push('Due date is required');
              if (issueDate && dueDate && new Date(dueDate) < new Date(issueDate)) {
                errs.push('Due date must be on or after the issue date');
              }
              if (!description.trim()) errs.push('Description is required so the AI knows what was delivered');
              if (errs.length) { alert('Please fix:\n\n• ' + errs.join('\n• ')); return; }
              onSubmit({
                freelancerName: freelancerName || 'Freelancer',
                clientName: clientName.trim(),
                clientPhone: clientPhone || undefined,
                clientEmail: clientEmail || undefined,
                amount: amt,
                currency,
                issueDate, dueDate,
                source,
                description: description.trim(),
                notes: notes || undefined,
                history: history || undefined,
              });
            }}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-all flex items-center justify-center gap-2 cursor-pointer">
              <Zap size={14} />Run Madar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Send Banner — shows result of Twilio/SendGrid call
   ══════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════
   Voice Listen Button — calls the real Zenmux /audio/speech endpoint
   (proxied through api-server.cjs) and plays the returned MP3.
   Used by the Master verdict banner to give the demo a "live AI voice".
   ══════════════════════════════════════════════════════════════════ */
function VoiceListenButton({
  text,
  voice = 'onyx',
  label = 'Listen',
  ariaLabel = 'Play AI voice narration of the verdict',
}: {
  text: string;
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  label?: string;
  ariaLabel?: string;
}) {
  type State = 'idle' | 'loading' | 'playing' | 'error';
  const [state, setState] = useState<State>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  // Cleanup on unmount or when text changes
  useEffect(() => {
    return () => {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    };
  }, [text]);

  const handleClick = useCallback(async () => {
    // Toggle pause if currently playing
    if (state === 'playing' && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setState('idle');
      return;
    }
    if (state === 'loading') return;

    setState('loading');
    setErrMsg(null);
    try {
      const r = await synthesizeSpeech({ text, voice });
      urlRef.current = r.url;
      const audio = new Audio(r.url);
      audioRef.current = audio;
      audio.onended = () => {
        setState('idle');
        if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
      };
      audio.onerror = () => { setState('error'); setErrMsg('Playback failed'); };
      await audio.play();
      setState('playing');
    } catch (e) {
      setState('error');
      setErrMsg((e as Error).message);
      setTimeout(() => setState('idle'), 4000);
    }
  }, [state, text, voice]);

  const Icon = state === 'loading' ? Loader2 : state === 'playing' ? PauseIcon : Volume2;

  return (
    <button
      onClick={handleClick}
      aria-label={ariaLabel}
      title={state === 'error' && errMsg ? errMsg : `Voice: ${voice} · OpenAI tts-1 via Zenmux`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer transition-all hover:shadow-md"
      style={{
        background: state === 'playing'
          ? '#7c3aed'
          : state === 'error'
            ? '#fef2f2'
            : '#0f172a',
        color: state === 'error' ? '#dc2626' : '#fff',
        borderColor: state === 'error' ? '#fecaca' : 'transparent',
      }}>
      <Icon size={12} className={state === 'loading' ? 'animate-spin' : ''} />
      {state === 'loading' ? 'Synthesising…' :
       state === 'playing' ? 'Playing — tap to stop' :
       state === 'error' ? 'Voice unavailable' :
       label}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Send Banner — shows result of Twilio/SendGrid call
   ══════════════════════════════════════════════════════════════════ */
function SendBanner({ result, kind }: { result: WhatsAppSendResult | EmailSendResult | null; kind: 'whatsapp' | 'email' }) {
  if (!result) return null;
  const ok = result.sent;
  const sim = result.simulated;
  return (
    <div className="mt-3 px-3 py-2 rounded-lg border text-[11px] flex items-start gap-2"
      style={{
        borderColor: ok ? '#a7f3d0' : sim ? '#fde68a' : '#fecaca',
        background: ok ? '#ecfdf5' : sim ? '#fffbeb' : '#fef2f2',
        color: ok ? '#065f46' : sim ? '#92400e' : '#991b1b',
      }}>
      {ok ? <CheckCircle2 size={12} className="mt-0.5 shrink-0" /> :
       sim ? <Sparkles size={12} className="mt-0.5 shrink-0" /> :
       <AlertTriangle size={12} className="mt-0.5 shrink-0" />}
      <div className="flex-1 leading-[1.6]">
        {ok && kind === 'whatsapp' && <span><b>Delivered</b> via Twilio {(result as WhatsAppSendResult).channel === 'sms-fallback' ? '(SMS fallback)' : (result as WhatsAppSendResult).channel === 'sms' ? '(SMS)' : '(WhatsApp)'} · sid {(result as WhatsAppSendResult).sid?.slice(0, 12)}…</span>}
        {ok && kind === 'email'    && <span><b>Email sent</b> via SendGrid → {result.to}</span>}
        {!ok && sim && <span><b>Proxy not running</b> — start the API server: <code>node scripts/api-server.cjs</code>. {result.error ? `(${result.error.slice(0, 80)})` : ''}</span>}
        {!ok && !sim && <span><b>Failed:</b> {result.error}</span>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Client Picker Modal — pick a saved client from synergy_clients_v1
   and auto-build the InvoiceInput from their most recent invoice.
   This replaces the old manual form for the common case where the
   user just wants the AI to analyze data they already saved.
   ══════════════════════════════════════════════════════════════════ */
type SavedClient = {
  id: string; name: string; phone?: string; email?: string;
  country: string; source: string;
  status: 'active' | 'pending' | 'late' | 'ghost' | 'paid';
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  totalInvoiced: number; totalPaid: number; currency: string;
  lastContact: string; nextDue?: string;
  avgDelayDays: number; notes: string; tags: string[];
  invoiceCount: number; paidCount: number;
};
type SavedInvoice = {
  id: string; clientName: string; clientPhone?: string; clientEmail?: string;
  amount: number; currency: string;
  issueDate: string; dueDate: string;
  status: 'paid' | 'pending' | 'overdue';
  source?: InvoiceSource;
  description: string; clientNotes?: string; clientHistory?: string;
};

function ClientPickerModal({
  open, onClose, onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (inv: InvoiceInput) => void;
}) {
  const [clients, setClients] = useState<SavedClient[]>([]);
  const [invoices, setInvoices] = useState<SavedInvoice[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    const load = () => {
      try { setClients(JSON.parse(localStorage.getItem('synergy_clients_v1') || '[]') as SavedClient[]); } catch { /**/ }
      try { setInvoices(JSON.parse(localStorage.getItem('synergy_invoices_v1') || '[]') as SavedInvoice[]); } catch { /**/ }
    };
    load();
    // Re-read whenever the Supabase hydrate completes or any sibling page
    // (Manual Input, Connections, Backend Admin) mutates the same keys.
    window.addEventListener('synergy:hydrated', load);
    window.addEventListener('synergy:store-changed', load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener('synergy:hydrated', load);
      window.removeEventListener('synergy:store-changed', load);
      window.removeEventListener('storage', load);
    };
  }, [open]);

  const filtered = useMemo(() => {
    let list = [...clients];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || (c.country || '').toLowerCase().includes(q));
    }
    // Highest priority first: late/ghost, then pending, then active, then paid
    const order: Record<SavedClient['status'], number> = { late: 0, ghost: 1, pending: 2, active: 3, paid: 4 };
    list.sort((a, b) => order[a.status] - order[b.status]);
    return list;
  }, [clients, search]);

  function buildInvoiceForClient(c: SavedClient): InvoiceInput {
    // Find most relevant invoice for this client (overdue > pending > most recent)
    const candidates = invoices.filter(i =>
      i.clientName.toLowerCase().includes(c.name.toLowerCase().split(' ')[0]) ||
      c.name.toLowerCase().includes(i.clientName.toLowerCase().split(' ')[0])
    );
    const overdue = candidates.find(i => i.status === 'overdue');
    const pending = candidates.find(i => i.status === 'pending');
    const inv = overdue ?? pending ?? candidates[0];

    const today = new Date().toISOString().slice(0, 10);
    if (inv) {
      return {
        freelancerName: 'Freelancer',
        clientName: c.name,
        clientPhone: c.phone ?? inv.clientPhone,
        clientEmail: c.email ?? inv.clientEmail,
        amount: inv.amount,
        currency: inv.currency,
        issueDate: inv.issueDate || today,
        dueDate: inv.dueDate || today,
        source: (inv.source as InvoiceSource) ?? 'manual',
        description: inv.description || `Services for ${c.name}`,
        notes: [c.notes, inv.clientNotes].filter(Boolean).join(' · '),
        history: inv.clientHistory ?? `${c.invoiceCount} invoices billed, ${c.paidCount} paid · avg ${c.avgDelayDays}d delay`,
      };
    }
    // Synthesize from client data only (no invoice yet)
    const owed = Math.max(1, c.totalInvoiced - c.totalPaid);
    return {
      freelancerName: 'Freelancer',
      clientName: c.name,
      clientPhone: c.phone,
      clientEmail: c.email,
      amount: owed,
      currency: c.currency,
      issueDate: c.lastContact || today,
      dueDate: c.nextDue || today,
      source: 'manual',
      description: `Outstanding receivables for ${c.name}`,
      notes: c.notes,
      history: `${c.invoiceCount} invoices billed, ${c.paidCount} paid · avg ${c.avgDelayDays}d delay · status: ${c.status}`,
    };
  }

  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.96, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 8 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden"
          style={{ background: CARD, borderColor: BORDER, maxHeight: '85vh' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
            <div>
              <p className="text-[15px] font-black" style={{ color: TEXT }}>Pick a client to analyze</p>
              <p className="text-[11px]" style={{ color: TEXT3 }}>{clients.length} saved clients · sorted by priority</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center cursor-pointer" style={{ color: TEXT3 }}>
              <X size={16} />
            </button>
          </div>

          <div className="px-5 py-3 border-b" style={{ borderColor: BORDER, background: CREAM }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or country…"
              className="w-full px-3 py-2 rounded-lg border text-[13px] outline-none"
              style={{ borderColor: BORDER, background: CARD, color: TEXT }}
            />
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 130px)' }}>
            {clients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
                <Users size={32} style={{ color: TEXT3 }} />
                <p className="text-[13px] font-bold" style={{ color: TEXT2 }}>No saved clients yet</p>
                <p className="text-[12px]" style={{ color: TEXT3 }}>
                  Open <b>Clients</b> in the sidebar and load the demo portfolio,
                  or add real clients in Liquidity Tools first.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-5 py-6 text-[12px] text-center" style={{ color: TEXT3 }}>No clients match your search.</p>
            ) : (
              <div className="divide-y" style={{ borderColor: BORDER }}>
                {filtered.map(c => {
                  const owed = c.totalInvoiced - c.totalPaid;
                  const statusColor =
                    c.status === 'late' || c.status === 'ghost' ? '#dc2626' :
                    c.status === 'pending' ? '#f59e0b' :
                    c.status === 'paid'    ? '#22c55e' : '#3b82f6';
                  const riskColor =
                    c.risk === 'HIGH'   ? '#dc2626' :
                    c.risk === 'MEDIUM' ? '#f59e0b' : '#22c55e';
                  return (
                    <button
                      key={c.id}
                      onClick={() => onPick(buildInvoiceForClient(c))}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 cursor-pointer text-left transition-colors"
                      style={{ borderColor: BORDER }}>
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: statusColor }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-extrabold truncate" style={{ color: TEXT }}>{c.name}</p>
                        <p className="text-[11px] truncate" style={{ color: TEXT3 }}>
                          {c.country} · {c.invoiceCount} inv · {c.paidCount} paid
                          {c.avgDelayDays > 0 ? ` · +${c.avgDelayDays}d avg delay` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-black" style={{ color: owed > 0 ? '#dc2626' : TEXT }}>
                          {owed > 0 ? formatHome(owed, c.currency) : formatHome(c.totalPaid, c.currency)}
                        </p>
                        <p className="text-[10px] font-bold" style={{ color: riskColor }}>{c.risk} risk</p>
                      </div>
                      <ChevronRight size={14} style={{ color: TEXT3 }} className="shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Main — AgentRoom
   ══════════════════════════════════════════════════════════════════ */
export default function AgentRoom() {
  const navigate = useNavigate();
  const [, startTransition] = useTransition();

  const [profilerStatus, setProfilerStatus] = useState<StepStatus>('idle');
  const [sentinelStatus, setSentinelStatus] = useState<StepStatus>('idle');
  const [negotiatorStatus, setNegotiatorStatus] = useState<StepStatus>('idle');
  const [treasurerStatus, setTreasurerStatus] = useState<StepStatus>('idle');
  const [masterStatus, setMasterStatus] = useState<StepStatus>('idle');
  const [auditorStatus, setAuditorStatus] = useState<StepStatus>('idle');

  const [profilerResult, setProfilerResult] = useState<ProfilerResult | null>(null);
  const [sentinelResult, setSentinelResult] = useState<SentinelResult | null>(null);
  const [negotiatorResult, setNegotiatorResult] = useState<NegotiatorResult | null>(null);
  const [treasurerResult, setTreasurerResult] = useState<TreasurerResult | null>(null);
  const [masterReport, setMasterReport] = useState<MasterReport | null>(null);
  const [auditorResult, setAuditorResult] = useState<AuditorResult | null>(null);
  const [pipeline, setPipeline] = useState<PipelineResult | null>(null);

  const [errors, setErrors] = useState<string[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [prefillData, setPrefillData] = useState<Partial<InvoiceInput> | null>(null);
  const location = useLocation();
  const [currentInvoice, setCurrentInvoice] = useState<InvoiceInput | null>(null);

  useEffect(() => {
    const state = location.state as { prefill?: Partial<InvoiceInput> } | null;
    if (state?.prefill) {
      setPrefillData(state.prefill);
      setShowNew(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [waLang, setWaLang] = useState<'ar' | 'en'>('ar');
  const [waResult, setWaResult] = useState<WhatsAppSendResult | null>(null);
  const [emailResult, setEmailResult] = useState<EmailSendResult | null>(null);
  const [sendingWa, setSendingWa] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // ── Blockchain-lock + AI Bank Decision state ──
  const [bankDecision, setBankDecision] = useState<BankDecision>(null);
  const [bankDecisionAt, setBankDecisionAt] = useState<number | null>(null);
  const [approvalEmailSent, setApprovalEmailSent] = useState(false);
  const [bankLockError, setBankLockError] = useState<string | null>(null);

  /** Derived: is the current pipeline's hash already submitted? */
  const currentHash = pipeline?.treasurer.blockchain_hash ?? null;
  const bankAlreadySubmitted = currentHash ? isHashSubmitted(currentHash) : false;
  const bankSubmittedEntry   = currentHash ? getSubmittedHashes()[currentHash] ?? null : null;

  // ── Recent reports + auto-navigate preference ──
  const [autoNav, setAutoNav] = useState<boolean>(() => {
    try { return localStorage.getItem(AUTO_NAV_STORE) !== '0'; } catch { return true; }
  });
  const [navBanner, setNavBanner] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  useEffect(() => {
    try { localStorage.setItem(AUTO_NAV_STORE, autoNav ? '1' : '0'); } catch { /**/ }
  }, [autoNav]);

  // ── Cross-page reactivity: bump tick on storage changes so flow strip refreshes
  const [storeTick, setStoreTick] = useState(0);
  useEffect(() => {
    const bump = () => setStoreTick(t => t + 1);
    window.addEventListener('storage', bump);
    window.addEventListener('synergy:store-changed', bump as EventListener);
    return () => {
      window.removeEventListener('storage', bump);
      window.removeEventListener('synergy:store-changed', bump as EventListener);
    };
  }, []);

  // ── Behavioral trust snapshot ──
  const behavioral = useMemo(() => {
    void storeTick;
    try { return getBehavioralReport(); } catch { return null; }
  }, [storeTick]);
  const trustBandInfo = behavioral ? trustBand(behavioral.aggregateTrustScore) : null;

  const reset = useCallback(() => {
    setProfilerStatus('idle'); setSentinelStatus('idle'); setNegotiatorStatus('idle'); setTreasurerStatus('idle'); setMasterStatus('idle'); setAuditorStatus('idle');
    setProfilerResult(null); setSentinelResult(null); setNegotiatorResult(null); setTreasurerResult(null);
    setMasterReport(null); setAuditorResult(null); setPipeline(null); setErrors([]);
    setWaResult(null); setEmailResult(null);
  }, []);

  const run = useCallback(async (invoice: InvoiceInput) => {
    reset();
    setCurrentInvoice(invoice);
    const isPortfolio = invoice.clientName === PORTFOLIO_CLIENT_NAME;

    // ── Build enriched context from connected platforms, all clients, and liquidity ──
    let enrichedInvoice = invoice;
    try {
      type ConnEntry = { status: string };
      type InvEntry = { clientName: string; amount: number; currency: string; status: string; clientNotes?: string; clientHistory?: string };
      type OblEntry = { amount: number; currency: string };
      type ClientEntry = {
        name: string; country: string; status: string; risk: string;
        totalInvoiced: number; totalPaid: number; currency: string;
        avgDelayDays: number; invoiceCount: number; paidCount: number;
        notes?: string; tags?: string[];
      };

      const connStore = JSON.parse(localStorage.getItem('synergy_connections_v4') || '{}') as Record<string, ConnEntry>;
      const connectedPlatforms = Object.entries(connStore)
        .filter(([, v]) => v.status === 'connected').map(([k]) => k);

      const allInvoices = JSON.parse(localStorage.getItem('synergy_invoices_v1') || '[]') as InvEntry[];
      const pendingInv = allInvoices.filter(i => i.status !== 'paid');
      const toSAR = (amt: number, cur: string) =>
        amt * ({ SAR: 1, USD: 3.75, OMR: 9.75, AED: 1.02, EUR: 4.1, EGP: 0.075, BHD: 9.95, KWD: 12.2, QAR: 1.03 } as Record<string, number>)[cur] || amt;
      const totalPendingSAR = pendingInv.reduce((s, i) => s + toSAR(i.amount, i.currency), 0);

      const obligations = JSON.parse(localStorage.getItem('synergy_obligations_v1') || '[]') as OblEntry[];
      const totalOblSAR = obligations.reduce((s, o) => s + toSAR(o.amount, o.currency), 0);
      const cashGap = Math.max(0, totalOblSAR - totalPendingSAR);

      // Client-specific profile
      const clientProfile = allInvoices.find(
        i => i.clientName.trim().toLowerCase() === invoice.clientName.trim().toLowerCase()
      );

      // Client portfolio from relationship tracker
      const clientPortfolio = JSON.parse(localStorage.getItem('synergy_clients_v1') || '[]') as ClientEntry[];
      const overdueClients = clientPortfolio.filter(c => c.status === 'late' || c.status === 'ghost');
      const anchorClients  = clientPortfolio.filter(c => c.status === 'paid' || (c.status === 'active' && c.avgDelayDays === 0));
      const totalPortfolioOMR = clientPortfolio.reduce((s, c) => s + toSAR(c.totalInvoiced, c.currency) / 9.75, 0);
      const collectionRate = clientPortfolio.length > 0
        ? Math.round(clientPortfolio.reduce((s, c) => s + (c.paidCount / Math.max(1, c.invoiceCount)), 0) / clientPortfolio.length * 100)
        : 0;
      // Find profile for THIS specific client from the relationship tracker
      const portfolioProfile = clientPortfolio.find(
        c => c.name.toLowerCase().includes(invoice.clientName.toLowerCase()) ||
             invoice.clientName.toLowerCase().includes(c.name.split(' ')[0].toLowerCase())
      );

      const clientPortfolioBlock = clientPortfolio.length > 0 ? [
        `=== CLIENT RELATIONSHIP PORTFOLIO (${clientPortfolio.length} clients) ===`,
        `Anchor clients (reliable, on-time): ${anchorClients.length} — e.g. ${anchorClients.slice(0, 3).map(c => c.name).join(', ')}`,
        `Overdue/ghosting clients: ${overdueClients.length} — ${overdueClients.map(c => `${c.name} (${formatHome(c.totalInvoiced - c.totalPaid, c.currency)} owed, avg +${c.avgDelayDays}d late)`).join('; ')}`,
        `Portfolio collection rate: ${collectionRate}%`,
        `Total portfolio value: ≈ ${formatHome(totalPortfolioOMR * 9.75, 'SAR')}`,
        portfolioProfile
          ? `THIS CLIENT PROFILE: ${portfolioProfile.name} | ${portfolioProfile.country} | risk: ${portfolioProfile.risk} | status: ${portfolioProfile.status} | avg delay: ${portfolioProfile.avgDelayDays}d | notes: ${portfolioProfile.notes ?? 'none'}`
          : '',
        `=== END CLIENT PORTFOLIO ===`,
      ].filter(Boolean).join('\n') : '';

      const contextLines = [
        isPortfolio
          ? `=== MODE: PORTFOLIO SCAN === Sentinel will analyze ALL clients and platforms, not a single invoice. ===`
          : `=== MODE: SINGLE INVOICE ===`,
        `=== MADAR PLATFORM CONTEXT ===`,
        connectedPlatforms.length
          ? `Connected platforms (${connectedPlatforms.length}): ${connectedPlatforms.join(', ')}`
          : 'No external platforms connected yet.',
        `Portfolio: ${allInvoices.length} invoices total | ${pendingInv.length} pending | ${formatHome(totalPendingSAR, 'SAR')} outstanding receivables`,
        totalOblSAR > 0
          ? `Monthly obligations: ${formatHome(totalOblSAR, 'SAR')} | Cash surplus/deficit: ${cashGap > 0 ? `DEFICIT ${formatHome(cashGap, 'SAR')} — LOAN LIKELY NEEDED` : 'Surplus — loan may not be urgent'}`
          : '',
        clientProfile?.clientNotes
          ? `Client personality / behaviour: ${clientProfile.clientNotes}`
          : '',
        clientProfile?.clientHistory
          ? `Client history: ${clientProfile.clientHistory}`
          : '',
        `=== END CONTEXT ===`,
      ].filter(Boolean).join('\n');

      // Inject Sentinel behavioral signals (trust scores from connected platforms)
      const behavioralBlock = buildBehavioralContextBlock();
      const fullContext = [contextLines, clientPortfolioBlock, behavioralBlock].filter(Boolean).join('\n\n');

      const existingNotes = invoice.notes ? `\n\n${invoice.notes}` : '';
      enrichedInvoice = { ...invoice, notes: fullContext + existingNotes };
    } catch { /* keep original invoice on any error */ }

    const result = await runSynergyPipeline(enrichedInvoice, {
      onProfilerStatus:   s => startTransition(() => setProfilerStatus(s)),
      onSentinelStatus:   s => startTransition(() => setSentinelStatus(s)),
      onNegotiatorStatus: s => startTransition(() => setNegotiatorStatus(s)),
      onTreasurerStatus:  s => startTransition(() => setTreasurerStatus(s)),
      onMasterStatus:     s => startTransition(() => setMasterStatus(s)),
      onAuditorStatus:    s => startTransition(() => setAuditorStatus(s)),
      onProfilerResult:   r => startTransition(() => setProfilerResult(r)),
      onSentinelResult:   r => startTransition(() => setSentinelResult(r)),
      onNegotiatorResult: r => startTransition(() => setNegotiatorResult(r)),
      onTreasurerResult:  r => startTransition(() => setTreasurerResult(r)),
      onMasterResult:     r => startTransition(() => setMasterReport(r)),
      onAuditorResult:    r => startTransition(() => setAuditorResult(r)),
      onAgentUsage: (agent, usage) => startTransition(() => {
        setAgentUsage(prev => ({ ...prev, [agent]: usage }));
        // Snap displayed token counter to the real API value when each agent finishes.
        if (agent === 'sentinel' || agent === 'negotiator' || agent === 'treasurer') {
          setAgentTokens(prev => ({ ...prev, [agent]: usage.totalTokens }));
        }
      }),
      onError: (agent, err) => startTransition(() => setErrors(prev => [...prev, `${agent}: ${err.message}`])),
    }, { language: waLang, homeCurrency: detectHomeCurrency() });
    if (result) {
      startTransition(() => setPipeline(result));
      // Save credit offer to localStorage for CreditPanelPage
      try {
        const invAmtSAR = result.invoice.currency === 'SAR'
          ? result.invoice.amount
          : result.sentinel.amount_in_usd * 3.75;
        // Composite score estimate for dynamic bridge cap
        const pipelineRisk = Math.min(result.treasurer.liquidity_score, 100);
        let compositeEst = pipelineRisk;
        try {
          const cs = JSON.parse(localStorage.getItem('synergy_connections_v4') || '{}') as Record<string, { status: string; monthlyRevenueSAR?: number }>;
          const cc = Object.values(cs).filter(v => v.status === 'connected').length;
          const revenueVerified = Object.values(cs).filter(v => v.status === 'connected' && (v.monthlyRevenueSAR ?? 0) > 0).length;
          const is2 = JSON.parse(localStorage.getItem('synergy_invoices_v1') || '[]') as Array<{ status: string; clientName: string }>;
          const ipaid = is2.length > 0 ? is2.filter(i => i.status === 'paid').length / is2.length : 0.5;
          const uc = new Set(is2.map(i => i.clientName.trim().toLowerCase())).size;
          const bonus = Math.min(20, uc * 5);
          const revBonus = Math.min(10, revenueVerified * 2);
          compositeEst = Math.min(100, Math.round(pipelineRisk * 0.4 + Math.min(100, Math.round(cc / 43 * 100)) * 0.25 + Math.round(ipaid * 100) * 0.25 + bonus + revBonus));
        } catch { /**/ }
        const maxBridge = compositeEst > 70 ? 300 : 200;
        const bridgeAmtSAR = Math.min(Math.round(invAmtSAR * 0.85), maxBridge);
        const offerRef = 'LB-' + result.meta.refId.slice(-4).toUpperCase();
        const offer = {
          offerRef,
          bankIdx: Math.abs(result.meta.refId.charCodeAt(0)) % 4,
          freelancerName: result.invoice.freelancerName,
          activeSince: 'Jan 2024',
          invoicesPaid: 18,
          invoiceRef: result.meta.refId.slice(-3),
          clientName: result.invoice.clientName,
          invoiceAmountSAR: Math.round(invAmtSAR),
          bridgeAmountSAR: bridgeAmtSAR,
          coveragePercent: 85,
          rateMonthly: 1.2,
          termDays: 45,
          repaymentRef: '#' + result.meta.refId.slice(-3),
          pendingSAR: Math.round(invAmtSAR),
          expectedSAR: Math.round(invAmtSAR * 0.95),
          defaultRisk: result.treasurer.estimated_default_probability,
          riskScore: Math.min(result.treasurer.liquidity_score, 100),
          paymentProb: result.sentinel.predicted_payment_probability,
          blockchainHash: result.treasurer.blockchain_hash,
          generatedAt: Date.now(),
          pipeline: result,  // full pipeline for PDF re-download
        };
        localStorage.setItem('synergy_credit_offer_v1', JSON.stringify(offer));
        // Log to activity log
        const actLog = JSON.parse(localStorage.getItem('synergy_activity_log_v1') || '[]') as unknown[];
        actLog.unshift({ type: 'pipeline_complete', label: 'AI Report Generated', detail: `Offer ${offerRef} · ${result.invoice.clientName} · ${result.invoice.currency} ${result.invoice.amount.toLocaleString()} · risk ${offer.riskScore}/100`, ref: offerRef, ts: Date.now() });
        actLog.unshift({ type: 'credit_offer_saved', label: 'Credit Offer Created', detail: `SAR ${bridgeAmtSAR} bridge · ${['Al-Rajhi Bank','Emirates NBD','Alinma Bank','Riyad Bank'][offer.bankIdx]} · 45 days · 1.2%/mo`, ref: offerRef, ts: Date.now() + 1, bankIdx: offer.bankIdx });
        // Behavioral trust signal summary entry
        try {
          const br = getBehavioralReport();
          if (br.signalCount > 0) {
            actLog.unshift({
              type: 'behavioral_signal',
              label: 'Behavioral Trust Signal',
              detail: `${br.signalCount} platforms verified · trust ${br.aggregateTrustScore}/100`,
              ref: offerRef,
              ts: Date.now() + 2,
            });
          }
        } catch { /**/ }
        localStorage.setItem('synergy_activity_log_v1', JSON.stringify((actLog as unknown[]).slice(0, 200)));
        // Notify other tabs/pages to refresh
        try { window.dispatchEvent(new Event('synergy:store-changed')); } catch { /**/ }
      } catch { /**/ }

      // ── Save to recent reports history ──
      try {
        // Transparent, deterministic score formula:
        //   score = 0.35 · paymentProbability
        //         + 0.30 · liquidityScore
        //         + 0.20 · invoiceAuthenticity
        //         + 0.15 · behavioralTrust
        //         − trustGradePenalty   (D=30, C=20, B=10, A=0)
        //   clamped to [0, 100]
        const gradePenalty: Record<'A'|'B'|'C'|'D', number> = { A: 0, B: 10, C: 20, D: 30 };
        const paymentProbability = Math.max(0, Math.min(100, result.sentinel.predicted_payment_probability));
        const liquidityScore     = Math.max(0, Math.min(100, result.treasurer.liquidity_score));
        const authenticity       = Math.max(0, Math.min(100, result.sentinel.invoice_authenticity_score));
        let behavioralTrust = 0; let redFlags = 0;
        try { const br = getBehavioralReport(); behavioralTrust = br.aggregateTrustScore; redFlags = br.redFlags.length; } catch { /**/ }
        const trustGradePenalty = gradePenalty[result.sentinel.client_trust_grade] ?? 0;
        const compositeScore = Math.max(0, Math.min(100, Math.round(
          0.35 * paymentProbability +
          0.30 * liquidityScore +
          0.20 * authenticity +
          0.15 * behavioralTrust -
          trustGradePenalty
        )));
        const conn = JSON.parse(localStorage.getItem('synergy_connections_v4') || '{}') as Record<string, { status: string }>;
        const invs = JSON.parse(localStorage.getItem('synergy_invoices_v1') || '[]') as unknown[];
        const saved: SavedReport = {
          id: 'rpt-' + Date.now(),
          createdAt: Date.now(),
          mode: isPortfolio ? 'portfolio' : 'single',
          clientName: result.invoice.clientName,
          amount: result.invoice.amount,
          currency: result.invoice.currency,
          score: compositeScore,
          scoreBreakdown: {
            paymentProbability,
            liquidityScore,
            authenticity,
            trustGradePenalty,
            behavioralTrust,
            formula: '0.35·Payment + 0.30·Liquidity + 0.20·Authenticity + 0.15·Behavioral − GradePenalty',
          },
          summary: (result.master.executive_summary || result.master.master_decision.reasoning || '').slice(0, 280),
          contextSnapshot: {
            connectionsCount: Object.values(conn).filter(v => v.status === 'connected').length,
            invoicesCount: invs.length,
            trustScore: behavioralTrust,
            redFlags,
          },
        };
        pushReport(saved);
        setSelectedReportId(saved.id);
        // ── Persist for the unified score engine so /connections + /credit see it ──
        persistLatestAiScore(compositeScore);
      } catch { /**/ }

      // ── Show CTA banner with explicit "Open Credit Panel" button (no auto-redirect) ──
      // Auto-navigation was removed by user request: control over routing must remain
      // with the user. We surface a sticky banner instead.
      try {
        setNavBanner('Report ready. Open the Credit Panel when you\u2019re ready.');
      } catch { /**/ }
    }
  }, [reset, navigate, waLang]);

  const isRunning = profilerStatus !== 'idle' || sentinelStatus !== 'idle' || negotiatorStatus !== 'idle' || treasurerStatus !== 'idle' || auditorStatus !== 'idle';

  /* ── Live agent telemetry: micro-state, token counter, rotating task ── */
  const [microStates, setMicroStates] = useState<Record<AgentKey, MicroState>>({
    profiler: 'idle', sentinel: 'idle', negotiator: 'idle', treasurer: 'idle', auditor: 'idle',
  });
  const [agentTokens, setAgentTokens] = useState<Record<AgentKey, number>>({
    profiler: 0, sentinel: 0, negotiator: 0, treasurer: 0, auditor: 0,
  });
  // Real token usage + latency from the API (set when each agent finishes).
  const [agentUsage, setAgentUsage] = useState<Partial<Record<'sentinel'|'negotiator'|'treasurer'|'master', { promptTokens: number; completionTokens: number; totalTokens: number; latencyMs: number }>>>({}); 
  const [agentTaskIdx, setAgentTaskIdx] = useState<Record<AgentKey, number>>({
    profiler: 0, sentinel: 0, negotiator: 0, treasurer: 0, auditor: 0,
  });

  // Drive each agent's micro-state from its real StepStatus.
  // 'loading' fans out into reading → thinking → streaming as time passes,
  // giving the operator a sense of an actual remote inference job.
  useEffect(() => {
    const advance = (key: AgentKey, status: StepStatus) => {
      if (status === 'loading') {
        setMicroStates(s => ({ ...s, [key]: 'reading' }));
        setAgentTokens(t => ({ ...t, [key]: 0 }));
        const t1 = setTimeout(() => setMicroStates(s => s[key] === 'reading' ? { ...s, [key]: 'thinking' } : s), 700);
        const t2 = setTimeout(() => setMicroStates(s => (s[key] === 'thinking' || s[key] === 'reading') ? { ...s, [key]: 'streaming' } : s), 2100);
        return () => { clearTimeout(t1); clearTimeout(t2); };
      }
      if (status === 'done')  setMicroStates(s => ({ ...s, [key]: 'done' }));
      if (status === 'error') setMicroStates(s => ({ ...s, [key]: 'error' }));
      if (status === 'idle')  {
        setMicroStates(s => ({ ...s, [key]: 'idle' }));
        setAgentTokens(t => ({ ...t, [key]: 0 }));
      }
      return undefined;
    };
    const c1 = advance('sentinel',   sentinelStatus);
    return c1;
  }, [sentinelStatus]);

  useEffect(() => {
    if (negotiatorStatus === 'loading') {
      setMicroStates(s => ({ ...s, negotiator: 'reading' }));
      setAgentTokens(t => ({ ...t, negotiator: 0 }));
      const t1 = setTimeout(() => setMicroStates(s => s.negotiator === 'reading' ? { ...s, negotiator: 'thinking' } : s), 700);
      const t2 = setTimeout(() => setMicroStates(s => (s.negotiator === 'thinking' || s.negotiator === 'reading') ? { ...s, negotiator: 'streaming' } : s), 2100);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (negotiatorStatus === 'done')  setMicroStates(s => ({ ...s, negotiator: 'done' }));
    if (negotiatorStatus === 'error') setMicroStates(s => ({ ...s, negotiator: 'error' }));
    if (negotiatorStatus === 'idle')  { setMicroStates(s => ({ ...s, negotiator: 'idle' })); setAgentTokens(t => ({ ...t, negotiator: 0 })); }
  }, [negotiatorStatus]);

  useEffect(() => {
    if (treasurerStatus === 'loading') {
      setMicroStates(s => ({ ...s, treasurer: 'reading' }));
      setAgentTokens(t => ({ ...t, treasurer: 0 }));
      const t1 = setTimeout(() => setMicroStates(s => s.treasurer === 'reading' ? { ...s, treasurer: 'thinking' } : s), 800);
      const t2 = setTimeout(() => setMicroStates(s => (s.treasurer === 'thinking' || s.treasurer === 'reading') ? { ...s, treasurer: 'streaming' } : s), 2400);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (treasurerStatus === 'done')  setMicroStates(s => ({ ...s, treasurer: 'done' }));
    if (treasurerStatus === 'error') setMicroStates(s => ({ ...s, treasurer: 'error' }));
    if (treasurerStatus === 'idle')  { setMicroStates(s => ({ ...s, treasurer: 'idle' })); setAgentTokens(t => ({ ...t, treasurer: 0 })); }
  }, [treasurerStatus]);

  useEffect(() => {
    if (profilerStatus === 'loading') {
      setMicroStates(s => ({ ...s, profiler: 'reading' }));
      setAgentTokens(t => ({ ...t, profiler: 0 }));
      const t1 = setTimeout(() => setMicroStates(s => s.profiler === 'reading' ? { ...s, profiler: 'thinking' } : s), 600);
      const t2 = setTimeout(() => setMicroStates(s => (s.profiler === 'thinking' || s.profiler === 'reading') ? { ...s, profiler: 'streaming' } : s), 1800);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (profilerStatus === 'done')  setMicroStates(s => ({ ...s, profiler: 'done' }));
    if (profilerStatus === 'error') setMicroStates(s => ({ ...s, profiler: 'error' }));
    if (profilerStatus === 'idle')  { setMicroStates(s => ({ ...s, profiler: 'idle' })); setAgentTokens(t => ({ ...t, profiler: 0 })); }
  }, [profilerStatus]);

  useEffect(() => {
    if (auditorStatus === 'loading') {
      setMicroStates(s => ({ ...s, auditor: 'reading' }));
      setAgentTokens(t => ({ ...t, auditor: 0 }));
      const t1 = setTimeout(() => setMicroStates(s => s.auditor === 'reading' ? { ...s, auditor: 'thinking' } : s), 700);
      const t2 = setTimeout(() => setMicroStates(s => (s.auditor === 'thinking' || s.auditor === 'reading') ? { ...s, auditor: 'streaming' } : s), 2000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (auditorStatus === 'done')  setMicroStates(s => ({ ...s, auditor: 'done' }));
    if (auditorStatus === 'error') setMicroStates(s => ({ ...s, auditor: 'error' }));
    if (auditorStatus === 'idle')  { setMicroStates(s => ({ ...s, auditor: 'idle' })); setAgentTokens(t => ({ ...t, auditor: 0 })); }
  }, [auditorStatus]);

  // Token counter: increments every 80–120ms with ±20% jitter while streaming.
  useEffect(() => {
    const anyActive = (Object.values(microStates) as MicroState[]).some(
      m => m === 'streaming' || m === 'thinking',
    );
    if (!anyActive) return;
    const interval = window.setInterval(() => {
      setAgentTokens(prev => {
        const next = { ...prev };
        (['profiler', 'sentinel', 'negotiator', 'treasurer', 'auditor'] as AgentKey[]).forEach(k => {
          const m = microStates[k];
          if (m === 'streaming') {
            // ~14 tokens base, ±20% jitter
            const inc = Math.round(14 * (0.8 + Math.random() * 0.4));
            next[k] = (prev[k] || 0) + inc;
          } else if (m === 'thinking') {
            const inc = Math.round(4 * (0.8 + Math.random() * 0.4));
            next[k] = (prev[k] || 0) + inc;
          }
        });
        return next;
      });
    }, 80 + Math.random() * 40);
    return () => window.clearInterval(interval);
  }, [microStates]);

  // Rotating task substring while agent is active.
  useEffect(() => {
    const anyActive = (Object.values(microStates) as MicroState[]).some(
      m => m === 'reading' || m === 'thinking' || m === 'streaming',
    );
    if (!anyActive) return;
    const interval = window.setInterval(() => {
      setAgentTaskIdx(prev => {
        const next = { ...prev };
        (['profiler', 'sentinel', 'negotiator', 'treasurer', 'auditor'] as AgentKey[]).forEach(k => {
          const m = microStates[k];
          if (m === 'reading' || m === 'thinking' || m === 'streaming') {
            next[k] = (prev[k] + 1) % AGENT_TASKS[k].length;
          }
        });
        return next;
      });
    }, 1700);
    return () => window.clearInterval(interval);
  }, [microStates]);

  const telemetrySummaries = useMemo<Record<AgentKey, string | undefined>>(() => ({
    profiler: profilerResult
      ? `${profilerResult.industry_sector} · geo risk ${profilerResult.geographic_risk_score} · trust index ${profilerResult.platform_trust_index}`
      : undefined,
    sentinel: sentinelResult
      ? `Trust score ${sentinelResult.predicted_payment_probability} · ${sentinelResult.red_flags.length} anomalies · grade ${sentinelResult.client_trust_grade}`
      : undefined,
    negotiator: negotiatorResult
      ? `Strategy ${negotiatorResult.escalation_tier} · ${negotiatorResult.suggested_discount_percentage}% discount · response ~${negotiatorResult.expected_response_time_hours}h`
      : undefined,
    treasurer: treasurerResult
      ? `Bridge ${formatHome(treasurerResult.recommended_advance_amount, treasurerResult.advance_currency || 'USD')} · ${treasurerResult.bank_recommendation.toUpperCase()} · grade ${treasurerResult.bank_risk_grade}`
      : undefined,
    auditor: auditorResult
      ? `Consistency ${auditorResult.consistency_score}% · validated: ${auditorResult.validation_passed ? 'YES' : 'NO'} · advance $${auditorResult.risk_adjusted_advance.toLocaleString()}`
      : undefined,
  }), [profilerResult, sentinelResult, negotiatorResult, treasurerResult, auditorResult]);

  /* ── Activity-log helper: archive a saved report and navigate to /activity ── */
  const logReportToActivity = useCallback((report: SavedReport) => {
    try {
      const actLog = JSON.parse(localStorage.getItem('synergy_activity_log_v1') || '[]') as unknown[];
      actLog.unshift({
        type: 'report_archived',
        label: 'Analysis Archived to Activity Log',
        detail: `${report.clientName} · ${report.mode} · score ${report.score}`,
        ref: report.id,
        timestamp: Date.now(),
      });
      localStorage.setItem('synergy_activity_log_v1', JSON.stringify((actLog as unknown[]).slice(0, 200)));
      window.dispatchEvent(new Event('synergy:store-changed'));
    } catch { /**/ }
    setTimeout(() => navigate(`/activity?highlight=${report.id}`), 400);
  }, [navigate]);

  /* ── Portfolio scan: synthesize a meta-invoice from ALL clients/connections ── */
  const runPortfolio = useCallback(() => {
    type InvEntry = { clientName: string; amount: number; currency: string; status: string; clientNotes?: string; clientHistory?: string };
    type ConnEntry = { status: string };
    type OblEntry = { amount: number; currency: string };
    let allInvoices: InvEntry[] = [];
    let connStore: Record<string, ConnEntry> = {};
    let obligations: OblEntry[] = [];
    try { allInvoices = JSON.parse(localStorage.getItem('synergy_invoices_v1') || '[]') as InvEntry[]; } catch { /**/ }
    try { connStore = JSON.parse(localStorage.getItem('synergy_connections_v4') || '{}') as Record<string, ConnEntry>; } catch { /**/ }
    try { obligations = JSON.parse(localStorage.getItem('synergy_obligations_v1') || '[]') as OblEntry[]; } catch { /**/ }

    const pending = allInvoices.filter(i => i.status !== 'paid');
    const paid    = allInvoices.filter(i => i.status === 'paid');
    const totalPendingSAR = pending.reduce((s, i) => s + toSARAmt(i.amount, i.currency), 0);
    const totalOblSAR     = obligations.reduce((s, o) => s + toSARAmt(o.amount, o.currency), 0);
    const cashGap = totalOblSAR - totalPendingSAR;

    const connectedPlatforms = Object.entries(connStore).filter(([, v]) => v.status === 'connected').map(([k]) => k);

    // Per-client mini-table
    const byClient: Record<string, { totalSAR: number; status: string; lastNote?: string }> = {};
    for (const i of allInvoices) {
      const k = i.clientName.trim() || 'Unknown';
      if (!byClient[k]) byClient[k] = { totalSAR: 0, status: i.status, lastNote: i.clientNotes };
      byClient[k].totalSAR += toSARAmt(i.amount, i.currency);
      if (i.clientNotes) byClient[k].lastNote = i.clientNotes;
    }
    const clientTable = Object.entries(byClient).slice(0, 12).map(([name, d]) =>
      `  • ${name} — ${formatHome(d.totalSAR, 'SAR')} · ${d.status}${d.lastNote ? ` · note: ${d.lastNote.slice(0, 60)}` : ''}`
    ).join('\n');

    let behavioralSummary = '';
    let topAnomalies: string[] = [];
    try {
      const br = getBehavioralReport();
      behavioralSummary = `Aggregate Trust Score: ${br.aggregateTrustScore}/100 across ${br.signalCount} platforms · ${br.topVerdict}`;
      topAnomalies = br.redFlags.slice(0, 3);
    } catch { /**/ }

    const notes = [
      `PORTFOLIO OVERVIEW`,
      `Clients: ${Object.keys(byClient).length} unique · Invoices: ${allInvoices.length} (paid ${paid.length}, pending ${pending.length})`,
      `Total outstanding receivables: ${formatHome(totalPendingSAR, 'SAR')}`,
      ``,
      `PER-CLIENT BREAKDOWN`,
      clientTable || '  (no invoices yet)',
      ``,
      `CONNECTED PLATFORMS (${connectedPlatforms.length})`,
      connectedPlatforms.length ? `  ${connectedPlatforms.join(', ')}` : '  none',
      ``,
      `BEHAVIORAL TRUST`,
      behavioralSummary || '  (no behavioral signals available)',
      topAnomalies.length ? `TOP ANOMALIES:\n${topAnomalies.map(a => `  ⚠ ${a}`).join('\n')}` : '',
      ``,
      `CASH POSITION`,
      `  Monthly obligations: ${formatHome(totalOblSAR, 'SAR')}`,
      `  Receivables: ${formatHome(totalPendingSAR, 'SAR')}`,
      `  Gap: ${cashGap > 0 ? `DEFICIT ${formatHome(cashGap, 'SAR')}` : `Surplus ${formatHome(-cashGap, 'SAR')}`}`,
    ].filter(Boolean).join('\n');

    const today = new Date().toISOString().slice(0, 10);
    const portfolioInvoice: InvoiceInput = {
      freelancerName: 'Portfolio Owner',
      clientName: PORTFOLIO_CLIENT_NAME,
      amount: Math.max(1, Math.round(totalPendingSAR)),
      currency: 'SAR',
      issueDate: today,
      dueDate: today,
      source: 'manual',
      description: 'Comprehensive portfolio analysis across all connected platforms and clients',
      notes,
    };
    void run(portfolioInvoice);
  }, [run]);

  /* ── Send a saved report as a real Email via Resend (api-server) ── */
  const sendReportToEmail = useCallback(async (report: SavedReport) => {
    // Build a branded HTML version of the report so the client receives a
    // proper underwriting summary (not a plain SMS-style line dump).
    const text =
      `Madar Risk Report\n` +
      `Client: ${report.clientName}\n` +
      `Mode: ${report.mode === 'portfolio' ? 'Portfolio Scan' : 'Single Invoice'}\n` +
      `Score: ${report.score}/100\n` +
      `Amount: ${report.amount.toLocaleString()} ${report.currency}\n` +
      `${report.summary}\n` +
      `Ref: ${report.id}`;
    const html = `
      <div style="font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif;max-width:620px;margin:0 auto;color:#0f172a">
        <div style="background:linear-gradient(135deg,#0f172a,#1e293b);color:#f8fafc;padding:22px 26px;border-radius:14px 14px 0 0">
          <div style="font-size:11px;letter-spacing:.18em;opacity:.7;text-transform:uppercase">Madar Underwriting</div>
          <div style="font-size:22px;font-weight:700;margin-top:4px">Risk Report · ${report.clientName}</div>
          <div style="font-size:12px;opacity:.7;margin-top:4px">Ref ${report.id} · ${report.mode === 'portfolio' ? 'Portfolio Scan' : 'Single Invoice'}</div>
        </div>
        <div style="background:#fff;padding:22px 26px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 14px 14px">
          <div style="display:flex;gap:10px;margin-bottom:16px">
            <div style="flex:1;padding:12px 14px;border:1px solid #e5e7eb;border-radius:10px;border-top:3px solid #0ea5e9">
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.1em">Score</div>
              <div style="font-size:20px;font-weight:700">${report.score}/100</div>
            </div>
            <div style="flex:1;padding:12px 14px;border:1px solid #e5e7eb;border-radius:10px;border-top:3px solid #059669">
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.1em">Amount</div>
              <div style="font-size:20px;font-weight:700">${report.amount.toLocaleString()} <span style="font-size:13px;color:#64748b">${report.currency}</span></div>
            </div>
          </div>
          <p style="font-size:13px;line-height:1.7;color:#334155;white-space:pre-wrap;margin:0">${(report.summary || '').replace(/</g, '&lt;')}</p>
          <div style="margin-top:20px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:#94a3b8">— Madar Underwriting Engine · automated message</div>
        </div>
      </div>`;

    // Resolve recipient email: invoice store → client store → BANK_EMAIL fallback
    let to = '';
    try {
      const invs = JSON.parse(localStorage.getItem('synergy_invoices_v1') || '[]') as Array<{ clientName?: string; clientEmail?: string }>;
      const hit  = invs.find(i => (i.clientName || '').toLowerCase() === report.clientName.toLowerCase() && i.clientEmail);
      if (hit?.clientEmail) to = hit.clientEmail;
    } catch { /**/ }
    if (!to) {
      try {
        const cls = JSON.parse(localStorage.getItem('synergy_clients_v1') || '[]') as Array<{ name?: string; email?: string }>;
        const hit = cls.find(c => (c.name || '').toLowerCase() === report.clientName.toLowerCase() && c.email);
        if (hit?.email) to = hit.email;
      } catch { /**/ }
    }
    if (!to) to = (import.meta.env.VITE_BANK_EMAIL as string | undefined) || '';
    if (!to || !/@/.test(to)) {
      setNavBanner('Email cancelled — no recipient on file');
      setTimeout(() => setNavBanner(null), 4000);
      return;
    }

    const r = await sendEmail({
      to,
      subject: `Madar Risk Report · ${report.clientName} · ${report.id}`,
      text,
      html,
    });
    try {
      const actLog = JSON.parse(localStorage.getItem('synergy_activity_log_v1') || '[]') as unknown[];
      actLog.unshift({
        type: r.sent ? 'email_sent' : 'email_failed',
        label: r.sent ? 'Report Emailed' : 'Email Send Failed',
        detail: r.sent
          ? `${report.clientName} · ${to}${r.redirected ? ' (redirected)' : ''} · score ${report.score}/100`
          : `${report.clientName} · ${to} · ${r.error || 'unknown error'}`,
        ref: report.id,
        ts: Date.now(),
      });
      localStorage.setItem('synergy_activity_log_v1', JSON.stringify((actLog as unknown[]).slice(0, 200)));
      window.dispatchEvent(new Event('synergy:store-changed'));
    } catch { /**/ }
    if (r.sent) setNavBanner(`Email sent ✓ to ${to}${r.redirected ? ' (redirected)' : ''}`);
    else setNavBanner(`Email failed: ${r.error || 'server error'}`);
    setTimeout(() => setNavBanner(null), 4000);
  }, []);

  // ── Recent reports list (live) ──
  const recentReports = useMemo<SavedReport[]>(() => {
    void storeTick;
    return loadReports().slice(0, 5);
  }, [storeTick]);
  const latestReport = recentReports[0] || null;

  /* ── Email the Negotiator's composed message to the client ── */
  const handleSendNegotiatorEmail = useCallback(async () => {
    if (!negotiatorResult) return;
    setSendingWa(true);
    setWaResult(null);
    const body   = waLang === 'ar' ? negotiatorResult.whatsapp_message_arabic : negotiatorResult.whatsapp_message_english;
    const filled = body.replace('[PAY_LINK]', `https://madar.app/pay/${pipeline?.meta.refId || 'demo'}`);
    const to     = currentInvoice?.clientEmail
      || (import.meta.env.VITE_BANK_EMAIL as string | undefined)
      || '';
    if (!to || !/@/.test(to)) {
      setSendingWa(false);
      setWaResult({ sent: false, simulated: false, error: 'No client email on file', to: '', body: '' });
      return;
    }
    const subject = `${currentInvoice?.clientName || 'Client'} · Madar Negotiator · ${pipeline?.meta.refId || 'demo'}`;
    const html = `
      <div style="font-family:ui-sans-serif,system-ui,Segoe UI,sans-serif;max-width:620px;margin:0 auto;color:#0f172a">
        <div style="background:linear-gradient(135deg,#059669,#047857);color:#fff;padding:18px 24px;border-radius:12px 12px 0 0">
          <div style="font-size:11px;letter-spacing:.16em;opacity:.8;text-transform:uppercase">Madar Negotiator</div>
          <div style="font-size:18px;font-weight:700;margin-top:4px">${currentInvoice?.clientName || 'Client'}</div>
        </div>
        <div style="background:#fff;padding:22px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;font-size:13px;line-height:1.75;color:#334155" dir="${waLang === 'ar' ? 'rtl' : 'ltr'}">
          <pre style="font-family:inherit;white-space:pre-wrap;margin:0">${filled.replace(/</g, '&lt;')}</pre>
          <div style="margin-top:20px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:#94a3b8">— Madar Underwriting Engine · Negotiator agent</div>
        </div>
      </div>`;
    const r = await sendEmail({ to, subject, text: filled, html });
    setWaResult({ sent: r.sent, simulated: r.simulated, error: r.error, to, body: filled });
    setSendingWa(false);
    try {
      const actLog = JSON.parse(localStorage.getItem('synergy_activity_log_v1') || '[]') as unknown[];
      actLog.unshift({ type: r.sent ? 'email_sent' : 'email_failed', label: 'Negotiator Email', detail: `To: ${currentInvoice?.clientName || 'Client'} · ${to} · ${r.sent ? 'delivered' : (r.error || 'failed')}`, ref: pipeline?.meta.refId || 'unknown', ts: Date.now() });
      localStorage.setItem('synergy_activity_log_v1', JSON.stringify((actLog as unknown[]).slice(0, 200)));
    } catch { /**/ }
  }, [negotiatorResult, currentInvoice, pipeline, waLang]);

  /* ── Send PDF Risk Report to Bank — blockchain-locked, AI-decided, auto-email ── */
  const handleSendBank = useCallback(async () => {
    if (!pipeline) return;

    // ── Phase 1: Blockchain Digital Lock — reject duplicate submissions ──
    const hash = pipeline.treasurer.blockchain_hash;
    if (isHashSubmitted(hash)) {
      const existing = getSubmittedHashes()[hash];
      setBankLockError(
        `Blocked: Report #${hash.slice(0, 8)} was already submitted to the bank on ` +
        `${new Date(existing.submittedAt).toLocaleString()}. ` +
        `Each analysis generates a unique cryptographic signature — re-submission is prevented by protocol.`
      );
      return;
    }

    setBankLockError(null);
    setSendingEmail(true);
    setEmailResult(null);
    setBankDecision(null);
    setApprovalEmailSent(false);

    const bankEmail = (import.meta.env.VITE_BANK_EMAIL as string | undefined) || 'bank@example.com';
    const s = pipeline.sentinel;
    const n = pipeline.negotiator;
    const t = pipeline.treasurer;
    const m = pipeline.master;
    const offerRef = 'LB-' + pipeline.meta.refId.slice(-4).toUpperCase();
    const bankIdx  = Math.abs(pipeline.meta.refId.charCodeAt(0)) % 4;
    const BANKS    = ['Al-Rajhi Bank', 'Emirates NBD', 'Alinma Bank', 'Riyad Bank'] as const;

    const emailBody = [
      `MADAR LIQUIDITY BRIDGE — RISK REPORT`,
      `==========================================`,
      ``,
      `Reference: ${pipeline.meta.refId}`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `─── INVOICE ───`,
      `Freelancer: ${pipeline.invoice.freelancerName}`,
      `Client: ${pipeline.invoice.clientName}`,
      `Amount: ${pipeline.invoice.amount.toLocaleString()} ${pipeline.invoice.currency} (~$${s.amount_in_usd.toLocaleString()} USD)`,
      `Due: ${pipeline.invoice.dueDate} | Days Overdue: ${s.days_overdue}`,
      ``,
      `─── SENTINEL (Risk Assessment) ───`,
      `Risk Level: ${s.payment_risk_level} (${s.payment_risk_score}/100)`,
      `Client Trust Grade: ${s.client_trust_grade}`,
      `Payment Probability: ${s.predicted_payment_probability}%`,
      `Collection Window: ${s.predicted_collection_window_days} days`,
      ``,
      `─── NEGOTIATOR (Collection Strategy) ───`,
      `Strategy: ${n.collection_strategy}`,
      `Discount Offered: ${n.suggested_discount_percentage}% → ${n.discounted_amount.toLocaleString()} ${pipeline.invoice.currency}`,
      `Escalation Tier: ${n.escalation_tier}`,
      `Expected Response: ${n.expected_response_time_hours}h`,
      ``,
      `─── TREASURER (Liquidity Bridge) ───`,
      `Eligible: ${t.liquidity_bridge_eligible ? 'YES' : 'NO'}`,
      `Advance: $${t.recommended_advance_amount.toLocaleString()} USD at ${t.advance_rate_percentage}% APR`,
      `Maturity: ${t.maturity_days} days`,
      `Total Repayment: $${t.total_repayment_amount.toLocaleString()} USD`,
      `Bank Risk Grade: ${t.bank_risk_grade}`,
      `Recommendation: ${t.bank_recommendation.toUpperCase()}`,
      ``,
      `─── BANK PITCH ───`,
      t.bank_pitch,
      ``,
      `─── MASTER VERDICT ───`,
      `Decision: ${m.master_decision.verdict}`,
      `Confidence: ${m.master_decision.confidence_score}%`,
      `Reasoning: ${m.master_decision.reasoning}`,
      ``,
      `─── BLOCKCHAIN PROVENANCE ───`,
      `SHA-256: ${hash}`,
      ``,
      `──────────────────────────────`,
      `Madar · Freelancer Liquidity Platform`,
    ].join('\n');

    // ── Send PDF to bank ──
    let r: EmailSendResult;
    try {
      const doc  = buildRiskReportPdf(pipeline);
      const b64  = pdfToBase64(doc);
      r = await sendEmail({
        to: bankEmail,
        subject: `[MADAR] Risk Report — ${pipeline.invoice.clientName} — ${offerRef}`,
        text: emailBody,
        attachments: [{ filename: `madar-risk-report-${pipeline.meta.refId}.pdf`, contentBase64: b64, mime: 'application/pdf' }],
      });
    } catch {
      r = await sendEmail({
        to: bankEmail,
        subject: `[MADAR] Risk Report — ${pipeline.invoice.clientName} — ${offerRef}`,
        text: emailBody,
      });
    }

    setEmailResult(r);
    setSendingEmail(false);

    if (!r.sent && !r.simulated) return; // hard failure — don't lock, allow retry

    // ── Phase 1 cont: Write blockchain lock ──
    const decision: BankDecision =
      t.bank_recommendation === 'approve'      ? 'approved'    :
      t.bank_recommendation === 'conditional'  ? 'conditional' : 'declined';

    writeSubmittedHash(hash, {
      offerRef,
      clientName: pipeline.invoice.clientName,
      submittedAt: Date.now(),
      decision,
    });

    // ── Phase 2: Instant AI Bank Decision — no human employee ──
    const reviewScore = Math.max(1, Math.min(100,
      Math.round(t.liquidity_score * 0.6 + s.predicted_payment_probability * 0.4)
    ));
    const decidedAt = Date.now();
    setBankDecision(decision);
    setBankDecisionAt(decidedAt);

    localStorage.setItem(BANK_REVIEW_STORE, JSON.stringify({
      offerRef, bankIdx,
      step: decision === 'approved' ? 'approved' : decision === 'conditional' ? 'pending' : 'declined',
      submittedAt: Date.now(),
      reviewedAt: decidedAt,
      decidedAt,
      decision,
      score: reviewScore,
      response: decision === 'approved'
        ? `Financing approved. SHA-256 ${hash.slice(0, 12)}… verified. Advance of $${t.recommended_advance_amount.toLocaleString()} USD at ${t.advance_rate_percentage}% APR confirmed.`
        : decision === 'conditional'
        ? 'Conditional approval pending co-signer confirmation or invoice insurance.'
        : 'Application declined: risk parameters exceed current cycle thresholds.',
      source: 'agent-room',
    }));

    // ── Phase 3: Auto-Approval Email — zero human clicks ──
    if (decision === 'approved' && pipeline.invoice.clientEmail) {
      const clientFirst = pipeline.invoice.clientName.split(' ')[0];
      const decidedAtStr = new Date(decidedAt).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
      const approvalHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Bridge Approved</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:36px 12px">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(2,6,23,0.12);max-width:600px">

    <!-- Brand bar -->
    <tr><td style="background:linear-gradient(135deg,#0b1220 0%,#1e293b 100%);padding:18px 32px">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="color:#ffffff;font-size:13px;font-weight:800;letter-spacing:2px">MADAR · AI</td>
        <td align="right" style="color:#94a3b8;font-size:11px;letter-spacing:1.5px;font-weight:600">LIQUIDITY BRIDGE</td>
      </tr></table>
    </td></tr>

    <!-- Hero -->
    <tr><td style="background:linear-gradient(135deg,#059669 0%,#10b981 60%,#34d399 100%);padding:44px 32px;text-align:center;color:#ffffff">
      <div style="display:inline-block;background:rgba(255,255,255,0.18);padding:6px 14px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:2px;margin-bottom:18px">✓ AUTOMATICALLY APPROVED</div>
      <div style="font-size:14px;opacity:0.85;margin-bottom:8px">Advance amount</div>
      <div style="font-size:52px;font-weight:900;line-height:1;letter-spacing:-1px">$${t.recommended_advance_amount.toLocaleString()}</div>
      <div style="font-size:14px;font-weight:600;opacity:0.9;margin-top:6px">USD · ${t.advance_rate_percentage}% APR · ${t.maturity_days}d</div>
    </td></tr>

    <!-- Body -->
    <tr><td style="padding:32px 36px">
      <p style="font-size:16px;line-height:1.6;color:#0f172a;margin:0 0 8px"><strong>Dear ${clientFirst},</strong></p>
      <p style="font-size:14px;line-height:1.7;color:#475569;margin:0 0 22px">
        Your Liquidity Bridge application has been <strong style="color:#059669">underwritten autonomously</strong> by our tri-agent AI engine — DeepSeek R1 (risk), Gemini 3.1 Pro (collection), and Claude Opus 4.6 (treasury). The decision was sealed on-chain in under three seconds. <em>No human review.</em>
      </p>

      <!-- Metric grid (4-col on desktop, stacks on mobile) -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:8px;margin:0 -8px 22px">
        ${[
          ['REFERENCE',  offerRef,                                                 '#3b82f6'],
          ['BANK',       BANKS[bankIdx].split(' ').slice(0, 2).join(' '),          '#0f172a'],
          ['GRADE',      t.bank_risk_grade,                                         '#ca8a04'],
          ['REPAYMENT',  '$' + t.total_repayment_amount.toLocaleString(),          '#059669'],
        ].map(([l, v, c]) =>
          `<td width="25%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px;text-align:center;vertical-align:top">
             <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;color:#64748b;margin-bottom:4px">${l}</div>
             <div style="font-size:14px;font-weight:900;color:${c};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v}</div>
           </td>`
        ).join('')}
      </table>

      ${t.conditions.length ? `
        <div style="background:#fffbeb;border-left:3px solid #f59e0b;border-radius:8px;padding:14px 16px;margin-bottom:20px">
          <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#b45309;margin-bottom:6px">CONDITIONS</div>
          <ul style="margin:0;padding-left:18px;font-size:13px;color:#78350f;line-height:1.6">${t.conditions.map(c => `<li style="margin-bottom:3px">${c}</li>`).join('')}</ul>
        </div>` : ''}

      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 18px;margin-bottom:24px">
        <div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:#15803d;margin-bottom:6px">UNDERWRITER PITCH</div>
        <div style="font-size:13.5px;line-height:1.65;color:#166534">${t.bank_pitch}</div>
      </div>

      <!-- CTA -->
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:8px auto 6px"><tr>
        <td style="background:linear-gradient(135deg,#059669,#10b981);border-radius:14px;box-shadow:0 12px 28px rgba(5,150,105,0.32)">
          <a href="#" style="display:inline-block;padding:16px 38px;color:#ffffff;text-decoration:none;font-weight:900;font-size:14px;letter-spacing:0.5px">Accept Financing Offer  →</a>
        </td>
      </tr></table>
      <p style="text-align:center;font-size:11px;color:#94a3b8;margin:8px 0 0">Funds settle to your operating wallet within 4 business hours of acceptance.</p>
    </td></tr>

    <!-- Cryptographic footer -->
    <tr><td style="background:#0b1220;padding:22px 36px;color:#cbd5e1">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:top">
          <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;color:#64748b;margin-bottom:6px">⛓  TAMPER-PROOF AUDIT SEAL</div>
          <div style="font-family:'SF Mono',Consolas,monospace;font-size:10.5px;color:#a78bfa;word-break:break-all;line-height:1.5">${hash}</div>
          <div style="font-size:10.5px;color:#64748b;margin-top:8px">${decidedAtStr}  ·  AI-underwritten  ·  No human review</div>
        </td>
      </tr></table>
    </td></tr>

    <!-- Disclaimer -->
    <tr><td style="background:#0a0f1d;padding:14px 36px;font-size:10px;color:#475569;text-align:center;border-top:1px solid #1e293b">
      Madar · Autonomous Liquidity Bridge · Resubmission of identical invoices is blocked by SHA-256 deduplication.
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;

      sendEmail({
        to: pipeline.invoice.clientEmail,
        subject: `✓ Bridge Approved · $${t.recommended_advance_amount.toLocaleString()} USD · ${offerRef}`,
        text:
          `Dear ${clientFirst},\n\n` +
          `Your Liquidity Bridge has been autonomously approved by Madar.\n\n` +
          `Advance:        $${t.recommended_advance_amount.toLocaleString()} USD\n` +
          `Rate:           ${t.advance_rate_percentage}% APR\n` +
          `Maturity:       ${t.maturity_days} days\n` +
          `Total Repay:    $${t.total_repayment_amount.toLocaleString()} USD\n` +
          `Bank Grade:     ${t.bank_risk_grade}\n` +
          `Reference:      ${offerRef}\n\n` +
          `SHA-256 seal:   ${hash}\n` +
          `Decided at:     ${decidedAtStr}\n` +
          `Tri-agent consensus: DeepSeek R1 · Gemini 3.1 Pro · Claude Opus 4.6\n\n` +
          `— Madar · Autonomous Liquidity Bridge`,
        html: approvalHtml,
      }).then(er => {
        if (er.sent || er.simulated) setApprovalEmailSent(true);
      }).catch(() => { /* silent */ });
    }

    // ── Activity log ──
    try {
      const actLog = JSON.parse(localStorage.getItem('synergy_activity_log_v1') || '[]') as unknown[];
      actLog.unshift({
        type: 'bank_report_sent',
        label: 'Report Sent to Bank',
        detail: `${BANKS[bankIdx]} · SHA-256 locked · Decision: ${decision.toUpperCase()}`,
        ref: offerRef,
        ts: Date.now(),
        bankIdx,
      });
      if (decision === 'approved') {
        actLog.unshift({
          type: 'auto_approval_sent',
          label: 'Auto-Approval Email Sent',
          detail: `${pipeline.invoice.clientName} · $${t.recommended_advance_amount.toLocaleString()} USD · ${t.advance_rate_percentage}% APR`,
          ref: offerRef,
          ts: Date.now(),
        });
      }
      localStorage.setItem('synergy_activity_log_v1', JSON.stringify((actLog as unknown[]).slice(0, 200)));
    } catch { /**/ }
  }, [pipeline]);

  /* ── Download PDF ── */
  const handleDownload = useCallback(() => {
    if (!pipeline) return;
    const doc = buildRiskReportPdf(pipeline);
    doc.save(`madar-risk-report-${pipeline.meta.refId}.pdf`);
  }, [pipeline]);

  /* ── Charts data ── */
  const radarData = useMemo(() =>
    masterReport?.safety_metrics.map(m => ({ metric: m.metric, value: m.value, fullMark: m.max_value })) || [],
  [masterReport]);

  const cashTimeline = useMemo(() =>
    masterReport?.cash_timeline.map(p => ({ day: `+${p.day}d`, expected: p.expected_cash, cumulative: p.cumulative })) || [],
  [masterReport]);

  const donutData = useMemo(() => pipeline ? [
    { name: 'Risk',          value: 100 - pipeline.sentinel.payment_risk_score, fill: '#2563eb' },
    { name: 'Trust',         value: pipeline.sentinel.predicted_payment_probability, fill: '#059669' },
    { name: 'Liquidity',     value: pipeline.treasurer.liquidity_score, fill: '#d97706' },
    { name: 'Confidence',    value: masterReport?.master_decision.confidence_score || 0, fill: '#7c3aed' },
  ] : [], [pipeline, masterReport]);

  return (
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0">
        <header className="flex items-center justify-between px-6 h-14 border-b shrink-0" style={{ borderColor: BORDER, background: CARD }}>
          <div className="flex items-center gap-3">
            <p className="text-sm font-bold" style={{ color: TEXT }}>Agent Room</p>
            {currentInvoice && (
              <>
                <ChevronRight size={12} style={{ color: TEXT3 }} />
                <p className="text-sm" style={{ color: TEXT2 }}>{currentInvoice.clientName} · {currentInvoice.amount.toLocaleString()} {currentInvoice.currency}</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {pipeline && (
              <button onClick={handleDownload}
                className="h-9 px-4 rounded-xl border text-[12px] font-bold transition-all flex items-center gap-1.5 cursor-pointer hover:bg-gray-50"
                style={{ borderColor: BORDER, color: TEXT2 }}>
                <Download size={14} />Export PDF
              </button>
            )}
            {pipeline && latestReport && (
              <button onClick={() => sendReportToEmail(latestReport)}
                className="h-9 px-4 rounded-xl text-white text-[12px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                style={{ background: '#0ea5e9' }}>
                <MailIcon size={14} />Email Report
              </button>
            )}
            {pipeline && (
              <button onClick={() => navigate('/credit')}
                className="h-9 px-4 rounded-xl text-white text-[12px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                style={{ background: '#059669' }}>
                <CreditCard size={14} />View Credit Offer<ChevronRight size={12} />
              </button>
            )}
            <button onClick={runPortfolio} disabled={isRunning}
              className="h-9 px-4 rounded-xl text-white text-[12px] font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              style={{ background: '#7c3aed' }}>
              <Sparkles size={14} />Analyze All Clients
            </button>
            <button onClick={() => setShowClientPicker(true)} disabled={isRunning}
              className="h-9 px-4 rounded-xl text-white text-[12px] font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              style={{ background: '#2563eb' }}>
              <Users size={14} />Pick a Client
            </button>
            <button onClick={() => setShowNew(true)}
              className="h-9 px-3 rounded-xl border text-[12px] font-bold hover:bg-gray-50 transition-all flex items-center gap-1.5 cursor-pointer"
              style={{ borderColor: BORDER, color: TEXT2 }}>
              <Plus size={13} strokeWidth={2.5} />New Invoice
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">

            {/* Madar Score — gates all pipeline runs (must be ≥ 70) */}
            <UnifiedScoreCard hideCta lang={waLang}/>

            {/* ── Auto-nav banner ── */}
            <AnimatePresence>
              {navBanner && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="rounded-xl border px-4 py-3 flex items-center gap-3"
                  style={{ borderColor: '#a7f3d0', background: '#ecfdf5', color: '#065f46' }}
                >
                  <CheckCircle2 size={16} />
                  <p className="text-[12px] font-bold flex-1">{navBanner}</p>
                  {latestReport && (
                    <button onClick={() => sendReportToEmail(latestReport)}
                      className="h-8 px-3 rounded-lg bg-blue-600 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer hover:bg-blue-500">
                      <MailIcon size={12} />Email Latest
                    </button>
                  )}
                  {latestReport && (
                    <button onClick={() => logReportToActivity(latestReport)}
                      className="h-8 px-3 rounded-lg text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer hover:opacity-90"
                      style={{ background: '#0891b2' }}>
                      <Activity size={12} />Log to Activity
                    </button>
                  )}
                  <button onClick={() => { setNavBanner(null); navigate('/credit'); }}
                    className="h-8 px-3 rounded-lg border text-[11px] font-bold cursor-pointer flex items-center gap-1.5"
                    style={{ borderColor: '#a7f3d0', color: '#065f46' }}>
                    Open now <ChevronRight size={12} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Per-invoice mode header (single-client focused analysis) ── */}
            {currentInvoice && currentInvoice.clientName !== PORTFOLIO_CLIENT_NAME && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border px-4 py-3 flex items-center gap-3"
                style={{ borderColor: '#bfdbfe', background: '#eef4ff' }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#fff' }}>
                  <Target size={16} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Single-Invoice Mode</p>
                  <p className="text-[13px] font-bold truncate" style={{ color: TEXT }}>
                    Focused analysis for: <span className="font-black">{currentInvoice.clientName}</span>
                  </p>
                </div>
                <button
                  onClick={() => { reset(); setCurrentInvoice(null); runPortfolio(); }}
                  disabled={isRunning}
                  className="h-8 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer hover:bg-white/60 disabled:opacity-50"
                  style={{ color: '#2563eb' }}
                >
                  <Sparkles size={11} />
                  Switch to Portfolio mode
                </button>
              </motion.div>
            )}

            {/* Empty State */}
            {!isRunning && !pipeline && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center min-h-[65vh] text-center">
                <div className="mb-6"><GeneratingLoader /></div>
                <h2 className="text-xl font-black mb-2" style={{ color: TEXT }}>Turn unpaid invoices into immediate liquidity</h2>
                <p className="text-sm max-w-md mb-6 leading-relaxed" style={{ color: TEXT3 }}>
                  Three specialized AI agents — Sentinel · Negotiator · Treasurer — work in parallel
                  to score risk, draft outreach, and underwrite a bank-ready advance.
                </p>
                <div className="flex gap-3 mb-8">
                  {(Object.entries(AGENTS) as [keyof typeof AGENTS, typeof AGENTS[keyof typeof AGENTS]][]).map(([k, a]) => {
                    const Ic = a.icon;
                    return (
                      <div key={k} className="flex items-center gap-2 px-3 py-1.5 rounded-full border" style={{ borderColor: BORDER, background: a.bg }}>
                        <Ic size={12} style={{ color: a.color }} />
                        <span className="text-[11px] font-bold tracking-tight" style={{ color: a.color }}>{a.name}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mb-3">
                  <button onClick={runPortfolio}
                    className="px-7 py-3 rounded-xl text-white text-sm font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    style={{ background: '#7c3aed' }}>
                    <Sparkles size={16} />Analyze All Clients
                  </button>
                  <button onClick={() => setShowClientPicker(true)}
                    className="px-7 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-all flex items-center justify-center gap-2 cursor-pointer">
                    <Users size={16} />Pick a Specific Client
                  </button>
                </div>
                <button onClick={() => setShowNew(true)}
                  className="text-[12px] font-semibold underline-offset-4 hover:underline cursor-pointer"
                  style={{ color: TEXT3 }}>
                  or enter a new invoice manually →
                </button>
              </motion.div>
            )}

            {/* Pipeline progress — Live Agent Telemetry (removed per user request) */}

            {/* Agent Cards — Profiler card hidden per user request (pipeline still runs it) */}
            {(isRunning || pipeline) && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <AgentCard
                  agentKey="sentinel" modelLabel={MODEL_LABELS.sentinel} status={sentinelStatus}
                  summary={sentinelResult?.summary || ''}
                  details={sentinelResult ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
                      <DataRow label="Risk Level" value={sentinelResult.payment_risk_level} icon={AlertTriangle} />
                      <DataRow label="Risk Score" value={`${sentinelResult.payment_risk_score}/100`} icon={Target} />
                      <DataRow label="Days Overdue" value={sentinelResult.days_overdue} icon={Clock} />
                      <DataRow label="Trust Grade" value={sentinelResult.client_trust_grade} icon={ShieldCheck} />
                      <DataRow label="Pay Probability" value={`${sentinelResult.predicted_payment_probability}%`} icon={Activity} />
                      <DataRow label="Collection Window" value={`${sentinelResult.predicted_collection_window_days}d`} icon={Timer} />
                      <DataRow label="Authenticity" value={`${sentinelResult.invoice_authenticity_score}/100`} icon={FileCheck} />
                      <DataRow label={`Value (${detectHomeCurrency()})`} value={formatHome(sentinelResult.amount_in_usd, 'USD')} icon={Coins} />
                      {sentinelResult.red_flags.length > 0 && (
                        <div className="pt-3 mt-2 border-t" style={{ borderColor: `${BORDER}80` }}>
                          <p className="text-[10px] font-semibold mb-2 flex items-center gap-1" style={{ color: TEXT3 }}>
                            <AlertTriangle size={10} /> Red Flags
                          </p>
                          {sentinelResult.red_flags.map((f, i) => (
                            <p key={i} className="text-[11px] py-0.5 pl-3 border-l-2 border-red-200 ml-1" style={{ color: TEXT2 }}>{f}</p>
                          ))}
                        </div>
                      )}
                      {sentinelResult.positive_signals.length > 0 && (
                        <div className="pt-3 mt-2 border-t" style={{ borderColor: `${BORDER}80` }}>
                          <p className="text-[10px] font-semibold mb-2 flex items-center gap-1" style={{ color: TEXT3 }}>
                            <Sparkles size={10} /> Positive Signals
                          </p>
                          {sentinelResult.positive_signals.map((f, i) => (
                            <p key={i} className="text-[11px] py-0.5 pl-3 border-l-2 border-emerald-200 ml-1" style={{ color: TEXT2 }}>{f}</p>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ) : null}
                />

                <AgentCard
                  agentKey="negotiator" modelLabel={MODEL_LABELS.negotiator} status={negotiatorStatus}
                  summary={negotiatorResult?.summary || ''}
                  details={negotiatorResult ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
                      <DataRow label="Strategy" value={negotiatorResult.escalation_tier} icon={Target} />
                      <DataRow label="Discount" value={`${negotiatorResult.suggested_discount_percentage}%`} icon={TrendingUp} />
                      <DataRow label="Discounted Amt" value={pipeline ? formatHome(negotiatorResult.discounted_amount, pipeline.invoice.currency) : negotiatorResult.discounted_amount.toLocaleString()} icon={Banknote} />
                      <DataRow label="Resp. Window" value={`${negotiatorResult.expected_response_time_hours}h`} icon={Timer} />
                      <div className="pt-3 mt-2 border-t" style={{ borderColor: `${BORDER}80` }}>
                        <p className="text-[10px] font-semibold mb-2 flex items-center gap-1" style={{ color: TEXT3 }}>
                          <Calendar size={10} /> Reminder cadence
                        </p>
                        {negotiatorResult.reminder_cadence.map((r, i) => (
                          <p key={i} className="text-[11px] py-0.5 pl-3 border-l-2 border-emerald-200 ml-1" style={{ color: TEXT2 }}>{r}</p>
                        ))}
                      </div>
                      {negotiatorResult.negotiation_arguments.length > 0 && (
                        <div className="pt-3 mt-2 border-t" style={{ borderColor: `${BORDER}80` }}>
                          <p className="text-[10px] font-semibold mb-2 flex items-center gap-1" style={{ color: TEXT3 }}>
                            <Eye size={10} /> Arguments
                          </p>
                          {negotiatorResult.negotiation_arguments.map((a, i) => (
                            <p key={i} className="text-[11px] py-0.5 pl-3 border-l-2 border-emerald-200 ml-1" style={{ color: TEXT2 }}>{a}</p>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ) : null}
                />

                <AgentCard
                  agentKey="treasurer" modelLabel={MODEL_LABELS.treasurer} status={treasurerStatus}
                  summary={treasurerResult?.summary || ''}
                  details={treasurerResult ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
                      <DataRow label="Eligible" value={treasurerResult.liquidity_bridge_eligible ? 'YES' : 'NO'} icon={ShieldCheck} />
                      <DataRow label="Advance" value={formatHome(treasurerResult.recommended_advance_amount, treasurerResult.advance_currency || 'USD')} icon={Wallet} />
                      <DataRow label="APR" value={`${treasurerResult.advance_rate_percentage}%`} icon={TrendingUp} />
                      <DataRow label="Maturity" value={`${treasurerResult.maturity_days}d`} icon={Timer} />
                      <DataRow label="Repay" value={formatHome(treasurerResult.total_repayment_amount, treasurerResult.advance_currency || 'USD')} icon={Banknote} />
                      <DataRow label="Bank Grade" value={treasurerResult.bank_risk_grade} icon={Building2} />
                      <DataRow label="Recommendation" value={treasurerResult.bank_recommendation.toUpperCase()} icon={BadgeIcon} />
                      <DataRow label="Default Prob." value={`${treasurerResult.estimated_default_probability}%`} icon={AlertTriangle} />
                      <DataRow label="Liquidity" value={`${treasurerResult.liquidity_score}/100`} icon={Coins} />
                      {treasurerResult.conditions.length > 0 && (
                        <div className="pt-3 mt-2 border-t" style={{ borderColor: `${BORDER}80` }}>
                          <p className="text-[10px] font-semibold mb-2 flex items-center gap-1" style={{ color: TEXT3 }}>
                            <FileText size={10} /> Bank conditions
                          </p>
                          {treasurerResult.conditions.map((c, i) => (
                            <p key={i} className="text-[11px] py-0.5 pl-3 border-l-2 border-amber-200 ml-1" style={{ color: TEXT2 }}>{c}</p>
                          ))}
                        </div>
                      )}
                      <div className="pt-3 mt-2 border-t" style={{ borderColor: `${BORDER}80` }}>
                        <p className="text-[10px] font-semibold mb-1 flex items-center gap-1" style={{ color: TEXT3 }}>
                          <Hash size={10} /> SHA-256 Provenance
                        </p>
                        <p className="text-[9px] font-mono break-all" style={{ color: TEXT2 }}>{treasurerResult.blockchain_hash}</p>
                      </div>
                    </motion.div>
                  ) : null}
                />
              </div>
            )}

            {/* Auditor Sub-Agent Card */}
            {(auditorStatus !== 'idle' || auditorResult) && (
              <AgentCard
                agentKey="auditor" modelLabel={MODEL_LABELS.auditor} status={auditorStatus}
                summary={auditorResult?.executive_flash || ''}
                details={auditorResult ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
                    <DataRow label="Consistency" value={`${auditorResult.consistency_score}%`} icon={CheckCircle2} />
                    <DataRow label="Confidence" value={`${auditorResult.confidence_lower}–${auditorResult.confidence_base}–${auditorResult.confidence_upper}`} icon={Gauge} />
                    <DataRow label="Adj. Advance" value={`$${auditorResult.risk_adjusted_advance.toLocaleString()}`} icon={Banknote} />
                    <DataRow label="Validated" value={auditorResult.validation_passed ? 'PASS ✓' : 'FAIL ✗'} icon={BadgeIcon} />
                    {auditorResult.contradictions_found.length > 0 && (
                      <div className="pt-3 mt-2 border-t" style={{ borderColor: `${BORDER}80` }}>
                        <p className="text-[10px] font-semibold mb-2" style={{ color: TEXT3 }}>Contradictions</p>
                        {auditorResult.contradictions_found.map((c, i) => (
                          <p key={i} className="text-[11px] py-0.5 pl-3 border-l-2 border-amber-200 ml-1" style={{ color: TEXT2 }}>{c}</p>
                        ))}
                      </div>
                    )}
                    {auditorResult.action_matrix.length > 0 && (
                      <div className="pt-3 mt-2 border-t" style={{ borderColor: `${BORDER}80` }}>
                        <p className="text-[10px] font-semibold mb-2" style={{ color: TEXT3 }}>Action Matrix</p>
                        {auditorResult.action_matrix.map((a, i) => (
                          <div key={i} className="text-[11px] py-1 pl-3 border-l-2 border-sky-200 ml-1" style={{ color: TEXT2 }}>
                            <span className="font-bold">{a.owner}</span> · {a.action} · <span style={{ color: TEXT3 }}>{a.deadline}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="pt-3 mt-2 border-t" style={{ borderColor: `${BORDER}80` }}>
                      <p className="text-[10px] font-semibold mb-1" style={{ color: TEXT3 }}>Bank Recommendation Letter</p>
                      <p className="text-[11px] leading-relaxed italic" style={{ color: TEXT2 }}>{auditorResult.recommendation_letter}</p>
                    </div>
                  </motion.div>
                ) : null}
              />
            )}

            {/* Errors */}
            {errors.length > 0 && (
              <div className="p-4 rounded-xl border border-red-200 bg-red-50">
                {errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <AlertTriangle size={12} className="text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-600">{err}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Master Loading */}
            {masterStatus === 'loading' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-4 p-5 rounded-2xl border" style={{ borderColor: BORDER, background: CARD }}>
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Loader2 size={18} className="text-purple-600 animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: TEXT }}>Master Synthesizer</p>
                  <p className="text-[11px]" style={{ color: TEXT3 }}>Claude Opus 4.6 is unifying all three agents...</p>
                </div>
              </motion.div>
            )}

            {/* Dashboard */}
            {pipeline && masterReport && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

                {/* Verdict banner */}
                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER, background: CARD }}>
                  <div className="h-1" style={{ background: '#7c3aed' }} />
                  <div className="p-6 flex items-start gap-5">
                    <div className="w-14 h-14 rounded-2xl border border-purple-100 flex items-center justify-center shrink-0" style={{ background: '#f5f3ff' }}>
                      <Brain size={26} className="text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                          <p className="text-[11px] font-medium mb-1" style={{ color: TEXT3 }}>Final Verdict — Claude Opus 4.6</p>
                          <p className="text-xl font-black" style={{ color: TEXT }}>{masterReport.master_decision.verdict}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <VoiceListenButton
                            text={`Final verdict from the Master agent. ${masterReport.master_decision.verdict}. Confidence ${masterReport.master_decision.confidence_score} percent. ${masterReport.master_decision.reasoning}`}
                            label="Hear verdict"
                          />
                          <div className="text-center px-5 py-2 rounded-xl bg-purple-50 border border-purple-100">
                            <p className="text-[9px] uppercase tracking-wider" style={{ color: TEXT3 }}>Confidence</p>
                            <p className="text-2xl font-black text-purple-600 font-mono">{masterReport.master_decision.confidence_score}<span className="text-sm text-purple-400">%</span></p>
                          </div>
                        </div>
                      </div>
                      <p className="text-[13px] leading-[1.8] mt-3" style={{ color: TEXT2 }}>{masterReport.master_decision.reasoning}</p>
                    </div>
                  </div>
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPI label={`Invoice Value (${detectHomeCurrency()})`} value={formatHome(pipeline.sentinel.amount_in_usd, 'USD')} icon={Coins} delay={0} />
                  <KPI label="Recommended Advance" value={formatHome(pipeline.treasurer.recommended_advance_amount, pipeline.treasurer.advance_currency || 'USD')} icon={Wallet} sub={`@ ${pipeline.treasurer.advance_rate_percentage}% APR`} color="#d97706" delay={0.05} />
                  <KPI label="Liquidity Score" value={`${pipeline.treasurer.liquidity_score}/100`} icon={TrendingUp} trend={pipeline.treasurer.bank_recommendation} color="#059669" delay={0.1} />
                  <KPI label="Days to Cash" value={`${pipeline.sentinel.predicted_collection_window_days}d`} icon={Timer} sub={`Maturity ${pipeline.treasurer.maturity_days}d`} delay={0.15} />
                </div>

                {/* Charts row 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <Section title="Cross-Agent Safety Radar" icon={Gauge}>
                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart data={radarData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
                        <PolarGrid stroke="#e7e5e4" />
                        <PolarAngleAxis dataKey="metric" tick={{ fill: TEXT2, fontSize: 10 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: TEXT3, fontSize: 9 }} />
                        <Radar name="Score" dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.12} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </Section>

                  <Section title="Health Distribution" icon={Target}>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={donutData} cx="50%" cy="50%" innerRadius={48} outerRadius={78}
                          paddingAngle={4} dataKey="value" strokeWidth={0}>
                          {donutData.map((entry, idx) => (<Cell key={idx} fill={entry.fill} />))}
                        </Pie>
                        <Tooltip contentStyle={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </Section>
                </div>

                {/* Cash timeline */}
                <Section title="30-Day Cash Inflow Forecast (USD)" icon={Activity}>
                  <ResponsiveContainer width="100%" height={210}>
                    <AreaChart data={cashTimeline} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                      <XAxis dataKey="day" tick={{ fill: TEXT2, fontSize: 10 }} />
                      <YAxis tick={{ fill: TEXT3, fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="cumulative" name="Cumulative cash" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} strokeWidth={2.5} />
                      <Area type="monotone" dataKey="expected" name="Day inflow" stroke="#059669" fill="#059669" fillOpacity={0.08} strokeWidth={1.8} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Section>

                {/* Reminder bars */}
                <Section title="Safety Metrics by Agent" icon={BarChart3}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={masterReport.safety_metrics.map(m => ({ metric: m.metric, score: m.value }))} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                      <XAxis dataKey="metric" tick={{ fill: TEXT2, fontSize: 9 }} />
                      <YAxis tick={{ fill: TEXT3, fontSize: 10 }} domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12 }} />
                      <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                        {masterReport.safety_metrics.map((m, i) => (
                          <Cell key={i} fill={m.status === 'safe' ? '#059669' : m.status === 'warning' ? '#d97706' : '#dc2626'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Section>

                {/* Cross verification */}
                <Section title="Cross-Verification Matrix" icon={Eye}>
                  <div className="flex items-center justify-between mb-4">
                    <div />
                    <span className="text-sm font-black font-mono px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                      {masterReport.cross_verification.consensus_level}% Consensus
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-[11px] font-semibold mb-3 flex items-center gap-1.5 text-emerald-700">
                        <CheckCircle2 size={11} /> Agreements
                      </p>
                      <div className="space-y-2">
                        {masterReport.cross_verification.agreements.map((a, i) => (
                          <p key={i} className="text-[12px] pl-3 border-l-2 border-emerald-200" style={{ color: TEXT2 }}>{a}</p>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold mb-3 flex items-center gap-1.5 text-amber-700">
                        <AlertTriangle size={11} /> Disagreements
                      </p>
                      <div className="space-y-2">
                        {masterReport.cross_verification.disagreements.map((d, i) => (
                          <p key={i} className="text-[12px] pl-3 border-l-2 border-amber-200" style={{ color: TEXT2 }}>{d}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </Section>

                {/* Action panels: WhatsApp + Bank */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                  {/* SMS — Negotiator outreach */}
                  <Section title="Negotiator → Email Client" icon={MailIcon}>
                    {/* Offer Details Banner */}
                    {negotiatorResult && (
                      <div className="rounded-xl border p-3 mb-3 grid grid-cols-3 gap-3" style={{ borderColor: '#a7f3d0', background: '#ecfdf5' }}>
                        <div className="text-center">
                          <p className="text-[9px] font-semibold uppercase" style={{ color: '#065f46' }}>Discount</p>
                          <p className="text-lg font-black text-emerald-700">{negotiatorResult.suggested_discount_percentage}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-semibold uppercase" style={{ color: '#065f46' }}>New Amount</p>
                          <p className="text-lg font-black text-emerald-700">{pipeline ? formatHome(negotiatorResult.discounted_amount, pipeline.invoice.currency) : negotiatorResult.discounted_amount.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-semibold uppercase" style={{ color: '#065f46' }}>Tier</p>
                          <p className="text-lg font-black text-emerald-700 capitalize">{negotiatorResult.escalation_tier}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: BORDER }}>
                        <button onClick={() => setWaLang('ar')} className={`px-3 py-1 text-[11px] font-bold cursor-pointer ${waLang === 'ar' ? 'bg-blue-600 text-white' : 'text-gray-500 bg-white'}`}>AR</button>
                        <button onClick={() => setWaLang('en')} className={`px-3 py-1 text-[11px] font-bold cursor-pointer ${waLang === 'en' ? 'bg-blue-600 text-white' : 'text-gray-500 bg-white'}`}>EN</button>
                      </div>
                      <span className="text-[10px]" style={{ color: TEXT3 }}>
                        To: {currentInvoice?.clientEmail || <em>no email</em>} (via Email)
                      </span>
                      <button onClick={() => navigator.clipboard.writeText(waLang === 'ar' ? negotiatorResult!.whatsapp_message_arabic : negotiatorResult!.whatsapp_message_english)}
                        className="ml-auto h-7 px-2 rounded-lg border text-[10px] font-medium hover:bg-gray-50 cursor-pointer flex items-center gap-1"
                        style={{ borderColor: BORDER, color: TEXT2 }}>
                        <Copy size={10} />Copy
                      </button>
                    </div>

                    <div className="rounded-xl border p-4 text-[12px] leading-[1.8] whitespace-pre-line min-h-[110px]"
                      style={{ borderColor: BORDER, background: CREAM, color: TEXT, direction: waLang === 'ar' ? 'rtl' : 'ltr' }}>
                      {(waLang === 'ar' ? negotiatorResult?.whatsapp_message_arabic : negotiatorResult?.whatsapp_message_english) || '—'}
                    </div>

                    <button onClick={handleSendNegotiatorEmail} disabled={sendingWa || !currentInvoice?.clientEmail}
                      className="mt-3 w-full h-10 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                      {sendingWa ? <Loader2 size={14} className="animate-spin" /> : <MailIcon size={14} />}
                      {sendingWa ? 'Sending…' : 'Email Negotiator Message to Client'}
                    </button>
                    <SendBanner result={waResult} kind="email" />
                  </Section>

                  {/* Bank */}
                  <Section title="Treasurer → Submit to Bank via SendGrid" icon={Building2}>
                    <div className="rounded-xl border p-4 mb-3" style={{ borderColor: BORDER, background: CREAM }}>
                      <p className="text-[10px] font-semibold mb-1.5" style={{ color: TEXT3 }}>BANK PITCH</p>
                      <p className="text-[12px] leading-[1.7]" style={{ color: TEXT2 }}>{treasurerResult?.bank_pitch}</p>
                    </div>
                    <div className="text-[10px] mb-3 flex items-center gap-2" style={{ color: TEXT3 }}>
                      <FileText size={11} />
                      <span>Attachment: <b>madar-risk-report-{pipeline.meta.refId}.pdf</b></span>
                    </div>

                    {/* ── Blockchain Lock Error ── */}
                    {bankLockError && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        className="mb-3 p-3 rounded-xl border text-[11px] leading-[1.7]"
                        style={{ background: '#fff7ed', borderColor: '#fed7aa', color: '#9a3412' }}>
                        <div className="flex items-start gap-2">
                          <span className="text-base mt-0.5">🔒</span>
                          <span>{bankLockError}</span>
                        </div>
                      </motion.div>
                    )}

                    <div className="flex gap-2">
                      <button onClick={handleDownload}
                        className="flex-1 h-10 rounded-xl border text-sm font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        style={{ borderColor: BORDER, color: TEXT2 }}>
                        <Download size={14} />Download PDF
                      </button>

                      {bankAlreadySubmitted ? (
                        /* ── Locked badge — cannot re-submit ── */
                        <div className="flex-1 h-10 rounded-xl flex items-center justify-center gap-2 px-3"
                          style={{ background: '#f1f5f9', border: '1.5px dashed #94a3b8' }}>
                          <span className="text-base">🔒</span>
                          <div className="text-left">
                            <p className="text-[10px] font-black leading-none" style={{ color: '#475569' }}>SUBMITTED</p>
                            <p className="text-[9px] font-mono leading-none mt-0.5" style={{ color: '#94a3b8' }}>
                              #{currentHash?.slice(0, 8)}…
                            </p>
                          </div>
                          <div className="ml-auto text-[9px] leading-none text-right" style={{ color: '#94a3b8' }}>
                            {bankSubmittedEntry && new Date(bankSubmittedEntry.submittedAt).toLocaleDateString()}
                          </div>
                        </div>
                      ) : (
                        <button onClick={handleSendBank} disabled={sendingEmail}
                          className="flex-1 h-10 rounded-xl bg-amber-600 text-white text-sm font-bold hover:bg-amber-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
                          {sendingEmail ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                          {sendingEmail ? 'Sending + AI Deciding…' : 'Email to Bank'}
                        </button>
                      )}
                    </div>

                    <SendBanner result={emailResult} kind="email" />

                    {/* ── Phase 2: AI Bank Decision Panel ── */}
                    <AnimatePresence>
                      {(bankDecision || bankAlreadySubmitted) && (() => {
                        const dec = bankDecision ?? bankSubmittedEntry?.decision ?? null;
                        if (!dec) return null;
                        const cfg = {
                          approved:    { bg: '#f0fdf4', border: '#86efac', text: '#14532d', icon: '✅', label: 'FINANCING APPROVED',        sub: `${formatHome(pipeline.treasurer.recommended_advance_amount, pipeline.treasurer.advance_currency || 'USD')} · ${pipeline.treasurer.advance_rate_percentage}% APR · ${pipeline.treasurer.maturity_days}d`, pulse: '#059669' },
                          conditional: { bg: '#fffbeb', border: '#fcd34d', text: '#78350f', icon: '⏳', label: 'CONDITIONAL APPROVAL',       sub: 'Co-signer or invoice insurance required to proceed.', pulse: '#d97706' },
                          declined:    { bg: '#fef2f2', border: '#fca5a5', text: '#7f1d1d', icon: '❌', label: 'APPLICATION NOT ELIGIBLE',   sub: 'Risk parameters exceed current cycle thresholds.', pulse: '#dc2626' },
                        }[dec];
                        return (
                          <motion.div
                            key="bank-decision"
                            initial={{ opacity: 0, scale: 0.97, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            className="mt-3 rounded-2xl border-2 overflow-hidden"
                            style={{ borderColor: cfg.border, background: cfg.bg }}>
                            <div className="px-4 py-3 flex items-start gap-3">
                              <span className="text-xl mt-0.5">{cfg.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-[11px] font-black tracking-widest" style={{ color: cfg.text }}>
                                    {cfg.label}
                                  </p>
                                  <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                                    style={{ background: cfg.pulse + '22', color: cfg.pulse }}>
                                    AI · No Human Review
                                  </span>
                                </div>
                                <p className="text-[11px] mt-1 leading-[1.6]" style={{ color: cfg.text, opacity: 0.8 }}>
                                  {cfg.sub}
                                </p>
                                {dec === 'approved' && (
                                  <div className="mt-2 grid grid-cols-3 gap-2">
                                    {[
                                      ['Advance', formatHome(pipeline.treasurer.recommended_advance_amount, pipeline.treasurer.advance_currency || 'USD')],
                                      ['APR', `${pipeline.treasurer.advance_rate_percentage}%`],
                                      ['Maturity', `${pipeline.treasurer.maturity_days}d`],
                                    ].map(([label, val]) => (
                                      <div key={label} className="rounded-lg p-2 text-center" style={{ background: '#dcfce7' }}>
                                        <p className="text-[9px] font-semibold" style={{ color: '#166534' }}>{label}</p>
                                        <p className="text-[13px] font-black mt-0.5" style={{ color: '#14532d' }}>{val}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[9px] font-mono px-2 py-0.5 rounded" style={{ background: cfg.pulse + '15', color: cfg.pulse }}>
                                    SHA-256: {currentHash?.slice(0, 16)}…
                                  </span>
                                  {bankDecisionAt && (
                                    <span className="text-[9px]" style={{ color: cfg.text, opacity: 0.6 }}>
                                      Decided: {new Date(bankDecisionAt).toLocaleTimeString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Auto-approval email notice */}
                            {dec === 'approved' && approvalEmailSent && (
                              <div className="px-4 py-2 border-t flex items-center gap-2" style={{ borderColor: cfg.border, background: '#dcfce7' }}>
                                <MailIcon size={11} style={{ color: '#059669', flexShrink: 0 }} />
                                <p className="text-[10px] font-semibold" style={{ color: '#14532d' }}>
                                  Approval email auto-sent to client — no human action required
                                </p>
                              </div>
                            )}
                          </motion.div>
                        );
                      })()}
                    </AnimatePresence>
                  </Section>
                </div>

                {/* Agent contributions cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { name: 'Sentinel',   model: 'DeepSeek R1',   text: masterReport.model_contributions.sentinel_says,   color: '#2563eb', icon: ShieldCheck },
                    { name: 'Negotiator', model: 'Gemini 3.1 Pro', text: masterReport.model_contributions.negotiator_says, color: '#059669', icon: MessageCircle },
                    { name: 'Treasurer',  model: 'Claude Opus 4.6', text: masterReport.model_contributions.treasurer_says, color: '#d97706', icon: Building2 },
                  ].map((c, i) => (
                    <div key={i} className="p-5 rounded-2xl border relative" style={{ borderColor: BORDER, background: CARD }}>
                      <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: c.color }} />
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${c.color}10` }}>
                          <c.icon size={15} style={{ color: c.color }} />
                        </div>
                        <div>
                          <p className="text-sm font-black leading-none tracking-tight" style={{ color: c.color }}>{c.name}</p>
                          <p className="text-[9px] font-mono mt-0.5" style={{ color: TEXT3 }}>{c.model}</p>
                        </div>
                      </div>
                      <p className="text-[12px] leading-[1.8]" style={{ color: TEXT2 }}>{c.text}</p>
                    </div>
                  ))}
                </div>

                {/* Executive summary */}
                <Section title="Executive Summary" icon={FileText}>
                  <p className="text-[13px] leading-[1.9]" style={{ color: TEXT2 }}>{masterReport.executive_summary}</p>
                </Section>

                <div className="h-8" />
              </motion.div>
            )}

          </div>
        </main>
      <NewInvoiceModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onSubmit={(inv) => { setShowNew(false); run(inv); }}
        initialValues={prefillData ?? undefined}
      />
      <ClientPickerModal
        open={showClientPicker}
        onClose={() => setShowClientPicker(false)}
        onPick={(inv) => { setShowClientPicker(false); run(inv); }}
      />
    </div>
  );
}
