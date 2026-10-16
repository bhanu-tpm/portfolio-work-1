import { describe, expect, it } from "vitest";
import {
  categoryFormSchema,
  countWords,
  moveInOrder,
  pageCount,
  pageRange,
  parseJsonField,
  parseTagList,
  postIntentSchema,
  publicObjectPath,
  questionIdFromLabel,
  readingMinutes,
  sanitizeSearch,
} from "@/lib/validation/content";

describe("readingMinutes", () => {
  it("is at least one minute", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("A short note.")).toBe(1);
  });
  it("uses ~200 words per minute", () => {
    expect(readingMinutes(Array(200).fill("word").join(" "))).toBe(1);
    expect(readingMinutes(Array(201).fill("word").join(" "))).toBe(2);
    expect(readingMinutes(Array(1000).fill("word").join(" "))).toBe(5);
  });
  it("ignores markdown syntax and link urls", () => {
    expect(countWords("## Heading\n\n- [Read more](https://example.com/a/b/c) ![alt](https://x.y/z.png)")).toBe(3);
    expect(countWords("career-ready students")).toBe(2);
  });
});

describe("parseTagList", () => {
  it("trims, slugifies and de-duplicates", () => {
    expect(parseTagList(" Career , CV tips,career,, ")).toEqual([
      { name: "Career", slug: "career" },
      { name: "CV tips", slug: "cv-tips" },
    ]);
  });
  it("handles empty input and caps the count", () => {
    expect(parseTagList(undefined)).toEqual([]);
    expect(parseTagList("!!!,  ")).toEqual([]);
    expect(parseTagList(Array.from({ length: 15 }, (_, i) => `tag${i}`).join(","))).toHaveLength(10);
  });
});

describe("pagination helpers", () => {
  it("parses page params defensively", () => {
    expect(pageRange(undefined)).toMatchObject({ page: 1, from: 0, to: 19 });
    expect(pageRange("3")).toMatchObject({ page: 3, from: 40, to: 59 });
    expect(pageRange("-2").page).toBe(1);
    expect(pageRange("abc").page).toBe(1);
    expect(pageRange(["2", "5"]).page).toBe(2);
  });
  it("computes page counts", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(20)).toBe(1);
    expect(pageCount(21)).toBe(2);
    expect(pageCount(null)).toBe(1);
  });
});

describe("sanitizeSearch", () => {
  it("strips PostgREST/LIKE metacharacters", () => {
    expect(sanitizeSearch("50%_off,(now)")).toBe("50 off now");
    expect(sanitizeSearch("  hello   world ")).toBe("hello world");
    expect(sanitizeSearch(undefined)).toBe("");
  });
});

describe("moveInOrder", () => {
  it("swaps with the neighbour", () => {
    expect(moveInOrder(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveInOrder(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
  });
  it("returns null at the edges or for unknown ids", () => {
    expect(moveInOrder(["a", "b"], "a", "up")).toBeNull();
    expect(moveInOrder(["a", "b"], "b", "down")).toBeNull();
    expect(moveInOrder(["a", "b"], "x", "up")).toBeNull();
  });
});

describe("misc helpers", () => {
  it("suggests question ids from labels", () => {
    expect(questionIdFromLabel("Target role / industry?")).toBe("target_role_industry");
  });
  it("parses JSON hidden fields safely", () => {
    expect(parseJsonField('[{"a":1}]')).toEqual([{ a: 1 }]);
    expect(parseJsonField("{oops")).toEqual([]);
    expect(parseJsonField(undefined, null)).toBeNull();
  });
  it("maps public URLs back to object paths only for our bucket", () => {
    const prefix = "https://demo.supabase.co/storage/v1/object/public/public-media/";
    expect(publicObjectPath(`${prefix}user/blog/abc.png`, prefix)).toBe("user/blog/abc.png");
    expect(publicObjectPath(`${prefix}user/blog/abc.png?v=1`, prefix.slice(0, -1))).toBe("user/blog/abc.png");
    expect(publicObjectPath("https://images.example.com/a.png", prefix)).toBeNull();
    expect(publicObjectPath(`${prefix}../secret`, prefix)).toBeNull();
    expect(publicObjectPath(null, prefix)).toBeNull();
  });
  it("falls back to 'save' for unknown post intents", () => {
    expect(postIntentSchema.parse("publish")).toBe("publish");
    expect(postIntentSchema.parse("hack")).toBe("save");
    expect(postIntentSchema.parse(undefined)).toBe("save");
  });
});

describe("categoryFormSchema", () => {
  const base = {
    slug: "career-clarity",
    title: "Career clarity",
    shortDescription: "Find a direction that fits you.",
    scope: "",
    formats: ["video"],
    durationMinutes: "60",
    intakeQuestions: [],
    resumeReviewEnabled: "on",
    isActive: "",
  };
  it("accepts a valid category", () => {
    const r = categoryFormSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.durationMinutes).toBe(60);
      expect(r.data.resumeReviewEnabled).toBe(true);
      expect(r.data.isActive).toBe(false);
    }
  });
  it("rejects unknown formats and duplicate question ids", () => {
    expect(categoryFormSchema.safeParse({ ...base, formats: ["carrier_pigeon"] }).success).toBe(false);
    expect(categoryFormSchema.safeParse({ ...base, formats: [] }).success).toBe(false);
    const q = { id: "target_role", label: "Target role", type: "text", required: true };
    const dup = categoryFormSchema.safeParse({ ...base, intakeQuestions: [q, q] });
    expect(dup.success).toBe(false);
  });
});
