"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  FolderGit2,
  FileText,
  CreditCard,
  Shield,
  Tags,
  Building2,
  Bell,
  Receipt,
} from "lucide-react";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import {
  PageHeaderSkeleton,
  StatsGridSkeleton,
} from "@/components/loading";

interface SystemStats {
  totalUsers: number;
  totalProjects: number;
  totalLogs: number;
  activeSubscriptions?: number;
  adminUsers?: number;
  totalOrganizations?: number;
  totalInvoices?: number;
  totalAlerts?: number;
  pricingPlans?: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await apiClient.get<SystemStats>("/admin/stats");
        setStats(data);
      } catch (e: unknown) {
        console.error(e);
        if (e instanceof ApiClientError && e.status === 403) {
          router.replace("/overview");
        }
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-6 p-2" role="status" aria-label="Loading admin">
        <PageHeaderSkeleton withAction={false} />
        <StatsGridSkeleton count={9} />
      </div>
    );
  }

  const cards = [
    {
      title: "Users",
      value: stats?.totalUsers,
      icon: Users,
      href: "/admin/users",
    },
    {
      title: "Admins",
      value: stats?.adminUsers,
      icon: Shield,
      href: "/admin/users?role=admin",
    },
    {
      title: "Projects",
      value: stats?.totalProjects,
      icon: FolderGit2,
      href: "/admin/projects",
    },
    {
      title: "Pricing plans",
      value: stats?.pricingPlans,
      icon: Tags,
      href: "/admin/plans",
    },
    {
      title: "Paid subs",
      value: stats?.activeSubscriptions,
      icon: CreditCard,
      href: "/admin/subscriptions",
    },
    {
      title: "Invoices",
      value: stats?.totalInvoices,
      icon: Receipt,
      href: "/admin/invoices",
    },
    {
      title: "Organizations",
      value: stats?.totalOrganizations,
      icon: Building2,
      href: "/admin/organizations",
    },
    {
      title: "Alerts",
      value: stats?.totalAlerts,
      icon: Bell,
      href: "/admin/alerts",
    },
    {
      title: "Total logs",
      value: stats?.totalLogs,
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Full platform CRUD: users, projects, pricing, subscriptions, invoices,
          organizations, alerts, invites, usage, and audit.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const content = (
            <Card
              className={
                card.href
                  ? "transition-colors hover:border-primary/40 hover:bg-muted/40"
                  : undefined
              }
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {card.value?.toLocaleString() ?? "—"}
                </div>
              </CardContent>
            </Card>
          );
          return card.href ? (
            <Link key={card.title} href={card.href}>
              {content}
            </Link>
          ) : (
            <div key={card.title}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
