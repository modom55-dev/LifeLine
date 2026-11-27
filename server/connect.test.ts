import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { churches, connectionCards, outboundMessages } from "../drizzle/schema";
import { recordCard, thankYouEmails } from "./connect";
import { churchClock, churchTime, oneWeekSend, sameEveningSend } from "./messaging";
import {
  bulletinFromRows,
  parseCsv,
  SheetImportError,
  tabNameFor,
  upcomingSunday,
} from "./sheetImport";

describe("church-time scheduling", () => {
  it("converts New York wall-clock times across daylight saving", () => {
    expect(churchTime("2026-11-29", 19).toISOString()).toBe("2026-11-30T00:00:00.000Z");
    expect(churchTime("2026-07-05", 19).toISOString()).toBe("2026-07-05T23:00:00.000Z");
  });
  it("sends the first thank-you at 7 PM the same evening", () => {
    const sundayNoon = new Date("2026-11-29T17:30:00Z"); // 12:30 PM ET
    expect(sameEveningSend(sundayNoon).toISOString()).toBe("2026-11-30T00:00:00.000Z");
  });
  it("waits two hours when the card arrives late in the evening", () => {
    const late = new Date("2026-11-30T01:00:00Z"); // 8 PM ET
    expect(sameEveningSend(late).toISOString()).toBe("2026-11-30T03:00:00.000Z");
  });
  it("sends the second thank-you a week later at 10 AM", () => {
    const sundayNoon = new Date("2026-11-29T17:30:00Z");
    expect(oneWeekSend(sundayNoon).toISOString()).toBe("2026-12-06T15:00:00.000Z");
  });
  it("finds the upcoming Sunday and its tab name", () => {
    expect(upcomingSunday(new Date("2026-11-27T18:00:00Z"))).toBe("2026-11-29"); // Friday
    expect(upcomingSunday(new Date("2026-11-29T14:00:00Z"))).toBe("2026-11-29"); // Sunday 9 AM
    expect(upcomingSunday(new Date("2026-11-29T20:00:00Z"))).toBe("2026-12-06"); // Sunday 3 PM
    expect(tabNameFor("2026-11-29")).toBe("Nov 29");
    expect(tabNameFor("2026-12-06")).toBe("Dec 6");
    expect(churchClock(new Date("2026-11-27T18:00:00Z")).weekday).toBe(5);
  });
});

const sheetCsv = [
  '"WLCC Weekly Bulletin: Sunday, November 29, 2026","","","",""',
  '"Due Friday by 12 noon.","","","",""',
  '"","","","",""',
  '"SERVICE","","","",""',
  '"Service date","2026-11-29","","",""',
  '"Service time","11:00 AM","","",""',
  '"Sermon title","Blessed Beyond Measure","","",""',
  '"Scripture","Malachi 3:10","","",""',
  '"Speaker","Bishop Michael H. Odom, Sr.","","",""',
  '"Sermon summary","Completion and Celebration.","","",""',
  '"Giving link","https://wholelifechurch.org","","",""',
  '"Livestream link (YouTube)","https://www.youtube.com/@Wholelifechurch","","",""',
  '"","","","",""',
  '"ANNOUNCEMENTS","","","",""',
  '"Title","Details","","",""',
  '"Coats & Cocoa","Line one, with a comma.\nLine two ""quoted"".","","",""',
  '"","","","",""',
  '"UPCOMING EVENTS","","","",""',
  '"Event","Date (YYYY-MM-DD)","Time","Location","Details"',
  '"Coats & Cocoa","2026-12-05","11:00 AM to 2:00 PM","Center City Mall","Bring coats."',
  '"Bad date event","Dec 9","","",""',
].join("\n");

