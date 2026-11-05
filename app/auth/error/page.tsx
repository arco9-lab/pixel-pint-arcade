import type { Metadata } from "next";
import Link from "next/link";

import { isDemoMode } from "@/lib/demo-mode";
import styles from "./AuthErrorPage.module.css";

type AuthErrorPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    error_description?: string | string[];
  }>;
};

const getSearchValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const errorMessages: Record<string, string> = {
  account_not_linked:
    "This email is already registered. Sign in with email and password, then link Google from your account later.",
  unable_to_link_account:
    "Google could not be linked to this account. Sign in with your existing method and try again later.",
  email_not_found:
    "Google did not return an email address for this profile.",
  invalid_code:
    "Google returned an invalid or expired authorization code.",
  state_mismatch:
    "The Google sign-in session expired. Start the sign-in flow again.",
};

export const metadata: Metadata = {
  title: "Authentication error | Pixel Pint Arcade",
  description: "Authentication could not be completed.",
};

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const params = await searchParams;
  const error = getSearchValue(params.error);
  const description = getSearchValue(params.error_description);
  const message =
    (error ? errorMessages[error] : undefined) ||
    description ||
    "Authentication could not be completed. Start the sign-in flow again.";

  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className="eyebrow">Auth error</div>
        <h1>Sign in failed</h1>
        <p>{message}</p>
        {error ? <code>{error}</code> : null}
        <div className={styles.actions}>
          <Link className="btn" href="/login">
            Back to login
          </Link>
          {isDemoMode() ? null : (
            <Link className="btn secondary" href="/register">
              Create account
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
