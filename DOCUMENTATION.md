# Madar — Technical Documentation

> Full technical reference for the Madar hackathon project.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Frontend Architecture](#frontend-architecture)
3. [AI Agent Pipeline](#ai-agent-pipeline)
4. [Credit Score Engine](#credit-score-engine)
5. [Backend API](#backend-api)
6. [Database Schema](#database-schema)
7. [PDF Generation & Integrity](#pdf-generation--integrity)
8. [Email & Notifications](#email--notifications)
9. [Pages Reference](#pages-reference)
10. [Component Reference](#component-reference)
11. [Environment Variables](#environment-variables)

---

## System Overview

Madar is a single-page React application with a lightweight Express API server. All AI inference is routed through ZenMux, a multi-provider LLM proxy. Persistent data lives in Supabase (PostgreSQL). The frontend communicates with Supabase directly via the JS client, and with the Express server for email/WhatsApp notifications.

```
Browser (React SPA)
    ├── Supabase JS Client  →  Supabase (PostgreSQL)
    ├── ZenMux fetch()      →  Claude / Gemini / DeepSeek
    └── fetch('/api/*')     →  Express (port 3001)
                                  ├── Resend  (email)
                                  └── Twilio  (WhatsApp)
```

---

## Frontend Architecture

### Tech Stack

| Package | Version | Purpose |
|---|---|---|
| react | 19.x | UI framework |
| typescript | 5.x | Type safety |
| vite | 6.x | Build tool |
| tailwindcss | 4.x | Utility CSS |
| framer-motion | 12.x | Animations |
| lenis | latest | Smooth scroll |
| @supabase/supabase-js | 2.x | Database client |
| jspdf | 3.x | PDF generation |
| html2canvas | 1.x | PDF screenshots |
| leaflet / react-leaflet | 4.x | Maps |
| lucide-react | latest | Icons |
| react-icons | latest | Brand icons (Si/Tb/Bi/Fa) |

### Routing

Routing is handled by `react-router-dom` v7. Routes defined in `src/App.tsx`:

```
/              → LandingPage
/connections   → ConnectionsPage
/room          → AgentRoom
/credit        → CreditPanelPage
/manual        → ManualInputPage
/map           → MapPage
/activity      → ActivityLogPage
/presentation  → PresentationPage
/video         → VideoPage
```

### State Management

Global state lives in `src/lib/useSynergyStore.ts` (Zustand). Invoice data, agent outputs, and credit scores are also mirrored in `localStorage` for persistence between page navigations:

```
localStorage keys:
  synergy_invoices_v1        → Invoice array
  synergy_connections_v4     → Connected platforms
  synergy_latest_ai_score    → Last AI-computed score
```

---

## AI Agent Pipeline

### Entry Point

`src/lib/agentPipeline.ts` — exports `runAgentPipeline(invoices)`

### Agent Definitions

```typescript
type AgentKey = 'sentinel' | 'negotiator' | 'treasurer'

interface AgentConfig {
  key: AgentKey
  model: string          // ZenMux model identifier
  systemPrompt: string   // Specialized role prompt
  temperature: number
}
```

| Agent | Model | Role | Temperature |
|---|---|---|---|
| Sentinel | `claude-opus-4-6` | Risk analysis, fraud detection | 0.3 |
| Negotiator | `gemini-3-1-pro` | Terms, advance rate, fee structure | 0.5 |
| Treasurer | `deepseek-r1` | Final approval, funding decision | 0.2 |

### Pipeline Flow

```typescript
// Sequential execution — each agent receives prior outputs
const sentinelOutput   = await runAgent('sentinel',   invoices, null)
const negotiatorOutput = await runAgent('negotiator',  invoices, sentinelOutput)
const treasurerOutput  = await runAgent('treasurer',   invoices, negotiatorOutput)
```

### ZenMux Integration

All requests go to `https://api.zenmux.io/v1/chat/completions` with the `ZENMUX_API_KEY` header. ZenMux internally routes to the appropriate provider based on the model name.

---

## Credit Score Engine

**File:** `src/lib/scoreEngine.ts`

### Formula

```
score = W_CONN × connScore + W_REV × revScore + W_AI × aiScore

where:
  W_CONN = 35%   connScore = connected_platforms / TARGET_PLATFORMS (8)
  W_REV  = 40%   revScore  = total_revenue / TARGET_REVENUE (4× median)
  W_AI   = 25%   aiScore   = normalized AI pipeline output (0–100)

Final score = clamp(score, 0, 100)
```

### Score Update Triggers

- User connects / disconnects a platform → `computeUnifiedScore()` re-runs
- AI pipeline completes → AI score component updates
- Invoice added → revenue component updates

### Score Display

`src/components/UnifiedScoreCard.tsx` — animated circular gauge with color zones:

| Range | Color | Label |
|---|---|---|
| 0–39 | `#ef4444` (red) | ضعيف |
| 40–59 | `#f59e0b` (amber) | متوسط |
| 60–79 | `#3b82f6` (blue) | جيد |
| 80–100 | `#10b981` (green) | ممتاز |

---

## Backend API

**File:** `scripts/api-server.cjs`  
**Port:** `3001`  
**Framework:** Express.js

### Endpoints

#### `POST /contact`
Send a contact form submission email.

```json
Request:
{
  "email": "user@example.com",
  "name": "Mohammed",        // optional
  "message": "..."           // optional
}

Response: { "success": true }
```

#### `POST /send-invoice-email`
Send approval notification email to user.

```json
Request:
{
  "to": "user@example.com",
  "invoiceId": "INV-2026-001",
  "amount": 1956,
  "currency": "OMR",
  "approvedAt": "2026-05-01T10:00:00Z"
}

Response: { "success": true, "messageId": "..." }
```

#### `POST /whatsapp-notify`
Send WhatsApp notification via Twilio.

```json
Request:
{
  "to": "+968XXXXXXXX",
  "message": "تمت الموافقة على فاتورتك..."
}

Response: { "success": true, "sid": "..." }
```

#### `GET /health`
Health check endpoint.

```json
Response: { "status": "ok", "timestamp": "..." }
```

---

## Database Schema

**File:** `supabase/schema.sql`

### Tables

#### `synergy_invoices_v1`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id       text NOT NULL
client_name   text
amount        numeric(12,2)
currency      text DEFAULT 'OMR'
due_date      date
status        text DEFAULT 'pending'  -- pending | approved | rejected
created_at    timestamptz DEFAULT now()
```

#### `synergy_connections_v4`
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id       text NOT NULL
platform      text NOT NULL  -- upwork | fiverr | freelancer | ...
connected_at  timestamptz DEFAULT now()
```

#### `synergy_latest_ai_score`
```sql
user_id       text PRIMARY KEY
score         numeric(5,2)
rationale     text
updated_at    timestamptz DEFAULT now()
```

---

## PDF Generation & Integrity

**File:** `src/lib/generatePdfReport.ts`

### SHA-256 Hashing

The PDF blob is hashed in-browser using the Web Crypto API — no server involvement:

```typescript
async function hashPdfBlob(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
```

### PDF Structure

1. **Cover page** — Madar logo, date, document ID
2. **Invoice summary table** — All submitted invoices
3. **Credit score breakdown** — Components and weights
4. **Agent rationale** — Sentinel / Negotiator / Treasurer outputs
5. **Term sheet** — Advance rate, fee, repayment schedule
6. **Approval section** — Decision, funding amount, SHA-256 hash
7. **Legal disclaimer** — Sharia compliance statement

---

## Email & Notifications

### Resend (Email)

Used for:
- Contact form submissions
- Invoice approval notifications
- Bank report delivery

Template uses HTML with inline styles for email client compatibility.

### Twilio WhatsApp

Used for:
- Instant approval/rejection SMS-style notifications
- Arabic message support
- Sent from Twilio Sandbox number (demo)

---

## Pages Reference

### `LandingPage.tsx`
Marketing landing page. Sections:
1. `PrimaryHeroSection` — BounceCards hero
2. Islamic Factoring announcement bar + Pricing CTA button
3. `HeroSection` — Threads animation + Globe
4. `BentoSection` — Feature grid
5. `ShowcaseSection` — Product screenshots
6. FAQ section (`FAQSection`)
7. Tech stack icon strip
8. `ContactSection` — 3-step Stepper form

**State:** `pricingOpen` (boolean) controls `PricingModal` visibility.

### `AgentRoom.tsx`
Real-time agent pipeline visualization.

- Three `AgentCard` components (Sentinel / Negotiator / Treasurer)
- Each card has `MagicRings` animated halo while processing
- `useTypewriter` hook reveals AI output character-by-character
- Pipeline runs via `runAgentPipeline()` from `agentPipeline.ts`
- Status bar shows "4 agents · sequential"

### `CreditPanelPage.tsx`
Full bank underwriting UI.

- Invoice input form
- Real-time credit score display
- Bank decision simulation (approved / review / rejected)
- **Funding Granted panel** — green gradient with repayment countdown
- PDF report generation + SHA-256 hash display
- Auto-email trigger on approval

### `ConnectionsPage.tsx`
Platform connection management.

- Grid of 8 freelance/business platforms
- Connect / disconnect with animated transitions
- Score delta toast (green +X / red -X) on each action
- Unified score updates bidirectionally

### `MapPage.tsx`
Oman wadi risk visualization.

- Leaflet map centered on Oman
- GeoJSON layers: `wadis_lines_opt.geojson` + `wadis_polygons_opt.geojson`
- Color-coded flood risk zones
- Popup details on click

---

## Component Reference

### `MagicRings.tsx`
Animated concentric rings that pulse around agent cards during processing.

Props:
```typescript
{
  colorOne: string   // Inner ring color
  colorTwo: string   // Outer ring color
  ringCount?: number // Default: 3
}
```

Color scheme per agent:
- Sentinel: `#6366f1` / `#818cf8`
- Negotiator: `#f59e0b` / `#06b6d4`
- Treasurer: `#10b981` / `#f97316`

### `UnifiedScoreCard.tsx`
Circular animated credit score gauge.

Props:
```typescript
{
  score: number      // 0–100
  size?: number      // SVG size in px
  showLabel?: boolean
}
```

### `BackendHealthBadge.tsx`
Polls `GET http://localhost:3001/health` every 30s. Shows green dot if API server is running, red if not.

### `ThemeToggle.tsx`
Light/dark mode toggle. Uses `src/lib/theme.ts` for persistence in localStorage.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `ZENMUX_API_KEY` | Yes (backend) | ZenMux AI router API key |
| `RESEND_API_KEY` | Yes (backend) | Resend email API key |
| `TWILIO_ACCOUNT_SID` | Optional | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Optional | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | Optional | Twilio WhatsApp sender number |

`VITE_*` variables are exposed to the frontend build. Backend-only variables are only read by `scripts/api-server.cjs`.

---

## Build & Deploy

```bash
# Type-check
npx tsc --noEmit

# Production build
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

Output goes to `dist/` — can be deployed to Vercel, Netlify, or any static host.

The Express API server (`scripts/api-server.cjs`) must be deployed separately (e.g., Railway, Render, or a VPS).

---

*Madar · Hackathon 2026 · Technical Documentation*
