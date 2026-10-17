import { useEffect, useState } from "react";
import { deleteSession, listSessions, type SessionRecord } from "../lib/db";
import { asrWorker, openSession } from "../lib/engine";
import { useStore } from "../store";

export default function History() {
  const [items, setItems] = useState<SessionRecord[]>([]);
  const { sessionId, recording, file } = useStore();
  const refresh = () => listSessions().then(setItems).catch(() => setItems([]));
  const remove = async (id: string) => {
    // notulen yang sedang terbuka → kosongkan dulu supaya autosave tidak menyimpannya lagi
    if (id === useStore.getState().sessionId) { useStore.getState().newSession(); asrWorker.postMessage({ type: "reset" }); }
    await deleteSession(id);
    refresh();
  };

  useEffect(() => {
    refresh();
    window.addEventListener("sessions-changed", refresh);
    return () => window.removeEventListener("sessions-changed", refresh);
  }, []);

  return (
    <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">Riwayat meeting</h2>
      {!items.length && <p className="text-xs text-slate-400">Belum ada notulen tersimpan. Notulen otomatis tersimpan di browser ini.</p>}
      <ul className="space-y-1">
        {items.map((r) => (
          <li key={r.id} className={`group flex items-start gap-2 rounded-lg px-2 py-1.5 ${r.id === sessionId ? "bg-sky-50" : "hover:bg-slate-50"}`}>
            <button className="flex-1 text-left disabled:cursor-not-allowed" disabled={recording || !!file} onClick={() => openSession(r)}>
              <div className="truncate text-sm text-slate-800">{r.title}</div>
              <div className="text-xs text-slate-400">
                {new Date(r.meetingAt ?? r.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} · {r.segments.length} segmen
              </div>
            </button>
            <button
              className="text-xs text-slate-300 opacity-0 hover:text-red-600 group-hover:opacity-100"
              title="Hapus"
              disabled={(recording || !!file) && r.id === sessionId}
              onClick={() => confirm(`Hapus "${r.title}"?`) && remove(r.id)}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
