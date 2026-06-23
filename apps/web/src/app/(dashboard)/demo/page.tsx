"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createLogStack, type LogStackClient, type LogLevel } from "logstack-js";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Play,
  ShoppingCart,
  Zap,
} from "lucide-react";

import { useProject } from "@/hooks/use-project";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LevelBadge } from "@/components/logs";

const API_KEY_STORAGE_KEY = "logstack-demo-api-key";

const endpoint = (
  process.env.NEXT_PUBLIC_API_URL || "https://api.logstack.tech/v1"
).replace(/\/v1\/?$/, "");

interface Scenario {
  id: string;
  label: string;
  description: string;
  level: LogLevel;
  message: string;
  metadata: Record<string, string | number | boolean>;
}

const SCENARIOS: Scenario[] = [
  {
    id: "login",
    label: "User signed in",
    description: "OAuth login succeeded",
    level: "info",
    message: "User signed in via Google OAuth",
    metadata: { provider: "google", userId: "usr_demo_42", source: "mock-shop" },
  },
  {
    id: "cart",
    label: "Added to cart",
    description: "Product added before checkout",
    level: "info",
    message: "Item added to cart",
    metadata: { sku: "LS-PRO-001", quantity: 2, price: 49.99, source: "mock-shop" },
  },
  {
    id: "payment-error",
    label: "Payment failed",
    description: "Card declined — triggers alerts",
    level: "error",
    message: "Payment authorization failed",
    metadata: {
      gateway: "paystack",
      reason: "card_declined",
      amount: 99.98,
      source: "mock-shop",
    },
  },
  {
    id: "order",
    label: "Order completed",
    description: "Successful purchase",
    level: "info",
    message: "Order placed successfully",
    metadata: {
      orderId: "ord_demo_7f3a",
      total: 99.98,
      currency: "USD",
      source: "mock-shop",
    },
  },
  {
    id: "slow-query",
    label: "Slow database query",
    description: "Performance warning",
    level: "warn",
    message: "Database query exceeded threshold",
    metadata: { query: "SELECT * FROM orders", durationMs: 842, source: "mock-shop" },
  },
];

interface ActivityEntry {
  id: string;
  level: LogLevel;
  message: string;
  status: "pending" | "sent" | "error";
  detail?: string;
  at: string;
}

function maskApiKey(key: string): string {
  if (key.length <= 12) return "••••••••";
  return `${key.slice(0, 6)}••••${key.slice(-4)}`;
}

