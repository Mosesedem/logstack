"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, FileText, ChevronRight, CreditCard } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BillingPageSkeleton, TableSkeleton } from "@/components/loading";
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
import { BillingRegionCard } from "@/components/billing/billing-region-card";
import { UsageProgressBar } from "@/components/billing/usage-progress-bar";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import type {
  Subscription,
  UsageSummary,
  BillingContext,
  BillingContextResponse,
  PricingResponse,
  SubscriptionTier,
  Invoice,
  User,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/v1";

const DEFAULT_BILLING_CONTEXT: BillingContext = {
  provider: "polar",
  currency: "USD",
  country: "",
  isNigeria: false,
  paymentLabel: "Polar",
};

async function loadPublicPricing(): Promise<BillingContextResponse> {
  const response = await fetch(`${API_URL}/billing/pricing`);
  if (!response.ok) {
    throw new Error("Failed to load pricing");
  }
  const data = (await response.json()) as PricingResponse;
  return {
    context: DEFAULT_BILLING_CONTEXT,
    tiers: data.tiers,
  };
}

function scrollToElementInMain(element: HTMLElement | null) {
  if (!element) return;
  const main = element.closest("main");
  if (main) {
    const top =
      element.getBoundingClientRect().top -
      main.getBoundingClientRect().top +
      main.scrollTop;
    main.scrollTo({ top: Math.max(0, top - 16), behavior: "smooth" });
    return;
  }
  element.scrollIntoView({ behavior: "smooth", block: "start" });
}

function BillingPageContent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [billingContextData, setBillingContextData] =
    useState<BillingContextResponse | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSavingRegion, setIsSavingRegion] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [pricingLoadError, setPricingLoadError] = useState(false);
  const [profileCountry, setProfileCountry] = useState("");
  const pricingRef = useRef<HTMLDivElement>(null);

  const {
    data: invoicesData,
    isLoading: invoicesLoading,
  } = useQuery({
    queryKey: ["invoices"],
    queryFn: () =>
      api.get<{ invoices: Invoice[]; total: number; page: number }>(
        "/billing/invoices",
      ),
  });

  const invoices = invoicesData?.invoices ?? [];
  const billingContext = billingContextData?.context;
  const pricingTiers = billingContextData?.tiers ?? [];

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({
        title: "Payment successful",
        description: "Your subscription is being activated. This may take a moment.",
      });
    }
  }, [searchParams, toast]);

  const loadBillingData = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setIsLoading(true);
      }

      const [subResult, contextResult, profileResult] = await Promise.allSettled([
        api.get<Subscription>("/billing/subscription"),
        api.get<BillingContextResponse>("/billing/context"),
        api.get<User>("/users/me"),
      ]);

      const usageResult = await Promise.allSettled([
        api.get<UsageSummary>("/billing/usage"),
      ]);

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

      if (profileResult.status === "fulfilled") {
        setProfileCountry(profileResult.value.country ?? "");
      }

      if (contextResult.status === "fulfilled") {
        setBillingContextData(contextResult.value);
        setPricingLoadError(false);
        if (contextResult.value.context.country) {
          setProfileCountry(contextResult.value.context.country);
        }
      } else {
        console.error("Failed to load billing context:", contextResult.reason);
        try {
          const fallback = await loadPublicPricing();
          setBillingContextData(fallback);
          setPricingLoadError(false);
        } catch (fallbackError) {
          console.error("Failed to load public pricing:", fallbackError);
          setPricingLoadError(true);
        }
      }

      if (usageResult[0].status === "fulfilled") {
        setUsage(usageResult[0].value);
      }
    } catch (error) {
      console.error("Unexpected error loading billing data:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  }, [toast]);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  const handleChangePlan = () => {
    setPlanPickerOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToElementInMain(pricingRef.current));
    });
  };

  const handleSaveRegion = async (country: string) => {
    try {
      setIsSavingRegion(true);
      await api.put<User>("/users/me", { country });
      setProfileCountry(country);
      toast({
        title: "Billing region saved",
        description:
          country === "NG"
            ? "You'll pay in NGN via Paystack."
            : "You'll pay in USD via Polar.",
      });
      await loadBillingData({ silent: true });
    } catch (error) {
      console.error("Failed to save billing region:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save country. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingRegion(false);
    }
  };

  const handleSelectTier = async (tier: SubscriptionTier, currency: string) => {
    if (tier === "enterprise") {
      window.open(
        "mailto:sales@logstack.io?subject=Enterprise Inquiry",
        "_blank",
      );
      return;
    }

    if (billingContext?.countryRequired || !billingContext?.country) {
      toast({
        title: "Set your country first",
        description:
          "Choose your billing country above so we can charge you in NGN (Paystack) or USD (Polar).",
        variant: "destructive",
      });
      return;
    }

    const chargeCurrency = billingContext.currency || currency;

    try {
      setIsInitializing(true);
      const response = await api.post<{ authorizationUrl: string; provider: string }>(
        "/billing/initialize",
        {
          tier,
          currency: chargeCurrency,
          callbackUrl: `${window.location.origin}/billing?success=true`,
        },
      );

      if (!response.authorizationUrl) {
        throw new Error("Payment provider did not return a checkout URL");
      }
      window.location.href = response.authorizationUrl;
    } catch (error) {
      console.error("Failed to initialize payment:", error);
      toast({
        title: "Payment failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to initialize payment. Please try again.",
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
      <div className="mx-auto max-w-5xl py-8">
        <BillingPageSkeleton />
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
        {billingContext && !billingContext.countryRequired && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            <span>
              {billingContext.currency} · {billingContext.paymentLabel}
              {billingContext.isNigeria
                ? " (Nigeria)"
                : " (International)"}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-8">
        <BillingRegionCard
          billingContext={billingContext}
          initialCountry={profileCountry || billingContext?.country || ""}
          onSave={handleSaveRegion}
          isSaving={isSavingRegion}
        />

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
              {usage ? (
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
              ) : (
                <div className="text-sm text-muted-foreground">
                  Usage data unavailable
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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
                  ? `Renews on ${new Date(subscription.periodEnd).toLocaleDateString()}`
                  : "Get started with our free tier."}
              </p>
            </div>
            <div className="flex gap-3">
              {subscription?.tier !== "enterprise" && (
                <Button variant="outline" onClick={handleChangePlan}>
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

          {planPickerOpen && (
            <div id="pricing-grid" ref={pricingRef}>
              <Card>
                <CardHeader>
                  <CardTitle>Available Plans</CardTitle>
                  <CardDescription>
                    Upgrade to unlock more features and higher limits.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pricingLoadError || pricingTiers.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        Unable to load plans right now.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadBillingData({ silent: true })}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : (
                    <PricingTable
                      tiers={pricingTiers}
                      billingContext={billingContext}
                      currentTier={subscription?.tier ?? "free"}
                      onSelectTier={handleSelectTier}
                      isLoading={isInitializing}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

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
                <TableSkeleton rows={4} columns={3} className="border-0" />
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
                            },
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">
                          {formatInvoiceAmount(
                            invoice.amountCents,
                            invoice.currency,
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

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl py-8 animate-pulse h-64 bg-muted rounded" />}>
      <BillingPageContent />
    </Suspense>
  );
}