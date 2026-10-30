// Local-only component preview. It never starts or modifies the real application.
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const server = await createServer({ configFile: false, root, resolve: { alias: { "@": root } },
  server: { host: "127.0.0.1", port: 4174, strictPort: true, watch: { ignored: ["**/.next/**", "**/.next-qa/**", "**/outputs/**", "**/work/**"] } },
  plugins: [react(), { name: "administration-fixture", configureServer(vite) { vite.middlewares.use(async (request, response, next) => {
    if (request.url?.split("?")[0] !== "/") return next();
    try { const html = await vite.transformIndexHtml("/", '<!doctype html><html lang="fa" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/scripts/admin-browser-fixture.jsx"></script></body></html>'); response.setHeader("Content-Type", "text/html; charset=utf-8"); response.end(html); } catch (error) { next(error); }
  }); } }],
});
await server.listen(); console.log("Administration UI fixture: http://127.0.0.1:4174");
process.on("SIGINT", async () => { await server.close(); process.exit(0); });
