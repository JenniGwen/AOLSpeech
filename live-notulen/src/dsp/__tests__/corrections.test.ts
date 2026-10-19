import { describe, expect, it } from "vitest";
import { applyCorrections, correctionTerms, learnCorrections } from "../corrections";

const before = "Halau, hari ini kita akan menghadapkan meeting tentang yaitu The Joint Isaac. Kalihan udah selesai menyeapkan budget event";
const after = "Halo, hari ini kita akan mengadakan meeting tentang Youth Today AIESEC. Kalian udah selesai menyiapkan budget event";

describe("learnCorrections", () => {
  it("mengambil penggantian kata dari editan", () => {
    expect(learnCorrections(before, after)).toEqual([
      ["halau", "halo"],
      ["menghadapkan", "mengadakan"],
      ["yaitu the joint isaac", "Youth Today AIESEC"],
      ["kalihan", "kalian"],
      ["menyeapkan", "menyiapkan"],
    ]);
  });
  it("frasa berulang & kata yang tergeser batasnya", () => {
    expect(learnCorrections("Yangat bah, yangat bah.", "Yang apa, yang apa.")).toEqual([["yangat", "yang"], ["bah", "apa"]]);
    expect(learnCorrections("Halo, yang hier.", "Halo, yang here.")).toEqual([["hier", "here"]]);
    expect(applyCorrections("Yangat bah, yangat bah.", { yangat: "yang", bah: "apa" })).toBe("Yang apa, yang apa.");
  });
  it("tidak belajar dari tambah/hapus kata atau ganti tanda baca saja", () => {
    expect(learnCorrections("oke kita lanjut", "oke kita lanjut saja")).toEqual([]);
    expect(learnCorrections("oke kita lanjut", "oke, kita lanjut!")).toEqual([]);
  });
});

describe("applyCorrections", () => {
  it("menerapkan koreksi user + bawaan", () => {
    const map = { isaac: "AIESEC" };
    expect(applyCorrections("Halau, rapat The Joint Isaac. Kalihan menyeapkan", map)).toBe("Halo, rapat The Joint AIESEC. Kalian menyiapkan");
  });
  it("frasa multi-kata & kapital awal", () => {
    expect(applyCorrections("yaitu the joint isaac hari ini", { "yaitu the joint": "Youth Today" })).toBe("Youth Today isaac hari ini");
    expect(applyCorrections("Menyeapkan semuanya", {})).toBe("Menyiapkan semuanya");
  });
  it("kata ulang bertanda hubung & ejaan dengar", () => {
    expect(applyCorrections("Halau-halau, saya disini.", {})).toBe("Halo-halo, saya di sini.");
    expect(applyCorrections("Halou, halou, sayah di sini.", {})).toBe("Halo, halo, saya di sini.");
    expect(applyCorrections("Halo, yang hier. Kita hari ini ada meeting.", {})).toBe("Halo, yang here. Kita hari ini ada meeting.");
  });
  it("istilah hasil koreksi", () => expect(correctionTerms({ isaac: "AIESEC", menyeapkan: "menyiapkan" })).toEqual(["AIESEC"]));
});
