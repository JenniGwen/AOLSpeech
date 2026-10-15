import { useStore } from "../store";
import { download, slug } from "../lib/format";

export default function StatsBar() {
  const { log, lastPartialMs, backend, title } = useStore();
  const finals = log.filter((r) => r.type === "final");
  const avgFinal = finals.length ? finals.reduce((a, r) => a + r.latencyMs, 0) / finals.length : null;
  const proc = log.reduce((a, r) => a + r.latencyMs / 1000, 0), audio = log.reduce((a, r) => a + r.audioSec, 0);
  const rtf = audio ? proc / audio : null;

  const csv = () =>
    download(`latency-${slug(title)}.csv`, ["t,type,latencyMs,audioSec", ...log.map((r) => `${r.t.toFixed(2)},${r.type},${r.latencyMs.toFixed(1)},${r.audioSec.toFixed(2)}`)].join("\n"), "text/csv");

  const Item = ({ k, v }: { k: string; v: string }) => (
    <span><span className="text-slate-400">{k}</span> <span className="font-medium tabular-nums text-slate-700">{v}</span></span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
      <Item k="Partial terakhir" v={lastPartialMs != null ? `${Math.round(lastPartialMs)} ms` : "–"} />
      <Item k="Rata-rata final" v={avgFinal != null ? `${Math.round(avgFinal)} ms` : "–"} />
      <Item k="RTF" v={rtf != null ? rtf.toFixed(3) : "–"} />
      <Item k="Backend" v={backend ? (backend === "webgpu" ? "WebGPU" : "WASM") : "–"} />
      <button onClick={csv} disabled={!log.length} className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
        Unduh log latency (.csv)
      </button>
    </div>
  );
}
