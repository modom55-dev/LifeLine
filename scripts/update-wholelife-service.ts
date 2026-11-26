import "dotenv/config";
import mysql from "mysql2/promise";
import assert from "node:assert/strict";

// Explicit owner instruction, November 26, 2026: Sunday worship is 11:00 AM.
// Correct the current snapshots without copying a draft into published content.
const time = "11:00 AM";
const db = await mysql.createConnection(process.env.DATABASE_URL!);
function content(value: unknown): Record<string, unknown> | null {
  if (value === null) return null;
  return typeof value === "string"
    ? JSON.parse(value)
    : (value as Record<string, unknown>);
}
function withoutTime(value: Record<string, unknown> | null) {
  if (value === null) return null;
  const { serviceTime: _, ...rest } = value;
  return rest;
}
try {
  await db.beginTransaction();
  const [churches] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT id, serviceTime FROM churches WHERE slug = ? FOR UPDATE",
    ["wholelife"]
  );
  assert.equal(churches.length, 1, "Expected exactly one WholeLife pilot.");
  const church = churches[0];
  const [records] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT id, draft, published, revision FROM churchBulletins WHERE churchId = ? FOR UPDATE",
    [church.id]
  );
  assert.equal(
    records.length,
    1,
    "Expected the existing bulletin; never reseed here."
  );
  const before = records[0];
  const draft = content(before.draft)!;
  const published = content(before.published);
  const snapshotsChanged =
    draft.serviceTime !== time ||
    (published !== null && published.serviceTime !== time);
  if (church.serviceTime !== time) {
    await db.execute("UPDATE churches SET serviceTime = ? WHERE id = ?", [
      time,
      church.id,
    ]);
  }
  if (snapshotsChanged) {
    const now = new Date();
    await db.execute(
      "UPDATE churchBulletins SET draft = JSON_SET(draft, '$.serviceTime', ?), published = IF(published IS NULL, NULL, JSON_SET(published, '$.serviceTime', ?)), revision = revision + 1, savedAt = ?, publishedAt = IF(published IS NULL, publishedAt, ?) WHERE id = ?",
      [time, time, now, now, before.id]
    );
  }
  const [updated] = await db.execute<mysql.RowDataPacket[]>(
    "SELECT draft, published, revision FROM churchBulletins WHERE id = ?",
    [before.id]
  );
  const afterDraft = content(updated[0].draft)!;
  const afterPublished = content(updated[0].published);
  assert.equal(afterDraft.serviceTime, time);
  if (afterPublished) assert.equal(afterPublished.serviceTime, time);
  assert.deepEqual(
    withoutTime(afterDraft),
    withoutTime(draft),
    "Other draft content must remain unchanged."
  );
  assert.deepEqual(
    withoutTime(afterPublished),
    withoutTime(published),
    "Other published content must remain unchanged."
  );
  assert.equal(
    updated[0].revision,
    before.revision + (snapshotsChanged ? 1 : 0)
  );
  await db.commit();
  console.log(
    JSON.stringify({
      serviceTime: time,
      bulletinRevision: updated[0].revision,
      changed: church.serviceTime !== time || snapshotsChanged,
      otherBulletinContentPreserved: true,
    })
  );
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.end();
}
