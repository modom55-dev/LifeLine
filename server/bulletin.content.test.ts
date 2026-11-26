import { describe, it, expect } from "vitest";
import { bulletinSchema, sampleBulletin, newsletter } from "../shared/bulletin";
const church = {
  id: 1,
  slug: "wholelife",
  name: "WholeLife Community Church",
  location: "Totowa, NJ",
  serviceTime: "11:00 AM",
};
describe("bulletin content", () => {
  it("rejects invalid service and event dates", () => {
    expect(
      bulletinSchema.safeParse({ ...sampleBulletin, serviceDate: "2026-02-30" })
        .success
    ).toBe(false);
    for (const date of ["2026-99-99", "2026-02-30", "2026-00-01"]) {
      expect(
        bulletinSchema.safeParse({
          ...sampleBulletin,
          events: [{ ...sampleBulletin.events[0], date }],
        }).success
      ).toBe(false);
    }
  });
  it("allows absent church links but rejects insecure or credential-bearing URLs", () => {
    expect(bulletinSchema.safeParse(sampleBulletin).success).toBe(true);
    for (const givingUrl of [
      "javascript:alert(1)",
      "http://example.org",
      "https://name:secret@example.org",
    ]) {
      expect(
        bulletinSchema.safeParse({ ...sampleBulletin, givingUrl }).success
      ).toBe(false);
    }
  });
  it("keeps the newsletter labeled and never invents church links", () => {
    const text = newsletter(sampleBulletin, church);
    expect(text).toContain("SAMPLE BULLETIN");
    expect(text).toContain("LifeLine · Connecting the Church Beyond Sunday.");
    expect(text).toContain("Powered by The O Factor");
    expect(text).not.toContain("ChurchConnect");
    expect(text).toContain("Giving link: not provided by the church.");
    expect(text).toContain("Livestream link: not provided by the church.");
    expect(text).toContain("105 Church Street, Totowa, NJ 07512");
    expect(text).toContain("https://www.wholelifechurch.org/");
    expect(text).toContain("11:00 AM");
    expect(text).not.toContain("10:30 AM");
    expect(text.match(/https:\/\//g)).toHaveLength(1);
  });
});
