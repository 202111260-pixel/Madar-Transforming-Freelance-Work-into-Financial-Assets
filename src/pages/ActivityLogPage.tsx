/**
 * ActivityLogPage — Madar
 * Full timeline of events: pipeline runs, bank submissions, bridge activations, connections
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from '../components/ThemeToggle';
import {
  Brain, BarChart3, Link2, Droplets, CreditCard, Activity,
  Sparkles, FileText, Building2, CheckCircle2, AlertTriangle,
  Zap, Download, Send, RefreshCw, Trash2, Filter,
  Clock, TrendingUp, Shield, BadgeCheck, X, ChevronRight,
} from 'lucide-react';

const CREAM = 'var(--cream)', CARD = 'var(--card)', BORDER = 'var(--border)';
const TEXT = 'var(--text)', TEXT2 = 'var(--text2)', TEXT3 = 'var(--text3)', ACCENT = 'var(--accent)';
const ACTIVITY_STORE = 'synergy_activity_log_v1';

const NAV = [
  { icon: BarChart3,  label: 'Dashboard',    path: '/' },
  { icon: Link2,      label: 'Connections',  path: '/connections' },
  { icon: Droplets,   label: 'Liquidity',    path: '/manual' },
  { icon: Brain,      label: 'AI Room',      path: '/room' },
  { icon: CreditCard, label: 'Credit Panel', path: '/credit' },
  { icon: Activity,   label: 'Activity Log', path: '/activity', active: true },
];

const BankLogo = ({ idx, size = 28 }: { idx: number; size?: number }) => {
  const logos = [
    <svg key={0} width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#006432"/>
      <path d="M8 28 Q12 18 20 18 Q28 18 32 28" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      <path d="M14 28 Q17 22 20 22 Q23 22 26 28" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <circle cx="20" cy="14" r="3" fill="#fff"/>
    </svg>,
    <svg key={1} width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#003087"/>
      <path d="M6 16 L12 16 L12 13 L18 13 L18 16 L22 16 L22 13 L28 13 L28 16 L34 16" stroke="#c8a85b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="6" y="20" width="28" height="2" rx="1" fill="#c8a85b" opacity="0.8"/>
      <rect x="10" y="25" width="20" height="2" rx="1" fill="#c8a85b" opacity="0.5"/>
    </svg>,
    <svg key={2} width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#6b0d72"/>
      <path d="M20 8 L22.5 15 L30 15 L24 19.5 L26.5 27 L20 22.5 L13.5 27 L16 19.5 L10 15 L17.5 15 Z" fill="#fff" opacity="0.9"/>
    </svg>,
    <svg key={3} width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#1a3a6e"/>
      <rect x="8" y="12" width="10" height="16" rx="2" fill="#fff" opacity="0.9"/>
      <rect x="22" y="17" width="10" height="11" rx="2" fill="#fff" opacity="0.9"/>
      <rect x="8" y="30" width="24" height="2" rx="1" fill="#c8a85b"/>
    </svg>,
  ];
  return logos[idx % logos.length];
};

interface ActivityEvent {
  type: string;
  label: string;
  detail: string;
  ref: string;
  ts: number;
  bankIdx?: number;
}

const EVENT_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  pipeline_complete:   { icon: Brain,         color: '#2563eb', bg: '#eff6ff' },
  credit_offer_saved:  { icon: CreditCard,    color: '#7c3aed', bg: '#f5f3ff' },
  bridge_activated:    { icon: Zap,           color: '#059669', bg: '#ecfdf5' },
  offer_declined:      { icon: X,             color: '#dc2626', bg: '#fef2f2' },
  pdf_downloaded:      { icon: Download,      color: '#d97706', bg: '#fffbeb' },
  bank_report_sent:    { icon: Send,          color: '#0891b2', bg: '#ecfeff' },
  bank_report_reviewed:{ icon: Shield,        color: '#2563eb', bg: '#eff6ff' },
  bank_decision:       { icon: BadgeCheck,    color: '#059669', bg: '#ecfdf5' },
  sms_sent:            { icon: CheckCircle2,  color: '#059669', bg: '#ecfdf5' },
  connection_added:    { icon: Link2,         color: '#2563eb', bg: '#eff6ff' },
  invoice_added:       { icon: FileText,      color: '#6b7280', bg: '#f9fafb' },
  behavioral_signal:   { icon: Brain,         color: '#7c3aed', bg: '#f5f3ff' },
};
function getMeta(type: string) {
  return EVENT_META[type] || { icon: Activity, color: TEXT2, bg: CREAM };
}

function formatTs(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return Math.floor(diff / 1000) + 's ago';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return new Date(ts).toLocaleDateString('en', { day: 'numeric', month: 'short' });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}



type FilterType = 'all' | 'pipeline' | 'credit' | 'bank' | 'connections';

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all',         label: 'All Events' },
  { key: 'pipeline',    label: 'AI Pipeline' },
  { key: 'credit',      label: 'Credit / Bridge' },
  { key: 'bank',        label: 'Bank' },
  { key: 'connections', label: 'Connections' },
];
const FILTER_MAP: Record<FilterType, string[]> = {
  all:         [],
  pipeline:    ['pipeline_complete', 'behavioral_signal'],
  credit:      ['credit_offer_saved', 'bridge_activated', 'offer_declined'],
  bank:        ['bank_report_sent', 'bank_report_reviewed', 'bank_decision', 'pdf_downloaded'],
  connections: ['connection_added'],
};

/* Bank Review simulation — last bank submission */
function BankReviewPanel({ events }: { events: ActivityEvent[] }) {
  const bankEvent = events.find(e => e.type === 'bank_report_sent');
  const offer = events.find(e => e.type === 'credit_offer_saved');
  if (!bankEvent) return null;
  const reviewedEvent = events.find(e => e.type === 'bank_report_reviewed' && e.ref === bankEvent.ref);
  const decisionEvent = events.find(e => e.type === 'bank_decision' && e.ref === bankEvent.ref);

  const sentAgo = Date.now() - bankEvent.ts;
  const inferredReviewed = sentAgo > 45000;
  const inferredDecision = sentAgo > 120000;

  const isReviewed = Boolean(reviewedEvent) || inferredReviewed;
  const isDecided = Boolean(decisionEvent) || inferredDecision;
  const decisionApproved = (decisionEvent?.label || '').toLowerCase().includes('approved');
  const decisionText = decisionEvent?.detail
    || (decisionApproved
      ? 'Approved: Bridge terms confirmed.'
      : 'Conditional: additional documentation required.');

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER, background: CARD }}>
      <div className="h-1" style={{ background: '#3b82f6' }}/>
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
        <div className="flex items-center gap-2.5">
          <BankLogo idx={bankEvent.bankIdx ?? 0} size={28}/>
          <div>
            <p className="text-[15px] font-extrabold" style={{ fontFamily: "'Caveat',cursive", color: TEXT }}>Bank Review Status</p>
            <p className="text-[10px]" style={{ color: TEXT3 }}>{bankEvent.detail.split('·')[0]?.trim()}</p>
          </div>
        </div>
        <span className={'text-[10px] font-bold px-2 py-0.5 rounded-full ' + (isDecided ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
          {isDecided ? '✓ Decision Received' : 'Under Review'}
        </span>
      </div>
      <div className="p-5">
        {/* Review steps */}
        <div className="flex items-center gap-3 mb-5">
          {[
            { label: 'Sent',     time: formatTime(bankEvent.ts),                       done: true },
            { label: 'Reviewed', time: reviewedEvent ? formatTime(reviewedEvent.ts) : (isReviewed ? formatTime(bankEvent.ts + 45000) : '—'), done: isReviewed },
            { label: 'Decision', time: isDecided ? (decisionApproved ? 'Approved' : 'Conditional') : ('pending · ' + Math.max(0, Math.floor((120000 - sentAgo) / 1000)) + 's'), done: isDecided },
          ].map((s, i) => (
            <div key={s.label} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={'w-9 h-9 rounded-full flex items-center justify-center border-2 ' +
                  (s.done ? 'bg-gray-900 border-gray-900' : 'border-gray-200 bg-gray-50')}>
                  {s.done
                    ? <CheckCircle2 size={16} className="text-white"/>
                    : <span className="text-[11px] font-bold" style={{ color: TEXT3 }}>{i + 1}</span>}
                </div>
                <p className="text-[11px] font-bold mt-1" style={{ color: s.done ? TEXT : TEXT3 }}>{s.label}</p>
                <p className="text-[9px]" style={{ color: TEXT3 }}>{s.time}</p>
              </div>
              {i < 2 && <div className="w-8 h-[2px] mb-5" style={{ background: s.done ? '#111827' : BORDER }}/>}
            </div>
          ))}
        </div>
        {/* Bank response */}
        <div className="p-3 rounded-xl border" style={{ borderColor: BORDER, background: CREAM }}>
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: TEXT3 }}>Bank response preview:</p>
          <p className="text-[13px] italic font-semibold" style={{ color: TEXT }}>
            {isDecided
              ? '"' + decisionText + '"'
              : '"Reviewing risk profile & collateral hash..."'}
          </p>
          {isDecided && (
            <div className="flex items-center gap-1.5 mt-2">
              <BadgeCheck size={12} className={decisionApproved ? 'text-emerald-500' : 'text-amber-500'}/>
              <span className="text-[11px] font-bold" style={{ color: decisionApproved ? '#047857' : '#92400e' }}>
                {decisionApproved ? 'Bank Approved — Bridge Terms Confirmed' : 'Bank Decision — Conditional Approval'}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ══ MAIN PAGE ══ */
export default function ActivityLogPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(ACTIVITY_STORE) || '[]') as ActivityEvent[];
      setEvents(stored);
    } catch {
      setEvents([]);
    }
  }, []);

  const filtered = filter === 'all'
    ? events
    : events.filter(e => FILTER_MAP[filter].includes(e.type));

  const clearLog = () => {
    if (confirm('Clear all activity log entries?')) {
      localStorage.removeItem(ACTIVITY_STORE);
      setEvents([]);
    }
  };

  // Stats
  const pipelineCount  = events.filter(e => e.type === 'pipeline_complete').length;
  const bridgeCount    = events.filter(e => e.type === 'bridge_activated').length;
  const bankCount      = events.filter(e => e.type === 'bank_report_sent').length;
  const connCount      = events.filter(e => e.type === 'connection_added').length;

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full min-h-0">

        {/* Header */}
        <div className="px-6 py-4 border-b shrink-0 flex items-center justify-between" style={{ borderColor: BORDER, background: CARD }}>
          <div>
            <p className="text-[20px] font-black" style={{ fontFamily: "'Caveat',cursive", color: TEXT }}>Activity Log</p>
            <p className="text-[12px]" style={{ color: TEXT3 }}>{events.length} events recorded · live updates</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={clearLog}
              className="h-8 px-3 rounded-xl border text-[12px] font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
              style={{ borderColor: BORDER, color: TEXT2 }}>
              <Trash2 size={13}/> Clear
            </button>
            <button onClick={() => navigate('/credit')}
              className="h-8 px-4 rounded-xl text-[12px] font-bold flex items-center gap-1.5 text-white cursor-pointer"
              style={{ background: ACCENT }}>
              <CreditCard size={13}/> Credit Panel
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          <div className="max-w-[1100px] mx-auto px-5 py-5 space-y-5">

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'AI Reports Run',      value: pipelineCount,  icon: Brain,     color: '#2563eb' },
                { label: 'Bridges Activated',   value: bridgeCount,    icon: Zap,       color: '#059669' },
                { label: 'Bank Submissions',    value: bankCount,      icon: Building2, color: '#0891b2' },
                { label: 'Platforms Connected', value: connCount,      icon: Link2,     color: '#7c3aed' },
              ].map(s => (
                <div key={s.label} className="rounded-2xl border p-4" style={{ borderColor: BORDER, background: CARD }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: s.color + '15' }}>
                      <s.icon size={14} style={{ color: s.color }}/>
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: TEXT3 }}>{s.label}</p>
                  </div>
                  <p className="text-[28px] font-black" style={{ color: TEXT }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Bank Review Status — if exists */}
            <BankReviewPanel events={events}/>

            {/* Filter tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <Filter size={12} style={{ color: TEXT3 }} className="shrink-0"/>
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={'h-7 px-3 rounded-full text-[11px] font-semibold transition-all cursor-pointer shrink-0 ' +
                    (filter === f.key ? 'text-white' : 'hover:bg-gray-100')}
                  style={filter === f.key ? { background: ACCENT } : { background: CARD, border: '1px solid ' + BORDER, color: TEXT2 }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Timeline */}
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER, background: CARD }}>
              {filtered.length === 0 ? (
                <div className="p-12 text-center">
                  <Activity size={32} className="mx-auto mb-3" style={{ color: TEXT3 }}/>
                  <p className="text-[14px] font-bold" style={{ color: TEXT2 }}>No events yet</p>
                  <p className="text-[12px] mt-1" style={{ color: TEXT3 }}>Run Agent Room to generate your first AI report</p>
                  <button onClick={() => navigate('/room')}
                    className="mt-4 h-9 px-6 rounded-xl text-white text-[12px] font-bold flex items-center gap-2 mx-auto cursor-pointer"
                    style={{ background: ACCENT }}>
                    <Brain size={14}/> Go to Agent Room
                  </button>
                </div>
              ) : (
                <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
                  <AnimatePresence>
                    {filtered.map((event, idx) => {
                      const meta = getMeta(event.type);
                      const Icon = meta.icon;
                      const isOpen = expanded === idx;
                      return (
                        <motion.div key={event.ts + idx}
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="border-b last:border-0" style={{ borderColor: BORDER }}>
                          <button className="w-full flex items-start gap-3.5 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer text-left"
                            onClick={() => setExpanded(isOpen ? null : idx)}>
                            {/* Timeline dot */}
                            <div className="flex flex-col items-center shrink-0 pt-0.5">
                              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: meta.bg }}>
                                <Icon size={14} style={{ color: meta.color }}/>
                              </div>
                              {idx < filtered.length - 1 && (
                                <div className="w-[1px] h-4 mt-1" style={{ background: BORDER }}/>
                              )}
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[13px] font-bold" style={{ color: TEXT }}>{event.label}</p>
                                <span className="text-[10px] shrink-0" style={{ color: TEXT3 }}>{formatTs(event.ts)}</span>
                              </div>
                              <p className="text-[11px] mt-0.5 truncate" style={{ color: TEXT2 }}>{event.detail}</p>
                              {event.ref && (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded mt-1 inline-block" style={{ background: CREAM, color: TEXT3 }}>ref: {event.ref}</span>
                              )}
                            </div>
                            <ChevronRight size={13} className={'transition-transform ' + (isOpen ? 'rotate-90' : '')} style={{ color: TEXT3 }}/>
                          </button>
                          {/* Expanded detail */}
                          <AnimatePresence>
                            {isOpen && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden">
                                <div className="ml-[60px] mr-5 pb-4">
                                  <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: BORDER, background: CREAM }}>
                                    <div className="grid grid-cols-2 gap-3 text-[11px]">
                                      <div>
                                        <p className="text-[9px] uppercase tracking-wide font-bold mb-0.5" style={{ color: TEXT3 }}>Event Type</p>
                                        <p className="font-mono" style={{ color: TEXT }}>{event.type}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] uppercase tracking-wide font-bold mb-0.5" style={{ color: TEXT3 }}>Timestamp</p>
                                        <p style={{ color: TEXT }}>{formatTime(event.ts)}</p>
                                      </div>
                                      <div>
                                        <p className="text-[9px] uppercase tracking-wide font-bold mb-0.5" style={{ color: TEXT3 }}>Reference</p>
                                        <p className="font-mono" style={{ color: TEXT }}>{event.ref}</p>
                                      </div>
                                      {event.bankIdx !== undefined && (
                                        <div>
                                          <p className="text-[9px] uppercase tracking-wide font-bold mb-0.5" style={{ color: TEXT3 }}>Partner Bank</p>
                                          <div className="flex items-center gap-1.5">
                                            <BankLogo idx={event.bankIdx} size={16}/>
                                            <p style={{ color: TEXT }}>{['Al-Rajhi Bank', 'Emirates NBD', 'Alinma Bank', 'Riyad Bank'][event.bankIdx % 4]}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="pt-2 border-t" style={{ borderColor: BORDER }}>
                                      <p className="text-[9px] uppercase tracking-wide font-bold mb-0.5" style={{ color: TEXT3 }}>Details</p>
                                      <p className="text-[11px] leading-relaxed" style={{ color: TEXT2 }}>{event.detail}</p>
                                    </div>
                                    {(event.type === 'pipeline_complete' || event.type === 'credit_offer_saved') && (
                                      <button onClick={() => navigate('/credit')}
                                        className="flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer hover:underline mt-1"
                                        style={{ color: ACCENT }}>
                                        <CreditCard size={11}/> View Credit Panel
                                      </button>
                                    )}
                                    {event.type === 'bank_report_sent' && (
                                      <button onClick={() => navigate('/credit')}
                                        className="flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer hover:underline mt-1"
                                        style={{ color: ACCENT }}>
                                        <Building2 size={11}/> View Bank Status
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <div className="h-4"/>
          </div>
        </div>
      </div>
  );
}