"use client";

import { Project } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Key, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProjectListProps {
  projects: Project[];
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

export function ProjectList({
  projects,
  onDelete,
  isLoading,
}: ProjectListProps) {
  const { toast } = useToast();

  const copyApiKey = (apiKey: string) => {
    navigator.clipboard.writeText(apiKey);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  if (projects.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        No projects yet. Create your first project to get started.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <Card key={project.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{project.name}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(project.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <code className="flex-1 truncate text-xs bg-muted px-2 py-1 rounded">
                  {project.apiKey?.slice(0, 20) || "N/A"}...
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => project.apiKey && copyApiKey(project.apiKey)}
                  disabled={!project.apiKey}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Created {new Date(project.createdAt).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
