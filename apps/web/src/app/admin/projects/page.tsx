"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/loading";

interface Project {
  id: string;
  name: string;
  ownerId: number;
  createdAt: string;
  Owner?: {
    name: string;
    email: string;
  };
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await apiClient.get<Project[]>("/admin/projects");
        setProjects(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading projects">
        <PageHeaderSkeleton withAction={false} />
        <TableSkeleton rows={8} columns={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
      </div>
      <div className="rounded-md border bg-card">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Name
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  ID
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Owner
                </th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {projects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b transition-colors hover:bg-muted/50"
                >
                  <td className="p-4 align-middle font-medium">
                    {project.name}
                  </td>
                  <td className="p-4 align-middle font-mono text-xs">
                    {project.id}
                  </td>
                  <td className="p-4 align-middle">
                    {project.Owner ? (
                      <div className="flex flex-col">
                        <span>{project.Owner.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {project.Owner.email}
                        </span>
                      </div>
                    ) : (
                      "Unknown"
                    )}
                  </td>
                  <td className="p-4 align-middle">
                    {new Date(project.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
