import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import { jwtVerify } from "jose";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { buildGoogleAuthUrl } from "./_core/google";
import { registerOAuthRoutes } from "./_core/oauth";
import { COOKIE_NAME, OAUTH_STATE_COOKIE } from "../shared/const";

const SECRET = "unit-test-signing-key-never-deployed-0123456789";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function withServer<T>(run: (base: string) => Promise<T>) {
  const app = express();
  registerOAuthRoutes(app);
  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

describe("self-hosted Google sign-in", () => {
  it("uses a distinct secure, HttpOnly, SameSite=Lax session cookie", () => {
    expect(COOKIE_NAME).toBe("webdev_app_session");
    expect(getSessionCookieOptions({ protocol: "http", headers: {} } as never)).toMatchObject({
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("refuses to sign sessions without a strong secret", async () => {
    vi.stubEnv("SESSION_SECRET", "short");
    await expect(
      sdk.signSession({ openId: "google:1", appId: "lifeline", name: "" })
    ).rejects.toThrow("SESSION_SECRET");
  });

  it("binds sessions to this app and rejects tampering", async () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const token = await sdk.signSession({ openId: "google:1", appId: "lifeline", name: "" });
    expect(await sdk.verifySession(token)).toMatchObject({ openId: "google:1" });
    expect(await sdk.verifySession(`${token.slice(0, -4)}abcd`)).toBeNull();
    const other = await sdk.signSession({ openId: "google:1", appId: "other-app", name: "" });
    expect(await sdk.verifySession(other)).toBeNull();
    vi.stubEnv("SESSION_SECRET", `${SECRET}-rotated`);
    expect(await sdk.verifySession(token)).toBeNull();
  });

  it("issues sessions that carry an issued-at time", async () => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    const token = await sdk.signSession({ openId: "google:1", appId: "lifeline", name: "" });
    await expect(
      jwtVerify(token, new TextEncoder().encode(SECRET), { maxTokenAge: "7d" })
    ).resolves.toBeDefined();
  });

  it("builds a Google authorization URL with only public parameters", () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-test.apps.googleusercontent.com");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "server-only-secret");
    const url = new URL(buildGoogleAuthUrl("state123", "https://app.example/api/oauth/callback"));
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("client-test.apps.googleusercontent.com");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe("state123");
    expect(url.toString()).not.toContain("server-only-secret");
  });

  it("start route sets a host-only state cookie and redirects to Google", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-test.apps.googleusercontent.com");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "server-only-secret");
    vi.stubEnv("APP_URL", "https://app.example/");
    vi.stubEnv("SESSION_SECRET", SECRET);
    await withServer(async base => {
      const res = await fetch(`${base}/api/auth/google/start`, { redirect: "manual" });
      expect(res.status).toBe(302);
      const location = new URL(res.headers.get("location")!);
      expect(location.hostname).toBe("accounts.google.com");
      expect(location.searchParams.get("redirect_uri")).toBe(
        "https://app.example/api/oauth/callback"
      );
      const cookie = res.headers.get("set-cookie")!;
      expect(cookie).toContain(`${OAUTH_STATE_COOKIE}=${location.searchParams.get("state")}`);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Secure/);
      expect(cookie).toMatch(/SameSite=Lax/);
      expect(cookie).not.toMatch(/Domain=/);
    });
  });

  it("start route refuses when Google is not configured", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    await withServer(async base => {
      const res = await fetch(`${base}/api/auth/google/start`, { redirect: "manual" });
      expect(res.status).toBe(503);
    });
  });

  it("callback rejects missing or mismatched state with 403", async () => {
    await withServer(async base => {
      const noCookie = await fetch(`${base}/api/oauth/callback?code=c&state=s`, {
        redirect: "manual",
      });
      expect(noCookie.status).toBe(403);
      const wrong = await fetch(`${base}/api/oauth/callback?code=c&state=s`, {
        redirect: "manual",
        headers: { cookie: `${OAUTH_STATE_COOKIE}=different` },
      });
      expect(wrong.status).toBe(403);
    });
  });

  it("callback returns cancelled sign-ins to the access page", async () => {
    await withServer(async base => {
      const res = await fetch(`${base}/api/oauth/callback?error=access_denied`, {
        redirect: "manual",
      });
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/access?signin=cancelled");
    });
  });
});
