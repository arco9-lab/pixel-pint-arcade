"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { authClient } from "@/features/auth/data/auth-client";
import { startDemoSessionAction } from "@/features/demo/actions/demo-session";
import { saveDemoCredentials } from "@/features/demo/data/demo-credentials";
import styles from "./AuthPanel.module.css";

type AuthPanelProps = {
  mode: "sign-in" | "sign-up";
  googleEnabled: boolean;
  demoMode?: boolean;
};

const authSuccessPath = "/account";
const authErrorPath = "/auth/error";

export const AuthPanel = ({
  mode,
  googleEnabled,
  demoMode = false,
}: AuthPanelProps) => {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const isSignUp = mode === "sign-up";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "");

    const result = isSignUp
      ? await authClient.signUp.email({
          name,
          email,
          password,
          callbackURL: authSuccessPath,
        })
      : await authClient.signIn.email({
          email,
          password,
          callbackURL: authSuccessPath,
        });

    setPending(false);

    if (result.error) {
      setMessage(result.error.message ?? "Authentication failed.");
      return;
    }

    router.push(authSuccessPath);
    router.refresh();
  };

  const handleGoogle = async () => {
    setMessage("");
    setPending(true);

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: authSuccessPath,
        errorCallbackURL: authErrorPath,
      });

      if (result.error) {
        setMessage(result.error.message ?? "Google sign in failed.");
      }
    } catch {
      setMessage("Google sign in failed. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const handleDemo = async () => {
    setMessage("");
    setPending(true);

    try {
      const demoSession = await startDemoSessionAction();

      if (!demoSession.ok) {
        setMessage(demoSession.message);
        return;
      }

      const result = await authClient.signIn.email({
        email: demoSession.email,
        password: demoSession.password,
        callbackURL: authSuccessPath,
      });

      if (result.error) {
        setMessage(result.error.message ?? "Demo sign in failed.");
        return;
      }

      saveDemoCredentials({
        email: demoSession.email,
        password: demoSession.password,
      });
      router.push(authSuccessPath);
      router.refresh();
    } catch {
      setMessage("Could not start the demo. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className={styles.shell}>
      <section className={styles.panel}>
        <h1>{isSignUp ? "Create account" : "Sign in"}</h1>
        <form className={styles.form} onSubmit={handleSubmit}>
          {isSignUp ? (
            <div className={styles.field}>
              <label htmlFor="name">Name</label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                required
                minLength={2}
              />
            </div>
          ) : null}
          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
              minLength={8}
            />
          </div>
          <div className={styles.actions}>
            <button
              className={`btn ${styles.submit}`}
              type="submit"
              disabled={pending}
            >
              {isSignUp ? "Create" : "Enter"}
            </button>
            {demoMode && !isSignUp ? (
              <button
                className={`btn ${styles.googleButton}`}
                type="button"
                onClick={handleDemo}
                disabled={pending}
              >
                Enter as demo user
              </button>
            ) : null}
            {googleEnabled ? (
              <button
                className={`btn ${styles.googleButton}`}
                type="button"
                onClick={handleGoogle}
                disabled={pending}
              >
                Google
              </button>
            ) : null}
          </div>
          <div className={styles.message} role="status" aria-live="polite">
            {message}
          </div>
        </form>
        {demoMode ? null : (
          <Link
            className={styles.switchLink}
            href={isSignUp ? "/login" : "/register"}
          >
            {isSignUp ? "I have account" : "Create account"}
          </Link>
        )}
      </section>
    </main>
  );
};
