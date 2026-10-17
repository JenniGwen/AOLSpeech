import { useRef, useState } from "react";
import { useRecorder, type Source } from "../audio/useRecorder";
import { newMeeting } from "../lib/engine";
import { cancelFile, transcribeFile } from "../lib/audioFile";
import { compat, liveBlocker } from "../lib/compat";
import { fmtTime } from "../lib/format";
import { useStore } from "../store";

const SOURCES: { value: Source; label: string; tab: boolean }[] = [
  { value: "tab+mic", label: "Layar/tab meeting + mic saya", tab: true },
  { value: "tab", label: "Layar/tab meeting saja", tab: true },
  { value: "mic", label: "Mic saja (meeting offline)", tab: false },
];
const sources = SOURCES.filter((s) => compat.tabAudio || !s.tab);
const canLive = !liveBlocker();

function FileProgress() {
  const file = useStore((s) => s.file);
  if (!file) return null;
  const pct = file.total ? Math.round((file.done / file.total) * 100) : 0;
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
      <span className="truncate font-medium">{file.total ? `Mentranskrip “${file.name}”` : `Membaca “${file.name}”…`}</span>
      {file.total > 0 && (
        <>
          <div className="h-1.5 min-w-[120px] flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="tabular-nums">{fmtTime(file.done)} / {fmtTime(file.total)} ({pct}%)</span>
          <button onClick={cancelFile} className="rounded-lg border border-slate-200 px-2 py-1 hover:bg-slate-50">Batal</button>
        </>
      )}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Pilih tanggal (kalender) + jam meeting; disimpan ke riwayat bersama notulen. */
function MeetingDateTime({ value, onChange }: { value: number; onChange(t: number): void }) {
  const d = new Date(value);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const set = (dt: string, tm: string) => {
    const t = new Date(`${dt}T${tm}`).getTime();
    if (!Number.isNaN(t)) onChange(t);
  };
  const cls = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700";
  return (
    <div className="flex flex-wrap items-center gap-2 px-1 text-sm text-slate-500">
      <label className="flex items-center gap-2">Tanggal
        <input type="date" value={date} onChange={(e) => e.target.value && set(e.target.value, time)} className={cls} />
      </label>
      <label className="flex items-center gap-2">Jam
        <input type="time" value={time} onChange={(e) => e.target.value && set(date, e.target.value)} className={cls} />
      </label>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  loading: "bg-amber-100 text-amber-800",
  ready: "bg-emerald-100 text-emerald-800",
  listening: "bg-sky-100 text-sky-800",
  processing: "bg-violet-100 text-violet-800",
  error: "bg-red-100 text-red-800",
};

function StatusPill() {
  const { status, load, error } = useStore();
  const pct = load.total ? Math.round((load.loaded / load.total) * 100) : 0;
  const label = {
    loading: load.total ? `Memuat model ${pct}%` : "Memuat model…",
    ready: "Siap",
    listening: "Mendengarkan",
    processing: "Memproses",
    error: "Gagal memuat model",
  }[status];
  return (
    <span title={error ?? undefined} className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[status]}`}>
      {(status === "loading" || status === "processing") && <span className="h-2 w-2 animate-pulse rounded-full bg-current" />}
      {status === "listening" && <span className="h-2 w-2 rounded-full bg-current" />}
      {label}
    </span>
  );
}

export default function RecordControls() {
  const { status, recording, speech, title, setTitle, meetingAt, setMeetingAt, segments, file } = useStore();
  const { start, stop } = useRecorder();
  const [source, setSource] = useState<Source>(sources[0].value);
  const fileInput = useRef<HTMLInputElement>(null);
  const modelOk = status === "ready" || status === "listening" || status === "processing";
  const canStart = canLive && modelOk && !file;
  const canUpload = modelOk && !recording && !file;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => (recording ? stop() : start(source))}
          disabled={!canStart}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-wait disabled:opacity-40 ${
            recording ? "bg-slate-900 hover:bg-slate-700" : "bg-red-600 hover:bg-red-500"
          }`}
        >
          <span className={`h-2.5 w-2.5 bg-white ${recording ? "rounded-sm" : "rounded-full"}`} />
          {recording ? "Stop" : "Start"}
        </button>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={!canUpload}
          title="Transkrip rekaman meeting (mp3, wav, m4a, webm, mp4, …)"
          className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Upload audio
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="audio/*,video/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f && (!segments.length || confirm(`Transkrip “${f.name}” sebagai notulen baru? Notulen sekarang sudah tersimpan di riwayat.`))) transcribeFile(f);
          }}
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as Source)}
          disabled={recording || !canLive}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
          title="Sumber audio"
        >
          {sources.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {recording && (
          <span className="inline-flex items-center gap-2 text-xs text-slate-500">
            <span className={`h-2.5 w-2.5 rounded-full transition ${speech ? "bg-emerald-500 ring-4 ring-emerald-200" : "bg-slate-300"}`} />
            {speech ? "ada suara" : "hening"}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <StatusPill />
          <button
            onClick={() => (!segments.length || confirm("Mulai notulen baru? Notulen sekarang sudah tersimpan di riwayat.")) && newMeeting()}
            disabled={recording || !!file}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            Notulen baru
          </button>
        </div>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-lg border border-transparent px-1 text-lg font-semibold outline-none hover:border-slate-200 focus:border-sky-400"
        aria-label="Judul meeting"
      />
      <MeetingDateTime value={meetingAt} onChange={setMeetingAt} />
      <FileProgress />
      {!compat.tabAudio && canLive && !recording && (
        <p className="text-xs text-slate-500">
          Browser ini tidak bisa merekam audio tab meeting — hanya mic. Untuk menangkap suara Meet/Zoom/Teams langsung, buka di Chrome atau Edge desktop.
        </p>
      )}
      {source !== "mic" && !recording && (
        <p className="text-xs text-slate-500">
          Saat jendela share muncul, pilih <b>tab</b> Google Meet / Zoom web / Teams dan centang <b>“Share tab audio”</b>. Semua proses berjalan di browser ini — audio tidak dikirim ke server.
        </p>
      )}
    </div>
  );
}
