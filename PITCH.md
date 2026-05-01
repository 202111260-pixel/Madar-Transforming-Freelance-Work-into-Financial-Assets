# مدار — Madar · Hackathon Pitch

---

## 🎯 One-Liner

> **Madar turns unpaid invoices into instant cash using a 3-agent AI pipeline — with zero interest and full Sharia compliance.**

---

## 🔥 The Problem

**Freelancers in Oman are drowning in unpaid invoices.**

- The average Omani freelancer waits **47–90 days** to get paid
- **68%** report cash flow problems that force them to decline new projects
- Traditional bank loans require collateral, credit history, and 3–6 weeks of processing
- Islamic financing options are limited and often inaccessible to individuals

This isn't just inconvenient — it's existentially threatening to Oman's growing gig economy.

---

## 💡 The Solution

**Madar purchases your invoice. You get cash today.**

We are **not** a lender. We are a receivables purchaser.

```
You have: Invoice for 2,000 OMR (unpaid, 60 days overdue)
         ↓
Madar buys it for: 1,956 OMR (2.2% admin fee deducted)
         ↓
You receive: 1,956 OMR within 24 hours
         ↓
Madar collects the 2,000 OMR from your client
```

**No interest. No riba. No debt on your balance sheet.**

---

## 🤖 How the AI Works

Three specialized agents analyze every invoice in real-time:

### Agent 1 — Sentinel (Claude Opus 4.6)
*"Is this invoice legitimate and collectible?"*
- Verifies invoice authenticity signals
- Checks client payment history patterns
- Flags fraud indicators
- Outputs: Risk Score (0–100)

### Agent 2 — Negotiator (Gemini 3.1 Pro)
*"What are the right terms for this deal?"*
- Calculates optimal advance rate (70–92%)
- Considers industry, client type, invoice age
- Structures the factoring agreement
- Outputs: Term Sheet

### Agent 3 — Treasurer (DeepSeek R1)
*"Do we fund this? How much? When?"*
- Final approval decision
- Funding amount and schedule
- Generates bank-ready rationale
- Outputs: Approval + PDF Report

**Total analysis time: < 45 seconds**

---

## 📊 Unified Credit Score

Every user has a **Unified Score (0–100)** built from:

| Component | Weight |
|---|---|
| Platform connections (Upwork, Fiverr, etc.) | 35% |
| Invoice revenue history | 40% |
| AI agent assessment | 25% |

The score updates in real-time as users connect platforms and submit invoices.

---

## 🏦 Bank Integration

Madar generates **SHA-256 hashed PDF reports** formatted for Omani partner banks:

- Structured factoring agreement
- AI risk rationale
- Credit score breakdown
- Repayment schedule
- Cryptographic document integrity proof

**Approved reports are emailed automatically to the user and the bank within seconds.**

---

## 🌍 Oman-Specific Features

### Wadi Risk Map
- Real-time flood/wadi risk visualization across Oman
- Helps assess geographic business risk for construction/outdoor freelancers
- Powered by OpenStreetMap + 140,000+ wadi data points

### Arabic-First Design
- Full RTL support
- Arabic pricing display
- Oman currency (OMR) native

---

## 💰 Business Model

```
Revenue Stream 1: Admin Fee
  2.2% of every factored invoice
  Example: 10,000 OMR invoice → 220 OMR revenue

Revenue Stream 2: SaaS Subscriptions
  Starter: Free (3 invoices/month)
  Growth:  49 OMR/month (25 invoices)
  Enterprise: Custom (unlimited)

Revenue Stream 3: Bank Partnership Fees
  Per-referral fee from partner banks
  for qualified credit applications
```

**Year 1 Target: 500 freelancers · 6,000 invoices · ~132,000 OMR GMV**

---

## 🎯 Market Opportunity

| Metric | Value |
|---|---|
| Freelancers in Oman (est.) | 85,000+ |
| Avg invoice value | 800 OMR |
| Avg invoices/year per freelancer | 18 |
| Total addressable market | ~1.2B OMR / year |
| Initial target (1% capture) | 12M OMR / year |

---

## ✅ Why Now?

1. **Oman Vision 2040** explicitly targets freelancer/SME financial inclusion
2. **AI cost has collapsed** — running 3 LLM agents per invoice costs < 0.05 OMR
3. **Islamic fintech gap** — no existing product solves this with zero riba
4. **Regulatory tailwind** — CBO Oman actively encouraging fintech innovation

---

## 🏆 Competitive Advantage

| | Traditional Bank | Regular Factoring | **Madar** |
|---|---|---|---|
| Speed | 3–6 weeks | 5–10 days | **< 24 hours** |
| Sharia compliant | Sometimes | No | **Yes** |
| AI risk assessment | No | No | **Yes** |
| Minimum amount | 10,000 OMR | 5,000 OMR | **500 OMR** |
| Credit history required | Yes | Yes | **No** |

---

## 🔬 Tech Differentiation

- **ZenMux AI Router**: Intelligently routes each analysis to the best model (Claude/Gemini/DeepSeek) based on task type — not locked into one provider
- **Cryptographic PDF Integrity**: SHA-256 hash computed in-browser using Web Crypto API — no server trust required
- **Real-time Score Engine**: localStorage-synced, reactive credit scoring without a round-trip to the server

---

## 🛤️ Roadmap

### Phase 1 — Hackathon MVP (Now)
- [x] 3-agent AI pipeline
- [x] Unified credit score
- [x] Bank PDF generation
- [x] Contact form & pricing
- [x] Wadi risk map

### Phase 2 — Beta (Q3 2026)
- [ ] Real Supabase user accounts
- [ ] Bank API integration (Bank Muscat)
- [ ] WhatsApp payment notifications
- [ ] Mobile-responsive UI

### Phase 3 — Launch (Q1 2027)
- [ ] CBO Oman fintech license
- [ ] 3 bank partnerships
- [ ] Public freelancer onboarding

---

## 👥 Team

Built in 48 hours for the 2026 Hackathon.

---

<div align="center">
  <strong>مدار يحوّل فواتيرك إلى سيولة فورية</strong><br/>
  <em>Madar turns your invoices into instant liquidity</em>
</div>
