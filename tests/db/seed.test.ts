import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createTestDb } from "./harness";

describe("seed data", () => {
  it("applies cleanly and exposes only public content to anonymous visitors", async () => {
    const t = await createTestDb();
    await t.db.exec(readFileSync(path.join(process.cwd(), "supabase", "seed.sql"), "utf8"));

    const categories = await t.as("anon", null, (q) => q("select slug from public.consultation_categories"));
    expect(categories.rows).toHaveLength(14);

    const posts = await t.as("anon", null, (q) => q("select slug from public.blog_posts"));
    expect(posts.rows).toHaveLength(2);

    const rules = await t.as("anon", null, (q) =>
      q("select * from public.availability_rules").catch((e: Error) => e),
    );
    expect(rules).toBeInstanceOf(Error);
  });
});
