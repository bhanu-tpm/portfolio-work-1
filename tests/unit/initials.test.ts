import { describe, expect, it } from "vitest";
import { initials } from "@/lib/format";

describe("initials", () => {
  it("takes the first letter of up to two words", () => {
    expect(initials("Asha Rao")).toBe("AR");
    expect(initials("Asha Devi Rao")).toBe("AD");
  });

  it("ignores brackets and punctuation, including in Hindi", () => {
    expect(initials("[आपका नाम]")).toBe("आन");
    expect(initials("(Your) Name")).toBe("YN");
  });

  it("handles empty input", () => {
    expect(initials("")).toBe("");
  });
});
