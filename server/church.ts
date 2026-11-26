import { createHash, randomBytes } from "node:crypto";
import { parse } from "cookie";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { bulletinSchema, CHURCH_SLUG, type ChurchInfo } from "@shared/bulletin";
import { churches, churchBulletins, connectionCards, pilotInvites } from "../drizzle/schema";
import {
  CARD_INTERESTS,
  cardInput,
  listCards,
  notAvailable,
  recordCard,
  unreadCount,
} from "./connect";
import { messagingConfig } from "./messaging";
import { loadWeekFromSheet, SheetImportError, teamSheetId } from "./sheetImport";
import { getDb } from "./db";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

export const PILOT_COOKIE = "cc_pilot_access";
export const PILOT_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
export const hashPilotSecret = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const opaqueSecret = /^[a-f0-9]{64}$/;
const pilotBulletinSchema = bulletinSchema.refine(
  bulletin => bulletin.sampleData,
  {
    message: "The restricted pilot must remain labeled sample data.",
    path: ["sampleData"],
  }
);
const revisionSchema = z.number().int().min(1).max(2147483646);
const inviteCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};
const invalidInvite = () =>
  new TRPCError({
    code: "FORBIDDEN",
    message: "Invalid or expired tester invitation.",
  });
const invalidActivation = () =>
  new TRPCError({
    code: "FORBIDDEN",
    message: "Invalid or expired activation key.",
  });

type ChurchRow = typeof churches.$inferSelect;
type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Executor = Pick<Database, "select" | "update" | "insert">;

async function database() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Pilot storage is unavailable.",
    });
  return db;
}
function churchInfo(church: ChurchRow): ChurchInfo {
  return {
    id: church.id,
    slug: church.slug,
    name: church.name,
    location: church.location,
    serviceTime: church.serviceTime,
  };
}
async function pilotChurch(db?: Executor) {
  db ??= await database();
  const [church] = await db
    .select()
    .from(churches)
    .where(eq(churches.slug, CHURCH_SLUG))
    .limit(1);
  if (!church)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "The restricted pilot has not been set up.",
    });
  return church;
}
const isLaunched = (church: ChurchRow) => Boolean(church.launchedAt);
/** Before launch only sample content is allowed; after launch real content is too. */
function assertContentAllowed(church: ChurchRow, bulletin: { sampleData: boolean }) {
  if (!isLaunched(church) && !bulletin.sampleData)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Open LifeLine to the congregation before saving real church content.",
    });
}
async function hasMemberAccess(ctx: TrpcContext, church: ChurchRow) {
  return (
    isLaunched(church) ||
    isOwner(ctx, church) ||
    Boolean(await validatedInvite(church.id, tokenFromCookie(ctx)))
  );
}
function isOwner(ctx: TrpcContext, church: ChurchRow) {
  return Boolean(
    ctx.user &&
      ctx.user.id > 0 &&
      !ctx.user.openId.startsWith("cron_") &&
      church.ownerOpenId &&
      ctx.user.openId === church.ownerOpenId
  );
}
/** True only for the deliberately configured owner address, verified by Google. */
function matchesConfiguredOwner(ctx: TrpcContext) {
  const configured = ENV.ownerEmail;
  const email = ctx.user?.email?.toLowerCase() ?? "";
  return Boolean(
    configured &&
      email &&
      email === configured &&
      ctx.user &&
      ctx.user.id > 0 &&
      ctx.user.loginMethod === "google"
  );
}
function requireMutationHeader(ctx: TrpcContext) {
  if (ctx.req.headers["x-churchconnect"] !== "1") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Required application request header is missing.",
    });
  }
}

// Bounded process-local abuse protection; never trust arbitrary forwarded IP headers.
const rateBuckets = new Map<string, { attempts: number; expires: number }>();
const RATE_WINDOW = 15 * 60 * 1000;
const MAX_BUCKETS = 1000;
function limitAttempt(ctx: TrpcContext, operation: "claim" | "redeem" | "card") {
  const now = Date.now();
  for (const [key, value] of rateBuckets)
    if (value.expires <= now) rateBuckets.delete(key);
  // req.ip honours exactly one trusted hosting-proxy hop (see index.ts).
  const address = ctx.req.ip ?? ctx.req.socket?.remoteAddress ?? "unknown";
  const key = `${operation}:${address}`;
  let bucket = rateBuckets.get(key);
  if (!bucket) {
    if (rateBuckets.size >= MAX_BUCKETS)
      rateBuckets.delete(rateBuckets.keys().next().value!);
    bucket = { attempts: 0, expires: now + RATE_WINDOW };
    rateBuckets.set(key, bucket);
  }
  bucket.attempts += 1;
  const limit = operation === "claim" ? 10 : operation === "card" ? 5 : 20;
  if (bucket.attempts > limit) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts. Try again later.",
    });
  }
}

