'use client'

import { useProject } from '@/hooks/use-project'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function ProjectSwitcher({ className }: { className?: string }) {
  const { projects, currentProject, setCurrentProject, isLoading } = useProject()

  if (isLoading) {
    return <div className="h-10 w-48 animate-pulse rounded-md bg-muted" />
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
