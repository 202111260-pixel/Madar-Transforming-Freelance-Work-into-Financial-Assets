/* ════════════════════════════════════════════════════════════════════════
 * AHMED AL-SAQRI — Freelance Graphic Designer Seed
 * ────────────────────────────────────────────────────────────────────────
 * Persona (per product directive 2026-05-01):
 *   • Persona: Ahmed Al-Saqri — graphic designer based in Muscat, Oman.
 *   • Acquisition channel: TikTok / Instagram / X / Snapchat (Arab social).
 *   • Average ticket: OMR 80-95 per client (logo / story / reel cover).
 *   • Volume: 30 clients in the last ~30 days.
 *   • Behaviour mix: ~60% paid on time, ~17% paid late, ~13% pending,
 *     ~7% overdue, ~3% ghosted.
 *   • Currency: 100% OMR — no SAR / USD on this profile.
 *
 * The behavioural diversity teaches the AI agents:
 *   – Sentinel: which social-channel handles ghost (e.g. @cryptokid_om).
 *   – Negotiator: which DM channel reopens the conversation fastest.
 *   – Treasurer: 30-day cash position from paid + pending - overdue mix.
 *
 * Run: node scripts/seed_ahmed_to_supabase.cjs   (PGPASSWORD env required)
 * ════════════════════════════════════════════════════════════════════════ */
const { Client } = require('pg');

const WORKSPACE = 'salem-habsi-demo';
const DEMO_CONTACT_PHONE = '+96896737698';
const DEMO_CONTACT_EMAIL = '202111260@gcet.edu.om';

const now = Date.now();
const day = 86400000;
const fmt = (ts) => new Date(ts).toISOString().slice(0, 10);
// Deterministic pseudo-random so every reseed is byte-identical.
let seed = 0x1f3a;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => Math.round(a + rnd() * (b - a));

// ── 0) USER PROFILE ─────────────────────────────────────────────────────
const userProfile = {
  name: 'Ahmed Al-Saqri',
  role: 'Freelance Graphic Designer · Brand & Social Content',
  country: 'Oman',
  city: 'Muscat',
  homeCurrency: 'OMR',
  email: DEMO_CONTACT_EMAIL,
  phone: DEMO_CONTACT_PHONE,
  joinedAt: now - 120 * day,
  bio: 'Logo design, social-media kits, reel covers and brand identity for small Arab businesses. Most clients arrive via TikTok and Instagram DMs.',
};

// ── 1) CONNECTIONS — designer-relevant only ─────────────────────────────
const connections = {
  instagram: { status: 'connected', meta: { handle: '@ahmed.saqri.design', followers: '24.8k', posts: '312', dms_30d: '186' }, connectedAt: now - 110 * day, monthlyRevenueSAR: 4800 },
  tiktok:    { status: 'connected', meta: { handle: '@ahmedsaqri', followers: '48.3k', videos: '94', avg_views: '32k', dms_30d: '241' }, connectedAt: now - 105 * day, monthlyRevenueSAR: 6200 },
  snapchat:  { status: 'connected', meta: { handle: 'ahmed-saqri', subs: '12.1k', stories_30d: '58' }, connectedAt: now - 100 * day, monthlyRevenueSAR: 1900 },
  twitter:   { status: 'connected', meta: { handle: '@ahmedsaqri_', followers: '6.4k', engagement: '4.8%' }, connectedAt: now - 92  * day, monthlyRevenueSAR: 1200 },
  behance:   { status: 'connected', meta: { profile: 'ahmedsaqri', projects: '38', appreciations: '2,140' }, connectedAt: now - 80  * day },
  dribbble:  { status: 'connected', meta: { profile: 'ahmedsaqri', shots: '54', followers: '1.8k' }, connectedAt: now - 74  * day },
  figma:     { status: 'connected', meta: { teams: '1', files: '62 active', collaborators: '4' }, connectedAt: now - 60  * day },
  notion:    { status: 'connected', meta: { workspace: 'Saqri Studio', pages: '142', databases: '6 (clients · briefs · invoices)' }, connectedAt: now - 55  * day },
  whatsapp:  { status: 'connected', meta: { business: 'Saqri Design', chats_30d: '298', avg_response: '12 min' }, connectedAt: now - 48  * day },
  mostaqel:  { status: 'connected', meta: { profile: 'موثّق', completed: '14 مشروع', rating: '4.96★' }, connectedAt: now - 42  * day, monthlyRevenueSAR: 1800 },
  khamsat:   { status: 'connected', meta: { tier: 'بائع موثّق', orders: '83 طلب مكتمل', rating: '5.0★' }, connectedAt: now - 36  * day, monthlyRevenueSAR: 1100 },
  stripe:    { status: 'connected', meta: { account: 'acct_live_OM_AS', payouts: '54 payouts/30d', mrr: 'OMR 2,640' }, connectedAt: now - 22  * day, monthlyRevenueSAR: 25700 },
};

