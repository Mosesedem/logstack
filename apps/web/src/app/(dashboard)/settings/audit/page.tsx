"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Shield,
  User,
  Clock,
  Activity,
  Loader2,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { AuditPageSkeleton, TableSkeleton } from "@/components/loading";

interface AuditLogUser {
  id: number;
  name: string;
  email: string;
}

interface AuditLog {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details: Record<string, any>;
  user?: AuditLogUser;
  ip_address?: string;
  created_at: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export default function AuditLogsPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [availableActions, setAvailableActions] = useState<string[]>([]);

  useEffect(() => {
    loadActions();
  }, []);

  useEffect(() => {
    loadAuditLogs();
  }, [page, actionFilter]);

  const loadActions = async () => {
    try {
      const response = await apiClient.get<{ actions: string[] }>(
        "/audit/actions",
      );
      setAvailableActions(response.actions);
    } catch (error) {
      console.error("Failed to load actions:", error);
    }
  };

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: "20",
      });
      if (actionFilter !== "all") {
        params.append("action", actionFilter);
      }

      const response = await apiClient.get<AuditLogsResponse>(
        `/audit?${params}`,
      );
      setLogs(response.logs);
      setTotal(response.total);
      setTotalPages(response.total_pages);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load audit logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getActionBadgeColor = (action: string): string => {
    if (
      action.includes("created") ||
      action.includes("invited") ||
      action.includes("joined")
    ) {
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    }
    if (
      action.includes("deleted") ||
      action.includes("removed") ||
      action.includes("revoked") ||
      action.includes("cancelled")
    ) {
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    }
    if (
      action.includes("updated") ||
      action.includes("changed") ||
      action.includes("upgraded") ||
      action.includes("downgraded")
    ) {
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    }
    return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  };

  const formatAction = (action: string): string => {
    return action
      .split(".")
      .join(" - ")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatDetails = (details: Record<string, any>): string => {
    if (!details || Object.keys(details).length === 0) return "";

    const parts: string[] = [];
    if (details.invited_user_email)
      parts.push(`User: ${details.invited_user_email}`);
    if (details.old_role && details.new_role)
      parts.push(`Role: ${details.old_role} → ${details.new_role}`);
    if (details.role && !details.old_role) parts.push(`Role: ${details.role}`);

    return parts.join(", ");
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading && logs.length === 0) {
    return <AuditPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Audit Logs</h2>
        <p className="text-muted-foreground mt-2">
          Track all actions and changes made within your organization
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Activity Log
              </CardTitle>
              <CardDescription>
                {total} total {total === 1 ? "event" : "events"}
              </CardDescription>
            </div>
            <Select
              value={actionFilter}
              onValueChange={(value) => setActionFilter(value)}
            >
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {availableActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {formatAction(action)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={6} columns={4} className="border-0" />
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No audit logs found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getActionBadgeColor(log.action)}>
                        {formatAction(log.action)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground capitalize">
                        {log.resource_type}
                      </span>
                    </div>
                    <p className="text-sm font-medium">
                      {log.user ? (
                        <>
                          <span className="font-semibold">{log.user.name}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            ({log.user.email})
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">
                          Unknown user
                        </span>
                      )}
                    </p>
                    {formatDetails(log.details) && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDetails(log.details)}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(log.created_at)}
                      </span>
                      {log.ip_address && <span>IP: {log.ip_address}</span>}
                    </div>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
