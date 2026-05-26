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
