// Semua angka dari eksperimen Colab (UKM_Live_Notulen_ASR.ipynb) — jangan diubah tanpa alasan.
export const SR = 16000;
export const HF_REPO = "Jennigwen/whisper-base-ukm-codeswitch";
export const LANGUAGE = "indonesian";
export const MFCC = { nMfcc: 13, frameMs: 25, hopMs: 10, nFft: 512, nMels: 26, preEmph: 0.97, lifter: 22 };
// silenceSec 0.6 → 1.5: dengan chunk 0,5 s, nilai 0.6 berarti segmen dipotong setelah 1,0 s hening — jeda mikir di
// tengah frasa ("event | Youth today") memecah kalimat & Whisper kehilangan konteks. 1.5 = 3 chunk hening.
export const STREAM = { chunkSec: 0.5, updateSec: 1.0, silenceSec: 1.5, maxSegSec: 15 };
export const VAD = { marginC0: 3.0, speechFrac: 0.3 };
// method "distance" (default, lihat dsp/speaker.ts) atau "cosine" (persis notebook, threshold 0.6)
export const SPEAKER = { method: "distance" as "distance" | "cosine", maxDistance: 0.55, threshold: 0.6 };
// Pitch (median F0, semiton): beda ≥ speakerSemitones = pasti speaker lain; di atas `tolerance` ikut menambah jarak
// (perSemitone/semiton). turnSemitones/turnChunks: potong segmen saat pitch melompat & bertahan ≥ 1,5 s tanpa jeda
// (giliran bicara cepat). Intonasi satu kalimat bisa turun ±4–5 semiton → ambang di atas itu.
// Uji TTS 14 skenario (cewek/cowok, 1 suara nada rendah/tinggi ±5–6 st, dengan/tanpa jeda): 13 benar.
export const PITCH = { tolerance: 2, perSemitone: 0.17, speakerSemitones: 6, turnSemitones: 5.5, turnChunks: 3 };
export const MT_MODELS = { en: "Xenova/opus-mt-id-en", id: "Xenova/opus-mt-en-id" } as const;
