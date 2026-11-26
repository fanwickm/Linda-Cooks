// Tap-to-start kitchen timers. Several can run at once; they survive page
// navigation (end times are kept in sessionStorage) and chime when done.
interface Timer { id: string; label: string; end: number; total: number; done?: boolean }

const KEY = "lk:timers";
let timers: Timer[] = [];
let tick: number | undefined;
let audio: AudioContext | undefined;

function persist() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(timers.filter((t) => !t.done)));
  } catch {}
}
function restore() {
  try {
    timers = JSON.parse(sessionStorage.getItem(KEY) || "[]");
  } catch {
    timers = [];
  }
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

export function chime() {
  try {
    audio ??= new AudioContext();
    const now = audio.currentTime;
    [0, 0.35, 0.7].forEach((d, i) => {
      const o = audio!.createOscillator();
      const g = audio!.createGain();
      o.type = "sine";
      o.frequency.value = [880, 1108.7, 1318.5][i];
      g.gain.setValueAtTime(0.0001, now + d);
      g.gain.exponentialRampToValueAtTime(0.35, now + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + d + 0.9);
      o.connect(g).connect(audio!.destination);
      o.start(now + d);
      o.stop(now + d + 1);
    });
  } catch {}
  try {
    navigator.vibrate?.([300, 120, 300, 120, 500]);
  } catch {}
}

function render() {
  const tray = document.getElementById("timer-tray");
  if (!tray) return;
  const list = tray.querySelector<HTMLElement>("[data-timer-list]")!;
  tray.hidden = timers.length === 0;
  list.innerHTML = "";
  for (const t of timers) {
    const left = t.end - Date.now();
    const li = document.createElement("li");
    li.className = `flex items-center gap-3 rounded-2xl px-3 py-2 ${t.done ? "bg-tomato text-white animate-pulse" : "bg-card border border-line"}`;
    li.innerHTML = `
      <span class="text-2xl font-semibold tabular-nums min-w-[4.5ch]" aria-live="off">${t.done ? "Done!" : fmt(left)}</span>
      <span class="flex-1 text-sm leading-tight line-clamp-2">${t.label.replace(/</g, "&lt;")}</span>
      ${t.done ? "" : `<button type="button" class="chip !min-h-[40px] !px-3" data-add="${t.id}" aria-label="Add one minute">+1</button>`}
      <button type="button" class="chip !min-h-[40px] !px-3" data-stop="${t.id}" aria-label="${t.done ? "Dismiss" : "Cancel"} timer">${t.done ? "OK" : "✕"}</button>`;
    list.appendChild(li);
  }
}

function loop() {
  let changed = false;
  for (const t of timers) {
    if (!t.done && Date.now() >= t.end) {
      t.done = true;
      changed = true;
      chime();
      const live = document.getElementById("timer-live");
      if (live) live.textContent = `Timer done: ${t.label}`;
      try {
        if (document.hidden && "Notification" in window && Notification.permission === "granted") {
          new Notification("Linda’s Kitchen timer", { body: t.label });
        }
      } catch {}
    }
  }
  if (changed) persist();
  render();
  if (!timers.length) {
    clearInterval(tick);
    tick = undefined;
  }
}

export function startTimer(minutes: number, label: string) {
  const id = Math.random().toString(36).slice(2, 8);
  const total = minutes * 60_000;
  timers.push({ id, label: `${label} — ${minutes} min`, end: Date.now() + total, total });
  persist();
  // unlock audio on this user gesture so the chime can play later (iOS)
  try {
    audio ??= new AudioContext();
    audio.resume();
  } catch {}
  try {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  } catch {}
  tick ??= window.setInterval(loop, 500);
  loop();
}

export function initTimers() {
  restore();
  const tray = document.getElementById("timer-tray");
  tray?.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    if (b.dataset.stop) timers = timers.filter((t) => t.id !== b.dataset.stop);
    if (b.dataset.add) {
      const t = timers.find((x) => x.id === b.dataset.add);
      if (t) t.end += 60_000;
    }
    persist();
    loop();
  });
  document.addEventListener("click", (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>("[data-timer-min]");
    if (!chip) return;
    e.preventDefault();
    const min = parseFloat(chip.dataset.timerMin!);
    startTimer(min, chip.dataset.timerLabel || "Timer");
  });
  if (timers.length) tick ??= window.setInterval(loop, 500);
  render();
}
