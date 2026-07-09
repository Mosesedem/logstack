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

/**
 * Build a WebSocket base URL ending in `/v1` (no trailing `/stream`).
 *
 * Production mistakes that used to break dashboard realtime while mobile worked:
 * - `NEXT_PUBLIC_WS_URL=…/api/v1` (nginx `/api/` location had no Upgrade headers)
 * - `…/v1/stream` already appended (hook would produce `/stream/stream`)
 * - http vs ws scheme mismatch
 */
export function resolveWebSocketBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_WS_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8080/v1'

  let url = raw.trim().replace(/\/+$/, '')

  // Legacy /api/v1 → /v1 (backend + nginx WS upgrade live under /v1)
  url = url.replace(/\/api\/v1(?=\/|$)/, '/v1')

  // If someone set …/v1/stream, strip the path suffix — we append /stream ourselves
  url = url.replace(/\/stream$/i, '')

  // http(s) → ws(s)
  if (url.startsWith('https://')) {
    url = 'wss://' + url.slice('https://'.length)
  } else if (url.startsWith('http://')) {
    url = 'ws://' + url.slice('http://'.length)
  } else if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    // Bare host or path — prefer secure when the page is https
    const scheme =
      typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? 'wss'
        : 'ws'
    url = `${scheme}://${url.replace(/^\/\//, '')}`
  }

  // Ensure /v1 prefix exists for logstack API
  try {
    const parsed = new URL(url)
    if (!parsed.pathname || parsed.pathname === '/') {
      parsed.pathname = '/v1'
      url = parsed.toString().replace(/\/+$/, '')
    }
  } catch {
    // leave as-is
  }

  return url.replace(/\/+$/, '')
}

export function useWebSocket({
  projectId,
  enabled = true,
}: UseWebSocketOptions): UseWebSocketReturn {
  const { data: session } = useSession()
  const [logs, setLogs] = useState<Log[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const intentionalCloseRef = useRef(false)

  const connect = useCallback(() => {
    if (!projectId || !session?.accessToken || !enabled) return

    // Close any previous socket before opening a new one
    intentionalCloseRef.current = true
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = undefined
    }
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'reconnect')
      } catch {
        /* ignore */
      }
      wsRef.current = null
    }
    intentionalCloseRef.current = false

    // Browsers cannot set Authorization on WebSocket — use query token.
    // Endpoint: GET /v1/stream (WSAuth), same as mobile.
    const base = resolveWebSocketBaseUrl()
    const params = new URLSearchParams({
      projectId,
      token: session.accessToken,
    })
    const wsUrl = `${base}/stream?${params.toString()}`

    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl)
    } catch (e) {
      setError(
        e instanceof Error
          ? e
          : new Error('Failed to open WebSocket'),
      )
      setIsConnected(false)
      return
    }

    ws.onopen = () => {
      setIsConnected(true)
      setError(null)
    }

    ws.onmessage = (event) => {
      try {
        const raw: string =
          typeof event.data === 'string' ? event.data : String(event.data)
        const newLogs: Log[] = []
        // Server may batch multiple JSON logs separated by \n in one frame.
        for (const line of raw.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>
            // Skip control frames e.g. {"type":"error",...}
            if (parsed.type && !parsed.id) continue
            if (typeof parsed.id !== 'number' && typeof parsed.id !== 'string') {
              continue
            }
            newLogs.push(parsed as unknown as Log)
          } catch {
            // skip bad line
          }
        }
        if (newLogs.length > 0) {
          // Prepend reversed so newest in batch appears first
          setLogs((prev) =>
            [...[...newLogs].reverse(), ...prev].slice(0, 100),
          )
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
      if (intentionalCloseRef.current) return

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
      intentionalCloseRef.current = true
      if (wsRef.current) {
        try {
          wsRef.current.close(1000, 'unmount')
        } catch {
          /* ignore */
        }
        wsRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = undefined
      }
    }
  }, [connect])

  // Clear logs when project changes
  useEffect(() => {
    setLogs([])
  }, [projectId])

  return { logs, isConnected, error }
}
