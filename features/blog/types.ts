export type PostTagDTO = {
  name: string;
  slug: string;
};

export type PostListItemDTO = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  createdAt: string;
  updatedAt: string;
  commentsEnabled: boolean;
  visibleOnlyToAuthor: boolean;
  tags: PostTagDTO[];
  author: {
    name: string;
    image: string | null;
  };
};

export type PostDetailDTO = PostListItemDTO & {
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type AccountPostDTO = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  published: boolean;
  commentsEnabled: boolean;
  tags: PostTagDTO[];
  createdAt: string;
  updatedAt: string;
};

export type AdminPostEditDTO = AccountPostDTO & {
  content: string;
};

export type PostEngagementDTO = {
  likesCount: number;
  likedByCurrentUser: boolean;
  bookmarkedByCurrentUser: boolean;
};

export type SavedPostDTO = {
  id: string;
  savedAt: string;
  title: string;
  slug: string;
  excerpt: string | null;
  createdAt: string;
  author: {
    name: string;
  };
};

export type ArticleBlock =
  | {
      id: string;
      level: 2 | 3;
      text: string;
      type: "heading";
    }
  | {
      text: string;
      type: "paragraph";
    };

export type ArticleHeading = {
  id: string;
  level: 2 | 3;
  text: string;
};