// ── 2) CLIENTS + INVOICES — 30 clients sourced from social ─────────────
const handles = [
  '@noor_boutique',     '@sara_atelier',      '@laila_threads',     '@hessa_perfumes',
  '@maha_beauty_om',    '@reem_jewels',       '@aisha_kitchen',     '@fatma_florist',
  '@nada_cakes_muscat', '@asma_lingerie',     '@huda_hijab_house',  '@yasmin_skin',
  '@ahmad.cars.muscat', '@khaled_marketing',  '@omar.gym.suhar',    '@saif_oud',
  '@mohamed_dates_om',  '@sami_realestate',   '@bader_books_house', '@yousef_pet_shop',
  '@taha_tech_repair',  '@hadi_burger_house', '@majid_fashion_om',  '@cryptokid_om',
  '@nabil_clinic_dent', '@waleed_motors',     '@firas_fitness_app', '@rashed_coffee_om',
  '@fares_films_studio',  '@jamal_carpentry',
];

const behaviours = [
  ...Array(18).fill('paid'),
  ...Array(5).fill('paid-late'),
  ...Array(4).fill('pending'),
  ...Array(2).fill('overdue'),
  ...Array(1).fill('ghost'),
];

const services = [
  { type: 'Logo design',                 base: 90 },
  { type: 'Instagram story pack (10)',   base: 80 },
  { type: 'TikTok cover set (6)',        base: 85 },
  { type: 'Brand identity mini-pack',    base: 95 },
  { type: 'Reel intro animation',        base: 88 },
  { type: 'Snap geofilter + ad',         base: 82 },
  { type: 'Logo refresh + guidelines',   base: 90 },
  { type: 'Menu redesign (PDF + print)', base: 85 },
];

const sources = ['tiktok', 'instagram', 'snapchat', 'twitter', 'whatsapp'];

const clients = [];
const invoices = [];

