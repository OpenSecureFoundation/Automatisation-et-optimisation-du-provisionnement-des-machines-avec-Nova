const FALLBACK_TOKENS = {
  '--primary': '#6d28d9',
  '--primary-hover': '#5b21b6',
  '--primary-light': 'rgba(109, 40, 217, 0.12)',
  '--primary-border': '#6d28d9',
  '--secondary': '#0f172a',
  '--success': '#16a34a',
  '--danger': '#dc2626',
  '--warning': '#d97706',
  '--info': '#2563eb',
  '--deal-light': '#ecfccb',
  '--card-bg': '#ffffff',
  '--dark': '#0f172a',
  '--light': '#f1f5f9',
  '--text': '#1e293b',
  '--text-body': '#334155',
  '--text-muted': '#64748b',
  '--bg-page': '#f8fafc',
  '--border': '#e2e8f0',

  '--space-xs': '0.25rem',
  '--space-sm': '0.5rem',
  '--space-md': '1rem',
  '--space-lg': '1.5rem',
  '--space-xl': '2rem',

  '--radius-sm': '6px',
  '--radius-md': '10px',
  '--radius-lg': '12px',
  '--radius-xl': '16px',

  '--transition-base': '0.2s ease',
  '--transition-slow': '0.3s ease',

  '--shadow-card': '0 6px 24px rgba(15, 23, 42, 0.08)',
  '--shadow-card-hover': '0 14px 34px rgba(15, 23, 42, 0.14)',
  '--shadow-focus': '0 0 0 3px rgba(109, 40, 217, 0.2)',

  '--skeleton-bg': '#eef2f7',
  '--skeleton-shine': '#f8fafc',

  '--font-heading': "'Satoshi', 'Poppins', sans-serif",
  '--font-body': "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif"
};

export function applyFallbackCssTokens() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const computed = getComputedStyle(root);

  Object.entries(FALLBACK_TOKENS).forEach(([key, value]) => {
    const current = computed.getPropertyValue(key).trim();
    if (!current) {
      root.style.setProperty(key, value);
    }
  });
}

// Auto-apply pour éviter pages blanches / tokens manquants si index.css ne charge pas.
applyFallbackCssTokens();

