import type { Rng } from "./types";

/** mulberry32 xác định: cùng seed cho cùng dãy, các seed liên tiếp cho dãy khác hẳn nhau. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return (maxExclusive) => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 2 ** 32) * maxExclusive);
  };
}
