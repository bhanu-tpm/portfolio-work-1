import { describe, expect, it } from "vitest";
import { buildHref, firstParam, pageRange, parsePage, totalPages } from "@/lib/pagination";
import {
  budgetPercent,
  buildIlikeOrFilter,
  compactJson,
  dateRangeBounds,
  escapeLike,
  formatUsd,
  isUuid,
  parseAiRunFilters,
  parseAuditFilters,
  parseClientFilters,
  parseDateParam,
  parseEnumParam,
  parseNotificationFilters,
  sanitizeSearchTerm,
  utcMonthStart,
} from "@/lib/validation/admin";

describe("pagination", () => {
  it("parses page numbers defensively", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["4", "9"])).toBe(4);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-2")).toBe(1);
    expect(parsePage("2.5")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("1e9")).toBe(1);
    expect(parsePage("999999")).toBe(10_000);
  });
  it("computes inclusive ranges and page counts", () => {
    expect(pageRange(1, 20)).toEqual({ from: 0, to: 19 });
    expect(pageRange(3, 20)).toEqual({ from: 40, to: 59 });
    expect(totalPages(0)).toBe(1);
    expect(totalPages(null)).toBe(1);
    expect(totalPages(41, 20)).toBe(3);
  });
  it("builds canonical hrefs", () => {
    expect(buildHref("/admin/audit", { page: 1, action: "" })).toBe("/admin/audit");
    expect(buildHref("/admin/audit", { page: 2, action: "settings.", entity: undefined })).toBe(
      "/admin/audit?page=2&action=settings.",
    );
    expect(buildHref("/x", { q: "a&b" })).toBe("/x?q=a%26b");
    expect(firstParam(["a", "b"])).toBe("a");
  });
});

describe("search sanitising", () => {
  it("removes PostgREST syntax characters", () => {
    expect(sanitizeSearchTerm("priya),id.eq.(x")).toBe("priya id.eq. x");
    expect(sanitizeSearchTerm('a"b\\c*%')).toBe("a b c");
    expect(sanitizeSearchTerm("  ")).toBeUndefined();
    expect(sanitizeSearchTerm("asha.k+test@example.com")).toBe("asha.k+test@example.com");
    expect(sanitizeSearchTerm("Zoë O'Neil")).toBe("Zoë O'Neil");
    expect(sanitizeSearchTerm("x".repeat(200))?.length).toBe(80);
  });
  it("escapes LIKE wildcards and quotes or-filters", () => {
    expect(escapeLike("a_b%c\\")).toBe("a\\_b\\%c\\\\");
    expect(buildIlikeOrFilter(["full_name", "email"], "jo_e")).toBe(
      'full_name.ilike."%jo\\\\_e%",email.ilike."%jo\\\\_e%"',
    );
    expect(() => buildIlikeOrFilter(["name; drop"], "x")).toThrow();
  });
});

describe("dates", () => {
  it("accepts only real calendar dates", () => {
    expect(parseDateParam("2026-02-28")).toBe("2026-02-28");
    expect(parseDateParam("2026-02-30")).toBeUndefined();
    expect(parseDateParam("2026-2-1")).toBeUndefined();
    expect(parseDateParam("1900-01-01")).toBeUndefined();
    expect(parseDateParam("2026-01-01T00:00")).toBeUndefined();
  });
  it("converts an inclusive range to timestamp bounds", () => {
    expect(dateRangeBounds("2026-10-01", "2026-10-31")).toEqual({
      gte: "2026-10-01T00:00:00+05:30",
      lt: "2026-11-01T00:00:00+05:30",
    });
    expect(dateRangeBounds(undefined, "2026-12-31")).toEqual({ lt: "2027-01-01T00:00:00+05:30" });
    expect(dateRangeBounds(undefined, undefined)).toEqual({});
  });
  it("finds the UTC month start", () => {
    expect(utcMonthStart(new Date("2026-10-14T03:00:00Z")).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("page filters", () => {
  it("allow-lists enums", () => {
    expect(parseEnumParam("sent", ["sent", "failed"] as const)).toBe("sent");
    expect(parseEnumParam("sent'--", ["sent"] as const)).toBeUndefined();
    expect(parseNotificationFilters({ status: "failed", channel: "sms", page: "2" })).toEqual({
      status: "failed",
      channel: undefined,
      page: 2,
    });
    expect(parseAiRunFilters({ feature: "career_assistant", status: "bogus" })).toEqual({
      feature: "career_assistant",
      status: undefined,
      page: 1,
    });
    expect(parseClientFilters({ q: " Priya " })).toEqual({ q: "Priya", page: 1 });
  });
  it("validates audit filters and swaps reversed ranges", () => {
    expect(
      parseAuditFilters({ action: "Settings.", entity: "app_settings", from: "2026-10-10", to: "2026-10-01" }),
    ).toEqual({ action: "settings.", entity: "app_settings", from: "2026-10-01", to: "2026-10-10", page: 1 });
    expect(parseAuditFilters({ action: "a,b", entity: "x)y" })).toMatchObject({ action: undefined, entity: undefined });
  });
  it("recognises UUIDs", () => {
    expect(isUuid("3f2c1b7e-9a4d-4c1e-8b2a-1d2e3f4a5b6c")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe("display helpers", () => {
  it("formats compact JSON", () => {
    expect(compactJson({})).toBe("");
    expect(compactJson({ key: "ai" })).toBe('{"key":"ai"}');
    expect(compactJson({ long: "x".repeat(500) }, 20)).toHaveLength(20);
  });
  it("computes budget percentages", () => {
    expect(budgetPercent(5, 20)).toBe(25);
    expect(budgetPercent(30, 20)).toBe(100);
    expect(budgetPercent(5, 0)).toBe(0);
  });
  it("formats USD with precision for tiny amounts", () => {
    expect(formatUsd(12.5)).toBe("$12.50");
    expect(formatUsd("0.0012")).toBe("$0.0012");
    expect(formatUsd(null)).toBe("$0.00");
  });
});
