"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PricingTier, SubscriptionTier } from "@/types";

interface PricingTableProps {
  tiers: PricingTier[];
  currencies: Array<{ code: string; symbol: string; name: string }>;
  currentTier?: SubscriptionTier;
  onSelectTier: (tier: SubscriptionTier, currency: string) => void;
  isLoading?: boolean;
}

export function PricingTable({
  tiers,
  currencies,
  currentTier = "free",
  onSelectTier,
  isLoading = false,
}: PricingTableProps) {
  const [selectedCurrency, setSelectedCurrency] = useState(() => {
    // Default based on locale or first available
    if (typeof navigator !== "undefined") {
      const lang = navigator.language;
      if (lang.includes("NG") || lang.includes("ng")) return "NGN";
      if (lang.includes("GH") || lang.includes("gh")) return "GHS";
    }
    return "USD";
  });

  const getCurrencySymbol = (code: string) => {
    const currency = currencies.find((c) => c.code === code);
    return currency?.symbol || "$";
  };

  const formatPrice = (cents: number, currency: string) => {
    if (cents <= 0) return cents === 0 ? "Free" : "Contact Sales";
    const amount = cents / 100;
    const symbol = getCurrencySymbol(currency);
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
      {/* Currency Selector */}
      <div className="flex justify-center">
        <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select currency" />
          </SelectTrigger>
          <SelectContent>
            {currencies.map((currency) => (
              <SelectItem key={currency.code} value={currency.code}>
                {currency.symbol} {currency.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => {
          const isCurrentTier = tier.tier === currentTier;
          const price =
            tier.prices[selectedCurrency] || tier.prices["USD"] || 0;
          const isEnterprise = tier.tier === "enterprise";
          const isUpgrade =
            !isCurrentTier && tierOrder(tier.tier) > tierOrder(currentTier);

          return (
            <Card
              key={tier.tier}
              className={cn(
                "relative flex flex-col",
                tier.tier === "pro" && "border-primary shadow-lg",
                isCurrentTier && "ring-2 ring-primary"
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
                    {formatPrice(price, selectedCurrency)}
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
                  onClick={() => onSelectTier(tier.tier, selectedCurrency)}
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
