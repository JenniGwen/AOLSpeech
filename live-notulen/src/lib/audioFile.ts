// Transkrip file audio/video yang diunggah: decode → 16 kHz mono → pipeline streaming yang sama di ASR worker.
import { SR } from "../config";
import { useStore } from "../store";
import { asrWorker, newMeeting } from "./engine";

/** Decode file apa pun yang didukung browser (mp3, wav, m4a, webm, mp4, …) ke Float32Array 16 kHz mono. */
async function decodeTo16k(file: File): Promise<Float32Array> {
  // decodeAudioData me-resample otomatis ke sampleRate context (16 kHz)
  const buf = await new OfflineAudioContext(1, 1, SR).decodeAudioData(await file.arrayBuffer());
  if (buf.numberOfChannels === 1) return buf.getChannelData(0).slice(); // salin: buffer AudioBuffer tidak boleh di-transfer
  const out = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += ch[i] / buf.numberOfChannels;
  }
  return out;
}

export async function transcribeFile(file: File) {
  const S = useStore;
  S.setState({ file: { name: file.name, done: 0, total: 0 }, notice: null });
  let audio: Float32Array;
  try {
    audio = await decodeTo16k(file);
  } catch (e) {
    console.error(e);
    S.setState({ file: null, notice: `File "${file.name}" tidak bisa dibaca sebagai audio. Coba format lain (mp3, wav, m4a, webm).` });
    return;
  }
  if (audio.length < SR / 2) {
    S.setState({ file: null, notice: `File "${file.name}" terlalu pendek atau tidak berisi audio.` });
    return;
  }
  newMeeting(file.name.replace(/\.[^.]+$/, ""));
  S.setState({ file: { name: file.name, done: 0, total: audio.length / SR }, status: "processing", log: [] });
  asrWorker.postMessage({ type: "file", data: audio }, [audio.buffer]);
}

export const cancelFile = () => asrWorker.postMessage({ type: "cancel" });
