// Prompt Whisper (<|startofprev|> …) berisi kosakata rapat, supaya istilah seperti "Youth Today" / "risk mitigation"
// lebih tepat. (Kalimat sebelumnya sengaja TIDAK dipakai — di uji coba malah memperburuk hasil model fine-tuned ini.) Transformers.js v3 belum
// mengisi `prompt_ids` untuk Whisper, jadi token awal decoder disusun sendiri lalu model.generate dipanggil langsung.
import type { AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

/** Maks. token prompt (konteks decoder Whisper 448; sisakan untuk output). */
const MAX_PROMPT_TOKENS = 120;

export async function transcribe(
  asr: AutomaticSpeechRecognitionPipeline,
  audio: Float32Array,
  opts: { language: string; maxNewTokens: number; prompt: string },
): Promise<string> {
  if (!opts.prompt) {
    const out = (await asr(audio, { language: opts.language, task: "transcribe", max_new_tokens: opts.maxNewTokens } as any)) as { text: string };
    return out.text;
  }
  const p = asr as any;
  const id = (t: string) => {
    const v = p.tokenizer.model.tokens_to_ids.get(t);
    if (v == null) throw new Error(`token ${t} tidak ada`);
    return v as number;
  };
  const lang = id(`<|${opts.language === "indonesian" ? "id" : opts.language}|>`);
  const promptIds: number[] = p.tokenizer.encode(` ${opts.prompt}`, { add_special_tokens: false }).slice(-MAX_PROMPT_TOKENS);
  const init = [id("<|startofprev|>"), ...promptIds, id("<|startoftranscript|>"), lang, id("<|transcribe|>"), id("<|notimestamps|>")];

  const { input_features } = await p.processor(audio);
  const seq = await p.model.generate({ inputs: input_features, decoder_input_ids: init, max_new_tokens: opts.maxNewTokens });
  const ids: number[] = Array.from(seq.tolist()[0] as (number | bigint)[], Number).slice(init.length);
  return p.tokenizer.decode(ids, { skip_special_tokens: true });
}
