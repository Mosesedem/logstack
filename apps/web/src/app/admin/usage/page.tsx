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
  AdminActions,
  AdminPageShell,
  AdminTable,
} from "@/components/admin/admin-page-shell";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete";
import { useAdminList, useAdminMutations } from "@/hooks/use-admin-list";

type Usage = {
  id: number;
  projectId: string;
  month: string;
  logCount: number;
  bytesIngested: number;
  project?: { name?: string };
};

export default function AdminUsagePage() {
  const { items, total, loading, reload } = useAdminList<Usage>(
    "/admin/usage?limit=100",
    (d) => ((d as { usage?: Usage[] }).usage ?? []) as Usage[],
  );
  const { saving, run } = useAdminMutations(reload);
  const [edit, setEdit] = useState<Usage | null>(null);
  const [del, setDel] = useState<Usage | null>(null);
  const [logCount, setLogCount] = useState("");
  const [bytes, setBytes] = useState("");

  return (
    <>
      <AdminPageShell
        title="Usage metering"
        subtitle={`${total} usage record${total === 1 ? "" : "s"}`}
        loading={loading && items.length === 0}
      >
        <AdminTable
          headers={[
            "Project",
            "Month",
            "Logs",
            "Bytes",
            "Actions",
          ]}
          colSpan={5}
          empty={items.length === 0}
        >
          {items.map((u) => (
            <tr
              key={u.id}
              className="border-b transition-colors hover:bg-muted/50"
            >
              <td className="p-4">
                <div className="flex flex-col">
                  <span className="font-medium">
                    {u.project?.name || "Project"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {u.projectId}
                  </span>
                </div>
              </td>
              <td className="p-4">
                {typeof u.month === "string"
                  ? u.month.slice(0, 10)
                  : String(u.month)}
              </td>
              <td className="p-4">{u.logCount.toLocaleString()}</td>
              <td className="p-4">{u.bytesIngested.toLocaleString()}</td>
              <td className="p-4">
                <AdminActions
                  onEdit={() => {
                    setEdit(u);
                    setLogCount(String(u.logCount));
                    setBytes(String(u.bytesIngested));
                  }}
                  onDelete={() => setDel(u)}
                />
              </td>
            </tr>
          ))}
        </AdminTable>
      </AdminPageShell>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit usage</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Log count</Label>
              <Input
                type="number"
                value={logCount}
                onChange={(e) => setLogCount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Bytes ingested</Label>
              <Input
                type="number"
                value={bytes}
                onChange={(e) => setBytes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button
              disabled={saving}
              onClick={async () => {
                if (!edit) return;
                const ok = await run(
                  () =>
                    apiClient.put(`/admin/usage/${edit.id}`, {
                      logCount: Number(logCount) || 0,
                      bytesIngested: Number(bytes) || 0,
                    }),
                  "Usage updated",
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
        title="Delete usage record?"
        description="This removes the monthly usage row for metering."
        saving={saving}
        onConfirm={async () => {
          if (!del) return;
          const ok = await run(
            () => apiClient.delete(`/admin/usage/${del.id}`),
            "Usage deleted",
            "Delete failed",
          );
          if (ok) setDel(null);
        }}
      />
    </>
  );
}
