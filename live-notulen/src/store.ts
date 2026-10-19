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
/** Poin agenda rapat (dicentang saat sudah dibahas). */
export interface AgendaItem { id: string; text: string; done: boolean }
/** Tindak lanjut: tugas + PIC + tenggat (yyyy-mm-dd, boleh kosong). */
export interface Task { id: string; text: string; who: string; due: string; done: boolean }
export type Page = "rapat" | "semua" | "kalender" | "anggota" | "arsip" | "pengaturan";
export interface Profile { name: string; role: string; org: string; campus: string }

export interface LogRow { t: number; type: "partial" | "final"; latencyMs: number; audioSec: number }

interface State {
  page: Page;
  profile: Profile;
  status: Status;
  error: string | null;
  load: { loaded: number; total: number };
  backend: "webgpu" | "wasm" | null;
  recording: boolean;
  /** Waktu mulai rekam (untuk timer "Merekam"). */
  recordStartedAt: number | null;
  busy: boolean;
  speech: boolean;

  sessionId: string;
  title: string;
  createdAt: number;
  /** Tanggal & jam meeting (dipilih user; default = saat notulen dibuat). */
  meetingAt: number;
  /** Jam selesai rapat (rentang jam). Lebih kecil dari meetingAt tidak mungkin — lewat tengah malam = hari berikutnya. */
  meetingEndAt: number;
  segments: Segment[];
  partial: { id: number; text: string } | null;
  speakerNames: Record<number, string>;
  agenda: AgendaItem[];
  tasks: Task[];
  /** Istilah khusus rapat (dipisah koma) → prompt Whisper + koreksi ejaan. */
  vocab: string;
  /** Koreksi yang dipelajari dari editan user (salah → benar), berlaku untuk semua rapat. */
  corrections: Record<string, string>;

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

  setPage(p: Page): void;
  setProfile(p: Partial<Profile>): void;
  setRecording(on: boolean): void;
  setRecordingUrl(url: string | null): void;
  setTitle(t: string): void;
  setMeetingAt(t: number): void;
  setMeetingEnd(t: number): void;
  renameSpeaker(i: number, name: string): void;
  newSession(): void;
  setNotice(n: string | null): void;
  editSegment(id: number, text: string): void;
  setSegmentSpeaker(id: number, speaker: number): void;
  deleteSegment(id: number): void;
  mergeWithPrevious(id: number): void;
  addNote(text: string): void;
  setAgenda(a: AgendaItem[]): void;
  setTasks(t: Task[]): void;
  setVocab(v: string): void;
  addCorrections(pairs: [string, string][]): void;
  removeCorrection(from: string): void;
}

