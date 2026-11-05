export const getVisibleToViewerWhere = (viewerId?: string | null) => ({
  OR: [
    { author: { role: { not: "DEMO" as const } } },
    ...(viewerId ? [{ authorId: viewerId }] : []),
  ],
});

export const getPublishedVisibleToViewerWhere = (viewerId?: string | null) => ({
  AND: [{ published: true }, getVisibleToViewerWhere(viewerId)],
});
