// Mini WebGL2 3D engine for reel motion graphics (no external libs).
'use strict';
const W = 1080, H = 1920; const RS = (typeof window !== 'undefined' && window.RS) || 0.7; const RW = Math.round(W * RS / 2) * 2, RH = Math.round(H * RS / 2) * 2;

// ---------- math ----------
const V3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};
const M4 = {
  I() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  persp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o;
  },
  ortho(l, r, b, t, n, f) {
    const o = M4.I(); o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n);
    o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); return o;
  },
  lookAt(e, c, u) {
    const z = V3.norm(V3.sub(e, c)), x = V3.norm(V3.cross(u, z)), y = V3.cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
      -V3.dot(x, e), -V3.dot(y, e), -V3.dot(z, e), 1]);
  },
  T(x, y, z) { const o = M4.I(); o[12] = x; o[13] = y; o[14] = z; return o; },
  S(x, y, z) { if (y === undefined) { y = x; z = x; } const o = M4.I(); o[0] = x; o[5] = y; o[10] = z; return o; },
  RX(a) { const c = Math.cos(a), s = Math.sin(a), o = M4.I(); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; },
  RY(a) { const c = Math.cos(a), s = Math.sin(a), o = M4.I(); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; },
  RZ(a) { const c = Math.cos(a), s = Math.sin(a), o = M4.I(); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o; },
  chain(...ms) { let o = ms[0]; for (let i = 1; i < ms.length; i++) o = M4.mul(o, ms[i]); return o; },
  apply(m, p) { const x = p[0], y = p[1], z = p[2]; const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w]; },
};
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeBack = (t) => { t = clamp(t); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeElastic = (t) => { t = clamp(t); if (t === 0 || t === 1) return t; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1; };
// deterministic random
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- geometry ----------
function computeNormals(pos, idx) {
  const n = new Float32Array(pos.length);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
    const e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    const f = V3.cross(e1, e2);
    for (const k of [a, b, c]) { n[k] += f[0]; n[k + 1] += f[1]; n[k + 2] += f[2]; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}
// grid surface: f(u,v)->[x,y,z], u in [0,1] (nu segs), v in [0,1] (nv segs); wrapU joins seam by duplicating
function paramSurface(nu, nv, f, flip) {
  const pos = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pos.push(...f(i / nu, j / nv));
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}
function fixSeamNormals(g, nu, nv) { // average normals across u seam (lathe/sphere)
  const n = g.nrm;
  for (let j = 0; j <= nv; j++) {
    const a = (j * (nu + 1)) * 3, b = (j * (nu + 1) + nu) * 3;
    for (let k = 0; k < 3; k++) { const m = (n[a + k] + n[b + k]) / 2; n[a + k] = m; n[b + k] = m; }
    const l = Math.hypot(n[a], n[a + 1], n[a + 2]) || 1; for (let k = 0; k < 3; k++) { n[a + k] /= l; n[b + k] /= l; }
  }
}
const GEO = {
  sphere(seg = 32) {
    const nu = seg, nv = Math.round(seg / 2);
    const g = paramSurface(nu, nv, (u, v) => { const th = u * Math.PI * 2, ph = v * Math.PI; return [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)]; });
    g.nrm = new Float32Array(g.pos); return g;
  },
  lathe(profile, seg = 64) { // profile: [[r,y],...] from bottom/outer around
    const nv = profile.length - 1;
    const g = paramSurface(seg, nv, (u, v) => { const p = profile[Math.round(v * nv)]; const th = u * Math.PI * 2; return [p[0] * Math.cos(th), p[1], p[0] * Math.sin(th)]; }, true);
    g.nrm = computeNormals(g.pos, g.idx); fixSeamNormals(g, seg, nv); return g;
  },
  capsule(r, len, seg = 20) { // from y=0 down to y=-len
    const prof = [];
    const n = 8;
    for (let i = 0; i <= n; i++) { const a = Math.PI / 2 * (i / n); prof.push([r * Math.sin(a), -len - r * Math.cos(a)]); }
    for (let i = 0; i <= n; i++) { const a = Math.PI / 2 * (i / n); prof.push([r * Math.cos(a), r * Math.sin(a)]); }
    return GEO.lathe(prof, seg);
  },
  cylinder(r1, r2, h, seg = 32, cap = true) {
    const prof = cap ? [[0, 0], [r1, 0], [r1, 0], [r2, h], [r2, h], [0, h]] : [[r1, 0], [r2, h]];
    // flat shading for cap edges via duplicated points -> normals averaged; ok for stylised
    return GEO.lathe(prof, seg);
  },
  torus(R, r, arc = Math.PI * 2, nu = 96, nv = 20, a0 = 0) {
    const g = paramSurface(nu, nv, (u, v) => { const th = a0 + u * arc, ph = v * Math.PI * 2; const c = R + r * Math.cos(ph); return [c * Math.cos(th), c * Math.sin(th), r * Math.sin(ph)]; }, false);
    // indices ordered by u per row -> reorder so partial drawing follows u
    const idx = [];
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d);
    }
    g.idx = new Uint32Array(idx); g.nrm = computeNormals(g.pos, g.idx); g.stride = nv * 6; return g;
  },
  roundBox(w, h, d, r, s = 6) { // subdivided cube -> spherified corners
    const pos = [], idx = [];
    const faces = [[0, 1, 2, 1], [0, 1, 2, -1], [1, 2, 0, 1], [1, 2, 0, -1], [2, 0, 1, 1], [2, 0, 1, -1]];
    const n = s * 2 + 2;
    for (const [ax, bx, cx, sg] of faces) {
      const base = pos.length / 3;
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
        const p = [0, 0, 0]; p[ax] = (i / n) * 2 - 1; p[bx] = (j / n) * 2 - 1; p[cx] = sg; pos.push(...p);
      }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const a = base + j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
        if (sg > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
      }
    }
    const hw = [w / 2, h / 2, d / 2], nrm = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i += 3) {
      const q = [pos[i] * hw[0], pos[i + 1] * hw[1], pos[i + 2] * hw[2]];
      const inner = q.map((v, k) => clamp(v, -(hw[k] - r), hw[k] - r));
      let dlt = V3.sub(q, inner); const l = V3.len(dlt) || 1; dlt = V3.scale(dlt, 1 / l);
      const p = V3.add(inner, V3.scale(dlt, r));
      pos[i] = p[0]; pos[i + 1] = p[1]; pos[i + 2] = p[2]; nrm[i] = dlt[0]; nrm[i + 1] = dlt[1]; nrm[i + 2] = dlt[2];
    }
    // fix orientation (faces built with sign conventions) by checking normal vs geometric
    const P = new Float32Array(pos), I = new Uint32Array(idx);
    for (let i = 0; i < I.length; i += 3) {
      const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3;
      const f = V3.cross([P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]]);
      if (V3.dot(f, [nrm[a], nrm[a + 1], nrm[a + 2]]) < 0) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; }
    }
    return { pos: P, idx: I, nrm };
  },
  tube(path, r, rseg = 12, rfun) { // path: [[x,y,z]...]; indices ordered along path; rfun(t)->radius scale
    const n = path.length, pos = [], idx = [];
    let prevN = null;
    for (let i = 0; i < n; i++) {
      const p = path[i];
      const tg = V3.norm(V3.sub(path[Math.min(n - 1, i + 1)], path[Math.max(0, i - 1)]));
      let nn;
      if (!prevN) { nn = Math.abs(tg[1]) < 0.9 ? V3.norm(V3.cross(tg, [0, 1, 0])) : V3.norm(V3.cross(tg, [1, 0, 0])); }
      else { nn = V3.norm(V3.sub(prevN, V3.scale(tg, V3.dot(prevN, tg)))); }
      prevN = nn; const bn = V3.cross(tg, nn);
      const rr = r * (rfun ? rfun(i / (n - 1)) : 1);
      for (let k = 0; k <= rseg; k++) {
        const a = k / rseg * Math.PI * 2; const d = V3.add(V3.scale(nn, Math.cos(a)), V3.scale(bn, Math.sin(a)));
        pos.push(...V3.add(p, V3.scale(d, rr)));
      }
    }
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < rseg; k++) {
      const a = i * (rseg + 1) + k, b = a + 1, c = a + rseg + 1, d = c + 1; idx.push(a, c, b, b, c, d);
    }
    const g = { pos: new Float32Array(pos), idx: new Uint32Array(idx) }; g.nrm = computeNormals(g.pos, g.idx); g.stride = rseg * 6; return g;
  },
  plane(w, d) { const g = paramSurface(1, 1, (u, v) => [(u - 0.5) * w, 0, (v - 0.5) * d]); g.nrm = new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]); return g; },
  merge(list) { // list of {g, m(Float32Array)}
    let pos = [], nrm = [], idx = [], off = 0;
    for (const { g, m } of list) {
      for (let i = 0; i < g.pos.length; i += 3) {
        const p = M4.apply(m, [g.pos[i], g.pos[i + 1], g.pos[i + 2]]); pos.push(...p);
        const q = M4.apply(m, [g.pos[i] + g.nrm[i], g.pos[i + 1] + g.nrm[i + 1], g.pos[i + 2] + g.nrm[i + 2]]);
        nrm.push(...V3.norm(V3.sub(q, p)));
      }
      for (const k of g.idx) idx.push(k + off); off += g.pos.length / 3;
    }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint32Array(idx) };
  },
};

