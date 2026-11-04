import { redirect } from "next/navigation";

import { AuthPanel } from "@/features/auth/components/AuthPanel";
import { isDemoMode } from "@/lib/demo-mode";
import { getCurrentSession } from "@/server/auth";

const googleEnabled =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET) &&
  !process.env.GOOGLE_CLIENT_ID?.startsWith("replace-") &&
  !process.env.GOOGLE_CLIENT_SECRET?.startsWith("replace-");

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session?.user) {
    redirect("/account");
  }

  return (
    <AuthPanel
      mode="sign-in"
      googleEnabled={googleEnabled}
      demoMode={isDemoMode()}
    />
  );
}
