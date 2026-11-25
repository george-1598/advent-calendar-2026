/**
 * A tiny 2D physics world: ornaments (circles) roll under a tilt-controlled
 * gravity, bounce off the world edges, the tree's branches (triangles) and
 * each other, and swing on their hooks when they hit something.
 */

export interface Vec {
  x: number;
  y: number;
}
type Tri = [Vec, Vec, Vec];

export interface Body {
  day: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Base size before scaling to the stage. */
  size: number;
  mass: number;
  /** Air drag — light glass ornaments float more, heavy metal ones roll on. */
  drag: number;
  angle: number;
  av: number;
  held: boolean;
  inZone: boolean;
  lastTink: number;
}

export interface Geometry {
  w: number;
  h: number;
  unit: number;
  world: { minX: number; maxX: number; minY: number; maxY: number };
  tiers: Tri[];
  zone: { x: number; y: number; r: number };
}

export function geometry(w: number, h: number): Geometry {
  const S = Math.min(w, h * 0.8);
  const cx = w / 2;
  const tiers = (
    [
      // The tree sits in the lower part of the scene, leaving open sky above
      // it to steer ornaments up to the star.
      [0.36, 0.54, 0.17],
      [0.46, 0.69, 0.26],
      [0.58, 0.86, 0.36],
    ] as const
  ).map(([top, bottom, half]): Tri => [
    { x: cx, y: top * h },
    { x: cx - half * S, y: bottom * h },
    { x: cx + half * S, y: bottom * h },
  ]);
  return {
    w,
    h,
    unit: Math.min(w, h) / 420,
    // The ceiling is the top of the view, so ornaments floated upwards come to
    // rest along it — and the ones in the middle settle around the star.
    world: { minX: -w * 0.7, maxX: w * 1.7, minY: 0, maxY: h },
    tiers,
    // Glowing circle around the star, mostly above the tree's tip.
    zone: { x: cx, y: tiers[0][0].y - Math.min(w, h) * 0.16 * 0.5, r: Math.min(w, h) * 0.16 },
  };
}

export interface StepEvents {
  onHit: (b: Body, speed: number) => void;
  onZone: (b: Body, entered: boolean) => void;
}

const closestOnSegment = (p: Vec, a: Vec, b: Vec): Vec => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby)));
  return { x: a.x + abx * t, y: a.y + aby * t };
};

const sign = (p: Vec, a: Vec, b: Vec) => (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y);
const insideTri = (p: Vec, [a, b, c]: Tri) => {
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};

function collideTri(body: Body, tri: Tri, events: StepEvents) {
  const p = { x: body.x, y: body.y };
  let best: Vec | null = null;
  let bestD = Infinity;
  for (let i = 0; i < 3; i++) {
    const q = closestOnSegment(p, tri[i], tri[(i + 1) % 3]);
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  if (!best) return;
  const inside = insideTri(p, tri);
  if (!inside && bestD >= body.r) return;

  let nx: number;
  let ny: number;
  if (bestD < 1e-6) {
    nx = 0;
    ny = -1;
  } else {
    nx = (p.x - best.x) / bestD;
    ny = (p.y - best.y) / bestD;
    if (inside) {
      nx = -nx;
      ny = -ny;
    }
  }
  const pen = inside ? body.r + bestD : body.r - bestD;
  body.x += nx * pen;
  body.y += ny * pen;
  const vn = body.vx * nx + body.vy * ny;
  if (vn < 0) {
    const restitution = 0.35;
    body.vx -= (1 + restitution) * vn * nx;
    body.vy -= (1 + restitution) * vn * ny;
    // Branch friction and a swing kick from the tangential motion.
    const tx = -ny;
    const ty = nx;
    const vt = body.vx * tx + body.vy * ty;
    body.vx -= vt * 0.08 * tx;
    body.vy -= vt * 0.08 * ty;
    body.av += (vt / body.r) * 0.6 + (-vn / body.r) * 0.25 * Math.sign(tx || 1);
    if (-vn > 120) events.onHit(body, -vn);
  }
}

export function step(bodies: Body[], geo: Geometry, g: Vec, dt: number, events: StepEvents) {
  // Gentle gravity so ornaments drift rather than shoot across the screen.
  const G = 620 * geo.unit;
  const maxSpeed = 380 * geo.unit;
  const { world } = geo;

  for (const b of bodies) {
    if (b.held) continue;
    b.vx += g.x * G * dt;
    b.vy += g.y * G * dt;
    const k = Math.exp(-b.drag * dt);
    b.vx *= k;
    b.vy *= k;
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > maxSpeed) {
      b.vx *= maxSpeed / speed;
      b.vy *= maxSpeed / speed;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Hanging swing: a damped pendulum pushed by sideways acceleration.
    b.av += (-b.angle * 26 - b.av * 2.4 - g.x * 5) * dt;
    b.angle = Math.max(-0.9, Math.min(0.9, b.angle + b.av * dt));

    const bounce = 0.4;
    if (b.x < world.minX + b.r) {
      if (b.vx < -150) events.onHit(b, -b.vx);
      b.x = world.minX + b.r;
      b.vx = -b.vx * bounce;
    } else if (b.x > world.maxX - b.r) {
      if (b.vx > 150) events.onHit(b, b.vx);
      b.x = world.maxX - b.r;
      b.vx = -b.vx * bounce;
    }
    if (b.y < world.minY + b.r) {
      if (b.vy < -150) events.onHit(b, -b.vy);
      b.y = world.minY + b.r;
      b.vy = -b.vy * bounce;
    } else if (b.y > world.maxY - b.r) {
      if (b.vy > 150) events.onHit(b, b.vy);
      b.y = world.maxY - b.r;
      b.vy = -b.vy * bounce;
    }

    for (const tri of geo.tiers) collideTri(b, tri, events);
  }

  // Ornament–ornament collisions (heavier ornaments push lighter ones).
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      if (a.held && b.held) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const R = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= R * R || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const ia = a.held ? 0 : 1 / a.mass;
      const ib = b.held ? 0 : 1 / b.mass;
      const total = ia + ib;
      if (total === 0) continue;
      const pen = R - d;
      a.x -= (nx * pen * ia) / total;
      a.y -= (ny * pen * ia) / total;
      b.x += (nx * pen * ib) / total;
      b.y += (ny * pen * ib) / total;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const impulse = (-(1 + 0.5) * rel) / total;
        a.vx -= impulse * nx * ia;
        a.vy -= impulse * ny * ia;
        b.vx += impulse * nx * ib;
        b.vy += impulse * ny * ib;
        a.av -= impulse * ia * ny * 0.01;
        b.av += impulse * ib * ny * 0.01;
        if (-rel > 140) {
          events.onHit(a, -rel);
          events.onHit(b, -rel);
        }
      }
    }
  }

  const { zone } = geo;
  for (const b of bodies) {
    if (b.held) continue;
    // The star gently pulls in ornaments that drift close, so they settle
    // around it in mid-air; a strong tilt can still pull them away.
    const dx = zone.x - b.x;
    const dy = zone.y - b.y;
    const dist = Math.hypot(dx, dy);
    if (dist < zone.r * 1.15) {
      b.vx += dx * 7 * dt;
      b.vy += dy * 7 * dt;
      const k = Math.exp(-3 * dt);
      b.vx *= k;
      b.vy *= k;
    }
    const inZone = Math.hypot(b.x - zone.x, b.y - zone.y) < zone.r - b.r * 0.15;
    if (inZone !== b.inZone) {
      b.inZone = inZone;
      events.onZone(b, inZone);
    }
  }
}