export const mutationProcedure = publicProcedure.use(({ ctx, next }) => {
  requireMutationHeader(ctx);
  return next();
});
const authenticatedMutation = protectedProcedure.use(({ ctx, next }) => {
  requireMutationHeader(ctx);
  if (ctx.user.id <= 0 || ctx.user.openId.startsWith("cron_"))
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "A real Google sign-in is required.",
    });
  return next();
});
const ownerProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const church = await pilotChurch();
  if (!isOwner(ctx, church))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the church owner may access this workspace.",
    });
  return next({ ctx: { ...ctx, church } });
});
const ownerMutation = ownerProcedure.use(({ ctx, next }) => {
  requireMutationHeader(ctx);
  return next();
});

function tokenFromCookie(ctx: TrpcContext): string | null {
  try {
    const token = parse(ctx.req.headers.cookie ?? "")[PILOT_COOKIE];
    return token && opaqueSecret.test(token) ? token : null;
  } catch {
    return null;
  }
}
async function validatedInvite(churchId: number, token: string | null) {
  if (!token || !opaqueSecret.test(token)) return null;
  const db = await database();
  const [invite] = await db
    .select()
    .from(pilotInvites)
    .where(
      and(
        eq(pilotInvites.churchId, churchId),
        eq(pilotInvites.tokenHash, hashPilotSecret(token)),
        isNull(pilotInvites.revokedAt),
        gt(pilotInvites.expiresAt, new Date())
      )
    )
    .limit(1);
  return invite ?? null;
}
async function workspace(db: Executor, church: ChurchRow) {
  const [record] = await db
    .select()
    .from(churchBulletins)
    .where(eq(churchBulletins.churchId, church.id))
    .limit(1);
  if (!record)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "The bulletin has not been set up.",
    });
  return {
    church: churchInfo(church),
    draft: record.draft,
    published: record.published,
    revision: record.revision,
    savedAt: record.savedAt,
    publishedAt: record.publishedAt,
  };
}
export async function saveDraft(
  db: Database,
  church: ChurchRow,
  bulletin: z.infer<typeof bulletinSchema>,
  revision: number
) {
  return db.transaction(async tx => {
    const [result] = await tx
      .update(churchBulletins)
      .set({ draft: bulletin, revision: revision + 1, savedAt: new Date() })
      .where(
        and(
          eq(churchBulletins.churchId, church.id),
          eq(churchBulletins.revision, revision)
        )
      );
    if (result.affectedRows !== 1) throw conflict();
    return workspace(tx, church);
  });
}
function conflict() {
  return new TRPCError({
    code: "CONFLICT",
    message:
      "This bulletin changed in another session. Reload the latest saved version before trying again.",
  });
}

