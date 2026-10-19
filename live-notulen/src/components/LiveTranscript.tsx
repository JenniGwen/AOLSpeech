import { useEffect, useRef, useState } from "react";
import { displayText, NOTE_SPEAKER, speakerLabel, useStore, type Segment } from "../store";
import { fmtTime } from "../lib/format";
import { afterEdit, learnFromEdit, persist } from "../lib/engine";
import Avatar, { toneOf } from "../ui/Avatar";
import Icon from "../ui/Icon";
import StatsBar from "./StatsBar";
import { useElapsed } from "./RecordControls";

function SpeakerName({ i }: { i: number }) {
  const { speakerNames, renameSpeaker } = useStore();
  const [editing, setEditing] = useState(false);
  const label = speakerLabel(speakerNames, i);
  if (i === NOTE_SPEAKER) return <span className="text-sm font-bold">{label}</span>;
  if (editing)
    return (
      <input
        autoFocus
        defaultValue={speakerNames[i] ?? ""}
        placeholder={`Speaker ${i + 1}`}
        onBlur={(e) => { renameSpeaker(i, e.target.value); setEditing(false); persist(); }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-40 rounded-lg border border-brand-200 px-2 py-0.5 text-sm font-bold outline-none focus:border-brand-400"
      />
    );
  return (
    <button onClick={() => setEditing(true)} title="Klik untuk ganti nama (berlaku ke semua segmen speaker ini)" className="text-sm font-bold hover:text-brand-600">
      {label}
    </button>
  );
}

const iconBtn = "inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-ink";

/** Satu segmen final: tampil + mode edit (teks, speaker), gabung ke atas, hapus. */
function SegmentItem({ seg, first }: { seg: Segment; first: boolean }) {
  const state = useStore();
  const { segments, speakerNames, editSegment, setSegmentSpeaker, deleteSegment, mergeWithPrevious } = state;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(seg.text);
  const [speaker, setSpeaker] = useState(seg.speaker);
  const d = displayText(state, seg);
  // speaker yang ada di sesi + 1 slot baru
  const speakers = [...new Set(segments.map((x) => x.speaker))].sort((a, b) => a - b);
  const nextSpeaker = speakers.length ? Math.max(0, ...speakers) + 1 : 0;
  const label = speakerLabel(speakerNames, seg.speaker);

  const open = () => { setDraft(seg.text); setSpeaker(seg.speaker); setEditing(true); };
  const save = () => {
    const text = draft.replace(/\s+/g, " ").trim();
    if (!text) return;
    if (speaker !== seg.speaker) setSegmentSpeaker(seg.id, speaker);
    if (text !== seg.text) { editSegment(seg.id, text); learnFromEdit(seg.text, text); }
    setEditing(false);
    afterEdit();
  };

  if (editing)
    return (
      <li className="rounded-2xl bg-brand-50/60 p-3 ring-1 ring-brand-200">
        <div className="mb-2 flex items-center gap-2 text-sm">
          <span className="font-mono text-xs text-slate-400">{fmtTime(seg.start)}</span>
          <select value={speaker} onChange={(e) => setSpeaker(Number(e.target.value))} aria-label="Speaker segmen ini"
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold outline-none">
            {[...speakers, nextSpeaker].map((i) => (
              <option key={i} value={i}>{i === nextSpeaker ? `+ ${speakerLabel(speakerNames, i)} (baru)` : speakerLabel(speakerNames, i)}</option>
            ))}
          </select>
        </div>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
            if (e.key === "Escape") setEditing(false);
          }}
          rows={Math.min(8, Math.max(2, Math.ceil(draft.length / 90)))}
          className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-[15px] outline-none focus:border-brand-400"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <button onClick={save} disabled={!draft.trim()} className="rounded-lg bg-brand-500 px-3 py-1.5 font-semibold text-white hover:bg-brand-600 disabled:opacity-40">Simpan</button>
          <button onClick={() => setEditing(false)} className="rounded-lg px-3 py-1.5 font-semibold text-slate-600 hover:bg-white">Batal</button>
          <span className="text-slate-400">Enter = simpan · Shift+Enter = baris baru · Esc = batal</span>
        </div>
      </li>
    );

  return (
    <li className="group flex gap-4">
      <Avatar name={label} tone={toneOf(seg.speaker)} />
      <div className="min-w-0 flex-1">
        <div className="flex min-h-[28px] items-center gap-2.5">
          <SpeakerName i={seg.speaker} />
          <span className="text-xs tabular-nums text-slate-400">{fmtTime(seg.start)}</span>
          {seg.edited && <span className="chip bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500" title="Teks sudah dikoreksi manual">diedit</span>}
          {d.pending && <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-100 border-t-brand-500" />}
          <span className="ml-auto flex gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
            <button className={iconBtn} onClick={open} title="Koreksi teks / ganti speaker"><Icon name="pencil" className="h-4 w-4" /></button>
            {!first && (
              <button className={iconBtn} title="Gabung dengan segmen sebelumnya" onClick={() => { mergeWithPrevious(seg.id); afterEdit(); }}><Icon name="merge" className="h-4 w-4" /></button>
            )}
            <button className={`${iconBtn} hover:text-rose-600`} title="Hapus segmen"
              onClick={() => confirm("Hapus segmen ini?") && (deleteSegment(seg.id), afterEdit())}><Icon name="trash" className="h-4 w-4" /></button>
          </span>
        </div>
        <p className={`cursor-text text-[15px] leading-relaxed ${seg.speaker === NOTE_SPEAKER ? "text-slate-600" : "text-ink"}`} onDoubleClick={open}>{d.text}</p>
        {d.translated && <p className="mt-0.5 text-xs text-slate-400">{seg.text}</p>}
      </div>
    </li>
  );
}

