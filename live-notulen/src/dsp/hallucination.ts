// Saring halusinasi Whisper saat hening / hanya ada noise (bel, gesekan, musik).

// Kalimat penutup video yang sering muncul dari audio pendek
const OUTRO = /^(terima kasih( telah menonton| sudah menonton)?|thank you( for watching)?|sampai jumpa.*|subtitle.*|[.\-\s]*)[.!\s]*$/i;
// Anotasi suara gaya subtitle: (swoosh), [MUSIC], ♪ … ♪, *tepuk tangan*
const ANNOTATION = /[[(（【♪♫*][^\])）】♪♫*]*[\])）】♪♫*]?/g;

// Bunyi tanpa kata (shh, hmm, ehm, psst, …) — bukan isi rapat
const FILLER = /^(s+h+|s{2,}t*|p+s+t+|h+m+|e+h*m+|u+h*m*|a+h+|o+h+|h+a+h*|h+u+h+|e+|u+|m+|ck)$/i;

/** Ulangan n-gram ≥ 3× berturut-turut ("yang mencoba lebih banyak yang mencoba lebih banyak …") → satu kali. */
export function collapseRepeats(text: string): string {
  let w = text.split(/\s+/).filter(Boolean);
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  for (let n = 1; n <= 8; n++) {
    const out: string[] = [];
    for (let i = 0; i < w.length; ) {
      let reps = 1;
      while (i + (reps + 1) * n <= w.length && w.slice(i, i + n).every((x, k) => norm(x) === norm(w[i + reps * n + k]))) reps++;
      if (reps >= 3) { out.push(...w.slice(i, i + n)); i += reps * n; } else out.push(w[i++]);
    }
    w = out;
  }
  return w.join(" ");
}

/** Teks bersih, atau "" kalau seluruh hasilnya halusinasi. */
export function cleanTranscript(raw: string, audioSec: number): string {
  // Model sering mengutip istilah English ("badjet event") → buang tanda kutip ganda
  const text = raw.replace(/["“”„]/g, "").trim().replace(/^'(.*)'$/s, "$1").trim();
  // Model ini tidak pernah memberi anotasi untuk ucapan nyata → buang anotasinya, sisanya dipertahankan
  const stripped = text.replace(ANNOTATION, " ").replace(/\s+/g, " ").trim();
  if (!/[\p{L}\p{N}]/u.test(stripped)) return "";
  // segmen yang isinya cuma "Shhh!" / "Hmm…" dibuang; filler di tengah kalimat dibiarkan
  if (stripped.split(/\s+/).every((w) => FILLER.test(w.replace(/[^\p{L}]/gu, "")))) return "";
  const collapsed = collapseRepeats(stripped);
  const before = stripped.split(/\s+/).length, after = collapsed.split(/\s+/).length;
  // didominasi pengulangan → decoder terjebak loop, bukan ucapan
  if (before >= 12 && after / before < 0.5) return "";
  if (OUTRO.test(collapsed) && audioSec < 2.5) return "";
  return collapsed;
}
