"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, QrCode, RefreshCw, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api-client";

interface QRGenerateResponse {
  token: string;
  qrImageUrl: string;
}

interface QRStatusResponse {
  status: "pending" | "scanned" | "confirmed" | "expired";
}

type PanelState = "loading" | "active" | "expired" | "confirmed";

export function QRPanel() {
  const router = useRouter();
  const [panelState, setPanelState] = useState<PanelState>("loading");
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(
    async (token: string) => {
      try {
        const API_URL =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/v1";
        const response = await fetch(
          `${API_URL}/auth/qr/${encodeURIComponent(token)}/status`,
        );

        if (response.status === 410) {
          // QR expired
          stopPolling();
          setPanelState("expired");
          return;
        }

        if (!response.ok) {
          // Non-410 error — stop polling silently
          stopPolling();
          return;
        }

        const data: QRStatusResponse = await response.json();

        if (data.status === "confirmed") {
          stopPolling();
          setPanelState("confirmed");
          // Short delay so user sees the success state before redirect
          setTimeout(() => {
            router.push("/overview");
          }, 1200);
        }
        // "pending" or "scanned" — keep polling
      } catch {
        // Network error — keep polling, don't abort
      }
    },
    [stopPolling, router],
  );

  const generateQR = useCallback(async () => {
    setPanelState("loading");
    setQrToken(null);
    setQrImageUrl(null);
    stopPolling();

    try {
      const data = await api.post<QRGenerateResponse>("/auth/qr/generate", {});
      setQrToken(data.token);
      setQrImageUrl(data.qrImageUrl);
      setPanelState("active");

      // Start polling every 3 seconds
      intervalRef.current = setInterval(() => {
        pollStatus(data.token);
      }, 3000);
    } catch {
      // If generate fails (e.g. not authenticated), show expired state as fallback
      setPanelState("expired");
    }
  }, [stopPolling, pollStatus]);

  // Generate on mount and clean up on unmount
  useEffect(() => {
    generateQR();
    return () => {
      stopPolling();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (panelState === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Generating QR code…</p>
      </div>
    );
  }

  if (panelState === "confirmed") {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <p className="text-sm font-medium text-green-600 dark:text-green-400">
          Login confirmed! Redirecting…
        </p>
      </div>
    );
  }

  if (panelState === "expired") {
    return (
      <div className="flex flex-col items-center gap-4 py-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted">
          <QrCode className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium text-destructive">
            QR code expired
          </p>
          <p className="text-xs text-muted-foreground">
            QR codes are valid for 5 minutes.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={generateQR}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Generate New QR
        </Button>
      </div>
    );
  }

  // panelState === "active"
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {qrImageUrl ? (
        <div className="rounded-lg border bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrImageUrl}
            alt="QR code for mobile login"
            width={180}
            height={180}
            className="block"
          />
        </div>
      ) : null}
      <div className="space-y-1 text-center">
        <p className="text-xs font-medium text-foreground">
          Scan with the Logstack mobile app
        </p>
        <p className="text-xs text-muted-foreground">
          Open the app → tap "Scan QR Code" to log in instantly
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Waiting for scan…
      </div>
    </div>
  );
}
