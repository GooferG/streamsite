import { useId } from 'react';
import OnAirButton from './OnAirButton';
import { MONO } from './classes';
import useHoldToConfirm from './useHoldToConfirm';

// OnAirButton that spends only on a held press (or two presses). The fill is
// functional feedback, so it runs even under reduced motion.
export default function HoldButton({
  duration = 900,
  confirmWindow = 4000,
  disabled = false,
  onConfirm,
  onHoldStart,
  idleLabel,
  holdingLabel = 'Keep holding…',
  armedLabel,
  hint = null,
  hintHidden = false,
  variant = 'viewer',
  size = 'md',
  className = '',
}) {
  const hintId = useId();
  const { holding, armed, bind } = useHoldToConfirm({ duration, confirmWindow, disabled, onConfirm, onHoldStart });
  const label = armed ? armedLabel : holding ? holdingLabel : idleLabel;
  return (
    <div className={className}>
      <OnAirButton
        variant={variant}
        size={size}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        className="relative touch-none select-none overflow-hidden [-webkit-touch-callout:none]"
        {...bind}
      >
        <span
          aria-hidden="true"
          data-hold-fill
          className={`pointer-events-none absolute inset-0 origin-left bg-white/20 ${holding ? 'scale-x-100' : 'scale-x-0'}`}
          style={{ transition: `transform ${holding ? duration : 120}ms linear` }}
        />
        <span className="relative">{label}</span>
      </OnAirButton>
      {hint && (
        <p
          id={hintId}
          className={hintHidden ? 'sr-only' : `${MONO} mt-2.5 text-center text-[0.625rem] tracking-[0.18em] text-onair-ink-5`}
        >
          {hint}
        </p>
      )}
      <span className="sr-only" aria-live="polite">
        {armed ? armedLabel : ''}
      </span>
    </div>
  );
}
