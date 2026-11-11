import { expect, test } from "@playwright/test";

import {
  cleanupE2EDatabase,
  closeE2EDatabase,
  countSessionsForUser,
  findUserByEmail,
} from "./db";

const account = {
  name: "E2E Reader",
  email: "e2e-reader@example.test",
  password: "e2e-reader-password",
};

test.describe("authentication", () => {
  test.beforeEach(async () => {
    await cleanupE2EDatabase();
  });

  test.afterAll(async () => {
    await cleanupE2EDatabase();
    await closeE2EDatabase();
  });

  test("new user signs up, signs out, signs in again and loses the session on sign out", async ({
    page,
  }) => {
    await test.step("sign up creates a USER account and a session", async () => {
      await page.goto("/register");
      await page.getByLabel("Name").fill(account.name);
      await page.getByLabel("Email").fill(account.email);
      await page.getByLabel("Password").fill(account.password);
      await page.getByRole("button", { name: "Create" }).click();

      await expect(page).toHaveURL("/account");
      await expect(
        page.getByRole("heading", { name: account.name, level: 1 }),
      ).toBeVisible();
      await expect(page.getByText(account.email)).toBeVisible();

      const createdUser = await findUserByEmail(account.email);
      expect(createdUser).toMatchObject({
        name: account.name,
        role: "USER",
      });
      expect(await countSessionsForUser(createdUser!.id)).toBe(1);
    });

    await test.step("sign out removes the session and closes the account page", async () => {
      await page.getByRole("button", { name: "Sign out" }).click();
      await expect(page).toHaveURL("/");

      const createdUser = await findUserByEmail(account.email);
      expect(await countSessionsForUser(createdUser!.id)).toBe(0);

      await page.goto("/account");
      await expect(page).toHaveURL("/login");
    });

    await test.step("sign in with the same credentials opens the account", async () => {
      await page.getByLabel("Email").fill(account.email);
      await page.getByLabel("Password").fill(account.password);
      await page.getByRole("button", { name: "Enter" }).click();

      await expect(page).toHaveURL("/account");
      await expect(
        page.getByRole("heading", { name: account.name, level: 1 }),
      ).toBeVisible();

      const createdUser = await findUserByEmail(account.email);
      expect(await countSessionsForUser(createdUser!.id)).toBe(1);
    });
  });

  test("sign in with a wrong password shows an error and creates no session", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.getByLabel("Name").fill(account.name);
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL("/account");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/login");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill("not-the-real-password");
    await page.getByRole("button", { name: "Enter" }).click();

    await expect(page.getByRole("status")).not.toBeEmpty();
    await expect(page).toHaveURL("/login");

    const createdUser = await findUserByEmail(account.email);
    expect(await countSessionsForUser(createdUser!.id)).toBe(0);
  });
});
