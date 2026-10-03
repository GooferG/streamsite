import { FOCUS } from './classes';

const VARIANTS = {
  viewer:
    'bg-gradient-to-b from-onair-viewer-bright to-onair-viewer-deep text-white-body shadow-onair-raised hover:brightness-110',
  winner:
    'bg-gradient-to-b from-onair-winner-hot to-onair-winner-deep text-onair-winner-ink shadow-onair-raised hover:brightness-110',
  ghost: 'bg-white/[0.07] text-onair-ink-2 hover:bg-white/[0.12]',
};

const SIZES = {
  md: 'w-full px-4 py-3 text-[0.9375rem]',
  sm: 'w-auto px-3.5 py-2 text-sm',
};

const DISABLED =
  'disabled:cursor-not-allowed disabled:bg-none disabled:bg-white/[0.08] disabled:text-onair-ink-6 disabled:shadow-none disabled:hover:brightness-100';

export default function OnAirButton({ variant = 'viewer', size = 'md', type = 'button', className = '', children, ...rest }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-onair-control font-bold transition-[filter,background-color] duration-150 ${SIZES[size]} ${VARIANTS[variant]} ${DISABLED} ${FOCUS} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
