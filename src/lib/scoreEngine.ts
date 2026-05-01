/**
 * Madar — Unified Score Engine (single source of truth)
 *
 * All pages MUST consume `computeUnifiedScore()` so the customer never sees
 * two different "Synergy scores" again.
 *
 * Score is based on DIGITAL ASSETS (platform ratings, pending invoices, commit history) —
 * NOT bank statements. Madar is Islamic Factoring (تخصيم إسلامي), not a bank. The score
 * measures freelancer platform credibility for factoring eligibility. Weights
 * sum to exactly 100 (no overflow bonuses) and every component reacts in
 * real-time to connection adds/removes and invoice changes.
 *
 *   ┌───────────────────────────────────────────────────────────────┐
 *   │  Component               Weight   Source                      │
 *   ├───────────────────────────────────────────────────────────────┤
 *   │  Platform Connections    30%      Upwork/GitHub/Fiverr verified + revenue │
 *   │  Project History         30%      paid% with overdue penalty  │
 *   │  Verified Proofs         15%      proofVerified / invoices    │
 *   │  Client Diversity        10%      unique clients (target 5)   │
 *   │  AI Report               15%      latest pipeline run         │
 *   └───────────────────────────────────────────────────────────────┘
 *
 *   • If no AI report is cached (latestAiScore = 0), the AI weight is
 *     redistributed pro-rata to the four data-driven components so the
 *     ceiling stays at 100 and a fresh user can still reach bank-ready.
 *
 *   bankReady = total >= 70   ← the magic threshold for /credit (factoring eligibility)
 */

export interface ScoreComponent {
  key: 'ai' | 'connections' | 'projects' | 'clients' | 'proofs';
  label: string;
  labelAr: string;
  weight: number;        // 0-100 (the slice's max contribution)
  raw: number;           // 0-100 raw component score
  contribution: number;  // weighted contribution (raw * weight / 100)
  hint: string;          // human-readable next action
  hintAr: string;
}

export interface UnifiedScore {
  total: number;                 // 0-100 final score
  bankReady: boolean;            // total >= 70
  tier: 'poor' | 'fair' | 'good' | 'excellent';
  components: ScoreComponent[];
  meta: {
    connectedCount: number;
    targetPlatformCount: number;
    revenueDeclaredCount: number;
    paidCount: number;
    invoiceCount: number;
    overdueCount: number;
    uniqueClients: number;
    verifiedProofs: number;
    aiReportPresent: boolean;
    nextThreshold: number;       // points needed to reach next tier
  };
}

// Realistic targets — calibrated so each individual connect/disconnect
// produces a CLEARLY VISIBLE delta on the score ring.
//   • TARGET_PLATFORMS=8 → each new platform pushes countSub by 12.5 pts
//     (≈ +5 final-score points after the 35% weight). The customer feels
//     the ring move, not a 1-pixel nudge.
//   • TARGET_REVENUE=4 → declaring monthly revenue on 4 platforms maxes
//     the revenue half. Combined countSub (70%) + revenueSub (30%) means
//     a freelancer with 6 active platforms can already cross 70 (bank-
//     ready) without grinding.
//   • TARGET_CLIENTS=5 → realistic mix for a freelancer in the first year.
const TARGET_PLATFORMS  = 8;
const TARGET_REVENUE    = 4;
const TARGET_CLIENTS    = 5;

// Base weights (sum = 100). When AI is absent, its 15 is redistributed.
// Connections is the dominant signal because it proves income is genuine and
// verifiable across digital freelance platforms (Upwork, GitHub, Fiverr, Toptal, etc.)
// — the primary proof for Islamic Factoring eligibility (not bank statements).
const W_CONN   = 35;
const W_PROJ   = 25;
const W_PROOF  = 15;
const W_CLIENT = 10;
const W_AI     = 15;

export interface ScoreInputs {
  connections?: Record<string, { status?: string; verifiedProof?: boolean; monthlyRevenueSAR?: number }>;
  invoices?: Array<{
    status?: string;
    clientName?: string;
    proofVerified?: boolean;
    proofUrl?: string;
  }>;
  /** Latest pipeline composite score 0-100 (from AgentRoom run). 0 = not yet run. */
  latestAiScore?: number;
}

