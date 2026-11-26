// GET /api/approved[?slug=] — approved family answers and photos for the site.
import type { Config } from "@netlify/functions";
import { allSubmissions, json } from "../lib/shared.mts";

export default async (req: Request) => {
  const slug = new URL(req.url).searchParams.get("slug");
  const items = (await allSubmissions()).filter((s) => s.status === "approved" && (!slug || s.slug === slug));
  return json(
    {
      answers: items.filter((s) => s.kind === "answer").map((s) => ({ slug: s.slug, name: s.name, answer: s.answer, date: s.date })),
      photos: items
        .filter((s) => s.kind === "photo")
        .map((s) => ({ id: s.id, slug: s.slug, recipeTitle: s.recipeTitle, name: s.name, caption: s.caption, url: `/api/photo/${s.id}` })),
    },
    200,
    { "cache-control": "private, max-age=60" },
  );
};

export const config: Config = { path: "/api/approved" };
