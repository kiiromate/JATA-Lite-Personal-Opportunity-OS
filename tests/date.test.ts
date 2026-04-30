import { describe, expect, it } from "vitest";
import { formatLocalDate } from "../src/core/date.js";

describe("formatLocalDate", () => {
  it("formats a Date as YYYY-MM-DD without using UTC string slicing", () => {
    const date = new Date(2026, 4, 1, 1, 30, 0);

    expect(formatLocalDate(date)).toBe("2026-05-01");
  });
});
