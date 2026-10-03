// The prediction slip: two halves joined at a dashed perforation, with real
// holes punched at both ends of it. Each half masks its own corner notches,
// so the holes stay on the perforation however tall the header grows, and
// they show the page behind (the site's gradient), not a painted dot. The
// glow sits on the unmasked outer box: an outer box-shadow is never drawn
// inside the box, so the holes stay clean.
const NOTCH = 12;

function notchMask(edge) {
  const y = edge === 'bottom' ? '100%' : '0';
  const hole = (x) => `radial-gradient(circle at ${x} ${y}, transparent ${NOTCH}px, #000 ${NOTCH + 0.5}px)`;
  const value = `${hole('0')} left / 51% 100% no-repeat, ${hole('100%')} right / 51% 100% no-repeat`;
  return { WebkitMask: value, mask: value };
}

export default function Ticket({ header, className = '', children }) {
  return (
    <section aria-label="Prediction slip" className={`rounded-onair-card shadow-onair-ticket ${className}`}>
      <div
        className="rounded-t-onair-card bg-gradient-to-b from-onair-ticket-top to-onair-ticket-mid px-[22px] pb-[18px] pt-[22px] shadow-[inset_0_1px_0_rgba(200,170,255,.18)]"
        style={notchMask('bottom')}
      >
        {header}
      </div>
      <div
        className="rounded-b-onair-card bg-gradient-to-b from-onair-ticket-mid to-onair-ticket-bottom px-[22px] pb-[22px]"
        style={notchMask('top')}
      >
        <div className="-mx-1 border-t-2 border-dashed border-white/[0.12]" aria-hidden="true" />
        <div className="pt-[18px]">{children}</div>
      </div>
    </section>
  );
}
