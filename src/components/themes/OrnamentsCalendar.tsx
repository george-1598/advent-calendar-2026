import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { between, rng } from '../../lib/random';
import { playChime, playTink } from '../../lib/sound';
import { TOTAL_DAYS, formatCountdown, isUnlocked, unlockAt } from '../../lib/time';
import type { CalendarController } from '../calendar/controller';
import SoundToggle from '../SoundToggle';
import { DESIGNS, OrnamentArt } from './ornaments/Ornament';
import { geometry, step, type Body, type Geometry, type Vec } from './ornaments/physics';

type TiltState = 'unknown' | 'needs-permission' | 'on';
const clamp = (v: number) => Math.max(-1, Math.min(1, v));

function initialBodies(geo: Geometry): Body[] {
  const r = rng(31);
  const { w, h } = geo;
  const bodies: Body[] = [];
  const overlaps = (x: number, y: number, rad: number) =>
    bodies.some((b) => Math.hypot(b.x - x, b.y - y) < b.r + rad + 4);
  DESIGNS.forEach((d, i) => {
    const rad = d.size * geo.unit;
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < 40; tries++) {
      if (i < 5) {
        // A few start inside the view, near the sides.
        x = r() < 0.5 ? between(r, 0.08, 0.2) * w : between(r, 0.8, 0.92) * w;
        y = between(r, 0.35, 0.9) * h;
      } else {
        // Off-screen to the left or right.
        y = between(r, 0.08, 0.95) * h;
        x = r() < 0.5 ? between(r, -0.62, -0.12) * w : between(r, 1.12, 1.62) * w;
      }
      if (!overlaps(x, y, rad)) break;
    }
    bodies.push({
      day: d.day,
      x,
      y,
      vx: 0,
      vy: 0,
      r: rad,
      size: d.size,
      mass: d.mass,
      drag: d.drag,
      angle: 0,
      av: 0,
      held: false,
      inZone: false,
      lastTink: 0,
    });
  });
  return bodies;
}

