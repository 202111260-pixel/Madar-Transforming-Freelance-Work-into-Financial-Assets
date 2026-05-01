// Seed Khalid Al-Balushi demo data DIRECTLY into Supabase kv_store.
// Mirrors seedDemoData() from src/components/AppLayout.tsx but writes via pg.
const { Client } = require('pg');

const WORKSPACE = 'salem-habsi-demo';
const DEMO_CONTACT_PHONE = '+96896737698';
const DEMO_CONTACT_EMAIL = '202111260@gcet.edu.om';

const now = Date.now();
const day = 86400000;
const fmt = (ts) => new Date(ts).toISOString().slice(0, 10);

// ── 0) USER PROFILE ─────────────────────────────────────────────
// Forces the entire site to render in Omani Rials (OMR) and binds every
// downstream agent / report to Khalid's identity context.
const userProfile = {
  name: 'Khalid Al-Balushi',
  role: 'Senior Software Engineer · AI/ML Consultant · Freelancer',
  country: 'Oman',
  city: 'Muscat',
  homeCurrency: 'OMR',
  email: DEMO_CONTACT_EMAIL,
  phone: DEMO_CONTACT_PHONE,
  joinedAt: now - 95 * day,
};

// ── 1) CONNECTIONS ─────────────────────────────────────────────────
const connections = {
  github:   { status: 'connected', meta: { handle: '@khalid-balushi', repos: '48 public · 22 private', commits: '2,310 commits last 90d', languages: 'TypeScript · Python · Rust' }, connectedAt: now - 95 * day },
  gitlab:   { status: 'connected', meta: { handle: 'khalid.balushi', mrs: '89 merged MRs', pipelines: '94% pipelines green' }, connectedAt: now - 90 * day },
  notion:   { status: 'connected', meta: { workspace: 'Balushi Labs', pages: '412', databases: '21' }, connectedAt: now - 84 * day },
  slack:    { status: 'connected', meta: { workspaces: '5 client', dms: '2.8k msgs/30d', sentiment: '87% positive' }, connectedAt: now - 78 * day },
  linkedin: { status: 'connected', meta: { profile: 'verified ✓', connections: '3,940', endorsements: '92' }, connectedAt: now - 72 * day },
  figma:    { status: 'connected', meta: { teams: '2', files: '38 active', collaborators: '9' }, connectedAt: now - 60 * day },
  trello:   { status: 'connected', meta: { boards: '7', cards: '224 closed/30d', avgDuration: '3.6 days' }, connectedAt: now - 54 * day },
  upwork:   { status: 'connected', meta: { username: 'khalid-b', completed: '41 jobs completed', rating: '4.98★', repeat: '78%' }, connectedAt: now - 48 * day, monthlyRevenueSAR: 11200 },
  mostaqel: { status: 'connected', meta: { profile: 'موثّق', completed: '27 مشروع مكتمل', rating: '5.0 ★' }, connectedAt: now - 42 * day, monthlyRevenueSAR: 8400 },
  khamsat:  { status: 'connected', meta: { tier: 'بائع موثّق +', orders: '134 طلب مكتمل', rating: '5.0★' }, connectedAt: now - 32 * day, monthlyRevenueSAR: 3800 },
  stripe:   { status: 'connected', meta: { account: 'acct_live_OM_KB', payouts: '42 payouts/90d', mrr: '$5,640' }, connectedAt: now - 22 * day, monthlyRevenueSAR: 21200 },
  vercel:   { status: 'connected', meta: { team: 'balushi-labs', projects: '14', deployments: '512/30d' }, connectedAt: now - 18 * day },
};

