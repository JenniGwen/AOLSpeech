import { useEffect, useRef, useState } from "react";
import { displayText, speakerLabel, useStore } from "../store";
import { download, fmtTime, slug } from "../lib/format";
import { fmtRange, participants } from "../lib/sessions";
import Icon from "../ui/Icon";

const MODE_LABEL = { asli: "Asli (campur)", en: "Full English", id: "Full Indonesia" };

export default function ExportButton() {
  const state = useStore();
  const { segments, title, meetingAt, meetingEndAt, speakerNames, mode, recordingUrl, agenda, tasks } = state;
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const date = `${new Date(meetingAt).toLocaleDateString("id-ID", { dateStyle: "full" })}, ${fmtRange(meetingAt, meetingEndAt)} WIB`;
  const speakers = participants({ segments, speakerNames });
  const rows = segments.map((s) => ({ t: fmtTime(s.start), who: speakerLabel(speakerNames, s.speaker), text: displayText(state, s).text }));
  const agendaRows = agenda.map((a) => `${a.done ? "[x]" : "[ ]"} ${a.text}`);
  const taskRows = tasks.map((t) => `${t.done ? "[x]" : "[ ]"} ${t.text}${t.who ? ` — PIC: ${t.who}` : ""}${t.due ? ` (tenggat ${t.due})` : ""}`);
  const empty = !segments.length && !agenda.length && !tasks.length;

  const txt = () =>
    download(`${slug(title)}.txt`, [
      `${title}`, `Tanggal: ${date}`, `Mode: ${MODE_LABEL[mode]}`,
      ...(agendaRows.length ? ["", "Agenda:", ...agendaRows] : []),
      ...(taskRows.length ? ["", "Tindak lanjut:", ...taskRows] : []),
      "", "Transkrip:", ...rows.map((r) => `[${r.t}] ${r.who}: ${r.text}`),
    ].join("\n"));
  const md = () =>
    download(
      `${slug(title)}.md`,
      [`# ${title}`, "", `- **Tanggal:** ${date}`, `- **Peserta terdeteksi:** ${speakers.join(", ") || "-"}`, `- **Mode:** ${MODE_LABEL[mode]}`,
        ...(agendaRows.length ? ["", "## Agenda", "", ...agendaRows.map((r) => `- ${r}`)] : []),
        ...(taskRows.length ? ["", "## Tindak lanjut", "", ...taskRows.map((r) => `- ${r}`)] : []),
        "", "## Transkrip", "", ...rows.map((r) => `- \`${r.t}\` **${r.who}:** ${r.text}`)].join("\n"),
      "text/markdown;charset=utf-8",
    );
  // library docx (±400 kB) baru dimuat saat diklik
  const docx = async () => {
    const { buildDocx } = await import("../lib/docx");
    download(`${slug(title)}.docx`, await buildDocx({ title, date, speakers, mode: MODE_LABEL[mode], agenda: agendaRows, tasks: taskRows, rows }),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  };

  const item = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink hover:bg-slate-50";
  const run = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div ref={box} className="relative">
      <button className="btn h-11" onClick={() => setOpen((o) => !o)} disabled={empty && !recordingUrl} aria-expanded={open}>
        <Icon name="download" className="h-[18px] w-[18px]" /> Ekspor
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          <button className={item} onClick={run(docx)} disabled={empty}>Dokumen Word (.docx)</button>
          <button className={item} onClick={run(md)} disabled={empty}>Markdown (.md)</button>
          <button className={item} onClick={run(txt)} disabled={empty}>Teks (.txt)</button>
          {recordingUrl && <a className={item} href={recordingUrl} download={`${slug(title)}.webm`} onClick={() => setOpen(false)}>Rekaman (.webm)</a>}
        </div>
      )}
    </div>
  );
}
