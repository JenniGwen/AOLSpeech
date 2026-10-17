import { liveBlocker } from "../lib/compat";
import { useStore } from "../store";

const blocker = liveBlocker();

/** Pesan non-fatal (bisa ditutup), dan peringatan kompatibilitas browser. */
export default function Banner() {
  const { notice, setNotice } = useStore();
  return (
    <>
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
