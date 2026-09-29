// Private preview only: stubbed storage, no database, email, or payments.
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { registerRoutes } from "../server/routes";
import { restrictPublicDashboardDemo } from "../server/auth";
import { DASHBOARD_DEMO_TOKEN, DASHBOARD_DEMO_WAVE_ID } from "../shared/dashboardDemo";
import { installDashboardDemoFixture } from "./dashboard-demo-fixture";
await installDashboardDemoFixture(true);
const app = express();
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  if (req.method !== "GET" && req.method !== "HEAD") return res.status(403).json({ message: "Read-only isolated preview" });
  next();
});
app.use(express.json());
app.use("/api", restrictPublicDashboardDemo);
for (const [route, file] of [
  ["report.pdf", "jesus-journey-sample-church-report.pdf"],
  ["comments-report.pdf", "jesus-journey-sample-comments-report.pdf"],
]) app.get(`/api/waves/${DASHBOARD_DEMO_WAVE_ID}/${route}`, (req, res) => {
  if (req.headers.authorization !== `Bearer ${DASHBOARD_DEMO_TOKEN}`) return res.sendStatus(401);
  res.type("pdf").sendFile(path.resolve(process.env.DEMO_PUBLIC_ASSETS!, file));
});
const server = createServer(app);
await registerRoutes(server, app);
app.use(express.static(process.env.PREVIEW_DIR!));
app.use((err: Error, _req: any, res: any, _next: any) => res.status(500).json({ message: err.message }));
server.listen(5000, "0.0.0.0", () => console.log("Public-demo isolated preview ready"));
