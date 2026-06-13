"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PricingTable } from "@/components/billing/pricing-table";
import { Button } from "@/components/ui/button";
import type { PricingResponse, SubscriptionTier } from "@/types";
import { logstack } from "@/lib/logger";
// Default pricing data for public page (fetched from API if possible)
const defaultPricing: PricingResponse = {
  tiers: [
    {
      tier: "free",
      name: "Free",
      description: "Perfect for personal projects and getting started",
      logLimit: 100000,
      features: [
        "100,000 logs per month",
        "7-day log retention",
        "1 project",
        "Email alerts",
        "Community support",
      ],
      prices: { USD: 0, NGN: 0, GHS: 0 },
      limits: {
        logs: "",
        retention: "",
        projects: "",
      },
    },
    {
      tier: "starter",
      name: "Starter",
      description: "For small teams and growing applications",
      logLimit: 1000000,
      features: [
        "1,000,000 logs per month",
        "30-day log retention",
        "5 projects",
        "Email & Slack alerts",
        "Priority support",
        "API access",
      ],
      prices: { USD: 1900, NGN: 15000, GHS: 150 },
      limits: {
        logs: "",
        retention: "",
        projects: "",
      },
    },
    {
      tier: "pro",
      name: "Pro",
      description: "For larger teams with advanced needs",
      logLimit: 10000000,
      features: [
        "10,000,000 logs per month",
        "90-day log retention",
        "Unlimited projects",
        "All alert channels",
        "Custom dashboards",
        "Team collaboration",
        "Priority support",
      ],
      prices: { USD: 7900, NGN: 60000, GHS: 600 },
      limits: {
        logs: "",
        retention: "",
        projects: "",
      },
    },
    {
      tier: "enterprise",
      name: "Enterprise",
      description: "Custom solutions for large organizations",
      logLimit: -1,
      features: [
        "Unlimited logs",
        "Custom retention",
        "Unlimited projects",
        "SSO & SAML",
        "Dedicated support",
        "SLA guarantee",
        "On-premise option",
      ],
      prices: { USD: -1, NGN: -1, GHS: -1 },
      limits: {
        logs: "",
        retention: "",
        projects: "",
      },
    },
  ],
  currencies: [
    { code: "USD", symbol: "$", name: "US Dollar" },
    { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
    { code: "GHS", symbol: "GH₵", name: "Ghanaian Cedi" },
  ],
};

export default function PricingPage() {
  const [pricing, setPricing] = useState<PricingResponse>(defaultPricing);

  useEffect(() => {
    // Try to fetch pricing from API for latest data
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/v1"}/billing/pricing`,
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.tiers) {
          setPricing(data);
        }
      })
      .catch(() => {
        // Use default pricing if API fails
      });
  }, []);

  const handleSelectTier = (tier: SubscriptionTier, currency: string) => {
    if (tier === "enterprise") {
      window.open(
        "mailto:sales@logstack.io?subject=Enterprise Inquiry",
        "_blank",
      );
      return;
    }
    // Redirect to signup/login with plan selection
    logstack.info("User selected tier", { tier, currency });
    window.location.href = `/auth/signup?plan=${tier}&currency=${currency}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="font-bold text-xl">LogStack</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/auth/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start free and scale as you grow. No hidden fees, no surprises. Pay
            only for what you use.
          </p>
        </div>
      </section>

      {/* Pricing Table */}
      <section className="pb-16">
        <div className="container mx-auto px-4">
          <PricingTable
            tiers={pricing.tiers}
            currencies={pricing.currencies}
            onSelectTier={handleSelectTier}
          />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-2xl font-bold mb-8 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">What counts as a log?</h3>
              <p className="text-muted-foreground">
                A log is any single log entry sent to LogStack through our SDK or
                API. Each log message, regardless of size, counts as one log.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">
                What happens if I exceed my limit?
              </h3>
              <p className="text-muted-foreground">
                If you exceed your monthly log limit, new log ingestion will be
                paused until the next billing cycle or until you upgrade your
                plan. Existing logs remain accessible.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">
                Can I change plans at any time?
              </h3>
              <p className="text-muted-foreground">
                Yes! You can upgrade or downgrade your plan at any time.
                Upgrades take effect immediately, while downgrades take effect
                at the end of your current billing period.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">
                Which payment methods do you accept?
              </h3>
              <p className="text-muted-foreground">
                We accept all major credit cards, bank transfers, and mobile
                money (for supported currencies) through our payment partner
                Paystack.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© {new Date().getFullYear()} LogStack. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
