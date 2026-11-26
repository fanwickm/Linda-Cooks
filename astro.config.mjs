// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://lindas-kitchen.netlify.app",
  output: "static",
  trailingSlash: "ignore",
  // PREVIEW=1 builds plain .html files for the static preview (scripts/make-preview.mjs)
  build: { format: process.env.PREVIEW ? "file" : "directory", assets: process.env.PREVIEW ? "assets" : "_astro" },
  vite: { plugins: [tailwindcss()] },
});
