import { useStore } from "../store";
import { download, slug } from "../lib/format";
import Icon from "../ui/Icon";

export default function StatsBar() {
  const { log, lastPartialMs, backend, title, segments, recordingUrl } = useStore();
  const finals = log.filter((r) => r.type === "final");
  const avgFinal = finals.length ? finals.reduce((a, r) => a + r.latencyMs, 0) / finals.length : null;
  const proc = log.reduce((a, r) => a + r.latencyMs / 1000, 0), audio = log.reduce((a, r) => a + r.audioSec, 0);
  const rtf = audio ? proc / audio : null;

  const csv = () =>
    download(`latency-${slug(title)}.csv`, ["t,type,latencyMs,audioSec", ...log.map((r) => `${r.t.toFixed(2)},${r.type},${r.latencyMs.toFixed(1)},${r.audioSec.toFixed(2)}`)].join("\n"), "text/csv");

  const items = [
    ["Partial terakhir", lastPartialMs != null ? `${Math.round(lastPartialMs)} ms` : "–"],
    ["Rata-rata final", avgFinal != null ? `${Math.round(avgFinal)} ms` : "–"],
    ["Real-time factor", rtf != null ? rtf.toFixed(3) : "–"],
    ["Backend", backend ? (backend === "webgpu" ? "WebGPU" : "WASM") : "–"],
    ["Segmen", String(segments.length)],
    ["Audio diproses", audio ? `${audio.toFixed(1)} s` : "–"],
  ];
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="text-xs text-slate-500">{k}</div>
            <div className="mt-1 text-xl font-bold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Latency diukur per sesi rekam ini. Model Whisper-base fine-tuned berjalan lokal di browser.</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={csv} disabled={!log.length} className="btn"><Icon name="download" className="h-4 w-4" /> Log latency (.csv)</button>
        {recordingUrl && <a className="btn" href={recordingUrl} download={`${slug(title)}.webm`}><Icon name="download" className="h-4 w-4" /> Unduh rekaman</a>}
      </div>
    </div>
  );
}
