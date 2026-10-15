// VAD dari c0 (energi frame) + noise floor adaptif — notebook Bagian 4 & 8.
import { VAD } from "../config";
import { mfcc } from "./mfcc";

function percentile(v: number[], p: number) {
  // sama dengan np.percentile (interpolasi linear)
  const s = [...v].sort((a, b) => a - b), pos = (p / 100) * (s.length - 1), lo = Math.floor(pos);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (pos - lo);
}

export class C0Vad {
  floor: number | null = null;

  /** Satu chunk 0,5 s → apakah ada ucapan. */
  isSpeech(chunk: Float32Array): boolean {
    const c0 = mfcc(chunk).map((c) => c[0]);
    const p10 = percentile(c0, 10);
    if (this.floor === null) this.floor = p10;
    else if (p10 < this.floor) this.floor = 0.7 * this.floor + 0.3 * p10; // turun cepat
    else this.floor += 0.02 * (p10 - this.floor); // naik pelan
    const th = this.floor + VAD.marginC0;
    return c0.filter((v) => v > th).length / c0.length > VAD.speechFrac;
  }
}
