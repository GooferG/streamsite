export function formatUSD(amount) {
  if (amount === null || amount === undefined) return '$0';
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(amount));
  const withCommas = abs.toLocaleString('en-US');
  return `${sign}$${withCommas}`;
}

export function maskUsername(username) {
  if (!username) return '';
  if (username.length === 1) return username;
  if (username.length <= 4) {
    return `${username[0]}****${username[username.length - 1]}`;
  }
  return `${username.slice(0, 2)}****${username[username.length - 1]}`;
}

export function formatPosition(position) {
  return `P${String(position).padStart(2, '0')}`;
}

// $50,000 split across top 10. Sums to exactly $50,000.
export const PRIZE_TABLE = [
  15000, 9000, 6500, 5000, 4000, 3500, 2500, 2000, 1500, 1000,
];

export const PRIZE_POOL_TOTAL = PRIZE_TABLE.reduce((sum, n) => sum + n, 0);

export function getPrizeForPosition(position) {
  if (!position || position < 1 || position > PRIZE_TABLE.length) return 0;
  return PRIZE_TABLE[position - 1];
}
