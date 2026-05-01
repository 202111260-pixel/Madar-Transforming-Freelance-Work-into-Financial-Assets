/**
 * Madar · Liquidity Bridge Credit Assessment
 *
 * Bank-grade PDF formatted as a formal credit submission letter
 * following MENA bank underwriting memo standards.
 *
 * DESIGN RULES:
 *   - White paper, single dark-navy accent colour only
 *   - No gradients, no background fills (except very-light section bands)
 *   - All agent text in ENGLISH only — jsPDF has no Arabic Unicode font;
 *     rendering Arabic produces garbled characters (þ/strange symbols).
 *   - Structured tables for every numeric block
 *   - Official circular certification stamp on final page
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PipelineResult } from './synergyPipeline';

/* ─── Palette — navy + neutral greys only ─────────────────────── */
const NAVY:   [number,number,number] = [15, 25, 50];
const NAVY2:  [number,number,number] = [30, 50, 90];
const SLATE:  [number,number,number] = [60, 80, 120];
const RULE:   [number,number,number] = [200, 210, 225];
const BODY:   [number,number,number] = [30, 35, 45];
const MUTED:  [number,number,number] = [110, 120, 140];
const BAND:   [number,number,number] = [245, 247, 251];
const WHITE:  [number,number,number] = [255, 255, 255];
const GREEN:  [number,number,number] = [20, 100, 65];
const AMBER:  [number,number,number] = [140, 80, 10];
const RED:    [number,number,number] = [160, 30, 30];

function statusRgb(s: string): [number,number,number] {
  const v = s.toLowerCase();
  if (v.includes('safe') || v.includes('pass') || v.includes('ok') || v.includes('green'))  return GREEN;
  if (v.includes('danger') || v.includes('fail') || v.includes('red') || v.includes('high')) return RED;
  return AMBER;
}
function verdictRgb(v: string): [number,number,number] {
  const lv = v.toLowerCase();
  if (lv.includes('approve') || lv.includes('collect now') || lv.includes('bridge'))  return GREEN;
  if (lv.includes('decline') || lv.includes('escalate'))                               return RED;
  return AMBER;
}

/** Strip any non-printable / non-ASCII characters that jsPDF cannot render */
function safe(s: unknown): string {
  if (s == null) return '--';
  return String(s)
    .replace(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g, '')
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .replace(/  +/g, ' ')
    .trim() || '--';
}

