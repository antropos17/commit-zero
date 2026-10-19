import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
export default {
  root: resolve("prototype"),
  publicDir: false,
  cacheDir: resolve(".cache/vite"),
  plugins: [
    react(),
    {
      name: "workspace-entry",
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url === "/" || request.url === "/index.html")
            request.url = "/social.html";
          next();
        });
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
    proxy: { "/api": `http://127.0.0.1:${process.env.API_PORT || 4174}` },
    fs: { strict: true },
  },
  build: {
    outDir: resolve("dist"),
    emptyOutDir: true,
    rollupOptions: { input: resolve("prototype/social.html") },
  },
};
