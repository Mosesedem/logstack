"use client";

import { useEffect, useState, useCallback } from "react";
import { CreditCard, TrendingUp, AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { TransactionHistory } from "@/components/billing/transaction-history";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import type {
  Subscription,
  UsageSummary,
  PricingResponse,
  SubscriptionTier,
  Transaction,
} from "@/types";

export default function BillingPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  const loadBillingData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Load critical data first
      const [subResult, pricingResult] = await Promise.allSettled([
        api.get<Subscription>("/billing/subscription"),
        api.get<PricingResponse>("/billing/pricing"),
      ]);

      // Load non-critical data separately
      const [usageResult, txResult] = await Promise.allSettled([
        api.get<UsageSummary>("/billing/usage"),
        api.get<{ transactions: Transaction[] }>("/billing/transactions"),
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

      // Handle Usage (Non-critical blocking, but good to have)
      if (usageResult.status === "fulfilled") {
        setUsage(usageResult.value);
      } else {
        console.warn("Failed to load usage data:", usageResult.reason);
      }

      // Handle Transactions (Non-critical)
      if (txResult.status === "fulfilled") {
        setTransactions(txResult.value.transactions || []);
      } else {
        console.warn("Failed to load transactions:", txResult.reason);
        // Don't show error toast for transactions failure to avoid noise
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
            <TransactionHistory transactions={transactions} />
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
