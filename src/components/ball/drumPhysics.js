// A tiny 2D lottery drum: balls in a unit circle (y grows downward) with
// gravity, an air jet from the bottom, and bouncy collisions. Pure and
// seeded, so tests can step it.
export const BALL_R = 0.09;
const GRAVITY = 1.6;
const WALL_BOUNCE = 1.7; // 1 + restitution
const BALL_BOUNCE = 1.8;
const DRAG = 0.995;

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function spawn(rand, r) {
  const a = rand() * Math.PI * 2;
  const d = Math.sqrt(rand()) * (0.85 - r);
  return { x: Math.cos(a) * d, y: Math.abs(Math.sin(a)) * d * 0.8 + 0.1, vx: 0, vy: 0 };
}

export function createDrum(count, { seed = 7, r = BALL_R } = {}) {
  const rand = seeded(seed);
  const balls = Array.from({ length: count }, (_, i) => ({ id: `n${i}`, ...spawn(rand, r) }));
  return { r, rand, balls, byId: new Map(balls.map((b) => [b.id, b])) };
}

// Match the simulated pile to a list of ball ids. Survivors keep their
// position and velocity, new ids drop in from the top, removed ids vanish,
// and drum.balls follows the order of ids.
export function syncDrum(drum, ids) {
  const next = new Map();
  const balls = ids.map((id) => {
    const ball = drum.byId.get(id) || { id, ...spawn(drum.rand, drum.r), y: -0.6 };
    next.set(id, ball);
    return ball;
  });
  drum.byId = next;
  drum.balls = balls;
}

function keepInside(b, limit) {
  const dist = Math.hypot(b.x, b.y);
  if (dist <= limit) return;
  const nx = b.x / dist;
  const ny = b.y / dist;
  b.x = nx * limit;
  b.y = ny * limit;
  const vn = b.vx * nx + b.vy * ny;
  if (vn > 0) {
    b.vx -= WALL_BOUNCE * vn * nx;
    b.vy -= WALL_BOUNCE * vn * ny;
  }
}

export function stepDrum(drum, dt, jet = 0) {
  const { balls, r, rand } = drum;
  const limit = 1 - r;
  const drag = Math.pow(DRAG, dt * 60);
  for (const b of balls) {
    b.vy += GRAVITY * dt;
    // The blower: an upward push, strongest low in the drum.
    if (jet > 0 && b.y > 0.2 && Math.abs(b.x) < 0.55) {
      b.vy -= jet * (b.y + 0.2) * 9 * dt;
      b.vx += (rand() - 0.5) * jet * 6 * dt;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vx *= drag;
    b.vy *= drag;
    keepInside(b, limit);
  }
  // Relax the overlaps a few times so a packed pile settles.
  for (let pass = 0; pass < 3; pass += 1) {
    for (let i = 0; i < balls.length; i += 1) {
      for (let j = i + 1; j < balls.length; j += 1) {
        const a = balls[i];
        const b = balls[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        if (d >= 2 * r) continue;
        const nx = dx / d;
        const ny = dy / d;
        const push = (2 * r - d) / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          const k = (BALL_BOUNCE * rel) / 2;
          a.vx += k * nx;
          a.vy += k * ny;
          b.vx -= k * nx;
          b.vy -= k * ny;
        }
      }
    }
  }
  // Collisions can shove a ball through the glass; put it back.
  for (const b of balls) keepInside(b, limit);
}
