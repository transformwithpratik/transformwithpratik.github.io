// Builders: food, human figure, icons, graph, particles
'use strict';
const PI = Math.PI;
const COL = {
  yellow: [1.0, 0.78, 0.24], cyan: [0.25, 0.85, 1.0], red: [0.95, 0.16, 0.18], green: [0.22, 0.86, 0.38],
  clay: [0.86, 0.87, 0.9], steel: [0.78, 0.79, 0.82],
};

// capsule from A to B in XY plane (z=0), returns matrix (mesh: capsule len 1 r given)
function segXY(A, B, z = 0) {
  const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
  return { m: M4.chain(M4.T(A[0], A[1], z), M4.RZ(Math.atan2(dx, -dy))), L };
}

// ---------------- FOOD ----------------
function buildFood(E) {
  const F = {};
  F.thali = E.mesh('thali', () => GEO.lathe([[0, 0], [0.95, 0], [1.02, 0.02], [1.07, 0.07], [1.10, 0.11], [1.115, 0.125], [1.09, 0.13], [1.06, 0.095], [1.0, 0.045], [0.93, 0.028], [0.5, 0.026], [0, 0.026]], 96));
  F.katori = E.mesh('katori', () => GEO.lathe([[0, 0], [0.17, 0], [0.2, 0.006], [0.27, 0.06], [0.31, 0.16], [0.325, 0.225], [0.333, 0.24], [0.318, 0.243], [0.302, 0.205], [0.27, 0.11], [0.2, 0.045], [0.1, 0.034], [0, 0.032]], 72));
  F.sph = E.mesh('sph', () => GEO.sphere(28));
  F.sphLo = E.mesh('sphLo', () => GEO.sphere(10));
  F.grain = E.mesh('grain', () => GEO.sphere(7));
  F.disc = E.mesh('disc', () => GEO.cylinder(1, 1, 1, 64));
  F.cube = E.mesh('cubeR', () => GEO.roundBox(1, 1, 1, 0.22, 2));
  F.ring = E.mesh('onion', () => GEO.torus(1, 0.13, PI * 2, 32, 8));
  F.roti = E.mesh('roti', () => {
    const R = 0.43; const prof = [];
    for (let i = 0; i <= 10; i++) { const r = R * (1 - i / 10); prof.unshift([r, -0.006 - 0.004 * Math.sqrt(1 - (r / R) ** 2)]); }
    for (let i = 1; i <= 10; i++) { const r = R * (1 - i / 10); prof.push([r, 0.006 + 0.008 * Math.sqrt(1 - (r / R) ** 2)]); }
    const g = GEO.lathe(prof, 72);
    // organic warp
    for (let i = 0; i < g.pos.length; i += 3) {
      const x = g.pos[i], z = g.pos[i + 2], th = Math.atan2(z, x), r = Math.hypot(x, z);
      const k = 1 + 0.025 * Math.sin(3 * th + 0.7) + 0.015 * Math.sin(5 * th + 2.1);
      g.pos[i] = x * k; g.pos[i + 2] = z * k; g.pos[i + 1] += 0.012 * (r / R) ** 2 * Math.sin(2 * th + 1.0);
    }
    g.nrm = computeNormals(g.pos, g.idx); return g;
  });
  F.chili = E.mesh('chili', () => GEO.tube(Array.from({ length: 24 }, (_, i) => { const t = i / 23; return [t * 0.32 - 0.16, 0.02 * Math.sin(t * PI), 0.05 * Math.sin(t * PI * 0.9)]; }), 0.022, 10, t => Math.min(1, Math.sin(PI * Math.min(1, t * 1.05)) * 1.6 + 0.15)));
  // rice grains (static instances)
  const r = rng(7); const grains = [];
  const RR = 0.40, HH = 0.27;
  const hgt = (rr) => HH * Math.pow(Math.max(0, 1 - (rr / RR) ** 2), 0.75);
  for (let i = 0; i < 1700; i++) {
    const rr = RR * Math.sqrt(r()); const th = r() * PI * 2; const y = hgt(rr) - r() * 0.025;
    const m = M4.chain(M4.T(rr * Math.cos(th), 0.03 + y, rr * Math.sin(th)), M4.RY(r() * PI * 2), M4.RX((r() - 0.5) * 2.4), M4.RZ((r() - 0.5) * 0.8), M4.S(0.0115, 0.0115, 0.036));
    const v = 0.9 + 0.1 * r(); grains.push({ m, c: [0.97 * v, 0.95 * v, 0.89 * v, 1] });
  }
  F.riceInst = E.staticInst(grains);
  // dal toppings
  const d = rng(11); const dalTop = [];
  for (let i = 0; i < 26; i++) { const rr = 0.25 * Math.sqrt(d()), th = d() * PI * 2; dalTop.push({ m: M4.chain(M4.T(rr * Math.cos(th), 0.003, rr * Math.sin(th)), M4.S(0.009)), c: [0.07, 0.04, 0.02, 1] }); }
  for (let i = 0; i < 14; i++) { const rr = 0.24 * Math.sqrt(d()), th = d() * PI * 2; dalTop.push({ m: M4.chain(M4.T(rr * Math.cos(th), 0.004, rr * Math.sin(th)), M4.RY(d() * 6), M4.S(0.022, 0.004, 0.012)), c: [0.16, 0.5, 0.12, 1] }); }
  for (let i = 0; i < 5; i++) { const rr = 0.2 * Math.sqrt(d()), th = d() * PI * 2; dalTop.push({ m: M4.chain(M4.T(rr * Math.cos(th), 0.004, rr * Math.sin(th)), M4.RY(d() * 6), M4.S(0.03, 0.006, 0.014)), c: [0.7, 0.08, 0.04, 1] }); }
  F.dalTop = E.staticInst(dalTop);
  // sabzi pieces (aloo matar)
  const s = rng(23); const pot = [], peas = [];
  for (let i = 0; i < 46; i++) { const rr = 0.23 * Math.sqrt(s()), th = s() * PI * 2; const y = 0.06 * (1 - (rr / 0.24) ** 2) + s() * 0.02;
    pot.push({ m: M4.chain(M4.T(rr * Math.cos(th), y, rr * Math.sin(th)), M4.RY(s() * 6), M4.RX(s() * 6), M4.S(0.055 + 0.02 * s())), c: [0.93, 0.62 + 0.06 * s(), 0.22, 1] }); }
  for (let i = 0; i < 34; i++) { const rr = 0.24 * Math.sqrt(s()), th = s() * PI * 2; const y = 0.065 * (1 - (rr / 0.24) ** 2) + s() * 0.025;
    peas.push({ m: M4.chain(M4.T(rr * Math.cos(th), y + 0.01, rr * Math.sin(th)), M4.S(0.022)), c: [0.32, 0.62, 0.14, 1] }); }
  F.potInst = E.staticInst(pot); F.peaInst = E.staticInst(peas);
  return F;
}
// draw the thali at model matrix M; anim: {pop:[rice,dal,sabzi,roti] 0..1, carbGlow 0..1}
function drawThali(E, F, M, an) {
  const steel = { rough: 0.2, metal: 1.0 };
  const P = (k) => an.pop ? easeBack(an.pop[k]) : 1;
  E.add(F.thali, M4.I(), { ...steel, color: [0.6, 0.61, 0.64] }, M);
  const glow = an.carbGlow || 0, gEm = V3.scale([1.0, 0.65, 0.1], 0.07 * glow);
  // rice
  const pr = P(0); if (pr > 0.01) {
    const Mr = M4.chain(M, M4.T(-0.33, 0, 0.22), M4.S(pr));
    E.add(F.sph, M4.chain(M4.T(0, 0.03, 0), M4.S(0.38, 0.215, 0.38)), { color: [0.78, 0.76, 0.7], rough: 0.75, emis: [0.02, 0.018, 0.015], rim: 0.25 * glow, rimCol: [1, 0.75, 0.2], noShadowRecv: true }, Mr);
    E.add(F.grain, F.riceInst, { color: [0.86, 0.85, 0.8], rough: 0.55, emis: [0.03, 0.028, 0.024], rim: 0.15 + 0.3 * glow, rimCol: glow > 0.01 ? [1, 0.75, 0.2] : [0.6, 0.6, 0.6], noShadowRecv: true }, Mr);
  }
  // dal katori (back right)
  const pd = P(1); if (pd > 0.01) {
    const Md = M4.chain(M, M4.T(0.36, 0.026, -0.42), M4.S(pd));
    E.add(F.katori, M4.I(), { ...steel, color: COL.steel }, Md);
    E.add(F.disc, M4.chain(M4.T(0, 0.185, 0), M4.S(0.303, 0.006, 0.303)), { color: [0.95, 0.62, 0.1], rough: 0.18, pat: 2 }, Md);
    E.add(F.sphLo, F.dalTop, { rough: 0.5 }, M4.chain(Md, M4.T(0, 0.19, 0)));
  }
  // sabzi katori (back left)
  const ps = P(2); if (ps > 0.01) {
    const Ms = M4.chain(M, M4.T(-0.36, 0.026, -0.5), M4.S(ps));
    E.add(F.katori, M4.I(), { ...steel, color: COL.steel }, Ms);
    E.add(F.disc, M4.chain(M4.T(0, 0.15, 0), M4.S(0.29, 0.006, 0.29)), { color: [0.78, 0.36, 0.08], rough: 0.3 }, Ms);
    E.add(F.cube, F.potInst, { rough: 0.55, pat: 6 }, M4.chain(Ms, M4.T(0, 0.15, 0)));
    E.add(F.sphLo, F.peaInst, { rough: 0.3 }, M4.chain(Ms, M4.T(0, 0.15, 0)));
  }
  // roti stack (front right, overlapping rim)
  const pt = P(3); if (pt > 0.01) {
    const Mt = M4.chain(M, M4.T(0.42, 0.04, 0.36), M4.S(pt));
    const rm = { color: [0.80, 0.56, 0.30], rough: 0.8, pat: 1, emis: gEm, rim: 0.35 * glow, rimCol: [1, 0.75, 0.2] };
    E.add(F.roti, M4.chain(M4.RZ(0.06), M4.RY(0.4)), rm, Mt);
    E.add(F.roti, M4.chain(M4.T(-0.05, 0.022, 0.03), M4.RZ(0.08), M4.RX(-0.04), M4.RY(2.1)), rm, Mt);
  }
  // onion rings + chili (front centre)
  const po = P(3); if (po > 0.01) {
    const Mo = M4.chain(M, M4.T(0.02, 0.035, 0.66), M4.S(po));
    [[0, 0, 0.065], [0.06, 0.012, 0.05], [-0.05, 0.02, 0.045]].forEach(([x, y, s], i) => E.add(F.ring, M4.chain(M4.T(x, y + 0.008, 0.01 * i), M4.RX(PI / 2 + 0.1 * i), M4.S(s)), { color: [0.93, 0.82, 0.9], rough: 0.25 }, Mo));
    E.add(F.chili, M4.chain(M4.T(0.18, 0.02, -0.04), M4.RY(0.5)), { color: [0.18, 0.55, 0.1], rough: 0.2 }, Mo);
  }
}

