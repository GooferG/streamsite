// Keeps Tab inside a modal `box` (NavSheet keeps its own): Tab from the last
// stop goes round to the first, Shift+Tab from the first to the last, and a
// Tab from outside the box (or from the box itself) comes back in. Call it
// from a keydown listener; it ignores every other key.
export const TAB_STOPS = 'a[href], button:not([disabled]), iframe';

export function trapTab(e, box, selector = TAB_STOPS) {
  if (e.key !== 'Tab' || !box) return;
  const stops = Array.from(box.querySelectorAll(selector));
  if (!stops.length) return;
  const first = stops[0];
  const last = stops[stops.length - 1];
  const active = document.activeElement;
  if (!box.contains(active) || active === box) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  } else if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}
