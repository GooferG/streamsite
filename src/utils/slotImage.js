// Normalizes slot art URLs for storing (giveaway "now playing") and display.
// Idempotent: an already-encoded URL, like the communityhunts catalogue's
// Rainbet art ("%20", "%26", "%3F"), comes back unchanged, while raw spaces or
// non-ASCII get percent-encoded. encodeURI() is NOT idempotent (it turns %26
// into %2526), so don't use it on art URLs. Missing or invalid gives null.
export function toImageUrl(url) {
  if (!url) return null;
  try {
    return new URL(url).href;
  } catch {
    return null;
  }
}
