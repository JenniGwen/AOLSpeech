import { useState } from "react";
import { openSession } from "../lib/engine";
import { fmtRange, fmtDate, participants, removeSession, sameDay, setArchived, useSessions, when, whenEnd } from "../lib/sessions";
import type { SessionRecord } from "../lib/db";
import { useStore } from "../store";
import Hero, { Empty, SearchField, StatCard } from "../ui/Hero";
import Icon from "../ui/Icon";
import Topbar, { OpenRoomButton } from "../ui/Topbar";

type Filter = "semua" | "mendatang" | "selesai";

const ICON_TONES = ["bg-brand-50 text-brand-500", "bg-emerald-50 text-emerald-600", "bg-orange-50 text-orange-500", "bg-sky-50 text-sky-600"];

/** Status rapat: berjalan (sedang direkam), mendatang (jadwal di masa depan), selesai. */
export function useMeetingStatus() {
  const { sessionId, recording } = useStore();
  return (r: SessionRecord) =>
    r.id === sessionId && recording ? "berjalan" : when(r) > Date.now() ? "mendatang" : "selesai";
}

const BADGE = {
  berjalan: ["Berjalan", "bg-brand-100 text-brand-700"],
  mendatang: ["Mendatang", "bg-orange-100 text-orange-700"],
  selesai: ["Selesai", "bg-emerald-100 text-emerald-700"],
} as const;

export function MeetingRow({ r, i, actions }: { r: SessionRecord; i: number; actions?: React.ReactNode }) {
  const { setPage, recording, file, sessionId } = useStore();
  const status = useMeetingStatus()(r);
  const [label, tone] = BADGE[status];
  const t = when(r);
  const busy = recording || !!file;
  const people = participants(r).length;
  return (
    <li className={`group flex items-center gap-4 rounded-xl px-3 py-4 transition hover:bg-slate-50 ${r.id === sessionId ? "bg-brand-50/40" : ""}`}>
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${ICON_TONES[i % ICON_TONES.length]}`}><Icon name="file" /></span>
      <button
        className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
        disabled={busy && r.id !== sessionId}
        title={busy && r.id !== sessionId ? "Selesaikan rekaman / transkrip file dulu" : "Buka di ruang rapat"}
        onClick={() => { if (r.id !== sessionId) openSession(r); setPage("rapat"); }}
      >
        <div className="truncate font-semibold">{r.title}</div>
        <div className="mt-0.5 text-xs text-slate-500">
          {sameDay(t, new Date()) ? "Hari ini" : fmtDate(t)} · {fmtRange(t, whenEnd(r))} · {people} peserta · {r.segments.length} segmen
        </div>
      </button>
      <span className="hidden items-center gap-1 opacity-0 transition group-hover:opacity-100 sm:flex">{actions}</span>
      <span className={`chip ${tone}`}>{label}</span>
      <Icon name="right" className="h-5 w-5 text-slate-400" />
    </li>
  );
}

export default function Meetings() {
  const all = useSessions();
  const { recording, file, sessionId } = useStore();
  const [filter, setFilter] = useState<Filter>("semua");
  const [q, setQ] = useState("");
  const status = useMeetingStatus();

  const items = all.filter((r) => !r.archived);
  const now = new Date();
  const thisMonth = items.filter((r) => { const d = new Date(when(r)); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;
  const openTasks = items.reduce((a, r) => a + (r.tasks ?? []).filter((t) => !t.done).length, 0);
  const segs = items.reduce((a, r) => a + r.segments.length, 0);

  const shown = items
    .filter((r) => filter === "semua" || (filter === "mendatang" ? status(r) === "mendatang" : status(r) !== "mendatang"))
    .filter((r) => !q || `${r.title} ${participants(r).join(" ")} ${(r.agenda ?? []).map((a) => a.text).join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => when(b) - when(a));

  const iconBtn = "inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-ink";
  return (
    <>
      <Topbar crumb="Semua rapat" title="Rapat organisasi"><OpenRoomButton /></Topbar>
      <div className="space-y-6 px-5 py-7 sm:px-10">
        <Hero icon="file" title="Rapat organisasi" subtitle="Kelola semua diskusi, keputusan, dan catatan organisasi dalam satu tempat." gradient="bg-gradient-to-r from-[#5b63d3] via-[#6a62d0] to-[#7f5fc9]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon="file" value={items.length} label="Total rapat" tone="bg-brand-50 text-brand-500" />
          <StatCard icon="calendar" value={thisMonth} label="Bulan ini" tone="bg-orange-50 text-orange-500" />
          <StatCard icon="check" value={segs} label="Segmen transkrip" tone="bg-emerald-50 text-emerald-600" />
          <StatCard icon="clock" value={openTasks} label="Tugas aktif" tone="bg-sky-50 text-sky-600" />
        </div>
        <section className="card p-7">
          <div className="mb-4 flex flex-wrap items-center gap-4 border-b border-slate-100 pb-5">
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Daftar rapat</h2>
              <p className="text-xs text-slate-500">{items.length} rapat tersimpan di browser ini</p>
            </div>
            <SearchField value={q} onChange={setQ} />
            <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
              {(["semua", "mendatang", "selesai"] as Filter[]).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-4 py-2 capitalize transition ${filter === f ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-ink"}`}>{f}</button>
              ))}
            </div>
          </div>
          {!shown.length && <Empty>{items.length ? "Tidak ada rapat yang cocok." : "Belum ada notulen. Mulai rapat dari Beranda — notulen otomatis tersimpan di sini."}</Empty>}
          <ul className="divide-y divide-slate-100">
            {shown.map((r, i) => (
              <MeetingRow key={r.id} r={r} i={i} actions={
                <>
                  <button className={iconBtn} title="Arsipkan" disabled={(recording || !!file) && r.id === sessionId} onClick={() => setArchived(r.id, true)}><Icon name="archive" className="h-4 w-4" /></button>
                  <button className={`${iconBtn} hover:text-rose-600`} title="Hapus" disabled={(recording || !!file) && r.id === sessionId}
                    onClick={() => confirm(`Hapus "${r.title}"? Tindakan ini tidak bisa dibatalkan.`) && removeSession(r.id)}><Icon name="trash" className="h-4 w-4" /></button>
                </>
              } />
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
