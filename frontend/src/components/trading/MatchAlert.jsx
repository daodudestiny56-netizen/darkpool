import React, { useEffect } from 'react';
import { Sparkles } from 'lucide-react';

const MatchAlert = ({ onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center select-none"
      style={{ background: 'rgba(250,248,243,0.88)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      {/* Ripple bursts */}
      <div className="ripple-burst" />
      <div className="ripple-burst ripple-burst-2" />
      <div className="ripple-burst ripple-burst-3" />

      <div className="relative z-10 flex flex-col items-center gap-4 text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center animate-pulse"
          style={{ background: 'linear-gradient(135deg, #E8C97A, #C89B3C)', boxShadow: '0 0 40px rgba(200,155,60,0.4)' }}
        >
          <Sparkles size={28} className="text-white" />
        </div>
        <h2
          className="font-display font-bold text-4xl text-dp-text"
          style={{ letterSpacing: '-0.02em' }}
        >
          Match Discovered
        </h2>
        <p className="font-serif text-dp-muted text-base max-w-xs leading-relaxed">
          The Canton matching engine has found overlapping trade intents on the ledger.
        </p>
        <span className="label text-dp-gold animate-pulse">Bypassing orderbook disclosure…</span>
      </div>
    </div>
  );
};

export default MatchAlert;
