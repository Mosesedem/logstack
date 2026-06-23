"use client";

import { AlertRule } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { LevelBadge } from "@/components/logs";
import { Edit, Trash2 } from "lucide-react";

interface AlertListProps {
  alerts: AlertRule[];
  onToggle: (id: number, enabled: boolean) => void;
  onEdit: (alert: AlertRule) => void;
  onDelete: (id: number) => void;
  isLoading?: boolean;
}

export function AlertList({
  alerts,
  onToggle,
  onEdit,
  onDelete,
  isLoading,
}: AlertListProps) {
  if (alerts.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        No alert rules configured
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
