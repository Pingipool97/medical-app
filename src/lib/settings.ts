import 'server-only';
import { db } from './db';

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.systemSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown) {
  await db.systemSetting.upsert({
    where: { key },
    update: { value: JSON.stringify(value) },
    create: { key, value: JSON.stringify(value) },
  });
}

export async function flagEnabled(key: string): Promise<boolean> {
  const f = await db.featureFlag.findUnique({ where: { key } });
  return f?.enabled ?? false;
}
