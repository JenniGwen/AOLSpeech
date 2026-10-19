import { setMode } from "../lib/engine";
import { useStore, type Mode } from "../store";
import Icon from "./Icon";

const MODES: { value: Mode; label: string; title: string }[] = [
  { value: "asli", label: "Asli", title: "Transkrip asli (campur Indonesia + English)" },
  { value: "id", label: "ID", title: "Terjemahkan semua ke Bahasa Indonesia" },
  { value: "en", label: "EN", title: "Translate everything to English" },
];

/** Pilihan bahasa tampilan transkrip (terjemahan lokal). */
export function LangToggle() {
  const { mode, mtLoading } = useStore();
  return (
    <div className="flex items-center gap-2">
      {mtLoading && <span className="hidden h-4 w-4 animate-spin rounded-full border-2 border-brand-100 border-t-brand-500 sm:block" title="Mengunduh model terjemahan…" />}
      <div role="radiogroup" aria-label="Bahasa transkrip" className="inline-flex rounded-xl border border-slate-200 bg-slate-100/70 p-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            role="radio"
            aria-checked={mode === m.value}
            title={m.title}
            onClick={() => setMode(m.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${mode === m.value ? "bg-brand-500 text-white shadow-sm" : "text-slate-500 hover:text-ink"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Topbar({ crumb, title, children }: { crumb: string; title: React.ReactNode; children?: React.ReactNode }) {
  const setPage = useStore((s) => s.setPage);
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-5 py-5 backdrop-blur sm:px-10">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <nav className="mb-1 flex items-center gap-2 text-sm text-slate-500">
            <button onClick={() => setPage("rapat")} className="hover:text-ink">Beranda</button>
            <span className="text-slate-300">/</span>
            <span>{crumb}</span>
          </nav>
          {typeof title === "string" ? <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1> : title}
        </div>
        <div className="flex flex-wrap items-center gap-3">{children}</div>
      </div>
    </header>
  );
}

/** Tombol "Buka ruang rapat" di halaman selain ruang rapat. */
export function OpenRoomButton() {
  const setPage = useStore((s) => s.setPage);
  return (
    <button onClick={() => setPage("rapat")} className="btn-dark">
      <Icon name="mic" className="h-4 w-4" /> Buka ruang rapat
    </button>
  );
}