for (let i = 0; i < 30; i++) {
  const handle  = handles[i];
  const behav   = behaviours[i % behaviours.length];
  const service = pick(services);
  const source  = pick(sources);
  const amount  = between(80, 95);
  const issueDaysAgo = between(3, 28);
  const issueTs = now - issueDaysAgo * day;
  const dueTs   = issueTs + 14 * day;
  const dueDate = fmt(dueTs);

  let status = 'pending';
  let paidDate;
  if (behav === 'paid') {
    paidDate = fmt(dueTs - between(0, 3) * day);
    status   = 'paid';
  } else if (behav === 'paid-late') {
    paidDate = fmt(Math.min(now, dueTs + between(3, 12) * day));
    status   = 'paid';
  } else if (behav === 'pending') {
    status = dueTs > now ? 'pending' : 'overdue';
  } else if (behav === 'overdue' || behav === 'ghost') {
    status = 'overdue';
  }

  const id  = 'inv-' + String(i + 1).padStart(3, '0');
  const cid = 'cl-'  + String(i + 1).padStart(3, '0');

  const inv = {
    id, clientName: handle, amount, currency: 'OMR',
    issueDate: fmt(issueTs), dueDate, status, source,
    description: service.type,
    clientNotes: behav === 'ghost'
      ? 'No reply for 9+ days. Possible runaway risk — escalate via WhatsApp number on file.'
      : behav === 'overdue'
      ? 'Past due. One reminder sent on the original DM channel.'
      : behav === 'paid-late'
      ? 'Cleared after follow-up reminder. Recurring late-payer.'
      : 'Sourced via ' + source + ' DM. Pre-brief via voice note.',
    clientHistory: behav === 'paid' ? 'Clean record — pays on time.'
                  : behav === 'paid-late' ? 'Always pays, but typically 5-10 days late.'
                  : behav === 'overdue' ? 'First late event — watch.'
                  : behav === 'ghost' ? 'Stopped replying — HIGH risk.'
                  : 'Active brief in progress.',
    clientPhone: DEMO_CONTACT_PHONE,
    clientEmail: DEMO_CONTACT_EMAIL,
  };
  if (paidDate) inv.paidDate = paidDate;
  if (status === 'paid' && i % 3 === 0) {
    inv.proofVerified    = true;
    inv.proofName        = `proof-${id}.pdf`;
    inv.connectionSource = source;
  }
  invoices.push(inv);

  const totalPaid = status === 'paid' ? amount : 0;
  const risk = behav === 'ghost' ? 'HIGH'
             : behav === 'overdue' ? 'HIGH'
             : behav === 'paid-late' ? 'MEDIUM'
             : 'LOW';
  const clStatus = behav === 'ghost' ? 'ghost'
                 : behav === 'overdue' ? 'late'
                 : status === 'overdue' ? 'late'
                 : status;
  clients.push({
    id: cid,
    name: handle,
    country: '🇴🇲 Oman',
    source,
    status: clStatus,
    risk,
    totalInvoiced: amount,
    totalPaid,
    currency: 'OMR',
    lastContact: fmt(now - between(1, 14) * day),
    nextDue: status === 'pending' || status === 'overdue' ? dueDate : undefined,
    avgDelayDays: behav === 'ghost' ? 14 : behav === 'overdue' ? 7 : behav === 'paid-late' ? 6 : 0,
    invoiceCount: 1,
    paidCount: status === 'paid' ? 1 : 0,
    notes: inv.clientNotes,
    tags: [source, behav],
    phone: DEMO_CONTACT_PHONE,
    email: DEMO_CONTACT_EMAIL,
    behaviorLog: behav === 'ghost' ? [
      { ts: now - 9 * day, note: 'Last seen reading the DM. No reply since.' },
      { ts: now - 4 * day, note: 'Attempted WhatsApp follow-up — delivered, not read.' },
    ] : behav === 'overdue' ? [
      { ts: now - 3 * day, note: 'Sent gentle reminder on original DM channel.' },
    ] : [],
  });
}

// ── 3) OBLIGATIONS — designer monthly stack ────────────────────────────
const obligations = [
  { id: 'obl-1', label: 'Adobe Creative Cloud',           amount: 28, currency: 'OMR', dueDate: fmt(now + 3  * day) },
  { id: 'obl-2', label: 'Figma Professional',             amount: 6,  currency: 'OMR', dueDate: fmt(now + 5  * day) },
  { id: 'obl-3', label: 'Co-working seat (KOM Muscat)',   amount: 65, currency: 'OMR', dueDate: fmt(now + 9  * day) },
  { id: 'obl-4', label: 'Domain + portfolio hosting',     amount: 9,  currency: 'OMR', dueDate: fmt(now + 12 * day) },
  { id: 'obl-5', label: 'Family contribution (mother)',   amount: 50, currency: 'OMR', dueDate: fmt(now + 18 * day) },
  { id: 'obl-6', label: 'TikTok / IG ad boost (own page)', amount: 35, currency: 'OMR', dueDate: fmt(now + 22 * day) },
];

