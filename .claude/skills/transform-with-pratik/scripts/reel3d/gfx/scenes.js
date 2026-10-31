// Scene definitions. Each: (E, A, t, d, c, ctx) -> renders 3D via E.render(t) then draws scene HUD.
'use strict';
function buildAssets(E) {
  const A = { F: buildFood(E), G: buildFigure(E), I: buildIcons(E) };
  A.plane = E.mesh('plane', () => GEO.plane(60, 60));
  A.box = E.mesh('rbox', () => GEO.roundBox(1, 1, 1, 0.12, 4));
  A.disc = A.F.disc; A.sph = A.F.sph; A.sphLo = A.F.sphLo;
  A.panel = E.mesh('panel', () => GEO.roundBox(1, 1, 1, 0.04, 3));
  A.capU = E.mesh('capU', () => GEO.capsule(1, 1, 16));
  A.rod = E.mesh('rod', () => GEO.cylinder(1, 1, 1, 16));
  A.rays = E.mesh('rays', () => {
    const pos = [0, 0, 0], idx = []; const n = 18;
    for (let i = 0; i < n; i++) { const a0 = i / n * PI * 2, a1 = a0 + PI / n * 0.6; pos.push(Math.cos(a0), Math.sin(a0), 0, Math.cos(a1), Math.sin(a1), 0); idx.push(0, 1 + i * 2, 2 + i * 2); }
    const nrm = new Float32Array(pos.length); for (let i = 0; i < nrm.length; i += 3) nrm[i + 2] = 1;
    return { pos: new Float32Array(pos), nrm, idx: new Uint32Array(idx) };
  });
  A.graphHi = buildGraph(E, 'gHi', 2.9, 1.2, 1.0);
  A.graphLo = buildGraph(E, 'gLo', 2.9, 1.2, 0.5);
  A.graphS = buildGraph(E, 'gS', 2.0, 0.95, 1.0);
  // leg hologram + muscle
  A.legHolo = E.mesh('legHolo', () => { const pr = []; for (let i = 0; i <= 24; i++) { const y = -1.7 + 3.4 * i / 24; const tt = i / 24; pr.push([0.5 + 0.17 * Math.pow(tt, 0.8) - 0.05 * Math.sin(tt * PI), y]); } pr.unshift([0, -1.7]); pr.push([0, 1.7]); return GEO.lathe(pr, 48); });
  A.fiber = E.mesh('fiber', () => GEO.tube(Array.from({ length: 40 }, (_, i) => { const t = i / 39; return [0.03 * Math.sin(t * PI * 1.3), -1.05 + 2.1 * t, 0.04 * Math.sin(t * PI)]; }), 0.15, 14, t => 0.12 + 0.88 * Math.pow(Math.sin(PI * t), 0.75)));
  A.bone = E.mesh('bone', () => GEO.capsule(0.085, 2.9, 16));
  A.vessel = E.mesh('vessel', () => GEO.tube(Array.from({ length: 50 }, (_, i) => vesselPt(i / 49)), 0.085, 14));
  A.couch = { base: E.mesh('cb', () => GEO.roundBox(2.1, 0.36, 0.95, 0.08, 4)), seat: E.mesh('cs', () => GEO.roundBox(1.0, 0.2, 0.86, 0.09, 4)), back: E.mesh('cbk', () => GEO.roundBox(2.1, 0.72, 0.26, 0.11, 4)), arm: E.mesh('ca', () => GEO.roundBox(0.26, 0.56, 0.95, 0.11, 4)) };
  A.ring = E.mesh('tring', () => GEO.torus(0.62, 0.06, PI * 2, 120, 14, PI / 2));
  A.ringBg = E.mesh('tringbg', () => GEO.torus(0.62, 0.045, PI * 2, 120, 10));
  A.gauge = [0, 1, 2].map(k => E.mesh('gauge' + k, () => GEO.torus(0.75, 0.085, PI / 3 - 0.04, 40, 12, PI - (k + 1) * PI / 3 + 0.02)));
  return A;
}
function vesselPt(s) { return [0.78 + 0.08 * Math.sin(s * PI * 2.2), 1.85 - 3.7 * s, 0.25 + 0.06 * Math.cos(s * PI * 1.7)]; }
const MAT = {
  clay: { color: [0.66, 0.68, 0.74], rough: 0.5, rim: 0.4, rimCol: [0.35, 0.8, 1.0] },
  holo: { mode: 1, color: [0.25, 0.85, 1.0] },
  red: { color: [0.95, 0.12, 0.16], rough: 0.22, emis: [0.18, 0.0, 0.01], rim: 0.6, rimCol: [1, 0.4, 0.4] },
  green: { color: [0.2, 0.85, 0.36], rough: 0.22, emis: [0.0, 0.14, 0.03], rim: 0.6, rimCol: [0.6, 1, 0.7] },
  gold: { color: [1.0, 0.76, 0.2], rough: 0.2, metal: 0.65, emis: [0.12, 0.07, 0.0], rim: 0.5, rimCol: [1, 0.85, 0.4] },
  glu: { mode: 2, color: [1.0, 0.72, 0.15], emis: [1.4, 0.95, 0.25] },
};
function floor(E, A, col = [0.06, 0.055, 0.06], grid = 0) {
  E.add(A.plane, M4.I(), { color: col, rough: 0.6, pat: grid ? 3 : 0, rimCol: E.grid.col, bgLayer: true }, M4.T(0, 0, 0));
}
function shake(t, t0, amp = 0.05, dur = 0.25) { const k = clamp(1 - (t - t0) / dur) * (t >= t0 ? 1 : 0); return [Math.sin(t * 90) * amp * k, Math.cos(t * 77) * amp * k, 0]; }

