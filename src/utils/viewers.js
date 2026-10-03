// "1.2K" from a thousand, the plain number below; null when unknown.
export function formatViewerCount(n) {
  if (n == null) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
