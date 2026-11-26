// POST /api/photos — upload a photo of a dish (multipart form). Held for approval.
import type { Config } from "@netlify/functions";
import { submissions, photoStore, json, newId, clean, titleFor, type Submission } from "../lib/shared.mts";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Bad upload" }, 400);
  }
  if (form.get("website")) return json({ ok: true });
  const file = form.get("photo");
  const slug = clean(form.get("slug"), 120);
  const name = clean(form.get("name"), 80);
  if (!(file instanceof Blob) || !slug || !name) return json({ error: "Please choose a recipe, a photo and your name" }, 400);
  if (file.size > MAX_BYTES) return json({ error: "That photo is too big (5 MB max)" }, 413);
  if (!TYPES.has(file.type)) return json({ error: "Please send a JPEG, PNG or WebP photo" }, 415);
  const recipeTitle = titleFor(slug);
  if (!recipeTitle) return json({ error: "Unknown recipe" }, 400);

  const id = newId("photo");
  await photoStore().set(id, await file.arrayBuffer(), { metadata: { contentType: file.type } });
  const item: Submission = {
    id, kind: "photo", slug, recipeTitle, caption: clean(form.get("caption"), 200), name,
    date: new Date().toISOString(), status: "pending", contentType: file.type,
  };
  await submissions().setJSON(id, item);
  return json({ ok: true, id }, 201);
};

export const config: Config = { path: "/api/photos" };
