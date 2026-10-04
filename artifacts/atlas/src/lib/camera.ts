// The map camera's own motion role, read from the Atlas Patterns (--motion-map-camera-*).
// A long move zooms out, travels and zooms back in (fly); a short one glides (glide). User input
// interrupts either: both run on Leaflet's own fly frame, which a drag, wheel or pinch cancels.
// Under reduced motion the camera jumps.
//
// Leaflet's flyTo fixes its arc at 1.42 and its easing, so fly() is Leaflet's van Wijk and Nuij
// path with the curve, the clamped duration and the easing taken from the role instead.

import L from "leaflet";

// Leaflet's internal camera calls, which flyTo itself uses
interface MapInternals {
  _stop(): void;
  _move(center: L.LatLng, zoom: number, data?: { flyTo?: boolean }): MapInternals;
  _moveStart(zoomChanged: boolean, noMoveStart?: boolean): MapInternals;
  _moveEnd(zoomChanged: boolean): MapInternals;
  _flyToFrame?: number;
  _zoom: number;
}

interface CameraRole {
  speed: number;
  curve: number;
  min: number;
  max: number;
  pan: number;
  ease: (t: number) => number;
}

function readRole(): CameraRole {
  const cs = getComputedStyle(document.documentElement);
  const num = (name: string) => parseFloat(cs.getPropertyValue(name));
  const bezier = cs.getPropertyValue("--motion-map-camera-easing").match(/[\d.]+/g)?.map(Number) ?? [0.37, 0, 0.63, 1];
  return {
    speed: num("--motion-map-camera-speed"),
    curve: num("--motion-map-camera-curve"),
    min: num("--motion-map-camera-duration-min"),
    max: num("--motion-map-camera-duration-max"),
    pan: num("--motion-map-camera-pan-duration"),
    ease: cubicBezier(bezier[0], bezier[1], bezier[2], bezier[3]),
  };
}

