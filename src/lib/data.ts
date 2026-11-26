// Loads the cookbook data files at build time. Everything the family edits
// lives in src/data/*.json — this file never needs to change for content edits.
import chaptersJson from "../data/chapters.json";
import peopleJson from "../data/people.json";
import occasionsJson from "../data/occasions.json";
import openQuestionsJson from "../data/open-questions.json";

export interface Ingredient {
  raw: string;
  qty?: number | [number, number];
  qtyText?: string;
  qtyPrefix?: string;
  unit?: string;
  metric?: { qty: number; unit: string; span: string };
  gaps?: string[];
}
export interface IngredientGroup { name: string | null; items: Ingredient[] }
export interface Step { lead: string; text: string; gaps?: string[] }
export interface Note { label: string; text: string; byLinda?: boolean; gaps?: string[] }
export interface Quote { by: string; text: string; context: string | null; span: string }
export interface TimeEntry { label: string; text: string; min: number | null; max: number | null }

export interface Recipe {
  slug: string;
  title: string;
  chapter: string;
  order: number;
  source: string | null;
  contributors: string[];
  contributorName?: string;
  occasionText: string | null;
  yield: { text: string | null; servings: number | null };
  times: TimeEntry[];
  headnote: string | null;
  quotes: Quote[];
  ingredientGroups: IngredientGroup[];
  steps: Step[];
  notes: Note[];
  openQuestion: string | null;
  isBestGuess: boolean;
  lindasTouch: boolean;
  lindasTouchReason: string | null;
  occasions: string[];
  totalMinutes: number | null;
  cardScan?: string | null;
  photo?: string | null;
  /** Stock photo standing in until the family adds a real one. */
  standIn?: string | null;
}

export interface Chapter { slug: string; title: string; number: number; intro: string; recipes: string[] }
export interface Person {
  id: string; name: string; short: string; aliases: string[]; relationship: string;
  photo: string | null; isLinda?: boolean;
}
export interface Occasion {
  slug: string; name: string; emoji: string; intro: string; featured?: boolean;
  dateRule: Record<string, unknown>;
  menu: Partial<Record<"starter" | "main" | "side" | "dessert", string[]>>;
  timeline: { when: string; task: string; recipe: string }[];
}
export interface OpenQuestion {
  slug: string; title: string; chapter: string; question: string | null; isBestGuess: boolean; gaps: string[];
}

const recipeModules = import.meta.glob<Recipe>("../data/recipes/*.json", { eager: true, import: "default" });

// Optional dish photos: drop a file named <slug>.jpg (or .webp/.png) into public/images/recipes/
const photoFiles = import.meta.glob("/public/images/recipes/*.{jpg,jpeg,png,webp}", { eager: false });
// Stand-in stock photos (Unsplash), shown with a "Stand-in photo" tag until a real photo is added.
const standInFiles = import.meta.glob("/public/images/stand-ins/*.{jpg,jpeg,png,webp}", { eager: false });
const cardFiles = import.meta.glob("/public/images/cards/*.{jpg,jpeg,png,webp}", { eager: false });
function findImage(files: Record<string, unknown>, slug: string): string | null {
  for (const p of Object.keys(files)) {
    const base = p.split("/").pop()!.replace(/\.[^.]+$/, "");
    if (base === slug) return p.replace(/^\/public/, "");
  }
  return null;
}

export const recipes: Recipe[] = Object.values(recipeModules)
  .map((r) => ({ ...r, photo: findImage(photoFiles, r.slug), standIn: findImage(standInFiles, r.slug), cardScan: findImage(cardFiles, r.slug) }))
  .sort((a, b) => a.order - b.order);

export const chapters = chaptersJson as Chapter[];
export const people = peopleJson as Person[];
export const occasions = occasionsJson as Occasion[];
export const openQuestions = openQuestionsJson as OpenQuestion[];

/** Line icon (Phosphor) for each occasion, used instead of emoji. */
export const OCCASION_ICON: Record<string, string> = {
  "christmas-eve": "ph:tree-evergreen",
  "christmas-morning": "ph:gift",
  thanksgiving: "ph:grains",
  "easter-spring": "ph:flower-tulip",
  summer: "ph:sun",
  "sunday-dinner": "ph:fork-knife",
};
export const occasionIcon = (slug: string) => OCCASION_ICON[slug] ?? "ph:calendar-blank";

export const recipeBySlug = new Map(recipes.map((r) => [r.slug, r]));
export const chapterBySlug = new Map(chapters.map((c) => [c.slug, c]));
export const personById = new Map(people.map((p) => [p.id, p]));
export const occasionBySlug = new Map(occasions.map((o) => [o.slug, o]));

export const LINDA = personById.get("linda-mitchell")!;
export const LINDA_SIGNATURES = [
  "lindas-tuna-tartare-with-wasabi-and-lime",
  "lindas-napa-cabbage-salad",
  "lindas-christmas-eve-halibut",
];

export function getRecipe(slug: string): Recipe {
  const r = recipeBySlug.get(slug);
  if (!r) throw new Error(`Unknown recipe: ${slug}`);
  return r;
}

export function recipesBy(personId: string): Recipe[] {
  return recipes.filter((r) => r.contributors.includes(personId));
}

export function lindaRecipes(): Recipe[] {
  return recipes.filter((r) => r.lindasTouch);
}

/** Recipes with real content (Snick Snacks and Mrs. Blum's pie are still just questions). */
export function isComplete(r: Recipe): boolean {
  return r.steps.length > 0;
}

