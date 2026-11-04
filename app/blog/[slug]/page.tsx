import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CommentsSection } from "@/features/comments/components/CommentsSection";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { ArticleBody } from "@/features/blog/components/ArticleBody";
import { PostCoverImage } from "@/features/blog/components/PostCoverImage";
import { PostEngagementControls } from "@/features/blog/components/PostEngagementControls";
import { RelatedPosts } from "@/features/blog/components/RelatedPosts";
// import { SocialShare } from "@/features/blog/components/SocialShare";
import { TableOfContents } from "@/features/blog/components/TableOfContents";
import { getCurrentSession } from "@/server/auth";
import { requireUserRecord } from "@/server/permissions";
import { getCommentsForPost } from "@/features/comments/data/comments";
import { getPostEngagement } from "@/features/blog/data/post-engagement";
import { getPublishedPostBySlug, getRelatedPosts } from "@/features/blog/data/posts";
import { parseArticleContent } from "@/features/blog/data/article-content";
import { formatReadingTime, getReadingTimeMinutes } from "@/lib/formatting";
import styles from "./PostPage.module.css";

type BlogPostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

const shouldShowUpdatedAt = (createdAt: string, updatedAt: string) =>
  new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 60_000;

// const getPostUrl = (slug: string) => {
//   const siteUrl =
//     process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
//     "http://localhost:3000";
//
//   return `${siteUrl}/blog/${slug}`;
// };

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const session = await getCurrentSession();
  const post = await getPublishedPostBySlug(slug, session?.user?.id);

  if (!post) {
    return {
      title: "Post not found | Pixel Pint Arcade",
    };
  }

  const title = post.seoTitle ?? post.title;
  const description =
    post.seoDescription ?? post.excerpt ?? "Pixel Pint Arcade blog article.";

  return {
    title: `${title} | Pixel Pint Arcade`,
    description,
    ...(post.coverImageUrl
      ? {
          openGraph: {
            images: [
              {
                alt: post.coverImageAlt ?? post.title,
                url: post.coverImageUrl,
              },
            ],
          },
        }
      : {}),
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const session = await getCurrentSession();
  const post = await getPublishedPostBySlug(slug, session?.user?.id);

  if (!post) {
    notFound();
  }

  const [comments, relatedPosts] = await Promise.all([
    getCommentsForPost(post.id),
    getRelatedPosts({
      postId: post.id,
      tagSlugs: post.tags.map((tag) => tag.slug),
    }),
  ]);
  const currentUser = session?.user ? await requireUserRecord() : null;
  const engagement = await getPostEngagement(post.id, currentUser?.id);
  const readingTime = formatReadingTime(getReadingTimeMinutes(post.content));
  const article = parseArticleContent(post.content);
  const showUpdatedAt = shouldShowUpdatedAt(post.createdAt, post.updatedAt);
  // const postUrl = getPostUrl(post.slug);

  return (
    <main className="page-shell blog-page">
      <div className="wrap">
        <article>
          <Breadcrumbs
            items={[
              { href: "/", label: "Home" },
              { href: "/blog", label: "Blog" },
              { label: post.title },
            ]}
          />
          <Link className={`pixel-link ${styles.backLink}`} href="/blog">
            Back
          </Link>
          <div className="eyebrow">Article</div>
          {post.visibleOnlyToAuthor ? (
            <p className={styles.visibilityNotice}>
              Visible only to you. Other visitors cannot open this post.
            </p>
          ) : null}
          <h1>{post.title}</h1>
          <p className={styles.meta}>
            <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
            {showUpdatedAt ? (
              <>
                {" "}
                · Updated{" "}
                <time dateTime={post.updatedAt}>
                  {formatDate(post.updatedAt)}
                </time>
              </>
            ) : null}{" "}
            · {readingTime} · By {post.author.name}
          </p>
          {post.tags.length > 0 ? (
            <div className={`tag-list ${styles.tags}`} aria-label="Post tags">
              {post.tags.map((tag) => (
                <Link
                  className={`tag-chip ${styles.tag}`}
                  href={`/blog?q=${encodeURIComponent(tag.name)}`}
                  key={tag.slug}
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          ) : null}
          <PostEngagementControls
            bookmarkedByCurrentUser={engagement.bookmarkedByCurrentUser}
            likedByCurrentUser={engagement.likedByCurrentUser}
            likesCount={engagement.likesCount}
            postId={post.id}
            signedIn={Boolean(currentUser)}
          />
          {post.coverImageUrl ? (
            <figure className={styles.cover}>
              <PostCoverImage
                alt={post.coverImageAlt ?? post.title}
                src={post.coverImageUrl}
              />
            </figure>
          ) : null}
          {/* <SocialShare title={post.title} url={postUrl} /> */}
          <TableOfContents headings={article.headings} />
          <ArticleBody blocks={article.blocks} />
        </article>
        <CommentsSection
          comments={comments}
          commentsEnabled={post.commentsEnabled}
          currentUser={currentUser}
          postId={post.id}
          postSlug={post.slug}
        />
        <RelatedPosts posts={relatedPosts} />
      </div>
    </main>
  );
}