const SCENES = {};

// 1. Carb meal -> glucose rises
SCENES.meal = (E, A, t, d, c, ctx) => {
  const cCarb = c.carb ?? d * 0.35, cRise = c.rise ?? d * 0.62; E.bloomThr = 0.82;
  E.light.dir = V3.norm([-0.55, 1.0, 0.5]); E.light.box = 2.0; E.light.center = [0, 0.2, 0];
  E.bg.glow = [0.24, 0.16, 0.04]; E.bg.glowP = [0.5, 0.58]; E.bg.glowR = 0.38; E.fog = { n: 7, f: 14 };
  const rp = easeInOut((t - cRise + 0.15) / 1.1);
  const orbit = -0.42 + 0.07 * t;
  const dist = lerp(4.25, 6.3, rp), h = lerp(2.75, 2.1, rp);
  E.cam.eye = [Math.sin(orbit) * dist, h, Math.cos(orbit) * dist]; E.cam.at = [0, lerp(0.0, 1.05, rp), lerp(0.1, -0.2, rp)]; E.cam.fov = 44;
  floor(E, A, [0.08, 0.055, 0.04]);
  const drop = easeOut(t / 0.42);
  const M = M4.chain(M4.T(0, (1 - drop) * 1.2, 0), M4.RY(0.2));
  const pop = [0, 1, 2, 3].map(k => clamp((t - 0.22 - 0.11 * k) / 0.38));
  const glow = t > cCarb ? (0.55 + 0.45 * Math.sin((t - cCarb) * 9)) * clamp((t - cCarb) / 0.2) * clamp(1 - (t - cRise - 0.6) / 0.5) : 0;
  drawThali(E, A.F, M, { pop, carbGlow: glow });
  const gC = [0, 1.95, -0.6];
  const gM = M4.chain(M4.T(...gC), M4.RY(orbit * 0.9), M4.S(lerp(0.5, 1, easeOut(rp))));
  // glucose molecules rising
  const src = [M4.apply(M, [-0.33, 0.28, 0.22]), M4.apply(M, [0.42, 0.08, 0.36])];
  const parts = [];
  if (t > cRise - 0.25) {
    const r = rng(5);
    for (let i = 0; i < 26; i++) {
      const t0 = cRise - 0.25 + i * 0.05 + r() * 0.05, dur = 0.9 + r() * 0.4; const u = (t - t0) / dur; const rx = r(), ry = r(); if (u < 0 || u > 1) continue;
      const s = src[i % 2]; const tgt = M4.apply(gM, [(rx - 0.5) * 1.8, (ry - 0.5) * 0.8, 0.1]);
      const e = easeInOut(u); const p = V3.lerp(s, tgt, e); p[1] += Math.sin(u * PI) * 0.2; p[0] += Math.sin(u * 6 + i) * 0.05;
      const sc = 0.05 * Math.sin(Math.min(1, u * 1.3) * PI) + 0.01;
      parts.push({ m: M4.chain(M4.T(...p), M4.RY(t * 2 + i), M4.RX(t * 1.3 + i), M4.S(sc)), c: [1, 1, 1, 1] });
    }
  }
  if (parts.length) E.add(A.I.hex, parts, { ...MAT.glu });
  // graph
  const gp = clamp((t - cRise - 0.05) / 1.0);
  if (rp > 0.02) {
    E.add(A.panel, M4.chain(M4.T(0, 0, -0.05), M4.S(2.3, 1.3, 0.04)), { color: [0.05, 0.055, 0.07], rough: 0.35, opacity: 0.8 * rp, noShadow: true }, gM);
    E.add(A.rod, [{ m: M4.chain(M4.T(-1.02, -0.52, 0), M4.RZ(-PI / 2), M4.S(0.008, 2.04, 0.008)), c: [0.6, 0.6, 0.65, 1] }, { m: M4.chain(M4.T(-1.02, -0.52, 0), M4.S(0.008, 1.07, 0.008)), c: [0.6, 0.6, 0.65, 1] }], { mode: 2, opacity: rp }, gM);
    const n = 120; const seg = Math.floor(gp * n);
    if (seg > 0) {
      E.add(A.graphS, M4.T(0, -0.02, 0.01), { mode: 2, color: [1.0, 0.36, 0.12], emis: [1.5, 0.42, 0.08], range: seg * A.graphS.stride }, gM);
      const hp = graphPoint(gp, 2.0, 0.95, 1.0);
      E.add(A.sph, M4.chain(M4.T(hp[0], hp[1] - 0.02, 0.01), M4.S(0.055)), { mode: 2, color: [1, 0.8, 0.5], emis: [2, 1.2, 0.5] }, gM);
    }
  }
  E.render(t);
  // HUD
  const lab = (k, p3, txt, carb) => {
    const a = clamp((t - 0.55 - 0.1 * k) / 0.2) * (1 - clamp(rp * 2)); if (a <= 0) return;
    const [x, y] = E.project(M4.apply(M, p3));
    const isC = carb && t > cCarb;
    chip(ctx, isC ? txt + ' · CARBS' : txt, x, y - 60, { size: 34, alpha: a, scale: popIn(t - 0.55 - 0.1 * k) * (isC ? 1 + 0.12 * clamp(1 - (t - cCarb) / 0.25) : 1), bg: isC ? BRAND_Y : '#fff', fg: '#111' });
  };
  lab(0, [-0.33, 0.33, 0.22], 'CHAWAL', true); lab(1, [0.36, 0.3, -0.42], 'DAL'); lab(2, [-0.36, 0.3, -0.5], 'SABZI'); lab(3, [0.42, 0.1, 0.36], 'ROTI', true);
  if (rp < 0.5) drawRich(ctx, '*CARB-RICH* MEAL', 540, 300, { size: 92, alpha: clamp(t / 0.2) * clamp((cRise - t + 0.1) / 0.2), scale: popIn(t - 0.05) });
  if (rp > 0.3) {
    const a = clamp((rp - 0.3) / 0.3);
    drawRich(ctx, 'BLOOD GLUCOSE *RISES*', 540, 250, { size: 76, alpha: a, scale: popIn(t - cRise - 0.25) });
    if (gp > 0.3) { const pk = E.project(M4.apply(gM, graphPoint(0.33, 2.0, 0.95, 1.0))); chip(ctx, 'SPIKE', pk[0] + 150, pk[1] - 20, { size: 34, scale: popIn(t - cRise - 0.4), bg: '#ff5a3c', fg: '#fff' }); arrow(ctx, pk[0] + 150, pk[1] + 100, 120, -1, BRAND_Y, clamp((gp - 0.3) / 0.15), 20); }
  }
};

