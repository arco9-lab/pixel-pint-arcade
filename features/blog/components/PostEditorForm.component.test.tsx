import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  queueActionState,
  resetActionStateMock,
} from "@/tests/component/action-state";
const blobClientMock = vi.hoisted(() => ({
  upload: vi.fn(),
}));

vi.mock("@vercel/blob/client", () => ({
  upload: blobClientMock.upload,
}));

import { PostEditorForm } from "@/features/blog/components/PostEditorForm";

describe("PostEditorForm", () => {
  beforeEach(() => {
    resetActionStateMock();
    blobClientMock.upload.mockReset();
  });

  it("generates a slug from the title until the slug is edited", async () => {
    const user = userEvent.setup();

    render(<PostEditorForm />);

    await user.type(screen.getByLabelText("Title"), "My Arcade Story");

    expect(screen.getByLabelText("Slug")).toHaveValue("my-arcade-story");

    await user.clear(screen.getByLabelText("Slug"));
    await user.type(screen.getByLabelText("Slug"), "custom-slug");
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Different Title");

    expect(screen.getByLabelText("Slug")).toHaveValue("custom-slug");
  });

  it("renders tag and article previews", async () => {
    const user = userEvent.setup();

    render(<PostEditorForm />);

    await user.type(screen.getByLabelText("Title"), "Preview Post");
    await user.type(screen.getByLabelText("Tags"), "Arcade, Hardware");
    await user.type(
      screen.getByLabelText("Content"),
      "Intro paragraph\n\n## Main Heading",
    );

    expect(
      within(screen.getByLabelText("Tag preview")).getByText("Arcade"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.getByRole("heading", { name: "Preview Post" })).toBeInTheDocument();
    expect(screen.getByText("Intro paragraph")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Main Heading" })).toBeInTheDocument();
  });

  it("shows field errors and action messages from action state", () => {
    queueActionState({
      ok: false,
      errors: {
        title: ["Title is required."],
        coverImageFile: ["Cover image must be 5MB or smaller."],
      },
      message: "Could not create the post.",
    });

    render(<PostEditorForm />);

    expect(screen.getByText("Title is required.")).toBeInTheDocument();
    expect(screen.getByText("Could not create the post.")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Has errors")).toHaveLength(2);
  });

  describe("cover upload", () => {
    const coverFile = (name = "cover.png", type = "image/png") =>
      new File(["pixels"], name, { type });

    const coverFileInput = () =>
      document.getElementById("coverImageFile") as HTMLInputElement;

    const hiddenCoverUrl = (container: HTMLElement) =>
      container.querySelector<HTMLInputElement>('input[name="coverImageUrl"]');

    it("posts the file with the form in form mode", async () => {
      const user = userEvent.setup();
      const { container } = render(<PostEditorForm />);

      await user.click(screen.getByRole("tab", { name: "Cover" }));

      expect(coverFileInput()).toHaveAttribute("name", "coverImageFile");
      expect(hiddenCoverUrl(container)).toBeNull();
    });

    it("uploads straight to Blob and stores the url in blob mode", async () => {
      const user = userEvent.setup();
      let finishUpload: (value: { url: string }) => void = () => undefined;
      blobClientMock.upload.mockReturnValue(
        new Promise((resolve) => {
          finishUpload = resolve;
        }),
      );
      const { container } = render(<PostEditorForm coverUploadMode="blob" />);

      await user.click(screen.getByRole("tab", { name: "Cover" }));

      expect(coverFileInput()).not.toHaveAttribute("name");

      await user.upload(coverFileInput(), coverFile());

      expect(blobClientMock.upload).toHaveBeenCalledWith(
        "posts/cover.png",
        expect.any(File),
        expect.objectContaining({
          access: "public",
          handleUploadUrl: "/api/blob/cover-upload",
        }),
      );
      expect(screen.getByText(/Uploading/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save post" })).toBeDisabled();

      finishUpload({
        url: "https://store.public.blob.vercel-storage.com/posts/cover-x.png",
      });

      await waitFor(() => {
        expect(screen.getByText("Cover uploaded.")).toBeInTheDocument();
      });
      expect(hiddenCoverUrl(container)).toHaveValue(
        "https://store.public.blob.vercel-storage.com/posts/cover-x.png",
      );
      expect(screen.getByRole("button", { name: "Save post" })).toBeEnabled();
    });

    it("shows an error and keeps the url empty when the upload fails", async () => {
      const user = userEvent.setup();
      blobClientMock.upload.mockRejectedValue(new Error("network"));
      const { container } = render(<PostEditorForm coverUploadMode="blob" />);

      await user.click(screen.getByRole("tab", { name: "Cover" }));
      await user.upload(coverFileInput(), coverFile());

      await waitFor(() => {
        expect(
          screen.getByText("Cover upload failed. Try again."),
        ).toBeInTheDocument();
      });
      expect(hiddenCoverUrl(container)).toHaveValue("");
      expect(screen.getByRole("button", { name: "Save post" })).toBeEnabled();
    });

    it("rejects unsupported files without uploading", async () => {
      const user = userEvent.setup({ applyAccept: false });
      render(<PostEditorForm coverUploadMode="blob" />);

      await user.click(screen.getByRole("tab", { name: "Cover" }));
      await user.upload(
        coverFileInput(),
        coverFile("notes.pdf", "application/pdf"),
      );

      expect(
        screen.getByText("Upload a PNG, JPG, WebP, or GIF image."),
      ).toBeInTheDocument();
      expect(blobClientMock.upload).not.toHaveBeenCalled();
    });

    it("rejects files over 5MB without uploading", async () => {
      const user = userEvent.setup();
      render(<PostEditorForm coverUploadMode="blob" />);
      const largeFile = coverFile();
      Object.defineProperty(largeFile, "size", { value: 5 * 1024 * 1024 + 1 });

      await user.click(screen.getByRole("tab", { name: "Cover" }));
      await user.upload(coverFileInput(), largeFile);

      expect(
        screen.getByText("Cover image must be 5MB or smaller."),
      ).toBeInTheDocument();
      expect(blobClientMock.upload).not.toHaveBeenCalled();
    });
  });

  describe("demo variant", () => {
    const demoCovers = [
      { url: "/demo/covers/arcade-night.png", alt: "Arcade at night" },
      { url: "/demo/covers/pixel-pint.png", alt: "A pixel pint" },
    ];

    const namedInput = (container: HTMLElement, name: string) =>
      container.querySelector<HTMLInputElement>(`input[name="${name}"]`);

    it("hides the slug, comments toggle and file upload", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <PostEditorForm demoCovers={demoCovers} variant="demo" />,
      );

      expect(screen.queryByLabelText("Slug")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Allow comments")).not.toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: "Cover" }));

      expect(document.getElementById("coverImageFile")).toBeNull();
      expect(namedInput(container, "coverImageFile")).toBeNull();
    });

    it("sends a slug derived from the title in a hidden field", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <PostEditorForm demoCovers={demoCovers} variant="demo" />,
      );

      expect(namedInput(container, "slug")).toHaveValue("post");

      await user.type(screen.getByLabelText("Title"), "My Demo Story");

      expect(namedInput(container, "slug")).toHaveValue("my-demo-story");
    });

    it("selects a gallery cover and sends its url and alt", async () => {
      const user = userEvent.setup();
      const { container } = render(
        <PostEditorForm demoCovers={demoCovers} variant="demo" />,
      );

      await user.click(screen.getByRole("tab", { name: "Cover" }));

      expect(screen.getAllByRole("radio")).toHaveLength(3);
      expect(screen.getByRole("radio", { name: "No cover" })).toBeChecked();
      expect(namedInput(container, "removeCoverImage")).toHaveValue("on");

      await user.click(screen.getByRole("radio", { name: "A pixel pint" }));

      expect(screen.getByRole("radio", { name: "A pixel pint" })).toBeChecked();
      expect(namedInput(container, "removeCoverImage")).toBeNull();
      expect(namedInput(container, "coverImageAlt")).toHaveValue("A pixel pint");
    });

    it("preselects the current cover when editing", async () => {
      const user = userEvent.setup();

      render(
        <PostEditorForm
          demoCovers={demoCovers}
          initialValues={{
            id: "post-1",
            title: "Existing",
            slug: "existing-abc123",
            excerpt: "",
            coverImageUrl: "/demo/covers/arcade-night.png",
            coverImageAlt: "Arcade at night",
            seoTitle: "",
            seoDescription: "",
            tags: "",
            content: "Body",
            published: true,
            commentsEnabled: false,
          }}
          mode="edit"
          variant="demo"
        />,
      );

      await user.click(screen.getByRole("tab", { name: "Cover" }));

      expect(
        screen.getByRole("radio", { name: "Arcade at night" }),
      ).toBeChecked();
    });
  });
});
