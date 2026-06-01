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

// "1st place", "2nd place", "23rd place" — used where a rank reads as prose
// (e.g. the Casino podium) rather than the compact "P01" cell format.
export function formatOrdinalPlace(position) {
  const n = Number(position);
  if (!n || n < 1) return '';
  const mod100 = n % 100;
  const mod10 = n % 10;
  let suffix = 'th';
  // 11/12/13 are always "th"; otherwise 1→st, 2→nd, 3→rd.
  if (mod100 < 11 || mod100 > 13) {
    if (mod10 === 1) suffix = 'st';
    else if (mod10 === 2) suffix = 'nd';
    else if (mod10 === 3) suffix = 'rd';
  }
  return `${n}${suffix} place`;
}

export function formatPosition(position) {
  return `P${String(position).padStart(2, '0')}`;
}

// Headline prize formatting shared across themes. Round thousands collapse to
// "$50K"; everything else is comma-grouped ("$7,000").
export function formatPrizeHeadline(amount) {
  if (!amount && amount !== 0) return '$0';
  if (amount >= 1000 && amount % 1000 === 0) {
    return `$${(amount / 1000).toLocaleString('en-US')}K`;
  }
  return `$${amount.toLocaleString('en-US')}`;
}

// $120,000 split across top 20. Sums to exactly $120,000.
export const PRIZE_TABLE = [
  40000, 22000, 15000, 9000, 6000, 5000, 4000, 3000, 2500, 2000, 1500, 1500,
  1500, 1500, 1500, 800, 800, 800, 800, 800,
];

export const PRIZE_POOL_TOTAL = PRIZE_TABLE.reduce((sum, n) => sum + n, 0);

export function getPrizeForPosition(position) {
  if (!position || position < 1 || position > PRIZE_TABLE.length) return 0;
  return PRIZE_TABLE[position - 1];
}
