// Port langsung dari notebook Bagian 3 (mfcc_manual), 4 (VAD c0) dan 8 (SpeakerTracker).
export const SR = 16000;
const N_FFT = 512, N_FILT = 26, N_MFCC = 13, FRAME = 400, HOP = 160, PRE = 0.97, LIFTER = 22;

const hzToMel = (f) => 2595 * Math.log10(1 + f / 700);
const melToHz = (m) => 700 * (10 ** (m / 2595) - 1);

function melFilterbank() {
  const nb = N_FFT / 2 + 1, mMax = hzToMel(SR / 2);
  const hz = Array.from({ length: N_FILT + 2 }, (_, i) => melToHz((mMax * i) / (N_FILT + 1)));
  const fb = [];
  for (let m = 0; m < N_FILT; m++) {
    const [l, c, r] = [hz[m], hz[m + 1], hz[m + 2]], row = new Float64Array(nb);
    for (let k = 0; k < nb; k++) {
      const f = (k * SR) / 2 / (nb - 1);
      row[k] = Math.max(0, Math.min((f - l) / (c - l), (r - f) / (r - c)));
    }
    fb.push(row);
  }
  return fb;
}
const FB = melFilterbank();
const HAMMING = Float64Array.from({ length: FRAME }, (_, n) => 0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (FRAME - 1)));
// DCT-II ortho, hanya 13 koefisien pertama
const DCT = Array.from({ length: N_MFCC }, (_, k) =>
  Float64Array.from({ length: N_FILT }, (_, n) =>
    Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N_FILT)) * Math.sqrt((k === 0 ? 1 : 2) / N_FILT)));
const LIFT = Float64Array.from({ length: N_MFCC }, (_, i) => 1 + (LIFTER / 2) * Math.sin((Math.PI * i) / LIFTER));

// FFT radix-2 in-place (re, im panjang N_FFT)
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

/** MFCC manual: pre-emphasis → framing 25ms/hop 10ms → Hamming → |FFT|²/N → 26 mel → log → DCT → lifter. Return array of Float64Array(13). */
export function mfcc(y) {
  let emph = new Float64Array(Math.max(y.length, FRAME));
  emph[0] = y[0] || 0;
  for (let i = 1; i < y.length; i++) emph[i] = y[i] - PRE * y[i - 1];
  const nFrames = 1 + Math.floor((emph.length - FRAME) / HOP), out = [];
  const re = new Float64Array(N_FFT), im = new Float64Array(N_FFT), logMel = new Float64Array(N_FILT);
  for (let t = 0; t < nFrames; t++) {
    re.fill(0); im.fill(0);
    for (let n = 0; n < FRAME; n++) re[n] = emph[t * HOP + n] * HAMMING[n];
    fft(re, im);
    for (let m = 0; m < N_FILT; m++) {
      let e = 0; const row = FB[m];
      for (let k = 0; k <= N_FFT / 2; k++) if (row[k]) e += row[k] * ((re[k] * re[k] + im[k] * im[k]) / N_FFT);
      logMel[m] = Math.log(Math.max(e, 1e-10));
    }
    const c = new Float64Array(N_MFCC);
    for (let k = 0; k < N_MFCC; k++) {
      let s = 0; for (let n = 0; n < N_FILT; n++) s += DCT[k][n] * logMel[n];
      c[k] = s * LIFT[k];
    }
    out.push(c);
  }
  return out;
}

/** VAD streaming berbasis c0 (notebook Bagian 8): noise floor turun cepat, naik pelan. */
export class C0Vad {
  constructor(margin = 3.0, ratio = 0.3) { this.margin = margin; this.ratio = ratio; this.floor = null; }
  isSpeech(chunk) {
    const c0 = mfcc(chunk).map((c) => c[0]);
    const sorted = [...c0].sort((a, b) => a - b), p10 = sorted[Math.floor(0.1 * (sorted.length - 1))];
    if (this.floor === null) this.floor = p10;
    else this.floor = p10 < this.floor ? 0.7 * this.floor + 0.3 * p10 : this.floor + 0.02 * (p10 - this.floor);
    return c0.filter((v) => v > this.floor + this.margin).length / c0.length > this.ratio;
  }
}

/** Online clustering embedding MFCC 13-d (mean+std, dinormalisasi statistik global berjalan). */
export class SpeakerTracker {
  constructor(threshold = 0.6) { this.th = threshold; this.cents = []; this.counts = []; this.n = 0; this.sum = new Float64Array(N_MFCC); this.sq = new Float64Array(N_MFCC); }
  assign(frames) {
    for (const f of frames) for (let i = 0; i < N_MFCC; i++) { this.sum[i] += f[i]; this.sq[i] += f[i] * f[i]; }
    this.n += frames.length;
    const mu = this.sum.map((s) => s / this.n), sd = this.sq.map((q, i) => Math.sqrt(Math.max(q / this.n - mu[i] ** 2, 0)) + 1e-6);
    const z = frames.map((f) => f.map((v, i) => (v - mu[i]) / sd[i]));
    const m = new Float64Array(N_MFCC), s = new Float64Array(N_MFCC);
    for (const f of z) for (let i = 0; i < N_MFCC; i++) m[i] += f[i] / z.length;
    for (const f of z) for (let i = 0; i < N_MFCC; i++) s[i] += (f[i] - m[i]) ** 2 / z.length;
    const e = [...m, ...s.map(Math.sqrt)];
    const cos = (a, b) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; } return d / (Math.sqrt(na * nb) + 1e-9); };
    if (this.cents.length) {
      const sims = this.cents.map((c) => cos(e, c)), k = sims.indexOf(Math.max(...sims));
      if (sims[k] >= this.th) {
        this.counts[k]++; this.cents[k] = this.cents[k].map((c, i) => c + (e[i] - c) / this.counts[k]);
        return k;
      }
    }
    this.cents.push(e); this.counts.push(1);
    return this.cents.length - 1;
  }
}
