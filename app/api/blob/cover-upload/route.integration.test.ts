import { beforeEach, describe, expect, it, vi } from "vitest";

const handleUploadMock = vi.hoisted(() => ({
  handleUpload: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  error: null as Error | null,
}));

vi.mock("@vercel/blob/client", () => ({
  handleUpload: handleUploadMock.handleUpload,
}));

vi.mock("@/server/permissions", () => ({
  requireAdmin: vi.fn(async () => {
    if (authMock.error) {
      throw authMock.error;
    }

    return { id: "admin-1", role: "ADMIN" };
  }),
}));

import { POST } from "./route";

type TokenOptions = {
  allowedContentTypes: string[];
  maximumSizeInBytes: number;
  addRandomSuffix: boolean;
};

type BeforeGenerateToken = (
  pathname: string,
  clientPayload: string | null,
  multipart: boolean,
) => Promise<TokenOptions>;

const uploadRequest = () =>
  new Request("http://localhost/api/blob/cover-upload", {
    method: "POST",
    body: JSON.stringify({ type: "blob.generate-client-token", payload: {} }),
  });

const captureBeforeGenerateToken = async () => {
  handleUploadMock.handleUpload.mockImplementation(async (options) => {
    await options.onBeforeGenerateToken("posts/cover.png", null, false);

    return { type: "blob.generate-client-token", clientToken: "token" };
  });
  await POST(uploadRequest());

  return handleUploadMock.handleUpload.mock.calls[0][0]
    .onBeforeGenerateToken as BeforeGenerateToken;
};

describe("cover upload route", () => {
  beforeEach(() => {
    handleUploadMock.handleUpload.mockReset();
    authMock.error = null;
  });

  it("issues a token restricted to image types and 5MB for admins", async () => {
    const onBeforeGenerateToken = await captureBeforeGenerateToken();

    await expect(
      onBeforeGenerateToken("posts/cover.png", null, false),
    ).resolves.toEqual({
      allowedContentTypes: [
        "image/gif",
        "image/jpeg",
        "image/png",
        "image/webp",
      ],
      maximumSizeInBytes: 5 * 1024 * 1024,
      addRandomSuffix: true,
    });
  });

  it("rejects paths outside the posts folder", async () => {
    const onBeforeGenerateToken = await captureBeforeGenerateToken();

    await expect(
      onBeforeGenerateToken("other/cover.png", null, false),
    ).rejects.toThrow("InvalidPath");
  });

  it("returns 401 for guests", async () => {
    authMock.error = new Error("Unauthorized");
    handleUploadMock.handleUpload.mockImplementation(async (options) =>
      options.onBeforeGenerateToken("posts/cover.png", null, false),
    );

    const response = await POST(uploadRequest());

    expect(response.status).toBe(401);
  });

  it("returns 403 for non-admin users", async () => {
    authMock.error = new Error("Forbidden");
    handleUploadMock.handleUpload.mockImplementation(async (options) =>
      options.onBeforeGenerateToken("posts/cover.png", null, false),
    );

    const response = await POST(uploadRequest());

    expect(response.status).toBe(403);
  });
});