// ── 2) INVOICES ────────────────────────────────────────────────────
const invoices = [
  { id: 'inv-001', clientName: 'Bank Muscat — Innovation Lab', amount: 2100, currency: 'OMR', issueDate: fmt(now - 105 * day), dueDate: fmt(now - 75 * day), paidDate: fmt(now - 78 * day), status: 'paid',    source: 'manual',   description: 'AI-driven fraud detection prototype — Python + TensorFlow', clientNotes: 'Anchor client. Innovation Lab funds proof-of-concepts. Pays before due date once PO issued.', clientHistory: 'First sprint of multi-phase AI engagement. Anchor client.' },
  { id: 'inv-002', clientName: 'Petroleum Development Oman (PDO)',   amount: 2800, currency: 'OMR', issueDate: fmt(now - 92 * day),  dueDate: fmt(now - 62 * day), paidDate: fmt(now - 60 * day), status: 'paid',    source: 'manual',   description: 'Pipeline telemetry dashboard — React + Grafana', clientNotes: 'Government-linked. Strict procurement. Email-only communication.', clientHistory: 'First engagement — a govt anchor that other banks recognise.' },
  { id: 'inv-003', clientName: 'stc Bahrain',                        amount: 9500, currency: 'SAR', issueDate: fmt(now - 80 * day),  dueDate: fmt(now - 50 * day), paidDate: fmt(now - 48 * day), status: 'paid',    source: 'upwork',   description: '5G core network analytics — Go service', clientNotes: 'Telco. Slack-first. Pays via Upwork escrow → instant.', clientHistory: 'Sourced via Upwork. Always escrow-paid.' },
  { id: 'inv-004', clientName: 'Careem (UAE)',                       amount: 5400, currency: 'USD', issueDate: fmt(now - 70 * day),  dueDate: fmt(now - 40 * day), paidDate: fmt(now - 39 * day), status: 'paid',    source: 'email',    description: 'Driver onboarding ML risk model', clientNotes: 'Mobility leader. Wire-transfer USD via Stripe.', clientHistory: 'First engagement — paid 1 day before due date.' },
  { id: 'inv-005', clientName: 'Oman Investment Authority',          amount: 1750, currency: 'OMR', issueDate: fmt(now - 65 * day),  dueDate: fmt(now - 35 * day), paidDate: fmt(now - 33 * day), status: 'paid',    source: 'manual',   description: 'Portfolio analytics dashboard — Next.js + DuckDB', clientNotes: 'Sovereign wealth fund. Procurement slow but consistent.', clientHistory: 'First successful project — promising long-term anchor.' },
  { id: 'inv-006', clientName: 'Khamsat — Saeed K.',                 amount: 320,  currency: 'OMR', issueDate: fmt(now - 55 * day),  dueDate: fmt(now - 50 * day), paidDate: fmt(now - 50 * day), status: 'paid',    source: 'khamsat',  description: 'Telegram bot custom commands', clientNotes: 'Khamsat marketplace transaction. Pre-paid via platform escrow.', clientHistory: 'One-off micro-job. No follow-up expected.' },
  { id: 'inv-007', clientName: 'Mostaql — Tarjama Studio',           amount: 1280, currency: 'OMR', issueDate: fmt(now - 48 * day),  dueDate: fmt(now - 18 * day), paidDate: fmt(now - 19 * day), status: 'paid',    source: 'mostaqel', description: 'Arabic NLP pipeline — transformer fine-tune', clientNotes: 'Arabic-first translation house. Pays via Mostaql escrow.', clientHistory: 'Repeat client. Always on-time via escrow.' },
  { id: 'inv-008', clientName: 'Hala Yalla (KSA)',                   amount: 8200, currency: 'SAR', issueDate: fmt(now - 38 * day),  dueDate: fmt(now - 8 * day),  paidDate: fmt(now - 6 * day),  status: 'paid',    source: 'manual',   description: 'Driver heat-map service — Rust + Redis', clientNotes: 'Saudi ride-hailing. Procurement via vendor portal.', clientHistory: 'First engagement, paid 2 days late but in full.' },
  { id: 'inv-009', clientName: 'Bank Muscat — Innovation Lab',       amount: 2400, currency: 'OMR', issueDate: fmt(now - 18 * day),  dueDate: fmt(now + 12 * day), status: 'pending', source: 'manual',   description: 'Fraud detection sprint 2 — model deployment', clientNotes: 'Same anchor client as inv-001. PO issued, payment processing.', clientHistory: 'Anchor — prior invoice paid 3 days early.' },
  { id: 'inv-010', clientName: 'Bank Dhofar — Digital',              amount: 3600, currency: 'OMR', issueDate: fmt(now - 15 * day),  dueDate: fmt(now + 15 * day), status: 'pending', source: 'manual',   description: 'Mobile app refactor — React Native', clientNotes: 'Major Omani bank. New engagement. Net-30 standard.', clientHistory: 'First invoice — tier-1 client, payment expected on time.' },
  { id: 'inv-011', clientName: 'e& UAE (Etisalat)',                  amount: 6800, currency: 'AED', issueDate: fmt(now - 10 * day),  dueDate: fmt(now + 20 * day), status: 'pending', source: 'manual',   description: '5G IoT analytics platform — Python + ClickHouse', clientNotes: 'UAE telco. Slow finance dept (~7 days late typical).', clientHistory: 'First invoice. Watch for delay.' },
  { id: 'inv-012', clientName: 'Hungerstation (KSA)',                amount: 5800, currency: 'SAR', issueDate: fmt(now - 8 * day),   dueDate: fmt(now + 22 * day), status: 'pending', source: 'email',    description: 'Driver routing optimization — OR-Tools', clientNotes: 'Saudi food delivery. Pays via bank wire. Reliable.', clientHistory: 'First engagement — expected on-time.' },
  { id: 'inv-013', clientName: 'Sarwa (UAE)',                        amount: 3400, currency: 'USD', issueDate: fmt(now - 5 * day),   dueDate: fmt(now + 25 * day), status: 'pending', source: 'email',    description: 'Robo-advisor backtest engine', clientNotes: 'UAE wealth-tech. Stripe payment.', clientHistory: 'First engagement.' },
  { id: 'inv-014', clientName: 'Mwasalat (Oman National Transport)', amount: 1900, currency: 'OMR', issueDate: fmt(now - 62 * day),  dueDate: fmt(now - 32 * day), status: 'overdue', source: 'manual',   description: 'Fleet routing optimizer — phase 1', clientNotes: 'Government entity. Budget freeze announced last month. 2 reminders sent — no response from finance.', clientHistory: 'Prior project paid 18 days late. Recurring delays.' },
  { id: 'inv-015', clientName: 'Riyadh Hospitality Co.',             amount: 4500, currency: 'SAR', issueDate: fmt(now - 50 * day),  dueDate: fmt(now - 20 * day), status: 'overdue', source: 'whatsapp', description: 'Reservation system — Next.js + Stripe', clientNotes: 'Hospitality chain. Owner hands-on but disorganized. Stopped replying on WhatsApp 12 days ago.', clientHistory: 'First engagement. Red flag: only WhatsApp confirmation, no formal contract.' },
  { id: 'inv-016', clientName: 'Crypto Startup (UAE)',               amount: 1400, currency: 'USD', issueDate: fmt(now - 45 * day),  dueDate: fmt(now - 15 * day), status: 'overdue', source: 'email',    description: 'Smart contract audit dashboard', clientNotes: 'Founder ghosting on email. Probable runway risk.', clientHistory: 'First invoice. Strong fraud risk signal.' },
];
const verifyIds = new Set(['inv-001', 'inv-002', 'inv-003', 'inv-004', 'inv-005']);
for (const inv of invoices) {
  if (verifyIds.has(inv.id)) {
    inv.proofVerified = true;
    inv.proofName = `proof-${inv.id}.pdf`;
    inv.connectionSource = inv.source === 'upwork' ? 'upwork' : inv.source === 'mostaqel' ? 'mostaqel' : inv.source === 'khamsat' ? 'khamsat' : inv.source === 'whatsapp' ? 'whatsapp' : 'email';
  }
  inv.clientPhone = DEMO_CONTACT_PHONE;
  inv.clientEmail = DEMO_CONTACT_EMAIL;
}

