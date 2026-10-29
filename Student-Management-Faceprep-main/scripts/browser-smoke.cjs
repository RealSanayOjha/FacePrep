/* Optional real-browser test. Requires a running app and Playwright:
   npm install --no-save playwright
   npx playwright install chromium
   node scripts/browser-smoke.cjs
   The test creates its own record and removes it, preserving existing records. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = (process.env.BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const suffix = `${Date.now()}${process.pid}`;
const code = `UI-${suffix}`;
const lastName = `Browser${suffix}`;
const email = `ui-${suffix}@example.edu`;
const waitText = (page, id, text) => page.waitForFunction(({ id, text }) => document.getElementById(id).textContent === text, { id, text });
const waitRows = (page, count) => page.waitForFunction(count => document.querySelectorAll("#studentRows tr").length === count && document.querySelector("#studentRows").getAttribute("aria-busy") === "false", count);

(async () => {
  fs.mkdirSync(path.join(__dirname, "../docs/screenshots"), { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  let created = false;
  try {
    await page.goto(base, { waitUntil: "networkidle" });
    await waitText(page, "connectionLabel", "Database connected");
    const initialTotal = Number((await page.locator("#totalStudents").textContent()).replace(/,/g, ""));
    assert(initialTotal >= 0);
    await page.screenshot({ path: path.join(__dirname, "../docs/screenshots/dashboard.png"), fullPage: true });
    if (initialTotal > 8) {
      await page.locator("#nextPage").click();
      await page.waitForFunction(() => document.getElementById("pageLabel").textContent.startsWith("Page 2"));
      await page.locator("#resetFilters").click();
      await page.waitForFunction(() => document.getElementById("pageLabel").textContent.startsWith("Page 1"));
    }
    await page.locator("#topAddButton").click();
    await page.locator("#studentCode").fill(code);
    await page.locator("#firstName").fill("UI");
    await page.locator("#lastName").fill(lastName);
    await page.locator("#email").fill(email);
    await page.locator("#course").fill("Computer Science");
    await page.locator("#yearLevel").selectOption("2");
    await page.locator("#saveStudent").click();
    await page.waitForFunction(() => !document.getElementById("studentDialog").open);
    created = true;
    await waitText(page, "totalStudents", String(initialTotal + 1));
    await page.locator("#searchInput").fill(lastName);
    await waitRows(page, 1);
    assert((await page.locator("#studentRows").textContent()).includes(lastName));

    // A duplicate email must show the API conflict inside the form.
    await page.locator("#topAddButton").click();
    await page.locator("#studentCode").fill(`${code}-X`);
    await page.locator("#firstName").fill("Duplicate");
    await page.locator("#lastName").fill("Student");
    await page.locator("#email").fill(email.toUpperCase());
    await page.locator("#course").fill("Computer Science");
    await page.locator("#saveStudent").click();
    await page.waitForFunction(() => !document.getElementById("formError").hidden && document.getElementById("formError").textContent.includes("already exists"));
    await page.locator("#cancelDialog").click();

    await page.getByRole("button", { name: `Edit UI ${lastName}`, exact: true }).click();
    await page.locator("#yearLevel").selectOption("3");
    await page.locator("#status").selectOption("GRADUATED");
    await page.locator("#saveStudent").click();
    await page.waitForFunction(() => !document.getElementById("studentDialog").open);
    await page.waitForFunction(() => document.getElementById("studentRows").textContent.includes("Graduated"));
    assert((await page.locator("#studentRows").textContent()).includes("Year 3"));
    await page.getByRole("button", { name: `Delete UI ${lastName}`, exact: true }).click();
    await page.locator("#confirmDelete").click();
    await page.waitForFunction(() => !document.getElementById("deleteDialog").open);
    await waitText(page, "totalStudents", String(initialTotal));
    await waitRows(page, 1); // The empty state is one table row.
    created = false;
    await page.locator("#resetFilters").click();
    await waitText(page, "totalStudents", String(initialTotal));
    await page.locator("#statusFilter").selectOption("GRADUATED");
    await page.waitForFunction(() => [...document.querySelectorAll("#studentRows .status-badge")].every(node => node.textContent === "Graduated"));
    await page.locator("#resetFilters").click();
    await waitRows(page, Math.min(8, initialTotal) || 1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.getElementById("toast").hidden);
    await page.waitForTimeout(250);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Mobile page must not overflow horizontally");
    await page.screenshot({ path: path.join(__dirname, "../docs/screenshots/mobile.png"), fullPage: true });
    await page.locator("#topAddButton").click();
    const box = await page.locator("#studentDialog").boundingBox();
    assert(box.x >= 0 && box.x + box.width <= 390, "Mobile dialog must fit the viewport");
    await page.locator("#cancelDialog").click();
    assert.deepEqual(errors, [], "No uncaught browser errors");
    console.log(`PASS: desktop/mobile rendering, pagination, create, duplicate validation, search, edit, delete, filters; preserved ${initialTotal} existing records.`);
  } finally {
    if (created) {
      try {
        const response = await fetch(`${base}/api/students?search=${lastName}`);
        const data = await response.json();
        for (const student of data.content || []) if (student.studentCode === code) await fetch(`${base}/api/students/${student.id}`, { method: "DELETE" });
      } catch (_) { /* Report the original test failure. */ }
    }
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
