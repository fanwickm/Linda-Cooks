# How to fix a recipe or add a photo

You don't need to know any code. Everything on the site comes from simple text files, and GitHub lets you edit them in your web browser. When you save, the site rebuilds by itself in about two minutes.

You'll need a free GitHub account that has been given access to this project. Ask Lyle if you don't have one.

---

## Fix a typo in a recipe

1. Go to the project on GitHub and open the folder **`src/data/recipes`**.
2. Click the recipe you want. Each file is named after the recipe, for example `lindas-christmas-eve-halibut.json`.
3. Click the **pencil icon** (✏️ "Edit this file") at the top right.
4. Find the words you want to fix. Recipe text is always between **"double quotes"**, like this:

   ```
   "raw": "2 cups very thinly sliced red bell pepper (about 1½ peppers)",
   ```

   Change **only the words inside the quotes**. Leave the quotes, commas and colons where they are.

5. Scroll to the bottom and click the green **Commit changes** button. In the box, write a short note like "Fix halibut oven temperature".
6. Wait about two minutes, then refresh the website.

**Where things live in a recipe file**

| What you see on the site | What it's called in the file |
| --- | --- |
| Recipe title | `"title"` |
| The italic story under the title | `"headnote"` |
| An ingredient line | `"raw"` (inside `"ingredientGroups"`) |
| The bold start of a step ("Make the pickle.") | `"lead"` |
| The rest of a step | `"text"` (inside `"steps"`) |
| A note ("Storage — keeps 5 days…") | `"label"` and `"text"` (inside `"notes"`) |
| "Serves 4" | `"yield"` → `"text"` |

> **Changing an amount?** Just change the `"raw"` line. If the number at the start no longer matches, the site shows your line exactly as written; it just won't be scaled by the ½× / 2× / 3× buttons until someone re-runs the parser (see the README).

**Typing special characters:** fractions like ½ ¼ ¾ ⅓ ⅔, the long dash —, and curly quotes ’ “ ” can be copied from any other recipe in the file.

**If something goes wrong:** the site won't update if a file has a mistake (usually a missing quote or comma). Nothing breaks, because the old version stays up. GitHub shows a red ✗ next to your change; click it to see a plain-English message such as `halibut.json: not valid JSON — check for a missing comma or quote`. Fix it, or ask Lyle.

---

## Add a photo of a dish

1. Make the photo a reasonable size (a phone photo is fine) and name it exactly like the recipe file, ending in `.jpg`. For example: `lindas-christmas-eve-halibut.jpg`.
2. On GitHub, open the folder **`public/images/recipes`**.
3. Click **Add file → Upload files**, drag your photo in, and click **Commit changes**.

The photo replaces the illustrated placeholder automatically.

**Original handwritten recipe cards** work the same way. Put them in **`public/images/cards`**, named after the recipe (for example `coconut-cake.jpg`). A "See the original card" button then appears, and tapping it flips the photo over to show the card.

**Photos of people** go in `public/images/people`. Then add the file name to that person's `"photo"` line in `src/data/people.json`.

> The easiest way for most of the family is the **Family photo wall** on the website itself. Anyone can upload there, and Lyle approves photos before they appear. Use GitHub only for "official" photos that should replace a placeholder.

---

## Write Linda's story

Open **`src/data/linda.json`** and fill in `"story"`. It's a list of paragraphs, each in quotes and separated by commas:

```json
"story": [
  "Linda grew up …",
  "Christmas Eve at her house …"
],
"storyAuthor": "Written by the family, 2026",
```

---

## Approve family answers and photos (for Lyle)

1. Go to **`/editor`** on the website and enter the editor password.
2. Each answer or photo has **Approve** and **Reject** buttons. Approved answers appear on the recipe under "From the family", and approved photos appear on the photo wall.
3. Approving an answer does **not** change the recipe text. When an answer settles a question, fix the recipe as described above. To clear the red "missing" question, delete the `"openQuestion"` line's text (make it `null`) and set `"isBestGuess": false` if the recipe is now confirmed.

The **Export approved** button downloads everything approved as a file, for safekeeping.

---

## Other things you can change

| To change… | Edit this file |
| --- | --- |
| Which recipes are in an occasion menu, or its make-ahead timeline | `src/data/occasions.json` |
| A recipe's occasions or Linda's Touch badge | `src/data/overrides.json`, then ask someone to re-run the parser; or edit `"occasions"` / `"lindasTouch"` in the recipe file directly |
| Names and descriptions of family members | `src/data/people.json` |
| Linda's Kitchen Rules and local favourites | `src/data/linda.json` |
| Chapter introductions | `src/data/chapters.json` |
