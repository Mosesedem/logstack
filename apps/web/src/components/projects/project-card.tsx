"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api-client";
import { Project, UsageSummary } from "@/types";
import { Archive, Check, Copy, Pencil, RefreshCw, Users, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface ProjectCardProps {
  project: Project;
  usageSummary: UsageSummary | null;
  onArchive: (id: string) => void;
  onRename: (id: string, newName: string) => void;
  onRefresh: () => void;
}

export function ProjectCard({
  project,
  usageSummary,
  onArchive,
  onRename,
  onRefresh,
}: ProjectCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);

  const renameMutation = useMutation({
    mutationFn: (name: string) =>
      api.put<Project>(`/projects/${project.id}`, { name }),
    onSuccess: (updated) => {
      onRename(project.id, updated.name);
      setIsEditing(false);
      toast({ title: "Project renamed" });
    },
    onError: (error: Error) => {
      setEditName(project.name);
      setIsEditing(false);
      toast({
        title: "Rename failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => api.patch(`/projects/${project.id}/archive`, {}),
    onSuccess: () => {
      onArchive(project.id);
      toast({ title: "Project archived" });
    },
    onError: (error: Error) => {
      toast({
        title: "Archive failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const handleSaveRename = () => {
    const name = editName.trim();
    if (!name || name === project.name) {
      setEditName(project.name);
      setIsEditing(false);
      return;
    }
    renameMutation.mutate(name);
  };

  const handleCancelRename = () => {
    setEditName(project.name);
    setIsEditing(false);
  };

  const usagePct = usageSummary?.usagePercentage ?? 0;
  const logLimit = usageSummary?.logLimit ?? 0;
  const totalLogs = usageSummary?.totalLogCount ?? 0;

  return (
    <Card>
      <CardHeader>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveRename();
                if (e.key === "Escape") handleCancelRename();
              }}
              className="h-7 text-base font-semibold"
              autoFocus
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={handleSaveRename}
              disabled={renameMutation.isPending}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={handleCancelRename}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>{project.name}</CardTitle>
              <CardDescription>
                Created{" "}
                {new Date(project.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Project ID copy */}
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded bg-muted px-2 py-1 text-xs truncate">
            {project.id}
          </code>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => copyToClipboard(project.id)}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Usage progress bar */}
        {usageSummary && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{totalLogs.toLocaleString()} logs</span>
              <span>{logLimit.toLocaleString()} limit</span>
            </div>
            <Progress
              value={Math.min(usagePct, 100)}
              className={usagePct >= 90 ? "text-red-500" : undefined}
            />
          </div>
        )}

        {/* Actions row */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(`/settings/team?projectId=${project.id}`)
            }
          >
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Members
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={archiveMutation.isPending}
              >
                <Archive className="mr-1.5 h-3.5 w-3.5" />
                Archive
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive Project?</AlertDialogTitle>
                <AlertDialogDescription>
                  <strong>{project.name}</strong> will be archived and hidden
                  from the projects list. You can restore it later by contacting
                  support or using the API with{" "}
                  <code>includeArchived=true</code>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => archiveMutation.mutate()}
                >
                  Archive Project
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