// ── 3) OBLIGATIONS ─────────────────────────────────────────────────
const obligations = [
  { id: 'obl-1', label: 'Office — Knowledge Oasis Muscat (KOM)', amount: 720, currency: 'OMR', dueDate: fmt(now + 4  * day) },
  { id: 'obl-2', label: 'Software stack (Linear · Cursor · Vercel · Notion · Figma)', amount: 195, currency: 'OMR', dueDate: fmt(now + 7  * day) },
  { id: 'obl-3', label: 'Cloud infra (AWS · Supabase · Modal)',   amount: 280, currency: 'OMR', dueDate: fmt(now + 11 * day) },
  { id: 'obl-4', label: 'Subcontractor — ML engineer (part-time)', amount: 460, currency: 'OMR', dueDate: fmt(now + 14 * day) },
  { id: 'obl-5', label: 'Health insurance (Khalid + spouse)',     amount: 105, currency: 'OMR', dueDate: fmt(now + 21 * day) },
];

// ── 4) SCORE HISTORY ───────────────────────────────────────────────
const scoreHistory = [
  { ts: now - 95 * day, score: 28, label: 'Joined Synergy AI — OMR base, 0 platforms' },
  { ts: now - 84 * day, score: 38, label: 'GitHub + GitLab connected, code provenance live' },
  { ts: now - 70 * day, score: 47, label: 'Bank Muscat first invoice paid (OMR 2,100)' },
  { ts: now - 55 * day, score: 56, label: 'PDO contract signed — govt anchor verified' },
  { ts: now - 40 * day, score: 64, label: 'Stripe MRR streaming — USD 5.6k visible to AI' },
  { ts: now - 25 * day, score: 71, label: 'Mostaql + Khamsat tier verified — freelance reputation linked' },
  { ts: now - 10 * day, score: 78, label: 'Score crossed 75 — bank-eligible threshold' },
  { ts: now - 2  * day, score: 81, label: 'Current — underwriter-ready (8 paid, 5 pending, 3 overdue flagged)' },
];