export default function OrnamentsCalendar({ ctrl }: { ctrl: CalendarController }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geometry | null>(null);
  const geoRef = useRef<Geometry | null>(null);
  const bodies = useRef<Body[]>([]);
  const els = useRef<Record<number, HTMLButtonElement | null>>({});
  const indicators = useRef<Record<number, HTMLSpanElement | null>>({});
  const gravity = useRef<Vec>({ x: 0, y: 0 });
  const sensor = useRef<Vec | null>(null);
  const dragTilt = useRef<{ sx: number; sy: number; v: Vec } | null>(null);
  const keyTilt = useRef<Vec>({ x: 0, y: 0 });
  const [tilt, setTilt] = useState<TiltState>('unknown');
  const tiltOn = useRef(false);
  const [zoneCount, setZoneCount] = useState(0);
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [selected, setSelected] = useState<{ day: number; from: { x: number; y: number; r: number } } | null>(null);
  const focusRef = useRef<HTMLDivElement>(null);

  // Measure the stage; rescale the world when it changes size.
  useLayoutEffect(() => {
    const el = stageRef.current!;
    const apply = () => {
      const { width, height } = el.getBoundingClientRect();
      const next = geometry(width, height);
      const prev = geoRef.current;
      if (!prev) bodies.current = initialBodies(next);
      else if (prev.w !== width || prev.h !== height) {
        const sx = width / prev.w;
        const sy = height / prev.h;
        bodies.current.forEach((b) => {
          b.x *= sx;
          b.y *= sy;
          b.r = b.size * next.unit;
        });
      } else return;
      geoRef.current = next;
      setGeo(next);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Device tilt.
  const attachSensor = () => {
    let base: { beta: number; gamma: number } | null = null;
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      base ??= { beta: e.beta, gamma: e.gamma };
      sensor.current = { x: clamp((e.gamma - base.gamma) / 25), y: clamp((e.beta - base.beta) / 25) };
      if (!tiltOn.current) {
        tiltOn.current = true;
        setTilt('on');
      }
    };
    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  };

  useEffect(() => {
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } })
      .DeviceOrientationEvent;
    if (!DOE) return;
    if (typeof DOE.requestPermission === 'function') {
      // iOS: needs a tap to ask permission. Only offer it on touch devices.
      if (window.matchMedia('(pointer: coarse)').matches) setTilt('needs-permission');
      return;
    }
    return attachSensor();
  }, []);

  const requestTilt = async () => {
    const DOE = (window as unknown as { DeviceOrientationEvent: { requestPermission: () => Promise<string> } })
      .DeviceOrientationEvent;
    try {
      if ((await DOE.requestPermission()) === 'granted') {
        attachSensor();
        setTilt('on');
        tiltOn.current = true;
      } else setTilt('unknown');
    } catch {
      setTilt('unknown');
    }
  };

  // Simulation loop — updates the DOM directly, no React re-render per frame.
  useEffect(() => {
    if (!geo) return;
    let raf = 0;
    let last = performance.now();
    let sparkleId = 0;
    const events = {
      onHit: (b: Body, speed: number) => {
        const t = performance.now();
        if (t - b.lastTink < 140) return;
        b.lastTink = t;
        playTink(b.size / 18, Math.min(0.07, speed / 6000));
      },
      onZone: (b: Body, entered: boolean) => {
        setZoneCount(bodies.current.filter((x) => x.inZone).length);
        els.current[b.day]?.classList.toggle('is-in-zone', entered);
        if (entered) {
          const id = ++sparkleId;
          setSparkles((s) => [...s, { id, x: b.x, y: b.y }]);
          window.setTimeout(() => setSparkles((s) => s.filter((p) => p.id !== id)), 900);
          playTink(0.6, 0.04);
        }
      },
    };

    const frame = (t: number) => {
      const dt = Math.min(0.04, (t - last) / 1000);
      last = t;
      const target = dragTilt.current?.v ?? sensor.current ?? keyTilt.current;
      const g = gravity.current;
      const ease = Math.min(1, dt * 8);
      g.x += (target.x - g.x) * ease;
      g.y += (target.y - g.y) * ease;
      const g2 = geoRef.current!;
      for (let i = 0; i < 3; i++) step(bodies.current, g2, g, dt / 3, events);

      const stage = stageRef.current;
      if (stage) {
        stage.style.setProperty('--hx', (-g.x * 8).toFixed(2));
        stage.style.setProperty('--hy', (-g.y * 8).toFixed(2));
      }
      for (const b of bodies.current) {
        const el = els.current[b.day];
        if (el) el.style.transform = `translate3d(${b.x - b.r}px, ${b.y - b.r}px, 0) rotate(${b.angle}rad)`;
        const ind = indicators.current[b.day];
        if (ind) {
          const out = b.x < -b.r || b.x > g2.w + b.r || b.y < -b.r || b.y > g2.h + b.r;
          ind.style.opacity = out && !b.held ? '1' : '0';
          if (out) {
            const ix = Math.max(10, Math.min(g2.w - 10, b.x));
            const iy = Math.max(10, Math.min(g2.h - 10, b.y));
            ind.style.transform = `translate(${ix - 5}px, ${iy - 5}px)`;
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [geo]);

  // Floating the chosen ornament toward the camera.
  useLayoutEffect(() => {
    if (!selected || !focusRef.current || !geo) return;
    const size = Math.min(geo.w, geo.h) * 0.42;
    const { x, y, r } = selected.from;
    const dx = x - geo.w / 2;
    const dy = y - geo.h * 0.42;
    focusRef.current.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${(r * 2) / size})`, opacity: 0.6 },
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      ],
      { duration: 650, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
  }, [selected, geo]);

  const onOrnament = (day: number) => {
    const b = bodies.current.find((x) => x.day === day)!;
    if (!b.inZone) {
      ctrl.notify('Float it up to the glowing star to take a closer look ✨');
      return;
    }
    pick(b);
  };

  const pick = (b: Body) => {
    const g = geoRef.current!;
    b.held = true;
    els.current[b.day]?.classList.add('is-held');
    playChime();
    // If it's off-screen, start the flight from the nearest edge.
    const x = Math.max(b.r, Math.min(g.w - b.r, b.x));
    const y = Math.max(b.r, Math.min(g.h - b.r, b.y));
    setSelected({ day: b.day, from: { x, y, r: b.r } });
  };

  // Today's ornament (the latest unlocked day), or day 1 before December.
  const todayDay = (() => {
    for (let d = TOTAL_DAYS; d >= 1; d--) if (isUnlocked(d, ctrl.now)) return d;
    return 1;
  })();
  const showToday = () => {
    if (selected) return;
    const b = bodies.current.find((x) => x.day === todayDay);
    if (b) pick(b);
  };

  const hangBack = () => {
    if (!selected || !geo) return;
    const b = bodies.current.find((x) => x.day === selected.day)!;
    b.held = false;
    b.x = geo.zone.x;
    b.x = geo.zone.x + (Math.random() < 0.5 ? -1 : 1) * geo.zone.r * 1.3;
    b.y = geo.zone.y + geo.zone.r * 0.6;
    b.vx = (Math.random() - 0.5) * 120;
    b.vy = 140;
    els.current[selected.day]?.classList.remove('is-held');
    setSelected(null);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.orn, .orn-focus, .orn-enable')) return;
    e.preventDefault(); // no text selection while dragging to tilt
    e.currentTarget.setPointerCapture(e.pointerId);
    dragTilt.current = { sx: e.clientX, sy: e.clientY, v: { x: 0, y: 0 } };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragTilt.current;
    if (!d) return;
    d.v = { x: clamp((e.clientX - d.sx) / 70), y: clamp((e.clientY - d.sy) / 70) };
  };
  const endDrag = () => (dragTilt.current = null);

  const onKey = (e: KeyboardEvent<HTMLDivElement>, down: boolean) => {
    const k = keyTilt.current;
    const v = down ? 1 : 0;
    if (e.key === 'ArrowLeft') k.x = -v;
    else if (e.key === 'ArrowRight') k.x = v;
    else if (e.key === 'ArrowUp') k.y = -v;
    else if (e.key === 'ArrowDown') k.y = v;
    else return;
    e.preventDefault();
  };

  const selState = selected ? ctrl.stateOf(selected.day) : null;
  const focusSize = geo ? Math.min(geo.w, geo.h) * 0.42 : 0;

  return (
    <div className="orn-wrap">
      <div className="orn-head">
        <p className="theme-lead orn-lead">Float today’s ornament up to the star</p>
        <SoundToggle />
      </div>
      <div
        ref={stageRef}
        className="orn-stage"
        tabIndex={0}
        aria-label="Christmas tree. Tilt your phone, drag, or use the arrow keys to roll the ornaments."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(e) => onKey(e, true)}
        onKeyUp={(e) => onKey(e, false)}
      >
        {geo && <TreeArt geo={geo} />}
        {geo && (
          <div
            className={zoneCount > 0 ? 'orn-zone is-active' : 'orn-zone'}
            style={{ left: geo.zone.x - geo.zone.r, top: geo.zone.y - geo.zone.r, width: geo.zone.r * 2, height: geo.zone.r * 2 }}
          >
            <span>{zoneCount > 0 ? 'Tap an ornament' : 'Float one up to the star'}</span>
          </div>
        )}
        {geo &&
          DESIGNS.map((d) => {
            const size = d.size * geo.unit * 2;
            return (
              <button
                key={d.day}
                ref={(el) => (els.current[d.day] = el)}
                className="orn"
                style={{ width: size, height: size } as CSSProperties}
                aria-label={`Ornament ${d.day}`}
                onClick={() => onOrnament(d.day)}
              >
                <OrnamentArt design={d} label={d.day} />
              </button>
            );
          })}
        {DESIGNS.map((d) => (
          <span key={d.day} ref={(el) => (indicators.current[d.day] = el)} className="orn-indicator" style={{ background: d.color }} />
        ))}
        {sparkles.map((s) => (
          <span key={s.id} className="orn-sparkle" style={{ left: s.x, top: s.y }}>
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} style={{ ['--a' as string]: `${i * 45}deg` }}>
                ✦
              </i>
            ))}
          </span>
        ))}

        {selected && selState && geo && (
          <div className="orn-focus-backdrop" onClick={hangBack}>
            <div
              ref={focusRef}
              className="orn-focus"
              style={{ width: focusSize, height: focusSize, left: geo.w / 2 - focusSize / 2, top: geo.h * 0.42 - focusSize / 2 }}
              onClick={(e) => e.stopPropagation()}
            >
              <OrnamentArt design={DESIGNS[selected.day - 1]} label={selected.day} />
            </div>
            <div className="orn-focus-actions" onClick={(e) => e.stopPropagation()}>
              {selState.canOpen ? (
                <button
                  className="orn-btn orn-btn--primary"
                  onClick={() => {
                    const day = selected.day;
                    hangBack();
                    ctrl.open(day, DESIGNS[day - 1].color);
                  }}
                >
                  Open December {selected.day}
                </button>
              ) : (
                <p className="orn-note">Day {selected.day} opens in {formatCountdown(unlockAt(selected.day) - ctrl.now)}</p>
              )}
              <button className="orn-btn" onClick={hangBack}>
                Hang it back
              </button>
            </div>
          </div>
        )}

        {tilt === 'needs-permission' && (
          <button className="orn-enable" onClick={requestTilt}>
            Enable tilt
          </button>
        )}
      </div>
      <button className="theme-help" onClick={showToday} disabled={!!selected}>
        {ctrl.stateOf(todayDay).today ? 'Show me today’s ornament' : `Show me ornament ${todayDay}`}
      </button>
      <p className="orn-hint">
        {tilt === 'on'
          ? 'Tilt your phone back to float them up, and sideways to steer'
          : 'Drag up, down or sideways on the tree (or use arrow keys) to tilt it'}
      </p>
    </div>
  );
}

function TreeArt({ geo }: { geo: Geometry }) {
  const [t1, , t3] = geo.tiers;
  const trunkW = (t1[2].x - t1[1].x) * 0.22;
  const lights = geo.tiers.flatMap((tri, ti) =>
    Array.from({ length: 6 + ti * 2 }, (_, i) => {
      const n = 6 + ti * 2;
      const t = (i + 0.5) / n;
      const yy = tri[0].y + (tri[1].y - tri[0].y) * (0.45 + 0.5 * ((i * 7) % n) / n);
      const half = ((yy - tri[0].y) / (tri[1].y - tri[0].y)) * (tri[2].x - tri[0].x);
      return { x: tri[0].x - half + 2 * half * t, y: yy, c: ['#FFE27A', '#FF6B5E', '#7FD3FF', '#FFFFFF'][(i + ti) % 4] };
    }),
  );
  return (
    <svg className="orn-tree" width={geo.w} height={geo.h} aria-hidden="true">
      <defs>
        <linearGradient id="tree-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2E8B57" />
          <stop offset="1" stopColor="#0E4D2C" />
        </linearGradient>
        <radialGradient id="tree-glow">
          <stop offset="0" stopColor="#FFE6A0" stopOpacity="0.35" />
          <stop offset="1" stopColor="#FFE6A0" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={geo.w / 2} cy={geo.h * 0.42} rx={geo.w * 0.5} ry={geo.h * 0.45} fill="url(#tree-glow)" />
      <rect x={geo.w / 2 - trunkW / 2} y={t3[1].y - 4} width={trunkW} height={geo.h * 0.06} fill="#5A3A22" />
      {geo.tiers.map((tri, i) => (
        <g key={i}>
          <path d={`M${tri[0].x} ${tri[0].y} L${tri[1].x} ${tri[1].y} L${tri[2].x} ${tri[2].y} Z`} fill="url(#tree-g)" />
          {/* scalloped branch tips */}
          {Array.from({ length: 7 }, (_, k) => {
            const x = tri[1].x + ((tri[2].x - tri[1].x) * (k + 0.5)) / 7;
            return <circle key={k} cx={x} cy={tri[1].y} r={(tri[2].x - tri[1].x) / 14} fill="#145C36" />;
          })}
          <path
            d={`M${tri[0].x - (tri[0].x - tri[1].x) * 0.55} ${tri[0].y + (tri[1].y - tri[0].y) * 0.55} Q ${tri[0].x} ${tri[0].y + (tri[1].y - tri[0].y) * 0.8}, ${tri[0].x + (tri[2].x - tri[0].x) * 0.75} ${tri[0].y + (tri[1].y - tri[0].y) * 0.75}`}
            stroke="#E8C77A"
            strokeWidth="2"
            fill="none"
            opacity="0.8"
          />
        </g>
      ))}
      {lights.map((l, i) => (
        <circle key={i} className="tree-light" cx={l.x} cy={l.y} r={3 * geo.unit} fill={l.c} style={{ animationDelay: `${-i * 0.29}s` }} />
      ))}
      <g transform={`translate(${t1[0].x} ${t1[0].y - 6}) scale(${geo.unit * 1.2})`}>
        <path
          className="tree-star"
          d="M0 -16 l4.7 9.6 10.5 1.5 -7.6 7.4 1.8 10.5 -9.4 -5 -9.4 5 1.8 -10.5 -7.6 -7.4 10.5 -1.5 Z"
          fill="#FFD34D"
        />
      </g>
    </svg>
  );
}
