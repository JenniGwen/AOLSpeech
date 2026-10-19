import { describe, expect, it } from "vitest";
import { f0Frames, pitchTurn, semitones } from "../pitch";
import { SpeakerTracker } from "../speaker";
import { mfcc } from "../mfcc";

const SR = 16000;
/** Vokal sintetis: harmonik F0 dengan envelope formant tetap (warna suara sama, nada beda). */
const vowel = (f0: number, sec = 1.5) =>
  Float32Array.from({ length: sec * SR }, (_, i) => {
    let v = 0;
    for (let h = 1; f0 * h < 4000; h++) { const f = f0 * h; v += Math.sin((2 * Math.PI * f * i) / SR) * (Math.exp(-((f - 700) ** 2) / 2e5) + 0.6 * Math.exp(-((f - 1200) ** 2) / 3e5) + 0.05); }
    return v * 0.05;
  });

describe("f0Frames", () => {
  it.each([110, 160, 220])("mengukur F0 %i Hz", (f0) => {
    const st = semitones(f0Frames(vowel(f0, 0.5)), 5)!;
    expect(Math.abs(100 * 2 ** (st / 12) - f0)).toBeLessThan(f0 * 0.03);
  });
  it("hening → tidak ada frame bersuara", () => expect(f0Frames(new Float32Array(SR / 2))).toEqual([]));
});

describe("pitchTurn", () => {
  it("pitch melompat & bertahan → potong", () => expect(pitchTurn([12, 13, 12, 12, 3, 2, null], 3, 5.5)).toBe(4));
  it("intonasi turun pelan → tidak dipotong", () => expect(pitchTurn([12, 11, 10, 9, 8, 8, 7], 3, 5.5)).toBe(-1));
  it("chunk baru belum stabil → tunggu", () => expect(pitchTurn([12, 12, 12, 12, 2, 9, 3], 3, 5.5)).toBe(-1));
});

describe("SpeakerTracker + pitch", () => {
  it("warna suara sama, nada beda 7 semiton → speaker berbeda", () => {
    const lo = vowel(120), hi = vowel(180);
    const st = (x: Float32Array) => semitones(f0Frames(x), 8);
    const withPitch = new SpeakerTracker("distance");
    expect([lo, hi, lo, hi].map((x) => withPitch.assign(mfcc(x), st(x)))).toEqual([0, 1, 0, 1]);
  });
});
