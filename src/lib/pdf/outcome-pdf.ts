import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { OUTCOME_SECTIONS, type OutcomeContent } from "@/lib/db/types";

const NAVY = rgb(0.11, 0.17, 0.27);
const TEAL = rgb(0.24, 0.5, 0.51);
const GRAY = rgb(0.4, 0.43, 0.48);

const PAGE = { width: 595.28, height: 841.89 }; // A4
const MARGIN = 56;

interface Meta {
  title: string;
  clientName: string;
  consultantName: string;
  referenceCode: string;
  dateLabel: string;
  siteName: string;
}

/** Strips light Markdown so the PDF reads cleanly with standard fonts. */
function markdownToLines(markdown: string): { text: string; bullet: boolean }[] {
  return markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((raw) => raw.trimEnd())
    .map((line) => {
      const bulletMatch = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
      const text = (bulletMatch ? bulletMatch[1] : line)
        .replace(/^#{1,6}\s+/, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/__(.+?)__/g, "$1")
        .replace(/(^|\W)[*_](.+?)[*_](?=\W|$)/g, "$1$2")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
      return { text, bullet: Boolean(bulletMatch) };
    });
}

export async function renderOutcomePdf(content: OutcomeContent, meta: Meta): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(meta.title);
  doc.setAuthor(meta.consultantName);
  doc.setCreator(meta.siteName);
  doc.setProducer(meta.siteName);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Standard fonts only support WinAnsi; replace anything else.
  const encodable = new Map<string, boolean>();
  const sanitize = (font: PDFFont, text: string) =>
    [...text]
      .map((ch) => {
        const key = `${font.name}:${ch}`;
        if (!encodable.has(key)) {
          try {
            font.encodeText(ch);
            encodable.set(key, true);
          } catch {
            encodable.set(key, false);
          }
        }
        return encodable.get(key) ? ch : ch === "₹" ? "Rs." : "?";
      })
      .join("");

  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;
  const maxWidth = PAGE.width - MARGIN * 2;

  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;
  };

  const wrap = (text: string, font: PDFFont, size: number, width: number) => {
    const words = sanitize(font, text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        // Hard-break very long tokens (e.g. URLs).
        let rest = word;
        while (font.widthOfTextAtSize(rest, size) > width) {
          let cut = rest.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        current = rest;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const write = (text: string, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; indent?: number; gap?: number }) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10.5;
    const indent = opts.indent ?? 0;
    const lineHeight = size * 1.45;
    for (const line of wrap(text, font, size, maxWidth - indent)) {
      if (y - lineHeight < MARGIN) newPage();
      page.drawText(line, { x: MARGIN + indent, y: y - size, size, font, color: opts.color ?? NAVY });
      y -= lineHeight;
    }
    y -= opts.gap ?? 0;
  };

  // Header
  write(meta.siteName.toUpperCase(), { font: bold, size: 9, color: TEAL, gap: 6 });
  write(meta.title, { font: bold, size: 20, gap: 4 });
  write(`Prepared for ${meta.clientName} by ${meta.consultantName}`, { size: 10.5, color: GRAY });
  write(`Reference ${meta.referenceCode}  ·  ${meta.dateLabel}`, { size: 10.5, color: GRAY, gap: 14 });
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE.width - MARGIN, y },
    thickness: 0.6,
    color: rgb(0.85, 0.87, 0.9),
  });
  y -= 18;

  for (const section of OUTCOME_SECTIONS) {
    const body = content[section.key]?.trim();
    if (!body) continue;
    if (y < MARGIN + 80) newPage();
    write(section.title, { font: bold, size: 13, gap: 4 });
    for (const line of markdownToLines(body)) {
      if (!line.text.trim()) {
        y -= 5;
        continue;
      }
      if (line.bullet) {
        if (y - 15 < MARGIN) newPage();
        page.drawText("•", { x: MARGIN + 4, y: y - 10.5, size: 10.5, font: regular, color: TEAL });
        write(line.text, { indent: 16, gap: 1 });
      } else {
        write(line.text, { gap: 2 });
      }
    }
    y -= 12;
  }

  // Footer on every page
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const footer = sanitize(regular, `${meta.referenceCode} · Page ${i + 1} of ${pages.length} · Confidential`);
    p.drawText(footer, { x: MARGIN, y: MARGIN / 2, size: 8, font: regular, color: GRAY });
  });

  return doc.save();
}
