"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { AdminUserListResponse, User } from "@/types";
import {
  Bell,
  CheckCircle2,
  Mail,
  Radio,
  Search,
  Send,
  Users,
  X,
  XCircle,
} from "lucide-react";

type Channel = "email" | "push";

interface NotifyResults {
  emailSent?: number;
  emailFailed?: number;
  pushSent?: number;
  pushFailed?: number;
  pushTokensFound?: number;
  pushDevicesSent?: number;
  pushIOSTokens?: number;
  pushIOSSent?: number;
  pushIOSFailed?: number;
  pushAndroidTokens?: number;
  pushAndroidSent?: number;
  pushAndroidFailed?: number;
  recipients?: number;
  fcmEnabled?: boolean;
  errors?: string[];
}

export default function AdminNotificationsPage() {
  const { toast } = useToast();
  const [channels, setChannels] = useState<Channel[]>(["email", "push"]);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [broadcast, setBroadcast] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastResult, setLastResult] = useState<NotifyResults | null>(null);

  // User search
  const [userQuery, setUserQuery] = useState("");
  const [userHits, setUserHits] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const searchUsers = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 1) {
      setUserHits([]);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({
        limit: "12",
        offset: "0",
        search: trimmed,
      });
      const data = await apiClient.get<AdminUserListResponse>(
        `/admin/users?${params.toString()}`,
      );
      setUserHits(data.users ?? []);
      setSearchOpen(true);
    } catch {
      setUserHits([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (broadcast) return;
    const t = setTimeout(() => {
      void searchUsers(userQuery);
    }, 250);
    return () => clearTimeout(t);
  }, [userQuery, broadcast, searchUsers]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (
        searchWrapRef.current &&
        !searchWrapRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pickUser = (u: User) => {
    setSelectedUser(u);
    setUserId(String(u.id));
    setEmail(u.email ?? "");
    setUserQuery("");
    setUserHits([]);
    setSearchOpen(false);
    setBroadcast(false);
  };

  const clearRecipient = () => {
    setSelectedUser(null);
    setUserId("");
    setEmail("");
    setUserQuery("");
  };

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
        description: "Search and select a user, or enable broadcast",
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
      };
      if (broadcast && channels.includes("push")) {
        body.broadcast = true;
      } else {
        const idNum = Number(userId);
        if (Number.isFinite(idNum) && idNum > 0) {
          body.userId = Math.floor(idNum);
        }
        if (email.trim()) {
          body.email = email.trim().toLowerCase();
        }
      }

      const res = await apiClient.post<{
        message: string;
        results: NotifyResults;
      }>("/admin/notifications", body);

      setLastResult(res.results ?? null);
      toast({
        title: "Dispatched",
        description: res.message || "Notifications sent",
      });
    } catch (e) {
      const msg =
        e instanceof ApiClientError ? e.message : "Unexpected error";
      toast({
        title: "Send failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search a user, compose a message, and deliver email and/or push from
          the admin panel.
        </p>
      </div>

      <Card className="overflow-hidden border-border/80 shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Send className="h-4 w-4" />
            </span>
            Compose
          </CardTitle>
          <CardDescription>
            Push needs a linked mobile device with notification permission.
            Email uses your configured providers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {/* Channels */}
          <div className="space-y-2">
            <Label>Channels</Label>
            <div className="flex flex-wrap gap-3">
              <ChannelToggle
                active={channels.includes("email")}
                onClick={() => toggleChannel("email")}
                icon={<Mail className="h-4 w-4" />}
                label="Email"
              />
              <ChannelToggle
                active={channels.includes("push")}
                onClick={() => toggleChannel("push")}
                icon={<Bell className="h-4 w-4" />}
                label="Push"
              />
            </div>
          </div>

          {/* Recipient search */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Recipient</Label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="rounded border"
                  checked={broadcast}
                  onChange={(e) => {
                    setBroadcast(e.target.checked);
                    if (e.target.checked) {
                      clearRecipient();
                      setSearchOpen(false);
                    }
                  }}
                  disabled={!channels.includes("push")}
                />
                Broadcast push to all devices
              </label>
            </div>

            {broadcast ? (
              <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Radio className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Broadcast mode</p>
                  <p className="text-xs text-muted-foreground">
                    Push will go to every user with a registered device token.
                    Email is not used in broadcast.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div ref={searchWrapRef} className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9 pr-9"
                    placeholder="Search by name or email…"
                    value={userQuery}
                    onChange={(e) => {
                      setUserQuery(e.target.value);
                      setSearchOpen(true);
                    }}
                    onFocus={() => {
                      if (userHits.length > 0) setSearchOpen(true);
                    }}
                    autoComplete="off"
                  />
                  {searching ? (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wide text-muted-foreground">
                      …
                    </span>
                  ) : null}

                  {searchOpen && userQuery.trim() && (
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border bg-popover shadow-lg">
                      {userHits.length === 0 && !searching ? (
                        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                          No users match “{userQuery.trim()}”
                        </p>
                      ) : (
                        <ul className="py-1">
                          {userHits.map((u) => (
                            <li key={u.id}>
                              <button
                                type="button"
                                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/80"
                                onClick={() => pickUser(u)}
                              >
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground">
                                  {(u.name || u.email || "?").slice(0, 2)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">
                                    {u.name || "Unnamed"}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {u.email}
                                  </p>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-0.5">
                                  <Badge variant="secondary" className="text-[10px]">
                                    #{u.id}
                                  </Badge>
                                  {u.role === "admin" ? (
                                    <Badge className="text-[10px]">admin</Badge>
                                  ) : null}
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {selectedUser ? (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                      {(selectedUser.name || selectedUser.email || "?").slice(
                        0,
                        2,
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {selectedUser.name || "Unnamed"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {selectedUser.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[11px]">
                        ID {selectedUser.id}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        aria-label="Clear recipient"
                        onClick={clearRecipient}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="notify-user-id"
                        className="text-xs text-muted-foreground"
                      >
                        User ID
                      </Label>
                      <Input
                        id="notify-user-id"
                        type="number"
                        placeholder="Auto-filled from search"
                        value={userId}
                        onChange={(e) => {
                          setUserId(e.target.value);
                          setSelectedUser(null);
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="notify-email"
                        className="text-xs text-muted-foreground"
                      >
                        Email
                      </Label>
                      <Input
                        id="notify-email"
                        type="email"
                        placeholder="Auto-filled from search"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setSelectedUser(null);
                        }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Content */}
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
            <div className="flex items-center justify-between">
              <Label htmlFor="notify-message">Message</Label>
              <span className="text-[11px] text-muted-foreground">
                {message.length}/4000
              </span>
            </div>
            <textarea
              id="notify-message"
              className="min-h-[140px] w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
        </CardContent>
      </Card>

      {lastResult ? <DeliveryResults results={lastResult} /> : null}
    </div>
  );
}

function ChannelToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
        active
          ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
          : "border-border text-muted-foreground hover:bg-muted/50",
      )}
    >
      {icon}
      {label}
      {active ? (
        <CheckCircle2 className="h-3.5 w-3.5 opacity-80" />
      ) : null}
    </button>
  );
}

function DeliveryResults({ results }: { results: NotifyResults }) {
  const emailSent = Number(results.emailSent ?? 0);
  const emailFailed = Number(results.emailFailed ?? 0);
  const pushSent = Number(results.pushSent ?? 0);
  const pushFailed = Number(results.pushFailed ?? 0);
  const pushTokensFound = Number(results.pushTokensFound ?? 0);
  const pushDevicesSent = Number(results.pushDevicesSent ?? 0);
  const pushIOSTokens = Number(results.pushIOSTokens ?? 0);
  const pushIOSSent = Number(results.pushIOSSent ?? 0);
  const pushIOSFailed = Number(results.pushIOSFailed ?? 0);
  const pushAndroidTokens = Number(results.pushAndroidTokens ?? 0);
  const pushAndroidSent = Number(results.pushAndroidSent ?? 0);
  const pushAndroidFailed = Number(results.pushAndroidFailed ?? 0);
  const recipients = Number(results.recipients ?? 0);
  const fcmEnabled = results.fcmEnabled !== false;
  const totalOk = emailSent + pushSent;
  const totalFail = emailFailed + pushFailed;
  const allGood = totalFail === 0 && totalOk > 0;
  const iosTone = pushIOSFailed > 0 ? ("danger" as const) : ("success" as const);
  const androidTone =
    pushAndroidFailed > 0 ? ("danger" as const) : ("success" as const);

  const stats = [
    {
      key: "recipients",
      label: "Recipients",
      value: recipients,
      icon: Users,
      tone: "neutral" as const,
    },
    {
      key: "emailSent",
      label: "Email sent",
      value: emailSent,
      icon: Mail,
      tone: "success" as const,
    },
    {
      key: "emailFailed",
      label: "Email failed",
      value: emailFailed,
      icon: Mail,
      tone: "danger" as const,
    },
    {
      key: "pushDevicesSent",
      label: "Devices reached",
      value: pushDevicesSent,
      icon: Bell,
      tone: "success" as const,
    },
    {
      key: "pushTokensFound",
      label: "Device tokens",
      value: pushTokensFound,
      icon: Bell,
      tone: "neutral" as const,
    },
    ...(pushIOSTokens > 0
      ? [
          {
            key: "pushIOSSent",
            label: "iOS delivered",
            value: pushIOSSent,
            icon: Bell,
            tone: iosTone,
          },
          {
            key: "pushIOSFailed",
            label: "iOS failed",
            value: pushIOSFailed,
            icon: Bell,
            tone: "danger" as const,
          },
        ]
      : []),
    ...(pushAndroidTokens > 0
      ? [
          {
            key: "pushAndroidSent",
            label: "Android delivered",
            value: pushAndroidSent,
            icon: Bell,
            tone: androidTone,
          },
        ]
      : []),
    {
      key: "pushFailed",
      label: "Push failed",
      value: pushFailed,
      icon: Bell,
      tone: "danger" as const,
    },
  ];

  return (
    <Card
      className={cn(
        "overflow-hidden border shadow-sm",
        allGood
          ? "border-emerald-500/30"
          : totalFail > 0
            ? "border-destructive/30"
            : "border-border",
      )}
    >
      <CardHeader className="border-b bg-gradient-to-r from-muted/40 to-transparent pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              {allGood ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              Delivery report
            </CardTitle>
            <CardDescription>
              {allGood
                ? "All channels delivered successfully."
                : totalOk > 0
                  ? "Partial delivery — some channels failed."
                  : "No messages were delivered."}
              {!fcmEnabled
                ? " FCM is not enabled on the API — push cannot leave the server."
                : pushTokensFound === 0 && pushFailed > 0
                  ? " No device tokens registered for this user — open the mobile app and enable push."
                  : null}
            </CardDescription>
          </div>
          <Badge
            variant={allGood ? "default" : "secondary"}
            className={cn(
              allGood &&
                "bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-500",
            )}
          >
            {totalOk} ok · {totalFail} failed
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => {
            const Icon = s.icon;
            const highlightFail = s.tone === "danger" && s.value > 0;
            const highlightOk = s.tone === "success" && s.value > 0;
            return (
              <div
                key={s.key}
                className={cn(
                  "relative overflow-hidden rounded-xl border p-4 transition-colors",
                  highlightOk &&
                    "border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-500/10",
                  highlightFail &&
                    "border-destructive/25 bg-destructive/5",
                  !highlightOk && !highlightFail && "bg-card",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {s.label}
                  </span>
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      highlightOk && "text-emerald-600 dark:text-emerald-400",
                      highlightFail && "text-destructive",
                      !highlightOk && !highlightFail && "text-muted-foreground",
                    )}
                  />
                </div>
                <p
                  className={cn(
                    "mt-2 text-3xl font-bold tabular-nums tracking-tight",
                    highlightOk && "text-emerald-700 dark:text-emerald-300",
                    highlightFail && "text-destructive",
                  )}
                >
                  {s.value}
                </p>
              </div>
            );
          })}
        </div>

        {results.errors && results.errors.length > 0 ? (
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-destructive">
              Errors
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {results.errors.map((err, i) => (
                <li key={i} className="font-mono leading-relaxed">
                  {err}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
