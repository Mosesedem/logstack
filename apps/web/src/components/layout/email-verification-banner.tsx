"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, X, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ApiClientError } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

export function EmailVerificationBanner() {
  const { data: session } = useSession();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const { toast } = useToast();

  // Don't show if user is verified or banner is dismissed
  if (!session?.user || session.user.emailVerified || isDismissed) {
    return null;
  }

  const handleResend = async () => {
    if (!session.user.email) return;

    setIsResending(true);
    try {
      await api.post("/auth/resend-verification", {
        email: session.user.email,
      });
      toast({
        title: "Verification email sent",
        description: "Please check your inbox and spam folder.",
      });
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.code === "RATE_LIMIT_EXCEEDED") {
          toast({
            title: "Too many requests",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to resend verification email",
          variant: "destructive",
        });
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="relative bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-medium text-yellow-500">
            Email verification required
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            Please verify your email address to unlock all features. Some
            actions like creating API keys are restricted until your email is
            verified.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResend}
              disabled={isResending}
              className="border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
            >
              {isResending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Resend verification email
            </Button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={() => setIsDismissed(true)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    </div>
  );
}
