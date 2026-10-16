import { describe, expect, it } from "vitest";
import { resolveDownloadableVersion } from "@/lib/outcome-access";

const owner = { id: "client-1", isAdmin: false };
const stranger = { id: "client-2", isAdmin: false };
const admin = { id: "admin-1", isAdmin: true };

const published = {
  client_id: "client-1",
  status: "published" as const,
  approved_by: "admin-1",
  approved_version_id: "v2",
  published_version_id: "v2",
};

describe("resolveDownloadableVersion", () => {
  it("lets the owner download the published version only", () => {
    expect(resolveDownloadableVersion(owner, published, null)).toBe("v2");
    // A requested version parameter is ignored for clients.
    expect(resolveDownloadableVersion(owner, published, "v1")).toBe("v2");
  });

  it("denies other clients", () => {
    expect(resolveDownloadableVersion(stranger, published, null)).toBeNull();
  });

  it("denies drafts and approved-but-unpublished outcomes to the owner", () => {
    expect(
      resolveDownloadableVersion(owner, { ...published, status: "draft", approved_by: null, published_version_id: null }, null),
    ).toBeNull();
    expect(resolveDownloadableVersion(owner, { ...published, status: "approved", published_version_id: null }, null)).toBeNull();
  });

  it("denies a published flag without an approver (defence in depth)", () => {
    expect(resolveDownloadableVersion(owner, { ...published, approved_by: null }, null)).toBeNull();
  });

  it("keeps superseded documents available to their owner", () => {
    expect(resolveDownloadableVersion(owner, { ...published, status: "superseded" }, null)).toBe("v2");
  });

  it("lets the admin preview any version", () => {
    expect(resolveDownloadableVersion(admin, { ...published, status: "draft" }, "v1")).toBe("v1");
  });
});
