'use client'

import { useState } from 'react'
import { Log } from '@/types'
import { LevelBadge } from './level-badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatRelativeTime } from '@/lib/utils'
import { ChevronDown, ChevronRight, Copy, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LogCardProps {
  log: Log
}

function formatFullTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString() + ' · ' + d.toISOString()
  } catch {
    return iso
  }
}

export function LogCard({ log }: LogCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const copyLog = (e: React.MouseEvent) => {
    e.stopPropagation()
    const payload = {
      id: log.id,
      level: log.level,
      message: log.message,
      source: log.source,
      metadata: log.metadata,
      createdAt: log.createdAt,
    }
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
  }

  const copyMessage = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(log.message)
  }

  const isConsole = (log.source || '').toLowerCase() === 'console'

  return (
    <Card
      className="cursor-pointer transition-all hover:bg-muted/60 border-l-2"
      style={{ borderLeftColor: isConsole ? '#a371f7' : undefined }}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <button
            className="mt-1 flex-shrink-0"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          <LevelBadge level={log.level} />

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-sm break-words pr-2">{log.message}</p>
              <div className="flex items-center gap-1 opacity-60 hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={copyMessage}
                  title="Copy message"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={copyLog}
                  title="Copy full log as JSON"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1" title={formatFullTime(log.createdAt)}>
                <Clock className="h-3 w-3" />
                {formatRelativeTime(log.createdAt)}
              </span>

              {log.source && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase ${isConsole ? 'bg-purple-500/10 text-purple-400' : 'bg-muted text-muted-foreground'}`}
                  title="Log source"
                >
                  {isConsole ? 'console.*' : log.source}
                </span>
              )}

              {log.id != null && (
                <span className="font-mono text-[10px] opacity-50">#{log.id}</span>
              )}
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-3 ml-7 space-y-3 text-xs">
            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <div>
                <div className="mb-1 font-medium text-muted-foreground">Metadata</div>
                <pre className="max-h-60 overflow-auto rounded bg-muted/70 p-3 text-[11px] leading-snug border">
{JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            )}

            {/* Show context if present on the record */}
            {(log as any).context && (
              <div>
                <div className="mb-1 font-medium text-muted-foreground">Context</div>
                <pre className="max-h-40 overflow-auto rounded bg-muted/70 p-3 text-[11px] leading-snug border">
{JSON.stringify((log as any).context, null, 2)}
                </pre>
              </div>
            )}

            <div className="pt-1 text-[10px] text-muted-foreground flex items-center gap-2">
              <span>Full time: {new Date(log.createdAt).toISOString()}</span>
              <button onClick={copyLog} className="underline hover:text-foreground">Copy JSON</button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
