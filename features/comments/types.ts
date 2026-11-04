export type CommentDTO = {
  id: string;
  body: string;
  postId: string;
  parentId: string | null;
  createdAt: string;
  deleted: boolean;
  author: {
    id: string;
    name: string;
    image: string | null;
  } | null;
};

export type AccountCommentDTO = {
  id: string;
  body: string;
  createdAt: string;
  post: {
    title: string;
    slug: string;
    published: boolean;
  };
};
