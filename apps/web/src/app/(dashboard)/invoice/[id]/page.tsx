"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api-client";
import type { Invoice } from "@/types";

function getStatusBadge(status: Invoice["status"]) {
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
}

function formatAmount(cents: number, currency: string): string {
  const amount = (cents / 100).toFixed(2);
  return `${currency} ${amount}`;
}

function InvoicePageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl py-8 space-y-6">
      <Skeleton className="h-8 w-32" />
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-8 w-40 ml-auto" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function InvoicePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const invoiceId = params.id;

  const { data: invoice, isLoading, isError, error } = useQuery<Invoice>({
    queryKey: ["invoice", invoiceId],
    queryFn: () => api.get<Invoice>(`/billing/invoices/${invoiceId}`),
    enabled: !!invoiceId,
    retry: (failureCount, err: any) => {
      // Don't retry on 403/404
      if (err?.status === 403 || err?.status === 404) return false;
      return failureCount < 2;
    },
  });

  const handleDownloadPDF = () => {
    window.print();
  };

  if (isLoading) {
    return <InvoicePageSkeleton />;
  }

  if (isError) {
    const status = (error as any)?.status;
    return (
      <div className="mx-auto max-w-3xl py-8">
        <Button variant="ghost" onClick={() => router.back()} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <FileText className="h-12 w-12 text-muted-foreground" />
            <div className="text-center space-y-2">
              <p className="text-lg font-medium">
                {status === 403
                  ? "Access Denied"
                  : status === 404
                    ? "Invoice Not Found"
                    : "Failed to Load Invoice"}
              </p>
              <p className="text-sm text-muted-foreground">
                {status === 403
                  ? "You don't have permission to view this invoice."
                  : status === 404
                    ? "This invoice doesn't exist or has been removed."
                    : "An error occurred while loading the invoice. Please try again."}
              </p>
            </div>
            <Button variant="outline" onClick={() => router.push("/billing")}>
              Return to Billing
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invoice) return null;

  const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
  const subtotal = lineItems.reduce(
    (sum, item) => sum + item.amount * item.quantity,
    0
  );
  // Total from invoice as source of truth; tax = total - subtotal if any
  const totalCents = invoice.amountCents;
  const taxCents = Math.max(0, totalCents - subtotal);

  return (
    <>
      {/* Print-only header */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      <div className="mx-auto max-w-3xl py-8 space-y-6">
        {/* Navigation & actions */}
        <div className="flex items-center justify-between no-print">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>

        {/* Invoice card */}
        <Card>
          {/* Header */}
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Invoice
              </CardTitle>
              <p className="text-sm font-mono text-muted-foreground">
                #{invoice.reference}
              </p>
            </div>
            <div className="text-right space-y-1">
              {getStatusBadge(invoice.status)}
              <p className="text-xs text-muted-foreground mt-2">
                Issued:{" "}
                {new Date(invoice.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              {invoice.paidAt && (
                <p className="text-xs text-muted-foreground">
                  Paid:{" "}
                  {new Date(invoice.paidAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Line items table */}
            {lineItems.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50%]">Description</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatAmount(item.amount, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatAmount(
                          item.amount * item.quantity,
                          invoice.currency
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="rounded-md border p-4 text-sm text-muted-foreground text-center">
                No line items
              </div>
            )}

            <Separator />

            {/* Totals */}
            <div className="space-y-2 text-sm ml-auto w-full max-w-xs">
              {lineItems.length > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>{formatAmount(subtotal, invoice.currency)}</span>
                </div>
              )}
              {taxCents > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span>{formatAmount(taxCents, invoice.currency)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold text-base">
                <span>Total</span>
                <span>{formatAmount(totalCents, invoice.currency)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
