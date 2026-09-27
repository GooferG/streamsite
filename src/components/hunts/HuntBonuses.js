import BonusReel from './BonusReel';

// Expanded bonus area for a hunt opened via useHuntDetail: error, reel, or a
// loading line while the fetch is in flight.
export default function HuntBonuses({ detail, loadError, currency }) {
  if (loadError) {
    return (
      <p className="text-[0.6875rem] font-bold tracking-eyebrow uppercase text-red-destructive/80 font-mono">{loadError}</p>
    );
  }
  if (detail) return <BonusReel bonuses={detail.bonuses} currency={currency} />;
  return (
    <p className="text-[0.625rem] font-bold tracking-eyebrow-lg uppercase text-white/45 font-mono">Loading bonuses…</p>
  );
}