// 2. Curiosity
SCENES.curious = (E, A, t, d, c, ctx) => {
  E.light.dir = V3.norm([-0.4, 0.8, 1.0]); E.light.box = 2; E.light.center = [0, 0, 0];
  E.bg.c0 = [0.02, 0.02, 0.035]; E.bg.c1 = [0.06, 0.05, 0.08]; E.bg.glow = [0.32, 0.22, 0.05]; E.bg.glowP = [0.5, 0.58]; E.bg.glowR = 0.3 + 0.03 * Math.sin(t * 4);
  E.cam.eye = [0, 0.15, lerp(3.6, 3.1, easeOut(t / d))]; E.cam.at = [0, 0.15, 0]; E.cam.fov = 40;
  const s = easeElastic(t / 0.7) * 0.82; const ry = -PI * 2 * (1 - easeOut(t / 0.75)) + 0.35 * Math.sin(t * 2.2);
  const bob = 0.04 * Math.sin(t * 3);
  E.add(A.rays, M4.chain(M4.T(0, 0.15, -1.2), M4.RZ(t * 0.4), M4.S(3.2)), { mode: 2, color: [0.35, 0.25, 0.05], opacity: 0.5 * clamp(t / 0.4), additive: true, noDepth: true });
  drawQ(E, A.I, M4.chain(M4.T(0, 0.18 + bob, 0), M4.RY(ry), M4.S(s)), MAT.gold);
  // sparkles
  const r = rng(9); const sp = [];
  for (let i = 0; i < 40; i++) { const a = r() * PI * 2, b = (r() - 0.5) * PI, sp0 = 0.9 + r() * 1.4; const u = clamp((t - 0.18) / (0.7 + r() * 0.5)); const R = sp0 * easeOut(u);
    const sc = 0.03 * (1 - u) * (u > 0 ? 1 : 0); if (sc <= 0.001) continue;
    sp.push({ m: M4.chain(M4.T(Math.cos(a) * Math.cos(b) * R, 0.15 + Math.sin(b) * R, Math.sin(a) * Math.cos(b) * R * 0.5), M4.S(sc)), c: [1, 1, 1, 1] }); }
  if (sp.length) E.add(A.sphLo, sp, { mode: 2, color: [1, 0.85, 0.4], emis: [2, 1.5, 0.6] });
  E.chrom = 0.012 * clamp(1 - t / 0.25); E.zoom = 1 + 0.06 * clamp(1 - t / 0.3);
  E.render(t);
};

