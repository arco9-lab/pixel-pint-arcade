"use client";

import { upload } from "@vercel/blob/client";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import { createPostAction, updatePostAction } from "@/features/blog/actions/posts";
import type { ActionState } from "@/lib/action-state";
import {
  COVER_BLOB_PATH_PREFIX,
  COVER_IMAGE_CONTENT_TYPES,
  COVER_IMAGE_MAX_BYTES,
  type CoverUploadMode,
} from "@/features/blog/cover-image";
import { parseArticleContent } from "@/features/blog/data/article-content";
import type { DemoCover } from "@/features/demo/covers";
import { ArticleBody } from "./ArticleBody";
import { PostCoverImage } from "./PostCoverImage";
import styles from "./PostEditorForm.module.css";

const initialState: ActionState = {
  ok: false,
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const parseTagPreview = (value: string) => {
  const tags = new Map<string, string>();

  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .forEach((tag) => {
      const slug = slugify(tag);

      if (slug && !tags.has(slug)) {
        tags.set(slug, tag);
      }
    });

  return [...tags.entries()].map(([slug, name]) => ({ name, slug }));
};

type PostEditorVariant = "admin" | "demo";

type PostEditorFieldsProps = {
  coverUploadMode: CoverUploadMode;
  demoCovers: DemoCover[];
  variant: PostEditorVariant;
  initialValues: PostEditorInitialValues;
  mode: PostEditorMode;
  pending: boolean;
  state: ActionState;
};

type PostEditorMode = "create" | "edit";
type PostEditorTab = "post" | "seo" | "cover" | "preview";

export type PostEditorInitialValues = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImageUrl: string;
  coverImageAlt: string;
  seoTitle: string;
  seoDescription: string;
  tags: string;
  content: string;
  published: boolean;
  commentsEnabled: boolean;
};

const emptyInitialValues: PostEditorInitialValues = {
  title: "",
  slug: "",
  excerpt: "",
  coverImageUrl: "",
  coverImageAlt: "",
  seoTitle: "",
  seoDescription: "",
  tags: "",
  content: "",
  published: false,
  commentsEnabled: true,
};