// ── 4) SCORE HISTORY ───────────────────────────────────────────────────
const scoreHistory = [
  { ts: now - 120 * day, score: 22, label: 'Joined Madar — 0 platforms, 0 invoices' },
  { ts: now - 100 * day, score: 34, label: 'Instagram + TikTok connected — DMs flowing' },
  { ts: now - 80  * day, score: 46, label: 'Behance + Dribbble portfolio verified' },
  { ts: now - 55  * day, score: 58, label: '20 clients on file, 12 paid invoices' },
  { ts: now - 30  * day, score: 67, label: 'Stripe MRR streaming · OMR 2,640' },
  { ts: now - 12  * day, score: 73, label: 'Crossed bank-eligible threshold (≥70)' },
  { ts: now - 2   * day, score: 76, label: 'Current — 30 clients, mixed behaviour' },
];

// ── 5) PROFIT FORECAST ────────────────────────────────────────────────
const profitForecast = {
  currency: 'OMR',
  persona: 'Ahmed Al-Saqri — Freelance Graphic Designer',
  location: 'Muscat, Oman',
  horizonMonths: 1,
  grossRevenue: 2700,
  fixedCosts: 193,
  netProfit: 2507,
  overdueRiskOMR: invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0),
  confidencePct: 84,
};

// ── 6) BANK BALANCE PROJECTION (NEW — agent-driven cashflow forecast) ─
const totalPending = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
const totalOverdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
const totalObl     = obligations.reduce((s, o) => s + o.amount, 0);
const balanceProjection = {
  currency: 'OMR',
  enteredBalance: 380,
  enteredAt: now - 1 * day,
  horizonDays: 30,
  inflowExpected: Math.round(totalPending * 0.92 + totalOverdue * 0.45),
  outflowFixed:   totalObl,
  projectedBalance: 0,
  confidencePct: 81,
  agentRationale: [
    `Pending invoices total OMR ${totalPending}; behavioural model expects 92% recovery within 30 days.`,
    `Overdue invoices total OMR ${totalOverdue}; only 45% recovery probability without intervention.`,
    `Fixed obligations OMR ${totalObl} due this cycle.`,
    `If overdue clients respond to negotiator outreach, projected balance lifts by OMR ${Math.round(totalOverdue * 0.4)}.`,
  ],
  recommendation: 'Score is 76 (≥70 bank-eligible). Bridge advance recommended ONLY if cash dips below OMR 200.',
};
balanceProjection.projectedBalance = Math.round(
  balanceProjection.enteredBalance + balanceProjection.inflowExpected - balanceProjection.outflowFixed,
);

// ── 7) ACTIVITY LOG ────────────────────────────────────────────────────
const log = [];
log.push({ type: 'connection_added', label: 'Account Created', detail: 'Ahmed Al-Saqri joined Madar · Muscat, Oman · OMR · graphic designer · social-first', ref: 'ONBOARD', ts: now - 120 * day });
for (const [pid, c] of Object.entries(connections)) {
  log.push({ type: 'connection_added', label: 'Platform Connected', detail: `${pid} · ${Object.entries(c.meta).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ')}`, ref: `CONN-${pid}`, ts: c.connectedAt });
}
for (const inv of invoices) {
  log.push({ type: 'invoice_added', label: 'Invoice Added', detail: `${inv.clientName} · OMR ${inv.amount} · ${inv.description} · ${inv.status}`, ref: inv.id, ts: new Date(inv.issueDate).getTime() });
  if (inv.status === 'paid' && inv.paidDate) {
    log.push({ type: 'sms_sent', label: 'Payment Received', detail: `${inv.clientName} paid OMR ${inv.amount} (${inv.id})`, ref: `PAID-${inv.id}`, ts: new Date(inv.paidDate).getTime() });
  }
}
for (const m of scoreHistory) {
  log.push({ type: 'behavioral_signal', label: 'Trust Score Update', detail: `Score reached ${m.score}/100 — ${m.label}`, ref: `SCORE-${m.score}`, ts: m.ts });
}
log.push({ type: 'pdf_downloaded',       label: 'Bank Report Generated',    detail: 'PDF risk report — score 76/100 · 12 platforms · 30 clients · all OMR', ref: 'PDF-LATEST',    ts: now - 6 * day });
log.push({ type: 'bank_report_sent',     label: 'Sent to Bank Muscat',      detail: 'Liquidity Bridge inquiry · OMR 200 · pool collateral',                  ref: 'BANK-LATEST',   ts: now - 5 * day });
log.push({ type: 'bank_report_reviewed', label: 'Bank Cross-validated',     detail: 'Bank Muscat AI underwriter: trust signals verified · 84% confidence',  ref: 'BANK-REVIEW',   ts: now - 4 * day });
log.push({ type: 'pipeline_complete',    label: 'AI Pipeline Run',          detail: 'Sentinel + Negotiator + Treasurer · master verdict: Use Liquidity Bridge', ref: 'PIPE-LATEST', ts: now - 3 * day });
log.push({ type: 'credit_offer_saved',   label: 'Credit Offer Saved',       detail: 'OMR 200 bridge · 2.2% admin fee · 30-day term · grade A-',              ref: 'OFFER-LATEST',  ts: now - 2 * day });
log.sort((a, b) => b.ts - a.ts);
const activityLog = log.slice(0, 200);

