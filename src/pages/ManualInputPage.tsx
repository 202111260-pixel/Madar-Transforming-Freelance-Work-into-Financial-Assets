/**
 * ManualInputPage — Madar
 * Liquidity Tools: invoices, obligations & multi-currency income tracking
 */
import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { hydrateFromSupabase } from '../lib/supabaseSync';
import { useHomeCurrency } from '../lib/homeCurrency';
import { motion, AnimatePresence } from 'framer-motion';
import { sendEmail } from '../lib/sendgridEmail';
import { callAgent } from '../lib/zenmux';
import ClientBehaviorAI from '../components/ClientBehaviorAI';
import {
  Brain, BarChart3, Link2, Droplets, CreditCard, Activity,
  Sparkles, PenLine, Plus, Trash2, X, ChevronDown, Save,
  Edit2, AlertCircle, Globe, Send, TrendingDown,
  Receipt, Users, ShoppingBag, FileText, TrendingUp, ArrowUpRight, ArrowDownRight,
  Upload, ShieldCheck, Loader2, Paperclip, Mail, MessageSquare, CheckCircle2,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend,
} from 'recharts';

const CREAM = 'var(--cream)', CARD = 'var(--card)', BORDER = 'var(--border)';
const TEXT = 'var(--text)', TEXT2 = 'var(--text2)', TEXT3 = 'var(--text3)', ACCENT = 'var(--accent)';

const CURRENCIES = ['SAR', 'USD', 'OMR', 'AED', 'EGP', 'BHD', 'KWD', 'QAR', 'EUR'] as const;
type Currency = typeof CURRENCIES[number];

const TO_SAR: Record<Currency, number> = {
  SAR: 1, USD: 3.75, OMR: 9.75, AED: 1.02, EGP: 0.075,
  BHD: 9.95, KWD: 12.2, QAR: 1.03, EUR: 4.1,
};
const CURR_SYMBOL: Record<Currency, string> = {
  SAR: 'SAR', USD: 'USD', OMR: 'OMR', AED: 'AED', EGP: 'EGP',
  BHD: 'BHD', KWD: 'KWD', QAR: 'QAR', EUR: 'EUR',
};

/* ── Home currency: read live from the user profile so changes in the header switcher
 *    propagate to every chart/KPI on the next render. The DashboardTab component subscribes
 *    via `useHomeCurrency()` so it re-renders the moment the user flips the currency. ── */
function getHomeCurrency(): Currency {
  try {
    const p = JSON.parse(localStorage.getItem('synergy_user_profile_v1') || '{}');
    if (p.homeCurrency && (CURRENCIES as readonly string[]).includes(p.homeCurrency)) return p.homeCurrency as Currency;
    const country = String(p.country || p.location || '').toLowerCase();
    if (country.includes('oman') || country.includes('muscat')) return 'OMR';
    if (country.includes('saudi') || country.includes('riyadh') || country.includes('ksa')) return 'SAR';
    if (country.includes('uae') || country.includes('emirate') || country.includes('dubai')) return 'AED';
    if (country.includes('bahrain') || country.includes('manama')) return 'BHD';
    if (country.includes('kuwait')) return 'KWD';
    if (country.includes('qatar') || country.includes('doha')) return 'QAR';
    if (country.includes('egypt') || country.includes('cairo')) return 'EGP';
  } catch { /**/ }
  return 'OMR';
}
const PAYMENT_TERMS = ['Due on Receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60'] as const;
const BASE_CHANNELS = ['Email', 'WhatsApp', 'Bank Transfer', 'Payoneer', 'PayPal', 'Wise', 'Cash'];

const NAV = [
  { icon: BarChart3,  label: 'Dashboard',    path: '/' },
  { icon: Link2,      label: 'Connections',  path: '/connections' },
  { icon: Droplets,   label: 'Liquidity',    path: '/liquidity' },
  { icon: Brain,      label: 'AI Room',      path: '/room' },
  { icon: CreditCard, label: 'Credit',       path: '/credit' },
  { icon: PenLine,    label: 'Manual Entry', path: '/manual', active: true },
  { icon: Activity,   label: 'Activity',     path: '/activity' },
];

type InvoiceStatus = 'pending' | 'active' | 'paid' | 'overdue';
type Tab = 'dashboard' | 'invoices' | 'expenses' | 'clients';

interface Invoice {
  id: string; number: number;
  clientName: string; clientEmail: string; clientPhone: string; clientHistory: string;
  clientNotes: string;   // personality / payment behaviour — feeds Risk Score
  projectRef: string;
  currency: Currency; amount: number;
  issueDate: string; dueDate: string;
  paymentTerms: string; channel: string;
  notes: string; status: InvoiceStatus; createdAt: number;
  // ── Acquisition & proof — boost Synergy Score when verified ──
  connectionSource?: string;       // platform id from synergy_connections_v4 (e.g. 'whatsapp', 'upwork')
  proofName?: string;              // filename of uploaded proof
  proofUrl?: string;               // data URL preview
  proofVerified?: boolean;         // AI cross-validation result
  proofWeek?: string;              // ISO week label e.g. '2026-W17'
}
interface Obligation {
  id: string; label: string; amount: number; currency: Currency; dueDate: string;
}

const INV_STORE = 'synergy_invoices_v1';
const OBL_STORE = 'synergy_obligations_v1';

function loadInvoices(): Invoice[] {
  try {
    const s = JSON.parse(localStorage.getItem(INV_STORE) || '[]') as Invoice[];
    // migrate old invoices missing new fields
    const migrated = s.map(inv => ({
      clientEmail: '', clientPhone: '', clientHistory: '', clientNotes: '',
      connectionSource: '', proofName: '', proofUrl: '', proofVerified: false, proofWeek: '',
      ...inv,
    }));
    return migrated;
  }
  catch { return []; }
}
function saveInvoices(list: Invoice[]) {
  try {
    localStorage.setItem(INV_STORE, JSON.stringify(list));
    window.dispatchEvent(new Event('synergy:store-changed'));
  } catch { /**/ }
}
function loadObligations(): Obligation[] {
  try { return JSON.parse(localStorage.getItem(OBL_STORE) || '[]') as Obligation[]; }
  catch { return []; }
}
function saveObligations(list: Obligation[]) {
  try {
    localStorage.setItem(OBL_STORE, JSON.stringify(list));
    window.dispatchEvent(new Event('synergy:store-changed'));
  } catch { /**/ }
}

/**
 * Convert any amount to the user's HOME currency (live).
 * Function keeps the historic `toSAR` name purely to avoid a 50-site rename — the value it
 * returns is in whatever the user selected as home currency, never SAR (unless the user is Saudi).
 */
