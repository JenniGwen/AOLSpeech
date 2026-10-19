// Membuat 2 Web Worker (ASR, MT) dan menyambungkan pesannya ke store Zustand.
import { DEFAULT_DURATION, displayText, useStore, type Mode, type Segment } from "../store";
import { saveSession, type SessionRecord } from "./db";
import { applyCorrections, learnCorrections } from "../dsp/corrections";

const makeAsrWorker = () => new Worker(new URL("../workers/asr.worker.ts", import.meta.url), { type: "module" });
// `let` → import di modul lain ikut melihat worker baru kalau diganti (fallback WASM)
export let asrWorker = makeAsrWorker();
export const mtWorker = new Worker(new URL("../workers/mt.worker.ts", import.meta.url), { type: "module" });

const S = useStore;
let files: Record<string, { loaded: number; total: number }> = {};

function onAsrMessage({ data: m }: MessageEvent) {
  switch (m.type) {
    case "fallback": // WebGPU gagal di worker lama → worker baru, WASM saja
      asrWorker.terminate();
      asrWorker = makeAsrWorker();
      asrWorker.onmessage = onAsrMessage;
      files = {};
      asrWorker.postMessage({ type: "load", wasmOnly: true });
      break;
    case "progress": {
      files[m.file] = { loaded: m.loaded, total: m.total };
      const v = Object.values(files);
      S.setState({ load: { loaded: v.reduce((a, f) => a + f.loaded, 0), total: v.reduce((a, f) => a + f.total, 0) } });
      break;
    }
    case "ready":
      asrWorker.postMessage({ type: "vocab", text: S.getState().vocab });
      asrWorker.postMessage({ type: "corrections", map: S.getState().corrections });
      S.setState({ status: "ready", backend: m.backend, error: null });
      break;
    case "error":
      S.setState({ status: "error", error: m.message });
      break;
    case "vad":
      S.setState({ speech: m.speech });
      break;
    case "busy":
      S.setState((s) => {
        const active = s.recording || !!s.file;
        return { busy: m.busy, status: active ? (m.busy ? "processing" : "listening") : s.status === "processing" ? "ready" : s.status };
      });
      break;
    case "partial":
      S.setState((s) => ({
        partial: m.text ? { id: m.id, text: m.text } : s.partial,
        lastPartialMs: m.latencyMs,
        log: [...s.log, { t: m.t, type: "partial", latencyMs: m.latencyMs, audioSec: m.audioSec }],
      }));
      break;
    case "final": {
      // id segmen unik per sesi (id worker hanya dipakai untuk mencocokkan partial)
      const segs = S.getState().segments;
      const id = segs.reduce((mx, x) => Math.max(mx, x.id + 1), 0);
      const seg: Segment = { id, start: m.start, speaker: m.speaker, text: m.text, latencyMs: m.latencyMs, audioSec: m.audioSec };
      S.setState((s) => ({
        segments: m.text ? [...s.segments, seg] : s.segments,
        partial: s.partial?.id === m.id ? null : s.partial,
        log: [...s.log, { t: m.t, type: "final", latencyMs: m.latencyMs, audioSec: m.audioSec }],
      }));
      if (m.text) {
        const { mode } = S.getState();
        if (mode !== "asli") requestTranslation(seg, mode);
        persist();
      }
      break;
    }
    case "fileProgress":
      S.setState((s) => (s.file ? { file: { ...s.file, done: Math.min(m.done, s.file.total) } } : {}));
      break;
    case "fileDone":
      S.setState((s) => ({ file: null, status: s.status === "error" ? s.status : s.recording ? s.status : "ready" }));
      persist(true);
      break;
  }
}
asrWorker.onmessage = onAsrMessage;
S.subscribe((s, prev) => {
  if (s.vocab !== prev.vocab) asrWorker.postMessage({ type: "vocab", text: s.vocab });
  if (s.corrections !== prev.corrections) asrWorker.postMessage({ type: "corrections", map: s.corrections });
});

/** Editan user → pelajari koreksinya, lalu terapkan juga ke segmen lain di rapat ini. */
export function learnFromEdit(before: string, after: string) {
  const pairs = learnCorrections(before, after);
  if (!pairs.length) return;
  S.getState().addCorrections(pairs);
  const map = Object.fromEntries(pairs);
  for (const seg of S.getState().segments) {
    const fixed = applyCorrections(seg.text, map);
    if (fixed !== seg.text) S.getState().editSegment(seg.id, fixed);
  }
}

