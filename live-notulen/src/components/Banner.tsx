import { retryLoad } from "../lib/engine";
import { liveBlocker } from "../lib/compat";
import { useStore } from "../store";

const blocker = liveBlocker();

/** Error model (dengan Retry), pesan non-fatal (bisa ditutup), dan peringatan kompatibilitas browser. */
export default function Banner() {
  const { status, error, notice, setNotice } = useStore();
  return (
    <>
      {status === "error" && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="min-w-0 flex-1">
            <b>Model ASR gagal dimuat.</b> Periksa koneksi internet (model ±210 MB diunduh sekali dari Hugging Face, lalu disimpan di cache browser).
            {error && <div className="mt-1 break-words font-mono text-xs text-red-700/80">{error}</div>}
          </div>
          <button onClick={retryLoad} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-500">Coba lagi</button>
        </div>
      )}
      {blocker && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {blocker} Transkrip dari file audio tetap bisa dipakai.
        </div>
      )}
      {notice && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Tutup" className="text-amber-700 hover:text-amber-950">✕</button>
        </div>
      )}
    </>
  );
}
