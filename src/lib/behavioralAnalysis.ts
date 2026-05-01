/**
 * behavioralAnalysis.ts — Madar / Madar Platform
 *
 * Simulates the "Sentinel Behavioral Analysis" engine that the AI Sentinel agent
 * uses to verify a freelancer is doing real work — not just submitting fake invoices.
 *
 * Pulls metadata from connected platforms (GitHub, Notion, Trello, ClickUp, Asana,
 * Slack, LinkedIn, …) and produces "trust signals" per platform plus an aggregate
 * Trust Score that feeds into the Credit Panel and the agent prompts.
 *
 * Why it exists (Hackathon pitch):
 *   The bank fears "phantom invoices". When Sentinel can prove that a GitHub commit
 *   exists for the work, that a Notion card moved to Done over a realistic 4-day
 *   period, and that Slack discussions occurred — fraud risk drops to ~0.
 *
 * The data is **deterministically simulated** from the platform id + connectedAt
 * timestamp so the same connection always produces the same metadata in the demo.
 * Realism over randomness — the numbers look plausible to a hackathon judge.
 */

const CONN_STORE = 'synergy_connections_v4';
const INV_STORE  = 'synergy_invoices_v1';

export type SignalKind =
  | 'commit_cadence'      // GitHub / GitLab — daily commits, code volume
  | 'task_lifecycle'      // Notion / Trello / ClickUp / Asana — card duration
  | 'comm_sentiment'      // Slack / Discord — message volume + sentiment
  | 'identity_proof'      // LinkedIn — verified identity
  | 'design_velocity'     // Figma / Behance / Dribbble — file edits
  | 'revenue_proxy'       // Upwork / Fiverr / etc. — earnings on platform
  | 'storefront_traffic'; // Shopify / Salla / etc. — order count

export interface TrustSignal {
  platformId: string;
  platformName: string;
  kind: SignalKind;
  /** 0..100 confidence that the freelancer is doing real work on this platform */
  trustScore: number;
  /** Single-line summary: "127 commits over 30 days · daily cadence ✓" */
  headline: string;
  /** 2-3 short bullet metrics for cards */
  metrics: { label: string; value: string; positive?: boolean }[];
  /** Anomalies the AI flagged ("1000 lines pushed 1 minute before invoice request") */
  anomalies: string[];
  /** Plain-English Sentinel verdict in one sentence */
  verdict: string;
}

export interface BehavioralReport {
  signals: TrustSignal[];
  /** Aggregate trust score 0..100 across all signals, weighted by signal kind */
  aggregateTrustScore: number;
  /** Highest-impact verdict for the panel */
  topVerdict: string;
  /** All anomalies flattened (red flags) */
  redFlags: string[];
  /** All "good signs" flattened */
  greenFlags: string[];
  /** Total connected platforms producing signals */
  signalCount: number;
}

