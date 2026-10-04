import { FOCUS } from './classes';

// Purple runs viewer → viewer-deep and darkens on hover: white text stays
// at 4.5:1 or better across the gradient (bright → deep dipped to 3.3:1).
const VARIANTS = {
  viewer:
    'bg-gradient-to-b from-onair-viewer to-onair-viewer-deep text-white-body shadow-onair-raised hover:brightness-95',
  winner:
    'bg-gradient-to-b from-onair-winner-hot to-onair-winner-deep text-onair-winner-ink shadow-onair-raised hover:brightness-110',
  ghost: 'bg-white/[0.07] text-onair-ink-2 hover:bg-white/[0.12]',
};

const SIZES = {
  md: 'w-full px-4 py-3 text-[0.9375rem]',
  sm: 'w-auto px-3.5 py-2 text-sm [@media(pointer:coarse)]:min-h-11',
};

// Same look for `disabled` and `aria-disabled` (a control that stays focusable
// so it can explain why it is unavailable).
const DISABLED =
  'disabled:cursor-not-allowed disabled:bg-none disabled:bg-white/[0.08] disabled:text-onair-ink-5 disabled:shadow-none disabled:hover:brightness-100 aria-disabled:cursor-not-allowed aria-disabled:bg-none aria-disabled:bg-white/[0.08] aria-disabled:text-onair-ink-5 aria-disabled:shadow-none aria-disabled:hover:brightness-100';

export default function OnAirButton({ as: Tag = 'button', variant = 'viewer', size = 'md', type = 'button', className = '', children, ...rest }) {
  const typeProp = Tag === 'button' ? { type } : {};
  return (
    <Tag
      {...typeProp}
      className={`inline-flex items-center justify-center gap-2 rounded-onair-control font-bold transition-[filter,background-color] duration-150 ${SIZES[size]} ${VARIANTS[variant]} ${DISABLED} ${FOCUS} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
