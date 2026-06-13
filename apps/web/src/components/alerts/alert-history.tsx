"use client";

import { AlertHistory as AlertHistoryType } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { LevelBadge } from "@/components/logs";
import { formatRelativeTime } from "@/lib/utils";
import { Bell } from "lucide-react";

interface AlertHistoryProps {
  history: AlertHistoryType[];
  isLoading?: boolean;
}

export function AlertHistory({ history, isLoading }: AlertHistoryProps) {
  if (history.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        No alerts triggered yet
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
                <div className="flex items-center gap-2">
                  <span className="font-medium">Alert #{item.alertRuleId}</span>
                  {/* TODO: Fix types - LevelBadge level={item.level} */}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Status: {item.status}
                  {item.errorMessage && ` - ${item.errorMessage}`}
                </p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{formatRelativeTime(item.sentAt)}</span>
                  <span>Rule ID: {item.alertRuleId}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
