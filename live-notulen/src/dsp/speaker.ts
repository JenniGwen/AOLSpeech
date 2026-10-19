// SpeakerTracker — online clustering MFCC 13-d per segmen final → "Speaker 1, 2, …".
//
// Dua metode (pilih di config.ts → SPEAKER.method):
//  - "cosine"   : persis notebook Bagian 8. Embedding = concat(mean(z), std(z)), z = MFCC dinormalisasi
//                 statistik global berjalan; cosine ke centroid ≥ threshold → speaker sama.
//                 Masalah yang terlihat saat uji (suara TTS laki-laki/perempuan): separuh embedding (std(z))
//                 ≈1 untuk semua orang → cosine antar orang berbeda tetap 0.75–0.9 → semua jadi "Speaker 1".
//                 Saat baru ada 2 segmen, normalisasi global juga membuat embedding selalu berlawanan arah.
//  - "distance" : (default) statistik MFCC per segmen (mean & std per koefisien c0–c12), jarak =
//                 rata-rata |Δmean| / sebaran frame gabungan. Tidak bergantung statistik global, jadi
//                 stabil sejak segmen ke-2. Uji TTS: speaker sama 0.26–0.72, beda gender > 0.85.
//                 + pitch (median F0, semiton): MFCC tidak peka nada, jadi suara tinggi vs rendah dengan warna
//                 mirip tetap tergabung. Beda pitch ≥ PITCH.speakerSemitones → speaker lain.
import { PITCH, SPEAKER } from "../config";

interface Stats { mean: number[]; std: number[]; pitch?: number | null; pitchN?: number }

const segStats = (mf: number[][]): Stats => {
  const d = mf[0]?.length ?? 13;
  const mean = new Array(d).fill(0), v = new Array(d).fill(0);
  for (const f of mf) for (let i = 0; i < d; i++) mean[i] += f[i] / mf.length;
  for (const f of mf) for (let i = 0; i < d; i++) v[i] += (f[i] - mean[i]) ** 2 / mf.length;
  return { mean, std: v.map(Math.sqrt) };
};

const distance = (a: Stats, b: Stats) => {
  let t = 0;
  for (let i = 0; i < a.mean.length; i++) t += Math.abs(a.mean[i] - b.mean[i]) / (Math.sqrt((a.std[i] ** 2 + b.std[i] ** 2) / 2) + 1e-6);
  return t / a.mean.length;
};

/** Tambahan jarak dari beda pitch (Infinity = pasti beda speaker). */
const pitchPenalty = (a: number | null | undefined, b: number | null | undefined) => {
  if (a == null || b == null) return 0;
  const d = Math.abs(a - b);
  return d >= PITCH.speakerSemitones ? Infinity : Math.max(0, d - PITCH.tolerance) * PITCH.perSemitone;
};

const cosine = (a: number[], b: number[]) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
};

export class SpeakerTracker {
  private cents: (Stats | number[])[] = [];
  private counts: number[] = [];
  // statistik global berjalan (metode cosine) — setara np.vstack(all).mean/std tanpa menyimpan semua frame
  private n = 0;
  private sum: number[] = [];
  private sq: number[] = [];

  constructor(private method: "distance" | "cosine" = SPEAKER.method) {}

  /** mf: frames×13 dari satu segmen final (+ pitch semiton bila ada) → indeks speaker (0, 1, …). */
  assign(mf: number[][], pitch: number | null = null): number {
    return this.method === "cosine" ? this.assignCosine(mf) : this.assignDistance(mf, pitch);
  }

  private add(c: Stats | number[]) {
    this.cents.push(c);
    this.counts.push(1);
    return this.cents.length - 1;
  }

  private assignDistance(mf: number[][], pitch: number | null) {
    const s: Stats = { ...segStats(mf), pitch, pitchN: pitch == null ? 0 : 1 };
    if (this.cents.length) {
      const d = (this.cents as Stats[]).map((c) => distance(s, c) + pitchPenalty(pitch, c.pitch));
      const k = d.indexOf(Math.min(...d));
      if (d[k] < SPEAKER.maxDistance) {
        const c = this.cents[k] as Stats, n = ++this.counts[k];
        c.mean = c.mean.map((x, i) => x + (s.mean[i] - x) / n);
        c.std = c.std.map((x, i) => x + (s.std[i] - x) / n);
        if (pitch != null) { c.pitchN = (c.pitchN ?? 0) + 1; c.pitch = c.pitch == null ? pitch : c.pitch + (pitch - c.pitch) / c.pitchN; }
        return k;
      }
    }
    return this.add(s);
  }

  private assignCosine(mf: number[][]) {
    const d = mf[0]?.length ?? 13;
    if (!this.sum.length) { this.sum = new Array(d).fill(0); this.sq = new Array(d).fill(0); }
    for (const f of mf) for (let i = 0; i < d; i++) { this.sum[i] += f[i]; this.sq[i] += f[i] * f[i]; }
    this.n += mf.length;
    const mu = this.sum.map((x) => x / this.n);
    const sd = this.sq.map((q, i) => Math.sqrt(Math.max(q / this.n - mu[i] * mu[i], 0)) + 1e-6);
    const z = segStats(mf.map((f) => f.map((v, i) => (v - mu[i]) / sd[i])));
    const e = [...z.mean, ...z.std];
    if (this.cents.length) {
      const sims = (this.cents as number[][]).map((c) => cosine(e, c));
      const k = sims.indexOf(Math.max(...sims));
      if (sims[k] >= SPEAKER.threshold) {
        const n = ++this.counts[k];
        this.cents[k] = (this.cents[k] as number[]).map((c, i) => c + (e[i] - c) / n);
        return k;
      }
    }
    return this.add(e);
  }
}
