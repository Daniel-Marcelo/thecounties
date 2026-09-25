import { resolve } from "node:path";
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from "vite";

const PACK_ROUTES: Record<string, string> = {
  "/ireland": "/pack.html",
  "/ireland/": "/pack.html",
  "/brazil": "/pack.html",
  "/brazil/": "/pack.html",
  "/europe": "/pack.html",
  "/europe/": "/pack.html",
};

function rewritePackRoutes(req: { url?: string }): void {
  const path = req.url?.split("?")[0] ?? "";
  const query = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const target = PACK_ROUTES[path];
  if (target) req.url = `${target}${query}`;
}

function packRoutes(): Plugin {
  const apply = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use((req, _res, next) => {
      rewritePackRoutes(req);
      next();
    });
  };

  return {
    name: "pack-routes",
    configureServer: apply,
    configurePreviewServer: apply,
  };
}

export default defineConfig({
  plugins: [packRoutes()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        pack: resolve(__dirname, "pack.html"),
      },
    },
  },
});
