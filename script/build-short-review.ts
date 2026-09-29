// A separate bundle, never part of npm run build or the production entry.
import { build, mergeConfig } from "vite";
import config from "../vite.config";
import { renameSync, mkdirSync, cpSync, existsSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
await build(mergeConfig(config, {
  base: "./",
  build: { outDir: path.join(root, "dist-review"), rollupOptions: { input: path.join(root, "client/review.html") } },
}));
renameSync(path.join(root, "dist-review/review.html"), path.join(root, "dist-review/index.html"));
mkdirSync(path.join(root, "dist-review/samples"), { recursive: true });
for (const name of ["mixed-church", "mixed-comments", "mixed-debrief", "short-only-church", "small-church"]) {
  const source = path.join(root, `qa-output/${name}.pdf`);
  if (!existsSync(source)) throw Error("Generate synthetic review PDFs first: npx tsx script/render-short-qa.ts");
  cpSync(source, path.join(root, `dist-review/samples/${name}.pdf`));
}
