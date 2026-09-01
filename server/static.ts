import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";
import { resolveModuleDir } from "./paths";

// See server/paths.ts for why this can't just be `fileURLToPath(import.meta.url)`
// (breaks once script/build.ts bundles this file to CommonJS for production).
const moduleDir = resolveModuleDir(
  typeof import.meta !== "undefined" ? import.meta.url : undefined,
  typeof __dirname !== "undefined" ? __dirname : undefined,
);

export function serveStatic(app: Express) {
  const distPath = path.resolve(moduleDir, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