// CSS's cubic-bezier as a function of time: solve x(t) for t by Newton's method, then return y(t)
function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const a = (p1: number, p2: number) => 1 - 3 * p2 + 3 * p1;
  const b = (p1: number, p2: number) => 3 * p2 - 6 * p1;
  const c = (p1: number) => 3 * p1;
  const at = (t: number, p1: number, p2: number) => ((a(p1, p2) * t + b(p1, p2)) * t + c(p1)) * t;
  const slope = (t: number, p1: number, p2: number) => 3 * a(p1, p2) * t * t + 2 * b(p1, p2) * t + c(p1);
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = at(t, x1, x2) - x;
      const d = slope(t, x1, x2);
      if (Math.abs(dx) < 1e-6 || d === 0) break;
      t -= dx / d;
    }
    return at(Math.min(1, Math.max(0, t)), y1, y2);
  };
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The part of the map the cards leave clear, in container pixels. A card hugging the left edge
// insets from the left; a bar across the top insets from the top.
export interface ClearArea {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function clearArea(map: L.Map, obstacles: (Element | null)[]): ClearArea {
  const size = map.getSize();
  const box = map.getContainer().getBoundingClientRect();
  const area = { left: 0, top: 0, right: size.x, bottom: size.y };
  for (const el of obstacles) {
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const left = r.left - box.left, right = r.right - box.left, top = r.top - box.top, bottom = r.bottom - box.top;
    if (left <= 0 && right < size.x * 0.7) area.left = Math.max(area.left, right);
    else if (top <= 0 && bottom < size.y * 0.6) area.top = Math.max(area.top, bottom);
    else if (bottom >= size.y && top > size.y * 0.4) area.bottom = Math.min(area.bottom, top);
  }
  return area;
}

// The map centre that puts latlng in the middle of the clear area at the given zoom
function centreFor(map: L.Map, latlng: L.LatLng, zoom: number, area: ClearArea): L.LatLng {
  const size = map.getSize();
  const offset = L.point((area.left + area.right) / 2 - size.x / 2, (area.top + area.bottom) / 2 - size.y / 2);
  return map.unproject(map.project(latlng, zoom).subtract(offset), zoom);
}

// True when latlng sits inside the clear area with margin to spare
export function comfortablyInView(map: L.Map, latlng: L.LatLng, area: ClearArea, margin = 48): boolean {
  const p = map.latLngToContainerPoint(latlng);
  return p.x >= area.left + margin && p.x <= area.right - margin && p.y >= area.top + margin && p.y <= area.bottom - margin;
}

// Moves the camera so latlng sits in the middle of the clear area. A move that leaves the view or
// changes zoom by a level or more flies; anything shorter glides.
export function moveCamera(map: L.Map, latlng: L.LatLngExpression, zoom: number, area: ClearArea) {
  const target = L.latLng(latlng);
  const centre = centreFor(map, target, zoom, area);
  if (reducedMotion()) {
    map.setView(centre, zoom, { animate: false });
    return;
  }
  const role = readRole();
  const onScreen = map.getBounds().contains(target);
  if (!onScreen || Math.abs(zoom - map.getZoom()) >= 1) fly(map, centre, zoom, role);
  else glide(map, centre, zoom, role);
}

function fly(map: L.Map, targetCenter: L.LatLng, targetZoom: number, role: CameraRole) {
  const m = map as unknown as MapInternals & L.Map;
  m._stop();

  const startZoom = m._zoom;
  const from = map.project(map.getCenter());
  const to = map.project(targetCenter);
  const size = map.getSize();
  const w0 = Math.max(size.x, size.y);
  const w1 = w0 * map.getZoomScale(startZoom, targetZoom);
  const u1 = to.distanceTo(from) || 1;
  const rho = role.curve;
  const rho2 = rho * rho;

  const r = (i: 0 | 1) => {
    const s1 = i ? -1 : 1;
    const s2 = i ? w1 : w0;
    const t1 = w1 * w1 - w0 * w0 + s1 * rho2 * rho2 * u1 * u1;
    const b = t1 / (2 * s2 * rho2 * u1);
    const sq = Math.sqrt(b * b + 1) - b;
    return sq < 1e-9 ? -18 : Math.log(sq);
  };
  const r0 = r(0);
  const w = (s: number) => w0 * (Math.cosh(r0) / Math.cosh(r0 + rho * s));
  const u = (s: number) => (w0 * (Math.cosh(r0) * Math.tanh(r0 + rho * s) - Math.sinh(r0))) / rho2;
  const S = (r(1) - r0) / rho;
  // MapLibre's flyTo duration at the role's speed, held inside the role's clamp
  const duration = Math.min(role.max, Math.max(role.min, (1000 * S) / role.speed));

  const start = performance.now();
  const frame = () => {
    const t = (performance.now() - start) / duration;
    if (t < 1) {
      m._flyToFrame = L.Util.requestAnimFrame(frame);
      const s = role.ease(t) * S;
      m._move(
        map.unproject(from.add(to.subtract(from).multiplyBy(u(s) / u1)), startZoom),
        map.getScaleZoom(w0 / w(s), startZoom),
        { flyTo: true },
      );
    } else {
      m._move(targetCenter, targetZoom)._moveEnd(true);
    }
  };
  m._moveStart(true);
  frame();
}

function glide(map: L.Map, targetCenter: L.LatLng, targetZoom: number, role: CameraRole) {
  const m = map as unknown as MapInternals & L.Map;
  m._stop();

  const startZoom = m._zoom;
  const from = map.project(map.getCenter(), startZoom);
  const to = map.project(targetCenter, startZoom);
  const start = performance.now();
  const frame = () => {
    const t = (performance.now() - start) / role.pan;
    if (t < 1) {
      m._flyToFrame = L.Util.requestAnimFrame(frame);
      const k = role.ease(t);
      m._move(map.unproject(from.add(to.subtract(from).multiplyBy(k)), startZoom), startZoom + (targetZoom - startZoom) * k, { flyTo: true });
    } else {
      m._move(targetCenter, targetZoom)._moveEnd(startZoom !== targetZoom);
    }
  };
  m._moveStart(startZoom !== targetZoom);
  frame();
}
