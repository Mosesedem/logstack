"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PricingTable } from "@/components/billing/pricing-table";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/marketing/Navbar";
import type {
  BillingContext,
  PricingResponse,
  SubscriptionTier,
} from "@/types";

const NIGERIA_CONTEXT: BillingContext = {
  provider: "paystack",
  currency: "NGN",
  country: "NG",
  isNigeria: true,
  paymentLabel: "Paystack",
};

const INTERNATIONAL_CONTEXT: BillingContext = {
  provider: "polar",
  currency: "USD",
  country: "",
  isNigeria: false,
  paymentLabel: "Polar",
};

export default function PricingPage() {
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [region, setRegion] = useState<"nigeria" | "international">(
    "international",
  );

  useEffect(() => {
    const defaultRegion =
      typeof navigator !== "undefined" &&
      (navigator.language.toUpperCase().includes("NG") ||
        Intl.DateTimeFormat().resolvedOptions().timeZone === "Africa/Lagos")
        ? "nigeria"
        : "international";
    setRegion(defaultRegion);

    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/v1"}/billing/pricing`,
    )
      .then((res) => res.json())
      .then((data: PricingResponse) => {
        if (data.tiers) setPricing(data);
      })
      .catch(() => {
        // API unavailable — pricing table won't render without tiers
      });
  }, []);

  const billingContext =
    region === "nigeria" ? NIGERIA_CONTEXT : INTERNATIONAL_CONTEXT;

  const displayTiers =
    pricing?.tiers.map((tier) => ({
      ...tier,
      prices: {
        [billingContext.currency]:
          tier.prices[billingContext.currency] ?? tier.prices["USD"] ?? 0,
      },
    })) ?? [];

  const handleSelectTier = (tier: SubscriptionTier, currency: string) => {
    if (tier === "enterprise") {
      window.open(
        "mailto:sales@logstack.io?subject=Enterprise Inquiry",
        "_blank",
      );
      return;
    }
    window.location.href = `/signup?plan=${tier}&currency=${currency}`;
  };

  return (
    <div className="relative min-h-screen bg-black text-white">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <Navbar />

      <div className="relative z-10 container mx-auto px-4 pt-28 pb-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <section className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Start free and scale as you grow. Nigerian customers pay in NGN via
            Paystack; everyone else pays in USD via Polar.
          </p>

          <div className="flex justify-center gap-2 mt-8">
            <Button
              variant={region === "international" ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setRegion("international")}
            >
              International (USD)
            </Button>
            <Button
              variant={region === "nigeria" ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setRegion("nigeria")}
            >
              Nigeria (NGN)
            </Button>
          </div>
        </section>

        {displayTiers.length > 0 ? (
          <PricingTable
            tiers={displayTiers}
            billingContext={billingContext}
            onSelectTier={handleSelectTier}
          />
        ) : (
          <p className="text-center text-zinc-500">Loading pricing...</p>
        )}

        <section className="mt-20 max-w-3xl mx-auto space-y-6">
          <h2 className="text-2xl font-bold text-center mb-8">FAQ</h2>
          <div>
            <h3 className="font-semibold mb-2">What counts as a log?</h3>
            <p className="text-zinc-400">
              A log is any single log entry sent to Logstack through our SDK or
              API. Each log message counts as one log.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">
              Which payment methods do you accept?
            </h3>
            <p className="text-zinc-400">
              Nigerian customers pay in NGN through Paystack (cards, bank
              transfer, USSD). International customers pay in USD through Polar
              (credit cards globally, with tax handled as Merchant of Record).
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}