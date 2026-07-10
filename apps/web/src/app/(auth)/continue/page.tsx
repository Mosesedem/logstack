"use client";

import { useEffect } from "react";
import { getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { postLoginPath } from "@/lib/auth-utils";
import { Spinner } from "@/components/loading";

/**
 * Post-auth landing used by OAuth (and any flow that cannot know role client-side
 * before the session is established). Redirects admins → /admin, users → /overview.
 */
export default function AuthContinuePage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await getSession();
      if (cancelled) return;
      if (!session) {
        router.replace("/login");
        return;
      }
      router.replace(postLoginPath(session.user?.role));
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner size="lg" label="Signing you in" />
    </div>
  );
}
