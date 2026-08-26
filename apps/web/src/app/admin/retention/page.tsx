"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type RetentionTier = {
  planId: number;
  tier: string;
  name: string;
  retentionDays: number;
};

type RetentionLastRun = {
  ranAt: string;
  enabled: boolean;
  deleted: number;
  triggered: string;
  error?: string;
  tiers?: Array<{
    tier: string;
    retentionDays: number;
    deleted: number;
    skippedForever?: boolean;
  }>;
};

type RetentionStatus = {
  enabled: boolean;
  interval: string;
  tiers: RetentionTier[];
  expiredCount: number;
  lastRun: RetentionLastRun | null;
};

function formatDays(days: number): string {
  if (days <= 0) return "Forever";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export default function AdminRetentionPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<RetentionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [days, setDays] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<RetentionStatus>("/admin/retention");
      setStatus(data);
      setEnabled(data.enabled);
      const next: Record<string, string> = {};
      for (const t of data.tiers) {
        next[t.tier] = String(t.retentionDays);
      }
      setDays(next);
    } catch (e) {
      toast({
        title: "Failed to load retention settings",
        description: e instanceof ApiClientError ? e.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!status) return;
    setSaving(true);
    try {
      const data = await apiClient.put<RetentionStatus>("/admin/retention", {
        enabled,
        tiers: status.tiers.map((t) => ({
          tier: t.tier,
          retentionDays: Number(days[t.tier] ?? t.retentionDays) || 0,
        })),
      });
      setStatus(data);
      setEnabled(data.enabled);
      toast({ title: "Retention settings saved" });
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof ApiClientError ? e.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      await apiClient.post("/admin/retention/run", {});
      toast({ title: "Cleanup finished" });
      await load();
    } catch (e) {
      toast({
        title: "Cleanup failed",
        description: e instanceof ApiClientError ? e.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  if (loading && !status) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading log retention">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Log retention</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Logs older than the window you set are deleted automatically every{" "}
          {status?.interval ?? "24h"}. Set a tier to 0 to keep those logs
          forever.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Automatic cleanup
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm">
              {enabled ? "Enabled" : "Paused"}
            </span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Currently expired
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {(status?.expiredCount ?? 0).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            logs older than the configured windows
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Last run
          </p>
          {status?.lastRun ? (
            <>
              <p className="mt-2 text-sm">
                Deleted {status.lastRun.deleted.toLocaleString()} ·{" "}
                {status.lastRun.triggered}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(status.lastRun.ranAt).toLocaleString()}
              </p>
              {status.lastRun.error ? (
                <p className="mt-1 text-xs text-destructive">
                  {status.lastRun.error}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Never run</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Expiry by plan</h2>
          <p className="text-xs text-muted-foreground">
            Number of days to keep logs. 0 = never expire.
          </p>
        </div>
        <div className="divide-y">
          {(status?.tiers ?? []).map((tier) => (
            <div
              key={tier.tier}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{tier.name}</span>
                  <Badge variant="outline">{tier.tier}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently {formatDays(Number(days[tier.tier] ?? 0) || 0)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`days-${tier.tier}`} className="text-xs">
                  Days
                </Label>
                <Input
                  id={`days-${tier.tier}`}
                  type="number"
                  min={0}
                  max={3650}
                  className="w-28"
                  value={days[tier.tier] ?? "0"}
                  onChange={(e) =>
                    setDays((prev) => ({
                      ...prev,
                      [tier.tier]: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={() => void runNow()}
          disabled={running || saving}
        >
          {running ? "Running…" : "Run cleanup now"}
        </Button>
        <Button onClick={() => void save()} disabled={saving || running}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
