import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve a module's own directory in a way that works both:
 *  - in development, where `tsx server/index.ts` runs this as real ESM
 *    (no native __dirname; import.meta.url is a proper file:// URL), and
 *  - in production, where script/build.ts bundles the server to CommonJS
 *    with esbuild. esbuild does NOT rewrite `import.meta.url` for a CJS
 *    output format (it evaluates to undefined there), but it DOES correctly
 *    bind bare `__dirname`/`__filename` references to the real per-file
 *    CommonJS values at bundle time.
 *
 * Pass `import.meta.url` from the calling module plus its own CJS-style
 * `__dirname`/`__filename` (declared with `declare const` in that module) so
 * whichever one is actually valid at runtime gets used.
 */
export function resolveModuleDir(importMetaUrl: string | undefined, cjsDirname: string | undefined): string {
  if (importMetaUrl) {
    try {
      return path.dirname(fileURLToPath(importMetaUrl));
    } catch {
      // fall through
    }
  }
  if (cjsDirname) return cjsDirname;
  return path.resolve(".");
}
