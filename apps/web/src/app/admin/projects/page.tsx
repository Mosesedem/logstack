"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient, ApiClientError } from "@/lib/api-client";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/loading";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Search } from "lucide-react";
import type { AdminProject, AdminProjectListResponse } from "@/types";

type ProjectFormState = {
  name: string;
  environment: string;
  ownerId: string;
};

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editProject, setEditProject] = useState<AdminProject | null>(null);
  const [deleteProject, setDeleteProject] = useState<AdminProject | null>(
    null,
  );
  const [form, setForm] = useState<ProjectFormState>({
    name: "",
    environment: "production",
    ownerId: "",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100", offset: "0" });
      if (search.trim()) params.set("search", search.trim());
      const data = await apiClient.get<AdminProjectListResponse>(
        `/admin/projects?${params.toString()}`,
      );
      setProjects(data.projects ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      console.error(e);
      toast({
        title: "Failed to load projects",
        description:
          e instanceof ApiClientError ? e.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadProjects();
    }, 200);
    return () => clearTimeout(t);
  }, [loadProjects]);

  const openEdit = (project: AdminProject) => {
    setEditProject(project);
    setForm({
      name: project.name,
      environment: project.environment || "production",
      ownerId: String(project.ownerId),
    });
  };

  const handleUpdate = async () => {
    if (!editProject) return;
    setSaving(true);
    try {
      const ownerId = Number(form.ownerId);
      await apiClient.put(`/admin/projects/${editProject.id}`, {
        name: form.name.trim(),
        environment: form.environment,
        ownerId: Number.isFinite(ownerId) ? ownerId : undefined,
      });
      toast({ title: "Project updated" });
      setEditProject(null);
      await loadProjects();
    } catch (e) {
      toast({
        title: "Update failed",
        description:
          e instanceof ApiClientError ? e.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteProject) return;
    setSaving(true);
    try {
      await apiClient.delete(`/admin/projects/${deleteProject.id}`);
      toast({ title: "Project deleted" });
      setDeleteProject(null);
      await loadProjects();
    } catch (e) {
      toast({
        title: "Delete failed",
        description:
          e instanceof ApiClientError ? e.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading && projects.length === 0) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading projects">
        <PageHeaderSkeleton withAction={false} />
        <TableSkeleton rows={8} columns={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            {total} project{total === 1 ? "" : "s"} · edit or delete any project
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-md border bg-card">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b">
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                  Name
                </th>
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                  ID
                </th>
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                  Owner
                </th>
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                  Env
                </th>
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                  Created
                </th>
                <th className="h-12 px-4 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {projects.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-muted-foreground"
                  >
                    No projects found
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr
                    key={project.id}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    <td className="p-4 align-middle font-medium">
                      {project.name}
                      {project.archivedAt ? (
                        <Badge variant="outline" className="ml-2">
                          archived
                        </Badge>
                      ) : null}
                    </td>
                    <td className="p-4 align-middle font-mono text-xs">
                      {project.id}
                    </td>
                    <td className="p-4 align-middle">
                      {project.owner ? (
                        <div className="flex flex-col">
                          <span>{project.owner.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {project.owner.email}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">
                          #{project.ownerId}
                        </span>
                      )}
                    </td>
                    <td className="p-4 align-middle">
                      <Badge variant="secondary">
                        {project.environment || "production"}
                      </Badge>
                    </td>
                    <td className="p-4 align-middle">
                      {new Date(project.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${project.name}`}
                          onClick={() => openEdit(project)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${project.name}`}
                          onClick={() => setDeleteProject(project)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={!!editProject}
        onOpenChange={(open) => !open && setEditProject(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="admin-project-name">Name</Label>
              <Input
                id="admin-project-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select
                value={form.environment}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, environment: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">development</SelectItem>
                  <SelectItem value="staging">staging</SelectItem>
                  <SelectItem value="production">production</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-project-owner">Owner user ID</Label>
              <Input
                id="admin-project-owner"
                type="number"
                value={form.ownerId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ownerId: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProject(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={saving || !form.name.trim()}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteProject}
        onOpenChange={(open) => !open && setDeleteProject(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{" "}
              <strong>{deleteProject?.name}</strong> and all of its logs, alert
              rules, and usage data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
