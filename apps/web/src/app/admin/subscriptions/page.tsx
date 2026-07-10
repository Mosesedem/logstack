"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AdminActions,
  AdminPageShell,
  AdminTable,
} from "@/components/admin/admin-page-shell";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete";
import { useAdminList, useAdminMutations } from "@/hooks/use-admin-list";

type Sub = {
  id: number;
  userId: number;
  tier: string;
  status: string;
  currency: string;
  amountCents: number;
  billingProvider: string;
  user?: { email?: string; name?: string };
};

type Form = {
  userId: string;
  tier: string;
  status: string;
  currency: string;
  amountCents: string;
  billingProvider: string;
};

const empty: Form = {
  userId: "",
  tier: "free",
  status: "active",
  currency: "USD",
  amountCents: "0",
  billingProvider: "none",
};

export default function AdminSubscriptionsPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const qs =
    statusFilter !== "all"
      ? `/admin/subscriptions?limit=100&status=${statusFilter}`
      : "/admin/subscriptions?limit=100";
  const { items, total, loading, reload } = useAdminList<Sub>(
    qs,
    (d) => ((d as { subscriptions?: Sub[] }).subscriptions ?? []) as Sub[],
    [statusFilter],
  );
  const { saving, run } = useAdminMutations(reload);
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState<Sub | null>(null);
  const [del, setDel] = useState<Sub | null>(null);
  const [form, setForm] = useState<Form>(empty);

  const openEdit = (s: Sub) => {
    setEdit(s);
    setForm({
      userId: String(s.userId),
      tier: s.tier,
      status: s.status,
      currency: s.currency || "USD",
      amountCents: String(s.amountCents ?? 0),
      billingProvider: s.billingProvider || "none",
    });
  };

  const body = () => ({
    userId: Number(form.userId),
    tier: form.tier,
    status: form.status,
    currency: form.currency,
    amountCents: Number(form.amountCents) || 0,
    billingProvider: form.billingProvider,
  });

  return (
    <>
      <AdminPageShell
        title="Subscriptions"
        subtitle={`${total} subscription${total === 1 ? "" : "s"}`}
        loading={loading && items.length === 0}
        onCreate={() => {
          setForm(empty);
          setCreateOpen(true);
        }}
        createLabel="Create subscription"
        filters={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["active", "cancelled", "past_due", "trialing", "paused"].map(
                (s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        }
      >
        <AdminTable
          headers={[
            "ID",
            "User",
            "Tier",
            "Status",
            "Amount",
            "Provider",
            "Actions",
          ]}
          colSpan={7}
          empty={items.length === 0}
        >
          {items.map((s) => (
            <tr
              key={s.id}
              className="border-b transition-colors hover:bg-muted/50"
            >
              <td className="p-4">{s.id}</td>
              <td className="p-4">
                <div className="flex flex-col">
                  <span className="font-medium">
                    {s.user?.name || `#${s.userId}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.user?.email}
                  </span>
                </div>
              </td>
              <td className="p-4">
                <Badge>{s.tier}</Badge>
              </td>
              <td className="p-4">
                <Badge variant="secondary">{s.status}</Badge>
              </td>
              <td className="p-4">
                {s.currency} {(s.amountCents / 100).toFixed(2)}
              </td>
              <td className="p-4">{s.billingProvider || "none"}</td>
              <td className="p-4">
                <AdminActions
                  onEdit={() => openEdit(s)}
                  onDelete={() => setDel(s)}
                />
              </td>
            </tr>
          ))}
        </AdminTable>
      </AdminPageShell>

      <SubDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create subscription"
        form={form}
        setForm={setForm}
        saving={saving}
        onSubmit={async () => {
          const ok = await run(
            () => apiClient.post("/admin/subscriptions", body()),
            "Subscription created",
            "Create failed",
          );
          if (ok) setCreateOpen(false);
        }}
      />
      <SubDialog
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title="Edit subscription"
        form={form}
        setForm={setForm}
        saving={saving}
        onSubmit={async () => {
          if (!edit) return;
          const ok = await run(
            () => apiClient.put(`/admin/subscriptions/${edit.id}`, body()),
            "Subscription updated",
            "Update failed",
          );
          if (ok) setEdit(null);
        }}
      />
      <ConfirmDeleteDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="Delete subscription?"
        description={
          <>
            Permanently delete subscription <strong>#{del?.id}</strong> for user{" "}
            {del?.user?.email || del?.userId}?
          </>
        }
        saving={saving}
        onConfirm={async () => {
          if (!del) return;
          const ok = await run(
            () => apiClient.delete(`/admin/subscriptions/${del.id}`),
            "Subscription deleted",
            "Delete failed",
          );
          if (ok) setDel(null);
        }}
      />
    </>
  );
}

function SubDialog({
  open,
  onOpenChange,
  title,
  form,
  setForm,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  form: Form;
  setForm: React.Dispatch<React.SetStateAction<Form>>;
  saving: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label>User ID</Label>
            <Input
              type="number"
              value={form.userId}
              onChange={(e) =>
                setForm((f) => ({ ...f, userId: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tier</Label>
              <Select
                value={form.tier}
                onValueChange={(v) => setForm((f) => ({ ...f, tier: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["free", "starter", "pro", "enterprise"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "active",
                    "cancelled",
                    "past_due",
                    "trialing",
                    "paused",
                  ].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={form.currency}
                onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="NGN">NGN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (cents)</Label>
              <Input
                type="number"
                value={form.amountCents}
                onChange={(e) =>
                  setForm((f) => ({ ...f, amountCents: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Billing provider</Label>
            <Select
              value={form.billingProvider}
              onValueChange={(v) =>
                setForm((f) => ({ ...f, billingProvider: v }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["none", "paystack", "polar"].map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={saving || !form.userId}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
