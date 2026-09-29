const { default: assert } = await import("node:assert/strict");
const { mkdir, writeFile } = await import("node:fs/promises");

// Live smoke test: only the reserved non-saving demo and ephemeral individual
// flow. Block every non-GET/HEAD request before it can reach production.
export async function runLiveQa(browser, base, out) {
  await mkdir(out, { recursive: true });
  const results = [];
  for (const test of [
    { initial: 3, width: 1280, church: true },
    { initial: 1, width: 375, church: true },
    { initial: 2, width: 375, church: false },
  ]) {
    const context = await browser.newContext({ viewport: { width: test.width, height: 900 } });
    const page = await context.newPage(), errors = [], writes = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
      if (!["GET", "HEAD"].includes(route.request().method())) {
        writes.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    const click = id => page.getByTestId(id).click();
    try {
      await page.goto(`${base}/#/${test.church ? "join/GRACEDEMO" : "survey"}`);
      await click(test.church ? "button-start-join-survey" : "button-start-survey");
      await click(`option-pre-maturity-${test.initial}`);
      await click("button-pre-maturity-next");
      const count = test.initial <= 2 ? 38 : 63;
      for (let i = 0; i < count; i++) {
        await click("option-scale-4");
        await click("button-item-next");
      }
      await click("option-post-maturity-4");
      await click("button-post-maturity-next");
      await click("option-change-2");
      await click("button-change-next");
      if (test.church) {
        for (const id of ["gender", "age", "relationship", "attendance", "tenure", "smallgroup", "volunteer", "children", "ethnicity"]) {
          await page.locator('[data-testid="button-demo-next"][disabled]').waitFor();
          assert.equal(await page.getByTestId("button-demo-skip").count(), 0);
          if (id === "gender" || id === "ethnicity") {
            await page.screenshot({ path: `${out}/live-${test.width}-${id}.png` });
          }
          if (["gender", "relationship", "ethnicity"].includes(id)) {
            await click(`option-demo-${id}-Prefer not to say`);
          } else {
            await page.locator(`[data-testid^="option-demo-${id}-"]`).first().click();
          }
          await click("button-demo-next");
        }
        await click("button-submit-survey");
        await page.getByText("Demo complete", { exact: true }).waitFor();
      } else {
        await page.getByTestId("text-report-privacy").waitFor();
        assert.equal(await page.getByTestId("text-demo-question").count(), 0);
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.goto(`${base}/#/privacy`);
      await page.getByRole("heading", { name: "Survey privacy notice" }).waitFor();
      assert((await page.locator("main").innerText()).includes("select an answer to each demographic question"));
      assert((await page.locator("main").innerText()).includes("fewer than 10"));
      await page.screenshot({ path: `${out}/live-${test.width}-privacy.png`, fullPage: true });
      assert.equal(writes.length, 0, `Unexpected write attempts: ${writes}`);
      assert.equal(errors.length, 0, errors.join("\n"));
      results.push({ ...test, count, result: "passed", writes: 0, errors: 0 });
    } finally {
      await context.close();
    }
  }
  await writeFile(`${out}/live-browser-results.json`, JSON.stringify(results, null, 2));
  return results;
}