// 3. Walking -> smaller spike
SCENES.walk = (E, A, t, d, c, ctx) => {
  const cRed = c.red ?? 0.1, cWalk = c.reduce ?? d * 0.45;
  E.light.dir = V3.norm([-0.4, 1.0, 0.7]); E.light.box = 3; E.light.center = [0, 1, 0];
  E.bg.glow = [0.06, 0.15, 0.2]; E.bg.glowP = [0.5, 0.7]; E.bg.glowR = 0.4; E.fog = { n: 9, f: 22 };
  E.grid.k = 1.4; E.grid.glow = 0.9; E.grid.col = [0.25, 0.8, 1.0]; E.grid.scroll = [-t * 1.4 * 1.4, 0];
  E.cam.eye = [2.8 - 0.15 * t, 2.2, 11.0]; E.cam.at = [0, 0.96, 0]; E.cam.fov = 42;
  floor(E, A, [0.05, 0.05, 0.06], 1);
  const ph = t * PI * 2 * 0.95;
  drawFigure(E, A.G, walkPose(ph), M4.chain(M4.T(0.1, 0, 0.6), M4.RY(PI / 2)), MAT.clay);
  // graph panel above
  const gM = M4.chain(M4.T(0.1, 3.1, -0.4), M4.RY(0.12));
  const pIn = easeOut((t - 0.05) / 0.4);
  E.add(A.panel, M4.chain(M4.T(0, 0, -0.06), M4.S(3.4 * pIn, 1.85 * pIn, 0.05)), { color: [0.05, 0.055, 0.07], rough: 0.3, opacity: 0.85, rim: 0.3, rimCol: [0.4, 0.8, 1], noShadow: true }, gM);
  const gr = clamp((t - cRed) / 0.7), gw = clamp((t - cWalk) / 0.9);
  const n = 120;
  if (gr > 0) E.add(A.graphHi, M4.I(), { mode: 2, color: [1.0, 0.3, 0.2], emis: [1.4, 0.25, 0.1], opacity: 1 - 0.55 * gw, range: Math.floor(gr * n) * A.graphHi.stride }, gM);
  if (gw > 0) {
    E.add(A.graphLo, M4.T(0, 0, 0.03), { mode: 2, color: [0.3, 1.0, 0.5], emis: [0.4, 1.5, 0.5], range: Math.floor(gw * n) * A.graphLo.stride }, gM);
    const hp = graphPoint(gw, 2.9, 1.2, 0.5); E.add(A.sph, M4.chain(M4.T(hp[0], hp[1], 0.03), M4.S(0.07)), { mode: 2, color: [0.6, 1, 0.7], emis: [1, 2, 1] }, gM);
  }
  E.render(t);
  const pk = E.project(M4.apply(gM, graphPoint(0.33, 2.9, 1.2, 1.0))), pl = E.project(M4.apply(gM, graphPoint(0.33, 2.9, 1.2, 0.5)));
  const left = E.project(M4.apply(gM, [-1.55, 0.78, 0]));
  if (gr > 0.3) chip(ctx, 'SIT AFTER MEAL', pk[0] + 205, pk[1] - 10, { size: 30, bg: '#ff5a3c', fg: '#fff', alpha: clamp((gr - 0.3) / 0.2) * (1 - 0.5 * gw), scale: popIn(t - cRed - 0.3) });
  if (gw > 0.35) {
    chip(ctx, 'WALK AFTER MEAL', pl[0] + 215, pl[1] + 50, { size: 30, bg: '#3ddc6b', fg: '#06210f', scale: popIn(t - cWalk - 0.35) });
    arrow(ctx, pk[0], (pk[1] + pl[1]) / 2 + 4, Math.max(40, pl[1] - pk[1] - 10), 1, BRAND_Y, clamp((gw - 0.35) / 0.2), 22);
  }
  drawRich(ctx, 'WALK = *SMALLER SPIKE*', 540, 205, { size: 70, alpha: clamp((t - cWalk - 0.5) / 0.2), scale: popIn(t - cWalk - 0.5) });
  if (t < cWalk + 0.5) drawRich(ctx, 'AFTER-MEAL *SPIKE*', 540, 205, { size: 70, alpha: clamp(t / 0.2) * clamp((cWalk + 0.5 - t) / 0.15) });
};

