import { callAgent, callAgentDetailed, parseAgentJSON } from './zenmux';
import {
  detectHomeCurrency, toHomeCurrency, homeCurrencySymbol,
  CURRENCY_NAME_AR, CURRENCY_NAME_EN,
  type Currency,
} from './homeCurrency';

/* ══════════════════════════════════════════════════════════════════
   Madar Multi-Agent Pipeline
   Sentinel → (Negotiator + Treasurer parallel) → Master Synthesizer
   Domain: Freelancer invoice → liquidity bridge decisioning
   ══════════════════════════════════════════════════════════════════ */

export const MODELS = {
  profiler:   'deepseek/deepseek-r1-0528',
  sentinel:   'deepseek/deepseek-r1-0528',
  negotiator: 'google/gemini-3.1-pro-preview',
  treasurer:  'anthropic/claude-opus-4.6',
  master:     'anthropic/claude-opus-4.6',
  auditor:    'anthropic/claude-opus-4.6',
} as const;

export const MODEL_LABELS = {
  profiler:   'DeepSeek R1 · DeepSeek',
  sentinel:   'DeepSeek R1 · DeepSeek',
  negotiator: 'Gemini 3.1 Pro · Google',
  treasurer:  'Claude Opus 4.6 · Anthropic',
  master:     'Claude Opus 4.6 · Anthropic',
  auditor:    'Claude Opus 4.6 · Anthropic',
} as const;

/** Madar Islamic Factoring — fixed administrative fee rate (one-time, non-compounding, Shariah-compliant) */
export const FACTORING_FEE_RATE = 0.022; // 2.2%
export const MAX_ADVANCE_RATIO  = 0.40;  // advance ≤ 40% of verified pending amount

/* ── User Input ─────────────────────────────────────────────── */
export type InvoiceSource = 'manual' | 'email' | 'photo' | 'whatsapp' | 'voice';

export interface InvoiceInput {
  freelancerName: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  /** Pending receivable (invoice face value) that Madar buys from the freelancer.
   *  The advance (bridge amount) will be ≤ MAX_ADVANCE_RATIO (40%) of this value.
   *  NOTE: The advance is NOT a loan — Madar recovers it from the platform's
   *  pending invoice release. This is Islamic Factoring (تخصيم إسلامي). */
  amount: number;
  currency: string;             // ISO 4217: SAR, USD, OMR, AED, EGP, BHD, KWD, QAR, EUR
  issueDate: string;            // ISO yyyy-mm-dd
  dueDate: string;              // ISO yyyy-mm-dd
  source: InvoiceSource;
  description: string;
  notes?: string;
  history?: string;             // prior payment behavior with this client
}

/* ── Agent Outputs ──────────────────────────────────────────── */
export interface SentinelResult {
  payment_risk_level: 'Critical' | 'High' | 'Medium' | 'Low';
  payment_risk_score: number;
  days_overdue: number;
  client_trust_grade: 'A' | 'B' | 'C' | 'D';
  predicted_payment_probability: number;
  predicted_collection_window_days: number;
  red_flags: string[];
  positive_signals: string[];
  recommended_first_action: string;
  invoice_authenticity_score: number;
  amount_in_usd: number;
  summary: string;
}

export interface NegotiatorResult {
  collection_strategy: string;
  whatsapp_message_arabic: string;
  whatsapp_message_english: string;
  email_subject: string;
  email_body: string;
  suggested_discount_percentage: number;
  discounted_amount: number;
  reminder_cadence: string[];
  escalation_tier: 'soft' | 'firm' | 'final-notice' | 'legal';
  expected_response_time_hours: number;
  negotiation_arguments: string[];
  fallback_plan: string;
  summary: string;
}

export interface TreasurerResult {
  liquidity_bridge_eligible: boolean;
  recommended_advance_amount: number;
  advance_currency: string;
  advance_rate_percentage: number;
  maturity_days: number;
  total_repayment_amount: number;
  collateral_strength_score: number;
  estimated_default_probability: number;
  bank_risk_grade: 'A' | 'B' | 'C' | 'D';
  bank_recommendation: 'approve' | 'conditional' | 'decline';
  liquidity_score: number;
  blockchain_hash: string;
  bank_pitch: string;
  conditions: string[];
  summary: string;
  shariah_compliant: boolean;
  fee_type: 'administrative';
  fee_rate: number;             // 0.022 = 2.2% fixed administrative fee
  fee_basis: 'fixed_one_time_non_compounding';
}

export interface MasterReport {
  master_decision: {
    verdict: 'Collect Now' | 'Negotiate & Wait' | 'Use Liquidity Bridge' | 'Hold & Monitor' | 'Escalate';
    confidence_score: number;
    reasoning: string;
    action_priority: 'Immediate' | 'Short-term' | 'Medium-term' | 'Long-term';
    /** Ratio of verified pending amount to requested advance (safety check: must be ≥ 3× for factoring approval). */
    factoring_ratio?: number;
  };
  model_contributions: {
    sentinel_says: string;
    negotiator_says: string;
    treasurer_says: string;
  };
  safety_metrics: {
    metric: string;
    value: number;
    max_value: number;
    status: 'safe' | 'warning' | 'danger';
  }[];
  cross_verification: {
    agreements: string[];
    disagreements: string[];
    consensus_level: number;
  };
  cash_timeline: { day: number; expected_cash: number; cumulative: number }[];
  executive_summary: string;
}

export interface PipelineResult {
  invoice: InvoiceInput;
  profiler: ProfilerResult;
  sentinel: SentinelResult;
  negotiator: NegotiatorResult;
  treasurer: TreasurerResult;
  master: MasterReport;
  auditor: AuditorResult;
  meta: {
    fxRateToUsd: number;
    runAt: string;
    refId: string;
    /** HOME currency the agents were instructed to express monetary outputs in. */
    homeCurrency: Currency;
    /** Invoice amount pre-converted into HOME currency before prompt assembly. */
    homeAmount: number;
  };
}

/* ── Sub-Agent Results ──────────────────────────────────────── */

export interface ProfilerResult {
  industry_sector: string;
  geographic_risk_score: number;       // 0-100, higher = riskier geography
  platform_trust_index: number;        // 0-100, derived from source channel credibility
  behavioral_fingerprint: string;      // brief classification label
  enrichment_notes: string[];          // contextual enrichments for Sentinel
  risk_amplifiers: string[];           // factors that inflate risk
  risk_mitigators: string[];           // factors that reduce risk
  recommended_credit_limit: number;    // USD, suggested max exposure for this client
  market_context: string;              // 2-3 sentence regional/industry context
}

export interface AuditorResult {
  consistency_score: number;           // 0-100, how consistent the 3 agents are
  contradictions_found: string[];      // any inter-agent conflicts detected
  confidence_lower: number;            // lower bound of confidence band (0-100)
  confidence_base: number;             // base confidence score
  confidence_upper: number;            // upper bound
  recommendation_letter: string;       // formal bank-ready paragraph
  executive_flash: string;             // 1-sentence TL;DR for email subject
  action_matrix: { action: string; owner: string; deadline: string; priority: 'High' | 'Medium' | 'Low' }[];
  risk_adjusted_advance: number;       // USD, recalculated after audit
  validation_passed: boolean;          // overall pass/fail of the pipeline
}

