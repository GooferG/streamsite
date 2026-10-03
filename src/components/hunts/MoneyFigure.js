import { splitMoney } from './huntStats';

// A formatted amount with its currency symbol set smaller beside the figure,
// so "ARS 1,850,000.00" fits where the full-size code would clip. Text with no
// symbol ('109.1x', '—', '11/12') renders unchanged.
export default function MoneyFigure({ text, symbolClassName = 'text-[0.6em]' }) {
  const { sign, symbol, figure } = splitMoney(text);
  return (
    <>
      {sign}
      {symbol && <span className={`mr-[0.08em] font-bold opacity-[0.85] ${symbolClassName}`}>{symbol}</span>}
      {figure}
    </>
  );
}

// The text a fitted size should be computed from: the symbol counts for about
// half its width once it is set small.
export function fitTextFor(text) {
  const { sign, symbol, figure } = splitMoney(text);
  return `${sign}${symbol.slice(0, Math.ceil(symbol.length / 2))}${figure}`;
}
