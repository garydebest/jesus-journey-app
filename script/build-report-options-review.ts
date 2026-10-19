// Separate private-review bundle, never part of npm run build or the production entry.
import { build, mergeConfig } from "vite";
import config from "../vite.config";
import { renameSync } from "node:fs";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "dist-report-options");
await build(mergeConfig(config, { base: "./", build: { outDir: out, emptyOutDir: true, rollupOptions: { input: path.join(root, "client/report-options-review.html") } } }));
renameSync(path.join(out, "report-options-review.html"), path.join(out, "index.html"));