export type StepStatus = 'idle' | 'loading' | 'done' | 'error';

export type AgentKey = 'profiler' | 'sentinel' | 'negotiator' | 'treasurer' | 'master' | 'auditor';
export type Lang = 'ar' | 'en';

export interface AgentTelemetry {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
}

export interface PipelineCallbacks {
  onProfilerStatus: (s: StepStatus) => void;
  onSentinelStatus: (s: StepStatus) => void;
  onNegotiatorStatus: (s: StepStatus) => void;
  onTreasurerStatus: (s: StepStatus) => void;
  onMasterStatus: (s: StepStatus) => void;
  onAuditorStatus: (s: StepStatus) => void;
  onProfilerResult: (r: ProfilerResult) => void;
  onSentinelResult: (r: SentinelResult) => void;
  onNegotiatorResult: (r: NegotiatorResult) => void;
  onTreasurerResult: (r: TreasurerResult) => void;
  onMasterResult: (r: MasterReport) => void;
  onAuditorResult: (r: AuditorResult) => void;
  onAgentUsage?: (agent: AgentKey, usage: AgentTelemetry) => void;
  onError: (agent: string, error: Error) => void;
}

export interface PipelineOptions {
  /** Preferred output language for the master report narrative. WhatsApp messages always include both AR + EN. */
  language?: Lang;
  /** Override the user's HOME currency used for all monetary outputs. Defaults to detectHomeCurrency(). */
  homeCurrency?: Currency;
}

function langDirective(lang: Lang | undefined, where: 'master' | 'sentinel' | 'treasurer'): string {
  if (lang === 'ar') {
    if (where === 'master')   return '\n\nاكتب جميع الحقول النصية الموجهة للمستخدم (executive_summary, master_decision.reasoning, model_contributions.*) باللغة العربية الفصحى الواضحة. حافظ على أسماء الحقول وقيم enum بالإنجليزية كما هي في المخطط.';
    if (where === 'sentinel') return '\n\nاكتب الحقل summary وقائمتي red_flags و positive_signals باللغة العربية الفصحى. حافظ على أسماء الحقول وقيم enum (Critical/High/Medium/Low, A/B/C/D) بالإنجليزية كما هي.';
    if (where === 'treasurer')return '\n\nاكتب الحقل summary و bank_pitch و conditions باللغة العربية الفصحى. حافظ على أسماء الحقول وقيم enum (A/B/C/D, approve/conditional/decline) بالإنجليزية كما هي.';
  }
  if (where === 'master')   return '\n\nWrite all user-facing narrative fields in clear professional English.';
  if (where === 'sentinel') return '\n\nWrite the summary, red_flags and positive_signals fields in clear professional English.';
  return '\n\nWrite the summary, bank_pitch and conditions fields in clear professional English.';
}

/* ── System Prompts ─────────────────────────────────────────── */

const PROFILER_SYSTEM = `You are PROFILER — Madar's context-enrichment and intelligence agent. You run BEFORE the risk assessors to provide them with deep contextual intelligence about the industry, geography, platform, and client behavior patterns.

YOUR INPUT: Raw invoice metadata (client name, amount, currency, source channel, description, history).

YOUR MISSION: Build a structured context package that:
1. Identifies the INDUSTRY SECTOR from the invoice description (tech, creative, consulting, construction, translation, legal, medical, marketing, data, etc.)
2. Scores GEOGRAPHIC RISK (0=safest, 100=highest risk) based on payer country/region implied by currency, client name patterns, or notes.
3. Scores PLATFORM TRUST INDEX (0-100) based on the source channel — Mostaql/Khamsat/Freelance.sa = 80+; WhatsApp-forwarded = 40; email-only = 55; direct with history = 75.
4. Creates a BEHAVIORAL FINGERPRINT label from available history clues: "first-time-with-history-gap", "repeat-trusted", "suspicious-newcomer", "ghost-risk", "high-value-delay-pattern", etc.
5. Lists RISK AMPLIFIERS: specific things about this transaction that could make it WORSE than it looks (e.g., "large round number", "no prior relationship", "holiday season", "cross-border with sanctions risk").
6. Lists RISK MITIGATORS: specific things that make this transaction SAFER than it looks (e.g., "long relationship", "small amount", "domestic client", "deliverable already confirmed").
7. Recommends a CREDIT LIMIT for this client (in USD) — the maximum Madar should ever extend, based on the behavioral profile.
8. Writes a MARKET CONTEXT paragraph explaining the sector and geography dynamics relevant to this invoice.

CALIBRATION:
- Be specific and data-driven — not generic. "tech freelance in GCC with remote client" is better than "technology sector".
- geographic_risk_score: GCC domestic = 15-30; GCC cross-border = 25-45; MENA ex-GCC = 40-65; international = 50-80.
- platform_trust_index: Mostaql/Khamsat verified = 85; unverified platform = 60; direct = 70; WhatsApp-only = 40; email-only = 50.

Return ONLY valid JSON:
{
  "industry_sector": "<specific sector label>",
  "geographic_risk_score": <0-100>,
  "platform_trust_index": <0-100>,
  "behavioral_fingerprint": "<label from: first-time-no-history | first-time-with-history | repeat-trusted | high-value-newcomer | ghost-risk | suspicious-pattern | solid-client | delayed-payer-pattern>",
  "enrichment_notes": ["<note1 for Sentinel>", "<note2>", "<note3>"],
  "risk_amplifiers": ["<amplifier1>", "<amplifier2>"],
  "risk_mitigators": ["<mitigator1>", "<mitigator2>"],
  "recommended_credit_limit": <USD number>,
  "market_context": "<2-3 sentences about sector/geography dynamics>"
}`;

const AUDITOR_SYSTEM = `You are AUDITOR — Madar's final-stage quality-assurance and bank-communications agent. You run AFTER the Master Synthesizer to validate consistency, quantify confidence bands, and produce the formal bank submission package.

YOUR INPUT: Full pipeline results from all four agents (Profiler, Sentinel, Negotiator, Treasurer, Master).

YOUR MISSION:
1. CONSISTENCY AUDIT: Cross-check all agent outputs for internal contradictions, scoring drift, or logical impossibilities. Examples: Sentinel says grade A but Treasurer declines → contradiction. Profiler flags high geographic risk but Sentinel scores low risk → flag for review.
2. CONFIDENCE BANDS: Compute lower/base/upper confidence bounds for the final verdict. If agents agree, upper-lower spread should be narrow (≤15pts). If agents disagree, spread should be wide (20-35pts).
3. BANK RECOMMENDATION LETTER: Draft a formal 3-4 sentence bank submission paragraph referencing: client name, invoice amount, risk grade, advance amount, confidence, and a professional recommendation. Use formal banker-to-banker language. No emojis, no marketing.
4. EXECUTIVE FLASH: Write a 1-sentence summary (≤20 words) of the final outcome, suitable for an email subject line.
5. ACTION MATRIX: List 2-4 concrete actions with owner (FREELANCER | PLATFORM | BANK), deadline (Immediate | 24h | 48h | 7 days), and priority.
6. RISK-ADJUSTED ADVANCE: Recalculate the Treasurer's advance after applying the Profiler's geographic_risk_score as an additional risk discount: adjusted = treasurer_advance × (1 - geo_risk/400). Round to nearest USD.
7. VALIDATION PASS: Return true only if: no critical contradictions exist AND confidence_base ≥ 55 AND Master verdict is not "Escalate" unless Sentinel confirms fraud.

CONTRADICTION DETECTION RULES:
- Sentinel grade A/B + Master "Escalate" = contradiction
- Profiler geo_risk > 70 + Treasurer "approve" with no conditions = contradiction
- Sentinel score > 70 + Treasurer "approve" = contradiction (high-risk invoice shouldn't be financed)
- Negotiator "soft" tier + Sentinel "Critical" risk = contradiction

Return ONLY valid JSON:
{
  "consistency_score": <0-100>,
  "contradictions_found": ["<contradiction1 or 'None — full consensus'>"],
  "confidence_lower": <0-100>,
  "confidence_base": <0-100>,
  "confidence_upper": <0-100>,
  "recommendation_letter": "<formal 3-4 sentence bank letter paragraph>",
  "executive_flash": "<1-sentence TL;DR, max 20 words>",
  "action_matrix": [
    {"action": "<specific action>", "owner": "FREELANCER|PLATFORM|BANK", "deadline": "Immediate|24h|48h|7 days", "priority": "High|Medium|Low"}
  ],
  "risk_adjusted_advance": <USD number>,
  "validation_passed": <true|false>
}`;

