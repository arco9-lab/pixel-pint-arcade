export type SeedComment = {
  key: string;
  author: string;
  body: string;
  replies?: SeedComment[];
};

export type SeedPost = {
  number: number;
  coverFile: string | null;
  title: string;
  slug: string;
  excerpt: string;
  seoTitle: string | null;
  seoDescription: string | null;
  coverImageAlt: string | null;
  tags: string[];
  published: boolean;
  commentsEnabled: boolean;
  daysAgo: number;
  updatedDaysAgo: number | null;
  likes: string[];
  content: string;
  comments: SeedComment[];
};

export type SeedReader = {
  alias: string;
  id: string;
  name: string;
  email: string;
};
