// Recipe page interactivity: scaler, metric toggle, ingredient checklist,
// "We made it!" stamps, Ask Linda tips, print, card flip, family answers,
// and Cook Mode (wake lock, swipe, keyboard, voice).
import { formatQty } from "../lib/format";
import { load, save, stamps, toast, confetti, reducedMotion } from "./store";

export function initRecipePage() {
  const found = document.querySelector<HTMLElement>("[data-recipe]");
  if (!found) return;
  const root: HTMLElement = found;
  const slug = root.dataset.recipe!;
  const baseServings = parseFloat(root.dataset.servings || "") || null;

  // ---------- scaler ----------
  let factor = 1;
  const yieldEl = root.querySelector<HTMLElement>("[data-yield]");
  function applyScale() {
    root.querySelectorAll<HTMLElement>(".qty").forEach((el) => {
      if (factor === 1) {
        el.textContent = el.dataset.orig!;
        return;
      }
      const a = parseFloat(el.dataset.q!) * factor;
      const b = el.dataset.q2 ? parseFloat(el.dataset.q2) * factor : null;
      const sep = el.dataset.orig!.match(/\s*(to|–|-)\s*/)?.[0] ?? " to ";
      el.textContent = b !== null ? `${formatQty(a)}${sep}${formatQty(b)}` : formatQty(a);
    });
    root.querySelectorAll<HTMLButtonElement>("[data-scale]").forEach((b) =>
      b.setAttribute("aria-pressed", String(parseFloat(b.dataset.scale!) === factor)),
    );
    if (yieldEl) {
      const orig = yieldEl.dataset.orig!;
      if (factor === 1) yieldEl.textContent = orig;
      else if (baseServings) yieldEl.textContent = `Serves ${formatQty(baseServings * factor)} (${factor === 0.5 ? "½" : factor}× the recipe)`;
      else yieldEl.textContent = `${factor === 0.5 ? "½" : factor}× ${orig.replace(/^Makes /, "")}`;
    }
    const note = document.querySelector("[data-cook-scale-note]");
    if (note) note.textContent = factor === 1 ? "" : `Scaled to ${factor === 0.5 ? "½" : factor}×`;
  }
  root.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-scale]");
    if (!b) return;
    factor = parseFloat(b.dataset.scale!);
    applyScale();
    toast(factor === 1 ? "Back to the original amounts" : `Amounts ${factor === 0.5 ? "halved" : `× ${factor}`}`);
  });

  // ---------- metric ----------
  const metricBtn = root.querySelector<HTMLButtonElement>("[data-metric]");
  function applyMetric(on: boolean) {
    root.querySelectorAll<HTMLElement>(".unit-us").forEach((el) => (el.hidden = on));
    root.querySelectorAll<HTMLElement>(".unit-metric").forEach((el) => (el.hidden = !on));
    metricBtn?.setAttribute("aria-pressed", String(on));
  }
  if (metricBtn) {
    applyMetric(load("metric", false));
    metricBtn.addEventListener("click", () => {
      const on = metricBtn.getAttribute("aria-pressed") !== "true";
      save("metric", on);
      applyMetric(on);
    });
  }

  // ---------- checklist ----------
  const tickKey = `ticks:${slug}`;
  const boxes = [...root.querySelectorAll<HTMLInputElement>("[data-tick]")];
  const clearBtn = root.querySelector<HTMLButtonElement>("[data-clear-ticks]");
  const countEl = root.querySelector<HTMLElement>("[data-tick-count]");
  function paintTicks() {
    const n = boxes.filter((b) => b.checked).length;
    if (clearBtn) clearBtn.hidden = n === 0;
    if (countEl) countEl.textContent = n ? `${n} of ${boxes.length} ticked off` : `${boxes.length} ingredients`;
  }
  const saved = new Set(load<string[]>(tickKey, []));
  boxes.forEach((b) => (b.checked = saved.has(b.dataset.tick!)));
  root.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (!t.matches("[data-tick]")) return;
    save(tickKey, boxes.filter((b) => b.checked).map((b) => b.dataset.tick));
    paintTicks();
  });
  clearBtn?.addEventListener("click", () => {
    boxes.forEach((b) => (b.checked = false));
    save(tickKey, []);
    paintTicks();
  });
  paintTicks();

  // ---------- Ask Linda tips ----------
  root.querySelectorAll<HTMLButtonElement>("[data-tip-btn]").forEach((b) =>
    b.addEventListener("click", () => {
      const panel = document.getElementById(`tip-${b.dataset.tipBtn}`)!;
      const open = b.getAttribute("aria-expanded") !== "true";
      b.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
    }),
  );

  // ---------- made it ----------
  const madeCount = root.querySelector<HTMLElement>("[data-made-count]");
  function paintStamps() {
    const s = stamps.forRecipe(slug);
    if (!madeCount) return;
    madeCount.hidden = s.length === 0;
    const last = s[0] ? new Date(s[0].date).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "";
    madeCount.innerHTML = s.length
      ? `🎉 You’ve made this ${s.length === 1 ? "once" : `${s.length} times`} — last on ${last}. <a href="/passport" class="underline text-tomato">See your passport</a>`
      : "";
  }
  root.querySelector("[data-made-it]")?.addEventListener("click", () => {
    stamps.add(slug);
    confetti();
    toast("Stamped in your recipe passport! 🎉");
    paintStamps();
  });
  paintStamps();

  // ---------- print ----------
  root.querySelectorAll<HTMLButtonElement>("[data-print]").forEach((b) =>
    b.addEventListener("click", () => {
      document.documentElement.classList.toggle("print-card", b.dataset.print === "card");
      b.closest("details")?.removeAttribute("open");
      setTimeout(() => window.print(), 50);
    }),
  );
  window.addEventListener("afterprint", () => document.documentElement.classList.remove("print-card"));

  // ---------- card flip ----------
  const flipBtn = root.querySelector<HTMLButtonElement>("[data-flip-btn]");
  flipBtn?.addEventListener("click", () => {
    const inner = root.querySelector<HTMLElement>(".flip-inner")!;
    const on = flipBtn.getAttribute("aria-pressed") !== "true";
    flipBtn.setAttribute("aria-pressed", String(on));
    inner.style.transform = on ? "rotateY(180deg)" : "";
    flipBtn.textContent = on ? "↺ Back to the dish" : "↺ See the original card";
  });

  // ---------- help form + family answers ----------
  initHelpForms();
  loadFamilyContent(slug);

  // ---------- cook mode ----------
  initCookMode(root);
}

