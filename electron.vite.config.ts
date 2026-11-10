import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "electron-vite";

const alias = { "@": resolve("src") };

export default defineConfig({
  main: { resolve: { alias } },
  preload: {
    resolve: { alias },
    build: { rollupOptions: { output: { format: "cjs", entryFileNames: "index.js" } } },
  },
  renderer: {
    root: ".",
    resolve: { alias },
    plugins: [react(), tailwindcss()],
    server: { host: "127.0.0.1", port: 5173, strictPort: true },
    build: { minify: true, rollupOptions: { input: resolve("index.html") } },
  },
});
