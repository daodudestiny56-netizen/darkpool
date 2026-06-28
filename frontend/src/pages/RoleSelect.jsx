import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { useTradingStore } from '../store/tradingStore';
import { ArrowRight, LogOut, Radio, Shield } from 'lucide-react';

const ROLES = [
  {
    id: 'BUYER',
    route: '/trade',
    emoji: '↗',
    label: 'Buy Side',
    tagline: 'Acquire assets in the dark',
    description:
      'Post private purchase interests to the dark pool. Acquire tokenised assets, cryptocurrencies, or RWAs at automated dark-matched prices with zero market impact.',
    accent: '#1A7F4B',
    accentBg: 'rgba(26,127,75,0.06)',
    borderAccent: 'rgba(26,127,75,0.25)',
  },
  {
    id: 'SELLER',
    route: '/trade',
    emoji: '↙',
    label: 'Sell Side',
    tagline: 'Dispose without revealing',
    description:
      'Dispose of tokenised assets, bonds, or RWAs confidentially. Your ask is hidden from the public — no frontrunning, no information leakage. Matches swap atomically.',
    accent: '#C0392B',
    accentBg: 'rgba(192,57,43,0.06)',
    borderAccent: 'rgba(192,57,43,0.25)',
  },
];

const RoleSelect = () => {
  const navigate = useNavigate();
  const { address, disconnect } = useWalletStore();
  const { setRole } = useTradingStore();

  const handleSelectRole = (selectedRole, route) => {
    setRole(selectedRole);
    navigate(route);
  };

  const handleDisconnect = () => {
    disconnect();
    navigate('/');
  };

  const shortAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : '';

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* Navbar */}
      <header className="flex justify-between items-center px-8 md:px-14 py-4 border-b border-dp-border/60 bg-dp-cream/80 backdrop-blur-sm">
        <span
          className="font-display font-bold text-xl text-dp-text cursor-pointer"
          onClick={() => navigate('/')}
        >
          Dark<span className="text-gold">Pool</span>.fi
        </span>

        <div className="flex items-center gap-4">
          <span className="font-data text-xs text-dp-muted bg-dp-parchment border border-dp-border px-3 py-1.5 rounded-full">
            {shortAddress}
          </span>
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 font-sans text-xs text-dp-muted hover:text-dp-crimson transition-colors"
          >
            <LogOut size={14} />
            Disconnect
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="text-center mb-12">
          <span className="label text-dp-gold block mb-3">Select your trading role</span>
          <h1 className="font-display font-bold text-4xl md:text-5xl text-dp-text leading-tight mb-3">
            Declare Your Ledger Role
          </h1>
          <p className="font-serif text-dp-muted text-base max-w-md mx-auto leading-relaxed">
            Your role determines which side of the dark pool you operate on. You can always reconnect and switch.
          </p>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mb-12">
          {ROLES.map((r) => (
            <div
              key={r.id}
              id={`role-${r.id.toLowerCase()}`}
              onClick={() => handleSelectRole(r.id, r.route)}
              className="group relative cursor-pointer rounded-2xl border-2 p-8 flex flex-col justify-between min-h-[260px] transition-all duration-200"
              style={{
                background: r.accentBg,
                borderColor: r.borderAccent,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = r.accent;
                e.currentTarget.style.boxShadow = `0 12px 40px ${r.accentBg.replace('0.06', '0.18')}`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = r.borderAccent;
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Top row */}
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold"
                    style={{ background: r.accentBg, color: r.accent, border: `1px solid ${r.borderAccent}` }}
                  >
                    {r.emoji}
                  </div>
                  <ArrowRight
                    size={20}
                    style={{ color: r.accent }}
                    className="mt-1 group-hover:translate-x-1.5 transition-transform"
                  />
                </div>
                <h2
                  className="font-display font-bold text-2xl mb-1"
                  style={{ color: r.accent }}
                >
                  {r.label}
                </h2>
                <p className="font-serif italic text-sm text-dp-muted mb-4">{r.tagline}</p>
                <p className="font-sans text-sm text-dp-muted leading-relaxed">{r.description}</p>
              </div>

              {/* Bottom */}
              <div className="mt-6 pt-4 border-t border-dp-border/40">
                <span className="label" style={{ color: r.accent }}>Select this profile →</span>
              </div>
            </div>
          ))}
        </div>

        {/* Alternative roles */}
        <div className="flex flex-col sm:flex-row gap-5 items-center">
          <button
            id="role-mm-btn"
            onClick={() => handleSelectRole('MM', '/market-maker')}
            className="flex items-center gap-2 font-sans text-sm text-dp-muted hover:text-dp-indigo transition-colors border border-dp-border rounded-full px-5 py-2.5 hover:border-dp-indigo/40 hover:bg-dp-indigo/5"
          >
            <Radio size={14} className="text-dp-gold" />
            Market Maker Desk
          </button>
          <button
            id="role-auditor-btn"
            onClick={() => handleSelectRole('AUDITOR', '/auditor')}
            className="flex items-center gap-2 font-sans text-sm text-dp-muted hover:text-dp-indigo transition-colors border border-dp-border rounded-full px-5 py-2.5 hover:border-dp-indigo/40 hover:bg-dp-indigo/5"
          >
            <Shield size={14} className="text-dp-indigo" />
            Auditor Compliance View
          </button>
        </div>
      </main>

      <footer className="text-center py-4 text-xs font-sans text-dp-dim border-t border-dp-border/40">
        Canton Sub-Ledger Role System — Credentials secured by your local sandbox node.
      </footer>
    </div>
  );
};

export default RoleSelect;
