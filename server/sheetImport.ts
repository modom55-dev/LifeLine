import { bulletinSchema, type Bulletin } from "@shared/bulletin";
import { addDays, churchClock } from "./messaging";

/** The team's "WLCC Weekly Bulletin" Google Sheet. Override with TEAM_SHEET_ID. */
const DEFAULT_SHEET_ID = "1zlYvo9GiE7eJwbnCfs51DFnptr1SfqFEs_ki3wwZzJM";
export const teamSheetId = () =>
  (process.env.TEAM_SHEET_ID ?? "").trim() || DEFAULT_SHEET_ID;

/** The Sunday the team is preparing for: today if it is Sunday morning, else the next Sunday. */
export function upcomingSunday(now = new Date()) {
  const clock = churchClock(now);
  if (clock.weekday === 0 && clock.hour < 13) return clock.date;
  return addDays(clock.date, (7 - clock.weekday) % 7 || 7);
}

/** Tab names follow the template's convention: "Nov 29", "Dec 6". */
export function tabNameFor(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}

/** Minimal RFC 4180 CSV parser (quoted fields, embedded commas and newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const clean = (v: string | undefined) => (v ?? "").replace(/\r/g, "").trim();
const clip = (v: string, max: number) => (v.length > max ? v.slice(0, max - 1).trimEnd() + "…" : v);

export class SheetImportError extends Error {}

const quoteKey = (service: Record<string, string>) =>
  Object.keys(service).find(k => k.includes("quote") && !k.includes("from") && !k.includes("source")) ?? "";
const sourceKey = (service: Record<string, string>) =>
  Object.keys(service).find(k => k.includes("quote") && (k.includes("from") || k.includes("source"))) ?? "";
const stripQuotes = (v: string) => v.replace(/^["“”']+|["“”']+$/g, "").trim();

/** Rows of the "Quote Library" tab: quote in column A, book in column B (header row skipped). */
export function quotesFromRows(rows: string[][]) {
  // Google returns the first tab when a tab name is missing, so insist on the library's own header.
  const header = rows.findIndex(r => clean(r[0]).toLowerCase() === "quote");
  if (header < 0) return [];
  return rows
    .slice(header + 1)
    .map(r => ({ quote: stripQuotes(clean(r[0])), source: clean(r[1]) }))
    .filter(r => r.quote.length > 8);
}

/** Same quote all week; moves to the next one each Sunday. */
export function quoteForWeek<T>(quotes: T[], serviceDate: string): T | undefined {
  if (!quotes.length) return undefined;
  const weeks = Math.floor(
    (Date.parse(`${serviceDate}T12:00:00Z`) - Date.parse("2026-01-04T12:00:00Z")) / (7 * 864e5)
  );
  return quotes[((weeks % quotes.length) + quotes.length) % quotes.length];
}

/** Turns the rows of one weekly tab into a bulletin. Throws SheetImportError with a plain-language reason. */
export function bulletinFromRows(rows: string[][], expectedDate: string): Bulletin {
  const service: Record<string, string> = {};
  const announcements: Bulletin["announcements"] = [];
  const events: Bulletin["events"] = [];
  const skipped: string[] = [];
  let section: "service" | "announcements" | "events" | null = null;

  for (const raw of rows) {
    const [a, b, c, d, e] = [0, 1, 2, 3, 4].map(i => clean(raw[i]));
    const label = a.toLowerCase();
    if (label === "service") {
      section = "service";
      continue;
    }
    if (label === "announcements") {
      section = "announcements";
      continue;
    }
    if (label === "upcoming events") {
      section = "events";
      continue;
    }
    if (section === "service" && a) service[label] = b;
    if (section === "announcements" && a && c && !/^https:\/\//i.test(c) && label !== "title")
      skipped.push(`${a} link (must start with https://)`);
    if (section === "announcements" && a && !(label === "title" && b.toLowerCase() === "details")) {
      if (announcements.length < 30)
        announcements.push({
          id: `sheet-a${announcements.length + 1}`,
          title: clip(a, 160),
          body: clip(b, 2000),
          linkUrl: /^https:\/\//i.test(c) ? c : "",
          linkText: clip(d, 80),
        });
    }
    if (section === "events" && a && label !== "event") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b)) {
        skipped.push(`${a} (date must look like 2026-12-05)`);
        continue;
      }
      if (events.length < 30)
        events.push({
          id: `sheet-e${events.length + 1}`,
          title: clip(a, 160),
          date: b,
          time: clip(c, 80),
          location: clip(d, 180),
          description: clip(e, 2000),
        });
    }
  }

  const date = service["service date"];
  if (date !== expectedDate)
    throw new SheetImportError(
      `The "${tabNameFor(expectedDate)}" tab wasn't found, or its Service date isn't ${expectedDate}. Duplicate the Template tab and rename it "${tabNameFor(expectedDate)}".`
    );
  const livestreamKey = Object.keys(service).find(k => k.startsWith("livestream link"));
  const candidate: Bulletin = {
    serviceDate: date,
    serviceTime: clip(service["service time"] || "11:00 AM", 40),
    sermonTitle: clip(service["sermon title"] ?? "", 180),
    scripture: clip(service["scripture"] ?? "", 180),
    speaker: clip(service["speaker"] ?? "", 120),
    sermonSummary: clip(service["sermon summary"] ?? "", 2000),
    quote: clip(stripQuotes(service[quoteKey(service)] ?? ""), 600),
    quoteSource: clip(service[sourceKey(service)] ?? "", 120),
    announcements,
    events,
    givingUrl: service["giving link"] ?? "",
    livestreamUrl: livestreamKey ? service[livestreamKey] : "",
    sampleData: false,
  };
  const parsed = bulletinSchema.safeParse(candidate);
  if (!parsed.success)
    throw new SheetImportError(
      `The sheet needs a fix before it can load: ${parsed.error.issues[0]?.message ?? "invalid entry"}`
    );
  return Object.assign(parsed.data, { __skipped: skipped }) as Bulletin;
}

/** Downloads one weekly tab (the sheet must be shared "anyone with the link can view"). */
export async function loadWeekFromSheet(date = upcomingSunday()) {
  const tab = tabNameFor(date);
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    teamSheetId()
  )}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent(tab)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "follow" });
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.includes("csv"))
    throw new SheetImportError(
      "LifeLine couldn't open the team sheet. Make sure it is shared as \"Anyone with the link can view.\""
    );
  const bulletin = bulletinFromRows(parseCsv(await response.text()), date);
  const skipped = (bulletin as Bulletin & { __skipped?: string[] }).__skipped ?? [];
  delete (bulletin as Bulletin & { __skipped?: string[] }).__skipped;
  if (!bulletin.quote) {
    // No quote typed for this week: rotate through the Quote Library tab.
    try {
      const libraryUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
        teamSheetId()
      )}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent("Quote Library")}`;
      const lib = await fetch(libraryUrl, { signal: AbortSignal.timeout(15000), redirect: "follow" });
      if (lib.ok && (lib.headers.get("content-type") ?? "").includes("csv")) {
        const pick = quoteForWeek(quotesFromRows(parseCsv(await lib.text())), date);
        if (pick) {
          bulletin.quote = clip(pick.quote, 600);
          bulletin.quoteSource = clip(pick.source, 120);
        }
      }
    } catch {
      /* a missing library never blocks the bulletin */
    }
  }
  return { bulletin, tab, skipped };
}