const PostEditorFields = ({
  coverUploadMode,
  demoCovers,
  variant,
  initialValues,
  mode,
  pending,
  state,
}: PostEditorFieldsProps) => {
  const [title, setTitle] = useState(initialValues.title);
  const [slug, setSlug] = useState(initialValues.slug);
  const [excerpt, setExcerpt] = useState(initialValues.excerpt);
  const [coverImageAlt, setCoverImageAlt] = useState(
    initialValues.coverImageAlt,
  );
  const [seoTitle, setSeoTitle] = useState(initialValues.seoTitle);
  const [seoDescription, setSeoDescription] = useState(
    initialValues.seoDescription,
  );
  const [coverFileName, setCoverFileName] = useState("");
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const [removeCoverImage, setRemoveCoverImage] = useState(false);
  const isDemo = variant === "demo";
  const [selectedDemoCoverUrl, setSelectedDemoCoverUrl] = useState(
    demoCovers.some((cover) => cover.url === initialValues.coverImageUrl)
      ? initialValues.coverImageUrl
      : "",
  );
  const selectedDemoCover = demoCovers.find(
    (cover) => cover.url === selectedDemoCoverUrl,
  );
  const [uploadedCoverUrl, setUploadedCoverUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState("");
  const latestUploadId = useRef(0);
  const [tags, setTags] = useState(initialValues.tags);
  const [content, setContent] = useState(initialValues.content);
  const [slugEdited, setSlugEdited] = useState(mode === "edit");
  const [activeTab, setActiveTab] = useState<PostEditorTab>("post");
  const tagPreview = parseTagPreview(tags);
  const articlePreview = useMemo(() => parseArticleContent(content), [content]);
  const previewCoverSrc = isDemo
    ? selectedDemoCoverUrl
    : coverPreviewUrl || (removeCoverImage ? "" : initialValues.coverImageUrl);
  const tabErrors = {
    cover: Boolean(
      uploadError ||
        state.errors?.coverImageAlt ||
        state.errors?.coverImageFile ||
        state.errors?.coverImageUrl,
    ),
    post: Boolean(
      state.errors?.content ||
        state.errors?.excerpt ||
        state.errors?.slug ||
        state.errors?.tags ||
        state.errors?.title,
    ),
    seo: Boolean(state.errors?.seoDescription || state.errors?.seoTitle),
  };

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [coverPreviewUrl]);

  const tabButtonClassName = (tab: PostEditorTab) =>
    activeTab === tab ? `${styles.tab} ${styles.activeTab}` : styles.tab;

  const handleTitleChange = (value: string) => {
    setTitle(value);

    if (!slugEdited) {
      setSlug(slugify(value));
    }
  };

  const handleSlugChange = (value: string) => {
    setSlug(value);
    setSlugEdited(true);
  };

  const startCoverUpload = async (file: File) => {
    const uploadId = latestUploadId.current + 1;
    latestUploadId.current = uploadId;
    const isLatestUpload = () => latestUploadId.current === uploadId;

    setUploadedCoverUrl("");
    setUploadError("");

    if (!COVER_IMAGE_CONTENT_TYPES.includes(file.type)) {
      setUploadError("Upload a PNG, JPG, WebP, or GIF image.");
      return;
    }

    if (file.size > COVER_IMAGE_MAX_BYTES) {
      setUploadError("Cover image must be 5MB or smaller.");
      return;
    }

    setUploadProgress(0);

    try {
      const blob = await upload(`${COVER_BLOB_PATH_PREFIX}${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/blob/cover-upload",
        onUploadProgress: ({ percentage }) => {
          if (isLatestUpload()) {
            setUploadProgress(Math.round(percentage));
          }
        },
      });

      if (isLatestUpload()) {
        setUploadedCoverUrl(blob.url);
      }
    } catch {
      if (isLatestUpload()) {
        setUploadError("Cover upload failed. Try again.");
      }
    } finally {
      if (isLatestUpload()) {
        setUploadProgress(null);
      }
    }
  };

  const handleCoverFileChange = (file?: File) => {
    setCoverFileName(file?.name ?? "");
    setRemoveCoverImage(false);

    if (coverUploadMode === "blob") {
      if (file) {
        void startCoverUpload(file);
      } else {
        latestUploadId.current += 1;
        setUploadedCoverUrl("");
        setUploadError("");
        setUploadProgress(null);
      }
    }

    setCoverPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return file ? URL.createObjectURL(file) : "";
    });
  };

  return (
    <>
      {mode === "edit" ? (
        <input name="postId" type="hidden" value={initialValues.id ?? ""} />
      ) : null}

      <div className={styles.tabs} role="tablist" aria-label="Post editor sections">
        <button
          aria-controls="post-editor-panel-post"
          aria-selected={activeTab === "post"}
          className={tabButtonClassName("post")}
          id="post-editor-tab-post"
          onClick={() => setActiveTab("post")}
          role="tab"
          type="button"
        >
          Post
          {tabErrors.post ? <span aria-label="Has errors"></span> : null}
        </button>
        <button
          aria-controls="post-editor-panel-seo"
          aria-selected={activeTab === "seo"}
          className={tabButtonClassName("seo")}
          id="post-editor-tab-seo"
          onClick={() => setActiveTab("seo")}
          role="tab"
          type="button"
        >
          SEO
          {tabErrors.seo ? <span aria-label="Has errors"></span> : null}
        </button>
        <button
          aria-controls="post-editor-panel-cover"
          aria-selected={activeTab === "cover"}
          className={tabButtonClassName("cover")}
          id="post-editor-tab-cover"
          onClick={() => setActiveTab("cover")}
          role="tab"
          type="button"
        >
          Cover
          {tabErrors.cover ? <span aria-label="Has errors"></span> : null}
        </button>
        <button
          aria-controls="post-editor-panel-preview"
          aria-selected={activeTab === "preview"}
          className={`${tabButtonClassName("preview")} ${styles.previewTab}`}
          id="post-editor-tab-preview"
          onClick={() => setActiveTab("preview")}
          role="tab"
          type="button"
        >
          Preview
        </button>
      </div>

      <section
        aria-labelledby="post-editor-tab-post"
        className={styles.panel}
        hidden={activeTab !== "post"}
        id="post-editor-panel-post"
        role="tabpanel"
      >
        <div className={styles.field}>
          <label htmlFor="title">Title</label>
          <input
            id="title"
            name="title"
            value={title}
            onChange={(event) => handleTitleChange(event.target.value)}
            required
            maxLength={160}
          />
          {state.errors?.title ? <p>{state.errors.title[0]}</p> : null}
        </div>

        {isDemo ? (
          <input name="slug" type="hidden" value={slug || "post"} />
        ) : (
          <div className={styles.field}>
            <label htmlFor="slug">Slug</label>
            <input
              id="slug"
              name="slug"
              value={slug}
              onChange={(event) => handleSlugChange(event.target.value)}
              required
              maxLength={180}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            />
            {state.errors?.slug ? <p>{state.errors.slug[0]}</p> : null}
          </div>
        )}

        <div className={styles.field}>
          <label htmlFor="excerpt">Excerpt</label>
          <textarea
            id="excerpt"
            name="excerpt"
            rows={3}
            maxLength={300}
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
          />
          {state.errors?.excerpt ? <p>{state.errors.excerpt[0]}</p> : null}
        </div>

        <div className={styles.field}>
          <label htmlFor="tags">Tags</label>
          <input
            id="tags"
            name="tags"
            maxLength={240}
            placeholder="NES, hardware, review"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
          {state.errors?.tags ? <p>{state.errors.tags[0]}</p> : null}
          {tagPreview.length > 0 ? (
            <div className={styles.tagPreview} aria-label="Tag preview">
              {tagPreview.map((tag) => (
                <span className="tag-chip" key={tag.slug}>
                  {tag.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className={styles.field}>
          <label htmlFor="content">Content</label>
          <textarea
            id="content"
            name="content"
            rows={14}
            required
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          {state.errors?.content ? <p>{state.errors.content[0]}</p> : null}
        </div>

        <label className={styles.toggle}>
          <input
            name="published"
            type="checkbox"
            defaultChecked={initialValues.published}
          />
          <span>Publish now</span>
        </label>

        {isDemo ? null : (
          <label className={styles.toggle}>
            <input
              name="commentsEnabled"
              type="checkbox"
              defaultChecked={initialValues.commentsEnabled}
            />
            <span>Allow comments</span>
          </label>
        )}
      </section>

      <section
        aria-labelledby="post-editor-tab-seo"
        className={styles.panel}
        hidden={activeTab !== "seo"}
        id="post-editor-panel-seo"
        role="tabpanel"
      >
        <div className={styles.field}>
          <label htmlFor="seoTitle">SEO title</label>
          <input
            id="seoTitle"
            name="seoTitle"
            maxLength={160}
            value={seoTitle}
            onChange={(event) => setSeoTitle(event.target.value)}
          />
          {state.errors?.seoTitle ? <p>{state.errors.seoTitle[0]}</p> : null}
        </div>

        <div className={styles.field}>
          <label htmlFor="seoDescription">SEO description</label>
          <textarea
            id="seoDescription"
            name="seoDescription"
            rows={3}
            maxLength={300}
            value={seoDescription}
            onChange={(event) => setSeoDescription(event.target.value)}
          />
          {state.errors?.seoDescription ? (
            <p>{state.errors.seoDescription[0]}</p>
          ) : null}
        </div>
      </section>

      <section
        aria-labelledby="post-editor-tab-cover"
        className={styles.panel}
        hidden={activeTab !== "cover"}
        id="post-editor-panel-cover"
        role="tabpanel"
      >
        {isDemo ? (
          <>
            <fieldset className={styles.field}>
              <legend className={styles.fieldLabel}>Cover image</legend>
              <label className={styles.removeCover}>
                <input
                  checked={selectedDemoCoverUrl === ""}
                  name="coverImageUrl"
                  onChange={() => setSelectedDemoCoverUrl("")}
                  type="radio"
                  value=""
                />
                <span>No cover</span>
              </label>
              {demoCovers.map((cover) => (
                <label className={styles.removeCover} key={cover.url}>
                  <input
                    checked={selectedDemoCoverUrl === cover.url}
                    name="coverImageUrl"
                    onChange={() => setSelectedDemoCoverUrl(cover.url)}
                    type="radio"
                    value={cover.url}
                  />
                  <PostCoverImage alt={cover.alt} src={cover.url} />
                </label>
              ))}
              {selectedDemoCoverUrl === "" ? (
                <input name="removeCoverImage" type="hidden" value="on" />
              ) : null}
              <input
                name="coverImageAlt"
                type="hidden"
                value={selectedDemoCover?.alt ?? ""}
              />
              {state.errors?.coverImageUrl ? (
                <p>{state.errors.coverImageUrl[0]}</p>
              ) : null}
            </fieldset>
          </>
        ) : (
          <>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Cover image</span>
              <input
                accept="image/gif,image/jpeg,image/png,image/webp"
                className={styles.fileInput}
                id="coverImageFile"
                name={coverUploadMode === "form" ? "coverImageFile" : undefined}
                onChange={(event) => handleCoverFileChange(event.target.files?.[0])}
                type="file"
              />
              <label className={styles.fileButton} htmlFor="coverImageFile">
                Choose image
              </label>
              <span className={styles.fileName}>
                {coverFileName || "No image selected"}
              </span>
              {coverUploadMode === "blob" ? (
                <input name="coverImageUrl" type="hidden" value={uploadedCoverUrl} />
              ) : null}
              {uploadProgress !== null ? (
                <span className={styles.fileName} role="status">
                  Uploading... {uploadProgress}%
                </span>
              ) : null}
              {uploadedCoverUrl ? (
                <span className={styles.fileName} role="status">
                  Cover uploaded.
                </span>
              ) : null}
              {uploadError ? <p>{uploadError}</p> : null}
              {state.errors?.coverImageFile ? (
                <p>{state.errors.coverImageFile[0]}</p>
              ) : null}
              {state.errors?.coverImageUrl ? (
                <p>{state.errors.coverImageUrl[0]}</p>
              ) : null}
              {initialValues.coverImageUrl ? (
                <div className={styles.coverPreview}>
                  <PostCoverImage
                    alt={initialValues.coverImageAlt || initialValues.title}
                    src={initialValues.coverImageUrl}
                  />
                  <label className={styles.removeCover}>
                    <input
                      checked={removeCoverImage}
                      name="removeCoverImage"
                      onChange={(event) => setRemoveCoverImage(event.target.checked)}
                      type="checkbox"
                    />
                    <span>Remove current cover</span>
                  </label>
                </div>
              ) : null}
            </div>

            <div className={styles.field}>
              <label htmlFor="coverImageAlt">Cover image alt</label>
              <input
                id="coverImageAlt"
                name="coverImageAlt"
                maxLength={180}
                value={coverImageAlt}
                onChange={(event) => setCoverImageAlt(event.target.value)}
              />
              {state.errors?.coverImageAlt ? (
                <p>{state.errors.coverImageAlt[0]}</p>
              ) : null}
            </div>
          </>
        )}
      </section>

      <section
        aria-labelledby="post-editor-tab-preview"
        className={styles.panel}
        hidden={activeTab !== "preview"}
        id="post-editor-panel-preview"
        role="tabpanel"
      >
        <article className={styles.preview}>
          <div className="eyebrow">Article preview</div>
          <h2>{title.trim() || "Untitled post"}</h2>
          {tagPreview.length > 0 ? (
            <div className="tag-list" aria-label="Preview tags">
              {tagPreview.map((tag) => (
                <span className="tag-chip" key={tag.slug}>
                  {tag.name}
                </span>
              ))}
            </div>
          ) : null}
          {previewCoverSrc ? (
            <figure className={styles.previewCover}>
              <PostCoverImage
                alt={coverImageAlt.trim() || title.trim() || "Post cover"}
                src={previewCoverSrc}
              />
            </figure>
          ) : null}
          {content.trim() ? (
            <ArticleBody blocks={articlePreview.blocks} />
          ) : (
            <div className={styles.previewEmpty}>No content yet.</div>
          )}
        </article>
      </section>

      <div className={styles.actions}>
        <button
          className="btn"
          type="submit"
          disabled={pending || uploadProgress !== null}
        >
          {pending
            ? "Saving..."
            : mode === "edit"
              ? "Save changes"
              : "Save post"}
        </button>
        {state.ok ? (
          <span className={styles.success}>
            {mode === "edit" ? "Post updated." : "Post saved."}
          </span>
        ) : null}
        {state.message ? <span className={styles.error}>{state.message}</span> : null}
      </div>
    </>
  );
};

type PostEditorFormProps = {
  coverUploadMode?: CoverUploadMode;
  demoCovers?: DemoCover[];
  variant?: PostEditorVariant;
  initialValues?: PostEditorInitialValues;
  mode?: PostEditorMode;
};

export const PostEditorForm = ({
  coverUploadMode = "form",
  demoCovers = [],
  variant = "admin",
  initialValues = emptyInitialValues,
  mode = "create",
}: PostEditorFormProps) => {
  const action = mode === "edit" ? updatePostAction : createPostAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form className={styles.form} action={formAction} noValidate>
      <PostEditorFields
        key={
          mode === "create"
            ? state.resetKey ?? "draft"
            : initialValues.id ?? "edit"
        }
        coverUploadMode={coverUploadMode}
        demoCovers={demoCovers}
        variant={variant}
        initialValues={initialValues}
        mode={mode}
        pending={pending}
        state={state}
      />
    </form>
  );
};
