import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PostEditorForm } from "@/features/blog/components/PostEditorForm";
import { getCurrentUserPostCount } from "@/features/blog/data/posts";
import { DEMO_POST_LIMIT } from "@/features/demo/constants";
import { demoCovers } from "@/features/demo/covers";
import { getCurrentSession } from "@/server/auth";
import { requireUserRecord } from "@/server/permissions";
import styles from "@/app/admin/posts/new/NewPostPage.module.css";

export const metadata: Metadata = {
  title: "Write Post | Pixel Pint Arcade",
  description: "Write a demo post.",
};

export default async function DemoNewPostPage() {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  const user = await requireUserRecord();

  if (user.role === "ADMIN") {
    redirect("/admin/posts/new");
  }

  if (user.role !== "DEMO") {
    redirect("/account");
  }

  if ((await getCurrentUserPostCount()) >= DEMO_POST_LIMIT) {
    redirect("/account");
  }

  return (
    <main className="page-shell">
      <div className="wrap">
        <div className={`page-topline ${styles.topline}`}>
          <Link className="pixel-link" href="/account">
            Back
          </Link>
        </div>

        <section className={styles.intro}>
          <div className="eyebrow">New post</div>
          <h1>Write post</h1>
          <p>
            Demo posts are visible only to you and are deleted with your demo
            account.
          </p>
        </section>

        <PostEditorForm demoCovers={demoCovers} variant="demo" />
      </div>
    </main>
  );
}
