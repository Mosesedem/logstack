"use client";

import { useState } from "react";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Bell, Mail, Send } from "lucide-react";

type Channel = "email" | "push";

export default function AdminNotificationsPage() {
  const { toast } = useToast();
  const [channels, setChannels] = useState<Channel[]>(["email", "push"]);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [broadcast, setBroadcast] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(
    null,
  );

  const toggleChannel = (ch: Channel) => {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  };

  const handleSend = async () => {
    if (channels.length === 0) {
      toast({
        title: "Select a channel",
        description: "Choose email and/or push",
        variant: "destructive",
      });
      return;
    }
    if (!title.trim() || !message.trim()) {
      toast({
        title: "Missing content",
        description: "Title and message are required",
        variant: "destructive",
      });
      return;
    }
    if (!broadcast && !userId.trim() && !email.trim()) {
      toast({
        title: "Missing recipient",
        description: "Set user ID, email, or enable push broadcast",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    setLastResult(null);
    try {
      const body: Record<string, unknown> = {
        channels,
        title: title.trim(),
        message: message.trim(),
        broadcast: broadcast && channels.includes("push"),
      };
      if (userId.trim()) body.userId = Number(userId);
      if (email.trim()) body.email = email.trim();

      const res = await apiClient.post<{
        message: string;
        results: Record<string, unknown>;
      }>("/admin/notifications", body);

      setLastResult(res.results ?? null);
      toast({
        title: "Sent",
        description: res.message || "Notifications dispatched",
      });
    } catch (e) {
      toast({
        title: "Send failed",
        description:
          e instanceof ApiClientError ? e.message : "Unexpected error",
        variant: "destructive",
      });
      if (e instanceof ApiClientError) {
        // try to show structured results if present
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Send email and/or push notifications directly to users from the admin
          dashboard.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Send className="h-5 w-5" />
            Compose
          </CardTitle>
          <CardDescription>
            Push requires the recipient to have the mobile app linked with
            notification permission. Email uses the configured providers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Channels</Label>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={channels.includes("email")}
                  onChange={() => toggleChannel("email")}
                />
                <Mail className="h-4 w-4" />
                Email
              </label>
              <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={channels.includes("push")}
                  onChange={() => toggleChannel("push")}
                />
                <Bell className="h-4 w-4" />
                Push
              </label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="notify-user-id">User ID</Label>
              <Input
                id="notify-user-id"
                type="number"
                placeholder="e.g. 1"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                disabled={broadcast}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notify-email">Email</Label>
              <Input
                id="notify-email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={broadcast}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={broadcast}
              onChange={(e) => setBroadcast(e.target.checked)}
              disabled={!channels.includes("push")}
            />
            Broadcast push to all devices with a registered token
          </label>

          <div className="space-y-2">
            <Label htmlFor="notify-title">Title</Label>
            <Input
              id="notify-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Maintenance window"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notify-message">Message</Label>
            <textarea
              id="notify-message"
              className="min-h-[140px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="We'll be upgrading the API between 02:00–03:00 UTC…"
              maxLength={4000}
            />
          </div>

          <Button
            className="w-full gap-2 sm:w-auto"
            onClick={handleSend}
            disabled={saving}
          >
            <Send className="h-4 w-4" />
            {saving ? "Sending…" : "Send notification"}
          </Button>

          {lastResult ? (
            <pre className="overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
