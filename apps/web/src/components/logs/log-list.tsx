'use client'

import { useRef, useCallback } from 'react'
import { Log } from '@/types'
import { LogCard } from './log-card'
import { Loader2 } from 'lucide-react'

interface LogListProps {
  logs: Log[]
  onLoadMore: () => void
  hasMore: boolean
  isLoading: boolean
}

export function LogList({ logs, onLoadMore, hasMore, isLoading }: LogListProps) {
  const observer = useRef<IntersectionObserver>(undefined)

  const lastLogRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading) return
      if (observer.current) observer.current.disconnect()

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          onLoadMore()
        }
      })

      if (node) observer.current.observe(node)
    },
    [isLoading, hasMore, onLoadMore]
  )

  if (logs.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-center text-muted-foreground">
        <div>
          No logs match current filters.<br />
          <span className="text-xs">Clear filters or send logs with the SDK (console.* are auto-captured).</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {logs.map((log, index) => (
        <div
          key={`${log.id}-${index}`}
          ref={index === logs.length - 1 ? lastLogRef : undefined}
        >
          <LogCard log={log} />
        </div>
      ))}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
