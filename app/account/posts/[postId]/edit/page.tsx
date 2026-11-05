import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PostEditorForm } from "@/features/blog/components/PostEditorForm";
import { getPostForEdit } from "@/features/blog/data/posts";
import { demoCovers } from "@/features/demo/covers";
import { getCurrentSession } from "@/server/auth";
import { requireUserRecord } from "@/server/permissions";
import styles from "@/app/admin/posts/new/NewPostPage.module.css";

export const metadata: Metadata = {
  title: "Edit Post | Pixel Pint Arcade",
  description: "Edit a demo post.",
};

type DemoEditPostPageProps = {
  params: Promise<{
    postId: string;
  }>;
};

export default async function DemoEditPostPage({
  params,
}: DemoEditPostPageProps) {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  const user = await requireUserRecord();
  const { postId } = await params;

  if (user.role === "ADMIN") {
    redirect(`/admin/posts/${postId}/edit`);
  }

  if (user.role !== "DEMO") {
    redirect("/account");
  }

  const post = await getPostForEdit(postId);

  if (!post) {
    notFound();
  }

  return (
    <main className="page-shell">
      <div className="wrap">
        <div className={`page-topline ${styles.topline}`}>
          <Link className="pixel-link" href="/account">
            Back
          </Link>
          {post.published ? (
            <Link className="pixel-link" href={`/blog/${post.slug}`}>
              View post
            </Link>
          ) : null}
        </div>

        <section className={styles.intro}>
          <div className="eyebrow">Edit post</div>
          <h1>Edit post</h1>
          <p>Update the draft, change tags, or publish the post.</p>
        </section>

        <PostEditorForm
          demoCovers={demoCovers}
          mode="edit"
          variant="demo"
          initialValues={{
            id: post.id,
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt ?? "",
            coverImageUrl: post.coverImageUrl ?? "",
            coverImageAlt: post.coverImageAlt ?? "",
            seoTitle: post.seoTitle ?? "",
            seoDescription: post.seoDescription ?? "",
            tags: post.tags.map((tag) => tag.name).join(", "),
            content: post.content,
            published: post.published,
            commentsEnabled: post.commentsEnabled,
          }}
        />
      </div>
    </main>
  );
}