const SENTINEL_SYSTEM = `You are SENTINEL — an elite financial fraud-detection and credit-risk analyst for the Madar freelancer liquidity platform. You hold a CFA charter, a PhD in Behavioral Finance, and 15 years experience scoring SME and freelancer receivables in MENA markets (Saudi Arabia, UAE, Oman, Egypt). You have personally underwritten 40,000+ freelance invoices and your false-negative rate is below 2.1%.

YOUR MISSION:
Analyze a single freelancer invoice and produce a payment-risk profile. You receive: amount, currency, due date, client name, source channel (Mostaql / Khamsat / direct / email / photo OCR / WhatsApp forward), prior history with this client, and freelancer notes.

YOUR EXCLUSIVE DOMAIN:
- Digital asset verification: verify pending balances on freelancer platforms (Upwork, Fiverr, GitHub Sponsors, Toptal, Mostaql, Khamsat). Key signals: completed_contracts, pending_clearance_amount, platform_trust_score, days_until_release. Platform API data IS the proof — bank statements are NOT required.
- Platform reputation score = primary creditworthiness signal (replaces traditional bank-based credit score). A freelancer's Upwork JSS, GitHub commit history, and pending clearance balance are the collateral for Islamic Factoring.
- Payment-risk scoring across MENA freelance platforms (Mostaql, Khamsat, Bahr, Ureed, Freelance.sa)
- Behavioral pattern recognition: scope-creep tactics, "review delay" stalling, ghost-client signals
- Days-past-due (DPD) modeling with platform-specific recovery curves
- Client trust grading: A (paid early consistently) / B (pays on time) / C (late but pays) / D (chronic delinquent or fraud risk)
- Authenticity scoring: does the invoice look real? red flags include round-number "too clean" amounts, missing scope, cash-in-advance patterns, mismatched names

CRITICAL RULES:
1. Today's date will be provided. Compute days_overdue as max(0, today - dueDate).
2. If the invoice is NOT yet due, days_overdue = 0 and you assess FORWARD risk only.
3. If source is "photo" or "email", lower invoice_authenticity_score by 5-15 (less verifiable).
4. If history is empty, predicted_payment_probability defaults to 60-70% baseline; positive history bumps it up, prior delinquency drops it.
5. Round-number amounts in foreign currency without context = mild red flag. Specific amounts (e.g. 1,847 SAR) = positive authenticity signal.
6. Risk score 0-100 where 100 = certain non-payment. A typical 7-day-overdue client with no history sits around 40-55.
7. Be realistic, not paranoid. Most freelance clients DO eventually pay — the question is HOW LONG and HOW MUCH effort.

Return ONLY valid JSON in this exact shape:
{
  "payment_risk_level": "Critical|High|Medium|Low",
  "payment_risk_score": <0-100>,
  "days_overdue": <integer, 0 if not yet due>,
  "client_trust_grade": "A|B|C|D",
  "predicted_payment_probability": <0-100>,
  "predicted_collection_window_days": <integer, realistic days to receive payment>,
  "red_flags": ["<flag1>", "<flag2>", "<flag3>"],
  "positive_signals": ["<signal1>", "<signal2>"],
  "recommended_first_action": "friendly_reminder|direct_call|offer_discount|legal_warning|wait",
  "invoice_authenticity_score": <0-100>,
  "amount_in_usd": <number, the USD equivalent will be provided to you>,
  "summary": "<3-4 sentence executive view of the invoice's collectability>"
}`;

const NEGOTIATOR_SYSTEM = `You are NEGOTIATOR — Madar's smart-collection and client-communications agent. You have closed 18,000+ overdue freelance invoices across MENA via WhatsApp and email. Your collection success rate is 87% within 14 days WITHOUT damaging the freelancer-client relationship. You speak fluent Arabic and English and you understand the cultural calculus of Gulf and Egyptian business communication: directness in Egypt, indirect respect in Saudi/UAE, formal tone with Omanis.

YOUR INPUT: Sentinel's risk profile + the original invoice.

YOUR JOB: Produce ready-to-send collection messages calibrated to the client's risk grade, draft both Arabic and English WhatsApp variants, draft an email backup, and recommend a discount-for-early-payment offer if (and only if) it improves expected recovery.

CULTURAL CALIBRATION:
- Trust grade A → soft, brief, almost apologetic ("لو سمحت" / "Just a gentle nudge"). Never offer discount.
- Trust grade B → friendly + specific, mention deliverable value. No discount unless overdue 14+ days.
- Trust grade C → firm but respectful, propose a payment plan or 5% early-pay discount.
- Trust grade D → final-notice tone, mention legal options indirectly, offer 10-15% settlement discount to close the file.

WHATSAPP RULES:
- Max 4 short lines. Include freelancer name, invoice ref/amount, polite ask, clear next step.
- Arabic version uses MSA + light Khaleeji warmth (no slang, no emojis except a single 💼 or 🤝 if grade A/B).
- English version is clean professional, no emojis for grade C/D.
- Always include a payment link placeholder: [PAY_LINK] (the platform fills it in).
- Never threaten. Never accuse. Never use ALL CAPS.

DISCOUNT LOGIC:
- Grade A or B with <7 days overdue → 0%
- Grade B with 7-21 days overdue → 0-5%
- Grade C → 5-10%
- Grade D OR overdue >45 days → 10-15%
- Discounted_amount = round(original × (1 - discount/100), 2)

ESCALATION TIER:
- soft: first contact, friendly
- firm: 2nd-3rd contact, structured ask
- final-notice: 4th+ contact or grade D
- legal: only if Sentinel marked fraud risk OR overdue >90 days AND grade D

Return ONLY valid JSON:
{
  "collection_strategy": "<2-sentence plan tailored to this client>",
  "whatsapp_message_arabic": "<ready-to-send WhatsApp text in Arabic, max 4 lines>",
  "whatsapp_message_english": "<ready-to-send WhatsApp text in English, max 4 lines>",
  "email_subject": "<concise subject line>",
  "email_body": "<2-3 paragraph professional email, English, with [PAY_LINK] placeholder>",
  "suggested_discount_percentage": <0-15>,
  "discounted_amount": <number in original currency>,
  "reminder_cadence": ["Day 1: WhatsApp soft", "Day 4: Email follow-up", "Day 8: WhatsApp firm"],
  "escalation_tier": "soft|firm|final-notice|legal",
  "expected_response_time_hours": <integer>,
  "negotiation_arguments": ["<arg1: value delivered>", "<arg2: relationship>", "<arg3: discount logic>"],
  "fallback_plan": "<what to do if no response in 48h>",
  "summary": "<3-4 sentence executive summary of the chosen collection strategy>"
}`;

