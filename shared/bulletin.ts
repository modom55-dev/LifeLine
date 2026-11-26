import { z } from "zod";
import { WHOLELIFE_REFERENCE } from "./identity";

const safeUrl = z
  .string()
  .trim()
  .max(2048)
  .refine(value => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Enter a complete HTTPS URL, or leave this blank.");

export const bulletinSchema = z.object({
  serviceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      value =>
        !Number.isNaN(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value,
      "Enter a valid service date."
    ),
  serviceTime: z.string().trim().min(1).max(40),
  sermonTitle: z.string().trim().min(1, "A sermon title is required.").max(180),
  scripture: z
    .string()
    .trim()
    .min(1, "A scripture reference is required.")
    .max(180),
  speaker: z.string().trim().max(120),
  sermonSummary: z.string().trim().max(2000),
  announcements: z
    .array(
      z.object({
        id: z.string().max(64),
        title: z.string().trim().min(1).max(160),
        body: z.string().trim().max(2000),
      })
    )
    .max(30),
  events: z
    .array(
      z.object({
        id: z.string().max(64),
        title: z.string().trim().min(1).max(160),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .refine(
            value =>
              !Number.isNaN(Date.parse(value)) &&
              new Date(value).toISOString().slice(0, 10) === value,
            "Enter a valid event date."
          ),
        time: z.string().trim().max(80),
        location: z.string().trim().max(180),
        description: z.string().trim().max(2000),
      })
    )
    .max(30),
  givingUrl: safeUrl,
  livestreamUrl: safeUrl,
  sampleData: z.boolean(),
});
export type Bulletin = z.infer<typeof bulletinSchema>;
export type ChurchInfo = {
  id: number;
  slug: string;
  name: string;
  location: string;
  serviceTime: string;
};
export const CHURCH_SLUG = "wholelife";
export const sampleBulletin: Bulletin = {
  serviceDate: "2026-11-29",
  serviceTime: "11:00 AM",
  sermonTitle: "A life rooted in gratitude",
  scripture: "Colossians 2:6–7",
  speaker: "Sample speaker",
  sampleData: true,
  sermonSummary:
    "This sample message invites us to slow down, notice the goodness around us, and let gratitude shape the way we live together.",
  announcements: [
    {
      id: "welcome",
      title: "A place for everyone",
      body: "New to the community? This sample announcement invites you to connect with the welcome team after the service.",
    },
    {
      id: "serve",
      title: "Small acts. Lasting difference.",
      body: "Sample opportunity: lend a hand with our community care team. Details will be confirmed by church leadership.",
    },
    {
      id: "families",
      title: "Growing together",
      body: "Sample reminder: families can ask the welcome team about children's activities and gathering spaces.",
    },
  ],
  events: [
    {
      id: "gather",
      title: "Community table",
      date: "2026-12-06",
      time: "After the service",
      location: "Sample gathering space",
      description:
        "A sample gathering to share a meal and get to know one another. Not a confirmed church event.",
    },
    {
      id: "care",
      title: "A morning of service",
      date: "2026-12-12",
      time: "9:00 AM",
      location: "Location to be confirmed",
      description:
        "Sample community care event. Date, location and participation details are illustrative only.",
    },
  ],
  givingUrl: "",
  livestreamUrl: "",
};
export function formatDate(date: string, short = false) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(
    "en-US",
    short
      ? { month: "short", day: "numeric" }
      : { weekday: "long", month: "long", day: "numeric", year: "numeric" }
  );
}
export function newsletter(b: Bulletin, church: ChurchInfo) {
  return [
    b.sampleData ? "SAMPLE BULLETIN — NOT CONFIRMED CHURCH INFORMATION\n" : "",
    church.name,
    church.slug === CHURCH_SLUG ? WHOLELIFE_REFERENCE.address : church.location,
    church.slug === CHURCH_SLUG ? WHOLELIFE_REFERENCE.website : undefined,
    `${formatDate(b.serviceDate)} · ${b.serviceTime}`,
    "",
    b.sermonTitle,
    b.scripture,
    b.speaker ? `Speaker: ${b.speaker}` : "",
    b.sermonSummary,
    "",
    "ANNOUNCEMENTS",
    ...b.announcements.map(a => `${a.title}\n${a.body}\n`),
    "UPCOMING EVENTS",
    ...b.events.map(
      e =>
        `${e.title}\n${formatDate(e.date)} · ${e.time}\n${e.location}\n${e.description}\n`
    ),
    b.givingUrl
      ? `Giving: ${b.givingUrl}`
      : "Giving link: not provided by the church.",
    b.livestreamUrl
      ? `Livestream: ${b.livestreamUrl}`
      : "Livestream link: not provided by the church.",
    "",
    "LifeLine · Connecting the Church Beyond Sunday.",
    "Powered by The O Factor",
  ]
    .filter(v => v !== undefined)
    .join("\n");
}
