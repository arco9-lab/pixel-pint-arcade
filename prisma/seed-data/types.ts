export type SeedPost = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  tags: string[];
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  published: boolean;
  commentsEnabled: boolean;
  createdAt: string;
  updatedAt: string | null;
};

export type SeedReader = {
  id: string;
  name: string;
  email: string;
};
