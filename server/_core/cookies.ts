import type { CookieOptions, Request } from "express";

export function getSessionCookieOptions(_req: Request): CookieOptions {
  // First-party app (no iframe embedding), so Lax blocks cross-site use of the session.
  return { httpOnly: true, path: "/", sameSite: "lax", secure: true };
}
