import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import type { CookieOptions } from "express";

// Test-only module fixture: the actual router operates on a disposable church,
// never on WholeLife or its private owner activation key. No production auth bypass.
const fixture = vi.hoisted(() => ({
  slug: `cc-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
}));
vi.mock("@shared/bulletin", async importOriginal => {
  const actual = await importOriginal<typeof import("../shared/bulletin")>();
  return { ...actual, CHURCH_SLUG: fixture.slug };
});
import { sampleBulletin, type Bulletin } from "@shared/bulletin";
import {
  churches,
  churchBulletins,
  connectionCards,
  pilotInvites,
  users,
} from "../drizzle/schema";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { createContext, type TrpcContext } from "./_core/context";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { PILOT_COOKIE, PILOT_SESSION_MS, hashPilotSecret } from "./church";
import { COOKIE_NAME } from "../shared/const";

type CookieCall = { name: string; value?: string; options: CookieOptions };
type Caller = ReturnType<typeof appRouter.createCaller>;
let db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
let churchId: number;
const activationKey = randomBytes(32).toString("hex");
const openIds = [
  `${fixture.slug}-alice`,
  `${fixture.slug}-bob`,
  `${fixture.slug}-role-admin`,
];
let tokens: string[] = [];
let owner: Caller;
let outsider: Caller;
let ownerToken: string;
let tester: Caller;
let invitation: { id: number; token: string; expiresAt: Date };

async function request(
  options: {
    session?: string;
    cookie?: string;
    header?: boolean;
    ip?: string;
  } = {}
) {
  const cookieCalls: CookieCall[] = [];
  const req = {
    protocol: "https",
    path: "/api/trpc",
    ip: options.ip ?? "203.0.113.11",
    socket: { remoteAddress: options.ip ?? "203.0.113.11" },
    headers: {
      ...(options.header === false ? {} : { "x-churchconnect": "1" }),
      ...(options.session || options.cookie
        ? {
            cookie: [
              options.session ? `${COOKIE_NAME}=${options.session}` : "",
              options.cookie ?? "",
            ]
              .filter(Boolean)
              .join("; "),
          }
        : {}),
    },
  } as TrpcContext["req"];
  const res = {
    cookie(name: string, value: string, options: CookieOptions) {
      cookieCalls.push({ name, value, options });
    },
    clearCookie(name: string, options: CookieOptions) {
      cookieCalls.push({ name, options });
    },
  } as TrpcContext["res"];
  const ctx = await createContext({ req, res, info: {} as never });
  return { ctx, caller: appRouter.createCaller(ctx), cookieCalls };
}
const errorCode = (code: string) => ({ code });

beforeAll(async () => {
  const connection = await getDb();
  if (!connection || !ENV.cookieSecret || !ENV.appId)
    throw new Error(
      "Integration tests require managed MySQL and real SDK signing environment."
    );
  db = connection;
  const now = new Date();
  const [result] = await db
    .insert(churches)
    .values({
      slug: fixture.slug,
      name: "Disposable integration fixture",
      location: "Test only",
      serviceTime: "10:30 AM",
      activationKeyHash: hashPilotSecret(activationKey),
      activationExpiresAt: new Date(now.getTime() + PILOT_SESSION_MS),
      seedVersion: 1,
    });
  churchId = result.insertId;
  await db
    .insert(churchBulletins)
    .values({
      churchId,
      draft: sampleBulletin,
      published: sampleBulletin,
      revision: 1,
      savedAt: now,
      publishedAt: now,
    });
  await db
    .insert(users)
    .values(
      openIds.map((openId, index) => ({
        openId,
        name: index
          ? "Test admin, not church owner"
          : "Test ordinary Manus user",
        loginMethod: "manus",
        role: index ? ("admin" as const) : ("user" as const),
      }))
    );
  tokens = await Promise.all(
    openIds.map(openId =>
      sdk.createSessionToken(openId, {
        name: "Signed integration fixture",
        expiresInMs: 60_000 * 30,
      })
    )
  );
}, 30_000);

afterAll(async () => {
  if (db && churchId) {
    // Child rows cascade; fixture identities only, never real pilot users.
    await db.delete(churches).where(eq(churches.id, churchId));
    await db.delete(users).where(inArray(users.openId, openIds));
  }
});

describe.sequential(
  "restricted ChurchConnect pilot (signed SDK sessions + managed MySQL)",
  () => {
    it("public status exposes metadata only and first login does not claim ownership", async () => {
      const anonymous = await request();
      const status = await anonymous.caller.pilot.status();
      expect(status).toMatchObject({
        authenticated: false,
        isOwner: false,
        hasMemberAccess: false,
        ownerClaimed: false,
        userName: null,
        pilotRestricted: true,
      });
      expect(Object.keys(status).sort()).toEqual([
        "authenticated",
        "canActivateByEmail",
        "church",
        "hasMemberAccess",
        "isOwner",
        "launched",
        "ownerClaimed",
        "pilotRestricted",
        "userEmail",
        "userName",
      ]);
      expect(status).not.toHaveProperty("draft");
      expect(status.church).not.toHaveProperty("activationKeyHash");
      const signed = await request({ session: tokens[1] });
      expect(signed.ctx.user?.openId).toBe(openIds[1]);
      expect(await signed.caller.pilot.status()).toMatchObject({
        authenticated: true,
        isOwner: false,
        ownerClaimed: false,
      });
    });

    it("rejects unauthenticated, forged and wrong-project sessions", async () => {
      const anonymous = await request();
      await expect(
        anonymous.caller.pilot.claimOwner({ key: activationKey })
      ).rejects.toMatchObject(errorCode("UNAUTHORIZED"));
      await expect(anonymous.caller.bulletin.workspace()).rejects.toMatchObject(
        errorCode("UNAUTHORIZED")
      );
      await expect(anonymous.caller.bulletin.member()).rejects.toMatchObject(
        errorCode("FORBIDDEN")
      );
      const forged = await request({
        session: `${tokens[0].slice(0, -5)}xxxxx`,
      });
      expect(forged.ctx.user).toBeNull();
      await expect(
        forged.caller.pilot.claimOwner({ key: activationKey })
      ).rejects.toMatchObject(errorCode("UNAUTHORIZED"));
      const wrongProject = await sdk.signSession({
        openId: openIds[0],
        appId: `${ENV.appId}-wrong`,
        name: "Invalid project fixture",
      });
      const wrong = await request({ session: wrongProject });
      expect(wrong.ctx.user).toBeNull();
      await expect(wrong.caller.bulletin.workspace()).rejects.toMatchObject(
        errorCode("UNAUTHORIZED")
      );
      const expired = await sdk.createSessionToken(openIds[0], {
        expiresInMs: -1000,
      });
      expect((await request({ session: expired })).ctx.user).toBeNull();
    });

    it("requires the mutation header, and rejects invalid or expired activation keys generically", async () => {
      const noHeader = await request({ session: tokens[0], header: false });
      await expect(
        noHeader.caller.pilot.claimOwner({ key: activationKey })
      ).rejects.toMatchObject(errorCode("FORBIDDEN"));
      const caller = (await request({ session: tokens[0] })).caller;
      await expect(
        caller.pilot.claimOwner({ key: "bad-key" })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Invalid or expired activation key.",
      });
      await db
        .update(churches)
        .set({ activationExpiresAt: new Date(Date.now() - 1000) })
        .where(eq(churches.id, churchId));
      await expect(
        caller.pilot.claimOwner({ key: activationKey })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Invalid or expired activation key.",
      });
      await db
        .update(churches)
        .set({ activationExpiresAt: new Date(Date.now() + PILOT_SESSION_MS) })
        .where(eq(churches.id, churchId));
    });

    it("claims ownership atomically: two authenticated identities racing with the same key have one winner", async () => {
      const callers = await Promise.all(
        tokens
          .slice(0, 2)
          .map(async session => (await request({ session })).caller)
      );
      const attempts = await Promise.allSettled(
        callers.map(caller => caller.pilot.claimOwner({ key: activationKey }))
      );
      expect(
        attempts.filter(result => result.status === "fulfilled")
      ).toHaveLength(1);
      expect(
        attempts.filter(result => result.status === "rejected")
      ).toHaveLength(1);
      const [record] = await db
        .select()
        .from(churches)
        .where(eq(churches.id, churchId));
      expect(record.activationKeyHash).toBeNull();
      expect(record.activationExpiresAt).toBeNull();
      expect(record.ownerClaimedAt).toBeInstanceOf(Date);
      const ownerIndex = openIds.indexOf(record.ownerOpenId!);
      expect(ownerIndex).toBeGreaterThanOrEqual(0);
      owner = callers[ownerIndex];
      ownerToken = tokens[ownerIndex];
      outsider = callers[1 - ownerIndex];
      await expect(
        outsider.pilot.claimOwner({ key: activationKey })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Invalid or expired activation key.",
      });
      expect(await owner.pilot.status()).toMatchObject({
        isOwner: true,
        hasMemberAccess: true,
        ownerClaimed: true,
      });
    });

    it("rejects non-owner workspace, save, publish and invite operations regardless of role", async () => {
      await expect(outsider.bulletin.workspace()).rejects.toMatchObject(
        errorCode("FORBIDDEN")
      );
      await expect(
        outsider.bulletin.save({ bulletin: sampleBulletin, revision: 1 })
      ).rejects.toMatchObject(errorCode("FORBIDDEN"));
      await expect(
        outsider.bulletin.publish({ revision: 1 })
      ).rejects.toMatchObject(errorCode("FORBIDDEN"));
      await expect(outsider.pilot.invites()).rejects.toMatchObject(
        errorCode("FORBIDDEN")
      );
      await expect(
        outsider.pilot.createInvite({ label: "Not allowed" })
      ).rejects.toMatchObject(errorCode("FORBIDDEN"));
      await expect(
        outsider.pilot.revokeInvite({ id: 1 })
      ).rejects.toMatchObject(errorCode("FORBIDDEN"));
      // An admin role alone never grants access, even if the race winner was the admin.
      const roleOnly = await request({ session: tokens[2] });
      expect(roleOnly.ctx.user?.role).toBe("admin");
      await expect(roleOnly.caller.bulletin.workspace()).rejects.toMatchObject(
        errorCode("FORBIDDEN")
      );
    });

    it("issues hashed seven-day multi-use tester invitations and never returns hashes in listings", async () => {
      invitation = await owner.pilot.createInvite({
        label: "Authorized fixture tester",
      });
      expect(invitation.token).toMatch(/^[a-f0-9]{64}$/);
      expect(invitation.expiresAt.getTime() - Date.now()).toBeGreaterThan(
        PILOT_SESSION_MS - 5000
      );
      const [stored] = await db
        .select()
        .from(pilotInvites)
        .where(eq(pilotInvites.id, invitation.id));
      expect(stored.tokenHash).toBe(hashPilotSecret(invitation.token));
      expect(stored.tokenHash).not.toBe(invitation.token);
      const listed = await owner.pilot.invites();
      expect(listed[0]).toMatchObject({
        id: invitation.id,
        label: "Authorized fixture tester",
        revoked: false,
      });
      expect(Object.keys(listed[0]).sort()).toEqual([
        "createdAt",
        "expiresAt",
        "id",
        "label",
        "revoked",
      ]);
    });

    it("redeems without an account using a secure HttpOnly SameSite=Lax cookie and allows only published data", async () => {
      const anonymous = await request();
      expect(
        await anonymous.caller.pilot.redeem({ token: invitation.token })
      ).toEqual({ success: true });
      expect(anonymous.cookieCalls[0]).toMatchObject({
        name: PILOT_COOKIE,
        value: invitation.token,
        options: { secure: true, httpOnly: true, sameSite: "lax", path: "/" },
      });
      expect(anonymous.cookieCalls[0].options.maxAge).toBeLessThanOrEqual(
        PILOT_SESSION_MS
      );
      const secondDevice = await request({ ip: "203.0.113.12" });
      expect(
        await secondDevice.caller.pilot.redeem({ token: invitation.token })
      ).toEqual({ success: true });
      tester = (
        await request({ cookie: `${PILOT_COOKIE}=${invitation.token}` })
      ).caller;
      expect(await tester.pilot.status()).toMatchObject({
        isOwner: false,
        hasMemberAccess: true,
        ownerClaimed: true,
      });
      expect(await tester.bulletin.member()).toMatchObject({
        bulletin: sampleBulletin,
      });
      await expect(tester.bulletin.workspace()).rejects.toMatchObject(
        errorCode("UNAUTHORIZED")
      );
      await expect(
        tester.bulletin.save({ bulletin: sampleBulletin, revision: 1 })
      ).rejects.toMatchObject(errorCode("UNAUTHORIZED"));
    });

    it("saves durably with optimistic concurrency and isolates the draft from members", async () => {
      const initial = await owner.bulletin.workspace();
      const draft: Bulletin = {
        ...initial.draft,
        sermonTitle: "Saved fixture draft — not yet published",
      };
      const saved = await owner.bulletin.save({
        bulletin: draft,
        revision: initial.revision,
      });
      expect(saved.revision).toBe(initial.revision + 1);
      expect(saved.savedAt).toBeInstanceOf(Date);
      expect(saved.published).toEqual(initial.published);
      expect(saved.publishedAt).toEqual(initial.publishedAt);
      const fresh = (await request({ session: ownerToken })).caller;
      expect((await fresh.bulletin.workspace()).draft.sermonTitle).toBe(
        draft.sermonTitle
      );
      const [stored] = await db
        .select()
        .from(churchBulletins)
        .where(eq(churchBulletins.churchId, churchId));
      expect(stored.draft.sermonTitle).toBe(draft.sermonTitle);
      const member = await tester.bulletin.member();
      expect(member.bulletin?.sermonTitle).toBe(initial.published?.sermonTitle);
      expect(member).not.toHaveProperty("draft");
      await expect(
        owner.bulletin.save({
          bulletin: { ...draft, sermonTitle: "Stale overwrite" },
          revision: initial.revision,
        })
      ).rejects.toMatchObject(errorCode("CONFLICT"));
      expect((await fresh.bulletin.workspace()).draft.sermonTitle).toBe(
        draft.sermonTitle
      );
    });

    it("serializes racing saves so exactly one client wins without an overwritten update", async () => {
      const current = await owner.bulletin.workspace();
      const results = await Promise.allSettled(
        ["A", "B"].map(label =>
          owner.bulletin.save({
            bulletin: {
              ...current.draft,
              sermonTitle: `Concurrent fixture saved draft ${label}`,
            },
            revision: current.revision,
          })
        )
      );
      expect(
        results.filter(result => result.status === "fulfilled")
      ).toHaveLength(1);
      const rejected = results.find(
        result => result.status === "rejected"
      ) as PromiseRejectedResult;
      expect(rejected.reason).toMatchObject({ code: "CONFLICT" });
      const fresh = await owner.bulletin.workspace();
      expect(fresh.revision).toBe(current.revision + 1);
      const winner = results.find(
        result => result.status === "fulfilled"
      ) as PromiseFulfilledResult<typeof fresh>;
      expect(fresh.draft).toEqual(winner.value.draft);
      expect((await tester.bulletin.member()).bulletin).toEqual(
        current.published
      );
    });

    it("rejects insecure or credentialed URLs, invalid dates, and removal of pilot sample labeling", async () => {
      const current = await owner.bulletin.workspace();
      for (const givingUrl of [
        "javascript:alert(1)",
        "http://example.com",
        "https://user:password@example.com",
        "/relative",
      ]) {
        await expect(
          owner.bulletin.save({
            bulletin: { ...current.draft, givingUrl },
            revision: current.revision,
          })
        ).rejects.toMatchObject(errorCode("BAD_REQUEST"));
      }
      await expect(
        owner.bulletin.save({
          bulletin: {
            ...current.draft,
            livestreamUrl: "data:text/html,unsafe",
          },
          revision: current.revision,
        })
      ).rejects.toMatchObject(errorCode("BAD_REQUEST"));
      await expect(
        owner.bulletin.save({
          bulletin: { ...current.draft, serviceDate: "2026-02-30" },
          revision: current.revision,
        })
      ).rejects.toMatchObject(errorCode("BAD_REQUEST"));
      await expect(
        owner.bulletin.save({
          bulletin: { ...current.draft, sampleData: false },
          revision: current.revision,
        })
      ).rejects.toMatchObject(errorCode("BAD_REQUEST"));
      expect((await owner.bulletin.workspace()).revision).toBe(
        current.revision
      );
    });

    it("publishes only the saved draft atomically, increments revision, and never launches public access", async () => {
      const saved = await owner.bulletin.workspace();
      await expect(
        owner.bulletin.publish({ revision: saved.revision - 1 })
      ).rejects.toMatchObject(errorCode("CONFLICT"));
      const published = await owner.bulletin.publish({
        revision: saved.revision,
      });
      expect(published.published).toEqual(saved.draft);
      expect(published.revision).toBe(saved.revision + 1);
      expect(published.savedAt).toEqual(saved.savedAt);
      expect(published.publishedAt).toBeInstanceOf(Date);
      expect((await tester.bulletin.member()).bulletin).toEqual(saved.draft);
      expect(await owner.pilot.status()).toMatchObject({
        pilotRestricted: true,
      });
      await expect(
        (await request()).caller.bulletin.member()
      ).rejects.toMatchObject(errorCode("FORBIDDEN"));
    });

    it("rejects an invalid persisted draft at publish time", async () => {
      const current = await owner.bulletin.workspace();
      await db
        .update(churchBulletins)
        .set({
          draft: { ...current.draft, livestreamUrl: "http://unsafe.example" },
        })
        .where(eq(churchBulletins.churchId, churchId));
      await expect(
        owner.bulletin.publish({ revision: current.revision })
      ).rejects.toMatchObject(errorCode("BAD_REQUEST"));
      expect((await tester.bulletin.member()).bulletin).toEqual(
        current.published
      );
      await db
        .update(churchBulletins)
        .set({ draft: current.draft })
        .where(eq(churchBulletins.churchId, churchId));
    });

    it("invalidates existing tester cookies immediately on revocation and rejects expired invitations", async () => {
      expect(await owner.pilot.revokeInvite({ id: invitation.id })).toEqual({
        success: true,
      });
      expect(await tester.pilot.status()).toMatchObject({
        hasMemberAccess: false,
      });
      await expect(tester.bulletin.member()).rejects.toMatchObject(
        errorCode("FORBIDDEN")
      );
      await expect(
        (await request()).caller.pilot.redeem({ token: invitation.token })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Invalid or expired tester invitation.",
      });
      expect(
        (await owner.pilot.invites()).find(item => item.id === invitation.id)
          ?.revoked
      ).toBe(true);
      const expired = await owner.pilot.createInvite({
        label: "Expired fixture",
      });
      await db
        .update(pilotInvites)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(pilotInvites.id, expired.id));
      await expect(
        (await request()).caller.pilot.redeem({ token: expired.token })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Invalid or expired tester invitation.",
      });
      const expiredCookie = await request({
        cookie: `${PILOT_COOKIE}=${expired.token}`,
      });
      await expect(
        expiredCookie.caller.bulletin.member()
      ).rejects.toMatchObject(errorCode("FORBIDDEN"));
    });

    it("does not accept or revoke another church's tester invitation", async () => {
      const [church] = await db
        .insert(churches)
        .values({
          slug: `${fixture.slug}-other`,
          name: "Other disposable church",
          location: "Test only",
          serviceTime: "10:30 AM",
        });
      try {
        const token = randomBytes(32).toString("hex");
        const [invite] = await db
          .insert(pilotInvites)
          .values({
            churchId: church.insertId,
            label: "Other church fixture",
            tokenHash: hashPilotSecret(token),
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + PILOT_SESSION_MS),
          });
        await expect(
          (await request()).caller.pilot.redeem({ token })
        ).rejects.toMatchObject(errorCode("FORBIDDEN"));
        await expect(
          (
            await request({ cookie: `${PILOT_COOKIE}=${token}` })
          ).caller.bulletin.member()
        ).rejects.toMatchObject(errorCode("FORBIDDEN"));
        expect(await owner.pilot.revokeInvite({ id: invite.insertId })).toEqual(
          { success: true }
        );
        const [stored] = await db
          .select()
          .from(pilotInvites)
          .where(eq(pilotInvites.id, invite.insertId));
        expect(stored.revokedAt).toBeNull();
        expect(
          (await owner.pilot.invites()).some(
            item => item.id === invite.insertId
          )
        ).toBe(false);
      } finally {
        await db.delete(churches).where(eq(churches.id, church.insertId));
      }
    });

    it("requires x-churchconnect on every mutation, including leaving and auth logout", async () => {
      const caller = (await request({ session: ownerToken, header: false }))
        .caller;
      const current = await owner.bulletin.workspace();
      for (const operation of [
        () =>
          caller.bulletin.save({
            bulletin: current.draft,
            revision: current.revision,
          }),
        () => caller.bulletin.publish({ revision: current.revision }),
        () => caller.pilot.createInvite({ label: "No header" }),
        () => caller.pilot.revokeInvite({ id: invitation.id }),
        () => caller.pilot.redeem({ token: invitation.token }),
        () => caller.pilot.leave(),
        () => caller.auth.logout(),
      ])
        await expect(operation()).rejects.toMatchObject(errorCode("FORBIDDEN"));
      const leave = await request();
      expect(await leave.caller.pilot.leave()).toEqual({ success: true });
      expect(leave.cookieCalls[0]).toMatchObject({
        name: PILOT_COOKIE,
        options: { path: "/", secure: true, httpOnly: true, sameSite: "lax" },
      });
      const logout = await request({ session: ownerToken });
      expect(await logout.caller.auth.logout()).toEqual({ success: true });
      expect(logout.cookieCalls).toHaveLength(1);
    });

    it("rate-limits redemption and ownership attempts with separate bounded expiring buckets", async () => {
      const redemption = (await request({ ip: "203.0.113.200" })).caller;
      for (let index = 0; index < 20; index++)
        await expect(
          redemption.pilot.redeem({ token: "invalid" })
        ).rejects.toMatchObject(errorCode("FORBIDDEN"));
      await expect(
        redemption.pilot.redeem({ token: "invalid" })
      ).rejects.toMatchObject(errorCode("TOO_MANY_REQUESTS"));
      const claim = (
        await request({ session: ownerToken, ip: "203.0.113.201" })
      ).caller;
      for (let index = 0; index < 10; index++)
        await expect(
          claim.pilot.claimOwner({ key: "invalid" })
        ).rejects.toMatchObject(errorCode("FORBIDDEN"));
      await expect(
        claim.pilot.claimOwner({ key: "invalid" })
      ).rejects.toMatchObject(errorCode("TOO_MANY_REQUESTS"));
    });

    it("lets only the configured, Google-verified owner email activate an unclaimed church without a key", async () => {
      const [before] = await db
        .select({ ownerOpenId: churches.ownerOpenId, ownerClaimedAt: churches.ownerClaimedAt })
        .from(churches)
        .where(eq(churches.id, churchId));
      const ownerEmail = `${fixture.slug}@example.org`;
      try {
        await db
          .update(churches)
          .set({ ownerOpenId: null, ownerClaimedAt: null })
          .where(eq(churches.id, churchId));
        await db
          .update(users)
          .set({ email: ownerEmail, loginMethod: "google" })
          .where(eq(users.openId, openIds[1]));
        await db
          .update(users)
          .set({ email: `other-${ownerEmail}`, loginMethod: "google" })
          .where(eq(users.openId, openIds[0]));

        // No OWNER_EMAIL configured: nobody can claim without a key.
        vi.stubEnv("OWNER_EMAIL", "");
        const unconfigured = await request({ session: tokens[1], ip: "203.0.113.90" });
        expect((await unconfigured.caller.pilot.status()).canActivateByEmail).toBe(false);
        await expect(unconfigured.caller.pilot.claimOwner({})).rejects.toMatchObject(
          errorCode("FORBIDDEN")
        );

        vi.stubEnv("OWNER_EMAIL", ownerEmail.toUpperCase());
        const other = await request({ session: tokens[0], ip: "203.0.113.91" });
        expect((await other.caller.pilot.status()).canActivateByEmail).toBe(false);
        await expect(other.caller.pilot.claimOwner({})).rejects.toMatchObject(
          errorCode("FORBIDDEN")
        );
        const anonymous = await request({ ip: "203.0.113.92" });
        await expect(anonymous.caller.pilot.claimOwner({})).rejects.toMatchObject(
          errorCode("UNAUTHORIZED")
        );

        const configured = await request({ session: tokens[1], ip: "203.0.113.93" });
        expect(await configured.caller.pilot.status()).toMatchObject({
          canActivateByEmail: true,
          userEmail: ownerEmail,
        });
        expect(await configured.caller.pilot.claimOwner({})).toEqual({ success: true });
        const [after] = await db.select().from(churches).where(eq(churches.id, churchId));
        expect(after.ownerOpenId).toBe(openIds[1]);
        // Already claimed: a second activation (even by the same email) changes nothing.
        await expect(configured.caller.pilot.claimOwner({})).rejects.toMatchObject(
          errorCode("FORBIDDEN")
        );

        // A non-Google login method with the same address is never trusted.
        await db
          .update(churches)
          .set({ ownerOpenId: null, ownerClaimedAt: null })
          .where(eq(churches.id, churchId));
        await db.update(users).set({ loginMethod: "manus" }).where(eq(users.openId, openIds[1]));
        const nonGoogle = await request({ session: tokens[1], ip: "203.0.113.94" });
        await expect(nonGoogle.caller.pilot.claimOwner({})).rejects.toMatchObject(
          errorCode("FORBIDDEN")
        );
      } finally {
        vi.unstubAllEnvs();
        await db
          .update(churches)
          .set({ ownerOpenId: before.ownerOpenId, ownerClaimedAt: before.ownerClaimedAt })
          .where(eq(churches.id, churchId));
      }
    });

    it("keeps cards and real content closed until the owner opens LifeLine, then allows both", async () => {
      const owner = (await request({ session: ownerToken, ip: "203.0.113.120" })).caller;
      const anonymous = (await request({ ip: "203.0.113.121" })).caller;
      const card = {
        name: "Test Guest",
        email: "guest@example.org",
        phone: "",
        firstTime: true,
        interests: ["Prayer" as const],
        prayerRequest: "",
        followUpOk: false,
      };
      const workspace = await owner.bulletin.workspace();
      const real = { ...workspace.draft, sampleData: false };
      try {
        expect((await anonymous.pilot.status()).hasMemberAccess).toBe(false);
        await expect(anonymous.connect.submit(card)).rejects.toMatchObject(errorCode("FORBIDDEN"));
        await expect(
          owner.bulletin.save({ bulletin: real, revision: workspace.revision })
        ).rejects.toMatchObject(errorCode("BAD_REQUEST"));
        await expect(anonymous.pilot.setLaunched({ open: true })).rejects.toMatchObject(
          errorCode("UNAUTHORIZED")
        );

        expect(await owner.pilot.setLaunched({ open: true })).toEqual({ launched: true });
        const status = await anonymous.pilot.status();
        expect(status).toMatchObject({ launched: true, hasMemberAccess: true, pilotRestricted: false });
        expect((await anonymous.bulletin.member()).church.id).toBe(churchId);
        expect(await anonymous.connect.submit(card)).toEqual({ success: true });
        // Honeypot submissions are accepted silently but never stored.
        const before = (await owner.connect.inbox()).cards.length;
        await anonymous.connect.submit({ ...card, website: "spam" });
        expect((await owner.connect.inbox()).cards.length).toBe(before);
        await expect(anonymous.connect.inbox()).rejects.toMatchObject(errorCode("UNAUTHORIZED"));
        const saved = await owner.bulletin.save({ bulletin: real, revision: workspace.revision });
        expect(saved.draft.sampleData).toBe(false);
        expect(await owner.connect.unread()).toBeGreaterThan(0);
      } finally {
        await owner.pilot.setLaunched({ open: false });
        await db.delete(connectionCards).where(eq(connectionCards.churchId, churchId));
      }
    });
  }
);
