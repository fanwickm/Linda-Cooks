// POST /api/answers — a family member answers an open question. Stored as
// "pending" until the editor approves it on /editor.
import type { Config } from "@netlify/functions";
import { submissions, json, newId, clean, titleFor, type Submission } from "../lib/shared.mts";

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  if (body.website) return json({ ok: true }); // honeypot: quietly drop bots
  const slug = clean(body.slug, 120);
  const answer = clean(body.answer, 4000);
  const name = clean(body.name, 80);
  if (!slug || !answer || !name) return json({ error: "Please fill in your answer and your name" }, 400);
  const recipeTitle = titleFor(slug);
  if (!recipeTitle) return json({ error: "Unknown recipe" }, 400);
  const item: Submission = {
    id: newId("answer"), kind: "answer", slug, recipeTitle,
    question: clean(body.question, 1000), answer, name,
    date: new Date().toISOString(), status: "pending",
  };
  await submissions().setJSON(item.id, item);
  return json({ ok: true, id: item.id }, 201);
};

export const config: Config = { path: "/api/answers" };
