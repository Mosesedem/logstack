"use client";

import { AlertRule } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { LevelBadge } from "@/components/logs";
import { Edit, Mail, Plus, Trash2 } from "lucide-react";
import { AlertListSkeleton } from "@/components/loading";

interface AlertListProps {
  alerts: AlertRule[];
  onToggle: (id: number, enabled: boolean) => void;
  onEdit: (alert: AlertRule) => void;
  onDelete: (id: number) => void;
  onCreate?: () => void;
  onTestEmail?: (id: number) => void;
  testingAlertId?: number | null;
  isLoading?: boolean;
}

export function AlertList({
  alerts,
  onToggle,
  onEdit,
  onDelete,
  onCreate,
  onTestEmail,
  testingAlertId,
  isLoading,
}: AlertListProps) {
  if (isLoading && alerts.length === 0) {
    return <AlertListSkeleton count={3} />;
  }

  if (alerts.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <p className="text-muted-foreground max-w-md">
          No alert rules yet. Create one to get emailed (or pushed) when logs
          match error patterns — or finish setup from project creation.
        </p>
        {onCreate && (
          <Button onClick={onCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first alert
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert) => (
        <Card key={alert.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{alert.name}</CardTitle>
              <div className="flex items-center gap-2">
                <Switch
                  checked={alert.enabled}
                  onCheckedChange={(checked) => onToggle(alert.id, checked)}
                />
                {onTestEmail && (alert.channels?.length ?? 0) > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Send test notification (all channels)"
                    disabled={testingAlertId === alert.id}
                    onClick={() => onTestEmail(alert.id)}
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(alert)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(alert.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Trigger Level:</span>
                {alert.triggerLevel && (
                  <LevelBadge level={alert.triggerLevel} />
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="shrink-0">Patterns:</span>
                {alert.triggerPatterns?.length ? (
                  alert.triggerPatterns.map((pattern) => (
                    <span
                      key={pattern}
                      className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded font-mono"
                    >
                      {pattern}
                    </span>
                  ))
                ) : (
                  <span>None</span>
                )}
              </div>
              <div>
                <span>Cooldown: {alert.cooldownMinutes}m</span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">Channels:</span>
              {alert.channels?.length ? (
                alert.channels.map((ch) => (
                  <span
                    key={ch}
                    className="text-xs bg-muted text-foreground px-2 py-0.5 rounded-full font-medium capitalize"
                  >
                    {ch}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">None</span>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {alert.recipient}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
