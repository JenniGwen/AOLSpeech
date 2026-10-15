/// <reference lib="webworker" />
// MT worker: opus-mt id↔en (WASM q8), hanya untuk segmen FINAL. Hasil di-cache per `${mode}:${segmentId}`.
// Port dari translate.js — Whisper tetap selalu mengeluarkan transkrip asli.
import { pipeline, type TranslationPipeline } from "@huggingface/transformers";
import { MT_MODELS } from "../config";

type Mode = keyof typeof MT_MODELS;
const post = (m: unknown) => (self as unknown as Worker).postMessage(m);

const translators: Partial<Record<Mode, Promise<TranslationPipeline>>> = {};
const cache = new Map<string, string>(); // `${mode}:${teks}` → terjemahan (teks bisa berubah setelah diedit)

function getTranslator(mode: Mode) {
  if (!translators[mode]) {
    translators[mode] = ((pipeline as any)("translation", MT_MODELS[mode], {
      device: "wasm", // Whisper sudah memakai WebGPU; MT kecil cukup di WASM
      dtype: "q8",
      progress_callback: (p: any) => p.status === "progress" && post({ type: "progress", mode, file: p.file, loaded: p.loaded, total: p.total }),
    }) as Promise<TranslationPipeline>).then(
      (t) => (post({ type: "ready", mode }), t),
      (e) => { delete translators[mode]; throw e; },
    );
  }
  return translators[mode]!;
}

// Antrean berurutan supaya terjemahan tidak berebut CPU
let queue: Promise<unknown> = Promise.resolve();

self.onmessage = (e: MessageEvent) => {
  const m = e.data as { type: string; mode: Mode; session?: string; id?: number; text?: string };
  if (m.type === "preload") {
    getTranslator(m.mode).catch((err) => post({ type: "error", mode: m.mode, message: String(err) }));
    return;
  }
  if (m.type !== "translate") return;
  const key = `${m.mode}:${m.text}`;
  const reply = { type: "translation", mode: m.mode, session: m.session, id: m.id, source: m.text };
  queue = queue.then(async () => {
    if (!cache.has(key)) {
      const t0 = performance.now();
      try {
        const tr = await getTranslator(m.mode);
        const [out] = (await tr(m.text!, { max_new_tokens: 256, num_beams: 1 } as any)) as { translation_text: string }[];
        cache.set(key, out.translation_text);
        post({ ...reply, text: out.translation_text, latencyMs: performance.now() - t0 });
        return;
      } catch (err) {
        post({ ...reply, text: null, error: String(err) });
        return;
      }
    }
    post({ ...reply, text: cache.get(key), latencyMs: 0 });
  });
};
