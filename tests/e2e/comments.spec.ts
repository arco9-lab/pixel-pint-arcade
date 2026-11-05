import { expect, test } from "@playwright/test";

import { signUpThroughUi } from "./auth-helpers";
import {
  backdateCommentsForPost,
  cleanupE2EDatabase,
  closeE2EDatabase,
  findCommentsForPost,
  findUserByEmail,
  seedPublishedPost,
  setPostCommentsEnabled,
} from "./db";

const account = {
  name: "E2E Commenter",
  email: "e2e-commenter@example.test",
  password: "e2e-commenter-password",
};

const post = {
  id: "e2e-comments-post",
  title: "Comments E2E Post",
  slug: "comments-e2e-post",
};

const commentBody = "The CRT glow made every pixel feel warmer.";
const secondCommentBody = "Handheld screens deserve the same love.";
const commentRateLimitSeconds = 30;

test.describe("comments", () => {
  test.beforeEach(async () => {
    await cleanupE2EDatabase();
  });

  test.afterAll(async () => {
    await cleanupE2EDatabase();
    await closeE2EDatabase();
  });

  test("signed-in user publishes a comment that stays visible after reload", async ({
    page,
  }) => {
    await seedPublishedPost({ ...post, commentsEnabled: true });
    await signUpThroughUi(page, account);

    await page.goto(`/blog/${post.slug}`);
    await page.getByRole("textbox", { name: "Comment" }).fill(commentBody);
    await page.getByRole("button", { name: "Post comment" }).click();

    const commentsSection = page.getByLabel("Comments");
    await expect(page.getByText("Comment posted.")).toBeVisible();
    await expect(commentsSection.getByText(commentBody)).toBeVisible();

    const storedComments = await findCommentsForPost(post.id);
    const author = await findUserByEmail(account.email);
    expect(storedComments).toEqual([
      { body: commentBody, authorId: author!.id },
    ]);

    await page.reload();

    await expect(commentsSection.getByText(commentBody)).toBeVisible();
    await expect(commentsSection.getByText(account.name)).toBeVisible();
  });

  test("closed comments show a closed notice instead of the comment form", async ({
    page,
  }) => {
    await seedPublishedPost({ ...post, commentsEnabled: false });
    await signUpThroughUi(page, account);

    await page.goto(`/blog/${post.slug}`);

    await expect(
      page.getByRole("heading", { name: "Comments are closed" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Comment" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Post comment" }),
    ).toHaveCount(0);
  });

  test("server rejects a comment sent after comments were closed", async ({
    page,
  }) => {
    await seedPublishedPost({ ...post, commentsEnabled: true });
    await signUpThroughUi(page, account);

    await page.goto(`/blog/${post.slug}`);
    await page.getByRole("textbox", { name: "Comment" }).fill(commentBody);
    await setPostCommentsEnabled(post.id, false);
    await page.getByRole("button", { name: "Post comment" }).click();

    await expect(
      page.getByText("Comments are closed for this post."),
    ).toBeVisible();
    expect(await findCommentsForPost(post.id)).toEqual([]);
  });

  test("second comment right after the first one is rate limited", async ({
    page,
  }) => {
    await seedPublishedPost({ ...post, commentsEnabled: true });
    await signUpThroughUi(page, account);
    await page.goto(`/blog/${post.slug}`);

    await page.getByRole("textbox", { name: "Comment" }).fill(commentBody);
    await page.getByRole("button", { name: "Post comment" }).click();
    await expect(page.getByText("Comment posted.")).toBeVisible();

    await page
      .getByRole("textbox", { name: "Comment" })
      .fill(secondCommentBody);
    await page.getByRole("button", { name: "Post comment" }).click();

    await expect(
      page.getByText("Please wait before posting another comment."),
    ).toBeVisible();
    await expect(
      page.getByLabel("Comments").getByText(secondCommentBody),
    ).toHaveCount(0);
    const storedComments = await findCommentsForPost(post.id);
    expect(storedComments.map((comment) => comment.body)).toEqual([
      commentBody,
    ]);
  });

  test("same comment is rejected as a duplicate once the rate limit has passed", async ({
    page,
  }) => {
    await seedPublishedPost({ ...post, commentsEnabled: true });
    await signUpThroughUi(page, account);
    await page.goto(`/blog/${post.slug}`);

    await page.getByRole("textbox", { name: "Comment" }).fill(commentBody);
    await page.getByRole("button", { name: "Post comment" }).click();
    await expect(page.getByText("Comment posted.")).toBeVisible();

    await backdateCommentsForPost(post.id, commentRateLimitSeconds + 1);

    await page
      .getByRole("textbox", { name: "Comment" })
      .fill(`  ${commentBody.toUpperCase().replace(/ /g, "   ")}  `);
    await page.getByRole("button", { name: "Post comment" }).click();

    await expect(page.getByText("You already posted this comment.")).toBeVisible();
    expect(await findCommentsForPost(post.id)).toHaveLength(1);
  });
});
