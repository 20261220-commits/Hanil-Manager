// 시드가 있는 난수. 같은 시드면 같은 학생들이 나온다.
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    gauss: () => {
      let u = 0;
      while (!u) u = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
    },
    weighted: (pairs) => {
      const total = pairs.reduce((s, p) => s + p[1], 0);
      let r = next() * total;
      for (const p of pairs) { r -= p[1]; if (r < 0) return p[0]; }
      return pairs[pairs.length - 1][0];
    },
    shuffle: (list) => {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
      return out;
    },
  };
}

export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
