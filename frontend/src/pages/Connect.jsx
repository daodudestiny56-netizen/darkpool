import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletStore } from '../store/walletStore';
import { AlertTriangle, Loader2, Wallet, ArrowRight } from 'lucide-react';

const Connect = () => {
  const navigate = useNavigate();
  const { connect, address, isConnecting, error } = useWalletStore();
  const [manualAddress, setManualAddress] = useState('');

  useEffect(() => {
    if (address) navigate('/role');
  }, [address]);

  const handleMetaMaskConnect = async () => {
    await connect('metamask');
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualAddress.trim()) return;
    await connect('manual', manualAddress.trim());
  };

  return (
    <div className="flex-1 flex min-h-screen">
      {/* Left decorative panel */}
      <aside className="hidden lg:flex flex-col justify-between w-[45%] bg-dp-indigo px-16 py-14 relative overflow-hidden">
        {/* Ambient orbs inside dark panel */}
        <div
          className="absolute top-0 right-0 w-80 h-80 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(200,155,60,0.18) 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 w-64 h-64 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(124,77,255,0.25) 0%, transparent 70%)',
            transform: 'translate(-30%, 30%)',
          }}
        />

        <div className="relative z-10">
          <span
            className="font-display font-bold text-3xl text-white cursor-pointer"
            onClick={() => navigate('/')}
          >
            Dark<span className="text-dp-gold-light">Pool</span>.fi
          </span>
          <p className="text-white/50 text-sm font-sans mt-1">Institutional OTC Platform</p>
        </div>

        <div className="relative z-10">
          <h2 className="font-display font-bold italic text-4xl text-white leading-tight mb-6">
            Where privacy meets precision.
          </h2>
          <div className="flex flex-col gap-5">
            {[
              ['Sub-Ledger Privacy', 'Your intents are cryptographically invisible to anyone outside your match.'],
              ['Atomic Settlement', 'Assets and cash swap in a single ledger transaction. Zero risk.'],
              ['Canton Network', 'Enterprise-grade permissioned blockchain infrastructure.'],
            ].map(([title, body]) => (
              <div key={title} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-dp-gold-light mt-2 shrink-0" />
                <div>
                  <span className="text-white font-sans font-semibold text-sm block">{title}</span>
                  <span className="text-white/50 font-sans text-sm">{body}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-white/30 text-xs font-sans">
          <span className="live-dot" style={{ background: 'rgba(255,255,255,0.4)' }} />
          <span>Canton Ledger Online</span>
        </div>
      </aside>

      {/* Right: Connect form */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden mb-8 text-center">
            <span
              className="font-display font-bold text-2xl text-dp-text cursor-pointer"
              onClick={() => navigate('/')}
            >
              Dark<span className="text-gold">Pool</span>.fi
            </span>
          </div>

          <div className="mb-8">
            <h1 className="font-display font-bold text-3xl text-dp-text mb-2">Welcome back</h1>
            <p className="font-sans text-dp-muted text-sm">
              Connect your wallet or enter a persona name to access the trading desk.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <AlertTriangle size={16} className="text-dp-crimson shrink-0 mt-0.5" />
              <span className="font-sans text-dp-crimson text-sm">{error}</span>
            </div>
          )}

          <div className="flex flex-col gap-4 mb-6">
            {/* MetaMask */}
            <button
              id="metamask-btn"
              onClick={handleMetaMaskConnect}
              disabled={isConnecting}
              className="group flex items-center gap-4 p-4 bg-dp-parchment border border-dp-border rounded-2xl hover:border-dp-gold/70 hover:bg-dp-linen transition-all shadow-card"
            >
              <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 text-2xl">
                🦊
              </div>
              <div className="text-left flex-1">
                <span className="font-sans font-semibold text-dp-text text-sm block">MetaMask</span>
                <span className="font-sans text-dp-dim text-xs">Browser extension wallet</span>
              </div>
              {isConnecting ? (
                <Loader2 size={18} className="text-dp-gold animate-spin" />
              ) : (
                <ArrowRight size={16} className="text-dp-dim group-hover:text-dp-gold transition-colors" />
              )}
            </button>

            {/* WalletConnect (disabled) */}
            <button
              disabled
              className="flex items-center gap-4 p-4 bg-dp-parchment border border-dp-border rounded-2xl opacity-40 cursor-not-allowed"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 text-2xl">
                ⬡
              </div>
              <div className="text-left flex-1">
                <span className="font-sans font-semibold text-dp-text text-sm block">WalletConnect</span>
                <span className="font-sans text-dp-dim text-xs">Coming soon</span>
              </div>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-px flex-1 bg-dp-border" />
            <span className="font-sans text-xs font-medium text-dp-dim uppercase tracking-wide">or enter credentials</span>
            <div className="h-px flex-1 bg-dp-border" />
          </div>

          {/* Manual form */}
          <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="label text-dp-muted">Persona Name or Address</label>
              <input
                id="persona-input"
                type="text"
                placeholder="e.g. Alice, Bob, MarketMaker…"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                disabled={isConnecting}
                className="dp-input"
                required
              />
            </div>

            <button
              id="manual-connect-btn"
              type="submit"
              disabled={isConnecting || !manualAddress.trim()}
              className="btn-gold w-full text-sm py-3.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isConnecting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Authenticating…
                </>
              ) : (
                <>
                  Access Trading Desk
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="font-sans text-dp-dim text-xs text-center mt-6 leading-relaxed max-w-sm mx-auto">
            By connecting, you authorise this platform to derive Canton network keys and sign OTC Dark Pool operations on your behalf.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Connect;
