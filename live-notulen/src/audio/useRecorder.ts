// Start/stop capture: tab/layar meeting (getDisplayMedia) dan/atau mic (getUserMedia) → AudioContext 16 kHz
// → AudioWorklet → chunk 0,5 s diteruskan ke ASR worker. Rekaman layar disimpan lokal untuk diunduh.
import { useCallback, useRef } from "react";
import workletUrl from "./recorder.worklet.ts?worker&url";
import { SR } from "../config";
import { asrWorker } from "../lib/engine";
import { useStore } from "../store";

export type Source = "tab+mic" | "tab" | "mic";

const notice = (n: string) => useStore.getState().setNotice(n);

export function useRecorder() {
  const ref = useRef<{ ctx: AudioContext; streams: MediaStream[]; rec?: MediaRecorder } | null>(null);

  const stop = useCallback(() => {
    const cur = ref.current;
    if (!cur) return;
    ref.current = null;
    asrWorker.postMessage({ type: "flush" }); // finalkan segmen yang masih berjalan
    if (cur.rec && cur.rec.state !== "inactive") cur.rec.stop();
    cur.streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    cur.ctx.close();
    useStore.getState().setRecording(false);
  }, []);

  const start = useCallback(async (source: Source) => {
    if (ref.current) return;
    const streams: MediaStream[] = [];
    let missingTabAudio = false;
    try {
      if (source !== "mic") {
        const d = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          // @ts-expect-error opsi Chrome (belum ada di lib.dom)
          systemAudio: "include",
          selfBrowserSurface: "exclude",
        });
        if (!d.getAudioTracks().length) {
          if (source === "tab") {
            d.getTracks().forEach((t) => t.stop());
            throw new Error('Audio tidak ikut ter-share. Pilih tab meeting (Meet/Zoom web/Teams) lalu centang "Share tab audio".');
          }
          // tab+mic tanpa audio layar → tetap jalan pakai mic saja (layar tetap direkam)
          missingTabAudio = true;
        }
        streams.push(d);
      }
      if (source !== "tab") {
        streams.push(await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } }));
      }
    } catch (e) {
      const askedMic = source === "mic" || streams.length > 0; // dialog share sudah lewat → yang ditolak izin mic
      streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      const err = e as Error;
      if (err.name === "NotAllowedError") {
        if (askedMic) notice("Izin mikrofon ditolak. Izinkan mikrofon lewat ikon gembok di address bar, lalu coba lagi.");
      } else if (err.name === "NotFoundError") notice("Mikrofon tidak ditemukan. Sambungkan mikrofon atau pilih sumber “Layar/tab meeting saja”.");
      else notice(err.message);
      return;
    }

    // Browser me-resample 48 kHz → 16 kHz; worklet tetap bisa resample sendiri kalau context bukan 16 kHz.
    let ctx: AudioContext;
    try { ctx = new AudioContext({ sampleRate: SR }); } catch { ctx = new AudioContext(); }
    try {
      await ctx.audioWorklet.addModule(workletUrl);
    } catch (e) {
      streams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      ctx.close();
      notice(`Gagal menyiapkan pemrosesan audio: ${(e as Error).message}`);
      return;
    }
    const node = new AudioWorkletNode(ctx, "recorder", { numberOfOutputs: 0 });
    const mix = ctx.createMediaStreamDestination();
    // stream layar tanpa audio (hanya video) tidak bisa jadi MediaStreamSource → lewati
    for (const s of streams.filter((x) => x.getAudioTracks().length)) {
      const src = ctx.createMediaStreamSource(s);
      src.connect(node);
      src.connect(mix);
    }
    node.port.onmessage = (e: MessageEvent<Float32Array>) => asrWorker.postMessage({ type: "chunk", data: e.data }, [e.data.buffer]);

    // Rekaman (layar + audio campuran) — tetap di browser, bisa diunduh setelah stop
    const video = streams.flatMap((s) => s.getVideoTracks());
    let rec: MediaRecorder | undefined;
    try {
      rec = new MediaRecorder(new MediaStream([...video, ...mix.stream.getAudioTracks()]), { mimeType: video.length ? "video/webm" : "audio/webm" });
      const parts: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
      rec.onstop = () => useStore.getState().setRecordingUrl(URL.createObjectURL(new Blob(parts, { type: rec!.mimeType })));
      rec.start(1000);
    } catch (e) {
      console.warn("MediaRecorder tidak tersedia", e);
    }

    video[0]?.addEventListener("ended", stop); // user klik "Stop sharing" di bar Chrome
    ref.current = { ctx, streams, rec };
    asrWorker.postMessage({ type: "start" });
    useStore.getState().setNotice(missingTabAudio ? 'Audio layar tidak ikut ter-share — sekarang hanya suara mic yang ditranskrip. Untuk menangkap suara meeting, pilih tab meeting dan centang "Share tab audio".' : null);
    useStore.getState().setRecording(true);
  }, [stop]);

  return { start, stop };
}
