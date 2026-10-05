import { pctStyle, within } from './couchLayout';

// A theme's dressing over the room (spec: Themes): decorative layers with no
// pointer events, positioned in percent of the art (or of `frame`, a rect of
// the art, inside the phone's TV crop).
export default function Dressing({ layers, frame = null }) {
  if (!layers || !layers.length) return null;
  return layers.map((layer) => (
    <img
      key={layer.id}
      src={layer.src}
      alt=""
      aria-hidden="true"
      draggable={false}
      data-dressing={layer.id}
      className="pointer-events-none absolute select-none"
      style={pctStyle(frame ? within(frame, layer.rect) : layer.rect)}
    />
  ));
}
