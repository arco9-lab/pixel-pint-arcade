import { expect, type Page } from "@playwright/test";

export type E2EAccount = {
  name: string;
  email: string;
  password: string;
};

export async function signUpThroughUi(page: Page, account: E2EAccount) {
  await page.goto("/register");
  await page.getByLabel("Name").fill(account.name);
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL("/account");
}
