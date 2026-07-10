"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, ApiClientError } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { LogstackLogo } from "@/components/brand/logstack-logo";

type InviteStatus = "loading" | "success" | "expired" | "error";

function AcceptInviteContent() {
  const [status, setStatus] = useState<InviteStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("No invite token was provided in the link.");
      return;
    }

    const acceptInvite = async () => {
      try {
        await api.get(`/auth/accept-invite?token=${encodeURIComponent(token)}`);
        setStatus("success");
        toast({
          title: "Invite accepted",
          description: "You have successfully joined the organization.",
        });
        router.push("/overview");
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 410) {
          setStatus("expired");
          setErrorMessage(
            "This invite link has expired. Invite links are valid for 48 hours.",
          );
        } else if (err instanceof ApiClientError && err.status === 404) {
          setStatus("error");
          setErrorMessage(
            "This invite link is invalid. It may have already been used or revoked.",
          );
        } else {
          setStatus("error");
          setErrorMessage(
            err instanceof Error
              ? err.message
              : "Something went wrong while accepting the invite.",
          );
        }
      }
    };

    acceptInvite();
    // token and router are stable; toast is memoized — only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "loading") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            {/* <svg
              className="animate-spin h-6 w-6 text-muted-foreground"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg> */}

            <LogstackLogo
              href="/"
              // onClick={() => setMobileMenuOpen(false)}
              className="text-xl text-white"
              labelClassName="hidden"
            />
          </div>
          <CardTitle>Accepting your invite…</CardTitle>
          <CardDescription>
            Please wait while we process your invitation.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status === "success") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <svg
              className="h-6 w-6 text-green-600 dark:text-green-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <CardTitle>You&apos;re in!</CardTitle>
          <CardDescription>
            Your invite was accepted. Redirecting you to the dashboard…
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status === "expired") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
            <svg
              className="h-6 w-6 text-yellow-600 dark:text-yellow-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <CardTitle>Invite link expired</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            Ask your organization admin to send you a new invite.
          </p>
          <div className="grid gap-2">
            <Button asChild className="w-full">
              <Link href="/login">Go to login</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Generic error state
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <svg
            className="h-6 w-6 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>
        <CardTitle>Invalid invite link</CardTitle>
        <CardDescription>
          {errorMessage ||
            "This invite link is invalid or has already been used."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground text-center">
          If you believe this is a mistake, please contact your organization
          admin and ask them to send a fresh invite.
        </p>
        <div className="grid gap-2">
          <Button asChild className="w-full">
            <Link href="/login">Go to login</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href="mailto:support@logstack.dev">Contact support</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <svg
                  className="animate-spin h-6 w-6 text-muted-foreground"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <CardTitle>Loading…</CardTitle>
            </CardHeader>
          </Card>
        }
      >
        <AcceptInviteContent />
      </Suspense>
    </div>
  );
}