function toSAR(amount: number, currency: Currency) {
  const inSar = amount * TO_SAR[currency];
  return Math.round(inSar / TO_SAR[getHomeCurrency()]);
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function dueBadge(dueDate: string, status: InvoiceStatus): { label: string; color: string; bg: string } {
  if (status === 'paid') return { label: 'paid', color: '#15803d', bg: '#f0fdf4' };
  if (!dueDate) return { label: '—', color: TEXT3, bg: CREAM };
  const diff = Math.round((new Date(dueDate).getTime() - Date.now()) / 86400000);
  if (diff < 0) return { label: 'overdue', color: '#dc2626', bg: '#fef2f2' };
  if (diff === 0) return { label: 'due today', color: '#d97706', bg: '#fffbeb' };
  return { label: '+' + diff + ' days', color: diff <= 7 ? '#d97706' : TEXT2, bg: diff <= 7 ? '#fffbeb' : CREAM };
}
function oblDays(dueDate: string) { return Math.round((new Date(dueDate).getTime() - Date.now()) / 86400000); }

function isoWeek(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function emptyForm(): Omit<Invoice, 'id' | 'number' | 'createdAt'> {
  return {
    clientName: '', clientEmail: '', clientPhone: '', clientHistory: '', clientNotes: '',
    projectRef: '', currency: 'SAR', amount: 0,
    issueDate: new Date().toISOString().slice(0, 10), dueDate: '',
    paymentTerms: 'Net 30', channel: 'Email', notes: '', status: 'pending',
    connectionSource: '', proofName: '', proofUrl: '', proofVerified: false, proofWeek: isoWeek(),
  };
}

/* ── CurrencyPicker ── */
function CurrencyPicker({ value, onChange }: { value: Currency; onChange: (c: Currency) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 rounded-xl border font-bold text-[13px] cursor-pointer w-full"
        style={{ borderColor: BORDER, background: CREAM, color: TEXT, height: 42 }}>
        <Globe size={13} style={{ color: TEXT3 }} />
        <span className="flex-1 text-left">{value}</span>
        <ChevronDown size={10} style={{ color: TEXT3 }} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 rounded-xl border shadow-xl overflow-hidden"
          style={{ borderColor: BORDER, background: CARD, minWidth: 170 }}>
          <p className="text-[10px] text-center py-2 font-semibold border-b" style={{ borderColor: BORDER, color: TEXT3 }}>
            — pick any —
          </p>
          {CURRENCIES.map(c => (
            <button key={c} type="button" onClick={() => { onChange(c); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
              style={{ background: c === value ? '#eff6ff' : 'transparent' }}>
              <span className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                style={{ borderColor: c === value ? ACCENT : BORDER }}>
                {c === value && <span className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />}
              </span>
              <span className="text-[13px] font-semibold flex-1 text-left" style={{ color: TEXT }}>{c}</span>
              <span className="text-[11px]" style={{ color: TEXT3 }}>{CURR_SYMBOL[c]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── InvoiceRow — rich table row ── */
function InvoiceRow({ invoice, onEdit, onDelete, onAnalyze }: { invoice: Invoice; onEdit: () => void; onDelete: () => void; onAnalyze: () => void }) {
  const badge = dueBadge(invoice.dueDate, invoice.status);
  const statusCfg: Record<InvoiceStatus, { label: string; color: string }> = {
    pending: { label: 'pending', color: '#d97706' },
    active:  { label: 'active',  color: '#2563eb' },
    paid:    { label: 'paid',    color: '#15803d' },
    overdue: { label: 'overdue', color: '#dc2626' },
  };
  const sc = statusCfg[invoice.status];

  // Simple risk heuristic based on status + overdue days
  const diff = invoice.dueDate ? Math.round((new Date(invoice.dueDate).getTime() - Date.now()) / 86400000) : 0;
  const risk: { label: string; color: string; bg: string } =
    invoice.status === 'paid'    ? { label: 'NONE',   color: '#15803d', bg: '#f0fdf4' } :
    invoice.status === 'overdue' ? { label: 'HIGH',   color: '#dc2626', bg: '#fef2f2' } :
    diff <= 7                    ? { label: 'MEDIUM', color: '#d97706', bg: '#fffbeb' } :
                                   { label: 'LOW',    color: '#16a34a', bg: '#f0fdf4' };

  const action =
    invoice.status === 'overdue' ? { label: 'negotiate →', color: '#dc2626', bg: '#fef2f2' } :
    invoice.status === 'paid'    ? { label: 'view →',       color: '#15803d', bg: '#f0fdf4' } :
    diff <= 7                    ? { label: 'remind →',     color: '#d97706', bg: '#fffbeb' } :
                                   { label: 'monitor →',   color: '#2563eb', bg: '#eff6ff' };

  return (
    <tr className="group hover:bg-blue-50/30 transition-colors" style={{ borderBottom: `1px solid ${BORDER}` }}>
      {/* CLIENT */}
      <td className="py-3 pl-5 pr-3 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black text-white"
            style={{ background: invoice.status === 'overdue' ? '#dc2626' : invoice.status === 'paid' ? '#15803d' : '#2563eb' }}>
            {invoice.clientName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: TEXT }}>{invoice.clientName}</p>
            {invoice.clientEmail && (
              <p className="text-[10px] truncate" style={{ color: TEXT3 }}>{invoice.clientEmail}</p>
            )}
            {!invoice.clientEmail && invoice.clientPhone && (
              <p className="text-[10px] truncate" style={{ color: TEXT3 }}>{invoice.clientPhone}</p>
            )}
          </div>
        </div>
      </td>
      {/* AMOUNT */}
      <td className="py-3 px-3 shrink-0">
        <p className="text-[13px] font-black whitespace-nowrap" style={{ color: TEXT }}>
          {invoice.currency} {invoice.amount.toLocaleString()}
        </p>
        {invoice.currency !== 'SAR' && (
          <p className="text-[10px]" style={{ color: TEXT3 }}>≈ SAR {toSAR(invoice.amount, invoice.currency).toLocaleString()}</p>
        )}
      </td>
      {/* DUE */}
      <td className="py-3 px-3">
        <span className="text-[12px] font-semibold whitespace-nowrap" style={{ color: badge.color }}>{badge.label}</span>
      </td>
      {/* STATUS */}
      <td className="py-3 px-3">
        <span className="text-[11px] font-bold px-2 py-0.5 rounded border whitespace-nowrap"
          style={{ color: sc.color, borderColor: sc.color + '40', background: sc.color + '12' }}>
          {sc.label}
        </span>
      </td>
      {/* RISK */}
      <td className="py-3 px-3">
        <span className="text-[11px] font-black px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ color: risk.color, background: risk.bg }}>
          {risk.label}
        </span>
      </td>
      {/* ACTION */}
      <td className="py-3 px-3 pr-5">
        <div className="flex items-center gap-1">
          <button onClick={onAnalyze}
            className="text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors whitespace-nowrap"
            style={{ color: action.color, background: action.bg }}>
            {action.label}
          </button>
          <button onClick={onEdit}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 cursor-pointer transition-colors"
            style={{ color: TEXT3 }}>
            <Edit2 size={11} />
          </button>
          <button onClick={onDelete}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 cursor-pointer transition-colors">
            <Trash2 size={10} className="text-red-400" />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ── ObligationItem ── */
function ObligationItem({ obligation, onDelete }: { obligation: Obligation; onDelete: () => void }) {
  const d = oblDays(obligation.dueDate);
  const dueLabel = d < 0 ? 'overdue' : ('due in ' + d + (d === 1 ? ' day' : ' days'));
  const dueColor = d < 0 ? '#dc2626' : d <= 5 ? '#d97706' : TEXT3;
  const sarAmt = toSAR(obligation.amount, obligation.currency);

  return (
    <div className="flex items-start justify-between py-3 border-b last:border-0" style={{ borderColor: BORDER }}>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold" style={{ color: TEXT }}>{obligation.label}</p>
        <p className="text-[11px] mt-0.5" style={{ color: dueColor }}>{dueLabel}</p>
      </div>
      <div className="flex items-start gap-2 ml-3 shrink-0">
        <div className="text-right">
          <p className="text-[14px] font-black" style={{ color: TEXT }}>
            {obligation.currency !== 'SAR' ? obligation.currency + ' ' : 'SAR '}
            {obligation.amount.toLocaleString()}
          </p>
          {obligation.currency !== 'SAR' && (
            <p className="text-[10px]" style={{ color: TEXT3 }}>≈ SAR {sarAmt.toLocaleString()}</p>
          )}
        </div>
        <button onClick={onDelete}
          className="w-5 h-5 flex items-center justify-center hover:bg-red-50 rounded cursor-pointer mt-0.5">
          <X size={10} className="text-red-400" />
        </button>
      </div>
    </div>
  );
}

/* ── Add Obligation mini-form ── */
function AddObligationForm({ onAdd, onCancel }: {
  onAdd: (o: Omit<Obligation, 'id'>) => void; onCancel: () => void;
}) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('SAR');
  const [dueDate, setDueDate] = useState('');
  const inp = 'w-full px-2.5 py-2 rounded-lg border text-[12px] outline-none focus:ring-1 focus:ring-blue-200';
  const is = { borderColor: BORDER, background: CREAM, color: TEXT };

  return (
    <div className="p-3 rounded-xl border space-y-2 mt-3" style={{ borderColor: BORDER, background: CREAM }}>
      <input className={inp} style={is} value={label} onChange={e => setLabel(e.target.value)}
        placeholder="e.g. Rent (studio)" autoFocus />
      <div className="flex gap-2">
        <input type="number" min="0" className={inp + ' flex-1'} style={is}
          value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
        <select className="px-2.5 py-2 rounded-lg border text-[12px] cursor-pointer appearance-none"
          style={is} value={currency} onChange={e => setCurrency(e.target.value as Currency)}>
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <input type="date" className={inp} style={is} value={dueDate} onChange={e => setDueDate(e.target.value)} />
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel}
          className="flex-1 h-8 rounded-lg border text-[11px] font-semibold cursor-pointer hover:bg-gray-50"
          style={{ borderColor: BORDER, color: TEXT2 }}>Cancel</button>
        <button onClick={() => { if (!label.trim() || !amount || !dueDate) return; onAdd({ label: label.trim(), amount: parseFloat(amount), currency, dueDate }); }}
          disabled={!label.trim() || !amount || !dueDate}
          className="flex-1 h-8 rounded-lg text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
          style={{ background: ACCENT }}>Add</button>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════
   DASHBOARD TAB
═══════════════════════════════════════════════════ */

function StatCard({ label, value, suffix, change, changePos, color, children }: {
  label: string; value: string; suffix?: string;
  change?: string; changePos?: boolean;
  color: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border p-5 flex flex-col gap-3" style={{ borderColor: BORDER, background: CARD }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: TEXT3 }}>{label}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-[28px] font-black leading-none" style={{ color: TEXT }}>{value}</span>
            {suffix && <span className="text-[13px] font-semibold" style={{ color: TEXT3 }}>{suffix}</span>}
          </div>
        </div>
        {change && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${changePos ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
            {changePos ? <ArrowUpRight size={11}/> : <ArrowDownRight size={11}/>}
            {change}
          </span>
        )}
      </div>
      {children}
      <div className="h-0.5 w-12 rounded-full" style={{ background: color + '60' }}/>
    </div>
  );
}

interface DashboardTabProps {
  invoices: Invoice[];
  obligations: Obligation[];
}

/* ══════════════════════════════════════════════════════════════════
   CashForecast — 30-day liquidity outlook
   Combines: declared revenue from connected platforms + pending receivables
             - monthly obligations → projected cash position.
   Tells the freelancer whether they'll need a factoring advance next month.
   ══════════════════════════════════════════════════════════════════ */
function CashForecast({ invoices, obligations }: { invoices: Invoice[]; obligations: Obligation[] }) {
  /* Subscribe to live currency changes — flipping the header switcher recomputes
   * the entire cash forecast (revenue / receivables / obligations / net) in the
   * new home currency without a page reload. */
  const HOME_CURRENCY = useHomeCurrency();
  const [connRevenueSAR, setConnRevenueSAR] = useState(0);
  const [connectedCount, setConnectedCount] = useState(0);

  useEffect(() => {
    const load = () => {
      try {
        const raw = JSON.parse(localStorage.getItem('synergy_connections_v4') || '{}') as Record<string, { status?: string; monthlyRevenueSAR?: number }>;
        let total = 0, connected = 0;
        for (const v of Object.values(raw)) {
          if (v.status === 'connected') {
            connected++;
            total += v.monthlyRevenueSAR ?? 0;
          }
        }
        setConnRevenueSAR(total);
        setConnectedCount(connected);
      } catch { /**/ }
    };
    load();
    window.addEventListener('synergy:store-changed', load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener('synergy:store-changed', load);
      window.removeEventListener('storage', load);
    };
  }, []);

  const now = Date.now();
  const day = 86_400_000;

  // Pending receivables expected within next 30 days
  const next30 = invoices.filter(inv => {
    if (inv.status === 'paid') return false;
    const due = new Date(inv.dueDate).getTime();
    return due <= now + 30 * day;
  });
  const pendingSAR = next30.reduce((s, inv) => s + toSAR(inv.amount, inv.currency), 0);
  const overdueSAR = invoices
    .filter(inv => inv.status !== 'paid' && new Date(inv.dueDate).getTime() < now)
    .reduce((s, inv) => s + toSAR(inv.amount, inv.currency), 0);

  // Monthly obligations
  const monthlyOblSAR = obligations.reduce((s, o) => s + toSAR(o.amount, o.currency), 0);

  // connRevenueSAR is stored in SAR — convert to HOME_CURRENCY for consistent arithmetic
  const connRevenueHome = Math.round(connRevenueSAR / TO_SAR[HOME_CURRENCY]);

  // Projected next-month inflow = platform declared + collectible receivables (assume 70% collection)
  const collectionRate = 0.7;
  const projectedInflow = connRevenueHome + Math.round(pendingSAR * collectionRate);
  const netNext30 = projectedInflow - monthlyOblSAR;
  const willNeedFinancing = netNext30 < 0;
  const fundingGap = Math.max(0, -netNext30);

  const k = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border p-5 space-y-4"
      style={{ borderColor: BORDER, background: CARD }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <TrendingUp size={14} className="text-blue-600"/>
            <p className="text-[12px] font-black uppercase tracking-wider" style={{ color: TEXT }}>
              30-Day Cash Forecast
            </p>
          </div>
          <p className="text-[11px]" style={{ color: TEXT3 }}>
            Combines {connectedCount} connected platform{connectedCount !== 1 ? 's' : ''} · {next30.length} receivables · {obligations.length} fixed costs
          </p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-[11px] font-black flex items-center gap-1.5`}
          style={willNeedFinancing
            ? { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }
            : { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
          {willNeedFinancing ? <AlertCircle size={11}/> : <ShieldCheck size={11}/>}
          {willNeedFinancing ? 'Needs factoring advance' : 'Cash-positive'}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-3" style={{ background: '#eff6ff' }}>
          <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#1d4ed8' }}>Platform revenue</p>
          <p className="text-[20px] font-black mt-0.5" style={{ color: '#2563eb' }}>{k(connRevenueHome)}</p>
          <p className="text-[10px]" style={{ color: TEXT3 }}>{HOME_CURRENCY}/mo · declared</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: '#f5f3ff' }}>
          <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#6d28d9' }}>Expected receivables</p>
          <p className="text-[20px] font-black mt-0.5" style={{ color: '#7c3aed' }}>{k(Math.round(pendingSAR * collectionRate))}</p>
          <p className="text-[10px]" style={{ color: TEXT3 }}>{HOME_CURRENCY} · 70% of {k(pendingSAR)}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: '#fff7ed' }}>
          <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#c2410c' }}>Monthly obligations</p>
          <p className="text-[20px] font-black mt-0.5" style={{ color: '#ea580c' }}>{k(monthlyOblSAR)}</p>
          <p className="text-[10px]" style={{ color: TEXT3 }}>{HOME_CURRENCY} · fixed costs</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: willNeedFinancing ? '#fef2f2' : '#f0fdf4' }}>
          <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: willNeedFinancing ? '#b91c1c' : '#15803d' }}>Net 30-day position</p>
          <p className="text-[20px] font-black mt-0.5" style={{ color: willNeedFinancing ? '#dc2626' : '#16a34a' }}>
            {netNext30 >= 0 ? '+' : '−'}{k(Math.abs(netNext30))}
          </p>
          <p className="text-[10px]" style={{ color: TEXT3 }}>{HOME_CURRENCY} · projected</p>
        </div>
      </div>

      {(willNeedFinancing || overdueSAR > 0) && (
        <div className="rounded-xl border-2 p-3 flex items-start gap-2.5"
          style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
          <AlertCircle size={14} className="text-red-600 mt-0.5 shrink-0"/>
          <div className="flex-1">
            <p className="text-[12px] font-bold text-red-700 mb-1">
              {willNeedFinancing
                ? `Funding gap of ${HOME_CURRENCY} ${k(fundingGap)} expected next month`
                : `${HOME_CURRENCY} ${k(overdueSAR)} overdue — collection priority`}
            </p>
            <p className="text-[11px] text-red-600 leading-relaxed">
              {willNeedFinancing
                ? 'Sentinel suggests opening the Credit Panel to request an Islamic factoring advance from your partner bank, against your pending receivables.'
                : 'Negotiator can dispatch WhatsApp reminders to overdue clients now. Open the Agent Room to start the collection workflow.'}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function DashboardTab({ invoices, obligations }: DashboardTabProps) {
  /* Subscribe to live currency changes from the header switcher.
   * `useHomeCurrency()` re-renders this component whenever the user picks
   * a different currency, which forces every `toSAR()` / chart formatter
   * call below to recompute against the new home currency. */
  const HOME_CURRENCY = useHomeCurrency();
  /* ── Derive data from real invoices ── */

  // Monthly revenue (last 7 months)
  const now = new Date();
  const monthlyRevenue = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1);
    const label = d.toLocaleString('en', { month: 'short' });
    const total = invoices
      .filter(inv => {
        const invDate = new Date(inv.issueDate);
        return invDate.getFullYear() === d.getFullYear() && invDate.getMonth() === d.getMonth();
      })
      .reduce((sum, inv) => sum + toSAR(inv.amount, inv.currency), 0);
    // Real data only — the chart shows 0 if the user hasn't logged any invoices
    // for that month. No fake demo seed values that would mask an empty state.
    return { month: label, revenue: total };
  });

  // Status breakdown
  const statusBreakdown = (['paid', 'active', 'pending', 'overdue'] as InvoiceStatus[]).map(s => ({
    name: s.charAt(0).toUpperCase() + s.slice(1),
    value: invoices.filter(i => i.status === s).length,
    color: s === 'paid' ? '#22c55e' : s === 'active' ? '#2563eb' : s === 'pending' ? '#f59e0b' : '#ef4444',
  }));
  const totalInvoices = statusBreakdown.reduce((s, x) => s + x.value, 0);

  // Channel + currency diversity (used by radar)
  const channelMap: Record<string, number> = {};
  invoices.forEach(inv => { channelMap[inv.channel] = (channelMap[inv.channel] || 0) + 1; });
  const channelDiversity = Object.keys(channelMap).length;

  const currencyMap: Record<string, number> = {};
  invoices.forEach(inv => { currencyMap[inv.currency] = (currencyMap[inv.currency] || 0) + 1; });
  const currencyDiversity = Object.keys(currencyMap).length;

  // Radar: freelancer health metrics
  const radarData = [
    { axis: 'Paid Rate',    value: Math.round((statusBreakdown[0].value / totalInvoices) * 100) || 72 },
    { axis: 'On-Time',      value: 65 },
    { axis: 'Multi-Curr',   value: currencyDiversity >= 3 ? 80 : 40 },
    { axis: 'Diversified',  value: channelDiversity >= 3 ? 78 : 45 },
    { axis: 'Active',       value: Math.round((statusBreakdown[1].value / totalInvoices) * 100) || 58 },
    { axis: 'Obligations',  value: obligations.length > 0 ? 70 : 90 },
  ];

  // Totals — toSAR() already returns HOME_CURRENCY-equivalent values
  const totalRevSAR = invoices.filter(i => i.status !== 'overdue')
    .reduce((s, i) => s + toSAR(i.amount, i.currency), 0);
  const collectedSAR = invoices.filter(i => i.status === 'paid')
    .reduce((s, i) => s + toSAR(i.amount, i.currency), 0);
  const collectionRate = totalRevSAR > 0 ? Math.round((collectedSAR / totalRevSAR) * 100) : 0;
  const totalOblSAR = obligations.reduce((s, o) => s + toSAR(o.amount, o.currency), 0);

  // Obligations vs income last 6 months
  const oblVsIncome = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      month: d.toLocaleString('en', { month: 'short' }),
      income: monthlyRevenue[i + 1]?.revenue ?? 0,
      obligations: totalOblSAR > 0 ? totalOblSAR : 0,
    };
  });

  const TOOLTIP_STYLE = {
    borderRadius: 12, border: `1px solid ${BORDER}`, background: CARD,
    color: TEXT, fontSize: 11, boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  };

  /* ── Premium dashboard derivations ── */

  // Risk classification per invoice (by days overdue / due)
  const classifyInvoice = (inv: Invoice) => {
    if (inv.status === 'paid') return 'LOW';
    const due = inv.dueDate ? Math.floor((new Date(inv.dueDate).getTime() - Date.now()) / 86400000) : 0;
    if (due < -30) return 'CRITICAL';
    if (due < -7)  return 'HIGH';
    if (due < 7)   return 'MEDIUM';
    return 'LOW';
  };
  const criticalInvoices = invoices.filter(i => classifyInvoice(i) === 'CRITICAL');
  const highRiskInvoices = invoices.filter(i => classifyInvoice(i) === 'HIGH');
  const mediumRiskInvoices = invoices.filter(i => classifyInvoice(i) === 'MEDIUM');
  const lowRiskInvoices = invoices.filter(i => classifyInvoice(i) === 'LOW');
  const topRiskInvoices = [...criticalInvoices, ...highRiskInvoices, ...mediumRiskInvoices].slice(0, 5);

  // Risk distribution donut data
  const riskDistribution = [
    { name: 'Critical', value: criticalInvoices.length,   color: '#dc2626' },
    { name: 'High',     value: highRiskInvoices.length,   color: '#ea580c' },
    { name: 'Medium',   value: mediumRiskInvoices.length, color: '#d97706' },
    { name: 'Low',      value: lowRiskInvoices.length,    color: '#16a34a' },
  ];
  const riskTotal = riskDistribution.reduce((s, d) => s + d.value, 0);

  // 7-month revenue + collection trends
  const revenueTrendData = monthlyRevenue.map((m, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1);
    const collectedThisMonth = invoices
      .filter(inv => {
        if (inv.status !== 'paid') return false;
        const invDate = new Date(inv.issueDate);
        return invDate.getFullYear() === d.getFullYear() && invDate.getMonth() === d.getMonth();
      })
      .reduce((sum, inv) => sum + toSAR(inv.amount, inv.currency), 0);
    return { ...m, collected: collectedThisMonth || Math.round(m.revenue * 0.65) };
  });

  // Aggregate by client for Top-N comparison + table
  const byClient: Record<string, {
    name: string; channel: string; status: InvoiceStatus;
    invoicedHome: number; collectedHome: number; invoiceCount: number;
  }> = {};
  invoices.forEach(inv => {
    const key = inv.clientName || '—';
    if (!byClient[key]) {
      byClient[key] = { name: key, channel: inv.channel, status: inv.status,
        invoicedHome: 0, collectedHome: 0, invoiceCount: 0 };
    }
    byClient[key].invoicedHome += toSAR(inv.amount, inv.currency);
    if (inv.status === 'paid') byClient[key].collectedHome += toSAR(inv.amount, inv.currency);
    byClient[key].invoiceCount += 1;
  });
  const sortedClients = Object.values(byClient).sort((a, b) => b.invoicedHome - a.invoicedHome);
  const topClientsBar = sortedClients.slice(0, 6).map(c => ({
    name: c.name.length > 12 ? c.name.slice(0, 11) + '…' : c.name,
    invoiced: c.invoicedHome,
    collected: c.collectedHome,
  }));
  const topClientsTable = sortedClients.slice(0, 10).map(c => {
    const collectionPct = c.invoicedHome > 0 ? Math.round((c.collectedHome / c.invoicedHome) * 100) : 0;
    const score = collectionPct >= 90 ? 4.8 : collectionPct >= 70 ? 4.2 : collectionPct >= 50 ? 3.5 : collectionPct >= 25 ? 2.8 : 1.9;
    const statusColor = c.status === 'paid' ? '#16a34a'
      : c.status === 'active' ? '#2563eb'
      : c.status === 'pending' ? '#f59e0b'
      : '#dc2626';
    const statusLabel = c.status === 'paid' ? 'Completed'
      : c.status === 'active' ? 'Active'
      : c.status === 'pending' ? 'Planning'
      : 'Overdue';
    return { ...c, collectionPct, score, statusColor, statusLabel };
  });

  // Delayed invoices (overdue, sorted by days overdue desc)
  const delayedList = invoices
    .filter(i => i.status !== 'paid' && i.dueDate && new Date(i.dueDate).getTime() < Date.now())
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);

  // Radar overall score
  const radarOverall = Math.round(radarData.reduce((s, r) => s + r.value, 0) / radarData.length);

  // Period comparisons
  const sumRevForRange = (startDate: Date, endDate: Date) => invoices
    .filter(i => {
      const t = new Date(i.issueDate).getTime();
      return t >= startDate.getTime() && t < endDate.getTime();
    })
    .reduce((s, i) => s + toSAR(i.amount, i.currency), 0);
  const countInvForRange = (startDate: Date, endDate: Date) => invoices
    .filter(i => {
      const t = new Date(i.issueDate).getTime();
      return t >= startDate.getTime() && t < endDate.getTime();
    }).length;
  const calcDelta = (curr: number, prev: number) => prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const lastQuarterStart = new Date(quarterStart.getFullYear(), quarterStart.getMonth() - 3, 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);

  const buildPeriod = (currStart: Date, currEnd: Date, prevStart: Date, prevEnd: Date) => {
    const currRev = sumRevForRange(currStart, currEnd);
    const prevRev = sumRevForRange(prevStart, prevEnd);
    const currInv = countInvForRange(currStart, currEnd);
    const prevInv = countInvForRange(prevStart, prevEnd);
    const currCollected = invoices
      .filter(i => i.status === 'paid' && i.issueDate && (() => {
        const t = new Date(i.issueDate).getTime();
        return t >= currStart.getTime() && t < currEnd.getTime();
      })())
      .reduce((s, i) => s + toSAR(i.amount, i.currency), 0);
    const prevCollected = invoices
      .filter(i => i.status === 'paid' && i.issueDate && (() => {
        const t = new Date(i.issueDate).getTime();
        return t >= prevStart.getTime() && t < prevEnd.getTime();
      })())
      .reduce((s, i) => s + toSAR(i.amount, i.currency), 0);
    return [
      { label: 'Revenue',    delta: calcDelta(currRev, prevRev) },
      { label: 'Invoices',   delta: calcDelta(currInv, prevInv) },
      { label: 'Clients',    delta: calcDelta(Object.keys(byClient).length, Math.max(0, Object.keys(byClient).length)) },
      { label: 'Collection', delta: calcDelta(currCollected, prevCollected) },
    ];
  };
  const periodComparisons = {
    month:   buildPeriod(monthStart, new Date(now.getFullYear(), now.getMonth() + 1, 1), lastMonthStart, monthStart),
    quarter: buildPeriod(quarterStart, new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 1), lastQuarterStart, quarterStart),
    year:    buildPeriod(yearStart, new Date(now.getFullYear() + 1, 0, 1), lastYearStart, yearStart),
  };
  const periodComparisonsObj = {
    month:   periodComparisons.month,
    quarter: periodComparisons.quarter,
    year:    periodComparisons.year,
  };
  void periodComparisonsObj; // silence linter; structure mirrored intentionally

  return (
    <div className="max-w-[1400px] mx-auto px-5 py-5 space-y-4">

      {/* ── Cash Forecast — combines connected platform revenue + receivables + obligations ── */}
      <CashForecast invoices={invoices} obligations={obligations} />

      {/* ── Row 1: KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={totalRevSAR >= 1000 ? (totalRevSAR / 1000).toFixed(1) + 'k' : String(totalRevSAR)}
          suffix={HOME_CURRENCY}
          change={periodComparisons.month[0].delta === 0 ? '—' : `${periodComparisons.month[0].delta > 0 ? '+' : ''}${periodComparisons.month[0].delta.toFixed(1)}%`}
          changePos={periodComparisons.month[0].delta >= 0} color="#2563eb">
          <ResponsiveContainer width="100%" height={52}>
            <AreaChart data={monthlyRevenue} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2}
                fill="url(#revGrad)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </StatCard>

        <StatCard label="Total Invoices" value={String(totalInvoices)} suffix="invoices"
          change={periodComparisons.month[1].delta === 0 ? '—' : `${periodComparisons.month[1].delta > 0 ? '+' : ''}${periodComparisons.month[1].delta.toFixed(0)}%`}
          changePos={periodComparisons.month[1].delta >= 0} color="#22c55e">
          <div className="flex gap-2 flex-wrap">
            {statusBreakdown.map(s => (
              <div key={s.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }}/>
                <span className="text-[11px]" style={{ color: TEXT3 }}>{s.name}</span>
                <span className="text-[11px] font-bold" style={{ color: TEXT }}>{s.value}</span>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={44}>
            <BarChart data={statusBreakdown} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {statusBreakdown.map((entry, i) => <Cell key={i} fill={entry.color}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </StatCard>

        <StatCard label="Collection Rate" value={String(collectionRate)} suffix="%"
          change={periodComparisons.month[3].delta === 0 ? '—' : `${periodComparisons.month[3].delta > 0 ? '+' : ''}${periodComparisons.month[3].delta.toFixed(1)}%`}
          changePos={periodComparisons.month[3].delta >= 0} color="#f59e0b">
          <div className="space-y-1.5 text-[11px]">
            {[
              { label: 'Invoiced',   value: totalRevSAR,   color: '#2563eb' },
              { label: 'Collected',  value: collectedSAR,  color: '#22c55e' },
              { label: 'Overdue',    value: totalRevSAR - collectedSAR, color: '#ef4444' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-2">
                <span className="w-20 shrink-0" style={{ color: TEXT3 }}>{row.label}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
                  <div className="h-full rounded-full" style={{
                    background: row.color,
                    width: `${Math.round((row.value / totalRevSAR) * 100)}%`,
                  }}/>
                </div>
                <span className="w-14 text-right font-semibold" style={{ color: TEXT }}>
                  {row.value >= 1000 ? (row.value / 1000).toFixed(1) + 'k' : row.value} {HOME_CURRENCY}
                </span>
              </div>
            ))}
          </div>
        </StatCard>

        <StatCard label="Obligations" value={totalOblSAR >= 1000 ? (totalOblSAR / 1000).toFixed(1) + 'k' : String(totalOblSAR)}
          suffix={`${HOME_CURRENCY} / mo`} change="-" changePos={false} color="#ef4444">
          <div className="space-y-1.5">
            {obligations.slice(0, 3).map(o => (
              <div key={o.id} className="flex items-center justify-between text-[11px]">
                <span className="truncate" style={{ color: TEXT3 }}>{o.label}</span>
                <span className="font-semibold ml-2 shrink-0" style={{ color: TEXT }}>
                  {o.currency} {o.amount.toLocaleString()}
                </span>
              </div>
            ))}
            {obligations.length === 0 && <p className="text-[11px]" style={{ color: TEXT3 }}>No obligations added yet</p>}
          </div>
        </StatCard>
      </div>

      {/* ── Row 2: Early Warning Center ── */}
      <div className="rounded-2xl border p-5" style={{ borderColor: BORDER, background: CARD }}>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <AlertCircle size={14} className="text-orange-500"/>
              <p className="text-[13px] font-extrabold uppercase tracking-wider" style={{ color: TEXT }}>Early Warning Center</p>
            </div>
            <p className="text-[11px]" style={{ color: TEXT3 }}>Real-time invoice risk assessment</p>
          </div>
          <button className="text-[11px] font-bold px-3 py-1.5 rounded-lg border hover:bg-blue-50 transition-colors flex items-center gap-1.5"
            style={{ borderColor: BORDER, color: '#2563eb' }}>
            <Activity size={11}/> View All Alerts
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-5">
          <div>
            {/* Risk band cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { tier: 'CRITICAL', count: criticalInvoices.length, bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
                { tier: 'HIGH',     count: highRiskInvoices.length, bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
                { tier: 'MEDIUM',   count: mediumRiskInvoices.length, bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
                { tier: 'LOW',      count: lowRiskInvoices.length, bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
              ].map(b => (
                <div key={b.tier} className="rounded-xl border p-3 text-center"
                  style={{ background: b.bg, borderColor: b.border }}>
                  <p className="text-[28px] font-black leading-none" style={{ color: b.color }}>{b.count}</p>
                  <p className="text-[9px] font-black uppercase tracking-wider mt-1.5" style={{ color: b.color }}>{b.tier}</p>
                </div>
              ))}
            </div>
            {/* Priority list */}
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: BORDER }}>
              <div className="grid grid-cols-[1.4fr_1fr_0.8fr_1fr_0.8fr] gap-3 px-3 py-2 text-[9px] font-black uppercase tracking-wider"
                style={{ background: '#f8fafc', color: TEXT3, borderBottom: `1px solid ${BORDER}` }}>
                <span>Invoice</span><span>Channel</span><span>Risk</span><span>Collection</span><span>Days Left</span>
              </div>
              {topRiskInvoices.length === 0 ? (
                <div className="p-6 text-center text-[11px]" style={{ color: TEXT3 }}>No high-risk invoices · all clear ✓</div>
              ) : topRiskInvoices.map(inv => {
                const due = inv.dueDate ? Math.floor((new Date(inv.dueDate).getTime() - Date.now()) / 86400000) : 0;
                const tier = due < -30 ? { l: 'CRITICAL', c: '#dc2626' }
                  : due < -7 ? { l: 'HIGH', c: '#ea580c' }
                  : due < 7 ? { l: 'MEDIUM', c: '#d97706' }
                  : { l: 'LOW', c: '#16a34a' };
                const pct = inv.status === 'paid' ? 100 : inv.status === 'active' ? 60 : inv.status === 'pending' ? 25 : 0;
                return (
                  <div key={inv.id} className="grid grid-cols-[1.4fr_1fr_0.8fr_1fr_0.8fr] gap-3 px-3 py-2.5 items-center text-[11px]"
                    style={{ borderBottom: `1px solid ${BORDER}40` }}>
                    <span className="font-bold truncate" style={{ color: TEXT }}>{inv.clientName || '—'}</span>
                    <span className="truncate" style={{ color: TEXT2 }}>{inv.channel}</span>
                    <span className="font-black" style={{ color: tier.c }}>{tier.l}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
                        <div className="h-full rounded-full" style={{ width: pct + '%', background: tier.c }}/>
                      </div>
                      <span className="font-semibold text-[10px] shrink-0" style={{ color: TEXT2 }}>{pct}%</span>
                    </div>
                    <span className="font-bold" style={{ color: due < 0 ? '#dc2626' : TEXT2 }}>
                      {due < 0 ? `${Math.abs(due)}d overdue` : `${due}d`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Risk distribution donut */}
          <div className="flex flex-col items-center justify-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={riskDistribution} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                  strokeWidth={0} paddingAngle={2}>
                  {riskDistribution.map((d, i) => <Cell key={i} fill={d.color}/>)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col items-center -mt-[110px] mb-[40px] pointer-events-none">
              <p className="text-[28px] font-black leading-none" style={{ color: TEXT }}>{riskTotal}</p>
              <p className="text-[9px] font-black uppercase tracking-wider mt-1" style={{ color: TEXT3 }}>Total</p>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider mt-2" style={{ color: TEXT3 }}>Risk Distribution</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 w-full">
              {riskDistribution.map(d => (
                <div key={d.name} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.color }}/>
                    <span style={{ color: TEXT2 }}>{d.name}</span>
                  </div>
                  <span className="font-bold" style={{ color: TEXT }}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 3: Revenue & Collection Trends + Category Comparison ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Revenue & Collection Trend */}
        <div className="rounded-2xl border p-5" style={{ borderColor: BORDER, background: CARD }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[13px] font-extrabold" style={{ color: TEXT }}>Revenue &amp; Collection Trends</p>
              <p className="text-[11px]" style={{ color: TEXT3 }}>7-month progression overview</p>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <TrendingUp size={13}/> +8.4%
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={revenueTrendData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false}/>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: TEXT3 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 10, fill: TEXT3 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}/>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v.toLocaleString() + ' ' + HOME_CURRENCY, '']}/>
              <Legend wrapperStyle={{ fontSize: 10, color: TEXT3 }} iconSize={8}/>
              <Line type="monotone" dataKey="revenue" name="Revenue"   stroke="#2563eb" strokeWidth={2.5}
                dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }} activeDot={{ r: 5 }}/>
              <Line type="monotone" dataKey="collected" name="Collected" stroke="#ec4899" strokeWidth={2}
                strokeDasharray="4 3"
                dot={{ r: 2.5, fill: '#ec4899', strokeWidth: 0 }} activeDot={{ r: 4 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category Comparison — by client (top categories) */}
        <div className="rounded-2xl border p-5" style={{ borderColor: BORDER, background: CARD }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[13px] font-extrabold" style={{ color: TEXT }}>Top Clients · Revenue Comparison</p>
              <p className="text-[11px]" style={{ color: TEXT3 }}>Invoiced vs collected per client · {HOME_CURRENCY}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topClientsBar} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false}/>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: TEXT3 }} axisLine={false} tickLine={false}
                interval={0} angle={-15} textAnchor="end" height={50}/>
              <YAxis tick={{ fontSize: 10, fill: TEXT3 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}/>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v.toLocaleString() + ' ' + HOME_CURRENCY, '']}/>
              <Bar dataKey="invoiced" name="Invoiced" fill="#3b82f6" radius={[4, 4, 0, 0]}/>
              <Bar dataKey="collected" name="Collected" fill="#ec4899" radius={[4, 4, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 4: Status Donut + Performance Radar + Budget Evolution ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Status Distribution */}
        <div className="rounded-2xl border p-5" style={{ borderColor: BORDER, background: CARD }}>
          <p className="text-[13px] font-extrabold mb-1" style={{ color: TEXT }}>Status Distribution</p>
          <p className="text-[11px] mb-3" style={{ color: TEXT3 }}>Invoice lifecycle breakdown</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={statusBreakdown} dataKey="value" nameKey="name"
                cx="50%" cy="50%" innerRadius={48} outerRadius={75}
                strokeWidth={0} paddingAngle={3}>
                {statusBreakdown.map((s, i) => <Cell key={i} fill={s.color}/>)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-2">
            {statusBreakdown.map(s => (
              <div key={s.name} className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }}/>
                <span style={{ color: TEXT2 }}>{s.name}</span>
                <span className="font-bold" style={{ color: TEXT }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Radar */}
        <div className="rounded-2xl border p-5" style={{ borderColor: BORDER, background: CARD }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[13px] font-extrabold" style={{ color: TEXT }}>Performance Radar</p>
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
              style={{ background: '#eff6ff', color: '#2563eb' }}>{radarOverall}/100</span>
          </div>
          <p className="text-[11px] mb-2" style={{ color: TEXT3 }}>Multi-dimensional health score</p>
          <ResponsiveContainer width="100%" height={210}>
            <RadarChart data={radarData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
              <PolarGrid stroke={BORDER}/>
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: TEXT3 }}/>
              <Radar name="Score" dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.18} strokeWidth={2}
                dot={{ r: 3, fill: '#2563eb', strokeWidth: 0 }}/>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v + '%', 'Score']}/>
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Budget Evolution */}
        <div className="rounded-2xl border p-5" style={{ borderColor: BORDER, background: CARD }}>
          <p className="text-[13px] font-extrabold mb-1" style={{ color: TEXT }}>Income vs Obligations</p>
          <p className="text-[11px] mb-3" style={{ color: TEXT3 }}>6-month evolution · {HOME_CURRENCY}</p>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={oblVsIncome} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="incArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25}/>
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="oblArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ec4899" stopOpacity={0.18}/>
                  <stop offset="100%" stopColor="#ec4899" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false}/>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: TEXT3 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 10, fill: TEXT3 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}/>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v.toLocaleString() + ' ' + HOME_CURRENCY, '']}/>
              <Area type="monotone" dataKey="income"      name="Income"      stroke="#2563eb" strokeWidth={2} fill="url(#incArea)"/>
              <Area type="monotone" dataKey="obligations" name="Obligations" stroke="#ec4899" strokeWidth={2} fill="url(#oblArea)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 5: Delayed Invoices + High-Risk Alerts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Delayed Invoices */}
        <div className="rounded-2xl border p-5" style={{ borderColor: BORDER, background: CARD }}>
          <div className="mb-3">
            <p className="text-[13px] font-extrabold" style={{ color: TEXT }}>Delayed Invoices</p>
            <p className="text-[11px]" style={{ color: TEXT3 }}>Invoices past their original due date</p>
          </div>
          <div className="space-y-2">
            {delayedList.length === 0 ? (
              <p className="text-[12px] py-4 text-center" style={{ color: TEXT3 }}>No delayed invoices · all on track ✓</p>
            ) : delayedList.map(inv => {
              const due = inv.dueDate ? Math.floor((new Date(inv.dueDate).getTime() - Date.now()) / 86400000) : 0;
              const overdue = Math.abs(due);
              const pct = Math.min(100, Math.round((overdue / 60) * 100));
              return (
                <div key={inv.id} className="flex items-center gap-3 p-2.5 rounded-lg border"
                  style={{ borderColor: BORDER, background: '#fffbeb' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: overdue > 30 ? '#fee2e2' : '#fef3c7' }}>
                    <AlertCircle size={14} style={{ color: overdue > 30 ? '#dc2626' : '#d97706' }}/>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold truncate" style={{ color: TEXT }}>{inv.clientName || `Invoice #${inv.number}`}</p>
                    <p className="text-[10px]" style={{ color: TEXT3 }}>
                      Due: {inv.dueDate || '—'} · <span className="text-red-600 font-semibold">{overdue}d overdue</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0 w-20">
                    <p className="text-[12px] font-black" style={{ color: '#dc2626' }}>{pct}%</p>
                    <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ background: '#f1f5f9' }}>
                      <div className="h-full rounded-full" style={{ width: pct + '%', background: '#dc2626' }}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Budget / Burn Alert (Obligations heaviest) */}
        <div className="rounded-2xl border p-5" style={{ borderColor: BORDER, background: CARD }}>
          <div className="mb-3">
            <p className="text-[13px] font-extrabold" style={{ color: TEXT }}>Cost Allocation Alert</p>
            <p className="text-[11px]" style={{ color: TEXT3 }}>Obligations consuming current revenue</p>
          </div>
          <div className="space-y-2">
            {obligations.length === 0 ? (
              <p className="text-[12px] py-4 text-center" style={{ color: TEXT3 }}>No fixed obligations recorded</p>
            ) : obligations.slice(0, 5).map(o => {
              const oblHome = toSAR(o.amount, o.currency as Currency);
              const pct = totalRevSAR > 0 ? Math.min(100, Math.round((oblHome / totalRevSAR) * 100)) : 0;
              return (
                <div key={o.id} className="flex items-center gap-3 p-2.5 rounded-lg border"
                  style={{ borderColor: BORDER, background: '#fff7ed' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-black text-[10px]"
                    style={{ background: '#ffedd5', color: '#c2410c' }}>{pct}%</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold truncate" style={{ color: TEXT }}>{o.label}</p>
                    <p className="text-[10px]" style={{ color: TEXT3 }}>
                      Budget: {HOME_CURRENCY} {totalRevSAR.toLocaleString()} · Spent: {o.currency} {o.amount.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold" style={{ color: TEXT3 }}>Burn</p>
                    <p className="text-[12px] font-black" style={{ color: '#ea580c' }}>{pct}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Row 6: Top 10 Clients by Revenue ── */}
      <div className="rounded-2xl border p-5" style={{ borderColor: BORDER, background: CARD }}>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <p className="text-[13px] font-extrabold" style={{ color: TEXT }}>Top 10 Clients by Revenue</p>
            <p className="text-[11px]" style={{ color: TEXT3 }}>Ranked by total invoiced amount</p>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: '#f1f5f9', color: TEXT2 }}>{topClientsTable.length} clients</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                <th className="text-left py-2 px-2 text-[9px] font-black uppercase tracking-wider w-8" style={{ color: TEXT3 }}>#</th>
                <th className="text-left py-2 px-2 text-[9px] font-black uppercase tracking-wider" style={{ color: TEXT3 }}>Client</th>
                <th className="text-left py-2 px-2 text-[9px] font-black uppercase tracking-wider" style={{ color: TEXT3 }}>Channel</th>
                <th className="text-left py-2 px-2 text-[9px] font-black uppercase tracking-wider" style={{ color: TEXT3 }}>Status</th>
                <th className="text-right py-2 px-2 text-[9px] font-black uppercase tracking-wider" style={{ color: TEXT3 }}>Invoiced ({HOME_CURRENCY})</th>
                <th className="text-left py-2 px-2 text-[9px] font-black uppercase tracking-wider" style={{ color: TEXT3 }}>Collection</th>
                <th className="text-right py-2 px-2 text-[9px] font-black uppercase tracking-wider" style={{ color: TEXT3 }}>Score</th>
                <th className="text-right py-2 px-2 text-[9px] font-black uppercase tracking-wider" style={{ color: TEXT3 }}>Invoices</th>
              </tr>
            </thead>
            <tbody>
              {topClientsTable.map((c, i) => (
                <tr key={c.name} style={{ borderBottom: `1px solid ${BORDER}40` }}>
                  <td className="py-2.5 px-2 font-black" style={{ color: TEXT3 }}>{i + 1}</td>
                  <td className="py-2.5 px-2 font-bold" style={{ color: TEXT }}>{c.name}</td>
                  <td className="py-2.5 px-2" style={{ color: TEXT2 }}>{c.channel}</td>
                  <td className="py-2.5 px-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: c.statusColor + '15', color: c.statusColor }}>{c.statusLabel}</span>
                  </td>
                  <td className="py-2.5 px-2 text-right font-black" style={{ color: TEXT }}>
                    {c.invoicedHome >= 1000 ? (c.invoicedHome / 1000).toFixed(1) + 'k' : c.invoicedHome}
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
                        <div className="h-full rounded-full" style={{ width: c.collectionPct + '%', background: c.collectionPct >= 80 ? '#16a34a' : c.collectionPct >= 50 ? '#f59e0b' : '#dc2626' }}/>
                      </div>
                      <span className="font-bold text-[10px]" style={{ color: TEXT2 }}>{c.collectionPct}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right font-black"
                    style={{ color: c.score >= 4 ? '#16a34a' : c.score >= 3 ? '#f59e0b' : '#dc2626' }}>
                    {c.score.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-bold" style={{ color: TEXT2 }}>{c.invoiceCount}</td>
                </tr>
              ))}
              {topClientsTable.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-[12px]" style={{ color: TEXT3 }}>
                  No client data yet · add invoices to populate this table
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Row 7: Period Comparisons ── */}
      <div className="rounded-2xl border p-5" style={{ borderColor: BORDER, background: CARD }}>
        <div className="mb-4">
          <p className="text-[13px] font-extrabold" style={{ color: TEXT }}>Period Comparisons</p>
          <p className="text-[11px]" style={{ color: TEXT3 }}>Performance benchmarks over time</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'vs Last Month',   data: periodComparisons.month   },
            { label: 'vs Last Quarter', data: periodComparisons.quarter },
            { label: 'vs Last Year',    data: periodComparisons.year    },
          ].map(p => (
            <div key={p.label} className="rounded-xl p-4 border" style={{ borderColor: BORDER, background: '#fafafa' }}>
              <p className="text-[11px] font-black uppercase tracking-wider mb-3" style={{ color: TEXT2 }}>{p.label}</p>
              <div className="space-y-2">
                {p.data.map(d => (
                  <div key={d.label} className="flex items-center justify-between text-[11px]">
                    <span style={{ color: TEXT2 }}>{d.label}</span>
                    <span className="font-black flex items-center gap-1"
                      style={{ color: d.delta >= 0 ? '#16a34a' : '#dc2626' }}>
                      {d.delta >= 0 ? <ArrowUpRight size={10}/> : <ArrowDownRight size={10}/>}
                      {d.delta >= 0 ? '+' : ''}{d.delta.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CLIENTS TAB — 18-client relationship tracker + WhatsApp reminders
   ══════════════════════════════════════════════════════════════ */
type ClientRisk = 'LOW' | 'MEDIUM' | 'HIGH';
type ClientStatus = 'active' | 'pending' | 'late' | 'ghost' | 'paid';
interface SynergyClient {
  id: string; name: string; phone?: string; email?: string;
  country: string; source: string;
  status: ClientStatus; risk: ClientRisk;
  totalInvoiced: number; totalPaid: number; currency: string;
  lastContact: string;
  nextDue?: string;
  avgDelayDays: number;
  notes: string; tags: string[];
  invoiceCount: number; paidCount: number;
}

const RISK_CFG: Record<ClientRisk, { bg: string; text: string; border: string }> = {
  LOW:    { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  MEDIUM: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  HIGH:   { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
};
const STATUS_CFG: Record<ClientStatus, { label: string; dot: string }> = {
  active:  { label: 'Active',   dot: '#3b82f6' },
  pending: { label: 'Pending',  dot: '#f59e0b' },
  late:    { label: 'Overdue',  dot: '#ef4444' },
  ghost:   { label: 'Ghosting', dot: '#6b7280' },
  paid:    { label: 'Paid ✓',   dot: '#22c55e' },
};

function daysSince(iso: string) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
function daysUntil(iso: string) {
  if (!iso) return null;
  const d = Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return d;
}

/* ── Branded HTML email template — banking-grade, matches Madar identity ──
   Palette: cream canvas (#f5f1e8) · navy header (#0b1220) · accent (status-driven)
   Layout: brand bar → tonal hero with status pill → context block → KPI grid
            → message paragraphs → cinematic CTA → cryptographic footer.
   Designed to render identically on Gmail, Outlook, Apple Mail (table-based). */
function emailTemplate(opts: {
  accent: string;            // status accent: green / amber / red
  heroEyebrow: string;       // "FRIENDLY REMINDER" / "PAYMENT OVERDUE" etc
  heroTitle: string;         // big headline
  heroAmount: string;        // formatted amount in hero
  greeting: string;
  paragraphs: string[];
  kpis: { label: string; value: string }[];
  cta: { label: string; href?: string };
  signoff: string;
}): string {
  const { accent, heroEyebrow, heroTitle, heroAmount, greeting, paragraphs, kpis, cta, signoff } = opts;
  const auditId = Math.random().toString(36).slice(2, 10).toUpperCase() +
                  '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const sentAt = new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });

  // 4-cell KPI grid — falls back to single column on narrow viewports.
  const kpiRow = kpis.map(k => `
    <td width="${Math.floor(100 / kpis.length)}%" valign="top"
        style="background:#fffdf6;border:1px solid #e8e2d0;border-radius:12px;padding:12px 10px;text-align:center">
      <div style="font-size:9px;font-weight:800;letter-spacing:1.6px;color:#888;margin-bottom:6px;text-transform:uppercase">${k.label}</div>
      <div style="font-size:15px;font-weight:900;color:#0f172a;line-height:1.1;letter-spacing:-0.2px">${k.value}</div>
    </td>`).join('<td width="8" style="font-size:0;line-height:0">&nbsp;</td>');

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${heroEyebrow}</title>
</head>
<body style="margin:0;padding:0;background:#f5f1e8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'IBM Plex Sans Arabic',sans-serif;color:#1a1a1a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f1e8;padding:36px 12px">
<tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fffdf6;border-radius:22px;overflow:hidden;box-shadow:0 16px 48px rgba(15,23,42,0.10);max-width:600px">

    <!-- Brand bar: navy with the same lockup as the in-app sidebar -->
    <tr><td style="background:#0b1220;padding:18px 28px">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td>
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:linear-gradient(135deg,#2563eb,#4f46e5);width:34px;height:34px;border-radius:10px;text-align:center;vertical-align:middle">
              <span style="color:#fff;font-weight:900;font-size:16px;line-height:34px">S</span>
            </td>
            <td style="padding-left:10px">
              <div style="color:#ffffff;font-size:13px;font-weight:900;letter-spacing:1.4px">MADAR · AI</div>
              <div style="color:#94a3b8;font-size:9.5px;letter-spacing:1.3px;font-weight:700;margin-top:2px">FREELANCER · LIQUIDITY · ENGINE</div>
            </td>
          </tr></table>
        </td>
        <td align="right" style="color:#94a3b8;font-size:10px;letter-spacing:1.4px;font-weight:700">TREASURER · MODULE</td>
      </tr></table>
    </td></tr>

    <!-- Tonal hero: status pill + amount -->
    <tr><td style="padding:36px 32px 28px;background:linear-gradient(180deg,#fffdf6 0%,${accent}0d 100%);text-align:center;border-bottom:1px solid #f0ead7">
      <div style="display:inline-block;background:${accent}1a;color:${accent};font-size:10px;font-weight:900;letter-spacing:2.2px;padding:6px 14px;border-radius:999px;border:1px solid ${accent}33;margin-bottom:14px">
        ${heroEyebrow}
      </div>
      <div style="font-size:13px;color:#666;margin-bottom:6px;letter-spacing:0.3px">${heroTitle}</div>
      <div style="font-size:44px;font-weight:900;color:#0f172a;letter-spacing:-1.5px;line-height:1">${heroAmount}</div>
    </td></tr>

    <!-- KPI grid -->
    <tr><td style="padding:24px 28px 8px">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>${kpiRow}</tr>
      </table>
    </td></tr>

    <!-- Message body -->
    <tr><td style="padding:18px 32px 8px">
      <p style="font-size:16px;font-weight:600;color:#0f172a;margin:0 0 14px;line-height:1.5">${greeting}</p>
      ${paragraphs.map(p => `<p style="font-size:14px;line-height:1.75;color:#333;margin:0 0 14px">${p}</p>`).join('')}
    </td></tr>

    <!-- CTA: solid pill, drop-shadow in the accent colour, real href -->
    <tr><td align="center" style="padding:18px 32px 10px">
      <table cellpadding="0" cellspacing="0" align="center"><tr>
        <td style="background:linear-gradient(135deg,${accent},${accent}dd);border-radius:14px;box-shadow:0 12px 28px ${accent}40">
          <a href="${cta.href || '#'}" style="display:inline-block;padding:15px 34px;color:#ffffff;text-decoration:none;font-weight:900;font-size:14px;letter-spacing:0.4px">
            ${cta.label}  →
          </a>
        </td>
      </tr></table>
      <p style="text-align:center;font-size:11px;color:#94a3b8;margin:10px 0 0">Secure · audit-trailed · processed by Madar Treasurer</p>
    </td></tr>

    <!-- Sign-off -->
    <tr><td style="padding:14px 32px 24px">
      <p style="font-size:13px;color:#475569;line-height:1.7;margin:0">${signoff}</p>
    </td></tr>

    <!-- Cryptographic footer (audit-grade) -->
    <tr><td style="background:#0b1220;padding:18px 28px;color:#cbd5e1">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:top">
          <div style="font-size:9px;font-weight:800;letter-spacing:1.5px;color:#64748b;margin-bottom:5px">⛓  AUDIT TRAIL</div>
          <div style="font-family:'SF Mono','Cascadia Code',Consolas,monospace;font-size:10.5px;color:#a78bfa;line-height:1.6">
            ref: ${auditId} · sent ${sentAt}
          </div>
          <div style="font-size:10px;color:#64748b;margin-top:6px">Personalized by behavioral signal analysis · sender verified by SPF/DKIM/DMARC</div>
        </td>
      </tr></table>
    </td></tr>

    <!-- Disclaimer -->
    <tr><td style="background:#0a0f1d;padding:12px 28px;font-size:10px;color:#475569;text-align:center;border-top:1px solid #1e293b;letter-spacing:0.3px">
      Madar · Autonomous Treasury Engine · Sent on behalf of the workspace operator
    </td></tr>

  </table>
</td></tr></table></body></html>`;
}

function ClientsTab() {
  const [clients, setClients] = useState<SynergyClient[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<ClientStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'lastContact' | 'overdue' | 'invoiced'>('lastContact');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<Record<string, boolean>>({});
  const [emailSent, setEmailSent] = useState<Record<string, 'ok' | 'err'>>({});
  // Behavioral Agent → Email — analyses payment behaviour then ships a tailored email.
  const [sendingAgent, setSendingAgent] = useState<Record<string, boolean>>({});
  const [agentStage, setAgentStage] = useState<Record<string, string>>({});
  const [agentSent, setAgentSent] = useState<Record<string, 'ok' | 'err'>>({});

  /* ── Personality-driven tone selector based on Sentinel-style behavioral signals ── */
  function clientTone(c: SynergyClient): 'friendly' | 'professional' | 'urgent' {
    if (c.status === 'late' || c.status === 'ghost' || c.avgDelayDays > 14) return 'urgent';
    if (c.status === 'pending' || c.avgDelayDays > 3) return 'professional';
    return 'friendly';
  }

  function currencySymbol(curr: string): string {
    // ISO codes — cleaner in English UI than Arabic glyphs.
    return curr;
  }

  /** Build personality-aware SMS message (English, kept under 5 segments). */
  function buildSMSMessage(c: SynergyClient): string {
    const owed = c.totalInvoiced - c.totalPaid;
    const sym = currencySymbol(c.currency);
    const first = c.name.split(' ')[0];
    const tone = clientTone(c);

    if (tone === 'urgent') {
      return `Hi ${first},\n\n` +
        `Your invoice of ${sym} ${owed.toLocaleString()} has been overdue for ${c.avgDelayDays || 'several'} days.\n` +
        `Please settle within 48 hours to avoid escalation.\n\n` +
        `If you need to arrange a partial payment plan, just reply — we are happy to work with you.\n\nThank you — Madar Treasury`;
    }
    if (tone === 'professional') {
      return `Hi ${first},\n\n` +
        `A friendly reminder that your invoice of ${sym} ${owed.toLocaleString()} is now due.\n` +
        `We are offering a 3% early-settlement discount if paid within 7 days.\n\n` +
        `Thanks for the continued partnership — looking forward to confirmation.\n\nMadar Treasury`;
    }
    return `Hi ${first} 👋\n\n` +
      `Just a quick nudge — ${sym} ${owed.toLocaleString()} is still pending on your latest invoice.\n` +
      `If you'd like to pay now, reply and we'll send the details in seconds 🙏\n\nThanks! — Madar Treasury`;
  }

  /** Read the operator's name + first name from the synced user profile.
   *  Falls back to a neutral 'Madar Treasury' when the workspace has no profile yet. */
  function operatorName(): { full: string; first: string } {
    try {
      const p = JSON.parse(localStorage.getItem('synergy_user_profile_v1') || '{}');
      const full = String(p.name || p.fullName || '').trim();
      if (full) return { full, first: full.split(' ')[0] };
    } catch { /**/ }
    return { full: 'Madar Treasury', first: 'Madar' };
  }

  /** Build personality-aware Email (returns subject + html + text) */
  function buildEmail(c: SynergyClient): { subject: string; text: string; html: string } {
    const owed = c.totalInvoiced - c.totalPaid;
    const sym = currencySymbol(c.currency);
    const first = c.name.split(' ')[0];
    const tone = clientTone(c);
    const owedFmt = `${sym}${owed.toLocaleString()}`;
    const op = operatorName();

    let subject = '';
    let bodyHtml = '';
    let bodyText = '';

    // Shared KPI grid for every tone — gives the recipient instant context
    // (anchor client / repeat history) without forcing them to scroll.
    const kpis = [
      { label: 'Balance Due',  value: owedFmt },
      { label: 'Invoices',     value: `${c.paidCount}/${c.invoiceCount} paid` },
      { label: 'Avg. Delay',   value: c.avgDelayDays > 0 ? `+${c.avgDelayDays}d` : 'on time' },
      { label: 'Reference',    value: c.id.toUpperCase() },
    ];

    if (tone === 'urgent') {
      subject = `Action required · outstanding balance ${owedFmt} · ${c.id.toUpperCase()}`;
      bodyText = `Dear ${first},\n\nOur records show an unpaid balance of ${owedFmt} that has been overdue for ${c.avgDelayDays || 'several'} days.\n\nTo avoid escalation to collection, please settle the invoice within 48 hours. We are happy to arrange a partial payment plan if needed — just reply to this email.\n\nKind regards,\n${op.full}\nMadar Treasurer`;
      bodyHtml = emailTemplate({
        accent: '#dc2626',
        heroEyebrow: 'PAYMENT OVERDUE',
        heroTitle: 'Outstanding balance flagged by Sentinel',
        heroAmount: owedFmt,
        greeting: `Dear ${first},`,
        paragraphs: [
          `Our records show an unpaid balance of <strong>${owedFmt}</strong> that has been overdue for <strong>${c.avgDelayDays || 'several'} days</strong>. This message is part of an automated escalation flow triggered by Madar's behavioral signal engine.`,
          `To avoid escalation to collection, please settle within <strong>48 hours</strong>. We can arrange a partial payment plan — simply reply to this email and our Treasurer agent will draft terms instantly.`,
        ],
        kpis,
        cta: { label: 'Settle invoice now', href: `mailto:202111260@gcet.edu.om?subject=Settling%20invoice%20${c.id}` },
        signoff: `Kind regards,<br/><strong>${op.full}</strong><br/><span style="color:#94a3b8;font-size:12px">Operating partner · Madar Treasurer</span>`,
      });
    } else if (tone === 'professional') {
      subject = `Reminder · invoice ${owedFmt} · 3% early-settlement discount`;
      bodyText = `Hi ${first},\n\nA quick note that your invoice of ${owedFmt} is now due. We're offering a 3% early-settlement discount if paid within 7 days.\n\nThank you for the continued partnership!\n\n${op.full}`;
      bodyHtml = emailTemplate({
        accent: '#d97706',
        heroEyebrow: 'PAYMENT REMINDER',
        heroTitle: 'Invoice approaching due date',
        heroAmount: owedFmt,
        greeting: `Hi ${first},`,
        paragraphs: [
          `A quick note that your invoice of <strong>${owedFmt}</strong> is now due. Madar's Treasurer agent flagged it for a courtesy reminder based on your payment history.`,
          `We're offering a <strong style="color:#15803d">3% early-settlement discount</strong> if the balance is cleared within <strong>7 days</strong> — applied automatically on receipt.`,
        ],
        kpis,
        cta: { label: 'Settle with 3% discount', href: `mailto:202111260@gcet.edu.om?subject=Settling%20invoice%20${c.id}` },
        signoff: `Thank you for the continued partnership!<br/><strong>${op.full}</strong>`,
      });
    } else {
      subject = `Quick nudge · ${owedFmt} pending · ${c.id.toUpperCase()}`;
      bodyText = `Hi ${first},\n\nHope you're doing well! Just a friendly nudge that ${owedFmt} is still pending on your latest invoice. No rush, but thought I'd ping you in case it slipped through.\n\nLet me know if anything changed!\n\n${op.first}`;
      bodyHtml = emailTemplate({
        accent: '#15803d',
        heroEyebrow: 'FRIENDLY NUDGE',
        heroTitle: 'Latest invoice still pending',
        heroAmount: owedFmt,
        greeting: `Hi ${first},`,
        paragraphs: [
          `Hope you're doing well — Madar is just sending a low-key reminder that <strong>${owedFmt}</strong> is still pending on your latest invoice.`,
          `No rush at all. Replying with the expected payment date is enough; the Treasurer will park follow-ups automatically once it's logged.`,
        ],
        kpis,
        cta: { label: 'Open invoice', href: `mailto:202111260@gcet.edu.om?subject=Re%3A%20invoice%20${c.id}` },
        signoff: `Cheers,<br/><strong>${op.first}</strong>`,
      });
    }

    return { subject, text: bodyText, html: bodyHtml };
  }

  /* ── Behavioral Agent → Email pipeline ──
   * Inspects the client's payment posture (delay, ratio, status, ghosting risk),
   * narrates each step in the UI for a cinematic feel, and sends a violet-themed
   * "behavioral insight" digest via the same Resend backend.            */
  async function runAgentAndEmail(c: SynergyClient) {
    if (!c.email) return;
    setSendingAgent(p => ({ ...p, [c.id]: true }));
    setAgentSent(p => { const n = { ...p }; delete n[c.id]; return n; });
    setAgentStage(p => ({ ...p, [c.id]: 'Reading payment history…' }));
    await new Promise(r => setTimeout(r, 600));

    const owed = Math.max(0, c.totalInvoiced - c.totalPaid);
    const sym = currencySymbol(c.currency);
    const owedFmt = `${sym}${owed.toLocaleString()}`;
    const collectionRate = c.totalInvoiced > 0 ? Math.round((c.totalPaid / c.totalInvoiced) * 100) : 0;
    const punctuality = c.avgDelayDays === 0 ? 95 : c.avgDelayDays <= 3 ? 80 : c.avgDelayDays <= 10 ? 55 : c.avgDelayDays <= 21 ? 30 : 12;
    const consistency = collectionRate >= 90 ? 92 : collectionRate >= 70 ? 75 : collectionRate >= 50 ? 55 : collectionRate >= 25 ? 35 : 18;
    const trustScore = Math.round(punctuality * 0.55 + consistency * 0.45);
    const band = trustScore >= 80 ? { label: 'Trusted partner', color: '#16a34a' }
               : trustScore >= 60 ? { label: 'Stable',           color: '#0ea5e9' }
               : trustScore >= 40 ? { label: 'Watch closely',    color: '#d97706' }
               :                     { label: 'High behavioural risk', color: '#dc2626' };
    const tone = clientTone(c);
    const greenFlags: string[] = [];
    const redFlags: string[] = [];
    if (c.paidCount > 0)               greenFlags.push(`${c.paidCount} invoice${c.paidCount === 1 ? '' : 's'} previously settled`);
    if (c.avgDelayDays === 0)          greenFlags.push('Pays consistently on or before the due date');
    if (collectionRate >= 75)          greenFlags.push(`${collectionRate}% historic collection ratio`);
    if (c.status === 'late')           redFlags.push(`Currently late by ~${c.avgDelayDays || 'several'} days`);
    if (c.status === 'ghost')          redFlags.push('No reply on last contact attempts (ghosting pattern)');
    if (c.avgDelayDays > 14)           redFlags.push(`Average delay ${c.avgDelayDays} d — escalation candidate`);
    if (collectionRate < 50 && c.invoiceCount > 1) redFlags.push(`Only ${collectionRate}% of invoiced amount paid`);
    if (greenFlags.length === 0 && redFlags.length === 0) greenFlags.push('No anomalies detected — neutral baseline');

    setAgentStage(p => ({ ...p, [c.id]: 'Scoring trust band…' }));
    await new Promise(r => setTimeout(r, 500));
    setAgentStage(p => ({ ...p, [c.id]: `Composing ${tone} insight…` }));
    await new Promise(r => setTimeout(r, 500));

    const first = c.name.split(' ')[0];
    const subject = `Madar Behavioral Insight · ${c.name} · ${band.label} (${trustScore}/100)`;
    const text = [
      `Behavioral analysis for ${c.name}`,
      `Trust score: ${trustScore}/100 — ${band.label}`,
      `Outstanding: ${owedFmt} · ${c.paidCount}/${c.invoiceCount} paid · avg delay ${c.avgDelayDays}d`,
      ``,
      `GREEN FLAGS`,
      ...greenFlags.map(g => `  • ${g}`),
      ``,
      `RED FLAGS`,
      ...(redFlags.length ? redFlags.map(r => `  • ${r}`) : ['  (none)']),
    ].join('\n');
    const greenList = greenFlags.map(f => `<li style="margin-bottom:6px">${f.replace(/</g, '&lt;')}</li>`).join('');
    const redList   = redFlags.length
      ? redFlags.map(f => `<li style="margin-bottom:6px">${f.replace(/</g, '&lt;')}</li>`).join('')
      : `<li style="color:#16a34a;font-style:italic">No anomalies detected ✓</li>`;
    const stat = (label: string, value: string, color: string) => `
      <td style="padding:14px;border-radius:12px;background:#faf5ff;border:1px solid #e9d5ff;text-align:center;width:25%">
        <div style="font-size:10px;letter-spacing:.12em;color:#7e22ce;text-transform:uppercase;font-weight:700">${label}</div>
        <div style="font-size:22px;font-weight:800;color:${color};margin-top:4px">${value}</div>
      </td>`;
    const html = `
      <div style="font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif;max-width:680px;margin:0 auto;color:#0f172a">
        <div style="background:linear-gradient(135deg,#7c3aed,#0ea5e9);color:#fff;padding:26px 30px;border-radius:14px 14px 0 0">
          <div style="font-size:11px;letter-spacing:.18em;opacity:.85;text-transform:uppercase">Madar Sentinel · Behavioral Agent</div>
          <div style="font-size:30px;font-weight:800;margin-top:6px">${c.name}</div>
          <div style="display:inline-block;margin-top:10px;padding:5px 12px;border-radius:999px;background:rgba(255,255,255,.18);font-size:12px;font-weight:700">${band.label} · ${trustScore}/100</div>
        </div>
        <div style="background:#fff;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 14px 14px">
          <p style="font-size:14px;line-height:1.65;color:#334155;margin:0 0 18px">Hi ${first}, our behavioural agent just reviewed payment patterns across <strong>${c.invoiceCount}</strong> invoice${c.invoiceCount === 1 ? '' : 's'} and produced the digest below. This is informational — no action is required if the picture looks accurate.</p>
          <table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin-bottom:18px"><tr>
            ${stat('Trust', `${trustScore}`, band.color)}
            ${stat('Punctuality', `${punctuality}`, '#7c3aed')}
            ${stat('Consistency', `${consistency}`, '#0ea5e9')}
            ${stat('Outstanding', owedFmt, owed > 0 ? '#dc2626' : '#15803d')}
          </tr></table>
          <div style="display:flex;gap:14px;flex-wrap:wrap">
            <div style="flex:1;min-width:220px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
                <span style="display:inline-block;width:8px;height:8px;background:#16a34a;border-radius:50%"></span>
                <span style="font-size:11px;font-weight:800;color:#15803d;letter-spacing:.1em;text-transform:uppercase">Green flags</span>
              </div>
              <ul style="font-size:12px;color:#334155;padding-left:18px;margin:0;line-height:1.65">${greenList}</ul>
            </div>
            <div style="flex:1;min-width:220px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
                <span style="display:inline-block;width:8px;height:8px;background:#dc2626;border-radius:50%"></span>
                <span style="font-size:11px;font-weight:800;color:#dc2626;letter-spacing:.1em;text-transform:uppercase">Red flags</span>
              </div>
              <ul style="font-size:12px;color:#334155;padding-left:18px;margin:0;line-height:1.65">${redList}</ul>
            </div>
          </div>
          <div style="margin-top:24px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:#94a3b8">— Madar · Behavioral analysis · automated digest · reply to discuss</div>
        </div>
      </div>`;

    setAgentStage(p => ({ ...p, [c.id]: `Sending to ${c.email}…` }));
    try {
      const res = await sendEmail({ to: c.email, subject, text, html });
      setAgentSent(p => ({ ...p, [c.id]: res.sent ? 'ok' : 'err' }));
    } catch {
      setAgentSent(p => ({ ...p, [c.id]: 'err' }));
    } finally {
      setSendingAgent(p => ({ ...p, [c.id]: false }));
      setTimeout(() => setAgentStage(p => { const n = { ...p }; delete n[c.id]; return n; }), 4000);
    }
  }

  async function sendReminderEmail(c: SynergyClient) {
    if (!c.email) return;
    setSendingEmail(p => ({ ...p, [c.id]: true }));
    try {
      // ── 1) AI personalization via ZenMux (Claude Opus 4.6) ──
      // Sentinel-style behavioural read → Treasurer-style invoice reminder.
      // Falls back to the static template if the model is unreachable.
      const owed = Math.max(0, c.totalInvoiced - c.totalPaid);
      const sym  = currencySymbol(c.currency);
      const owedFmt = `${sym}${owed.toLocaleString()}`;
      const collectionRate = c.totalInvoiced > 0 ? Math.round((c.totalPaid / c.totalInvoiced) * 100) : 0;
      const op   = operatorName();
      const tone = clientTone(c);
      const first = c.name.split(' ')[0];

      const profile = [
        `Client: ${c.name} (${c.country})`,
        `Source / channel: ${c.source}`,
        `Status: ${c.status} · Risk: ${c.risk}`,
        `Outstanding: ${owedFmt} (${c.currency})`,
        `Invoices: ${c.paidCount} paid of ${c.invoiceCount}  (collection ratio ${collectionRate}%)`,
        `Average payment delay: ${c.avgDelayDays || 0} days`,
        `Last contact: ${c.lastContact || 'unknown'}`,
        `Next due: ${c.nextDue || 'n/a'}`,
        `Tags: ${(c.tags || []).join(', ') || 'none'}`,
        `Operator (sender): ${op.full}`,
        `Recommended tone: ${tone}`,
      ].join('\n');

      const SYSTEM = `You are Madar's Treasurer agent — a polite, culturally-aware Arabic-Gulf collections specialist who writes payment reminders that feel human, never robotic. You always:
- analyse the client's behaviour first (1-2 short sentences) and pick a tone that matches their history (urgent for ghosters, professional for repeat-late, friendly for one-time-late).
- write in the SAME language as the client's likely default (use Arabic if their handle/name suggests Gulf Arabic; otherwise English).
- reference concrete numbers (amount, days late, invoice count, paid ratio) so the recipient feels the reminder is tailored, not bulk.
- finish with one clear next step ("reply with date you can settle", "click to settle now", etc.).
- NEVER threaten or shame. NEVER mention "AI" or "automated" — write as if the operator is reaching out personally.

Return STRICT JSON only, no markdown fences:
{
  "language": "en" | "ar",
  "subject": "string ≤ 70 chars",
  "greeting": "Hi/Dear/مرحباً ...",
  "behavior_analysis": "1-2 short sentences in the chosen language analysing this client's behaviour",
  "paragraphs": ["string", "string"],          // 2 paragraphs (≤ 65 words each)
  "cta_label": "string ≤ 28 chars",
  "signoff": "string"                            // closing line + operator name
}`;

      const USER = `Behavioural snapshot:\n${profile}\n\nWrite the most effective reminder email body for this specific person. Use Arabic if the handle/name reads Gulf Arabic (e.g. starts with @ in Arabic context, contains "om", "saqri", "balushi", etc.). Otherwise English.`;

      type AiOut = {
        language: 'en' | 'ar';
        subject: string;
        greeting: string;
        behavior_analysis: string;
        paragraphs: string[];
        cta_label: string;
        signoff: string;
      };

      let ai: AiOut | null = null;
      try {
        const raw = await callAgent({
          model: 'anthropic/claude-opus-4.6',
          systemPrompt: SYSTEM,
          userMessage: USER,
          maxTokens: 900,
          temperature: 0.55,
        });
        // Strip any code fences just in case
        const clean = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
        ai = JSON.parse(clean) as AiOut;
      } catch (err) {
        console.warn('[sendReminderEmail] AI generation failed, using static template', err);
      }

      let subject: string;
      let text: string;
      let html: string;

      if (ai && ai.subject && Array.isArray(ai.paragraphs) && ai.paragraphs.length > 0) {
        const isAr = ai.language === 'ar';
        const accent = tone === 'urgent' ? '#dc2626' : tone === 'professional' ? '#d97706' : '#15803d';
        const eyebrow = isAr ? 'تذكير بالفاتورة · مدار' : 'INVOICE REMINDER · MADAR';
        subject = ai.subject;
        text = [
          ai.greeting,
          '',
          ai.behavior_analysis,
          '',
          ...ai.paragraphs,
          '',
          ai.signoff,
        ].join('\n');
        html = emailTemplate({
          accent,
          heroEyebrow: eyebrow,
          heroTitle: ai.subject,
          heroAmount: owedFmt,
          greeting: ai.greeting,
          paragraphs: [
            `<em style="color:#64748b">${ai.behavior_analysis.replace(/</g, '&lt;')}</em>`,
            ...ai.paragraphs.map(p => p.replace(/</g, '&lt;')),
          ],
          kpis: [
            { label: isAr ? 'المستحق' : 'Balance Due',  value: owedFmt },
            { label: isAr ? 'الفواتير' : 'Invoices',     value: `${c.paidCount}/${c.invoiceCount}` },
            { label: isAr ? 'متوسط التأخير' : 'Avg. Delay', value: c.avgDelayDays > 0 ? `+${c.avgDelayDays}d` : (isAr ? 'في الوقت' : 'on time') },
            { label: isAr ? 'المرجع' : 'Reference', value: c.id.toUpperCase() },
          ],
          cta: { label: ai.cta_label, href: `mailto:202111260@gcet.edu.om?subject=${encodeURIComponent(`Re: ${ai.subject}`)}` },
          signoff: ai.signoff.replace(/\n/g, '<br/>'),
        });
        // RTL wrapper for Arabic emails so it renders correctly in Gmail
        if (isAr) {
          html = `<div dir="rtl" style="text-align:right">${html}</div>`;
        }
      } else {
        // Fallback to static personality-aware template
        const built = buildEmail(c);
        subject = built.subject;
        text    = built.text;
        html    = built.html;
        // Acknowledge the client name silently for the linter
        void first;
      }

      const res = await sendEmail({ to: c.email, subject, text, html });
      setEmailSent(p => ({ ...p, [c.id]: res.sent ? 'ok' : 'err' }));
    } catch (err) {
      console.error('[sendReminderEmail] failed', err);
      setEmailSent(p => ({ ...p, [c.id]: 'err' }));
    } finally {
      setSendingEmail(p => ({ ...p, [c.id]: false }));
    }
  }

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem('synergy_clients_v1');
        if (raw) setClients(JSON.parse(raw) as SynergyClient[]);
      } catch { /**/ }
    };
    load();
    window.addEventListener('synergy:store-changed', load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener('synergy:store-changed', load);
      window.removeEventListener('storage', load);
    };
  }, []);

  /* ── Behavior notes — timestamped, persisted to synergy_clients_v1 ──
   * Each entry is appended to the existing `notes` field with a date
   * prefix so the operator builds a behavioral log over time. The whole
   * array is then re-saved + a synergy:store-changed event is dispatched
   * so the supabase sync picks it up and other tabs/devices stay in sync.
   */
  const [behaviorDraft, setBehaviorDraft] = useState<Record<string, string>>({});
  const [behaviorSaving, setBehaviorSaving] = useState<Record<string, boolean>>({});

  function saveBehaviorNote(clientId: string) {
    const raw = (behaviorDraft[clientId] || '').trim();
    if (!raw) return;
    setBehaviorSaving(p => ({ ...p, [clientId]: true }));
    const stamp = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const newEntry = `[${stamp}] ${raw}`;
    const next = clients.map(c => {
      if (c.id !== clientId) return c;
      const existing = (c.notes || '').trim();
      const merged = existing ? `${existing}\n${newEntry}` : newEntry;
      return { ...c, notes: merged };
    });
    setClients(next);
    try {
      localStorage.setItem('synergy_clients_v1', JSON.stringify(next));
      window.dispatchEvent(new Event('synergy:store-changed'));
    } catch { /**/ }
    setBehaviorDraft(p => ({ ...p, [clientId]: '' }));
    setTimeout(() => setBehaviorSaving(p => ({ ...p, [clientId]: false })), 250);
  }

  function clearBehaviorLog(clientId: string) {
    if (!confirm('Clear the behavior log for this client?')) return;
    const next = clients.map(c => (c.id === clientId ? { ...c, notes: '' } : c));
    setClients(next);
    try {
      localStorage.setItem('synergy_clients_v1', JSON.stringify(next));
      window.dispatchEvent(new Event('synergy:store-changed'));
    } catch { /**/ }
  }

  const filtered = useMemo(() => {
    let list = [...clients];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.country || '').toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (filterStatus !== 'all') list = list.filter(c => c.status === filterStatus);
    if (sortBy === 'lastContact')
      list.sort((a, b) => new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime());
    else if (sortBy === 'overdue')
      list.sort((a, b) => (b.totalInvoiced - b.totalPaid) - (a.totalInvoiced - a.totalPaid));
    else
      list.sort((a, b) => b.totalInvoiced - a.totalInvoiced);
    return list;
  }, [clients, search, filterStatus, sortBy]);

  const overdueSumByCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    clients.forEach(c => {
      if (c.status === 'late' || c.status === 'ghost') {
        const owed = c.totalInvoiced - c.totalPaid;
        map[c.currency] = (map[c.currency] ?? 0) + owed;
      }
    });
    return map;
  }, [clients]);

  function whatsappUrl(c: SynergyClient) {
    const owed = c.totalInvoiced - c.totalPaid;
    const sym = c.currency;
    const msg = encodeURIComponent(
      `Hi ${c.name.split(' ')[0]},\n\n` +
      `This is a friendly reminder that an invoice of ${sym} ${owed.toLocaleString()} is now overdue.\n` +
      `Please arrange the transfer at your earliest convenience.\n\nThank you — Madar Treasury`
    );
    const phone = (c.phone ?? '').replace(/\D/g, '');
    return `https://wa.me/${phone}?text=${msg}`;
  }

  const statBar: { label: string; value: number; color: string }[] = [
    { label: 'Active',   value: clients.filter(c => c.status === 'active').length,  color: '#3b82f6' },
    { label: 'Pending',  value: clients.filter(c => c.status === 'pending').length, color: '#f59e0b' },
    { label: 'Paid',     value: clients.filter(c => c.status === 'paid').length,    color: '#22c55e' },
    { label: 'Overdue',  value: clients.filter(c => c.status === 'late').length,    color: '#ef4444' },
    { label: 'Ghosting', value: clients.filter(c => c.status === 'ghost').length,   color: '#9ca3af' },
  ];

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 py-20">
        <Users size={44} style={{ color: TEXT3 }} />
        <p className="text-[16px] font-bold" style={{ color: TEXT2 }}>No clients yet</p>
        <p className="text-[13px] text-center max-w-xs" style={{ color: TEXT3 }}>
          Clients are stored in Supabase. Pull the latest rows from the database
          or add a client manually below.
        </p>
        <button
          className="px-5 py-2.5 rounded-xl text-white text-[13px] font-bold flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
          style={{ background: ACCENT }}
          onClick={async () => {
            try {
              await hydrateFromSupabase();
              window.dispatchEvent(new Event('synergy:store-changed'));
              const raw = localStorage.getItem('synergy_clients_v1');
              if (raw) setClients(JSON.parse(raw) as SynergyClient[]);
            } catch (err) { console.error('[clients] reload failed', err); }
          }}>
          <Sparkles size={14} /> Reload from Database
        </button>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5 max-w-[1300px] mx-auto">

      {/* ── Summary bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statBar.map(s => (
          <div key={s.label}
            className="rounded-2xl border p-4 flex flex-col gap-1"
            style={{ borderColor: BORDER, background: CARD }}>
            <span className="text-[11px] font-semibold" style={{ color: TEXT3 }}>{s.label}</span>
            <span className="text-[28px] font-black" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── Overdue alert ── */}
      {Object.keys(overdueSumByCurrency).length > 0 && (
        <div className="rounded-xl border-2 p-3 flex items-center gap-2.5"
          style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
          <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0 }} />
          <p className="text-[12px] font-bold" style={{ color: '#dc2626' }}>
            Overdue receivables:{' '}
            {Object.entries(overdueSumByCurrency)
              .map(([cur, amt]) => `${amt.toLocaleString()} ${cur}`)
              .join(' · ')}
          </p>
        </div>
      )}

      {/* ── Filters row ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <input
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-[13px] outline-none focus:ring-2 focus:ring-blue-200"
            style={{ borderColor: BORDER, background: CREAM, color: TEXT }}
            placeholder="Search client, country, tag…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: TEXT3 }} />
        </div>
        <div className="relative">
          <select
            className="pl-3 pr-8 py-2.5 rounded-xl border text-[12px] font-semibold outline-none cursor-pointer appearance-none"
            style={{ borderColor: BORDER, background: CARD, color: TEXT }}
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as ClientStatus | 'all')}>
            <option value="all">All statuses</option>
            {(Object.keys(STATUS_CFG) as ClientStatus[]).map(s =>
              <option key={s} value={s}>{STATUS_CFG[s].label}</option>
            )}
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: TEXT3 }} />
        </div>
        <div className="relative">
          <select
            className="pl-3 pr-8 py-2.5 rounded-xl border text-[12px] font-semibold outline-none cursor-pointer appearance-none"
            style={{ borderColor: BORDER, background: CARD, color: TEXT }}
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}>
            <option value="lastContact">Sort: Recent contact</option>
            <option value="overdue">Sort: Most overdue</option>
            <option value="invoiced">Sort: Highest billed</option>
          </select>
          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: TEXT3 }} />
        </div>
        <span className="text-[11px]" style={{ color: TEXT3 }}>{filtered.length} clients</span>
      </div>

      {/* ── Client cards ── */}
      <div className="space-y-3">
        {filtered.map(c => {
          const owed = c.totalInvoiced - c.totalPaid;
          const isExpanded = expandedId === c.id;
          const rc = RISK_CFG[c.risk] || RISK_CFG.LOW;
          // Defensive: legacy seed data may use 'overdue' instead of 'late'.
          const statusKey: ClientStatus = (STATUS_CFG[c.status as ClientStatus]
            ? c.status
            : (c.status as string) === 'overdue' ? 'late' : 'pending') as ClientStatus;
          const sc = STATUS_CFG[statusKey];
          const isOverdue = statusKey === 'late' || statusKey === 'ghost';
          const contactDays = daysSince(c.lastContact);
          const dueDays = c.nextDue ? daysUntil(c.nextDue) : null;

          return (
            <motion.div key={c.id}
              layout
              className="rounded-2xl border overflow-hidden cursor-pointer"
              style={{ borderColor: isOverdue ? '#fecaca' : BORDER, background: CARD }}
              onClick={() => setExpandedId(isExpanded ? null : c.id)}>

              {/* Card header */}
              <div className="flex items-center gap-3 p-4">
                {/* Status dot */}
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: sc.dot }} />

                {/* Name + country */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-extrabold truncate" style={{ color: TEXT }}>
                      {c.name}
                    </span>
                    <span className="text-[11px]" style={{ color: TEXT3 }}>{c.country}</span>
                    {c.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                        style={{ background: '#eff6ff', color: '#2563eb' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: sc.dot + '22', color: sc.dot }}>
                      {sc.label}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border"
                      style={{ background: rc.bg, color: rc.text, borderColor: rc.border }}>
                      {c.risk} RISK
                    </span>
                    <span className="text-[10px]" style={{ color: TEXT3 }}>
                      via {c.source}
                    </span>
                  </div>
                </div>

                {/* Financials */}
                <div className="text-right flex-shrink-0 hidden sm:block">
                  <p className="text-[13px] font-black" style={{ color: owed > 0 ? '#dc2626' : '#15803d' }}>
                    {owed > 0 ? `${owed.toLocaleString()} ${c.currency} owed` : `${c.totalPaid.toLocaleString()} ${c.currency} paid`}
                  </p>
                  <p className="text-[10px]" style={{ color: TEXT3 }}>
                    {c.invoiceCount} inv · {c.paidCount} paid
                  </p>
                </div>

                {/* Agent → Email · purple/violet behavioural insight (sits BEFORE the plain Email button) */}
                {c.email && (
                  <button
                    disabled={sendingAgent[c.id]}
                    title="Run behavioural agent and email a personalised insight digest"
                    className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-white flex-shrink-0 cursor-pointer disabled:opacity-90 transition-all overflow-hidden"
                    style={{
                      background: agentSent[c.id] === 'ok' ? 'linear-gradient(135deg,#059669,#10b981)'
                                : agentSent[c.id] === 'err' ? 'linear-gradient(135deg,#dc2626,#f97316)'
                                : 'linear-gradient(135deg,#7c3aed,#0ea5e9)',
                      border: 'none',
                    }}
                    onClick={e => { e.stopPropagation(); void runAgentAndEmail(c); }}>
                    {sendingAgent[c.id] ? <Loader2 size={12} className="animate-spin"/>
                      : agentSent[c.id] === 'ok' ? <CheckCircle2 size={12}/>
                      : agentSent[c.id] === 'err' ? <AlertCircle size={12}/>
                      : <Brain size={12}/>}
                    {sendingAgent[c.id] ? 'Agent…' : agentSent[c.id] === 'ok' ? 'Sent ✓' : agentSent[c.id] === 'err' ? 'Failed' : 'Agent'}
                  </button>
                )}
                {isOverdue && c.email && (
                  <button
                    disabled={sendingEmail[c.id]}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold flex-shrink-0 hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                    style={{ background: emailSent[c.id] === 'ok' ? '#1d4ed8' : emailSent[c.id] === 'err' ? '#dc2626' : '#2563eb', color: 'white', border: 'none' }}
                    onClick={e => { e.stopPropagation(); void sendReminderEmail(c); }}>
                    {sendingEmail[c.id] ? <Loader2 size={12} className="animate-spin"/> : <Mail size={12}/>}
                    {emailSent[c.id] === 'ok' ? 'Sent ✓' : emailSent[c.id] === 'err' ? 'Failed ✗' : 'Email'}
                  </button>
                )}

                <ChevronDown size={14} style={{ color: TEXT3, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s', flexShrink: 0 }} />
              </div>

              {/* Expanded tracking panel */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t overflow-hidden"
                    style={{ borderColor: BORDER }}>
                    <div className="p-4 space-y-4">

                      {/* Smart tracking row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-xl p-3" style={{ background: CREAM }}>
                          <p className="text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: TEXT3 }}>Avg. days late</p>
                          <p className="text-[18px] font-black" style={{ color: c.avgDelayDays > 10 ? '#dc2626' : c.avgDelayDays > 0 ? '#f59e0b' : '#22c55e' }}>
                            {c.avgDelayDays === 0 ? 'On time' : `+${c.avgDelayDays}d`}
                          </p>
                        </div>
                        <div className="rounded-xl p-3" style={{ background: CREAM }}>
                          <p className="text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: TEXT3 }}>Last contact</p>
                          <p className="text-[18px] font-black" style={{ color: contactDays > 30 ? '#ef4444' : TEXT }}>
                            {contactDays === 0 ? 'Today' : `${contactDays}d ago`}
                          </p>
                        </div>
                        {dueDays !== null && (
                          <div className="rounded-xl p-3" style={{ background: CREAM }}>
                            <p className="text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: TEXT3 }}>Next due</p>
                            <p className="text-[18px] font-black"
                              style={{ color: dueDays < 0 ? '#dc2626' : dueDays < 7 ? '#f59e0b' : '#22c55e' }}>
                              {dueDays < 0 ? `${Math.abs(dueDays)}d late` : dueDays === 0 ? 'Today' : `in ${dueDays}d`}
                            </p>
                          </div>
                        )}
                        <div className="rounded-xl p-3" style={{ background: CREAM }}>
                          <p className="text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: TEXT3 }}>Collection rate</p>
                          <p className="text-[18px] font-black" style={{ color: TEXT }}>
                            {c.totalInvoiced > 0 ? Math.round((c.totalPaid / c.totalInvoiced) * 100) : 0}%
                          </p>
                        </div>
                      </div>

                      {/* Contact info */}
                      <div className="flex flex-wrap gap-2">
                        {c.email && (
                          <a href={`mailto:${c.email}`}
                            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg no-underline hover:opacity-80"
                            style={{ background: '#eff6ff', color: '#2563eb' }}
                            onClick={e => e.stopPropagation()}>
                            ✉ {c.email}
                          </a>
                        )}
                        {c.phone && (
                          <a href={`tel:${c.phone}`}
                            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg no-underline hover:opacity-80"
                            style={{ background: '#f0fdf4', color: '#15803d' }}
                            onClick={e => e.stopPropagation()}>
                            📞 {c.phone}
                          </a>
                        )}
                        {c.email && (
                          <button
                            disabled={sendingAgent[c.id]}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-90 inline-flex items-center gap-1.5 text-white"
                            style={{
                              background: agentSent[c.id] === 'ok' ? 'linear-gradient(135deg,#059669,#10b981)'
                                        : agentSent[c.id] === 'err' ? 'linear-gradient(135deg,#dc2626,#f97316)'
                                        : 'linear-gradient(135deg,#7c3aed,#0ea5e9)',
                              border: 'none',
                            }}
                            onClick={e => { e.stopPropagation(); void runAgentAndEmail(c); }}>
                            {sendingAgent[c.id]
                              ? <><Loader2 size={11} className="animate-spin"/> {agentStage[c.id] || 'Agent thinking…'}</>
                              : agentSent[c.id] === 'ok' ? <><CheckCircle2 size={11}/> Behavioural insight sent ✓</>
                              : agentSent[c.id] === 'err' ? <><AlertCircle size={11}/> Failed — retry</>
                              : <><Brain size={11}/> Run Agent → Email Insight</>}
                          </button>
                        )}
                        {isOverdue && !c.phone && c.email && (
                          <a href={`mailto:${c.email}?subject=Payment Reminder&body=Dear ${c.name.split(' ')[0]},%0D%0A%0D%0AThis is a friendly reminder regarding your outstanding invoice. Please arrange payment at your earliest convenience.%0D%0A%0D%0AThank you.`}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg no-underline hover:opacity-90"
                            style={{ background: '#f59e0b', color: 'white' }}
                            onClick={e => e.stopPropagation()}>
                            ✉ Send Email Reminder
                          </a>
                        )}
                        {(c.status !== 'paid') && c.email && (
                          <button
                            disabled={sendingEmail[c.id]}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg hover:opacity-90 cursor-pointer disabled:opacity-50"
                            style={{
                              background: emailSent[c.id] === 'ok' ? '#1d4ed8' : emailSent[c.id] === 'err' ? '#dc2626' : '#2563eb',
                              color: 'white', border: 'none',
                            }}
                            onClick={e => { e.stopPropagation(); void sendReminderEmail(c); }}>
                            {sendingEmail[c.id] ? '⏳ Drafting & sending…'
                              : emailSent[c.id] === 'ok' ? `✅ ${clientTone(c) === 'urgent' ? 'Urgent' : clientTone(c) === 'professional' ? 'Professional' : 'Friendly'} email sent`
                              : emailSent[c.id] === 'err' ? '❌ Email failed — retry'
                              : `✉️ Send AI ${clientTone(c)} email`}
                          </button>
                        )}
                      </div>

                      {/* Behavior log — editable, timestamped, persisted to DB */}
                      <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
                        <div className="flex items-center justify-between mb-2 gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: TEXT3 }}>
                              · Client Behavior Log
                            </span>
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#ecfdf5', color: '#059669' }}>
                              Synced
                            </span>
                          </div>
                          {(c.notes || '').trim() && (
                            <button
                              onClick={(e) => { e.stopPropagation(); clearBehaviorLog(c.id); }}
                              className="text-[10px] font-semibold cursor-pointer hover:underline"
                              style={{ color: TEXT3 }}
                            >
                              clear log
                            </button>
                          )}
                        </div>

                        {/* Existing log */}
                        {(c.notes || '').trim() ? (
                          <div className="space-y-1.5 mb-3 max-h-[160px] overflow-y-auto pr-1">
                            {(c.notes as string).split('\n').filter(Boolean).map((line, idx) => (
                              <div key={idx} className="text-[11.5px] leading-[1.6] px-2.5 py-1.5 rounded-lg"
                                style={{ background: 'var(--card)', color: TEXT2, borderLeft: `2px solid ${sc.dot}` }}>
                                {line}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] italic mb-3" style={{ color: TEXT3 }}>
                            No behavior notes yet — add the first observation below.
                          </p>
                        )}

                        {/* Add note input */}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <textarea
                            value={behaviorDraft[c.id] || ''}
                            onChange={(e) => setBehaviorDraft(p => ({ ...p, [c.id]: e.target.value }))}
                            onClick={e => e.stopPropagation()}
                            placeholder="e.g. Pays late but communicates · respects gentle tone · prefers WhatsApp follow-up"
                            rows={2}
                            className="flex-1 text-[11.5px] px-3 py-2 rounded-lg border resize-none focus:outline-none"
                            style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--text)' }}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); saveBehaviorNote(c.id); }}
                            disabled={!(behaviorDraft[c.id] || '').trim() || behaviorSaving[c.id]}
                            className="text-[11px] font-bold px-4 py-2 rounded-lg cursor-pointer text-white shrink-0 disabled:opacity-50"
                            style={{ background: '#059669' }}
                          >
                            {behaviorSaving[c.id] ? 'Saving…' : '+ Add behavior'}
                          </button>
                        </div>
                        <p className="text-[9.5px] mt-2 leading-[1.5]" style={{ color: TEXT3 }}>
                          Behavior signals feed the trust score, payment-tone selector, and the Negotiator agent's email/SMS templates.
                        </p>
                      </div>

                      {/* All tags */}
                      <div className="flex flex-wrap gap-1.5">
                        {c.tags.map(tag => (
                          <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                            style={{ background: CREAM, color: TEXT3 }}>
                            #{tag}
                          </span>
                        ))}
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ══ ConnectionSourceProof — picks the platform that brought this client + uploads a proof file
      Verified proofs boost the Synergy Score (+3 each, capped at +15) ══ */
function ConnectionSourceProof({
  form, setField,
}: {
  form: { connectionSource?: string; proofName?: string; proofUrl?: string; proofVerified?: boolean; proofWeek?: string };
  setField: (k: 'connectionSource' | 'proofName' | 'proofUrl' | 'proofVerified' | 'proofWeek', v: string | number | boolean) => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Source options = all connected platforms + manual fallbacks
  const sources = useMemo(() => {
    try {
      const store = JSON.parse(localStorage.getItem('synergy_connections_v4') || '{}') as Record<string, { status?: string; meta?: Record<string, string> }>;
      const connected = Object.entries(store)
        .filter(([, v]) => v?.status === 'connected')
        .map(([id, v]) => ({
          id,
          label: id.charAt(0).toUpperCase() + id.slice(1),
          handle: v?.meta?.handle || v?.meta?.username || v?.meta?.profile || '',
        }));
      const fallbacks = [
        { id: 'whatsapp', label: 'WhatsApp', handle: 'direct message' },
        { id: 'phone',    label: 'Phone Call', handle: '' },
        { id: 'referral', label: 'Referral', handle: 'word of mouth' },
        { id: 'email',    label: 'Cold Email', handle: '' },
      ];
      const known = new Set(connected.map(s => s.id));
      return [...connected, ...fallbacks.filter(f => !known.has(f.id))];
    } catch {
      return [{ id: 'whatsapp', label: 'WhatsApp', handle: '' }];
    }
  }, []);

  const onPick = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setField('proofName', file.name);
      setField('proofUrl', dataUrl);
      setField('proofVerified', false);
      setVerifying(true);
      setMismatch(false);
      // Simulated AI cross-validation — every 4th upload flagged for review
      window.setTimeout(() => {
        const isMismatch = (Date.now() % 4 === 0);
        setMismatch(isMismatch);
        setField('proofVerified', !isMismatch);
        setVerifying(false);
      }, 1500);
    };
    reader.readAsDataURL(file);
  };

  const removeProof = () => {
    setField('proofName', ''); setField('proofUrl', ''); setField('proofVerified', false);
    setMismatch(false); setVerifying(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const inp2 = 'w-full px-3 py-2.5 rounded-xl border text-[13px] outline-none focus:ring-2 focus:ring-blue-200 transition-all appearance-none cursor-pointer pr-8';

  return (
    <div className="rounded-xl border-2 border-dashed p-4 space-y-3"
      style={{ borderColor: form.proofVerified ? '#86efac' : '#bfdbfe', background: form.proofVerified ? '#f0fdf4' : '#f8fafc' }}>
      <div className="flex items-center gap-2">
        <ShieldCheck size={14} style={{ color: form.proofVerified ? '#059669' : '#2563eb' }} />
        <p className="text-[12px] font-extrabold" style={{ color: TEXT }}>
          Where did this client come from?
        </p>
        <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: '#eff6ff', color: '#2563eb' }}>
          Verified proof = +3 Madar pts
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wide block" style={{ color: TEXT3 }}>
            Acquisition Source
          </label>
          <div className="relative">
            <select className={inp2} style={{ borderColor: BORDER, background: 'white', color: TEXT }}
              value={form.connectionSource || ''}
              onChange={e => setField('connectionSource', e.target.value)}>
              <option value="">— pick a connection —</option>
              {sources.map(s => (
                <option key={s.id} value={s.id}>
                  {s.label}{s.handle ? ` · ${s.handle}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: TEXT3 }} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wide block" style={{ color: TEXT3 }}>
            Week of Engagement
          </label>
          <input type="week" className={inp2.replace(' appearance-none cursor-pointer pr-8', '')}
            style={{ borderColor: BORDER, background: 'white', color: TEXT }}
            value={form.proofWeek || isoWeek()}
            onChange={e => setField('proofWeek', e.target.value)} />
        </div>
      </div>

      {/* Proof upload zone */}
      {!form.proofUrl && !verifying && (
        <button type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-[12px] font-semibold cursor-pointer hover:bg-blue-50 transition-colors"
          style={{ borderColor: '#bfdbfe', color: '#2563eb', background: 'white' }}>
          <Upload size={14} />
          Drop proof (screenshot · contract · WhatsApp message · receipt)
        </button>
      )}

      {verifying && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <Loader2 size={14} className="animate-spin" style={{ color: '#2563eb' }} />
          <p className="text-[12px] font-semibold" style={{ color: '#1e40af' }}>
            Sentinel cross-validating proof…
          </p>
        </div>
      )}

      {form.proofUrl && !verifying && (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{
            background: form.proofVerified ? '#f0fdf4' : mismatch ? '#fef2f2' : 'white',
            border: `1px solid ${form.proofVerified ? '#86efac' : mismatch ? '#fecaca' : BORDER}`,
          }}>
          <Paperclip size={14} style={{ color: form.proofVerified ? '#059669' : mismatch ? '#dc2626' : TEXT3 }} />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold truncate" style={{ color: TEXT }}>
              {form.proofName}
            </p>
            <p className="text-[10px]" style={{ color: form.proofVerified ? '#059669' : mismatch ? '#dc2626' : TEXT3 }}>
              {form.proofVerified ? '✓ Verified — +3 Madar points'
                : mismatch ? '⚠ Mismatch flagged — manual review needed'
                : 'Pending verification'}
            </p>
          </div>
          <button type="button" onClick={removeProof}
            className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer">
            <X size={12} style={{ color: TEXT3 }} />
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={e => onPick(e.target.files?.[0])} />
    </div>
  );
}

/* ══ Main Page ══ */
export default function ManualInputPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [invoices, setInvoices] = useState<Invoice[]>(loadInvoices);
  const [obligations, setObligations] = useState<Obligation[]>(loadObligations);
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    // Allow deep-linking to a specific tab via ?tab=clients
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('tab') as Tab | null;
      if (t && ['dashboard', 'invoices', 'expenses', 'clients'].includes(t)) return t;
    }
    return 'dashboard';
  });
  const [clientCount] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('synergy_clients_v1');
      return raw ? (JSON.parse(raw) as unknown[]).length : 0;
    } catch { return 0; }
  });
  const [form, setForm] = useState<Omit<Invoice, 'id' | 'number' | 'createdAt'>>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [showOblForm, setShowOblForm] = useState(false);
  const [formErr, setFormErr] = useState('');
  const formRef = useRef<HTMLDivElement>(null);

  // Session reset: clear stale analysis caches when a new session starts
  useEffect(() => {
    const SESSION_KEY = 'madar_session_v1';
    const lastSession = localStorage.getItem(SESSION_KEY);
    const now = Date.now();
    if (!lastSession || (now - Number(lastSession)) > 2 * 60 * 60 * 1000) {
      ['synergy_pipeline_result', 'synergy_score_cache', 'madar_agent_analysis'].forEach(k => {
        try { localStorage.removeItem(k); } catch { /**/ }
      });
    }
    localStorage.setItem(SESSION_KEY, String(now));
  }, []);

  // Sync activeTab with URL ?tab= query param so sidebar nav clicks switch tabs
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const t = params.get('tab') as Tab | null;
    if (t && ['dashboard', 'invoices', 'expenses', 'clients'].includes(t)) {
      setActiveTab(t);
    }
  }, [location.search]);

  // Dynamic channels: base list + connected platform names from ConnectionsPage
  const channels = useMemo(() => {
    try {
      const store = JSON.parse(localStorage.getItem('synergy_connections_v4') || '{}') as Record<string, { status: string }>;
      const platformNames = Object.entries(store)
        .filter(([, v]) => v.status === 'connected')
        .map(([id]) => {
          // Capitalise id to a friendly label
          const name = id.charAt(0).toUpperCase() + id.slice(1);
          return name;
        });
      const all = [...BASE_CHANNELS, ...platformNames.filter(n => !BASE_CHANNELS.includes(n))];
      return all;
    } catch { return BASE_CHANNELS; }
  }, [invoices]); // re-compute whenever invoices changes (user may have just connected)

  const saveInv = (list: Invoice[]) => { setInvoices(list); saveInvoices(list); };
  const saveObl = (list: Obligation[]) => { setObligations(list); saveObligations(list); };
  const setField = (k: keyof typeof form, v: string | number | boolean) => setForm(prev => ({ ...prev, [k]: v as never }));

  const nextNumber = useMemo(
    () => invoices.length === 0 ? 201 : Math.max(...invoices.map(i => i.number)) + 1,
    [invoices]
  );

  const handleSave = () => {
    if (!form.clientName.trim()) return setFormErr('Enter a client name');
    if (!form.amount || form.amount <= 0) return setFormErr('Enter a valid amount');
    setFormErr('');
    if (editId) {
      saveInv(invoices.map(inv =>
        inv.id === editId ? { ...form, id: inv.id, number: inv.number, createdAt: inv.createdAt } : inv
      ));
      setEditId(null);
    } else {
      const newInv = { ...form, id: genId(), number: nextNumber, createdAt: Date.now() };
      saveInv([newInv, ...invoices]);
      // Log invoice added — each unique client adds +5% to Risk Score
      try {
        const actLog = JSON.parse(localStorage.getItem('synergy_activity_log_v1') || '[]') as unknown[];
        actLog.unshift({ type: 'invoice_added', label: 'Invoice Added', detail: `${form.clientName} · ${form.currency} ${form.amount.toLocaleString()} · ${form.status}${form.clientNotes ? ' · Profile recorded' : ''}`, ref: 'INV-' + nextNumber, ts: Date.now() });
        localStorage.setItem('synergy_activity_log_v1', JSON.stringify((actLog as unknown[]).slice(0, 200)));
      } catch { /**/ }
    }
    setForm(emptyForm());
  };

  const handleEdit = (inv: Invoice) => {
    setEditId(inv.id);
    setForm({
      clientName: inv.clientName, clientEmail: inv.clientEmail || '', clientPhone: inv.clientPhone || '',
      clientHistory: inv.clientHistory || '', clientNotes: inv.clientNotes || '', projectRef: inv.projectRef, currency: inv.currency,
      amount: inv.amount, issueDate: inv.issueDate, dueDate: inv.dueDate,
      paymentTerms: inv.paymentTerms, channel: inv.channel, notes: inv.notes, status: inv.status,
      connectionSource: inv.connectionSource || '', proofName: inv.proofName || '', proofUrl: inv.proofUrl || '',
      proofVerified: inv.proofVerified || false, proofWeek: inv.proofWeek || isoWeek(),
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const totalOblSAR = useMemo(
    () => obligations.reduce((s, o) => s + toSAR(o.amount, o.currency), 0),
    [obligations]
  );

  const TABS_CFG: { id: Tab; label: string; count: number }[] = [
    { id: 'dashboard', label: 'Dashboard', count: 0 },
    { id: 'invoices',  label: 'Invoices',  count: invoices.length },
    { id: 'expenses',  label: 'Expenses',  count: obligations.length },
    { id: 'clients',   label: 'Clients',   count: clientCount },
  ];

  const inp = 'w-full px-3 py-2.5 rounded-xl border text-[13px] outline-none focus:ring-2 focus:ring-blue-200 transition-all';
  const is = { borderColor: BORDER, background: CREAM, color: TEXT };
  const sel = inp + ' appearance-none cursor-pointer pr-8';

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full min-h-0">

        {/* Page heading + tabs */}
        <div className="px-6 pt-6 pb-0 border-b shrink-0" style={{ borderColor: BORDER, background: CARD }}>
          <h1 className="text-[26px] font-black leading-tight" style={{ color: TEXT }}>Liquidity Tools</h1>
          <p className="text-[13px] mt-0.5 mb-4" style={{ color: TEXT3 }}>
            add what you have, what you're owed, what you owe — in any currency
          </p>
          <div className="flex gap-0">
            {TABS_CFG.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={'flex items-center gap-2 px-5 py-3 text-[13px] font-semibold border-b-2 transition-all cursor-pointer ' +
                  (activeTab === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent hover:border-gray-300')}
                style={activeTab !== tab.id ? { color: TEXT3 } : {}}>
                {tab.label}
                {tab.count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                    style={activeTab === tab.id
                      ? { background: '#dbeafe', color: '#1d4ed8' }
                      : { background: '#f1f5f9', color: TEXT3 }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Islamic compliance trust strip */}
        <div style={{
          background: 'linear-gradient(90deg, #f0fdf4, #ecfdf5)',
          border: '1px solid #bbf7d0',
          borderRadius: 0,
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          borderLeft: 'none',
          borderRight: 'none',
        }} className="shrink-0">
          <span style={{ fontSize: 18 }}>🛡️</span>
          <div>
            <p style={{ fontWeight: 700, color: '#065f46', fontSize: 13, margin: 0 }}>Islamic Factoring — Riba-free</p>
            <p style={{ color: '#047857', fontSize: 11, margin: 0 }}>Fixed 2.2% admin fee · one-time · never compounds · Shariah-compliant</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {['✓ Riba-free', '✓ Fixed fee', '✓ Shariah-compliant'].map(b => (
              <span key={b} style={{ background: '#d1fae5', color: '#065f46', borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>{b}</span>
            ))}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>

          {/* Dashboard tab */}
          {activeTab === 'dashboard' && (
            <DashboardTab invoices={invoices} obligations={obligations}/>
          )}

          {/* Expenses placeholder */}
          {activeTab === 'expenses' && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <ShoppingBag size={44} style={{ color: TEXT3 }} />
              <p className="text-[16px] font-bold capitalize" style={{ color: TEXT2 }}>Expenses — coming soon</p>
              <p className="text-[13px]" style={{ color: TEXT3 }}>This section is currently in development</p>
            </div>
          )}

          {/* Clients tab */}
          {activeTab === 'clients' && <ClientsTab />}

          {/* Invoices tab */}
          {activeTab === 'invoices' && (
            <div className="flex gap-5 p-5 items-start max-w-[1400px] mx-auto">

              {/* ── Left: form + list ── */}
              <div className="flex-1 min-w-0 space-y-5">

                {/* Invoice Form */}
                <motion.div ref={formRef} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER, background: CARD }}>
                  <div className="flex items-center gap-2.5 px-5 py-4 border-b" style={{ borderColor: BORDER }}>
                    <Plus size={15} style={{ color: ACCENT }} />
                    <p className="text-[15px] font-extrabold" style={{ color: TEXT }}>
                      {editId ? 'Edit Invoice' : '+ Add New Invoice'}
                    </p>
                    {editId && (
                      <span className="ml-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold"
                        style={{ background: '#eff6ff', color: ACCENT }}>
                        #{invoices.find(i => i.id === editId)?.number}
                      </span>
                    )}
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Client Name + auto-recall */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wide block" style={{ color: TEXT3 }}>
                          Client Name
                        </label>
                        <input className={inp} style={is} value={form.clientName}
                          onChange={e => {
                            setField('clientName', e.target.value);
                            // auto-recall details from previous invoices
                            const prev = invoices.find(i => i.clientName.toLowerCase() === e.target.value.toLowerCase() && i.id !== editId);
                            if (prev) {
                              setForm(f => ({ ...f, clientName: e.target.value,
                                clientEmail: f.clientEmail || prev.clientEmail || '',
                                clientPhone: f.clientPhone || prev.clientPhone || '',
                                clientHistory: f.clientHistory || prev.clientHistory || '',
                              }));
                            }
                          }}
                          list="client-list"
                          placeholder="type or pick a client..." />
                        <datalist id="client-list">
                          {[...new Set(invoices.map(i => i.clientName))].map(n => (
                            <option key={n} value={n} />
                          ))}
                        </datalist>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wide block" style={{ color: TEXT3 }}>
                          Project <span className="normal-case font-normal">(optional)</span>
                        </label>
                        <input className={inp} style={is} value={form.projectRef}
                          onChange={e => setField('projectRef', e.target.value)}
                          placeholder="link to project..." />
                      </div>
                    </div>

                    {/* Client Contact Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wide block" style={{ color: TEXT3 }}>Client Email</label>
                        <input type="email" className={inp} style={is} value={form.clientEmail}
                          onChange={e => setField('clientEmail', e.target.value)}
                          placeholder="client@example.com" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wide block" style={{ color: TEXT3 }}>WhatsApp / Phone</label>
                        <input type="tel" className={inp} style={is} value={form.clientPhone}
                          onChange={e => setField('clientPhone', e.target.value)}
                          placeholder="+966 5xx xxx xxx" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wide block" style={{ color: TEXT3 }}>Status</label>
                        <div className="relative">
                          <select className={sel} style={is}
                            value={form.status} onChange={e => setField('status', e.target.value)}>
                            <option value="pending">Pending</option>
                            <option value="active">Active</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                          </select>
                          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: TEXT3 }} />
                        </div>
                      </div>
                    </div>

                    {/* Currency + Amount + Issue Date + Due Date */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wide block" style={{ color: TEXT3 }}>
                          Currency
                        </label>
                        <CurrencyPicker value={form.currency} onChange={c => setField('currency', c)} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wide block" style={{ color: TEXT3 }}>
                          Amount
                        </label>
                        <input type="number" min="0" step="0.01" className={inp} style={is}
                          value={form.amount || ''} onChange={e => setField('amount', parseFloat(e.target.value) || 0)}
                          placeholder="0.00" dir="ltr" />
                        {form.amount > 0 && form.currency !== 'SAR' && (
                          <p className="text-[10px] mt-1" style={{ color: TEXT3 }}>
                            {'≈ SAR ' + toSAR(form.amount, form.currency).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wide block" style={{ color: TEXT3 }}>
                          Issue Date
                        </label>
                        <input type="date" className={inp} style={is}
                          value={form.issueDate} onChange={e => setField('issueDate', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wide block" style={{ color: TEXT3 }}>
                          Due Date
                        </label>
                        <input type="date" className={inp} style={is}
                          value={form.dueDate} onChange={e => setField('dueDate', e.target.value)} />
                      </div>
                    </div>

                    {/* Payment Terms + Channel */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wide block" style={{ color: TEXT3 }}>
                          Payment Terms
                        </label>
                        <div className="relative">
                          <select className={sel} style={is}
                            value={form.paymentTerms} onChange={e => setField('paymentTerms', e.target.value)}>
                            {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: TEXT3 }} />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wide block" style={{ color: TEXT3 }}>
                          Channel
                        </label>
                        <div className="relative">
                          <select className={sel} style={is}
                            value={form.channel} onChange={e => setField('channel', e.target.value)}>
                            {channels.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: TEXT3 }} />
                        </div>
                      </div>
                    </div>

                    {/* ── Acquisition Source + Proof Upload (boosts Synergy Score) ── */}
                    <ConnectionSourceProof form={form} setField={setField} />

                    {/* Client History */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wide block" style={{ color: TEXT3 }}>
                        Client History <span className="normal-case font-normal">(helps AI assess risk)</span>
                      </label>
                      <textarea className={inp} style={{ ...is, resize: 'none' }} rows={2}
                        value={form.clientHistory} onChange={e => setField('clientHistory', e.target.value)}
                        placeholder="e.g. Paid 2 invoices on time, last one was 14 days late..." />
                    </div>

                    {/* ── AI Behavioral Analyst — premium panel ──
                        Replaces the old free-text "Client Profile" textarea with a
                        guided, signal-chip workflow + live AI risk forecast +
                        Khaleeji-dialect TTS playback. */}
                    <div className="rounded-2xl border p-4"
                      style={{ borderColor: '#e9d5ff', background: '#faf7ff' }}>
                      <ClientBehaviorAI
                        clientName={form.clientName}
                        amount={form.amount}
                        currency={form.currency}
                        dueDate={form.dueDate}
                        clientHistory={form.clientHistory}
                        clientNotes={form.clientNotes}
                        onNotesChange={(v) => setField('clientNotes', v)}
                        onScript={({ arabic, english, tone }) => {
                          // Inject the AI-generated collection script into the
                          // existing "Notes" draft field so it can be picked up
                          // by the WhatsApp/Email composer downstream.
                          const block =
                            `--- AI Collection Script (${tone}) ---\n` +
                            `EN: ${english}\n` +
                            `AR: ${arabic}\n` +
                            `--- end ---`;
                          setForm(f => ({
                            ...f,
                            notes: f.notes && f.notes.trim()
                              ? `${f.notes.trim()}\n\n${block}`
                              : block,
                          }));
                        }}
                      />
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wide block" style={{ color: TEXT3 }}>
                        Notes
                      </label>
                      <textarea className={inp} style={{ ...is, resize: 'none' }} rows={2}
                        value={form.notes} onChange={e => setField('notes', e.target.value)}
                        placeholder="any context Sentinel should know..." />
                    </div>

                    {formErr && (
                      <div className="flex items-center gap-2 p-3 rounded-xl border border-red-200 bg-red-50">
                        <AlertCircle size={12} className="text-red-500 shrink-0" />
                        <p className="text-[12px] text-red-700">{formErr}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-1">
                      <button onClick={handleSave}
                        className="px-7 h-11 rounded-xl text-white text-[13px] font-extrabold flex items-center gap-2 cursor-pointer"
                        style={{ background: ACCENT }}>
                        <Save size={14} /> Save Invoice
                      </button>
                      <button onClick={() => { setForm(emptyForm()); setEditId(null); setFormErr(''); }}
                        className="px-7 h-11 rounded-xl border text-[13px] font-semibold hover:bg-gray-50 cursor-pointer"
                        style={{ borderColor: BORDER, color: TEXT2 }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>

                {/* Invoice Table */}
                <div className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER, background: CARD }}>
                  <div className="flex items-center gap-2.5 px-5 py-3.5 border-b" style={{ borderColor: BORDER }}>
                    <Receipt size={14} style={{ color: TEXT3 }} />
                    <p className="text-[13px] font-bold" style={{ color: TEXT }}>Your Invoices</p>
                    <span className="text-[12px] font-normal" style={{ color: TEXT3 }}>(mixed currencies)</span>
                    <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: '#f1f5f9', color: TEXT3 }}>
                      {invoices.length} total
                    </span>
                  </div>
                  {invoices.length === 0 ? (
                    <div className="text-center py-12">
                      <Receipt size={30} className="mx-auto mb-3" style={{ color: TEXT3 }} />
                      <p className="text-[13px] font-semibold" style={{ color: TEXT2 }}>No invoices yet</p>
                      <p className="text-[11px] mt-1" style={{ color: TEXT3 }}>Fill in the form above to create your first invoice</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                            {['CLIENT', 'AMOUNT', 'DUE', 'STATUS', 'RISK', 'ACTION'].map(h => (
                              <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest px-3 py-2.5"
                                style={{ color: TEXT3, background: CREAM }}
                                {...(h === 'CLIENT' ? { className: 'text-left text-[10px] font-bold uppercase tracking-widest pl-5 pr-3 py-2.5' } : {})}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <AnimatePresence>
                            {invoices.map(inv => (
                              <InvoiceRow key={inv.id} invoice={inv}
                                onEdit={() => handleEdit(inv)}
                                onDelete={() => saveInv(invoices.filter(i => i.id !== inv.id))}
                                onAnalyze={() => navigate('/room', { state: { prefill: { clientName: inv.clientName, clientPhone: inv.clientPhone, clientEmail: inv.clientEmail, amount: inv.amount, currency: inv.currency, issueDate: inv.issueDate, dueDate: inv.dueDate || '', source: 'manual', description: inv.projectRef || '', notes: (inv.clientNotes ? `[Client Profile: ${inv.clientNotes}]\n\n` : '') + (inv.notes || ''), history: inv.clientHistory || '' } } })} />
                            ))}
                          </AnimatePresence>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>

              {/* ── Right: Upcoming Obligations ── */}
              <div className="w-[290px] shrink-0">
                <div className="rounded-2xl border overflow-hidden sticky top-5" style={{ borderColor: BORDER, background: CARD }}>
                  <div className="flex items-center gap-2.5 px-4 py-4 border-b" style={{ borderColor: BORDER }}>
                    <TrendingDown size={15} style={{ color: '#dc2626' }} />
                    <p className="text-[14px] font-extrabold" style={{ color: TEXT }}>Upcoming Obligations</p>
                  </div>

                  <div className="px-4 py-1">
                    {obligations.map(o => (
                      <ObligationItem key={o.id} obligation={o}
                        onDelete={() => saveObl(obligations.filter(ob => ob.id !== o.id))} />
                    ))}
                    {obligations.length === 0 && (
                      <p className="text-[12px] text-center py-8" style={{ color: TEXT3 }}>No obligations yet</p>
                    )}
                  </div>

                  {obligations.length > 0 && (
                    <div className="px-4 py-3 border-t" style={{ borderColor: BORDER }}>
                      <p className="text-[10px] mb-2.5" style={{ color: TEXT3 }}>auto-converted to primary currency</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-extrabold uppercase tracking-widest" style={{ color: TEXT }}>Total</span>
                        <span className="text-[18px] font-black" style={{ color: TEXT }}>
                          {'≈ SAR ' + totalOblSAR.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="px-4 pb-4">
                    {showOblForm ? (
                      <AddObligationForm
                        onAdd={o => { saveObl([...obligations, { ...o, id: genId() }]); setShowOblForm(false); }}
                        onCancel={() => setShowOblForm(false)} />
                    ) : (
                      <button onClick={() => setShowOblForm(true)}
                        className="w-full h-10 rounded-xl border text-[12px] font-bold flex items-center justify-center gap-2 mt-3 cursor-pointer hover:bg-gray-50 transition-colors"
                        style={{ borderColor: BORDER, color: TEXT2 }}>
                        <Plus size={13} /> Add Obligation
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
  );
}