function Transcript() {
  const state = useStore();
  const { segments, partial, recording } = state;
  const box = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    if (stick.current && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [segments.length, partial?.text, state.translations]);

  return (
    <div
      ref={box}
      onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; }}
      className="min-h-[360px] flex-1 overflow-y-auto px-6 pb-4 lg:max-h-[calc(100vh-430px)]"
    >
      {!segments.length && !partial && (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 text-center text-sm text-slate-400">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500"><Icon name="mic" className="h-6 w-6" /></span>
          {recording ? "Mendengarkan… mulai bicara." : "Tekan “Mulai rekam” untuk transkrip live, atau upload rekaman rapat."}
        </div>
      )}
      <ol className="space-y-6">
        {segments.map((seg, i) => <SegmentItem key={seg.id} seg={seg} first={i === 0} />)}
        {partial && recording && (
          <li className="flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500"><Icon name="mic" className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex min-h-[28px] items-center gap-1">
                {[0, 150, 300].map((d) => <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d}ms` }} />)}
              </div>
              <p className="text-[15px] italic leading-relaxed text-slate-400">{partial.text}</p>
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}

/** Input catatan manual di bawah transkrip (masuk sebagai segmen "Catatan"). */
function NoteInput() {
  const addNote = useStore((s) => s.addNote);
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    addNote(t);
    setText("");
    afterEdit();
  };
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="m-5 mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <button type="submit" disabled={!text.trim()} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-ink disabled:opacity-60" aria-label="Tambah catatan">
        <Icon name="plus" className="h-4 w-4" />
      </button>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Tambahkan catatan manual…" className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
      <kbd className="hidden rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500 sm:block">Enter</kbd>
    </form>
  );
}

function RecPill() {
  const { recording, recordStartedAt, file, status } = useStore();
  const sec = useElapsed(recordStartedAt);
  if (recording)
    return (
      <span className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold">
        <span className="relative flex h-3 w-3 items-center justify-center"><span className="absolute h-3 w-3 animate-ping rounded-full bg-rose-400/60" /><span className="h-2 w-2 rounded-full bg-rose-500" /></span>
        Merekam <span className="tabular-nums text-rose-500">{fmtTime(sec)}</span>
      </span>
    );
  if (file) return <span className="chip bg-brand-100 text-brand-700">Mentranskrip file…</span>;
  return <span className="chip bg-slate-100 text-slate-500">{status === "processing" ? "Memproses…" : "Tidak merekam"}</span>;
}

export default function TranscriptCard() {
  const { recording, mode } = useStore();
  const [tab, setTab] = useState<"transkrip" | "statistik">("transkrip");
  const tabCls = (t: typeof tab) =>
    `relative py-5 text-[15px] font-semibold transition ${tab === t ? "text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-500" : "text-slate-400 hover:text-slate-600"}`;

  return (
    <section className="card flex min-w-0 flex-col">
      <div className="flex items-center gap-8 border-b border-slate-100 px-6">
        <button className={tabCls("transkrip")} onClick={() => setTab("transkrip")}>Transkrip</button>
        <button className={tabCls("statistik")} onClick={() => setTab("statistik")}>Statistik</button>
        <div className="ml-auto"><RecPill /></div>
      </div>
      {tab === "transkrip" ? (
        <>
          <div className="flex items-center justify-between px-6 pb-4 pt-5 text-xs">
            <span className="flex items-center gap-2 font-semibold text-slate-600">
              <span className={`h-2 w-2 rounded-full ${recording ? "bg-rose-500" : "bg-slate-300"}`} /> Transkripsi langsung
            </span>
            <span className="text-slate-400">{mode === "asli" ? "Bahasa Indonesia + English" : mode === "id" ? "Diterjemahkan ke Bahasa Indonesia" : "Translated to English"}</span>
          </div>
          <Transcript />
          <NoteInput />
        </>
      ) : (
        <StatsBar />
      )}
    </section>
  );
}
