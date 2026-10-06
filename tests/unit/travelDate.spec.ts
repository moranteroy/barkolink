import { describe, expect, it, vi } from "vitest";
import { philippineDateKey, validBirthDate } from "../../src/data/travelDate";

describe("Philippine travel dates", () => {
  it("uses the terminal calendar date across UTC midnight", () => {
    expect(philippineDateKey(new Date("2026-10-06T16:00:00Z"))).toBe("2026-10-07");
    expect(philippineDateKey(new Date("2026-10-06T15:59:59Z"))).toBe("2026-10-06");
  });
  it("rejects impossible dates and future birthdays", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T16:00:00Z"));
    try {
      expect(validBirthDate("2000-02-29")).toBe(true);
      expect(validBirthDate("2026-10-07")).toBe(true);
      expect(validBirthDate("2026-10-08")).toBe(false);
      expect(validBirthDate("2001-02-29")).toBe(false);
      expect(validBirthDate("invalid")).toBe(false);
    } finally { vi.useRealTimers(); }
  });
});
