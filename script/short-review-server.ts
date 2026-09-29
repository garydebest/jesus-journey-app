// No storage, auth, payment, SMTP, or production server imports.
import express from "express";
import path from "node:path";
import { submitResponseSchema } from "../shared/submission";
const app = express();
app.use((_req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  next();
});
app.options("/{*path}", (_req, res) => res.sendStatus(204));
app.use(express.json());
app.get("/api/join/SHORTPREVIEW", (_req, res) => res.json({ churchName: "Review Church (synthetic)", waveLabel: "Practice survey" }));
app.post("/api/responses", (req, res) => {
  if (req.body.joinCode !== "SHORTPREVIEW") return res.status(403).json({ message: "Preview code only." });
  const parsed = submitResponseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid practice response" });
  // Validate and discard. No logs or persistent record of practice answers.
  res.status(201).json({ ok: true });
});
app.use("/api", (_req, res) => res.status(403).json({ message: "Unavailable in the isolated review." }));
app.use(express.static(path.resolve(import.meta.dirname, "../dist-review")));
app.listen(5000, "0.0.0.0", () => console.log("Isolated short-form review on port 5000"));
