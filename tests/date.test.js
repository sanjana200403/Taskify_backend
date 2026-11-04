import { describe, expect, it } from "vitest";
import { calendarDateToUtc } from "../src/utils/date.js";

describe("calendarDateToUtc", () => {
  it("converts a local calendar midnight to its UTC instant", () => {
    expect(calendarDateToUtc("2026-11-04", "Asia/Calcutta").toISOString()).toBe("2026-11-03T18:30:00.000Z");
  });

  it("resolves daylight-saving changes using the requested date", () => {
    expect(calendarDateToUtc("2026-03-08", "America/New_York").toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(calendarDateToUtc("2026-03-09", "America/New_York").toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });
});
