/**
 * ClientBehaviorAI — premium "AI behavioral analyst" for the Manual Input form.
 *
 * What it does:
 *   1. Lets the freelancer encode the client's payment behaviour through
 *      one-tap signal chips (12 options grouped by category).
 *   2. Runs a real Zenmux LLM call (Gemini 3.1 Pro) that returns a structured
 *      risk forecast + a Khaleeji-dialect collection script tailored to the
 *      client's personality + the invoice context.
 *   3. Plays the script through the real Zenmux TTS endpoint
 *      (openai/tts-1, voice 'nova' — handles Arabic well).
 *
 * The component is brand-aligned (cream / navy / emerald) and uses framer-motion
 * for the entrance + result animations. No mocks: every output comes from a
 * real API round-trip and a latency badge is shown to prove it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Loader2, AlertCircle, Volume2, Pause as PauseIcon,
  Brain, Mic, Activity, Shield, Zap, MessageSquare, Clock,
  RefreshCw, Send,
} from 'lucide-react';
import { callAgentDetailed, parseAgentJSON, synthesizeSpeech } from '../lib/zenmux';

const TEXT  = 'var(--text)';
const TEXT2 = 'var(--text2)';
const TEXT3 = 'var(--text3)';

// ─────────────────────────────────────────────────────────────────────────────
// Behavioural signal taxonomy — grouped chips that the freelancer toggles.
// Each chip carries a short Arabic-ready phrase that gets concatenated into
// the clientNotes string the parent form already persists.
// ─────────────────────────────────────────────────────────────────────────────
type Signal = { id: string; label: string; phrase: string; group: 'delay' | 'comms' | 'tone'; weight: number };

const SIGNALS: Signal[] = [
  // Payment delay patterns
  { id: 'd1', label: 'Pays on time',           phrase: 'Pays on time consistently',                group: 'delay', weight: -3 },
  { id: 'd2', label: 'Delays 1–2 weeks',       phrase: 'Tends to delay payments by 1–2 weeks',     group: 'delay', weight: 2 },
  { id: 'd3', label: 'Delays 3+ weeks',        phrase: 'Delays payments by 3 weeks or more',        group: 'delay', weight: 4 },
  { id: 'd4', label: 'Pays in chunks',         phrase: 'Pays in partial instalments rather than full', group: 'delay', weight: 2 },
  { id: 'd5', label: 'Ghost mode risk',        phrase: 'Has gone unresponsive in the past',         group: 'delay', weight: 5 },

  // Communication preferences
  { id: 'c1', label: 'Replies on WhatsApp',    phrase: 'Responds fastest on WhatsApp / SMS',        group: 'comms', weight: 0 },
  { id: 'c2', label: 'Email only',             phrase: 'Prefers formal email communication',        group: 'comms', weight: 1 },
  { id: 'c3', label: 'Phone calls work',       phrase: 'Voice calls get faster responses',          group: 'comms', weight: 0 },
  { id: 'c4', label: 'Slow responder',         phrase: 'Slow to reply across all channels',         group: 'comms', weight: 2 },

  // Tone & personality
  { id: 't1', label: 'Frustrated by reminders', phrase: 'Gets irritated by frequent follow-ups',     group: 'tone',  weight: 1 },
  { id: 't2', label: 'Responds to politeness', phrase: 'Responds well to polite, respectful tone',  group: 'tone',  weight: -1 },
  { id: 't3', label: 'Needs firm tone',        phrase: 'Only acts after a firm escalation tone',    group: 'tone',  weight: 3 },
];

const GROUP_META: Record<Signal['group'], { label: string; icon: typeof Clock; color: string }> = {
  delay: { label: 'Payment Delay',     icon: Clock,         color: '#dc2626' },
  comms: { label: 'Communication',     icon: MessageSquare, color: '#2563eb' },
  tone:  { label: 'Tone Preference',   icon: Activity,      color: '#7c3aed' },
};

// ─────────────────────────────────────────────────────────────────────────────
// LLM prompt — strict JSON. The model also returns the Khaleeji voice script.
// ─────────────────────────────────────────────────────────────────────────────
const ANALYST_SYSTEM = `You are the "Client Behaviour Analyst" for Madar — a finance copilot for Khaleeji freelancers.
Your job:
1. Read the client + invoice context (name, amount, currency, days overdue, signal chips, free notes).
2. Forecast collection risk as STRICT JSON (no prose, no markdown fences).
3. Produce a short professional collection script in BOTH Khaleeji Arabic AND English.

Return EXACTLY this JSON shape (and nothing else — no \`\`\` fences, no commentary):
{
  "riskBand": "LOW" | "MEDIUM" | "HIGH",
  "expectedDelayDays": <integer 0-90>,
  "confidence": <integer 0-100>,
  "recommendedTone": "polite" | "professional" | "firm",
  "talkingPoints": [<string>, <string>, <string>],
  "khaleejiVoiceMessage": <string, Khaleeji Arabic, max 3 sentences>,
  "englishMessage": <string, polished business English, max 3 sentences>
}

Rules:
- Khaleeji Arabic: use natural expressions like "هلا والله بـ <الاسم>"، "يا طويل العمر"، "ما عليك أمر"، "ولا يهمك"، "إن شاء الله". Address the client in masculine singular. No threats — keep it دبلوماسي حتى لو firm.
- English: courteous, professional, no slang, no threats. Mirror the same tone level chosen in recommendedTone.
- Both messages must reference the client by name and the outstanding amount.
- Never expose IBAN / card numbers / sensitive identifiers.
- The Arabic message must read fluently when spoken by a TTS engine.
- The chip taxonomy you receive (delay / communication / tone signals) MUST measurably influence the output — escalate firmness with delay weight, soften with politeness signals, switch channel hint based on communication preference.`;

function buildAnalystUserMessage(args: {
  clientName: string; amount: number; currency: string;
  daysOverdue: number; clientHistory: string; clientNotes: string;
  signals: { delay: string[]; comms: string[]; tone: string[]; weightSum: number };
}): string {
  const payload = {
    client: {
      name: args.clientName || 'UNKNOWN',
      outstandingAmount: args.amount,
      currency: args.currency,
      daysOverdue: args.daysOverdue,
      relationshipHistory: args.clientHistory || null,
      freeformNotes: args.clientNotes || null,
    },
    behaviouralSignals: {
      paymentDelay: args.signals.delay,
      communication: args.signals.comms,
      tonePreference: args.signals.tone,
      aggregateRiskWeight: args.signals.weightSum,
    },
    instruction: 'Forecast risk and produce both Khaleeji Arabic and English collection scripts. Reply with the JSON object only.',
  };
  return JSON.stringify(payload, null, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Result type returned by the analyst
// ─────────────────────────────────────────────────────────────────────────────
interface AnalystResult {
  riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
  expectedDelayDays: number;
  confidence: number;
  recommendedTone: 'polite' | 'professional' | 'firm';
  talkingPoints: string[];
  khaleejiVoiceMessage: string;
  englishMessage: string;
  latencyMs: number;
  totalTokens: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  clientName: string;
  amount: number;
  currency: string;
  dueDate: string;
  clientHistory: string;
  clientNotes: string;
  onNotesChange: (next: string) => void;
  /** Parent consumes the generated collection script (Arabic + English). */
  onScript?: (script: { arabic: string; english: string; tone: 'polite' | 'professional' | 'firm' }) => void;
}

