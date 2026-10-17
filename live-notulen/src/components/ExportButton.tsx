import { displayText, speakerLabel, useStore } from "../store";
import { download, fmtTime, slug } from "../lib/format";

const MODE_LABEL = { asli: "Asli (campur)", en: "Full English", id: "Full Indonesia" };

export default function ExportButton() {
  const state = useStore();
  const { segments, title, meetingAt, speakerNames, mode, recordingUrl } = state;
  const date = new Date(meetingAt).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" });
  const speakers = [...new Set(segments.map((s) => speakerLabel(speakerNames, s.speaker)))];
  const rows = segments.map((s) => ({ t: fmtTime(s.start), who: speakerLabel(speakerNames, s.speaker), text: displayText(state, s).text }));

  const txt = () =>
    download(`${slug(title)}.txt`, [`${title}`, `Tanggal: ${date}`, `Mode: ${MODE_LABEL[mode]}`, "", ...rows.map((r) => `[${r.t}] ${r.who}: ${r.text}`)].join("\n"));
  const md = () =>
    download(
      `${slug(title)}.md`,
      [`# ${title}`, "", `- **Tanggal:** ${date}`, `- **Peserta terdeteksi:** ${speakers.join(", ") || "-"}`, `- **Mode:** ${MODE_LABEL[mode]}`, "", "## Transkrip", "",
        ...rows.map((r) => `- \`${r.t}\` **${r.who}:** ${r.text}`)].join("\n"),
      "text/markdown;charset=utf-8",
    );
  // library docx (±400 kB) baru dimuat saat diklik
  const docx = async () => {
    const { buildDocx } = await import("../lib/docx");
    download(`${slug(title)}.docx`, await buildDocx({ title, date, speakers, mode: MODE_LABEL[mode], rows }),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  };

  const btn = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className={btn} onClick={docx} disabled={!segments.length}>Unduh .docx</button>
      <button className={btn} onClick={txt} disabled={!segments.length}>Export .txt</button>
      <button className={btn} onClick={md} disabled={!segments.length}>Export .md</button>
      {recordingUrl && <a className={btn} href={recordingUrl} download={`${slug(title)}.webm`}>Unduh rekaman</a>}
    </div>
  );
}
