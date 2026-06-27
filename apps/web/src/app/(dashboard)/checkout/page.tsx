"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Check, Loader2, CreditCard } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { BillingContextResponse, SubscriptionTier } from "@/types";

function formatPrice(cents: number, currency: string): string {
  const symbol = currency === "NGN" ? "₦" : "$";
  return `${symbol}${(cents / 100).toLocaleString()}`;
}

function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [billingData, setBillingData] = useState<BillingContextResponse | null>(
    null,
  );
  const [selectedTier, setSelectedTier] = useState<string>(
    searchParams.get("tier") || "starter",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadBillingContext();
  }, []);

  const loadBillingContext = async () => {
    try {
      const data = await api.get<BillingContextResponse>("/billing/context");
      setBillingData(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load billing information",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const billingContext = billingData?.context;
  const currency = billingContext?.currency ?? "USD";
  const providerLabel = billingContext?.paymentLabel ?? "Polar";

  const handleCheckout = async () => {
    if (selectedTier === "enterprise") {
      window.open(
        "mailto:sales@logstack.io?subject=Enterprise Inquiry",
        "_blank",
      );
      return;
    }

    try {
      setIsProcessing(true);
      const response = await api.post<{ authorizationUrl: string }>(
        "/billing/initialize",
        {
          tier: selectedTier,
          currency,
          callbackUrl: `${window.location.origin}/billing?success=true`,
        },
      );

      window.location.href = response.authorizationUrl;
    } catch (error) {
      console.error("Failed to initialize payment:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to process checkout. Please try again or contact support.";
      toast({
        title: "Payment Initialization Failed",
        description: message,
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedTierData = billingData?.tiers.find(
    (t) => t.tier === selectedTier,
  );
  const priceCents = selectedTierData?.prices[currency] ?? 0;

  return (
    <div className="container max-w-5xl py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Complete Your Subscription
        </h1>
        <p className="text-muted-foreground text-lg">
          {currency} billing via {providerLabel}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Your Plan</CardTitle>
              <CardDescription>
                Choose the plan that best fits your needs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {billingData?.tiers
                .filter((tier) => tier.tier !== "free")
                .map((tier) => (
                  <div
                    key={tier.tier}
                    className={cn(
                      "relative rounded-lg border-2 p-6 cursor-pointer transition-all",
                      selectedTier === tier.tier
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50",
                    )}
                    onClick={() => setSelectedTier(tier.tier)}
                  >
                    {tier.tier === "pro" && (
                      <Badge className="absolute -top-3 left-6">Popular</Badge>
                    )}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">{tier.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {tier.description}
                        </p>
                        <div className="mt-4 space-y-2">
                          {tier.features.slice(0, 4).map((feature, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-sm"
                            >
                              <Check className="h-4 w-4 text-primary" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">
                          {tier.tier === "enterprise"
                            ? "Custom"
                            : formatPrice(
                                tier.prices[currency] ?? 0,
                                currency,
                              )}
                        </div>
                        {tier.tier !== "enterprise" && (
                          <div className="text-sm text-muted-foreground">
                            /month
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-8">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium">{selectedTierData?.name}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Billing</span>
                  <span className="font-medium">Monthly</span>
                </div>
                <div className="flex justify-between text-sm mb-4">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="font-medium">{providerLabel}</span>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>
                      {selectedTier === "enterprise" ? (
                        "Contact Sales"
                      ) : (
                        <>
                          {formatPrice(priceCents, currency)}
                          <span className="text-sm font-normal text-muted-foreground">
                            /month
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <h4 className="font-semibold text-sm">Plan Includes:</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• {selectedTierData?.limits.logs} logs/month</li>
                  <li>• {selectedTierData?.limits.retention} retention</li>
                  <li>• {selectedTierData?.limits.projects} projects</li>
                </ul>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleCheckout}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    {selectedTier === "enterprise"
                      ? "Contact Sales"
                      : "Proceed to Payment"}
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Secure payment powered by {providerLabel}. Cancel anytime.
              </p>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => router.push("/billing")}
              >
                Back to Billing
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
}