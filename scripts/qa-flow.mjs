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
  await page.getByText("Toilet paper").first().waitFor({ timeout: 10000 });
  await page.screenshot({ path: "/workspace/screenshots/qa-inventory.png" });

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