export function computeUnifiedScore(input: ScoreInputs = {}): UnifiedScore {
  // ── Read live state from localStorage if not passed (DB-backed via mirror) ──
  const conns = input.connections ?? safeGet('synergy_connections_v4', {});
  const invs  = input.invoices    ?? safeGet('synergy_invoices_v1', []);
  const aiScore = clamp(input.latestAiScore ?? safeGet<number | null>('synergy_latest_ai_score', null) ?? 0, 0, 100);

  // ── 1) Platform Connections (count + revenue declared, blended) ──
  const connList = Object.values(conns as Record<string, { status?: string; monthlyRevenueSAR?: number }>);
  const connectedCount = connList.filter(c => c?.status === 'connected').length;
  const revenueDeclaredCount = connList.filter(c => c?.status === 'connected' && (c.monthlyRevenueSAR ?? 0) > 0).length;
  const countSub   = Math.min(100, Math.round((connectedCount      / TARGET_PLATFORMS) * 100));
  const revenueSub = Math.min(100, Math.round((revenueDeclaredCount / TARGET_REVENUE)  * 100));
  // 70% from raw count, 30% from revenue-declared coverage. Heavy weight on
  // count so each individual platform connect/disconnect produces a visible
  // delta on the score ring.
  const connRaw = Math.round(countSub * 0.7 + revenueSub * 0.3);

  // ── 2) Project History (paid ratio with overdue penalty) ──
  const invList = (invs as Array<{ status?: string; clientName?: string; proofVerified?: boolean }>);
  const invoiceCount = invList.length;
  const paidCount    = invList.filter(i => i.status === 'paid').length;
  const pendingCount = invList.filter(i => i.status === 'pending').length;
  const overdueCount = invList.filter(i => i.status === 'overdue').length;
  let projectRaw = 0;
  if (invoiceCount > 0) {
    const paidShare    = paidCount    / invoiceCount;
    const pendingShare = pendingCount / invoiceCount;
    const overdueShare = overdueCount / invoiceCount;
    // Pending in good standing earns 50% credit; overdue is fully penalising.
    projectRaw = clamp(Math.round((paidShare + pendingShare * 0.5 - overdueShare) * 100), 0, 100);
  }

  // ── 3) Verified Proofs (% of invoices with proof attached & verified) ──
  const verifiedProofs = invList.filter(i => i.proofVerified === true).length;
  const proofRaw = invoiceCount === 0 ? 0
    : Math.min(100, Math.round((verifiedProofs / Math.max(1, invoiceCount)) * 100));

  // ── 4) Client Diversity (unique paying clients vs target) ──
  const uniqueClients = new Set(
    invList.map(i => (i.clientName || '').trim().toLowerCase()).filter(Boolean)
  ).size;
  const clientRaw = Math.min(100, Math.round((uniqueClients / TARGET_CLIENTS) * 100));

  // ── 5) AI Report (latest pipeline run, 0 if not run) ──
  const aiReportPresent = aiScore > 0;
  const aiRaw = aiScore;

  // ── Weight redistribution: if AI is absent, push its 15 across the rest. ──
  const w = aiReportPresent
    ? { ai: W_AI, conn: W_CONN, proj: W_PROJ, proof: W_PROOF, client: W_CLIENT }
    : (() => {
        // Spread 15 weight pro-rata across the four data-driven slices (sum 85).
        const denom = W_CONN + W_PROJ + W_PROOF + W_CLIENT;
        return {
          ai: 0,
          conn:   Math.round(W_CONN  + (W_AI * W_CONN  / denom)),
          proj:   Math.round(W_PROJ  + (W_AI * W_PROJ  / denom)),
          proof:  Math.round(W_PROOF + (W_AI * W_PROOF / denom)),
          client: Math.round(W_CLIENT+ (W_AI * W_CLIENT/ denom)),
        };
      })();

  // ── Compose components ──
  const components: ScoreComponent[] = [
    {
      key: 'connections',
      label:   `Platform Connections — ${connectedCount}/${TARGET_PLATFORMS} (${revenueDeclaredCount} w/revenue)`,
      labelAr: `المنصات — ${connectedCount}/${TARGET_PLATFORMS} (${revenueDeclaredCount} بإيراد)`,
      weight: w.conn, raw: connRaw, contribution: Math.round((connRaw * w.conn) / 100),
      hint:   connectedCount < TARGET_PLATFORMS ? `Connect ${TARGET_PLATFORMS - connectedCount} more platforms`
            : revenueDeclaredCount < TARGET_REVENUE ? `Declare monthly revenue on ${TARGET_REVENUE - revenueDeclaredCount} more`
            : 'All target platforms connected & verified',
      hintAr: connectedCount < TARGET_PLATFORMS ? `اربط ${TARGET_PLATFORMS - connectedCount} منصات إضافية`
            : revenueDeclaredCount < TARGET_REVENUE ? `أدخل إيراداً شهرياً على ${TARGET_REVENUE - revenueDeclaredCount} منصات`
            : 'كل المنصات مربوطة وموثّقة',
    },
    {
      key: 'projects',
      label:   `Project History — ${paidCount}/${invoiceCount || 0} paid · ${overdueCount} overdue`,
      labelAr: `سجل المشاريع — ${paidCount}/${invoiceCount || 0} مدفوعة · ${overdueCount} متأخرة`,
      weight: w.proj, raw: projectRaw, contribution: Math.round((projectRaw * w.proj) / 100),
      hint:   invoiceCount === 0 ? 'Add your invoices in Manual Input'
            : overdueCount > 0 ? `${overdueCount} overdue invoice${overdueCount === 1 ? '' : 's'} dragging score down`
            : 'Healthy payment history',
      hintAr: invoiceCount === 0 ? 'أضف فواتيرك في الإدخال اليدوي'
            : overdueCount > 0 ? `${overdueCount} فاتورة متأخرة تخفض السكور`
            : 'تاريخ دفع صحي',
    },
    {
      key: 'proofs',
      label:   `Verified Proofs — ${verifiedProofs}/${invoiceCount || 0}`,
      labelAr: `إثباتات موثّقة — ${verifiedProofs}/${invoiceCount || 0}`,
      weight: w.proof, raw: proofRaw, contribution: Math.round((proofRaw * w.proof) / 100),
      hint:   invoiceCount === 0 ? 'No invoices yet — upload first'
            : verifiedProofs === 0 ? 'Upload invoice/contract proofs'
            : verifiedProofs < invoiceCount ? `Verify ${invoiceCount - verifiedProofs} more proofs`
            : 'All invoices have verified proofs',
      hintAr: invoiceCount === 0 ? 'لا فواتير بعد'
            : verifiedProofs === 0 ? 'ارفع إثباتات الفواتير'
            : verifiedProofs < invoiceCount ? `وثّق ${invoiceCount - verifiedProofs} إثباتات إضافية`
            : 'كل الفواتير موثّقة',
    },
    {
      key: 'clients',
      label:   `Client Diversity — ${uniqueClients}/${TARGET_CLIENTS}`,
      labelAr: `تنوّع العملاء — ${uniqueClients}/${TARGET_CLIENTS}`,
      weight: w.client, raw: clientRaw, contribution: Math.round((clientRaw * w.client) / 100),
      hint:   uniqueClients < TARGET_CLIENTS ? `Add ${TARGET_CLIENTS - uniqueClients} more unique clients`
            : 'Strong client diversity',
      hintAr: uniqueClients < TARGET_CLIENTS ? `أضف ${TARGET_CLIENTS - uniqueClients} عملاء جدد`
            : 'تنوّع عملاء قوي',
    },
    {
      key: 'ai',
      label:   aiReportPresent ? `AI Report — last run ${aiScore}/100` : 'AI Report — not run yet',
      labelAr: aiReportPresent ? `تقرير الذكاء — آخر تشغيل ${aiScore}/100` : 'تقرير الذكاء — لم يُشغّل',
      weight: w.ai, raw: aiRaw, contribution: Math.round((aiRaw * w.ai) / 100),
      hint:   aiReportPresent ? 'Latest pipeline run cached' : 'Run the AI pipeline in Agent Room (+15 weight)',
      hintAr: aiReportPresent ? 'تم تحليل آخر تشغيل' : 'شغّل التحليل في غرفة الوكلاء (+15 وزن)',
    },
  ];

  const total = clamp(components.reduce((s, c) => s + c.contribution, 0), 0, 100);

  let tier: UnifiedScore['tier'] = 'poor';
  if (total >= 85) tier = 'excellent';
  else if (total >= 70) tier = 'good';
  else if (total >= 50) tier = 'fair';

  const nextThreshold = total < 50 ? 50 - total
                      : total < 70 ? 70 - total
                      : total < 85 ? 85 - total
                      : 0;

  return {
    total,
    bankReady: total >= 70,
    tier,
    components,
    meta: {
      connectedCount,
      targetPlatformCount: TARGET_PLATFORMS,
      revenueDeclaredCount,
      paidCount,
      invoiceCount,
      overdueCount,
      uniqueClients,
      verifiedProofs,
      aiReportPresent,
      nextThreshold,
    },
  };
}

