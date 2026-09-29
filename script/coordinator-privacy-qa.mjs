const { default: assert } = await import("node:assert/strict");
const { mkdir, writeFile } = await import("node:fs/promises");

// Local fixtures or read-only public demo. All writes are blocked in either mode.
export async function runCoordinatorPrivacyQa(browser, base, out, live = false) {
  await mkdir(out, { recursive: true });
  const results = [];
  for (const width of [1280, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage(), errors = [], writes = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
      if (!["GET", "HEAD"].includes(route.request().method())) {
        writes.push(route.request().url());
        return route.abort();
      }
      if (!live && new URL(route.request().url()).pathname.startsWith("/api/")) {
        return route.fulfill({ json: { waves: [] } });
      }
      return route.continue();
    });
    try {
      await page.goto(`${base}/#/demo`);
      await page.getByRole("tab", { name: /Prepare/ }).click();
      const note = page.getByTestId("coordinator-privacy-note");
      await note.waitFor();
      const text = (await note.innerText()).replace(/\s+/g, " ");
      for (const phrase of [
        "Demographics and privacy", "requires a selection", "Prefer not to say",
        "gender, relationship status, and ethnic or cultural background",
        "fewer than 10 respondents", "written insights", "Additional results may be withheld",
        "never guess a missing answer", "Do not try to identify",
      ]) assert(text.includes(phrase), phrase);
      assert(!/voluntary|skip this question/i.test(text));
      assert.equal(await note.locator("li").count(), 3);
      assert.equal(await page.getByText("Understanding the Survey", { exact: true }).count(), 1);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await note.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${out}/coordinator-${live ? "live" : "local"}-${width}.png`, fullPage: true });
      const link = page.getByTestId("link-coordinator-privacy");
      assert.equal(await link.getAttribute("href"), "#/privacy");
      assert.equal(await link.getAttribute("target"), "_blank");
      assert((await link.getAttribute("rel")).includes("noopener"));
      const popupPromise = context.waitForEvent("page");
      await link.click();
      const popup = await popupPromise;
      await popup.getByRole("heading", { name: "Survey privacy notice", exact: true }).waitFor();
      assert.equal(new URL(popup.url()).hash, "#/privacy");
      assert(await note.isVisible(), "Prepare stays open");
      await popup.close();
      await page.getByRole("tab", { name: /Collect/ }).click();
      assert.equal(await page.getByTestId("coordinator-privacy-note").count(), 0);
      await page.getByRole("tab", { name: /Prepare/ }).click();
      await note.waitFor();
      assert.equal(writes.length, 0);
      assert.equal(errors.length, 0, errors.join("\n"));
      results.push({ width, live, result: "passed", errors: 0, writes: 0 });
    } finally {
      await context.close();
    }
  }
  await writeFile(`${out}/coordinator-${live ? "live" : "local"}-results.json`, JSON.stringify(results, null, 2));
  return results;
}
