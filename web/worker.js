// Inference di Web Worker supaya UI tidak freeze. Semua jalan lokal di browser (Transformers.js).
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6";

// Coba folder lokal ./models/<id>/ dulu (symlink ke onnx_hub_upload), kalau tidak ada -> Hugging Face Hub.
env.localModelPath = new URL("./models/", self.location.href).href;
env.allowLocalModels = true;
env.allowRemoteModels = true;

const ASR_MODEL = "Jennigwen/whisper-base-ukm-codeswitch";
const MT_MODELS = { en: "Xenova/opus-mt-id-en", id: "Xenova/opus-mt-en-id" };

let asr = null, device = "wasm";
const mt = {};
let queue = Promise.resolve();
const enqueue = (fn) => (queue = queue.then(fn, fn));

const progress = (label) => (p) => {
  if (p.status === "progress") self.postMessage({ type: "progress", label, file: p.file, loaded: p.loaded, total: p.total });
};

async function loadAsr() {
  const tryDevice = async (dev) => pipeline("automatic-speech-recognition", ASR_MODEL, {
    device: dev,
    // sesuai notebook: encoder fp32, decoder q8 (WebGPU pakai fp32 semua)
    dtype: dev === "webgpu" ? { encoder_model: "fp32", decoder_model_merged: "fp32" } : { encoder_model: "fp32", decoder_model_merged: "q8" },
    progress_callback: progress("Whisper UKM"),
  });
  if (self.navigator?.gpu) {
    try { asr = await tryDevice("webgpu"); device = "webgpu"; } catch (e) { console.warn("WebGPU gagal, fallback WASM", e); }
  }
  if (!asr) { asr = await tryDevice("wasm"); device = "wasm"; }
  // warm-up supaya partial pertama tidak lambat
  await asr(new Float32Array(16000), { language: "indonesian", task: "transcribe" });
}

// Model terjemahan di-download paralel (di luar antrean) supaya tidak menahan transkripsi live.
function getMt(target) {
  if (!mt[target]) {
    mt[target] = pipeline("translation", MT_MODELS[target], { dtype: "q8", progress_callback: progress(`Translator ${target.toUpperCase()}`) })
      .catch((e) => { delete mt[target]; throw e; });
  }
  return mt[target];
}

self.onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === "load") {
    enqueue(async () => {
      try { await loadAsr(); self.postMessage({ type: "ready", device }); }
      catch (e) { self.postMessage({ type: "error", message: String(e?.message || e) }); }
    });
  } else if (msg.type === "asr") {
    enqueue(async () => {
      const t0 = performance.now();
      try {
        const out = await asr(msg.audio, { language: "indonesian", task: "transcribe", max_new_tokens: 220 });
        self.postMessage({ type: "asr", id: msg.id, kind: msg.kind, text: (out.text || "").trim(), ms: performance.now() - t0 });
      } catch (e) {
        self.postMessage({ type: "asr", id: msg.id, kind: msg.kind, text: "", ms: 0, error: String(e) });
      }
    });
  } else if (msg.type === "translate") {
    const fail = (e) => self.postMessage({ type: "translation", id: msg.id, target: msg.target, text: null, error: String(e) });
    getMt(msg.target).then((tr) => enqueue(async () => {
      try {
        const out = await tr(msg.text, { max_new_tokens: 256 });
        self.postMessage({ type: "translation", id: msg.id, target: msg.target, text: out[0].translation_text });
      } catch (e) { fail(e); }
    }), fail);
  } else if (msg.type === "preloadMt") {
    getMt(msg.target).catch(() => {});
  }
};
