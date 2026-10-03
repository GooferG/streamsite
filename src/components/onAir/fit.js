import { textEm } from '../../utils/fitText';

// A one-line display figure sized to a share of its nearest size container
// (container-type: inline-size). The share defaults to --hero-share so a
// breakpoint can shrink it when side stats join the hero's row.
export function fitFigure(text, { min, max, share = 'var(--hero-share, 1)' }) {
  const per = (94 / textEm(text)).toFixed(2);
  return `clamp(${min}rem, calc(${per}cqi * ${share}), ${max}rem)`;
}
