import { SR, mfcc, C0Vad, SpeakerTracker } from "./mfcc.js";

// Parameter streaming = notebook Bagian 8
const CHUNK_S = 0.5, UPDATE_S = 1.0, SILENCE_S = 0.6, MAX_SEG_S = 15.0;
// Halusinasi Whisper yang sering muncul di audio pendek/hening
const HALLU = /^(terima kasih( telah menonton| sudah menonton)?|thank you( for watching)?|sampai jumpa.*|subtitle.*|\.+|-+)[.!\s]*$/i;

const $ = (s) => document.querySelector(s);
const ui = {
  rec: $("#rec"), recLabel: $("#rec-label"), source: $("#source"), status: $("#status"), bar: $("#bar"),
  list: $("#transcript"), empty: $("#empty"), partial: $("#partial"), vad: $("#vad"), timer: $("#timer"),
  stats: $("#stats"), dlTxt: $("#dl-txt"), dlVid: $("#dl-video"), copy: $("#copy"), clear: $("#clear"),
};

let mode = "orig"; // orig | en | id
const entries = []; // {id, t, speaker, orig, tr:{en,id}, pending}
let ready = false, recording = false;

// ---------------- Worker ----------------
const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
const files = {};
worker.onmessage = ({ data: m }) => {
  if (m.type === "progress") {
    files[m.file] = [m.loaded, m.total];
    const [l, t] = Object.values(files).reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
    setStatus(`Download ${m.label}… ${(l / 1e6).toFixed(0)} / ${(t / 1e6).toFixed(0)} MB`, t ? l / t : 0);
  } else if (m.type === "ready") {
    ready = true; ui.rec.disabled = false;
    setStatus(`Model siap · ${m.device === "webgpu" ? "WebGPU" : "WASM (CPU)"} · semua proses lokal di browser`, null);
  } else if (m.type === "error") {
    setStatus(`Gagal load model: ${m.message}`, null, true);
  } else if (m.type === "asr") onAsr(m);
  else if (m.type === "translation") onTranslation(m);
};
worker.postMessage({ type: "load" });

function setStatus(text, frac, err = false) {
  ui.status.textContent = text;
  ui.status.classList.toggle("err", err);
  ui.bar.style.display = frac == null ? "none" : "block";
  if (frac != null) ui.bar.firstElementChild.style.width = `${Math.round(frac * 100)}%`;
}

// ---------------- Capture ----------------
let ctx, streams = [], recorder, recChunks = [], startedAt = 0, timerId;
let vad, tracker, seg = [], segStart = 0, sil = 0, sinceUpdate = 0, tAudio = 0;
let segId = 0, partialBusy = false, finalsSent = new Set(), lat = [];

