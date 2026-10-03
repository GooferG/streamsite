// Money formatting shared by predictions and the Hunts tab. communityhunts
// hunts carry their own currency (ARS, CAD, …); with a code we use Intl,
// without one we keep the site's historical "$1,234.00" format.

function toNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(value, currency = null, { decimals = 2 } = {}) {
  const n = toNumber(value);
  if (n == null) return '—';
  const digits = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  if (currency) {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency, ...digits }).format(n);
    } catch {
      return `${currency} ${n.toLocaleString('en-US', digits)}`;
    }
  }
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', digits)}`;
}

// Code and figure apart, so the figure can be sized to its box on its own:
// "ARS 1,850,000" overflows a tile, "1,850,000" under an ARS tag fits.
export function moneyParts(value, currency = null, { decimals = 2 } = {}) {
  const code = currency || '$';
  const n = toNumber(value);
  if (n == null) return { code, amount: '—' };
  const digits = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  const amount = Math.abs(n).toLocaleString('en-US', digits);
  return { code, amount: n < 0 ? `-${amount}` : amount };
}

export function formatMoneyCompact(value, currency = null) {
  const n = toNumber(value);
  if (n == null) return '—';
  if (currency) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(n);
    } catch {
      return `${currency} ${Math.round(n)}`;
    }
  }
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 100) / 10}k`;
  return `$${Math.round(n)}`;
}
