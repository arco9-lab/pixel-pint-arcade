"use server";

import { revalidatePath } from "next/cache";

import {
  deletePostSchema,
  postSchema,
  updatePostSchema,
} from "@/features/blog/validators/post-schema";
import {
  createPost,
  deletePost,
  updatePost,
} from "@/features/blog/data/posts";
import { requirePostAuthor } from "@/server/permissions";
import { deleteCoverImageBlob } from "@/server/blob-storage";
import { savePostCoverImage } from "@/server/storage";
import type { ActionState } from "@/lib/action-state";

const actionError = (message: string): ActionState => ({
  ok: false,
  message,
});

const booleanFromForm = (value: FormDataEntryValue | null) => {
  return value === "on" || value === "true";
};

const nullableStringFromForm = (value: FormDataEntryValue | null) =>
  typeof value === "string" && value.trim() ? value : null;

const postWriteError = (
  error: unknown,
  messages: { ownership: string },
): ActionState | null => {
  if (!(error instanceof Error)) {
    return null;
  }

  if (error.message === "DemoPostLimit") {
    return actionError("Demo accounts can have up to 3 posts.");
  }

  if (error.message === "NotOwner") {
    return actionError(messages.ownership);
  }

  if (error.message === "InvalidDemoCover") {
    return {
      ok: false,
      errors: {
        coverImageUrl: ["Choose a cover from the gallery."],
      },
    };
  }

  return null;
};

const coverImageError = (error: unknown): ActionState | null => {
  if (!(error instanceof Error)) {
    return null;
  }

  if (error.message === "InvalidCoverImageType") {
    return {
      ok: false,
      errors: {
        coverImageFile: ["Upload a PNG, JPG, WebP, or GIF image."],
      },
    };
  }

  if (error.message === "CoverImageTooLarge") {
    return {
      ok: false,
      errors: {
        coverImageFile: ["Cover image must be 5MB or smaller."],
      },
    };
  }

  return null;
};

export async function createPostAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = postSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    excerpt: nullableStringFromForm(formData.get("excerpt")),
    coverImageUrl: nullableStringFromForm(formData.get("coverImageUrl")),
    coverImageAlt: nullableStringFromForm(formData.get("coverImageAlt")),
    seoTitle: nullableStringFromForm(formData.get("seoTitle")),
    seoDescription: nullableStringFromForm(formData.get("seoDescription")),
    tags: formData.get("tags") || undefined,
    content: formData.get("content"),
    published: booleanFromForm(formData.get("published")),
    commentsEnabled: booleanFromForm(formData.get("commentsEnabled")),
  });

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const author = await requirePostAuthor();
    const uploadedCoverImageUrl =
      author.role === "DEMO"
        ? undefined
        : await savePostCoverImage(formData.get("coverImageFile"));

    await createPost({
      ...parsed.data,
      coverImageUrl: parsed.data.coverImageUrl ?? uploadedCoverImageUrl ?? null,
    });
    revalidatePath("/");
    revalidatePath("/account");
    revalidatePath("/blog");
    revalidatePath(`/blog/${parsed.data.slug}`);
    return { ok: true, resetKey: parsed.data.slug };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return actionError("Sign in before creating a post.");
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return actionError("Only admins can create posts.");
    }

    const writeError = postWriteError(error, {
      ownership: "You can edit only your own posts.",
    });

    if (writeError) {
      return writeError;
    }

    const uploadError = coverImageError(error);

    if (uploadError) {
      return uploadError;
    }

    return actionError("Could not create the post.");
  }
}

export async function updatePostAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updatePostSchema.safeParse({
    postId: formData.get("postId"),
    title: formData.get("title"),
    slug: formData.get("slug"),
    excerpt: nullableStringFromForm(formData.get("excerpt")),
    coverImageUrl: nullableStringFromForm(formData.get("coverImageUrl")),
    coverImageAlt: nullableStringFromForm(formData.get("coverImageAlt")),
    seoTitle: nullableStringFromForm(formData.get("seoTitle")),
    seoDescription: nullableStringFromForm(formData.get("seoDescription")),
    tags: formData.get("tags") ?? "",
    content: formData.get("content"),
    published: booleanFromForm(formData.get("published")),
    commentsEnabled: booleanFromForm(formData.get("commentsEnabled")),
  });

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const {
      postId,
      coverImageUrl: submittedCoverImageUrl,
      ...postInput
    } = parsed.data;
    const author = await requirePostAuthor();
    const uploadedCoverImageUrl =
      author.role === "DEMO"
        ? undefined
        : await savePostCoverImage(formData.get("coverImageFile"));
    const removeCoverImage = booleanFromForm(formData.get("removeCoverImage"));
    const coverImageUrl = removeCoverImage
      ? null
      : (submittedCoverImageUrl ?? uploadedCoverImageUrl);
    const updatedPost = await updatePost(postId, {
      ...postInput,
      ...(coverImageUrl !== undefined ? { coverImageUrl } : {}),
    });

    if (updatedPost.previousCoverImageUrl !== updatedPost.coverImageUrl) {
      await deleteCoverImageBlob(updatedPost.previousCoverImageUrl);
    }

    revalidatePath("/");
    revalidatePath("/account");
    revalidatePath("/blog");
    revalidatePath(`/blog/${updatedPost.previousSlug}`);
    revalidatePath(`/blog/${postInput.slug}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return actionError("Sign in before editing a post.");
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return actionError("Only admins can edit posts.");
    }

    if (error instanceof Error && error.message === "NotFound") {
      return actionError("Post not found.");
    }

    const writeError = postWriteError(error, {
      ownership: "You can edit only your own posts.",
    });

    if (writeError) {
      return writeError;
    }

    const uploadError = coverImageError(error);

    if (uploadError) {
      return uploadError;
    }

    return actionError("Could not update the post.");
  }
}

export async function deletePostAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = deletePostSchema.safeParse({
    postId: formData.get("postId"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const deletedPost = await deletePost(parsed.data.postId);
    await deleteCoverImageBlob(deletedPost.coverImageUrl);
    revalidatePath("/");
    revalidatePath("/account");
    revalidatePath("/blog");
    revalidatePath(`/blog/${deletedPost.slug}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return actionError("Sign in before deleting a post.");
    }

    if (error instanceof Error && error.message === "Forbidden") {
      return actionError("Only admins can delete posts.");
    }

    const writeError = postWriteError(error, {
      ownership: "You can delete only your own posts.",
    });

    if (writeError) {
      return writeError;
    }

    return actionError("Could not delete the post.");
  }
}
