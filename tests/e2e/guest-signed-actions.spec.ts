import { expect, test } from "@playwright/test";

import {
  cleanupE2EDatabase,
  pool,
  seedPublishedPostForGuestFlow,
} from "./db";

test.describe("guest signed-in actions", () => {
  test.beforeEach(async () => {
    await cleanupE2EDatabase();
    await seedPublishedPostForGuestFlow();
  });

  test.afterAll(async () => {
    await cleanupE2EDatabase();
    await pool.end();
  });

  test("guest can read a post but cannot use signed-in actions", async ({
    page,
  }) => {
    await page.goto("/blog/guest-e2e-post");

    await expect(
      page.getByRole("heading", { name: "Guest E2E Post BROKEN", level: 1 })
    ).toBeVisible();
    await expect(page.getByText("Guest intro paragraph.")).toBeVisible();

    await expect(page.getByText("0 likes")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Sign in to like or save" }),
    ).toHaveAttribute("href", "/login");
    await expect(page.getByRole("button", { name: /^Like\b/ })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Add to bookmarks|Bookmarked/ }),
    ).toHaveCount(0);

    await expect(page.getByText("Join the discussion")).toBeVisible();
    await expect(
      page.getByText("Sign in to leave a comment under this article."),
    ).toBeVisible();
    const commentsSection = page.getByLabel("Comments");
    await expect(
      commentsSection.getByRole("link", { name: "Sign in" }),
    ).toHaveAttribute(
      "href",
      "/login",
    );
    await expect(
      commentsSection.getByRole("link", { name: "Create account" }),
    ).toHaveAttribute("href", "/register");

    await expect(
      page.getByRole("textbox", { name: "Comment" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Post comment" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reply" })).toHaveCount(0);
  });
});
