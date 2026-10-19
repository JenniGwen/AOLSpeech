// Koreksi yang dipelajari dari editan user: "Isaac" diedit jadi "AIESEC" sekali → transkrip berikutnya ikut terkoreksi.

/** Salah tulis umum model ini (kata Indonesia) — bawaan, bisa ditimpa koreksi user. */
export const COMMON_FIXES: Record<string, string> = {
  halau: "halo", hallo: "halo", alho: "halo", kalihan: "kalian", menyeapkan: "menyiapkan", menyiyapkan: "menyiapkan",
  persiyapan: "persiapan", gimanah: "gimana", halou: "halo", halow: "halo", helok: "halo", sayah: "saya", disini: "di sini", disana: "di sana",
  hier: "here", // ejaan Belanda/Jerman yang sering keluar untuk "here"
};

const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const MAX_WORDS = 4;

function sim(a: string, b: string) {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return 1 - d[b.length] / Math.max(a.length, b.length, 1);
}

/** Pasangan [salah, benar] dari teks sebelum → sesudah diedit (hanya penggantian 1–4 kata, bukan tambah/hapus). */
export function learnCorrections(before: string, after: string): [string, string][] {
  const a = before.split(/\s+/).filter(Boolean), b = after.split(/\s+/).filter(Boolean);
  const na = a.map(norm), nb = b.map(norm);
  // LCS kata
  const L = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) L[i][j] = na[i] === nb[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: [string, string][] = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && na[i] === nb[j]) { i++; j++; continue; }
    const si = i, sj = j;
    while ((i < a.length || j < b.length) && !(i < a.length && j < b.length && na[i] === nb[j])) {
      if (j >= b.length || (i < a.length && L[i + 1][j] >= L[i][j + 1])) i++; else j++;
    }
    const from = na.slice(si, i).filter(Boolean);
    const orig = a.slice(si, i).filter((w) => norm(w));
    const to = b.slice(sj, j).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter(Boolean);
    // huruf kapital karena awal kalimat (kata asli juga kapital) bukan bagian dari koreksi → simpan huruf kecil
    const fixCase = (t: string, k: number) => (/^\p{Lu}\p{Ll}*$/u.test(t) && /^\p{Lu}/u.test(orig[k] ?? "") ? t.toLowerCase() : t);
    let pairs: [string, string][];
    if (from.length === to.length) {
      // jumlah kata sama → pasangkan per kata ("yangat bah" → "yang apa")
      pairs = from.map((f, k) => [f, fixCase(to[k], k)]);
    } else {
      // kata yang ejaannya mirip di ujung blok dipasangkan sendiri-sendiri ("kalihan" → "Kalian")
      const head: [string, string][] = [], tail: [string, string][] = [];
      let k0 = 0;
      while (from.length > 1 && to.length > 1 && sim(from[0], norm(to[0])) >= 0.5) head.push([from.shift()!, fixCase(to.shift()!, k0++)]);
      while (from.length > 1 && to.length > 1 && sim(from.at(-1)!, norm(to.at(-1)!)) >= 0.5) tail.unshift([from.pop()!, fixCase(to.pop()!, k0 + from.length)]);
      pairs = [...head, [from.join(" "), to.map((t, k) => (k ? t : fixCase(t, k0))).join(" ")], ...tail];
    }
    for (const [f, t] of pairs) {
      const n = f.split(" ").filter(Boolean).length, m = t.split(" ").filter(Boolean).length;
      if (n && m && n <= MAX_WORDS && m <= MAX_WORDS && f.length >= 3 && f !== t.split(" ").map(norm).join(" ") && !out.some(([x]) => x === f)) out.push([f, t]);
    }
  }
  return out;
}

/** Terapkan koreksi (frasa terpanjang dulu); tanda baca di ujung & huruf kapital awal dipertahankan. */
export function applyCorrections(text: string, map: Record<string, string>): string {
  const all = { ...COMMON_FIXES, ...map };
  // kata berulang dengan tanda hubung ("Halau-halau") dikoreksi per bagian
  const words = text.split(/\s+/).filter(Boolean).map((w) =>
    w.includes("-") ? w.split("-").map((part) => (all[norm(part)] ? applyCorrections(part, map) : part)).join("-") : w);
  const out: string[] = [];
  for (let i = 0; i < words.length; ) {
    let done = false;
    for (let n = Math.min(MAX_WORDS, words.length - i); n >= 1 && !done; n--) {
      const key = words.slice(i, i + n).map(norm).join(" ");
      const to = all[key];
      if (to === undefined || to.toLowerCase() === key) continue;
      const punct = words[i + n - 1].match(/[^\p{L}\p{N}]*$/u)![0];
      const lead = words[i].match(/^[^\p{L}\p{N}]*/u)![0];
      const cap = /^\p{Lu}/u.test(words[i].slice(lead.length)) && to === to.toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to;
      out.push(...`${lead}${cap}${punct}`.split(" "));
      i += n;
      done = true;
    }
    if (!done) out.push(words[i++]);
  }
  return out.join(" ");
}

/** Hasil koreksi yang berupa nama/istilah (ada huruf kapital, mis. AIESEC) → ikut jadi kosakata prompt. */
export const correctionTerms = (map: Record<string, string>) => [...new Set(Object.values(map).filter((t) => /\p{Lu}/u.test(t)))];
