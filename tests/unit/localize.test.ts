import { describe, expect, it } from "vitest";
import { localizeCategory, localizeContent, localizePost, localizeProfile } from "@/lib/localize";
import type { SiteProfile } from "@/lib/db/types";

const profile: SiteProfile = {
  full_name: "Asha Rao",
  headline: "Career consultant",
  short_bio: "Short bio",
  long_bio: "Long bio",
  approach: "Approach",
  photo_url: null,
  contact_email: null,
  contact_phone: null,
  location: "Pune",
  social_links: [],
  credibility_points: ["Point"],
  headline_hi: "करियर सलाहकार",
  short_bio_hi: "  ",
  credibility_points_hi: [],
};

describe("localize", () => {
  it("leaves English untouched", () => {
    expect(localizeProfile(profile, "en")).toBe(profile);
  });

  it("uses Hindi where present and falls back to English for blank fields", () => {
    const hi = localizeProfile(profile, "hi");
    expect(hi.headline).toBe("करियर सलाहकार");
    expect(hi.short_bio).toBe("Short bio"); // whitespace-only Hindi is ignored
    expect(hi.credibility_points).toEqual(["Point"]);
    expect(hi.full_name).toBe("Asha Rao");
  });

  it("localises category intake questions", () => {
    const c = localizeCategory(
      {
        title: "Career",
        title_hi: "करियर",
        short_description: "Desc",
        short_description_hi: null,
        scope: "Scope",
        scope_hi: null,
        intake_questions: [{ id: "a", label: "Question", label_hi: "सवाल", type: "text", required: true }],
      },
      "hi",
    );
    expect(c.title).toBe("करियर");
    expect(c.short_description).toBe("Desc");
    expect(c.intake_questions[0].label).toBe("सवाल");
  });

  it("flags untranslated posts and article bodies", () => {
    const post = localizePost(
      { title: "Title", excerpt: "Ex", seo_title: null, seo_description: null, cover_image_alt: null, category: null, tags: [] },
      "hi",
    );
    expect(post.translated).toBe(false);
    expect(localizeContent("English body", null, "hi")).toEqual({ body: "English body", fallback: true });
    expect(localizeContent("English body", "हिंदी", "hi")).toEqual({ body: "हिंदी", fallback: false });
    expect(localizeContent("English body", "हिंदी", "en")).toEqual({ body: "English body", fallback: false });
  });
});
