// SABLE YARD — seeded random numbers. One tiny generator so a seed replays
// the same way: mulberry32, fast and deterministic across browsers.
export class Rng {
  constructor(seed = 1337) {
    this.s = (seed >>> 0) || 1;
  }
  // Next float in [0, 1).
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) {
    return a + (b - a) * this.next();
  }
  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
  chance(p) {
    return this.next() < p;
  }
  // Gaussian-ish jitter in [-1, 1] from two draws.
  gauss() {
    return this.next() + this.next() - 1;
  }
}

// A module-level convenience generator for cosmetic randomness.
export const cosmetic = new Rng(20261117);
