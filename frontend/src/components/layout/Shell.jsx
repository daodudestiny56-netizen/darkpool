import React from 'react';

const Shell = ({ children }) => {
  return (
    <div className="relative min-h-screen bg-dp-cream overflow-hidden">
      {/* Ambient orbs */}
      <div className="orb orb-gold" style={{ width: 500, height: 500, top: '-180px', right: '-140px' }} />
      <div className="orb orb-indigo" style={{ width: 420, height: 420, bottom: '-120px', left: '-120px' }} />
      <div className="orb orb-gold" style={{ width: 280, height: 280, bottom: '30%', right: '15%', opacity: 0.25 }} />

      {/* Subtle pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C89B3C' fill-opacity='0.04'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
};

export default Shell;
