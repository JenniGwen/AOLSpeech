// Notulen → dokumen Word (.docx), bisa dibuka di Word / Google Docs.
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

interface Notulen {
  title: string;
  date: string;
  speakers: string[];
  mode: string;
  rows: { t: string; who: string; text: string }[];
}

const meta = (label: string, value: string) => new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value)] });

export function buildDocx(n: Notulen): Promise<Blob> {
  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{
      children: [
        new Paragraph({ text: n.title, heading: HeadingLevel.TITLE }),
        meta("Tanggal", n.date),
        meta("Peserta terdeteksi", n.speakers.join(", ") || "-"),
        meta("Mode", n.mode),
        new Paragraph({ text: "Transkrip", heading: HeadingLevel.HEADING_1, spacing: { before: 240 } }),
        ...n.rows.map((r) => new Paragraph({
          spacing: { after: 120 },
          children: [
            new TextRun({ text: `[${r.t}] `, color: "888888" }),
            new TextRun({ text: `${r.who}: `, bold: true }),
            new TextRun(r.text),
          ],
        })),
      ],
    }],
  });
  return Packer.toBlob(doc);
}
