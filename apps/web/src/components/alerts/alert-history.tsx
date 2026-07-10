"use client";

import { AlertHistory as AlertHistoryType } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { LevelBadge } from "@/components/logs";
import { formatRelativeTime } from "@/lib/utils";
import { Bell } from "lucide-react";
import { AlertListSkeleton } from "@/components/loading";

interface AlertHistoryProps {
  history: AlertHistoryType[];
  isLoading?: boolean;
  ruleName?: string;
}

export function AlertHistory({ history, isLoading, ruleName }: AlertHistoryProps) {
  if (isLoading && history.length === 0) {
    return <AlertListSkeleton count={4} />;
  }

  if (history.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
        <p>No deliveries yet for {ruleName ? `"${ruleName}"` : "this rule"}.</p>
        <p className="text-xs max-w-md">
          Send a test email from the button above, or ingest a log at/above the
          rule&apos;s trigger level. Check spam if email was sent but not received.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((item) => (
        <Card key={item.id}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">
                    {ruleName ?? `Alert #${item.alertRuleId}`}
                  </span>
                  {item.log?.level && <LevelBadge level={item.log.level} />}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      item.status === "success"
                        ? "bg-green-500/10 text-green-600"
                        : "bg-red-500/10 text-red-600"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                {item.log?.message && (
                  <p className="text-sm mt-1 font-mono truncate">
                    {item.log.message}
                  </p>
                )}
                {item.errorMessage && (
                  <p className="text-sm text-destructive mt-1">
                    {item.errorMessage}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{formatRelativeTime(item.sentAt)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}