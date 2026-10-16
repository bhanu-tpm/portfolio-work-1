import { describe, expect, it } from "vitest";
import { fmt, isLocale, localePath, splitLocale } from "@/i18n/config";

describe("localePath", () => {
  it("keeps English unprefixed and prefixes Hindi", () => {
    expect(localePath("en", "/services")).toBe("/services");
    expect(localePath("hi", "/services")).toBe("/hi/services");
    expect(localePath("hi", "/")).toBe("/hi");
    expect(localePath("hi", "/services#career-planning")).toBe("/hi/services#career-planning");
  });

  it("never prefixes the English-only app areas", () => {
    expect(localePath("hi", "/dashboard/requests/new")).toBe("/dashboard/requests/new");
    expect(localePath("hi", "/admin")).toBe("/admin");
    expect(localePath("hi", "/api/files/1")).toBe("/api/files/1");
  });
});

describe("splitLocale", () => {
  it("detects the Hindi prefix only as a whole segment", () => {
    expect(splitLocale("/hi")).toEqual({ locale: "hi", path: "/" });
    expect(splitLocale("/hi/blog/x")).toEqual({ locale: "hi", path: "/blog/x" });
    expect(splitLocale("/history")).toEqual({ locale: "en", path: "/history" });
    expect(splitLocale("/")).toEqual({ locale: "en", path: "/" });
  });
});

describe("helpers", () => {
  it("validates locales and interpolates", () => {
    expect(isLocale("hi")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(fmt("Hi, I'm {name}", { name: "Asha" })).toBe("Hi, I'm Asha");
  });
});