export const pilotRouter = router({
  status: publicProcedure.query(async ({ ctx }) => {
    const church = await pilotChurch();
    const owner = isOwner(ctx, church);
    const access = await hasMemberAccess(ctx, church);
    return {
      isOwner: owner,
      authenticated: Boolean(
        ctx.user && ctx.user.id > 0 && !ctx.user.openId.startsWith("cron_")
      ),
      hasMemberAccess: access,
      ownerClaimed: Boolean(church.ownerOpenId),
      canActivateByEmail: !church.ownerOpenId && matchesConfiguredOwner(ctx),
      userEmail: ctx.user?.email ?? null,
      userName: ctx.user?.name ?? null,
      church: churchInfo(church),
      launched: isLaunched(church),
      pilotRestricted: !isLaunched(church),
    };
  }),
  claimOwner: authenticatedMutation
    .use(({ ctx, next }) => {
      limitAttempt(ctx, "claim");
      return next();
    })
    .input(
      z.object({
        key: z.string().max(256, "Invalid or expired activation key.").optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      const church = await pilotChurch(db);
      const now = new Date();
      if (!input.key) {
        // Configured-owner path: the maintainer set OWNER_EMAIL, and Google
        // verified this account holds it. Still only succeeds while unclaimed.
        if (!matchesConfiguredOwner(ctx)) throw invalidActivation();
        const [result] = await db
          .update(churches)
          .set({
            ownerOpenId: ctx.user.openId,
            ownerClaimedAt: now,
            activationKeyHash: null,
            activationExpiresAt: null,
          })
          .where(and(eq(churches.id, church.id), isNull(churches.ownerOpenId)));
        if (result.affectedRows !== 1) throw invalidActivation();
        return { success: true as const };
      }
      if (!opaqueSecret.test(input.key)) throw invalidActivation();
      // Single conditional UPDATE consumes the key and establishes ownership atomically.
      const [result] = await db
        .update(churches)
        .set({
          ownerOpenId: ctx.user.openId,
          ownerClaimedAt: now,
          activationKeyHash: null,
          activationExpiresAt: null,
        })
        .where(
          and(
            eq(churches.id, church.id),
            isNull(churches.ownerOpenId),
            eq(churches.activationKeyHash, hashPilotSecret(input.key)),
            gt(churches.activationExpiresAt, now)
          )
        );
      if (result.affectedRows !== 1) throw invalidActivation();
      return { success: true as const };
    }),
  redeem: mutationProcedure
    .use(({ ctx, next }) => {
      limitAttempt(ctx, "redeem");
      return next();
    })
    .input(
      z.object({
        token: z.string().max(256, "Invalid or expired tester invitation."),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const church = await pilotChurch();
      const invite = await validatedInvite(church.id, input.token);
      if (!invite) throw invalidInvite();
      ctx.res.cookie(PILOT_COOKIE, input.token, {
        ...inviteCookieOptions,
        maxAge: Math.min(
          PILOT_SESSION_MS,
          invite.expiresAt.getTime() - Date.now()
        ),
      });
      return { success: true as const };
    }),
  leave: mutationProcedure.mutation(({ ctx }) => {
    ctx.res.clearCookie(PILOT_COOKIE, inviteCookieOptions);
    return { success: true as const };
  }),
  invites: ownerProcedure.query(async ({ ctx }) => {
    const db = await database();
    // Explicit projection: neither hashes nor bearer tokens leave this endpoint.
    const rows = await db
      .select({
        id: pilotInvites.id,
        label: pilotInvites.label,
        expiresAt: pilotInvites.expiresAt,
        revokedAt: pilotInvites.revokedAt,
        createdAt: pilotInvites.createdAt,
      })
      .from(pilotInvites)
      .where(eq(pilotInvites.churchId, ctx.church.id))
      .orderBy(desc(pilotInvites.createdAt));
    return rows.map(({ revokedAt, ...row }) => ({
      ...row,
      revoked: Boolean(revokedAt),
    }));
  }),
  createInvite: ownerMutation
    .input(z.object({ label: z.string().trim().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      const token = randomBytes(32).toString("hex");
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + PILOT_SESSION_MS);
      const [result] = await db.insert(pilotInvites).values({
        churchId: ctx.church.id,
        label: input.label,
        tokenHash: hashPilotSecret(token),
        createdAt,
        expiresAt,
      });
      return { id: result.insertId, token, expiresAt };
    }),
  setLaunched: ownerMutation
    .input(z.object({ open: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      await db
        .update(churches)
        .set({ launchedAt: input.open ? new Date() : null })
        .where(eq(churches.id, ctx.church.id));
      return { launched: input.open };
    }),
  revokeInvite: ownerMutation
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      await db
        .update(pilotInvites)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(pilotInvites.id, input.id),
            eq(pilotInvites.churchId, ctx.church.id)
          )
        );
      return { success: true as const };
    }),
});

