// /api/ask — "Ask Linda's Kitchen": answers questions using only the cookbook.
//
// OFF by default. To switch it on, set these in Netlify → Site configuration →
// Environment variables, then redeploy:
//   CHAT_ENABLED=true
//   ANTHROPIC_API_KEY=sk-ant-...
// Optional:
//   CHAT_MODEL        (default claude-opus-5-5; claude-haiku-5-5 is much cheaper)
//   CHAT_DAILY_LIMIT  (default 200 questions per day, across the whole family)
import type { Config } from "@netlify/functions";
import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@netlify/blobs";
import { json, loadRecipes } from "../lib/shared.mts";

const enabled = () => process.env.CHAT_ENABLED === "true" && !!process.env.ANTHROPIC_API_KEY;
const MODEL = () => process.env.CHAT_MODEL || "claude-opus-5-5";
const DAILY_LIMIT = () => parseInt(process.env.CHAT_DAILY_LIMIT || "200", 10);

let cookbookText: string | null = null;
function cookbook(): string {
  if (cookbookText) return cookbookText;
  const parts: string[] = [];
  for (const r of loadRecipes() as any[]) {
    if (!r.steps?.length) continue; // recipes still being collected
    const lines: string[] = [`## ${r.title} [[${r.slug}]]`];
    if (r.source) lines.push(`Source: ${r.source}`);
    if (r.yield?.text || r.times?.length)
      lines.push(`Yield/time: ${[r.yield?.text, ...r.times.map((t: any) => `${t.label} ${t.text}`)].filter(Boolean).join(" · ")}`);
    if (r.isBestGuess) lines.push("(This version is the editor's best guess; the family has not confirmed it.)");
    if (r.lindasTouch) lines.push(`Linda's Touch: ${r.lindasTouchReason}`);
    if (r.headnote) lines.push(r.headnote);
    lines.push("Ingredients:");
    for (const g of r.ingredientGroups) {
      if (g.name) lines.push(`  ${g.name}:`);
      for (const i of g.items) lines.push(`  - ${i.raw}`);
    }
    lines.push("Method:");
    r.steps.forEach((s: any, i: number) => lines.push(`  ${i + 1}. ${s.lead} ${s.text}`));
    if (r.notes?.length) {
      lines.push("Notes:");
      for (const n of r.notes) lines.push(`  - ${n.label} — ${n.text}`);
    }
    parts.push(lines.join("\n"));
  }
  cookbookText = parts.join("\n\n");
  return cookbookText;
}

const INSTRUCTIONS = `You are "Ask Linda's Kitchen", a friendly helper on the Mitchell family's private recipe website. The family cookbook is below; Linda Mitchell is the hostess at the heart of it.

How to answer:
- Use only the cookbook below. If the answer isn't in it, say so plainly and suggest the closest recipe if there is one. General cooking knowledge is fine for simple substitutions, but say when a tip is general rather than from the book.
- Never invent anything about Linda or any family member: no made-up quotes, opinions, habits or stories. Only repeat what the cookbook says about them.
- When you mention a recipe, write it as [[slug|Title]] using the slug shown in its heading, so the site can link it.
- Keep answers short and warm: a few sentences or a short list. Plain text only, no markdown headings or tables.
- Readers are family members cooking from a phone, some older and not tech-savvy. Be clear and kind.

THE COOKBOOK
`;

async function underDailyLimit(): Promise<boolean> {
  try {
    const store = getStore({ name: "chat-usage", consistency: "strong" });
    const key = new Date().toISOString().slice(0, 10);
    const raw = (await store.get(key, { type: "text" })) as string | null;
    const n = parseInt(raw ?? "0", 10);
    if (n >= DAILY_LIMIT()) return false;
    await store.set(key, String(n + 1));
    return true;
  } catch {
    return true;
  }
}

export default async (req: Request) => {
  if (req.method === "GET") return json({ enabled: enabled() });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!enabled()) return json({ error: "Ask Linda’s Kitchen isn’t switched on yet" }, 503);

  const body = (await req.json().catch(() => ({}))) as { messages?: { role: string; content: string }[] };
  const messages: Anthropic.Beta.BetaMessageParam[] = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-8)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 2000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") return json({ error: "Please ask a question" }, 400);
  if (!(await underDailyLimit())) return json({ error: "the kitchen has answered a lot of questions today — try again tomorrow" }, 429);

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: MODEL(),
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [
        { type: "text", text: INSTRUCTIONS },
        // The cookbook never changes between questions, so cache it.
        { type: "text", text: cookbook(), cache_control: { type: "ephemeral", ttl: "1h" } },
      ],
      messages,
    });
    if (response.stop_reason === "refusal") {
      return json({ answer: "Sorry, I can’t help with that one. Try asking about a recipe in the book." });
    }
    const answer = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return json({ answer: answer || "Sorry, I couldn’t find an answer in the cookbook." });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: "the kitchen is busy right now" }, 429);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "the chat isn’t set up correctly (API key)" }, 500);
    if (err instanceof Anthropic.APIError) return json({ error: `the kitchen had a problem (${err.status})` }, 502);
    return json({ error: "the kitchen couldn’t be reached" }, 502);
  }
};

export const config: Config = { path: "/api/ask" };
