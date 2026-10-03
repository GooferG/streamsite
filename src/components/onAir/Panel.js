// The On Air surface: rounded, inset highlight plus drop shadow, no border.
// A lit panel washes in its role colour from the left; winner and viewer also
// carry their glow, the only glows On Air allows.
const RADIUS = { card: 'rounded-onair-card', row: 'rounded-onair-row' };

const SURFACE = {
  none: 'bg-gradient-to-b from-onair-surface-1 to-onair-surface-3',
  winner:
    'bg-onair-surface-2 bg-gradient-to-r from-onair-winner/20 via-onair-winner/[0.04] via-60% to-transparent',
  viewer:
    'bg-onair-surface-2 bg-gradient-to-r from-onair-viewer/[0.22] via-onair-viewer/[0.04] via-60% to-transparent',
  signal:
    'bg-onair-surface-2 bg-gradient-to-r from-onair-signal-deep/[0.16] to-onair-signal-deep/[0.03]',
};

const RESTING = { card: 'shadow-onair-card', row: 'shadow-onair-row' };
const LIT = {
  winner: 'shadow-onair-lit-winner',
  viewer: 'shadow-onair-lit-viewer',
  signal: 'shadow-onair-lit-signal',
};

export default function Panel({ as: Tag = 'div', radius = 'card', lit = null, className = '', children, ...rest }) {
  const depth = lit ? LIT[lit] : RESTING[radius];
  return (
    <Tag
      className={`${RADIUS[radius]} ${SURFACE[lit || 'none']} ${depth} ${className}`}
      data-lit={lit || undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
