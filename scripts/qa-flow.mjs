import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.on("pageerror", (err) => console.log("PAGEERROR", err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("CONSOLE", msg.text());
});

const email = `qa-${Date.now()}@example.com`;
const password = "stocked-qa-pass";

try {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.getByRole("heading", { name: /What to buy/ }).waitFor({ timeout: 15000 });
  const hero = page.locator('img[alt*="Swiss chard"]');
  await hero.waitFor({ timeout: 5000 });
  if (await page.getByRole("textbox", { name: "Email" }).count()) {
    throw new Error("login form should not be on the landing page");
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(250);
  const atBottom = await page.evaluate(() => window.scrollY > 100);
  if (!atBottom) throw new Error("landing should scroll down");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  const atTop = await page.evaluate(() => window.scrollY < 8);
  if (!atTop) throw new Error("landing should scroll back to the top");
  await page.getByRole("heading", { name: /What to buy/ }).waitFor({ timeout: 3000 });
  await page.screenshot({ path: "/workspace/screenshots/qa-landing.png" });
  await page.getByRole("link", { name: "Log in or sign up" }).first().click();
  await page.getByRole("heading", { name: /lists you both keep/i }).waitFor({ timeout: 8000 });
  await page.screenshot({ path: "/workspace/screenshots/qa-login.png" });
  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await page.locator("#name").fill("QA Tester");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("heading", { name: "Set up your household" }).waitFor({ timeout: 20000 });
  await page.screenshot({ path: "/workspace/screenshots/qa-setup.png" });

  await page.locator("#household-name").fill("Test kitchen");
  await page.getByRole("button", { name: "Create household" }).click();
  await page.getByRole("heading", { name: "This weekend" }).waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: /farmers market/ }).waitFor({ timeout: 10000 });
  await page.screenshot({ path: "/workspace/screenshots/qa-home.png" });

  await page.getByRole("button", { name: /farmers market/ }).click();
  await page.locator("#list-name").fill("Costco");
  await page.getByRole("button", { name: "Warehouse" }).click();
  await page.getByRole("button", { name: "Create list" }).click();
  await page.getByRole("heading", { name: "Costco" }).waitFor({ timeout: 15000 });
  await page.screenshot({ path: "/workspace/screenshots/qa-new-list.png" });

  await page.getByRole("link", { name: "Back to lists" }).click();
  await page.getByRole("heading", { name: "This weekend" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Pharmacy list actions" }).click();
  await page.getByRole("menuitem", { name: "Edit list" }).waitFor({ timeout: 5000 });
  await page.screenshot({ path: "/workspace/screenshots/qa-menu.png" });
  await page.getByRole("menuitem", { name: "Delete list" }).click();
  await page.getByRole("button", { name: "Delete list" }).click();
  await page.getByRole("link", { name: /Pharmacy/ }).waitFor({ state: "hidden", timeout: 10000 });
  await page.screenshot({ path: "/workspace/screenshots/qa-home-after-delete.png" });

  await page.getByRole("link", { name: /Grocery/ }).click();
  await page.getByPlaceholder("Add milk, limes…").waitFor({ timeout: 10000 });
  await page.getByPlaceholder("Add milk, limes…").fill("Oat milk");
  await page.getByRole("button", { name: "Remember as usual" }).click();
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByText("Oat milk").first().waitFor({ timeout: 10000 });
  await page.getByPlaceholder("Add milk, limes…").fill("Limes");
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByText("Limes").first().waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Check Oat milk" }).click();
  await page.screenshot({ path: "/workspace/screenshots/qa-list.png" });

  await page.getByRole("button", { name: "List actions" }).click();
  await page.getByRole("menuitem", { name: "Clear bought" }).click();
  await page.getByRole("button", { name: "Add Oat milk to list" }).waitFor({ timeout: 10000 });
  await page.screenshot({ path: "/workspace/screenshots/qa-tray.png" });
  await page.getByRole("button", { name: "Add Oat milk to list" }).click();
  await page.getByRole("button", { name: "Check Oat milk" }).waitFor({ timeout: 10000 });
  await page.screenshot({ path: "/workspace/screenshots/qa-tray-added.png" });

  await page.getByRole("link", { name: "Back to lists" }).click();
  await page.getByRole("heading", { name: "This weekend" }).waitFor({ timeout: 10000 });
  await page.getByRole("link", { name: "Inventory" }).click();
  await page.getByRole("heading", { name: "Pantry" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Add inventory item" }).click();
  await page.getByRole("button", { name: "Toilet paper" }).click();
  await page.getByRole("button", { name: "Add to inventory" }).click();
  await page.getByText("Toilet paper").first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: "/workspace/screenshots/qa-inventory.png" });

  await page.getByRole("button", { name: "Filters" }).click();
  await page.getByRole("heading", { name: "Filters", exact: true }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Add filter" }).first().click();
  await page.getByRole("button", { name: "Tesla Model Y cabin filter" }).click();
  await page.getByRole("heading", { name: "Track a filter" }).waitFor({ timeout: 5000 });
  await page.locator("#filter-name").waitFor({ timeout: 5000 });
  const filterName = await page.locator("#filter-name").inputValue();
  if (filterName !== "Tesla Model Y cabin filter") {
    throw new Error(`expected Tesla preset, got ${filterName}`);
  }
  await page.getByRole("button", { name: "Every 2 years" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "1 month before" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "Warehouse" }).waitFor({ timeout: 5000 });
  await page.screenshot({ path: "/workspace/screenshots/qa-filter-dialog.png" });
  await page.locator("form").getByRole("button", { name: "Add filter" }).click();
  await page.getByRole("heading", { name: "Track a filter" }).waitFor({ state: "hidden", timeout: 10000 });
  await page.getByRole("heading", { name: "Tesla Model Y cabin filter" }).waitFor({ timeout: 10000 });
  await page.screenshot({ path: "/workspace/screenshots/qa-filters.png" });

  await page.getByRole("link", { name: "Household" }).click();
  await page.getByRole("heading", { name: "Invite" }).waitFor({ timeout: 10000 });
  await page.screenshot({ path: "/workspace/screenshots/qa-household.png" });
  console.log("QA_OK");
} catch (err) {
  await page.screenshot({ path: "/workspace/screenshots/qa-fail.png" });
  console.error("QA_FAIL", err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
