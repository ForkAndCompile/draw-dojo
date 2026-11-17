'use strict';
/* Shape helper: recognize a stroke (line, circle/oval, curve, arc),
   measure how close it is to the perfect shape, and correct it. */

const S = App.Shapes = {};
const TAU = Math.PI * 2;

/* ---------- geometry helpers ---------- */
function pathLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return L;
}
S.pathLength = pathLength;

/* Evenly spaced points along the stroke (keeps pressure). */
function resample(pts, n) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const L = cum[cum.length - 1];
  if (!L || pts.length < 2) return pts.map(p => ({ ...p }));
  const out = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const s = L * k / (n - 1);
    while (j < pts.length - 2 && cum[j + 1] < s) j++;
    const seg = cum[j + 1] - cum[j] || 1, f = App.util.clamp((s - cum[j]) / seg, 0, 1);
    const a = pts[j], b = pts[j + 1];
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, p: a.p + (b.p - a.p) * f });
  }
  return out;
}

function pca(pts) {
  let mx = 0, my = 0;
  for (const p of pts) { mx += p.x; my += p.y; }
  mx /= pts.length; my /= pts.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of pts) { const dx = p.x - mx, dy = p.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  return { mx, my, angle: 0.5 * Math.atan2(2 * sxy, sxx - syy) };
}

function linreg(xs, ys) {
  const n = xs.length;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
  mx /= n; my /= n;
  let cov = 0, v = 0;
  for (let i = 0; i < n; i++) { cov += (xs[i] - mx) * (ys[i] - my); v += (xs[i] - mx) ** 2; }
  const slope = v ? cov / v : 0;
  return [my - slope * mx, slope];
}

/* Algebraic circle fit (Kasa). */
function fitCircle(pts) {
  let mx = 0, my = 0;
  for (const p of pts) { mx += p.x; my += p.y; }
  mx /= pts.length; my /= pts.length;
  let suu = 0, svv = 0, suv = 0, su = 0, sv = 0, suz = 0, svz = 0, sz = 0;
  for (const p of pts) {
    const u = p.x - mx, v = p.y - my, z = u * u + v * v;
    suu += u * u; svv += v * v; suv += u * v; su += u; sv += v; suz += u * z; svz += v * z; sz += z;
  }
  const n = pts.length;
  const M = [[suu, suv, su], [suv, svv, sv], [su, sv, n]], r = [-suz, -svz, -sz];
  const det3 = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const d = det3(M);
  if (Math.abs(d) < 1e-9) return null;
  const col = (k) => M.map((row, i) => row.map((v, j) => (j === k ? r[i] : v)));
  const D = det3(col(0)) / d, E = det3(col(1)) / d, F = det3(col(2)) / d;
  const cu = -D / 2, cv = -E / 2, rr = cu * cu + cv * cv - F;
  if (rr <= 0) return null;
  return { cx: cu + mx, cy: cv + my, r: Math.sqrt(rr) };
}

function sweep(pts, cx, cy) {
  let prev = Math.atan2(pts[0].y - cy, pts[0].x - cx), total = 0;
  const angles = [prev];
  for (let i = 1; i < pts.length; i++) {
    const a = Math.atan2(pts[i].y - cy, pts[i].x - cx);
    let d = a - prev;
    if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
    total += d; prev = a; angles.push(angles[0] + total);
  }
  return { total, angles };
}

/* Ellipse fit: principal axes + a few rounds of least squares. */
function fitEllipse(pts) {
  const P = pca(pts), c = Math.cos(P.angle), s = Math.sin(P.angle);
  const U = pts.map(p => (p.x - P.mx) * c + (p.y - P.my) * s);
  const V = pts.map(p => -(p.x - P.mx) * s + (p.y - P.my) * c);
  let du = (Math.max(...U) + Math.min(...U)) / 2, dv = (Math.max(...V) + Math.min(...V)) / 2;
  let a = (Math.max(...U) - Math.min(...U)) / 2 || 1, b = (Math.max(...V) - Math.min(...V)) / 2 || 1;
  for (let it = 0; it < 5; it++) {
    const phi = U.map((u, i) => Math.atan2((V[i] - dv) / b, (u - du) / a));
    [du, a] = linreg(phi.map(Math.cos), U);
    [dv, b] = linreg(phi.map(Math.sin), V);
    a = Math.abs(a) || 1; b = Math.abs(b) || 1;
  }
  return { cx: P.mx + du * c - dv * s, cy: P.my + du * s + dv * c, a, b, angle: P.angle };
}

