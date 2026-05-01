/**
 * homeCurrency.ts — single source of truth for the user's HOME currency.
 *
 * Reads `synergy_user_profile_v1` from localStorage. Falls back to country
 * keywords (oman → OMR, saudi → SAR, …). Defaults to OMR for the seeded
 * Omani persona. ALL currency-bearing UI + agent-prompt assembly should
 * import from here so the dashboard never mixes SAR with OMR again.
 *
 * Reactivity: pages should call `useHomeCurrency()` so they re-render the
 * moment the user flips the sidebar switch — no manual subscriptions.
 */
import { useEffect, useState } from 'react';

export const SUPPORTED_CURRENCIES = [
  'SAR', 'USD', 'OMR', 'AED', 'EGP', 'BHD', 'KWD', 'QAR', 'EUR',
] as const;
export type Currency = typeof SUPPORTED_CURRENCIES[number];

/** Conversion table — every entry is "1 unit of X = N SAR". */
const TO_SAR: Record<Currency, number> = {
  SAR: 1,    USD: 3.75, OMR: 9.75, AED: 1.02, EGP: 0.075,
  BHD: 9.95, KWD: 12.2, QAR: 1.03, EUR: 4.1,
};

export const CURR_SYMBOL: Record<Currency, string> = {
  SAR: 'ر.س', USD: '$',  OMR: 'ع.ر', AED: 'د.إ', EGP: 'ج.م',
  BHD: 'ب.د', KWD: 'د.ك', QAR: 'ر.ق', EUR: '€',
};

export function detectHomeCurrency(): Currency {
  if (typeof localStorage === 'undefined') return 'OMR';
  try {
    const p = JSON.parse(localStorage.getItem('synergy_user_profile_v1') || '{}');
    if (p.homeCurrency && (SUPPORTED_CURRENCIES as readonly string[]).includes(p.homeCurrency)) {
      return p.homeCurrency as Currency;
    }
    const country = String(p.country || p.location || '').toLowerCase();
    if (country.includes('oman')   || country.includes('muscat'))                  return 'OMR';
    if (country.includes('saudi')  || country.includes('riyadh') || country.includes('ksa')) return 'SAR';
    if (country.includes('uae')    || country.includes('emirate') || country.includes('dubai')) return 'AED';
    if (country.includes('bahrain')|| country.includes('manama'))                  return 'BHD';
    if (country.includes('kuwait'))                                                return 'KWD';
    if (country.includes('qatar')  || country.includes('doha'))                    return 'QAR';
    if (country.includes('egypt')  || country.includes('cairo'))                   return 'EGP';
  } catch { /**/ }
  return 'OMR';
}

export function setHomeCurrency(currency: Currency): void {
  try {
    const raw = localStorage.getItem('synergy_user_profile_v1');
    const profile = raw ? JSON.parse(raw) : {};
    profile.homeCurrency = currency;
    localStorage.setItem('synergy_user_profile_v1', JSON.stringify(profile));
    window.dispatchEvent(new Event('synergy:store-changed'));
  } catch { /**/ }
}

/**
 * Convert any amount in any supported currency into the user's HOME currency,
 * rounded to a whole unit. Used everywhere the dashboard shows totals.
 */
export function toHomeCurrency(
  amount: number,
  fromCurrency: string,
  homeCurrency: Currency = detectHomeCurrency(),
): number {
  const fc = (TO_SAR as Record<string, number>)[fromCurrency] ?? 1;
  const hc = TO_SAR[homeCurrency];
  return Math.round((amount * fc) / hc);
}

/** Symbol for the user's current HOME currency. */
export function homeCurrencySymbol(homeCurrency: Currency = detectHomeCurrency()): string {
  return CURR_SYMBOL[homeCurrency];
}

/** Bilingual full names — used inside agent prompts so the LLM never mixes currencies. */
export const CURRENCY_NAME_AR: Record<Currency, string> = {
  SAR: 'الريال السعودي', USD: 'الدولار الأمريكي', OMR: 'الريال العُماني',
  AED: 'الدرهم الإماراتي', EGP: 'الجنيه المصري', BHD: 'الدينار البحريني',
  KWD: 'الدينار الكويتي', QAR: 'الريال القطري', EUR: 'اليورو',
};
export const CURRENCY_NAME_EN: Record<Currency, string> = {
  SAR: 'Saudi Riyal', USD: 'US Dollar', OMR: 'Omani Rial',
  AED: 'UAE Dirham', EGP: 'Egyptian Pound', BHD: 'Bahraini Dinar',
  KWD: 'Kuwaiti Dinar', QAR: 'Qatari Riyal', EUR: 'Euro',
};

/** Format a number in the home currency with its symbol, locale-aware. */
export function formatHome(
  amount: number,
  fromCurrency: string,
  homeCurrency: Currency = detectHomeCurrency(),
): string {
  const v = toHomeCurrency(amount, fromCurrency, homeCurrency);
  return `${v.toLocaleString()} ${CURR_SYMBOL[homeCurrency]}`;
}

/**
 * React hook — returns the live home currency and re-renders any component
 * that uses it the moment another part of the app calls `setHomeCurrency()`.
 *
 *   const home = useHomeCurrency();
 *   formatHome(invoice.amount, invoice.currency, home);
 *
 * Listens to both the cross-tab `storage` event and our same-tab
 * `synergy:store-changed` custom event so the switcher in the sidebar
 * propagates instantly without a page reload.
 */
export function useHomeCurrency(): Currency {
  const [c, setC] = useState<Currency>(() => detectHomeCurrency());
  useEffect(() => {
    const refresh = () => setC(detectHomeCurrency());
    window.addEventListener('synergy:store-changed', refresh as EventListener);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('synergy:store-changed', refresh as EventListener);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  return c;
}

/** ASCII / English currency labels — safer than the Arabic glyphs in mixed UI. */
export const CURR_LABEL_EN: Record<Currency, string> = {
  SAR: 'SAR', USD: 'USD', OMR: 'OMR', AED: 'AED', EGP: 'EGP',
  BHD: 'BHD', KWD: 'KWD', QAR: 'QAR', EUR: 'EUR',
};
