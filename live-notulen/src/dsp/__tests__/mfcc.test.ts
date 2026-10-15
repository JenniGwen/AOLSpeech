import { describe, expect, it } from "vitest";
import { FB, mfcc } from "../mfcc";
import ref from "./mfcc_reference.json";

const TOL = 1e-3;
// Input sama dengan notebook: 0.5*sin(2π·440·t), 16000 sampel (float64)
const y = Float64Array.from({ length: 16000 }, (_, n) => 0.5 * Math.sin((2 * Math.PI * 440 * n) / 16000));
const out = mfcc(y);

describe("MFCC manual vs notebook", () => {
  it("jumlah frame & 13 koefisien", () => {
    expect(out.length).toBe(ref.n_frames);
    expect(out[0].length).toBe(13);
  });

  it("3 frame pertama", () => {
    ref.frames_0_1_2.forEach((row, t) => row.forEach((v, i) => expect(Math.abs(out[t][i] - v)).toBeLessThan(TOL)));
  });

  it("rata-rata per koefisien", () => {
    ref.mean_per_coef.forEach((v, i) => {
      const m = out.reduce((s, f) => s + f[i], 0) / out.length;
      expect(Math.abs(m - v)).toBeLessThan(TOL);
    });
  });

  it("filterbank baris 5", () => {
    const want = ref.filterbank_row_5_nonzero as Record<string, number>;
    FB[5].forEach((w, k) => expect(Math.abs(w - (want[k] ?? 0))).toBeLessThan(TOL));
  });
});
