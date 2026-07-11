"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BillingContext, PricingTier, SubscriptionTier } from "@/types";

interface PricingTableProps {
  tiers: PricingTier[];
  billingContext?: BillingContext;
  currentTier?: SubscriptionTier;
  onSelectTier: (tier: SubscriptionTier, currency: string) => void;
  isLoading?: boolean;
}

export function PricingTable({
  tiers,
  billingContext,
  currentTier = "free",
  onSelectTier,
  isLoading = false,
}: PricingTableProps) {
  const currency = billingContext?.currency ?? "USD";
  const providerLabel = billingContext?.paymentLabel ?? "Polar";

  const getCurrencySymbol = (code: string) => {
    if (code === "NGN") return "₦";
    return "$";
  };

  const formatPrice = (cents: number, code: string) => {
    if (cents <= 0) return cents === 0 ? "Free" : "Contact Sales";
    const amount = cents / 100;
    const symbol = getCurrencySymbol(code);
    return `${symbol}${amount.toLocaleString()}/mo`;
  };

  const formatLogLimit = (limit: number) => {
    if (limit < 0) return "Unlimited";
    if (limit >= 1_000_000) return `${limit / 1_000_000}M`;
    if (limit >= 1_000) return `${limit / 1_000}K`;
    return limit.toString();
  };

  return (
    <div className="space-y-6">
      {billingContext && (
        <p className="text-center text-sm text-muted-foreground">
          {billingContext.countryRequired ? (
            <>
              Set your billing country above before upgrading — that chooses{" "}
              <span className="font-medium text-foreground">NGN / Paystack</span>{" "}
              or{" "}
              <span className="font-medium text-foreground">USD / Polar</span>.
            </>
          ) : (
            <>
              Billing in{" "}
              <span className="font-medium text-foreground">{currency}</span> via{" "}
              <span className="font-medium text-foreground">{providerLabel}</span>
              {billingContext.isNigeria
                ? " — Nigerian customers"
                : " — international customers"}
            </>
          )}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => {
          const isCurrentTier = tier.tier === currentTier;
          const price = tier.prices[currency] ?? tier.prices["USD"] ?? 0;
          const isEnterprise = tier.tier === "enterprise";
          const isUpgrade =
            !isCurrentTier && tierOrder(tier.tier) > tierOrder(currentTier);

          return (
            <Card
              key={tier.tier}
              className={cn(
                "relative flex flex-col",
                tier.tier === "pro" && "border-primary shadow-lg",
                isCurrentTier && "ring-2 ring-primary",
              )}
            >
              {tier.tier === "pro" && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              {isCurrentTier && (
                <div className="absolute -top-3 right-4">
                  <span className="bg-green-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                    Current Plan
                  </span>
                </div>
              )}

              <CardHeader className="text-center">
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription className="text-sm">
                  {tier.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 space-y-4">
                <div className="text-center">
                  <span className="text-3xl font-bold">
                    {formatPrice(price, currency)}
                  </span>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatLogLimit(tier.logLimit)} logs/month
                  </p>
                </div>

                <ul className="space-y-2">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={tier.tier === "pro" ? "default" : "outline"}
                  disabled={isLoading || isCurrentTier || tier.tier === "free"}
                  onClick={() => onSelectTier(tier.tier, currency)}
                >
                  {isCurrentTier
                    ? "Current Plan"
                    : isEnterprise
                      ? "Contact Sales"
                      : isUpgrade
                        ? "Upgrade"
                        : tier.tier === "free"
                          ? "Free Tier"
                          : "Select Plan"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function tierOrder(tier: SubscriptionTier): number {
  const order: Record<SubscriptionTier, number> = {
    free: 0,
    starter: 1,
    pro: 2,
    enterprise: 3,
  };
  return order[tier] || 0;
}