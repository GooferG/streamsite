import StaticNoise from '../onAir/StaticNoise';
import { NAV_H } from '../nav/navMetrics';

// The camera's cut: full-width static under the nav. 'in' fades up, 'hold' is
// already up, 'out' fades away (classes in index.css).
const PHASE = { in: 'camera-static-in', hold: '', out: 'camera-static-out' };

export default function CameraStatic({ phase }) {
  if (!phase || phase === 'off') return null;
  return (
    <StaticNoise
      testId="camera-static"
      className={`fixed inset-x-0 bottom-0 z-40 ${PHASE[phase]}`}
      style={{ top: NAV_H }}
    />
  );
}