// ---------- shaders ----------
const SH_COMMON = `#version 300 es
precision highp float;
`;
const VS_MAIN = SH_COMMON + `
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 iM0; layout(location=3) in vec4 iM1; layout(location=4) in vec4 iM2; layout(location=5) in vec4 iM3;
layout(location=6) in vec4 iCol;
uniform mat4 uVP, uModel, uLightVP;
out vec3 vW; out vec3 vN; out vec3 vO; out vec4 vC; out vec4 vL;
void main(){
  mat4 m = uModel * mat4(iM0,iM1,iM2,iM3);
  vec4 wp = m * vec4(aPos,1.0);
  vW = wp.xyz; vN = normalize(transpose(inverse(mat3(m))) * aNrm); vO = aPos; vC = iCol; vL = uLightVP * wp;
  gl_Position = uVP * wp;
}`;
const FS_MAIN = `
in vec3 vW; in vec3 vN; in vec3 vO; in vec4 vC; in vec4 vL; out vec4 o;
uniform vec3 uCam, uLdir, uLcol, uEmis, uRimCol, uBg;
uniform float uRough, uMetal, uOpacity, uRim, uTime, uAmb, uFogN, uFogF, uUseShadow, uGrid, uGlow;
uniform vec2 uScroll;
uniform highp sampler2DShadow uShadow;
float h3(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=0.5; } return s; }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
vec3 env(vec3 r){
  float up = r.y*0.5+0.5;
  vec3 c = mix(vec3(0.04,0.035,0.04), vec3(0.36,0.37,0.42), smoothstep(0.3,1.0,up));
  c += vec3(0.25,0.22,0.2)*smoothstep(0.2,0.6,up)*(1.0-smoothstep(0.6,0.9,up));
  c += vec3(2.4,2.2,1.9)*smoothstep(0.86,0.96, dot(r, normalize(vec3(-0.55,0.65,0.55))));
  c += vec3(0.9,1.0,1.3)*smoothstep(0.90,0.98, dot(r, normalize(vec3(0.75,0.25,0.6))));
  c += vec3(1.2,0.85,0.4)*0.35*smoothstep(0.6,1.0, dot(r, normalize(vec3(0.0,-0.2,1.0))));
  return c;
}
float shadowF(vec4 lp){
  vec3 p = lp.xyz/lp.w*0.5+0.5; if(p.z>1.0||p.x<0.0||p.x>1.0||p.y<0.0||p.y>1.0) return 1.0;
  vec2 ts = 1.0/vec2(textureSize(uShadow,0)); p.z -= 0.002;
  float s = texture(uShadow, vec3(p.xy+vec2(-0.75,-0.75)*ts*1.6, p.z)) + texture(uShadow, vec3(p.xy+vec2(0.75,-0.75)*ts*1.6, p.z))
          + texture(uShadow, vec3(p.xy+vec2(-0.75,0.75)*ts*1.6, p.z)) + texture(uShadow, vec3(p.xy+vec2(0.75,0.75)*ts*1.6, p.z));
  return s*0.25;
}
void main(){
  vec3 base = pow(vC.rgb, vec3(2.2)); float alpha = vC.a*uOpacity;
  vec3 N = normalize(vN); vec3 V = normalize(uCam - vW);
  if(!gl_FrontFacing) N = -N;
  vec3 emis = uEmis;
#if PAT==1
  float n = noise(vO*6.0); float sp = smoothstep(0.55,0.75, noise(vO*11.0+vec3(3.1))*0.65+noise(vO*23.0)*0.35);
  float sp2 = smoothstep(0.66,0.74, noise(vO*31.0+vec3(7.0)));
  base = mix(base, vec3(0.08,0.025,0.005), sp*0.8); base = mix(base, vec3(0.03,0.01,0.002), sp2*0.8);
  base *= 0.85+0.3*n;
#elif PAT==2
  float n = noise(vO*7.0 + vec3(0.0, uTime*0.08, 0.0))*0.6+noise(vO*17.0)*0.4; base *= 0.8+0.4*n;
#elif PAT==3
  vec2 q = vW.xz*uGrid + uScroll;
  vec2 g = abs(fract(q)-0.5); float l = 1.0 - smoothstep(0.0, 0.035, 0.5-max(g.x,g.y));
  emis += uRimCol * l * uGlow * exp(-0.06*dot(vW.xz,vW.xz));
#elif PAT==4
  float st = 0.72+0.28*sin(vO.y*90.0+noise(vO*10.0)*5.0); base *= st;
#elif PAT==5
  base *= 0.9+0.16*noise(vO*30.0);
#elif PAT==6
  base *= 0.8+0.4*noise(vO*12.0);
#endif
#if MODE==1
  float frh = pow(1.0-abs(dot(N,V)), 2.2);
  float scan = 0.82+0.18*sin(vW.y*140.0 - uTime*6.0);
  vec3 ch = base*(0.10+1.7*frh)*scan + emis;
  o = vec4(ch*alpha, 1.0);
#elif MODE==2
  vec3 cu = base + emis; cu = aces(cu); cu = pow(cu, vec3(1.0/2.2)); o = vec4(cu*alpha, alpha);
#else
  vec3 L = normalize(uLdir), Hh = normalize(L+V);
  float ndl = max(dot(N,L),0.0);
  float sh = (uUseShadow>0.5 && ndl>0.0) ? shadowF(vL) : 1.0;
  float shin = mix(300.0, 6.0, uRough);
  float spec = pow(max(dot(N,Hh),0.0), shin)*(shin+8.0)/25.0;
  vec3 F0 = mix(vec3(0.04), base, uMetal);
  float fr = pow(1.0-max(dot(N,V),0.0), 5.0);
  vec3 F = F0 + (1.0-F0)*fr;
  vec3 diff = base*(1.0-uMetal);
  vec3 hemi = mix(vec3(0.05,0.045,0.045), vec3(0.22,0.24,0.29), N.y*0.5+0.5);
  vec3 fill = vec3(0.25,0.30,0.42)*max(dot(N, normalize(vec3(0.8,0.3,0.5))),0.0);
  vec3 col = diff*(uLcol*ndl*sh + hemi*uAmb + fill*0.5);
  col += uLcol*spec*F*sh*(1.0-uRough*0.85);
  vec3 R = reflect(-V,N);
  vec3 er = env(R);
  col += er * F * (1.0-uRough) * mix(0.3, 1.0, uMetal);
  col += base*er*uMetal*0.6;
  col += uRimCol*pow(1.0-max(dot(N,V),0.0),3.0)*uRim;
  col += emis;
  float d = length(vW-uCam); float fog = smoothstep(uFogN, uFogF, d);
  col = aces(col*1.0); col = pow(col, vec3(1.0/2.2));
  col = mix(col, uBg, fog);
  o = vec4(col*alpha, alpha);
#endif
}`;
const VS_SHADOW = SH_COMMON + `
layout(location=0) in vec3 aPos;
layout(location=2) in vec4 iM0; layout(location=3) in vec4 iM1; layout(location=4) in vec4 iM2; layout(location=5) in vec4 iM3;
uniform mat4 uLightVP, uModel;
void main(){ gl_Position = uLightVP * uModel * mat4(iM0,iM1,iM2,iM3) * vec4(aPos,1.0); }`;
const FS_SHADOW = SH_COMMON + `out vec4 o; void main(){ o = vec4(1.0); }`;
const VS_QUAD = SH_COMMON + `
out vec2 vUv; void main(){ vec2 p = vec2((gl_VertexID<<1)&2, gl_VertexID&2); vUv = p; gl_Position = vec4(p*2.0-1.0,0.0,1.0); }`;
const FS_BG = SH_COMMON + `
in vec2 vUv; out vec4 o; uniform vec3 uC0, uC1, uGlowC; uniform vec2 uGlowP; uniform float uGlowR, uTime;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 p = vUv; vec2 a = vec2((p.x-0.5)*0.5625, p.y-0.5);
  vec3 c = mix(uC0, uC1, smoothstep(0.0,1.0,p.y));
  vec2 g = vec2((p.x-uGlowP.x)*0.5625, p.y-uGlowP.y);
  c += uGlowC * exp(-dot(g,g)/(uGlowR*uGlowR));
  c *= 1.0 - 0.55*smoothstep(0.35, 0.95, length(a)*1.25);
  c += (h(p*vec2(1080.0,1920.0)+uTime)-0.5)*0.012;
  o = vec4(c,1.0);
}`;
const FS_BRIGHT = SH_COMMON + `
in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform float uThr;
void main(){ vec3 c = texture(uTex, vUv).rgb; float l = max(c.r,max(c.g,c.b)); o = vec4(c*smoothstep(uThr, 1.0, l), 1.0); }`;
const FS_BLUR = SH_COMMON + `
in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uDir;
void main(){ vec3 s = texture(uTex,vUv).rgb*0.227;
  s += (texture(uTex,vUv+uDir*1.385).rgb + texture(uTex,vUv-uDir*1.385).rgb)*0.316;
  s += (texture(uTex,vUv+uDir*3.231).rgb + texture(uTex,vUv-uDir*3.231).rgb)*0.070;
  o = vec4(s,1.0); }`;
