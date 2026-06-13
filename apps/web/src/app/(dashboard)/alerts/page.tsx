"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useProject } from "@/hooks/use-project";
import { AlertList } from "@/components/alerts/alert-list";
import { AlertForm } from "@/components/alerts/alert-form";
import { Button } from "@/components/ui/button";
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
import { api } from "@/lib/api-client";
import { AlertRule } from "@/types";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export default function AlertsPage() {
  const { currentProject } = useProject();
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<AlertRule | null>(null);
  const [deletingAlertId, setDeletingAlertId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["alerts", currentProject?.id],
    queryFn: () =>
      api.get<AlertRule[]>(`/alerts?projectId=${currentProject?.id}`),
    enabled: !!currentProject?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<AlertRule>) =>
      api.post(`/alerts?projectId=${currentProject?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      setIsFormOpen(false);
      toast({ title: "Alert rule created" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AlertRule> }) =>
      api.put(`/alerts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      setEditingAlert(null);
      toast({ title: "Alert rule updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/alerts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      setDeletingAlertId(null);
      toast({ title: "Alert rule deleted" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteRequest = (id: number) => {
    setDeletingAlertId(id);
  };

  const handleDeleteConfirm = () => {
    if (deletingAlertId !== null) {
      deleteMutation.mutate(deletingAlertId);
    }
  };

  const alertToDelete = alerts?.find((a) => a.id === deletingAlertId);

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-2xl font-bold">No Project Selected</h2>
          <p className="text-muted-foreground">
            Select a project from the sidebar to create and manage alert rules.
          </p>
        </div>
        <Button onClick={() => router.push("/projects")}>
          Create Project
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Alert Rules</h1>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Alert
        </Button>
      </div>

      <AlertForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={(data) => createMutation.mutate(data)}
        isSubmitting={createMutation.isPending}
      />

      <AlertList
        alerts={alerts ?? []}
        isLoading={isLoading}
        onEdit={setEditingAlert}
        onDelete={handleDeleteRequest}
        onToggle={(id, enabled) =>
          updateMutation.mutate({ id, data: { enabled } })
        }
      />

      {/* Edit Dialog */}
      <AlertForm
        open={!!editingAlert}
        onOpenChange={(open) => !open && setEditingAlert(null)}
        onSubmit={(data) =>
          editingAlert && updateMutation.mutate({ id: editingAlert.id, data })
        }
        initialData={editingAlert}
        isSubmitting={updateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deletingAlertId !== null}
        onOpenChange={(open) => !open && setDeletingAlertId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the alert rule
              {alertToDelete && (
                <strong> &ldquo;{alertToDelete.name}&rdquo;</strong>
              )}
              . You will no longer receive notifications for this rule. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete Alert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