// 4. Muscle contraction pulls glucose from blood
SCENES.muscle = (E, A, t, d, c, ctx) => {
  const cCon = c.contract ?? 0.3, cGlu = c.glucose ?? d * 0.45, cFuel = c.fuel ?? d * 0.8;
  E.light.dir = V3.norm([-0.3, 0.7, 1.0]); E.light.box = 2.5; E.light.center = [0, 0, 0];
  E.bg.c0 = [0.02, 0.03, 0.045]; E.bg.c1 = [0.04, 0.06, 0.08]; E.bg.glow = [0.04, 0.12, 0.17]; E.bg.glowP = [0.5, 0.55]; E.bg.glowR = 0.4;
  const orbit = 0.35 - 0.06 * t;
  E.cam.eye = [Math.sin(orbit) * 5.3, 0.6, Math.cos(orbit) * 5.3]; E.cam.at = [0.25, 0.2, 0]; E.cam.fov = 42;
  const Root = M4.chain(M4.T(0, 0.35, 0), M4.RZ(0.06), M4.RX(0.12 * Math.sin(t * PI * 2 * 0.52)));
  // contraction cycle (walking cadence)
  const cc = t > cCon ? 0.5 - 0.5 * Math.cos((t - cCon) * PI * 2 * 1.05) : 0;
  const fuel = clamp((t - cGlu - 0.3) / 1.2);
  // bone
  E.add(A.bone, M4.chain(Root, M4.T(-0.12, 1.45, -0.18)), { mode: 1, color: [0.9, 0.95, 1.0], opacity: 0.55 });
  // muscle fibres
  const Mm = M4.chain(Root, M4.T(0.05, 0.0, 0.12), M4.S(1 + 0.2 * cc, 1 - 0.12 * cc, 1 + 0.2 * cc));
  const fib = []; const r = rng(3);
  const ring = [[0, 0], [0.17, 0.05], [-0.16, 0.07], [0.09, -0.13], [-0.09, -0.12], [0.2, -0.06], [-0.21, -0.03], [0.02, 0.17], [0.0, -0.2]];
  ring.forEach(([x, z], i) => fib.push({ m: M4.chain(M4.T(x, 0, z), M4.RY(r() * 0.6), M4.S(0.95 + 0.1 * r(), 0.94 + 0.08 * r(), 0.95 + 0.1 * r())), c: [0.86, 0.2, 0.24, 1] }));
  const em = V3.add([0.08, 0.0, 0.01], V3.scale([0.55, 0.2, 0.0], fuel * (0.7 + 0.3 * Math.sin(t * 10))));
  E.add(A.fiber, fib, { rough: 0.35, pat: 4, emis: em, rim: 0.5 + fuel, rimCol: [1, 0.55, 0.3] }, Mm);
  // tendons
  E.add(A.sph, [{ m: M4.chain(M4.T(0.05, 1.22 - 0.12 * cc, 0.12), M4.S(0.07, 0.3, 0.07)), c: [0.95, 0.92, 0.88, 1] }, { m: M4.chain(M4.T(0.05, -1.22 + 0.12 * cc, 0.12), M4.S(0.07, 0.3, 0.07)), c: [0.95, 0.92, 0.88, 1] }], { rough: 0.3 }, Root);
  // vessel
  E.add(A.vessel, M4.I(), { color: [0.8, 0.05, 0.08], opacity: 0.55, emis: [0.25, 0.0, 0.02], rough: 0.2, rim: 0.8, rimCol: [1, 0.3, 0.3] }, Root);
  // glucose flowing in vessel
  const flow = [];
  for (let i = 0; i < 26; i++) { const s = (i / 26 + t * 0.22) % 1; const p = vesselPt(s); flow.push({ m: M4.chain(M4.T(...p), M4.RY(t * 3 + i), M4.RX(1.2 + i), M4.S(0.045)), c: [1, 1, 1, 1] }); }
  // absorbed particles: leave vessel -> into muscle
  if (t > cGlu) {
    const rr = rng(17);
    for (let k = 0; k < 40; k++) {
      const t0 = cGlu + k * 0.075, u = (t - t0) / 0.55; const s0 = 0.2 + rr() * 0.6, tz = rr(), ty = rr(); if (u < 0 || u > 1.25) continue;
      const a = vesselPt(s0); const b = M4.apply(Mm, [(tz - 0.5) * 0.3, (ty - 0.5) * 1.3, 0.15]);
      const e = easeInOut(Math.min(1, u)); const p = V3.lerp(a, b, e); p[2] += Math.sin(e * PI) * 0.25;
      const sc = u > 1 ? 0.045 * (1 + (u - 1) * 6) * (1.25 - u) * 4 : 0.045;
      flow.push({ m: M4.chain(M4.T(...p), M4.RY(t * 4 + k), M4.RX(k), M4.S(Math.max(0.001, sc))), c: [1, 1, 1, u > 1 ? (1.25 - u) * 4 : 1] });
    }
  }
  E.add(A.I.hex, flow, { ...MAT.glu }, Root);
  // leg hologram shell
  E.add(A.legHolo, M4.chain(Root, M4.T(0.05, 0, 0), M4.S(1.05, 1, 0.95)), { mode: 1, color: [0.2, 0.75, 1.0], opacity: 0.8 });
  E.render(t);
  const mp = E.project(M4.apply(Mm, [-0.15, 0.55, 0.15])), vp = E.project(M4.apply(Root, vesselPt(0.5)));
  if (t > cCon) { const a = clamp((t - cCon) / 0.2); pointer(ctx, mp[0], mp[1], 250, mp[1] - 140, a); chip(ctx, 'MUSCLES CONTRACT', 250, mp[1] - 175, { size: 34, scale: popIn(t - cCon), bg: '#fff' }); }
  if (t > cGlu) { const a = clamp((t - cGlu) / 0.2); pointer(ctx, vp[0], vp[1], 800, vp[1] - 150, a, BRAND_Y); chip(ctx, 'GLUCOSE FROM BLOOD', 780, vp[1] - 185, { size: 32, scale: popIn(t - cGlu) }); }
  if (t > cFuel) { drawRich(ctx, 'GLUCOSE = *FUEL*', 540, 250, { size: 88, scale: popIn(t - cFuel) }); bolt(ctx, 880, 245, 46 * popIn(t - cFuel - 0.1), 1); }
  else drawRich(ctx, 'WHEN YOU *WALK*…', 540, 250, { size: 88, alpha: clamp(t / 0.2), scale: popIn(t) });
};

