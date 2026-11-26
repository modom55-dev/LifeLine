import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { connectionCards, outboundMessages } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { messagingConfig, oneWeekSend, sameEveningSend } from "./messaging";

export const CARD_INTERESTS = [
  "Prayer",
  "Encouragement",
  "Leadership support",
  "Getting connected",
  "Making WholeLife my home",
] as const;

const phone = z
  .string()
  .trim()
  .max(40)
  .refine(v => !v || /^[+()\d\s.-]{7,40}$/.test(v), "Enter a phone number, or leave it blank.");

export const cardInput = z
  .object({
    name: z.string().trim().min(1, "Please tell us your name.").max(120),
    email: z.union([z.literal(""), z.string().trim().email("Enter a valid email.").max(254)]),
    phone,
    firstTime: z.boolean(),
    interests: z.array(z.enum(CARD_INTERESTS)).max(CARD_INTERESTS.length),
    prayerRequest: z.string().trim().max(2000),
    followUpOk: z.boolean(),
    // Honeypot: real people never see or fill this field.
    website: z.string().max(200).optional(),
  })
  .refine(v => v.email || v.phone, {
    message: "Please share an email or phone number so we can reach you.",
    path: ["email"],
  });
export type CardInput = z.infer<typeof cardInput>;

const firstName = (name: string) => name.split(/\s+/)[0] || name;
const signature = [
  "With love,",
  "Bishop Michael H. Odom, Sr. and Pastor Pamela Odom",
  "WholeLife Community Church",
  "105 Church Street, Totowa, NJ 07512 · wholelifechurch.org",
].join("\n");
const optOut =
  "You're receiving this because you asked us to follow up on your Connection Card. If you'd rather not hear from us by email, just reply and let us know.";

export function thankYouEmails(name: string) {
  const first = firstName(name);
  return [
    {
      kind: "guest_thanks_1",
      subject: "Thank you for joining us at WholeLife",
      body: [
        `Dear ${first},`,
        "",
        "Thank you for joining us at WholeLife Community Church. It was a blessing to have you with us, and we hope you felt at home.",
        "",
        "If there is anything we can pray with you about, or if you'd like to learn more about getting connected, simply reply to this email. We would love to hear from you.",
        "",
        "We gather every Sunday at 11:00 AM at 105 Church Street in Totowa. You can also start your day with Morning Manna with Bishop Odom on Tuesdays and Thursdays at 7:00 AM, live on Facebook, Instagram and YouTube.",
        "",
        signature,
        "",
        optOut,
      ].join("\n"),
    },
    {
      kind: "guest_thanks_2",
      subject: "We're still thinking of you",
      body: [
        `Dear ${first},`,
        "",
        "It has been a week since you visited WholeLife Community Church, and we wanted to thank you again. Your visit meant a lot to us.",
        "",
        "Our doors are open this Sunday at 11:00 AM, and Wednesday nights at 7:00 PM for Bible Study. Come as you are. Your seat at the table is waiting.",
        "",
        "If you have a prayer request or a question, reply to this email and someone from our team will get back to you.",
        "",
        signature,
        "",
        optOut,
      ].join("\n"),
    },
  ];
}

function alertText(card: CardInput, id: number) {
  const link = ENV.appUrl ? `${ENV.appUrl}/admin/cards` : "LifeLine → Connection cards";
  const needs = card.interests.length ? card.interests.join(", ") : "None selected";
  return {
    subject: `New Connection Card: ${card.name}${card.firstTime ? " (first-time guest)" : ""}`,
    email: [
      `A new Connection Card came in on LifeLine (#${id}).`,
      "",
      `Name: ${card.name}`,
      `Email: ${card.email || "not given"}`,
      `Phone: ${card.phone || "not given"}`,
      `First-time guest: ${card.firstTime ? "Yes" : "No"}`,
      `Looking for: ${needs}`,
      `OK to follow up by email: ${card.followUpOk ? "Yes" : "No"}`,
      "",
      card.prayerRequest ? `Prayer request:\n${card.prayerRequest}` : "No prayer request.",
      "",
      `Open the inbox: ${link}`,
    ].join("\n"),
    // Texts never carry the prayer request itself.
    sms: `LifeLine: New Connection Card from ${card.name}${
      card.firstTime ? " (first-time guest)" : ""
    }. Looking for: ${needs}.${card.prayerRequest ? " Includes a prayer request." : ""} ${link}`,
  };
}

/** Saves a card and queues team alerts plus first-time-guest thank-yous. */
export async function recordCard(db: any, churchId: number, card: CardInput, now = new Date()) {
  const [result] = await db.insert(connectionCards).values({
    churchId,
    name: card.name,
    email: card.email || null,
    phone: card.phone || null,
    firstTime: card.firstTime,
    interests: card.interests,
    prayerRequest: card.prayerRequest || null,
    followUpOk: card.followUpOk,
    createdAt: now,
  });
  const cardId: number = result.insertId;
  const alert = alertText(card, cardId);
  const queue: (typeof outboundMessages.$inferInsert)[] = [];
  for (const to of messagingConfig.alertEmails)
    queue.push({ cardId, channel: "email", kind: "team_alert", recipient: to, subject: alert.subject, body: alert.email, sendAfter: now, createdAt: now });
  for (const to of messagingConfig.alertPhones)
    queue.push({ cardId, channel: "sms", kind: "team_alert", recipient: to, body: alert.sms, sendAfter: now, createdAt: now });
  if (card.firstTime && card.followUpOk && card.email) {
    const [first, second] = thankYouEmails(card.name);
    queue.push({ cardId, channel: "email", kind: first.kind, recipient: card.email, subject: first.subject, body: first.body, sendAfter: sameEveningSend(now), createdAt: now });
    queue.push({ cardId, channel: "email", kind: second.kind, recipient: card.email, subject: second.subject, body: second.body, sendAfter: oneWeekSend(now), createdAt: now });
  }
  if (queue.length) await db.insert(outboundMessages).values(queue);
  return cardId;
}

export async function listCards(db: any, churchId: number) {
  const cards = await db
    .select()
    .from(connectionCards)
    .where(eq(connectionCards.churchId, churchId))
    .orderBy(desc(connectionCards.createdAt))
    .limit(200);
  const messages = cards.length
    ? await db
        .select({
          cardId: outboundMessages.cardId,
          kind: outboundMessages.kind,
          channel: outboundMessages.channel,
          sendAfter: outboundMessages.sendAfter,
          sentAt: outboundMessages.sentAt,
          lastError: outboundMessages.lastError,
        })
        .from(outboundMessages)
        .where(inArray(outboundMessages.cardId, cards.map((c: any) => c.id)))
    : [];
  return cards.map((card: any) => ({
    ...card,
    followUps: messages
      .filter((m: any) => m.cardId === card.id && m.kind.startsWith("guest_thanks"))
      .map((m: any) => ({
        kind: m.kind,
        sendAfter: m.sendAfter,
        sentAt: m.sentAt,
        lastError: m.lastError,
      })),
  }));
}

export async function unreadCount(db: any, churchId: number) {
  const [row] = await db
    .select({ n: count() })
    .from(connectionCards)
    .where(and(eq(connectionCards.churchId, churchId), isNull(connectionCards.readAt)));
  return Number(row?.n ?? 0);
}

export const notAvailable = () =>
  new TRPCError({
    code: "FORBIDDEN",
    message: "Connection Cards open when LifeLine is opened to the congregation.",
  });