// ── 8) APPROVED CREDIT OFFER ──────────────────────────────────────────
// Must satisfy the legacy CreditOffer shape used by CreditPanelPage.loadOffer().
const creditOffer = {
  offerRef:        'LB-AS' + (now % 10000),
  bankIdx:         0,
  freelancerName:  'Ahmed Al-Saqri',
  activeSince:     fmt(now - 4 * day),
  invoicesPaid:    invoices.filter(i => i.status === 'paid').length,
  invoiceRef:      'inv-pool',
  clientName:      'Multiple ghosted clients (collateral pool)',
  invoiceAmountSAR: Math.round(totalOverdue * 9.75),
  bridgeAmountSAR:  Math.round(200 * 9.75),
  coveragePercent: 85,
  rateMonthly:     2.2,
  termDays:        30,
  repaymentRef:    '#bridge-001',
  pendingSAR:      Math.round(totalPending * 9.75),
  expectedSAR:     Math.round(totalPending * 0.92 * 9.75),
  defaultRisk:     6.5,
  riskScore:       76,
  paymentProb:     84,
  blockchainHash:  '0xa55ed4ee',
  generatedAt:     now - 2 * day,
  status:          'approved',
  tier:            'A-',
  bank:            'Bank Muscat',
  bankCountry:     'Oman',
  product:         'Madar Liquidity Bridge · Islamic Factoring',
  principalOMR:    200,
  feePct:          2.2,
  feeOMR:          4.4,
  monthly:         200,
  collateralInvoiceId:   'inv-pool',
  collateralClient:      'Ghost + overdue pool',
  collateralAmountOMR:   totalOverdue + Math.round(totalPending * 0.4),
  approvedAt:      now - 4 * day,
  acceptedAt:      now - 3 * day,
  fundedAt:        now - 3 * day,
  scoreAtApproval: 76,
  rationale:       'Score ≥73 (bank-eligible) · 12 verified platforms · 18 paid invoices on file · OMR-only persona. Madar takes the credit risk; Bank Muscat funds the OMR 200 principal against the collateral pool.',
};

const bankReview = {
  bank: 'Bank Muscat',
  reviewer: 'Innovation Lab · SME Underwriting',
  decision: 'approved',
  confidencePct: 84,
  signalsVerified: ['12 platform connections', '18 paid invoices last 30d', 'OMR-only persona', 'Sharia-compliant facility'],
  reviewedAt: now - 4 * day,
  notes: 'Madar bears credit risk; bank position fully collateralised by overdue/pending pool. Approved at OMR 200 ceiling.',
};