// ---------------- HUMAN FIGURE ----------------
function buildFigure(E) {
  const G = {};
  G.thigh = E.mesh('thigh', () => GEO.capsule(0.078, 0.42));
  G.shin = E.mesh('shin', () => GEO.capsule(0.062, 0.42));
  G.uarm = E.mesh('uarm', () => GEO.capsule(0.052, 0.28));
  G.farm = E.mesh('farm', () => GEO.capsule(0.044, 0.26));
  G.neck = E.mesh('neck', () => GEO.capsule(0.048, 0.08));
  G.sph = E.mesh('sph', () => GEO.sphere(28));
  G.foot = E.mesh('foot', () => GEO.roundBox(0.1, 0.07, 0.25, 0.034, 3));
  return G;
}
function legFK(hip, knee, side) { // returns ankle y relative to pelvis (pelvis origin)
  // thigh down rotated by hip around X; then shin by knee
  const y1 = -Math.cos(hip) * 0.42, y2 = y1 - Math.cos(hip + knee) * 0.42;
  return y2;
}
function walkPose(ph, style = 'walk') {
  const s = Math.sin(ph), c = Math.cos(ph), s2 = -s, c2 = -c;
  if (style === 'run') {
    const k = (cc) => 0.25 + 1.55 * Math.pow(Math.max(0, cc), 1.1);
    return { hipL: -0.25 - 0.72 * s, hipR: -0.25 - 0.72 * s2, kneeL: k(c), kneeR: k(c2), shL: 0.75 * s, shR: 0.75 * s2, elL: -1.45, elR: -1.45, lean: 0.22, air: 0.06 * Math.max(0, Math.cos(2 * ph)) };
  }
  const A = style === 'easy' ? 0.36 : 0.44;
  const k = (cc) => 0.07 + 0.78 * Math.pow(Math.max(0, cc), 1.5);
  return { hipL: -A * s, hipR: -A * s2, kneeL: k(c), kneeR: k(c2), shL: 0.42 * s, shR: 0.42 * s2, elL: -0.35 - 0.2 * Math.max(0, -s), elR: -0.35 - 0.2 * Math.max(0, s), lean: 0.05, air: 0 };
}
function sitPose() { return { hipL: -1.5, hipR: -1.42, kneeL: 1.5, kneeR: 1.38, shL: -0.25, shR: -0.2, elL: -0.95, elR: -1.0, lean: -0.16, air: 0, sit: true, armOut: 0.12 }; }
// draw figure; root = matrix placing feet on ground at origin, facing +z
function drawFigure(E, G, pose, root, mat, opt = {}) {
  const hipH = 0.92;
  let pelvisY;
  if (pose.sit) pelvisY = opt.seatY ?? 0.52;
  else { const aL = legFK(pose.hipL, pose.kneeL), aR = legFK(pose.hipR, pose.kneeR); pelvisY = -Math.min(aL, aR) + 0.085 + (pose.air || 0); }
  const pel = M4.chain(root, M4.T(0, pelvisY, 0));
  const parts = [];
  const add = (mesh, m) => parts.push([mesh, m]);
  // pelvis + torso
  add(G.sph, M4.chain(pel, M4.T(0, 0.04, 0), M4.S(0.175, 0.13, 0.115)));
  const chest = M4.chain(pel, M4.RX(pose.lean || 0), M4.T(0, 0.36, 0));
  add(G.sph, M4.chain(pel, M4.RX(pose.lean || 0), M4.T(0, 0.17, 0), M4.S(0.155, 0.17, 0.105)));
  add(G.sph, M4.chain(chest, M4.S(0.205, 0.235, 0.125)));
  add(G.neck, M4.chain(chest, M4.T(0, 0.3, 0)));
  add(G.sph, M4.chain(chest, M4.T(0, 0.43, 0.01), M4.RX(opt.headTilt || 0), M4.S(0.105, 0.125, 0.115)));
  // legs
  const limbs = {};
  for (const [sd, hip, knee] of [[1, pose.hipL, pose.kneeL], [-1, pose.hipR, pose.kneeR]]) {
    const H = M4.chain(pel, M4.T(0.095 * sd, 0, 0), M4.RX(hip));
    add(G.thigh, H);
    const K = M4.chain(H, M4.T(0, -0.42, 0), M4.RX(knee));
    limbs[sd > 0 ? 'L' : 'R'] = { thigh: H, shin: K };
    add(G.shin, K);
    const ank = pose.sit ? -(hip + knee) : -(hip + knee) * 0.9;
    add(G.foot, M4.chain(K, M4.T(0, -0.44, 0), M4.RX(ank), M4.T(0, -0.02, 0.06)));
  }
  // arms
  for (const [sd, sh, el] of [[1, pose.shL, pose.elL], [-1, pose.shR, pose.elR]]) {
    const S = M4.chain(chest, M4.T(0.215 * sd, 0.15, 0), M4.RZ((pose.armOut ?? 0.07) * sd), M4.RX(sh));
    add(G.uarm, S);
    const El = M4.chain(S, M4.T(0, -0.28, 0), M4.RX(el));
    add(G.farm, El);
    add(G.sph, M4.chain(El, M4.T(0, -0.31, 0), M4.S(0.05, 0.06, 0.04)));
  }
  if (!opt.skip) for (const [mesh, m] of parts) E.add(mesh, m, mat);
  return { pel, chest, pelvisY, limbs };
}

