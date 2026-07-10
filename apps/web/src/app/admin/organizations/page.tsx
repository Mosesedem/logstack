"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api-client";
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
import { Users } from "lucide-react";

type Org = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
};

type Member = {
  id: string;
  userId: number;
  role: string;
  user?: { email?: string; name?: string };
};

export default function AdminOrganizationsPage() {
  const [search, setSearch] = useState("");
  const path = `/admin/organizations?limit=100${
    search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""
  }`;
  const { items, total, loading, reload } = useAdminList<Org>(
    path,
    (d) =>
      ((d as { organizations?: Org[] }).organizations ?? []) as Org[],
    [search],
  );
  const { saving, run } = useAdminMutations(reload);
  const [createOpen, setCreateOpen] = useState(false);
  const [edit, setEdit] = useState<Org | null>(null);
  const [del, setDel] = useState<Org | null>(null);
  const [membersOrg, setMembersOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberForm, setMemberForm] = useState({ userId: "", role: "member" });
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const openMembers = async (org: Org) => {
    setMembersOrg(org);
    try {
      const data = await apiClient.get<{ members: Member[] }>(
        `/admin/organizations/${org.id}/members`,
      );
      setMembers(data.members ?? []);
    } catch {
      setMembers([]);
    }
  };

  return (
    <>
      <AdminPageShell
        title="Organizations"
        subtitle={`${total} organization${total === 1 ? "" : "s"}`}
        loading={loading && items.length === 0}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name or slug…"
        onCreate={() => {
          setName("");
          setSlug("");
          setCreateOpen(true);
        }}
        createLabel="Create organization"
      >
        <AdminTable
          headers={["Name", "Slug", "Created", "Actions"]}
          colSpan={4}
          empty={items.length === 0}
        >
          {items.map((org) => (
            <tr
              key={org.id}
              className="border-b transition-colors hover:bg-muted/50"
            >
              <td className="p-4 font-medium">{org.name}</td>
              <td className="p-4 font-mono text-xs">{org.slug}</td>
              <td className="p-4">
                {new Date(org.createdAt).toLocaleDateString()}
              </td>
              <td className="p-4">
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Members"
                    onClick={() => void openMembers(org)}
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                  <AdminActions
                    onEdit={() => {
                      setEdit(org);
                      setName(org.name);
                      setSlug(org.slug);
                    }}
                    onDelete={() => setDel(org)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      </AdminPageShell>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
          </DialogHeader>
          <OrgFields name={name} setName={setName} slug={slug} setSlug={setSlug} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={saving || !name.trim()}
              onClick={async () => {
                const ok = await run(
                  () =>
                    apiClient.post("/admin/organizations", {
                      name: name.trim(),
                      slug: slug.trim() || undefined,
                    }),
                  "Organization created",
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
            <DialogTitle>Edit organization</DialogTitle>
          </DialogHeader>
          <OrgFields name={name} setName={setName} slug={slug} setSlug={setSlug} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button
              disabled={saving || !name.trim()}
              onClick={async () => {
                if (!edit) return;
                const ok = await run(
                  () =>
                    apiClient.put(`/admin/organizations/${edit.id}`, {
                      name: name.trim(),
                      slug: slug.trim(),
                    }),
                  "Organization updated",
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

      <Dialog
        open={!!membersOrg}
        onOpenChange={(o) => !o && setMembersOrg(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Members — {membersOrg?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members</p>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">
                        {m.user?.name || `#${m.userId}`}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {m.user?.email} · {m.role}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={async () => {
                        if (!membersOrg) return;
                        await run(
                          () =>
                            apiClient.delete(
                              `/admin/organizations/${membersOrg.id}/members/${m.id}`,
                            ),
                          "Member removed",
                          "Remove failed",
                        );
                        void openMembers(membersOrg);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 border-t pt-3">
              <Input
                type="number"
                placeholder="User ID"
                value={memberForm.userId}
                onChange={(e) =>
                  setMemberForm((f) => ({ ...f, userId: e.target.value }))
                }
              />
              <Select
                value={memberForm.role}
                onValueChange={(v) =>
                  setMemberForm((f) => ({ ...f, role: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["owner", "admin", "member", "viewer"].map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={!memberForm.userId}
                onClick={async () => {
                  if (!membersOrg) return;
                  await run(
                    () =>
                      apiClient.post(
                        `/admin/organizations/${membersOrg.id}/members`,
                        {
                          userId: Number(memberForm.userId),
                          role: memberForm.role,
                        },
                      ),
                    "Member added",
                    "Add failed",
                  );
                  setMemberForm({ userId: "", role: "member" });
                  void openMembers(membersOrg);
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="Delete organization?"
        description={
          <>
            Delete <strong>{del?.name}</strong> and its members/invites? Projects
            are detached, not deleted.
          </>
        }
        saving={saving}
        onConfirm={async () => {
          if (!del) return;
          const ok = await run(
            () => apiClient.delete(`/admin/organizations/${del.id}`),
            "Organization deleted",
            "Delete failed",
          );
          if (ok) setDel(null);
        }}
      />
    </>
  );
}

function OrgFields({
  name,
  setName,
  slug,
  setSlug,
}: {
  name: string;
  setName: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
}) {
  return (
    <div className="space-y-3 py-2">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Slug (optional)</Label>
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
      </div>
    </div>
  );
}