// 5. Whole body manages meal glucose
SCENES.body = (E, A, t, d, c, ctx) => {
  E.light.dir = V3.norm([-0.3, 0.9, 1.0]); E.light.box = 3; E.light.center = [0, 1, 0];
  E.bg.c0 = [0.02, 0.03, 0.045]; E.bg.c1 = [0.04, 0.06, 0.08]; E.bg.glow = [0.04, 0.13, 0.18]; E.bg.glowP = [0.5, 0.55]; E.bg.glowR = 0.42;
  E.grid.k = 1.6; E.grid.glow = 0.7; E.grid.col = [0.25, 0.8, 1.0]; E.grid.scroll = [-t * 1.4 * 1.6, 0];
  E.cam.eye = [1.9, 1.0, 6.3]; E.cam.at = [0, 0.62, 0]; E.cam.fov = 40;
  floor(E, A, [0.03, 0.04, 0.05], 1);
  const ph = t * PI * 2 * 0.95; const root = M4.chain(M4.T(0, 0, 0.3), M4.RY(PI / 2));
  const fig = drawFigure(E, A.G, walkPose(ph), root, { ...MAT.holo, opacity: 0.9 });
  const glow = clamp((t - 0.4) / 1.2);
  const mus = [];
  for (const k of ['L', 'R']) { const L = fig.limbs[k];
    mus.push({ m: M4.chain(L.thigh, M4.T(0, -0.2, 0.01), M4.S(0.068, 0.2, 0.068)), c: [0.9, 0.22, 0.25, 1] });
    mus.push({ m: M4.chain(L.shin, M4.T(0, -0.15, -0.015), M4.S(0.052, 0.15, 0.055)), c: [0.9, 0.22, 0.25, 1] }); }
  E.add(A.sph, mus, { rough: 0.35, emis: V3.scale([0.9, 0.42, 0.05], 0.15 + 0.6 * glow * (0.75 + 0.25 * Math.sin(t * 9))), rim: 0.4, rimCol: [1, 0.6, 0.3] });
  // stomach glow + particles to legs
  const belly = M4.apply(fig.pel, [0, 0.2, 0.06]);
  E.add(A.sph, M4.chain(M4.T(...belly), M4.S(0.09)), { mode: 2, color: [1, 0.7, 0.2], emis: [1.2, 0.8, 0.2], opacity: 0.9 });
  const P = []; const r = rng(31);
  for (let k = 0; k < 60; k++) {
    const t0 = k * 0.06, u = (t - t0) / 0.75; const side = k % 2 ? 'L' : 'R', seg = r() < 0.6 ? 'thigh' : 'shin'; const off = r(); if (u < 0 || u > 1.2) continue;
    const tgt = M4.apply(fig.limbs[side][seg], [0, -0.1 - 0.2 * off, 0.02]);
    const e = easeInOut(Math.min(1, u)); const p = V3.lerp(belly, tgt, e); p[2] += Math.sin(e * PI) * 0.12 * (side === 'L' ? 1 : -1);
    const a = u > 1 ? (1.2 - u) * 5 : 1; P.push({ m: M4.chain(M4.T(...p), M4.RY(t * 3 + k), M4.RX(k), M4.S(0.035)), c: [1, 1, 1, a] });
  }
  if (P.length) E.add(A.I.hex, P, { ...MAT.glu });
  E.render(t);
  drawRich(ctx, 'MEAL GLUCOSE', 540, 235, { size: 74, alpha: clamp(t / 0.2), scale: popIn(t) });
  drawRich(ctx, '→ *MUSCLES*', 540, 325, { size: 92, alpha: clamp((t - 0.35) / 0.2), scale: popIn(t - 0.35) });
};

