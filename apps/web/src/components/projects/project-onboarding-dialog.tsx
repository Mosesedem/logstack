"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { AlertRule, Project } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Bell, KeyRound, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Step = "api-key" | "alert";

interface ProjectOnboardingDialogProps {
  project: Project | null;
  apiKey: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function ProjectOnboardingDialog({
  project,
  apiKey,
  open,
  onOpenChange,
  onComplete,
}: ProjectOnboardingDialogProps) {
  const [step, setStep] = useState<Step>("api-key");
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const userEmail = session?.user?.email ?? "";

  const createAlertMutation = useMutation({
    mutationFn: (data: Partial<AlertRule>) =>
      api.post(`/alerts?projectId=${project?.id}`, data),
    onSuccess: () => {
      toast({
        title: "Alert configured",
        description: "You'll be notified when errors match your rules.",
      });
      handleFinish("/logs");
    },
    onError: (error: Error) => {
      toast({
        title: "Could not create alert",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFinish = (path: string) => {
    setStep("api-key");
    onComplete();
    onOpenChange(false);
    router.push(path);
  };

  const copyApiKey = () => {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    toast({ title: "API key copied" });
  };

  const handleCreateDefaultAlert = () => {
    if (!project || !userEmail) {
      toast({
        title: "Email required",
        description: "Sign in with an email address to receive alert notifications.",
        variant: "destructive",
      });
      return;
    }

    createAlertMutation.mutate({
      name: `${project.name} — Error alerts`,
      triggerLevel: "error",
      triggerPatterns: [".*error.*", ".*exception.*"],
      channels: ["email"],
      recipient: userEmail,
      cooldownMinutes: 15,
      enabled: true,
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStep("api-key");
      onComplete();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        {step === "api-key" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Project created
              </DialogTitle>
              <DialogDescription>
                Copy your API key now — it won&apos;t be shown again. Next,
                set up alerts so you&apos;re notified when something breaks.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="onboarding-api-key">API key</Label>
                <div className="flex gap-2">
                  <Input
                    id="onboarding-api-key"
                    readOnly
                    value={apiKey ?? ""}
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyApiKey}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Install the SDK with this key, then logs will appear in your
                dashboard. We&apos;ll help you wire alerts on the next step.
              </p>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleFinish("/demo")}
              >
                Skip to SDK demo
              </Button>
              <Button type="button" onClick={() => setStep("alert")}>
                Set up alerts
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Set up your first alert
              </DialogTitle>
              <DialogDescription>
                Get emailed when <strong>error</strong>-level logs match common
                failure patterns. You can add more rules or channels later on
                the Alerts page.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Notify</span>
                <span className="font-medium">{userEmail || "—"}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Level</span>
                <span className="font-medium">Error and above</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Patterns</span>
                <span className="font-mono text-xs">.*error.*, .*exception.*</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Channel</span>
                <span className="font-medium">Email</span>
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleFinish("/alerts")}
              >
                Skip for now
              </Button>
              <Button
                type="button"
                onClick={handleCreateDefaultAlert}
                disabled={createAlertMutation.isPending || !userEmail}
              >
                {createAlertMutation.isPending
                  ? "Creating alert…"
                  : "Enable error alerts"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}