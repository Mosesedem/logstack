"use client";

import { useProject } from "@/hooks/use-project";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ProjectSwitcher({ className }: { className?: string }) {
  const { projects, currentProject, setCurrentProject, isLoading } =
    useProject();

  if (isLoading) {
    return <Skeleton className={cn("h-10 w-48 rounded-md", className)} />;
  }

  if (projects.length === 0) {
    return <div className="text-sm text-muted-foreground">No projects</div>
  }

  return (
    <Select
      value={currentProject?.id}
      onValueChange={(id) => {
        const project = projects.find((p) => p.id === id)
        if (project) setCurrentProject(project)
      }}
    >
      <SelectTrigger className={cn('w-48', className)}>
        <SelectValue placeholder="Select project" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
