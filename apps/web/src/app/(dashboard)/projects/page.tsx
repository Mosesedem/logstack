"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { ApiKeyRevealDialog } from "@/components/projects/api-key-reveal-dialog";
import { ProjectsPageSkeleton } from "@/components/loading";
import { Plus, Copy, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ProjectsPage() {
  const { projects, refreshProjects, isLoading } = useProject();
  const [rotatedApiKey, setRotatedApiKey] = useState<string | null>(null);
  const { toast } = useToast();

  const hasProjects = projects.length > 0;

  const rotateKeyMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<{ apiKey: string }>(`/projects/${id}/rotate-key`, {}),
    onSuccess: (data) => {
      refreshProjects();
      setRotatedApiKey(data.apiKey ?? null);
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

  if (isLoading) {
    return <ProjectsPageSkeleton />;
  }

  return (
    <>
      {!hasProjects ? (
        <div className="flex h-full flex-col items-center justify-center space-y-4">
          <div className="max-w-md space-y-2 text-center">
            <h2 className="text-2xl font-bold">No Projects Yet</h2>
            <p className="text-muted-foreground">
              Create your first project to start ingesting logs.
            </p>
          </div>
          <Button asChild>
            <Link href="/create">
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Projects</h1>
            <Button asChild>
              <Link href="/create">
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id}>
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>
                    Created{" "}
                    {new Date(project.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
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
                            <strong>{project.name}</strong>. Any applications
                            using the old key will stop working immediately.
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
                            <strong>{project.name}</strong> and all associated
                            data including logs and alert rules.
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
        </div>
      )}

      <ApiKeyRevealDialog
        apiKey={rotatedApiKey}
        title="API key rotated"
        description="Your previous key is invalid. Copy the new key now — it won't be shown again."
        open={!!rotatedApiKey}
        onOpenChange={(open) => {
          if (!open) setRotatedApiKey(null);
        }}
      />
    </>
  );
}