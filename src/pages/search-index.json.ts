// Compact search/data index used by search, the spinner, Fridge Raid and the Menu Builder.
import { recipes, personById, chapterBySlug, timeBucket, courseOf, fridgeTags, isComplete } from "../lib/data";

export function GET() {
  const data = recipes.map((r) => ({
    s: r.slug,
    t: r.title,
    c: r.chapter,
    cn: chapterBySlug.get(r.chapter)?.title ?? "",
    p: r.contributors.map((id) => personById.get(id)?.name ?? id),
    pid: r.contributors,
    o: r.occasions,
    l: r.lindasTouch,
    tb: timeBucket(r),
    m: r.totalMinutes,
    co: courseOf(r),
    f: fridgeTags(r),
    ok: isComplete(r),
    i: r.ingredientGroups.flatMap((g) => g.items.map((x) => x.raw)).join(" · "),
    ing: r.ingredientGroups.map((g) => ({ n: g.name, items: g.items.map((x) => x.raw) })),
    y: r.yield.text,
  }));
  return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
}
