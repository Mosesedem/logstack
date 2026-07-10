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

type Invoice = {
  id: string;
  userId: number;
  reference: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
  user?: { email?: string; name?: string };
};

type Form = {
  userId: string;
  reference: string;
  amountCents: string;
  currency: string;
  status: string;
};

const empty: Form = {
  userId: "",
  reference: "",
  amountCents: "0",
  currency: "USD",
  status: "pending",
};

export default function AdminInvoicesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const params = new URLSearchParams({ limit: "100" });
  if (search.trim()) params.set("search", search.trim());
  if (statusFilter !== "all") params.set("status", statusFilter);
  const path = `/admin/invoices?${params.toString()}`;

  const { items, total, loading, reload } = useAdminList<Invoice>(
    path,
    (d) => ((d as { invoices?: Invoice[] }).invoices ?? []) as Invoice[],
    [search, statusFilter],
  );
  const { saving, run } = useAdminMutations(reload);
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState<Invoice | null>(null);
  const [del, setDel] = useState<Invoice | null>(null);
  const [form, setForm] = useState<Form>(empty);

  const openEdit = (inv: Invoice) => {
    setEdit(inv);
    setForm({
      userId: String(inv.userId),
      reference: inv.reference,
      amountCents: String(inv.amountCents),
      currency: inv.currency,
      status: inv.status,
    });
  };

  const body = () => ({
    userId: Number(form.userId),
    reference: form.reference.trim(),
    amountCents: Number(form.amountCents) || 0,
    currency: form.currency,
    status: form.status,
    lineItems: [
      {
        description: "Admin invoice",
        amount: Number(form.amountCents) || 0,
        quantity: 1,
      },
    ],
  });

  return (
    <>
      <AdminPageShell
        title="Invoices & transactions"
        subtitle={`${total} record${total === 1 ? "" : "s"}`}
        loading={loading && items.length === 0}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by reference…"
        onCreate={() => {
          setForm({
            ...empty,
            reference: `admin_${Date.now()}`,
          });
          setCreateOpen(true);
        }}
        createLabel="Create invoice"
        filters={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["pending", "paid", "failed"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        <AdminTable
          headers={[
            "Reference",
            "User",
            "Amount",
            "Status",
            "Created",
            "Actions",
          ]}
          colSpan={6}
          empty={items.length === 0}
        >
          {items.map((inv) => (
            <tr
              key={inv.id}
              className="border-b transition-colors hover:bg-muted/50"
            >
              <td className="p-4 font-mono text-xs">{inv.reference}</td>
              <td className="p-4">
                <div className="flex flex-col">
                  <span>{inv.user?.name || `#${inv.userId}`}</span>
                  <span className="text-xs text-muted-foreground">
                    {inv.user?.email}
                  </span>
                </div>
              </td>
              <td className="p-4">
                {inv.currency} {(inv.amountCents / 100).toFixed(2)}
              </td>
              <td className="p-4">
                <Badge
                  variant={
                    inv.status === "paid"
                      ? "default"
                      : inv.status === "failed"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {inv.status}
                </Badge>
              </td>
              <td className="p-4">
                {new Date(inv.createdAt).toLocaleDateString()}
              </td>
              <td className="p-4">
                <AdminActions
                  onEdit={() => openEdit(inv)}
                  onDelete={() => setDel(inv)}
                />
              </td>
            </tr>
          ))}
        </AdminTable>
      </AdminPageShell>

      <InvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create invoice"
        form={form}
        setForm={setForm}
        saving={saving}
        onSubmit={async () => {
          const ok = await run(
            () => apiClient.post("/admin/invoices", body()),
            "Invoice created",
            "Create failed",
          );
          if (ok) setCreateOpen(false);
        }}
      />
      <InvoiceDialog
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title="Edit invoice"
        form={form}
        setForm={setForm}
        saving={saving}
        onSubmit={async () => {
          if (!edit) return;
          const ok = await run(
            () => apiClient.put(`/admin/invoices/${edit.id}`, body()),
            "Invoice updated",
            "Update failed",
          );
          if (ok) setEdit(null);
        }}
      />
      <ConfirmDeleteDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="Delete invoice?"
        description={
          <>
            Delete invoice <strong>{del?.reference}</strong>?
          </>
        }
        saving={saving}
        onConfirm={async () => {
          if (!del) return;
          const ok = await run(
            () => apiClient.delete(`/admin/invoices/${del.id}`),
            "Invoice deleted",
            "Delete failed",
          );
          if (ok) setDel(null);
        }}
      />
    </>
  );
}

function InvoiceDialog({
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
          <div className="space-y-2">
            <Label>Reference</Label>
            <Input
              value={form.reference}
              onChange={(e) =>
                setForm((f) => ({ ...f, reference: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
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
                {["pending", "paid", "failed"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
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
            disabled={saving || !form.userId || !form.reference.trim()}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
