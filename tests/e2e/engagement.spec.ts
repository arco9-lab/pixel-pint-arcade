import { expect, test } from "@playwright/test";

import { signUpThroughUi } from "./auth-helpers";
import {
  cleanupE2EDatabase,
  closeE2EDatabase,
  countPostBookmarks,
  countPostLikes,
  seedPublishedPost,
} from "./db";

const firstReader = {
  name: "E2E First Reader",
  email: "e2e-first-reader@example.test",
  password: "e2e-first-reader-password",
};

const secondReader = {
  name: "E2E Second Reader",
  email: "e2e-second-reader@example.test",
  password: "e2e-second-reader-password",
};

const post = {
  id: "e2e-engagement-post",
  title: "Engagement E2E Post",
  slug: "engagement-e2e-post",
  commentsEnabled: true,
};

const postPath = `/blog/${post.slug}`;

test.describe("like and bookmark", () => {
  test.beforeEach(async () => {
    await cleanupE2EDatabase();
    await seedPublishedPost(post);
  });

  test.afterAll(async () => {
    await cleanupE2EDatabase();
    await closeE2EDatabase();
  });

  test("like persists after reload and is removed by pressing it again", async ({
    page,
  }) => {
    await signUpThroughUi(page, firstReader);
    await page.goto(postPath);

    const likeButton = page.getByRole("button", { name: "Like: 0", exact: true });
    await expect(likeButton).toHaveAttribute("aria-pressed", "false");
    await likeButton.click();

    const likedButton = page.getByRole("button", {
      name: "Liked: 1",
      exact: true,
    });
    await expect(likedButton).toHaveAttribute("aria-pressed", "true");
    expect(await countPostLikes(post.id)).toBe(1);

    await page.reload();
    await expect(likedButton).toHaveAttribute("aria-pressed", "true");

    await likedButton.click();
    await expect(
      page.getByRole("button", { name: "Like: 0", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(await countPostLikes(post.id)).toBe(0);

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Like: 0", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  test("bookmark persists after reload, appears in saved posts and is removed by pressing it again", async ({
    page,
  }) => {
    await signUpThroughUi(page, firstReader);
    await page.goto(postPath);

    await page
      .getByRole("button", { name: "Add to bookmarks", exact: true })
      .click();

    const bookmarkedButton = page.getByRole("button", {
      name: "Bookmarked",
      exact: true,
    });
    await expect(bookmarkedButton).toHaveAttribute("aria-pressed", "true");
    expect(await countPostBookmarks(post.id)).toBe(1);

    await page.reload();
    await expect(bookmarkedButton).toHaveAttribute("aria-pressed", "true");

    await page.goto("/account");
    const savedSection = page.locator("#saved");
    await expect(
      savedSection.getByRole("link", { name: post.title }),
    ).toBeVisible();

    await page.goto(postPath);
    await bookmarkedButton.click();
    await expect(
      page.getByRole("button", { name: "Add to bookmarks", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(await countPostBookmarks(post.id)).toBe(0);

    await page.goto("/account");
    await expect(savedSection.getByText("No saved posts yet")).toBeVisible();
  });

  test("actions of one reader do not change the state of another reader", async ({
    page,
    browser,
    baseURL,
  }) => {
    const secondReaderContext = await browser.newContext({ baseURL });
    const secondReaderPage = await secondReaderContext.newPage();

    await signUpThroughUi(page, firstReader);
    await signUpThroughUi(secondReaderPage, secondReader);

    await page.goto(postPath);
    await page.getByRole("button", { name: "Like: 0", exact: true }).click();
    await page
      .getByRole("button", { name: "Add to bookmarks", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Liked: 1", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "Bookmarked", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    await secondReaderPage.goto(postPath);
    await expect(
      secondReaderPage.getByRole("button", { name: "Like: 1", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(
      secondReaderPage.getByRole("button", {
        name: "Add to bookmarks",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "false");

    await secondReaderPage
      .getByRole("button", { name: "Like: 1", exact: true })
      .click();
    await expect(
      secondReaderPage.getByRole("button", { name: "Liked: 2", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Liked: 2", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Liked: 2", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Like: 1", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");

    await secondReaderPage.reload();
    await expect(
      secondReaderPage.getByRole("button", { name: "Liked: 1", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      secondReaderPage.getByRole("button", {
        name: "Add to bookmarks",
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(await countPostLikes(post.id)).toBe(1);
    expect(await countPostBookmarks(post.id)).toBe(1);

    await secondReaderContext.close();
  });
});
