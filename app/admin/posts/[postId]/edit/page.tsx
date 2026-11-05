import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PostEditorForm } from "@/features/blog/components/PostEditorForm";
import { getCurrentSession } from "@/server/auth";
import { getCoverUploadMode } from "@/server/blob-storage";
import { requireUserRecord } from "@/server/permissions";
import { getAdminPostForEdit } from "@/features/blog/data/posts";
import styles from "../../new/NewPostPage.module.css";

export const metadata: Metadata = {
  title: "Edit Post | Pixel Pint Arcade",
  description: "Edit a Pixel Pint Arcade post.",
};

type EditPostPageProps = {
  params: Promise<{
    postId: string;
  }>;
};

export default async function EditPostPage({ params }: EditPostPageProps) {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  const user = await requireUserRecord();

  if (user.role !== "ADMIN") {
    redirect("/account");
  }

  const { postId } = await params;
  const post = await getAdminPostForEdit(postId);

  if (!post) {
    notFound();
  }

  return (
    <main className="page-shell">
      <div className="wrap">
        <div className={`page-topline ${styles.topline}`}>
          <Link className="pixel-link" href="/admin/posts">
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
          <p>Update the draft, change tags, or publish the article.</p>
        </section>

        <PostEditorForm
          coverUploadMode={getCoverUploadMode()}
          mode="edit"
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
