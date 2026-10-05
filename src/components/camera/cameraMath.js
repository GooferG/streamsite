// Camera geometry for the couch (spec: The camera). Pure: rects in, numbers
// out. A rect is { x, y, width, height } in viewport pixels. A zoom is
// { scale, x, y }, applied as translate(x, y) scale(scale) with
// transform-origin 0 0 on the element being moved.

export const ZOOM_FILL = 0.9;
export const MAX_ZOOM = 3.5;
export const REST = Object.freeze({ scale: 1, x: 0, y: 0 });

// [x, y, w, h] in percent of `box`, as a rect in the box's coordinates.
export function pctRect(box, [px, py, pw, ph]) {
  return {
    x: box.x + (px / 100) * box.width,
    y: box.y + (py / 100) * box.height,
    width: (pw / 100) * box.width,
    height: (ph / 100) * box.height,
  };
}

// The zoom that centres `target` (a rect inside `stage`, both measured at
// rest) in `view` and fills `fill` of its tighter side, capped at `max`.
export function zoomTransform(stage, target, view, { fill = ZOOM_FILL, max = MAX_ZOOM } = {}) {
  const scale = Math.min(max, fill * Math.min(view.width / target.width, view.height / target.height));
  const cx = target.x - stage.x + target.width / 2;
  const cy = target.y - stage.y + target.height / 2;
  return {
    scale,
    x: view.x + view.width / 2 - (stage.x + cx * scale),
    y: view.y + view.height / 2 - (stage.y + cy * scale),
  };
}

export const toCss = ({ scale, x, y }) => `translate(${x}px, ${y}px) scale(${scale})`;

// Size a box of `aspect` (width / height) to cover `container`, with the focal
// point [fx, fy] (percent of the box) as near the centre as the edges allow.
export function coverBox(container, aspect, [fx, fy]) {
  const width = Math.max(container.width, container.height * aspect);
  const height = width / aspect;
  const place = (want, lowest) => Math.min(0, Math.max(lowest, want));
  return {
    width,
    height,
    left: place(container.width / 2 - (fx / 100) * width, container.width - width),
    top: place(container.height / 2 - (fy / 100) * height, container.height - height),
  };
}

// What a zoom fills: the window under the fixed nav.
export const viewRect = (win, navH) => ({ x: 0, y: navH, width: win.innerWidth, height: win.innerHeight - navH });

// The iris cut (Ruling R23) centres on the middle of the view, which is where a
// zoom puts its object, and starts open just past the window's farthest corner.
export function irisCircle(view, win) {
  const x = view.x + view.width / 2;
  const y = view.y + view.height / 2;
  const far = Math.hypot(Math.max(x, win.innerWidth - x), Math.max(y, win.innerHeight - y));
  return { x, y, r: Math.ceil(far) + 2 };
}