const profitForecast = {
  currency: 'OMR', persona: 'Khalid Al-Balushi — Senior Engineer & AI/ML Consultant',
  location: 'Muscat, Oman', horizonMonths: 3,
  grossRevenue: 14400, fixedCosts: 5250, netProfit: 9150, overdueRiskOMR: 3680, confidencePct: 86,
};

// ── 5) CLIENTS ────────────────────────────────────────────────────
const clients = [
  { id: 'cl-001', name: 'Bank Muscat — Innovation Lab', country: '🇴🇲 Oman', source: 'github',   status: 'active',  risk: 'LOW',    totalInvoiced: 4500, totalPaid: 2100, currency: 'OMR', lastContact: fmt(now - 4*day),  nextDue: fmt(now + 12*day), avgDelayDays: 0,  invoiceCount: 2, paidCount: 1, notes: 'Anchor client. Innovation Lab funds AI/ML POCs and pays before due once PO is issued. Currently in fraud-detection sprint 2.', tags: ['anchor','bank','fintech'] },
  { id: 'cl-002', name: 'Petroleum Development Oman (PDO)', country: '🇴🇲 Oman', source: 'email',  status: 'paid',    risk: 'LOW',    totalInvoiced: 2800, totalPaid: 2800, currency: 'OMR', lastContact: fmt(now - 60*day), avgDelayDays: 0,  invoiceCount: 1, paidCount: 1, notes: 'Government-linked oil major. Strict procurement, email-only. Paid 2 days early — strongest govt anchor.', tags: ['government','energy','anchor'] },
  { id: 'cl-003', name: 'Oman Investment Authority',    country: '🇴🇲 Oman', source: 'linkedin', status: 'paid',    risk: 'LOW',    totalInvoiced: 1750, totalPaid: 1750, currency: 'OMR', lastContact: fmt(now - 33*day), avgDelayDays: 2,  invoiceCount: 1, paidCount: 1, notes: 'Sovereign wealth fund. Procurement slow but consistent. Long-term portfolio analytics roadmap on the table.', tags: ['sovereign','anchor'] },
  { id: 'cl-004', name: 'Bank Dhofar — Digital',        country: '🇴🇲 Oman', source: 'email',    status: 'pending', risk: 'LOW',    totalInvoiced: 3600, totalPaid: 0,    currency: 'OMR', lastContact: fmt(now - 5*day),  nextDue: fmt(now + 15*day), avgDelayDays: 0,  invoiceCount: 1, paidCount: 0, notes: 'Major Omani bank. New engagement, net-30 standard. Mobile app refactor — strategic relationship.', tags: ['bank','new'] },
  { id: 'cl-005', name: 'stc Bahrain',                  country: '🇸🇦 Saudi Arabia', source: 'upwork',  status: 'paid',    risk: 'LOW',    totalInvoiced: 9500, totalPaid: 9500, currency: 'SAR', lastContact: fmt(now - 48*day), avgDelayDays: 0,  invoiceCount: 1, paidCount: 1, notes: 'Telco. Slack-first. Pays via Upwork escrow instantly. Strong repeat potential on 5G workstreams.', tags: ['telco','escrow','repeat'] },
  { id: 'cl-006', name: 'Hala Yalla (KSA)',             country: '🇸🇦 Saudi Arabia', source: 'manual',  status: 'paid',    risk: 'LOW',    totalInvoiced: 8200, totalPaid: 8200, currency: 'SAR', lastContact: fmt(now - 6*day),  avgDelayDays: 2,  invoiceCount: 1, paidCount: 1, notes: 'Saudi ride-hailing. Paid 2 days late but in full. Driver heat-map service running in production.', tags: ['mobility','saudi'] },
  { id: 'cl-007', name: 'Hungerstation (KSA)',          country: '🇸🇦 Saudi Arabia', source: 'email',   status: 'pending', risk: 'LOW',    totalInvoiced: 5800, totalPaid: 0,    currency: 'SAR', lastContact: fmt(now - 3*day),  nextDue: fmt(now + 22*day), avgDelayDays: 0,  invoiceCount: 1, paidCount: 0, notes: 'Saudi food delivery. Reliable bank-wire payer. OR-Tools routing optimization in flight.', tags: ['delivery','saas'] },
  { id: 'cl-008', name: 'Riyadh Hospitality Co.',       country: '🇸🇦 Saudi Arabia', source: 'whatsapp',status: 'late',    risk: 'HIGH',   totalInvoiced: 4500, totalPaid: 0,    currency: 'SAR', lastContact: fmt(now - 12*day), nextDue: fmt(now - 20*day), avgDelayDays: 22, invoiceCount: 1, paidCount: 0, notes: '⚠ Stopped replying on WhatsApp 12 days ago. No formal contract — only WhatsApp confirmation. Possible budget issue.', tags: ['hospitality','high-risk','overdue'] },
  { id: 'cl-009', name: 'Careem (UAE)',                 country: '🇦🇪 UAE', source: 'stripe',   status: 'paid',    risk: 'LOW',    totalInvoiced: 5400, totalPaid: 5400, currency: 'USD', lastContact: fmt(now - 39*day), avgDelayDays: 0,  invoiceCount: 1, paidCount: 1, notes: 'Mobility leader. Wire-transfer USD via Stripe. Paid 1 day before due — model client.', tags: ['mobility','uae'] },
  { id: 'cl-010', name: 'e& UAE (Etisalat)',            country: '🇦🇪 UAE', source: 'manual',   status: 'pending', risk: 'MEDIUM', totalInvoiced: 6800, totalPaid: 0,    currency: 'AED', lastContact: fmt(now - 2*day),  nextDue: fmt(now + 20*day), avgDelayDays: 7,  invoiceCount: 1, paidCount: 0, notes: 'UAE telco. Slow finance dept (~7 days late typical). 5G IoT analytics platform — large strategic deal.', tags: ['telco','uae'] },
  { id: 'cl-011', name: 'Sarwa (UAE)',                  country: '🇦🇪 UAE', source: 'email',    status: 'pending', risk: 'LOW',    totalInvoiced: 3400, totalPaid: 0,    currency: 'USD', lastContact: fmt(now - 1*day),  nextDue: fmt(now + 25*day), avgDelayDays: 0,  invoiceCount: 1, paidCount: 0, notes: 'UAE wealth-tech / robo-advisor. Stripe payment. First engagement, promising backtest engine project.', tags: ['fintech','wealthtech'] },
  { id: 'cl-012', name: 'Crypto Startup (UAE)',         country: '🇦🇪 UAE', source: 'email',    status: 'ghost',   risk: 'HIGH',   totalInvoiced: 1400, totalPaid: 0,    currency: 'USD', lastContact: fmt(now - 15*day), nextDue: fmt(now - 15*day), avgDelayDays: 30, invoiceCount: 1, paidCount: 0, notes: '🚨 Founder ghosting on email. Probable runway risk. Sentinel flagged fraud signal — escalate.', tags: ['crypto','ghost','fraud-risk'] },
  { id: 'cl-013', name: 'Mwasalat (Oman National Transport)', country: '🇴🇲 Oman', source: 'manual', status: 'late', risk: 'HIGH', totalInvoiced: 1900, totalPaid: 0, currency: 'OMR', lastContact: fmt(now - 25*day), nextDue: fmt(now - 32*day), avgDelayDays: 18, invoiceCount: 1, paidCount: 0, notes: '⚠ Government entity. Budget freeze announced. 2 reminders sent, no response. Prior project paid 18 days late.', tags: ['government','transport','overdue'] },
  { id: 'cl-014', name: 'Khamsat — Saeed K.',           country: '🇸🇦 Saudi Arabia', source: 'khamsat', status: 'paid', risk: 'LOW', totalInvoiced: 320, totalPaid: 320, currency: 'OMR', lastContact: fmt(now - 50*day), avgDelayDays: 0, invoiceCount: 1, paidCount: 1, notes: 'One-off Khamsat micro-job. Pre-paid via escrow. Clean transaction.', tags: ['marketplace','khamsat'] },
  { id: 'cl-015', name: 'Mostaql — Tarjama Studio',     country: '🇪🇬 Egypt', source: 'mostaqel', status: 'paid', risk: 'LOW', totalInvoiced: 1280, totalPaid: 1280, currency: 'OMR', lastContact: fmt(now - 19*day), avgDelayDays: 0, invoiceCount: 1, paidCount: 1, notes: 'Arabic-first translation house. Repeat-friendly via Mostaql escrow. Strong Arabic NLP collaboration.', tags: ['marketplace','agency','arabic-nlp'] },
  { id: 'cl-016', name: 'National Bank of Oman (NBO)',  country: '🇴🇲 Oman', source: 'linkedin', status: 'pending', risk: 'LOW', totalInvoiced: 0, totalPaid: 0, currency: 'OMR', lastContact: fmt(now - 1*day), avgDelayDays: 0, invoiceCount: 0, paidCount: 0, notes: 'Prospect — Bank Muscat success story warmed them up. Underwriting team curious about Synergy score.', tags: ['bank','prospect','oman'] },
  { id: 'cl-017', name: 'Bahrain Fintech Bay',          country: '🇧🇭 Bahrain', source: 'linkedin', status: 'pending', risk: 'LOW', totalInvoiced: 0, totalPaid: 0, currency: 'USD', lastContact: fmt(now - 2*day), avgDelayDays: 0, invoiceCount: 0, paidCount: 0, notes: 'Prospect — fintech accelerator interested in AI risk-scoring engine. Intro via LinkedIn.', tags: ['fintech','prospect','bahrain'] },
  { id: 'cl-018', name: 'Talabat Kuwait',               country: '🇰🇼 Kuwait', source: 'manual',  status: 'pending', risk: 'MEDIUM', totalInvoiced: 0, totalPaid: 0, currency: 'USD', lastContact: fmt(now - 6*day), avgDelayDays: 0, invoiceCount: 0, paidCount: 0, notes: 'Prospect — delivery giant scoping driver-routing engagement. Verbal interest, awaiting RFP.', tags: ['delivery','prospect','kuwait'] },
];
for (const c of clients) { c.phone = DEMO_CONTACT_PHONE; c.email = DEMO_CONTACT_EMAIL; }