S.ellipsePoint = function (e, phi) {
  const c = Math.cos(e.angle), s = Math.sin(e.angle), u = e.a * Math.cos(phi), v = e.b * Math.sin(phi);
  return { x: e.cx + u * c - v * s, y: e.cy + u * s + v * c };
};
function ellipseLocal(e, p) {
  const c = Math.cos(e.angle), s = Math.sin(e.angle), dx = p.x - e.cx, dy = p.y - e.cy;
  return { u: dx * c + dy * s, v: -dx * s + dy * c };
}

/* Cubic Bezier with fixed ends, least-squares inner control points. */
function bez(P, t) {
  const m = 1 - t, b0 = m * m * m, b1 = 3 * m * m * t, b2 = 3 * m * t * t, b3 = t * t * t;
  return { x: b0 * P[0].x + b1 * P[1].x + b2 * P[2].x + b3 * P[3].x, y: b0 * P[0].y + b1 * P[1].y + b2 * P[2].y + b3 * P[3].y };
}
function bezD(P, t) {
  const m = 1 - t;
  return {
    x: 3 * m * m * (P[1].x - P[0].x) + 6 * m * t * (P[2].x - P[1].x) + 3 * t * t * (P[3].x - P[2].x),
    y: 3 * m * m * (P[1].y - P[0].y) + 6 * m * t * (P[2].y - P[1].y) + 3 * t * t * (P[3].y - P[2].y)
  };
}
function fitCubic(pts, us) {
  const P0 = pts[0], P3 = pts[pts.length - 1];
  let c11 = 0, c12 = 0, c22 = 0, x1 = 0, y1 = 0, x2 = 0, y2 = 0;
  pts.forEach((d, i) => {
    const t = us[i], m = 1 - t, b0 = m * m * m, b1 = 3 * m * m * t, b2 = 3 * m * t * t, b3 = t * t * t;
    const rx = d.x - b0 * P0.x - b3 * P3.x, ry = d.y - b0 * P0.y - b3 * P3.y;
    c11 += b1 * b1; c12 += b1 * b2; c22 += b2 * b2;
    x1 += b1 * rx; y1 += b1 * ry; x2 += b2 * rx; y2 += b2 * ry;
  });
  const det = c11 * c22 - c12 * c12;
  if (Math.abs(det) < 1e-12) return [P0, P0, P3, P3];
  return [P0, { x: (x1 * c22 - x2 * c12) / det, y: (y1 * c22 - y2 * c12) / det },
              { x: (c11 * x2 - c12 * x1) / det, y: (c11 * y2 - c12 * y1) / det }, P3];
}

/* ---------- ideal point sets (same length as the stroke) ---------- */
S.lineIdeal = function (pts, A, B) {
  const L = pathLength(pts);
  let s = 0;
  return pts.map((p, i) => {
    if (i) s += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    const f = L ? s / L : 0;
    return { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f };
  });
};

/* Points spread evenly around the ellipse, starting near the stroke's
   start and going the same way round. closed=true closes the loop. */
S.ellipseIdeal = function (pts, e, dir, closed, span) {
  const loc = ellipseLocal(e, pts[0]);
  const phi0 = Math.atan2(loc.v / e.b, loc.u / e.a);
  const total = closed ? TAU : Math.abs(span);
  const M = 720, poly = [], cum = [0];
  for (let k = 0; k <= M; k++) {
    poly.push(S.ellipsePoint(e, phi0 + dir * total * k / M));
    if (k) cum.push(cum[k - 1] + Math.hypot(poly[k].x - poly[k - 1].x, poly[k].y - poly[k - 1].y));
  }
  const PL = cum[M], L = pathLength(pts);
  let s = 0, j = 0;
  return pts.map((p, i) => {
    if (i) s += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    const target = (L ? s / L : 0) * PL;
    while (j < M - 1 && cum[j + 1] < target) j++;
    const f = App.util.clamp((target - cum[j]) / ((cum[j + 1] - cum[j]) || 1), 0, 1);
    return { x: poly[j].x + (poly[j + 1].x - poly[j].x) * f, y: poly[j].y + (poly[j + 1].y - poly[j].y) * f };
  });
};

