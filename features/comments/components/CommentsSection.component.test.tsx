import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { resetActionStateMock } from "@/tests/component/action-state";
import { CommentsSection } from "@/features/comments/components/CommentsSection";
import type { CommentDTO } from "@/features/comments/types";

const comments: CommentDTO[] = [
  {
    id: "root",
    body: "Root comment",
    postId: "post-1",
    parentId: null,
    createdAt: "2026-01-01T12:00:00.000Z",
    deleted: false,
    author: {
      id: "user-1",
      name: "User One",
      image: null,
    },
  },
  {
    id: "reply",
    body: "Reply comment",
    postId: "post-1",
    parentId: "root",
    createdAt: "2026-01-01T12:05:00.000Z",
    deleted: false,
    author: {
      id: "user-2",
      name: "User Two",
      image: null,
    },
  },
];

describe("CommentsSection", () => {
  beforeEach(() => {
    resetActionStateMock();
  });

  it("shows a sign-in prompt to guests when comments are open", () => {
    render(
      <CommentsSection
        comments={[]}
        commentsEnabled
        currentUser={null}
        postId="post-1"
        postSlug="test-post"
      />,
    );

    expect(screen.getByText("Join the discussion")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("shows a closed state when comments are disabled", () => {
    render(
      <CommentsSection
        comments={comments}
        commentsEnabled={false}
        currentUser={null}
        postId="post-1"
        postSlug="test-post"
      />,
    );

    expect(screen.getByText("Comments are closed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
  });

  it("builds a nested thread and toggles replies", async () => {
    const user = userEvent.setup();

    render(
      <CommentsSection
        comments={comments}
        commentsEnabled
        currentUser={null}
        postId="post-1"
        postSlug="test-post"
      />,
    );

    expect(screen.getByText("Root comment")).toBeInTheDocument();
    expect(screen.getByText("Reply comment")).toBeInTheDocument();

    const toggle = screen.getByRole("button", { name: "Show replies (1)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);

    expect(
      screen.getByRole("button", { name: "Hide replies" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("opens and closes the reply form for signed-in users", async () => {
    const user = userEvent.setup();

    render(
      <CommentsSection
        comments={comments}
        commentsEnabled
        currentUser={{ id: "signed-in-user", role: "USER" }}
        postId="post-1"
        postSlug="test-post"
      />,
    );

    await user.click(screen.getAllByRole("button", { name: "Reply" })[0]);

    expect(screen.getByLabelText("Reply to User One")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel reply" }));

    expect(screen.queryByLabelText("Reply to User One")).not.toBeInTheDocument();
  });
});