// ── 6) ACTIVITY LOG ────────────────────────────────────────────────
const log = [];
log.push({ type: 'connection_added', label: 'Account Created', detail: 'Khalid Al-Balushi joined Synergy AI · Muscat, Oman · OMR base · goal: bank-verifiable digital identity', ref: 'ONBOARD', ts: now - 95 * day });
for (const [pid, c] of Object.entries(connections)) {
  log.push({ type: 'connection_added', label: 'Platform Connected', detail: `${pid} · ${Object.entries(c.meta).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ')}`, ref: `CONN-${pid}`, ts: c.connectedAt });
}
for (const inv of invoices) {
  log.push({ type: 'invoice_added', label: 'Invoice Added', detail: `${inv.clientName} · ${inv.currency} ${inv.amount.toLocaleString()} · ${inv.status}`, ref: inv.id, ts: new Date(inv.issueDate).getTime() });
  if (inv.status === 'paid' && inv.paidDate) {
    log.push({ type: 'sms_sent', label: 'Payment Received', detail: `${inv.clientName} paid ${inv.currency} ${inv.amount.toLocaleString()} (invoice ${inv.id})`, ref: `PAID-${inv.id}`, ts: new Date(inv.paidDate).getTime() });
  }
}
for (const m of scoreHistory) {
  log.push({ type: 'behavioral_signal', label: 'Trust Score Update', detail: `Score reached ${m.score}/100 — ${m.label}`, ref: `SCORE-${m.score}`, ts: m.ts });
}
log.push({ type: 'pdf_downloaded',       label: 'Bank Report Generated',    detail: 'PDF risk report exported — score 81/100 · 12 platforms · 18 clients', ref: 'PDF-LATEST',    ts: now - 9 * day });
log.push({ type: 'bank_report_sent',     label: 'Sent to Bank Muscat',      detail: 'Liquidity Bridge inquiry · OMR 3,000 · invoice inv-009 collateral',   ref: 'BANK-LATEST',   ts: now - 8 * day });
log.push({ type: 'bank_report_reviewed', label: 'Bank Cross-validated',     detail: 'Bank Muscat AI underwriter: trust signals verified · 86% confidence', ref: 'BANK-REVIEW',   ts: now - 7 * day });
log.push({ type: 'pipeline_complete',    label: 'AI Pipeline Run',          detail: 'Sentinel + Negotiator + Treasurer · master verdict: Use Liquidity Bridge', ref: 'PIPE-LATEST', ts: now - 6 * day });
log.push({ type: 'credit_offer_saved',   label: 'Credit Offer Saved',       detail: 'OMR 3,000 bridge · 1.0%/mo · 60-day term · grade A-',                ref: 'OFFER-LATEST',  ts: now - 5 * day });
log.sort((a, b) => b.ts - a.ts);
const activityLog = log.slice(0, 200);

