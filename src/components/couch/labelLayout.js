// Door labels never stack (pure geometry, no DOM). Each box is a label's
// resting rect in stage px plus the on-screen width of its object. Labels are
// placed in a fixed order (top to bottom, then left to right, then id); each
// takes the smallest move that clears the ones already placed: a sideways
// shift of at most `slack` of its object's width (so it still sits over it),
// then a lift upward with the same sideways options. Bounds always win.
const byReadingOrder = (a, b) => a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const hits = (a, b, gap) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

export function resolveLabels(boxes, { bounds, gap = 4, slack = 0.5 } = {}) {
  const left = bounds ? bounds.x : -Infinity;
  const right = bounds ? bounds.x + bounds.w : Infinity;
  const top = bounds ? bounds.y : -Infinity;
  const result = new Map();
  const placed = [];

  [...boxes].sort(byReadingOrder).forEach((box) => {
    const reach = (box.objectW || 0) * slack;
    const minDx = left - box.x;
    const maxDx = right - (box.x + box.w);
    const clampDx = (dx) => Math.min(Math.max(dx, minDx), Math.max(minDx, maxDx));
    const base = clampDx(0);
    const baseDy = Math.max(0, top - box.y);
    const at = (dx, dy) => ({ x: box.x + dx, y: box.y + dy, w: box.w, h: box.h });
    const free = (rect) => placed.every((p) => !hits(rect, p, gap));

    // Lifts that would put this label's bottom just above a placed label's top.
    const dys = [baseDy];
    placed.forEach((p) => {
      const dy = p.y - gap - (box.y + box.h);
      if (dy < baseDy && box.y + dy >= top) dys.push(dy);
    });
    dys.sort((a, b) => Math.abs(a) - Math.abs(b) || b - a);

    let found = null;
    for (const dy of dys) {
      const dxs = [base];
      placed.forEach((p) => {
        if (box.y + dy >= p.y + p.h + gap || p.y >= box.y + dy + box.h + gap) return;
        dxs.push(clampDx(p.x - gap - (box.x + box.w)), clampDx(p.x + p.w + gap - box.x));
      });
      const options = dxs
        .filter((dx) => dx === base || Math.abs(dx) <= reach)
        .sort((a, b) => Math.abs(a - base) - Math.abs(b - base) || a - b);
      const dx = options.find((o) => free(at(o, dy)));
      if (dx !== undefined) {
        found = [dx, dy];
        break;
      }
    }
    const [dx, dy] = found || [base, baseDy];
    placed.push(at(dx, dy));
    result.set(box.id, { id: box.id, dx: dx || 0, dy: dy || 0 });
  });

  return boxes.map((b) => result.get(b.id));
}
