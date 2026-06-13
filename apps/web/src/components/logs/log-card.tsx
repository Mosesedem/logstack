'use client'

import { useState } from 'react'
import { Log } from '@/types'
import { LevelBadge } from './level-badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatRelativeTime } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface LogCardProps {
  log: Log
}

export function LogCard({ log }: LogCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <button className="mt-1 flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <LevelBadge level={log.level} />
          <div className="flex-1 min-w-0">
            <p className="font-mono text-sm truncate">{log.message}</p>
            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
              <span>{formatRelativeTime(log.createdAt)}</span>
              {log.source && <span>Source: {log.source}</span>}
            </div>
          </div>
        </div>
        {isExpanded && log.metadata && (
          <div className="mt-4 ml-7 rounded-md bg-muted p-3">
            <pre className="text-xs overflow-auto">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
