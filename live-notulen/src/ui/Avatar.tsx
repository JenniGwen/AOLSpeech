import { NOTE_SPEAKER } from "../store";

const TONES = [
  "bg-sky-100 text-sky-800", "bg-rose-100 text-rose-800", "bg-emerald-100 text-emerald-800", "bg-violet-100 text-violet-800",
  "bg-amber-100 text-amber-800", "bg-cyan-100 text-cyan-800", "bg-pink-100 text-pink-800", "bg-lime-100 text-lime-800",
];

/** Warna stabil per speaker / per nama. */
export const toneOf = (key: number | string) => {
  if (key === NOTE_SPEAKER) return "bg-slate-100 text-slate-600";
  const n = typeof key === "number" ? key : [...key].reduce((a, c) => a + c.charCodeAt(0), 0);
  return TONES[((n % TONES.length) + TONES.length) % TONES.length];
};

/** "Raka Aditya" → "RA", "Speaker 3" → "S3". */
export const initials = (name: string) => {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "?";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[1][0]).toUpperCase();
};

export default function Avatar({ name, tone, size = "h-11 w-11 text-xs" }: { name: string; tone: string; size?: string }) {
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${tone} ${size}`}>{initials(name)}</span>;
}