function smoothIdeal(pts, passes) {
  let a = pts.map(p => ({ x: p.x, y: p.y }));
  for (let k = 0; k < passes; k++) {
    const b = a.map(p => ({ ...p }));
    for (let i = 1; i < a.length - 1; i++) {
      b[i].x = (a[i - 1].x + 2 * a[i].x + a[i + 1].x) / 4;
      b[i].y = (a[i - 1].y + 2 * a[i].y + a[i + 1].y) / 4;
    }
    a = b;
  }
  return a;
}

/* ---------- straight-edged shapes: triangles, boxes, polygons, zig-zags ---------- */
const DEG = Math.PI / 180;
const dirOf = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const turnOf = (a1, a2) => { const d = Math.abs(a2 - a1) % TAU; return d > Math.PI ? TAU - d : d; };
const lineAngle = (a1, a2) => { const d = Math.abs(a1 - a2) % Math.PI; return Math.min(d, Math.PI - d); };

/* Douglas-Peucker: keep the points where the line really changes direction. */
function dpIndices(pts, eps) {
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); if (b - a < 2) continue;
    const A = pts[a], B = pts[b], dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy);
    let md = -1, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = l > 1e-6 ? Math.abs((pts[i].x - A.x) * dy - (pts[i].y - A.y) * dx) / l : Math.hypot(pts[i].x - A.x, pts[i].y - A.y);
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  const out = []; keep.forEach((k, i) => { if (k) out.push(i); }); return out;
}

function fitEdge(pts, ranges) {   // line through the middle of each side (corners trimmed)
  const sel = [];
  for (const [a, b] of ranges) { const k = Math.floor((b - a) * 0.12); for (let i = a + k; i <= b - k; i++) sel.push(pts[i]); }
  const P = pca(sel.length >= 2 ? sel : ranges.flatMap(([a, b]) => [pts[a], pts[b]]));
  return { x: P.mx, y: P.my, a: P.angle };
}
function intersect(e1, e2, fallback) {
  const c1 = Math.cos(e1.a), s1 = Math.sin(e1.a), c2 = Math.cos(e2.a), s2 = Math.sin(e2.a);
  const den = c1 * s2 - s1 * c2;
  if (Math.abs(den) < 0.17) return { x: fallback.x, y: fallback.y };
  const t = ((e2.x - e1.x) * s2 - (e2.y - e1.y) * c2) / den;
  return { x: e1.x + c1 * t, y: e1.y + s1 * t };
}
function project(p, e) {
  const c = Math.cos(e.a), s = Math.sin(e.a), t = (p.x - e.x) * c + (p.y - e.y) * s;
  return { x: e.x + c * t, y: e.y + s * t };
}

/* Split the stroke into straight sides. Returns null if it isn't made of sides. */
function fitPoly(pts, closed, D) {
  const n = pts.length;
  const idx = dpIndices(pts, D * 0.04);
  for (;;) {   // drop "corners" where the line hardly turns
    let worst = -1, wt = Infinity;
    for (let k = 1; k < idx.length - 1; k++) {
      const t = turnOf(dirOf(pts[idx[k - 1]], pts[idx[k]]), dirOf(pts[idx[k]], pts[idx[k + 1]]));
      if (t < wt) { wt = t; worst = k; }
    }
    if (worst < 0 || wt > 25 * DEG) break;
    idx.splice(worst, 1);
  }
  const corners = idx.slice(1, -1), m = corners.length;
  if (!m) return null;
  // every corner must be sharp: the direction changes quickly, not gradually like a circle
  const w = Math.max(2, Math.round(n * 0.025));
  for (const ci of corners) {
    const a = pts[Math.max(0, ci - w)], b = pts[ci], c = pts[Math.min(n - 1, ci + w)];
    if (turnOf(dirOf(a, b), dirOf(b, c)) < 32 * DEG) return null;
  }
  let startCorner = false;
  if (closed) startCorner = turnOf(dirOf(pts[corners[m - 1]], pts[n - 1]), dirOf(pts[0], pts[corners[0]])) > 25 * DEG;
  const pieces = []; let prev = 0;
  for (const ci of corners) { pieces.push([prev, ci]); prev = ci; }
  pieces.push([prev, n - 1]);
  const P = pieces.length;
  const merged = closed && !startCorner;
  const edgeOf = k => (merged && k === P - 1 ? 0 : k);
  const nE = merged ? P - 1 : P;
  if (closed ? (nE < 3 || nE > 12) : (nE < 2 || nE > 8)) return null;
  const edges = [];
  for (let e = 0; e < nE; e++) edges.push(fitEdge(pts, pieces.filter((_, k) => edgeOf(k) === e)));
  return { closed, startCorner, merged, pieces, edgeOf, edges, corners };
}

