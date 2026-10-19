import { useEffect, useRef, useState } from "react";
import type { Source } from "../audio/useRecorder";
import { cancelFile, transcribeFile } from "../lib/audioFile";
import { compat, liveBlocker } from "../lib/compat";
import { fmtTime } from "../lib/format";
import { participants } from "../lib/sessions";
import { persist } from "../lib/engine";
import { useStore } from "../store";
import Avatar, { toneOf } from "../ui/Avatar";
import Icon from "../ui/Icon";

const SOURCES: { value: Source; label: string; tab: boolean }[] = [
  { value: "tab+mic", label: "Layar/tab meeting + mic saya", tab: true },
  { value: "tab", label: "Layar/tab meeting saja", tab: true },
  { value: "mic", label: "Mic saja (meeting offline)", tab: false },
];
export const sources = SOURCES.filter((s) => compat.tabAudio || !s.tab);
export const canLive = !liveBlocker();

export interface Recorder {
  start(source: Source): void;
  stop(): void;
  source: Source;
  setSource(s: Source): void;
}

/** Detik berjalan sejak `from` (dirender ulang tiap detik). */
export function useElapsed(from: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (from == null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [from]);
  return from == null ? 0 : (now - from) / 1000;
}

/** Tombol utama di header: mulai / akhiri rekaman. */
export function RecordButton({ rec }: { rec: Recorder }) {
  const { status, recording, file } = useStore();
  const modelOk = status === "ready" || status === "listening" || status === "processing";
  return recording ? (
    <button onClick={rec.stop} className="btn-dark bg-rose-600 hover:bg-rose-500">
      <span className="h-2.5 w-2.5 rounded-sm bg-white" /> Akhiri rapat
    </button>
  ) : (
    <button onClick={() => rec.start(rec.source)} disabled={!canLive || !modelOk || !!file} className="btn-dark">
      <Icon name="mic" className="h-4 w-4" /> Mulai rekam
    </button>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Baris info rapat: tanggal & jam (bisa diubah), jumlah peserta, avatar speaker. */
export function MeetingMeta() {
  const { meetingAt, setMeetingAt, meetingEndAt, setMeetingEnd, segments, speakerNames } = useStore();
  const d = new Date(meetingAt), e = new Date(meetingEndAt);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hm = (x: Date) => `${pad(x.getHours())}:${pad(x.getMinutes())}`;
  const at = (dt: string, tm: string) => new Date(`${dt}T${tm}`).getTime();
  const setStart = (dt: string, tm: string) => { const t = at(dt, tm); if (!Number.isNaN(t)) setMeetingAt(t); };
  const setEnd = (tm: string) => { const t = at(date, tm); if (!Number.isNaN(t)) setMeetingEnd(t); };
  const people = [...new Set(segments.filter((s) => s.speaker >= 0).map((s) => s.speaker))];
  const names = participants({ segments, speakerNames });
  const pill = "flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm focus-within:border-brand-400";
  const input = "bg-transparent font-medium text-ink outline-none [color-scheme:light]";
  const overnight = e.getDate() !== d.getDate();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <label className={pill} title="Tanggal rapat">
        <Icon name="calendar" className="h-[18px] w-[18px] text-slate-400" />
        <span className="hidden sm:inline">{d.toLocaleDateString("id-ID", { weekday: "long" })},</span>
        <input type="date" value={date} onChange={(ev) => ev.target.value && setStart(ev.target.value, hm(d))} className={input} aria-label="Tanggal rapat" />
      </label>
      <div className={pill} title="Jam mulai – jam selesai">
        <Icon name="clock" className="h-[18px] w-[18px] text-slate-400" />
        <input type="time" value={hm(d)} onChange={(ev) => ev.target.value && setStart(date, ev.target.value)} className={input} aria-label="Jam mulai" />
        <span className="text-slate-400">–</span>
        <input type="time" value={hm(e)} onChange={(ev) => ev.target.value && setEnd(ev.target.value)} className={input} aria-label="Jam selesai" />
        <span>WIB{overnight && <span className="ml-1 text-xs text-slate-400">(+1 hari)</span>}</span>
      </div>
      <span className="flex items-center gap-2 px-1 text-sm font-medium text-slate-600">
        <Icon name="users" className="h-[18px] w-[18px] text-slate-400" /> {people.length} peserta terdeteksi
      </span>
      <div className="ml-auto flex -space-x-2">
        {people.slice(0, 4).map((i, k) => (
          <span key={i} title={names[k]} className="rounded-full ring-2 ring-[#f4f5f8]"><Avatar name={names[k]} tone={toneOf(i)} size="h-9 w-9 text-[11px]" /></span>
        ))}
        {people.length > 4 && <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600 ring-2 ring-[#f4f5f8]">+{people.length - 4}</span>}
      </div>
    </div>
  );
}

const STATUS: Record<string, [string, string]> = {
  loading: ["Memuat model", "bg-amber-100 text-amber-800"],
  ready: ["Siap merekam", "bg-emerald-100 text-emerald-800"],
  listening: ["Mendengarkan", "bg-sky-100 text-sky-800"],
  processing: ["Memproses", "bg-brand-100 text-brand-700"],
  error: ["Model gagal dimuat", "bg-red-100 text-red-800"],
};

function FileProgress() {
  const file = useStore((s) => s.file);
  if (!file) return null;
  const pct = file.total ? Math.round((file.done / file.total) * 100) : 0;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-brand-100 pt-4 text-xs text-slate-600">
      <span className="truncate font-semibold">{file.total ? `Mentranskrip “${file.name}”` : `Membaca “${file.name}”…`}</span>
      {file.total > 0 && (
        <>
          <div className="h-1.5 min-w-[120px] flex-1 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="tabular-nums">{fmtTime(file.done)} / {fmtTime(file.total)} ({pct}%)</span>
          <button onClick={cancelFile} className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold hover:bg-slate-50">Batal</button>
        </>
      )}
    </div>
  );
}

/** Istilah khusus rapat → dipakai sebagai prompt Whisper dan untuk koreksi ejaan hasil transkrip. */
function VocabField() {
  const { vocab, setVocab, corrections, removeCorrection } = useStore();
  const learned = Object.entries(corrections);
  return (
    <div className="mt-4 space-y-3 border-t border-brand-100 pt-4">
      <label className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-brand-700" title="Nama event, istilah English, singkatan — dipisah koma. Membantu model menulis istilah ini dengan benar.">
          Kosakata rapat
        </span>
        <input
          value={vocab}
          onChange={(e) => setVocab(e.target.value)}
          onBlur={() => persist()}
          placeholder="Istilah yang sering muncul, pisahkan dengan koma — mis. Youth Today, budget, risk mitigation, PIC"
          className="min-w-[240px] flex-1 rounded-xl border border-white bg-white/80 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-brand-200"
        />
      </label>
      {learned.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-brand-700" title="Dipelajari dari editan transkrip kamu — dipakai otomatis di transkrip berikutnya">Koreksi tersimpan</span>
          {learned.map(([from, to]) => (
            <span key={from} className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 py-1 pl-2.5 pr-1 text-xs text-slate-600 shadow-sm">
              <span className="text-slate-400 line-through">{from}</span> → <b className="text-ink">{to}</b>
              <button onClick={() => removeCorrection(from)} aria-label={`Hapus koreksi ${from}`} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500"><Icon name="x" className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Kartu sumber audio: pilih sumber, upload file, status model, petunjuk share tab. */
export function SourceCard({ rec }: { rec: Recorder }) {
  const { status, recording, speech, segments, file } = useStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const modelOk = status === "ready" || status === "listening" || status === "processing";
  const [label, tone] = STATUS[status];

  const hint = !canLive
    ? liveBlocker()
    : recording
      ? speech ? "Ada suara — sedang ditranskrip." : "Mendengarkan… mulai bicara."
      : rec.source !== "mic"
        ? "Saat jendela share muncul, pilih tab Google Meet / Zoom web / Teams dan centang “Share tab audio”. Semua proses berjalan di browser ini — audio tidak dikirim ke server."
        : !compat.tabAudio
          ? "Browser ini hanya bisa merekam mic. Untuk menangkap suara Meet/Zoom/Teams langsung, buka di Chrome atau Edge desktop."
          : "Rekam langsung dari mikrofon perangkat ini — cocok untuk rapat tatap muka.";

  return (
    <section className="rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-50 via-[#f3efff] to-[#fbf1f1] p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-brand-500 shadow-sm">
          <Icon name={recording ? "mic" : "sparkles"} className={`h-6 w-6 ${recording && speech ? "animate-pulse" : ""}`} />
        </span>
        <div className="min-w-[220px] flex-1">
          <div className="flex items-center gap-2 text-sm font-bold text-brand-700">
            Sumber audio
            <span className={`chip ${tone}`}>{label}</span>
          </div>
          <p className="mt-0.5 text-sm text-slate-600">{hint}</p>
        </div>
        <select
          value={rec.source}
          onChange={(e) => rec.setSource(e.target.value as Source)}
          disabled={recording || !canLive}
          className="rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm font-medium text-ink shadow-sm outline-none disabled:opacity-60"
          aria-label="Sumber audio"
        >
          {sources.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={!modelOk || recording || !!file}
          title="Transkrip rekaman meeting (mp3, wav, m4a, webm, mp4, …)"
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-white/70 disabled:opacity-40"
        >
          <Icon name="upload" className="h-4 w-4" /> Upload audio
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="audio/*,video/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f && (!segments.length || confirm(`Transkrip “${f.name}” sebagai notulen baru? Notulen sekarang sudah tersimpan di Semua rapat.`))) transcribeFile(f);
          }}
        />
      </div>
      <VocabField />
      <FileProgress />
    </section>
  );
}
