import { useState } from "react";
import { fmtRange, fmtDate, participants, removeSession, setArchived, useSessions, when, whenEnd } from "../lib/sessions";
import Hero, { Empty, SearchField, StatCard } from "../ui/Hero";
import Icon from "../ui/Icon";
import Topbar, { OpenRoomButton } from "../ui/Topbar";

const TONES = ["bg-emerald-50 text-emerald-600", "bg-orange-50 text-orange-500", "bg-sky-50 text-sky-600"];

export default function Archive() {
  const sessions = useSessions();
  const [q, setQ] = useState("");
  const archived = sessions.filter((r) => r.archived);
  const shown = archived.filter((r) => r.title.toLowerCase().includes(q.toLowerCase())).sort((a, b) => when(b) - when(a));
  const people = new Set(archived.flatMap((r) => participants(r))).size;

  return (
    <>
      <Topbar crumb="Arsip" title="Arsip notulen"><OpenRoomButton /></Topbar>
      <div className="space-y-6 px-5 py-7 sm:px-10">
        <Hero icon="archive" title="Arsip notulen" subtitle="Temukan kembali notulen dari kegiatan yang sudah selesai. Pulihkan untuk membukanya lagi." gradient="bg-gradient-to-r from-[#51679f] via-[#5470ab] to-[#5b74b5]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon="archive" value={archived.length} label="Notulen diarsipkan" tone="bg-brand-50 text-brand-500" />
          <StatCard icon="file" value={archived.reduce((a, r) => a + r.segments.length, 0)} label="Segmen transkrip" tone="bg-orange-50 text-orange-500" />
          <StatCard icon="users" value={people} label="Peserta terlibat" tone="bg-emerald-50 text-emerald-600" />
        </div>
        <section className="card p-7">
          <div className="mb-4 flex flex-wrap items-center gap-4 border-b border-slate-100 pb-5">
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Notulen terbaru</h2>
              <p className="text-xs text-slate-500">Diarsipkan</p>
            </div>
            <SearchField value={q} onChange={setQ} placeholder="Cari notulen…" />
          </div>
          {!shown.length && <Empty>{archived.length ? "Tidak ada notulen yang cocok." : "Arsip kosong. Arsipkan rapat lewat tombol di Semua rapat."}</Empty>}
          <ul className="divide-y divide-slate-100">
            {shown.map((r, i) => (
              <li key={r.id} className="group flex items-center gap-4 px-1 py-4">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${TONES[i % TONES.length]}`}><Icon name="file" /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{r.title}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{fmtDate(when(r))} · {fmtRange(when(r), whenEnd(r))}</div>
                </div>
                <button onClick={() => confirm(`Hapus permanen "${r.title}"?`) && removeSession(r.id)} className="rounded-lg p-2 text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100" title="Hapus permanen">
                  <Icon name="trash" className="h-4 w-4" />
                </button>
                <button onClick={() => setArchived(r.id, false)} className="rounded-lg bg-brand-50 px-3.5 py-2 text-xs font-bold text-brand-600 hover:bg-brand-100">Pulihkan</button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
