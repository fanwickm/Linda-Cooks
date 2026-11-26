// Text helpers shared by build-time pages and browser scripts.
import type { Ingredient } from "./data";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const FRACTIONS: [number, string][] = [
  [0, ""], [1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [3 / 8, "⅜"], [1 / 2, "½"],
  [5 / 8, "⅝"], [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"], [1, ""],
];

/** 1.5 -> "1½", 0.333 -> "⅓", 2.0 -> "2". Keeps quantities readable when scaled. */
export function formatQty(n: number): string {
  if (n >= 20) return String(Math.round(n));
  let whole = Math.floor(n);
  const rem = n - whole;
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) if (Math.abs(f[0] - rem) < Math.abs(best[0] - rem)) best = f;
  if (best[0] === 1) {
    whole += 1;
    best = FRACTIONS[0];
  }
  if (whole === 0 && !best[1]) return n > 0 ? "⅛" : "0";
  return `${whole || ""}${best[1]}`;
}

/** Wrap red "missing" phrases so they show as gentle question marks. */
export function markGaps(html: string, gaps: string[] | undefined): string {
  if (!gaps?.length) return html;
  let out = html;
  for (const g of gaps) {
    const eg = esc(g);
    const i = out.indexOf(eg);
    if (i >= 0) {
      out = `${out.slice(0, i)}<mark class="gap" title="The family is still filling this in">${eg}</mark>${out.slice(i + eg.length)}`;
    }
  }
  return out;
}

const NUM = String.raw`\d+(?:[½¼¾⅓⅔]|\.\d+)?|[½¼¾⅓⅔]`;
const TIMER_RE = new RegExp(
  String.raw`\b(${NUM})(?:\s*(?:to|–|-|or)\s*(${NUM}))?\s*(minutes?|mins?|hours?|hrs?|hr)\b`,
  "g",
);

function num(s: string): number {
  const map: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };
  let t = 0;
  let digits = "";
  for (const ch of s) {
    if (ch in map) t += map[ch];
    else digits += ch;
  }
  return t + (digits ? parseFloat(digits) : 0);
}

/** Turn "Cook 8 to 10 minutes" into a tappable timer button. Input must already be escaped. */
export function markTimers(html: string, label: string): string {
  return html.replace(TIMER_RE, (m, a: string, b: string | undefined, unit: string) => {
    const mult = /^h/.test(unit) ? 60 : 1;
    const lo = num(a) * mult;
    const hi = b ? num(b) * mult : lo;
    if (lo <= 0 || lo > 24 * 60) return m;
    return `<button type="button" class="timer-chip" data-timer-min="${lo}" data-timer-max="${hi}" data-timer-label="${esc(label)}" aria-label="Start a ${esc(m)} timer"><span aria-hidden="true">⏱</span> ${m}</button>`;
  });
}

export function richText(text: string, gaps?: string[], timerLabel?: string): string {
  let html = markGaps(esc(text), gaps);
  if (timerLabel !== undefined) html = markTimers(html, timerLabel);
  return html;
}

/** Ingredient line as HTML with scalable quantity and optional metric twin. */
export function ingredientHtml(it: Ingredient): string {
  if (it.qty === undefined || !it.qtyText) return markGaps(esc(it.raw), it.gaps);
  const [q1, q2] = Array.isArray(it.qty) ? it.qty : [it.qty, null];
  const qtyEl = (a: number, b: number | null, text: string, cls = "qty") =>
    `<span class="${cls}" data-q="${a}"${b !== null ? ` data-q2="${b}"` : ""} data-orig="${esc(text)}">${esc(text)}</span>`;
  const prefix = it.qtyPrefix ?? "";
  // If someone edited the text by hand and the number no longer matches, show it as written.
  const head = prefix + it.qtyText;
  if (!it.raw.startsWith(head) || !/^(\s|\(|$)/.test(it.raw.slice(head.length))) return markGaps(esc(it.raw), it.gaps);
  let after = it.raw.slice(prefix.length + it.qtyText.length);
  let html = esc(prefix);
  if (it.metric && after.startsWith(it.metric.span)) {
    const usTail = it.metric.span;
    after = after.slice(usTail.length);
    html +=
      `<span class="unit-us">${qtyEl(q1, q2, it.qtyText)}${esc(usTail)}</span>` +
      `<span class="unit-metric" hidden>${qtyEl(it.metric.qty, null, formatQty(it.metric.qty))} ${esc(it.metric.unit)}</span>`;
  } else {
    html += qtyEl(q1, q2, it.qtyText);
  }
  const gapsInRest = it.gaps?.filter((g) => !it.qtyText!.includes(g) && !g.includes(it.qtyText!));
  const qtyIsGap = it.gaps?.some((g) => g.includes(it.qtyText!) || it.qtyText!.includes(g));
  const out = html + markGaps(esc(after), gapsInRest);
  return qtyIsGap ? `<mark class="gap" title="The family is still filling this in">${out}</mark>` : out;
}

export function initials(name: string): string {
  return name
    .replace(/[’']s\b/g, "")
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
}
