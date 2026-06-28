import React, { useState, useEffect } from 'react';

const ExpiryRing = ({ expiryTime, windowDuration = 60 }) => {
  const [timeLeft, setTimeLeft] = useState(0); // in seconds

  useEffect(() => {
    const calculateTimeLeft = () => {
      const diff = new Date(expiryTime) - new Date();
      return Math.max(0, Math.floor(diff / 1000));
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const val = calculateTimeLeft();
      setTimeLeft(val);
      if (val <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiryTime]);

  const progress = Math.min(1, Math.max(0, timeLeft / windowDuration));
  const circumference = 2 * Math.PI * 18;
  const strokeDashoffset = circumference * (1 - progress);

  // Color shifting: cyan -> gold -> red
  const color = progress > 0.5 
    ? 'var(--dp-pulse)' 
    : progress > 0.1 
      ? 'var(--dp-gold)' 
      : 'var(--dp-sell)';

  const formatTime = (secs) => {
    if (secs <= 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col items-center justify-center select-none font-mono">
      <svg width="48" height="48" viewBox="0 0 44 44">
        {/* Background circle */}
        <circle cx="22" cy="22" r="18" fill="none" stroke="var(--dp-border)" strokeWidth="2.5" />
        {/* Depleting progress ring */}
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 22 22)"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 500ms' }}
        />
        {/* Centered text */}
        <text
          x="22"
          y="26"
          textAnchor="middle"
          fontSize="9"
          fontWeight="bold"
          fontFamily="JetBrains Mono"
          fill="var(--dp-text)"
        >
          {formatTime(timeLeft)}
        </text>
      </svg>
    </div>
  );
};

export default ExpiryRing;
