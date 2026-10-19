import Icon, { type IconName } from "./Icon";
import Avatar from "./Avatar";
import { newMeeting } from "../lib/engine";
import { useSessions } from "../lib/sessions";
import { useStore, type Page } from "../store";

const NAV: { page: Page; label: string; icon: IconName }[] = [
  { page: "rapat", label: "Beranda", icon: "home" },
  { page: "semua", label: "Semua rapat", icon: "file" },
  { page: "kalender", label: "Kalender", icon: "calendar" },
  { page: "anggota", label: "Anggota", icon: "users" },
  { page: "arsip", label: "Arsip", icon: "archive" },
];

function NavItem({ page, label, icon, badge }: { page: Page; label: string; icon: IconName; badge?: number }) {
  const { page: cur, setPage, recording } = useStore();
  const active = cur === page;
  return (
    <button
      onClick={() => setPage(page)}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center gap-4 rounded-xl px-4 py-3 text-[15px] font-medium transition ${active ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5 hover:text-white"}`}
    >
      <Icon name={icon} className={`h-5 w-5 ${active ? "text-brand-400" : ""}`} />
      <span className="flex-1 text-left">{label}</span>
      {page === "rapat" && recording && <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" title="Sedang merekam" />}
      {badge != null && <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/80">{badge}</span>}
    </button>
  );
}

export default function Sidebar() {
  const { recording, file, segments, setPage, profile } = useStore();
  const sessions = useSessions();
  const active = sessions.filter((s) => !s.archived).length;

  const create = () => {
    if (segments.length && !confirm("Mulai rapat baru? Notulen sekarang sudah tersimpan di Semua rapat.")) return;
    newMeeting();
    setPage("rapat");
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-[290px] shrink-0 flex-col bg-gradient-to-b from-navy-900 to-navy-800 px-5 py-6 text-white lg:flex">
      <div className="mb-8 flex items-center gap-3 px-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-lg shadow-brand-600/30">
          <Icon name="cap" className="h-5 w-5" />
        </span>
        <span className="text-2xl font-bold tracking-tight">Rapatin</span>
      </div>

      <button onClick={create} disabled={recording || !!file} className="mb-8 flex items-center justify-center gap-3 rounded-xl bg-white py-3.5 text-[15px] font-semibold text-ink shadow-sm transition hover:bg-slate-100 disabled:opacity-50">
        <Icon name="plus" /> Rapat baru
      </button>

      <div className="mb-3 px-2 text-xs font-bold uppercase tracking-[0.16em] text-white/50">Ruang kerja</div>
      <nav className="space-y-1.5">
        {NAV.map((n) => <NavItem key={n.page} {...n} badge={n.page === "semua" ? active : undefined} />)}
      </nav>

      <button onClick={() => setPage("pengaturan")} className="mt-8 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:bg-white/[0.06]">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-lg font-bold text-ink">{profile.org.trim()[0]?.toUpperCase() ?? "U"}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{profile.org}</span>
          <span className="block truncate text-xs text-white/60">{profile.campus}</span>
        </span>
        <Icon name="right" className="h-4 w-4 text-white/50" />
      </button>

      <div className="mt-auto space-y-4">
        <NavItem page="pengaturan" label="Pengaturan" icon="settings" />
        <div className="flex items-center gap-3 border-t border-white/10 px-2 pt-4">
          <Avatar name={profile.name} tone="bg-ink-soft text-white/80" size="h-10 w-10 text-xs" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{profile.name}</div>
            <div className="truncate text-xs text-white/60">{profile.role}</div>
          </div>
          <button onClick={() => setPage("pengaturan")} aria-label="Pengaturan profil" className="text-white/60 hover:text-white"><Icon name="more" /></button>
        </div>
      </div>
    </aside>
  );
}

/** Navigasi bawah untuk layar kecil (sidebar disembunyikan). */
export function MobileNav() {
  const { page, setPage } = useStore();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-slate-200 bg-white/95 py-2 backdrop-blur lg:hidden">
      {NAV.map((n) => (
        <button key={n.page} onClick={() => setPage(n.page)} className={`flex flex-col items-center gap-0.5 px-2 text-[10px] font-semibold ${page === n.page ? "text-brand-600" : "text-slate-500"}`}>
          <Icon name={n.icon} className="h-5 w-5" />
          {n.label}
        </button>
      ))}
    </nav>
  );
}
