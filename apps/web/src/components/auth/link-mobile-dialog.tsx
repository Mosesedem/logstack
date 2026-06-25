"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { api, ApiClientError } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RefreshCw, Smartphone } from "lucide-react";

export interface LinkMobileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface QrGenerateResponse {
  token: string;
  pin: string;
  qrImageUrl: string;
}

type DialogState = "loading" | "active" | "confirmed" | "expired" | "error";

const POLL_INTERVAL_MS = 3_000;
const COUNTDOWN_SECONDS = 10 * 60; // 10 minutes

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function LinkMobileDialog({ open, onOpenChange }: LinkMobileDialogProps) {
  const { toast } = useToast();

  const [state, setState] = useState<DialogState>("loading");
  const [qrData, setQrData] = useState<QrGenerateResponse | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (token: string) => {
      pollTimerRef.current = setInterval(async () => {
        try {
          const result = await api.get<{ status: string }>(
            `/auth/qr/${token}/status`,
          );
          if (result.status === "confirmed") {
            clearTimers();
            setState("confirmed");
            toast({
              title: "Mobile app linked!",
              description: "Your mobile app has been successfully linked.",
            });
            setTimeout(() => {
              onOpenChange(false);
            }, 1500);
          }
        } catch (err) {
          if (err instanceof ApiClientError && err.status === 410) {
            clearTimers();
            setState("expired");
          }
          // For other errors (network blips etc.) we keep polling
        }
      }, POLL_INTERVAL_MS);
    },
    [clearTimers, onOpenChange, toast],
  );

  const startCountdown = useCallback(() => {
    setCountdown(COUNTDOWN_SECONDS);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearTimers();
          setState("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimers]);

  const generate = useCallback(async () => {
    clearTimers();
    setState("loading");
    setQrData(null);
    try {
      const data = await api.post<QrGenerateResponse>("/auth/qr/generate", {});
      setQrData(data);
      setState("active");
      startCountdown();
      startPolling(data.token);
    } catch {
      setState("error");
    }
  }, [clearTimers, startCountdown, startPolling]);

  // Generate on open
  useEffect(() => {
    if (open) {
      generate();
    } else {
      clearTimers();
      setState("loading");
      setQrData(null);
    }
    return () => clearTimers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Link Mobile App
          </DialogTitle>
          <DialogDescription>
            Scan the QR code or enter the PIN in the Logstack mobile app to link
            your account.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Loading */}
          {state === "loading" && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />
              <p className="text-sm text-muted-foreground">Generating code…</p>
            </div>
          )}

          {/* Active */}
          {state === "active" && qrData && (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              {/* QR image */}
              <div className="flex flex-shrink-0 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrData.qrImageUrl}
                  alt="QR code to link mobile app"
                  className="h-48 w-48 rounded-lg border border-border bg-white p-2"
                />
              </div>

              {/* PIN + countdown */}
              <div className="flex flex-1 flex-col items-center gap-4 sm:items-start">
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    PIN Code
                  </p>
                  <p className="font-mono text-4xl font-bold tracking-[0.25em] text-foreground">
                    {qrData.pin}
                  </p>
                </div>

                <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-sm text-muted-foreground">
                  <span>Expires in</span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatCountdown(countdown)}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">
                  Open the Logstack app, go to <strong>Settings → Link Web Account</strong>,
                  and scan the QR code or enter the PIN above.
                </p>
              </div>
            </div>
          )}

          {/* Confirmed */}
          {state === "confirmed" && (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
                <Smartphone className="h-7 w-7 text-green-500" />
              </div>
              <p className="text-lg font-semibold text-foreground">
                Mobile app linked!
              </p>
              <p className="text-sm text-muted-foreground">
                Your mobile device has been successfully connected.
              </p>
            </div>
          )}

          {/* Expired */}
          {state === "expired" && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <RefreshCw className="h-7 w-7 text-destructive" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">Code expired</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The QR code and PIN are no longer valid.
                </p>
              </div>
              <Button onClick={generate} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </Button>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <p className="text-sm text-muted-foreground">
                Something went wrong generating the code.
              </p>
              <Button onClick={generate} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
