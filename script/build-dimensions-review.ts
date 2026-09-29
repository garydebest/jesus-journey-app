import { build, mergeConfig } from "vite";
import config from "../vite.config";
import { renameSync, mkdirSync, cpSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "dist-dimensions-review");
await build(mergeConfig(config, {
  base: "./",
  build: { outDir: out, rollupOptions: { input: path.join(root, "client/dimensions-review.html") } },
}));
renameSync(path.join(out, "dimensions-review.html"), path.join(out, "index.html"));
mkdirSync(path.join(out, "samples"), { recursive: true });
for (const name of ["current-debrief", "saved-debrief", "saved-church"]) {
  cpSync(path.join(root, `qa-output/${name}.pdf`), path.join(out, `samples/${name}.pdf`));
}
