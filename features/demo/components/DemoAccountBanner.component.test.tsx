import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { DemoAccountBanner } from "@/features/demo/components/DemoAccountBanner";

describe("DemoAccountBanner", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("shows the stored demo credentials and the expiry notice", () => {
    window.sessionStorage.setItem(
      "pixel-pint-arcade:demo-credentials",
      JSON.stringify({ email: "demo-1@demo.invalid", password: "secret-pass" }),
    );

    render(<DemoAccountBanner />);

    expect(screen.getByText("demo-1@demo.invalid")).toBeInTheDocument();
    expect(screen.getByText("secret-pass")).toBeInTheDocument();
    expect(screen.getByText(/deleted within 48 hours/)).toBeInTheDocument();
  });

  it("shows only the expiry notice when credentials are not stored", () => {
    render(<DemoAccountBanner />);

    expect(screen.queryByText(/Email:/)).not.toBeInTheDocument();
    expect(screen.getByText(/deleted within 48 hours/)).toBeInTheDocument();
  });
});
