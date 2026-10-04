const SIZES = {
  md: 'h-[30px] px-2.5 text-[0.9375rem]',
  lg: 'h-16 px-5 text-[1.875rem]',
};

// The station bug. Pure CSS: generated art never carries lettering.
export default function GsnBug({ size = 'md', className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center rounded-onair-tile bg-gradient-to-b from-onair-ink-1 to-onair-ink-3 font-extrabold tracking-[-0.02em] text-onair-surface-4 shadow-onair-raised ${SIZES[size]} ${className}`}
    >
      GSN
    </span>
  );
}
