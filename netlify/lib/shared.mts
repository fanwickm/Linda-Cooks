// Shared helpers for the family-submission functions (Netlify Blobs storage).
import { getStore } from "@netlify/blobs";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export type Status = "pending" | "approved" | "rejected";
export interface Submission {
  id: string;
  kind: "answer" | "photo";
  slug: string;
  recipeTitle?: string;
  question?: string;
  answer?: string;
  caption?: string;
  name: string;
  date: string;
  status: Status;
  contentType?: string;
}

export const submissions = () => getStore({ name: "submissions", consistency: "strong" });
export const photoStore = () => getStore({ name: "photos", consistency: "strong" });

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function clean(s: unknown, max: number): string {
  return String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
}

/** Timing-safe-ish string compare. */
export function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function isEditor(req: Request): boolean {
  const pw = process.env.EDITOR_PASSWORD ?? "";
  const url = new URL(req.url);
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const token = header || url.searchParams.get("token") || "";
  return sameSecret(token, pw);
}

export async function allSubmissions(): Promise<Submission[]> {
  const store = submissions();
  const { blobs } = await store.list();
  const items = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }) as Promise<Submission | null>));
  return items.filter((x): x is Submission => !!x).sort((a, b) => b.date.localeCompare(a.date));
}

// ---- recipe data (bundled with the functions via included_files in netlify.toml) ----
export interface RecipeLite { slug: string; title: string; [k: string]: unknown }
let cache: RecipeLite[] | null = null;
export function loadRecipes(): RecipeLite[] {
  if (cache) return cache;
  const candidates = [resolve(process.cwd(), "src/data/recipes"), resolve(process.cwd(), "../src/data/recipes")];
  for (const dir of candidates) {
    try {
      cache = readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(readFileSync(resolve(dir, f), "utf8")))
        .sort((a, b) => a.order - b.order);
      return cache!;
    } catch {
      /* try next */
    }
  }
  cache = [];
  return cache;
}
export function titleFor(slug: string): string | undefined {
  if (slug === "linda" || slug === "linda-story") return "Linda (Meet Linda page)";
  if (slug === "original-card") return "An original recipe card";
  return loadRecipes().find((r) => r.slug === slug)?.title;
}