export default function ClientBehaviorAI({
  clientName, amount, currency, dueDate, clientHistory, clientNotes, onNotesChange,
  onScript,
}: Props) {

  const safeClientName = (clientName ?? '').trim();

  // ── Selected signals (mirror clientNotes by phrase substring) ──
  const selected = useMemo(() => {
    const set = new Set<string>();
    for (const s of SIGNALS) if (clientNotes.includes(s.phrase)) set.add(s.id);
    return set;
  }, [clientNotes]);

  const toggleSignal = useCallback((sig: Signal) => {
    const has = clientNotes.includes(sig.phrase);
    if (has) {
      // Remove the phrase + any leading "; " or trailing "; "
      const next = clientNotes
        .replace(new RegExp(`\\s*[•;,]\\s*${escapeRegExp(sig.phrase)}`), '')
        .replace(new RegExp(`${escapeRegExp(sig.phrase)}\\s*[•;,]\\s*`), '')
        .replace(sig.phrase, '')
        .trim();
      onNotesChange(next);
    } else {
      const next = clientNotes.trim()
        ? `${clientNotes.trim()} • ${sig.phrase}`
        : sig.phrase;
      onNotesChange(next);
    }
  }, [clientNotes, onNotesChange]);

  // ── Risk pre-score (instant, before LLM) — visual feedback ──
  const preScore = useMemo(() => {
    let s = 0;
    for (const sig of SIGNALS) if (selected.has(sig.id)) s += sig.weight;
    return s;
  }, [selected]);
  const preBand: 'LOW' | 'MEDIUM' | 'HIGH' =
    preScore >= 6 ? 'HIGH' : preScore >= 2 ? 'MEDIUM' : 'LOW';

  // ── LLM analysis state ──
  const [running, setRunning]   = useState(false);
  const [result, setResult]     = useState<AnalystResult | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    if (!safeClientName) {
      setError('Add a client name before running the analyst.');
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const daysOverdue = dueDate
        ? Math.max(0, Math.round((Date.now() - new Date(dueDate).getTime()) / 86400000))
        : 0;
      const groupedSignals = { delay: [] as string[], comms: [] as string[], tone: [] as string[] };
      let weightSum = 0;
      for (const sig of SIGNALS) {
        if (selected.has(sig.id)) {
          groupedSignals[sig.group].push(sig.phrase);
          weightSum += sig.weight;
        }
      }
      const r = await callAgentDetailed({
        model: 'google/gemini-3.1-pro-preview',
        systemPrompt: ANALYST_SYSTEM,
        userMessage: buildAnalystUserMessage({
          clientName: safeClientName, amount, currency, daysOverdue,
          clientHistory, clientNotes,
          signals: { ...groupedSignals, weightSum },
        }),
        maxTokens: 1100,
        temperature: 0.55,
      });
      const parsed = parseAgentJSON<Omit<AnalystResult, 'latencyMs' | 'totalTokens'>>(r.content);
      // Validate shape — fail loudly rather than render garbage.
      if (!parsed || typeof parsed.riskBand !== 'string' || !parsed.khaleejiVoiceMessage || !parsed.englishMessage) {
        throw new Error('Model returned malformed JSON (missing required fields).');
      }
      setResult({
        ...parsed,
        talkingPoints: Array.isArray(parsed.talkingPoints) ? parsed.talkingPoints : [],
        latencyMs: r.usage.latencyMs,
        totalTokens: r.usage.totalTokens,
      });
    } catch (e) {
      const msg = (e as Error)?.message || String(e) || 'Analysis failed';
      console.error('[ClientBehaviorAI] analyse failed:', e);
      setError(msg);
    } finally {
      setRunning(false);
    }
  }, [safeClientName, amount, currency, dueDate, clientHistory, clientNotes, selected]);

  // ── TTS playback state ──
  type VState = 'idle' | 'loading' | 'playing' | 'error';
  const [vstate, setVState] = useState<VState>('idle');
  const [vErr, setVErr]     = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef   = useRef<string | null>(null);

  useEffect(() => () => {
    if (audioRef.current) audioRef.current.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  const handleSpeak = useCallback(async () => {
    if (!result) return;
    if (vstate === 'playing' && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setVState('idle');
      return;
    }
    setVState('loading');
    setVErr(null);
    try {
      const r = await synthesizeSpeech({ text: result.khaleejiVoiceMessage, voice: 'nova' });
      urlRef.current = r.url;
      const audio = new Audio(r.url);
      audioRef.current = audio;
      audio.onended = () => {
        setVState('idle');
        if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
      };
      audio.onerror = () => { setVState('error'); setVErr('Playback failed'); };
      await audio.play();
      setVState('playing');
    } catch (e) {
      setVState('error');
      setVErr((e as Error).message);
      setTimeout(() => setVState('idle'), 4000);
    }
  }, [result, vstate]);

  const VoiceIcon = vstate === 'loading' ? Loader2 : vstate === 'playing' ? PauseIcon : Volume2;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const grouped: Record<Signal['group'], Signal[]> = { delay: [], comms: [], tone: [] };
  for (const s of SIGNALS) grouped[s.group].push(s);

  const bandColor = (b: 'LOW' | 'MEDIUM' | 'HIGH') =>
    b === 'HIGH' ? '#dc2626' : b === 'MEDIUM' ? '#d97706' : '#15803d';
  const bandBg = (b: 'LOW' | 'MEDIUM' | 'HIGH') =>
    b === 'HIGH' ? '#fef2f2' : b === 'MEDIUM' ? '#fffbeb' : '#f0fdf4';

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5"
            style={{ color: '#7c3aed' }}>
            <Brain size={12} /> AI Behavioral Analyst
          </p>
          <p className="text-[12px] mt-1" style={{ color: TEXT2 }}>
            Tag the client's payment behaviour, then let the AI build a tailored Khaleeji collection script.
          </p>
        </div>
        {/* Pre-score gauge — updates live as chips toggle */}
        <motion.div
          key={preBand}
          initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="px-3 py-2 rounded-xl border text-center shrink-0"
          style={{ borderColor: bandColor(preBand) + '40', background: bandBg(preBand) }}>
          <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: TEXT3 }}>Pre-score</p>
          <p className="text-[14px] font-black leading-none mt-0.5" style={{ color: bandColor(preBand) }}>
            {preBand}
          </p>
        </motion.div>
      </div>

      {/* ── Signal chip groups ── */}
      <div className="space-y-3">
        {(Object.keys(grouped) as Signal['group'][]).map(g => {
          const meta = GROUP_META[g];
          const Icon = meta.icon;
          return (
            <div key={g}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
                style={{ color: meta.color }}>
                <Icon size={10} /> {meta.label}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {grouped[g].map(sig => {
                  const on = selected.has(sig.id);
                  return (
                    <motion.button
                      key={sig.id}
                      type="button"
                      onClick={() => toggleSignal(sig)}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-full border cursor-pointer transition-all"
                      style={{
                        borderColor: on ? meta.color : 'var(--border)',
                        background:  on ? meta.color : 'var(--card)',
                        color:       on ? '#ffffff' : TEXT2,
                        boxShadow:   on ? `0 4px 12px ${meta.color}33` : 'none',
                      }}>
                      {on && '✓ '}{sig.label}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Free-text notes (the existing field, beautified) ── */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider mb-1.5 block" style={{ color: TEXT3 }}>
          Additional notes (optional)
        </label>
        <textarea
          rows={2}
          value={clientNotes}
          onChange={e => onNotesChange(e.target.value)}
          placeholder="Anything else the AI should know — e.g. 'works in construction, slow Q4 cash flow'…"
          className="w-full px-3 py-2.5 rounded-xl border text-[12px] outline-none focus:ring-2 focus:ring-purple-200"
          style={{ borderColor: 'var(--border)', background: 'var(--card)', color: TEXT, resize: 'none' }} />
      </div>

      {/* ── Run analysis CTA ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <motion.button
          type="button"
          onClick={runAnalysis}
          disabled={running || !safeClientName}
          whileHover={{ scale: running ? 1 : 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex-1 min-w-[200px] h-11 rounded-xl text-white text-[13px] font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: running
              ? 'linear-gradient(135deg,#7c3aed,#4f46e5)'
              : 'linear-gradient(135deg,#0f172a,#7c3aed)',
            boxShadow: '0 10px 24px rgba(124,58,237,0.30)',
          }}>
          {running ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {running ? 'Analysing behaviour…' : 'Analyse with AI · Gemini 3.1 Pro'}
        </motion.button>
        {!safeClientName && (
          <p className="text-[10px] font-semibold flex items-center gap-1" style={{ color: '#d97706' }}>
            <AlertCircle size={11} /> Add a client name first
          </p>
        )}
        {safeClientName && selected.size === 0 && !running && !result && (
          <p className="text-[10px] font-semibold flex items-center gap-1" style={{ color: '#7c3aed' }}>
            <AlertCircle size={11} /> Tip: tap a few signal chips above for a sharper forecast.
          </p>
        )}
      </div>

      {/* ── Error banner with Retry ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-start gap-2 px-3 py-2 rounded-xl border text-[11px]"
            style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#991b1b' }}>
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span className="flex-1 break-words">{error}</span>
            <button
              type="button"
              onClick={runAnalysis}
              disabled={running || !safeClientName}
              className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold cursor-pointer disabled:opacity-50"
              style={{ borderColor: '#fecaca', background: '#fff', color: '#991b1b' }}>
              <RefreshCw size={10} className={running ? 'animate-spin' : ''} /> Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Result panel ── */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: 'var(--border)', background: 'linear-gradient(180deg, #faf7ff 0%, #fffdf6 100%)' }}>

            {/* ── Headline metrics ── */}
            <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'var(--border)' }}>
              <Stat label="RISK BAND" value={result.riskBand} valueColor={bandColor(result.riskBand)} />
              <Stat label="EXPECTED DELAY" value={`${result.expectedDelayDays}d`} />
              <Stat label="CONFIDENCE"   value={`${result.confidence}%`} valueColor="#7c3aed" />
            </div>

            {/* ── Talking points ── */}
            <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                style={{ color: '#0f172a' }}>
                <Zap size={11} /> Recommended approach · <span style={{ color: bandColor(result.riskBand) }}>
                  {result.recommendedTone}
                </span>
              </p>
              <ul className="space-y-1.5">
                {result.talkingPoints.map((pt, i) => (
                  <li key={i} className="text-[12px] leading-[1.7] flex gap-2" style={{ color: TEXT2 }}>
                    <span className="font-black mt-0.5" style={{ color: '#7c3aed' }}>{i + 1}.</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Khaleeji voice script ── */}
            <div className="p-4 border-t" style={{ borderColor: 'var(--border)', background: '#fffdf6' }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                  style={{ color: '#0f172a' }}>
                  <Mic size={11} /> Khaleeji voice script
                </p>
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: '#ede9fe', color: '#6d28d9' }}>
                  AR · لهجة خليجية
                </span>
              </div>
              <p
                className="text-[14px] leading-[1.9] font-medium p-3 rounded-xl border"
                style={{
                  color: TEXT, direction: 'rtl',
                  borderColor: 'var(--border)', background: 'var(--cream)',
                  fontFamily: '"IBM Plex Sans Arabic", "Segoe UI", sans-serif',
                }}>
                {result.khaleejiVoiceMessage}
              </p>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <motion.button
                  type="button"
                  onClick={handleSpeak}
                  whileHover={{ scale: vstate === 'loading' ? 1 : 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="h-10 px-4 rounded-xl text-white text-[12px] font-bold flex items-center gap-2 cursor-pointer"
                  style={{
                    background: vstate === 'playing'
                      ? 'linear-gradient(135deg,#7c3aed,#4f46e5)'
                      : vstate === 'error'
                        ? '#fef2f2'
                        : 'linear-gradient(135deg,#0f172a,#1e293b)',
                    color: vstate === 'error' ? '#dc2626' : '#fff',
                    boxShadow: vstate === 'playing' ? '0 8px 22px rgba(124,58,237,0.35)' : 'none',
                  }}>
                  <VoiceIcon size={13} className={vstate === 'loading' ? 'animate-spin' : ''} />
                  {vstate === 'loading' ? 'Synthesising voice…' :
                   vstate === 'playing' ? 'Playing — tap to stop' :
                   vstate === 'error'   ? 'Voice unavailable' :
                   'Speak in Khaleeji · Zenmux TTS'}
                </motion.button>
                {vErr && <span className="text-[10px]" style={{ color: '#dc2626' }}>{vErr}</span>}

                {/* Telemetry — proves it's a real round-trip, not a mock */}
                <span className="text-[9px] font-mono ml-auto px-2 py-1 rounded-md border"
                  style={{ borderColor: 'var(--border)', color: TEXT3, background: 'var(--card)' }}>
                  <Shield size={9} className="inline -mt-0.5 mr-1" />
                  {result.latencyMs}ms · {result.totalTokens}tok
                </span>
              </div>
            </div>

            {/* ── English collection script ── */}
            <div className="p-4 border-t" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                  style={{ color: '#0f172a' }}>
                  <MessageSquare size={11} /> English collection script
                </p>
                <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                  EN · business
                </span>
              </div>
              <p
                className="text-[13px] leading-[1.7] font-medium p-3 rounded-xl border"
                style={{
                  color: TEXT,
                  borderColor: 'var(--border)', background: '#fff',
                }}>
                {result.englishMessage}
              </p>

              {onScript && (
                <div className="mt-3">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onScript({
                      arabic: result.khaleejiVoiceMessage,
                      english: result.englishMessage,
                      tone: result.recommendedTone,
                    })}
                    className="h-9 px-4 rounded-xl text-white text-[12px] font-extrabold inline-flex items-center gap-2 cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg,#15803d,#0f766e)',
                      boxShadow: '0 8px 20px rgba(15,118,110,0.30)',
                    }}>
                    <Send size={12} /> Use this script
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal — small KPI tile used in the result header
// ─────────────────────────────────────────────────────────────────────────────
function Stat({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="px-4 py-3 text-center">
      <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: TEXT3 }}>{label}</p>
      <p className="text-[18px] font-black mt-1 leading-none"
        style={{ color: valueColor || TEXT }}>
        {value}
      </p>
    </div>
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
