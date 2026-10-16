import { describe, expect, it } from "vitest";
import {
  blogPostSchema,
  categorySchema,
  intakeQuestionSchema,
  portfolioItemSchema,
  siteProfileSchema,
} from "@/lib/validation/schemas";
import { blogCategorySchema, blogTagHindiSchema, categoryFormSchema } from "@/lib/validation/content";
import { hasHindiText } from "@/components/content-admin/hindi-text";

const ID = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";

const baseCategory = {
  slug: "career-direction",
  title: "Career direction",
  shortDescription: "Choose a direction that fits your goals.",
  scope: "",
  formats: ["video"],
  durationMinutes: "60",
  intakeQuestions: [],
  resumeReviewEnabled: "",
  isActive: "on",
};

const baseProfile = {
  fullName: "Asha Example",
  headline: "Career consultant for students",
  shortBio: "Helps students plan their next career step.",
  socialLinks: [],
  credibilityPoints: [],
};

const basePost = { title: "Interview basics", slug: "interview-basics", content: "" };
const baseItem = { kind: "experience", title: "Career mentor", sortOrder: "0", isVisible: "on" };

const repeat = (n: number) => "अ".repeat(n);

describe("Hindi fields: blank input means no translation", () => {
  it("category: blank and whitespace Hindi become undefined (stored as null)", () => {
    const parsed = categorySchema.parse({ ...baseCategory, titleHi: "", shortDescriptionHi: "   ", scopeHi: undefined });
    expect(parsed.titleHi).toBeUndefined();
    expect(parsed.shortDescriptionHi).toBeUndefined();
    expect(parsed.scopeHi).toBeUndefined();
    expect(parsed.titleHi ?? null).toBeNull();
  });

  it("category: Hindi text is trimmed and kept", () => {
    const parsed = categoryFormSchema.parse({ ...baseCategory, titleHi: "  करियर दिशा  " });
    expect(parsed.titleHi).toBe("करियर दिशा");
  });

  it("intake question: label_hi is optional and dropped when blank", () => {
    const base = { id: "target_role", label: "Target role", type: "text", required: false };
    expect(intakeQuestionSchema.parse(base).label_hi).toBeUndefined();
    // Blank labels are dropped from the stored JSON entirely.
    expect(JSON.parse(JSON.stringify(intakeQuestionSchema.parse({ ...base, label_hi: "" })))).not.toHaveProperty("label_hi");
    expect(intakeQuestionSchema.parse({ ...base, label_hi: "  " }).label_hi).toBeUndefined();
    expect(intakeQuestionSchema.parse({ ...base, label_hi: "लक्ष्य भूमिका" }).label_hi).toBe("लक्ष्य भूमिका");
  });

  it("site profile: blank Hindi fields are undefined and Hindi points default to []", () => {
    const parsed = siteProfileSchema.parse({ ...baseProfile, headlineHi: "", locationHi: " " });
    expect(parsed.headlineHi).toBeUndefined();
    expect(parsed.locationHi).toBeUndefined();
    expect(parsed.shortBioHi).toBeUndefined();
    expect(parsed.credibilityPointsHi).toEqual([]);
  });

  it("site profile: Hindi credibility points use the same rules as English", () => {
    expect(siteProfileSchema.parse({ ...baseProfile, credibilityPointsHi: ["दस वर्ष का अनुभव"] }).credibilityPointsHi).toEqual([
      "दस वर्ष का अनुभव",
    ]);
    expect(siteProfileSchema.safeParse({ ...baseProfile, credibilityPointsHi: ["अ"] }).success).toBe(false);
    expect(siteProfileSchema.safeParse({ ...baseProfile, credibilityPointsHi: Array(9).fill("बिंदु") }).success).toBe(false);
  });

  it("blog post: blank Hindi fields are undefined", () => {
    const parsed = blogPostSchema.parse({
      ...basePost,
      titleHi: "",
      excerptHi: "",
      contentHi: "  \n ",
      seoTitleHi: "",
      seoDescriptionHi: "",
      coverImageAltHi: "",
    });
    for (const key of ["titleHi", "excerptHi", "contentHi", "seoTitleHi", "seoDescriptionHi", "coverImageAltHi"] as const) {
      expect(parsed[key]).toBeUndefined();
    }
  });

  it("portfolio item, blog category and tag: blank Hindi is undefined", () => {
    const item = portfolioItemSchema.parse({ ...baseItem, titleHi: "", subtitleHi: "", descriptionHi: "", periodHi: "" });
    expect([item.titleHi, item.subtitleHi, item.descriptionHi, item.periodHi]).toEqual([undefined, undefined, undefined, undefined]);
    expect(blogCategorySchema.parse({ name: "Interviews", nameHi: "" }).nameHi).toBeUndefined();
    expect(blogTagHindiSchema.parse({ id: ID, nameHi: " " }).nameHi).toBeUndefined();
    expect(blogTagHindiSchema.parse({ id: ID, nameHi: "साक्षात्कार" }).nameHi).toBe("साक्षात्कार");
  });

  it("existing English behaviour is unchanged when Hindi is omitted", () => {
    expect(categorySchema.safeParse(baseCategory).success).toBe(true);
    expect(siteProfileSchema.safeParse(baseProfile).success).toBe(true);
    expect(blogPostSchema.safeParse(basePost).success).toBe(true);
    expect(portfolioItemSchema.safeParse(baseItem).success).toBe(true);
    expect(blogPostSchema.safeParse({ ...basePost, title: "" }).success).toBe(false);
  });
});

