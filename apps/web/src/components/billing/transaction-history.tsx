"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Transaction } from "@/types";

interface TransactionHistoryProps {
  transactions: Transaction[];
}

export function TransactionHistory({ transactions }: TransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            Your payment history will appear here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No transactions yet
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatAmount = (amount: number, currency: string) => {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    });
    return formatter.format(amount / 100);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge variant="default" className="bg-green-500">
            Success
          </Badge>
        );
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>Your recent payments</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between py-3 border-b last:border-0"
            >
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {formatAmount(tx.amount, tx.currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tx.paidAt
                    ? formatDistanceToNow(new Date(tx.paidAt), {
                        addSuffix: true,
                      })
                    : "Pending"}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  via {tx.channel}
                </p>
              </div>
              <div className="text-right space-y-1">
                {getStatusBadge(tx.status)}
                <p className="text-xs text-muted-foreground">{tx.reference}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