const bridgeAdvance = {
  id: 'bridge-001',
  status: 'awaiting-client',
  principalOMR:        200,
  feePct:              2.2,
  feeOMR:              4.4,
  netToFreelancerOMR:  195.6,
  totalDueToBankOMR:   200,
  bank:               'Bank Muscat',
  bankAccount:        'BM-INNOV-LAB',
  freelancer:         'Ahmed Al-Saqri',
  collateralInvoiceId:   'inv-pool',
  collateralClient:      'Ghost + overdue pool (5 invoices)',
  collateralAmountOMR:   totalOverdue + Math.round(totalPending * 0.4),
  collateralOriginalDue: fmt(now - 10 * day),
  collateralDaysOverdue: 10,
  fundedAt:   now - 3 * day,
  dueAt:      now + 27 * day,
  expectedClientPayoutAt: now + 14 * day,
  timeline: [
    { stage: 'submitted',       label: 'Bank submission',         ts: now - 6 * day, detail: 'Credit Panel pushed package — score 76 · pool collateral' },
    { stage: 'reviewed',        label: 'Underwriter cross-check', ts: now - 5 * day, detail: 'Bank Muscat AI underwriter — 84% confidence · all signals verified' },
    { stage: 'approved',        label: 'Approved · OMR 200',      ts: now - 4 * day, detail: 'Grade A- · 30-day bullet · 2.2% admin fee' },
    { stage: 'funded',          label: 'Funds disbursed',         ts: now - 3 * day, detail: 'OMR 195.60 wired to Ahmed (OMR 200 − 2.2% one-time admin fee)' },
    { stage: 'awaiting-client', label: 'Negotiator working pool', ts: now - 3 * day, detail: 'Negotiator escalating overdue clients via DM on original channel' },
  ],
  repayment: {
    source:  'Overdue + pending invoice pool · OMR ' + (totalOverdue + Math.round(totalPending * 0.4)),
    routing: 'When the pool clears, OMR 200 auto-routes to Bank Muscat; the remainder is released to Ahmed.',
    autoSettle: true,
  },
  riba: {
    free: true,
    note: 'Islamic factoring — the 2.2% admin fee is a flat one-time charge, not interest.',
  },
};

const rows = [
  ['synergy_user_profile_v1',       userProfile],
  ['synergy_connections_v4',        connections],
  ['synergy_invoices_v1',           invoices],
  ['synergy_obligations_v1',        obligations],
  ['synergy_clients_v1',            clients],
  ['synergy_activity_log_v1',       activityLog],
  ['synergy_score_history_v1',      scoreHistory],
  ['synergy_latest_ai_score',       76],
  ['synergy_profit_forecast_v1',    profitForecast],
  ['synergy_balance_projection_v1', balanceProjection],
  ['synergy_credit_offer_v1',       creditOffer],
  ['synergy_bank_review_v1',        bankReview],
  ['synergy_bridge_advance_v1',     bridgeAdvance],
];

(async () => {
  const c = new Client({
    host: 'aws-1-ap-northeast-2.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.rqmhdlpcpwpyoojrjaqb',
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  await c.connect();
  console.log(`Connected. Wiping workspace="${WORKSPACE}" …`);
  await c.query('delete from public.kv_store where workspace = $1', [WORKSPACE]);
  await c.query('delete from public.kv_events where workspace = $1', [WORKSPACE]);
  console.log(`Seeding ${rows.length} keys for Ahmed Al-Saqri …`);
  for (const [key, value] of rows) {
    await c.query(
      `insert into public.kv_store (workspace, key, value)
         values ($1, $2, $3::jsonb)
       on conflict (workspace, key) do update set value = excluded.value, updated_at = now()`,
      [WORKSPACE, key, JSON.stringify(value)],
    );
    const size = JSON.stringify(value).length;
    console.log(`  ✓ ${key} (${size} B)`);
  }
  const r = await c.query(
    'select key, jsonb_typeof(value) as type, length(value::text) as size from public.kv_store where workspace = $1 order by key',
    [WORKSPACE],
  );
  console.log(`\nFinal state — ${r.rowCount} rows in workspace ${WORKSPACE}:`);
  for (const x of r.rows) console.log(`  ${x.key} | ${x.type} | ${x.size} B`);
  await c.end();
  console.log('\n✅ Ahmed demo data seeded directly into Supabase.');
})().catch(e => { console.error('SEED FAILED:', e.message); process.exit(1); });
