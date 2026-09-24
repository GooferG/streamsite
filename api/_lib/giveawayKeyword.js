// Whole-word keyword matching for chat giveaway entries.
//
// Substring matching entered anyone who said the keyword inside another word
// ("gg" in "eggs") or in passing. Here the keyword must stand on its own:
// the characters on either side must not be letters, digits or underscores.
// It does not have to be the whole message, so "!enter pls" still enters for
// "!enter", and a multi-word keyword matches across any run of whitespace.

export function normalizeKeyword(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isWordChar(ch) {
  return !!ch && /[a-z0-9_]/.test(ch);
}

export function messageHasKeyword(text, keyword) {
  const kw = normalizeKeyword(keyword);
  if (!kw) return false;
  const hay = String(text || '').toLowerCase().replace(/\s+/g, ' ');
  // Boundaries only apply on sides where the keyword itself is a word char:
  // "!enter" can follow anything, "enter" cannot follow a letter.
  const needsLeft = isWordChar(kw[0]);
  const needsRight = isWordChar(kw[kw.length - 1]);
  let from = 0;
  for (;;) {
    const i = hay.indexOf(kw, from);
    if (i === -1) return false;
    const leftOk = !needsLeft || !isWordChar(hay[i - 1]);
    const rightOk = !needsRight || !isWordChar(hay[i + kw.length]);
    if (leftOk && rightOk) return true;
    from = i + 1;
  }
}