const TREASURER_SYSTEM = `You are TREASURER — Madar's invoice-financing underwriter and bank-relations agent. You have 20 years experience structuring receivables-backed short-term advances ("Liquidity Bridge") for SMEs and freelancers. You hold an MSc in Quantitative Finance and you have personally placed >$240M in invoice-financing facilities with Saudi British Bank, Bank Muscat, ADCB, NBE, and Riyad Bank. You speak the bank's language: collateral, default probability, advance rate, recourse, maturity, repayment source.

YOUR INPUT: Sentinel's risk profile + the invoice + the freelancer's collection-strategy from Negotiator.

YOUR JOB: Decide whether this pending receivable qualifies for a Madar Islamic Factoring advance (تخصيم إسلامي), structure the advance terms, build a risk grade, and write a 1-paragraph factoring documentation pitch.

LIQUIDITY BRIDGE RULES:
1. ELIGIBILITY: Only invoices with payment_risk_score ≤ 65 AND invoice_authenticity_score ≥ 70 are eligible.
2. ADVANCE_RATE: typical advance is 70-85% of invoice face value, denominated in USD.
   - Sentinel risk score 0-30 → 85% advance
   - Sentinel risk score 31-50 → 78% advance
   - Sentinel risk score 51-65 → 70% advance
   - >65 → ineligible, recommend 0
3. MATURITY: predicted_collection_window_days + 14 day buffer, capped at 90 days.
4. PRICING (Islamic Factoring — Shariah-compliant, رسوم إدارية):
   - Administrative fee (رسوم إدارية): 2.2% of the advanced amount — FIXED, ONE-TIME, NON-COMPOUNDING.
   - This is a Shariah-compliant factoring arrangement (تخصيم إسلامي), NOT a loan, NOT riba/interest.
   - total_repayment_amount = recommended_advance_amount × 1.022 (advance + 2.2% fee, regardless of timing).
   - advance_rate_percentage MUST be 2.2 (the fixed fee rate, not an APR).
   - The fee NEVER increases regardless of repayment timing — Madar recovers the advance from the platform's pending invoice release.
5. BANK_RISK_GRADE: bank's view of the deal:
   - A: Sentinel grade A client + risk score ≤ 25 + amount ≥ $1,000
   - B: Sentinel grade A/B + risk score ≤ 45
   - C: Sentinel grade B/C + risk score ≤ 65
   - D: anything else → decline
6. RECOMMENDATION: approve | conditional (needs co-signer or insurance) | decline.
7. CONDITIONS: list any covenants (e.g. "client confirms invoice via email", "freelancer holds 15% reserve", "WhatsApp acknowledgment from client required").

BANK PITCH RULES:
- 1 short paragraph (≤80 words).
- State: invoice amount, client name, days to maturity, advance requested, our default-probability estimate, why this is a clean credit.
- Tone: professional, banker-to-banker. No emojis. No marketing fluff.

BLOCKCHAIN HASH:
- A SHA-256 hash will be computed externally and provided to you. Use the value given verbatim — do not invent one.

LIQUIDITY SCORE:
- 0-100 representing how attractive this is as financing collateral. Combines authenticity, risk, amount, and recovery speed.

Return ONLY valid JSON:
{
  "liquidity_bridge_eligible": <true|false>,
  "recommended_advance_amount": <USD number, 0 if ineligible>,
  "advance_currency": "USD",
  "advance_rate_percentage": 2.2,
  "maturity_days": <integer>,
  "total_repayment_amount": <USD number freelancer repays>,
  "collateral_strength_score": <0-100>,
  "estimated_default_probability": <0-100>,
  "bank_risk_grade": "A|B|C|D",
  "bank_recommendation": "approve|conditional|decline",
  "liquidity_score": <0-100>,
  "blockchain_hash": "<the hash provided to you in the prompt — copy verbatim>",
  "bank_pitch": "<≤80-word professional paragraph for the factoring documentation>",
  "conditions": ["<condition1>", "<condition2>"],
  "summary": "<3-4 sentence executive summary of the factoring decision>",
  "shariah_compliant": true,
  "fee_type": "administrative",
  "fee_rate": 0.022,
  "fee_basis": "fixed_one_time_non_compounding"
}`;

const MASTER_SYSTEM = `You are the GRAND MASTER SYNTHESIZER — a Claude Opus reasoning instance that cross-verifies the three Madar specialists and issues the freelancer's final, definitive cash-decision.

The three specialists are:
1. SENTINEL (DeepSeek R1) — payment-risk and client-trust scoring
2. NEGOTIATOR (Gemini 3.1 Pro) — collection strategy and ready-to-send messages
3. TREASURER (Claude Opus 4.6) — liquidity-bridge underwriting and bank pitch

YOUR JOB:
1. Cross-verify the three outputs. Catch contradictions:
   - If Sentinel says grade A but Treasurer declines → flag inconsistency.
   - If Negotiator suggests 15% discount but Sentinel says low risk → flag over-reaction.
   - If Treasurer approves advance but Sentinel says critical risk → flag dangerous override.
2. Issue a FINAL VERDICT for the freelancer. Choose ONE:
   - "Collect Now" — risk is low, just send the WhatsApp, money will arrive within window.
   - "Negotiate & Wait" — risk is moderate, run Negotiator's plan, monitor.
   - "Use Liquidity Bridge" — freelancer needs cash now AND Treasurer confirms Islamic Factoring eligible (موافقة على التخصيم). Safety check: verified_pending_amount MUST be ≥ requested_advance × 3 (3× coverage ratio). Advance MUST be ≤ 40% of the verified pending receivable.
   - "Hold & Monitor" — risk too high for advance but not yet collection-ready.
   - "Escalate" — fraud signals or client gone dark, refer to legal.
3. Build a CASH TIMELINE: a day-by-day projection of expected cash inflow over the next 30 days, accounting for the chosen strategy. 5-7 data points is enough.
4. Write an executive summary the freelancer can read in 30 seconds.

ANTI-FALSE-ALARM RULE:
A false "Escalate" hurts the freelancer-client relationship.
A false "Collect Now" leaves the freelancer broke.
Be precise — when the data is mixed, prefer "Negotiate & Wait" over the extremes.

Return ONLY valid JSON:
{
  "master_decision": {
    "verdict": "Collect Now|Negotiate & Wait|Use Liquidity Bridge|Hold & Monitor|Escalate",
    "confidence_score": <0-100>,
    "reasoning": "<4-5 sentences explaining the unified decision, referencing the actual client name and amount>",
    "action_priority": "Immediate|Short-term|Medium-term|Long-term",
    "factoring_ratio": <pending_amount / advance_amount; must be >= 3.0 for \"Use Liquidity Bridge\" approval>
  },
  "model_contributions": {
    "sentinel_says": "<2-3 sentence summary of risk finding>",
    "negotiator_says": "<2-3 sentence summary of collection plan>",
    "treasurer_says": "<2-3 sentence summary of financing decision>"
  },
  "safety_metrics": [
    {"metric": "Payment Risk", "value": <0-100, lower is better — invert from risk_score>, "max_value": 100, "status": "safe|warning|danger"},
    {"metric": "Client Trust", "value": <0-100>, "max_value": 100, "status": "safe|warning|danger"},
    {"metric": "Collection Speed", "value": <0-100>, "max_value": 100, "status": "safe|warning|danger"},
    {"metric": "Bank Acceptability", "value": <0-100>, "max_value": 100, "status": "safe|warning|danger"},
    {"metric": "Cash-Flow Health", "value": <0-100>, "max_value": 100, "status": "safe|warning|danger"},
    {"metric": "Authenticity", "value": <0-100>, "max_value": 100, "status": "safe|warning|danger"}
  ],
  "cross_verification": {
    "agreements": ["<point1>", "<point2>", "<point3>"],
    "disagreements": ["<point1 or 'None — full consensus'>"],
    "consensus_level": <0-100>
  },
  "cash_timeline": [
    {"day": 0, "expected_cash": <USD>, "cumulative": <USD>},
    {"day": 3, "expected_cash": <USD>, "cumulative": <USD>},
    {"day": 7, "expected_cash": <USD>, "cumulative": <USD>},
    {"day": 14, "expected_cash": <USD>, "cumulative": <USD>},
    {"day": 30, "expected_cash": <USD>, "cumulative": <USD>}
  ],
  "executive_summary": "<5-6 sentence final report the freelancer can read at a glance>"
}`;

