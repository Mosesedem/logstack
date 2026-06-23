"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileText, ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PricingTable } from "@/components/billing/pricing-table";
import { UsageProgressBar } from "@/components/billing/usage-progress-bar";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import type {
  Subscription,
  UsageSummary,
  PricingResponse,
  SubscriptionTier,
  Invoice,
} from "@/types";

export default function BillingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  // Invoice list via TanStack Query
  const {
    data: invoicesData,
    isLoading: invoicesLoading,
  } = useQuery({
    queryKey: ["invoices"],
    queryFn: () =>
      api.get<{ invoices: Invoice[]; total: number; page: number }>(
        "/billing/invoices"
      ),
  });

  const invoices = invoicesData?.invoices ?? [];

  const loadBillingData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Load critical data first
      const [subResult, pricingResult] = await Promise.allSettled([
        api.get<Subscription>("/billing/subscription"),
        api.get<PricingResponse>("/billing/pricing"),
      ]);

      // Load usage separately (non-critical)
      const usageResult = await Promise.allSettled([
        api.get<UsageSummary>("/billing/usage"),
      ]);

      // Handle Subscription
      if (subResult.status === "fulfilled") {
        setSubscription(subResult.value);
      } else {
        console.error("Failed to load subscription:", subResult.reason);
        toast({
          title: "Error",
          description: "Failed to load subscription details. Please refresh.",
          variant: "destructive",
        });
      }

      // Handle Pricing
      if (pricingResult.status === "fulfilled") {
        setPricing(pricingResult.value);
      }

      // Handle Usage (non-critical)
      if (usageResult[0].status === "fulfilled") {
        setUsage(usageResult[0].value);
      } else {
        console.warn("Failed to load usage data:", usageResult[0].reason);
      }
    } catch (error) {
      console.error("Unexpected error loading billing data:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  const handleSelectTier = async (tier: SubscriptionTier, currency: string) => {
    if (tier === "enterprise") {
      window.open(
        "mailto:sales@logstack.io?subject=Enterprise Inquiry",
        "_blank",
      );
      return;
    }

    try {
      setIsInitializing(true);
      const response = await api.post<{ authorizationUrl: string }>(
        "/billing/initialize",
        {
          tier,
          currency,
          callbackUrl: `${window.location.origin}/dashboard/billing?success=true`,
        },
      );

      // Redirect to Paystack
      window.location.href = response.authorizationUrl;
    } catch (error) {
      console.error("Failed to initialize payment:", error);
      toast({
        title: "Error",
        description: "Failed to initialize payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleCancelSubscription = async () => {
    try {
      await api.post("/billing/cancel", {});
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription has been cancelled.",
      });
      loadBillingData();
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
      toast({
        title: "Error",
        description: "Failed to cancel subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCancelDialogOpen(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Active</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>;
      case "past_due":
        return <Badge variant="destructive">Past Due</Badge>;
      case "trialing":
        return <Badge className="bg-blue-500">Trial</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getInvoiceStatusBadge = (status: Invoice["status"]) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500 text-white">Paid</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500 text-white">Pending</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatInvoiceAmount = (amountCents: number, currency: string) => {
    const amount = (amountCents / 100).toFixed(2);
    return `${currency} ${amount}`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid gap-8">
            <div className="h-48 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl py-8 space-y-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Billing
        </h1>
        <p className="text-muted-foreground">
          Manage your subscription, billing details, and view invoices.
        </p>
      </div>

      <div className="grid gap-8">
        {/* Usage Section */}
        <div className="grid gap-4">
          <h2 className="text-xl font-medium">Usage</h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">
                Log Ingestion
              </CardTitle>
              <CardDescription>
                Your detailed usage for the current billing cycle.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {usage && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {usage.totalLogCount.toLocaleString()} /{" "}
                      {usage.logLimit === -1
                        ? "Unlimited"
                        : usage.logLimit.toLocaleString()}{" "}
                      events
                    </span>
                    <span className="font-medium">
                      {usage.usagePercentage.toFixed(1)}%
                    </span>
                  </div>
                  <UsageProgressBar
                    current={usage.totalLogCount}
                    limit={usage.logLimit}
                  />
                  {usage.isOverLimit && (
                    <p className="text-sm text-red-500 flex items-center gap-2 mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      You have exceeded your usage limit. Upgrade to maintain
                      service.
                    </p>
                  )}
                </div>
              )}
              {!usage && (
                <div className="text-sm text-muted-foreground">
                  Loading usage data...
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Plan Section */}
        <div className="grid gap-4">
          <h2 className="text-xl font-medium">Plan</h2>
          <Card className="flex flex-col md:flex-row md:items-center justify-between p-6 gap-6">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold capitalize">
                  {subscription?.tier || "Free"} Plan
                </h3>
                {getStatusBadge(subscription?.status || "active")}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {subscription?.periodEnd
                  ? `Renews on ${new Date(
                      subscription.periodEnd,
                    ).toLocaleDateString()}`
                  : "Get started with our free tier."}
              </p>
            </div>
            <div className="flex gap-3">
              {subscription?.tier !== "enterprise" && (
                <Button
                  variant="outline"
                  onClick={() =>
                    document
                      .getElementById("pricing-grid")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Change Plan
                </Button>
              )}
              {subscription?.status === "active" &&
                subscription.tier !== "free" && (
                  <Button
                    variant="ghost"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setIsCancelDialogOpen(true)}
                  >
                    Cancel Subscription
                  </Button>
                )}
            </div>
          </Card>

          {/* Pricing Table */}
          <div id="pricing-grid">
            {pricing && (
              <Card>
                <CardHeader>
                  <CardTitle>Available Plans</CardTitle>
                  <CardDescription>
                    Upgrade to unlock more features and higher limits.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PricingTable
                    tiers={pricing.tiers}
                    currencies={pricing.currencies}
                    currentTier={subscription?.tier}
                    onSelectTier={handleSelectTier}
                    isLoading={isInitializing}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Invoices Section */}
        <div className="grid gap-4">
          <h2 className="text-xl font-medium">Invoices</h2>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Invoice History
              </CardTitle>
              <CardDescription>
                Your billing invoices. Click a row to view details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-3 border-b last:border-0"
                    >
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-5 w-14 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No invoices yet
                </p>
              ) : (
                <div className="space-y-1">
                  {invoices.map((invoice) => (
                    <button
                      key={invoice.id}
                      type="button"
                      onClick={() => router.push(`/invoice/${invoice.id}`)}
                      className="w-full flex items-center justify-between py-3 px-2 rounded-md border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer text-left"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium font-mono">
                          {invoice.reference}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(invoice.createdAt).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">
                          {formatInvoiceAmount(
                            invoice.amountCents,
                            invoice.currency
                          )}
                        </span>
                        {getInvoiceStatusBadge(invoice.status)}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cancel Subscription Confirmation Dialog */}
      <AlertDialog
        open={isCancelDialogOpen}
        onOpenChange={setIsCancelDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your subscription? You will lose
              access to premium features at the end of your billing period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              className="bg-red-500 hover:bg-red-600"
            >
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