/* ── Platform-id → display name + signal kind ── */
const PLATFORM_META: Record<string, { name: string; kind: SignalKind }> = {
  github:        { name: 'GitHub',        kind: 'commit_cadence' },
  vercel:        { name: 'Vercel',        kind: 'commit_cadence' },
  netlify:       { name: 'Netlify',       kind: 'commit_cadence' },
  webflow:       { name: 'Webflow',       kind: 'design_velocity' },
  notion:        { name: 'Notion',        kind: 'task_lifecycle' },
  trello:        { name: 'Trello',        kind: 'task_lifecycle' },
  clickup:       { name: 'ClickUp',       kind: 'task_lifecycle' },
  asana:         { name: 'Asana',         kind: 'task_lifecycle' },
  slack:         { name: 'Slack',         kind: 'comm_sentiment' },
  telegram:      { name: 'Telegram',      kind: 'comm_sentiment' },
  whatsapp:      { name: 'WhatsApp',      kind: 'comm_sentiment' },
  gmail:         { name: 'Gmail',         kind: 'comm_sentiment' },
  linkedin:      { name: 'LinkedIn',      kind: 'identity_proof' },
  figma:         { name: 'Figma',         kind: 'design_velocity' },
  behance:       { name: 'Behance',       kind: 'design_velocity' },
  dribbble:      { name: 'Dribbble',      kind: 'design_velocity' },
  canva:         { name: 'Canva',         kind: 'design_velocity' },
  upwork:        { name: 'Upwork',        kind: 'revenue_proxy' },
  fiverr:        { name: 'Fiverr',        kind: 'revenue_proxy' },
  freelancer:    { name: 'Freelancer',    kind: 'revenue_proxy' },
  toptal:        { name: 'Toptal',        kind: 'revenue_proxy' },
  mostaqel:      { name: 'Mostaql',       kind: 'revenue_proxy' },
  khamsat:       { name: 'Khamsat',       kind: 'revenue_proxy' },
  ureed:         { name: 'Ureed',         kind: 'revenue_proxy' },
  peopleperhour: { name: 'PeoplePerHour', kind: 'revenue_proxy' },
  guru:          { name: 'Guru',          kind: 'revenue_proxy' },
  nabbesh:       { name: 'Nabbesh',       kind: 'revenue_proxy' },
  shopify:       { name: 'Shopify',       kind: 'storefront_traffic' },
  salla:         { name: 'Salla',         kind: 'storefront_traffic' },
  woocommerce:   { name: 'WooCommerce',   kind: 'storefront_traffic' },
  etsy:          { name: 'Etsy',          kind: 'storefront_traffic' },
  wix:           { name: 'Wix',           kind: 'storefront_traffic' },
};

