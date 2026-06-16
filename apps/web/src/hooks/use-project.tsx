'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Project } from '@/types'
import { useSession } from 'next-auth/react'

interface ProjectContextType {
  projects: Project[]
  currentProject: Project | null
  setCurrentProject: (project: Project) => void
  isLoading: boolean
  error: Error | null
  refreshProjects: () => void
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null)

  const { data: projects = [], isLoading, error, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/projects'),
    enabled: !!session,
  })

  // Keep current project in sync with the authenticated user's project list.
  // A stale localStorage id (from another account) causes 403s on logs + WS.
  useEffect(() => {
    if (!session) {
      setCurrentProjectState(null)
      localStorage.removeItem('currentProjectId')
      return
    }
    if (isLoading) return

    if (projects.length === 0) {
      if (currentProject) setCurrentProjectState(null)
      localStorage.removeItem('currentProjectId')
      return
    }

    const isCurrentValid =
      currentProject && projects.some((p) => p.id === currentProject.id)
    if (isCurrentValid) return

    const savedProjectId = localStorage.getItem('currentProjectId')
    const savedProject = projects.find((p) => p.id === savedProjectId)
    const next = savedProject ?? projects[0]
    setCurrentProjectState(next)
    localStorage.setItem('currentProjectId', next.id)
  }, [projects, currentProject, session, isLoading])

  const setCurrentProject = useCallback((project: Project) => {
    setCurrentProjectState(project)
    localStorage.setItem('currentProjectId', project.id)
  }, [])

  const refreshProjects = useCallback(() => {
    refetch()
  }, [refetch])

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProject,
        setCurrentProject,
        isLoading,
        error: (error as Error) ?? null,
        refreshProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider')
  }
  return context
}
