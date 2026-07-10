"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { Pencil, Plus, Trash2, Search } from "lucide-react";
import type { AdminUserListResponse, User } from "@/types";

type UserFormState = {
  name: string;
  email: string;
  role: "user" | "admin";
  emailVerified: boolean;
  password: string;
};

const emptyCreateForm: UserFormState = {
  name: "",
  email: "",
  role: "user",
  emailVerified: true,
  password: "",
};

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6" role="status" aria-label="Loading users">
          <PageHeaderSkeleton withAction />
          <TableSkeleton rows={8} columns={6} />
        </div>
      }
    >
      <AdminUsersPageInner />
    </Suspense>
  );
}

function AdminUsersPageInner() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") ?? "all";

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState(initialRole);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyCreateForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100", offset: "0" });
      if (search.trim()) params.set("search", search.trim());
      if (roleFilter === "admin" || roleFilter === "user") {
        params.set("role", roleFilter);
      }
      const data = await apiClient.get<AdminUserListResponse>(
        `/admin/users?${params.toString()}`,
      );
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      console.error(e);
      toast({
        title: "Failed to load users",
        description:
          e instanceof ApiClientError ? e.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, toast]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadUsers();
    }, 200);
    return () => clearTimeout(t);
  }, [loadUsers]);

  const openCreate = () => {
    setForm(emptyCreateForm);
    setCreateOpen(true);
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setForm({
      name: user.name ?? "",
      email: user.email ?? "",
      role: user.role === "admin" ? "admin" : "user",
      emailVerified: Boolean(user.emailVerified),
      password: "",
    });
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await apiClient.post("/admin/users", {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        emailVerified: form.emailVerified,
      });
      toast({ title: "User created" });
      setCreateOpen(false);
      await loadUsers();
    } catch (e) {
      toast({
        title: "Create failed",
        description:
          e instanceof ApiClientError ? e.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        emailVerified: form.emailVerified,
      };
      if (form.password.trim()) {
        body.password = form.password;
      }
      await apiClient.put(`/admin/users/${editUser.id}`, body);
      toast({ title: "User updated" });
      setEditUser(null);
      await loadUsers();
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
    if (!deleteUser) return;
    setSaving(true);
    try {
      await apiClient.delete(`/admin/users/${deleteUser.id}`);
      toast({ title: "User deleted" });
      setDeleteUser(null);
      await loadUsers();
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

  if (loading && users.length === 0) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading users">
        <PageHeaderSkeleton withAction />
        <TableSkeleton rows={8} columns={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            {total} user{total === 1 ? "" : "s"} · full create / edit / delete
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Create user
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
            <SelectItem value="user">Users</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-card">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b">
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                  ID
                </th>
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                  Name
                </th>
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                  Email
                </th>
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                  Role
                </th>
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                  Verified
                </th>
                <th className="h-12 px-4 text-left font-medium text-muted-foreground">
                  Joined
                </th>
                <th className="h-12 px-4 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-muted-foreground"
                  >
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    <td className="p-4 align-middle">{user.id}</td>
                    <td className="p-4 align-middle font-medium">
                      {user.name}
                    </td>
                    <td className="p-4 align-middle">{user.email}</td>
                    <td className="p-4 align-middle">
                      <Badge
                        variant={
                          user.role === "admin" ? "default" : "secondary"
                        }
                      >
                        {user.role ?? "user"}
                      </Badge>
                    </td>
                    <td className="p-4 align-middle">
                      <Badge
                        variant={user.emailVerified ? "default" : "outline"}
                      >
                        {user.emailVerified ? "Yes" : "No"}
                      </Badge>
                    </td>
                    <td className="p-4 align-middle">
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
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
                          aria-label={`Edit ${user.email}`}
                          onClick={() => openEdit(user)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${user.email}`}
                          onClick={() => setDeleteUser(user)}
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

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
          </DialogHeader>
          <UserFormFields form={form} setForm={setForm} showPassword requiredPassword />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                saving ||
                !form.name.trim() ||
                !form.email.trim() ||
                form.password.length < 8
              }
            >
              {saving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
          </DialogHeader>
          <UserFormFields form={form} setForm={setForm} showPassword />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={saving || !form.name.trim() || !form.email.trim()}
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteUser}
        onOpenChange={(open) => !open && setDeleteUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{" "}
              <strong>{deleteUser?.email}</strong> and all of their projects,
              logs, and related data. This cannot be undone.
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

function UserFormFields({
  form,
  setForm,
  showPassword,
  requiredPassword,
}: {
  form: UserFormState;
  setForm: React.Dispatch<React.SetStateAction<UserFormState>>;
  showPassword?: boolean;
  requiredPassword?: boolean;
}) {
  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="admin-user-name">Name</Label>
        <Input
          id="admin-user-name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="admin-user-email">Email</Label>
        <Input
          id="admin-user-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label>Role</Label>
        <Select
          value={form.role}
          onValueChange={(v) =>
            setForm((f) => ({ ...f, role: v as "user" | "admin" }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="admin-user-verified"
          type="checkbox"
          className="h-4 w-4 rounded border"
          checked={form.emailVerified}
          onChange={(e) =>
            setForm((f) => ({ ...f, emailVerified: e.target.checked }))
          }
        />
        <Label htmlFor="admin-user-verified">Email verified</Label>
      </div>
      {showPassword ? (
        <div className="space-y-2">
          <Label htmlFor="admin-user-password">
            Password
            {!requiredPassword ? (
              <span className="ml-1 text-muted-foreground">
                (leave blank to keep)
              </span>
            ) : null}
          </Label>
          <Input
            id="admin-user-password"
            type="password"
            value={form.password}
            minLength={requiredPassword ? 8 : undefined}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
          />
        </div>
      ) : null}
    </div>
  );
}
