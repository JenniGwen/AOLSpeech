import { describe, expect, it } from "vitest";
import { applyVocab, vocabPrompt } from "../vocab";

const V = "Youth Today, budget, progress, risk mitigation";

describe("applyVocab", () => {
  it("memperbaiki istilah yang ejaannya mirip", () => {
    expect(applyVocab("dan risp metigatiannya?", V)).toBe("dan risk mitigationnya?");
    expect(applyVocab("dan Risk Meticationnya?", V)).toBe("dan Risk mitigationnya?");
    expect(applyVocab("update pragres budget", V)).toBe("update progress budget");
    expect(applyVocab("tentang event youth today.", V)).toBe("tentang event Youth Today.");
  });
  it("nama pendek dari kosakata user", () => {
    expect(applyVocab("meeting tentang Yereka General Members' Recruitment.", "Ureeka")).toBe("meeting tentang Ureeka General Members' Recruitment.");
    expect(applyVocab("Yereka atau Yereka?", "Ureeka")).toBe("Ureeka atau Ureeka?");
    expect(applyVocab("rika dan raka ke sana", "Ureeka")).toBe("rika dan raka ke sana");
  });
  it("tidak mengubah kata biasa", () => {
    const s = "hari ini kita ada meeting tentang acara kampus dan konsumsi";
    expect(applyVocab(s, V)).toBe(s);
    expect(applyVocab("Untuk konsumsi kita pakai vendor semester lalu", V)).toBe("Untuk konsumsi kita pakai vendor semester lalu");
  });
  it("tanpa kosakata → istilah bawaan tetap dipakai", () => expect(applyVocab("risp metigasi", "")).toBe("risk mitigation"));
});

describe("vocabPrompt", () => {
  it("kalimat daftar", () => {
    expect(vocabPrompt(V)).toBe("Rapat membahas Youth Today, budget, progress, dan risk mitigation.");
    expect(vocabPrompt("Youth Today")).toBe("Rapat membahas Youth Today.");
    expect(vocabPrompt(" , ")).toBe("");
  });
});

describe("applyVocab — istilah bawaan & bunyi (tanpa kosakata user)", () => {
  it("memperbaiki ejaan dengar", () => {
    expect(applyVocab("Kalihan sudah menyiapkan badjet event dan rismatikasinya belum.", "")).toBe("Kalihan sudah menyiapkan budget event dan risk mitigationnya belum.");
    expect(applyVocab("kita ada miting hari ini", "")).toBe("kita ada meeting hari ini");
    expect(applyVocab("progres proker paling penting", "")).toBe("progres proker paling penting");
    expect(applyVocab("risiko dan mitigasinya", "")).toBe("risiko dan mitigasinya");
  });
  it("tidak mengubah kalimat Indonesia biasa", () => {
    for (const s of [
      "Setuju. Aku sudah cek aula masih tersedia. Besok aku akan kirim formulir peminjaman ke bagian kemahasiswaan.",
      "Untuk konsumsi, kita pakai vendor semester lalu atau cari opsi baru? Budget maksimalnya dua juta.",
      "Saya repot sekali minggu ini jadi mungkin terlambat, nanti dibantu teman-teman divisi acara.",
      "Tempatnya di aula kampus, waktunya jam tujuh malam, peserta sekitar seratus orang.",
      "Kalau begitu kita bagi tugas, publikasi dipegang media, perlengkapan dipegang logistik.",
    ]) expect(applyVocab(s, "")).toBe(s);
  });
});
