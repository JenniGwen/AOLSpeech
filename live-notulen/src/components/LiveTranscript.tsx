import { useEffect, useRef, useState } from "react";
import { displayText, speakerLabel, useStore, type Segment } from "../store";
import { fmtTime } from "../lib/format";
import { afterEdit, persist } from "../lib/engine";

const COLORS = ["text-blue-600", "text-pink-600", "text-emerald-600", "text-amber-600", "text-violet-600", "text-cyan-600", "text-red-600", "text-lime-700"];

function SpeakerName({ i }: { i: number }) {
  const { speakerNames, renameSpeaker } = useStore();
  const [editing, setEditing] = useState(false);
  const label = speakerLabel(speakerNames, i);
  const cls = `font-semibold ${COLORS[i % COLORS.length]}`;
  if (editing)
    return (
      <input
        autoFocus
        defaultValue={speakerNames[i] ?? ""}
        placeholder={`Speaker ${i + 1}`}
        onBlur={(e) => { renameSpeaker(i, e.target.value); setEditing(false); persist(); }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={`${cls} w-36 rounded border border-slate-300 px-1 text-sm`}
      />
    );
  return (
    <button onClick={() => setEditing(true)} title="Klik untuk ganti nama (berlaku ke semua segmen speaker ini)" className={`${cls} hover:underline`}>
      {label}
    </button>
  );
}

const iconBtn = "rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700";

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
  const nextSpeaker = speakers.length ? Math.max(...speakers) + 1 : 0;

  const open = () => { setDraft(seg.text); setSpeaker(seg.speaker); setEditing(true); };
  const save = () => {
    const text = draft.replace(/\s+/g, " ").trim();
    if (!text) return;
    if (speaker !== seg.speaker) setSegmentSpeaker(seg.id, speaker);
    if (text !== seg.text) editSegment(seg.id, text);
    setEditing(false);
    afterEdit();
  };

  if (editing)
    return (
      <li className="rounded-lg bg-sky-50/60 p-2 ring-1 ring-sky-200">
        <div className="mb-1 flex items-center gap-2 text-sm">
          <span className="font-mono text-xs text-slate-400">[{fmtTime(seg.start)}]</span>
          <select value={speaker} onChange={(e) => setSpeaker(Number(e.target.value))} aria-label="Speaker segmen ini"
            className={`rounded border border-slate-300 bg-white px-1 py-0.5 text-sm font-semibold ${COLORS[speaker % COLORS.length]}`}>
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
          className="w-full resize-y rounded border border-slate-300 bg-white p-2 text-slate-900 outline-none focus:border-sky-400"
        />
        <div className="mt-1 flex items-center gap-2 text-xs">
          <button onClick={save} disabled={!draft.trim()} className="rounded bg-sky-600 px-3 py-1 font-semibold text-white hover:bg-sky-500 disabled:opacity-40">Simpan</button>
          <button onClick={() => setEditing(false)} className="rounded px-3 py-1 text-slate-600 hover:bg-slate-100">Batal</button>
          <span className="text-slate-400">Enter = simpan · Shift+Enter = baris baru · Esc = batal</span>
        </div>
      </li>
    );

  return (
    <li className="group leading-relaxed">
      <div className="flex items-baseline gap-2 text-sm">
        <span className="font-mono text-xs text-slate-400">[{fmtTime(seg.start)}]</span>
        <SpeakerName i={seg.speaker} />
        {seg.edited && <span className="text-[10px] uppercase tracking-wide text-slate-400" title="Teks sudah dikoreksi manual">diedit</span>}
        {d.pending && <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500" />}
        <span className="ml-auto flex gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <button className={iconBtn} onClick={open} title="Koreksi teks / ganti speaker">Edit</button>
          {!first && (
            <button className={iconBtn} title="Gabung dengan segmen sebelumnya" onClick={() => { mergeWithPrevious(seg.id); afterEdit(); }}>Gabung ↑</button>
          )}
          <button className={`${iconBtn} hover:text-red-600`} title="Hapus segmen"
            onClick={() => confirm("Hapus segmen ini?") && (deleteSegment(seg.id), afterEdit())}>Hapus</button>
        </span>
      </div>
      <p className="cursor-text text-slate-900" onDoubleClick={open}>{d.text}</p>
      {d.translated && <p className="text-xs text-slate-400">{seg.text}</p>}
    </li>
  );
}

export default function LiveTranscript() {
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
      className="min-h-[320px] flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      {!segments.length && !partial && (
        <div className="flex h-full min-h-[280px] items-center justify-center text-center text-sm text-slate-400">
          {recording ? "Mendengarkan… mulai bicara." : "Tekan Start untuk mulai transkrip live."}
        </div>
      )}
      <ol className="space-y-3">
        {segments.map((seg, i) => <SegmentItem key={seg.id} seg={seg} first={i === 0} />)}
        {partial && recording && (
          <li className="leading-relaxed">
            <div className="flex items-baseline gap-2 text-sm">
              <span className="font-mono text-xs text-slate-400">live</span>
              <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
            </div>
            <p className="italic text-slate-400">{partial.text}</p>
          </li>
        )}
      </ol>
    </div>
  );
}
