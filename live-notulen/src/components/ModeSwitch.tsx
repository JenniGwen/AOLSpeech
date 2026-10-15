import { setMode } from "../lib/engine";
import { useStore, type Mode } from "../store";

const MODES: { value: Mode; label: string }[] = [
  { value: "asli", label: "Asli (campur)" },
  { value: "en", label: "Full English" },
  { value: "id", label: "Full Indonesia" },
];

export default function ModeSwitch() {
  const { mode, mtLoading } = useStore();
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="Mode tampilan" className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-sm">
        {MODES.map((m) => (
          <button
            key={m.value}
            role="radio"
            aria-checked={mode === m.value}
            onClick={() => setMode(m.value)}
            className={`rounded-full px-3 py-1 transition ${mode === m.value ? "bg-sky-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mtLoading && <span className="text-xs text-slate-500">Mengunduh model terjemahan…</span>}
    </div>
  );
}