/** Persist the latest pipeline composite score so all pages share it. */
export function persistLatestAiScore(score: number) {
  try {
    localStorage.setItem('synergy_latest_ai_score', String(clamp(score, 0, 100)));
    // Broadcast so the score ring, banners and credit panel re-render live
    // the moment an AgentRoom run completes.
    window.dispatchEvent(new Event('synergy:store-changed'));
  } catch { /**/ }
}

export function tierColor(tier: UnifiedScore['tier']): string {
  switch (tier) {
    case 'excellent': return '#059669';
    case 'good':      return '#2563eb';
    case 'fair':      return '#d97706';
    default:          return '#dc2626';
  }
}

export function tierLabel(tier: UnifiedScore['tier'], lang: 'ar' | 'en' = 'en'): string {
  if (lang === 'ar') {
    return tier === 'excellent' ? 'ممتاز'
         : tier === 'good'      ? 'جيد — جاهز للبنك'
         : tier === 'fair'      ? 'متوسط'
         :                        'ضعيف';
  }
  return tier === 'excellent' ? 'Excellent'
       : tier === 'good'      ? 'Good — Bank-Ready'
       : tier === 'fair'      ? 'Fair'
       :                        'Poor';
}

// ── helpers ─────────────────────────────────────────────────────────
function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }
function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}