function fmtDate(d: Date) {
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function fmtMoney(n: number, ccy = 'USD') {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ' + ccy.toUpperCase();
}

export function buildRiskReportPdf(result: PipelineResult): jsPDF {
  const { invoice, sentinel, negotiator, treasurer, master, meta } = result;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  const W  = 210;
  const H  = 297;
  const ML = 22;
  const MR = 22;
  const TW = W - ML - MR;
  const now = new Date();
  let y = 0;

  function rule(yy = y, weight = 0.25, col: [number,number,number] = RULE) {
    doc.setDrawColor(...col).setLineWidth(weight);
    doc.line(ML, yy, W - MR, yy);
  }
  function thickRule(yy = y, col: [number,number,number] = NAVY) {
    doc.setFillColor(...col);
    doc.rect(ML, yy, TW, 0.55, 'F');
  }
  function accent(yy = y, h = 8) {
    doc.setFillColor(...NAVY);
    doc.rect(ML, yy, 1.2, h, 'F');
  }

  function ensure(h: number, label = 'Risk Report') {
    if (y + h > H - 20) newPage(label);
  }

  function pageHeader(title: string) {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 9, 'F');
    doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(...WHITE);
    doc.text('MADAR - AI UNDERWRITING', ML, 6.2);
    doc.setFont('helvetica', 'normal').setTextColor(180, 200, 235);
    doc.text(title.toUpperCase(), W / 2, 6.2, { align: 'center' });
    doc.text('REF: ' + meta.refId, W - MR, 6.2, { align: 'right' });
    y = 18;
  }

  function pageFooter() {
    const pg = doc.getCurrentPageInfo().pageNumber;
    const total = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
    rule(H - 12, 0.25, RULE);
    doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(...MUTED);
    doc.text('Madar confidential - Tri-agent autonomous underwriting - SHA-256 tamper-proof seal', ML, H - 7.5);
    doc.setTextColor(...SLATE);
    doc.text(pg + ' / ' + total, W - MR, H - 7.5, { align: 'right' });
  }

  function newPage(label: string) {
    pageFooter();
    doc.addPage();
    pageHeader(label);
  }

  function sectionHeader(title: string, sub?: string) {
    ensure(14);
    accent(y, 7);
    doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...NAVY);
    doc.text(title.toUpperCase(), ML + 5, y + 5.2);
    if (sub) {
      doc.setFontSize(7.5).setFont('helvetica', 'normal').setTextColor(...MUTED);
      doc.text(sub, W - MR, y + 5.2, { align: 'right' });
    }
    y += 11;
  }

  function body(text: string, size = 9, col: [number,number,number] = BODY) {
    if (!text) return;
    doc.setFontSize(size).setFont('helvetica', 'normal').setTextColor(...col);
    const lines = doc.splitTextToSize(safe(text), TW);
    const h = lines.length * (size * 0.43 + 0.5);
    ensure(h + 2);
    doc.text(lines, ML, y);
    y += h + 3;
  }

  function kpiRow(items: { label: string; value: string; color?: [number,number,number] }[], wide = false) {
    const n = items.length;
    const cw = TW / n;
    items.forEach((it, i) => {
      const x = ML + i * cw;
      doc.setFillColor(...BAND);
      doc.roundedRect(x + 1, y, cw - 2, wide ? 18 : 15, 1, 1, 'F');
      doc.setFontSize(6.5).setFont('helvetica', 'bold').setTextColor(...MUTED);
      doc.text(it.label.toUpperCase(), x + 4, y + 4.5);
      doc.setFontSize(wide ? 12 : 10).setFont('helvetica', 'bold').setTextColor(...(it.color ?? NAVY));
      doc.text(safe(it.value), x + 4, y + (wide ? 13 : 11.5));
    });
    y += (wide ? 18 : 15) + 4;
  }

  /* PAGE 1 — COVER LETTER */
  pageHeader('Credit Assessment Report');

  doc.setFontSize(22).setFont('helvetica', 'bold').setTextColor(...NAVY);
  doc.text('MADAR', ML, y);
  doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...SLATE);
  doc.text('Autonomous Liquidity Bridge  -  Tri-Agent Underwriting Engine', ML, y + 6);
  y += 14;
  thickRule(y);
  y += 5;

  const col2 = ML + TW / 2 + 4;
  const metaRows: [string, string, string, string][] = [
    ['CLIENT',      safe(invoice.clientName),      'REF. NO.',    meta.refId],
    ['INVOICE AMT', invoice.amount.toLocaleString() + ' ' + invoice.currency, 'DATE ISSUED', fmtDate(now)],
    ['DUE DATE',    invoice.dueDate,               'SUBMITTED TO', 'Partner Bank'],
    ['FREELANCER',  safe(invoice.freelancerName),  'DOCUMENT',    'CREDIT ASSESSMENT v1.0'],
  ];
  metaRows.forEach(function([l1, v1, l2, v2]) {
    doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(...MUTED);
    doc.text(l1, ML, y);
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...BODY);
    doc.text(safe(v1), ML, y + 4.5);
    doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(...MUTED);
    doc.text(l2, col2, y);
    doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...BODY);
    doc.text(safe(v2), col2, y + 4.5);
    y += 10;
  });

  rule(y); y += 8;

  doc.setFillColor(...BAND);
  doc.roundedRect(ML, y, TW, 42, 2, 2, 'F');
  const vcol = verdictRgb(master.master_decision.verdict);
  doc.setFillColor(...vcol);
  doc.roundedRect(ML, y, TW, 1.8, 2, 2, 'F');
  doc.rect(ML, y + 1, TW, 0.8, 'F');

  doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(...MUTED);
  doc.text('FINAL UNDERWRITING VERDICT', ML + 6, y + 8);
  doc.setFontSize(20).setFont('helvetica', 'bold').setTextColor(...vcol);
  doc.text(safe(master.master_decision.verdict).toUpperCase(), ML + 6, y + 19);
  doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(...MUTED);
  doc.text('CONFIDENCE  ' + master.master_decision.confidence_score + '%', W - MR - 6, y + 10, { align: 'right' });
  doc.text('PRIORITY  ' + safe(master.master_decision.action_priority).toUpperCase(), W - MR - 6, y + 16, { align: 'right' });
  doc.setFontSize(8.5).setFont('helvetica', 'normal').setTextColor(...BODY);
  const reasonLines = doc.splitTextToSize(safe(master.master_decision.reasoning), TW - 12);
  doc.text(reasonLines.slice(0, 3), ML + 6, y + 27);
  y += 50;

  kpiRow([
    { label: 'Recommended Advance', value: '$' + treasurer.recommended_advance_amount.toLocaleString(), color: GREEN },
    { label: 'Advance Rate (APR)',  value: treasurer.advance_rate_percentage + '%',                     color: NAVY },
    { label: 'Maturity',            value: treasurer.maturity_days + ' days',                           color: NAVY },
    { label: 'Bank Grade',          value: treasurer.bank_risk_grade,                                   color: verdictRgb(treasurer.bank_recommendation) },
  ], true);

  rule(y); y += 6;
  doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(...MUTED);
  doc.text('PREPARED BY', ML, y);
  doc.text('SUBMITTED TO', W / 2, y);
  y += 4;
  doc.setFontSize(9).setFont('helvetica', 'bold').setTextColor(...BODY);
  doc.text('Madar Underwriting Engine', ML, y);
  doc.text('Partner Bank - Liquidity Desk', W / 2, y);
  y += 5;
  doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...MUTED);
  doc.text('DeepSeek R1  -  Gemini 3.1 Pro  -  Claude Opus 4.6', ML, y);
  doc.text('SHA-256 tamper-proof', W / 2, y);

  /* PAGE 2 — RISK ASSESSMENT DASHBOARD */
  newPage('Risk Assessment Dashboard');
  sectionHeader('Section I — Risk Assessment', 'Composite of Sentinel, Negotiator, Treasurer');

  const safety = Math.max(0, Math.min(100, 100 - treasurer.estimated_default_probability));
  const gx = W / 2;
  const gy = y + 30;
  const gr = 22;
  doc.setLineWidth(5).setDrawColor(...RULE);
  for (let i = 0; i <= 60; i++) {
    const a  = Math.PI + (i / 60) * Math.PI;
    const a2 = Math.PI + ((i + 1) / 60) * Math.PI;
    doc.line(gx + Math.cos(a) * gr, gy + Math.sin(a) * gr, gx + Math.cos(a2) * gr, gy + Math.sin(a2) * gr);
  }
  const filled = Math.round((safety / 100) * 60);
  const arcColor: [number,number,number] = safety >= 70 ? GREEN : safety >= 40 ? AMBER : RED;
  doc.setLineWidth(5).setDrawColor(...arcColor);
  for (let i = 0; i < filled; i++) {
    const a  = Math.PI + (i / 60) * Math.PI;
    const a2 = Math.PI + ((i + 1) / 60) * Math.PI;
    doc.line(gx + Math.cos(a) * gr, gy + Math.sin(a) * gr, gx + Math.cos(a2) * gr, gy + Math.sin(a2) * gr);
  }
  doc.setLineWidth(0.2);
  const na = Math.PI + (safety / 100) * Math.PI;
  doc.setDrawColor(...NAVY).setLineWidth(0.8);
  doc.line(gx, gy, gx + Math.cos(na) * (gr - 3), gy + Math.sin(na) * (gr - 3));
  doc.setFillColor(...NAVY);
  doc.circle(gx, gy, 1.2, 'F');
  doc.setFontSize(18).setFont('helvetica', 'bold').setTextColor(...NAVY);
  doc.text('' + safety, gx, gy + 10, { align: 'center' });
  doc.setFontSize(7).setFont('helvetica', 'normal').setTextColor(...MUTED);
  doc.text('SAFETY SCORE  /  100', gx, gy + 15, { align: 'center' });
  doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(...RED);
  doc.text('HIGH RISK', gx - gr - 2, gy + 5, { align: 'right' });
  doc.setTextColor(...GREEN);
  doc.text('SAFE', gx + gr + 2, gy + 5);
  y = gy + 20;

  sectionHeader('Key Risk Indicators');
  const riskLevel = sentinel.payment_risk_level as string;
  autoTable(doc, {
    startY: y,
    head: [['Indicator', 'Value', 'Source', 'Comment']],
    body: [
      ['Payment Risk Level',     safe(riskLevel),                              'Sentinel',   riskLevel.toLowerCase() === 'low' ? 'Within acceptable range' : 'Requires monitoring'],
      ['Risk Score',             sentinel.payment_risk_score + ' / 100',       'Sentinel',   'Lower is safer'],
      ['Client Trust Grade',     sentinel.client_trust_grade,                  'Sentinel',   'A=Trusted, D=High risk'],
      ['Payment Probability',    sentinel.predicted_payment_probability + '%', 'Sentinel',   'Forecast: 12-month horizon'],
      ['Invoice Authenticity',   sentinel.invoice_authenticity_score + ' / 100','Sentinel',  'Document verification score'],
      ['Collection Window',      sentinel.predicted_collection_window_days + 'd','Sentinel', 'Expected days to receive cash'],
      ['Liquidity Score',        treasurer.liquidity_score + ' / 100',         'Treasurer',  'Collateral attractiveness'],
      ['Default Probability',    treasurer.estimated_default_probability + '%', 'Treasurer', '12-month estimate'],
    ],
    headStyles:  { fillColor: NAVY,  textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
    bodyStyles:  { fontSize: 8.5, textColor: BODY },
    alternateRowStyles: { fillColor: BAND },
    columnStyles: {
      0: { cellWidth: 48 },
      1: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 28, halign: 'center', textColor: SLATE },
      3: { fontStyle: 'italic' },
    },
    margin: { left: ML, right: MR },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  sectionHeader('Cross-Verification Matrix', 'Independent agent reconciliation');
  autoTable(doc, {
    startY: y,
    head: [['Metric', 'Score / Max', 'Assessment', 'Status']],
    body: master.safety_metrics.map(function(m) {
      return [
        m.metric,
        m.value + ' / ' + m.max_value,
        m.value >= 70 ? 'Within tolerance' : m.value >= 45 ? 'Monitor closely' : 'Remediation required',
        m.status.toUpperCase(),
      ];
    }),
    headStyles:  { fillColor: NAVY, textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
    bodyStyles:  { fontSize: 8.5, textColor: BODY },
    alternateRowStyles: { fillColor: BAND },
    columnStyles: {
      1: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
      2: { fontStyle: 'italic', textColor: MUTED },
      3: { halign: 'center', cellWidth: 26, fontStyle: 'bold' },
    },
    didParseCell: function(d) {
      if (d.section === 'body' && d.column.index === 3) {
        d.cell.styles.textColor = statusRgb(String(d.cell.raw || ''));
      }
    },
    margin: { left: ML, right: MR },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  /* PAGE 3 — TRI-AGENT FINDINGS */
  newPage('Tri-Agent Findings');
  sectionHeader('Section II — Tri-Agent Findings', 'Each agent operates independently; results cross-verified by Master');

  accent(y, 52);
  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...NAVY);
  doc.text('AGENT 01 - SENTINEL', ML + 5, y + 6);
  doc.setFontSize(7.5).setFont('helvetica', 'normal').setTextColor(...MUTED);
  doc.text('Risk & Authenticity Assessment', ML + 5, y + 11);
  const stc: [number,number,number] = verdictRgb(riskLevel.toLowerCase() === 'low' ? 'approve' : riskLevel.toLowerCase() === 'medium' ? 'warn' : 'decline');
  doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(...stc);
  doc.text('Model: DeepSeek R1   |   Risk: ' + riskLevel.toUpperCase() + '   |   Grade: ' + sentinel.client_trust_grade, W - MR - 4, y + 6, { align: 'right' });

  autoTable(doc, {
    startY: y + 14,
    body: [
      ['Risk Score', sentinel.payment_risk_score + ' / 100', 'Days Overdue', sentinel.days_overdue + ' days'],
      ['Trust Grade', sentinel.client_trust_grade,           'Pay Probability', sentinel.predicted_payment_probability + '%'],
      ['Authenticity', sentinel.invoice_authenticity_score + ' / 100', 'Collection Window', sentinel.predicted_collection_window_days + ' days'],
    ],
    bodyStyles:  { fontSize: 8.5, textColor: BODY },
    alternateRowStyles: { fillColor: BAND },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: MUTED, cellWidth: 38 },
      1: { fontStyle: 'bold', cellWidth: 38 },
      2: { fontStyle: 'bold', textColor: MUTED, cellWidth: 38 },
      3: { fontStyle: 'bold' },
    },
    margin: { left: ML + 5, right: MR },
    tableLineWidth: 0,
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;
  const sLines = doc.splitTextToSize(safe(sentinel.summary), TW - 10);
  doc.setFontSize(8.5).setFont('helvetica', 'italic').setTextColor(...BODY);
  doc.text(sLines.slice(0, 3), ML + 5, y);
  y += sLines.slice(0, 3).length * 4.5 + 10;

  ensure(60, 'Tri-Agent Findings');
  accent(y, 48);
  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...NAVY);
  doc.text('AGENT 02 - NEGOTIATOR', ML + 5, y + 6);
  doc.setFontSize(7.5).setFont('helvetica', 'normal').setTextColor(...MUTED);
  doc.text('Collection Strategy & Client Outreach', ML + 5, y + 11);
  doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(...AMBER);
  doc.text('Model: Gemini 3.1 Pro   |   Tier: ' + safe(negotiator.escalation_tier).toUpperCase() + '   |   Discount: ' + negotiator.suggested_discount_percentage + '%', W - MR - 4, y + 6, { align: 'right' });

  autoTable(doc, {
    startY: y + 14,
    body: [
      ['Escalation Tier', safe(negotiator.escalation_tier).toUpperCase(), 'Discount Offered', negotiator.suggested_discount_percentage + '%'],
      ['Discounted Amount', fmtMoney(negotiator.discounted_amount, invoice.currency), 'Expected Response', negotiator.expected_response_time_hours + 'h'],
    ],
    bodyStyles:  { fontSize: 8.5, textColor: BODY },
    alternateRowStyles: { fillColor: BAND },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: MUTED, cellWidth: 40 },
      1: { fontStyle: 'bold', cellWidth: 36 },
      2: { fontStyle: 'bold', textColor: MUTED, cellWidth: 40 },
      3: { fontStyle: 'bold' },
    },
    margin: { left: ML + 5, right: MR },
    tableLineWidth: 0,
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;

  const msgLines = doc.splitTextToSize(safe(negotiator.whatsapp_message_english), TW - 16);
  const msgH = msgLines.length * 4.5 + 8;
  ensure(msgH + 8, 'Tri-Agent Findings');
  doc.setFillColor(...BAND);
  doc.roundedRect(ML + 5, y, TW - 5, msgH, 1.5, 1.5, 'F');
  doc.setFontSize(6.5).setFont('helvetica', 'bold').setTextColor(...MUTED);
  doc.text('NEGOTIATOR OUTREACH MESSAGE (ENGLISH)', ML + 10, y + 4.5);
  doc.setFontSize(8.5).setFont('helvetica', 'normal').setTextColor(...BODY);
  doc.text(msgLines, ML + 10, y + 9);
  y += msgH + 10;

  ensure(60, 'Tri-Agent Findings');
  accent(y, 52);
  doc.setFontSize(10).setFont('helvetica', 'bold').setTextColor(...NAVY);
  doc.text('AGENT 03 - TREASURER', ML + 5, y + 6);
  doc.setFontSize(7.5).setFont('helvetica', 'normal').setTextColor(...MUTED);
  doc.text('Bridge Underwriting & Bank Submission', ML + 5, y + 11);
  doc.setFontSize(7).setFont('helvetica', 'bold').setTextColor(...GREEN);
  doc.text('Model: Claude Opus 4.6   |   Eligible: ' + (treasurer.liquidity_bridge_eligible ? 'YES' : 'NO') + '   |   Rec: ' + safe(treasurer.bank_recommendation).toUpperCase(), W - MR - 4, y + 6, { align: 'right' });

  autoTable(doc, {
    startY: y + 14,
    body: [
      ['Advance Amount',   '$' + treasurer.recommended_advance_amount.toLocaleString() + ' USD', 'Advance Rate (APR)', treasurer.advance_rate_percentage + '%'],
      ['Maturity',         treasurer.maturity_days + ' days',                                     'Total Repayment',    '$' + treasurer.total_repayment_amount.toLocaleString() + ' USD'],
      ['Bank Risk Grade',  treasurer.bank_risk_grade,                                             'Default Probability', treasurer.estimated_default_probability + '%'],
    ],
    bodyStyles:  { fontSize: 8.5, textColor: BODY },
    alternateRowStyles: { fillColor: BAND },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: MUTED, cellWidth: 40 },
      1: { fontStyle: 'bold', cellWidth: 36 },
      2: { fontStyle: 'bold', textColor: MUTED, cellWidth: 40 },
      3: { fontStyle: 'bold' },
    },
    margin: { left: ML + 5, right: MR },
    tableLineWidth: 0,
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;

  const pitchLines = doc.splitTextToSize(safe(treasurer.bank_pitch), TW - 16);
  const pitchH = pitchLines.length * 4.5 + 8;
  ensure(pitchH + 8, 'Tri-Agent Findings');
  doc.setFillColor(...BAND);
  doc.roundedRect(ML + 5, y, TW - 5, pitchH, 1.5, 1.5, 'F');
  doc.setFontSize(6.5).setFont('helvetica', 'bold').setTextColor(...MUTED);
  doc.text('BANK PITCH - TREASURER', ML + 10, y + 4.5);
  doc.setFontSize(8.5).setFont('helvetica', 'italic').setTextColor(...BODY);
  doc.text(pitchLines, ML + 10, y + 9);
  y += pitchH + 8;

  /* PAGE 4 — CASH FLOW & CONDITIONS */
  newPage('Cash Flow & Conditions');
  sectionHeader('Section III — 30-Day Cash Inflow Forecast', 'Master synthesis');

  const cells = master.cash_timeline.slice(0, 12);
  const maxV = Math.max(1, ...cells.map(function(p) { return p.expected_cash; }));
  const chartX = ML;
  const chartY = y;
  const chartW = TW;
  const chartH = 55;

  doc.setLineWidth(0.2);
  for (let i = 1; i <= 4; i++) {
    const yy = chartY + chartH - (i / 4) * chartH;
    doc.setDrawColor(...RULE);
    doc.line(chartX, yy, chartX + chartW, yy);
    doc.setFontSize(6.5).setFont('helvetica', 'normal').setTextColor(...MUTED);
    doc.text('$' + Math.round((maxV * i) / 4 / 1000) + 'k', chartX - 1, yy + 1.5, { align: 'right' });
  }
  doc.setDrawColor(...RULE);
  doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);

  const bw = chartW / Math.max(1, cells.length);
  cells.forEach(function(p, i) {
    const h = (p.expected_cash / maxV) * (chartH - 2);
    const bx = chartX + i * bw + 2;
    const barColor: [number,number,number] = p.expected_cash > maxV * 0.6 ? GREEN : p.expected_cash > maxV * 0.3 ? AMBER : RULE;
    doc.setFillColor(...barColor);
    doc.roundedRect(bx, chartY + chartH - Math.max(0.5, h), bw - 4, Math.max(0.5, h), 0.5, 0.5, 'F');
    doc.setFontSize(6.5).setFont('helvetica', 'normal').setTextColor(...MUTED);
    doc.text('+' + p.day, bx + (bw - 4) / 2, chartY + chartH + 4, { align: 'center' });
  });
  y = chartY + chartH + 10;

  sectionHeader('Executive Summary');
  body(master.executive_summary, 9.5);

  if (treasurer.conditions && treasurer.conditions.length) {
    y += 4;
    sectionHeader('Conditions & Covenants');
    treasurer.conditions.forEach(function(c, i) {
      ensure(8);
      doc.setFillColor(...AMBER);
      doc.circle(ML + 1.5, y - 0.5, 1.2, 'F');
      doc.setFontSize(9).setFont('helvetica', 'normal').setTextColor(...BODY);
      const lines = doc.splitTextToSize(safe((i + 1) + '. ' + c), TW - 8);
      doc.text(lines, ML + 6, y);
      y += lines.length * 4.4 + 2;
    });
  }

  y += 4;
  sectionHeader('Agent Consensus', 'Consensus level: ' + master.cross_verification.consensus_level + '%');
  autoTable(doc, {
    startY: y,
    head: [['Agent', 'Finding']],
    body: [
      ['Sentinel (Risk)',      safe(master.model_contributions.sentinel_says)],
      ['Negotiator (Collect)', safe(master.model_contributions.negotiator_says)],
      ['Treasurer (Finance)',  safe(master.model_contributions.treasurer_says)],
    ],
    headStyles:  { fillColor: NAVY2, textColor: WHITE, fontSize: 8, fontStyle: 'bold' },
    bodyStyles:  { fontSize: 8.5, textColor: BODY },
    alternateRowStyles: { fillColor: BAND },
    columnStyles: { 0: { fontStyle: 'bold', textColor: SLATE, cellWidth: 44 } },
    margin: { left: ML, right: MR },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  /* PAGE 5 — CERTIFICATION SEAL */
  newPage('Cryptographic Certification');
  sectionHeader('Section IV — Certification & Seal');

  body(
    'This Credit Assessment has been produced autonomously by the Madar Liquidity Bridge Underwriting ' +
    'Engine on ' + fmtDate(now) + ' for the invoice issued by ' + safe(invoice.freelancerName) +
    ' to ' + safe(invoice.clientName) + ' in the amount of ' +
    invoice.amount.toLocaleString() + ' ' + invoice.currency + '. ' +
    'The analysis reflects the independent findings of three specialist AI agents (Sentinel, Negotiator, Treasurer) ' +
    'cross-verified by the Master Synthesizer. All outputs are cryptographically sealed and cannot be altered ' +
    'after issuance. Reference code: ' + meta.refId + '.',
    9,
  );

  y += 4;

  const sx = W / 2;
  const sy = y + 32;

  doc.setDrawColor(...NAVY).setLineWidth(1.5);
  doc.circle(sx, sy, 24, 'S');
  doc.setLineWidth(0.4);
  doc.circle(sx, sy, 21.5, 'S');

  doc.setFontSize(8).setFont('helvetica', 'bold').setTextColor(...NAVY);
  doc.text('MADAR', sx, sy - 4, { align: 'center' });
  doc.setFontSize(6).setFont('helvetica', 'normal');
  doc.text('CERTIFIED BY', sx, sy, { align: 'center' });
  doc.text('AI UNDERWRITING', sx, sy + 4, { align: 'center' });
  doc.setFontSize(5.5);
  doc.text('SHA-256 SEALED', sx, sy + 8, { align: 'center' });

  for (let i = 0; i < 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    const r1 = i % 3 === 0 ? 20 : 19.5;
    doc.setLineWidth(i % 3 === 0 ? 0.5 : 0.2);
    doc.setDrawColor(...NAVY);
    doc.line(sx + Math.cos(angle) * r1, sy + Math.sin(angle) * r1, sx + Math.cos(angle) * 21.5, sy + Math.sin(angle) * 21.5);
  }

  y = sy + 36;

  thickRule(y); y += 6;
  doc.setFontSize(7.5).setFont('helvetica', 'bold').setTextColor(...MUTED);
  doc.text('SHA-256 BLOCKCHAIN HASH', ML, y); y += 5;
  doc.setFontSize(8).setFont('courier', 'normal').setTextColor(...BODY);
  const hashLines = doc.splitTextToSize(safe(treasurer.blockchain_hash), TW);
  doc.text(hashLines, ML, y);
  y += hashLines.length * 4.5 + 6;

  rule(y, 0.5, NAVY); y += 5;
  doc.setFontSize(8.5).setFont('helvetica', 'bold').setTextColor(...BODY);
  doc.text('Madar Underwriting Engine', ML, y);
  doc.text('Partner Bank - Liquidity Desk', ML + TW / 2 + 8, y);
  y += 5;
  doc.setFontSize(8).setFont('helvetica', 'normal').setTextColor(...MUTED);
  doc.text('Autonomous - Tri-Agent Consensus', ML, y);
  doc.text('Receiving institution', ML + TW / 2 + 8, y);
  y += 10;
  rule(y, 0.3); y += 6;

  body(
    'This report has been produced autonomously by the Madar AI engine. Figures represent model-based estimates ' +
    'and do not constitute legal financial advice. The cryptographic hash above may be independently verified. ' +
    'Resubmission of identical invoices is blocked by the deduplication layer.',
    7.5,
    MUTED,
  );

  pageFooter();
  return doc;
}

export function pdfToBase64(doc: jsPDF): string {
  const dataUri = doc.output('datauristring');
  return dataUri.split(',')[1] || '';
}
