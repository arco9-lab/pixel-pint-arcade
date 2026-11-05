"use client";

import { useCallback, useState } from "react";

import type { CommentNode } from "./CommentsSection";
import { CommentForm } from "./CommentForm";
import { DeleteCommentButton } from "./DeleteCommentButton";
import styles from "./Comments.module.css";

type CommentThreadItemProps = {
  comment: CommentNode;
  commentsEnabled: boolean;
  currentUser:
    | {
        id: string;
        role: "USER" | "ADMIN" | "DEMO";
      }
    | null;
  postId: string;
  postSlug: string;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const getRepliesLabel = (count: number, expanded: boolean) => {
  if (expanded) {
    return "Hide replies";
  }

  return `Show replies (${count})`;
};

export const CommentThreadItem = ({
  comment,
  commentsEnabled,
  currentUser,
  postId,
  postSlug,
}: CommentThreadItemProps) => {
  const [repliesExpanded, setRepliesExpanded] = useState(false);
  const [replyFormOpen, setReplyFormOpen] = useState(false);
  const replyFormId = `comment-${comment.id}-reply-form`;
  const repliesId = `comment-${comment.id}-replies`;
  const authorName = comment.author?.name ?? "Deleted user";
  const isAuthor =
    currentUser !== null &&
    comment.author !== null &&
    currentUser.id === comment.author.id;
  const canDelete =
    !comment.deleted && (currentUser?.role === "ADMIN" || isAuthor);
  const hasReplies = comment.replies.length > 0;
  const canReply = !comment.deleted && commentsEnabled && Boolean(currentUser);
  const handleReplyPosted = useCallback(() => {
    setReplyFormOpen(false);
    setRepliesExpanded(true);
  }, []);

  return (
    <li className={styles.comment}>
      <article>
        <header className={styles.commentHeader}>
          <div>
            {comment.deleted ? (
              <span className={styles.deletedLabel}>Comment deleted</span>
            ) : (
              <strong>{authorName}</strong>
            )}
            <time dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
          </div>
          {canDelete ? (
            <DeleteCommentButton commentId={comment.id} postSlug={postSlug} />
          ) : null}
        </header>
        {comment.deleted ? null : <p>{comment.body}</p>}
        {canReply ? (
          <div className={styles.commentActions}>
            <button
              aria-controls={replyFormId}
              aria-expanded={replyFormOpen}
              className={styles.replyToggle}
              type="button"
              onClick={() => setReplyFormOpen((open) => !open)}
            >
              {replyFormOpen ? "Cancel reply" : "Reply"}
            </button>
          </div>
        ) : null}
      </article>

      {replyFormOpen ? (
        <div className={styles.replyFormWrap} id={replyFormId}>
          <CommentForm
            className={styles.replyForm}
            label={`Reply to ${authorName}`}
            onSuccess={handleReplyPosted}
            parentId={comment.id}
            pendingLabel="Replying..."
            placeholder="Write a reply..."
            postId={postId}
            postSlug={postSlug}
            submitLabel="Post reply"
          />
        </div>
      ) : null}

      {hasReplies ? (
        <>
          <button
            aria-controls={repliesId}
            aria-expanded={repliesExpanded}
            className={styles.repliesToggle}
            type="button"
            onClick={() => setRepliesExpanded((expanded) => !expanded)}
          >
            {getRepliesLabel(comment.replies.length, repliesExpanded)}
          </button>
          <ol
            className={`${styles.replies} ${
              repliesExpanded ? styles.repliesOpen : styles.repliesClosed
            }`}
            id={repliesId}
          >
            {comment.replies.map((reply) => (
              <CommentThreadItem
                comment={reply}
                commentsEnabled={commentsEnabled}
                currentUser={currentUser}
                key={reply.id}
                postId={postId}
                postSlug={postSlug}
              />
            ))}
          </ol>
        </>
      ) : null}
    </li>
  );
};
