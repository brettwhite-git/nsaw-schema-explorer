import React from 'react';

export const DatabaseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5V19C3 20.66 7.03 22 12 22C16.97 22 21 20.66 21 19V5" />
    <path d="M3 12C3 13.66 7.03 15 12 15C16.97 15 21 13.66 21 12" />
  </svg>
);

export const WarehouseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m20 20-1.209-4.433a2 2 0 0 0-1.928-1.475H7.137a2 2 0 0 0-1.928 1.475L4 20" />
    <path d="M3 5.421 12 3l9 2.421" />
    <path d="M21 5.421V20" />
    <path d="M3 5.421V20" />
    <path d="M12 3v11.092" />
  </svg>
);

export const AnalyticsIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 3v18h18" />
    <path d="m19 9-5 5-4-4-3 3" />
  </svg>
);