export function initHelpForms() {
  document.querySelectorAll<HTMLFormElement>("[data-help-form]").forEach((form) =>
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = form.querySelector<HTMLElement>("[data-help-status]")!;
      const btn = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
      const data = Object.fromEntries(new FormData(form));
      btn.disabled = true;
      status.textContent = "Sending…";
      try {
        const res = await fetch("/api/answers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
        status.textContent = "Thank you! Lyle will read it before it goes in the book. ♥";
        form.reset();
        try { localStorage.setItem("lk:name", JSON.stringify(data.name)); } catch {}
      } catch (err) {
        status.textContent = `Sorry, that didn’t send (${(err as Error).message}). Please try again.`;
      } finally {
        btn.disabled = false;
      }
    }),
  );
  // remember the family member's name
  const name = load<string>("name", "");
  if (name) document.querySelectorAll<HTMLInputElement>("[data-help-form] input[name=name]").forEach((i) => (i.value = name));
}

async function loadFamilyContent(slug: string) {
  const box = document.querySelector<HTMLElement>("[data-family-answers]");
  if (!box) return;
  try {
    const res = await fetch(`/api/approved?slug=${encodeURIComponent(slug)}`);
    if (!res.ok) return;
    const data = (await res.json()) as { answers: { name: string; answer: string; date: string }[]; photos: { id: string; name: string; caption: string; url: string }[] };
    const list = box.querySelector("[data-answers-list]")!;
    const photos = box.querySelector("[data-photos-list]")!;
    for (const a of data.answers) {
      const li = document.createElement("li");
      li.className = "rounded-xl bg-card border border-line p-4";
      li.innerHTML = `<p></p><p class="mt-1 text-sm text-ink-soft">— <span></span></p>`;
      li.querySelector("p")!.textContent = a.answer;
      li.querySelector("span")!.textContent = a.name;
      list.appendChild(li);
    }
    for (const p of data.photos) {
      const fig = document.createElement("figure");
      fig.className = "rounded-xl overflow-hidden bg-card border border-line";
      fig.innerHTML = `<img class="w-full aspect-square object-cover" loading="lazy" alt=""><figcaption class="p-2 text-sm"></figcaption>`;
      const img = fig.querySelector("img")!;
      img.src = p.url;
      img.alt = p.caption || `Photo by ${p.name}`;
      fig.querySelector("figcaption")!.textContent = `${p.caption ? p.caption + " — " : ""}${p.name}`;
      photos.appendChild(fig);
    }
    if (data.answers.length || data.photos.length) box.classList.remove("hidden");
  } catch {
    /* offline or functions not deployed: stay hidden */
  }
}

