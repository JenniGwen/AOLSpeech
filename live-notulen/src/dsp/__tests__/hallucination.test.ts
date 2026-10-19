import { describe, expect, it } from "vitest";
import { cleanTranscript, collapseRepeats } from "../hallucination";

describe("cleanTranscript", () => {
  it("membuang anotasi suara", () => {
    expect(cleanTranscript("(swoosh)", 1)).toBe("");
    expect(cleanTranscript("[MEMBUSIUS TEMPTING]", 2)).toBe("");
    expect(cleanTranscript("(Cleming the doorbell)", 3)).toBe("");
    expect(cleanTranscript("♪ ♪", 3)).toBe("");
  });
  it("mempertahankan ucapan nyata", () => {
    expect(cleanTranscript("Untuk konsumsi kita pakai vendor semester lalu", 4)).toBe("Untuk konsumsi kita pakai vendor semester lalu");
    expect(cleanTranscript("oke (tertawa) lanjut ya", 2)).toBe("oke lanjut ya");
  });
  it("membuang loop pengulangan", () => {
    const loop = "(Selama ini, saya akan mencoba lebih banyak " + "yang mencoba lebih banyak ".repeat(8);
    expect(cleanTranscript(loop, 8)).toBe("");
  });
  it("membuang outro hanya untuk audio pendek", () => {
    expect(cleanTranscript("Terima kasih telah menonton!", 1.5)).toBe("");
    expect(cleanTranscript("Terima kasih", 4)).toBe("Terima kasih");
  });
});

describe("collapseRepeats", () => {
  it("meringkas ulangan ≥ 3×", () => {
    expect(collapseRepeats("ya ya ya setuju")).toBe("ya setuju");
    expect(collapseRepeats("a b a b a b c")).toBe("a b c");
    expect(collapseRepeats("iya iya oke")).toBe("iya iya oke");
  });
});

describe("filler & tanda kutip", () => {
  it("membuang segmen yang cuma bunyi", () => {
    for (const s of ["Shhh!", "Ssst...", "Hmm.", "Ehm, ehm.", "Psst", "Ah!", "huh?"]) expect(cleanTranscript(s, 1)).toBe("");
  });
  it("filler di dalam kalimat tetap", () => expect(cleanTranscript("Hmm, oke kita lanjut", 2)).toBe("Hmm, oke kita lanjut"));
  it("membuang tanda kutip", () => expect(cleanTranscript('"Alho, kita siapkan "badjet event" dan "rismatikasi"nya', 5)).toBe("Alho, kita siapkan badjet event dan rismatikasinya"));
});