/** Buang terjemahan segmen tertentu (setelah teksnya berubah / segmen dihapus). */
const dropTranslations = (tr: Record<string, string | null>, ids: number[]) =>
  Object.fromEntries(Object.entries(tr).filter(([k]) => !ids.includes(Number(k.split(":")[1]))));

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
/** Waktu sekarang dibulatkan ke menit (input jam tidak punya detik). */
/** Durasi bawaan rapat baru (rentang jam). */
export const DEFAULT_DURATION = 60 * 60000;
export const nowMinute = () => Math.floor(Date.now() / 60000) * 60000;
export const defaultTitle = (at = Date.now()) => `Meeting UKM ${new Date(at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;

const PROFILE_KEY = "rapatin-profile";
const DEFAULT_PROFILE: Profile = { name: "Sekretaris", role: "Sekretaris", org: "UKM Kreatif", campus: "Universitas" };
function loadProfile(): Profile {
  try { return { ...DEFAULT_PROFILE, ...JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "{}") }; } catch { return DEFAULT_PROFILE; }
}

const VOCAB_KEY = "rapatin-vocab";
const loadVocab = () => { try { return localStorage.getItem(VOCAB_KEY) ?? ""; } catch { return ""; } };

const CORR_KEY = "rapatin-corrections";
const loadCorrections = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(CORR_KEY) ?? "{}"); } catch { return {}; } };
const saveCorrections = (c: Record<string, string>) => { try { localStorage.setItem(CORR_KEY, JSON.stringify(c)); } catch { /* storage diblokir */ } };

/** Speaker khusus untuk catatan yang diketik manual. */
export const NOTE_SPEAKER = -1;

export const useStore = create<State>()((set, get) => ({
  page: "rapat",
  profile: loadProfile(),
  status: "loading",
  error: null,
  load: { loaded: 0, total: 0 },
  backend: null,
  recording: false,
  recordStartedAt: null,
  busy: false,
  speech: false,

  sessionId: newId(),
  title: defaultTitle(),
  createdAt: Date.now(),
  meetingAt: nowMinute(),
  meetingEndAt: nowMinute() + DEFAULT_DURATION,
  segments: [],
  partial: null,
  speakerNames: {},
  agenda: [],
  tasks: [],
  vocab: loadVocab(),
  corrections: loadCorrections(),

  mode: "asli",
  translations: {},
  mtLoading: null,

  log: [],
  lastPartialMs: null,
  recordingUrl: null,
  file: null,
  notice: null,

  setPage: (page) => set({ page }),
  setProfile: (p) => set((s) => {
    const profile = { ...s.profile, ...p };
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch { /* storage diblokir */ }
    return { profile };
  }),
  setRecording: (on) => set((s) => ({ recording: on, recordStartedAt: on ? Date.now() : null, status: s.status === "error" ? s.status : on ? "listening" : "ready", partial: on ? s.partial : null, speech: false })),
  setRecordingUrl: (url) => {
    const old = get().recordingUrl;
    if (old) URL.revokeObjectURL(old);
    set({ recordingUrl: url });
  },
  setTitle: (title) => set({ title }),
  // judul masih bawaan → ikut tanggal meeting yang baru
  // geser jam mulai → durasi rapat tetap
  setMeetingAt: (meetingAt) => set((s) => ({ meetingAt, meetingEndAt: meetingAt + Math.max(0, s.meetingEndAt - s.meetingAt), title: s.title === defaultTitle(s.meetingAt) ? defaultTitle(meetingAt) : s.title })),
  setMeetingEnd: (t) => set((s) => ({ meetingEndAt: t <= s.meetingAt ? t + 24 * 60 * 60000 : t })),
  renameSpeaker: (i, name) => set((s) => ({ speakerNames: { ...s.speakerNames, [i]: name } })),
  newSession: () =>
    set({ sessionId: newId(), title: defaultTitle(), createdAt: Date.now(), meetingAt: nowMinute(), meetingEndAt: nowMinute() + DEFAULT_DURATION, segments: [], partial: null, speakerNames: {}, agenda: [], tasks: [], translations: {}, log: [], lastPartialMs: null }),
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
  addNote: (text) =>
    set((s) => {
      const last = s.segments[s.segments.length - 1];
      const start = s.recordStartedAt ? (Date.now() - s.recordStartedAt) / 1000 : last?.start ?? 0;
      const id = s.segments.reduce((mx, x) => Math.max(mx, x.id + 1), 0);
      return { segments: [...s.segments, { id, start, speaker: NOTE_SPEAKER, text, latencyMs: 0, audioSec: 0 }] };
    }),
  setAgenda: (agenda) => set({ agenda }),
  setTasks: (tasks) => set({ tasks }),
  // disimpan juga sebagai bawaan untuk rapat berikutnya
  addCorrections: (pairs) => set((s) => {
    const corrections = { ...s.corrections, ...Object.fromEntries(pairs) };
    saveCorrections(corrections);
    return { corrections };
  }),
  removeCorrection: (from) => set((s) => {
    const { [from]: _, ...corrections } = s.corrections;
    saveCorrections(corrections);
    return { corrections };
  }),
  setVocab: (vocab) => {
    try { localStorage.setItem(VOCAB_KEY, vocab); } catch { /* storage diblokir */ }
    set({ vocab });
  },
}));

export const speakerLabel = (names: Record<number, string>, i: number) =>
  i === NOTE_SPEAKER ? "Catatan" : names[i]?.trim() || `Speaker ${i + 1}`;

/** Teks segmen sesuai mode; fallback ke asli selama terjemahan belum ada. */
export function displayText(s: Pick<State, "mode" | "translations">, seg: Segment) {
  if (s.mode === "asli") return { text: seg.text, pending: false, translated: false };
  const tr = s.translations[`${s.mode}:${seg.id}`];
  // null = sedang diterjemahkan; undefined = belum/gagal (tidak berputar terus)
  return tr ? { text: tr, pending: false, translated: true } : { text: seg.text, pending: tr === null, translated: false };
}