// 6. Couch -> cross
SCENES.couch = (E, A, t, d, c, ctx) => {
  const cX = c.cross ?? d * 0.7;
  E.light.dir = V3.norm([-0.6, 1.0, 0.6]); E.light.box = 2.6; E.light.center = [0, 0.6, 0];
  E.bg.glow = [0.2, 0.12, 0.05]; E.bg.glowP = [0.5, 0.6]; E.fog = { n: 8, f: 18 };
  const pz = easeInOut(t / d);
  const sh = shake(t, cX, 0.06);
  E.cam.eye = V3.add([lerp(3.4, 2.9, pz), lerp(1.8, 1.6, pz), lerp(4.6, 3.9, pz)], sh); E.cam.at = V3.add([0, 0.75, 0], sh); E.cam.fov = 42;
  floor(E, A, [0.10, 0.075, 0.06]);
  E.add(A.disc, M4.chain(M4.T(0, 0.005, 0.5), M4.S(1.9, 0.01, 1.4)), { color: [0.3, 0.18, 0.14], rough: 0.95, pat: 5 });
  const fab = { color: [0.22, 0.38, 0.44], rough: 0.85, pat: 5 }; const C = A.couch;
  E.add(C.base, M4.T(0, 0.3, -0.05), fab); E.add(C.seat, M4.T(-0.5, 0.57, 0.0), fab); E.add(C.seat, M4.T(0.5, 0.57, 0.0), fab);
  E.add(C.back, M4.chain(M4.T(0, 0.9, -0.42), M4.RX(-0.1)), fab); E.add(C.arm, M4.T(-1.06, 0.55, -0.05), fab); E.add(C.arm, M4.T(1.06, 0.55, -0.05), fab);
  // cushions
  E.add(A.box, M4.chain(M4.T(-0.75, 0.95, -0.22), M4.RZ(0.2), M4.RX(-0.25), M4.S(0.45, 0.42, 0.14)), { color: [0.95, 0.72, 0.25], rough: 0.85, pat: 5 });
  // seated person (slouching)
  const breathe = 0.01 * Math.sin(t * 3);
  drawFigure(E, A.G, { ...sitPose(), lean: -0.22 + breathe }, M4.chain(M4.T(0.25, 0, 0.2)), MAT.clay, { seatY: 0.66, headTilt: 0.15 });
  // cross
  if (t > cX) {
    const u = (t - cX) / 0.2; const s = lerp(2.4, 1, easeOut(u)) * 0.95;
    drawCross(E, A.I, M4.chain(M4.T(1.0, 1.15, 1.25), M4.RY(0.62), M4.RZ(0.08 * (1 - clamp(u))), M4.S(s)), { ...MAT.red, opacity: clamp(u * 2) });
    E.bloom = 1.1; E.chrom = 0.01 * clamp(1 - (t - cX) / 0.2);
  }
  E.render(t);
  const cL = c.lunch ?? 0.3, cD = c.dinner ?? 0.7, cT = (cD + 0.55);
  if (t < cT) { chip(ctx, 'AFTER LUNCH', 330, 300, { size: 46, scale: popIn(t - cL), alpha: t > cL ? 1 : 0 }); chip(ctx, 'OR DINNER', 760, 300, { size: 46, scale: popIn(t - cD), alpha: t > cD ? 1 : 0, bg: '#fff' }); }
  else drawRich(ctx, 'STRAIGHT TO THE *COUCH?*', 540, 270, { size: 70, scale: popIn(t - cT) });
  if (t > cX) chip(ctx, 'NOT RIGHT AFTER EATING', 540, 380, { size: 38, bg: '#ff4040', fg: '#fff', scale: popIn(t - cX - 0.1) });
};

// 7. 10-minute walk -> tick
SCENES.walk10 = (E, A, t, d, c, ctx) => {
  const cT = c.tick ?? d * 0.6;
  E.light.dir = V3.norm([-0.4, 1.0, 0.7]); E.light.box = 3; E.light.center = [0, 1, 0];
  E.bg.glow = [0.05, 0.18, 0.08]; E.bg.glowP = [0.5, 0.72]; E.bg.glowR = 0.4; E.fog = { n: 9, f: 22 };
  E.grid.k = 1.4; E.grid.glow = 0.8; E.grid.col = [0.3, 1.0, 0.5]; E.grid.scroll = [-t * 1.4 * 1.4, 0];
  E.cam.eye = [2.6, 2.2, 11.0]; E.cam.at = [0, 0.96, 0]; E.cam.fov = 42;
  floor(E, A, [0.05, 0.055, 0.05], 1);
  drawFigure(E, A.G, walkPose(t * PI * 2 * 0.95), M4.chain(M4.T(0.0, 0, 0.6), M4.RY(PI / 2)), { ...MAT.clay, rimCol: [0.4, 1, 0.6] });
  // timer ring
  const rM = M4.chain(M4.T(0.1, 3.05, -0.2), M4.RY(0.12), M4.S(easeBack((t - 0.0) / 0.35)));
  const fill = easeInOut((t - 0.1) / Math.max(0.4, cT - 0.15));
  E.add(A.ringBg, M4.I(), { color: [0.15, 0.16, 0.18], rough: 0.4 }, rM);
  if (fill > 0) E.add(A.ring, M4.chain(M4.T(0, 0, 0.02), M4.RY(PI), M4.RZ(PI)), { mode: 2, color: [0.3, 1.0, 0.5], emis: [0.5, 1.6, 0.6], range: Math.floor(fill * 120) * A.ring.stride }, rM);
  if (t > cT) drawCheck(E, A.I, M4.chain(rM, M4.T(0, 0.02, 0.15), M4.S(0.75 * easeBack((t - cT) / 0.3))), MAT.green);
  E.render(t);
  const ctr = E.project(M4.apply(rM, [0, 0, 0]));
  if (t < cT + 0.05) { drawRich(ctx, String(Math.min(10, Math.floor(fill * 10 + 0.0001))), ctr[0], ctr[1] - 10, { size: 120 }); drawRich(ctx, 'MIN', ctr[0], ctr[1] + 75, { size: 40 }); }
  drawRich(ctx, 'TRY A *10-MIN WALK*', 540, 215, { size: 78, alpha: clamp((t - 0.15) / 0.2), scale: popIn(t - 0.15) });
};

