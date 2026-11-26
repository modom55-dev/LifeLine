import {
  datetime,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  index,
} from "drizzle-orm/mysql-core";
import type { Bulletin } from "../shared/bulletin";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// No role fallback: the authenticated Manus openId must match this exact owner.
export const churches = mysqlTable("churches", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  name: varchar("name", { length: 180 }).notNull(),
  location: varchar("location", { length: 180 }).notNull(),
  serviceTime: varchar("serviceTime", { length: 40 }).notNull(),
  ownerOpenId: varchar("ownerOpenId", { length: 64 }),
  activationKeyHash: varchar("activationKeyHash", { length: 64 }),
  activationExpiresAt: datetime("activationExpiresAt", {
    mode: "date",
    fsp: 3,
  }),
  ownerClaimedAt: datetime("ownerClaimedAt", { mode: "date", fsp: 3 }),
  seedVersion: int("seedVersion").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const churchBulletins = mysqlTable("churchBulletins", {
  id: int("id").autoincrement().primaryKey(),
  churchId: int("churchId")
    .notNull()
    .unique()
    .references(() => churches.id, { onDelete: "cascade" }),
  draft: json("draft").$type<Bulletin>().notNull(),
  published: json("published").$type<Bulletin>(),
  revision: int("revision").default(1).notNull(),
  savedAt: datetime("savedAt", { mode: "date", fsp: 3 }).notNull(),
  publishedAt: datetime("publishedAt", { mode: "date", fsp: 3 }),
});

export const pilotInvites = mysqlTable(
  "pilotInvites",
  {
    id: int("id").autoincrement().primaryKey(),
    churchId: int("churchId")
      .notNull()
      .references(() => churches.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 120 }).notNull(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
    expiresAt: datetime("expiresAt", { mode: "date", fsp: 3 }).notNull(),
    revokedAt: datetime("revokedAt", { mode: "date", fsp: 3 }),
    createdAt: datetime("createdAt", { mode: "date", fsp: 3 }).notNull(),
  },
  table => [index("pilotInvites_churchId_idx").on(table.churchId)]
);

// Server-generated settings (e.g. the session-signing key when SESSION_SECRET is
// not supplied). Never exposed through any API.
export const appSettings = mysqlTable("appSettings", {
  name: varchar("name", { length: 64 }).primaryKey(),
  value: varchar("value", { length: 256 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
