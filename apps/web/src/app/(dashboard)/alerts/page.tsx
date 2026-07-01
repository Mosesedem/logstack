"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useProject } from "@/hooks/use-project";
import { AlertList } from "@/components/alerts/alert-list";
import { AlertForm } from "@/components/alerts/alert-form";
import { AlertHistory } from "@/components/alerts/alert-history";
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
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { AlertHistory as AlertHistoryType, AlertRule } from "@/types";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

type AlertsTab = "rules" | "history";

export default function AlertsPage() {
  const { currentProject } = useProject();
  const { data: session } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<AlertsTab>("rules");
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

  const selectedAlertId = alerts?.[0]?.id;

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["alert-history", selectedAlertId],
    queryFn: () =>
      api.get<AlertHistoryType[]>(
        `/alerts/${selectedAlertId}/history?limit=50`,
      ),
    enabled: tab === "history" && !!selectedAlertId,
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

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-2xl font-bold">No Project Selected</h2>
          <p className="text-muted-foreground">
            Create a project first — you&apos;ll be prompted to set up alerts
            right after your API key is generated.
          </p>
        </div>
        <Button onClick={() => router.push("/create")}>Create Project</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage notification rules for{" "}
            <span className="font-medium text-foreground">
              {currentProject.name}
            </span>
            . Add new rules or edit existing ones here.
          </p>
        </div>
        {tab === "rules" && (
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Alert
          </Button>
        )}
      </div>

      <div className="flex gap-2 border-b">
        <Button
          variant={tab === "rules" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTab("rules")}
        >
          Rules
        </Button>
        <Button
          variant={tab === "history" ? "default" : "ghost"}
          size="sm"
          onClick={() => setTab("history")}
        >
          History
        </Button>
      </div>

      {tab === "rules" ? (
        <AlertList
          alerts={alerts ?? []}
          isLoading={isLoading}
          onEdit={setEditingAlert}
          onDelete={(id) => setDeletingAlertId(id)}
          onCreate={() => setIsFormOpen(true)}
          onToggle={(id, enabled) =>
            updateMutation.mutate({ id, data: { enabled } })
          }
        />
      ) : alerts && alerts.length > 0 ? (
        <AlertHistory history={history ?? []} isLoading={historyLoading} />
      ) : (
        <div className="py-12 text-center text-muted-foreground">
          Create an alert rule first to see delivery history.
        </div>
      )}

      <AlertForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={(data) => createMutation.mutate(data)}
        defaultRecipient={session?.user?.email ?? undefined}
        isSubmitting={createMutation.isPending}
      />

      <AlertForm
        open={!!editingAlert}
        onOpenChange={(open) => !open && setEditingAlert(null)}
        onSubmit={(data) =>
          editingAlert && updateMutation.mutate({ id: editingAlert.id, data })
        }
        initialData={editingAlert}
        defaultRecipient={session?.user?.email ?? undefined}
        isSubmitting={updateMutation.isPending}
      />

      <AlertDialog
        open={deletingAlertId !== null}
        onOpenChange={(open) => !open && setDeletingAlertId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete alert rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. You will stop receiving notifications for
              this rule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deletingAlertId !== null &&
                deleteMutation.mutate(deletingAlertId)
              }
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}