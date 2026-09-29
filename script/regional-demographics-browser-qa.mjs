const { default: assert } = await import("node:assert/strict");
const { mkdir, writeFile } = await import("node:fs/promises");

// Run against the local Vite client. APIs are intercepted: no real data is sent.
// Pass a Playwright Browser instance (from the interactive QA harness).
export async function runBrowserQa(browser, base = "http://127.0.0.1:5000", out = "qa-output") {
  await mkdir(out, { recursive: true });
  const results = [];
  const cases = [
    { preset: "canada", initial: 3, width: 1280, code: "SYNTHETIC", choices: ["White", "Black"] },
    { preset: "usa", initial: 1, width: 375, code: "SYNTHETIC", choices: ["Hispanic or Latino/a/x", "Asian"] },
    { preset: "uk", initial: 2, width: 375, code: "GRACEDEMO", choices: ["White British, Irish, or other White background", "Arab"] },
    { preset: "international", initial: 3, width: 1280, code: "SYNTHETIC", failDisplay: true, skipAll: true, choices: ["White / European background", "Black / African background"] },
  ];
  for (const test of cases) {
    const context = await browser.newContext({ viewport: { width: test.width, height: 900 } });
    const page = await context.newPage();
    const errors = [], submissions = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/survey-display") {
        if (test.failDisplay) return route.fulfill({ status: 503, json: { message: "Synthetic fallback test" } });
        return route.fulfill({ json: { ethnicityPreset: test.preset } });
      }
      if (path.startsWith("/api/join/")) return route.fulfill({ json: { churchName: "Synthetic Browser QA", waveLabel: "Privacy review" } });
      if (path === "/api/responses") {
        submissions.push(route.request().postDataJSON());
        return route.fulfill({ status: 201, json: { ok: true } });
      }
      return route.fulfill({ status: 404, json: { message: "Unconfigured synthetic endpoint" } });
    });
    const click = id => page.getByTestId(id).click();
    const fit = async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Horizontal overflow");
    try {
      await page.goto(`${base}/#/join/${test.code}`);
      await click("button-start-join-survey");
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
      assert(await page.getByTestId("text-demo-intro-note").isVisible());
      assert((await page.getByTestId("text-demo-intro-note").innerText()).includes("voluntary"));
      await fit();
      await page.screenshot({ path: `${out}/regional-${test.preset}-${test.width}-gender.png` });
      // Exercise selection -> next -> back -> skip -> back: skip must clear.
      await click("option-demo-gender-Male");
      await click("button-demo-next");
      await click("button-back");
      await click("button-demo-skip");
      await click("button-back");
      assert.equal(await page.locator('[role="radio"][data-state="checked"]').count(), 0);
      await click("button-demo-skip");
      for (const id of ["age", "relationship", "attendance", "tenure", "smallgroup", "volunteer"]) {
        assert(await page.getByTestId("button-demo-skip").isVisible(), `${id} skip`);
        if (id === "relationship") {
          assert(await page.getByTestId("option-demo-relationship-Prefer not to say").isVisible());
        }
        await click("button-demo-skip");
      }
      // Children None is exclusive, then skip to keep it absent.
      await click("option-demo-children-None");
      await click("option-demo-children-0-2 year old(s)");
      assert.equal(await page.locator('[role="checkbox"][data-state="checked"]').count(), 1);
      await click("button-demo-skip");
      assert.equal(await page.getByTestId("text-demo-question").innerText(), "Which ethnic, cultural, or racial background(s) best describe you? Select all that apply.");
      for (const choice of test.choices) await click(`option-demo-ethnicity-${choice}`);
      assert.equal(await page.locator('[role="checkbox"][data-state="checked"]').count(), 2);
      await click("option-demo-ethnicity-Prefer not to say");
      assert.equal(await page.locator('[role="checkbox"][data-state="checked"]').count(), 1);
      for (const choice of test.choices) await click(`option-demo-ethnicity-${choice}`);
      assert.equal(await page.locator('[role="checkbox"][data-state="checked"]').count(), 2);
      await page.evaluate(() => scrollTo(0, 0));
      await fit();
      await page.screenshot({ path: `${out}/regional-${test.preset}-${test.width}-ethnicity.png`, fullPage: true });
      await click(test.skipAll ? "button-demo-skip" : "button-demo-next");
      await click("button-submit-survey");
      if (test.code === "GRACEDEMO") {
        await page.getByText("Demo complete", { exact: true }).waitFor();
        assert.equal(submissions.length, 0);
      } else {
        await page.getByTestId("text-report-privacy").waitFor();
        assert.equal(submissions.length, 1);
        assert.equal(Object.keys(submissions[0].items).length, count);
        assert.equal(JSON.stringify(submissions[0].demographics), JSON.stringify(test.skipAll ? {} : { ethnicity: test.choices }));
        assert(!/country|ethnicityPreset|ipAddress/.test(JSON.stringify(submissions[0])));
      }
      await fit();
      await page.goto(`${base}/#/privacy`);
      await page.getByRole("heading", { name: "Survey privacy notice" }).waitFor();
      await fit();
      await page.screenshot({ path: `${out}/regional-${test.preset}-${test.width}-privacy.png`, fullPage: true });
      assert.equal(errors.length, 0, errors.join("\n"));
      results.push({ ...test, result: "passed", statements: count, browserErrors: errors.length, submissions: submissions.length });
    } finally {
      await context.close();
    }
  }
  await writeFile(`${out}/regional-browser-results.json`, JSON.stringify(results, null, 2));
  return results;
}
