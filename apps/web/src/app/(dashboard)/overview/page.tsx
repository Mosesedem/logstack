"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProject } from "@/hooks/use-project";
import { api } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { OverviewPageSkeleton, Spinner } from "@/components/loading";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  FileText,
  Settings,
  Users,
} from "lucide-react";

interface DashboardStats {
  totalLogsToday: number;
  errorCount: number;
  activeAlerts: number;
  logLimit: number;
  usagePercentage: number;
}

export default function OverviewPage() {
  const { currentProject, isLoading: projectLoading } = useProject();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const projectId = currentProject?.id;

  useEffect(() => {
    if (!projectId) return;
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadStats = async (opts?: { silent?: boolean }) => {
    if (!projectId) return;

    try {
      if (opts?.silent) setRefreshing(true);
      else setLoading(true);
      const [logsResult, alertsResult] = await Promise.allSettled([
        api.get<{ logs: { level: string }[]; total: number }>(
          `/projects/${projectId}/logs?limit=1&offset=0`,
        ),
        api.get<{ enabled: boolean }[]>(`/alerts?projectId=${projectId}`),
      ]);

      const totalLogsToday =
        logsResult.status === "fulfilled" ? logsResult.value.total : 0;
      const errorCount =
        logsResult.status === "fulfilled"
          ? logsResult.value.logs.filter((l) => l.level === "error").length
          : 0;
      const activeAlerts =
        alertsResult.status === "fulfilled"
          ? alertsResult.value.filter((a) => a.enabled).length
          : 0;

      setStats({
        totalLogsToday,
        errorCount,
        activeAlerts,
        logLimit: 10000,
        usagePercentage: 0,
      });
    } catch (error) {
      console.error("Failed to load dashboard stats:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (projectLoading || (currentProject && loading && !stats)) {
    return <OverviewPageSkeleton />;
  }

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-muted-foreground">
            Select or create a project to view your dashboard
          </p>
        </div>
        <Button onClick={() => router.push("/create")}>Create Project</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-muted-foreground">
            Overview for {currentProject.name}
          </p>
        </div>
        <Button
          onClick={() => loadStats({ silent: true })}
          className="w-full sm:w-auto"
          disabled={refreshing}
        >
          {refreshing ? (
            <Spinner size="sm" className="mr-2" label="Refreshing" />
          ) : (
            <Activity className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Logs Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalLogsToday}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.errorCount} errors detected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeAlerts}</div>
            <p className="text-xs text-muted-foreground">Across all rules</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usage</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.usagePercentage}%</div>
            <p className="text-xs text-muted-foreground">
              of {stats?.logLimit.toLocaleString()} logs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.9%</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => router.push("/logs")}
            >
              <FileText className="mr-2 h-4 w-4" />
              View Logs
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => router.push("/alerts")}
            >
              <Settings className="mr-2 h-4 w-4" />
              Configure Alerts
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={() => router.push("/settings/team")}
            >
              <Users className="mr-2 h-4 w-4" />
              Invite Team Member
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
