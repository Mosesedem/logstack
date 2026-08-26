"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Smartphone, Trash2, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { formatRelativeTime } from "@/lib/utils";
import { LinkMobileDialog } from "@/components/auth/link-mobile-dialog";
import { SettingsPageSkeleton } from "@/components/loading";
import type { LinkedDevice, LinkedDevicesResponse } from "@/types";

function deviceLabel(type: LinkedDevice["deviceType"]): string {
  if (type === "ios") return "iPhone / iPad";
  if (type === "android") return "Android";
  return type;
}

export default function DevicesSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [linkOpen, setLinkOpen] = useState(false);
  const [pending, setPending] = useState<LinkedDevice | "all" | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["linked-devices"],
    queryFn: () => api.get<LinkedDevicesResponse>("/users/me/devices"),
  });

  const removeOne = useMutation({
    mutationFn: (id: number) => api.delete(`/users/me/devices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linked-devices"] });
      toast({ title: "Device removed", description: "It will no longer receive push alerts." });
    },
    onError: (e: Error) => {
      toast({ title: "Could not remove device", description: e.message, variant: "destructive" });
    },
    onSettled: () => setPending(null),
  });

  const removeAll = useMutation({
    mutationFn: () => api.delete("/users/me/devices"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["linked-devices"] });
      toast({ title: "All devices removed" });
    },
    onError: (e: Error) => {
      toast({ title: "Could not remove devices", description: e.message, variant: "destructive" });
    },
    onSettled: () => setPending(null),
  });

  const devices = data?.devices ?? [];
  const busy = removeOne.isPending || removeAll.isPending;

  if (isLoading) {
    return <SettingsPageSkeleton />;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Mobile devices</CardTitle>
            <CardDescription>
              Devices that still receive push alerts for your account. Remove
              old phones or tablets so they stop getting notifications.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setLinkOpen(true)}>
              Link a device
            </Button>
            {devices.length > 0 ? (
              <Button
                variant="outline"
                onClick={() => setPending("all")}
                disabled={busy}
              >
                Remove all
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="space-y-3 py-4 text-center">
              <p className="text-sm text-destructive">
                {error instanceof Error ? error.message : "Failed to load devices"}
              </p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          ) : devices.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center">
              <Smartphone className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No devices registered</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Link the Logstack app and enable notifications to receive
                alerts on your phone.
              </p>
            </div>
          ) : (
            <ul className="divide-y rounded-lg border">
              {devices.map((device) => (
                <li
                  key={device.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 rounded-md border bg-muted/50 p-2">
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {deviceLabel(device.deviceType)}
                        </span>
                        <Badge variant="outline">{device.deviceType}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Last seen {formatRelativeTime(device.lastSeenAt)}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {device.maskedToken}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={busy}
                    onClick={() => setPending(device)}
                  >
                    {removeOne.isPending && pending !== "all" && pending?.id === device.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Removing a device stops push alerts immediately. If the app is
            still signed in on that phone, it may register again the next time
            it opens — log out there to keep it off the list.
          </p>
        </CardContent>
      </Card>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending === "all" ? "Remove all devices?" : "Remove this device?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending === "all"
                ? "None of your linked phones will receive Logstack push alerts until you link them again."
                : "This device will stop receiving Logstack push alerts."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                if (pending === "all") {
                  removeAll.mutate();
                } else if (pending) {
                  removeOne.mutate(pending.id);
                }
              }}
            >
              {busy ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LinkMobileDialog open={linkOpen} onOpenChange={setLinkOpen} />
    </>
  );
}
