import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { randomBytes, timingSafeEqual } from "node:crypto";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV, googleRedirectUri } from "./env";
import { buildGoogleAuthUrl, verifyGoogleCode } from "./google";
import { sdk } from "./sdk";

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function sameSecret(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function stateCookieOptions() {
  // __Host- prefix requires Secure, Path=/ and no Domain. Lax is enough because
  // Google returns the browser with a top-level GET navigation.
  return { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
}

export function googleConfigured() {
  return Boolean(
    ENV.googleClientId && ENV.googleClientSecret && ENV.appUrl && ENV.cookieSecret
  );
}

export function registerOAuthRoutes(app: Express) {
  // Begin Google sign-in. The state nonce is minted server-side and bound to
  // this browser with a host-only cookie, so the callback can reject forged or
  // replayed redirects.
  app.get("/api/auth/google/start", (_req: Request, res: Response) => {
    if (!googleConfigured()) {
      res.status(503).send("Google sign-in is not configured on this server yet.");
      return;
    }
    const state = randomBytes(32).toString("hex");
    res.cookie(OAUTH_STATE_COOKIE, state, {
      ...stateCookieOptions(),
      maxAge: STATE_MAX_AGE_MS,
    });
    res.redirect(302, buildGoogleAuthUrl(state, googleRedirectUri()));
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const expected = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE, stateCookieOptions());

    if (getQueryParam(req, "error")) {
      res.redirect(302, "/access?signin=cancelled");
      return;
    }
    if (!code || !state || !expected || !sameSecret(state, expected)) {
      res.status(403).send("Sign-in could not be verified. Please start again from LifeLine.");
      return;
    }

    try {
      const identity = await verifyGoogleCode(code, googleRedirectUri());
      const openId = `google:${identity.sub}`;
      await db.upsertUser({
        openId,
        name: identity.name || null,
        // Only a Google-verified address is ever stored or used for ownership.
        email: identity.emailVerified ? identity.email : null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });
      const sessionToken = await sdk.createSessionToken(openId, {
        name: identity.name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });
      res.redirect(302, "/");
    } catch (error) {
      console.error(
        "[OAuth] Google callback failed",
        error instanceof Error ? error.message : "unknown error"
      );
      res.status(500).send("Google sign-in failed. Please try again.");
    }
  });
}
