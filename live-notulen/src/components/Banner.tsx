import { useStore } from "../store";
import Icon from "../ui/Icon";

/** Pesan non-fatal (bisa ditutup): izin mic, file gagal dibaca, MT gagal, … */
export default function Banner() {
  const { notice, setNotice } = useStore();
  if (!notice) return null;
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3.5 text-sm text-amber-900">
      <span className="flex-1">{notice}</span>
      <button onClick={() => setNotice(null)} aria-label="Tutup" className="text-amber-700 hover:text-amber-950"><Icon name="x" className="h-4 w-4" /></button>
    </div>
  );
}
