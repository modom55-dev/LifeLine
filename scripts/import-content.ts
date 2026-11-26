// One-time import of the LifeLine content export into a NEW, empty database.
// Usage: DATABASE_URL=... pnpm tsx scripts/import-content.ts data/wholelife-current-bulletin.json
//
// - Never overwrites: if the church already exists, it exits without changes.
// - Imports church identity plus draft/published snapshots and revision only.
// - Creates no owner, key or invitation. Ownership is activated in the app by
//   the Google account named in OWNER_EMAIL.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { z } from "zod";
import { churches, churchBulletins } from "../drizzle/schema";
import { CHURCH_SLUG, bulletinSchema } from "../shared/bulletin";

const exportSchema = z.object({
  formatVersion: z.literal(1),
  church: z.object({
    slug: z.literal(CHURCH_SLUG),
    name: z.string().min(1).max(180),
    location: z.string().min(1).max(180),
    serviceTime: z.string().min(1).max(40),
  }),
  bulletin: z.object({
    draft: bulletinSchema,
    published: bulletinSchema.nullable(),
    revision: z.number().int().min(1),
    savedAt: z.string().datetime(),
    publishedAt: z.string().datetime().nullable(),
  }),
});

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Pass the export JSON path.");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const data = exportSchema.parse(JSON.parse(await readFile(file, "utf8")));

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);
  try {
    const [existing] = await db
      .select({ id: churches.id })
      .from(churches)
      .where(eq(churches.slug, CHURCH_SLUG))
      .limit(1);
    if (existing) {
      console.log("Church already exists; nothing imported and nothing changed.");
      return;
    }
    await db.transaction(async tx => {
      const [inserted] = await tx.insert(churches).values({
        slug: data.church.slug,
        name: data.church.name,
        location: data.church.location,
        serviceTime: data.church.serviceTime,
        ownerOpenId: null,
        activationKeyHash: null,
        activationExpiresAt: null,
      });
      await tx.insert(churchBulletins).values({
        churchId: inserted.insertId,
        draft: data.bulletin.draft,
        published: data.bulletin.published,
        revision: data.bulletin.revision,
        savedAt: new Date(data.bulletin.savedAt),
        publishedAt: data.bulletin.publishedAt ? new Date(data.bulletin.publishedAt) : null,
      });
    });
    console.log(
      `Imported ${data.church.name} (revision ${data.bulletin.revision}). Owner is unclaimed until OWNER_EMAIL signs in and activates.`
    );
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