export const bulletinRouter = router({
  workspace: ownerProcedure.query(async ({ ctx }) =>
    workspace(await database(), ctx.church)
  ),
  save: ownerMutation
    .input(
      z.object({ bulletin: bulletinSchema, revision: revisionSchema })
    )
    .mutation(async ({ ctx, input }) => {
      assertContentAllowed(ctx.church, input.bulletin);
      const db = await database();
      return db.transaction(async tx => {
        const [result] = await tx
          .update(churchBulletins)
          .set({
            draft: input.bulletin,
            revision: input.revision + 1,
            savedAt: new Date(),
          })
          .where(
            and(
              eq(churchBulletins.churchId, ctx.church.id),
              eq(churchBulletins.revision, input.revision)
            )
          );
        if (result.affectedRows !== 1) throw conflict();
        return workspace(tx, ctx.church);
      });
    }),
  publish: ownerMutation
    .input(z.object({ revision: revisionSchema }))
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      return db.transaction(async tx => {
        const [record] = await tx
          .select()
          .from(churchBulletins)
          .where(eq(churchBulletins.churchId, ctx.church.id))
          .limit(1)
          .for("update");
        if (!record || record.revision !== input.revision) throw conflict();
        const parsed = (
          isLaunched(ctx.church) ? bulletinSchema : pilotBulletinSchema
        ).safeParse(record.draft);
        if (!parsed.success)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "The saved draft is invalid. Correct and save it before publishing.",
          });
        const [result] = await tx
          .update(churchBulletins)
          .set({
            published: parsed.data,
            publishedAt: new Date(),
            revision: input.revision + 1,
          })
          .where(
            and(
              eq(churchBulletins.churchId, ctx.church.id),
              eq(churchBulletins.revision, input.revision)
            )
          );
        if (result.affectedRows !== 1) throw conflict();
        return workspace(tx, ctx.church);
      });
    }),
  importFromSheet: ownerMutation
    .input(z.object({ revision: revisionSchema }))
    .mutation(async ({ ctx, input }) => {
      if (!isLaunched(ctx.church))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Open LifeLine to the congregation before loading real content from the team sheet.",
        });
      let loaded;
      try {
        loaded = await loadWeekFromSheet();
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof SheetImportError
              ? error.message
              : "LifeLine couldn't reach the team sheet. Try again in a minute.",
        });
      }
      const db = await database();
      const result = await saveDraft(db, ctx.church, loaded.bulletin, input.revision);
      return { ...result, tab: loaded.tab, skipped: loaded.skipped };
    }),
  member: publicProcedure.query(async ({ ctx }) => {
    const church = await pilotChurch();
    if (!(await hasMemberAccess(ctx, church))) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "This pilot is restricted to the church owner and authorized testers.",
      });
    }
    const db = await database();
    const [record] = await db
      .select({
        bulletin: churchBulletins.published,
        publishedAt: churchBulletins.publishedAt,
      })
      .from(churchBulletins)
      .where(eq(churchBulletins.churchId, church.id))
      .limit(1);
    return {
      church: churchInfo(church),
      bulletin: record?.bulletin ?? null,
      publishedAt: record?.publishedAt ?? null,
    };
  }),
});

export const connectRouter = router({
  submit: mutationProcedure
    .use(({ ctx, next }) => {
      limitAttempt(ctx, "card");
      return next();
    })
    .input(cardInput)
    .mutation(async ({ ctx, input }) => {
      const church = await pilotChurch();
      if (!(await hasMemberAccess(ctx, church))) throw notAvailable();
      // Bots fill hidden fields; pretend success and store nothing.
      if (input.website) return { success: true as const };
      await recordCard(await database(), church.id, input);
      return { success: true as const };
    }),
  options: publicProcedure.query(() => ({ interests: CARD_INTERESTS })),
  inbox: ownerProcedure.query(async ({ ctx }) => {
    const db = await database();
    return {
      cards: await listCards(db, ctx.church.id),
      emailReady: messagingConfig.emailReady,
      smsReady: messagingConfig.smsReady,
      alertEmails: messagingConfig.alertEmails.length,
      alertPhones: messagingConfig.alertPhones.length,
      teamSheetUrl: `https://docs.google.com/spreadsheets/d/${teamSheetId()}/edit`,
    };
  }),
  unread: ownerProcedure.query(async ({ ctx }) =>
    unreadCount(await database(), ctx.church.id)
  ),
  markRead: ownerMutation
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await database();
      await db
        .update(connectionCards)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(connectionCards.id, input.id),
            eq(connectionCards.churchId, ctx.church.id),
            isNull(connectionCards.readAt)
          )
        );
      return { success: true as const };
    }),
});
