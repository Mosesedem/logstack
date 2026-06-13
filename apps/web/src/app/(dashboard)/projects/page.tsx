"use client";

import { useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useProject } from "@/hooks/use-project";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { Project } from "@/types";
import { Plus, Copy, RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ProjectsPage() {
  const { projects, refreshProjects } = useProject();
  const { data: session } = useSession();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [apiKeyToDisplay, setApiKeyToDisplay] = useState<string | null>(null);
  const { toast } = useToast();

  const isEmailVerified = session?.user?.emailVerified ?? false;

  // Empty state: no projects
  if (!projects || projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-2xl font-bold">No Projects Yet</h2>
          <p className="text-muted-foreground">
            Create your first project to start ingesting logs.
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Project
        </Button>
      </div>
    );
  }

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post<Project>("/projects", { name }),
    onSuccess: (project) => {
      refreshProjects();
      setIsFormOpen(false);
      setNewProjectName("");
      // Show API key in a modal instead of toast for better security UX
      setApiKeyToDisplay(project.apiKey ?? null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rotateKeyMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<{ apiKey: string }>(`/projects/${id}/rotate-key`, {}),
    onSuccess: (data) => {
      refreshProjects();
      // Show the new key in the secure modal (copy-to-clipboard), not a
      // dismissible toast — it is only shown once and cannot be retrieved later.
      setApiKeyToDisplay(data.apiKey ?? null);
      toast({
        title: "API Key rotated",
        description: "Copy your new key now — it won't be shown again.",
      });
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
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => {
      refreshProjects();
      toast({ title: "Project deleted" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const handleCreateProject = () => {
    if (!isEmailVerified) {
      toast({
        title: "Email verification required",
        description:
          "Please verify your email before creating projects with API keys.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newProjectName);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {!isEmailVerified && (
                <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                  <p className="text-sm text-yellow-500">
                    Verify your email to create projects with API keys.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="My App"
                />
              </div>
              <Button
                onClick={handleCreateProject}
                disabled={
                  !newProjectName ||
                  createMutation.isPending ||
                  !isEmailVerified
                }
                className="w-full"
              >
                {createMutation.isPending ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <CardTitle>{project.name}</CardTitle>
              <CardDescription>
                Created {new Date(project.createdAt).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Project ID</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-2 py-1 text-xs">
                    {project.id}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(project.id)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={rotateKeyMutation.isPending}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Rotate Key
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Rotate API Key?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will invalidate the current API key for{" "}
                        <strong>{project.name}</strong>. Any applications using
                        the old key will stop working immediately. This action
                        cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => rotateKeyMutation.mutate(project.id)}
                      >
                        Rotate Key
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteMutation.isPending}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete{" "}
                        <strong>{project.name}</strong> and all associated data
                        including logs and alert rules. This action cannot be
                        undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(project.id)}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        Delete Project
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* API Key Display Modal */}
      {apiKeyToDisplay && (
        <Dialog
          open={!!apiKeyToDisplay}
          onOpenChange={(open) => {
            if (!open) setApiKeyToDisplay(null);
          }}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Project Created</DialogTitle>
              <DialogDescription>
                Your API key has been generated. Store it securely — it will not
                be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <div className="flex gap-2">
                  <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm break-all">
                    {apiKeyToDisplay}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(apiKeyToDisplay);
                      toast({ title: "Copied to clipboard" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  This key will not be shown again. Keep it secure.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => setApiKeyToDisplay(null)}>
                I've saved my key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
