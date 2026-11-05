import { expect, test } from "@playwright/test";

import { signUpAdminThroughUi } from "./auth-helpers";
import {
  cleanupE2EDatabase,
  closeE2EDatabase,
  findPostBySlug,
} from "./db";

const admin = {
  name: "E2E Admin Author",
  email: "e2e-admin-author@example.test",
  password: "e2e-admin-author-password",
};

const post = {
  title: "Admin Publish E2E Post",
  slug: "admin-publish-e2e-post",
  content: ["Admin intro paragraph.", "", "## Admin Heading", "Admin body."].join(
    "\n",
  ),
};

test.describe("admin publish", () => {
  test.beforeEach(async () => {
    await cleanupE2EDatabase();
  });

  test.afterAll(async () => {
    await cleanupE2EDatabase();
    await closeE2EDatabase();
  });

  test("admin saves a draft, publishes it and a guest can then read it", async ({
    page,
    browser,
    baseURL,
  }) => {
    const guestContext = await browser.newContext({ baseURL });
    const guestPage = await guestContext.newPage();

    await signUpAdminThroughUi(page, admin);

    await test.step("admin saves the post as a draft", async () => {
      await page.goto("/admin/posts/new");
      await page.getByLabel("Title", { exact: true }).fill(post.title);
      await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(
        post.slug,
      );
      await page.getByLabel("Content", { exact: true }).fill(post.content);
      await page.getByRole("button", { name: "Save post" }).click();

      await expect(page.getByText("Post saved.")).toBeVisible();
      expect(await findPostBySlug(post.slug)).toMatchObject({
        title: post.title,
        published: false,
      });
    });

    await test.step("draft is marked as a draft and hidden from guests", async () => {
      await page.goto("/admin/posts");
      await expect(page.getByLabel("Admin posts").getByText("Draft")).toBeVisible();

      await guestPage.goto(`/blog/${post.slug}`);
      await expect(
        guestPage.getByRole("heading", { name: "Page not found" }),
      ).toBeVisible();
    });

    await test.step("admin publishes the draft from the editor", async () => {
      await page.getByRole("link", { name: "Edit" }).click();
      await page.getByLabel("Publish now").check();
      await page.getByRole("button", { name: "Save changes" }).click();

      await expect(page.getByText("Post updated.")).toBeVisible();
      expect(await findPostBySlug(post.slug)).toMatchObject({ published: true });

      await page.goto("/admin/posts");
      await expect(
        page.getByLabel("Admin posts").getByText("Published"),
      ).toBeVisible();
    });

    await test.step("guest opens the published article", async () => {
      await guestPage.goto(`/blog/${post.slug}`);

      await expect(
        guestPage.getByRole("heading", { name: post.title, level: 1 }),
      ).toBeVisible();
      await expect(guestPage.getByText("Admin intro paragraph.")).toBeVisible();
    });

    await guestContext.close();
  });
});
