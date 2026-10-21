import { expect, test } from "@playwright/test";

test.describe("public site", () => {
  test("home page shows primary calls to action", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /book a consultation/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /explore my portfolio/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /three friendly steps/i })).toBeVisible();
  });

  for (const path of ["/services", "/about", "/blog", "/contact", "/privacy", "/assistant", "/login", "/signup"]) {
    test(`${path} renders without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  for (const path of ["/hi", "/hi/services", "/hi/about", "/hi/blog", "/hi/contact", "/hi/privacy", "/hi/assistant", "/hi/login", "/hi/signup"]) {
    test(`${path} renders in Hindi without errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(400);
      await expect(page.locator("html")).toHaveAttribute("lang", "hi-IN");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test("language switcher keeps the visitor on the same page", async ({ page, isMobile }) => {
    test.skip(isMobile, "switcher lives in the menu on mobile");
    await page.goto("/services");
    await page.getByRole("link", { name: /हिंदी/ }).first().click();
    await expect(page).toHaveURL(/\/hi\/services$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "hi-IN");
    await page.getByRole("link", { name: /English/ }).first().click();
    await expect(page).toHaveURL(/\/services$/);
  });

  test("/en URLs redirect to the unprefixed English page", async ({ request }) => {
    const res = await request.get("/en/blog", { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(res.headers()["location"]).toMatch(/\/blog$/);
  });

  test("pages declare hreflang alternates", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="alternate"][hreflang="hi"]')).toHaveAttribute("href", /\/hi$/);
  });

  test("unknown blog posts are not indexable and return 404 once resolved", async ({ page, request }) => {
    // With Cache Components the first request for an unseen slug may stream the
    // shell (200) before notFound() resolves; it is always marked noindex.
    const slug = `missing-${test.info().project.name}-${Date.now()}`;
    await page.goto(`/blog/${slug}`);
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);
    await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible();
    const again = await request.get(`/blog/${slug}`);
    expect(again.status()).toBe(404);
  });

  test("contact form validates on the server", async ({ page }) => {
    await page.goto("/contact");
    await page.getByRole("button", { name: /send message/i }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
  });

  test("blog search shows an empty state for no matches", async ({ page }) => {
    await page.goto("/blog?q=zzzz-no-such-article");
    await expect(page.getByText(/no matching articles|no articles yet/i)).toBeVisible();
  });
});

test.describe("access control", () => {
  test("dashboard requires sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("admin requires sign-in", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("outcome downloads reject anonymous users", async ({ request }) => {
    const res = await request.get("/api/outcomes/00000000-0000-0000-0000-000000000000/download", { maxRedirects: 0 });
    expect(res.status()).toBe(401);
  });

  test("file downloads reject anonymous users", async ({ request }) => {
    const res = await request.get("/api/files/00000000-0000-0000-0000-000000000000", { maxRedirects: 0 });
    expect(res.status()).toBe(401);
  });

  test("security headers are set", async ({ request }) => {
    const res = await request.get("/");
    expect(res.headers()["x-frame-options"]).toBe("DENY");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  });
});

test.describe("responsive layout", () => {
  test("mobile navigation opens", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/");
    await page.getByRole("button", { name: /open menu/i }).click();
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
  });

  test("no horizontal overflow on key pages", async ({ page }) => {
    for (const path of ["/", "/services", "/blog", "/contact"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(1);
    }
  });
});
