import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PostCoverImage } from "@/features/blog/components/PostCoverImage";
import { getCurrentSession } from "@/server/auth";
import { getPublishedPostCount, getPublishedPosts } from "@/features/blog/data/posts";
import styles from "./BlogPage.module.css";

export const metadata: Metadata = {
  title: "Blog | Pixel Pint Arcade",
  description: "Articles about 2D games, consoles, hardware and retro culture.",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

type BlogPageProps = {
  searchParams: Promise<{
    page?: string | string[];
    q?: string | string[];
  }>;
};

const getSearchValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const POSTS_PER_PAGE = 6;

const getPageValue = (value: string | string[] | undefined) => {
  const page = Number.parseInt(getSearchValue(value) ?? "1", 10);

  return Number.isFinite(page) && page > 0 ? page : 1;
};

export default async function BlogPage({ searchParams }: BlogPageProps) {
  await connection();

  const params = await searchParams;
  const query = getSearchValue(params.q)?.trim() ?? "";
  const requestedPage = getPageValue(params.page);
  const session = await getCurrentSession();
  const viewerId = session?.user?.id ?? null;
  const totalPosts = await getPublishedPostCount({ query, viewerId });
  const totalPages = Math.max(1, Math.ceil(totalPosts / POSTS_PER_PAGE));
  const currentPage = Math.min(requestedPage, totalPages);
  const posts = await getPublishedPosts({
    query,
    viewerId,
    take: POSTS_PER_PAGE,
    skip: (currentPage - 1) * POSTS_PER_PAGE,
  });
  const hasSearch = query.length > 0;
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;
  const showPagination = totalPosts > POSTS_PER_PAGE;

  const getPageHref = (page: number) => {
    const nextParams = new URLSearchParams();

    if (query) {
      nextParams.set("q", query);
    }

    if (page > 1) {
      nextParams.set("page", String(page));
    }

    const queryString = nextParams.toString();

    return queryString ? `/blog?${queryString}` : "/blog";
  };

  return (
    <main className="page-shell blog-page">
      <div className="wrap">
        <div className={`page-topline ${styles.topline}`}>
          <div className="eyebrow">Pixel Pint Arcade Blog</div>
          {/* <Link className="pixel-link" href="/">
            Back
          </Link> */}
        </div>

        <Breadcrumbs
          items={[{ href: "/", label: "Home" }, { label: "Blog" }]}
        />

        <section className={styles.intro}>
          <h1>Blog</h1>
          <p>
            Notes, breakdowns and stories about 2D games, retro hardware,
            consoles and the culture around them.
          </p>
        </section>

        <form action="/blog" className={styles.searchForm}>
          <div className={styles.searchField}>
            <label htmlFor="blog-search">Search articles</label>
            <input
              id="blog-search"
              name="q"
              defaultValue={query}
              placeholder="Search posts..."
              type="search"
            />
          </div>
          <div className={styles.searchActions}>
            <button className="btn" type="submit">
              Search
            </button>
            {hasSearch ? (
              <Link className="pixel-link" href="/blog">
                Clear
              </Link>
            ) : null}
          </div>
        </form>

        {posts.length > 0 ? (
          <section className={styles.grid} aria-label="Published posts">
            {posts.map((post) => (
              <article className={styles.card} key={post.id}>
                {post.coverImageUrl ? (
                  <PostCoverImage
                    alt={post.coverImageAlt ?? post.title}
                    className={styles.coverImage}
                    src={post.coverImageUrl}
                  />
                ) : (
                  <div className={styles.coverPlaceholder} aria-hidden="true">
                    <span>No cover</span>
                  </div>
                )}
                <time dateTime={post.createdAt}>
                  {formatDate(post.createdAt)}
                </time>
                {post.visibleOnlyToAuthor ? (
                  <span className={styles.visibilityBadge}>
                    Visible only to you
                  </span>
                ) : null}
                <h2>
                  <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </h2>
                {post.excerpt ? <p>{post.excerpt}</p> : null}
                {post.tags.length > 0 ? (
                  <div className="tag-list" aria-label="Post tags">
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
                <span>By {post.author.name}</span>
              </article>
            ))}
          </section>
        ) : (
          <section className={styles.emptyState}>
            {hasSearch ? (
              <>
                <h2>No posts found</h2>
                <p>
                  No articles match &quot;{query}&quot;. Try another search.
                </p>
              </>
            ) : (
              <>
                <h2>No posts yet</h2>
                <p>
                  The first stories are still being prepared. Check back soon
                  for notes on 2D games, retro hardware and arcade culture.
                </p>
              </>
            )}
          </section>
        )}

        {showPagination ? (
          <nav className={styles.pagination} aria-label="Blog pagination">
            {hasPreviousPage ? (
              <Link className="pixel-link" href={getPageHref(currentPage - 1)}>
                Previous
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className={`pixel-link ${styles.paginationDisabled}`}
              >
                Previous
              </span>
            )}
            <span className={styles.paginationMeta}>
              Page {currentPage} of {totalPages}
            </span>
            {hasNextPage ? (
              <Link className="pixel-link" href={getPageHref(currentPage + 1)}>
                Next
              </Link>
            ) : (
              <span
                aria-disabled="true"
                className={`pixel-link ${styles.paginationDisabled}`}
              >
                Next
              </span>
            )}
          </nav>
        ) : null}
      </div>
    </main>
  );
}