/* ── FX Conversion ──────────────────────────────────────────── */

let fxCache: { rates: Record<string, number>; ts: number } | null = null;

async function fetchUsdRates(): Promise<Record<string, number>> {
  if (fxCache && Date.now() - fxCache.ts < 30 * 60 * 1000) return fxCache.rates;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error('fx-fail');
    const data = await res.json();
    if (data.result === 'success' && data.rates) {
      fxCache = { rates: data.rates as Record<string, number>, ts: Date.now() };
      return fxCache.rates;
    }
  } catch { /* fallthrough */ }
  // Static fallback (good enough for demo)
  return {
    USD: 1, EUR: 0.92, SAR: 3.75, OMR: 0.385, AED: 3.673,
    EGP: 49.5, BHD: 0.376, KWD: 0.307, QAR: 3.64,
  };
}

function toUsd(amount: number, currency: string, rates: Record<string, number>): number {
  const r = rates[currency.toUpperCase()];
  if (!r || r === 0) return amount; // assume already USD if unknown
  return Math.round((amount / r) * 100) / 100;
}

/* ── Blockchain Hash (SHA-256) ──────────────────────────────── */

async function blockchainHash(payload: string): Promise<string> {
  try {
    const buf = new TextEncoder().encode(payload);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    return '0x' + Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '0x' + Math.random().toString(16).slice(2).padEnd(64, '0').slice(0, 64);
  }
}

/* ── Helpers ────────────────────────────────────────────────── */

