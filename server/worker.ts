import { eq } from "drizzle-orm";
import { CHURCH_SLUG } from "@shared/bulletin";
import { appSettings, churchBulletins, churches } from "../drizzle/schema";
import { saveDraft } from "./church";
import { getDb } from "./db";
import { churchClock, deliverDueMessages } from "./messaging";
import { loadWeekFromSheet, upcomingSunday } from "./sheetImport";

const AUTOLOAD_KEY = "sheetAutoloadedFor";
const RETRY_MS = 30 * 60 * 1000;
let lastAutoloadAttempt = 0;

async function setting(db: any, name: string) {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.name, name)).limit(1);
  return row?.value as string | undefined;
}
async function putSetting(db: any, name: string, value: string) {
  await db
    .insert(appSettings)
    .values({ name, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

/**
 * Friday from 1 PM (church time) through Saturday: load the upcoming Sunday's
 * tab into the draft once. Never publishes, and never overwrites a draft the
 * owner has already started for that Sunday.
 */
export async function autoloadFromSheet(now = new Date()) {
  const clock = churchClock(now);
  const inWindow = (clock.weekday === 5 && clock.hour >= 13) || clock.weekday === 6;
  if (!inWindow || now.getTime() - lastAutoloadAttempt < RETRY_MS) return "skipped";
  const db = await getDb();
  if (!db) return "skipped";
  const sunday = upcomingSunday(now);
  if ((await setting(db, AUTOLOAD_KEY)) === sunday) return "done";
  const [church] = await db.select().from(churches).where(eq(churches.slug, CHURCH_SLUG)).limit(1);
  if (!church?.launchedAt) return "skipped";
  lastAutoloadAttempt = now.getTime();
  const [record] = await db
    .select()
    .from(churchBulletins)
    .where(eq(churchBulletins.churchId, church.id))
    .limit(1);
  if (!record) return "skipped";
  if (record.draft.serviceDate === sunday) {
    await putSetting(db, AUTOLOAD_KEY, sunday); // owner already working on it
    return "kept";
  }
  const { bulletin } = await loadWeekFromSheet(sunday);
  await saveDraft(db, church, bulletin, record.revision);
  await putSetting(db, AUTOLOAD_KEY, sunday);
  console.log(`[worker] Loaded ${sunday} from the team sheet into the draft.`);
  return "loaded";
}

export function startWorker() {
  const tick = async () => {
    try {
      await deliverDueMessages();
    } catch (error) {
      console.error("[worker] delivery", error instanceof Error ? error.message : error);
    }
    try {
      await autoloadFromSheet();
    } catch (error) {
      console.error("[worker] sheet autoload", error instanceof Error ? error.message : error);
    }
  };
  const timer = setInterval(tick, 60 * 1000);
  timer.unref();
  setTimeout(tick, 5000).unref();
}
