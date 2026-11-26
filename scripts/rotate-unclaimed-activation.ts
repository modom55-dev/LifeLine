import "dotenv/config";
import mysql from "mysql2/promise";
import { randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";
const directory = resolve(import.meta.dirname, "../../churchconnect-private");
const target = resolve(directory, "owner-activation-key.txt");
const old = resolve(import.meta.dirname, "../docs/owner-activation-key.txt");
const c = await mysql.createConnection(process.env.DATABASE_URL!);
try {
  const [rows] = await c.execute<any[]>(
    "SELECT ownerOpenId FROM churches WHERE slug = ?",
    ["wholelife"]
  );
  if (!rows.length || rows[0].ownerOpenId)
    throw new Error("Rotation is only allowed for an unclaimed pilot.");
  const key = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(key).digest("hex");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(target + ".tmp", key + "\n", { mode: 0o600 });
  const [result] = await c.execute<mysql.ResultSetHeader>(
    "UPDATE churches SET activationKeyHash = ?, activationExpiresAt = ? WHERE slug = ? AND ownerOpenId IS NULL",
    [hash, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "wholelife"]
  );
  if (result.affectedRows !== 1)
    throw new Error("Owner claim changed; rotation aborted.");
  await rename(target + ".tmp", target);
  await unlink(old).catch(() => {});
  console.log(
    "Unclaimed activation key rotated. The old key is invalid. Private delivery file is outside the web workspace: " +
      target
  );
} finally {
  await c.end();
}
