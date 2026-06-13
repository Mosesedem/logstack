"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProject } from "@/hooks/use-project";
import { api } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  LogOut,
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

export default function DashboardHome() {
  const { currentProject, projects } = useProject();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProject?.id) return;
    loadStats();
  }, [currentProject?.id]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [logsResult, alertsResult] = await Promise.allSettled([
        api.get<{ logs: any[]; total: number }>(
          `/projects/${currentProject.id}/logs?limit=1&offset=0`,
        ),
        api.get<{ alerts: any[] }>(`/alerts?projectId=${currentProject.id}`),
      ]);

      const totalLogsToday =
        logsResult.status === "fulfilled" ? logsResult.value.total : 0;
      const errorCount =
        logsResult.status === "fulfilled"
          ? logsResult.value.logs.filter((l) => l.level === "error").length
          : 0;
      const activeAlerts =
        alertsResult.status === "fulfilled"
          ? alertsResult.value.alerts.filter((a) => a.enabled).length
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
    }
  };

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Select a project to view your dashboard
          </p>
        </div>
        <Button onClick={() => router.push("/projects")}>
          Create Project
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview for {currentProject.name}
          </p>
        </div>
        <Button onClick={loadStats}>
          <Activity className="mr-2 h-4 w-4" />
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
              {stats?.totalLogsToday === 0
                ? "No logs yet"
                : "Last 24 hours"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {stats?.errorCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.errorCount === 0
                ? "No errors today"
                : "Error logs today"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeAlerts}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeAlerts === 0
                ? "No active rules"
                : "Rules currently enabled"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usage</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.usagePercentage?.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.logLimit === -1
                ? "Unlimited"
                : `${stats?.logLimit.toLocaleString()} / month`}
            </p>
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
              variant="outline"
              className="w-full justify-start"
              onClick={() => router.push("/logs")}
            >
              <Activity className="mr-2 h-4 w-4" />
              View Logs
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => router.push("/alerts")}
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Manage Alerts
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => router.push("/projects")}
            >
              <Users className="mr-2 h-4 w-4" />
              Manage Projects
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.totalLogsToday === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="mx-auto h-12 w-12 mb-2 opacity-20" />
                <p>No logs yet</p>
                <p className="text-sm mt-2">
                  Send your first log using the SDK
                </p>
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={() => router.push("/docs")}
                >
                  View Documentation
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">System healthy</p>
                    <p className="text-xs text-muted-foreground">
                      No critical errors today
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Logs being ingested</p>
                    <p className="text-xs text-muted-foreground">
                      {stats?.totalLogsToday} logs today
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
