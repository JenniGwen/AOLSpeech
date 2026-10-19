import Icon, { type IconName } from "./Icon";
import { useStore } from "../store";

/** Banner berwarna di atas halaman daftar (Semua rapat, Kalender, Anggota, Arsip). */
export default function Hero({ icon, title, subtitle, gradient }: { icon: IconName; title: string; subtitle: string; gradient: string }) {
  const org = useStore((s) => s.profile.org);
  return (
    <section className={`relative overflow-hidden rounded-3xl px-8 py-10 text-white shadow-lg sm:px-12 ${gradient}`}>
      <div className="pointer-events-none absolute -right-10 -top-40 h-80 w-80 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-24 -right-10 h-48 w-48 rounded-full bg-white/10" />
      <div className="relative flex items-center gap-6">
        <div className="flex-1">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/85">
            <Icon name={icon} className="h-4 w-4" />
            {org}
          </div>
          <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">{title}</h2>
          <p className="mt-3 max-w-xl text-sm text-white/85 sm:text-[15px]">{subtitle}</p>
        </div>
        <div className="hidden h-24 w-24 rotate-6 items-center justify-center rounded-3xl border border-white/30 bg-white/15 backdrop-blur sm:flex">
          <Icon name={icon} className="h-10 w-10 -rotate-6" />
        </div>
      </div>
    </section>
  );
}

export function StatCard({ icon, value, label, tone }: { icon: IconName; value: number | string; label: string; tone: string }) {
  return (
    <div className="card flex items-center gap-4 p-6">
      <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tone}`}><Icon name={icon} className="h-6 w-6" /></span>
      <div>
        <div className="text-3xl font-bold tabular-nums tracking-tight">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export function SearchField({ value, onChange, placeholder = "Cari rapat, agenda, atau anggota…" }: { value: string; onChange(v: string): void; placeholder?: string }) {
  return (
    <label className="relative block w-full sm:w-80">
      <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="field w-full py-3 pl-10" />
    </label>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-14 text-center text-sm text-slate-400">{children}</div>;
}
