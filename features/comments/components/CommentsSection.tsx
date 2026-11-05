import Link from "next/link";

import { isDemoMode } from "@/lib/demo-mode";
import type { CommentDTO } from "@/features/comments/types";
import { CommentForm } from "./CommentForm";
import { CommentThreadItem } from "./CommentThreadItem";
import styles from "./Comments.module.css";

type CommentsSectionProps = {
  comments: CommentDTO[];
  commentsEnabled: boolean;
  postId: string;
  postSlug: string;
  currentUser:
    | {
        id: string;
        role: "USER" | "ADMIN" | "DEMO";
      }
    | null;
};

export type CommentNode = CommentDTO & {
  replies: CommentNode[];
};

const buildCommentTree = (comments: CommentDTO[]) => {
  const nodes = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  comments.forEach((comment) => {
    nodes.set(comment.id, {
      ...comment,
      replies: [],
    });
  });

  nodes.forEach((node) => {
    if (node.parentId) {
      const parent = nodes.get(node.parentId);

      if (parent) {
        parent.replies.push(node);
        return;
      }
    }

    roots.push(node);
  });

  return roots;
};

export const CommentsSection = ({
  comments,
  commentsEnabled,
  currentUser,
  postId,
  postSlug,
}: CommentsSectionProps) => {
  const roots = buildCommentTree(comments);

  return (
    <section className={styles.comments} aria-labelledby="comments-title">
      <div className={styles.header}>
        <div>
          <div className="eyebrow">Discussion</div>
          <h2 id="comments-title">Comments</h2>
        </div>
        <span>{comments.length}</span>
      </div>

      {commentsEnabled && currentUser ? (
        <CommentForm postId={postId} postSlug={postSlug} />
      ) : commentsEnabled ? (
        <div className={styles.signInPrompt}>
          <h3>Join the discussion</h3>
          <p>Sign in to leave a comment under this article.</p>
          <div className={styles.promptActions}>
            <Link className="btn" href="/login">
              Sign in
            </Link>
            {isDemoMode() ? null : (
              <Link className="btn secondary" href="/register">
                Create account
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className={styles.closedState}>
          <h3>Comments are closed</h3>
          <p>This article is not accepting new comments or replies.</p>
        </div>
      )}

      {roots.length > 0 ? (
        <ol className={styles.list}>
          {roots.map((comment) => (
            <CommentThreadItem
              comment={comment}
              commentsEnabled={commentsEnabled}
              currentUser={currentUser}
              key={comment.id}
              postId={postId}
              postSlug={postSlug}
            />
          ))}
        </ol>
      ) : commentsEnabled ? (
        <div className={styles.emptyState}>
          <h3>No comments yet</h3>
          <p>Start the conversation with the first take on this post.</p>
        </div>
      ) : null}
    </section>
  );
};
