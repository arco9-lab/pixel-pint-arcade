import {
  expect,
  test,
  type APIRequestContext,
  type Request,
} from "@playwright/test";

import { signUpAdminThroughUi, signUpThroughUi } from "./auth-helpers";
import {
  cleanupE2EDatabase,
  closeE2EDatabase,
  countPosts,
  findPostBySlug,
  seedPublishedPost,
} from "./db";

const admin = {
  name: "E2E Boundary Admin",
  email: "e2e-boundary-admin@example.test",
  password: "e2e-boundary-admin-password",
};

const reader = {
  name: "E2E Boundary Reader",
  email: "e2e-boundary-reader@example.test",
  password: "e2e-boundary-reader-password",
};

const post = {
  title: "Boundary E2E Post",
  slug: "boundary-e2e-post",
  content: "Boundary intro paragraph.",
};

const headersNotToReplay = new Set([
  "content-length",
  "cookie",
  "host",
  "connection",
]);

const isServerActionRequest = (request: Request) =>
  request.method() === "POST" && "next-action" in request.headers();

const replayWithCookiesOf = async (
  readerRequest: APIRequestContext,
  capturedRequest: Request,
) => {
  const headers = Object.fromEntries(
    Object.entries(capturedRequest.headers()).filter(
      ([name]) => !headersNotToReplay.has(name),
    ),
  );

  return readerRequest.post(capturedRequest.url(), {
    headers,
    data: capturedRequest.postDataBuffer(),
  });
};

test.describe("admin role boundary", () => {
  test.beforeEach(async () => {
    await cleanupE2EDatabase();
  });

  test.afterAll(async () => {
    await cleanupE2EDatabase();
    await closeE2EDatabase();
  });

  test("regular user is redirected away from admin pages and sees no admin links", async ({
    page,
  }) => {
    await seedPublishedPost({ ...post, id: "e2e-boundary-post", commentsEnabled: true });
    await signUpThroughUi(page, reader);

    await expect(page.getByRole("link", { name: "Write post" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Manage posts" })).toHaveCount(0);

    for (const adminPath of [
      "/admin/posts",
      "/admin/posts/new",
      "/admin/posts/e2e-boundary-post/edit",
    ]) {
      await page.goto(adminPath);
      await expect(page).toHaveURL("/account");
    }
  });

  test("regular user cannot replay admin create and delete requests", async ({
    page,
    browser,
    baseURL,
  }) => {
    const readerContext = await browser.newContext({ baseURL });
    const readerPage = await readerContext.newPage();

    await signUpAdminThroughUi(page, admin);
    await signUpThroughUi(readerPage, reader);

    await page.goto("/admin/posts/new");
    await page.getByLabel("Title", { exact: true }).fill(post.title);
    await page.getByLabel("Content", { exact: true }).fill(post.content);
    const createRequestPromise = page.waitForRequest(isServerActionRequest);
    await page.getByRole("button", { name: "Save post" }).click();
    const createRequest = await createRequestPromise;
    await expect(page.getByText("Post saved.")).toBeVisible();

    const createdPost = await findPostBySlug(post.slug);
    expect(createdPost).not.toBeNull();

    await page.goto("/admin/posts");
    page.once("dialog", (dialog) => dialog.accept());
    const deleteRequestPromise = page.waitForRequest(isServerActionRequest);
    await page.getByRole("button", { name: "Delete" }).click();
    const deleteRequest = await deleteRequestPromise;
    await expect(page.getByText("No posts yet")).toBeVisible();
    expect(await countPosts()).toBe(0);

    await test.step("reader's replay of the create request is rejected", async () => {
      const response = await replayWithCookiesOf(readerContext.request, createRequest);

      expect(await response.text()).toContain("Only admins can create posts.");
      expect(await countPosts()).toBe(0);
    });

    await test.step("reader's replay of the delete request is rejected", async () => {
      await seedPublishedPost({
        id: createdPost!.id,
        title: post.title,
        slug: post.slug,
        commentsEnabled: true,
      });

      const response = await replayWithCookiesOf(readerContext.request, deleteRequest);

      expect(await response.text()).toContain("Only admins can delete posts.");
      expect(await findPostBySlug(post.slug)).not.toBeNull();
    });

    await readerContext.close();
  });
});
