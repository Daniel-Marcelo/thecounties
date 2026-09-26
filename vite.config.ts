import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from "vite";

const PACK_SLUGS = ["ireland", "brazil", "europe"] as const;
const GLOBLE_ROUTES: Record<string, string> = {
  "/globle": "/globle.html",
  "/globle/": "/globle.html",
};

const PACK_ROUTES: Record<string, string> = Object.fromEntries(
  PACK_SLUGS.flatMap((slug) => [
    [`/${slug}`, "/pack.html"],
    [`/${slug}/`, "/pack.html"],
  ]),
);

function rewritePackRoutes(req: { url?: string }): void {
  const path = req.url?.split("?")[0] ?? "";
  const query = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const target = PACK_ROUTES[path] ?? GLOBLE_ROUTES[path];
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
    writeBundle(options) {
      const outDir = options.dir ?? "dist";
      const pack = resolve(outDir, "pack.html");
      for (const slug of PACK_SLUGS) {
        const dir = resolve(outDir, slug);
        mkdirSync(dir, { recursive: true });
        copyFileSync(pack, resolve(dir, "index.html"));
      }
      const globleDir = resolve(outDir, "globle");
      mkdirSync(globleDir, { recursive: true });
      copyFileSync(resolve(outDir, "globle.html"), resolve(globleDir, "index.html"));
    },
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
        globle: resolve(__dirname, "globle.html"),
      },
    },
  },
});
