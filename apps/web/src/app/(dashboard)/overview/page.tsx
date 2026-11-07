"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  Code2,
  FileText,
  Plus,
  RefreshCw,
  Settings,
  Users,
} from "lucide-react";

import { useProject } from "@/hooks/use-project";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LogAnalytics } from "@/components/logs/log-analytics";
import { OverviewPageSkeleton, Spinner } from "@/components/loading";

export default function OverviewPage() {
  const { currentProject, isLoading: projectLoading } = useProject();
  const router = useRouter();
  const queryClient = useQueryClient();
  const projectId = currentProject?.id;

  const { data: alerts = [], isFetching: alertsFetching } = useQuery({
    queryKey: ["alerts", projectId],
    queryFn: () => api.get<{ enabled: boolean }[]>(`/alerts?projectId=${projectId}`),
    enabled: !!projectId,
  });

  const activeAlertsCount = alerts.filter((a) => a.enabled).length;

  const handleRefresh = async () => {
    if (!projectId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["log-analytics", projectId] }),
      queryClient.invalidateQueries({ queryKey: ["alerts", projectId] }),
    ]);
  };

  if (projectLoading) {
    return <OverviewPageSkeleton />;
  }

  if (!currentProject) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4 py-20 text-center">
        <div className="max-w-md space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground text-sm">
            Select or create a project to view telemetry and activity.
          </p>
        </div>
        <Button onClick={() => router.push("/create")}>
          <Plus className="mr-2 h-4 w-4" />
          Create Project
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground text-sm">
            Telemetry and system health for{" "}
            <span className="text-foreground font-medium">{currentProject.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => router.push("/logs")}
            className="w-full sm:w-auto"
          >
            <FileText className="mr-2 h-3.5 w-3.5" />
            Live Logs
          </Button>
        </div>
      </div>

      {/* Real telemetry analytics (Total Events, Error Rate, Warn Count, 24h Area Chart) */}
      <LogAnalytics projectId={projectId!} />

      {/* Quick context & actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alert Rules</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAlertsCount}</div>
            <p className="text-muted-foreground text-xs">
              {alerts.length} total configured rules
            </p>
            <Button
              variant="link"
              className="mt-2 h-auto p-0 text-xs"
              onClick={() => router.push("/alerts")}
            >
              Configure alerts &rarr;
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SDK Integration</CardTitle>
            <Code2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium text-foreground">Test Ingestion</div>
            <p className="text-muted-foreground text-xs">
              Simulate checkout, cart, or error events in real time.
            </p>
            <Button
              variant="link"
              className="mt-2 h-auto p-0 text-xs"
              onClick={() => router.push("/demo")}
            >
              Open SDK Demo &rarr;
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Project Settings</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium text-foreground">API Keys & Team</div>
            <p className="text-muted-foreground text-xs">
              Rotate ingest keys, manage devices, and invite collaborators.
            </p>
            <Button
              variant="link"
              className="mt-2 h-auto p-0 text-xs"
              onClick={() => router.push("/projects")}
            >
              Manage projects &rarr;
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