async function start() {
  const src = ui.source.value;
  streams = [];
  try {
    if (src !== "mic") {
      const d = await navigator.mediaDevices.getDisplayMedia({
        video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        systemAudio: "include", selfBrowserSurface: "exclude",
      });
      if (!d.getAudioTracks().length) {
        d.getTracks().forEach((t) => t.stop());
        alert('Audio tidak ikut ter-share. Pilih tab meeting (Meet/Zoom web/Teams) dan centang "Share tab audio" / "Also share system audio".');
        return;
      }
      d.getVideoTracks()[0].addEventListener("ended", stop);
      streams.push(d);
    }
    if (src !== "screen") streams.push(await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }));
  } catch (e) {
    streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    if (e.name !== "NotAllowedError") alert("Tidak bisa mulai capture: " + e.message);
    return;
  }

  ctx = new AudioContext({ sampleRate: SR });
  await ctx.audioWorklet.addModule(new URL("./capture-worklet.js", import.meta.url));
  const node = new AudioWorkletNode(ctx, "capture");
  const mixOut = ctx.createMediaStreamDestination(); // audio campuran untuk file rekaman
  for (const s of streams) {
    if (!s.getAudioTracks().length) continue;
    const n = ctx.createMediaStreamSource(s);
    n.connect(node); n.connect(mixOut);
  }
  const mute = ctx.createGain(); mute.gain.value = 0;
  node.connect(mute).connect(ctx.destination);
  node.port.onmessage = (e) => onChunk(e.data);

  // Rekaman layar (+ audio campuran) untuk di-download setelah selesai
  const video = streams.find((s) => s.getVideoTracks().length)?.getVideoTracks() || [];
  const recStream = new MediaStream([...video, ...mixOut.stream.getAudioTracks()]);
  recChunks = [];
  recorder = new MediaRecorder(recStream, { mimeType: video.length ? "video/webm" : "audio/webm" });
  recorder.ondataavailable = (e) => e.data.size && recChunks.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(recChunks, { type: recorder.mimeType });
    ui.dlVid.href = URL.createObjectURL(blob);
    ui.dlVid.download = `meeting-${stamp()}.webm`;
    ui.dlVid.hidden = false;
  };
  recorder.start(1000);

  vad = new C0Vad(); tracker ??= new SpeakerTracker();
  seg = []; sil = 0; sinceUpdate = 0; tAudio = 0; lat = [];
  recording = true; startedAt = Date.now();
  ui.rec.classList.add("on"); ui.recLabel.textContent = "Stop"; ui.source.disabled = true;
  ui.dlVid.hidden = true;
  timerId = setInterval(tick, 500); tick();
}

function stop() {
  if (!recording) return;
  recording = false;
  if (seg.length) finalize();
  recorder?.state !== "inactive" && recorder.stop();
  streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
  ctx?.close();
  clearInterval(timerId);
  ui.rec.classList.remove("on"); ui.recLabel.textContent = "Record screen"; ui.source.disabled = false;
  ui.vad.className = "vad"; ui.partial.hidden = true;
}

function tick() {
  const s = Math.floor((Date.now() - startedAt) / 1000);
  ui.timer.textContent = fmt(s);
}

// ---------------- Streaming loop (port simulate_stream) ----------------
function onChunk(ch) {
  if (!recording) return;
  const speech = vad.isSpeech(ch);
  ui.vad.className = "vad " + (speech ? "speech" : "silent");
  if (speech && !seg.length) segStart = tAudio;
  tAudio += ch.length / SR;
  if (speech || seg.length) seg.push(ch);
  sil = speech ? 0 : sil + CHUNK_S;
  sinceUpdate += CHUNK_S;
  const segLen = seg.length * CHUNK_S;
  if (seg.length && (sil >= SILENCE_S || segLen >= MAX_SEG_S)) finalize();
  else if (seg.length && sinceUpdate >= UPDATE_S && !partialBusy) {
    partialBusy = true; sinceUpdate = 0;
    worker.postMessage({ type: "asr", id: segId, kind: "partial", audio: concat(seg) });
  }
}

function finalize() {
  // buang ekor hening supaya Whisper tidak halusinasi
  const tail = Math.min(Math.round(sil / CHUNK_S), seg.length - 1);
  const audio = concat(seg.slice(0, seg.length - tail));
  const speaker = tracker.assign(mfcc(audio));
  const id = segId++;
  finalsSent.add(id);
  entries.push({ id, t: segStart, speaker, orig: "", tr: {}, pending: true, dur: audio.length / SR });
  worker.postMessage({ type: "asr", id, kind: "final", audio });
  seg = []; sinceUpdate = 0;
  ui.partial.hidden = true;
  render();
}

function onAsr(m) {
  if (m.kind === "partial") {
    partialBusy = false;
    if (!finalsSent.has(m.id) && recording && m.text) { ui.partial.hidden = false; ui.partial.querySelector(".txt").textContent = m.text; }
    return;
  }
  const e = entries.find((x) => x.id === m.id);
  if (!e) return;
  lat.push(m.ms);
  ui.stats.textContent = `latency final rata-rata ${(lat.reduce((a, b) => a + b, 0) / lat.length / 1000).toFixed(2)} s · ${entries.length} segmen`;
  if (!m.text || (HALLU.test(m.text) && e.dur < 2.5)) { entries.splice(entries.indexOf(e), 1); render(); return; }
  e.orig = m.text; e.pending = false;
  if (mode !== "orig") requestTr(e, mode);
  render();
}

