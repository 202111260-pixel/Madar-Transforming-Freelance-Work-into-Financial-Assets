# مدار — Madar

> **منصة تحصيل الفواتير الذكية بالذكاء الاصطناعي · Islamic AI Invoice Factoring**

<div align="center">

![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwindcss)
![Vite](https://img.shields.io/badge/Vite-6.x-a78bfa?style=flat-square&logo=vite)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

**Hackathon Demo · Not a licensed financial service**

</div>

---

## 🧭 What is Madar?

**Madar** is a multi-agent AI platform that transforms unpaid invoices into immediate liquidity for freelancers and SMEs in Oman — without loans, without interest, and fully compliant with Islamic Sharia law.

We **purchase** your receivables at a flat **2.2% admin fee**. No riba. No debt.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🤖 **3-Agent AI Pipeline** | Sentinel · Negotiator · Treasurer work in sequence to assess risk, negotiate terms, and approve funding |
| 📊 **Unified Credit Score** | Real-time score computed from platform connections, invoice history, and AI assessment |
| 🏦 **Bank-Ready PDF Reports** | SHA-256 hashed, legally structured factoring reports sent directly to partner banks |
| ☪️ **100% Riba-Free** | Asset purchase model — not a loan |
| 📧 **Auto Invoice Email** | Automatic approval notification via Resend upon bank decision |
| 🗺️ **Wadi Risk Map** | Geographic Oman flood/wadi risk overlay (OpenStreetMap + GeoJSON) |
| 🔐 **SHA-256 Integrity** | Every PDF document is cryptographically hashed in-browser |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                   │
│  LandingPage → ConnectionsPage → AgentRoom → CreditPanel│
└────────────────────┬────────────────────────────────────┘
                     │ REST
┌────────────────────▼────────────────────────────────────┐
│              API Server (Express · port 3001)            │
│   /contact · /send-invoice-email · /whatsapp-notify      │
└──────┬─────────────┬──────────────┬──────────────────────┘
       │             │
  ┌─────▼────┐  ┌─────▼──────┐
  │  Resend  │  │   Twilio   │
  │ (Email)  │  │ (WhatsApp) │
  └──────────┘  └────────────┘

ZenMux AI Router
  ├── Claude Opus 4.6   → Sentinel  (risk analysis)
  ├── Gemini 3.1 Pro    → Negotiator (terms)
  └── DeepSeek R1       → Treasurer (approval)
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Installation

```bash
# Clone the repo
git clone https://github.com/your-org/madar.git
cd madar

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in your keys

# Start frontend dev server
npm run dev

# Start API server (separate terminal)
node scripts/api-server.cjs
```

### Environment Variables

```env
ZENMUX_API_KEY=your_zenmux_key
RESEND_API_KEY=re_xxxx
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

---

## 📁 Project Structure

```
src/
├── LandingPage.tsx          # Marketing landing page
├── pages/
│   ├── AgentRoom.tsx        # 3-agent AI reasoning UI
│   ├── CreditPanelPage.tsx  # Bank underwriting & approval
│   ├── ConnectionsPage.tsx  # Platform connections & credit score
│   ├── MapPage.tsx          # Oman wadi risk map
│   └── ManualInputPage.tsx  # Manual invoice entry
├── lib/
│   ├── agentPipeline.ts     # ZenMux sequential agent runner
│   ├── scoreEngine.ts       # Unified credit score computation
│   ├── synergyPipeline.ts   # Full AI analysis pipeline
│   ├── storeBus.ts          # localStorage state persistence
│   └── generatePdfReport.ts # Bank-ready PDF generation
└── components/
    ├── MagicRings.tsx        # Animated agent status rings
    └── UnifiedScoreCard.tsx  # Credit score display
scripts/
├── api-server.cjs           # Express backend (email, WhatsApp)
```

---

## 🤖 AI Agent Pipeline

```
Invoice Input
     ↓
[Sentinel Agent] — Claude Opus 4.6
  • Risk profiling
  • Fraud signals
  • Client reputation score
     ↓
[Negotiator Agent] — Gemini 3.1 Pro
  • Factoring terms
  • Advance rate (70–92%)
  • Fee negotiation
     ↓
[Treasurer Agent] — DeepSeek R1
  • Final approval / rejection
  • Funding amount
  • Repayment schedule
     ↓
Bank PDF Report (SHA-256 hashed)
```

---

## 💳 Pricing

| Plan | Price | Invoices |
|---|---|---|
| Starter | Free | 3 / month |
| Growth | 49 OMR / month | 25 / month |
| Enterprise | Custom | Unlimited |

**+ 2.2% admin fee per factored invoice (no interest)**

---

## 🛡️ Sharia Compliance

Madar operates on a **receivables purchase** model:

1. Freelancer holds an unpaid invoice (asset)
2. Madar **purchases** the receivable at a discount
3. Madar collects the full amount from the client
4. No loan is created — no riba applies

---

## 🧪 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5, Tailwind v4 |
| Animation | Framer Motion |
| Build | Vite 6 |
| Backend | Express.js (Node) |
| Database | localStorage + Zustand (in-memory) |
| AI Router | ZenMux (Claude / Gemini / DeepSeek) |
| Email | Resend |
| Messaging | Twilio WhatsApp |
| Maps | Leaflet + OpenStreetMap |
| PDF | jsPDF + html2canvas |
| Icons | Lucide · react-icons |

---

## ⚠️ Disclaimer

This is a **hackathon demonstration prototype**. Madar is not a licensed financial institution. No real money is processed. All invoice data used is synthetic demo data.

---

<div align="center">
  <strong>مدار · Madar · 2026</strong><br/>
  <sub>Turning invoices into liquidity with multi-agent AI</sub>
</div>
