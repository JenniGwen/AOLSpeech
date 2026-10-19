import { useMemo, useState } from "react";
import { newMeeting, openSession, persist } from "../lib/engine";
import { fmtRange, participants, sameDay, useSessions, when, whenEnd } from "../lib/sessions";
import { useStore } from "../store";
import Hero from "../ui/Hero";
import Icon from "../ui/Icon";
import Topbar, { OpenRoomButton } from "../ui/Topbar";

const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export default function Calendar() {
  const sessions = useSessions().filter((r) => !r.archived);
  const { setPage, recording, file, sessionId, segments } = useStore();
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [sel, setSel] = useState(today);

  const cells = useMemo(() => {
    const lead = (month.getDay() + 6) % 7; // minggu mulai Senin
    const n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: n }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  }, [month]);

  const onDay = (d: Date) => sessions.filter((r) => sameDay(when(r), d)).sort((a, b) => when(a) - when(b));
  const agenda = onDay(sel);
  const busy = recording || !!file;

  const schedule = () => {
    if (segments.length && !confirm("Buat rapat baru di tanggal ini? Notulen sekarang sudah tersimpan di Semua rapat.")) return;
    newMeeting();
    const at = new Date(sel);
    at.setHours(19, 0, 0, 0);
    useStore.getState().setMeetingAt(at.getTime());
    persist(true, true); // simpan walau masih kosong supaya muncul di kalender
    setPage("rapat");
  };

  return (
    <>
      <Topbar crumb="Kalender" title="Kalender kegiatan"><OpenRoomButton /></Topbar>
      <div className="space-y-6 px-5 py-7 sm:px-10">
        <Hero icon="calendar" title="Kalender kegiatan" subtitle="Atur jadwal rapat dan kegiatan tim agar tidak ada agenda yang terlewat." gradient="bg-gradient-to-r from-[#d17a5e] via-[#d98a62] to-[#e3a16a]" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <section className="card p-7">
            <div className="mb-6 flex items-center justify-between">
              <button className="icon-btn h-10 w-10 bg-slate-50" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Bulan sebelumnya"><Icon name="left" className="h-4 w-4" /></button>
              <h2 className="text-lg font-medium">{month.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</h2>
              <button className="icon-btn h-10 w-10 bg-slate-50" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Bulan berikutnya"><Icon name="right" className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-7 border-b border-slate-100 pb-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">
              {DAYS.map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((d, i) => {
                if (!d) return <div key={i} className="h-20 border-b border-slate-100" />;
                const has = onDay(d).length;
                const selected = sameDay(sel.getTime(), d), isToday = sameDay(today.getTime(), d);
                return (
                  <div key={i} className="flex h-20 items-center justify-center border-b border-slate-100 p-1">
                    <button
                      onClick={() => setSel(d)}
                      className={`flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-xl text-sm transition ${selected ? "bg-gradient-to-br from-brand-500 to-[#7d5cd0] font-semibold text-white shadow-lg shadow-brand-500/30" : isToday ? "font-bold text-brand-600 hover:bg-slate-50" : "hover:bg-slate-50"}`}
                    >
                      {d.getDate()}
                      <span className={`h-1.5 w-1.5 rounded-full ${has ? (selected ? "bg-white" : "bg-orange-500") : "bg-transparent"}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
          <aside className="card p-7">
            <div className="text-6xl font-extrabold tracking-tight text-brand-600">{sel.getDate()}</div>
            <div className="mt-1 text-sm text-slate-500">{sel.toLocaleDateString("id-ID", { weekday: "long", month: "long", year: "numeric" })}</div>
            <hr className="my-6 border-slate-100" />
            <h3 className="mb-4 text-lg font-medium">{sameDay(sel.getTime(), today) ? "Agenda hari ini" : "Agenda"}</h3>
            {!agenda.length && <p className="mb-4 text-sm text-slate-400">Tidak ada rapat di tanggal ini.</p>}
            <div className="space-y-3">
              {agenda.map((r) => (
                <div key={r.id} className="rounded-2xl border-l-4 border-brand-500 bg-brand-50 p-5">
                  <div className="text-xs font-bold text-brand-600">{fmtRange(when(r), whenEnd(r))} WIB</div>
                  <div className="mt-2 font-semibold">{r.title}</div>
                  <div className="mt-3 text-xs text-slate-500">{participants(r).length} peserta · {r.segments.length} segmen{r.agenda?.length ? ` · ${r.agenda.length} agenda` : ""}</div>
                  <button
                    disabled={busy && r.id !== sessionId}
                    onClick={() => { if (r.id !== sessionId) openSession(r); setPage("rapat"); }}
                    className="mt-4 w-full rounded-xl bg-brand-500 py-3 text-xs font-bold text-white transition hover:bg-brand-600 disabled:opacity-40"
                  >
                    Buka ruang rapat
                  </button>
                </div>
              ))}
            </div>
            <button onClick={schedule} disabled={busy} className="btn mt-4 w-full border-dashed">
              <Icon name="plus" className="h-4 w-4" /> Jadwalkan rapat di tanggal ini
            </button>
          </aside>
        </div>
      </div>
    </>
  );
}
