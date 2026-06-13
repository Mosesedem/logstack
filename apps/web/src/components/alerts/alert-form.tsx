"use client";

import { useState } from "react";
import { AlertRule, LogLevel, AlertChannel } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  triggerPattern: string;
  triggerLevel?: LogLevel;
  channel: AlertChannel;
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
    triggerPattern: initialData?.triggerPattern || "",
    triggerLevel: initialData?.triggerLevel || "error",
    channel: initialData?.channel || "email",
    recipient: initialData?.recipient || "",
    cooldownMinutes: initialData?.cooldownMinutes || 5,
    enabled: initialData?.enabled ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
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
            <div className="grid gap-2">
              <Label htmlFor="triggerLevel">Log Level</Label>
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
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="triggerPattern">Trigger Pattern</Label>
              <Input
                id="triggerPattern"
                value={formData.triggerPattern}
                onChange={(e) =>
                  setFormData({ ...formData, triggerPattern: e.target.value })
                }
                placeholder=".*error.*"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="channel">Alert Channel</Label>
              <Select
                value={formData.channel}
                onValueChange={(value) =>
                  setFormData({ ...formData, channel: value as AlertChannel })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            <div className="grid gap-2">
              <Label htmlFor="cooldownMinutes">Cooldown (minutes)</Label>
              <Input
                id="cooldownMinutes"
                type="number"
                min={0}
                value={formData.cooldownMinutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    cooldownMinutes: parseInt(e.target.value),
                  })
                }
                required
              />
            </div>
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