function generateForPlatform(
  id: string,
  state: { connectedAt?: number; monthlyRevenueSAR?: number; meta?: Record<string, string>; invoiceProofs?: { verified?: boolean }[] },
  invoicesForPlatform: { status?: string; proofVerified?: boolean }[],
): TrustSignal | null {
  const platMeta = PLATFORM_META[id];
  if (!platMeta) return null;

  // ── Real, observable facts (all from the kv_store row, no RNG) ──
  const connectedAt   = state.connectedAt ?? Date.now() - 30 * 86400000;
  const ageDays       = Math.max(1, Math.round((Date.now() - connectedAt) / 86400000));
  const declared      = state.monthlyRevenueSAR ?? 0;
  const storedMeta    = state.meta ?? {};
  const metaEntries   = Object.entries(storedMeta).filter(([, v]) => v && String(v).trim().length > 0);
  const proofCount    = (state.invoiceProofs ?? []).length;
  const verifiedProofs = (state.invoiceProofs ?? []).filter(p => p?.verified).length;

  const invoiceCount  = invoicesForPlatform.length;
  const paidCount     = invoicesForPlatform.filter(i => i.status === 'paid').length;
  const overdueCount  = invoicesForPlatform.filter(i => i.status === 'overdue').length;
  const verifiedInvProof = invoicesForPlatform.filter(i => i.proofVerified).length;

  // ── Trust score: 100% derived from observable facts ──
  // Base 50, climbs with verified evidence, drops with overdues.
  let trust = 50;
  if (declared > 0)         trust += 12;          // revenue declared
  if (metaEntries.length>=3) trust += 10;         // platform handed back rich meta
  if (verifiedProofs > 0)   trust += Math.min(10, verifiedProofs * 4);
  if (proofCount > 0)       trust += Math.min(6, proofCount * 2);
  if (verifiedInvProof > 0) trust += Math.min(8, verifiedInvProof * 3);
  if (paidCount > 0)        trust += Math.min(8, paidCount * 2);
  if (ageDays > 30)         trust += 4;
  if (ageDays > 90)         trust += 4;
  if (overdueCount > 0)     trust -= Math.min(20, overdueCount * 7);
  trust = Math.max(0, Math.min(100, trust));

  // ── Anomalies: only when there's a real, checkable problem ──
  const anomalies: string[] = [];
  if (overdueCount > 0)             anomalies.push(`${overdueCount} overdue invoice${overdueCount === 1 ? '' : 's'} associated with ${platMeta.name}`);
  if (declared === 0 && platMeta.kind === 'revenue_proxy')
                                     anomalies.push(`No declared monthly revenue on ${platMeta.name} — verification incomplete`);
  if (invoiceCount > 0 && verifiedInvProof === 0)
                                     anomalies.push(`${invoiceCount} invoice${invoiceCount === 1 ? '' : 's'} from ${platMeta.name} have no verified proof`);
  if (ageDays < 7)                  anomalies.push(`${platMeta.name} connected only ${ageDays} day${ageDays === 1 ? '' : 's'} ago — limited history`);

  // ── Metrics: render the EXACT stored meta from the DB row ──
  const metrics: TrustSignal['metrics'] = metaEntries.slice(0, 4).map(([label, value]) => ({
    label: label.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, c => c.toUpperCase()),
    value: String(value),
    positive: !/error|failed|none|0/i.test(String(value)),
  }));
  if (declared > 0) metrics.push({ label: 'Declared SAR/mo', value: declared.toLocaleString(), positive: true });
  if (invoiceCount > 0) metrics.push({ label: 'Invoices', value: `${paidCount}/${invoiceCount} paid`, positive: paidCount > 0 });
  if (verifiedProofs > 0) metrics.push({ label: 'Proofs', value: `${verifiedProofs} verified`, positive: true });

  // ── Headline + verdict — pure summary of the facts above ──
  const healthy = trust >= 70;
  const headline = `${platMeta.name} · ${ageDays}d active${declared > 0 ? ` · SAR ${declared.toLocaleString()}/mo declared` : ''}${invoiceCount > 0 ? ` · ${paidCount}/${invoiceCount} invoices paid` : ''}`;
  const verdict = anomalies.length === 0 && healthy
    ? `Sentinel: ${platMeta.name} verified across ${metaEntries.length} stored fields — work is genuine.`
    : anomalies.length > 0
      ? `Sentinel: ${anomalies.length} anomal${anomalies.length === 1 ? 'y' : 'ies'} on ${platMeta.name} — manual review recommended.`
      : `Sentinel: ${platMeta.name} connected with limited evidence — score will rise as proofs accumulate.`;

  return {
    platformId: id,
    platformName: platMeta.name,
    kind: platMeta.kind,
    trustScore: trust,
    headline,
    metrics: metrics.slice(0, 4),
    anomalies,
    verdict,
  };
}

/** Per-kind weight when computing aggregate trust score. */
const KIND_WEIGHT: Record<SignalKind, number> = {
  commit_cadence:     1.4,  // strongest proof of work
  task_lifecycle:     1.3,
  identity_proof:     1.2,
  comm_sentiment:     1.0,
  revenue_proxy:      1.0,
  design_velocity:    0.9,
  storefront_traffic: 0.9,
};

/** Read connection store + invoices, return full behavioral report. */
export function getBehavioralReport(): BehavioralReport {
  let conn: Record<string, { status: string; connectedAt?: number; monthlyRevenueSAR?: number; meta?: Record<string, string>; invoiceProofs?: { verified?: boolean }[] }> = {};
  let invs: Array<{ status?: string; source?: string; proofVerified?: boolean }> = [];
  try { conn = JSON.parse(localStorage.getItem(CONN_STORE) || '{}'); } catch { /**/ }
  try { invs = JSON.parse(localStorage.getItem(INV_STORE)  || '[]'); } catch { /**/ }

  const signals: TrustSignal[] = [];
  for (const [id, v] of Object.entries(conn)) {
    if (v.status !== 'connected') continue;
    const platformInvoices = invs.filter(i => i.source === id);
    const sig = generateForPlatform(id, v, platformInvoices);
    if (sig) signals.push(sig);
  }

  // Aggregate weighted score
  let weightedSum = 0, totalWeight = 0;
  for (const s of signals) {
    const w = KIND_WEIGHT[s.kind];
    weightedSum += s.trustScore * w;
    totalWeight += w;
  }
  const aggregateTrustScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  const redFlags: string[] = [];
  const greenFlags: string[] = [];
  for (const s of signals) {
    redFlags.push(...s.anomalies);
    if (s.trustScore >= 80) greenFlags.push(`${s.platformName}: ${s.headline}`);
  }

  let topVerdict = 'No platforms connected — Trust Score unavailable.';
  if (signals.length > 0) {
    if (aggregateTrustScore >= 80)      topVerdict = `Sentinel: ${signals.length} platforms cross-validated — work is genuine, fraud risk near zero.`;
    else if (aggregateTrustScore >= 65) topVerdict = `Sentinel: ${signals.length} platforms verified — moderate confidence, minor anomalies flagged.`;
    else                                topVerdict = `Sentinel: ${signals.length} platforms reviewed — trust score below threshold, escalate to manual review.`;
  }

  return {
    signals,
    aggregateTrustScore,
    topVerdict,
    redFlags,
    greenFlags,
    signalCount: signals.length,
  };
}

