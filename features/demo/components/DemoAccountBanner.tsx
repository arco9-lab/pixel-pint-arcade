"use client";

import { useSyncExternalStore } from "react";

import {
  parseDemoCredentials,
  readDemoCredentialsSnapshot,
  subscribeToDemoCredentials,
} from "@/features/demo/data/demo-credentials";
import styles from "./DemoAccountBanner.module.css";

const readServerSnapshot = () => null;

export const DemoAccountBanner = () => {
  const snapshot = useSyncExternalStore(
    subscribeToDemoCredentials,
    readDemoCredentialsSnapshot,
    readServerSnapshot,
  );
  const credentials = parseDemoCredentials(snapshot);

  return (
    <aside className={styles.banner} aria-label="Demo account">
      <strong>Demo account</strong>
      {credentials ? (
        <p>
          Email: <code>{credentials.email}</code> Password:{" "}
          <code>{credentials.password}</code>
        </p>
      ) : null}
      <p>This account and everything in it will be deleted within 48 hours.</p>
    </aside>
  );
};