export default function DemoPage() {
  const router = useRouter();
  const { currentProject } = useProject();
  const [apiKey, setApiKey] = useState("");
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [sending, setSending] = useState<string | null>(null);
  const [runningBurst, setRunningBurst] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(API_KEY_STORAGE_KEY);
    if (stored) setApiKey(stored);
  }, []);

  const client = useMemo<LogStackClient | null>(() => {
    if (!apiKey.startsWith("ls_")) return null;
    return createLogStack({
      apiKey,
      endpoint,
      environment: "production",
      consoleInProduction: true,
      captureContext: true,
    });
  }, [apiKey]);

  const persistApiKey = useCallback((value: string) => {
    setApiKey(value);
    if (value) {
      sessionStorage.setItem(API_KEY_STORAGE_KEY, value);
    } else {
      sessionStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  }, []);

  const pushActivity = useCallback(
    (entry: Omit<ActivityEntry, "id" | "at">) => {
      setActivity((prev) => [
        {
          ...entry,
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
        },
        ...prev.slice(0, 19),
      ]);
    },
    [],
  );

  const sendScenario = useCallback(
    async (scenario: Scenario) => {
      if (!client) {
        pushActivity({
          level: scenario.level,
          message: scenario.message,
          status: "error",
          detail: "Paste a valid API key (starts with ls_)",
        });
        return;
      }

      setSending(scenario.id);
      pushActivity({
        level: scenario.level,
        message: scenario.message,
        status: "pending",
      });

      try {
        client.log({
          level: scenario.level,
          message: scenario.message,
          metadata: scenario.metadata,
        });
        await client.flush();
        pushActivity({
          level: scenario.level,
          message: scenario.message,
          status: "sent",
        });
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "Failed to send log";
        pushActivity({
          level: scenario.level,
          message: scenario.message,
          status: "error",
          detail,
        });
      } finally {
        setSending(null);
      }
    },
    [client, pushActivity],
  );

  const runBurst = useCallback(async () => {
    if (!client) return;
    setRunningBurst(true);
    const levels: LogLevel[] = ["debug", "info", "warn", "error"];
    try {
      for (let i = 0; i < 8; i++) {
        const level = levels[i % levels.length];
        client.log({
          level,
          message: `Burst traffic event #${i + 1}`,
          metadata: { source: "mock-shop", burst: true, index: i + 1 },
        });
      }
      await client.flush();
      pushActivity({
        level: "info",
        message: "Sent 8 burst logs",
        status: "sent",
      });
    } catch (error) {
      pushActivity({
        level: "error",
        message: "Burst send failed",
        status: "error",
        detail: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setRunningBurst(false);
    }
  }, [client, pushActivity]);

  const runFullFlow = useCallback(async () => {
    for (const scenario of SCENARIOS) {
      await sendScenario(scenario);
      await new Promise((r) => setTimeout(r, 400));
    }
  }, [sendScenario]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">SDK Demo</h1>
          <p className="text-muted-foreground">
            Mock ShopFlow app — send test logs to your project and watch them
            appear live.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/logs")}>
          View logs
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              ShopFlow Checkout
            </CardTitle>
            <CardDescription>
              Simulates a small e-commerce app. Each button ships a log via{" "}
              <code className="text-xs">logstack-js</code> to{" "}
              <code className="text-xs">{endpoint}</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">Project API key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="ls_..."
                value={apiKey}
                onChange={(e) => persistApiKey(e.target.value)}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Copy from{" "}
                <button
                  type="button"
                  className="underline hover:text-foreground"
                  onClick={() => router.push("/projects")}
                >
                  Projects
                </button>{" "}
                when you create or rotate a key. Stored in this tab only.
                {apiKey.startsWith("ls_") && (
                  <> Active: {maskApiKey(apiKey)}</>
                )}
              </p>
            </div>

            {currentProject && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Viewing logs for:</span>
                <Badge variant="secondary">{currentProject.name}</Badge>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {SCENARIOS.map((scenario) => (
                <Button
                  key={scenario.id}
                  variant="outline"
                  className="h-auto flex-col items-start gap-1 py-3 text-left"
                  disabled={sending !== null || runningBurst}
                  onClick={() => sendScenario(scenario)}
                >
                  <span className="font-medium">{scenario.label}</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    {scenario.description}
                  </span>
                  {sending === scenario.id && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                onClick={runFullFlow}
                disabled={!client || sending !== null || runningBurst}
              >
                <Play className="mr-2 h-4 w-4" />
                Run full checkout flow
              </Button>
              <Button
                variant="secondary"
                onClick={runBurst}
                disabled={!client || sending !== null || runningBurst}
              >
                <Zap className="mr-2 h-4 w-4" />
                {runningBurst ? "Sending burst…" : "Send burst (8 logs)"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity feed</CardTitle>
            <CardDescription>
              Recent events from this demo session. Open{" "}
              <button
                type="button"
                className="underline hover:text-foreground"
                onClick={() => router.push("/logs")}
              >
                Logs
              </button>{" "}
              to see them stream in real time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 opacity-40" />
                <p className="text-sm">No events yet — click a scenario above.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {activity.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-start gap-3 rounded-lg border bg-card/50 p-3"
                  >
                    <LevelBadge level={entry.level} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {entry.message}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.at).toLocaleTimeString()}
                        {entry.detail && ` — ${entry.detail}`}
                      </p>
                    </div>
                    <Badge
                      variant={
                        entry.status === "sent"
                          ? "default"
                          : entry.status === "error"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {entry.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}