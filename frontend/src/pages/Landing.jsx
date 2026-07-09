import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Shield, Zap, ArrowRight } from 'lucide-react';

const PILLARS = [
  {
    icon: Shield,
    title: 'Private by Ledger',
    body: 'Canton network-level privacy guarantees sub-ledger confidentiality. Only matched counterparties and designated stakeholders ever inspect your transactions.',
  },
  {
    icon: Zap,
    title: 'Atomic Settlement',
    body: 'Co-signed DvP swaps deliver tokenized assets and cash simultaneously. Zero counterparty or settlement risk — ever.',
  },
  {
    icon: Sparkles,
    title: 'Compliant by Design',
    body: 'Automated audit-trail generation delivers decrypted records to Carol the Regulator. Frictionless oversight built into the ledger.',
  },
];

const Landing = () => {
  const navigate = useNavigate();
  const heroRef = useRef(null);

  // Parallax on hero text
  useEffect(() => {
    const onScroll = () => {
      if (heroRef.current) {
        heroRef.current.style.transform = `translateY(${window.scrollY * 0.18}px)`;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      {/* ── Navbar ── */}
      <header className="flex justify-between items-center px-8 md:px-14 py-5 border-b border-dp-border/60 bg-dp-cream/80 backdrop-blur-sm sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <span
            className="font-display font-bold text-2xl text-dp-text tracking-tight cursor-pointer"
            style={{ letterSpacing: '-0.02em' }}
          >
            Dark<span className="text-gold">Pool</span>.fi
          </span>
          <span className="hidden sm:inline-block bg-dp-indigo/10 text-dp-indigo text-xs font-sans font-semibold px-2.5 py-0.5 rounded-full border border-dp-indigo/20">
            Canton Network
          </span>
        </div>

        <nav className="flex items-center gap-6">
          <a
            href="https://github.com/daodudestiny56-netizen/darkpool"
            target="_blank"
            rel="noreferrer"
            className="text-dp-muted hover:text-dp-text font-sans text-sm font-medium transition-colors"
          >
            Docs
          </a>
          <button
            onClick={() => navigate('/connect')}
            className="btn-gold text-sm px-5 py-2.5"
          >
            Enter Platform
          </button>
        </nav>
      </header>

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 md:py-36 relative overflow-hidden">
        {/* decorative line */}
        <div
          className="w-px h-16 bg-gradient-to-b from-transparent via-dp-gold to-transparent mx-auto mb-8 opacity-60"
        />

        <div ref={heroRef}>
          <span className="label text-dp-gold mb-3 block">Institutional OTC · Canton Network</span>
          <h1 className="font-display font-bold text-5xl md:text-7xl text-dp-text leading-[1.08] tracking-tight mb-4 max-w-3xl mx-auto">
            Trade in the dark.
          </h1>
          <h2 className="font-display font-semibold italic text-4xl md:text-6xl text-dp-gold leading-[1.1] mb-8 max-w-3xl mx-auto">
            Settle in certainty.
          </h2>
          <p className="font-serif text-dp-muted text-lg md:text-xl max-w-xl mx-auto mb-12 leading-relaxed">
            Your intent is invisible until the moment it matches — protected by ledger-level Canton privacy. Zero market impact. Zero counterparty risk.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              id="hero-connect-btn"
              onClick={() => navigate('/connect')}
              className="btn-gold text-base px-8 py-3.5 flex items-center gap-2"
            >
              Connect Wallet
              <ArrowRight size={16} />
            </button>
            <a
              href="https://github.com/daodudestiny56-netizen/darkpool"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost text-base px-8 py-3.5"
            >
              Read the Docs
            </a>
          </div>
        </div>

        {/* Decorative ornament */}
        <div className="mt-20 flex items-center gap-4 opacity-40">
          <div className="h-px w-24 bg-dp-border" />
          <span className="text-dp-dim font-display text-lg">✦</span>
          <div className="h-px w-24 bg-dp-border" />
        </div>
      </main>

      {/* ── Pillars ── */}
      <section className="px-6 md:px-14 pb-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="card group hover:border-dp-gold/50 text-left">
              <div className="w-10 h-10 rounded-xl bg-dp-gold/10 flex items-center justify-center mb-4 group-hover:bg-dp-gold/20 transition-colors">
                <Icon size={20} className="text-gold" />
              </div>
              <h3 className="font-display font-semibold text-dp-text text-lg mb-2">{title}</h3>
              <p className="font-sans text-dp-muted text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Status footer ── */}
      <footer className="border-t border-dp-border/60 px-8 md:px-14 py-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-sans text-dp-dim bg-dp-parchment/60">
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span>All Systems Active</span>
        </div>
        <div className="flex items-center gap-5">
          <span>5 Assets Online</span>
          <span>Co-Signed Settlement Enabled</span>
        </div>
        <span className="hidden md:block">© 2025 DarkPool.fi</span>
      </footer>
    </div>
  );
};

export default Landing;
