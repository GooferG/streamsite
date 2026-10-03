// Live-grouped money input for the prediction slip. The slip keeps a guess as
// a canonical dot-decimal string ("1850000.5") and shows it grouped in the
// viewer's own locale while they type, so an ARS guess in the millions reads
// 1,850,000.50 (or 1.850.000,50) instead of a wall of zeros. Grouping marks
// are always ours: whichever mark is not the locale's decimal gets dropped.

const MAX_INT_DIGITS = 12;
const MAX_DECIMALS = 2;

export function localeSeparators(locale) {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5);
    const group = parts.find((p) => p.type === 'group');
    const decimal = parts.find((p) => p.type === 'decimal');
    return { group: group ? group.value : ',', decimal: decimal ? decimal.value : '.' };
  } catch {
    return { group: ',', decimal: '.' };
  }
}

function isDigit(ch) {
  return ch >= '0' && ch <= '9';
}

// Null when the whole part runs past MAX_INT_DIGITS: the input rejects that
// keystroke, since trimming would silently drop a digit from the far end.
export function parseAmountInput(text, { decimal }) {
  let whole = '';
  let frac = null;
  for (const ch of String(text || '')) {
    if (isDigit(ch)) {
      if (frac === null) {
        whole += ch;
      } else if (frac.length < MAX_DECIMALS) {
        frac += ch;
      }
    } else if (ch === decimal && frac === null) {
      frac = '';
    }
  }
  whole = whole.replace(/^0+(?=\d)/, '');
  if (whole.length > MAX_INT_DIGITS) return null;
  if (frac === null) return whole;
  return `${whole || '0'}.${frac}`;
}

export function formatAmountInput(raw, { group, decimal }) {
  if (!raw) return '';
  const [whole, frac] = String(raw).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return frac === undefined ? grouped : `${grouped}${decimal}${frac}`;
}

// Digits and decimal marks are the characters that survive regrouping, so
// counting them before the caret is enough to put the caret back.
export function significantBefore(text, caret, decimal) {
  let n = 0;
  const end = Math.min(caret, text.length);
  for (let i = 0; i < end; i++) {
    if (isDigit(text[i]) || text[i] === decimal) n++;
  }
  return n;
}

export function caretAfter(formatted, count, decimal) {
  if (count <= 0) return 0;
  let n = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (isDigit(formatted[i]) || formatted[i] === decimal) {
      n++;
      if (n === count) return i + 1;
    }
  }
  return formatted.length;
}
