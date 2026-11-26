import "dotenv/config";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, open, readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { churches, churchBulletins } from "../drizzle/schema";
import {
  CHURCH_SLUG,
  sampleBulletin,
  bulletinSchema,
} from "../shared/bulletin";

const SEED_VERSION = 1;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const keyPath = resolve(
  import.meta.dirname,
  "../../churchconnect-private/owner-activation-key.txt"
);

async function setupPilot() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  // The activation secret must stay outside the repository and all web-serving roots.
  const projectRoot = resolve(import.meta.dirname, "..");
  if (keyPath.startsWith(projectRoot + "/"))
    throw new Error("Activation key must be outside the web workspace.");
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);
  try {
    const [existing] = await db
      .select()
      .from(churches)
      .where(eq(churches.slug, CHURCH_SLUG))
      .limit(1);
    if (existing) {
      const [bulletin] = await db
        .select({ id: churchBulletins.id })
        .from(churchBulletins)
        .where(eq(churchBulletins.churchId, existing.id))
        .limit(1);
      if (!bulletin)
        throw new Error(
          "Existing pilot has no bulletin. Manual repair required; setup will not overwrite existing records."
        );
      console.log(
        `Pilot already set up (seed version ${existing.seedVersion}); no church, owner, invitation, draft or published changes made.`
      );
      return;
    }

    await mkdir(resolve(keyPath, ".."), { recursive: true });
    let activationKey: string;
    try {
      const handle = await open(keyPath, "wx", 0o600);
      try {
        activationKey = randomBytes(32).toString("hex");
        await handle.writeFile(`${activationKey}\n`, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      // Recover only the same private file after an interrupted setup; never rotate silently.
      const fileStat = await stat(keyPath);
      if ((fileStat.mode & 0o077) !== 0)
        throw new Error("Activation key file must be private (chmod 600).");
      activationKey = (await readFile(keyPath, "utf8")).trim();
      if (!/^[a-f0-9]{64}$/.test(activationKey))
        throw new Error(
          "Private activation file is invalid. Manual recovery required."
        );
    }
    const activationKeyHash = createHash("sha256")
      .update(activationKey)
      .digest("hex");
    const now = new Date();
    const activationExpiresAt = new Date(now.getTime() + SEVEN_DAYS_MS);
    const sample = bulletinSchema.parse({
      ...sampleBulletin,
      sampleData: true,
    });
    let created = false;
    await db.transaction(async tx => {
      // The unique slug plus transactional row lock serializes concurrent setup runs.
      await tx
        .insert(churches)
        .values({
          slug: CHURCH_SLUG,
          name: "WholeLife Community Church",
          location: "Totowa, NJ",
          serviceTime: "11:00 AM",
          activationKeyHash,
          activationExpiresAt,
          seedVersion: SEED_VERSION,
        })
        .onDuplicateKeyUpdate({ set: { slug: CHURCH_SLUG } });
      const [church] = await tx
        .select()
        .from(churches)
        .where(eq(churches.slug, CHURCH_SLUG))
        .limit(1)
        .for("update");
      if (!church) throw new Error("Pilot setup failed.");
      const [bulletin] = await tx
        .select({ id: churchBulletins.id })
        .from(churchBulletins)
        .where(eq(churchBulletins.churchId, church.id))
        .limit(1);
      if (!bulletin) {
        await tx.insert(churchBulletins).values({
          churchId: church.id,
          draft: sample,
          published: sample,
          revision: 1,
          savedAt: now,
          publishedAt: now,
        });
        created = true;
      }
    });
    console.log(
      created
        ? `Restricted pilot initialized with labeled sample draft and published snapshot (seed version ${SEED_VERSION}).`
        : "Pilot was initialized by another setup; no content overwritten."
    );
    console.log(`Private owner activation file: ${keyPath}`);
    console.log(
      `Activation expires after seven days; authenticated Manus ownership claim is required. Publishing remains tester-restricted and is not a public launch.`
    );
  } finally {
    await connection.end();
  }
}

setupPilot().catch(error => {
  // Never dump SQL parameter objects or secret-bearing driver errors.
  const safeMessages = [
    "Activation key must",
    "DATABASE_URL is required",
    "Existing pilot",
    "Activation key file",
    "Private activation file",
    "Pilot setup failed",
  ];
  const message = error instanceof Error ? error.message : "";
  console.error(
    safeMessages.some(prefix => message.startsWith(prefix))
      ? message
      : "Pilot setup failed. Check the database connection and migration; the private key has not been printed."
  );
  process.exitCode = 1;
});
