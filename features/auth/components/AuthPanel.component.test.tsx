import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetMockRouter, router } from "@/tests/component/router";

const authClientMock = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signInSocial: vi.fn(),
  signUpEmail: vi.fn(),
}));

const demoActionMock = vi.hoisted(() => ({
  startDemoSession: vi.fn(),
}));

vi.mock("@/features/demo/actions/demo-session", () => ({
  startDemoSessionAction: demoActionMock.startDemoSession,
}));

vi.mock("@/features/auth/data/auth-client", () => ({
  authClient: {
    signIn: {
      email: authClientMock.signInEmail,
      social: authClientMock.signInSocial,
    },
    signUp: {
      email: authClientMock.signUpEmail,
    },
  },
}));

import { AuthPanel } from "@/features/auth/components/AuthPanel";

describe("AuthPanel", () => {
  beforeEach(() => {
    resetMockRouter();
    authClientMock.signInEmail.mockReset();
    authClientMock.signInSocial.mockReset();
    authClientMock.signUpEmail.mockReset();
    demoActionMock.startDemoSession.mockReset();
    window.sessionStorage.clear();
  });

  it("submits sign-in credentials and redirects on success", async () => {
    const user = userEvent.setup();
    authClientMock.signInEmail.mockResolvedValue({ error: null });

    render(<AuthPanel googleEnabled={false} mode="sign-in" />);

    await user.type(screen.getByLabelText("Email"), "user@example.test");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Enter" }));

    await waitFor(() => {
      expect(authClientMock.signInEmail).toHaveBeenCalledWith({
        email: "user@example.test",
        password: "password123",
        callbackURL: "/account",
      });
    });
    expect(router.push).toHaveBeenCalledWith("/account");
    expect(router.refresh).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("renders sign-up fields and submits account data", async () => {
    const user = userEvent.setup();
    authClientMock.signUpEmail.mockResolvedValue({ error: null });

    render(<AuthPanel googleEnabled={false} mode="sign-up" />);

    await user.type(screen.getByLabelText("Name"), "Daryna");
    await user.type(screen.getByLabelText("Email"), "daryna@example.test");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(authClientMock.signUpEmail).toHaveBeenCalledWith({
        name: "Daryna",
        email: "daryna@example.test",
        password: "password123",
        callbackURL: "/account",
      });
    });
    expect(screen.getByRole("link", { name: "I have account" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("shows auth errors from the client", async () => {
    const user = userEvent.setup();
    authClientMock.signInEmail.mockResolvedValue({
      error: { message: "Invalid credentials" },
    });

    render(<AuthPanel googleEnabled={false} mode="sign-in" />);

    await user.type(screen.getByLabelText("Email"), "user@example.test");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Enter" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Invalid credentials",
      );
    });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("hides the registration link and shows the demo button in demo mode", () => {
    render(<AuthPanel demoMode googleEnabled={false} mode="sign-in" />);

    expect(
      screen.queryByRole("link", { name: "Create account" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enter as demo user" }),
    ).toBeEnabled();
  });

  it("does not show the demo button outside demo mode", () => {
    render(<AuthPanel googleEnabled={false} mode="sign-in" />);

    expect(
      screen.queryByRole("button", { name: "Enter as demo user" }),
    ).not.toBeInTheDocument();
  });

  it("signs in with the generated demo account and stores its credentials", async () => {
    const user = userEvent.setup();
    demoActionMock.startDemoSession.mockResolvedValue({
      ok: true,
      email: "demo-1@demo.invalid",
      password: "generated-password",
    });
    authClientMock.signInEmail.mockResolvedValue({ error: null });

    render(<AuthPanel demoMode googleEnabled={false} mode="sign-in" />);

    await user.click(
      screen.getByRole("button", { name: "Enter as demo user" }),
    );

    await waitFor(() => {
      expect(authClientMock.signInEmail).toHaveBeenCalledWith({
        email: "demo-1@demo.invalid",
        password: "generated-password",
        callbackURL: "/account",
      });
    });
    expect(router.push).toHaveBeenCalledWith("/account");
    expect(
      JSON.parse(
        window.sessionStorage.getItem(
          "pixel-pint-arcade:demo-credentials",
        ) ?? "{}",
      ),
    ).toEqual({
      email: "demo-1@demo.invalid",
      password: "generated-password",
    });
  });

  it("shows the demo action error without signing in", async () => {
    const user = userEvent.setup();
    demoActionMock.startDemoSession.mockResolvedValue({
      ok: false,
      message: "Too many demo accounts were created. Try again in an hour.",
    });

    render(<AuthPanel demoMode googleEnabled={false} mode="sign-in" />);

    await user.click(
      screen.getByRole("button", { name: "Enter as demo user" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Too many demo accounts were created.",
      );
    });
    expect(authClientMock.signInEmail).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});
