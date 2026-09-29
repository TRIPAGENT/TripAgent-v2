import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * The TripAgent backend (Chatbot_v1/tripagent, `npm run local`) refuses any request
 * whose Host is not localhost, and any cross-origin request. Both are deliberate —
 * it is a local-only portal holding a real API key and a traveller's memory.
 *
 * So the browser never talks to it directly. Everything goes through this proxy on
 * the app's own origin: Vite rewrites Host to the backend's, and we drop the
 * browser's Origin header so the backend sees a same-origin local call. The
 * security posture of the skeleton is preserved rather than loosened.
 */
const AGENT_ORIGIN = process.env.AGENT_ORIGIN ?? "http://127.0.0.1:3000";

/**
 * The dev proxy exists only on this machine. A deployed build has no proxy, so
 * `VITE_AGENT_URL` must name the agent's public https address or every call the
 * app makes — sign-in, chat, itineraries, requests — resolves to /agent on the
 * static host and 404s. That failure looks like "the Desk is not reachable",
 * which is indistinguishable from a real outage, so it is caught here instead:
 * a CI or Vercel build without it fails rather than shipping a dead app.
 */
function assertAgentUrl(mode: string) {
  if (mode !== "production") return;
  const url = process.env.VITE_AGENT_URL?.trim();
  const onHost = Boolean(process.env.VERCEL || process.env.CI);
  if (url) {
    if (!/^https:\/\//.test(url)) {
      throw new Error(
        `VITE_AGENT_URL must be an https:// address. Got: ${url}`,
      );
    }
    return;
  }
  const message =
    "VITE_AGENT_URL is not set. A deployed build cannot reach the agent through " +
    "the dev proxy; set it to the agent’s public https address (see DEPLOY.md).";
  if (onHost) throw new Error(message);
  console.warn(
    `\n  ⚠  ${message}\n     Fine for a local production test; not for a deploy.\n`,
  );
}

export default defineConfig(({ mode }) => {
  assertAgentUrl(mode);
  return {
    plugins: [react()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: 5173,
      proxy: {
        "/agent": {
          target: AGENT_ORIGIN,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/agent/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.removeHeader("origin");
              proxyReq.removeHeader("referer");
            });
          },
        },
      },
    },
  };
});
