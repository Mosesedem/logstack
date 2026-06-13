'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Log } from '@/types'

interface UseWebSocketOptions {
  projectId?: string
  enabled?: boolean
}

interface UseWebSocketReturn {
  logs: Log[]
  isConnected: boolean
  error: Error | null
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/v1'

export function useWebSocket({ projectId, enabled = true }: UseWebSocketOptions): UseWebSocketReturn {
  const { data: session } = useSession()
  const [logs, setLogs] = useState<Log[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>(undefined)

  const connect = useCallback(() => {
    if (!projectId || !session?.accessToken || !enabled) return

    const ws = new WebSocket(`${WS_URL}/stream?projectId=${projectId}`, [
      session.accessToken,
    ])

    ws.onopen = () => {
      setIsConnected(true)
      setError(null)
    }

    ws.onmessage = (event) => {
      try {
        const log: Log = JSON.parse(event.data)
        setLogs((prev) => [log, ...prev].slice(0, 100)) // Keep last 100 logs
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }

    ws.onerror = (event) => {
      console.error('WebSocket error:', event)
      setError(new Error('WebSocket connection error'))
    }

    ws.onclose = () => {
      setIsConnected(false)
      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, 3000)
    }

    wsRef.current = ws
  }, [projectId, session?.accessToken, enabled])

  useEffect(() => {
    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [connect])

  // Clear logs when project changes
  useEffect(() => {
    setLogs([])
  }, [projectId])

  return { logs, isConnected, error }
}
