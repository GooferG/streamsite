// Caps a list/table body height and scrolls it internally past the cap, so a
// long hunt doesn't stretch the page. Sticky header/footer pinning is done by
// the table cells inside (position: sticky) — this just owns the scroll box.
// `maxClass` is a Tailwind max-height utility (e.g. 'max-h-[60vh]').
export default function CappedScroll({ maxClass = 'max-h-[60vh]', className = '', children }) {
  return (
    <div className={`${maxClass} overflow-y-auto [scrollbar-width:thin] ${className}`}>
      {children}
    </div>
  );
}
