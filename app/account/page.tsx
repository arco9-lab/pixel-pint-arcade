import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DEMO_POST_LIMIT } from "@/features/demo/constants";
import { DemoAccountBanner } from "@/features/demo/components/DemoAccountBanner";
import { SignOutButton } from "@/features/auth/components/SignOutButton";
import { DeletePostButton } from "@/features/blog/components/DeletePostButton";
import { getCurrentSession } from "@/server/auth";
import { requireUserRecord } from "@/server/permissions";
import { getCurrentUserComments } from "@/features/comments/data/comments";
import { getCurrentUserSavedPosts } from "@/features/blog/data/post-engagement";
import { getCurrentUserPosts } from "@/features/blog/data/posts";
import styles from "./AccountPage.module.css";

export const metadata: Metadata = {
  title: "Account | Pixel Pint Arcade",
  description: "Your Pixel Pint Arcade posts, comments and profile.",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

const previewText = (value: string) =>
  value.length > 150 ? `${value.slice(0, 147).trim()}...` : value;

export default async function AccountPage() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  const user = await requireUserRecord();
  const isAdmin = user.role === "ADMIN";
  const isDemo = user.role === "DEMO";
  const canWritePosts = isAdmin || isDemo;
  const [posts, comments, savedPosts] = await Promise.all([
    canWritePosts ? getCurrentUserPosts() : Promise.resolve([]),
    getCurrentUserComments(),
    getCurrentUserSavedPosts(),
  ]);

  return (
    <main className="page-shell">
      <div className="wrap">
        <section className={styles.hero}>
          <div className={styles.avatar} aria-hidden="true">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="eyebrow">Account</div>
            <h1>{user.name}</h1>
            <p>{user.email}</p>
          </div>
          <SignOutButton className={`pixel-link ${styles.signOut}`} />
        </section>

        {user.role === "DEMO" ? <DemoAccountBanner /> : null}

        <nav className={styles.tabs} aria-label="Account sections">
          {isAdmin ? <Link href="/admin/posts/new">Write post</Link> : null}
          {isDemo && posts.length < DEMO_POST_LIMIT ? (
            <Link href="/account/posts/new">Write post</Link>
          ) : null}
          {isDemo && posts.length >= DEMO_POST_LIMIT ? (
            <span aria-disabled="true" className={styles.disabledTab}>
              Write post
            </span>
          ) : null}
          {isAdmin ? <Link href="/admin/posts">Manage posts</Link> : null}
          <a href="#saved">Saved posts</a>
          <a href="#comments">My comments</a>
        </nav>

        {canWritePosts ? (
          <section className={styles.section} id="posts">
            <div className={styles.sectionHeader}>
              <h2>My posts</h2>
              <span>
                {isDemo ? `${posts.length}/${DEMO_POST_LIMIT}` : posts.length}
              </span>
            </div>

            {posts.length > 0 ? (
              <div className={styles.list}>
                {posts.map((post) => (
                  <article className={styles.item} key={post.id}>
                    <div className={styles.itemMeta}>
                      <span
                        className={
                          post.published ? styles.published : styles.draft
                        }
                      >
                        {post.published ? "Published" : "Draft"}
                      </span>
                      <time dateTime={post.updatedAt}>
                        Updated {formatDate(post.updatedAt)}
                      </time>
                    </div>
                    <h3>
                      {post.published ? (
                        <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                      ) : (
                        post.title
                      )}
                    </h3>
                    {post.excerpt ? <p>{post.excerpt}</p> : null}
                    {post.tags.length > 0 ? (
                      <div
                        className={`tag-list ${styles.tags}`}
                        aria-label="Post tags"
                      >
                        {post.tags.map((tag) => (
                          <Link
                            className="tag-chip"
                            href={`/blog?q=${encodeURIComponent(tag.name)}`}
                            key={tag.slug}
                          >
                            {tag.name}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                    <div className={styles.itemActions}>
                      <Link
                        className="pixel-link"
                        href={
                          isAdmin
                            ? `/admin/posts/${post.id}/edit`
                            : `/account/posts/${post.id}/edit`
                        }
                      >
                        Edit
                      </Link>
                      <DeletePostButton
                        postId={post.id}
                        postTitle={post.title}
                      />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <h3>No posts yet</h3>
                <p>
                  Your authored posts will appear here after you create them.
                </p>
              </div>
            )}
          </section>
        ) : null}

        <section className={styles.section} id="saved">
          <div className={styles.sectionHeader}>
            <h2>Saved posts</h2>
            <span>{savedPosts.length}</span>
          </div>

          {savedPosts.length > 0 ? (
            <div className={styles.list}>
              {savedPosts.map((post) => (
                <article className={styles.item} key={post.id}>
                  <div className={styles.itemMeta}>
                    <time dateTime={post.savedAt}>
                      Saved {formatDate(post.savedAt)}
                    </time>
                    <span>By {post.author.name}</span>
                  </div>
                  <h3>
                    <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                  </h3>
                  {post.excerpt ? <p>{post.excerpt}</p> : null}
                  <div className={styles.postLink}>
                    <Link href={`/blog/${post.slug}`}>Read post</Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <h3>No saved posts yet</h3>
              <p>Saved articles will appear here after you bookmark them.</p>
            </div>
          )}
        </section>

        <section className={styles.section} id="comments">
          <div className={styles.sectionHeader}>
            <h2>My comments</h2>
            <span>{comments.length}</span>
          </div>

          {comments.length > 0 ? (
            <div className={styles.list}>
              {comments.map((comment) => (
                <article className={styles.item} key={comment.id}>
                  <div className={styles.itemMeta}>
                    <time dateTime={comment.createdAt}>
                      {formatDate(comment.createdAt)}
                    </time>
                    <span>
                      {comment.post.published ? "Public post" : "Hidden post"}
                    </span>
                  </div>
                  <p>{previewText(comment.body)}</p>
                  <div className={styles.postLink}>
                    {comment.post.published ? (
                      <Link href={`/blog/${comment.post.slug}`}>
                        {comment.post.title}
                      </Link>
                    ) : (
                      comment.post.title
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <h3>No comments yet</h3>
              <p>
                Your blog comments will appear here after you join a discussion.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
