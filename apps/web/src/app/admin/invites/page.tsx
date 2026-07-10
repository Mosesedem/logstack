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

type Invite = {
  id: string;
  organizationId: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  organization?: { name?: string };
};

export default function AdminInvitesPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const qs =
    statusFilter !== "all"
      ? `/admin/invites?limit=100&status=${statusFilter}`
      : "/admin/invites?limit=100";
  const { items, total, loading, reload } = useAdminList<Invite>(
    qs,
    (d) => ((d as { invites?: Invite[] }).invites ?? []) as Invite[],
    [statusFilter],
  );
  const { saving, run } = useAdminMutations(reload);
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState<Invite | null>(null);
  const [del, setDel] = useState<Invite | null>(null);
  const [form, setForm] = useState({
    organizationId: "",
    email: "",
    role: "member",
    status: "pending",
  });

  return (
    <>
      <AdminPageShell
        title="Invites"
        subtitle={`${total} invite${total === 1 ? "" : "s"}`}
        loading={loading && items.length === 0}
        onCreate={() => {
          setForm({
            organizationId: "",
            email: "",
            role: "member",
            status: "pending",
          });
          setCreateOpen(true);
        }}
        createLabel="Create invite"
        filters={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {["pending", "accepted", "revoked", "expired"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        <AdminTable
          headers={["Email", "Org", "Role", "Status", "Expires", "Actions"]}
          colSpan={6}
          empty={items.length === 0}
        >
          {items.map((inv) => (
            <tr
              key={inv.id}
              className="border-b transition-colors hover:bg-muted/50"
            >
              <td className="p-4 font-medium">{inv.email}</td>
              <td className="p-4 text-xs">
                {inv.organization?.name || inv.organizationId}
              </td>
              <td className="p-4">
                <Badge variant="secondary">{inv.role}</Badge>
              </td>
              <td className="p-4">
                <Badge>{inv.status}</Badge>
              </td>
              <td className="p-4">
                {new Date(inv.expiresAt).toLocaleDateString()}
              </td>
              <td className="p-4">
                <AdminActions
                  onEdit={() => {
                    setEdit(inv);
                    setForm({
                      organizationId: inv.organizationId,
                      email: inv.email,
                      role: inv.role,
                      status: inv.status,
                    });
                  }}
                  onDelete={() => setDel(inv)}
                />
              </td>
            </tr>
          ))}
        </AdminTable>
      </AdminPageShell>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create invite</DialogTitle>
          </DialogHeader>
          <InviteFields form={form} setForm={setForm} showOrg />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                saving || !form.email.trim() || !form.organizationId.trim()
              }
              onClick={async () => {
                const ok = await run(
                  () =>
                    apiClient.post("/admin/invites", {
                      organizationId: form.organizationId.trim(),
                      email: form.email.trim(),
                      role: form.role,
                      status: form.status,
                    }),
                  "Invite created",
                  "Create failed",
                );
                if (ok) setCreateOpen(false);
              }}
            >
              {saving ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit invite</DialogTitle>
          </DialogHeader>
          <InviteFields form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button
              disabled={saving || !form.email.trim()}
              onClick={async () => {
                if (!edit) return;
                const ok = await run(
                  () =>
                    apiClient.put(`/admin/invites/${edit.id}`, {
                      email: form.email.trim(),
                      role: form.role,
                      status: form.status,
                    }),
                  "Invite updated",
                  "Update failed",
                );
                if (ok) setEdit(null);
              }}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="Delete invite?"
        description={
          <>
            Delete invite for <strong>{del?.email}</strong>?
          </>
        }
        saving={saving}
        onConfirm={async () => {
          if (!del) return;
          const ok = await run(
            () => apiClient.delete(`/admin/invites/${del.id}`),
            "Invite deleted",
            "Delete failed",
          );
          if (ok) setDel(null);
        }}
      />
    </>
  );
}

function InviteFields({
  form,
  setForm,
  showOrg,
}: {
  form: {
    organizationId: string;
    email: string;
    role: string;
    status: string;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      organizationId: string;
      email: string;
      role: string;
      status: string;
    }>
  >;
  showOrg?: boolean;
}) {
  return (
    <div className="space-y-3 py-2">
      {showOrg ? (
        <div className="space-y-2">
          <Label>Organization ID (UUID)</Label>
          <Input
            value={form.organizationId}
            onChange={(e) =>
              setForm((f) => ({ ...f, organizationId: e.target.value }))
            }
          />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label>Email</Label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Role</Label>
          <Select
            value={form.role}
            onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["admin", "member", "viewer"].map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
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
              {["pending", "accepted", "revoked", "expired"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