describe("team sheet import", () => {
  it("parses the weekly tab into a real (non-sample) bulletin", () => {
    const b = bulletinFromRows(parseCsv(sheetCsv), "2026-11-29") as any;
    expect(b.sermonTitle).toBe("Blessed Beyond Measure");
    expect(b.speaker).toBe("Bishop Michael H. Odom, Sr.");
    expect(b.livestreamUrl).toBe("https://www.youtube.com/@Wholelifechurch");
    expect(b.sampleData).toBe(false);
    expect(b.announcements).toEqual([
      { id: "sheet-a1", title: "Coats & Cocoa", body: 'Line one, with a comma.\nLine two "quoted".', linkUrl: "", linkText: "" },
    ]);
    expect(b.events).toHaveLength(1);
    expect(b.events[0]).toMatchObject({ date: "2026-12-05", location: "Center City Mall" });
    expect(b.__skipped).toEqual(["Bad date event (date must look like 2026-12-05)"]);
  });
  it("refuses a tab whose service date is not the expected Sunday", () => {
    expect(() => bulletinFromRows(parseCsv(sheetCsv), "2026-12-06")).toThrow(SheetImportError);
  });
  it("rejects non-HTTPS links with a plain explanation", () => {
    const bad = sheetCsv.replace("https://wholelifechurch.org", "http://example.com");
    expect(() => bulletinFromRows(parseCsv(bad), "2026-11-29")).toThrow(/HTTPS/);
  });
});

describe("thank-you emails", () => {
  it("are addressed by first name, signed with WLCC titles, and offer an opt-out", () => {
    const [first, second] = thankYouEmails("Grace Thompson");
    expect(first.body.startsWith("Dear Grace,")).toBe(true);
    expect(first.body).toContain("Bishop Michael H. Odom, Sr. and Pastor Pamela Odom");
    expect(second.body).toContain("rather not hear from us");
  });
});

const hasDatabase = Boolean(process.env.DATABASE_URL);
describe.skipIf(!hasDatabase)("Connection Card queueing (database)", () => {
  const db = drizzle(process.env.DATABASE_URL!);
  let churchId = 0;
  beforeAll(async () => {
    const [r] = await db.insert(churches).values({
      slug: `cardtest-${Date.now()}`,
      name: "Card Test",
      location: "Test",
      serviceTime: "11:00 AM",
    });
    churchId = r.insertId;
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await db.delete(churches).where(eq(churches.id, churchId));
  });

  it("alerts every team address and phone, and schedules two thank-yous for a first-time guest", async () => {
    vi.stubEnv("ALERT_EMAILS", "a@example.org, b@example.org");
    vi.stubEnv("ALERT_PHONES", "+15555550100");
    const now = new Date("2026-11-29T17:30:00Z");
    const id = await recordCard(db, churchId, {
      name: "Grace Thompson",
      email: "grace@example.org",
      phone: "",
      firstTime: true,
      interests: ["Prayer"],
      prayerRequest: "Please pray for my mother.",
      followUpOk: true,
    }, now);
    const queued = await db.select().from(outboundMessages).where(eq(outboundMessages.cardId, id));
    expect(queued.filter(m => m.kind === "team_alert" && m.channel === "email").map(m => m.recipient).sort())
      .toEqual(["a@example.org", "b@example.org"]);
    const sms = queued.find(m => m.channel === "sms")!;
    expect(sms.body).not.toContain("mother"); // prayer text never goes by text message
    const thanks = queued.filter(m => m.kind.startsWith("guest_thanks"));
    expect(thanks.map(m => m.sendAfter.toISOString()).sort()).toEqual([
      "2026-11-30T00:00:00.000Z",
      "2026-12-06T15:00:00.000Z",
    ]);
    const [card] = await db.select().from(connectionCards).where(eq(connectionCards.id, id));
    expect(card.prayerRequest).toBe("Please pray for my mother.");
  });

  it("sends no guest emails without consent or for returning members", async () => {
    vi.stubEnv("ALERT_EMAILS", "");
    vi.stubEnv("ALERT_PHONES", "");
    const noConsent = await recordCard(db, churchId, {
      name: "A", email: "a@example.org", phone: "", firstTime: true,
      interests: [], prayerRequest: "", followUpOk: false,
    });
    const member = await recordCard(db, churchId, {
      name: "B", email: "b@example.org", phone: "", firstTime: false,
      interests: [], prayerRequest: "", followUpOk: true,
    });
    for (const id of [noConsent, member]) {
      const queued = await db.select().from(outboundMessages).where(eq(outboundMessages.cardId, id));
      expect(queued).toHaveLength(0);
    }
  });
});
