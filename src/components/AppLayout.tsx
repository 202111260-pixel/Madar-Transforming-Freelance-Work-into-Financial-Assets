import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import {
  PenLine, Link2, CreditCard, Activity,
  Brain, Home, RefreshCw, Users,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import HydrationOverlay from './HydrationOverlay';
import { startSupabaseSync, hydrateFromSupabase, SYNCED_KEYS } from '../lib/supabaseSync';
import { detectHomeCurrency, setHomeCurrency, CURR_SYMBOL, type Currency } from '../lib/homeCurrency';

const POPULAR_CURRENCIES: Currency[] = ['OMR', 'SAR', 'USD', 'AED'];

function CurrencySwitcher() {
  const [current, setCurrent] = useState<Currency>(detectHomeCurrency());

  useEffect(() => {
    const refresh = () => setCurrent(detectHomeCurrency());
    window.addEventListener('synergy:store-changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('synergy:store-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const handleSelect = (c: Currency) => {
    setHomeCurrency(c);
    setCurrent(c);
  };

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Currency</p>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {POPULAR_CURRENCIES.map(c => (
          <button
            key={c}
            onClick={() => handleSelect(c)}
            style={{
              padding: '4px 10px',
              borderRadius: 8,
              border: current === c ? '1.5px solid #3b82f6' : '1.5px solid var(--border)',
              background: current === c ? '#eff6ff' : 'transparent',
              color: current === c ? '#1d4ed8' : 'var(--text2)',
              fontSize: 11,
              fontWeight: current === c ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Sidebar order = Madar user flow:
 *   1) Connections — entry portal (link your platforms here first)
 *   2) Agent Room  — multi-agent AI reasoning
 *   3) Credit Panel — bank-side underwriting view
 *   4) Liquidity Tools / Clients / Activity — supporting workspaces
 */
const NAV = [
  { icon: Link2,      label: 'Connections',      path: '/connections' },
  { icon: Brain,      label: 'Agent Room',       path: '/room' },
  { icon: CreditCard, label: 'Credit Panel',     path: '/credit' },
  { icon: PenLine,    label: 'Liquidity Tools',  path: '/manual' },
  { icon: Users,      label: 'Clients',          path: '/manual?tab=clients' },
  { icon: Activity,   label: 'Activity Log',     path: '/activity' },
];

/**
 * Lightweight cross-page reactivity helper.
 * Pages can call `notifyStoreChanged()` after mutating localStorage so other
 * mounted components re-read it without a full reload. We also listen to the
 * native 'storage' event (cross-tab) and a custom 'synergy:store-changed'
 * event (same-tab, since 'storage' doesn't fire in the originating tab).
 */
export function notifyStoreChanged() {
  try { window.dispatchEvent(new Event('synergy:store-changed')); } catch { /**/ }
}

export default function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [reloading, setReloading] = useState(false);

  // Cross-page reactivity tick — re-render layout (and any context consumers)
  // when localStorage mutates either in another tab ('storage') or via our
  // same-tab custom event ('synergy:store-changed').
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    window.addEventListener('storage', bump);
    window.addEventListener('synergy:store-changed', bump as EventListener);
    return () => {
      window.removeEventListener('storage', bump);
      window.removeEventListener('synergy:store-changed', bump as EventListener);
    };
  }, []);

  // Boot the Supabase sync engine exactly once: pull the latest server state
  // into localStorage, install the setItem patch, and start the realtime
  // subscription so cross-tab/cross-device edits stream in.
  //
  // Architecture: Supabase IS the source of truth. The app starts empty,
  // hydrates from kv_store, then mirrors any local edits back. There is no
  // hard-coded demo data anywhere in the client — seed scripts live in
  // /scripts and write directly to the database.
  useEffect(() => {
    void startSupabaseSync().then(() => {
      try { window.dispatchEvent(new Event('synergy:hydrated')); } catch { /**/ }
    });
  }, []);

  // "Reload from Database" — pulls the freshest rows from Supabase and
  // overwrites local cache. No local data is generated here; if the DB is
  // empty, the app stays empty.
  const handleReload = useCallback(() => {
    if (reloading) return;
    setReloading(true);
    (async () => {
      try {
        // 1) Wipe every synced key locally so a stale browser cache can't
        //    leak old demo data back into the page after the pull.
        for (const k of SYNCED_KEYS) {
          try { localStorage.removeItem(k); } catch { /**/ }
        }
        notifyStoreChanged();
        // 2) Pull fresh rows from Supabase → localStorage.
        await hydrateFromSupabase();
        notifyStoreChanged();
        try { window.dispatchEvent(new Event('synergy:hydrated')); } catch { /**/ }
        navigate('/connections');
      } catch (err) {
        console.error('[reload from DB] failed', err);
      } finally {
        setReloading(false);
      }
    })();
  }, [navigate, reloading]);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--cream)', fontFamily: "'IBM Plex Sans Arabic', 'Inter', sans-serif" }}
    >
      <HydrationOverlay />
      {/* ── Shared Sidebar ── */}
      <aside
        className="hidden lg:flex flex-col w-[220px] border-r shrink-0"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      >
        {/* Brand */}
        <div className="px-4 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex flex-col items-center gap-2">
            <img
              src="/src/pages/madar.jpeg"
              alt="Madar logo"
              style={{ width: 96, height: 96, borderRadius: 16, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <div style={{ textAlign: 'center' }}>
              <p className="text-sm font-black" style={{ color: 'var(--text)' }}>Madar</p>
              <p className="text-[10px] font-mono" style={{ color: 'var(--text3)' }}>Freelancer Liquidity</p>
            </div>
          </div>
        </div>

        <CurrencySwitcher />

        {/* Nav */}
        <nav className="p-3 space-y-0.5 flex-1">
          {NAV.map(item => {
            const [itemPath, itemQuery] = item.path.split('?');
            const currentSearch = typeof window !== 'undefined' ? window.location.search.slice(1) : '';
            const active = itemQuery
              ? (pathname === itemPath && currentSearch === itemQuery)
              : (pathname === itemPath && !currentSearch.includes('tab=clients'));
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-semibold transition-all cursor-pointer ' +
                  (active ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50')
                }
                style={!active ? { color: 'var(--text2)' } : {}}
              >
                <item.icon size={15} />
                <span className="flex-1 text-left">{item.label}</span>
                {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
              </button>
            );
          })}

          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[12px] font-semibold transition-all cursor-pointer hover:bg-gray-50"
            style={{ color: 'var(--text2)' }}
          >
            <Home size={15} />
            <span className="flex-1 text-left">Home</span>
          </button>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <ThemeToggle />
          <div className="flex items-center gap-2 mt-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[11px] font-bold" style={{ color: 'var(--text)' }}>Hackathon Build</span>
          </div>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text3)' }}>ZenMux · Twilio · SendGrid</p>

          {/* Reload from DB — re-pulls all rows from Supabase (no local seed) */}
          <button
            onClick={handleReload}
            disabled={reloading}
            title="Re-pull every synergy_* row from Supabase"
            className="mt-3 w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-semibold opacity-60 hover:opacity-100 transition-opacity cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: 'var(--text3)', border: '1px dashed var(--border)' }}
          >
            <RefreshCw size={12} className={reloading ? 'animate-spin' : ''} />
            <span>{reloading ? 'Reloading…' : 'Reload from DB'}</span>
          </button>
        </div>
      </aside>

      {/* ── Page content ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0">
        <Outlet />
      </div>
    </div>
  );
}