function initCookMode(root: HTMLElement) {
  const dlg = document.getElementById("cook-mode");
  if (!dlg) return;
  const track = dlg.querySelector<HTMLElement>("[data-cook-track]")!;
  const slides = [...dlg.querySelectorAll<HTMLElement>(".cook-slide")];
  const progress = dlg.querySelector<HTMLElement>("[data-cook-progress]")!;
  const prevBtn = dlg.querySelector<HTMLButtonElement>("[data-cook-prev]")!;
  const nextBtn = dlg.querySelector<HTMLButtonElement>("[data-cook-next]")!;
  const wakeStatus = dlg.querySelector<HTMLElement>("[data-wake-status]");
  let idx = 0;
  let lock: WakeLockSentinel | null = null;
  let lastFocus: HTMLElement | null = null;

  function go(i: number) {
    idx = Math.max(0, Math.min(slides.length - 1, i));
    track.style.transform = `translateX(-${idx * 100}%)`;
    slides.forEach((s, j) => {
      s.toggleAttribute("inert", j !== idx);
      s.setAttribute("aria-hidden", String(j !== idx));
    });
    progress.style.width = `${(idx / (slides.length - 1)) * 100}%`;
    prevBtn.disabled = idx === 0;
    nextBtn.innerHTML = idx === slides.length - 1 ? "Done 🎉" : `Next <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>`;
    slides[idx].scrollTop = 0;
  }

  async function requestWake() {
    try {
      if ("wakeLock" in navigator) {
        lock = await navigator.wakeLock.request("screen");
        if (wakeStatus) wakeStatus.textContent = "☀︎ Screen stays on";
        lock.addEventListener("release", () => wakeStatus && (wakeStatus.textContent = ""));
      }
    } catch {
      /* not allowed (e.g. low battery) */
    }
  }

  function open() {
    // fill the ingredients slide from the (possibly scaled / metric) list
    const ing = dlg!.querySelector("[data-cook-ingredients]")!;
    ing.innerHTML = "";
    root.querySelectorAll<HTMLElement>(".ing").forEach((label) => {
      const p = document.createElement("p");
      p.className = "break-inside-avoid mb-3 flex gap-3";
      const box = label.querySelector<HTMLInputElement>("input");
      p.innerHTML = `<span aria-hidden="true">${box?.checked ? "✓" : "•"}</span><span></span>`;
      const text = label.querySelector("span")!.cloneNode(true) as HTMLElement;
      text.querySelectorAll("[hidden]").forEach((h) => h.remove());
      p.lastElementChild!.replaceWith(text);
      ing.appendChild(p);
    });
    lastFocus = document.activeElement as HTMLElement;
    dlg!.hidden = false;
    document.body.style.overflow = "hidden";
    go(idx);
    requestWake();
    nextBtn.focus();
  }
  function close() {
    dlg!.hidden = true;
    document.body.style.overflow = "";
    lock?.release().catch(() => {});
    lock = null;
    stopVoice();
    lastFocus?.focus();
  }

  root.querySelector("[data-open-cook]")?.addEventListener("click", open);
  dlg.querySelector("[data-close-cook]")!.addEventListener("click", close);
  prevBtn.addEventListener("click", () => go(idx - 1));
  nextBtn.addEventListener("click", () => {
    if (idx === slides.length - 1) {
      close();
      if (!reducedMotion()) confetti();
      toast("Enjoy! Tap “We made it!” to stamp your passport.");
    } else go(idx + 1);
  });
  document.addEventListener("visibilitychange", () => {
    if (!dlg.hidden && document.visibilityState === "visible") requestWake();
  });
  document.addEventListener("keydown", (e) => {
    if (dlg.hidden) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") go(idx + 1);
    else if (e.key === "ArrowLeft" || e.key === "PageUp") go(idx - 1);
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") {
      // keep focus inside the dialog
      const f = [...dlg.querySelectorAll<HTMLElement>("button:not([disabled]):not([hidden]), a[href]")].filter(
        (el) => !el.closest("[inert]") && el.offsetParent !== null,
      );
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  // swipe
  const vp = dlg.querySelector<HTMLElement>("[data-cook-viewport]")!;
  let x0: number | null = null;
  let y0 = 0;
  vp.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  vp.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) go(idx + (dx < 0 ? 1 : -1));
    x0 = null;
  });

  // ---------- voice (Tier 3): "next", "back", "repeat", "start timer" ----------
  const voiceBtn = dlg.querySelector<HTMLButtonElement>("[data-voice]")!;
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  let rec: any = null;
  let listening = false;
  const hint = dlg.querySelector<HTMLElement>("[data-voice-hint]");
  function say(text: string) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      speechSynthesis.speak(u);
    } catch {}
  }
  function readCurrent() {
    const s = slides[idx];
    const h = s.querySelector("h2")?.textContent ?? "";
    const body = s.querySelector("[data-say]")?.textContent ?? "";
    say(`${h} ${body}`.replace(/⏱/g, ""));
  }
  function stopVoice() {
    listening = false;
    try { rec?.stop(); } catch {}
    voiceBtn.setAttribute("aria-pressed", "false");
    if (hint) hint.textContent = "Swipe, or use ← → keys";
  }
  if (SR) {
    voiceBtn.hidden = false;
    voiceBtn.addEventListener("click", () => {
      if (listening) return stopVoice();
      rec = new SR();
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (ev: any) => {
        const said = String(ev.results[ev.results.length - 1][0].transcript).toLowerCase();
        if (/\b(next|continue|forward)\b/.test(said)) { go(idx + 1); readCurrent(); }
        else if (/\b(back|previous|go back)\b/.test(said)) { go(idx - 1); readCurrent(); }
        else if (/\b(repeat|again|read)\b/.test(said)) readCurrent();
        else if (/\btimer\b/.test(said)) {
          const chip = slides[idx].querySelector<HTMLElement>("[data-timer-min]");
          if (chip) { chip.click(); say("Timer started."); } else say("There's no timer on this step.");
        } else if (/\b(stop|exit|close)\b/.test(said)) close();
      };
      rec.onend = () => { if (listening) try { rec.start(); } catch {} };
      rec.onerror = (ev: any) => {
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          stopVoice();
          toast("Microphone permission is needed for voice control.");
        }
      };
      try {
        rec.start();
        listening = true;
        voiceBtn.setAttribute("aria-pressed", "true");
        if (hint) hint.textContent = "Listening: say “next”, “back”, “repeat” or “start timer”";
        toast("Say “next”, “back”, “repeat” or “start timer”");
      } catch {
        toast("Voice control isn’t available here.");
      }
    });
  }
}
