import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// Locks the page to its own scripts and 7TV/decapi, so the token can't be sent anywhere else.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' https://cdn.7tv.app",
  "connect-src https://7tv.io https://decapi.me",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

export default defineConfig({
  base: "./",
  // Lets kebab-case class names in *.module.css be used as styles.camelCase.
  css: { modules: { localsConvention: "camelCaseOnly" } },
  plugins: [
    preact(),
    {
      // Build only: the dev server relies on inline styles and a websocket that this policy blocks.
      name: "csp",
      apply: "build",
      transformIndexHtml: () => [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
          injectTo: "head-prepend",
        },
      ],
    },
  ],
});
