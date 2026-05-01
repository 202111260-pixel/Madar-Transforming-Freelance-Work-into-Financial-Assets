import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: 'What is Madar?',
    answer:
      'Madar is an AI-powered freelancer liquidity platform. It uses 3 specialized AI agents — Sentinel (Risk Scanner), Negotiator (Smart Collection), and Treasurer (Liquidity & Bank) — to analyze unpaid invoices, draft collection messages, and prepare bank-ready liquidity bridge offers, turning your invoices from waiting into immediate cash.',
  },
  {
    question: 'How does the multi-agent AI analysis work?',
    answer:
      'When you submit an invoice, three AI agents analyze it in parallel: DeepSeek R1 (Sentinel) scores payment risk and client trust, Gemini Pro (Negotiator) drafts WhatsApp/email reminders with discount strategies, and Claude Opus (Treasurer) evaluates bridge eligibility and generates a bank-grade risk report. A master synthesizer then unifies all findings into a final decision with a confidence score.',
  },
  {
    question: 'What data sources does Madar support?',
    answer:
      'Madar accepts invoices from multiple sources: manual entry, email parsing, photo/OCR scanning, WhatsApp forwarding, and voice notes. It supports 9 currencies (SAR, USD, OMR, AED, EGP, BHD, KWD, QAR, EUR) and works with freelance platforms like Upwork, Mostaqel, and Khamsat.',
  },
  {
    question: 'Can I get a professional PDF report?',
    answer:
      'Yes. After each analysis, you can export a comprehensive Risk Report PDF that includes borrower profile, invoice details, risk scoring, collection strategy, liquidity bridge terms, blockchain hash verification, and the Treasurer\'s bank recommendation — all formatted for institutional-grade review by partner banks.',
  },
  {
    question: 'How does the Liquidity Bridge work?',
    answer:
      'When the Treasurer determines your invoice is eligible, it calculates an advance amount (typically 85% of invoice value), sets a competitive APR, and prepares a collateralized offer. The invoice is registered on a simulated blockchain ledger to prevent double-pledging. When your client pays, the bridge closes automatically with pro-rated costs.',
  },
];

function FAQIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <motion.svg
      width="18" height="18" viewBox="0 0 18 18" fill="none"
      animate={{ rotate: isOpen ? 45 : 0 }}
      transition={{ duration: 0.25 }}
      style={{ flexShrink: 0 }}
    >
      <line x1="9" y1="2" x2="9" y2="16" stroke="#3b5bdb" strokeWidth="2" strokeLinecap="round" />
      <line x1="2" y1="9" x2="16" y2="9" stroke="#3b5bdb" strokeWidth="2" strokeLinecap="round" />
    </motion.svg>
  );
}

function FAQItemRow({
  item,
  isOpen,
  onClick,
  dark = false,
}: {
  item: FAQItem;
  isOpen: boolean;
  onClick: () => void;
  dark?: boolean;
}) {
  return (
    <div style={{ borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'}` }}>
      <button
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', padding: '22px 0', background: 'none', border: 'none', cursor: 'pointer', gap: 16 }}
        onClick={onClick}
        aria-expanded={isOpen}
      >
        <span style={{ fontSize: 16, fontWeight: 500, color: dark ? 'rgba(255,255,255,0.85)' : '#1a1a1a', lineHeight: 1.4 }}>
          {item.question}
        </span>
        <FAQIcon isOpen={isOpen} />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <p style={{ paddingBottom: 22, fontSize: 14.5, lineHeight: 1.8, color: dark ? 'rgba(255,255,255,0.5)' : '#555', maxWidth: 560 }}>
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQSection({ dark = false }: { dark?: boolean }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div>
      {faqData.map((item, index) => (
        <FAQItemRow
          key={index}
          item={item}
          isOpen={openIndex === index}
          onClick={() => setOpenIndex(openIndex === index ? null : index)}
          dark={dark}
        />
      ))}
    </div>
  );
}
