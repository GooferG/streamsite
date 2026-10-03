// A font size that keeps a one-line figure inside its box. The element's
// nearest ancestor needs `container-type: inline-size`; the size is the
// container width divided by the text's estimated width in em, clamped to
// [min, max] rem. Browsers without container units drop the declaration and
// keep the element's class size.

const DIGIT_EM = 0.62; // heavy (900) tabular figures in the system sans
const MARK_EM = 0.3; // , . ' and thin spaces
const OTHER_EM = 0.7;
const SAFETY = 0.94;

function textEm(text) {
  let em = 0;
  for (const ch of String(text || '')) {
    if (ch >= '0' && ch <= '9') em += DIGIT_EM;
    else if (/[.,'\s  ]/.test(ch)) em += MARK_EM;
    else em += OTHER_EM;
  }
  return Math.max(em, 1);
}

export function fitFontSize(text, { min = 0.875, max = 1.875 } = {}) {
  const cqi = ((100 * SAFETY) / textEm(text)).toFixed(2);
  return `clamp(${min}rem, ${cqi}cqi, ${max}rem)`;
}
