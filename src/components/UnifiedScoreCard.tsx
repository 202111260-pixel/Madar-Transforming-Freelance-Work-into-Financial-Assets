/**
 * UnifiedScoreCard — single source-of-truth widget for the Synergy Score.
 * Reads localStorage live and shows the same 5-component breakdown that
 * CreditPanel uses, so the customer never sees two different numbers again.
 */
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Brain, Link2, FileText, Users, ShieldCheck, ChevronRight, Sparkles, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { computeUnifiedScore, tierColor, tierLabel, type UnifiedScore } from '../lib/scoreEngine';

interface Props {
  /** Hide the "Send to Agent Room" CTA (e.g. when already on /room). */
  hideCta?: boolean;
  /** Compact mode: smaller padding, no help tips. */
  compact?: boolean;
  /** Language for the verdict label. */
  lang?: 'ar' | 'en';
  /** Force a recompute when this value changes. */
  refreshKey?: number;
}

const ICONS = {
  ai: Brain, connections: Link2, projects: FileText, clients: Users, proofs: ShieldCheck,
} as const;

export default function UnifiedScoreCard({ hideCta = false, compact = false, lang = 'en', refreshKey = 0 }: Props) {
  const navigate = useNavigate();
  const [score, setScore] = useState<UnifiedScore>(() => computeUnifiedScore());

  // Live recompute on storage events + manual refreshKey bumps
  useEffect(() => {
    const recompute = () => setScore(computeUnifiedScore());
    recompute();
    window.addEventListener('storage', recompute);
    window.addEventListener('synergy:store-changed', recompute as EventListener);
    return () => {
      window.removeEventListener('storage', recompute);
      window.removeEventListener('synergy:store-changed', recompute as EventListener);
    };
  }, [refreshKey]);

  const ringColor = tierColor(score.tier);
  const verdict = tierLabel(score.tier, lang);

  // Memoize ring math
  const ring = useMemo(() => {
    const r = compact ? 32 : 42;
    const stroke = compact ? 6 : 8;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - score.total / 100);
    return { r, stroke, c, offset, size: (r + stroke) * 2 };
  }, [score.total, compact]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
    >
      {/* Header strip */}
      <div className="flex items-center justify-between px-5 py-3 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--cream)' }}>
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: ringColor }} />
          <p className="text-[12px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--text)' }}>
            {lang === 'ar' ? 'سكور Madar' : 'Madar Score'}
          </p>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: ringColor + '22', color: ringColor }}>
          {verdict}
        </span>
      </div>

      <div className={(compact ? 'p-4' : 'p-5') + ' flex items-start gap-5'}>
        {/* Score ring */}
        <div className="shrink-0 relative" style={{ width: ring.size, height: ring.size }}>
          <svg width={ring.size} height={ring.size}>
            <circle cx={ring.size / 2} cy={ring.size / 2} r={ring.r}
              fill="none" stroke="var(--border)" strokeWidth={ring.stroke} />
            <motion.circle cx={ring.size / 2} cy={ring.size / 2} r={ring.r}
              fill="none" stroke={ringColor} strokeWidth={ring.stroke} strokeLinecap="round"
              strokeDasharray={ring.c}
              initial={{ strokeDashoffset: ring.c }}
              animate={{ strokeDashoffset: ring.offset }}
              transition={{ duration: 1.0, ease: 'easeOut' }}
              transform={`rotate(-90 ${ring.size / 2} ${ring.size / 2})`} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={(compact ? 'text-[18px]' : 'text-[24px]') + ' font-extrabold'} style={{ color: 'var(--text)' }}>
              {score.total}
            </span>
            <span className="text-[9px] font-semibold" style={{ color: 'var(--text3)' }}>
              / 100
            </span>
          </div>
        </div>

        {/* Components stack */}
        <div className="flex-1 min-w-0 space-y-2">
          {score.components.map(c => {
            const Icon = ICONS[c.key];
            const pct = Math.round((c.contribution / c.weight) * 100);
            return (
              <div key={c.key}>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--text2)' }}>
                    <Icon size={11} style={{ color: ringColor }} />
                    {lang === 'ar' ? c.labelAr : c.label}
                  </span>
                  <span className="font-bold" style={{ color: 'var(--text)' }}>
                    +{c.contribution}<span className="font-normal" style={{ color: 'var(--text3)' }}>/{c.weight}</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: pct + '%' }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    className="h-full"
                    style={{ background: ringColor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA strip — bank readiness */}
      {!hideCta && (
        <div className="px-5 py-3 border-t flex items-center gap-3"
          style={{
            borderColor: 'var(--border)',
            background: score.bankReady ? '#ecfdf5' : '#fffbeb',
          }}>
          {score.bankReady ? (
            <>
              <ShieldCheck size={14} style={{ color: '#059669' }} />
              <p className="text-[12px] font-bold flex-1" style={{ color: '#065f46' }}>
                {lang === 'ar'
                  ? '🎉 جاهز للبنك — أرسل التحليل لغرفة الوكلاء لاستخراج عرض السيولة'
                  : '🎉 Bank-ready — send to Agent Room to generate the liquidity offer'}
              </p>
              <button
                onClick={() => navigate('/room')}
                className="text-[11px] font-extrabold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                style={{ background: '#059669', color: 'white' }}>
                {lang === 'ar' ? 'إلى غرفة الوكلاء' : 'Agent Room'}
                <ChevronRight size={12} />
              </button>
            </>
          ) : (
            <>
              <Lock size={14} style={{ color: '#d97706' }} />
              <p className="text-[12px] font-bold flex-1" style={{ color: '#92400e' }}>
                {lang === 'ar'
                  ? `يلزم +${score.meta.nextThreshold} نقطة للوصول للحد الأدنى للبنك (70). اربط منصات وارفع إثباتات.`
                  : `Need +${score.meta.nextThreshold} pts to unlock bank funding (70). Connect platforms or upload proofs.`}
              </p>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}
