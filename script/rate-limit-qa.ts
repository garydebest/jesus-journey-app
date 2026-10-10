import assert from "node:assert/strict";
import { Limiter, safeEqual, clientAddress, accountKey } from "../server/rate-limit";
let t = 0; const now = () => t; let n = 0;
const check = (name: string, fn: () => void) => { fn(); n++; console.log("PASS", name); };
check("allows up to max then blocks", () => {
  const l = new Limiter(3, 1000, now); for (let i = 0; i < 3; i++) { assert.equal(l.blockedFor("a"), 0); l.hit("a"); }
  assert.ok(l.blockedFor("a") > 0); assert.equal(l.blockedFor("b"), 0);
});
check("window expiry unblocks", () => { const l = new Limiter(1, 1000, now); l.hit("a"); assert.ok(l.blockedFor("a") > 0); t += 1001; assert.equal(l.blockedFor("a"), 0); });
check("clear resets", () => { const l = new Limiter(1, 1000, now); l.hit("a"); l.clear("a"); assert.equal(l.blockedFor("a"), 0); });
check("safeEqual", () => { assert.ok(safeEqual("abc", "abc")); assert.ok(!safeEqual("abc", "abd")); assert.ok(!safeEqual("abc", "abcd")); });
check("account key normalises", () => { assert.equal(accountKey("  A@B.org "), "a@b.org"); assert.equal(accountKey(undefined), ""); });
check("client address prefers proxy headers", () => {
  const req: any = { headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" }, ip: "9.9.9.9", socket: {} };
  assert.equal(clientAddress(req), "1.1.1.1");
  req.headers["true-client-ip"] = "3.3.3.3"; assert.equal(clientAddress(req), "3.3.3.3");
});
console.log(`${n} checks passed`);
