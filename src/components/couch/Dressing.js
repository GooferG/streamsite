import { pctStyle, within } from './couchLayout';
import { FOCUS } from '../onAir/classes';

// A theme's dressing over the room (spec: Themes): decorative layers with no
// pointer events, positioned in percent of the art (or of `frame`, a rect of
// the art, inside the phone's TV crop). A layer whose id has an entry in
// `links` is a real link out instead ({ href, label }); the phone crop passes
// none, since it sits inside a link already.
export default function Dressing({ layers, frame = null, links = null }) {
  if (!layers || !layers.length) return null;
  return layers.map((layer) => {
    const style = pctStyle(frame ? within(frame, layer.rect) : layer.rect);
    const link = links && Object.prototype.hasOwnProperty.call(links, layer.id) ? links[layer.id] : null;
    if (link) {
      return (
        <a
          key={layer.id}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={link.label}
          data-dressing={layer.id}
          className={`pointer-events-auto absolute cursor-pointer motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-rotate-2 motion-safe:hover:scale-105 motion-safe:focus-visible:-rotate-2 motion-safe:focus-visible:scale-105 ${FOCUS}`}
          style={style}
        >
          <img src={layer.src} alt="" draggable={false} className="h-full w-full select-none" />
        </a>
      );
    }
    return (
      <img
        key={layer.id}
        src={layer.src}
        alt=""
        aria-hidden="true"
        draggable={false}
        data-dressing={layer.id}
        className="pointer-events-none absolute select-none"
        style={style}
      />
    );
  });
}
