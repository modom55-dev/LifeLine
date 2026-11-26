import "dotenv/config";
import mysql from "mysql2/promise";
import { randomBytes, createHash } from "node:crypto";
import { writeFile, readFile, unlink } from "node:fs/promises";
const path = "/tmp/churchconnect-member-verification-private.json";
const c = await mysql.createConnection(process.env.DATABASE_URL!);
try {
  if (process.argv[2] === "cleanup") {
    const record = JSON.parse(await readFile(path, "utf8"));
    await c.execute(
      "UPDATE pilotInvites SET revokedAt = ? WHERE id = ? AND label = ?",
      [new Date(), record.id, "Automated member workflow verification"]
    );
    await unlink(path);
    console.log(
      "Temporary member verification invitation revoked; no owner or bulletin changed."
    );
  } else {
    const token = randomBytes(32).toString("hex");
    const hash = createHash("sha256").update(token).digest("hex");
    const [churches] = await c.execute<any[]>(
      "SELECT id FROM churches WHERE slug = ?",
      ["wholelife"]
    );
    const [r] = await c.execute<mysql.ResultSetHeader>(
      "INSERT INTO pilotInvites (churchId,label,tokenHash,createdAt,expiresAt) VALUES (?,?,?,?,?)",
      [
        churches[0].id,
        "Automated member workflow verification",
        hash,
        new Date(),
        new Date(Date.now() + 60 * 60 * 1000),
      ]
    );
    await writeFile(path, JSON.stringify({ id: r.insertId, token }), {
      mode: 0o600,
    });
    console.log(
      "Private temporary member fixture created for authorized app testing. It expires in one hour and will be revoked after verification."
    );
  }
} finally {
  await c.end();
}
