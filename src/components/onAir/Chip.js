const TONES = {
  neutral: 'bg-white/[0.07] text-onair-ink-1',
  signal: 'bg-onair-signal/[0.14] text-onair-signal-light',
  loss: 'bg-onair-loss/[0.14] text-onair-loss',
  winner:
    'bg-gradient-to-b from-onair-winner-hot to-onair-winner-deep font-extrabold text-onair-winner-ink shadow-onair-winner-chip',
};

const SIZES = {
  md: 'px-4 py-2 text-[0.9375rem]',
  sm: 'px-3 py-1 text-xs',
};

export default function Chip({ tone = 'neutral', size = 'md', className = '', children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full leading-tight ${SIZES[size]} ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}
