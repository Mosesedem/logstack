"use client";

import { AlertOptions, LogLevel } from "@/types";
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

export interface AlertFormData {
  name: string;
  triggerPatterns: string[];
  triggerLevel?: LogLevel;
  channels: string[];
  recipient: string;
  cooldownMinutes: number;
  enabled: boolean;
}

export function buildDefaultAlertFormData(options?: {
  initialData?: Partial<AlertFormData> | null;
  defaultRecipient?: string;
  defaultName?: string;
}): AlertFormData {
  const { initialData, defaultRecipient, defaultName } = options ?? {};
  const hasEmailDefault = Boolean(defaultRecipient);

  return {
    name: initialData?.name || defaultName || "",
    // Level-only by default — fires on any log at/above triggerLevel.
    // Users can opt into pattern filters via the checkboxes below.
    triggerPatterns: initialData?.triggerPatterns ?? [],
    triggerLevel: initialData?.triggerLevel || "error",
    channels:
      initialData?.channels ?? (hasEmailDefault ? ["email"] : []),
    recipient: initialData?.recipient || defaultRecipient || "",
    cooldownMinutes: initialData?.cooldownMinutes ?? 15,
    enabled: initialData?.enabled ?? true,
  };
}

export function validateAlertFormData(data: AlertFormData): string | null {
  if (!data.name.trim()) return "Alert name is required.";
  if (!data.channels.length) return "Select at least one notification channel.";
  if (data.channels.includes("email") && !data.recipient.trim()) {
    return "Email recipient is required for email alerts.";
  }
  if (data.channels.includes("webhook") && !data.recipient.trim()) {
    return "Webhook URL is required for webhook alerts.";
  }
  return null;
}

interface AlertFormFieldsProps {
  formData: AlertFormData;
  onChange: (data: AlertFormData) => void;
  options?: AlertOptions;
  optionsLoading?: boolean;
  idPrefix?: string;
  compact?: boolean;
}

export function AlertFormFields({
  formData,
  onChange,
  options,
  optionsLoading,
  idPrefix = "alert",
  compact = false,
}: AlertFormFieldsProps) {
  const toggleArrayItem = (
    field: "channels" | "triggerPatterns",
    value: string,
  ) => {
    const current = formData[field];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...formData, [field]: updated });
  };

  const recipientLabel = formData.channels.includes("webhook")
    ? "Webhook URL"
    : formData.channels.includes("email")
      ? "Email recipient"
      : "Recipient";

  return (
    <div className={compact ? "grid min-w-0 gap-3" : "grid gap-4"}>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-name`}>Name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={formData.name}
          onChange={(e) => onChange({ ...formData, name: e.target.value })}
          placeholder="Production error alerts"
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-triggerLevel`}>Minimum log level</Label>
        {optionsLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <Select
            value={formData.triggerLevel}
            onValueChange={(value) =>
              onChange({ ...formData, triggerLevel: value as LogLevel })
            }
          >
            <SelectTrigger id={`${idPrefix}-triggerLevel`}>
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              {(
                options?.triggerLevels ?? [
                  "debug",
                  "info",
                  "warn",
                  "error",
                  "critical",
                  "fatal",
                ]
              ).map((level) => (
                <SelectItem key={level} value={level}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid gap-2">
        <Label>Trigger patterns</Label>
        <p className="text-xs text-muted-foreground -mt-1">
          Alert fires when a log at or above the selected level matches any
          checked pattern. Leave all unchecked for level-only alerts.
        </p>
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
                id={`${idPrefix}-pattern-${pattern}`}
                label={pattern}
                labelClassName="font-mono text-xs break-all"
                checked={formData.triggerPatterns.includes(pattern)}
                onChange={() => toggleArrayItem("triggerPatterns", pattern)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <Label>Channels</Label>
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
                id={`${idPrefix}-channel-${channel}`}
                label={channel.charAt(0).toUpperCase() + channel.slice(1)}
                checked={formData.channels.includes(channel)}
                onChange={() => toggleArrayItem("channels", channel)}
              />
            ))}
          </div>
        )}
      </div>

      {(formData.channels.includes("email") ||
        formData.channels.includes("webhook")) && (
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-recipient`}>{recipientLabel}</Label>
          <Input
            id={`${idPrefix}-recipient`}
            value={formData.recipient}
            onChange={(e) =>
              onChange({ ...formData, recipient: e.target.value })
            }
            placeholder={
              formData.channels.includes("webhook")
                ? "https://hooks.example.com/alerts"
                : "you@company.com"
            }
            required
          />
        </div>
      )}

      {formData.channels.includes("push") && (
        <p className="text-xs text-muted-foreground rounded-md border bg-muted/30 p-3">
          Push alerts go to mobile devices linked to your account. Install the
          Logstack mobile app and sign in to receive them.
        </p>
      )}

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-cooldown`}>Cooldown between alerts</Label>
        {optionsLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <Select
            value={String(formData.cooldownMinutes)}
            onValueChange={(value) =>
              onChange({
                ...formData,
                cooldownMinutes: parseInt(value, 10),
              })
            }
          >
            <SelectTrigger id={`${idPrefix}-cooldown`}>
              <SelectValue placeholder="Select cooldown" />
            </SelectTrigger>
            <SelectContent>
              {(options?.cooldownOptions ?? [5, 10, 15, 30, 60]).map(
                (minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {minutes} {minutes === 1 ? "minute" : "minutes"}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor={`${idPrefix}-enabled`}>Enabled</Label>
        <Switch
          id={`${idPrefix}-enabled`}
          checked={formData.enabled}
          onCheckedChange={(checked) =>
            onChange({ ...formData, enabled: checked })
          }
        />
      </div>
    </div>
  );
}