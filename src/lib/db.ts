import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'raaga-study-companion';
let dbp: Promise<IDBPDatabase> | null = null;

function db() {
  dbp ??= openDB(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore('kv');
      d.createObjectStore('images');
    },
  });
  return dbp;
}

export const kvStorage = {
  getItem: async (name: string): Promise<string | null> => (await (await db()).get('kv', name)) ?? null,
  setItem: async (name: string, value: string): Promise<void> => { await (await db()).put('kv', value, name); },
  removeItem: async (name: string): Promise<void> => { await (await db()).delete('kv', name); },
};

export async function putImage(id: string, dataUrl: string) { await (await db()).put('images', dataUrl, id); }
export async function getImage(id: string): Promise<string | undefined> { return (await db()).get('images', id); }
export async function deleteImage(id: string) { await (await db()).delete('images', id); }
export async function allImages(): Promise<Record<string, string>> {
  const d = await db();
  const keys = (await d.getAllKeys('images')) as string[];
  const vals = await d.getAll('images');
  return Object.fromEntries(keys.map((k, i) => [k, vals[i]]));
}
export async function clearImages() { await (await db()).clear('images'); }