mtWorker.onmessage = ({ data: m }) => {
  if (m.type === "progress") S.setState({ mtLoading: m.mode });
  else if (m.type === "ready") S.setState((s) => ({ mtLoading: s.mtLoading === m.mode ? null : s.mtLoading }));
  else if (m.type === "error") {
    // model terjemahan gagal diunduh → kosongkan antrean supaya bisa dicoba lagi dengan ganti mode
    S.setState((s) => ({
      mtLoading: null,
      notice: `Model terjemahan gagal dimuat (${m.message}). Pilih mode lagi untuk mencoba ulang.`,
      translations: Object.fromEntries(Object.entries(s.translations).filter(([k, v]) => !(v === null && k.startsWith(`${m.mode}:`)))),
    }));
  } else if (m.type === "translation") {
    if (m.session !== S.getState().sessionId) return; // hasil untuk sesi lain
    const key = `${m.mode}:${m.id}`;
    const seg = S.getState().segments.find((x) => x.id === m.id);
    if (!seg || seg.text !== m.source) return; // segmen sudah dihapus/diedit sejak diminta
    if (m.text == null) {
      S.setState((s) => {
        const { [key]: _, ...rest } = s.translations;
        return { translations: rest, notice: "Sebagian segmen gagal diterjemahkan. Pilih mode lagi untuk mencoba ulang." };
      });
      return;
    }
    S.setState((s) => ({ translations: { ...s.translations, [key]: m.text } }));
    persist();
  }
};

function requestTranslation(seg: Segment, mode: Exclude<Mode, "asli">) {
  const key = `${mode}:${seg.id}`;
  if (key in S.getState().translations) return;
  S.setState((s) => ({ translations: { ...s.translations, [key]: null } }));
  mtWorker.postMessage({ type: "translate", mode, session: S.getState().sessionId, id: seg.id, text: seg.text });
}

/** Ganti mode → muat model MT & terjemahkan semua segmen final (dari cache bila sudah ada). */
export function setMode(mode: Mode) {
  S.setState({ mode });
  if (mode === "asli") return;
  mtWorker.postMessage({ type: "preload", mode });
  S.getState().segments.forEach((seg) => requestTranslation(seg, mode));
}

/** Setelah segmen diedit/digabung: terjemahkan ulang di mode aktif & simpan. */
export function afterEdit() {
  setMode(S.getState().mode);
  persist();
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** Autosave sesi ke IndexedDB (debounce; `now` = langsung, mis. sebelum pindah sesi; `force` = simpan walau masih kosong). */
export function persist(now = false, force = false) {
  clearTimeout(saveTimer);
  const save = () => {
    const s = S.getState();
    if (!force && !s.segments.length && !s.agenda.length && !s.tasks.length) return Promise.resolve();
    const translations = Object.fromEntries(Object.entries(s.translations).filter(([, v]) => v != null));
    return saveSession({ id: s.sessionId, title: s.title, createdAt: s.createdAt, meetingAt: s.meetingAt, meetingEndAt: s.meetingEndAt, updatedAt: Date.now(), segments: s.segments, speakerNames: s.speakerNames, translations, agenda: s.agenda, tasks: s.tasks, vocab: s.vocab })
      .then(() => window.dispatchEvent(new Event("sessions-changed")))
      .catch(console.error);
  };
  if (now) return save();
  saveTimer = setTimeout(save, 500);
  return Promise.resolve();
}

export function newMeeting(title?: string) {
  persist(true); // simpan sesi lama sebelum state diganti
  S.getState().newSession();
  if (title) S.setState({ title });
  asrWorker.postMessage({ type: "reset" });
}

export function startEngine() {
  asrWorker.postMessage({ type: "load" });
}

/** Coba muat ulang model ASR setelah gagal (mis. jaringan putus). */
export function retryLoad() {
  files = {};
  S.setState({ status: "loading", error: null, load: { loaded: 0, total: 0 } });
  asrWorker.postMessage({ type: "load" });
}

export { displayText };

/** Buka notulen dari riwayat (IndexedDB). */
export function openSession(r: SessionRecord) {
  persist(true);
  S.setState({
    sessionId: r.id, title: r.title, createdAt: r.createdAt, meetingAt: r.meetingAt ?? r.createdAt,
    meetingEndAt: r.meetingEndAt ?? (r.meetingAt ?? r.createdAt) + DEFAULT_DURATION, segments: r.segments, speakerNames: r.speakerNames,
    agenda: r.agenda ?? [], tasks: r.tasks ?? [], vocab: r.vocab ?? S.getState().vocab, translations: r.translations, partial: null, log: [], lastPartialMs: null,
  });
  asrWorker.postMessage({ type: "reset" });
  const { mode } = S.getState();
  if (mode !== "asli") setMode(mode);
}