describe("Hindi fields: length limits match the database", () => {
  const cases: [string, (v: string) => { success: boolean }, number][] = [
    ["category titleHi", (v) => categorySchema.safeParse({ ...baseCategory, titleHi: v }), 120],
    ["category shortDescriptionHi", (v) => categorySchema.safeParse({ ...baseCategory, shortDescriptionHi: v }), 400],
    ["category scopeHi", (v) => categorySchema.safeParse({ ...baseCategory, scopeHi: v }), 2000],
    [
      "intake label_hi",
      (v) => intakeQuestionSchema.safeParse({ id: "q", label: "Question", type: "text", required: true, label_hi: v }),
      300,
    ],
    ["profile headlineHi", (v) => siteProfileSchema.safeParse({ ...baseProfile, headlineHi: v }), 200],
    ["profile shortBioHi", (v) => siteProfileSchema.safeParse({ ...baseProfile, shortBioHi: v }), 600],
    ["profile longBioHi", (v) => siteProfileSchema.safeParse({ ...baseProfile, longBioHi: v }), 6000],
    ["profile approachHi", (v) => siteProfileSchema.safeParse({ ...baseProfile, approachHi: v }), 3000],
    ["profile locationHi", (v) => siteProfileSchema.safeParse({ ...baseProfile, locationHi: v }), 120],
    ["profile credibility point (Hindi)", (v) => siteProfileSchema.safeParse({ ...baseProfile, credibilityPointsHi: [v] }), 200],
    ["item titleHi", (v) => portfolioItemSchema.safeParse({ ...baseItem, titleHi: v }), 200],
    ["item subtitleHi", (v) => portfolioItemSchema.safeParse({ ...baseItem, subtitleHi: v }), 200],
    ["item descriptionHi", (v) => portfolioItemSchema.safeParse({ ...baseItem, descriptionHi: v }), 2000],
    ["item periodHi", (v) => portfolioItemSchema.safeParse({ ...baseItem, periodHi: v }), 80],
    ["post titleHi", (v) => blogPostSchema.safeParse({ ...basePost, titleHi: v }), 200],
    ["post excerptHi", (v) => blogPostSchema.safeParse({ ...basePost, excerptHi: v }), 500],
    ["post contentHi", (v) => blogPostSchema.safeParse({ ...basePost, contentHi: v }), 100_000],
    ["post seoTitleHi", (v) => blogPostSchema.safeParse({ ...basePost, seoTitleHi: v }), 70],
    ["post seoDescriptionHi", (v) => blogPostSchema.safeParse({ ...basePost, seoDescriptionHi: v }), 170],
    ["post coverImageAltHi", (v) => blogPostSchema.safeParse({ ...basePost, coverImageAltHi: v }), 200],
    ["blog category nameHi", (v) => blogCategorySchema.safeParse({ name: "Interviews", nameHi: v }), 80],
    ["blog tag nameHi", (v) => blogTagHindiSchema.safeParse({ id: ID, nameHi: v }), 60],
  ];

  it.each(cases)("%s accepts the maximum and rejects one more", (_name, parse, max) => {
    expect(parse(repeat(max)).success).toBe(true);
    expect(parse(repeat(max + 1)).success).toBe(false);
  });

  it("reports the Hindi field name in field errors", () => {
    const res = blogPostSchema.safeParse({ ...basePost, seoTitleHi: repeat(71) });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0].path).toEqual(["seoTitleHi"]);
  });
});

describe("hasHindiText", () => {
  it("ignores null, undefined and whitespace", () => {
    expect(hasHindiText(null, undefined, "  ")).toBe(false);
    expect(hasHindiText(null, "शीर्षक")).toBe(true);
  });
});
