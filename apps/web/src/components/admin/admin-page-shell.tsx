"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/loading";

export function AdminPageShell({
  title,
  subtitle,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  onCreate,
  createLabel = "Create",
  loading,
  children,
  filters,
}: {
  title: string;
  subtitle?: string;
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  onCreate?: () => void;
  createLabel?: string;
  loading?: boolean;
  children: React.ReactNode;
  filters?: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label={`Loading ${title}`}>
        <PageHeaderSkeleton withAction={!!onCreate} />
        <TableSkeleton rows={8} columns={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {onCreate ? (
          <Button onClick={onCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {createLabel}
          </Button>
        ) : null}
      </div>

      {(onSearchChange || filters) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {onSearchChange ? (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={searchPlaceholder}
                value={search ?? ""}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          ) : null}
          {filters}
        </div>
      )}

      <div className="rounded-md border bg-card">
        <div className="relative w-full overflow-auto">{children}</div>
      </div>
    </div>
  );
}

export function AdminTable({
  headers,
  children,
  empty,
  colSpan,
}: {
  headers: string[];
  children: React.ReactNode;
  empty?: boolean;
  colSpan: number;
}) {
  return (
    <table className="w-full caption-bottom text-sm">
      <thead className="[&_tr]:border-b">
        <tr className="border-b">
          {headers.map((h) => (
            <th
              key={h}
              className={`h-12 px-4 font-medium text-muted-foreground ${
                h === "Actions" ? "text-right" : "text-left"
              }`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="[&_tr:last-child]:border-0">
        {empty ? (
          <tr>
            <td
              colSpan={colSpan}
              className="p-8 text-center text-muted-foreground"
            >
              No records found
            </td>
          </tr>
        ) : (
          children
        )}
      </tbody>
    </table>
  );
}

export function AdminActions({
  onEdit,
  onDelete,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      {onEdit ? (
        <Button variant="ghost" size="icon" aria-label="Edit" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
      ) : null}
      {onDelete ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      ) : null}
    </div>
  );
}