// ── 7) APPROVED CREDIT OFFER ─────────────────────────────────────────
// Khalid crossed score 70 → submitted to Bank Muscat → approved.
// This is the offer the Credit Panel surfaced and Khalid accepted.
const creditOffer = {
  status: 'approved',
  tier: 'A-',
  bank: 'Bank Muscat',
  bankCountry: 'Oman',
  product: 'Madar Liquidity Bridge · Islamic Factoring',
  principalOMR: 200,
  feePct: 2.2,                   // flat one-time admin fee
  feeOMR: 4.4,                   // 200 × 2.2%
  termDays: 30,
  monthly: 200,                  // single bullet repayment
  collateralInvoiceId: 'inv-014',
  collateralClient: 'Mwasalat (Oman National Transport)',
  collateralAmountOMR: 1900,
  approvedAt: now - 5 * day,
  acceptedAt: now - 4 * day,
  fundedAt:   now - 4 * day,     // Bank Muscat wired the OMR 200 to Khalid
  scoreAtApproval: 78,
  rationale: 'Score ≥78 (bank-eligible) · 12 verified platforms · 8 paid invoices on file · OMR 1,900 collateral invoice has government counterparty (Mwasalat). Madar takes the risk; Bank Muscat funds the principal.',
};

// ── 8) BANK REVIEW (counterparty side of the offer) ──────────────────────────
const bankReview = {
  bank: 'Bank Muscat',
  reviewer: 'Innovation Lab · SME Underwriting',
  decision: 'approved',
  confidencePct: 86,
  signalsVerified: ['12 platform connections', '8 paid invoices last 90d', 'No riba-bearing instruments', 'Government counterparty on collateral'],
  reviewedAt: now - 5 * day,
  notes: 'Madar bears credit risk; bank position is fully collateralised by the assigned Mwasalat invoice. Approved for the OMR 200 ceiling on the standing facility.',
};

