// MFCC manual — port persis dari notebook Bagian 3 (mfcc_manual). Tanpa library MFCC.
import { MFCC, SR } from "../config";

const { nMfcc, nFft, nMels, preEmph, lifter } = MFCC;
const FRAME = Math.round((SR * MFCC.frameMs) / 1000); // 400
const HOP = Math.round((SR * MFCC.hopMs) / 1000); // 160
const N_BINS = nFft / 2 + 1; // 257

const hzToMel = (f: number) => 2595 * Math.log10(1 + f / 700);
const melToHz = (m: number) => 700 * (10 ** (m / 2595) - 1);

/** 26 filter segitiga, titik tengah rata di skala mel 0–8000 Hz, bobot dari frekuensi bin yang tepat. */
export function melFilterbank(): Float64Array[] {
  const mMax = hzToMel(SR / 2);
  const hz = Array.from({ length: nMels + 2 }, (_, i) => melToHz((mMax * i) / (nMels + 1)));
  return Array.from({ length: nMels }, (_, m) => {
    const [l, c, r] = [hz[m], hz[m + 1], hz[m + 2]];
    const row = new Float64Array(N_BINS);
    for (let k = 0; k < N_BINS; k++) {
      const f = (k * (SR / 2)) / (N_BINS - 1);
      row[k] = Math.max(0, Math.min((f - l) / (c - l), (r - f) / (r - c)));
    }
    return row;
  });
}

export const FB = melFilterbank();
const HAMMING = Float64Array.from({ length: FRAME }, (_, n) => 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (FRAME - 1)));
const DCT = Array.from({ length: nMfcc }, (_, i) =>
  Float64Array.from({ length: nMels }, (_, m) => Math.sqrt((i === 0 ? 1 : 2) / nMels) * Math.cos((Math.PI * i * (m + 0.5)) / nMels)));
const LIFT = Float64Array.from({ length: nMfcc }, (_, i) => (lifter ? 1 + (lifter / 2) * Math.sin((Math.PI * i) / lifter) : 1));

/** FFT radix-2 in-place. */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

/** Float32Array 16 kHz → number[nFrames][13] (c0..c12). */
export function mfcc(x: ArrayLike<number>): number[][] {
  // 1. pre-emphasis (+ pad nol kalau < 1 frame)
  const emph = new Float64Array(Math.max(x.length, FRAME));
  if (x.length) emph[0] = x[0];
  for (let n = 1; n < x.length; n++) emph[n] = x[n] - preEmph * x[n - 1];

  const nFrames = 1 + Math.floor((emph.length - FRAME) / HOP);
  const re = new Float64Array(nFft), im = new Float64Array(nFft), power = new Float64Array(N_BINS), logMel = new Float64Array(nMels);
  const out: number[][] = [];
  for (let t = 0; t < nFrames; t++) {
    // 2+3. framing + Hamming, zero-pad ke 512
    re.fill(0); im.fill(0);
    for (let n = 0; n < FRAME; n++) re[n] = emph[t * HOP + n] * HAMMING[n];
    // 4. FFT → power spectrum
    fft(re, im);
    for (let k = 0; k < N_BINS; k++) power[k] = (re[k] * re[k] + im[k] * im[k]) / nFft;
    // 5+6. mel filterbank + ln
    for (let m = 0; m < nMels; m++) {
      let e = 0;
      const row = FB[m];
      for (let k = 0; k < N_BINS; k++) e += power[k] * row[k];
      logMel[m] = Math.log(Math.max(e, 1e-10));
    }
    // 7+8. DCT-II ortho + lifter
    const c = new Array<number>(nMfcc);
    for (let i = 0; i < nMfcc; i++) {
      let s = 0;
      for (let m = 0; m < nMels; m++) s += DCT[i][m] * logMel[m];
      c[i] = s * LIFT[i];
    }
    out.push(c);
  }
  return out;
}
