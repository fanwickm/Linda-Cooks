// Family password gate. Every page and API call needs the shared family
// password (SITE_PASSWORD). Once entered, a cookie remembers this device for a year.
// If SITE_PASSWORD is not set, the site is open (handy for previews).
import type { Config, Context } from "@netlify/edge-functions";

const COOKIE = "lk_family";

async function tokenFor(password: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("lindas-kitchen-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function loginPage(error = false, next = "/"): Response {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Linda’s Kitchen</title><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
:root{--paper:#fbf6ec;--ink:#2a221c;--soft:#5c5047;--tomato:#b2372a;--line:#e5d9c3}
*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;background:var(--paper);color:var(--ink);font:18px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:16px}
.card{background:#fffdf8;border:1px solid var(--line);border-radius:24px;padding:32px 24px;max-width:420px;width:100%;text-align:center;box-shadow:0 18px 40px -24px rgba(60,40,20,.5)}
h1{font-family:Georgia,"Iowan Old Style",serif;font-size:2.4rem;margin:.4rem 0 .2rem;letter-spacing:-.01em}p{color:var(--soft);margin:.2rem 0 1.2rem}
label{display:block;text-align:left;font-weight:600;margin-bottom:6px}
input{width:100%;min-height:52px;border:2px solid var(--line);border-radius:14px;padding:0 14px;font-size:1.1rem;background:#fff}
input:focus{outline:3px solid #c9962f;border-color:#c9962f}
button{margin-top:14px;width:100%;min-height:52px;border:0;border-radius:999px;background:var(--tomato);color:#fff;font-weight:700;font-size:1.1rem;cursor:pointer}
.err{color:var(--tomato);font-weight:600;margin-top:12px}
</style></head><body><main class="card">
<img src="/favicon.svg" width="64" height="64" alt="">
<h1>Linda’s Kitchen</h1><p>The family recipe box. Please enter the family password.</p>
<form method="post" action="/__family-login">
<input type="hidden" name="next" value="${esc(next)}">
<label for="pw">Family password</label>
<input id="pw" name="password" type="password" autocomplete="current-password" required autofocus>
<button type="submit">Come on in</button>
${error ? '<p class="err" role="alert">That’s not quite it — try again, or ask the family.</p>' : ""}
</form></main></body></html>`;
  return new Response(html, {
    status: error ? 401 : 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}

export default async (req: Request, context: Context) => {
  const password = Netlify.env.get("SITE_PASSWORD");
  if (!password) return context.next();

  const url = new URL(req.url);
  const expected = await tokenFor(password);

  if (url.pathname === "/__family-login" && req.method === "POST") {
    const form = await req.formData();
    const next = String(form.get("next") || "/");
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    if (String(form.get("password") ?? "") === password) {
      return new Response(null, {
        status: 303,
        headers: {
          location: safeNext,
          "set-cookie": `${COOKIE}=${expected}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }
    return loginPage(true, safeNext);
  }

  if (context.cookies.get(COOKIE) === expected) return context.next();

  if (url.pathname.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: "Family password needed" }), { status: 401, headers: { "content-type": "application/json" } });
  }
  return loginPage(false, url.pathname + url.search);
};

export const config: Config = {
  path: "/*",
  excludedPath: ["/favicon.svg", "/apple-touch-icon.png", "/manifest.webmanifest", "/robots.txt"],
};
