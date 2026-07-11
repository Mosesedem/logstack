"use client";

import { useEffect, useState } from "react";
import { Globe2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BillingContext } from "@/types";

export const BILLING_COUNTRIES = [
  { code: "NG", name: "Nigeria", currency: "NGN", provider: "Paystack" },
  { code: "US", name: "United States", currency: "USD", provider: "Polar" },
  { code: "GB", name: "United Kingdom", currency: "USD", provider: "Polar" },
  { code: "CA", name: "Canada", currency: "USD", provider: "Polar" },
  { code: "DE", name: "Germany", currency: "USD", provider: "Polar" },
  { code: "FR", name: "France", currency: "USD", provider: "Polar" },
  { code: "IN", name: "India", currency: "USD", provider: "Polar" },
  { code: "AU", name: "Australia", currency: "USD", provider: "Polar" },
  { code: "GH", name: "Ghana", currency: "USD", provider: "Polar" },
  { code: "KE", name: "Kenya", currency: "USD", provider: "Polar" },
  { code: "ZA", name: "South Africa", currency: "USD", provider: "Polar" },
] as const;

function previewForCountry(code: string) {
  const row = BILLING_COUNTRIES.find((c) => c.code === code);
  if (!row) {
    return { currency: "USD", provider: "Polar" };
  }
  return { currency: row.currency, provider: row.provider };
}

interface BillingRegionCardProps {
  billingContext?: BillingContext | null;
  initialCountry?: string;
  onSave: (country: string) => Promise<void>;
  isSaving?: boolean;
}

export function BillingRegionCard({
  billingContext,
  initialCountry = "",
  onSave,
  isSaving = false,
}: BillingRegionCardProps) {
  const [country, setCountry] = useState(
    initialCountry || billingContext?.country || "",
  );

  useEffect(() => {
    const next = initialCountry || billingContext?.country || "";
    if (next) setCountry(next);
  }, [initialCountry, billingContext?.country]);

  const preview = country
    ? previewForCountry(country)
    : {
        currency: billingContext?.currency ?? "—",
        provider: billingContext?.paymentLabel ?? "—",
      };
  const needsCountry =
    billingContext?.countryRequired ||
    !billingContext?.country ||
    !country;

  return (
    <Card className={needsCountry ? "border-amber-500/50" : undefined}>
      <CardHeader>
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Globe2 className="h-4 w-4" />
          Billing country & currency
        </CardTitle>
        <CardDescription>
          We charge in the currency for your country. Nigeria uses{" "}
          <strong>NGN via Paystack</strong>; all other countries use{" "}
          <strong>USD via Polar</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {needsCountry && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Select your country before upgrading — this chooses NGN (Paystack) or
            USD (Polar).
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="billing-country">Country</Label>
            <Select value={country || undefined} onValueChange={setCountry}>
              <SelectTrigger id="billing-country">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {BILLING_COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name} · {c.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => onSave(country)}
            disabled={!country || isSaving}
          >
            {isSaving ? "Saving…" : "Save region"}
          </Button>
        </div>
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          You will be billed in{" "}
          <span className="font-medium text-foreground">{preview.currency}</span>{" "}
          via{" "}
          <span className="font-medium text-foreground">{preview.provider}</span>
          {country === "NG"
            ? " (cards, bank transfer, USSD)."
            : " (international checkout)."}
        </div>
      </CardContent>
    </Card>
  );
}
