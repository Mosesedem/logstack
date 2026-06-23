'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useSession } from 'next-auth/react'

type OrgRole = 'owner' | 'admin' | 'member' | 'viewer'

interface OrgMeResponse {
  id: string
  name: string
  slug: string
  createdAt: string
  updatedAt: string
  role: OrgRole
}

/**
 * Returns the current user's role in their organization.
 * Calls GET /v1/organizations/me via TanStack Query (queryKey: ["org-me"]).
 * Returns null while loading, on error, or when the user has no org membership.
 */
export function useOrgRole(): OrgRole | null {
  const { data: session } = useSession()

  const { data } = useQuery<OrgMeResponse>({
    queryKey: ['org-me'],
    queryFn: () => api.get<OrgMeResponse>('/organizations/me'),
    enabled: !!session,
    staleTime: 5 * 60 * 1000, // 5 minutes — role changes are infrequent
  })

  if (!data?.role) return null

  // Validate the role is one of the known values before returning
  const knownRoles: OrgRole[] = ['owner', 'admin', 'member', 'viewer']
  if (!knownRoles.includes(data.role)) return null

  return data.role
}