function requestTr(e, target) {
  if (e.pending || e.tr[target] !== undefined) return;
  e.tr[target] = null; // null = sedang diterjemahkan
  worker.postMessage({ type: "translate", id: e.id, target, text: e.orig });
}

function onTranslation(m) {
  const e = entries.find((x) => x.id === m.id);
  if (!e) return;
  e.tr[m.target] = m.text ?? e.orig; // kalau gagal, tampilkan teks asli
  render();
}

// ---------------- Render ----------------
const COLORS = ["#2563eb", "#db2777", "#059669", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#65a30d"];

function shownText(e) {
  if (mode === "orig") return { main: e.orig, sub: null, busy: false };
  const t = e.tr[mode];
  return { main: t ?? e.orig, sub: t ? e.orig : null, busy: t == null };
}

function render() {
  const atBottom = ui.list.scrollHeight - ui.list.scrollTop - ui.list.clientHeight < 80;
  ui.empty.hidden = entries.length > 0;
  ui.list.querySelectorAll(".row").forEach((r) => r.remove());
  for (const e of entries) {
    const row = document.createElement("div");
    row.className = "row";
    const c = COLORS[e.speaker % COLORS.length];
    const { main, sub, busy } = e.pending ? { main: "…", sub: null, busy: true } : shownText(e);
    row.innerHTML = `<div class="meta"><span class="spk" style="--c:${c}">Speaker ${e.speaker + 1}</span><span class="ts">${fmt(e.t)}</span>${busy ? '<span class="spin"></span>' : ""}</div>
      <div class="txt"></div>${sub ? '<div class="orig"></div>' : ""}`;
    row.querySelector(".txt").textContent = main;
    if (sub) row.querySelector(".orig").textContent = sub;
    ui.list.insertBefore(row, ui.partial);
  }
  ui.dlTxt.disabled = ui.copy.disabled = !entries.some((e) => !e.pending);
  if (atBottom) ui.list.scrollTop = ui.list.scrollHeight;
}

function transcriptText() {
  const label = { orig: "Asli (campur)", en: "Full English", id: "Full Indonesia" }[mode];
  return `Notulen meeting — ${new Date().toLocaleString()} — mode: ${label}\n\n` +
    entries.filter((e) => !e.pending).map((e) => `[${fmt(e.t)}] Speaker ${e.speaker + 1}: ${shownText(e).main}`).join("\n");
}

// ---------------- Helpers & events ----------------
function concat(chs) { const out = new Float32Array(chs.reduce((n, c) => n + c.length, 0)); let o = 0; for (const c of chs) { out.set(c, o); o += c.length; } return out; }
function fmt(s) { s = Math.floor(s); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; }
function stamp() { return new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-"); }

ui.rec.onclick = () => (recording ? stop() : start());
document.querySelectorAll('input[name="mode"]').forEach((r) => r.addEventListener("change", () => {
  mode = r.value;
  if (mode !== "orig") { worker.postMessage({ type: "preloadMt", target: mode }); entries.forEach((e) => requestTr(e, mode)); }
  render();
}));
ui.dlTxt.onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([transcriptText()], { type: "text/plain" }));
  a.download = `notulen-${stamp()}.txt`; a.click();
};
ui.copy.onclick = async () => { await navigator.clipboard.writeText(transcriptText()); ui.copy.textContent = "Tersalin ✓"; setTimeout(() => (ui.copy.textContent = "Copy"), 1500); };
ui.clear.onclick = () => { if (confirm("Hapus semua transkrip?")) { entries.length = 0; tracker = new SpeakerTracker(); render(); } };
if (!navigator.mediaDevices?.getDisplayMedia) { ui.source.value = "mic"; ui.source.querySelectorAll('option:not([value="mic"])').forEach((o) => (o.disabled = true)); }
render();
