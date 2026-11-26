# Linda’s Kitchen

The website for the **Linda M Cookbook**: 79 family recipes in 12 chapters, with Linda Mitchell at the heart of it. It's built mobile-first for cooking from a phone propped on the counter.

- **Family members who want to fix a recipe or add a photo:** read [EDITING.md](EDITING.md).
- **Whoever looks after the hosting:** read on.

## What's here

| Page | URL |
| --- | --- |
| Home: Linda hero, countdown, Linda's Signatures, spinner, occasions, chapters | `/` |
| Meet Linda: story, photos, her notes, Kitchen Rules, every recipe she touched | `/linda` |
| Recipe index with search and filters (chapter, occasion, contributor, time, Linda's Touch) | `/recipes`, `/search` |
| Recipe page: scaler, checklist, timers, US/metric, Cook Mode with voice, print or 4×6 card, "We made it!" | `/recipes/<slug>` |
| Chapters | `/chapters/<slug>` |
| Occasions: curated menus, make-ahead timeline, "make this my menu" | `/occasions`, `/occasions/<slug>` |
| The Family Table: contributor web, per-person pages | `/family`, `/family/<id>` |
| Help finish the book: the 71 open questions with answer forms | `/family/help` |
| Family photo wall (moderated uploads) | `/family/photos` |
| Saved recipes, recipe passport | `/saved`, `/passport` |
| What should we make? / Fridge Raid / Menu Builder | `/spin`, `/fridge`, `/menu` |
| Ask Linda's Kitchen chat (off until switched on) | `/ask` |
| Editor approvals (for Lyle) | `/editor` |

Favourites, checklist ticks, made-it stamps and menus are stored in each person's browser, so nobody needs an account.

## How it's built

- **[Astro](https://astro.build)** static site + TypeScript + Tailwind CSS. Interactive bits are small vanilla scripts, about 6–30 KB of JS per page.
- **Content** lives in `src/data/`. There is one JSON file per recipe in `src/data/recipes/`, plus `chapters.json`, `people.json`, `occasions.json`, `linda.json`, `open-questions.json` and `overrides.json` (hand-curated fields such as Linda's Touch and occasions).
- **Search** uses Fuse.js in the browser. There is no search server.
- **Netlify** hosts the site and runs the backend:
  - `netlify/edge-functions/family-gate.ts`: the family password screen in front of every page and API call.
  - `netlify/functions/answers.mts`, `photos.mts`: family submissions, stored in Netlify Blobs as *pending*.
  - `netlify/functions/editor.mts`, `photo.mts`, `approved.mts`: editor approvals and serving approved content.
  - `netlify/functions/ask.mts`: the cookbook chat (Claude API), off by default.

### Where the recipe data came from

`source/linda-m-cookbook-v4.docx` is the family review draft (November 2026). `scripts/parse_docx.py` reads its Word tables so the Ingredients and Method columns stay separate, and writes the JSON files. Everything is kept word for word:

- Each ingredient keeps its original line in `raw`, and the parsed quantity sits next to it for the scaler.
- Red "missing" phrases inside recipes are listed in `gaps`. The site underlines them with a "?" instead of changing the words.
- The red "Missing — please fill in" notes become `openQuestion` / `isBestGuess` fields. They never appear as recipe text.
- The "For reviewers" and "Open questions" pages are skipped. They feed the Help board only.

To re-import after a new draft (this **overwrites** `src/data/recipes/`, so any edits made directly in those files are lost; hand-curated fields in `overrides.json` survive):

```bash
pip install python-docx
python3 -I scripts/parse_docx.py path/to/new-draft.docx
npm run validate
```

## Running it locally

```bash
npm install
npm run dev        # http://localhost:4321 (pages only; the /api functions need Netlify)
npm run build      # validates the data, then builds to dist/
```

For a static preview that works from any sub-path (no Netlify functions; family submissions and the chat are inactive):

```bash
PREVIEW=1 npx astro build && node scripts/make-preview.mjs ../preview
```

`npm run validate` checks every recipe has a title, a chapter, ingredients and steps, that every table-of-contents title has a file, that occasion menus point at real recipes, and that no reviewer scaffolding leaked into recipe text. The build stops with a plain-English message if anything is wrong.

## Deploying on Netlify (free tier)

1. In Netlify: **Add new site → Import an existing project →** pick this GitHub repository. Build settings come from `netlify.toml` (`npm run build`, publish `dist`).
2. **Site configuration → Environment variables**, add:

   | Variable | What it does |
   | --- | --- |
   | `SITE_PASSWORD` | The shared family password. Without it, the site is public. Changing it signs everyone out. |
   | `EDITOR_PASSWORD` | Lyle's password for `/editor`. Make it different from the family password. |

3. Deploy. Every push to the main branch redeploys automatically, which is how family edits made on GitHub go live.

Netlify Blobs (where answers and photos are stored) needs no setup.

> The family password keeps casual visitors and search engines out, but it's a shared password, not real security. Don't put anything on the site that must stay secret. Every page also sends `noindex`, and `robots.txt` blocks crawlers.

### Switching on "Ask Linda's Kitchen" (optional)

The chat is built but **off**. To turn it on:

1. Create an API key at [console.anthropic.com](https://console.anthropic.com) and set a monthly spend limit there.
2. Add environment variables: `CHAT_ENABLED=true` and `ANTHROPIC_API_KEY=sk-ant-…`, then redeploy.

It answers only from the cookbook (about 45k tokens, cached between questions) and is told never to invent anything about Linda or the family. Optional settings:

- `CHAT_MODEL`: defaults to `claude-opus-5-5`, the most capable choice. `claude-haiku-5-5` costs a small fraction as much and is fine for most cookbook questions.
- `CHAT_DAILY_LIMIT`: defaults to 200 questions per day across the whole family.

## Photos

- Dish photos go in `public/images/recipes/<slug>.jpg`. Until one exists, the page shows a black-and-white stand-in stock photo from `public/images/stand-ins/` (tagged "Stand-in photo"), or an illustrated plate chosen in `src/data/dish-art.json`.
- Original recipe-card scans go in `public/images/cards/<slug>.jpg`, and a flip button appears on the recipe.
- Linda's portrait and avatar are cropped from the family group portrait, which also appears in full on the Meet Linda page. It shows other family members, so keep `SITE_PASSWORD` set.

## Testing notes

Checked before handing over:

- All 1,639 ingredient, step, note and headnote paragraphs in the .docx appear verbatim in the data, and all 1,614 rendered ingredient, step and note lines match the data exactly.
- A browser run on a Pixel 7 profile covered the scaler, checklist persistence, multiple timers, Cook Mode (buttons, swipe, Escape), favourites, made-it stamps, search, filters, the spinner, Fridge Raid, Menu Builder, the family tree and the Help board filters.
- Backend functions were run against a local Netlify Blobs server: submit → hidden until approved → approve → public. The editor password, photo type limits and the honeypot were checked too.
- Password-gate logic was tested with a Node shim, covering login, wrong password, forged cookie, password change and open-redirect protection.
- All palette colour pairs pass WCAG AA contrast.
- Still to do on real devices: an iPhone and an Android phone, and a Lighthouse run. Lighthouse couldn't run in the build sandbox. Throttled local measurements showed LCP under 1 s, CLS ≈ 0 and 160–430 KB per page.