export function lindaQuotes(): { recipe: Recipe; quote: Quote }[] {
  const out: { recipe: Recipe; quote: Quote }[] = [];
  for (const r of recipes) for (const q of r.quotes) if (q.by === "linda-mitchell") out.push({ recipe: r, quote: q });
  return out;
}

export function lindaNotes(): { recipe: Recipe; note: Note }[] {
  const out: { recipe: Recipe; note: Note }[] = [];
  for (const r of recipes) for (const n of r.notes) if (n.byLinda) out.push({ recipe: r, note: n });
  return out;
}

export type Course = "starter" | "main" | "side" | "dessert" | "breakfast" | "extra";
export function courseOf(r: Recipe): Course {
  switch (r.chapter) {
    case "starters-snacks":
    case "soups":
      return "starter";
    case "salads":
    case "vegetables-sides":
      return "side";
    case "meat":
    case "poultry":
    case "fish-shellfish":
    case "pasta-dumplings-grains":
      return "main";
    case "desserts":
      return "dessert";
    case "breads-breakfast":
      return /bread|focaccia/i.test(r.title) ? "side" : "breakfast";
    default:
      return "extra";
  }
}

export function timeBucket(r: Recipe): "quick" | "hour" | "afternoon" | "project" | null {
  const t = r.totalMinutes;
  if (!t) return null;
  if (t <= 30) return "quick";
  if (t <= 60) return "hour";
  if (t <= 180) return "afternoon";
  return "project";
}

export function formatMinutes(m: number | null): string {
  if (!m) return "";
  if (m < 60) return `${m} min`;
  if (m >= 1440) {
    const d = Math.round(m / 1440);
    return `${d} day${d > 1 ? "s" : ""}`;
  }
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h} hr ${mm} min` : `${h} hr`;
}

/** Plain-language list of the pantry staples a recipe uses, for Fridge Raid. */
export const FRIDGE_ITEMS: { id: string; label: string; emoji: string; match: RegExp }[] = [
  { id: "eggs", label: "Eggs", emoji: "🥚", match: /\beggs?\b|\byolks?\b/i },
  { id: "butter", label: "Butter", emoji: "🧈", match: /\bbutter\b/i },
  { id: "cream", label: "Cream / milk", emoji: "🥛", match: /\bcream\b(?! cheese)|\bmilk\b|half-and-half|buttermilk/i },
  { id: "cheese", label: "Cheese", emoji: "🧀", match: /parmesan|parmigiano|gruy[eè]re|mozzarella|cheddar|ricotta|brie|feta|pecorino|cream cheese|\bcheese\b/i },
  { id: "lemon", label: "Lemons / limes", emoji: "🍋", match: /\blemons?\b|\blimes?\b/i },
  { id: "garlic", label: "Garlic", emoji: "🧄", match: /\bgarlic\b/i },
  { id: "onion", label: "Onions / scallions", emoji: "🧅", match: /\bonions?\b|shallots?|scallions?|leeks?/i },
  { id: "potato", label: "Potatoes", emoji: "🥔", match: /potato/i },
  { id: "tomato", label: "Tomatoes", emoji: "🍅", match: /tomato/i },
  { id: "corn", label: "Corn", emoji: "🌽", match: /\bcorn\b(?!starch| syrup|meal)/i },
  { id: "greens", label: "Greens & herbs", emoji: "🌿", match: /spinach|lettuce|romaine|basil|parsley|cilantro|arugula|mint|dill|cabbage/i },
  { id: "chicken", label: "Chicken", emoji: "🍗", match: /chicken(?! (stock|broth))/i },
  { id: "beef", label: "Beef", emoji: "🥩", match: /\bbeef\b(?! (stock|broth))|rib roast|corned beef|ground chuck/i },
  { id: "pork", label: "Pork, bacon & sausage", emoji: "🥓", match: /\bpork\b|bacon|pancetta|sausage|kielbasa|\bham\b/i },
  { id: "lamb", label: "Lamb", emoji: "🐑", match: /\blamb\b/i },
  { id: "fish", label: "Fish & shellfish", emoji: "🐟", match: /tuna|halibut|sea bass|shrimp|clams?\b|fish fillet/i },
  { id: "pasta", label: "Pasta & rice", emoji: "🍝", match: /pasta|linguine|spaghetti|macaroni|mostaccioli|lasagna noodles|\brice\b|noodles/i },
  { id: "bread", label: "Bread", emoji: "🍞", match: /\bbread\b|challah|baguette|english muffins|crackers/i },
  { id: "flour", label: "Flour & baking", emoji: "🌾", match: /\bflour\b/i },
  { id: "chocolate", label: "Chocolate", emoji: "🍫", match: /chocolate|cocoa/i },
  { id: "nuts", label: "Nuts", emoji: "🥜", match: /walnuts?|pecans?|pine nuts|pignoli|almond|peanut|hazelnut|pistachio/i },
  { id: "fruit", label: "Fruit & berries", emoji: "🍓", match: /strawberr|rhubarb|blackberr|apples?\b|oranges?\b|coconut|avocado|mango/i },
];

export function fridgeTags(r: Recipe): string[] {
  const text = r.ingredientGroups.flatMap((g) => g.items.map((i) => i.raw)).join("\n");
  return FRIDGE_ITEMS.filter((f) => f.match.test(text)).map((f) => f.id);
}
