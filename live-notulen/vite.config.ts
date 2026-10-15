import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Header COOP/COEP juga di dev server supaya perilaku sama dengan Vercel (WASM multithread).
const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};

export default defineConfig({
  plugins: [react()],
  worker: { format: "es" },
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
  server: { headers: isolation },
  preview: { headers: isolation },
});
