import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import { securityHeaders, safeServerErrorMessage } from "./security";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "node:http";
import { ensureBootstrapped } from "./storage";

const app = express();
app.disable("x-powered-by");
app.use(securityHeaders);
const httpServer = createServer(app);

// Search visibility: the public front door is jesusjourney.life. Keep every
// page, report and file on this app domain out of search results. Crawling
// stays allowed so search engines can see the noindex signal.
app.use((_req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex");
  next();
});
app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send("# Jesus Journey survey app: pages are noindex; public site is https://jesusjourney.life/\nUser-agent: *\nAllow: /\n");
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const route = typeof req.route?.path === "string" ? req.route.path : "/api";
      let logLine = `${req.method} ${route} ${res.statusCode} in ${duration}ms`;
      // Never log response bodies: auth responses contain bearer tokens and
      // report responses can contain sensitive church information.

      log(logLine);
    }
  });

  next();
});

(async () => {
  await ensureBootstrapped();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = safeServerErrorMessage(status, err.message || "Internal Server Error");

    if (process.env.NODE_ENV === "production") console.error("Request failed", { status });
    else console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