const FS_COMP = SH_COMMON + `
in vec2 vUv; out vec4 o; uniform sampler2D uTex, uB1, uB2; uniform float uBloom, uFade, uTime, uZoom, uChrom, uDim;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec2 uv = (vUv-0.5)/uZoom+0.5;
  vec3 c;
  if(uChrom>0.0){ vec2 d=(uv-0.5)*uChrom; c = vec3(texture(uTex,uv+d).r, texture(uTex,uv).g, texture(uTex,uv-d).b); }
  else c = texture(uTex, uv).rgb;
  c += (texture(uB1, uv).rgb*0.6 + texture(uB2, uv).rgb*0.9)*uBloom;
  c += (h(vUv*vec2(1080.0,1920.0)+fract(uTime))-0.5)*0.025;
  c = clamp(c, 0.0, 1.0);
  o = vec4(c*uFade*uDim, uFade);
}`;

class Engine {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
    this.gl = gl; this.canvas = canvas;
    this.variants = new Map(); this.pShadow = this.prog(VS_SHADOW, FS_SHADOW);
    this.pBg = this.prog(VS_QUAD, FS_BG); this.pBright = this.prog(VS_QUAD, FS_BRIGHT); this.pBlur = this.prog(VS_QUAD, FS_BLUR); this.pComp = this.prog(VS_QUAD, FS_COMP);
    this.instBuf = gl.createBuffer(); this.vaoCache = new Map();
    this.emptyVao = gl.createVertexArray();
    // MSAA scene target
    const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
    this.msFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.msFbo);
    const rbC = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rbC); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, RW, RH);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rbC);
    const rbD = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rbD); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, RW, RH);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbD);
    this.scene = this.target(RW, RH); this.half = this.target(RW / 2, RH / 2); this.q1 = this.target(Math.round(RW / 4), Math.round(RH / 4)); this.q2 = this.target(Math.round(RW / 4), Math.round(RH / 4));
    this.e1 = this.target(Math.round(RW / 8), Math.round(RH / 8)); this.e2 = this.target(Math.round(RW / 8), Math.round(RH / 8));
    // shadow map
    this.SM = 2048; this.shTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.shTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, this.SM, this.SM, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.shFbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.shFbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.meshes = new Map();
    this.reset();
  }
  reset() {
    this.list = []; this.time = 0;
    this.cam = { eye: [0, 2, 5], at: [0, 0.5, 0], fov: 40, up: [0, 1, 0] };
    this.light = { dir: V3.norm([-0.5, 1.0, 0.6]), col: [2.0, 1.88, 1.72], amb: 1.15, box: 3, center: [0, 0, 0] };
    this.bg = { c0: [0.035, 0.035, 0.045], c1: [0.075, 0.07, 0.085], glow: [0.20, 0.14, 0.03], glowP: [0.5, 0.62], glowR: 0.35 };
    this.fog = { n: 8, f: 18 }; this.tAlpha = this.tAlpha ?? 1; this.tDim = this.tDim ?? 1; this.tZoom = this.tZoom ?? 1; this.bloom = 0.9; this.bloomThr = 0.72; this.fade = 1; this.zoom = 1; this.chrom = 0;
    this.grid = { k: 2, scroll: [0, 0], col: [0.2, 0.8, 1.0], glow: 0 };
  }
  mainProg(mode, pat) { const k = mode + '_' + pat; if (!this.variants.has(k)) this.variants.set(k, this.prog(VS_MAIN, SH_COMMON.replace('precision highp float;', `precision highp float;\n#define MODE ${mode}\n#define PAT ${pat}`) + FS_MAIN)); return this.variants.get(k); }
  prog(vs, fs) {
    const gl = this.gl; const p = gl.createProgram();
    for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) + '\n' + s.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
      gl.attachShader(p, sh);
    }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    p.u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); p.u[info.name] = gl.getUniformLocation(p, info.name); }
    return p;
  }
  target(w, h) {
    const gl = this.gl; const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo, w, h };
  }
  mesh(key, make) {
    if (this.meshes.has(key)) return this.meshes.get(key);
    const g = make(); const gl = this.gl;
    const m = { pos: gl.createBuffer(), nrm: gl.createBuffer(), idx: gl.createBuffer(), count: g.idx.length, stride: g.stride || 0, vaos: new Map() };
    gl.bindBuffer(gl.ARRAY_BUFFER, m.pos); gl.bufferData(gl.ARRAY_BUFFER, g.pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.nrm); gl.bufferData(gl.ARRAY_BUFFER, g.nrm, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW);
    this.meshes.set(key, m); return m;
  }
  vao(m, ib) {
    if (m.vaos.has(ib)) return m.vaos.get(ib);
    const gl = this.gl; const v = gl.createVertexArray(); gl.bindVertexArray(v);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.pos); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.nrm); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, ib);
    for (let i = 0; i < 5; i++) { gl.enableVertexAttribArray(2 + i); gl.vertexAttribPointer(2 + i, 4, gl.FLOAT, false, 80, i * 16); gl.vertexAttribDivisor(2 + i, 1); }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx); gl.bindVertexArray(null);
    m.vaos.set(ib, v); return v;
  }
  instances(list) { // [{m, c:[r,g,b,a]}] -> Float32Array
    const a = new Float32Array(list.length * 20);
    list.forEach((it, i) => { a.set(it.m, i * 20); a.set(it.c || [1, 1, 1, 1], i * 20 + 16); });
    return a;
  }
  staticInst(list) { const gl = this.gl; const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, this.instances(list), gl.STATIC_DRAW); b.n = list.length; return b; }
  // queue a draw. mat: material props
  add(mesh, inst, mat = {}, model) {
    // inst: Float32Array matrix (single), array of {m,c}, or static buffer
    let item = { mesh, mat, model: model || M4.I() };
    if (inst instanceof WebGLBuffer) { item.ib = inst; item.n = inst.n; }
    else if (inst instanceof Float32Array) { item.data = this.instances([{ m: inst, c: mat.color ? [...mat.color, mat.alpha ?? 1] : [1, 1, 1, 1] }]); item.n = 1; }
    else { const mc = mat.color; item.data = this.instances(mc ? inst.map(it => ({ m: it.m, c: it.c ? [it.c[0] * mc[0], it.c[1] * mc[1], it.c[2] * mc[2], it.c[3] ?? 1] : [...mc, 1] })) : inst); item.n = inst.length; }
    this.list.push(item); return item;
  }
  setUniforms(p, mat) {
    const gl = this.gl, u = p.u;
    gl.uniform3fv(u.uEmis, mat.emis || [0, 0, 0]); gl.uniform1f(u.uRough, mat.rough ?? 0.5); gl.uniform1f(u.uMetal, mat.metal ?? 0);
    gl.uniform1f(u.uOpacity, mat.opacity ?? 1); 
    gl.uniform3fv(u.uRimCol, mat.rimCol || this.grid.col); gl.uniform1f(u.uRim, mat.rim ?? 0.0);
    gl.uniform1f(u.uUseShadow, mat.noShadowRecv ? 0 : 1);
  }
  bindItem(item) {
    const gl = this.gl; let ib = item.ib;
    if (!ib) { ib = this.instBuf; gl.bindBuffer(gl.ARRAY_BUFFER, ib); gl.bufferData(gl.ARRAY_BUFFER, item.data, gl.DYNAMIC_DRAW); }
    gl.bindVertexArray(this.vao(item.mesh, ib));
  }
  count(item) { const c = item.mat.range != null ? Math.min(item.mesh.count, Math.max(0, Math.floor(item.mat.range))) : item.mesh.count; return c - (c % 3); }
  render(t) {
    const gl = this.gl; this.time = t; const TT = this.prof ? (k) => { gl.finish(); this.prof[k] = (this.prof[k] || 0) + performance.now() - this._t; this._t = performance.now(); } : () => {}; this._t = performance.now();
    const asp = W / H; const proj = M4.persp(this.cam.fov * Math.PI / 180, asp, 0.05, 60);
    const view = M4.lookAt(this.cam.eye, this.cam.at, this.cam.up); this.VP = M4.mul(proj, view);
    const L = this.light; const lc = L.center; const le = V3.add(lc, V3.scale(L.dir, 10));
    const lview = M4.lookAt(le, lc, Math.abs(L.dir[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0]);
    const lproj = M4.ortho(-L.box, L.box, -L.box, L.box, 0.1, 30); this.LVP = M4.mul(lproj, lview);
    // shadow pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shFbo); gl.viewport(0, 0, this.SM, this.SM);
    gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.useProgram(this.pShadow); gl.uniformMatrix4fv(this.pShadow.u.uLightVP, false, this.LVP);
    if (!(this.dbg && this.dbg.ns)) for (const it of this.list) { if (it.mat.noShadow || it.mat.mode === 1 || (it.mat.opacity ?? 1) < 0.5 || it.mat.mode === 2) continue; gl.uniformMatrix4fv(this.pShadow.u.uModel, false, it.model); this.bindItem(it); gl.drawElementsInstanced(gl.TRIANGLES, this.count(it), gl.UNSIGNED_INT, 0, it.n); }
    TT('shadow');
    // main pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.msFbo); gl.viewport(0, 0, RW, RH);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // background
    gl.disable(gl.DEPTH_TEST); gl.useProgram(this.pBg); const b = this.bg;
    gl.uniform3fv(this.pBg.u.uC0, b.c0); gl.uniform3fv(this.pBg.u.uC1, b.c1); gl.uniform3fv(this.pBg.u.uGlowC, b.glow); gl.uniform2fv(this.pBg.u.uGlowP, b.glowP); gl.uniform1f(this.pBg.u.uGlowR, b.glowR); gl.uniform1f(this.pBg.u.uTime, t);
    gl.bindVertexArray(this.emptyVao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    const bgMid = V3.lerp(b.c0, b.c1, 0.45);
    const used = new Set();
    const useP = (mat) => {
      const p = this.mainProg(mat.mode || 0, mat.pat || 0); gl.useProgram(p); const u = p.u;
      if (!used.has(p)) { used.add(p);
        gl.uniformMatrix4fv(u.uVP, false, this.VP); gl.uniformMatrix4fv(u.uLightVP, false, this.LVP);
        gl.uniform3fv(u.uCam, this.cam.eye); gl.uniform3fv(u.uLdir, L.dir); gl.uniform3fv(u.uLcol, L.col); gl.uniform1f(u.uAmb, L.amb);
        gl.uniform1f(u.uTime, t); gl.uniform1f(u.uFogN, this.fog.n); gl.uniform1f(u.uFogF, this.fog.f); gl.uniform3fv(u.uBg, bgMid);
        gl.uniform1f(u.uGrid, this.grid.k); gl.uniform2fv(u.uScroll, this.grid.scroll); gl.uniform1f(u.uGlow, this.grid.glow);
        gl.uniform1i(u.uShadow, 0);
      }
      return p;
    };
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shTex);
    const camE = this.cam.eye; const dist = (it) => { const m = it.model; return Math.hypot(m[12] - camE[0], m[13] - camE[1], m[14] - camE[2]); };
    const opaque = this.list.filter(it => !it.mat.mode && (it.mat.opacity ?? 1) >= 0.999 && !(it.mat.alpha < 1) && !it.mat.late);
    const trans = this.list.filter(it => !opaque.includes(it));
    opaque.sort((x, y) => (x.mat.bgLayer ? 1 : 0) - (y.mat.bgLayer ? 1 : 0) || dist(x) - dist(y));
    gl.disable(gl.BLEND); gl.depthMask(true);
    for (const it of opaque) { const p = useP(it.mat); gl.uniformMatrix4fv(p.u.uModel, false, it.model); this.setUniforms(p, it.mat); this.bindItem(it); gl.drawElementsInstanced(gl.TRIANGLES, this.count(it), gl.UNSIGNED_INT, 0, it.n); }
    gl.enable(gl.BLEND); gl.depthMask(false);
    for (const it of trans) {
      if (it.mat.mode === 1 || it.mat.additive) gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      if (it.mat.noDepth) gl.disable(gl.DEPTH_TEST); else gl.enable(gl.DEPTH_TEST);
      const p = useP(it.mat); gl.uniformMatrix4fv(p.u.uModel, false, it.model); this.setUniforms(p, it.mat); this.bindItem(it); gl.drawElementsInstanced(gl.TRIANGLES, this.count(it), gl.UNSIGNED_INT, 0, it.n);
    }
    TT('main');
    gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST);
    // resolve
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.msFbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.scene.fbo);
    gl.blitFramebuffer(0, 0, RW, RH, 0, 0, RW, RH, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    TT('resolve');
    // bloom
    gl.disable(gl.DEPTH_TEST); gl.bindVertexArray(this.emptyVao);
    const pass = (prog, src, dst, setup) => { gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo); gl.viewport(0, 0, dst.w, dst.h); gl.useProgram(prog); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); gl.uniform1i(prog.u.uTex, 0); if (setup) setup(prog.u); gl.drawArrays(gl.TRIANGLES, 0, 3); };
    pass(this.pBright, this.scene, this.half, u2 => gl.uniform1f(u2.uThr, this.bloomThr));
    pass(this.pBlur, this.half, this.q1, u2 => gl.uniform2f(u2.uDir, 1 / this.half.w, 0));
    for (let i = 0; i < 2; i++) {
      pass(this.pBlur, this.q1, this.q2, u2 => gl.uniform2f(u2.uDir, 0, 1.5 / this.q1.h));
      pass(this.pBlur, this.q2, this.q1, u2 => gl.uniform2f(u2.uDir, 1.5 / this.q1.w, 0));
    }
    pass(this.pBlur, this.q1, this.e1, u2 => gl.uniform2f(u2.uDir, 2 / this.q1.w, 0));
    for (let i = 0; i < 2; i++) {
      pass(this.pBlur, this.e1, this.e2, u2 => gl.uniform2f(u2.uDir, 0, 1.5 / this.e1.h));
      pass(this.pBlur, this.e2, this.e1, u2 => gl.uniform2f(u2.uDir, 1.5 / this.e1.w, 0));
    }
    TT('bloom');
    // composite
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const pc = this.pComp; gl.useProgram(pc);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.scene.tex); gl.uniform1i(pc.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.q1.tex); gl.uniform1i(pc.u.uB1, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.e1.tex); gl.uniform1i(pc.u.uB2, 2);
    gl.uniform1f(pc.u.uBloom, this.bloom); gl.uniform1f(pc.u.uFade, this.fade * this.tAlpha); gl.uniform1f(pc.u.uDim, this.tDim); gl.uniform1f(pc.u.uTime, t); gl.uniform1f(pc.u.uZoom, this.zoom * this.tZoom); gl.uniform1f(pc.u.uChrom, this.chrom);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0); TT('comp');
    this.list = [];
  }
  camVP() { const proj = M4.persp(this.cam.fov * Math.PI / 180, W / H, 0.05, 60); return M4.mul(proj, M4.lookAt(this.cam.eye, this.cam.at, this.cam.up)); }
  project(p) { const q = M4.apply(this.camVP(), p); return [(q[0] * 0.5 + 0.5) * W, (1 - (q[1] * 0.5 + 0.5)) * H]; }
}
