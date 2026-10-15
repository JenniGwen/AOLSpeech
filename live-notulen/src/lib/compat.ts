// Deteksi kemampuan browser. Share audio tab (getDisplayMedia + audio) hanya didukung Chrome/Edge desktop;
// Firefox & Safari bisa share layar tapi tanpa audio tab → opsi itu disembunyikan.
const ua = navigator.userAgent;
const isFirefox = /Firefox|FxiOS/i.test(ua);
const isSafari = /^((?!chrome|chromium|android|crios|edg).)*safari/i.test(ua);
const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

export const compat = {
  secure: window.isSecureContext,
  mic: !!navigator.mediaDevices?.getUserMedia,
  tabAudio: !!navigator.mediaDevices?.getDisplayMedia && !isFirefox && !isSafari && !isMobile,
  worklet: typeof AudioWorkletNode !== "undefined",
};

/** Masalah yang membuat rekam live tidak bisa jalan sama sekali (upload file tetap bisa). */
export function liveBlocker(): string | null {
  if (!compat.secure) return "Halaman harus dibuka lewat HTTPS (atau localhost) supaya mikrofon bisa dipakai.";
  if (!compat.mic || !compat.worklet) return "Browser ini tidak mendukung perekaman audio (getUserMedia/AudioWorklet). Pakai Chrome atau Edge terbaru.";
  return null;
}
