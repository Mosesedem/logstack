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
  AdminActions,
  AdminPageShell,
  AdminTable,
} from "@/components/admin/admin-page-shell";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete";
import { useAdminList, useAdminMutations } from "@/hooks/use-admin-list";

type Alert = {
  id: number;
  projectId: string;
  name: string;
  triggerLevel?: string;
  channels?: string[];
  recipient: string;
  enabled: boolean;
  cooldownMinutes: number;
  project?: { name?: string };
};

type Form = {
  projectId: string;
  name: string;
  recipient: string;
  triggerLevel: string;
  channels: string;
  cooldownMinutes: string;
  enabled: boolean;
};

const empty: Form = {
  projectId: "",
  name: "",
  recipient: "",
  triggerLevel: "error",
  channels: "email",
  cooldownMinutes: "15",
  enabled: true,
};

export default function AdminAlertsPage() {
  const [search, setSearch] = useState("");
  const path = `/admin/alerts?limit=100${
    search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""
  }`;
  const { items, total, loading, reload } = useAdminList<Alert>(
    path,
    (d) => ((d as { alerts?: Alert[] }).alerts ?? []) as Alert[],
    [search],
  );
  const { saving, run } = useAdminMutations(reload);
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState<Alert | null>(null);
  const [del, setDel] = useState<Alert | null>(null);
  const [form, setForm] = useState<Form>(empty);

  const body = () => ({
    projectId: form.projectId.trim(),
    name: form.name.trim(),
    recipient: form.recipient.trim(),
    triggerLevel: form.triggerLevel,
    channels: form.channels
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    cooldownMinutes: Number(form.cooldownMinutes) || 15,
    enabled: form.enabled,
    triggerPatterns: [".*error.*"],
  });

  return (
    <>
      <AdminPageShell
        title="Alert rules"
        subtitle={`${total} rule${total === 1 ? "" : "s"}`}
        loading={loading && items.length === 0}
        search={search}
        onSearchChange={setSearch}
        onCreate={() => {
          setForm(empty);
          setCreateOpen(true);
        }}
        createLabel="Create alert"
      >
        <AdminTable
          headers={[
            "Name",
            "Project",
            "Level",
            "Channels",
            "Enabled",
            "Actions",
          ]}
          colSpan={6}
          empty={items.length === 0}
        >
          {items.map((a) => (
            <tr
              key={a.id}
              className="border-b transition-colors hover:bg-muted/50"
            >
              <td className="p-4 font-medium">{a.name}</td>
              <td className="p-4 text-xs">
                {a.project?.name || a.projectId}
              </td>
              <td className="p-4">
                <Badge variant="secondary">{a.triggerLevel || "—"}</Badge>
              </td>
              <td className="p-4 text-xs">
                {(a.channels || []).join(", ") || "—"}
              </td>
              <td className="p-4">
                <Badge variant={a.enabled ? "default" : "outline"}>
                  {a.enabled ? "On" : "Off"}
                </Badge>
              </td>
              <td className="p-4">
                <AdminActions
                  onEdit={() => {
                    setEdit(a);
                    setForm({
                      projectId: a.projectId,
                      name: a.name,
                      recipient: a.recipient,
                      triggerLevel: a.triggerLevel || "error",
                      channels: (a.channels || []).join(","),
                      cooldownMinutes: String(a.cooldownMinutes ?? 15),
                      enabled: a.enabled,
                    });
                  }}
                  onDelete={() => setDel(a)}
                />
              </td>
            </tr>
          ))}
        </AdminTable>
      </AdminPageShell>

      <AlertDialogForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create alert"
        form={form}
        setForm={setForm}
        saving={saving}
        onSubmit={async () => {
          const ok = await run(
            () => apiClient.post("/admin/alerts", body()),
            "Alert created",
            "Create failed",
          );
          if (ok) setCreateOpen(false);
        }}
      />
      <AlertDialogForm
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title="Edit alert"
        form={form}
        setForm={setForm}
        saving={saving}
        onSubmit={async () => {
          if (!edit) return;
          const ok = await run(
            () => apiClient.put(`/admin/alerts/${edit.id}`, body()),
            "Alert updated",
            "Update failed",
          );
          if (ok) setEdit(null);
        }}
      />
      <ConfirmDeleteDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="Delete alert?"
        description={
          <>
            Delete alert <strong>{del?.name}</strong>?
          </>
        }
        saving={saving}
        onConfirm={async () => {
          if (!del) return;
          const ok = await run(
            () => apiClient.delete(`/admin/alerts/${del.id}`),
            "Alert deleted",
            "Delete failed",
          );
          if (ok) setDel(null);
        }}
      />
    </>
  );
}

function AlertDialogForm({
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
            <Label>Project ID (UUID)</Label>
            <Input
              value={form.projectId}
              onChange={(e) =>
                setForm((f) => ({ ...f, projectId: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Recipient</Label>
            <Input
              value={form.recipient}
              onChange={(e) =>
                setForm((f) => ({ ...f, recipient: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Trigger level</Label>
              <Input
                value={form.triggerLevel}
                onChange={(e) =>
                  setForm((f) => ({ ...f, triggerLevel: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Cooldown (min)</Label>
              <Input
                type="number"
                value={form.cooldownMinutes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cooldownMinutes: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Channels (comma-separated)</Label>
            <Input
              value={form.channels}
              onChange={(e) =>
                setForm((f) => ({ ...f, channels: e.target.value }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) =>
                setForm((f) => ({ ...f, enabled: e.target.checked }))
              }
            />
            Enabled
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={
              saving ||
              !form.name.trim() ||
              !form.projectId.trim() ||
              !form.recipient.trim()
            }
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
