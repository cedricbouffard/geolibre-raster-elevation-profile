import { defineConfig } from "vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: resolve(root, "src/plugin.ts"),
      formats: ["es"],
      fileName: () => "index.js",
    },
    outDir: "geolibre-plugin/dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    sourcemap: false,
    minify: false,
    rollupOptions: {
      external: ["maplibre-gl"],
      output: { assetFileNames: "style.css" },
    },
  },
});
