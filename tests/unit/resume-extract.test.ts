import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractPdfText } from "@/lib/ai/resume-service";
import { checkResumeText } from "@/lib/ai/student-helpers";

async function makePdf(lines: string[]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([595, 842]);
  lines.forEach((line, i) => page.drawText(line, { x: 40, y: 800 - i * 16, size: 11, font }));
  return doc.save();
}

describe("extractPdfText", () => {
  it("extracts text from a text-based PDF", async () => {
    const lines = [
      "Sample Candidate - Junior Data Analyst",
      "Skills: SQL, Excel, Python, data visualisation, survey analysis and reporting",
      "Experience: Analytics intern at Example Corp, built weekly sales dashboards",
      "Education: BSc Statistics, Example University, 2025",
      "Projects: demand forecasting coursework; led the college data club workshops",
    ];
    const text = await extractPdfText(await makePdf(lines));
    expect(text).toContain("Junior Data Analyst");
    expect(checkResumeText(text, "pdf").ok).toBe(true);
  });

  it("flags a PDF without text (e.g. scanned) as too little text", async () => {
    const text = await extractPdfText(await makePdf([]));
    expect(checkResumeText(text, "pdf").ok).toBe(false);
  });

  it("rejects bytes that are not a readable PDF", async () => {
    await expect(extractPdfText(new TextEncoder().encode("%PDF-1.7 broken"))).rejects.toThrow(/couldn't read/i);
  });
});
