import { useEffect, useRef, useState } from "react";
import { retryLoad } from "../lib/engine";
import { useStore } from "../store";
import Icon from "../ui/Icon";

/** Halaman khusus memuat model ASR. Aplikasi utama baru tampil setelah model siap, jadi Start langsung bisa ditekan. */
export default function LoadingScreen() {
  const { status, load, error } = useStore();
  const pct = load.total ? Math.min(100, Math.round((load.loaded / load.total) * 100)) : 0;
  // kecepatan unduh (rata-rata 2 detik terakhir) → bedakan "unduh dari internet" vs "dari cache" vs "menyiapkan"
  const hist = useRef<{ t: number; b: number }[]>([]);
  const [speed, setSpeed] = useState(0);
  useEffect(() => {
    const now = Date.now();
    hist.current = [...hist.current.filter((h) => now - h.t < 2000), { t: now, b: load.loaded }];
    const first = hist.current[0];
    setSpeed(now - first.t > 300 ? (load.loaded - first.b) / ((now - first.t) / 1000) : 0);
  }, [load.loaded]);
  const mb = (b: number) => (b / 1e6).toFixed(0);
  const detail = !load.total
    ? "Menghubungi server model…"
    : pct >= 100
      ? "Menyiapkan model di perangkat ini… (sekali per buka halaman)"
      : `${mb(load.loaded)} / ${mb(load.total)} MB${speed > 0 ? ` · ${(speed / 1e6).toFixed(1)} MB/s` : ""}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-900 to-navy-700 px-4 text-white">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-xl shadow-brand-600/40">
          <Icon name="cap" className="h-8 w-8" />
        </span>
        <h1 className="text-3xl font-bold tracking-tight">Rapatin</h1>
        {status === "error" ? (
          <div role="alert" className="mt-6 space-y-3 text-sm">
            <b className="text-rose-300">Model gagal dimuat.</b>
            {error && <div className="break-words font-mono text-xs text-white/60">{error}</div>}
            <button onClick={retryLoad} className="rounded-xl bg-white px-5 py-2.5 font-semibold text-ink hover:bg-slate-100">Coba lagi</button>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-white/60">Menyiapkan model pengenalan suara…</p>
            <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-[#a78bfa] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-3 text-sm font-semibold tabular-nums text-white/80">Loading model... {pct}%</p>
            <p className="mt-1 text-xs tabular-nums text-white/50">{detail}</p>
            {speed > 0 && speed < 20e6 && pct < 100 && (
              <p className="mt-4 text-xs text-white/50">Model sedang diunduh. Setelah ini tersimpan di browser, jadi pembukaan berikutnya jauh lebih cepat.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
