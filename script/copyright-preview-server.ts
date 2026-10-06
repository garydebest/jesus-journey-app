// Local preview for the copyright release: built client + real routes with all
// storage access stubbed out. No database, payment, or email access.
import express from "express";
import path from "node:path";
import { createServer } from "node:http";
import { storage } from "../server/storage";
import { registerRoutes } from "../server/routes";
for (const key of Object.keys(storage)) {
  if (typeof (storage as any)[key] === "function") (storage as any)[key] = async () => { throw Error("Unexpected storage access"); };
}
const app = express();
app.use(express.json());
const server = createServer(app);
await registerRoutes(server, app);
app.use(express.static(path.resolve("dist/public")));
server.listen(Number(process.env.PORT || 5055), "127.0.0.1", () => console.log("preview ready"));
