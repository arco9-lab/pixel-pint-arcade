import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PostEditorForm } from "@/features/blog/components/PostEditorForm";
import { getCurrentSession } from "@/server/auth";
import { getCoverUploadMode } from "@/server/blob-storage";
import { requireUserRecord } from "@/server/permissions";
import styles from "./NewPostPage.module.css";

export const metadata: Metadata = {
  title: "Write Post | Pixel Pint Arcade",
  description: "Write a new Pixel Pint Arcade post.",
};

export default async function NewPostPage() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  const user = await requireUserRecord();

  if (user.role !== "ADMIN") {
    redirect("/account");
  }

  return (
    <main className="page-shell">
      <div className="wrap">
        <div className={`page-topline ${styles.topline}`}>
          <Link className="pixel-link" href="/admin/posts">
            Back
          </Link>
        </div>

        <section className={styles.intro}>
          <div className="eyebrow">New post</div>
          <h1>Write post</h1>
          <p>Create a draft or publish it straight to the blog.</p>
        </section>

        <PostEditorForm coverUploadMode={getCoverUploadMode()} />
      </div>
    </main>
  );
}
