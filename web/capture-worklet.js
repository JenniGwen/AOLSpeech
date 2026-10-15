// Kirim sampel mono (AudioContext sudah 16 kHz) ke main thread per ~0.5 detik.
class Capture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(8000); this.n = 0; }
  process(inputs) {
    const ch = inputs[0];
    if (ch && ch.length) {
      const L = ch[0], R = ch[1];
      for (let i = 0; i < L.length; i++) {
        this.buf[this.n++] = R ? (L[i] + R[i]) / 2 : L[i];
        if (this.n === this.buf.length) { this.port.postMessage(this.buf); this.buf = new Float32Array(8000); this.n = 0; }
      }
    }
    return true;
  }
}
registerProcessor("capture", Capture);
