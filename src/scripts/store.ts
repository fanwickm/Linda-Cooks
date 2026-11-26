/** Site-root path -> URL. Normally unchanged; the static preview build maps it to its own file layout. */
export function link(path: string): string {
  const f = (globalThis as any).__lkLink as ((p: string) => string) | undefined;
  return f ? f(path) : path;
}

// Small localStorage wrapper. Every read/write is guarded: private windows and
// blocked storage must never break the page.
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`lk:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(`lk:${key}`, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent("lk:store", { detail: { key } }));
}

export const favs = {
  all: (): string[] => load<string[]>("favs", []),
  has: (slug: string) => favs.all().includes(slug),
  toggle(slug: string): boolean {
    const list = favs.all();
    const i = list.indexOf(slug);
    if (i >= 0) list.splice(i, 1);
    else list.unshift(slug);
    save("favs", list);
    return i < 0;
  },
};

export interface Stamp { slug: string; date: string }
export const stamps = {
  all: (): Stamp[] => load<Stamp[]>("stamps", []),
  forRecipe: (slug: string) => stamps.all().filter((s) => s.slug === slug),
  add(slug: string): Stamp {
    const s = { slug, date: new Date().toISOString() };
    save("stamps", [s, ...stamps.all()]);
    return s;
  },
};

export type MenuCourse = "starter" | "main" | "side" | "dessert";
export const menu = {
  get: (): Record<MenuCourse, string[]> =>
    load("menu", { starter: [], main: [], side: [], dessert: [] } as Record<MenuCourse, string[]>),
  set: (m: Record<MenuCourse, string[]>) => save("menu", m),
  add(course: MenuCourse, slug: string) {
    const m = menu.get();
    if (!m[course].includes(slug)) m[course].push(slug);
    menu.set(m);
  },
};

export function toast(msg: string): void {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.className =
      "fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-[80] bg-ink text-paper px-5 py-3 rounded-full shadow-lg text-base font-medium transition-opacity duration-300 opacity-0 pointer-events-none max-w-[90vw] text-center";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout((el as any)._t);
  (el as any)._t = setTimeout(() => (el!.style.opacity = "0"), 2400);
}

export function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function confetti(): void {
  if (reducedMotion()) return;
  const colors = ["#b2372a", "#c9962f", "#4e6b4b", "#f4c2b8", "#fff4b8"];
  const layer = document.createElement("div");
  layer.className = "fixed inset-0 pointer-events-none z-[90] overflow-hidden";
  layer.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 90; i++) {
    const p = document.createElement("i");
    const size = 6 + Math.random() * 8;
    p.style.cssText = `position:absolute;left:${Math.random() * 100}%;top:-20px;width:${size}px;height:${size * 0.5}px;background:${colors[i % colors.length]};border-radius:2px;opacity:.95`;
    layer.appendChild(p);
    p.animate(
      [
        { transform: `translate(0,0) rotate(0deg)` },
        { transform: `translate(${(Math.random() - 0.5) * 200}px, ${window.innerHeight + 60}px) rotate(${Math.random() * 720}deg)` },
      ],
      { duration: 1800 + Math.random() * 1400, easing: "cubic-bezier(.2,.6,.4,1)", delay: Math.random() * 300, fill: "forwards" },
    );
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3800);
}
