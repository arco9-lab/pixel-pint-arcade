import { expect, type Page } from "@playwright/test";

import { promoteUserToAdmin } from "./db";

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

export async function signUpAdminThroughUi(page: Page, account: E2EAccount) {
  await signUpThroughUi(page, account);
  await promoteUserToAdmin(account.email);
  await page.reload();
  await expect(page.getByRole("link", { name: "Write post" })).toBeVisible();
}
