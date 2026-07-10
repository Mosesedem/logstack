"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import {
  AdminActions,
  AdminPageShell,
  AdminTable,
} from "@/components/admin/admin-page-shell";
import { ConfirmDeleteDialog } from "@/components/admin/confirm-delete";
import { useAdminList, useAdminMutations } from "@/hooks/use-admin-list";

type AuditRow = {
  id: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  organization_id?: string;
  created_at?: string;
  user?: { email?: string; name?: string };
};

export default function AdminAuditPage() {
  const { items, total, loading, reload } = useAdminList<AuditRow>(
    "/admin/audit?limit=100",
    (d) => ((d as { auditLogs?: AuditRow[] }).auditLogs ?? []) as AuditRow[],
  );
  const { saving, run } = useAdminMutations(reload);
  const [del, setDel] = useState<AuditRow | null>(null);

  return (
    <>
      <AdminPageShell
        title="Audit logs"
        subtitle={`${total} entr${total === 1 ? "y" : "ies"} · delete only (append-only system)`}
        loading={loading && items.length === 0}
      >
        <AdminTable
          headers={["Action", "Resource", "User", "When", "Actions"]}
          colSpan={5}
          empty={items.length === 0}
        >
          {items.map((row) => (
            <tr
              key={row.id}
              className="border-b transition-colors hover:bg-muted/50"
            >
              <td className="p-4">
                <Badge variant="secondary">{row.action}</Badge>
              </td>
              <td className="p-4 text-xs">
                {row.resource_type}
                {row.resource_id ? ` · ${row.resource_id}` : ""}
              </td>
              <td className="p-4 text-sm">
                {row.user?.email || row.user?.name || "—"}
              </td>
              <td className="p-4 text-sm">
                {row.created_at
                  ? new Date(row.created_at).toLocaleString()
                  : "—"}
              </td>
              <td className="p-4">
                <AdminActions onDelete={() => setDel(row)} />
              </td>
            </tr>
          ))}
        </AdminTable>
      </AdminPageShell>

      <ConfirmDeleteDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="Delete audit entry?"
        description="This permanently removes the audit trail row."
        saving={saving}
        onConfirm={async () => {
          if (!del) return;
          const ok = await run(
            () => apiClient.delete(`/admin/audit/${del.id}`),
            "Audit entry deleted",
            "Delete failed",
          );
          if (ok) setDel(null);
        }}
      />
    </>
  );
}
