import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import wails from "@wailsio/runtime/plugins/vite";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const PLACEHOLDER = fileURLToPath(new URL("./dist/.gitkeep", import.meta.url));
const PLACEHOLDER_TEXT = "placeholder so `go build ./...` works before the frontend is built\n";

/**
 * `emptyOutDir` wipes `dist/`, including the tracked `.gitkeep` that keeps
 * `go:embed all:dist` (frontend/embed.go) valid in a fresh checkout. Vite has
 * no "exclude from clean" option, so restore the placeholder after bundling.
 */
function keepDistPlaceholder(): Plugin {
  return {
    name: "hark:keep-dist-placeholder",
    apply: "build",
    closeBundle() {
      writeFileSync(PLACEHOLDER, PLACEHOLDER_TEXT);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: Number(process.env.WAILS_VITE_PORT) || 9245,
    strictPort: true,
  },
  plugins: [react(), tailwindcss(), wails("./bindings"), keepDistPlaceholder()],
});
