// Kosakata rapat: istilah khusus (nama event, istilah English) yang sering salah ditranskrip.
// Dipakai dua cara: sebagai prompt Whisper, dan koreksi fuzzy pada hasil ("risp metigatiannya" → "risk mitigationnya").

/** Istilah English yang umum di rapat UKM — selalu dipakai untuk koreksi ejaan, walau kolom kosakata kosong. */
export const DEFAULT_TERMS = [
  "meeting", "budget", "event", "progress", "update", "risk mitigation", "deadline", "timeline", "rundown", "proposal",
  "sponsor", "sponsorship", "venue", "briefing", "follow up", "feedback", "brainstorming", "partnership", "marketing",
  "merchandise", "planning", "talkshow", "workshop", "volunteer", "speaker", "fundraising", "open recruitment",
];

/** Kata sah (Indonesia / English) yang mirip istilah bawaan — tidak boleh "dikoreksi". */
const PROTECTED = new Set([
  "paling", "proker", "progres", "risiko", "mitigasi", "evaluasi", "repot", "rapat", "rapi", "missing", "moving", "passing",
  "meeting", "eventnya", "even", "speakernya", "sponsornya", "venuenya", "dedi", "budi", "bujang", "miring", "mitra", "planet",
]);

export const parseVocab = (vocab: string) => [...new Set(vocab.split(/[,\n;]/).map((t) => t.trim()).filter(Boolean))];

/** "a, b, c" → "Rapat membahas a, b, dan c." — format kalimat paling stabil di uji coba (tidak memicu "and"/huruf kapital acak). */
export function vocabPrompt(vocab: string) {
  const t = parseVocab(vocab);
  if (!t.length) return "";
  const list = t.length === 1 ? t[0] : `${t.slice(0, -1).join(", ")}${t.length > 2 ? "," : ""} dan ${t.at(-1)}`;
  return `Rapat membahas ${list}.`;
}

function lev(a: string, b: string) {
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
  return d[b.length];
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Kerangka konsonan berdasarkan bunyi: ejaan Inggris dan ejaan "dengar" Indonesia jadi sama.
 * budget → bjt = badjet, mitigation → mtksn ≈ matikasi, meeting → mtnk = miting.
 */
export const skeleton = (s: string) =>
  s.replace(/tion/g, "syen").replace(/dg/g, "j").replace(/g(?=[ei])/g, "j").replace(/ph/g, "f").replace(/c(?=[eiy])/g, "s").replace(/[cq]/g, "k")
    .replace(/x/g, "ks").replace(/v/g, "f").replace(/g/g, "k").replace(/z/g, "s").replace(/sh|sy/g, "s")
    .replace(/[aeiouy]/g, "").replace(/(.)\1+/g, "$1");

const sim = (a: string, b: string) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);

/** Ejaan mirip, atau bunyinya sama (kerangka konsonan mirip) dengan ejaan yang masih cukup dekat. */
function matches(word: string, term: string, minSim: number, strict: boolean) {
  const s = sim(word, term);
  if (s >= minSim) return s;
  const kw = skeleton(word), kt = skeleton(term);
  // istilah bawaan lebih ketat: ejaan harus tetap cukup dekat
  if (s < (strict ? 0.55 : 0.5)) return 0;
  // kerangka pendek ("Ureeka" → rk) hanya untuk istilah user sendiri: kerangka persis sama & panjang kata ±1
  // ("Yereka" ✓, "rika"/"raka" ✗)
  if (kt.length < 3) return !strict && kt.length === 2 && kw === kt && Math.abs(word.length - term.length) <= 1 ? s : 0;
  return sim(kw, kt) >= 0.75 ? s : 0;
}
const SUFFIX = /(nya|lah|kah|pun)$/;

/**
 * Ganti potongan teks (1–3 kata lebih/kurang dari jumlah kata istilah) yang ejaannya mirip istilah kosakata.
 * Akhiran Indonesia (-nya, -lah, …) dan tanda baca di ujung dipertahankan.
 */
export function applyVocab(text: string, vocab: string, minSim = 0.75): string {
  const own = parseVocab(vocab);
  // istilah user didahulukan; bawaan hanya yang tidak bentrok dengan istilah user
  const defaults = DEFAULT_TERMS.filter((d) => !own.some((o) => norm(o).includes(norm(d))));
  const terms = [...own, ...defaults].filter((t) => norm(t).length >= 4);
  if (!terms.length) return text;
  let words = text.split(/\s+/).filter(Boolean);
  for (const term of terms) {
    const target = norm(term), k = term.split(/\s+/).length, strict = !own.includes(term);
    const out: string[] = [];
    for (let i = 0; i < words.length; ) {
      let best: { n: number; sim: number; suffix: string; punct: string } | null = null;
      for (let n = Math.max(1, k - 1); n <= k + 1 && i + n <= words.length; n++) {
        const chunk = words.slice(i, i + n);
        const punct = chunk[n - 1].match(/[^\p{L}\p{N}]*$/u)![0];
        const joined = norm(chunk.join(""));
        if (chunk.some((w) => PROTECTED.has(norm(w)))) continue;
        if (n > k && chunk.some((w) => norm(w).length < 3)) continue;
        // bentuk lain yang sah dari istilah itu sendiri (updated, meetings, events) → biarkan
        if (n === 1 && joined !== target && joined.startsWith(target) && joined.length - target.length <= 3) continue;
        const sfx = !SUFFIX.test(target) && joined.length - 3 >= 4 ? joined.match(SUFFIX)?.[0] ?? "" : "";
        // bandingkan dengan & tanpa akhiran (-nya, …); seri → anggap akhiran
        let score = 0, suffix = "";
        for (const [cand, sf] of [[joined, ""], ...(sfx ? [[joined.slice(0, -sfx.length), sfx]] : [])] as [string, string][]) {
          if (Math.abs(cand.length - target.length) > target.length * 0.35) continue;
          // huruf konsonan pertama harus sama, supaya kata sebelumnya ("dan …") tidak ikut tertelan
          if (skeleton(cand)[0] !== skeleton(target)[0]) continue;
          // potongan yang lebih panjang dari istilah hanya boleh lewat ejaan, bukan bunyi ("db deadline" ≠ "deadline")
          const sc = n > k ? (sim(cand, target) >= minSim ? sim(cand, target) : 0) : matches(cand, target, minSim, strict);
          if (sc && sc >= score) { score = sc; suffix = sf; }
        }
        if (score) suffix = sfx; // akhiran di kata asli selalu dipertahankan
        if (score && (!best || score > best.sim)) best = { n, sim: score, suffix, punct };
      }
      if (best) {
        // pertahankan huruf kapital di awal kalimat
        const word = /^\p{Lu}/u.test(words[i]) && term === term.toLowerCase() ? term[0].toUpperCase() + term.slice(1) : term;
        out.push(...`${word}${best.suffix}${best.punct}`.split(" "));
        i += best.n;
      } else out.push(words[i++]);
    }
    words = out;
  }
  return words.join(" ");
}
