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

// $120,000 split across top 20. Sums to exactly $120,000.
export const PRIZE_TABLE = [
  40000, 22000, 15000, 9000, 6000, 5000, 4000, 3000, 2500, 2000,
  1500, 1500, 1500, 1500, 1500, 800, 800, 800, 800, 800,
];

export const PRIZE_POOL_TOTAL = PRIZE_TABLE.reduce((sum, n) => sum + n, 0);

export function getPrizeForPosition(position) {
  if (!position || position < 1 || position > PRIZE_TABLE.length) return 0;
  return PRIZE_TABLE[position - 1];
}
