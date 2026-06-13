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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface PricingTier {
  tier: string;
  name: string;
  description: string;
  prices: {
    USD: number;
    NGN: number;
    GHS: number;
  };
  features: string[];
  limits: {
    logs: string;
    retention: string;
    projects: string;
  };
}

interface PricingResponse {
  tiers: PricingTier[];
  currencies: Array<{
    code: string;
    symbol: string;
    name: string;
  }>;
}

function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>(
    searchParams.get("tier") || "starter",
  );
  const [selectedCurrency, setSelectedCurrency] = useState<string>(
    searchParams.get("currency") || "USD",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    try {
      const data = await api.get<PricingResponse>("/billing/pricing");
      setPricing(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load pricing information",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
          currency: selectedCurrency,
          callbackUrl: `${window.location.origin}/dashboard/billing?success=true`,
        },
      );

      // Redirect to Paystack checkout
      window.location.href = response.authorizationUrl;
    } catch (error: any) {
      console.error("Failed to initialize payment:", error);

      // Check if it's a service unavailable error (503)
      if (error?.response?.status === 503) {
        toast({
          title: "Payment Service Unavailable",
          description:
            "Payment processing is currently not available. Please contact support at support@logstack.io or try again later.",
          variant: "destructive",
          duration: 10000,
        });
      } else {
        toast({
          title: "Payment Initialization Failed",
          description:
            error?.response?.data?.error ||
            "Failed to process checkout. Please try again or contact support.",
          variant: "destructive",
        });
      }
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

  const selectedTierData = pricing?.tiers.find((t) => t.tier === selectedTier);
  const currencySymbol =
    pricing?.currencies.find((c) => c.code === selectedCurrency)?.symbol || "$";
  const price =
    selectedTierData?.prices[
      selectedCurrency as keyof typeof selectedTierData.prices
    ] || 0;

  return (
    <div className="container max-w-5xl py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Complete Your Subscription
        </h1>
        <p className="text-muted-foreground text-lg">
          Choose your plan and complete payment
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Plan Selection */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Your Plan</CardTitle>
              <CardDescription>
                Choose the plan that best fits your needs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pricing?.tiers
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
                          {tier.tier === "enterprise" ? (
                            "Custom"
                          ) : (
                            <>
                              {currencySymbol}
                              {
                                tier.prices[
                                  selectedCurrency as keyof typeof tier.prices
                                ]
                              }
                            </>
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

          {/* Currency Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Currency</CardTitle>
              <CardDescription>
                Choose your preferred payment currency
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedCurrency}
                onValueChange={setSelectedCurrency}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pricing?.currencies.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.symbol} {currency.name} ({currency.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
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
                  <span className="text-muted-foreground">Currency</span>
                  <span className="font-medium">{selectedCurrency}</span>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>
                      {selectedTier === "enterprise" ? (
                        "Contact Sales"
                      ) : (
                        <>
                          {currencySymbol}
                          {price}
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
                Secure payment powered by Paystack. Cancel anytime.
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