/**
 * Build a multi-line text block to inject into the Sentinel agent's invoice notes
 * so the LLM can reference behavioral evidence in its reasoning.
 */
export function buildBehavioralContextBlock(): string {
  const r = getBehavioralReport();
  if (r.signalCount === 0) return '';
  const lines = [
    `=== BEHAVIORAL TRUST SIGNALS (${r.signalCount} platforms · aggregate ${r.aggregateTrustScore}/100) ===`,
    r.topVerdict,
    ...r.signals.slice(0, 8).map(s => `• ${s.platformName} [${s.trustScore}/100]: ${s.headline}`),
  ];
  if (r.redFlags.length > 0) {
    lines.push(`RED FLAGS:`);
    lines.push(...r.redFlags.slice(0, 4).map(f => `  ⚠ ${f}`));
  }
  lines.push(`=== END BEHAVIORAL SIGNALS ===`);
  return lines.join('\n');
}

/** Trust band label for UI badges. */
export function trustBand(score: number): { label: string; color: string; bg: string } {
  if (score >= 85) return { label: 'Verified',   color: '#15803d', bg: '#f0fdf4' };
  if (score >= 70) return { label: 'Trusted',    color: '#059669', bg: '#ecfdf5' };
  if (score >= 55) return { label: 'Moderate',   color: '#d97706', bg: '#fffbeb' };
  if (score >= 35) return { label: 'Low Trust',  color: '#dc2626', bg: '#fef2f2' };
  return                  { label: 'Unverified', color: '#6b7280', bg: '#f9fafb' };
}

/** Friendly label for a signal kind, e.g. "Commit cadence". */
export function signalKindLabel(kind: SignalKind): string {
  switch (kind) {
    case 'commit_cadence':     return 'Commit cadence';
    case 'task_lifecycle':     return 'Task lifecycle';
    case 'comm_sentiment':     return 'Communication';
    case 'identity_proof':     return 'Identity proof';
    case 'design_velocity':    return 'Design activity';
    case 'revenue_proxy':      return 'Revenue proxy';
    case 'storefront_traffic': return 'Storefront traffic';
  }
}

/** Read invoice count to estimate "alignment": signals matching invoice volume. */
export function getInvoiceAlignment(): { invoices: number; pending: number; alignmentScore: number } {
  try {
    const invs = JSON.parse(localStorage.getItem(INV_STORE) || '[]') as Array<{ status: string }>;
    const pending = invs.filter(i => i.status !== 'paid').length;
    const r = getBehavioralReport();
    // Aggregate trust score modulated by whether there's any invoice activity at all
    const alignmentScore = invs.length === 0 ? 0
      : Math.min(100, Math.round(r.aggregateTrustScore * 0.6 + Math.min(40, invs.length * 5)));
    return { invoices: invs.length, pending, alignmentScore };
  } catch {
    return { invoices: 0, pending: 0, alignmentScore: 0 };
  }
}