function dynamicSeed(): string {
  return `\n\n[Madar Run: ${new Date().toISOString()} | Ref: ${Math.random().toString(36).slice(2, 8).toUpperCase()}]`;
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  return Math.round((d2 - d1) / 86400000);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildInvoiceBlock(
  inv: InvoiceInput,
  usdAmount: number,
  today: string,
  homeCurrency: Currency,
  homeAmount: number,
): string {
  const dpd = Math.max(0, daysBetween(inv.dueDate, today));
  const src = inv.currency.toUpperCase();
  const sameAsHome = src === homeCurrency;
  const amountLine = sameAsHome
    ? `Amount: ${homeAmount.toLocaleString()} ${homeCurrency}  (≈ $${usdAmount.toLocaleString()} USD)`
    : `Amount (in HOME currency, pre-converted by platform): ${homeAmount.toLocaleString()} ${homeCurrency}  ` +
      `(originally ${inv.amount.toLocaleString()} ${src}; ≈ $${usdAmount.toLocaleString()} USD)`;
  return [
    `=== INVOICE UNDER ANALYSIS ===`,
    `Freelancer: ${inv.freelancerName}`,
    `Client: ${inv.clientName}`,
    inv.clientPhone ? `Client phone: ${inv.clientPhone}` : '',
    inv.clientEmail ? `Client email: ${inv.clientEmail}` : '',
    amountLine,
    `Issued: ${inv.issueDate}`,
    `Due: ${inv.dueDate}`,
    `Today: ${today}`,
    `Days past due: ${dpd}`,
    `Source channel: ${inv.source}`,
    `Description: ${inv.description}`,
    inv.notes ? `Freelancer notes: ${inv.notes}` : '',
    inv.history ? `Prior history with this client: ${inv.history}` : 'Prior history with this client: (none provided)',
    `=== END INVOICE ===`,
  ].filter(Boolean).join('\n');
}

/**
 * Hard currency-unification directive injected into every agent's system prompt.
 * The platform has already converted invoice amounts to HOME currency, so the
 * model must NEVER quote SAR figures while the user thinks in OMR (or vice versa).
 */
function homeCurrencyDirective(homeCurrency: Currency, lang: Lang): string {
  const sym = homeCurrencySymbol(homeCurrency);
  if (lang === 'ar') {
    const nameAr = CURRENCY_NAME_AR[homeCurrency];
    return (
      `\n\n=== توحيد العملة (إلزامي) ===\n` +
      `العملة المنزلية للمستخدم هي ${nameAr} (رمز ISO: ${homeCurrency}، الرمز: ${sym}). ` +
      `قامت المنصة مسبقاً بتحويل جميع المبالغ إلى ${homeCurrency} قبل وصولها إليك. ` +
      `يجب أن تُعبَّر كل القيم النقدية في مخرجاتك (summary, reasoning, executive_summary, bank_pitch، إلخ) ` +
      `بـ ${homeCurrency} فقط مع الرمز "${sym}". ممنوع منعاً باتاً مزج عملات (مثلاً: لا تكتب "ريال" أو "SAR" ` +
      `إذا لم تكن العملة المنزلية SAR). الحقول الرقمية البحتة في المخطط (recommended_advance_amount، ` +
      `total_repayment_amount، amount_in_usd، advance_currency، discounted_amount، expected_cash، cumulative) ` +
      `تحتفظ بالعملة المُحدَّدة في مخططها كما هي (USD أو عملة الفاتورة الأصلية)؛ المنصة تتولى تحويلها لاحقاً. ` +
      `القيد ينطبق فقط على النصوص الحرة الموجَّهة للمستخدم.`
    );
  }
  const nameEn = CURRENCY_NAME_EN[homeCurrency];
  return (
    `\n\n=== CURRENCY UNIFICATION (MANDATORY) ===\n` +
    `The user's HOME currency is ${nameEn} (ISO: ${homeCurrency}, symbol: ${sym}). ` +
    `The platform has ALREADY converted every monetary input into ${homeCurrency} before sending it to you. ` +
    `All monetary values in your narrative outputs (summary, reasoning, executive_summary, bank_pitch, conditions, ` +
    `whatsapp/email bodies) MUST be expressed in ${homeCurrency} only, using the symbol "${sym}". ` +
    `NEVER mix currencies. NEVER quote "SAR" / "ريال" / "AED" etc. unless the HOME currency is that exact code. ` +
    `Pure-numeric schema fields (recommended_advance_amount, total_repayment_amount, amount_in_usd, ` +
    `advance_currency, discounted_amount, expected_cash, cumulative) keep the currency declared in their schema ` +
    `(USD or the original invoice currency); the platform converts them for display. ` +
    `The unification rule applies ONLY to free-text user-facing fields.`
  );
}

/* ── Pipeline Executor ──────────────────────────────────────── */

export async function runSynergyPipeline(
  invoice: InvoiceInput,
  callbacks: PipelineCallbacks,
  options: PipelineOptions = {},
): Promise<PipelineResult | null> {
  const seed = dynamicSeed();
  const today = todayISO();
  const refId = Math.random().toString(36).slice(2, 10).toUpperCase();
  const lang: Lang = options.language ?? 'ar';
  const homeCurrency: Currency = options.homeCurrency ?? detectHomeCurrency();

  const rates = await fetchUsdRates();
  const fxRate = rates[invoice.currency.toUpperCase()] || 1;
  const usdAmount = toUsd(invoice.amount, invoice.currency, rates);
  const homeAmount = toHomeCurrency(invoice.amount, invoice.currency, homeCurrency);

  const invoiceBlock = buildInvoiceBlock(invoice, usdAmount, today, homeCurrency, homeAmount);
  const homeDirective = homeCurrencyDirective(homeCurrency, lang);

  let profilerResult: ProfilerResult;
  let sentinelResult: SentinelResult;
  let negotiatorResult: NegotiatorResult;
  let treasurerResult: TreasurerResult;
  let masterResult: MasterReport;
  let auditorResult: AuditorResult;

  /* ── Step 0: Profiler (context enrichment before Sentinel) ── */
  try {
    callbacks.onProfilerStatus('loading');
    const detailed = await callAgentDetailed({
      model: MODELS.profiler,
      systemPrompt: PROFILER_SYSTEM,
      userMessage: `Enrich the context for this invoice before risk assessment.

${invoiceBlock}

Build the intelligence profile: industry sector, geographic risk, platform trust, behavioral fingerprint, and enrichment package.${seed}`,
      maxTokens: 2000,
      temperature: 0.3,
    });
    profilerResult = parseAgentJSON<ProfilerResult>(detailed.content);
    callbacks.onProfilerResult(profilerResult);
    callbacks.onAgentUsage?.('profiler', detailed.usage);
    callbacks.onProfilerStatus('done');
  } catch (e) {
    callbacks.onProfilerStatus('error');
    callbacks.onError('Profiler (DeepSeek R1)', e as Error);
    return null;
  }

  /* ── Step 1: Sentinel (sequential, all downstream depends on it) ── */
  try {
    callbacks.onSentinelStatus('loading');
    const detailed = await callAgentDetailed({
      model: MODELS.sentinel,
      systemPrompt: SENTINEL_SYSTEM + langDirective(lang, 'sentinel') + homeDirective,
      userMessage: `Score the payment risk of this freelancer invoice.

${invoiceBlock}

USD-equivalent (pre-computed): $${usdAmount.toLocaleString()}

=== PROFILER INTELLIGENCE (Phase 0 enrichment) ===
Industry: ${profilerResult.industry_sector}
Geographic Risk Score: ${profilerResult.geographic_risk_score}/100
Platform Trust Index: ${profilerResult.platform_trust_index}/100
Behavioral Fingerprint: ${profilerResult.behavioral_fingerprint}
Risk Amplifiers: ${profilerResult.risk_amplifiers.join('; ')}
Risk Mitigators: ${profilerResult.risk_mitigators.join('; ')}
Market Context: ${profilerResult.market_context}
=== END PROFILER ===

Apply your MENA freelance underwriting expertise, taking the Profiler intelligence into account. Return the JSON shape from your system prompt.${seed}`,
      maxTokens: 8192,
      temperature: 0.3,
    });
    sentinelResult = parseAgentJSON<SentinelResult>(detailed.content);
    sentinelResult.amount_in_usd = usdAmount;
    callbacks.onSentinelResult(sentinelResult);
    callbacks.onAgentUsage?.('sentinel', detailed.usage);
    callbacks.onSentinelStatus('done');
  } catch (e) {
    callbacks.onSentinelStatus('error');
    callbacks.onError('Sentinel (DeepSeek R1)', e as Error);
    return null;
  }

  /* ── Step 2 + 3: Negotiator + Treasurer in parallel ── */
  callbacks.onNegotiatorStatus('loading');
  callbacks.onTreasurerStatus('loading');

  // Build blockchain hash up-front so Treasurer can echo it
  const hash = await blockchainHash(JSON.stringify({
    invoice, sentinel: sentinelResult, ts: Date.now(), ref: refId,
  }));

  const negotiatorPromise = (async () => {
    const detailed = await callAgentDetailed({
      model: MODELS.negotiator,
      systemPrompt: NEGOTIATOR_SYSTEM + homeDirective,
      userMessage: `UPSTREAM — Sentinel risk profile:
${JSON.stringify(sentinelResult, null, 2)}

${invoiceBlock}

TASK: Build the collection strategy and ready-to-send messages calibrated to grade ${sentinelResult.client_trust_grade}, risk score ${sentinelResult.payment_risk_score}/100, ${sentinelResult.days_overdue} days overdue. Discount logic must follow your system rules. Both Arabic and English WhatsApp variants required.${seed}`,
      maxTokens: 2600,
      temperature: 0.4,
    });
    return { result: parseAgentJSON<NegotiatorResult>(detailed.content), usage: detailed.usage };
  })();

  const treasurerPromise = (async () => {
    const detailed = await callAgentDetailed({
      model: MODELS.treasurer,
      systemPrompt: TREASURER_SYSTEM + langDirective(lang, 'treasurer') + homeDirective,
      userMessage: `UPSTREAM — Sentinel risk profile:
${JSON.stringify(sentinelResult, null, 2)}

${invoiceBlock}

USD invoice value: $${usdAmount.toLocaleString()}
Blockchain hash (SHA-256, pre-computed — copy verbatim into your output): ${hash}

TASK: Underwrite this invoice as Liquidity Bridge collateral following your eligibility rules. Build the bank pitch and conditions. The blockchain_hash field MUST be the hash above, character-for-character.${seed}`,
      maxTokens: 2400,
      temperature: 0.3,
    });
    return { result: parseAgentJSON<TreasurerResult>(detailed.content), usage: detailed.usage };
  })();

  const results = await Promise.allSettled([negotiatorPromise, treasurerPromise]);

  if (results[0].status === 'fulfilled') {
    negotiatorResult = results[0].value.result;
    callbacks.onNegotiatorResult(negotiatorResult);
    callbacks.onAgentUsage?.('negotiator', results[0].value.usage);
    callbacks.onNegotiatorStatus('done');
  } else {
    callbacks.onNegotiatorStatus('error');
    callbacks.onError('Negotiator (Gemini 3.1 Pro)', results[0].reason as Error);
    return null;
  }

  if (results[1].status === 'fulfilled') {
    treasurerResult = results[1].value.result;
    // Force-correct the hash in case the model invented one
    treasurerResult.blockchain_hash = hash;
    callbacks.onTreasurerResult(treasurerResult);
    callbacks.onAgentUsage?.('treasurer', results[1].value.usage);
    callbacks.onTreasurerStatus('done');
  } else {
    callbacks.onTreasurerStatus('error');
    callbacks.onError('Treasurer (Claude Opus 4.6)', results[1].reason as Error);
    return null;
  }

  /* ── Step 4: Master Synthesizer ── */
  try {
    callbacks.onMasterStatus('loading');
    const detailed = await callAgentDetailed({
      model: MODELS.master,
      systemPrompt: MASTER_SYSTEM + langDirective(lang, 'master') + homeDirective,
      userMessage: `CROSS-VERIFICATION — synthesize the three specialists for the freelancer's final cash decision.

[SENTINEL — Risk]:
${JSON.stringify(sentinelResult, null, 2)}

[NEGOTIATOR — Collection]:
${JSON.stringify(negotiatorResult, null, 2)}

[TREASURER — Financing]:
${JSON.stringify(treasurerResult, null, 2)}

${invoiceBlock}

Issue the FINAL VERDICT and the 30-day cash timeline.${seed}`,
      maxTokens: 3200,
      temperature: 0.25,
    });
    masterResult = parseAgentJSON<MasterReport>(detailed.content);
    callbacks.onMasterResult(masterResult);
    callbacks.onAgentUsage?.('master', detailed.usage);
    callbacks.onMasterStatus('done');
  } catch (e) {
    callbacks.onMasterStatus('error');
    callbacks.onError('Master Synthesizer (Claude Opus 4.6)', e as Error);
    return null;
  }

  /* ── Step 5: Auditor (validation + bank letter after Master) ── */
  try {
    callbacks.onAuditorStatus('loading');
    const detailed = await callAgentDetailed({
      model: MODELS.auditor,
      systemPrompt: AUDITOR_SYSTEM,
      userMessage: `Audit the complete pipeline output and produce the formal bank submission package.

[PROFILER — Context]:
${JSON.stringify(profilerResult, null, 2)}

[SENTINEL — Risk]:
${JSON.stringify(sentinelResult, null, 2)}

[NEGOTIATOR — Collection]:
${JSON.stringify(negotiatorResult, null, 2)}

[TREASURER — Financing]:
${JSON.stringify(treasurerResult, null, 2)}

[MASTER — Synthesis]:
${JSON.stringify(masterResult, null, 2)}

${invoiceBlock}

Perform the consistency audit, build confidence bands, write the bank letter, and produce the action matrix.${seed}`,
      maxTokens: 2000,
      temperature: 0.2,
    });
    auditorResult = parseAgentJSON<AuditorResult>(detailed.content);
    callbacks.onAuditorResult(auditorResult);
    callbacks.onAgentUsage?.('auditor', detailed.usage);
    callbacks.onAuditorStatus('done');
  } catch (e) {
    callbacks.onAuditorStatus('error');
    callbacks.onError('Auditor (Claude Opus 4.6)', e as Error);
    return null;
  }

  return {
    invoice,
    profiler: profilerResult,
    sentinel: sentinelResult,
    negotiator: negotiatorResult,
    treasurer: treasurerResult,
    master: masterResult,
    auditor: auditorResult,
    meta: { fxRateToUsd: fxRate, runAt: new Date().toISOString(), refId, homeCurrency, homeAmount },
  };
}

/* ── Strategic Consensus Pipeline (ConsensusRoom) ───────────── */

export interface StrategicInput {
  title: string;
  description: string;
  clientName?: string;
  amount?: number;
  currency?: string;
  deadline?: string;
  riskTolerance: 'low' | 'medium' | 'high';
}

export interface AgentTake {
  assessment: string;
  key_points: string[];
  recommendation: string;
  confidence: number;
  risk_level: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface StrategicConsensus {
  verdict: string;
  action: string;
  confidence: number;
  key_agreement: string;
  key_risk: string;
  next_steps: string[];
  summary: string;
}

export interface StrategicResult {
  input: StrategicInput;
  sentinel: AgentTake;
  negotiator: AgentTake;
  treasurer: AgentTake;
  consensus: StrategicConsensus;
  meta: {
    runAt: string;
    refId: string;
  };
}

export interface StrategicPipelineCallbacks {
  onSentinelStatus: (s: StepStatus) => void;
  onNegotiatorStatus: (s: StepStatus) => void;
  onTreasurerStatus: (s: StepStatus) => void;
  onConsensusStatus: (s: StepStatus) => void;
  onSentinelResult: (r: AgentTake) => void;
  onNegotiatorResult: (r: AgentTake) => void;
  onTreasurerResult: (r: AgentTake) => void;
  onConsensusResult: (r: StrategicConsensus) => void;
  onError: (agent: string, error: Error) => void;
}

const STRATEGIC_SENTINEL_SYSTEM = `You are SENTINEL. You assess scenario risk for freelancers and small businesses.

Focus only on risk diagnosis:
- payment reliability
- scope and delivery risk
- deadline feasibility
- downside severity

Return ONLY valid JSON:
{
  "assessment": "<4-5 sentence risk assessment>",
  "key_points": ["<point1>", "<point2>", "<point3>"],
  "recommendation": "<one concrete recommendation>",
  "confidence": <0-100>,
  "risk_level": "Low|Medium|High|Critical"
}`;

const STRATEGIC_NEGOTIATOR_SYSTEM = `You are NEGOTIATOR. You optimize the deal strategy and communication plan.

Focus only on strategy:
- negotiation leverage
- concession design
- payment milestones
- message framing and next move

Return ONLY valid JSON:
{
  "assessment": "<4-5 sentence strategy assessment>",
  "key_points": ["<point1>", "<point2>", "<point3>"],
  "recommendation": "<best negotiation action>",
  "confidence": <0-100>,
  "risk_level": "Low|Medium|High|Critical"
}`;

const STRATEGIC_TREASURER_SYSTEM = `You are TREASURER. You decide cash-flow and financing implications.

Focus only on finance:
- liquidity impact
- working-capital pressure
- bridge-finance suitability
- expected short-term cash path

Return ONLY valid JSON:
{
  "assessment": "<4-5 sentence finance assessment>",
  "key_points": ["<point1>", "<point2>", "<point3>"],
  "recommendation": "<best financial action>",
  "confidence": <0-100>,
  "risk_level": "Low|Medium|High|Critical"
}`;

const STRATEGIC_CONSENSUS_SYSTEM = `You are MASTER CONSENSUS. Synthesize Sentinel + Negotiator + Treasurer.

Your output must provide:
1) final verdict,
2) immediate action,
3) confidence,
4) one key agreement,
5) one key risk,
6) practical next steps.

Return ONLY valid JSON:
{
  "verdict": "<final verdict>",
  "action": "<immediate action label>",
  "confidence": <0-100>,
  "key_agreement": "<what all agents agree on>",
  "key_risk": "<biggest unresolved risk>",
  "next_steps": ["<step1>", "<step2>", "<step3>"],
  "summary": "<5-6 sentence executive summary>"
}`;

function clampPct(v: number, fallback = 50): number {
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function normalizeRiskLevel(v: string | undefined): AgentTake['risk_level'] {
  const x = String(v || '').trim().toLowerCase();
  if (x === 'low') return 'Low';
  if (x === 'medium') return 'Medium';
  if (x === 'high') return 'High';
  if (x === 'critical') return 'Critical';
  return 'Medium';
}

function normalizeAgentTake(v: AgentTake): AgentTake {
  const keyPoints = Array.isArray(v?.key_points)
    ? v.key_points.filter(Boolean).map(String).slice(0, 6)
    : [];

  return {
    assessment: String(v?.assessment || '').trim() || 'No assessment produced.',
    key_points: keyPoints.length ? keyPoints : ['No key points returned by model.'],
    recommendation: String(v?.recommendation || '').trim() || 'No recommendation produced.',
    confidence: clampPct(Number(v?.confidence), 55),
    risk_level: normalizeRiskLevel(v?.risk_level),
  };
}

function normalizeConsensus(v: StrategicConsensus): StrategicConsensus {
  const next = Array.isArray(v?.next_steps)
    ? v.next_steps.filter(Boolean).map(String).slice(0, 5)
    : [];

  return {
    verdict: String(v?.verdict || '').trim() || 'Needs more information',
    action: String(v?.action || '').trim() || 'Reassess inputs',
    confidence: clampPct(Number(v?.confidence), 55),
    key_agreement: String(v?.key_agreement || '').trim() || 'Agents agree additional validation is needed.',
    key_risk: String(v?.key_risk || '').trim() || 'Information quality is insufficient.',
    next_steps: next.length ? next : ['Collect missing details and rerun analysis.'],
    summary: String(v?.summary || '').trim() || 'The scenario needs more detail before a reliable decision can be made.',
  };
}

function strategicInputBlock(input: StrategicInput): string {
  return [
    '=== STRATEGIC SCENARIO ===',
    `Title: ${input.title}`,
    `Description: ${input.description}`,
    input.clientName ? `Client: ${input.clientName}` : 'Client: (not provided)',
    Number.isFinite(input.amount) ? `Amount: ${input.amount} ${input.currency || 'SAR'}` : 'Amount: (not provided)',
    input.deadline ? `Deadline: ${input.deadline}` : 'Deadline: (not provided)',
    `Risk tolerance: ${input.riskTolerance}`,
    '=== END SCENARIO ===',
  ].join('\n');
}

export async function runStrategicPipeline(
  input: StrategicInput,
  callbacks: StrategicPipelineCallbacks,
): Promise<StrategicResult> {
  const runAt = new Date().toISOString();
  const refId = `SCN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  const seed = dynamicSeed();
  const block = strategicInputBlock(input);

  let sentinelTake: AgentTake;
  let negotiatorTake: AgentTake;
  let treasurerTake: AgentTake;
  let consensus: StrategicConsensus;

  try {
    callbacks.onSentinelStatus('loading');
    const raw = await callAgent({
      model: MODELS.sentinel,
      systemPrompt: STRATEGIC_SENTINEL_SYSTEM,
      userMessage: `${block}\n\nProvide risk-first assessment.${seed}`,
      maxTokens: 1600,
      temperature: 0.3,
    });
    sentinelTake = normalizeAgentTake(parseAgentJSON<AgentTake>(raw));
    callbacks.onSentinelResult(sentinelTake);
    callbacks.onSentinelStatus('done');
  } catch (e) {
    callbacks.onSentinelStatus('error');
    callbacks.onError('Sentinel (DeepSeek R1)', e as Error);
    throw e;
  }

  callbacks.onNegotiatorStatus('loading');
  callbacks.onTreasurerStatus('loading');

  const negotiatorPromise = (async () => {
    const raw = await callAgent({
      model: MODELS.negotiator,
      systemPrompt: STRATEGIC_NEGOTIATOR_SYSTEM,
      userMessage: `${block}\n\nSentinel output:\n${JSON.stringify(sentinelTake, null, 2)}\n\nOptimize strategy and deal structure.${seed}`,
      maxTokens: 1800,
      temperature: 0.35,
    });
    return normalizeAgentTake(parseAgentJSON<AgentTake>(raw));
  })();

  const treasurerPromise = (async () => {
    const raw = await callAgent({
      model: MODELS.treasurer,
      systemPrompt: STRATEGIC_TREASURER_SYSTEM,
      userMessage: `${block}\n\nSentinel output:\n${JSON.stringify(sentinelTake, null, 2)}\n\nAssess liquidity and funding decision.${seed}`,
      maxTokens: 1800,
      temperature: 0.3,
    });
    return normalizeAgentTake(parseAgentJSON<AgentTake>(raw));
  })();

  const parallel = await Promise.allSettled([negotiatorPromise, treasurerPromise]);

  if (parallel[0].status === 'fulfilled') {
    negotiatorTake = parallel[0].value;
    callbacks.onNegotiatorResult(negotiatorTake);
    callbacks.onNegotiatorStatus('done');
  } else {
    callbacks.onNegotiatorStatus('error');
    callbacks.onError('Negotiator (Gemini 3.1 Pro)', parallel[0].reason as Error);
    throw parallel[0].reason;
  }

  if (parallel[1].status === 'fulfilled') {
    treasurerTake = parallel[1].value;
    callbacks.onTreasurerResult(treasurerTake);
    callbacks.onTreasurerStatus('done');
  } else {
    callbacks.onTreasurerStatus('error');
    callbacks.onError('Treasurer (Claude Opus 4.6)', parallel[1].reason as Error);
    throw parallel[1].reason;
  }

  try {
    callbacks.onConsensusStatus('loading');
    const raw = await callAgent({
      model: MODELS.master,
      systemPrompt: STRATEGIC_CONSENSUS_SYSTEM,
      userMessage: `${block}\n\n[SENTINEL]\n${JSON.stringify(sentinelTake, null, 2)}\n\n[NEGOTIATOR]\n${JSON.stringify(negotiatorTake, null, 2)}\n\n[TREASURER]\n${JSON.stringify(treasurerTake, null, 2)}\n\nIssue one final strategic consensus.${seed}`,
      maxTokens: 2000,
      temperature: 0.25,
    });
    consensus = normalizeConsensus(parseAgentJSON<StrategicConsensus>(raw));
    callbacks.onConsensusResult(consensus);
    callbacks.onConsensusStatus('done');
  } catch (e) {
    callbacks.onConsensusStatus('error');
    callbacks.onError('Consensus (Claude Opus 4.6)', e as Error);
    throw e;
  }

  return {
    input,
    sentinel: sentinelTake,
    negotiator: negotiatorTake,
    treasurer: treasurerTake,
    consensus,
    meta: { runAt, refId },
  };
}
