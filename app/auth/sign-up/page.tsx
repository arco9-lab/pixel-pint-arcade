import { redirect } from "next/navigation";

import { isDemoMode } from "@/lib/demo-mode";

export default function SignUpPage() {
  redirect(isDemoMode() ? "/login" : "/register");
}
