// AudioWorklet (thread audio terpisah): mixdown mono, resample ke 16 kHz kalau perlu,
// lalu kirim Float32Array per 0,5 s (8000 sampel) ke main thread.
declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor { readonly port: MessagePort; }

const TARGET_SR = 16000;
const CHUNK = TARGET_SR / 2;

class RecorderProcessor extends AudioWorkletProcessor {
  private buf = new Float32Array(CHUNK);
  private n = 0;
  private ratio = sampleRate / TARGET_SR; // 1 kalau AudioContext sudah 16 kHz
  private pos = 0; // posisi baca fraksional (resampling linear)
  private prev = 0;

  process(inputs: Float32Array[][]) {
    const ch = inputs[0];
    if (!ch || !ch.length) return true;
    const len = ch[0].length;
    const mono = new Float32Array(len);
    for (const c of ch) for (let i = 0; i < len; i++) mono[i] += c[i] / ch.length;

    if (this.ratio === 1) {
      for (let i = 0; i < len; i++) this.push(mono[i]);
    } else {
      // interpolasi linear antar sampel (prev = sampel terakhir blok sebelumnya)
      while (this.pos < len) {
        const i = Math.floor(this.pos), f = this.pos - i;
        const a = i === 0 ? this.prev : mono[i - 1], b = mono[i];
        this.push(a + (b - a) * f);
        this.pos += this.ratio;
      }
      this.pos -= len;
      this.prev = mono[len - 1];
    }
    return true;
  }

  private push(v: number) {
    this.buf[this.n++] = v;
    if (this.n === CHUNK) {
      this.port.postMessage(this.buf, [this.buf.buffer]);
      this.buf = new Float32Array(CHUNK);
      this.n = 0;
    }
  }
}

registerProcessor("recorder", RecorderProcessor);
