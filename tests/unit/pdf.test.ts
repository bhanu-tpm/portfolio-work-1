import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderOutcomePdf } from "@/lib/pdf/outcome-pdf";
import { sniffKind } from "@/lib/storage";

describe("renderOutcomePdf", () => {
  it("produces a multi-page PDF and tolerates unsupported characters", async () => {
    const long = Array.from({ length: 120 }, (_, i) => `- Step ${i + 1}: **practise** a skill for ₹0 💡`).join("\n");
    const bytes = await renderOutcomePdf(
      {
        overview: "We discussed your options.",
        goalsAndChallenges: "",
        discussionPoints: "A very-long-token-" + "x".repeat(300),
        recommendations: "Consider a short course.",
        skillsAndResources: "",
        actionPlan: long,
        milestones: "Review in 4 weeks.",
        followUp: "",
      },
      {
        title: "Career plan",
        clientName: "Test Client",
        consultantName: "Consultant",
        referenceCode: "CR-3001-ABCDEF",
        dateLabel: "1 Jan 2030",
        siteName: "Career Consultation",
      },
    );
    expect(sniffKind(bytes)).toBe("pdf");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(doc.getTitle()).toBe("Career plan");
  });
});

describe("sniffKind", () => {
  it("detects file types from magic bytes", () => {
    expect(sniffKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    expect(sniffKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(sniffKind(new TextEncoder().encode("<html>"))).toBeNull();
  });
});
