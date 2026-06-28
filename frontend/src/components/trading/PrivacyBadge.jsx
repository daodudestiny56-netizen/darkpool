import React from 'react';

const PrivacyBadge = () => (
  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-dp-indigo/8 border border-dp-indigo/20 font-sans text-xs text-dp-indigo select-none">
    <span>🔒</span>
    <span className="font-semibold text-xs">Private</span>
  </div>
);

export default PrivacyBadge;