// ── 9) ACTIVE BRIDGE ADVANCE (drives the new BridgeStatusPage) ──────────────────
const bridgeAdvance = {
  id: 'bridge-001',
  status: 'awaiting-client',     // funded → awaiting-client → client-paid → bank-repaid → closed
  principalOMR: 200,
  feePct: 2.2,
  feeOMR: 4.4,
  netToFreelancerOMR: 195.6,     // 200 − 4.40
  totalDueToBankOMR: 200,        // bullet repayment, fee already deducted upfront
  bank: 'Bank Muscat',
  bankAccount: 'BM-INNOV-LAB',
  freelancer: 'Khalid Al-Balushi',
  collateralInvoiceId: 'inv-014',
  collateralClient: 'Mwasalat (Oman National Transport)',
  collateralAmountOMR: 1900,
  collateralOriginalDue: fmt(now - 32 * day),
  collateralDaysOverdue: 32,
  fundedAt:   now - 4 * day,
  dueAt:      now + 26 * day,    // 30-day term from funding
  expectedClientPayoutAt: now + 18 * day, // negotiator-projected
  timeline: [
    { stage: 'submitted',       label: 'Bank submission',          ts: now - 8  * day, detail: 'Credit Panel pushed package to Bank Muscat — score 78 · collateral inv-014' },
    { stage: 'reviewed',        label: 'Underwriter cross-check',  ts: now - 7  * day, detail: 'Bank Muscat AI underwriter — 86% confidence · signals verified' },
    { stage: 'approved',        label: 'Approved · OMR 200',       ts: now - 5  * day, detail: 'Bank Muscat issued credit line · grade A- · 30-day bullet · 2.2% admin fee' },
    { stage: 'funded',          label: 'Funds disbursed',          ts: now - 4  * day, detail: 'OMR 195.60 wired to Khalid (OMR 200 minus 2.2% one-time admin fee)' },
    { stage: 'awaiting-client', label: 'Awaiting Mwasalat payment', ts: now - 4  * day, detail: 'Negotiator escalating Mwasalat — OMR 1,900 invoice · 32 days overdue · reminders dispatched' },
  ],
  repayment: {
    source:  'Mwasalat (Oman National Transport) — invoice inv-014 · OMR 1,900',
    routing: 'Once the Mwasalat invoice clears, OMR 200 auto-routes to Bank Muscat; the remaining OMR 1,700 is released to Khalid.',
    autoSettle: true,
  },
  riba: {
    free: true,
    note: 'Islamic factoring — the 2.2% admin fee is a flat one-time charge; it does not compound and is not interest. The bank funds the principal only; Madar carries the credit risk.',
  },
};

