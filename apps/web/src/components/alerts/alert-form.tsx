"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertRule, AlertOptions, LogLevel } from "@/types";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AlertFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<AlertRule>) => void;
  initialData?: AlertRule | null;
  isSubmitting?: boolean;
}

interface AlertFormData {
  name: string;
  triggerPatterns: string[];
  triggerLevel?: LogLevel;
  channels: string[];
  recipient: string;
  cooldownMinutes: number;
  enabled: boolean;
}

export function AlertForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isSubmitting,
}: AlertFormProps) {
  const [formData, setFormData] = useState<AlertFormData>({
    name: initialData?.name || "",
    triggerPatterns: initialData?.triggerPatterns ?? [],
    triggerLevel: initialData?.triggerLevel || "error",
    channels: initialData?.channels ?? [],
    recipient: initialData?.recipient || "",
    cooldownMinutes: initialData?.cooldownMinutes || 15,
    enabled: initialData?.enabled ?? true,
  });

  const { data: options, isLoading: optionsLoading } = useQuery<AlertOptions>({
    queryKey: ["alert-options"],
    queryFn: () => api.get<AlertOptions>("/alerts/options"),
    staleTime: 5 * 60 * 1000, // 5 minutes — options are static
  });

  const toggleArrayItem = (
    field: "channels" | "triggerPatterns",
    value: string
  ) => {
    const current = formData[field];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setFormData({ ...formData, [field]: updated });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Edit Alert Rule" : "Create Alert Rule"}
          </DialogTitle>
          <DialogDescription>
            Configure when and how you want to be alerted about log events.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="High error rate alert"
                required
              />
            </div>

            {/* Log Level */}
            <div className="grid gap-2">
              <Label htmlFor="triggerLevel">Log Level</Label>
              {optionsLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select
                  value={formData.triggerLevel}
                  onValueChange={(value) =>
                    setFormData({ ...formData, triggerLevel: value as LogLevel })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {(options?.triggerLevels ?? ["debug", "info", "warn", "error", "critical", "fatal"]).map(
                      (level) => (
                        <SelectItem key={level} value={level}>
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Trigger Patterns — checkbox list */}
            <div className="grid gap-2">
              <Label>Trigger Patterns</Label>
              {optionsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-5 w-full" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 rounded-md border p-3">
                  {(options?.triggerPatterns ?? []).map((pattern) => (
                    <Checkbox
                      key={pattern}
                      id={`pattern-${pattern}`}
                      label={pattern}
                      checked={formData.triggerPatterns.includes(pattern)}
                      onChange={() => toggleArrayItem("triggerPatterns", pattern)}
                    />
                  ))}
                  {!options?.triggerPatterns?.length && (
                    <p className="text-sm text-muted-foreground">
                      No patterns available
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Alert Channels — checkbox group */}
            <div className="grid gap-2">
              <Label>Alert Channels</Label>
              {optionsLoading ? (
                <div className="flex gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-5 w-20" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-4 rounded-md border p-3">
                  {(options?.channels ?? []).map((channel) => (
                    <Checkbox
                      key={channel}
                      id={`channel-${channel}`}
                      label={channel.charAt(0).toUpperCase() + channel.slice(1)}
                      checked={formData.channels.includes(channel)}
                      onChange={() => toggleArrayItem("channels", channel)}
                    />
                  ))}
                  {!options?.channels?.length && (
                    <p className="text-sm text-muted-foreground">
                      No channels available
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Recipient */}
            <div className="grid gap-2">
              <Label htmlFor="recipient">Recipient</Label>
              <Input
                id="recipient"
                value={formData.recipient}
                onChange={(e) =>
                  setFormData({ ...formData, recipient: e.target.value })
                }
                placeholder="user@example.com or webhook URL"
                required
              />
            </div>

            {/* Cooldown — Select from options */}
            <div className="grid gap-2">
              <Label htmlFor="cooldownMinutes">Cooldown</Label>
              {optionsLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select
                  value={String(formData.cooldownMinutes)}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      cooldownMinutes: parseInt(value, 10),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cooldown" />
                  </SelectTrigger>
                  <SelectContent>
                    {(options?.cooldownOptions ?? [5, 10, 15, 30, 60]).map(
                      (minutes) => (
                        <SelectItem key={minutes} value={String(minutes)}>
                          {minutes} {minutes === 1 ? "minute" : "minutes"}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Enabled toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="enabled">Enabled</Label>
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, enabled: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : initialData ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
