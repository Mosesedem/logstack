"use client";

import { useMemo, useState } from "react";
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

type Plan = {
  id: number;
  tier: string;
  name: string;
  description: string;
  logLimit: number;
  features: string[] | string;
  prices: Record<string, number> | string;
  limits: Record<string, string> | string;
  sortOrder: number;
  active: boolean;
};

type FormState = {
  tier: string;
  name: string;
  description: string;
  logLimit: string;
  features: string;
  priceUsd: string;
  priceNgn: string;
  sortOrder: string;
  active: boolean;
};

const empty: FormState = {
  tier: "starter",
  name: "",
  description: "",
  logLimit: "10000",
  features: "",
  priceUsd: "0",
  priceNgn: "0",
  sortOrder: "0",
  active: true,
};

function parseJsonField<T>(raw: T | string, fallback: T): T {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return (raw as T) ?? fallback;
}

function toBody(form: FormState) {
  return {
    tier: form.tier,
    name: form.name.trim(),
    description: form.description,
    logLimit: Number(form.logLimit) || 0,
    features: form.features
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    prices: {
      USD: Number(form.priceUsd) || 0,
      NGN: Number(form.priceNgn) || 0,
    },
    limits: {
      logs: `${form.logLimit}/month`,
    },
    sortOrder: Number(form.sortOrder) || 0,
    active: form.active,
  };
}

export default function AdminPlansPage() {
  const { items, total, loading, reload } = useAdminList<Plan>(
    "/admin/plans?includeInactive=true",
    (d) => ((d as { plans?: Plan[] }).plans ?? []) as Plan[],
  );
  const { saving, run } = useAdminMutations(reload);
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState<Plan | null>(null);
  const [del, setDel] = useState<Plan | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  const openEdit = (p: Plan) => {
    const prices = parseJsonField(p.prices, {} as Record<string, number>);
    const features = parseJsonField(p.features, [] as string[]);
    setEdit(p);
    setForm({
      tier: p.tier,
      name: p.name,
      description: p.description ?? "",
      logLimit: String(p.logLimit ?? 0),
      features: Array.isArray(features) ? features.join("\n") : "",
      priceUsd: String(prices.USD ?? 0),
      priceNgn: String(prices.NGN ?? 0),
      sortOrder: String(p.sortOrder ?? 0),
      active: p.active,
    });
  };

  const subtitle = useMemo(
    () => `${total} plan${total === 1 ? "" : "s"} · drives public pricing`,
    [total],
  );

  return (
    <>
      <AdminPageShell
        title="Pricing plans"
        subtitle={subtitle}
        loading={loading && items.length === 0}
        onCreate={() => {
          setForm(empty);
          setCreateOpen(true);
        }}
        createLabel="Create plan"
      >
        <AdminTable
          headers={[
            "Tier",
            "Name",
            "Log limit",
            "USD",
            "NGN",
            "Active",
            "Actions",
          ]}
          colSpan={7}
          empty={items.length === 0}
        >
          {items.map((p) => {
            const prices = parseJsonField(p.prices, {} as Record<string, number>);
            return (
              <tr
                key={p.id}
                className="border-b transition-colors hover:bg-muted/50"
              >
                <td className="p-4">
                  <Badge>{p.tier}</Badge>
                </td>
                <td className="p-4 font-medium">{p.name}</td>
                <td className="p-4">
                  {p.logLimit < 0 ? "Unlimited" : p.logLimit.toLocaleString()}
                </td>
                <td className="p-4">
                  {prices.USD === -1
                    ? "Contact"
                    : `$${(prices.USD ?? 0) / 100}`}
                </td>
                <td className="p-4">
                  {prices.NGN === -1
                    ? "Contact"
                    : `₦${(prices.NGN ?? 0).toLocaleString()}`}
                </td>
                <td className="p-4">
                  <Badge variant={p.active ? "default" : "outline"}>
                    {p.active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="p-4">
                  <AdminActions
                    onEdit={() => openEdit(p)}
                    onDelete={() => setDel(p)}
                  />
                </td>
              </tr>
            );
          })}
        </AdminTable>
      </AdminPageShell>

      <PlanDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create pricing plan"
        form={form}
        setForm={setForm}
        saving={saving}
        allowTier
        onSubmit={async () => {
          const ok = await run(
            () => apiClient.post("/admin/plans", toBody(form)),
            "Plan created",
            "Create failed",
          );
          if (ok) setCreateOpen(false);
        }}
      />

      <PlanDialog
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title="Edit pricing plan"
        form={form}
        setForm={setForm}
        saving={saving}
        allowTier
        onSubmit={async () => {
          if (!edit) return;
          const ok = await run(
            () => apiClient.put(`/admin/plans/${edit.id}`, toBody(form)),
            "Plan updated",
            "Update failed",
          );
          if (ok) setEdit(null);
        }}
      />

      <ConfirmDeleteDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="Delete plan?"
        description={
          <>
            Delete plan <strong>{del?.name}</strong>? Public pricing will stop
            listing it (unless fallback defaults apply when none remain).
          </>
        }
        saving={saving}
        onConfirm={async () => {
          if (!del) return;
          const ok = await run(
            () => apiClient.delete(`/admin/plans/${del.id}`),
            "Plan deleted",
            "Delete failed",
          );
          if (ok) setDel(null);
        }}
      />
    </>
  );
}

function PlanDialog({
  open,
  onOpenChange,
  title,
  form,
  setForm,
  saving,
  onSubmit,
  allowTier,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  saving: boolean;
  onSubmit: () => void;
  allowTier?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {allowTier ? (
            <div className="space-y-2">
              <Label>Tier key</Label>
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
          ) : null}
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Log limit (-1 = unlimited)</Label>
              <Input
                type="number"
                value={form.logLimit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, logLimit: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Sort order</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sortOrder: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>USD cents</Label>
              <Input
                type="number"
                value={form.priceUsd}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priceUsd: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>NGN cents/kobo</Label>
              <Input
                type="number"
                value={form.priceNgn}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priceNgn: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Features (one per line)</Label>
            <textarea
              className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.features}
              onChange={(e) =>
                setForm((f) => ({ ...f, features: e.target.value }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) =>
                setForm((f) => ({ ...f, active: e.target.checked }))
              }
            />
            Active (shown on public pricing)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={saving || !form.name.trim()}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
