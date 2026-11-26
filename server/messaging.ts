import { and, asc, eq, isNull, lte, lt } from "drizzle-orm";
import { outboundMessages } from "../drizzle/schema";
import { getDb } from "./db";

export const CHURCH_TZ = "America/New_York";
const read = (key: string) => (process.env[key] ?? "").trim();
const list = (key: string) =>
  read(key)
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);

export const messagingConfig = {
  get emailReady() {
    return Boolean(read("RESEND_API_KEY") && read("EMAIL_FROM"));
  },
  get smsReady() {
    return Boolean(
      read("TWILIO_ACCOUNT_SID") && read("TWILIO_AUTH_TOKEN") && read("TWILIO_FROM")
    );
  },
  get alertEmails() {
    return list("ALERT_EMAILS");
  },
  get alertPhones() {
    return list("ALERT_PHONES");
  },
};

/** Minutes the church time zone is offset from UTC at a given instant. */
function zoneOffsetMinutes(instant: Date, timeZone = CHURCH_TZ) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map(p => [p.type, p.value])
  );
  const asUtc = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour,
    +parts.minute,
    +parts.second
  );
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** Calendar date (YYYY-MM-DD), weekday (0=Sun) and time in the church time zone. */
export function churchClock(instant = new Date()) {
  const shifted = new Date(instant.getTime() + zoneOffsetMinutes(instant) * 60000);
  return {
    date: shifted.toISOString().slice(0, 10),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

/** The instant of a local wall-clock time on a church-calendar date. */
export function churchTime(date: string, hour: number, minute = 0) {
  const [y, m, d] = date.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hour, minute));
  const first = new Date(guess.getTime() - zoneOffsetMinutes(guess) * 60000);
  return new Date(guess.getTime() - zoneOffsetMinutes(first) * 60000);
}

export function addDays(date: string, days: number) {
  const t = new Date(`${date}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/** First thank-you goes out at 7 PM the same evening, or 2 hours later if it's already late. */
export function sameEveningSend(now = new Date()) {
  const today = churchClock(now).date;
  const sevenPm = churchTime(today, 19);
  const soonest = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  return sevenPm.getTime() > now.getTime() + 30 * 60 * 1000 ? sevenPm : soonest;
}
/** Second thank-you: one week later at 10 AM church time. */
export function oneWeekSend(now = new Date()) {
  return churchTime(addDays(churchClock(now).date, 7), 10);
}

async function sendEmail(to: string, subject: string, body: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${read("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: read("EMAIL_FROM"),
      to: [to],
      subject,
      text: body,
      reply_to: read("EMAIL_REPLY_TO") || undefined,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
}

async function sendSms(to: string, body: string) {
  const sid = read("TWILIO_ACCOUNT_SID");
  const auth = Buffer.from(`${sid}:${read("TWILIO_AUTH_TOKEN")}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: read("TWILIO_FROM"), Body: body }),
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!response.ok) throw new Error(`Text provider returned ${response.status}`);
}

const MAX_ATTEMPTS = 5;

/** Sends every due message whose channel is configured. Safe to call repeatedly. */
export async function deliverDueMessages(now = new Date()) {
  const db = await getDb();
  if (!db) return { sent: 0, failed: 0 };
  const due = await db
    .select()
    .from(outboundMessages)
    .where(
      and(
        isNull(outboundMessages.sentAt),
        lte(outboundMessages.sendAfter, now),
        lt(outboundMessages.attempts, MAX_ATTEMPTS)
      )
    )
    .orderBy(asc(outboundMessages.sendAfter))
    .limit(25);
  let sent = 0;
  let failed = 0;
  for (const message of due) {
    const ready =
      message.channel === "email" ? messagingConfig.emailReady : messagingConfig.smsReady;
    if (!ready) continue; // stays queued until the provider is connected
    try {
      if (message.channel === "email")
        await sendEmail(message.recipient, message.subject ?? "WholeLife", message.body);
      else await sendSms(message.recipient, message.body);
      await db
        .update(outboundMessages)
        .set({ sentAt: new Date(), attempts: message.attempts + 1, lastError: null })
        .where(and(eq(outboundMessages.id, message.id), isNull(outboundMessages.sentAt)));
      sent += 1;
    } catch (error) {
      failed += 1;
      await db
        .update(outboundMessages)
        .set({
          attempts: message.attempts + 1,
          lastError: (error instanceof Error ? error.message : "send failed").slice(0, 290),
          // back off: retry in 15 minutes
          sendAfter: new Date(Date.now() + 15 * 60 * 1000),
        })
        .where(eq(outboundMessages.id, message.id));
    }
  }
  return { sent, failed };
}
