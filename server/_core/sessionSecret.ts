import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { appSettings } from "../../drizzle/schema";
import { getDb } from "../db";

const NAME = "sessionSecret";

/**
 * Uses SESSION_SECRET when the host supplies one. Otherwise creates a random
 * signing key once, stores it server-side in the database, and reuses it on
 * every restart, so nobody has to generate or paste a secret by hand.
 */
export async function ensureSessionSecret() {
  if ((process.env.SESSION_SECRET ?? "").trim().length >= 32) return "environment";
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is required to create the session key.");
  await db
    .insert(appSettings)
    .ignore()
    .values({ name: NAME, value: randomBytes(48).toString("hex") });
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.name, NAME))
    .limit(1);
  if (!row || row.value.length < 32) throw new Error("Could not load the session key.");
  process.env.SESSION_SECRET = row.value;
  return "database";
}
