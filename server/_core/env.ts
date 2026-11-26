// Server-only configuration, read at use time. Never serialize process.env to the browser.
const read = (key: string) => (process.env[key] ?? "").trim();

export const ENV = {
  /** Fixed session audience. Not a secret. */
  get appId() { return "lifeline"; },
  /** Long random string used to sign owner session cookies. */
  get cookieSecret() { return read("SESSION_SECRET"); },
  get databaseUrl() { return read("DATABASE_URL"); },
  /** Public HTTPS origin of this app, e.g. https://lifeline.example.org (no trailing slash). */
  get appUrl() { return read("APP_URL").replace(/\/+$/, ""); },
  get googleClientId() { return read("GOOGLE_CLIENT_ID"); },
  get googleClientSecret() { return read("GOOGLE_CLIENT_SECRET"); },
  /**
   * The one Google account allowed to activate the owner workspace while the
   * church is unclaimed. Set deliberately by the maintainer; never inferred.
   */
  get ownerEmail() { return read("OWNER_EMAIL").toLowerCase(); },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  // Legacy fields kept so unused starter helpers still type-check; they are not configured.
  get ownerOpenId() { return ""; },
  get forgeApiUrl() { return ""; },
  get forgeApiKey() { return ""; },
  get oAuthServerUrl() { return ""; },
};

export function googleRedirectUri() {
  return `${ENV.appUrl}/api/oauth/callback`;
}