/* Make edges perfect: level/upright edges, right-angled boxes, squares. */
function regularizeEdges(fp) {
  const E = fp.edges;
  for (const e of E) {   // nearly level or upright -> exactly
    const r = ((e.a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
    if (r < 5 * DEG) e.a -= r; else if (Math.PI / 2 - r < 5 * DEG) e.a += Math.PI / 2 - r;
  }
  if (!(fp.closed && E.length === 4)) return null;
  for (let k = 0; k < 4; k++) if (lineAngle(E[k].a, E[(k + 1) % 4].a) < 72 * DEG) return null;
  let sx = 0, sy = 0;
  for (const e of E) { sx += Math.cos(4 * e.a); sy += Math.sin(4 * e.a); }
  let th = Math.atan2(sy, sx) / 4;
  const r = ((th % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
  if (r < 5 * DEG) th -= r; else if (Math.PI / 2 - r < 5 * DEG) th += Math.PI / 2 - r;
  for (const e of E) e.a = lineAngle(e.a, th) < lineAngle(e.a, th + Math.PI / 2) ? th : th + Math.PI / 2;
  // square? make both pairs of sides the same distance apart
  const sep = (i, j) => { const nx = -Math.sin(E[i].a), ny = Math.cos(E[i].a); return [(E[i].x * nx + E[i].y * ny), (E[j].x * nx + E[j].y * ny), nx, ny]; };
  const [d0, d2, n0x, n0y] = sep(0, 2), [d1, d3, n1x, n1y] = sep(1, 3);
  const s02 = Math.abs(d0 - d2), s13 = Math.abs(d1 - d3);
  if (Math.abs(s02 - s13) / Math.max(s02, s13) > 0.12) return 'rectangle';
  const s = (s02 + s13) / 2;
  const fix = (i, j, di, dj, nx, ny) => {
    const mid = (di + dj) / 2, ni = mid + Math.sign(di - dj) * s / 2, nj = mid + Math.sign(dj - di) * s / 2;
    E[i].x += (ni - di) * nx; E[i].y += (ni - di) * ny; E[j].x += (nj - dj) * nx; E[j].y += (nj - dj) * ny;
  };
  fix(0, 2, d0, d2, n0x, n0y); fix(1, 3, d1, d3, n1x, n1y);
  return 'square';
}

/* Snap a nearly regular triangle / pentagon / hexagon... to a perfect one. */
function regularizeVerts(V) {
  const n = V.length;
  if (n < 3 || n > 8 || n === 4) return false;
  const side = V.map((v, i) => Math.hypot(V[(i + 1) % n].x - v.x, V[(i + 1) % n].y - v.y));
  const mean = side.reduce((a, b) => a + b, 0) / n;
  if ((Math.max(...side) - Math.min(...side)) / mean > 0.16) return false;
  let area = 0;
  for (let i = 0; i < n; i++) area += V[i].x * V[(i + 1) % n].y - V[(i + 1) % n].x * V[i].y;
  const dir = Math.sign(area) || 1;
  const cx = V.reduce((a, v) => a + v.x, 0) / n, cy = V.reduce((a, v) => a + v.y, 0) / n;
  const R = V.reduce((a, v) => a + Math.hypot(v.x - cx, v.y - cy), 0) / n;
  let a0 = Math.atan2(V[0].y - cy, V[0].x - cx);
  const at = k => a0 + dir * TAU * k / n;
  // turn it so the side closest to level becomes exactly level
  let best = Infinity, fixA = 0;
  for (let k = 0; k < n; k++) {
    const ea = Math.atan2(Math.sin(at(k + 1)) - Math.sin(at(k)), Math.cos(at(k + 1)) - Math.cos(at(k)));
    const off = ((ea % Math.PI) + Math.PI * 1.5) % Math.PI - Math.PI / 2;
    if (Math.abs(off) < Math.abs(best)) { best = off; fixA = -off; }
  }
  if (Math.abs(best) < 7 * DEG) a0 += fixA;
  for (let k = 0; k < n; k++) V[k] = { x: cx + R * Math.cos(at(k)), y: cy + R * Math.sin(at(k)) };
  return true;
}

/* Turn a fitted set of sides into a result: corner points, ideal points, score. */
function makePoly(pts, fp, D, regular) {
  const n = pts.length, P = fp.pieces.length, E = fp.edges.map(e => ({ ...e }));
  const local = { ...fp, edges: E };
  let kind = null;
  if (regular) kind = regularizeEdges(local);
  const near = (q, raw) => (Math.hypot(q.x - raw.x, q.y - raw.y) > D * 0.25 ? { x: raw.x, y: raw.y } : q);
  const cornerV = fp.corners.map((ci, k) => near(intersect(E[fp.edgeOf(k)], E[fp.edgeOf(k + 1)], pts[ci]), pts[ci]));
  let verts, nodes;
  if (!fp.closed) {
    const s = project(pts[0], E[fp.edgeOf(0)]), e = project(pts[n - 1], E[fp.edgeOf(P - 1)]);
    verts = [s, ...cornerV, e]; nodes = verts;
  } else if (fp.startCorner) {
    const v0 = near(intersect(E[fp.edgeOf(P - 1)], E[fp.edgeOf(0)], pts[0]), pts[0]);
    verts = [v0, ...cornerV];
    if (regular && !kind && regularizeVerts(verts)) kind = 'regular';
    nodes = [...verts, verts[0]];
  } else {
    verts = cornerV;
    if (regular && !kind && regularizeVerts(verts)) kind = 'regular';
    const a = verts[verts.length - 1], b = verts[0];
    const mid = { x: (pts[0].x + pts[n - 1].x) / 2, y: (pts[0].y + pts[n - 1].y) / 2 };
    const s = project(mid, { x: a.x, y: a.y, a: dirOf(a, b) });
    nodes = [s, ...verts, s];
  }
  // ideal: each piece of the stroke slides onto its side, corner to corner
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const ideal = new Array(n);
  let sq = 0;
  fp.pieces.forEach(([a, b], k) => {
    const A = nodes[k], B = nodes[k + 1], len = cum[b] - cum[a] || 1;
    for (let i = a; i <= b; i++) {
      const f = (cum[i] - cum[a]) / len;
      ideal[i] = { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f };
    }
  });
  // score: how far each point is from the nearest side (sliding along a side doesn't count)
  const segs = fp.closed ? verts.map((v, i) => [v, verts[(i + 1) % verts.length]]) : verts.slice(1).map((v, i) => [verts[i], v]);
  for (const p of pts) {
    let best = Infinity;
    for (const [a, b] of segs) {
      const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
      const t = l2 ? App.util.clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2, 0, 1) : 0;
      best = Math.min(best, (p.x - a.x - dx * t) ** 2 + (p.y - a.y - dy * t) ** 2);
    }
    sq += best;
  }
  const rms = Math.sqrt(sq / n), sides = fp.closed ? verts.length : verts.length - 1;
  const type = !fp.closed ? 'polyline' : kind === 'square' ? 'square' : kind === 'rectangle' ? 'rectangle' : sides === 3 ? 'triangle' : 'polygon';
  return { type, sides, pts, ideal, rms, score: 1 - (rms / D) * 22, geom: { kind: 'poly', verts, closed: fp.closed } };
}

/* ---------- main analysis ---------- */
S.analyze = function (raw, fix = App.settings.fix) {
  const L = pathLength(raw);
  if (!Number.isFinite(L)) return { type: 'free', pts: raw, ideal: raw.map(p => ({ x: p.x, y: p.y })), score: null };
  const n = App.util.clamp(Math.round(L / (1.5 * App.unit)), 8, 600);
  const pts = resample(raw, n);
  const free = { type: 'free', pts, ideal: smoothIdeal(pts, 6), score: null };
  if (L < 14 * App.unit || raw.length < 4) return { ...free, ideal: pts.map(p => ({ x: p.x, y: p.y })) };

  const first = pts[0], last = pts[n - 1];
  const chord = Math.hypot(last.x - first.x, last.y - first.y);

  // 1. straight line?
  const P = pca(pts), c = Math.cos(P.angle), s = Math.sin(P.angle);
  let tmin = Infinity, tmax = -Infinity, sq = 0, maxDev = 0;
  for (const p of pts) {
    const t = (p.x - P.mx) * c + (p.y - P.my) * s, d = -(p.x - P.mx) * s + (p.y - P.my) * c;
    tmin = Math.min(tmin, t); tmax = Math.max(tmax, t); sq += d * d; maxDev = Math.max(maxDev, Math.abs(d));
  }
  const len = tmax - tmin, rms = Math.sqrt(sq / n);
  if (chord / L > 0.9 && maxDev / len < 0.045) {
    if (!fix.line) return free;
    // endpoints in drawing order, projected onto the fitted line
    const tf = (first.x - P.mx) * c + (first.y - P.my) * s;
    const [ta, tb] = tf < (tmin + tmax) / 2 ? [tmin, tmax] : [tmax, tmin];
    const A = { x: P.mx + ta * c, y: P.my + ta * s }, B = { x: P.mx + tb * c, y: P.my + tb * s };
    return S.makeLine(pts, A, B, 1 - (rms / len) * 12);
  }

  // 2. closed? then: straight-sided shape, circle / oval, or freehand blob
  const circ = fitCircle(pts);
  const sw = circ ? sweep(pts, circ.cx, circ.cy) : { total: 0 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const D = Math.hypot(x1 - x0, y1 - y0) || 1;
  const closed = Math.abs(sw.total) >= 1.6 * Math.PI || chord < 0.06 * L;
  const fpoly = fix.shapes !== false ? fitPoly(pts, closed, D) : null;
  const poly = fpoly ? makePoly(pts, fpoly, D, false) : null;   // how well straight sides fit
  const polyOk = !!poly && poly.rms / D < 0.03;
  const asPoly = () => makePoly(pts, fpoly, D, true);           // the perfect version

  if (closed) {
    const e = fitEllipse(pts), avgR = (e.a + e.b) / 2;
    let err = 0, sqE = 0;
    for (const p of pts) { const q = ellipseLocal(e, p); const d = Math.abs(Math.hypot(q.u / e.a, q.v / e.b) - 1); err += d; sqE += (d * avgR) ** 2; }
    err /= n;
    if (polyOk && poly.rms < 0.6 * Math.sqrt(sqE / n)) return asPoly();
    if (err < 0.14 && fix.ellipse) {
      const round = Math.min(e.a, e.b) / Math.max(e.a, e.b) > 0.88;
      if (round) { const r = (e.a + e.b) / 2; e.a = e.b = r; }
      // measure again against the final (maybe rounder) shape
      let err2 = 0;
      for (const p of pts) { const q = ellipseLocal(e, p); err2 += Math.abs(Math.hypot(q.u / e.a, q.v / e.b) - 1); }
      err2 /= n;
      return S.makeEllipse(pts, e, Math.sign(sw.total), true, TAU, 1 - err2 * 4.5, round ? 'circle' : 'ellipse');
    }
    if (polyOk) return asPoly();
    return { ...free, closed: true };
  }

  // 3. smooth curve (one cubic)?
  if (fix.curve) {
    let us = []; { let acc = 0; pts.forEach((p, i) => { if (i) acc += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y); us.push(acc / L); }); }
    let B = fitCubic(pts, us);
    for (let it = 0; it < 3; it++) {
      us = us.map((u, i) => {
        if (i === 0 || i === n - 1) return u;
        const q = bez(B, u), d = bezD(B, u);
        const dd = d.x * d.x + d.y * d.y;
        return dd ? App.util.clamp(u - ((q.x - pts[i].x) * d.x + (q.y - pts[i].y) * d.y) / dd, 0, 1) : u;
      });
      B = fitCubic(pts, us);
    }
    let cs = 0, cmax = 0;
    const ideal = us.map((u, i) => { const q = bez(B, u); const d = Math.hypot(q.x - pts[i].x, q.y - pts[i].y); cs += d * d; cmax = Math.max(cmax, d); return q; });
    const crms = Math.sqrt(cs / n);
    const curveOk = cmax / L < 0.045 && crms / L < 0.02;
    // corners (an L, a zig-zag) beat one smooth curve when they fit much better
    if (polyOk && (!curveOk || poly.rms < 0.5 * crms)) return asPoly();
    if (curveOk) {
      return { type: 'curve', pts, ideal, score: 1 - (crms / L) * 25, geom: { kind: 'bezier', P: B } };
    }
    // 4. circular arc?
    if (circ && Math.abs(sw.total) > 0.9 * Math.PI) {
      let ae = 0;
      for (const p of pts) ae += Math.abs(Math.hypot(p.x - circ.cx, p.y - circ.cy) - circ.r);
      ae /= n * circ.r;
      if (ae < 0.05) {
        const e = { cx: circ.cx, cy: circ.cy, a: circ.r, b: circ.r, angle: 0 };
        return S.makeEllipse(pts, e, Math.sign(sw.total), false, sw.total, 1 - ae * 4.5, 'arc');
      }
    }
  }
  if (polyOk) return asPoly();
  return free;
};

S.makeLine = function (pts, A, B, score) {
  return { type: 'line', pts, ideal: S.lineIdeal(pts, A, B), score, geom: { kind: 'line', A, B } };
};
S.makeEllipse = function (pts, e, dir, closed, span, score, type) {
  const loc = ellipseLocal(e, pts[0]);
  const phi0 = Math.atan2(loc.v / e.b, loc.u / e.a);
  return { type, pts, ideal: S.ellipseIdeal(pts, e, dir || 1, closed, span), score,
           geom: { kind: 'ellipse', e, closed, dir: dir || 1, span, phi0 } };
};

/* Straighten near-horizontal / near-vertical lines when Assist is high. */
S.levelLine = function (res, t) {
  if (res.type !== 'line' || t < 0.7) return res;
  const { A, B } = res.geom;
  const ang = Math.atan2(B.y - A.y, B.x - A.x), deg = Math.abs((ang * 180 / Math.PI) % 90);
  if (Math.min(deg, 90 - deg) > 3) return res;
  const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, half = Math.hypot(B.x - A.x, B.y - A.y) / 2;
  const snapped = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2);
  const A2 = { x: mx - Math.cos(snapped) * half, y: my - Math.sin(snapped) * half };
  const B2 = { x: mx + Math.cos(snapped) * half, y: my + Math.sin(snapped) * half };
  return { ...S.makeLine(res.pts, A2, B2, res.score), leveled: true };
};

/* Move the stroke toward its ideal shape by t (0..1). */
S.correct = function (res, t) {
  const k = res.type === 'free' ? t * 0.6 : t;
  return res.pts.map((p, i) => ({
    x: p.x + (res.ideal[i].x - p.x) * k,
    y: p.y + (res.ideal[i].y - p.y) * k,
    p: p.p
  }));
};

S.label = function (res) {
  if (res.type === 'polygon') return `clean ${res.sides}-sided shape`;
  return { line: 'straight', circle: 'round', ellipse: 'smooth oval', curve: 'smooth curve', arc: 'smooth arc',
           triangle: 'clean triangle', rectangle: 'clean rectangle', square: 'clean square', polyline: 'clean corners' }[res.type] || '';
};

/* Path of the perfect shape, for drawing the ghost. */
S.geomPath = function (ctx, g) {
  ctx.beginPath();
  if (g.kind === 'line') { ctx.moveTo(g.A.x, g.A.y); ctx.lineTo(g.B.x, g.B.y); }
  else if (g.kind === 'poly') {
    g.verts.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y)));
    if (g.closed) ctx.closePath();
  }
  else if (g.kind === 'bezier') { ctx.moveTo(g.P[0].x, g.P[0].y); ctx.bezierCurveTo(g.P[1].x, g.P[1].y, g.P[2].x, g.P[2].y, g.P[3].x, g.P[3].y); }
  else if (g.kind === 'ellipse') {
    if (g.closed) ctx.ellipse(g.e.cx, g.e.cy, g.e.a, g.e.b, g.e.angle, 0, TAU);
    else {
      const N = 90;
      for (let k = 0; k <= N; k++) {
        const q = S.ellipsePoint(g.e, g.phi0 + g.dir * Math.abs(g.span) * k / N);
        k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
      }
    }
  }
};
