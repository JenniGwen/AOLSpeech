import { useState } from "react";
import { fmtDate, useSessions, when } from "../lib/sessions";
import { NOTE_SPEAKER, speakerLabel } from "../store";
import Avatar, { toneOf } from "../ui/Avatar";
import Hero, { Empty, SearchField } from "../ui/Hero";
import Topbar, { OpenRoomButton } from "../ui/Topbar";

interface Member { name: string; meetings: number; segments: number; last: number }

/** Anggota = nama speaker yang sudah diberi nama di transkrip, dihimpun dari semua notulen. */
export default function Members() {
  const sessions = useSessions();
  const [q, setQ] = useState("");
  const byName = new Map<string, Member>();
  for (const r of sessions) {
    const counts = new Map<string, number>();
    for (const s of r.segments) {
      if (s.speaker === NOTE_SPEAKER || !r.speakerNames[s.speaker]?.trim()) continue;
      const name = speakerLabel(r.speakerNames, s.speaker);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    for (const [name, n] of counts) {
      const key = name.toLowerCase();
      const m = byName.get(key) ?? { name, meetings: 0, segments: 0, last: 0 };
      byName.set(key, { ...m, meetings: m.meetings + 1, segments: m.segments + n, last: Math.max(m.last, when(r)) });
    }
  }
  const members = [...byName.values()].sort((a, b) => b.segments - a.segments);
  const shown = members.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <Topbar crumb="Anggota" title="Anggota organisasi"><OpenRoomButton /></Topbar>
      <div className="space-y-6 px-5 py-7 sm:px-10">
        <Hero icon="users" title="Anggota organisasi" subtitle="Lihat siapa saja yang aktif berbicara di rapat, dihimpun dari semua notulen." gradient="bg-gradient-to-r from-[#3f7f86] via-[#4c8a7f] to-[#6aa47f]" />
        <section className="card p-7">
          <div className="mb-5 flex flex-wrap items-center gap-4">
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{members.length} anggota</h2>
              <p className="text-xs text-slate-500">dari {sessions.length} notulen</p>
            </div>
            <SearchField value={q} onChange={setQ} placeholder="Cari anggota…" />
          </div>
          {!shown.length && (
            <Empty>{members.length ? "Tidak ada anggota yang cocok." : "Belum ada anggota. Klik nama “Speaker 1”, “Speaker 2”, … di transkrip untuk memberi nama — nanti otomatis muncul di sini."}</Empty>
          )}
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {shown.map((m) => (
              <div key={m.name} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
                <Avatar name={m.name} tone={toneOf(m.name)} size="h-14 w-14 text-sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{m.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{m.meetings} rapat · {m.segments} segmen</div>
                </div>
                <span className="self-end text-[11px] font-semibold text-brand-600">Terakhir {fmtDate(m.last, { day: "numeric", month: "short" })}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
