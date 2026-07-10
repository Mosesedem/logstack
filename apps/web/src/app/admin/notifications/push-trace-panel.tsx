"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Activity, Radio } from "lucide-react";

export interface PushTraceEvent {
  at: string;
  phase: string;
  source: string;
  userId: number;
  deviceType?: string;
  maskedToken?: string;
  title?: string;
  payloadKind?: string;
  messageId?: string;
  error?: string;
  iosTokens?: number;
  iosSent?: number;
  iosFailed?: number;
  androidTokens?: number;
  androidSent?: number;
  androidFailed?: number;
  detail?: string;
}

interface DbPushToken {
  id: number;
  deviceType: string;
  maskedToken: string;
  updatedAt: string;
  createdAt: string;
}

interface PushTracePanelProps {
  userId?: string;
}

function phaseTone(phase: string): string {
  if (phase.includes("fail")) {
    return "border-destructive/30 bg-destructive/5 text-destructive";
  }
  if (phase.includes("ok") || phase === "send_ok") {
    return "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400";
  }
  if (phase === "send_attempt" || phase === "send_start") {
    return "border-blue-500/30 bg-blue-500/5 text-blue-700 dark:text-blue-400";
  }
  return "border-border bg-muted/30 text-muted-foreground";
}

export function PushTracePanel({ userId }: PushTracePanelProps) {
  const [events, setEvents] = useState<PushTraceEvent[]>([]);
  const [dbTokens, setDbTokens] = useState<DbPushToken[]>([]);
  const [lastPoll, setLastPoll] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const trace = await apiClient.get<{ events: PushTraceEvent[] }>(
          "/admin/push-trace?limit=40",
        );
        if (!cancelled) {
          setEvents([...(trace.events ?? [])].reverse());
          setLastPoll(new Date());
        }

        const id = userId?.trim();
        if (id && Number(id) > 0) {
          const tokens = await apiClient.get<{
            tokens: DbPushToken[];
          }>(`/admin/push-tokens?userId=${encodeURIComponent(id)}`);
          if (!cancelled) {
            setDbTokens(tokens.tokens ?? []);
          }
        } else if (!cancelled) {
          setDbTokens([]);
        }
      } catch {
        // polling should not interrupt the compose form
      }
    };

    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [userId]);

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <CardHeader className="border-b bg-muted/20 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-primary" />
              Live push trace
            </CardTitle>
            <CardDescription>
              Polls the API every 3s. Trigger a push from mobile or Send above,
              then watch register → FCM attempt → result here.
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1 font-normal">
            <Radio className="h-3 w-3 animate-pulse text-emerald-500" />
            {lastPoll ? lastPoll.toLocaleTimeString() : "…"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        {userId?.trim() ? (
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              DB tokens for user {userId}
            </p>
            {dbTokens.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No push tokens in database for this user.
              </p>
            ) : (
              <ul className="space-y-1 text-sm font-mono">
                {dbTokens.map((t) => (
                  <li key={t.id}>
                    <span className="text-muted-foreground">{t.deviceType}</span>{" "}
                    {t.maskedToken}{" "}
                    <span className="text-xs text-muted-foreground">
                      updated {t.updatedAt}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No push events yet. Deploy the API with push trace logging, then send
            a test push.
          </p>
        ) : (
          <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {events.map((ev, i) => (
              <li
                key={`${ev.at}-${ev.phase}-${i}`}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] uppercase", phaseTone(ev.phase))}
                  >
                    {ev.phase}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(ev.at).toLocaleString()}
                  </span>
                  <span className="text-xs">
                    user {ev.userId} · {ev.source}
                  </span>
                  {ev.deviceType ? (
                    <span className="text-xs font-medium">{ev.deviceType}</span>
                  ) : null}
                </div>
                <div className="mt-1 space-y-0.5 font-mono text-xs text-muted-foreground">
                  {ev.maskedToken ? <div>token {ev.maskedToken}</div> : null}
                  {ev.payloadKind ? <div>payload {ev.payloadKind}</div> : null}
                  {ev.messageId ? <div>fcm {ev.messageId}</div> : null}
                  {ev.title ? <div>title {ev.title}</div> : null}
                  {ev.detail ? <div>{ev.detail}</div> : null}
                  {ev.error ? (
                    <div className="text-destructive">{ev.error}</div>
                  ) : null}
                  {ev.iosTokens != null ? (
                    <div>
                      ios {ev.iosSent}/{ev.iosTokens} sent
                      {ev.iosFailed ? ` · ${ev.iosFailed} failed` : ""}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}