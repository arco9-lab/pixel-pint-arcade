import { DEMO_CREDENTIALS_STORAGE_KEY } from "@/features/demo/constants";

export type DemoCredentials = {
  email: string;
  password: string;
};

const credentialListeners = new Set<() => void>();

export const saveDemoCredentials = (credentials: DemoCredentials) => {
  try {
    window.sessionStorage.setItem(
      DEMO_CREDENTIALS_STORAGE_KEY,
      JSON.stringify(credentials),
    );
  } catch {
    return;
  }

  credentialListeners.forEach((listener) => listener());
};

export const subscribeToDemoCredentials = (listener: () => void) => {
  credentialListeners.add(listener);

  return () => {
    credentialListeners.delete(listener);
  };
};

export const readDemoCredentialsSnapshot = () => {
  try {
    return window.sessionStorage.getItem(DEMO_CREDENTIALS_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const parseDemoCredentials = (
  snapshot: string | null,
): DemoCredentials | null => {
  if (!snapshot) {
    return null;
  }

  try {
    const parsed = JSON.parse(snapshot);

    if (
      typeof parsed?.email === "string" &&
      typeof parsed?.password === "string"
    ) {
      return { email: parsed.email, password: parsed.password };
    }
  } catch {
    return null;
  }

  return null;
};
