import { displayText, speakerLabel, useStore } from "../store";
import { download, fmtTime, slug } from "../lib/format";

const MODE_LABEL = { asli: "Asli (campur)", en: "Full English", id: "Full Indonesia" };

export default function ExportButton() {
  const state = useStore();
  const { segments, title, createdAt, speakerNames, mode, recordingUrl } = state;
  const date = new Date(createdAt).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" });
  const rows = segments.map((s) => ({ t: fmtTime(s.start), who: speakerLabel(speakerNames, s.speaker), text: displayText(state, s).text }));

  const txt = () =>
    download(`${slug(title)}.txt`, [`${title}`, `Tanggal: ${date}`, `Mode: ${MODE_LABEL[mode]}`, "", ...rows.map((r) => `[${r.t}] ${r.who}: ${r.text}`)].join("\n"));
  const md = () => {
    const speakers = [...new Set(segments.map((s) => speakerLabel(speakerNames, s.speaker)))];
    download(
      `${slug(title)}.md`,
      [`# ${title}`, "", `- **Tanggal:** ${date}`, `- **Peserta terdeteksi:** ${speakers.join(", ") || "-"}`, `- **Mode:** ${MODE_LABEL[mode]}`, "", "## Transkrip", "",
        ...rows.map((r) => `- \`${r.t}\` **${r.who}:** ${r.text}`)].join("\n"),
      "text/markdown;charset=utf-8",
    );
  };

  const btn = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={btn} onClick={txt} disabled={!segments.length}>Export .txt</button>
      <button className={btn} onClick={md} disabled={!segments.length}>Export .md</button>
      {recordingUrl && <a className={btn} href={recordingUrl} download={`${slug(title)}.webm`}>Unduh rekaman</a>}
    </div>
  );
}
