import { retryLoad } from "../lib/engine";
import { useStore } from "../store";

/** Halaman khusus memuat model ASR. Aplikasi utama baru tampil setelah model siap, jadi Start langsung bisa ditekan. */
export default function LoadingScreen() {
  const { status, load, error } = useStore();
  const pct = load.total ? Math.min(100, Math.round((load.loaded / load.total) * 100)) : 0;

  if (status === "error")
    return (
      <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center text-sm text-red-800">
        <b>Model gagal dimuat.</b>
        {error && <div className="max-w-md break-words font-mono text-xs text-red-700/80">{error}</div>}
        <button onClick={retryLoad} className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-500">Coba lagi</button>
      </div>
    );

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-sky-500" />
      <p className="text-sm font-medium tabular-nums text-slate-600">Loading model... {pct}%</p>
    </div>
  );
}
