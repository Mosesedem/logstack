"use client";

import { useEffect, useState, Suspense } from "react";
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
import { LogstackLogo } from "@/components/brand/logstack-logo";

type VerifyStatus = "loading" | "success" | "error";

function VerifyEmailContent() {
  const [status, setStatus] = useState<VerifyStatus>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing a token.");
      return;
    }

    let cancelled = false;
    const verify = async () => {
      try {
        await api.get(
          `/auth/verify-email?token=${encodeURIComponent(token)}`,
        );
        if (cancelled) return;
        setStatus("success");
        setMessage("Your email is verified. You can sign in.");
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        if (err instanceof ApiClientError) {
          setMessage(err.message);
          return;
        }
        setMessage(
          err instanceof Error
            ? err.message
            : "Something went wrong while verifying your email.",
        );
      }
    };

    void verify();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="my-auto w-full max-w-md border-border bg-card shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <LogstackLogo href="/" showLabel={false} size={48} priority />
        </div>
        <CardTitle>
          {status === "loading" && "Verifying your email"}
          {status === "success" && "Email verified"}
          {status === "error" && "Could not verify email"}
        </CardTitle>
        <CardDescription>
          {status === "loading"
            ? "This only takes a moment."
            : message}
        </CardDescription>
      </CardHeader>
      {status !== "loading" && (
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">Go to login</Link>
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-dvh items-start justify-center px-4 py-8 sm:items-center sm:py-12">
      <Suspense fallback={<div>Loading...</div>}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
