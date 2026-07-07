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

    // Pass JWT via query param — browsers cannot set Authorization on WS, and
    // using the token as a subprotocol requires the server to echo it back in
    // the upgrade response (fragile with long JWTs).
    const params = new URLSearchParams({
      projectId,
      token: session.accessToken,
    })
    const ws = new WebSocket(`${WS_URL}/stream?${params.toString()}`)

    ws.onopen = () => {
      setIsConnected(true)
      setError(null)
    }

    ws.onmessage = (event) => {
      try {
        const raw: string = event.data
        const newLogs: Log[] = []
        // Server may batch multiple JSON logs separated by \n in one frame.
        for (const line of raw.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const log: Log = JSON.parse(trimmed)
            newLogs.push(log)
          } catch {
            // skip bad line
          }
        }
        if (newLogs.length > 0) {
          // Prepend reversed so newest in batch appears first
          setLogs((prev) => [...[...newLogs].reverse(), ...prev].slice(0, 100))
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }

    ws.onerror = () => {
      setError(new Error('WebSocket connection error'))
    }

    ws.onclose = (event) => {
      setIsConnected(false)
      if (event.code !== 1000) {
        setError(
          new Error(
            `WebSocket closed (${event.code}${event.reason ? `: ${event.reason}` : ''})`,
          ),
        )
      }
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
