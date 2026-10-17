import { create } from "zustand";

export type Mode = "asli" | "en" | "id";
export type Status = "loading" | "ready" | "listening" | "processing" | "error";

export interface Segment {
  id: number;
  start: number; // detik sejak mulai rekam
  speaker: number;
  text: string; // transkrip ASLI (campur), tidak pernah diubah
  latencyMs: number;
  audioSec: number;
  edited?: boolean; // teks sudah dikoreksi manual
}
export interface LogRow { t: number; type: "partial" | "final"; latencyMs: number; audioSec: number }

interface State {
  status: Status;
  error: string | null;
  load: { loaded: number; total: number };
  backend: "webgpu" | "wasm" | null;
  recording: boolean;
  busy: boolean;
  speech: boolean;

  sessionId: string;
  title: string;
  createdAt: number;
  /** Tanggal & jam meeting (dipilih user; default = saat notulen dibuat). */
  meetingAt: number;
  segments: Segment[];
  partial: { id: number; text: string } | null;
  speakerNames: Record<number, string>;

  mode: Mode;
  translations: Record<string, string | null>; // `${mode}:${id}` → teks (null = sedang diterjemahkan)
  mtLoading: Mode | null;

  log: LogRow[];
  lastPartialMs: number | null;
  recordingUrl: string | null;
  /** Transkrip file audio yang diunggah: detik audio selesai / total. */
  file: { name: string; done: number; total: number } | null;
  /** Pesan non-fatal yang ditampilkan di banner (izin mic, file gagal dibaca, MT gagal, …). */
  notice: string | null;

  setRecording(on: boolean): void;
  setRecordingUrl(url: string | null): void;
  setTitle(t: string): void;
  setMeetingAt(t: number): void;
  renameSpeaker(i: number, name: string): void;
  newSession(): void;
  setNotice(n: string | null): void;
  editSegment(id: number, text: string): void;
  setSegmentSpeaker(id: number, speaker: number): void;
  deleteSegment(id: number): void;
  mergeWithPrevious(id: number): void;
}

/** Buang terjemahan segmen tertentu (setelah teksnya berubah / segmen dihapus). */
const dropTranslations = (tr: Record<string, string | null>, ids: number[]) =>
  Object.fromEntries(Object.entries(tr).filter(([k]) => !ids.includes(Number(k.split(":")[1]))));

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
/** Waktu sekarang dibulatkan ke menit (input jam tidak punya detik). */
export const nowMinute = () => Math.floor(Date.now() / 60000) * 60000;
export const defaultTitle = (at = Date.now()) => `Meeting UKM ${new Date(at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;

export const useStore = create<State>()((set, get) => ({
  status: "loading",
  error: null,
  load: { loaded: 0, total: 0 },
  backend: null,
  recording: false,
  busy: false,
  speech: false,

  sessionId: newId(),
  title: defaultTitle(),
  createdAt: Date.now(),
  meetingAt: nowMinute(),
  segments: [],
  partial: null,
  speakerNames: {},

  mode: "asli",
  translations: {},
  mtLoading: null,

  log: [],
  lastPartialMs: null,
  recordingUrl: null,
  file: null,
  notice: null,

  setRecording: (on) => set((s) => ({ recording: on, status: s.status === "error" ? s.status : on ? "listening" : "ready", partial: on ? s.partial : null, speech: false })),
  setRecordingUrl: (url) => {
    const old = get().recordingUrl;
    if (old) URL.revokeObjectURL(old);
    set({ recordingUrl: url });
  },
  setTitle: (title) => set({ title }),
  // judul masih bawaan → ikut tanggal meeting yang baru
  setMeetingAt: (meetingAt) => set((s) => ({ meetingAt, title: s.title === defaultTitle(s.meetingAt) ? defaultTitle(meetingAt) : s.title })),
  renameSpeaker: (i, name) => set((s) => ({ speakerNames: { ...s.speakerNames, [i]: name } })),
  newSession: () =>
    set({ sessionId: newId(), title: defaultTitle(), createdAt: Date.now(), meetingAt: nowMinute(), segments: [], partial: null, speakerNames: {}, translations: {}, log: [], lastPartialMs: null }),
  setNotice: (notice) => set({ notice }),
  editSegment: (id, text) =>
    set((s) => ({
      segments: s.segments.map((x) => (x.id === id && x.text !== text ? { ...x, text, edited: true } : x)),
      translations: dropTranslations(s.translations, [id]),
    })),
  setSegmentSpeaker: (id, speaker) => set((s) => ({ segments: s.segments.map((x) => (x.id === id ? { ...x, speaker } : x)) })),
  deleteSegment: (id) => set((s) => ({ segments: s.segments.filter((x) => x.id !== id), translations: dropTranslations(s.translations, [id]) })),
  mergeWithPrevious: (id) =>
    set((s) => {
      const i = s.segments.findIndex((x) => x.id === id);
      if (i < 1) return {};
      const prev = s.segments[i - 1], cur = s.segments[i];
      const merged = { ...prev, text: `${prev.text} ${cur.text}`.trim(), audioSec: prev.audioSec + cur.audioSec, edited: true };
      return {
        segments: [...s.segments.slice(0, i - 1), merged, ...s.segments.slice(i + 1)],
        translations: dropTranslations(s.translations, [prev.id, cur.id]),
      };
    }),
}));

export const speakerLabel = (names: Record<number, string>, i: number) => names[i]?.trim() || `Speaker ${i + 1}`;

/** Teks segmen sesuai mode; fallback ke asli selama terjemahan belum ada. */
export function displayText(s: Pick<State, "mode" | "translations">, seg: Segment) {
  if (s.mode === "asli") return { text: seg.text, pending: false, translated: false };
  const tr = s.translations[`${s.mode}:${seg.id}`];
  // null = sedang diterjemahkan; undefined = belum/gagal (tidak berputar terus)
  return tr ? { text: tr, pending: false, translated: true } : { text: seg.text, pending: tr === null, translated: false };
}
