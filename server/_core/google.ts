import { createRemoteJWKSet, jwtVerify } from "jose";
import { AXIOS_TIMEOUT_MS } from "@shared/const";
import { ENV } from "./env";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export type GoogleIdentity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

export function buildGoogleAuthUrl(state: string, redirectUri: string) {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", ENV.googleClientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

/** Exchanges the one-time code server-side and verifies Google's signed ID token. */
export async function verifyGoogleCode(
  code: string,
  redirectUri: string
): Promise<GoogleIdentity> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(AXIOS_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Google token exchange failed (${response.status})`);
  const tokens = (await response.json()) as { id_token?: unknown };
  if (typeof tokens.id_token !== "string") throw new Error("Google returned no ID token");

  const { payload } = await jwtVerify(tokens.id_token, jwks, {
    issuer: GOOGLE_ISSUERS,
    audience: ENV.googleClientId,
  });
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("ID token missing subject");
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  return {
    sub: payload.sub,
    email,
    emailVerified: payload.email_verified === true && Boolean(email),
    name: typeof payload.name === "string" ? payload.name : null,
  };
}