// ── 10) Build the rows we'll write ──────────────────────────────────────────
const rows = [
  ['synergy_user_profile_v1',     userProfile],
  ['synergy_connections_v4',      connections],
  ['synergy_invoices_v1',         invoices],
  ['synergy_obligations_v1',      obligations],
  ['synergy_clients_v1',          clients],
  ['synergy_activity_log_v1',     activityLog],
  ['synergy_score_history_v1',    scoreHistory],
  ['synergy_latest_ai_score',     81],
  ['synergy_profit_forecast_v1',  profitForecast],
  ['synergy_credit_offer_v1',     creditOffer],
  ['synergy_bank_review_v1',      bankReview],
  ['synergy_bridge_advance_v1',   bridgeAdvance],
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

  console.log(`Seeding ${rows.length} keys for Khalid Al-Balushi …`);
  for (const [key, value] of rows) {
    await c.query(
      `insert into public.kv_store (workspace, key, value)
         values ($1, $2, $3::jsonb)
       on conflict (workspace, key) do update set value = excluded.value, updated_at = now()`,
      [WORKSPACE, key, JSON.stringify(value)]
    );
    const size = JSON.stringify(value).length;
    console.log(`  ✓ ${key} (${size} B)`);
  }

  const r = await c.query(
    'select key, jsonb_typeof(value) as type, length(value::text) as size from public.kv_store where workspace = $1 order by key',
    [WORKSPACE]
  );
  console.log(`\nFinal state — ${r.rowCount} rows in workspace ${WORKSPACE}:`);
  for (const x of r.rows) console.log(`  ${x.key} | ${x.type} | ${x.size} B`);
  await c.end();
  console.log('\n✅ Khalid demo data seeded directly into Supabase.');
})().catch(e => { console.error('SEED FAILED:', e.message); process.exit(1); });
