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
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>Trigger Level:</span>
                {alert.triggerLevel && (
                  <LevelBadge level={alert.triggerLevel} />
                )}
              </div>
              <div>
                <span>Pattern: {alert.triggerPattern}</span>
              </div>
              <div>
                <span>Cooldown: {alert.cooldownMinutes}m</span>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs bg-muted px-2 py-1 rounded">
                {alert.channel}
              </span>
              <span className="text-xs text-muted-foreground">
                {alert.recipient}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
