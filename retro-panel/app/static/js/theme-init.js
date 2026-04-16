/**
 * theme-init.js — restore saved theme from localStorage before first paint.
 * Runs synchronously (no defer) to avoid flash of wrong theme.
 * iOS 12+ safe — no const/let/arrow.
 */
try {
  var _t = localStorage.getItem('rp_theme');
  if (_t === 'light' || _t === 'dark' || _t === 'auto') {
    document.body.className = 'theme-' + _t;
  }
} catch (e) {}