// ---------------- ICONS ----------------
function buildIcons(E) {
  const I = {};
  I.bar = E.mesh('xbar', () => GEO.roundBox(0.2, 1.05, 0.2, 0.09, 4));
  I.cap = E.mesh('cap1', () => GEO.capsule(0.1, 1));
  I.sph = E.mesh('sph', () => GEO.sphere(28));
  I.hex = E.mesh('hex', () => GEO.torus(1, 0.26, PI * 2, 6, 10));
  I.qmark = E.mesh('qmark', () => {
    const pts = []; const cx = 0, cy = 0.33, R = 0.27;
    for (let i = 0; i <= 40; i++) { const a = (165 - i * (255 / 40)) * PI / 180; pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a), 0]); }
    // drop into stem
    const last = pts[pts.length - 1];
    for (let i = 1; i <= 10; i++) pts.push([last[0] * (1 - i / 10), last[1] - 0.012 * i - 0.008 * i * i / 10, 0]);
    for (let i = 1; i <= 8; i++) pts.push([0, pts[pts.length - 1][1] - 0.025, 0]);
    return GEO.tube(pts, 0.085, 20);
  });
  return I;
}
function drawCross(E, I, M, mat) {
  E.add(I.bar, M4.chain(M, M4.RZ(PI / 4)), mat); E.add(I.bar, M4.chain(M, M4.RZ(-PI / 4)), mat);
}
function drawCheck(E, I, M, mat) {
  const a = [-0.36, 0.02], b = [-0.1, -0.26], c = [0.4, 0.36];
  const s1 = segXY(a, b), s2 = segXY(b, c);
  E.add(I.cap, M4.chain(M, s1.m, M4.S(1, s1.L, 1)), mat);
  E.add(I.cap, M4.chain(M, s2.m, M4.S(1, s2.L, 1)), mat);
}
function drawQ(E, I, M, mat) {
  E.add(I.qmark, M, mat);
  // end caps
  E.add(I.sph, M4.chain(M, M4.T(0.27 * Math.cos(165 * PI / 180), 0.33 + 0.27 * Math.sin(165 * PI / 180), 0), M4.S(0.085)), mat);
  E.add(I.sph, M4.chain(M, M4.T(0, -0.235, 0), M4.S(0.085)), mat);
  E.add(I.sph, M4.chain(M, M4.T(0, -0.47, 0), M4.S(0.105)), mat);
}

// ---------------- GRAPH ----------------
function glucoseCurve(s, peak = 1.0, base = 0.18) {
  const x = s / 0.33; return base + (peak - base) * x * x * Math.exp(2 * (1 - x));
}
function buildGraph(E, key, w, h, peak, n = 120) {
  return E.mesh(key, () => {
    const pts = []; for (let i = 0; i <= n; i++) { const s = i / n; pts.push([(s - 0.5) * w, (glucoseCurve(s, peak) - 0.5) * h, 0]); }
    return GEO.tube(pts, 0.032, 10);
  });
}
function graphPoint(s, w, h, peak) { return [(s - 0.5) * w, (glucoseCurve(s, peak) - 0.5) * h, 0]; }
