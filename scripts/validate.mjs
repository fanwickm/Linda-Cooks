// Checks the recipe data before every build. Run with: npm run validate
// Every recipe needs a title, chapter, ingredients and steps (except the ones
// the family is still collecting), and every table-of-contents title needs a file.
import { readFileSync, readdirSync } from "node:fs";

const dir = new URL("../src/data/recipes/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
const chapters = JSON.parse(readFileSync(new URL("../src/data/chapters.json", import.meta.url), "utf8"));
const people = JSON.parse(readFileSync(new URL("../src/data/people.json", import.meta.url), "utf8"));
const occasions = JSON.parse(readFileSync(new URL("../src/data/occasions.json", import.meta.url), "utf8"));
const STILL_COLLECTING = new Set(["snick-snacks", "mrs-blums-pie"]);

const problems = [];
const warnings = [];
const slugs = new Set();
const personIds = new Set(people.map((p) => p.id));
const chapterSlugs = new Set(chapters.map((c) => c.slug));

for (const f of files) {
  let r;
  try {
    r = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
  } catch (e) {
    problems.push(`${f}: not valid JSON (${e.message}) — check for a missing comma or quote`);
    continue;
  }
  const where = `${f}`;
  if (`${r.slug}.json` !== f) problems.push(`${where}: "slug" (${r.slug}) must match the file name`);
  slugs.add(r.slug);
  if (!r.title) problems.push(`${where}: missing title`);
  if (!chapterSlugs.has(r.chapter)) problems.push(`${where}: unknown chapter "${r.chapter}"`);
  const nIng = (r.ingredientGroups ?? []).reduce((n, g) => n + (g.items?.length ?? 0), 0);
  if (!STILL_COLLECTING.has(r.slug)) {
    if (nIng < 1) problems.push(`${where}: needs at least one ingredient`);
    if (!(r.steps ?? []).length) problems.push(`${where}: needs at least one step`);
  }
  for (const g of r.ingredientGroups ?? []) for (const i of g.items ?? []) if (!i.raw) problems.push(`${where}: an ingredient has no "raw" text`);
  for (const c of r.contributors ?? []) if (!personIds.has(c)) problems.push(`${where}: contributor "${c}" isn't in people.json`);
  for (const o of r.occasions ?? []) if (!occasions.some((x) => x.slug === o)) problems.push(`${where}: unknown occasion "${o}"`);
  // reviewer scaffolding must never leak into recipe text
  const text = JSON.stringify([r.headnote, r.ingredientGroups, r.steps, r.notes]);
  if (/please fill in|For reviewers|Open questions/i.test(text)) problems.push(`${where}: reviewer scaffolding found in recipe text`);
}

for (const c of chapters) for (const s of c.recipes) if (!slugs.has(s)) problems.push(`chapters.json: "${s}" in ${c.title} has no recipe file`);
for (const o of occasions) {
  for (const s of Object.values(o.menu).flat()) if (!slugs.has(s)) problems.push(`occasions.json: ${o.slug} menu lists unknown recipe "${s}"`);
  for (const t of o.timeline) if (!slugs.has(t.recipe)) problems.push(`occasions.json: ${o.slug} timeline lists unknown recipe "${t.recipe}"`);
}
const tocCount = chapters.reduce((n, c) => n + c.recipes.length, 0);
if (tocCount !== files.length) warnings.push(`table of contents lists ${tocCount} recipes but there are ${files.length} files`);

for (const w of warnings) console.warn(`⚠️  ${w}`);
if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s) in the recipe data:\n`);
  for (const p of problems) console.error(`  • ${p}`);
  process.exit(1);
}
console.log(`✓ ${files.length} recipes in ${chapters.length} chapters look good.`);
