// Estimasi pitch (F0) dengan autokorelasi ternormalisasi — untuk membedakan speaker bersuara tinggi vs rendah.
// MFCC (c0–c12 + lifter) sengaja tidak peka pitch, jadi dua suara dengan warna mirip tapi nada beda tidak terpisah.
import { SR } from "../config";

const WIN = Math.round(SR * 0.025); // 400 sampel dibandingkan per lag
const HOP = Math.round(SR * 0.02);
const MIN_LAG = Math.floor(SR / 400), MAX_LAG = Math.ceil(SR / 70); // 70–400 Hz
const VOICED = 0.6; // korelasi minimum supaya frame dianggap bersuara

/** F0 (Hz) tiap frame bersuara di x; frame tak bersuara / hening dilewati. */
export function f0Frames(x: ArrayLike<number>): number[] {
  let peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  const out: number[] = [];
  for (let s = 0; s + WIN + MAX_LAG <= x.length; s += HOP) {
    let e0 = 0;
    for (let n = 0; n < WIN; n++) e0 += x[s + n] ** 2;
    if (Math.sqrt(e0 / WIN) < Math.max(1e-3, peak * 0.05)) continue; // terlalu pelan
    const r = new Float64Array(MAX_LAG + 1);
    let best = 0;
    for (let lag = MIN_LAG; lag <= MAX_LAG; lag++) {
      let xy = 0, e1 = 0;
      for (let n = 0; n < WIN; n++) { const a = x[s + n], b = x[s + n + lag]; xy += a * b; e1 += b * b; }
      r[lag] = xy / (Math.sqrt(e0 * e1) + 1e-12);
      if (r[lag] > best) best = r[lag];
    }
    if (best < VOICED) continue;
    // lag terkecil yang hampir setinggi puncak → hindari salah oktaf (F0/2)
    let lag = MIN_LAG;
    while (lag < MAX_LAG && !(r[lag] >= 0.9 * best && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1])) lag++;
    out.push(SR / lag);
  }
  return out;
}

const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };


export const semitones = (f0: number[], minVoicedFrames: number) =>
  f0.length >= minVoicedFrames ? 12 * Math.log2(median(f0) / 100) : null;

/**
 * Giliran bicara tanpa jeda: median pitch `n` chunk terakhir (minimal n−1 bersuara, saling dekat) bergeser
 * ≥ `split` semiton dari median chunk sebelumnya → indeks chunk awal speaker baru, atau -1.
 */
export function pitchTurn(p: (number | null)[], n: number, split: number): number {
  if (p.length < 2 * n) return -1;
  const last = p.slice(-n).filter((x): x is number => x != null), before = p.slice(0, -n).filter((x): x is number => x != null);
  if (before.length < n || last.length < n - 1) return -1;
  if (Math.max(...last) - Math.min(...last) > split * 0.7) return -1; // chunk baru sendiri belum stabil
  return Math.abs(median(last) - median(before)) >= split ? p.length - n : -1;
}
