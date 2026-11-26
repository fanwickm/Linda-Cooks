// /api/editor — the editor (Lyle) lists submissions and approves or rejects them.
// Protected by the EDITOR_PASSWORD environment variable.
import type { Config } from "@netlify/functions";
import { allSubmissions, submissions, isEditor, json, type Submission } from "../lib/shared.mts";

export default async (req: Request) => {
  if (!process.env.EDITOR_PASSWORD) return json({ error: "EDITOR_PASSWORD is not set on this site" }, 503);
  if (!isEditor(req)) return json({ error: "Unauthorized" }, 401);

  if (req.method === "GET") {
    const items = await allSubmissions();
    return json({ items: items.map((s) => (s.kind === "photo" ? { ...s, url: `/api/photo/${s.id}` } : s)) });
  }
  if (req.method === "POST") {
    const { id, status } = (await req.json().catch(() => ({}))) as { id?: string; status?: string };
    if (!id || !["pending", "approved", "rejected"].includes(status ?? "")) return json({ error: "Bad request" }, 400);
    const store = submissions();
    const item = (await store.get(id, { type: "json" })) as Submission | null;
    if (!item) return json({ error: "Not found" }, 404);
    item.status = status as Submission["status"];
    await store.setJSON(id, item);
    return json({ ok: true });
  }
  return json({ error: "Method not allowed" }, 405);
};

export const config: Config = { path: "/api/editor" };
