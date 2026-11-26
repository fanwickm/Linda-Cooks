// GET /api/photo/:id — serves an approved photo (or any photo, to the editor).
import type { Config, Context } from "@netlify/functions";
import { submissions, photoStore, isEditor, json, type Submission } from "../lib/shared.mts";

export default async (req: Request, context: Context) => {
  const id = context.params.id;
  if (!id || !/^photo-[a-z0-9-]+$/.test(id)) return json({ error: "Not found" }, 404);
  const meta = (await submissions().get(id, { type: "json" })) as Submission | null;
  const editor = isEditor(req);
  if (!meta || (meta.status !== "approved" && !editor)) return json({ error: "Not found" }, 404);
  const blob = await photoStore().get(id, { type: "arrayBuffer" });
  if (!blob) return json({ error: "Not found" }, 404);
  return new Response(blob, {
    headers: {
      "content-type": meta.contentType ?? "image/jpeg",
      "cache-control": editor ? "private, no-store" : "private, max-age=86400",
    },
  });
};

export const config: Config = { path: "/api/photo/:id" };
