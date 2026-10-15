/// <reference lib="webworker" />
// ASR worker: chunk 0,5 s → MFCC manual → VAD c0 → segmentasi → Whisper (lokal) → SpeakerTracker.
// Port dari simulate_stream() di notebook Bagian 8. Tidak ada audio yang dikirim ke server mana pun.
import { env, pipeline, Tensor, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";
import { HF_REPO, LANGUAGE, SR, STREAM } from "../config";
import { mfcc } from "../dsp/mfcc";
import { C0Vad } from "../dsp/vad";
import { SpeakerTracker } from "../dsp/speaker";

// Opsional: host model lain dengan struktur HF ({model}/resolve/{revision}/…), mis. mirror lokal untuk uji model baru.
// Default (tidak di-set) = huggingface.co.
if (import.meta.env.VITE_HF_HOST) env.remoteHost = import.meta.env.VITE_HF_HOST;

const post = (m: unknown) => (self as unknown as Worker).postMessage(m);

// Halusinasi umum Whisper pada audio pendek (dibuang hanya kalau segmennya pendek)
const HALLU = /^(terima kasih( telah menonton| sudah menonton)?|thank you( for watching)?|sampai jumpa.*|subtitle.*|[.\-\s]*)[.!\s]*$/i;

let asr: AutomaticSpeechRecognitionPipeline | null = null;
let loadedBackend: "webgpu" | "wasm" = "wasm";

/**
 * Decoder hasil export optimum 1.23 / transformers 4.46 punya input `cache_position`, yang belum diisi
 * oleh Transformers.js v3 untuk Whisper → error "Missing the following inputs: cache_position".
 * Isi otomatis: cache_position = [past_len, …, past_len + n_token_baru − 1].
 */
function patchCachePosition(p: AutomaticSpeechRecognitionPipeline) {
  const model = p.model as any;
  if (!model.sessions?.decoder_model_merged?.inputNames?.includes("cache_position")) return;
  const orig = model.addPastKeyValues.bind(model);
  model.addPastKeyValues = (feeds: Record<string, any>, pkv: unknown) => {
    orig(feeds, pkv);
    const past: number = feeds["past_key_values.0.decoder.key"]?.dims[2] ?? 0;
    const n: number = feeds.input_ids.dims[1];
    feeds.cache_position = new Tensor("int64", BigInt64Array.from({ length: n }, (_, i) => BigInt(past + i)), [n]);
  };
}

async function load(wasmOnly = false) {
  if (asr) return post({ type: "ready", backend: loadedBackend }); // retry setelah sukses sebelumnya
  const progress_callback = (p: any) => {
    if (p.status === "progress") post({ type: "progress", file: p.file, loaded: p.loaded, total: p.total });
  };
  const create = (device: "webgpu" | "wasm") =>
    (pipeline as any)("automatic-speech-recognition", HF_REPO, {
      device,
      // WASM: sesuai brief (decoder q8 per-channel, 76 MB; WER setara fp32). WebGPU: decoder fp32 (199 MB) — op int8 tidak didukung WebGPU.
      dtype: { encoder_model: "fp32", decoder_model_merged: device === "webgpu" ? "fp32" : "q8" },
      progress_callback,
    }) as Promise<AutomaticSpeechRecognitionPipeline>;

  let backend: "webgpu" | "wasm" = "wasm";
  // navigator.gpu bisa ada tanpa adapter (Linux, GPU lama, headless) → cek dulu supaya ORT tidak mencoba WebGPU
  const gpu = (self.navigator as any).gpu;
  const adapter = !wasmOnly && gpu ? await gpu.requestAdapter().catch(() => null) : null;
  if (adapter) {
    try { asr = await create("webgpu"); backend = "webgpu"; } catch (e) {
      // init WebGPU yang gagal "meracuni" ORT di worker ini (WASM ikut gagal) → minta worker baru mode WASM
      console.warn("WebGPU gagal → restart worker dengan WASM", e);
      return post({ type: "fallback" });
    }
  }
  if (!asr) asr = await create("wasm");
  loadedBackend = backend;
  patchCachePosition(asr);
  await asr(new Float32Array(SR), { language: LANGUAGE, task: "transcribe" }); // warm-up
  post({ type: "ready", backend });
}

// ---------------- Streaming state ----------------
let vad = new C0Vad();
let tracker = new SpeakerTracker();
let seg: Float32Array[] = [];
let segStart = 0, silence = 0, sinceUpdate = 0, tAudio = 0, segId = 0;
// Mode file: seluruh audio di-chunk sekaligus, tanpa partial; selesai saat antrean kosong.
let fileMode = false;

type Job = { kind: "partial" | "final"; id: number; audio: Float32Array; start: number; speaker?: number };
const jobs: Job[] = [];
let running = false;

const concat = (chs: Float32Array[]) => {
  const out = new Float32Array(chs.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chs) { out.set(c, o); o += c.length; }
  return out;
};

async function runJobs() {
  if (running || !asr) return;
  running = true;
  post({ type: "busy", busy: true });
  while (jobs.length) {
    const job = jobs.shift()!;
    const audioSec = job.audio.length / SR;
    const t0 = performance.now();
    let text = "";
    try {
      // batasi token sesuai durasi (±6 token/detik) supaya decoder tidak terjebak loop pengulangan
      const max_new_tokens = Math.min(220, Math.ceil(audioSec * 6) + 10);
      const out = (await asr(job.audio, { language: LANGUAGE, task: "transcribe", max_new_tokens } as any)) as { text: string };
      text = out.text.trim().replace(/^["“'](.*)["”']$/s, "$1").trim();
    } catch (e) {
      console.error(e);
    }
    const latencyMs = performance.now() - t0;
    if (job.kind === "partial") {
      // partial basi (segmennya sudah final) tidak perlu ditampilkan
      if (job.id === segId) post({ type: "partial", id: job.id, text, latencyMs, audioSec, t: tAudio });
    } else {
      const drop = !text || (HALLU.test(text) && audioSec < 2.5);
      post({ type: "final", id: job.id, text: drop ? "" : text, speaker: job.speaker, latencyMs, audioSec, start: job.start, t: fileMode ? job.start + audioSec : tAudio });
      if (fileMode) post({ type: "fileProgress", done: job.start + audioSec });
    }
  }
  running = false;
  post({ type: "busy", busy: false });
  if (fileMode) { fileMode = false; post({ type: "fileDone" }); }
}

function finalize() {
  // buang ekor hening (≥ 0,6 s) supaya Whisper tidak berhalusinasi
  const tail = Math.min(Math.round(silence / STREAM.chunkSec), seg.length - 1);
  const audio = concat(seg.slice(0, seg.length - tail));
  const speaker = tracker.assign(mfcc(audio));
  jobs.push({ kind: "final", id: segId, audio, start: segStart, speaker });
  segId++;
  seg = [];
  sinceUpdate = 0;
  runJobs();
}

const resetStream = () => { vad = new C0Vad(); seg = []; silence = 0; sinceUpdate = 0; tAudio = 0; };

/** Audio file 16 kHz mono → jalankan pipeline streaming yang sama, chunk 0,5 s. */
function transcribeFile(audio: Float32Array) {
  resetStream();
  fileMode = true;
  const n = SR * STREAM.chunkSec;
  for (let o = 0; o < audio.length; o += n) {
    const chunk = new Float32Array(n); // chunk terakhir di-pad nol
    chunk.set(audio.subarray(o, o + n));
    onChunk(chunk, false);
  }
  if (seg.length) finalize();
  if (!running && !jobs.length) { fileMode = false; post({ type: "fileDone" }); }
}

function onChunk(chunk: Float32Array, live = true) {
  const isSpeech = vad.isSpeech(chunk);
  if (live) post({ type: "vad", speech: isSpeech });
  if (isSpeech && !seg.length) segStart = tAudio;
  tAudio += chunk.length / SR;
  if (isSpeech || seg.length) seg.push(chunk);
  silence = isSpeech ? 0 : silence + STREAM.chunkSec;
  sinceUpdate += STREAM.chunkSec;
  const segSec = seg.length * STREAM.chunkSec;

  if (seg.length && (silence >= STREAM.silenceSec || segSec >= STREAM.maxSegSec)) {
    finalize(); // FINAL — selalu diantrikan
  } else if (!fileMode && seg.length && sinceUpdate >= STREAM.updateSec && !running && !jobs.length) {
    // PARTIAL — dilewati kalau Whisper masih jalan (jangan tumpuk inference)
    sinceUpdate = 0;
    jobs.push({ kind: "partial", id: segId, audio: concat(seg), start: segStart });
    runJobs();
  }
}

self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  switch (m.type) {
    case "load":
      load(m.wasmOnly).catch((err) => post({ type: "error", message: String(err?.message ?? err) }));
      break;
    case "start": // sesi rekaman baru: reset VAD & waktu, speaker tetap dikenali di sesi yang sama
      resetStream();
      break;
    case "file":
      transcribeFile(m.data);
      break;
    case "cancel": // batalkan transkrip file: buang antrean (job yang sedang jalan tetap selesai)
      jobs.length = 0;
      if (fileMode) { fileMode = false; post({ type: "fileDone", cancelled: true }); }
      break;
    case "reset": // notulen baru
      tracker = new SpeakerTracker();
      break;
    case "chunk":
      onChunk(m.data);
      break;
    case "flush":
      if (seg.length) finalize();
      break;
  }
};
