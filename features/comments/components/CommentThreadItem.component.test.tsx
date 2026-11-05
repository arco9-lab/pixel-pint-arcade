import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { resetActionStateMock } from "@/tests/component/action-state";
import type { CommentNode } from "@/features/comments/components/CommentsSection";
import { CommentThreadItem } from "@/features/comments/components/CommentThreadItem";

const tombstone: CommentNode = {
  id: "tombstone",
  body: "",
  postId: "post-1",
  parentId: null,
  createdAt: "2026-01-01T12:00:00.000Z",
  deleted: true,
  author: null,
  replies: [
    {
      id: "reply",
      body: "Reply that survived",
      postId: "post-1",
      parentId: "tombstone",
      createdAt: "2026-01-01T12:05:00.000Z",
      deleted: false,
      author: { id: "reader", name: "Reader", image: null },
      replies: [],
    },
  ],
};

describe("CommentThreadItem tombstone", () => {
  beforeEach(() => {
    resetActionStateMock();
  });

  it("shows a deleted label without author, delete or reply controls", () => {
    render(
      <ol>
        <CommentThreadItem
          comment={tombstone}
          commentsEnabled
          currentUser={{ id: "admin", role: "ADMIN" }}
          postId="post-1"
          postSlug="test-post"
        />
      </ol>,
    );

    const article = screen.getByText("Comment deleted").closest("article")!;

    expect(article.querySelector("time")).toHaveAttribute(
      "datetime",
      tombstone.createdAt,
    );
    expect(screen.queryByText("Deleted user")).not.toBeInTheDocument();
    expect(
      within(article).queryByRole("button", { name: "Reply" }),
    ).not.toBeInTheDocument();
    expect(
      within(article).queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps the replies of a deleted comment visible", () => {
    render(
      <ol>
        <CommentThreadItem
          comment={tombstone}
          commentsEnabled
          currentUser={null}
          postId="post-1"
          postSlug="test-post"
        />
      </ol>,
    );

    expect(screen.getByText("Reply that survived")).toBeInTheDocument();
    expect(screen.getByText("Reader")).toBeInTheDocument();
  });
});