// 8. No need to run
SCENES.norun = (E, A, t, d, c, ctx) => {
  const cX = c.cross ?? Math.min(0.55, d * 0.5);
  E.light.dir = V3.norm([-0.4, 1.0, 0.7]); E.light.box = 3; E.light.center = [0, 1, 0];
  E.bg.glow = [0.22, 0.06, 0.05]; E.bg.glowP = [0.5, 0.65]; E.bg.glowR = 0.4; E.fog = { n: 9, f: 22 };
  E.grid.k = 1.4; E.grid.glow = 0.8; E.grid.col = [1.0, 0.4, 0.35]; E.grid.scroll = [-t * 4.2 * 1.4, 0];
  const sh = shake(t, cX, 0.08);
  E.cam.eye = V3.add([2.4, 2.0, 9.0], sh); E.cam.at = V3.add([0, 1.15, 0], sh); E.cam.fov = 42;
  floor(E, A, [0.05, 0.05, 0.05], 1);
  drawFigure(E, A.G, walkPose(t * PI * 2 * 1.55, 'run'), M4.chain(M4.T(0.0, 0, 0.6), M4.RY(PI / 2)), { ...MAT.clay, rimCol: [1, 0.5, 0.4] });
  if (t > cX) { const u = (t - cX) / 0.2; drawCross(E, A.I, M4.chain(M4.T(0.1, 1.0, 1.9), M4.S(lerp(2.6, 1, easeOut(u)) * 1.15)), { ...MAT.red, opacity: clamp(u * 2) }); E.chrom = 0.01 * clamp(1 - (t - cX) / 0.2); }
  E.render(t);
  // speed lines
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  const r = rng(4); for (let i = 0; i < 9; i++) { const y = 700 + r() * 500, x = ((r() * 1400 - t * 2200 * (0.8 + r() * 0.5)) % 1400 + 1400) % 1400 - 200; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 160 + r() * 120, y); ctx.stroke(); }
  ctx.restore();
  drawRich(ctx, 'NO NEED TO *RUN*', 540, 255, { size: 92, alpha: clamp(t / 0.15), scale: popIn(t) });
};

// 9. No need to walk fast -> easy pace gauge
SCENES.easy = (E, A, t, d, c, ctx) => {
  E.light.dir = V3.norm([-0.4, 1.0, 0.7]); E.light.box = 3; E.light.center = [0, 1, 0];
  E.bg.glow = [0.05, 0.16, 0.1]; E.bg.glowP = [0.5, 0.7]; E.bg.glowR = 0.4; E.fog = { n: 9, f: 22 };
  E.grid.k = 1.4; E.grid.glow = 0.8; E.grid.col = [0.3, 1.0, 0.55]; E.grid.scroll = [-t * 1.2 * 1.4, 0];
  E.cam.eye = [2.4, 2.2, 11.0]; E.cam.at = [0, 0.96, 0]; E.cam.fov = 42;
  floor(E, A, [0.05, 0.055, 0.05], 1);
  drawFigure(E, A.G, walkPose(t * PI * 2 * 0.8, 'easy'), M4.chain(M4.T(0.0, 0, 0.6), M4.RY(PI / 2)), { ...MAT.clay, rimCol: [0.4, 1, 0.6] });
  const gM = M4.chain(M4.T(0.1, 2.75, -0.2), M4.RY(0.12), M4.S(1.25 * easeBack(t / 0.35)));
  const cols = [[0.25, 0.95, 0.45], [1.0, 0.8, 0.2], [1.0, 0.25, 0.2]];
  A.gauge.forEach((m, k) => E.add(m, M4.I(), { color: cols[k], rough: 0.3, emis: V3.scale(cols[k], 0.35) }, gM));
  // needle: angle from fast (red ~ 25deg) to easy (green ~ 150deg)
  const ang = lerp(25, 148, easeElastic(clamp((t - 0.3) / 0.9))) * PI / 180;
  E.add(A.rod, M4.chain(gM, M4.T(0, 0, 0.08), M4.RZ(ang - PI / 2), M4.S(0.03, 0.62, 0.03)), { color: [0.95, 0.95, 0.97], rough: 0.25, emis: [0.2, 0.2, 0.2] });
  E.add(A.sph, M4.chain(gM, M4.T(0, 0, 0.08), M4.S(0.09)), { color: [0.95, 0.95, 0.97], rough: 0.25 });
  E.render(t);
  drawRich(ctx, 'NO NEED TO *SPEED-WALK*', 540, 225, { size: 76, alpha: clamp(t / 0.15), scale: popIn(t) });
  if (t > 0.9) chip(ctx, 'EASY PACE ✓', 540, 640, { size: 46, bg: '#3ddc6b', fg: '#06210f', scale: popIn(t - 0.9) });
};
