// Semua angka dari eksperimen Colab (UKM_Live_Notulen_ASR.ipynb) — jangan diubah tanpa alasan.
export const SR = 16000;
export const HF_REPO = "Jennigwen/whisper-base-ukm-codeswitch";
export const LANGUAGE = "indonesian";
export const MFCC = { nMfcc: 13, frameMs: 25, hopMs: 10, nFft: 512, nMels: 26, preEmph: 0.97, lifter: 22 };
export const STREAM = { chunkSec: 0.5, updateSec: 1.0, silenceSec: 0.6, maxSegSec: 15 };
export const VAD = { marginC0: 3.0, speechFrac: 0.3 };
// method "distance" (default, lihat dsp/speaker.ts) atau "cosine" (persis notebook, threshold 0.6)
export const SPEAKER = { method: "distance" as "distance" | "cosine", maxDistance: 0.55, threshold: 0.6 };
export const MT_MODELS = { en: "Xenova/opus-mt-id-en", id: "Xenova/opus-mt-en-id" } as const;
